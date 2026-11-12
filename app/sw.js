// Service worker — يخلي البرنامج يفتح بدون إنترنت بعد أول تشغيل
const C = 'mah-v2';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './assets/logo.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.pathname.includes('/downloads/') || u.pathname.endsWith('.apk')) return; // التحديثات بتتحمل مباشرة من غير كاش
  if (u.origin === location.origin) { e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put(r, cp)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('./index.html')))); return; }
  if (/cdnjs|fonts\.(googleapis|gstatic)/.test(u.host)) e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put(r, cp)); return res; })));
});
