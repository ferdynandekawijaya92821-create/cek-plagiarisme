// Fungsi server Supabase (Edge Function) untuk analisis gaya tulisan oleh Claude.
// Rahasia yang dibutuhkan (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  kunci API dari console.anthropic.com (hanya di server, jangan di site.json)
//   ASAL               alamat situs yang boleh memakai, dipisah koma, mis. https://cekplagiarismeteks.id
//   BATAS_HARIAN       (opsional) jumlah analisis per akun per hari, bawaan 10
// SUPABASE_URL dan SUPABASE_ANON_KEY sudah tersedia otomatis di setiap Edge Function.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buatHandler } from "./inti.ts";

const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(buatHandler({
  anthropic: new Anthropic(), // membaca ANTHROPIC_API_KEY
  supabaseUntuk: (token) => createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as never,
  batasHarian: Math.max(1, Number(Deno.env.get("BATAS_HARIAN")) || 10),
  asal: (Deno.env.get("ASAL") || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
}));
