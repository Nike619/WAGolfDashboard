// Service worker: network first, saved copy when offline.
// Online, every request goes to the network, so the page and tee times are never stale; each successful
// response is saved. Offline, the last saved copy is served. No precache list, so nothing to keep in sync.
const CACHE = 'open-tee-sheet-v2';

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
      // no-cache: always check with the server (cheap 304 when unchanged), so a deploy never mixes new and old files.
      // A navigation request can't be re-initialized, so it's refetched by URL.
      const get = () => fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' });
      // One retry: a single dropped request for a module the cache doesn't have yet would otherwise break the whole page.
      const res = await get().catch(() => new Promise(r => setTimeout(r, 300)).then(get));
      if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy))); }
      return res;
    } catch (err) {
      const hit = await caches.match(key) || (req.mode === 'navigate' && await caches.match(new URL('./', location).href));
      if (hit) return hit;
      throw err;
    }
  })());
});
