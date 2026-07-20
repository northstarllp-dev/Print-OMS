// Minimal service worker — satisfies PWA installability criteria.
// No aggressive caching to avoid interfering with Supabase auth flows.

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Pass all fetch requests through — no caching
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
