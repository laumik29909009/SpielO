// =============================================================
//  SpielO Service Worker: Seite sofort anzeigen, auch wenn der Server noch schläft
//  - Startseite: erst das Netz fragen (max. 2,5 s), sonst die gespeicherte Version zeigen
//  - CSS/JS/Bilder: aus dem Speicher, im Hintergrund aktualisieren
//  - Socket.IO, API, QR-Codes und Spendenlink: immer direkt ans Netz
// =============================================================
const SPEICHER = "spielo-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (/^\/(socket\.io|api|qr|spenden|musik)\b/.test(url.pathname)) return;

  // Seite: Netz zuerst, bei Zeitüberschreitung (Server wacht gerade auf) die gespeicherte Version
  if (e.request.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(SPEICHER);
      const netz = fetch(e.request).then((r) => {
        if (r.ok) cache.put("/", r.clone());
        return r;
      });
      const gespeichert = await cache.match("/");
      if (!gespeichert) return netz;
      const zeit = new Promise((ok) => setTimeout(() => ok(gespeichert), 2500));
      return Promise.race([netz.catch(() => gespeichert), zeit]);
    })());
    return;
  }

  // Dateien: aus dem Speicher, im Hintergrund aktualisieren
  e.respondWith((async () => {
    const cache = await caches.open(SPEICHER);
    const gespeichert = await cache.match(e.request);
    const netz = fetch(e.request).then((r) => {
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    }).catch(() => gespeichert);
    return gespeichert || netz;
  })());
});
