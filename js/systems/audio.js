// Procedural sound via Web Audio API (no asset files needed).
export class Audio {
  constructor(){ this.ctx=null; this.sfxVol=0.7; this.musicVol=0.4; this.musicNode=null; }
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
}
