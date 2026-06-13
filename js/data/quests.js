// Quest registry. Each quest has a giver NPC (by name), objectives, and rewards.
// Objective kinds:
//   kill         {enemy:<type|'any'>, count:N}     - tracked on enemy death
//   reach        {map:<mapId>}                     - tracked on map load
//   boss         {boss:<bossId>}                   - tracked on boss defeat
//   collect      {item:<id>, count:N}              - tracked on pickup/own
//   escort       {npc:<name>, from:<map>, to:<map>}- NPC follows player to destination
//   timed_clear  {map:<mapId>, seconds:N}          - clear all enemies in map within time
//   survive      {map:<mapId>, seconds:N}          - survive waves for N seconds
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

  // ---- Aldermere City quest-givers ----
  q_captain1: {
    name:'City Watch', giver:'Captain',
    desc:'Bats infest the outskirts. Cull a swarm to prove your worth.',
    objectives:[{ kind:'kill', enemy:'bat', count:6, text:'Slay bats' }],
    reward:{ xp:90, gold:70, items:[{id:'potion',qty:3}] },
    next:'q_captain2',
  },
  q_captain2: {
    name:'Crypt Cleansing', giver:'Captain',
    desc:'Skeletons rise in the catacombs. Put them to rest.',
    objectives:[{ kind:'kill', enemy:'skeleton', count:6, text:'Destroy skeletons' }],
    reward:{ xp:220, gold:160, items:[{id:'helm_iron',qty:1}] },
  },
  q_scholar: {
    name:'Field Research', giver:'Scholar',
    desc:'The Scholar needs golem cores. Smash some golems.',
    objectives:[{ kind:'kill', enemy:'golem', count:4, text:'Shatter golems' }],
    reward:{ xp:260, gold:140, items:[{id:'staff_arcane',qty:1}] },
  },
  q_bard1: {
    name:'A Witch\'s Tale', giver:'Bard',
    desc:'The Bard swears a witch lurks in the Bog Depths. Investigate.',
    objectives:[{ kind:'reach', map:'swamp_depths', text:'Reach the Bog Depths' }],
    reward:{ xp:150, gold:100, items:[{id:'ether',qty:3}] },
    next:'q_bard2',
  },
  q_bard2: {
    name:'Silence the Witch', giver:'Bard',
    desc:'Slay the Bog Witch lurking in the Sunken Catacomb.',
    objectives:[{ kind:'boss', boss:'bog_witch', text:'Defeat the Bog Witch' }],
    reward:{ xp:600, gold:450, items:[{id:'dagger_venom',qty:1}] },
  },
  q_mayor: {
    name:'Boar Trouble', giver:'Mayor',
    desc:'Wild boars trample the glade. Thin the herd.',
    objectives:[{ kind:'kill', enemy:'boar', count:5, text:'Hunt boars' }],
    reward:{ xp:140, gold:110, items:[{id:'bow_short',qty:1}] },
  },

  // ---- New quest types ----
  q_escort: {
    name:'Escort the Merchant', giver:'Captain',
    desc:'A merchant needs safe passage to the Whispering Forest. Get them there alive.',
    objectives:[{ kind:'escort', npc:'Merchant', from:'meadow', to:'forest', text:'Escort Merchant to forest' }],
    reward:{ xp:300, gold:200, items:[{id:'armor_chain',qty:1}] },
  },
  q_timed: {
    name:'Speed Clear', giver:'Captain',
    desc:'Clear the Forgotten Crypt of all enemies — fast. You have 60 seconds.',
    objectives:[{ kind:'timed_clear', map:'dungeon1', seconds:60, text:'Clear the crypt in 60s' }],
    reward:{ xp:350, gold:250, items:[{id:'ring_haste',qty:1}] },
  },
  q_survive: {
    name:'Survival Trial', giver:'Elder',
    desc:'Survive the swamp for 45 seconds. Enemies will keep coming.',
    objectives:[{ kind:'survive', map:'swamp', seconds:45, text:'Survive for 45 seconds' }],
    reward:{ xp:280, gold:180, items:[{id:'potion_l',qty:3}] },
  },
};

// Quests a given NPC can offer, in order.
export function questsForGiver(name){
  return Object.keys(QUESTS).filter(id => QUESTS[id].giver === name);
}
