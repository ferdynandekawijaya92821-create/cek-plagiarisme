# 🔍 CekTeks — Cek Plagiarisme & Deteksi AI

Website + aplikasi (PWA yang bisa dipasang & CLI) untuk:

- **Cek plagiarisme**: membandingkan teks dengan sumber pembanding (teks/berkas yang Anda unggah
  dan korpus lokal), menyorot bagian yang sama, dan menampilkan persentase per sumber.
- **Deteksi teks buatan AI**: estimasi kemungkinan teks ditulis AI berdasarkan analisis gaya tulisan
  (Bahasa Indonesia & Inggris), lengkap dengan skor per kalimat.
- **Bandingkan dokumen**: unggah banyak tugas sekaligus untuk menemukan pasangan yang mirip.

Mendukung berkas `.txt`, `.md`, `.docx`, `.pdf`. Semua diproses secara lokal, tanpa API pihak ketiga.

## ⭐ Aplikasi mandiri (offline, gratis selamanya)

**[`dist/CekTeks.html`](dist/CekTeks.html)** adalah satu file berisi seluruh aplikasi. Simpan di HP atau komputer,
lalu buka dengan browser apa pun (Chrome, Safari, Edge, Firefox). Tidak butuh server, akun, langganan, atau internet.

- Analisis langsung saat mengetik: indeks kesamaan dan kemungkinan AI
- Unggah PDF, Word (.docx/.doc), ODT, PPTX, RTF, HTML, TXT
- **Cek di internet** (saat online): Wikipedia Indonesia & Inggris, jurnal ilmiah OpenAlex, dan Google (opsional, API key gratis 100 pencarian/hari)
- **Unduh laporan PDF** bergaya laporan kesamaan: sampul dengan detail dokumen (ID pemeriksaan, nama file, ukuran,
  jumlah halaman/kata/karakter, tanggal, opsi filter), ringkasan kesamaan dan sumber bernomor berwarna
  (internet / publikasi / karya pengguna), halaman deteksi AI, lalu **halaman asli dokumen** (untuk PDF) dengan
  bagian yang cocok diwarnai sesuai sumbernya dan nomor sumber di margin. File Word/teks disusun ulang dengan sorotan yang sama.
- Opsi filter: abaikan daftar pustaka, abaikan kutipan, abaikan kecocokan kecil
- Unduh juga sebagai Word atau TXT
- Bandingkan banyak dokumen sekaligus

**Situs sendiri yang bisa dipasang di HP:** folder [`docs/`](../docs) siap untuk GitHub Pages
(Settings → Pages → Branch `main`, folder `/docs`) atau Netlify (seret folder `docs`). Setelah dibuka
sekali, situs tetap jalan offline dan bisa dipasang lewat menu browser "Tambahkan ke layar utama".

Kode sumber halaman ada di `web/src/app.html`; jalankan `python web/build.py` untuk membangun ulang.
Pustaka pihak ketiga di `web/vendor/`: pdf.js (Apache-2.0), mammoth (BSD-2), JSZip (MIT), jsPDF (MIT).

## Instalasi

```bash
cd cekteks
pip install -r requirements.txt
```

## 1. Website / aplikasi

```bash
python app.py          # buka http://localhost:5000
```

- **Periksa Teks**: tempel teks atau unggah berkas → pilih *Keduanya / Plagiarisme / Deteksi AI* → **Periksa Sekarang**.
  Tambahkan sumber pembanding di bagian “Sumber pembanding”.
- **Bandingkan Dokumen**: seret beberapa berkas, lalu klik **Bandingkan**.
- Hasil bisa diunduh (JSON) atau dicetak ke PDF.
- **Pasang sebagai aplikasi**: di Chrome/Edge/Android klik tombol **⬇ Pasang Aplikasi** (atau menu
  “Install app / Tambahkan ke layar utama”). Fitur pemasangan butuh HTTPS atau `localhost`.

Produksi (Docker):

```bash
docker build -t cekteks . && docker run -p 8000:8000 cekteks
```

## 2. Aplikasi baris perintah (CLI)

```bash
python -m cekteks cek esai.docx -s sumber1.txt -s jurnal.pdf -m -k   # plagiarisme + AI
python -m cekteks plagiat esai.txt -n 4 -m                          # plagiarisme saja
python -m cekteks ai esai.txt -k                                    # deteksi AI, skor per kalimat
python -m cekteks bandingkan tugas/*.docx                           # bandingkan antar dokumen
python -m cekteks --json ai esai.txt                                # keluaran JSON
python -m cekteks web --port 8080                                   # jalankan website
```

## API

| Metode | Endpoint | Body |
|---|---|---|
| POST | `/api/check` | `{"text": "...", "mode": "both\|plagiarism\|ai", "sources": [{"name","text"}], "use_corpus": true, "ngram": 5}` |
| POST | `/api/compare` | `{"docs": [{"name","text"}, ...]}` |
| POST | `/api/extract` | multipart `file` → `{"text"}` |
| GET | `/api/health` | — |

## Cara kerja

**Plagiarisme** — teks dipecah menjadi rangkaian *n* kata (n-gram, default 5). Rangkaian yang juga ada
di sumber ditandai cocok; skor = % kata yang termasuk bagian cocok. Kemiripan kosinus TF-IDF
ditampilkan untuk menangkap kesamaan topik/parafrase ringan. Folder `corpus/` berisi dokumen
pembanding bawaan — isi dengan tugas lama, jurnal, atau artikel rujukan Anda.

**Deteksi AI** — menggabungkan beberapa sinyal: keseragaman panjang kalimat (*burstiness*),
kepadatan frasa klise khas AI, konektor di awal kalimat, keseragaman paragraf, repetisi pembuka
kalimat, keragaman kosakata, dan tingkat informalitas (menurunkan skor).

## ⚠️ Keterbatasan

- Deteksi AI bersifat **probabilistik** dan bisa keliru (mis. tulisan manusia yang sangat formal
  bisa mendapat skor sedang). Jangan jadikan satu-satunya dasar keputusan.
- Cek plagiarisme **tidak mencari di internet**; hanya membandingkan dengan sumber yang diberikan
  dan korpus lokal. Parafrase berat sulit terdeteksi.

## Tes

```bash
pip install pytest && python -m pytest -q tests
```

## Pengembangan

| Bagian | Lokasi |
|---|---|
| Kode sumber halaman (satu berkas HTML/CSS/JS) | `web/src/app.html` |
| Service worker situs | `web/src/sw.js` |
| Pustaka pihak ketiga (versi terkunci) | `web/vendor/` |
| Gambar pratinjau tautan & ikon | `web/assets/` |
| Skrip build | `web/build.py` |
| Hasil build: situs web (GitHub Pages) | `../docs/` |
| Hasil build: file mandiri offline | `dist/CekTeks.html` |
| Uji ujung-ke-ujung | `web/tests/e2e.js` |

Alur kerja:

```bash
# 1. ubah web/src/app.html
python cekteks/web/build.py          # 2. bangun ulang docs/ dan dist/
cd cekteks/web && npm install && npx playwright install chromium
npm test                             # 3. uji di browser (fungsi, offline, tampilan HP, WCAG)
```

Setiap pull request diperiksa otomatis oleh GitHub Actions (`.github/workflows/ci.yml`): uji Python, memastikan hasil
build sudah di-commit, lalu uji ujung-ke-ujung. Setelah di-merge ke `main`, situs diterbitkan otomatis
(`.github/workflows/pages.yml`). Versi aplikasi ada di `APP_VERSION` pada `web/src/app.html`; catat perubahan di `CHANGELOG.md`.
