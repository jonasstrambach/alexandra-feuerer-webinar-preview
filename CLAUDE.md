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
api/                  → ActiveCampaign-Proxy (PHP + Serverless), siehe api/README.md
assets/css/main.css   → Design-Tokens + alle Styles
assets/js/main.js     → Tracking, Countdown, Popup, Formular-Validierung, CRM-Übergabe
assets/fonts/         → La Luxes Serif Pro (Light/Regular/Medium, OTF)
assets/img/           → Optimierte, umbenannte Bilder
assets/img/og-*.jpg   → Share-Bilder für Linkvorschauen (aus tools/ erzeugt)
tools/og-image.html   → Quelle der Share-Bilder, tools/render-og.sh rendert sie
                        (wird nicht ausgeliefert, siehe .gitlab-ci.yml)
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
- CTA öffnet `<dialog id="signup-modal">`: Vorname und E-Mail sind Pflicht,
  **Telefon ist optional** (Kundenwunsch – weniger Hürde vor der Anmeldung).
  Wird das Feld leer gelassen, geht der Kontakt ohne Telefonnummer an
  ActiveCampaign; steht etwas drin, muss es plausibel sein (sonst wandert ein
  Zahlendreher unbemerkt ins CRM). Der Kontakt-Schritt der **Umfrage** verlangt
  die Nummer weiterhin – dort ist das Commitment höher.
- Telefon mit Ländervorwahl-Select (Flaggen-Emoji, 🇩🇪 +49 vorausgewählt)
- **Keine sichtbaren Labels** (Kundenwunsch: minimaler): Die Beschriftung steht im
  Placeholder (`Dein Vorname*`, `Deine E-Mail-Adresse*`,
  `Deine Telefonnummer (optional)`),
  das `<label>` bleibt für Screenreader/Autofill im DOM und wird per CSS geclippt
  (`.form label, .quiz__fields label`). Gilt genauso für den Kontakt-Schritt der
  Umfrage. **Neues Feld heißt: Placeholder setzen** – sonst steht dort eine leere
  Box. Der `*` ersetzt die Pflichtfeld-Kennzeichnung des Labels.
- JS-Validierung in `main.js`: E-Mail-Regex, Telefon-Plausibilität (6–14 Ziffern,
  Fake-Nummern-Check), Fehlertexte via `#<feldid>-error` + `.is-invalid`.
  Beim Telefon gilt im Optin `leer ODER plausibel` – die leere Eingabe ist
  ausdrücklich erlaubt und wird serverseitig zu `''` (kein `phone`-Feld in AC,
  insbesondere kein nacktes `+49`).
- Submit: Übergabe an ActiveCampaign (siehe unten), danach Redirect auf `danke/`.
  Der Redirect erfolgt **immer** – auch wenn das CRM nicht antwortet.
  Ein verstecktes Honeypot-Feld (`name="website"`, Klasse `.hp`) fängt Bots ab.
- Sticky-CTA auf Mobile (`#sticky-cta`, ≤ 720px): fixe Leiste am unteren Rand,
  erscheint per Scroll-Listener, sobald der Hero-CTA oben rausgescrollt ist,
  und verschwindet, sobald der Footer sichtbar wird. Tracking:
  `data-track-position="sticky"`.

## Danke-Seite (`danke/`)
Zweck: Trust aufbauen und **die Umfrage auslösen**. Seit 18.08.2026 gilt: Die Seite hat
nur ein Ziel – die 6 Fragen. Alles, was davon ablenkt, ist raus (Kundenfeedback:
„zu viele CTAs"). Der Kalender-Eintrag bleibt als zweiter, kleinerer Schritt stehen,
die WhatsApp-Community ist komplett auf `danke/geschenk/` gewandert (siehe dort).
Reihenfolge der Sektionen:
1. **Hero** (`.dhero`, nutzt `.hero`-Hintergrund): Badge „Erfolgreich angemeldet", H1,
   Spam-Ordner-Hinweis, Termin-Karte, Countdown, CTA zu `#schritte` – rechts das
   Willkommens-Video (Vimeo `1201347693`, startet stumm von selbst, siehe „Autoplay
   im Hero"). Grid: Text + Termin links untereinander,
   Video rechts über beide Zeilen; unter 961px einspaltig, Video dann per DOM-Reihenfolge
   direkt unter der H1 (bleibt so above the fold).
2. **Trust-Band** (`.trustrow`): ProvenExpert-Siegel + **3** Fakten
   (Bewertung, Kundinnen, Jahre). Bewusst nur drei, damit sie auch auf Mobile
   in eine Zeile passen – ein vierter Fakt bricht die Reihe um.
   Die Bewertung steht als „5 Sterne auf Google/ProvenExpert" (Kundenwunsch,
   statt der exakten 4,98/5).
3. **Zwei Schritte** (`#schritte`) – Reihenfolge: `umfrage` → `kalender`.
   Die Umfrage steht bewusst **vorn** und ist optisch hervorgehoben (`.step--key`
   + `.step__ribbon` „Wichtigster Schritt" + Geschenk-Hinweis) – sie ist das
   Commitment, um das es auf dieser Seite geht. Der Kalender-Schritt läuft ohne
   `.cta` (nur `.btn-cal`), damit er nicht dagegen antritt.
   Bis 18.08.2026 waren es drei Schritte: `kalender` stand vorn, `whatsapp`
   dahinter – beides auf Kundenwunsch geändert. Ein vierter Schritt
   „Antwort-Videos ansehen" fiel schon vorher weg; die Videos bleiben als
   Sektion `#antworten`, haken aber keinen Schritt mehr ab.
   Jeder Schritt lässt sich abhaken – `setupDankeSteps` in `main.js`, Stand im
   localStorage (`af_danke_steps`), Fortschrittsbalken darüber. Elemente mit
   `data-step-action` haken den umgebenden `.step[data-step]` ab,
   `data-step-target="<id>"` überschreibt das (nutzt die Abschluss-Box).
   Schritt-IDs aus einem alten localStorage-Stand, die es nicht mehr gibt, werden
   beim Laden verworfen – sonst stünde dort „3 von 2 erledigt".
4. **Antwort-Videos** (`#antworten`, dunkel): 5 Vimeo-Videos zu den häufigsten
   Einwänden – ersetzen das FAQ-Akkordeon der Optin-Seite. Darstellung im
   **9:16-Hochformat** (`.vplayer--portrait`).
   **Achtung:** Die Quelldateien sind 1:1 (1280×1280). Die Thumbnails werden per
   `object-fit: cover` mittig auf 9:16 beschnitten – im laufenden Video bleibt das
   quadratische Bild erhalten (Vimeo setzt selbst Balken). Erst neue 9:16-Exporte
   von Alexandra machen das durchgängig.
5. **Video-Testimonials** (`#stimmen`) und **Kurz-Bewertungen** (`#bewertungen`):
   identisches Markup wie auf der Optin-Seite (Pfade mit `../`).
6. **Abschluss** (`.wacta`, `#fragen`): helle Creme-Box (kein dunkles Band –
   Kundenfeedback), Freisteller läuft rechts unten aus der Box. Inhalt ist
   **derselbe CTA wie in Schritt 1** – die Umfrage, mit dem 500-€-Geschenk als
   Chip. Hier stand bis 18.08.2026 die WhatsApp-Community; wer hier landet, soll
   genau eine Sache tun können.

- **Konfetti beim Laden:** `setupConfetti` in `main.js` hängt ein fixes Canvas
  (`.confetti`, z-index 70, `pointer-events: none`) über die Seite und lässt
  goldene Schnipsel herunterrieseln – rund 5 s, danach entfernt es sich selbst.
  Ausgelöst wird es allein durch das Attribut `data-confetti` auf der
  Hero-Sektion; ohne das Attribut passiert auf einer Seite nichts (so lässt es
  sich später z. B. auf `danke/geschenk/` nachziehen). Palette = Gold/Champagner
  aus den Tokens, jedes Teilchen hat eine helle Vorder- und eine dunkle
  Rückseite, die beim Taumeln umschlägt. Menge hängt an der Viewport-Breite
  (70 / 100 / 130). Bei `prefers-reduced-motion` startet es gar nicht.
  Es läuft bei **jedem** Aufruf der Seite – auch bei der Rückkehr aus Kalender
  oder WhatsApp. Soll es nur einmal pro Session feuern, braucht es eine Marke
  im `sessionStorage`.
- **Video-Player:** eigenes Präfix `.vplayer__*` (16:9 im Hero, 9:16 bei den
  Antwort-Videos), Click-to-Play. `data-video-base="vplayer"` steuert, welche Klassen
  `main.js` beim Klick erzeugt; ohne das Attribut bleibt es bei `.story__*`
  (Testimonials).
- **Ton:** Wird der Player erst per JS eingehängt, startet Vimeo in mehreren Browsern
  stumm (die Autoplay-Richtlinie greift für das neue iframe). `main.js` lädt deshalb
  beim ersten Klick `player.js` nach und zieht den Ton über die Player-API nach
  (`setMuted(false)` → `setVolume(1)` → `play()`). Schlägt das fehl, läuft das Video
  weiter – nur stumm, entstummbar über die Vimeo-Steuerung.
- **Autoplay im Hero:** Das Willkommens-Video trägt `data-video-autoplay` und startet
  ohne Klick – **zwingend stumm**, weil alle Browser Ton ohne Nutzerinteraktion
  verbieten. Darüber legt `main.js` die Schaltfläche `.vplayer__unmute`, die die
  ganze Videofläche abdeckt: ein Tipp irgendwo schaltet den Ton ein, spult bei
  `currentTime < 15 s` an den Anfang zurück und gibt danach die Vimeo-Steuerung frei.
  Blockt der Browser sogar das stumme Autoplay (erkennbar an der Absage von `play()`,
  **nicht** an einem ausbleibenden `play`-Ereignis – das wäre nur Puffern), heißt die
  Beschriftung „Video starten". Kein Autoplay im Datensparmodus
  (`navigator.connection.saveData`) und ohne JS – dort bleibt es beim Thumbnail.
  Das Attribut lässt sich auf jedes `[data-video-id]` setzen; die Antwort-Videos
  haben es bewusst **nicht** (fünf gleichzeitig startende Videos wären Chaos).
  Preis des Autoplays: Vimeo wird jetzt **beim Seitenaufruf** kontaktiert, nicht
  erst nach dem Klick (`dnt=1` bleibt gesetzt). Wer das nicht will, entfernt das
  eine Attribut in `danke/index.html`.
- **Kalender:** Google- und Outlook-Deeplink im HTML (UTC-Zeiten, `20260922T180000Z`),
  Apple/Outlook-Desktop über `workshop.ics` (Europe/Berlin + drei Erinnerungen:
  Vortag, 60 Min, 10 Min). Bei Terminänderung **alle drei** Ziele anpassen.
  Dieselben drei Links stehen ein zweites Mal auf `danke/geschenk/` (Block
  `.calcta`) – bei Änderungen **beide Seiten** nachziehen.
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
- **Kein WhatsApp-Link mehr auf dieser Seite** – weder als Schritt noch im
  Abschluss. Er steht jetzt ausschließlich auf `danke/geschenk/`. Wieder
  einbauen nur nach Rücksprache: Es war explizites Kundenfeedback, dass hier
  außer der Umfrage nichts konkurriert.

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
- Submit → Antworten an ActiveCampaign (siehe unten), danach Redirect auf `../geschenk/`.
  `collectAnswers` in `main.js` liest zu jeder Antwort **Wert und sichtbaren Text** aus
  (`.qopt__box`). Der Wert wird zum Tag, der Text landet als Klartext im AC-Feld –
  deshalb bei neuen Antwortoptionen die `.qopt__box`-Struktur beibehalten.

**Vorbefüllung:** Kontaktdaten liegen als `sessionStorage.af_lead` (JSON) –
bewusst **nicht** in der URL, sonst stünden E-Mail und Telefon in Browser-Verlauf und
Referrer-Headern (Vimeo, WhatsApp). Nur der Vorname wandert per Parameter mit
(`data-carry-name` hängt ihn an interne Links). `?email=`/`?telefon=` werden zusätzlich
akzeptiert, falls später ein E-Mail-Tool direkt auf die Umfrage verlinkt.

**Geschenk-Seite** (`danke/geschenk/`): Bestätigung + Terminbuchung.
Über dem Badge steht ein kleines rundes Porträt (`.ghero__me`, 100 px / 80 px mobil,
Quelle `assets/img/alexandra-avatar.jpg` mit nur 160×160 – nicht größer skalieren):
Der Hero-Text ist in der Ich-Form geschrieben, das Bild gibt ihm ein Gesicht.
Darunter ein kleiner CTA „Geschenk einlösen" (`.ghero__cta`) als reine Sprungmarke
auf `#termin`. Er nutzt die kompakte CTA-Variante `.cta--sm` (gleicher Look, weniger
Padding, kein `.cta__note`, bleibt auch unter 480px schmal) – der eigentliche
Abschluss ist das Calendly-Widget direkt darunter, deshalb tritt der Button
bewusst leiser auf. Scrollt nativ über `scroll-behavior: smooth`, kein JS nötig.
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
- **Kalender-Block** (`.calcta`, `#kalender`) zwischen Trust-Band und WhatsApp-
  Abschluss: dieselben drei Ziele wie auf der Danke-Seite (Google, `../workshop.ics`,
  Outlook), weil viele den Schritt dort überspringen. Bewusst als flache, breite
  Leiste gebaut und nicht als zweite große Box – sonst konkurriert sie mit dem
  WhatsApp-CTA, der die Seite abschließt. Die Buttons melden über
  `data-step-target="kalender"` an den localStorage-Stand der Danke-Seite zurück
  (eigener kleiner Schreiber in `main.js` unter `PAGE_TYPE === "geschenk"` –
  `setupDankeSteps` steigt hier mangels `.step`-Liste sofort aus).
- **WhatsApp-Community** (`.wacta`, `#community`, ganz unten): seit 18.08.2026 hier
  statt auf der Danke-Seite. Begründung des Kunden: erst das Commitment über den
  Fragebogen, dann die Community – und dafür dann prominent (heller Kasten,
  grüner `.btn-wa--lg`, Chip „Über 2.000 Frauen"). Nummer `+49 155 60647029`,
  vorbefüllter Text, per `data-wa-sign` mit dem Vornamen unterschrieben
  (siehe Personalisierung). Der Hinweis zurück zum Kalender steht darunter
  bewusst klein (`.wacta__hint`), damit er nicht als zweiter CTA auftritt.

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

## ActiveCampaign-Anbindung (`api/`)
Optin-Popup und Umfrage übergeben ihre Daten an einen serverseitigen Proxy, der
den Kontakt anlegt, auf die Liste setzt und die Tags vergibt.
Einrichtung, Env-Variablen und Feldnamen stehen in **`api/README.md`**.

- **Warum ein Proxy:** Der AC-API-Key hat Vollzugriff auf die Kontaktdatenbank.
  In `main.js` wäre er für jeden Besucher lesbar. Er darf **nie** ins Frontend –
  auch nicht "nur zum Testen".
- Zwei gleichwertige Umsetzungen, dieselbe Logik:
  `api/activecampaign.php` (Apache-Webspace) und `api/activecampaign.mjs`
  (Netlify/Vercel/Cloudflare). **Änderungen immer in beiden nachziehen** –
  insbesondere die Feld-Zuordnung (`fields` in `config.sample.php` ↔ `FIELD_MAP`).
- Zugangsdaten: `api/config.php` (aus `config.sample.php` kopiert, gitignored)
  bzw. Environment-Variablen. `api/.htaccess` sperrt Config, Logs und Cache.
- Endpunkt im Frontend: `CRM_ENDPOINT` in `main.js`, überschreibbar per
  `<html data-crm-endpoint="…">`. **Leerer Wert schaltet die Anbindung ab** –
  die Seiten funktionieren dann wie vorher, nur ohne Übertragung.
- **Der Nutzer wird nie blockiert:** `main.js` wartet höchstens 2,5 s auf den
  Proxy und leitet dann weiter. Fehlgeschlagene Übertragungen landen im
  `localStorage` (`af_crm_queue`) und gehen beim nächsten Seitenaufruf raus –
  meist Sekunden später auf der Danke-Seite. Bei Änderungen an den
  Submit-Handlern diese Reihenfolge beibehalten.
- Doppelte Übertragungen sind unkritisch: `contact/sync` nutzt die E-Mail als
  Schlüssel, Listen- und Tag-Zuweisung sind idempotent. Die Umfrage erzeugt
  deshalb **keinen zweiten Kontakt**, sondern ergänzt den aus dem Optin.
- Antworten landen doppelt in AC – als Klartext im Feld (lesbar vor dem
  Gespräch) und als Tag `umfrage-<frage>-<antwort>` (segmentierbar).
- Fehlende Tags und Felder legt der Proxy selbst an (`auto_create_*`).
  Beim Wechsel auf einen neuen Workshop-Termin den Tag in der Config anpassen
  (`webinar-2026-09-22`) – sonst laufen alle Termine in denselben Tag.
- Telefonnummern werden **serverseitig** auf E.164 normalisiert
  (`+49` + `0151 …` → `+4915123456789`). Deshalb schickt das Frontend Vorwahl
  und Nummer getrennt – nicht zusammengesetzt.

## Tracking-Konventionen
- `<html data-variant="optin-a" data-page-type="optin">` – jede Seite/Variante kennzeichnen.
  Die Fehlerseite läuft als `data-variant="404"` / `data-page-type="404"`, ihr CTA als
  `data-track-position="404"` – damit lassen sich tote Links im GTM auswerten.
- CTAs/Links: `data-track="cta_primary"` + `data-track-position="hero"`
- Events: `lp_page_view`, `lp_cta_click`, `lp_scroll_depth` (25/50/75/100),
  `lp_form_open`, `lp_form_close`, `lp_form_error`, `lp_form_submit`,
  `lp_video_play` (Videostart, mit `lp_video_id`/`lp_video_name` und
  `lp_video_trigger` = `click` | `autoplay` – **das Autoplay im Danke-Hero feuert bei
  jedem Seitenaufruf**, für „echte" Videostarts also auf `click` filtern),
  `lp_video_unmute` (Ton beim Autoplay-Video eingeschaltet – das ist hier das
  eigentliche Interessensignal),
  `lp_faq_open` (mit `lp_faq_id` aus `data-faq` des FAQ-Items),
  `lp_step_done` (Danke-Seite, mit `lp_step_id` + `lp_steps_done`),
  `lp_quiz_start`, `lp_quiz_step` (mit `lp_quiz_step` = Schrittnummer), `lp_quiz_submit`,
  `lp_booking_step` / `lp_booking_scheduled` (eingebetteter Calendly-Kalender),
  `lp_crm_error` (Übergabe an ActiveCampaign fehlgeschlagen, mit `lp_crm_form`)
- **`lp_crm_error` als Alarm einrichten:** Einzelne Fehler sind normal (Offline,
  Ad-Blocker). Steigt die Zahl plötzlich, hängt der Proxy oder AC – dann kommen
  Anmeldungen nur noch verzögert über die Wiedervorlage an.
- **Buchungen messen:** Calendly meldet den Fortschritt per `postMessage` an die
  einbettende Seite – Voraussetzung ist das von `main.js` gesetzte `embed_domain`.
  `lp_booking_scheduled` ist die eigentliche Conversion; ein `lp_cta_click` auf den
  Kalender sagt nichts darüber aus, ob am Ende ein Termin zustande kam.
- UTM-Parameter (+ fbclid/gclid) → sessionStorage `af_utms`, werden in Hidden-Fields
  (`f-variant`, `f-utms`) ans Formular gehängt
- GTM-Snippet auskommentiert im `<head>` – Container-ID eintragen und aktivieren.

## Inhaltliche Leitplanken
- Zielgruppe: Ü50, keine Vorkenntnisse, Altersvorsorge-Fokus. Ansprache: „Du".
- Keine erfundenen Zahlen/Bewertungen – belegte Fakten: Ex-Bankerin, 25 Jahre Private
  Banking, ProvenExpert-Siegel („Von Kunden empfohlen 2026", `assets/img/provenexpert.jpeg`)
- Aktueller Termin: **Dienstag, 22. September 2026, 20:00 Uhr** – bei Änderung anpassen:
  Meta-Chips, Countdown-`data-countdown`, Modal-Subline, Danke-Seite,
  Kalender-Deeplinks + `workshop.ics` und das **Share-Bild** (`tools/og-image.html`
  nennt das Datum im Bild – Text ändern und `./tools/render-og.sh` neu laufen lassen)
- Footer mit Impressum/Datenschutz (Links zur Hauptseite) auf jeder Seite.

## Social-Media-Linkvorschau (Open Graph)
Jede Seite trägt im `<head>` einen vollständigen OG-Block (`og:type`, `og:site_name`,
`og:locale`, `og:url`, `og:title`, `og:description`, `og:image` inkl. `width`/`height`/
`type`/`alt` sowie `twitter:card="summary_large_image"`). WhatsApp, Facebook, LinkedIn,
Slack und iMessage lesen daraus die Vorschau – `noindex, nofollow` stört das nicht,
die Crawler werten nur die OG-Tags aus.

- **Zwei Motive**, beide 1200 × 630 (1.91:1, das von allen Netzwerken erwartete Format):
  - `assets/img/og-share.jpg` – Workshop/Optin: Headline, Datum, Uhrzeit,
    „100 % kostenlos". Genutzt von `index.html`, `404.html`, `danke/`, `danke/umfrage/`.
  - `assets/img/og-termin.jpg` – Terminbuchung: 30-Minuten-Gespräch statt Workshop.
    Genutzt von `termin/` und `danke/geschenk/`. Bewusst ein eigenes Motiv: Der
    Termin-Link geht **im Webinar-Raum** raus, eine Vorschau mit Workshop-Datum
    wäre dort schlicht falsch.
- **Erzeugt aus `tools/og-image.html`** (Karo-Hintergrund, Gold-Radials, Gold-Chart,
  Freisteller `alexandra-final-cutout.webp`, Signatur + ProvenExpert-Siegel – dieselben
  Bausteine wie der Hero). Welche Karte gerendert wird, steuert der Hash
  (`#workshop` / `#termin`). Rendern mit `./tools/render-og.sh` (Headless Chrome →
  JPEG via `sips`). Die Datei liegt unter `tools/`, wird also **nicht deployt**.
- **Nicht der Hero-Freisteller** (`alexandra-cutout.png`, nur 304 × 478) – für 1200 px
  Breite zu klein. Das Share-Bild nutzt den hochauflösenden Freisteller mit 840 × 1553.
- **JPEG statt PNG**: ~145 KB statt ~500 KB. WhatsApp lädt Vorschaubilder oberhalb von
  ~300 KB teilweise gar nicht erst – Größe nach dem Rendern also im Blick behalten.
- **Absolute URLs sind Pflicht**: relative `og:image`-Pfade werten die meisten Crawler
  nicht aus. Die Tags zeigen fest auf `https://webinar.alexandra-feuerer.de/…` –
  **bei einem Domainwechsel alle sechs Seiten anpassen.**
- **Cache-Buster `?v=JJJJMMTT` am Bildpfad**: Facebook & Co. cachen Vorschaubilder
  wochenlang pro URL. Nach einem neuen Rendern den Wert hochzählen, sonst zeigen
  geteilte Links weiter das alte Bild. Zum sofortigen Neueinlesen zusätzlich den
  Facebook Sharing Debugger bzw. den LinkedIn Post Inspector benutzen.

## Caching / Deployment
`main.css` und `main.js` werden mit Versions-Parameter eingebunden
(`assets/css/main.css?v=20260822`). **Nach jeder Änderung an CSS oder JS den Wert in
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
- ActiveCampaign scharfschalten: Zugangsdaten eintragen, Listen-ID setzen,
  Backend-Variante wählen (`api/README.md`). Code steht, aber ohne Config
  läuft die Übertragung ins Leere.
- Webinar-Tool (Zugangslink, Erinnerungen) anbinden – bisher übernimmt
  ActiveCampaign nur den Kontakt, nicht die Webinar-Einladung.
- Double-Opt-in-Frage mit Alexandra klären (siehe `api/README.md`).
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
  Mobile-Verhalten der beiden neuen/angepassten Sektionen: Der Mythen-Check nutzt unter
  600px denselben Sticky-Karten-Stapel wie Vorteile und Bewertungen (`setupCardStack`),
  die Karten brauchen dort einen **deckenden** Hintergrund – halbtransparent scheint der
  Text der Karte darunter durch. Die Video-Testimonials (`#stimmen`) laufen unter 600px
  als Karussell: `.stories__slider` umschliesst Track und Steuerung, die Mechanik ist
  dieselbe wie beim Bewertungs-Slider – aus `setupReviewsSlider` wurde das generische
  `setupSlider({slider, track, dots, dotClass, dotLabel})`, das beide Sektionen bedient.
  Die Steuerung erscheint nur bei `has-overflow`, deshalb bleibt sie auf Desktop
  automatisch unsichtbar. Beide Regelblöcke stehen am **Dateiende** von `main.css`,
  weil sie frühere Mobile-Regeln derselben Sektionen überschreiben müssen.
  Mythen-Check umgesetzt: `.myths` (`#mythen`) direkt nach den Vorteilen und vor dem
  Zitat-Band – acht Vorurteile der Zielgruppe als kompakte Karten (Serif-Zitat +
  kurze Antwort, goldener Balken links, zwei Spalten ab 861px). Bewusst **keine**
  Doppelung mit dem FAQ: Startkapital, Vorkenntnisse, Risiko, „zu spät" und
  Seriosität stehen dort ausführlich, hier stehen die Einwände, die das FAQ nicht
  abdeckt (Geschlechterrollen, „mein Mann macht das", „meine Rente reicht" …).
  „Zu spät" fehlt hier absichtlich – das behandeln schon Zitat-Band und FAQ.
  Persönlicher Brief umgesetzt: `.letter` (`#brief`) zwischen „Über Alexandra" und
  `#stimmen` – Papier-Karte (Klebestreifen, goldener Notizblock-Rand, leicht gekippt),
  Storytelling-Brief mit CTA am Ende (`data-track-position="letter"`). Der Text wird
  beim Scrollen wortweise aufgedeckt: `setupLetter` in `main.js` zerlegt die Absätze in
  `.letter__w` und setzt `is-inked`, sobald ein Wort von unten ins Bild kommt.
  Die **Unterschrift** darunter ist kein Strich-SVG mehr, sondern eine
  gefüllte Breitfeder-Kontur (`fill="currentColor"`, Dick-Dünn-Wechsel,
  12° Neigung) – die alte Fassung mit gleichmäßig dicker Linie wirkte laut
  Kundenfeedback „kindisch". Erzeugt wird sie von **`tools/signature.py`**
  (`python3 tools/signature.py --install`), dort stehen auch die Stützpunkte;
  **nicht** von Hand in den Pfaddaten editieren. Weil Füllungen kein
  `stroke-dashoffset` kennen, „schreibt" `main.js` sie über eine
  `clip-path`-Blende von links nach rechts. Ohne JS und bei
  `prefers-reduced-motion` steht sie sofort vollständig da.
  Das Abdunkeln hängt an `html[data-js]` – ohne JS und bei `prefers-reduced-motion`
  steht der Brief sofort vollständig da. Texte deshalb immer so schreiben, dass sie
  **ohne** den Effekt funktionieren. Die Ich-Formulierungen sind ein Entwurf und
  müssen von Alexandra freigegeben werden;
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
- Terminbuchung an AC melden: Calendly hat eine native ActiveCampaign-Integration –
  meist besser als ein eigener Tag über `lp_booking_scheduled`, weil Calendly auch
  Absagen und Verschiebungen kennt.
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
