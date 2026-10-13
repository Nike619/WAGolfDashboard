// Service worker: network first, saved copy when offline.
// Online, every request goes to the network, so the page and tee times are never stale; each successful
// response is saved. Offline, the last saved copy is served. No precache list, so nothing to keep in sync.
const CACHE = 'open-tee-sheet-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // data/*.json carry a ?t= cache-buster; save one copy per file
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy))); }
      return res;
    } catch (err) {
      const hit = await caches.match(key) || (req.mode === 'navigate' && await caches.match(new URL('./', location).href));
      if (hit) return hit;
      throw err;
    }
  })());
});
