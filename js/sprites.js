// Central pixel-art sprite module for Aetheria.
// All entity bodies, gear pieces, and HUD mini-icons are drawn here with
// Canvas 2D primitives (fillRect / arc / stroke). No emoji, no sprite sheets.
//
// Coordinate convention: draw* functions receive (sx, sy) as the entity's
// tile center on screen. Internally we offset to a 24x32 virtual sprite space
// centered on the entity. The "feet" sit at sy, the "head" at sy-28.
//
// All draw functions must be self-contained — they may save/restore ctx state
// only when they need to translate/rotate. They never mutate global state.

// Sprint 11: try the atlas first; if the PNG isn't ready yet (or the
// toggle is off) we fall through to the canvas-primitive path. The
// first frame after a fresh load will use primitives; subsequent frames
// use the atlas. No flicker, no per-entity code change.
import { drawImageFromAtlas, isUsingAtlases } from './systems/sprite-atlas.js';
import { ENCHANTMENTS } from './data/enchantments.js';

const SW = 24;            // sprite virtual width
const SH = 32;            // sprite virtual height
const _body = (ctx, bx, by, sc, shirt, pants, skin) => {
  // legs
  ctx.fillStyle = pants;
  ctx.fillRect(bx + 6, by + 18, 4, 8);
  ctx.fillRect(bx + 14, by + 18, 4, 8);
  // boots
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(bx + 5, by + 24, 5, 4);
  ctx.fillRect(bx + 14, by + 24, 5, 4);
  // torso
  ctx.fillStyle = shirt;
  ctx.fillRect(bx + 5, by + 8, 14, 12);
  // belt
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(bx + 5, by + 18, 14, 2);
  ctx.fillStyle = '#caa050';
  ctx.fillRect(bx + 11, by + 18, 3, 2);
  // head
  ctx.fillStyle = skin;
  ctx.fillRect(bx + 7, by + 0, 10, 10);
  // eyes
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(bx + 9, by + 4, 2, 2);
  ctx.fillRect(bx + 14, by + 4, 2, 2);
  // small shadow under feet
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(bx + 12, by + 29, 9, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  return sc; // unused, for chaining
};

// ----- NPC SPRITES -----
// All NPCs sit on a 24x32 sprite. Differentiating features go on top of _body.

function _robe(ctx, bx, by, color) {
  // Wide floor-length robe (replaces torso + legs)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx + 3, by + 8);
  ctx.lineTo(bx + 21, by + 8);
  ctx.lineTo(bx + 24, by + 28);
  ctx.lineTo(bx + 0, by + 28);
  ctx.closePath();
  ctx.fill();
  // trim
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(bx + 2, by + 26, 20, 2);
}

function _crown(ctx, bx, by, color) {
  ctx.fillStyle = color;
  ctx.fillRect(bx + 8, by - 2, 8, 3);
  ctx.fillRect(bx + 9, by - 4, 1, 2);
  ctx.fillRect(bx + 12, by - 5, 2, 3);
  ctx.fillRect(bx + 15, by - 4, 1, 2);
}

function _hood(ctx, bx, by, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx + 5, by + 6);
  ctx.lineTo(bx + 19, by + 6);
  ctx.lineTo(bx + 22, by + 14);
  ctx.lineTo(bx + 2, by + 14);
  ctx.closePath();
  ctx.fill();
  // face hole
  ctx.fillStyle = '#2a1a14';
  ctx.fillRect(bx + 9, by + 8, 6, 5);
}

function _staff(ctx, bx, by, orbColor) {
  // staff held in left hand
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(bx - 3, by + 4, 2, 22);
  ctx.fillStyle = orbColor;
  ctx.beginPath();
  ctx.arc(bx - 2, by + 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(bx - 3, by + 2, 1, 1);
}

function _bow(ctx, bx, by) {
  ctx.strokeStyle = '#5a3a22';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bx + 22, by + 14, 10, -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();
  ctx.strokeStyle = '#d8d0b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + 22, by + 4);
  ctx.lineTo(bx + 22, by + 24);
  ctx.stroke();
}

function _anvil(ctx, bx, by) {
  // a small anvil icon next to the smith
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(bx + 22, by + 18, 6, 8);
  ctx.fillStyle = '#5a5a66';
  ctx.fillRect(bx + 19, by + 14, 12, 4);
  ctx.fillStyle = '#7a3a1a';
  ctx.fillRect(bx + 24, by + 9, 2, 5);
}

function _bottle(ctx, bx, by, color) {
  ctx.fillStyle = color;
  ctx.fillRect(bx + 22, by + 18, 4, 8);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(bx + 23, by + 16, 2, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(bx + 22, by + 19, 1, 3);
}

function _book(ctx, bx, by) {
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(bx + 20, by + 18, 8, 6);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(bx + 21, by + 19, 6, 4);
  ctx.fillStyle = '#5a2a1a';
  ctx.fillRect(bx + 23, by + 19, 1, 4);
}

function _coin(ctx, bx, by) {
  ctx.fillStyle = '#ffcf4d';
  ctx.beginPath();
  ctx.arc(bx + 24, by + 22, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#caa050';
  ctx.fillRect(bx + 23, by + 21, 2, 2);
}

function _quill(ctx, bx, by) {
  ctx.strokeStyle = '#dac0a0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + 21, by + 12);
  ctx.lineTo(bx + 26, by + 22);
  ctx.stroke();
  ctx.fillStyle = '#7a3a1a';
  ctx.fillRect(bx + 20, by + 22, 3, 2);
}

function _lantern(ctx, bx, by) {
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(bx + 22, by + 8, 2, 14);
  ctx.fillStyle = '#ffcf4d';
  ctx.fillRect(bx + 20, by + 12, 6, 7);
  ctx.fillStyle = 'rgba(255,207,77,0.35)';
  ctx.beginPath();
  ctx.arc(bx + 23, by + 15, 6, 0, Math.PI * 2);
  ctx.fill();
}

const NPC_SPRITES = {
  // ----- Wilderness / quest NPCs -----
  'Elder': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#5a6a3a', '#3a2a1a', '#f1c39a');
    _hood(ctx, bx, by, '#7a5a3a');
    _staff(ctx, bx, by, '#4dd28a');
  },
  'Ranger': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#2c5e34', '#3a2a1a', '#e8b88a');
    // hood/hat
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(bx + 6, by - 2, 12, 3);
    ctx.fillRect(bx + 5, by - 1, 14, 2);
    _bow(ctx, bx, by);
  },
  'Nomad': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    // desert robe
    _robe(ctx, bx, by, '#d9b87a');
    // head wrap
    ctx.fillStyle = '#e8d0a0';
    ctx.fillRect(bx + 6, by - 1, 12, 6);
    ctx.fillStyle = '#5a2a1a';
    ctx.fillRect(bx + 11, by - 1, 2, 6);
    // face
    ctx.fillStyle = '#c89060';
    ctx.fillRect(bx + 8, by + 3, 8, 6);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(bx + 10, by + 5, 1, 1);
    ctx.fillRect(bx + 13, by + 5, 1, 1);
  },
  'Wayfarer': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#3a5a7a', '#1a2430', '#f1c39a');
    // winter hood
    ctx.fillStyle = '#5a7090';
    ctx.beginPath();
    ctx.moveTo(bx + 5, by + 6);
    ctx.lineTo(bx + 19, by + 6);
    ctx.lineTo(bx + 17, by - 1);
    ctx.lineTo(bx + 7, by - 1);
    ctx.closePath();
    ctx.fill();
    _lantern(ctx, bx, by);
  },
  'Hermit': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#4a4a3a');
    _hood(ctx, bx, by, '#3a3a2a');
    // glowing eyes
    ctx.fillStyle = '#ffcf4d';
    ctx.fillRect(bx + 10, by + 10, 1, 1);
    ctx.fillRect(bx + 13, by + 10, 1, 1);
    _staff(ctx, bx, by, '#a45cff');
  },
  'Forager': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#5a7a3a', '#3a2a1a', '#f1c39a');
    // basket
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(bx + 21, by + 22, 7, 5);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(bx + 21, by + 22, 7, 1);
  },
  'Ember Sage': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#7a3a1a');
    _hood(ctx, bx, by, '#5a2a0a');
    ctx.fillStyle = '#ff8a3a';
    ctx.fillRect(bx + 10, by + 10, 1, 1);
    ctx.fillRect(bx + 13, by + 10, 1, 1);
    _staff(ctx, bx, by, '#ff5a1a');
  },

  // ----- Aldermere City NPCs -----
  'Mayor': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#5a3a6a');
    // head
    ctx.fillStyle = '#f1c39a';
    ctx.fillRect(bx + 7, by - 2, 10, 10);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(bx + 9, by + 2, 2, 2);
    ctx.fillRect(bx + 13, by + 2, 2, 2);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(bx + 7, by - 1, 10, 3);
    // beard
    ctx.fillStyle = '#dadada';
    ctx.fillRect(bx + 8, by + 6, 8, 4);
    _crown(ctx, bx, by, '#ffcf4d');
  },
  'Captain': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#6a3030', '#2a1a1a', '#e8b88a');
    // helmet
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(bx + 5, by - 2, 14, 6);
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(bx + 7, by + 2, 2, 3);
    ctx.fillRect(bx + 15, by + 2, 2, 3);
    // plume
    ctx.fillStyle = '#c83030';
    ctx.fillRect(bx + 11, by - 5, 2, 4);
    // sword on hip
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(bx + 22, by + 14, 2, 10);
    ctx.fillStyle = '#7a3a22';
    ctx.fillRect(bx + 21, by + 12, 4, 2);
  },
  'Scholar': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#3a3a6a');
    // head
    ctx.fillStyle = '#f1c39a';
    ctx.fillRect(bx + 7, by - 2, 10, 10);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(bx + 9, by + 2, 2, 2);
    ctx.fillRect(bx + 13, by + 2, 2, 2);
    // glasses
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(bx + 8, by + 2, 3, 2);
    ctx.fillRect(bx + 13, by + 2, 3, 2);
    ctx.fillRect(bx + 11, by + 2, 2, 1);
    _quill(ctx, bx, by);
  },
  'Bard': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#7a3a5a', '#3a2a1a', '#f1c39a');
    // lute
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(bx + 21, by + 14, 5, 8);
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(bx + 23, by + 22, 3, 0, Math.PI * 2);
    ctx.fill();
    // hat
    ctx.fillStyle = '#5a2a3a';
    ctx.beginPath();
    ctx.moveTo(bx + 5, by - 1);
    ctx.lineTo(bx + 19, by - 1);
    ctx.lineTo(bx + 14, by - 6);
    ctx.lineTo(bx + 10, by - 6);
    ctx.closePath();
    ctx.fill();
    // feather
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(bx + 14, by - 8, 1, 4);
  },
  'Banker': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#1a1a2a');
    // head
    ctx.fillStyle = '#f1c39a';
    ctx.fillRect(bx + 7, by - 2, 10, 10);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(bx + 9, by + 2, 2, 2);
    ctx.fillRect(bx + 13, by + 2, 2, 2);
    // monocle
    ctx.strokeStyle = '#ffcf4d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx + 14, by + 3, 2, 0, Math.PI * 2);
    ctx.stroke();
    _coin(ctx, bx, by);
  },

  // ----- Shopkeepers -----
  'Smith Garon': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#5a3a1a', '#3a2a1a', '#d8a070');
    // leather apron
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(bx + 4, by + 8, 16, 12);
    ctx.fillStyle = '#5a2a1a';
    ctx.fillRect(bx + 4, by + 18, 16, 2);
    // hammer in hand
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(bx + 22, by + 8, 2, 14);
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(bx + 20, by + 6, 6, 5);
    _anvil(ctx, bx, by);
  },
  'Forge': (ctx, sx, sy, bob) => {
    // the forge itself, not a person — small anvil + glowing core
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(bx + 4, by + 16, 16, 12);
    ctx.fillStyle = '#5a5a66';
    ctx.fillRect(bx + 1, by + 12, 22, 4);
    ctx.fillStyle = '#ff8a3a';
    ctx.fillRect(bx + 6, by + 18, 12, 8);
    ctx.fillStyle = '#ffcf4d';
    ctx.fillRect(bx + 8, by + 20, 8, 4);
  },
  'Mira the Alchemist': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#3a5a3a');
    // hood
    _hood(ctx, bx, by, '#1a3a1a');
    // face
    ctx.fillStyle = '#f1c39a';
    ctx.fillRect(bx + 9, by + 8, 6, 5);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(bx + 10, by + 10, 1, 1);
    ctx.fillRect(bx + 13, by + 10, 1, 1);
    _bottle(ctx, bx, by, '#3b8be8');
  },
  'Archmage Vael': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#4a2a6a');
    _hood(ctx, bx, by, '#3a1a5a');
    // glowing eyes
    ctx.fillStyle = '#a45cff';
    ctx.fillRect(bx + 10, by + 10, 1, 1);
    ctx.fillRect(bx + 13, by + 10, 1, 1);
    // star on robe
    ctx.fillStyle = '#ffcf4d';
    ctx.fillRect(bx + 11, by + 16, 2, 2);
    ctx.fillRect(bx + 10, by + 17, 4, 1);
    ctx.fillRect(bx + 10, by + 18, 1, 1);
    ctx.fillRect(bx + 13, by + 18, 1, 1);
    _staff(ctx, bx, by, '#a45cff');
  },
  'Trader Pol': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#5a5a3a', '#3a2a1a', '#e8b88a');
    // cap
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(bx + 5, by - 1, 14, 4);
    ctx.fillStyle = '#ffcf4d';
    ctx.fillRect(bx + 9, by - 2, 6, 2);
    // backpack
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(bx + 0, by + 10, 4, 10);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(bx + 0, by + 10, 4, 1);
    _coin(ctx, bx, by);
  },
  'Aurora Keeper': (ctx, sx, sy, bob) => {
    // Tundra NPC: a hooded mage in icy robes with a glowing crystal staff
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _robe(ctx, bx, by, '#bfe0f0');
    _hood(ctx, bx, by, '#80a0c0');
    ctx.fillStyle = '#bfe8ff';
    ctx.fillRect(bx + 9, by + 8, 1, 1);
    ctx.fillRect(bx + 14, by + 8, 1, 1);
    // staff with a pulsing aurora orb
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(bx - 3, by + 4, 2, 22);
    const pulse = 0.6 + 0.4*Math.sin(performance.now()/300);
    ctx.fillStyle = `rgba(180,220,255,${pulse})`;
    ctx.beginPath();
    ctx.arc(bx - 2, by + 3, 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx - 2, by + 3, 2, 0, 7);
    ctx.fill();
  },
  'Merchant': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#5a3a5a', '#3a2a1a', '#f1c39a');
    // coin purse
    ctx.fillStyle = '#caa050';
    ctx.beginPath();
    ctx.arc(bx + 22, by + 22, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(bx + 21, by + 19, 2, 2);
  },

  // ----- Fallback -----
  'default': (ctx, sx, sy, bob) => {
    const bx = sx - SW / 2, by = sy - SH / 2 + bob;
    _body(ctx, bx, by, 0, '#7a5a3a', '#3a2a1a', '#f1c39a');
  },
};

// Dispatch an NPC sprite by name. Unknown names fall through to default.
// Sprint 11: try the atlas first; if the PNG isn't ready yet (or the
// toggle is off) we fall through to the canvas-primitive path. The
// first frame after a fresh load will use primitives; subsequent frames
// use the atlas. No flicker, no per-entity code change.

/**
 * Draw an NPC sprite centered at (sx, sy) on screen. Tries the atlas path
 * first (Sprint 11); falls through to canvas primitives when the atlas
 * toggle is off or the PNG hasn't decoded yet.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name - NPC name (key into NPC_SPRITES); unknown names use 'default'
 * @param {number} sx - screen-x of the entity's tile center
 * @param {number} sy - screen-y of the entity's tile center
 * @param {number} [bob=0] - vertical bob offset (pixels) for idle animation
 * @returns {void}
 */
export function drawNPCSprite(ctx, name, sx, sy, bob = 0) {
  // Try the atlas path. drawImageFromAtlas returns true on success, false
  // when the atlas isn't ready (or the toggle is off). We also let the
  // atlas handle 'default' — a player who enabled the toggle explicitly
  // asked for atlases; an unknown name should render the default atlas
  // frame, not silently fall back to the canvas default.
  if(isUsingAtlases() && drawImageFromAtlas(ctx, 'npc', name, sx, sy, { bob })) return;
  const fn = NPC_SPRITES[name] || NPC_SPRITES.default;
  fn(ctx, sx, sy, bob);
}

// ----- GEAR COLORS -----

function armorColor(armorItem) {
  if (!armorItem) return null;
  const id = armorItem.id || '';
  if (id.includes('chain')) return '#6a7a8a';
  if (id.includes('mage')) return '#4a2a6a';
  if (id.includes('leather')) return '#7a5a3a';
  return '#5a6a3a';
}

function helmColor(helmItem) {
  if (!helmItem) return null;
  const id = helmItem.id || '';
  if (id.includes('iron')) return '#6a6a6a';
  return '#7a6a5a';
}

function shieldColor(shieldItem) {
  if (!shieldItem) return null;
  const id = shieldItem.id || '';
  if (id.includes('iron')) return '#7a8a9a';
  return '#8a6a3a';
}

function weaponColor(weaponItem) {
  if (!weaponItem) return null;
  const id = weaponItem.id || '';
  if (id.includes('flame')) return '#e84a2a';
  if (id.includes('frost')) return '#80c0ff';
  if (id.includes('staff')) return '#6a3a1a';
  if (id.includes('bow') || id.includes('crossbow')) return '#8a6a3a';
  if (id.includes('warhammer')) return '#7a7a7a';
  if (id === 'greatsword') return '#b0b0b0';
  if (id.includes('halberd') || id.includes('spear')) return '#a08060';
  if (id.includes('dagger')) return '#c0c0c0';
  if (id.includes('sword')) return '#a0a0a0';
  return '#aaaaaa';
}

// ----- PLAYER SPRITE -----
// Draws the player body with equipped gear visible. The weapon is carried on
// the back. Shield is NOT drawn here — _drawShield in player.js handles it
// during the block. The attack slash is NOT drawn here — _drawSlashEffect in
// player.js handles that.
//
// facing: 'down'|'up'|'left'|'right'
// attackProgress: 0..1, 0 = just finished, 1 = ready to swing. We tilt the
// weapon back as the attack starts to give a visual windup.
// blocking, bob, invuln, flash: cosmetic states.
/**
 * Draw the player body with equipped gear visible. The weapon is carried on
 * the back. Shield and attack slash are NOT drawn here — player.js handles
 * those during block and attack windup.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx - screen-x of the entity's tile center
 * @param {number} sy - screen-y of the entity's tile center
 * @param {'down'|'up'|'left'|'right'} facing
 * @param {import('./data/gear.js').EquipmentMap} equipment - equipped armor / helm / weapon
 * @param {Object} [opts]
 * @param {boolean} [opts.flash=false]    - hit-flash: tint skin + eyes white for one frame
 * @param {boolean} [opts.invuln=false]   - i-frames shimmer dots on body
 * @param {boolean} [opts.blocking=false] - cosmetic block pose
 * @param {number}  [opts.attacking=0]    - attack timer (seconds remaining); 0 = idle
 * @param {number}  [opts.attackProgress=0] - 0..1 swing progress; 0 = just finished, 1 = ready
 * @param {number}  [opts.bob=0]          - vertical bob offset for walk animation
 * @returns {void}
 */
export function drawPlayerSprite(ctx, sx, sy, facing, equipment, opts = {}) {
  const { flash = false, invuln = false, blocking = false, attacking = 0,
          attackProgress = 0, bob = 0 } = opts;
  const bx = sx - SW / 2, by = sy - SH / 2 + bob;
  // EquipmentMap values are `string|Item|null` — narrow once so the rest of
  // this function can treat armor/helm/shield/weapon as a string-or-Item
  // without re-checking at every property access.
  /** @param {string|import('./data/gear.js').Item|null|undefined} x @returns {string} */
  const slotId = (x) => {
    if (typeof x === 'object' && x) {
      const item = x;
      return /** @type {string} */ (item.id || '');
    }
    return /** @type {string} */ (x || '');
  };
  const armor = equipment && equipment.armor ? equipment.armor : null;
  const helm = equipment && equipment.helm ? equipment.helm : null;
  const weapon = equipment && equipment.weapon ? equipment.weapon : null;

  // base shirt color reflects armor
  const shirt = armorColor(armor) || '#5a6a3a';
  const shirtDark = armor ? '#2a1a14' : '#3a2a1a';
  const pants = armor ? '#3a3024' : '#3a2a1a';
  const skin = flash ? '#fff' : '#f1c39a';

  // legs + boots
  ctx.fillStyle = pants;
  ctx.fillRect(bx + 6, by + 18, 4, 8);
  ctx.fillRect(bx + 14, by + 18, 4, 8);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(bx + 5, by + 24, 5, 4);
  ctx.fillRect(bx + 14, by + 24, 5, 4);
  // torso (armor-tinted)
  ctx.fillStyle = shirt;
  ctx.fillRect(bx + 5, by + 8, 14, 12);
  const armorId = slotId(armor);
  // chainmail cross-hatch detail
  if (armorId.includes('chain')) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = by + 9; y < by + 19; y += 3) {
      for (let x = bx + 6; x < bx + 18; x += 3) {
        if ((x + y) % 6 === 0) ctx.fillRect(x, y, 1, 1);
      }
    }
  } else if (armorId.includes('mage')) {
    // robe with gold trim
    ctx.fillStyle = '#ffcf4d';
    ctx.fillRect(bx + 5, by + 8, 1, 12);
    ctx.fillRect(bx + 18, by + 8, 1, 12);
    ctx.fillStyle = '#a45cff';
    ctx.fillRect(bx + 10, by + 12, 4, 4);
  }
  // belt
  ctx.fillStyle = shirtDark;
  ctx.fillRect(bx + 5, by + 18, 14, 2);
  ctx.fillStyle = '#caa050';
  ctx.fillRect(bx + 11, by + 18, 3, 2);
  // head (skin)
  ctx.fillStyle = skin;
  ctx.fillRect(bx + 7, by + 0, 10, 10);
  // hair tuft on top
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(bx + 8, by - 2, 8, 3);
  // eyes (direction-aware)
  ctx.fillStyle = flash ? '#fff' : '#1a1410';
  let ex1, ex2;
  if (facing === 'left')  { ex1 = 7;  ex2 = 7;  }
  else if (facing === 'right') { ex1 = 16; ex2 = 16; }
  else if (facing === 'up')    { ex1 = -1; ex2 = -1; }  // facing away — no eyes
  else { ex1 = 9; ex2 = 14; }  // 'down' — face the camera
  if (facing !== 'up') {
    ctx.fillRect(bx + ex1, by + 4, 2, 2);
    ctx.fillRect(bx + ex2, by + 4, 2, 2);
  }
  // mouth — only when facing down (front-facing)
  ctx.fillStyle = '#7a3a2a';
  if (facing === 'down') ctx.fillRect(bx + 10, by + 7, 4, 1);
  // back-of-head hair when facing up — covers the head silhouette so it reads as
  // "facing away" instead of a blank face
  if (facing === 'up') {
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(bx + 6, by + 1, 12, 6);
    // small dangling strand below the head
    ctx.fillRect(bx + 9, by + 7, 2, 4);
  }
  // helm overlay (drawn after head so it covers the top)
  if (helm) {
    const hc = helmColor(helm);
    ctx.fillStyle = hc;
    ctx.fillRect(bx + 5, by - 1, 14, 7);
    // visor slit
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(bx + 8, by + 3, 8, 2);
    // crest
    ctx.fillStyle = '#c83030';
    ctx.fillRect(bx + 11, by - 4, 2, 4);
  }
  // invulnerability shimmer
  if (invuln) {
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    ctx.fillRect(bx + 4, by + 0, 1, 4);
    ctx.fillRect(bx + 19, by + 8, 1, 4);
    ctx.fillRect(bx + 2, by + 16, 1, 3);
  }
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(bx + 12, by + 29, 9, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // weapon on back (or in hand during attack windup)
  if (weapon) _drawWeaponOnPlayer(ctx, bx, by, weapon, facing, attacking, attackProgress);
  // enchantment glow: pulsing halo around the player's body in the element color
  if (weapon && (typeof weapon === 'object') && /** @type {import('./data/gear.js').Item} */ (weapon).enchant){
    const info = ENCHANTMENTS[/** @type {import('./data/gear.js').Item} */ (weapon).enchant];
    if(info){
      const pulse = 0.35 + 0.15*Math.sin(performance.now()/180);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(bx + 12, by + 14, 14, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

// Render the equipped weapon. Two visual modes:
//   - Idle (attacking <= 0): held in the player's hand, angled naturally for the
//     current facing (tip down/forward toward where they're looking).
//   - Attacking (attacking > 0): drawn at the slash-arc tip via _drawSlashEffect
//     in player.js, so we draw nothing here to avoid double-rendering.
// The previous version drew the weapon "on the back" anchored at (bx+16, by+28)
// with the blade pointing down — which made the sword look like a tail dangling
// out of the character's feet. The fix below anchors the weapon at the hand
// (roughly bx+18, by+18 for a right-handed grip) and rotates it so the blade
// points in the player's facing direction.
function _drawWeaponOnPlayer(ctx, bx, by, weapon, facing, attacking, prog) {
  // During an attack the slash effect in player.js draws the weapon at the
  // arc tip — drawing it here too would cause double-rendering.
  if (attacking > 0) return;
  const wid = weapon.id || '';
  const wc = weaponColor(weapon) || '#aaaaaa';
  const woodC = '#5a3a22';
  // Hand anchor: mid-right of body for 'right', mid-left for 'left',
  // mid-bottom for 'down', mid-back for 'up'. We rotate the blade from this
  // anchor in facing direction so it looks gripped, not levitating.
  let hx, hy, baseAngle;
  switch (facing) {
    case 'left':  hx = bx + 4;  hy = by + 18; baseAngle = Math.PI;        break;
    case 'right': hx = bx + 20; hy = by + 18; baseAngle = 0;             break;
    case 'up':    hx = bx + 12; hy = by + 22; baseAngle = -Math.PI / 2;   break;
    case 'down':
    default:      hx = bx + 16; hy = by + 22; baseAngle =  Math.PI / 2;   break;
  }
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(baseAngle);
  if (wid.includes('bow') || wid.includes('crossbow')) {
    // short bow held horizontally — grip in hand, limbs curl away from body
    ctx.strokeStyle = woodC; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-3, 0, 9, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
    ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, -7);
    ctx.lineTo(2, 7);
    ctx.stroke();
  } else if (wid.includes('staff')) {
    // long staff held diagonally, orb-end pointing forward
    ctx.fillStyle = woodC;
    ctx.fillRect(-1, 0, 2, 18);
    ctx.fillStyle = '#a45cff';
    ctx.beginPath();
    ctx.arc(18, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (wid === 'halberd' || wid.includes('spear')) {
    // spear/halberd held forward, long shaft with tip/axe head at far end
    ctx.fillStyle = woodC;
    ctx.fillRect(-1, 0, 2, 18);
    ctx.fillStyle = wc;
    if (wid === 'halberd') {
      ctx.beginPath();
      ctx.moveTo(16, -3); ctx.lineTo(22, 0); ctx.lineTo(22, 6); ctx.lineTo(16, 5); ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(18, -3); ctx.lineTo(21, 0); ctx.lineTo(18, 3); ctx.closePath();
      ctx.fill();
    }
  } else if (wid === 'warhammer') {
    // warhammer: short shaft + big blocky head at far end
    ctx.fillStyle = woodC;
    ctx.fillRect(-1, 0, 2, 14);
    ctx.fillStyle = '#5a5a66';
    ctx.fillRect(13, -4, 7, 8);
    ctx.fillStyle = wc;
    ctx.fillRect(13, -4, 7, 2);
  } else if (wid === 'greatsword') {
    // greatsword: long blade + crossguard, held out at angle
    ctx.fillStyle = woodC;
    ctx.fillRect(-1, 0, 2, 5);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-2, 5, 6, 2);
    ctx.fillStyle = wc;
    ctx.fillRect(-1, 7, 3, 16);
    ctx.fillStyle = '#dadada';
    ctx.fillRect(0, 8, 1, 14);
    ctx.fillStyle = '#caa050';
    ctx.beginPath(); ctx.arc(0, 4, 2, 0, Math.PI * 2); ctx.fill();
  } else if (wid.includes('dagger')) {
    // dagger: short grip + stubby blade
    ctx.fillStyle = woodC;
    ctx.fillRect(-1, 0, 2, 4);
    ctx.fillStyle = wc;
    ctx.fillRect(-1, 4, 3, 7);
  } else {
    // default sword (one-handed): grip + crossguard + blade
    ctx.fillStyle = woodC;
    ctx.fillRect(-1, 0, 2, 5);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-3, 4, 6, 2);
    ctx.fillStyle = wc;
    ctx.fillRect(-1, 6, 3, 13);
    ctx.fillStyle = '#dadada';
    ctx.fillRect(0, 7, 1, 11);
    ctx.fillStyle = '#caa050';
    ctx.beginPath(); ctx.arc(0, 4, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ----- GEAR ICONS for the HUD -----
// Each function draws a small (24x24) gear icon at (x, y) top-left corner.
// The render target is the HUD slot-icon span (24x24 box). We use canvas
// because the canvas-drawn sprites scale crisply and look uniform across
// the in-world bodies and the equipment panel.

function _box(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

/**
 * Draw a 24x24 chest-plate icon at (x, y) for the HUD gear slot.
 * Detail (chainmail / mage trim / leather belt) is picked from armorItem.id.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left x of the icon
 * @param {number} y - top-left y of the icon
 * @param {import('./data/gear.js').Item|null|undefined} armorItem - resolved item, or null/undefined for empty slot
 * @returns {void}
 */
export function drawArmorIcon(ctx, x, y, armorItem) {
  const c = armorColor(armorItem) || '#7a7a7a';
  // chest plate silhouette
  ctx.fillStyle = c;
  ctx.fillRect(x + 4, y + 4, 16, 14);
  // shoulder caps
  ctx.fillRect(x + 2, y + 5, 3, 5);
  ctx.fillRect(x + 19, y + 5, 3, 5);
  // neckline
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(x + 10, y + 4, 4, 2);
  // center seam
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 11, y + 4, 1, 14);
  // detail based on type
  if (armorItem) {
    if ((armorItem.id || '').includes('chain')) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let yy = y + 6; yy < y + 18; yy += 2) {
        for (let xx = x + 4; xx < x + 20; xx += 2) {
          if ((xx + yy) % 4 === 0) ctx.fillRect(xx, yy, 1, 1);
        }
      }
    } else if ((armorItem.id || '').includes('mage')) {
      ctx.fillStyle = '#ffcf4d';
      ctx.fillRect(x + 4, y + 4, 1, 14);
      ctx.fillRect(x + 19, y + 4, 1, 14);
      ctx.fillStyle = '#a45cff';
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 7);
      ctx.lineTo(x + 15, y + 12);
      ctx.lineTo(x + 12, y + 17);
      ctx.lineTo(x + 9, y + 12);
      ctx.closePath();
      ctx.fill();
    } else if ((armorItem.id || '').includes('leather')) {
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + 7, y + 8, 2, 2);
      ctx.fillRect(x + 15, y + 8, 2, 2);
      ctx.fillRect(x + 11, y + 12, 2, 2);
      // belt line
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x + 4, y + 14, 16, 2);
    }
  }
  // border
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, 21, 21);
}

/**
 * Draw a 24x24 helm icon at (x, y) for the HUD gear slot. Iron helms get a
 * grey palette; other helms use the warm default.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left x of the icon
 * @param {number} y - top-left y of the icon
 * @param {import('./data/gear.js').Item|null|undefined} helmItem - resolved item, or null/undefined for empty slot
 * @returns {void}
 */
export function drawHelmIcon(ctx, x, y, helmItem) {
  const c = helmColor(helmItem) || '#8a8a8a';
  // dome
  ctx.fillStyle = c;
  ctx.fillRect(x + 4, y + 8, 16, 8);
  ctx.fillRect(x + 6, y + 6, 12, 2);
  ctx.fillRect(x + 8, y + 4, 8, 2);
  // visor slit
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x + 6, y + 11, 12, 2);
  // nose guard
  ctx.fillStyle = c;
  ctx.fillRect(x + 11, y + 11, 2, 3);
  // crest
  ctx.fillStyle = '#c83030';
  ctx.fillRect(x + 11, y + 2, 2, 4);
  // border
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, 21, 21);
}

/**
 * Draw a 24x24 heater-shield icon at (x, y) for the HUD gear slot. Iron
 * shields get a highlight stripe; wooden shields get grain detail.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left x of the icon
 * @param {number} y - top-left y of the icon
 * @param {import('./data/gear.js').Item|null|undefined} shieldItem - resolved item, or null/undefined for empty slot
 * @returns {void}
 */
export function drawShieldIcon(ctx, x, y, shieldItem) {
  const c = shieldColor(shieldItem) || '#8a6a3a';
  // heater shield silhouette
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 4);
  ctx.lineTo(x + 19, y + 4);
  ctx.lineTo(x + 19, y + 13);
  ctx.lineTo(x + 12, y + 21);
  ctx.lineTo(x + 5, y + 13);
  ctx.closePath();
  ctx.fill();
  // rim
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // boss (center)
  ctx.fillStyle = '#caa050';
  ctx.beginPath();
  ctx.arc(x + 12, y + 11, 2, 0, Math.PI * 2);
  ctx.fill();
  // detail based on type
  if (shieldItem && (shieldItem.id || '').includes('iron')) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 11, y + 6, 1, 9);
  } else {
    // wood grain
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 9, y + 7, 6, 1);
    ctx.fillRect(x + 10, y + 15, 4, 1);
  }
}

/**
 * Draw a 24x24 ring icon at (x, y) for the HUD gear slot. Empty ring is
 * grey; filled ring is gold with a purple gem.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left x of the icon
 * @param {number} y - top-left y of the icon
 * @param {import('./data/gear.js').Item|null|undefined} ringItem - resolved item, or null/undefined for empty slot
 * @returns {void}
 */
export function drawRingIcon(ctx, x, y, ringItem) {
  const c = ringItem ? '#ffcf4d' : '#aaaaaa';
  // band
  ctx.strokeStyle = c;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 12, y + 14, 7, 0, Math.PI * 2);
  ctx.stroke();
  // gem
  ctx.fillStyle = ringItem ? '#a45cff' : '#7a7a7a';
  ctx.beginPath();
  ctx.arc(x + 12, y + 6, 3, 0, Math.PI * 2);
  ctx.fill();
  // gem facet
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x + 11, y + 5, 1, 1);
  // border
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, 21, 21);
}

// ----- WEAPON ICON for the HUD -----
// Draws a 24x24 weapon icon. weaponItem is the resolved item or catalog id.
// Most callers will pass the item object; we look up .id. Returns true.
/**
 * Draw a 24x24 weapon icon at (x, y) for the HUD gear slot. Picks the
 * silhouette from weaponItem.id (bow, staff, spear, halberd, warhammer,
 * greatsword, dagger, sword default).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left x of the icon
 * @param {number} y - top-left y of the icon
 * @param {import('./data/gear.js').Item|string|null|undefined} weaponItem - resolved item or catalog id
 * @returns {true} always — kept for callers that use the return as a "drawn" flag
 */
export function drawWeaponIcon(ctx, x, y, weaponItem) {
  const wid = (weaponItem && typeof weaponItem === 'object' && weaponItem.id) || (typeof weaponItem === 'string' ? weaponItem : '');
  const wc = weaponColor(weaponItem) || '#aaaaaa';
  const woodC = '#5a3a22';
  ctx.save();
  if (wid.includes('bow') || wid.includes('crossbow')) {
    // bow + arrow
    ctx.strokeStyle = woodC; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 9, y + 12, 8, -Math.PI / 2.3, Math.PI / 2.3);
    ctx.stroke();
    ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 4);
    ctx.lineTo(x + 9, y + 20);
    ctx.stroke();
    // arrow
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(x + 12, y + 11, 8, 2);
    ctx.fillStyle = '#aaaaaa';
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 9);
    ctx.lineTo(x + 22, y + 12);
    ctx.lineTo(x + 20, y + 15);
    ctx.closePath();
    ctx.fill();
  } else if (wid.includes('staff')) {
    ctx.fillStyle = woodC;
    ctx.fillRect(x + 11, y + 6, 2, 16);
    ctx.fillStyle = '#a45cff';
    ctx.beginPath();
    ctx.arc(x + 12, y + 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + 10, y + 3, 1, 1);
  } else if (wid.includes('spear')) {
    ctx.fillStyle = woodC;
    ctx.fillRect(x + 11, y + 6, 2, 16);
    ctx.fillStyle = wc;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 1);
    ctx.lineTo(x + 16, y + 7);
    ctx.lineTo(x + 8, y + 7);
    ctx.closePath();
    ctx.fill();
  } else if (wid === 'halberd') {
    ctx.fillStyle = woodC;
    ctx.fillRect(x + 11, y + 6, 2, 16);
    ctx.fillStyle = wc;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 1);
    ctx.lineTo(x + 18, y + 4);
    ctx.lineTo(x + 18, y + 9);
    ctx.lineTo(x + 12, y + 7);
    ctx.closePath();
    ctx.fill();
  } else if (wid === 'warhammer') {
    ctx.fillStyle = woodC;
    ctx.fillRect(x + 11, y + 10, 2, 12);
    ctx.fillStyle = '#5a5a66';
    ctx.fillRect(x + 6, y + 4, 12, 7);
    ctx.fillStyle = wc;
    ctx.fillRect(x + 6, y + 4, 12, 2);
  } else if (wid === 'greatsword') {
    ctx.fillStyle = woodC;
    ctx.fillRect(x + 11, y + 12, 2, 8);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x + 8, y + 11, 8, 2);
    ctx.fillStyle = wc;
    ctx.fillRect(x + 10, y + 2, 4, 10);
    ctx.fillStyle = '#dadada';
    ctx.fillRect(x + 11, y + 3, 1, 8);
    ctx.fillStyle = '#caa050';
    ctx.beginPath();
    ctx.arc(x + 12, y + 20, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (wid.includes('dagger')) {
    ctx.fillStyle = woodC;
    ctx.fillRect(x + 11, y + 12, 2, 8);
    ctx.fillStyle = wc;
    ctx.fillRect(x + 10, y + 4, 4, 9);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x + 8, y + 12, 8, 2);
  } else {
    // sword (default)
    ctx.fillStyle = woodC;
    ctx.fillRect(x + 11, y + 12, 2, 8);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x + 8, y + 11, 8, 2);
    ctx.fillStyle = wc;
    ctx.fillRect(x + 10, y + 4, 4, 9);
    ctx.fillStyle = '#dadada';
    ctx.fillRect(x + 11, y + 5, 1, 7);
    ctx.fillStyle = '#caa050';
    ctx.beginPath();
    ctx.arc(x + 12, y + 20, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // border
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, 21, 21);
  ctx.restore();
  return true;
}
