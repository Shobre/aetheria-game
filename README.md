# Aetheria - A Top-Down Zelda-Like Adventure

A pixel-art, top-down action-adventure game built with **Tailwind CSS** + **HTML5 Canvas** (vanilla ES modules, zero build step).

## Run it

Because the game uses ES modules, you must serve it over HTTP (not file://):

```bash
# from this folder
python -m http.server 8777
# then open http://localhost:8777
```

Any static server works (VS Code Live Server, `npx serve`, etc.).

## Controls

| Input | Action |
|-------|--------|
| **WASD** | Move (8-directional) |
| **SPACE** | Dodge roll (i-frames, costs stamina) |
| **Mouse** | Aim |
| **Left Click** | Melee attack (arc swing toward cursor) |
| **Right Click** | Block (reduces damage from the faced direction) |
| **F** | Interact (NPCs, chests) |
| **Q** | Fireball spell (10 MP) |
| **E** | Ice Shard spell - freezes enemies (15 MP) |
| **1-9** | Use hotbar items |
| **B** | Open/close bag |
| **ESC** | Settings menu |

## Features

- **Start screen** with 3 save slots (localStorage-backed; create/load/delete)
- **HUD**: health, mana, stamina bars, level + XP bar, minimap, 9 item slots, 2 spell slots, bag & settings buttons
- **Combat**: melee, blocking, dodging with i-frames, two spells, knockback, freeze
- **Enemies**: slimes, bats, brutes - each with distinct stats & AI; auto-spawning waves
- **Progression**: XP, leveling (boosts HP/MP), gold drops
- **World**: procedural tile map with path, lake, trees, rocks, flowers, NPCs, lootable chests
- **Camera**: smooth follow + screen shake
- **Audio**: procedural Web Audio SFX (no asset files needed)
- **Settings**: music/SFX volume, FPS counter, screen shake, minimap toggle
- **Death & respawn** screen

## Structure

```
index.html              # markup, HUD, modals (Tailwind via CDN)
css/style.css           # pixel styling, animations
js/
  main.js               # entry: start screen, slots, modals, global keys
  systems/
    game.js             # main loop, combat hooks, lifecycle
    world.js            # tile map gen, collision, camera, rendering
    input.js            # keyboard + mouse state
    save.js             # localStorage save slots
    audio.js            # procedural Web Audio SFX
  entities/
    player.js           # movement, dodge, attack, block, spells, stats
    enemy.js            # enemies, projectiles, particles
  ui/
    hud.js              # DOM HUD controller, minimap, items, bag
assets/                 # (empty - all art is canvas-drawn, all SFX synthesized)
```

## Notes

- All graphics are drawn procedurally on canvas (no sprite sheets needed - easy to swap in real pixel art later by editing the `draw()` methods).
- Tailwind runs via CDN for zero-config. For production, install it as a PostCSS plugin.
- Tested: loads clean with no JS errors; start screen -> new game -> combat -> save -> death/respawn all verified.
