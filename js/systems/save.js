// Save system: localStorage-backed, 3 slots. Schema v2 (maps, gear, skills).
import { makeItem } from '../data/gear.js';
import { STARTING_MAP } from '../data/maps.js';

const KEY = 'aetheria_saves_v2';

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
  save(n, state){
    const all = this._all();
    all[n] = { ...state, savedAt: Date.now(), version:2 };
    localStorage.setItem(KEY, JSON.stringify(all));
  },
  delete(n){
    const all = this._all();
    delete all[n];
    localStorage.setItem(KEY, JSON.stringify(all));
  },
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
      spellSlots:['fireball','iceshard','spark'],
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
      // chests opened, keyed "map:index" so each map persists independently
      openedChests:{},
      boughtSpells:{},
    };
    this.save(n, state);
    return state;
  }
};
