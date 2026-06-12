import { TILE } from '../systems/world.js';

export class Enemy {
  constructor(x,y,type='slime'){
    this.x=x; this.y=y; this.type=type; this.r=11;
    const cfg={
      slime:{hp:30,speed:0.9,dmg:8,xp:18,color:'#7a3fb0',range:600,touch:true},
      bat:  {hp:18,speed:1.7,dmg:6,xp:14,color:'#4a4a6a',range:520,touch:true},
      brute:{hp:70,speed:0.7,dmg:18,xp:40,color:'#9a3030',range:680,touch:true,r:15},
    }[type];
    Object.assign(this, cfg);
    this.hpMax=this.hp; this.r=cfg.r||11;
    this.hitFlash=0; this.knockback={x:0,y:0}; this.frozen=0; this.bob=Math.random()*7;
    this.dead=false; this.attackCd=0;
  }
  update(dt, player, world, game){
    if(this.dead) return;
    this.hitFlash=Math.max(0,this.hitFlash-dt);
    this.attackCd=Math.max(0,this.attackCd-dt);
    this.bob+=dt*6;
    if(this.frozen>0){ this.frozen-=dt; return; }
    // knockback decay
    if(Math.abs(this.knockback.x)>0.1||Math.abs(this.knockback.y)>0.1){
      this._move(this.knockback.x, this.knockback.y, world);
      this.knockback.x*=0.8; this.knockback.y*=0.8;
    }
    const dx=player.x-this.x, dy=player.y-this.y;
    const dist=Math.hypot(dx,dy);
    if(dist<this.range && dist>1){
      const nx=dx/dist, ny=dy/dist;
      if(dist>this.r+player.r-2) this._move(nx*this.speed, ny*this.speed, world);
      // touch damage
      if(this.touch && dist<this.r+player.r+2 && this.attackCd<=0){
        this.attackCd=0.8;
        player.takeDamage(this.dmg, Math.atan2(dy,dx)+Math.PI, game);
        // bounce back
        this.knockback.x=-nx*2; this.knockback.y=-ny*2;
      }
    }
  }
  _move(dx,dy,world){
    if(!world.isSolid(this.x+dx+Math.sign(dx)*this.r, this.y)) this.x+=dx;
    if(!world.isSolid(this.x, this.y+dy+Math.sign(dy)*this.r)) this.y+=dy;
  }
  hit(dmg, angle, game, knock=4){
    if(this.dead) return;
    this.hp-=dmg; this.hitFlash=0.18;
    this.knockback.x+=Math.cos(angle)*knock;
    this.knockback.y+=Math.sin(angle)*knock;
    game.floater('-'+dmg, this.x, this.y-14, '#fff');
    if(this.hp<=0) this.kill(game);
  }
  freeze(t){ this.frozen=Math.max(this.frozen,t); }
  kill(game){
    this.dead=true;
    game.player.gainXp(this.xp, game);
    game.spawnParticles(this.x,this.y,this.color,12);
    if(Math.random()<0.3) game.dropGold(this.x,this.y, 5+Math.floor(Math.random()*15));
    game.sfx('kill');
  }
  draw(ctx,cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    const c=this.hitFlash>0?'#fff':(this.frozen>0?'#9fd8ff':this.color);
    const bob=Math.sin(this.bob)*2;
    if(this.type==='slime'){
      ctx.fillStyle=c; ctx.beginPath();
      ctx.ellipse(sx,sy+bob,this.r,this.r-bob*0.5,0,0,7); ctx.fill();
      ctx.fillStyle='#fff'; ctx.fillRect(sx-5,sy-3,3,3); ctx.fillRect(sx+3,sy-3,3,3);
      ctx.fillStyle='#000'; ctx.fillRect(sx-4,sy-2,1,1); ctx.fillRect(sx+4,sy-2,1,1);
    } else if(this.type==='bat'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(sx,sy+bob,7,0,7); ctx.fill();
      const w=Math.sin(this.bob*2)*5;
      ctx.beginPath(); ctx.moveTo(sx,sy+bob); ctx.lineTo(sx-12,sy-4+w+bob); ctx.lineTo(sx-6,sy+2+bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx,sy+bob); ctx.lineTo(sx+12,sy-4+w+bob); ctx.lineTo(sx+6,sy+2+bob); ctx.fill();
      ctx.fillStyle='#e8413c'; ctx.fillRect(sx-3,sy-2+bob,2,2); ctx.fillRect(sx+1,sy-2+bob,2,2);
    } else {
      ctx.fillStyle=c; ctx.fillRect(sx-this.r,sy-this.r+bob,this.r*2,this.r*2);
      ctx.fillStyle='#ffcf4d'; ctx.fillRect(sx-6,sy-5+bob,3,3); ctx.fillRect(sx+3,sy-5+bob,3,3);
    }
    // hp bar
    if(this.hp<this.hpMax){
      ctx.fillStyle='#000'; ctx.fillRect(sx-this.r,sy-this.r-7,this.r*2,3);
      ctx.fillStyle='#e8413c'; ctx.fillRect(sx-this.r,sy-this.r-7,this.r*2*(this.hp/this.hpMax),3);
    }
  }
}

export class Projectile {
  constructor(x,y,angle,opts){
    this.x=x; this.y=y; this.angle=angle;
    this.speed=opts.speed||5; this.dmg=opts.dmg||10; this.r=opts.r||5;
    this.color=opts.color||'#ffcf4d'; this.life=opts.life||1.2;
    this.kind=opts.kind||'fire'; this.dead=false; this.trail=[];
  }
  update(dt, world, enemies, game){
    this.x+=Math.cos(this.angle)*this.speed;
    this.y+=Math.sin(this.angle)*this.speed;
    this.life-=dt;
    this.trail.push({x:this.x,y:this.y}); if(this.trail.length>6) this.trail.shift();
    if(this.life<=0 || world.isSolid(this.x,this.y)){ this.dead=true;
      game.spawnParticles(this.x,this.y,this.color,6); return; }
    for(const e of enemies){
      if(e.dead) continue;
      if(Math.hypot(e.x-this.x,e.y-this.y)<e.r+this.r){
        e.hit(this.dmg, this.angle, game, 5);
        if(this.kind==='ice') e.freeze(1.5);
        this.dead=true; game.spawnParticles(this.x,this.y,this.color,8); break;
      }
    }
  }
  draw(ctx,cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    for(let i=0;i<this.trail.length;i++){
      ctx.globalAlpha=i/this.trail.length*0.5;
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.arc(this.trail[i].x-cam.x,this.trail[i].y-cam.y,this.r*0.7,0,7); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.fillStyle=this.color;
    ctx.beginPath(); ctx.arc(sx,sy,this.r,0,7); ctx.fill();
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
