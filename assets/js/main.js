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
  document.querySelectorAll("[data-video-id]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var videoId = btn.getAttribute("data-video-id");
      var videoName = btn.getAttribute("data-video-name") || null;

      var iframe = document.createElement("iframe");
      iframe.className = "story__iframe";
      iframe.src = "https://player.vimeo.com/video/" + videoId +
        "?autoplay=1&dnt=1&title=0&byline=0&portrait=0";
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture; encrypted-media");
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("title", btn.getAttribute("aria-label") || "Videotestimonial");

      var wrap = document.createElement("div");
      wrap.className = "story__media story__media--playing";
      wrap.appendChild(iframe);
      btn.replaceWith(wrap);

      window.dataLayer.push({
        event: "lp_video_play",
        lp_variant: VARIANT,
        lp_video_id: videoId,
        lp_video_name: videoName
      });
    });
  });

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

  /* ---------- Bewertungen-Slider (Desktop, #bewertungen) ----------
     Der Track (.reviews__grid) scrollt horizontal per CSS Scroll-Snap;
     hier nur Pfeil-/Punkt-Steuerung und deren Sichtbarkeit. Auf Mobile
     (< 601px) greift stattdessen der Sticky-Stapel – die Controls sind
     dort per CSS ausgeblendet, has-overflow ist wirkungslos. */
  var setupReviewsSlider = function () {
    var slider = document.querySelector(".reviews__slider");
    if (!slider) return;
    var track = slider.querySelector(".reviews__grid");
    var prevBtn = slider.querySelector("[data-slider-prev]");
    var nextBtn = slider.querySelector("[data-slider-next]");
    var dotsWrap = slider.querySelector(".reviews__dots");
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
            dot.className = "reviews__dot";
            dot.setAttribute("aria-label", "Zu Bewertungen-Seite " + (i + 1));
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
  setupReviewsSlider();

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

    /* ---------- Validierung (gegen Fake-Eingaben wie "123") ---------- */

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

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!validateForm()) return;

      var data = {
        vorname: form.vorname.value.trim(),
        email: form.email.value.trim(),
        telefon: form.vorwahl.value + " " + form.telefon.value.trim(),
        variant: VARIANT,
        utms: utms
      };

      window.dataLayer.push({
        event: "lp_form_submit",
        lp_variant: VARIANT,
        lp_page_type: PAGE_TYPE
      });

      /* TODO: Anbindung an E-Mail-/Webinar-Tool (z. B. ActiveCampaign,
         WebinarGeek, Zoom) – hier den API-Call bzw. das Form-Post einbauen.
         Bis dahin: Weiterleitung zur Danke-Seite. */
      console.log("Anmeldung:", data);
      window.location.href = "danke/";
    });
  }
})();
