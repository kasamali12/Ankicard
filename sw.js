// sw.js
const CACHE_NAME = 'anki-flashcard-cache-v1';

// These are the essential files for the app shell to work offline.
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
];

// Install the service worker and cache the app shell.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercept fetch requests to serve cached assets when offline.
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
      return;
  }
  
  // Do not cache API requests to Google's services. They must be fetched live.
  if (event.request.url.includes('googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the request is in the cache, return the cached response.
        if (response) {
          return response;
        }

        // If it's not in the cache, fetch it from the network.
        return fetch(event.request).then(
          response => {
            // Check if we received a valid response.
            if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
              return response;
            }

            // Clone the response because it's a stream that can only be consumed once.
            const responseToCache = response.clone();

            // Open the cache and add the new response to it for future offline access.
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

// Clean up old caches on activation.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
