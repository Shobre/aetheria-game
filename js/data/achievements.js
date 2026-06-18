// Achievement definitions. Each achievement has a unique id, a category
// (combat / exploration / collection / quests / secrets), a name, description,
// icon, and a "goal" — a numeric threshold or a special `trigger` callback.
//
// Progress is reported in `progress.now` (0..goal) and `progress.done` (bool).
// `trigger` is an optional function (game, eventName, payload) -> bool|null that
// overrides the default threshold check (e.g. for compound achievements).
//
// Icons are canvas-drawn sprite icons or single Unicode chars. Combat / quest
// achievements use the ⚔ ✦ ★ ❖ ⚜ ⚐ ⚑ glyphs; collection uses ♥ ☀ ★;
// exploration uses ✦; secrets use a unique symbol.

/**
 * @typedef {'combat'|'exploration'|'collection'|'quests'|'secrets'} AchievementCat
 *
 * @typedef {Object} AchievementDef
 * @property {AchievementCat} cat
 * @property {string}         name
 * @property {string}         icon   - single Unicode char
 * @property {string}         desc
 * @property {number}         [goal] - threshold for completion
 * @property {string}         [stat] - which player stat to track
 * @property {boolean}        [secret]
 */

/** @type {Record<string, AchievementDef>} */
export const ACHIEVEMENTS = {
  // ---------------- COMBAT ----------------
  first_blood: {
    cat: 'combat', name: 'First Blood', icon: '⚔',
    desc: 'Slay your first enemy.', goal: 1, stat: 'kills',
  },
  slayer_10: {
    cat: 'combat', name: 'Slayer', icon: '⚔',
    desc: 'Slay 10 enemies.', goal: 10, stat: 'kills',
  },
  slayer_100: {
    cat: 'combat', name: 'Centurion', icon: '⚔',
    desc: 'Slay 100 enemies.', goal: 100, stat: 'kills',
  },
  slayer_1000: {
    cat: 'combat', name: 'Reaper', icon: '✦',
    desc: 'Slay 1000 enemies.', goal: 1000, stat: 'kills',
  },
  first_boss: {
    cat: 'combat', name: 'Boss Slayer', icon: '★',
    desc: 'Defeat your first biome boss.', goal: 1, stat: 'bosses',
  },
  boss_4: {
    cat: 'combat', name: 'Champion of the Realm', icon: '★',
    desc: 'Defeat 4 biome bosses.', goal: 4, stat: 'bosses',
  },
  boss_all: {
    cat: 'combat', name: 'Eternal Victor', icon: '✦',
    desc: 'Defeat every biome boss.', goal: 8, stat: 'bosses',
  },
  elite_killer: {
    cat: 'combat', name: 'Elite Hunter', icon: '✦',
    desc: 'Slay 5 elite (champion) enemies.', goal: 5, stat: 'elites',
  },
  no_damage_boss: {
    cat: 'combat', name: 'Untouchable', icon: '❖',
    desc: 'Defeat a boss without taking damage.', goal: 1, stat: 'noDmgBoss',
    secret: true,
  },
  level_10: {
    cat: 'combat', name: 'Adventurer', icon: '★',
    desc: 'Reach character level 10.', goal: 10, stat: 'level',
  },
  level_25: {
    cat: 'combat', name: 'Hero', icon: '★',
    desc: 'Reach character level 25.', goal: 25, stat: 'level',
  },
  parry_master: {
    cat: 'combat', name: 'Perfect Parry', icon: '❖',
    desc: 'Land 25 perfect parries.', goal: 25, stat: 'parries',
  },
  // ---------------- EXPLORATION ----------------
  first_portal: {
    cat: 'exploration', name: 'Worldwalker', icon: '✦',
    desc: 'Use your first portal.', goal: 1, stat: 'portals',
  },
  visit_4: {
    cat: 'exploration', name: 'Cartographer', icon: '✦',
    desc: 'Visit 4 distinct areas.', goal: 4, stat: 'maps',
  },
  visit_all: {
    cat: 'exploration', name: 'World Atlas', icon: '✦',
    desc: 'Visit every area in the realm.', goal: 11, stat: 'maps',
    secret: true,
  },
  chest_10: {
    cat: 'exploration', name: 'Treasure Hunter', icon: '✦',
    desc: 'Open 10 chests.', goal: 10, stat: 'chests',
  },
  chest_50: {
    cat: 'exploration', name: 'Master Looter', icon: '✦',
    desc: 'Open 50 chests.', goal: 50, stat: 'chests',
  },
  // ---------------- COLLECTION ----------------
  gold_500: {
    cat: 'collection', name: 'Coin Collector', icon: '☀',
    desc: 'Hold 500 gold at once.', goal: 500, stat: 'gold',
  },
  gold_5000: {
    cat: 'collection', name: 'Minted in Gold', icon: '☀',
    desc: 'Hold 5000 gold at once.', goal: 5000, stat: 'gold',
  },
  affix_5: {
    cat: 'collection', name: 'Magic Aficionado', icon: '✦',
    desc: 'Equip a weapon with 5 affixes.', goal: 5, stat: 'topAffixCount',
  },
  legendary: {
    cat: 'collection', name: 'Touched by the Gods', icon: '★',
    desc: 'Find a legendary item.', goal: 1, stat: 'legendary',
  },
  potions_20: {
    cat: 'collection', name: 'Apothecary', icon: '♥',
    desc: 'Drink 20 healing potions.', goal: 20, stat: 'potionsDrank',
  },
  // ---------------- QUESTS ----------------
  first_quest: {
    cat: 'quests', name: 'Adventurer\u2019s Start', icon: '⚜',
    desc: 'Complete your first quest.', goal: 1, stat: 'quests',
  },
  quest_5: {
    cat: 'quests', name: 'Questing Knight', icon: '⚜',
    desc: 'Complete 5 quests.', goal: 5, stat: 'quests',
  },
  quest_15: {
    cat: 'quests', name: 'Legendary Hero', icon: '⚜',
    desc: 'Complete 15 quests.', goal: 15, stat: 'quests',
  },
  escort: {
    cat: 'quests', name: 'Guardian', icon: '⚐',
    desc: 'Complete an escort quest.', goal: 1, stat: 'escorts',
  },
  survive: {
    cat: 'quests', name: 'Survivor', icon: '⚐',
    desc: 'Complete a survive quest.', goal: 1, stat: 'survives',
  },
  timed_clear: {
    cat: 'quests', name: 'Against the Clock', icon: '⚑',
    desc: 'Complete a timed clear quest.', goal: 1, stat: 'timedClears',
  },
  // ---------------- SECRETS ----------------
  spend_1000_gold: {
    cat: 'secrets', name: 'Big Spender', icon: '☀',
    desc: 'Spend 1000 gold total at shops.', goal: 1000, stat: 'goldSpent',
    secret: true,
  },
  fully_enchanted: {
    cat: 'secrets', name: 'Arcane Master', icon: '★',
    desc: 'Enchant a weapon at the anvil.', goal: 1, stat: 'enchants',
    secret: true,
  },
  recruit_companion: {
    cat: 'secrets', name: 'Party Up', icon: '✦',
    desc: 'Recruit a companion.', goal: 1, stat: 'recruited',
    secret: true,
  },
  all_skills: {
    cat: 'secrets', name: 'Skill Cap', icon: '★',
    desc: 'Unlock every skill tree branch.', goal: 3, stat: 'skillBranches',
    secret: true,
  },
};

/**
 * @typedef {Object} AchievementCatMeta
 * @property {AchievementCat} id
 * @property {string}         name
 * @property {string}         color
 */

/** @type {AchievementCatMeta[]} */
export const ACHIEVEMENT_CATS = [
  { id: 'combat',      name: 'Combat',      color: '#ff7a5a' },
  { id: 'exploration', name: 'Exploration', color: '#7ad8a0' },
  { id: 'collection',  name: 'Collection',  color: '#ffcf4d' },
  { id: 'quests',      name: 'Quests',      color: '#b89aff' },
  { id: 'secrets',     name: 'Secrets',     color: '#5ad8ff' },
];

// Total unlocked + total = quick stats
/**
 * @param {Record<string, boolean|number>|null|undefined} unlockedMap
 * @returns {{done: number, total: number}}
 */
export function achievementStats(unlockedMap){
  const ids = Object.keys(ACHIEVEMENTS);
  const total = ids.length;
  let done = 0;
  for(const id of ids) if(unlockedMap && unlockedMap[id]) done++;
  return { done, total };
}
