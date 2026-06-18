// Keybind system (Sprint 7)
// Single source of truth for what action a key triggers. Both the runtime
// (Input.wasPressed / Input.moveVector) and the rebind UI read from this map.
//
// Shape:
//   ACTIONS       — array of {id, label, defaultKey, kind} entries
//   BINDABLE      — set of kinds that the rebind UI surfaces (excludes 'mouse'
//                   since LMB/RMB are not really rebindable in a 2-button game)
//   DEFAULT_BIND  — {actionId: key} built from ACTIONS
//   labelFor(key) — pretty name for a key string (' ' -> 'SPACE', etc.)
//
// Conventions:
//   - Keys are lowercased. ' ' for space, 'escape', 'tab', 'arrowup'...
//   - 'mouse1' / 'mouse2' / 'mouse3' for LMB/RMB/MMB (kept on the actions list
//     so the registry stays complete, but BINDABLE excludes them).
//   - Q/E/R spell slots are NOT here — they're handled by the spell-slot UI
//     and are conceptually different (the action IS the spell, not a verb).

/**
 * @typedef {'move'|'action'|'modal'|'mouse'} ActionKind
 *
 * @typedef {Object} ActionDef
 * @property {string}      id           - canonical action id (e.g. 'attack')
 * @property {string}      label        - UI label
 * @property {string}      defaultKey   - canonical key (lowercased)
 * @property {ActionKind}  kind
 */

/** @type {ActionDef[]} */
export const ACTIONS = [
  // ---- movement (4 separate keys, but together form the move vector) ----
  { id: 'move_up',    label: 'Move Up',    defaultKey: 'w', kind: 'move' },
  { id: 'move_down',  label: 'Move Down',  defaultKey: 's', kind: 'move' },
  { id: 'move_left',  label: 'Move Left',  defaultKey: 'a', kind: 'move' },
  { id: 'move_right', label: 'Move Right', defaultKey: 'd', kind: 'move' },

  // ---- combat ----
  { id: 'dodge',   label: 'Dodge / Dash',     defaultKey: ' ',       kind: 'action' },
  { id: 'attack',  label: 'Attack',           defaultKey: 'mouse1',  kind: 'mouse'  },
  { id: 'block',   label: 'Block / Parry',    defaultKey: 'mouse2',  kind: 'mouse'  },
  { id: 'interact',label: 'Interact (F)',     defaultKey: 'f',       kind: 'action' },

  // ---- spells ----
  { id: 'spell_q', label: 'Spell Q',          defaultKey: 'q', kind: 'action' },
  { id: 'spell_e', label: 'Spell E',          defaultKey: 'e', kind: 'action' },
  { id: 'spell_r', label: 'Spell R',          defaultKey: 'r', kind: 'action' },

  // ---- menus / hotbar ----
  { id: 'hotbar_1', label: 'Hotbar 1',        defaultKey: '1', kind: 'action' },
  { id: 'hotbar_2', label: 'Hotbar 2',        defaultKey: '2', kind: 'action' },
  { id: 'hotbar_3', label: 'Hotbar 3',        defaultKey: '3', kind: 'action' },
  { id: 'hotbar_4', label: 'Hotbar 4',        defaultKey: '4', kind: 'action' },
  { id: 'hotbar_5', label: 'Hotbar 5',        defaultKey: '5', kind: 'action' },
  { id: 'hotbar_6', label: 'Hotbar 6',        defaultKey: '6', kind: 'action' },
  { id: 'hotbar_7', label: 'Hotbar 7',        defaultKey: '7', kind: 'action' },
  { id: 'hotbar_8', label: 'Hotbar 8',        defaultKey: '8', kind: 'action' },
  { id: 'hotbar_9', label: 'Hotbar 9',        defaultKey: '9', kind: 'action' },

  // ---- meta ----
  { id: 'teleport_town', label: 'Teleport to Town',  defaultKey: 't', kind: 'action' },
  { id: 'companion_ability', label: 'Companion Ability (G)', defaultKey: 'g', kind: 'action' },
  { id: 'dismiss_companion', label: 'Dismiss Companion (Shift)', defaultKey: 'shift', kind: 'action' },

  // ---- modals ----
  { id: 'toggle_bag',           label: 'Inventory (B)',     defaultKey: 'b', kind: 'modal' },
  { id: 'toggle_char',          label: 'Character (C)',     defaultKey: 'c', kind: 'modal' },
  { id: 'toggle_skills',        label: 'Skill Tree (K)',    defaultKey: 'k', kind: 'modal' },
  { id: 'toggle_quests',        label: 'Quests (J)',        defaultKey: 'j', kind: 'modal' },
  { id: 'toggle_achievements', label: 'Achievements (Y)',  defaultKey: 'y', kind: 'modal' },
  { id: 'toggle_combat_log',   label: 'Combat Log (L)',    defaultKey: 'l', kind: 'modal' },
  { id: 'toggle_map',          label: 'Full Map (M)',      defaultKey: 'm', kind: 'modal' },
  { id: 'settings',            label: 'Settings (Esc)',    defaultKey: 'escape', kind: 'modal' },

  // ---- Sprint 12: fast-travel to/from home ----
  // H is unbound in vanilla keymaps; we use it for "Go Home / Return from Home".
  // Acts as a toggle: if you're outside home, it teleports you home and remembers
  // where you were; if you're already in home, it teleports you back to that spot
  // (one-shot recall). 10s cooldown, blocked during combat / boss fights.
  { id: 'fast_travel',         label: 'Fast-Travel Home (H)', defaultKey: 'h', kind: 'action' },
];

// Build the default binding map {actionId: key} from ACTIONS.
export const DEFAULT_BIND = Object.freeze(
  ACTIONS.reduce((acc, a) => (acc[a.id] = a.defaultKey, acc), {})
);

// Kinds the rebind UI surfaces as clickable rows. Mouse buttons are excluded
// from the rebindable surface (they stay mouse1/mouse2 hardcoded in the game).
export const REBINDABLE = new Set(['move', 'action', 'modal']);

// Convert a key string to a pretty label for the UI.
/** @param {string|null|undefined} key @returns {string} */
export const labelForKey = function(key){
  if(!key) return '?';
  if(key === ' ') return 'SPACE';
  if(key === 'escape') return 'ESC';
  if(key === 'arrowup') return '↑';
  if(key === 'arrowdown') return '↓';
  if(key === 'arrowleft') return '←';
  if(key === 'arrowright') return '→';
  if(key === 'tab') return 'TAB';
  if(key === 'shift') return 'SHIFT';
  if(key === 'control') return 'CTRL';
  if(key === 'mouse1') return 'LMB';
  if(key === 'mouse2') return 'RMB';
  if(key === 'mouse3') return 'MMB';
  if(key.length === 1) return key.toUpperCase();
  return key;
};

// Backwards-compatible alias. Older call sites used `labelFor`.
export const labelFor = labelForKey;

// Given a KeyboardEvent (or the Input's edge key string), normalize to the
// canonical form this registry uses.
/**
 * @param {KeyboardEvent|string|null|undefined} eOrKey
 * @returns {string}
 */
export function normalizeKey(eOrKey){
  // Already-normalized?
  if(typeof eOrKey === 'string') return eOrKey.toLowerCase();
  if(!eOrKey || !eOrKey.key) return '';
  const k = eOrKey.key;
  if(k === ' ') return ' ';
  if(k === 'Escape') return 'escape';
  if(k === 'Tab') return 'tab';
  if(k === 'Shift') return 'shift';
  if(k === 'Control') return 'control';
  if(k.startsWith('Arrow')) return k.toLowerCase();
  if(k.length === 1) return k.toLowerCase();
  return k.toLowerCase();
}

// Given a mouse button index, return the canonical key string.
export function mouseKey(button){
  if(button === 0) return 'mouse1';
  if(button === 1) return 'mouse3';
  if(button === 2) return 'mouse2';
  return null;
}

// Detect conflicts: returns the actionId that is already bound to `key`,
// or null if the key is free. Used by the rebind UI to highlight conflicts.
export function findConflict(bindings, key, exceptActionId){
  for(const id in bindings){
    if(id === exceptActionId) continue;
    if(bindings[id] === key) return id;
  }
  return null;
}

// Validate a user-supplied binding object. Returns {ok, errors[], cleaned}.
// - Drops unknown action ids
// - Resets rebindable conflicts: if two actions claim the same key, the second
//   (in the order they appear in the object) is reset to its default.
// - Drops unknown key strings (anything not in DEFAULT_BIND values? — too strict;
//   we accept any non-empty string and let the UI surface a warning instead).
export function validateBindings(bindings){
  const errors = [];
  const cleaned = {};
  // First pass: copy the known actions.
  for(const a of ACTIONS){
    if(bindings[a.id] != null) cleaned[a.id] = String(bindings[a.id]).toLowerCase();
    else cleaned[a.id] = a.defaultKey;
  }
  // Second pass: detect rebindable duplicates and reset the loser.
  const seen = {};
  for(const a of ACTIONS){
    if(!REBINDABLE.has(a.kind)) continue;  // mouse1/mouse2 are exempt
    const k = cleaned[a.id];
    if(seen[k]){
      errors.push(`Conflict on key '${k}': ${a.id} and ${seen[k]} — reset ${a.id} to default`);
      cleaned[a.id] = a.defaultKey;
    } else {
      seen[k] = a.id;
    }
  }
  return { ok: errors.length === 0, errors, cleaned };
}
