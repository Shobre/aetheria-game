# Aetheria — An Action-RPG Adventure

A top-down Zelda-like action RPG built with Canvas 2D and Tailwind CSS. Features pixel art graphics, multiple biomes, bosses, crafting, spell system, and per-user cloud saves via Turso.

## Live Demo

**[aetheria-game-alpha.vercel.app](https://aetheria-game-alpha.vercel.app)**

## Features

- **6 Biomes** — Meadow, Forest, Desert, Cave, Snow, Swamp — each with unique enemies and a biome boss
- **8 Bosses** — Multi-phase AI, telegraphed attacks, themed drops
- **Weapon Variety** — Swords, daggers, spears, greatswords, warhammers, bows, crossbows, staves — each with unique slash animations
- **Spell System** — 8+ spells with 3-tier upgrades, learnable at shops for gold
- **Crafting** — Reforge (reroll affixes) and Upgrade (raise rarity) at the Blacksmith
- **Banking** — 40-slot shared Stash at the Banker NPC in Aldermere City
- **Per-User Saves** — Login screen with username/password, isolated save slots per user
- **Cloud Saves** — Turso database integration for cloud backup (configurable via meta tags)
- **Full Map** — Press M or click the map button for a full-screen map with player, portals, NPCs, and chests
- **Pathfinding** — Enemies use A* with line-of-sight for intelligent chasing
- **Elite Enemies** — 4 elite modifiers (Vicious, Armored, Swift, Arcane) with guaranteed drops

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Dodge roll |
| Mouse | Aim |
| Left Click | Attack |
| Right Click | Block |
| F | Interact / Portal |
| Q / E / R | Cast spells |
| 1-9 | Use hotbar items |
| B | Bag |
| C | Character |
| K | Skill Tree |
| J | Quest Log |
| M | Full Map |
| T | Teleport to Town |
| Esc | Settings / Close menus |

## Architecture

- **`js/entities/`** — Player, Enemy, Boss classes
- **`js/systems/`** — Game, World, Save, Audio, Input, Craft, Turso
- **`js/data/`** — Gear catalog, Maps, Spells, Affixes, Quests, Skill tree
- **`js/ui/`** — HUD rendering
- **`css/`** — Tailwind utilities + custom game styles

## Running Locally

```bash
npm install
python -m http.server 3005
# Open http://localhost:3005
```

## Testing

```bash
npm test
# 359 unit tests covering gear, affixes, combat, quests, spells, pathfinding, etc.
```

## Tech Stack

- Canvas 2D rendering
- Tailwind CSS (precompiled, no CDN)
- ES Modules
- Vercel deployment
- Turso (libsql) for cloud saves

## Credits

Built by Shobre. Powered by Hermes Agent.
