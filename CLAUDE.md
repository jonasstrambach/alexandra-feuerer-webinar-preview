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

## Tracking-Konventionen
- `<html data-variant="optin-a" data-page-type="optin">` – jede Seite/Variante kennzeichnen.
- CTAs/Links: `data-track="cta_primary"` + `data-track-position="hero"`
- Events: `lp_page_view`, `lp_cta_click`, `lp_scroll_depth` (25/50/75/100),
  `lp_form_open`, `lp_form_close`, `lp_form_error`, `lp_form_submit`,
  `lp_video_play` (Testimonial-Videos, mit `lp_video_id`/`lp_video_name`),
  `lp_faq_open` (mit `lp_faq_id` aus `data-faq` des FAQ-Items)
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
  auf Mobile < 600px Sticky-Karten-Stapel wie Vorteile-Sektion – gemeinsame JS-Mechanik
  `setupCardStack` in `main.js`; Achtung: Sektion braucht `overflow: clip` statt
  `hidden`, sonst wird die Sektion zum Scroll-Container und `position: sticky`
  des Karten-Stapels greift nicht)
- Optin-Variante B für A/B-Test
- Höher aufgelöstes Hero-Freisteller-Bild vom Kunden anfragen (aktuell 440×660)
