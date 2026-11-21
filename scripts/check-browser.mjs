import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base='https://boltzleague.github.io/?browser-check='+Date.now();
const record=(label)=>console.log('PASS browser: '+label);
try{
 await page.setViewport({width:1365,height:930,deviceScaleFactor:1});
 await page.goto(base+'#matches',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('.fixtureDisclosure').length===21,{timeout:20000});
 record('21 fixture cards render');
 await page.waitForFunction(()=>['online','offline'].includes(document.querySelector('.leagueFeedNotice')?.dataset.connection),{timeout:16000});
 const feed=await page.$eval('.leagueFeedNotice',e=>e.dataset.connection);
 assert.equal(feed,'online','Live backend must be reachable in an actual browser');
 record('browser can access live backend using CORS');
 const counts=await page.evaluate(()=>({filters:[...document.querySelectorAll('.filters select')].map(e=>e.id),
  all:document.querySelectorAll('.fixtureDisclosure').length,
  bars:document.querySelectorAll('.fixtureDisclosure[data-match-state]').length,
  legend:document.querySelectorAll('.matchLegendItem').length}));
 for(const control of ['team','status','matchSort'])assert.ok(counts.filters.includes(control),'Missing filter: '+control);
 assert.equal(counts.bars,21);
 assert.equal(counts.legend,3);record('team/status/sort filters and coloured match bars');
 await page.select('#team','Typhoon');
 await page.waitForFunction(()=>document.querySelectorAll('.fixtureDisclosure').length===6,{timeout:8000});
 record('team filtering returns six round-robin fixtures');
 await page.select('#team','');
 await page.waitForFunction(()=>document.querySelectorAll('.fixtureDisclosure').length===21,{timeout:8000});
 const first=await page.$('.fixtureDisclosure summary');
 await first.click();
 await page.waitForSelector('.fixtureDisclosure[open] .jerseyPitch',{timeout:8000});
 const positions=await page.evaluate(()=>{
  const pitch=document.querySelector('.fixtureDisclosure[open] .jerseyPitch');
  return {outfield:pitch.querySelectorAll('.jersey:not(.keeperPlaceholder)').length,gk:pitch.querySelectorAll('.keeperPlaceholder').length};
 });
 assert.equal(positions.outfield,7);assert.equal(positions.gk,1);
 record('match expansion and eight-a-side lineup with GK placeholder');
 for(const hash of ['#home','#table','#stats','#clubs','#season']){
  await page.evaluate(hash=>{location.hash=hash},hash);
  await page.waitForFunction(hash=>location.hash===hash&&document.querySelector('#app')?.textContent.length>50,{timeout:8000},hash);
  record('page '+hash+' renders');
 }
 await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:1});
 await page.evaluate(()=>{location.hash='#matches'});
 await page.waitForFunction(()=>document.querySelectorAll('.fixtureDisclosure').length===21,{timeout:9000});
 record('mobile-width Match Centre renders');
 assert.deepEqual(errors,[],'Unexpected page runtime errors');
 record('no uncaught client-side script exceptions');
}finally{
 await browser.close();
}
