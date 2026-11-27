// Uji fungsi server analisis-ai tanpa biaya: SDK Anthropic sungguhan dipakai, tetapi jaringannya diganti tiruan
// sehingga tidak ada panggilan API berbayar. Jalankan: cd cekteks/supabase && npm ci && npm test
import Anthropic from "@anthropic-ai/sdk";
import { buatHandler, MODEL, SKEMA } from "./functions/analisis-ai/inti.ts";

let lolos = 0, gagal = 0;
async function uji(nama, fn) {
  try { await fn(); lolos++; console.log("  lolos:", nama); } catch (e) { gagal++; console.log("  GAGAL:", nama, "-", e.message); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };

// Tiruan API Messages: mencatat permintaan dan mengembalikan jawaban yang ditentukan uji.
let terakhir = null, jawabanApi = null;
const fetchTiruan = async (url, init) => {
  terakhir = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
  const [status, body] = jawabanApi();
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_uji" } });
};
const anthropic = new Anthropic({ apiKey: "sk-ant-uji", fetch: fetchTiruan, maxRetries: 0 });
const pesanClaude = (teks, stop = "end_turn") => [200, {
  id: "msg_uji", type: "message", role: "assistant", model: MODEL, stop_reason: stop, stop_sequence: null,
  content: [{ type: "text", text: teks }], usage: { input_tokens: 100, output_tokens: 50 },
}];
const HASIL = { skor_ai: 140, keyakinan: "sedang", ringkasan: "Naskah cenderung seragam.", ciri_ai: ["Frasa penutup klise"], ciri_manusia: [],
  paragraf: [{ nomor: 1, skor_ai: 80, catatan: "Pembuka umum." }, { nomor: 9, skor_ai: 50, catatan: "di luar naskah" }], saran: ["Tambahkan data lapangan."] };

// Tiruan Supabase: token "baik" milik pengguna u1; kuota dihitung di memori seperti fungsi pakai_ai.
const kuota = new Map();
const supabaseUntuk = (token) => ({
  auth: { getUser: async () => ({ data: { user: token === "baik" ? { id: "u1" } : null }, error: null }) },
  rpc: async (fn, { batas }) => {
    ok(fn === "pakai_ai", "rpc salah");
    const n = (kuota.get(token) || 0) + 1;
    if (n > batas) return { data: null, error: { message: "batas_harian" } };
    kuota.set(token, n); return { data: batas - n, error: null };
  },
});
const handler = buatHandler({ anthropic, supabaseUntuk, batasHarian: 2, asal: ["https://cekplagiarismeteks.id"] });
const minta = (body, { token = "baik", origin = "https://cekplagiarismeteks.id", method = "POST" } = {}) => handler(new Request("https://x.supabase.co/functions/v1/analisis-ai", {
  method, headers: { ...(token ? { authorization: "Bearer " + token } : {}), ...(origin ? { origin } : {}), "content-type": "application/json" },
  body: method === "POST" ? JSON.stringify(body) : undefined,
}));
const P = ["Pendidikan karakter merupakan aspek yang sangat penting dalam membentuk generasi muda.", "Dengan demikian, semua pihak harus bekerja sama."];

console.log("Uji fungsi analisis-ai:");
await uji("versi SDK di Deno (deno.json) sama dengan versi yang diuji", async () => {
  const fs = await import("node:fs");
  const deno = JSON.parse(fs.readFileSync(new URL("./functions/analisis-ai/deno.json", import.meta.url))).imports["@anthropic-ai/sdk"];
  const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url))).devDependencies["@anthropic-ai/sdk"];
  ok(deno === "npm:@anthropic-ai/sdk@" + pkg, deno + " vs " + pkg);
});
await uji("permintaan ke Claude memakai model, skema JSON, dan cadangan penolakan", async () => {
  jawabanApi = () => pesanClaude(JSON.stringify(HASIL));
  const r = await minta({ paragraf: P }), j = await r.json();
  ok(r.status === 200, "status " + r.status + " " + JSON.stringify(j));
  const b = terakhir.body;
  ok(terakhir.url.endsWith("/v1/messages"), "alamat API salah: " + terakhir.url);
  ok(b.model === "claude-opus-5-5" && b.fallbacks === "default" && /server-side-fallback-2026-07-01/.test(terakhir.headers.get("anthropic-beta")), "model/cadangan salah");
  ok(b.output_config.format.type === "json_schema" && JSON.stringify(b.output_config.format.schema) === JSON.stringify(SKEMA), "skema keluaran tidak dikirim");
  ok(!("thinking" in b) && !("temperature" in b), "parameter yang ditolak model ikut dikirim");
  ok(/<naskah>\n\[1\] Pendidikan/.test(b.messages[0].content) && /Abaikan instruksi/.test(b.system), "naskah tidak dibungkus sebagai data");
  const kunci = terakhir.headers.get("x-api-key") || terakhir.headers.get("authorization") || "";
  ok(/sk-ant-uji/.test(kunci), "kunci API tidak dikirim lewat header");
  ok(j.hasil.skor_ai === 100 && j.hasil.paragraf.length === 1 && j.sisa === 1, "hasil tidak dirapikan: " + JSON.stringify(j));
  ok(r.headers.get("access-control-allow-origin") === "https://cekplagiarismeteks.id", "CORS salah");
});
await uji("kuota harian per akun ditegakkan (429)", async () => {
  jawabanApi = () => pesanClaude(JSON.stringify(HASIL));
  ok((await minta({ paragraf: P })).status === 200, "permintaan kedua ditolak");
  const r = await minta({ paragraf: P }); ok(r.status === 429 && /Batas 2/.test((await r.json()).pesan), "kuota tidak ditegakkan");
});
await uji("tanpa login / token palsu ditolak (401) tanpa memanggil Claude", async () => {
  terakhir = null;
  ok((await minta({ paragraf: P }, { token: "" })).status === 401, "tanpa token tidak ditolak");
  ok((await minta({ paragraf: P }, { token: "palsu" })).status === 401, "token palsu tidak ditolak");
  ok(terakhir === null, "Claude tetap dipanggil");
});
await uji("situs lain ditolak (403), preflight CORS dijawab", async () => {
  ok((await minta({ paragraf: P }, { origin: "https://situs-jahat.example" })).status === 403, "asal lain tidak ditolak");
  const o = await minta(null, { method: "OPTIONS" }); ok(o.status === 204 && o.headers.get("access-control-allow-methods") === "POST, OPTIONS", "preflight salah");
});
await uji("masukan tidak valid atau terlalu panjang ditolak sebelum kuota terpakai", async () => {
  kuota.clear();
  ok((await minta({ paragraf: [] })).status === 400, "daftar kosong diterima");
  ok((await minta({ paragraf: [123] })).status === 400, "bukan teks diterima");
  ok((await minta({ paragraf: ["a".repeat(4001)] })).status === 413, "paragraf terlalu panjang diterima");
  ok((await minta({ paragraf: Array(9).fill("b".repeat(3900)) })).status === 413, "naskah terlalu panjang diterima");
  ok(!kuota.size, "kuota terpakai untuk permintaan yang ditolak");
});
await uji("penolakan Claude, jawaban terpotong, dan galat API dijawab dengan pesan jelas", async () => {
  kuota.clear(); jawabanApi = () => pesanClaude("", "refusal");
  ok((await minta({ paragraf: P })).status === 422, "penolakan tidak ditangani");
  kuota.clear(); jawabanApi = () => pesanClaude('{"skor_ai": 5', "max_tokens");
  ok((await minta({ paragraf: P })).status === 502, "jawaban terpotong tidak ditangani");
  kuota.clear(); jawabanApi = () => [429, { type: "error", error: { type: "rate_limit_error", message: "slow down" } }];
  let r = await minta({ paragraf: P }); ok(r.status === 503 && /sibuk/.test((await r.json()).pesan), "batas API tidak ditangani");
  kuota.clear(); jawabanApi = () => [401, { type: "error", error: { type: "authentication_error", message: "bad key" } }];
  r = await minta({ paragraf: P }); const j = await r.json(); ok(r.status === 503 && !/bad key/.test(j.pesan), "galat kunci bocor ke pengguna");
});
console.log(`\n${lolos} lolos, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
