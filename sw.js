const CACHE_NAME = 'alquran-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './surah.html',
  './reader.html',
  './search.html',
  './about.html',
  './css/style.css',
  'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;600;700&family=Lato:wght@300;400;700&display=swap'
];

// Quran API responses to cache (all 114 surahs, both editions)
const API_BASE = 'https://api.alquran.cloud/v1';

// ── INSTALL: cache all static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: network first for API, cache first for static ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // For Quran API calls: try network, fall back to cache
  if (url.includes('api.alquran.cloud')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone and cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For Google Fonts: try network, fall back to cache
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // For all other requests (HTML, CSS): cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

// ── BACKGROUND SYNC: pre-cache all 114 surahs when online ──
self.addEventListener('message', event => {
  if (event.data === 'CACHE_ALL_SURAHS') {
    cachAllSurahs();
  }
});

async function cachAllSurahs() {
  const cache = await caches.open(CACHE_NAME);
  const editions = 'quran-simple,en.asad';
  for (let i = 1; i <= 114; i++) {
    const url = `${API_BASE}/surah/${i}/editions/${editions}`;
    try {
      const res = await fetch(url);
      await cache.put(url, res);
    } catch {
      // Skip if offline
    }
  }
  // Also cache surah list
  try {
    const listRes = await fetch(`${API_BASE}/surah`);
    await cache.put(`${API_BASE}/surah`, listRes);
  } catch {}
}
