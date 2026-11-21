'use strict';
const contenders=['Stacey','CityMen','Infinity','Angels','Foxes','Darkfang','Typhoon'];
function currentMatchMinute(m){
 if(m.status!=='live')return null;
 const started=Date.parse(m.startedAt||'');
 if(Number.isFinite(started)&&started<=Date.now())return Math.max(0,Math.floor((Date.now()-started)/60000));
 const minutes=(m.events||[]).map(e=>Number(e.minute)).filter(n=>Number.isFinite(n)&&n>=0&&n<=240);
 return minutes.length?Math.max(...minutes):null;
}
function liveLabel(m){
 const minute=currentMatchMinute(m);
 return m.status==='live'?'LIVE'+(minute===null?'':' · '+minute+'′'):m.status==='completed'?'FULL TIME':'UPCOMING';
}
function streamFor(match){
  if(match.status!=='live'||!match.stream)return '';
  try{const url=new URL(match.stream);return url.protocol==='https:'?url.href:''}catch{return ''}
}
function currentTable(){
  const byClub=new Map((leagueState?.tournament?[...new Set([...leagueState.tournament.clubs,...data.upcoming.flatMap(m=>[clean(m.home),clean(m.away)])])]:currentClubNames()).map(c=>[c+' FC',{team:c+' FC',played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0}]));
  for(const m of data.upcoming.filter(m=>m.status==='completed')){
    for(const [name,forGoals,against] of [[m.home,+m.home_score,+m.away_score],[m.away,+m.away_score,+m.home_score]]){
      const t=byClub.get(name);
      t.played++;t.gf+=forGoals;t.ga+=against;t.gd=t.gf-t.ga;
      if(forGoals===against){t.drawn++;t.points++}else if(forGoals>against){t.won++;t.points+=3}else t.lost++;
    }
  }
  return [...byClub.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));
}
function currentClubs(){
  const fixtures=data.upcoming.map((m,i)=>[m,i]).filter(([m])=>[clean(m.home),clean(m.away)].includes(selectedClub));
  const directory='<div class="clubgrid">'+currentClubNames().map(c=>'<a class="clubcard" href="#clubs/'+encodeURIComponent(c)+'">'+crest(c)+esc(c)+' FC</a>').join('')+'</div>';
  if(!location.hash.split('/')[1] || !selectedClub)return directory;
  return '<a href="#clubs" class="more">‹ All clubs</a>'+clubProfile(selectedClub)+directory+'<h3 class="group">'+esc(selectedClub)+' FC · Season fixtures</h3><div class="cards">'+fixtures.map(([m,i])=>card(m,i,'upcoming')).join('')+'</div>';
}
function seasonHub(inside){
  const live=data.upcoming.map((m,i)=>[m,i]).filter(([m])=>m.status==='live');
  const sections=[['matches','Matches',data.upcoming.length+' fixtures · '+new Set(data.upcoming.map(m=>m.round)).size+' rounds'],['table','League table',(leagueState?.tournament?.clubs.length||currentClubNames().length)+' clubs'],['stats','Player stats','Goals and assists'],['clubs','The contenders','Clubs and their fixtures']];
  return '<section class="section">'+(inside?'<p class="desc">'+esc(leagueState?.tournament?.date||'Saturday 21 November 2026 · First kick-off 13:00')+'</p>':section('BOLTZ LEAGUE',esc(leagueState?.tournament?.name||'SEASON 26')))+'<div class="hubgrid">'+sections.map(([id,title,sub])=>'<a class="hubitem" href="#'+id+'"><h3>'+title+' ↗</h3><small>'+sub+'</small></a>').join('')+'</div></section>'+(inside?liveBroadcast():'');
}
const slides=[
  {label:'SATURDAY 21 NOVEMBER 2026',title:'SEASON <em>26.</em>',description:'Seven clubs. One champion.',action:'Experience Season 26',route:'season'},
  {label:'SEASON 25  /  ARCHIVE',title:'FOXES FC <em>CHAMPIONS.</em>',description:'Relive the trophy lift and the season Foxes FC finished on top.',action:'Explore Season 25',route:'archive/s25'}
];
let feature=0,timer,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero=document.getElementById('homeHero');
function renderSlide(){
 const s=slides[feature];const previous=hero.dataset.feature;hero.dataset.feature=feature;
 if(previous!==undefined&&previous!==String(feature)&&!matchMedia('(prefers-reduced-motion: reduce)').matches){hero.querySelector('.heroCopy').animate([{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'ease-out'})}
 const wrap=hero.querySelector('.campaignArt');let art=wrap.lastElementChild;
 const url=leagueState?.features[feature].image||(feature===0?'/assets/lineup-campaign.webp':'/assets/fox-campaign.webp');
 if(art.getAttribute('src')!==url){const next=new Image();next.src=url;next.alt='';next.className='incoming';wrap.append(next);art=next;
 const reveal=()=>{if(next!==wrap.lastElementChild)return;requestAnimationFrame(()=>next.classList.add('shown'));setTimeout(()=>{if(next===wrap.lastElementChild){while(wrap.firstElementChild!==next)wrap.firstElementChild.remove();next.className=''}},650)};
 next.decode().then(reveal).catch(reveal)}
 art.alt=feature===0?'Illustrated Season 26 players in the seven participating clubs’ colours':'Footballers under floodlights from the Season 25 champions campaign';
 document.getElementById('slideLabel').innerHTML='<span class="line"></span>'+(feature===0&&leagueState?.tournament?esc(leagueState.tournament.date):s.label);
 const campaign=leagueState?.features[feature];
 const heading=document.getElementById('slideTitle');if(feature===0 && (!campaign || /^season (26|6)\.?$/i.test(campaign.title))){heading.innerHTML='<span>BOLTZ LEAGUE</span><em>SEASON 26</em>'}else if(campaign){const words=campaign.title.toUpperCase().split(' '),em=document.createElement('em');em.textContent=words.pop();heading.replaceChildren(words.join(' ')+' ',em)}else heading.innerHTML=s.title;
 document.querySelector('#slideDesc p').textContent=campaign?.description||s.description;
 const a=document.getElementById('heroLink');a.href='#'+s.route;a.textContent=(feature===0?'Explore the season':s.action)+' ↗';
 document.querySelectorAll('#dots button').forEach((b,i)=>b.setAttribute('aria-current',String(i===feature)));
 const pause=document.getElementById('pauseSlide');pause.textContent=paused?'▷':'Ⅱ';pause.setAttribute('aria-label',paused?'Resume automatic rotation':'Pause automatic rotation');
}
function scheduleSlide(){clearTimeout(timer);if(!paused&&!document.hidden&&!hero.hidden&&!hero.matches(':hover')&&!hero.contains(document.activeElement))timer=setTimeout(()=>moveSlide(1),8500)}
function moveSlide(step){feature=(feature+step+slides.length)%slides.length;renderSlide();scheduleSlide()}
const dots=document.getElementById('dots');
slides.forEach((s,i)=>{const b=document.createElement('button');b.setAttribute('aria-label','Show '+s.action);b.onclick=()=>moveSlide(i-feature);dots.append(b)});
document.getElementById('backSlide').onclick=()=>moveSlide(-1);document.getElementById('nextSlide').onclick=()=>moveSlide(1);
document.getElementById('pauseSlide').onclick=()=>{paused=!paused;renderSlide();scheduleSlide()};
let touch;
hero.addEventListener('touchstart',e=>{touch=e.touches[0]},{passive:true});
hero.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.clientX,dy=e.changedTouches[0].clientY-touch.clientY;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))moveSlide(dx<0?1:-1);touch=null},{passive:true});
for(const event of ['mouseenter','mouseleave','focusin','focusout'])hero.addEventListener(event,()=>setTimeout(scheduleSlide,0));
document.addEventListener('visibilitychange',scheduleSlide);
addEventListener('hashchange',()=>setTimeout(scheduleSlide,0));
renderSlide();scheduleSlide();
function matchPoster(m,source) {
 const live=m.status==='live' && source==='upcoming';
 const status=live?liveLabel(m):m.status==='scheduled'?'KICK-OFF':source==='upcoming'?'FULL TIME':'ARCHIVE';
 const sides=[m.home,m.away];
 const teamArt=n=>leagueState?.clubs[clean(n)]?.image || (contenders.includes(clean(n))?'/assets/club-'+clean(n)+'.webp':'/assets/hero.webp');
 const score=m.status==='scheduled'?(m.kickoff||'VS'):[m.home_score??'–',m.away_score??'–'].join(' – ');
 return '<article class="matchPoster" aria-label="'+esc(sides.join(' versus '))+'">'+sides.map((n,i)=>'<div class="posterSide side'+i+'"><img src="'+esc(teamArt(n))+'" alt=""><strong>'+crest(n)+esc(n)+'</strong></div>').join('')+'<div class="posterScore"><small class="'+(live?'onAir':'')+'">'+status+'</small><b>'+esc(score)+'</b><span>'+esc(m.venue||'')+'</span></div></article>';
}
function liveBroadcast() {
 const live=data.upcoming.filter(m=>m.status==='live');
 const fixtures=live.length?live:data.upcoming.filter(m=>m.status==='scheduled').slice(0,1);
 const heading=live.length?'LIVE SCORES':fixtures.length?'NEXT KICK-OFF':'LATEST RESULT';
 const featured=fixtures.length?fixtures:data.upcoming.filter(m=>m.status==='completed').slice(-1);
 if(!featured.length)return '';
 return '<section class="section liveBroadcast">'+section('MATCH CENTRE',heading,link('matches','All fixtures'))+featured.map(m=>{
 const recent=m.events?.slice(-3).reverse()||[];
 return matchPoster(m,'upcoming')+(recent.length?'<ul class="broadcastEvents">'+recent.map(e=>'<li>'+esc([e.minute!==''?e.minute+'′':'',e.team,e.type,e.player].filter(Boolean).join(' · '))+'</li>').join('')+'</ul>':'');
 }).join('')+'</section>';
}

