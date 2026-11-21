// Full referee match flow in a REAL browser, with the remote API intercepted.
// All mutations occur in this in-memory mock. Production results are NEVER written.
import puppeteer from 'puppeteer-core';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='https://boltzleague.github.io';
const backend='boltz-league-matchday.jpiyady.chatgpt.site';
const token='a'.repeat(72);
let state=JSON.parse(await readFile('assets/season-content.json','utf8'));
let revision=1,writeCount=0,rejectRefereeWrites=false;
const errors=[];
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
});
const page=await browser.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',async d=>{if(d.type()==='confirm')await d.accept();else await d.dismiss()});
await page.setRequestInterception(true);
const cors={'access-control-allow-origin':origin,'access-control-allow-headers':'Content-Type,X-Boltz-Client,X-Boltz-Session',
 'access-control-allow-methods':'GET,POST,PUT,OPTIONS','content-type':'application/json'};
function respond(req,status,obj){return req.respond({status,headers:cors,body:JSON.stringify(obj)})}
page.on('request',req=>{
 (async()=>{
  const url=new URL(req.url());
  if(url.hostname!==backend){await req.continue();return}
  const method=req.method(),path=url.pathname;
  if(method==='OPTIONS'){await req.respond({status:204,headers:cors,body:''});return}
  if(path==='/api/league'&&method==='GET'){await respond(req,200,{revision,state});return}
  if(path==='/referee/api/login'&&method==='POST'){await respond(req,200,{role:'referee',token,desk:{role:'referee',revision,state}});return}
  if(path==='/referee/api/ref-state'&&method==='GET'){
   await respond(req,200,req.headers()['x-boltz-session']===token?{role:'referee',revision,state}:{error:'unauthorized'});return}
  if(path==='/referee/api/state'&&method==='PUT'){
   if(rejectRefereeWrites){await respond(req,403,{error:'Invalid origin.'});return}
   const payload=JSON.parse(req.postData()||'{}');
   if(req.headers()['x-boltz-session']!==token){await respond(req,401,{error:'unauthorized'});return}
   if(payload.revision!==revision){await respond(req,409,{error:'stale revision'});return}
   if(!payload.state?.matches){await respond(req,422,{error:'invalid state'});return}
   state=payload.state;revision++;writeCount++;
   await respond(req,200,{revision});return;
  }
  if(path==='/referee/api/access'){await respond(req,200,{role:'referee'});return}
  await respond(req,404,{error:'Mock route not implemented: '+method+' '+path});
 })().catch(error=>{errors.push('mock: '+error.message);req.abort().catch(()=>{})});
});
const log=msg=>console.log('PASS simulated-referee: '+msg);
const clickShadow=async selector=>{
 const done=await page.evaluate(selector=>{
  const btn=document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector(selector);
  if(!btn)return false;btn.click();return true;
 },selector);
 assert.ok(done,'Missing referee control '+selector);
};
const waitSaved=async count=>page.waitForFunction(
  count=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'),
 {timeout:14000},count);
try{
 await page.goto(origin+'/?ref-simulation='+Date.now()+'#matches',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('.fixtureDisclosure').length===21);
 await page.click('#refAccess');
 await page.waitForSelector('#refLogin[open]');
 await page.type('#refLogin input[name=password]','mocked-credential-only');
 await page.click('#refLogin [type=submit]');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot);
 log('mock login opens the real Ref Access interface');
 await page.evaluate(()=>{location.hash='#ref?section=live'});
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelectorAll('.matchAccordion').length===21);
 await clickShadow('summary[data-accordion-match="s26-1"]');
 await page.waitForFunction(()=>!!document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#matchClock'));
 await clickShadow('#matchClock');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'));
 assert.equal(state.matches[0].status,'live');assert.equal(writeCount,1);
 log('Start Match PUT is saved, read back and verified as Live');
 await page.waitForFunction(()=>!!document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#player'));
 await page.evaluate(()=>{
  const root=document.querySelector('#refDeskPanel').shadowRoot;
  const player=root.querySelector('#player');player.value='Timo';player.dispatchEvent(new Event('change',{bubbles:true}));
  root.querySelector('#eventForm').requestSubmit();
 });
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'));
 assert.equal(writeCount,2);assert.equal(state.matches[0].events.length,1);assert.equal(state.matches[0].events[0].player,'Timo');
 log('Goal event automatically publishes and is verified');
 await clickShadow('#matchClock');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'));
 assert.equal(writeCount,3);assert.equal(state.matches[0].status,'completed');
 log('End Match publishes a completed result');
 await page.evaluate(()=>{location.hash='#matches'});
 await page.waitForFunction(()=>document.querySelector('.fixtureDisclosure[data-key="upcoming-s26-1"]')?.dataset.matchState==='completed');
 const card=await page.$eval('.fixtureDisclosure[data-key="upcoming-s26-1"]',e=>e.innerText);
 assert.ok(card.includes('1'));assert.ok(card.includes('FULL TIME'));
 log('public viewer displays the final match state and score');
 // Reproduce the user's production failure without modifying the real service.
 rejectRefereeWrites=true;
 await page.evaluate(()=>{location.hash='#ref?section=live'});
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelectorAll('.matchAccordion').length===21);
 await clickShadow('summary[data-accordion-match="s26-2"]');
 await page.waitForFunction(()=>!!document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#matchClock'));
 await clickShadow('#matchClock');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#saveNotice')?.textContent.includes('The server-side origin fix has not been deployed yet') ||
   document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#saveNotice')?.textContent.includes('server-side origin fix has not been deployed'),{timeout:10000});
 assert.equal(state.matches[1].status,'scheduled','Rejected write must not mutate the published backend');
 const draft=await page.evaluate(()=>{
  const root=document.querySelector('#refDeskPanel').shadowRoot;
  return {status:root.querySelector('#revision')?.textContent,
   warnings:[...root.querySelectorAll('[data-live-minute-id="s26-2"]')].map(e=>e.textContent)};
 });
 assert.ok(draft.status.includes('Unpublished changes — save failed'));
 assert.ok(draft.warnings.some(t=>t.includes('DRAFT')&&!t.includes('LIVE')));
 log('HTTP 403 keeps the match unpublished and clearly marks the local LIVE state as DRAFT');
 assert.deepEqual(errors,[]);
 log('no uncaught browser or mock API exceptions');
}finally{
 await browser.close();
}
