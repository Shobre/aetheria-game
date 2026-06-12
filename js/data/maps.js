// Map registry: each map defines a biome theme, size, enemy table, portals,
// chests, npcs. Enemies spawn ONCE on map load (no endless waves).
// Portals connect maps; entering one loads the target map at the given spawn.

export const MAPS = {
  // ===================== OVERWORLD HUB (green meadow) =====================
  meadow: {
    name:'Greenwood Meadow', biome:'grass', cols:60, rows:45, seed:101,
    music:'calm',
    enemies:{ count:6, types:['slime','bat'] },
    portals:[
      { x:55, y:5,  to:'forest',  tx:3,  ty:22, label:'Whispering Forest' },
      { x:5,  y:40, to:'desert',  tx:55, ty:23, label:'Sunscar Desert' },
      { x:30, y:2,  to:'cave',    tx:8,  ty:38, label:'Crystal Cave' },
      { x:30, y:22, to:'house1',  tx:8,  ty:13, label:"Merchant's Hut", door:true },
    ],
    npcs:[
      { x:26, y:18, name:'Elder', icon:'🧙', lines:['Welcome, traveler.','Beasts roam each land. Gear up before you delve.','Visit the merchant in the hut to the south.'] },
    ],
    chests:[
      { x:50, y:38, loot:{type:'item',id:'potion',qty:3} },
      { x:6,  y:8,  loot:{type:'gold',amount:40} },
    ],
  },

  // ===================== FOREST (tougher, ranged foes) =====================
  forest: {
    name:'Whispering Forest', biome:'forest', cols:55, rows:50, seed:202,
    music:'calm',
    enemies:{ count:9, types:['boar','archer','bat'] },
    portals:[
      { x:1, y:22, to:'meadow', tx:53, ty:6, label:'Greenwood Meadow' },
      { x:50, y:45, to:'dungeon1', tx:9, ty:2, label:'Forgotten Crypt', door:true },
    ],
    npcs:[
      { x:28, y:25, name:'Ranger', icon:'🏹', lines:['The crypt below crawls with undead.','Mind the archers — they strike from afar.'] },
    ],
    chests:[
      { x:45, y:10, loot:{type:'item',id:'armor_leather',qty:1} },
      { x:10, y:42, loot:{type:'gold',amount:75} },
    ],
  },

  // ===================== DESERT (fast, aggressive) =====================
  desert: {
    name:'Sunscar Desert', biome:'desert', cols:58, rows:42, seed:303,
    music:'tense',
    enemies:{ count:10, types:['scorpion','archer','brute'] },
    portals:[
      { x:56, y:23, to:'meadow', tx:7, ty:38, label:'Greenwood Meadow' },
    ],
    npcs:[
      { x:30, y:20, name:'Nomad', icon:'🧕', lines:['Water is life out here.','Scorpions burrow and lunge — stay nimble.'] },
    ],
    chests:[
      { x:50, y:8,  loot:{type:'item',id:'sword_iron',qty:1} },
      { x:8,  y:35, loot:{type:'item',id:'ring_power',qty:1} },
    ],
  },

  // ===================== CAVE (dark, crystal) =====================
  cave: {
    name:'Crystal Cave', biome:'cave', cols:50, rows:48, seed:404,
    music:'tense',
    enemies:{ count:8, types:['bat','golem','slime'] },
    portals:[
      { x:8, y:39, to:'meadow', tx:30, ty:4, label:'Greenwood Meadow' },
    ],
    npcs:[],
    chests:[
      { x:42, y:6,  loot:{type:'item',id:'shield_iron',qty:1} },
      { x:25, y:40, loot:{type:'gold',amount:120} },
    ],
  },

  // ===================== DUNGEON 1 (undead crypt, boss room) =====================
  dungeon1: {
    name:'Forgotten Crypt', biome:'dungeon', cols:46, rows:54, seed:505,
    music:'tense',
    enemies:{ count:12, types:['skeleton','archer','golem'] },
    portals:[
      { x:9, y:1, to:'forest', tx:48, ty:44, label:'Whispering Forest' },
    ],
    npcs:[],
    chests:[
      { x:38, y:48, loot:{type:'item',id:'armor_chain',qty:1} },
      { x:8,  y:48, loot:{type:'item',id:'sword_flame',qty:1} },
      { x:23, y:30, loot:{type:'gold',amount:200} },
    ],
  },

  // ===================== HOUSE (merchant interior, no enemies) =====================
  house1: {
    name:"Merchant's Hut", biome:'house', cols:18, rows:16, seed:606,
    music:'calm', interior:true,
    enemies:{ count:0, types:[] },
    portals:[
      { x:8, y:14, to:'meadow', tx:30, ty:24, label:'Outside', door:true },
    ],
    npcs:[
      { x:9, y:5, name:'Merchant', icon:'🧌', shop:true,
        lines:['Finest wares in the realm!','Press F to browse my shop.'] },
    ],
    chests:[],
  },
};

// Shop stock — what the merchant sells (ids reference gear.js CATALOG)
export const SHOP_STOCK = [
  'potion','potion_l','ether','bomb','elixir',
  'sword_iron','shield_wood','shield_iron','armor_leather','armor_chain',
  'armor_mage','helm_iron','ring_vigor','ring_focus',
];

export const STARTING_MAP = 'meadow';
