// ─── UPDATE THIS VERSION STRING ON EVERY DEPLOY ───────────────────────────
const CACHE = 'smara-v6';
// ──────────────────────────────────────────────────────────────────────────

const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete ALL old caches immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all open tabs to reload
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// Fetch strategy:
// HTML → Network first (always fresh), fallback to cache
// Assets (JS/CSS/icons) → Cache first, fallback to network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  const isHTML = e.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isHTML) {
    // Network first for HTML — always gets latest version
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Update cache with fresh HTML
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache first for assets — fast, offline-ready
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached || fetch(e.request)
          .then(res => {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return res;
          })
        )
        .catch(() => caches.match('/index.html'))
    );
  }
});
