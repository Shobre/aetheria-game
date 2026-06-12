# Aetheria — Future Improvement Plan

A working-session planning doc: what to **add**, **improve**, **change**, and **remove**.
Live build: https://aetheria-game-alpha.vercel.app

Status legend: 🔴 high impact · 🟡 medium · ⚪ polish/nice-to-have

---

## ADD (new features)

### Gameplay systems
- 🔴 **Save anywhere / autosave on area change.** Right now you must open the menu to save. Autosaving on each checkpoint (area entry) would prevent lost progress and pairs naturally with the new checkpoint system.
- 🔴 **Minimap legend + full-map (M).** The minimap is dense; a press-M overworld map showing discovered areas and portal links would help navigation now that there are ~16 maps.
- 🟡 **Ammo/quiver for ranged weapons** (optional) or a stamina/heat cost so bows aren't strictly better than melee. Currently ranged has range with no downside besides slightly lower per-hit damage.
- 🟡 **Weapon-skill scaling** — let STR/DEX-style stats or skill nodes boost melee vs ranged separately, giving builds identity.
- 🟡 **Elite/champion enemies** — occasional buffed variants (extra HP, an affix like "explodes on death") that drop guaranteed rare loot. Makes farming runs spicier.
- 🟡 **More bosses** — one per biome (desert/cave/snow/swamp), each gating a unique reward. Two exist (Bone Tyrant, Bog Witch).
- ⚪ **Pets/summons** spell school, **dash-attack** weapon arts, **parry** window on block (perfect-block reflects projectiles).
- ⚪ **Day/night tint** and weather per biome for atmosphere.

### Content & economy
- 🔴 **Quest variety** — escort, timed-clear, and "bring N items" turn-ins. Current quests are kill/reach/boss only.
- 🟡 **Crafting / upgrade bench** at the Blacksmith: combine duplicate gear + gold to reroll or raise rarity. Gives a gold sink and a reason to keep drops.
- 🟡 **Bank/stash** in the city so the 30-slot bag isn't a hard wall.
- 🟡 **Reputation / unlockable shop tiers** — clearing biomes unlocks better stock.

### UX
- 🟡 **Item tooltips on hover** with full stat/affix comparison vs equipped (currently only title attributes).
- 🟡 **Rebindable keys** + gamepad support.
- ⚪ **Damage-number batching** and a combat log panel.

---

## IMPROVE (existing systems)

- 🔴 **Pathfinding.** Enemies move by direct vector and can get stuck on walls/corners. A light A* or flow-field would make the new vision-cone chasing feel much smarter.
- 🟡 **Refactor the complexity hotspots fallow flags** — `enemy.update` (cognitive 66) and `player.recompute` (28) are the biggest. Extract the perception block and the per-behavior AI into named helpers; split recompute into `_deriveCombat` / `_deriveWeapon`.
- 🟡 **Spawn placement** — enemies sometimes spawn clumped or inside decor. Add spacing + walkability checks (partly done for boss adds).
- 🟡 **Balance pass** — with farming enabled, XP/gold curves need tuning so the player doesn't outscale content too fast (or too slow). Add per-map level recommendations.
- 🟡 **Audio** — the procedural music is thin; add per-biome motifs and a low-health heartbeat cue.
- ⚪ **Sprite art** — replace the canvas-drawn shapes with a real sprite sheet (the draw methods are isolated, so this is contained).

---

## CHANGE (rework decisions)

- 🟡 **Equipment as objects everywhere.** We currently store starter gear as id-strings and rolled gear as objects, with `resolveEquip` bridging them. Normalizing everything to item objects would simplify `equipItem`/save/HUD and remove a class of bugs (we already hit one with weapon meta fields).
- 🟡 **Unify the "shop stock" source.** `SHOP_STOCK` (legacy global) still exists as a fallback alongside per-NPC `stock`. Pick per-NPC only and delete the global once every merchant has stock.
- ⚪ **Spell unlock rules** are split between `unlock` (skill id) and a special-case for `spellpower`. Fold the book spells into explicit skill nodes for consistency.
- ⚪ **Skill "rearranging"** — the tree is fixed-layout by design; the rearrangeable surface is the q/e/r spell loadout. If true skill respec is wanted, add a "Forget skills" NPC for gold rather than drag-reordering the tree.

---

## REMOVE / RETIRE

- 🟡 **Legacy `SHOP_STOCK`** once per-NPC stock fully replaces it (see Change above).
- ⚪ **Unused tile ids** in `world.js` (`HOLE`, `FLOORALT`) — defined but never placed. Drop or actually use them.
- ⚪ **`killedEnemies` remnants** — fully removed from logic this round; double-check no save-schema references linger.
- ⚪ Consider retiring the **interior `house1` "Merchant's Hut"** now that the City has a full set of shops — or repurpose it as a player home/stash.

---

## Suggested next milestone (if continuing)
1. **Autosave + full map (M)** — biggest QoL wins, low risk.
2. **Pathfinding** — biggest feel improvement for the new AI.
3. **Crafting bench + stash** — gives the farming loop a payoff and a gold sink.
4. **One new boss per biome** — uses systems already in place.

My recommendation: start with **autosave + the full map screen** (quick, high value), then invest in **pathfinding** since it multiplies the value of the vision-cone AI we just built.
