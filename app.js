(async function(){
'use strict';
var D;
try{
  const response=await fetch('./trip.json');
  if(!response.ok)throw Error('Cannot read trip.json: '+response.status);
  D=await response.json();
  if(!D||!Array.isArray(D.days)||!Array.isArray(D.events))throw Error('Invalid trip data');
}catch(err){
  var heading=document.getElementById('todayLabel');
  var hint=document.getElementById('todayDesc');
  if(heading)heading.textContent='行程資料無法載入';
  if(hint)hint.textContent='請先連網重新整理，確認離線資料已下載。';
  console.error('Trip data unavailable',err);
  return;
}
try{localStorage.removeItem('munich-prague-lang-v1')}catch(e){}
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
var mapEventIds=new Set(["d1-airport","d2-hotel","d3-frauen","d3-stpeter","d3-lunch","d3-kustermann","d3-residenz","d3-max","d3-market","d4-tour","d4-hohen","d4-neusch","d4-alpsee","d4-bridge","d5-platform","d5-grand","d5-oldtown","d5-bridge","d5-miru","d6-castle","d6-starbucks","d6-porks","d6-river","d6-ujezd","d6-petrin","d6-entry","d7-square","d7-josefov","d7-celetna","d7-manuf","d7-powder","d7-republiky","d7-move","d8-castle","d8-lunch","d8-oldtown"]);
function shouldShowMap(e){return !!(e.place&&mapEventIds.has(e.id))}
function showMore(e){var body='';if(e.desc)body+='<p>'+E(e.desc)+'</p>';if(e.trans)body+='<p><b>交通：</b>'+E(e.trans)+'</p>';if(e.sub.length)body+='<ul class="subs subitems">'+e.sub.map(function(s){return '<li>'+E(s)+'</li>'}).join('')+'</ul>';if(e.weather)body+='<p><b>天氣備案：</b>'+E(e.weather)+'</p>';if(e.warn)body+='<p class="notice">'+E(e.warn)+'</p>';if(e.infoLinks&&e.infoLinks.length)body+='<div class="actionrow">'+e.infoLinks.map(function(l){return '<a class="action" href="'+E(l.url)+'" target="_blank" rel="noopener noreferrer">'+E(l.label)+' ↗</a>'}).join('')+'</div>';
if(e.loungeLinks&&e.loungeLinks.length)body+='<div class="actionrow">'+e.loungeLinks.map(function(l){return '<a class="action primary" href="'+E(l.url)+'" target="_blank" rel="noopener noreferrer">'+E((typeof L==='function'?L(l.label,l.en||l.label):l.label))+' · Priority Pass ↗</a>'}).join('')+'</div>';
if(shouldShowMap(e))body+='<div class="actionrow"><a class="action primary" target="_blank" rel="noopener noreferrer" href="'+mapurl(e.place)+'">Google Maps 導航 ↗</a></div>';return body}
function renderHotelTonight(date){var h=D.hotels.find(function(h){return date>=h.checkin&&date<h.checkout});if(!h)return '';return '<aside class="stay-tonight"><div><div class="stay-kicker">今晚住宿 · Tonight’s hotel</div><strong>'+E(h.name)+'</strong></div><a class="action" target="_blank" rel="noopener noreferrer" href="'+mapurl(h.address)+'">導航至飯店 ↗</a></aside>'}
function renderDay(){var d=D.days[dayIndex];$('daystrip').innerHTML=dayButtons();var selected=$('daystrip').querySelector('[aria-selected=true]');if(selected)selected.scrollIntoView({inline:'center',block:'nearest'});var events=D.events.filter(function(x){return x.date===d.date});var cards=events.map(function(e){var body=showMore(e);return '<div class="event"><div class="event-time">'+E(e.time)+'</div><article class="event-card"><div class="event-category"><span class="minilabel">'+E(e.cat)+'</span><span class="status '+statusClass(e.state)+'">'+E(e.status)+'</span></div><div class="event-title">'+E(e.title)+'</div>'+(body?'<details><summary>'+(shouldShowMap(e)?'詳細資訊／地圖':'詳細資訊')+'</summary>'+body+'</details>':'')+'</article></div>'}).join('');$('daycontent').innerHTML='<div class="day-summary"><h2>'+E(md(d.date)+'（'+d.weekday+'）｜'+d.title)+'</h2><span class="citypill">'+E(d.city)+'</span></div><div class="highlight">'+E(d.highlight)+'</div>'+renderHotelTonight(d.date)+'<div id="weatherSlot" aria-live="polite"></div><div class="timeline">'+cards+'</div>';var date=$('daystrip').querySelector('[aria-selected=true]');if(date)date.scrollIntoView({behavior:'auto',inline:'center',block:'nearest'});refreshWeatherUI()}

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
return fetch('https://api.open-meteo.com/v1/forecast?'+qs.toString(),{cache:'no-store'})
.then(function(resp){if(!resp.ok)throw Error('HTTP '+resp.status);return resp.json()})
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
function L(zh,en){return zh}
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
var nextStopIds=new Set(['d1-airport','d1-flight','d2-arrive','d2-ticket','d2-hotel','d3-frauen','d3-stpeter','d3-tour','d3-residenz','d3-market','d4-tour','d4-hohen','d4-neusch','d5-black','d5-platform','d5-train','d5-grand','d5-oldtown','d5-miru','d6-castle','d6-concert','d7-square','d7-move','d8-busout','d8-castle','d8-busback','d9-black','d9-airport','d9-lx1485','d9-lx38','d9-uber']);
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
var TRIP_CACHE='mp26-core-20261117-v3',offlineReady=false,offlineUpdateAvailable=false,lastOfflinePoll=0;
function renderOfflineStatus(){var text=$('offlineStatus'),dot=$('offlineDot'),btn=$('offlineReload');if(!text||!dot)return;
var online=navigator.onLine;
var zh,en,status;
if(offlineUpdateAvailable){zh='新版行程已下載 · 點擊更新';en='Updated itinerary ready · Reload';status='ready'}
else if(!online&&offlineReady){zh='目前離線 · 行程可離線閱讀';en='Offline · Itinerary available';status='offline'}
else if(!online){zh='目前離線 · 尚未備妥離線資料';en='Offline · Cache not ready';status='error'}
else if(offlineReady){zh='已備妥離線行程 · 無網路也能看';en='Offline itinerary saved · Ready to use';status='ready'}
else if('serviceWorker' in navigator&&'caches' in window){zh='正在準備離線行程…';en='Preparing offline itinerary…';status='pending'}
else{zh='此瀏覽器不支援離線快取';en='Offline caching unsupported';status='error'}
text.textContent=zh;dot.dataset.state=status;btn.hidden=!offlineUpdateAvailable;btn.textContent='更新行程'
}
async function checkOfflineCache(){if(!('caches' in window)){offlineReady=false;renderOfflineStatus();return}
try{var cache=await caches.open(TRIP_CACHE),urls=['index.html','styles.css','app.js','trip.json','manifest.webmanifest','icon.svg'].map(function(p){return new URL('./'+p,location.href).href});
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
window.addEventListener('hashchange',fromHash);
initializeRates();
renderTravel();renderShopping();renderTasks();renderExpenses();renderCriticalAlert();
updateHero();fromHash();renderNextStop();loadWeatherAll(true);
setInterval(renderNextStop,60000);setInterval(renderCriticalAlert,60000);window.addEventListener('focus',renderNextStop);

})();
