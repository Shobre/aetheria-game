# Aetheria — New Features & Improvements Plan

## Priority 1 — Critical Fixes & Refactors (Do First)

### 1.1 Projectile.update Refactor
- File: js/systems/game.js (projectile update is inline in game.update)
- Extract: _hitEnemy, _hitBoss, _checkPlayerHit, _applyAoe
- Cognitive complexity currently at 66 (CRITICAL)

### 1.2 Quest Variety — New Objective Kinds
Current: kill, reach, boss, collect
Add:
- escort: NPC follows player, must arrive alive
- timed_clear: clear all enemies in map within time limit
- survive: survive waves for N seconds

### 1.3 Player.recompute Refactor
- Split into: _deriveBaseStats, _deriveFromEquipment, _deriveFromSkills
- Current cognitive: 28

## Priority 2 — New Gameplay Features

### 2.1 Pets / Summons System
- New spell school: Summon
- Sprites: wolf, owl, skeleton warrior, elemental
- Mechanics: summon follows player, auto-attacks, has HP, can be resummoned on death
- Skill tree branch: summoning (3-4 nodes)
- Save/load: array of active summons (max 2)

### 2.2 Weapon Skill Scaling
- Separate skill nodes for melee vs ranged
- Swordsmanship: +melee damage, +attack speed with swords
- Archery: +ranged damage, +projectile speed with bows
- Polearm Mastery: +reach, +damage with spears/halberds

### 2.3 Parry System
- Perfect block window: 0.2s after raising shield
- Parry reflects projectiles back at enemies
- Parry stuns melee attackers for 1s
- Visual: shield flash + sparkle effect
- Skill node: Riposte — parried enemies take bonus damage from next hit

### 2.4 Heat System for Ranged Weapons
- Continuous fire builds heat (0-100)
- Overheat at 100 = forced 3s cooldown, can't shoot
- Heat decays when not firing (15/sec)
- Heat bar UI above hotbar when ranged weapon equipped
- Skill nodes can increase heat cap / reduce heat buildup

## Priority 3 — Content & World

### 3.1 New Biome: Volcanic Caldera
- Maps: caldera_entrance, caldera_depths, magma_core
- Enemies: fire_elemental, lava_golem, ash_wraith, magma_serpent
- Hazards: lava tiles (DoT), geysers (periodic knockback)
- Boss: Ignarax the Molten — fire boss with lava pool mechanics
- Drops: flame_sword, magma_armor, ring_of_fire

### 3.2 New Biome: Crystal Caverns
- Maps: crystal_entrance, crystal_grotto, prism_chamber
- Enemies: crystal_bat, prism_golem, shard_sprite, crystal_mimic
- Hazards: crystal spikes, light beam puzzles
- Boss: The Faceted One — reflects projectiles, splits into shards
- Drops: crystal_staff, prism_shard, ring_of_reflection

### 3.3 Reputation / Shop Tier System
- Each biome has reputation (0-100)
- Killing enemies, completing quests, clearing bosses raises rep
- Shop tiers at 25/50/75/100 rep unlock better stock
- Visual: shop UI shows current tier + progress to next
- New items at higher tiers: epic/legendary gear, unique spells

### 3.4 Day/Night Cycle
- Time passes as player explores (1 game minute = ~30 real seconds)
- Day: normal spawns, full visibility
- Night: stronger enemies, reduced visibility, unique night-only drops
- Visual: overlay tint (blue at night, orange at dawn/dusk)
- Certain NPCs only appear at certain times
- Time displayed on HUD (small clock icon)

## Priority 4 — UX & Polish

### 4.1 Rebindable Keys
- Settings panel: click a key binding to rebind
- Store in localStorage
- Defaults: WASD, Space, Mouse L/R, F, Q, E, R, 1-9, M, J, K, C, B, T, Esc

### 4.2 Gamepad Support
- Left stick: move, Right stick: aim
- A: dodge, B: block, X: attack, Y: interact
- LB/RB: spell slots 1/2, LT: spell slot 3
- D-pad: hotbar selection
- Start: settings, Select: map
- Vibration on hit/death

### 4.3 Damage Number Batching
- Batch nearby same-type damage: show "x3 45" for 3 quick 45-dmg hits
- Reduces visual clutter in intense fights

### 4.4 Combat Log Panel
- Toggle with L key
- Shows last 20 combat events: damage, kills, pickups
- Scrollable, semi-transparent overlay

### 4.5 Audio Improvements
- Per-biome musical motifs
- Low-health heartbeat sound effect
- Boss music intensifies with phase transitions
- Footstep sounds vary by tile type

## Priority 5 — Technical Debt

### 5.1 Remove Legacy SHOP_STOCK
### 5.2 Unify Shop Stock Source (per-NPC only)
### 5.3 Equipment as Objects Everywhere (normalize drops)
### 5.4 Pathfinding Polish (smoothing, flow-field caching)
### 5.5 Balance Pass (XP/gold curves, per-map level recommendations)

## Implementation Order

Sprint 1: 1.1, 1.2, 1.3, 2.4, 2.3 (refactors + core combat)
Sprint 2: 2.1, 2.2, 3.3, 3.4 (systems + world)
Sprint 3: 3.1, 3.2, 4.1, 4.2, 4.5 (content + UX)
Sprint 4: 4.3, 4.4, 5.1-5.5 (polish + debt)
