let centre = 0;
let returningToShowcase = false;
let gesture;
let suppressClick = false;
const showcase = document.querySelector('#showcase');
const stage = showcase.querySelector('.clubStage');
function clubImage(name) {
  return leagueState?.clubs[name]?.image || '/assets/club-' + name + '.webp';
}
function positionClubs() {
  const name = contenders[centre];
  [...stage.children].forEach((card, index) => {
    const offset = (index - centre + 10) % 7 - 3;
    card.style.setProperty('--offset', offset);
    card.dataset.distance = Math.abs(offset);
    card.tabIndex = offset === 0 ? 0 : -1;
    card.setAttribute('aria-label', (offset ? 'Centre ' : 'Open ') + contenders[index] + ' FC');
    card.inert = Math.abs(offset) > 2;
  });
  document.querySelector('#showClub').textContent = name + ' FC';
  document.querySelector('#viewClub').href = '#clubs/' + name;
}
function selectClub(index) {
  const old = centre;
  centre = (index + contenders.length) % contenders.length;
  positionClubs();
  if(old!==centre) playEffect();
}
function updateShowcase(page, detail) {
  showcase.hidden = !(page === 'home' || (page === 'clubs' && !detail));
  if (detail && page === 'clubs' && contenders.includes(detail)) centre = contenders.indexOf(detail);
  if (showcase.hidden) return;
  if (!stage.childElementCount) {
    contenders.forEach((name, index) => {
      const card = document.createElement('button');
      card.className = 'showCard';
      const img = new Image();
      img.alt = ''; img.draggable = false;
      card.append(img);
      card.onclick = () => {
        if (suppressClick) return;
        if (index !== centre) { selectClub(index); stage.focus({preventScroll:true}); }
        else openProfile();
      };
      stage.append(card);
    });
  }
  [...stage.children].forEach((card, i) => {
    const src = clubImage(contenders[i]);
    if (card.firstChild.getAttribute('src') !== src) card.firstChild.src = src;
  });
  positionClubs();
}
function openProfile() {
  returningToShowcase = page === 'home';
  location.hash = 'clubs/' + contenders[centre];
}
showcase.querySelector('#viewClub').onclick = () => { returningToShowcase = page === 'home'; };
showcase.querySelectorAll('[data-step]').forEach(b => b.onclick = () => selectClub(centre + Number(b.dataset.step)));
stage.onkeydown = event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); selectClub(centre + (event.key === 'ArrowLeft' ? -1 : 1)); stage.focus();
  } else if (event.key === 'Enter' && event.target === stage) openProfile();
};
stage.onpointerdown = e => {
  if (!e.isPrimary || e.button !== 0) return;
  gesture = {id:e.pointerId, x:e.clientX, y:e.clientY, start:e.timeStamp, drag:false};
  suppressClick = false;
};
stage.onpointermove = e => {
  if (gesture?.id !== e.pointerId) return;
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  if (!gesture.drag && Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) {gesture = null; return;}
  if (!gesture.drag && Math.abs(dx) < 6) return;
  gesture.drag = true; stage.setPointerCapture(e.pointerId);
  stage.classList.add('dragging');
  stage.style.setProperty('--drag', Math.max(-160,Math.min(160,dx * .58)) + 'px');
  stage.style.setProperty('--stretch', 1 + Math.min(Math.abs(dx)/2000,.065));
};
function release(e) {
  if (gesture?.id !== e.pointerId) return;
  const dx = e.clientX - gesture.x;
  if (gesture.drag) {
    suppressClick = true;
    if (e.type !== 'pointercancel' && (Math.abs(dx)>stage.clientWidth*.09 || (Math.abs(dx)>16 && Math.abs(dx)/Math.max(1,e.timeStamp-gesture.start)>.35))) selectClub(centre-Math.sign(dx));
    stage.classList.remove('dragging');
    stage.style.removeProperty('--drag'); stage.style.removeProperty('--stretch');
    setTimeout(()=>{suppressClick=false},0);
  }
  gesture = null;
}
stage.onpointerup = stage.onpointercancel = release;
function installCrestLoop() {
  const rail = document.querySelector('#clubrail');
  const group = document.createElement('div');
  group.className = 'crestGroup'; group.append(...rail.childNodes);
  const clone = group.cloneNode(true);
  clone.setAttribute('aria-hidden','true'); clone.querySelectorAll('a').forEach(a=>a.tabIndex=-1);
  rail.append(group,clone);
}
const profileMotion=matchMedia('(prefers-reduced-motion: reduce)');
let profileVideo=null, profileOnScreen=false;
function updateProfilePlayback(){
 const v=profileVideo;if(!v)return;
 if(!profileOnScreen||document.hidden||profileMotion.matches||v.error){
  v.pause();v.hidden=true;return;
 }
 if(!v.getAttribute('src'))v.src=v.dataset.src;
 v.play().catch(()=>{if(v.paused)v.hidden=true});
}
const visibleProfiles=new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.target===profileVideo?.parentElement){
  profileOnScreen=entry.isIntersecting && entry.intersectionRatio>0;
  updateProfilePlayback();
 }
});
profileMotion.addEventListener('change',updateProfilePlayback);
document.addEventListener('visibilitychange',updateProfilePlayback);
function observeProfile(){
 visibleProfiles.disconnect();
 if(profileVideo)profileVideo.pause();
 profileOnScreen=false;profileVideo=document.querySelector('.profileFilm video');
 if(!profileVideo)return;
 const v=profileVideo;
 v.onplaying=()=>{v.hidden=v!==profileVideo||!profileOnScreen||document.hidden||profileMotion.matches};
 v.onerror=()=>{v.hidden=true};
 visibleProfiles.observe(v.parentElement);
}
const modes = showcase.querySelector('.effectModes');
function setEffect(name) {
 const button=[...modes.children].find(b=>b.dataset.effect===name);
 stage.dataset.effect=button?.dataset.effect||'Drum';
 for(const b of modes.children)b.setAttribute('aria-pressed',String(b.dataset.effect===stage.dataset.effect));
}
setEffect(localStorage.getItem('boltz-carousel-effect'));
modes.addEventListener('click',e=>{
 const b=e.target.closest('[data-effect]');if(!b)return;
 setEffect(b.dataset.effect);localStorage.setItem('boltz-carousel-effect',b.dataset.effect);selectClub(centre+1);
});
function playEffect() {
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const mode=stage.dataset.effect,card=stage.children[centre],img=card.firstChild;
 if(mode==='Drum'||mode==='Bulge'||mode==='Stretch'){
 const transform={Drum:'rotateY(22deg) scale(.96)',Bulge:'scale(1.16,1.06)',Stretch:'scale(1.09,.96)'}[mode];
 img.animate([{transform},{transform:'none'}],{duration:520,easing:'cubic-bezier(.18,.75,.24,1)'});
 return;
 }
 const rows=mode==='Dust'?8:4,cols=mode==='Dust'?7:4;
 const overlay=document.createElement('div');overlay.className='fragments';overlay.setAttribute('aria-hidden','true');
 card.querySelector('.fragments')?.remove();card.append(overlay);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
 const piece=document.createElement('i');piece.style.clipPath='inset('+100*y/rows+'% '+100*(cols-x-1)/cols+'% '+100*(rows-y-1)/rows+'% '+100*x/cols+'%)';
 piece.style.backgroundImage='url("'+img.src+'")';overlay.append(piece);
 piece.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translate('+((x-cols/2)*14)+'px,'+(-22-y*5)+'px) rotate('+((x-y)*4)+'deg)'}],{duration:510,delay:(x+y)*8,fill:'forwards',easing:'ease-out'});
 }
 overlay.animate([{opacity:1},{opacity:0}],{duration:700}).finished.then(()=>overlay.remove());
}
