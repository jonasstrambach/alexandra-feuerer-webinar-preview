/* ============================================================
   Alexandra Feuerer – ActiveCampaign-Proxy (Serverless)
   ------------------------------------------------------------
   Gleiche Aufgabe wie api/activecampaign.php, nur für Hosting
   ohne PHP. Läuft unverändert auf:

     Netlify Functions (v2)   → netlify/functions/activecampaign.mjs
     Vercel Edge Functions    → api/activecampaign.mjs
     Cloudflare Pages         → functions/api/activecampaign.mjs

   Die Zugangsdaten kommen aus Environment-Variablen (siehe
   api/README.md) – niemals ins Repository schreiben.
   ============================================================ */

/* ---------- Zuordnung Formularfeld → AC-Personalisierungs-Tag ----------
   Muss identisch zu 'fields' in api/config.sample.php bleiben, damit
   beide Backends dieselben Felder befüllen. */
const FIELD_MAP = {
  variant: 'AF_VARIANTE',
  utm_source: 'AF_UTM_SOURCE',
  utm_medium: 'AF_UTM_MEDIUM',
  utm_campaign: 'AF_UTM_CAMPAIGN',
  stand: 'AF_STAND',
  vorsorge: 'AF_VORSORGE',
  blocker: 'AF_BLOCKER',
  versucht: 'AF_VERSUCHT',
  ziel: 'AF_ZIEL',
  wichtig: 'AF_WICHTIG',
};

/* Nur diese Fragen bekommen zusätzlich Antwort-Tags. */
const QUIZ_TAG_FIELDS = ['stand', 'vorsorge', 'blocker', 'wichtig'];

const CACHE_TTL = 60 * 60 * 1000;   /* Feld-/Tag-IDs 1 Stunde halten */
const cache = new Map();            /* überlebt warme Invocations */

/* ============================================================
   Adapter – je nach Plattform greift einer davon
   ============================================================ */

/* Netlify Functions v2 und Vercel Edge Functions */
export default async function handler(request) {
  return handleRequest(request, globalThis.process?.env ?? {});
}

/* Cloudflare Pages Functions */
export const onRequestPost = (context) => handleRequest(context.request, context.env);
export const onRequestOptions = (context) => handleRequest(context.request, context.env);

/* ============================================================
   Ablauf
   ============================================================ */

async function handleRequest(request, env) {
  const config = readConfig(env);
  const origin = request.headers.get('origin') || '';

  if (config.allowedOrigins.length && origin && !config.allowedOrigins.includes(origin)) {
    return json(403, { ok: false, error: 'origin_not_allowed' });
  }
  const cors = origin
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, cors);
  if (!config.apiUrl || !config.apiKey) return json(500, { ok: false, error: 'config_missing' }, cors);

  let input;
  try {
    input = await request.json();
  } catch {
    return json(422, { ok: false, error: 'invalid_json' }, cors);
  }
  if (!input || typeof input !== 'object') return json(422, { ok: false, error: 'invalid_json' }, cors);

  /* Honeypot: unsichtbares Feld, das nur Bots ausfüllen. Antwort sieht
     bewusst wie ein Erfolg aus, damit der Bot nichts dazulernt. */
  if (input.hp) return json(200, { ok: true, skipped: 'honeypot' }, cors);

  const formType = input.form === 'quiz' ? 'quiz' : 'optin';
  const vorname = cleanText(input.vorname, 60);
  const email = String(input.email || '').trim().toLowerCase();
  const telefon = normalizePhone(input.vorwahl, input.telefon);

  if (!isValidEmail(email)) return json(422, { ok: false, error: 'invalid_email' }, cors);
  if (vorname.length < 2) return json(422, { ok: false, error: 'invalid_name' }, cors);

  /* ---------- Feldwerte ---------- */
  const utms = (input.utms && typeof input.utms === 'object') ? input.utms : {};
  const values = {
    variant: cleanText(input.variant, 40),
    utm_source: cleanText(utms.utm_source, 100),
    utm_medium: cleanText(utms.utm_medium, 100),
    utm_campaign: cleanText(utms.utm_campaign, 100),
  };

  /* Umfrage-Antworten: Klartext in die Felder (lesbar im Kontakt),
     die Codes weiter unten in Tags (segmentierbar). */
  const answers = (input.answers && typeof input.answers === 'object') ? input.answers : {};
  for (const [key, answer] of Object.entries(answers)) {
    if (!answer || !Array.isArray(answer.labels)) continue;
    const labels = answer.labels.map((l) => cleanText(l, 500)).filter(Boolean);
    if (labels.length) values[key] = labels.join(', ');
  }

  /* ---------- Tags ---------- */
  const tagNames = [...(formType === 'quiz' ? config.tagsQuiz : config.tagsOptin)];

  if (formType === 'quiz' && config.quizAnswerTags) {
    for (const [key, answer] of Object.entries(answers)) {
      if (!QUIZ_TAG_FIELDS.includes(key)) continue;
      if (!answer || !Array.isArray(answer.values)) continue;
      for (const value of answer.values) {
        const slug = slugify(String(value));
        if (!slug || slug.length > 40) continue;   /* Freitext ergibt keine Tags */
        tagNames.push(`${config.quizTagPrefix}${slugify(key)}-${slug}`);
      }
    }
  }

  /* ---------- ActiveCampaign ---------- */
  try {
    const contactId = await syncContact(config, { vorname, email, telefon, values });

    if (config.listId) await subscribe(config, contactId);
    for (const tagName of [...new Set(tagNames)]) {
      await tagContact(config, contactId, tagName);
    }

    return json(200, { ok: true, contact: contactId }, cors);
  } catch (error) {
    console.error('[activecampaign]', formType, email, error?.message || error);
    /* 502 = "AC hakt", das Frontend darf es später erneut versuchen. */
    return json(502, { ok: false, error: 'upstream_failed' }, cors);
  }
}

/* ============================================================
   ActiveCampaign-Aufrufe
   ============================================================ */

/** Legt den Kontakt an oder aktualisiert ihn (Schlüssel: E-Mail). */
async function syncContact(config, { vorname, email, telefon, values }) {
  const contact = { email, firstName: vorname };
  if (telefon) contact.phone = telefon;

  const fieldValues = [];
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    const fieldId = await resolveFieldId(config, key);
    if (fieldId) fieldValues.push({ field: fieldId, value: String(value) });
  }
  if (fieldValues.length) contact.fieldValues = fieldValues;

  const res = await acRequest(config, 'POST', '/api/3/contact/sync', { contact });
  const id = res?.contact?.id;
  if (!id) throw new Error('contact/sync ohne ID');
  return String(id);
}

/** Setzt den Kontakt auf die konfigurierte Liste. */
function subscribe(config, contactId) {
  return acRequest(config, 'POST', '/api/3/contactLists', {
    contactList: { list: Number(config.listId), contact: Number(contactId), status: config.listStatus },
  });
}

/** Hängt einen Tag an den Kontakt (legt ihn bei Bedarf an). */
async function tagContact(config, contactId, tagName) {
  const tagId = await resolveTagId(config, tagName);
  if (!tagId) return;
  try {
    await acRequest(config, 'POST', '/api/3/contactTags', {
      contactTag: { contact: String(contactId), tag: String(tagId) },
    });
  } catch (error) {
    if (!error.duplicate) throw error;   /* schon getaggt = erledigt */
  }
}

/** Tag-Name → ID, mit Anlegen und Zwischenspeicher. */
async function resolveTagId(config, tagName) {
  const key = `tag:${tagName}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const found = await findTag(config, tagName);
  if (found) {
    cacheSet(key, found);
    return found;
  }
  if (!config.autoCreateTags) return null;

  try {
    const created = await acRequest(config, 'POST', '/api/3/tags', {
      tag: { tag: tagName, tagType: 'contact', description: 'Landing Page' },
    });
    const id = created?.tag?.id;
    if (id) {
      cacheSet(key, String(id));
      return String(id);
    }
  } catch (error) {
    if (!error.duplicate) throw error;
    /* Parallele Anmeldung war schneller – einmal neu suchen. */
    return await findTag(config, tagName);
  }
  return null;
}

async function findTag(config, tagName) {
  const res = await acRequest(config, 'GET', `/api/3/tags?limit=100&search=${encodeURIComponent(tagName)}`);
  const hit = (res?.tags || []).find((t) => String(t.tag).toLowerCase() === tagName.toLowerCase());
  return hit ? String(hit.id) : null;
}

/**
 * Formular-Schlüssel → AC-Feld-ID. Gematcht wird gegen das
 * Personalisierungs-Tag (%AF_STAND%) oder den Feld-Titel.
 */
async function resolveFieldId(config, key) {
  const wanted = (FIELD_MAP[key] || '').replace(/[%\s]/g, '').toUpperCase();
  if (!wanted) return null;

  let map = cacheGet('fields');
  if (!map) {
    map = {};
    const res = await acRequest(config, 'GET', '/api/3/fields?limit=100');
    for (const field of res?.fields || []) {
      const perstag = String(field.perstag || '').replace(/[%\s]/g, '').toUpperCase();
      const title = String(field.title || '').trim().toUpperCase();
      if (perstag) map[perstag] = String(field.id);
      if (title && !map[title]) map[title] = String(field.id);
    }
    cacheSet('fields', map);
  }
  if (map[wanted]) return map[wanted];
  if (!config.autoCreateFields) return null;

  const created = await acRequest(config, 'POST', '/api/3/fields', {
    field: {
      type: 'text',
      title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      perstag: wanted,
      descript: 'Automatisch angelegt von der Webinar-Landingpage',
      visible: 1,
    },
  });
  const id = created?.field?.id ?? created?.fields?.[0]?.id;
  if (!id) return null;

  /* relid 0 = für alle Listen sichtbar. Ohne das taucht das Feld
     zwar in AC auf, aber nicht im Kontakt. */
  try {
    await acRequest(config, 'POST', '/api/3/fieldRels', {
      fieldRel: { field: String(id), relid: 0 },
    });
  } catch { /* bereits zugeordnet */ }

  map[wanted] = String(id);
  cacheSet('fields', map);
  return String(id);
}

/** Ein HTTP-Aufruf gegen die AC-API v3. */
async function acRequest(config, method, path, body) {
  const res = await fetch(config.apiUrl.replace(/\/$/, '') + path, {
    method,
    headers: {
      'Api-Token': config.apiKey,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* AC antwortet im Fehlerfall auch mal HTML */ }

  if (res.status === 422 && isDuplicateError(data)) {
    const error = new Error('duplicate');
    error.duplicate = true;
    throw error;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  return data;
}

/** AC meldet "gibt es schon" als 422 mit Duplicate-Hinweis. */
function isDuplicateError(data) {
  return (data?.errors || []).some((e) => {
    const code = String(e.code || '').toLowerCase();
    const title = String(e.title || '').toLowerCase();
    return code.includes('duplicate') || title.includes('duplicate') || title.includes('already exists');
  });
}

/* ============================================================
   Kleinkram
   ============================================================ */

function readConfig(env) {
  const list = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    apiUrl: env.AC_API_URL || '',
    apiKey: env.AC_API_KEY || '',
    listId: env.AC_LIST_ID || '',
    listStatus: Number(env.AC_LIST_STATUS || 1),
    tagsOptin: list(env.AC_TAGS_OPTIN || 'webinar-anmeldung'),
    tagsQuiz: list(env.AC_TAGS_QUIZ || 'umfrage-abgeschlossen'),
    quizAnswerTags: env.AC_QUIZ_ANSWER_TAGS !== '0',
    quizTagPrefix: env.AC_QUIZ_TAG_PREFIX || 'umfrage-',
    autoCreateTags: env.AC_AUTO_CREATE_TAGS !== '0',
    autoCreateFields: env.AC_AUTO_CREATE_FIELDS !== '0',
    allowedOrigins: list(env.AC_ALLOWED_ORIGINS),
  };
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

/** Steuerzeichen raus, Whitespace normalisieren, Laenge begrenzen. */
function cleanText(value, max) {
  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

/** Vorwahl + nationale Nummer → E.164 (+4915123456789). */
function normalizePhone(vorwahl, telefon) {
  const country = String(vorwahl || '').replace(/\D/g, '');
  let national = String(telefon || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!national) return '';
  return country ? `+${country}${national}` : `+${national}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.t > CACHE_TTL) return null;
  return entry.v;
}

function cacheSet(key, value) {
  cache.set(key, { v: value, t: Date.now() });
}
