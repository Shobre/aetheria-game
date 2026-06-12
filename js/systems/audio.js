// Procedural sound + music via Web Audio API (no asset files needed — stays portable).
export class Audio {
  constructor(){
    this.ctx=null; this.sfxVol=0.7; this.musicVol=0.4;
    this.music=null;          // {osc, gain, timer, name}
    this.musicName=null; this.boss=false;
  }
  _ensure(){ if(!this.ctx) this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }

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
  play(name){
    switch(name){
      case 'swing': this.beep(420,0.12,'sawtooth',0.18,180); break;
      case 'fire':  this.beep(180,0.25,'sawtooth',0.25,520); break;
      case 'ice':   this.beep(880,0.3,'sine',0.2,300); break;
      case 'dodge': this.beep(300,0.15,'sine',0.15,600); break;
      case 'block': this.beep(160,0.1,'square',0.25); break;
      case 'kill':  this.beep(140,0.2,'square',0.22,60); break;
      case 'drink': this.beep(500,0.15,'sine',0.2,800); break;
      case 'hurt':  this.beep(200,0.18,'sawtooth',0.25,90); break;
      case 'levelup': [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.beep(f,0.18,'square',0.22),i*90)); break;
      case 'pickup': this.beep(660,0.1,'square',0.2,990); break;
      case 'open':  this.beep(300,0.15,'triangle',0.2,500); break;
    }
  }

  // ---- procedural background music ----
  // Looping arpeggio whose scale/tempo/timbre depend on mood (calm/tense/boss).
  _scale(mood){
    // note frequencies (Hz)
    if(mood==='calm')  return [261.6,293.7,329.6,392.0,440.0]; // C major pentatonic-ish
    if(mood==='tense') return [220.0,246.9,261.6,311.1,349.2]; // A minor-ish
    return [196.0,233.1,261.6,277.2,311.1,349.2];               // boss: darker, more notes
  }
  setMusic(mood, boss){
    this._ensure();
    const name=boss?'boss':(mood||'calm');
    if(this.musicName===name && !!this.boss===!!boss) return; // already playing
    this.stopMusic();
    this.musicName=name; this.boss=!!boss;
    const scale=this._scale(boss?'boss':name);
    const tempo=boss?150:(name==='tense'?96:74);              // ms between notes... computed below
    const step=boss?0.18:(name==='tense'?0.30:0.42);          // seconds per note
    const master=this.ctx.createGain();
    master.gain.value=this.musicVol*(boss?0.5:0.32);
    master.connect(this.ctx.destination);
    let i=0;
    const playNote=()=>{
      if(!this.music) return;
      const t=this.ctx.currentTime;
      const note=scale[i%scale.length];
      const oct=(i%(scale.length*2))>=scale.length?2:1;       // step up an octave each cycle
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=boss?'sawtooth':'triangle';
      o.frequency.value=note*oct;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(1,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,t+step*0.9);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t+step);
      // bass note on downbeats
      if(i%4===0){
        const bo=this.ctx.createOscillator(), bg=this.ctx.createGain();
        bo.type='sine'; bo.frequency.value=note/2*oct;
        bg.gain.setValueAtTime(0.5,t); bg.gain.exponentialRampToValueAtTime(0.001,t+step*2);
        bo.connect(bg); bg.connect(master); bo.start(t); bo.stop(t+step*2);
      }
      i++;
    };
    this.music={ master, timer:setInterval(playNote, step*1000), name };
    playNote();
  }
  stopMusic(){
    if(this.music){ clearInterval(this.music.timer);
      try{ this.music.master.disconnect(); }catch(e){}
      this.music=null; }
    this.musicName=null;
  }
  // re-apply volume live when the settings slider changes
  applyMusicVol(){
    if(this.music && this.music.master) this.music.master.gain.value=this.musicVol*(this.boss?0.5:0.32);
  }
}
