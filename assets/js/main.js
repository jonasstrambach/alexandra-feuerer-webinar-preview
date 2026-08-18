/* ============================================================
   Alexandra Feuerer – Webinar Landing Pages
   Tracking-Grundgerüst (GTM/dataLayer-ready)
   ============================================================ */

(function () {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  /* Kennzeichnet, dass JS aktiv ist – Scroll-Reveal-Styles greifen nur dann
     (ohne JS bleiben alle Sektionen sofort sichtbar) */
  document.documentElement.setAttribute("data-js", "");

  var VARIANT = document.documentElement.getAttribute("data-variant") || "unknown";
  var PAGE_TYPE = document.documentElement.getAttribute("data-page-type") || "unknown";

  /* ---------- UTM-Parameter persistieren ----------
     Damit die Kampagnen-Zuordnung auch nach Klicks auf
     Folgeseiten (Danke-Seite, externes Anmelde-Tool) erhalten bleibt. */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];

  function getStoredUtms() {
    try {
      return JSON.parse(sessionStorage.getItem("af_utms") || "{}");
    } catch (e) {
      return {};
    }
  }

  function storeUtms() {
    var params = new URLSearchParams(window.location.search);
    var utms = getStoredUtms();
    var found = false;
    UTM_KEYS.forEach(function (key) {
      if (params.has(key)) {
        utms[key] = params.get(key);
        found = true;
      }
    });
    if (found) {
      try {
        sessionStorage.setItem("af_utms", JSON.stringify(utms));
      } catch (e) { /* Storage nicht verfügbar – ignorieren */ }
    }
    return utms;
  }

  var utms = storeUtms();

  /* ---------- Page View ---------- */
  window.dataLayer.push({
    event: "lp_page_view",
    lp_variant: VARIANT,
    lp_page_type: PAGE_TYPE,
    lp_utms: utms
  });

  /* ---------- CRM-Anbindung (ActiveCampaign) ----------
     Der API-Key darf NIE hier stehen – alles in dieser Datei ist für
     jeden Besucher lesbar, und mit dem Key hätte man Vollzugriff auf
     die komplette Kontaktdatenbank. Die Formulardaten gehen deshalb an
     einen kleinen Proxy auf dem eigenen Server (api/activecampaign.php
     bzw. die Serverless-Variante), der den Key hält.

     Endpunkt umstellen: hier ändern oder pro Seite über
     <html data-crm-endpoint="…"> überschreiben. Ein leerer Wert
     schaltet die Übertragung ab – die Seiten funktionieren dann wie
     vorher (Weiterleitung ohne Übertragung).

     Grundsatz an allen Stellen unten: Ein Fehler im CRM darf den
     Nutzer nie aufhalten. Wer sich angemeldet hat, kommt auf die
     Danke-Seite – notfalls landet die Anmeldung in der Wiedervorlage
     und geht beim nächsten Seitenaufruf raus. */
  var CRM_ENDPOINT = document.documentElement.getAttribute("data-crm-endpoint");
  if (CRM_ENDPOINT === null) CRM_ENDPOINT = "/api/activecampaign.php";

  var CRM_TIMEOUT   = 2500;                    /* so lange warten wir höchstens */
  var CRM_QUEUE_KEY = "af_crm_queue";
  var CRM_QUEUE_MAX = 10;
  var CRM_QUEUE_TTL = 7 * 24 * 60 * 60 * 1000; /* Ältere Einträge verfallen */

  function crmQueueRead() {
    try {
      var items = JSON.parse(localStorage.getItem(CRM_QUEUE_KEY) || "[]");
      if (!Array.isArray(items)) return [];
      var now = Date.now();
      return items.filter(function (item) {
        return item && item.ts && (now - item.ts) < CRM_QUEUE_TTL;
      });
    } catch (e) { return []; }
  }

  function crmQueueWrite(items) {
    try {
      localStorage.setItem(CRM_QUEUE_KEY, JSON.stringify(items.slice(-CRM_QUEUE_MAX)));
    } catch (e) { /* Storage voll oder gesperrt – dann eben ohne Wiedervorlage */ }
  }

  function crmQueueAdd(payload) {
    var items = crmQueueRead();
    var known = items.some(function (item) { return item._id === payload._id; });
    if (!known) items.push(payload);
    crmQueueWrite(items);
  }

  function crmQueueRemove(id) {
    crmQueueWrite(crmQueueRead().filter(function (item) { return item._id !== id; }));
  }

  /* Ein Sendeversuch. Ergebnis: "ok" | "invalid" (Retry zwecklos) |
     "failed" (später erneut versuchen). */
  function crmPost(payload) {
    return fetch(CRM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      /* keepalive: die Anfrage läuft weiter, auch wenn der Browser
         parallel schon zur Danke-Seite navigiert. */
      keepalive: true
    }).then(function (res) {
      if (res.ok) return "ok";
      /* 4xx heißt: An den Daten stimmt etwas nicht – noch mal senden
         ändert daran nichts. Nur 429 (zu viele Anfragen) lohnt später. */
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return "invalid";
      return "failed";
    }).catch(function () {
      return "failed";   /* offline, DNS, CORS … */
    });
  }

  /* Sendet und löst spätestens nach CRM_TIMEOUT auf, damit die
     Weiterleitung nicht an einer langsamen API hängt. */
  function crmSend(payload) {
    if (!CRM_ENDPOINT) return Promise.resolve();

    payload._id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8);
    payload.ts = Date.now();

    var done = false;

    var request = crmPost(payload).then(function (result) {
      done = true;
      if (result === "failed") {
        crmQueueAdd(payload);
        window.dataLayer.push({
          event: "lp_crm_error",
          lp_variant: VARIANT,
          lp_crm_form: payload.form
        });
      } else {
        /* Falls der Timeout schneller war und schon eingereiht hat */
        crmQueueRemove(payload._id);
      }
    });

    var timeout = new Promise(function (resolve) {
      setTimeout(function () {
        /* Antwort steht noch aus – wir warten nicht länger. Die Anfrage
           läuft per keepalive weiter, die Wiedervorlage ist nur die
           Absicherung. Doppelte Übertragung ist unkritisch: AC nutzt
           die E-Mail als Schlüssel (contact/sync), Liste und Tags sind
           ebenfalls idempotent. */
        if (!done) crmQueueAdd(payload);
        resolve();
      }, CRM_TIMEOUT);
    });

    return Promise.race([request, timeout]);
  }

  /* Liegengebliebene Anmeldungen beim nächsten Seitenaufruf nachreichen.
     Praktischer Nebeneffekt: Die Danke-Seite lädt direkt nach dem Optin
     und räumt einen abgebrochenen Versuch sofort wieder auf. */
  function crmFlush() {
    if (!CRM_ENDPOINT) return;
    crmQueueRead().forEach(function (item) {
      crmPost(item).then(function (result) {
        if (result !== "failed") crmQueueRemove(item._id);
      });
    });
  }
  crmFlush();

  /* ---------- CTA-Klicks ----------
     Jedes Element mit data-track="..." feuert ein Event.
     Zusätzliche Infos über data-track-position="hero" etc. */
  document.addEventListener("click", function (event) {
    var el = event.target.closest("[data-track]");
    if (!el) return;
    window.dataLayer.push({
      event: "lp_cta_click",
      lp_variant: VARIANT,
      lp_page_type: PAGE_TYPE,
      lp_cta: el.getAttribute("data-track"),
      lp_cta_position: el.getAttribute("data-track-position") || null
    });
  });

  /* ---------- Scroll-Tiefe (25/50/75/100) ---------- */
  var marks = [25, 50, 75, 100];
  var fired = {};

  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    var pct = Math.round((window.scrollY / scrollable) * 100);
    marks.forEach(function (mark) {
      if (pct >= mark && !fired[mark]) {
        fired[mark] = true;
        window.dataLayer.push({
          event: "lp_scroll_depth",
          lp_variant: VARIANT,
          lp_scroll_pct: mark
        });
      }
    });
    if (fired[100]) window.removeEventListener("scroll", onScroll);
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Scroll-Reveal für Sektionen unterhalb des Folds ----------
     Elemente mit data-scroll-reveal blenden beim ersten Sichtbarwerden ein.
     Fallback: ohne IntersectionObserver sofort sichtbar machen. */
  var revealEls = document.querySelectorAll("[data-scroll-reveal]");
  if (revealEls.length) {
    if ("IntersectionObserver" in window) {
      /* rootMargin oben stark erweitert: Elemente oberhalb des Viewports gelten
         immer als sichtbar. Sonst blieben sie nach einem Anker-Sprung unsichtbar,
         weil der Observer beim Übersprung (unterhalb → oberhalb) nie feuert. */
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: "9999px 0px -10% 0px", threshold: 0.15 });

      revealEls.forEach(function (el) { revealObserver.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("is-revealed"); });
    }
  }

  /* ---------- Sticky-CTA (Mobile) ----------
     Erscheint, sobald der Hero-CTA nach oben aus dem Viewport gescrollt ist,
     und verschwindet, sobald der Footer sichtbar wird (verdeckt sonst
     Impressum/Datenschutz). Sichtbarkeit nur < 720px, geregelt per CSS. */
  var stickyBar = document.getElementById("sticky-cta");
  var heroCta = document.querySelector('[data-open-modal][data-track-position="hero"]');
  if (stickyBar && heroCta) {
    var footerEl = document.querySelector("footer");

    var updateSticky = function () {
      var heroGone = heroCta.getBoundingClientRect().bottom < 0;
      var footerInView = footerEl
        ? footerEl.getBoundingClientRect().top < window.innerHeight
        : false;
      stickyBar.classList.toggle("is-visible", heroGone && !footerInView);
    };

    window.addEventListener("scroll", updateSticky, { passive: true });
    window.addEventListener("resize", updateSticky, { passive: true });
    updateSticky();
  }

  /* ---------- FAQ-Accordion: Öffnen einer Frage tracken ----------
     (native <details name="faq"> sorgt selbst dafür, dass immer
     nur eine Frage offen ist – hier nur das Tracking) */
  document.querySelectorAll(".faq__item").forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (!item.open) return;
      window.dataLayer.push({
        event: "lp_faq_open",
        lp_variant: VARIANT,
        lp_faq_id: item.getAttribute("data-faq") || null
      });
    });
  });

  /* ---------- Video-Testimonials: Click-to-Play ----------
     Thumbnails statt eingebetteter Player (schneller Seitenaufbau, kein
     Vimeo-Request vor der Einwilligung des Nutzers). Erst der Klick ersetzt
     den Button durch den Vimeo-Player mit Autoplay. */
  /* Vimeo-Player-API erst beim ersten Klick nachladen – vorher geht
     weiterhin kein Request an Vimeo raus. */
  var vimeoApi = null;
  var loadVimeoApi = function () {
    if (vimeoApi) return vimeoApi;
    vimeoApi = new Promise(function (resolve, reject) {
      if (window.Vimeo && window.Vimeo.Player) return resolve(window.Vimeo.Player);
      var script = document.createElement("script");
      script.src = "https://player.vimeo.com/api/player.js";
      script.onload = function () {
        resolve(window.Vimeo ? window.Vimeo.Player : null);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return vimeoApi;
  };

  document.querySelectorAll("[data-video-id]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var videoId = btn.getAttribute("data-video-id");
      var videoName = btn.getAttribute("data-video-name") || null;

      /* Klassen-Präfix: Testimonials nutzen .story__*, die Danke-Seite .vplayer__* */
      var base = btn.getAttribute("data-video-base") || "story";

      var iframe = document.createElement("iframe");
      iframe.className = base + "__iframe";
      iframe.src = "https://player.vimeo.com/video/" + videoId +
        "?autoplay=1&dnt=1&title=0&byline=0&portrait=0";
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture; encrypted-media");
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("title", btn.getAttribute("aria-label") || "Videotestimonial");

      var wrap = document.createElement("div");
      wrap.className = base + "__media " + base + "__media--playing";
      wrap.appendChild(iframe);
      btn.replaceWith(wrap);

      /* Wird der Player erst per JS eingehängt, startet Vimeo in mehreren
         Browsern stumm (Autoplay-Richtlinie greift für das neue iframe).
         Deshalb den Ton über die Player-API nachziehen. Schlägt das fehl,
         läuft das Video weiter – nur eben stumm, und der Ton lässt sich
         über die Vimeo-Steuerung selbst einschalten. */
      loadVimeoApi().then(function (Player) {
        if (!Player) return;
        var player = new Player(iframe);
        player.setMuted(false)
          .then(function () { return player.setVolume(1); })
          .then(function () { return player.play(); })
          .catch(function () { /* Browser verbietet Ton ohne Interaktion */ });
      }).catch(function () { /* API nicht erreichbar – Video läuft trotzdem */ });

      window.dataLayer.push({
        event: "lp_video_play",
        lp_variant: VARIANT,
        lp_video_id: videoId,
        lp_video_name: videoName
      });
    });
  });

  /* ---------- Personalisierung mit dem Vornamen ----------
     Die Optin-Seite hängt den Vornamen als ?vorname= an die Danke-URL.
     Die Aliase erlauben es, den Namen später auch aus einem E-Mail-Tool
     zu übergeben (z. B. ?firstname={{contact.first_name}}).
     [data-name-slot] bekommt den Namen als Text, [data-name-if] wird per
     CSS nur eingeblendet, wenn ein plausibler Name vorliegt. */
  var NAME_KEYS = ["vorname", "firstname", "first_name", "fname", "name"];

  var cleanName = function (raw) {
    if (!raw) return "";
    var value = String(raw).trim();
    /* Nicht ersetzte Merge-Tags ({{firstname}}, *|FNAME|* …) verwerfen */
    if (/[{}\[\]<>|*$]/.test(value)) return "";
    value = value.split(/[\s,]+/)[0];
    if (value.length < 2 || value.length > 20) return "";
    /* Nur Buchstaben, Bindestrich und Apostroph – filtert "test123" & Co. aus */
    if (!/^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß'’-]*$/.test(value)) return "";
    if (value === value.toUpperCase()) value = value.toLowerCase();
    return value.replace(/(^|[-'’])([a-zäöüß])/g, function (match, sep, char) {
      return sep + char.toUpperCase();
    });
  };

  var getFirstName = function () {
    var params = new URLSearchParams(window.location.search);
    var found = "";
    for (var i = 0; i < NAME_KEYS.length && !found; i++) {
      found = cleanName(params.get(NAME_KEYS[i]));
    }
    if (found) {
      try { sessionStorage.setItem("af_vorname", found); } catch (e) { /* Storage egal */ }
      return found;
    }
    /* Reload ohne Parameter: Namen aus der Session weiterverwenden */
    try { return cleanName(sessionStorage.getItem("af_vorname")); } catch (e) { return ""; }
  };

  var firstName = getFirstName();
  if (firstName) {
    document.querySelectorAll("[data-name-slot]").forEach(function (el) {
      el.textContent = firstName;
    });
    document.documentElement.classList.add("has-name");
  }

  /* ---------- Lead-Daten über die Seiten hinweg ----------
     Damit die Kontaktfelder der Umfrage vorbefüllt sind. Bewusst in der
     sessionStorage und nicht in der URL: E-Mail und Telefon würden sonst in
     Browser-Verlauf, Lesezeichen und Referrer-Headern (Vimeo, WhatsApp …)
     landen. Der Vorname darf per Parameter kommen – den zeigt die Seite ohnehin. */
  var LEAD_KEY = "af_lead";

  var getLead = function () {
    var lead = {};
    try {
      lead = JSON.parse(sessionStorage.getItem(LEAD_KEY) || "{}") || {};
    } catch (e) {
      lead = {};
    }
    /* Parameter haben Vorrang – so kann später auch ein E-Mail-Tool
       die Daten an die Umfrage übergeben (?email=…&telefon=…). */
    var params = new URLSearchParams(window.location.search);
    ["email", "telefon", "vorwahl"].forEach(function (key) {
      var value = params.get(key);
      if (value) lead[key] = value;
    });
    if (firstName) lead.vorname = firstName;
    return lead;
  };

  var storeLead = function (lead) {
    try {
      sessionStorage.setItem(LEAD_KEY, JSON.stringify(lead));
    } catch (e) { /* Storage nicht verfügbar – ignorieren */ }
  };

  /* Vorname an interne Folge-Links hängen (Danke-Seite → Umfrage) */
  if (firstName) {
    document.querySelectorAll("[data-carry-name]").forEach(function (link) {
      try {
        var url = new URL(link.getAttribute("href"), window.location.href);
        url.searchParams.set("vorname", firstName);
        link.setAttribute("href", url.pathname + url.search);
      } catch (e) { /* ungültiger Link – unverändert lassen */ }
    });
  }

  /* ---------- WhatsApp-Nachricht personalisieren ----------
     Ist ein Vorname bekannt, wird die vorbefüllte Nachricht mit
     "Viele Grüße, <Vorname>" unterschrieben – Alexandra sieht damit sofort,
     wer schreibt. Der Gruß steht als Wert in data-wa-sign, so lässt er sich
     pro Link anpassen. Ohne Namen bleibt der Text unverändert, die Links
     funktionieren also auch beim Direktaufruf ohne Parameter. */
  if (firstName) {
    document.querySelectorAll("[data-wa-sign]").forEach(function (link) {
      try {
        var url = new URL(link.getAttribute("href"), window.location.href);
        var text = url.searchParams.get("text");
        if (!text) return;
        var greeting = link.getAttribute("data-wa-sign") || "Viele Grüße,";
        url.searchParams.set("text", text + "\n\n" + greeting + " " + firstName);
        link.setAttribute("href", url.toString());
      } catch (e) { /* ungültiger Link – unverändert lassen */ }
    });
  }

  /* ---------- Buchungslink (Calendly) vorbefüllen ----------
     Calendly übernimmt name und email aus der URL – so muss im Buchungs-
     formular nichts doppelt eingetippt werden. Telefon bewusst nicht:
     das hängt bei Calendly an einer benutzerdefinierten Frage (a1), deren
     Bedeutung je nach Event-Konfiguration unterschiedlich ist. */
  document.querySelectorAll("[data-booking-link]").forEach(function (link) {
    var bookingLead = getLead();
    if (!bookingLead.vorname && !bookingLead.email) return;
    try {
      var url = new URL(link.getAttribute("href"), window.location.href);
      if (bookingLead.vorname) url.searchParams.set("name", bookingLead.vorname);
      if (bookingLead.email) url.searchParams.set("email", bookingLead.email);
      link.setAttribute("href", url.toString());
    } catch (e) { /* ungültiger Link – unverändert lassen */ }
  });

  /* Eingebetteter Calendly-Kalender: embed_domain ist Pflicht, damit Calendly
     die Einbettung akzeptiert; name/email sparen der Teilnehmerin das
     erneute Eintippen. Die Basis-URL steht im HTML, damit der Kalender auch
     ohne JS lädt. */
  document.querySelectorAll("iframe[data-calendly]").forEach(function (frame) {
    var bookingLead = getLead();
    try {
      var url = new URL(frame.getAttribute("src"), window.location.href);
      url.searchParams.set("embed_domain", window.location.hostname);
      if (bookingLead.vorname) url.searchParams.set("name", bookingLead.vorname);
      if (bookingLead.email) url.searchParams.set("email", bookingLead.email);
      frame.setAttribute("src", url.toString());
    } catch (e) { /* Quelle unverändert lassen */ }
  });

  /* ---------- Buchungen im eingebetteten Kalender tracken ----------
     Calendly meldet den Fortschritt per postMessage an die einbettende
     Seite (Voraussetzung: embed_domain, siehe oben). Nur so lässt sich
     die eigentliche Conversion messen – ein Klick auf den Kalender sagt
     noch nichts darüber aus, ob am Ende ein Termin zustande kam. */
  if (document.querySelector("iframe[data-calendly]")) {
    var CALENDLY_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?calendly\.com$/;

    window.addEventListener("message", function (event) {
      if (!CALENDLY_ORIGIN.test(event.origin)) return;
      var data = event.data;
      if (!data || typeof data.event !== "string") return;

      if (data.event === "calendly.date_and_time_selected") {
        window.dataLayer.push({
          event: "lp_booking_step",
          lp_variant: VARIANT,
          lp_page_type: PAGE_TYPE
        });
      } else if (data.event === "calendly.event_scheduled") {
        window.dataLayer.push({
          event: "lp_booking_scheduled",
          lp_variant: VARIANT,
          lp_page_type: PAGE_TYPE
        });
      }
    });
  }

  /* ---------- Danke-Seite: die drei Schritte abhaken ----------
     Ein Klick auf die Aktion eines Schritts markiert ihn als erledigt.
     Der Stand liegt im localStorage, damit die Fortschrittsanzeige auch
     nach der Rückkehr aus WhatsApp oder dem Kalender noch stimmt. */
  var setupDankeSteps = function () {
    var steps = [].slice.call(document.querySelectorAll(".step[data-step]"));
    if (!steps.length) return;

    var STORE_KEY = "af_danke_steps";
    var countEl = document.querySelector("[data-steps-count]");
    var fillEl = document.querySelector("[data-steps-fill]");

    var done;
    try {
      done = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    } catch (e) {
      done = [];
    }
    if (!Array.isArray(done)) done = [];

    /* Ein bereits entfernter Schritt darf aus einem alten localStorage-Stand
       nicht nachhaengen - sonst zaehlt der Fortschritt mehr Erledigte als es
       ueberhaupt Schritte gibt (z. B. "4 von 3 erledigt"). */
    var stepIds = steps.map(function (step) { return step.getAttribute("data-step"); });
    done = done.filter(function (id) { return stepIds.indexOf(id) !== -1; });

    var paint = function () {
      steps.forEach(function (step) {
        step.classList.toggle("is-done", done.indexOf(step.getAttribute("data-step")) !== -1);
      });
      if (countEl) countEl.textContent = String(done.length);
      if (fillEl) fillEl.style.width = Math.round((done.length / steps.length) * 100) + "%";
    };

    var markDone = function (id) {
      if (!id || done.indexOf(id) !== -1) return;
      done.push(id);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(done)); } catch (e) { /* egal */ }
      paint();
      window.dataLayer.push({
        event: "lp_step_done",
        lp_variant: VARIANT,
        lp_step_id: id,
        lp_steps_done: done.length
      });
    };

    document.querySelectorAll("[data-step-action]").forEach(function (el) {
      el.addEventListener("click", function () {
        var owner = el.closest(".step[data-step]");
        markDone(el.getAttribute("data-step-target") ||
          (owner ? owner.getAttribute("data-step") : ""));
      });
    });

    paint();
  };
  setupDankeSteps();

  /* ---------- Goldenes Konfetti beim Laden ----------
     Verstaerkt das "Glueckwunsch"-Gefuehl im Moment des Ankommens.
     Laeuft auf einem fixen Canvas ueber der Seite (pointer-events: none),
     fasst also kein Layout an und blockiert nichts. Ausgeloest wird es
     nur von Seiten mit [data-confetti]; ist der letzte Schnipsel unten
     durch, raeumt sich das Canvas selbst wieder ab.
     Bei prefers-reduced-motion passiert gar nichts. */
  var setupConfetti = function () {
    if (!document.querySelector("[data-confetti]")) return;
    if (!window.requestAnimationFrame) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    canvas.className = "confetti";
    canvas.setAttribute("aria-hidden", "true");

    /* Gold-/Champagner-Palette aus den Design-Tokens: vorne der helle Ton,
       hinten der dunklere. Beim Taumeln wird zwischen beiden gewechselt –
       das laesst die Schnipsel wie echte, gedrehte Papierflaechen wirken. */
    var COLORS = [
      ["#f6e5ae", "#c9ab54"],
      ["#e0c274", "#a3873a"],
      ["#bfa14a", "#8c722c"],
      ["#dbbd8e", "#b2915a"],
      ["#fdfbf7", "#e2d3b4"]
    ];

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0;
    var h = 0;

    var resize = function () {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    document.body.appendChild(canvas);
    resize();
    window.addEventListener("resize", resize);

    var rand = function (min, max) { return min + Math.random() * (max - min); };

    /* Menge an die Breite koppeln: auf dem Handy waeren 130 Schnipsel eine
       geschlossene Wand, auf dem Desktop sehen 60 nach Zufall aus. */
    var count = w < 620 ? 70 : (w < 1100 ? 100 : 130);
    var pieces = [];

    for (var i = 0; i < count; i++) {
      var pal = COLORS[Math.floor(Math.random() * COLORS.length)];
      var size = rand(6, 12);
      pieces.push({
        x: rand(-40, w + 40),
        /* Gestaffelter Start oberhalb des Bildschirms: die Schnipsel rieseln
           nach und nach herein statt als geschlossene Front */
        y: rand(-h * 0.75, -20),
        w: size,
        h: size * rand(0.45, 1.1),
        front: pal[0],
        back: pal[1],
        vx: rand(-24, 24),
        vy: rand(130, 280),
        rot: rand(0, Math.PI * 2),
        spin: rand(-3.2, 3.2),
        tilt: rand(0, Math.PI * 2),
        tiltSpeed: rand(2.4, 6),
        swayAmp: rand(10, 34),
        swayFreq: rand(0.6, 1.5),
        seed: rand(0, Math.PI * 2)
      });
    }

    var frame = 0;
    var last = 0;
    var elapsed = 0;

    var stop = function () {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };

    var tick = function (now) {
      if (!last) last = now;
      /* Delta deckeln: nach einem Tab-Wechsel kaeme sonst ein Sprung von
         mehreren Sekunden und alles waere auf einen Schlag unten durch. */
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      ctx.clearRect(0, 0, w, h);
      var alive = 0;

      for (var j = 0; j < pieces.length; j++) {
        var p = pieces[j];
        if (p.y > h + 30) continue;
        alive++;

        p.vy += 120 * dt;                 /* Schwerkraft */
        if (p.vy > 340) p.vy = 340;       /* Luftwiderstand – Papier faellt langsam */
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(elapsed * p.swayFreq + p.seed) * p.swayAmp) * dt;
        p.rot += p.spin * dt;
        p.tilt += p.tiltSpeed * dt;

        /* Seitlich herausgewehte Schnipsel kommen gegenueber wieder herein */
        if (p.x < -60) p.x = w + 50;
        else if (p.x > w + 60) p.x = -50;

        /* Taumeln: die sichtbare Hoehe folgt dem Drehwinkel, beim Kippen
           schlaegt die Farbe auf die dunklere Rueckseite um. */
        var face = Math.cos(p.tilt);
        var scale = Math.max(Math.abs(face), 0.12);

        ctx.save();
        /* Unten ausblenden statt an der Bildschirmkante abzuschneiden */
        ctx.globalAlpha = p.y > h - 130 ? Math.max(0, (h - p.y) / 130) : 1;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = face >= 0 ? p.front : p.back;
        ctx.fillRect(-p.w / 2, -(p.h * scale) / 2, p.w, p.h * scale);
        ctx.restore();
      }

      /* Notbremse: haengt der Tab im Hintergrund, laeuft die Schleife sonst
         theoretisch endlos weiter. */
      if (!alive || elapsed > 14) {
        stop();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
  };
  setupConfetti();

  /* ---------- Mobile: Karten-Stapel (Vorteile + Kurz-Bewertungen) ----------
     Auf schmalen Viewports kleben die Karten per CSS position: sticky und
     schieben sich beim Scrollen übereinander. Hier wird die jeweils
     überdeckte Karte skaliert und gedimmt, damit sie optisch "nach hinten"
     wandert. Aktiv nur bei passendem Viewport + ohne reduced-motion. */
  var setupCardStack = function (cards) {
    if (cards.length < 2 || !("matchMedia" in window)) return;
    var stackMq = window.matchMedia("(max-width: 600px) and (prefers-reduced-motion: no-preference)");
    var stackTicking = false;

    var clearStackStyles = function () {
      cards.forEach(function (card) {
        card.style.transform = "";
        card.style.filter = "";
      });
    };

    var paintStack = function () {
      stackTicking = false;
      for (var i = 0; i < cards.length - 1; i++) {
        var card = cards[i];
        var rect = card.getBoundingClientRect();
        var nextTop = cards[i + 1].getBoundingClientRect().top;
        /* 0 = nächste Karte berührt diese noch nicht, 1 = volle Überdeckung.
           Bewusst keine opacity: halbtransparente Karten ließen den Text
           der darunterliegenden Karten durchscheinen. */
        var p = Math.max(0, Math.min(1, (rect.bottom - nextTop) / rect.height));
        if (p > 0) {
          card.style.transform = "scale(" + (1 - 0.07 * p).toFixed(4) + ")";
          card.style.filter = "brightness(" + (1 - 0.16 * p).toFixed(3) + ")";
        } else {
          card.style.transform = "";
          card.style.filter = "";
        }
      }
    };

    var onStackScroll = function () {
      if (!stackTicking) {
        stackTicking = true;
        requestAnimationFrame(paintStack);
      }
    };

    var applyStackMode = function (active) {
      if (active) {
        window.addEventListener("scroll", onStackScroll, { passive: true });
        window.addEventListener("resize", onStackScroll);
        paintStack();
      } else {
        window.removeEventListener("scroll", onStackScroll);
        window.removeEventListener("resize", onStackScroll);
        clearStackStyles();
      }
    };

    if (stackMq.addEventListener) {
      stackMq.addEventListener("change", function (e) { applyStackMode(e.matches); });
    } else if (stackMq.addListener) {
      stackMq.addListener(function (e) { applyStackMode(e.matches); });
    }
    applyStackMode(stackMq.matches);
  };
  setupCardStack([].slice.call(document.querySelectorAll(".benefits__grid .benefit")));
  setupCardStack([].slice.call(document.querySelectorAll(".reviews__grid .review")));
  setupCardStack([].slice.call(document.querySelectorAll(".myths__grid .myth")));

  /* ---------- Karussell (Bewertungen + Video-Testimonials) ----------
     Der Track (.reviews__grid) scrollt horizontal per CSS Scroll-Snap;
     hier nur Pfeil-/Punkt-Steuerung und deren Sichtbarkeit. Auf Mobile
     (< 601px) greift stattdessen der Sticky-Stapel – die Controls sind
     dort per CSS ausgeblendet, has-overflow ist wirkungslos. */
  var setupSlider = function (config) {
    var slider = document.querySelector(config.slider);
    if (!slider) return;
    var track = slider.querySelector(config.track);
    var prevBtn = slider.querySelector("[data-slider-prev]");
    var nextBtn = slider.querySelector("[data-slider-next]");
    var dotsWrap = slider.querySelector(config.dots);
    var cards = track ? [].slice.call(track.children) : [];
    if (!track || !prevBtn || !nextBtn || cards.length < 2) return;

    /* Schrittweite = Kartenbreite + gap (aus den Offsets der ersten beiden) */
    var stepWidth = function () {
      return Math.max(1, cards[1].offsetLeft - cards[0].offsetLeft);
    };
    var maxScroll = function () {
      return Math.max(0, track.scrollWidth - track.clientWidth);
    };
    var currentPage = function () {
      return Math.round(track.scrollLeft / stepWidth());
    };

    var scrollToPage = function (page) {
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      track.scrollTo({
        left: page * stepWidth(),
        behavior: reduceMotion ? "auto" : "smooth"
      });
    };

    var update = function () {
      var max = maxScroll();
      slider.classList.toggle("has-overflow", max > 1);
      prevBtn.disabled = track.scrollLeft <= 1;
      nextBtn.disabled = track.scrollLeft >= max - 1;

      if (dotsWrap) {
        var pages = Math.round(max / stepWidth()) + 1;
        if (dotsWrap.childElementCount !== pages) {
          dotsWrap.innerHTML = "";
          for (var i = 0; i < pages; i++) {
            var dot = document.createElement("button");
            dot.type = "button";
            dot.className = config.dotClass;
            dot.setAttribute("aria-label", config.dotLabel + " " + (i + 1));
            dot.addEventListener("click", scrollToPage.bind(null, i));
            dotsWrap.appendChild(dot);
          }
        }
        var active = currentPage();
        [].forEach.call(dotsWrap.children, function (d, idx) {
          d.classList.toggle("is-active", idx === active);
        });
      }
    };

    prevBtn.addEventListener("click", function () { scrollToPage(currentPage() - 1); });
    nextBtn.addEventListener("click", function () { scrollToPage(currentPage() + 1); });

    var sliderTicking = false;
    track.addEventListener("scroll", function () {
      if (!sliderTicking) {
        sliderTicking = true;
        requestAnimationFrame(function () {
          sliderTicking = false;
          update();
        });
      }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  };
  /* Bewertungen: Slider ab 601px. Video-Testimonials: Karussell nur auf
     Mobile – beide nutzen dieselbe Mechanik, sichtbar wird die Steuerung
     jeweils nur, wenn der Track wirklich ueberlaeuft (has-overflow). */
  setupSlider({
    slider: ".reviews__slider",
    track: ".reviews__grid",
    dots: ".reviews__dots",
    dotClass: "reviews__dot",
    dotLabel: "Zu Bewertungen-Seite"
  });
  setupSlider({
    slider: ".stories__slider",
    track: ".stories__grid",
    dots: ".stories__dots",
    dotClass: "stories__dot",
    dotLabel: "Zu Video"
  });

  /* ---------- Persönlicher Brief: Text beim Scrollen "schreiben" ----------
     Die Absätze werden in Wort-Spans zerlegt und an den Scroll-Fortschritt
     gekoppelt aufgedeckt: Ein Wort wird sichtbar, sobald seine Zeile von
     unten ins Bild kommt. Nur Textknoten werden angefasst, <em>/<strong>
     bleiben dadurch erhalten. */
  var setupLetter = function () {
    var body = document.querySelector("[data-letter-body]");
    if (!body) return;

    var words = [];

    var wrapWords = function (node) {
      [].slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          if (!child.nodeValue.trim()) return;
          var frag = document.createDocumentFragment();
          child.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            var span = document.createElement("span");
            span.className = "letter__w";
            span.textContent = part;
            frag.appendChild(span);
            words.push(span);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          wrapWords(child);
        }
      });
    };

    wrapWords(body);
    if (!words.length) return;

    /* Bei reduzierter Bewegung sofort alles zeigen (CSS deckt es zusätzlich ab) */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      words.forEach(function (word) { word.classList.add("is-inked"); });
      return;
    }

    /* ---- Unterschrift ----
       Jeder Zug wird per stroke-dashoffset "gezeichnet", nacheinander und
       mit einer kurzen Pause dazwischen (das Absetzen des Stifts). Die
       Dauer je Zug richtet sich nach seiner Laenge, damit das Tempo
       gleichmaessig wirkt. */
    var sigPaths = [].slice.call(document.querySelectorAll("[data-letter-sig] path"));
    var sigLens = sigPaths.map(function (path) { return path.getTotalLength(); });
    var sigSum = sigLens.reduce(function (a, b) { return a + b; }, 0) || 1;
    var sigDrawn = false;

    sigPaths.forEach(function (path, i) {
      path.style.strokeDasharray = sigLens[i] + " " + sigLens[i];
      path.style.strokeDashoffset = sigLens[i];
    });

    var drawSignature = function () {
      if (sigDrawn) return;
      sigDrawn = true;
      var delay = 0;
      sigPaths.forEach(function (path, i) {
        var dur = Math.max(70, 1050 * (sigLens[i] / sigSum));
        path.style.transition = "stroke-dashoffset " + Math.round(dur) + "ms linear "
          + Math.round(delay) + "ms";
        path.style.strokeDashoffset = "0";
        delay += dur + 26;
      });
    };

    var inked = 0;

    var paint = function () {
      var rect = body.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      /* 0 = Oberkante des Briefs erreicht 85 % Bildschirmhöhe,
         1 = Unterkante hat denselben Punkt passiert. Ein Wort wird also
         genau dann sichtbar, wenn es von unten ins Bild scrollt. */
      var span = rect.height || 1;
      var progress = (vh * 0.85 - rect.top) / span;
      progress = Math.max(0, Math.min(1, progress));

      /* Kurz vor dem Ende des Textes setzt Alexandra die Unterschrift */
      if (progress > 0.9) drawSignature();

      var target = Math.round(progress * words.length);
      if (target === inked) return;

      var i;
      if (target > inked) {
        for (i = inked; i < target; i++) words[i].classList.add("is-inked");
      } else {
        for (i = inked - 1; i >= target; i--) words[i].classList.remove("is-inked");
      }
      inked = target;
    };

    var queued = false;
    var onScroll = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        paint();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    paint();
  };

  setupLetter();

  /* ---------- Countdown bis zum Workshop-Start ----------
     Unterstützt mehrere Instanzen (Hero + finale CTA). */
  document.querySelectorAll("[data-countdown]").forEach(function (countdownEl) {
    var target = new Date(countdownEl.getAttribute("data-countdown")).getTime();
    var nums = {
      days: countdownEl.querySelector('[data-cd="days"]'),
      hours: countdownEl.querySelector('[data-cd="hours"]'),
      mins: countdownEl.querySelector('[data-cd="mins"]'),
      secs: countdownEl.querySelector('[data-cd="secs"]')
    };

    var pad = function (n) { return String(n).padStart(2, "0"); };

    var tick = function () {
      var diff = target - Date.now();
      if (diff <= 0) {
        nums.days.textContent = "0";
        nums.hours.textContent = "00";
        nums.mins.textContent = "00";
        nums.secs.textContent = "00";
        clearInterval(timer);
        return;
      }
      nums.days.textContent = String(Math.floor(diff / 86400000));
      nums.hours.textContent = pad(Math.floor(diff / 3600000) % 24);
      nums.mins.textContent = pad(Math.floor(diff / 60000) % 60);
      nums.secs.textContent = pad(Math.floor(diff / 1000) % 60);
    };

    tick();
    var timer = setInterval(tick, 1000);
  });

  /* ---------- Feld-Validierung (gegen Fake-Eingaben wie "123") ----------
     Wird vom Anmelde-Popup und vom Umfrage-Quiz gemeinsam genutzt. */

  /* E-Mail muss dem Muster name@domain.tld entsprechen (TLD mind. 2 Buchstaben) –
     strenger als type="email", das z. B. "a@b" durchlässt */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  var isValidEmail = function (value) {
    return EMAIL_RE.test(value);
  };

  /* Telefon: nur Ziffern, Leerzeichen und - / ( ) erlaubt, 6–14 Ziffern,
     keine offensichtlichen Fake-Nummern (1111111, 1234567 …) */
  var isValidPhone = function (value) {
    if (!/^[0-9 \/\-()]+$/.test(value)) return false;
    var digits = value.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 14) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    if ("01234567890123456789".indexOf(digits) !== -1) return false;
    if ("98765432109876543210".indexOf(digits) !== -1) return false;
    return true;
  };

  var setFieldError = function (input, hasError) {
    var errorEl = document.getElementById(input.id + "-error");
    input.classList.toggle("is-invalid", hasError);
    input.setAttribute("aria-invalid", hasError ? "true" : "false");
    if (errorEl) errorEl.hidden = !hasError;
  };

  /* ---------- Umfrage-Quiz (danke/umfrage/) ----------
     Ein Schritt sichtbar, Single-Choice springt automatisch weiter.
     Der letzte Schritt sammelt die Kontaktdaten und leitet auf die
     Geschenk-Seite weiter. */
  var setupQuiz = function () {
    var quizForm = document.getElementById("quiz-form");
    if (!quizForm) return;

    var steps = [].slice.call(quizForm.querySelectorAll("[data-quiz-step]"));
    if (!steps.length) return;

    var backBtn = quizForm.querySelector("[data-quiz-back]");
    var nextBtn = quizForm.querySelector("[data-quiz-next]");
    var nextLabel = quizForm.querySelector("[data-quiz-next-label]");
    var errorEl = quizForm.querySelector("[data-quiz-error]");
    var fillEl = document.querySelector("[data-quiz-fill]");
    var currentEl = document.querySelector("[data-quiz-current]");
    var totalEl = document.querySelector("[data-quiz-total]");
    var index = 0;
    var advanceTimer = null;

    if (totalEl) totalEl.textContent = String(steps.length);

    /* Kontaktfelder aus der Anmeldung vorbefüllen */
    var lead = getLead();
    var prefill = function (id, value) {
      var el = document.getElementById(id);
      if (el && value) el.value = value;
    };
    prefill("q-vorname", lead.vorname);
    prefill("q-email", lead.email);
    prefill("q-telefon", lead.telefon);
    if (lead.vorwahl) prefill("q-vorwahl", lead.vorwahl);

    var variantField = document.getElementById("q-variant");
    var utmsField = document.getElementById("q-utms");
    if (variantField) variantField.value = VARIANT;
    if (utmsField) utmsField.value = JSON.stringify(utms);

    var isLast = function () { return index === steps.length - 1; };

    var paint = function () {
      steps.forEach(function (step, i) {
        step.classList.toggle("is-active", i === index);
      });
      if (currentEl) currentEl.textContent = String(index + 1);
      if (fillEl) fillEl.style.width = Math.round(((index + 1) / steps.length) * 100) + "%";
      if (backBtn) backBtn.hidden = index === 0;
      if (nextLabel) nextLabel.textContent = isLast() ? "Absenden & Geschenk sichern" : "Weiter";
      if (errorEl) errorEl.hidden = true;

      /* Fokus auf die Frage – sonst bleibt er auf dem alten Schritt hängen */
      var heading = steps[index].querySelector(".quiz__q");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
      window.scrollTo(0, 0);
    };

    var validateContact = function () {
      var vorname = document.getElementById("q-vorname");
      var email = document.getElementById("q-email");
      var telefon = document.getElementById("q-telefon");
      if (!vorname || !email || !telefon) return true;

      var invalid = [];
      var vornameOk = vorname.value.trim().length >= 2;
      var emailOk = isValidEmail(email.value.trim());
      var telefonOk = isValidPhone(telefon.value.trim());

      setFieldError(vorname, !vornameOk);
      setFieldError(email, !emailOk);
      setFieldError(telefon, !telefonOk);

      if (!vornameOk) invalid.push(vorname);
      if (!emailOk) invalid.push(email);
      if (!telefonOk) invalid.push(telefon);

      if (invalid.length) {
        invalid[0].focus();
        window.dataLayer.push({
          event: "lp_form_error",
          lp_variant: VARIANT,
          lp_error_fields: invalid.map(function (el) { return el.name; }).join(",")
        });
        return false;
      }
      return true;
    };

    /* Pflicht ist nur eine Auswahl bei Single/Multi – die offene Frage
       darf übersprungen werden, damit sie niemanden blockiert. */
    var validateStep = function () {
      var step = steps[index];
      var type = step.getAttribute("data-quiz-type");
      if (type === "single" || type === "multi") {
        if (!step.querySelector("input:checked")) {
          if (errorEl) errorEl.hidden = false;
          return false;
        }
      }
      if (type === "contact") return validateContact();
      return true;
    };

    var collect = function () {
      var data = { variant: VARIANT, utms: utms };
      var fd = new FormData(quizForm);
      fd.forEach(function (value, key) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = [].concat(data[key], value);   /* Mehrfachauswahl */
        } else {
          data[key] = value;
        }
      });
      /* Checkbox-Gruppen immer als Array, auch bei nur einer Antwort */
      ["blocker", "versucht", "wichtig"].forEach(function (key) {
        if (key in data && !Array.isArray(data[key])) data[key] = [data[key]];
        if (!(key in data)) data[key] = [];
      });
      return data;
    };

    /* Antworten fürs CRM: pro Frage der maschinenlesbare Wert (wird zum
       Tag) und der sichtbare Text (landet als Klartext im AC-Kontakt,
       damit Alexandra die Antworten vor dem Gespräch lesen kann). */
    var collectAnswers = function () {
      var answers = {};
      var add = function (name, value, label) {
        if (!answers[name]) answers[name] = { values: [], labels: [] };
        answers[name].values.push(value);
        answers[name].labels.push(label);
      };

      quizForm.querySelectorAll("input[type=radio], input[type=checkbox]").forEach(function (input) {
        if (!input.checked) return;
        var box = input.parentNode ? input.parentNode.querySelector(".qopt__box") : null;
        add(input.name, input.value, box ? box.textContent.trim() : input.value);
      });

      /* Freitext-Frage: Wert und Text sind dasselbe */
      quizForm.querySelectorAll("textarea").forEach(function (area) {
        var value = area.value.trim();
        if (value) add(area.name, value, value);
      });

      return answers;
    };

    var quizSending = false;

    var submit = function () {
      if (quizSending) return;
      var data = collect();

      window.dataLayer.push({
        event: "lp_quiz_submit",
        lp_variant: VARIANT,
        lp_page_type: PAGE_TYPE
      });

      storeLead({
        vorname: data.vorname || "",
        email: data.email || "",
        telefon: data.telefon || "",
        vorwahl: data.vorwahl || ""
      });

      var weiter = function () {
        var target = "../geschenk/";
        if (data.vorname) target += "?vorname=" + encodeURIComponent(data.vorname);
        window.location.href = target;
      };

      /* Antworten an denselben Kontakt in ActiveCampaign hängen –
         contact/sync findet ihn über die E-Mail aus dem Optin. */
      quizSending = true;
      if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.classList.add("is-sending");
      }
      crmSend({
        form: "quiz",
        vorname: data.vorname || "",
        email: data.email || "",
        vorwahl: data.vorwahl || "",
        telefon: data.telefon || "",
        variant: VARIANT,
        page: window.location.pathname,
        utms: utms,
        answers: collectAnswers(),
        hp: quizForm.website ? quizForm.website.value : ""
      }).then(weiter, weiter);
    };

    var goTo = function (nextIndex) {
      index = Math.max(0, Math.min(steps.length - 1, nextIndex));
      paint();
      window.dataLayer.push({
        event: "lp_quiz_step",
        lp_variant: VARIANT,
        lp_quiz_step: index + 1
      });
    };

    var forward = function () {
      if (!validateStep()) return;
      if (isLast()) submit();
      else goTo(index + 1);
    };

    if (nextBtn) nextBtn.addEventListener("click", forward);
    if (backBtn) backBtn.addEventListener("click", function () { goTo(index - 1); });

    /* Single-Choice: Auswahl bestätigt sich selbst und springt weiter.
       Kurze Verzögerung, damit die Auswahl noch sichtbar aufblitzt.
       Bewusst am click- statt am change-Event: Wer über "Zurück" kommt und
       seine bereits gewählte Antwort erneut antippt, löst kein change aus
       und würde sonst auf dem Schritt festhängen. */
    quizForm.addEventListener("click", function (event) {
      var input = event.target;
      if (!input || input.tagName !== "INPUT" || input.type !== "radio") return;
      if (steps[index].getAttribute("data-quiz-type") !== "single") return;
      if (errorEl) errorEl.hidden = true;
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(function () {
        if (!isLast()) forward();
      }, 260);
    });

    /* Fehlermeldung verschwindet, sobald etwas ausgewählt wird */
    quizForm.addEventListener("change", function () {
      if (errorEl) errorEl.hidden = true;
    });

    /* Enter im Kontaktschritt soll absenden, nicht die Seite neu laden */
    quizForm.addEventListener("submit", function (event) {
      event.preventDefault();
      forward();
    });

    window.dataLayer.push({ event: "lp_quiz_start", lp_variant: VARIANT });
    paint();
  };
  setupQuiz();

  /* ---------- Geschenk-Seite: Schritte der Danke-Seite mitpflegen ----------
     Die Seite hat selbst keine .step-Liste, setupDankeSteps steigt hier also
     sofort aus. Der Stand im localStorage wird deshalb direkt geschrieben –
     die Danke-Seite zeigt ihn beim nächsten Aufruf an. */
  if (PAGE_TYPE === "geschenk") {
    var rememberDankeStep = function (id, notify) {
      if (!id) return;
      try {
        var doneSteps = JSON.parse(localStorage.getItem("af_danke_steps") || "[]");
        if (!Array.isArray(doneSteps)) doneSteps = [];
        if (doneSteps.indexOf(id) !== -1) return;
        doneSteps.push(id);
        localStorage.setItem("af_danke_steps", JSON.stringify(doneSteps));
        if (notify) {
          window.dataLayer.push({
            event: "lp_step_done",
            lp_variant: VARIANT,
            lp_step_id: id,
            lp_steps_done: doneSteps.length
          });
        }
      } catch (e) { /* Storage nicht verfügbar – ignorieren */ }
    };

    /* Wer hier landet, hat die Umfrage abgeschlossen. Ohne Event: der Schritt
       wird nicht angeklickt, sondern nur nachgetragen. */
    rememberDankeStep("umfrage", false);

    /* Die Kalender-Buttons am Seitenende haken den Kalender-Schritt ab. */
    document.querySelectorAll("[data-step-action][data-step-target]").forEach(function (el) {
      el.addEventListener("click", function () {
        rememberDankeStep(el.getAttribute("data-step-target"), true);
      });
    });
  }

  /* ---------- Anmelde-Popup ---------- */
  var modal = document.getElementById("signup-modal");
  var form = document.getElementById("signup-form");

  if (modal && form) {
    document.querySelectorAll("[data-open-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        modal.showModal();
        window.dataLayer.push({ event: "lp_form_open", lp_variant: VARIANT });
        var first = document.getElementById("f-vorname");
        if (first) first.focus();
      });
    });

    document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        modal.close();
      });
    });

    /* Klick auf den Backdrop schließt das Popup */
    modal.addEventListener("click", function (event) {
      if (event.target === modal) modal.close();
    });

    modal.addEventListener("close", function () {
      window.dataLayer.push({ event: "lp_form_close", lp_variant: VARIANT });
    });

    /* Hidden-Felder für die Auswertung befüllen */
    var variantField = document.getElementById("f-variant");
    var utmsField = document.getElementById("f-utms");
    if (variantField) variantField.value = VARIANT;
    if (utmsField) utmsField.value = JSON.stringify(utms);

    /* Fehler ausblenden, sobald der Nutzer das Feld korrigiert */
    ["f-vorname", "f-email", "f-telefon"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", function () {
          setFieldError(input, false);
        });
      }
    });

    var validateForm = function () {
      var invalid = [];

      var vorname = document.getElementById("f-vorname");
      var email = document.getElementById("f-email");
      var telefon = document.getElementById("f-telefon");

      var vornameOk = vorname.value.trim().length >= 2;
      var emailOk = isValidEmail(email.value.trim());
      var telefonOk = isValidPhone(telefon.value.trim());

      setFieldError(vorname, !vornameOk);
      setFieldError(email, !emailOk);
      setFieldError(telefon, !telefonOk);

      if (!vornameOk) invalid.push(vorname);
      if (!emailOk) invalid.push(email);
      if (!telefonOk) invalid.push(telefon);

      if (invalid.length) {
        invalid[0].focus();
        window.dataLayer.push({
          event: "lp_form_error",
          lp_variant: VARIANT,
          lp_error_fields: invalid.map(function (el) { return el.name; }).join(",")
        });
        return false;
      }
      return true;
    };

    /* Sendezustand des Buttons – verhindert Doppel-Anmeldungen und
       zeigt, dass etwas passiert, solange der Proxy antwortet. */
    var submitBtn = form.querySelector("button[type=submit]");
    var sending = false;
    var setSending = function (on) {
      sending = on;
      if (!submitBtn) return;
      submitBtn.disabled = on;
      if (on) submitBtn.classList.add("is-sending");
      else submitBtn.classList.remove("is-sending");
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (sending) return;
      if (!validateForm()) return;

      var vorwahl = form.vorwahl.value;
      var nummer = form.telefon.value.trim();

      var data = {
        vorname: form.vorname.value.trim(),
        email: form.email.value.trim(),
        telefon: vorwahl + " " + nummer,
        variant: VARIANT,
        utms: utms
      };

      window.dataLayer.push({
        event: "lp_form_submit",
        lp_variant: VARIANT,
        lp_page_type: PAGE_TYPE
      });

      /* Vorname für die persönliche Ansprache auf der Danke-Seite mitgeben.
         Zusätzlich in der Session, falls das Tool die Query-Parameter später
         beim Redirect verschluckt. */
      try { sessionStorage.setItem("af_vorname", data.vorname); } catch (e) { /* egal */ }

      /* Kontaktdaten merken, damit die Umfrage sie vorbefüllen kann
         (Telefon getrennt nach Vorwahl und Nummer). */
      storeLead({
        vorname: data.vorname,
        email: data.email,
        telefon: nummer,
        vorwahl: vorwahl
      });

      var weiter = function () {
        window.location.href = "danke/?vorname=" + encodeURIComponent(data.vorname);
      };

      /* An ActiveCampaign übergeben (Liste + Tags setzt der Proxy).
         Telefon getrennt, damit der Server sauber auf E.164 normalisieren
         kann – "0151 …" mit Vorwahl +49 wäre sonst falsch. */
      setSending(true);
      crmSend({
        form: "optin",
        vorname: data.vorname,
        email: data.email,
        vorwahl: vorwahl,
        telefon: nummer,
        variant: VARIANT,
        page: window.location.pathname,
        utms: utms,
        hp: form.website ? form.website.value : ""
      }).then(weiter, weiter);
    });
  }
})();
