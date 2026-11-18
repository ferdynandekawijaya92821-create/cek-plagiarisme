# Catatan perubahan CekTeks

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan [Semantic Versioning](https://semver.org/lang/id/).

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
