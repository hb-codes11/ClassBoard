// ClassBoard Service Worker for Background Web Push Notifications
const CACHE_NAME = 'classboard-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for incoming Web Push events from Supabase Edge Function
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'ClassBoard', body: event.data.text() };
    }
  }

  const title = payload.title || 'ClassBoard Update';
  const options = {
    body: payload.body || 'New announcement published for your class.',
    icon: payload.icon || './classboard-pwa-icon.svg',
    badge: payload.badge || './classboard-logo.svg',
    data: {
      url: payload.url || './#updates',
      timestamp: Date.now()
    },
    tag: payload.tag || 'classboard-update',
    renotify: true,
    vibrate: [100, 50, 100]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if ('navigate' in client && targetUrl) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

