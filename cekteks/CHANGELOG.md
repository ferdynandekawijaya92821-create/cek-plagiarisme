# Catatan perubahan CekTeks

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan [Semantic Versioning](https://semver.org/lang/id/).

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
