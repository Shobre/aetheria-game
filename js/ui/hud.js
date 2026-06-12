import { TILE } from '../systems/world.js';
import { CATALOG, EQUIP_SLOTS, equipStats, resolveEquip } from '../data/gear.js';
import { SKILLS, BRANCHES, canLearn } from '../data/skilltree.js';
import { SHOP_STOCK } from '../data/maps.js';
import { rarityColor, rarityName, affixText } from '../data/affixes.js';
import { QUESTS } from '../data/quests.js';
import { SPELLS, knownSpells } from '../data/spells.js';

export class HUD {
  constructor(game){
    this.game=game;
    const $=id=>document.getElementById(id);
    this.el={
      hpFill:$('hp-fill'),hpText:$('hp-text'),mpFill:$('mp-fill'),mpText:$('mp-text'),
      stamFill:$('stam-fill'),xpFill:$('xp-fill'),xpText:$('xp-text'),levelText:$('level-text'),
      itemSlots:$('item-slots'),
      minimap:$('minimap'),invGrid:$('inv-grid'),
      goldText:$('gold-text'),slotsText:$('slots-text'),
      toast:$('toast'),floaters:$('floaters'),
      interact:$('interact-prompt'),interactLabel:$('interact-label'),fps:$('fps'),
      mapName:$('map-name'),
      // character
      charEquip:$('char-equip'),charStats:$('char-stats'),charInv:$('char-inv'),
      // skills
      skillPts:$('skill-points'),skillTree:$('skill-tree'),
      // shop
      shopBuy:$('shop-buy'),shopSell:$('shop-sell'),shopGold:$('shop-gold'),
      // boss bar + quests
      bossBar:$('boss-bar'),bossName:$('boss-name'),bossFill:$('boss-fill'),bossPips:$('boss-pips'),
      questTracker:$('quest-tracker'),questLog:$('quest-log'),
      spellLoadout:$('spell-loadout'),spellPicker:$('spell-picker'),
    };
    this.mmCtx=this.el.minimap.getContext('2d');
    this.activeSlot=0;
    this._buildHotbar(); this._buildInventory();
  }

  _buildHotbar(){
    this.el.itemSlots.innerHTML='';
    for(let i=0;i<9;i++){
      const d=document.createElement('div');
      d.className='item-slot'+(i===0?' active':''); d.dataset.idx=i;
      d.innerHTML=`<span class="key">${i+1}</span><span class="ico"></span><span class="qty"></span>`;
      d.onclick=()=>this.game.useHotbar(i);
      this._enableSwapDrag(d, i, 'hotbar');
      this.el.itemSlots.appendChild(d);
    }
  }

  // generic drag-to-swap between slots of the same kind ('hotbar' | 'spell')
  _enableSwapDrag(el, idx, kind){
    el.draggable=true;
    el.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', kind+':'+idx);
      e.dataTransfer.effectAllowed='move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
    el.addEventListener('dragover', e=>{ e.preventDefault(); el.classList.add('drop-hover'); });
    el.addEventListener('dragleave', ()=> el.classList.remove('drop-hover'));
    el.addEventListener('drop', e=>{ e.preventDefault(); el.classList.remove('drop-hover');
      const data=e.dataTransfer.getData('text/plain'); const [k,from]=data.split(':');
      if(k!==kind) return; const fi=+from;
      if(kind==='hotbar'){ const h=this.game.hotbar; [h[fi],h[idx]]=[h[idx],h[fi]]; this.refresh(); }
      else if(kind==='spell'){ const sp=this.game.player.spellSlots; [sp[fi],sp[idx]]=[sp[idx],sp[fi]];
        this.refresh(); if(this.refreshSpells) this.refreshSpells(); }
    });
  }
  _buildInventory(){ this.el.invGrid.innerHTML='';
    for(let i=0;i<30;i++){ const c=document.createElement('div'); c.className='inv-cell'; c.dataset.idx=i;
      this._enableBagDrag(c,i); this.el.invGrid.appendChild(c); } }

  // drag an item from bag cell `from` and drop on cell `to` to reorder the inventory
  _enableBagDrag(el, idx){
    el.draggable=true;
    el.addEventListener('dragstart', e=>{ if(!this.game.inventory[idx]){ e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain','bag:'+idx); el.classList.add('dragging'); });
    el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
    el.addEventListener('dragover', e=>{ e.preventDefault(); el.classList.add('drop-hover'); });
    el.addEventListener('dragleave', ()=> el.classList.remove('drop-hover'));
    el.addEventListener('drop', e=>{ e.preventDefault(); el.classList.remove('drop-hover');
      const d=e.dataTransfer.getData('text/plain'); const [k,from]=d.split(':'); if(k!=='bag') return;
      const inv=this.game.inventory, fi=+from; if(fi===idx||fi>=inv.length) return;
      const [moved]=inv.splice(fi,1);
      inv.splice(Math.min(idx,inv.length),0,moved);
      this.refreshBag(); });
  }

  setActiveSlot(i){ this.activeSlot=i;
    [...this.el.itemSlots.children].forEach((s,idx)=>s.classList.toggle('active',idx===i)); }

  refresh(){
    const p=this.game.player, inv=this.game.inventory, hot=this.game.hotbar;
    this.el.hpFill.style.width=(p.hp/p.hpMax*100)+'%';
    this.el.hpText.textContent=`${Math.ceil(p.hp)}/${p.hpMax}`;
    this.el.mpFill.style.width=(p.mp/p.mpMax*100)+'%';
    this.el.mpText.textContent=`${Math.floor(p.mp)}/${p.mpMax}`;
    this.el.stamFill.style.width=(p.stam/p.stamMax*100)+'%';
    this.el.xpFill.style.width=(p.xp/p.xpNext*100)+'%';
    this.el.xpText.textContent=`${p.xp} / ${p.xpNext} XP`;
    this.el.levelText.textContent=p.level;
    if(this.el.mapName && this.game.world) this.el.mapName.textContent=this.game.world.def.name;
    [...this.el.itemSlots.children].forEach((s,i)=>{
      const id=hot[i]; const item=id?inv.find(x=>x.id===id):null;
      s.querySelector('.ico').textContent=item?item.icon:'';
      s.querySelector('.qty').textContent=item&&item.qty>1?item.qty:'';
    });
    // skill point badge on char/skill buttons
    const badge=document.getElementById('skill-badge');
    if(badge){ badge.textContent=p.skillPoints; badge.style.display=p.skillPoints>0?'flex':'none'; }
    this._updateBossBar();
    this._updateSpellLoadout();
  }

  _updateBossBar(){
    const b=this.game.boss, bar=this.el.bossBar; if(!bar) return;
    if(b && !b.dead && b.intro<=0){
      bar.classList.remove('hidden');
      this.el.bossName.textContent=b.def.name;
      this.el.bossFill.style.width=Math.max(0,b.hp/b.hpMax*100)+'%';
      if(this.el.bossPips){
        const ph=b.def.phases.length, cur=b.phaseIdx;
        this.el.bossPips.innerHTML=b.def.phases.map((_,i)=>
          `<span class="boss-pip${i<=ph-1-cur?' on':''}"></span>`).join('');
      }
    } else { bar.classList.add('hidden'); }
  }

  // spell loadout row (q/e/r): drag to swap, click to open the picker
  _updateSpellLoadout(){
    const p=this.game.player, el=this.el.spellLoadout; if(!el) return;
    const keys=['q','e','r'];
    if(el.children.length!==3){
      el.innerHTML='';
      for(let i=0;i<3;i++){ const d=document.createElement('div'); d.className='spell-slot'; d.dataset.idx=i;
        d.innerHTML=`<span class="key">${keys[i].toUpperCase()}</span><span class="ico"></span><div class="cd"></div>`;
        this._enableSwapDrag(d,i,'spell');
        d.onclick=()=>this._openSpellPicker(i);
        el.appendChild(d); }
    }
    [...el.children].forEach((d,i)=>{
      const id=p.spellSlots[i], sp=id?SPELLS[id]:null;
      d.querySelector('.ico').textContent=sp?sp.icon:'·';
      const maxCd=sp?sp.cd:1;
      d.querySelector('.cd').style.height=(p.spellCd[keys[i]]/maxCd*100)+'%';
      d.title=sp?(sp.name+' — '+sp.cost+' MP. Drag to swap, click to change.'):'Empty';
    });
  }

  // picker overlay: pick any known spell for slot QER[i]
  _openSpellPicker(slotIdx){
    const p=this.game.player, picker=this.el.spellPicker; if(!picker) return;
    const known=knownSpells(p.skills);
    picker.innerHTML=`<div class="picker-title">Assign spell to slot ${'QER'[slotIdx]}</div>`;
    known.forEach(id=>{ const sp=SPELLS[id]; if(!sp) return;
      const d=document.createElement('div'); d.className='spell-picker-item'+(p.spellSlots[slotIdx]===id?' active':'');
      d.innerHTML=`<span class="ico">${sp.icon}</span><span class="sp-name">${sp.name}</span><span class="sp-cost">${sp.cost} MP</span><div class="sp-desc">${sp.desc}</div>`;
      d.onclick=()=>{ p.spellSlots[slotIdx]=id; this.refresh();
        picker.classList.add('hidden'); picker.classList.remove('flex'); };
      picker.appendChild(d); });
    const close=document.createElement('button'); close.className='menu-btn picker-close'; close.textContent='CLOSE';
    close.onclick=()=>{ picker.classList.add('hidden'); picker.classList.remove('flex'); };
    picker.appendChild(close);
    picker.classList.remove('hidden'); picker.classList.add('flex');
  }

  // quest tracker (always-on HUD) + full log
  refreshQuests(){
    if(!this.game.quests) return;
    const list=this.game.quests.activeList();
    const tr=this.el.questTracker;
    if(tr){
      if(!list.length){ tr.innerHTML=''; tr.classList.add('hidden'); }
      else {
        tr.classList.remove('hidden');
        tr.innerHTML=list.slice(0,3).map(q=>{
          const lines=q.lines.map(l=>`<div class="qt-obj${l.done?' done':''}">${l.done?'✓':'•'} ${l.text} ${l.need>1?'('+l.have+'/'+l.need+')':''}</div>`).join('');
          return `<div class="qt-quest"><div class="qt-name">${q.complete?'★ ':''}${q.name}</div>${lines}</div>`;
        }).join('');
      }
    }
    const log=this.el.questLog;
    if(log){
      if(!list.length){ log.innerHTML='<p class="text-[9px] text-gray-500">No active quests. Seek out NPCs (look for ❗).</p>'; }
      else log.innerHTML=list.map(q=>{
        const lines=q.lines.map(l=>`<div class="qt-obj${l.done?' done':''}">${l.done?'✓':'•'} ${l.text} ${l.need>1?'('+l.have+'/'+l.need+')':''}</div>`).join('');
        return `<div class="quest-entry"><div class="qe-name">${q.complete?'★ ':''}${q.name}</div><div class="qe-desc">${q.desc}</div>${lines}</div>`;
      }).join('');
    }
  }

  refreshBag(){
    const inv=this.game.inventory; const cells=[...this.el.invGrid.children];
    cells.forEach((c,i)=>{
      const item=inv[i];
      if(item){ c.innerHTML=`${item.icon}<span class="qty">${item.qty>1?item.qty:''}</span>`;
        if(item.type!=='consumable'){ c.style.borderColor=rarityColor(item);
          const ax=affixText(item); c.title=rarityName(item)+' '+item.name+(ax?' ('+ax+')':''); }
        else { c.style.borderColor=''; c.title=CATALOG[item.id]?CATALOG[item.id].name:item.id; }
        c.onclick=()=>{ if(item.type==='consumable') this.game.useConsumable(item.id);
          else this.game.equipItem(item); this.refreshBag(); };
      } else { c.innerHTML=''; c.onclick=null; c.title=''; c.style.borderColor=''; }
    });
    this.el.goldText.textContent=this.game.player.gold;
    this.el.slotsText.textContent=`${inv.length}/30`;
  }

  showInteract(label){ this.el.interactLabel.textContent=label; this.el.interact.classList.remove('hidden'); }
  hideInteract(){ this.el.interact.classList.add('hidden'); }

  toast(msg){
    const d=document.createElement('div'); d.className='toast-msg'; d.textContent=msg;
    const wrap=document.createElement('div'); wrap.appendChild(d); this.el.toast.appendChild(wrap);
    setTimeout(()=>{ wrap.style.transition='opacity .4s'; wrap.style.opacity='0'; setTimeout(()=>wrap.remove(),400); },1800);
  }
  floater(text,wx,wy,color){
    const cam=this.game.cam;
    const sx=(wx-cam.x)/this.game.canvas.width*window.innerWidth;
    const sy=(wy-cam.y)/this.game.canvas.height*window.innerHeight;
    const d=document.createElement('div'); d.className='floater'; d.textContent=text; d.style.color=color;
    d.style.left=sx+'px'; d.style.top=sy+'px'; this.el.floaters.appendChild(d);
    setTimeout(()=>d.remove(),900);
  }

  drawMinimap(){
    const ctx=this.mmCtx,w=this.game.world,mm=this.el.minimap;
    const sx=mm.width/Math.max(w.cols,1),sy=mm.height/Math.max(w.rows,1);
    ctx.clearRect(0,0,mm.width,mm.height);
    for(let y=0;y<w.rows;y++)for(let x=0;x<w.cols;x++){
      const t=w.map[y][x]; let c='#2c4a30';
      if(t===2)c='#2f6fb0';else if(t===1)c='#b89b72';else if(t===7)c='#1d2330';else if(t===3)c='#1d3a22';else if(t===4)c='#555';
      ctx.fillStyle=c; ctx.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
    }
    ctx.fillStyle='#ffcf4d';
    for(const c of w.chests)if(!c.opened)ctx.fillRect(c.x/TILE*sx-1,c.y/TILE*sy-1,3,3);
    ctx.fillStyle='#4dd28a'; for(const n of w.npcs) ctx.fillRect(n.x/TILE*sx-1,n.y/TILE*sy-1,3,3);
    ctx.fillStyle='#a45cff';
    for(const p of w.portals) ctx.fillRect(p.x/TILE*sx-2,p.y/TILE*sy-2,5,5);
    ctx.fillStyle='#e8413c';
    for(const e of this.game.enemies) if(!e.dead) ctx.fillRect(e.x/TILE*sx-1,e.y/TILE*sy-1,2,2);
    ctx.fillStyle='#fff';
    ctx.fillRect(this.game.player.x/TILE*sx-2,this.game.player.y/TILE*sy-2,4,4);
  }

  // ===== CHARACTER VIEW =====
  refreshChar(){
    const p=this.game.player;
    // equipment slots
    const slotsDiv=this.el.charEquip; if(!slotsDiv) return;
    slotsDiv.innerHTML='';
    for(const slot of EQUIP_SLOTS){
      const it=resolveEquip(p.equipment[slot]);
      const d=document.createElement('div'); d.className='equip-slot';
      const col=it?rarityColor(it):'#cdd';
      const ax=it?affixText(it):'';
      d.innerHTML=`<span class="slot-label">${slot.toUpperCase()}</span>
        <span class="slot-icon">${it?it.icon:'—'}</span>
        <span class="slot-name" style="color:${col}">${it?it.name:''}${ax?'<br><span class=\'affix-line\'>'+ax+'</span>':''}</span>`;
      d.onclick=()=>{ if(it) this.game.unequip(slot); this.refreshChar(); };
      d.title=it?(rarityName(it)+(ax?' · '+ax:'')+' — click to unequip'):'Empty';
      slotsDiv.appendChild(d);
    }
    // stat lines
    const g=equipStats(p.equipment);
    const statsDiv=this.el.charStats; if(statsDiv){
      statsDiv.innerHTML=`${this._stat('HP',p.hpMax)} ${this._stat('MP',p.mpMax)}
        ${this._stat('ATK',p.atk)} ${this._stat('DEF',p.def)}
        ${this._stat('CRIT',p.crit+'%')} ${this._stat('CDR',p.cdr+'%')}
        ${this._stat('GOLD+',Math.round(p.greed*100)+'%')}`;
    }
    // gear in bag
    const gearDiv=this.el.charInv; if(gearDiv){
      gearDiv.innerHTML='';
      this.game.inventory.filter(it=>it.type!=='consumable').forEach(item=>{
        const c=document.createElement('div'); c.className='inv-cell gear-cell';
        c.style.borderColor=rarityColor(item);
        c.innerHTML=`${item.icon}`;
        const ax=affixText(item);
        c.title=rarityName(item)+' '+item.name+(ax?' ('+ax+')':'')+' — click to equip';
        c.onclick=()=>{ this.game.equipItem(item); this.refreshChar(); this.refreshBag(); };
        gearDiv.appendChild(c);
      });
    }
  }
  _stat(label,val){ return `<div class="stat-line"><span class="stat-label">${label}</span><span class="stat-val">${val}</span></div>`; }

  // ===== SKILL TREE =====
  refreshSkills(){
    const p=this.game.player;
    const pts=this.el.skillPts; if(pts) pts.textContent='Skill Points: '+p.skillPoints;
    const tree=this.el.skillTree; if(!tree) return;
    tree.innerHTML='';
    for(const branch of BRANCHES){
      const col=document.createElement('div'); col.className='skill-branch';
      col.innerHTML=`<div class="branch-title branch-${branch}">${branch.toUpperCase()}</div>`;
      const nodes=Object.keys(SKILLS).filter(k=>SKILLS[k].branch===branch);
      for(const id of nodes){
        const s=SKILLS[id], rank=p.skills[id]||0, maxed=rank>=s.max;
        const reason=canLearn(id,p.skills,p.skillPoints);
        const locked=reason!==null && !maxed;
        const d=document.createElement('div');
        d.className='skill-node '+(maxed?'skill-maxed':locked?'skill-locked':'skill-avail');
        d.innerHTML=`<span class="skill-ico">${s.icon}</span>
          <span class="skill-name">${s.name} ${rank}/${s.max}</span>
          <span class="skill-cost">${s.cost}pt</span>
          <div class="skill-desc">${s.desc}</div>`;
        d.title=reason||'Click to learn';
        d.onclick=()=>{ if(!maxed && !locked) this.game.learnSkill(id); this.refreshSkills(); this.refresh(); };
        col.appendChild(d);
      }
      tree.appendChild(col);
    }
  }

  // ===== SHOP =====
  openShop(){ this.game.paused=true; const m=document.getElementById('shop-modal'); m.classList.remove('hidden'); m.classList.add('flex'); this.refreshShop(); }
  refreshShop(){
    const p=this.game.player; const g=this.el.shopGold; if(g) g.textContent=p.gold;
    const buy=this.el.shopBuy; const sell=this.el.shopSell;
    const stock=this.game.shopStock||SHOP_STOCK;
    if(buy){ buy.innerHTML='';
      for(const id of stock){
        const c=CATALOG[id], row=document.createElement('div'); row.className='shop-row';
        row.innerHTML=`<span>${c.icon} ${c.name}</span><span class="shop-price">${c.price}g</span>
          <button class="menu-btn shop-buy-btn" data-id="${id}">Buy</button>`;
        row.querySelector('.shop-buy-btn').onclick=()=>{ this.game.buyItem(id); this.refreshShop(); this.refreshBag(); };
        buy.appendChild(row);
      }
    }
    if(sell){ sell.innerHTML='';
      this.game.inventory.forEach(item=>{
        if(item.type==='consumable'&&(!item.qty||item.qty<=0)) return;
        const c=CATALOG[item.id]||{}; const val=c.sell||Math.floor((c.price||0)/2);
        const row=document.createElement('div'); row.className='shop-row';
        row.innerHTML=`<span>${item.icon} ${item.name}${item.type==='consumable'&&item.qty>1?' x'+item.qty:''}</span>
          <span class="shop-price">${val}g</span><button class="menu-btn shop-sell-btn">Sell</button>`;
        row.querySelector('.shop-sell-btn').onclick=()=>{ this.game.sellItem(item); this.refreshShop(); this.refreshBag(); };
        sell.appendChild(row);
      });
    }
  }

  setFps(v,show){ this.el.fps.classList.toggle('hidden',!show); this.el.fps.textContent='FPS '+v; }
}
