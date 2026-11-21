// Read-only production smoke checks. No referee credentials or writes are used.
import {readFileSync} from 'node:fs';
const origin='https://boltzleague.github.io';
const backend='https://boltz-league-matchday.jpiyady.chatgpt.site';
const results=[];
const record=(name,ok,message)=>{results.push({name,ok,message});console.log((ok?'PASS':'FAIL')+' '+name+': '+message)};
const get=async(url,options={})=>{
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),...options});
 const type=response.headers.get('content-type')||'';
 const cors=response.headers.get('access-control-allow-origin')||'';
 return {response,type,cors};
};
const allowed=(value)=>value==='*'||value===origin;
async function checkPages(){
 const expected=readFileSync('index.html','utf8');
 const scripts=['ref-access.js','published.js'];
 const signatures=scripts.map(name=>{
  const match=expected.match(new RegExp(name.replace('.','\\.')+'\\?v=[\\d.]+'));
  if(!match)throw Error('Cannot find local script version: '+name);
  return match[0];
 });
 let last='not reached';
 for(let i=0;i<9;i++){
  try{
   const {response,type}=await get(origin+'/?smoke='+Date.now());
   if(!response.ok){last='HTTP '+response.status;continue}
   const html=await response.text();
   if(signatures.every(x=>html.includes(x))){
    record('GitHub Pages',true,'HTTP '+response.status+' '+type+'; published build '+signatures.join(', '));
    return;
   }
   last='HTTP '+response.status+'; deployment still propagating '+signatures.join(', ');
  }catch(error){last=String(error)}
  if(i<8)await new Promise(resolve=>setTimeout(resolve,5000));
 }
 record('GitHub Pages',false,last);
}
async function checkPublicFeed(){
 try{
  const {response,type,cors}=await get(backend+'/api/league?smoke='+Date.now(),{
   headers:{Accept:'application/json',Origin:origin}});
  let shape=false,count=0;
  if(response.ok&&type.includes('json')){
   const data=await response.json();
   shape=Number.isInteger(data?.revision)&&Array.isArray(data?.state?.matches);
   count=data?.state?.matches?.length||0;
   if(shape){
    const statusCounts={scheduled:0,live:0,completed:0,other:0};
    for(const m of data.state.matches)statusCounts[m.status]===undefined?statusCounts.other++:statusCounts[m.status]++;
    console.log('LIVE DATABASE SNAPSHOT: revision='+data.revision+' statuses='+JSON.stringify(statusCounts));
    console.log('LIVE MATCHES: '+JSON.stringify(data.state.matches.filter(m=>m.status==='live').map(m=>({id:m.id,home:m.home,away:m.away,goals:(m.events||[]).filter(e=>e.type==='goal'||e.type==='own goal').length}))));
   }
  }
  record('Public live-feed API',response.ok&&shape,
   'HTTP '+response.status+'; type='+type+'; fixtures='+count);
  record('Live-feed browser CORS',allowed(cors),
   'Access-Control-Allow-Origin='+JSON.stringify(cors||'(absent)'));
 }catch(error){record('Public live-feed API',false,String(error))}
}
async function checkRefereePreflight(){
 try{
  const {response,cors}=await get(backend+'/referee/api/state',{
   method:'OPTIONS',
   headers:{
    Origin:origin,
    'Access-Control-Request-Method':'PUT',
    'Access-Control-Request-Headers':'content-type,x-boltz-client,x-boltz-session'
   }
  });
  const methods=(response.headers.get('access-control-allow-methods')||'').toLowerCase();
  const headers=(response.headers.get('access-control-allow-headers')||'').toLowerCase();
  const allowHeaders=headers.includes('*')||['content-type','x-boltz-client','x-boltz-session'].every(x=>headers.includes(x));
  const ok=response.ok&&allowed(cors)&&methods.includes('put')&&allowHeaders;
  record('Referee PUT preflight',ok,'HTTP '+response.status+'; origin='+JSON.stringify(cors||'(absent)')+
   '; methods='+JSON.stringify(methods)+'; headers='+JSON.stringify(headers));
 }catch(error){record('Referee PUT preflight',false,String(error))}
}
await Promise.all([checkPages(),checkPublicFeed(),checkRefereePreflight()]);
const failed=results.filter(x=>!x.ok);
console.log('\nSUMMARY: '+(results.length-failed.length)+'/'+results.length+' read-only checks passed.');
if(failed.length){
 console.log('This check never attempts authenticated writes. A failing backend check requires the backend hosting/service CORS or access configuration to be investigated.');
 process.exitCode=1;
}
