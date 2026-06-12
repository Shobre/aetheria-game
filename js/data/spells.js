// Spell catalog. Each spell defines cost/cooldown/visuals + a projectile profile.
// `unlock` null = available from the start; otherwise the skill id that grants it.
// `learnCost` = gold to learn at rank 1; `upgradeCost` = gold  to rank up (×rank).
// `upgrade` = next-tier spell id (learned automatically when upgraded).
// The player has 3 cast slots (q/e/r) holding spell ids, rearrangeable in the UI.
export const SPELLS = {
  fireball: { name:'Fireball', icon:'\uD83D\uDD25', cost:10, cd:1.0, sfx:'fire',
    desc:'Fast fire bolt that burns on hit.',
    proj:{ speed:6, base:18, perLvl:2, r:6, color:'#e8623d', kind:'fire', life:1.0, status:'burn' },
    learnCost:0, upgradeCost:80, upgrade:'fireball2' },
  fireball2: { name:'Fireball II', icon:'\uD83D\uDD25', cost:14, cd:1.0, sfx:'fire',
    desc:'Stronger fire bolt, wider burn.',
    proj:{ speed:6.5, base:26, perLvl:2.5, r:7, color:'#ff7a2a', kind:'fire', life:1.1, status:'burn' },
    learnCost:0, upgradeCost:200, upgrade:'fireball3' },
  fireball3: { name:'Fireball III', icon:'\uD83D\uDD25', cost:18, cd:0.9, sfx:'fire',
    desc:'Devastating fire bolt.',
    proj:{ speed:7, base:38, perLvl:3, r:8, color:'#ffaa44', kind:'fire', life:1.2, status:'burn' },
    learnCost:0, upgradeCost:0 },

  iceshard: { name:'Ice Shard', icon:'\u2744\uFE0F', cost:15, cd:2.0, sfx:'ice',
    desc:'Freezes the target briefly.',
    proj:{ speed:5, base:10, perLvl:1, r:7, color:'#7fd8ff', kind:'ice', life:1.2 },
    learnCost:0, upgradeCost:100, upgrade:'iceshard2' },
  iceshard2: { name:'Ice Shard II', icon:'\u2744\uFE0F', cost:20, cd:1.8, sfx:'ice',
    desc:'Larger shard, longer freeze.',
    proj:{ speed:5.5, base:15, perLvl:1.3, r:8, color:'#a0e8ff', kind:'ice', life:1.3 },
    learnCost:0, upgradeCost:250, upgrade:'iceshard3' },
  iceshard3: { name:'Ice Shard III', icon:'\u2744\uFE0F', cost:25, cd:1.5, sfx:'ice',
    desc:'Massive shard that chills all nearby.',
    proj:{ speed:6, base:22, perLvl:1.6, r:10, color:'#c8f0ff', kind:'ice', life:1.4, aoe:40 },
    learnCost:0, upgradeCost:0 },

  spark: { name:'Spark', icon:'\u26A1', cost:6, cd:0.5, sfx:'fire',
    desc:'Cheap, rapid arcane bolt.',
    proj:{ speed:8, base:9, perLvl:1.2, r:4, color:'#ffe24d', kind:'fire', life:0.7 },
    learnCost:0, upgradeCost:60, upgrade:'spark2' },
  spark2: { name:'Spark II', icon:'\u26A1', cost:9, cd:0.45, sfx:'fire',
    desc:'Faster, harder spark.',
    proj:{ speed:9, base:13, perLvl:1.5, r:5, color:'#ffec6a', kind:'fire', life:0.8 },
    learnCost:0, upgradeCost:140, upgrade:'spark3' },
  spark3: { name:'Spark III', icon:'\u26A1', cost:12, cd:0.4, sfx:'fire',
    desc:'Machine-gun arcane bolts.',
    proj:{ speed:10, base:18, perLvl:1.8, r:5, color:'#fff8a0', kind:'fire', life:0.9 },
    learnCost:0, upgradeCost:0 },

  poisonbolt:{ name:'Venom Bolt', icon:'\uD83E\uDDEA', cost:12, cd:1.4, sfx:'ice',
    desc:'Poisons the target over time.',
    proj:{ speed:5.5, base:8, perLvl:1.4, r:6, color:'#74d83f', kind:'fire', life:1.4, status:'poison' },
    learnCost:120, upgradeCost:100, upgrade:'poisonbolt2' },
  poisonbolt2: { name:'Venom Bolt II', icon:'\uD83E\uDDEA', cost:16, cd:1.3, sfx:'ice',
    desc:'Stronger poison, ticks faster.',
    proj:{ speed:6, base:12, perLvl:1.7, r:7, color:'#9aff5f', kind:'fire', life:1.5, status:'poison' },
    learnCost:0, upgradeCost:220, upgrade:'poisonbolt3' },
  poisonbolt3: { name:'Venom Bolt III', icon:'\uD83E\uDDEA', cost:20, cd:1.2, sfx:'ice',
    desc:'Lethal venom that lingers.',
    proj:{ speed:6.5, base:18, perLvl:2, r:8, color:'#c8ff8a', kind:'fire', life:1.6, status:'poison' },
    learnCost:0, upgradeCost:0 },

  arcaneorb:{ name:'Arcane Orb', icon:'\uD83D\uDD2E', cost:22, cd:2.6, sfx:'ice',
    desc:'Slow heavy orb with a small blast.',
    proj:{ speed:3.2, base:30, perLvl:2.5, r:10, color:'#b45cff', kind:'fire', life:1.8, aoe:55 },
    learnCost:200, upgradeCost:180, upgrade:'arcaneorb2' },
  arcaneorb2: { name:'Arcane Orb II', icon:'\uD83D\uDD2E', cost:30, cd:2.4, sfx:'ice',
    desc:'Bigger orb, wider blast.',
    proj:{ speed:3.5, base:42, perLvl:3, r:12, color:'#d08aff', kind:'fire', life:1.9, aoe:70 },
    learnCost:0, upgradeCost:350, upgrade:'arcaneorb3' },
  arcaneorb3: { name:'Arcane Orb III', icon:'\uD83D\uDD2E', cost:38, cd:2.2, sfx:'ice',
    desc:'Massive arcane detonation.',
    proj:{ speed:4, base:58, perLvl:3.5, r:14, color:'#e8b4ff', kind:'fire', life:2.0, aoe:90 },
    learnCost:0, upgradeCost:0 },

  holybolt:{ name:'Holy Bolt', icon:'\uD83C\uDF1F', cost:14, cd:1.2, sfx:'levelup',
    desc:'Radiant bolt; heals you a little on cast.',
    proj:{ speed:6.5, base:16, perLvl:2, r:6, color:'#fff0b0', kind:'fire', life:1.0 }, healOnCast:8,
    learnCost:150, upgradeCost:120, upgrade:'holybolt2' },
  holybolt2: { name:'Holy Bolt II', icon:'\uD83C\uDF1F', cost:18, cd:1.1, sfx:'levelup',
    desc:'Brighter bolt, stronger heal.',
    proj:{ speed:7, base:22, perLvl:2.5, r:7, color:'#fff8d0', kind:'fire', life:1.1 }, healOnCast:14,
    learnCost:0, upgradeCost:260, upgrade:'holybolt3' },
  holybolt3: { name:'Holy Bolt III', icon:'\uD83C\uDF1F', cost:22, cd:1.0, sfx:'levelup',
    desc:'Blazing radiance, generous heal.',
    proj:{ speed:7.5, base:30, perLvl:3, r:8, color:'#ffffe8', kind:'fire', life:1.2 }, healOnCast:22,
    learnCost:0, upgradeCost:0 },

  meteor:   { name:'Meteor', icon:'\u2604\uFE0F', cost:40, cd:6, sfx:'fire', unlock:'meteor',
    desc:'Huge AoE blast (skill-gated).',
    proj:{ speed:4, base:60, perLvl:4, r:12, color:'#ff7a2a', kind:'fire', life:1.4, aoe:90 },
    learnCost:400, upgradeCost:300, upgrade:'meteor2' },
  meteor2: { name:'Meteor II', icon:'\u2604\uFE0F', cost:50, cd:5.5, sfx:'fire',
    desc:'Even bigger crater.',
    proj:{ speed:4.5, base:85, perLvl:5, r:14, color:'#ff9a4a', kind:'fire', life:1.5, aoe:110 },
    learnCost:0, upgradeCost:500, upgrade:'meteor3' },
  meteor3: { name:'Meteor III', icon:'\u2604\uFE0F', cost:60, cd:5, sfx:'fire',
    desc:'Apocalyptic impact.',
    proj:{ speed:5, base:115, perLvl:6, r:16, color:'#ffba6a', kind:'fire', life:1.6, aoe:140 },
    learnCost:0, upgradeCost:0 },

  chainlightning:{ name:'Chain Lightning', icon:'\uD83C\uDF29\uFE0F', cost:30, cd:4, sfx:'ice', unlock:'stormcaller',
    desc:'Forks toward nearby foes (skill-gated).',
    proj:{ speed:7, base:34, perLvl:3, r:6, color:'#9fd8ff', kind:'fire', life:1.2, chain:3 },
    learnCost:350, upgradeCost:250, upgrade:'chainlightning2' },
  chainlightning2: { name:'Chain Lightning II', icon:'\uD83C\uDF29\uFE0F', cost:38, cd:3.5, sfx:'ice',
    desc:'More forks, more damage.',
    proj:{ speed:8, base:48, perLvl:3.5, r:7, color:'#c0e8ff', kind:'fire', life:1.3, chain:4 },
    learnCost:0, upgradeCost:400, upgrade:'chainlightning3' },
  chainlightning3: { name:'Chain Lightning III', icon:'\uD83C\uDF29\uFE0F', cost:46, cd:3, sfx:'ice',
    desc:'Storm of lightning.',
    proj:{ speed:9, base:65, perLvl:4, r:8, color:'#e0f4ff', kind:'fire', life:1.4, chain:5 },
    learnCost:0, upgradeCost:0 },

  frostnova:{ name:'Frost Nova', icon:'\uD83C\uDF00', cost:35, cd:5, sfx:'ice', unlock:'frostweaver',
    desc:'Ring of ice shards that freeze (skill-gated).',
    proj:{ speed:5, base:18, perLvl:2, r:6, color:'#bfe8ff', kind:'ice', life:0.9 }, nova:10,
    learnCost:300, upgradeCost:200, upgrade:'frostnova2' },
  frostnova2: { name:'Frost Nova II', icon:'\uD83C\uDF00', cost:42, cd:4.5, sfx:'ice',
    desc:'Wider ring, stronger freeze.',
    proj:{ speed:5.5, base:26, perLvl:2.5, r:7, color:'#d4f0ff', kind:'ice', life:1.0 }, nova:12,
    learnCost:0, upgradeCost:350, upgrade:'frostnova3' },
  frostnova3: { name:'Frost Nova III', icon:'\uD83C\uDF00', cost:50, cd:4, sfx:'ice',
    desc:'Blizzard nova.',
    proj:{ speed:6, base:36, perLvl:3, r:8, color:'#eef8ff', kind:'ice', life:1.1 }, nova:14,
    learnCost:0, upgradeCost:0 },
};

// Spells available from the start (others are unlocked via skill nodes or bought).
export const STARTER_SPELLS = ['fireball','iceshard','spark'];

// Which spells the player currently knows, given their learned skills.
export function knownSpells(skills){
  const known = [...STARTER_SPELLS];
  for(const id in SPELLS){
    const u = SPELLS[id].unlock;
    if(u && skills && (skills[u]||0) > 0 && !known.includes(id)) known.push(id);
  }
  // poison/arcane/holy are book-learned via the 'spellpower' arcane investment
  for(const id of ['poisonbolt','arcaneorb','holybolt']){
    if(skills && (skills.spellpower||0) >= 1 && !known.includes(id)) known.push(id);
  }
  return known;
}

// Get effective rank of a spell id: strips the trailing "2" or "3" to get the base.
// Returns {base:'fireball', rank:1|2|3}
export function spellRank(id){
  const m = id.match(/^(.+?)([23])$/);
  if(m && SPELLS[m[1]] && SPELLS[id]) return { base:m[1], rank:parseInt(m[2]) };
  return { base:id, rank:1 };
}

// Best known version of a spell base (highest rank the player has unlocked).
export function bestSpellRank(baseId, knownSet){
  let best = baseId;
  let bestR = 1;
  for(const id of knownSet){
    const r = spellRank(id);
    if(r.base === baseId && r.rank > bestR){ best = id; bestR = r.rank; }
  }
  return best;
}
