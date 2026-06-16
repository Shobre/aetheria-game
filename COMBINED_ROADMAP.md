# Aetheria — Master Development Roadmap

**Live:** https://aetheria-game-alpha.vercel.app
**Tests:** 547/547 pass
**Fallow Score:** 89 A (with hotspots) · 99 A (without)

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

## ⬜ Backlog — Future Sprints

### 🟡 Ammo / Quiver System
Ranged weapons require arrows/bolts (limited stack). Craftable purchasable ammo types.

### 🟡 Pathfinding Polish
- Path smoothing / funnel so enemies cut corners
- Flow-field caching for groups of enemies chasing one target

### 🟡 Spawn Placement Improvements
Enemy spawns use walkability + spacing checks (player spawn already fixed)

### 🟡 Balance Pass
XP/gold curves tuned per-map with level recommendations displayed on area entry

### ⚪ Damage Number Batching
Batch nearby same-type hits: show "x3 45" instead of three separate 45s

### ⚪ Combat Log Panel
Toggle with L key, last 20 combat events, scrollable semi-transparent overlay

### ⚪ Rebindable Keys
Settings panel with click-to-rebind for all actions, stored in localStorage

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

- **Total:** 600 tests across all modules (547 → 600 after Sprint 3)
- **Run:** npm test (plain Node, no framework dependency)

---

*Last updated: Sprint 3 complete (commit 270903d)*
