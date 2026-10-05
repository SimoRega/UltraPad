const CACHE = 'ultrapad-shell-v1.2';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.add('/'))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ultrapad-shell-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/')));
  else if (url.pathname.startsWith('/assets/')) event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});
