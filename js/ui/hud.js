import { TILE } from '../systems/world.js';

// Item definitions
export const ITEMS = {
  potion: { name:'Health Potion', icon:'🧪', use:(g)=>{ g.player.heal(40,g); g.sfx('drink'); } },
  ether:  { name:'Mana Ether',    icon:'🔮', use:(g)=>{ g.player.restoreMp(30); g.floater('+30 MP',g.player.x,g.player.y-16,'#3b8be8'); g.sfx('drink'); } },
  bomb:   { name:'Bomb',          icon:'💣', use:(g)=>{ g.throwBomb(); g.sfx('fire'); } },
};

export class HUD {
  constructor(game){
    this.game=game;
    this.el = {
      hpFill:document.getElementById('hp-fill'), hpText:document.getElementById('hp-text'),
      mpFill:document.getElementById('mp-fill'), mpText:document.getElementById('mp-text'),
      stamFill:document.getElementById('stam-fill'),
      xpFill:document.getElementById('xp-fill'), xpText:document.getElementById('xp-text'),
      levelText:document.getElementById('level-text'),
      itemSlots:document.getElementById('item-slots'),
      spellQ:document.getElementById('spell-q'), spellE:document.getElementById('spell-e'),
      minimap:document.getElementById('minimap'),
      invGrid:document.getElementById('inv-grid'),
      goldText:document.getElementById('gold-text'), slotsText:document.getElementById('slots-text'),
      toast:document.getElementById('toast'), floaters:document.getElementById('floaters'),
      interact:document.getElementById('interact-prompt'), interactLabel:document.getElementById('interact-label'),
      fps:document.getElementById('fps'),
    };
    this.mmCtx=this.el.minimap.getContext('2d');
    this.activeSlot=0;
    this._buildHotbar();
    this._buildInventory();
  }

  _buildHotbar(){
    this.el.itemSlots.innerHTML='';
    for(let i=0;i<9;i++){
      const d=document.createElement('div');
      d.className='item-slot'+(i===0?' active':'');
      d.dataset.idx=i;
      d.innerHTML=`<span class="key">${i+1}</span><span class="ico"></span><span class="qty"></span>`;
      d.onclick=()=> this.game.useHotbar(i);
      this.el.itemSlots.appendChild(d);
    }
  }
  _buildInventory(){
    this.el.invGrid.innerHTML='';
    for(let i=0;i<30;i++){
      const c=document.createElement('div'); c.className='inv-cell';
      this.el.invGrid.appendChild(c);
    }
  }

  setActiveSlot(i){
    this.activeSlot=i;
    [...this.el.itemSlots.children].forEach((s,idx)=> s.classList.toggle('active', idx===i));
  }

  refresh(){
    const p=this.game.player, inv=this.game.inventory, hot=this.game.hotbar;
    // bars
    this.el.hpFill.style.width=(p.hp/p.hpMax*100)+'%';
    this.el.hpText.textContent=`${Math.ceil(p.hp)}/${p.hpMax}`;
    this.el.mpFill.style.width=(p.mp/p.mpMax*100)+'%';
    this.el.mpText.textContent=`${Math.floor(p.mp)}/${p.mpMax}`;
    this.el.stamFill.style.width=(p.stam/p.stamMax*100)+'%';
    this.el.xpFill.style.width=(p.xp/p.xpNext*100)+'%';
    this.el.xpText.textContent=`${p.xp} / ${p.xpNext} XP`;
    this.el.levelText.textContent=p.level;
    // hotbar icons
    [...this.el.itemSlots.children].forEach((s,i)=>{
      const id=hot[i]; const item=id?inv.find(x=>x.id===id):null;
      s.querySelector('.ico').textContent=item?item.icon:'';
      s.querySelector('.qty').textContent=item&&item.qty>1?item.qty:'';
    });
    // spell cooldown overlays
    this.el.spellQ.querySelector('.cd').style.height=(p.spellCd.q/1.2*100)+'%';
    this.el.spellE.querySelector('.cd').style.height=(p.spellCd.e/2.0*100)+'%';
  }

  refreshBag(){
    const inv=this.game.inventory;
    const cells=[...this.el.invGrid.children];
    cells.forEach((c,i)=>{
      const item=inv[i];
      c.innerHTML = item ? `${item.icon}<span class="qty">${item.qty||''}</span>` : '';
      c.onclick = item ? ()=>{ this.game.useItemById(item.id); this.refreshBag(); } : null;
    });
    this.el.goldText.textContent=this.game.player.gold;
    this.el.slotsText.textContent=`${inv.length}/30`;
  }

  showInteract(label){ this.el.interactLabel.textContent=label; this.el.interact.classList.remove('hidden'); }
  hideInteract(){ this.el.interact.classList.add('hidden'); }

  toast(msg){
    const d=document.createElement('div'); d.className='toast-msg'; d.textContent=msg;
    const wrap=document.createElement('div'); wrap.appendChild(d);
    this.el.toast.appendChild(wrap);
    setTimeout(()=>{ wrap.style.transition='opacity .4s'; wrap.style.opacity='0';
      setTimeout(()=>wrap.remove(),400); }, 1800);
  }

  floater(text, worldX, worldY, color){
    const cam=this.game.cam;
    const sx=(worldX-cam.x)/this.game.canvas.width*window.innerWidth;
    const sy=(worldY-cam.y)/this.game.canvas.height*window.innerHeight;
    const d=document.createElement('div'); d.className='floater';
    d.textContent=text; d.style.color=color;
    d.style.left=sx+'px'; d.style.top=sy+'px';
    this.el.floaters.appendChild(d);
    setTimeout(()=>d.remove(),900);
  }

  drawMinimap(){
    const ctx=this.mmCtx, w=this.game.world, mm=this.el.minimap;
    const sx=mm.width/w.cols, sy=mm.height/w.rows;
    ctx.clearRect(0,0,mm.width,mm.height);
    // tiles (simplified colors)
    for(let y=0;y<w.rows;y+=1)for(let x=0;x<w.cols;x+=1){
      const t=w.map[y][x];
      let c='#2c4a30';
      if(t===2) c='#2f6fb0'; else if(t===1) c='#b89b72';
      else if(t===7) c='#1d2330'; else if(t===3) c='#1d3a22';
      else if(t===4) c='#555';
      ctx.fillStyle=c; ctx.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
    }
    // chests
    for(const c of w.chests){ if(c.opened) continue;
      ctx.fillStyle='#ffcf4d'; ctx.fillRect(c.x/TILE*sx-1,c.y/TILE*sy-1,3,3); }
    // npcs
    ctx.fillStyle='#4dd28a';
    for(const n of w.npcs) ctx.fillRect(n.x/TILE*sx-1,n.y/TILE*sy-1,3,3);
    // enemies
    ctx.fillStyle='#e8413c';
    for(const e of this.game.enemies){ if(!e.dead) ctx.fillRect(e.x/TILE*sx-1,e.y/TILE*sy-1,2,2); }
    // player
    const p=this.game.player;
    ctx.fillStyle='#fff'; ctx.fillRect(p.x/TILE*sx-2,p.y/TILE*sy-2,4,4);
  }

  setFps(v, show){ this.el.fps.classList.toggle('hidden',!show); this.el.fps.textContent='FPS '+v; }
}
