# Pustaka pihak ketiga di `vendor/`

Disimpan di repositori agar situs dan aplikasi tidak bergantung pada CDN saat berjalan, dan agar isinya tidak bisa
diganti pihak lain. Versi dipatok. Dependabot tidak memantau folder ini, jadi periksa pembaruan berkala.

| Berkas | Paket | Versi | Sumber |
|---|---|---|---|
| `pdf.min.mjs`, `pdf.worker.min.mjs` | pdfjs-dist (build `legacy`, untuk HP lama) | 6.5.438 | `https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/legacy/build/` |
| `mammoth.browser.min.js` | mammoth | 1.13.0 | `https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js` |
| `jszip.min.js` | jszip | 3.10.2 | `https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js` |
| `jspdf.umd.min.js` | jspdf | 4.2.1 | `https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js` |
| `qrcode.js` | qrcode-generator | 2.0.4 | `https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.js` |
| `jsQR.js` | jsqr | 1.4.0 | `https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js` |

Dimuat dari CDN saat dibutuhkan (OCR): tesseract.js 7.0.0, dengan sidik SRI di `TESS_LIB`/`TESS_SRI` di `src/app.html`.

## Memperbarui

1. Unduh berkas versi baru ke `vendor/` dengan nama yang sama, lalu ubah alamat CDN cadangan di `src/app.html`.
2. Untuk Tesseract, hitung sidik baru: `curl -sL <url> | openssl dgst -sha384 -binary | base64`.
3. Jalankan `python build.py` lalu `npm test`. CSP dihitung ulang otomatis saat build.
