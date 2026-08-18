#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt die Unterschrift "Alexandra" fuer den Brief auf der Optin-Seite.

    python3 tools/signature.py            -> SVG nach stdout
    python3 tools/signature.py --install   -> ersetzt den Block in index.html

Warum ueberhaupt ein Generator?
-------------------------------
Die erste Fassung war eine Strichlinie mit konstanter Staerke. Genau das
laesst eine Unterschrift wie Druckschrift mit dem Filzstift wirken --
Kundenfeedback war "zu kindisch". Eine echte Feder erzeugt einen
Dick-Duenn-Wechsel: Abstriche breit, Aufstriche haarfein.

Das laesst sich mit stroke nicht abbilden (eine Linie hat genau eine
Breite), deshalb werden hier GEFUELLTE Konturen berechnet: Die Mittellinie
jedes Zuges wird abgetastet, an jedem Punkt die Federbreite aus dem Winkel
zwischen Zugrichtung und Federhaltung bestimmt und daraus der Umriss
gebaut.

Folgen fuers Markup -- beim Bearbeiten beachten:
  * Die Pfade sind Fuellungen (fill="currentColor"), NICHT stroke.
  * stroke-dashoffset funktioniert daran nicht. Das "Schreiben" beim
    Scrollen macht main.js deshalb ueber eine clip-path-Blende.
  * Nicht von Hand in den Pfaddaten editieren -- lieber hier die
    Stuetzpunkte aendern und neu erzeugen.
"""
import math
import re
import sys

SLANT = 12.0          # Vorwaertsneigung in Grad
NIB   = 42.0          # Federwinkel in Grad
W     = 7.4           # maximale Federbreite
MINW  = 0.10          # Haarlinien duerfen nicht ganz verschwinden
BASE  = 100.0         # Grundlinie (Drehpunkt der Neigung)
VIEW  = "0 0 530 132"

def skew(p):
    x, y = p
    return (x + math.tan(math.radians(SLANT)) * (BASE - y), y)

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
            u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1])

def bez_d(p0, p1, p2, p3, t):
    u = 1 - t
    return (3*u*u*(p1[0]-p0[0]) + 6*u*t*(p2[0]-p1[0]) + 3*t*t*(p3[0]-p2[0]),
            3*u*u*(p1[1]-p0[1]) + 6*u*t*(p2[1]-p1[1]) + 3*t*t*(p3[1]-p2[1]))

def sample(segs, per=14):
    """Zerlegt eine Kette kubischer Segmente in Punkte + Tangenten."""
    pts = []
    for (p0, p1, p2, p3) in segs:
        p0, p1, p2, p3 = map(skew, (p0, p1, p2, p3))
        for i in range(per + 1):
            if i == 0 and pts:
                continue                      # Naht nicht doppelt setzen
            t = i / per
            pt = bez(p0, p1, p2, p3, t)
            d  = bez_d(p0, p1, p2, p3, t)
            n  = math.hypot(*d) or 1e-6
            pts.append((pt, (d[0]/n, d[1]/n)))
    return pts

def outline(segs, taper_in=0.14, taper_out=0.20, weight=1.0):
    """Baut aus der Mittellinie eine geschlossene Kontur."""
    pts = sample(segs)
    n = len(pts)
    a = math.radians(NIB)
    left, right = [], []
    for i, ((x, y), (dx, dy)) in enumerate(pts):
        phi = math.atan2(dy, dx)
        # Federmodell: Staerke haengt vom Winkel zur Feder ab
        f = abs(math.sin(phi - a))
        f = MINW + (1 - MINW) * f
        # Enden auslaufen lassen -- ein echter Federzug setzt weich an und ab
        u = i / (n - 1) if n > 1 else 0
        if u < taper_in:
            f *= (u / taper_in) ** 0.55
        if u > 1 - taper_out:
            f *= ((1 - u) / taper_out) ** 0.65
        h = W * weight * f / 2
        nx, ny = -dy, dx                       # Normale
        left.append((x + nx*h, y + ny*h))
        right.append((x - nx*h, y - ny*h))
    ring = left + right[::-1]
    # Nach dem M sind weitere Koordinatenpaare implizit Lineto -> spart Bytes
    def num(v):
        t = ("%.1f" % v).rstrip("0").rstrip(".")
        return "0" if t in ("", "-0") else t
    return "M" + " ".join(num(x) + " " + num(y) for x, y in ring) + "Z"

def S(*pts):
    """Kette aus Punkten -> Liste kubischer Segmente (je 4 Punkte, geteilte Enden)."""
    segs = []
    for i in range(0, len(pts) - 1, 3):
        segs.append((pts[i], pts[i+1], pts[i+2], pts[i+3]))
    return segs

def MV(segs, dx):
    """Verschiebt einen fertigen Zug nach links/rechts."""
    return [tuple((x + dx, y) for (x, y) in seg) for seg in segs]

# Grundlinie 100, x-Hoehe 66, Oberlaenge 30. Reihenfolge = Schreibreihenfolge.
ST = [
  # --- A: runder Schreibschrift-Versal, Schale + Stamm ---
  (S((92,44),(72,26),(30,32),(24,62),
     (18,90),(44,110),(64,99),
     (78,92),(90,74),(92,44)), dict(taper_in=0.10, taper_out=0.04)),
  (S((92,44),(92,66),(90,88),(94,97),
     (97,104),(105,104),(112,96)), dict(taper_in=0.04)),

  # --- l: Oberlaenge mit Schleife ---
  (S((112,96),(117,76),(123,46),(130,34),
     (136,24),(145,27),(141,44),
     (137,62),(125,84),(125,93),
     (125,101),(133,102),(141,95)), dict(taper_in=0.05)),

  # --- e ---
  (S((141,95),(150,89),(163,85),(172,80),
     (179,76),(177,67),(168,67),
     (157,67),(148,77),(148,87),
     (148,98),(161,103),(174,93)), dict(taper_in=0.05)),

  # --- x: zwei Zuege (Federabsatz dazwischen) ---
  (S((177,66),(187,77),(196,86),(206,98)), dict()),
  (S((209,66),(199,77),(190,86),(180,98)), dict()),

  # --- a ---
  (MV(S((250,73),(239,64),(225,72),(225,84),
     (225,97),(238,103),(247,94),
     (251,90),(252,79),(250,73)), -12), dict(taper_in=0.10, taper_out=0.04)),
  (MV(S((250,73),(250,85),(249,93),(252,98),
     (255,103),(262,102),(268,96)), -12), dict(taper_in=0.04)),

  # --- n ---
  (MV(S((268,96),(271,84),(274,74),(276,68),
     (281,62),(290,64),(291,76),
     (292,86),(290,90),(293,97),
     (297,103),(304,102),(310,95)), -12), dict(taper_in=0.05)),

  # --- d ---
  (MV(S((348,73),(337,64),(323,72),(323,84),
     (323,97),(336,103),(345,94),
     (349,90),(350,79),(348,73)), -22), dict(taper_in=0.10, taper_out=0.04)),
  (MV(S((348,73),(351,54),(356,38),(360,32),
     (364,26),(370,29),(366,43),
     (362,58),(352,82),(352,93),
     (352,101),(360,103),(367,96)), -22), dict(taper_in=0.04)),

  # --- r ---
  (MV(S((367,96),(370,85),(374,74),(376,68),
     (378,62),(384,62),(384,70),
     (384,74),(383,78),(387,76),
     (391,73),(397,70),(404,72)), -22), dict(taper_in=0.05)),

  # --- a (final) ---
  (MV(S((438,73),(427,64),(413,72),(413,84),
     (413,97),(426,103),(435,94),
     (439,90),(440,79),(438,73)), -32), dict(taper_in=0.10, taper_out=0.04)),
  (MV(S((438,73),(438,85),(437,93),(440,98),
     (443,103),(450,102),(456,96)), -32), dict(taper_in=0.04)),

  # --- Schlusszug ---
  (MV(S((456,96),(481,88),(508,80),(528,80),
     (541,80),(547,89),(538,93),
     (531,96),(521,93),(517,88)), -32), dict(taper_in=0.03, taper_out=0.34)),
]

def build():
    paths = "\n          ".join('<path d="%s"/>' % outline(s, **kw) for s, kw in ST)
    return ('<svg class="letter__sig" data-letter-sig viewBox="%s" role="img"\n'
            '               aria-label="Unterschrift von Alexandra Feuerer" focusable="false">\n'
            '            <g fill="currentColor">\n          %s\n'
            '            </g>\n          </svg>') % (VIEW, paths)


if __name__ == "__main__":
    svg = build()
    if "--install" in sys.argv:
        import io
        with io.open("index.html", encoding="utf-8") as fh:
            page = fh.read()
        alt = re.search(r'<svg class="letter__sig".*?</svg>', page, re.S)
        if not alt:
            sys.exit("Unterschrift in index.html nicht gefunden")
        with io.open("index.html", "w", encoding="utf-8") as fh:
            fh.write(page.replace(alt.group(0), svg))
        sys.stderr.write("index.html aktualisiert (%d Bytes)\n" % len(svg))
    else:
        sys.stdout.write(svg + "\n")
