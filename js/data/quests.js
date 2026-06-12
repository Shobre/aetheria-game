// Quest registry. Each quest has a giver NPC (by name), objectives, and rewards.
// Objective kinds:
//   kill   {enemy:<type|'any'>, count:N}     - tracked on enemy death
//   reach  {map:<mapId>}                     - tracked on map load
//   boss   {boss:<bossId>}                   - tracked on boss defeat
//   collect{item:<id>, count:N}              - tracked on pickup/own
// Rewards: { xp, gold, items:[{id,qty}] }
export const QUESTS = {
  q_slimes: {
    name:'Pest Control', giver:'Elder',
    desc:'Slimes are overrunning the meadow. Thin their numbers.',
    objectives:[{ kind:'kill', enemy:'slime', count:4, text:'Slay slimes' }],
    reward:{ xp:60, gold:50, items:[{id:'potion',qty:2}] },
    next:'q_forest',
  },
  q_forest: {
    name:'Into the Woods', giver:'Elder',
    desc:'Scout the Whispering Forest to the east.',
    objectives:[{ kind:'reach', map:'forest', text:'Reach the Whispering Forest' }],
    reward:{ xp:80, gold:40, items:[{id:'ether',qty:2}] },
  },
  q_ranger: {
    name:'Cull the Archers', giver:'Ranger',
    desc:'The forest archers harry travelers. Put them down.',
    objectives:[{ kind:'kill', enemy:'archer', count:3, text:'Defeat archers' }],
    reward:{ xp:120, gold:80, items:[{id:'armor_leather',qty:1}] },
  },
  q_crypt: {
    name:'The Crypt Lord', giver:'Ranger',
    desc:'Descend into the Forgotten Crypt and destroy the Bone Tyrant.',
    objectives:[{ kind:'boss', boss:'bone_tyrant', text:'Defeat the Bone Tyrant' }],
    reward:{ xp:400, gold:300, items:[{id:'sword_frost',qty:1}] },
  },
  q_nomad: {
    name:'Desert Scavenger', giver:'Nomad',
    desc:'Scorpions guard old relics. Clear them out.',
    objectives:[{ kind:'kill', enemy:'scorpion', count:5, text:'Exterminate scorpions' }],
    reward:{ xp:160, gold:120, items:[{id:'ring_vigor',qty:1}] },
  },
};

// Quests a given NPC can offer, in order.
export function questsForGiver(name){
  return Object.keys(QUESTS).filter(id => QUESTS[id].giver === name);
}
