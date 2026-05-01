const CACHE_VERSION = 'v4.1';                    // ← Increment this to force cache update
const CACHE_NAME = 'fieldsheet-' + CACHE_VERSION;

const STATIC_ASSETS = [
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

// ==================== INSTALL ====================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`[SW] Installing cache: ${CACHE_NAME}`);
                
                // Cache each file individually so one failure doesn't break the whole install
                return Promise.all(
                    STATIC_ASSETS.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn(`[SW] Failed to cache: ${url}`, err);
                            // Continue installing even if one file fails
                        });
                    })
                );
            })
            .then(() => {
                console.log(`[SW] Installation completed for ${CACHE_NAME}`);
                // Do NOT call skipWaiting() here — wait for user confirmation via update banner
            })
    );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.startsWith('fieldsheet-') && cacheName !== CACHE_NAME) {
                        console.log(`[SW] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW] Claiming clients for ${CACHE_NAME}`);
            return self.clients.claim();
        })
    );
});

// ==================== FETCH ====================
self.addEventListener('fetch', event => {
    // Skip non-GET requests (POST, etc.)
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Bypass cache for EmailJS API calls — must always go to network
    if (url.hostname === 'api.emailjs.com') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached version if available
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Otherwise fetch from network
                return fetch(event.request)
                    .then(networkResponse => {
                        // Only cache successful responses (status 200)
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed and no cache → return offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./').then(response => {
                                return response || new Response(
                                    `
                                    <!DOCTYPE html>
                                    <html lang="en">
                                    <head>
                                        <meta charset="UTF-8">
                                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                        <title>Offline - VB Built FieldSheet</title>
                                        <style>
                                            body {
                                                font-family: system-ui, sans-serif;
                                                background: #0f1f35;
                                                color: white;
                                                height: 100vh;
                                                margin: 0;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                text-align: center;
                                                padding: 20px;
                                            }
                                            .offline-card {
                                                max-width: 380px;
                                            }
                                            h1 { margin-bottom: 12px; }
                                            p { margin-bottom: 24px; opacity: 0.9; }
                                            button {
                                                background: #f59e0b;
                                                color: #0f1f35;
                                                border: none;
                                                padding: 14px 28px;
                                                font-size: 16px;
                                                font-weight: 600;
                                                border-radius: 8px;
                                                cursor: pointer;
                                            }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="offline-card">
                                            <h1>📴 You're Offline</h1>
                                            <p>The app is currently offline. Some features may be limited.</p>
                                            <button onclick="window.location.reload()">Try Again</button>
                                        </div>
                                    </body>
                                    </html>
                                    `,
                                    { 
                                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                                        status: 200 
                                    }
                                );
                            });
                        }
                        // For other resources, just fail silently
                        return new Response('', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});

// ==================== MESSAGE HANDLING ====================
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'SKIP_WAITING') {
        console.log('[SW] Received skipWaiting message');
        self.skipWaiting();
    }
});
