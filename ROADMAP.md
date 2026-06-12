# Aetheria — Development Roadmap

**Live:** https://aetheria-game-alpha.vercel.app
A top-down, Zelda-like action-RPG built with vanilla JS (ES modules), HTML5 Canvas, and Tailwind. Pixel-art rendering, procedural world generation, a full equipment/skill/shop economy, and persistent 3-slot saves.

This document tracks the planned feature work. Items are grouped by impact tier. Status legend: ✅ done · 🔄 in progress · ⬜ planned.

---

## Tier 1 — Highest gameplay impact

### ✅ 1. Boss fights
A unique multi-phase boss guarding the end of each dungeon, with a dedicated on-screen boss health bar and a guaranteed gear reward on defeat.
- `Boss` entity class extending enemy behaviour with phase transitions (changes attack pattern at 66% / 33% HP).
- Telegraphed special attacks: radial projectile burst, charge/slam, summon adds.
- Dedicated boss HP bar UI (top-center) with name + phase pips.
- Boss arena: spawns once, locks the reward chest until defeated; defeat is persisted so it stays dead.

### ✅ 2. Quests & objectives
NPCs offer quests (kill X enemies, reach a map, retrieve an item) with gold/XP/item rewards.
- Quest registry data file; quest state saved per slot.
- Quest log UI (J key) listing active/completed quests with progress.
- Automatic objective tracking hooked into kills, map loads, and pickups.
- Quest-giver indicators (❗ available / ❓ in-progress / turn-in) over NPC heads.

### ✅ 3. Persistent world state
Cleared content stays cleared across save/load.
- Per-map dead-enemy persistence (not just chests).
- Defeated bosses persist.

---

## Tier 2 — Depth & replayability

### ✅ 4. More biomes / dungeons
- **Frostpeak Tundra** (snow biome): slow-on-hit ice enemies.
- **Murkbog Swamp** (swamp biome): poison hazards + spitters.
- **Sunken Catacomb** (second dungeon): its own boss.
- New enemy types per region; portals weaving them into the existing world graph.

### ✅ 5. Item rarity & affixes
- Rarity tiers: Common / Uncommon / Rare / Epic / Legendary, colour-coded.
- Randomly-rolled bonus affixes on dropped gear (e.g. "+3 ATK, +5% crit").
- Rarity-weighted loot tables; rarer drops from tougher enemies and bosses.
- Inventory/character/shop UI shows rarity colours and rolled stats.

### ✅ 6. Status effects
A general status-effect system applied to player and enemies.
- **Burn** (damage over time), **Poison** (DoT, from swamp), **Freeze/Chill** (slow, already partial), **Stun** (skip turns).
- Visual tints + icons; stacking/refresh rules.
- Hooked into spells (ice → chill, fire → burn) and enemy attacks.

---

## Tier 3 — Production quality

### ✅ 7. Visual / sprite polish
- Richer multi-tone entity rendering, drop shadows, idle/animation bob.
- Tile edge/transition detailing and ambient decor density tuning.
- Hit/spawn/level-up particle polish.

### ✅ 8. Background music
- Biome-specific procedural music loops (calm / tense / boss) via the existing Web Audio synth — no asset files, stays portable.
- Music ducking during boss fights; volume wired to the existing settings slider.

### ✅ 9. Tailwind build cleanup
- Replace the CDN `<script>` (which warns "not for production") with a precompiled static stylesheet so the game is fully offline-capable and warning-free.

---

## Tier 4 — Engineering

### ✅ 10. Test harness
- Node-based unit tests (no framework dependency) covering combat math (damage, crit, mitigation), stat derivation (equip + skill aggregation), affix rolling, and save/load round-tripping.
- `npm test` script; runs in CI-friendly plain node.

---

## Architecture notes
- **No build step required** for the game itself — ES modules load directly. The Tailwind stylesheet is the only precompiled asset.
- **Portable-first:** no hardcoded absolute paths; everything resolves relative to `index.html`.
- **Data-driven:** maps, gear, skills, quests, and bosses live in `js/data/` so content can be added without touching engine code.
- **Persistence:** localStorage, schema-versioned in `save.js`.
