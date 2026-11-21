'use strict';
export function mountRefDesk(root, query, inline = false) {
 const lifetime = new AbortController();
const $=id=>root.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const embedded = inline || query.get('embedded') === '1' && window.parent !== window;
function deskFetch(path, options) {
 if (embedded && typeof (inline ? window : window.parent).boltzRefFetch === 'function') return (inline ? window : window.parent).boltzRefFetch(path, options);
 return fetch(path, options);
}
function notifyParent(message) {
 if (embedded && !inline) window.parent.postMessage(message, location.origin);
}
if (embedded && !inline) {
 document.body.classList.add('embedded');
 new ResizeObserver(() => notifyParent({type:'boltz-ref-height',height:Math.ceil(document.body.getBoundingClientRect().height)})).observe(document.body);
}
const collator = new Intl.Collator('en', {sensitivity:'base', numeric:true});
const eventIcons={'goal':'⚽','own goal':'↩','clean sheet':'🛡','yellow card':'🟨','red card':'🟥'};
let editingPlayer=null, editingClub=null, livePanel='logging';
const pendingEventPlayers=new Set();
let role='guest';
const sectionTabs={teams:'Teams & squads',fixtures:'Fixtures',live:'Live matches',database:'Database control'};
const tabs=[...Object.values(sectionTabs),'Homepage','Navigation'];
let state,revision,dirty=false,busy=false,restoreSeasonStart=false,tab=sectionTabs[query.get('section')] || (query.has('match')?'Live matches':tabs[0]),club='Foxes',matchId,feature=0,eventSide,editEvent;
if(!inline)window.boltzRefDirty=()=>dirty;
const say=v=>$('feedback').textContent=v;
const match=()=>state.matches.find(m=>m.id===matchId);
const base='https://boltz-league-matchday.jpiyady.chatgpt.site';
const field=(label,id,v,type='text')=>'<label>'+label+'<input id="'+id+'" type="'+type+'" value="'+escape(v)+'"></label>';
const area=(label,id,v)=>'<label>'+label+'<textarea id="'+id+'">'+escape(v)+'</textarea></label>';
const opts=(items,value)=>items.map(n=>'<option '+(n===value?'selected':'')+'>'+escape(n)+'</option>').join('');
const select=(label,id,items,value)=>'<label>'+label+(['home','away','club','eventSide'].includes(id)?'<span class="clubSelect">'+crestBadge(value):'')+'<select id="'+id+'">'+opts(items,value)+'</select>'+(['home','away','club','eventSide'].includes(id)?'</span>':'')+'</label>';
const chooseClub=n=>n.replace(/ FC$/,'');
function changed(){restoreSeasonStart=false;dirty=true;notifyParent({type:'boltz-ref-dirty',dirty:true});$('revision').textContent='Unpublished changes';$('publish').disabled=busy}
function render(){
 if(inline){
  const active=Object.keys(sectionTabs).find(key=>sectionTabs[key]===tab);
  for(const link of document.querySelectorAll('.refNav a')){
   if(link.hash.endsWith('='+active))link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  }
 }
 $('tabs').innerHTML=(role==='owner'?tabs:Object.values(sectionTabs)).map(t=>'<button data-tab="'+t+'" class="'+(tab===t?'on':'')+'">'+t+'</button>').join('');
 pendingEventPlayers.clear();
 $('workspace').innerHTML='<h2>'+tab+'</h2>'+({'Live matches':matchView,Fixtures:fixtureView,'Teams & squads':clubView,'Database control':databaseView,Homepage:featureView,Navigation:menuView}[tab]());
 if($('eventForm'))updateEventFields();
}
function uploadControl(path){return '<img class="art" src="'+escape(path.startsWith('/media/')?path:base+path)+'" alt="Current artwork"><label>Replace artwork<input id="upload" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="hint">JPEG, PNG or WebP, up to 3 MB. Publish to display it in the match centre.</p>'}
function sceneEditor(c){
 const media=c.scene||{};
 return '<section class="card"><h3>Season 26 player film</h3><p>'+escape(sceneBriefs[club]||'Upload a selected player in the team kit.')+'</p><p>Frame one selected club player in their own kit, with boots and one football visible. Upload a short muted MP4 and a still of the same player.</p>'+
 field('Selected player','scenePlayer',media.player||'')+
 '<label>Player still<input type="file" data-scene="poster" accept="image/jpeg,image/png,image/webp"></label>'+
 '<label>Player clip<input type="file" data-scene="clip" accept="video/mp4"></label>'+
 '<p>'+[media.poster?'Still ready':'No player still',media.clip?'Clip ready':'No player clip'].join(' · ')+'</p>'+
 '<button type="button" id="clearScene">Clear player slot</button></section>';
}
function rosterEditor(c, name) {
 const upcoming=state.matches.filter(m=>m.status!=='completed'&&[m.home,m.away].includes(name+' FC'));
 const renaming=editingClub===name && editingPlayer;
 const names=[...c.players].sort(collator.compare);
 return '<section class="card squadCard" data-club-card="'+escape(name)+'"><h3>'+teamLabel(name+' FC')+'<small>'+names.length+' players</small></h3>'+
 '<form class="renameTeamForm"><label>Squad name<input name="teamName" value="'+escape(c.squadName||name+' FC')+'" maxlength="50" required></label><button>Save name</button></form>'+
 '<form class="rosterForm" data-roster-form><label>'+ (renaming?'Rename player':'Add player')+'<input name="playerName" maxlength="70" autocomplete="off" required value="'+escape(renaming||'')+'" placeholder="Player name"></label>'+
 '<button type="submit">'+(renaming?'Save':'Add')+'</button>'+(renaming?'<button type="button" id="cancelRename">Cancel</button>':'')+'</form>'+
 (names.length?'<ul class="rosterList">'+names.map(player=>'<li><span>'+escape(player)+'</span><button data-rename-player="'+escape(player)+'" aria-label="Rename '+escape(player)+'">Edit</button><button data-remove-player="'+escape(player)+'" aria-label="Remove '+escape(player)+'">×</button></li>').join('')+'</ul>':'<p class="hint">Add the first player above.</p>')+
 (upcoming.length?'<div class="lineupShortcut"><label>Fixture lineup<select data-squad-fixture>'+upcoming.map(m=>'<option value="'+escape(m.id)+'">'+escape(m.round+' · '+m.home+' VS '+m.away)+'</option>').join('')+'</select></label><button type="button" data-open-squad-lineup>Set lineup</button></div>':'')+'</section>';
}
function clubView() {
 const add='<details class="card addTeam"><summary>Add a team</summary><form id="addTeamForm" class="rosterForm"><label>Team name<input id="newTeamName" autocomplete="off" maxlength="53" required></label><button type="submit">Add team</button></form></details>';
 const squads='<div class="squadGrid">'+Object.keys(state.clubs).sort(collator.compare).map(name=>rosterEditor(state.clubs[name],name)).join('')+'</div>';
 if(role==='referee') return add+squads;
 const c=state.clubs[club];
 return add+squads+'<details class="card"><summary>Club profile &amp; artwork</summary>'+select('Club','club',Object.keys(state.clubs).sort(collator.compare),club)+field('Club headline','title',c.title)+field('Kit colours','kit',c.kit)+area('Club bio','bio',c.bio)+uploadControl(c.image)+sceneEditor(c)+'</details>';
}
function rosterInput(name) {
 return [...root.querySelectorAll('[data-club-card]')].find(card=>card.dataset.clubCard===name)?.querySelector('[name="playerName"]');
}
function setSquadName(oldName, newName) {
 const name=newName.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!name||name.length>50){say('Enter a squad name of up to 50 characters.');return false}
 if(name===state.clubs[oldName].squadName)return false;
 state.clubs[oldName].squadName=name;changed();render();return true;
}
function databaseView() {
 const playerCount=Object.values(state.clubs).reduce((sum,c)=>sum+c.players.length,0);
 return '<section class="card"><h3>Season 26 records</h3><p>'+state.matches.length+' fixtures · '+playerCount+' registered players · revision '+revision+'</p>'+
   '<div class="row"><button id="dbSave">Save changes</button><button id="reloadRecords">Reload published records</button></div></section>'+
   '<section class="card"><h3>Reset season data</h3><p>Restore the opening Season 26 fixture schedule and clear its scores, statuses, events and lineups. Squads, club profiles and other season archives are kept. The reset is only applied when you publish.</p>'+
   '<button id="resetSeason" class="danger">Reset season data</button></section>';
}
function editRoster(oldName,newName) {
 const c=state.clubs[club];
 const other=c.players.filter(n=>n!==oldName);
 if(newName && (newName.length>70 || other.some(n=>collator.compare(n,newName)===0))){say('Enter a unique name of up to 70 characters.');return false}
 if(newName && other.length>=80){say('A squad can contain up to 80 players.');return false}
 c.players=(newName?[...other,newName]:other).sort(collator.compare);
 for(const m of state.matches) {
   const side=club+' FC';
   if(!oldName || m.status==='completed' || ![m.home,m.away].includes(side))continue;
   if(m.lineups?.[side])m.lineups[side]=[...new Set(m.lineups[side].flatMap(n=>n===oldName?(newName?[newName]:[]):[n]))];
   if(m.positions?.[side]){
    const seen=new Set();
    m.positions[side]=m.positions[side].flatMap(point=>{
     const name=point.name===oldName?newName:point.name;
     if(!name||seen.has(name))return [];
     seen.add(name);return [{...point,name}];
    });
   }
   if(newName) for(const e of m.events) if(e.team===side){if(e.player===oldName)e.player=newName;if(e.assist===oldName)e.assist=newName}
 }
 editingPlayer=null;changed();render();return true;
}
root.addEventListener('submit', async e=>{
 const card=e.target.closest('[data-club-card]');
 if(card)club=card.dataset.clubCard;
 if(e.target.classList.contains('renameTeamForm')){
  e.preventDefault();if(busy)return;const saveNow=!dirty;
  if(setSquadName(club,e.target.elements.teamName.value)&&saveNow)await publishDraft();return;
 }

 if(e.target.id==='addTeamForm'){
  e.preventDefault();
  if(busy)return;
  const name=$('newTeamName').value.normalize('NFKC').trim().replace(/\s+/g,' ').replace(/ FC$/i,'');
  if(!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .’'&-]{0,49}$/u.test(name)||Object.hasOwn(Object.prototype,name)){say('Enter a team name up to 50 characters.');return}
  if(Object.keys(state.clubs).some(n=>collator.compare(n,name)===0)){say('That team is already registered.');return}
  if(Object.keys(state.clubs).length>=64){say('The season has reached its team limit.');return}
  const saveNow=!dirty;
  state.clubs[name]={title:name+' FC',bio:'Season 6 squad.',kit:'Unconfirmed',image:'/assets/hero.webp',players:[]};
  club=name;editingPlayer=null;changed();render();
  if(saveNow)await publishDraft();else say('Team added to draft. Publish to share it.');
  rosterInput(club)?.focus();return;
 }
 if(e.target.id==='eventForm'){e.preventDefault();if(!busy)await saveEvent();return}
 if(!e.target.hasAttribute('data-roster-form'))return;
 e.preventDefault();
 if(busy)return;const name=e.target.elements.playerName.value.trim();
 if(!name){say('Enter a player name.');return}
 const saveNow=!dirty;
 if(editRoster(editingClub===club?editingPlayer:null,name)){
  if(saveNow)await publishDraft();else say('Squad updated in draft.');
  rosterInput(club)?.focus();
 }
});
function featureView(){const f=state.features[feature];return select('Homepage slide','feature',['Season 26','Foxes champions'],feature?'Foxes champions':'Season 26')+'<div class="card">'+field('Headline','title',f.title)+area('Description','description',f.description)+uploadControl(f.image)+'</div>'}
function menuView(){return '<div class="card"><h3>Main navigation labels</h3>'+Object.entries(state.menu).map(([id,n])=>field(id.charAt(0).toUpperCase()+id.slice(1),'menu-'+id,n)).join('')+'</div>'}
function players(side){return state.clubs[chooseClub(side)]?.players||[]}
const crestNames=new Set(['Angels','Stacey','CityMen','Darkfang','Infinity','Typhoon','Foxes']);
function crestBadge(name){
 const key=name.replace(/ FC$/,'');
 if(!crestNames.has(key))return '<span class="crestInitial" aria-hidden="true">'+escape(key.slice(0,1))+'</span>';
 const url=new URL('../assets/'+encodeURIComponent(key)+'.png',import.meta.url);
 return '<img class="teamCrest" alt="" src="'+escape(url.href)+'">';
}
function versus(home,away){return '<span class="matchTeams">'+teamLabel(home)+'<span class="versus">VS</span>'+teamLabel(away)+'</span>'}
function teamLabel(name){return '<span class="teamLabel">'+crestBadge(name)+escape(state.clubs[chooseClub(name)]?.squadName||name)+'</span>'}
function score(m){return [m.home,m.away].map(n=>m.events.filter(e=>(e.type==='goal'&&e.team===n)||(e.type==='own goal'&&e.team!==n)).length).join(' – ')}
function fixtureActions() {
 return '<div class="row fixtureActions" tabindex="-1"><button id="newMatch">Add fixture</button><button class="danger" id="deleteFixture">Delete selected fixture</button></div>';
}
function fixturePicker(m,label='Fixture'){
 return (label==='Fixture'?versus(m.home,m.away):'')+'<label>'+label+'<select id="fixture">'+state.matches.map(x=>'<option value="'+escape(x.id)+'" '+(m===x?'selected':'')+'>'+escape(x.round+' · '+x.kickoff+' · '+x.home+' VS '+x.away+' · '+x.status)+'</option>').join('')+'</select></label>';
}
function fixtureView(){
 const update=window.boltzOfficialS26?.reconcile(state.matches);
 const notice=update?.changes.length
  ? '<section class="card"><h3>Official matchday fixture correction</h3><p>'+update.changes.length+' opening fixture(s) still have superseded opponents in the live service. Apply the official Season 26 schedule without resetting scores, squads or archives.</p><button type="button" id="applyOfficialFixtures">Apply and publish official fixtures</button></section>'
  : update?.blocked.length
    ? '<section class="card"><h3>Fixture correction needs review</h3><p>One or more superseded fixtures already contain match activity or lineups. Review those matches manually to avoid moving a recorded goal or lineup to another club.</p></section>'
    : '';
 const m=match();if(!m)return notice+'<button id="newMatch">Add fixture</button>';
 const clubs=Object.keys(state.clubs).map(n=>n+' FC').sort(collator.compare);
 return notice+matchList('fixtures')+fixturePicker(m)+fixtureActions()+'<section class="card"><h3>Fixture details</h3>'+'<div class="grid">'+select('Home club','home',clubs,m.home)+select('Away club','away',clubs,m.away)+'<label>Round or stage<input id="round" list="roundNames" maxlength="50" value="'+escape(m.round)+'"></label><datalist id="roundNames">'+opts([...new Set([...state.matches.map(m=>m.round),...Array.from({length:12},(_,i)=>'Week '+(i+1)),'Semi-final','Final'])],m.round)+'</datalist>'+field('Kickoff','kickoff',m.kickoff,'time')+field('Pitch','venue',m.venue)+select('Status','status',['scheduled','live','completed'],m.status)+'</div>'+field('TV / stream URL','stream',m.stream||'','url')+'<button id="openMatch">Edit live match &amp; lineup</button></section>';
}
function matchList(section) {
 const rank={live:0,scheduled:1,completed:2};
 const matches=[...state.matches].sort((a,b)=>rank[a.status]-rank[b.status]);
 const live=matches.filter(m=>m.status==='live').length;
 return '<details class="fixtureChooser"><summary>Choose a match <small>'+matches.length+' fixtures'+(live?' · '+live+' live':'')+'</small></summary><div class="matchList" aria-label="Season fixtures">'+matches.map(m=>'<button class="fixtureRow '+(m.id===matchId?'selected':'')+'" data-match="'+escape(m.id)+'" data-section="'+section+'" aria-pressed="'+(m.id===matchId)+'">'+versus(m.home,m.away)+'<span class="fixtureMeta">'+escape(m.round+' · '+m.kickoff+' · '+m.venue)+'</span><span class="fixtureStatus" data-status="'+escape(m.status)+'">'+escape(m.status==='scheduled'?'Scheduled':score(m)+' · '+m.status)+'</span><span class="fixtureEdit">'+(section==='live'?'Match control':'Edit fixture')+'</span></button>').join('')+'</div></details>';
}
function matchPanels(){
 return '<div class="matchPanels" role="group" aria-label="Match controls">'+[['logging','Ref logging'],['timeline','Timeline'],['lineups','Lineups']].map(([key,label])=>'<button data-panel="'+key+'" aria-pressed="'+(livePanel===key)+'">'+label+'</button>').join('')+'</div>';
}

function eventPlayerPicker(id,label,selected,optional=false){
 const roster=[...players(eventSide)].sort(collator.compare);
 const options=(selected&&!roster.includes(selected)?[selected,...roster]:roster)
   .map(name=>'<option value="'+escape(name)+'"'+(name===selected?' selected':'')+'>'+escape(name)+(roster.includes(name)?'':' (recorded name)')+'</option>').join('');
 return '<div class="eventPlayerPicker" id="'+id+'Picker"><label>'+label+
   '<select id="'+id+'"'+(optional?'':' required')+'><option value="">'+(optional?'No assist':'Choose a registered player')+'</option>'+options+'</select></label>'+
   '<button type="button" data-new-event-player="'+id+'">'+(optional?'Add missing assister':'Add missing player')+'</button></div>';
}
function eventForm(e){
 return '<form id="eventForm"><div class="grid"><label>Event<select id="type">'+
   Object.entries(eventIcons).map(([value,icon])=>'<option value="'+value+'"'+(value===e.type?' selected':'')+'>'+icon+' '+value+'</option>').join('')+
   '</select></label>'+field('Minute (optional)','minute',e.minute,'number')+
   eventPlayerPicker('player','Player',e.player)+eventPlayerPicker('assist','Assist (optional)',e.assist,true)+'</div>'+
   '<p class="hint" id="eventScoringHint"></p>'+
   '<div id="newEventPlayer" class="newEventPlayer" hidden><label>New player name<input id="newEventPlayerName" maxlength="70" autocomplete="off" enterkeyhint="done"></label>'+
   '<div class="row"><button type="button" id="addNameToEvent">Add and select</button><button type="button" id="cancelEventPlayer">Cancel</button></div>'+
   '<p class="hint">The player joins this team’s squad when the event is published.</p></div>'+
   '<div role="status" id="eventFeedback" class="eventFeedback"></div>'+
   '<button type="submit" id="addEvent">'+(editEvent?'Update event':dirty?'Add event to draft':'Add &amp; publish event')+'</button></form>';
}
function editEventMessage(message){$('eventFeedback').textContent=message}
function updateEventFields(){
 const goal=$('type').value==='goal',ownGoal=$('type').value==='own goal';
 const assist=$('assist');
 $('assistPicker').hidden=!goal;assist.disabled=!goal;
 if(!goal){
  assist.value='';
  if($('newEventPlayer').dataset.pick==='assist'&&!$('newEventPlayer').hidden)closeEventPlayer(false);
 }
 const team=state.clubs[chooseClub(eventSide)]?.squadName||eventSide;
 const opponent=[match().home,match().away].find(side=>side!==eventSide);
 const credited=state.clubs[chooseClub(opponent)]?.squadName||opponent;
 $('eventScoringHint').textContent=ownGoal?'Pick the player from '+team+'. The goal counts for '+credited+'.':'Players listed for '+team+'.';
}
function openEventPlayer(pick){
 const editor=$('newEventPlayer');
 editor.dataset.pick=pick;
 editor.hidden=false;
 $('newEventPlayerName').value='';
 editEventMessage('');
 $('newEventPlayerName').focus();
}
function closeEventPlayer(refocus=true){
 const editor=$('newEventPlayer'),pick=editor.dataset.pick;
 editor.hidden=true;
 $('newEventPlayerName').value='';
 if(refocus)root.querySelector('[data-new-event-player="'+pick+'"]')?.focus();
}
function addEventPlayer(){
 const name=$('newEventPlayerName').value.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!name||name.length>70){editEventMessage('Enter a player name of up to 70 characters.');return}
 const registered=players(eventSide);
 const known=[...registered,...pendingEventPlayers].find(p=>collator.compare(p,name)===0);
 const selected=known||name;
 if(!known){
  if(registered.length>=80){editEventMessage('This squad is full. It can contain up to 80 players.');return}
  pendingEventPlayers.add(selected);
 }
 const pick=$('newEventPlayer').dataset.pick;
 for(const id of ['player','assist']){
  if(![...$(id).options].some(option=>option.value===selected))$(id).add(new Option(selected,selected));
 }
 $(pick).value=selected;
 closeEventPlayer(false);
 $(pick).focus();
 editEventMessage(registered.includes(selected)?selected+' selected from the squad.':selected+' selected. Publish the event to save the player to the squad.');
}

function matchView(){const m=match();if(!m)return '<button id="newMatch">Add fixture</button>';
 const sides=[m.home,m.away];if(!sides.includes(eventSide))eventSide=m.home;
 const recorded=m.events.find(x=>x.id===editEvent);
 const e={...recorded,player:recorded?.team===eventSide?recorded.player:'',assist:recorded?.team===eventSide?recorded.assist:'',minute:recorded?.minute??'',type:recorded?.type||'goal'};
 return matchList('live')+'<section class="card matchControl" id="matchControl" tabindex="-1"><div class="matchHeading">'+versus(m.home,m.away)+'<span class="score">'+(m.status==='scheduled'?'—':score(m))+'</span></div><p class="matchMeta"><span class="fixtureStatus" data-status="'+escape(m.status)+'">'+escape(m.status)+'</span> '+escape(m.round+' · '+m.kickoff+' · '+m.venue)+'</p>'+(m.status==='completed'?'':'<button id="matchClock">'+(m.status==='scheduled'?'Start match':'Finish match')+' &amp; publish</button>')+'</section>'+matchPanels()+'<div class="card" '+(livePanel==='timeline'?'':'hidden')+'><h3>Match timeline</h3><ol class="events">'+m.events.map(x=>'<li>'+escape([x.minute===''?'':x.minute+'′',eventIcons[x.type]+' '+x.type,x.team,x.player,x.assist?'assist '+x.assist:''].filter(Boolean).join(' · '))+' <button data-edit="'+escape(x.id)+'">Edit</button><button data-remove="'+escape(x.id)+'">Remove</button></li>').join('')+(m.events.length?'':'<li>No events recorded yet.</li>')+'</ol></div><div class="card" '+(livePanel==='logging'?'':'hidden')+'><h3>Ref logging</h3><div class="eventTeamButtons">'+sides.map(side=>'<button data-event-team="'+escape(side)+'" aria-pressed="'+(side===eventSide)+'">'+teamLabel(side)+'</button>').join('')+'</div>'+eventForm(e)+'</div><div class="card" id="startingLineups" tabindex="-1" '+(livePanel==='lineups'?'':'hidden')+'><h3>Starting lineups</h3><div class="grid">'+sides.map((n,i)=>'<div><h4>'+teamLabel(n)+'</h4>'+select('Formation','shape-'+i,['Unannounced','2-3-1','3-2-1','2-2-1','2-1-1','4-3-3','4-4-2','3-5-2','4-2-3-1'],m.formations?.[n]||'Unannounced')+'<p class="hint">Drag a jersey or focus it and use the arrow keys to position a player.</p>'+shirtPitch(n,pitchPoints(m.lineups[n]||[],m.formations?.[n],m.positions?.[n]),escape,i)+'<label>Starter name<input id="starter-'+i+'" maxlength="70"></label><button type="button" data-starter="'+i+'">Add starter</button>'+[...new Set([...players(n),...(m.lineups[n]||[])])].map(v=>'<label class="check"><input type="checkbox" data-line="'+i+'" value="'+escape(v)+'" '+((m.lineups[n]||[]).includes(v)?'checked':'')+'>'+escape(v)+'</label>').join('')+(!players(n).length?'':'')+'</div>').join('')+'</div></div>'}
function capture(el){
 const k=el.id,v=el.value;
 if(tab==='Teams & squads'&&k==='scenePlayer'){(state.clubs[club].scene??={}).player=v.trim()}
 else if(tab==='Navigation'&&k.startsWith('menu-'))state.menu[k.slice(5)]=v;
 else if(tab==='Homepage'&&['title','description'].includes(k))state.features[feature][k]=v;
 else if(tab==='Teams & squads'&&['title','kit','bio','players'].includes(k))state.clubs[club][k]=k==='players'?v.split('\n').map(n=>n.trim()).filter(Boolean):v;
 else if(['Fixtures','Live matches'].includes(tab)&&['home','away','round','kickoff','venue','status','stream'].includes(k)){
  const m=match();if(['home','away'].includes(k)&&v!==m[k]){if(m.status!=='scheduled'||m.events.length||Object.values(m.lineups).some(a=>a.length)||Object.keys(m.formations||{}).length||Object.keys(m.positions||{}).length){say('Clubs can change only on a scheduled fixture with no events or lineup setup.');el.value=m[k];return}if(v===m[k==='home'?'away':'home']){say('Choose two different clubs.');el.value=m[k];return}}
  if(k==='status'&&v==='scheduled'&&m.events.length){say('A match with events must be live or completed.');el.value=m.status;return}m[k]=v;
 }else return;
 changed();
}
root.addEventListener('input',e=>{if(e.target.matches('input:not([type=file]):not([type=checkbox]),textarea'))capture(e.target)});
root.addEventListener('change',async e=>{const el=e.target,v=el.value;
 if(el.dataset.scene&&el.files[0]){
  const c=state.clubs[club],kind=el.dataset.scene,file=el.files[0];
  busy=true;root.querySelector('.layout').inert=true;$('publish').disabled=true;
  try{
   if(file.size>(kind==='clip'?16:3)*1024*1024)throw Error(kind==='clip'?'Choose an MP4 under 16 MB.':'Choose a still under 3 MB.');
   const r=await deskFetch(kind==='clip'?'api/clip':'api/upload',{method:'POST',body:file});
   const d=await r.json();if(!r.ok)throw Error(d.error);
   (c.scene??={})[kind]=d.path;changed();render();say('Media attached to draft.');
  }catch(err){say(err.message)}finally{busy=false;root.querySelector('.layout').inert=false;$('publish').disabled=!dirty}
  return;
 }
 if(el.id.startsWith('shape-')){const m=match(),side=[m.home,m.away][Number(el.id.slice(-1))];m.formations??={};if(m.positions)delete m.positions[side];if(v==='Unannounced')delete m.formations[side];else m.formations[side]=v;changed();render();return}
 if(el.id==='upload'&&el.files[0]){
 const target=tab==='Homepage'?state.features[feature]:state.clubs[club];try{const file=el.files[0];if(file.size>3145728)throw Error('Choose a file under 3 MB.');const r=await deskFetch('api/upload',{method:'POST',body:file});const d=await r.json();if(!r.ok)throw Error(d.error);target.image=d.path;changed();render();say('Image uploaded. Publish changes to use it.')}catch(err){say(err.message)}return}
 if(el.id==='type'){updateEventFields();editEventMessage('');return}
 if(el.id==='club'){club=v;editingPlayer=null;}else if(el.id==='feature')feature=v==='Season 26'?0:1;else if(el.id==='fixture'){matchId=v;editEvent=null;eventSide=null}
 else if(el.dataset.line!==undefined){const m=match(),side=[m.home,m.away][+el.dataset.line],a=m.lineups[side]||[];if(el.checked&&a.length===11){el.checked=false;say('Select up to eleven starters.');return}if(!el.checked && m.positions?.[side])m.positions[side]=m.positions[side].filter(p=>p.name!==v);m.lineups[side]=el.checked?[...a,v]:a.filter(n=>n!==v);changed()}
 else if(el.tagName==='SELECT'){capture(el);if(!['status','home','away'].includes(el.id))return}else return;
 render();
});
function focusSection(target){
 const el=root.querySelector(target);if(!el)return;
 el.focus({preventScroll:true});el.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function syncMatchRoute(section){
 if(!inline)return;
 history.replaceState(null,'','#ref/'+encodeURIComponent(matchId)+'?section='+section);
 window.dispatchEvent(new Event('boltz-ref-lineup'));
}
root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||busy)return;
 const card=b.closest('[data-club-card]');if(card)club=card.dataset.clubCard;
 if(b.dataset.match){matchId=b.dataset.match;editEvent=null;eventSide=null;syncMatchRoute(b.dataset.section);render();focusSection(b.dataset.section==='live'?'#matchControl':'.fixtureActions');return}
 if(b.dataset.panel){livePanel=b.dataset.panel;render();root.querySelector('[data-panel="'+livePanel+'"]')?.focus({preventScroll:true});return}
 if(b.dataset.eventTeam){
  if(eventSide===b.dataset.eventTeam)return;
  const type=$('type').value, minute=$('minute').value;
  eventSide=b.dataset.eventTeam;livePanel='logging';render();
  $('type').value=type;$('minute').value=minute;updateEventFields();$('player').focus({preventScroll:true});return;
 }
 if(b.dataset.newEventPlayer){openEventPlayer(b.dataset.newEventPlayer);return}
 if(b.id==='addNameToEvent'){addEventPlayer();return}
 if(b.id==='cancelEventPlayer'){closeEventPlayer();editEventMessage('');return}

 if(b.id==='openMatch'){livePanel='logging';if(inline){location.hash='ref/'+encodeURIComponent(matchId)+'?section=live';return}tab='Live matches';editEvent=null;render();return}
 if(b.hasAttribute('data-open-squad-lineup')){
  matchId=card.querySelector('[data-squad-fixture]').value;livePanel='lineups';syncMatchRoute('live');eventSide=club+' FC';editEvent=null;tab='Live matches';render();
  focusSection('#startingLineups');return;
 }
 if(b.id==='matchClock'){
  const m=match();
  if(!m||m.status==='completed')return;
  m.status=m.status==='scheduled'?'live':'completed';changed();render();await publishDraft();return;
 }
 if(b.id==='applyOfficialFixtures'){
  if(dirty){say('Publish or reload the current draft before applying the official fixture correction.');return}
  const result=window.boltzOfficialS26?.reconcile(state.matches);
  if(!result?.changes.length){say('The official opening fixtures are already current, or require manual review.');return}
  if(!confirm('Update '+result.changes.length+' unplayed fixtures to the official 21 November programme? Existing match activity, squads and archives will be preserved.'))return;
  state.matches=result.matches;
  changed();render();await publishDraft();return;
 }
 if(b.id==='reloadRecords'){
  if(dirty&&!confirm('Discard these unpublished changes and reload the last saved records?'))return;
  try{await start();say('Loaded published records.')}catch(err){say(err.message)}return;
 }
 if(b.id==='resetSeason'){
  if(dirty){say('Save or discard the current draft before staging a reset.');return}
  if(prompt('Restore the Season 26 opening fixtures and clear match activity? Squads and club details stay intact. Type RESET SEASON to stage this change.')!=='RESET SEASON')return;
  changed();restoreSeasonStart=true;
  say('Reset staged. Publish changes to restore the opening fixtures, or reload published records to cancel.');
  return;
 }
 if(b.id==='deleteFixture'){
  const m=match();
  if(!confirm('Delete '+m.round+' · '+m.home+' v '+m.away+' with its lineup and timeline?'))return;
  state.matches=state.matches.filter(n=>n.id!==m.id);matchId=state.matches[0]?.id;eventSide=null;editEvent=null;changed();render();say('Fixture removed from draft. Save changes to publish.');return;
 }
 if(b.hasAttribute('data-rename-player')){editingPlayer=b.dataset.renamePlayer;editingClub=club;render();rosterInput(club)?.focus();return}
 if(b.id==='cancelRename'){editingPlayer=null;render();return}
 if(b.hasAttribute('data-remove-player')){
  const name=b.dataset.removePlayer;
  if(!confirm('Remove '+name+' from '+club+' FC and its unfinished lineups?'))return;
  const saveNow=!dirty;
  if(editRoster(name,null)&&saveNow)await publishDraft();
  return;
 }
 if(b.id==='clearScene'){delete state.clubs[club].scene;changed();render();return}
 if(b.dataset.tab){tab=b.dataset.tab;editingPlayer=null;editEvent=null;say('');render();return}
 if(b.id==='newMatch'){if(state.matches.length>=150){say('Season fixture limit reached.');return}const m={id:crypto.randomUUID(),round:'Round 1',kickoff:'13:00',venue:'Pitch 1',home:'Stacey FC',away:'Foxes FC',status:'scheduled',events:[],lineups:{},stream:''};state.matches.push(m);matchId=m.id;tab='Fixtures';changed();render();return}
 if(b.dataset.remove){match().events=match().events.filter(x=>x.id!==b.dataset.remove);editEvent=null;changed();render();return}
 if(b.dataset.edit){livePanel='logging';editEvent=b.dataset.edit;eventSide=match().events.find(x=>x.id===editEvent).team;render();$('player').focus();return}
 if(b.id==='publish'||b.id==='dbSave'){await publishDraft()}
});
async function saveEvent(){
 const saveNow=!dirty&&!editEvent, m=match(), type=$('type').value;
 if(m.status==='scheduled'){editEventMessage('Start the match before logging an event.');return}
 if(!$('newEventPlayer').hidden){editEventMessage('Select the new player using Add and select, or cancel the entry.');return}
 const player=$('player').value, assist=type==='goal'?$('assist').value:'';
 const record=m.events.find(x=>x.id===editEvent&&x.team===eventSide);
 const registered=players(eventSide);
 const available=(name,field)=>registered.includes(name)||pendingEventPlayers.has(name)||record?.[field]===name;
 const minute=$('minute').value===''?'':Number($('minute').value);
 if(!player||!available(player,'player')||assist&&(!available(assist,'assist')||assist===player)){
  editEventMessage('Choose a player from this team and, if needed, a different player for the assist.');return;
 }
 if(minute!==''&&(!Number.isInteger(minute)||minute<0||minute>150)){
  editEventMessage('Enter a minute from 0 to 150, or leave it blank.');return;
 }
 if(!editEvent&&m.events.length>=300){editEventMessage('This match has reached the event limit.');return}
 const additions=[...new Set([player,assist])].filter(n=>pendingEventPlayers.has(n)&&!registered.includes(n));
 if(registered.length+additions.length>80){editEventMessage('This squad can contain up to 80 players.');return}
 const x={id:editEvent||crypto.randomUUID(),minute,type,team:eventSide,player,assist};
 const c=state.clubs[chooseClub(eventSide)];
 if(additions.length)c.players=[...registered,...additions].sort(collator.compare);
 if(editEvent)m.events[m.events.findIndex(y=>y.id===editEvent)]=x;else m.events.push(x);
 editEvent=null;changed();render();
 if(saveNow)await publishDraft();
 else say(additions.length?'Event and new player saved to draft. Publish changes to make them live.':'Event recorded in draft. Publish to update the match centre.');
}
async function publishDraft(){
 if(!dirty||busy)return;
 busy=true;$('publish').disabled=true;root.querySelector('.layout').inert=true;
 try{
  const resetting=restoreSeasonStart;
  const payload=resetting?{revision,restoreSeasonStart:true}:{revision,state};
  const r=await deskFetch('api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to save.');
  revision=d.revision;dirty=false;restoreSeasonStart=false;
  if(resetting){await start();say('Opening fixtures restored. All squads and club information were kept.');return;}
  notifyParent({type:'boltz-ref-dirty',dirty:false});notifyParent({type:'boltz-ref-published',revision});
  $('revision').textContent='Published · revision '+revision;
  if(tab==='Database control')render();
  if($('addEvent'))$('addEvent').textContent=editEvent?'Update event':'Add & publish event';
  say('Saved to the match centre.');
 }catch(err){say(err.message)}
 finally{busy=false;$('publish').disabled=!dirty;root.querySelector('.layout').inert=false}
}
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}},{signal:lifetime.signal});
function lockDesk(){
 $('revision').textContent='Locked';$('tabs').replaceChildren();$('publish').hidden=true;
 $('workspace').innerHTML='<form class="card loginCard" id="loginForm"><div class="eyebrow">MATCH OFFICIALS</div><h2>Referee sign-in</h2><label>Referee password<input id="refpass" type="password" autocomplete="current-password" required></label><button>Unlock match control</button></form>';
 $('loginForm').onsubmit=async e=>{e.preventDefault();try{const r=await deskFetch('api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('refpass').value})});const d=await r.json();$('refpass').value='';if(!r.ok)throw Error(d.error);await start()}catch(err){say(err.message)}};
}
async function start(){
 if(location.pathname.startsWith('/referee')){root.querySelector('header h1').textContent='Ref Area';document.title='Ref Area · Boltz League'}
 let publication;
 if(embedded){
   publication=await (inline ? window : window.parent).boltzRefReady();
   if(publication?.role!=='referee'||!publication.state)throw Error('Referee session unavailable. Open Ref Access to reconnect.');
   role=publication.role;
 }else{
   const access=await deskFetch('api/access').then(r=>r.json());
   role=access.role;
   if(role==='guest'){lockDesk();return}
   const response=await deskFetch('api/state');
   if(!response.ok)throw Error('Unable to load the season.');
   publication=await response.json();
 }
 state=publication.state;revision=publication.revision;dirty=false;restoreSeasonStart=false;
 notifyParent({type:'boltz-ref-dirty',dirty:false});$('publish').disabled=true;
 const requested=matchId || query.get('match');
 matchId=state.matches.find(m=>m.id===requested)?.id||state.matches.find(m=>m.status==='live')?.id||state.matches.find(m=>m.status==='scheduled')?.id||state.matches[0]?.id;
 $('publish').hidden=false;$('signout').hidden=embedded||role!=='referee';$('revision').textContent=(role==='owner'?'Owner':'Referee')+' · revision '+revision;say('');render();
}
$('signout').onclick=async()=>{if(dirty&&!confirm('Discard unpublished changes and lock?'))return;const r=await deskFetch('api/logout',{method:'POST'});if(r.ok){dirty=false;location.reload()}};

const shirtColours = {Stacey:'#8dc9ef', Angels:'#fafafa', CityMen:'#c42c35', Infinity:'#234eac', Foxes:'#e27419', Darkfang:'#292e35', Typhoon:'#257457'};
function pitchPoints(names, formation, saved = []) {
  const counts = formation ? [1,...formation.split('-').map(Number)] : [1,2,3,2,3];
  const rows = [];
  let used = 0;
  for (const count of counts) {
    const row = names.slice(used, used + count);
    if (row.length) rows.push(row);
    used += count;
  }
  if (used < names.length) rows.push(names.slice(used));
  return rows.flatMap((row,r) => row.map((name,i) => saved.find(p=>p.name===name) ||
    {name, x:100*(i+1)/(row.length+1), y:rows.length===1?50:85-r*70/(rows.length-1)}));
}
function shirtPitch(team, points, encode, editSide) {
  const editable = editSide !== undefined;
  const tag = editable ? 'button' : 'span';
  const shirt = '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M21 4 8 9 2 24 13 29 17 22 16 48 48 48 47 22 51 29 62 24 56 9 43 4Q32 14 21 4Z" fill="currentColor" stroke="#dee8ee" stroke-width="2"/><path d="M22 5Q32 17 42 5" fill="none" stroke="#66717a" stroke-width="2"/></svg>';
  return '<div class="jerseyPitch" style="--shirt:'+ (shirtColours[team.replace(/ FC$/,'')]||'#788bb7')+'">'+
    points.map(({name,x,y},i)=>'<'+tag+' class="jersey" '+(editable?'type="button" data-position="'+editSide+'" data-index="'+i+'" aria-label="Move '+encode(name)+'"':'')+' style="left:'+x+'%;top:'+y+'%">'+shirt+'<b>'+encode(name)+'</b></'+tag+'>').join('')+
    (points.length?'':'<span class="pitchEmpty">Lineup pending</span>')+'</div>';
}
root.addEventListener('click', e=>{
 const add=e.target.closest('[data-starter]');if(!add)return;
 const i=Number(add.dataset.starter), m=match(), side=[m.home,m.away][i];
 const value=$('starter-'+i).value.trim(), starters=m.lineups[side]||[];
 if(!value||starters.includes(value)||starters.length>=11){say('Enter a new name, up to eleven starters.');return}
 m.lineups[side]=[...starters,value];changed();render();
});
function positionJersey(el,x,y) {
 const m=match(),side=[m.home,m.away][Number(el.dataset.position)];
 const points=pitchPoints(m.lineups[side],m.formations?.[side],m.positions?.[side]);
 const point=points[Number(el.dataset.index)];
 point.x=Math.max(7,Math.min(93,Math.round(x)));point.y=Math.max(7,Math.min(93,Math.round(y)));
 m.positions??={};m.positions[side]=points;
 el.style.left=point.x+'%';el.style.top=point.y+'%';changed();
}
let moving;
root.addEventListener('pointerdown',e=>{
 const el=e.target.closest('button.jersey');if(!el||!e.isPrimary||e.button!==0)return;
 moving=el;el.setPointerCapture(e.pointerId);
});
root.addEventListener('pointermove',e=>{
 if(!moving?.hasPointerCapture(e.pointerId))return;
 const r=moving.parentElement.getBoundingClientRect();
 positionJersey(moving,100*(e.clientX-r.left)/r.width,100*(e.clientY-r.top)/r.height);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(event,()=>moving=null);
root.addEventListener('keydown',e=>{
 if(e.target.id==='newEventPlayerName'&&e.key==='Enter'&&!e.isComposing){
  e.preventDefault();if(!busy)addEventPlayer();return;
 }
 const el=e.target.closest('button.jersey');if(!el||!['ArrowLeft','ArrowRight','ArrowDown','ArrowUp'].includes(e.key))return;
 e.preventDefault();positionJersey(el,parseFloat(el.style.left)+(e.key==='ArrowRight'?2:e.key==='ArrowLeft'?-2:0),parseFloat(el.style.top)+(e.key==='ArrowDown'?2:e.key==='ArrowUp'?-2:0));
});

 const ready=start().catch(e=>{say(e.message);throw e});
 return {ready, dirty:()=>dirty, busy:()=>busy, destroy:()=>lifetime.abort(), navigate(section,id){
  tab=sectionTabs[section] || (id?'Live matches':sectionTabs.teams);
  if(id&&state.matches.some(m=>m.id===id))matchId=id;
  if(tab==='Live matches')livePanel='logging';
  editingPlayer=null;editEvent=null;eventSide=null;say('');render();
 }};
}
if(document.getElementById('workspace'))mountRefDesk(document,new URLSearchParams(location.search)).ready.catch(()=>{});
