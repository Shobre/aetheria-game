// Sprint 11 — Sprite atlas loader + cache + draw helper.
//
// Loads the PNG atlases declared in data/sprite-atlas.js once and caches
// the decoded HTMLImageElements. drawImageFromAtlas(name, sx, sy, opts)
// is the single entry point for everything in the game that wants a
// frame from an atlas.
//
// Design notes:
//   - The loader is browser-only. In Node (test harness) it returns a
//     stub that pretends the image loaded; tests assert on the data
//     shape and the manifest, not on the pixels.
//   - Loading is async (Image.src = url → onload). The draw helper
//     silently falls through to its fallback when the image isn't ready
//     yet — the first frame of a fresh load will use the canvas
//     primitives, and subsequent frames will use the atlas. No flicker.
//   - A single atlas, once loaded, is shared across every entity type
//     that maps to it. No per-entity decode cost.

import { SPRITE_ATLASES, lookupFrame } from '../data/sprite-atlas.js';

/**
 * @typedef {import('../data/sprite-atlas.js').AtlasDef} AtlasDef
 * @typedef {import('../data/sprite-atlas.js').AtlasFrame} AtlasFrame
 *
 * @typedef {Object} AtlasCacheEntry
 * @property {HTMLImageElement | {src:string, width:number, height:number, onload:any, onerror:any, complete:boolean}} img
 * @property {boolean} ready
 * @property {Error|null} err
 * @property {string} src
 *
 * @typedef {Object} DrawImageOpts
 * @property {number} [bob]    - vertical px offset for idle animation
 * @property {number} [alpha]  - 0..1
 * @property {number} [scale]  - pixel multiplier
 */

const cache = new Map();  // atlasId -> { img, ready, err, src }
let useAtlases = true;    // setting toggle, default ON

// Browser-only Image factory. Returns a stub in Node.
/**
 * @private
 * @returns {HTMLImageElement | {src:string, width:number, height:number, onload:any, onerror:any, complete:boolean}}
 */
function _makeImage(){
  if(typeof Image !== 'undefined') return new Image();
  // Node test harness: a stand-in. The draw helper never actually calls
  // .drawImage on it (because ready stays false), so the stub is just a
  // shape placeholder.
  return { src: '', width: 0, height: 0, onload: null, onerror: null, complete: false };
}

// Kick off the load for a single atlas. Idempotent — calling twice is
// safe and only triggers one HTTP request.
/**
 * @param {string} atlasId
 * @param {string} [basePath]
 * @returns {AtlasCacheEntry|null}
 */
export function loadAtlas(atlasId, basePath){
  if(cache.has(atlasId)) return cache.get(atlasId);
  const def = SPRITE_ATLASES.find(a => a.id === atlasId);
  if(!def) return null;
  // basePath defaults to the game's Vercel root. Callers can override
  // for testing (e.g. a CDN, a sub-directory).
  const bp = basePath || (typeof window !== 'undefined' ? (window.location.pathname.replace(/[^/]*$/, '') || '/') : './');
  const entry = { img: _makeImage(), ready: false, err: null, src: def.src };
  cache.set(atlasId, entry);
  if(typeof Image === 'undefined') return entry;  // Node: skip the load
  entry.img.onload  = () => { entry.ready = true; };
  entry.img.onerror = (e) => { entry.err = e || new Error('atlas load failed: ' + def.src); entry.ready = false; };
  entry.img.src = bp + def.src;
  return entry;
}

// Convenience: kick off every declared atlas. Call once on game boot.
/**
 * @param {string} [basePath]
 * @returns {void}
 */
export function loadAllAtlases(basePath){
  for(const a of SPRITE_ATLASES) loadAtlas(a.id, basePath);
}

// Settings toggle. When false, drawImageFromAtlas always returns false
// and the caller uses its canvas-primitive fallback path.
/**
 * @param {boolean} on
 * @returns {void}
 */
export function setUseAtlases(on){
  useAtlases = !!on;
}
/** @returns {boolean} */
export function isUsingAtlases(){
  return useAtlases;
}

// True when an atlas is loaded and the toggle is on. Used by the
// caller to decide whether to draw a fallback or not.
/**
 * @param {string} atlasId
 * @returns {boolean}
 */
export function isAtlasReady(atlasId){
  if(!useAtlases) return false;
  const e = cache.get(atlasId);
  return !!(e && e.ready);
}

// Draw a single frame. Returns true on a successful draw, false on
// fallback (atlas not loaded, frame not in manifest, or toggle off).
//
//   atlasId: 'npc' | 'enemies'
//   frame:   the name registered in the manifest ('Elder', 'slime', etc.)
//   sx, sy:  center of the entity on the canvas (matching sprites.js convention)
//   opts:
//     bob: vertical pixel offset for idle animation (default 0)
//     alpha: 0..1, default 1
//     scale: pixel-multiplier, default 1 (frames are 24x32 native; scale=2 renders at 48x64)
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} atlasId
 * @param {string} frame
 * @param {number} sx
 * @param {number} sy
 * @param {DrawImageOpts} [opts]
 * @returns {boolean} true on a successful draw
 */
export function drawImageFromAtlas(ctx, atlasId, frame, sx, sy, opts = {}){
  if(!useAtlases) return false;
  const entry = cache.get(atlasId);
  if(!entry || !entry.ready) return false;
  const coords = lookupFrame(atlasId, frame);
  if(!coords) return false;
  const [row, col, w, h] = coords;
  const bob = opts.bob || 0;
  const alpha = opts.alpha == null ? 1 : opts.alpha;
  const scale = opts.scale == null ? 1 : opts.scale;
  // The PNG frame sits at (col*frameW, row*frameH). We draw it
  // centered on (sx, sy + bob) at its native size, scaled.
  const dx = sx - (w * scale) / 2;
  const dy = sy - (h * scale) / 2 + bob;
  if(alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(entry.img, col * 24, row * 32, w, h, dx, dy, w * scale, h * scale);
  if(alpha < 1) ctx.globalAlpha = 1;
  return true;
}

// (Test hook removed — fallow flagged _resetCache as unused. If a future
// test needs to clear the cache between cases, expose it then.)
