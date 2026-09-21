// Minimal service worker: enables "Add to Home Screen" / install prompts and gives a
// basic offline fallback for the site shell. Never touches cross-origin requests
// (Supabase API/storage, the Supabase JS CDN script) so data is always fresh.
const CACHE_NAME = 'kl-site-shell-v1';
const SHELL_URLS = ['./', './index.html', '../shared/supabaseClient.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return; // let cross-origin calls (Supabase, CDN) and non-GET requests pass through untouched
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
