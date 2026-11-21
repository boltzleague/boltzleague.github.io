(() => {
 const pagesHost = location.origin === 'https://boltzleague.github.io';
 const service = pagesHost ? 'https://boltz-league-matchday.jpiyady.chatgpt.site' : location.origin;
 const route = () => /^#ref(?:[/?]|$)/.test(location.hash);
 const storageKey = 'boltz-league/ref-session';
 const shell = document.getElementById('refWorkspace');
 const entry = document.getElementById('refAccess');
 const logout = document.getElementById('refLogout');
 const formDialog = document.getElementById('refLogin');
 const form = formDialog.querySelector('form');
 const password = form.elements.password;
 const feedback = form.querySelector('[role=status]');
 let signedIn = false, token = '', desk, panel, lastTarget, initialState;
 function setToken(value) {
  token=value;
  try { if(value)sessionStorage.setItem(storageKey,value);else sessionStorage.removeItem(storageKey); } catch {}
 }
 try {token=sessionStorage.getItem(storageKey)||''} catch {}
 function ask() {
  warmEditor().catch(()=>{});feedback.textContent = ''; password.value = '';
  if (!formDialog.open) formDialog.showModal();
  password.focus();
 }
 async function api(path, options = {}) {
  if (!['api/access','api/ref-state','api/state','api/login','api/logout'].includes(path)) throw Error('Unknown match control action.');
  const headers = new Headers(options.headers);
  headers.set('X-Boltz-Client','match-centre');
  if(token)headers.set('X-Boltz-Session',token);
  const response = await fetch(service+'/referee/'+path, {...options,headers,credentials:pagesHost?'omit':'same-origin',cache:'no-store'});
  if (path==='api/state' && options.method==='PUT' && response.ok) window.syncLeague?.();
  return response;
 }
 window.boltzRefFetch = api;
 async function readDesk() {
  const res=await api('api/ref-state');
  if(res.status===401)throw Object.assign(Error('Your referee session has expired. Sign in to continue.'),{expired:true});
  if(!res.ok)throw Error('Could not load match controls. Try again.');
  const data=await res.json();
  if(data.role!=='referee'||!data.state||!Number.isInteger(data.revision))throw Error('The match service could not confirm the referee session.');
  return data;
 }

 // Fill and publish blanks after an authorized referee connects.
 // Never store credentials in source or change non-lineup match fields.
 async function autoStoreLineups(publication,attempt=0) {
  if(publication?.role!=='referee'||!publication.state||!Number.isInteger(publication.revision))return publication;
  const factory=window.boltzLineupTemplates;
  if(!factory||!Array.isArray(publication.state.matches))return publication;
  const matches=publication.state.matches;
  const proposed=factory.seedMissing(matches,publication.state.clubs);
  const affected=proposed.reduce((count,m,i)=>count+(m!==matches[i]?1:0),0);
  if(!affected){
   window.boltzLineupAutoSave={status:'current'};
   return publication;
  }
  let acknowledged=null;
  let updated=null;
  try{
   updated={...publication.state,matches:proposed};
   const res=await api('api/state',{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({revision:publication.revision,state:updated})
   });
   if(res.status===409 && attempt<1)return autoStoreLineups(await readDesk(),attempt+1);
   const answer=await res.json().catch(()=>({}));
   if(!res.ok||!Number.isInteger(answer.revision))throw Error(answer.error||'The live database did not confirm the update.');
   acknowledged=answer.revision;
   const verified=await readDesk();
   const missing=verified.state.matches.some(m=>{
    const source=updated.matches.find(x=>x.id===m.id);
    if(!source)return false;
    return [m.home,m.away].some(side=>(source.lineups?.[side]?.length||0)>0 &&
         !(m.lineups?.[side]?.length));
   });
   if(missing)throw Error('The referee service has not confirmed every lineup.');
   window.boltzLineupAutoSave={status:'saved',fixtures:affected,revision:verified.revision};
   return verified;
  }catch(error){
   window.boltzLineupAutoSave={status:'failed',reason:String(error?.message||'Unable to save missing lineups.')};
   console.warn('Boltz lineup automatic save could not be verified:',error);
   // The PUT may already have succeeded even if the final read-back failed.
   // Retain the acknowledged revision to avoid reverting to stale data.
   if(acknowledged!==null)return {...publication,state:updated,revision:acknowledged};
   return publication;
  }
 }
 window.boltzRefReady = async () => {
  if(initialState){const state=initialState;initialState=null;return state}
  try{return await readDesk()}catch(error){if(error.expired){disconnect();ask();feedback.textContent=error.message}throw error}
 };
 const moduleURL=new URL('ref-desk/studio.js?v=26.9',document.baseURI);
 const cssURL=new URL('ref-desk/studio.css?v=26.8',document.baseURI);
 let editorModule;
 function warmEditor(){return editorModule??=import(moduleURL.href).catch(error=>{editorModule=null;throw error})}
 password.enterKeyHint='go';
 function show() {
  const active = route();
  shell.hidden = !active;
  document.body.classList.toggle('in-ref',active);
  document.body.classList.toggle('ref-active',signedIn);
  entry.textContent = signedIn?'Ref desk':'Ref Access';
  logout.hidden = !signedIn;
  if (!active) return;
  document.getElementById('refLocked').hidden = signedIn;
  const target = location.hash;
  if(!signedIn || (panel && lastTarget===target))return;
  lastTarget=target;
  const [path,search='']=target.split('?');
  let id='';try{id=decodeURIComponent(path.slice(5))}catch{}
  const params=new URLSearchParams(search);
  if(id)params.set('match',id);
  if(desk){const current=desk;current.ready.then(()=>{if(desk===current&&lastTarget===target)current.navigate(params.get('section'),id)}).catch(()=>{});return}
  if(panel)return;
  panel=document.createElement('div');panel.id='refDeskPanel';shell.append(panel);
  const host=panel, root=host.attachShadow({mode:'open'});
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=cssURL.href;
  root.append(sheet);
  const body=document.createElement('div');body.className='embedded inlineDesk';
  body.innerHTML="<main><div class=\"toolbar\"><strong>Season 26</strong><span id=\"revision\">Connecting\u2026</span><button id=\"publish\" disabled>Publish changes \u2197</button></div><div class=\"layout\"><nav aria-label=\"Studio sections\" id=\"tabs\"></nav><section><div id=\"feedback\" role=\"status\"></div><div id=\"workspace\">Loading season records\u2026</div></section></div></main><button id=\"signout\" hidden></button>";
  root.append(body);
  warmEditor().then(({mountRefDesk})=>{
   if(panel!==host)return;
   const latest=new URLSearchParams(lastTarget.split('?')[1]||'');
   const raw=lastTarget.split('?')[0].slice(5);if(raw)latest.set('match',decodeURIComponent(raw));
   desk=mountRefDesk(root,latest,true);return desk.ready;
  }).catch(()=>{if(panel===host){body.textContent='Could not load the referee controls. ';const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>{desk?.destroy();desk=null;panel.remove();panel=null;show()};body.append(retry)}});
 }
 function disconnect() {
  signedIn=false;setToken('');initialState=null;desk?.destroy();desk=null;panel?.remove();panel=null;lastTarget=undefined;
  show();
 }
 entry.addEventListener('click',e=>{e.preventDefault();if(signedIn){location.hash='ref';show()}else ask()});
 document.getElementById('refUnlock').onclick=ask;
 formDialog.querySelector('[data-cancel]').onclick=()=>formDialog.close();
 formDialog.addEventListener('close',()=>{password.value=''});
 form.onsubmit=async e=>{
  e.preventDefault();const submit=form.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;submit.textContent='Signing in…';
  feedback.textContent='Checking password…';
  try {
   const res=await api('api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password.value})});
   const result=await res.json();if(!res.ok || result.role!=='referee')throw Error(result.error||'Sign-in failed.');
   if(!/^[a-f0-9-]{72}$/.test(result.token||''))throw Error('Could not start the referee session.');
   setToken(result.token);
   const publication=result.desk?.role==='referee'&&result.desk.state&&Number.isInteger(result.desk.revision)?result.desk:await readDesk();
   initialState=await autoStoreLineups(publication);signedIn=true;formDialog.close();
   if(!route())location.hash='ref';show();
  }catch(err){if(err.expired)setToken('');feedback.textContent=err.message;password.select()}finally{submit.disabled=false;submit.textContent='Sign in'}
 };
 logout.onclick=async()=>{
  if(desk?.dirty() && !confirm('Discard unpublished changes and log out?'))return;
  try{const res=await api('api/logout',{method:'POST'});if(!res.ok)throw Error();disconnect();location.hash='matches'}
  catch{alert('Could not log out. Please try again.')}
 };
 window.addEventListener('boltz-ref-lineup',()=>{lastTarget=location.hash});
 window.addEventListener('hashchange',show);
 show();
 if(token){
  const restoring=token;
  readDesk().then(async data=>{
   if(token!==restoring||signedIn)return;
   data=await autoStoreLineups(data);
   if(token!==restoring||signedIn)return;
   initialState=data;signedIn=true;show();
   if(formDialog.open)formDialog.close();
  }).catch(err=>{if(err.expired&&token===restoring)setToken('')});
 }
})();
