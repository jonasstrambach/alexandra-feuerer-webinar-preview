# ActiveCampaign-Anbindung

Die Landing Pages schicken Anmeldungen und Umfrage-Antworten an einen kleinen
Proxy auf dem eigenen Server. Der Proxy legt den Kontakt in ActiveCampaign an,
setzt ihn auf die Liste und vergibt die Tags.

**Warum ein Proxy und kein direkter API-Aufruf aus dem Browser?**
Der ActiveCampaign-API-Key hat Vollzugriff auf die komplette Kontaktdatenbank –
lesen, exportieren, löschen. Alles, was in `assets/js/main.js` steht, kann jeder
Besucher im Browser mitlesen. Der Key darf deshalb ausschließlich auf dem Server
liegen.

---

## Was in ActiveCampaign ankommt

| Formular | Kontakt | Liste | Tags | Felder |
|---|---|---|---|---|
| Optin-Popup (`index.html`) | Vorname, E-Mail, Telefon | ja | `webinar-anmeldung`, `webinar-2026-09-22` | Variante, UTM-Quelle/-Medium/-Kampagne |
| Umfrage (`danke/umfrage/`) | ergänzt denselben Kontakt | ja | `umfrage-abgeschlossen` + ein Tag je Antwort | alle 7 Antworten im Klartext |

Der Kontakt wird über `contact/sync` angelegt **oder aktualisiert** – Schlüssel
ist die E-Mail-Adresse. Wer die Umfrage ausfüllt, erzeugt also keinen zweiten
Kontakt, sondern ergänzt den vorhandenen.

Antworten landen doppelt in AC, und das mit Absicht:

* als **Klartext im Feld** (`Ganz am Anfang – ich habe noch kein Depot`),
  damit Alexandra den Kontakt vor dem Gespräch überfliegen kann
* als **Tag** (`umfrage-stand-anfang`), weil sich damit segmentieren und
  automatisieren lässt – Felder eignen sich dafür schlecht

Telefonnummern werden serverseitig auf E.164 normalisiert
(`+49` + `0151 23456789` → `+4915123456789`). Die führende Null fällt weg.

---

## Variante A – Apache-Webspace mit PHP

1. Ordner `api/` mit auf den Server laden (`activecampaign.php`, `.htaccess`).
2. `config.sample.php` nach `config.php` kopieren und ausfüllen:
   * `api_url` und `api_key` stehen in AC unter **Einstellungen → Entwickler**
   * `list_id` ist die Zahl am Ende der Listen-URL in AC
3. Prüfen, dass `https://webinar.alexandra-feuerer.de/api/config.php` im Browser
   **403 oder 404** liefert – nicht den Inhalt. Sonst greift die `.htaccess` nicht
   (bei manchen Hostern muss `AllowOverride All` gesetzt sein).
4. Fertig. `main.js` zeigt standardmäßig auf `/api/activecampaign.php`.

Benötigt PHP 7.4+ mit cURL (Standard bei allen gängigen Hostern; ohne cURL
greift automatisch ein Fallback über `file_get_contents`).

---

## Variante B – Netlify / Vercel / Cloudflare Pages

`activecampaign.mjs` läuft unverändert auf allen dreien, nur der Ablageort
unterscheidet sich:

| Plattform | Pfad | Endpunkt |
|---|---|---|
| Netlify | `netlify/functions/activecampaign.mjs` | `/.netlify/functions/activecampaign` |
| Vercel | `api/activecampaign.mjs` | `/api/activecampaign` |
| Cloudflare Pages | `functions/api/activecampaign.mjs` | `/api/activecampaign` |

Danach den Endpunkt im Frontend setzen – entweder in `assets/js/main.js`
(`CRM_ENDPOINT`) oder pro Seite im `<html>`-Tag:

```html
<html lang="de" data-variant="optin-a" data-page-type="optin"
      data-crm-endpoint="/.netlify/functions/activecampaign">
```

Environment-Variablen:

| Variable | Pflicht | Beispiel |
|---|---|---|
| `AC_API_URL` | ja | `https://alexandrafeuerer.api-us1.com` |
| `AC_API_KEY` | ja | – |
| `AC_LIST_ID` | ja | `3` |
| `AC_LIST_STATUS` | – | `1` (angemeldet) |
| `AC_TAGS_OPTIN` | – | `webinar-anmeldung,webinar-2026-09-22` |
| `AC_TAGS_QUIZ` | – | `umfrage-abgeschlossen` |
| `AC_QUIZ_ANSWER_TAGS` | – | `0` schaltet die Antwort-Tags ab |
| `AC_ALLOWED_ORIGINS` | – | `https://webinar.alexandra-feuerer.de` |
| `AC_AUTO_CREATE_TAGS` | – | `0` = Tags nicht selbst anlegen |
| `AC_AUTO_CREATE_FIELDS` | – | `0` = Felder nicht selbst anlegen |

Die Feld-Zuordnung steht als `FIELD_MAP` oben in der `.mjs` und muss mit
`fields` in `config.sample.php` übereinstimmen.

---

## Benutzerdefinierte Felder

Standardmäßig legt der Proxy fehlende Felder selbst an (Typ: Text, sichtbar für
alle Listen). Wer das lieber von Hand macht, setzt `auto_create_fields` auf
`false` und legt in AC unter **Kontakte → Felder** an:

| Personalisierung | Inhalt |
|---|---|
| `%AF_VARIANTE%` | A/B-Variante der Landingpage |
| `%AF_UTM_SOURCE%` / `%AF_UTM_MEDIUM%` / `%AF_UTM_CAMPAIGN%` | Kampagnen-Zuordnung |
| `%AF_STAND%` | Wo stehst Du gerade? |
| `%AF_VORSORGE%` | Gefühl zur Altersvorsorge |
| `%AF_BLOCKER%` | Glaubenssätze / Einwände |
| `%AF_VERSUCHT%` | Bisherige Versuche |
| `%AF_ZIEL%` | Ziel in 12 Monaten (Freitext) |
| `%AF_WICHTIG%` | Erwartung an eine Begleitung |

Nicht gefundene Felder werden übersprungen – der Kontakt kommt trotzdem an.

---

## Double-Opt-in

Der Proxy setzt den Kontakt mit `status: 1` (angemeldet) auf die Liste. Ob
ActiveCampaign zusätzlich eine Bestätigungsmail verschickt, hängt an der Liste
bzw. am Formular in AC, nicht an diesem Code.

Für die Praxis heißt das:

* **Webinar-Mails** (Zugangslink, Erinnerungen) sind Erfüllung der Anmeldung.
  Ein Double-Opt-in davor würde bedeuten, dass ein Teil der Angemeldeten den
  Zugangslink nie bekommt.
* **Werbliche Mails darüber hinaus** brauchen in Deutschland nachweisbare
  Einwilligung. Der übliche Weg: Webinar-Liste ohne DOI, und wer weiter im
  Verteiler bleiben soll, bestätigt separat.

Das ist eine rechtliche Entscheidung, keine technische – bitte mit Alexandra
bzw. ihrer Rechtsberatung klären. Umstellen lässt es sich jederzeit in AC.

---

## Testen

```bash
curl -i -X POST https://webinar.alexandra-feuerer.de/api/activecampaign.php \
  -H 'Content-Type: application/json' \
  -d '{"form":"optin","vorname":"Test","email":"test+ac@example.com",
       "vorwahl":"+49","telefon":"0151 23456789","variant":"optin-a",
       "utms":{"utm_source":"curl"}}'
```

Erwartet: `200 {"ok":true,"contact":"123"}`, danach der Kontakt in AC mit Liste
und Tags.

Antwortcodes:

| Code | Bedeutung | Reaktion des Frontends |
|---|---|---|
| 200 | verarbeitet | Weiterleitung |
| 422 | Eingabe unbrauchbar | Weiterleitung, kein erneuter Versuch |
| 429 | zu viele Anfragen von der IP | Wiedervorlage |
| 500 | `config.php` fehlt oder Env-Vars nicht gesetzt | Wiedervorlage |
| 502 | AC nicht erreichbar / API-Fehler | Wiedervorlage |

Bei der PHP-Variante steht der Klartext-Fehler in `api/ac-errors.log`,
bei der Serverless-Variante im Function-Log der Plattform.

---

## Was passiert, wenn ActiveCampaign ausfällt?

Die Anmeldung geht nicht verloren:

1. `main.js` wartet höchstens 2,5 Sekunden auf den Proxy und leitet dann
   weiter – der Nutzer merkt von einer langsamen API nichts.
2. Schlägt die Übertragung fehl, landet sie im `localStorage`
   (`af_crm_queue`, max. 10 Einträge, 7 Tage haltbar).
3. Beim nächsten Seitenaufruf wird sie automatisch nachgereicht. Da direkt nach
   dem Optin die Danke-Seite lädt, passiert das meist binnen Sekunden.
4. Ein `lp_crm_error`-Event im dataLayer macht Ausfälle im GTM sichtbar –
   sinnvoll als Alarm, wenn die Zahl plötzlich steigt.

Doppelte Übertragungen sind unkritisch: `contact/sync` nutzt die E-Mail als
Schlüssel, Listen- und Tag-Zuweisung sind ebenfalls idempotent.
