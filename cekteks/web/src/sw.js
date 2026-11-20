// Service worker CekTeks: menyimpan aplikasi di perangkat agar tetap bisa dibuka tanpa internet.
const CACHE = "cekteks-v6";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
const VENDOR = [/*VENDOR_FILES*/];

self.addEventListener("install", (e) => {
  // Halaman utama wajib tersimpan; pustaka besar disimpan sebisanya agar unggah PDF/Word tetap jalan offline.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(CORE).then(() => Promise.all(VENDOR.map((u) => c.add(u).catch(() => null)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // pencarian internet tidak disimpan
  if (url.pathname.includes("/vendor/")) {
    // Pustaka tidak berubah antarversi: ambil dari simpanan dulu.
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
    })));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
