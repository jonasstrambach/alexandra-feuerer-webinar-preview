#!/usr/bin/env bash
# Rendert die Social-Media-Share-Bilder aus tools/og-image.html.
# Aufruf aus dem Projekt-Root:  ./tools/render-og.sh
#
# Ergebnis:
#   assets/img/og-share.jpg   – Workshop/Optin (index.html, 404, danke/, umfrage/)
#   assets/img/og-termin.jpg  – Terminbuchung  (termin/, danke/geschenk/)
#
# Nach jedem Rendern: Dateigröße prüfen (Ziel < 300 KB, sonst laden manche
# Messenger die Vorschau nicht) und die Bild-URLs in den HTML-Dateien mit
# frischem ?v=-Parameter versehen, damit Facebook & Co. neu einlesen.
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="file://$ROOT/tools/og-image.html"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

shot () { # $1 = Hash (workshop|termin), $2 = Zieldatei ohne Endung
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --virtual-time-budget=6000 \
    --window-size=1200,630 --screenshot="$TMP/$2.png" "$SRC#$1" >/dev/null 2>&1
  # JPEG statt PNG: ~1/4 der Dateigröße, für Linkvorschauen völlig ausreichend.
  sips -s format jpeg -s formatOptions 82 "$TMP/$2.png" \
       --out "$ROOT/assets/img/$2.jpg" >/dev/null
  printf '%-24s %s\n' "assets/img/$2.jpg" "$(du -h "$ROOT/assets/img/$2.jpg" | cut -f1)"
}

shot workshop og-share
shot termin   og-termin
