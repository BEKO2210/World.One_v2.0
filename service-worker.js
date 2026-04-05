/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Service Worker
   Strategy: Network-first for data, Stale-while-revalidate for assets
   ═══════════════════════════════════════════════════════════ */

// IMPORTANT: Bump this version on every deploy so users get fresh code.
// The data-pipeline auto-increments this via generate-meta.js.
const CACHE_VERSION = '20260405-1247';
const CACHE_NAME = `worldone-${CACHE_VERSION}`;
const DATA_PATHS = ['/world-state.json', '/manifest.json', '/data/'];

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/core.css',
  './css/components.css',
  './css/sections.css',
  './css/animations.css',
  './js/app.js',
  './js/data-loader.js',
  './js/scroll-engine.js',
  './js/i18n.js',
  './js/utils/math.js',
  './js/utils/dom.js',
  './js/visualizations/world-indicator.js',
  './js/visualizations/charts.js',
  './js/visualizations/maps.js',
  './js/visualizations/particles.js',
  './js/visualizations/counters.js',
  './js/visualizations/cinematic.js',
  './assets/icon/icon-192.png',
  './assets/icon/icon-512.png',
  './detail/index.html',
  './css/detail.css',
  './detail/detail-app.js'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())   // Activate immediately
  );
});

// Activate: delete ALL old caches, claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Data files: network-first (freshness matters)
  const isData = DATA_PATHS.some(p => url.pathname.includes(p));

  if (isData) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets: stale-while-revalidate
  // Serve cached version instantly, then fetch fresh version in background
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response.ok && url.origin === self.location.origin) {
            cache.put(event.request, response.clone());
          }
          return response;
        });

        // Return cached immediately, update in background
        return cached || networkFetch;
      })
    )
  );
});
