# Jembatan CekTeks (Cloudflare Worker)

Browser tidak diizinkan mengambil PDF jurnal OJS, skripsi di repositori kampus, atau halaman web
lain secara langsung. Akibatnya, tanpa jembatan, CekTeks hanya bisa membandingkan abstrak sumber
tersebut. Jembatan adalah server kecil gratis di akun Cloudflare **milik Anda sendiri**. Ia mengambil
berkas itu untuk CekTeks, sehingga seluruh isinya ikut dibandingkan.

Dengan jembatan aktif, CekTeks bisa:

- mengunduh **teks lengkap** artikel yang ditemukan OpenAlex, Semantic Scholar, DOAJ, Crossref,
  OpenAIRE, dan CORE (PDF jurnal OJS dan repositori);
- mencari langsung di **repositori skripsi kampus** berbasis EPrints, misalnya UIN Sunan Kalijaga,
  UMS, UMM, UIN Ar-Raniry, Undiksha, dan lain-lain (daftarnya bisa diubah di tab Sumber);
- mengambil **isi halaman hasil Google** (Serper) tanpa perlu Tavily.

Gratis hingga 100.000 permintaan per hari, cukup untuk ratusan naskah sehari.

## Cara memasang (sekitar 5 menit, tanpa kartu kredit)

1. Daftar di **dash.cloudflare.com** (gratis), lalu buka **Workers & Pages → Create → Create Worker**.
2. Beri nama, misalnya `cekteks-jembatan`, lalu tekan **Deploy**.
3. Tekan **Edit code**, hapus semua isinya, tempel isi berkas [`worker.js`](worker.js), lalu tekan **Deploy**.
4. Buka **Settings → Variables and Secrets**, lalu tambahkan:
   - `KUNCI` (tipe **Secret**): rahasia acak minimal 16 karakter, misalnya `cekteks-8f3a91d0c2b74e55`.
   - `ASAL` (opsional, tipe Text): alamat situs CekTeks Anda, misalnya
     `https://ferdynandekawijaya92821-create.github.io`. Hanya situs ini yang boleh memakai jembatan.
5. Salin alamat Worker, misalnya `https://cekteks-jembatan.namaanda.workers.dev`.
6. Di CekTeks, buka **Sumber & Pengaturan → Jembatan teks lengkap**, lalu tempel alamat dan kuncinya.
   Tekan **Uji jembatan**. Bila muncul "Jembatan siap", sumber teks lengkap dan repositori kampus aktif.

## Keamanan dan etika

- Jembatan hanya melayani permintaan yang membawa `KUNCI` Anda, hanya untuk alamat `http/https`
  publik, dengan batas 15 MB dan 25 detik per berkas. Hasilnya disimpan di cache selama 1 hari.
- Jembatan tidak menyimpan naskah Anda. Yang lewat hanya alamat sumber yang diambil.
- CekTeks hanya mengambil beberapa berkas teratas per pemeriksaan. Jangan ubah kode agar mengambil
  massal, dan hormati aturan pakai setiap repositori. Sebagian kampus memblokir permintaan otomatis.
  Repositori seperti itu dilewati.
