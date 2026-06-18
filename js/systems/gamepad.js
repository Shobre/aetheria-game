// Sprint 10 — Gamepad polling + input synthesis.
//
// Approach: the Gamepad poller is a thin adapter between the W3C Gamepad
// API and the existing Input class. It does NOT know about actions; it
// translates a gamepad press into the *same* write that a real key event
// would make (input.keys[k] = true, input.pressed[k] = true).
//
// Why this shape:
//   - Zero call site changes. Player._handleMovement, game._checkInteract,
//     every wasPressed() / isDown() / moveVector() call just works.
//   - A key rebind in Settings also rebinds the gamepad, automatically. The
//     poller reads the live `input.bindings` map every frame.
//   - Fallow sees one cross-file consumer (Input was already imported by
//     main.js; Gamepad is imported by main.js for the polling bootstrap).
//
// Axes:
//   - Stick X/Y → moveVector (write the bound move key directly).
//   - Right stick X/Y → mouse aim (write input.mouse.x/y deltas).
//
// Performance: the poller only does work when a gamepad is connected. On
// disconnect, it releases every key/mouse button it was holding. The
// requestAnimationFrame loop is owned by the Game's _loop, so we tap into
// that — `game._gamepadPoll()` is called once per frame.

import {
  GAMEPAD_BUTTON_TO_ACTION,
  TRIGGER_THRESHOLD,
  STICK_DEADZONE,
  AIM_SPEED,
} from '../data/gamepad.js';

/**
 * @typedef {Object} StickActive
 * @property {boolean} up
 * @property {boolean} down
 * @property {boolean} left
 * @property {boolean} right
 *
 * @typedef {Object} RightStick
 * @property {number}  x
 * @property {number}  y
 * @property {boolean} hasReported
 *
 * @typedef {Object} GamepadAdapterState
 * GamepadAdapter instance state.
 * @property {import('./input.js').Input} input
 * @property {any} game
 * @property {number} index                  - navigator.getGamepads() slot; -1 = none
 * @property {boolean} connected
 * @property {Record<number, boolean>} _lastButtons
 * @property {{l:number, r:number}} _lastTriggers
 * @property {StickActive} _stickActive
 * @property {RightStick} _rightStick
 * @property {(a: string) => string|null} _keyFromAction
 * @property {boolean} _anyLastFrame
 * @property {() => void} _onConnect
 * @property {() => void} _onDisconnect
 */

export class GamepadAdapter {
  /**
   * @param {import('./input.js').Input} input
   * @param {any} game
   */
  constructor(input, game){
    this.input = input;
    this.game  = game;
    this.index = -1;          // which navigator.getGamepads() slot we're using
    this.connected = false;
    this._lastButtons = {};   // buttonIndex -> bool (for edge detection)
    this._lastTriggers = { l: 0, r: 0 };  // analog trigger state
    this._stickActive = { up:false, down:false, left:false, right:false };
    this._rightStick = { x: 0, y: 0, hasReported: false };
    this._keyFromAction = (a) => {
      if(!a) return null;
      // LMB/RMB are mouse buttons, not keys. The poller never needs to
      // synthesize a mouse press from a non-mouse action (and vice versa).
      return input.bindings[a] || null;
    };
    this._anyLastFrame = false;  // for disconnect/release detection
    this._onConnect    = () => this._tryConnect();
    this._onDisconnect = () => this._tryConnect();
    // Window-touching listeners only exist in the browser. In a Node test
    // harness there is no `window`, so guard the addEventListener calls
    // and let the constructor still build a working adapter for unit tests.
    if(typeof window !== 'undefined'){
      window.addEventListener('gamepadconnected',    this._onConnect);
      window.addEventListener('gamepaddisconnected', this._onDisconnect);
    }
    this._tryConnect();
  }

  // Look for any standard gamepad. If we don't find one, mark disconnected.
  _tryConnect(){
    if(typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for(let i = 0; i < pads.length; i++){
      if(pads[i]){
        this.index = i;
        this.connected = true;
        return;
      }
    }
    this.connected = false;
    this.index = -1;
  }

  // Call once per frame. Reads the live gamepad state and writes into
  // input.keys / input.pressed / input.mouse.* as if real events fired.
  poll(dt){
    if(!this.connected && !this._anyLastFrame) return false;
    let pad = null;
    if(this.index >= 0 && typeof navigator !== 'undefined' && navigator.getGamepads){
      const pads = navigator.getGamepads();
      pad = pads[this.index] || null;
    }
    // If the pad went away, release everything we were holding and bail.
    if(!pad){
      if(this._anyLastFrame) this._releaseAll();
      this.connected = false;
      this.index = -1;
      this._anyLastFrame = false;
      return false;
    }
    this.connected = true;
    this._anyLastFrame = true;

    // ---- 1. Digital buttons + D-pad (button 12..15) ----
    for(let bi = 0; bi < pad.buttons.length; bi++){
      const btn = pad.buttons[bi];
      // Some browsers report an object {pressed, touched, value}, some report
      // a number. Normalize.
      const pressed = btn && typeof btn === 'object' ? !!btn.pressed : !!btn;
      const value   = btn && typeof btn === 'object' ? (btn.value || 0) : (pressed ? 1 : 0);
      const wasDown = !!this._lastButtons[bi];
      const isDown  = pressed || (bi >= 6 && bi <= 7 && value >= TRIGGER_THRESHOLD);
      if(isDown !== wasDown){
        this._lastButtons[bi] = isDown;
        const actionId = GAMEPAD_BUTTON_TO_ACTION[bi];
        if(actionId){
          this._writeAction(actionId, isDown);
        }
      }
    }

    // ---- 2. Left stick → move vector (overrides the d-pad if both fire) ----
    const lx = pad.axes[0] || 0;
    const ly = pad.axes[1] || 0;
    const up    = ly < -STICK_DEADZONE;
    const down  = ly >  STICK_DEADZONE;
    const left  = lx < -STICK_DEADZONE;
    const right = lx >  STICK_DEADZONE;
    // Always write from the live bindings (in case the user rebound W to Up).
    this._writeDirection('move_up',    this._stickActive.up,    up);
    this._writeDirection('move_down',  this._stickActive.down,  down);
    this._writeDirection('move_left',  this._stickActive.left,  left);
    this._writeDirection('move_right', this._stickActive.right, right);
    this._stickActive = { up, down, left, right };

    // ---- 3. Right stick → mouse aim (deliberate aim, not drift) ----
    const rx = pad.axes[2] || 0;
    const ry = pad.axes[3] || 0;
    const rmag = Math.hypot(rx, ry);
    if(rmag > STICK_DEADZONE){
      // Smooth the magnitude with a small dead-zone response curve.
      const norm = Math.min(1, (rmag - STICK_DEADZONE) / (1 - STICK_DEADZONE));
      const dirX = rx / rmag, dirY = ry / rmag;
      this.input.mouse.x += dirX * norm * AIM_SPEED * dt;
      this.input.mouse.y += dirY * norm * AIM_SPEED * dt;
      // Clamp to the canvas so we never push the aim off-screen.
      if(this.input.canvas){
        if(this.input.mouse.x < 0) this.input.mouse.x = 0;
        else if(this.input.mouse.x > this.input.canvas.width)  this.input.mouse.x = this.input.canvas.width;
        if(this.input.mouse.y < 0) this.input.mouse.y = 0;
        else if(this.input.mouse.y > this.input.canvas.height) this.input.mouse.y = this.input.canvas.height;
      }
      this._rightStick.hasReported = true;
    } else {
      this._rightStick.hasReported = false;
    }
    return true;
  }

  // Translate a press/release of `actionId` into the same write a real
  // key event would do. For mouse-bound actions we ALSO push the
  // mousePressed / mouseDown flags, since wasPressed('attack') resolves to
  // `mousePressed.left` (the rebind UI keeps LMB hardcoded to attack by
  // convention, but the action registry's "attack" defaultKey is 'mouse1').
  _writeAction(actionId, isDown){
    if(!actionId) return;
    // The action maps to either a key OR a mouse button. Read the live
    // binding so a rebind takes effect immediately.
    const b = this.input.bindings[actionId];
    if(!b) return;
    if(b === 'mouse1' || b === 'mouse2' || b === 'mouse3'){
      const which = b === 'mouse1' ? 'left' : b === 'mouse2' ? 'right' : 'middle';
      if(isDown){
        if(!this.input.mouseDown[which]) this.input.mousePressed[which] = true;
        this.input.mouseDown[which] = true;
      } else {
        this.input.mouseDown[which] = false;
      }
      return;
    }
    // Keyboard path: write into the same maps the real keydown/up handlers do.
    if(isDown){
      if(!this.input.keys[b]) this.input.pressed[b] = true;
      this.input.keys[b] = true;
    } else {
      this.input.keys[b] = false;
    }
  }

  // Specialization of _writeAction for stick-driven move keys, since the
  // move keys are a small set and we already track them by name.
  _writeDirection(actionId, was, now){
    if(was === now) return;
    this._writeAction(actionId, now);
  }

  // Release every key and mouse button the adapter was holding. Called
  // on disconnect and on the first frame after a pad is lost, so a player
  // who unplugs mid-attack doesn't get stuck attacking.
  _releaseAll(){
    const moveActions = ['move_up', 'move_down', 'move_left', 'move_right'];
    for(const a of moveActions) this._writeAction(a, false);
    // Walk the button map (covers d-pad + everything else) and clear each.
    for(const bi in this._lastButtons){
      if(this._lastButtons[bi]){
        const actionId = GAMEPAD_BUTTON_TO_ACTION[bi];
        if(actionId) this._writeAction(actionId, false);
        this._lastButtons[bi] = false;
      }
    }
    if(this.input.mouseDown.left)   this.input.mouseDown.left   = false;
    if(this.input.mouseDown.right)  this.input.mouseDown.right  = false;
    if(this.input.mouseDown.middle) this.input.mouseDown.middle = false;
  }
}
