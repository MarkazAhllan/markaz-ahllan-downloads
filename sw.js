// الصفحة الرئيسية للموقع بقت صفحة تعريف — البرنامج نفسه انتقل لـ /app/
// الملف ده بيشيل الكاش القديم ويلغي نفسه عشان الصفحة الجديدة تظهر فوراً
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach((c) => { try { c.navigate(c.url); } catch (_) {} });
  })());
});
