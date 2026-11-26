# Mengaktifkan login Google & email (Supabase)

CekTeks memakai **Supabase** sebagai backend login. Layanannya gratis untuk pemakaian kecil-menengah, sudah HTTPS,
dan menyimpan kata sandi dalam bentuk **hash bcrypt**. Aturan **Row Level Security** di `skema.sql` memastikan setiap
pengguna hanya bisa membaca datanya sendiri. Aturan ini diuji otomatis di CI lewat `uji.sh`.

Selama `login` di `cekteks/web/site.json` masih kosong, CekTeks tetap memakai akun offline di perangkat.

## 1. Buat proyek Supabase (±5 menit)

1. Daftar di **https://supabase.com**. Bisa langsung masuk dengan akun GitHub atau Google.
2. Tekan **New project**:
   - Nama: `cekteks`.
   - Database password: buat yang kuat lalu simpan (tidak dipakai di situs).
   - Region: **Southeast Asia (Singapore)**.
3. Setelah proyek siap, buka **SQL Editor → New query**. Tempel seluruh isi [`skema.sql`](skema.sql), lalu tekan **Run**.
   Hasilnya harus "Success".

## 2. Atur login email

1. Buka **Authentication → Sign In / Providers → Email**, lalu pastikan **Enable** menyala.
2. Biarkan **Confirm email** menyala, agar pendaftar harus mengonfirmasi lewat email.
3. Buka **Authentication → URL Configuration** dan isi:
   - **Site URL**: `https://ferdynandekawijaya92821-create.github.io/cek-plagiarisme/`
   - **Redirect URLs**: tambahkan alamat yang sama. Bila nanti memakai domain sendiri, tambahkan juga alamat domain itu.
4. Opsional: buka **Authentication → Policies / Passwords** dan atur panjang minimal kata sandi ke 8. Aktifkan juga
   **Leaked password protection**, yang menolak kata sandi yang pernah bocor.

## 3. Atur login Google

1. Buka **https://console.cloud.google.com**, lalu buat proyek, misalnya `CekTeks`.
2. Buka **APIs & Services → OAuth consent screen**:
   - User type **External**.
   - Isi nama aplikasi `CekTeks`, email dukungan, dan logo (opsional).
   - Tambahkan domain `supabase.co`.
3. Buka **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs**: salin dari Supabase **Authentication → Sign In / Providers → Google**, di kolom
     *Callback URL*. Bentuknya `https://xxxx.supabase.co/auth/v1/callback`.
4. Salin **Client ID** dan **Client secret** ke Supabase **Authentication → Sign In / Providers → Google**, nyalakan
   **Enable**, lalu **Save**.

   *Client secret* hanya ditempel di dasbor Supabase. Jangan menaruhnya di situs atau di `site.json`.

## 4. Sambungkan ke CekTeks

1. Di Supabase, buka **Project Settings → API**. Salin dua nilai berikut:
   - **Project URL**, misalnya `https://abcdwxyz.supabase.co`.
   - **anon public** key, atau **Publishable key** (`sb_publishable_…`).

   Jangan salin **service_role** atau **Secret key** (`sb_secret_…`). Kunci itu bisa membaca semua data. CekTeks
   menolak kunci rahasia, dan bila kunci itu sampai tersebar, segera buat ulang di Supabase.
2. Isi `cekteks/web/site.json`:
   ```json
   "login": { "supabase_url": "https://abcdwxyz.supabase.co", "supabase_anon_key": "eyJ…atau sb_publishable_…", "google": true }
   ```
   Bisa juga lewat situs: buka `…/#pemilik`, lalu **Sumber & Pengaturan → Pengaturan situs**. Isi kolom Supabase, tekan
   **Salin site.json**, lalu tempel di editor GitHub.
3. Commit. Situs diperbarui otomatis dalam 1–2 menit, dan tombol **Masuk** kini menampilkan *Masuk dengan Google* dan
   email.

Kunci *anon/publishable* memang dirancang untuk dipasang di situs publik. Keamanannya dijaga oleh Row Level Security
di basis data, bukan oleh rahasia kunci.

## Melihat pesanan

Pesanan yang dibuat pengguna yang sudah masuk tersimpan di tabel **pesanan** (Supabase → **Table Editor**). Ubah kolom
`status` (`dibayar`, `dikerjakan`, `selesai`) setelah memeriksa pembayaran QRIS. Pengguna hanya bisa melihat pesanannya
sendiri dan tidak bisa mengubah status.

## Uji keamanan sendiri

```bash
bash cekteks/supabase/uji.sh   # butuh PostgreSQL (initdb, pg_ctl, psql)
```
Uji ini memastikan pengguna A tidak bisa membaca, mengubah, atau menghapus data pengguna B. Uji ini juga memastikan
pengguna tanpa login tidak bisa melihat daftar akun, dan pengguna tidak bisa menandai pesanannya sendiri sebagai
dibayar.
