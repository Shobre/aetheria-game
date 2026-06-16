// Weapon enchantment system.
//
// An enchantment is a small passive effect that lives on a weapon. The
// weapon keeps its base stats and gains an extra hook (DoT, slow, chain
// damage, +damage vs undead). The visual is a tinted glow around the weapon
// and a coloured slash arc while attacking.
//
// `applyEnchant(item, kind)` mutates an item in place, adding `item.enchant = kind`.
// Enchantments are persisted as the `enchant` field on the item, so save/load
// works automatically as long as you pass the full item through `addItem` and
// `equipItem` (which already happens — those just spread the item object).
//
// `glowColor(kind)` returns the rgb tint to use for the player's weapon glow,
// slash, and HUD border.

export const ENCHANTMENTS = {
  fire: {
    name: 'Flamed',
    short: 'FIR',
    desc: 'Burns foes on each hit (3 dmg/s for 2.5s).',
    glow: '#ff7a2a',
    color: '#ff5a1a',
  },
  ice: {
    name: 'Frosted',
    short: 'ICE',
    desc: 'Chills foes on each hit (slow 50% for 2s).',
    glow: '#80c0ff',
    color: '#5a9be0',
  },
  lightning: {
    name: 'Shock',
    short: 'LGT',
    desc: 'Hits chain to a second nearby foe for 50% damage.',
    glow: '#fff066',
    color: '#ffd84a',
  },
  poison: {
    name: 'Venomed',
    short: 'PSN',
    desc: 'Poisons foes on each hit (2 dmg/s for 4s).',
    glow: '#9aff5f',
    color: '#5fce2a',
  },
  holy: {
    name: 'Blessed',
    short: 'HOL',
    desc: 'Deals +25% damage to undead foes.',
    glow: '#fff7c0',
    color: '#fff099',
  },
};

// Apply an enchantment to an item. Returns true on success.
export function applyEnchant(item, kind){
  if(!item || item.type !== 'weapon') return false;
  if(!ENCHANTMENTS[kind]) return false;
  item.enchant = kind;
  return true;
}

// Remove an enchantment. Returns the previous kind or null.
export function stripEnchant(item){
  if(!item || !item.enchant) return null;
  const k = item.enchant;
  delete item.enchant;
  return k;
}

// Look up the display info for an enchantment; safe for missing keys.
export function enchantInfo(kind){
  return ENCHANTMENTS[kind] || null;
}

// Compute the cost in gold to enchant a weapon. Heavier = pricier.
export function enchantCost(item){
  if(!item) return 0;
  const base = 150;
  const rarMul = ({common:1, uncommon:1.4, rare:1.8, epic:2.4, legendary:3.2})[item.rarity||'common'] || 1;
  return Math.round(base * rarMul);
}
