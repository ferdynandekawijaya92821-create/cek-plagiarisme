# 💰 Rekap Keuangan

Aplikasi web untuk merekap **pemasukan**, **pengeluaran**, dan **total uang** dari aplikasi keuangan Anda.
Semua data disimpan di browser perangkat Anda sendiri — tidak ada server, tidak ada akun.

- Kode aplikasi: [`docs/keuangan/`](../docs/keuangan/) (ikut tayang di GitHub Pages pada alamat `/keuangan/`)
- Uji mesin pembaca: `node rekap-keuangan/test/core.test.mjs`

## Cara menghubungkan aplikasi keuangan

Kebanyakan aplikasi keuangan (Money Lover, Wallet, Monefy, Spendee, Money Manager, buku kas, mutasi m-banking)
tidak menyediakan API publik, tetapi semuanya bisa **mengekspor CSV/Excel**. Rekap Keuangan menyambung lewat dua cara:

1. **Impor file ekspor** (`.csv`, `.xlsx`, `.json`) — kolom tanggal, jumlah, kategori, akun, dan keterangan dikenali
   otomatis, lalu bisa dikoreksi di layar "Periksa kolom" sebelum diimpor. Mengimpor file yang sama/bertumpuk tidak
   membuat transaksi ganda.
2. **Tautan Google Sheets / CSV online** — jika aplikasi Anda menyinkronkan ke Google Sheets, tempel tautannya
   (sheet dibagikan "Siapa saja yang memiliki link"). Data diambil ulang setiap aplikasi dibuka atau saat menekan
   **Sinkronkan**.

Format yang dikenali: jumlah bertanda (`-25000`), kolom jenis (Income/Expense, Pemasukan/Pengeluaran, CR/DB),
kolom terpisah Pemasukan/Pengeluaran atau Debit/Kredit, angka gaya Indonesia (`Rp 1.250.000,00`) maupun
internasional (`1,250,000.00`), tanggal `dd/mm/yyyy`, `yyyy-mm-dd`, `12 Agu 2024`, dan tanggal Excel.

## Yang ditampilkan

- **Ringkasan**: total pemasukan, pengeluaran, selisih, dan total uang untuk periode pilihan (bulan ini, bulan lalu,
  3 bulan, tahun ini, semua, atau rentang tanggal) dan per akun; grafik bulanan; kategori pengeluaran terbesar dan
  sumber pemasukan.
- **Transaksi**: cari, saring, hapus, catat manual, unduh CSV.
- **Akun & saldo**: saldo awal per akun (agar total uang sama dengan saldo sebenarnya), cadangan/pulihkan JSON.

Transfer antar-akun sendiri tidak dihitung sebagai pemasukan/pengeluaran, tetapi tetap mengubah saldo per akun.
