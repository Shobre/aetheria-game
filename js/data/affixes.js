// Item rarity tiers + random affix rolling for dropped gear.
// A dropped equippable can roll a rarity; higher rarity => more bonus affixes
// layered on top of the base catalog stats. Consumables never roll rarity.

export const RARITY = {
  common:    { name:'Common',    color:'#c8cdd6', weight:60, affixes:0, mult:1.0 },
  uncommon:  { name:'Uncommon',  color:'#5fd35f', weight:24, affixes:1, mult:1.1 },
  rare:      { name:'Rare',      color:'#4d9bff', weight:11, affixes:2, mult:1.25 },
  epic:      { name:'Epic',      color:'#b45cff', weight:4,  affixes:3, mult:1.45 },
  legendary: { name:'Legendary', color:'#ffae34', weight:1,  affixes:4, mult:1.7 },
};
export const RARITY_ORDER = ['common','uncommon','rare','epic','legendary'];

// Affix pool: stat key -> {label, roll()}; values are added to item.stats.
const AFFIX_POOL = [
  { key:'atk',  label:'ATK',    min:1, max:5 },
  { key:'def',  label:'DEF',    min:1, max:4 },
  { key:'hp',   label:'HP',     min:8, max:30 },
  { key:'mp',   label:'MP',     min:6, max:24 },
  { key:'crit', label:'Crit%',  min:2, max:7 },
  { key:'cdr',  label:'CDR%',   min:3, max:9 },
];

// Weighted pick of a rarity, optionally biased upward by `luck` (0..1 shifts weight to rarer).
export function rollRarity(rng = Math.random, luck = 0){
  const entries = RARITY_ORDER.map((id, i) => {
    let w = RARITY[id].weight;
    if(luck > 0) w *= (1 + luck * i * 0.8); // nudge toward rarer tiers
    return { id, w };
  });
  const total = entries.reduce((s, e) => s + e.w, 0);
  let r = rng() * total;
  for(const e of entries){ r -= e.w; if(r <= 0) return e.id; }
  return 'common';
}

// Given a base item (from makeItem) produce a rarity-decorated copy with rolled affixes.
// Mutates+returns the item. Safe to call on equippables only.
export function applyRarity(item, rarityId, rng = Math.random){
  if(!item || item.type === 'consumable') return item;
  const R = RARITY[rarityId] || RARITY.common;
  item.rarity = rarityId;
  item.stats = item.stats ? { ...item.stats } : {};
  // scale base stats by rarity multiplier (rounded, min original)
  for(const k in item.stats){
    item.stats[k] = Math.max(item.stats[k], Math.round(item.stats[k] * R.mult));
  }
  // roll N distinct bonus affixes
  item.affixes = [];
  const pool = [...AFFIX_POOL];
  for(let i = 0; i < R.affixes && pool.length; i++){
    const idx = Math.floor(rng() * pool.length);
    const a = pool.splice(idx, 1)[0];
    const val = a.min + Math.floor(rng() * (a.max - a.min + 1));
    item.stats[a.key] = (item.stats[a.key] || 0) + val;
    item.affixes.push({ label:a.label, key:a.key, val });
  }
  // decorate name with rarity (legendary/epic get a flourish)
  if(rarityId !== 'common'){
    item.baseName = item.baseName || item.name;
    item.name = item.baseName;
  }
  return item;
}

export function rarityColor(item){
  return RARITY[item && item.rarity ? item.rarity : 'common'].color;
}
export function rarityName(item){
  return RARITY[item && item.rarity ? item.rarity : 'common'].name;
}
// Human-readable affix line e.g. "+3 ATK · +5% Crit"
export function affixText(item){
  if(!item || !item.affixes || !item.affixes.length) return '';
  return item.affixes.map(a => '+' + a.val + (a.label.includes('%') ? '' : ' ') + a.label).join(' · ');
}
