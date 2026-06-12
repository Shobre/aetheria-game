import { TILE } from '../systems/world.js';
import { applyStatus, tickStatuses, drawStatusPips } from '../systems/status.js';
import { makeItem } from '../data/gear.js';
import { rollRarity, applyRarity } from '../data/affixes.js';

// Enemy configs per type. Behaviors: chase (touch), ranged (shoots), lunge (telegraph+dash).
// speeds are deliberately below the player's baseSpeed (1.9) so the player can
// always outrun foes; `view` = sight radius, `fov` = half-angle (rad) of the
// forward vision cone the enemy must see the player within to start chasing.
const CFG = {
  // meadow / generic
  slime:   { hp:34, speed:0.62, dmg:8,  xp:18, gold:[3,8],  color:'#7a3fb0', r:11, behavior:'chase', view:200, fov:1.0 },
  bat:     { hp:20, speed:1.15, dmg:6,  xp:14, gold:[2,6],  color:'#4a4a6a', r:9,  behavior:'chase', erratic:true, view:240, fov:1.6 },
  brute:   { hp:80, speed:0.5,  dmg:18, xp:42, gold:[10,22],color:'#9a3030', r:15, behavior:'lunge', view:220, fov:0.9 },
  // forest
  boar:    { hp:55, speed:0.78, dmg:14, xp:30, gold:[6,14], color:'#7a5a3a', r:13, behavior:'lunge', view:230, fov:0.8 },
  archer:  { hp:28, speed:0.55, dmg:10, xp:28, gold:[8,16], color:'#3a6a4a', r:10, behavior:'ranged', shootRange:300, shootCd:1.6, view:320, fov:1.1 },
  // desert
  scorpion:{ hp:40, speed:0.92, dmg:13, xp:32, gold:[7,15], color:'#c08030', r:12, behavior:'lunge', view:220, fov:0.9 },
  // cave
  golem:   { hp:120,speed:0.38, dmg:24, xp:60, gold:[15,30],color:'#5a6472', r:17, behavior:'chase', view:180, fov:0.8 },
  // dungeon
  skeleton:{ hp:46, speed:0.82, dmg:15, xp:34, gold:[9,18], color:'#d8d0c0', r:11, behavior:'lunge', view:240, fov:1.0 },
  // snow (Frostpeak)
  frostling:{ hp:36, speed:1.05, dmg:11, xp:30, gold:[6,14], color:'#bfe8ff', r:10, behavior:'chase', onHit:'chill', view:240, fov:1.2 },
  yeti:    { hp:140,speed:0.48, dmg:26, xp:70, gold:[16,32],color:'#e8f4ff', r:18, behavior:'lunge', onHit:'chill', view:220, fov:0.9 },
  // swamp (Murkbog)
  spitter: { hp:34, speed:0.5,  dmg:9,  xp:30, gold:[7,15], color:'#5a8a3a', r:11, behavior:'ranged', shootRange:320, shootCd:1.8, onHit:'poison', view:320, fov:1.1 },
  croaker: { hp:60, speed:0.78, dmg:14, xp:36, gold:[8,18], color:'#3a6a2a', r:13, behavior:'lunge', onHit:'poison', view:230, fov:0.9 },
};

export class Enemy {
  constructor(x,y,type='slime', levelScale=1){
    this.x=x; this.y=y; this.type=type;
    const c=CFG[type]||CFG.slime;
    this.base=c;
    this.r=c.r; this.speed=c.speed; this.color=c.color;
    this.behavior=c.behavior;
    // light level scaling so deeper maps are tougher
    this.hpMax=Math.round(c.hp*levelScale); this.hp=this.hpMax;
    this.dmg=Math.round(c.dmg*levelScale);
    this.xp=Math.round(c.xp*levelScale);
    this.goldMin=c.gold[0]; this.goldMax=c.gold[1];
    this.shootRange=c.shootRange||0; this.shootCd=c.shootCd||0; this.shootTimer=0;
    this.erratic=c.erratic||false;
    this.onHit=c.onHit||null;
    this.statuses={};
    // perception: vision cone + memory + home anchor (leash)
    this.view=c.view||220; this.fov=c.fov!=null?c.fov:1.0;
    this.homeX=x; this.homeY=y;
    this.alert=0;                  // >0 = actively hunting (sees/heard player)
    this.face={x:0,y:1};           // facing direction (drives the vision cone)
    this.hitFlash=0; this.knockback={x:0,y:0}; this.frozen=0;
    this.bob=Math.random()*7; this.dead=false; this.attackCd=0;
    // lunge state
    this.lungeState='idle'; this.lungeTimer=0; this.lungeDir={x:0,y:0};
    this.wander={x:0,y:0,t:0};
  }

  // can this enemy currently perceive the player? sight cone OR very close (hearing).
  // Once alerted it keeps chasing (alert timer) until the player breaks line/leash.
  _canSee(player, dist, nx, ny){
    if(dist < this.r+player.r+24) return true;            // adjacent: always notice
    if(dist > this.view) return false;                    // out of sight range
    // within a forgiving radius treat as heard
    if(dist < 70) return true;
    // forward vision cone: angle between facing and player direction
    const fa=Math.atan2(this.face.y,this.face.x);
    const pa=Math.atan2(ny,nx);
    let diff=Math.abs(((pa-fa+Math.PI)%(2*Math.PI))-Math.PI);
    return diff < this.fov;
  }
  // distance from home spawn (used to leash enemies so they don't roam the map)
  _homeDist(){ return Math.hypot(this.x-this.homeX, this.y-this.homeY); }

  update(dt, player, world, game){
    if(this.dead) return;
    this.hitFlash=Math.max(0,this.hitFlash-dt);
    this.attackCd=Math.max(0,this.attackCd-dt);
    this.shootTimer=Math.max(0,this.shootTimer-dt);
    this.bob+=dt*6;
    if(this.frozen>0){ this.frozen-=dt; return; }
    // status effects (burn/poison dot, chill slow, stun)
    const st=tickStatuses(this,dt,game,false);
    if(this.dead) return;
    if(st.stunned) return;
    this._slowMul=1-st.slow;
    // knockback
    if(Math.abs(this.knockback.x)>0.1||Math.abs(this.knockback.y)>0.1){
      this._move(this.knockback.x,this.knockback.y,world);
      this.knockback.x*=0.8; this.knockback.y*=0.8;
    }
    const dx=player.x-this.x, dy=player.y-this.y, dist=Math.hypot(dx,dy)||1;
    const nx=dx/dist, ny=dy/dist;

    // ---- perception: update alert state from vision cone ----
    this.alert=Math.max(0,this.alert-dt);
    const LEASH=360;                 // how far from home an enemy will chase before giving up
    if(this._canSee(player,dist,nx,ny) && this._homeDist()<LEASH+dist*0.0){
      this.alert=3.0;                // remember the player for 3s after losing sight
    }
    const hunting = this.alert>0 && this._homeDist()<LEASH+260;

    if(!hunting){
      // ---- idle: drift slowly back toward home, then wander a little ----
      this._idleBehavior(dt,world);
      return;
    }

    if(this.behavior==='ranged'){
      // keep distance, shoot
      if(dist<this.shootRange){
        if(dist<160){ this._move(-nx*this.speed,-ny*this.speed,world); } // back away
        else if(dist>240){ this._move(nx*this.speed*0.6,ny*this.speed*0.6,world); }
        if(this.shootTimer<=0){ this.shootTimer=this.shootCd;
          if(this.onHit) game.enemyShootStatus(this.x,this.y,Math.atan2(dy,dx),this.dmg,this.onHit);
          else game.enemyShoot(this.x,this.y,Math.atan2(dy,dx),this.dmg); }
      } else { this._move(nx*this.speed,ny*this.speed,world); this.face={x:nx,y:ny}; }
    }
    else if(this.behavior==='lunge'){
      this._lungeAI(dt,player,world,game,dist,nx,ny);
    }
    else { // chase
      if(this.erratic){ this.wander.t-=dt; if(this.wander.t<=0){ this.wander.t=0.4+Math.random()*0.4;
        this.wander.x=(Math.random()-0.5)*1.4; this.wander.y=(Math.random()-0.5)*1.4; } }
      this._move((nx+this.wander.x)*this.speed,(ny+this.wander.y)*this.speed,world);
      this.face={x:nx,y:ny};
      if(dist<this.r+player.r+2 && this.attackCd<=0){
        this.attackCd=0.8; player.takeDamage(this.dmg,Math.atan2(dy,dx)+Math.PI,game);
        if(this.onHit) applyStatus(player,this.onHit);
        this.knockback.x=-nx*2; this.knockback.y=-ny*2;
      }
    }
  }

  // unalerted: slow patrol/wander near home; return if it drifted too far
  _idleBehavior(dt,world){
    const hd=this._homeDist();
    if(hd>40){
      // walk back toward home at half speed, facing that way
      const hx=this.homeX-this.x, hy=this.homeY-this.y, hl=Math.hypot(hx,hy)||1;
      this._move(hx/hl*this.speed*0.5, hy/hl*this.speed*0.5, world);
      this.face={x:hx/hl,y:hy/hl};
    } else {
      // gentle wander so idle enemies feel alive, glancing around (rotates vision cone)
      this.wander.t-=dt;
      if(this.wander.t<=0){ this.wander.t=1.0+Math.random()*1.5;
        const a=Math.random()*Math.PI*2; this.face={x:Math.cos(a),y:Math.sin(a)}; }
      if(this.behavior!=='ranged' && Math.random()<0.4)
        this._move(this.face.x*this.speed*0.25, this.face.y*this.speed*0.25, world);
    }
  }

  _lungeAI(dt,player,world,game,dist,nx,ny){
    if(this.lungeState==='idle'){
      if(dist>this.r+player.r){ this._move(nx*this.speed,ny*this.speed,world); this.face={x:nx,y:ny}; }
      if(dist<150){ this.lungeState='telegraph'; this.lungeTimer=0.5; this.lungeDir={x:nx,y:ny}; }
    } else if(this.lungeState==='telegraph'){
      this.lungeTimer-=dt;
      if(this.lungeTimer<=0){ this.lungeState='lunge'; this.lungeTimer=0.32; }
    } else if(this.lungeState==='lunge'){
      this.lungeTimer-=dt;
      this._move(this.lungeDir.x*this.speed*4.5,this.lungeDir.y*this.speed*4.5,world);
      if(dist<this.r+player.r+4 && this.attackCd<=0){
        this.attackCd=1.0; player.takeDamage(Math.round(this.dmg*1.4),Math.atan2(this.lungeDir.y,this.lungeDir.x),game);
        if(this.onHit) applyStatus(player,this.onHit);
      }
      if(this.lungeTimer<=0){ this.lungeState='recover'; this.lungeTimer=0.6; }
    } else { // recover
      this.lungeTimer-=dt; if(this.lungeTimer<=0) this.lungeState='idle';
    }
  }

  _move(dx,dy,world){
    const m=this._slowMul==null?1:this._slowMul; dx*=m; dy*=m;
    if(!world.isSolid(this.x+dx+Math.sign(dx)*this.r,this.y)) this.x+=dx;
    if(!world.isSolid(this.x,this.y+dy+Math.sign(dy)*this.r)) this.y+=dy;
  }

  hit(dmg, angle, game, knock=4){
    if(this.dead) return;
    this.alert=4.0;  // taking a hit always alerts the enemy
    this.hp-=dmg; this.hitFlash=0.18;
    this.knockback.x+=Math.cos(angle)*knock; this.knockback.y+=Math.sin(angle)*knock;
    game.floater('-'+dmg, this.x, this.y-14, '#fff');
    if(this.hp<=0) this.kill(game);
  }
  freeze(t){ this.frozen=Math.max(this.frozen,t); applyStatus(this,'chill',t); }
  kill(game){
    this.dead=true;
    game.player.gainXp(this.xp, game);
    game.spawnParticles(this.x,this.y,this.color,12);
    // guaranteed coin drop (scaled by greed skill)
    const amt=this.goldMin+Math.floor(Math.random()*(this.goldMax-this.goldMin+1));
    game.dropGold(this.x,this.y,amt);
    // occasional item drop
    if(Math.random()<0.08) game.dropItem(this.x,this.y);
    game.sfx('kill');
    game.onEnemyKilled(this);
  }

  draw(ctx,cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    let c=this.hitFlash>0?'#fff':(this.frozen>0?'#9fd8ff':this.color);
    // telegraph flash (lunge windup)
    if(this.lungeState==='telegraph'){ c=Math.floor(performance.now()/80)%2?'#ff5050':this.color; }
    const bob=Math.sin(this.bob)*2;
    const t=this.type;
    if(t==='slime'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(sx,sy+bob,this.r,this.r-bob*0.5,0,0,7); ctx.fill();
      ctx.fillStyle='#fff'; ctx.fillRect(sx-5,sy-3,3,3); ctx.fillRect(sx+3,sy-3,3,3);
      ctx.fillStyle='#000'; ctx.fillRect(sx-4,sy-2,1,1); ctx.fillRect(sx+4,sy-2,1,1);
    } else if(t==='bat'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(sx,sy+bob,7,0,7); ctx.fill();
      const w=Math.sin(this.bob*2)*5;
      ctx.beginPath(); ctx.moveTo(sx,sy+bob); ctx.lineTo(sx-12,sy-4+w+bob); ctx.lineTo(sx-6,sy+2+bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx,sy+bob); ctx.lineTo(sx+12,sy-4+w+bob); ctx.lineTo(sx+6,sy+2+bob); ctx.fill();
      ctx.fillStyle='#e8413c'; ctx.fillRect(sx-3,sy-2+bob,2,2); ctx.fillRect(sx+1,sy-2+bob,2,2);
    } else if(t==='archer'){
      ctx.fillStyle=c; ctx.fillRect(sx-8,sy-10,16,20);
      ctx.fillStyle='#2a2a2a'; ctx.fillRect(sx-9,sy-4,18,3); // bow line
      ctx.fillStyle='#f1c39a'; ctx.fillRect(sx-5,sy-16,10,8);
      ctx.fillStyle='#000'; ctx.fillRect(sx-3,sy-13,2,2); ctx.fillRect(sx+1,sy-13,2,2);
    } else if(t==='boar'){
      ctx.fillStyle=c; ctx.fillRect(sx-this.r,sy-9+bob,this.r*2,16);
      ctx.fillStyle='#3a2a1a'; ctx.fillRect(sx-this.r-3,sy-4+bob,4,6); // snout
      ctx.fillStyle='#fff'; ctx.fillRect(sx-this.r-2,sy+2+bob,2,2); // tusk
      ctx.fillStyle='#e8413c'; ctx.fillRect(sx+2,sy-6+bob,2,2);
    } else if(t==='scorpion'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(sx,sy+bob,this.r,this.r*0.7,0,0,7); ctx.fill();
      ctx.fillStyle='#8a5a20'; ctx.fillRect(sx+this.r-2,sy-8+bob,3,6); // tail
      ctx.fillStyle='#e8413c'; ctx.fillRect(sx-this.r,sy-3+bob,4,2); ctx.fillRect(sx+this.r-4,sy-3+bob,4,2);
    } else if(t==='golem'){
      ctx.fillStyle=c; ctx.fillRect(sx-this.r,sy-this.r+bob,this.r*2,this.r*2);
      ctx.fillStyle='#3a4252'; ctx.fillRect(sx-this.r+3,sy-this.r+3+bob,this.r*2-6,this.r*2-6);
      ctx.fillStyle='#a45cff'; ctx.fillRect(sx-6,sy-4+bob,4,4); ctx.fillRect(sx+2,sy-4+bob,4,4);
    } else if(t==='skeleton'){
      ctx.fillStyle=c; ctx.fillRect(sx-7,sy-8+bob,14,16);
      ctx.fillStyle='#d8d0c0'; ctx.beginPath(); ctx.arc(sx,sy-12+bob,6,0,7); ctx.fill();
      ctx.fillStyle='#000'; ctx.fillRect(sx-3,sy-13+bob,2,2); ctx.fillRect(sx+1,sy-13+bob,2,2);
    } else if(t==='frostling'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(sx,sy+bob,9,0,7); ctx.fill();
      ctx.fillStyle='#eaf7ff'; ctx.fillRect(sx-7,sy-12+bob,3,6); ctx.fillRect(sx+4,sy-12+bob,3,6); // ice horns
      ctx.fillStyle='#2a5a7a'; ctx.fillRect(sx-3,sy-2+bob,2,2); ctx.fillRect(sx+1,sy-2+bob,2,2);
    } else if(t==='yeti'){
      ctx.fillStyle=c; ctx.fillRect(sx-this.r,sy-this.r+bob,this.r*2,this.r*2);
      ctx.fillStyle='#cfe6f5'; ctx.fillRect(sx-this.r+3,sy-this.r+3+bob,this.r*2-6,6); // fur
      ctx.fillStyle='#2a5a7a'; ctx.fillRect(sx-6,sy-4+bob,4,4); ctx.fillRect(sx+2,sy-4+bob,4,4);
      ctx.fillStyle='#fff'; ctx.fillRect(sx-4,sy+5+bob,3,4); ctx.fillRect(sx+1,sy+5+bob,3,4); // fangs
    } else if(t==='spitter'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(sx,sy+bob,this.r,this.r*0.8,0,0,7); ctx.fill();
      ctx.fillStyle='#9aff5f'; ctx.beginPath(); ctx.arc(sx,sy-2+bob,3,0,7); ctx.fill(); // glowing maw
      ctx.fillStyle='#1a3a0a'; ctx.fillRect(sx-6,sy-5+bob,3,3); ctx.fillRect(sx+3,sy-5+bob,3,3);
    } else if(t==='croaker'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(sx,sy+bob,this.r,this.r*0.7,0,0,7); ctx.fill();
      ctx.fillStyle='#7aff8a'; ctx.fillRect(sx-7,sy-9+bob,4,4); ctx.fillRect(sx+3,sy-9+bob,4,4); // eyes
      ctx.fillStyle='#1a3a0a'; ctx.fillRect(sx-6,sy-8+bob,2,2); ctx.fillRect(sx+4,sy-8+bob,2,2);
    } else { // brute / fallback
      ctx.fillStyle=c; ctx.fillRect(sx-this.r,sy-this.r+bob,this.r*2,this.r*2);
      ctx.fillStyle='#ffcf4d'; ctx.fillRect(sx-6,sy-5+bob,3,3); ctx.fillRect(sx+3,sy-5+bob,3,3);
    }
    // hp bar
    if(this.hp<this.hpMax){
      ctx.fillStyle='#000'; ctx.fillRect(sx-this.r,sy-this.r-7,this.r*2,3);
      ctx.fillStyle='#e8413c'; ctx.fillRect(sx-this.r,sy-this.r-7,this.r*2*(this.hp/this.hpMax),3);
    }
    // alert indicator when actively hunting the player
    if(this.alert>2.5){ ctx.fillStyle='#ffe24d'; ctx.font='bold 12px monospace'; ctx.textAlign='center';
      ctx.fillText('!', sx, sy-this.r-10); }
    drawStatusPips(this,ctx,sx,sy);
  }
}

export class Projectile {
  constructor(x,y,angle,opts){
    this.x=x; this.y=y; this.angle=angle;
    this.speed=opts.speed||5; this.dmg=opts.dmg||10; this.r=opts.r||5;
    this.color=opts.color||'#ffcf4d'; this.life=opts.life||1.2;
    this.kind=opts.kind||'fire'; this.hostile=opts.hostile||false;
    this.aoe=opts.aoe||0; this.status=opts.status||null;
    this.chain=opts.chain||0; this.crit=opts.crit||false; this.lifesteal=opts.lifesteal||0;
    this.hitSet=null;  // enemies already struck (for chaining)
    this.dead=false; this.trail=[];
  }
  update(dt, world, enemies, game){
    this.x+=Math.cos(this.angle)*this.speed; this.y+=Math.sin(this.angle)*this.speed;
    this.life-=dt;
    this.trail.push({x:this.x,y:this.y}); if(this.trail.length>6) this.trail.shift();
    if(this.life<=0 || world.isSolid(this.x,this.y)){ this.dead=true;
      if(this.aoe) this._burst(game,enemies); game.spawnParticles(this.x,this.y,this.color,6); return; }
    if(this.hostile){
      // hits player
      const p=game.player;
      if(Math.hypot(p.x-this.x,p.y-this.y)<p.r+this.r){
        p.takeDamage(this.dmg, this.angle, game);
        if(this.status) applyStatus(p,this.status);
        this.dead=true;
        game.spawnParticles(this.x,this.y,this.color,6);
      }
    } else {
      // boss takes friendly projectile damage too
      const boss=game.boss;
      if(boss && !boss.dead && Math.hypot(boss.x-this.x,boss.y-this.y)<boss.r+this.r){
        if(this.aoe) this._burst(game,enemies);
        else { boss.hit(this.dmg,this.angle,game,3); if(this.kind==='ice') boss.freeze(1.0);
          else if(this.status) applyStatus(boss,this.status); }
        if(this.lifesteal>0) game.player.heal(this.dmg*this.lifesteal,game);
        this.dead=true; game.spawnParticles(this.x,this.y,this.color,8); return;
      }
      for(const e of enemies){ if(e.dead) continue;
        if(this.hitSet && this.hitSet.has(e)) continue;
        if(Math.hypot(e.x-this.x,e.y-this.y)<e.r+this.r){
          if(this.aoe){ this._burst(game,enemies); this.dead=true;
            game.spawnParticles(this.x,this.y,this.color,8); return; }
          e.hit(this.dmg,this.angle,game,5);
          if(this.crit) game.floater('CRIT',e.x,e.y-24,'#ffcf4d');
          if(this.kind==='ice') e.freeze(1.5);
          else if(this.status) applyStatus(e,this.status);
          if(this.lifesteal>0) game.player.heal(this.dmg*this.lifesteal,game);
          game.spawnParticles(this.x,this.y,this.color,8);
          // chain lightning: jump to a nearby unstruck enemy instead of dying
          if(this.chain>0){
            (this.hitSet=this.hitSet||new Set()).add(e);
            const next=enemies.find(o=>!o.dead && !this.hitSet.has(o) &&
              Math.hypot(o.x-this.x,o.y-this.y)<160);
            if(next){ this.chain--; this.dmg=Math.round(this.dmg*0.8);
              this.angle=Math.atan2(next.y-this.y,next.x-this.x); break; }
          }
          this.dead=true; break;
        }
      }
    }
  }
  _burst(game,enemies){
    game.spawnParticles(this.x,this.y,this.color,24); game.cam.shake=10;
    for(const e of enemies){ if(e.dead) continue;
      if(Math.hypot(e.x-this.x,e.y-this.y)<this.aoe){ e.hit(this.dmg,Math.random()*7,game,8); } }
  }
  draw(ctx,cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    for(let i=0;i<this.trail.length;i++){ ctx.globalAlpha=i/this.trail.length*0.5;
      ctx.fillStyle=this.color; ctx.beginPath();
      ctx.arc(this.trail[i].x-cam.x,this.trail[i].y-cam.y,this.r*0.7,0,7); ctx.fill(); }
    ctx.globalAlpha=1; ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(sx,sy,this.r,0,7); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx,sy,this.r*0.4,0,7); ctx.fill();
  }
}

export class Particle {
  constructor(x,y,color){
    this.x=x; this.y=y; this.color=color;
    const a=Math.random()*7, s=1+Math.random()*3;
    this.vx=Math.cos(a)*s; this.vy=Math.sin(a)*s;
    this.life=0.4+Math.random()*0.4; this.max=this.life; this.size=2+Math.random()*3;
  }
  update(dt){ this.x+=this.vx; this.y+=this.vy; this.vx*=0.9; this.vy*=0.9; this.life-=dt; }
  draw(ctx,cam){ ctx.globalAlpha=Math.max(0,this.life/this.max); ctx.fillStyle=this.color;
    ctx.fillRect(this.x-cam.x,this.y-cam.y,this.size,this.size); ctx.globalAlpha=1; }
  get dead(){ return this.life<=0; }
}
