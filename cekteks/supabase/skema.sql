-- =====================================================================
-- CekTeks: skema basis data Supabase (jalankan sekali di Supabase → SQL Editor → New query → Run).
-- Login, hash kata sandi (bcrypt), dan token dikelola Supabase Auth. Skema ini menambahkan:
--   profil   : nama tampilan setiap pengguna
--   riwayat  : ringkasan pemeriksaan (nama dokumen, skor, tanggal) — BUKAN isi naskah
--   pesanan  : pesanan layanan berbayar (dibuat pengguna, dikelola pemilik lewat dasbor Supabase)
-- Row Level Security (RLS) memastikan setiap pengguna HANYA bisa membaca dan mengubah barisnya sendiri.
-- Pengguna lain, termasuk yang memakai kunci publik (anon), tidak bisa melihat akun atau data orang lain.
-- =====================================================================

create table if not exists public.profil (
  id      uuid primary key references auth.users (id) on delete cascade,
  nama    text check (char_length(nama) <= 80),
  dibuat  timestamptz not null default now()
);

create table if not exists public.riwayat (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id      text not null check (char_length(id) <= 80),
  data    jsonb not null check (pg_column_size(data) <= 20000),
  dibuat  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.pesanan (
  id       text primary key check (id ~ '^CT-[0-9]{6}-[A-Z2-9]{4}$'),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paket    text not null check (char_length(paket) <= 80),
  jumlah   int  not null check (jumlah between 1 and 500),
  total    int  not null check (total between 1 and 100000000),
  nama     text check (char_length(nama) <= 80),
  tenggat  text check (char_length(tenggat) <= 40),
  kampus   text check (char_length(kampus) <= 120),
  catatan  text check (char_length(catatan) <= 600),
  status   text not null default 'menunggu_bayar'
           check (status in ('menunggu_bayar', 'dibayar', 'dikerjakan', 'selesai', 'dibatalkan')),
  dibuat   timestamptz not null default now()
);
create index if not exists pesanan_user_idx on public.pesanan (user_id, dibuat desc);

alter table public.profil  enable row level security;
alter table public.riwayat enable row level security;
alter table public.pesanan enable row level security;
alter table public.profil  force row level security;
alter table public.riwayat force row level security;
alter table public.pesanan force row level security;

-- Kunci publik (anon) tidak boleh menyentuh tabel apa pun; hanya pengguna yang sudah masuk.
revoke all on public.profil, public.riwayat, public.pesanan from anon, public;
grant select, insert, update on public.profil to authenticated;
grant select, insert, update, delete on public.riwayat to authenticated;
grant select, insert on public.pesanan to authenticated;

drop policy if exists "profil milik sendiri" on public.profil;
create policy "profil milik sendiri" on public.profil
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "riwayat milik sendiri" on public.riwayat;
create policy "riwayat milik sendiri" on public.riwayat
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "lihat pesanan sendiri" on public.pesanan;
create policy "lihat pesanan sendiri" on public.pesanan
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "buat pesanan sendiri" on public.pesanan;
create policy "buat pesanan sendiri" on public.pesanan
  for insert to authenticated with check (user_id = auth.uid() and status = 'menunggu_bayar');
-- Status pesanan hanya diubah pemilik situs lewat dasbor Supabase (Table Editor), bukan oleh pengguna.

-- Profil dibuat otomatis saat pengguna mendaftar (email atau Google).
create or replace function public.buat_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profil (id, nama)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'nama', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.buat_profil() from anon, authenticated, public;
drop trigger if exists cekteks_buat_profil on auth.users;
create trigger cekteks_buat_profil after insert on auth.users for each row execute function public.buat_profil();

-- Kuota analisis Claude (fungsi server analisis-ai): dihitung per akun per hari. Tabelnya tertutup untuk pengguna;
-- hanya bisa diubah lewat fungsi pakai_ai, yang memakai akun pemanggil (auth.uid()) dan tidak bisa diakali.
create table if not exists public.pemakaian_ai (
  user_id uuid not null references auth.users (id) on delete cascade,
  hari date not null default (now() at time zone 'Asia/Jakarta')::date,
  jumlah integer not null default 0,
  primary key (user_id, hari)
);
alter table public.pemakaian_ai enable row level security;
alter table public.pemakaian_ai force row level security;
revoke all on public.pemakaian_ai from anon, authenticated, public;

create or replace function public.pakai_ai(batas integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n integer; hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if uid is null then raise exception 'harus_login' using errcode = '42501'; end if;
  insert into public.pemakaian_ai as p (user_id, hari, jumlah) values (uid, hari_ini, 1)
  on conflict (user_id, hari) do update set jumlah = p.jumlah + 1
  returning jumlah into n;
  if n > greatest(batas, 1) then
    raise exception 'batas_harian' using errcode = 'P0001';  -- galat membatalkan penambahan di atas
  end if;
  return greatest(batas, 1) - n;
end $$;
revoke all on function public.pakai_ai(integer) from anon, public;
grant execute on function public.pakai_ai(integer) to authenticated;
