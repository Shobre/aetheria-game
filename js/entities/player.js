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
    // heat system (ranged weapons)
    this.heat=0;       // 0-100 current heat
    this.heatCap=100;  // max heat before overheat
    this._overheatCd=0; // cooldown when overheated
    // parry system
    this._parryWindow=0;  // seconds remaining for perfect-block window
    this._parried=false;  // flag set when parry succeeds this block
    // 3 castable spell slots (q/e/r) holding spell ids; rearrangeable in the UI
    this.spellSlots = (state.spellSlots && state.spellSlots.length===3)
      ? [...state.spellSlots] : [...STARTER_SPELLS];
    // load heat state
    this.heat=state.heat||0;
    this._overheatCd=state._overheatCd||0;
    this.statuses={};
    this.flash=0; this.dead=false;
  }

  // Derive final stats from base + equipment + skill tree
  // fallow-ignore-next-line complexity
  recompute(){
    this._deriveBaseStats();
    this._applyEquipmentBonuses();
    this._applySkillBonuses();
    this._resolveWeapon();
  }
  _deriveBaseStats(){
    this.hpMax = this.baseHpMax;
    this.mpMax = this.baseMpMax;
    this.atk = 8 + this.level*2;
    this.speed = this.baseSpeed;
    this.stamMax = 100;
    this.heatCap = 100;
  }
  _applyEquipmentBonuses(){
    const g=equipStats(this.equipment);
    this.hpMax += g.hp||0;
    this.mpMax += g.mp||0;
    this.atk   += g.atk||0;
    this.def    = g.def||0;
    this.crit   = g.crit||0;
    this.cdr    = Math.min(60, g.cdr||0);
    this.spellMul = 1;
  }
  _applySkillBonuses(){
    const s=skillStats(this.skills);
    // direct stat additions
    this.hpMax += s.hp||0;
    this.mpMax += s.mp||0;
    this.atk   += s.atk||0;
    this.def   += s.def||0;
    this.crit  += s.crit||0;
    this.cdr    = Math.min(60, this.cdr + (s.cdr||0));
    // multiplicative stats
    this.mpRegenMul = 1 + (s.mpregen||0);
    this.spellMul   = 1 + (s.spelldmg||0);
    this.speed = this.baseSpeed * (1 + (s.speed||0));
    this.stamMax = 100 + (s.stam||0);
    // special bonuses
    this.iframeBonus = (s.iframe||0);
    this.greed = (s.greed||0);
    this.hasBerserk = (s.berserk||0)>0;
    this.hasMeteor  = (s.meteor||0)>0;
    this.lifesteal  = (s.lifesteal||0);
    this.heatCap = 100 + (s.rangedMastery||0)*10;
    this._meleeAtkMul = 1 + (s.meleeAtk||0);
    this._rangedAtkMul = 1 + (s.rangedAtk||0);
    this._polearmBonus = s.polearmBonus||0;
    this._parryBonus = s.parryBonus||0;
    this._heatReduction = 1 - (s.heatReduction||0);
    if(this._heatReduction<0.3) this._heatReduction=0.3;
  }
  _resolveWeapon(){
    const w=resolveEquip(this.equipment.weapon);
    this.ranged   = !!(w && w.ranged);
    this.attackSpeed = (w && w.atkSpeed) ? w.atkSpeed : 0.32;
    let baseReach=(w&&w.reach)?w.reach:44;
    if(w && (w.id.startsWith('spear')||w.id==='halberd')) baseReach=Math.round(baseReach*(1+(this._polearmBonus||0)));
    this.reach=baseReach;
    this.shotSpeed= (w && w.shotSpeed) ? w.shotSpeed : 7;
    this.weaponKind = 'sword';
    if(w){
      if(w.ranged) this.weaponKind = 'ranged';
      else if(w.id.startsWith('dagger')) this.weaponKind = 'dagger';
      else if(w.id.startsWith('spear') || w.id==='halberd') this.weaponKind = 'spear';
      else if(w.id==='greatsword') this.weaponKind = 'greatsword';
      else if(w.id==='warhammer') this.weaponKind = 'warhammer';
      else if(w.id.startsWith('sword')) this.weaponKind = 'sword';
    }
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

    // heat system: decay heat when not shooting, overheat cooldown
    if(this._overheatCd>0){ this._overheatCd-=dt; this.heat=this.heatCap; }
    else if(this.heat>0){ this.heat=Math.max(0,this.heat-15*dt); }

    // parry window: opens when block is first raised
    if(this.blocking && this._parryWindow<=0 && !this._parried){
      this._parryWindow=0.2; // 200ms perfect-block window
    }
    if(!this.blocking){ this._parryWindow=0; this._parried=false; }
    if(this._parryWindow>0){ this._parryWindow-=dt; }
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
    // melee (ranged weapons fire a bolt instead - handled in game.doMeleeAttack)
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
      if(facingDiff<1.8){ amt*=0.15; game.sfx('block'); game.floater('BLOCK',this.x,this.y-20,'#4dd28a'); game.cam.shake=4; }
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

  _drawBody(ctx, sx, sy, flash){
    ctx.fillStyle = flash?'#fff':(this.invuln>0?'#fbb':'#e8623d');
    ctx.fillRect(sx-9,sy-12,18,22);
    ctx.fillStyle=flash?'#fff':'#f1c39a'; ctx.fillRect(sx-7,sy-20,14,11);
    ctx.fillStyle='#2c5e34'; ctx.fillRect(sx-8,sy-23,16,5);
    ctx.fillStyle='#11131c';
    const ex=this.facing==='left'?-4:this.facing==='right'?2:-2;
    ctx.fillRect(sx+ex,sy-17,2,2); ctx.fillRect(sx+ex+5,sy-17,2,2);
  }
  _drawSlashEffect(ctx, sx, sy){
    const a=this._aim, prog=1-(this.attacking/0.18);
    ctx.save(); ctx.translate(sx,sy);
    const wk=this.weaponKind||'sword';
    if(wk==='ranged'){
      ctx.rotate(a); ctx.strokeStyle='rgba(200,180,140,0.5)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(36,0); ctx.stroke();
    } else if(wk==='dagger'){
      this._drawSlashArc(ctx,a,prog,-1.3,2.6,8,26,3,18,0.3,'rgba(255,255,255,${0.9})','rgba(220,220,255,${0.7})');
    } else if(wk==='spear'){
      this._drawSlashArc(ctx,a,prog,-0.5,1.0,12,50,3,40,0.2,'rgba(255,255,240,${0.85})',null,true);
    } else if(wk==='greatsword'){
      this._drawSlashArc(ctx,a,prog,-1.2,2.4,38,null,6,null,0.7,'rgba(255,255,255,${0.8})','rgba(200,200,255,${0.4})');
      if(prog>0.3&&prog<0.7){
        ctx.globalAlpha=(0.5-Math.abs(prog-0.5))*2;
        ctx.fillStyle='#ddd';
        ctx.beginPath(); ctx.arc(Math.cos(a+(-1.2+prog*2.4))*38,Math.sin(a+(-1.2+prog*2.4))*38,8,0,7); ctx.fill();
        ctx.globalAlpha=1;
      }
    } else if(wk==='warhammer'){
      this._drawSlashArc(ctx,a,prog,-1.5,3.0,34,null,7,null,0.8,'rgba(255,240,200,${0.85})',null,false,true,prog);
    } else {
      this._drawSlashArc(ctx,a,prog,-0.9,1.8,30,null,4,null,0.5,'rgba(255,255,255,${0.85})','rgba(200,220,255,${0.3})');
    }
    ctx.restore();
  }
  _drawSlashArc(ctx, a, prog, sweepStart, sweepRange, radius1, radius2, lineWidth, arcRadius, arcRange, color1, color2, isSpear, isWarhammer, prog2){
    const sweep=sweepStart+prog*sweepRange;
    ctx.rotate(a+sweep);
    const alpha1=1-prog;
    ctx.strokeStyle=color1.replace('${0.9}',(0.9*alpha1).toFixed(2)).replace('${0.85}',(0.85*alpha1).toFixed(2)).replace('${0.8}',(0.8*alpha1).toFixed(2)).replace('${0.7}',(0.7*alpha1).toFixed(2)).replace('${0.4}',(0.4*alpha1).toFixed(2)).replace('${0.3}',(0.3*alpha1).toFixed(2));
    ctx.lineWidth=lineWidth;
    ctx.beginPath(); ctx.arc(0,0,radius1,-arcRange||0.5,arcRange||0.5); ctx.stroke();
    if(radius2&&color2){
      ctx.strokeStyle=color2.replace('${0.4}',(0.4*alpha1).toFixed(2)).replace('${0.3}',(0.3*alpha1).toFixed(2));
      ctx.lineWidth=lineWidth-1;
      ctx.beginPath(); ctx.arc(0,0,radius2,-(arcRange||0.5)*0.8,(arcRange||0.5)*0.8); ctx.stroke();
    }
    if(isSpear){
      ctx.fillStyle='#c8bfa0'; ctx.fillRect(radius1-6,-2,18,4);
      ctx.fillStyle='#e8e0c0'; ctx.beginPath(); ctx.arc(radius1+12,0,3,0,7); ctx.fill();
    } else if(isWarhammer){
      ctx.fillStyle='#b8a080'; ctx.fillRect(radius1-6,-4,22,8);
      if(prog2>0.4&&prog2<0.65){
        ctx.globalAlpha=1-prog2;
        ctx.strokeStyle='#ffcf4d'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(0,0,44+(prog2*30),-0.4,0.4); ctx.stroke();
        ctx.globalAlpha=1;
      }
    } else {
      ctx.fillStyle='#ddd'; ctx.fillRect(radius1-6,-2,16,4);
    }
  }
  _drawShield(ctx, sx, sy){
    const a=this._aim!=null?this._aim:0;
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(a);
    ctx.fillStyle='#7a8090';
    ctx.beginPath();
    ctx.moveTo(12,-11); ctx.lineTo(20,-11); ctx.lineTo(22,0); ctx.lineTo(20,11); ctx.lineTo(12,11);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#a0a8b8';
    ctx.beginPath();
    ctx.moveTo(14,-8); ctx.lineTo(18,-8); ctx.lineTo(19,0); ctx.lineTo(18,8); ctx.lineTo(14,8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#c0c8d8'; ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(12,-11); ctx.lineTo(20,-11); ctx.lineTo(22,0); ctx.lineTo(20,11); ctx.lineTo(12,11);
    ctx.closePath(); ctx.stroke();
    // block sparkle (subtle animation)
    ctx.fillStyle='rgba(100,200,255,'+(0.3+0.2*Math.sin(performance.now()/150)).toFixed(2)+')';
    ctx.beginPath(); ctx.arc(18,0,2,0,7); ctx.fill();
    ctx.restore();
  }
  draw(ctx, cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(this.dodging>0){ ctx.globalAlpha=0.35; ctx.fillStyle='#9cf';
      ctx.beginPath(); ctx.arc(sx,sy,this.r,0,7); ctx.fill(); ctx.globalAlpha=1; }
    const flash=this.flash>0 && Math.floor(this.flash*20)%2===0;
    if(this.hasBerserk && this.hp<this.hpMax*0.3){ ctx.globalAlpha=0.3+0.2*Math.sin(performance.now()/120);
      ctx.fillStyle='#e8413c'; ctx.beginPath(); ctx.arc(sx,sy,this.r+6,0,7); ctx.fill(); ctx.globalAlpha=1; }
    this._drawBody(ctx,sx,sy,flash);
    if(this.attacking>0) this._drawSlashEffect(ctx,sx,sy);
    if(this.blocking) this._drawShield(ctx,sx,sy);
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


