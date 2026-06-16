// World: generic biome/dungeon/house generator driven by map definitions.
import { MAPS } from '../data/maps.js';
import { drawNPCSprite } from '../sprites.js';
export const TILE = 32;

// tile ids (internal - no external consumers, so not exported)
const T = { FLOOR:0, PATH:1, WATER:2, WALL:7, HOLE:8, LAVA:9, FLOORALT:10 };

// Per-biome palettes: [floorA, floorB, pathA, pathB, wallDark, wallLite, accent]
const BIOMES = {
  grass:  { fa:'#3a7d44', fb:'#46934f', pa:'#b89b72', pb:'#c4a87f', wd:'#1d2330', wl:'#2b3346', liquid:'#2f6fb0', liquid2:'#3a82c8', deco:['tree','rock','flower'] },
  forest: { fa:'#2c5e34', fb:'#356b3c', pa:'#7a6244', pb:'#8a7150', wd:'#16240f', wl:'#24371a', liquid:'#2f6fb0', liquid2:'#3a82c8', deco:['tree','tree','bush','flower'] },
  desert: { fa:'#d9c18a', fb:'#e3cd9b', pa:'#c2a060', pb:'#cdab6c', wd:'#7a5a30', wl:'#9a7440', liquid:'#3a82c8', liquid2:'#52a0d8', deco:['cactus','rock','rock'] },
  cave:   { fa:'#2a2f3e', fb:'#333a4d', pa:'#3e4658', pb:'#4a5468', wd:'#12151d', wl:'#1d2330', liquid:'#7a3fb0', liquid2:'#9a5fd0', deco:['crystal','rock','crystal'] },
  dungeon:{ fa:'#26262e', fb:'#2e2e38', pa:'#3a3a46', pb:'#444452', wd:'#101014', wl:'#1c1c24', liquid:'#8a2020', liquid2:'#b03030', deco:['bones','rock','pillar'] },
  house:  { fa:'#6b4a2f', fb:'#75512f', pa:'#8a6a3f', pb:'#967440', wd:'#3a2a1a', wl:'#5a4226', liquid:'#3a82c8', liquid2:'#52a0d8', deco:['barrel','crate'] },
  snow:   { fa:'#dfe9f2', fb:'#eaf2fa', pa:'#b8c6d6', pb:'#c6d2e0', wd:'#6a7c92', wl:'#8a9cb2', liquid:'#7fc8e8', liquid2:'#a0dcf2', deco:['pine','snowrock','pine'] },
  swamp:  { fa:'#3a4a2a', fb:'#445232', pa:'#4a4030', pb:'#564a38', wd:'#1a2410', wl:'#26341a', liquid:'#4a5a2a', liquid2:'#5e7236', deco:['deadtree','reed','rock'] },
  city:   { fa:'#4a6a48', fb:'#547652', pa:'#9a9088', pb:'#a8a096', wd:'#3a3038', wl:'#5a4e58', liquid:'#3a82c8', liquid2:'#52a0d8', deco:['lamp','fountain','crate'] },
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
    } else if(this.def.town){
      this._genCity();
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

  // town: cobbled plaza with cross avenues + building blocks at each door portal.
  _genCity(){
    for(let y=1;y<this.rows-1;y++)for(let x=1;x<this.cols-1;x++) this.map[y][x]=T.FLOOR; // grass yards
    const cx=Math.floor(this.cols/2), cy=Math.floor(this.rows/2);
    // main avenues (cobblestone paths)
    for(let x=1;x<this.cols-1;x++){ this.map[cy][x]=T.PATH; this.map[cy-1][x]=T.PATH; }
    for(let y=1;y<this.rows-1;y++){ this.map[y][cx]=T.PATH; this.map[y][cx-1]=T.PATH; }
    // central plaza
    for(let y=cy-4;y<=cy+4;y++)for(let x=cx-4;x<=cx+4;x++)
      if(this.map[y]&&this.map[y][x]!==undefined) this.map[y][x]=T.PATH;
    // building blocks (solid) around door portals get placed in _placeFeatures via decor.
    // lamps + a fountain for ambience
    this.decor.push({type:'fountain', x:cx-1, y:cy-1});
    const lamps=[[6,6],[this.cols-7,6],[6,this.rows-7],[this.cols-7,this.rows-7]];
    for(const [lx,ly] of lamps) this.decor.push({type:'lamp', x:lx, y:ly});
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
    if(y<0||y>=this.rows||x<0||x>=this.cols) return true;
    if(!this.map[y]) return true;
    return SOLID.has(this.map[y][x]);
  }

  // Snap a world point to the centre of the nearest walkable tile.
  // Keeps the player from spawning inside a wall when a portal landing
  // tile (or checkpoint) happens to be solid rock/decor.
  nearestOpen(px,py){
    const cx=Math.floor(px/TILE), cy=Math.floor(py/TILE);
    const free=(x,y)=> x>=0&&y>=0&&x<this.cols&&y<this.rows && !SOLID.has(this.map[y][x]);
    if(free(cx,cy)) return { x:cx*TILE+TILE/2, y:cy*TILE+TILE/2 };
    for(let rad=1; rad<Math.max(this.cols,this.rows); rad++){
      for(let dy=-rad; dy<=rad; dy++)for(let dx=-rad; dx<=rad; dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==rad) continue; // ring only
        if(free(cx+dx,cy+dy)) return { x:(cx+dx)*TILE+TILE/2, y:(cy+dy)*TILE+TILE/2 };
      }
    }
    return { x:px, y:py };
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

  // ---- pathfinding helpers (used by enemy AI to navigate around walls) ----
  _blockedTile(x,y){
    if(x<0||y<0||x>=this.cols||y>=this.rows) return true;
    return SOLID.has(this.map[y][x]);
  }
  // straight-line tile raycast: true if nothing solid sits between the two world points
  hasLineOfSight(x0,y0,x1,y1){
    const dist=Math.hypot(x1-x0,y1-y0);
    const steps=Math.ceil(dist/(TILE*0.5));
    if(steps<=0) return true;
    for(let i=1;i<steps;i++){
      const t=i/steps, px=x0+(x1-x0)*t, py=y0+(y1-y0)*t;
      if(this.isSolid(px,py)) return false;
    }
    return true;
  }
  // A* on the tile grid (4-dir). Returns array of world-coord waypoints (tile centers)
  // from start toward goal, or null. Node expansion is capped to stay cheap.
  findPath(sx,sy,tx,ty,maxNodes=700){
    const sX=Math.floor(sx/TILE), sY=Math.floor(sy/TILE);
    let gX=Math.floor(tx/TILE), gY=Math.floor(ty/TILE);
    if(this._blockedTile(sX,sY)) return null;
    // if goal tile is solid, snap to nearest free 4-neighbour
    if(this._blockedTile(gX,gY)){
      const adj=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dy])=>!this._blockedTile(gX+dx,gY+dy));
      if(!adj) return null; gX+=adj[0]; gY+=adj[1];
    }
    if(sX===gX && sY===gY) return null;
    const key=(x,y)=>y*this.cols+x;
    const open=[{x:sX,y:sY,g:0,f:Math.abs(sX-gX)+Math.abs(sY-gY)}];
    const came=new Map(), gScore=new Map(); gScore.set(key(sX,sY),0);
    let nodes=0;
    while(open.length){
      // pop lowest f (linear scan - grids are small)
      let bi=0; for(let i=1;i<open.length;i++) if(open[i].f<open[bi].f) bi=i;
      const cur=open.splice(bi,1)[0];
      if(cur.x===gX && cur.y===gY){
        // reconstruct
        const path=[]; let ck=key(cur.x,cur.y), cx=cur.x, cy=cur.y;
        while(came.has(ck)){ path.push({x:cx*TILE+TILE/2,y:cy*TILE+TILE/2});
          const pv=came.get(ck); cx=pv.x; cy=pv.y; ck=key(cx,cy); }
        path.reverse(); return path.length?path:null;
      }
      if(++nodes>maxNodes) return null;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=cur.x+dx, ny=cur.y+dy;
        if(this._blockedTile(nx,ny)) continue;
        const nk=key(nx,ny), ng=cur.g+1;
        if(gScore.has(nk) && ng>=gScore.get(nk)) continue;
        gScore.set(nk,ng); came.set(nk,{x:cur.x,y:cur.y});
        open.push({x:nx,y:ny,g:ng,f:ng+Math.abs(nx-gX)+Math.abs(ny-gY)});
      }
    }
    return null;
  }

  _tileColor(t, x, y){
    const P=this.pal;
    if(t===T.PATH) return (x+y)%2?P.pa:P.pb;
    if(t===T.WATER) return (x+y)%2?P.liquid:P.liquid2;
    return (x+y)%2?P.fa:P.fb;
  }
  _drawTile(ctx, t, x, y, sx, sy){
    ctx.fillStyle=this._tileColor(t,x,y);
    ctx.fillRect(sx,sy,TILE,TILE);
    if(t===T.WALL){
      ctx.fillStyle=this.pal.wd; ctx.fillRect(sx,sy,TILE,TILE);
      ctx.fillStyle=this.pal.wl; ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4);
    }
    if(t===T.WATER){
      ctx.fillStyle='rgba(255,255,255,.08)';
      ctx.fillRect(sx+4, sy+(Math.sin(x+performance.now()/600)*3+6), TILE-8, 3);
    }
  }
  _drawPortal(ctx, p, cam){
    const sx=p.x*TILE-cam.x, sy=p.y*TILE-cam.y;
    const pulse=0.5+0.5*Math.sin(performance.now()/300);
    if(p.door){
      if(this.def.town){
        ctx.fillStyle='#6a5240'; ctx.fillRect(sx-12,sy-34,TILE+24,38);
        ctx.fillStyle='#8a3030'; ctx.beginPath(); ctx.moveTo(sx-16,sy-34);
        ctx.lineTo(sx+16,sy-50); ctx.lineTo(sx+TILE+12,sy-34); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#caa'; ctx.fillRect(sx-6,sy-26,8,8); ctx.fillRect(sx+TILE-2,sy-26,8,8);
      }
      ctx.fillStyle='#5a3a1a'; ctx.fillRect(sx+4,sy+2,TILE-8,TILE-2);
      ctx.fillStyle='#2a1a0a'; ctx.fillRect(sx+9,sy+6,TILE-18,TILE-6);
      if(this.def.town && p.label){ ctx.fillStyle='#ffe6a0'; ctx.font='8px "Segoe UI Symbol","Arial Unicode MS",sans-serif'; ctx.textAlign='center';
        ctx.fillText(p.label, sx+16, sy-40); }
    } else {
      ctx.fillStyle=`rgba(164,92,255,${0.4+pulse*0.4})`;
      ctx.beginPath(); ctx.arc(sx+16,sy+16,11,0,7); ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${pulse*0.6})`; ctx.beginPath(); ctx.arc(sx+16,sy+16,5,0,7); ctx.fill();
    }
  }
  draw(ctx, cam){
    const P=this.pal;
    const x0=Math.max(0,Math.floor(cam.x/TILE)), y0=Math.max(0,Math.floor(cam.y/TILE));
    const x1=Math.min(this.cols,Math.ceil((cam.x+cam.w)/TILE));
    const y1=Math.min(this.rows,Math.ceil((cam.y+cam.h)/TILE));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const t=this.map[y][x]; const sx=x*TILE-cam.x, sy=y*TILE-cam.y;
      this._drawTile(ctx,t,x,y,sx,sy);
    }
    for(const p of this.portals) this._drawPortal(ctx,p,cam);
    for(const d of this.decor){
      const sx=d.x*TILE-cam.x, sy=d.y*TILE-cam.y;
      if(sx<-TILE||sy<-TILE||sx>cam.w+TILE||sy>cam.h+TILE) continue;
      this._drawDecor(ctx,d.type,sx,sy);
    }
    for(const c of this.chests){
      const sx=c.x*TILE-cam.x, sy=c.y*TILE-cam.y;
      ctx.fillStyle=c.opened?'#5a4a2a':'#8a6a2a'; ctx.fillRect(sx+6,sy+10,20,16);
      ctx.fillStyle=c.opened?'#3a2e1a':'#ffcf4d'; ctx.fillRect(sx+14,sy+16,4,4);
    }
    for(const n of this.npcs){
      const sx=n.x*TILE-cam.x, sy=n.y*TILE-cam.y;
      const bob=Math.sin(performance.now()/600 + n.x*0.1 + n.y*0.1) * 1.5;
      drawNPCSprite(ctx, n.name, sx+16, sy+16, bob);
      // shop/craft/bank glow ring so the player can spot a service NPC at a glance
      if(n.shop || n.craft || n.bank){
        const t=performance.now()/300;
        ctx.strokeStyle=`rgba(255,207,77,${0.4+0.4*Math.sin(t)})`;
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.arc(sx+16, sy+16, 17, 0, Math.PI*2);
        ctx.stroke();
      }
      // small name tag above the sprite
      ctx.font='8px "Press Start 2P",monospace';
      ctx.textAlign='center';
      ctx.textBaseline='alphabetic';
      ctx.fillStyle='rgba(255,230,160,0.85)';
      ctx.fillText(n.name, sx+16, sy-12);
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
      case 'pine': ctx.fillStyle='#5a3a22'; ctx.fillRect(sx+14,sy+22,4,8);
        ctx.fillStyle='#2c5e44'; ctx.beginPath(); ctx.moveTo(sx+16,sy+4); ctx.lineTo(sx+25,sy+22); ctx.lineTo(sx+7,sy+22); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#eaf2fa'; ctx.beginPath(); ctx.moveTo(sx+16,sy+4); ctx.lineTo(sx+20,sy+12); ctx.lineTo(sx+12,sy+12); ctx.closePath(); ctx.fill(); break;
      case 'snowrock': ctx.fillStyle='#9aa6b4'; ctx.beginPath(); ctx.arc(sx+16,sy+20,9,0,7); ctx.fill();
        ctx.fillStyle='#eaf2fa'; ctx.beginPath(); ctx.arc(sx+14,sy+17,5,0,7); ctx.fill(); break;
      case 'deadtree': ctx.strokeStyle='#3a2e22'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(sx+16,sy+28); ctx.lineTo(sx+16,sy+8);
        ctx.moveTo(sx+16,sy+16); ctx.lineTo(sx+9,sy+9); ctx.moveTo(sx+16,sy+14); ctx.lineTo(sx+23,sy+8); ctx.stroke(); break;
      case 'reed': ctx.strokeStyle='#6a7a3a'; ctx.lineWidth=2;
        for(let k=-1;k<=1;k++){ ctx.beginPath(); ctx.moveTo(sx+16+k*4,sy+26); ctx.lineTo(sx+16+k*4,sy+12); ctx.stroke(); } break;
      case 'lamp': ctx.fillStyle='#3a3038'; ctx.fillRect(sx+14,sy+10,4,18);
        ctx.fillStyle='#ffd86a'; ctx.beginPath(); ctx.arc(sx+16,sy+8,5,0,7); ctx.fill();
        ctx.fillStyle='rgba(255,216,106,.25)'; ctx.beginPath(); ctx.arc(sx+16,sy+8,10,0,7); ctx.fill(); break;
      case 'fountain': ctx.fillStyle='#8a93a0'; ctx.beginPath(); ctx.arc(sx+16,sy+18,14,0,7); ctx.fill();
        ctx.fillStyle='#3a82c8'; ctx.beginPath(); ctx.arc(sx+16,sy+18,10,0,7); ctx.fill();
        ctx.fillStyle='#9ec6e8'; ctx.fillRect(sx+14,sy+4,4,12);
        ctx.fillStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(sx+16,sy+16,3,0,7); ctx.fill(); break;
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



