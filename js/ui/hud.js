import { TILE } from '../systems/world.js';
import { CATALOG, EQUIP_SLOTS, equipStats, resolveEquip, compareItem } from '../data/gear.js';
import { SKILLS, BRANCHES, canLearn } from '../data/skilltree.js';
import { SHOP_STOCK } from '../data/maps.js';
import { rarityColor, rarityName, affixText } from '../data/affixes.js';
import { QUESTS } from '../data/quests.js';
import { SPELLS, knownSpells, spellRank } from '../data/spells.js';
import { reforgeCost, upgradeCost, canUpgrade, stripEnchantCost } from '../systems/craft.js';
import { AMMO, AMMO_ORDER, DEFAULT_AMMO } from '../data/ammo.js';
import { labelFor as labelForKey } from '../data/keybinds.js';
import { drawArmorIcon, drawHelmIcon, drawShieldIcon, drawRingIcon, drawWeaponIcon } from '../sprites.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATS, achievementStats } from '../data/achievements.js';
import { ENCHANTMENTS, enchantCost, enchantInfo } from '../data/enchantments.js';

export class HUD {
  constructor(game){
    this.game=game;
    const $=id=>document.getElementById(id);
    this.el={
      hpFill:$('hp-fill'),hpText:$('hp-text'),mpFill:$('mp-fill'),mpText:$('mp-text'),
      stamFill:$('stam-fill'),xpFill:$('xp-fill'),xpText:$('xp-text'),levelText:$('level-text'),
      itemSlots:$('item-slots'),
      invGrid:$('inv-grid'),
      goldText:$('gold-text'),slotsText:$('slots-text'),
      toast:$('toast'),floaters:$('floaters'),
      interact:$('interact-prompt'),interactLabel:$('interact-label'),fps:$('fps'),
      mapName:$('map-name'),
      // character
      charEquip:$('char-equip'),charStats:$('char-stats'),charInv:$('char-inv'),
      // skills
      skillPts:$('skill-points'),skillTree:$('skill-tree'),
      // shop
      shopBuy:$('shop-buy'),shopSell:$('shop-sell'),shopGold:$('shop-gold'),shopSpells:$('shop-spells'),
      // boss bar + quests
      bossBar:$('boss-bar'),bossName:$('boss-name'),bossFill:$('boss-fill'),bossPips:$('boss-pips'),
      questTracker:$('quest-tracker'),questLog:$('quest-log'),
      spellLoadout:$('spell-loadout'),spellPicker:$('spell-picker'),
      autoSave:$('autosave'),
      tooltip:$('tooltip'),
      stashBag:$('stash-bag'),stashStore:$('stash-store'),stashBagCount:$('stash-bag-count'),stashStoreCount:$('stash-store-count'),
      craftGear:$('craft-gear'),craftDetail:$('craft-detail'),craftGold:$('craft-gold'),
    };
    // minimap removed - use M key for full map
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
      this._bindTooltip(d, ()=>{ const id=this.game.hotbar[i];
        const item=id?this.game.inventory.find(x=>x.id===id):null;
        return item?this._buildItemTooltip(item,{hint:'Press '+(i+1)+' to use'}):''; });
      this.el.itemSlots.appendChild(d);
    }
    // heat bar (for ranged weapons)
    const heatBar=document.createElement('div');
    heatBar.id='heat-bar';
    heatBar.className='hidden';
    heatBar.innerHTML='<div class="heat-fill" id="heat-fill"></div>';
    this.el.itemSlots.parentElement.appendChild(heatBar);
    // Sprint 5: ammo / quiver bar (shown alongside heat when a ranged weapon is equipped)
    const ammoBar=document.createElement('div');
    ammoBar.id='ammo-bar';
    ammoBar.className='hidden';
    ammoBar.innerHTML='<span class="ammo-icon" id="ammo-icon">➶</span>'
      + '<div class="ammo-fill" id="ammo-fill"></div>'
      + '<span class="ammo-label" id="ammo-label">0</span>';
    heatBar.parentElement.appendChild(ammoBar);
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

  // Update the achievement badge in the bottom-right HUD button
  _updateAchieveBadge(){
    if(!this.game.achievements) return;
    const stats = achievementStats(this.game.achievements.unlocked);
    const badge = document.getElementById('achieve-badge');
    if(badge){
      badge.textContent = stats.done;
      badge.style.display = stats.done > 0 ? 'flex' : 'none';
    }
  }

  // Show / update the companion ability icon next to the spell loadout.
  // Visible only when a companion is recruited. The icon shows the companion's
  // glyph and the cooldown overlay fills up while on cooldown.
  refreshCompanionAbility(){
    const slot = document.getElementById('companion-ability');
    if(!slot) return;
    const comp = (this.game._companions && this.game._companions[0]) || null;
    if(!comp || !comp.alive){
      slot.style.display = 'none';
      return;
    }
    slot.style.display = '';
    const cd = slot.querySelector('.cd');
    const ico = slot.querySelector('.ico');
    if(ico) ico.textContent = comp.icon;
    // cooldown overlay: 100% when just triggered, 0% when ready
    const max = comp._abilityMaxCd || 1;
    const remain = comp._abilityCd || 0;
    if(cd){
      if(remain > 0){
        cd.style.height = Math.min(100, (remain / max) * 100) + '%';
        cd.style.background = 'rgba(0,0,0,0.65)';
      } else {
        cd.style.height = '0%';
        cd.style.background = 'rgba(0,0,0,0)';
      }
    }
    // tooltip via title
    const inner = slot.querySelector('.spell-slot');
    if(inner) inner.title = `${comp.name}: ${this._companionAbilityName(comp.kind)} (G)`;
  }
  _companionAbilityName(kind){
    return ({kira:'Arrow Volley', thorin:'Shield Bash', luna:'Arcane Blast'})[kind] || 'Ability';
  }

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
    this._updateAchieveBadge();
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
  _updateTownBtn(){
    const btn=document.getElementById('town-btn'); if(!btn) return;
    const can=this.game.canTeleportTown&&this.game.canTeleportTown();
    btn.style.display=can?'flex':'none';
  }

  // spell loadout row (q/e/r by default): drag to swap, click to open the picker
  // Sprint 7: shows the user's currently-bound key, not a hardcoded letter.
  _updateSpellLoadout(){
    const p=this.game.player, el=this.el.spellLoadout; if(!el) return;
    const slotActions=['spell_q','spell_e','spell_r'];
    const bindings = (this.game.input && this.game.input.bindings) || {};
    if(el.children.length!==3){
      el.innerHTML='';
      for(let i=0;i<3;i++){ const d=document.createElement('div'); d.className='spell-slot'; d.dataset.idx=i;
        const cap = labelForKey(bindings[slotActions[i]] || slotActions[i].slice(-1));
        d.innerHTML=`<span class="key">${cap}</span><span class="ico"></span><span class="rank"></span><div class="cd"></div>`;
        this._enableSwapDrag(d,i,'spell');
        const sid=p.spellSlots[i]; const r=sid?spellRank(sid):null; const rk=r&&r.rank>1?`<span class="spell-rank">${r.rank}</span>`:''; d.querySelector('.rank').innerHTML=rk;
        this._bindTooltip(d, ()=>{ const sid=this.game.player.spellSlots[i];
          return sid?this._buildSpellTooltip(sid,{hint:'Drag to swap ? click to change'}):'<div class="tt-name">Empty slot</div><div class="tt-hint">Click to assign a spell</div>'; });
        d.onclick=()=>this._openSpellPicker(i);
        el.appendChild(d); }
    }
    [...el.children].forEach((d,i)=>{
      const id=p.spellSlots[i], sp=id?SPELLS[id]:null;
      d.querySelector('.ico').textContent=sp?sp.icon:'?';
      const maxCd=sp?sp.cd:1;
      d.querySelector('.cd').style.height=(p.spellCd[slotActions[i]]/maxCd*100)+'%';
      d.title='';
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
      this._bindTooltip(d, ()=>this._buildSpellTooltip(id,{hint:'Click to assign'}));
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
          const lines=q.lines.map(l=>`<div class="qt-obj${l.done?' done':''}">${l.done?'V':''} ${l.text} ${l.need>1?'('+l.have+'/'+l.need+')':''}</div>`).join('');
          return `<div class="qt-quest"><div class="qt-name">${q.complete?'? ':''}${q.name}</div>${lines}</div>`;
        }).join('');
      }
    }
    const log=this.el.questLog;
    if(log){
      if(!list.length){ log.innerHTML='<p class="text-[9px] text-gray-500">No active quests. Seek out NPCs (look for ?).</p>'; }
      else log.innerHTML=list.map(q=>{
        const lines=q.lines.map(l=>`<div class="qt-obj${l.done?' done':''}">${l.done?'V':''} ${l.text} ${l.need>1?'('+l.have+'/'+l.need+')':''}</div>`).join('');
        return `<div class="quest-entry"><div class="qe-name">${q.complete?'? ':''}${q.name}</div><div class="qe-desc">${q.desc}</div>${lines}</div>`;
      }).join('');
    }
  }

  refreshBag(){
    const inv=this.game.inventory; const cells=[...this.el.invGrid.children];
    const eq=this.game.player.equipment;
    cells.forEach((c,i)=>{
      const item=inv[i];
      if(item){ let cmpHtml='';
        if(item.type!=='consumable' && item.type!=='ammo'){ const cmp=compareItem(item,eq);
          if(cmp){ cmpHtml=`<span class="cmp cmp-${cmp.dir}">${cmp.text}</span>`; }
          c.style.borderColor=rarityColor(item);
          const ax=affixText(item); c.title=rarityName(item)+' '+item.name+(ax?' ('+ax+')':'')+(cmp?'  score '+cmp.text:''); }
        else { c.style.borderColor=''; c.title=CATALOG[item.id]?CATALOG[item.id].name:item.id; }
        c.innerHTML='';
        // canvas-rendered icon for weapon/armor/helm/shield/ring; text otherwise
        if(!this._drawGearCanvasIcon(c, item)){ c.textContent = item.icon; }
        const qty = document.createElement('span'); qty.className='qty';
        qty.textContent = item.qty>1?item.qty:'';
        c.appendChild(qty);
        if(cmpHtml) c.insertAdjacentHTML('beforeend', cmpHtml);
        // ammo is auto-consumed on fire — clicking it just shows the tooltip
        const hint = item.type==='consumable' ? 'Click to use'
                   : item.type==='ammo'      ? 'Auto-used on ranged fire'
                   : 'Click to equip';
        this._bindTooltip(c, ()=>this._buildItemTooltip(item,{hint}));
        c.onclick=()=>{
          if(item.type==='consumable') this.game.useConsumable(item.id);
          else if(item.type==='ammo')  this.toast('Loaded into quiver automatically', '#9bd1ff');
          else this.game.equipItem(item);
          this.refreshBag();
        };
      } else { c.innerHTML=''; c.onclick=null; c.title=''; c.style.borderColor=''; this._hideTooltip(); }
    });
    this.el.goldText.textContent=this.game.player.gold;
    this.el.slotsText.textContent=`${inv.length}/30`;
    // heat bar + ammo bar (ranged weapons)
    const heatBar=document.getElementById('heat-bar');
    const heatFill=document.getElementById('heat-fill');
    const ammoBar=document.getElementById('ammo-bar');
    const ammoFill=document.getElementById('ammo-fill');
    const ammoLabel=document.getElementById('ammo-label');
    const ammoIcon=document.getElementById('ammo-icon');
    if(heatBar && heatFill){
      const isRanged=this.game.player.ranged;
      heatBar.classList.toggle('hidden',!isRanged);
      if(isRanged){
        heatFill.style.width=Math.min(100,p.heat/this.game.player.heatCap*100)+'%';
        heatFill.className='heat-fill'+(p.heat>=p.heatCap?' overheat':'')+(this.game.player._overheatCd>0?' cooldown':'');
      }
    }
    // ammo bar: show for bow/crossbow; hide for staff (no ammo) and melee
    if(ammoBar && ammoFill && ammoLabel && ammoIcon){
      const weaponId = p.weapon;
      const kind = weaponId ? (weaponId.includes('crossbow') ? 'crossbow'
                              : weaponId.startsWith('bow_')    ? 'bow' : null) : null;
      const needsAmmo = !!kind;
      ammoBar.classList.toggle('hidden', !needsAmmo);
      if(needsAmmo){
        // AMMO_ORDER is the canonical preference list; filter to this kind.
        const matching = (p.ammo || {});
        const orderedIds = AMMO_ORDER.filter(id => AMMO[id] && AMMO[id].forKind === kind);
        let total = 0, activeId = null, activeQty = 0;
        for(const id of orderedIds){
          if((matching[id]||0) > 0){
            total += matching[id];
            if(!activeId){ activeId=id; activeQty=matching[id]; }
          }
        }
        // visual fill: 30 arrows = 100% bar; soft cap so the bar is readable
        const cap = 30;
        ammoFill.style.width = Math.min(100, (total/cap)*100) + '%';
        ammoFill.className = 'ammo-fill' + (total===0 ? ' empty' : total<=5 ? ' low' : '');
        ammoLabel.textContent = total>0 ? String(total) : 'none';
        ammoIcon.textContent = kind==='crossbow' ? '⊢' : '➶';
        // DEFAULT_AMMO is the "expected" ammo id for this kind — surface a helpful hint
        // when the player has none of the default and only better types loaded.
        const expected = DEFAULT_AMMO[kind];
        ammoBar.title = activeId
          ? 'Next shot: ' + (AMMO[activeId]?.name || activeId) + ' x' + activeQty
              + (activeId === expected ? '' : '  (default: ' + (AMMO[expected]?.name||expected) + ')')
          : 'Out of ammo — buy ' + (AMMO[expected]?.name||expected) + ' from a shop';
      }
    }
  }

  showInteract(label){ this.el.interactLabel.textContent=label; this.el.interact.classList.remove('hidden'); }
  hideInteract(){ this.el.interact.classList.add('hidden'); }

  toast(msg, color){
    const d=document.createElement('div'); d.className='toast-msg'; d.textContent=msg;
    if(color) d.style.color=color;
    const wrap=document.createElement('div'); wrap.appendChild(d); this.el.toast.appendChild(wrap);
    setTimeout(()=>{ wrap.style.transition='opacity .4s'; wrap.style.opacity='0'; setTimeout(()=>wrap.remove(),400); },1800);
  }
  autosaveFlash(msg){
    const el=this.el.autoSave; if(!el) return;
    el.textContent='\u2714 '+msg; el.style.opacity='1';
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer=setTimeout(()=>{ el.style.opacity='0'; },2200);
  }

  // ===== HOVER TOOLTIPS (items + spells) =====
  // friendly stat labels and whether higher is a % value
  _statLabel(k){ return ({atk:'Attack',def:'Defense',hp:'Health',mp:'Mana',
    crit:'Crit Chance',cdr:'Cooldown',spelldmg:'Spell Power',greed:'Gold Find'})[k]||k.toUpperCase(); }
  _statVal(k,v){ return (k==='crit'||k==='cdr')?('+'+v+'%'):('+'+v); }

  // Build rich HTML for an item (catalog id, or full item object with rolled affixes).
  _itemMeta(item){
    const isObj = typeof item==='object';
    const cat = isObj ? (CATALOG[item.id]||{}) : (CATALOG[item]||{});
    const it = isObj ? item : resolveEquip(item);
    if(!it) return null;
    const consumable = (it.type==='consumable')||(cat.type==='consumable');
    return { it, cat, consumable };
  }
  _buildItemHeader(meta){
    const {it, cat, consumable} = meta;
    const col = consumable ? '#cdd3df' : rarityColor(it);
    const rname = consumable ? '' : rarityName(it);
    let html = `<div class="tt-name" style="color:${col}">${it.icon||cat.icon||''} ${it.name||cat.name||''}</div>`;
    html += `<div class="tt-type">${rname?rname+' ':''}${(it.type||cat.type||'').toUpperCase()}`;
    if(it.ranged) html+=' \u00b7 RANGED';
    html += '</div>';
    return html;
  }
  _buildStatLines(meta){
    const {it, cat} = meta; let html = '';
    const stats = it.stats || cat.stats;
    if(stats){ for(const k in stats){ if(!stats[k]) continue;
      html += `<div class="tt-stat"><span>${this._statLabel(k)}</span><span class="v">${this._statVal(k,stats[k])}</span></div>`; } }
    if((it.atkSpeed||cat.atkSpeed)){ const a=it.atkSpeed||cat.atkSpeed;
      html += `<div class="tt-stat"><span>Atk Speed</span><span class="v">${a.toFixed(2)}s</span></div>`; }
    if((it.reach||cat.reach)){ html += `<div class="tt-stat"><span>Reach</span><span class="v">${it.reach||cat.reach}</span></div>`; }
    const ax = affixText(it);
    if(ax) html += `<div class="tt-affix">${ax}</div>`;
    return html;
  }
  _buildItemComparison(meta){
    const {it, cat, consumable} = meta; if(consumable) return '';
    const cmp=compareItem(it, this.game.player.equipment);
    if(!cmp) return '';
    const word=cmp.dir==='better'?'Upgrade':cmp.dir==='worse'?'Downgrade':'Sidegrade';
    return `<div class="tt-cmp"><span class="${cmp.dir}">${cmp.text} vs equipped - ${word}</span></div>`;
  }
  _buildItemTooltip(item, opts){
    opts=opts||{};
    const meta = this._itemMeta(item);
    if(!meta) return '';
    const {it, cat, consumable} = meta;
    let html = this._buildItemHeader(meta);
    html += this._buildStatLines(meta);
    if(consumable && cat.price!=null) html += `<div class="tt-stat"><span>Value</span><span class="v">${cat.sell||Math.floor(cat.price/2)}g</span></div>`;
    html += this._buildItemComparison(meta);
    if(opts.hint) html += `<div class="tt-hint">${opts.hint}</div>`;
    return html;
  }

  // Build rich HTML for a spell, scaled to the player's current level/spell power.
  _buildSpellTooltip(id, opts){
    opts=opts||{}; const sp=SPELLS[id]; if(!sp) return '';
    const p=this.game.player;
    const pr=sp.proj||{};
    const dmg=Math.round((pr.base + p.level*(pr.perLvl||0))*(p.spellMul||1));
    let html = `<div class="tt-name" style="color:#b9a7ff">${sp.icon} ${sp.name}</div>`;
    html += `<div class="tt-type">SPELL</div>`;
    html += `<div class="tt-stat"><span>Damage</span><span class="v">${dmg}</span></div>`;
    html += `<div class="tt-stat"><span>Mana Cost</span><span class="v">${sp.cost}</span></div>`;
    html += `<div class="tt-stat"><span>Cooldown</span><span class="v">${sp.cd}s</span></div>`;
    if(pr.aoe) html += `<div class="tt-stat"><span>Blast Radius</span><span class="v">${pr.aoe}</span></div>`;
    if(pr.chain) html += `<div class="tt-stat"><span>Chains</span><span class="v">${pr.chain} foes</span></div>`;
    if(sp.nova) html += `<div class="tt-stat"><span>Nova Bolts</span><span class="v">${sp.nova}</span></div>`;
    if(pr.status) html += `<div class="tt-stat"><span>Effect</span><span class="v">${pr.status}</span></div>`;
    if(pr.kind==='ice') html += `<div class="tt-stat"><span>Effect</span><span class="v">freeze</span></div>`;
    if(sp.healOnCast) html += `<div class="tt-stat"><span>Heals</span><span class="v">+${sp.healOnCast} HP</span></div>`;
    if(sp.desc) html += `<div class="tt-desc">${sp.desc}</div>`;
    if(opts.hint) html += `<div class="tt-hint">${opts.hint}</div>`;
    return html;
  }

  _showTooltip(html, ev){
    const tt=this.el.tooltip; if(!tt||!html) return;
    tt.innerHTML=html; tt.classList.remove('hidden');
    this._moveTooltip(ev);
  }
  _moveTooltip(ev){
    const tt=this.el.tooltip; if(!tt||tt.classList.contains('hidden')) return;
    const pad=14; let x=ev.clientX+pad, y=ev.clientY+pad;
    const r=tt.getBoundingClientRect();
    if(x+r.width>window.innerWidth-6) x=ev.clientX-r.width-pad;
    if(y+r.height>window.innerHeight-6) y=ev.clientY-r.height-pad;
    tt.style.left=Math.max(4,x)+'px'; tt.style.top=Math.max(4,y)+'px';
  }
  _hideTooltip(){ const tt=this.el.tooltip; if(tt) tt.classList.add('hidden'); }
  // attach hover handlers to an element; htmlFn() returns the tooltip body (called lazily)
  _bindTooltip(el, htmlFn){
    el.addEventListener('mouseenter', e=>this._showTooltip(htmlFn(), e));
    el.addEventListener('mousemove', e=>this._moveTooltip(e));
    el.addEventListener('mouseleave', ()=>this._hideTooltip());
  }
  floater(text,wx,wy,color){
    const cam=this.game.cam;
    const sx=(wx-cam.x)/this.game.canvas.width*window.innerWidth;
    const sy=(wy-cam.y)/this.game.canvas.height*window.innerHeight;
    // Damage batching: if a pure-numeric floater of the same color landed
    // within the last 350ms and ~30px of this position, increment its count
    // instead of spawning a new one. CRIT/CHAIN/HEAL/PARRY have their own
    // types so they never collapse into a damage number.
    const numMatch = text.match(/^-?\d+$/);
    if(numMatch){
      if(!this._floaterBatch) this._floaterBatch=[];
      const now=performance.now();
      // expire old entries
      this._floaterBatch = this._floaterBatch.filter(b => now-b.ts<350);
      for(const b of this._floaterBatch){
        if(b.color===color && Math.hypot(b.wx-wx, b.wy-wy)<30 && b.text===text){
          b.count++; b.ts=now;
          b.el.textContent = text + ' x' + b.count;
          // re-bump the visual by toggling the class so the animation restarts
          b.el.style.animation='none'; void b.el.offsetWidth; b.el.style.animation='';
          return;
        }
      }
      const d=document.createElement('div');
      d.className='floater'+(text.startsWith('-')?' floater-hit':'');
      d.textContent=text; d.style.color=color;
      d.style.left=sx+'px'; d.style.top=sy+'px'; this.el.floaters.appendChild(d);
      this._floaterBatch.push({text, color, wx, wy, ts:now, count:1, el:d});
      setTimeout(()=>{ d.remove(); }, 900);
      return;
    }
    // Non-numeric (CRIT, PARRY, OVERHEAT, etc) — never batch.
    const d=document.createElement('div'); d.className='floater'; d.textContent=text; d.style.color=color;
    d.style.left=sx+'px'; d.style.top=sy+'px'; this.el.floaters.appendChild(d);
    setTimeout(()=>d.remove(),900);
  }

  drawMinimap(){} // minimap removed - use M key for full map

  // ===== FULL MAP (M) =====
  showFullMap(){
    const w=this.game.world, cv=document.getElementById('fullmap-canvas');
    const title=document.getElementById('fullmap-title');
    if(title) title.textContent='MAP - '+w.def.name;
    if(!cv) return;
    // size canvas to map aspect, capped
    const maxW=640, maxH=460;
    const scale=Math.min(maxW/w.cols, maxH/w.rows);
    cv.width=Math.round(w.cols*scale); cv.height=Math.round(w.rows*scale);
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    // tiles
    for(let y=0;y<w.rows;y++)for(let x=0;x<w.cols;x++){
      const t=w.map[y][x]; let c='#2c4a30';
      if(t===2)c='#2f6fb0';else if(t===1)c='#b89b72';else if(t===7)c='#1d2330';
      else if(t===9)c='#b03030';else c=w.pal?w.pal.fa:'#2c4a30';
      ctx.fillStyle=c; ctx.fillRect(x*scale,y*scale,Math.ceil(scale),Math.ceil(scale));
    }
    const dot=(wx,wy,col,r)=>{ ctx.fillStyle=col; ctx.beginPath();
      ctx.arc(wx/TILE*scale, wy/TILE*scale, r, 0, 7); ctx.fill(); };
    // chests
    for(const c of w.chests) if(!c.opened) dot(c.wx+16,c.wy+16,'#ffcf4d',3);
    // npcs (+ labels)
    ctx.font='8px monospace'; ctx.textAlign='center';
    for(const n of w.npcs){ dot(n.wx+16,n.wy+16,'#4dd28a',3);
      ctx.fillStyle='#cfe'; ctx.fillText(n.name, n.wx/TILE*scale, n.wy/TILE*scale-4); }
    // portals (+ destination labels)
    for(const p of w.portals){ dot(p.wx,p.wy,'#a45cff',4);
      ctx.fillStyle='#d9b3ff'; ctx.fillText(p.label||'', p.wx/TILE*scale, p.wy/TILE*scale-5); }
    // player (pulsing)
    dot(this.game.player.x,this.game.player.y,'#fff',4);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(this.game.player.x/TILE*scale,this.game.player.y/TILE*scale,7,0,7); ctx.stroke();
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
      // canvas-rendered icon for armor/helm/shield/ring/weapon; text for empty
      const iconCell = document.createElement('span');
      iconCell.className = 'slot-icon';
      if(it && this._drawGearCanvasIcon(iconCell, it)){
        // canvas icon rendered; keep the empty fallback hidden
        iconCell.textContent = '';
      } else {
        iconCell.textContent = it ? it.icon : '-';
      }
      d.appendChild(document.createElement('span'));
      d.children[0].className = 'slot-label';
      d.children[0].textContent = slot.toUpperCase();
      d.appendChild(iconCell);
      const nameCell = document.createElement('span');
      nameCell.className = 'slot-name';
      nameCell.style.color = col;
      nameCell.innerHTML = (it?it.name:'')+(ax?'<br><span class="affix-line">'+ax+'</span>':'');
      d.appendChild(nameCell);
      d.onclick=()=>{ if(it) this.game.unequip(slot); this.refreshChar(); };
      if(it) this._bindTooltip(d, ()=>this._buildItemTooltip(it,{hint:'Click to unequip'}));
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
        const cmp=compareItem(item,p.equipment);
        c.style.borderColor=rarityColor(item);
        c.innerHTML='';
        if(!this._drawGearCanvasIcon(c, item)){ c.textContent = item.icon; }
        if(cmp){ const span=document.createElement('span');
          span.className='cmp cmp-'+cmp.dir; span.textContent=cmp.text; c.appendChild(span); }
        this._bindTooltip(c, ()=>this._buildItemTooltip(item,{hint:'Click to equip'}));
        c.onclick=()=>{ this.game.equipItem(item); this.refreshChar(); this.refreshBag(); };
        gearDiv.appendChild(c);
      });
    }
  }
  _stat(label,val){ return `<div class="stat-line"><span class="stat-label">${label}</span><span class="stat-val">${val}</span></div>`; }

  // Draw a gear icon into a 24x24 canvas inside the given cell. Returns true
  // if a canvas icon was drawn. Falls back to text otherwise (consumables
  // like potions don't get canvas icons).
  _drawGearCanvasIcon(cell, item){
    const t = item.type;
    if(t !== 'armor' && t !== 'helm' && t !== 'shield' && t !== 'ring' && t !== 'weapon') return false;
    // clear any prior canvas so refresh doesn't pile them up
    const existing = cell.querySelector('canvas');
    if(existing) existing.remove();
    const cv = document.createElement('canvas');
    cv.width = 24; cv.height = 24;
    cv.style.display = 'block';
    cv.style.imageRendering = 'pixelated';
    const ctx = cv.getContext('2d');
    if(t === 'armor')   drawArmorIcon(ctx, 0, 0, item);
    else if(t === 'helm')   drawHelmIcon(ctx, 0, 0, item);
    else if(t === 'shield') drawShieldIcon(ctx, 0, 0, item);
    else if(t === 'ring')   drawRingIcon(ctx, 0, 0, item);
    else if(t === 'weapon') drawWeaponIcon(ctx, 0, 0, item);
    cell.appendChild(cv);
    return true;
  }

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
  _renderShopBuyList(stock, eq){
    const buy=this.el.shopBuy; if(!buy) return;
    buy.innerHTML='';
    for(const id of stock){
      const c=CATALOG[id], row=document.createElement('div'); row.className='shop-row';
      const cmp=compareItem(c,eq);
      row.innerHTML=`<span>${c.icon} ${c.name}${cmp?'<span class="cmp cmp-'+cmp.dir+'">'+cmp.text+'</span>':''}</span><span class="shop-price">${c.price}g</span>
        <button class="menu-btn shop-buy-btn" data-id="${id}">Buy</button>`;
      row.querySelector('.shop-buy-btn').onclick=()=>{ this.game.buyItem(id); this.refreshShop(); this.refreshBag(); };
      this._bindTooltip(row, ()=>this._buildItemTooltip(id,{hint:c.price+'g to buy'}));
      buy.appendChild(row);
    }
  }
  _renderShopSellList(){
    const sell=this.el.shopSell; if(!sell) return;
    sell.innerHTML='';
    this.game.inventory.forEach(item=>{
      if(item.type==='consumable'&&(!item.qty||item.qty<=0)) return;
      const c=CATALOG[item.id]||{}; const val=c.sell||Math.floor((c.price||0)/2);
      const row=document.createElement('div'); row.className='shop-row';
      row.innerHTML=`<span>${item.icon} ${item.name}${item.type==='consumable'&&item.qty>1?' x'+item.qty:''}</span>
        <span class="shop-price">${val}g</span><button class="menu-btn shop-sell-btn">Sell</button>`;
      row.querySelector('.shop-sell-btn').onclick=()=>{ this.game.sellItem(item); this.refreshShop(); this.refreshBag(); };
      this._bindTooltip(row, ()=>this._buildItemTooltip(item,{hint:val+'g to sell'}));
      sell.appendChild(row);
    });
  }
  _renderSpellShop(){
    const spDiv=this.el.shopSpells; if(!spDiv) return;
    const g=this.game, p=g.player, kn=new Set([...knownSpells(p.skills),...Object.keys(g._boughtSpells||{})]);
    spDiv.innerHTML='';
    const shown=new Set();
    for(const id in SPELLS){
      const sp=SPELLS[id], r=spellRank(id);
      if(shown.has(r.base)) continue;
      const known=kn.has(id), canBuy=(sp.learnCost||0)>0&&!known;
      const upSp=sp.upgrade?SPELLS[sp.upgrade]:null;
      const canUp=known&&upSp&&(sp.upgradeCost||0)>0;
      if(!canBuy&&!canUp) continue;
      shown.add(r.base);
      const cost=canBuy?(sp.learnCost||0):(sp.upgradeCost||0);
      const row=document.createElement('div'); row.className='shop-row';
      row.innerHTML=`<span>${sp.icon} ${sp.name}${known?' \u2713':''}</span><span class="shop-price">${cost}g</span>
        <button class="menu-btn shop-buy-btn" data-spell="${id}" data-action="${canBuy?'buy':'upgrade'}">${canBuy?'Learn':'Upgrade'}</button>`;
      spDiv.appendChild(row);
    }
    spDiv.querySelectorAll('.shop-buy-btn').forEach(btn=>{
      btn.onclick=()=>{
        const sid=btn.dataset.spell, act=btn.dataset.action;
        if(act==='buy') g.buySpell(sid); else g.upgradeSpell(sid);
        this.refreshShop(); this.hud&&this.hud._updateSpellLoadout();
      };
    });
    if(!shown.size) spDiv.innerHTML='<p class="text-[9px] text-gray-500">No spells available.</p>';
  }
  refreshShop(){
    const p=this.game.player; const g=this.el.shopGold; if(g) g.textContent=p.gold;
    const stock=this.game.shopStock||SHOP_STOCK;
    this._renderShopBuyList(stock, p.equipment);
    this._renderShopSellList();
    this._renderSpellShop();
  }

  // ===== STASH (city bank) =====
  openStash(){ const m=document.getElementById('stash-modal'); m.classList.remove('hidden'); m.classList.add('flex'); this.refreshStash(); }
  _fillItemGrid(host, items, onClick, hintFn){
    if(!host) return; host.innerHTML='';
    items.forEach(item=>{
      const c=document.createElement('div'); c.className='inv-cell';
      if(item.type!=='consumable') c.style.borderColor=rarityColor(item);
      c.innerHTML=`${item.icon}<span class="qty">${item.qty>1?item.qty:''}</span>`;
      this._bindTooltip(c, ()=>this._buildItemTooltip(item,{hint:hintFn?hintFn(item):''}));
      c.onclick=()=>onClick(item);
      host.appendChild(c);
    });
  }
  refreshStash(){
    const g=this.game;
    this._fillItemGrid(this.el.stashBag, g.inventory, it=>{ g.toStash(it); }, ()=>'Click to store');
    this._fillItemGrid(this.el.stashStore, g.stash, it=>{ g.fromStash(it); }, ()=>'Click to withdraw');
    if(this.el.stashBagCount) this.el.stashBagCount.textContent=`${g.inventory.length}/30`;
    if(this.el.stashStoreCount) this.el.stashStoreCount.textContent=`${g.stash.length}/${g.STASH_MAX}`;
  }

  // ===== CRAFT (Blacksmith forge) =====
  openCraft(){ const m=document.getElementById('craft-modal'); m.classList.remove('hidden'); m.classList.add('flex');
    this._craftSel=null; this.refreshCraft(); }
  refreshCraft(){
    const g=this.game; if(this.el.craftGold) this.el.craftGold.textContent=g.player.gold;
    const gear=g.inventory.filter(it=>it.type!=='consumable');
    // keep selection valid
    if(this._craftSel && !gear.includes(this._craftSel)) this._craftSel=null;
    this._fillItemGrid(this.el.craftGear, gear, it=>{ this._craftSel=it; this.refreshCraft(); }, ()=>'Click to select');
    // highlight selected
    if(this._craftSel){ const idx=gear.indexOf(this._craftSel);
      const cell=this.el.craftGear.children[idx]; if(cell) cell.classList.add('sel'); }
    this._renderCraftDetail();
  }
  _renderCraftDetail(){
    const d=this.el.craftDetail; if(!d) return;
    const it=this._craftSel;
    if(!it){ d.innerHTML='<p class="text-[10px] text-gray-500">Select a piece of gear to reforge (reroll its bonuses) or upgrade (raise its rarity).</p>'; return; }
    const rc=reforgeCost(it), uc=upgradeCost(it), canUp=canUpgrade(it);
    const sec=stripEnchantCost(it);
    const gold=this.game.player.gold;
    const encLine = it.enchant
      ? `<div class="craft-affix">Active enchant: <b>${it.enchant}</b></div>` : '';
    d.innerHTML=`<div class="craft-sel-name" style="color:${rarityColor(it)}">${it.icon} ${rarityName(it)} ${it.name}</div>
      <div class="craft-affix">${affixText(it)||'<span class="text-gray-500">no bonus stats</span>'}</div>
      ${encLine}
      <button class="menu-btn craft-btn" id="craft-reforge" ${gold<rc?'disabled':''}>Reforge — ${rc}g</button>
      <div class="craft-hint">Re-rolls the bonus stats at the current rarity.</div>
      <button class="menu-btn craft-btn" id="craft-upgrade" ${(!canUp||gold<uc)?'disabled':''}>${canUp?('Upgrade — '+uc+'g'):'Max rarity'}</button>
      <div class="craft-hint">${canUp?'Raises rarity one tier and re-rolls for the higher tier.':'Already legendary.'}</div>
      ${sec?`<button class="menu-btn craft-btn" id="craft-strip" ${gold<sec?'disabled':''}>Strip Enchant — ${sec}g</button>
      <div class="craft-hint">Removes the current enchant and returns the matching scroll to your bag.</div>`:''}`;
    const rb=d.querySelector('#craft-reforge'); if(rb) rb.onclick=()=>{ const ni=this.game.reforgeItem(it);
      if(ni) this._craftSel=ni; this.refreshCraft(); };
    const ub=d.querySelector('#craft-upgrade'); if(ub) ub.onclick=()=>{ const ni=this.game.upgradeItem(it);
      if(ni) this._craftSel=ni; this.refreshCraft(); };
    const sb=d.querySelector('#craft-strip'); if(sb) sb.onclick=()=>{ this.game.stripEnchantFromItem(it); this.refreshCraft(); };
  }

  // ===== ENCHANT (Arcane Anvil) =====
  openEnchant(){ const m=document.getElementById('enchant-modal');
    m.classList.remove('hidden'); m.classList.add('flex');
    this._enchantSel=null; this._enchantScroll=null; this.refreshEnchant();
  }
  refreshEnchant(){
    const g=this.game;
    if(!g) return;
    const goldEl = document.getElementById('enchant-gold');
    if(goldEl) goldEl.textContent = g.player.gold;
    // weapons column
    const wpDiv = document.getElementById('enchant-weapons');
    if(wpDiv){
      wpDiv.innerHTML = '';
      const weapons = g.inventory.filter(it => it.type === 'weapon');
      if(!weapons.length){
        wpDiv.innerHTML = '<div class="text-[9px] text-gray-500 text-center py-4">No weapons in your bag.</div>';
      }
      for(const w of weapons){
        const info = w.enchant ? enchantInfo(w.enchant) : null;
        const cost = enchantCost(w);
        const row = document.createElement('div');
        row.className = 'shop-row';
        const col = w.rarity ? rarityColor(w) : '#cdd';
        row.innerHTML = `<span style="color:${col}">${w.icon} ${w.name}${info ? ' <span style="color:'+info.color+'">['+info.short+']</span>' : ''}</span>
          <span class="shop-price">${cost}g</span>`;
        row.onclick = ()=>{ this._enchantSel = w; this.refreshEnchant(); };
        if(this._enchantSel === w) row.style.borderColor = '#ffcf4d';
        wpDiv.appendChild(row);
      }
    }
    // scrolls column
    const scDiv = document.getElementById('enchant-scrolls');
    if(scDiv){
      scDiv.innerHTML = '';
      const scrolls = g.inventory.filter(it => it.type === 'consumable' && CATALOG[it.id] && CATALOG[it.id].enchant);
      if(!scrolls.length){
        scDiv.innerHTML = '<div class="text-[9px] text-gray-500 text-center py-4">No scrolls. Buy them at the Arcanum shop.</div>';
      }
      // dedupe by enchant kind, show stack
      const seen = new Set();
      for(const s of scrolls){
        const k = CATALOG[s.id].enchant;
        if(seen.has(k)) continue;
        seen.add(k);
        const info = enchantInfo(k) || {name:k, color:'#ffcf4d', desc:''};
        const totalQty = scrolls.filter(x => CATALOG[x.id] && CATALOG[x.id].enchant === k).reduce((a,x)=>a+(x.qty||1), 0);
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `<span style="color:${info.color}">${CATALOG[s.id].icon} ${info.name} <span class="text-gray-400">x${totalQty}</span></span>
          <span class="shop-price" style="color:${info.color}">${info.short}</span>`;
        row.onclick = ()=>{ this._enchantScroll = s.id; this.refreshEnchant(); };
        if(this._enchantScroll === s.id) row.style.borderColor = info.color;
        scDiv.appendChild(row);
      }
    }
    // detail: combine selected weapon + scroll
    const det = document.getElementById('enchant-detail');
    if(det){
      const w = this._enchantSel;
      const sid = this._enchantScroll;
      if(w && sid){
        const k = CATALOG[sid] && CATALOG[sid].enchant;
        const info = k ? enchantInfo(k) : null;
        const cost = enchantCost(w);
        const col = info ? info.color : '#cdd';
        const cur = w.enchant ? enchantInfo(w.enchant) : null;
        det.innerHTML = `<div class="craft-sel-name" style="color:${col}">${cur ? 'Re-enchant '+w.name+' to ' : 'Enchant '+w.name+' with '}${info ? info.name : k}</div>
          <div class="craft-affix" style="color:${col}">${info ? info.desc : ''}</div>
          <div class="text-[9px] text-gray-400">Cost: <span class="text-gold">${cost}g</span> + 1× ${CATALOG[sid].name}</div>
          <div class="mt-2"><button id="enchant-go" class="menu-btn">BIND ENCHANTMENT</button></div>`;
        const btn = det.querySelector('#enchant-go');
        if(btn) btn.onclick = ()=>{
          const ni = g.enchantItemWith(w, sid);
          if(ni){
            // refresh weapon list (in case names changed) and clear picks
            this._enchantSel = ni;
            this._enchantScroll = null;
            this.refreshEnchant();
          }
        };
      } else {
        det.innerHTML = '<div class="text-[9px] text-gray-500">Pick a weapon on the left and a scroll on the right to see the binding cost.</div>';
      }
    }
  }

  setFps(v,show){ this.el.fps.classList.toggle('hidden',!show); this.el.fps.textContent='FPS '+v; }

  // ===== ACHIEVEMENTS =====
  // Steam-style toast that pops in from the right, lingers, and slides out.
  achievementToast(a){
    const wrap = document.getElementById('achieve-toasts');
    if(!wrap) return;
    const t = document.createElement('div');
    t.className = 'achieve-toast';
    t.innerHTML = `<div class="ico">${a.icon}</div>
      <div><div class="lbl">ACHIEVEMENT UNLOCKED</div>
      <div class="nm">${a.name}</div>
      <div class="ds">${a.desc}</div></div>`;
    wrap.appendChild(t);
    // animate in next frame
    requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('in')));
    // slide out and remove after 4s
    setTimeout(()=>{ t.classList.remove('in'); setTimeout(()=>t.remove(), 400); }, 4000);
  }

  // Full achievements panel (Y key). Tab by category, show progress bars.
  _achieveActiveCat = 'all';
  refreshAchievements(){
    const game = this.game;
    const tracker = game && game.achievements;
    const wrap = document.getElementById('achieve-list');
    const tabs = document.getElementById('achieve-tabs');
    const prog = document.getElementById('achieve-progress');
    if(!wrap || !tabs) return;
    if(!tracker){
      wrap.innerHTML = '<div class="text-[9px] text-gray-500 text-center py-6">No save data loaded.</div>';
      tabs.innerHTML = '';
      if(prog) prog.textContent = '0 / 0';
      return;
    }
    // progress header
    const stats = achievementStats(tracker.unlocked);
    if(prog) prog.textContent = `${stats.done} / ${stats.total}`;
    // tabs
    tabs.innerHTML = '';
    const cats = [{id:'all', name:'All', color:'#cdd3df'}, ...ACHIEVEMENT_CATS];
    cats.forEach(c=>{
      const b = document.createElement('button');
      b.className = 'achieve-tab' + (c.id === this._achieveActiveCat ? ' active' : '');
      b.style.background = c.id === this._achieveActiveCat ? c.color : '#0d1018';
      b.style.color = c.id === this._achieveActiveCat ? '#0d1018' : c.color;
      b.textContent = c.name;
      b.onclick = ()=>{ this._achieveActiveCat = c.id; this.refreshAchievements(); };
      tabs.appendChild(b);
    });
    // rows
    wrap.innerHTML = '';
    const list = Object.values(ACHIEVEMENTS);
    const filtered = this._achieveActiveCat === 'all' ? list : list.filter(a => a.cat === this._achieveActiveCat);
    if(!filtered.length){
      wrap.innerHTML = '<div class="text-[9px] text-gray-500 text-center py-6">No achievements in this category.</div>';
      return;
    }
    // sort: unlocked first, then by goal
    filtered.sort((a,b)=>{
      const ua = !!tracker.unlocked[a.id], ub = !!tracker.unlocked[b.id];
      if(ua !== ub) return ua ? -1 : 1;
      return (a.goal||0) - (b.goal||0);
    });
    for(const a of filtered){
      const unlocked = !!tracker.unlocked[a.id];
      const now = this._achieveProgress(a, tracker);
      const row = document.createElement('div');
      row.className = 'achieve-row' + (unlocked ? ' unlocked' : '') + (a.secret ? ' secret' : '');
      row.innerHTML = `<div class="achieve-icon" style="color:${unlocked ? '#ffcf4d' : '#3a4258'}">${a.icon}</div>
        <div><div class="achieve-name">${a.name}${a.secret ? ' <span class="text-[6px] text-cyan-300">[SECRET]</span>' : ''}</div>
        <div class="achieve-desc">${a.desc}</div>
        <div class="achieve-bar"><div style="width:${Math.min(100, Math.floor(now/a.goal*100))}%; background:${unlocked ? '#ffcf4d' : a.cat==='secrets' ? '#5ad8ff' : '#74d83f'}"></div></div>
        <div class="achieve-progress-label">${now} / ${a.goal}</div></div>
        <div></div>`;
      wrap.appendChild(row);
    }
  }
  // Resolve current numeric progress for a stat-based achievement
  _achieveProgress(a, tracker){
    if(!tracker || !a.stat) return 0;
    if(a.stat === 'maps') return Object.keys(tracker.stats.maps || {}).filter(k => tracker.stats.maps[k] > 0).length;
    if(a.stat === 'topAffixCount') return tracker.stats.topAffixCount || 0;
    return tracker.stats[a.stat] || 0;
  }

  // ===== COMBAT LOG (L key) =====
  // A scrollable, semi-transparent overlay that records the last 20 combat
  // events (damage taken/dealt, kills, heals, gold gains, portal entries).
  // Logged at most once per frame to keep tight combat loops from spamming.
  logCombat(text, kind='info'){
    if(!this._combatLog) this._combatLog=[];
    this._combatLog.push({ text, kind, t: Date.now() });
    if(this._combatLog.length > 20) this._combatLog.shift();
    this.refreshCombatLog();
  }
  refreshCombatLog(){
    const list = document.getElementById('combat-log-list');
    if(!list) return;
    list.innerHTML='';
    if(!this._combatLog) this._combatLog=[];
    for(const e of this._combatLog){
      const d=document.createElement('div');
      d.className='log-row log-'+e.kind;
      d.textContent=e.text;
      list.appendChild(d);
    }
    // scroll to bottom so the freshest line is always visible
    list.scrollTop = list.scrollHeight;
  }
  openCombatLog(){
    const m=document.getElementById('combat-log-modal');
    if(!m) return;
    m.classList.remove('hidden'); m.classList.add('flex');
    this.refreshCombatLog();
  }
  closeCombatLog(){
    const m=document.getElementById('combat-log-modal');
    if(!m) return;
    m.classList.add('hidden'); m.classList.remove('flex');
  }
}


