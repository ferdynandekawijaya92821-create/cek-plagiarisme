// Uji ujung-ke-ujung CekTeks di browser sungguhan (Chromium lewat Playwright).
// Menguji situs web (docs/) lewat server lokal dan file mandiri (dist/CekTeks.html) tanpa internet.
//
// Jalankan dari folder cekteks/web:  npm install && npx playwright install chromium && npm test
"use strict";
const { chromium, devices } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const WEB = path.resolve(__dirname, "..");
const DOCS = path.resolve(WEB, "../../docs");
const DIST = path.resolve(WEB, "../dist/CekTeks.html");
const FIX = path.join(__dirname, "fixtures");
let AXE = process.env.AXE_PATH;
try { AXE = AXE || require.resolve("axe-core/axe.min.js"); } catch (e) { AXE = null; }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.log("  ✗ " + name + "\n      " + (e && e.message ? e.message.split("\n")[0] : e)); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

function serve(dir) {
  const types = { ".html": "text/html", ".js": "application/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain" };
  const srv = http.createServer((req, res) => {
    let f = path.join(dir, decodeURIComponent(req.url.split("?")[0]));
    if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv)));
}
async function newPage(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, opts || {}));
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return { ctx, page };
}
// Daftar sumber cek internet ada di panel yang bisa dilipat; centang diatur langsung.
async function srcOnly(page, ids) { await page.evaluate((ids) => document.querySelectorAll("#srcPick .checks input").forEach((c) => { c.checked = ids.includes(c.id); }), ids); }
async function srcDefault(page) { await page.evaluate(() => document.querySelectorAll("#srcPick .checks input").forEach((c) => { c.checked = c.defaultChecked; })); }
async function ready(page) { await page.waitForFunction(() => window.S && S.ai, null, { timeout: 30000 }); }
async function download(page, selector) {
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click(selector)]);
  const buf = fs.readFileSync(await d.path());
  return { name: d.suggestedFilename(), buf };
}

(async () => {
  const browser = await chromium.launch();
  const srv = await serve(DOCS);
  const SITE = "http://127.0.0.1:" + srv.address().port + "/";

  console.log("Situs web (docs/)");
  const { ctx, page } = await newPage(browser, { viewport: { width: 1366, height: 900 } });
  await test("halaman terbuka, contoh dianalisis, tanpa error", async () => {
    await page.goto(SITE); await ready(page);
    // Skor dibaca dari hasil analisis; angka di layar beranimasi naik sekitar 0,6 detik.
    ok(await page.evaluate(() => S.ai.score) > 65, "teks contoh seharusnya cenderung AI");
    ok(await page.evaluate(() => S.plag.score) > 5, "teks contoh seharusnya cocok dengan korpus");
    ok(page.errors.length === 0, page.errors.join("; "));
  });
  await test("angka skor di layar berakhir sama dengan skor analisis", async () => {
    await page.waitForFunction(() => document.getElementById("aiVal").textContent === Math.round(S.ai.score) + "%" &&
      document.getElementById("plagVal").textContent === pctLabel(S.plag.score), null, { timeout: 5000 });
  });
  await test("halaman pertama ringan (pustaka dimuat terpisah)", async () => {
    // Yang diunduh browser adalah versi terkompresi (GitHub Pages mengirim gzip); pustaka besar dimuat terpisah.
    const raw = fs.readFileSync(path.join(DOCS, "index.html")), gz = require("zlib").gzipSync(raw, { level: 6 }).length;
    ok(gz < 160 * 1024, "docs/index.html terkompresi " + Math.round(gz / 1024) + " KB, lebih dari 160 KB");
    ok(!/pdf\.worker|mammoth\.browser/.test(raw.toString().slice(0, 200000)) || raw.length < 900 * 1024, "pustaka besar ikut tertanam di halaman situs");
  });
  await test("pratinjau tautan (Open Graph) lengkap", async () => {
    for (const prop of ["og:title", "og:description", "og:image", "twitter:card"]) {
      ok(await page.locator('meta[property="' + prop + '"], meta[name="' + prop + '"]').count() === 1, prop + " tidak ada");
    }
  });
  await test("unggah Word: teks terbaca dan cocok dengan korpus", async () => {
    await page.setInputFiles("#mainFile", path.join(FIX, "tugas.docx"));
    await page.waitForFunction(() => S.doc && S.doc.name === "tugas.docx");
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => S.plag.score) > 30, "kesamaan Word terlalu rendah");
    ok((await page.textContent("#srcRows")).includes("Fotosintesis"), "sumber Fotosintesis tidak muncul");
  });
  await test("unggah PDF: posisi teks dicatat per halaman", async () => {
    await page.setInputFiles("#mainFile", path.join(FIX, "sample.pdf"));
    await page.waitForFunction(() => S.doc && S.doc.layout, null, { timeout: 30000 });
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => S.doc.pages) === 2, "jumlah halaman PDF salah");
    ok(await page.evaluate(() => S.plag.score) > 30, "kesamaan PDF terlalu rendah");
  });
  await test("klik kartu sumber menyorot bagiannya", async () => {
    await page.click(".srcmain");
    ok(await page.evaluate(() => S.focusNo) === 1, "fokus sumber tidak aktif");
    ok(await page.isVisible("#focusBar"), "bilah fokus tidak tampil");
  });
  await test("unduh laporan PDF dengan halaman asli", async () => {
    const r = await download(page, "#dlPdf");
    ok(r.name.endsWith(".pdf") && r.buf.slice(0, 4).toString() === "%PDF", "bukan berkas PDF");
    const pages = (r.buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages >= 5, "laporan seharusnya 3 halaman ringkasan + 2 halaman dokumen, didapat " + pages);
  });
  await test("unduh laporan Word dan TXT", async () => {
    const w = await download(page, "#dlDoc"); ok(w.name.endsWith(".doc") && w.buf.toString().includes("Laporan Plagiarisme"), "Word tidak valid");
    const t = await download(page, "#dlTxt"); ok(t.buf.toString().includes("KESAMAAN"), "TXT tidak valid");
  });
  await test("tambah sumber sendiri ikut dibandingkan", async () => {
    await page.click("#tab-sumber"); await page.click("#addSrc");
    await page.fill("#srcText0", "Saat praktikum kemarin kami mengamati daun bayam di bawah mikroskop sekolah yang lensanya agak buram.");
    await page.click("#tab-periksa"); await page.waitForTimeout(500);
    ok(await page.evaluate(() => S.plag.groups.pengguna) > 0, "sumber pengguna tidak terhitung");
  });
  await test("bandingkan dokumen menemukan pasangan mirip", async () => {
    await page.click("#tab-bandingkan"); await page.waitForTimeout(300);
    ok(await page.locator(".pair").count() === 3, "seharusnya 3 pasangan contoh");
    ok((await page.textContent(".pair .verdict")) !== "Berbeda", "pasangan teratas seharusnya mirip");
  });
  const PARA = "Peningkatan temperatur rata-rata di permukaan bumi yang terutama diakibatkan oleh kegiatan manusia, contohnya pembakaran bahan bakar fosil serta penggundulan hutan, disebut pemanasan global. " +
    "Gas rumah kaca misalnya metana dan karbon dioksida menahan panas pada atmosfer, sehingga temperatur bumi naik terus setiap tahun.";
  await test("parafrase (sinonim & urutan diubah) terdeteksi, teks lain tidak", async () => {
    await page.click("#tab-periksa");
    await page.evaluate((t) => setText(t), PARA); await page.waitForTimeout(500);
    const r = await page.evaluate(() => [S.plag.paraScore, S.plag.matched[0] && S.plag.matched[0].name]);
    ok(r[0] > 50, "parafrase hanya " + r[0] + "%");
    ok(/Pemanasan global/.test(r[1] || ""), "sumber parafrase salah: " + r[1]);
    ok(await page.locator("#hl mark.para").count() > 0, "sorotan parafrase tidak tampil");
    await page.evaluate((t) => setText(t), "Kemarin aku ke pasar sama ibu. Rame banget! Mau beli cabai aja antrinya panjang, padahal cuma dua ons. Ibu sih santai, malah ngobrol sama penjual sayur langganannya soal harga bawang yang naik lagi.");
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => S.plag.score) === 0, "teks yang tidak berhubungan ikut ditandai");
  });
  await test("bank naskah: simpan, tetap ada setelah dimuat ulang, menangkap tugas mirip, ekspor/impor", async () => {
    await page.click("#tab-periksa");
    const A = "Teknologi informasi berkembang sangat cepat dalam sepuluh tahun terakhir. Banyak sekolah mulai memakai aplikasi pembelajaran daring untuk membantu siswa belajar dari rumah. Guru perlu menyesuaikan cara mengajar agar materi tetap mudah dipahami oleh semua siswa.";
    const B = "Dalam sepuluh tahun terakhir teknologi informasi berkembang sangat cepat. Banyak sekolah mulai memakai aplikasi pembelajaran daring untuk membantu siswa belajar dari rumah. Menurut saya guru harus lebih kreatif agar kelas daring tidak membosankan.";
    await page.evaluate((t) => setText(t), A); await page.fill("#clientName", "Klien Uji");
    await page.click("#bankSave"); await page.waitForFunction(() => BANK.length === 1);
    ok(await page.evaluate(() => S.plag.groups.bank) === 0, "naskah dibandingkan dengan dirinya sendiri di bank");
    await page.reload(); await ready(page); await page.waitForFunction(() => BANK.length === 1);
    await page.evaluate((t) => setText(t), B); await page.waitForTimeout(500);
    ok(await page.evaluate(() => S.plag.groups.bank) > 30, "tugas mirip tidak tertangkap dari bank");
    await page.click("#tab-sumber");
    const ex = await download(page, "#bankExport");
    const f = path.join(require("os").tmpdir(), "cekteks-bank-uji.json"); fs.writeFileSync(f, ex.buf);
    await page.click("#bankClear"); await page.click("#bankClear"); await page.waitForFunction(() => BANK.length === 0);
    await page.setInputFiles("#bankImport", f); await page.waitForFunction(() => BANK.length === 1);
    ok(await page.evaluate(() => BANK[0].client) === "Klien Uji", "nama klien hilang setelah impor");
    await page.click("#bankClear"); await page.click("#bankClear"); await page.waitForFunction(() => BANK.length === 0);
    await page.click("#tab-periksa");
  });
  await test("cek internet: hasil DOAJ & Crossref dibandingkan (respons tiruan)", async () => {
    await page.click("#tab-periksa");
    const ABS = "Kajian tentang kandungan klorofil pada daun mangga dengan perbedaan warna pada tingkat perkembangan yang berbeda belum banyak dilakukan. Penelitian ini bertujuan untuk membandingkan kandungan klorofil daun mangga pada tingkat perkembangan daun yang berbeda.";
    await ctx.route(/doaj\.org/, (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ results: [{ id: "x1", bibjson: { title: "Klorofil daun mangga", year: "2011", abstract: "<p>Abstrak</p><p>" + ABS + "</p>", identifier: [{ type: "doi", id: "10.1/uji" }] } }] }) }));
    await ctx.route(/api\.crossref\.org/, (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ message: { items: [{ DOI: "10.2/uji", URL: "https://doi.org/10.2/uji", title: ["Pigmen fotosintesis"], abstract: "<jats:p>Pigmen fotosintesis pada tumbuhan tingkat tinggi terdiri atas klorofil a, klorofil b, dan karotenoid yang tersimpan di dalam kloroplas sel daun tanaman.</jats:p>" }] } }) }));
    await page.evaluate((t) => setText(t), "Praktikum biologi minggu lalu membahas pigmen pada daun. " + ABS + " Kelompok kami juga mencoba mengukur klorofil daun jambu di halaman sekolah, tetapi alatnya terbatas.");
    await srcOnly(page, ["wDoaj", "wCrossref"]);
    await page.click("#webBtn");
    await page.waitForFunction(() => document.getElementById("webProg").hidden, null, { timeout: 30000 });
    const r = await page.evaluate(() => [S.plag.groups.publikasi, S.webSources.map((w) => w.kind).sort().join(",")]);
    ok(r[1].includes("DOAJ") && r[1].includes("Crossref"), "sumber yang ditemukan: " + r[1]);
    ok(r[0] > 50, "kesamaan dengan jurnal hanya " + r[0] + "%");
    await ctx.unroute(/doaj\.org/); await ctx.unroute(/api\.crossref\.org/);
    await page.click("#webClear");
    await srcDefault(page);
  });
  await test("naskah panjang (±26 halaman): kalimat dari seluruh naskah dicari, salinan di bagian akhir ketemu, peta naskah", async () => {
    await page.click("#tab-periksa");
    // Naskah buatan ±6.500 kata dengan kalimat acak (bukan salinan), lalu satu bagian disalin dari "Wikipedia" di dekat akhir.
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const V = ("petani warga desa sungai sawah ladang pupuk benih panen hujan kemarau irigasi koperasi pasar harga modal pinjaman bank " +
      "sekolah guru murid buku kelas ujian nilai jalan jembatan kantor camat lurah posyandu bidan dokter obat vaksin anak ibu ayah " +
      "kebun kopi kakao karet sawit ternak sapi kambing ayam ikan kolam perahu nelayan laut pantai angin ombak gunung hutan kayu rotan").split(" ");
    const sent = () => { const n = 9 + Math.floor(rnd() * 22); const w = []; for (let i = 0; i < n; i++) w.push(V[Math.floor(rnd() * V.length)]); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(" ") + "."; };
    const para = () => Array.from({ length: 4 + Math.floor(rnd() * 4) }, sent).join(" ");
    const WIKI = "Sungai Musi adalah sebuah sungai yang terletak di provinsi Sumatera Selatan, Indonesia. Dengan panjang sekitar 750 kilometer, sungai ini merupakan yang terpanjang di pulau Sumatra dan membelah Kota Palembang menjadi dua bagian. Jembatan Ampera yang menjadi ikon Kota Palembang pun melintas di atas sungai ini. Sejak zaman Kerajaan Sriwijaya, Sungai Musi terkenal sebagai sarana transportasi utama bagi masyarakat dan pedagang dari berbagai daerah. Hingga kini sungai tersebut masih dipakai untuk mengangkut hasil bumi seperti karet, kopi, dan batu bara dari daerah pedalaman menuju pelabuhan di hilir.";
    const AI = "Di era digital saat ini, teknologi memainkan peran penting dalam pembangunan desa. Selain itu, pemanfaatan teknologi membuka peluang baru bagi petani, nelayan, dan pelaku usaha kecil. Oleh karena itu, penting untuk dicatat bahwa transformasi digital harus dilakukan secara bijak, terarah, dan berkelanjutan. Lebih lanjut, kolaborasi antara pemerintah, swasta, dan masyarakat merupakan salah satu kunci utama keberhasilan. Dengan demikian, desa dapat mengoptimalkan potensi yang dimiliki secara efektif dan efisien. Secara keseluruhan, inovasi teknologi memiliki dampak yang signifikan terhadap kualitas hidup, kesejahteraan, dan daya saing masyarakat. Selain itu, pendekatan yang holistik memastikan bahwa manfaat teknologi dapat dirasakan oleh seluruh lapisan masyarakat. Oleh karena itu, sinergi berbagai pihak menjadi semakin penting di tengah pesatnya perkembangan zaman. Kesimpulannya, teknologi bukan sekadar alat, melainkan fondasi yang kuat bagi kemajuan desa, kota, dan bangsa.";
    const P = []; for (let i = 0; i < 70; i++) P.push(para());
    P.splice(28, 0, AI + "\n\n" + AI.replace("pembangunan desa", "kemajuan wilayah"));
    P.splice(62, 0, WIKI);
    const doc = "BAB I PENDAHULUAN\n\n" + P.join("\n\n");
    let wikiQ = 0, phraseQ = 0;
    await ctx.route(/wikipedia\.org\/w\/api\.php/, (r) => {
      const u = new URL(r.request().url()), q = (u.searchParams.get("srsearch") || "").toLowerCase();
      let body;
      if (u.searchParams.get("list") === "search") {
        wikiQ++; if (q.startsWith('"')) phraseQ++;
        const low = WIKI.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "");
        const hitW = q.startsWith('"') ? low.includes(q.replace(/"/g, "")) : q.includes("musi") && q.includes("palembang");
        body = { query: { search: hitW ? [{ title: "Sungai Musi" }] : [] } };
      } else body = { query: { pages: { "1": { title: "Sungai Musi", extract: WIKI + " Sungai ini juga menjadi tempat berbagai festival budaya." } } } };
      r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    });
    await srcOnly(page, ["wWikiId"]);
    await page.evaluate((t) => setText(t), doc); await page.waitForTimeout(800);
    ok(await page.isVisible("#nudgeWeb"), "ajakan cek internet tidak tampil sebelum pencarian");
    const nW = await page.evaluate(() => words(S.text).length);
    ok(nW > 6000, "naskah uji terlalu pendek: " + nW);
    await page.click("#nudgeWeb");
    await page.waitForFunction(() => document.getElementById("webProg").hidden && S.webChecked, null, { timeout: 60000 });
    const r = await page.evaluate(() => ({ q: S.lastQueries, net: S.plag.groups.internet, cov: coverage().join(" | "), nudge: !!document.getElementById("nudgeWeb") }));
    ok(r.q >= 25, "hanya " + r.q + " kalimat yang dicari");
    ok(phraseQ >= 25 && wikiQ - phraseQ >= 15, "pencarian Wikipedia terlalu sedikit: " + wikiQ + " (" + phraseQ + " frasa)");
    ok(r.net > 1, "salinan di bagian akhir tidak terdeteksi: " + r.net + "%");
    ok(/kalimat dari seluruh naskah dicari/.test(r.cov), "cakupan pencarian tidak tercatat: " + r.cov);
    ok(!r.nudge, "ajakan cek internet masih tampil");
    // Peta naskah & AI per bagian
    const m = await page.evaluate(() => ({ n: S.ai.sections.length, ai: S.ai.aiSections, cells: document.querySelectorAll("#dmAi button").length, vis: !document.getElementById("docMap").hidden, hiP: S.ai.sections.map((x) => x.score) }));
    ok(m.vis && m.n >= 15 && m.cells === m.n, "peta naskah tidak lengkap: " + JSON.stringify(m).slice(0, 200));
    ok(m.ai >= 1, "bagian bergaya AI tidak terdeteksi: " + m.hiP.join(","));
    await page.locator("#dmPlag button").nth(m.n - 2).click(); await page.waitForTimeout(100);
    ok(await page.locator("#hl .jump").count() === 1, "lompat ke bagian naskah tidak berfungsi");
    await ctx.unroute(/wikipedia\.org\/w\/api\.php/);
    await page.click("#webClear");
    await srcDefault(page);
  });
  await test("teks lengkap jurnal (OpenAlex): kalimat yang ada di isi artikel ditemukan; kuota habis diberi tahu", async () => {
    await page.click("#tab-periksa");
    const PAPER = "Hasil analisis menunjukkan bahwa penggunaan pupuk organik cair dari limbah kulit pisang mampu meningkatkan tinggi tanaman cabai rawit secara nyata dibandingkan dengan perlakuan kontrol pada umur enam minggu setelah tanam";
    const low = PAPER.toLowerCase();
    let calls = 0, quota = false;
    await ctx.route(/api\.openalex\.org/, (r) => {
      calls++;
      if (quota) return r.fulfill({ status: 429, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"error":"Rate limit exceeded"}' });
      const f = new URL(r.request().url()).searchParams.get("filter") || "", m = /fulltext\.search:"([^"]+)"/.exec(f);
      const hitP = m && low.includes(m[1]);
      r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ results: hitP ? [{ id: "https://openalex.org/W1", doi: "https://doi.org/10.9/pisang", display_name: "Pupuk organik cair kulit pisang", publication_year: 2017, abstract_inverted_index: { Penelitian: [0], tentang: [1], pupuk: [2] } }] : [] }) });
    });
    await srcOnly(page, ["wOpenAlex"]);
    const txt = "Kebun percobaan kami berada di belakang gedung jurusan dan sering tergenang ketika hujan deras turun sore hari. " + PAPER + ". Kami menyiram tanaman setiap pagi sebelum kuliah dimulai dan mencatat suhu udara dengan termometer sederhana.";
    await page.evaluate((t) => setText(t), txt); await page.waitForTimeout(400);
    await page.click("#webBtn");
    await page.waitForFunction(() => document.getElementById("webProg").hidden && S.webChecked, null, { timeout: 30000 });
    const r = await page.evaluate(() => ({ kinds: S.webSources.map((w) => w.kind).join(","), pub: S.plag.groups.publikasi, hits: S.lastOA.hits }));
    ok(r.kinds.includes("Teks lengkap jurnal") && r.hits === 1, "artikel tidak ditemukan: " + JSON.stringify(r));
    ok(r.pub > 35, "kesamaan dengan teks lengkap jurnal hanya " + r.pub + "%");
    quota = true; await page.click("#webClear"); await page.click("#webBtn");
    await page.waitForFunction(() => document.getElementById("webProg").hidden && !runWebSearch.busy, null, { timeout: 30000 });
    ok(/Kuota harian OpenAlex habis/.test(await page.textContent("#webStatus")), "kuota habis tidak diberitahukan: " + await page.textContent("#webStatus"));
    await ctx.unroute(/api\.openalex\.org/); await page.evaluate(() => { resetWeb(); run(); });
    await srcDefault(page);
  });
  await test("sumber diperluas: Google (Serper) + isi halaman (Tavily), Tavily search, OpenAIRE, Wikibooks; kunci ditolak diberi tahu", async () => {
    await page.click("#tab-periksa");
    const BLOG = "Sampah plastik yang dibuang ke sungai akan terbawa arus hingga ke laut dan terurai menjadi mikroplastik yang dimakan ikan serta biota laut lainnya";
    const WEB2 = "Bank sampah merupakan sistem pengelolaan sampah kering secara kolektif yang mendorong masyarakat untuk berperan serta aktif di dalamnya";
    const JOUR = "Partisipasi masyarakat dalam pengelolaan sampah rumah tangga dipengaruhi oleh tingkat pendidikan, pengetahuan, dan ketersediaan sarana di lingkungan tempat tinggal mereka";
    const BOOK = "Daur ulang adalah proses mengolah kembali barang bekas menjadi barang baru yang bermanfaat sehingga mengurangi jumlah sampah yang dibuang";
    const H = { "access-control-allow-origin": "*" }, J = (r, b, st) => r.fulfill({ status: st || 200, contentType: "application/json", headers: H, body: JSON.stringify(b) });
    const seen = {};
    await ctx.route(/google\.serper\.dev/, (r) => { seen.serper = (seen.serper || 0) + 1; const q = JSON.parse(r.request().postData()).q.replace(/"/g, "");
      J(r, { organic: BLOG.toLowerCase().includes(q.split(" ").slice(0, 6).join(" ")) ? [{ title: "Bahaya sampah plastik - Blog Hijau", link: "https://bloghijau.example/sampah-plastik", snippet: "… " + BLOG.slice(0, 120) + " …" }] : [] }); });
    await ctx.route(/api\.tavily\.com\/extract/, (r) => { seen.extract = JSON.parse(r.request().postData()).urls; J(r, { results: [{ url: "https://bloghijau.example/sampah-plastik", raw_content: "# Bahaya sampah plastik\n\nIni tulisan blog. " + BLOG + ". Karena itu kurangi kantong plastik." }] }); });
    await ctx.route(/api\.tavily\.com\/search/, (r) => { seen.tsearch = (seen.tsearch || 0) + 1; J(r, { results: [{ title: "Apa itu bank sampah", url: "https://berita.example/bank-sampah", raw_content: "Pengertian. " + WEB2 + ". Nasabah menabung sampah." }] }); });
    await ctx.route(/api\.openaire\.eu/, (r) => J(r, { response: { results: { result: [{ metadata: { "oaf:entity": { "oaf:result": { title: [{ "@classid": "main title", $: "Partisipasi masyarakat dalam pengelolaan sampah" }], description: { $: "<p>" + JOUR + ". Penelitian ini memakai metode survei terhadap seratus responden di kelurahan.</p>" }, pid: { "@classid": "doi", $: "10.7/sampah" }, dateofacceptance: { $: "2018-03-01" } } } } }] } } }));
    await ctx.route(/wikibooks\.org|wikisource\.org/, (r) => { const u = new URL(r.request().url());
      if (u.searchParams.get("list") === "search") return J(r, { query: { search: /wikibooks/.test(u.host) && BOOK.toLowerCase().replace(/[^\p{L} ]/gu, "").includes((u.searchParams.get("srsearch") || "").replace(/"/g, "")) ? [{ title: "Daur ulang" }] : [] } });
      J(r, { query: { pages: { "5": { title: "Daur ulang", extract: "Bab 2. " + BOOK + ". Contohnya kertas bekas." } } } }); });
    await ctx.route(/api\.core\.ac\.uk/, (r) => J(r, { message: "Invalid API key" }, 401));
    await page.evaluate(() => { store("ct_serper", "uji"); store("ct_tavily", "uji"); store("ct_core", "uji"); updKeys(); });
    await srcOnly(page, ["wSerper", "wTavily", "wOpenAire", "wWikiBooks", "wCore"]);
    const txt = "Di kampung kami, sungai kecil di belakang pasar selalu penuh sampah setiap musim hujan datang. " + BLOG + ". Ibu-ibu PKK lalu membentuk kelompok sendiri untuk memilah sampah di rumah. " + WEB2 + ". " + JOUR + ". Anak-anak sekolah juga diajak menanam pohon di bantaran sungai setiap hari Minggu. " + BOOK + ".";
    await page.evaluate((t) => setText(t), txt); await page.waitForTimeout(400);
    await page.click("#webBtn");
    await page.waitForFunction(() => document.getElementById("webProg").hidden && !runWebSearch.busy && S.webChecked, null, { timeout: 60000 });
    const r = await page.evaluate(() => ({ kinds: S.webSources.map((w) => w.kind).sort().join(","), score: S.plag.score, net: S.plag.groups.internet, pub: S.plag.groups.publikasi, st: document.getElementById("webStatus").textContent, eng: S.lastEngines.join(",") }));
    for (const k of ["Web", "OpenAIRE", "Wikibooks ID"]) ok(r.kinds.includes(k), "sumber " + k + " tidak ditemukan: " + r.kinds);
    ok(seen.serper > 0 && seen.tsearch > 0 && (seen.extract || []).includes("https://bloghijau.example/sampah-plastik"), "Serper/Tavily tidak dipakai: " + JSON.stringify(seen));
    ok(r.score > 55, "kesamaan hanya " + r.score + "% (" + JSON.stringify(r).slice(0, 200) + ")");
    ok(/CORE: API key ditolak/.test(r.st), "kunci CORE yang ditolak tidak diberitahukan: " + r.st);
    ok(/Google \(Serper\)/.test(r.eng) && /Tavily/.test(r.eng), "mesin tidak tercatat di laporan: " + r.eng);
    for (const re of [/google\.serper\.dev/, /api\.tavily\.com\/extract/, /api\.tavily\.com\/search/, /api\.openaire\.eu/, /wikibooks\.org|wikisource\.org/, /api\.core\.ac\.uk/]) await ctx.unroute(re);
    await page.evaluate(() => { ["ct_serper", "ct_tavily", "ct_core"].forEach((k) => localStorage.removeItem(k)); updKeys(); resetWeb(); run(); });
    await srcDefault(page);
  });
  await test("instansi: kode verifikasi + QR, tanda tangan digital, verifikasi dokumen, logo, laporan PDF", async () => {
    await page.click("#tab-periksa");
    await page.evaluate(() => { document.getElementById("svcName").value = "Universitas Contoh"; store("ct_sign", "rahasia-instansi-123");
      const c = document.createElement("canvas"); c.width = 200; c.height = 60; const x = c.getContext("2d"); x.fillStyle = "#0e6a86"; x.fillRect(0, 0, 200, 60);
      store("ct_logo", c.toDataURL("image/png")); store("ct_logo_wh", "200,60"); showLogo(); setText(SAMPLE, true); });
    await page.waitForTimeout(400);
    const r = await page.evaluate(async () => { const r = buildReport(); await prepReport(r); return { code: r.seal.code, signed: r.seal.signed, url: r.seal.url, qr: !!r.sealQr, txt: reportText(r), text: r.text }; });
    ok(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(r.code) && r.signed && r.qr, "segel laporan tidak lengkap: " + JSON.stringify(r).slice(0, 160));
    ok(r.txt.includes(r.code) && r.txt.includes("#cek="), "kode verifikasi tidak ada di laporan TXT");
    const pdf = await download(page, "#dlPdf");
    ok(pdf.buf.length > 5000 && pdf.buf.slice(0, 4).toString() === "%PDF", "PDF berlogo & ber-QR gagal dibuat: " + pdf.buf.length + " byte");
    // Buka tautan verifikasi di tab baru, seperti memindai QR.
    const v = await ctx.newPage(); v.errors = []; v.on("pageerror", (e) => v.errors.push(e.message));
    await v.goto(r.url.replace(/^https:\/\/[^#]+/, SITE)); await ready(v);
    await v.waitForSelector("#verDrawer:not([hidden])");
    ok((await v.textContent("#verSub")).includes(r.code), "kode tidak tampil di halaman verifikasi");
    await v.fill("#verText", r.text); await v.waitForSelector("#verDocRes .vres.ok", { timeout: 5000 });
    await v.fill("#verText", r.text.replace("teknologi", "teknologi baru")); await v.waitForSelector("#verDocRes .vres.bad", { timeout: 5000 });
    await v.fill("#verKey", "kunci-salah-sekali"); await v.click("#verSign"); await v.waitForSelector("#verSignRes .vres.bad");
    await v.fill("#verKey", "rahasia-instansi-123"); await v.click("#verSign"); await v.waitForSelector("#verSignRes .vres.ok");
    // Data laporan dipalsukan (skor diturunkan): tanda tangan harus gagal.
    const fake = await v.evaluate((u) => { const o = parseSeal(u); o.s = 1; return SITE_URL + "#cek=" + b64u(JSON.stringify(o)); }, r.url);
    await v.evaluate((u) => openVerify(parseSeal(u)), fake);
    await v.fill("#verKey", "rahasia-instansi-123"); await v.click("#verSign"); await v.waitForSelector("#verSignRes .vres.bad");
    ok(!v.errors.length, "galat di halaman verifikasi: " + v.errors.join("; ")); await v.close();
    await page.evaluate(() => { ["ct_sign", "ct_logo", "ct_logo_wh"].forEach((k) => localStorage.removeItem(k)); showLogo(); document.getElementById("svcName").value = ""; });
  });
  await test("filter: abaikan sumber kecil menghitung ulang skor dan tercatat di laporan", async () => {
    await page.evaluate(() => setText(SAMPLE, true)); await page.waitForTimeout(400);
    const before = await page.evaluate(() => S.plag.matched.map((m) => m.share));
    const setSmall = (v) => page.evaluate((v) => { const e = document.getElementById("fSmall"); e.value = v; e.dispatchEvent(new Event("change")); }, v);
    await setSmall("5"); await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ shares: S.plag.matched.map((m) => m.share), n: S.plag.smallExcluded, f: filterList().join(" | ") }));
    ok(after.shares.every((x) => x >= 5), "masih ada sumber di bawah 5%: " + after.shares.join(","));
    ok(after.n === before.filter((x) => x < 5).length, "jumlah sumber diabaikan salah: " + after.n + " dari " + before.join(","));
    ok(/di bawah 5%/.test(after.f), "filter tidak tercatat: " + after.f);
    await setSmall("0"); await page.waitForTimeout(300);
  });
  await test("sumber tambahan: PLOS (teks lengkap), Zenodo, DataCite, LangSearch", async () => {
    const EN = "Malaria transmission in the highlands depends strongly on the temperature of the breeding sites and the survival of adult mosquitoes";
    const ZEN = "Penerapan pendekatan pembelajaran matematika realistik mampu meningkatkan kemampuan pemecahan masalah siswa kelas lima sekolah dasar";
    const DC = "Data curah hujan harian dari stasiun klimatologi menunjukkan tren penurunan selama musim kemarau dalam tiga dekade terakhir";
    const WEB = "Warung kopi di sudut kota itu selalu ramai oleh mahasiswa yang mengerjakan tugas sambil menunggu hujan reda";
    const H = { "access-control-allow-origin": "*" }, J = (r, b) => r.fulfill({ contentType: "application/json", headers: H, body: JSON.stringify(b) });
    await ctx.route(/api\.plos\.org/, (r) => { const q = new URL(r.request().url()).searchParams.get("q") || ""; J(r, { response: { docs: EN.toLowerCase().includes(q.replace(/everything:|"/g, "")) ? [{ id: "10.1371/journal.pone.0000001", title_display: "Highland malaria", abstract: ["We study malaria in highland villages over ten years of surveillance."], publication_date: "2015-01-01T00:00:00Z" }] : [] } }); });
    await ctx.route(/zenodo\.org/, (r) => J(r, { hits: { hits: [{ id: 7, doi_url: "https://doi.org/10.5281/zenodo.7", metadata: { title: "Pembelajaran matematika realistik", publication_date: "2019-05-01", description: "<p>" + ZEN + ". Penelitian tindakan kelas dilakukan dalam dua siklus.</p>" } }] } }));
    await ctx.route(/api\.datacite\.org/, (r) => J(r, { data: [{ attributes: { doi: "10.9999/iklim", publicationYear: 2020, titles: [{ title: "Data iklim" }], descriptions: [{ description: DC + ". Data diolah dengan uji Mann-Kendall." }] } }] }));
    await ctx.route(/api\.langsearch\.com/, (r) => J(r, { code: 200, data: { webPages: { value: [{ name: "Cerita kopi", url: "https://cerita.example/kopi", snippet: "…", summary: "Catatan perjalanan. " + WEB + ". Kopinya enak." }] } } }));
    await page.evaluate(() => { store("ct_langsearch", "uji"); updKeys(); });
    await srcOnly(page, ["wPlos", "wZenodo", "wDataCite", "wLang"]);
    await page.evaluate((t) => setText(t), "Laporan praktikum gabungan. " + ZEN + ". Kelompok kami mengamati kebun sekolah setiap pagi selama dua minggu. " + DC + ". " + WEB + ". The second part is written in English for the international seminar. " + EN + ". We thank the village health workers for their help during the survey.");
    await page.waitForTimeout(400); await page.click("#webBtn");
    await page.waitForFunction(() => document.getElementById("webProg").hidden && !runWebSearch.busy && S.webChecked, null, { timeout: 60000 });
    const k = await page.evaluate(() => S.webSources.map((w) => w.kind).sort().join(","));
    for (const x of ["PLOS", "Zenodo", "DataCite", "Web"]) ok(k.includes(x), "sumber " + x + " tidak ditemukan: " + k);
    ok(await page.evaluate(() => S.plag.score) > 50, "kesamaan terlalu rendah: " + await page.evaluate(() => S.plag.score));
    for (const re of [/api\.plos\.org/, /zenodo\.org/, /api\.datacite\.org/, /api\.langsearch\.com/]) await ctx.unroute(re);
    await page.evaluate(() => { localStorage.removeItem("ct_langsearch"); updKeys(); resetWeb(); run(); });
    await srcDefault(page);
  });
  await test("menu samping: Beranda, navigasi, Cek Sitasi membuka kartu sitasi", async () => {
    await page.click("#tab-beranda");
    ok(await page.isVisible("#view-beranda") && await page.locator("#view-beranda .tool").count() >= 7, "Beranda/alat tidak tampil");
    ok(await page.getAttribute("#tab-beranda", "aria-current") === "page", "menu aktif tidak ditandai");
    await page.click('#view-beranda .tool[data-nav="bandingkan"]'); ok(await page.isVisible("#view-bandingkan"), "kartu alat tidak membuka Bandingkan");
    await page.click("#tab-sitasi"); await page.waitForTimeout(300);
    ok(await page.isVisible("#view-periksa") && await page.evaluate(() => document.getElementById("citeAcc").open), "Cek Sitasi tidak membuka kartu sitasi");
    ok((await page.textContent("#topTitle")).includes("Sitasi"), "judul halaman tidak diperbarui");
    // HP: menu dibuka lewat tombol, tertutup setelah memilih
    const { ctx: c, page: m } = await newPage(browser, devices["Pixel 7"]);
    await m.goto(SITE); await ready(m);
    ok(!(await m.isVisible("#tab-riwayat")), "menu samping terlihat di HP sebelum dibuka");
    await m.click("#menuBtn"); await m.click("#tab-riwayat");
    ok(await m.isVisible("#view-riwayat") && !(await m.evaluate(() => document.body.classList.contains("menu-open"))), "menu HP tidak menutup setelah memilih");
    await m.click("#menuBtn"); await m.keyboard.press("Escape");
    ok(!(await m.evaluate(() => document.body.classList.contains("menu-open"))), "Esc tidak menutup menu");
    ok(!m.errors.length, m.errors.join("; ")); await c.close();
  });
  await test("teks tersembunyi & typo: karakter tak terlihat, huruf Kiril, teks putih DOCX, kata tidak baku, bersihkan", async () => {
    await page.click("#tab-periksa");
    await page.setInputFiles("#mainFile", path.join(FIX, "tersembunyi.docx"));
    await page.waitForFunction(() => S.doc && S.doc.name === "tersembunyi.docx" && S.doc.hidden && S.doc.hidden.length, null, { timeout: 30000 });
    const kinds = await page.evaluate(() => S.doc.hidden.map((h) => h.kind).join(","));
    ok(/putih/.test(kinds) && /bertanda tersembunyi/.test(kinds), "teks tersembunyi DOCX tidak terdeteksi: " + kinds);
    await page.evaluate(() => setText(editor.value + "\n\nAktifitas belajar anak anak​ meningkat. Analisa memakai pendekаtan kuantitatif. Kami ingin  bertanya ,lalu di lakukan uji."));
    await page.waitForTimeout(400); await page.click("#tab-tersembunyi"); await page.waitForTimeout(200);
    const c = await page.evaluate(() => { const n = {}; S.hidden.forEach((f) => { n[f.kind] = (n[f.kind] || 0) + 1; }); return n; });
    ok(c.invis === 1 && c.homo === 1 && c.hidden >= 2 && c.baku >= 2 && c.typo >= 4, "temuan tidak lengkap: " + JSON.stringify(c));
    ok(await page.isVisible("#hidVerdict.bad"), "kesimpulan penyamaran tidak tampil");
    await page.click("#hidClean"); await page.waitForTimeout(700);
    const after = await page.evaluate(() => [/[​а]/.test(editor.value), S.hidden.filter((f) => f.kind === "invis" || f.kind === "homo").length]);
    ok(!after[0] && after[1] === 0, "pembersihan tidak menghapus karakter tersembunyi: " + after);
    await page.click('#hidList [data-hid]'); await page.waitForTimeout(200);
    ok(await page.isVisible("#view-periksa") && await page.locator("#hl .jump").count() === 1, "tombol Lihat tidak melompat ke naskah");
  });
  await test("buat daftar isi: BAB, subbab, nomor halaman, salin & unduh Word", async () => {
    const T = "KATA PENGANTAR\nPuji syukur kami panjatkan.\n\nBAB I\nPENDAHULUAN\n\nA. Latar Belakang\nIsi latar belakang yang cukup panjang di sini.\n\n1.1 Rumusan Masalah\nBagaimana hasilnya?\n\n1.1.1 Batasan Masalah\nIsi.\n\n1. Mengetahui penerapan teknik modulasi pada sisi radio frequency sistem komunikasi bergerak seluler.\n\nBAB II TINJAUAN PUSTAKA\n\n2.1 Landasan Teori\nIsi teori.\n\nDAFTAR PUSTAKA\nSanjaya, W. (2016). Strategi. Kencana.";
    await page.evaluate((t) => { S.doc = null; setText(t); }, T); await page.waitForTimeout(400);
    await page.click("#tab-daftarisi"); await page.waitForTimeout(200);
    const h = await page.evaluate(() => S.toc.map((x) => x.lvl + ":" + x.t));
    const want = ["1:KATA PENGANTAR", "1:BAB I PENDAHULUAN", "2:A. Latar Belakang", "2:1.1 Rumusan Masalah", "3:1.1.1 Batasan Masalah", "1:BAB II TINJAUAN PUSTAKA", "2:2.1 Landasan Teori", "1:DAFTAR PUSTAKA"];
    ok(JSON.stringify(h) === JSON.stringify(want), "judul terdeteksi: " + JSON.stringify(h));
    ok(await page.locator("#tocPrev .tocrow").count() === 8, "pratinjau tidak lengkap");
    const d = await download(page, "#tocDoc"); ok(/\.doc$/.test(d.name) && d.buf.toString().includes("BAB II TINJAUAN PUSTAKA"), "unduhan Word tidak berisi daftar isi");
    // Nomor halaman dari PDF
    await page.click("#tab-periksa"); await page.setInputFiles("#mainFile", path.join(FIX, "sample.pdf"));
    await page.waitForFunction(() => S.doc && S.doc.layout, null, { timeout: 30000 }); await page.click("#tab-daftarisi");
    ok(/halaman PDF/.test(await page.textContent("#tocNote")), "mode nomor halaman PDF tidak aktif: " + await page.textContent("#tocNote"));
  });
  await test("teks lengkap & repositori kampus: jembatan, EPrints, PDF skripsi, Zenodo PDF langsung", async () => {
    await page.click("#tab-periksa");
    const PDF = fs.readFileSync(path.join(FIX, "sample.pdf"));
    // PDF skripsi tiruan dengan isi berbeda (dibuat langsung, satu halaman).
    const SKR = "Stomata daun bayam paling banyak ditemukan pada permukaan bawah daun dan membuka lebar pada pagi hari ketika cahaya matahari mulai terang.";
    const mkPdf = (line) => {
      // Teks dipecah per ±70 karakter, satu baris PDF per potongan.
      const rows = line.match(/.{1,70}(\s|$)/g).map((x) => x.trim().replace(/[()\\]/g, (c) => "\\" + c));
      const stream = "BT /F1 11 Tf 14 TL 40 800 Td " + rows.map((x) => "(" + x + ") Tj T*").join(" ") + " ET";
      const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
      let out = "%PDF-1.4\n", offs = [];
      objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
      const x = out.length; out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
      return Buffer.from(out + "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + x + "\n%%EOF\n", "latin1");
    };
    const PDF2 = mkPdf(SKR + " " + SKR.replace("Stomata", "Jumlah stomata") + " Penelitian dilakukan di laboratorium biologi sekolah menengah atas negeri dengan tiga kali ulangan pada setiap perlakuan cahaya dan suhu ruang yang berbeda selama dua minggu.");
    const KAL = "Saat praktikum kemarin kami mengamati daun bayam di bawah mikroskop sekolah yang lensanya agak buram, jadi hasil gambarnya kurang jelas dan harus diulang dua kali.";
    const seen = { repo: 0, pdf: 0, zen: 0 };
    await ctx.route(/^https:\/\/jb\.test\//, (r) => {
      const q = new URL(r.request().url()).searchParams, H = { "access-control-allow-origin": "*" };
      if (q.get("k") !== "kunci-uji-123") return r.fulfill({ status: 401, headers: H, contentType: "application/json", body: '{"error":"Kunci salah"}' });
      if (q.get("ping")) return r.fulfill({ headers: H, contentType: "application/json", body: '{"ok":true}' });
      const u = q.get("url") || "";
      if (/export_cekteks_JSON/.test(u)) { seen.repo++; return r.fulfill({ headers: H, contentType: "application/json", body: JSON.stringify([{ eprintid: 4242, uri: "https://eprints.kampus.ac.id/id/eprint/4242", title: "Pengamatan stomata daun bayam", date: "2018-05-01", abstract: "Penelitian ini mengamati stomata pada daun bayam di laboratorium sekolah menengah.", documents: [{ mime_type: "application/pdf", security: "public", pos: 2, main: "BAB I.pdf" }, { mime_type: "application/pdf", security: "staffonly", pos: 3, main: "BAB IV.pdf" }] }]) }); }
      if (u === "https://eprints.kampus.ac.id/4242/2/BAB%20I.pdf") { seen.pdf++; return r.fulfill({ headers: { ...H, "X-Jembatan-Type": "application/pdf" }, contentType: "application/pdf", body: PDF2 }); }
      r.fulfill({ status: 502, headers: H, contentType: "application/json", body: '{"error":"tidak ada"}' });
    });
    await ctx.route(/zenodo\.org\/api\/records\?/, (r) => r.fulfill({ headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify({ hits: { hits: [{ id: 9, doi_url: "https://doi.org/10.5281/zenodo.9", metadata: { title: "Praktikum biologi sekolah", publication_date: "2020-01-01", description: "Laporan singkat." }, files: [{ key: "laporan.pdf", size: 4000, links: { self: "https://zenodo.org/api/records/9/files/laporan.pdf/content" } }] }] } }) }));
    await ctx.route(/zenodo\.org\/api\/records\/9\/files/, (r) => { seen.zen++; r.fulfill({ headers: { "access-control-allow-origin": "*" }, contentType: "application/octet-stream", body: PDF }); });
    await page.click("#tab-sumber"); await page.click("#jbAcc summary");
    await page.fill("#jbUrlIn", "https://jb.test"); await page.fill("#jbKeyIn", "kunci-uji-123"); await page.fill("#jbRepos", "eprints.kampus.ac.id\nbukan alamat\nhttps://eprints.kampus.ac.id/");
    await page.click("#jbTest"); await page.waitForFunction(() => /siap/.test(document.getElementById("jbStatus").textContent));
    ok(await page.evaluate(() => repoList().join(",")) === "eprints.kampus.ac.id", "daftar repositori tidak dirapikan: " + await page.evaluate(() => repoList().join(",")));
    await page.click("#tab-periksa");
    await srcOnly(page, ["wRepo", "wFull", "wZenodo"]); await page.evaluate(() => { document.getElementById("useCorpus").checked = false; });
    const txt = "Laporan praktikum biologi kelas sebelas tentang daun bayam dan stomata daun bayam. " + KAL + " " + SKR + " Kelompok kami menggambar hasil pengamatan stomata daun bayam pada buku praktikum masing-masing.";
    await page.evaluate((t) => { S.doc = null; setText(t); }, txt); await page.waitForTimeout(400);
    await page.click("#webBtn");
    await page.waitForFunction(() => document.getElementById("webProg").hidden && !runWebSearch.busy && S.webChecked, null, { timeout: 60000 });
    const r = await page.evaluate(() => ({ full: S.lastFull, srcs: S.webSources.map((w) => w.kind + ":" + !!w.full), m: S.plag.matched.map((x) => x.kind + " " + x.share), st: document.getElementById("webStatus").textContent, cov: coverage().join(" | ") }));
    ok(seen.repo >= 1 && seen.pdf === 1 && seen.zen === 1, "unduhan tidak sesuai: " + JSON.stringify(seen));
    ok(r.full === 2 && r.srcs.includes("Repositori kampus:true") && r.srcs.includes("Zenodo:true"), "teks lengkap tidak terpakai: " + JSON.stringify(r).slice(0, 300));
    ok(r.m.some((x) => /^Repositori kampus /.test(x)) && r.m.some((x) => /^Zenodo /.test(x)), "kalimat dari PDF skripsi/Zenodo tidak cocok: " + r.m.join(", "));
    ok(/2 teks lengkap diunduh/.test(r.st) && /2 dokumen diunduh/.test(r.cov), "jumlah teks lengkap tidak dilaporkan: " + r.st);
    for (const re of [/^https:\/\/jb\.test\//, /zenodo\.org\/api\/records\?/, /zenodo\.org\/api\/records\/9\/files/]) await ctx.unroute(re);
    await page.evaluate(() => { ["ct_jb_url", "ct_jb_key", "ct_jb_repos"].forEach((k) => localStorage.removeItem(k)); document.getElementById("jbUrlIn").value = ""; document.getElementById("jbKeyIn").value = ""; document.getElementById("useCorpus").checked = true; updKeys(); resetWeb(); run(); });
    await srcDefault(page);
  });
  await test("periksa banyak dokumen: antar-naskah, CSV, ZIP berisi semua laporan, keadaan semula kembali", async () => {
    await page.click("#tab-periksa"); await page.evaluate(() => { S.doc = null; setText("Naskah yang sedang dibuka sebelum pemeriksaan massal dimulai, jangan sampai hilang."); });
    await page.click("#tab-massal");
    await page.setInputFiles("#bFiles", [path.join(FIX, "tugas.docx"), path.join(FIX, "tersembunyi.docx"), path.join(FIX, "sample.pdf")]);
    await page.waitForFunction(() => BATCH.length === 3 && document.querySelectorAll("#bList .brow-i").length === 3, null, { timeout: 60000 });
    const b = await page.evaluate(() => BATCH.map((x) => ({ n: x.name, s: x.score, p: x.peer && x.peer.name, ps: x.peer && x.peer.share })));
    const t = b.find((x) => x.n === "tugas.docx");
    ok(t.p === "tersembunyi.docx" && t.ps > 50, "naskah yang saling menyalin tidak terdeteksi: " + JSON.stringify(b));
    const csv = await download(page, "#bCsv"); ok(/tugas\.docx/.test(csv.buf.toString()) && /Kemiripan antar-naskah/.test(csv.buf.toString()), "CSV tidak lengkap");
    const z = await download(page, "#bZip");
    const zs = z.buf.toString("latin1"), nPdf = (zs.match(/Laporan-[\w-]+\.pdf/g) || []).filter((v, i, a) => a.indexOf(v) === i).length;
    ok(zs.startsWith("PK") && nPdf === 3 && zs.includes("ringkasan.csv"), "ZIP tidak berisi 3 laporan: " + nPdf);
    ok(await page.evaluate(() => /jangan sampai hilang/.test(editor.value)), "naskah semula tidak dikembalikan setelah ZIP");
    await page.click("#bClear");
  });
  await test("sitasi: DOI (Crossref) ke APA & IEEE, isi manual, unduh Word, sitasi dari sumber yang cocok", async () => {
    await ctx.route(/api\.crossref\.org\/works\/10\.1234/, (r) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ message: {
      type: "journal-article", DOI: "10.1234/jp.5.2", title: ["Strategi pembelajaran berbasis masalah"], "container-title": ["Jurnal Pendidikan"], volume: "5", issue: "2", page: "10-20",
      author: [{ given: "Wina", family: "Sanjaya" }, { given: "Andi Budi", family: "Putra" }], issued: { "date-parts": [[2016, 3]] } } }) }));
    await page.click("#tab-pustaka"); await page.click("#rfClear").catch(() => {});
    await page.fill("#rfQuery", "https://doi.org/10.1234/jp.5.2"); await page.click("#rfSearch");
    await page.click('#rfResults [data-radd="0"]');
    await page.selectOption("#rfStyle", "apa");
    const apa = await page.textContent("#rfList .reft");
    ok(apa === "Sanjaya, W., & Putra, A. B. (2016). Strategi pembelajaran berbasis masalah. Jurnal Pendidikan, 5(2), 10-20. https://doi.org/10.1234/jp.5.2", "APA salah: " + apa);
    ok((await page.textContent("#rfList .refc")).includes("(Sanjaya & Putra, 2016)"), "sitasi di naskah salah");
    await page.selectOption("#rfStyle", "ieee");
    ok((await page.textContent("#rfList .reft")).startsWith("[1] W. Sanjaya and A. B. Putra, “Strategi pembelajaran berbasis masalah,” Jurnal Pendidikan, vol. 5, no. 2, pp. 10-20, 2016"), "IEEE salah: " + await page.textContent("#rfList .reft"));
    await page.click("#rfModeMan"); await page.selectOption("#rfType", "book");
    await page.fill("#rfAuthors", "Sugiyono"); await page.fill("#rfYear", "2017"); await page.fill("#rfTitle", "Metode penelitian kuantitatif, kualitatif, dan R&D"); await page.fill("#rfCont", "Alfabeta"); await page.fill("#rfPlace", "Bandung"); await page.click("#rfAdd");
    await page.selectOption("#rfStyle", "apa");
    const all = await page.evaluate(() => [...document.querySelectorAll("#rfList .reft")].map((x) => x.textContent));
    ok(all.length === 2 && all[0].startsWith("Sanjaya") && all[1] === "Sugiyono (2017). Metode penelitian kuantitatif, kualitatif, dan R&D. Alfabeta.", "urutan/format buku salah: " + JSON.stringify(all));
    const w = await download(page, "#rfDoc"); ok(w.buf.toString().includes("DAFTAR PUSTAKA") && w.buf.toString().includes("<i>Jurnal Pendidikan</i>"), "Word daftar pustaka tidak lengkap");
    await ctx.unroute(/api\.crossref\.org\/works\/10\.1234/);
    await page.click("#tab-periksa"); await page.evaluate(() => { S.doc = null; setText(SAMPLE, true); }); await page.waitForTimeout(400);
    await page.click('.srcact [data-act="ref"]'); await page.waitForFunction(() => REFS.length === 3);
    await page.evaluate(() => { REFS = []; saveRefs(); renderRefs(); });
  });
  await test("batas kesamaan kampus, perbaiki jadi kutipan bersitasi, palet perintah Ctrl+K", async () => {
    await page.click("#tab-sumber"); await page.fill("#svcLimit", "10"); await page.click("#tab-periksa");
    await page.evaluate(() => { S.doc = null; setText(SAMPLE, true); }); await page.waitForTimeout(400);
    const before = await page.evaluate(() => S.plag.score);
    ok(await page.isVisible("#limitPill.bad") && /Belum lolos/.test(await page.textContent("#limitPill")), "status batas tidak tampil");
    ok(await page.evaluate(() => /BELUM LOLOS batas 10%/.test(reportText())), "status batas tidak ada di laporan");
    const no = await page.evaluate(() => S.plag.matched[0].no);
    await page.click('.srcact [data-act="cmp"][data-no="' + no + '"]'); await page.click('#drBody [data-fix="quote"]');
    await page.waitForFunction((b) => S.plag.score < b && /“/.test(editor.value) && /\(“[^)]+”, (\d{4}|t\.t\.)\)/.test(editor.value), before, { timeout: 10000 });
    ok(await page.evaluate(() => REFS.length) >= 1, "sumber tidak masuk daftar pustaka");
    await page.keyboard.press("Control+k"); ok(await page.isVisible("#cmdk"), "palet perintah tidak terbuka");
    await page.keyboard.type("riwayat"); await page.keyboard.press("Enter");
    ok(await page.isVisible("#view-riwayat") && await page.isHidden("#cmdk"), "palet perintah tidak membuka Riwayat");
    await page.click("#tab-sumber"); await page.fill("#svcLimit", ""); await page.evaluate(() => { REFS = []; saveRefs(); renderRefs(); });
  });
  await test("cek plagiasi kode: nama variabel diganti tetap terdeteksi, template diabaikan, ZIP per folder, penampil", async () => {
    const K = path.join(FIX, "kode");
    await page.click("#tab-kode"); await page.click("#kClear");
    await page.setInputFiles("#kFiles", ["mhs1.py", "mhs2.py", "mhs3.py"].map((f) => path.join(K, f)));
    await page.waitForFunction(() => KODE.subs.length === 3);
    const pair = (a, b) => page.evaluate(([a, b]) => { const p = KODE.pairs.find((x) => [KODE.subs[x.i].name, KODE.subs[x.j].name].sort().join() === [a, b].sort().join()); return p.max; }, [a, b]);
    ok(await pair("mhs1.py", "mhs2.py") > 85, "salinan dengan nama variabel diganti tidak terdeteksi: " + await pair("mhs1.py", "mhs2.py"));
    await page.setInputFiles("#kTpl", path.join(K, "template.py")); await page.waitForTimeout(300);
    const cp = await pair("mhs1.py", "mhs2.py"), un = await pair("mhs1.py", "mhs3.py");
    ok(cp > 85 && un < 20, "template tidak diabaikan dengan benar: salinan " + cp + "%, berbeda " + un + "%");
    await page.click("#kClear"); await page.setInputFiles("#kFiles", path.join(K, "kode.zip"));
    await page.waitForFunction(() => KODE.subs.length === 3);
    const subs = await page.evaluate(() => KODE.subs.map((x) => x.name + ":" + x.files).join(","));
    ok(subs === "andi:2,budi:1,citra:1", "ZIP tidak dikelompokkan per folder: " + subs);
    ok(await page.locator("#kMatrix td[data-kpair]").count() === 6, "matriks kemiripan tidak lengkap");
    await page.click('#kPairs [data-kpair="0"]');
    ok(await page.isVisible("#codeDrawer") && await page.locator("#cdA .ln.hit").count() > 10 && await page.locator("#cdA .tk-kw").count() > 5, "penampil kode tidak menyorot blok/sintaks");
    await page.click('#cdSum [data-kjump="0"]'); ok(await page.locator("#cdB .ln.cur").count() === 1, "lompat ke blok tidak berfungsi");
    await page.keyboard.press("Escape"); ok(await page.isHidden("#codeDrawer"), "Esc tidak menutup penampil");
    const csv = await download(page, "#kCsv"); ok(/andi/.test(csv.buf.toString()) && /Blok sama/.test(csv.buf.toString()), "CSV kode tidak lengkap");
    // Tokenisasi: komentar & nama variabel tidak berpengaruh, operator // Python bukan komentar
    const t = await page.evaluate(() => [codeTokens("x = a // b  # bagi\ny = 2", "Python").map((x) => x.k + ":" + x.t).join(" "), codeTokens("int a = 1; // komentar\nb--;", "C").filter((x) => x.k === "com").length]);
    ok(/op:\/\/ id:b com:# bagi/.test(t[0]) && t[1] === 1, "tokenisasi salah: " + t);
    await page.click("#kClear"); await page.evaluate(() => { KODE.tplSubs = []; });
  });
  await test("deteksi AI terkalibrasi: abstrak manusia berdata rendah, teks AI generik tinggi", async () => {
    const HUMAN = "Penelitian ini bertujuan untuk mengetahui pengaruh pemberian pupuk kandang ayam terhadap pertumbuhan dan hasil tanaman jagung manis (Zea mays saccharata Sturt.) pada tanah PMK. Penelitian dilaksanakan di kebun percobaan Fakultas Pertanian Universitas Kapuas Sintang dari bulan Maret sampai Juni 2016. Rancangan yang digunakan adalah Rancangan Acak Lengkap (RAL) dengan 5 perlakuan dan 5 ulangan, yaitu tanpa pupuk kandang, 10 ton/ha, 20 ton/ha, 30 ton/ha, dan 40 ton/ha. Variabel yang diamati meliputi tinggi tanaman, diameter batang, berat tongkol berkelobot, dan berat tongkol tanpa kelobot. Hasil penelitian menunjukkan bahwa pemberian pupuk kandang ayam berpengaruh nyata terhadap semua variabel pengamatan. Dosis 30 ton/ha memberikan hasil terbaik dengan berat tongkol tanpa kelobot 312,4 g per tanaman.";
    const r = await page.evaluate(([h]) => [detectAI(h).score, detectAI(SAMPLE.split("\n\n").filter((p, i) => i !== 2).join("\n\n")).score, detectAI(h).signals.kekhususan], [HUMAN]);
    ok(r[0] < 35, "abstrak manusia dinilai " + r[0] + "%");
    ok(r[1] >= 65, "teks AI generik hanya " + r[1] + "%");
    ok(r[2] > 40, "sinyal kekhususan tidak terbaca: " + r[2]);
  });
  await test("perbandingan berdampingan: naskah & sumber, sama persis dan parafrase", async () => {
    await page.click("#tab-periksa");
    const mix = "Fotosintesis adalah proses biokimia pembentukan zat makanan berupa karbohidrat yang dilakukan oleh tumbuhan. " + PARA;
    await page.evaluate((t) => setText(t), mix); await page.waitForTimeout(500);
    const no = await page.evaluate(() => S.plag.matched.filter((m) => /Pemanasan/.test(m.name))[0].no);
    await page.click('.srcact [data-act="cmp"][data-no="' + no + '"]');
    ok(await page.isVisible("#drawer"), "panel perbandingan tidak terbuka");
    ok(await page.locator("#drBody .cmp").count() >= 1, "tidak ada bagian di panel");
    ok(await page.locator("#drBody .tagp").count() >= 1, "bagian parafrase tidak ditandai");
    ok(await page.locator("#drBody .cmp-cols > div:nth-child(2) mark").count() >= 3, "kata yang sama di sisi sumber tidak disorot");
    await page.keyboard.press("Escape");
    ok(await page.isHidden("#drawer"), "Esc tidak menutup panel");
    const foto = await page.evaluate(() => S.plag.matched.filter((m) => /Fotosintesis/.test(m.name))[0].no);
    await page.click('.srcact [data-act="cmp"][data-no="' + foto + '"]');
    const side = await page.textContent("#drBody .cmp-cols > div:nth-child(2) mark");
    ok(/proses biokimia pembentukan zat makanan/.test(side), "sisi sumber tidak menyorot kalimat yang sama: " + side);
    await page.click("#drClose");
  });
  await test("abaikan sumber: skor dihitung ulang, bisa dikembalikan, tercantum di laporan", async () => {
    const before = await page.evaluate(() => S.plag.score);
    const no = await page.evaluate(() => S.plag.matched.filter((m) => /Fotosintesis/.test(m.name))[0].no);
    await page.click('.srcact [data-act="ex"][data-no="' + no + '"]'); await page.waitForTimeout(300);
    const after = await page.evaluate(() => [S.plag.score, S.plag.matched.map((m) => m.name).join(",")]);
    ok(after[0] < before && !/Fotosintesis/.test(after[1]), "sumber yang diabaikan masih dihitung");
    ok((await download(page, "#dlTxt")).buf.toString().includes("Sumber diabaikan"), "laporan tidak mencantumkan sumber yang diabaikan");
    await page.click(".exchip"); await page.waitForTimeout(300);
    ok(await page.evaluate(() => S.plag.score) === before, "sumber tidak kembali setelah dikembalikan");
  });
  await test("pengecualian permanen: situs di daftar selalu diabaikan, tombol Abaikan selalu, tercantum di laporan", async () => {
    // Sumber web tiruan berisi sebagian naskah, seolah ditemukan oleh cek internet.
    await page.evaluate(() => { S.webSources.push({ name: "Repositori uji", url: "https://www.repo.uji-kampus.ac.id/123/bab2.pdf", text: S.text.split(/\s+/).slice(40, 160).join(" ") }); schedule(0); }); await page.waitForTimeout(600);
    const before = await page.evaluate(() => S.plag.score);
    const m = await page.evaluate(() => { const x = S.plag.matched.filter((m) => m.url && /uji-kampus/.test(m.url))[0]; return x ? { no: x.no, host: new URL(x.url).hostname.replace(/^www\./, "") } : null; });
    ok(m, "tidak ada sumber web untuk diuji");
    await page.evaluate((no) => openCompare(no), m.no);
    ok(await page.isVisible("#drBlock"), "tombol Abaikan selalu tidak tampil");
    await page.click("#drBlock"); await page.waitForTimeout(400);
    const after = await page.evaluate(() => [S.plag.score, S.plag.blockedN, localStorage.getItem("ct_block"), S.plag.matched.some((x) => /uji-kampus/.test(x.url || ""))]);
    ok(!after[3] && after[1] >= 1 && after[2].includes(m.host), "sumber yang dikecualikan masih dihitung: " + JSON.stringify(after));
    ok((await download(page, "#dlTxt")).buf.toString().includes("Pengecualian permanen"), "laporan tidak mencantumkan pengecualian permanen");
    await page.evaluate(() => { document.querySelector("#blockList").value = ""; document.querySelector("#blockList").dispatchEvent(new Event("input")); });
    await page.waitForTimeout(900);
    ok(await page.evaluate(() => S.plag.blockedN === 0 && S.plag.matched.some((x) => /uji-kampus/.test(x.url || ""))), "sumber tidak kembali setelah daftar dikosongkan");
    await page.evaluate(() => { S.webSources = S.webSources.filter((x) => !/uji-kampus/.test(x.url)); schedule(0); }); await page.waitForTimeout(600);
  });
  await test("pemeriksaan ulang: skor sebelumnya untuk dokumen yang sama ditampilkan", async () => {
    const r = await page.evaluate(() => {
      const keep = HIST, keepDoc = S.doc; S.doc = Object.assign({}, S.doc || {}, { name: "skripsi-bab2.docx" });
      HIST = [{ id: "x", doc: "skripsi-bab2.docx", date: "2026-01-02T03:04:05.000Z", score: 99 }];
      renderPrev(12, 500); const t = [document.querySelector("#prevPill").hidden, document.querySelector("#prevPill").textContent];
      HIST = keep; S.doc = null; renderPrev(12, 500); const h = document.querySelector("#prevPill").hidden; S.doc = keepDoc; return t.concat(h);
    });
    ok(!r[0] && /99%/.test(r[1]) && /turun 87/.test(r[1]) && r[2], "jejak pemeriksaan sebelumnya salah: " + r[1]);
  });
  await test("tampilan: mode & warna tema disimpan, laporan PDF ikut warna tema", async () => {
    await page.click("#themeBtn"); ok(await page.isVisible("#appear"), "panel Tampilan tidak terbuka");
    await page.click('#swatches [data-acc="hijau"]'); await page.click('#modeSegs [data-mode="dark"]');
    const r = await page.evaluate(() => [document.documentElement.dataset.accent, document.documentElement.dataset.theme, localStorage.ct_accent, accRGB().join(","), getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()]);
    ok(r[0] === "hijau" && r[1] === "dark" && r[2] === "hijau" && r[3] === "15,122,79" && r[4] === "#4fd09a", "tema tidak diterapkan: " + r);
    await page.keyboard.press("Escape"); ok(!(await page.isVisible("#appear")), "Esc tidak menutup panel");
    await page.evaluate(() => { setThemeMode("auto"); setAccent(SITE.warna); });
    ok(await page.evaluate(() => !document.documentElement.dataset.theme && !localStorage.ct_accent && document.documentElement.dataset.accent === SITE.warna), "tema tidak kembali ke bawaan situs");
  });
  await test("site.json: warna bawaan, teks berjalan, dan banner iklan tampil; tautan iklan membuka halaman", async () => {
    const r = await page.evaluate(() => [!!window.CEKTEKS_SITE, document.documentElement.dataset.accent === CEKTEKS_SITE.warna, document.querySelectorAll("#tkTrack .tk-set").length, document.querySelectorAll("#adHome .ad").length]);
    ok(r[0] && r[1] && r[2] === 2 && r[3] >= 1, "pengaturan situs tidak diterapkan: " + r);
    await page.evaluate(() => showView("beranda"));
    ok(await page.isVisible("#ticker") && await page.isVisible("#adHome"), "iklan tidak tampil di Beranda");
    await page.evaluate(() => goLink("#kode")); ok(await page.isVisible("#view-kode"), "tautan #kode tidak membuka halaman");
    await page.click("#tkClose"); ok(!(await page.isVisible("#ticker")), "teks berjalan tidak bisa ditutup");
  });
  await test("chat CS: sapaan, jawaban FAQ otomatis, tautan WhatsApp berisi pertanyaan, Esc menutup", async () => {
    await page.click("#csFab"); ok(await page.isVisible("#csPanel"), "panel chat tidak terbuka");
    await page.fill("#csIn", "kenapa hasilnya beda dengan turnitin"); await page.press("#csIn", "Enter");
    ok(await page.evaluate(() => /Turnitin/.test([...document.querySelectorAll("#csLog .msg.bot")].map((x) => x.textContent).join(" "))), "jawaban FAQ tidak cocok");
    await page.evaluate(() => { SITE.cs.whatsapp = "081234567890"; renderCS(); });
    await page.fill("#csIn", "xyzzy qwerty"); await page.press("#csIn", "Enter");
    const href = await page.evaluate(() => { const a = [...document.querySelectorAll("#csLog .msg.bot a.wa")].pop(); return a && a.href; });
    ok(href && href.startsWith("https://wa.me/6281234567890?text=") && decodeURIComponent(href).includes("xyzzy qwerty"), "tautan WhatsApp salah: " + href);
    await page.keyboard.press("Escape"); ok(!(await page.isVisible("#csPanel")), "Esc tidak menutup chat");
    await page.evaluate(() => { SITE = siteCfg(); renderCS(); });
  });
  await test("Bantuan: FAQ bisa dicari, kebijakan privasi, syarat & ketentuan, kontak", async () => {
    await page.evaluate(() => showView("bantuan"));
    ok((await page.$$("#faqList details")).length >= 12, "FAQ kurang");
    await page.fill("#faqSearch", "offline"); ok((await page.$$("#faqList details")).length === 1, "pencarian FAQ tidak menyaring");
    await page.fill("#faqSearch", "");
    ok(await page.isVisible("#kebijakan") && await page.isVisible("#syarat") && await page.isVisible("#helpContact .btn"), "bagian Bantuan tidak lengkap");
    await page.evaluate(() => showView("periksa"));
  });
  await test("riwayat & pesanan: unduhan PDF tercatat, tarif dan status lunas dihitung, ekspor Excel", async () => {
    await page.click("#tab-sumber"); await page.fill("#svcPrice", "15000"); await page.click("#tab-periksa");
    await page.fill("#clientName", "Klien Riwayat");
    await download(page, "#dlPdf");
    await page.waitForFunction(() => HIST.length >= 1 && HIST[0].client === "Klien Riwayat");
    ok(await page.evaluate(() => HIST[0].price) === 15000, "tarif default tidak dipakai");
    await page.click("#tab-riwayat");
    ok((await page.textContent("#hStats")).includes("15.000"), "tagihan belum dibayar tidak tampil");
    await page.click('.hrow .toggle');
    // Tampilan diperbarui setelah data tersimpan di perangkat.
    await page.waitForFunction(() => /15\.000/.test(document.querySelector("#hStats .stat:nth-child(3) b").textContent), null, { timeout: 5000 })
      .catch(() => { throw new Error("pendapatan bulan ini tidak terhitung"); });
    ok((await page.textContent(".hrow .toggle")).includes("Lunas"), "label status tidak berubah menjadi Lunas");
    const csv = (await download(page, "#hExport")).buf.toString();
    ok(csv.includes("Klien Riwayat") && csv.includes("Lunas") && csv.includes("15000"), "ekspor riwayat tidak lengkap");
    const n0 = await page.evaluate(() => HIST.length);
    await page.click('.hrow [data-del]'); await page.waitForFunction((n) => HIST.length === n - 1 && !HIST.some((e) => e.client === "Klien Riwayat"), n0);
    await page.click("#tab-periksa"); await page.fill("#clientName", "");
  });
  // QRIS statis tiruan (format EMVCo) untuk menguji alur pembayaran.
  function crc16(str) { let c = 0xFFFF; for (let i = 0; i < str.length; i++) { c ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, "0"); }
  const tlv = (id, v) => id + String(v.length).padStart(2, "0") + v;
  const QRIS_BODY = tlv("00", "01") + tlv("01", "11") + tlv("26", tlv("00", "ID.CO.QRIS.WWW") + tlv("01", "936000140000000001")) + tlv("52", "5814") + tlv("53", "360") + tlv("58", "ID") + tlv("59", "TOKO UJI") + tlv("60", "JAKARTA") + "6304";
  const QRIS_STATIC = QRIS_BODY + crc16(QRIS_BODY);
  await test("QRIS: kode dibaca dari foto, nominal ditambahkan sesuai standar (CRC valid)", async () => {
    await page.click("#tab-riwayat");
    const png = await page.evaluate((q) => qrCanvas(q, 400).then((c) => c.toDataURL("image/png").split(",")[1]), QRIS_STATIC);
    await page.setInputFiles("#qrisFile", { name: "qris.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
    await page.waitForFunction(() => PAY.qris && PAY.qris.length > 20, null, { timeout: 15000 });
    ok((await page.textContent("#qrisBox")).includes("TOKO UJI"), "nama merchant tidak tampil");
    const dyn = await page.evaluate((q) => { const d = QRIS.withAmount(q, 15123); const i = QRIS.info(d); return [i.amount, i.dynamic, d]; }, QRIS_STATIC);
    ok(dyn[0] === "15123" && dyn[1] === true, "nominal/jenis QRIS dinamis salah: " + dyn[0] + "/" + dyn[1]);
    ok(crc16(dyn[2].slice(0, -4)) === dyn[2].slice(-4), "CRC QRIS dinamis tidak valid");
    const bad = await page.evaluate((q) => { try { QRIS.info(q.slice(0, -1) + (q.slice(-1) === "0" ? "1" : "0")); return "lolos"; } catch (e) { return e.message; } }, QRIS_STATIC);
    ok(/CRC/.test(bad), "QRIS rusak tidak ditolak");
  });
  await test("tagihan: total dengan kode unik, QR berisi nominal, pesan WhatsApp, PDF, tandai lunas", async () => {
    await page.click("#tab-riwayat");
    await page.fill('#bankRows .bankrow input[data-k="bank"]', "BCA");
    await page.fill('#bankRows .bankrow input[data-k="number"]', "1234567890");
    await page.fill('#bankRows .bankrow input[data-k="holder"]', "Pemilik Uji");
    await page.evaluate(() => histPut({ id: "uji-tagihan-1", date: new Date().toISOString(), client: "Rina", doc: "Skripsi Bab 2.pdf", words: 3200, score: 18.4, exact: 14, para: 4.4, ai: 22, sources: ["id.wikipedia.org"], price: 15000, paid: false, note: "" }));
    await page.waitForSelector('.hrow[data-id="uji-tagihan-1"] [data-bill]');
    await page.click('.hrow[data-id="uji-tagihan-1"] [data-bill]');
    ok(await page.isVisible("#billDrawer"), "panel tagihan tidak terbuka");
    const total = await page.evaluate(() => amountDue(HIST.filter((e) => e.id === "uji-tagihan-1")[0]));
    ok(total > 15000 && total < 15500, "total dengan kode unik salah: " + total);
    await page.waitForSelector("#billQr canvas");
    const scanned = await page.evaluate(() => { const c = document.querySelector("#billQr canvas"); const r = jsQR(c.getContext("2d").getImageData(0, 0, c.width, c.height).data, c.width, c.height); return r && r.data; });
    ok(scanned, "QR tagihan tidak bisa dipindai");
    ok(scanned.includes(tlv("54", String(total))) && crc16(scanned.slice(0, -4)) === scanned.slice(-4), "QR tagihan tidak berisi nominal " + total + " dengan CRC valid");
    await page.fill("#billPhone", "0812-3456-789");
    const wa = await page.getAttribute("#billWa", "href");
    ok(wa.startsWith("https://wa.me/628123456789?text=") && decodeURIComponent(wa).includes("Rp") && decodeURIComponent(wa).includes("1234567890"), "tautan WhatsApp salah: " + wa.slice(0, 60));
    const inv = await download(page, "#billPdf");
    ok(inv.buf.slice(0, 4).toString() === "%PDF" && /^INV-\d{8}-/.test(inv.name), "tagihan PDF tidak valid: " + inv.name);
    await page.click(".billpaid");
    await page.waitForFunction(() => HIST.filter((e) => e.id === "uji-tagihan-1")[0].paid === true);
    await page.keyboard.press("Escape");
    ok(await page.isHidden("#billDrawer"), "Esc tidak menutup tagihan");
    await page.click('.hrow[data-id="uji-tagihan-1"] [data-del]');
    await page.waitForFunction(() => !HIST.some((e) => e.id === "uji-tagihan-1"));
    await page.click("#tab-periksa");
  });
  await test("sitasi: cocokkan dengan daftar pustaka, bagian sesudah daftar pustaka tetap diperiksa", async () => {
    await page.click("#tab-periksa");
    const T = "BAB I PENDAHULUAN\nFotosintesis adalah proses biokimia pembentukan zat makanan berupa karbohidrat yang dilakukan oleh tumbuhan (Campbell, 2008). " +
      "Menurut Salisbury dan Ross (1992), cahaya sangat menentukan laju fotosintesis pada daun. Penelitian lain menunjukkan hasil serupa (Hidayat et al., 2019; Putra, 2021).\n" +
      "Kami mengamati daun bayam di laboratorium sekolah selama tiga hari berturut-turut dan mencatat perubahan warnanya setiap pagi sebelum pelajaran dimulai.\n\n" +
      "DAFTAR PUSTAKA\nCampbell, N. A. (2008). Biology (8th ed.). Pearson.\nSalisbury, F. B., & Ross, C. W. (1992). Plant physiology. Wadsworth.\n" +
      "Hidayat, R., Sari, D., & Wijaya, A. (2019). Pengaruh cahaya terhadap klorofil. Jurnal Biologi, 5(2), 10-20.\nSuryani, T. (2015). Ekologi tumbuhan. Penerbit Kampus.\n\n" +
      "LAMPIRAN\nRevolusi Industri 4.0 ditandai dengan penggabungan teknologi digital, fisik, dan biologis, seperti kecerdasan buatan, internet of things, komputasi awan, dan big data.";
    await page.evaluate((t) => setText(t), T); await page.waitForTimeout(500);
    const c = await page.evaluate(() => ({ count: S.cite.count, entries: S.cite.entries, missing: S.cite.missing, uncited: S.cite.uncited, cited: S.cite.citedMatches, total: S.cite.totalMatches }));
    ok(c.count === 4 && c.entries === 4, "jumlah sitasi/entri salah: " + c.count + "/" + c.entries);
    ok(c.missing.length === 1 && /Putra \(2021\)/.test(c.missing[0]), "sitasi tanpa entri pustaka salah: " + c.missing.join(","));
    ok(c.uncited.length === 1 && /^Suryani/.test(c.uncited[0]), "entri yang tidak dikutip salah: " + c.uncited.join(","));
    ok(c.total >= 2 && c.cited >= 1 && c.cited < c.total, "bagian bersitasi salah: " + c.cited + "/" + c.total);
    ok(await page.evaluate(() => S.plag.matched.some((m) => /Revolusi Industri/.test(m.name))), "bagian LAMPIRAN sesudah daftar pustaka tidak diperiksa");
    ok((await page.textContent("#citeSum")).includes("perlu dicek"), "ringkasan sitasi tidak memberi peringatan");
  });
  await test("sorotan AI per kalimat tampil", async () => {
    await page.click("#tab-periksa");
    await page.click("#sampleBtn"); await page.waitForTimeout(400);
    await page.click("#hlAi");
    ok(await page.locator("#hl mark.a1, #hl mark.a2, #hl mark.a3").count() > 0, "kalimat AI tidak disorot");
    await page.click("#hlPlag");
  });
  await test("keterbacaan: kalimat panjang terdeteksi dan bisa disorot", async () => {
    const longS = "Penelitian ini " + Array.from({ length: 40 }, (_, i) => "kata" + i).join(" ") + " selesai.";
    await page.evaluate((t) => setText(t), "Kalimat pendek pertama di sini. " + longS + " Kalimat penutup yang singkat saja."); await page.waitForTimeout(400);
    ok(await page.evaluate(() => S.read.long.length) === 1, "kalimat panjang tidak terdeteksi");
    await page.click("#readAcc summary"); await page.click("#showLong");
    ok(await page.locator("#hl mark.rd1, #hl mark.rd2").count() === 1, "kalimat panjang tidak disorot");
    await page.click("#hlPlag");
  });
  await test("kartu hasil: gambar PNG 1080x1350 dibuat", async () => {
    await page.evaluate((t) => setText(t), PARA); await page.waitForTimeout(400);
    const d = await download(page, "#shareCard");
    ok(d.name.endsWith(".png") && d.buf.slice(1, 4).toString() === "PNG", "bukan berkas PNG");
    ok(d.buf.readUInt32BE(16) === 1080 && d.buf.readUInt32BE(20) === 1350, "ukuran gambar salah");
  });
  await test("identitas jasa & klien tampil di laporan, beserta metode & cakupan", async () => {
    await page.click("#tab-sumber"); await page.fill("#svcName", "Jasa Uji"); await page.fill("#svcContact", "WA 0800"); await page.click("#tab-periksa");
    await page.fill("#clientName", "Budi");
    const t = (await download(page, "#dlTxt")).buf.toString();
    ok(t.includes("Diperiksa oleh : Jasa Uji (WA 0800)") && t.includes("Klien          : Budi"), "identitas tidak tercantum");
    ok(t.includes("Metode & cakupan") && t.includes("tidak terhubung dengan basis data Turnitin"), "metode & cakupan tidak tercantum");
    await page.fill("#clientName", "");
  });
  await test("tetap berjalan offline setelah kunjungan pertama", async () => {
    await page.click("#tab-periksa");
    await page.waitForFunction(async () => { const ks = await caches.keys(); if (!ks.length) return false; const c = await caches.open(ks[0]); return (await c.keys()).filter((r) => r.url.includes("/vendor/")).length === 7; }, null, { timeout: 30000 });
    await ctx.setOffline(true); await page.reload(); await ready(page);
    await page.setInputFiles("#mainFile", path.join(FIX, "sample.pdf"));
    await page.waitForFunction(() => S.doc && S.doc.layout, null, { timeout: 30000 });
    ok((await page.textContent("#netText")) === "Offline", "status offline tidak tampil");
    await ctx.setOffline(false);
  });
  await ctx.close();

  console.log("Fitur 4.3");
  {
    const { ctx: c3, page: p3 } = await newPage(browser, { viewport: { width: 1366, height: 900 } });
    // Tesseract tiruan: mengembalikan kata-kata dengan kotak posisi, seperti hasil OCR sungguhan.
    await c3.addInitScript(() => {
      const TXT = "Fotosintesis adalah proses biokimia pembentukan zat makanan berupa karbohidrat yang dilakukan oleh tumbuhan, terutama tumbuhan yang mengandung zat hijau daun atau klorofil. Proses ini memerlukan cahaya matahari, air, dan karbon dioksida, lalu menghasilkan glukosa dan oksigen.";
      window.__ocrPages = 0;
      window.Tesseract = { createWorker: async (lang) => { window.__ocrLang = lang; return {
        recognize: async () => { window.__ocrPages++; const ws = TXT.split(" "), lines = [];
          for (let i = 0; i < ws.length; i += 8) lines.push({ words: ws.slice(i, i + 8).map((t, k) => ({ text: t, bbox: { x0: 400 + k * 120, y0: 400 + lines.length * 70, x1: 500 + k * 120, y1: 440 + lines.length * 70 } })) });
          return { data: { confidence: 91, paragraphs: [{ lines }] } }; },
        terminate: async () => {} }; } };
    });
    const J = (r, body, status) => r.fulfill({ status: status || 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    await c3.route(/api\.crossref\.org\/works\/10\.1038/, (r) => J(r, { message: { title: ["Deep learning"], DOI: "10.1038/nature14539" } }));
    await c3.route(/api\.crossref\.org\/works\/10\.1234/, (r) => J(r, { message: "Resource not found." }, 404));
    await c3.route(/api\.crossref\.org\/works\?/, (r) => {
      const q = decodeURIComponent(r.request().url());
      J(r, { message: { items: /Sugiyono/.test(q) ? [{ DOI: "10.9/metode", title: ["Metode Penelitian Kuantitatif, Kualitatif, dan R&D"], author: [{ family: "Sugiyono" }], issued: { "date-parts": [[2019]] } }]
        : [{ DOI: "10.9/lain", title: ["Rancang bangun sistem informasi penggajian di perguruan tinggi swasta"], author: [{ family: "Lain" }], issued: { "date-parts": [[2016]] } }] } });
    });
    await c3.route(/api\.openalex\.org/, (r) => J(r, { results: [] }));
    await p3.goto(SITE); await ready(p3);

    await test("OCR: PDF hasil pindaian dikenali teksnya, dibandingkan, dan laporan PDF tetap memuat halaman asli", async () => {
      await p3.setInputFiles("#mainFile", path.join(FIX, "pindaian.pdf"));
      await p3.waitForFunction(() => S.doc && S.doc.ocr, null, { timeout: 60000 }); await p3.waitForTimeout(500);
      const r = await p3.evaluate(() => [S.doc.ocr, window.__ocrPages, window.__ocrLang, S.plag.score, S.doc.layout.pages.length, S.doc.layout.pages[0].items.length, S.plag.matched.map((m) => m.name).join(",")]);
      ok(r[0].pages === 2 && r[0].conf === 91 && r[1] === 2 && r[2] === "ind+eng", "OCR tidak berjalan per halaman: " + JSON.stringify(r));
      ok(r[3] > 50 && /Fotosintesis/.test(r[6]), "teks OCR tidak cocok dengan sumber: " + r[3]);
      ok(r[4] === 2 && r[5] > 20, "posisi kata OCR tidak dicatat");
      const pdf = await download(p3, "#dlPdf");
      ok(pdf.buf.length > 20000 && pdf.buf.slice(0, 4).toString() === "%PDF", "laporan PDF dari dokumen OCR gagal");
      ok((await download(p3, "#dlTxt")).buf.toString().includes("dikenali dengan OCR"), "laporan tidak mencatat OCR");
    });
    await test("keaslian daftar pustaka: DOI cocok, DOI tidak terdaftar, DOI milik karya lain, referensi karangan", async () => {
      const body = Array(14).fill("Bagian ini membahas latar belakang penelitian secara umum dan alasan pemilihan topik oleh penulis.").join(" ");
      const TXT = "Pendahuluan\nPenelitian berkembang pesat (LeCun, 2015). Pengukuran diteliti oleh Sugiyono (2019). Temuan serupa (Hartono, 2021).\n\n" + body + "\n\nDAFTAR PUSTAKA\n" +
        "LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436–444. https://doi.org/10.1038/nature14539\n" +
        "Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: Alfabeta.\n" +
        "Hartono, B., & Wijaya, S. (2021). Pengaruh kecerdasan buatan kuantum terhadap motivasi belajar siswa. Jurnal Pendidikan Nusantara Digital, 12(3), 45–61. https://doi.org/10.1234/jpnd.2021.99887\n" +
        "Hartono, B. (2020). Integrasi algoritma neuro-fuzzy untuk prediksi kelulusan mahasiswa di perguruan tinggi swasta. Jurnal Teknologi Informasi Mandiri, 8(2), 11–20.\n" +
        "Page, M. J., & Bossuyt, P. M. (2021). The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ, 372, n71. https://doi.org/10.1038/nature14539\n";
      await p3.evaluate((t) => { S.doc = null; setText(t); }, TXT); await p3.waitForTimeout(800);
      const nl = await p3.evaluate(() => S.cite.list.map((e) => e.text.slice(0, 30))); ok(nl.length === 5, "entri daftar pustaka tidak terbaca: " + JSON.stringify(nl));
      await p3.evaluate(() => { $("#citeAcc").open = true; }); await p3.click("#refVerBtn");
      await p3.waitForFunction(() => !REFV_RUN && REFV.size === 5, null, { timeout: 30000 });
      const st = await p3.evaluate(() => S.cite.list.map((e) => REFV.get(e.text).st).join(","));
      ok(st === "ok,ok,bad,nf,bad", "status referensi salah: " + st);
      ok(await p3.isVisible(".reflist") && /2 bermasalah/.test(await p3.textContent(".refsum")), "ringkasan referensi tidak tampil");
    });
    await test("layanan & harga: paket dari site.json, formulir pesanan membuka WhatsApp berisi data pesanan", async () => {
      await p3.evaluate(() => showView("layanan"));
      ok(await p3.isVisible("#tab-layanan") && (await p3.$$("#lyPaket .plan")).length === 4, "paket layanan tidak tampil");
      await p3.evaluate(() => { window.open = (u) => { window.__opened = u; }; SITE.cs.whatsapp = "6281234567890"; renderLayanan(); });
      await p3.click('[data-pkg="2"]'); await p3.fill("#lyHal", "12");
      await p3.click('#lySend [data-via="wa"]');
      ok(!(await p3.evaluate(() => window.__opened)), "pesanan terkirim tanpa nama dan persetujuan");
      await p3.fill("#lyNama", "Budi Santoso"); await p3.check("#lyAgree", { force: true });
      await p3.click('#lySend [data-via="wa"]');
      const u = decodeURIComponent(await p3.evaluate(() => window.__opened || ""));
      ok(u.startsWith("https://wa.me/6281234567890?text=") && u.includes("Paket: Cek Kode Program") && u.includes("Nama: Budi Santoso") && u.includes("halaman/naskah: 12"), "pesan WhatsApp salah: " + u);
      await p3.evaluate(() => { SITE = siteCfg(); renderLayanan(); });
    });
    await c3.close();
  }

  console.log("Tampilan & aksesibilitas");
  for (const [name, opts] of [["HP 320px", devices["Galaxy S9+"]], ["iPhone", devices["iPhone 13"]], ["desktop gelap", { viewport: { width: 1366, height: 900 }, colorScheme: "dark" }]]) {
    await test(name + ": tanpa scroll horizontal dan tumpang-tindih di semua halaman" + (AXE ? " dan lolos audit WCAG" : ""), async () => {
      const { ctx: c, page: p } = await newPage(browser, opts);
      await p.goto(SITE); await ready(p);
      for (const v of ["beranda", "periksa", "massal", "kode", "sumber", "bandingkan", "tersembunyi", "pustaka", "daftarisi", "riwayat", "metode", "bantuan", "layanan"]) {
        await p.evaluate((v) => showView(v), v); await p.waitForTimeout(100);
        const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        ok(w[0] <= w[1], v + ": lebar " + w[0] + " > layar " + w[1]);
        const panes = v === "periksa" && (await p.isVisible("#msRes")) ? ["doc", "res"] : [null];
        for (const pane of panes) {
          if (pane) await p.evaluate((x) => setPane(x), pane);
          // Footer harus berada di bawah semua kartu yang tampil (bug v2.2.0: footer menimpa panel hasil di HP).
          const o = await p.evaluate(() => {
            const f = document.querySelector(".foot").getBoundingClientRect(); let bottom = 0;
            document.querySelectorAll(".view.on .card").forEach((c) => {
              const r = c.getBoundingClientRect(); if (!r.height) return;
              // Kartu di dalam panel yang bisa digulir sendiri (desktop) hanya terlihat sampai batas panel itu.
              const sc = c.closest(".panel"); let b = r.bottom;
              if (sc && getComputedStyle(sc).overflowY !== "visible") b = Math.min(b, sc.getBoundingClientRect().bottom);
              bottom = Math.max(bottom, b);
            });
            return [f.top, bottom];
          });
          ok(o[0] >= o[1] - 1, v + (pane ? "/" + pane : "") + ": footer menimpa kartu");
        }
        if (panes[0]) await p.evaluate(() => setPane("doc"));
        if (AXE) {
          await p.addScriptTag({ path: AXE });
          const r = await p.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }));
          ok(!r.violations.length, v + ": " + r.violations.map((x) => x.id + " (" + x.nodes[0].target.join(" ") + ")").join(", "));
        }
      }
      ok(!p.errors.length, p.errors.join("; "));
      await c.close();
    });
  }

  console.log("File mandiri (dist/CekTeks.html) tanpa internet");
  await test("berjalan penuh offline, termasuk PDF dan laporan", async () => {
    const { ctx: c, page: p } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await c.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
    await p.goto("file://" + DIST); await ready(p);
    await p.setInputFiles("#mainFile", path.join(FIX, "sample.pdf"));
    await p.waitForFunction(() => S.doc && S.doc.layout, null, { timeout: 30000 });
    const r = await download(p, "#dlPdf");
    ok(r.buf.slice(0, 4).toString() === "%PDF", "laporan PDF gagal dibuat offline");
    ok(!p.errors.length, p.errors.join("; "));
    await c.close();
  });

  srv.close(); await browser.close();
  if (!AXE) console.log("\n(Catatan: axe-core tidak ditemukan, audit WCAG dilewati. Jalankan npm install.)");
  console.log("\n" + passed + " lolos, " + failed + " gagal");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
