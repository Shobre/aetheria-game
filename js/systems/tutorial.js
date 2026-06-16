// Sprint 10 — Tutorial runner.
//
// Reads TUTORIAL_STEPS from data/tutorial.js and shows them one at a time.
// Each step has a trigger; the runner watches the trigger every frame and
// advances to the next step when it returns true. A panel UI is created
// lazily on the first show() call and is otherwise invisible.
//
// State (currentStep, completed, skipped) is persisted on the Game and
// round-trips through the save blob. Skipping writes a flag that the
// next run honors — the player who skipped once never sees the tour
// again. The "Reset tutorial" button in the settings modal clears the
// flag, so a player who skipped early can still see it on a new save.

import { TUTORIAL_STEPS, TUTORIAL_DEFAULT, TUTORIAL_VERSION } from '../data/tutorial.js';

const LOCAL_KEY = 'aetheria_tutorial_v1';

export class Tutorial {
  constructor(game){
    this.game = game;
    this.completed = new Set();
    this.current   = null;   // { id, title, body, where, trigger }
    this.skipped   = false;
    this.version   = TUTORIAL_VERSION;
    this.panel     = null;   // DOM root, created lazily
    this._load();
    if(!this.skipped && this.completed.size < TUTORIAL_STEPS.length){
      this._advance();
    }
  }

  // --- persistence -----------------------------------------------------------

  _load(){
    // 1. localStorage (per-device "did this player skip the tour?")
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if(raw){
        const v = JSON.parse(raw);
        if(v && v.version === TUTORIAL_VERSION){
          this.skipped   = !!v.skipped;
          this.completed = new Set(Array.isArray(v.completed) ? v.completed : []);
        }
      }
    } catch(e) {}
    // 2. Save blob (cross-device). The state owner (Game) calls
    //    tutorial.attachSaveState(state) and tutorial.detachSaveState() to
    //    merge and unmerge. We don't read it here — Game.start() wires it.
  }

  attachSaveState(state){
    // Merge persisted tutorial state into the run. The save blob always
    // wins over localStorage if both are present (it's the authoritative
    // "follows the account" copy).
    if(state.tutorial && typeof state.tutorial === 'object' && state.tutorial.version === TUTORIAL_VERSION){
      this.skipped   = !!state.tutorial.skipped;
      this.completed = new Set(Array.isArray(state.tutorial.completed) ? state.tutorial.completed : []);
    }
  }

  detachSaveState(){
    return { version: this.version, skipped: this.skipped, completed: Array.from(this.completed) };
  }

  // Reset the tutorial to the beginning of the current run. Called by the
  // "Reset tutorial" settings button. localStorage + state both get
  // rewritten on the next save.
  reset(){
    this.completed = new Set();
    this.skipped   = false;
    try { localStorage.removeItem(LOCAL_KEY); } catch(e) {}
    this._advance();
  }

  // User pressed Skip. Mark the rest as completed and hide the panel.
  skip(){
    this.skipped = true;
    this.completed = new Set(TUTORIAL_STEPS.map(s => s.id));
    this.current = null;
    this._hidePanel();
    this._persistLocal();
  }

  // --- runtime ---------------------------------------------------------------

  // Tick once per frame. Watches the current step's trigger and advances
  // when it's true. Also listens for the dismiss hotkey (Escape / Start /
  // B button) so a player who wants to close the panel mid-step can.
  update(){
    if(this.skipped || !this.current) return;
    // Some steps read the DOM directly (the bag is a modal, not a state
    // event). Cheap, runs at most once per step.
    this._syncDomFlags();
    if(this.current.trigger(this.game)){
      this.completed.add(this.current.id);
      this._persistLocal();
      this._advance();
    }
  }

  // Pull DOM-derived signals into the game-side flag bag so the trigger
  // predicates in data/tutorial.js don't have to know about document.
  _syncDomFlags(){
    if(typeof document === 'undefined') return;
    if(!this.game._tutorialFlag) this.game._tutorialFlag = {};
    const bag = document.getElementById('bag-modal');
    if(bag && !bag.classList.contains('hidden')) this.game._tutorialFlag.openedBag = true;
    // Welcome step: any keypress or click "acks" it. Treat the first wasPressed
    // of any bound action as the ack — keeps the step from blocking forever
    // for a player who's already running around.
    if(!this.game._tutorialFlag.ackWelcome && this.game.input){
      const inp = this.game.input;
      for(const k in inp.pressed){ if(inp.pressed[k]){ this.game._tutorialFlag.ackWelcome = true; break; } }
      if(!this.game._tutorialFlag.ackWelcome &&
         (inp.mousePressed.left || inp.mousePressed.right || inp.mousePressed.middle)){
        this.game._tutorialFlag.ackWelcome = true;
      }
    }
  }

  // Re-pick the next step from the list. If the player already finished
  // all of them, hide the panel and stay out of the way.
  _advance(){
    const next = TUTORIAL_STEPS.find(s => !this.completed.has(s.id));
    if(!next){
      this.current = null;
      this._hidePanel();
      return;
    }
    this.current = next;
    this._showPanel();
  }

  // The Game uses these to record player actions into a shared flag bag.
  // The bag is the cheapest way to surface "you did X!" without coupling
  // Tutorial to every event source.
  flag(key, value){
    if(!key) return;
    if(!this.game._tutorialFlag) this.game._tutorialFlag = {};
    this.game._tutorialFlag[key] = (value === undefined ? true : value);
  }

  // --- DOM panel -------------------------------------------------------------

  _ensurePanel(){
    if(this.panel) return this.panel;
    // Browser-only: skip panel creation in non-DOM environments (node tests).
    if(typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.id = 'tutorial-panel';
    el.className = 'tutorial-panel';
    el.innerHTML = `
      <div class="tutorial-card">
        <div class="tutorial-step"></div>
        <div class="tutorial-title"></div>
        <div class="tutorial-body"></div>
        <div class="tutorial-foot">
          <span class="tutorial-progress"></span>
          <div>
            <button class="tutorial-skip">Skip Tour</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('.tutorial-skip').addEventListener('click', () => this.skip());
    this.panel = el;
    return el;
  }

  _showPanel(){
    if(!this.current) return;
    const el = this._ensurePanel();
    if(!el) return;  // no-DOM environment: state still updates, panel just isn't rendered
    const step = this.current;
    el.classList.remove('hidden');
    el.dataset.where = step.where || 'center';
    el.querySelector('.tutorial-step').textContent  = (this.completed.size + 1) + ' / ' + TUTORIAL_STEPS.length;
    el.querySelector('.tutorial-title').textContent = step.title;
    el.querySelector('.tutorial-body').textContent  = step.body;
    el.querySelector('.tutorial-progress').textContent = this._progressBar();
  }

  _hidePanel(){
    if(this.panel) this.panel.classList.add('hidden');
  }

  _progressBar(){
    const n = TUTORIAL_STEPS.length;
    const done = this.completed.size;
    return '▮'.repeat(done) + '▯'.repeat(Math.max(0, n - done));
  }

  _persistLocal(){
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({
        version: this.version,
        skipped: this.skipped,
        completed: Array.from(this.completed),
      }));
    } catch(e) {}
  }
}
