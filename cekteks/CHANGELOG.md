# Catatan perubahan CekTeks

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan [Semantic Versioning](https://semver.org/lang/id/).

## [4.8.0] - 2026-11-26
### Ditambahkan
- **Login online dengan Google atau email + kata sandi** (backend Supabase, HTTPS).
  - Daftar, masuk, keluar, dan lupa kata sandi (tautan reset lewat email).
  - Kata sandi disimpan sebagai hash bcrypt oleh Supabase Auth.
  - Riwayat pemeriksaan (ringkasan, bukan isi naskah) dan pesanan layanan tersimpan di akun dan bisa dibuka dari
    perangkat lain.
- **Skema basis data** `cekteks/supabase/skema.sql`:
  - Tabel `profil`, `riwayat`, dan `pesanan` dengan Row Level Security, sehingga setiap pengguna hanya bisa membaca
    dan mengubah barisnya sendiri.
  - Kunci publik (anon) tidak punya akses ke tabel.
  - Pengguna tidak bisa menandai pesanannya sendiri sebagai dibayar.
  - Profil dibuat otomatis saat mendaftar.
- **Uji RLS** `cekteks/supabase/uji.sh` di PostgreSQL sungguhan, ikut dijalankan di CI. Uji ini terbukti gagal bila
  RLS dimatikan.
- **Panduan pemasangan** `cekteks/supabase/PANDUAN.md`: proyek Supabase, login email, Google OAuth, dan kunci yang
  aman.
- **Pengaman kunci**: situs menolak kunci rahasia Supabase (`service_role` / `sb_secret_`) bila tidak sengaja
  dipasang.
- Formulir Pengaturan situs dilengkapi kolom Supabase. Akun offline terenkripsi tetap tersedia lewat
  "Pakai akun offline di perangkat ini".

### Diubah
- **Warna dikunci biru dongker (#1f3363)**. Pilihan warna dihapus dari panel Tampilan, perintah, dan Pengaturan
  situs. Panel Tampilan kini hanya mengatur mode terang/gelap, dengan ikon baru.
- Kebijakan Privasi: bagian Akun menjelaskan data yang disimpan di akun online.

## [4.7.2] - 2026-11-21
### Diubah
- **Kaki halaman ditulis ulang.** Tiga kolom (Layanan, Bantuan, Legal) dan baris "© 2026 CekTeks · Dibuat di
  Indonesia · Tidak berafiliasi dengan Turnitin". Tautan *Kode sumber* ke GitHub dihapus.
- **Kebijakan Privasi dan Syarat & Ketentuan ditulis ulang**, mencakup akun terenkripsi, layanan berbayar, pembayaran
  QRIS, pembatalan dan pengembalian dana, iklan, serta keterangan tidak berafiliasi dengan Turnitin.
- Kontak: tombol *Laporkan masalah* lewat WhatsApp menggantikan tautan GitHub. Tautan panduan jembatan ke GitHub
  dihapus.
- Panel *Pengaturan situs (untuk pemilik)* disembunyikan dari pengunjung. Pemilik membukanya sekali lewat alamat
  `…/#pemilik`, lalu panel tetap tampil di perangkat itu.

## [4.7.1] - 2026-11-21
### Diubah
- Repositori diganti nama menjadi `cek-plagiarisme`. Alamat situs sekarang
  https://ferdynandekawijaya92821-create.github.io/cek-plagiarisme/ dan menjadi alamat bawaan untuk build lokal,
  berkas mandiri, catatan rilis, dan User-Agent jembatan.

## [4.7.0] - 2026-11-21
### Ditambahkan
- **Akun di perangkat (terenkripsi).**
  - Tombol *Masuk* di bilah atas untuk membuat akun (nama dan kata sandi) atau masuk.
  - Naskah, draf, riwayat, bank naskah, pengaturan, dan kunci API sebuah akun dienkripsi dengan AES-256-GCM.
    Kuncinya diturunkan dari kata sandi lewat PBKDF2-SHA256 (250.000 putaran). Tiap akun punya basis data sendiri.
  - Saat membuat akun, data tamu di perangkat bisa dipindahkan ke akun lalu dihapus dari mode tamu.
  - Sesi hanya berlaku di tab itu. Akun terkunci otomatis setelah 30 menit tanpa aktivitas.
  - Tanpa email dan tanpa server: naskah tetap tidak pernah dikirim ke mana pun. Mode tamu tetap tersedia.
- FAQ "Apakah orang lain bisa melihat dokumen saya?" dan bagian Akun di Kebijakan Privasi.
- `cekteks/pengalihan/` untuk meneruskan alamat lama ke alamat baru, agar QR laporan lama tetap bisa diverifikasi.

### Diubah
- Alamat situs dan tautan GitHub diambil otomatis dari nama repositori saat build di GitHub Actions. Mengganti nama
  repositori langsung memperbarui alamat kanonis, sitemap, data terstruktur, dan QR laporan.
- Skrip aplikasi diperkecil saat build (indentasi dibuang). Anggaran ukuran halaman dinaikkan ke 180 KB gzip.

## [4.6.1] - 2026-11-21
### Diubah
- **Harga baru**: Cek Plagiasi Rp3.000/naskah, Cek Plagiasi + AI Rp5.000/naskah, Cek Kode Program Rp1.000/tugas,
  Paket Kelas/Dosen Rp50.000/kelas (hingga 40 naskah).
- **Agar mudah ditemukan di Google**:
  - Judul halaman "Cek Plagiarisme Online & Deteksi AI, Alternatif Turnitin | CekTeks", dan deskripsi yang memuat kata
    kunci serta harga.
  - Judul Beranda "Cek plagiarisme naskah Anda *sebelum* dikumpulkan".
  - Data terstruktur JSON-LD: WebApplication dengan rentang harga, dan FAQPage.
  - Pengunjung tanpa alamat halaman tertentu kini membuka Beranda.
  - CekTeks disebut sebagai *alternatif*, dengan keterangan tidak berafiliasi dengan Turnitin, di Beranda, FAQ, dan
    deskripsi. Turnitin adalah merek dagang pihak lain.

## [4.6.0] - 2026-11-21
### Ditambahkan
- **Pembayaran QRIS di halaman Layanan & Harga.**
  - Setelah mengisi formulir, pelanggan menekan *Bayar dengan QRIS* dan mendapat QR dinamis dengan nominal pas:
    harga × jumlah ditambah kode unik Rp1–299 agar pembayaran mudah dikenali. Ada juga nomor pesanan, tombol
    *Simpan gambar QR* (untuk dibayar dari galeri di HP yang sama), dan *Salin nominal*.
  - Tombol *Saya sudah bayar* membuka WhatsApp CS berisi rincian pesanan.
  - QR dibuat di perangkat dari QRIS statis toko (`pembayaran.qris` di `site.json`), mengikuti standar EMV dengan
    CRC yang diperiksa. Konfirmasi pembayaran tetap manual oleh CS.
- **Harga paket**: Cek Plagiasi Rp10.000/naskah, Cek Plagiasi + AI Rp20.000/naskah, Cek Kode Program Rp15.000/tugas,
  dan Paket Kelas/Dosen Rp150.000/kelas (hingga 40 naskah). Total dihitung langsung di formulir.
- Formulir Pengaturan situs bisa membaca QRIS dari gambar dan menyimpan kode verifikasi Google Search Console
  (`google_verifikasi`, dipasang sebagai meta tag saat build).
- FAQ "Bagaimana cara membayar layanan pemeriksaan?" dan ketentuan pembayaran di Syarat & Ketentuan.

### Diubah
- **Ilustrasi Beranda** dibuat ulang sebagai SVG berskala: sorotan bernomor dan kartu indeks kesamaan, tanpa coretan
  tangan, sehingga tidak bertumpuk di layar mana pun.
- **Menu unduh aplikasi dihapus** dari Beranda, FAQ, Panduan, dan teks berjalan. Aplikasi tetap dibangun dan diuji di
  CI, tetapi rilis publik hanya terbit bila workflow *Aplikasi* dijalankan manual.
- Statistik Beranda menyesuaikan lebar layar.

### Diperbaiki
- Tautan kaki halaman tidak turun baris, sehingga di HP halaman melebar 29px dan tampak mengecil; panel pembayaran
  dan kotak statistik ikut terpotong. Uji tata letak kini membandingkan dengan lebar layar sebenarnya
  (`clientWidth`), sehingga kasus seperti ini tertangkap.
- Ukuran halaman tetap di bawah 160 KB: komentar JavaScript satu baris dan CSS kartu unduh dibuang saat build.

## [4.5.0] - 2026-11-21
### Diubah: tampilan baru
- **Identitas visual baru bergaya editorial**, seperti meja penguji naskah:
  - Latar kertas hangat dan garis tipis menggantikan kartu biru muda yang serba seragam.
  - Huruf: Fraunces untuk judul, Plus Jakarta Sans (karya desainer Indonesia) untuk teks, IBM Plex Mono untuk angka,
    dan Caveat untuk catatan pinggir.
  - Warna tema diganti dengan nada tinta yang lebih dalam: biru tinta, teal, ungu, hijau, marun, terakota, dan grafit.
- **Beranda ditulis ulang.**
  - Judul "Periksa naskah Anda *sebelum* dikumpulkan", dengan ilustrasi lembar naskah bertanda stabilo, catatan
    pinggir tulisan tangan, dan stempel skor.
  - Empat keterangan singkat yang jujur, menggantikan kotak statistik kosong. Statistik baru tampil setelah ada
    riwayat.
  - Daftar alat bernomor, seperti daftar isi buku.
- Menu samping tanpa label "Baru" di setiap baris, dan halaman aktif ditandai garis tepi.
- Teks berjalan bergaya baris kabar koran. Banner iklan berupa kartu kertas tanpa gradasi.
- Tombol chat menjadi pil berlabel "Tanya kami". Emoji di chat dihapus.
- Kaki halaman memuat kolofon "Dibuat di Indonesia".
- Logo baru: lembar naskah dengan tanda centang, dan wordmark Cek*Teks* berhuruf serif.
- CSS diperkecil otomatis saat build.

## [4.4.0] - 2026-11-20
### Keamanan
- **Content Security Policy** di situs, berkas mandiri, dan aplikasi. Skrip hanya jalan bila sidik SHA-256-nya sudah
  dikenal (dihitung otomatis saat build). `object-src`, `base-uri`, dan `frame-src` dimatikan, koneksi dipaksa HTTPS,
  dan `Referrer-Policy` diperketat. Uji otomatis membuktikan skrip sisipan (XSS) ditolak.
- **Anti clickjacking**: CekTeks menolak tampil di dalam iframe situs lain.
- **Bom ZIP ditolak**: DOCX, ODT, PPTX, atau ZIP yang membengkak di atas 400 MB atau 20.000 berkas saat dibuka.
- **Tesseract dari CDN diperiksa dengan Subresource Integrity (SHA-384).**
- **Jembatan: celah SSRF lewat pengalihan ditutup.**
  - Setiap pengalihan kini diperiksa ulang (maks. 5).
  - Alamat IPv6 terpetakan dan jaringan operator (100.64.0.0/10) ikut ditolak.
  - Ada pembatas permintaan per IP opsional (`BATAS`, binding Rate Limiting Cloudflare) yang membalas 429.
- **Aplikasi desktop**: izin hanya papan klip dan layar penuh; `<webview>` diblokir.
- **Server Python (opsional)**: berjalan sebagai pengguna non-root di Docker, dengan batas waktu dan ukuran permintaan.
- Dependabot memantau GitHub Actions, npm, dan pip setiap minggu. Kebijakan pelaporan celah ada di `.github/SECURITY.md`.

### Diperbarui
| Komponen | Sebelumnya | Sekarang |
|---|---|---|
| pdf.js (build `legacy`, tetap jalan di HP lama) | 3.11.174 | 6.5.438 |
| mammoth (Word) | 1.6.0 | 1.13.0 |
| jsPDF (laporan) | 2.5.1 | 4.2.1 |
| JSZip | 3.10.1 | 3.10.2 |
| qrcode-generator | 1.4.4 | 2.0.4 |
| tesseract.js (OCR) | 5.1.1 | 7.0.0 |
| Electron (Windows/macOS/Linux) | 33.4.11 | 45.4.1 |
| electron-builder | 25.1.8 | 26.18.0 |
| Capacitor (Android) | 6.2.1 | 8.6.2 (Java 21, Android 7.0+) |
| Playwright / axe-core (uji) | 1.49.1 / 4.10.2 | 1.65.1 / 4.14.1 |
| GitHub Actions | checkout v4, setup-node v4, … | checkout v7, setup-node v7, … (Node 22) |
| Flask / pypdf / python-docx | ≥3.0 / ≥4.0 / ≥1.1 | ≥3.1.3 / ≥7.1.1 / ≥1.2.0, Python 3.13 |

## [4.3.0] - 2026-11-20
### Ditambahkan
- **OCR untuk PDF hasil pindaian.** PDF berupa gambar (scan atau foto) kini dikenali teksnya otomatis dengan
  Tesseract (bahasa Indonesia dan Inggris) di perangkat pengguna.
  - Teks lalu diperiksa seperti biasa, dan posisi kata dicatat sehingga laporan PDF tetap menyorot halaman aslinya.
  - Butuh internet saat pertama kali dipakai untuk mengunduh pustaka dan data bahasa (±5 MB).
  - Keyakinan OCR ditampilkan dan dicatat di laporan.
- **Cek keaslian daftar pustaka.** Setiap entri dicari di Crossref dan OpenAlex lalu diberi tanda:
  - **Terverifikasi**: ditemukan, dengan judul serta penulis atau tahun yang cocok.
  - **Perlu dicek**: judul ditemukan, tetapi penulis atau tahunnya berbeda.
  - **Bermasalah**: DOI tidak terdaftar, atau DOI terdaftar untuk karya lain.
  - **Tidak ditemukan**: tidak ada di kedua basis data.

  Berguna untuk menangkap referensi fiktif buatan AI.
- **Halaman Layanan & Harga.** Kartu paket diambil dari `site.json` (harga boleh kosong, tampil "Tanya harga"), disertai
  formulir pesanan yang membuka WhatsApp atau email CS dengan data pesanan terisi, dan langkah cara memesan.
  Paket juga bisa diatur lewat formulir Pengaturan situs.
- FAQ dan chat CS: pertanyaan tentang PDF hasil scan dan referensi palsu.

### Diperbaiki
- Entri daftar pustaka dengan penulis bernama tunggal (mis. "Sugiyono. (2019)") yang muncul sesudah entri berakhiran
  tautan DOI tidak lagi tergabung ke entri sebelumnya.
- Tombol WhatsApp memakai hijau yang lebih gelap agar kontras teksnya memenuhi WCAG AA.

## [4.2.0] - 2026-11-20
### Ditambahkan
- **Pilihan warna tema**: Teal, Biru, Ungu, Hijau, Marun, Oranye, dan Grafit, masing-masing dengan versi terang dan
  gelap. Tombol palet di kanan atas membuka panel *Tampilan* (mode Otomatis/Terang/Gelap dan warna). Laporan PDF dan
  warna bilah browser ikut menyesuaikan. Warna bawaan situs kini **Biru**.
- **Pengaturan situs `cekteks/web/site.json`** untuk pemilik: warna bawaan, kontak CS (WhatsApp, email, jam layanan,
  sapaan), teks berjalan, dan banner iklan. Ubah berkas ini langsung di GitHub; situs dan aplikasi dibangun ulang
  otomatis. Formulir *Pengaturan situs* di halaman Sumber membantu membuat isinya, dengan pratinjau di perangkat sendiri.
- **Iklan berjalan**: bilah info bergerak di atas halaman (berhenti saat disentuh atau disorot, bisa ditutup, diam bila
  perangkat meminta gerakan dikurangi) dan **slot banner bergilir** di Beranda, panel hasil, dan halaman Bantuan.
  Iklan bawaan berisi promosi layanan dan fitur CekTeks sendiri.
- **Bubble chat customer service** di pojok kanan bawah: asisten menjawab otomatis 17 pertanyaan umum, lalu
  meneruskan ke WhatsApp CS (pertanyaan ikut terisi) atau email bila kontak diisi di `site.json`.
- **Halaman Bantuan & Kontak**: FAQ yang bisa dicari, kontak CS, **Kebijakan Privasi**, dan **Syarat & Ketentuan**.
  Tautannya juga ada di footer.
- **Pengecualian sumber permanen** (seperti *exclude sources* di layanan pemeriksa resmi): daftar domain atau alamat
  yang selalu diabaikan di setiap pemeriksaan, plus tombol *Abaikan selalu* di panel Bandingkan. Tercatat di laporan.
- **Perbandingan dengan pemeriksaan sebelumnya**: bila dokumen bernama sama pernah diperiksa, panel hasil menampilkan
  skor lama dan selisihnya, mis. "32% → sekarang 18%, turun 14 poin".

### Diubah
- `pages.yml` membangun situs sebelum menayangkan, dan `apps.yml` membangun `CekTeks.html` sebelum membuat aplikasi,
  sehingga perubahan `site.json` langsung terbit. Pemeriksaan "hasil build sudah di-commit" di CI kini hanya untuk
  pull request.

## [4.1.0] - 2026-11-20
### Ditambahkan
- **Cek plagiasi kode program** (menu baru), untuk tugas pemrograman:
  - Mendukung Python, Jupyter Notebook, Java, C/C++, C#, JavaScript/TypeScript, PHP, Go, Kotlin, Swift, Rust,
    Dart, Ruby, R, MATLAB, SQL, dan HTML/CSS.
  - Kode diubah menjadi token: komentar dibuang, nama variabel/fungsi disamakan, teks dan angka dinormalkan.
    Lalu k-gram berurutan dibandingkan (cara MOSS/JPlag), sehingga mengganti nama variabel, mengubah komentar,
    atau merapikan spasi tidak menyembunyikan salinan. Operator `//` Python tidak dianggap komentar.
  - ZIP dengan satu folder per mahasiswa menjadi satu kiriman per folder; `__MACOSX`, `.git`, dan
    `node_modules` dilewati.
  - Kode template dosen bisa dimuat: bagiannya tidak dihitung, dan persentase dihitung dari kode di luar template.
  - Tiga kepekaan, matriks kemiripan, daftar pasangan, dan ekspor CSV.
  - Penampil berdampingan **bertema VS Code Dark+**: nomor baris, pewarnaan sintaks, blok sama bernomor dan
    berwarna, serta lompat ke blok.
  - Uji berkas: salinan dengan nama variabel diganti 90%, program berbeda 8% (dengan template).
- **Aplikasi Android, Windows, macOS, dan Linux** (`cekteks/app/`):
  - Capacitor dan Electron membungkus CekTeks.html sehingga berjalan offline.
  - Dibangun dan diterbitkan otomatis di GitHub Releases (`.github/workflows/apps.yml`) dengan nama berkas tetap.
  - Kartu **Pasang CekTeks sebagai aplikasi** di Beranda menonjolkan platform pengguna dan menyertakan panduan
    memasang.
  - Di Android, unduhan laporan disimpan lewat menu Bagikan/Simpan, dan tautan luar dibuka di browser.
  - Di desktop, tautan luar dibuka di browser biasa.
  - Aplikasi Linux sudah dibangun dan dijalankan di sini (Electron 33): halaman terbuka dan analisis offline
    berjalan.

### Lainnya
- Uji e2e menjadi 44 skenario. Audit tata letak dan WCAG kini juga mencakup Periksa Banyak Dokumen, Cek Kode,
  dan Sitasi.

## [4.0.0] - 2026-11-19
### Ditambahkan
- **Periksa banyak dokumen**:
  - Unggah hingga 40 naskah sekaligus.
  - Tiap naskah dibandingkan dengan sumber offline, bank naskah, dan **naskah lain di antrian**, sehingga tugas
    yang saling menyalin langsung ketahuan.
  - Angka ringkasan: rata-rata kesamaan, naskah yang belum lolos batas, dan naskah yang saling mirip.
  - Satu klik untuk membuka naskah di pemeriksa lengkap.
  - Ekspor CSV, dan **semua laporan PDF dalam satu ZIP**. Laporannya ikut tercatat di Riwayat, dan naskah yang
    sedang dibuka dikembalikan setelah ZIP selesai.
- **Buat sitasi & daftar pustaka**:
  - Cari dengan DOI, tautan, atau judul lewat Crossref, atau isi manual (artikel, buku, situs web, skripsi).
  - Gaya **APA 7, IEEE, Harvard, MLA 9, dan Chicago** (penulis-tahun), lengkap dengan contoh sitasi di naskah.
  - Urut otomatis; bisa disalin atau diunduh sebagai Word dengan indentasi gantung.
  - Tombol **Sitasi** pada setiap sumber yang cocok.
- **Cara memperbaiki** di panel Bandingkan:
  - "Jadikan kutipan + sitasi" mengubah bagian yang sama menjadi kutipan bertanda petik dengan sitasi APA,
    lalu sumbernya masuk daftar pustaka. Skor kesamaan turun karena kutipan dikecualikan.
  - "Tambahkan sitasi saja", terutama untuk parafrase.
- **Batas kesamaan kampus/instansi** (%), diatur di tab Sumber:
  - Status "Lolos" atau "Belum lolos" tampil di panel hasil, sampul laporan PDF (beserta garis batas di skala),
    laporan teks, dan pemeriksaan massal.
- **Palet perintah** (Ctrl/⌘+K, dan kotak pencarian di bilah atas): cari menu dan perintah, lalu jalankan
  dengan Enter.
- Tombol **Pasang aplikasi** (PWA) di menu samping, bila browser mendukung.

### Diubah
- Tes ukuran halaman kini memakai ukuran terkompresi yang benar-benar diunduh browser: di bawah 160 KB
  (saat ini ±125 KB).
- Uji e2e menjadi 43 skenario.

## [3.9.0] - 2026-11-19
### Ditambahkan
- **Teks lengkap sumber**: sumber tidak lagi hanya dibandingkan abstraknya.
  - **Zenodo** (PDF) dan **Europe PMC** (teks lengkap artikel terbuka) diunduh langsung dari browser.
  - Diuji dengan data asli: sebuah makalah Indonesia di Zenodo terunduh 2.625 kata (sebelumnya hanya abstrak),
    dan satu artikel Europe PMC terunduh 11.762 kata.
- **Jembatan** (`cekteks/jembatan/`): Cloudflare Worker gratis milik pengguna, dengan panduan pasang ±5 menit.
  - Keamanan: wajib kunci, hanya http/https publik, batas 15 MB dan 25 detik, cache 1 hari, bisa dibatasi ke
    asal situs sendiri.
  - Bila jembatan aktif, CekTeks mengunduh teks lengkap (PDF/HTML) artikel yang ditemukan OpenAlex, Semantic
    Scholar, DOAJ, Crossref, OpenAIRE, dan CORE.
  - Halaman hasil Google (Serper) bisa diambil isinya tanpa Tavily.
  - Sumber yang kalimatnya terbukti ada di dalamnya didahulukan. Batasnya 4, 12, atau 24 dokumen sesuai
    kedalaman pencarian.
- **Repositori kampus (EPrints)** lewat jembatan:
  - Pencarian JSON di 9 repositori bawaan: UIN Sunan Kalijaga, UMS, UMM, UIN Ar-Raniry, IAIN Surakarta,
    Undiksha, UIN Suska, UNY, dan Unram. Daftarnya bisa diubah di tab Sumber.
  - Berkas PDF berstatus publik diunduh dan dibandingkan; berkas khusus staf dilewati.
- Laporan mencatat jumlah dokumen yang diunduh utuh.

### Diperbaiki
- Teks lengkap kini ditambahkan ke abstrak, bukan menggantikannya. Berkas repositori sering hanya berisi BAB I,
  sehingga kecocokan di abstrak sebelumnya bisa hilang.
- Sumber dengan tautan teks lengkap tidak lagi dibuang hanya karena abstraknya pendek.

### Lainnya
- Uji jembatan (9 skenario, Node) masuk CI.
- Uji e2e menjadi 40 skenario. Skenario baru: jembatan, EPrints, PDF skripsi, dan Zenodo PDF.

## [3.8.0] - 2026-11-18
### Diubah: tampilan dasbor
- **Menu samping**:
  - Grup menu: Pemeriksaan, Alat naskah, dan Kelola.
  - Di desktop selalu tampil; di HP dibuka lewat tombol menu dan tertutup otomatis setelah memilih atau menekan Esc.
  - Bilah atas desktop menampilkan judul halaman.
- **Beranda baru**:
  - Unggah dokumen, tempel teks, atau coba contoh.
  - Statistik pemeriksaan dan kartu tiap alat.
  - Daftar pemeriksaan terakhir.
- Menu **Cek Sitasi** dan **Keterbacaan** langsung membuka kartu terkait di panel hasil.

### Diubah: laporan PDF
- **Halaman ringkasan baru**:
  - Kartu indeks kesamaan dengan skala 0–100.
  - Rincian per jenis sumber, beserta jumlah sumbernya.
  - Empat angka: sumber cocok, kata yang sama, kata diperiksa, dan kemungkinan AI.
  - Kartu detail dokumen.
  - Kartu opsi pengecualian (kutipan, daftar pustaka, kecocokan kecil, sumber kecil, parafrase).
  - Kotak verifikasi ber-QR.
- **Daftar sumber** berbentuk tabel dengan kolom jumlah kata dan persentase, beserta bilah.
- **Nomor sumber di naskah** kini ditempel tepat di atas awal kecocokan, bukan di margin.
- **Naskah yang disusun ulang** dibuat rata kiri-kanan.
- **Setiap halaman memuat QR verifikasi kecil** dan nomor halaman di pojok kanan bawah.

### Ditambahkan
- **Teks tersembunyi & typo**:
  - Karakter tak terlihat (ZWSP, ZWJ, soft hyphen, dan lainnya).
  - Kata bercampur huruf Kiril atau Yunani.
  - Spasi khusus.
  - Teks putih, bertanda tersembunyi, atau sangat kecil di DOCX.
  - Teks sangat kecil atau di luar halaman di PDF.
  - Kata ganda, spasi ganda, tanda baca, dan awalan di- yang terpisah.
  - Sekitar 70 kata tidak baku.
  - Huruf kecil di awal kalimat.
  - Tombol "Lihat" melompat ke naskah, dan "Bersihkan" menghapus karakter tersembunyi.
- **Buat daftar isi**:
  - Mengenali BAB, subbab bernomor dan berhuruf, serta judul baku.
  - Nomor halaman diambil dari PDF (bisa digeser) atau diperkirakan untuk Word.
  - Hasilnya bisa disalin atau diunduh sebagai Word dengan titik penghubung.

### Diperbaiki
- Uji e2e menjadi 39 skenario. Skenario baru:
  - menu samping, termasuk di HP;
  - teks tersembunyi, dengan berkas uji DOCX berisi teks putih dan tersembunyi;
  - daftar isi.
- Audit WCAG kini juga mencakup halaman baru.

## [3.7.0] - 2026-11-18
### Ditambahkan: fitur untuk instansi
- **Kode verifikasi dan QR** di sampul setiap laporan PDF, juga di laporan Word dan TXT.
  - Kodenya berupa sidik SHA-256 isi naskah.
  - Memindai QR membuka halaman **Verifikasi laporan**: naskah diunggah atau ditempel, lalu dicocokkan dengan
    kode, sehingga ketahuan bila naskah diubah setelah diperiksa. Semua berjalan di perangkat.
- **Tanda tangan digital instansi** (HMAC-SHA256) dengan kunci rahasia instansi.
  - Staf dapat memastikan laporan asli dan skor, tanggal, serta ID-nya tidak diubah.
  - Data yang dipalsukan membuat tanda tangan gagal.
- **Logo instansi** tampil di kepala dan kaki setiap halaman laporan PDF, menggantikan merek CekTeks.
- Tombol **Verifikasi laporan** di halaman Riwayat. Riwayat juga mencatat kode verifikasi tiap laporan.
- Filter **Abaikan sumber kecil** (di bawah 1%, 2%, atau 5%). Skor dihitung ulang tanpa sumber itu, dan
  pengaturannya tercatat di laporan.
- Kartu panduan **Untuk instansi**.

### Ditambahkan: sumber (menjadi 19)
- **PLOS**: frasa persis di teks lengkap artikel. Hanya untuk naskah berbahasa Inggris.
- **Zenodo**: repositori terbuka, banyak makalah pendidikan Indonesia.
- **DataCite**: DOI repositori kampus, data penelitian, dan prosiding.
- **LangSearch**: mesin pencari web kedua, memakai API key gratis.
- PLOS, Zenodo, dan DataCite sudah dicoba langsung dari situs asli (CORS lolos).

### Diperbaiki
- Tautan bertanda `#...=` tidak lagi dianggap nama halaman saat situs dibuka.

### Lainnya
- Uji e2e menjadi 36 skenario. Skenario baru:
  - verifikasi, termasuk tanda tangan salah dan data palsu;
  - PDF berlogo dan ber-QR;
  - filter sumber kecil;
  - PLOS, Zenodo, DataCite, dan LangSearch.

## [3.6.0] - 2026-11-18
### Ditambahkan
- Sumber cek internet diperluas menjadi 15, dikelompokkan dalam panel "Sumber pencarian" yang bisa dilipat.
- **Ensiklopedia dan buku**:
  - **Wikibooks** dan **Wikisource** Indonesia (modul, buku pelajaran, naskah sumber), dicari dengan frasa persis.
- **Jurnal dan repositori**:
  - **OpenAIRE** memanen jurnal OJS dan repositori, termasuk banyak kampus di Indonesia.
  - **Europe PMC** mencari frasa persis di teks lengkap artikel. Hanya dipakai untuk naskah berbahasa Inggris.
  - **CORE** mencari di repositori universitas dan memakai teks lengkapnya bila tersedia. Perlu API key gratis.
- **Web umum (blog, berita, situs kampus)**, dengan API key gratis milik pengguna:
  - **Google lewat Serper**: frasa persis, 2.500 pencarian gratis.
  - **Tavily**: pencarian web yang langsung mengambil isi halaman, 1.000 kredit gratis per bulan. Bila dipakai
    bersama Serper, isi halaman hasil Google ikut diambil, sehingga seluruh halaman dibandingkan, bukan hanya cuplikannya.
- Bila kunci ditolak atau kuota habis, mesin itu berhenti dipakai dan alasannya ditampilkan. Mesin lain tetap jalan.
- `fetchJSON` mendukung POST dan header, serta mengatur jeda per layanan baru.

### Diubah
- Google Custom Search ditandai "lama": Google sudah menutupnya untuk pengguna baru dan akan menghentikannya pada
  1 Januari 2027. Panduan pemasangannya diganti dengan Serper, Tavily, dan CORE.
- Uji e2e menjadi 33 skenario. Skenario baru: Serper + isi halaman Tavily, pencarian Tavily, OpenAIRE, Wikibooks,
  dan kunci CORE yang ditolak.

## [3.5.0] - 2026-11-18
### Ditambahkan
- **Teks lengkap jurnal (OpenAlex)**: kalimat naskah (hingga 20 kata) dicari persis di dalam teks lengkap jutaan
  artikel ilmiah, termasuk jurnal Indonesia, bukan hanya di abstraknya. Bila ditemukan, ujung kalimat ikut
  dikonfirmasi sehingga seluruh kalimat tersorot. Menggantikan pencarian kata kunci OpenAlex.
- Isian **OpenAlex API key** (opsional, gratis) di tab Sumber untuk menaikkan kuota dari ±100 menjadi ±1.000
  pencarian per hari; bila kuota habis, CekTeks memberi tahu dan melanjutkan dengan sumber lain.
- Sinyal manusia baru **"Data & rujukan spesifik"** (angka, data, keterangan atau sitasi dalam kurung).

### Diubah
- **Deteksi AI dikalibrasi ulang** dengan data: 69 teks manusia (48 abstrak jurnal Indonesia terbitan sebelum 2020
  dan 21 artikel Wikipedia Indonesia) dan 38 teks AI (termasuk teks AI bersitasi dan berangka).
  - AUC naik dari 0,947 menjadi 0,997.
  - Teks manusia yang masuk rentang "campuran" turun dari 23 menjadi 6.
  - Tidak ada teks manusia yang mendapat skor 65% ke atas.
- Sinyal "Kosakata" dibalik arahnya: teks AI berbahasa Indonesia ternyata memakai kosakata yang lebih beragam
  (MATTR 0,87 dibanding 0,78 pada tulisan manusia). Bobot sinyal "Pengulangan kata pembuka" diturunkan karena
  justru lebih sering muncul pada tulisan manusia.

### Dicoba, tidak dipakai
- Deteksi AI berbasis model bahasa di browser (Qwen2.5-0.5B, metode Fast-DetectGPT). Unduhannya ±500 MB, tetapi
  pada data yang sama hanya mencapai AUC 0,64, jauh di bawah analisis gaya tulisan. Gemma 3 270M gagal dimuat
  di WebAssembly.

## [3.4.0] - 2026-11-18
### Diperbaiki
- **Cek internet pada naskah panjang**: sebelumnya hanya 6 kalimat yang dicari, berapa pun panjang naskahnya, sehingga
  dokumen puluhan halaman bisa mendapat 0%. Kini kalimat diambil merata dari seluruh naskah (di luar daftar pustaka)
  sesuai kedalaman: Cepat (8), Standar (1 tiap ±150 kata, maks. 30), Mendalam (1 tiap ±70 kata, maks. 60).
  Kalimat bernama, beristilah, atau berangka diutamakan.
- Kata yang terpotong tanda hubung di akhir baris PDF ("fotosin-\ntesis") kini dibaca sebagai satu kata, sehingga
  kecocokan tidak terputus.
- Deteksi AI tidak lagi ikut menilai daftar pustaka, judul, nomor halaman, dan isi tabel. Sinyal yang tidak bisa
  diukur (mis. paragraf pada PDF) tidak lagi dianggap 50%.

### Ditambahkan
- Pencarian frasa persis di Wikipedia untuk tiap kalimat, ditambah pencarian kata kunci tiap bagian naskah
  sehingga artikel bertopik sama diunduh utuh (hingga 40 artikel).
- Sumber baru: **Semantic Scholar** (abstrak jurnal, termasuk banyak jurnal Indonesia).
- Wikipedia hanya dicari dalam bahasa naskah; jeda antar-permintaan per layanan dan coba ulang otomatis bila ditolak
  karena terlalu sering (HTTP 429).
- **Cek otomatis setelah unggah** (bisa dimatikan) dan ajakan "Belum dicek di internet" di ringkasan hasil, supaya
  skor offline tidak disangka hasil akhir. Hasil internet naskah lama dihapus saat dokumen baru diunggah.
- **Peta naskah**: naskah panjang dibagi per ±250 kata; tiap bagian menampilkan kesamaan dan kemungkinan AI,
  dan bisa diketuk untuk melompat ke bagian itu.
- **AI per bagian**: skor AI menggabungkan skor keseluruhan dan skor tiap bagian, sehingga bagian yang ditulis AI
  tidak tenggelam di naskah panjang. Sinyal baru "Pola daftar tiga" dan ±50 frasa khas AI tambahan.
- Laporan mencatat jumlah kalimat yang dicari dan jumlah bagian yang cenderung AI.
- Uji e2e menjadi 30 skenario (naskah ±6.500 kata dengan salinan di bagian akhir).

## [3.3.0] - 2026-11-17
### Ditambahkan
- **Sitasi & daftar pustaka**: mengenali sitasi (Nama, 2020), Nama dkk. (2020), Nama & Nama, 2020, beberapa sitasi
  dalam satu kurung, sitasi yang terpotong baris di PDF, dan sitasi bernomor [1]. Dicocokkan dengan entri Daftar
  Pustaka: sitasi yang mungkin tidak ada di daftar pustaka, entri yang tidak dikutip, dan jumlah bagian yang sama
  dengan sumber yang sudah disertai sitasi. Tercantum juga di laporan PDF, Word, dan TXT.
- **Keterbacaan**: waktu baca, panjang kalimat rata-rata, kalimat ≥ 35 kata (mode sorotan baru "Keterbacaan"),
  dan kata yang paling sering diulang.
- **Kartu hasil**: gambar PNG 1080×1350 berisi ringkasan hasil, identitas jasa, dan klien; di HP langsung bisa dibagikan.
- Uji e2e menjadi 29 skenario.

### Diperbaiki
- Mode sorotan "AI per kalimat" tidak menampilkan apa pun sejak 3.0.0 (galat saat menghitung warna sumber untuk
  sorotan tanpa sumber). Kini diuji otomatis.
- "Abaikan daftar pustaka" ikut mengabaikan semua bagian sesudah daftar pustaka (mis. Lampiran). Kini daftar
  pustaka berakhir di judul besar berikutnya, dan pengenal judul tidak lagi menelan nomor halaman di baris sebelumnya.
- Kartu di panel hasil desktop bisa menyusut dan tertimpa kartu lain ketika panel lebih tinggi dari layar.

## [3.2.0] - 2026-11-17
### Ditambahkan
- **Pembayaran & tagihan** (tanpa server):
  - Pengaturan pembayaran di Riwayat: unggah foto QRIS (dibaca dengan jsQR) atau tempel kodenya; kode diperiksa
    (format EMVCo dan CRC) dan nama merchant ditampilkan. Daftar rekening/e-wallet, kode unik, catatan tagihan.
  - Tombol **Tagih** pada setiap pesanan: QRIS dinamis dengan nominal terisi (tag 54, tag 01 = 12, CRC dihitung ulang),
    total dengan kode unik, salin nomor rekening, pesan WhatsApp siap kirim, unduh gambar QR, unduh tagihan PDF, tandai lunas.
  - Nomor tagihan (INV-YYYYMMDD-xxxxx), nomor WhatsApp klien, kode unik, dan total ikut di ekspor Excel.
- Pustaka baru: qrcode-generator (MIT) dan jsQR (Apache-2.0), dimuat saat dibutuhkan dan tersimpan untuk offline.
- Uji e2e menjadi 25 skenario, termasuk memindai QR di tagihan untuk memastikan nominal dan CRC benar.

### Catatan
- Konfirmasi pembayaran tetap manual. Gateway otomatis (Midtrans, Xendit, dll.) memerlukan server untuk menyimpan
  kunci rahasia dan menerima webhook, sehingga tidak dipasang di situs statis ini.

## [3.1.0] - 2026-11-17
### Ditambahkan
- **Perbandingan berdampingan**: tombol "Bandingkan" pada setiap sumber membuka panel berisi bagian naskah dan
  bagian sumber yang sama secara berdampingan. Untuk parafrase, kata dasar yang sama disorot di kedua sisi.
- **Abaikan sumber**: sumber yang tidak relevan bisa dikecualikan; skor dihitung ulang, sumber bisa dikembalikan,
  dan daftar sumber yang diabaikan tercantum di laporan.
- **Riwayat & pesanan** (tab baru): setiap unduhan laporan PDF tercatat (klien, dokumen, skor, AI). Tarif default,
  status lunas/belum dibayar, catatan, ringkasan pendapatan bulan ini dan tagihan, pencarian, saringan, ekspor CSV untuk Excel.
- Panduan "Untuk jasa pengecekan"; uji e2e menjadi 23 skenario.

## [3.0.0] - 2026-11-16
### Ditambahkan
- **Deteksi parafrase**: kata dasar bahasa Indonesia/Inggris dan daftar sinonim; kalimat yang kata dasarnya
  sebagian besar sama dengan kalimat sumber ditandai sebagai parafrase (garis putus-putus), terpisah dari
  kecocokan persis. Skor dirinci: % sama persis + % parafrase. Bisa dimatikan di Pengaturan.
- **Bank naskah**: naskah yang diperiksa bisa disimpan (IndexedDB, di perangkat), lalu setiap naskah baru otomatis
  dibandingkan dengan seluruh isi bank. Ekspor/impor, pencarian, hapus, kosongkan, dan simpan otomatis saat unggah.
- **Cek internet ke DOAJ dan Crossref** (termasuk banyak jurnal Indonesia), di samping Wikipedia, OpenAlex, Google.
- **Identitas jasa**: nama jasa, kontak, dan nama klien tampil di sampul dan kaki halaman laporan.
- **Metode & cakupan** di laporan: cara pencocokan, jumlah dokumen pembanding per jenis, mesin pencari yang dipakai,
  dan pernyataan bahwa CekTeks tidak terhubung dengan basis data Turnitin.
- Uji e2e baru (20 skenario): parafrase, bank naskah, DOAJ/Crossref (respons tiruan), identitas jasa.

### Diubah
- Kelompok kecocokan kini empat: sumber internet, publikasi, bank naskah, karya pengguna.
- Kaki halaman laporan dua baris agar identitas jasa tidak menumpuk dengan nomor halaman.

## [2.4.0] - 2026-11-15
### Ditambahkan
- Ikon di setiap judul kartu (Cek di internet, Sumber, Analisis gaya tulisan, Pengaturan, dan lainnya).
- Berkas bisa dijatuhkan di mana saja pada halaman Periksa, dengan lapisan "Lepaskan untuk memeriksa".
- Bilah progres saat membaca PDF per halaman.
- Kartu "Laporan kesamaan" dengan ikon PDF dan ringkasan isi laporan.
- Ilustrasi baru pada area unggah yang masih kosong.

### Diubah
- Angka skor berhitung naik bersama animasi cincinnya.

## [2.3.0] - 2026-11-15
### Diperbaiki
- Di HP, footer menimpa kartu "Cek di internet" dan panel hasil. Penyebabnya aturan tinggi maksimum panel
  yang seharusnya hanya untuk desktop ikut berlaku di HP.

### Ditambahkan
- Di HP, halaman Periksa dibagi dua tab: Naskah dan Hasil (skor tampil di tombol tab).
- Mengetuk sumber di tab Hasil langsung membuka naskah dan menggulir ke bagian yang disorot.
- Uji otomatis baru: footer tidak boleh menimpa kartu, di setiap halaman dan kedua tab HP.

### Diubah
- Rincian sinyal AI dan frasa dilipat di HP (terbuka otomatis di desktop).

## [2.2.0] - 2026-11-15
### Diubah
- Naskah di mode Tinjau tampil sebagai lembar kertas di atas meja, dengan huruf serif yang nyaman dibaca.
- Nomor sumber pindah ke margin kiri naskah (seperti laporan PDF) dan bisa diketuk untuk menyorot sumber itu.
- Panel hasil dibuka dengan ringkasan satu kalimat; cincin skor bergerak halus saat nilainya berubah.
- Kepala halaman dan navigasi bawah HP semi-transparan dengan efek blur.
- Latar halaman bergradasi lembut, efek hover/klik pada tombol dan kartu, notifikasi dengan penanda.

## [2.1.0] - 2026-11-15
### Ditambahkan
- Pengujian otomatis ujung-ke-ujung (Playwright) dan audit aksesibilitas WCAG 2.1 AA (axe-core).
- Pemeriksaan otomatis (CI) di GitHub Actions untuk setiap pull request.
- Indikator proses saat membaca berkas, termasuk progres per halaman PDF.
- Footer berisi versi, tautan Panduan, Privasi, dan kode sumber.
- Kartu Privasi di Panduan beserta tombol "Hapus data tersimpan".
- Batas ukuran berkas 50 MB dengan pesan yang jelas, serta penanganan error yang ramah.

### Diubah
- Situs web jauh lebih ringan: halaman pertama 160 KB (sebelumnya 2,6 MB). Di jaringan 3G waktu buka turun dari sekitar 14 detik menjadi sekitar 1 detik.
- Pustaka PDF/Word/laporan dimuat saat dibutuhkan dan disimpan untuk pemakaian offline.
- Pembacaan PDF di situs berjalan di latar belakang (web worker) sehingga layar tetap responsif.
- Warna peringatan dan ikon berkas memenuhi rasio kontras WCAG.

## [2.0.0] - 2026-11-15
### Ditambahkan
- Pratinjau tautan untuk WhatsApp dan media sosial, ikon PNG, sitemap, dan robots.txt.
- Navigasi bawah di HP, halaman Panduan, petunjuk untuk pengguna baru.
- Ruang kerja dokumen dengan mode Tulis/Tinjau, seret-lepas berkas, mode gelap.
- Laporan PDF bergaya laporan kesamaan dengan halaman asli dokumen yang disorot per sumber.
- Opsi filter: abaikan daftar pustaka, kutipan, dan kecocokan kecil.

## [1.0.0] - 2026-11-13
### Ditambahkan
- Rilis pertama: cek plagiarisme, deteksi tulisan AI, cek di internet, unduh laporan, dan file mandiri offline.
