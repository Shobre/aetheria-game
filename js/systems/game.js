import { World, Camera, TILE } from './world.js';
import { Player } from '../entities/player.js';
import { Enemy, Projectile, Particle } from '../entities/enemy.js';
import { HUD, ITEMS } from '../ui/hud.js';
import { Audio } from './audio.js';
import { SaveSystem } from './save.js';

export class Game {
  constructor(canvas, input){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.input=input; this.audio=new Audio();
    this.running=false; this.paused=false;
    this.settings={ shake:true, minimap:true, fps:false };
    this.enemies=[]; this.projectiles=[]; this.particles=[]; this.golds=[];
    this.lastSpawn=0; this.playtime=0;
    this._lastT=0; this._fpsT=0; this._fpsCount=0; this._fps=60;
    this.nearInteract=null;
  }

  start(state){
    this.state=state; this.slot=state.slot;
    this.world=new World(60,45, 1234+state.slot);
    this.cam=new Camera(this.canvas.width, this.canvas.height);
    this.player=new Player(state.pos.x, state.pos.y, state);
    this.inventory=state.inventory.map(i=>({...i}));
    this.hotbar=[...state.hotbar];
    this.hud=new HUD(this);
    this.hud.refresh();
    // initial enemies
    this.enemies=[];
    this._spawnWave(4);
    this.player.invuln=3; // spawn grace period
    this.running=true; this.paused=false;
    this._lastT=performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  _spawnWave(n){
    const types=['slime','slime','bat','brute'];
    for(let i=0;i<n;i++){
      let x,y,tries=0;
      do{ x=2+Math.random()*(this.world.cols-4); y=2+Math.random()*(this.world.rows-4);
        x*=TILE; y*=TILE; tries++; }
      while((Math.hypot(x-this.player.x,y-this.player.y)<340 || this.world.isSolid(x,y)) && tries<30);
      this.enemies.push(new Enemy(x,y, types[Math.floor(Math.random()*types.length)]));
    }
  }

  _loop(now){
    if(!this.running) return;
    let dt=(now-this._lastT)/1000; this._lastT=now;
    if(dt>0.05) dt=0.05; // clamp
    if(!this.paused){ this.playtime+=dt; this.update(dt); }
    this.render();
    // fps
    this._fpsCount++; this._fpsT+=dt;
    if(this._fpsT>=0.5){ this._fps=Math.round(this._fpsCount/this._fpsT); this._fpsCount=0; this._fpsT=0;
      this.hud.setFps(this._fps, this.settings.fps); }
    requestAnimationFrame(this._loop.bind(this));
  }

  update(dt){
    this.player.update(dt, this.input, this.world, this.cam, this);
    this.cam.follow(this.player, this.world);
    if(!this.settings.shake) this.cam.shake=0;

    for(const e of this.enemies) e.update(dt, this.player, this.world, this);
    this.enemies=this.enemies.filter(e=>!e.dead);

    for(const p of this.projectiles) p.update(dt, this.world, this.enemies, this);
    this.projectiles=this.projectiles.filter(p=>!p.dead);

    for(const p of this.particles) p.update(dt);
    this.particles=this.particles.filter(p=>!p.dead);

    // gold pickups
    for(const g of this.golds){
      const d=Math.hypot(g.x-this.player.x,g.y-this.player.y);
      if(d<60){ g.x+=(this.player.x-g.x)*0.15; g.y+=(this.player.y-g.y)*0.15; }
      if(d<14){ g.dead=true; this.player.gold+=g.amount; this.sfx('pickup');
        this.floater('+'+g.amount+'g', this.player.x, this.player.y-30, '#ffcf4d'); }
    }
    this.golds=this.golds.filter(g=>!g.dead);

    // respawn waves
    if(this.enemies.length<3 && this.playtime-this.lastSpawn>5){
      this.lastSpawn=this.playtime; this._spawnWave(3+Math.floor(this.player.level/2));
    }

    // interaction detection (F)
    this._checkInteract();

    this.hud.refresh();
    if(this.settings.minimap) this.hud.drawMinimap();
    this.input.lateUpdate();
  }

  _checkInteract(){
    let near=null, nd=48;
    for(const n of this.world.npcs){ const d=Math.hypot(n.x+16-this.player.x,n.y+16-this.player.y);
      if(d<nd){ near={type:'npc',ref:n,label:'Talk to '+n.name}; nd=d; } }
    for(const c of this.world.chests){ if(c.opened) continue;
      const d=Math.hypot(c.x+16-this.player.x,c.y+16-this.player.y);
      if(d<nd){ near={type:'chest',ref:c,label:'Open Chest'}; nd=d; } }
    this.nearInteract=near;
    if(near){ this.hud.showInteract(near.label);
      if(this.input.wasPressed('f')) this._doInteract(near); }
    else this.hud.hideInteract();
  }
  _doInteract(near){
    if(near.type==='npc'){
      const n=near.ref; n._line=(n._line||0);
      this.toast(n.name+': '+n.lines[n._line % n.lines.length]); n._line++;
    } else if(near.type==='chest'){
      const c=near.ref; c.opened=true; this.sfx('open');
      if(c.loot.id==='gold'){ this.player.gold+=c.loot.amount;
        this.toast('Found '+c.loot.amount+' gold!'); }
      else { this.addItem(c.loot); this.toast('Found '+c.loot.name+'!'); }
    }
  }

  render(){
    const ctx=this.ctx;
    ctx.fillStyle='#0c0e16'; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    this.world.draw(ctx, this.cam);
    // gold
    for(const g of this.golds){ ctx.fillStyle='#ffcf4d';
      ctx.beginPath(); ctx.arc(g.x-this.cam.x,g.y-this.cam.y,4,0,7); ctx.fill(); }
    // depth sort entities by y
    const ents=[this.player,...this.enemies].sort((a,b)=>a.y-b.y);
    for(const e of ents) e.draw(ctx,this.cam);
    for(const p of this.projectiles) p.draw(ctx,this.cam);
    for(const p of this.particles) p.draw(ctx,this.cam);
  }

  // ---- combat hooks called by player ----
  doMeleeAttack(p){
    const reach=42, arc=1.1;
    for(const e of this.enemies){ if(e.dead) continue;
      const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy);
      if(d<reach+e.r){
        const ang=Math.atan2(dy,dx);
        let diff=Math.abs(((ang-p._aim+Math.PI)%(2*Math.PI))-Math.PI);
        if(diff<arc){ const dmg=10+this.player.level*2;
          e.hit(dmg, ang, this, 6); this.cam.shake=Math.min(this.cam.shake+3,8); }
      }
    }
  }
  castSpell(p, kind){
    const opts = kind==='fire'
      ? {speed:6,dmg:18+p.level*2,r:6,color:'#e8623d',kind:'fire',life:1.0}
      : {speed:5,dmg:10+p.level,r:7,color:'#7fd8ff',kind:'ice',life:1.2};
    this.projectiles.push(new Projectile(p.x,p.y,p._aim,opts));
  }
  throwBomb(){
    const p=this.player;
    this.projectiles.push(new Projectile(p.x,p.y,p._aim,
      {speed:4,dmg:35,r:8,color:'#444',kind:'fire',life:0.8}));
  }

  spawnParticles(x,y,color,n){ for(let i=0;i<n;i++) this.particles.push(new Particle(x,y,color)); }
  dropGold(x,y,amount){ this.golds.push({x,y,amount,dead:false}); }
  floater(t,x,y,c){ this.hud.floater(t,x,y,c); }
  toast(m){ this.hud.toast(m); }
  sfx(n){ this.audio.play(n); }
  get camRef(){ return this.cam; }

  // ---- inventory ----
  addItem(item){
    const ex=this.inventory.find(i=>i.id===item.id);
    if(ex && item.qty){ ex.qty+=item.qty; } else this.inventory.push({...item});
    // auto-assign to first empty hotbar slot
    if(!this.hotbar.includes(item.id)){
      const idx=this.hotbar.indexOf(null); if(idx>=0) this.hotbar[idx]=item.id;
    }
    this.hud.refresh();
  }
  useHotbar(i){ this.hud.setActiveSlot(i); const id=this.hotbar[i]; if(id) this.useItemById(id); }
  useItemById(id){
    const item=this.inventory.find(i=>i.id===id); if(!item||!ITEMS[id]) return;
    if(item.qty!==undefined){ if(item.qty<=0) return; item.qty--; }
    ITEMS[id].use(this);
    if(item.qty<=0){ this.inventory=this.inventory.filter(i=>i!==item);
      const hi=this.hotbar.indexOf(id); if(hi>=0) this.hotbar[hi]=null; }
    this.hud.refresh();
  }

  // ---- lifecycle ----
  onPlayerDeath(){ this.paused=true;
    document.getElementById('death-screen').classList.remove('hidden');
    document.getElementById('death-screen').classList.add('flex'); }
  respawn(){
    this.player.dead=false; this.player.hp=this.player.hpMax; this.player.mp=this.player.mpMax;
    this.player.x=400; this.player.y=300; this.player.invuln=2;
    this.enemies=[]; this._spawnWave(4); this.paused=false;
    const ds=document.getElementById('death-screen'); ds.classList.add('hidden'); ds.classList.remove('flex');
  }
  save(){
    const st={ ...this.player.serialize(), slot:this.slot,
      inventory:this.inventory, hotbar:this.hotbar, playtime:this.playtime };
    SaveSystem.save(this.slot, st);
    this.toast('Game Saved!');
  }
  quitToMenu(){ this.running=false; location.reload(); }
  resize(){ this.canvas.width=window.innerWidth; this.canvas.height=window.innerHeight;
    this.ctx.imageSmoothingEnabled=false;
    if(this.cam) this.cam.resize(this.canvas.width,this.canvas.height); }
}
