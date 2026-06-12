import { TILE } from '../systems/world.js';

export class Player {
  constructor(x,y,state){
    this.x=x; this.y=y; this.r=12;
    this.speed=2.4; this.dir={x:0,y:1}; this.facing='down';
    // stats from save state
    this.level=state.level; this.xp=state.xp; this.xpNext=state.xpNext;
    this.hp=state.hp; this.hpMax=state.hpMax;
    this.mp=state.mp; this.mpMax=state.mpMax;
    this.gold=state.gold;
    this.stam=100; this.stamMax=100;
    // combat state
    this.attacking=0; this.attackCd=0; this.blocking=false;
    this.dodging=0; this.dodgeCd=0; this.invuln=0;
    this.dodgeDir={x:0,y:0};
    this.spellCd={q:0,e:0};
    this.flash=0;
    this.dead=false;
  }
  get aimAngle(){ return this._aim||0; }

  update(dt, input, world, cam, game){
    if(this.dead) return;
    // timers
    this.attackCd=Math.max(0,this.attackCd-dt);
    this.dodgeCd=Math.max(0,this.dodgeCd-dt);
    this.invuln=Math.max(0,this.invuln-dt);
    this.flash=Math.max(0,this.flash-dt);
    this.spellCd.q=Math.max(0,this.spellCd.q-dt);
    this.spellCd.e=Math.max(0,this.spellCd.e-dt);
    if(this.attacking>0) this.attacking-=dt;

    // aim toward mouse (world space)
    const mwx=cam.x+input.mouse.x, mwy=cam.y+input.mouse.y;
    this._aim=Math.atan2(mwy-this.y, mwx-this.x);

    // regen
    this.mp=Math.min(this.mpMax, this.mp+dt*3);
    if(!this.dodging) this.stam=Math.min(this.stamMax, this.stam+dt*22);

    // DODGE (space) - burst in movement dir, i-frames
    if(this.dodging>0){
      this.dodging-=dt;
      const ds=7.0*(this.dodging/0.22);
      this._move(this.dodgeDir.x*ds, this.dodgeDir.y*ds, world);
    } else {
      const mv=input.moveVector();
      if(input.wasPressed(' ') && this.dodgeCd<=0 && this.stam>=25 && (mv.x||mv.y)){
        this.dodging=0.22; this.dodgeCd=0.6; this.invuln=0.28; this.stam-=25;
        this.dodgeDir={...mv}; game.sfx('dodge');
      } else {
        // normal movement
        const sp=this.blocking?this.speed*0.45:this.speed;
        if(mv.x||mv.y){
          this._move(mv.x*sp, mv.y*sp, world);
          this.dir=mv;
          this.facing=Math.abs(mv.x)>Math.abs(mv.y)?(mv.x>0?'right':'left'):(mv.y>0?'down':'up');
        }
      }
    }

    // BLOCK (right mouse)
    this.blocking = input.mouseDown.right && !this.dodging;

    // ATTACK (left mouse)
    if(input.mousePressed.left && this.attackCd<=0 && !this.blocking && !this.dodging){
      this.attacking=0.18; this.attackCd=0.32; game.sfx('swing');
      game.doMeleeAttack(this);
    }

    // SPELLS
    if(input.wasPressed('q') && this.spellCd.q<=0 && this.mp>=10){
      this.mp-=10; this.spellCd.q=1.2; game.castSpell(this,'fire'); game.sfx('fire');
    }
    if(input.wasPressed('e') && this.spellCd.e<=0 && this.mp>=15){
      this.mp-=15; this.spellCd.e=2.0; game.castSpell(this,'ice'); game.sfx('ice');
    }
  }

  _move(dx,dy,world){
    // axis-separated collision
    if(!world.isSolid(this.x+dx+Math.sign(dx)*this.r, this.y) &&
       !world.isSolid(this.x+dx+Math.sign(dx)*this.r, this.y+this.r-2) &&
       !world.isSolid(this.x+dx+Math.sign(dx)*this.r, this.y-this.r+2)) this.x+=dx;
    if(!world.isSolid(this.x, this.y+dy+Math.sign(dy)*this.r) &&
       !world.isSolid(this.x+this.r-2, this.y+dy+Math.sign(dy)*this.r) &&
       !world.isSolid(this.x-this.r+2, this.y+dy+Math.sign(dy)*this.r)) this.y+=dy;
    this.x=Math.max(this.r, Math.min(world.w-this.r, this.x));
    this.y=Math.max(this.r, Math.min(world.h-this.r, this.y));
  }

  takeDamage(amt, fromAngle, game){
    if(this.invuln>0 || this.dead) return;
    // blocking reduces dmg if facing the hit
    if(this.blocking){
      const facingAngle={right:0,left:Math.PI,down:Math.PI/2,up:-Math.PI/2}[this.facing];
      let diff=Math.abs(((fromAngle-facingAngle+Math.PI)%(2*Math.PI))-Math.PI);
      if(diff<1.2){ amt*=0.15; game.sfx('block'); game.floater('BLOCK', this.x, this.y-20, '#4dd28a'); game.cam.shake=4; }
    }
    amt=Math.round(amt);
    this.hp=Math.max(0,this.hp-amt);
    this.invuln=0.5; this.flash=0.3; game.cam.shake=Math.min(12,this.blocking?4:8);
    game.floater('-'+amt, this.x, this.y-16, '#e8413c');
    if(this.hp<=0) this.die(game);
  }
  heal(amt,game){ this.hp=Math.min(this.hpMax,this.hp+amt); game.floater('+'+amt,this.x,this.y-16,'#4dd28a'); }
  restoreMp(amt){ this.mp=Math.min(this.mpMax,this.mp+amt); }

  gainXp(amt, game){
    this.xp+=amt; game.floater('+'+amt+' XP', this.x, this.y-28, '#a45cff');
    while(this.xp>=this.xpNext){
      this.xp-=this.xpNext; this.level++; this.xpNext=Math.floor(this.xpNext*1.4);
      this.hpMax+=15; this.mpMax+=8; this.hp=this.hpMax; this.mp=this.mpMax;
      game.floater('LEVEL UP!', this.x, this.y-44, '#ffcf4d'); game.sfx('levelup');
      game.toast('Reached Level '+this.level+'!');
    }
  }
  die(game){ this.dead=true; game.onPlayerDeath(); }

  draw(ctx, cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    // dodge afterimage
    if(this.dodging>0){ ctx.globalAlpha=0.35; ctx.fillStyle='#9cf';
      ctx.beginPath(); ctx.arc(sx,sy,this.r,0,7); ctx.fill(); ctx.globalAlpha=1; }
    // body
    const flash=this.flash>0 && Math.floor(this.flash*20)%2===0;
    ctx.fillStyle = flash?'#fff':(this.invuln>0?'#fbb':'#e8623d');
    ctx.fillRect(sx-9, sy-12, 18, 22);
    // head
    ctx.fillStyle=flash?'#fff':'#f1c39a'; ctx.fillRect(sx-7,sy-20,14,11);
    // hat
    ctx.fillStyle='#2c5e34'; ctx.fillRect(sx-8,sy-23,16,5);
    // facing eyes
    ctx.fillStyle='#11131c';
    const ex=this.facing==='left'?-4:this.facing==='right'?2:-2;
    ctx.fillRect(sx+ex, sy-17, 2,2); ctx.fillRect(sx+ex+5, sy-17, 2,2);
    // sword swing arc
    if(this.attacking>0){
      const a=this._aim, prog=1-(this.attacking/0.18);
      const sweep=-0.9 + prog*1.8;
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(a+sweep);
      ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(0,0,30,-0.5,0.5); ctx.stroke();
      ctx.fillStyle='#ddd'; ctx.fillRect(24,-2,16,4);
      ctx.restore();
    }
    // shield when blocking
    if(this.blocking){
      const a={right:0,left:Math.PI,down:Math.PI/2,up:-Math.PI/2}[this.facing];
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(a);
      ctx.fillStyle='#8a8fa0'; ctx.fillRect(14,-9,5,18);
      ctx.fillStyle='#cfd4e0'; ctx.fillRect(15,-7,3,14);
      ctx.restore();
    }
  }
  serialize(){
    return { level:this.level, xp:this.xp, xpNext:this.xpNext,
      hp:this.hp, hpMax:this.hpMax, mp:this.mp, mpMax:this.mpMax,
      gold:this.gold, pos:{x:this.x,y:this.y} };
  }
}
