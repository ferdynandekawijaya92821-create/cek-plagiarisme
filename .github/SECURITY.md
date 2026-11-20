# Kebijakan keamanan CekTeks

## Melaporkan celah keamanan

Jangan laporkan celah keamanan lewat issue publik. Gunakan **Security → Report a vulnerability** di repositori
ini (laporan privat GitHub). Sertakan langkah untuk memunculkan masalahnya. Kami membalas secepatnya.

## Lapisan perlindungan

| Ancaman | Perlindungan |
|---|---|
| Situs down karena diserbu bot (DDoS) | Situs statis di GitHub Pages yang dilayani CDN global; tidak ada server atau basis data yang bisa dibuat kelebihan beban. Service worker membuat CekTeks tetap jalan offline, dan aplikasi Android/desktop berjalan tanpa situs. |
| Skrip jahat disisipkan (XSS) | Content Security Policy: hanya skrip dengan sidik SHA-256 yang sudah dikenal yang boleh jalan; `object-src`, `base-uri`, dan `frame-src` dimatikan. Semua teks dari luar di-escape. |
| Pustaka CDN diganti penyerang | Versi dipatok, pustaka utama disimpan di repositori ini, dan Tesseract dari CDN diperiksa dengan Subresource Integrity (SHA-384). |
| Situs dibingkai situs lain (clickjacking) | CekTeks menolak tampil di dalam iframe situs lain. |
| PDF/DOCX/ZIP jahat | pdf.js dengan `isEvalSupported: false`; berkas terkompresi yang membengkak (bom ZIP) ditolak; batas ukuran 50 MB. |
| Jembatan disalahgunakan | Wajib `KUNCI`, daftar asal (`ASAL`), pembatas permintaan per IP (`BATAS`), hanya alamat publik http/https, setiap pengalihan diperiksa ulang (anti-SSRF), batas 15 MB dan 25 detik. |
| Aplikasi desktop | Electron dengan `contextIsolation`, `sandbox`, tanpa Node di halaman, izin hanya papan klip, navigasi dan `<webview>` diblokir. |
| Pustaka usang | Dependabot memeriksa pembaruan setiap minggu; CI menguji setiap pembaruan. |

## Versi yang didukung

Hanya versi terbaru di cabang `main` (situs) dan rilis terbaru (aplikasi) yang menerima perbaikan keamanan.
