// Real browser, gateway, Studio worker and isolated SQLite database.
// Production requests are intercepted; no production records are written.
import puppeteer from 'puppeteer-core';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHarness} from '../.backend/service/scripts/sqlite-harness.mjs';
const origin='https://boltzleague.github.io';
const backend='boltz-league-matchday.jpiyady.chatgpt.site';

let state=JSON.parse(await readFile('assets/season-content.json','utf8'));
const harness=createHarness(state);
state=harness.snapshot().state;
let revision=0,writeCount=0,rejectRefereeWrites=false;
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
  if(path==='/referee/api/state'&&method==='PUT'&&rejectRefereeWrites){await respond(req,403,{error:'Invalid origin.'});return}
  const response=await harness.fetch(new Request(req.url(),{method,headers:req.headers(),body:['GET','HEAD'].includes(method)?undefined:req.postData()}));
  if(method==='PUT'&&response.ok)writeCount++;
  ({revision,state}=harness.snapshot());
  await req.respond({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 })().catch(error=>{errors.push('mock: '+error.message);req.abort().catch(()=>{})});
});
const log=msg=>console.log('PASS worker-integration: '+msg);
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
 await page.type('#refLogin input[name=password]',harness.password);
 await page.click('#refLogin [type=submit]');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot);
 log('isolated login opens the real Ref Access interface');
 await page.evaluate(()=>{location.hash='#ref?section=live'});
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelectorAll('.matchAccordion').length===21);
 await clickShadow('summary[data-accordion-match="s26-1"]');
 await page.waitForFunction(()=>!!document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#matchClock'));
 await clickShadow('#matchClock');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'));
 assert.equal(state.matches[0].status,'live');assert.ok(writeCount>=1);
 log('Start Match PUT is saved, read back and verified as Live');
 await page.waitForFunction(()=>!!document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#player'));
 const actionLabel=await page.evaluate(()=>document.querySelector('#refDeskPanel').shadowRoot.querySelector('#addEvent')?.textContent.trim());
 assert.match(actionLabel,/Push to Live/,'Match event action must say Push to Live');
 log('Push to Live action appears in referee logging');
 await page.evaluate(()=>{
  const root=document.querySelector('#refDeskPanel').shadowRoot;
  const player=root.querySelector('#player');player.value='Timo';player.dispatchEvent(new Event('change',{bubbles:true}));
  const assist=root.querySelector('#assist');assist.value='Ahmed';assist.dispatchEvent(new Event('change',{bubbles:true}));
  root.querySelector('#eventForm').requestSubmit();
 });
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'));
 assert.equal(state.matches[0].events.length,1);assert.equal(state.matches[0].events[0].player,'Timo');
 assert.equal(state.matches[0].events[0].assist,'Ahmed');
 log('Home goal with assist automatically publishes and verifies');
 await clickShadow('[data-event-team="CityMen FC"]');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('[data-event-team="CityMen FC"]')?.getAttribute('aria-pressed')==='true');
 await page.evaluate(()=>{
  const root=document.querySelector('#refDeskPanel').shadowRoot;
  const player=root.querySelector('#player');player.value='Abz';player.dispatchEvent(new Event('change',{bubbles:true}));
  root.querySelector('#eventForm').requestSubmit();
 });
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'));
 assert.equal(state.matches[0].events.length,2,'Second away goal should publish');
 assert.equal(state.matches[0].events[1].team,'CityMen FC');
 log('Away goal automatically publishes and verifies');
 await clickShadow('#matchClock');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#revision')?.textContent.includes('Verified published'));
 assert.equal(state.matches[0].status,'completed');
 log('End Match publishes a completed result');
 await page.waitForFunction(()=>document.querySelector('#refDeskPanel')?.shadowRoot?.querySelector('#saveNotice')?.hidden===true,{timeout:8000});
 log('verified success notice dismisses automatically');
 await page.evaluate(()=>{location.hash='#matches'});
 await page.waitForFunction(()=>document.querySelector('.fixtureDisclosure[data-key="upcoming-s26-1"]')?.dataset.matchState==='completed');
 const card=await page.$eval('.fixtureDisclosure[data-key="upcoming-s26-1"]',e=>e.innerText);
 assert.ok(card.includes('1'));assert.ok(card.includes('FULL TIME'));
 await page.click('.fixtureDisclosure[data-key="upcoming-s26-1"] summary');
 await page.waitForFunction(()=>!!document.querySelector('.fixtureDisclosure[data-key="upcoming-s26-1"] .timelineAway .timelineGoal'));
 const timeline=await page.evaluate(()=>{
  const el=document.querySelector('.fixtureDisclosure[data-key="upcoming-s26-1"]');
  return {rows:el.querySelectorAll('.matchTimelineRow').length,
   home:el.querySelector('.timelineHome .timelineGoal')?.textContent,
   away:el.querySelector('.timelineAway .timelineGoal')?.textContent,
   assist:el.querySelector('.timelineHome .timelineAssist')?.textContent,
   boot:!!el.querySelector('.timelineHome .timelineBoot')};
 });
 assert.equal(timeline.rows,2);
 assert.ok(timeline.home.includes('Timo'));
 assert.ok(timeline.away.includes('Abz'));
 assert.ok(timeline.assist.includes('Ahmed'));
 assert.ok(timeline.boot,'Assist boot must appear under home scorer');
 log('viewer aligns goals home/away and nests the assist under scorer');
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
 harness.close();
}
