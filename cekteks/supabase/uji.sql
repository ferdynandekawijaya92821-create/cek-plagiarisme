-- Uji RLS tanpa Supabase: tiruan minimal skema auth (auth.users, auth.uid(), peran anon/authenticated).
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

\i skema.sql

-- dua pengguna mendaftar
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'rina@contoh.id', '{"nama":"Rina"}'),
  ('22222222-2222-2222-2222-222222222222', 'budi@gmail.com', '{"full_name":"Budi Santoso"}');

create or replace function pg_temp.harus(ok boolean, pesan text) returns void language plpgsql as
  $$ begin if not ok then raise exception 'GAGAL: %', pesan; end if; raise notice 'lolos: %', pesan; end $$;

select pg_temp.harus((select count(*) from public.profil) = 2, 'profil dibuat otomatis untuk email & Google');

-- Rina masuk
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.riwayat (id, data) values ('r1', '{"doc":"skripsi-rina.pdf","score":12}');
insert into public.pesanan (id, paket, jumlah, total) values ('CT-261126-AB2C', 'Cek Plagiasi + AI', 2, 10057);
select pg_temp.harus((select count(*) from public.riwayat) = 1, 'Rina melihat riwayatnya sendiri');
select pg_temp.harus((select nama from public.profil) = 'Rina', 'Rina hanya melihat profilnya sendiri');

-- Budi masuk: tidak boleh melihat apa pun milik Rina
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.harus((select count(*) from public.riwayat) = 0, 'Budi tidak melihat riwayat Rina');
select pg_temp.harus((select count(*) from public.pesanan) = 0, 'Budi tidak melihat pesanan Rina');
select pg_temp.harus((select count(*) from public.profil) = 1 and (select nama from public.profil) = 'Budi Santoso', 'Budi tidak melihat profil Rina');
update public.riwayat set data = '{"diubah":true}' where id = 'r1';
delete from public.riwayat where id = 'r1';
do $$ begin
  begin insert into public.riwayat (user_id, id, data) values ('11111111-1111-1111-1111-111111111111', 'palsu', '{}');
        raise exception 'GAGAL: Budi bisa menulis atas nama Rina';
  exception when insufficient_privilege then raise notice 'lolos: Budi tidak bisa menulis atas nama Rina'; end;
  begin insert into public.pesanan (id, paket, jumlah, total, status) values ('CT-261126-ZZZZ', 'x', 1, 1, 'dibayar');
        raise exception 'GAGAL: pengguna bisa menandai pesanan dibayar sendiri';
  exception when insufficient_privilege then raise notice 'lolos: pengguna tidak bisa menandai pesanannya dibayar'; end;
  begin update public.pesanan set status = 'selesai';
        raise exception 'GAGAL: pengguna bisa mengubah status pesanan';
  exception when insufficient_privilege then raise notice 'lolos: pengguna tidak bisa mengubah status pesanan'; end;
end $$;

-- Rina: datanya utuh walau Budi mencoba mengubah/menghapus
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pg_temp.harus((select data ->> 'doc' from public.riwayat where id = 'r1') = 'skripsi-rina.pdf', 'riwayat Rina tidak bisa diubah/dihapus Budi');

-- Kuota analisis AI: dihitung per akun, tabelnya tidak bisa dibaca atau diubah langsung
select pg_temp.harus(public.pakai_ai(2) = 1, 'kuota AI: pemakaian pertama tersisa 1');
select pg_temp.harus(public.pakai_ai(2) = 0, 'kuota AI: pemakaian kedua tersisa 0');
do $$ begin
  begin perform public.pakai_ai(2); raise exception 'GAGAL: kuota AI bisa dilewati';
  exception when raise_exception then raise notice 'lolos: kuota AI harian ditegakkan'; end;
  begin perform 1 from public.pemakaian_ai; raise exception 'GAGAL: pengguna bisa membaca tabel kuota';
  exception when insufficient_privilege then raise notice 'lolos: tabel kuota tertutup bagi pengguna'; end;
  begin update public.pemakaian_ai set jumlah = 0; raise exception 'GAGAL: pengguna bisa mengatur ulang kuota';
  exception when insufficient_privilege then raise notice 'lolos: pengguna tidak bisa mengatur ulang kuota'; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.harus(public.pakai_ai(2) = 1, 'kuota AI Budi terpisah dari Rina');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- Tanpa login (kunci publik anon): tidak ada akses sama sekali
reset role; set role anon; select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin perform 1 from public.riwayat; raise exception 'GAGAL: anon bisa membaca riwayat';
  exception when insufficient_privilege then raise notice 'lolos: tanpa login tidak bisa membaca riwayat'; end;
  begin perform public.pakai_ai(5); raise exception 'GAGAL: anon bisa memakai kuota AI';
  exception when insufficient_privilege then raise notice 'lolos: tanpa login tidak bisa memakai analisis AI'; end;
  begin perform 1 from public.profil; raise exception 'GAGAL: anon bisa membaca profil';
  exception when insufficient_privilege then raise notice 'lolos: tanpa login tidak bisa melihat daftar akun'; end;
end $$;
reset role;
\echo SEMUA UJI RLS LOLOS
