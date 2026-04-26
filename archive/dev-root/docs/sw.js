const CACHE_NAME = 'gys-cache-v44';
const APP_VERSION = '3.6.12';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for version check messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: APP_VERSION });
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((name) => caches.delete(name)));
    }).then(() => {
      event.source.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache standard dynamic assets or user content
  if (url.pathname.includes('/midi/') || 
      url.pathname.includes('/pdf/') || 
      url.pathname.includes('/chord/') || 
      url.pathname.includes('assets-list.json')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (event.request.method !== 'GET') {
    return;
  }

  // Local app files (JS, CSS, HTML) use network-first so users get
  // the latest code immediately after deployment.
  const isLocalAppFile = url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/'));

  if (isLocalAppFile) {
    // Network-first with offline fallback to cache.
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => caches.match(event.request));
      })
    );
    return;
  }

  // All other assets (CDN scripts, fonts, images): cache-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((e) => {
         console.warn('Network fetch failed for', event.request.url, e);
      });
    })
  );
});