// Per-biome procedural music scales (Sprint 9, real).
// Each biome declares a scale (note frequencies in Hz), a chord pattern
// (which scale indices to stack on the downbeat), a tempo in seconds per
// note, an instrument wave type, and a "feel" parameter that biases the
// scheduler toward long (sustained) or short (staccato) notes.
//
// The music engine in audio.js reads one of these per map. Maps declare
// their mood as `music:'forest_tense'` etc.; unknown moods fall through
// to a neutral "calm" scale so a typo in maps.js doesn't kill audio.

/**
 * @typedef {Object} MoodDef
 * @property {number[]}    scale   - note frequencies (Hz)
 * @property {number[][]}  chords  - scale-index stacks per beat
 * @property {number}      tempo   - seconds per note
 * @property {OscillatorType} type - oscillator wave type
 * @property {number}      feel    - sustain bias, 0..1
 */

/**
 * @typedef {keyof typeof MOODS} MoodName
 */

/** @type {Record<string, MoodDef>} */
export const MOODS = {
  // ---- base moods (used directly by maps.js) ----
  calm: {
    scale: [261.6, 293.7, 329.6, 392.0, 440.0], // C major pentatonic
    chords: [[0,2,4], [1,3,0], [2,4,1], [3,0,2]],
    tempo: 0.42, type: 'triangle', feel: 0.7,
  },
  tense: {
    scale: [220.0, 246.9, 261.6, 311.1, 349.2], // A minor
    chords: [[0,2], [1,3], [2,4], [0,3]],
    tempo: 0.30, type: 'sawtooth', feel: 0.4,
  },
  boss: {
    scale: [196.0, 233.1, 261.6, 277.2, 311.1, 349.2], // darker, more notes
    chords: [[0,2,5], [1,3,0], [2,4,1], [0,3,5]],
    tempo: 0.18, type: 'sawtooth', feel: 0.3,
  },

  // ---- per-biome variants (Sprint 9) ----
  // Each biome has a "calm" and "tense" variant; the map's music field
  // picks which one (e.g. forest_tense, forest_calm). boss_xxx is the
  // boss fight variant for that biome.
  forest_calm:  { scale: [261.6, 311.1, 349.2, 392.0, 466.2], chords: [[0,2,4],[1,3,0],[2,4,1],[3,0,2]], tempo: 0.40, type: 'triangle', feel: 0.8 },
  forest_tense: { scale: [196.0, 233.1, 261.6, 311.1, 349.2], chords: [[0,2],[1,3],[2,4],[0,3]], tempo: 0.28, type: 'sawtooth', feel: 0.5 },
  desert_calm:  { scale: [293.7, 349.2, 392.0, 440.0, 523.3], chords: [[0,2,4],[1,3,4],[0,2,3],[2,3,4]], tempo: 0.50, type: 'sine', feel: 0.9 },
  desert_tense: { scale: [220.0, 261.6, 311.1, 349.2, 392.0], chords: [[0,2],[2,3],[1,3],[0,1]], tempo: 0.32, type: 'triangle', feel: 0.5 },
  snow_calm:    { scale: [349.2, 392.0, 440.0, 493.9, 587.3], chords: [[0,2,3],[1,3,4],[0,2,4],[1,3,4]], tempo: 0.46, type: 'sine', feel: 0.95 },
  snow_tense:   { scale: [293.7, 349.2, 392.0, 440.0, 493.9], chords: [[0,2],[1,3],[2,4],[0,3]], tempo: 0.32, type: 'sawtooth', feel: 0.5 },
  swamp_calm:   { scale: [174.6, 196.0, 220.0, 261.6, 293.7], chords: [[0,1,2],[1,2,3],[0,2,4],[1,3,4]], tempo: 0.55, type: 'sine', feel: 0.85 },
  swamp_tense:  { scale: [146.8, 174.6, 196.0, 220.0, 261.6], chords: [[0,1],[1,2],[2,3],[0,2]], tempo: 0.34, type: 'sawtooth', feel: 0.4 },
  tundra_calm:  { scale: [329.6, 392.0, 440.0, 493.9, 587.3], chords: [[0,2,3],[1,3,4],[0,2,4],[1,3,4]], tempo: 0.48, type: 'sine', feel: 0.95 },
  tundra_tense: { scale: [277.2, 329.6, 369.99, 440.0, 493.9], chords: [[0,2],[1,3],[2,4],[0,3]], tempo: 0.30, type: 'sawtooth', feel: 0.5 },
  cave_calm:    { scale: [196.0, 233.1, 261.6, 311.1, 349.2], chords: [[0,2,3],[1,3,4],[0,2,4],[1,2,4]], tempo: 0.50, type: 'sine', feel: 0.9 },
  cave_tense:   { scale: [164.8, 196.0, 233.1, 261.6, 311.1], chords: [[0,1],[1,2],[2,3],[0,2]], tempo: 0.36, type: 'sawtooth', feel: 0.4 },
  dungeon_calm: { scale: [174.6, 207.7, 233.1, 261.6, 311.1], chords: [[0,2,3],[1,2,4],[0,2,3],[1,2,4]], tempo: 0.45, type: 'triangle', feel: 0.7 },
  dungeon_tense:{ scale: [146.8, 174.6, 196.0, 233.1, 261.6], chords: [[0,1],[1,2],[2,3],[0,2]], tempo: 0.30, type: 'sawtooth', feel: 0.4 },
  city_calm:    { scale: [261.6, 329.6, 392.0, 440.0, 523.3], chords: [[0,2,4],[1,2,3],[0,2,4],[1,3,4]], tempo: 0.36, type: 'triangle', feel: 0.8 },
  city_tense:   { scale: [220.0, 261.6, 311.1, 349.2, 392.0], chords: [[0,2],[1,3],[2,4],[0,3]], tempo: 0.30, type: 'sawtooth', feel: 0.5 },
  city_boss:    { scale: [164.8, 196.0, 220.0, 261.6, 311.1, 349.2], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  house_calm:   { scale: [261.6, 293.7, 329.6, 392.0, 440.0], chords: [[0,2,4],[1,3,0],[2,4,1],[3,0,2]], tempo: 0.40, type: 'triangle', feel: 0.85 },
  home_calm:    { scale: [293.7, 349.2, 392.0, 440.0, 493.9], chords: [[0,2,4],[1,3,0],[2,4,1],[3,0,2]], tempo: 0.45, type: 'sine', feel: 0.95 }, // player's home: D major pentatonic, very sustained
  house_tense:  { scale: [220.0, 246.9, 261.6, 311.1, 349.2], chords: [[0,2],[1,3],[2,4],[0,3]], tempo: 0.30, type: 'sawtooth', feel: 0.5 },
  house_boss:   { scale: [196.0, 233.1, 261.6, 277.2, 311.1, 349.2], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  // Boss variants per biome — derived from the tense mood but darker
  forest_boss:  { scale: [146.8, 174.6, 196.0, 233.1, 277.2, 311.1], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  desert_boss:  { scale: [164.8, 196.0, 220.0, 261.6, 311.1, 349.2], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  snow_boss:    { scale: [174.6, 207.7, 246.9, 293.7, 349.2, 392.0], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  swamp_boss:   { scale: [130.8, 155.6, 174.6, 207.7, 246.9, 293.7], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  tundra_boss:  { scale: [155.6, 185.0, 220.0, 261.6, 311.1, 369.99], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  cave_boss:    { scale: [138.6, 164.8, 196.0, 233.1, 277.2, 311.1], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
  dungeon_boss: { scale: [123.5, 146.8, 174.6, 207.7, 246.9, 293.7], chords: [[0,2,5],[1,3,0],[2,4,1],[0,3,5]], tempo: 0.20, type: 'sawtooth', feel: 0.3 },
};

// Default fallback for unknown moods. Reuses the 'calm' mood so a typo in
// maps.js doesn't kill audio — and so unit tests have a stable default.
export const DEFAULT_MOOD = 'calm';

// Given a map's declared mood string and whether a boss is active, return
// the mood key the audio engine should load. Handles the implicit
// "biome" -> "biome_calm" / "biome_tense" mapping for maps that declare
// their mood as a bare biome name.
/**
 * @param {string|null|undefined} declared
 * @param {boolean} boss
 * @returns {string}
 */
export function resolveMood(declared, boss){
  if(!declared) return DEFAULT_MOOD;
  if(MOODS[declared]) return declared;
  // Try the explicit "biome_boss" form for boss fights first
  if(boss && MOODS[declared + '_boss']) return declared + '_boss';
  // Then fall through: "biome_calm" wins over "biome_tense" because the
  // default for any non-boss map is the calm variant. (Tense is a
  // deliberate override; bare "forest" should still feel safe.)
  if(MOODS[declared + '_calm']) return declared + '_calm';
  if(MOODS[declared + '_tense']) return declared + '_tense';
  return DEFAULT_MOOD;
}
