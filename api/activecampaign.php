<?php
/* ============================================================
   Alexandra Feuerer – ActiveCampaign-Proxy (PHP)
   ------------------------------------------------------------
   Nimmt die Formulardaten der Landing Pages entgegen und legt den
   Kontakt in ActiveCampaign an: Liste + Tags + benutzerdefinierte
   Felder. Der API-Key bleibt hier auf dem Server – im Frontend
   wäre er für jeden lesbar und damit ein Vollzugriff auf die
   komplette Kontaktdatenbank.

   Erwartet POST mit JSON-Body (siehe api/README.md).
   Antwortet immer mit JSON:
     200 { ok: true,  contact: "123" }   – verarbeitet
     422 { ok: false, error: "..." }     – Eingabe kaputt, kein Retry
     429 { ok: false, error: "..." }     – zu viele Anfragen
     502 { ok: false, error: "..." }     – AC nicht erreichbar, Retry sinnvoll

   Das Frontend legt bei 5xx/Netzwerkfehlern eine Wiedervorlage im
   localStorage an – deshalb ist es wichtig, "kaputte Eingabe" (422)
   und "AC hakt" (502) sauber zu trennen.
   ============================================================ */

declare(strict_types=1);

const AC_TIMEOUT   = 10;      /* Sekunden pro API-Aufruf */
const AC_CACHE_TTL = 3600;    /* Feld-/Tag-IDs so lange zwischenspeichern */

/** "Gibt es schon" – von AC als 422 gemeldet, für uns meist ein Erfolg. */
class AcDuplicateException extends RuntimeException {}

/* ---------- Konfiguration laden ---------- */

$configPath = __DIR__ . '/config.php';
if (!is_readable($configPath)) {
  respond(500, array('ok' => false, 'error' => 'config_missing'));
}
$config = require $configPath;

/* ---------- CORS / Methode ---------- */

$origin  = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$allowed = isset($config['allowed_origins']) ? $config['allowed_origins'] : array();

if ($origin !== '' && !empty($allowed)) {
  if (!in_array($origin, $allowed, true)) {
    respond(403, array('ok' => false, 'error' => 'origin_not_allowed'));
  }
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
/* ---------- Freie Plaetze (GET ?action=seats) ----------
   Liefert den echten Anmeldestand fuer die Verknappungs-Anzeige.
   Bewusst ein sehr schmaler Zweig: kein Body, keine Personendaten,
   nur Limit und Rest. Eigener Rate-Limit-Topf, damit die Anzeige
   niemals das Kontingent einer echten Anmeldung aufbraucht. */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
    && (isset($_GET['action']) ? $_GET['action'] : '') === 'seats') {
  $seatsRl = isset($config['seats_rate_limit']) ? (int) $config['seats_rate_limit'] : 120;
  if ($seatsRl > 0 && !rateLimitOk($seatsRl, 'seats')) {
    respond(429, array('ok' => false, 'error' => 'rate_limited'));
  }
  respondSeats($config);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  respond(405, array('ok' => false, 'error' => 'method_not_allowed'));
}

/* ---------- Body lesen ---------- */

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '' || strlen($raw) > 64000) {
  respond(422, array('ok' => false, 'error' => 'empty_body'));
}
$input = json_decode($raw, true);
if (!is_array($input)) {
  respond(422, array('ok' => false, 'error' => 'invalid_json'));
}

/* ---------- Bots aussortieren ----------
   Das Honeypot-Feld ist im Formular unsichtbar; nur Bots füllen es.
   Antwort bewusst 200/ok, damit der Bot keinen Unterschied merkt. */
if (!empty($input['hp'])) {
  respond(200, array('ok' => true, 'skipped' => 'honeypot'));
}

/* ---------- Rate Limit ---------- */

$limit = isset($config['rate_limit']) ? (int) $config['rate_limit'] : 0;
if ($limit > 0 && !rateLimitOk($limit)) {
  respond(429, array('ok' => false, 'error' => 'rate_limited'));
}

/* ---------- Eingabe prüfen ----------
   Die Validierung im Browser ist Komfort, keine Sicherheit – hier
   wird sie wiederholt, weil dieser Endpunkt öffentlich erreichbar ist. */

$formType = ($input['form'] ?? '') === 'quiz' ? 'quiz' : 'optin';
$vorname  = cleanText($input['vorname'] ?? '', 60);
$email    = strtolower(trim((string) ($input['email'] ?? '')));
$telefon  = normalizePhone($input['vorwahl'] ?? '', $input['telefon'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(422, array('ok' => false, 'error' => 'invalid_email'));
}
if (textLength($vorname) < 2) {
  respond(422, array('ok' => false, 'error' => 'invalid_name'));
}

/* ---------- Feldwerte zusammenstellen ---------- */

$utms   = is_array($input['utms'] ?? null) ? $input['utms'] : array();
$values = array(
  'variant'      => cleanText($input['variant'] ?? '', 40),
  'utm_source'   => cleanText($utms['utm_source'] ?? '', 100),
  'utm_medium'   => cleanText($utms['utm_medium'] ?? '', 100),
  'utm_campaign' => cleanText($utms['utm_campaign'] ?? '', 100),
);

/* Umfrage-Antworten: kommen als { frage: { values: [], labels: [] } }.
   In die AC-Felder wandert der Klartext (lesbar im Kontakt), die
   maschinenlesbaren Werte werden weiter unten zu Tags. */
$answers = is_array($input['answers'] ?? null) ? $input['answers'] : array();
foreach ($answers as $key => $answer) {
  if (!is_array($answer)) continue;
  $labels = is_array($answer['labels'] ?? null) ? $answer['labels'] : array();
  $labels = array_map(function ($l) { return cleanText($l, 500); }, $labels);
  $labels = array_filter($labels, 'strlen');
  if ($labels) $values[(string) $key] = implode(', ', $labels);
}

/* ---------- Tags bestimmen ---------- */

$tagNames = $formType === 'quiz'
  ? (array) ($config['tags_quiz'] ?? array())
  : (array) ($config['tags_optin'] ?? array());

if ($formType === 'quiz' && !empty($config['quiz_answer_tags'])) {
  $prefix = (string) ($config['quiz_answer_tag_prefix'] ?? 'umfrage-');
  $only   = (array) ($config['quiz_answer_tag_fields'] ?? array());
  foreach ($answers as $key => $answer) {
    if ($only && !in_array((string) $key, $only, true)) continue;
    if (!is_array($answer['values'] ?? null)) continue;
    foreach ($answer['values'] as $value) {
      $slug = slugify((string) $value);
      /* Freitext ergibt keine sinnvollen Tags – nur kurze Codes taggen */
      if ($slug === '' || strlen($slug) > 40) continue;
      $tagNames[] = $prefix . slugify((string) $key) . '-' . $slug;
    }
  }
}

/* ---------- Ab hier reden wir mit ActiveCampaign ---------- */

try {
  $contactId = acSyncContact($config, $vorname, $email, $telefon, $values);

  if (!empty($config['list_id'])) {
    acSubscribe($config, $contactId);
  }
  foreach (array_unique($tagNames) as $tagName) {
    acTagContact($config, $contactId, (string) $tagName);
  }

  respond(200, array('ok' => true, 'contact' => $contactId));

} catch (Throwable $e) {
  logError($config, $formType . ' / ' . $email . ' – ' . $e->getMessage());
  /* 502 signalisiert dem Frontend: nicht der Nutzer ist schuld,
     der Versuch darf später wiederholt werden. */
  respond(502, array('ok' => false, 'error' => 'upstream_failed'));
}


/* ============================================================
   ActiveCampaign-Aufrufe
   ============================================================ */

/**
 * Legt den Kontakt an oder aktualisiert ihn (Schlüssel ist die E-Mail).
 * Gibt die Kontakt-ID zurück.
 */
function acSyncContact(array $config, string $vorname, string $email, string $telefon, array $values): string {
  $contact = array(
    'email'     => $email,
    'firstName' => $vorname,
  );
  if ($telefon !== '') $contact['phone'] = $telefon;

  $fieldValues = array();
  foreach ($values as $key => $value) {
    if ($value === '' || $value === null) continue;
    $fieldId = resolveFieldId($config, (string) $key);
    if ($fieldId === null) continue;
    $fieldValues[] = array('field' => $fieldId, 'value' => (string) $value);
  }
  if ($fieldValues) $contact['fieldValues'] = $fieldValues;

  $res = acRequest($config, 'POST', '/api/3/contact/sync', array('contact' => $contact));
  $id  = $res['contact']['id'] ?? null;
  if (!$id) throw new RuntimeException('contact/sync ohne ID: ' . json_encode($res));
  return (string) $id;
}

/** Setzt den Kontakt auf die konfigurierte Liste. */
function acSubscribe(array $config, string $contactId): void {
  acRequest($config, 'POST', '/api/3/contactLists', array(
    'contactList' => array(
      'list'    => (int) $config['list_id'],
      'contact' => (int) $contactId,
      'status'  => (int) ($config['list_status'] ?? 1),
    ),
  ));
}

/** Hängt einen Tag an den Kontakt (legt ihn bei Bedarf an). */
function acTagContact(array $config, string $contactId, string $tagName): void {
  $tagId = resolveTagId($config, $tagName);
  if ($tagId === null) return;
  try {
    acRequest($config, 'POST', '/api/3/contactTags', array(
      'contactTag' => array('contact' => (string) $contactId, 'tag' => (string) $tagId),
    ));
  } catch (AcDuplicateException $e) {
    /* Kontakt hat den Tag schon – für uns ein Erfolg. */
  }
}

/**
 * Sucht die numerische ID eines Tags, legt ihn bei Bedarf an.
 * Ergebnis wird zwischengespeichert, sonst kostet jede Anmeldung
 * zusätzliche API-Aufrufe.
 */
function resolveTagId(array $config, string $tagName) {
  $cached = cacheGet('tag_' . md5($tagName));
  if ($cached !== null) return $cached;

  $res = acRequest($config, 'GET', '/api/3/tags?limit=100&search=' . rawurlencode($tagName));
  foreach (($res['tags'] ?? array()) as $tag) {
    if (isset($tag['tag']) && strcasecmp($tag['tag'], $tagName) === 0) {
      cacheSet('tag_' . md5($tagName), (string) $tag['id']);
      return (string) $tag['id'];
    }
  }

  if (empty($config['auto_create_tags'])) return null;

  try {
    $created = acRequest($config, 'POST', '/api/3/tags', array(
      'tag' => array('tag' => $tagName, 'tagType' => 'contact', 'description' => 'Landing Page'),
    ));
    $id = $created['tag']['id'] ?? null;
    if ($id) {
      cacheSet('tag_' . md5($tagName), (string) $id);
      return (string) $id;
    }
  } catch (AcDuplicateException $e) {
    /* Parallele Anmeldung war schneller – einmal neu suchen. */
    $res = acRequest($config, 'GET', '/api/3/tags?limit=100&search=' . rawurlencode($tagName));
    foreach (($res['tags'] ?? array()) as $tag) {
      if (isset($tag['tag']) && strcasecmp($tag['tag'], $tagName) === 0) return (string) $tag['id'];
    }
  }
  return null;
}

/**
 * Übersetzt den Formular-Schlüssel (z. B. "stand") in die AC-Feld-ID.
 * Gematcht wird gegen das Personalisierungs-Tag (%AF_STAND%) oder den
 * Feld-Titel. Fehlende Felder werden angelegt, wenn erlaubt.
 */
function resolveFieldId(array $config, string $key) {
  /* Pro Request nur einmal laden: Eine Umfrage-Übertragung fragt zehn
     Felder ab – ohne dieses Memo wären das zehn API-Aufrufe, sobald der
     Datei-Zwischenspeicher nicht schreibbar ist. */
  static $memo = null;

  $wanted = $config['fields'][$key] ?? null;
  if (!$wanted) return null;
  $wanted = strtoupper(trim((string) $wanted, '% '));

  $map = $memo !== null ? $memo : cacheGet('fields');
  if ($map === null) {
    $map = array();
    $res = acRequest($config, 'GET', '/api/3/fields?limit=100');
    foreach (($res['fields'] ?? array()) as $field) {
      $perstag = strtoupper(trim((string) ($field['perstag'] ?? ''), '% '));
      $title   = strtoupper(trim((string) ($field['title'] ?? '')));
      if ($perstag !== '') $map[$perstag] = (string) $field['id'];
      if ($title !== '' && !isset($map[$title])) $map[$title] = (string) $field['id'];
    }
    cacheSet('fields', $map);
  }
  $memo = $map;
  if (isset($map[$wanted])) return $map[$wanted];

  if (empty($config['auto_create_fields'])) return null;

  /* Feld anlegen und sofort allen Listen zuordnen (relid 0),
     sonst taucht es im AC-Kontakt nicht auf. */
  $created = acRequest($config, 'POST', '/api/3/fields', array(
    'field' => array(
      'type'     => 'text',
      'title'    => ucfirst(str_replace('_', ' ', $key)),
      'perstag'  => $wanted,
      'descript' => 'Automatisch angelegt von der Webinar-Landingpage',
      'visible'  => 1,
    ),
  ));
  /* POST /fields antwortet mit "fields" (Array), ältere Konten mit "field" */
  $id = $created['field']['id'] ?? ($created['fields'][0]['id'] ?? null);
  if (!$id) return null;

  /* relid 0 = für alle Listen sichtbar. Ohne diesen Schritt existiert das
     Feld zwar, taucht aber im Kontakt nicht auf. */
  try {
    acRequest($config, 'POST', '/api/3/fieldRels', array(
      'fieldRel' => array('field' => (string) $id, 'relid' => 0),
    ));
  } catch (Throwable $e) { /* Zuordnung optional – Feld existiert bereits */ }

  $map[$wanted] = (string) $id;
  $memo = $map;
  cacheSet('fields', $map);
  return (string) $id;
}

/** Ein HTTP-Aufruf gegen die AC-API v3. */
function acRequest(array $config, string $method, string $path, ?array $body = null): array {
  $url = rtrim((string) $config['api_url'], '/') . $path;
  $payload = $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE);

  $headers = array(
    'Api-Token: ' . $config['api_key'],
    'Accept: application/json',
  );
  if ($payload !== null) $headers[] = 'Content-Type: application/json';

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, array(
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_CUSTOMREQUEST  => $method,
      CURLOPT_HTTPHEADER     => $headers,
      CURLOPT_TIMEOUT        => AC_TIMEOUT,
      CURLOPT_CONNECTTIMEOUT => 5,
    ));
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    $raw    = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('cURL: ' . $err);
  } else {
    $context = stream_context_create(array('http' => array(
      'method'        => $method,
      'header'        => implode("\r\n", $headers),
      'content'       => $payload,
      'timeout'       => AC_TIMEOUT,
      'ignore_errors' => true,
    )));
    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) throw new RuntimeException('HTTP-Request fehlgeschlagen: ' . $path);
    $status = 0;
    foreach ($http_response_header ?? array() as $line) {
      if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) $status = (int) $m[1];
    }
  }

  $data = json_decode((string) $raw, true);
  if (!is_array($data)) $data = array();

  if ($status === 422 && isDuplicateError($data)) {
    throw new AcDuplicateException('duplicate');
  }
  if ($status < 200 || $status >= 300) {
    throw new RuntimeException($method . ' ' . $path . ' → HTTP ' . $status . ' ' . substr((string) $raw, 0, 400));
  }
  return $data;
}

/** AC meldet "gibt es schon" als 422 mit Duplicate-Code. */
function isDuplicateError(array $data): bool {
  foreach (($data['errors'] ?? array()) as $error) {
    $code = strtolower((string) ($error['code'] ?? ''));
    $text = strtolower((string) ($error['title'] ?? ''));
    if (strpos($code, 'duplicate') !== false || strpos($text, 'duplicate') !== false) return true;
    if (strpos($text, 'already exists') !== false) return true;
  }
  return false;
}


/* ============================================================
   Freie Plaetze
   ------------------------------------------------------------
   Es wird ausschliesslich gezaehlt, was wirklich in AC steht.
   Keine Schaetzung, keine Zufallszahl: Die Anzeige darf nur
   behaupten, was sich belegen laesst.
   ============================================================ */

function respondSeats(array $config): void {
  $limit = isset($config['seats_limit']) ? (int) $config['seats_limit'] : 0;
  if ($limit <= 0) {
    /* Nicht konfiguriert = Anzeige bleibt statisch. Kein Fehler. */
    respond(200, array('ok' => false, 'error' => 'seats_disabled'));
  }

  /* Der Stand steht auf jeder Seite – ohne Zwischenspeicher wuerde
     jeder Seitenaufruf ActiveCampaign abfragen. */
  $ttl    = isset($config['seats_cache_ttl']) ? (int) $config['seats_cache_ttl'] : 300;
  $cached = cacheGet('seats_taken', $ttl);

  if ($cached === null) {
    try {
      $taken = acCountRegistrations($config);
    } catch (Throwable $e) {
      logError($config, 'seats – ' . $e->getMessage());
      respond(502, array('ok' => false, 'error' => 'upstream_failed'));
    }
    cacheSet('seats_taken', $taken);
  } else {
    $taken = (int) $cached;
  }

  /* 'taken' wird bewusst NICHT ausgeliefert: Wie viele sich bereits
     angemeldet haben, geht die Oeffentlichkeit nichts an. */
  respond(200, array(
    'ok'        => true,
    'limit'     => $limit,
    'remaining' => max(0, $limit - $taken),
  ));
}

/**
 * Zaehlt die Anmeldungen. Bevorzugt ueber den Termin-Tag, damit ein
 * neuer Workshop wieder bei null anfaengt; ohne Tag ueber die Liste.
 */
function acCountRegistrations(array $config): int {
  $tagName = isset($config['seats_tag']) ? trim((string) $config['seats_tag']) : '';

  if ($tagName !== '') {
    $tagId = resolveTagId($config, $tagName);
    /* Tag noch nicht vorhanden = es hat sich noch niemand angemeldet. */
    if ($tagId === null) return 0;
    $res = acRequest($config, 'GET', '/api/3/contacts?limit=1&tagid=' . rawurlencode($tagId));
    return (int) ($res['meta']['total'] ?? 0);
  }

  if (!empty($config['list_id'])) {
    $res = acRequest($config, 'GET',
      '/api/3/contacts?limit=1&status=1&listid=' . (int) $config['list_id']);
    return (int) ($res['meta']['total'] ?? 0);
  }

  throw new RuntimeException('weder seats_tag noch list_id konfiguriert');
}


/* ============================================================
   Kleinkram
   ============================================================ */

/** Antwortet mit JSON und beendet den Request. */
function respond(int $status, array $body): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($body, JSON_UNESCAPED_UNICODE);
  exit;
}

/** Steuerzeichen raus, Länge begrenzen. */
function cleanText($value, int $max): string {
  if (!is_scalar($value)) return '';
  $value = (string) $value;
  /* Bei kaputtem UTF-8 gibt preg_replace null zurück – deshalb überall
     absichern, sonst gibt es unter PHP 8.1+ Deprecation-Warnungen. */
  $value = (string) preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value);
  $value = trim((string) preg_replace('/\s+/u', ' ', $value));
  return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

/** Zeichenlänge – mit Fallback, falls mbstring fehlt. */
function textLength(string $value): int {
  return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}

/**
 * Baut aus Vorwahl + nationaler Nummer eine E.164-Nummer
 * (+4915123456789). Die führende 0 der nationalen Nummer fällt weg –
 * "0151 …" ist die häufigste Eingabe und in E.164 falsch.
 */
function normalizePhone($vorwahl, $telefon): string {
  $country  = preg_replace('/\D/', '', (string) $vorwahl);
  $national = preg_replace('/\D/', '', (string) $telefon);
  if ($national === '') return '';
  $national = ltrim($national, '0');
  if ($national === '') return '';
  if ($country === '') return '+' . $national;
  return '+' . $country . $national;
}

/** Aus "Zu alt?" wird "zu-alt" – für Tag-Namen. */
function slugify(string $value): string {
  $value = strtolower(trim($value));
  $value = strtr($value, array('ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss'));
  $value = preg_replace('/[^a-z0-9]+/', '-', $value);
  return trim((string) $value, '-');
}

/** Einfache Wiedervorlage-Bremse pro IP und Stunde. */
function rateLimitOk(int $limit, string $bucket = 'form'): bool {
  $dir = cacheDir();
  if ($dir === null) return true;
  $ip   = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
  $file = $dir . '/rl_' . md5($bucket . '|' . $ip . date('YmdH')) . '.txt';
  $count = is_readable($file) ? (int) file_get_contents($file) : 0;
  if ($count >= $limit) return false;
  @file_put_contents($file, (string) ($count + 1), LOCK_EX);
  return true;
}

function cacheDir(): ?string {
  $dir = __DIR__ . '/.cache';
  if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return null;
  return is_writable($dir) ? $dir : null;
}

function cacheGet(string $key, int $ttl = AC_CACHE_TTL) {
  $dir = cacheDir();
  if ($dir === null) return null;
  $file = $dir . '/' . preg_replace('/[^a-z0-9_]/i', '', $key) . '.json';
  if (!is_readable($file) || (time() - (int) filemtime($file)) > $ttl) return null;
  $data = json_decode((string) file_get_contents($file), true);
  return isset($data['v']) ? $data['v'] : null;
}

function cacheSet(string $key, $value): void {
  $dir = cacheDir();
  if ($dir === null) return;
  $file = $dir . '/' . preg_replace('/[^a-z0-9_]/i', '', $key) . '.json';
  @file_put_contents($file, json_encode(array('v' => $value)), LOCK_EX);
}

function logError(array $config, string $message): void {
  if (empty($config['log_errors'])) return;
  @file_put_contents(
    __DIR__ . '/ac-errors.log',
    '[' . date('c') . '] ' . $message . "\n",
    FILE_APPEND | LOCK_EX
  );
}
