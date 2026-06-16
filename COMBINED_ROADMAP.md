# Aetheria — Master Development Roadmap

**Live:** https://aetheria-game-alpha.vercel.app
**Tests:** 783/783 pass
**Fallow Score:** 86.9 (good) · 99 (without hotspots)

A top-down, Zelda-like action-RPG built with vanilla JS (ES modules), HTML5 Canvas, and Tailwind. Pixel-art rendering, procedural world generation, a full equipment/skill/shop economy, and persistent 3-slot saves with cloud sync.

---

## Status Legend

- ✅ **Done** — Implemented, tested, and deployed
- 🔄 **In Progress** — Actively being worked on
- 🟡 **Planned** — Scheduled for upcoming sprint
- ⚪ **Nice-to-have** — Backlog / polish

---

## ✅ Completed Features

### Combat & Mechanics
- ✅ **WASD movement** — 8-directional with facing toward mouse
- ✅ **Mouse aim + left-click attack** — Melee slash toward cursor
- ✅ **Right-click block / parry** — Shield with 206° arc, follows mouse, 0.2s perfect-parry window reflects projectiles and stuns melee attackers
- ✅ **Space dodge/dash** — Invincibility frames, 0.5s duration, stamina cost
- ✅ **Q / E spell casting** — Two spell slots + R third slot, data-driven SPELLS registry with 3-tier upgrades
- ✅ **F interact** — Talk to NPCs, open chests, use portals
- ✅ **Weapon variety** — Dagger, sword, spear, halberd, greatsword, warhammer, short bow, long bow, crossbow, arcane staff — each with unique slash animations and stats
- ✅ **Ranged weapons** — Fire bolts toward cursor; heat system prevents spam (0-100, forced cooldown at 100)
- ✅ **Weapon skill scaling** — Skill nodes boost melee vs ranged separately

### Enemy AI
- ✅ **Vision cone aggro** — Enemies only chase when they see you (per-type view radius + FOV angle)
- ✅ **Leashing** — Enemies return to spawn after losing sight ~3s
- ✅ **A* pathfinding** — Routes around walls with line-of-sight fast path
- ✅ **Elite (champion) enemies** — Vicious/Armored/Swift/Arcane modifiers, pulsing aura, guaranteed rare drops
- ✅ **One boss per biome** — Meadow Warden, Thornroot Matron, Sandstone Colossus, Crystal Brood, Frostfang Jarl, Sunken Horror, The Faceted One, Magma Tyrant (8 total)
- ✅ **Enemy↔player solid collision** — Enemies cannot walk through player

### HUD & UI
- ✅ **Health / Mana / EXP bars** — Top-left HUD
- ✅ **1-9 usable item slots** — Hotbar with drag-and-drop rearrangement
- ✅ **Bag (B key)** — Full inventory with drag-and-drop, item comparison indicators
- ✅ **Character equipment (C key)** — Equipped gear with tooltips
- ✅ **Skill tree (K key)** — Spend skill points on combat/summon/survival nodes
- ✅ **Full-screen map (M key / map button)** — Canvas-rendered map with tiles, portals, NPCs, player dot
- ✅ **Settings panel (Esc)** — Volume sliders, key rebind display
- ✅ **Quest tracker** — Active quest display, updates every frame
- ✅ **Boss health bar** — Top-center with name + phase pips
- ✅ **Heat bar** — Auto-visible when ranged weapon equipped
- ✅ **Spell loadout UI** — Q/E/R slots with rank display, drag to rearrange

### World & Content
- ✅ **Multiple biomes** — Meadows, Forest, Desert, Snow, Swamp, Volcanic Caldera + Crystal Caverns
- ✅ **Aldermere City** — Town hub with 4 shops (Blacksmith, Alchemist, Arcanum, General Store) + quest NPCs
- ✅ **5 biome sub-areas** — Sunlit Glade, Deepwood Thicket, Buried Ruins, Glacier Hollow, Bog Depths
- ✅ **Day/night cycle** — Time overlay, darker at night, unique night drops
- ✅ **Portals** — Connect all areas, world graph fully linked

### Progression
- ✅ **Item rarity & affixes** — Common → Legendary with randomly rolled bonus stats
- ✅ **Gold economy** — Buy/sell at shops, crafting costs, upgrade costs
- ✅ **Reputation system** — Per-biome rep (0-100), shop tiers at 25/50/75/100
- ✅ **Crafting bench** — Reforge (reroll affixes), Upgrade (raise rarity) at Blacksmith
- ✅ **Spell shop** — Buy new spells + upgrade known spells to rank II/III
- ✅ **40-slot shared stash** — At Banker NPC, persisted in save
- ✅ **Teleport to town (T key / town button)** — Instant return, clears combat state
- ✅ **Checkpoints** — Entering area sets respawn point; regular enemies respawn on entry, bosses stay dead

### Systems
- ✅ **Status effects** — Burn, Poison, Freeze/Chill, Stun with visual tints
- ✅ **Companion system** — Recruitable NPCs with abilities and HP
- ✅ **Quest variety** — kill, reach, boss, collect, escort, timed_clear, survive
- ✅ **Autosave** — 60s timer + on area entry + boss defeat + beforeunload
- ✅ **Cloud saves** — Turso DB, per-user auth, 3 save slots per user
- ✅ **Heat system** — Builds on ranged fire, decays when not firing
- ✅ **Elite enemy spawns** — Champion variants with guaranteed rare loot

---

## ✅ Sprint 3 — Complete

### ✅ 1. Achievement System
Track and display player milestones (first kill, boss slayer, explorer, etc.)
- `js/data/achievements.js` — 32 achievement definitions across 5 categories
- `js/systems/achievements.js` — Tracker with hook into game events
- UI: new panel (Y key or trophy icon) showing locked/unlocked/progress
- Steam-style toast notification on unlock
- Categories: Combat, Exploration, Collection, Quests, Secrets

### ✅ 2. New Enemy Types
- **Mage** — Casts homing missiles or AoE rings, teleports when cornered
- **Berserker** — Starts slow, enrages below 30% HP (speed + damage boost, visual red glow)
- **Frost mage** — Mage variant that chills on hit
- **Tundra enemies** — ice_wraith, frost_golem, snow_stalker (alpha-fades by distance), frozen_husk

Each has: sprite, stats, AI behaviors, drop table, spawn in appropriate biomes.

### ✅ 3. Frozen Tundra Biome + Boss
- 3 maps: `tundra_edge` → `tundra_heart` → `frost_spire`
- Portal chain: snow_glacier → tundra_edge → tundra_heart → frost_spire
- Enemies: ice_wraith, frost_golem, snow_stalker, frozen_husk
- Boss: **Glacius, the Eternal Winter** — 3 phases with frostBolt / blizzard (24 radial) / iceWall (5 in a row) / clones (2 decoys)

### ✅ 4. Weapon Enchantment System
- Enchantments: Fire (burn), Ice (slow), Lightning (chain), Poison (DoT), Holy (bonus vs undead)
- Applied at Anvil of Binding (new NPC in Arcanum)
- Cost: gold + enchantment scroll (catalogue/shop)
- Visual: weapon glow tint matches element
- Enchantment stored in item.enchant field, saved/loaded
- Blacksmith can strip enchant (returns scroll for 75% of base item price)

### ✅ 5. Companion Abilities
- **Kira (Ranger)** — Arrow Volley (3 homing shots, 6s CD)
- **Thorin (Warrior)** — Shield Bash (stun + knockback, 8s CD)
- **Luna (Mage)** — Arcane Blast (AoE + chill, 10s CD)
- G-key binding + HUD cooldown overlay, also fires autonomously in combat

**Sprint 3 results:** 600/600 tests passing (was 547), 0 dead exports, fallow health 86.1 (good)

---

## ✅ Sprint 4 — Complete (commit 834575b → next)

### ✅ 1. Spawn Placement Improvements
Enemies used to spawn on chests, NPCs, portals, or stack on each other. New `World.findSpawnPoint()` keeps every enemy at least:
- 30px away from chests, portals, and NPCs (`reservedZones()`)
- 26px away from every other enemy already placed
- 80px away from the player

### ✅ 2. Damage Number Batching
- Pure-numeric floaters of the same color landing within 30px of each other inside 350ms get merged into "x2 / x3 / x4" stack
- Batched hits use the new `.floater-hit` class (slightly larger + red glow)
- CRIT / PARRY / OVERHEAT / CHAIN labels never collapse into damage numbers
- Resets the floatUp animation on each merge so the player sees the jump

### ✅ 3. Combat Log Panel (L key)
- `Hud.logCombat()` keeps a 20-entry ring buffer
- Auto-logs: enemy kills, boss defeats, crits, damage taken, heals, gold gains, area entries, item pickups, blocks
- L-key toggle (and a 📋 HUD button next to the trophy)
- Color-coded rows: hit (red), crit (gold), kill (green), heal (green), gold (yellow), portal (blue), enchant (purple)
- Scrollable, monospace, semi-transparent

### ✅ 4. Balance Pass
- New `MAP_LEVEL` table in `js/data/maps.js` covering every map
- Map entry shows a warning toast if the player's level is below the recommendation
- Levels scale monotonically: meadow(1) → forest(3) → desert(5) → cave(7) → dungeon1(9) → snow(9) → swamp(10) → dungeon2(12) → tundra_edge(13) → tundra_heart(15) → frost_spire(17)
- Sub-areas sit 1 tier above their parent biome

**Sprint 4 results:** 613/613 tests passing (was 600), 0 dead exports, fallow health 86.2 (good)

## ✅ Sprint 5 — Complete

### ✅ 1. Ammo / Quiver System
Bows and crossbows now require physical ammo. The Arcane Staff is unchanged (it uses MP).
- `js/data/ammo.js` — 5 ammo types in a flat registry: arrow_wood, arrow_iron, arrow_fire (burn), bolt_wood, bolt_iron
- Each entry has `forKind` (bow|crossbow), `atkBonus`, optional `statusOnHit` + `statusDur`, plus price/sell
- `ammoForKind(kind)` + `rangedWeaponKind(weaponId)` map weapons to the right ammo list
- A new `ammo` field on the player holds `{ammoId: qty}` — auto-saved via `_buildState()`
- New game starts with `arrow_wood: 30, bolt_wood: 20` (sourced from `STARTING_AMMO`)
- `_fireRangedShot()` in `game.js` consumes one unit of the best available ammo on every shot; if the quiver is empty the shot is blocked with a "NO AMMO" floater and a soft "click" SFX
- The `addItem()` flow auto-loads bought/found ammo into the quiver (Zelda-style — no manual drag)
- HUD: new `#ammo-bar` element (icon + fill + qty label) sits below the heat bar; pulses red when empty, amber when ≤5
- HUD bag click handler recognises the new `ammo` type and shows an "Auto-used on ranged fire" hint instead of a "Click to use" prompt
- Shop stock: General Store now stocks all 4 basic ammo types. Chests in meadow, forest, and tundra_edge drop starter packs
- Projectile gained a `statusDur` field so elemental ammo (Fire Arrows) can apply burn for a custom duration

### ✅ 2. Ammo data-driven design
- A single `AMMO_ORDER` array defines the universal preference order (best → worst)
- `DEFAULT_AMMO` table (`{bow: 'arrow_wood', crossbow: 'bolt_wood'}`) drives the HUD's "expected ammo" hint
- `weaponNeedsAmmo()` returns false for the staff and any melee weapon, so the gate is a single line

**Sprint 5 results:** 675/675 tests passing (was 613, +62 from ammo suite), 0 dead exports, fallow health 86.5 (good)

## ✅ Sprint 6 — Complete

### ✅ 1. Path Smoothing (line-of-sight pull)
After A* produces a sequence of tile-centre waypoints, a funnel pass walks the path and skips any waypoint the enemy can see straight through. Result: enemies cut corners instead of stair-stepping along tile boundaries.
- `js/systems/pathfinding.js` — new `smoothPath(waypoints, hasLoS)` helper
- `World.findPathSmoothed(sx, sy, tx, ty)` — drops in wherever `findPath` is used
- Enemy `_navigate()` now calls the smoothed variant

### ✅ 2. Flow-Field Cache (shared pathfinding across enemies)
When 6+ enemies chase the same player, each would otherwise run its own A*. A flow field is a single BFS-computed unit-vector grid pointing from every cell toward the player. Enemies read the field as an O(1) lookup.
- `FlowField` class in `pathfinding.js` — BFS distance + neighbour-averaged vectors
- `Game._refreshFlowField(dt)` — recomputes when the player crosses a tile boundary or every 0.5s
- `Enemy._navigate()` — fast-path samples the field before falling back to A*
- `loadMap()` invalidates the cache on map transitions
- Vector construction averages all lower-distance neighbours so cells with 3 open sides get a diagonal vector (not just axis-aligned)
- `TILE` constant inlined in `pathfinding.js` to break the would-be circular import (world.js ↔ pathfinding.js)

**Sprint 6 results:** 700/700 tests passing (was 675, +25 from pathfinding suite), 0 dead exports, fallow health 86.5 (good, unchanged)

## ✅ Sprint 7 — Complete

### ✅ 1. Rebindable Keys
A full action/binding system with click-to-rebind UI. Every gameplay verb (move, dodge, attack, block, spells, hotbar, modals) is now an *action* that resolves to whatever key the player has bound. Mouse buttons (LMB/RMB) are still in the registry but exempt from rebinding — there's no good 2-button alternative in a 2-button game.
- `js/data/keybinds.js` — `ACTIONS` registry (31 actions), `DEFAULT_BIND` (frozen), `REBINDABLE` set, `labelForKey()`, `normalizeKey()`, `mouseKey()`, `findConflict()`, `validateBindings()`
- `Input` class refactored to be action-based: `wasPressed(actionId)`, `isDown(actionId)`, `moveVector()`. `bindings` is a live map; `rebuildKeyIndex()` rebuilds the reverse key→actions map after a rebind
- All call sites migrated: `player.js` (dodge, block, spell_q/e/r), `game.js` (interact, dismiss_companion), `interact.js` (dismiss_companion), `main.js` (all modals, hotbar, settings, teleport, companion ability)
- `spellCd` keys renamed from `q/e/r` to `spell_q/spell_e/spell_r` (consistent with the action system)

### ✅ 2. Rebind UI in Settings
- New "KEYBINDS" panel inside the Settings modal — `index.html` adds `#keybinds-list`, `#keybinds-reset`, `#keybinds-hint`
- Click a key chip → it pulses orange ("listening") → next keypress becomes the binding
- Conflicts highlighted in red via the `findConflict` helper
- Escape cancels listening
- "RESET DEFAULTS" button clears overrides

### ✅ 3. Persistence (localStorage + cloud save)
- Rebinds live in `localStorage[aetheria_keybinds_v1]` (set on every change)
- `_buildState()` includes `keybinds` in the save blob via `getKeybindOverrides()`
- `Game.start()` restores them via `setKeybindOverrides()` so the rebind UI picks them up on next mount
- Bindings follow the player across devices (cloud-save round-trip)

### ✅ 4. Hotbar shows bound key
- HUD spell hotbar now reads `input.bindings[spell_q/e/r]` and renders `labelForKey()` on the cap, so rebinding Q to F shows "F" on the cap

**Sprint 7 results:** 783/783 tests passing (was 700, +83 from keybinds suite), 0 dead exports, fallow health 86.9 (good, +0.4)

## ⬜ Backlog — Future Sprints

### ⚪ Gamepad Support
Left stick move, right stick aim, face buttons for attack/block/dodge/interact, shoulder buttons for spells

### ⚪ Procedural Music Overhaul
Per-biome musical motifs, low-health heartbeat, boss phase intensification

### ⚪ Sprite Sheet Upgrade
Replace canvas-drawn sprites with a real sprite sheet (draw methods already isolated)

### ⚪ Player Home / Stash Expansion
Repurpose Merchants Hut as player home with expanded storage

---

## 🗑️ Removed / Retired

- ~~Legacy SHOP_STOCK~~ — Replaced by per-NPC stock
- ~~Minimap~~ — Replaced by full-screen map button
- ~~Emoji icons~~ — Replaced with Unicode symbols for canvas compatibility
- ~~"type": "module" in package.json~~ — Removed for Vercel CJS API function compatibility

---

## Architecture Notes

- **No build step** for the game itself — ES modules load directly. Tailwind stylesheet is the only precompiled asset.
- **Portable-first:** no hardcoded absolute paths; everything resolves relative to index.html.
- **Data-driven:** maps, gear, skills, quests, and bosses live in js/data/ so content can be added without touching engine code.
- **Project structure:** js/systems/ (game.js, turso.js), js/data/ (quests.js, maps.js), js/entities/ (companion.js), js/ui/ (hud.js), plus top-level modules (player.js, enemy.js, boss.js, world.js, input.js, save.js, spells.js, gear.js, status.js, affixes.js, audio.js, craft.js, skilltree.js, interact.js)

---

## Key Technical Decisions

- Unicode symbols (not emoji) for icons: Emoji do not render in canvas with serif font
- Canvas icon font: "Segoe UI Symbol","Arial Unicode MS",serif
- fallow health via cmd.exe (not PowerShell): PowerShell mangles fallow output
- Accept 89 A with hotspots: Hotspots penalty from git churn history
- Vercel API proxy hides Turso credentials: Credentials never in client code
- package.json without "type": "module": Vercel CJS API functions require CommonJS
- Simple string replacement (not regex) for code edits: Regex causes backslash corruption
- PowerShell -EncodedCommand bridge for G: file access: Direct file tools do not reach G: drive

---

## Test Coverage

- **Total:** 783 tests across all modules (547 → 600 → 613 → 675 → 700 → 783 after Sprints 3, 4, 5, 6, 7)
- **Run:** npm test (plain Node, no framework dependency)

*Last updated: Sprint 7 complete (commit pending)*
