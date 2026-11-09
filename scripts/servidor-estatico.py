#!/usr/bin/env python3
"""Serves the prebuilt TRAMA on http://localhost and opens the browser.

Needs only Python 3.8+. Unlike `python3 -m http.server`, it answers Range requests
(the tutorial video can seek to each chapter) and always sends JavaScript as
text/javascript, which module scripts require.

Folder served: --root <folder> if given; otherwise "app" next to this script
(release zip), this script's own folder, or ../dist (repository after `npm run build`).
Usage: python3 servidor-estatico.py [port] [--root <folder>] [--sem-navegador]
"""
import http.server
import os
import re
import socketserver
import sys
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))


def find_root(argv):
    if "--root" in argv:
        i = argv.index("--root")
        if i + 1 < len(argv):
            return os.path.abspath(argv[i + 1])
    for candidate in (os.path.join(HERE, "app"), HERE, os.path.join(os.path.dirname(HERE), "dist")):
        if os.path.isfile(os.path.join(candidate, "index.html")):
            return candidate
    return None


ROOT = find_root(sys.argv[1:])
TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
    ".mp4": "video/mp4", ".webm": "video/webm", ".glb": "model/gltf-binary", ".wasm": "application/wasm",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        return TYPES.get(os.path.splitext(path)[1].lower(), "application/octet-stream")

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass

    def send_head(self):
        self._remaining = None
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", "").strip())
        path = self.translate_path(self.path)
        if not match or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        first, last = match.groups()
        if first:
            start, end = int(first), min(int(last), size - 1) if last else size - 1
        elif last:
            start, end = max(0, size - int(last)), size - 1
        else:
            return super().send_head()
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(262144, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = False


def main():
    if not ROOT or not os.path.isfile(os.path.join(ROOT, "index.html")):
        sys.exit('index.html nao encontrado. Rode "npm run build" ou use --root <pasta>.')
    numbers = [a for a in sys.argv[1:] if a.isdigit()]
    port = int(numbers[0]) if numbers else 4173
    for p in range(port, port + 21):
        try:
            server = Server(("127.0.0.1", p), Handler)
            break
        except OSError:
            continue
    else:
        sys.exit("Nenhuma porta livre entre %d e %d." % (port, port + 20))
    url = "http://localhost:%d/" % server.server_address[1]
    print("\n  TRAMA rodando em %s\n  Aperte Ctrl+C para encerrar.\n" % url)
    if "--sem-navegador" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
