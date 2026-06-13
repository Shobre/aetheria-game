// Interact system — extracted from Game to reduce complexity
import { QUESTS } from './data/quests.js';
import { CATALOG, makeItem } from './data/gear.js';

function _closestPortal(player, world){
  let near=null, nd=52;
  for(const p of world.portals){
    const d=Math.hypot(p.wx-player.x,p.wy-player.y);
    if(d<26){ return {autoEnter:p}; }
    if(d<nd){ near={type:'portal',ref:p,label:'Go to '+p.label}; nd=d; }
  }
  return near;
}

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

function _closestNpc(player, world, quests){
  let near=null, nd=52;
  for(const n of world.npcs){
    const d=Math.hypot(n.wx+16-player.x,n.wy+16-player.y);
    if(d<nd){ near={type:'npc',ref:n,label:_npcLabel(n,quests)}; nd=d; }
  }
  return near;
}

function _closestChest(player, world){
  let near=null, nd=52;
  for(const c of world.chests){
    if(c.opened) continue;
    const d=Math.hypot(c.wx+16-player.x,c.wy+16-player.y);
    if(d<nd){ near={type:'chest',ref:c,label:'Open Chest'}; nd=d; }
  }
  return near;
}

function _pickNearest(a, b, c){
  let best=a, nd=a?52:Infinity;
  if(b && (!best || Math.hypot(b.ref.wx+16-best.ref.wx+16, b.ref.wy+16-best.ref.wy+16) < nd)) { nd=Math.hypot(b.ref.wx+16, b.ref.wy+16); best=b; }
  // Simpler: just return whichever is non-null, priority portal > npc > chest
  return a || b || c;
}

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

function _tickTimedClear(q, st, o, i, quests, map, enemies, boss, _questTimers){
  if(st.prog[i]>=1) return;
  if(o.kind!=='timed_clear' || o.map!==map) return;
  if(!_questTimers[map]) _questTimers[map]={kind:'timed_clear',deadline:performance.now()+o.seconds*1000};
  if(enemies.length===0 && !boss){ quests.onTimedClear(map); _questTimers[map]=null; }
  else if(_questTimers[map] && performance.now()>_questTimers[map].deadline){ _questTimers[map]=null; }
}

function _tickSurvive(q, st, o, i, quests, map, _questTimers){
  if(st.prog[i]>=1) return;
  if(o.kind!=='survive' || o.map!==map) return;
  if(!_questTimers[map]) _questTimers[map]={kind:'survive',deadline:performance.now()+o.seconds*1000};
  if(_questTimers[map] && performance.now()>=_questTimers[map].deadline){ quests.onSurvive(map); _questTimers[map]=null; }
}

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

function _interactNpc(game, n){
  const quests=game.quests;
  if(n.bank){ game.openStash(n.name); return; }
  if(n.craft){ game.openCraft(n.name); return; }
  if(n.shop){ game.openShop(n.stock, n.name); return; }
  if(n.companion){
    if(game._companions.length>=1){ game.toast('Your party is full. Dismiss your current companion first.'); return; }
    game.recruitCompanion(n.companion); return;
  }
  if(game._companions.length>0 && game.input.shift){ game.dismissCompanion(); return; }
  if(quests){
    const gs=quests.giverState(n.name);
    if(gs.turnIn.length){ quests.turnIn(gs.turnIn[0]); return; }
    if(gs.available.length){ quests.accept(gs.available[0]); return; }
    if(gs.inProgress.length){ game.toast(n.name+': Come back when the task is done.'); return; }
  }
  n._line=(n._line||0); game.toast(n.name+': '+n.lines[n._line%n.lines.length]); n._line++;
}

function _interactChest(game, c, CATALOG, makeItem){
  if(c.opened) return;
  c.opened=true; game.openedChests[game.currentMap+':'+c.idx]=true; game.sfx('open');
  const loot=c.loot;
  if(loot.type==='gold'){ const amt=game.player.gainGold(loot.amount,game); game.toast('Found '+amt+' gold!'); }
  else { game.addItem(makeItem(loot.id,loot.qty||1)); game.toast('Found '+CATALOG[loot.id].name+'!'); }
}

export function doInteract(game, near){
  if(near.type==='npc'){ _interactNpc(game, near.ref); }
  else if(near.type==='chest'){ _interactChest(game, near.ref, CATALOG, makeItem); }
  else if(near.type==='portal'){ game._usePortal(near.ref); }
}
