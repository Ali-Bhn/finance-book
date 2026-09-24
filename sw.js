// Service worker: caches the app shell so it keeps working offline.
// Bump CACHE_NAME whenever a precached file changes so old caches get replaced.
const CACHE_NAME = 'finance-book-v13';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/storage.js',
  './js/settings.js',
  './js/jalali.js',
  './js/i18n.js',
  './js/utils.js',
  './js/transactions.js',
  './js/installments.js',
  './js/recurring.js',
  './js/dashboard.js',
  './js/reports.js',
  './js/ui.js',
  './js/firebase-config.js',
  './js/merge.js',
  './js/vault.js',
  './js/sync.js',
  './js/cloud.js',
  './js/account.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin requests (the app shell); cross-origin requests
// (Chart.js/jsPDF/html2canvas CDNs, Google Fonts) are left to the network/browser cache
// so an install never fails because of a third-party outage.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
