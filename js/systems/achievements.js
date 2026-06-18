// Achievement tracker — watches game events, increments progress, and fires
// unlocks. Decoupled from the game object: the caller (game.js) wires
// `tracker.on('kill', enemy)` etc. internally so we don't need a pub/sub.
//
// Stats are kept as a flat numeric dict (kills, bosses, parries, ...). Each
// achievement has a `stat` field that names which counter feeds it. The
// tracker walks ACHIEVEMENTS on every stat update and unlocks any that
// cross their goal (or whose trigger returns true).
//
// Persisted shape: { unlocked:{id:true}, stats:{...}, notified:{id:true} }.
// `notified` lets us show the toast exactly once per save load even if the
// achievement was unlocked in a prior session.

import { ACHIEVEMENTS } from '../data/achievements.js';

/**
 * @typedef {import('../data/achievements.js').AchievementDef} AchievementDef
 *
 * @typedef {Object} AchievementStats
 * @property {number} kills
 * @property {number} bosses
 * @property {number} elites
 * @property {number} parries
 * @property {number} noDmgBoss
 * @property {number} portals
 * @property {Record<string, number>} maps
 * @property {number} chests
 * @property {number} gold
 * @property {number} topAffixCount
 * @property {number} legendary
 * @property {number} potionsDrank
 * @property {number} quests
 * @property {number} escorts
 * @property {number} survives
 * @property {number} timedClears
 * @property {number} goldSpent
 * @property {number} enchants
 * @property {number} recruited
 * @property {number} skillBranches
 * @property {number} level
 *
 * @typedef {Object} AchievementSerialized
 * @property {Record<string, true>} unlocked
 * @property {AchievementStats} stats
 * @property {Record<string, true>} notified
 *
 * @typedef {Object} AchievementTrackerState
 * @property {any} game
 * @property {Record<string, true>} unlocked
 * @property {Record<string, true>} notified
 * @property {AchievementStats} stats
 * @property {boolean} _noDmgPending
 * @property {boolean} _noDmgTookHit
 */

export class AchievementTracker {
  /**
   * @param {any} game
   */
  constructor(game){
    this.game = game;
    this.unlocked = {};   // id -> true
    this.notified = {};   // id -> true (toast already shown this session)
    this.stats = {
      kills: 0, bosses: 0, elites: 0, parries: 0, noDmgBoss: 0,
      portals: 0, maps: {}, chests: 0, gold: 0, topAffixCount: 0,
      legendary: 0, potionsDrank: 0, quests: 0, escorts: 0,
      survives: 0, timedClears: 0, goldSpent: 0, enchants: 0,
      recruited: 0, skillBranches: 0, level: 0,
    };
    this._noDmgPending = false;   // true while in a boss fight
    this._noDmgTookHit = false;    // any hit taken during current boss fight
  }

  // ----- persistence -----
  /** @returns {AchievementSerialized} */
  serialize(){
    return { unlocked:{...this.unlocked}, stats:{...this.stats, maps:{...this.stats.maps}}, notified:{...this.notified} };
  }
  /**
   * @param {Partial<AchievementSerialized>|null|undefined} data
   * @returns {void}
   */
  load(data){
    if(!data) return;
    if(data.unlocked) this.unlocked = {...data.unlocked};
    if(data.stats){
      this.stats = {...this.stats, ...data.stats};
      if(data.stats.maps) this.stats.maps = {...data.stats.maps};
    }
    // already-notified: re-notify anything unlocked in a previous session so
    // the user sees their progress at least once on this machine
    if(data.notified) this.notified = {...data.notified};
  }

  // ----- event hooks (called by game.js) -----
  /**
   * @param {{elite?: boolean}} e
   * @returns {void}
   */
  onEnemyKilled(e){
    this.stats.kills++;
    if(e.elite) this.stats.elites++;
    this._check('kill');
    // No-damage-boss tracking: regular kills don't matter
  }
  /** @returns {void} */
  onBossFightStart(){
    this._noDmgPending = true;
    this._noDmgTookHit = false;
  }
  /** @returns {void} */
  onPlayerHit(){
    if(this._noDmgPending) this._noDmgTookHit = true;
  }
  /** @returns {void} */
  onBossDefeated(){
    this.stats.bosses++;
    if(this._noDmgPending && !this._noDmgTookHit) this.stats.noDmgBoss++;
    this._noDmgPending = false;
    this._check('boss');
  }
  /** @returns {void} */
  onPortal(){
    this.stats.portals++;
    this._check('portal');
  }
  /**
   * @param {string} mapId
   * @returns {void}
   */
  onMapEnter(mapId){
    this.stats.maps[mapId] = (this.stats.maps[mapId]||0) + 1;
    // unique map count
    this._check('map');
  }
  /** @returns {void} */
  onChestOpened(){
    this.stats.chests++;
    this._check('chest');
  }
  /** @returns {void} */
  onParry(){
    this.stats.parries++;
    this._check('parry');
  }
  /**
   * @param {number} level
   * @returns {void}
   */
  onLevelUp(level){
    this.stats.level = Math.max(this.stats.level||0, level);
    this._check('level');
  }
  /**
   * @param {number} amount
   * @returns {void}
   */
  onGoldHeld(amount){
    // achievement is "hold X at once" — update to current amount
    this.stats.gold = amount;
    this._check('gold');
  }
  /**
   * @param {number} n
   * @returns {void}
   */
  onAffixCount(n){
    this.stats.topAffixCount = Math.max(this.stats.topAffixCount||0, n);
    this._check('affix');
  }
  /** @returns {void} */
  onLegendaryFound(){
    this.stats.legendary = (this.stats.legendary||0) + 1;
    this._check('legendary');
  }
  /** @returns {void} */
  onPotionDrank(){
    this.stats.potionsDrank = (this.stats.potionsDrank||0) + 1;
    this._check('potion');
  }
  /** @returns {void} */
  onQuestComplete(){
    this.stats.quests = (this.stats.quests||0) + 1;
    this._check('quest');
  }
  /** @returns {void} */
  onEscortComplete(){ this.stats.escorts = (this.stats.escorts||0)+1; this._check('escort'); }
  /** @returns {void} */
  onSurviveComplete(){ this.stats.survives = (this.stats.survives||0)+1; this._check('survive'); }
  /** @returns {void} */
  onTimedClearComplete(){ this.stats.timedClears = (this.stats.timedClears||0)+1; this._check('timed'); }
  /**
   * @param {number} amt
   * @returns {void}
   */
  onGoldSpent(amt){ this.stats.goldSpent = (this.stats.goldSpent||0) + amt; this._check('spend'); }
  /** @returns {void} */
  onEnchant(){ this.stats.enchants = (this.stats.enchants||0)+1; this._check('enchant'); }
  /** @returns {void} */
  onRecruited(){ this.stats.recruited = (this.stats.recruited||0)+1; this._check('recruit'); }
  /**
   * @param {number} n
   * @returns {void}
   */
  onSkillBranches(n){
    this.stats.skillBranches = Math.max(this.stats.skillBranches||0, n);
    this._check('branches');
  }

  // ----- core check -----
  // For each achievement whose `stat` matches the event key, see if the
  // goal is met (or, for compound stats, evaluate the trigger closure).
  /**
   * @private
   * @param {string} eventKey
   * @returns {void}
   */
  _check(eventKey){
    const g = this.game;
    const newlyUnlocked = [];
    for(const id in ACHIEVEMENTS){
      if(this.unlocked[id]) continue;
      const a = ACHIEVEMENTS[id];
      let met = false;
      if(a.stat === 'maps' && eventKey === 'map'){
        const visited = Object.keys(this.stats.maps).filter(k => this.stats.maps[k] > 0).length;
        met = visited >= a.goal;
      } else if(a.stat === 'noDmgBoss' && eventKey === 'boss'){
        met = this.stats.noDmgBoss >= a.goal;
      } else if(a.stat === 'topAffixCount' && eventKey === 'affix'){
        met = (this.stats.topAffixCount||0) >= a.goal;
      } else if(a.stat === 'gold' && eventKey === 'gold'){
        met = (this.stats.gold||0) >= a.goal;
      } else if(a.stat === 'level' && eventKey === 'level'){
        met = (this.stats.level||0) >= a.goal;
      } else if(a.stat && this.stats[a.stat] != null && a.goal != null){
        met = this.stats[a.stat] >= a.goal;
      }
      if(met){
        this.unlocked[id] = true;
        newlyUnlocked.push(a);
      }
    }
    if(newlyUnlocked.length && g && g._achievementUnlocked){
      for(const a of newlyUnlocked) g._achievementUnlocked(a);
    }
  }
}
