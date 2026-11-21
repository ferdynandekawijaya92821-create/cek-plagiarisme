"""Bangun CekTeks menjadi aplikasi mandiri.

Hasil:
  ../dist/CekTeks.html     satu file, semua pustaka di dalamnya -> bisa dibuka offline di browser mana pun
  ../../docs/              versi situs web (GitHub Pages/Netlify) + service worker agar bisa dipasang & offline

Jalankan:  python build.py
"""

import base64
import hashlib
import json
import re
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # folder cekteks/
REPO = os.path.dirname(ROOT)
# Alamat situs publik (GitHub Pages). Ganti bila situs dipindah ke alamat lain.
DEFAULT_SITE_URL = "https://ferdynandekawijaya92821-create.github.io/kalori-cli/"
DEFAULT_REPO_URL = "https://github.com/ferdynandekawijaya92821-create/kalori-cli"
# Di GitHub Actions kedua alamat diisi otomatis dari nama repositori, jadi mengganti nama repo
# (Settings -> General -> Repository name) langsung mengubah alamat situs, tautan kanonis, sitemap, dan QR laporan.
SITE_URL = (os.environ.get("CEKTEKS_SITE_URL") or DEFAULT_SITE_URL).rstrip("/") + "/"
REPO_URL = (os.environ.get("CEKTEKS_REPO_URL") or DEFAULT_REPO_URL).rstrip("/")
SITE_TITLE = "Cek Plagiarisme Online & Deteksi AI, Alternatif Turnitin | CekTeks"
SITE_DESC = ("Cek plagiarisme online dan deteksi tulisan AI untuk skripsi, jurnal, dan tugas. Alternatif Turnitin "
             "mulai Rp3.000, laporan PDF ber-QR, bisa dicoba gratis. Tidak berafiliasi dengan Turnitin.")
# Pustaka pihak ketiga (versi tetap, diperbarui lewat cekteks/web/VENDOR.md). pdf.js berbentuk modul ES (.mjs).
VENDOR = ["pdf.min.mjs", "pdf.worker.min.mjs", "mammoth.browser.min.js", "jszip.min.js", "jspdf.umd.min.js", "qrcode.js", "jsQR.js"]
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


# Warna tema yang bisa dipilih di site.json (warna aksen terang). Harus sama dengan PRESET di app.html.
ACCENTS = {"teal": "#0f5f6e", "biru": "#234a8c", "ungu": "#5a3d8f", "hijau": "#23704c", "marun": "#8e2c3b", "oranye": "#a9501c", "grafit": "#2f3338"}


def load_site():
    """Pengaturan situs milik pemilik: warna, kontak CS, dan iklan (cekteks/web/site.json)."""
    site = json.loads(read(os.path.join(HERE, "site.json")))
    site.pop("_petunjuk", None)
    if site.get("warna") not in ACCENTS:
        site["warna"] = "teal"
    return site


def module_inline(name, js):
    """Modul ES pdf.js disisipkan sebagai <script type="module">; ekspornya dijadikan objek global."""
    m = re.search(r"export\s*\{([^{}]*)\};?\s*$", js)
    assert m, name
    if name == "pdf.worker.min.mjs":
        assert "globalThis.pdfjsWorker" in js
        return js[:m.start()]
    pairs = []
    for part in m.group(1).split(","):
        part = part.strip()
        if not part:
            continue
        a, _, b = part.partition(" as ")
        pairs.append(f"{(b or a).strip()}:{a.strip()}")
    return js[:m.start()] + "globalThis.pdfjsLib={" + ",".join(pairs) + "};"


# Kebijakan keamanan konten (CSP). Skrip inline hanya boleh jalan bila sidik SHA-256-nya cocok, sehingga skrip
# yang disuntikkan penyerang (XSS) ditolak browser. Koneksi keluar hanya lewat HTTPS.
CSP = ("default-src 'self'; script-src 'self' {hashes} https://cdn.jsdelivr.net 'wasm-unsafe-eval'; "
       "worker-src 'self' blob: https://cdn.jsdelivr.net; connect-src 'self' https: data: blob:; "
       "img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' data: https://fonts.gstatic.com; media-src 'self' blob: data:; object-src 'none'; "
       "base-uri 'none'; form-action 'self'; frame-src 'none'; manifest-src 'self'; upgrade-insecure-requests")


def jsonld(site):
    """Data terstruktur untuk Google: aplikasi web, harga layanan, dan tanya-jawab utama."""
    prices = [int(re.sub(r"\D", "", str(p.get("harga", "")))) for p in site.get("layanan", {}).get("paket", []) if re.sub(r"\D", "", str(p.get("harga", "")))]
    app = {"@type": "WebApplication", "name": "CekTeks", "alternateName": ["CekTeks Cek Plagiarisme", "Cek Plagiasi Online CekTeks"],
           "url": SITE_URL, "description": SITE_DESC, "inLanguage": "id", "applicationCategory": "EducationalApplication",
           "operatingSystem": "Web, Android, Windows, macOS, Linux", "browserRequirements": "Requires JavaScript",
           "offers": {"@type": "AggregateOffer", "priceCurrency": "IDR", "lowPrice": min(prices) if prices else 0, "highPrice": max(prices) if prices else 0,
                      "offerCount": len(prices)} if prices else {"@type": "Offer", "price": 0, "priceCurrency": "IDR"}}
    qa = [
        ("Bagaimana cara cek plagiarisme online di CekTeks?", "Unggah PDF atau Word, atau tempel teks. CekTeks membandingkan naskah dengan jurnal, repositori kampus, dan halaman web, menandai kalimat yang mirip beserta sumbernya, lalu membuat laporan PDF."),
        ("Apakah CekTeks sama dengan Turnitin?", "Tidak. CekTeks adalah alternatif untuk cek mandiri dan tidak berafiliasi dengan Turnitin. CekTeks memakai sumber terbuka seperti Wikipedia, OpenAlex, Crossref, DOAJ, dan repositori kampus, sehingga skornya bisa berbeda dengan Turnitin."),
        ("Berapa biaya cek plagiarisme di CekTeks?", "Pemeriksaan mandiri bisa dicoba gratis. Jasa pemeriksaan dengan laporan dari kami mulai Rp3.000 per naskah, dibayar lewat QRIS."),
        ("Apakah CekTeks bisa mendeteksi tulisan AI seperti ChatGPT?", "Bisa memperkirakan. CekTeks menilai gaya tulisan per bagian naskah dan menandai bagian yang terbaca seperti buatan AI. Hasilnya perkiraan, bukan bukti pasti."),
    ]
    faq = {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qa]}
    return {"@context": "https://schema.org", "@graph": [app, faq]}


def add_csp(html):
    hashes = []
    for m in re.finditer(r"<script(?: type=\"module\")?>(.*?)</script>", html, re.S):
        hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'")
    meta = ('<meta http-equiv="Content-Security-Policy" content="' + CSP.format(hashes=" ".join(sorted(set(hashes)))) + '">\n'
            '<meta name="referrer" content="strict-origin-when-cross-origin">\n')
    return html.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + meta, 1)


def minify_css(css):
    """Buang komentar dan spasi berlebih di CSS (hanya di hasil build; sumber tetap rapi dibaca)."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};,>])\s*", r"\1", css)
    return css.replace(";}", "}").strip()


def build_standalone(app, pwa, site):
    accent = ACCENTS[site["warna"]]
    app = app.replace(DEFAULT_SITE_URL, SITE_URL).replace(DEFAULT_REPO_URL, REPO_URL)
    st = app.index("<style>") + len("<style>")
    en = app.index("</style>")
    app = app[:st] + "\n" + minify_css(app[st:en]) + "\n" + app[en:]
    # Komentar JavaScript satu baris penuh dibuang dari skrip aplikasi (aman: skrip tidak memakai template literal).
    js0 = app.index('<script>\n"use strict";')
    js1 = app.index("</script>", js0)
    script = app[js0:js1]
    script = re.sub(r"(?m)^[ \t]*//[^\n]*\n", "", script)
    script = re.sub(r"(?m)^[ \t]+", "", script)  # indentasi awal baris (tidak ada string yang melintasi baris)
    app = app[:js0] + script + app[js1:]
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
            if name.endswith(".mjs"):
                vendor += f'<script type="module">/* {name} */\n{module_inline(name, js)}\n</script>\n'
            else:
                vendor += f"<script>/* {name} */\n{js}\n</script>\n"
    marker = '<script>\n"use strict";'
    assert body.count(marker) == 1
    cfg = json.dumps(site, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    body = body.replace(marker, vendor + "<script>window.CEKTEKS_SITE = " + cfg + ";</script>\n" + marker)
    icon = ICON.replace("#0e6a86", accent)
    extra = (f'<meta name="theme-color" content="{accent}">\n'
             '<link rel="icon" href="data:image/svg+xml,' + icon.replace('"', "'").replace("#", "%23") + '">\n')
    gv = re.sub(r"[^\w-]", "", str(site.get("google_verifikasi") or ""))
    if pwa and gv:
        extra += f'<meta name="google-site-verification" content="{gv}">\n'
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
            + '<script type="application/ld+json">' + json.dumps(jsonld(site), ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
            f'<meta name="twitter:title" content="{SITE_TITLE}">\n'
            f'<meta name="twitter:description" content="{SITE_DESC}">\n'
            f'<meta name="twitter:image" content="{og}">\n'
        )
    return add_csp(f'<!doctype html>\n<html lang="id" data-accent="{site["warna"]}">\n<head>\n<meta charset="utf-8">\n'
                   '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                   + extra + head + "\n</head>\n<body>\n" + body + "\n</body>\n</html>\n")


def main():
    app = read(os.path.join(HERE, "src", "app.html"))
    site = load_site()
    print("Membangun CekTeks:")
    write(os.path.join(ROOT, "dist", "CekTeks.html"), build_standalone(app, pwa=False, site=site))

    docs = os.path.join(REPO, "docs")
    write(os.path.join(docs, "index.html"), build_standalone(app, pwa=True, site=site))
    write(os.path.join(docs, "icon.svg"), ICON.replace("#0e6a86", ACCENTS[site["warna"]]))
    write(os.path.join(docs, "manifest.webmanifest"), json.dumps({
        "name": "CekTeks - Cek Plagiarisme Online & AI", "short_name": "CekTeks", "lang": "id",
        "start_url": "./", "scope": "./", "display": "standalone",
        "background_color": "#eef2f6", "theme_color": ACCENTS[site["warna"]],
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
