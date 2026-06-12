// World: generic biome/dungeon/house generator driven by map definitions.
import { MAPS } from '../data/maps.js';
export const TILE = 32;

// tile ids (internal — no external consumers, so not exported)
const T = { FLOOR:0, PATH:1, WATER:2, WALL:7, HOLE:8, LAVA:9, FLOORALT:10 };

// Per-biome palettes: [floorA, floorB, pathA, pathB, wallDark, wallLite, accent]
const BIOMES = {
  grass:  { fa:'#3a7d44', fb:'#46934f', pa:'#b89b72', pb:'#c4a87f', wd:'#1d2330', wl:'#2b3346', liquid:'#2f6fb0', liquid2:'#3a82c8', deco:['tree','rock','flower'] },
  forest: { fa:'#2c5e34', fb:'#356b3c', pa:'#7a6244', pb:'#8a7150', wd:'#16240f', wl:'#24371a', liquid:'#2f6fb0', liquid2:'#3a82c8', deco:['tree','tree','bush','flower'] },
  desert: { fa:'#d9c18a', fb:'#e3cd9b', pa:'#c2a060', pb:'#cdab6c', wd:'#7a5a30', wl:'#9a7440', liquid:'#3a82c8', liquid2:'#52a0d8', deco:['cactus','rock','rock'] },
  cave:   { fa:'#2a2f3e', fb:'#333a4d', pa:'#3e4658', pb:'#4a5468', wd:'#12151d', wl:'#1d2330', liquid:'#7a3fb0', liquid2:'#9a5fd0', deco:['crystal','rock','crystal'] },
  dungeon:{ fa:'#26262e', fb:'#2e2e38', pa:'#3a3a46', pb:'#444452', wd:'#101014', wl:'#1c1c24', liquid:'#8a2020', liquid2:'#b03030', deco:['bones','rock','pillar'] },
  house:  { fa:'#6b4a2f', fb:'#75512f', pa:'#8a6a3f', pb:'#967440', wd:'#3a2a1a', wl:'#5a4226', liquid:'#3a82c8', liquid2:'#52a0d8', deco:['barrel','crate'] },
};
const SOLID = new Set([T.WATER, T.WALL, T.LAVA]);

export class World {
  constructor(mapId){
    this.id = mapId;
    this.def = MAPS[mapId];
    this.cols = this.def.cols; this.rows = this.def.rows;
    this.w = this.cols*TILE; this.h = this.rows*TILE;
    this.biome = this.def.biome;
    this.pal = BIOMES[this.biome] || BIOMES.grass;
    this.seed = this.def.seed;
    this.map = [];
    this.decor = [];
    this.portals = [];
    this.npcs = [];
    this.chests = [];
    this._gen();
  }
  _rand(){ this.seed=(this.seed*9301+49297)%233280; return this.seed/233280; }

  _gen(){
    const interior = this.def.interior;
    // base fill
    for(let y=0;y<this.rows;y++){
      const row=[];
      for(let x=0;x<this.cols;x++){
        let t=T.FLOOR;
        if(x===0||y===0||x===this.cols-1||y===this.rows-1) t=T.WALL;
        row.push(t);
      }
      this.map.push(row);
    }

    if(interior){
      // simple room: inner floor with alt tile checker, no extra features
      for(let y=1;y<this.rows-1;y++)for(let x=1;x<this.cols-1;x++)
        this.map[y][x]=T.FLOOR;
      // rug in the center
      const cx=Math.floor(this.cols/2), cy=Math.floor(this.rows/2);
      for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++)
        if(this.map[y]&&this.map[y][x]!==undefined) this.map[y][x]=T.PATH;
      // a few barrels/crates against walls
      for(let i=0;i<6;i++){
        const x=2+Math.floor(this._rand()*(this.cols-4));
        const y=2+Math.floor(this._rand()*(this.rows-4));
        if(this.map[y][x]===T.FLOOR) this.decor.push({type:this.pal.deco[i%this.pal.deco.length],x,y});
      }
    } else if(this.biome==='dungeon' || this.biome==='cave'){
      this._genRooms();
    } else {
      this._genOpen();
    }

    this._placeFeatures();
  }

  // open biome: winding path + scattered solid decor + a water/lava pool
  _genOpen(){
    let px=Math.floor(this.cols/2);
    for(let y=1;y<this.rows-1;y++){
      this.map[y][px]=T.PATH;
      if(px+1<this.cols-1) this.map[y][px+1]=T.PATH;
      if(this._rand()<0.35) px += this._rand()<0.5?-1:1;
      px=Math.max(2,Math.min(this.cols-4,px));
    }
    // liquid pool (water, or lava in desert/none in cave handled by palette)
    const lx=Math.floor(this.cols*0.72), ly=Math.floor(this.rows*0.28), lr=4+Math.floor(this._rand()*2);
    for(let y=-lr;y<=lr;y++)for(let x=-lr;x<=lr;x++){
      if(x*x+y*y<lr*lr){ const gx=lx+x,gy=ly+y;
        if(gx>1&&gy>1&&gx<this.cols-2&&gy<this.rows-2) this.map[gy][gx]=T.WATER; }
    }
    // scatter decor on floor (some solid)
    const n=Math.floor(this.cols*this.rows*0.10);
    for(let i=0;i<n;i++){
      const x=1+Math.floor(this._rand()*(this.cols-2));
      const y=1+Math.floor(this._rand()*(this.rows-2));
      if(this.map[y][x]!==T.FLOOR) continue;
      const r=this._rand();
      const kind=this.pal.deco[Math.floor(this._rand()*this.pal.deco.length)];
      if(r<0.5){ // solid obstacle
        this.map[y][x]=T.WALL; this.decor.push({type:kind,x,y,solid:true});
      } else if(r<0.75){ this.decor.push({type:kind,x,y}); } // walkable deco
    }
  }

  // dungeon/cave: carve rooms connected by corridors
  _genRooms(){
    // fill solid, carve
    for(let y=1;y<this.rows-1;y++)for(let x=1;x<this.cols-1;x++) this.map[y][x]=T.WALL;
    const rooms=[];
    const count=6+Math.floor(this._rand()*4);
    for(let i=0;i<count;i++){
      const rw=5+Math.floor(this._rand()*6), rh=5+Math.floor(this._rand()*6);
      const rx=2+Math.floor(this._rand()*(this.cols-rw-3));
      const ry=2+Math.floor(this._rand()*(this.rows-rh-3));
      for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++) this.map[y][x]=T.FLOOR;
      rooms.push({cx:Math.floor(rx+rw/2),cy:Math.floor(ry+rh/2)});
    }
    // connect rooms with L-corridors
    for(let i=1;i<rooms.length;i++){
      const a=rooms[i-1], b=rooms[i];
      for(let x=Math.min(a.cx,b.cx);x<=Math.max(a.cx,b.cx);x++){ this.map[a.cy][x]=T.PATH; }
      for(let y=Math.min(a.cy,b.cy);y<=Math.max(a.cy,b.cy);y++){ this.map[y][b.cx]=T.PATH; }
    }
    this._rooms=rooms;
    // decor inside rooms
    for(let i=0;i<count*2;i++){
      const x=2+Math.floor(this._rand()*(this.cols-4));
      const y=2+Math.floor(this._rand()*(this.rows-4));
      if(this.map[y][x]===T.FLOOR && this._rand()<0.5)
        this.decor.push({type:this.pal.deco[Math.floor(this._rand()*this.pal.deco.length)],x,y});
    }
  }

  // place portals, npcs, chests from the map def, ensuring their tiles are walkable
  _placeFeatures(){
    for(const p of (this.def.portals||[])){
      // clear the portal tile so it is reachable
      if(this.map[p.y]&&this.map[p.y][p.x]!==undefined) this.map[p.y][p.x]=T.PATH;
      this.portals.push({ ...p, wx:p.x*TILE+TILE/2, wy:p.y*TILE+TILE/2 });
    }
    for(const n of (this.def.npcs||[])){
      if(this.map[n.y]&&this.map[n.y][n.x]!==undefined) this.map[n.y][n.x]=T.FLOOR;
      this.npcs.push({ ...n, wx:n.x*TILE, wy:n.y*TILE });
    }
    (this.def.chests||[]).forEach((c,i)=>{
      if(this.map[c.y]&&this.map[c.y][c.x]!==undefined) this.map[c.y][c.x]=T.FLOOR;
      this.chests.push({ ...c, idx:i, wx:c.x*TILE, wy:c.y*TILE, opened:false });
    });
  }

  isSolid(px,py){
    const x=Math.floor(px/TILE), y=Math.floor(py/TILE);
    if(x<0||y<0||x>=this.cols||y>=this.rows) return true;
    return SOLID.has(this.map[y][x]);
  }

  // find a walkable spawn near a tile (for enemies)
  randomFloor(rand){
    for(let i=0;i<60;i++){
      const x=1+Math.floor(rand()*(this.cols-2));
      const y=1+Math.floor(rand()*(this.rows-2));
      if(this.map[y][x]===T.FLOOR) return {x:x*TILE+16,y:y*TILE+16};
    }
    return {x:this.w/2,y:this.h/2};
  }

  draw(ctx, cam){
    const P=this.pal;
    const x0=Math.max(0,Math.floor(cam.x/TILE)), y0=Math.max(0,Math.floor(cam.y/TILE));
    const x1=Math.min(this.cols,Math.ceil((cam.x+cam.w)/TILE));
    const y1=Math.min(this.rows,Math.ceil((cam.y+cam.h)/TILE));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const t=this.map[y][x];
      const sx=x*TILE-cam.x, sy=y*TILE-cam.y;
      let col;
      if(t===T.PATH) col=(x+y)%2?P.pa:P.pb;
      else if(t===T.WATER) col=(x+y)%2?P.liquid:P.liquid2;
      else col=(x+y)%2?P.fa:P.fb;
      ctx.fillStyle=col; ctx.fillRect(sx,sy,TILE,TILE);
      if(t===T.WALL){ ctx.fillStyle=P.wd; ctx.fillRect(sx,sy,TILE,TILE);
        ctx.fillStyle=P.wl; ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4); }
      if(t===T.WATER){ ctx.fillStyle='rgba(255,255,255,.08)';
        ctx.fillRect(sx+4, sy+(Math.sin(x+performance.now()/600)*3+6), TILE-8, 3); }
    }
    // portals (glowing pads)
    for(const p of this.portals){
      const sx=p.x*TILE-cam.x, sy=p.y*TILE-cam.y;
      const pulse=0.5+0.5*Math.sin(performance.now()/300);
      ctx.fillStyle=p.door?'#5a3a1a':`rgba(164,92,255,${0.4+pulse*0.4})`;
      if(p.door){ ctx.fillRect(sx+4,sy+2,TILE-8,TILE-2);
        ctx.fillStyle='#2a1a0a'; ctx.fillRect(sx+9,sy+6,TILE-18,TILE-6); }
      else { ctx.beginPath(); ctx.arc(sx+16,sy+16,11,0,7); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${pulse*0.6})`; ctx.beginPath(); ctx.arc(sx+16,sy+16,5,0,7); ctx.fill(); }
    }
    // decor
    for(const d of this.decor){
      const sx=d.x*TILE-cam.x, sy=d.y*TILE-cam.y;
      if(sx<-TILE||sy<-TILE||sx>cam.w+TILE||sy>cam.h+TILE) continue;
      this._drawDecor(ctx,d.type,sx,sy);
    }
    // chests
    for(const c of this.chests){
      const sx=c.x*TILE-cam.x, sy=c.y*TILE-cam.y;
      ctx.fillStyle=c.opened?'#5a4a2a':'#8a6a2a'; ctx.fillRect(sx+6,sy+10,20,16);
      ctx.fillStyle=c.opened?'#3a2e1a':'#ffcf4d'; ctx.fillRect(sx+14,sy+16,4,4);
    }
    // npcs
    for(const n of this.npcs){
      const sx=n.x*TILE-cam.x, sy=n.y*TILE-cam.y;
      ctx.font='24px serif'; ctx.textAlign='center';
      ctx.fillText(n.icon, sx+16, sy+26);
      if(n.shop){ ctx.font='10px serif'; ctx.fillText('🛒', sx+24, sy+6); }
    }
  }

  _drawDecor(ctx,type,sx,sy){
    switch(type){
      case 'tree': ctx.fillStyle='#5a3a22'; ctx.fillRect(sx+13,sy+18,6,12);
        ctx.fillStyle='#2c5e34'; ctx.beginPath(); ctx.arc(sx+16,sy+14,13,0,7); ctx.fill();
        ctx.fillStyle='#357a40'; ctx.beginPath(); ctx.arc(sx+12,sy+12,7,0,7); ctx.fill(); break;
      case 'bush': ctx.fillStyle='#2c5e34'; ctx.beginPath(); ctx.arc(sx+16,sy+20,9,0,7); ctx.fill();
        ctx.fillStyle='#3a7048'; ctx.beginPath(); ctx.arc(sx+12,sy+18,5,0,7); ctx.fill(); break;
      case 'rock': ctx.fillStyle='#6b7280'; ctx.beginPath(); ctx.arc(sx+16,sy+20,9,0,7); ctx.fill();
        ctx.fillStyle='#8b939e'; ctx.beginPath(); ctx.arc(sx+13,sy+18,4,0,7); ctx.fill(); break;
      case 'flower': ctx.fillStyle=['#e8413c','#ffcf4d','#a45cff'][(sx+sy)%3|0]; ctx.fillRect(sx+14,sy+16,4,4); break;
      case 'cactus': ctx.fillStyle='#3a7048'; ctx.fillRect(sx+13,sy+10,6,18);
        ctx.fillRect(sx+8,sy+15,5,4); ctx.fillRect(sx+19,sy+13,5,4); break;
      case 'crystal': ctx.fillStyle='#9a5fd0'; ctx.beginPath(); ctx.moveTo(sx+16,sy+6);
        ctx.lineTo(sx+22,sy+24); ctx.lineTo(sx+10,sy+24); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#c79ff0'; ctx.fillRect(sx+14,sy+12,3,8); break;
      case 'bones': ctx.fillStyle='#d8d0c0'; ctx.fillRect(sx+10,sy+18,12,3);
        ctx.fillRect(sx+10,sy+15,3,8); ctx.fillRect(sx+19,sy+15,3,8); break;
      case 'pillar': ctx.fillStyle='#55555f'; ctx.fillRect(sx+10,sy+4,12,24);
        ctx.fillStyle='#6a6a74'; ctx.fillRect(sx+8,sy+2,16,4); ctx.fillRect(sx+8,sy+26,16,4); break;
      case 'barrel': ctx.fillStyle='#7a5230'; ctx.fillRect(sx+9,sy+10,14,18);
        ctx.fillStyle='#5a3a1f'; ctx.fillRect(sx+9,sy+14,14,2); ctx.fillRect(sx+9,sy+22,14,2); break;
      case 'crate': ctx.fillStyle='#8a6a3f'; ctx.fillRect(sx+8,sy+12,16,16);
        ctx.strokeStyle='#5a4226'; ctx.lineWidth=2; ctx.strokeRect(sx+8,sy+12,16,16); break;
    }
  }
}

export class Camera {
  constructor(w,h){ this.x=0;this.y=0;this.w=w;this.h=h;this.shake=0; }
  resize(w,h){ this.w=w; this.h=h; }
  follow(target, world){
    this.x=target.x-this.w/2; this.y=target.y-this.h/2;
    this.x=Math.max(0,Math.min(world.w-this.w,this.x));
    this.y=Math.max(0,Math.min(world.h-this.h,this.y));
    if(world.w<this.w) this.x=(world.w-this.w)/2;
    if(world.h<this.h) this.y=(world.h-this.h)/2;
    if(this.shake>0){ this.x+=(Math.random()-0.5)*this.shake; this.y+=(Math.random()-0.5)*this.shake;
      this.shake*=0.85; if(this.shake<0.3) this.shake=0; }
  }
}
