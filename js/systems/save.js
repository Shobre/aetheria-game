// Save system: localStorage-backed, 3 slots.
const KEY = 'aetheria_saves_v1';

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
    all[n] = { ...state, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all));
  },
  delete(n){
    const all = this._all();
    delete all[n];
    localStorage.setItem(KEY, JSON.stringify(all));
  },
  newGame(n){
    const state = {
      slot:n, level:1, xp:0, xpNext:100,
      hp:100, hpMax:100, mp:50, mpMax:50,
      gold:0, playtime:0,
      pos:{ x:400, y:300 },
      inventory:[
        { id:'potion', name:'Health Potion', icon:'🧪', qty:5, type:'consumable' },
        { id:'ether',  name:'Mana Ether',    icon:'🔮', qty:3, type:'consumable' },
        { id:'bomb',   name:'Bomb',          icon:'💣', qty:2, type:'consumable' },
      ],
      hotbar:['potion','ether','bomb',null,null,null,null,null,null],
    };
    this.save(n, state);
    return state;
  }
};
