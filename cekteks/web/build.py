"""Bangun CekTeks menjadi aplikasi mandiri.

Hasil:
  ../dist/CekTeks.html     satu file, semua pustaka di dalamnya -> bisa dibuka offline di browser mana pun
  ../../docs/              versi situs web (GitHub Pages/Netlify) + service worker agar bisa dipasang & offline

Jalankan:  python build.py
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # folder cekteks/
REPO = os.path.dirname(ROOT)
VENDOR = ["pdf.min.js", "pdf.worker.min.js", "mammoth.browser.min.js", "jszip.min.js", "jspdf.umd.min.js"]
ICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0e6a86"/>'
        '<path d="M9 7h10l5 5v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="#fff"/>'
        '<path d="M11 14h8M11 17h6M11 20h4" stroke="#0e6a86" stroke-width="1.6" stroke-linecap="round"/>'
        '<circle cx="20.5" cy="20.5" r="3.3" fill="none" stroke="#0f1b2a" stroke-width="1.6"/>'
        '<path d="M23 23l2.6 2.6" stroke="#0f1b2a" stroke-width="1.8" stroke-linecap="round"/></svg>')


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(data)
    print(f"  {os.path.relpath(path, REPO)}  ({len(data.encode()) / 1024:,.0f} KB)")


def build_standalone(app, pwa):
    head_end = app.index("</style>") + len("</style>")
    head, body = app[:head_end], app[head_end:]
    vendor = ""
    for name in VENDOR:
        js = read(os.path.join(HERE, "vendor", name))
        assert "</script" not in js.lower(), name
        vendor += f"<script>/* {name} */\n{js}\n</script>\n"
    marker = '<script>\n"use strict";'
    assert body.count(marker) == 1
    body = body.replace(marker, vendor + marker)
    extra = ('<meta name="theme-color" content="#0e6a86">\n'
             '<link rel="icon" href="data:image/svg+xml,' + ICON.replace('"', "'").replace("#", "%23") + '">\n')
    if pwa:
        extra += '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon.svg">\n'
    return ('<!doctype html>\n<html lang="id">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + extra + head + "\n</head>\n<body>\n" + body + "\n</body>\n</html>\n")


def main():
    app = read(os.path.join(HERE, "src", "app.html"))
    print("Membangun CekTeks:")
    write(os.path.join(ROOT, "dist", "CekTeks.html"), build_standalone(app, pwa=False))

    docs = os.path.join(REPO, "docs")
    write(os.path.join(docs, "index.html"), build_standalone(app, pwa=True))
    write(os.path.join(docs, "icon.svg"), ICON)
    write(os.path.join(docs, "manifest.webmanifest"), json.dumps({
        "name": "CekTeks - Cek Plagiarisme & AI", "short_name": "CekTeks", "lang": "id",
        "start_url": "./", "scope": "./", "display": "standalone",
        "background_color": "#eef2f6", "theme_color": "#0e6a86",
        "icons": [{"src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"}],
    }, indent=2, ensure_ascii=False))
    write(os.path.join(docs, "sw.js"), read(os.path.join(HERE, "src", "sw.js")))
    write(os.path.join(docs, ".nojekyll"), "")


if __name__ == "__main__":
    main()
