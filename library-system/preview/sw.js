// Bump CACHE_VERSION on every meaningful release so old shells are evicted.
// Format: library-vYYYYMMDD-N
const CACHE_VERSION = 'library-v20260529-1';
const PRECACHE_ASSETS = ['./manifest.json']; // Don't precache index.html — always fetch fresh

// Install: precache known app shell assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: only cache same-origin GET requests, network-first strategy
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Only cache same-origin requests (not third-party APIs, fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API/worker requests even if same-origin
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/sync/')) return;

  // Always go to network for HTML — avoid stale app shell after a deploy.
  const isHtml = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/';
  if (isHtml) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
