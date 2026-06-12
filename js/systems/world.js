// World: tile-based map with procedural decoration, collision, and rendering.
export const TILE = 32;

// tile types
export const T = { GRASS:0, PATH:1, WATER:2, TREE:3, ROCK:4, FLOWER:5, SAND:6, WALL:7 };

const COLORS = {
  [T.GRASS]:  ['#3a7d44','#46934f'],
  [T.PATH]:   ['#b89b72','#c4a87f'],
  [T.WATER]:  ['#2f6fb0','#3a82c8'],
  [T.SAND]:   ['#d9c18a','#e3cd9b'],
};
const SOLID = new Set([T.WATER, T.TREE, T.ROCK, T.WALL]);

export class World {
  constructor(cols=60, rows=45, seed=1234){
    this.cols = cols; this.rows = rows;
    this.w = cols*TILE; this.h = rows*TILE;
    this.seed = seed;
    this.map = [];
    this.decor = [];     // {type,x,y} trees/rocks/flowers drawn on top
    this.npcs = [];
    this.chests = [];
    this._gen();
  }
  _rand(){ // simple seeded PRNG
    this.seed = (this.seed*9301 + 49297) % 233280;
    return this.seed/233280;
  }
  _gen(){
    for(let y=0;y<this.rows;y++){
      const row=[];
      for(let x=0;x<this.cols;x++){
        let t = T.GRASS;
        // border walls
        if(x===0||y===0||x===this.cols-1||y===this.rows-1) t=T.WALL;
        row.push(t);
      }
      this.map.push(row);
    }
    // a winding path
    let px = Math.floor(this.cols/2);
    for(let y=1;y<this.rows-1;y++){
      this.map[y][px]=T.PATH;
      this.map[y][px+1]=T.PATH;
      if(this._rand()<0.35) px += this._rand()<0.5?-1:1;
      px = Math.max(2, Math.min(this.cols-4, px));
    }
    // a lake
    const lx=Math.floor(this.cols*0.72), ly=Math.floor(this.rows*0.28), lr=5;
    for(let y=-lr;y<=lr;y++)for(let x=-lr;x<=lr;x++){
      if(x*x+y*y < lr*lr){ const gx=lx+x, gy=ly+y;
        if(gx>1&&gy>1&&gx<this.cols-2&&gy<this.rows-2) this.map[gy][gx]=T.WATER; }
    }
    // sand ring around lake
    for(let y=-lr-1;y<=lr+1;y++)for(let x=-lr-1;x<=lr+1;x++){
      const d=x*x+y*y; if(d>=lr*lr && d<(lr+1.6)*(lr+1.6)){
        const gx=lx+x, gy=ly+y;
        if(this.map[gy]&&this.map[gy][gx]===T.GRASS) this.map[gy][gx]=T.SAND; }
    }
    // scatter decor (trees/rocks/flowers) on grass, avoid path
    for(let i=0;i<260;i++){
      const x=1+Math.floor(this._rand()*(this.cols-2));
      const y=1+Math.floor(this._rand()*(this.rows-2));
      if(this.map[y][x]!==T.GRASS) continue;
      const r=this._rand();
      if(r<0.45){ this.map[y][x]=T.TREE; this.decor.push({type:'tree',x,y}); }
      else if(r<0.6){ this.map[y][x]=T.ROCK; this.decor.push({type:'rock',x,y}); }
      else if(r<0.85){ this.decor.push({type:'flower',x,y}); } // walkable
    }
    // NPCs
    this.npcs.push({ x: (px+3)*TILE, y: 6*TILE, name:'Elder', icon:'🧙',
      lines:['The shadow beasts grow bolder...','Take this, brave one. Press 1 to drink.'] });
    this.npcs.push({ x: 8*TILE, y: 30*TILE, name:'Merchant', icon:'🧌',
      lines:['Wares? I have only my charm today.'] });
    // chests
    this.chests.push({ x: 50*TILE, y: 38*TILE, opened:false, loot:{id:'potion',name:'Health Potion',icon:'🧪',qty:3,type:'consumable'} });
    this.chests.push({ x: 5*TILE, y: 8*TILE, opened:false, loot:{id:'gold',amount:50} });
  }
  isSolid(px,py){
    const x=Math.floor(px/TILE), y=Math.floor(py/TILE);
    if(x<0||y<0||x>=this.cols||y>=this.rows) return true;
    return SOLID.has(this.map[y][x]);
  }
  draw(ctx, cam){
    const x0=Math.max(0,Math.floor(cam.x/TILE));
    const y0=Math.max(0,Math.floor(cam.y/TILE));
    const x1=Math.min(this.cols, Math.ceil((cam.x+cam.w)/TILE));
    const y1=Math.min(this.rows, Math.ceil((cam.y+cam.h)/TILE));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const t=this.map[y][x];
      const base = (t===T.TREE||t===T.ROCK) ? T.GRASS : t;
      const pal = COLORS[base] || COLORS[T.GRASS];
      ctx.fillStyle = pal[(x+y)%2];
      const sx=x*TILE-cam.x, sy=y*TILE-cam.y;
      ctx.fillRect(sx, sy, TILE, TILE);
      if(t===T.WALL){ ctx.fillStyle='#1d2330'; ctx.fillRect(sx,sy,TILE,TILE);
        ctx.fillStyle='#2b3346'; ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4); }
      if(t===T.WATER){ ctx.fillStyle='rgba(255,255,255,.08)';
        ctx.fillRect(sx+4, sy+ (Math.sin((x+performance.now()/600))*3+6), TILE-8, 3); }
    }
    // decor on top
    for(const d of this.decor){
      const sx=d.x*TILE-cam.x, sy=d.y*TILE-cam.y;
      if(sx<-TILE||sy<-TILE||sx>cam.w+TILE||sy>cam.h+TILE) continue;
      if(d.type==='tree'){ ctx.fillStyle='#5a3a22'; ctx.fillRect(sx+13,sy+18,6,12);
        ctx.fillStyle='#2c5e34'; ctx.beginPath(); ctx.arc(sx+16,sy+14,13,0,7); ctx.fill();
        ctx.fillStyle='#357a40'; ctx.beginPath(); ctx.arc(sx+12,sy+12,7,0,7); ctx.fill(); }
      else if(d.type==='rock'){ ctx.fillStyle='#6b7280'; ctx.beginPath();
        ctx.arc(sx+16,sy+20,9,0,7); ctx.fill(); ctx.fillStyle='#8b939e';
        ctx.beginPath(); ctx.arc(sx+13,sy+18,4,0,7); ctx.fill(); }
      else if(d.type==='flower'){ ctx.fillStyle=['#e8413c','#ffcf4d','#a45cff'][(d.x+d.y)%3];
        ctx.fillRect(sx+14,sy+16,4,4); }
    }
    // chests
    for(const c of this.chests){
      const sx=c.x-cam.x, sy=c.y-cam.y;
      ctx.fillStyle=c.opened?'#5a4a2a':'#8a6a2a'; ctx.fillRect(sx+6,sy+10,20,16);
      ctx.fillStyle='#ffcf4d'; ctx.fillRect(sx+14,sy+16,4,4);
    }
    // NPCs
    for(const n of this.npcs){
      const sx=n.x-cam.x, sy=n.y-cam.y;
      ctx.font='24px serif'; ctx.textAlign='center';
      ctx.fillText(n.icon, sx+16, sy+26);
    }
  }
}

export class Camera {
  constructor(w,h){ this.x=0; this.y=0; this.w=w; this.h=h; this.shake=0; }
  resize(w,h){ this.w=w; this.h=h; }
  follow(target, world){
    this.x = target.x - this.w/2;
    this.y = target.y - this.h/2;
    this.x = Math.max(0, Math.min(world.w-this.w, this.x));
    this.y = Math.max(0, Math.min(world.h-this.h, this.y));
    if(this.shake>0){
      this.x += (Math.random()-0.5)*this.shake;
      this.y += (Math.random()-0.5)*this.shake;
      this.shake *= 0.85; if(this.shake<0.3) this.shake=0;
    }
  }
}
