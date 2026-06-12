// Plain-node test harness (no framework). Run: npm test  (or node tests/run.js)
// Covers DOM-free game logic: gear stat aggregation, affix rolling, skill stats,
// quest progression, status definitions, and combat/derivation math.
import { CATALOG, makeItem, equipStats, resolveEquip, EQUIP_SLOTS } from '../js/data/gear.js';
import { RARITY, RARITY_ORDER, rollRarity, applyRarity, affixText, rarityName } from '../js/data/affixes.js';
import { SKILLS, skillStats, canLearn } from '../js/data/skilltree.js';
import { QUESTS, questsForGiver } from '../js/data/quests.js';
import { STATUS, applyStatus, hasStatus, tickStatuses } from '../js/systems/status.js';

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond){ if(cond){ pass++; } else { fail++; fails.push(name); console.log('  ✗ ' + name); } }
function eq(name, a, b){ ok(name + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')', a === b); }
function approx(name, a, b, eps=1e-9){ ok(name, Math.abs(a-b) < eps); }

// seeded RNG for deterministic affix tests
function mulberry32(seed){ return function(){ let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

console.log('\n=== gear ===');
{
  const it = makeItem('potion', 3);
  eq('makeItem consumable qty', it.qty, 3);
  eq('makeItem consumable type', it.type, 'consumable');
  const sword = makeItem('sword_iron', 1);
  eq('makeItem weapon atk', sword.stats.atk, 6);
  // equipStats with id strings
  const stats = equipStats({ weapon:'sword_iron', shield:null, armor:'armor_leather', helm:null, ring:null });
  eq('equipStats atk sum', stats.atk, 6);
  eq('equipStats def sum', stats.def, 4);
  eq('equipStats hp sum', stats.hp, 20);
  // equipStats with a full item object (rolled gear) — must read item.stats
  const rolled = makeItem('sword_iron', 1); rolled.stats = { atk: 99, crit: 5 };
  const s2 = equipStats({ weapon: rolled, shield:null, armor:null, helm:null, ring:null });
  eq('equipStats reads object stats', s2.atk, 99);
  eq('equipStats reads object crit', s2.crit, 5);
  // resolveEquip
  eq('resolveEquip string -> name', resolveEquip('sword_iron').name, 'Iron Sword');
  eq('resolveEquip null', resolveEquip(null), null);
  eq('resolveEquip object passthrough', resolveEquip(rolled).stats.atk, 99);
}

console.log('=== affixes ===');
{
  // rarity weights sum & ordering
  ok('5 rarities', RARITY_ORDER.length === 5);
  ok('legendary rarest', RARITY.legendary.weight < RARITY.common.weight);
  // deterministic roll
  const rng = mulberry32(12345);
  const r = rollRarity(rng, 0);
  ok('rollRarity returns valid tier', RARITY_ORDER.includes(r));
  // applyRarity adds affixes count matching tier
  const it = makeItem('sword_iron', 1);
  applyRarity(it, 'epic', mulberry32(7));
  eq('epic affix count', it.affixes.length, RARITY.epic.affixes);
  eq('epic rarity tag', it.rarity, 'epic');
  ok('epic scales base atk >= original', it.stats.atk >= 6);
  ok('affixText non-empty for epic', affixText(it).length > 0);
  // common has no affixes
  const c = makeItem('sword_iron', 1); applyRarity(c, 'common', mulberry32(1));
  eq('common affix count', c.affixes.length, 0);
  eq('common affixText empty', affixText(c), '');
  // luck shifts distribution upward (statistical, large sample)
  let rareOrBetter = 0; const N = 4000; const rng2 = mulberry32(999);
  for(let i=0;i<N;i++){ const t = rollRarity(rng2, 1.0);
    if(['rare','epic','legendary'].includes(t)) rareOrBetter++; }
  let baseRareOrBetter = 0; const rng3 = mulberry32(999);
  for(let i=0;i<N;i++){ const t = rollRarity(rng3, 0);
    if(['rare','epic','legendary'].includes(t)) baseRareOrBetter++; }
  ok('luck increases rare+ rate', rareOrBetter > baseRareOrBetter);
}

console.log('=== skill tree ===');
{
  // skillStats aggregation
  const s = skillStats({ vitality: 3, might: 2 });
  eq('vitality 3 -> +75 hp', s.hp, 75);
  eq('might 2 -> +6 atk', s.atk, 6);
  // canLearn gating
  eq('canLearn no points', canLearn('vitality', {}, 0), 'no points');
  eq('canLearn ok', canLearn('vitality', {}, 1), null);
  eq('canLearn locked by prereq', canLearn('might', {}, 5).startsWith('locked'), true);
  eq('canLearn maxed', canLearn('vitality', { vitality: 5 }, 5), 'maxed');
  // meteor requires two prereqs
  ok('meteor locked initially', canLearn('meteor', {}, 3) !== null);
  ok('meteor ok with prereqs', canLearn('meteor', { spellpower:1, haste:1 }, 3) === null);
}

console.log('=== quests ===');
{
  ok('quests exist', Object.keys(QUESTS).length >= 4);
  const elder = questsForGiver('Elder');
  ok('Elder gives quests', elder.length >= 1);
  ok('Elder quests reference Elder', elder.every(id => QUESTS[id].giver === 'Elder'));
  // every quest has objectives + reward
  for(const id in QUESTS){
    ok(id + ' has objectives', Array.isArray(QUESTS[id].objectives) && QUESTS[id].objectives.length > 0);
    ok(id + ' has reward', !!QUESTS[id].reward);
  }
}

console.log('=== status effects ===');
{
  ok('4 status types', Object.keys(STATUS).length === 4);
  const ent = { x:0, y:0, r:10, hp:100, statuses:{}, die(){ this.dead=true; }, kill(){ this.dead=true; } };
  applyStatus(ent, 'poison');
  ok('poison applied', hasStatus(ent, 'poison'));
  // tick poison for its full duration -> deals damage
  const fakeGame = { floater(){}, };
  let total = 0, guard = 0;
  while(hasStatus(ent, 'poison') && guard++ < 1000){ tickStatuses(ent, 0.1, fakeGame, false); }
  ok('poison expires', !hasStatus(ent, 'poison'));
  ok('poison dealt damage', ent.hp < 100);
  // stun returns stunned=true
  const e2 = { x:0,y:0,r:10,hp:100, statuses:{}, die(){}, kill(){} };
  applyStatus(e2, 'stun');
  const res = tickStatuses(e2, 0.05, fakeGame, false);
  ok('stun flagged', res.stunned === true);
  // chill returns slow > 0
  const e3 = { x:0,y:0,r:10,hp:100, statuses:{}, die(){}, kill(){} };
  applyStatus(e3, 'chill');
  const res3 = tickStatuses(e3, 0.05, fakeGame, false);
  ok('chill slows', res3.slow > 0);
  // applyStatus refresh keeps the longer duration
  const e4 = { x:0,y:0,r:10,hp:100, statuses:{}, die(){}, kill(){} };
  applyStatus(e4, 'burn', 1.0); applyStatus(e4, 'burn', 3.0);
  ok('burn refresh longer', e4.statuses.burn.time >= 3.0 - 1e-9);
}

console.log('=== combat math ===');
{
  // defense mitigation formula: amt * 100/(100+def)
  const mitigate = (amt, def) => amt * (100/(100+def));
  approx('0 def = full dmg', mitigate(100, 0), 100);
  approx('100 def = half dmg', mitigate(100, 100), 50);
  ok('more def = less dmg', mitigate(100, 50) < mitigate(100, 10));
  // xp curve grows
  let xpNext = 100; const first = xpNext; xpNext = Math.floor(xpNext * 1.4);
  ok('xp curve grows', xpNext > first);
}

console.log('=== spells ===');
{
  const { SPELLS, STARTER_SPELLS, knownSpells } = await import('../js/data/spells.js');
  ok('has fireball', !!SPELLS.fireball);
  ok('3 starter spells', STARTER_SPELLS.length === 3);
  // starters known with no skills
  const k0 = knownSpells({});
  ok('starters known by default', STARTER_SPELLS.every(s => k0.includes(s)));
  ok('meteor locked without skill', !k0.includes('meteor'));
  // meteor unlocked by skill
  ok('meteor known with skill', knownSpells({ meteor:1 }).includes('meteor'));
  // spellpower grants the book spells
  ok('spellpower unlocks arcaneorb', knownSpells({ spellpower:1 }).includes('arcaneorb'));
  // every spell has a projectile profile + cost/cd
  for(const id in SPELLS){ const s=SPELLS[id];
    ok(id+' has proj', !!s.proj && typeof s.proj.base==='number');
    ok(id+' has cost/cd', typeof s.cost==='number' && typeof s.cd==='number'); }
}

console.log('=== weapons (ranged + melee variety) ===');
{
  const { CATALOG } = await import('../js/data/gear.js');
  ok('bow is ranged', CATALOG.bow_short && CATALOG.bow_short.ranged === true);
  ok('crossbow is ranged', CATALOG.crossbow && CATALOG.crossbow.ranged === true);
  ok('staff is ranged', CATALOG.staff_arcane && CATALOG.staff_arcane.ranged === true);
  ok('dagger fast atkSpeed', CATALOG.dagger && CATALOG.dagger.atkSpeed < 0.32);
  ok('spear long reach', CATALOG.spear_iron && CATALOG.spear_iron.reach > 44);
  ok('greatsword slow', CATALOG.greatsword && CATALOG.greatsword.atkSpeed > 0.32);
  ok('sword_iron stays melee', !CATALOG.sword_iron.ranged);
}

console.log('=== enemy speeds vs player ===');
{
  // mirror player baseSpeed (1.9) and assert every enemy is slower than it
  const { readFileSync } = await import('node:fs');
  const enemySrc = readFileSync(new URL('../js/entities/enemy.js', import.meta.url), 'utf8');
  const playerSrc = readFileSync(new URL('../js/entities/player.js', import.meta.url), 'utf8');
  const pm = playerSrc.match(/baseSpeed\s*=\s*([0-9.]+)/);
  const playerSpeed = pm ? parseFloat(pm[1]) : 0;
  ok('player baseSpeed parsed', playerSpeed > 0);
  const speeds = [...enemySrc.matchAll(/speed:\s*([0-9.]+)/g)].map(m => parseFloat(m[1]));
  ok('found enemy speeds', speeds.length >= 10);
  const maxEnemy = Math.max(...speeds);
  ok('every enemy slower than player ('+maxEnemy+' < '+playerSpeed+')', maxEnemy < playerSpeed);
  // enemies must have view/fov perception fields
  ok('enemies have vision cones', enemySrc.includes('view:') && enemySrc.includes('fov:'));
}

console.log('=== maps (city + sub-areas) ===');
{
  const { MAPS, STARTING_MAP } = await import('../js/data/maps.js');
  ok('city exists', !!MAPS.city);
  ok('city is town', MAPS.city.town === true);
  ok('4 shop interiors', ['shop_black','shop_alch','shop_arcane','shop_general'].every(m=>!!MAPS[m]));
  ok('shop NPCs carry stock', MAPS.shop_black.npcs[0].stock.length > 0);
  ok('sub-areas exist', ['meadow_glade','forest_deep','desert_ruins','snow_glacier','swamp_depths'].every(m=>!!MAPS[m]));
  // every portal target must resolve to a real map (no dead links)
  let badLinks=[];
  for(const id in MAPS){ for(const p of (MAPS[id].portals||[])){ if(!MAPS[p.to]) badLinks.push(id+'->'+p.to); } }
  ok('no broken portal links'+(badLinks.length?' ['+badLinks.join(',')+']':''), badLinks.length===0);
  ok('starting map valid', !!MAPS[STARTING_MAP]);
}

console.log('=== quests (new givers) ===');
{
  const { QUESTS, questsForGiver } = await import('../js/data/quests.js');
  ok('Captain gives quests', questsForGiver('Captain').length >= 1);
  ok('Bard gives quests', questsForGiver('Bard').length >= 1);
  ok('Scholar gives quests', questsForGiver('Scholar').length >= 1);
  // boss quest references a real boss
  const { BOSSES } = await import('../js/entities/boss.js');
  for(const id in QUESTS){ for(const o of QUESTS[id].objectives){
    if(o.kind==='boss') ok(id+' boss target valid', !!BOSSES[o.boss]); } }
}

console.log('=== item comparison ===');
{
  const { compareItem, makeItem } = await import('../js/data/gear.js');
  const eqp = { weapon:'sword_wood', shield:null, armor:null, helm:null, ring:null }; // wooden sword atk:2
  const better = makeItem('sword_iron',1); // atk:6
  const c1 = compareItem(better, eqp);
  ok('better weapon flagged better', c1 && c1.dir==='better');
  ok('better delta positive', c1.delta > 0);
  // worse: comparing wooden sword while iron equipped
  const eqp2 = { weapon:'sword_iron', shield:null, armor:null, helm:null, ring:null };
  const worse = makeItem('sword_wood',1);
  const c2 = compareItem(worse, eqp2);
  ok('worse weapon flagged worse', c2 && c2.dir==='worse');
  // equal: same item vs same equipped
  const c3 = compareItem(makeItem('sword_iron',1), eqp2);
  ok('equal weapon flagged equal', c3 && c3.dir==='equal');
  // empty slot: any gear is better than nothing
  const c4 = compareItem(makeItem('shield_wood',1), eqp);
  ok('gear better than empty slot', c4 && c4.dir==='better');
  // consumables are not comparable
  ok('consumable not comparable', compareItem(makeItem('potion',1), eqp) === null);
}

console.log('=== pathfinding ===');
{
  // World needs the canvas-free parts only: build via MAPS + a stub.
  // We import World and exercise findPath / hasLineOfSight on a generated map.
  const { World } = await import('../js/systems/world.js');
  // performance is referenced in draw() only; ensure it exists for any incidental use
  if(typeof globalThis.performance === 'undefined') globalThis.performance = { now:()=>0 };
  const w = new World('meadow');
  // LOS: a point to itself is always visible
  ok('LOS to self', w.hasLineOfSight(100,100,100,100) === true);
  // findPath returns array of waypoints between two open floor tiles or null
  // pick two known floor tiles via randomFloor
  const a = w.randomFloor(Math.random), b = w.randomFloor(Math.random);
  const path = w.findPath(a.x,a.y,b.x,b.y);
  ok('findPath returns array or null', path === null || Array.isArray(path));
  if(Array.isArray(path)){
    ok('path waypoints have x/y', path.every(p=>typeof p.x==='number' && typeof p.y==='number'));
    // every waypoint must be on a non-solid tile
    ok('path avoids solid tiles', path.every(p=>!w.isSolid(p.x,p.y)));
  }
  // findPath from a tile to itself returns null (already there)
  ok('findPath same tile null', w.findPath(a.x,a.y,a.x,a.y) === null);
  // LOS blocked by a wall: scan the map for a wall tile and test across it
  let blockedFound=false;
  for(let y=1;y<w.rows-1 && !blockedFound;y++) for(let x=1;x<w.cols-1;x++){
    if(w.isSolid(x*32+16,y*32+16)){
      // points on opposite sides of this wall tile
      if(w.hasLineOfSight((x-1)*32+16,y*32+16,(x+1)*32+16,y*32+16)===false){ blockedFound=true; break; }
    }
  }
  ok('LOS blocked by a wall somewhere', blockedFound);
}

console.log('=== autosave wiring ===');
{
  // verify game.js exposes autosave + _buildState and hooks them in
  const { readFileSync } = await import('node:fs');
  const gameSrc = readFileSync(new URL('../js/systems/game.js', import.meta.url), 'utf8');
  ok('has _buildState', gameSrc.includes('_buildState('));
  ok('has autosave method', gameSrc.includes('autosave(reason'));
  ok('timed autosave in update', gameSrc.includes('this._autoT'));
  ok('autosave on area entry', gameSrc.includes("autosave('Checkpoint saved')"));
  const mainSrc = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  ok('beforeunload autosave', mainSrc.includes('beforeunload') && mainSrc.includes('game.autosave'));
  ok('M key opens full map', mainSrc.includes("k==='m'") && mainSrc.includes('showFullMap'));
}

console.log('=== tooltip wiring ===');
{
  // hud.js is DOM-bound, so verify the tooltip plumbing via source + data sanity.
  const { readFileSync } = await import('node:fs');
  const hudSrc = readFileSync(new URL('../js/ui/hud.js', import.meta.url), 'utf8');
  ok('has _buildItemTooltip', hudSrc.includes('_buildItemTooltip('));
  ok('has _buildSpellTooltip', hudSrc.includes('_buildSpellTooltip('));
  ok('has _bindTooltip', hudSrc.includes('_bindTooltip('));
  ok('tooltip element grabbed', hudSrc.includes("tooltip:$('tooltip')"));
  ok('bag binds tooltip', hudSrc.includes('this._bindTooltip(c, ()=>this._buildItemTooltip(item'));
  ok('spell loadout binds tooltip', hudSrc.includes('_buildSpellTooltip(sid'));
  ok('shop buy binds tooltip', hudSrc.includes('this._buildItemTooltip(id'));
  const idxSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ok('tooltip element in DOM', idxSrc.includes('id="tooltip"'));
  // spell damage formula sanity: base + level*perLvl scaled by spellMul
  const { SPELLS } = await import('../js/data/spells.js');
  const fb = SPELLS.fireball;
  const dmgAtL5 = Math.round((fb.proj.base + 5*fb.proj.perLvl)*1);
  ok('fireball scales with level', dmgAtL5 > fb.proj.base);
}

console.log('=== crafting (reforge + upgrade) ===');
{
  const { reforge, upgrade, reforgeCost, upgradeCost, canUpgrade } = await import('../js/systems/craft.js');
  const { makeItem } = await import('../js/data/gear.js');
  const { RARITY_ORDER } = await import('../js/data/affixes.js');
  function mulberry32(seed){ return function(){ let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // reforge promotes a plain item to uncommon+ and rolls affixes
  const base = makeItem('sword_iron',1);
  const rf = reforge(base, mulberry32(3));
  ok('reforge produces a rarity', RARITY_ORDER.includes(rf.rarity));
  ok('reforge rolls affixes', Array.isArray(rf.affixes) && rf.affixes.length >= 1);
  ok('reforge keeps item id', rf.id === 'sword_iron');
  // upgrade raises rarity exactly one tier
  const common = makeItem('sword_iron',1); common.rarity='common'; common.affixes=[];
  const up = upgrade(common, mulberry32(5));
  eq('upgrade common -> uncommon', up.rarity, 'uncommon');
  const rare = makeItem('shield_iron',1); rare.rarity='rare'; rare.affixes=[];
  eq('upgrade rare -> epic', upgrade(rare, mulberry32(9)).rarity, 'epic');
  // legendary cannot upgrade
  const leg = makeItem('sword_iron',1); leg.rarity='legendary';
  ok('legendary canUpgrade false', canUpgrade(leg) === false);
  ok('upgrade legendary is a no-op tier', upgrade(leg).rarity === 'legendary');
  // consumables are not craftable
  ok('consumable not upgradable', canUpgrade(makeItem('potion',1)) === false);
  eq('consumable reforgeCost 0', reforgeCost(makeItem('potion',1)), 0);
  // costs are positive and scale with rarity
  ok('reforge cost positive', reforgeCost(makeItem('sword_iron',1)) > 0);
  const cLow = upgradeCost(common);
  const cHigh = upgradeCost(rare);
  ok('upgrade cost rises with rarity', cHigh > cLow);
  // accepts id-string equipment values too (equipment slots may store strings)
  ok('reforge accepts id string', reforge('sword_iron', mulberry32(1)).id === 'sword_iron');
}

console.log('=== stash + craft wiring ===');
{
  const { readFileSync } = await import('node:fs');
  const gameSrc = readFileSync(new URL('../js/systems/game.js', import.meta.url), 'utf8');
  ok('game has openStash', gameSrc.includes('openStash('));
  ok('game has toStash/fromStash', gameSrc.includes('toStash(') && gameSrc.includes('fromStash('));
  ok('game has reforgeItem/upgradeItem', gameSrc.includes('reforgeItem(') && gameSrc.includes('upgradeItem('));
  ok('game loads stash', gameSrc.includes('this.stash='));
  ok('game persists stash', gameSrc.includes('stash:this.stash'));
  const saveSrc = readFileSync(new URL('../js/systems/save.js', import.meta.url), 'utf8');
  ok('newGame seeds stash', saveSrc.includes('stash:[]'));
  const { MAPS } = await import('../js/data/maps.js');
  const cityNpcs = MAPS.city.npcs.map(n=>n.name);
  ok('city has a Banker', MAPS.city.npcs.some(n=>n.bank));
  ok('blacksmith has a Forge', MAPS.shop_black.npcs.some(n=>n.craft));
}

console.log('=== enemy-player collision + spawn safety ===');
{
  const { World, TILE } = await import('../js/systems/world.js');
  const { MAPS } = await import('../js/data/maps.js');
  // nearestOpen must return a walkable tile even when asked about a solid one
  const ids = Object.keys(MAPS);
  let checkedDungeon = false;
  for(const id of ids){
    const w = new World(id);
    // the outer border (0,0) is always a solid WALL -> must snap to open
    const sp = w.nearestOpen(TILE/2, TILE/2);
    ok('nearestOpen('+id+') returns non-solid', !w.isSolid(sp.x, sp.y));
    // every map's own portal landing tiles must resolve to open ground
    for(const p of (w.portals||[])){
      const o = w.nearestOpen(p.wx, p.wy);
      ok('portal tile open after snap ('+id+'->'+p.to+')', !w.isSolid(o.x,o.y));
    }
    if((MAPS[id].biome==='dungeon'||MAPS[id].biome==='cave') && !checkedDungeon){
      // dungeons fill solid then carve; centre of map may be rock -> still resolves
      const c = w.nearestOpen(w.w/2, w.h/2);
      ok('dungeon centre snaps to open ('+id+')', !w.isSolid(c.x,c.y));
      checkedDungeon = true;
    }
  }
  // enemy.js must wire solid-body collision against the player
  const { readFileSync } = await import('node:fs');
  const enemySrc = readFileSync(new URL('../js/entities/enemy.js', import.meta.url), 'utf8');
  ok('enemy defines _collidePlayer', enemySrc.includes('_collidePlayer('));
  ok('enemy calls collision each update', /this\._collidePlayer\(player,world\)/.test(enemySrc));
  ok('collision uses combined radii (this.r+player.r)', enemySrc.includes('this.r+player.r'));
  ok('collision is wall-aware (checks isSolid)', /_collidePlayer[\s\S]*?world\.isSolid/.test(enemySrc));
  // game.js must snap the player off solid tiles on load
  const gameSrc = readFileSync(new URL('../js/systems/game.js', import.meta.url), 'utf8');
  ok('loadMap snaps spawn via nearestOpen', gameSrc.includes('nearestOpen('));
}

console.log('=== elites + biome bosses ===');
{
  const { BOSSES } = await import('../js/entities/boss.js');
  const { MAPS } = await import('../js/data/maps.js');
  const { CATALOG } = await import('../js/data/gear.js');
  // one boss per overworld biome present
  const bossMaps = Object.values(BOSSES).map(b=>b.map);
  for(const m of ['meadow_glade','forest_deep','desert_ruins','cave','snow_glacier','swamp_depths','dungeon1','dungeon2']){
    ok('boss exists for '+m, bossMaps.includes(m));
  }
  // every boss targets a real map, has phases, and drops a real catalog item
  for(const id in BOSSES){
    const b=BOSSES[id];
    ok('boss '+id+' map exists', !!MAPS[b.map]);
    ok('boss '+id+' has phases', Array.isArray(b.phases) && b.phases.length>=1);
    ok('boss '+id+' drop in catalog', !!CATALOG[b.drop]);
    ok('boss '+id+' adds are valid', (b.adds||[]).every(a=>typeof a==='string'));
  }
  // distinct biomes covered (grass/forest/desert/cave/snow/swamp/dungeon)
  const biomes=new Set(Object.values(BOSSES).map(b=>MAPS[b.map].biome));
  ok('bosses span 6+ biomes', biomes.size>=6);

  // elite system wiring (source-level — Enemy needs canvas so we read the file)
  const { readFileSync } = await import('node:fs');
  const enemySrc = readFileSync(new URL('../js/entities/enemy.js', import.meta.url), 'utf8');
  ok('enemy exports rollEliteMod', enemySrc.includes('export function rollEliteMod'));
  ok('enemy has ELITE_MODS', enemySrc.includes('ELITE_MODS'));
  ok('constructor takes elite param', /constructor\(x,y,type='slime', levelScale=1, elite=null\)/.test(enemySrc));
  ok('elites buff hp/dmg', enemySrc.includes('levelScale*hpMul') && enemySrc.includes('levelScale*dmgMul'));
  ok('elites guarantee gear on death', /this\.elite[\s\S]*?game\.dropGear/.test(enemySrc));
  ok('elites draw an aura', enemySrc.includes('eliteMod.aura'));
  const gameSrc = readFileSync(new URL('../js/systems/game.js', import.meta.url), 'utf8');
  ok('game rolls elites on spawn', gameSrc.includes('rollEliteMod(') && gameSrc.includes('eliteChance'));
  ok('game snaps boss off solid tiles', /this\.boss\.x[\s\S]*?nearestOpen/.test(gameSrc));
  // rollEliteMod returns a known key deterministically
  const k = enemySrc.match(/ELITE_MODS = \{([\s\S]*?)\n\};/);
  ok('ELITE_MODS defines 4 mods', (k && (k[1].match(/\w+:\s*\{/g)||[]).length===4));
}


console.log('=== spell shop + teleport + shield + UI fixes ===');
{
  const { SPELLS, STARTER_SPELLS, knownSpells, spellRank } = await import('../js/data/spells.js');
  const { readFileSync } = await import('node:fs');
  const gs = readFileSync(new URL('../js/systems/game.js', import.meta.url), 'utf8');
  const ms = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const hs = readFileSync(new URL('../js/ui/hud.js', import.meta.url), 'utf8');
  const ps = readFileSync(new URL('../js/entities/player.js', import.meta.url), 'utf8');
  const ix = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const cs = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  ok('game has buySpell', gs.includes('buySpell('));
  ok('game has upgradeSpell', gs.includes('upgradeSpell('));
  ok('game has hasSpell', gs.includes('hasSpell('));
  ok('game has canTeleportTown', gs.includes('canTeleportTown'));
  ok('game has teleportToTown', gs.includes('teleportToTown'));
  ok('game persists boughtSpells', gs.includes('boughtSpells'));
  ok('all spells have learnCost', Object.values(SPELLS).every(s=>s.learnCost!==undefined));
  ok('all spells have upgradeCost', Object.values(SPELLS).every(s=>s.upgradeCost!==undefined));
  ok('fireball3 no upgrade', !SPELLS.fireball3.upgrade);
  ok('starter spells free', SPELLS.fireball.learnCost===0 && SPELLS.iceshard.learnCost===0 && SPELLS.spark.learnCost===0);
  ok('spellRank fireball', spellRank('fireball').rank===1);
  ok('spellRank fireball2', spellRank('fireball2').base==='fireball' && spellRank('fireball2').rank===2);
  ok('spellRank meteor3', spellRank('meteor3').rank===3);
  ok('T key teleport', ms.includes("k==='t'"));
  ok('town-btn in HTML', ix.includes('town-btn'));
  ok('tooltip z-index 200', cs.includes('z-index:200'));
  ok('modal-box overflow visible', cs.includes('overflow:visible'));
  ok('shield block 1.8 rad', ps.includes('facingDiff<1.8'));
  ok('refresh() calls refreshQuests', /refresh\(\)[\s\S]*refreshQuests/.test(hs));
  ok('shop has spell section', ix.includes('shop-spells'));
}

console.log('=== login + per-user saves ===');
{
  const { readFileSync } = await import('node:fs');
  const mainSrc = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const saveSrc = readFileSync(new URL('../js/systems/save.js', import.meta.url), 'utf8');
  const gameSrc = readFileSync(new URL('../js/systems/game.js', import.meta.url), 'utf8');
  const idxSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ok('login-screen in HTML', idxSrc.includes('login-screen'));
  ok('login-btn in HTML', idxSrc.includes('login-btn'));
  ok('login-user input in HTML', idxSrc.includes('login-user'));
  ok('login-pass input in HTML', idxSrc.includes('login-pass'));
  ok('logout-btn in settings', idxSrc.includes('logout-btn'));
  ok('login handler uses addEventListener', mainSrc.includes("getElementById('login-btn').addEventListener"));
  ok('renderSlotsWithAuth defined', mainSrc.includes('function renderSlotsWithAuth'));
  ok('SaveSystem.saveUser', saveSrc.includes('saveUser') || mainSrc.includes('SaveSystem.saveUser'));
  ok('SaveSystem.listSlotsUser', mainSrc.includes('listSlotsUser'));
  ok('game._username stored', gameSrc.includes('this._username'));
  ok('save uses per-user', gameSrc.includes('SaveSystem.saveUser'));
  ok('autosave uses per-user', gameSrc.includes('SaveSystem.saveUser'));
  const ts2 = readFileSync(new URL('../js/systems/turso.js', import.meta.url), 'utf8');
  ok('turso uses window config', ts2.includes('window.__TURSO_CONFIG'));
}

console.log('=== weapon slash animations ===');
{
  const { readFileSync } = await import('node:fs');
  const ps = readFileSync(new URL('../js/entities/player.js', import.meta.url), 'utf8');
  ok('player has weaponKind', ps.includes('this.weaponKind'));
  ok('dagger slash branch', ps.includes("wk==='dagger'"));
  ok('spear slash branch', ps.includes("wk==='spear'"));
  ok('greatsword slash branch', ps.includes("wk==='greatsword'"));
  ok('warhammer slash branch', ps.includes("wk==='warhammer'"));
  ok('ranged aim line', ps.includes("wk==='ranged'"));
  ok('shield block improved', ps.includes('#7a8090') && ps.includes('block sparkle'));
  ok('shield rim highlight', ps.includes('#c0c8d8'));
}

console.log('=== map button (minimap removed) ===');
{
  const { readFileSync } = await import('node:fs');
  const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const hud = readFileSync(new URL('../js/ui/hud.js', import.meta.url), 'utf8');
  ok('minimap canvas removed', !idx.includes('id="minimap"'));
  ok('map-btn present', idx.includes('id="map-btn"'));
  ok('map-btn handler in main.js', main.includes('map-btn'));
  ok('drawMinimap is no-op', hud.includes('drawMinimap(){}'));
  ok('no MINIMAP setting', !idx.includes('MINIMAP'));
}

console.log('=== turso module ===');
{
  const { readFileSync } = await import('node:fs');
  const ts = readFileSync(new URL('../js/systems/turso.js', import.meta.url), 'utf8');
  ok('tursoSave export', ts.includes('export async function tursoSave'));
  ok('tursoLoad export', ts.includes('export async function tursoLoad'));
  ok('tursoListSlots export', ts.includes('export async function tursoListSlots'));
  ok('tursoInit export', ts.includes('export async function tursoInit'));
  ok('tursoDelete export', ts.includes('export async function tursoDelete'));
  ok('uses Turso HTTP API', ts.includes('/v2/pipeline'));
  ok('fetch-based HTTP client', ts.includes('fetch('));
}

console.log('\n' + (fail === 0 ? '✅ ALL PASS' : '❌ FAILURES') + ` — ${pass} passed, ${fail} failed`);
if(fail > 0){ console.log('Failed: ' + fails.join('; ')); process.exit(1); }
