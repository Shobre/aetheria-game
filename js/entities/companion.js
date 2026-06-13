// Companion system: recruitable NPCs that follow the player and fight enemies.
// Companions have a simple AI: follow player, attack nearby enemies, use abilities.
import { TILE } from '../systems/world.js';
import { rollRarity, applyRarity } from '../data/affixes.js';
import { makeItem } from '../data/gear.js';

export class Companion {
  constructor(name, icon, x, y){
    this.name=name; this.icon=icon; this.x=x; this.y=y;
    this.alive=true; this.level=1; this.xp=0;
    this.hp=80; this.maxHp=80; this.atk=8; this.def=2; this.spd=1.6;
    this.r=10; this.color='#88ddff';
    this._atkCd=0; this._followDist=40; this._aggroRange=120;
    this._target=null; this._deathTime=0;
    // ability: each companion has a unique ability
    this._abilityCd=0; this._abilityMaxCd=8;
  }
  get xpToNext(){ return this.level*50; }
  gainXp(amt){
    this.xp+=amt;
    while(this.xp>=this.xpToNext){ this.xp-=this.xpToNext; this.levelUp(); }
  }
  levelUp(){
    this.level++; this.maxHp+=15; this.hp=this.maxHp; this.atk+=2; this.def+=1;
  }
  update(dt, game, player){
    if(!this.alive) return;
    // decay cooldowns
    if(this._atkCd>0) this._atkCd-=dt;
    if(this._abilityCd>0) this._abilityCd-=dt;
    // find nearest enemy
    let nearest=null, nd=this._aggroRange;
    for(const e of game.enemies){
      if(e.dead) continue;
      const d=Math.hypot(e.x-this.x, e.y-this.y);
      if(d<nd){ nd=d; nearest=e; }
    }
    // also check boss
    if(game.boss && !game.boss.dead){
      const d=Math.hypot(game.boss.x-this.x, game.boss.y-this.y);
      if(d<nd){ nd=d; nearest=game.boss; }
    }
    this._target=nearest;
    if(this._target){
      // attack if in range
      const d=Math.hypot(this._target.x-this.x, this._target.y-this.y);
      if(d<30 && this._atkCd<=0){
        let dmg=Math.round(this.atk*(0.9+Math.random()*0.2));
        const ang=Math.atan2(this._target.y-this.y, this._target.x-this.x);
        this._target.hit(dmg, ang, game, 3);
        this._atkCd=1.0;
        if(this._target.dead) this.gainXp(20);
      }
      // move toward target
      if(d>24){ const ang=Math.atan2(this._target.y-this.y, this._target.x-this.x);
        this.x+=Math.cos(ang)*this.spd*60*dt; this.y+=Math.sin(ang)*this.spd*60*dt; }
      // use ability
      if(this._abilityCd<=0 && d<80){ this._useAbility(game, player); this._abilityCd=this._abilityMaxCd; }
    } else {
      // follow player
      const d=Math.hypot(player.x-this.x, player.y-this.y);
      if(d>this._followDist){
        const ang=Math.atan2(player.y-this.y, player.x-this.x);
        this.x+=Math.cos(ang)*this.spd*60*dt; this.y+=Math.sin(ang)*this.spd*60*dt;
      }
    }
    // clamp to world
    this.x=Math.max(20,Math.min(game.world.w-20,this.x));
    this.y=Math.max(20,Math.min(game.world.h-20,this.y));
  }
  _useAbility(game, player){
    // default: small AoE heal around companion
    const healAmt=10+this.level*3;
    player.heal(healAmt, game);
    game.floater('+'+healAmt+' HP', player.x, player.y-20, '#44ff88');
    game.spawnParticles(this.x, this.y, '#44ff88', 8);
  }
  draw(ctx, cam){
    if(!this.alive) return;
    const sx=this.x-cam.x, sy=this.y-cam.y;
    // body
    ctx.font='22px serif'; ctx.textAlign='center';
    ctx.fillText(this.icon, sx, sy+18);
    // name
    ctx.font='8px monospace'; ctx.fillStyle=this.color;
    ctx.fillText(this.name, sx, sy-8);
    // hp bar
    if(this.hp<this.maxHp){
      const pct=this.hp/this.maxHp;
      ctx.fillStyle='#333'; ctx.fillRect(sx-14,sy-4,28,4);
      ctx.fillStyle=pct>0.5?'#44ff88':pct>0.25?'#ffcf4d':'#e8413c';
      ctx.fillRect(sx-14,sy-4,28*pct,4);
    }
    // level badge
    ctx.font='7px monospace'; ctx.fillStyle='#ffe6a0';
    ctx.fillText('Lv'+this.level, sx+16, sy+4);
  }
  hit(dmg){
    this.hp-=dmg;
    if(this.hp<=0){ this.hp=0; this.alive=false; this._deathTime=performance.now(); }
  }
  serialize(){
    return { name:this.name, icon:this.icon, x:this.x, y:this.y, alive:this.alive,
      level:this.level, xp:this.xp, hp:this.hp, maxHp:this.maxHp, atk:this.atk, def:this.def };
  }
  static deserialize(data){
    const c=new Companion(data.name, data.icon, data.x, data.y);
    c.level=data.level||1; c.xp=data.xp||0; c.hp=data.hp||80; c.maxHp=data.maxHp||80;
    c.atk=data.atk||8; c.def=data.def||2; c.alive=data.alive!==false;
    return c;
  }
}

// Companion registry — recruitable companions
export const COMPANIONS = {
  kira: { name:'Kira', icon:'??', desc:'A skilled ranger with a healing aura.', color:'#88ffaa' },
  thorin: { name:'Thorin', icon:'??', desc:'A sturdy dwarf warrior.', color:'#ffaa44' },
  luna: { name:'Luna', icon:'??', desc:'A mage who blasts enemies with arcane bolts.', color:'#bb88ff' },
};
