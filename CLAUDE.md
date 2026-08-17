# Alexandra Feuerer – Webinar Landing Pages

Projekt für Webinar-Landing-Pages (Optin-Seiten inkl. A/B-Varianten, Danke-Seiten).
Gehostet auf **webinar.alexandra-feuerer.de**. Hauptseite: https://www.alexandra-feuerer.de

## Ziele
- Maximale Conversion (Webinar-Anmeldungen)
- Vollständig trackbar (GTM/dataLayer, UTM-Persistenz, A/B-Varianten-Kennung)
- Auffälliges, hochwertiges Design – "raus aus der Vergleichbarkeit", keine 0815-Optik
- Statische Seiten ohne Framework/Build-Step

## Struktur
```
index.html            → Optin-Seite, Variante A (Control)
b/index.html          → Optin-Variante B (bei Bedarf, gleiche Konvention für c/, d/ …)
danke/index.html      → Danke-Seite (Redirect-Ziel nach Anmeldung)
danke/workshop.ics    → Kalender-Datei für Apple/Outlook (Termin bei Änderung mitpflegen!)
danke/umfrage/        → Quiz-Funnel zur Lead-Qualifizierung (7 Schritte)
danke/geschenk/       → Danke-Seite nach der Umfrage, führt zur Terminbuchung
termin/index.html     → Terminbuchung für den Live-Pitch (Link geht im Webinar-Raum raus)
404.html              → Fehlerseite (muss serverseitig als ErrorDocument gesetzt werden)
assets/css/main.css   → Design-Tokens + alle Styles
assets/js/main.js     → Tracking, Countdown, Popup, Formular-Validierung
assets/fonts/         → La Luxes Serif Pro (Light/Regular/Medium, OTF)
assets/img/           → Optimierte, umbenannte Bilder
Alexandra Feurer bilder/ → Quell-Bilder (Original, nicht direkt verlinken)
```

## Branding
- **Navy** `#344258` / `#273349`, **Gold** `#bfa14a` / `#a3873a`, Champagner `#cdba99`–`#f9e2b5`, Creme `#fdfbf7`
- **Fonts:** La Luxes Serif Pro (Headlines/CTA-Label, Gewichte 300–500, Original-Font der
  Hauptseite, von deren Webflow-CDN geladen) + Montserrat (Text, 400/500/600).
- **Keine fetten Schnitte** – max. Semibold 600, Headlines Regular/Medium. Wirkt hochwertiger.
- Logo: `assets/img/logo-blau.svg` (rundes Monogramm), Favicon: `assets/img/favicon.png`
- Schreibweise: **Alexandra Feuerer** (wie Domain), nicht "Feurer"/"Feurerer".
- Alle Tokens als CSS-Variablen in `main.css` unter `:root`.

## Design-Elemente Hero (Referenz für weitere Seiten)
- Karo-Hintergrund (feines Grid, per Maske auslaufend) + warme Gold-Radials
- Freisteller `assets/img/alexandra-cutout.png` (per macOS-Vision aus `11 (6).png`
  freigestellt; Quellbild nur 440×660 – bei Ersatz höher aufgelöstes Bild verwenden)
- Goldener SVG-Börsen-Chart hinter dem Freisteller
- CTA-Design: Navy-Gradient, goldene gestrichelte "Ziernaht", Serif-Label in Champagner,
  Gold-Slashes, automatischer Glanz-Sweep alle ~4,5 s
- Animationen: gestaffelte Entrance (`data-reveal="1..7"`), Gold-Schimmer auf H1-Akzent,
  Partikel + wandernder Glow, schwebende Badge-Karte. Alles über
  `prefers-reduced-motion` deaktivierbar.
- Countdown (`data-countdown="ISO-Datum"`) zählt bis Workshop-Start
- Termin nur **einmal** sichtbar nennen (aktuell: Meta-Chips). Nicht zusätzlich in
  Topbar/Badge wiederholen – war explizites Kundenfeedback.
- Meta-Chips: auf Desktop eine Zeile; auf Mobile werden Langtexte via `.chip__opt` gekürzt

## Anmelde-Flow
- CTA öffnet `<dialog id="signup-modal">`: Vorname, E-Mail, Telefon (Pflichtfelder)
- Telefon mit Ländervorwahl-Select (Flaggen-Emoji, 🇩🇪 +49 vorausgewählt)
- JS-Validierung in `main.js`: E-Mail-Regex, Telefon-Plausibilität (6–14 Ziffern,
  Fake-Nummern-Check), Fehlertexte via `#<feldid>-error` + `.is-invalid`
- Submit: aktuell `console.log` + Redirect auf `danke/` –
  **TODO: Anbindung E-Mail-/Webinar-Tool** (API-Call im Submit-Handler markiert)
- Sticky-CTA auf Mobile (`#sticky-cta`, ≤ 720px): fixe Leiste am unteren Rand,
  erscheint per Scroll-Listener, sobald der Hero-CTA oben rausgescrollt ist,
  und verschwindet, sobald der Footer sichtbar wird. Tracking:
  `data-track-position="sticky"`.

## Danke-Seite (`danke/`)
Zweck: Trust aufbauen und die drei Folge-Aktionen auslösen. Reihenfolge der Sektionen:
1. **Hero** (`.dhero`, nutzt `.hero`-Hintergrund): Badge „Erfolgreich angemeldet", H1,
   Spam-Ordner-Hinweis, Termin-Karte, Countdown, CTA zu `#schritte` – rechts das
   Willkommens-Video (Vimeo `1201347693`). Grid: Text + Termin links untereinander,
   Video rechts über beide Zeilen; unter 961px einspaltig, Video dann per DOM-Reihenfolge
   direkt unter der H1 (bleibt so above the fold).
2. **Trust-Band** (`.trustrow`): ProvenExpert-Siegel + 4 Fakten.
3. **Vier Schritte** (`#schritte`) – Reihenfolge ist die Prioritätsreihenfolge des
   Kunden: `kalender` → `umfrage` → `whatsapp` → `videos`. Die Videos stehen bewusst
   zuletzt (niedrigste Priorität). Der Umfrage-Schritt ist der Kernschritt und optisch
   hervorgehoben (`.step--key` + `.step__ribbon` „Wichtigster Schritt" + Geschenk-Hinweis).
   Jeder Schritt lässt sich abhaken – `setupDankeSteps` in `main.js`, Stand im
   localStorage (`af_danke_steps`), Fortschrittsbalken darüber. Elemente mit
   `data-step-action` haken den umgebenden `.step[data-step]` ab,
   `data-step-target="<id>"` überschreibt das (nutzen die Antwort-Videos und die
   finale WhatsApp-Box).
4. **Antwort-Videos** (`#antworten`, dunkel): 5 Vimeo-Videos zu den häufigsten
   Einwänden – ersetzen das FAQ-Akkordeon der Optin-Seite. Darstellung im
   **9:16-Hochformat** (`.vplayer--portrait`).
   **Achtung:** Die Quelldateien sind 1:1 (1280×1280). Die Thumbnails werden per
   `object-fit: cover` mittig auf 9:16 beschnitten – im laufenden Video bleibt das
   quadratische Bild erhalten (Vimeo setzt selbst Balken). Erst neue 9:16-Exporte
   von Alexandra machen das durchgängig.
5. **Video-Testimonials** (`#stimmen`) und **Kurz-Bewertungen** (`#bewertungen`):
   identisches Markup wie auf der Optin-Seite (Pfade mit `../`).
6. **Abschluss** (`.wacta`): helle Creme-Box mit WhatsApp-CTA (kein dunkles Band –
   Kundenfeedback), Freisteller läuft rechts unten aus der Box.

- **Video-Player:** eigenes Präfix `.vplayer__*` (16:9 im Hero, 9:16 bei den
  Antwort-Videos), Click-to-Play. `data-video-base="vplayer"` steuert, welche Klassen
  `main.js` beim Klick erzeugt; ohne das Attribut bleibt es bei `.story__*`
  (Testimonials).
- **Ton:** Wird der Player erst per JS eingehängt, startet Vimeo in mehreren Browsern
  stumm (die Autoplay-Richtlinie greift für das neue iframe). `main.js` lädt deshalb
  beim ersten Klick `player.js` nach und zieht den Ton über die Player-API nach
  (`setMuted(false)` → `setVolume(1)` → `play()`). Schlägt das fehl, läuft das Video
  weiter – nur stumm, entstummbar über die Vimeo-Steuerung.
- **Kalender:** Google- und Outlook-Deeplink im HTML (UTC-Zeiten, `20260922T180000Z`),
  Apple/Outlook-Desktop über `workshop.ics` (Europe/Berlin + drei Erinnerungen:
  Vortag, 60 Min, 10 Min). Bei Terminänderung **alle drei** Ziele anpassen.
  - Titel/Beschreibung/Ort sind in allen drei Zielen **wortgleich** – die Deeplinks
    tragen nur die URL-codierte Fassung desselben Textes. Änderungen also immer
    dreifach nachziehen, sonst sehen Google-Nutzer etwas anderes als iPhone-Nutzer.
  - Der Titel nennt bewusst das Thema (`Live-Workshop: Börse & Altersvorsorge – mit
    Alexandra Feuerer`), nicht nur „Online-Workshop" – im Kalender ist meist nur der
    Anfang sichtbar, deshalb steht das Thema vorn.
  - Die Beschreibung erklärt Inhalt, Nutzen und Vorbereitung und enthält den
    **Workshop-Raum** `https://webinar.alexandra-feuerer.de/webinarraum/` (leitet
    serverseitig auf WebinarJam weiter). Derselbe Link steht in `LOCATION` (dort ohne
    Klammern, damit die Auto-Verlinkung greift), in `URL` und in der 10-Minuten-
    Erinnerung. Der personalisierte WebinarJam-Link aus der E-Mail bleibt daneben
    gültig – die Beschreibung löst das am Ende explizit auf.
  - `workshop.ics` ist **UTF-8 ohne BOM mit CRLF**, Zeilen sind nach RFC 5545 auf
    75 Oktetts gefaltet (Folgezeile beginnt mit Space). Beim Bearbeiten nicht per
    Hand umbrechen – lieber die Datei neu erzeugen. `SEQUENCE` bei inhaltlichen
    Änderungen hochzählen, damit Clients den bereits importierten Termin aktualisieren.
- **Externe Links:** WhatsApp-Community `+49 155 60647029` (vorbefüllter Text,
  per `data-wa-sign` mit dem Vornamen unterschrieben – siehe Personalisierung).

## Umfrage-Funnel (`danke/umfrage/` → `danke/geschenk/`)
Ziel: Lead qualifizieren, Workshop inhaltlich vorbereiten und **vor** dem Workshop
möglichst viele Beratungstermine erzeugen (dort wird das Coaching verkauft).

**Quiz** (`danke/umfrage/`, `setupQuiz` in `main.js`): 7 Schritte, immer nur einer
sichtbar (`.quiz__step.is-active`).
- `data-quiz-type="single"` – eine Antwort, springt nach ~260 ms automatisch weiter.
  Das Auto-Weiter hängt am **click**- statt am change-Event: sonst hängt fest, wer über
  „Zurück" kommt und seine bereits gewählte Antwort erneut antippt.
- `data-quiz-type="multi"` – Mehrfachauswahl, mind. eine Antwort nötig.
- `data-quiz-type="text"` – offene Frage, bewusst **überspringbar** (kein Blocker).
- `data-quiz-type="contact"` – Vorname/E-Mail/Telefon, nutzt dieselben Validatoren
  wie das Optin-Popup (`isValidEmail`/`isValidPhone`, im äußeren Scope von `main.js`).
- Fragen decken ab: Ausgangslage, Altersvorsorge-Gefühl, Glaubenssätze/Einwände,
  bisherige Versuche, Ziel in 12 Monaten, Erwartung an eine Begleitung.
- Submit → `console.log` + Redirect auf `../geschenk/`.
  **TODO: Antworten ans CRM/E-Mail-Tool senden** (Webhook im Submit-Handler markiert).

**Vorbefüllung:** Kontaktdaten liegen als `sessionStorage.af_lead` (JSON) –
bewusst **nicht** in der URL, sonst stünden E-Mail und Telefon in Browser-Verlauf und
Referrer-Headern (Vimeo, WhatsApp). Nur der Vorname wandert per Parameter mit
(`data-carry-name` hängt ihn an interne Links). `?email=`/`?telefon=` werden zusätzlich
akzeptiert, falls später ein E-Mail-Tool direkt auf die Umfrage verlinkt.

**Geschenk-Seite** (`danke/geschenk/`): Bestätigung + Terminbuchung.
Das Geschenk ist der „persönliche Finanz-Fahrplan" (Wert 500 €) – bewusst **kein**
Download, sondern die kostenfreie 30-Minuten-Standortbestimmung, die Alexandra
persönlich übergibt. Verknappung über begrenzte Termine vor dem Workshop.
- Buchung über Calendly, **direkt als iframe eingebettet** (`iframe[data-calendly]`,
  Sektion `.booking` ganz oben nach dem Hero – Kundenwunsch: ein Klick weniger).
  Basis-URL steht im HTML, damit der Kalender auch ohne JS lädt; `main.js` ergänzt
  `embed_domain` (von Calendly verlangt) sowie `name`/`email` als Prefill.
  Telefon bewusst nicht – das läge bei Calendly auf einer benutzerdefinierten Frage
  (`a1`), deren Bedeutung je Event variiert.
  Darunter ein Fallback-Link (`[data-booking-link]`), falls das iframe blockiert wird.
- Ohne Calendlys `widget.js` gibt es **keine Auto-Höhe**: `.booking__frame iframe`
  hat feste 720 px (ab 760 px Viewport-Breite 1040 px). Bei Layout-Änderungen im
  Calendly-Event nachjustieren.
- **Dauer an einer Stelle ändern heißt: an allen drei ändern** – Calendly-Event,
  `.gift__title` („Das machen wir in den 30 Minuten") und `.cta__note`.
- Wording bewusst „Standortbestimmung"/„Orientierung", nicht „Anlageberatung" –
  siehe Haftungsausschluss im Footer.
- Der Aufruf hakt den Umfrage-Schritt auf der Danke-Seite automatisch ab.

## Termin-Seite (`termin/`)
Zweck: **Der Link, der live im Webinar-Raum ausgegeben wird**, wenn Alexandra pitcht.
Einziges Ziel der Seite ist die Buchung – deshalb kurzer Hero, Kalender direkt darunter,
kein zweiter CTA, der ablenkt.
- Kalender = derselbe iframe-Mechanismus wie auf `danke/geschenk/`
  (`iframe[data-calendly]` in `.booking__frame`, Fallback-Link darunter). Höhe,
  Rahmen, `.booking__head`, `.booking__scarcity` und `.booking__fallback` kommen aus
  dem gemeinsamen `.booking__*`-Block – **dort ändern heißt: beide Seiten ändern**.
- Nur für diese Seite: `.thero__*` (kompakter Hero) und `.tbook__*` (Zweispalten-Layout
  Kalender + dunkle Kontext-Box rechts, ab 1000 px einspaltig).
- Aufbau: Hero → Kalender + Kontext-Box → Trust-Band → 3 Kurz-Bewertungen →
  FAQ zum *Gespräch* (nicht zum Workshop!) → Abschluss-Box zurück zum Kalender.
- Die Kurz-Bewertungen nutzen dasselbe Markup wie `#bewertungen`, aber nur 3 Karten:
  Auf Desktop passen genau 3 in eine Slider-Ansicht → kein Überlauf → `has-overflow`
  bleibt aus und die Pfeile/Punkte sind unsichtbar. Kommt eine 4. Karte dazu,
  erscheinen die Controls.
- Kein Countdown: Wer die Seite sieht, sitzt bereits im Workshop.
- Prefill greift hier meist **nicht** (aus dem Webinar-Raum ist die sessionStorage
  leer). Wenn das Webinar-Tool personalisieren kann, funktionieren `?vorname=`/`?email=`.
- Verkaufsargumente/„Das machen wir in den 30 Minuten" sind bewusst identisch zu
  `danke/geschenk/` – bei Änderungen beide Seiten angleichen.

## Fehlerseite (`404.html`)
Zentrierte Einzelspalte auf dem Hero-Hintergrund (`<section class="hero e404">`), eigenes
CSS-Präfix `.e404__*`. Aufbau: Badge „Seite nicht gefunden" → große Serif-„404" mit
Gold-Schimmer und goldenem Kurs-Chart dahinter (kurzer Einbruch, danach wieder aufwärts)
→ H1 → Lead → Termin-Chips → CTA → Alternativ-Link → Alexandra-Signatur.
- **Alle Pfade root-relativ** (`/assets/…`, `/`, `/danke/`) – die Seite wird für beliebige
  URL-Tiefen ausgeliefert, relative Pfade würden bei `/foo/bar/` ins Leere zeigen.
- Kein Freisteller, damit die Seite in jeder Fenstergröße ohne Scrollen komplett sichtbar
  bleibt; die 404 selbst ist `aria-hidden`, für Screenreader steht der Fehler im Badge.
- CTA führt zurück in den Funnel (`/`), zusätzlich Link auf `/danke/` für bereits
  Angemeldete. Kein Verweis auf die Hauptseite (kein Traffic-Abfluss).
- **Server-Konfiguration nötig**, sonst greift die Seite nie – siehe „Caching /
  Deployment". Lokal testen mit `python3 dev-server.py`, dann eine beliebige
  falsche URL aufrufen.

## Personalisierung mit dem Vornamen
Die Optin-Seite hängt den Vornamen an die Weiterleitung (`danke/?vorname=…`) und legt
ihn zusätzlich in `sessionStorage.af_vorname` ab (falls ein Tool die Query-Parameter
verschluckt). Auf der Danke-Seite:
- `[data-name-slot]` bekommt den Namen per `textContent` (kein HTML aus der URL).
- `[data-name-if]` ist per CSS ausgeblendet und wird nur bei `html.has-name` sichtbar –
  Texte deshalb immer so bauen, dass sie **ohne** Namen ebenfalls sauber lesbar sind
  (Name ans Satzende hängen, z. B. „Deine nächsten 3 Schritte<span data-name-if>, …").
- Akzeptierte Parameter: `vorname`, `firstname`, `first_name`, `fname`, `name` – damit
  später auch ein E-Mail-Tool den Namen übergeben kann.
- `cleanName` in `main.js` verwirft Merge-Tags (`{{…}}`, `*|FNAME|*`), Ziffern, Sonder-
  zeichen und alles unter 2 / über 20 Zeichen, kürzt auf den ersten Vornamen und
  normalisiert die Groß-/Kleinschreibung (`MARIA` → `Maria`, `anna-lena` → `Anna-Lena`).
- **WhatsApp-Nachricht:** Links mit `data-wa-sign` bekommen den Vornamen als
  Unterschrift an den `text`-Parameter gehängt („… erhalten.\n\nViele Grüße, Maria").
  Der Attributwert ist der Gruß, lässt sich also pro Link ändern. Ohne bekannten
  Namen bleibt der Text unverändert – die Grußzeile entfällt dann einfach, es steht
  nie ein leerer Platzhalter in der Nachricht. Deshalb den Grundtext im HTML immer
  so schreiben, dass er **ohne** Unterschrift vollständig ist.

## Tracking-Konventionen
- `<html data-variant="optin-a" data-page-type="optin">` – jede Seite/Variante kennzeichnen.
  Die Fehlerseite läuft als `data-variant="404"` / `data-page-type="404"`, ihr CTA als
  `data-track-position="404"` – damit lassen sich tote Links im GTM auswerten.
- CTAs/Links: `data-track="cta_primary"` + `data-track-position="hero"`
- Events: `lp_page_view`, `lp_cta_click`, `lp_scroll_depth` (25/50/75/100),
  `lp_form_open`, `lp_form_close`, `lp_form_error`, `lp_form_submit`,
  `lp_video_play` (Testimonial-Videos, mit `lp_video_id`/`lp_video_name`),
  `lp_faq_open` (mit `lp_faq_id` aus `data-faq` des FAQ-Items),
  `lp_step_done` (Danke-Seite, mit `lp_step_id` + `lp_steps_done`),
  `lp_quiz_start`, `lp_quiz_step` (mit `lp_quiz_step` = Schrittnummer), `lp_quiz_submit`,
  `lp_booking_step` / `lp_booking_scheduled` (eingebetteter Calendly-Kalender)
- **Buchungen messen:** Calendly meldet den Fortschritt per `postMessage` an die
  einbettende Seite – Voraussetzung ist das von `main.js` gesetzte `embed_domain`.
  `lp_booking_scheduled` ist die eigentliche Conversion; ein `lp_cta_click` auf den
  Kalender sagt nichts darüber aus, ob am Ende ein Termin zustande kam.
- UTM-Parameter (+ fbclid/gclid) → sessionStorage `af_utms`, werden in Hidden-Fields
  (`f-variant`, `f-utms`) ans Formular gehängt
- GTM-Snippet auskommentiert im `<head>` – Container-ID eintragen und aktivieren.

## Inhaltliche Leitplanken
- Zielgruppe: Ü40, keine Vorkenntnisse, Altersvorsorge-Fokus. Ansprache: „Du".
- Keine erfundenen Zahlen/Bewertungen – belegte Fakten: Ex-Bankerin, 25 Jahre Private
  Banking, ProvenExpert-Siegel („Von Kunden empfohlen 2026", `assets/img/provenexpert.jpeg`)
- Aktueller Termin: **Dienstag, 22. September 2026, 20:00 Uhr** – bei Änderung anpassen:
  Meta-Chips, Countdown-`data-countdown`, Modal-Subline, Danke-Seite
- Footer mit Impressum/Datenschutz (Links zur Hauptseite) auf jeder Seite.

## Caching / Deployment
`main.css` und `main.js` werden mit Versions-Parameter eingebunden
(`assets/css/main.css?v=20260817`). **Nach jeder Änderung an CSS oder JS den Wert in
allen HTML-Dateien hochzählen** (Datum im Format JJJJMMTT), sonst zeigen Browser
wiederkehrender Besucher das alte Stylesheet – neue Sektionen wirken dann komplett
ungestylt, alte sehen korrekt aus.

Lokal **nicht** mit `python3 -m http.server` testen: der sendet nur `Last-Modified` ohne
`Cache-Control` (Browser cachen dann heuristisch stundenlang) und kennt keine Fehlerseite
(bei falschen URLs kommt sein Rohtext „Error code: 404" statt `404.html`).
Stattdessen `python3 dev-server.py [Port]` – setzt `Cache-Control: no-store` und liefert
`404.html` mit Status 404 aus, verhält sich also wie der Live-Server.

Fehlerseite in Produktion: `.htaccess` mit `ErrorDocument 404 /404.html` liegt im Root
(Apache). Bei nginx `error_page 404 /404.html;`, Netlify/Cloudflare Pages/Vercel/
GitHub Pages nehmen `/404.html` automatisch. Ohne diese Konfiguration greift die Seite
nie – der Server zeigt dann seine eigene Standard-Fehlerseite.

## Testen
- Screenshot-Check: Headless Chrome (`--headless=new --virtual-time-budget=6000`).
  Für Mobile-Viewports < 500px einen iframe-Harness nutzen (Chrome erzwingt
  Mindest-Fensterbreite ~500px).
- Achtung unter `--virtual-time-budget`: CSS-Transitions laufen nicht an
  (Endzustand wird nie gezeichnet – im Harness testweise `transition: none`
  setzen) und IntersectionObserver liefert nach programmatischem Scroll keine
  weiteren Callbacks. Scroll-Listener funktionieren; `scroll-behavior: smooth`
  vorher per JS auf `auto` stellen, sonst greift `scrollTo` nicht.

## Offene Punkte
- Anmelde-Mechanik (E-Mail-/Webinar-Tool) anbinden
- Weitere Sektionen: "Das lernst Du"
  (Finale CTA ist umgesetzt: `#anmelden` (`.finalcta`) nach dem FAQ – kompakte **helle**
  Creme-Box (`.finalcta__box`, abgerundet, Gold-Rand) auf Creme-Grund, kein Full-Width-Band
  und nicht dunkel (beides Kundenfeedback) – Serif-Zitat, Verknappungs-Chip „Maximal
  500 Teilnehmer", zweiter Countdown in heller Standard-Variante (Countdown-JS unterstützt
  mehrere `[data-countdown]`-Instanzen), CTA `data-track-position="final"`, Bild = derselbe
  Hero-Freisteller `assets/img/alexandra-cutout.png` (Kundenwunsch, nicht über 304px
  hochskalieren!), läuft unten + rechts randbündig aus der Box (negative Margin kaschiert
  die Schnittkanten, Box hat `overflow: hidden`); die Alternativ-Freisteller
  `assets/img/alexandra-final-cutout.webp` (Porträt sitzend, weißer Blazer, aus
  `alexandra-portrait.webp` per `VNGeneratePersonSegmentationRequest` accurate) liegt
  ungenutzt bereit, z. B. für Variante B;
  Über Alexandra ist umgesetzt: dunkle Navy-Sektion `#alexandra`, Bild `assets/img/alexandra-about.jpg`;
  FAQ ist umgesetzt: `#faq`, 5 Einwände als natives `<details name="faq">`-Akkordeon –
  neue Sektionen davor einfügen, FAQ bleibt letzte Sektion vor finaler CTA/Footer;
  Video-Testimonials umgesetzt: `#stimmen` nach "Über Alexandra", 4 Videos im
  2×2-Grid mit Vimeo-Click-to-Play, Thumbnails lokal `assets/img/testimonial-*.jpg`
  via Vimeo-oEmbed geladen;
  Zitat-Band umgesetzt: `.quoteband` zwischen Vorteilen und "Über Alexandra" –
  kompaktes Alexandra-Zitat zum „zu alt"-Einwand mit Watermark „ZU ALT?",
  Avatar `assets/img/alexandra-avatar.jpg` = Gesichts-Crop aus `alexandra-portrait.webp`;
  Kurz-Bewertungen umgesetzt: `#bewertungen` (`.reviews`) zwischen `#stimmen` und FAQ –
  kompaktes dunkles Trust-Band mit hellen Creme-Karten (Kundenfeedback: nicht dunkel
  auf dunkel), 5 Karten mit je 5 Sternen, Zitat-Zeichen oben rechts
  (CSS `::after`), runde Avatare
  `assets/img/review-*.jpg` (96×96, quadratisch beschnitten aus „Alexandra Feurer bilder");
  auf Desktop ≥ 601px Scroll-Snap-Slider (`.reviews__slider`, 2 bzw. ab 900px 3 Karten
  pro Ansicht, Pfeile + Punkte unter dem Track, JS `setupReviewsSlider` in `main.js`);
  der Track braucht explizit `overflow-y: hidden` (bei `overflow-x: auto` rechnet
  `overflow-y` sonst auf `auto` – der Slider ließ sich vertikal verwischen) und die
  Karten darin ein Reveal **ohne** `translateY` (sonst ragen sie unten aus dem
  Scroll-Container und werden beschnitten);
  auf Mobile < 600px Sticky-Karten-Stapel wie Vorteile-Sektion – gemeinsame JS-Mechanik
  `setupCardStack` in `main.js`; Achtung: Sektion braucht `overflow: clip` statt
  `hidden`, sonst wird die Sektion zum Scroll-Container und `position: sticky`
  des Karten-Stapels greift nicht)
- Optin-Variante B für A/B-Test
- Höher aufgelöstes Hero-Freisteller-Bild vom Kunden anfragen (aktuell 440×660)
- Umfrage-Antworten ans CRM anbinden (Submit-Handler in `setupQuiz`).
- Impressum/Datenschutz verlinken bewusst weiter auf `www.alexandra-feuerer.de`,
  weil es diese Seiten hier nicht gibt. Logo und alle sonstigen Verweise auf die
  Hauptseite zeigen dagegen auf `/` (Kundenwunsch: kein Traffic-Abfluss aus dem Funnel).
- Rechtliche Prüfung des Wordings auf `danke/geschenk/`: „kostenfreie Standort-
  bestimmung" statt „Beratung" gewählt, weil der Footer-Disclaimer Anlageberatung
  ausschließt. Vom Kunden freigeben lassen.
- Danke-Seite: Der alte Kalender-Link (`addcal.co`) ist durch eigene Deeplinks +
  `workshop.ics` ersetzt, damit der Termin nicht extern gepflegt werden muss.
- **`/webinarraum/` muss serverseitig angelegt werden** (Redirect auf WebinarJam).
  Die Kalender-Einladung verlinkt bereits darauf – solange die Weiterleitung fehlt,
  laufen alle Teilnehmer zum Start in einen 404. Vorteil der Zwischen-URL: Wechselt
  das Webinar-Tool oder der Raum, muss kein bereits eingetragener Kalendertermin
  angefasst werden.
