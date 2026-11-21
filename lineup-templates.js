/* Boltz League: deterministic 8-a-side visual templates.
   The GK jersey is a display-only placeholder; it is not a registered player. */
(function(){
 'use strict';
 const shapes=['2-3-2','3-2-2','2-2-3'];
 const hash=value=>{let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
 function build(clubs,team){
  const key=team.replace(/ FC$/,'');
  const roster=[...new Set(clubs?.[key]?.players||[])].filter(Boolean);
  const captain=roster.find(name=>/\(C\)/i.test(name));
  const pool=roster.filter(name=>name!==captain).sort((a,b)=>hash(key+'|'+a)-hash(key+'|'+b)||a.localeCompare(b));
  const selected=[...(captain?[captain]:[]),...pool.slice(0,captain?6:7)];
  const shape=shapes[hash(key)%shapes.length];
  const counts=shape.split('-').map(Number);
  const centreRowStart=counts[0],centre=Math.floor(counts[1]/2);
  if(captain&&selected.length>=7){
   const from=selected.indexOf(captain),to=centreRowStart+centre;
   [selected[from],selected[to]]=[selected[to],selected[from]];
  }
  const yRows=[23,49,72];
  const positions=[];let cursor=0;
  for(let i=0;i<counts.length;i++){
   for(let j=0;j<counts[i];j++){
    const name=selected[cursor++];if(!name)break;
    positions.push({name,x:Math.round(100*(j+1)/(counts[i]+1)),y:yRows[i]});
   }
  }
  return {lineup:selected,formation:shape,positions,captain:captain||null};
 }
 function seedMissing(matches,clubs,{overwrite=false}={}){
  const established=new Map();
  // Prefer a full, registered lineup already configured by a referee.
  // Never replace a nonempty lineup without an explicit overwrite request.
  for(const m of matches)for(const team of [m.home,m.away]){
   if(established.has(team))continue;
   const registered=new Set(clubs?.[team.replace(/ FC$/,'')]?.players||[]);
   const names=m.lineups?.[team];
   const captain=[...registered].find(n=>/\(C\)/i.test(n));
   if(!Array.isArray(names)||names.length!==7||
      names.some(n=>!registered.has(n))||
      new Set(names).size!==7||(captain&&!names.includes(captain)))continue;
   const fallback=build(clubs,team);
   const points=m.positions?.[team];
   established.set(team,{
    lineup:[...names],
    formation:m.formations?.[team]||fallback.formation,
    positions:Array.isArray(points)&&points.length===7&&
      points.every(p=>names.includes(p.name)&&Number.isFinite(p.x)&&Number.isFinite(p.y))
       ?points.map(p=>({...p}))
       :fallback.positions.map((p,i)=>({...p,name:names[i]}))
   });
  }
  return matches.map(m=>{
   let row=m;
   for(const team of [m.home,m.away]){
    if(!overwrite&&(m.lineups?.[team]?.length))continue;
    const template=established.get(team)||build(clubs,team);
    if(template.lineup.length<7)continue;
    if(row===m)row={...m,lineups:{...(m.lineups||{})},formations:{...(m.formations||{})},positions:{...(m.positions||{})}};
    row.lineups[team]=[...template.lineup];
    row.formations[team]=template.formation;
    row.positions[team]=template.positions.map(p=>({...p}));
   }
   return row;
  });
 }
 window.boltzLineupTemplates={build,seedMissing};
})();
