// Önce internetten dener, bağlantı yoksa son kaydedilen kopyayı gösterir.
const ONBELLEK = "borsa-v1";
const KABUK = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "ikon.svg", "ikon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== ONBELLEK).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const anahtar = url.pathname.endsWith("fiyatlar.json") ? url.origin + url.pathname : e.request;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const kopya = r.clone(); caches.open(ONBELLEK).then((c) => c.put(anahtar, kopya)); return r; })
      .catch(() => caches.match(anahtar))
  );
});
