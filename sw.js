/* Retire the offline-first service worker for the Munich/Prague itinerary.
   This file is kept temporarily to upgrade existing installed workers.
   New website visits no longer register a service worker. */
self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await self.clients.claim();
    const keys=await caches.keys();
    await Promise.all(keys.filter(name=>name.startsWith('mp26-core-')||name==='mp26-photo-cache-v1').map(name=>caches.delete(name)));
    await self.registration.unregister();
  })());
});
