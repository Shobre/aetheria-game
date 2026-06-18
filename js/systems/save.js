// Save system: localStorage-backed, 3 slots. Schema v2 (maps, gear, skills).
import { makeItem } from '../data/gear.js';
import { STARTING_MAP } from '../data/maps.js';
import { STARTING_AMMO } from '../data/ammo.js';

const KEY = 'aetheria_saves_v2';

/**
 * @typedef {import('../data/gear.js').Item} Item
 * @typedef {import('../data/gear.js').EquipSlot} EquipSlot
 *
 * @typedef {Object} SaveState
 * Schema v2 — the persisted game state.
 * @property {number} slot
 * @property {number} [version]   - set by SaveSystem.save() at write time
 * @property {number} level
 * @property {number} xp
 * @property {number} xpNext
 * @property {number} hp
 * @property {number} hpMax
 * @property {number} mp
 * @property {number} mpMax
 * @property {number} gold
 * @property {number} playtime
 * @property {number} skillPoints
 * @property {string} map                  - current map id
 * @property {{x:number,y:number}} pos      - position within map (px)
 * @property {Object<EquipSlot, string|Item|null>} equipment
 * @property {Record<string, number>} skills
 * @property {[string,string,string]} spellSlots
 * @property {Item[]} inventory
 * @property {Array<string|null>} hotbar
 * @property {Item[]} stash
 * @property {{chest: Item[]}} home
 * @property {Record<string, boolean>} openedChests
 * @property {Record<string, boolean>} boughtSpells
 * @property {Record<string, number>} ammo
 * @property {number} [savedAt]             - ms epoch (set on save)
 */

export const SaveSystem = {
  _all(){
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  },
  getSlot(n){ return this._all()[n] || null; },
  listSlots(){
    const all = this._all();
    return [1,2,3].map(n => ({ slot:n, data: all[n] || null }));
  },
  /**
   * @param {number} n
   * @param {SaveState} state
   */
  save(n, state){
    const all = this._all();
    all[n] = { ...state, savedAt: Date.now(), version:2 };
    localStorage.setItem(KEY, JSON.stringify(all));
  },
  /** @param {number} n */
  delete(n){
    const all = this._all();
    delete all[n];
    localStorage.setItem(KEY, JSON.stringify(all));
  },
  /**
   * @param {number} n
   * @returns {SaveState}
   */
  newGame(n){
    const state = {
      slot:n, version:2,
      level:1, xp:0, xpNext:100,
      hp:120, hpMax:120, mp:50, mpMax:50,
      gold:30, playtime:0,
      skillPoints:0,
      // current map + position within it
      map: STARTING_MAP, pos:{ x:30*32, y:24*32 },
      // equipment slots
      equipment:{ weapon:'sword_wood', shield:null, armor:null, helm:null, ring:null },
      // skill ranks {id:rank}
      skills:{},
      // q/e/r spell loadout (rearrangeable)
      spellSlots: /** @type {[string,string,string]} */ (['fireball','iceshard','spark']),
      // inventory (consumables stack; gear individual)
      inventory:[
        makeItem('potion',5),
        makeItem('ether',3),
        makeItem('bomb',2),
        makeItem('shield_wood',1),
      ],
      hotbar:['potion','ether','bomb',null,null,null,null,null,null],
      // shared stash (city bank) — persists across the run
      stash:[],
      // Sprint 12: home chest — global, no per-city cap. Reachable from the
      // Home Chest modal in the home map, or via the bank modal's Home tab.
      // Persists across the run and across save slots.
      home:{ chest:[] },
      // chests opened, keyed "map:index" so each map persists independently
      openedChests:{},
      boughtSpells:{},
      // ammo / quiver (Sprint 5) — {ammoId: qty}; sourced from data/ammo.js
      ammo:{ ...STARTING_AMMO },
    };
    /** @type {SaveState} */
    const finalState = state;
    this.save(n, finalState);
    return finalState;
  }
};
