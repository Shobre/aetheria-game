// Item & gear catalog. Equipment grants stat bonuses; consumables are used.
// slot: weapon | shield | armor | helm | ring  (equippable)  OR  consumable
export const CATALOG = {
  // ---- consumables ----
  potion:   { name:'Health Potion', icon:'🧪', type:'consumable', price:25,  sell:10,
              use:(g)=>{ g.player.heal(40,g); g.sfx('drink'); } },
  potion_l: { name:'Greater Potion', icon:'🍶', type:'consumable', price:70, sell:30,
              use:(g)=>{ g.player.heal(110,g); g.sfx('drink'); } },
  ether:    { name:'Mana Ether', icon:'🔮', type:'consumable', price:30, sell:12,
              use:(g)=>{ g.player.restoreMp(30); g.floater('+30 MP',g.player.x,g.player.y-16,'#3b8be8'); g.sfx('drink'); } },
  bomb:     { name:'Bomb', icon:'💣', type:'consumable', price:40, sell:15,
              use:(g)=>{ g.throwBomb(); g.sfx('fire'); } },
  elixir:   { name:'Elixir', icon:'✨', type:'consumable', price:120, sell:50,
              use:(g)=>{ g.player.heal(200,g); g.player.restoreMp(120); g.sfx('levelup'); } },

  // ---- weapons (atk) ----
  sword_wood:  { name:'Wooden Sword', icon:'🗡️', type:'weapon', price:0,   sell:5,   stats:{atk:2} },
  sword_iron:  { name:'Iron Sword',   icon:'⚔️', type:'weapon', price:120, sell:50,  stats:{atk:6} },
  sword_flame: { name:'Flameblade',   icon:'🔥', type:'weapon', price:380, sell:160, stats:{atk:12,mp:10} },
  sword_frost: { name:'Frostfang',    icon:'❄️', type:'weapon', price:420, sell:175, stats:{atk:11,crit:8} },

  // ---- shields (def + block) ----
  shield_wood: { name:'Wooden Shield', icon:'🛡️', type:'shield', price:60,  sell:25,  stats:{def:3} },
  shield_iron: { name:'Iron Shield',   icon:'🔰', type:'shield', price:200, sell:85,  stats:{def:7} },

  // ---- armor (def + hp) ----
  armor_leather:{ name:'Leather Armor', icon:'🧥', type:'armor', price:90,  sell:38,  stats:{def:4,hp:20} },
  armor_chain:  { name:'Chainmail',     icon:'🪖', type:'armor', price:260, sell:110, stats:{def:9,hp:50} },
  armor_mage:   { name:'Mage Robe',     icon:'👘', type:'armor', price:240, sell:100, stats:{def:3,mp:40,hp:15} },

  // ---- helms ----
  helm_iron:   { name:'Iron Helm', icon:'⛑️', type:'helm', price:110, sell:46, stats:{def:5,hp:15} },

  // ---- rings (utility) ----
  ring_power:  { name:'Ring of Power',  icon:'💍', type:'ring', price:300, sell:125, stats:{atk:5,crit:5} },
  ring_vigor:  { name:'Ring of Vigor',  icon:'💎', type:'ring', price:300, sell:125, stats:{hp:60,def:2} },
  ring_focus:  { name:'Ring of Focus',  icon:'🔷', type:'ring', price:300, sell:125, stats:{mp:60,cdr:15} },
};

export const EQUIP_SLOTS = ['weapon','shield','armor','helm','ring'];

// Build a fresh inventory item object from a catalog id
export function makeItem(id, qty){
  const c = CATALOG[id];
  if(!c) return null;
  const it = { id, name:c.name, icon:c.icon, type:c.type };
  if(c.type==='consumable') it.qty = qty||1;
  if(c.stats) it.stats = {...c.stats};
  return it;
}

// Resolve an equipment slot value (id string OR full item object) to a display item.
export function resolveEquip(val){
  if(!val) return null;
  if(typeof val === 'string'){ const c = CATALOG[val]; if(!c) return null;
    return { id:val, name:c.name, icon:c.icon, type:c.type, stats:c.stats||{} }; }
  return val; // already an item object (rolled gear keeps its own stats/affixes)
}

// Sum stat bonuses from an equipment map {slot: id|itemObject}
export function equipStats(equipment){
  const total = { atk:0, def:0, hp:0, mp:0, crit:0, cdr:0 };
  for(const slot of EQUIP_SLOTS){
    const it = resolveEquip(equipment[slot]);
    if(it && it.stats){
      for(const k in it.stats) total[k] = (total[k]||0) + it.stats[k];
    }
  }
  return total;
}
