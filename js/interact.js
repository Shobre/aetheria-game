// Interact system — extracted from Game to reduce complexity
import { QUESTS } from './data/quests.js';
import { CATALOG, makeItem } from './data/gear.js';

/**
 * Find the closest portal to the player. If a portal is within the auto-enter
 * threshold (26px) it short-circuits with {autoEnter} so the caller can
 * immediately teleport instead of showing a prompt.
 * @private
 * @param {{x:number, y:number}} player - player world position
 * @param {{portals: Array<{wx:number, wy:number, label:string}>}} world
 * @returns {{type:'portal', ref:object, label:string}|{autoEnter:object}|null}
 */
function _closestPortal(player, world){
  let near=null, nd=52;
  for(const p of world.portals){
    const d=Math.hypot(p.wx-player.x,p.wy-player.y);
    if(d<26){ return {autoEnter:p}; }
    if(d<nd){ near={type:'portal',ref:p,label:'Go to '+p.label}; nd=d; }
  }
  return near;
}

/**
 * Compose a label for an NPC based on its role (shop / bank / craft /
 * companion / quest). Returns a Talk fallback if nothing else applies.
 * @private
 * @param {{name:string, shop?:boolean, bank?:boolean, craft?:boolean, companion?:any}} n
 * @param {{giverState:(name:string)=>{turnIn:string[], available:string[], inProgress:string[]}}|null} [quests]
 * @returns {string}
 */
function _npcLabel(n, quests){
  if(n.shop) return 'Shop ('+n.name+')';
  if(n.bank) return 'Open Stash';
  if(n.craft) return 'Use Forge';
  if(quests){
    const gs=quests.giverState(n.name);
    if(gs.turnIn.length) return 'Turn in quest ('+n.name+')';
    if(gs.available.length) return 'Accept quest ('+n.name+')';
  }
  return 'Talk to '+n.name;
}

/**
 * Find the closest NPC within the standard 52px interaction radius.
 * @private
 * @param {{x:number, y:number}} player
 * @param {{npcs: Array<{wx:number, wy:number, name:string, shop?:boolean, bank?:boolean, craft?:boolean, companion?:any, lines:string[]}>}} world
 * @param {any} [quests]
 * @returns {{type:'npc', ref:object, label:string}|null}
 */
function _closestNpc(player, world, quests){
  let near=null, nd=52;
  for(const n of world.npcs){
    const d=Math.hypot(n.wx+16-player.x,n.wy+16-player.y);
    if(d<nd){ near={type:'npc',ref:n,label:_npcLabel(n,quests)}; nd=d; }
  }
  return near;
}

/**
 * Find the closest unopened chest within the standard 52px radius.
 * @private
 * @param {{x:number, y:number}} player
 * @param {{chests: Array<{wx:number, wy:number, opened:boolean}>}} world
 * @returns {{type:'chest', ref:object, label:string}|null}
 */
function _closestChest(player, world){
  let near=null, nd=52;
  for(const c of world.chests){
    if(c.opened) continue;
    const d=Math.hypot(c.wx+16-player.x,c.wy+16-player.y);
    if(d<nd){ near={type:'chest',ref:c,label:'Open Chest'}; nd=d; }
  }
  return near;
}

/**
 * Stub kept for the original priority-order comment. Not used by the public
 * findNearestInteractable path (which does its own distance comparison).
 * @private
 * @param {any} a
 * @param {any} b
 * @param {any} c
 * @returns {any}
 */
function _pickNearest(a, b, c){
  let best=a, nd=a?52:Infinity;
  if(b && (!best || Math.hypot(b.ref.wx+16-best.ref.wx+16, b.ref.wy+16-best.ref.wy+16) < nd)) { nd=Math.hypot(b.ref.wx+16, b.ref.wy+16); best=b; }
  // Simpler: just return whichever is non-null, priority portal > npc > chest
  return a || b || c;
}

/**
 * Resolve the nearest interactable (portal / npc / chest) for the player.
 * Portals within auto-enter range trigger an immediate teleport via
 * game._usePortal. Among nearby targets the closest wins.
 * @param {import('./systems/game.js').Game} game
 * @returns {{type:string, ref:object, label:string}|null}
 */
export function findNearestInteractable(game){
  const player=game.player, world=game.world, quests=game.quests;
  const portalResult=_closestPortal(player, world);
  if(portalResult && portalResult.autoEnter){ game._usePortal(portalResult.autoEnter); return null; }
  const npcNear=_closestNpc(player, world, quests);
  const chestNear=_closestChest(player, world);
  // Portal has priority, then npc, then chest — compare by distance
  let best=portalResult, bestDist=portalResult?Math.hypot(portalResult.ref.wx-player.x,portalResult.ref.wy-player.y):Infinity;
  if(npcNear){ const d=Math.hypot(npcNear.ref.wx+16-player.x,npcNear.ref.wy+16-player.y); if(d<bestDist){ best=npcNear; bestDist=d; } }
  if(chestNear){ const d=Math.hypot(chestNear.ref.wx+16-player.x,chestNear.ref.wy+16-player.y); if(d<bestDist){ best=chestNear; } }
  return best;
}

/**
 * Tick the timed-clear objective for a single quest step. When the map is
 * emptied the quest is marked complete and the timer is cleared. Failure
 * to clear within the deadline also clears the timer (objective will retry
 * on next encounter).
 * @private
 * @param {Object} q - quest definition
 * @param {Object} st - active quest state
 * @param {Object} o - objective definition
 * @param {number} i - objective index
 * @param {any} quests
 * @param {string} map - current map id
 * @param {Array} enemies - live enemy list
 * @param {object|null} boss - active boss, if any
 * @param {Record<string, {kind:string, deadline:number}>} _questTimers
 * @returns {void}
 */
function _tickTimedClear(q, st, o, i, quests, map, enemies, boss, _questTimers){
  if(st.prog[i]>=1) return;
  if(o.kind!=='timed_clear' || o.map!==map) return;
  if(!_questTimers[map]) _questTimers[map]={kind:'timed_clear',deadline:performance.now()+o.seconds*1000};
  if(enemies.length===0 && !boss){ quests.onTimedClear(map); _questTimers[map]=null; }
  else if(_questTimers[map] && performance.now()>_questTimers[map].deadline){ _questTimers[map]=null; }
}

/**
 * Tick the survive objective for a single quest step. Marks the quest
 * complete and clears the timer once the deadline elapses.
 * @private
 * @param {Object} q
 * @param {Object} st
 * @param {Object} o
 * @param {number} i
 * @param {any} quests
 * @param {string} map
 * @param {Record<string, {kind:string, deadline:number}>} _questTimers
 * @returns {void}
 */
function _tickSurvive(q, st, o, i, quests, map, _questTimers){
  if(st.prog[i]>=1) return;
  if(o.kind!=='survive' || o.map!==map) return;
  if(!_questTimers[map]) _questTimers[map]={kind:'survive',deadline:performance.now()+o.seconds*1000};
  if(_questTimers[map] && performance.now()>=_questTimers[map].deadline){ quests.onSurvive(map); _questTimers[map]=null; }
}

/**
 * Advance every active quest's timed objectives (timed_clear + survive).
 * Called once per game tick from Game.update.
 * @param {import('./systems/game.js').Game} game
 * @returns {void}
 */
export function updateQuestTimers(game){
  const quests=game.quests, map=game.currentMap, enemies=game.enemies, boss=game.boss, _questTimers=game._questTimers;
  if(!quests) return;
  for(const id in quests.active){
    const q=QUESTS[id]; const st=quests.active[id];
    for(let i=0;i<q.objectives.length;i++){
      const o=q.objectives[i];
      _tickTimedClear(q,st,o,i,quests,map,enemies,boss,_questTimers);
      _tickSurvive(q,st,o,i,quests,map,_questTimers);
    }
  }
}

/**
 * Advance every active quest's escort objective. When the escort NPC
 * reaches its destination map and is still alive, the objective completes
 * and the NPC reference is cleared.
 * @param {import('./systems/game.js').Game} game
 * @returns {void}
 */
export function updateEscort(game){
  const quests=game.quests, map=game.currentMap, _escortNpc=game._escortNpc;
  if(!quests || !_escortNpc) return;
  for(const id in quests.active){
    const q=QUESTS[id]; const st=quests.active[id];
    for(let i=0;i<q.objectives.length;i++){
      const o=q.objectives[i];
      if(o.kind==='escort' && o.to===map && st.prog[i]<1 && _escortNpc && _escortNpc.alive){
        quests.onEscort(map);
        game._escortNpc=null;
      }
    }
  }
}

/**
 * Handle NPC interaction dispatch: bank / forge / shop / enchant /
 * companion recruit / quest turn-in / quest accept / fallback dialogue.
 * @private
 * @param {import('./systems/game.js').Game} game
 * @param {{name:string, bank?:boolean, craft?:boolean, shop?:any, enchant?:boolean, companion?:any, lines:string[]}} n
 * @returns {void}
 */
function _interactNpc(game, n){
  const quests=game.quests;
  if(n.bank){ game.openStash(n.name); return; }
  if(n.craft){ game.openCraft(n.name); return; }
  if(n.shop){ game.openShop(n.stock, n.name); return; }
  if(n.enchant){ game.openEnchant(n.name); return; }
  if(n.companion){
    if(game._companions.length>=1){ game.toast('Your party is full. Dismiss your current companion first.'); return; }
    game.recruitCompanion(n.companion); return;
  }
  if(game._companions.length>0 && game.input.isDown('dismiss_companion')){ game.dismissCompanion(); return; }
  if(quests){
    const gs=quests.giverState(n.name);
    if(gs.turnIn.length){ quests.turnIn(gs.turnIn[0]); return; }
    if(gs.available.length){ quests.accept(gs.available[0]); return; }
    if(gs.inProgress.length){ game.toast(n.name+': Come back when the task is done.'); return; }
  }
  n._line=(n._line||0); game.toast(n.name+': '+n.lines[n._line%n.lines.length]); n._line++;
}

/**
 * Open a chest, mark it opened in the per-save openedChests map, play sfx,
 * and grant the loot (gold stack or item) to the player.
 * @private
 * @param {import('./systems/game.js').Game} game
 * @param {{opened:boolean, loot:any, idx:number}} c
 * @param {Record<string, any>} CATALOG - gear catalog (passed through to avoid circular import)
 * @param {(id:string, qty?:number) => any} makeItem - gear factory
 * @returns {void}
 */
function _interactChest(game, c, CATALOG, makeItem){
  if(c.opened) return;
  c.opened=true; game.openedChests[game.currentMap+':'+c.idx]=true; game.sfx('open');
  const loot=c.loot;
  if(loot.type==='gold'){ const amt=game.player.gainGold(loot.amount,game); game.toast('Found '+amt+' gold!'); }
  else { game.addItem(makeItem(loot.id,loot.qty||1)); game.toast('Found '+CATALOG[loot.id].name+'!'); }
}

/**
 * Apply the player's chosen interactable. Dispatches to the NPC/portal/
 * chest handler based on the descriptor type.
 * @param {import('./systems/game.js').Game} game
 * @param {{type:'npc'|'portal'|'chest', ref:object}} near
 * @returns {void}
 */
export function doInteract(game, near){
  if(near.type==='npc'){ _interactNpc(game, near.ref); }
  else if(near.type==='chest'){ _interactChest(game, near.ref, CATALOG, makeItem); }
  else if(near.type==='portal'){ game._usePortal(near.ref); }
}
