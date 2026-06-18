// Companion system: recruitable NPCs that follow the player and fight enemies.
// Companions have a simple AI: follow player, attack nearby enemies, use abilities.
//
// Each companion has a unique active ability (cooldown-based) that the player
// can trigger with the G key. Abilities are dispatched by the companion's
// `kind` field (kira / thorin / luna) and defined in the COMPANION_ABILITIES
// table below.
import { TILE } from '../systems/world.js';
import { rollRarity, applyRarity } from '../data/affixes.js';
import { makeItem } from '../data/gear.js';
import { applyStatus } from '../systems/status.js';
import { Projectile } from './enemy.js';

/**
 * @typedef {'kira'|'thorin'|'luna'} CompanionKind
 *
 * @typedef {Object} CompanionCatalogEntry
 * @property {string} name
 * @property {string} icon    - single Unicode char drawn for the body
 * @property {string} desc
 * @property {string} color
 *
 * @typedef {Object} CompanionAbilityDef
 * @property {string} name
 * @property {string} label   - floater text
 * @property {string} color
 * @property {number} cd      - cooldown in seconds
 * @property {(game: any, player: any, comp: Companion) => void} fn
 *
 * @typedef {Object} CompanionSerialized
 * @property {string} name
 * @property {string} icon
 * @property {number} x
 * @property {number} y
 * @property {boolean} alive
 * @property {number} level
 * @property {number} xp
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} atk
 * @property {number} def
 * @property {CompanionKind|null} kind
 *
 * @typedef {Object} CompanionState
 * Companion instance state. Fields assigned in the constructor or mutated at runtime.
 * @property {string} name
 * @property {string} icon
 * @property {number} x
 * @property {number} y
 * @property {boolean} alive
 * @property {number} level
 * @property {number} xp
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} atk
 * @property {number} def
 * @property {number} spd
 * @property {number} r
 * @property {string} color
 * @property {number} _atkCd
 * @property {number} _followDist
 * @property {number} _aggroRange
 * @property {{x:number,y:number}|null} _target
 * @property {number} _deathTime
 * @property {number} _abilityCd
 * @property {number} _abilityMaxCd
 * @property {CompanionKind|null} kind
 */

export class Companion {
  /**
   * @param {string} name
   * @param {string} icon
   * @param {number} x  - world x (px)
   * @param {number} y  - world y (px)
   */
  constructor(name, icon, x, y){
    this.name=name; this.icon=icon; this.x=x; this.y=y;
    this.alive=true; this.level=1; this.xp=0;
    this.hp=80; this.maxHp=80; this.atk=8; this.def=2; this.spd=1.6;
    this.r=10; this.color='#88ddff';
    this._atkCd=0; this._followDist=40; this._aggroRange=120;
    this._target=null; this._deathTime=0;
    // ability: each companion has a unique ability (cooldown in seconds).
    // _abilityCd is the active timer; 0 means ready. _abilityMaxCd is the reset.
    this._abilityCd=0; this._abilityMaxCd=8;
    this.kind=null; // 'kira' | 'thorin' | 'luna' set by game.recruitCompanion
  }
  /** @returns {number} */
  get xpToNext(){ return this.level*50; }
  /**
   * @param {number} amt
   * @returns {void}
   */
  gainXp(amt){
    this.xp+=amt;
    while(this.xp>=this.xpToNext){ this.xp-=this.xpToNext; this.levelUp(); }
  }
  /** @returns {void} */
  levelUp(){
    this.level++; this.maxHp+=15; this.hp=this.maxHp; this.atk+=2; this.def+=1;
  }
  /**
   * @param {number} dt   - seconds since last frame
   * @param {any}    game  - Game instance (enemies, boss, world, sfx, projectiles, spawnParticles, cam, floater)
   * @param {any}    player - Player instance
   * @returns {void}
   */
  update(dt, game, player){
    if(!this.alive) return;
    // decay cooldowns
    if(this._atkCd>0) this._atkCd-=dt;
    if(this._abilityCd>0) this._abilityCd-=dt;
    // find nearest enemy
    let nearest=null, nd=this._aggroRange;
    for(const e of game.enemies){
      if(e.dead) continue;
      const d=Math.hypot(e.x-this.x, e.y-this.y);
      if(d<nd){ nd=d; nearest=e; }
    }
    // also check boss
    if(game.boss && !game.boss.dead){
      const d=Math.hypot(game.boss.x-this.x, game.boss.y-this.y);
      if(d<nd){ nd=d; nearest=game.boss; }
    }
    this._target=nearest;
    if(this._target){
      const d=Math.hypot(this._target.x-this.x, this._target.y-this.y);
      if(d<30 && this._atkCd<=0){
        let dmg=Math.round(this.atk*(0.9+Math.random()*0.2));
        const ang=Math.atan2(this._target.y-this.y, this._target.x-this.x);
        this._target.hit(dmg, ang, game, 3);
        this._atkCd=1.0;
        if(this._target.dead) this.gainXp(20);
      }
      if(d>24){ const ang=Math.atan2(this._target.y-this.y, this._target.x-this.x);
        this.x+=Math.cos(ang)*this.spd*60*dt; this.y+=Math.sin(ang)*this.spd*60*dt; }
      // auto-use ability when in combat and off cooldown
      if(this._abilityCd<=0 && d<80) this._useAbility(game, player);
    } else {
      // follow player
      const d=Math.hypot(player.x-this.x, player.y-this.y);
      if(d>this._followDist){
        const ang=Math.atan2(player.y-this.y, player.x-this.x);
        this.x+=Math.cos(ang)*this.spd*60*dt; this.y+=Math.sin(ang)*this.spd*60*dt;
      }
    }
    // clamp to world
    this.x=Math.max(20,Math.min(game.world.w-20,this.x));
    this.y=Math.max(20,Math.min(game.world.h-20,this.y));
  }
  // Trigger the companion's unique ability. Returns true if fired.
  /**
   * @param {any} game
   * @param {any} player
   * @returns {boolean} true if the ability fired (was off cooldown); false if on cooldown
   */
  triggerAbility(game, player){
    if(this._abilityCd>0) return false;
    this._useAbility(game, player);
    return true;
  }
  /** @returns {void} */
  _useAbility(game, player){
    const def = COMPANION_ABILITIES[this.kind];
    if(!def){ return; }
    def.fn(game, player, this);
    this._abilityCd = def.cd;
    game.sfx('levelup');
    game.floater(def.label, this.x, this.y - 22, def.color);
  }
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number,y:number}} cam
   * @returns {void}
   */
  draw(ctx, cam){
    if(!this.alive) return;
    const sx=this.x-cam.x, sy=this.y-cam.y;
    // body
    ctx.font='22px serif'; ctx.textAlign='center';
    ctx.fillText(this.icon, sx, sy+18);
    // name
    ctx.font='8px monospace'; ctx.fillStyle=this.color;
    ctx.fillText(this.name, sx, sy-8);
    // hp bar
    if(this.hp<this.maxHp){
      const pct=this.hp/this.maxHp;
      ctx.fillStyle='#333'; ctx.fillRect(sx-14,sy-4,28,4);
      ctx.fillStyle=pct>0.5?'#44ff88':pct>0.25?'#ffcf4d':'#e8413c';
      ctx.fillRect(sx-14,sy-4,28*pct,4);
    }
    // level badge
    ctx.font='7px monospace'; ctx.fillStyle='#ffe6a0';
    ctx.fillText('Lv'+this.level, sx+16, sy+4);
  }
  /**
   * @param {number} dmg
   * @returns {void}
   */
  hit(dmg){
    this.hp-=dmg;
    if(this.hp<=0){ this.hp=0; this.alive=false; this._deathTime=performance.now(); }
  }
  /** @returns {CompanionSerialized} */
  serialize(){
    return { name:this.name, icon:this.icon, x:this.x, y:this.y, alive:this.alive,
      level:this.level, xp:this.xp, hp:this.hp, maxHp:this.maxHp, atk:this.atk, def:this.def,
      kind:this.kind };
  }
  /**
   * @param {CompanionSerialized} data
   * @returns {Companion}
   */
  static deserialize(data){
    const c=new Companion(data.name, data.icon, data.x, data.y);
    c.level=data.level||1; c.xp=data.xp||0; c.hp=data.hp||80; c.maxHp=data.maxHp||80;
    c.atk=data.atk||8; c.def=data.def||2; c.alive=data.alive!==false;
    c.kind=data.kind||null;
    return c;
  }
}

// Companion registry — recruitable companions
/** @type {Record<CompanionKind, CompanionCatalogEntry>} */
export const COMPANIONS = {
  kira:   { name:'Kira',   icon:'∧', desc:'A skilled ranger. G: Arrow Volley.', color:'#88ffaa' },
  thorin: { name:'Thorin', icon:'■', desc:'A sturdy dwarf warrior. G: Shield Bash.', color:'#ffaa44' },
  luna:   { name:'Luna',   icon:'★', desc:'A mage who blasts enemies. G: Arcane Blast.', color:'#bb88ff' },
};

// ===== ABILITY DEFINITIONS =====
// Each ability has a name, label (floater), color, cooldown (seconds), and a
// function(game, player, companion) that performs the effect. The function
// is responsible for spawning particles / floaters / sfx.
/** @type {Record<CompanionKind, CompanionAbilityDef>} */
export const COMPANION_ABILITIES = {
  kira: {
    name: 'Arrow Volley',
    label: 'ARROW VOLLEY!',
    color: '#a3d977',
    cd: 6,
    fn: (game, player, comp)=>{
      // Fire 3 arrows at the nearest enemies in a 120° cone facing the player
      const targets = [];
      for(const e of game.enemies){
        if(e.dead) continue;
        if(Math.hypot(e.x-comp.x, e.y-comp.y) > 200) continue;
        targets.push(e);
      }
      if(game.boss && !game.boss.dead) targets.push(game.boss);
      targets.sort((a,b)=>Math.hypot(a.x-comp.x,a.y-comp.y) - Math.hypot(b.x-comp.x,b.y-comp.y));
      const aim = game.player._aim || 0;
      for(let i=0;i<3 && i<targets.length;i++){
        const e = targets[i];
        // spread the 3 shots a bit
        const spread = (i-1) * 0.18;
        const a = Math.atan2(e.y-comp.y, e.x-comp.x) + spread;
        const proj = new Projectile(comp.x, comp.y, a, {
          speed: 7, dmg: 8 + comp.level*2, r: 4,
          color: '#a3d977', kind: 'arrow', life: 1.0, hostile: false,
        });
        if(game.projectiles) game.projectiles.push(proj);
        game.spawnParticles(comp.x, comp.y, '#a3d977', 4);
      }
    },
  },
  thorin: {
    name: 'Shield Bash',
    label: 'SHIELD BASH!',
    color: '#ffd86a',
    cd: 8,
    fn: (game, player, comp)=>{
      // Find nearest enemy and stun it for 1.2s with heavy damage
      let nearest=null, nd=160;
      for(const e of game.enemies){
        if(e.dead) continue;
        const d=Math.hypot(e.x-comp.x, e.y-comp.y);
        if(d<nd){ nd=d; nearest=e; }
      }
      if(game.boss && !game.boss.dead){
        const d=Math.hypot(game.boss.x-comp.x, game.boss.y-comp.y);
        if(d<nd){ nd=d; nearest=game.boss; }
      }
      if(!nearest) return;
      const ang = Math.atan2(nearest.y-comp.y, nearest.x-comp.x);
      nearest.hit(15 + comp.level*3, ang, game, 12);
      // apply stun status (1.2s)
      try { applyStatus(nearest, 'stun', 1.2); } catch(_){}
      // also: knockback big
      nearest.knockback.x = Math.cos(ang) * 10;
      nearest.knockback.y = Math.sin(ang) * 10;
      game.spawnParticles(nearest.x, nearest.y, '#ffd86a', 16);
      game.cam.shake = 6;
    },
  },
  luna: {
    name: 'Arcane Blast',
    label: 'ARCANE BLAST!',
    color: '#a45cff',
    cd: 10,
    fn: (game, player, comp)=>{
      // AoE damage + slow in 80px radius centered on the companion
      const R = 80;
      const dmg = 12 + comp.level*3;
      let hits = 0;
      for(const e of game.enemies){
        if(e.dead) continue;
        const d = Math.hypot(e.x-comp.x, e.y-comp.y);
        if(d < R){
          e.hit(dmg, Math.random()*7, game, 4);
          try { applyStatus(e, 'chill', 2.5); } catch(_){}
          hits++;
        }
      }
      if(game.boss && !game.boss.dead){
        const d=Math.hypot(game.boss.x-comp.x, game.boss.y-comp.y);
        if(d<R){
          game.boss.hit(dmg, Math.random()*7, game, 4);
          try { applyStatus(game.boss, 'chill', 2.5); } catch(_){}
          hits++;
        }
      }
      game.spawnParticles(comp.x, comp.y, '#a45cff', 24 + hits*4);
      game.cam.shake = 8;
    },
  },
};
