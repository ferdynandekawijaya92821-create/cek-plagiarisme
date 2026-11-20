// Rekap Keuangan — tampilan & penyimpanan. Logika baca data ada di core.js (window.RK).
(function () {
  "use strict";
  const RK = window.RK;
  const KEY = "rekapKeuangan.v1";
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Penyimpanan ----------
  const blank = () => ({ tx: [], sources: [], opening: {}, settings: { includeTransfers: false } });
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.tx)) return Object.assign(blank(), d); } catch (e) { /* kosong */ }
    return blank();
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast("Gagal menyimpan di perangkat (penyimpanan penuh atau diblokir). Unduh cadangan agar data tidak hilang."); }
  }

  // ---------- Format ----------
  const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  const fmt = (n) => rupiah.format(Math.round(n)).replace(/ /g, " ");
  const fmtSigned = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));
  function compact(n) {
    const a = Math.abs(n), s = n < 0 ? "−" : "";
    const f = (x) => x.toLocaleString("id-ID", { maximumFractionDigits: x < 10 ? 1 : 0 });
    if (a >= 1e9) return s + f(a / 1e9) + " M";
    if (a >= 1e6) return s + f(a / 1e6) + " jt";
    if (a >= 1e3) return s + f(a / 1e3) + " rb";
    return s + f(a);
  }
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthLabel = (mk, full) => { const [y, m] = mk.split("-"); return BLN[+m - 1] + (full ? " " + y : " '" + y.slice(2)); };
  const fmtDate = (d) => { const [y, m, dd] = d.split("-"); return `${+dd} ${BLN[+m - 1]} ${y}`; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => iso(new Date());

  let toastT;
  function toast(msg) {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 4200);
  }

  // ---------- Tab ----------
  function showTab(name) {
    $$("nav.tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    $$("section[role=tabpanel]").forEach((s) => { s.hidden = s.id !== "tab-" + name; });
    try { sessionStorage.setItem(KEY + ".tab", name); } catch (e) { /* abaikan */ }
    render();
  }
  $$("nav.tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) showTab(g.dataset.goto); });

  // ---------- Periode ----------
  let period = null, acc = "";
  function range() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    switch (period) {
      case "month": return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
      case "lastmonth": return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
      case "3m": return [iso(new Date(y, m - 2, 1)), iso(new Date(y, m + 1, 0))];
      case "year": return [`${y}-01-01`, `${y}-12-31`];
      case "custom": return [$("#fromDate").value || "0000-01-01", $("#toDate").value || "9999-12-31"];
      default: {
        const ds = S.tx.map((t) => t.date).sort();
        return [ds[0] || today(), ds[ds.length - 1] > today() ? ds[ds.length - 1] : today()];
      }
    }
  }
  function setPeriod(p) {
    period = p;
    $$("#periodSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === p)));
    $("#customRange").hidden = p !== "custom";
    if (p === "custom" && !$("#fromDate").value) {
      const [a, b] = (period = "all", range()); period = "custom";
      $("#fromDate").value = a; $("#toDate").value = b;
    }
    renderDash();
  }
  $$("#periodSeg button").forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.p)));
  $("#fromDate").addEventListener("change", renderDash);
  $("#toDate").addEventListener("change", renderDash);
  $("#accFilter").addEventListener("change", (e) => { acc = e.target.value; renderDash(); });

  const accounts = () => Array.from(new Set([...Object.keys(S.opening), ...S.tx.map((t) => t.account)])).sort((a, b) => a.localeCompare(b, "id"));
  const countsAsFlow = (t) => !t.transfer || S.settings.includeTransfers;

  // ---------- Ringkasan ----------
  function renderDash() {
    const has = S.tx.length > 0;
    $("#emptyState").hidden = has;
    $("#dash").hidden = !has;
    $("#syncBtn").hidden = !S.sources.some((s) => s.kind === "url");
    if (!has) return;
    if (!period) {
      const [a] = (period = "month", range());
      period = S.tx.some((t) => t.date >= a && t.date <= today()) ? "month" : "all";
      setPeriod(period); return;
    }
    const sel = $("#accFilter"), accs = accounts();
    sel.innerHTML = `<option value="">Semua akun (${accs.length})</option>` + accs.map((a) => `<option ${a === acc ? "selected" : ""}>${esc(a)}</option>`).join("");
    if (acc && !accs.includes(acc)) acc = "";

    const [from, to] = range();
    const scoped = S.tx.filter((t) => !acc || t.account === acc);
    const inP = scoped.filter((t) => t.date >= from && t.date <= to);
    const sum = RK.summarize(inP, { includeTransfers: S.settings.includeTransfers });
    const nIn = inP.filter((t) => t.type === "in" && countsAsFlow(t)).length, nOut = inP.filter((t) => t.type === "out" && countsAsFlow(t)).length;

    $("#kIn").textContent = fmt(sum.income);
    $("#kInH").textContent = `${nIn} transaksi`;
    $("#kOut").textContent = fmt(sum.expense);
    $("#kOutH").textContent = `${nOut} transaksi`;
    $("#kNet").textContent = fmtSigned(sum.net);
    $("#kNet").style.color = sum.net >= 0 ? "var(--good)" : "var(--bad)";
    $("#kNetH").textContent = sum.income > 0
      ? (sum.net >= 0 ? `Tersisa ${Math.round((sum.net / sum.income) * 100)}% dari pemasukan` : `Pengeluaran melebihi pemasukan`)
      : (sum.expense > 0 ? "Belum ada pemasukan di periode ini" : "Tidak ada transaksi di periode ini");

    const endDate = to < today() ? to : today();
    const opening = acc ? { [acc]: +S.opening[acc] || 0 } : S.opening;
    const bal = RK.balances(scoped.filter((t) => t.date <= endDate), opening);
    const total = Object.values(bal).reduce((a, b) => a + b, 0);
    $("#kTotal").textContent = fmt(total);
    $("#kTotal").style.color = total < 0 ? "var(--bad)" : "";
    $("#kTotalH").textContent = `Saldo ${acc ? esc(acc) : Object.keys(bal).length + " akun"} per ${fmtDate(endDate)}`;

    // Bulan pada grafik: bulan dalam periode, minimal 6 dan maksimal 12 bulan terakhir.
    const endMk = endDate.slice(0, 7);
    let startMk = from.slice(0, 7);
    const firstData = scoped.map((t) => t.date).sort()[0];
    if (firstData && startMk < firstData.slice(0, 7)) startMk = firstData.slice(0, 7);
    const months = [];
    let [yy, mm] = endMk.split("-").map(Number);
    while (months.length < 12) {
      const mk = `${yy}-${String(mm).padStart(2, "0")}`;
      if (mk < startMk && months.length >= 6) break;
      months.unshift(mk);
      if (--mm === 0) { mm = 12; yy--; }
    }
    const all = RK.summarize(scoped, { includeTransfers: S.settings.includeTransfers }).byMonth;
    const data = months.map((mk) => ({ mk, in: (all[mk] || {}).in || 0, out: (all[mk] || {}).out || 0 }));
    $("#chartSub").textContent = `${monthLabel(months[0], true)} – ${monthLabel(months[months.length - 1], true)}`;
    drawMonthChart($("#monthChart"), data);
    $("#monthTable").innerHTML = `<table><thead><tr><th>Bulan</th><th class="num">Pemasukan</th><th class="num">Pengeluaran</th><th class="num">Selisih</th></tr></thead><tbody>${
      data.slice().reverse().map((d) => `<tr><td>${monthLabel(d.mk, true)}</td><td class="num">${fmt(d.in)}</td><td class="num">${fmt(d.out)}</td><td class="num ${d.in - d.out >= 0 ? "amt-in" : ""}">${fmtSigned(d.in - d.out)}</td></tr>`).join("")}</tbody></table>`;

    drawCatBars($("#catOut"), sum.byCatOut, "var(--out)", "Belum ada pengeluaran di periode ini.");
    drawCatBars($("#catIn"), sum.byCatIn, "var(--in)", "Belum ada pemasukan di periode ini.");
  }

  // Langkah sumbu "bulat" (1, 2, 2,5, 5 × 10ⁿ) dengan sekitar 4 garis.
  function niceStep(v) {
    const raw = Math.max(v, 1) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  function drawMonthChart(el, data) {
    const W = Math.max(300, Math.round(el.clientWidth || 640)), H = W < 500 ? 200 : 240, L = 52, R = 8, T = 10, B = 26;
    const peak = Math.max(1, ...data.map((d) => Math.max(d.in, d.out))), stepV = niceStep(peak);
    const ticks = Math.max(1, Math.ceil(peak / stepV)), max = stepV * ticks;
    const iw = W - L - R, ih = H - T - B, slot = iw / data.length;
    const bw = Math.max(4, Math.min(22, (slot - 10) / 2 - 1));
    const y = (v) => T + ih - (v / max) * ih;
    const bar = (x, v, color) => {
      if (v <= 0) return "";
      const h = Math.max(2, (v / max) * ih), r = Math.min(4, h, bw / 2), y0 = T + ih;
      return `<path d="M${x},${y0} V${y0 - h + r} Q${x},${y0 - h} ${x + r},${y0 - h} H${x + bw - r} Q${x + bw},${y0 - h} ${x + bw},${y0 - h + r} V${y0} Z" fill="${color}"/>`;
    };
    let g = "";
    for (let i = 0; i <= ticks; i++) {
      const v = stepV * i, yy = y(v);
      g += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="axis-t" x="${L - 6}" y="${yy + 4}" text-anchor="end">${compact(v)}</text>`;
    }
    const step = data.length > 8 && W < 640 ? 2 : 1;
    data.forEach((d, i) => {
      const cx = L + slot * i + slot / 2;
      g += bar(cx - bw - 1, d.in, "var(--in)") + bar(cx + 1, d.out, "var(--out)");
      if ((data.length - 1 - i) % step === 0) g += `<text class="axis-t" x="${cx}" y="${H - 8}" text-anchor="middle">${monthLabel(d.mk)}</text>`;
      g += `<rect data-i="${i}" x="${L + slot * i}" y="${T}" width="${slot}" height="${ih + B}" fill="transparent"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik pemasukan dan pengeluaran per bulan"><line x1="${L}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}" stroke="var(--muted)"/>${g}</svg><div class="tip"></div>`;
    const tip = $(".tip", el), svg = $("svg", el);
    const hide = () => { tip.style.opacity = 0; };
    const show = (e) => {
      const r = e.target.closest("rect[data-i]"); if (!r) return hide();
      const d = data[+r.dataset.i], net = d.in - d.out;
      tip.innerHTML = `<b>${monthLabel(d.mk, true)}</b><span class="dot" style="background:var(--in)"></span> Pemasukan ${fmt(d.in)}<br><span class="dot" style="background:var(--out)"></span> Pengeluaran ${fmt(d.out)}<br>Selisih <b style="display:inline;color:${net >= 0 ? "var(--good)" : "var(--bad)"}">${fmtSigned(net)}</b>`;
      const box = el.getBoundingClientRect(), rb = r.getBoundingClientRect();
      let left = rb.left - box.left + rb.width / 2 - tip.offsetWidth / 2;
      left = Math.max(0, Math.min(box.width - tip.offsetWidth, left));
      tip.style.left = left + "px"; tip.style.top = "-6px"; tip.style.opacity = 1;
    };
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", hide);
  }

  function drawCatBars(el, obj, color, emptyMsg) {
    let items = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const total = items.reduce((a, [, v]) => a + v, 0);
    if (!items.length) { el.innerHTML = `<p class="muted small">${emptyMsg}</p>`; return; }
    if (items.length > 8) { const rest = items.slice(7).reduce((a, [, v]) => a + v, 0); items = items.slice(0, 7).concat([["Lainnya (" + (items.length - 7) + " kategori)", rest]]); }
    const max = items[0][1];
    el.innerHTML = items.map(([k, v]) => `<div class="b"><span class="nm" title="${esc(k)}">${esc(k)}</span><span class="v">${fmt(v)} · ${Math.round((v / total) * 100)}%</span><div class="track"><div class="fill" style="width:${(v / max) * 100}%;background:${color}"></div></div></div>`).join("");
  }

  // ---------- Transaksi ----------
  let resizeT, lastW = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { const w = $("#monthChart").clientWidth; if (w && w !== lastW) { lastW = w; if (!$("#tab-ringkasan").hidden) renderDash(); } }, 150);
  });

  let shown = 100;
  function filteredTx() {
    const q = $("#q").value.trim().toLowerCase(), tf = $("#typeFilter").value;
    return S.tx.filter((t) => {
      if (tf === "transfer" ? !t.transfer : tf && (t.type !== tf || t.transfer)) return false;
      return !q || [t.note, t.category, t.account, t.date, String(t.amount)].join(" ").toLowerCase().includes(q);
    }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  function renderTx() {
    const list = filteredTx();
    $("#txCount").textContent = `${list.length.toLocaleString("id-ID")} transaksi`;
    $("#txBody").innerHTML = list.slice(0, shown).map((t) => `<tr>
      <td style="white-space:nowrap">${fmtDate(t.date)}</td>
      <td>${esc(t.note || t.category)}${t.transfer ? ' <span class="tag">transfer</span>' : ""}<div class="small muted" style="display:none" data-sm>${esc(t.category)} · ${esc(t.account)}</div></td>
      <td class="hide-sm">${esc(t.category)}</td><td class="hide-sm">${esc(t.account)}</td>
      <td class="num ${t.type === "in" ? "amt-in" : "amt-out"}">${t.type === "in" ? "+" : "−"}${fmt(t.amount)}</td>
      <td><button class="btn sm" data-del="${esc(t.id)}" aria-label="Hapus transaksi" title="Hapus">✕</button></td></tr>`).join("") ||
      `<tr><td colspan="6" class="muted">Tidak ada transaksi.</td></tr>`;
    if (matchMedia("(max-width:520px)").matches) $$("[data-sm]").forEach((e) => { e.style.display = "block"; });
    $("#moreBtn").hidden = list.length <= shown;
    $("#catList").innerHTML = Array.from(new Set(S.tx.map((t) => t.category))).map((c) => `<option value="${esc(c)}">`).join("");
    $("#accList").innerHTML = accounts().map((c) => `<option value="${esc(c)}">`).join("");
  }
  $("#q").addEventListener("input", () => { shown = 100; renderTx(); });
  $("#typeFilter").addEventListener("change", () => { shown = 100; renderTx(); });
  $("#moreBtn").addEventListener("click", () => { shown += 200; renderTx(); });
  $("#txBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    S.tx = S.tx.filter((t) => t.id !== b.dataset.del); save(); renderTx(); toast("Transaksi dihapus.");
  });
  $("#addForm").date.value = today();
  $("#addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, amount = Math.abs(RK.parseAmount(f.amount.value));
    if (!amount) { toast("Jumlah belum benar."); f.amount.focus(); return; }
    S.tx.push({ id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: f.date.value || today(), type: f.type.value, amount,
      category: f.category.value.trim() || (f.type.value === "in" ? "Pemasukan lain" : "Pengeluaran lain"),
      account: f.account.value.trim() || "Utama", note: f.note.value.trim(), source: "manual" });
    save(); f.amount.value = ""; f.note.value = ""; renderTx(); toast("Transaksi ditambahkan.");
  });
  $("#exportCsv").addEventListener("click", () => {
    const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const lines = [["Tanggal", "Jenis", "Jumlah", "Kategori", "Akun", "Keterangan", "Transfer"].join(",")]
      .concat(filteredTx().map((t) => [t.date, t.type === "in" ? "Pemasukan" : "Pengeluaran", t.type === "in" ? t.amount : -t.amount, q(t.category), q(t.account), q(t.note), t.transfer ? "ya" : ""].join(",")));
    download("rekap-transaksi-" + today() + ".csv", "﻿" + lines.join("\r\n"), "text/csv");
  });
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- Membaca file ----------
  let jszipP;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return jszipP || (jszipP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "../vendor/jszip.min.js";
      s.onload = () => res(window.JSZip); s.onerror = () => { jszipP = null; rej(new Error("Pustaka Excel gagal dimuat. Periksa koneksi internet, atau simpan file sebagai CSV.")); };
      document.head.appendChild(s);
    }));
  }
  async function readXlsx(buf) {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buf);
    const xml = async (p) => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async("string"), "application/xml") : null; };
    const shared = [];
    const ss = await xml("xl/sharedStrings.xml");
    if (ss) Array.from(ss.getElementsByTagName("si")).forEach((si) => shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent).join("")));
    // Lembar pertama sesuai urutan di workbook.
    let path = "xl/worksheets/sheet1.xml";
    const wb = await xml("xl/workbook.xml"), rels = await xml("xl/_rels/workbook.xml.rels");
    const first = wb && wb.getElementsByTagName("sheet")[0];
    if (first && rels) {
      const rid = first.getAttribute("r:id") || first.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      const rel = Array.from(rels.getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
      if (rel) { const tg = rel.getAttribute("Target").replace(/^\//, ""); path = tg.startsWith("xl/") ? tg : "xl/" + tg; }
    }
    const sh = await xml(path);
    if (!sh) throw new Error("Lembar kerja Excel tidak ditemukan.");
    const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    return Array.from(sh.getElementsByTagName("row")).map((row) => {
      const out = [];
      Array.from(row.getElementsByTagName("c")).forEach((c, i) => {
        const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0], ref = c.getAttribute("r");
        let val = "";
        if (t === "s") val = v ? shared[+v.textContent] || "" : "";
        else if (t === "inlineStr") val = Array.from(c.getElementsByTagName("t")).map((x) => x.textContent).join("");
        else if (t === "str" || t === "b" || t === "e") val = v ? v.textContent : "";
        else if (v) { const n = Number(v.textContent); val = isNaN(n) ? v.textContent : n; }
        out[ref ? colIdx(ref) : i] = val;
      });
      for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
      return out;
    });
  }
  async function fileToRows(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx")) return readXlsx(await file.arrayBuffer());
    if (name.endsWith(".xls")) throw new Error("Format .xls lama belum didukung. Buka di Excel/Google Sheets lalu simpan sebagai .xlsx atau CSV.");
    if (name.endsWith(".pdf")) throw new Error("PDF belum bisa dibaca. Ekspor ulang dalam format CSV atau Excel.");
    const text = await readText(file);
    if (name.endsWith(".json") || /^\s*[[{]/.test(text)) return RK.jsonToRows(JSON.parse(text));
    return RK.parseCSV(text);
  }
  async function readText(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder("windows-1252").decode(buf); }
  }

  // ---------- Dialog pemetaan kolom ----------
  const ROLE_ORDER = ["date", "amount", "income", "expense", "type", "category", "account", "note"];
  function askMapping(name, analysis, savedMapping) {
    return new Promise((resolve) => {
      const dlg = $("#mapDlg"), { headers, body } = analysis;
      const m = Object.assign({}, analysis.mapping, savedMapping || {});
      $("#mapInfo").textContent = `${name} · dikenali sebagai: ${analysis.app} · ${body.length.toLocaleString("id-ID")} baris`;
      const opts = (sel) => `<option value="">— tidak ada —</option>` + headers.map((h, i) => `<option value="${i}" ${String(sel) === String(i) ? "selected" : ""}>${esc(h)}</option>`).join("");
      $("#mapGrid").innerHTML = ROLE_ORDER.map((r) => `<label>${RK.ROLE_LABEL[r]}<select data-role="${r}">${opts(m[r])}</select></label>`).join("") +
        `<label>Arti angka<select data-opt="sign"><option value="auto">Negatif = pengeluaran (otomatis)</option><option value="allOut">Semua pengeluaran</option><option value="allIn">Semua pemasukan</option></select></label>` +
        `<label>Format tanggal<select data-opt="dayFirst"><option value="1">Hari/bulan/tahun</option><option value="0">Bulan/hari/tahun</option></select></label>`;
      $("[data-opt=sign]", dlg).value = m.sign || "auto";
      $("[data-opt=dayFirst]", dlg).value = m.dayFirst === false ? "0" : "1";
      const read = () => {
        const out = {};
        $$("[data-role]", dlg).forEach((s) => { out[s.dataset.role] = s.value === "" ? undefined : +s.value; });
        out.sign = $("[data-opt=sign]", dlg).value; out.dayFirst = $("[data-opt=dayFirst]", dlg).value === "1";
        return out;
      };
      const preview = () => {
        const mm = read(), res = RK.rowsToTransactions(body, mm, "preview");
        const warn = [];
        if (mm.date == null) warn.push("Pilih kolom tanggal.");
        if (mm.amount == null && mm.income == null && mm.expense == null) warn.push("Pilih kolom jumlah, atau kolom pemasukan/pengeluaran.");
        if (res.tx.length && mm.sign === "auto" && mm.type == null && mm.income == null && mm.expense == null && res.tx.every((t) => t.type === "in"))
          warn.push("Semua angka positif sehingga terbaca sebagai pemasukan. Jika ini daftar pengeluaran, ubah “Arti angka”.");
        if (res.skipped) warn.push(`${res.skipped} baris dilewati (tanggal/jumlah kosong atau tidak terbaca).`);
        $("#mapWarn").textContent = warn.join(" ");
        $("#mapPrev").innerHTML = res.tx.slice(0, 8).map((t) => `<tr><td style="white-space:nowrap">${fmtDate(t.date)}</td><td>${esc(t.note)}</td><td>${esc(t.category)}</td><td>${esc(t.account)}</td><td class="num ${t.type === "in" ? "amt-in" : ""}">${t.type === "in" ? "+" : "−"}${fmt(t.amount)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Belum ada baris yang terbaca.</td></tr>`;
        $("#mapOk").textContent = `Impor ${res.tx.length.toLocaleString("id-ID")} transaksi`;
        $("#mapOk").disabled = !res.tx.length;
      };
      $("#mapGrid").onchange = preview;
      preview();
      dlg.onclose = () => resolve(dlg.returnValue === "ok" ? read() : null);
      dlg.returnValue = "";
      dlg.showModal();
    });
  }

  const sig = (headers) => RK.hash(headers.map((h) => String(h).toLowerCase()).join("|"));

  function addTx(list) {
    const have = new Set(S.tx.map((t) => t.id));
    let added = 0;
    for (const t of list) if (!have.has(t.id)) { S.tx.push(t); have.add(t.id); added++; }
    return added;
  }

  async function importFile(file) {
    try {
      const rows = await fileToRows(file);
      const a = RK.analyzeTable(rows);
      if (!a.body.length) throw new Error("File tidak berisi baris data.");
      const hs = sig(a.headers);
      const prev = S.sources.find((s) => s.kind === "file" && s.sig === hs);
      const mapping = await askMapping(file.name, a, prev && prev.mapping);
      if (!mapping) return;
      const src = prev || { id: "f" + hs, kind: "file", sig: hs };
      Object.assign(src, { name: file.name, app: a.app, mapping, lastSync: new Date().toISOString() });
      if (!prev) S.sources.push(src);
      const { tx } = RK.rowsToTransactions(a.body, mapping, src.id);
      const added = addTx(tx);
      save(); period = null; render();
      toast(`${added.toLocaleString("id-ID")} transaksi baru diimpor${tx.length - added ? `, ${tx.length - added} sudah ada (dilewati)` : ""}.`);
    } catch (e) { toast(`${file.name}: ${e.message}`); }
  }

  async function fetchRows(url) {
    let res;
    try { res = await fetch(RK.normalizeSheetUrl(url), { cache: "no-store" }); }
    catch (e) { throw new Error("Tautan tidak bisa diakses. Pastikan sheet dibagikan ke publik (siapa saja yang memiliki link) dan Anda sedang online."); }
    if (!res.ok) throw new Error(`Tautan menolak permintaan (kode ${res.status}). Pastikan sheet dibagikan ke publik.`);
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error("Tautan mengembalikan halaman web, bukan data. Untuk Google Sheets, bagikan ke “Siapa saja yang memiliki link”.");
    return /^\s*[[{]/.test(text) ? RK.jsonToRows(JSON.parse(text)) : RK.parseCSV(text);
  }

  async function syncSource(src, quiet) {
    const a = RK.analyzeTable(await fetchRows(src.url));
    const mapping = src.sig === sig(a.headers) ? src.mapping : a.mapping;
    const { tx } = RK.rowsToTransactions(a.body, mapping, src.id);
    // Tautan adalah sumber kebenaran: ganti seluruh transaksi dari sumber ini.
    const before = S.tx.filter((t) => t.source === src.id).length;
    S.tx = S.tx.filter((t) => t.source !== src.id);
    addTx(tx);
    Object.assign(src, { mapping, sig: sig(a.headers), lastSync: new Date().toISOString(), error: undefined });
    if (!quiet) toast(`${src.name}: ${tx.length} transaksi (${tx.length - before >= 0 ? "+" : ""}${tx.length - before}).`);
  }

  async function syncAll(quiet) {
    const list = S.sources.filter((s) => s.kind === "url");
    if (!list.length) return;
    $("#syncBtn").disabled = true; $("#syncBtn").textContent = "⟳ Menyinkronkan…";
    let ok = 0;
    for (const s of list) {
      try { await syncSource(s, true); ok++; } catch (e) { s.error = e.message; }
    }
    save(); render();
    $("#syncBtn").disabled = false; $("#syncBtn").textContent = "⟳ Sinkronkan";
    const failed = list.length - ok;
    if (!quiet || failed) toast(failed ? `${failed} tautan gagal disinkronkan — lihat tab Hubungkan aplikasi.` : `${ok} tautan tersinkron.`);
  }
  $("#syncBtn").addEventListener("click", () => syncAll(false));

  $("#urlForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = $("#urlIn").value.trim();
    const btn = $("button", e.target); btn.disabled = true; btn.textContent = "Mengambil…";
    try {
      const a = RK.analyzeTable(await fetchRows(url));
      if (!a.body.length) throw new Error("Tautan tidak berisi baris data.");
      let name = "Google Sheets";
      try { const u = new URL(url); name = /google/.test(u.hostname) ? "Google Sheets" : u.hostname; } catch (er) { /* abaikan */ }
      const mapping = await askMapping(name, a);
      if (!mapping) return;
      const src = { id: "u" + RK.hash(url), kind: "url", url, name, app: a.app, mapping, sig: sig(a.headers) };
      S.sources = S.sources.filter((s) => s.id !== src.id).concat(src);
      S.tx = S.tx.filter((t) => t.source !== src.id);
      const { tx } = RK.rowsToTransactions(a.body, mapping, src.id);
      addTx(tx); src.lastSync = new Date().toISOString();
      save(); $("#urlIn").value = ""; period = null; render();
      toast(`Terhubung. ${tx.length} transaksi dimuat dan akan diperbarui setiap aplikasi dibuka.`);
    } catch (er) { toast(er.message); }
    finally { btn.disabled = false; btn.textContent = "Hubungkan"; }
  });

  const fileIn = $("#fileIn"), drop = $("#drop");
  fileIn.addEventListener("change", async () => { for (const f of fileIn.files) await importFile(f); fileIn.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", async (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) await importFile(f); });

  function renderSources() {
    const counts = {};
    S.tx.forEach((t) => { counts[t.source] = (counts[t.source] || 0) + 1; });
    const list = S.sources.slice();
    if (counts.manual) list.push({ id: "manual", name: "Catatan manual", kind: "manual" });
    $("#srcList").innerHTML = list.length ? list.map((s) => `<div class="src">
      <div class="info"><b>${esc(s.name)}</b> <span class="tag">${s.kind === "url" ? "tautan · sinkron otomatis" : s.kind === "file" ? "file" : s.kind === "demo" ? "contoh" : "manual"}</span>
        <div class="small muted">${(counts[s.id] || 0).toLocaleString("id-ID")} transaksi${s.app ? " · " + esc(s.app) : ""}${s.lastSync ? " · diperbarui " + new Date(s.lastSync).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : ""}</div>
        ${s.error ? `<div class="small" style="color:var(--bad)">${esc(s.error)}</div>` : ""}</div>
      ${s.kind === "url" ? `<button class="btn sm" data-sync="${esc(s.id)}">Sinkronkan</button>` : ""}
      <button class="btn sm danger" data-rm="${esc(s.id)}">Lepas &amp; hapus datanya</button></div>`).join("")
      : `<p class="muted small">Belum ada. Impor file atau hubungkan tautan di atas.</p>`;
  }
  $("#srcList").addEventListener("click", async (e) => {
    const rm = e.target.closest("[data-rm]"), sy = e.target.closest("[data-sync]");
    if (rm) {
      const id = rm.dataset.rm, n = S.tx.filter((t) => t.source === id).length;
      if (!confirm(`Lepas sumber ini dan hapus ${n} transaksinya?`)) return;
      S.tx = S.tx.filter((t) => t.source !== id); S.sources = S.sources.filter((s) => s.id !== id);
      save(); render(); toast("Sumber dilepas.");
    } else if (sy) {
      const s = S.sources.find((x) => x.id === sy.dataset.sync);
      sy.disabled = true;
      try { await syncSource(s); } catch (er) { s.error = er.message; toast(er.message); }
      save(); render();
    }
  });

  // ---------- Akun & saldo ----------
  function renderAccounts() {
    const rows = accounts().map((a) => {
      const mine = S.tx.filter((t) => t.account === a);
      const i = mine.filter((t) => t.type === "in").reduce((x, t) => x + t.amount, 0);
      const o = mine.filter((t) => t.type === "out").reduce((x, t) => x + t.amount, 0);
      const op = +S.opening[a] || 0;
      return { a, i, o, op, now: op + i - o };
    });
    $("#accBody").innerHTML = rows.map((r) => `<tr><td>${esc(r.a)}</td>
      <td class="num"><input type="text" inputmode="decimal" data-open="${esc(r.a)}" value="${r.op ? r.op.toLocaleString("id-ID") : ""}" placeholder="0" style="width:130px;text-align:right" aria-label="Saldo awal ${esc(r.a)}"></td>
      <td class="num amt-in">${fmt(r.i)}</td><td class="num">${fmt(r.o)}</td><td class="num" style="font-weight:600;${r.now < 0 ? "color:var(--bad)" : ""}">${fmt(r.now)}</td></tr>`).join("") ||
      `<tr><td colspan="5" class="muted">Belum ada akun. Akun muncul otomatis dari data yang diimpor.</td></tr>`;
    const tot = rows.reduce((x, r) => x + r.now, 0);
    $("#accFoot").innerHTML = rows.length ? `<tr><th>Total uang</th><th></th><th></th><th></th><th class="num" style="color:var(--text);font-size:16px">${fmt(tot)}</th></tr>` : "";
    $("#inclTransfer").checked = !!S.settings.includeTransfers;
  }
  $("#accBody").addEventListener("change", (e) => {
    const i = e.target.closest("[data-open]"); if (!i) return;
    const v = RK.parseAmount(i.value);
    if (isNaN(v) || !v) delete S.opening[i.dataset.open]; else S.opening[i.dataset.open] = v;
    save(); renderAccounts();
  });
  $("#inclTransfer").addEventListener("change", (e) => { S.settings.includeTransfers = e.target.checked; save(); });
  $("#backupBtn").addEventListener("click", () => download("rekap-keuangan-cadangan-" + today() + ".json", JSON.stringify(S, null, 1), "application/json"));
  $("#restoreIn").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.tx)) throw new Error("bukan file cadangan Rekap Keuangan");
      if (!confirm(`Ganti data sekarang dengan cadangan berisi ${d.tx.length} transaksi?`)) return;
      S = Object.assign(blank(), d); save(); period = null; render(); toast("Cadangan dipulihkan.");
    } catch (er) { toast("Gagal memulihkan: " + er.message); }
    e.target.value = "";
  });
  $("#wipeBtn").addEventListener("click", () => {
    if (!confirm("Hapus SEMUA transaksi, sumber, dan saldo awal dari perangkat ini?")) return;
    S = blank(); save(); period = null; render(); toast("Semua data dihapus.");
  });

  // ---------- Data contoh ----------
  $("#demoBtn").addEventListener("click", () => {
    const tx = [], now = new Date();
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const push = (d, type, amount, category, account, note) => {
      const date = iso(d); if (date > today()) return null;
      const t = { id: "d" + tx.length, date, type, amount: Math.round(amount / 500) * 500, category, account, note, source: "demo" };
      tx.push(t); return t;
    };
    for (let k = 5; k >= 0; k--) {
      const y = now.getFullYear(), m = now.getMonth() - k, days = new Date(y, m + 1, 0).getDate();
      push(new Date(y, m, 1), "in", 8500000, "Gaji", "Bank BCA", "Gaji bulanan");
      if (rnd() > 0.4) push(new Date(y, m, 12), "in", 750000 + rnd() * 2000000, "Freelance", "Bank BCA", "Proyek desain");
      push(new Date(y, m, 2), "out", 2200000, "Kos & tempat tinggal", "Bank BCA", "Bayar kos");
      push(new Date(y, m, 5), "out", 280000 + rnd() * 120000, "Tagihan", "E-wallet", "Listrik & internet");
      // Pindah dana antar-akun: tidak dihitung pemasukan/pengeluaran, tapi mengubah saldo per akun.
      const tOut = push(new Date(y, m, 3), "out", 1500000, "Transfer", "Bank BCA", "Isi dompet tunai");
      const tIn = push(new Date(y, m, 3), "in", 1500000, "Transfer", "Tunai", "Isi dompet tunai");
      if (tOut) tOut.transfer = true;
      if (tIn) tIn.transfer = true;
      for (let d = 1; d <= days; d++) {
        push(new Date(y, m, d), "out", 18000 + rnd() * 40000, "Makan & minum", rnd() > 0.5 ? "Tunai" : "E-wallet", rnd() > 0.5 ? "Makan siang" : "Kopi & camilan");
        if (rnd() > 0.55) push(new Date(y, m, d), "out", 12000 + rnd() * 30000, "Transportasi", "E-wallet", "Ojek online");
        if (d % 7 === 6) push(new Date(y, m, d), "out", 250000 + rnd() * 400000, "Belanja bulanan", "Bank BCA", "Supermarket");
        if (d % 10 === 9 && rnd() > 0.4) push(new Date(y, m, d), "out", 100000 + rnd() * 300000, "Hiburan", "E-wallet", "Nonton / langganan");
      }
    }
    S.tx = S.tx.filter((t) => t.source !== "demo").concat(tx);
    S.sources = S.sources.filter((s) => s.id !== "demo").concat({ id: "demo", kind: "demo", name: "Data contoh", lastSync: new Date().toISOString() });
    S.opening = Object.assign({ "Bank BCA": 4000000, "Tunai": 300000, "E-wallet": 3500000 }, S.opening);
    save(); period = null; render();
    toast("Data contoh dimuat. Lepas lewat tab Hubungkan aplikasi kapan saja.");
  });

  // ---------- Render ----------
  function render() {
    const tab = ($("nav.tabs button[aria-selected=true]") || {}).dataset;
    const name = tab ? tab.tab : "ringkasan";
    if (name === "ringkasan") renderDash();
    if (name === "transaksi") renderTx();
    if (name === "hubungkan") renderSources();
    if (name === "akun") renderAccounts();
    $("#syncBtn").hidden = !S.sources.some((s) => s.kind === "url");
  }

  let startTab = "ringkasan";
  try { startTab = sessionStorage.getItem(KEY + ".tab") || startTab; } catch (e) { /* abaikan */ }
  showTab(startTab);
  if (S.sources.some((s) => s.kind === "url") && navigator.onLine !== false) syncAll(true);

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
