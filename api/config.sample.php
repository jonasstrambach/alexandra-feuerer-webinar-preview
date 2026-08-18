<?php
/* ============================================================
   ActiveCampaign – Zugangsdaten und Zuordnung
   ------------------------------------------------------------
   Diese Datei nach  api/config.php  kopieren und ausfüllen.
   config.php ist in .gitignore und darf NIE ins Repository.
   ============================================================ */

return array(

  /* ---------- Zugang ----------
     Beides steht in ActiveCampaign unter
     Einstellungen → Entwickler ("Developer").
     Die URL sieht aus wie https://alexandrafeuerer.api-us1.com
     (ohne /api/3 am Ende, ohne Slash). */
  'api_url' => 'https://DEINACCOUNT.api-us1.com',
  'api_key' => 'HIER_DEN_API_KEY_EINTRAGEN',

  /* ---------- Liste ----------
     Die numerische ID der Webinar-Liste. Findest Du in AC unter
     Kontakte → Listen: die URL der Liste endet auf .../list/<ID>. */
  'list_id' => 1,

  /* Status auf der Liste: 1 = angemeldet, 2 = abgemeldet.
     Achtung Double-Opt-in: Steht am AC-Formular dieser Liste ein
     Bestätigungs-Opt-in, verschickt AC die Bestätigungsmail selbst.
     Siehe api/README.md, Abschnitt "Double-Opt-in". */
  'list_status' => 1,

  /* ---------- Tags ----------
     Tags werden über den Namen angesprochen. Existiert ein Tag noch
     nicht, legt der Proxy ihn an (siehe 'auto_create_tags'). */

  /* Tags für jede Webinar-Anmeldung über das Optin-Popup. */
  'tags_optin' => array(
    'webinar-anmeldung',
    'webinar-2026-09-22',   /* Pro Termin ein eigener Tag – so bleibt
                               auswertbar, wer bei welchem Webinar war. */
  ),

  /* Tags für den abgeschlossenen Umfrage-Funnel. */
  'tags_quiz' => array(
    'umfrage-abgeschlossen',
  ),

  /* Zusätzlich pro Umfrage-Antwort ein Tag setzen? Ergibt Tags wie
     "umfrage-blocker-zu_alt" und macht die Antworten in AC direkt
     segmentierbar (Automationen, dynamische Inhalte, Segmente).
     Bei Mehrfachauswahl entsteht pro Auswahl ein Tag. */
  'quiz_answer_tags' => true,
  'quiz_answer_tag_prefix' => 'umfrage-',

  /* Nur diese Fragen bekommen Antwort-Tags. Leeres Array = alle
     Auswahlfragen. Die Freitext-Frage ("ziel") wird nie getaggt. */
  'quiz_answer_tag_fields' => array('stand', 'vorsorge', 'blocker', 'wichtig'),

  /* ---------- Benutzerdefinierte Felder ----------
     Links der Schlüssel aus dem Formular, rechts das Personalisierungs-
     Tag des AC-Feldes (in AC unter Kontakte → Felder, Spalte
     "Personalisierung", z. B. %AF_STAND%). Die Prozentzeichen sind
     optional. Alternativ funktioniert auch der Feld-Titel.

     Felder, die es in AC nicht gibt, werden angelegt, sofern
     'auto_create_fields' aktiv ist – sonst still übersprungen. */
  'fields' => array(
    /* Kampagnen-Zuordnung (beide Formulare) */
    'variant'      => 'AF_VARIANTE',
    'utm_source'   => 'AF_UTM_SOURCE',
    'utm_medium'   => 'AF_UTM_MEDIUM',
    'utm_campaign' => 'AF_UTM_CAMPAIGN',

    /* Umfrage-Antworten (als Klartext, damit sie im AC-Kontakt
       lesbar sind – die Segmentierung läuft über die Tags oben) */
    'stand'    => 'AF_STAND',
    'vorsorge' => 'AF_VORSORGE',
    'blocker'  => 'AF_BLOCKER',
    'versucht' => 'AF_VERSUCHT',
    'ziel'     => 'AF_ZIEL',
    'wichtig'  => 'AF_WICHTIG',
  ),

  /* Fehlende Tags / Felder automatisch in AC anlegen.
     Beim ersten Livegang praktisch – wer die Felder lieber von Hand
     pflegt, setzt beides auf false. */
  'auto_create_tags'   => true,
  'auto_create_fields' => true,

  /* ---------- Sicherheit ----------
     Nur Anfragen von diesen Domains werden angenommen. Ohne Eintrag
     (leeres Array) wird die Herkunft nicht geprüft. */
  'allowed_origins' => array(
    'https://webinar.alexandra-feuerer.de',
  ),

  /* Maximale Anfragen pro IP und Stunde. 0 schaltet die Bremse ab. */
  'rate_limit' => 30,

  /* Fehler nach api/ac-errors.log schreiben (hilft beim Einrichten). */
  'log_errors' => true,
);
