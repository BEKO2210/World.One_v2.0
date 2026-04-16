/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Service Worker
   Strategy: Network-first for data, Stale-while-revalidate for assets
   ═══════════════════════════════════════════════════════════ */

// IMPORTANT: Bump this version on EVERY deploy so users get fresh code.
// - data-pipeline workflow auto-bumps this via sed (see .github/workflows/
//   data-pipeline.yml "Bump service worker cache version").
// - For direct commits that touch JS/CSS/HTML: bump manually to the current
//   ISO minute so the new SW supersedes the old one immediately.
const CACHE_VERSION = '20260416-0105';
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
  './js/utils/badge.js',
  './js/utils/chart-manager.js',
  './js/utils/data-loader.js',
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

// Install: pre-cache core assets. Resilient — a single 404 on any asset
// must not block the whole install (which would prevent skipWaiting and
// keep the old SW alive).
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(
      PRECACHE_ASSETS.map(url =>
        fetch(url, { cache: 'reload' })
          .then(r => r.ok ? cache.put(url, r) : null)
          .catch(() => null)
      )
    );
    await self.skipWaiting();  // Activate immediately
  })());
});

// Activate: delete ALL old caches, claim all clients, notify pages.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // Tell open pages the new SW is live. Registration listener in index.html
    // decides whether to reload (safe because the site has no form state).
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client =>
      client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION })
    );
  })());
});

// Listen for explicit skipWaiting request from the page (in case a future
// version disables the automatic skipWaiting above).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
