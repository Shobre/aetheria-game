// Spell catalog. Each spell defines cost/cooldown/visuals + a projectile profile.
// `unlock` null = available from the start; otherwise the skill id that grants it.
// The player has 3 cast slots (q/e/r) holding spell ids, rearrangeable in the UI.
export const SPELLS = {
  fireball: { name:'Fireball', icon:'🔥', cost:10, cd:1.0, sfx:'fire',
    desc:'Fast fire bolt that burns on hit.',
    proj:{ speed:6, base:18, perLvl:2, r:6, color:'#e8623d', kind:'fire', life:1.0, status:'burn' } },
  iceshard: { name:'Ice Shard', icon:'❄️', cost:15, cd:2.0, sfx:'ice',
    desc:'Freezes the target briefly.',
    proj:{ speed:5, base:10, perLvl:1, r:7, color:'#7fd8ff', kind:'ice', life:1.2 } },
  spark:    { name:'Spark', icon:'⚡', cost:6, cd:0.5, sfx:'fire',
    desc:'Cheap, rapid arcane bolt.',
    proj:{ speed:8, base:9, perLvl:1.2, r:4, color:'#ffe24d', kind:'fire', life:0.7 } },
  poisonbolt:{ name:'Venom Bolt', icon:'🧪', cost:12, cd:1.4, sfx:'ice',
    desc:'Poisons the target over time.',
    proj:{ speed:5.5, base:8, perLvl:1.4, r:6, color:'#74d83f', kind:'fire', life:1.4, status:'poison' } },
  arcaneorb:{ name:'Arcane Orb', icon:'🔮', cost:22, cd:2.6, sfx:'ice',
    desc:'Slow heavy orb with a small blast.',
    proj:{ speed:3.2, base:30, perLvl:2.5, r:10, color:'#b45cff', kind:'fire', life:1.8, aoe:55 } },
  holybolt:{ name:'Holy Bolt', icon:'🌟', cost:14, cd:1.2, sfx:'levelup',
    desc:'Radiant bolt; heals you a little on cast.',
    proj:{ speed:6.5, base:16, perLvl:2, r:6, color:'#fff0b0', kind:'fire', life:1.0 }, healOnCast:8 },
  meteor:   { name:'Meteor', icon:'☄️', cost:40, cd:6, sfx:'fire', unlock:'meteor',
    desc:'Huge AoE blast (skill-gated).',
    proj:{ speed:4, base:60, perLvl:4, r:12, color:'#ff7a2a', kind:'fire', life:1.4, aoe:90 } },
  chainlightning:{ name:'Chain Lightning', icon:'🌩️', cost:30, cd:4, sfx:'ice', unlock:'stormcaller',
    desc:'Forks toward nearby foes (skill-gated).',
    proj:{ speed:7, base:34, perLvl:3, r:6, color:'#9fd8ff', kind:'fire', life:1.2, chain:3 } },
  frostnova:{ name:'Frost Nova', icon:'🌀', cost:35, cd:5, sfx:'ice', unlock:'frostweaver',
    desc:'Ring of ice shards that freeze (skill-gated).',
    proj:{ speed:5, base:18, perLvl:2, r:6, color:'#bfe8ff', kind:'ice', life:0.9 }, nova:10 },
};

// Spells available from the start (others are unlocked via skill nodes).
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
