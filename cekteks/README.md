# 🔍 CekTeks — Cek Plagiarisme & Deteksi AI

Website + aplikasi (PWA yang bisa dipasang & CLI) untuk:

- **Cek plagiarisme**: membandingkan teks dengan sumber pembanding (teks/berkas yang Anda unggah
  dan korpus lokal), menyorot bagian yang sama, dan menampilkan persentase per sumber.
- **Deteksi teks buatan AI**: estimasi kemungkinan teks ditulis AI berdasarkan analisis gaya tulisan
  (Bahasa Indonesia & Inggris), lengkap dengan skor per kalimat.
- **Bandingkan dokumen**: unggah banyak tugas sekaligus untuk menemukan pasangan yang mirip.

Mendukung berkas `.txt`, `.md`, `.docx`, `.pdf`. Semua diproses secara lokal, tanpa API pihak ketiga.

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
