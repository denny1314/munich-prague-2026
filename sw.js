/* Munich & Prague family itinerary offline shell.
   HTML contains all CSS, JS and travel JSON; external maps/weather still need a connection. */
const CACHE_NAME='mp26-core-20261117-v2';
const CACHE_PREFIX='mp26-core-';
const BASE=new URL(self.registration.scope);
const INDEX_URL=new URL('./index.html',BASE).href;
const CORE_URLS=[INDEX_URL,new URL('./manifest.webmanifest',BASE).href,new URL('./icon.svg',BASE).href];
const CORE_SET=new Set(CORE_URLS);

async function notifyTabs(type){
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  tabs.forEach(tab=>tab.postMessage({type}));
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    // Installation only succeeds if every essential offline asset has been saved.
    await cache.addAll(CORE_URLS.map(url=>new Request(url,{cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(name=>(name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)||name==='winter-notes-2026-v1').map(name=>caches.delete(name)));
    await self.clients.claim();
    await notifyTabs('TRIP_CACHE_READY');
  })());
});
async function cacheFirst(request,key,isDocument){
  const cache=await caches.open(CACHE_NAME);
  const existing=await cache.match(key);
  if(existing)return existing;
  try{
    const fresh=await fetch(request,{cache:'no-store'});
    if(fresh.ok&&fresh.type!=='opaque')await cache.put(key,fresh.clone());
    return fresh;
  }catch(error){
    if(isDocument){const fallback=await cache.match(INDEX_URL);if(fallback)return fallback}
    return Response.error();
  }
}
async function refreshCore(key){
  const cache=await caches.open(CACHE_NAME),old=await cache.match(key);
  if(!old)return; // Never substitute a partial offline installation for the full shell.
  try{
    const fresh=await fetch(key,{cache:'no-store'});
    if(!fresh.ok||fresh.type==='opaque')return;
    const previousText=await old.clone().text(),nextText=await fresh.clone().text();
    if(previousText===nextText)return;
    await cache.put(key,fresh.clone());
    if(key===INDEX_URL)await notifyTabs('TRIP_UPDATE_READY');
  }catch(error){
    // Offline network failures do not invalidate previously saved itinerary data.
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==BASE.origin)return; // Do not cache third-party sites, maps or weather APIs.
  const doc=url.pathname===BASE.pathname||url.pathname===new URL(INDEX_URL).pathname;
  const isDocument=doc&&(request.mode==='navigate'||request.destination==='document');
  const key=isDocument?INDEX_URL:url.href;
  if(!isDocument&&!CORE_SET.has(key))return;
  // Cache-first: immediately return the local copy, then refresh it in the background.
  event.respondWith(cacheFirst(request,key,isDocument));
  event.waitUntil(refreshCore(key));
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='CHECK_TRIP_UPDATES'){
    event.waitUntil(refreshCore(INDEX_URL));
  }
});
