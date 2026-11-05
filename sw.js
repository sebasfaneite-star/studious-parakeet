// Offline cache for UCKER Sales HQ. Bump VERSION whenever app files change.
const VERSION = 'ucker-hq-v4';
const FILES = ['./', 'index.html', 'local-db.js', 'manifest.webmanifest', 'logo-dark.png', 'logo.png',
  'data/leads.json', 'data/settings.json', 'icons/favicon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'vendor/jspdf.umd.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first so updates show up right away; fall back to the cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  const cacheable = sameOrigin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com';
  if (!cacheable) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (sameOrigin && e.request.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
