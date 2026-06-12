import { World, Camera, TILE } from './world.js';
import { Player } from '../entities/player.js';
import { Enemy, Projectile, Particle } from '../entities/enemy.js';
import { HUD } from '../ui/hud.js';
import { Audio } from './audio.js';
import { SaveSystem } from './save.js';
import { MAPS } from '../data/maps.js';
import { CATALOG, makeItem, EQUIP_SLOTS } from '../data/gear.js';
import { SKILLS, canLearn } from '../data/skilltree.js';

// difficulty scale per map (deeper = tougher enemies)
const MAP_SCALE = { meadow:1, forest:1.25, desert:1.45, cave:1.6, dungeon1:1.9, house1:1 };

export class Game {
  constructor(canvas, input){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.input=input; this.audio=new Audio();
    this.running=false; this.paused=false;
    this.settings={ shake:true, minimap:true, fps:false };
    this.enemies=[]; this.projectiles=[]; this.particles=[]; this.golds=[]; this.drops=[];
    this.playtime=0; this._lastT=0; this._fpsT=0; this._fpsCount=0; this._fps=60;
    this.nearInteract=null; this.transition=0;
  }

  start(state){
    this.state=state; this.slot=state.slot;
    this.cam=new Camera(this.canvas.width, this.canvas.height);
    this.player=new Player(state.pos.x, state.pos.y, state);
    this.inventory=state.inventory.map(i=>({...i}));
    this.hotbar=[...state.hotbar];
    this.openedChests=state.openedChests||{};
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
    // spawn enemies on load
    this.enemies=[]; this.projectiles=[]; this.golds=[]; this.drops=[];
    const def=MAPS[mapId];
    const scale=MAP_SCALE[mapId]||1;
    let seed=def.seed*7+13;
    const rand=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    for(let i=0;i<(def.enemies.count||0);i++){
      const pos=this.world.randomFloor(rand);
      // don't spawn on top of player
      if(Math.hypot(pos.x-this.player.x,pos.y-this.player.y)<200){ i--; continue; }
      const types=def.enemies.types;
      const t=types[Math.floor(rand()*types.length)];
      this.enemies.push(new Enemy(pos.x,pos.y,t,scale));
    }
    this.cam.follow(this.player, this.world);
    this.transition=0.6; // fade-in
    this.toast('Entering '+def.name);
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
      if(d<22){ it.dead=true; this.addItem(makeItem(it.id,1)); this.sfx('pickup');
        this.toast('Picked up '+CATALOG[it.id].name); }
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
      if(d<nd){ near={type:'npc',ref:n,label:n.shop?'Shop ('+n.name+')':'Talk to '+n.name}; nd=d; } }
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
    // gold coins
    for(const g of this.golds){ ctx.fillStyle='#ffcf4d';
      ctx.beginPath(); ctx.arc(g.x-this.cam.x,g.y-this.cam.y,4,0,7); ctx.fill();
      ctx.fillStyle='#c79a2a'; ctx.beginPath(); ctx.arc(g.x-this.cam.x,g.y-this.cam.y,2,0,7); ctx.fill(); }
    // item drops (sparkle)
    for(const it of this.drops){ const sx=it.x-this.cam.x, sy=it.y-this.cam.y;
      ctx.font='18px serif'; ctx.textAlign='center';
      ctx.fillText(CATALOG[it.id].icon, sx, sy+6+Math.sin(performance.now()/300)*2); }
    // depth sort
    const ents=[this.player,...this.enemies].sort((a,b)=>a.y-b.y);
    for(const e of ents) e.draw(ctx,this.cam);
    for(const p of this.projectiles) p.draw(ctx,this.cam);
    for(const p of this.particles) p.draw(ctx,this.cam);
    // transition fade
    if(this.transition>0){ ctx.fillStyle='rgba(0,0,0,'+(this.transition/0.6)+')';
      ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
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

  spawnParticles(x,y,color,n){ for(let i=0;i<n;i++) this.particles.push(new Particle(x,y,color)); }
  dropGold(x,y,amount){ this.golds.push({x,y,amount,dead:false}); }
  dropItem(x,y){
    // pick a random low-tier item to drop
    const pool=['potion','ether','bomb','potion_l'];
    const id=pool[Math.floor(Math.random()*pool.length)];
    this.drops.push({x,y,id,dead:false});
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
      this.inventory.push({...item}); // gear stacks individually
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
    this.hud.refresh();
  }
  // equip a gear item from inventory
  equipItem(item){
    if(!item || item.type==='consumable') return;
    const slot=item.type; // weapon/shield/armor/helm/ring
    const prevId=this.player.equipment[slot];
    this.player.equipment[slot]=item.id;
    this.removeItem(item);
    if(prevId){ this.addItem(makeItem(prevId,1)); } // old gear back to bag
    this.player.recompute();
    this.player.hp=Math.min(this.player.hp,this.player.hpMax);
    this.player.mp=Math.min(this.player.mp,this.player.mpMax);
    this.sfx('open'); this.hud.refresh();
  }
  unequip(slot){
    const id=this.player.equipment[slot]; if(!id) return;
    this.player.equipment[slot]=null;
    this.addItem(makeItem(id,1));
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
      playtime:this.playtime, openedChests:this.openedChests };
    SaveSystem.save(this.slot, st); this.toast('Game Saved!');
  }
  quitToMenu(){ this.running=false; location.reload(); }
  resize(){ this.canvas.width=window.innerWidth; this.canvas.height=window.innerHeight;
    this.ctx.imageSmoothingEnabled=false; if(this.cam) this.cam.resize(this.canvas.width,this.canvas.height); }
}
