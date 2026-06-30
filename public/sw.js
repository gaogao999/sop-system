// SOP system service worker — app-shell cache so the UI loads fast and stays
// installable (PWA) on the shop floor. Strategy:
//   • Never cache /api/, /checklogin, /logout or downloads — always live.
//   • Static assets (CSS/JS/icons): stale-while-revalidate.
//   • Navigations: network-first, falling back to the cached shell offline.
// Bump CACHE_VERSION to retire old caches after a deploy.
const CACHE_VERSION = 'sop-v1';
const SHELL = [
  '/',
  '/assets/style.css',
  '/assets/app.js',
  '/assets/zxing.min.js',
  '/assets/manifest.webmanifest',
  '/assets/icon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Requests that must always hit the network (auth + data + file downloads)
function isLive(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/checklogin' ||
    url.pathname === '/logout' ||
    url.pathname === '/sw.js'
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isLive(url)) return; // let the network handle it

  // Navigations: try the network, fall back to the cached shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || caches.match(req)))
    );
    return;
  }

  // Static assets: serve cache immediately, refresh in the background
  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
