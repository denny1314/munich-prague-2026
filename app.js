(async function(){
'use strict';
var D,EN=null,lang='zh',LANG_KEY='mp26-preferred-language';
try{if(localStorage.getItem(LANG_KEY)==='en')lang='en'}catch(e){}
/* The itinerary must not block indefinitely on a weak mobile connection.
   Cache Storage is preferred when available; a cache miss gets up to 3 seconds
   of network time before another cache lookup and a clear error. */
const DATA_TIMEOUT_MS=3000;
async function readTripJSON(path){
  const url=new URL(path,location.href).href;
  async function cached(){
    if(!('caches' in window))return null;
    try{
      const response=await caches.match(url);
      if(response&&response.ok)return await response.json();
    }catch(err){console.warn('Cached trip JSON unreadable',path,err)}
    return null;
  }
  const stored=await cached();
  if(stored!==null)return stored;
  const controller=new AbortController();
  const timer=setTimeout(function(){controller.abort()},DATA_TIMEOUT_MS);
  try{
    const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw Error(path+' HTTP '+response.status);
    return await response.json();
  }catch(err){
    const fallback=await cached();
    if(fallback!==null)return fallback;
    throw err;
  }finally{
    clearTimeout(timer);
  }
}

try{
  // Both translations request their cached data at the same time. On a cold
  // load, the slowest network path is bounded by the same 3-second deadline.
  const englishData=readTripJSON('./trip-en.json').catch(function(err){
    console.warn('English data unavailable',err);return null;
  });
  D=await readTripJSON('./trip.json');
  if(!D||!Array.isArray(D.days)||!Array.isArray(D.events))throw Error('Invalid trip data');
  EN=await englishData;
  if(lang==='en'&&!EN)lang='zh';
}catch(err){
  var heading=document.getElementById('todayLabel');
  var hint=document.getElementById('todayDesc');
  if(heading)heading.textContent='行程資料無法載入';
  if(hint)hint.textContent='請先連網重新整理，確認離線資料已下載。';
  console.error('Trip data unavailable',err);
  return;
}
/* Language preference is retained on this browser. */
var KEY='winter-notes-2026-v1', navs=[{id:'itinerary',name:'行程',icon:'◷'},{id:'travel',name:'交通',icon:'↗'},{id:'ready',name:'待辦',icon:'✓'},{id:'more',name:'筆記',icon:'≡'}];
var state={checked:{},expenses:[],rates:{EUR:35,CZK:1.4},usdRates:{EUR:null,CZK:null}};try{var saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'){state.checked=saved.checked||{};state.expenses=Array.isArray(saved.expenses)?saved.expenses:[];if(saved.rates&&typeof saved.rates==='object'){['EUR','CZK'].forEach(function(k){var v=saved.rates[k];state.rates[k]=v!==null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null})}if(saved.usdRates&&typeof saved.usdRates==='object'){['EUR','CZK'].forEach(function(k){var r=saved.usdRates[k];state.usdRates[k]=r!==null&&r!==''&&Number.isFinite(Number(r))&&Number(r)>0?Number(r):null})}}}catch(e){}
var dayIndex=pickToday(),screen='itinerary',toastTimer;
function $(id){return document.getElementById(id)}
function E(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function dateOf(v){return new Date(v+'T12:00:00')}
function md(v){return Number(v.slice(5,7))+'/'+Number(v.slice(8,10))}
function fmt(v){return v.slice(5,7)+'/'+v.slice(8,10)}
function pickToday(){var n=new Date(),today=n.getFullYear()+'-'+('0'+(n.getMonth()+1)).slice(-2)+'-'+('0'+n.getDate()).slice(-2);for(var i=0;i<D.days.length;i++)if(D.days[i].date>=today)return i;return D.days.length-1}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){notify('儲存失敗：瀏覽器可能限制本機儲存')}}
function notify(v){$('toast').textContent=v;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').classList.remove('show')},2600)}
function mapurl(q){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q)}
function navMarkup(){return navs.map(function(n){return '<button type="button" class="navitem" data-nav="'+n.id+'" aria-current="'+(n.id===screen?'page':'false')+'"><i aria-hidden="true">'+n.icon+'</i><span>'+n.name+'</span></button>'}).join('')}
function updateNav(){document.body.classList.toggle('page-sub',screen!=='itinerary');var html=navMarkup();$('desktopnav').innerHTML=html;$('bottomnav').innerHTML=html;document.querySelectorAll('.section').forEach(function(s){s.classList.toggle('active',s.id==='s-'+screen)})}
function showScreen(to,doHash){screen=to;updateNav();if(to==='ready')renderTasks();if(to==='more')renderExpenses();if(to==='itinerary')renderDay();if(doHash!==false)history.replaceState(null,'',to==='itinerary'?'#day='+D.days[dayIndex].date:'#'+to);window.scrollTo({top:0,behavior:'auto'})}
function statusClass(v){return v==='paid'||v==='confirmed'||v==='reserved'?'ok':v==='pending'?'pending':v==='tentative'?'uncertain':''}
function dayButtons(){return D.days.map(function(d,i){return '<button type="button" class="daybtn" role="tab" aria-selected="'+(i===dayIndex)+'" data-day="'+i+'"><small>NOV · '+d.weekday+'</small><b>'+d.date.slice(-2)+'</b><small>'+({Munich:'慕尼黑',Prague:'布拉格','Český Krumlov':'CK 小鎮','San Francisco':'SFO'}[d.city]||d.city)+'</small><span class="daywx" data-weather-day="'+i+'">—</span></button>'}).join('')}
/* Only purposeful destinations receive a map link; skip flights, immigration, baggage, in-transit steps and unconfirmed meeting points. */
var mapEventIds=new Set(["d1-airport","d2-hotel","d3-frauen","d3-stpeter","d3-lunch","d3-kustermann","d3-residenz","d3-max","d3-market","d4-tour","d4-hohen","d4-neusch","d4-alpsee","d4-bridge","d5-platform","d5-grand","d5-celetna","d6-meet","d5-bridge","d5-miru","d6-castle","d6-starbucks","d6-strahov","d6-mala","d6-river","d6-petrin","d6-entry","d7-square","d7-josefov","d7-klementinum","d7-na-prikope","d7-palladium","d7-manuf","d7-powder","d7-republiky","d7-move","d8-castle","d8-lunch","d8-oldtown"]);
function shouldShowMap(e){return !!(e.place&&mapEventIds.has(e.id))}
function showMore(e){var body='';if(e.desc)body+='<p>'+E(e.desc)+'</p>';if(e.trans)body+='<p><b>交通：</b>'+E(e.trans)+'</p>';if(e.sub.length)body+='<ul class="subs subitems">'+e.sub.map(function(s){return '<li>'+E(s)+'</li>'}).join('')+'</ul>';if(e.weather)body+='<p><b>天氣備案：</b>'+E(e.weather)+'</p>';if(e.warn)body+='<p class="notice">'+E(e.warn)+'</p>';if(e.infoLinks&&e.infoLinks.length)body+='<div class="actionrow">'+e.infoLinks.map(function(l){return '<a class="action" href="'+E(l.url)+'" target="_blank" rel="noopener noreferrer">'+E(l.label)+' ↗</a>'}).join('')+'</div>';
if(e.loungeLinks&&e.loungeLinks.length)body+='<div class="actionrow">'+e.loungeLinks.map(function(l){return '<a class="action primary" href="'+E(l.url)+'" target="_blank" rel="noopener noreferrer">'+E((typeof L==='function'?L(l.label,l.en||l.label):l.label))+' · Priority Pass ↗</a>'}).join('')+'</div>';
if(shouldShowMap(e))body+='<div class="actionrow"><a class="action primary" target="_blank" rel="noopener noreferrer" href="'+mapurl(e.place)+'">Google Maps 導航 ↗</a></div>';return body}



/* Actual geographic maps over OpenStreetMap tiles; pins use stored approximate coordinates.
   No Google Maps, no collapse, no bulk prefetching. */
function routeLocation(key){
 var hotel=key.indexOf('hotel:')===0;
 var via=key.indexOf('via:')===0;
 var p=hotel?D.hotels.find(function(h){return h.id===key.slice(6)}):
   via?(D.waypoints||[]).find(function(w){return w.id===key.slice(4)}):
   D.events.find(function(e){return e.id===key});
 if(!p||!p.geo)return null;
 var en=typeof lang!=='undefined'&&lang==='en'&&typeof EN!=='undefined'&&EN;
 var title=hotel?p.name:via?(en?p.enTitle:p.title):
   p.geoLabel?(en?p.geoLabelEn:p.geoLabel):
   en&&EN.events[p.id]?EN.events[p.id].title:p.routeLabel||p.title;
 return {label:title,lat:Number(p.geo[0]),lon:Number(p.geo[1])};
}
function isEnglishMap(){return typeof lang!=='undefined'&&lang==='en'}
function renderDayRoutes(day){
 if(!day.route)return '';
 var icon={walking:'🚶',transit:'🚇',driving:'🚘',train:'🚆',bus:'🚌',flight:'✈'};
 var blocks=day.route.groups.map(function(g,i){
  var pts=g.stops.map(routeLocation).filter(Boolean);if(!pts.length)return '';
  var translated=isEnglishMap()&&typeof EN!=='undefined'&&EN&&EN.days[day.date];
  var name=translated&&translated.routeGroups[i]||g.title;
  return '<article class="geo-group"><div class="geo-heading"><span>'+icon[g.mode]+'</span><strong>'+E(name)+'</strong></div>'+
    '<div class="geo-map" data-mode="'+g.mode+'" data-geogroup="'+i+'" role="img" aria-label="'+E(name)+'">'+
    '<div class="geo-tiles" aria-hidden="true"></div><svg class="geo-lines" aria-hidden="true"></svg>'+
    '<div class="geo-pins" aria-hidden="true"></div><div class="geo-credit">© <a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></div></div>'+
    '<div class="geo-legend">'+pts.map(function(p,n){return '<span><b>'+(n+1)+'</b>'+E(p.label)+'</span>'}).join('')+'</div>'+
    (g.note?'<p class="geo-group-note">'+E(isEnglishMap()?(g.enNote||g.note):g.note)+'</p>':'')+'</article>';
 }).filter(Boolean);
 if(!blocks.length)return '';
 var en=isEnglishMap()&&typeof EN!=='undefined'&&EN&&EN.days[day.date];
 return '<section class="day-route" aria-label="'+(isEnglishMap()?'Geographic route map':'整日地理位置圖')+'">'+
 '<div class="route-overview-heading"><span class="route-symbol" aria-hidden="true">⌖</span><div><h3>'+(isEnglishMap()?'Daily geographic map':'整日路線 · 地理位置圖')+'</h3>'+
 '<p>'+(isEnglishMap()?'Real geographic positions · straight lines are not street directions':'實際地理位置 · 連線代表順序，並非街道導航')+'</p></div></div>'+
 '<div class="geo-grid">'+blocks.join('')+'</div><p class="route-note">'+E(en?en.routeNote:day.route.note||'')+'</p></section>';
}
function mapPixel(lat,lon,z){
 var n=256*Math.pow(2,z),r=Math.max(-85.05,Math.min(85.05,lat))*Math.PI/180;
 return {x:(lon+180)/360*n,y:(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n};
}
/* Interpolate the shorter great-circle arc over a sphere, not a straight
   Mercator line. Intended only as a geographic illustration, not radar tracking. */
function flightArc(a,b,steps){
 var deg=Math.PI/180;
 function v(p){var lat=p.lat*deg,lon=p.lon*deg,c=Math.cos(lat);return [c*Math.cos(lon),c*Math.sin(lon),Math.sin(lat)]}
 var u=v(a),w=v(b),dot=Math.max(-1,Math.min(1,u[0]*w[0]+u[1]*w[1]+u[2]*w[2]));
 var angle=Math.acos(dot),sin=Math.sin(angle),out=[];
 if(angle<0.0000001)return [a,b];
 for(var k=0;k<=steps;k++){
  var t=k/steps,m1=Math.sin((1-t)*angle)/sin,m2=Math.sin(t*angle)/sin;
  var x=u[0]*m1+w[0]*m2,y=u[1]*m1+w[1]*m2,z=u[2]*m1+w[2]*m2;
  out.push({lat:Math.atan2(z,Math.hypot(x,y))/deg,lon:Math.atan2(y,x)/deg});
 }
 return out;
}
function geoGeometry(pts,mode){
 if(mode!=='flight')return {path:pts,markers:pts.map((p,i)=>i),legs:[]};
 var path=[],markers=[],legs=[];
 if(!pts.length)return {path,markers,legs};
 path.push(pts[0]);markers.push(0);
 for(var i=1;i<pts.length;i++){
  var prev=pts[i-1],next=pts[i];
  if(Math.hypot(prev.lat-next.lat,prev.lon-next.lon)<0.00001){markers.push(path.length-1);continue}
  var start=path.length-1,arc=flightArc(prev,next,64);
  for(var j=1;j<arc.length;j++)path.push(arc[j]);
  legs.push({start:start,end:path.length-1});
  markers.push(path.length-1);
 }
 return {path,markers,legs};
}
function projectedContinuous(path,zoom){
 var wrap=256*Math.pow(2,zoom),last=null;
 return path.map(function(p){
  var q=mapPixel(p.lat,p.lon,zoom);
  if(last!==null){
   while(q.x-last>wrap/2)q.x-=wrap;
   while(q.x-last< -wrap/2)q.x+=wrap;
  }
  last=q.x;return q;
 });
}
function geoFrame(pts,mode,width,height){
 var geometry=geoGeometry(pts,mode),padding=mode==='flight'?36:48;
 var zoom=0,transformed=null;
 var maxZoom=mode==='flight'?7:16;
 for(var z=maxZoom;z>=0;z--){
  var projected=projectedContinuous(geometry.path,z),xs=projected.map(p=>p.x),ys=projected.map(p=>p.y);
  if(Math.max(...xs)-Math.min(...xs)<=width-padding*2 && Math.max(...ys)-Math.min(...ys)<=height-padding*2){
   zoom=z;transformed=projected;break;
  }
 }
 if(!transformed)transformed=projectedContinuous(geometry.path,zoom);
 if(pts.length===1){zoom=13;transformed=projectedContinuous(geometry.path,zoom)}
 var xs=transformed.map(p=>p.x),ys=transformed.map(p=>p.y);
 var cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
 return {zoom:zoom,cx:cx,cy:cy,path:transformed.map(p=>({x:p.x-cx+width/2,y:p.y-cy+height/2})),
  markerPositions:geometry.markers.map(i=>({x:transformed[i].x-cx+width/2,y:transformed[i].y-cy+height/2})),
  legs:geometry.legs};
}
function drawGeoGroup(el,stops,mode){
 if(!el.clientWidth)return;
 var pts=stops.map(routeLocation).filter(Boolean);if(!pts.length)return;
 var width=el.clientWidth,height=el.clientHeight||260,frame=geoFrame(pts,mode,width,height),z=frame.zoom,cx=frame.cx,cy=frame.cy;
 var nTiles=Math.pow(2,z),tiles=[],left=Math.floor((cx-width/2)/256),right=Math.floor((cx+width/2)/256),top=Math.floor((cy-height/2)/256),bottom=Math.floor((cy+height/2)/256);
 for(var tx=left;tx<=right;tx++)for(var ty=top;ty<=bottom;ty++){
  if(ty<0||ty>=nTiles)continue;
  tiles.push('<img loading="lazy" decoding="async" referrerpolicy="strict-origin-when-cross-origin" alt="" width="256" height="256" style="left:'+Math.round(tx*256-cx+width/2)+'px;top:'+Math.round(ty*256-cy+height/2)+'px" src="https://tile.openstreetmap.org/'+z+'/'+((tx%nTiles+nTiles)%nTiles)+'/'+ty+'.png">');
 }
 el.querySelector('.geo-tiles').innerHTML=tiles.join('');
 var coords=frame.markerPositions,svg=el.querySelector('.geo-lines');
 svg.setAttribute('viewBox','0 0 '+width+' '+height);
 if(mode==='flight'){
  svg.innerHTML=frame.legs.map(function(leg){
   var section=frame.path.slice(leg.start,leg.end+1),
    poly=section.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '),
    middle=section[Math.floor(section.length/2)];
   return '<polyline points="'+poly+'" fill="none" stroke="#247fa1" stroke-width="3.3" stroke-dasharray="9 5" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<text x="'+middle.x.toFixed(1)+'" y="'+(middle.y-9).toFixed(1)+'" text-anchor="middle" font-size="19" fill="#176c8a" stroke="#fff" stroke-width="2" paint-order="stroke">✈</text>';
  }).join('');
 }else{
  svg.innerHTML=coords.length>1?'<polyline points="'+coords.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ')+'" fill="none" stroke="#b35b37" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round" stroke-linejoin="round"/>':'';
 }
 el.querySelector('.geo-pins').innerHTML=coords.map(function(v,i){
   var dup=coords.slice(0,i).filter(q=>Math.hypot(v.x-q.x,v.y-q.y)<10).length;
   return '<span class="geo-pin" title="'+E(pts[i].label)+'" style="left:'+(v.x+dup*13).toFixed(1)+'px;top:'+(v.y+dup*10).toFixed(1)+'px">'+(i+1)+'</span>';
 }).join('');
}
function drawDayGeoMaps(){
 var day=D.days[dayIndex];if(!day||!day.route)return;
 document.querySelectorAll('#daycontent [data-geogroup]').forEach(function(node){
  var g=day.route.groups[Number(node.dataset.geogroup)];
  if(g)drawGeoGroup(node,g.stops,g.mode);
 });
}
window.addEventListener('resize',function(){if(document.getElementById('s-itinerary').classList.contains('active'))drawDayGeoMaps()});
function photoForEvent(e){
  if(!e.photo)return '';
  var p=e.photo;
  var credit='照片：'+p.author+' · '+p.license;
  return '<figure class="place-figure"><img class="place-photo" src="'+E(p.src)+'" alt="'+E(p.alt)+'" loading="lazy" decoding="async" width="960" height="620">'+
    '<figcaption><a href="'+E(p.source)+'" target="_blank" rel="noopener noreferrer" title="查看照片作者與授權">'+E(credit)+' ↗</a></figcaption></figure>';
}
document.addEventListener('error',function(ev){
  var target=ev.target;
  if(target&&target.matches&&target.matches('img.place-photo'))target.closest('.place-figure').classList.add('photo-unavailable');
},true);

function renderHotelTonight(date){var h=D.hotels.find(function(h){return date>=h.checkin&&date<h.checkout});if(!h)return '';return '<aside class="stay-tonight"><div><div class="stay-kicker">今晚住宿 · Tonight’s hotel</div><strong>'+E(h.name)+'</strong></div><a class="action" target="_blank" rel="noopener noreferrer" href="'+mapurl(h.address)+'">導航至飯店 ↗</a></aside>'}
function renderDay(){var d=D.days[dayIndex];$('daystrip').innerHTML=dayButtons();var selected=$('daystrip').querySelector('[aria-selected=true]');if(selected)selected.scrollIntoView({inline:'center',block:'nearest'});var events=D.events.filter(function(x){return x.date===d.date});var cards=events.map(function(e){var body=showMore(e);return '<div class="event" data-category="'+E(e.cat)+'"><div class="event-time">'+E(e.time)+'</div><article class="event-card"><div class="event-category"><span class="minilabel">'+E(e.cat)+'</span><span class="status '+statusClass(e.state)+'">'+E(e.status)+'</span></div><div class="event-title">'+E(e.title)+'</div>'+photoForEvent(e)+(body?'<details><summary>'+(shouldShowMap(e)?'詳細資訊／地圖':'詳細資訊')+'</summary>'+body+'</details>':'')+'</article></div>'}).join('');$('daycontent').innerHTML='<header class="day-intro" data-city="'+E(d.city)+'"><div class="day-overline"><span>CHAPTER '+String(dayIndex+1).padStart(2,'0')+' / 09</span><span>2026.11.'+d.date.slice(-2)+' · 星期'+E(d.weekday)+'</span></div><div class="day-summary"><h2>'+E(d.title)+'</h2><span class="citypill">'+E(({Munich:'慕尼黑',Prague:'布拉格','Český Krumlov':'CK 小鎮','San Francisco':'舊金山'}[d.city]||d.city))+'</span></div><div class="highlight">'+E(d.highlight)+'</div></header>'+renderHotelTonight(d.date)+renderDayRoutes(d)+'<div id="weatherSlot" aria-live="polite"></div><div class="timeline">'+cards+'</div>';var date=$('daystrip').querySelector('[aria-selected=true]');if(date)date.scrollIntoView({behavior:'auto',inline:'center',block:'nearest'});refreshWeatherUI();requestAnimationFrame(drawDayGeoMaps)}

/* Weather data: Open-Meteo non-commercial forecast; live current conditions only for the selected local date */
var WEATHER_CACHE='winter-notes-forecast-2026-v2';
var weatherPlaces={
sfo:{name:'舊金山機場 SFO',lat:37.6213,lon:-122.3790,zone:'America/Los_Angeles'},
munich:{name:'慕尼黑 Munich',lat:48.1374,lon:11.5755,zone:'Europe/Berlin'},
schwangau:{name:'天鵝堡區 Schwangau',lat:47.5562,lon:10.7498,zone:'Europe/Berlin'},
prague:{name:'布拉格 Prague',lat:50.0755,lon:14.4378,zone:'Europe/Prague'},
krumlov:{name:'庫倫洛夫 Český Krumlov',lat:48.8127,lon:14.3175,zone:'Europe/Prague'}
};
var weatherDays={
'2026-11-19':'sfo','2026-11-20':'munich','2026-11-21':'munich',
'2026-11-22':'schwangau','2026-11-23':'prague',
'2026-11-24':'prague','2026-11-25':'prague',
'2026-11-26':'krumlov','2026-11-27':'prague'
};
var weatherStore={},weatherErrors={},weatherLoading=false,weatherLastRequest=0;
try{var oldWeather=JSON.parse(localStorage.getItem(WEATHER_CACHE)||'{}');if(oldWeather&&typeof oldWeather==='object')weatherStore=oldWeather}catch(e){}
function localDateFor(zone){
var pieces=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
var p={};pieces.forEach(function(x){p[x.type]=x.value});return p.year+'-'+p.month+'-'+p.day
}
function weatherLabel(code){
if(code===0)return {icon:'☀️',name:'晴朗'};
if(code===1||code===2)return {icon:'🌤️',name:'晴時多雲'};
if(code===3)return {icon:'☁️',name:'陰天'};
if(code===45||code===48)return {icon:'🌫️',name:'有霧'};
if([51,53,55,56,57].includes(code))return {icon:'🌦️',name:'毛毛雨'};
if([61,63,65,66,67,80,81,82].includes(code))return {icon:'🌧️',name:'有雨'};
if([71,73,75,77,85,86].includes(code))return {icon:'❄️',name:'有雪'};
if([95,96,99].includes(code))return {icon:'⛈️',name:'雷雨'};
return {icon:'🌡️',name:'天氣變化'}
}
function forecastFor(day){
var key=weatherDays[day.date],saved=weatherStore[key],daily=saved&&saved.data&&saved.data.daily;
if(!daily||!Array.isArray(daily.time))return null;
var i=daily.time.indexOf(day.date);if(i<0)return null;
var hi=daily.temperature_2m_max&&daily.temperature_2m_max[i],lo=daily.temperature_2m_min&&daily.temperature_2m_min[i];
if(hi===null||lo===null||!Number.isFinite(Number(hi))||!Number.isFinite(Number(lo)))return null;
function num(v){return v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v)}
return {hi:Number(hi),lo:Number(lo),rain:num(daily.precipitation_probability_max&&daily.precipitation_probability_max[i]),wind:num(daily.wind_speed_10m_max&&daily.wind_speed_10m_max[i]),code:num(daily.weather_code&&daily.weather_code[i]),current:saved.data.current||null,updated:saved.updated}
}
function clothingGuide(day,forecast,nowData){
if(!forecast)return '一般冬季準備：保暖外套、長袖中層、長褲、防水防滑的鞋；實際厚度請在預報開放後再確認。';
var low=Math.min(forecast.lo,forecast.hi),high=Math.max(forecast.lo,forecast.hi);
var apparent=nowData&&nowData.apparent_temperature;
if(apparent!=null&&Number.isFinite(Number(apparent)))low=Math.min(low,Number(apparent));
var lead;
if(low<=-3||high<=2)lead='寒冷：發熱保暖內搭＋毛衣或刷毛中層＋厚羽絨／保暖防風外套；穿厚襪、手套、圍巾與帽子。';
else if(low<=3||high<=7)lead='偏冷：保暖內搭＋毛衣或刷毛中層＋羽絨或厚冬外套；建議帶手套與圍巾。';
else if(low<=8||high<=12)lead='涼冷：長袖上衣＋薄毛衣或刷毛中層＋防風保暖外套；怕冷可加薄保暖內搭。';
else lead='氣溫較溫和：長袖上衣＋可穿脫的保暖外套，早晚另外加一層。';
var extra=[];
if([71,73,75,77,85,86].includes(forecast.code))extra.push('有降雪訊號：穿防水、防滑鞋，留意結冰路面');
else if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(forecast.code)||(forecast.rain!=null&&forecast.rain>=50))extra.push('帶防水外層或雨傘，鞋子以防水為佳');
if(forecast.wind!=null&&forecast.wind>=30)extra.push('風較大：加強防風並遮住頸部');
if(extra.length)lead+=' '+extra.join('；')+'。';
return lead
}
function dayClothingNote(day){
if(day.date==='2026-11-19')return '晚上搭長途班機，隨身包可放薄外套；到慕尼黑再換冬季外套。';
if(day.date==='2026-11-20')return '17:55 才抵達慕尼黑，晚間搭 S8 與步行時請以接近低溫的穿法準備。';
if(day.date==='2026-11-22')return '城堡位於山區，可能比慕尼黑市區更冷；四人都建議穿保暖分層與止滑鞋。';
if(day.date==='2026-11-23')return '此卡顯示抵達後的布拉格天氣；05:40 慕尼黑清晨接送也請準備保暖手套與厚外套。';
if(day.date==='2026-11-24')return '城堡與佩特任山戶外時間較長，孩子可多帶一件好穿脫的保暖中層。';
if(day.date==='2026-11-26')return '庫倫洛夫老城石板路、河畔容易濕滑；防水止滑鞋與手套優先。';
if(day.date==='2026-11-27')return '06:30 飯店出發送機；清晨可能接近當日低溫，外套不要先放入托運行李。';
return '兩位孩子也建議採分層穿法，進入室內後可方便脫下外套。'
}
function weatherMeta(key,updated){
var place=weatherPlaces[key],out=[];
if(updated){out.push('預報取得：'+new Date(updated).toLocaleString('zh-TW',{timeZone:place.zone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+'（當地）')}
if(weatherErrors[key])out.push('目前連線更新失敗，顯示上次取得資料');
else if(updated&&Date.now()-updated>2*3600000)out.push('快取資料，請點更新');
return out.join(' · ')
}
function weatherCard(){
var node=$('weatherSlot');if(!node)return;
var day=D.days[dayIndex],key=weatherDays[day.date],place=weatherPlaces[key],result=forecastFor(day);
var top='<div class="wx-head"><div><div class="wx-caption">Daily weather · 每日天氣</div><h3 class="wx-place">'+E(place.name)+'</h3></div><button class="wx-refresh" type="button" data-weather-refresh="1" '+(weatherLoading?'disabled':'')+'>'+(weatherLoading?'更新中…':'↻ 更新天氣')+'</button></div>';
var credit='<div class="wx-meta"><span>'+(result?E(weatherMeta(key,result.updated)):'天氣資料需網路更新；無可用預報時只顯示一般穿衣提醒')+'</span><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather by Open-Meteo ↗</a></div>';
var note='<p class="wx-specific">'+E(dayClothingNote(day))+'</p>';
var main='';
if(!result){
var localDay=localDateFor(place.zone),msg=day.date<localDay?'這個日期已過，網站未保存歷史實況。':weatherLoading?'正在取得當地最新預報…':weatherErrors[key]?'目前無法連上氣象服務，請稍後點選「更新天氣」。':'目前尚無這一天的可用預報，請在日期接近時再查看。';
main='<p class="wx-message">'+E(msg)+'</p><div class="wx-wear"><div class="wx-wear-label">🧥 穿衣建議（一般冬季準備）</div><p>'+E(clothingGuide(day,null,null))+'</p>'+note+'</div>';
}else{
var desc=weatherLabel(result.code),hi=Math.round(result.hi),lo=Math.round(result.lo);
var isCurrent=day.date===localDateFor(place.zone),nowFresh=Date.now()-result.updated<60*60000&&!weatherErrors[key],nowData=isCurrent&&nowFresh?result.current:null;
var nowTemp=nowData&&nowData.temperature_2m!=null&&Number.isFinite(Number(nowData.temperature_2m))?Math.round(Number(nowData.temperature_2m)):null;
var apparent=nowData&&nowData.apparent_temperature!=null&&Number.isFinite(Number(nowData.apparent_temperature))?Math.round(Number(nowData.apparent_temperature)):null;
var rainTxt=result.rain===null?'降雨機率暫缺':('最高降雨機率 '+Math.round(result.rain)+'%');
var windTxt=result.wind===null?'風速暫缺':('最大風速 '+Math.round(result.wind)+' km/h');
main='<div class="wx-main"><span class="wx-symbol" aria-hidden="true">'+desc.icon+'</span><div><div class="wx-temperature">'+lo+'° — '+hi+'° <small>C</small></div><p class="wx-condition">'+E(desc.name)+' · '+E(rainTxt)+' · '+E(windTxt)+'</p>'+(nowTemp===null?'':'<p class="wx-current">目前 '+nowTemp+'°C'+(apparent===null?'':' · 體感 '+apparent+'°C')+'（當地即時觀測／模型資料）</p>')+'</div></div>';
main+='<div class="wx-wear"><div class="wx-wear-label">🧥 今天怎麼穿</div><p>'+E(clothingGuide(day,result,nowData))+'</p>'+note+'</div>';
if(day.date>localDateFor(place.zone))main+='<p class="wx-note">這是未來日期的預報，不是當日即時觀測；接近出發日再確認一次。</p>';
}
node.innerHTML='<section class="wx-panel" aria-label="當日天氣及穿衣建議">'+top+main+credit+'</section>'
}
function updateWeatherPills(){
var buttons=$('daystrip');if(!buttons)return;
buttons.querySelectorAll('[data-weather-day]').forEach(function(el){
var d=D.days[Number(el.dataset.weatherDay)],fc=forecastFor(d);
if(fc){var info=weatherLabel(fc.code);el.textContent=info.icon+' '+Math.round(fc.hi)+'°'}
else el.textContent='—'
})
}
function refreshWeatherUI(){weatherCard();updateWeatherPills()}
/* Forecasts share the three-second deadline; prior weather data is retained. */
async function fetchWeatherJSON(url){
  const controller=new AbortController();
  const timer=setTimeout(function(){controller.abort()},DATA_TIMEOUT_MS);
  try{
    const resp=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!resp.ok)throw Error('HTTP '+resp.status);
    return await resp.json();
  }finally{
    clearTimeout(timer);
  }
}
function loadWeatherAll(force){
if(weatherLoading)return;
if(!force&&weatherLastRequest&&Date.now()-weatherLastRequest<30*60000)return;
weatherLoading=true;weatherLastRequest=Date.now();refreshWeatherUI();
var entries=Object.keys(weatherPlaces);
Promise.all(entries.map(function(key){
var w=weatherPlaces[key];
var qs=new URLSearchParams({
latitude:String(w.lat),longitude:String(w.lon),timezone:w.zone,
forecast_days:'16',
current:'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
temperature_unit:'celsius',wind_speed_unit:'kmh'
});
return fetchWeatherJSON('https://api.open-meteo.com/v1/forecast?'+qs.toString())
.then(function(json){if(json.error||!json.daily||!Array.isArray(json.daily.time))throw Error('Invalid weather response');weatherStore[key]={data:json,updated:Date.now()};delete weatherErrors[key]})
.catch(function(err){weatherErrors[key]=true})
})).then(function(){
try{localStorage.setItem(WEATHER_CACHE,JSON.stringify(weatherStore))}catch(e){}
weatherLoading=false;refreshWeatherUI()
}).catch(function(){weatherLoading=false;refreshWeatherUI()})
}
document.addEventListener('click',function(ev){if(ev.target.closest('[data-weather-refresh]')){loadWeatherAll(true)}});
document.addEventListener('visibilitychange',function(){if(!document.hidden)loadWeatherAll(false)});
window.addEventListener('online',function(){loadWeatherAll(true)});
setInterval(function(){if(!document.hidden)loadWeatherAll(false)},30*60000);

function statBox(id,label,body){return '<div class="block"><div class="tinycaps">'+label+'</div><h3 style="margin:6px 0 10px">'+id+'</h3>'+body+'</div>'}
function renderRides(){var ids=['d1-airport','d5-black','d9-black','d9-uber'];$('rideCards').innerHTML=ids.map(function(id){var e=D.events.find(function(v){return v.id===id});if(!e)return '';var tz=e.date==='2026-11-19'||e.id==='d9-uber'?'美西當地時間':'歐洲當地時間';return statBox(E(e.title),E(fmt(e.date))+' · '+E(e.time),'<p class="ride-line">'+E(e.originLabel)+' → '+E(e.destinationLabel)+'</p><div class="kv"><span>接送時間</span><span>'+E(e.time)+' · '+tz+'</span></div><div class="kv"><span>預訂</span><span>'+E(e.status)+'</span></div>'+(e.warn?'<p class="ride-warn">'+E(e.warn)+'</p>':''))}).join('')}
function renderTravel(){renderRides();var fs=D.flights.map(function(f){return statBox(E(f.flight),E(fmt(f.date))+' · '+E(f.carrier),'<div class="kv"><span>航線</span><span>'+E(f.from)+' → '+E(f.to)+'</span></div><div class="kv"><span>起飛</span><span>'+E(f.departure.replace('T',' '))+'</span></div><div class="kv"><span>抵達</span><span>'+E(f.arrival.replace('T',' '))+'</span></div>')}).join('');$('transportcards').innerHTML=fs;var hs=D.hotels.map(function(h){return statBox(E(h.name),E(h.city)+' · '+E(h.nights)+' 晚','<div class="kv"><span>住宿日期</span><span>'+E(fmt(h.checkin))+' → '+E(fmt(h.checkout))+'</span></div><div class="actionrow"><a class="action primary" target="_blank" rel="noopener noreferrer" href="'+mapurl(h.address)+'">導航至飯店 ↗</a></div>')}).join('');$('hotelcards').innerHTML=hs}
function taskDerived(x){if(!x.activityIds)return null;var es=x.activityIds.map(function(id){return D.events.find(function(e){return e.id===id})});var ok=es.every(function(e){return e&&(x.requireTicket?['paid','confirmed'].includes(e.state):['paid','confirmed','reserved'].includes(e.state))});return {done:ok,label:ok?'行程已確認':'依行程尚待處理'}}
function isChecked(x){var a=taskDerived(x);return a?a.done:Object.prototype.hasOwnProperty.call(state.checked,x.id)?!!state.checked[x.id]:!!x.done}
function renderTasks(){var all=D.todos.concat(D.packing),n=all.filter(isChecked).length,pct=Math.round(100*n/all.length);$('taskCount').textContent='已完成 '+n+' / '+all.length+' 項 · 訂票狀態從行程自動更新，其餘在此裝置儲存';$('taskFill').style.width=pct+'%';var groups=[['行前待辦',D.todos],['行李打包',D.packing]];$('tasks').innerHTML=groups.map(function(g){return '<h3 class="task-group">'+g[0]+'</h3><div class="block" style="padding:4px 14px">'+g[1].map(function(x){var derived=taskDerived(x),done=isChecked(x);return '<label class="task '+(derived?'task-derived':'')+'"><input type="checkbox" '+(derived?'disabled title="依行程狀態自動更新"':'data-check="'+E(x.id)+'"')+' '+(done?'checked':'')+'><span>'+E(x.text)+'</span>'+(derived?'<small class="'+(done?'':'pending')+'">'+E(derived.label)+'</small>':'')+'</label>'}).join('')+'</div>'}).join('')}
function renderShopping(){$('shopping').innerHTML=D.shopping.map(function(s){return '<div class="shop"><strong>'+E(s.name)+'</strong><small>'+E(s.city)+'</small><p>'+E(s.tip)+'</p><a target="_blank" rel="noopener noreferrer" href="'+mapurl(s.address)+'">地圖導航 ↗</a>'+(s.website?'　<a target="_blank" rel="noopener noreferrer" href="'+E(s.website)+'">官方資訊 ↗</a>':'')+'</div>'}).join('')}
function usdRate(currency){var r=state.usdRates[currency];return typeof r==='number'&&Number.isFinite(r)&&r>0?r:null}
function L(zh,en){return lang==='en'?en:zh}
function formatUSD(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}
function initializeRates(){['EUR','CZK'].forEach(function(k){var input=$('rate'+k);if(input)input.value=usdRate(k)===null?'':String(usdRate(k))})}
function renderExpenses(){var totals={};state.expenses.forEach(function(x){var v=Number(x.amount);if(Number.isFinite(v)&&v>=0)totals[x.currency]=(totals[x.currency]||0)+v});
var keys=Object.keys(totals),usd=0,converted=0,notConverted=[];
var rows=keys.map(function(k){var rate=k==='USD'?1:usdRate(k),v=totals[k],canConvert=rate!==null;
if(canConvert){usd+=v*rate;converted++}else notConverted.push(k);
return '<div class="fx-summary-row"><strong>'+E(k)+' '+v.toFixed(2)+'</strong><span class="fx-converted">'+(canConvert?'≈ '+E(formatUSD(v*rate)):L('尚未設定匯率','Exchange rate not set'))+'</span></div>'}).join('');
var html='<div class="tinycaps">'+L('依幣別統計與美元估值','Currency totals & USD estimates')+'</div>'+rows;
if(converted)html+='<div class="fx-grand"><span>'+L('約合美元合計','Estimated total in USD')+'</span><strong>'+E(formatUSD(usd))+'</strong></div>';
if(notConverted.length)html+='<p class="fx-note">'+L('以下幣別尚未納入美元合計：','Not included in USD total: ')+E(notConverted.join(', '))+' · '+L('請設定匯率後再查看完整估值。','Enter exchange rates for a full estimate.')+'</p>';
$('expenseTotals').innerHTML=keys.length?html:'<div class="empty">'+L('目前沒有支出紀錄','No expenses yet')+'</div>';
$('expenseRows').innerHTML=state.expenses.length?state.expenses.slice().reverse().map(function(x){return '<div class="expense-row"><div><strong>'+E(x.name)+'</strong><small>'+E(x.date)+'</small></div><div class="right"><b>'+E(x.currency)+' '+Number(x.amount).toFixed(2)+'</b><button class="delete" aria-label="'+L('刪除這筆支出','Delete expense')+'" type="button" data-del="'+E(x.id)+'">✕</button></div></div>'}).join(''):'';
}
function addExpense(form){var fd=new FormData(form),name=String(fd.get('name')||'').trim(),amount=Number(fd.get('amount')),currency=String(fd.get('currency')||'EUR');if(!name||!Number.isFinite(amount)||amount<=0||!['EUR','CZK','USD'].includes(currency))return;state.expenses.push({id:String(Date.now())+Math.random().toString(36).slice(2,6),name:name.slice(0,70),amount:Math.round(amount*100)/100,currency:currency,date:new Date().toLocaleDateString('zh-TW')});save();form.reset();renderExpenses();notify('已加入支出')}
var nextStopIds=new Set(['d1-airport','d1-flight','d2-arrive','d2-ticket','d2-hotel','d3-frauen','d3-stpeter','d3-tour','d3-residenz','d3-market','d4-tour','d4-hohen','d4-neusch','d5-black','d5-platform','d5-train','d5-grand','d5-celetna','d5-miru','d6-castle','d6-concert','d7-josefov','d7-move','d8-busout','d8-castle','d8-busback','d9-black','d9-airport','d9-lx1485','d9-lx38','d9-uber']);
function nextStart(e){var m=/^(\d\d):(\d\d)/.exec(e.time||'');if(!m)return NaN;var offset=e.date==='2026-11-19'||e.id==='d9-uber'?'-08:00':'+01:00';return Date.parse(e.date+'T'+m[1]+':'+m[2]+':00'+offset)}
function nextLeave(e){if(e.leaveAt)return e.leaveAt;if(e.id==='d3-tour')return '10:30 前抵達';if(e.id==='d5-train')return '05:40 送站';if(e.id==='d9-lx1485')return '06:30 送機';return '依路程安排'}
function renderNextStop(){var all=D.events.filter(function(e){return nextStopIds.has(e.id)&&Number.isFinite(nextStart(e))&&nextStart(e)>=Date.now()-300000}).sort(function(a,b){return nextStart(a)-nextStart(b)}),e=all[0],map=$('nextMap'),view=$('nextView');if(!e){$('nextTitle').textContent='旅程已結束';$('nextDate').textContent='';$('nextTime').textContent='—';$('nextLeave').textContent='—';$('nextHint').textContent='可以回顧每日行程';map.hidden=true;view.hidden=true;return}$('nextTitle').textContent=e.title;$('nextDate').textContent=fmt(e.date)+' · '+(e.date==='2026-11-19'||e.id==='d9-uber'?'美西時間':'歐洲時間');$('nextTime').textContent=e.time;$('nextLeave').textContent=nextLeave(e);$('nextHint').textContent=e.warn||e.status||'以實際預約為準';if(shouldShowMap(e)){map.href=mapurl(e.place);map.hidden=false}else{map.hidden=true;map.removeAttribute('href')}view.hidden=false;view.dataset.nextDay=e.date}

/* Home reminder is driven by the same booking states used by Checklist. */
function renderCriticalAlert(){
  var card=$('criticalSignal'),heading=$('criticalTitle'),detail=$('criticalDesc'),icon=$('criticalIcon');
  if(!card||!heading||!detail||!icon)return;
  var now=Date.now(),begin=Date.parse('2026-11-19T00:00:00-08:00'),end=Date.parse('2026-11-28T00:00:00-08:00');
  var travelling=now>=begin&&now<end;
  card.classList.toggle('signal-done',false);
  if(travelling){
    var date=now<Date.parse('2026-11-20T00:00:00+01:00')?'2026-11-19':new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
    var day=D.days.find(function(x){return x.date===date});
    var special={'2026-11-19':'18:35 Jerry 私人接送至 SFO；21:40 LH459 起飛',
      '2026-11-23':'05:40 Blacklane 送至 München Hbf；06:44 搭 EC353 前往布拉格',
      '2026-11-27':'06:30 布拉格 Blacklane 送機；9:40 SWISS LX1485 起飛'};
    heading.textContent='今日行程重點';
    detail.textContent=special[date]||(day?day.highlight:'請查看下一站卡片與今日行程');
    icon.textContent='↗';
    return;
  }
  var keys=['todos-7','todos-13','todos-12'],pending=keys.map(function(id){return D.todos.find(function(t){return t.id===id})}).filter(function(t){return t&&!isChecked(t)});
  if(!pending.length){
    card.classList.add('signal-done');heading.textContent='行前關鍵項目已確認 ✓';
    detail.textContent='城堡團、CK 巴士與布拉格音樂會的活動狀態已確認。';icon.textContent='✓';
  }else{
    var labels={'todos-7':'雙城堡門票／付款','todos-13':'CK 往返巴士','todos-12':'布拉格音樂會'};
    heading.textContent='行前重要提醒 · '+pending.length+' 項待確認';
    detail.textContent=pending.map(function(t){return labels[t.id]}).join('、')+'；狀態與下方待辦清單同步。';
    icon.textContent='!';
  }
}
function updateHero(){var now=new Date(),t=new Date('2026-11-19T21:40:00-08:00'),days=Math.max(0,Math.round((Date.UTC(2026,10,19)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000));if(now<t){$('todayLabel').textContent=days>0?'距離出發還有 '+days+' 天':'今晚出發！';$('todayDesc').textContent='11/19 21:40 · SFO → MUC · Lufthansa LH459'}else if(now<=new Date('2026-11-28T00:30:00Z')){$('todayLabel').textContent='旅行進行中 · Day '+(pickToday()+1);$('todayDesc').textContent='查看每天的時間表與導航'}else{$('todayLabel').textContent='2026 冬日旅行手帳';$('todayDesc').textContent='回顧這段慕尼黑與布拉格的旅程'}}
document.addEventListener('click',function(ev){var n=ev.target.closest('[data-nav]');if(n){showScreen(n.dataset.nav);return}var d=ev.target.closest('[data-day]');if(d){dayIndex=Number(d.dataset.day);renderDay();history.replaceState(null,'','#day='+D.days[dayIndex].date);return}if(ev.target.closest('#nextView')){var ix=D.days.findIndex(function(x){return x.date===ev.target.closest('#nextView').dataset.nextDay});if(ix>=0){dayIndex=ix;showScreen('itinerary')}return}if(ev.target.closest('#goToday')){dayIndex=pickToday();renderDay();history.replaceState(null,'','#day='+D.days[dayIndex].date);return}var del=ev.target.closest('[data-del]');if(del){state.expenses=state.expenses.filter(function(x){return x.id!==del.dataset.del});save();renderExpenses();return}});
document.addEventListener('change',function(ev){if(ev.target.matches('[data-check]')){state.checked[ev.target.dataset.check]=ev.target.checked;save();renderTasks();renderCriticalAlert()}});
$('expenseForm').addEventListener('submit',function(e){e.preventDefault();addExpense(e.currentTarget)});
document.querySelectorAll('[data-rate]').forEach(function(input){input.addEventListener('input',function(){var code=input.dataset.rate,raw=input.value.trim(),val=Number(raw);state.usdRates[code]=raw!==''&&Number.isFinite(val)&&val>0?val:null;input.setAttribute('aria-invalid',raw!==''&&(!Number.isFinite(val)||val<=0)?'true':'false');save();renderExpenses()})});
function fromHash(){var h=decodeURIComponent(location.hash.slice(1));if(h.indexOf('day=')===0){var i=D.days.findIndex(function(d){return d.date===h.slice(4)});if(i>=0)dayIndex=i;showScreen('itinerary',false)}else if(navs.some(function(n){return n.id===h}))showScreen(h,false);else showScreen('itinerary',false)}

/* Offline-first shell. HTML contains the complete itinerary, styles and scripts. External maps and weather require internet. */
var TRIP_CACHE='mp26-core-20261118-v16',offlineReady=false,offlineUpdateAvailable=false,lastOfflinePoll=0;
function renderDataVersion(){
 var label=$('offlineVersion'),footer=$('footerDataVersion');
 if(!label&&!footer)return;
 var v=D&&D.dataVersion||{},updated=String(v.updatedAt||''),revision=String(v.revision||'');
 var valid=/^\d{4}-\d{2}-\d{2}$/.test(updated),date=valid?Number(updated.slice(5,7))+'/'+Number(updated.slice(8,10)):'';
 var zhPrefix=offlineReady?'離線版本':'資料版本',enPrefix=offlineReady?'Offline version':'Data version';
 var zh=date?zhPrefix+' · 資料更新於 '+date:zhPrefix+' · 更新日期未標示';
 var en=date?enPrefix+' · Updated '+new Date(updated+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):enPrefix+' · Date unavailable';
 if(revision){zh+=' · '+revision;en+=' · '+revision}
 if(label){label.textContent=lang==='en'?en:zh;label.title=lang==='en'?'Version of the itinerary loaded on this device':'目前裝置所載入的行程資料版本'}
 if(footer)footer.textContent=lang==='en'?(date?'Itinerary updated '+en.split('Updated ')[1]:'Itinerary date unavailable'):(date?'行程資料更新於 '+date:'行程資料更新日期未標示');
}
function renderOfflineStatus(){var text=$('offlineStatus'),dot=$('offlineDot'),btn=$('offlineReload');if(!text||!dot)return;
var online=navigator.onLine;
var zh,en,status;
if(offlineUpdateAvailable){zh='新版行程已下載 · 點擊更新';en='Updated itinerary ready · Reload';status='ready'}
else if(!online&&offlineReady){zh='目前離線 · 行程可離線閱讀';en='Offline · Itinerary available';status='offline'}
else if(!online){zh='目前離線 · 尚未備妥離線資料';en='Offline · Cache not ready';status='error'}
else if(offlineReady){zh='已備妥離線行程 · 無網路也能看';en='Offline itinerary saved · Ready to use';status='ready'}
else if('serviceWorker' in navigator&&'caches' in window){zh='正在準備離線行程…';en='Preparing offline itinerary…';status='pending'}
else{zh='此瀏覽器不支援離線快取';en='Offline caching unsupported';status='error'}
text.textContent=zh;dot.dataset.state=status;btn.hidden=!offlineUpdateAvailable;btn.textContent='更新行程';renderDataVersion()
}
async function checkOfflineCache(){if(!('caches' in window)){offlineReady=false;renderOfflineStatus();return}
try{var cache=await caches.open(TRIP_CACHE),urls=['index.html','styles.css','travel-theme.css','app.js','trip.json','trip-en.json','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png'].map(function(p){return new URL('./'+p,location.href).href});
var found=await Promise.all(urls.map(function(url){return cache.match(url)}));offlineReady=found.every(Boolean)}
catch(e){offlineReady=false}
renderOfflineStatus()
}
function askForTripUpdates(force){if(!navigator.onLine||!('serviceWorker' in navigator)||!navigator.serviceWorker.controller)return;
if(!force&&Date.now()-lastOfflinePoll<5*60000)return;lastOfflinePoll=Date.now();
navigator.serviceWorker.controller.postMessage({type:'CHECK_TRIP_UPDATES'})
}
window.addEventListener('online',function(){renderOfflineStatus();checkOfflineCache();askForTripUpdates(true)});
window.addEventListener('offline',renderOfflineStatus);
window.addEventListener('focus',function(){checkOfflineCache();askForTripUpdates(false)});
document.addEventListener('visibilitychange',function(){if(!document.hidden){checkOfflineCache();askForTripUpdates(false)}});
$('offlineReload').addEventListener('click',function(){location.reload()});
if('serviceWorker' in navigator&&location.protocol==='https:'){
navigator.serviceWorker.addEventListener('message',function(event){var type=event.data&&event.data.type;
if(type==='TRIP_CACHE_READY')checkOfflineCache();
if(type==='TRIP_UPDATE_READY'){offlineUpdateAvailable=true;renderOfflineStatus()}});
navigator.serviceWorker.addEventListener('controllerchange',function(){checkOfflineCache();askForTripUpdates(false)});
navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(function(reg){
checkOfflineCache();navigator.serviceWorker.ready.then(function(){checkOfflineCache()}).catch(function(){});
reg.update().catch(function(){})
}).catch(function(){offlineReady=false;renderOfflineStatus()});
}
renderOfflineStatus();
// Register offline support before starting the UI, so a future UI error cannot stall caching.

/* Bilingual presentation: all bookings remain in the same trip.json. */
var UI_EN={"家庭旅行":"Family Trip","家庭旅行行程表":"Family itinerary","2026 慕尼黑・布拉格":"Munich & Prague 2026","從巴伐利亞的聖誕市集，到波希米亞的冬日老城。":"From Bavarian Christmas markets to the historic streets of Bohemia.","一家四口的九天旅行手帳。":"A nine-day travel journal for our family of four.","2 位大人 · 2 位孩子":"2 adults · 2 kids","每日行程 · 交通 · 住宿":"Itinerary · Transport · Hotels","COMING UP · 下一站":"COMING UP · NEXT STOP","尋找下一站…":"Finding the next stop…","行程時間":"Event time","出門／集合":"Leave / Meet","依當地時間":"All times are local","查看行程":"View day","Google Maps 導航 ↗":"Google Maps directions ↗","旅程準備中":"Getting ready","選擇日期查看完整行程":"Choose a date to see your plans","行前重要提醒":"Pre-trip reminders","正在檢查行程狀態…":"Checking booking status…","每日行程":"Daily itinerary","點選日期，展開活動詳情與導航":"Pick a date to explore activities and directions","回到今天":"Go to today","交通與住宿":"Transport and hotels","一鍵查地址、車次與重要時間":"Flights, transfers, trains and hotel details","機場接送 · 四段":"Four airport and station transfers","已購票":"Tickets purchased","二等艙 · 259 車廂 · 54 / 56 / 65 / 67 座位":"Second class · Coach 259 · Seats 54 / 56 / 65 / 67","ČD 官方列車資訊 ↗":"ČD train information ↗","住宿資訊":"Hotels","當地交通小抄":"Local transit tips","11/20 慕尼黑機場":"Nov 20: Munich Airport","11/26 CK 小鎮":"Nov 26: Český Krumlov","S8 → Rosenheimer Platz → Motorama 通道 → Holiday Inn；抵達時確認通道是否開放":"S8 to Rosenheimer Platz, then the Motorama passage to Holiday Inn. Check whether it is open.","RegioJet／FlixBus 往返尚未購票，務必核對正確車站":"RegioJet/FlixBus tickets not booked yet. Confirm the exact bus station.","行前準備":"Trip checklist","勾選進度儲存在這支手機或目前瀏覽器":"Progress is saved in this browser.","勾選狀態只存在此瀏覽器，不會自動同步到另一支手機。":"Checkmarks stay on this device and do not sync.","旅行筆記":"Travel notes","簡單記帳、購物地點與實用連結":"Expenses, shopping and useful links","旅費記帳":"Travel expenses","保留原幣金額，並用自訂匯率估算美元（USD）總額；資料只存在此裝置。":"Keep original amounts and estimate USD totals with custom exchange rates. Data stays on this device.","用途":"Description","金額":"Amount","幣別":"Currency","＋ 新增":"+ Add","自訂匯率 · 美元估算":"Custom exchange rates · USD estimates","請手動輸入 1 EUR 和 1 CZK 約合多少 USD。舊台幣匯率不會沿用；未設定時不估算該幣別。":"Enter your estimated USD per EUR and CZK. Old TWD rates are not reused; missing rates are excluded.","購物與想逛的地方":"Shopping ideas","實用工具":"Useful links","慕尼黑 MVV ↗":"Munich MVV ↗","布拉格 PID ↗":"Prague PID ↗","捷克鐵路 ČD ↗":"Czech Railways ↗","布拉格機場 ↗":"Prague Airport ↗","布拉格城堡 ↗":"Prague Castle ↗","CK 官方旅遊 ↗":"Český Krumlov Tourism ↗","此網站可公開瀏覽，因此不存放私人訂房編號、完整電子票、乘客資料或專屬改訂連結。驗票請使用自行離線保存的原始 PDF／航空公司 App。":"This public website does not store private booking numbers, full tickets or traveler details. Keep private PDFs and airline apps for check-in.","時間為當地時間；票券、交通、場館開放與實際集合位置以當日官方資訊為準。":"All times are local. Verify schedules, tickets and meeting points with providers.","行程資料整理於 2026/11/16 · 個人記帳與勾選不跨裝置同步。":"Itinerary prepared Nov 16, 2026; personal checkmarks and expenses do not sync.","正在準備離線行程…":"Preparing offline itinerary…","更新行程":"Reload itinerary","已備妥離線行程 · 無網路也能看":"Offline itinerary saved · Available without internet","慕尼黑":"Munich","布拉格":"Prague","今晚住宿 · Tonight’s hotel":"TONIGHT'S HOTEL","地圖導航 ↗":"Map directions ↗","官方資訊 ↗":"Official info ↗","目前沒有支出紀錄":"No expenses recorded","11/23 請核對 EC 353 的實際月台；接送資訊請看上方機場接送。":"Check the EC353 platform on Nov 23. Transfers are listed above."},STATUS_EN={"已確認":"Confirmed","門票待購":"Tickets not purchased","自由安排":"Flexible","建議行程":"Suggested","已購票／已付款":"Purchased and paid","已訂房／房晚待核對":"Booked; verify room count","巴士尚未購票":"Bus not booked","回程車票未買":"Return ticket not bought","往返車票未買":"Round trip not booked","共同規劃／集合時間待確認":"Plan with friends; time unconfirmed","規劃時間／往返未購票":"Tentative; tickets not booked","同行規劃／庭院散步":"Planned walk with friends","與朋友同行／規劃":"Planning with friends","餐廳未訂位":"Restaurant not reserved","市集規劃／營業時間待再確認":"Market planned; hours to verify","返抵時間預估":"Estimated hotel arrival","抵達時間待確認":"Arrival time unconfirmed","條件適用／先核對登機門":"Gate-dependent","可選／需確認入場":"Optional; check access","可選／非保證入場":"Optional; entry not guaranteed"},CAT_EN={"機場接送":"Airport transfer","交通":"Transport","航班":"Flight","休息":"Rest","住宿":"Hotel","餐飲":"Food","景點":"Sightseeing","活動":"Guided tour","購物":"Shopping","節慶":"Christmas market","火車":"Train","貴賓室":"Airport lounge"},DAY_EN={"一":"Mon","二":"Tue","三":"Wed","四":"Thu","五":"Fri","六":"Sat","日":"Sun"};
var originals=new WeakMap();
function localTime(v){
 if(lang!=='en')return v;
 var x=String(v||'');
 var fixed={'起飛前':'Before takeoff','夜間':'Overnight','早餐後':'After breakfast','午餐後彈性':'Flexible after lunch','上午至下午':'Morning–afternoon','行程期間':'During the tour','晚間':'Evening','抵達後':'After arrival','Check-in 後':'After check-in','報到後／登機前':'After check-in / before boarding','安檢後／09:40 起飛前':'After security / before 9:40 flight','轉機候機／登機前':'During connection'};
 if(fixed[x])return fixed[x];
 return x.replace(/（可調）/g,'(flexible)').replace(/（待訂）/g,'(not booked)').replace(/（預估）/g,'(estimated)').replace(/（規劃）/g,'(planned)').replace(/（彈性）/g,'(flexible)').replace(/前後/g,'around').replace(/約 /g,'about ').replace(/ 後$/g,' onward');
}
function dayEnglish(day){return EN&&EN.days&&EN.days[day.date]||{}}
function eventEnglish(e){return EN&&EN.events&&EN.events[e.id]||{}}
function statusEnglish(e){return STATUS_EN[e.status]||({'paid':'Paid','confirmed':'Confirmed','reserved':'Reserved','pending':'Not booked','planned':'Planned','tentative':'Tentative'}[e.state]||'Planned')}
function staticText(){
 var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),node;
 while((node=walker.nextNode())){
  if(node.parentElement&&node.parentElement.closest('script,style,#daycontent,#daystrip,#rideCards,#transportcards,#hotelcards,#shopping,#tasks,#expenseTotals,#expenseRows,#nextStopCard,#criticalSignal,#todayLabel,#todayDesc,#offlineStatus,#offlineVersion,#footerDataVersion'))continue;
  var orig=originals.has(node)?originals.get(node):node.nodeValue;
  if(!originals.has(node))originals.set(node,orig);
  var key=orig.trim(),replacement=lang==='en'?(UI_EN[key]||key):orig;
  if(lang==='en'&&key){var i=orig.indexOf(key);replacement=orig.slice(0,i)+replacement+orig.slice(i+key.length)}
  if(node.nodeValue!==replacement)node.nodeValue=replacement;
 }
 document.documentElement.lang=lang==='en'?'en':'zh-Hant';
 document.title=lang==='en'?'Munich & Prague 2026 | Family Travel Itinerary':'2026 慕尼黑・布拉格家庭旅行｜每日行程與交通';
 var toggle=$('languageToggle');if(toggle){toggle.textContent=lang==='en'?'中文':'EN';toggle.setAttribute('aria-label',lang==='en'?'切換繁體中文':'Switch to English')}
 var field=document.querySelector('input[name="name"]');if(field)field.placeholder=lang==='en'?'e.g. Lunch or metro tickets':'例：午餐／地鐵票';
}
function localizeWeather(){
 if(lang!=='en')return;
 var day=D.days[dayIndex],pane=$('weatherSlot');if(!pane)return;
 var translations={
  'Daily weather · 每日天氣':'DAILY WEATHER','↻ 更新天氣':'↻ Refresh weather','更新中…':'Updating…',
  '🧥 今天怎麼穿':'🧥 What to wear','🧥 穿衣建議（一般冬季準備）':'🧥 Winter clothing tips',
  '舊金山機場 SFO':'San Francisco Airport SFO','慕尼黑 Munich':'Munich','天鵝堡區 Schwangau':'Schwangau castles',
  '布拉格 Prague':'Prague','庫倫洛夫 Český Krumlov':'Český Krumlov',
  '目前尚無這一天的可用預報，請在日期接近時再查看。':'No forecast available yet. Check closer to your trip.',
  '這個日期已過，網站未保存歷史實況。':'Historical weather was not saved.',
  '目前無法連上氣象服務，請稍後點選「更新天氣」。':'Weather unavailable. Try Refresh.',
  '正在取得當地最新預報…':'Fetching forecast…',
  '這是未來日期的預報，不是當日即時觀測；接近出發日再確認一次。':'This is a forecast; check again closer to travel.'
 };
 pane.querySelectorAll('.wx-head h3,.wx-head button,.wx-caption,.wx-wear-label,.wx-message,.wx-note').forEach(function(el){el.textContent=translations[el.textContent]||el.textContent});
 var f=forecastFor(day),w=pane.querySelector('.wx-wear p:not(.wx-specific)'),specific=pane.querySelector('.wx-specific');
 if(w){w.textContent=f&&f.lo<=2?'Wear thermals, a sweater, a heavy jacket, gloves, a scarf and warm socks.':'Wear warm layers and waterproof shoes with good grip.';if(f&&f.rain>=50)w.textContent+=' Pack a waterproof outer layer.'}
 if(specific)specific.textContent=({ '2026-11-19':'Bring a light jacket for the overnight flight.','2026-11-20':'Wear warm layers when arriving in Munich in the evening.','2026-11-21':'Gloves and a scarf will help during the Old Town walk.','2026-11-22':'The castles are colder than Munich. Wear non-slip shoes.','2026-11-23':'The Munich transfer starts at 5:40 AM; keep a warm coat handy.','2026-11-24':'Prague Castle and Petřín involve outdoor walking.','2026-11-25':'Wear comfortable shoes for Old Town cobblestones.','2026-11-26':'CK cobblestones and river paths can be slippery.','2026-11-27':'Keep your coat available for the 6:30 AM airport pickup.'})[day.date]||'Dress in layers.';
 var condition=pane.querySelector('.wx-condition');
 if(condition)condition.textContent=condition.textContent.replace(/晴朗/g,'Sunny').replace(/晴時多雲/g,'Partly cloudy').replace(/陰天/g,'Cloudy').replace(/有雨/g,'Rain').replace(/有雪/g,'Snow').replace(/有霧/g,'Fog').replace(/毛毛雨/g,'Drizzle').replace(/最高降雨機率/g,'Max rain chance').replace(/最大風速/g,'Max wind').replace(/降雨機率暫缺/g,'Rain chance unavailable').replace(/風速暫缺/g,'Wind unavailable');
 var current=pane.querySelector('.wx-current');if(current)current.textContent=current.textContent.replace(/目前/g,'Now').replace(/體感/g,'Feels like').replace(/（當地即時觀測／模型資料）/g,'(local conditions)');
 var meta=pane.querySelector('.wx-meta span');
 if(meta){var m=meta.textContent.match(/\d{2}\/\d{2}.*?[0-9]{2}:[0-9]{2}/);meta.textContent=m?'Forecast checked: '+m[0]+' (local time)':'Weather forecast information may need internet.'}

}
function localizeDay(){
 if(lang!=='en')return;
 var day=D.days[dayIndex],translation=dayEnglish(day),root=$('daycontent');
 if(!root)return;
 var heading=root.querySelector('.day-intro h2');if(heading)heading.textContent=translation.title||day.title;
 var high=root.querySelector('.day-intro .highlight');if(high)high.textContent=translation.highlight||day.highlight;
 var place=root.querySelector('.citypill');if(place)place.textContent=day.city;
 var subtitle=root.querySelector('.day-overline span:last-child');if(subtitle)subtitle.textContent='2026.11.'+day.date.slice(-2)+' · '+DAY_EN[day.weekday];
 $('daystrip').querySelectorAll('.daybtn').forEach(function(btn,i){
  var s=btn.querySelectorAll('small'),d=D.days[i];if(s[0])s[0].textContent='NOV · '+DAY_EN[d.weekday];if(s[1])s[1].textContent=d.city==='San Francisco'?'SFO':d.city==='Český Krumlov'?'CK Town':d.city
 });
 var events=D.events.filter(e=>e.date===day.date);
 root.querySelectorAll('.event').forEach(function(card,i){
  var e=events[i],en=eventEnglish(e);if(!e)return;
  var title=card.querySelector('.event-title'),time=card.querySelector('.event-time'),cat=card.querySelector('.minilabel'),status=card.querySelector('.status');
  if(title)title.textContent=en.title||e.title;if(time)time.textContent=localTime(e.time);
  if(cat)cat.textContent=CAT_EN[e.cat]||e.cat;if(status)status.textContent=statusEnglish(e);
  var details=card.querySelector('details');
  if(details){
   var summary=details.querySelector('summary');if(summary)summary.textContent=shouldShowMap(e)?'Details / Directions':'Details';
   var ps=details.querySelectorAll(':scope > p');
   ps.forEach(function(p,j){if(j===0)p.textContent=en.note||'';else p.remove()});
   details.querySelectorAll('.subitems,.notice').forEach(function(x){x.remove()});
   details.querySelectorAll('a').forEach(function(link){if(link.href.includes('google.com/maps'))link.textContent='Google Maps directions ↗';else if(link.href.includes('prioritypass.com'))link.textContent=link.textContent.replace('（備選）','(alternative)')});
  }
  var caption=card.querySelector('.place-figure figcaption a');if(caption)caption.textContent=caption.textContent.replace(/^照片：/,'Photo: ');
 });
 var tonight=root.querySelector('.stay-tonight .stay-kicker');if(tonight)tonight.textContent="TONIGHT'S HOTEL";
 var link=root.querySelector('.stay-tonight a.action');if(link)link.textContent='Hotel directions ↗';
 localizeWeather();
}
function localizeTravel(){
 if(lang!=='en')return;
 var ids=['d1-airport','d5-black','d9-black','d9-uber'];
 $('rideCards').querySelectorAll('.block').forEach(function(block,i){
  var e=D.events.find(x=>x.id===ids[i]);if(!e)return;
  var en=eventEnglish(e),title=block.querySelector('h3');if(title)title.textContent=en.title||e.title;
  var line=block.querySelector('.ride-line');
  if(line)line.textContent=line.textContent.replace('住家','Home').replace('SFO 機場','SFO Airport').replace('PRG 機場','Prague Airport').replace('慕尼黑中央車站','Munich Central Station');
  var kv=block.querySelectorAll('.kv');
  if(kv[0]){var spans=kv[0].querySelectorAll('span');if(spans[0])spans[0].textContent='Pickup time';if(spans[1])spans[1].textContent=spans[1].textContent.replace('美西當地時間','Pacific time').replace('歐洲當地時間','Central European time')}
  if(kv[1]){var spans2=kv[1].querySelectorAll('span');if(spans2[0])spans2[0].textContent='Booking';if(spans2[1])spans2[1].textContent=statusEnglish(e)}
  var warn=block.querySelector('.ride-warn');if(warn)warn.textContent=en.note||'Confirm booking details.';
 });
 $('hotelcards').querySelectorAll('.block').forEach(function(block){
  var meta=block.querySelector('.tinycaps');if(meta)meta.textContent=meta.textContent.replace(' 晚',' nights');
  block.querySelectorAll('.kv span:first-child').forEach(x=>x.textContent='Stay dates');
  var link=block.querySelector('a.action');if(link)link.textContent='Hotel directions ↗'
 });
 $('transportcards').querySelectorAll('.block').forEach(function(block){
  var fields=['Route','Departure','Arrival'];
  block.querySelectorAll('.kv span:first-child').forEach(function(el,i){el.textContent=fields[i]||el.textContent})
 });
}
function localizeTasks(){
 if(lang!=='en')return;
 var items=D.todos.concat(D.packing);
 $('tasks').querySelectorAll('.task').forEach(function(el,i){var x=items[i];if(!x)return;
  var txt=el.querySelector('span');if(txt)txt.textContent=EN.todos[x.id]||EN.packing[x.id]||x.text;
  var hint=el.querySelector('small');if(hint)hint.textContent=el.querySelector('input').checked?'Confirmed in itinerary':'Pending in itinerary';
 });
 $('tasks').querySelectorAll('.task-group').forEach(function(el,i){el.textContent=i===0?'Before you go':'Packing'});
 var count=$('taskCount');if(count)count.textContent=$('tasks').querySelectorAll('input:checked').length+' / '+items.length+' completed · Booking statuses follow itinerary';
}
function localizeShopping(){
 if(lang!=='en')return;
 $('shopping').querySelectorAll('.shop').forEach(function(b,i){var s=D.shopping[i];if(!s)return;var p=b.querySelector('p');if(p)p.textContent=EN.shopping[s.name]||s.tip;
 var a=b.querySelectorAll('a');if(a[0])a[0].textContent='Map directions ↗';if(a[1])a[1].textContent='Official information ↗'});
}
function localizeNext(){
 if(lang!=='en')return;
 var title=$('nextTitle'),current=title&&title.textContent||'';
 var e=D.events.find(function(v){return v.title===current||(EN.events[v.id]&&EN.events[v.id].title===current)});
 if(e){
  title.textContent=eventEnglish(e).title||e.title;
  $('nextTime').textContent=localTime(e.time);
  $('nextHint').textContent=eventEnglish(e).note||statusEnglish(e);
 }else{
  if(current==='旅程已結束')title.textContent='Trip complete';
  if($('nextHint').textContent==='可以回顧每日行程')$('nextHint').textContent='Review the itinerary';
 }
 var date=$('nextDate');if(date)date.textContent=date.textContent.replace('美西時間','Pacific time').replace('歐洲時間','Central European time');
 var leave=$('nextLeave');if(leave)leave.textContent=leave.textContent.replace('依路程安排','Allow travel time').replace('前抵達','arrive by').replace('送站','station pickup').replace('送機','airport transfer');
 var label=document.querySelector('.next-label');if(label)label.textContent='COMING UP · NEXT STOP';
 var small=document.querySelectorAll('.next-info small');if(small[0])small[0].textContent='Event time';if(small[1])small[1].textContent='Leave / Meet';
 var view=$('nextView');if(view)view.textContent='View day';
 var map=$('nextMap');if(map)map.textContent='Google Maps directions ↗';
}
function localizeCritical(){
 if(lang!=='en')return;
 var day=new Date(),inTrip=day>=new Date('2026-11-19T00:00:00-08:00')&&day<new Date('2026-11-28T00:00:00-08:00');
 if(inTrip){$('criticalTitle').textContent="Today's highlights";var d=D.days.find(x=>x.date===new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(day));if(d)$('criticalDesc').textContent=dayEnglish(d).highlight||d.highlight}
 else{
  var pending=['todos-7','todos-13','todos-12'].map(id=>D.todos.find(x=>x.id===id)).filter(x=>x&&!isChecked(x));
  $('criticalTitle').textContent=pending.length?'Before you go · '+pending.length+' to confirm':'Key pre-trip items confirmed ✓';
  $('criticalDesc').textContent=pending.length?pending.map(x=>({'todos-7':'Castle tickets/payment','todos-13':'CK round-trip bus','todos-12':'Prague concert'}[x.id])).join(' · '):'Castles, CK coach and concert are confirmed.';
 }
}
function localizeHero(){
 if(lang!=='en')return;
 var x=$('todayLabel');if(x){var m=x.textContent.match(/距離出發還有 (\d+) 天/);if(m)x.textContent=m[1]+' days to departure';else x.textContent=x.textContent.replace('今晚出發！','Departing tonight!').replace('旅行進行中','Trip in progress').replace('2026 冬日旅行手帳','2026 Winter Travel Journal')}
 var y=$('todayDesc');if(y)y.textContent=y.textContent.replace('查看每天的時間表與導航','See daily schedules and directions').replace('回顧這段慕尼黑與布拉格的旅程','Remember our family trip');
}
function localizeOffline(){if(lang!=='en')return;
 var map={'已備妥離線行程 · 無網路也能看':'Offline itinerary saved · Ready to use','正在準備離線行程…':'Preparing offline itinerary…','新版行程已下載 · 點擊更新':'Updated itinerary ready · Reload','目前離線 · 行程可離線閱讀':'Offline · Itinerary available','目前離線 · 尚未備妥離線資料':'Offline · Cache not ready','此瀏覽器不支援離線快取':'Offline caching unsupported'};
 $('offlineStatus').textContent=map[$('offlineStatus').textContent]||$('offlineStatus').textContent;
 $('offlineReload').textContent='Reload';
}
function wrapLocale(fn,after){return function(){var v=fn.apply(this,arguments);after();staticText();return v}}
updateNav=wrapLocale(updateNav,function(){});
renderDay=wrapLocale(renderDay,localizeDay);
renderTravel=wrapLocale(renderTravel,localizeTravel);
renderTasks=wrapLocale(renderTasks,localizeTasks);
renderShopping=wrapLocale(renderShopping,localizeShopping);
renderExpenses=wrapLocale(renderExpenses,function(){});
weatherCard=wrapLocale(weatherCard,localizeWeather);
renderNextStop=wrapLocale(renderNextStop,localizeNext);
renderCriticalAlert=wrapLocale(renderCriticalAlert,localizeCritical);
updateHero=wrapLocale(updateHero,localizeHero);
renderOfflineStatus=wrapLocale(renderOfflineStatus,localizeOffline);
function changeLanguage(){
 lang=lang==='en'?'zh':'en';if(lang==='en'&&!EN)lang='zh';
 try{localStorage.setItem(LANG_KEY,lang)}catch(e){}
 updateNav();renderDay();renderTravel();renderTasks();renderShopping();renderExpenses();renderNextStop();renderCriticalAlert();updateHero();renderOfflineStatus();
 staticText();
}
$('languageToggle').addEventListener('click',changeLanguage);

window.addEventListener('hashchange',fromHash);
initializeRates();
renderTravel();renderShopping();renderTasks();renderExpenses();renderCriticalAlert();
updateHero();fromHash();renderNextStop();loadWeatherAll(true);
setInterval(renderNextStop,60000);setInterval(renderCriticalAlert,60000);window.addEventListener('focus',renderNextStop);

})();
