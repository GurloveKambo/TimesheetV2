/* ================= VERSION ================= /
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'fieldsheet-' + CACHE_VERSION;

/ ================= FILES ================= /
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Figtree:wght@400;500;600;700&display=swap'
];

/ ================= INSTALL ================= /
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        FILES_TO_CACHE.map(url =>
          cache.add(url).catch(() => {
            // Prevent install failure if one file fails
            console.warn('Cache failed:', url);
          })
        )
      );
    })
  );
});

/ ================= ACTIVATE ================= /
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key.startsWith('fieldsheet-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

/ ================= FETCH ================= /
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only GET requests
  if (req.method !== 'GET') return;

  // Skip EmailJS API calls
  if (req.url.includes('api.emailjs.com')) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req)
        .then(res => {
          // Cache valid responses
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline fallback for HTML
          if (req.headers.get('accept')?.includes('text/html')) {
            return new Response(              <html>                 <body style="background:#0f1f35;color:white;text-align:center;padding:40px;font-family:sans-serif;">                   <h2>You're Offline</h2>                   <p>Please check your connection.</p>                   <button onclick="location.reload()">Try Again</button>                 </body>               </html>            , { headers: { 'Content-Type': 'text/html' } });
          }
        });
    })
  );
});

/ ================= UPDATE HANDLER ================= */
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});