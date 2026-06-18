// Quest manager: tracks active/completed quests and their objective progress.
// State shape (saved): { active:{id:{prog:[n,...]}}, done:{id:true} }
import { QUESTS, questsForGiver } from '../data/quests.js';
import { makeItem } from '../data/gear.js';

/**
 * @typedef {import('../data/quests.js').Quest} Quest
 * @typedef {import('../data/quests.js').QuestObjective} QuestObjective
 *
 * @typedef {Object} QuestActiveState
 * @property {number[]} prog  - per-objective progress counter
 *
 * @typedef {Object} QuestGiverState
 * @property {string[]} available
 * @property {string[]} turnIn
 * @property {string[]} inProgress
 *
 * @typedef {Object} QuestListLine
 * @property {string}  text
 * @property {number}  have
 * @property {number}  need
 * @property {boolean} done
 *
 * @typedef {Object} QuestListEntry
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {boolean} complete
 * @property {QuestListLine[]} lines
 *
 * @typedef {Object} QuestLogState
 * QuestLog instance state.
 * @property {any} game
 * @property {Record<string, QuestActiveState>} active
 * @property {Record<string, true>} done
 * @property {Record<string, true>|undefined} _announced
 */

export class QuestLog {
  /**
   * @param {any} game
   * @param {{quests?: {active?: Record<string, QuestActiveState>, done?: Record<string, true>}}} [state]
   */
  constructor(game, state){
    this.game = game;
    const q = (state && state.quests) || {};
    this.active = q.active || {};   // id -> {prog:[counts]}
    this.done   = q.done   || {};   // id -> true
  }
  /** @returns {{active: Record<string, QuestActiveState>, done: Record<string, true>}} */
  serialize(){ return { active:this.active, done:this.done }; }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isActive(id){ return !!this.active[id]; }
  /**
   * @param {string} id
   * @returns {boolean}
   */
  isDone(id){ return !!this.done[id]; }

  // What this NPC currently offers: returns {available:[ids], turnIn:[ids], inProgress:[ids]}
  /**
   * @param {string} name
   * @returns {QuestGiverState}
   */
  giverState(name){
    const out = { available:[], turnIn:[], inProgress:[] };
    for(const id of questsForGiver(name)){
      if(this.done[id]) continue;
      if(this.active[id]){
        if(this._complete(id)) out.turnIn.push(id); else out.inProgress.push(id);
      } else if(this._prereqMet(id)){
        out.available.push(id);
      }
    }
    return out;
  }
  /**
   * @private
   * @param {string} id
   * @returns {boolean}
   */
  _prereqMet(id){
    // a quest with a `next` is unlocked only after its predecessor; find any quest whose next===id
    for(const pid in QUESTS){ if(QUESTS[pid].next === id) return !!this.done[pid]; }
    return true;
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  accept(id){
    const q = QUESTS[id]; if(!q || this.active[id] || this.done[id]) return;
    this.active[id] = { prog: q.objectives.map(()=>0) };
    this.game.toast('Quest accepted: ' + q.name);
    this.game.sfx('open');
    // collect objectives: seed from current inventory
    this._syncCollect(id);
  }

  /**
   * @private
   * @param {string} id
   * @returns {boolean}
   */
  _complete(id){
    const q = QUESTS[id], st = this.active[id]; if(!q || !st) return false;
    return q.objectives.every((o, i) => st.prog[i] >= this._target(o));
  }
  /**
   * @private
   * @param {QuestObjective} o
   * @returns {number}
   */
  _target(o){ return o.count || 1; }

  // ---- event hooks (called by Game) ----
  /**
   * @param {string} enemyType
   * @param {boolean} isBoss
   * @param {string} [bossId]
   * @returns {void}
   */
  onKill(enemyType, isBoss, bossId){
    for(const id in this.active){
      const q = QUESTS[id]; const st = this.active[id];
      q.objectives.forEach((o, i) => {
        if(o.kind === 'kill' && (o.enemy === 'any' || o.enemy === enemyType)) st.prog[i]++;
        if(o.kind === 'boss' && isBoss && o.boss === bossId) st.prog[i] = 1;
      });
    }
    this._notify();
  }
  /**
   * @param {string} mapId
   * @returns {void}
   */
  onReach(mapId){
    for(const id in this.active){
      const q = QUESTS[id]; const st = this.active[id];
      q.objectives.forEach((o, i) => { if(o.kind === 'reach' && o.map === mapId) st.prog[i] = 1; });
    }
    this._notify();
  }
  /** @returns {void} */
  onPickup(){ for(const id in this.active) this._syncCollect(id); this._notify(); }
  /**
   * @param {string} mapId
   * @returns {void}
   */
  onEscort(mapId){
    for(const id in this.active){
      const q = QUESTS[id], st = this.active[id];
      q.objectives.forEach((o, i) => { if(o.kind === 'escort' && o.to === mapId) st.prog[i] = 1; });
    }
    this._notify();
  }
  /**
   * @param {string} mapId
   * @returns {void}
   */
  onTimedClear(mapId){
    for(const id in this.active){
      const q = QUESTS[id], st = this.active[id];
      q.objectives.forEach((o, i) => { if(o.kind === 'timed_clear' && o.map === mapId) st.prog[i] = 1; });
    }
    this._notify();
  }
  /**
   * @param {string} mapId
   * @returns {void}
   */
  onSurvive(mapId){
    for(const id in this.active){
      const q = QUESTS[id], st = this.active[id];
      q.objectives.forEach((o, i) => { if(o.kind === 'survive' && o.map === mapId) st.prog[i] = 1; });
    }
    this._notify();
  }
  /**
   * @private
   * @param {string} id
   * @returns {void}
   */
  _syncCollect(id){
    const q = QUESTS[id], st = this.active[id]; if(!st) return;
    q.objectives.forEach((o, i) => {
      if(o.kind === 'collect'){
        const inv = this.game.inventory.find(x => x.id === o.item);
        st.prog[i] = inv ? (inv.qty || 1) : 0;
      }
    });
  }
  /** @private @returns {void} */
  _notify(){
    // surface freshly-completed quests as a turn-in hint
    for(const id in this.active){
      if(this._complete(id) && !this._announced?.[id]){
        (this._announced = this._announced || {})[id] = true;
        this.game.toast('Quest ready to turn in: ' + QUESTS[id].name);
      }
    }
    if(this.game.hud && this.game.hud.refreshQuests) this.game.hud.refreshQuests();
  }

  /**
   * @param {string} id
   * @returns {boolean} true if the quest was turned in
   */
  turnIn(id){
    if(!this._complete(id)) return false;
    const q = QUESTS[id];
    delete this.active[id]; this.done[id] = true;
    const r = q.reward || {};
    if(r.xp) this.game.player.gainXp(r.xp, this.game);
    if(r.gold){ const a = this.game.player.gainGold(r.gold, this.game); this.game.floater('+'+a+'g', this.game.player.x, this.game.player.y-30, '#ffcf4d'); }
    (r.items || []).forEach(it => this.game.addItem(makeItem(it.id, it.qty)));
    this.game.toast('Quest complete: ' + q.name + '!');
    this.game.sfx('levelup');
    if(this.game.achievements){
      this.game.achievements.onQuestComplete();
      const kind = (q.objectives && q.objectives[0] && q.objectives[0].kind) || '';
      if(kind === 'escort') this.game.achievements.onEscortComplete();
      else if(kind === 'survive') this.game.achievements.onSurviveComplete();
      else if(kind === 'timed_clear') this.game.achievements.onTimedClearComplete();
    }
    this._notify();
    return true;
  }

  // for UI: list of {id, name, desc, lines:[{text, have, need, done}], complete}
  /** @returns {QuestListEntry[]} */
  activeList(){
    return Object.keys(this.active).map(id => {
      const q = QUESTS[id], st = this.active[id];
      return {
        id, name:q.name, desc:q.desc, complete:this._complete(id),
        lines: q.objectives.map((o, i) => ({
          text:o.text, have:Math.min(st.prog[i], this._target(o)),
          need:this._target(o), done: st.prog[i] >= this._target(o),
        })),
      };
    });
  }
}
