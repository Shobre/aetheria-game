// Procedural sound + music via Web Audio API (no asset files needed - stays portable).
// Sprint 9 (real): replaced the setInterval scheduler with a proper lookahead
// (25ms tick, 100ms schedule-ahead) and added per-biome moods + a low-HP
// heartbeat layer.
import { MOODS, resolveMood, DEFAULT_MOOD } from '../data/music.js';

/**
 * @typedef {import('../data/music.js').MoodDef} MoodDef
 * @typedef {import('../data/music.js').MoodName} MoodName
 *
 * @typedef {Object} MusicState
 * Internal scheduler state for the currently playing music mood.
 * @property {MoodDef}   def
 * @property {GainNode}  master
 * @property {number}    idx
 * @property {string}    moodKey
 * @property {any}       scheduler      - setInterval handle
 * @property {number}    lookahead
 * @property {number}    scheduleAheadTime
 * @property {number}    nextNoteTime
 * @property {number}    stepsPerBeat
 *
 * @typedef {Object} HeartbeatState
 * @property {boolean}  active
 * @property {GainNode} gain
 * @property {any}      scheduler   - setInterval handle
 * @property {number}   idx
 * @property {number}   lastHpRatio
 *
 * @typedef {Object} AudioState
 * Audio instance state.
 * @property {AudioContext|null} ctx
 * @property {number} sfxVol
 * @property {number} musicVol
 * @property {MusicState|null} music
 * @property {string|null} musicMood
 * @property {boolean} boss
 * @property {HeartbeatState|null} heartbeat
 * @property {boolean} heartbeatEnabled
 * @property {number}  heartbeatThreshold
 * @property {number}  heartbeatIntensity   - 0..1, ramped smoothly from HP ratio
 */

export class Audio {
  constructor(){
    this.ctx=null; this.sfxVol=0.7; this.musicVol=0.4;
    this.music=null;          // {mood, master, scheduler, idx, intensity, lookahead, scheduleAheadTime}
    this.musicMood=null; this.boss=false;
    // Sprint 9: low-HP heartbeat layer. Owns its own gain node, thumps on a
    // schedule, cross-fades in/out based on the player's HP ratio.
    this.heartbeat=null;      // {active, gain, scheduler, idx, lastHpRatio}
    this.heartbeatEnabled=true;
    this.heartbeatThreshold=0.35;
    this.heartbeatIntensity=0;  // 0..1, ramped smoothly from HP ratio
  }
  /** @returns {void} */
  _ensure(){ if(!this.ctx) this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [vol]
   * @param {number|null} [slideTo]
   * @returns {void}
   */
  beep(freq, dur, type='square', vol=0.3, slideTo=null){
    this._ensure();
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t+dur);
    g.gain.setValueAtTime(vol*this.sfxVol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t+dur);
  }
  /**
   * @param {string} name
   * @returns {void}
   */
  play(name){
    switch(name){
      case 'swing': this.beep(420,0.12,'sawtooth',0.18,180); break;
      case 'fire':  this.beep(180,0.25,'sawtooth',0.25,520); break;
      case 'ice':   this.beep(880,0.3,'sine',0.2,300); break;
      case 'dodge': this.beep(300,0.15,'sine',0.15,600); break;
      case 'block': this.beep(160,0.1,'square',0.25); break;
      case 'parry': this.beep(800,0.06,'square',0.3,1200); this.beep(1200,0.08,'sine',0.2); break;
      case 'kill':  this.beep(140,0.2,'square',0.22,60); break;
      case 'drink': this.beep(500,0.15,'sine',0.2,800); break;
      case 'hurt':  this.beep(200,0.18,'sawtooth',0.25,90); break;
      case 'levelup': [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.beep(f,0.18,'square',0.22),i*90)); break;
      case 'pickup': this.beep(660,0.1,'square',0.2,990); break;
      case 'open':  this.beep(300,0.15,'triangle',0.2,500); break;
    }
  }

  // ---- procedural background music (Sprint 9: real overhaul) ----
  // A single scheduler tick (every 25ms) looks ~100ms ahead on the
  // WebAudio timeline and queues any notes that fall in that window. This
  // is the standard "lookahead scheduler" pattern — it removes the
  // drift and jitter that the old setInterval had when the tab lost
  // focus, plus it lets us do per-biome moods cleanly.
  /**
   * @param {string|null|undefined} declaredMood
   * @param {boolean} boss
   * @returns {void}
   */
  setMusic(declaredMood, boss){
    this._ensure();
    const moodKey = resolveMood(declaredMood, boss);
    const name = boss ? 'boss:' + moodKey : moodKey;
    if(this.music && this.musicMood === name) return; // already playing
    this.stopMusic();
    this.musicMood = name;
    this.boss = !!boss;
    const def = MOODS[moodKey] || MOODS[DEFAULT_MOOD];
    const master = this.ctx.createGain();
    master.gain.value = this.musicVol * (boss ? 0.5 : 0.32);
    master.connect(this.ctx.destination);
    const state = {
      def, master, idx: 0, moodKey,
      // lookahead scheduler config — short tick, generous ahead-time.
      // Tiny tick keeps CPU near zero; the scheduleAheadTime absorbs any
      // tick-rate jitter.
      scheduler: null,
      lookahead: 25,        // ms between scheduler ticks
      scheduleAheadTime: 0.10, // seconds of audio we keep queued ahead
      nextNoteTime: 0,      // ctx time when the next note will play
      stepsPerBeat: 4,      // chord on every 4th step (= every chordIndex loop)
    };
    state.nextNoteTime = this.ctx.currentTime + 0.05;  // small lead-in
    state.scheduler = setInterval(() => this._tickMusic(state), state.lookahead);
    this.music = state;
  }
  /** @param {MusicState} state @returns {void} */
  _tickMusic(state){
    if(!this.music || this.music !== state) return;
    const horizon = this.ctx.currentTime + state.scheduleAheadTime;
    while(state.nextNoteTime < horizon){
      this._scheduleNote(state, state.nextNoteTime);
      this._advanceNote(state);
    }
  }
  /**
   * @param {MusicState} state
   * @param {number} when
   * @returns {void}
   */
  _scheduleNote(state, when){
    const def = state.def;
    const idx = state.idx;
    const note = def.scale[idx % def.scale.length];
    // step up an octave every other cycle so the arpeggio moves
    const oct = (idx % (def.scale.length * 2)) >= def.scale.length ? 2 : 1;
    // chord on the downbeat (every Nth step) — play the chord notes too
    if(idx % state.stepsPerBeat === 0){
      const chord = def.chords[(idx / state.stepsPerBeat) % def.chords.length];
      for(const ci of chord){
        const f = def.scale[ci % def.scale.length] * oct;
        this._playOsc(state, def.type, f, when, def.tempo * 1.4, 0.7);
      }
    }
    // the lead note (always)
    this._playOsc(state, def.type, note * oct, when, def.tempo * def.feel, 1.0);
    // bass on every other downbeat
    if(idx % (state.stepsPerBeat * 2) === 0){
      this._playOsc(state, 'sine', (note / 2) * oct, when, def.tempo * 2.2, 0.5);
    }
  }
  /**
   * @param {MusicState} state
   * @param {OscillatorType} type
   * @param {number} freq
   * @param {number} when
   * @param {number} dur
   * @param {number} peak
   * @returns {void}
   */
  _playOsc(state, type, freq, when, dur, peak){
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(state.master);
    o.start(when);
    o.stop(when + dur + 0.05);
  }
  /** @param {MusicState} state @returns {void} */
  _advanceNote(state){
    state.nextNoteTime += state.def.tempo;
    state.idx++;
  }
  /** @returns {void} */
  stopMusic(){
    if(this.music){
      clearInterval(this.music.scheduler);
      try{ this.music.master.disconnect(); }catch(e){}
    }
    this.music = null;
    this.musicMood = null;
  }

  // ---- low-HP heartbeat (Sprint 9) ----
  // The heartbeat is a separate, independent layer that the Game class
  // drives each frame. We keep its gain node persistent and ramp the
  // volume to 0/1 based on how far below `heartbeatThreshold` the
  // player's HP is. The thump itself is a short "kick drum" — sine
  // pitched-down with a fast envelope.
  /**
   * @param {boolean} on
   * @returns {void}
   */
  setHeartbeatEnabled(on){
    this.heartbeatEnabled = !!on;
    if(!this.heartbeatEnabled && this.heartbeat) this._heartbeatGainTo(0);
  }
  /**
   * @param {number} hpRatio
   * @returns {void}
   */
  updateHeartbeat(hpRatio){
    if(!this.heartbeatEnabled){
      this.heartbeatIntensity = 0;
      if(this.heartbeat) this._heartbeatGainTo(0);
      return;
    }
    const t = this.heartbeatThreshold;
    // intensity = 0 above threshold, ramps to 1 as HP approaches 0
    let target = 0;
    if(hpRatio < t){
      // Map (t → 0) to (0 → 1). At threshold = 0, below threshold = full intensity.
      target = Math.max(0, Math.min(1, (t - hpRatio) / t));
    }
    this.heartbeatIntensity = target;
    // Only touch the audio graph if we have a context yet. updateHeartbeat
    // is called from the game loop and may run before the first user gesture
    // that unlocks the AudioContext; in that case we still want to track
    // intensity so it ramps correctly once the heartbeat layer spins up.
    if(this.ctx){
      this._ensureHeartbeat();
      this._heartbeatGainTo(target * this.musicVol * 0.45);
    }
  }
  /** @returns {void} */
  _ensureHeartbeat(){
    if(this.heartbeat) return;
    this._ensure();
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.ctx.destination);
    this.heartbeat = {
      gain,
      scheduler: null,
      // BPM speeds up as HP drops: 60 BPM at threshold, 110 BPM at 0 HP
      nextTime: this.ctx.currentTime + 0.05,
      lastBpm: 60,
    };
    this.heartbeat.scheduler = setInterval(() => this._tickHeartbeat(), 25);
  }
  /** @returns {void} */
  _tickHeartbeat(){
    if(!this.heartbeat || !this.ctx) return;
    const horizon = this.ctx.currentTime + 0.10;
    // BPM scales with intensity: 60 (low) → 110 (high)
    const bpm = 60 + (110 - 60) * this.heartbeatIntensity;
    const stepSec = 60 / bpm;
    this.heartbeat.lastBpm = bpm;
    while(this.heartbeat.nextTime < horizon){
      this._playHeartbeat(this.heartbeat.nextTime, stepSec);
      this.heartbeat.nextTime += stepSec;
    }
  }
  /**
   * @param {number} when
   * @param {number} stepSec
   * @returns {void}
   */
  _playHeartbeat(when, stepSec){
    // Two-osc thump: a low sine "boom" + a click
    const dur = stepSec * 0.9;
    const o1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(70, when);
    o1.frequency.exponentialRampToValueAtTime(35, when + dur * 0.5);
    g1.gain.setValueAtTime(0.0001, when);
    g1.gain.linearRampToValueAtTime(0.9, when + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o1.connect(g1); g1.connect(this.heartbeat.gain);
    o1.start(when); o1.stop(when + dur + 0.02);
    // small click on the attack
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = 'square';
    o2.frequency.value = 220;
    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.linearRampToValueAtTime(0.15, when + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    o2.connect(g2); g2.connect(this.heartbeat.gain);
    o2.start(when); o2.stop(when + 0.05);
  }
  /**
   * @param {number} target
   * @returns {void}
   */
  _heartbeatGainTo(target){
    if(!this.heartbeat) return;
    const t = this.ctx.currentTime;
    const g = this.heartbeat.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + 0.2);
  }
  /** @returns {void} */
  stopHeartbeat(){
    if(this.heartbeat){
      clearInterval(this.heartbeat.scheduler);
      try{ this.heartbeat.gain.disconnect(); }catch(e){}
    }
    this.heartbeat = null;
    this.heartbeatIntensity = 0;
  }

  // re-apply volume live when the settings slider changes
  /** @returns {void} */
  applyMusicVol(){
    if(this.music && this.music.master){
      this.music.master.gain.value = this.musicVol * (this.boss ? 0.5 : 0.32);
    }
    if(this.heartbeat){
      this.heartbeat.gain.gain.value = this.heartbeatIntensity * this.musicVol * 0.45;
    }
  }
  /**
   * @param {number} v   - new music volume (0..1)
   * @returns {void}
   */
  setMusicVol(v){
    this.musicVol = v;
    this.applyMusicVol();
  }
}
