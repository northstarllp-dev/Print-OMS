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

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'New Notification', body: event.data.text() };
    }
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: data.icon || '/clients/printoms/favicon_io/favicon-32x32.png',
    badge: data.badge || '/clients/printoms/favicon_io/favicon-32x32.png',
    data: {
      link: data.data?.link || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If window is already open, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
