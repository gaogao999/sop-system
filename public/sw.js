// SOP system service worker — keeps the app installable (PWA) and usable
// offline, WITHOUT ever serving a stale UI. Strategy:
//   • Never touch /api/, /checklogin, /logout or downloads — always live.
//   • Everything else (HTML, app.js, style.css, icons): NETWORK-FIRST.
//     The newest deploy is always shown; the cache is only an offline fallback.
//     (A previous "stale-while-revalidate" served an old app.js next to fresh
//     HTML, which showed raw i18n keys after a deploy — network-first fixes it.)
// Bump CACHE_VERSION on any change so old caches are dropped.
const CACHE_VERSION = 'sop-v2';
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

  // Network-first: always prefer the freshest file; cache it for offline use.
  // Fall back to the cache (or the cached shell for navigations) only when the
  // network is unavailable.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('/') : undefined))
      )
  );
});
