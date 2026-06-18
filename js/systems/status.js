// Status-effect system: burn / poison / chill / stun.
// Works on any entity that has {x,y,r,hp} and (player: die / enemy: kill).
// Enemies keep their own hard `frozen` for ice; this layer adds DoT + slow + stun.

/**
 * @typedef {'burn'|'poison'|'chill'|'stun'} StatusId
 *
 * @typedef {Object} StatusDef
 * @property {string} name
 * @property {string} color
 * @property {number} dot    - damage per tick
 * @property {number} tick   - seconds between ticks
 * @property {number} dur    - default duration
 * @property {number} slow   - 0..1 movement slow factor
 *
 * @typedef {Object} StatusInstance
 * @property {number} time   - remaining duration
 * @property {number} tickT  - next tick timer
 *
 * @typedef {Object} StatusTickResult
 * @property {number}  slow      - 0..1 movement slow factor (max of all active)
 * @property {boolean} stunned
 */

/** @type {Record<StatusId, StatusDef>} */
export const STATUS = {
  burn:   { name:'Burn',   color:'#ff7a2a', dot:7, tick:0.5, dur:3.0, slow:0 },
  poison: { name:'Poison', color:'#74d83f', dot:5, tick:0.6, dur:5.0, slow:0 },
  chill:  { name:'Chill',  color:'#7fd8ff', dot:0, tick:0,   dur:2.5, slow:0.45 },
  stun:   { name:'Stun',   color:'#ffe24d', dot:0, tick:0,   dur:1.0, slow:1 },
};

// Apply (or refresh) a status on an entity. Longer of remaining/new duration.
/**
 * @param {{statuses?: Record<StatusId, StatusInstance>}} ent
 * @param {StatusId} type
 * @param {number} [dur]
 * @returns {void}
 */
export function applyStatus(ent, type, dur){
  const def = STATUS[type]; if(!def) return;
  if(!ent.statuses) ent.statuses = {};
  const d = dur || def.dur;
  const cur = ent.statuses[type];
  if(cur){ cur.time = Math.max(cur.time, d); }
  else   { ent.statuses[type] = { time:d, tickT:def.tick }; }
}

/**
 * @param {{statuses?: Record<StatusId, StatusInstance>}} ent
 * @param {StatusId} type
 * @returns {boolean}
 */
export function hasStatus(ent, type){ return !!(ent.statuses && ent.statuses[type]); }

// Advance all statuses one frame. Returns {slow:0..1, stunned:bool}.
// isPlayer routes lethal DoT through the right death path.
/**
 * @param {{x:number, y:number, r:number, hp:number, statuses?: Record<StatusId, StatusInstance>, die?: (g:any)=>void, kill?: (g:any)=>void}} ent
 * @param {number} dt
 * @param {{floater: (text:string, x:number, y:number, color:string) => void}} game
 * @param {boolean} isPlayer
 * @returns {StatusTickResult}
 */
export function tickStatuses(ent, dt, game, isPlayer){
  if(!ent.statuses) return { slow:0, stunned:false };
  let slow = 0, stunned = false;
  for(const type in ent.statuses){
    const st = ent.statuses[type], def = STATUS[type];
    st.time -= dt;
    if(st.time <= 0){ delete ent.statuses[type]; continue; }
    if(def.dot > 0){
      st.tickT -= dt;
      if(st.tickT <= 0){
        st.tickT += def.tick;
        const dmg = def.dot;
        ent.hp -= dmg;
        game.floater('-'+dmg, ent.x, ent.y - (isPlayer?16:14), def.color);
        if(ent.hp <= 0){ if(isPlayer) ent.die(game); else ent.kill(game); }
      }
    }
    if(def.slow > slow) slow = def.slow;
    if(type === 'stun') stunned = true;
  }
  return { slow, stunned };
}

// Small colored pips above an entity to show active statuses.
/**
 * @param {{statuses?: Record<StatusId, StatusInstance>, r:number}} ent
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx
 * @param {number} sy
 * @returns {void}
 */
export function drawStatusPips(ent, ctx, sx, sy){
  if(!ent.statuses) return;
  const types = Object.keys(ent.statuses);
  if(!types.length) return;
  const top = sy - ent.r - 12;
  const startX = sx - (types.length - 1) * 4;
  types.forEach((t, i) => {
    ctx.fillStyle = '#000'; ctx.fillRect(startX + i*8 - 3, top - 3, 6, 6);
    ctx.fillStyle = STATUS[t].color; ctx.fillRect(startX + i*8 - 2, top - 2, 4, 4);
  });
}
