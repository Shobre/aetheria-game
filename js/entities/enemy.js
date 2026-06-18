/** @typedef {import('../data/gear.js').ItemStats} ItemStats */
/** @typedef {import('../systems/pathfinding.js').FlowField} FlowField */
/** @typedef {import('../systems/world.js').World} World */
/** @typedef {import('../systems/game.js').Game} Game */
/** @typedef {import('./player.js').Player} Player */
/** @typedef {import('../systems/status.js').Statuses} Statuses */
/** @typedef {import('../systems/status.js').StatusId} StatusId */
/** @typedef {import('./boss.js').Boss} Boss */

import { TILE } from '../systems/world.js';
import { applyStatus, tickStatuses, drawStatusPips } from '../systems/status.js';
import { makeItem } from '../data/gear.js';
import { rollRarity, applyRarity } from '../data/affixes.js';
// Sprint 11: optional sprite atlas (PNG frames). The atlas draw is a
// best-effort path; the canvas-primitive _drawCanvas() below is the
// authoritative fallback.
import { drawImageFromAtlas, isUsingAtlases } from '../systems/sprite-atlas.js';
import { lookupFrame as _atlasLookupFrame } from '../data/sprite-atlas.js';

/**
 * Enemy catalog entry. All numeric fields except `r` and the `gold` tuple
 * represent a per-stat baseline that gets scaled by `levelScale` and (for
 * elites) multiplied by the elite mod.
 *
 * @typedef {Object} CFGDef
 * @property {number} hp
 * @property {number} dmg
 * @property {number} speed
 * @property {string} color
 * @property {number} r
 * @property {'chase'|'ranged'|'lunge'|'mage'|'berserker'} behavior
 * @property {number} xp
 * @property {[number, number]} gold
 * @property {number} [shootRange]
 * @property {number} [shootCd]
 * @property {boolean} [erratic]
 * @property {number} [view]   - sight radius
 * @property {number} [fov]    - half-angle (rad) of forward vision cone
 * @property {string} [onHit]  - status key to apply on contact
 * @property {StatusId} [onHitId]  - same as onHit, but strictly typed
 */

/**
 * Elite (champion) modifier — stat multipliers + cosmetic aura.
 * `knockResist` scales incoming knockback (1 = full, 0 = immune);
 * `burstOnDeath` triggers a radial projectile salvo on kill.
 *
 * @typedef {Object} EliteMod
 * @property {string} label       - display name painted above the enemy
 * @property {string} aura        - hex color for aura ring / floater
 * @property {number} dmg         - damage multiplier
 * @property {number} hp          - HP multiplier
 * @property {number} speed       - movement-speed multiplier
 * @property {number} [knockResist]
 * @property {boolean} [burstOnDeath]
 */

/**
 * Full Enemy instance state — every field set on the Enemy class instance.
 * Used by JSDoc to type `this` inside the class methods.
 *
 * @typedef {Object} EnemyState
 * @property {number} x
 * @property {number} y
 * @property {string} type              - enemy archetype key (e.g. 'slime')
 * @property {CFGDef} base              - raw catalog row used at construction
 * @property {number} r                 - collision radius (px), bumped for elites
 * @property {number} speed             - per-tile movement speed (current, not base)
 * @property {string} color
 * @property {'chase'|'ranged'|'lunge'|'mage'|'berserker'} behavior
 * @property {string|null} elite        - elite key, or null for normal enemies
 * @property {EliteMod|null} [eliteMod] - present iff `elite` is non-null
 * @property {number} hpMax
 * @property {number} hp
 * @property {number} dmg
 * @property {number} xp
 * @property {number} goldMin
 * @property {number} goldMax
 * @property {number} shootRange        - 0 if not a shooter
 * @property {number} shootCd
 * @property {number} shootTimer
 * @property {boolean} erratic
 * @property {string|null} onHit        - status applied on contact
 * @property {import('../systems/status.js').Statuses} [statuses] - active status effect map (status -> {dur, ...})
 * @property {number} view              - sight radius
 * @property {number} fov               - vision-cone half-angle (rad)
 * @property {number} homeX             - spawn anchor X (leash target)
 * @property {number} homeY             - spawn anchor Y (leash target)
 * @property {number} alert             - >0 = actively hunting
 * @property {{x:number, y:number}} face - facing unit vector (drives vision cone)
 * @property {number} hitFlash          - hit-flash timer (s)
 * @property {{x:number, y:number}} knockback - decaying per-frame knockback impulse
 * @property {number} frozen            - freeze timer (s); >0 = locked out of update
 * @property {number} bob               - sine phase for idle bobbing
 * @property {boolean} dead
 * @property {number} attackCd
 * @property {'idle'|'telegraph'|'lunge'|'recover'} lungeState
 * @property {number} lungeTimer
 * @property {{x:number, y:number}} lungeDir
 * @property {{x:number, y:number, t:number}} [wander]  - wander noise / timer
 * @property {Array<{x:number, y:number}>|null} [path] - cached A* waypoints
 * @property {number} [pathIdx]         - next waypoint index
 * @property {number} [pathT]           - path recompute throttle timer
 * @property {number} [_slowMul]        - per-frame slow multiplier (from status)
 * @property {number} [_mageT]          - mage phase timer (hover/teleport)
 * @property {number} [_berserkThreshold] - berserker enrage HP threshold
 * @property {boolean} [_enraged]       - berserker: enrage flag
 * @property {number} [_stalkerFade]    - snow_stalker: cached distance for alpha fade
 */

/**
 * Projectile instance state. `kind` selects cosmetic tint and on-hit effects;
 * `aoe` > 0 means impact triggers `_applyAoe` instead of single-target hit;
 * `hostile` flips hit-targets (player vs. enemies/boss).
 *
 * @typedef {Object} ProjectileState
 * @property {number} x
 * @property {number} y
 * @property {number} angle              - current flight angle (rad); updated when homing
 * @property {number} speed
 * @property {number} dmg
 * @property {number} r
 * @property {string} color
 * @property {number} life               - remaining lifetime (s); <=0 = dead
 * @property {string} kind
 * @property {boolean} hostile
 * @property {number} aoe                - AoE radius (0 = single target)
 * @property {string|null} status        - status key to apply on hit
 * @property {number} statusDur          - status duration override
 * @property {number} chain              - remaining chain-lightning bounces
 * @property {boolean} crit              - flag crit floater
 * @property {number} lifesteal          - fraction of damage healed on hit
 * @property {number} homing             - max angular turn per frame (rad)
 * @property {Set<Enemy>|null} hitSet    - chain tracker (enemies already hit)
 * @property {boolean} dead
 * @property {Array<{x:number, y:number}>} trail
 */

/**
 * Particle (visual-only) instance state.
 *
 * @typedef {Object} ParticleState
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life              - remaining lifetime (s)
 * @property {string} color
 * @property {number} r
 * @property {number} max               - initial lifetime (for alpha fade)
 * @property {number} size              - draw size in px
 */

// Enemy configs per type. Behaviors: chase (touch), ranged (shoots), lunge (telegraph+dash).
// speeds are deliberately below the player's baseSpeed (1.9) so the player can
// always outrun foes; `view` = sight radius, `fov` = half-angle (rad) of the
// forward vision cone the enemy must see the player within to start chasing.
/** @type {Record<string, CFGDef>} */
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
  // ---- new: mage (forest, swamp) ----
  // Hovers at range, fires homing arcane missiles, teleports when cornered.
  mage:    { hp:32, speed:0.45, dmg:12, xp:38, gold:[9,20], color:'#6b3a9a', r:11, behavior:'mage', shootRange:260, shootCd:1.8, view:280, fov:1.2, erratic:true },
  // ---- new: berserker (cave, dungeon) ----
  // Slow at first; enrages below 30% HP (red glow, +50% speed and +40% damage).
  berserker:{ hp:130,speed:0.42, dmg:18, xp:60, gold:[12,26],color:'#7a3030', r:14, behavior:'berserker', view:240, fov:1.0 },
  // ---- new: frost_mage (snow) ----
  // A mage variant that chills on hit. Spawns in Frostpeak.
  frost_mage:{ hp:36, speed:0.45, dmg:13, xp:42, gold:[10,22],color:'#80c0ff', r:11, behavior:'mage', shootRange:240, shootCd:1.7, onHit:'chill', view:280, fov:1.2, erratic:true },
  // ---- new: tundra biome ----
  // Ghostly ice wraith: flies erratically, melee, chills on hit.
  ice_wraith:{ hp:30, speed:1.0,  dmg:11, xp:34, gold:[8,18], color:'#cfeaff', r:10, behavior:'chase', erratic:true, onHit:'chill', view:220, fov:1.4 },
  // Slow frost golem with heavy armor and AoE smash (chain-on-death burst).
  frost_golem:{ hp:160, speed:0.32, dmg:24, xp:78, gold:[18,36], color:'#a8c8e0', r:18, behavior:'lunge', view:200, fov:0.7 },
  // Snow stalker: invisible until close, fast rush attack.
  snow_stalker:{ hp:46, speed:1.4,  dmg:16, xp:46, gold:[12,24], color:'#e0eef5', r:11, behavior:'lunge', view:280, fov:1.3 },
  // Frozen husk: shambling zombie, very tough, low damage, slow.
  frozen_husk:{ hp:90, speed:0.38, dmg:12, xp:50, gold:[10,20], color:'#7a8a9a', r:13, behavior:'chase', view:180, fov:0.8 },
};

// Elite (champion) modifiers. An elite enemy rolls one of these — it buffs the
// base stats and paints a coloured aura, and always drops rolled gear on death.
/** @type {Record<string, EliteMod>} */
const ELITE_MODS = {
  vicious:  { label:'Vicious',  aura:'#ff5a5a', dmg:1.9, hp:2.6, speed:1.0 },
  armored:  { label:'Armored',  aura:'#9aa6c0', dmg:1.4, hp:4.0, speed:0.9, knockResist:0.6 },
  swift:    { label:'Swift',    aura:'#ffe24d', dmg:1.4, hp:2.2, speed:1.18 },
  arcane:   { label:'Arcane',   aura:'#b06bff', dmg:1.6, hp:2.8, speed:1.0, burstOnDeath:true },
};
/** @type {string[]} */
const ELITE_KEYS = Object.keys(ELITE_MODS);

/**
 * Pick a random elite key from the ELITE_MODS catalog. Injected `rand`
 * lets tests be deterministic.
 *
 * @param {() => number} [rand=Math.random] - PRNG returning a value in [0, 1).
 * @returns {string} an ELITE_MODS key (e.g. 'vicious').
 */
export function rollEliteMod(rand=Math.random){ return ELITE_KEYS[Math.floor(rand()*ELITE_KEYS.length)]; }

export class Enemy {
  /**
   * Construct an enemy instance at a world position. Stats are pulled from
   * the CFG catalog and scaled by `levelScale`; passing an `elite` key from
   * ELITE_MODS promotes the enemy to a champion (bigger aura, more HP/DMG,
   * guaranteed gear drop on death).
   *
   * @param {number} x                 - world X position (px).
   * @param {number} y                 - world Y position (px).
   * @param {string} type               - catalog key; unknown types fall back to 'slime'.
   * @param {number} levelScale         - multiplicative scale for hp/dmg/xp/gold. Defaults to 1.
   * @param {string} elite              - elite key, e.g. 'vicious'. Unknown keys are ignored. Defaults to null.
   */
  /** @suppress {checkTypes} */
  constructor(x,y,type, levelScale, elite){
    if (type === undefined) type = 'slime';
    if (levelScale === undefined) levelScale = 1;
    if (elite === undefined) elite = null;
    this.x=x; this.y=y; this.type=type;
    const c=CFG[type]||CFG.slime;
    this.base=c;
    this.r=c.r; this.speed=c.speed; this.color=c.color;
    this.behavior=c.behavior;
    // elite (champion) modifier: buffs stats, paints an aura, guarantees gear
    this.elite = (elite && ELITE_MODS[elite]) ? elite : null;
    const m = this.elite ? ELITE_MODS[this.elite] : null;
    const hpMul=m?m.hp:1, dmgMul=m?m.dmg:1, spdMul=m?m.speed:1;
    if(m){ this.eliteMod=m; this.r=Math.round(c.r*1.25); this.speed=c.speed*spdMul; }
    // light level scaling so deeper maps are tougher
    this.hpMax=Math.round(c.hp*levelScale*hpMul); this.hp=this.hpMax;
    this.dmg=Math.round(c.dmg*levelScale*dmgMul);
    this.xp=Math.round(c.xp*levelScale*(m?3:1));
    this.goldMin=Math.round(c.gold[0]*(m?3:1)); this.goldMax=Math.round(c.gold[1]*(m?3:1));
    this.shootRange=c.shootRange||0; this.shootCd=c.shootCd||0; this.shootTimer=0;
    this.erratic=c.erratic||false;
    this.onHit = /** @type {StatusId|null} */ (c.onHit||null);
    /** @type {Statuses} */
    this.statuses = /** @type {Statuses} */ ({});
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
    // pathfinding: cached A* path + recompute throttle
    this.path=null; this.pathIdx=0; this.pathT=0;
    // behavior-specific state
    this.shootTimer=0;             // generic projectile timer
    this._mageT=Math.random()*2;   // mage: phase timer for hover/teleport
    this._berserkThreshold=c.hp*0.3;  // berserker: enrage at 30% HP
    this._enraged=false;           // berserker: visual + stat flag
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

  /**
   * Per-frame AI tick. Advances timers, ticks statuses, resolves
   * collisions, then dispatches to the behavior-specific AI (chase /
   * ranged / lunge / mage / berserker). Early-exits on death, freeze, or
   * status stun.
   *
   * @param {number} dt     - delta time in seconds since last frame.
   * @param {Player} player - the player to chase / attack.
   * @param {World} world   - the world/level for collision + pathfinding.
   * @param {Game} game     - the live Game instance (sounds, particles, flow field).
   * @returns {void}
   */
  update(dt, player, world, game){
    if(this.dead) return;
    // snow_stalker: track distance for the alpha fade
    if(this.type === 'snow_stalker'){
      this._stalkerFade = Math.hypot(this.x-player.x, this.y-player.y);
    }
    this.hitFlash=Math.max(0,this.hitFlash-dt);
    this.attackCd=Math.max(0,this.attackCd-dt);
    this.shootTimer=Math.max(0,this.shootTimer-dt);
    this.bob+=dt*6;
    if(this.frozen>0){ this.frozen-=dt; return; }
    // status effects (burn/poison dot, chill slow, stun)
    const st=tickStatuses(this,dt,game,false);
    if(this.dead || st.stunned) return;
    this._slowMul=1-st.slow;
    this._applyKnockback(world);
    this._collidePlayer(player,world);
    const dx=player.x-this.x, dy=player.y-this.y, dist=Math.hypot(dx,dy)||1;
    const nx=dx/dist, ny=dy/dist;

    if(!this._updatePerception(player,dist,nx,ny,dt)){
      this._idleBehavior(dt,world);   // not hunting: patrol/return home
      return;
    }
    // berserker enrage check: enrage at 30% HP (only if not already enraged)
    if(this.behavior==='berserker' && !this._enraged && this.hp <= this._berserkThreshold){
      this._enraged = true;
      this.speed *= 1.5;        // +50% speed
      this.dmg   = Math.round(this.dmg * 1.4);  // +40% damage
      game.spawnParticles(this.x, this.y, '#ff5050', 16);
      game.cam.shake = 4;
    }
    // hunting: dispatch by behavior
    if(this.behavior==='ranged')      this._rangedAI(dt,player,world,game,dist,nx,ny);
    else if(this.behavior==='lunge')  this._lungeAI(dt,player,world,game,dist,nx,ny);
    else if(this.behavior==='mage')   this._mageAI(dt,player,world,game,dist,nx,ny);
    else if(this.behavior==='berserker') this._berserkerAI(dt,player,world,game,dist,nx,ny);
    else                              this._chaseAI(dt,player,world,game,dist,nx,ny);
  }

  // Solid-body collision with the player: enemies can't walk through them.
  // The enemy yields (it gets pushed back to the contact surface), so the
  // player is never shoved into a wall by a swarm.
  _collidePlayer(player,world){
    let dx=this.x-player.x, dy=this.y-player.y;
    const min=this.r+player.r;
    let d=Math.hypot(dx,dy);
    if(d>=min) return;
    if(d<0.0001){ // exactly overlapping: nudge along facing so we have a direction
      const a=Math.atan2(this.face?this.face.y:1, this.face?this.face.x:0);
      dx=Math.cos(a); dy=Math.sin(a); d=1;
    }
    const push=(min-d);
    const ox=(dx/d)*push, oy=(dy/d)*push;
    // yield to the player, but don't get shoved into a wall (resolve per-axis)
    if(!world || !world.isSolid(this.x+ox+Math.sign(ox)*this.r, this.y)) this.x+=ox;
    if(!world || !world.isSolid(this.x, this.y+oy+Math.sign(oy)*this.r)) this.y+=oy;
  }

  _applyKnockback(world){
    if(Math.abs(this.knockback.x)>0.1||Math.abs(this.knockback.y)>0.1){
      this._move(this.knockback.x,this.knockback.y,world);
      this.knockback.x*=0.8; this.knockback.y*=0.8;
    }
  }

  // update alert from vision cone + leash; returns true if the enemy is hunting
  _updatePerception(player,dist,nx,ny,dt){
    this.alert=Math.max(0,this.alert-dt);
    const LEASH=360;
    if(this._canSee(player,dist,nx,ny) && this._homeDist()<LEASH) this.alert=3.0;
    return this.alert>0 && this._homeDist()<LEASH+260;
  }

  // ranged: hold range, shoot on cd; otherwise close the gap (pathfinding)
  _rangedAI(dt,player,world,game,dist,nx,ny){
    if(dist>=this.shootRange){ this._navigate(player.x,player.y,this.speed,world,dt,game); return; }
    if(dist<160) this._move(-nx*this.speed,-ny*this.speed,world);        // back away
    else if(dist>240) this._move(nx*this.speed*0.6,ny*this.speed*0.6,world);
    if(this.shootTimer<=0){ this.shootTimer=this.shootCd;
      const a=Math.atan2(player.y-this.y,player.x-this.x);
      if(this.onHit) game.enemyShootStatus(this.x,this.y,a,this.dmg,this.onHit);
      else game.enemyShoot(this.x,this.y,a,this.dmg); }
  }

  // chase: route around walls (erratic fliers jitter straight), melee on contact
  _chaseAI(dt,player,world,game,dist,nx,ny){
    if(this.erratic){
      this.wander.t-=dt; if(this.wander.t<=0){ this.wander.t=0.4+Math.random()*0.4;
        this.wander.x=(Math.random()-0.5)*1.4; this.wander.y=(Math.random()-0.5)*1.4; }
      this._move((nx+this.wander.x)*this.speed,(ny+this.wander.y)*this.speed,world);
      this.face={x:nx,y:ny};
    } else {
      this._navigate(player.x,player.y,this.speed,world,dt,game);
    }
    if(dist<this.r+player.r+2 && this.attackCd<=0){
      this.attackCd=0.8; player.takeDamage(this.dmg,Math.atan2(player.y-this.y,player.x-this.x)+Math.PI,game);
      if(this.onHit) applyStatus(player,this.onHit);
      this.knockback.x=-nx*2; this.knockback.y=-ny*2;
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
      if(dist>this.r+player.r){ this._navigate(player.x,player.y,this.speed,world,dt,game); }
      // only wind up a lunge when there's a clear line to the player (no wall between)
      if(dist<150 && world.hasLineOfSight(this.x,this.y,player.x,player.y)){
        this.lungeState='telegraph'; this.lungeTimer=0.5; this.lungeDir={x:nx,y:ny}; }
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

  // mage: hover at range, fire slow homing arcane missiles. When the player
  // closes in (within 60px) the mage teleports to a new open tile away from
  // the player (cooldown 4s). Mild idle drift keeps the mage visually alive.
  _mageAI(dt, player, world, game, dist, nx, ny){
    this._mageT -= dt;
    // melee body damage if the player walks into the mage
    if(dist < this.r + player.r + 2 && this.attackCd<=0){
      this.attackCd=1.0;
      player.takeDamage(this.dmg, Math.atan2(ny,nx)+Math.PI, game);
      if(this.onHit) applyStatus(player, this.onHit);
      this.knockback.x = -nx*2; this.knockback.y = -ny*2;
    }
    // teleport when cornered
    if(dist < 70 && this._mageT <= 0){
      const tx = player.x + nx*120 + (Math.random()-0.5)*60;
      const ty = player.y + ny*120 + (Math.random()-0.5)*60;
      if(world.nearestOpen){
        const np = world.nearestOpen(tx, ty);
        if(np && Math.hypot(np.x-this.x, np.y-this.y) > 30){
          game.spawnParticles(this.x, this.y, this.color, 12);
          this.x = np.x; this.y = np.y;
          game.spawnParticles(this.x, this.y, '#fff', 8);
          game.spawnParticles(this.x, this.y, this.color, 8);
          this._mageT = 4.0;  // next teleport cooldown
        } else { this._mageT = 1.0; }
      } else { this._mageT = 1.0; }
    }
    // main phase: maintain range, fire missiles
    if(this.shootTimer<=0){
      this.shootTimer=this.shootCd||1.8;
      // fire a homing arcane missile toward the player
      const ang = Math.atan2(player.y-this.y, player.x-this.x) + (Math.random()-0.5)*0.2;
      const color = this.type==='frost_mage' ? '#80c0ff' : (this.color||'#a45cff');
      const proj = new Projectile(this.x, this.y, ang, {
        speed: 4.0, dmg: this.dmg, r: 6, color,
        kind: this.type==='frost_mage' ? 'ice' : 'arcane', life: 2.0, hostile: true,
        // homing: handled by overriding angle each tick in the update loop below
        homing: 0.06,
      });
      if(game.projectiles) game.projectiles.push(proj);
      game.spawnParticles(this.x, this.y, color, 4);
    }
    // gentle drift away from the player when too close, toward when too far
    if(dist < 140)        this._move(-nx*this.speed, -ny*this.speed, world);
    else if(dist > this.shootRange) this._navigate(player.x, player.y, this.speed, world, dt, game);
    else                  this._move((nx+Math.sin(this.bob*2)*0.3)*this.speed*0.4, (ny+Math.cos(this.bob*2)*0.3)*this.speed*0.4, world);
    this.face = {x:nx, y:ny};
  }

  // berserker: slow approach, then chase at full speed. When HP < 30%, the
  // enrage flag (set in update) kicks in and the visual goes red. Damage
  // and speed are already boosted at that point. Contact damage only.
  _berserkerAI(dt, player, world, game, dist, nx, ny){
    if(dist < this.r + player.r + 2 && this.attackCd<=0){
      this.attackCd=0.7;
      const mult = this._enraged ? 1.25 : 1.0;
      player.takeDamage(Math.round(this.dmg*mult), Math.atan2(ny,nx)+Math.PI, game);
      if(this.onHit) applyStatus(player, this.onHit);
      this.knockback.x=-nx*2; this.knockback.y=-ny*2;
    }
    if(dist > this.r+player.r){
      // enrage: small charge forward in the player's direction
      if(this._enraged && this.attackCd <= 0){
        this._move(nx*this.speed*1.6, ny*this.speed*1.6, world);
      } else {
        this._navigate(player.x, player.y, this.speed, world, dt, game);
      }
    }
    this.face = {x:nx, y:ny};
  }

  _move(dx,dy,world){
    const m=this._slowMul==null?1:this._slowMul; dx*=m; dy*=m;
    if(!world.isSolid(this.x+dx+Math.sign(dx)*this.r,this.y)) this.x+=dx;
    if(!world.isSolid(this.x,this.y+dy+Math.sign(dy)*this.r)) this.y+=dy;
  }

  // Navigate toward (tx,ty) at the given speed, routing around walls.
  // If line-of-sight is clear -> steer straight (cheap, smooth).
  // Otherwise follow a cached A* path, recomputed a few times per second.
  // Sets this.face. Returns true if it produced movement toward the target.
  _navigate(tx,ty,speed,world,dt,game){
    this.pathT-=dt;
    if(world.hasLineOfSight(this.x,this.y,tx,ty)){
      // direct approach
      const dx=tx-this.x, dy=ty-this.y, d=Math.hypot(dx,dy)||1;
      const nx=dx/d, ny=dy/d;
      this._move(nx*speed,ny*speed,world); this.face={x:nx,y:ny};
      this.path=null; // drop stale path
      return true;
    }
    // Sprint 6 fast-path: read the shared flow field if Game has one. O(1)
    // per enemy, vs. per-enemy A* + line-of-sight throttling. Fall through
    // to the A* path if the field is missing or this cell is unreachable.
    if(game && game._flowField && game._flowField.isReachable(this.x, this.y)){
      const v = game._flowField.sample(this.x, this.y);
      if(v[0] !== 0 || v[1] !== 0){
        this._move(v[0]*speed, v[1]*speed, world);
        this.face = {x: v[0], y: v[1]};
        return true;
      }
    }
    // need a path; (re)compute on throttle or when exhausted
    if(this.pathT<=0 || !this.path || this.pathIdx>=this.path.length){
      // Sprint 6: use the smoothed A* — fewer waypoints, enemies cut corners.
      this.path=world.findPathSmoothed(this.x,this.y,tx,ty);
      this.pathIdx=0; this.pathT=0.4+Math.random()*0.2;
    }
    if(this.path && this.pathIdx<this.path.length){
      // advance through waypoints we've basically reached
      let wp=this.path[this.pathIdx];
      while(wp && Math.hypot(wp.x-this.x,wp.y-this.y)<TILE*0.5){
        this.pathIdx++; wp=this.path[this.pathIdx];
      }
      if(wp){
        const dx=wp.x-this.x, dy=wp.y-this.y, d=Math.hypot(dx,dy)||1;
        const nx=dx/d, ny=dy/d;
        this._move(nx*speed,ny*speed,world); this.face={x:nx,y:ny};
        return true;
      }
    }
    // no path found: fall back to nudging directly (best effort)
    const dx=tx-this.x, dy=ty-this.y, d=Math.hypot(dx,dy)||1;
    this._move(dx/d*speed,dy/d*speed,world); this.face={x:dx/d,y:dy/d};
    return false;
  }

  /**
   * Apply damage from an external source. Alerts the enemy, triggers the
   * hit-flash, applies knockback (modulated by `eliteMod.knockResist` for
   * elites), spawns a damage floater, and calls `kill()` if HP drops to 0.
   * No-op if the enemy is already dead.
   *
   * @param {number} dmg      - flat damage to subtract from `this.hp`.
   * @param {number} angle    - impact direction (rad); pushes knockback away from source.
   * @param {Game}   game     - the live Game instance (for floater + kill side-effects).
   * @param {number} [knock=4] - base knockback magnitude (px impulse).
   * @returns {void}
   */
  hit(dmg, angle, game, knock=4){
    if(this.dead) return;
    this.alert=4.0;  // taking a hit always alerts the enemy
    this.hp-=dmg; this.hitFlash=0.18;
    const kr=this.eliteMod&&this.eliteMod.knockResist?this.eliteMod.knockResist:1;
    this.knockback.x+=Math.cos(angle)*knock*kr; this.knockback.y+=Math.sin(angle)*knock*kr;
    game.floater('-'+dmg, this.x, this.y-14, '#fff');
    if(this.hp<=0) this.kill(game);
  }
  /**
   * Apply a freeze status for `t` seconds. Stacks with any existing freeze
   * (takes the max), and mirrors the duration onto the 'chill' status entry
   * for downstream tickers.
   *
   * @param {number} t - duration in seconds.
   * @returns {void}
   */
  freeze(t){ this.frozen=Math.max(this.frozen,t); applyStatus(this,'chill',t); }
  /**
   * Mark the enemy as dead and run the death pipeline: XP grant, particle
   * burst, gold drop, occasional item drop, and (for elites) a guaranteed
   * gear drop plus an optional radial projectile burst. Fires the kill
   * sound effect and the `onEnemyKilled` game hook. No-op if already dead.
   *
   * @param {Game} game - the live Game instance (player, particles, drops, SFX).
   * @returns {void}
   */
  kill(game){
    this.dead=true;
    game.player.gainXp(this.xp, game);
    game.spawnParticles(this.x,this.y,this.color,12);
    // guaranteed coin drop (scaled by greed skill)
    const amt=this.goldMin+Math.floor(Math.random()*(this.goldMax-this.goldMin+1));
    game.dropGold(this.x,this.y,amt);
    // occasional item drop
    if(Math.random()<0.08) game.dropItem(this.x,this.y);
    // elites: guaranteed rolled gear, extra particles, optional death burst
    if(this.elite){
      game.spawnParticles(this.x,this.y,this.eliteMod.aura,24);
      game.dropGear(this.x,this.y,0.85);
      if(this.eliteMod.burstOnDeath && game.enemyShoot){
        for(let i=0;i<8;i++) game.enemyShoot(this.x,this.y,(i/8)*Math.PI*2,Math.round(this.dmg*0.5));
      }
    }
    game.sfx('kill');
    game.onEnemyKilled(this);
  }
  /**
   * Render the enemy to a 2D canvas. Draws (in order) the elite aura, the
   * body via atlas or canvas-primitive fallback, the HP bar, the alert /
   * elite label, and the status effect pips. All coordinates are translated
   * by the camera.
   *
   * @param {CanvasRenderingContext2D} ctx - target 2D rendering context.
   * @param {{x:number, y:number}}     cam - camera world offset.
   * @returns {void}
   */
  draw(ctx,cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    // elite aura: pulsing coloured ring behind the body
    if(this.elite){
      const pulse=this.r+6+Math.sin(this.bob*1.5)*2;
      ctx.save(); ctx.globalAlpha=0.35; ctx.strokeStyle=this.eliteMod.aura; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(sx,sy,pulse,0,7); ctx.stroke(); ctx.restore();
    }
    // Sprint 11: try the enemy atlas for the base body. The atlas handles
    // the standing pose. Cosmetic overlays (aura above, hit-flash white
    // tint, lunge telegraph, elite glow) still come from the canvas
    // primitives below — the atlas is just the "skin" of the enemy.
    const bob=Math.sin(this.bob)*2;
    if(this._atlasDrawn(ctx, sx, sy, bob)) {
      // Atlas path took care of the base body. Cosmetic state handled
      // below for the cases the canvas code covers (hit-flash, lunge,
      // freeze tint, elite aura — the aura already drew above). The
      // canvas-primitive body branch is skipped.
    } else {
      this._drawCanvas(ctx, sx, sy, bob);
    }
    // Floating HP pip above the body for champions / bosses (skipped on
    // the atlas path so it never double-draws).
  }

  // Sprint 11: atlas-aware base body draw. Returns true if the atlas took
  // over. The hit-flash / lunge telegraph / freeze tint are applied as
  // colored overlay on top of the atlas frame.
  _atlasDrawn(ctx, sx, sy, bob){
    if(!isUsingAtlases()) return false;
    const drew = drawImageFromAtlas(ctx, 'enemies', this.type, sx, sy, { bob });
    if(!drew) return false;
    // Cosmetic overlays. We tint the frame if hit-frozen, hit-flash, or
    // telegraphing — keeps the canonical visual signals (frosted blue,
    // pure white, strobe red) without losing the new sprite art.
    let tint = null;
    if(this.frozen > 0) tint = 'rgba(159,216,255,0.5)';
    else if(this.hitFlash > 0) tint = 'rgba(255,255,255,0.7)';
    else if(this.lungeState === 'telegraph') tint = 'rgba(255,80,80,0.5)';
    if(tint){
      ctx.save();
      ctx.fillStyle = tint;
      // Cover the same region the atlas drew (24x24 or 24x32 around sx,sy).
      const c = _atlasLookupFrame('enemies', this.type);
      const w = c ? c[2] : 24, h = c ? c[3] : 32;
      ctx.fillRect(sx - w/2, sy - h/2 + bob, w, h);
      ctx.restore();
    }
    return true;
  }

  // Sprint 11: original canvas-primitive draw path, kept verbatim for
  // fallback when the atlas isn't ready (first frame after load, or the
  // toggle is off). Cosmetic state (hit-flash, lunge telegraph, freeze)
  // is baked into `c` at the top.
  _drawCanvas(ctx, sx, sy, bob){
    let c=this.hitFlash>0?'#fff':(this.frozen>0?'#9fd8ff':this.color);
    // telegraph flash (lunge windup)
    if(this.lungeState==='telegraph'){ c=Math.floor(performance.now()/80)%2?'#ff5050':this.color; }
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
    } else if(t==='mage' || t==='frost_mage'){
      // robed figure: wide triangular robe, hat, glowing eyes. The frost
      // variant draws in icy blue and adds a small floating crystal.
      const isFrost = t === 'frost_mage';
      // body/robe
      ctx.fillStyle=c; ctx.beginPath();
      ctx.moveTo(sx-this.r, sy+this.r); ctx.lineTo(sx+this.r, sy+this.r);
      ctx.lineTo(sx+4, sy-4+bob); ctx.lineTo(sx-4, sy-4+bob);
      ctx.closePath(); ctx.fill();
      // head
      ctx.fillStyle='#f1c39a'; ctx.fillRect(sx-5,sy-12+bob,10,8);
      // hat
      ctx.fillStyle = isFrost ? '#6090d0' : '#4a2a6a';
      ctx.beginPath();
      ctx.moveTo(sx-7, sy-7+bob); ctx.lineTo(sx+7, sy-7+bob);
      ctx.lineTo(sx+3, sy-18+bob); ctx.lineTo(sx-3, sy-18+bob);
      ctx.closePath(); ctx.fill();
      // hat tip
      ctx.fillStyle = isFrost ? '#bfe8ff' : '#a45cff';
      ctx.fillRect(sx-1, sy-19+bob, 2, 3);
      // glowing eyes
      ctx.fillStyle = isFrost ? '#bfe8ff' : '#a45cff';
      ctx.fillRect(sx-3, sy-9+bob, 2, 2);
      ctx.fillRect(sx+1, sy-9+bob, 2, 2);
      // floating crystal in front
      ctx.fillStyle = isFrost ? '#bfe8ff' : '#a45cff';
      const cx = sx + Math.cos(this.bob*2)*4;
      const cy = sy - 18 + Math.sin(this.bob*2)*3;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
    } else if(t==='berserker'){
      // big brutish body; pulse red when enraged
      const tint = this._enraged ? '#ff5050' : c;
      const aura = this._enraged ? 0.45 + 0.2*Math.sin(performance.now()/100) : 0;
      if(this._enraged){
        ctx.save(); ctx.globalAlpha=aura; ctx.fillStyle='#ff3030';
        ctx.beginPath(); ctx.arc(sx,sy+bob,this.r+5,0,7); ctx.fill(); ctx.restore();
      }
      // body
      ctx.fillStyle=tint; ctx.fillRect(sx-this.r,sy-10+bob,this.r*2,22);
      // belt
      ctx.fillStyle='#2a1a14'; ctx.fillRect(sx-this.r,sy+4+bob,this.r*2,3);
      // shoulders
      ctx.fillStyle=tint; ctx.fillRect(sx-this.r-2,sy-12+bob,5,8);
      ctx.fillRect(sx+this.r-3,sy-12+bob,5,8);
      // head
      ctx.fillStyle='#d8a070'; ctx.fillRect(sx-6,sy-18+bob,12,8);
      // angry eyes
      ctx.fillStyle='#ff0'; ctx.fillRect(sx-4,sy-15+bob,2,2);
      ctx.fillStyle='#ff0'; ctx.fillRect(sx+2,sy-15+bob,2,2);
      // mouth
      ctx.fillStyle='#3a1a14'; ctx.fillRect(sx-3,sy-11+bob,6,1);
      // weapon: huge axe in right hand
      ctx.fillStyle='#5a3a22'; ctx.fillRect(sx+this.r+2, sy-6+bob, 2, 14);
      ctx.fillStyle='#aaaaaa'; ctx.beginPath();
      ctx.moveTo(sx+this.r+4, sy-10+bob); ctx.lineTo(sx+this.r+10, sy-4+bob);
      ctx.lineTo(sx+this.r+10, sy+4+bob); ctx.lineTo(sx+this.r+4, sy+8+bob);
      ctx.closePath(); ctx.fill();
    } else if(t==='spitter'){
      ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(sx,sy+bob,this.r,this.r*0.8,0,0,7); ctx.fill();
      ctx.fillStyle='#9aff5f'; ctx.beginPath(); ctx.arc(sx,sy-2+bob,3,0,7); ctx.fill(); // glowing maw
      ctx.fillStyle='#1a3a0a'; ctx.fillRect(sx-6,sy-5+bob,3,3); ctx.fillRect(sx+3,sy-5+bob,3,3);
    } else if(t==='ice_wraith'){
      // ghostly floating form: cyan blob with hollow eyes and trailing wisps
      ctx.save(); ctx.globalAlpha=0.85; ctx.fillStyle=c;
      ctx.beginPath(); ctx.ellipse(sx, sy+bob, this.r, this.r*0.9, 0, 0, 7); ctx.fill();
      ctx.globalAlpha=0.45; ctx.beginPath(); ctx.ellipse(sx+2, sy+2+bob, this.r*0.7, this.r*0.5, 0, 0, 7); ctx.fill();
      ctx.globalAlpha=1;
      // hollow eyes (dark)
      ctx.fillStyle='#1a2a3a'; ctx.fillRect(sx-4, sy-2+bob, 2, 2);
      ctx.fillRect(sx+2, sy-2+bob, 2, 2);
      // trailing wisps below
      ctx.fillStyle='rgba(180,220,255,0.5)';
      ctx.beginPath(); ctx.moveTo(sx-5, sy+6+bob); ctx.quadraticCurveTo(sx, sy+12+bob, sx+5, sy+6+bob); ctx.fill();
      ctx.restore();
    } else if(t==='frost_golem'){
      // hulking icy body with cracks
      ctx.fillStyle=c; ctx.fillRect(sx-this.r, sy-this.r+bob, this.r*2, this.r*2);
      ctx.fillStyle='#7a98b0'; ctx.fillRect(sx-this.r+3, sy-this.r+3+bob, this.r*2-6, this.r*2-6);
      // cracks (icy white)
      ctx.fillStyle='#eaf6ff';
      ctx.fillRect(sx-4, sy-4+bob, 8, 1);
      ctx.fillRect(sx-2, sy-2+bob, 4, 1);
      ctx.fillRect(sx+2, sy+2+bob, 6, 1);
      // eyes
      ctx.fillStyle='#bfe8ff'; ctx.fillRect(sx-6, sy-2+bob, 4, 4);
      ctx.fillStyle='#fff';    ctx.fillRect(sx+2, sy-2+bob, 4, 4);
    } else if(t==='snow_stalker'){
      // pale wraith-like figure that fades into the snow
      const dist = this._stalkerFade || 0;
      const alpha = 0.35 + 0.45 * Math.min(1, dist / 80);
      ctx.save(); ctx.globalAlpha = alpha;
      // body
      ctx.fillStyle=c; ctx.fillRect(sx-7, sy-9+bob, 14, 18);
      // shoulders
      ctx.fillStyle=c; ctx.fillRect(sx-10, sy-12+bob, 5, 8);
      ctx.fillRect(sx+5,  sy-12+bob, 5, 8);
      // face
      ctx.fillStyle='#1a1a24';
      ctx.fillRect(sx-4, sy-6+bob, 2, 2);
      ctx.fillRect(sx+2, sy-6+bob, 2, 2);
      // dagger in hand
      ctx.fillStyle='#dadada'; ctx.fillRect(sx+9, sy-4+bob, 1, 6);
      ctx.fillStyle='#5a3a22'; ctx.fillRect(sx+8, sy+2+bob, 3, 1);
      ctx.restore();
    } else if(t==='frozen_husk'){
      // shambling zombie: bulky, cracked icy skin
      ctx.fillStyle=c; ctx.fillRect(sx-this.r, sy-9+bob, this.r*2, 18);
      // belly
      ctx.fillStyle='#5a6a7a'; ctx.fillRect(sx-this.r+2, sy+1+bob, this.r*2-4, 8);
      // cracks
      ctx.fillStyle='#a8c8e0';
      ctx.fillRect(sx-6, sy-3+bob, 3, 1);
      ctx.fillRect(sx+3, sy+bob, 4, 1);
      // head (rotting, mostly exposed)
      ctx.fillStyle='#c0a890'; ctx.fillRect(sx-6, sy-15+bob, 12, 8);
      ctx.fillStyle='#1a1a14'; ctx.fillRect(sx-4, sy-13+bob, 2, 2);
      ctx.fillStyle='#1a1a14'; ctx.fillRect(sx+2, sy-13+bob, 2, 2);
      // exposed ribs showing through the belly
      ctx.fillStyle='#e0eef5';
      ctx.fillRect(sx-3, sy+3+bob, 6, 1);
      ctx.fillRect(sx-3, sy+5+bob, 6, 1);
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
    if(this.elite){ ctx.fillStyle=this.eliteMod.aura; ctx.font='bold 9px monospace'; ctx.textAlign='center';
      ctx.fillText(this.eliteMod.label, sx, sy-this.r-16); }
    drawStatusPips(this,ctx,sx,sy);
  }
}

/**
 * Options bag for the Projectile constructor. All fields are optional; sane
 * defaults are applied for any missing key. The shape is purposely loose to
 * match the existing call sites in the codebase (e.g. mage AI passes a
 * partial set including `homing`).
 *
 * @typedef {Object} ProjectileOpts
 * @property {number} [speed]      - flight speed (px/s). Default 5.
 * @property {number} [dmg]        - damage on impact. Default 10.
 * @property {number} [r]          - collision radius. Default 5.
 * @property {string} [color]      - draw color (hex). Default '#ffcf4d'.
 * @property {number} [life]       - lifetime in seconds. Default 1.2.
 * @property {string} [kind]       - effect key ('fire'|'ice'|'arcane'|...). Default 'fire'.
 * @property {boolean} [hostile]   - true = enemy projectile (hits player). Default false.
 * @property {number} [aoe]        - AoE radius (0 = single target). Default 0.
 * @property {StatusId|null} [status] - status key to apply on hit. Default null.
 * @property {number} [statusDur]  - status duration override (s). Default 0.
 * @property {number} [chain]      - remaining chain-lightning bounces. Default 0.
 * @property {boolean} [crit]      - emit a 'CRIT' floater on hit. Default false.
 * @property {number} [lifesteal]  - fraction of damage healed on hit. Default 0.
 * @property {number} [homing]     - max angular turn per frame (rad). Default 0.
 */

export class Projectile {
  /**
   * Construct a projectile at `(x, y)` flying in `angle` radians. All
   * tunables (damage, radius, lifetime, homing, AoE, lifesteal, …) come
   * from the `opts` bag.
   *
   * @param {number} x                 - world X (px).
   * @param {number} y                 - world Y (px).
   * @param {number} angle             - initial flight angle (rad).
   * @param {ProjectileOpts} [opts]     - tunables; see ProjectileOpts.
   * @suppress {checkTypes}
   */
  constructor(x,y,angle,opts){
    this.x=x; this.y=y; this.angle=angle;
    opts = opts || {};
    this.speed=opts.speed||5; this.dmg=opts.dmg||10; this.r=opts.r||5;
    this.color=opts.color||'#ffcf4d'; this.life=opts.life||1.2;
    this.kind=opts.kind||'fire'; this.hostile=opts.hostile||false;
    this.aoe=opts.aoe||0; this.status=opts.status||null;
    this.statusDur=opts.statusDur||0;  // Sprint 5: ammo elemental duration override
    this.chain=opts.chain||0; this.crit=opts.crit||false; this.lifesteal=opts.lifesteal||0;
    // Sprint 15: store the homing factor so mage/boss projectiles actually
    // home. Before this, opts.homing was passed by callers but the constructor
    // never copied it into this.homing, so the update() check on line 681
    // always evaluated false (projectiles flew straight).
    this.homing=opts.homing||0;
    this.hitSet=null; this.dead=false; this.trail=[];
  }
  /**
   * Advance the projectile one frame: optionally steer toward the player
   * (homing), step forward, age the trail, expire on life/solid, and
   * resolve collisions (player for hostile; boss + enemies otherwise).
   *
   * @param {number} dt                  - delta time in seconds.
   * @param {World} world                - the world/level for solid checks.
   * @param {Array<Enemy>} enemies       - active enemy list (for friendly fire).
   * @param {Game} game                  - the live Game instance (player, boss, particles).
   * @returns {void}
   */
  update(dt, world, enemies, game){
    // Homing projectiles gently steer toward the player. Steered by a small
    // angular velocity (homing param) rather than full lock-on, so they can
    // be dodged with sharp movement.
    if(this.homing && game && game.player){
      const desired = Math.atan2(game.player.y-this.y, game.player.x-this.x);
      // smallest-angle delta
      let delta = ((desired - this.angle + Math.PI*3) % (Math.PI*2)) - Math.PI;
      this.angle += Math.max(-this.homing, Math.min(this.homing, delta));
    }
    this.x+=Math.cos(this.angle)*this.speed; this.y+=Math.sin(this.angle)*this.speed;
    this.life-=dt;
    this.trail.push({x:this.x,y:this.y}); if(this.trail.length>6) this.trail.shift();
    if(this.life<=0 || world.isSolid(this.x,this.y)){
      this.dead=true; if(this.aoe && !this.hostile) this._applyAoe(game,enemies);
      game.spawnParticles(this.x,this.y,this.color,6); return; }
    if(this.hostile){ this._hitPlayer(game); }
    else { this._hitBoss(game,enemies); this._hitEnemy(game,enemies); }
  }
  /**
   * Check collision with the player and apply damage + status. Used by
   * hostile projectiles. Marks the projectile dead on contact.
   *
   * @param {Game} game - the live Game instance (for `game.player`).
   * @returns {void}
   */
  _hitPlayer(game){
    const p=game.player;
    if(Math.hypot(p.x-this.x,p.y-this.y)<p.r+this.r){
      p.takeDamage(this.dmg,this.angle,game);
      if(this.status) applyStatus(p,this.status);
      this.dead=true; game.spawnParticles(this.x,this.y,this.color,6); }
  }
  /**
   * Check collision with the boss. Applies AoE (when configured) or
   * direct hit + status, triggers lifesteal, and marks the projectile dead
   * on contact.
   *
   * @param {Game} game            - the live Game instance (for `game.boss`).
   * @param {Array<Enemy>} enemies - active enemy list (for AoE if triggered).
   * @returns {void}
   */
  _hitBoss(game,enemies){
    const boss=game.boss;
    if(boss && !boss.dead && Math.hypot(boss.x-this.x,boss.y-this.y)<boss.r+this.r){
      if(this.aoe) this._applyAoe(game,enemies);
      else { boss.hit(this.dmg,this.angle,game,3);
        if(this.kind==='ice') boss.freeze(1.0);
        else if(this.status) applyStatus(boss,this.status,this.statusDur||undefined); }
      if(this.lifesteal>0) game.player.heal(this.dmg*this.lifesteal,game);
      this.dead=true; game.spawnParticles(this.x,this.y,this.color,8); }
  }
  /**
   * Scan `enemies` for a collision. On hit, applies damage + status, emits
   * a crit floater if applicable, applies lifesteal, and (if `chain > 0`)
   * picks a new nearby target and reroutes the projectile at 80% damage.
   * Marks the projectile dead on the final non-chain hit.
   *
   * @param {Game} game            - the live Game instance (for particles + player heal).
   * @param {Array<Enemy>} enemies - active enemy list to scan.
   * @returns {void}
   */
  _hitEnemy(game,enemies){
    for(const e of enemies){ if(e.dead) continue;
      if(this.hitSet && this.hitSet.has(e)) continue;
      if(Math.hypot(e.x-this.x,e.y-this.y)>=e.r+this.r) continue;
      if(this.aoe){ this._applyAoe(game,enemies); this.dead=true;
        game.spawnParticles(this.x,this.y,this.color,8); return; }
      e.hit(this.dmg,this.angle,game,5);
      if(this.crit) game.floater('CRIT',e.x,e.y-24,'#ffcf4d');
      if(this.kind==='ice') e.freeze(1.5);
      else if(this.status) applyStatus(e,this.status,this.statusDur||undefined);
      if(this.lifesteal>0) game.player.heal(this.dmg*this.lifesteal,game);
      game.spawnParticles(this.x,this.y,this.color,8);
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
  /**
   * Apply the area-of-effect damage pulse at the projectile's current
   * position: shake the camera, spawn burst particles, and `hit()` every
   * live enemy within `this.aoe` radius.
   *
   * @param {Game} game            - the live Game instance (particles, camera shake).
   * @param {Array<Enemy>} enemies - active enemy list (AoE targets).
   * @returns {void}
   */
  _applyAoe(game,enemies){
    game.spawnParticles(this.x,this.y,this.color,24); game.cam.shake=10;
    for(const e of enemies){ if(e.dead) continue;
      if(Math.hypot(e.x-this.x,e.y-this.y)<this.aoe) e.hit(this.dmg,Math.random()*7,game,8); }
  }
  /**
   * Render the projectile's fading trail and its body (colored disc with
   * a white core). All coordinates are translated by the camera.
   *
   * @param {CanvasRenderingContext2D} ctx - target 2D rendering context.
   * @param {{x:number, y:number}}     cam - camera world offset.
   * @returns {void}
   */
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
  /**
   * Construct a short-lived cosmetic particle. Initial velocity is a
   * random unit-vector scaled by `[1, 4]`; lifetime is randomized in
   * `[0.4, 0.8]` seconds.
   *
   * @suppress {checkTypes}
   * @param {number} x     - world X (px).
   * @param {number} y     - world Y (px).
   * @param {string} color - draw color (hex).
   */
  constructor(x,y,color){
    this.x=x; this.y=y; this.color=color;
    const a=Math.random()*7, s=1+Math.random()*3;
    this.vx=Math.cos(a)*s; this.vy=Math.sin(a)*s;
    this.life=0.4+Math.random()*0.4; this.max=this.life; this.size=2+Math.random()*3;
  }
  /**
   * Advance the particle: integrate position, damp velocity (0.9 per frame),
   * and tick down lifetime.
   *
   * @param {number} dt - delta time in seconds.
   * @returns {void}
   */
  update(dt){ this.x+=this.vx; this.y+=this.vy; this.vx*=0.9; this.vy*=0.9; this.life-=dt; }
  /**
   * Render the particle as a single colored square with alpha proportional
   * to remaining lifetime. Camera-translated.
   *
   * @param {CanvasRenderingContext2D} ctx - target 2D rendering context.
   * @param {{x:number, y:number}}     cam - camera world offset.
   * @returns {void}
   */
  draw(ctx,cam){ ctx.globalAlpha=Math.max(0,this.life/this.max); ctx.fillStyle=this.color;
    ctx.fillRect(this.x-cam.x,this.y-cam.y,this.size,this.size); ctx.globalAlpha=1; }
  /**
   * @returns {boolean} true once `life` has elapsed.
   */
  get dead(){ return this.life<=0; }
}
