// Keybind rebind UI (Sprint 7)
// Pure DOM controller for the keybinds list inside the Settings modal.
// Reads/writes via the Input instance — the input then rebuilds its key index.
//
// Public surface:
//   KeybindUI.mount({input, container, hintEl, resetBtn}) — wires the panel
//   KeybindUI.refresh() — re-renders rows from the current binding map
//
// The rebind flow:
//   1. User clicks a row's key chip
//   2. That chip switches to "listening" (pulsing orange)
//   3. The next keydown (anywhere) becomes the new binding
//   4. Conflict is detected via keybinds.findConflict and shown in red
//   5. Escape cancels listening
//
// ESC is also captured so users can back out without changing the binding.

import { ACTIONS, REBINDABLE, labelForKey, findConflict, DEFAULT_BIND, normalizeKey, mouseKey } from '../data/keybinds.js';

const KEYBINDS_LS_KEY = 'aetheria_keybinds_v1';

/**
 * @typedef {Object} KeybindMountOptions
 * @property {import('../systems/input.js').Input} input       - live input system whose .bindings we mutate
 * @property {HTMLElement} [container]   - ul/div that holds the rendered rows
 * @property {HTMLElement} [hintEl]      - element showing the contextual hint text
 * @property {HTMLButtonElement} [resetBtn] - "Reset to defaults" button
 */

/**
 * @typedef {Object} KeybindListening
 * @property {string} actionId - id of the action waiting for a keypress
 * @property {HTMLElement} el  - the chip element currently in listening state
 */

/**
 * @typedef {Object} KeybindUIState
 * @property {import('../systems/input.js').Input|null} _input
 * @property {HTMLElement|null} _container
 * @property {HTMLElement|null} _hintEl
 * @property {HTMLButtonElement|null} _resetBtn
 * @property {KeybindListening|null} _listening
 * @property {Record<string, string>} _overrides - actionId -> bound key, persisted in localStorage
 */

/** @type {KeybindUIState} */
export const KeybindUI = {
  _input: null,
  _container: null,
  _hintEl: null,
  _resetBtn: null,
  _listening: null,  // {actionId, el} when a row is awaiting input

  // Persisted user overrides. null = use default. Loaded on mount, saved on change.
  _overrides: {},

  /**
   * Wire the rebind panel: grab DOM refs, load overrides, render rows,
   * attach the global keydown capture and reset-button handler.
   * @param {KeybindMountOptions} opts
   * @returns {void}
   */
  mount({ input, container, hintEl, resetBtn }){
    this._input = input;
    this._container = container;
    this._hintEl = hintEl;
    this._resetBtn = resetBtn;
    this._loadOverrides();
    this._applyOverridesToInput();
    this.refresh();
    if(this._resetBtn){
      this._resetBtn.onclick = ()=>{
        this._overrides = {};
        this._saveOverrides();
        this._applyOverridesToInput();
        this.refresh();
        if(this._hintEl) this._hintEl.textContent = 'Reset to defaults.';
        setTimeout(()=> this._setHint('Click a key, then press the new binding. Mouse buttons cannot be rebound.'), 1500);
      };
    }
    // Global keydown captures the next key while listening.
    window.addEventListener('keydown', (e)=> this._onGlobalKey(e), true);
  },

  /**
   * Read persisted overrides from localStorage. Silently falls back to {}
   * on parse errors so a corrupted entry never wedges the panel.
   * @returns {void}
   */
  _loadOverrides(){
    try {
      const raw = localStorage.getItem(KEYBINDS_LS_KEY);
      if(raw) this._overrides = JSON.parse(raw) || {};
    } catch(e) { this._overrides = {}; }
  },
  /**
   * Write the current overrides map back to localStorage. Wrapped in try/catch
   * so private/incognito mode (where setItem throws) doesn't break rebinds.
   * @returns {void}
   */
  _saveOverrides(){
    try { localStorage.setItem(KEYBINDS_LS_KEY, JSON.stringify(this._overrides)); } catch(e) {}
  },

  // Merge overrides into the input's bindings. Overrides win; defaults fill the rest.
  /**
   * Public alias of {@link KeybindUI._applyOverridesToInput}. Rebuilt for
   * callers that want to re-publish overrides to the input without touching
   * DOM (e.g. Game.start after a save-load roundtrip).
   * @returns {void}
   */
  applyOverridesToInput(){
    if(!this._input) return;
    const next = { ...DEFAULT_BIND };
    for(const id in this._overrides){
      if(this._overrides[id]) next[id] = this._overrides[id];
    }
    this._input.bindings = next;
    this._input.rebuildKeyIndex();
  },
  /**
   * Internal wrapper kept for naming consistency with the other _-prefixed
   * helpers. Just delegates to the public method.
   * @returns {void}
   */
  _applyOverridesToInput(){
    return this.applyOverridesToInput();
  },

  // Re-render the list. Cheap (DOM diff unnecessary at this size).
  /**
   * Tear down + rebuild the rebind rows from the current input.bindings map.
   * Also re-attaches click handlers on the key chips.
   * @returns {void}
   */
  refresh(){
    if(!this._container) return;
    const b = this._input ? this._input.bindings : DEFAULT_BIND;
    this._container.innerHTML = '';
    for(const a of ACTIONS){
      if(!REBINDABLE.has(a.kind)) continue;  // skip mouse1/mouse2
      const row = document.createElement('div');
      row.className = 'kb-row';
      const k = b[a.id] || a.defaultKey;
      const conflict = findConflict(b, k, a.id);
      row.innerHTML = `<span class="kb-label">${a.label}</span>` +
        `<span class="kb-key${conflict ? ' conflict' : ''}" data-action="${a.id}">${labelForKey(k)}</span>`;
      this._container.appendChild(row);
    }
    // Click handlers (delegated — re-attached on each refresh)
    this._container.querySelectorAll('.kb-key').forEach(el => {
      el.onclick = (e)=> this._startListening(e.currentTarget);
    });
  },

  /**
   * Mark a row chip as listening and update the hint text. Cancels any
   * previous in-flight listening state first so only one chip is active.
   * @param {HTMLElement} el - the .kb-key chip that was clicked
   * @returns {void}
   */
  _startListening(el){
    // Cancel any in-flight listening
    this._cancelListening();
    const actionId = el.dataset.action;
    this._listening = { actionId, el };
    el.classList.add('listening');
    el.textContent = '...';
    if(this._hintEl) this._hintEl.textContent = 'Press a key, or Esc to cancel.';
  },

  /**
   * Stop listening (called on Escape, after a successful bind, or when a
   * new chip starts listening). Always re-renders so the chip text snaps
   * back to the current key.
   * @returns {void}
   */
  _cancelListening(){
    if(this._listening){
      this._listening.el.classList.remove('listening');
      this._listening = null;
    }
    if(this._hintEl) this._hintEl.textContent = 'Click a key, then press the new binding. Mouse buttons cannot be rebound.';
    this.refresh();
  },

  /**
   * Global keydown handler: if we're listening, capture the next keypress
   * as a rebind for the active action. Escape cancels without binding.
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  _onGlobalKey(e){
    if(!this._listening) return;
    // Cancel on Escape
    if(e.key === 'Escape'){ e.preventDefault(); this._cancelListening(); return; }
    // Accept mouse buttons too (treat as binding; though kind==='mouse' is exempt,
    // the user might be rebinding 'attack' which IS allowed since kind=='action')
    let k = normalizeKey(e);
    if(!k) return;
    // Reject non-allowed actions: skip pure modifier-only presses
    if(['shift','control','alt','meta'].includes(k) && !e.repeat){
      // allow it
    }
    e.preventDefault();
    e.stopPropagation();
    const { actionId } = this._listening;
    // Update the override map
    this._overrides[actionId] = k;
    this._saveOverrides();
    this._applyOverridesToInput();
    this._listening = null;
    this.refresh();
    if(this._hintEl) this._hintEl.textContent = `Bound: ${labelForKey(k)}.`;
    setTimeout(()=> this._setHint('Click a key, then press the new binding. Mouse buttons cannot be rebound.'), 1200);
  },

  /**
   * Update the hint element text if it exists. No-op without a hintEl.
   * @param {string} msg
   * @returns {void}
   */
  _setHint(msg){
    if(this._hintEl) this._hintEl.textContent = msg;
  },
};

// Public helper used by Game / save: serialize the overrides for the save blob.
/**
 * Read the persisted overrides from localStorage. Used by Game when assembling
 * a save blob so the rebinds follow the player across devices.
 * @returns {Record<string, string>} actionId -> key
 */
export function getKeybindOverrides(){
  try { return JSON.parse(localStorage.getItem(KEYBINDS_LS_KEY) || '{}') || {}; }
  catch(e) { return {}; }
}
/**
 * Programmatic setter for the overrides map. Used by Game after a save-load
 * roundtrip to republish rebinds, and by the rebind UI itself.
 * @param {Record<string, string>|null|undefined} overrides
 * @returns {void}
 */
export function setKeybindOverrides(overrides){
  try { localStorage.setItem(KEYBINDS_LS_KEY, JSON.stringify(overrides || {})); } catch(e) {}
}
