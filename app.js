'use strict';
const $ = id => document.getElementById(id);
const pages = {home:'Home',season:'Season 26',matches:'Matches',table:'Table',stats:'Stats',clubs:'Clubs',archive:'Archive'};
const seasons = {s25:'Season 25',s24:'Season 24','s24-friendlies':'S24 Friendlies',s23:'Season 23',s22:'Season 22'};
const clubs = ['Foxes','Stacey','Typhoon','Angels','CityMen','Infinity','Darkfang'];
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentClubNames=()=>Object.keys(leagueState?.clubs || seasonDefaults?.clubs || {});
const clean = n => {
 const base=String(n).replace(/ FC$/,'');
 if(leagueState?.clubs && Object.hasOwn(leagueState.clubs,base))return base;
 return String(n).replace(/^The /,'').replace(/ FC.*$/,'').replace(/[^a-zA-Z ]/g,'').trim();
};
function crest(n){const c=clean(n);return ([...clubs,'Hashiras','Panthers','NoBadGame','Dem Boys','Man Utd','Galacticos','Kings'].includes(c))?'<img class="crest" src="/assets/'+c+'.png" alt="">':''}
function kitPortrait(team) {
 const name=clean(team);
 if(!contenders.includes(name))return crest(team);
 return '<span class="kitPortrait"><img class="kitPhoto" src="'+esc(clubImage(name))+'" alt="" loading="lazy">'+crest(team)+'</span>';
}
const club = n => '<span class="club">'+crest(n)+esc(clean(n))+(clean(n).startsWith('Team ')?'':' FC')+'</span>';
const link=(page,label)=>'<a class="more" href="#'+page+'">'+label+' ↗</a>';
const options=(values,current)=>Object.entries(values).map(([v,k])=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(k)+'</option>').join('');
const section=(k,title,tools='')=>'<div class="kicker">'+k+'</div><div class="head"><h2>'+title+'</h2><div class="tools">'+tools+'</div></div>';
let data,page,round=1,year='s26',matchSet='upcoming',team='',status='',matchSort='round',metric='goals',selectedClub='Foxes',archiveTab='Overview';
const rows=(name,id=year)=>data[name].filter(x=>x.competition===id);
function matches(){return matchSet==='upcoming'?data.upcoming:rows('fixtures',matchSet)}
function editMatchLink(m){
 const label=m.status==='scheduled'?'Edit fixture':'Edit match';
 return '<a class="ref-edit fixtureEdit" href="#ref/'+encodeURIComponent(m.id)+'?section=live" aria-label="'+esc(label+' · '+m.home+' v '+m.away)+'">'+label+' ↗</a>';
}
function matchStatusLegend(){
 return '<div class="matchStatusLegend" aria-label="Match status legend">'+
  '<span class="matchLegendItem" data-match-state="scheduled"><i aria-hidden="true"></i> Upcoming</span>'+
  '<span class="matchLegendItem" data-match-state="live"><i aria-hidden="true"></i> Live / ongoing</span>'+
  '<span class="matchLegendItem" data-match-state="completed"><i aria-hidden="true"></i> Finished</span></div>';
}
function card(m,index,source){const archived=source!=='upcoming',score=m.status!=='scheduled';return '<details class="fixtureDisclosure" data-match-state="'+esc(m.status)+'" data-key="'+esc(source+'-'+(m.id||m.match_id||index))+'"><summary class="match" data-index="'+index+'" data-source="'+source+'"><span class="meta"><span>'+esc(m.round||'Fixture')+'</span><span class="flag '+(!archived?m.status:'')+'" data-live-status-id="'+esc(m.id||'')+'">'+(archived?(m.status==='live'?'ARCHIVED · IN PROGRESS':m.status.toUpperCase()):(m.status==='live'?liveLabel(m):m.status==='completed'?'FULL TIME':'SCHEDULED'))+'</span></span>'+[m.home,m.away].map((n,i)=>'<span class="club">'+(archived?crest(n):kitPortrait(n))+esc(clean(n))+' FC<span class="score">'+(score?esc(i?m.away_score:m.home_score):'')+'</span></span>').join('')+(!archived&&streamFor(m)?'<span class="streamOn">● Stream available</span>':'')+(!archived?editMatchLink(m):'')+'<span class="matchfoot"><span>'+esc([m.kickoff,m.venue].filter(Boolean).join(' · ')||'Time unavailable')+'</span><b>⌄</b></span></summary><div class="fixtureBody"></div></details>'}
function standings(short=false){const list=year==='s26'?currentTable():year==='s25'?data.final:rows('standings');if(year!=='s26'&&!list.some(x=>+x.played))return '<p class="empty">No completed results were saved for this competition.</p>';const cols=short?['played','gd','points']:['played','won','drawn','lost','gf','ga','gd','points'];const labels={played:'P',won:'W',drawn:'D',lost:'L',gf:'GF',ga:'GA',gd:'GD',points:'PTS'};return '<table class="'+(short?'':'fulltable')+'"><thead><tr><th>POS</th><th>CLUB</th>'+cols.map(k=>'<th>'+labels[k]+'</th>').join('')+'</tr></thead><tbody>'+list.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+(year==='s26'?'<a class="club tableClub" href="#clubs/'+encodeURIComponent(clean(r.team))+'">'+kitPortrait(r.team)+esc(r.team)+'</a>':club(r.team))+'</td>'+cols.map(k=>'<td>'+(k==='gd'&&r[k]>0?'+':'')+esc(r[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table>'}
function leaders(limit=Infinity){const records=year==='s26'?publishedLeaders(metric):year==='s25'?data[metric]:rows('player-stats').filter(r=>+r[metric]>0).sort((a,b)=>b[metric]-a[metric]).map(r=>[r.player,clean(r.team),+r[metric]]);let last=-1,rank=0;return records.slice(0,limit).map(([n,t,v],i)=>{if(v!==last)rank=i+1;last=v;return '<div class="scorer"><small>'+rank+'</small>'+crest(t)+'<div><b>'+esc(n)+'</b><small>'+esc(t)+' FC</small></div><strong>'+v+'</strong></div>'}).join('')||'<p class="empty">No '+metric+' recorded.</p>'}
const metricTabs=()=>'<div class="tabs">'+['goals','assists'].map(x=>'<button data-metric="'+x+'" class="'+(metric===x?'on':'')+'">'+(x==='goals'?'Top scorers':'Top assists')+'</button>').join('')+'</div>';
const films=()=>'<div class="films">'+[['champions','Foxes FC lift the trophy','1:08'],['anniversary','One year of Boltz League','0:50']].map(([k,t,d])=>'<button class="media" data-film="'+k+'"><div class="thumb"><img loading="lazy" alt="" src="/assets/'+k+'.jpg"><span class="play">▷ &nbsp; '+d+'</span></div><h3>'+t+'</h3></button>').join('')+'</div>';
function home(){year='s26';const rounds=[...new Set(data.upcoming.map(m=>m.round))];round=Math.min(Math.max(round,1),Math.max(rounds.length,1));return leagueFeedBanner()+liveBroadcast()+'<section class="section">'+section(esc(leagueState?.tournament?.date||'SATURDAY, 21 NOVEMBER 2026'),'MATCHDAY','<button class="circ" data-round="-1" aria-label="Previous round" '+(round===1?'disabled':'')+'>‹</button><button class="circ" data-round="1" aria-label="Next round" '+(round>=rounds.length?'disabled':'')+'>›</button>'+link('matches','All matches'))+matchStatusLegend()+'<div class="cards homecards">'+data.upcoming.map((m,i)=>m.round===rounds[round-1]?card(m,i,'upcoming'):'').join('')+'</div></section>'+seasonHub(false)}
function matchContent(){
 const list=matches(),live=status==='live'&&matchSet==='upcoming';
 const filtered=list.map((m,i)=>({m,i})).filter(({m})=>
  (!team||[clean(m.home),clean(m.away)].includes(team))&&(!status||m.status===status));
 const statusRank={live:0,scheduled:1,completed:2};
 const byTime=(a,b)=>String(a.m.kickoff||'').localeCompare(String(b.m.kickoff||''))||
   String(a.m.venue||'').localeCompare(String(b.m.venue||''));
 if(matchSort==='team')filtered.sort((a,b)=>a.m.home.localeCompare(b.m.home)||a.m.away.localeCompare(b.m.away)||byTime(a,b));
 else if(matchSort==='status')filtered.sort((a,b)=>statusRank[a.m.status]-statusRank[b.m.status]||byTime(a,b));
 else if(matchSort==='kickoff')filtered.sort(byTime);
 const controls='<div class="filters"><select aria-label="Fixture programme" id="programme">'+options({upcoming:leagueState?.tournament?.name||'Season 26 · 21 November'},matchSet)+'</select>'+
  '<select id="team" aria-label="Filter club">'+options({'':'All clubs',...Object.fromEntries(currentClubNames().map(x=>[x,x+' FC']))},team)+'</select>'+
  '<select id="status" aria-label="Filter status">'+options({'':'All statuses',scheduled:'Upcoming',live:'Ongoing / Live',completed:'Finished'},status)+'</select>'+
  '<select id="matchSort" aria-label="Sort fixtures">'+options({round:'Round order',kickoff:'Kick-off time',team:'Team name A–Z',status:'Live first'},matchSort)+'</select></div>';
 const description=leagueFeedBanner()+matchStatusLegend()+'<p class="desc">'+(matchSet==='upcoming'?(leagueState?.tournament?esc(leagueState.tournament.name+' · '+leagueState.tournament.date):'Saturday 21 November 2026 · Season 26 fixture programme.'):'Archived match logs. Status and score reflect the last saved event record.')+'</p>';
 if(!filtered.length)return controls+description+'<p class="empty">'+(live?'No live scores are available for this programme.':'No matches match these filters.')+'</p>';
 const groups=matchSort==='round'?[...new Set(filtered.map(({m})=>m.round))].map(label=>[label,filtered.filter(({m})=>m.round===label)]):[['Fixtures',filtered]];
 return controls+description+groups.map(([label,items])=>'<h3 class="group">'+esc(label||'Fixtures')+'</h3><div class="cards">'+items.map(({m,i})=>card(m,i,matchSet)).join('')+'</div>').join('');
}
const seasonSelect=()=>'<select id="season" aria-label="Select competition">'+options(seasons,year)+'</select>';
const archiveNote=()=>year==='s26'?esc(leagueState?.tournament?.name||'Season 26')+' · Only completed fixtures count towards the standings.':year==='s25'?'Published final standings and player totals · 24 October 2026.':rows('fixtures').filter(m=>m.status==='completed').length+' of '+rows('fixtures').length+' fixtures marked complete in the saved archive.';
function squad(){if(year==='s26')return currentClubs();const roster=rows('squads').filter(r=>clean(r.team)===selectedClub);return '<div class="clubgrid">'+[...new Set(rows('squads').map(r=>clean(r.team)))].map(n=>'<button class="clubcard" data-club="'+esc(n)+'">'+crest(n)+esc(n)+' FC</button>').join('')+'</div><div class="panel section"><h3>'+esc(selectedClub)+' FC</h3><p class="note">'+seasons[year]+' · '+roster.length+' registered players</p><ul class="roster">'+roster.map(r=>'<li>'+esc(r.name)+(r.captain==='True'&&!r.name.includes('(C)')?' (C)':'')+'</li>').join('')+'</ul></div>'}
function archive(){const tabs=['Overview','Fixtures','Table','Player stats','Squads'];return seasonSelect()+'<div class="tabs">'+tabs.map(t=>'<button data-archive="'+t+'" class="'+(t===archiveTab?'on':'')+'">'+t+'</button>').join('')+'</div>'+({'Fixtures':()=>{matchSet=year;return '<div class="cards">'+matches().map((m,i)=>card(m,i,year)).join('')+'</div>'},Table:()=>'<div class="panel">'+standings()+'</div>','Player stats':()=>'<div class="panel">'+metricTabs()+leaders()+'</div>',Squads:squad,Overview:()=>'<div class="panel"><h3>'+(year==='s25'?'Foxes FC · Season 25 champions':seasons[year])+'</h3><p>'+archiveNote()+'</p>'+'<button class="chip" data-archive="Table">View archived table ↗</button>'+'</div>'+(year==='s25'?'<section class="section">'+section('BOLTZ TV','SEASON FILMS')+films()+'</section><div class="panel"><h3>Roll of honour</h3><p class="desc">Titles in the supplied past winners record</p>'+[['Angels',11],['Foxes',2],['Hashiras',2],['Panthers',2],...['Typhoon','Stacey','NoBadGame','Darkfang','Dem Boys','Man Utd','Galacticos','Kings'].map(n=>[n,1])].map(([n,v])=>'<div class="scorer">'+club(n)+'<strong>'+v+'</strong></div>').join('')+'<p><a href="/assets/season-programme.pdf" target="_blank">Open the original league programme ↗</a></p></div>':'')})[archiveTab]()}
function draw(){const expanded=new Set(Array.from(document.querySelectorAll('.fixtureDisclosure[open]'),d=>d.dataset.key));const key=(location.hash.slice(1)||'home').split('/');if(key[0].split('?')[0]==='ref'){page='ref';renderNavigation();updateShowcase(page);$('homeHero').hidden=true;$('editorial').hidden=true;return}page=pages[key[0]]?key[0]:'home';if(page==='matches')matchSet='upcoming';if(page==='clubs'&&key[1])selectedClub=currentClubNames().find(n=>encodeURIComponent(n)===key[1]) || '';renderNavigation();updateShowcase(page,key[1]);if(page==='home'&&leagueState?.presentation?.showClubs===false)$('showcase').hidden=true;$('homeHero').hidden=page!=='home';$('editorial').hidden=page!=='home'||leagueState?.presentation?.showEditorial===false;year=page==='archive'?(Object.hasOwn(seasons,key[1])?key[1]:'s25'):'s26';const views={home,season:()=>seasonHub(true),matches:matchContent,table:()=>'<p class="desc">'+archiveNote()+'</p><div class="panel">'+standings()+'</div>',stats:()=>'<p class="desc">'+archiveNote()+'</p><div class="panel">'+metricTabs()+leaders()+'</div>',clubs:()=>'<div class="section">'+squad()+'</div>',archive};const titles={season:esc(leagueState?.tournament?.name||'Season 26'),matches:'Match centre',table:'League table',stats:'Player stats',clubs:'Club directory',archive:'League archive'};$('app').innerHTML=page==='home'?home():'<section class="section"><div class="kicker">BOLTZ LEAGUE</div><h1 class="pagetitle">'+titles[page]+'</h1>'+views[page]()+'</section>';observeProfile();for(const d of document.querySelectorAll('.fixtureDisclosure'))if(expanded.has(d.dataset.key))d.open=true}
function modal(html){$('dialogBody').innerHTML=html;if(!$('dialog').open)$('dialog').showModal()}

function timelineSide(m,e){
 const team=clean(e.team||''),home=clean(m.home),away=clean(m.away);
 const original=team===home?'home':team===away?'away':'neutral';
 return e.type==='own goal'?(original==='home'?'away':original==='away'?'home':'neutral'):original;
}
function timelineEventCard(e,score=''){
 const type=String(e.type||'event').replaceAll('_',' ');
 const goal=type==='goal'||type==='own goal';
 const icons={'goal':'⚽','own goal':'⚽','yellow card':'🟨','red card':'🟥','clean sheet':'🧤'};
 const icon=icons[type]||'•';
 const label=type.charAt(0).toUpperCase()+type.slice(1);
 const scoreLabel=score?'<span class="timelineRunningScore" aria-label="Score after goal '+esc(score)+'">'+esc(score)+'</span>':'';
 const assist=type==='goal'&&e.assist?
   '<div class="timelineAssist" aria-label="Assist by '+esc(e.assist)+'"><svg viewBox="0 0 24 24" class="timelineBoot" aria-hidden="true"><path d="M4 4h6l3 7 7 3c1.3.5 2 1.5 2 2.8V19H4a2 2 0 0 1-2-2v-3h4L4 4Z" fill="currentColor"/><path d="M11 10l-3 2m5 0-3 2M5 21h3m4 0h3m4 0h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>'+esc(e.assist)+'</span></div>':'';
 return '<div class="timelineEvent'+(goal?' timelineGoal':'')+'"><div class="timelineEventMain"><span class="timelineEventIcon" aria-hidden="true">'+icon+'</span><span class="timelineEventCopy"><span class="timelineEventType">'+esc(label)+'</span> <strong>'+esc(e.player||'Player not listed')+'</strong></span>'+scoreLabel+'</div>'+assist+'</div>';
}
function matchTimeline(m,events){
 let homeGoals=0,awayGoals=0;
 const ordered=[...events].sort((a,b)=>{
  const minute=e=>e.minute===''||e.minute==null?999:Number(e.minute);
  return minute(a)-minute(b);
 });
 return '<div class="matchTimeline" aria-label="Match events by team"><div class="matchTimelineHead"><span>'+esc(m.home)+'</span><span aria-hidden="true">MIN</span><span>'+esc(m.away)+'</span></div>'+
  ordered.map(e=>{
   const side=timelineSide(m,e),goal=e.type==='goal'||e.type==='own goal';
   if(goal&&side==='home')homeGoals++;
   if(goal&&side==='away')awayGoals++;
   const score=goal&&side!=='neutral'?homeGoals+' – '+awayGoals:'';
   const content=timelineEventCard(e,score),minute=e.minute===''||e.minute==null?'—':esc(e.minute)+'′';
   if(side==='neutral')return '<div class="matchTimelineRow"><div class="timelineNeutral">'+content+'<span class="timelineUnknownMinute">'+minute+'</span></div></div>';
   return '<div class="matchTimelineRow"><div class="timelineTeamSlot timelineHome">'+(side==='home'?content:'')+'</div><span class="timelineMinute">'+minute+'</span><div class="timelineTeamSlot timelineAway">'+(side==='away'?content:'')+'</div></div>';
  }).join('')+'</div>';
}
function detailMarkup(index,source){const m=(source==='upcoming'?data.upcoming:rows('fixtures',source))[index], events=source==='upcoming'?(m.events||[]):rows('match-events',source).filter(e=>e.match_id===m.match_id);return matchPoster(m,source)+'<p class="note">'+esc([m.status==='scheduled'?'Scheduled':(m.status==='live'?(source==='upcoming'?'Live':'Archived in progress'):'Full time')+' · '+m.home_score+' – '+m.away_score,source==='upcoming'?(leagueState?.tournament?.date||'21 November 2026'):m.date,m.kickoff,m.venue].filter(Boolean).join(' · '))+'</p>'+(source==='upcoming'&&streamFor(m)?'<p><a class="streamOn" target="_blank" rel="noopener" href="'+esc(streamFor(m))+'">● Watch live stream ↗</a></p>':'')+'<div class="details"><h3>Match timeline</h3>'+(events.length?matchTimeline(m,events):'<p class="desc">'+(m.status==='scheduled'?'The match has no recorded result.':'No events were recorded.')+'</p>')+'</div>'+lineupView(m,source)}
function appearance(){modal(window.appearanceControls())}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.film){const k=d.film;modal('<h2>'+(k==='champions'?'Foxes FC lift the trophy':'One year of Boltz League')+'</h2><video controls autoplay playsinline poster="/assets/'+k+'.jpg" src="/assets/'+k+'.mp4"></video>')}else if(d.round){round+=Number(d.round);draw()}else if(d.metric){metric=d.metric;draw()}else if(d.club){selectedClub=d.club;if(page==='clubs')location.hash='clubs/'+d.club;draw()}else if(d.archive){archiveTab=d.archive;draw()}else if(b.id==='appearance')appearance();else if(b.id==='close')$('dialog').close()});
document.addEventListener('click',e=>{if(e.target.closest('#retryLiveFeed')){e.preventDefault();window.syncLeague?.();}});
document.addEventListener('change',e=>{const v=e.target.value;switch(e.target.id){case 'programme':matchSet=v;break;case 'team':team=v;break;case 'status':status=v;break;case 'matchSort':matchSort=v;break;case 'season':location.hash='archive/'+v;year=v;selectedClub=clean(rows('squads')[0]?.team||'Foxes');break;default:return}draw()});
$('dialog').addEventListener('close',()=>$('dialogBody').replaceChildren());$('dialog').addEventListener('click',e=>{if(e.target===$('dialog'))$('dialog').close()});

$('clubrail').innerHTML=clubs.map(c=>'<a aria-label="'+c+' FC squad" href="#clubs/'+c+'">'+crest(c)+'</a>').join('');
installCrestLoop();
addEventListener('hashchange',()=>{closeSeasons();archiveTab='Overview';if(location.hash==='#matches'){matchSet='upcoming';team='';status=''}if(location.hash.startsWith('#clubs/'))year='s26';draw();if(page==='home' && returningToShowcase){returningToShowcase=false;document.querySelector('.clubStage').focus({preventScroll:true});document.querySelector('#showcase').scrollIntoView()}else window.scrollTo(0,0)});
Promise.all([fetch('/assets/records.json').then(r=>r.json()),fetch('/assets/season-content.json').then(r=>r.json())]).then(([records,seed])=>{data=records;seasonDefaults=seed;applyLeague(seed);syncLeague();setInterval(syncLeague,12000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncLeague()})}).catch(()=>{$('app').textContent='League records could not load. Refresh to try again.'});
function renderNavigation(){
  const links=Object.entries(pages).filter(([id])=>id!=='archive');
  $('nav').innerHTML=links.map(([id,name])=>{
    name=esc(leagueState?.menu[id]||name);if(id==='season')return '<button id="seasonToggle" aria-expanded="false" aria-controls="seasonMenu" class="'+(['season','archive'].includes(page)?'active':'')+'">'+name+' <span aria-hidden="true">⌄</span></button>';
    return '<a href="#'+id+'" '+(id===page?'class="active" aria-current="page"':'')+'>'+name+'</a>';
  }).join('');
  closeSeasons();
}
function closeSeasons(){
  $('seasonMenu').hidden=true;
  $('seasonToggle')?.setAttribute('aria-expanded','false');
}
function openSeasons(){
  const toggle=$('seasonToggle'),box=toggle.getBoundingClientRect(),menu=$('seasonMenu');
  menu.innerHTML=[['season',esc(leagueState?.tournament?.name||'Season 26'),'Current'],...Object.entries(seasons).map(([key,name])=>['archive/'+key,name,'Archive'])].map(([route,name,state])=>'<a href="#'+route+'"><strong>'+name+'</strong><small>'+state+'</small></a>').join('');
  menu.style.left=Math.max(8,Math.min(innerWidth-222,box.left))+'px';
  menu.style.top=box.bottom+'px';menu.hidden=false;toggle.setAttribute('aria-expanded','true');
}
document.addEventListener('click',e=>{
  if(e.target.closest('#seasonToggle')){if($('seasonMenu').hidden)openSeasons();else closeSeasons()}
  else closeSeasons();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!$('seasonMenu').hidden){closeSeasons();$('seasonToggle').focus()}
  if(e.key==='ArrowDown'&&e.target.id==='seasonToggle'){e.preventDefault();openSeasons();$('seasonMenu').querySelector('a').focus()}
});
document.addEventListener('focusin',e=>{if(!e.target.closest('#seasonMenu,#seasonToggle'))closeSeasons()});
addEventListener('resize',closeSeasons);
addEventListener('scroll',closeSeasons,{passive:true});

document.addEventListener('toggle',event=>{
 const d=event.target;if(!d.matches?.('.fixtureDisclosure')||!d.open)return;
 const summary=d.querySelector('summary');d.querySelector('.fixtureBody').innerHTML=detailMarkup(+summary.dataset.index,summary.dataset.source);
},true);


/* Refresh live minute labels without recreating interactive match cards. */
setInterval(()=>{
 if(!data?.upcoming?.length)return;
 const live=new Map(data.upcoming.filter(m=>m.status==='live').map(m=>[m.id,m]));
 document.querySelectorAll('[data-live-status-id]').forEach(element=>{
  const m=live.get(element.dataset.liveStatusId);
  if(m)element.textContent=liveLabel(m);
 });
},15000);
