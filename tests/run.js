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

console.log('\n' + (fail === 0 ? '✅ ALL PASS' : '❌ FAILURES') + ` — ${pass} passed, ${fail} failed`);
if(fail > 0){ console.log('Failed: ' + fails.join('; ')); process.exit(1); }
