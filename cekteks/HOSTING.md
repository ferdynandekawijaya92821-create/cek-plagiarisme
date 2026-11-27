# Hosting CekTeks: online, offline, dan domain sendiri

CekTeks bisa diakses dengan beberapa cara. Semuanya memakai aplikasi yang sama.

| Cara | Butuh internet? | Cocok untuk |
|---|---|---|
| Situs web (GitHub Pages, HTTPS) | Ya, untuk membuka pertama kali | Pengunjung umum, dibuka dari Google |
| Situs yang **dipasang** (tombol *Pasang aplikasi* di browser) | Tidak, setelah dibuka sekali | HP dan laptop pengguna tetap |
| Aplikasi desktop Windows/macOS/Linux dan APK Android (dari halaman *Releases*) | Tidak | Dipakai di kantor atau lab tanpa internet |
| File mandiri `cekteks/dist/CekTeks.html` | Tidak | Dibagikan lewat flashdisk atau email |
| Server lokal: `python3 -m http.server 8080 -d docs`, lalu buka `http://localhost:8080` | Tidak | Uji di komputer sendiri atau jaringan kantor |

Tanpa internet, semua pemeriksaan offline tetap berjalan: kesamaan dengan bank naskah dan sumber sendiri, deteksi AI
statistik, sitasi, kode program, laporan PDF, dan **model AI di perangkat** (kemiripan makna, parafrase, dan terjemahan).
Model AI perlu diunduh sekali, sekitar 120 MB, saat pertama kali dijalankan dengan internet. Setelah itu model
tersimpan di perangkat.

Yang tetap butuh internet:

- pencarian sumber di internet;
- login online;
- analisis Claude.

## Domain sendiri: cekplagiarismeteks.id

GitHub Pages memberi HTTPS gratis (sertifikat Let's Encrypt) untuk domain sendiri. Domain juga menyembunyikan nama
akun GitHub dari alamat situs.

### 1. Beli domain

- Beli di registrar resmi PANDI, misalnya Domainesia, Rumahweb, IDCloudHost, atau Niagahoster.
- Cari `cekplagiarismeteks.id`. Saat dicek pada 27 November 2026, domain ini belum terdaftar. Pastikan lagi di
  registrar.
- Pendaftaran domain `.id` mewajibkan KTP. Biayanya kira-kira Rp200–300 ribu per tahun, tergantung registrar.
- Alternatif yang lebih murah: `cekteks.my.id`, sekitar Rp10–20 ribu per tahun.

### 2. Arahkan DNS ke GitHub Pages

Buka menu **DNS / Kelola DNS** di registrar, hapus catatan A bawaan (*parking*), lalu tambahkan:

| Tipe | Nama | Nilai |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `ferdynandekawijaya92821-create.github.io` |

Perubahan DNS butuh beberapa menit sampai 24 jam.

### 3. Sambungkan di GitHub

1. Buka repositori → **Settings → Pages → Custom domain**. Isi `cekplagiarismeteks.id`, lalu tekan **Save**.
   GitHub memeriksa DNS. Tunggu sampai muncul centang hijau.
2. Centang **Enforce HTTPS**. Sertifikat bisa butuh sampai 1 jam sebelum pilihan ini aktif.
3. Disarankan: buka **Settings (akun) → Pages → Add a domain** dan verifikasi domain lewat catatan TXT. Langkah ini
   mencegah orang lain memakai domain Anda di GitHub.

### 4. Beri tahu CekTeks

Lakukan langkah ini **setelah** situs terbuka di `https://cekplagiarismeteks.id`. Jangan sebelumnya, agar tautan
kanonis dan QR laporan tidak mengarah ke alamat yang belum hidup.

1. Isi `"domain": "cekplagiarismeteks.id"` di `cekteks/web/site.json`, lalu Commit. Tautan kanonis Google, sitemap,
   dan QR verifikasi laporan akan memakai domain baru.
2. Bila login online dipakai, buka Supabase **Authentication → URL Configuration**. Jadikan `https://cekplagiarismeteks.id/`
   sebagai Site URL, lalu tambahkan alamat itu juga di Redirect URLs.
3. Bila analisis Claude dipakai, tambahkan `https://cekplagiarismeteks.id` ke rahasia `ASAL` di Supabase Edge Functions.
4. Di Google Search Console, tambahkan properti baru untuk domain ini, lalu kirim sitemap
   `https://cekplagiarismeteks.id/sitemap.xml`.

Alamat lama `…github.io/cek-plagiarisme/` otomatis dialihkan GitHub ke domain baru.
