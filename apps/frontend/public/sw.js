const CACHE = 'camlam-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then((m) => m || caches.match('/')))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {}
  const title = d.title || 'Cam Lâm Land';
  const opts = { body: d.body || 'Bạn có tin nhắn mới', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: d.tag || 'chat', renotify: true, data: { url: d.url || '/' }, vibrate: [70, 40, 70] };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.focus(); if (c.navigate) { try { c.navigate(url); } catch (x) {} } return; } }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
