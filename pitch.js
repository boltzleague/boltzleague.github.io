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
  const clubName=team.replace(/ FC$/,'');
  const badge=Object.hasOwn(shirtColours,clubName)?'<image x="33" y="14" width="11" height="12" href="/assets/'+clubName+'.png"/>':'';
  const shirt = '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M21 4 8 9 2 24 13 29 17 22 16 48 48 48 47 22 51 29 62 24 56 9 43 4Q32 14 21 4Z" fill="currentColor" stroke="#dee8ee" stroke-width="2"/><path d="M22 5Q32 17 42 5" fill="none" stroke="#66717a" stroke-width="2"/>'+badge+'</svg>';
  return '<div class="jerseyPitch" style="--shirt:'+ (shirtColours[team.replace(/ FC$/,'')]||'#788bb7')+'">'+
    points.map(({name,x,y},i)=>'<'+tag+' class="jersey" '+(editable?'type="button" data-position="'+editSide+'" data-index="'+i+'" aria-label="Move '+encode(name)+'"':'')+' style="left:'+x+'%;top:'+y+'%">'+shirt+'<b>'+encode(name)+'</b></'+tag+'>').join('')+
    (points.length?'':'<span class="pitchEmpty">Lineup pending</span>')+'</div>';
}
