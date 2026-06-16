import { World, Camera, TILE } from './world.js';
import { Player } from '../entities/player.js';
import { Enemy, Projectile, Particle, rollEliteMod } from '../entities/enemy.js';
import { HUD } from '../ui/hud.js';
import { Audio } from './audio.js';
import { SaveSystem } from './save.js';
import { MAPS, MAP_LEVEL } from '../data/maps.js';
import { CATALOG, makeItem, EQUIP_SLOTS } from '../data/gear.js';
import { SKILLS, canLearn } from '../data/skilltree.js';
import { Boss, BOSSES } from '../entities/boss.js';
import { QuestLog } from './quests.js';
import { QUESTS } from '../data/quests.js';
import { rollRarity, applyRarity, rarityName } from '../data/affixes.js';
import { SPELLS, STARTER_SPELLS, knownSpells, spellRank } from '../data/spells.js';
import { reforge, upgrade, reforgeCost, upgradeCost, canUpgrade, stripEnchantCost, stripWeaponEnchant } from './craft.js';
import { Companion, COMPANIONS } from '../entities/companion.js';
import { ENCHANTMENTS, applyEnchant, enchantCost, enchantInfo } from '../data/enchantments.js';
import { applyStatus } from './status.js';
import { AMMO, ammoForKind, rangedWeaponKind } from '../data/ammo.js';
import { FlowField } from './pathfinding.js';
import { getKeybindOverrides, setKeybindOverrides } from '../ui/keybinds.js';
import { GamepadAdapter } from './gamepad.js';
import { Tutorial } from './tutorial.js';

// Display names for the toast when a companion joins. Kept in sync with
// COMPANION_ABILITIES in companion.js (which is private to that module).
const COMPANION_ABILITY_NAMES = {
  kira: 'Arrow Volley',
  thorin: 'Shield Bash',
  luna: 'Arcane Blast',
};
import { AchievementTracker } from './achievements.js';

// difficulty scale per map (deeper = tougher enemies)
const MAP_SCALE = { meadow:1, forest:1.25, desert:1.45, cave:1.6, dungeon1:1.9, house1:1,
  snow:1.7, swamp:1.8, dungeon2:2.3,
  // biome sub-areas hold that biome's boss - scaled a notch above the parent zone
  meadow_glade:1.15, forest_deep:1.4, desert_ruins:1.6, snow_glacier:1.85, swamp_depths:2.0,
  // Frozen Tundra end-game: each tier is harder
  tundra_edge:2.1, tundra_heart:2.5, frost_spire:3.0 };

export class Game {
  constructor(canvas, input){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.input=input; this.audio=new Audio();
    this.running=false; this.paused=false;
    this.settings={ shake:true, minimap:true, fps:false };
    this.enemies=[]; this.projectiles=[]; this.particles=[]; this.golds=[]; this.drops=[];
    this.playtime=0; this._lastT=0; this._fpsT=0; this._fpsCount=0; this._fps=60;
    this.nearInteract=null; this.transition=0;
    // Quest tracking state
    this._questTimers={};       // mapId -> {kind, deadline, started}
    this._escortNpc=null;       // {name, x, y, map, alive}
    this._surviveEnemies=0;     // spawned enemies for survive quests
    this.boss=null; this.bossesDead={}; this.checkpoint=null;
    this._bossClones=null;
    this._autoT=0; this.autosaveInterval=60; // seconds between timed autosaves
    this._dayTime=0; this._dayLen=120; // day/night cycle (seconds)
    this._weaponSkills={}; // {sword:0, axe:0, spear:0, bow:0, staff:0}
    this._companions=[]; // active companions
    // Sprint 6: flow field for pathfinding. Recomputed when the player crosses
    // a tile boundary — a single BFS replaces N parallel A* runs across enemies.
    this._flowField=null; this._flowGoal={x:0,y:0}; this._flowRecomputeT=0;
  }

  start(state){
    this.state=state; this.slot=state.slot; this._username=state.username||null;
    this.cam=new Camera(this.canvas.width, this.canvas.height);
    this.player=new Player(state.pos.x, state.pos.y, state);
    this.inventory=state.inventory.map(i=>({...i}));
    this.hotbar=[...state.hotbar];
    this._weaponSkills=state.weaponSkills||{};
    this._companions=(state.companions||[]).map(c=>Companion.deserialize(c));
    this.openedChests=state.openedChests||{};
    this.stash=(state.stash||[]).map(i=>({...i}));
    // Sprint 7: restore the player's keybind overrides from the save so rebinds
    // follow the account across devices. We re-publish them through the public
    // setKeybindOverrides() helper so the rebind UI picks them up on next mount.
    if(state.keybinds && typeof state.keybinds === 'object'){
      try { setKeybindOverrides(state.keybinds); } catch(e) {}
    }
    this.bossesDead=state.bossesDead||{};
    this._boughtSpells=state.boughtSpells||{};
    this.checkpoint=state.checkpoint||null;
    this.quests=new QuestLog(this, state);
    this.achievements=new AchievementTracker(this);
    this.achievements.load(state.achievements);
    this.hud=new HUD(this);
    this.loadMap(state.map, state.pos.x/TILE, state.pos.y/TILE, true);
    this.player.invuln=2.5;
    // Sprint 10: gamepad adapter (writes into input.keys / input.mouse on poll)
    // and tutorial runner (the panel UI; the persisted flag bag lives on the
    // game as `this._tutorialFlag` and is read by the trigger predicates in
    // js/data/tutorial.js).
    this.gamepad = new GamepadAdapter(input, this);
    this.tutorial = new Tutorial(this);
    if(state.tutorial) this.tutorial.attachSaveState(state);
    // Fresh flag bag for this run; the tutorial steps check this in their
    // trigger predicates. We reset it in start() so a fresh run starts clean
    // (the bag is transient state, not persisted).
    this._tutorialFlag = {};
    this.running=true; this.paused=false;
    this._lastT=performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  // Load a map; spawn enemies ONCE here (no waves). tx/ty in tile coords.
  loadMap(mapId, tx, ty, keepPos){
    this.world=new World(mapId);
    this.currentMap=mapId;
    this._flowField=null;  // Sprint 6: invalidate the cached field for the new map
    if(!keepPos){
      // snap to nearest walkable tile so we never land inside a wall/decor
      const sp=this.world.nearestOpen(tx*TILE+TILE/2, ty*TILE+TILE/2);
      this.player.x=sp.x; this.player.y=sp.y;
    } else {
      // initial load / continue: also rescue a player saved inside a solid tile
      if(this.world.isSolid(this.player.x,this.player.y)){
        const sp=this.world.nearestOpen(this.player.x,this.player.y);
        this.player.x=sp.x; this.player.y=sp.y;
      }
    }
    // restore opened-chest state for this map
    this.world.chests.forEach(c=>{ if(this.openedChests[mapId+':'+c.idx]) c.opened=true; });
    // Spawn enemies fresh on EVERY area entry so the player can farm xp/gold.
    // Bosses still persist (handled below). Seed varies per visit so layouts feel alive.
    this.enemies=[]; this.projectiles=[]; this.golds=[]; this.drops=[]; this.boss=null; this._bossClones=null;
    const def=MAPS[mapId];
    const scale=MAP_SCALE[mapId]||1;
    let seed=(def.seed*7+13) + ((this._visitTick=(this._visitTick||0)+1)*131);
    const rand=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    for(let i=0;i<(def.enemies.count||0);i++){
      // Smart placement: avoid chests/portals/NPCs and keep enemies spread
      // out so they don't stack on each other or land on the player.
      const pos=this.world.findSpawnPoint(rand, {
        exclusions: this.world.reservedZones(def),
        others: this.enemies,
        player: this.player,
        playerR: 80,
        otherR: 28,
        exclusionR: 30,
      });
      const types=def.enemies.types;
      const t=types[Math.floor(rand()*types.length)];
      // elite chance scales with map difficulty (scale); harder maps breed champions
      const eliteChance=Math.min(0.22, 0.05*scale);
      const elite = rand()<eliteChance ? rollEliteMod(rand) : null;
      const e=new Enemy(pos.x,pos.y,t,scale,elite); e.spawnIdx=i; this.enemies.push(e);
    }
    // checkpoint: dying returns you to this area at this entry point
    this.checkpoint={ map:mapId, tx, ty };
    // boss for this map (if not already defeated)
    for(const bid in BOSSES){
      if(BOSSES[bid].map===mapId && !this.bossesDead[bid]){
        this.boss=new Boss(bid);
        // start the no-damage tracking
        if(this.achievements) this.achievements.onBossFightStart();
        // keep the boss off solid tiles (carved-room maps may wall its anchor)
        if(this.world.isSolid(this.boss.x,this.boss.y)){
          const bp=this.world.nearestOpen(this.boss.x,this.boss.y);
          this.boss.x=bp.x; this.boss.y=bp.y;
        }
        setTimeout(()=>{ if(this.boss && !this.boss.dead) this.toast('? '+this.boss.def.name+' awakens!'); }, 400);
      }
    }
    this.cam.follow(this.player, this.world);
    this.transition=0.6; // fade-in
    this.audio.setMusic(def.music, !!this.boss);
    this.toast('Entering '+def.name);
    this.logCombat('Entered ' + def.name + (this.boss ? ' (boss: ' + this.boss.def.name + ')' : ''), 'portal');
    // Recommended-level hint: warn the player if they are under-equipped
    // for this area. Only shown for non-town maps and not on the first
    // load (the starter meadow shouldn't nag).
    const recLvl = MAP_LEVEL[mapId];
    if(recLvl && recLvl>1 && this.player && this.player.level < recLvl){
      this.toast('? Recommended level '+recLvl+' (you are '+this.player.level+')', '#ff9a6a');
    }
    if(this.quests) this.quests.onReach(mapId);
    if(this.achievements) this.achievements.onMapEnter(mapId);
    // autosave when entering a new area (but not on the initial load from start())
    if(!keepPos && this.running){ this.autosave('Checkpoint saved'); }
    if(this.hud) this.hud._updateTownBtn();
  }

  _loop(now){
    if(!this.running) return;
    let dt=(now-this._lastT)/1000; this._lastT=now;
    if(dt>0.05) dt=0.05;
    if(!this.paused){ this.playtime+=dt; this.update(dt); }
    this.render();
    this._fpsCount++; this._fpsT+=dt;
    if(this._fpsT>=0.5){ this._fps=Math.round(this._fpsCount/this._fpsT); this._fpsCount=0; this._fpsT=0;
      this.hud.setFps(this._fps,this.settings.fps); }
    requestAnimationFrame(this._loop.bind(this));
  }

  update(dt){
    if(this.transition>0) this.transition=Math.max(0,this.transition-dt);
    this._autoT+=dt;
    if(this._autoT>=this.autosaveInterval) this.autosave('Autosaved');
    this.player.update(dt,this.input,this.world,this.cam,this);
    this.cam.follow(this.player,this.world);
    if(!this.settings.shake) this.cam.shake=0;
    // Sprint 6: refresh the flow field when the player has moved to a new tile
    // (or every 0.5s, whichever comes first). Cheap BFS that every enemy can read.
    this._refreshFlowField(dt);

    for(const e of this.enemies) e.update(dt,this.player,this.world,this);
    this.enemies=this.enemies.filter(e=>!e.dead);
    if(this.boss){ this.boss.update(dt,this.player,this.world,this); if(this.boss.dead) this.boss=null; }
    // boss clones (Glacius' "clones" attack): just decay over time, no AI.
    if(this._bossClones && this._bossClones.length){
      for(const c of this._bossClones) c.update && c.update(dt, this.player, this.world, this);
      this._bossClones = this._bossClones.filter(c => !c.dead);
      if(!this._bossClones.length) this._bossClones = null;
    }

    for(const p of this.projectiles) p.update(dt,this.world,this.enemies,this);
    this.projectiles=this.projectiles.filter(p=>!p.dead);

    for(const p of this.particles) p.update(dt);
    this.particles=this.particles.filter(p=>!p.dead);

    // gold pickups (magnet)
    for(const g of this.golds){
      const d=Math.hypot(g.x-this.player.x,g.y-this.player.y);
      if(d<70){ g.x+=(this.player.x-g.x)*0.18; g.y+=(this.player.y-g.y)*0.18; }
      if(d<16){ g.dead=true; const amt=this.player.gainGold(g.amount,this); this.sfx('pickup');
        this.floater('+'+amt+'g',this.player.x,this.player.y-30,'#ffcf4d');
        this.logCombat('Picked up +' + amt + ' gold', 'gold');
        if(this.achievements) this.achievements.onGoldHeld(this.player.gold); }
    }
    this.golds=this.golds.filter(g=>!g.dead);

    // item drops pickup
    for(const it of this.drops){
      const d=Math.hypot(it.x-this.player.x,it.y-this.player.y);
      if(d<22){ it.dead=true; const obj=it.item?it.item:makeItem(it.id,1); this.addItem(obj); this.sfx('pickup');
        this.toast('Picked up '+(obj.name||CATALOG[it.id].name));
        this.logCombat('Picked up ' + (obj.name || CATALOG[it.id].name), 'info');
        if(this._tutorialFlag) this._tutorialFlag.pickedUp = true; }  // Sprint 10
    }
    this.drops=this.drops.filter(it=>!it.dead);

    this._checkInteract();
    this._updateQuestTimers();
    this._updateEscort();
    this.hud.refresh();
    if(this.settings.minimap && this.hud.drawMinimap) this.hud.drawMinimap();
    // Sprint 9: drive the low-HP heartbeat layer from the player's HP ratio.
    // updateHeartbeat() is a no-op until the player dips below the
    // threshold, so the cost is one division per frame when healthy.
    if(this.player && this.player.hpMax > 0){
      this.audio.updateHeartbeat(this.player.hp / this.player.hpMax);
    }
    // Sprint 10: gamepad polling (writes into input.keys/mouse as a side
    // effect) and the tutorial step-advance check.
    if(this.gamepad) this.gamepad.poll(dt);
    if(this.tutorial) this.tutorial.update();
    // Toggle the on-screen gamepad indicator. The element exists in
    // index.html; the only state we need to sync is "connected" class.
    this._updateGamepadIndicator();
    this.input.lateUpdate();
  }

  // Cheap once-per-frame DOM sync for the gamepad status pill. Reads
  // gamepad.connected and applies the .connected class accordingly. The
  // element is hidden via the .hidden class on the wrapper; we toggle both.
  _updateGamepadIndicator(){
    if(typeof document === 'undefined') return;
    const el = document.getElementById('gamepad-status');
    if(!el) return;
    const c = !!(this.gamepad && this.gamepad.connected);
    el.classList.toggle('connected', c);
    el.classList.toggle('hidden', !this.running);  // never show outside a run
  }

  _checkInteract(){
    let near=null, nd=52;
    // portals (auto-enter on step, but also show prompt)
    for(const p of this.world.portals){
      const d=Math.hypot(p.wx-this.player.x,p.wy-this.player.y);
      if(d<26){ this._usePortal(p); return; }
      if(d<nd){ near={type:'portal',ref:p,label:'Go to '+p.label}; nd=d; }
    }
    for(const n of this.world.npcs){
      const d=Math.hypot(n.wx+16-this.player.x,n.wy+16-this.player.y);
      if(d<nd){ let label=n.shop?'Shop ('+n.name+')':n.bank?'Open Stash':n.craft?'Use Forge':'Talk to '+n.name;
        if(this.quests && !n.shop && !n.bank && !n.craft){ const gs=this.quests.giverState(n.name);
          if(gs.turnIn.length) label='Turn in quest ('+n.name+')';
          else if(gs.available.length) label='Accept quest ('+n.name+')'; }
        near={type:'npc',ref:n,label}; nd=d; } }
    for(const c of this.world.chests){ if(c.opened) continue;
      const d=Math.hypot(c.wx+16-this.player.x,c.wy+16-this.player.y);
      if(d<nd){ near={type:'chest',ref:c,label:'Open Chest'}; nd=d; } }
    this.nearInteract=near;
    if(near){ this.hud.showInteract(near.label);
      if(this.input.wasPressed('interact')) this._doInteract(near); }
    else this.hud.hideInteract();
  }
  _updateQuestTimers(){
    if(!this.quests) return;
    const map=this.currentMap;
    for(const id in this.quests.active){
      const q=QUESTS[id]; const st=this.quests.active[id];
      for(let i=0;i<q.objectives.length;i++){
        const o=q.objectives[i];
        if(st.prog[i]>=1) continue;
        if(o.kind==='timed_clear' && o.map===map){
          if(!this._questTimers[map]) this._questTimers[map]={kind:'timed_clear',deadline:performance.now()+o.seconds*1000};
          if(this.enemies.length===0 && !this.boss){ this.quests.onTimedClear(map); this._questTimers[map]=null; }
          else if(this._questTimers[map] && performance.now()>this._questTimers[map].deadline){ this._questTimers[map]=null; }
        }
        if(o.kind==='survive' && o.map===map){
          if(!this._questTimers[map]) this._questTimers[map]={kind:'survive',deadline:performance.now()+o.seconds*1000};
          if(this._questTimers[map] && performance.now()>=this._questTimers[map].deadline){ this.quests.onSurvive(map); this._questTimers[map]=null; }
        }
      }
    }
  }

  _updateEscort(){
    if(!this.quests || !this._escortNpc) return;
    const map=this.currentMap;
    for(const id in this.quests.active){
      const q=QUESTS[id]; const st=this.quests.active[id];
      for(let i=0;i<q.objectives.length;i++){
        const o=q.objectives[i];
        if(o.kind==='escort' && o.to===map && st.prog[i]<1 && this._escortNpc && this._escortNpc.alive){
          this.quests.onEscort(map);
          this._escortNpc=null;
        }
      }
    }
  }

  _usePortal(p){
    if(this.transition>0) return; // debounce during fade
    this.loadMap(p.to, p.tx, p.ty, false);
    this.sfx('open');
    if(this.achievements) this.achievements.onPortal();
  }
  _doInteract(near){
    if(near.type==='npc'){
      const n=near.ref;
      if(n.bank){ this.openStash(n.name); return; }
      if(n.craft){ this.openCraft(n.name); return; }
      if(n.shop){ this.openShop(n.stock, n.name); return; }
      // companion recruitment
      if(n.companion){
        if(this._companions.length>=1){ this.toast('Your party is full. Dismiss your current companion first.'); return; }
        this.recruitCompanion(n.companion);
        return;
      }
      // dismiss companion (talk to any NPC while holding the dismiss key)
      if(this._companions.length>0 && this.input.isDown('dismiss_companion')){
        this.dismissCompanion(); return;
      }
      // quest handling: turn in completed, else offer next available
      if(this.quests){
        const gs=this.quests.giverState(n.name);
        if(gs.turnIn.length){ this.quests.turnIn(gs.turnIn[0]); return; }
        if(gs.available.length){ this.quests.accept(gs.available[0]); return; }
        if(gs.inProgress.length){ this.toast(n.name+': Come back when the task is done.'); return; }
      }
      n._line=(n._line||0); this.toast(n.name+': '+n.lines[n._line%n.lines.length]); n._line++;
      if(this._tutorialFlag) this._tutorialFlag.spokeNpc = true;  // Sprint 10
    } else if(near.type==='chest'){
      const c=near.ref; if(c.opened) return;
      c.opened=true; this.openedChests[this.currentMap+':'+c.idx]=true; this.sfx('open');
      if(this.achievements) this.achievements.onChestOpened();
      const loot=c.loot;
      if(loot.type==='gold'){ const amt=this.player.gainGold(loot.amount,this); this.toast('Found '+amt+' gold!');
        if(this.achievements) this.achievements.onGoldHeld(this.player.gold); }
      else { this.addItem(makeItem(loot.id,loot.qty||1)); this.toast('Found '+CATALOG[loot.id].name+'!'); }
    } else if(near.type==='portal'){ this._usePortal(near.ref); }
  }

  render(){
    const ctx=this.ctx;
    ctx.fillStyle='#0c0e16'; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    this.world.draw(ctx,this.cam);
    this._drawQuestMarkers(ctx);
    // gold coins
    for(const g of this.golds){ ctx.fillStyle='#ffcf4d';
      ctx.beginPath(); ctx.arc(g.x-this.cam.x,g.y-this.cam.y,4,0,7); ctx.fill();
      ctx.fillStyle='#c79a2a'; ctx.beginPath(); ctx.arc(g.x-this.cam.x,g.y-this.cam.y,2,0,7); ctx.fill(); }
    // item drops (sparkle)
    for(const it of this.drops){ const sx=it.x-this.cam.x, sy=it.y-this.cam.y;
      ctx.font='18px "Segoe UI Symbol","Arial Unicode MS",serif'; ctx.textAlign='center';
      ctx.fillText(CATALOG[it.id].icon, sx, sy+6+Math.sin(performance.now()/300)*2); }
    // depth sort
    const ents=[this.player,...this.enemies]; if(this.boss) ents.push(this.boss);
    if(this._bossClones) for(const c of this._bossClones) ents.push(c);
    ents.sort((a,b)=>a.y-b.y);
    for(const e of ents) e.draw(ctx,this.cam);
    for(const p of this.projectiles) p.draw(ctx,this.cam);
    for(const p of this.particles) p.draw(ctx,this.cam);
    // day/night overlay
    if(this._dayTime>0){
      const dayFrac=(Math.sin((this._dayTime/this._dayLen)*Math.PI*2-Math.PI/2)+1)/2;
      const nightAlpha=Math.max(0,0.45-dayFrac*0.45);
      if(nightAlpha>0.01){
        ctx.fillStyle='rgba(10,10,30,'+nightAlpha+')';
        ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        // torch glow around player
        const p=this.player;
        const grad=ctx.createRadialGradient(p.x-cam.x,p.y-cam.y,10,p.x-cam.x,p.y-cam.y,90);
        grad.addColorStop(0,'rgba(255,180,60,'+(nightAlpha*0.15)+')');
        grad.addColorStop(1,'rgba(255,180,60,0)');
        ctx.fillStyle=grad; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
      }
    }
    // companion drawing
    for(const c of this._companions) c.draw(ctx,this.cam);
    // transition fade
    if(this.transition>0){ ctx.fillStyle='rgba(0,0,0,'+(this.transition/0.6)+')';
      ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
    // HUD DOM updates that need to run every frame (cooldown overlays)
    if(this.hud){ this.hud.refreshCompanionAbility(); }
  }

  // draw ?/?/? markers above quest-giver NPCs
  _drawQuestMarkers(ctx){
    if(!this.quests || !this.world) return;
    const bob=Math.sin(performance.now()/250)*3;
    ctx.textAlign='center';
    for(const n of this.world.npcs){
      if(n.shop||n.bank||n.craft) continue;
      const gs=this.quests.giverState(n.name);
      let m=null,col='#ffcf4d';
      if(gs.turnIn.length){ m='?'; col='#ffcf4d'; }
      else if(gs.available.length){ m='?'; col='#ffe24d'; }
      else if(gs.inProgress.length){ m='?'; col='#9aa'; }
      if(m){ const sx=n.wx+16-this.cam.x, sy=n.wy-6-this.cam.y+bob;
        ctx.font='16px "Segoe UI Symbol","Arial Unicode MS",serif'; ctx.fillStyle=col;
        ctx.fillText(m, sx, sy); }
    }
  }

  // ---- combat hooks ----
  _hitTargetInArc(e, p, reach, arc){
    const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy);
    if(d>=reach+e.r) return;
    const ang=Math.atan2(dy,dx);
    let diff=Math.abs(((ang-p._aim+Math.PI)%(2*Math.PI))-Math.PI);
    if(diff>=arc) return;
    let dmg=p.atk*p.dmgMul;
    const crit=Math.random()*100<p.crit;
    if(crit) dmg*=2;
    dmg=Math.round(dmg);
    // Holy enchantment: +25% damage vs undead
    const w = resolveEquip(p.equipment && p.equipment.weapon);
    const ench = w && w.enchant;
    if(ench === 'holy' && this._isUndead(e)) dmg = Math.round(dmg * 1.25);
    e.hit(dmg,ang,this,6);
    if(crit){ this.floater('CRIT '+dmg,e.x,e.y-26,'#ffcf4d'); this.logCombat('CRIT! -' + dmg + ' on ' + e.type, 'crit'); }
    if(p.lifesteal>0){ const heal=dmg*p.lifesteal; p.heal(heal,this); }
    this.cam.shake=Math.min(this.cam.shake+3,8);
    // Apply enchantment on-hit effects (status DoTs / chill / chain)
    if(ench && !e.dead){
      if(ench === 'fire')       applyStatus(e, 'burn', 2.5);
      else if(ench === 'ice')   applyStatus(e, 'chill', 2.0);
      else if(ench === 'poison') applyStatus(e, 'poison', 4.0);
      else if(ench === 'lightning'){
        // chain to the next nearest foe within 130px, dealing 50% damage
        const others = this.enemies.filter(o => o !== e && !o.dead && Math.hypot(o.x-e.x, o.y-e.y) < 130);
        if(others.length){
          others.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));
          const target = others[0];
          const cDmg = Math.round(dmg*0.5);
          target.hit(cDmg, Math.atan2(target.y-e.y, target.x-e.x), this, 3);
          this.floater('CHAIN '+cDmg, target.x, target.y-22, '#fff066');
          this.spawnParticles(e.x, e.y, '#fff066', 6);
          this.spawnParticles(target.x, target.y, '#fff066', 6);
        }
      }
    }
  }
  // Undead = skeletons, frostlings, frost mages, etc. We classify by type.
  _isUndead(e){
    return ['skeleton','frostling','frost_mage','skeleton_archer'].includes(e.type);
  }
  // Sprint 6: keep the flow field pointed at the player. Recompute when the
  // player crosses a tile or every 0.5s — whichever comes first. BFS is cheap
  // (single linear scan of the map); the win is that 10+ chasing enemies
  // each call O(1) instead of running their own A*.
  _refreshFlowField(dt){
    const p = this.player;
    if(!p || !this.world) return;
    this._flowRecomputeT -= dt;
    const newTx = Math.floor(p.x / 32);
    const newTy = Math.floor(p.y / 32);
    const oldTx = Math.floor(this._flowGoal.x / 32);
    const oldTy = Math.floor(this._flowGoal.y / 32);
    if(!this._flowField || newTx !== oldTx || newTy !== oldTy || this._flowRecomputeT <= 0){
      const w = this.world;
      this._flowField = new FlowField((x, y) => w._blockedTile(x, y), w.cols, w.rows, p.x, p.y);
      this._flowGoal.x = p.x; this._flowGoal.y = p.y;
      this._flowRecomputeT = 0.5;  // hard ceiling so a moving player still gets fresh fields
    }
  }
  _fireRangedShot(p){
    if(p._overheatCd>0) return;
    // Sprint 5: ammo gate. Bows + crossbows need ammo; staff does not.
    const weaponId = p.weapon;  // e.g. 'bow_short', 'crossbow', 'staff_arcane'
    let ammoId = null, ammoAtkBonus = 0, ammoStatus = null, ammoStatusDur = 0;
    if(weaponId){
      // dynamic import would be heavy; use direct module path since ammo.js has no DOM deps
      const am = rangedWeaponKind(weaponId);
      if(am){
        // pick the best ammo the player has for this weapon kind
        const list = ammoForKind(am);
        for(const id of list){
          if((p.ammo[id]||0) > 0){ ammoId = id; break; }
        }
        if(!ammoId){
          this.floater('NO AMMO', p.x, p.y-30, '#ff5a4d');
          this.sfx('block');  // little "click" feedback
          return;
        }
        const ad = AMMO[ammoId];
        ammoAtkBonus = ad.atkBonus||0;
        ammoStatus = ad.statusOnHit||null;
        ammoStatusDur = ad.statusDur||0;
        p.ammo[ammoId] -= 1;
        if(p.ammo[ammoId] <= 0) delete p.ammo[ammoId];
      }
    }
    const heatCost=12*(p._heatReduction||1);
    p.heat=Math.min(p.heatCap,p.heat+heatCost);
    if(p.heat>=p.heatCap){ p._overheatCd=3; this.floater('OVERHEAT!',p.x,p.y-30,'#f44'); }
    let dmg=Math.round((p.atk + ammoAtkBonus)*p.dmgMul*(p._rangedAtkMul||1)*0.85);
    const crit=Math.random()*100<p.crit; if(crit) dmg*=2;
    this.projectiles.push(new Projectile(p.x,p.y,p._aim,
      {speed:p.shotSpeed,dmg,r:5,color:'#ffe6a0',kind:'phys',life:1.3,
       crit, lifesteal:p.lifesteal||0,
       // pass ammo status through the existing projectile status hook
       status: ammoStatus, statusDur: ammoStatusDur}));
    // low-ammo ping: when crossing into single digits, brief HUD flash
    const total = ammoId ? (p.ammo[ammoId]||0) : 0;
    if(ammoId && total>0 && total<=5){
      this.toast('Low ammo: '+total+' '+AMMO[ammoId].name.replace(/s$/,'')+(total===1?'':'s')+' left', '#ff9a6a');
    }
  }
  doMeleeAttack(p){
    if(p.ranged){ this._fireRangedShot(p); return; }
    const reach=p.reach||44, arc=1.15;
    for(const e of this.enemies){ if(e.dead) continue; this._hitTargetInArc(e,p,reach,arc); }
    if(this.boss && !this.boss.dead) this._hitTargetInArc(this.boss,p,reach,arc);
    // weapon skill XP
    this._addWeaponSkillXp(p);
  }
  _addWeaponSkillXp(p){
    if(!p.ranged){
      const w=p.weapon||'sword';
      const key=w.includes('axe')?'axe':w.includes('spear')||w.includes('halberd')?'spear':'sword';
      if(!this._weaponSkills[key]) this._weaponSkills[key]=0;
      this._weaponSkills[key]+=1;
    }
  }
  castSpell(p, id){
    const sp=SPELLS[id]; if(!sp) return;
    if(this._tutorialFlag) this._tutorialFlag.castSpell = true;  // Sprint 10
    const pr=sp.proj;
    const dmg=Math.round((pr.base + p.level*(pr.perLvl||0))*p.spellMul);
    const opts={ speed:pr.speed, dmg, r:pr.r, color:pr.color, kind:pr.kind,
      life:pr.life, aoe:pr.aoe||0, status:pr.status||null, chain:pr.chain||0 };
    if(sp.healOnCast) p.heal(sp.healOnCast,this);
    if(sp.nova){
      // ring of projectiles outward
      const n=sp.nova;
      for(let i=0;i<n;i++){ const a=(i/n)*Math.PI*2;
        this.projectiles.push(new Projectile(p.x,p.y,a,{...opts})); }
    } else {
      this.projectiles.push(new Projectile(p.x,p.y,p._aim,opts));
    }
  }
  throwBomb(){ const p=this.player;
    this.projectiles.push(new Projectile(p.x,p.y,p._aim,{speed:4,dmg:40,r:8,color:'#444',kind:'fire',life:0.8,aoe:70})); }
  // enemy ranged attack
  enemyShoot(x,y,angle,dmg){
    const proj=new Projectile(x,y,angle,{speed:3.5,dmg,r:5,color:'#e8413c',kind:'fire',life:2.0,hostile:true});
    // check parry: if player is blocking with active parry window, reflect projectile
    const p=this.player;
    if(p.blocking && p._parryWindow>0 && !p._parried){
      p._parried=true;
      proj.hostile=false;
      proj.angle=angle+Math.PI; // reverse direction
      proj.color='#88ddff';
      proj.dmg=Math.round(proj.dmg*1.5); // parry bonus damage
      this.floater('PARRY!',p.x,p.y-34,'#88ddff');
      this.sfx('parry');
      this.cam.shake=4;
      if(this.achievements) this.achievements.onParry();
    }
    this.projectiles.push(proj);
  }
  // enemy ranged attack that applies a status (poison/burn)
  enemyShootStatus(x,y,angle,dmg,status){
    const col=status==='poison'?'#74d83f':status==='burn'?'#ff7a2a':'#e8413c';
    this.projectiles.push(new Projectile(x,y,angle,{speed:3.2,dmg,r:6,color:col,kind:'fire',life:2.2,hostile:true,status}));
  }
  // spawn a boss add (minion) at a position
  spawnAdd(x,y,type){
    x=Math.max(40,Math.min(this.world.w-40,x)); y=Math.max(40,Math.min(this.world.h-40,y));
    if(this.world.isSolid(x,y)) return;
    const e=new Enemy(x,y,type,(MAP_SCALE[this.currentMap]||1)); e.spawnIdx=-1; this.enemies.push(e);
    this.spawnParticles(x,y,'#a45cff',10);
  }
  // boss defeat: rewards, drop, persist, quest hook
  onBossDefeated(boss){
    this.player.gainXp(boss.xp,this);
    const amt=this.player.gainGold(boss.def.gold,this);
    this.floater('+'+amt+'g',boss.x,boss.y-30,'#ffcf4d');
    this.spawnParticles(boss.x,boss.y,boss.def.color,40);
    this.cam.shake=16;
    // guaranteed rare+ gear drop
    const item=makeItem(boss.def.drop,1);
    if(item){ const rar=rollRarity(Math.random,0.9); applyRarity(item,rar==='common'?'rare':rar);
      this.addItem(item); this.toast('? '+rarityName(item)+' '+item.name+' obtained!'); }
    this.bossesDead[boss.id]=true;
    this.audio.setMusic(MAPS[this.currentMap].music,false);
    if(this.quests) this.quests.onKill(null,true,boss.id);
    this.toast(boss.def.name+' defeated!');
    this.sfx('levelup');
    if(this.achievements) this.achievements.onBossDefeated();
    this.logCombat('Defeated ' + boss.def.name + ' (+' + amt + 'g)', 'kill');
    this.autosave('Progress saved');
  }

  spawnParticles(x,y,color,n){ for(let i=0;i<n;i++) this.particles.push(new Particle(x,y,color)); }
  dropGold(x,y,amount){ this.golds.push({x,y,amount,dead:false}); }
  dropItem(x,y){
    // pick a random low-tier item to drop
    const pool=['potion','ether','bomb','potion_l'];
    const id=pool[Math.floor(Math.random()*pool.length)];
    this.drops.push({x,y,id,dead:false});
  }
  // rare equippable drop with rolled rarity (from tougher enemies)
  dropGear(x,y,luck){
    const gearPool=['sword_iron','shield_iron','armor_leather','helm_iron','ring_power','ring_focus','sword_frost'];
    const id=gearPool[Math.floor(Math.random()*gearPool.length)];
    const item=makeItem(id,1); if(!item) return;
    applyRarity(item, rollRarity(Math.random, luck||0));
    this.drops.push({x,y,id,item,dead:false});
  }
  // enemy death bookkeeping: quest progress + gear drop chance
  // (regular enemies respawn on re-entry so the player can farm - no kill persistence)
  onEnemyKilled(e){
    if(this.quests) this.quests.onKill(e.type,false,null);
    // tougher foes can drop rolled gear
    const tough=['brute','golem','yeti','croaker','skeleton'];
    if(tough.includes(e.type) && Math.random()<0.25) this.dropGear(e.x,e.y,0.3);
    if(this.achievements) this.achievements.onEnemyKilled(e);
    this.logCombat('Slain ' + e.type, 'kill');
  }
  floater(t,x,y,c){ this.hud.floater(t,x,y,c); }
  // Add an entry to the combat log (L-key overlay). No-op until the HUD is
  // built; safe to call from anywhere (Player, Enemy, Boss, world events).
  logCombat(text, kind='info'){ if(this.hud && this.hud.logCombat) this.hud.logCombat(text, kind); }
  toast(m,c){ this.hud.toast(m,c); }
  sfx(n){ this.audio.play(n); }

  // ---- inventory / equipment ----
  addItem(item){
    if(!item) return;
    if(item.type==='consumable' || item.type==='ammo'){
      // Stack by id. Ammo uses the same path as consumables (qty accumulator)
      // but we skip the hotbar assignment for ammo — ammo auto-consumes on fire.
      const ex=this.inventory.find(i=>i.id===item.id && (i.type==='consumable' || i.type==='ammo'));
      if(ex){ ex.qty+=item.qty; }
      else this.inventory.push({...item});
      if(item.type==='consumable' && !this.hotbar.includes(item.id)){
        const idx=this.hotbar.indexOf(null); if(idx>=0) this.hotbar[idx]=item.id;
      }
      // Sprint 5: ammo bought/found auto-loads into the quiver (Zelda-style)
      if(item.type==='ammo' && item.ammo){
        if(!this.player.ammo) this.player.ammo = {};
        this.player.ammo[item.ammo] = (this.player.ammo[item.ammo]||0) + item.qty;
      }
    } else {
      this.inventory.push({...item}); // gear stacks individually (keeps rarity/affixes)
    }
    if(this.quests) this.quests.onPickup();
    // Achievement hooks: affix count + legendary
    if(this.achievements && item.rarity){
      if(item.affixes && item.affixes.length) this.achievements.onAffixCount(item.affixes.length);
      if(item.rarity === 'legendary') this.achievements.onLegendaryFound();
    }
    this.hud.refresh();
  }
  removeItem(item){
    const i=this.inventory.indexOf(item);
    if(i>=0) this.inventory.splice(i,1);
  }
  useHotbar(i){ this.hud.setActiveSlot(i); const id=this.hotbar[i]; if(id) this.useConsumable(id); }
  useConsumable(id){
    const item=this.inventory.find(i=>i.id===id && i.type==='consumable');
    if(!item || !CATALOG[id]) return;
    if(item.qty<=0) return;
    item.qty--;
    CATALOG[id].use(this);
    if(item.qty<=0){ this.removeItem(item); const hi=this.hotbar.indexOf(id); if(hi>=0) this.hotbar[hi]=null; }
    if(this.achievements && (id==='potion' || id==='potion_l' || id==='elixir')) this.achievements.onPotionDrank();
    this.hud.refresh();
  }
  // equip a gear item from inventory
  equipItem(item){
    if(!item || item.type==='consumable') return;
    const slot=item.type; // weapon/shield/armor/helm/ring
    const prev=this.player.equipment[slot];
    // store rolled gear as full object; plain catalog gear as id string
    this.player.equipment[slot]=(item.rarity||item.affixes)?{...item}:item.id;
    this.removeItem(item);
    if(prev){ this.addItem(typeof prev==='string'?makeItem(prev,1):prev); } // old gear back to bag
    this.player.recompute();
    this.player.hp=Math.min(this.player.hp,this.player.hpMax);
    this.player.mp=Math.min(this.player.mp,this.player.mpMax);
    this.sfx('open'); this.hud.refresh();
  }
  unequip(slot){
    const prev=this.player.equipment[slot]; if(!prev) return;
    this.player.equipment[slot]=null;
    this.addItem(typeof prev==='string'?makeItem(prev,1):prev);
    this.player.recompute(); this.sfx('open'); this.hud.refresh();
  }

  // ---- shop ----
  openShop(stock, name){ this.paused=true; this.shopStock=stock||null; this.shopName=name||'Merchant'; this.hud.openShop(); }
  buyItem(id){
    const c=CATALOG[id]; if(!c) return;
    if(this.player.gold < c.price){ this.toast('Not enough gold!'); this.sfx('hurt'); return; }
    this.player.gold-=c.price; this.addItem(makeItem(id, c.type==='consumable'?1:1));
    if(this.achievements) this.achievements.onGoldSpent(c.price);
    this.sfx('pickup'); this.toast('Bought '+c.name); this.hud.refreshShop();
  }
  sellItem(item){
    const c=CATALOG[item.id]; if(!c) return;
    const val=c.sell||Math.floor((c.price||0)/2);
    if(item.type==='consumable' && item.qty>1){ item.qty--; }
    else this.removeItem(item);
    this.player.gold+=val; this.sfx('pickup'); this.toast('Sold '+c.name+' (+'+val+'g)');
    this.hud.refreshShop();
  }

  // ---- spell shop (arcane vendor) ----
  // Track which spell ranks the player has bought (persisted in knownSpells + skill unlocks).
  // spellRanks: {spellId: true} - persisted via serialize() so bought ranks survive save/load.

  buySpell(id){
    const sp=SPELLS[id]; if(!sp) return;
    const cost=sp.learnCost||0;
    if(cost<=0 || this.player.gold<cost){ this.toast(cost<=0?'Already known!':'Not enough gold!'); this.sfx('hurt'); return; }
    this.player.gold-=cost;
    this._boughtSpells=this._boughtSpells||{};
    this._boughtSpells[id]=true;
    this.sfx('pickup'); this.toast('Learned '+sp.name+'!');
    this.hud.refreshShop();
    this.hud._updateSpellLoadout();
  }
  upgradeSpell(id){
    const sp=SPELLS[id]; if(!sp || !sp.upgrade){ this.toast('No upgrade available!'); return; }
    const up=sp.upgrade; const upSp=SPELLS[up]; if(!upSp) return;
    const cost=sp.upgradeCost||0;
    if(this.player.gold<cost){ this.toast('Not enough gold!'); this.sfx('hurt'); return; }
    this.player.gold-=cost;
    this._boughtSpells=this._boughtSpells||{};
    this._boughtSpells[up]=true;
    this.sfx('levelup'); this.toast('Upgraded to '+upSp.name+'!');
    this.hud.refreshShop();
    this.hud._updateSpellLoadout();
  }
  hasSpell(id){
    // base ranks are always known (starter/spellpower); bought ranks tracked in _boughtSpells;
    // skill-unlocked spells tracked via knownSpells()
    const base=spellRank(id).base;
    if(STARTER_SPELLS.includes(base)) return true;
    if(['poisonbolt','arcaneorb','holybolt'].includes(base) && (this.player.skills.spellpower||0)>=1) return true;
    if(this._boughtSpells&&this._boughtSpells[id]) return true;
    // skill-gated
    const sp=SPELLS[id]; if(sp&&sp.unlock&&(this.player.skills[sp.unlock]||0)>0) return true;
    return false;
  }

  // ---- stash (city bank): shared storage, move items bag<->stash ----
  openStash(name){ this.paused=true; this.stashName=name||'Stash'; this.hud.openStash(); }
  STASH_MAX=40;
  toStash(item){
    if(!item) return;
    const i=this.inventory.indexOf(item); if(i<0) return;
    if(item.type==='consumable'){
      const ex=this.stash.find(s=>s.id===item.id && s.type==='consumable');
      if(ex) ex.qty=(ex.qty||1)+(item.qty||1); else { if(this.stash.length>=this.STASH_MAX){ this.toast('Stash full!'); return; } this.stash.push({...item}); }
    } else { if(this.stash.length>=this.STASH_MAX){ this.toast('Stash full!'); return; } this.stash.push({...item}); }
    this.inventory.splice(i,1);
    const hi=this.hotbar.indexOf(item.id); if(hi>=0 && !this.inventory.find(x=>x.id===item.id)) this.hotbar[hi]=null;
    this.sfx('open'); this.hud.refreshStash();
  }
  fromStash(item){
    if(!item) return;
    const i=this.stash.indexOf(item); if(i<0) return;
    this.stash.splice(i,1); this.addItem(item);
    this.sfx('open'); this.hud.refreshStash();
  }

  // ---- crafting (Blacksmith forge): reforge + upgrade gear for gold ----
  openCraft(name){ this.paused=true; this.craftName=name||'Forge'; this.hud.openCraft(); }
  reforgeItem(item){
    if(!item || item.type==='consumable') return;
    const cost=reforgeCost(item);
    if(this.player.gold<cost){ this.toast('Not enough gold ('+cost+'g)'); this.sfx('hurt'); return; }
    const i=this.inventory.indexOf(item); if(i<0) return;
    this.player.gold-=cost;
    this.inventory[i]=reforge(item);
    this.sfx('levelup'); this.toast('Reforged '+this.inventory[i].name+'!');
    this.hud.refresh();
    return this.inventory[i];
  }
  upgradeItem(item){
    if(!item || !canUpgrade(item)) { this.toast('Cannot upgrade further.'); return; }
    const cost=upgradeCost(item);
    if(this.player.gold<cost){ this.toast('Not enough gold ('+cost+'g)'); this.sfx('hurt'); return; }
    const i=this.inventory.indexOf(item); if(i<0) return;
    this.player.gold-=cost;
    this.inventory[i]=upgrade(item);
    this.sfx('levelup'); this.toast('Upgraded to '+this.inventory[i].name+'!');
    this.hud.refresh();
    return this.inventory[i];
  }
  // Blacksmith can remove an enchant from a weapon and return the matching scroll
  // to the player's bag. Costs gold (75% of base item price). The same item ref
  // stays in the bag slot since we mutate in place.
  stripEnchantFromItem(item){
    if(!item || item.type==='consumable') return;
    const cost=stripEnchantCost(item);
    if(!cost){ this.toast('No enchant to remove.'); return; }
    if(this.player.gold<cost){ this.toast('Not enough gold ('+cost+'g)'); this.sfx('hurt'); return; }
    const i=this.inventory.indexOf(item); if(i<0) return;
    this.player.gold-=cost;
    const removed=stripWeaponEnchant(item);
    if(removed){ this.addItem(makeItem(removed, 1)); }
    this.sfx('open'); this.toast('Removed enchant from '+item.name+(removed?': returned scroll_'+removed:''));
    this.hud.refresh();
    return item;
  }

  // ---- enchantment (arcane anvil) ----
  // Open the enchant modal. The player picks a weapon from the bag, then a
  // scroll, then pays the gold cost. The item is mutated in place (so the
  // equipped weapon keeps its enchant after save/load) and gets a glow tint
  // on the player sprite.
  openEnchant(name){ this.paused=true; this.enchantName=name||'Anvil'; this.hud.openEnchant(); }
  // Bind `scrollId` (a scroll_* consumable) to `weapon` (an inventory item).
  // Returns the enchanted item on success, null on failure.
  enchantItemWith(weapon, scrollId){
    if(!weapon || weapon.type !== 'weapon'){ this.toast('Need a weapon to enchant.'); this.sfx('hurt'); return null; }
    const sc = CATALOG[scrollId];
    if(!sc || !sc.enchant){ this.toast('That is not a scroll.'); return null; }
    const gold = enchantCost(weapon);
    if(this.player.gold < gold){ this.toast('Not enough gold ('+gold+'g)'); this.sfx('hurt'); return null; }
    // consume one scroll from the inventory
    const slot = this.inventory.find(it => it.id === scrollId && it.type === 'consumable' && it.qty > 0);
    if(!slot){ this.toast('You do not have that scroll.'); this.sfx('hurt'); return null; }
    slot.qty--;
    if(slot.qty <= 0){ this.removeItem(slot); const hi = this.hotbar.indexOf(scrollId); if(hi >= 0) this.hotbar[hi] = null; }
    // pay gold + apply
    this.player.gold -= gold;
    const wasAlready = weapon.enchant;
    applyEnchant(weapon, sc.enchant);
    // visual: big particle burst in the element color
    const info = enchantInfo(sc.enchant);
    if(info){ this.spawnParticles(this.player.x, this.player.y, info.color, 28); }
    this.sfx('levelup');
    this.toast(weapon.name + (wasAlready ? ' re-enchanted to ' : ' enchanted: ') + (info ? info.name : sc.enchant));
    if(this.achievements) this.achievements.onEnchant();
    this.hud.refresh();
    return weapon;
  }

  // ---- skills ----
  learnSkill(id){
    const reason=canLearn(id, this.player.skills, this.player.skillPoints);
    if(reason){ this.toast(reason); this.sfx('hurt'); return; }
    this.player.skills[id]=(this.player.skills[id]||0)+1;
    this.player.skillPoints-=SKILLS[id].cost;
    this.player.recompute();
    this.player.hp=Math.min(this.player.hp,this.player.hpMax);
    this.sfx('levelup'); this.toast('Learned '+SKILLS[id].name); this.hud.refreshSkills();
    // Achievement: count unique branches with at least 1 skill learned
    if(this.achievements){
      const branches = new Set();
      for(const k of Object.keys(this.player.skills)){
        if(this.player.skills[k] > 0 && SKILLS[k] && SKILLS[k].branch) branches.add(SKILLS[k].branch);
      }
      this.achievements.onSkillBranches(branches.size);
    }
  }

  // ===== ACHIEVEMENT UNLOCK =====
  // Called by the tracker after a stat crosses its goal. Shows a Steam-style
  // toast and queues a celebratory sfx. The toast queue is rendered by the
  // HUD; the game just hands entries to it.
  _achievementUnlocked(a){
    this.sfx('levelup');
    if(this.hud && this.hud.achievementToast) this.hud.achievementToast(a);
    // also a regular in-screen toast as a backup
    this.toast('Achievement: ' + a.name);
  }

  // ---- lifecycle ----
  onPlayerDeath(){ this.paused=true;
    const ds=document.getElementById('death-screen'); ds.classList.remove('hidden'); ds.classList.add('flex'); }
  respawn(){
    this.player.dead=false; this.player.hp=this.player.hpMax; this.player.mp=this.player.mpMax;
    this.player.statuses={}; this.player.invuln=2.5; this.paused=false;
    // respawn at the last checkpoint (the area you entered), not always the hub
    const cp=this.checkpoint || { map:'meadow', tx:30, ty:24 };
    this.loadMap(cp.map, cp.tx, cp.ty, false);
    const ds=document.getElementById('death-screen'); ds.classList.add('hidden'); ds.classList.remove('flex');
  }

  // ===== COMPANION SYSTEM =====
  recruitCompanion(id){
    const def=COMPANIONS[id]; if(!def) return;
    if(this._companions.length>=1) return; // max 1 companion for now
    const c=new Companion(def.name, def.icon, this.player.x+20, this.player.y+20);
    c.color=def.color;
    c.kind=id; // remember which companion for ability dispatch
    this._companions.push(c);
    this.toast(def.name+' joined your party! Press G for '+this._companionAbilityName(id));
    this.sfx('pickup');
    if(this.achievements) this.achievements.onRecruited();
  }
  // Resolve the ability display name for a companion kind
  _companionAbilityName(kind){
    if(!kind) return 'their ability';
    return COMPANION_ABILITY_NAMES[kind] || 'their ability';
  }
  // Player presses G to trigger the active companion's ability
  triggerCompanionAbility(){
    if(!this._companions.length){ this.toast('No companion yet.'); return; }
    const c=this._companions[0];
    if(!c.alive){ this.toast(c.name+' is downed.'); return; }
    if(c._abilityCd>0){ this.toast('On cooldown: '+(c._abilityCd|0)+'s'); return; }
    c.triggerAbility(this, this.player);
  }
  dismissCompanion(){
    if(!this._companions.length) return;
    const c=this._companions.pop();
    this.toast(c.name+' left the party.');
  }

  _buildState(){
    // Pull current keybind overrides so they follow the save. The rebind UI
    // owns the canonical override map; we read via the public helper so
    // fallow sees this as a real consumer of getKeybindOverrides.
    let keybinds = {};
    try { keybinds = getKeybindOverrides() || {}; }
    catch(e) { keybinds = {}; }
    return { ...this.player.serialize(), slot:this.slot,
      map:this.currentMap, inventory:this.inventory, hotbar:this.hotbar,
      playtime:this.playtime, openedChests:this.openedChests, stash:this.stash,
      bossesDead:this.bossesDead, checkpoint:this.checkpoint,
      quests:this.quests?this.quests.serialize():undefined,
      achievements:this.achievements?this.achievements.serialize():undefined,
      boughtSpells:this._boughtSpells,
      username:this._username,
      heat:this.player.heat, _overheatCd:this.player._overheatCd,
      ammo:{...this.player.ammo},
      keybinds,
      tutorial: this.tutorial ? this.tutorial.detachSaveState() : undefined,
      weaponSkills:this._weaponSkills,
      companions:this._companions.map(c=>c.serialize()) };
  }
  save(){
    const u=this._username; if(u) SaveSystem.saveUser(u,this.slot,this._buildState()); else SaveSystem.save(this.slot,this._buildState());
    this.toast('Game Saved!');
  }
  // silent autosave (subtle indicator, no big toast); skips while a menu is paused mid-action
  autosave(reason){
    if(!this.running || this.player.dead) return;
    const u=this._username; const state=this._buildState();
    if(u){ SaveSystem.saveUser(u,this.slot,state); }
    else { SaveSystem.save(this.slot,state); }
    this._autoT=0;
    this.hud.autosaveFlash(reason||'Autosaved');
  }
  // dungeons/biome-boss maps: quick-escape to Aldermere City hub
  canTeleportTown(){ const m=this.currentMap; return m&&(m.startsWith('dungeon')||m.startsWith('cave')||m.startsWith('desert')||m.startsWith('snow')||m.startsWith('swamp')||m.startsWith('forest_deep')||m.startsWith('meadow_glade')); }
  teleportToTown(){
    // reset combat state so the player isn't stuck mid-fight
    this.player.statuses={}; this.enemies=[]; this.projectiles=[]; this.boss=null;
    this.audio.setMusic(MAPS.city.music,false);
    this.loadMap('city', 24, 28, false);
    this.toast('Returned to Aldermere City');
  }
  quitToMenu(){ this.running=false; location.reload(); }
  resize(){ this.canvas.width=window.innerWidth; this.canvas.height=window.innerHeight;
    this.ctx.imageSmoothingEnabled=false; if(this.cam) this.cam.resize(this.canvas.width,this.canvas.height); }
}






