import { Input } from './systems/input.js';
import { Game } from './systems/game.js';
import { SaveSystem } from './systems/save.js';
import { KeybindUI } from './ui/keybinds.js';
// Sprint 11: kick off the sprite-atlas loads once on boot. Decoding is
// async; the draw helper falls through to canvas primitives when the
// atlas isn't ready yet, so the first frame is just as fast as before.
import { loadAllAtlases, setUseAtlases } from './systems/sprite-atlas.js';


import { tursoInit, tursoListSlots, tursoLoad, tursoSave, tursoDelete, tursoRegister, tursoLogin } from './systems/turso.js';

// ---- Auth system ----
const AUTH_KEY = 'aetheria_auth';
function getAuth(){ try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'{}');}catch{return{}} }
function setAuth(a){ localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }

// Wire login screen
const loginScreen=document.getElementById('login-screen');
const startScreen=document.getElementById('start-screen');
function showLogin(){ show('login-screen'); }
function showStart(){ show('start-screen'); }

// Auto-login if we have a stored session
const auth=getAuth();
if(auth.username){
  // Still show login but pre-fill
  const u=document.getElementById('login-user');
  if(u) u.value=auth.username;
}

document.getElementById('login-btn').addEventListener('click', async ()=>{
  const u=document.getElementById('login-user').value.trim().toLowerCase();
  const p=document.getElementById('login-pass').value.trim();
  const err=document.getElementById('login-error');
  if(!u){ err.textContent='Enter a username'; err.classList.remove('hidden'); return; }
  if(p.length<3){ err.textContent='Password must be 3+ chars'; err.classList.remove('hidden'); return; }
  err.textContent='Connecting...'; err.classList.remove('hidden');
  const hash = btoa(u+':'+p);
  // Try to register first, then login
  const reg = await tursoRegister(u, hash);
  if(reg && reg.error) { err.textContent='DB error: '+reg.error; return; }
  const ok = await tursoLogin(u, hash);
  if(!ok){ err.textContent='Login failed'; err.classList.remove('hidden'); return; }
  setAuth({username:u, hash});
  err.classList.add('hidden');
  renderSlotsWithAuth(u);
  showStart();
});

// ---- Tab switching ----
document.querySelectorAll('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Update tab active state
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    // Show the right form
    const target = tab.dataset.tab;
    document.querySelectorAll('.login-form').forEach(f => f.classList.add('hidden'));
    document.getElementById(target).classList.remove('hidden');
    // Clear errors
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('signup-error').classList.add('hidden');
  });
});

// ---- Sign up handler ----
document.getElementById('signup-btn').addEventListener('click', async () => {
  const u = document.getElementById('signup-user').value.trim().toLowerCase();
  const p = document.getElementById('signup-pass').value.trim();
  const p2 = document.getElementById('signup-pass2').value.trim();
  const err = document.getElementById('signup-error');
  if (!u) { err.textContent = 'Enter a username'; err.classList.remove('hidden'); return; }
  if (u.length < 2) { err.textContent = 'Username must be 2+ chars'; err.classList.remove('hidden'); return; }
  if (p.length < 3) { err.textContent = 'Password must be 3+ chars'; err.classList.remove('hidden'); return; }
  if (p !== p2) { err.textContent = 'Passwords do not match'; err.classList.remove('hidden'); return; }
  err.textContent = 'Creating account...'; err.classList.remove('hidden');
  const hash = btoa(u + ':' + p);
  // Try to register
  const reg = await tursoRegister(u, hash);
  if (reg && reg.error) {
    // If user already exists, try login
    const ok = await tursoLogin(u, hash);
    if (!ok) { err.textContent = 'Account already exists with different password'; return; }
  }
  setAuth({username: u, hash});
  err.classList.add('hidden');
  renderSlotsWithAuth(u);
  showStart();
});

// ---- per-user save slots ----
function usernameKey(username){ return 'aetheria_saves_v2_user_'+username; }

SaveSystem._allForUser=function(username){
  try{ return JSON.parse(localStorage.getItem(usernameKey(username)))||{}; }
  catch{ return {}; }
};
SaveSystem.getSlotUser=function(username,n){ return this._allForUser(username)[n]||null; };
SaveSystem.listSlotsUser=function(username){
  const all=this._allForUser(username);
  return [1,2,3].map(n=>({slot:n,data:all[n]||null}));
};
SaveSystem.saveUser=function(username,n,state){
  const all=this._allForUser(username);
  all[n]={...state,savedAt:Date.now(),version:2};
  localStorage.setItem(usernameKey(username),JSON.stringify(all));
};
SaveSystem.deleteUser=function(username,n){
  const all=this._allForUser(username);
  delete all[n];
  localStorage.setItem(usernameKey(username),JSON.stringify(all));
};
SaveSystem.newGameUser=function(username,n){
  const state=this.newGame(n);
  this.saveUser(username,n,state);
  return state;
};

const canvas=document.getElementById('game-canvas');
const input=new Input(canvas);
const game=new Game(canvas,input);
window.GAME=game;
// Sprint 11: restore the user's atlas-toggle preference (default ON), then
// start loading both atlases. The loader is async, so this is fire-and-forget.
try{
  const pref = localStorage.getItem('aetheria_atlases_v1');
  setUseAtlases(pref == null ? true : pref === '1');
}catch(e){ setUseAtlases(true); }
loadAllAtlases();

// Sprint 7: mount the keybind rebind UI inside the Settings modal.
// Reads localStorage on mount, writes whenever a user rebinds anything.
KeybindUI.mount({
  input,
  container: document.getElementById('keybinds-list'),
  hintEl:    document.getElementById('keybinds-hint'),
  resetBtn:  document.getElementById('keybinds-reset'),
});

// Expose the override helpers for Game to round-trip bindings through saves.
// The rebind UI owns localStorage; Game.start() writes the loaded overrides
// back to localStorage so the next mount picks them up. setKeybindOverrides
// is the explicit programmatic setter (used by the rebind UI itself).
window.__keybinds = { get: getKeybindOverrides, set: setKeybindOverrides, applyToInput: KeybindUI.applyOverridesToInput, refresh: KeybindUI.refresh };

function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden'); }
function fmtTime(ms){ const s=Math.floor(ms/1000),m=Math.floor(s/60); return m+'m '+(s%60)+'s'; }
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }

// ---- save slots ----
async function renderSlotsWithAuth(username){
  const wrap=document.getElementById('save-slots'); wrap.innerHTML='';
  if(username) wrap.dataset.user=username;
  // Show loading state
  wrap.innerHTML='<div style="color:#889;text-align:center;padding:20px">Loading saves...</div>';
  // Fetch cloud slots
  let cloudSlots = [];
  try { cloudSlots = await tursoListSlots(username); } catch(e){}
  // Build slot data from local + cloud
  const localSlots = SaveSystem.listSlotsUser(username);
  wrap.innerHTML='';
  for(let i=0;i<3;i++){
    const slot=i+1;
    const local = localSlots[i] ? localSlots[i].data : null;
    const cloud = cloudSlots.find(c=>c[0]==slot);
    const data = local || (cloud ? {slot, savedAt:cloud[1], cloudOnly:true} : null);
    const btn=document.createElement('button'); btn.className='save-slot';
    if(data && !data.cloudOnly){
      btn.innerHTML=`<div class="sl-title">SLOT ${slot}</div>
        <div class="sl-info">LV ${data.level} &nbsp; ${data.hpMax} HP<br>
          GOLD ${data.gold}<br>${fmtTime((data.playtime||0)*1000)}<br>
          <span style="color:#667">${fmtDate(data.savedAt)}</span></div>
        <span class="sl-del" title="Delete">🗑</span>`;
      btn.querySelector('.sl-del').onclick=(e)=>{ e.stopPropagation();
        if(confirm('Delete?')){ cloudDelete(username,slot); renderSlotsWithAuth(username); } };
      btn.onclick=()=>cloudLoad(username,slot).then(s=>launchUser(s,username));
    } else if(data && data.cloudOnly){
      btn.innerHTML=`<div class="sl-title">SLOT ${slot}</div>
        <div class="sl-info" style="color:#8af">☁ Cloud Save<br>
          <span style="color:#667">${fmtDate(data.savedAt)}</span></div>`;
      btn.onclick=()=>cloudLoad(username,slot).then(s=>launchUser(s,username));
    } else {
      btn.innerHTML=`<div class="sl-title">SLOT ${slot}</div><div class="sl-empty">— EMPTY —<br><br>Click to start<br>a new game</div>`;
      btn.onclick=()=>{ const s=SaveSystem.newGameUser(username,slot); cloudSave(username,slot,s); launchUser(s,username); };
      // Reset keybinds to whatever localStorage currently has (preserves the
      // device's existing rebinds, in case a previous user bound them oddly).
    }
    wrap.appendChild(btn);
  }
}
// Cloud sync: save to both localStorage and Turso (falls back to local-only)
async function cloudSave(username, slot, state){
  SaveSystem.saveUser(username, slot, state);
  try {
    const r = await tursoSave(username, slot, state);
    if (r && r.localOnly) console.log('Cloud unavailable - saved locally');
  } catch(e){ console.warn('cloud save failed', e); }
}
async function cloudLoad(username, slot){
  const local = SaveSystem.getSlotUser(username, slot);
  try {
    const cloud = await tursoLoad(username, slot);
    if(cloud && (!local || (cloud.savedAt||0) > (local.savedAt||0))){
      SaveSystem.saveUser(username, slot, cloud);
      return cloud;
    }
  } catch(e){ console.warn('cloud load failed', e); }
  return local;
}
// Note: tursoLoad returns null when cloud is unavailable, so local is used automatically
async function cloudDelete(username, slot){
  SaveSystem.deleteUser(username, slot);
  try { await tursoDelete(username, slot); } catch(e){ console.warn('cloud delete failed', e); }
}

function launchUser(state,username){
  show('game-container'); game.resize();
  // Apply saved keybind overrides BEFORE game.start() so the Input instance
  // sees them when Player + Game read bindings in their constructors.
  if(state && state.keybinds && typeof state.keybinds === 'object'){
    if(window.__keybinds){ window.__keybinds.set(state.keybinds); window.__keybinds.applyToInput(); }
  }
  game.start(state); game._username=username; applySettings();
  // Sprint 9: restore the heartbeat preference from localStorage. The DOM
  // checkbox may already be set by applySettings() if applySettings ran
  // after start, but we want to honor the saved preference on every load.
  try{
    const hbPref = localStorage.getItem('aetheria_heartbeat_v1');
    if(hbPref != null && game.audio && game.audio.setHeartbeatEnabled){
      game.audio.setHeartbeatEnabled(hbPref === '1');
      const cb=document.getElementById('set-heartbeat');
      if(cb) cb.checked = (hbPref === '1');
    }
  }catch(e){}
  // Sprint 11: also restore the atlas-toggle preference on every load.
  // The localStorage value was already read at module-init time (before
  // launchUser), so setUseAtlases() is already correct. We just sync
  // the checkbox so the user can see it on the next Settings open.
  try{
    const atPref = localStorage.getItem('aetheria_atlases_v1');
    if(atPref != null){
      const cb=document.getElementById('set-atlases');
      if(cb) cb.checked = (atPref === '1');
    }
  }catch(e){}
}
function launch(state){ show('game-container'); game.resize(); game.start(state); applySettings(); }

// ---- settings ----
const settingsModal=document.getElementById('settings-modal');
const bagModal=document.getElementById('bag-modal');
const charModal=document.getElementById('char-modal');
const skillsModal=document.getElementById('skills-modal');
const questsModal=document.getElementById('quests-modal');
const achievementsModal=document.getElementById('achievements-modal');
const shopModal=document.getElementById('shop-modal');
const stashModal=document.getElementById('stash-modal');
const craftModal=document.getElementById('craft-modal');
const enchantModal=document.getElementById('enchant-modal');
function applySettings(){
  game.settings.shake=document.getElementById('set-shake').checked;
  const sm=document.getElementById('set-minimap'); if(sm) game.settings.minimap=sm.checked;
  game.settings.fps=document.getElementById('set-fps').checked;
  game.audio.musicVol=document.getElementById('set-music').value/100;
  game.audio.sfxVol=document.getElementById('set-sfx').value/100;
  if(game.audio.applyMusicVol) game.audio.applyMusicVol();
  // Sprint 9: heartbeat toggle
  const hb=document.getElementById('set-heartbeat');
  if(hb && game.audio.setHeartbeatEnabled){
    game.audio.setHeartbeatEnabled(hb.checked);
    try{ localStorage.setItem('aetheria_heartbeat_v1', hb.checked ? '1' : '0'); }catch(e){}
  }
  // Sprint 11: atlas toggle
  const at=document.getElementById('set-atlases');
  if(at){
    setUseAtlases(at.checked);
    try{ localStorage.setItem('aetheria_atlases_v1', at.checked ? '1' : '0'); }catch(e){}
  }
}
['set-shake','set-fps','set-music','set-sfx','set-heartbeat','set-atlases'].forEach(id=>{
  const el=document.getElementById(id); if(el) el.addEventListener('input',applySettings); });

function anyModalOpen(){ return [settingsModal,bagModal,charModal,skillsModal,questsModal,achievementsModal,shopModal,stashModal,craftModal,enchantModal,document.getElementById('fullmap-modal'),document.getElementById('combat-log-modal')]
  .some(m=>!m.classList.contains('hidden')); }
function openModal(m){ game.paused=true; m.classList.remove('hidden'); m.classList.add('flex'); }
function closeModal(m){ m.classList.add('hidden'); m.classList.remove('flex');
  if(game.hud) game.hud._hideTooltip();
  if(!anyModalOpen() && !document.getElementById('death-screen').classList.contains('flex')) game.paused=false; }
function closeAll(){ [settingsModal,bagModal,charModal,skillsModal,questsModal,achievementsModal,shopModal,stashModal,craftModal,enchantModal,document.getElementById('fullmap-modal'),document.getElementById('combat-log-modal')].forEach(m=>{
  m.classList.add('hidden'); m.classList.remove('flex'); });
  if(game.hud) game.hud._hideTooltip();
  if(!document.getElementById('death-screen').classList.contains('flex')) game.paused=false; }

function openChar(){ game.hud.refreshChar(); game.hud.refreshBag(); openModal(charModal); }
function openSkills(){ game.hud.refreshSkills(); openModal(skillsModal); }
function openBag(){ game.hud.refreshBag(); openModal(bagModal); }
function openQuests(){ game.hud.refreshQuests(); openModal(questsModal); }
function openAchievements(){ game.hud.refreshAchievements(); openModal(achievementsModal); }

document.getElementById('settings-btn').onclick=()=>openModal(settingsModal);
document.getElementById('bag-btn').onclick=openBag;
document.getElementById('map-btn').onclick=()=>{ if(!game.hud) return; const fm=document.getElementById('fullmap-modal'); if(fm.classList.contains('hidden')){ game.hud.showFullMap(); openModal(fm); } else closeModal(fm); };
document.getElementById('char-btn').onclick=openChar;
document.getElementById('skills-btn').onclick=openSkills;
document.getElementById('quests-btn').onclick=openQuests;
document.getElementById('achieve-btn').onclick=openAchievements;
document.getElementById('log-btn').onclick=()=>{ const cl=document.getElementById('combat-log-modal');
  if(cl.classList.contains('hidden')) openModal(cl); else closeModal(cl); };
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(document.getElementById(b.dataset.close)));
document.getElementById('shop-close').onclick=()=>closeModal(shopModal);
document.getElementById('save-game-btn').onclick=()=>{
  const uname=game._username;
  if(uname){ cloudSave(uname, game.slot, game._buildState()); }
  else game.save();
};
// Sprint 10: tutorial reset button. Clears both the localStorage flag and
// the in-memory tutorial, so the next Game.start() will run it from the top.
document.getElementById('tutorial-reset').addEventListener('click', ()=>{
  if(!game || !game.tutorial) return;
  game.tutorial.reset();
  if(game._tutorialFlag) game._tutorialFlag.ackWelcome = true;  // don't double-pop the welcome card
  try { localStorage.removeItem('aetheria_tutorial_v1'); } catch(e){}
});
// (quit-btn click is wired once further down in this file — the canonical
// handler near the bottom registers via .onclick=. This early addEventListener
// was a duplicate that got silently overridden by the later .onclick=, so we
// drop it. Keep the start-screen behavior consistent: logout does NOT show
// start-screen, regular quit does.)
document.getElementById('logout-btn').addEventListener('click', ()=>{
  if(confirm('Logout? Unsaved progress may be lost.')){
    game.quitToMenu();
    localStorage.removeItem('aetheria_auth');
    show('login-screen');
    document.getElementById('login-user').value='';
    document.getElementById('login-pass').value='';
  }
});
document.getElementById('respawn-btn').onclick=()=>game.respawn();
document.getElementById('town-btn').onclick=()=>{ if(game.canTeleportTown && game.canTeleportTown()) game.teleportToTown(); };

// ---- global keys ----
window.addEventListener('keydown', e=>{
  if(game.running===false) return;
  const k=(e.key||'').toLowerCase();
  // Modal toggles — bound to action ids so a Settings rebind actually works.
  if(game.input.wasPressed('settings')){
    if(anyModalOpen()) closeAll(); else openModal(settingsModal);
    if(game.hud) game.hud._hideTooltip(); return;
  }
  if(game.input.wasPressed('toggle_bag')){
    bagModal.classList.contains('hidden')?openBag():closeModal(bagModal);
  }
  if(game.input.wasPressed('toggle_char')){
    charModal.classList.contains('hidden')?openChar():closeModal(charModal);
  }
  if(game.input.wasPressed('toggle_skills')){
    skillsModal.classList.contains('hidden')?openSkills():closeModal(skillsModal);
  }
  if(game.input.wasPressed('toggle_quests')){
    questsModal.classList.contains('hidden')?openQuests():closeModal(questsModal);
  }
  if(game.input.wasPressed('toggle_achievements')){
    achievementsModal.classList.contains('hidden')?openAchievements():closeModal(achievementsModal);
  }
  if(game.input.wasPressed('toggle_combat_log')){
    const cl=document.getElementById('combat-log-modal');
    if(cl.classList.contains('hidden')) openModal(cl);
    else closeModal(cl);
  }
  if(game.input.wasPressed('companion_ability') && !game.paused){
    if(game.triggerCompanionAbility) game.triggerCompanionAbility();
  }
  if(game.input.wasPressed('toggle_map')){
    if(!game.hud) return;
    const fm=document.getElementById('fullmap-modal');
    if(fm.classList.contains('hidden')){ game.hud.showFullMap(); openModal(fm); } else closeModal(fm);
  }
  if(game.input.wasPressed('teleport_town') && game.canTeleportTown && game.canTeleportTown()){
    game.teleportToTown();
  }
  // hotbar 1-9 (only when not in a menu)
  const hotbarKeys = ['1','2','3','4','5','6','7','8','9'];
  for(let i=0;i<9;i++){
    if(game.input.wasPressed('hotbar_' + (i+1)) && !game.paused){
      game.useHotbar(i); break;
    }
  }
});

window.addEventListener('resize', ()=>game.resize());
window.addEventListener('blur', ()=>{ if(game.running && !anyModalOpen()) game.paused=true; });
window.addEventListener('focus', ()=>{ if(game.running && !anyModalOpen() &&
  !document.getElementById('death-screen').classList.contains('flex')) game.paused=false; });

// (quit-btn click handler is registered once, near the bottom of this file.)
window.addEventListener('beforeunload', ()=>{ if(game.running) game.autosave(); });
// Quit to menu: prefer the start screen if a user is still authenticated
// (preserves login state), otherwise fall back to the login screen. The old
// code always showed login-screen which dumped authenticated users back
// through sign-in, even when their session was still valid.
document.getElementById('quit-btn').onclick=()=>{
  if(confirm('Quit to menu?')){
    const a = getAuth();
    game._username = null;
    game.quitToMenu();
    if(a && a.username){ show('start-screen'); } else { show('login-screen'); }
  }
};
window.addEventListener('load', ()=>{
  // Init Turso tables
  tursoInit().catch(()=>{});
  setTimeout(()=>{ const a=getAuth(); if(a.username){ renderSlotsWithAuth(a.username); show('start-screen'); } else { show('login-screen'); } },700);
});
