// Jembatan CekTeks — Cloudflare Worker (gratis hingga 100.000 permintaan per hari).
//
// Browser tidak boleh mengambil PDF jurnal OJS, repositori kampus, atau halaman web lain secara
// langsung (dibatasi CORS). Jembatan ini mengambilkannya untuk CekTeks milik Anda sendiri.
//
// Pengaturan (Settings → Variables di dasbor Cloudflare):
//   KUNCI   (wajib)  rahasia acak, mis. hasil `openssl rand -hex 16`. Isi yang sama di CekTeks.
//   ASAL    (opsional) asal situs CekTeks yang boleh memakai jembatan, dipisah koma,
//            mis. "https://namaanda.github.io". Kosong = semua asal (tetap butuh KUNCI).
//
// Pemakaian:  GET https://<jembatan>/?k=<KUNCI>&url=<alamat yang di-encode>
//             GET https://<jembatan>/?k=<KUNCI>&ping=1   -> {"ok":true}
//
// Batasan keamanan: hanya GET, hanya http/https, tanpa cookie/kredensial, ukuran maks. 15 MB,
// batas waktu 25 detik, hasil disimpan di cache Cloudflare selama 1 hari.

const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 25000;
const UA = "Mozilla/5.0 (compatible; CekTeks-Jembatan/1.0; +https://github.com/ferdynandekawijaya92821-create/kalori-cli)";

function cors(origin, env) {
  const allow = String(env.ASAL || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = !allow.length || allow.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? (allow.length ? origin : "*") : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "X-Jembatan-Type, X-Jembatan-Url",
    Vary: "Origin",
  };
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
// Sama panjang -> bandingkan per karakter agar waktu tidak membocorkan isi kunci.
function sameKey(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function badHost(h) {
  h = h.toLowerCase();
  return h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127|10|0)\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h) || h === "[::1]" || /^\[(fc|fd|fe80)/i.test(h);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const H = cors(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
    if (request.method !== "GET") return json({ error: "Hanya GET" }, 405, H);
    if (!env.KUNCI) return json({ error: "KUNCI belum diatur di Cloudflare" }, 500, H);
    if (H["Access-Control-Allow-Origin"] === "null") return json({ error: "Asal situs tidak diizinkan" }, 403, H);

    const q = new URL(request.url).searchParams;
    if (!sameKey(q.get("k") || "", env.KUNCI)) return json({ error: "Kunci salah" }, 401, H);
    if (q.get("ping")) return json({ ok: true, versi: 1 }, 200, H);

    let target;
    try { target = new URL(q.get("url") || ""); } catch (e) { return json({ error: "Alamat tidak sah" }, 400, H); }
    if (!/^https?:$/.test(target.protocol) || badHost(target.hostname) || target.username || target.password) return json({ error: "Alamat tidak diizinkan" }, 400, H);

    const cache = caches.default, key = new Request("https://cache.cekteks/" + encodeURIComponent(target.href));
    const hit = await cache.match(key);
    if (hit) { const r = new Response(hit.body, hit); Object.entries(H).forEach(([k, v]) => r.headers.set(k, v)); return r; }

    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let up;
    try {
      up = await fetch(target.href, { redirect: "follow", signal: ctl.signal,
        headers: { "User-Agent": UA, Accept: "application/pdf,text/html;q=0.9,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "id,en;q=0.8" } });
    } catch (e) { clearTimeout(tm); return json({ error: "Gagal mengambil: " + (e.name === "AbortError" ? "waktu habis" : e.message) }, 502, H); }
    if (!up.ok) { clearTimeout(tm); return json({ error: "Situs tujuan membalas HTTP " + up.status, status: up.status }, 502, H); }
    const len = +up.headers.get("Content-Length") || 0;
    if (len > MAX_BYTES) { clearTimeout(tm); return json({ error: "Berkas terlalu besar" }, 413, H); }

    // Baca dengan batas ukuran (Content-Length bisa tidak ada).
    const reader = up.body.getReader(), parts = []; let n = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        n += value.byteLength; if (n > MAX_BYTES) { ctl.abort(); clearTimeout(tm); return json({ error: "Berkas terlalu besar" }, 413, H); }
        parts.push(value);
      }
    } catch (e) { clearTimeout(tm); return json({ error: "Unduhan terputus" }, 502, H); }
    clearTimeout(tm);
    const body = new Uint8Array(n); let o = 0; for (const p of parts) { body.set(p, o); o += p.byteLength; }
    const type = up.headers.get("Content-Type") || "application/octet-stream";
    const out = new Response(body, { status: 200, headers: { ...H, "Content-Type": type, "X-Jembatan-Type": type, "X-Jembatan-Url": up.url, "Cache-Control": "public, max-age=86400" } });
    ctx.waitUntil(cache.put(key, out.clone()));
    return out;
  },
};
