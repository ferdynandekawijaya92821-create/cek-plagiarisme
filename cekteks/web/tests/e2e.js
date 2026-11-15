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
    await page.click(".srcitem");
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
  await test("tetap berjalan offline setelah kunjungan pertama", async () => {
    await page.click("#tab-periksa");
    await page.waitForFunction(async () => { const ks = await caches.keys(); if (!ks.length) return false; const c = await caches.open(ks[0]); return (await c.keys()).filter((r) => r.url.includes("/vendor/")).length === 5; }, null, { timeout: 30000 });
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
      for (const v of ["periksa", "sumber", "bandingkan", "metode"]) {
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
