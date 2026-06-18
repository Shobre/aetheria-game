// Crafting at the Blacksmith forge: reforge (reroll affixes) and upgrade (raise rarity).
// Pure functions over item objects so they are unit-testable without the DOM.
import { CATALOG, makeItem } from '../data/gear.js';
import { RARITY_ORDER, applyRarity } from '../data/affixes.js';
import { stripEnchant } from '../data/enchantments.js';

/**
 * @typedef {import('../data/gear.js').Item} Item
 * @typedef {import('../data/gear.js').ItemType} ItemType
 * @typedef {import('../data/gear.js').RarityId} RarityId
 * @typedef {import('../data/enchantments.js').EnchantKind} EnchantKind
 */

// Gold cost to strip a weapon's current enchantment at the Blacksmith (cheaper than
// a full reforge — uses the base catalog price for the item, no rarity multiplier).
/**
 * @param {string|Item|null|undefined} item
 * @returns {number}
 */
export function stripEnchantCost(item){
  const it=asItem(item); if(!it || it.type==='consumable') return 0;
  if(!it.enchant) return 0;
  return Math.round((CATALOG[it.id]?CATALOG[it.id].price||40:40) * 0.75);
}

// Strip the active enchantment from a weapon and return the scroll id that was
// bound to it, so the caller can place it back in the player's bag. Returns null
// if the item has no enchant or the enchant kind is unknown to the catalog.
/**
 * @param {string|Item|null|undefined} item
 * @returns {EnchantKind|null}
 */
export function stripWeaponEnchant(item){
  const it=asItem(item); if(!it || !it.enchant) return null;
  const removed=it.enchant;
  return stripEnchant(it) ? removed : null;
}

// Resolve any equipment value (id string or item object) to a fresh item object.
/**
 * @private
 * @param {string|Item|null|undefined} v
 * @returns {Item|null}
 */
function asItem(v){
  if(!v) return null;
  if(typeof v==='string') return makeItem(v,1);
  return v;
}

// Gold cost to reforge (reroll the affixes of) an item — scales with its rarity tier.
/**
 * @param {string|Item|null|undefined} item
 * @returns {number}
 */
export function reforgeCost(item){
  const it=asItem(item); if(!it || it.type==='consumable') return 0;
  const tier=RARITY_ORDER.indexOf(it.rarity||'common');
  const base=CATALOG[it.id]?CATALOG[it.id].price||40:40;
  return Math.round(40 + base*0.5 + tier*60);
}

// Gold cost to upgrade an item one rarity tier (common->uncommon->...->legendary).
/**
 * @param {string|Item|null|undefined} item
 * @returns {number}
 */
export function upgradeCost(item){
  const it=asItem(item); if(!it || it.type==='consumable') return 0;
  const tier=RARITY_ORDER.indexOf(it.rarity||'common');
  const base=CATALOG[it.id]?CATALOG[it.id].price||40:40;
  return Math.round(120 + base*1.0 + tier*180);
}

/**
 * @param {string|Item|null|undefined} item
 * @returns {boolean}
 */
export function canUpgrade(item){
  const it=asItem(item); if(!it || it.type==='consumable') return false;
  const tier=RARITY_ORDER.indexOf(it.rarity||'common');
  return tier < RARITY_ORDER.length-1;  // not already legendary
}

// Reforge: re-roll affixes at the current rarity. Mutates+returns a new item object.
// A plain (un-rolled) item is first promoted to at least 'uncommon' so there's something to roll.
/**
 * @param {string|Item|null|undefined} item
 * @param {() => number} [rng]
 * @returns {Item|null|undefined}
 */
export function reforge(item, rng=Math.random){
  const it=asItem(item); if(!it || it.type==='consumable') return it;
  // rebuild from the catalog base so re-rolls don't compound previous affix bonuses
  const fresh=makeItem(it.id,1) || { ...it, stats:{...(CATALOG[it.id]?CATALOG[it.id].stats:{})} };
  let rarity=it.rarity||'common';
  if(rarity==='common') rarity='uncommon';
  applyRarity(fresh, rarity, rng);
  return fresh;
}

// Upgrade: bump rarity one tier and re-roll affixes for the new (higher) tier.
/**
 * @param {string|Item|null|undefined} item
 * @param {() => number} [rng]
 * @returns {Item|null|undefined}
 */
export function upgrade(item, rng=Math.random){
  const it=asItem(item); if(!it || !canUpgrade(it)) return it;
  const tier=RARITY_ORDER.indexOf(it.rarity||'common');
  const next=RARITY_ORDER[tier+1];
  const fresh=makeItem(it.id,1) || { ...it, stats:{...(CATALOG[it.id]?CATALOG[it.id].stats:{})} };
  applyRarity(fresh, next, rng);
  return fresh;
}

