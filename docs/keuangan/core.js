// Rekap Keuangan — mesin pembaca data (tanpa tampilan).
// Berjalan di browser (window.RK) dan di Node (module.exports) supaya bisa diuji.
(function (root) {
  "use strict";

  const BULAN = {
    jan: 1, januari: 1, january: 1, feb: 2, peb: 2, februari: 2, pebruari: 2, february: 2,
    mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7, agu: 8, agt: 8, ags: 8, agus: 8, agustus: 8, aug: 8, august: 8,
    sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10,
    nov: 11, nop: 11, november: 11, nopember: 11, des: 12, dec: 12, desember: 12, december: 12,
  };

  // ---------- CSV ----------
  function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 15);
    let best = ",", bestScore = -1;
    for (const d of [",", ";", "\t", "|"]) {
      const counts = lines.map((l) => {
        let q = false, n = 0;
        for (const ch of l) { if (ch === '"') q = !q; else if (!q && ch === d) n++; }
        return n;
      });
      // Pemisah yang benar muncul berkali-kali dan konsisten di banyak baris.
      const max = Math.max(0, ...counts);
      const score = counts.filter((c) => c > 0 && c === max).length * 10 + max;
      if (max > 0 && score > bestScore) { best = d; bestScore = score; }
    }
    return best;
  }

  function parseCSV(text) {
    text = String(text).replace(/^﻿/, "");
    const delim = detectDelimiter(text);
    const rows = [];
    let row = [], field = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"' && field.trim() === "") { inQ = true; field = ""; }
      else if (c === delim) { row.push(field.trim()); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field.trim()); field = ""; rows.push(row); row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field.trim()); rows.push(row); }
    return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
  }

  // ---------- Angka ----------
  // Mengerti "Rp 1.250.000,00", "1,250,000.00", "-50.000", "(50.000)", "50.000 DB", "1.5jt" tidak.
  function parseAmount(v) {
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    let s = String(v == null ? "" : v).trim();
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) neg = true;
    if (/\b(DB|DR|D|debit|debet)\.?\s*$/i.test(s)) neg = true;
    if (/^-|^−|-\s*$|^[^\d]*-\s*\d/.test(s.replace(/\s+/g, " "))) neg = true;
    let n = s.replace(/[^\d.,]/g, "");
    if (!/\d/.test(n)) return NaN;
    const lastDot = n.lastIndexOf("."), lastComma = n.lastIndexOf(",");
    let dec = null;
    if (lastDot >= 0 && lastComma >= 0) dec = lastDot > lastComma ? "." : ",";
    else {
      const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
      if (sep) {
        const parts = n.split(sep);
        const tail = parts[parts.length - 1];
        // Satu pemisah diikuti 1–2 digit = desimal; selain itu pemisah ribuan.
        if (parts.length === 2 && tail.length > 0 && tail.length <= 2) dec = sep;
      }
    }
    if (dec) {
      const th = dec === "." ? "," : ".";
      n = n.split(th).join("").replace(dec, ".");
    } else n = n.replace(/[.,]/g, "");
    const val = parseFloat(n);
    if (!isFinite(val)) return NaN;
    return neg ? -val : val;
  }

  // ---------- Tanggal ----------
  const pad = (x) => String(x).padStart(2, "0");
  function ymd(y, m, d) {
    y = +y; m = +m; d = +d;
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 2200)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  function excelSerial(n) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  // dayFirst: format Indonesia 03/04/2025 = 3 April. Bila angka kedua > 12, dibaca bulan/hari.
  function parseDate(v, opts) {
    const dayFirst = !opts || opts.dayFirst !== false;
    if (v instanceof Date && !isNaN(v)) return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === "number") return v > 20000 && v < 80000 ? excelSerial(v) : null;
    const s = String(v == null ? "" : v).trim();
    if (!s) return null;
    if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(parseFloat(s));
    let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return ymd(m[1], m[2], m[3]);
    m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let a = +m[1], b = +m[2];
      if (!dayFirst && a <= 12) [a, b] = [b, a];
      else if (b > 12 && a <= 12) [a, b] = [b, a];
      return ymd(m[3], b, a);
    }
    m = s.match(/(\d{1,2})[\s\-.]+([A-Za-z]{3,})\.?[\s\-.,]+(\d{2,4})/);
    if (m && BULAN[m[2].toLowerCase()]) return ymd(m[3], BULAN[m[2].toLowerCase()], m[1]);
    m = s.match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && BULAN[m[1].toLowerCase()]) return ymd(m[3], BULAN[m[1].toLowerCase()], m[2]);
    m = s.match(/^(\d{8})$/); // 20250314
    if (m) return ymd(s.slice(0, 4), s.slice(4, 6), s.slice(6, 8));
    return null;
  }

  // ---------- Deteksi kolom ----------
  const ROLES = {
    date: ["tanggal", "date", "tgl", "tanggal transaksi", "transaction date", "waktu", "period", "periode", "time", "created", "tgl transaksi", "posting date"],
    type: ["type", "tipe", "jenis", "income/expense", "jenis transaksi", "transaction type", "d/k", "db/cr", "dk", "debit/kredit", "mutasi", "tipe transaksi", "kind"],
    income: ["pemasukan", "uang masuk", "masuk", "kredit", "credit", "cr", "income", "deposit", "penerimaan", "debit (masuk)"],
    expense: ["pengeluaran", "uang keluar", "keluar", "debit", "debet", "db", "expense", "expenses", "withdrawal", "penarikan"],
    amount: ["amount", "jumlah", "nominal", "nilai", "total", "idr", "value", "jumlah (rp)", "nominal (rp)", "amount (idr)", "harga", "uang", "rp"],
    category: ["category", "kategori", "category name", "jenis pengeluaran", "pos", "subcategory", "sub kategori", "group"],
    account: ["account", "akun", "accounts", "wallet", "dompet", "rekening", "sumber dana", "sumber", "kas", "payment type", "metode"],
    note: ["note", "notes", "catatan", "keterangan", "description", "deskripsi", "memo", "uraian", "berita", "payee", "detail", "remark", "remarks", "nama transaksi", "transaksi", "item"],
    currency: ["currency", "mata uang", "kurs"],
  };
  const ROLE_LABEL = {
    date: "Tanggal", type: "Jenis (masuk/keluar)", income: "Kolom pemasukan", expense: "Kolom pengeluaran",
    amount: "Jumlah", category: "Kategori", account: "Akun/dompet", note: "Keterangan", currency: "Mata uang",
  };
  const norm = (h) => String(h || "").toLowerCase().replace(/[_*]+/g, " ").replace(/\s+/g, " ").trim();

  function scoreHeader(h, role) {
    const n = norm(h);
    if (!n) return 0;
    let best = 0;
    ROLES[role].forEach((k, i) => {
      const bonus = (ROLES[role].length - i) / 100; // kata kunci di depan daftar lebih diutamakan
      if (n === k) best = Math.max(best, 3 + bonus);
      else if (n.split(/[\s/()\-.]+/).includes(k)) best = Math.max(best, 2 + bonus);
      else if (k.length > 3 && n.includes(k)) best = Math.max(best, 1 + bonus);
    });
    return best;
  }

  function findHeaderRow(rows) {
    let bestI = 0, bestScore = 0;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      let s = 0;
      for (const cell of rows[i]) {
        if (typeof cell !== "string" || cell.length > 40 || parseDate(cell) || !isNaN(parseAmount(cell)) && /^\W*\d/.test(cell)) continue;
        const r = Object.keys(ROLES).map((role) => scoreHeader(cell, role));
        if (Math.max(...r) >= 2) s++;
      }
      if (s > bestScore) { bestScore = s; bestI = i; }
    }
    return bestScore >= 2 ? bestI : 0;
  }

  function detectMapping(headers, sampleRows) {
    const pairs = [];
    headers.forEach((h, col) => Object.keys(ROLES).forEach((role) => {
      const s = scoreHeader(h, role);
      if (s > 0) pairs.push({ col, role, s });
    }));
    pairs.sort((a, b) => b.s - a.s);
    const map = {}, used = new Set();
    for (const p of pairs) {
      if (map[p.role] != null || used.has(p.col)) continue;
      map[p.role] = p.col; used.add(p.col);
    }
    // Kolom "Jumlah" yang ditemukan bersama kolom masuk/keluar biasanya saldo/total — pakai pasangan masuk/keluar.
    if (map.income != null && map.expense == null || map.expense != null && map.income == null) {
      // hanya satu sisi: jadikan itu kolom jumlah bila belum ada
      const side = map.income != null ? "income" : "expense";
      if (map.amount == null) { map.amount = map[side]; }
      delete map[side];
      if (side === "expense" && map.type == null) map._allExpense = true;
    }
    // Tanpa kolom tanggal berjudul jelas: cari kolom yang isinya tanggal.
    if (map.date == null && sampleRows) {
      for (let c = 0; c < headers.length; c++) {
        if (used.has(c)) continue;
        const vals = sampleRows.map((r) => r[c]).filter((x) => x !== "" && x != null);
        if (vals.length && vals.filter((x) => parseDate(x)).length / vals.length > 0.8) { map.date = c; used.add(c); break; }
      }
    }
    if (map.amount == null && map.income == null && sampleRows) {
      for (let c = headers.length - 1; c >= 0; c--) {
        if (used.has(c)) continue;
        const vals = sampleRows.map((r) => r[c]).filter((x) => x !== "" && x != null);
        if (vals.length && vals.filter((x) => !isNaN(parseAmount(x))).length / vals.length > 0.8) { map.amount = c; break; }
      }
    }
    const mapping = { date: map.date, type: map.type, income: map.income, expense: map.expense, amount: map.amount,
      category: map.category, account: map.account, note: map.note, currency: map.currency,
      sign: map._allExpense ? "allOut" : "auto", dayFirst: true };
    return mapping;
  }

  function guessApp(headers) {
    const h = headers.map(norm).join("|");
    if (/exclude report/.test(h) && /event/.test(h)) return "Money Lover";
    if (/ref currency amount/.test(h) && /payment type/.test(h)) return "Wallet by BudgetBakers";
    if (/converted amount/.test(h)) return "Monefy";
    if (/category name/.test(h) && /wallet/.test(h)) return "Spendee";
    if (/income\/expense/.test(h) && /accounts/.test(h)) return "Money Manager";
    if (/cabang/.test(h) && /saldo/.test(h)) return "Mutasi rekening bank";
    if (/(debit|debet)/.test(h) && /(kredit|credit)/.test(h)) return "Mutasi rekening (debit/kredit)";
    if (/pemasukan/.test(h) && /pengeluaran/.test(h)) return "Buku kas (pemasukan/pengeluaran)";
    return "Format umum";
  }

  function typeFromValue(v) {
    const s = norm(v);
    if (!s) return null;
    if (/transfer|pindah|mutasi antar/.test(s)) return "transfer";
    if (/^(db|dr|d|debit|debet|-)$|expense|pengeluaran|keluar|belanja|spend|withdraw|tarik|bayar|payment out/.test(s)) return "out";
    if (/^(cr|k|kr|kredit|credit|\+)$|income|pemasukan|masuk|pendapatan|deposit|terima|gaji|refund/.test(s)) return "in";
    return null;
  }

  // ---------- Baris → transaksi ----------
  function hash(str) {
    let h1 = 0x811c9dc5, h2 = 0x1234567;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c, 2654435761) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
  }

  // Menghasilkan { tx: [...], skipped: n, errors: [...] }
  function rowsToTransactions(rows, mapping, sourceId) {
    const get = (r, k) => (mapping[k] == null || mapping[k] === "" ? "" : r[mapping[k]]);
    const tx = [], seen = {}, errors = [];
    let skipped = 0;
    rows.forEach((r, i) => {
      const date = parseDate(get(r, "date"), { dayFirst: mapping.dayFirst !== false });
      let signed = NaN;
      if (mapping.income != null && mapping.income !== "" || mapping.expense != null && mapping.expense !== "") {
        const a = Math.abs(parseAmount(get(r, "income")) || 0), b = Math.abs(parseAmount(get(r, "expense")) || 0);
        signed = a - b;
      } else {
        signed = parseAmount(get(r, "amount"));
      }
      if (!date || isNaN(signed) || signed === 0) { skipped++; if (errors.length < 5 && r.some((x) => String(x).trim())) errors.push(i); return; }
      const category = String(get(r, "category") || "").trim();
      const typeVal = typeFromValue(get(r, "type"));
      let type;
      if (mapping.sign === "allOut") type = "out";
      else if (mapping.sign === "allIn") type = "in";
      else if (typeVal === "in" || typeVal === "out") type = typeVal;
      else type = signed < 0 ? "out" : "in";
      const isTransfer = typeVal === "transfer" || /^(transfer|pindah dana|pindah saldo)|\btransfer\b/i.test(category);
      const t = {
        date,
        amount: Math.round(Math.abs(signed) * 100) / 100,
        type,
        transfer: isTransfer || undefined,
        category: category || (type === "in" ? "Pemasukan lain" : "Pengeluaran lain"),
        account: String(get(r, "account") || "").trim() || "Utama",
        note: String(get(r, "note") || "").trim(),
        currency: String(get(r, "currency") || "").trim().toUpperCase() || undefined,
        source: sourceId,
      };
      const key = [t.date, t.type, t.amount, t.note, t.account, t.category].join("|");
      seen[key] = (seen[key] || 0) + 1;
      t.id = hash(key + "#" + seen[key]);
      tx.push(t);
    });
    return { tx, skipped, errors };
  }

  // Tabel (array baris) → { headers, body, mapping, app }
  function analyzeTable(rows) {
    rows = rows.map((r) => r.map((c) => (c == null ? "" : c)));
    const hi = findHeaderRow(rows);
    const headers = rows[hi] ? rows[hi].map((h, i) => String(h).trim() || `Kolom ${i + 1}`) : [];
    const body = rows.slice(hi + 1).filter((r) => r.some((c) => String(c).trim() !== ""));
    const mapping = detectMapping(headers, body.slice(0, 30));
    return { headers, body, mapping, app: guessApp(headers) };
  }

  // JSON: array objek, atau { transactions: [...] }
  function jsonToRows(data) {
    let arr = Array.isArray(data) ? data : data && (data.transactions || data.data || data.items || data.records);
    if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== "object") throw new Error("JSON tidak berisi daftar transaksi.");
    const keys = [];
    arr.forEach((o) => Object.keys(o).forEach((k) => { if (!keys.includes(k) && typeof o[k] !== "object") keys.push(k); }));
    return [keys, ...arr.map((o) => keys.map((k) => (o[k] == null ? "" : o[k])))];
  }

  // Tautan Google Sheets biasa → tautan CSV yang bisa dibaca langsung.
  function normalizeSheetUrl(url) {
    url = String(url || "").trim();
    const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
    if (m && !/\/d\/e\//.test(url)) {
      const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
      return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${gid ? "&gid=" + gid : ""}`;
    }
    if (/docs\.google\.com\/spreadsheets\/d\/e\//.test(url) && !/output=csv/.test(url)) {
      return url.replace(/\/pubhtml.*$/, "/pub?output=csv").replace(/\/pub(\?.*)?$/, (s, q) => "/pub" + (q ? q.replace(/output=\w+/, "output=csv") + (/output=/.test(q) ? "" : "&output=csv") : "?output=csv"));
    }
    return url;
  }

  // ---------- Rekap ----------
  function summarize(txs, opts) {
    opts = opts || {};
    let inc = 0, out = 0;
    const byCatOut = {}, byCatIn = {}, byMonth = {};
    for (const t of txs) {
      if (t.transfer && !opts.includeTransfers) continue;
      const mk = t.date.slice(0, 7);
      byMonth[mk] = byMonth[mk] || { in: 0, out: 0 };
      if (t.type === "in") { inc += t.amount; byCatIn[t.category] = (byCatIn[t.category] || 0) + t.amount; byMonth[mk].in += t.amount; }
      else { out += t.amount; byCatOut[t.category] = (byCatOut[t.category] || 0) + t.amount; byMonth[mk].out += t.amount; }
    }
    return { income: inc, expense: out, net: inc - out, byCatIn, byCatOut, byMonth };
  }

  function balances(txs, opening) {
    const acc = {};
    Object.keys(opening || {}).forEach((a) => { acc[a] = +opening[a] || 0; });
    for (const t of txs) acc[t.account] = (acc[t.account] || 0) + (t.type === "in" ? t.amount : -t.amount);
    return acc;
  }

  const api = { parseCSV, detectDelimiter, parseAmount, parseDate, analyzeTable, detectMapping, guessApp, rowsToTransactions,
    typeFromValue, jsonToRows, normalizeSheetUrl, summarize, balances, hash, ROLE_LABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RK = api;
})(typeof window !== "undefined" ? window : globalThis);
