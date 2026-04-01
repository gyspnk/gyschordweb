const CACHE_NAME = 'gys-cache-v2';

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache standard dynamic assets or user content
  if (url.pathname.includes('/midi/') || 
      url.pathname.includes('/pdf/') || 
      url.pathname.includes('/chord/') || 
      url.pathname.includes('assets-list.json') || 
      url.pathname.includes('chord-assets-list.json')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Cache hit
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache valid responses including opaque responses from CDNs
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