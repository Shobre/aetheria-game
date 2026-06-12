import { Input } from './systems/input.js';
import { Game } from './systems/game.js';
import { SaveSystem } from './systems/save.js';

const canvas=document.getElementById('game-canvas');
const input=new Input(canvas);
const game=new Game(canvas,input);
window.GAME=game;

function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden'); }
function fmtTime(ms){ const s=Math.floor(ms/1000),m=Math.floor(s/60); return m+'m '+(s%60)+'s'; }
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }

// ---- save slots ----
function renderSlots(){
  const wrap=document.getElementById('save-slots'); wrap.innerHTML='';
  for(const {slot,data} of SaveSystem.listSlots()){
    const btn=document.createElement('button'); btn.className='save-slot';
    if(data){
      btn.innerHTML=`<div class="sl-title">SLOT ${slot}</div>
        <div class="sl-info">LV ${data.level} &nbsp; ${data.hpMax} HP<br>
          GOLD ${data.gold}<br>${fmtTime((data.playtime||0)*1000)}<br>
          <span style="color:#667">${fmtDate(data.savedAt)}</span></div>
        <span class="sl-del" title="Delete">🗑</span>`;
      btn.querySelector('.sl-del').onclick=(e)=>{ e.stopPropagation();
        if(confirm('Delete save in slot '+slot+'?')){ SaveSystem.delete(slot); renderSlots(); } };
      btn.onclick=()=>launch(SaveSystem.getSlot(slot));
    } else {
      btn.innerHTML=`<div class="sl-title">SLOT ${slot}</div><div class="sl-empty">— EMPTY —<br><br>Click to start<br>a new game</div>`;
      btn.onclick=()=>launch(SaveSystem.newGame(slot));
    }
    wrap.appendChild(btn);
  }
}
function launch(state){ show('game-container'); game.resize(); game.start(state); applySettings(); }

// ---- settings ----
const settingsModal=document.getElementById('settings-modal');
const bagModal=document.getElementById('bag-modal');
const charModal=document.getElementById('char-modal');
const skillsModal=document.getElementById('skills-modal');
const questsModal=document.getElementById('quests-modal');
const shopModal=document.getElementById('shop-modal');
function applySettings(){
  game.settings.shake=document.getElementById('set-shake').checked;
  game.settings.minimap=document.getElementById('set-minimap').checked;
  game.settings.fps=document.getElementById('set-fps').checked;
  game.audio.musicVol=document.getElementById('set-music').value/100;
  game.audio.sfxVol=document.getElementById('set-sfx').value/100;
  if(game.audio.applyMusicVol) game.audio.applyMusicVol();
}
['set-shake','set-minimap','set-fps','set-music','set-sfx'].forEach(id=>{
  const el=document.getElementById(id); if(el) el.addEventListener('input',applySettings); });

function anyModalOpen(){ return [settingsModal,bagModal,charModal,skillsModal,questsModal,shopModal]
  .some(m=>!m.classList.contains('hidden')); }
function openModal(m){ game.paused=true; m.classList.remove('hidden'); m.classList.add('flex'); }
function closeModal(m){ m.classList.add('hidden'); m.classList.remove('flex');
  if(!anyModalOpen() && !document.getElementById('death-screen').classList.contains('flex')) game.paused=false; }
function closeAll(){ [settingsModal,bagModal,charModal,skillsModal,questsModal,shopModal].forEach(m=>{
  m.classList.add('hidden'); m.classList.remove('flex'); });
  if(!document.getElementById('death-screen').classList.contains('flex')) game.paused=false; }

function openChar(){ game.hud.refreshChar(); game.hud.refreshBag(); openModal(charModal); }
function openSkills(){ game.hud.refreshSkills(); openModal(skillsModal); }
function openBag(){ game.hud.refreshBag(); openModal(bagModal); }
function openQuests(){ game.hud.refreshQuests(); openModal(questsModal); }

document.getElementById('settings-btn').onclick=()=>openModal(settingsModal);
document.getElementById('bag-btn').onclick=openBag;
document.getElementById('char-btn').onclick=openChar;
document.getElementById('skills-btn').onclick=openSkills;
document.getElementById('quests-btn').onclick=openQuests;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(document.getElementById(b.dataset.close)));
document.getElementById('shop-close').onclick=()=>closeModal(shopModal);
document.getElementById('save-game-btn').onclick=()=>game.save();
document.getElementById('quit-btn').onclick=()=>{ if(confirm('Quit to menu? (save first!)')) game.quitToMenu(); };
document.getElementById('respawn-btn').onclick=()=>game.respawn();

document.getElementById('spell-q').onclick=()=>game.toast('Press Q — Fireball (10 MP)');
document.getElementById('spell-e').onclick=()=>game.toast('Press E — Ice Shard (15 MP)');

// ---- global keys ----
window.addEventListener('keydown', e=>{
  if(game.running===false) return;
  const k=e.key.toLowerCase();
  if(k==='escape'){ if(anyModalOpen()) closeAll(); else openModal(settingsModal); return; }
  // toggle modals
  if(k==='b'){ bagModal.classList.contains('hidden')?openBag():closeModal(bagModal); }
  if(k==='c'){ charModal.classList.contains('hidden')?openChar():closeModal(charModal); }
  if(k==='k'){ skillsModal.classList.contains('hidden')?openSkills():closeModal(skillsModal); }
  if(k==='j'){ questsModal.classList.contains('hidden')?openQuests():closeModal(questsModal); }
  // hotbar 1-9 (only when not in a menu)
  if(/^[1-9]$/.test(k) && !game.paused) game.useHotbar(parseInt(k)-1);
});

window.addEventListener('resize', ()=>game.resize());
window.addEventListener('blur', ()=>{ if(game.running && !anyModalOpen()) game.paused=true; });
window.addEventListener('focus', ()=>{ if(game.running && !anyModalOpen() &&
  !document.getElementById('death-screen').classList.contains('flex')) game.paused=false; });

window.addEventListener('load', ()=>{ setTimeout(()=>{ renderSlots(); show('start-screen'); },700); });
