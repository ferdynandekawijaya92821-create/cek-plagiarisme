"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = { mode: "both", hl: "plagiarism", result: null, text: "", compareDocs: [] };

const SAMPLE = `Di era digital saat ini, teknologi memainkan peran penting dalam kehidupan sehari-hari. Selain itu, perkembangan teknologi membuka peluang baru bagi masyarakat untuk berinovasi. Oleh karena itu, penting untuk dicatat bahwa pemanfaatan teknologi harus dilakukan secara bijak dan bertanggung jawab.

Lebih lanjut, pendidikan merupakan salah satu aspek penting yang terdampak oleh transformasi digital. Pemanasan global adalah peningkatan suhu rata-rata permukaan bumi yang terutama disebabkan oleh aktivitas manusia seperti pembakaran bahan bakar fosil dan penggundulan hutan.

Secara keseluruhan, teknologi memiliki dampak yang luas terhadap berbagai aspek kehidupan. Kesimpulannya, kolaborasi antara berbagai pihak sangat penting untuk menciptakan masa depan yang berkelanjutan.`;

const LABELS = {
  burstiness: ["Keseragaman panjang kalimat", "Tinggi = kalimat panjangnya mirip-mirip (ciri AI)"],
  frasa_ai: ["Frasa khas AI", "Kepadatan frasa klise model bahasa"],
  konektor_awal: ["Konektor di awal kalimat", "Selain itu, Oleh karena itu, Furthermore…"],
  keseragaman_paragraf: ["Keseragaman paragraf", "Paragraf dengan panjang seragam"],
  repetisi_awal: ["Repetisi pembuka kalimat", "Kata pertama kalimat sering berulang"],
  leksikal: ["Kosakata 'rapi'", "Keragaman kosakata pada rentang tipikal AI"],
  informalitas: ["Informalitas (sinyal manusia)", "Bahasa gaul, singkatan, tanda seru — menurunkan skor"],
};

function toast(msg, ms = 3500) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const color = (v) => (v < 35 ? "var(--ok)" : v < 65 ? "var(--warn)" : "var(--bad)");

async function api(path, opts) {
  const res = await fetch(path, opts);
  let data;
  try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
async function extractFile(file) {
  const fd = new FormData(); fd.append("file", file);
  return api("/api/extract", { method: "POST", body: fd });
}

/* ---------- Tabs & segmented controls ---------- */
$$(".tab").forEach((b) => b.addEventListener("click", () => {
  $$(".tab").forEach((x) => x.classList.toggle("active", x === b));
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + b.dataset.tab));
}));
$$("#modeSeg button").forEach((b) => b.addEventListener("click", () => {
  $$("#modeSeg button").forEach((x) => x.classList.toggle("active", x === b));
  state.mode = b.dataset.mode;
  $("#sourcesBox").style.display = state.mode === "ai" ? "none" : "";
}));
$$("#hlSeg button").forEach((b) => b.addEventListener("click", () => {
  $$("#hlSeg button").forEach((x) => x.classList.toggle("active", x === b));
  state.hl = b.dataset.hl; renderHighlight();
}));

/* ---------- Main input ---------- */
const mainText = $("#mainText");
function updateCount() {
  const t = mainText.value;
  const w = (t.match(/[\p{L}\p{N}]+/gu) || []).length;
  $("#wordCount").textContent = `${w.toLocaleString("id")} kata`;
  $("#charCount").textContent = `${t.length.toLocaleString("id")} karakter`;
}
mainText.addEventListener("input", updateCount);
$("#sampleBtn").onclick = () => { mainText.value = SAMPLE; updateCount(); };
$("#clearBtn").onclick = () => { mainText.value = ""; updateCount(); $("#results").hidden = true; };
$("#mainFile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const d = await extractFile(f); mainText.value = d.text; updateCount(); toast(`Berkas "${f.name}" dimuat.`); }
  catch (err) { toast(err.message); }
  e.target.value = "";
};

/* ---------- Sources ---------- */
function addSource(name = "", text = "") {
  const div = document.createElement("div");
  div.className = "source-item";
  div.innerHTML = `<div class="row"><input type="text" placeholder="Nama sumber (mis. Wikipedia, Tugas Budi)">
    <button class="btn ghost small" title="Hapus">✕</button></div>
    <textarea placeholder="Tempel teks sumber…"></textarea>`;
  $("input", div).value = name; $("textarea", div).value = text;
  $("button", div).onclick = () => { div.remove(); updateSrcCount(); };
  $("#sourceList").appendChild(div); updateSrcCount();
}
function updateSrcCount() { $("#srcCount").textContent = $$("#sourceList .source-item").length; }
$("#addSourceBtn").onclick = () => addSource();
$("#sourceFiles").onchange = async (e) => {
  for (const f of e.target.files) {
    try { const d = await extractFile(f); addSource(f.name, d.text); }
    catch (err) { toast(`${f.name}: ${err.message}`); }
  }
  $("#sourcesBox").open = true; e.target.value = "";
};
function collectSources() {
  return $$("#sourceList .source-item").map((d, i) => ({
    name: $("input", d).value.trim() || `Sumber ${i + 1}`, text: $("textarea", d).value,
  })).filter((s) => s.text.trim());
}

/* ---------- Check ---------- */
$("#checkBtn").onclick = async () => {
  const text = mainText.value;
  if (!text.trim()) return toast("Masukkan teks terlebih dahulu.");
  const btn = $("#checkBtn"); const old = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Memeriksa…`;
  try {
    const data = await api("/api/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mode: state.mode, sources: collectSources(),
        use_corpus: $("#useCorpus").checked, ngram: +$("#ngram").value }),
    });
    state.result = data; state.text = text;
    renderResults();
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.innerHTML = old; }
};

function setRing(id, v) {
  const r = $(id); r.style.setProperty("--val", v); r.style.setProperty("--col", color(v));
  $("span", r).textContent = `${Math.round(v)}%`;
}

function renderResults() {
  const { plagiarism: p, ai } = state.result;
  $("#results").hidden = false;
  $("#plagCard").hidden = !p; $("#sourcesCard").hidden = !p;
  $("#aiCard").hidden = !ai; $("#signalsCard").hidden = !ai;
  $$("#hlSeg button").forEach((b) => (b.hidden = !state.result[b.dataset.hl]));
  if (!state.result[state.hl]) { state.hl = p ? "plagiarism" : "ai"; $$("#hlSeg button").forEach((b) => b.classList.toggle("active", b.dataset.hl === state.hl)); }

  const warns = [];
  if (p) {
    setRing("#plagRing", p.score);
    $("#plagLabel").textContent = p.source_count === 0
      ? "Tidak ada sumber pembanding — tambahkan sumber atau aktifkan korpus."
      : `${p.score < 15 ? "Orisinal" : p.score < 40 ? "Ada kemiripan" : "Kemiripan tinggi"} · ${p.matches.length} bagian cocok dari ${p.source_count} sumber`;
    const tb = $("#srcTable tbody");
    const rows = p.sources.filter((s) => s.overlap_percent > 0 || s.cosine_similarity >= 20).slice(0, 15);
    tb.innerHTML = rows.length ? rows.map((s) => `<tr><td>${esc(s.name)}</td>
      <td class="num">${s.overlap_percent}%<div class="bar"><i style="width:${s.overlap_percent}%;--col:${color(s.overlap_percent)}"></i></div></td>
      <td class="num">${s.cosine_similarity}%</td></tr>`).join("")
      : `<tr><td colspan="3" class="muted">Tidak ada sumber yang cocok.</td></tr>`;
  }
  if (ai) {
    setRing("#aiRing", ai.score);
    $("#aiLabel").textContent = `${ai.label} · ${ai.sentence_count} kalimat, ${ai.word_count} kata`;
    $("#signals").innerHTML = Object.entries(ai.signals).map(([k, v]) => {
      const [name, desc] = LABELS[k] || [k, ""];
      const c = k === "informalitas" ? "var(--ok)" : color(v);
      return `<div class="signal"><div class="top"><span>${name}</span><b>${v}%</b></div>
        <div class="bar"><i style="width:${v}%;--col:${c}"></i></div><small>${desc}</small></div>`;
    }).join("");
    const ph = Object.entries(ai.ai_phrases_found);
    $("#phrases").innerHTML = ph.length ? ph.map(([k, n]) => `<span class="chip">${esc(k)} ×${n}</span>`).join("") : `<span class="muted">Tidak ada.</span>`;
    $("#disclaimer").textContent = "⚠️ " + ai.disclaimer;
    warns.push(...ai.warnings);
  }
  $("#warnings").innerHTML = warns.map((w) => `<div class="warn-box">⚠️ ${esc(w)}</div>`).join("");
  renderHighlight();
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderHighlight() {
  const r = state.result; if (!r) return;
  const text = state.text; const box = $("#highlight");
  let spans = [];
  if (state.hl === "plagiarism" && r.plagiarism) {
    spans = r.plagiarism.matches.map((m) => ({ s: m.start, e: m.end, cls: "plag", title: `Cocok dengan: ${m.source}` }));
    $("#legend").innerHTML = `<span><i style="background:var(--hl-plag)"></i>Teks yang cocok dengan sumber (arahkan kursor untuk nama sumber)</span>`;
  } else if (r.ai) {
    spans = r.ai.sentences.filter((s) => s.score >= 40).map((s) => ({
      s: s.start, e: s.end, cls: s.score >= 70 ? "ai3" : s.score >= 55 ? "ai2" : "ai1", title: `Skor AI kalimat: ${s.score}%`,
    }));
    $("#legend").innerHTML = `<span><i style="background:var(--hl-ai-1)"></i>40–55%</span>
      <span><i style="background:var(--hl-ai-2)"></i>55–70%</span><span><i style="background:var(--hl-ai-3)"></i>≥ 70%</span>`;
  }
  // Teks yang dikirim ke server sudah dinormalisasi (CRLF→LF); samakan di sini.
  // Offset dari server dihitung per code point (Python), jadi iris per code point juga.
  const t = Array.from(text.normalize("NFKC").replace(/\r\n?/g, "\n"));
  const sl = (a, b) => t.slice(a, b).join("");
  let html = "", pos = 0;
  for (const sp of spans.sort((a, b) => a.s - b.s)) {
    if (sp.s < pos) continue;
    html += esc(sl(pos, sp.s)) + `<mark class="${sp.cls}" title="${esc(sp.title)}">${esc(sl(sp.s, sp.e))}</mark>`;
    pos = sp.e;
  }
  box.innerHTML = html + esc(sl(pos));
}

$("#exportJson").onclick = () => {
  if (!state.result) return;
  const blob = new Blob([JSON.stringify({ tanggal: new Date().toISOString(), teks: state.text, hasil: state.result }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "laporan-cekteks.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/* ---------- Compare ---------- */
const dz = $("#dropzone");
["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", (e) => addCompareFiles(e.dataTransfer.files));
$("#compareFiles").onchange = (e) => { addCompareFiles(e.target.files); e.target.value = ""; };

async function addCompareFiles(files) {
  for (const f of files) {
    try { const d = await extractFile(f); state.compareDocs.push({ name: f.name, text: d.text }); }
    catch (err) { toast(`${f.name}: ${err.message}`); }
  }
  renderCompareList();
}
function renderCompareList() {
  const ul = $("#compareList");
  ul.innerHTML = state.compareDocs.map((d, i) => `<li><span>📄 ${esc(d.name)} <span class="muted">(${(d.text.match(/[\p{L}\p{N}]+/gu) || []).length} kata)</span></span><button data-i="${i}">Hapus</button></li>`).join("");
  $$("button", ul).forEach((b) => (b.onclick = () => { state.compareDocs.splice(+b.dataset.i, 1); renderCompareList(); }));
  $("#compareBtn").disabled = state.compareDocs.length < 2;
}
$("#compareBtn").onclick = async () => {
  try {
    const d = await api("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docs: state.compareDocs }) });
    $("#compareResult").hidden = false;
    $("#cmpTable tbody").innerHTML = d.pairs.map((p) => `<tr><td>${esc(p.a)}</td><td>${esc(p.b)}</td>
      <td class="num" style="color:${color(p.a_in_b)}">${p.a_in_b}%</td><td class="num" style="color:${color(p.b_in_a)}">${p.b_in_a}%</td>
      <td class="num">${p.cosine_similarity}%</td></tr>`).join("");
  } catch (err) { toast(err.message); }
};

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("#installBtn").hidden = false; });
$("#installBtn").onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("#installBtn").hidden = true;
};
updateCount();
