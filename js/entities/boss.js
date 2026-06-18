import { applyStatus } from '../systems/status.js';
import { Projectile } from './enemy.js';

/**
 * @typedef {import('./enemy.js').EnemyState} EnemyState
 * @typedef {import('../systems/status.js').Statuses} Statuses
 *
 * @typedef {'burn'|'poison'|'chill'|'stun'} BossStatusId
 *
 * @typedef {Object} BossPhase
 * One row in `BOSSES[id].phases`. Phases are evaluated in order; the boss
 * transitions to phase i when `hp / hpMax <= at`.
 * @property {number} at           - HP fraction (0..1) at which this phase begins
 * @property {BossAttackId[]} attacks - pool of attacks the boss picks from
 * @property {number} interval     - seconds between attacks in this phase
 * @property {string} tint         - body fill color used while in this phase
 *
 * @typedef {'burst'|'charge'|'summon'|'poisonNova'
 *          |'frostBolt'|'blizzard'|'iceWall'|'clones'
 *          |'fireball'|'lavaPool'|'nova'} BossAttackId
 *
 * @typedef {Object} BossDef
 * Static boss definition, used to construct a Boss instance.
 * @property {string}      name    - display name
 * @property {string}      map     - map id where this boss spawns
 * @property {number}      x       - tile-x spawn coordinate
 * @property {number}      y       - tile-y spawn coordinate
 * @property {number}      hp      - max HP
 * @property {number}      dmg     - base contact/attack damage
 * @property {number}      r       - body radius (px)
 * @property {string}      color   - fallback body color
 * @property {number}      xp      - XP reward on kill
 * @property {number}      gold    - gold reward on kill
 * @property {string}      drop    - gear id guaranteed to drop on kill
 * @property {string[]}    adds    - enemy-type ids summoned by 'summon'
 * @property {BossPhase[]} phases - ordered phase list (HP-fraction gated)
 * @property {boolean}     [poison]   - legacy flag for poison-attack bosses
 * @property {BossStatusId}  [onHit]    - status id applied on contact (e.g. 'chill')
 * @property {string}      [icon]     - single Unicode char (HUD tag) - magma_tyrant
 * @property {number}      [atk]      - alternate attack stat (magma_tyrant)
 * @property {number}      [def]      - alternate defense stat (magma_tyrant)
 *
 * @typedef {Object} BossClone
 * Decoy spawned by Glacius's 'clones' attack. Ticked/drawn from game._bossClones.
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {number} maxHp
 * @property {boolean} dead
 * @property {string} color
 * @property {number} phaseIdx
 * @property {true}   isClone
 * @property {{name:string,tint:string}} def
 * @property {(dmg:number, a:number, g:any, knock?:number) => void} hit
 * @property {(ctx:CanvasRenderingContext2D, cam:any) => void} draw
 *
 * @typedef {Object} BossState
 * Runtime state for one Boss instance. Inherits all EnemyState fields
 * (x, y, r, color, hp, hpMax, dmg, dead, knockback, frozen, hitFlash,
 * statuses, ...) and adds the boss-specific fields below.
 * @property {string}      id        - key into BOSSES
 * @property {BossDef}     def       - static boss definition
 * @property {true}        isBoss    - discriminator flag
 * @property {number}      xp        - XP reward (mirrored from def)
 * @property {number}      speed     - base move speed (tiles/s)
 * @property {number}      phaseIdx  - index into def.phases
 * @property {number}      atkTimer  - seconds until next attack fires
 * @property {'idle'|'telegraph'|'charge'} state  - AI state machine
 * @property {number}      stateTimer - seconds remaining in current state
 * @property {{x:number,y:number}} chargeDir - normalized charge direction
 * @property {number}      bob       - animation phase accumulator
 * @property {number}      intro     - intro invuln/grace seconds remaining
 * @property {BossAttackId|null} pending - selected attack during telegraph
 * @property {number}      _touchCd  - contact-damage cooldown seconds
 */

// Boss definitions. Each boss has phases (HP fractions) that change its move set.
// Attacks: 'burst' (radial projectiles), 'charge' (telegraph + dash), 'summon' (adds),
//          'poisonNova' (radial poison shots).
/** @type {Record<string, BossDef>} */
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

  // ---- one boss per overworld biome, lurking in each biome's deepest sub-area ----
  meadow_warden: {
    name:'The Meadow Warden', map:'meadow_glade', x:24, y:8,
    hp:520, dmg:14, r:24, color:'#4caf50', xp:320, gold:220,
    drop:'spear_iron', adds:['slime','boar'],
    phases:[
      { at:1.00, attacks:['charge','burst'],            interval:2.6, tint:'#4caf50' },
      { at:0.50, attacks:['burst','summon','charge'],   interval:1.9, tint:'#7fd884' },
    ],
  },
  forest_matron: {
    name:'Thornroot Matron', map:'forest_deep', x:26, y:8,
    hp:680, dmg:17, r:23, color:'#2e7d32', xp:430, gold:300,
    drop:'bow_long', adds:['archer','boar','bat'],
    phases:[
      { at:1.00, attacks:['burst','summon'],                  interval:2.3, tint:'#2e7d32' },
      { at:0.55, attacks:['burst','summon','charge'],         interval:1.8, tint:'#66bb6a' },
      { at:0.28, attacks:['burst','burst','summon','charge'], interval:1.3, tint:'#a5d6a7' },
    ],
  },
  desert_colossus: {
    name:'Sandstone Colossus', map:'desert_ruins', x:25, y:8,
    hp:900, dmg:22, r:28, color:'#d2a04a', xp:560, gold:380,
    drop:'warhammer', adds:['scorpion','brute'],
    phases:[
      { at:1.00, attacks:['charge','burst'],                  interval:2.5, tint:'#d2a04a' },
      { at:0.55, attacks:['charge','charge','burst'],         interval:1.9, tint:'#e8c074' },
      { at:0.28, attacks:['charge','burst','summon'],         interval:1.4, tint:'#f4dca0' },
    ],
  },
  cave_brood: {
    name:'The Crystal Brood', map:'cave', x:25, y:8,
    hp:1000, dmg:24, r:26, color:'#9a5fd0', xp:640, gold:440,
    drop:'staff_arcane', adds:['golem','bat'],
    phases:[
      { at:1.00, attacks:['burst','summon'],                       interval:2.2, tint:'#9a5fd0' },
      { at:0.60, attacks:['burst','burst','summon'],               interval:1.7, tint:'#b478e8' },
      { at:0.30, attacks:['burst','burst','summon','charge'],      interval:1.2, tint:'#d0a8ff' },
    ],
  },
  snow_jarl: {
    name:'Frostfang Jarl', map:'snow_glacier', x:25, y:8,
    hp:1150, dmg:25, r:26, color:'#bfe8ff', xp:720, gold:500,
    drop:'sword_frost', adds:['frostling','yeti'], onHit:'chill',
    phases:[
      { at:1.00, attacks:['charge','burst'],                  interval:2.3, tint:'#bfe8ff' },
      { at:0.60, attacks:['burst','summon','charge'],         interval:1.8, tint:'#e0f4ff' },
      { at:0.30, attacks:['burst','burst','charge','summon'], interval:1.3, tint:'#ffffff' },
    ],
  },
  swamp_horror: {
    name:'The Sunken Horror', map:'swamp_depths', x:26, y:8,
    hp:1250, dmg:27, r:27, color:'#5e9e3a', xp:820, gold:560,
    drop:'dagger_venom', adds:['spitter','croaker'], poison:true,
    phases:[
      { at:1.00, attacks:['poisonNova','burst'],                   interval:2.2, tint:'#5e9e3a' },
      { at:0.60, attacks:['poisonNova','summon','burst'],          interval:1.7, tint:'#84c25a' },
      { at:0.30, attacks:['poisonNova','burst','summon','charge'], interval:1.2, tint:'#aede82' },
    ],
  },
  magma_tyrant: {
    name:'Magma Tyrant', icon:'◆', color:'#ff4400',
    map:'volcano_depths', x:20, y:20,
    hp:1800, dmg:28, r:28, def:12, xp:800, gold:600,
    drop:'sword_firesword',
    adds:[],
    phases:[
      { at:1.0, attacks:['fireball','summon','charge'], interval:1.8, tint:'#ff6600' },
      { at:0.50, attacks:['fireball','lavaPool','summon','charge'], interval:1.3, tint:'#ff2200' },
      { at:0.25, attacks:['lavaPool','fireball','summon','charge','nova'], interval:0.9, tint:'#ff0000' },
    ],
  },
  // ============== Frozen Tundra end-boss ==============
  // Glacius, the Eternal Winter. Special attacks:
  //  - iceWall:     drops a row of 5 ice projectiles in a line in front of the boss
  //  - blizzard:    a large radial burst of 24 ice projectiles (chill on hit)
  //  - clones:      summons 2 frozen decoys that mimic Glacius but die in 1 hit
  //  - frostBolt:   a single homing ice bolt at the player
  glacius: {
    name:'Glacius, the Eternal Winter', map:'frost_spire', x:24, y:8,
    hp:1500, dmg:24, r:30, color:'#bfe8ff', xp:1200, gold:800,
    drop:'staff_arcane', adds:['ice_wraith','frost_golem'], onHit:'chill',
    phases:[
      { at:1.00, attacks:['frostBolt','blizzard','iceWall'],   interval:2.2, tint:'#bfe8ff' },
      { at:0.60, attacks:['blizzard','clones','iceWall','frostBolt'], interval:1.7, tint:'#e0f4ff' },
      { at:0.30, attacks:['blizzard','iceWall','clones','frostBolt'], interval:1.3, tint:'#ffffff' },
    ],
  },
};

/**
 * @class Boss
 * @extends EnemyState  (conceptual — Boss shares Enemy's collision/draw signature)
 *
 * Bosses are heavyweight enemies with multi-phase attack sets. They share
 * the basic movement/collision model of {@link Enemy} but add:
 *  - phase machine (HP-fraction gated attack pools)
 *  - telegraph + charge state
 *  - boss-only special attacks (frostBolt, blizzard, iceWall, clones, magma)
 */
export class Boss {
  /**
   * @param {string} bossId - key into {@link BOSSES}
   */
  constructor(bossId){
    const def = BOSSES[bossId];
    this.id = bossId; this.def = def; this.isBoss = true;
    this.x = def.x * 32 + 16; this.y = def.y * 32 + 16;
    this.r = def.r; this.color = def.color;
    this.hpMax = def.hp; this.hp = def.hp; this.dmg = def.dmg;
    this.xp = def.xp; this.speed = 1.0;
    this.dead = false; this.hitFlash = 0; this.frozen = 0;
    this.knockback = { x:0, y:0 };
    /** @type {Statuses} */
    this.statuses = /** @type {Statuses} */ ({});
    this.phaseIdx = 0; this.atkTimer = def.phases[0].interval;
    this.state = 'idle'; this.stateTimer = 0; this.chargeDir = { x:0, y:0 };
    this.bob = 0; this.intro = 1.5; this.pending = null; this._touchCd = 0;
  }

  /**
   * Currently-active phase definition (the row at `phaseIdx`).
   * @returns {BossPhase}
   */
  get phase(){ return this.def.phases[this.phaseIdx]; }

  /**
   * Walk the phase list and advance `phaseIdx` if `hp / hpMax` has crossed
   * a phase threshold. Resets to 'idle' with a shortened attack timer on
   * transition so the phase change is felt immediately.
   * @returns {void}
   */
  _advancePhase(){
    const frac = this.hp / this.hpMax;
    let idx = 0;
    for(let i=0;i<this.def.phases.length;i++){ if(frac <= this.def.phases[i].at) idx = i; }
    if(idx !== this.phaseIdx){
      this.phaseIdx = idx;
      this.state = 'idle'; this.atkTimer = this.phase.interval * 0.6;
    }
  }

  /**
   * Per-tick update. Drives intro grace, frozen decay, knockback, phase
   * advancement, movement (idle), telegraph timer, charge dash, and
   * contact damage.
   * @param {number} dt - delta time in seconds
   * @param {import('./player.js').Player} player
   * @param {{isSolid:(x:number,y:number)=>boolean}} world
   * @param {any} game - Game singleton (cam, spawnAdd, toast, onBossDefeated, etc.)
   * @returns {void}
   */
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
        player.takeDamage(this.dmg, Math.atan2(dy,dx), game);
        if(this.def.onHit) applyStatus(player, this.def.onHit); }
    } else if(this.state === 'telegraph'){
      this.stateTimer -= dt;
      if(this.stateTimer <= 0) this._fireAttack(player, world, game);
    } else if(this.state === 'charge'){
      this.stateTimer -= dt;
      this._move(this.chargeDir.x*this.speed*6, this.chargeDir.y*this.speed*6, world);
      if(dist < this.r + player.r + 4 && this._touchCd<=0){ this._touchCd=0.8;
        player.takeDamage(Math.round(this.dmg*1.3), Math.atan2(this.chargeDir.y,this.chargeDir.x), game);
        if(this.def.onHit) applyStatus(player, this.def.onHit); }
      if(this.stateTimer <= 0){ this.state='idle'; this.atkTimer=this.phase.interval; }
    }
  }

  /**
   * Pick a random attack from the current phase's attack pool, lock it into
   * `this.pending`, and enter the 'telegraph' state. For 'charge', capture
   * the direction-to-player up front so the dash lines up.
   * @param {{x:number,y:number}} player
   * @returns {void}
   */
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

  /**
   * Execute the attack that was chosen by {@link _chooseAttack}. Dispatches
   * on `this.pending` (charge / burst / poisonNova / summon / frostBolt /
   * blizzard / iceWall / clones / fireball|lavaPool|nova). Each branch
   * resolves on this tick and returns to 'idle'.
   * @param {{x:number,y:number,r:number}} player
   * @param {{isSolid:(x:number,y:number)=>boolean}} world
   * @param {any} game
   * @returns {void}
   */
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
    } else if(pick === 'frostBolt'){
      // single homing ice bolt
      const a = Math.atan2(player.y-this.y, player.x-this.x);
      const proj = new Projectile(this.x, this.y, a, {
        speed: 4.5, dmg: Math.round(this.dmg*0.8), r: 7, color:'#bfe8ff',
        kind: 'ice', life: 2.4, hostile: true, homing: 0.08,
      });
      if(proj && game.projectiles) game.projectiles.push(proj);
      game.spawnParticles(this.x, this.y, '#bfe8ff', 6);
    } else if(pick === 'blizzard'){
      // 24 radial ice projectiles that chill on hit
      const n = 18 + this.phaseIdx*6;
      for(let i=0;i<n;i++){
        const a = (i/n)*Math.PI*2 + Math.random()*0.1;
        game.enemyShootStatus(this.x, this.y, a, Math.round(this.dmg*0.4), 'chill');
      }
      game.cam.shake = 10;
      game.spawnParticles(this.x, this.y, '#ffffff', 32);
      game.toast('BLIZZARD!');
    } else if(pick === 'iceWall'){
      // a row of 5 ice projectiles fired in the player's direction
      const baseA = Math.atan2(player.y-this.y, player.x-this.x);
      for(let i=-2;i<=2;i++){
        const a = baseA + i*0.18;
        game.enemyShootStatus(this.x, this.y, a, Math.round(this.dmg*0.55), 'chill');
      }
      game.cam.shake = 4;
    } else if(pick === 'clones'){
      // spawn 2 frozen decoys that are weak (1 hit) but mimic Glacius look.
      // Clones are stored on game.bossClones and ticked/drawn in the main loop.
      for(let i=0;i<2;i++){
        const ang = (i===0 ? -1 : 1) * 0.6 + Math.atan2(player.y-this.y, player.x-this.x);
        const cx = this.x + Math.cos(ang)*70;
        const cy = this.y + Math.sin(ang)*70;
        const clone = {
          x: cx, y: cy, r: 22, hp: 1, maxHp: 1, dead: false,
          color: '#cfeaff', phaseIdx: this.phaseIdx, isClone: true,
          def: { name: 'Frozen Clone', tint: '#cfeaff' },
          hit(dmg, a, g, knock){ this.hp -= dmg; if(this.hp <= 0) this.dead = true; g.spawnParticles(this.x, this.y, '#bfe8ff', 14); g.sfx('kill'); },
          draw(ctx, cam){
            const sx=this.x-cam.x, sy=this.y-cam.y;
            ctx.save(); ctx.globalAlpha=0.7;
            ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(sx, sy, this.r, 0, 7); ctx.fill();
            ctx.fillStyle = '#7fc8e8';
            ctx.beginPath(); ctx.arc(sx, sy, this.r*0.7, 0, 7); ctx.fill();
            // icy eyes
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx-5, sy-2, 3, 3);
            ctx.fillRect(sx+2, sy-2, 3, 3);
            ctx.restore();
          }
        };
        if(game._bossClones) game._bossClones.push(clone);
        else { game._bossClones = [clone]; }
      }
      game.toast('Frozen clones appear!');
    } else if(pick === 'fireball' || pick === 'lavaPool' || pick === 'nova'){
      // delegated to game if it has magma boss helpers
      if(game._magmaAttack) game._magmaAttack(this, pick, player);
    }
    this.state='idle'; this.atkTimer=this.phase.interval;
  }

  /**
   * Per-axis solid-wall-aware movement. Each axis is resolved independently
   * so the boss slides along walls instead of sticking on corners.
   * @param {number} dx - x delta in px
   * @param {number} dy - y delta in px
   * @param {{isSolid:(x:number,y:number)=>boolean}} world
   * @returns {void}
   */
  _move(dx,dy,world){
    if(!world.isSolid(this.x+dx+Math.sign(dx)*this.r, this.y)) this.x+=dx;
    if(!world.isSolid(this.x, this.y+dy+Math.sign(dy)*this.r)) this.y+=dy;
  }

  /**
   * Apply damage from a hit. Adds scaled knockback, flashes the sprite, and
   * routes to {@link kill} when HP hits zero. No-op during intro grace.
   * @param {number} dmg - raw damage amount
   * @param {number} angle - hit angle in radians (knockback direction)
   * @param {any} game
   * @param {number} [knock=4] - knockback magnitude scalar
   * @returns {void}
   */
  hit(dmg, angle, game, knock=4){
    if(this.dead || this.intro>0) return;
    this.hp -= dmg; this.hitFlash = 0.12;
    this.knockback.x += Math.cos(angle)*knock*0.25;
    this.knockback.y += Math.sin(angle)*knock*0.25;
    game.floater('-'+dmg, this.x, this.y - this.r - 4, '#fff');
    if(this.hp <= 0) this.kill(game);
  }
  /**
   * Apply a slow/freeze to the boss. Bosses are partially resistant: the
   * effective frozen timer is half the source duration.
   * @param {number} t - freeze duration in seconds (halved on apply)
   * @returns {void}
   */
  freeze(t){ this.frozen = Math.max(this.frozen, t*0.5); }
  /**
   * Mark the boss dead and notify the Game. Hands the boss instance to
   * `game.onBossDefeated` so quest / drop / SFX systems can react.
   * @param {any} game
   * @returns {void}
   */
  kill(game){ this.dead = true; game.onBossDefeated(this); }

  /**
   * Render the boss to the canvas. Two visual paths: Glacius gets the
   * layered ice-ring + crown + breath-mist treatment, everyone else gets
   * the generic boss-ball with eyes and spikes. Always overlays the
   * telegraph strobe and charge ring on top of the body.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number,y:number}} cam
   * @returns {void}
   */
  draw(ctx, cam){
    const sx=this.x-cam.x, sy=this.y-cam.y, bob=Math.sin(this.bob)*3;
    if(this.intro>0){ ctx.globalAlpha=0.5+0.5*Math.sin(performance.now()/100);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx,sy,this.r+10,0,7); ctx.fill(); ctx.globalAlpha=1; }
    let c = this.hitFlash>0 ? '#fff' : (this.frozen>0 ? '#9fd8ff' : this.phase.tint);
    if(this.state==='telegraph'){ c = Math.floor(performance.now()/80)%2 ? '#ff4040' : this.phase.tint; }
    // Glacius gets a fancier ice-crown shape; everyone else stays a simple boss ball
    if(this.id === 'glacius'){
      // layered ice ring
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(sx, sy+bob, this.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#7fc8e8';
      ctx.beginPath(); ctx.arc(sx, sy+bob, this.r*0.78, 0, 7); ctx.fill();
      ctx.fillStyle = '#e0f4ff';
      ctx.beginPath(); ctx.arc(sx, sy+bob, this.r*0.55, 0, 7); ctx.fill();
      // ice crown spikes
      ctx.fillStyle = '#ffffff';
      for(let i=-3;i<=3;i++){
        const a = -Math.PI/2 + i * 0.32;
        const x = sx + Math.cos(a) * (this.r + 6);
        const y = sy - this.r - 6 + Math.sin(a) * (this.r + 6);
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y - 8); ctx.lineTo(x + 3, y - 8);
        ctx.closePath(); ctx.fill();
      }
      // frozen eyes
      ctx.fillStyle = '#bfe8ff';
      ctx.fillRect(sx-9, sy-7+bob, 6, 6);
      ctx.fillRect(sx+3, sy-7+bob, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx-7, sy-5+bob, 2, 2);
      ctx.fillRect(sx+5, sy-5+bob, 2, 2);
      // breath mist
      if(Math.floor(performance.now()/100) % 2 === 0){
        ctx.fillStyle = 'rgba(220,240,255,0.3)';
        ctx.beginPath(); ctx.arc(sx, sy+this.r-2+bob, this.r*0.4, 0, 7); ctx.fill();
      }
    } else {
      ctx.fillStyle=c;
      ctx.beginPath(); ctx.arc(sx, sy+bob, this.r, 0, 7); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.arc(sx, sy+bob, this.r*0.7, 0, 7); ctx.fill();
      ctx.fillStyle='#ff2a2a';
      ctx.fillRect(sx-8, sy-5+bob, 5, 5); ctx.fillRect(sx+3, sy-5+bob, 5, 5);
      ctx.fillStyle='#ffcf4d';
      for(let i=-2;i<=2;i++) ctx.fillRect(sx+i*7-1, sy-this.r-4+bob, 3, 7);
    }
    if(this.state==='charge'){ ctx.strokeStyle='rgba(255,80,80,.6)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(sx,sy+bob,this.r+5,0,7); ctx.stroke(); }
  }
}


