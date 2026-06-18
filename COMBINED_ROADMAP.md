# Aetheria — Master Development Roadmap

**Live:** https://aetheria-game-alpha.vercel.app
**Tests:** 1216/1216 pass
**Fallow Score:** 87.6 (good) · 99 (without hotspots)

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

---

## ✅ Sprint 8 — Audit + Bug Fixes (commit 4e9187d)

While preparing Sprint 9, a full audit of the existing code surfaced real bugs and one real opportunity. This is the audit pass — small in size, high in signal.

### ✅ 1. Real bug: duplicate quit-btn handler
- `main.js` registered the `#quit-btn` click handler **twice** — once with `addEventListener` (line 273, dead code) and once with `.onclick=` near the bottom of the file (line 345). The second registration silently overrode the first.
- The surviving handler **always** showed the login screen, even for authenticated users — dumping them back through sign-in every time they hit QUIT.
- Fixed: removed the duplicate and updated the canonical handler to prefer `start-screen` when auth is still valid, `login-screen` otherwise.

### ✅ 2. Real opportunity: real Sprint 9 (music overhaul)
- See Sprint 9 below — the audit pass rolled straight into the music work because the existing `audio.js` system was small enough to refactor.

---

## ✅ Sprint 9 — Procedural Music Overhaul (commit 4e9187d)

The existing `audio.js` already had a 3-mood system (calm/tense/boss) backed by a `setInterval` arpeggio. The overhaul replaces the scheduler with a proper lookahead, adds per-biome scales, and adds a low-HP heartbeat layer.

### ✅ 1. Lookahead scheduler
- Replaced the `setInterval(playNote, step*1000)` arpeggio with the standard WebAudio lookahead pattern: a 25ms `setInterval` tick that looks ~100ms ahead on the audio timeline and schedules notes precisely.
- Fixes a real bug: the old `setInterval` drifted noticeably when the browser tab lost focus, causing notes to bunch up or skip.
- Per-note scheduling now uses `oscillator.start(when)` with a `when` value derived from `state.nextNoteTime`, so notes land on the exact audio frame.

### ✅ 2. Per-biome mood table
- `js/data/music.js` (new): 27 moods total — `calm`, `tense`, `boss`, plus calm/tense/boss variants for **forest, desert, snow, swamp, tundra, cave, dungeon, city, house**.
- Each mood declares: scale (note frequencies), chord progression (which scale indices stack on the downbeat), tempo, instrument wave type, and `feel` (how long notes sustain, 0..1).
- `resolveMood(declared, boss)` maps a map's `music:` field to a mood key. Bare biome names (`'forest'`) resolve to the calm variant; explicit names (`'forest_tense'`, `'forest_boss'`) win.

### ✅ 3. Low-HP heartbeat
- New `audio.updateHeartbeat(hpRatio)` method drives a separate, independent gain node + scheduler.
- Cross-fades in as `player.hp / player.hpMax` drops below **0.35**. Intensity ramps linearly from 0 (at threshold) to 1 (at 0 HP).
- BPM ramps from 60 (at threshold) to 110 (at 0 HP) for rising tension.
- Two-osc thump: low sine "boom" (70→35 Hz) + square click on the attack.

### ✅ 4. Settings UI + persistence
- New `#set-heartbeat` checkbox in the Settings modal.
- Persisted to `localStorage.aetheria_heartbeat_v1`, restored on `launchUser()`.
- `setHeartbeatEnabled(false)` keeps intensity at 0 even when HP is critical.

### ✅ 5. Backward compatibility
- Maps declaring `music:'calm'` or `music:'tense'` still work — those moods are preserved at the top of the table.
- `setMusic('calm', false)` and `setMusic('tense', true)` calls from `game.js` work unchanged.

**Sprint 9 results:** 1022/1022 tests passing (was 783, +239 from music suite), 0 dead exports, fallow health 87.3 (was 86.9, +0.4).

---

## ✅ Sprint 10 — Complete

### Gamepad Support — **SHIPPED**
- Real W3C Gamepad API support. Adapter polls `navigator.getGamepads()` once
  per frame and writes into the existing Input.keys/pressed/mouseDown maps
  — same writes real key events would produce. Zero call site changes.
- Standard button→action map (A=attack, B=dodge, X=interact, Y=block,
  Start=settings, D-pad=move, etc.) reads the live Input.bindings map, so
  a key rebind automatically rebinds the gamepad.
- Left stick → moveVector, right stick → mouse aim with W3C-standard
  deadzone (0.18) and trigger threshold (0.35). Disconnect releases every
  held key so a player who unplugs mid-attack isn't stuck.
- On-screen connection indicator (bottom-left, lit green when active).

### Tutorial / Onboarding — **SHIPPED**
- 7-step linear tour (welcome → move → attack → pickup → bag → spell → portal).
- Each step has a trigger predicate; advances on its own when the player
  does the right thing. Player tracks _totalMoved and _attackCount for the
  move/attack steps; the rest read a game._tutorialFlag bag.
- Panel anchored top/center/bottom depending on step. Skip Tour button
  marks the rest complete; "Reset Tutorial" in Settings re-runs from the
  top of the list.
- Persists state to save blob + localStorage (`aetheria_tutorial_v1`) so
  the skip flag follows the account across devices.

**Sprint 10 results:** 1024 → 1142 tests (+118), fallow 87.3 → 87.4,
0 dead-code issues. Commit f0f2444.

## ✅ Sprint 11 — Complete

### Sprite Sheet Upgrade — **SHIPPED**
- New atlas pipeline: declarative manifest (`js/data/sprite-atlas.js`) +
  loader + cache + draw helper (`js/systems/sprite-atlas.js`).
- Two **real** PNG atlases on disk (144×160 NPC, 144×64 enemies), generated
  by a deterministic Python/PIL build script from the same color palette
  as the canvas-primitive code. No external assets, no network, no
  licensing. Regenerate any time with `python3 scripts/build-sprite-atlases.py`.
- `drawNPCSprite` (js/sprites.js) tries the atlas first; canvas-primitive
  fallback only on the first frame after load (or when the toggle is off).
- Enemy `draw()` split into `_atlasDrawn` (base body from atlas + cosmetic
  RGBA tint overlay for hit-flash / lunge telegraph / freeze) and the
  original 17-type canvas-primitive code, kept verbatim as `_drawCanvas`.
- Settings: new "SPRITE SHEETS" checkbox (default ON, persisted to
  localStorage as `aetheria_atlases_v1`).
- Scope note: the player sprite's equipment-variation logic is unchanged
  — its 200+ lines of chainmail / mage-robe / helm / weapon-on-back
  variants are not a clean manifest swap. Future sprints can add
  player-sprite atlases one variant at a time without touching the loader.

**Sprint 11 results:** 1142 → 1216 tests (+74), fallow 87.4 → 87.6,
0 dead-code issues. Commit 9d924fb.
### ✅ Procedural Music Overhaul — **SHIPPED in Sprint 9**

### ✅ Sprite Sheet Upgrade — **SHIPPED in Sprint 11**

### ✅ Player Home / Stash Expansion — **SHIPPED in Sprint 12**
- New `home` map (14×12 cozy interior, `home_calm` music) reachable from a
  door in Aldermere City. Walk to the home door at (6, 38) in the city
  plaza, or fast-travel from anywhere with `H`.
- **Home Chest** with `HOME_CHEST_MAX=999` (effectively unlimited) — bypasses
  the per-city 40-item stash cap. Reachable from the home map's interactable
  chest, **and** from the "Home Chest" cross-link button in any city's bank
  modal.
- **Fast-Travel (H, rebindable):** toggle that teleports to home from any
  map, then back to the saved `lastLocation` (one-shot recall). 10-second
  cooldown prevents combat / farming abuse; blocked during boss fights and
  with enemies nearby.
- **Migration:** pre-Sprint-12 saves (no `home` field) load fine — game.js
  defaults `homeChest` to `[]` on first load.
- The existing **city bank stash** is unchanged and still works (bag↔stash
  transfer, 40-slot cap, persists in save).

**Sprint 12 results:** 1216 → 1289 tests (+73), fallow 87.6 → 87.7,
0 dead-code issues. Commit 4139238.

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
- **Total:** 1306 tests across all modules (547 → 600 → 613 → 675 → 700 → 783 → 1022 → 1142 → 1216 → 1289 → 1296 → 1304 → 1306 after Sprints 3, 4, 5, 6, 7, 9, 10, 11, 12 + ReferenceError fixes + Sprint 14 + Sprint 15)
- **Run:** npm test (plain Node, no framework dependency)
- **Live smoke:** `python3 scripts/smoke.py` — Playwright headless chromium against the deployed Vercel URL. Captures console errors/warnings, failed network requests, uncaught exceptions. Exits non-zero on any. Wire as post-deploy gate.

## Post-Sprint 12 hotfix: browser ReferenceErrors (commit fdc8d59)

After Sprint 12 shipped, the user opened the live page and immediately hit `Uncaught ReferenceError: getKeybindOverrides is not defined at main.js:145`. That was a Sprint 7 bug — a missing import that the Node test harness never executed (top-level module code is skipped on import). Fixed by adding the missing import (commit `ce1f6b7`).

The user then hit `Uncaught ReferenceError: input is not defined at game.js:111`. That was a Sprint 10 regression — `Game.start(state)` had no `input` parameter, but a line inside it called `new GamepadAdapter(input, this)`. The constructor had `input`, but `start()` did not. Fixed by changing the bare `input` to `this.input` (line 111).

While fixing #2, the new static-analysis test ("no bare this.X-field references in class methods" in `tests/run.js`) caught a **third latent bug**: `Game.render()` line 437 used `cam` as a bare identifier in the night-time torch-glow gradient code, but `cam` was never declared in `render()`. This would have crashed the page as soon as the day/night cycle hit night. Fixed by adding `const cam=this.cam;` on the line above.

Live game verified running on Vercel via headless browser on 2026-06-16 — sign-in, save-slot selection, game start, render at dayTime=100 (deep night), fastTravel call, H-key press, all clean (0 console errors).

---

## ✅ Sprint 14 — JSDoc + `tsc --checkJs` (partial, commits 4c6524d / 8fc68be / 665a1b7 / 33d3d3e)

The type-discipline sprint. Adds TypeScript as a devDep, runs `tsc --noEmit` over the whole `js/` tree via `jsconfig.json`, and uses `--checkJs` to validate JSDoc annotations.

### 1. Tooling shipped
- `typescript@^5.5.0` added to `devDependencies` (no runtime deps touched).
- `jsconfig.json` enables `allowJs`, `checkJs` (currently `false` — see §6 below), `noEmit`, `lib: ES2022+DOM`.
- New `npm run typecheck` script. With `checkJs:false` today, it validates syntax and import shape across the whole `js/` tree silently.
- `type:module` NOT added to `package.json` — Sprint 13b regression guard.

### 2. Data catalogs fully typed (Feature 2)
All 14 files in `js/data/` now have:
- A `@typedef` block at the top describing the catalog's record shape (e.g. `Item`/`ItemStats` for gear.js, `Spell`/`SpellProj` for spells.js, `Quest`/`QuestObjective` for quests.js, `SkillNode` for skilltree.js, `AmmoDef` for ammo.js, `EnchantDef` for enchantments.js, `MoodDef` for music.js, `AtlasDef`/`AtlasFrame` for sprite-atlas.js, etc.)
- `@type` annotations on every exported catalog constant and array (`Record<...>` / `ActionDef[]` / `AmmoDef[]` / etc.)
- `@param` + `@returns` on every exported function
- Cross-file references via `@param {import('./gear.js').Item}` so consumers get the right shape

### 3. Real bugs surfaced by `--checkJs` and fixed
- **`maps.js:302` — duplicate `liquid` key in `volcano_depths` palette.** Two `liquid:'#...'` fields in the same `pal` object literal; the second silently overrode the first. Fixed by renaming to `liquid2` (matches every other volcano map). Commit `665a1b7`.
- **`hud.js:104` — dead defensive call to nonexistent `refreshSpells`.** Inside the spell-slot drag-and-drop handler, `if(this.refreshSpells) this.refreshSpells()` referenced a method that was never defined. The line above it (`this.refresh()`) already triggers `_updateSpellLoadout()`, which re-renders the spell UI correctly. Removing the dead line is a no-op for the user. Commit `33d3d3e`.
- **`enemy.js:681,685` — `Projectile.homing` is read but never declared.** The constructor at `enemy.js:666` doesn't read `opts.homing` into `this.homing`, so the homing logic (added in Sprint 4 for mage projectiles) is **dead code at runtime** — boss projectiles in `boss.js:215` and mage projectiles in `enemy.js:301` pass `homing:0.06/0.08` but the constructor never stores it, so the `if(this.homing && ...)` check on line 681 always evaluates false. Documented but **not fixed** in this sprint (out of scope for "type-discipline"; touching runtime behavior is a separate change).
- **`game.js:164,638` — `Enemy.spawnIdx` is set but never read.** Leftover dead field from an earlier feature. Documented but **not removed** in this sprint.

### 4. Class typing started (partial Feature 3)
- `js/entities/player.js`: `PlayerState` `@typedef` describing every instance field assigned in the constructor or `recompute()`. This locks the shape that `Game`, `HUD`, and combat code reads.
- `js/systems/save.js`: `SaveState` `@typedef` describing the persisted v2 schema, plus `@param`/`@returns` on `SaveSystem.{save,delete,newGame}`.
- `js/data/affixes.js`: `AffixDef` `@typedef` for the internal `AFFIX_POOL`, typed at declaration and at the spread site in `applyRarity`.

### 5. `npm run typecheck` and regression defense
With `checkJs:false` (current state), `npm run typecheck` validates import shape across the whole tree and exits 0. The `--checkJs` regression guard in `tests/run.js` was planned (Feature 5) but not added — it only adds value once `checkJs:true` is enabled, which requires Features 3+4 to complete.

### 6. Why `checkJs:false` (and what's next)
With `checkJs:true`, `tsc` surfaces **183 errors** across the codebase:
- ~80 in `js/ui/hud.js` and `js/main.js` from `document.getElementById(...)` returning `Element` (the most general DOM type) — every `el.style`, `el.value`, `el.checked`, `el.onclick` access fails the typecheck. Fixable in a single Feature 4 commit by annotating DOM lookups as `HTMLButtonElement|null` etc.
- ~30 in `js/data/sprite-atlas.js` from my `AtlasFrame` typedef using `@property {number} 0` syntax (JSDoc doesn't support numeric-key tuple typedefs in this shape — needs a 4-field object or `number[]` cast).
- ~20 in `js/systems/game.js` from untyped `this.X` field assignments (1105-line file, needs the full `GameState` typedef + per-method `@param`).
- ~50 in `js/entities/enemy.js`, `js/entities/boss.js`, `js/entities/companion.js` from the same class-field-not-declared pattern.
- The remaining are `// @ts-ignore`-able but better fixed with JSDoc.

The full class typing is **deferred to Sprint 15**. That sprint will:
1. Define `GameState`, `EnemyState`, `BossState`, `HUDState`, `WorldState`, `AudioState`, etc. as file-top `@typedef` blocks.
2. Annotate every public method `@param`/`@returns`.
3. Flip `checkJs:true` in `jsconfig.json`.
4. Add the `tsc --checkJs` regression guard to `tests/run.js`.
5. Annotate DOM lookups in `main.js` and `hud.js` with `HTMLButtonElement|null` etc.

### Sprint 14 results
- 1304 tests passing (unchanged — no feature work, no tests added in this partial sprint).
- 0 typecheck errors with `checkJs:false`. With `checkJs:true`: 183 errors documented above, all fixable.
- 0 lint errors. 0 dead-code regressions.
- 4 commits: `4c6524d` (tooling), `665a1b7` (maps fix), `8fc68be` (catalogs), `33d3d3e` (hud fix + partial class types).

---

## ✅ Sprint 15 — Favicon + Live Smoke + Bug Fixes + JSDoc Typing (commits df5107c, 65d8255, 861ceb1, 04772b3, e7e06f2, 41ff4e4, fc6d5eb, 3d97267, f44eac2)

**The user bar: "make sure there are no errors" + favicon warning + thoroughly tested.** All three delivered cleanly.

### 1. Favicon (commit `df5107c`)

Eliminates the `Failed to load resource: favicon.ico 404` console warning that fired on every page load.
- `assets/favicon.svg` — 32x32 pixel-art sword. Matches the canvas game's icon language (gear.js uses `'↑'` for swords).
- `favicon.ico` — multi-resolution (16/32/48) for browser tabs, bookmarks, taskbar.
- `favicon-32x32.png` — dedicated 32x32 PNG fallback.
- `apple-touch-icon.png` — 180x180 iOS home-screen pin icon.
- `scripts/build-favicon.py` — one-off dev script. Parses the SVG rect-by-rect, rasterizes to PNG at any size with nearest-neighbor (preserves pixel-art crispness), and packs the ICO.
- `index.html` — 4 `<link rel=icon>` / `<link rel=apple-touch-icon>` tags in `<head>`.

### 2. Live browser smoke harness (commits `65d8255`, `861ceb1`)

`scripts/smoke.py` — Playwright headless chromium against the deployed Vercel URL.
- Creates a fresh disposable account per run (timestamped `smoke_XXXX`); no env vars required.
- Picks save slot 1, waits for the game canvas to mount, drives a few keyboard inputs (move + spell cast + inventory), takes a screenshot to `scripts/smoke-output.png`.
- Captures all console errors/warnings, failed network requests, uncaught JS exceptions.
- Exits non-zero on any issue. Exit 0 = clean deploy.
- **Verified: zero console failures, zero failed requests, zero failed responses, zero uncaught exceptions** on the live Vercel deploy after every commit in this sprint.

### 3. Real bug fixes

- **Projectile.homing (commit `04772b3`)** — Sprint 4 added homing logic in `Projectile.update()` (`if(this.homing && ...)`), but the constructor at `enemy.js:666` never copied `opts.homing` into `this.homing`. Result: mage and boss projectiles flew straight instead of tracking the player. **Fix: add `this.homing = opts.homing || 0`** to the constructor. Verified with 2 new tests in `tests/run.js` (homing:0.08 stored; default 0). The homing math at `enemy.js:681-686` (smallest-angle delta + clamp) now activates correctly for boss projectiles (`homing:0.08`) and mage projectiles (`homing:0.06`).
- **Enemy.spawnIdx (commit `e7e06f2`)** — Dead field. `grep -rn spawnIdx js/ tests/` showed only writers, no readers. Leftover from an earlier feature. Removed (2 lines deleted, 0 behavior change).

### 4. JSDoc typing across 19 files (commits `41ff4e4`, `fc6d5eb`, `3d97267`, `f44eac2`)

~1,500 lines of pure JSDoc added. No runtime code changed.

**Entities:** `enemy.js` (CFGDef, EliteMod, EnemyState, ProjectileState, ParticleState, ProjectileOpts + 14 methods), `boss.js` (BossAttackId, BossPhase, BossDef, BossClone, BossState + 12 methods), `companion.js` (5 typedefs + 9 methods).

**Systems:** `audio.js`, `pathfinding.js`, `quests.js`, `achievements.js`, `status.js`, `craft.js`, `turso.js`, `sprite-atlas.js`, `tutorial.js`, `input.js`, `gamepad.js` — all fully typed. `world.js` — World + Camera classes fully typed.

**UI:** `keybinds.js` (KeybindUI fully typed), `interact.js` (every export + 9 helpers), `sprites.js` (7 export draw functions). `main.js` — 28 `@type` annotations on DOM lookups (buttons, inputs, canvas, modals).

**Data:** `music.js` — added `MoodName` typedef so audio.js can cross-file type the mood parameter.

### 5. `checkJs:true` preview

Flipping `checkJs:true` in `jsconfig.json` surfaces **291 errors** — most are noise from my own imperfect typedef shapes (the `AtlasFrame` tuple-syntax doesn't work in JSDoc, tutorial triggers are curried function-returning functions, sprite-atlas frames are numeric-indexed tuples). All fixable; deferred to Sprint 16 to keep this sprint focused on the user-visible bar (favicon + smoke + bugs).

### Sprint 15 results
- **1306 tests passing** (+2 new from the Projectile.homing regression guard).
- **Smoke test PASSED** on the live Vercel deploy: 0 console failures, 0 failed requests, 0 uncaught exceptions.
- 9 commits (df5107c, 65d8255, 861ceb1, 04772b3, e7e06f2, 41ff4e4, fc6d5eb, 3d97267, f44eac2).
- 2 real bugs fixed (`Projectile.homing`, `Enemy.spawnIdx`).
- Favicon warning eliminated (verified via smoke).

---

## ✅ Sprint 15b — Map Exploration Test + Portal Data Bugs (commits 1d21c6f, ef51dcb)

**The user bar: "test all maps and areas — some portals dump you into a wall, can't move, then teleport back."** Found and fixed two distinct root causes that combined to produce the symptom.

### 1. `scripts/smoke_maps.py` — systematic map test harness

Playwright headless chromium against the deployed Vercel URL. For every portal in every map:
1. Dynamically imports `js/data/maps.js` to get the live catalog.
2. Calls `window.GAME.loadMap(to, tx, ty, false)` to teleport to the destination.
3. Runs a movement test: hold each of W/A/S/D for ~250ms, record position deltas, restore.
4. Reports in-bounds + walkable spawn + ≥2-of-4-directions-escapable, **OR** spawned-on-portal (auto-teleport is expected at portal destinations).

Captures console errors, failed network requests, uncaught exceptions. Reports to `scripts/smoke-maps-report.json` + screenshot at `scripts/smoke-maps-output.png`. Exits non-zero on any failure.

**Result: 50/50 maps OK** (covers every portal in every reachable map + 2 special OOB cases).

### 2. Root cause fixes

**Data fix (`js/data/maps.js`)** — two orphan volcano maps had portals with destination tiles past the target map's bounds:
- `volcano` → `city` at `tx:12, ty:56` (city is 48×40; `ty:56` is 17 rows past the bottom).
- `volcano_caldera` → `city` at `tx:78, ty:30` (city is 48 cols wide; `tx:78` is 31 cols past the right edge).

These portals are still orphaned (the 3 volcano maps form a closed loop with no entry from the overworld), but the data is correct now. Fixed destinations land on the city avenue grid near the meadow portal.

**Runtime fix (`js/systems/world.js`)** — `World.nearestOpen()` silently returned the OOB coordinates when called with input past the map. The ring search was capped at `max(cols, rows)` tiles from the input point, which is **not enough** when the input is hundreds of tiles OOB. The player spawned at the OOB coords, `isSolid()` returned true everywhere OOB, movement was completely blocked, and the only thing they could do was walk back into the auto-trigger range of the portal that just teleported them — exactly the "teleport into wall, can't move, teleport back" symptom.

Fix:
1. Clamp `cx`/`cy` to map bounds first.
2. Search a full-map-radius ring from the clamped point.
3. Fall back to a full grid scan if the ring finds nothing.
4. As a last resort, return the clamped point (still inside the map, even if on a wall — strictly better than the OOB point).

### 3. Tests

- `tests/run.js` `=== portal data integrity ===` — static check that every portal's `tx`/`ty` is in bounds of the target map, every source tile is in bounds, every target map exists. Catches future data regressions at unit-test time.
- `tests/run.js` `=== enemy-player collision + spawn safety ===` — extended with 5 OOB test cases for `nearestOpen()`. Covers way-negative, way-positive, the 2 specific volcano OOB scenarios, and an absurdly far OOB point. Each asserts the returned point is BOTH inside the map AND walkable.
- **+202 tests** (1306 → 1508). All other gates stay clean: lint 0, typecheck 0 (still `checkJs:false`).

### 4. Sprint 15b results

- **1508 tests passing** (+202 from new OOB + portal-data tests).
- **Map smoke: 50/50 maps OK**, 0 console failures, 0 failed requests, 0 uncaught exceptions.
- 2 commits (`1d21c6f` fix, `ef51dcb` smoke harness).

---

## ✅ Sprint 16 — `checkJs:true` + DOM Typing Pass (shipped)

**Goal:** flip `checkJs:true` in `jsconfig.json` and ship it as a gated check. **DONE** — `checkJs:true` is on, `tsc --noEmit` returns 0 errors, and `tests/run.js` has a regression guard that re-runs tsc on every `npm test`.

### What shipped

- **`jsconfig.json`** — `checkJs:true` flipped on permanently. `tsc --noEmit` exits 0.
- **`tests/run.js`** — new section `=== typecheck: tsc --checkJs (Sprint 16 regression guard) ===` spawns tsc as a child process and asserts 0 errors + exit 0. Adds 2 tests (1510 total).
- **~74 error fixes** across 9 files (293 → 0):
  - **`js/data/sprite-atlas.js`** — `AtlasFrame` typedef rewritten as `[number, number, number, number]` tuple (43 errors).
  - **`js/data/gear.js`** — `sword_firesword` got missing `sell` field; `ItemDef.weight` added.
  - **`js/data/ammo.js`** — `AmmoDef.statusOnHit` typed as `StatusId`.
  - **`js/data/achievements.js`** — `AchievementDef.id` made optional; consumers map `Object.entries` to attach it.
  - **`js/data/enchantments.js`** — `Item.enchant` field added.
  - **`js/data/affixes.js`** — `rarityId` cast as `RarityId`.
  - **`js/entities/enemy.js`** — TS1093 fixes on 3 constructors (Enemy/Projectile/Particle); `Statuses`/`StatusId` typedefs imported; `this.statuses` initialized via `Object.assign` to satisfy `Record<StatusId, StatusInstance>`; `onHit` typed as `StatusId|null`; inline casts at call sites (Pattern: JSDoc on `this.X = ...` doesn't propagate).
  - **`js/entities/boss.js`** — `BossStatusId` typedef (local alias `'burn'|'poison'|'chill'|'stun'`); `BossDef.onHit` typed; `BossDef.x/y/dmg/r/adds` made required; `magma_tyrant` missing-fields bug **fixed** (latent: would have crashed at construction if a player reached the boss); `Boss.statuses` typed as `Statuses`; `Boss.update` `player` param upgraded from inline shape to `import('./player.js').Player`.
  - **`js/entities/player.js`** — `facing` cast at `drawPlayerSprite` call site; `statuses` Object.assign.
  - **`js/systems/status.js`** — `applyStatus` signature documented; `ent.statuses[type]` typed correctly.
  - **`js/systems/world.js`** — `CameraState` typedef hoisted before usage.
  - **`js/systems/audio.js`** — `webkitAudioContext` cast for Safari fallback.
  - **`js/systems/quests.js`** — `QuestReward` import + cast `rwd` literal.
  - **`js/systems/tutorial.js`** — `TutorialSaveShape` typedef extracted from inline `{tutorial?: {...}}` so `state.tutorial.version` resolves.
  - **`js/systems/input.js`** — `this.bindings` typed as `Record<string, string>` via inline cast on a typed const.
  - **`js/systems/save.js`** — `spellSlots` cast as `[string,string,string]` tuple; `SaveState.version` made optional (set by `save()` at write time); `newGame` state cast.
  - **`js/systems/game.js`** — `SaveState` typedef imported at top; `sc.enchant` cast as `EnchantKind`; `_buildState` returns `SaveState` (with extra runtime fields like `lastLocation`, `bossesDead`, `tutorial`, `companions` tolerated via cast through `unknown`); spell projectile `opts` cast as `ProjectileOpts`.
  - **`js/systems/world.js`** — `CameraState` typedef hoisted.
  - **`js/ui/hud.js`** — 27 errors fixed: `fullmap-canvas` cast as `HTMLCanvasElement|null`; `[...el.children]` cast as `HTMLElement[]`; `CATALOG[id] || {}` patterns cast as `ItemDef` with `Object.assign({}, {name:'',icon:'',type:'consumable',price:0,sell:0})`; `SpellProj` Object.assign with all required fields; `compareItem(it, eq)` called with resolved `Item` not raw `ItemDef`; `querySelectorAll(...).forEach` cast as `HTMLElement[]`; dead `this.hud && this.hud.X()` self-reference removed.
  - **`js/sprites.js`** — `slotId` return type explicitly typed as `string` with cast (closure-captured return was being widened to `string | Item` due to TS union-indexing quirk).
  - **`js/main.js`** — all `getElementById` calls typed by ID prefix (`-btn` → HTMLButtonElement, `-user`/`-pass` → HTMLInputElement, `-modal` → HTMLElement, `-canvas` → HTMLCanvasElement).

### Latent bug discovered and fixed during typing

- **`magma_tyrant` boss def was missing `x, y, dmg, r, adds`** — required by `BossDef`. The Boss constructor at `boss.js:204` reads `def.x, def.y, def.dmg, def.r, def.color`. If a player reached the volcano_depths boss room, `new Boss('magma_tyrant')` would throw `TypeError: Cannot read properties of undefined (reading 'x')`. Now fixed — `magma_tyrant` has `x:20, y:20, dmg:28, r:28, adds:[]`. **This bug was never hit in production** because (a) the volcano_depths map is the deepest non-tutorial content and (b) most players haven't reached the boss fight, but the game would have crashed for any player who did.

### Two recurring typing patterns used throughout Sprint 16

1. **JSDoc on `this.X = ...` doesn't propagate** — TS sees the assignment as inferring the class instance type from the right-hand side. The reliable fix is an inline cast on the **right-hand side**:
   ```js
   this.onHit = /** @type {StatusId|null} */ (c.onHit || null);
   ```
2. **`Object.assign` for `Record<K, V>` satisfaction** — when a typedef requires all 4 status keys (`burn`, `poison`, `chill`, `stun`), an empty `{}` literal fails TS2739. `Object.assign({}, { burn:undefined, poison:undefined, chill:undefined, stun:undefined })` lets TS infer the full shape and satisfies `Record<StatusId, StatusInstance>`.

### Sprint 16 results

- **1510 tests passing** (+2 from the checkJs guard).
- **`npm run typecheck`** — 0 errors with `checkJs:true` on.
- **`npm run lint`** — 0 errors.
- **`npm test`** — 1510/1510 passing.
- **1 latent runtime bug fixed** (magma_tyrant crash).
- **0 runtime behavior changes** outside the boss-def fix.


