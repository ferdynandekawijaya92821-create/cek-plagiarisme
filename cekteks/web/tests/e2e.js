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
    ok(fs.statSync(path.join(DOCS, "index.html")).size < 400 * 1024, "docs/index.html lebih dari 400 KB");
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
    for (const id of ["wWikiId", "wWikiEn", "wOpenAlex"]) await page.uncheck("#" + id);
    await page.click("#webBtn");
    await page.waitForFunction(() => document.getElementById("webProg").hidden, null, { timeout: 30000 });
    const r = await page.evaluate(() => [S.plag.groups.publikasi, S.webSources.map((w) => w.kind).sort().join(",")]);
    ok(r[1].includes("DOAJ") && r[1].includes("Crossref"), "sumber yang ditemukan: " + r[1]);
    ok(r[0] > 50, "kesamaan dengan jurnal hanya " + r[0] + "%");
    await ctx.unroute(/doaj\.org/); await ctx.unroute(/api\.crossref\.org/);
    await page.click("#webClear");
    for (const id of ["wWikiId", "wWikiEn", "wOpenAlex"]) await page.check("#" + id);
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

  console.log("Tampilan & aksesibilitas");
  for (const [name, opts] of [["HP 320px", devices["Galaxy S9+"]], ["iPhone", devices["iPhone 13"]], ["desktop gelap", { viewport: { width: 1366, height: 900 }, colorScheme: "dark" }]]) {
    await test(name + ": tanpa scroll horizontal dan tumpang-tindih di semua halaman" + (AXE ? " dan lolos audit WCAG" : ""), async () => {
      const { ctx: c, page: p } = await newPage(browser, opts);
      await p.goto(SITE); await ready(p);
      for (const v of ["periksa", "sumber", "bandingkan", "riwayat", "metode"]) {
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
