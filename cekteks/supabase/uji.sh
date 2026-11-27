#!/usr/bin/env bash
# Menjalankan uji RLS di Postgres sementara (butuh initdb/pg_ctl/psql). Pemakaian: bash cekteks/supabase/uji.sh
set -euo pipefail
cd "$(dirname "$0")"
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
DIR=$(mktemp -d)
RUN=""; [ "$(id -u)" = 0 ] && { chown -R postgres "$DIR"; RUN="runuser -u postgres --"; }
$RUN "$BIN/initdb" -D "$DIR/db" -U postgres -A trust >/dev/null
$RUN "$BIN/pg_ctl" -D "$DIR/db" -o "-k $DIR -c listen_addresses=''" -w start >/dev/null
trap '$RUN "$BIN/pg_ctl" -D "$DIR/db" -m immediate stop >/dev/null; rm -rf "$DIR"' EXIT
$RUN psql -h "$DIR" -U postgres -q -t -A -v ON_ERROR_STOP=1 -f uji.sql postgres 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  /  /p; /GAGAL\|ERROR\|SEMUA/p"
