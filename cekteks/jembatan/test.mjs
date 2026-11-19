// Uji jembatan tanpa Cloudflare: fetch dan cache ditiru.  Jalankan: node cekteks/jembatan/test.mjs
import worker from "./worker.js";

let passed = 0, failed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log("  ✓ " + name); } catch (e) { failed++; console.log("  ✗ " + name + "\n      " + e.message); } }
function ok(c, m) { if (!c) throw new Error(m); }

const store = new Map();
globalThis.caches = { default: { match: async (k) => store.get(k.url)?.clone(), put: async (k, r) => { store.set(k.url, r); } } };
let upstream = [];
globalThis.fetch = async (url) => {
  upstream.push(url);
  if (url.includes("besar")) return new Response(new Uint8Array(16 * 1024 * 1024), { headers: { "Content-Type": "application/pdf" } });
  if (url.includes("hilang")) return new Response("x", { status: 404 });
  return new Response("%PDF-1.4 isi", { headers: { "Content-Type": "application/pdf" } });
};
const env = { KUNCI: "rahasia-uji-123456", ASAL: "https://situs.contoh" };
const ctx = { waitUntil: (p) => p };
const call = (qs, origin = "https://situs.contoh", method = "GET") => worker.fetch(new Request("https://jembatan.test/?" + qs, { method, headers: { Origin: origin } }), env, ctx);

console.log("Jembatan CekTeks");
await t("ping dengan kunci benar", async () => { const r = await call("k=rahasia-uji-123456&ping=1"); ok(r.status === 200 && (await r.json()).ok, "ping gagal"); });
await t("kunci salah ditolak", async () => { const r = await call("k=salah&ping=1"); ok(r.status === 401, "status " + r.status); });
await t("asal situs lain ditolak", async () => { const r = await call("k=rahasia-uji-123456&ping=1", "https://jahat.contoh"); ok(r.status === 403, "status " + r.status); });
await t("preflight OPTIONS memberi CORS", async () => { const r = await call("", "https://situs.contoh", "OPTIONS"); ok(r.status === 204 && r.headers.get("Access-Control-Allow-Origin") === "https://situs.contoh", "CORS salah"); });
await t("mengambil PDF dan menyimpannya di cache", async () => {
  upstream = [];
  const u = encodeURIComponent("https://jurnal.contoh.ac.id/article/download/1/2");
  const r1 = await call("k=rahasia-uji-123456&url=" + u), b1 = await r1.text();
  const r2 = await call("k=rahasia-uji-123456&url=" + u); await r2.text();
  ok(r1.status === 200 && b1.startsWith("%PDF") && r1.headers.get("X-Jembatan-Type") === "application/pdf", "isi/tipe salah");
  ok(upstream.length === 1, "cache tidak dipakai: " + upstream.length + " permintaan");
  ok(r2.headers.get("Access-Control-Allow-Origin") === "https://situs.contoh", "CORS hilang pada hasil cache");
});
await t("alamat lokal dan non-http ditolak", async () => {
  for (const u of ["http://127.0.0.1/x", "http://localhost/x", "http://192.168.1.1/", "file:///etc/passwd", "ftp://a.b/c", "http://user:pw@a.b/"]) {
    const r = await call("k=rahasia-uji-123456&url=" + encodeURIComponent(u)); ok(r.status === 400, u + " -> " + r.status);
  }
});
await t("berkas di atas 15 MB ditolak", async () => { const r = await call("k=rahasia-uji-123456&url=" + encodeURIComponent("https://a.b/besar.pdf")); ok(r.status === 413, "status " + r.status); });
await t("galat situs tujuan diteruskan sebagai 502", async () => { const r = await call("k=rahasia-uji-123456&url=" + encodeURIComponent("https://a.b/hilang")); ok(r.status === 502 && (await r.json()).status === 404, "status " + r.status); });
await t("hanya GET", async () => { const r = await call("k=rahasia-uji-123456&ping=1", "https://situs.contoh", "POST"); ok(r.status === 405, "status " + r.status); });

console.log("\n" + passed + " lolos, " + failed + " gagal");
process.exit(failed ? 1 : 0);
