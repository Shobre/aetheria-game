# Aetheria — Future Improvement Plan

A working-session planning doc: what to **add**, **improve**, **change**, and **remove**.
Live build: https://aetheria-game-alpha.vercel.app

Status legend: 🔴 high impact · 🟡 medium · ⚪ polish/nice-to-have

---

## ✅ DONE (this session)

- ✅ **Item comparison indicators** — ▲/▼/= badges on bag + shop items showing score vs equipped.
- ✅ **Autosave** — timed (60s), on area entry, on boss defeat, on beforeunload. Silent flash indicator.
- ✅ **Full-map screen (M key)** — canvas-rendered map with tiles, portals, NPCs, chests, player dot.
- ✅ **Enemy pathfinding** — A* on tile grid with line-of-sight fast path. Enemies route around walls.
- ✅ **Enemy update refactor** — extracted `_rangedAI`, `_chaseAI`, `_updatePerception`, `_applyKnockback`.
- ✅ **Hover tooltips** — rich floating tooltips on items (bag/shop/character/hotbar) and spells (loadout/picker) with full stats, rarity, comparison, and action hints.
- ✅ **Crafting bench + stash** — Forge at the Blacksmith (reforge rerolls affixes, upgrade raises rarity, gold cost scales); 40-slot shared Stash at the Banker NPC, persisted in save.

---

## ADD (new features)

### Gameplay systems
- 🟡 **Ammo/quiver for ranged weapons** or a stamina/heat cost so bows aren't strictly better than melee.
- 🟡 **Weapon-skill scaling** — let skill nodes boost melee vs ranged separately, giving builds identity.
- 🟡 **Elite/champion enemies** — buffed variants that drop guaranteed rare loot.
- 🟡 **More bosses** — one per biome (desert/cave/snow). Two exist (Bone Tyrant, Bog Witch).
- ⚪ **Pets/summons** school, **dash-attack** arts, **parry** window on block (perfect-block reflects projectiles).
- ⚪ **Day/night tint** and weather per biome.

### Content & economy
- 🔴 **Quest variety** — escort, timed-clear, and "bring N items" turn-ins. Current quests are kill/reach/boss only.
- 🟡 **Reputation / unlockable shop tiers** — clearing biomes unlocks better stock.

### UX
- 🟡 **Rebindable keys** + gamepad support.
- ⚪ **Damage-number batching** and a combat log panel.

---

## IMPROVE (existing systems)

- 🟡 **Refactor `Projectile.update`** (cognitive 66, CRITICAL) — extract `_hitEnemy`, `_hitBoss`, `_checkPlayerHit`, `_applyAoe`. This is now the biggest complexity hotspot.
- 🟡 **Refactor `player.recompute`** (cognitive 28) — split into `_deriveBaseStats`, `_deriveFromEquipment`, `_deriveFromSkills`.
- 🟡 **Spawn placement** — enemies sometimes spawn clumped or inside decor. Add spacing + walkability checks.
- 🟡 **Balance pass** — with farming enabled, XP/gold curves need tuning. Add per-map level recommendations.
- 🟡 **Audio** — procedural music is thin; add per-biome motifs and a low-health heartbeat cue.
- ⚪ **Sprite art** — replace canvas-drawn shapes with a real sprite sheet (draw methods are isolated).
- ⚪ **Pathfinding polish** — add path smoothing / funnel so routed enemies cut corners instead of hugging tile centers; cache shared flow-fields when many enemies chase one target.

---

## CHANGE (rework decisions)

- 🟡 **Equipment as objects everywhere.** Normalize everything to item objects (drop id-string shorthand) to simplify `equipItem`/save/HUD.
- 🟡 **Unify the "shop stock" source.** Delete legacy `SHOP_STOCK` global; use per-NPC `stock` only.
- ⚪ **Spell unlock rules** — fold book spells into explicit skill nodes for consistency.
- ⚪ **Skill respec** — if wanted, add a "Forget skills" NPC for gold (tree is fixed-layout by design; the rearrangeable surface is the q/e/r spell loadout).

---

## REMOVE / RETIRE

- 🟡 **Legacy `SHOP_STOCK`** once per-NPC stock fully replaces it.
- ⚪ **Unused tile ids** in `world.js` (`HOLE`, `FLOORALT`) — defined but never placed.
- ⚪ Consider retiring the interior **house1 "Merchant's Hut"** now that the City has a full set of shops — or repurpose as a player home/stash.

---

## Suggested next milestone

1. **One new boss per biome** (desert/cave/snow) — uses systems already in place; gates a unique reward.
2. **Quest variety** — escort, fetch, timed-clear objectives beyond kill/reach/boss.
3. **Elite/champion enemies** — buffed variants that drop guaranteed rare loot; pairs perfectly with the new Forge (gold sink for upgrading those drops).
4. **`Projectile.update` refactor** — biggest remaining complexity hotspot (cognitive 66).
