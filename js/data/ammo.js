// Ammo / Quiver System (Sprint 5)
// Bows and crossbows consume physical ammo; arcane staff does not (it runs on MP).
// Each ammo type has: id, name, icon, price, sell value, the weapon-kind it fits,
// and a small atk bonus applied to shots fired with it (sharp broadheads > blunt bolts).
//
// `forKind` is the weapon key (bow|crossbow) — so we can ask "does this ammo fit this weapon?"
// Stacks in the bag like any other consumable (handled by Game.addItem, see gear.js pattern).

/**
 * @typedef {Object} AmmoDef
 * @property {string} name
 * @property {string} icon
 * @property {number} price
 * @property {number} sell
 * @property {'bow'|'crossbow'} forKind
 * @property {number} atkBonus
 * @property {number} qtyPerPack
 * @property {import('../systems/status.js').StatusId} [statusOnHit]   - status effect ('burn', etc.)
 * @property {number} [statusDur]      - duration (seconds)
 */

/** @type {Record<string, AmmoDef>} */
export const AMMO = {
  arrow_wood: {
    name: 'Wooden Arrows', icon: '➶', price: 8, sell: 3,
    forKind: 'bow', atkBonus: 0, qtyPerPack: 20,
  },
  arrow_iron: {
    name: 'Iron Arrows', icon: '➶', price: 22, sell: 9,
    forKind: 'bow', atkBonus: 3, qtyPerPack: 20,
  },
  arrow_fire: {
    name: 'Fire Arrows', icon: '➶', price: 40, sell: 16,
    forKind: 'bow', atkBonus: 5, qtyPerPack: 15, statusOnHit: 'burn', statusDur: 2.0,
  },
  bolt_wood: {
    name: 'Wooden Bolts', icon: '⊢', price: 10, sell: 4,
    forKind: 'crossbow', atkBonus: 0, qtyPerPack: 20,
  },
  bolt_iron: {
    name: 'Iron Bolts', icon: '⊢', price: 26, sell: 10,
    forKind: 'crossbow', atkBonus: 4, qtyPerPack: 20,
  },
};

// Default kind → ammo id the player starts with (and what shops stock at minimum).
// Arcane staff is omitted: it uses MP, not ammo.
/** @type {Record<string, string>} */
export const DEFAULT_AMMO = { bow: 'arrow_wood', crossbow: 'bolt_wood' };

// Starting quiver: a small handful of basic arrows/bolts so the first ranged shot
// doesn't soft-lock the player. Tuned to be enough for ~20 seconds of combat.
/** @type {Record<string, number>} */
export const STARTING_AMMO = {
  arrow_wood: 30,
  bolt_wood: 20,
};

// The order of ammo types a ranged shot will auto-pick (best fit first).
// e.g. firing a bow consumes arrow_fire → arrow_iron → arrow_wood.
/** @type {string[]} */
export const AMMO_ORDER = ['arrow_fire', 'arrow_iron', 'arrow_wood', 'bolt_iron', 'bolt_wood'];

// Look up what ammo a weapon-kind can use, in preference order.
// Filters the global AMMO_ORDER (which spans all kinds) to just this kind.
// (Alias kept for the original call site name; same impl as ammoListForKind.)
/** @param {'bow'|'crossbow'} kind @returns {string[]} */
export function ammoForKind(kind) {
  return AMMO_ORDER.filter(id => AMMO[id] && AMMO[id].forKind === kind);
}

// Does this weapon need ammo at all? (Arcane staff = no)
/** @param {string} weaponKey @returns {boolean} */
export function weaponNeedsAmmo(weaponKey) {
  return weaponKey === 'bow' || weaponKey === 'crossbow';
}

// Map a ranged weapon's catalog id to its ammo-kind key.
// Bows → 'bow'; crossbow → 'crossbow'; staff → null.
/** @param {string|null|undefined} catalogId @returns {'bow'|'crossbow'|null} */
export function rangedWeaponKind(catalogId) {
  if (!catalogId) return null;
  if (catalogId.includes('crossbow')) return 'crossbow';
  if (catalogId.startsWith('bow_')) return 'bow';
  return null; // staff_arcane and unknown
}
