import { TILE } from '../systems/world.js';
import { equipStats, resolveEquip } from '../data/gear.js';
import { skillStats } from '../data/skilltree.js';
import { tickStatuses, drawStatusPips } from '../systems/status.js';
import { SPELLS, STARTER_SPELLS } from '../data/spells.js';

export class Player {
  constructor(x,y,state){
    this.x=x; this.y=y; this.r=12;
    this.baseSpeed=1.9; this.dir={x:0,y:1}; this.facing='down';
    // persistent stats
    this.level=state.level; this.xp=state.xp; this.xpNext=state.xpNext;
    this.gold=state.gold;
    this.equipment={...state.equipment};
    this.skills={...state.skills};
    this.skillPoints=state.skillPoints||0;
    // base pools (before gear/skill bonuses)
    this.baseHpMax=state.hpMax; this.baseMpMax=state.mpMax;
    // recompute derived (sets hpMax/mpMax/atk/def/etc)
    this.recompute();
    // current pools clamp to new max
    this.hp=Math.min(state.hp, this.hpMax); this.mp=Math.min(state.mp, this.mpMax);
    this.stam=this.stamMax;
    // combat state
    this.attacking=0; this.attackCd=0; this.blocking=false;
    this.dodging=0; this.dodgeCd=0; this.invuln=0; this.dodgeDir={x:0,y:0};
    this.spellCd={q:0,e:0,r:0};
    // 3 castable spell slots (q/e/r) holding spell ids; rearrangeable in the UI
    this.spellSlots = (state.spellSlots && state.spellSlots.length===3)
      ? [...state.spellSlots] : [...STARTER_SPELLS];
    this.statuses={};
    this.flash=0; this.dead=false;
  }

  // Derive final stats from base + equipment + skill tree
  recompute(){
    const g=equipStats(this.equipment);
    const s=skillStats(this.skills);
    this.hpMax = this.baseHpMax + (g.hp||0) + (s.hp||0);
    this.mpMax = this.baseMpMax + (g.mp||0) + (s.mp||0);
    this.atk   = 8 + this.level*2 + (g.atk||0) + (s.atk||0);
    this.def   = (g.def||0) + (s.def||0);
    this.crit  = (g.crit||0) + (s.crit||0);                 // %
    this.cdr   = Math.min(60,(g.cdr||0) + (s.cdr||0));        // % cooldown reduction
    this.mpRegenMul = 1 + (s.mpregen||0);
    this.spellMul   = 1 + (s.spelldmg||0);
    this.speed = this.baseSpeed * (1 + (s.speed||0));
    this.stamMax = 100 + (s.stam||0);
    this.iframeBonus = (s.iframe||0);
    this.greed = (s.greed||0);
    this.hasBerserk = (s.berserk||0)>0;
    this.hasMeteor  = (s.meteor||0)>0;
    this.lifesteal  = (s.lifesteal||0);
    // weapon kind: melee vs ranged, attack cadence + reach from the equipped weapon
    const w=resolveEquip(this.equipment.weapon);
    this.ranged   = !!(w && w.ranged);
    this.attackSpeed = (w && w.atkSpeed) ? w.atkSpeed : 0.32;     // seconds between swings/shots
    this.reach    = (w && w.reach) ? w.reach : 44;                 // melee arc reach
    this.shotSpeed= (w && w.shotSpeed) ? w.shotSpeed : 7;          // ranged projectile speed
  }

  // damage multiplier (berserk when low hp + crit roll handled in game)
  get dmgMul(){ return this.hasBerserk && this.hp<this.hpMax*0.3 ? 1.3 : 1; }

  update(dt, input, world, cam, game){
    if(this.dead) return;
    this._tickTimers(dt);
    // status effects (burn/poison dot, chill slow, stun)
    const st=tickStatuses(this,dt,game,true);
    if(this.dead) return;
    this._statusSlow=st.slow; this._stunned=st.stunned;
    // aim toward mouse (world space)
    this._aim=Math.atan2((cam.y+input.mouse.y)-this.y, (cam.x+input.mouse.x)-this.x);
    // regen
    this.mp=Math.min(this.mpMax, this.mp+dt*3*this.mpRegenMul);
    if(!this.dodging) this.stam=Math.min(this.stamMax, this.stam+dt*22);
    this._handleMovement(dt, input, world, game);
    this.blocking = input.mouseDown.right && !this.dodging && !this._stunned;
    if(!this._stunned) this._handleCombat(input, game);
  }

  _tickTimers(dt){
    this.attackCd=Math.max(0,this.attackCd-dt);
    this.dodgeCd=Math.max(0,this.dodgeCd-dt);
    this.invuln=Math.max(0,this.invuln-dt);
    this.flash=Math.max(0,this.flash-dt);
    for(const k of ['q','e','r']) this.spellCd[k]=Math.max(0,this.spellCd[k]-dt);
    if(this.attacking>0) this.attacking-=dt;
  }

  _handleMovement(dt, input, world, game){
    if(this._stunned){ return; }
    if(this.dodging>0){
      this.dodging-=dt; const ds=7.0*(this.dodging/0.22);
      this._move(this.dodgeDir.x*ds,this.dodgeDir.y*ds,world);
      return;
    }
    const mv=input.moveVector();
    // start a dodge?
    if(input.wasPressed(' ') && this.dodgeCd<=0 && this.stam>=25 && (mv.x||mv.y)){
      this.dodging=0.22; this.dodgeCd=0.6; this.invuln=0.28+this.iframeBonus; this.stam-=25;
      this.dodgeDir={...mv}; game.sfx('dodge');
      return;
    }
    // walk
    if(mv.x||mv.y){
      let sp=this.blocking?this.speed*0.45:this.speed;
      sp*=(1-(this._statusSlow||0));
      this._move(mv.x*sp,mv.y*sp,world); this.dir=mv;
      this.facing=Math.abs(mv.x)>Math.abs(mv.y)?(mv.x>0?'right':'left'):(mv.y>0?'down':'up');
    }
  }

  _handleCombat(input, game){
    const cdMul=1-this.cdr/100;
    // melee (ranged weapons fire a bolt instead — handled in game.doMeleeAttack)
    if(input.mousePressed.left && this.attackCd<=0 && !this.blocking && !this.dodging){
      this.attacking=0.18; this.attackCd=this.attackSpeed*cdMul;
      game.sfx(this.ranged?'fire':'swing'); game.doMeleeAttack(this);
    }
    // spells from the q/e/r loadout (data-driven)
    const keys=['q','e','r'];
    for(let i=0;i<3;i++){
      const key=keys[i], id=this.spellSlots[i], spell=id?SPELLS[id]:null;
      if(!spell) continue;
      if(input.wasPressed(key) && this.spellCd[key]<=0 && this.mp>=spell.cost){
        this.mp-=spell.cost; this.spellCd[key]=spell.cd*cdMul;
        game.castSpell(this, id); game.sfx(spell.sfx||'fire');
      }
    }
  }

  _move(dx,dy,world){
    if(!world.isSolid(this.x+dx+Math.sign(dx)*this.r,this.y) &&
       !world.isSolid(this.x+dx+Math.sign(dx)*this.r,this.y+this.r-2) &&
       !world.isSolid(this.x+dx+Math.sign(dx)*this.r,this.y-this.r+2)) this.x+=dx;
    if(!world.isSolid(this.x,this.y+dy+Math.sign(dy)*this.r) &&
       !world.isSolid(this.x+this.r-2,this.y+dy+Math.sign(dy)*this.r) &&
       !world.isSolid(this.x-this.r+2,this.y+dy+Math.sign(dy)*this.r)) this.y+=dy;
    this.x=Math.max(this.r,Math.min(world.w-this.r,this.x));
    this.y=Math.max(this.r,Math.min(world.h-this.r,this.y));
  }

  takeDamage(amt, fromAngle, game){
    if(this.invuln>0 || this.dead) return;
    // defense mitigation
    amt = amt * (100/(100+this.def));
    if(this.blocking){
      // shield faces the mouse aim; an incoming hit travels toward the player,
      // so it's blocked when its travel direction is ~opposite our guard direction
      const fa=this._aim!=null?this._aim:0;
      const facingDiff=Math.abs(((fromAngle-(fa+Math.PI)+Math.PI)%(2*Math.PI))-Math.PI);
      if(facingDiff<1.2){ amt*=0.15; game.sfx('block'); game.floater('BLOCK',this.x,this.y-20,'#4dd28a'); game.cam.shake=4; }
    }
    amt=Math.max(1,Math.round(amt));
    this.hp=Math.max(0,this.hp-amt);
    this.invuln=0.5; this.flash=0.3; game.cam.shake=Math.min(12,this.blocking?4:8);
    game.floater('-'+amt,this.x,this.y-16,'#e8413c'); game.sfx('hurt');
    if(this.hp<=0) this.die(game);
  }
  heal(amt,game){ this.hp=Math.min(this.hpMax,this.hp+amt); game.floater('+'+Math.round(amt),this.x,this.y-16,'#4dd28a'); }
  restoreMp(amt){ this.mp=Math.min(this.mpMax,this.mp+amt); }

  gainGold(base,game){
    const amt=Math.round(base*(1+this.greed));
    this.gold+=amt; return amt;
  }

  gainXp(amt, game){
    this.xp+=amt; game.floater('+'+amt+' XP',this.x,this.y-28,'#a45cff');
    while(this.xp>=this.xpNext){
      this.xp-=this.xpNext; this.level++; this.xpNext=Math.floor(this.xpNext*1.4);
      this.baseHpMax+=15; this.baseMpMax+=8; this.skillPoints++;
      this.recompute(); this.hp=this.hpMax; this.mp=this.mpMax;
      game.floater('LEVEL UP!',this.x,this.y-44,'#ffcf4d'); game.sfx('levelup');
      game.toast('Level '+this.level+'! +1 skill point (press K)');
    }
  }
  die(game){ this.dead=true; game.onPlayerDeath(); }

  draw(ctx, cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(this.dodging>0){ ctx.globalAlpha=0.35; ctx.fillStyle='#9cf';
      ctx.beginPath(); ctx.arc(sx,sy,this.r,0,7); ctx.fill(); ctx.globalAlpha=1; }
    const flash=this.flash>0 && Math.floor(this.flash*20)%2===0;
    // berserk aura
    if(this.hasBerserk && this.hp<this.hpMax*0.3){ ctx.globalAlpha=0.3+0.2*Math.sin(performance.now()/120);
      ctx.fillStyle='#e8413c'; ctx.beginPath(); ctx.arc(sx,sy,this.r+6,0,7); ctx.fill(); ctx.globalAlpha=1; }
    ctx.fillStyle = flash?'#fff':(this.invuln>0?'#fbb':'#e8623d');
    ctx.fillRect(sx-9,sy-12,18,22);
    ctx.fillStyle=flash?'#fff':'#f1c39a'; ctx.fillRect(sx-7,sy-20,14,11);
    ctx.fillStyle='#2c5e34'; ctx.fillRect(sx-8,sy-23,16,5);
    ctx.fillStyle='#11131c';
    const ex=this.facing==='left'?-4:this.facing==='right'?2:-2;
    ctx.fillRect(sx+ex,sy-17,2,2); ctx.fillRect(sx+ex+5,sy-17,2,2);
    if(this.attacking>0){
      const a=this._aim, prog=1-(this.attacking/0.18), sweep=-0.9+prog*1.8;
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(a+sweep);
      ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(0,0,30,-0.5,0.5); ctx.stroke();
      ctx.fillStyle='#ddd'; ctx.fillRect(24,-2,16,4); ctx.restore();
    }
    if(this.blocking){
      const a=this._aim!=null?this._aim:0;
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(a);
      ctx.fillStyle='#8a8fa0'; ctx.fillRect(14,-9,5,18);
      ctx.fillStyle='#cfd4e0'; ctx.fillRect(15,-7,3,14); ctx.restore();
    }
    drawStatusPips(this,ctx,sx,sy-8);
  }

  serialize(){
    return { level:this.level, xp:this.xp, xpNext:this.xpNext,
      hp:this.hp, hpMax:this.baseHpMax, mp:this.mp, mpMax:this.baseMpMax,
      gold:this.gold, skillPoints:this.skillPoints,
      equipment:{...this.equipment}, skills:{...this.skills},
      spellSlots:[...this.spellSlots],
      pos:{x:this.x,y:this.y} };
  }
}
