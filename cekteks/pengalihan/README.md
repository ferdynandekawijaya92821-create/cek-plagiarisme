# Pengalihan dari alamat lama

Setelah repositori `kalori-cli` diganti namanya menjadi `cek-plagiarisme`, alamat lama
`https://ferdynandekawijaya92821-create.github.io/kalori-cli/` tidak lagi dilayani GitHub Pages. QR verifikasi di
laporan yang sudah dibagikan masih menunjuk ke alamat lama, jadi sebaiknya alamat itu tetap meneruskan pengunjung.

1. Buat repositori publik baru bernama `kalori-cli`.
2. Unggah `index.html` dari folder ini ke repositori itu.
3. Buka Settings → Pages → Source: *Deploy from a branch*, pilih `main` dan folder `/ (root)`, lalu Save.

Halaman ini meneruskan pengunjung ke alamat baru beserta `#cek=…`, sehingga QR laporan lama tetap bisa diverifikasi.
