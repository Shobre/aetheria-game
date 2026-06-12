# Aetheria - An Action-RPG Adventure

A pixel-art, top-down action-RPG built with **Tailwind CSS** + **HTML5 Canvas** (vanilla ES modules, zero build step). Explore biomes, delve dungeons, gear up, and master a skill tree.

## Run it

ES modules require an HTTP server (not file://). Easiest: **double-click `PLAY.bat`** (auto-starts a server + opens your browser). Or manually:

```bash
python -m http.server 8777
# open http://localhost:8777
```

## Controls

| Input | Action |
|-------|--------|
| **WASD** | Move (8-directional) |
| **SPACE** | Dodge roll (i-frames, costs stamina) |
| **Mouse** | Aim |
| **Left Click** | Melee attack |
| **Right Click** | Block (directional) |
| **F** | Interact / enter portal / open shop |
| **Q** | Fireball (10 MP) |
| **E** | Ice Shard - freezes (15 MP) |
| **R** | Meteor - unlocked via skill tree (40 MP) |
| **1-9** | Use hotbar items |
| **C** | Character / equipment screen |
| **K** | Skill tree |
| **B** | Bag / inventory |
| **ESC** | Settings / close menus |

## Features

### World & Maps
- **Multiple connected maps** linked by portals — step on a glowing pad or door to travel
- **Distinct biomes**: Greenwood Meadow (hub), Whispering Forest, Sunscar Desert, Crystal Cave
- **Dungeons** with carved room-and-corridor layouts (Forgotten Crypt)
- **House interiors** (Merchant's Hut) with no enemies
- **Enemies spawn once on map load** — no endless waves. Clear a map and it stays clear.
- Each biome has its own enemy roster, palette, and decor

### Combat & Enemies
- **8 enemy types** with distinct AI:
  - *Chase* (slime, bat, golem) — pursue and deal touch damage
  - *Ranged* (archer) — keep distance and fire projectiles
  - *Telegraphed lunge* (brute, boar, scorpion, skeleton) — wind up (red flash), then dash
- Melee arc attacks, crits, blocking, dodge i-frames, knockback, freeze
- Difficulty scales per map (deeper = tougher)

### Progression
- **XP & leveling** — each level grants +HP, +MP, and **1 skill point**
- **Skill tree** with 3 branches (Combat / Arcane / Survival), 15 nodes:
  - Passive stat boosts (HP, ATK, DEF, crit, MP, regen, speed, stamina, gold-find)
  - **Unlockable abilities**: Berserker (low-HP damage), Meteor (R-key AoE), Lifesteal
- **Equipment** — 5 slots (weapon, shield, armor, helm, ring), each with stat bonuses; character screen to equip/unequip
- Stats are fully derived: base + gear + skills

### Economy
- **Enemies always drop coins** (amount varies by type, boosted by Greed skill)
- Occasional item drops
- **Merchant shop** — buy consumables & gear, sell your loot
- Lootable chests (gold or gear) that persist per-map

### Polish
- Procedural Web Audio SFX (no asset files)
- Minimap with portals/NPCs/chests/enemies
- Floating damage numbers, screen shake, particles, map-transition fades
- Pause-on-tab-blur
- 3 save slots (localStorage, schema v2)

## Structure

```
index.html              # markup, HUD, all modals
css/style.css           # pixel styling, character/skill/shop UI
js/
  main.js               # entry: slots, modals, global keys
  systems/
    game.js             # loop, map loading/transitions, combat, shop, skills
    world.js            # biome/dungeon/house generator, portals, camera
    input.js  audio.js  save.js
  entities/
    player.js           # derived stats, abilities
    enemy.js            # enemy AI, projectiles, particles
  ui/
    hud.js              # HUD, character view, skill tree, shop, minimap
  data/
    maps.js             # map registry (biomes, portals, enemy tables, shop stock)
    gear.js             # item & equipment catalog
    skilltree.js        # skill node definitions
```

## Maps & how they connect

```
            Crystal Cave
                 |
Sunscar Desert — Greenwood Meadow — Whispering Forest — Forgotten Crypt
                 |
          Merchant's Hut (shop)
```

All art is canvas-drawn and all SFX synthesized — swap in real sprite sheets later by editing the `draw()` methods.
