// Sprint 10 — Gamepad button/axis → action mapping.
//
// Standard mapping (W3C "Standard Gamepad", which covers Xbox/PS/Switch Pro
// when the browser exposes them as Standard):
//
//   button 0  → A / Cross      → 'attack' (LMB by default)
//   button 1  → B / Circle     → 'dodge'  (Space by default)
//   button 2  → X / Square     → 'interact' (F by default)
//   button 3  → Y / Triangle   → 'block' (RMB by default)
//   button 4  → LB / L1        → 'teleport_town' (T by default)
//   button 5  → RB / R1        → 'companion_ability' (G by default)
//   button 6  → LT / L2        → 'spell_q' (Q by default; digital press)
//   button 7  → RT / R2        → 'spell_e' (E by default; digital press)
//   button 8  → Select/Share   → 'toggle_combat_log' (L by default)
//   button 9  → Start/Options  → 'settings' (Esc by default)
//   button 10 → L3 (stick)     → 'dismiss_companion' (Shift by default)
//   button 11 → R3 (stick)     → 'toggle_map' (M by default)
//   button 12 → D-pad Up       → 'move_up'    (W by default)
//   button 13 → D-pad Down     → 'move_down'  (S by default)
//   button 14 → D-pad Left     → 'move_left'  (A by default)
//   button 15 → D-pad Right    → 'move_right' (D by default)
//
// Axes:
//   axis 0 → stick X          → moveVector x   (also right-stick aim X when no mouse)
//   axis 1 → stick Y          → moveVector y
//   axis 2 → right stick X    → mouse aim
//   axis 3 → right stick Y    → mouse aim
//
// We never hard-code these. The poller translates a button-press to
// "write input.keys[<boundKey>] = true and input.pressed[<boundKey>] = true",
// where <boundKey> comes from the live Input.bindings map. That means a key
// rebind automatically rebinds the gamepad too — same effect, different device.

/** @type {Record<number, string>} - W3C Standard gamepad button index → action id */
export const GAMEPAD_BUTTON_TO_ACTION = {
  0:  'attack',
  1:  'dodge',
  2:  'interact',
  3:  'block',
  4:  'teleport_town',
  5:  'companion_ability',
  6:  'spell_q',
  7:  'spell_e',
  8:  'toggle_combat_log',
  9:  'settings',
  10: 'dismiss_companion',
  11: 'toggle_map',
  12: 'move_up',
  13: 'move_down',
  14: 'move_left',
  15: 'move_right',
};

// Trigger threshold (digital). Many controllers report analog LT/RT as 0..1;
// we treat value >= this as a press. Anything below counts as released.
export const TRIGGER_THRESHOLD = 0.35;

// Stick deadzone. Standard for gamepad-correctness — without it the character
// drifts on a resting stick. 0.18 is the value the W3C spec recommends for
// "Standard" mapping on axes that have been pre-normalized to [-1, 1].
export const STICK_DEADZONE = 0.18;

// Right-stick aim — the stick value is treated as a screen-space delta.
// 2400 px/s at full deflection is "fast enough to spin around a 1280-wide
// screen in half a second" — the player should never have to wait for the
// aim to catch up.
export const AIM_SPEED = 2400;
