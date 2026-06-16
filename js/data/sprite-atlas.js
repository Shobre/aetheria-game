// Sprint 11 — Sprite atlas manifest.
//
// Declarative description of which PNGs are sprite atlases, where they live,
// and how to slice them into named frames. The loader (sprite-atlas.js) reads
// this and exposes a drawImageFromAtlas(name, sx, sy, opts) API.
//
// Why a separate manifest (and not a build step):
//   - The game has no build pipeline. Everything ships as plain ES modules
//     and PNG files. A manifest makes the "which frame is which" mapping
//     legible to a human without writing build tooling.
//   - The frame coordinates are 1:1 with how the frames sit on the PNG —
//     no clever packing. Easy to edit in any image editor.
//   - A new entity type = one entry here, one new PNG (or a new row in an
//     existing PNG), zero engine code changes.
//
// Atlas layout conventions:
//   - Frame size: 24x32 (matches the SW/SH constants in sprites.js).
//   - Each row is one entity; each column is one animation phase.
//   - For the NPC atlas, column 0 is "idle, facing down" and column 1 is
//     "bob" (the half-step bobbing frame). Mirrors the bob parameter the
//     canvas-primitive drawNPCSprite expects.
//   - The first row is the fallback "default" sprite.

export const SPRITE_ATLASES = [
  {
    id: 'npc',
    src: 'assets/sprites/npc.png',
    frameW: 24,
    frameH: 32,
    // frames: { name: [row, col, width, height], ... }
    // row 0 = topmost. col 0 = leftmost.
    // Layout is the one produced by scripts/build-sprite-atlases.py
    // (1 default + 5 named in row 0; 6 named in row 1; 5 named in row 2;
    // 3 named in row 3). Coords below are 1:1 with the PNG.
    frames: {
      'default':         [0, 0, 24, 32],
      'Elder':           [0, 1, 24, 32],
      'Ranger':          [0, 2, 24, 32],
      'Nomad':           [0, 3, 24, 32],
      'Wayfarer':        [0, 4, 24, 32],
      'Hermit':          [0, 5, 24, 32],
      'Forager':         [1, 0, 24, 32],
      'Ember Sage':      [1, 1, 24, 32],
      'Mayor':           [1, 2, 24, 32],
      'Captain':         [1, 3, 24, 32],
      'Scholar':         [1, 4, 24, 32],
      'Bard':            [1, 5, 24, 32],
      'Banker':          [2, 0, 24, 32],
      'Smith Garon':     [2, 1, 24, 32],
      'Forge':           [2, 2, 24, 32],
      'Mira the Alchemist':[2, 3, 24, 32],
      'Archmage Vael':   [2, 4, 24, 32],
      'Trader Pol':      [3, 0, 24, 32],
      'Aurora Keeper':   [3, 1, 24, 32],
      'Merchant':        [3, 2, 24, 32],
    },
  },
  {
    id: 'enemies',
    src: 'assets/sprites/enemies.png',
    frameW: 24,
    frameH: 32,
    // Type names map 1:1 with the `t==='<name>'` cases in enemy.js's
    // draw() method. Some types share a frame (e.g. frost_mage and mage
    // both use 'mage' — the canvas-primitive code draws them with
    // different palettes, so the atlas loses that detail for those two).
    // Row 0: ground mobs. Row 1: casters + brutes + ice variants.
    frames: {
      'slime':       [0, 0, 24, 24],
      'bat':         [0, 1, 24, 24],
      'archer':      [0, 2, 24, 32],
      'boar':        [0, 3, 24, 24],
      'scorpion':    [0, 4, 24, 24],
      'golem':       [0, 5, 24, 32],
      'skeleton':    [1, 0, 24, 32],
      'frostling':   [1, 1, 24, 24],
      'yeti':        [1, 2, 24, 32],
      'mage':        [1, 3, 24, 32],
      'frost_mage':  [1, 3, 24, 32],   // shares frame with mage
      'berserker':   [1, 4, 24, 32],
      'spitter':     [1, 5, 24, 24],
      'ice_wraith':  [0, 0, 24, 24],   // small, shares slime frame
      'frost_golem': [0, 5, 24, 32],   // shares golem frame
      'snow_stalker':[1, 4, 24, 32],   // shares berserker frame
      'frozen_husk': [0, 0, 24, 24],   // shares slime frame
      'croaker':     [0, 0, 24, 24],   // shares slime frame
    },
  },
];

// Lookup helper: given an NPC name and the kind of atlas, return the
// frame coordinates [x, y, w, h] in the atlas image. Falls back to
// 'default' if the name isn't in the manifest. Returns null if no
// matching atlas exists at all.
export function lookupFrame(atlasId, frameName){
  const atlas = SPRITE_ATLASES.find(a => a.id === atlasId);
  if(!atlas) return null;
  // Exact match wins.
  if(atlas.frames[frameName]) return atlas.frames[frameName];
  // 'default' is the conventional fallback.
  if(atlas.frames.default) return atlas.frames.default;
  return null;
}

// List every frame the manifest declares across all atlases. Used by the
// test suite to assert on shape.
export function listAllFrames(){
  const out = {};
  for(const a of SPRITE_ATLASES){
    out[a.id] = Object.keys(a.frames);
  }
  return out;
}
