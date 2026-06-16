// Input system: keyboard + mouse, exposes a clean state object.
// Sprint 7: action-based bindings. Callers use wasPressed(actionId) instead
// of wasPressed('q') so a rebind in Settings actually works.
import { DEFAULT_BIND, normalizeKey, mouseKey } from '../data/keybinds.js';

export class Input {
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
  rebuildKeyIndex(){
    return this._rebuildKeyIndex();
  }
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
  }

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
  wasKeyPressed(k){
    return !!this.pressed[String(k || '').toLowerCase()];
  }

  // Is the given ACTION currently held? For continuous-state checks (rare;
  // the action-based path is preferred for held keys via .isDown).
  isDown(actionId){
    const k = this.bindings[actionId];
    if(!k) return false;
    if(k === 'mouse1') return !!this.mouseDown.left;
    if(k === 'mouse2') return !!this.mouseDown.right;
    if(k === 'mouse3') return !!this.mouseDown.middle;
    return !!this.keys[k];
  }

  // call at end of each frame to clear edge triggers
  lateUpdate(){
    this.pressed = {};
    this.mousePressed = { left:false, right:false, middle:false };
  }
}
