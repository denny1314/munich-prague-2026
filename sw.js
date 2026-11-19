/* Munich & Prague family itinerary offline shell.
   Core assets are versioned, installed together and served cache-first.
   External maps and weather still require a connection. */
const CACHE_NAME='mp26-core-20261118-v24';
const CACHE_PREFIX='mp26-core-';
const BASE=new URL(self.registration.scope);
const INDEX_URL=new URL('./index.html',BASE).href;
const CORE_URLS=[INDEX_URL,...['styles.css','travel-theme.css','app.js','trip.json','trip-en.json','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png'].map(p=>new URL('./'+p,BASE).href)];
const CORE_SET=new Set(CORE_URLS);

const NETWORK_TIMEOUT_MS=3000;
/* Wait for the response body, not only headers, so a stalled download also
   hits the deadline. Returning the original Response preserves its headers. */
async function fetchWithinDeadline(request,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),NETWORK_TIMEOUT_MS);
  try{
    const response=await fetch(request,{...(options||{cache:'no-store'}),signal:controller.signal});
    await response.clone().arrayBuffer();
    return response;
  }finally{
    clearTimeout(timer);
  }
}


async function notifyTabs(type){
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  tabs.forEach(tab=>tab.postMessage({type}));
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    // Installation only succeeds if every essential offline asset has been saved.
    const assets=await Promise.all(CORE_URLS.map(async url=>{
      const response=await fetchWithinDeadline(new Request(url,{cache:'reload'}),{cache:'reload'});
      if(!response.ok||response.type==='opaque')throw Error('Core asset unavailable: '+url);
      return {url,response};
    }));
    await Promise.all(assets.map(asset=>cache.put(asset.url,asset.response)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(name=>(name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)||name==='winter-notes-2026-v1').map(name=>caches.delete(name)));
    await self.clients.claim();
    await notifyTabs('TRIP_CACHE_READY');
    await notifyTabs('TRIP_UPDATE_READY');
  })());
});
async function cacheFirst(request,key,isDocument){
  const cache=await caches.open(CACHE_NAME);
  const existing=await cache.match(key);
  if(existing)return existing;
  try{
    const fresh=await fetchWithinDeadline(request,{cache:'no-store'});
    if(fresh.ok&&fresh.type!=='opaque')await cache.put(key,fresh.clone());
    return fresh;
  }catch(error){
    // An older complete installation is better than a browser error on weak 4G.
    const previous=await caches.match(key);
    if(previous)return previous;
    if(isDocument){
      const fallback=await caches.match(INDEX_URL);
      if(fallback)return fallback;
    }
    return Response.error();
  }
}
async function refreshCore(key){
  const cache=await caches.open(CACHE_NAME),old=await cache.match(key);
  if(!old)return; // Never substitute a partial offline installation for the full shell.
  try{
    const fresh=await fetchWithinDeadline(key,{cache:'no-store'});
    if(!fresh.ok||fresh.type==='opaque')return;
    const previousText=await old.clone().text(),nextText=await fresh.clone().text();
    if(previousText===nextText)return;
    await cache.put(key,fresh.clone());
    await notifyTabs('TRIP_UPDATE_READY');
  }catch(error){
    // Offline network failures do not invalidate previously saved itinerary data.
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(request.destination==='image'&&url.hostname==='thumb.wikimedia.org'){
    event.respondWith((async()=>{
      const cache=await caches.open('mp26-photo-cache-v1');
      const found=await cache.match(request);
      if(found)return found;
      try{
        const response=await fetch(request);
        if(response.ok||response.type==='opaque')await cache.put(request,response.clone());
        return response;
      }catch(error){return Response.error()}
    })());
    return;
  }
  if(url.origin!==BASE.origin)return; // Don't cache Maps, weather or unrelated external content.
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
    event.waitUntil(Promise.all([INDEX_URL,new URL('./trip.json',BASE).href,new URL('./trip-en.json',BASE).href].map(refreshCore)));
  }
});
