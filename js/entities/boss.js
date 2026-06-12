import { applyStatus } from '../systems/status.js';

// Boss definitions. Each boss has phases (HP fractions) that change its move set.
// Attacks: 'burst' (radial projectiles), 'charge' (telegraph + dash), 'summon' (adds),
//          'poisonNova' (radial poison shots).
export const BOSSES = {
  bone_tyrant: {
    name:'The Bone Tyrant', map:'dungeon1', x:23, y:8,
    hp:900, dmg:22, r:26, color:'#e8e0d0', xp:600, gold:400,
    drop:'armor_chain', adds:['skeleton','archer'],
    phases:[
      { at:1.00, attacks:['charge','burst'],                  interval:2.4, tint:'#e8e0d0' },
      { at:0.66, attacks:['burst','summon','charge'],         interval:1.9, tint:'#fff0d8' },
      { at:0.33, attacks:['burst','burst','charge','summon'], interval:1.3, tint:'#ff9a6a' },
    ],
  },
  bog_witch: {
    name:'The Bog Witch', map:'dungeon2', x:23, y:9,
    hp:1300, dmg:26, r:24, color:'#74d83f', xp:1000, gold:700,
    drop:'sword_flame', adds:['spitter','scorpion'], poison:true,
    phases:[
      { at:1.00, attacks:['burst','poisonNova'],                   interval:2.2, tint:'#74d83f' },
      { at:0.66, attacks:['poisonNova','summon','burst'],          interval:1.7, tint:'#9aff5f' },
      { at:0.33, attacks:['burst','poisonNova','summon','charge'], interval:1.2, tint:'#c8ff8a' },
    ],
  },
};

export class Boss {
  constructor(bossId){
    const def = BOSSES[bossId];
    this.id = bossId; this.def = def; this.isBoss = true;
    this.x = def.x * 32 + 16; this.y = def.y * 32 + 16;
    this.r = def.r; this.color = def.color;
    this.hpMax = def.hp; this.hp = def.hp; this.dmg = def.dmg;
    this.xp = def.xp; this.speed = 1.0;
    this.dead = false; this.hitFlash = 0; this.frozen = 0;
    this.knockback = { x:0, y:0 }; this.statuses = {};
    this.phaseIdx = 0; this.atkTimer = def.phases[0].interval;
    this.state = 'idle'; this.stateTimer = 0; this.chargeDir = { x:0, y:0 };
    this.bob = 0; this.intro = 1.5; this.pending = null; this._touchCd = 0;
  }

  get phase(){ return this.def.phases[this.phaseIdx]; }

  _advancePhase(){
    const frac = this.hp / this.hpMax;
    let idx = 0;
    for(let i=0;i<this.def.phases.length;i++){ if(frac <= this.def.phases[i].at) idx = i; }
    if(idx !== this.phaseIdx){
      this.phaseIdx = idx;
      this.state = 'idle'; this.atkTimer = this.phase.interval * 0.6;
    }
  }

  update(dt, player, world, game){
    if(this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.bob += dt * 3;
    this._touchCd = Math.max(0, this._touchCd - dt);
    if(this.intro > 0){ this.intro -= dt; return; }
    if(this.frozen > 0){ this.frozen -= dt; }
    this.x += this.knockback.x; this.y += this.knockback.y;
    this.knockback.x *= 0.8; this.knockback.y *= 0.8;

    this._advancePhase();
    const dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx,dy)||1;
    const nx = dx/dist, ny = dy/dist;
    const slowed = this.frozen > 0 ? 0.4 : 1;

    if(this.state === 'idle'){
      if(dist > 80) this._move(nx*this.speed*slowed, ny*this.speed*slowed, world);
      this.atkTimer -= dt;
      if(this.atkTimer <= 0){ this._chooseAttack(player); }
      if(dist < this.r + player.r && this._touchCd<=0){ this._touchCd=1.0;
        player.takeDamage(this.dmg, Math.atan2(dy,dx), game); }
    } else if(this.state === 'telegraph'){
      this.stateTimer -= dt;
      if(this.stateTimer <= 0) this._fireAttack(player, world, game);
    } else if(this.state === 'charge'){
      this.stateTimer -= dt;
      this._move(this.chargeDir.x*this.speed*6, this.chargeDir.y*this.speed*6, world);
      if(dist < this.r + player.r + 4 && this._touchCd<=0){ this._touchCd=0.8;
        player.takeDamage(Math.round(this.dmg*1.3), Math.atan2(this.chargeDir.y,this.chargeDir.x), game); }
      if(this.stateTimer <= 0){ this.state='idle'; this.atkTimer=this.phase.interval; }
    }
  }

  _chooseAttack(player){
    const list = this.phase.attacks;
    this.pending = list[Math.floor(Math.random()*list.length)];
    if(this.pending === 'charge'){
      const dx=player.x-this.x, dy=player.y-this.y, d=Math.hypot(dx,dy)||1;
      this.chargeDir = { x:dx/d, y:dy/d };
      this.state='telegraph'; this.stateTimer=0.7;
    } else {
      this.state='telegraph'; this.stateTimer=0.6;
    }
  }

  _fireAttack(player, world, game){
    const pick = this.pending;
    if(pick === 'charge'){ this.state='charge'; this.stateTimer=0.5; return; }
    if(pick === 'burst'){
      const n = 12 + this.phaseIdx*4;
      for(let i=0;i<n;i++) game.enemyShoot(this.x, this.y, (i/n)*Math.PI*2, Math.round(this.dmg*0.6));
      game.cam.shake = 8;
    } else if(pick === 'poisonNova'){
      const n = 10 + this.phaseIdx*3;
      for(let i=0;i<n;i++) game.enemyShootStatus(this.x, this.y, (i/n)*Math.PI*2 + Math.random()*0.2, Math.round(this.dmg*0.5), 'poison');
      game.cam.shake = 6;
    } else if(pick === 'summon'){
      const adds = this.def.adds;
      for(let i=0;i<2+this.phaseIdx;i++){
        const a = Math.random()*Math.PI*2, d=80;
        game.spawnAdd(this.x+Math.cos(a)*d, this.y+Math.sin(a)*d, adds[Math.floor(Math.random()*adds.length)]);
      }
      game.toast(this.def.name + ' summons minions!');
    }
    this.state='idle'; this.atkTimer=this.phase.interval;
  }

  _move(dx,dy,world){
    if(!world.isSolid(this.x+dx+Math.sign(dx)*this.r, this.y)) this.x+=dx;
    if(!world.isSolid(this.x, this.y+dy+Math.sign(dy)*this.r)) this.y+=dy;
  }

  hit(dmg, angle, game, knock=4){
    if(this.dead || this.intro>0) return;
    this.hp -= dmg; this.hitFlash = 0.12;
    this.knockback.x += Math.cos(angle)*knock*0.25;
    this.knockback.y += Math.sin(angle)*knock*0.25;
    game.floater('-'+dmg, this.x, this.y - this.r - 4, '#fff');
    if(this.hp <= 0) this.kill(game);
  }
  freeze(t){ this.frozen = Math.max(this.frozen, t*0.5); }
  kill(game){ this.dead = true; game.onBossDefeated(this); }

  draw(ctx, cam){
    const sx=this.x-cam.x, sy=this.y-cam.y, bob=Math.sin(this.bob)*3;
    if(this.intro>0){ ctx.globalAlpha=0.5+0.5*Math.sin(performance.now()/100);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx,sy,this.r+10,0,7); ctx.fill(); ctx.globalAlpha=1; }
    let c = this.hitFlash>0 ? '#fff' : (this.frozen>0 ? '#9fd8ff' : this.phase.tint);
    if(this.state==='telegraph'){ c = Math.floor(performance.now()/80)%2 ? '#ff4040' : this.phase.tint; }
    ctx.fillStyle=c;
    ctx.beginPath(); ctx.arc(sx, sy+bob, this.r, 0, 7); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(sx, sy+bob, this.r*0.7, 0, 7); ctx.fill();
    ctx.fillStyle='#ff2a2a';
    ctx.fillRect(sx-8, sy-5+bob, 5, 5); ctx.fillRect(sx+3, sy-5+bob, 5, 5);
    ctx.fillStyle='#ffcf4d';
    for(let i=-2;i<=2;i++) ctx.fillRect(sx+i*7-1, sy-this.r-4+bob, 3, 7);
    if(this.state==='charge'){ ctx.strokeStyle='rgba(255,80,80,.6)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(sx,sy+bob,this.r+5,0,7); ctx.stroke(); }
  }
}
