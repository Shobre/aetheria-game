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
      { x:2,  y:5,  to:'snow',    tx:50, ty:30, label:'Frostpeak Tundra' },
      { x:30, y:43, to:'city',    tx:24, ty:3,  label:'Aldermere City' },
      { x:58, y:38, to:'meadow_glade', tx:3, ty:20, label:'Sunlit Glade' },
    ],
    npcs:[
      { x:26, y:18, name:'Elder', icon:'♥', lines:['Welcome, traveler.','Beasts roam each land. Gear up before you delve.','Aldermere City lies to the south - shops, quests and folk await.'] },
    ],
    chests:[
      { x:50, y:38, loot:{type:'item',id:'potion',qty:3} },
      { x:6,  y:8,  loot:{type:'gold',amount:40} },
      { x:42, y:30, loot:{type:'item',id:'arrow_wood',qty:15} },
    ],
  },

  // ===================== FOREST (tougher, ranged foes) =====================
  forest: {
    name:'Whispering Forest', biome:'forest', cols:55, rows:50, seed:202,
    music:'calm',
    enemies:{ count:9, types:['boar','archer','mage','bat'] },
    portals:[
      { x:1, y:22, to:'meadow', tx:53, ty:6, label:'Greenwood Meadow' },
      { x:50, y:45, to:'dungeon1', tx:9, ty:2, label:'Forgotten Crypt', door:true },
      { x:52, y:3, to:'forest_deep', tx:3, ty:25, label:'Deepwood Thicket' },
    ],
    npcs:[
      { x:28, y:25, name:'Ranger', icon:'∧', lines:['The crypt below crawls with undead.','Mind the archers - they strike from afar.'] },
    ],
    chests:[
      { x:45, y:10, loot:{type:'item',id:'armor_leather',qty:1} },
      { x:10, y:42, loot:{type:'gold',amount:75} },
      { x:30, y:35, loot:{type:'item',id:'arrow_iron',qty:12} },
    ],
  },

  // ===================== DESERT (fast, aggressive) =====================
  desert: {
    name:'Sunscar Desert', biome:'desert', cols:58, rows:42, seed:303,
    music:'tense',
    enemies:{ count:10, types:['scorpion','archer','brute'] },
    portals:[
      { x:56, y:23, to:'meadow', tx:7, ty:38, label:'Greenwood Meadow' },
      { x:3,  y:3,  to:'swamp',  tx:50, ty:40, label:'Murkbog Swamp' },
      { x:30, y:40, to:'desert_ruins', tx:24, ty:3, label:'Buried Ruins' },
    ],
    npcs:[
      { x:30, y:20, name:'Nomad', icon:'☀', lines:['Water is life out here.','Scorpions burrow and lunge - stay nimble.'] },
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
    enemies:{ count:8, types:['bat','golem','berserker','slime'] },
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

  // ===================== FROSTPEAK TUNDRA (snow) =====================
  snow: {
    name:'Frostpeak Tundra', biome:'snow', cols:56, rows:46, seed:707,
    music:'tense',
    enemies:{ count:11, types:['frostling','yeti','frost_mage','bat'] },
    portals:[
      { x:52, y:30, to:'meadow', tx:4, ty:7, label:'Greenwood Meadow' },
      { x:5,  y:5,  to:'dungeon2', tx:23, ty:50, label:'Sunken Catacomb', door:true },
      { x:52, y:5, to:'snow_glacier', tx:3, ty:23, label:'Glacier Hollow' },
    ],
    npcs:[
      { x:30, y:24, name:'Wayfarer', icon:'☀', lines:['The cold bites deep here.','Frostlings chill your blood - keep moving.','The catacomb lies past the northern pass.'] },
    ],
    chests:[
      { x:48, y:8,  loot:{type:'item',id:'shield_iron',qty:1} },
      { x:8,  y:40, loot:{type:'gold',amount:160} },
    ],
  },

  // ===================== MURKBOG SWAMP (swamp) =====================
  swamp: {
    name:'Murkbog Swamp', biome:'swamp', cols:58, rows:48, seed:808,
    music:'tense',
    enemies:{ count:12, types:['spitter','croaker','mage','bat'] },
    portals:[
      { x:52, y:42, to:'desert', tx:5, ty:5, label:'Sunscar Desert' },
      { x:5, y:5, to:'swamp_depths', tx:50, ty:40, label:'Bog Depths' },
    ],
    npcs:[
      { x:30, y:24, name:'Hermit', icon:'★', lines:['Few return from the mire.','Spitters spew poison - strike fast.'] },
    ],
    chests:[
      { x:50, y:10, loot:{type:'item',id:'armor_mage',qty:1} },
      { x:10, y:42, loot:{type:'gold',amount:180} },
    ],
  },

  // ===================== SUNKEN CATACOMB (dungeon 2, boss) =====================
  dungeon2: {
    name:'Sunken Catacomb', biome:'dungeon', cols:48, rows:56, seed:909,
    music:'tense',
    enemies:{ count:14, types:['skeleton','spitter','golem'] },
    portals:[
      { x:23, y:54, to:'snow', tx:6, ty:6, label:'Frostpeak Tundra' },
    ],
    npcs:[],
    chests:[
      { x:40, y:50, loot:{type:'item',id:'ring_focus',qty:1} },
      { x:8,  y:50, loot:{type:'gold',amount:300} },
    ],
  },

  // ===================== ALDERMERE CITY (town hub: shops, quest NPCs) =====================
  city: {
    name:'Aldermere City', biome:'city', cols:48, rows:40, seed:111, music:'calm', town:true,
    enemies:{ count:0, types:[] },
    portals:[
      { x:24, y:2,  to:'meadow', tx:30, ty:41, label:'Greenwood Meadow' },
      { x:6,  y:10, to:'shop_black', tx:6, ty:12, label:'Blacksmith', door:true },
      { x:42, y:10, to:'shop_alch',  tx:6, ty:12, label:'Alchemist', door:true },
      { x:6,  y:30, to:'shop_arcane',tx:6, ty:12, label:'Arcanum', door:true },
      { x:42, y:30, to:'shop_general',tx:6,ty:12, label:'General Store', door:true },
      // Sprint 12: home door — leads to the player's house.
      // The matching exit is at (6, 11) in the home map (one tile north of
      // the home map's exit portal at (6, 10), so the player faces the door
      // when they arrive).
      { x:6,  y:38, to:'home',   tx:6, ty:11, label:'Your Home', door:true },
    ],
    npcs:[
      { x:24, y:20, name:'Mayor', icon:'♦', lines:['Welcome to Aldermere!','Our shops ring the plaza. Adventurers are always needed.'] },
      { x:16, y:14, name:'Captain', icon:'→', lines:['Monsters press in from every road.','Clear the crypts and you will be rewarded.'] },
      { x:32, y:26, name:'Scholar', icon:'♣', lines:['Knowledge is the sharpest blade.','Seek the arcane staff in the Arcanum.'] },
      { x:24, y:32, name:'Bard', icon:'♫', lines:['A song for a coin?','They say a witch haunts the bog depths...'] },
      { x:33, y:14, name:'Banker', icon:'◆', bank:true, lines:['Store your treasures safely.','Press F to open your stash.'] },
    ],
    chests:[ { x:3, y:3, loot:{type:'gold',amount:60} } ],
  },

  // ---- City shop interiors (each merchant sells a themed stock) ----
  shop_black: {
    name:'Blacksmith', biome:'house', cols:14, rows:14, seed:121, music:'calm', interior:true,
    enemies:{ count:0, types:[] },
    portals:[ { x:6, y:12, to:'city', tx:6, ty:11, label:'Plaza', door:true } ],
    npcs:[ { x:7, y:5, name:'Smith Garon', icon:'◊', shop:true,
      stock:['sword_iron','greatsword','warhammer','spear_iron','halberd','dagger','shield_wood','shield_iron','helm_iron','armor_chain'],
      lines:['Steel for steel coin.','Press F to browse my forge.'] },
      { x:10, y:7, name:'Forge', icon:'◊', craft:true, lines:['Reforge and upgrade your gear here.','Press F to use the anvil.'] } ],
    chests:[],
  },
  shop_alch: {
    name:'Alchemist', biome:'house', cols:14, rows:14, seed:122, music:'calm', interior:true,
    enemies:{ count:0, types:[] },
    portals:[ { x:6, y:12, to:'city', tx:42, ty:11, label:'Plaza', door:true } ],
    npcs:[ { x:7, y:5, name:'Mira the Alchemist', icon:'◆', shop:true,
      stock:['potion','potion_l','ether','elixir','bomb'],
      lines:['Potions, tonics, cures!','Press F to trade.'] } ],
    chests:[],
  },
  shop_arcane: {
    name:'Arcanum', biome:'house', cols:14, rows:14, seed:123, music:'calm', interior:true,
    enemies:{ count:0, types:[] },
    portals:[ { x:6, y:12, to:'city', tx:6, ty:31, label:'Plaza', door:true } ],
    npcs:[ { x:7, y:5, name:'Archmage Vael', icon:'★', shop:true,
      stock:['staff_arcane','sword_flame','sword_frost','armor_mage','ring_focus','ether','scroll_fire','scroll_ice','scroll_lightning','scroll_poison','scroll_holy'],
      lines:['The weave bends to the worthy.','Press F to peruse arcane goods.'] },
      { x:10, y:8, name:'Anvil of Binding', icon:'◊', enchant:true,
        lines:['Place a weapon and a scroll on the anvil.','Press F to bind an enchantment.'] } ],
    chests:[],
  },
  shop_general: {
    name:'General Store', biome:'house', cols:14, rows:14, seed:124, music:'calm', interior:true,
    enemies:{ count:0, types:[] },
    portals:[ { x:6, y:12, to:'city', tx:42, ty:31, label:'Plaza', door:true } ],
    npcs:[ { x:7, y:5, name:'Trader Pol', icon:'◆', shop:true,
      stock:['bow_short','bow_long','crossbow','dagger','dagger_venom','armor_leather','shield_wood','ring_vigor','ring_power','potion','bomb','arrow_wood','arrow_iron','bolt_wood','bolt_iron'],
      lines:['A bit of everything!','Press F to shop.'] } ],
    chests:[],
  },

  // ---- Biome sub-areas (extra zones to explore + farm) ----
  meadow_glade: {
    name:'Sunlit Glade', biome:'grass', cols:48, rows:40, seed:131, music:'calm',
    enemies:{ count:8, types:['slime','bat','boar'] },
    portals:[ { x:2, y:20, to:'meadow', tx:55, ty:38, label:'Greenwood Meadow' } ],
    npcs:[ { x:24, y:20, name:'Forager', icon:'♥', lines:['The glade is peaceful... mostly.','Boars charge when startled.'] } ],
    chests:[ { x:42, y:6, loot:{type:'item',id:'dagger',qty:1} }, { x:6, y:34, loot:{type:'gold',amount:90} } ],
  },
  forest_deep: {
    name:'Deepwood Thicket', biome:'forest', cols:52, rows:50, seed:132, music:'tense',
    enemies:{ count:12, types:['boar','archer','mage','bat'] },
    portals:[ { x:2, y:25, to:'forest', tx:50, ty:5, label:'Whispering Forest' } ],
    npcs:[],
    chests:[ { x:46, y:8, loot:{type:'item',id:'bow_short',qty:1} }, { x:10, y:44, loot:{type:'gold',amount:140} } ],
  },
  desert_ruins: {
    name:'Buried Ruins', biome:'desert', cols:50, rows:46, seed:133, music:'tense',
    enemies:{ count:12, types:['scorpion','archer','brute'] },
    portals:[ { x:24, y:2, to:'desert', tx:30, ty:38, label:'Sunscar Desert' } ],
    npcs:[],
    chests:[ { x:44, y:40, loot:{type:'item',id:'spear_iron',qty:1} }, { x:6, y:6, loot:{type:'gold',amount:170} } ],
  },
  snow_glacier: {
    name:'Glacier Hollow', biome:'snow', cols:50, rows:46, seed:134, music:'tense',
    enemies:{ count:12, types:['frostling','yeti','frost_mage','bat'] },
    portals:[
      { x:2, y:23, to:'snow', tx:50, ty:7, label:'Frostpeak Tundra' },
      { x:47, y:5, to:'tundra_edge', tx:3, ty:10, label:'Tundra Edge' },
    ],
    npcs:[],
    chests:[ { x:44, y:8, loot:{type:'item',id:'crossbow',qty:1} }, { x:8, y:40, loot:{type:'gold',amount:200} } ],
  },
  swamp_depths: {
    name:'Bog Depths', biome:'swamp', cols:52, rows:48, seed:135, music:'tense',
    enemies:{ count:13, types:['spitter','croaker','mage','bat'] },
    portals:[ { x:50, y:40, to:'swamp', tx:7, ty:7, label:'Murkbog Swamp' } ],
    npcs:[],
    chests:[ { x:8, y:8, loot:{type:'item',id:'dagger_venom',qty:1} }, { x:44, y:42, loot:{type:'gold',amount:220} } ],
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
      { x:9, y:5, name:'Merchant', icon:'◆', shop:true,
        lines:['Finest wares in the realm!','Press F to browse my shop.'] },
    ],
    chests:[],
  },
  // ===================== VOLCANIC ZONE =====================
  volcano: {
    id:'volcano', name:'Scorched Caldera', cols:40, rows:40, seed:777, biome:'volcano',
    pal:{ fa:'#3a1a0a', fb:'#4a2a1a', pa:'#5a3a2a', pb:'#6a4a3a', wd:'#2a1a0a', wl:'#8a5a3a', liquid:'#8a2a0a', liquid2:'#9a3a1a', deco:['rock','crystal','barrel','cactus','bones'] },
    npcs:[
      { x:7, y:5, name:'Ember Sage', icon:'▲', lines:['The caldera burns with ancient fire.','Beware the Magma Tyrant below.'] },
    ],
    portals:[
      { x:38, y:20, to:'city', tx:12, ty:56 },
      { x:20, y:1, to:'volcano_depths', tx:20, ty:38 },
    ],
    chests:[
      { x:30, y:32 }, { x:12, y:30 },
    ],
    enemies:[
      { type:'bat', x:15, y:15 },
      { type:'bat', x:25, y:25 },
    ],
    enemies2:[
      { type:'scorpion', x:30, y:10 },
      { type:'scorpion', x:10, y:30 },
    ],
    decor:[
      { x:5, y:5, type:'rock' }, { x:35, y:35, type:'rock' },
      { x:20, y:20, type:'crystal' },
    ],
  },
  volcano_depths: {
    id:'volcano_depths', name:'Magma Core', cols:40, rows:40, seed:778, biome:'volcano',
    pal:{ fa:'#2a0a00', fb:'#3a1a0a', pa:'#5a2a1a', pb:'#6a3a2a', wd:'#1a0a00', wl:'#7a3a1a', liquid:'#8a1a0a', liquid2:'#9a2a1a' },
    npcs:[],
    portals:[
      { x:20, y:38, to:'volcano', tx:20, ty:3 },
    ],
    chests:[
      { x:25, y:25 }, { x:15, y:15 },
    ],
    enemies:[
      { type:'bat', x:20, y:20 },
    ],
    enemies2:[],
    decor:[
      { x:10, y:10, type:'crystal' }, { x:30, y:30, type:'crystal' },
      { x:20, y:10, type:'rock' }, { x:10, y:30, type:'rock' },
      { x:30, y:10, type:'rock' },
    ],
    boss:'magma_tyrant',
  },
  volcano_caldera: {
    id:'volcano_caldera', name:'Caldera Rim', cols:35, rows:35, seed:779, biome:'volcano',
    pal:{ fa:'#3a1a0a', fb:'#4a2a1a', pa:'#5a3a2a', pb:'#6a4a3a', wd:'#1a0a00', wl:'#7a4a2a', liquid:'#8a2a0a', liquid2:'#9a3a1a', deco:['rock','crystal','cactus','bones'] },
    npcs:[],
    portals:[
      { x:1, y:17, to:'city', tx:78, ty:30 },
    ],
    chests:[],
    enemies:[
      { type:'scorpion', x:17, y:20 },
      { type:'bat', x:25, y:10 },
    ],
    enemies2:[
      { type:'scorpion', x:10, y:25 },
    ],
    decor:[
      { x:5, y:5, type:'rock' }, { x:30, y:30, type:'rock' },
    ],
  },
  // ===================== FROZEN TUNDRA (endgame biome, leads to Glacius) =====================
  tundra_edge: {
    name:'Tundra Edge', biome:'tundra', cols:50, rows:42, seed:701, music:'tense',
    enemies:{ count:10, types:['ice_wraith','snow_stalker','frost_mage'] },
    portals:[
      { x:2, y:10, to:'snow_glacier', tx:46, ty:7, label:'Glacier Hollow' },
      { x:48, y:22, to:'tundra_heart', tx:3, ty:22, label:'Tundra Heart' },
    ],
    chests:[
      { x:8, y:36, loot:{type:'gold',amount:180} },
      { x:42, y:8, loot:{type:'item',id:'potion_l',qty:2} },
      { x:25, y:25, loot:{type:'item',id:'bolt_iron',qty:15} },
    ],
  },
  tundra_heart: {
    name:'Tundra Heart', biome:'tundra', cols:52, rows:48, seed:702, music:'tense',
    enemies:{ count:14, types:['frozen_husk','frost_golem','ice_wraith','snow_stalker'] },
    portals:[
      { x:2, y:22, to:'tundra_edge', tx:46, ty:22, label:'Tundra Edge' },
      { x:50, y:24, to:'frost_spire', tx:24, ty:42, label:'Frost Spire' },
    ],
    npcs:[
      { x:26, y:8, name:'Aurora Keeper', icon:'♦', lines:['The Spire awakens when frost thaws.','Hesitation costs lives.'] },
    ],
    chests:[
      { x:12, y:40, loot:{type:'gold',amount:240} },
      { x:44, y:12, loot:{type:'item',id:'staff_arcane',qty:1} },
      { x:24, y:30, loot:{type:'item',id:'scroll_ice',qty:1} },
    ],
  },
  frost_spire: {
    name:'Frost Spire', biome:'tundra', cols:50, rows:48, seed:703, music:'tense',
    enemies:{ count:0, types:[] },
    portals:[
      { x:24, y:46, to:'tundra_heart', tx:50, ty:24, label:'Tundra Heart' },
    ],
    npcs:[],
    chests:[],
    boss:'glacius',
  },

  // ===================== PLAYER HOME (Sprint 12) =====================
  // The player's own house. Reached by the home door in Aldermere City,
  // or by fast-travel (KeyH) from any map. Holds a Home Chest that bypasses
  // the per-city stash cap. No enemies, no music transition drama — just
  // a quiet room to put things in. Door leads back to the home door in city.
  home: {
    name:'Your Home', biome:'house', cols:14, rows:12, seed:1313, music:'home_calm',
    interior:true, town:true, // town=true: no enemies can spawn, no hostile events
    enemies:{ count:0, types:[] },
    portals:[
      // Door to leave home — return to the home door location in city
      { x:6, y:10, to:'city', tx:6, ty:38, label:'To Aldermere', door:true },
    ],
    npcs:[],
    chests:[],
    // The Home Chest is not a normal chest — it has no open/close state and
    // its storage is the global `state.home.chest` array, not a per-map
    // array. World.renderDecor() reads `map.homeChest` and draws a chest
    // sprite at the given tile; the interact handler in game.js opens the
    // shared Home Chest modal bound to `game.homeChest`.
    homeChest:{ x:9, y:5, w:1, h:1, name:'Home Chest' },
  },
};

// Shop stock - what the merchant sells (ids reference gear.js CATALOG)
export const SHOP_STOCK = [
  'potion','potion_l','ether','bomb','elixir',
  'sword_iron','shield_wood','shield_iron','armor_leather','armor_chain',
  'armor_mage','helm_iron','ring_vigor','ring_focus',
];

// Recommended player level for each map. Used by the "Entering X (lvl N+)"
// hint on map entry. Higher = more dangerous. Tuned to MAP_SCALE so each
// sub-area falls between its parent's range and the next biome's tier.
export const MAP_LEVEL = {
  // safe zones (always 1)
  city: 1, house1: 1, house2: 1, house3: 1, house4: 1, shop: 1, volcano: 1, home: 1,
  // starter biomes
  meadow: 1, forest: 3, desert: 5, cave: 7, dungeon1: 9, snow: 9, swamp: 10, dungeon2: 12,
  // sub-areas (1 tier above the parent)
  meadow_glade: 2, forest_deep: 4, desert_ruins: 6, snow_glacier: 10, swamp_depths: 11,
  // tundra end-game
  tundra_edge: 13, tundra_heart: 15, frost_spire: 17,
};

export const STARTING_MAP = 'meadow';






