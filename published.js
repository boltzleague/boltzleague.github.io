let leagueState,leagueRevision=-1,pendingLeague=false,leagueRefreshQueued=false;
let leagueFeed={status:'connecting',lastVerified:null,reason:''};
window.boltzLeagueFeed=()=>({...leagueFeed});
function leagueFeedBanner(){
 const state=leagueFeed.status;
 const label=state==='online'?'Live data connected':state==='offline'?'Live updates unavailable':'Checking live scores…';
 const detail=state==='online'?'Fixtures, live scores and results are connected to the referee service.':
   state==='offline'?'Showing the last available fixture data. Matches shown as upcoming may already be live. Automatic retries are running.':
   'Connecting to the referee service for the latest match statuses.';
 return '<div class="leagueFeedNotice" data-connection="'+state+'" role="status" aria-live="polite"><strong>'+label+'</strong><span>'+detail+'</span>'+
   (state==='offline'?'<button type="button" id="retryLiveFeed">Retry live feed</button>':'')+'</div>';
}
function leagueFeedUpdate(status,reason=''){
 const previous=leagueFeed.status;
 leagueFeed={status,reason,lastVerified:status==='online'?new Date().toISOString():leagueFeed.lastVerified};
 if(previous!==status && typeof draw==='function' && typeof data!=='undefined' && data?.upcoming)draw();
}

// Matchday authority: reconcile only the four superseded, unplayed opening fixtures.
// Do not rewrite matches with recorded activity or future deliberate changes.
const officialS26Opening = [
 {id:'s26-1',round:'Round 1',kickoff:'13:00',venue:'Pitch 1',oldHome:'Stacey FC',oldAway:'Darkfang FC',home:'Typhoon FC',away:'CityMen FC'},
 {id:'s26-2',round:'Round 1',kickoff:'13:00',venue:'Pitch 2',oldHome:'Foxes FC',oldAway:'Infinity FC',home:'Infinity FC',away:'Stacey FC'},
 {id:'s26-3',round:'Round 1',kickoff:'13:15',venue:'Pitch 1',oldHome:'CityMen FC',oldAway:'Typhoon FC',home:'Foxes FC',away:'Darkfang FC'},
 {id:'s26-4',round:'Round 2',kickoff:'13:15',venue:'Pitch 2',oldHome:'Infinity FC',oldAway:'Angels FC',home:'Stacey FC',away:'Angels FC'}
];
function reconcileOfficialS26(matches) {
 const changes=[],blocked=[];
 const corrected=matches.map(m=>{
  const official=officialS26Opening.find(x=>x.id===m.id);
  if(!official||m.home!==official.oldHome||m.away!==official.oldAway||
     m.round!==official.round||m.kickoff!==official.kickoff||m.venue!==official.venue)return m;
  const populated=o=>Object.values(o||{}).some(v=>Array.isArray(v)?v.length>0:!!v);
  if(m.status!=='scheduled'||(m.events?.length||0)>0||
     populated(m.lineups)||populated(m.positions)||populated(m.formations)) {
   blocked.push(m.id);return m;
  }
  changes.push(m.id);
  return {...m,home:official.home,away:official.away};
 });
 return {matches:corrected,changes,blocked};
}
window.boltzOfficialS26={reconcile:reconcileOfficialS26};
function applyLeague(s){
 const fixed=reconcileOfficialS26(s.matches);
 const prepared=window.boltzLineupTemplates?.seedMissing(fixed.matches,s.clubs)||fixed.matches;
 const resolved={...s,matches:prepared};
 const tournament=resolved.tournament;
 leagueState=tournament && /^season\s+6\.?$/i.test(tournament.name.trim())
   ? {...resolved,tournament:{...tournament,name:'Season 26'}} : resolved;
 data.upcoming=resolved.matches.map(m=>{
  const scores=[m.home,m.away].map(n=>(m.events||[]).filter(e=>(e.type==='goal'&&e.team===n)||(e.type==='own goal'&&e.team!==n)).length);
  return {...m,home_score:scores[0],away_score:scores[1]};
 });
 const layout=s.presentation;
 for(const el of document.querySelectorAll('.brand span'))el.textContent=layout?.brand||'BOLTZ LEAGUE';
 document.querySelector('#showTitle').textContent=layout?.clubHeading||'THE CONTENDERS';
 const footer=document.querySelector('footer .foot > span');if(footer)footer.textContent=layout?.footer||'SOFTTED Football';
 renderSlide();draw();
}
async function syncLeague(){
 if(pendingLeague){leagueRefreshQueued=true;return false;}
 if(document.hidden)return false;
 pendingLeague=true;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),11000);
 try{
  // A unique query prevents an intervening CDN cache from serving stale scores.
  const url='https://boltz-league-matchday.jpiyady.chatgpt.site/api/league?at='+Date.now();
  const response=await fetch(url,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw Error('Live service responded HTTP '+response.status);
  const payload=await response.json();
  if(!payload?.state||!Array.isArray(payload.state.matches)||!payload.state.clubs||!Array.isArray(payload.state.features)||
    !Number.isInteger(payload.revision))throw Error('Unexpected live-feed response');
  const {revision,state}=payload;
  const wasOffline=leagueFeed.status!=='online';
  if(revision!==leagueRevision||wasOffline){
   const media=p=>p?.startsWith('/media/')?'https://boltz-league-matchday.jpiyady.chatgpt.site'+p:p;
   const clubs=Object.fromEntries(Object.entries(state.clubs).map(([name,c])=>[name,{...c,image:media(c.image),
    scene:c.scene&&{...c.scene,poster:media(c.scene.poster),clip:media(c.scene.clip)}}]));
   // A malformed feed should never replace the last good live data.
   applyLeague({...state,clubs,features:state.features.map(f=>({...f,image:media(f.image)}))});
   leagueRevision=revision;
  }
  leagueFeedUpdate('online');
  return true;
 }catch(error){
  leagueFeedUpdate('offline',String(error?.message||'Connection failed'));
  return false;
 }finally{
  clearTimeout(timeout);
  pendingLeague=false;
  if(leagueRefreshQueued){leagueRefreshQueued=false;queueMicrotask(()=>syncLeague());}
 }
}
window.syncLeague=syncLeague;
function publishedLeaders(metric){
 const players=new Map();
 for(const m of data.upcoming){for(const e of m.events){
  if(e.type!=='goal')continue;const n=metric==='goals'?e.player:e.assist;if(!n)continue;
  const key=JSON.stringify([e.team,n]);const entry=players.get(key)||[n,clean(e.team),0];entry[2]++;players.set(key,entry);
 }}
 return [...players.values()].sort((a,b)=>b[2]-a[2]||a[0].localeCompare(b[0]));
}
function clubProfile(name){
 const c=leagueState?.clubs[name];if(!c)return '';
 const defaults=seasonDefaults.clubs[name], prior=priorClubCopy[name];
 const title=defaults && prior && c.title===prior[0]?defaults.title:c.title;
 const bio=defaults && prior && c.bio===prior[1]?defaults.bio:c.bio==='Season 6 squad.'?'Season 26 squad.':c.bio;
 const scene=c.scene||{};
 const selected=Boolean(scene.player && scene.poster);
 const poster=selected?scene.poster:'/storyboard/'+name+'.webp';
 const clip=selected?scene.clip:null;
 const label=selected?scene.player+' · '+name+' FC':'Season 26 campaign artwork';
 const frame=!selected&&!defaults?'':'<figure class="profileFilm"><div class="filmFrame"><img class="filmStill" src="'+esc(poster)+'" alt="'+esc(selected?scene.player+' in the '+name+' FC kit':name+' FC scene preview')+'">'+
 (clip?'<video hidden muted playsinline loop preload="none" poster="'+esc(poster)+'" data-src="'+esc(clip)+'" aria-label="'+esc(label)+'"></video>':'')+'</div><figcaption>'+esc(label)+'</figcaption></figure>';
 return '<article class="clubprofile"><header class="profileHeading"><div class="kicker">SEASON 26 · CLUB PROFILE</div><h2>'+esc(name)+' FC</h2><h3 class="clubmotto">'+esc(title)+'</h3></header>'+frame+'<section class="profileStory"><p>'+esc(bio)+'</p><h3>'+esc(c.squadName || 'Squad')+'</h3>'+(c.players.length?'<ul class="roster">'+c.players.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>':'<p class="note">The club’s squad has yet to be announced.</p>')+'</section></article>';
}
function lineupView(m,source){
 return '<div class="formationGrid">'+[m.home,m.away].map(side=>{
 const archived=source!=='upcoming';
 const saved=archived?rows('lineups',source).filter(r=>clean(r.team)===clean(side)):[];
 const names=archived?saved.map(r=>r.player):m.lineups?.[side]||[];
 const shape=m.formations?.[side]||'';
 const points=pitchPoints(names,shape,m.positions?.[side]);
 return '<div><h4>'+esc(side)+'</h4><small>'+esc(shape||(archived?'Archived club lineup':'Starting lineup'))+'</small>'+shirtPitch(side,points,esc)+'</div>';
 }).join('')+'</div>';
}

