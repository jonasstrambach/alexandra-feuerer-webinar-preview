#!/usr/bin/env python3
"""Lokaler Entwicklungs-Server für die Landing Pages.

Start:  python3 dev-server.py [Port]      (Standard: 8000)
        → http://127.0.0.1:8000

Warum nicht `python3 -m http.server`?
1. Der sendet nur `Last-Modified` ohne `Cache-Control` – Browser cachen CSS/JS dann
   heuristisch mehrere Stunden, neue Sektionen wirken komplett ungestylt.
2. Der kennt keine Fehlerseite und gibt bei unbekannten URLs seinen Rohtext aus
   ("Error code: 404 – File not found") statt `404.html`.

Dieser Server behebt beides und verhält sich damit wie der Live-Server:
`Cache-Control: no-store` auf allem, und `404.html` mit Status 404 für alles,
was es nicht gibt.
"""

import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Kein Caching im Dev-Betrieb, sonst hängt man auf altem CSS fest
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        """Bei 404 die echte Fehlerseite ausliefern – wie in Produktion."""
        page = os.path.join(ROOT, "404.html")
        if code == 404 and os.path.isfile(page):
            with open(page, "rb") as fh:
                body = fh.read()
            self.log_error("code %d, serving 404.html", code)
            self.send_response(404, message)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print("Landing Pages: http://127.0.0.1:%d  (Strg+C zum Beenden)" % PORT)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer beendet.")
