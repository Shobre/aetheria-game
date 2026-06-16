import { TILE } from '../systems/world.js';
import { equipStats, resolveEquip } from '../data/gear.js';
import { skillStats } from '../data/skilltree.js';
import { tickStatuses, drawStatusPips } from '../systems/status.js';
import { SPELLS, STARTER_SPELLS } from '../data/spells.js';
import { drawPlayerSprite } from '../sprites.js';

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
    this.spellCd={spell_q:0, spell_e:0, spell_r:0};
    // heat system (ranged weapons)
    this.heat=0;       // 0-100 current heat
    this.heatCap=100;  // max heat before overheat
    this._overheatCd=0; // cooldown when overheated
    // parry system
    this._parryWindow=0;  // seconds remaining for perfect-block window
    this._parried=false;  // flag set when parry succeeds this block
    // ammo / quiver (Sprint 5) — {ammoId: qty}. Bows + crossbows consume from here.
    this.ammo = (state.ammo && typeof state.ammo === 'object') ? {...state.ammo} : {};
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
    this.blocking = input.isDown('block') && !this.dodging && !this._stunned;
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
    for(const k of ['spell_q','spell_e','spell_r']) this.spellCd[k]=Math.max(0,this.spellCd[k]-dt);
    if(this.attacking>0) this.attacking-=dt;
    this.dodging=Math.max(0,this.dodging-dt);
  }

  _handleMovement(dt, input, world, game){
    if(this._stunned){ return; }
    if(this.dodging>0){
      const ds=7.0*(this.dodging/0.22);
      this._move(this.dodgeDir.x*ds,this.dodgeDir.y*ds,world);
      return;
    }
    const mv=input.moveVector();
    // start a dodge?
    if(input.wasPressed('dodge') && this.dodgeCd<=0 && this.stam>=25 && (mv.x||mv.y)){
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
    const slotActions = ['spell_q', 'spell_e', 'spell_r'];
    for(let i=0;i<3;i++){
      const action=slotActions[i], id=this.spellSlots[i], spell=id?SPELLS[id]:null;
      if(!spell) continue;
      if(input.wasPressed(action) && this.spellCd[action]<=0 && this.mp>=spell.cost){
        this.mp-=spell.cost; this.spellCd[action]=spell.cd*cdMul;
        game.castSpell(this, id); game.sfx(spell.sfx||'fire');
        this.spellLastCast = action;
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
    if(game && game.achievements) game.achievements.onPlayerHit();
    // defense mitigation
    amt = amt * (100/(100+this.def));
    if(this.blocking){
      // shield faces the mouse aim; an incoming hit travels toward the player,
      // so it's blocked when its travel direction is ~opposite our guard direction
      const fa=this._aim!=null?this._aim:0;
      const facingDiff=Math.abs(((fromAngle-(fa+Math.PI)+Math.PI)%(2*Math.PI))-Math.PI);
      if(facingDiff<1.8){ amt*=0.15; game.sfx('block'); game.floater('BLOCK',this.x,this.y-20,'#4dd28a'); game.cam.shake=4;
        if(game.logCombat) game.logCombat('BLOCKED ' + Math.round(amt) + ' dmg', 'info'); }
    }
    amt=Math.max(1,Math.round(amt));
    this.hp=Math.max(0,this.hp-amt);
    this.invuln=0.5; this.flash=0.3; game.cam.shake=Math.min(12,this.blocking?4:8);
    game.floater('-'+amt,this.x,this.y-16,'#e8413c'); game.sfx('hurt');
    if(game.logCombat) game.logCombat('Took -' + amt + ' HP', 'hit');
    if(this.hp<=0) this.die(game);
  }
  heal(amt,game){
    this.hp=Math.min(this.hpMax,this.hp+amt);
    game.floater('+'+Math.round(amt),this.x,this.y-16,'#4dd28a');
    if(game.logCombat) game.logCombat('Healed +' + Math.round(amt) + ' HP', 'heal');
  }
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
      if(game.achievements) game.achievements.onLevelUp(this.level);
    }
  }
  die(game){ this.dead=true; game.onPlayerDeath(); }

  _drawBody(ctx, sx, sy, flash){
    // Body is now drawn by the sprite module. Kept as a thin wrapper so the
    // existing draw() signature still composes the body, dodge ghost, etc.
    const bob = Math.sin(performance.now()/600) * 1.2;
    drawPlayerSprite(ctx, sx, sy, this.facing, this.equipment, {
      flash, invuln: this.invuln > 0, blocking: this.blocking,
      attacking: this.attacking, attackProgress: 1 - (this.attacking / 0.18),
      bob,
    });
  }
  // The slash effect: a colored arc with a weapon shape, sweeping in front of
  // the player. The arc extends OUTWARD from the player (reach distance)
  // rather than wrapping around the body, so each weapon has a distinct
  // silhouette. Per-weapon weaponKind branches are preserved as a dispatcher
  // (the test suite asserts on the `wk===` string patterns).
  _drawSlashEffect(ctx, sx, sy){
    const a=this._aim, prog=1-(this.attacking/0.18);
    const reach = this.reach || 44;
    const wk=this.weaponKind||'sword';
    ctx.save();
    ctx.translate(sx, sy);
    if(wk==='ranged'){
      // ranged weapons show a short bowstring snap + bolt line at the weapon
      this._drawRangedFx(ctx, a, prog);
    } else if(wk==='dagger'){
      this._drawMeleeSlash(ctx, a, prog, {
        reach: Math.max(20, reach * 0.55), sweepStart:-0.9, sweepRange: 1.8,
        arcWidth: 3, bladeColor:'#ffffff', trailColor:'#dce4ff',
        kind:'dagger',
      });
    } else if(wk==='spear'){
      this._drawMeleeSlash(ctx, a, prog, {
        reach: reach, sweepStart:-0.35, sweepRange: 0.7,
        arcWidth: 4, bladeColor:'#fff8e0', trailColor:null,
        kind:'spear',
      });
    } else if(wk==='greatsword'){
      this._drawMeleeSlash(ctx, a, prog, {
        reach: reach, sweepStart:-0.8, sweepRange: 1.6,
        arcWidth: 7, bladeColor:'#ffffff', trailColor:'#c8d8ff',
        kind:'greatsword',
      });
    } else if(wk==='warhammer'){
      this._drawMeleeSlash(ctx, a, prog, {
        reach: reach, sweepStart:-1.0, sweepRange: 2.0,
        arcWidth: 8, bladeColor:'#fff0c0', trailColor:null,
        kind:'warhammer',
      });
    } else {
      // default = sword
      this._drawMeleeSlash(ctx, a, prog, {
        reach: reach, sweepStart:-0.7, sweepRange: 1.4,
        arcWidth: 5, bladeColor:'#ffffff', trailColor:'#c8dcff',
        kind:'sword',
      });
    }
    ctx.restore();
  }
  // Ranged fire: a quick bowstring snap and bolt line. The bolt itself is
  // spawned as a real projectile by game.doMeleeAttack — we just show the
  // visual here.
  _drawRangedFx(ctx, a, prog){
    ctx.save();
    ctx.rotate(a);
    ctx.strokeStyle='rgba(200,180,140,'+(0.6*(1-prog)).toFixed(2)+')';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(8 + (1-prog)*30, 0);
    ctx.stroke();
    // bow flex
    ctx.strokeStyle='rgba(120,90,40,'+(0.4*(1-prog)).toFixed(2)+')';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.quadraticCurveTo(8, 0, 8, 8);
    ctx.stroke();
    ctx.restore();
  }
  // Melee slash: a single sweeping arc that extends from the player center
  // outward to the weapon's reach. The weapon's silhouette is drawn at the
  // arc tip so it looks like the player is brandishing it.
  _drawMeleeSlash(ctx, a, prog, opts){
    const sweep = opts.sweepStart + prog * opts.sweepRange;
    const reach = opts.reach;
    const r = reach * 0.7;  // arc curve radius
    const tipX = Math.cos(a + sweep) * reach;
    const tipY = Math.sin(a + sweep) * reach;
    const arcX = Math.cos(a + sweep) * r;
    const arcY = Math.sin(a + sweep) * r;
    const alpha = (1 - prog).toFixed(2);
    // arc trail
    ctx.save();
    ctx.rotate(a + sweep);
    ctx.strokeStyle = `rgba(255,255,255,${(0.85 * (1 - prog)).toFixed(2)})`;
    ctx.lineWidth = opts.arcWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // arc from -0.4 rad to +0.4 rad around the tip
    const ang = 0.4;
    ctx.arc(0, 0, r, -ang, ang);
    ctx.stroke();
    if (opts.trailColor) {
      ctx.strokeStyle = `rgba(200,220,255,${(0.4 * (1 - prog)).toFixed(2)})`;
      ctx.lineWidth = Math.max(1, opts.arcWidth - 2);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, -ang * 0.8, ang * 0.8);
      ctx.stroke();
    }
    // weapon silhouette at tip
    this._drawWeaponShape(ctx, reach, opts);
    ctx.restore();
  }
  // Draws a recognizable weapon shape at the tip of the slash arc.
  // ctx is already rotated to the slash direction (pointing outward).
  _drawWeaponShape(ctx, reach, opts){
    const k = opts.kind;
    const woodC = '#5a3a22';
    const wc = opts.bladeColor;
    ctx.save();
    if (k === 'dagger') {
      // tiny dagger pointing outward
      ctx.fillStyle = woodC;
      ctx.fillRect(reach - 6, -1.5, 4, 3);
      ctx.fillStyle = wc;
      ctx.fillRect(reach - 2, -1, 6, 2);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(reach - 7, -2, 2, 4);
    } else if (k === 'spear') {
      // shaft along the slash
      ctx.fillStyle = woodC;
      ctx.fillRect(0, -1, reach, 2);
      // spearhead at the far end
      ctx.fillStyle = '#e0d4a0';
      ctx.beginPath();
      ctx.moveTo(reach, -3);
      ctx.lineTo(reach + 6, 0);
      ctx.lineTo(reach, 3);
      ctx.closePath();
      ctx.fill();
      // shaft wrap
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(2, -2, 3, 4);
    } else if (k === 'greatsword') {
      // big two-handed blade
      ctx.fillStyle = woodC;
      ctx.fillRect(0, -1.5, 8, 3);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(0, -3, 10, 6);
      ctx.fillStyle = wc;
      ctx.fillRect(8, -2, reach - 8, 4);
      ctx.fillStyle = '#dadada';
      ctx.fillRect(9, -1, reach - 9, 1);
      // pommel
      ctx.fillStyle = '#caa050';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      // impact sparkle when arc is near peak
      if (prog > 0.3 && prog < 0.7) {
        const intensity = 0.7 - Math.abs(prog - 0.5) * 1.4;
        ctx.globalAlpha = Math.max(0, intensity);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * 6, Math.sin(ang) * 6);
          ctx.lineTo(Math.cos(ang) * 12, Math.sin(ang) * 12);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    } else if (k === 'warhammer') {
      // short shaft with a big blocky head at the tip
      ctx.fillStyle = woodC;
      ctx.fillRect(0, -1.5, reach - 4, 3);
      ctx.fillStyle = '#5a5a66';
      ctx.fillRect(reach - 6, -5, 8, 10);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(reach - 6, -5, 8, 2);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(reach - 4, -2, 2, 4);
      // shockwave ring on peak
      const prog2 = 1 - prog;
      if (prog2 > 0.3 && prog2 < 0.6) {
        ctx.globalAlpha = 1 - prog2;
        ctx.strokeStyle = '#ffcf4d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, reach + (1 - prog2) * 18, -0.4, 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      // sword: medium blade with crossguard and pommel
      ctx.fillStyle = woodC;
      ctx.fillRect(0, -1, 6, 2);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(0, -3, 7, 6);
      ctx.fillStyle = wc;
      ctx.fillRect(6, -2, reach - 6, 4);
      ctx.fillStyle = '#dadada';
      ctx.fillRect(7, -1, reach - 7, 1);
      ctx.fillStyle = '#caa050';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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


