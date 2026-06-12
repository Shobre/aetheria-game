import { World, Camera, TILE } from './world.js';
import { Player } from '../entities/player.js';
import { Enemy, Projectile, Particle } from '../entities/enemy.js';
import { HUD } from '../ui/hud.js';
import { Audio } from './audio.js';
import { SaveSystem } from './save.js';
import { MAPS } from '../data/maps.js';
import { CATALOG, makeItem, EQUIP_SLOTS } from '../data/gear.js';
import { SKILLS, canLearn } from '../data/skilltree.js';
import { Boss, BOSSES } from '../entities/boss.js';
import { QuestLog } from './quests.js';
import { rollRarity, applyRarity, rarityName } from '../data/affixes.js';

// difficulty scale per map (deeper = tougher enemies)
const MAP_SCALE = { meadow:1, forest:1.25, desert:1.45, cave:1.6, dungeon1:1.9, house1:1,
  snow:1.7, swamp:1.8, dungeon2:2.3 };

export class Game {
  constructor(canvas, input){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.input=input; this.audio=new Audio();
    this.running=false; this.paused=false;
    this.settings={ shake:true, minimap:true, fps:false };
    this.enemies=[]; this.projectiles=[]; this.particles=[]; this.golds=[]; this.drops=[];
    this.playtime=0; this._lastT=0; this._fpsT=0; this._fpsCount=0; this._fps=60;
    this.nearInteract=null; this.transition=0;
    this.boss=null; this.killedEnemies={}; this.bossesDead={};
  }

  start(state){
    this.state=state; this.slot=state.slot;
    this.cam=new Camera(this.canvas.width, this.canvas.height);
    this.player=new Player(state.pos.x, state.pos.y, state);
    this.inventory=state.inventory.map(i=>({...i}));
    this.hotbar=[...state.hotbar];
    this.openedChests=state.openedChests||{};
    this.killedEnemies=state.killedEnemies||{};
    this.bossesDead=state.bossesDead||{};
    this.quests=new QuestLog(this, state);
    this.hud=new HUD(this);
    this.loadMap(state.map, state.pos.x/TILE, state.pos.y/TILE, true);
    this.player.invuln=2.5;
    this.running=true; this.paused=false;
    this._lastT=performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  // Load a map; spawn enemies ONCE here (no waves). tx/ty in tile coords.
  loadMap(mapId, tx, ty, keepPos){
    this.world=new World(mapId);
    this.currentMap=mapId;
    if(!keepPos){ this.player.x=tx*TILE+TILE/2; this.player.y=ty*TILE+TILE/2; }
    // restore opened-chest state for this map
    this.world.chests.forEach(c=>{ if(this.openedChests[mapId+':'+c.idx]) c.opened=true; });
    // spawn enemies on load (ONCE; persisted-dead ones don't respawn)
    this.enemies=[]; this.projectiles=[]; this.golds=[]; this.drops=[]; this.boss=null;
    const def=MAPS[mapId];
    const scale=MAP_SCALE[mapId]||1;
    let seed=def.seed*7+13;
    const rand=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    const deadSet=this.killedEnemies[mapId]||{};
    for(let i=0;i<(def.enemies.count||0);i++){
      const pos=this.world.randomFloor(rand);
      // don't spawn on top of player
      if(Math.hypot(pos.x-this.player.x,pos.y-this.player.y)<200){ i--; continue; }
      const types=def.enemies.types;
      const t=types[Math.floor(rand()*types.length)];
      if(deadSet[i]) continue; // already cleared this slot
      const e=new Enemy(pos.x,pos.y,t,scale); e.spawnIdx=i; this.enemies.push(e);
    }
    // boss for this map (if not already defeated)
    for(const bid in BOSSES){
      if(BOSSES[bid].map===mapId && !this.bossesDead[bid]){
        this.boss=new Boss(bid);
        setTimeout(()=>{ if(this.boss && !this.boss.dead) this.toast('⚠ '+this.boss.def.name+' awakens!'); }, 400);
      }
    }
    this.cam.follow(this.player, this.world);
    this.transition=0.6; // fade-in
    this.audio.setMusic(def.music, !!this.boss);
    this.toast('Entering '+def.name);
    if(this.quests) this.quests.onReach(mapId);
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
    this.player.update(dt,this.input,this.world,this.cam,this);
    this.cam.follow(this.player,this.world);
    if(!this.settings.shake) this.cam.shake=0;

    for(const e of this.enemies) e.update(dt,this.player,this.world,this);
    this.enemies=this.enemies.filter(e=>!e.dead);
    if(this.boss){ this.boss.update(dt,this.player,this.world,this); if(this.boss.dead) this.boss=null; }

    for(const p of this.projectiles) p.update(dt,this.world,this.enemies,this);
    this.projectiles=this.projectiles.filter(p=>!p.dead);

    for(const p of this.particles) p.update(dt);
    this.particles=this.particles.filter(p=>!p.dead);

    // gold pickups (magnet)
    for(const g of this.golds){
      const d=Math.hypot(g.x-this.player.x,g.y-this.player.y);
      if(d<70){ g.x+=(this.player.x-g.x)*0.18; g.y+=(this.player.y-g.y)*0.18; }
      if(d<16){ g.dead=true; const amt=this.player.gainGold(g.amount,this); this.sfx('pickup');
        this.floater('+'+amt+'g',this.player.x,this.player.y-30,'#ffcf4d'); }
    }
    this.golds=this.golds.filter(g=>!g.dead);

    // item drops pickup
    for(const it of this.drops){
      const d=Math.hypot(it.x-this.player.x,it.y-this.player.y);
      if(d<22){ it.dead=true; const obj=it.item?it.item:makeItem(it.id,1); this.addItem(obj); this.sfx('pickup');
        this.toast('Picked up '+(obj.name||CATALOG[it.id].name)); }
    }
    this.drops=this.drops.filter(it=>!it.dead);

    this._checkInteract();
    this.hud.refresh();
    if(this.settings.minimap) this.hud.drawMinimap();
    this.input.lateUpdate();
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
      if(d<nd){ let label=n.shop?'Shop ('+n.name+')':'Talk to '+n.name;
        if(this.quests && !n.shop){ const gs=this.quests.giverState(n.name);
          if(gs.turnIn.length) label='Turn in quest ('+n.name+')';
          else if(gs.available.length) label='Accept quest ('+n.name+')'; }
        near={type:'npc',ref:n,label}; nd=d; } }
    for(const c of this.world.chests){ if(c.opened) continue;
      const d=Math.hypot(c.wx+16-this.player.x,c.wy+16-this.player.y);
      if(d<nd){ near={type:'chest',ref:c,label:'Open Chest'}; nd=d; } }
    this.nearInteract=near;
    if(near){ this.hud.showInteract(near.label);
      if(this.input.wasPressed('f')) this._doInteract(near); }
    else this.hud.hideInteract();
  }
  _usePortal(p){
    if(this.transition>0) return; // debounce during fade
    this.loadMap(p.to, p.tx, p.ty, false);
    this.sfx('open');
  }
  _doInteract(near){
    if(near.type==='npc'){
      const n=near.ref;
      if(n.shop){ this.openShop(); return; }
      // quest handling: turn in completed, else offer next available
      if(this.quests){
        const gs=this.quests.giverState(n.name);
        if(gs.turnIn.length){ this.quests.turnIn(gs.turnIn[0]); return; }
        if(gs.available.length){ this.quests.accept(gs.available[0]); return; }
        if(gs.inProgress.length){ this.toast(n.name+': Come back when the task is done.'); return; }
      }
      n._line=(n._line||0); this.toast(n.name+': '+n.lines[n._line%n.lines.length]); n._line++;
    } else if(near.type==='chest'){
      const c=near.ref; if(c.opened) return;
      c.opened=true; this.openedChests[this.currentMap+':'+c.idx]=true; this.sfx('open');
      const loot=c.loot;
      if(loot.type==='gold'){ const amt=this.player.gainGold(loot.amount,this); this.toast('Found '+amt+' gold!'); }
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
      ctx.font='18px serif'; ctx.textAlign='center';
      ctx.fillText(CATALOG[it.id].icon, sx, sy+6+Math.sin(performance.now()/300)*2); }
    // depth sort
    const ents=[this.player,...this.enemies]; if(this.boss) ents.push(this.boss);
    ents.sort((a,b)=>a.y-b.y);
    for(const e of ents) e.draw(ctx,this.cam);
    for(const p of this.projectiles) p.draw(ctx,this.cam);
    for(const p of this.particles) p.draw(ctx,this.cam);
    // transition fade
    if(this.transition>0){ ctx.fillStyle='rgba(0,0,0,'+(this.transition/0.6)+')';
      ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
  }

  // draw ❗/❓/★ markers above quest-giver NPCs
  _drawQuestMarkers(ctx){
    if(!this.quests || !this.world) return;
    const bob=Math.sin(performance.now()/250)*3;
    ctx.textAlign='center';
    for(const n of this.world.npcs){
      if(n.shop) continue;
      const gs=this.quests.giverState(n.name);
      let m=null,col='#ffcf4d';
      if(gs.turnIn.length){ m='★'; col='#ffcf4d'; }
      else if(gs.available.length){ m='❗'; col='#ffe24d'; }
      else if(gs.inProgress.length){ m='❓'; col='#9aa'; }
      if(m){ const sx=n.wx+16-this.cam.x, sy=n.wy-6-this.cam.y+bob;
        ctx.font='16px serif'; ctx.fillStyle=col;
        ctx.fillText(m, sx, sy); }
    }
  }

  // ---- combat hooks ----
  doMeleeAttack(p){
    const reach=44, arc=1.15;
    for(const e of this.enemies){ if(e.dead) continue;
      const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy);
      if(d<reach+e.r){
        const ang=Math.atan2(dy,dx);
        let diff=Math.abs(((ang-p._aim+Math.PI)%(2*Math.PI))-Math.PI);
        if(diff<arc){
          let dmg=p.atk*p.dmgMul;
          const crit=Math.random()*100<p.crit;
          if(crit) dmg*=2;
          dmg=Math.round(dmg);
          e.hit(dmg,ang,this,6);
          if(crit) this.floater('CRIT '+dmg,e.x,e.y-26,'#ffcf4d');
          if(p.lifesteal>0){ const heal=dmg*p.lifesteal; p.heal(heal,this); }
          this.cam.shake=Math.min(this.cam.shake+3,8);
        }
      }
    }
  }
  castSpell(p, kind){
    let opts;
    if(kind==='fire') opts={speed:6,dmg:Math.round((18+p.level*2)*p.spellMul),r:6,color:'#e8623d',kind:'fire',life:1.0};
    else if(kind==='ice') opts={speed:5,dmg:Math.round((10+p.level)*p.spellMul),r:7,color:'#7fd8ff',kind:'ice',life:1.2};
    else if(kind==='meteor') opts={speed:4,dmg:Math.round((60+p.level*4)*p.spellMul),r:12,color:'#ff7a2a',kind:'fire',life:1.4,aoe:90};
    this.projectiles.push(new Projectile(p.x,p.y,p._aim,opts));
  }
  throwBomb(){ const p=this.player;
    this.projectiles.push(new Projectile(p.x,p.y,p._aim,{speed:4,dmg:40,r:8,color:'#444',kind:'fire',life:0.8,aoe:70})); }
  // enemy ranged attack
  enemyShoot(x,y,angle,dmg){
    this.projectiles.push(new Projectile(x,y,angle,{speed:3.5,dmg,r:5,color:'#e8413c',kind:'fire',life:2.0,hostile:true}));
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
      this.addItem(item); this.toast('★ '+rarityName(item)+' '+item.name+' obtained!'); }
    this.bossesDead[boss.id]=true;
    this.audio.setMusic(MAPS[this.currentMap].music,false);
    if(this.quests) this.quests.onKill(null,true,boss.id);
    this.toast(boss.def.name+' defeated!');
    this.sfx('levelup');
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
  // enemy death bookkeeping: quest progress + per-map persistence + gear drop chance
  onEnemyKilled(e){
    if(this.quests) this.quests.onKill(e.type,false,null);
    if(e.spawnIdx!=null && e.spawnIdx>=0){
      (this.killedEnemies[this.currentMap]=this.killedEnemies[this.currentMap]||{})[e.spawnIdx]=true;
    }
    // tougher foes can drop rolled gear
    const tough=['brute','golem','yeti','croaker','skeleton'];
    if(tough.includes(e.type) && Math.random()<0.25) this.dropGear(e.x,e.y,0.3);
  }
  floater(t,x,y,c){ this.hud.floater(t,x,y,c); }
  toast(m){ this.hud.toast(m); }
  sfx(n){ this.audio.play(n); }

  // ---- inventory / equipment ----
  addItem(item){
    if(!item) return;
    if(item.type==='consumable'){
      const ex=this.inventory.find(i=>i.id===item.id && i.type==='consumable');
      if(ex){ ex.qty+=item.qty; } else this.inventory.push({...item});
      if(!this.hotbar.includes(item.id)){ const idx=this.hotbar.indexOf(null); if(idx>=0) this.hotbar[idx]=item.id; }
    } else {
      this.inventory.push({...item}); // gear stacks individually (keeps rarity/affixes)
    }
    if(this.quests) this.quests.onPickup();
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
  openShop(){ this.paused=true; this.hud.openShop(); }
  buyItem(id){
    const c=CATALOG[id]; if(!c) return;
    if(this.player.gold < c.price){ this.toast('Not enough gold!'); this.sfx('hurt'); return; }
    this.player.gold-=c.price; this.addItem(makeItem(id, c.type==='consumable'?1:1));
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

  // ---- skills ----
  learnSkill(id){
    const reason=canLearn(id, this.player.skills, this.player.skillPoints);
    if(reason){ this.toast(reason); this.sfx('hurt'); return; }
    this.player.skills[id]=(this.player.skills[id]||0)+1;
    this.player.skillPoints-=SKILLS[id].cost;
    this.player.recompute();
    this.player.hp=Math.min(this.player.hp,this.player.hpMax);
    this.sfx('levelup'); this.toast('Learned '+SKILLS[id].name); this.hud.refreshSkills();
  }

  // ---- lifecycle ----
  onPlayerDeath(){ this.paused=true;
    const ds=document.getElementById('death-screen'); ds.classList.remove('hidden'); ds.classList.add('flex'); }
  respawn(){
    this.player.dead=false; this.player.hp=this.player.hpMax; this.player.mp=this.player.mpMax;
    this.player.invuln=2.5; this.paused=false;
    // respawn back in meadow hub
    this.loadMap('meadow', 30, 24, false);
    const ds=document.getElementById('death-screen'); ds.classList.add('hidden'); ds.classList.remove('flex');
  }
  save(){
    const st={ ...this.player.serialize(), slot:this.slot,
      map:this.currentMap, inventory:this.inventory, hotbar:this.hotbar,
      playtime:this.playtime, openedChests:this.openedChests,
      killedEnemies:this.killedEnemies, bossesDead:this.bossesDead,
      quests:this.quests?this.quests.serialize():undefined };
    SaveSystem.save(this.slot, st); this.toast('Game Saved!');
  }
  quitToMenu(){ this.running=false; location.reload(); }
  resize(){ this.canvas.width=window.innerWidth; this.canvas.height=window.innerHeight;
    this.ctx.imageSmoothingEnabled=false; if(this.cam) this.cam.resize(this.canvas.width,this.canvas.height); }
}
