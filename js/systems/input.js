// Input system: keyboard + mouse, exposes a clean state object.
// Sprint 7: action-based bindings. Callers use wasPressed(actionId) instead
// of wasPressed('q') so a rebind in Settings actually works.
import { DEFAULT_BIND, normalizeKey, mouseKey } from '../data/keybinds.js';

/**
 * @typedef {Record<string, string>} BindingsMap
 *   action id -> bound key (lowercased; 'mouse1'/'mouse2'/'mouse3' for buttons)
 *
 * @typedef {Record<string, boolean>} KeyState
 *
 * @typedef {{left:boolean, right:boolean, middle:boolean}} MouseButtonState
 *
 * @typedef {{x:number, y:number, worldX:number, worldY:number}} MousePos
 *
 * @typedef {Object} InputState
 * Input instance state.
 * @property {HTMLCanvasElement} canvas
 * @property {KeyState}    keys     - currently held keys (lowercase e.key strings)
 * @property {KeyState}    pressed  - edge-triggered this frame
 * @property {MousePos}    mouse
 * @property {MouseButtonState} mouseDown
 * @property {MouseButtonState} mousePressed
 * @property {BindingsMap} bindings
 * @property {Record<string, string[]>} _keyToActions
 */

export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas){
    this.canvas = canvas;
    this.keys = {};            // current held keys (lowercase, e.key strings)
    this.pressed = {};         // edge-triggered this frame
    this.mouse = { x:0, y:0, worldX:0, worldY:0 };
    this.mouseDown = { left:false, right:false, middle:false };
    this.mousePressed = { left:false, right:false, middle:false };
    // {actionId: key}. Live copy — mutating this object + calling .rebuild()
    // is enough to swap bindings at runtime.
    this.bindings = { ...DEFAULT_BIND };
    this._rebuildKeyIndex();
    this._bind();
  }

  // After mutating this.bindings, call this so wasPressed() resolves the new map.
  /** @returns {Record<string, string[]>} */
  rebuildKeyIndex(){
    return this._rebuildKeyIndex();
  }
  /**
   * @private
   * @returns {Record<string, string[]>}
   */
  _rebuildKeyIndex(){
    // Reverse map: key -> array of actionIds. (Multiple actions can share a
    // key if the conflict-validation pass didn't catch it, or if the user
    // bound two to the same key intentionally — both fire on press.)
    this._keyToActions = {};
    for(const id in this.bindings){
      const k = this.bindings[id];
      if(!k) continue;
      (this._keyToActions[k] = this._keyToActions[k] || []).push(id);
    }
    return this._keyToActions;
  }

  /** @private @returns {void} */
  _bind(){
    window.addEventListener('keydown', e=>{
      const k = normalizeKey(e);
      if(!k) return;
      if(!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if(['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e=>{
      const k = normalizeKey(e);
      if(k) this.keys[k] = false;
    });

    this.canvas.addEventListener('mousemove', e=>{
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
    });
    this.canvas.addEventListener('mousedown', e=>{
      const mk = mouseKey(e.button);
      if(mk){
        if(mk === 'mouse1' && !this.mouseDown.left)   this.mousePressed.left = true;
        if(mk === 'mouse2' && !this.mouseDown.right)  this.mousePressed.right = true;
        if(mk === 'mouse3' && !this.mouseDown.middle) this.mousePressed.middle = true;
        if(mk === 'mouse1') this.mouseDown.left = true;
        if(mk === 'mouse2') this.mouseDown.right = true;
        if(mk === 'mouse3') this.mouseDown.middle = true;
      }
    });
    window.addEventListener('mouseup', e=>{
      const mk = mouseKey(e.button);
      if(mk === 'mouse1') this.mouseDown.left = false;
      if(mk === 'mouse2') this.mouseDown.right = false;
      if(mk === 'mouse3') this.mouseDown.middle = false;
    });
    this.canvas.addEventListener('contextmenu', e=> e.preventDefault());
  }

  // movement vector from the 4 move_* bindings (default: WASD)
  /** @returns {{x:number, y:number}} */
  moveVector(){
    let x=0,y=0;
    if(this.keys[this.bindings.move_up])    y-=1;
    if(this.keys[this.bindings.move_down])  y+=1;
    if(this.keys[this.bindings.move_left])  x-=1;
    if(this.keys[this.bindings.move_right]) x+=1;
    if(x&&y){ const inv=1/Math.sqrt(2); x*=inv; y*=inv; }
    return {x,y};
  }

  // Was the given ACTION pressed this frame? Translates via this.bindings.
  // Pass an action id (e.g. 'dodge', 'spell_q', 'toggle_bag'), NOT a raw key.
  /**
   * @param {string} actionId
   * @returns {boolean}
   */
  wasPressed(actionId){
    const k = this.bindings[actionId];
    if(!k) return false;
    if(k === 'mouse1') return !!this.mousePressed.left;
    if(k === 'mouse2') return !!this.mousePressed.right;
    if(k === 'mouse3') return !!this.mousePressed.middle;
    return !!this.pressed[k];
  }

  // Was the given RAW key pressed this frame? Used by main.js (modal toggles
  // dispatched outside the action system — those go through this instead).
  /**
   * @param {string} k
   * @returns {boolean}
   */
  wasKeyPressed(k){
    return !!this.pressed[String(k || '').toLowerCase()];
  }

  // Is the given ACTION currently held? For continuous-state checks (rare;
  // the action-based path is preferred for held keys via .isDown).
  /**
   * @param {string} actionId
   * @returns {boolean}
   */
  isDown(actionId){
    const k = this.bindings[actionId];
    if(!k) return false;
    if(k === 'mouse1') return !!this.mouseDown.left;
    if(k === 'mouse2') return !!this.mouseDown.right;
    if(k === 'mouse3') return !!this.mouseDown.middle;
    return !!this.keys[k];
  }

  // call at end of each frame to clear edge triggers
  /** @returns {void} */
  lateUpdate(){
    this.pressed = {};
    this.mousePressed = { left:false, right:false, middle:false };
  }
}
