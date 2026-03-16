const CACHE = 'sous-v1';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('/')))
  );
});

// Handle share target
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname === '/share' && e.request.method === 'POST') {
    e.respondWith(
      e.request.formData().then(data => {
        const shared = {
          title: data.get('title') || '',
          text: data.get('text') || '',
          url: data.get('url') || ''
        };
        const redirectUrl = `/?shared=${encodeURIComponent(JSON.stringify(shared))}`;
        return Response.redirect(redirectUrl, 303);
      })
    );
  }
});
