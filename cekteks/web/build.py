"""Bangun CekTeks menjadi aplikasi mandiri.

Hasil:
  ../dist/CekTeks.html     satu file, semua pustaka di dalamnya -> bisa dibuka offline di browser mana pun
  ../../docs/              versi situs web (GitHub Pages/Netlify) + service worker agar bisa dipasang & offline

Jalankan:  python build.py
"""

import json
import re
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # folder cekteks/
REPO = os.path.dirname(ROOT)
# Alamat situs publik (GitHub Pages). Ganti bila situs dipindah ke alamat lain.
SITE_URL = os.environ.get("CEKTEKS_SITE_URL", "https://ferdynandekawijaya92821-create.github.io/kalori-cli/")
SITE_TITLE = "CekTeks - Cek Plagiarisme & Deteksi Tulisan AI"
SITE_DESC = ("Cek plagiarisme dan deteksi tulisan AI gratis. Unggah PDF atau Word, lihat bagian yang mirip "
             "dengan sumbernya, lalu unduh laporan PDF. Bisa offline, naskah tetap privat.")
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
    if pwa:
        head = head.replace("<title>CekTeks</title>", f"<title>{SITE_TITLE}</title>", 1)
        head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{SITE_DESC}">', head, count=1)
    if pwa:
        # Situs web: pustaka besar dimuat dari vendor/ hanya saat dibutuhkan (halaman pertama jauh lebih ringan),
        # lalu disimpan service worker untuk pemakaian offline.
        vendor = '<script>window.CEKTEKS_VENDOR = "vendor/";</script>\n'
    else:
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
        og = SITE_URL + "og-image.png"
        extra += (
            '<link rel="manifest" href="manifest.webmanifest">\n'
            '<link rel="apple-touch-icon" href="icon-180.png">\n'
            f'<link rel="canonical" href="{SITE_URL}">\n'
            '<meta property="og:type" content="website">\n'
            '<meta property="og:locale" content="id_ID">\n'
            '<meta property="og:site_name" content="CekTeks">\n'
            f'<meta property="og:title" content="{SITE_TITLE}">\n'
            f'<meta property="og:description" content="{SITE_DESC}">\n'
            f'<meta property="og:url" content="{SITE_URL}">\n'
            f'<meta property="og:image" content="{og}">\n'
            f'<meta property="og:image:secure_url" content="{og}">\n'
            '<meta property="og:image:type" content="image/png">\n'
            '<meta property="og:image:width" content="1200">\n'
            '<meta property="og:image:height" content="630">\n'
            '<meta property="og:image:alt" content="CekTeks: cek plagiarisme dan deteksi tulisan AI">\n'
            '<meta name="twitter:card" content="summary_large_image">\n'
            f'<meta name="twitter:title" content="{SITE_TITLE}">\n'
            f'<meta name="twitter:description" content="{SITE_DESC}">\n'
            f'<meta name="twitter:image" content="{og}">\n'
        )
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
        "description": SITE_DESC,
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
            {"src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
        ],
    }, indent=2, ensure_ascii=False))
    sw = read(os.path.join(HERE, "src", "sw.js")).replace("/*VENDOR_FILES*/", ", ".join(f'"./vendor/{n}"' for n in VENDOR))
    write(os.path.join(docs, "sw.js"), sw)
    os.makedirs(os.path.join(docs, "vendor"), exist_ok=True)
    for name in VENDOR:
        shutil.copyfile(os.path.join(HERE, "vendor", name), os.path.join(docs, "vendor", name))
    print(f"  docs/vendor/  ({len(VENDOR)} pustaka)")
    write(os.path.join(docs, ".nojekyll"), "")
    for name in ("og-image.png", "icon-180.png", "icon-192.png", "icon-512.png"):
        shutil.copyfile(os.path.join(HERE, "assets", name), os.path.join(docs, name))
        print(f"  docs/{name}")
    write(os.path.join(docs, "robots.txt"), f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}sitemap.xml\n")
    write(os.path.join(docs, "sitemap.xml"),
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          f"  <url><loc>{SITE_URL}</loc></url>\n</urlset>\n")


if __name__ == "__main__":
    main()
