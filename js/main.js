import { Input } from './systems/input.js';
import { Game } from './systems/game.js';
import { SaveSystem } from './systems/save.js';

const canvas = document.getElementById('game-canvas');
const input = new Input(canvas);
const game = new Game(canvas, input);
window.GAME = game; // debug handle

function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden'); }

function fmtTime(ms){ const s=Math.floor(ms/1000); const m=Math.floor(s/60); return m+'m '+(s%60)+'s'; }
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString()+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }

// ---- build save slot cards ----
function renderSlots(){
  const wrap=document.getElementById('save-slots'); wrap.innerHTML='';
  for(const {slot,data} of SaveSystem.listSlots()){
    const btn=document.createElement('button'); btn.className='save-slot';
    if(data){
      btn.innerHTML=`
        <div class="sl-title">SLOT ${slot}</div>
        <div class="sl-info">
          LV ${data.level} &nbsp; ${data.hpMax} HP<br>
          GOLD ${data.gold}<br>
          ${fmtTime(data.playtime*1000||0)}<br>
          <span style="color:#667">${fmtDate(data.savedAt)}</span>
        </div>
        <span class="sl-del" title="Delete">🗑</span>`;
      btn.querySelector('.sl-del').onclick=(e)=>{ e.stopPropagation();
        if(confirm('Delete save in slot '+slot+'?')){ SaveSystem.delete(slot); renderSlots(); } };
      btn.onclick=()=> launch(SaveSystem.getSlot(slot));
    } else {
      btn.innerHTML=`<div class="sl-title">SLOT ${slot}</div><div class="sl-empty">— EMPTY —<br><br>Click to start<br>a new game</div>`;
      btn.onclick=()=> launch(SaveSystem.newGame(slot));
    }
    wrap.appendChild(btn);
  }
}

function launch(state){
  show('game-container');
  game.resize();
  game.start(state);
  // apply current settings
  applySettings();
}

// ---- settings ----
const settingsModal=document.getElementById('settings-modal');
const bagModal=document.getElementById('bag-modal');
function applySettings(){
  game.settings.shake=document.getElementById('set-shake').checked;
  game.settings.minimap=document.getElementById('set-minimap').checked;
  game.settings.fps=document.getElementById('set-fps').checked;
  game.audio.musicVol=document.getElementById('set-music').value/100;
  game.audio.sfxVol=document.getElementById('set-sfx').value/100;
  document.getElementById('minimap-fps');
}
['set-shake','set-minimap','set-fps','set-music','set-sfx'].forEach(id=>{
  const el=document.getElementById(id); if(el) el.addEventListener('input', applySettings);
});

function openModal(m){ game.paused=true; m.classList.remove('hidden'); m.classList.add('flex'); }
function closeModal(m){ m.classList.add('hidden'); m.classList.remove('flex');
  if(!document.getElementById('death-screen').classList.contains('flex')) game.paused=false; }

document.getElementById('settings-btn').onclick=()=> openModal(settingsModal);
document.getElementById('bag-btn').onclick=()=>{ game.hud.refreshBag(); openModal(bagModal); };
document.querySelectorAll('[data-close]').forEach(b=> b.onclick=()=>
  closeModal(document.getElementById(b.dataset.close)));
document.getElementById('save-game-btn').onclick=()=> game.save();
document.getElementById('quit-btn').onclick=()=>{ if(confirm('Quit to menu? (save first!)')) game.quitToMenu(); };
document.getElementById('respawn-btn').onclick=()=> game.respawn();

// spell slot click hint
document.getElementById('spell-q').onclick=()=> game.toast('Press Q to cast Fireball (10 MP)');
document.getElementById('spell-e').onclick=()=> game.toast('Press E to cast Ice Shard (15 MP)');

// ---- global keys ----
window.addEventListener('keydown', e=>{
  if(game.running===false) return;
  const k=e.key.toLowerCase();
  if(k==='escape'){
    if(!settingsModal.classList.contains('hidden')) closeModal(settingsModal);
    else if(!bagModal.classList.contains('hidden')) closeModal(bagModal);
    else openModal(settingsModal);
  }
  if(k==='b'){
    if(!bagModal.classList.contains('hidden')) closeModal(bagModal);
    else { game.hud.refreshBag(); openModal(bagModal); }
  }
  // number keys 1-9 -> hotbar
  if(/^[1-9]$/.test(k) && !game.paused) game.useHotbar(parseInt(k)-1);
});

window.addEventListener('resize', ()=> game.resize());

// ---- boot ----
window.addEventListener('load', ()=>{
  setTimeout(()=>{ renderSlots(); show('start-screen'); }, 700);
});
