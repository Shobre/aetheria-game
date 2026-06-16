#!/usr/bin/env python3
"""
Sprint 11 — Procedurally generate the NPC and enemy sprite atlases.

This script recreates each entity as a 24x32 PNG frame using the same
color palette as js/sprites.js. It is deterministic (no random) and
runs offline — no image assets required.

The output:
  - assets/sprites/npc.png      (5 rows × 6 cols, 24x32 each = 144x192)
  - assets/sprites/enemies.png  (2 rows × 6 cols, 24x32 each = 144x64)

Usage:  python3 scripts/build-sprite-atlases.py

Why this exists:
  The Sprint 11 deliverable is a real sprite sheet pipeline. The loader
  (js/systems/sprite-atlas.js) needs actual PNG files to load. We
  generate them from the same color table the canvas-primitive code
  uses, so the visual is identical whether the entity is drawn with
  drawImage() or with fillRect().

Verification:
  After running, the file sizes and dimensions are stable. The test
  suite probes these via the manifest (no pixel comparison).
"""
from PIL import Image, ImageDraw
import os, sys

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')
os.makedirs(OUT, exist_ok=True)

# color palette (matches sprites.js)
SKIN       = (241, 195, 154)
PANTS_DARK = (58, 42, 26)
BOOT       = (26, 20, 16)
SHIRT_GRN  = (90, 106, 58)
SHIRT_RED  = (122, 50, 50)
SHIRT_BLU  = (58, 78, 122)
SHIRT_BRN  = (122, 90, 58)
MAGE_PURP  = (74, 42, 106)
HAIR_BRN   = (90, 58, 34)
HAIR_BLK   = (26, 26, 26)
EYE        = (26, 20, 16)
BELT_BRK   = (202, 160, 80)
WOOD       = (90, 58, 34)
STONE      = (90, 90, 90)
IRON       = (122, 122, 122)
ICE        = (191, 224, 240)
ICE_DK     = (128, 160, 192)
AURORA     = (180, 220, 255)
WHITE      = (255, 255, 255)
GOLD       = (255, 207, 77)
PURPLE     = (164, 92, 255)
RED        = (200, 48, 48)
GLOW_ORG   = (255, 138, 58)
GLOW_YEL   = (255, 207, 77)
GREEN      = (58, 90, 58)
LEAF_GRN   = (74, 122, 74)
WATER_BLU  = (59, 139, 232)
BLACK      = (0, 0, 0)

def pixel(d, x, y, color):
    # Bounds check is "image size", not "frame size" — callers pass
    # (bx+offset) where bx is the frame's top-left in the atlas (e.g.
    # 24 for column 1 of a 6-column atlas). We rely on PIL's own
    # out-of-range detection to silently drop pixels; the explicit
    # check below is just an early-out.
    if 0 <= x < d.im.size[0] and 0 <= y < d.im.size[1]:
        d.point((x, y), fill=color)

def base_body(d, bx, by, shirt, pants=PANTS_DARK, skin=SKIN):
    # pants
    for i in range(4): pixel(d, bx+6+i, by+18, pants)
    for i in range(4): pixel(d, bx+14+i, by+18, pants)
    # boots
    for i in range(5): pixel(d, bx+5+i, by+24, BOOT)
    for i in range(5): pixel(d, bx+14+i, by+24, BOOT)
    # shirt
    for y in range(by+8, by+20):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, shirt)
    # belt
    for i in range(14): pixel(d, bx+5+i, by+18, PANTS_DARK)
    for i in range(3): pixel(d, bx+11+i, by+18, BELT_BRK)
    # head
    for y in range(by, by+10):
        for x in range(bx+7, bx+17):
            pixel(d, x, y, skin)
    # eyes (centered)
    pixel(d, bx+9, by+4, EYE); pixel(d, bx+10, by+4, EYE)
    pixel(d, bx+14, by+4, EYE); pixel(d, bx+15, by+4, EYE)
    # mouth
    for i in range(4): pixel(d, bx+10+i, by+7, (122, 58, 42))
    # shadow under feet
    for x in range(bx+4, bx+20):
        if (x + by+29) % 1 == 0:  # every px for opacity-ish
            pixel(d, x, by+30, None)  # skipped: PIL doesn't support alpha on L mode cleanly
    return d

def draw_default(d, bx, by):
    base_body(d, bx, by, SHIRT_BRN)

def draw_Elder(d, bx, by):
    # base
    base_body(d, bx, by, SHIRT_GRN)
    # white beard
    for y in range(by+8, by+18):
        for x in range(bx+7, bx+17):
            pixel(d, x, y, WHITE)
    # stoop: darker head
    for y in range(by, by+8):
        for x in range(bx+7, bx+17):
            pixel(d, x, y, SKIN)

def draw_Ranger(d, bx, by):
    base_body(d, bx, by, SHIRT_GRN)
    # hat brim
    for i in range(14): pixel(d, bx+5+i, by-1, GREEN)
    for i in range(8):  pixel(d, bx+8+i, by-3, GREEN)

def draw_Nomad(d, bx, by):
    base_body(d, bx, by, SHIRT_BRN)
    # head wrap
    for y in range(by-2, by+4):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, (180, 140, 90))
    # scarf
    for i in range(8): pixel(d, bx+8+i, by+8, RED)

def draw_Wayfarer(d, bx, by):
    base_body(d, bx, by, (74, 90, 122))
    # walking staff (right hand)
    for y in range(by+4, by+28):
        pixel(d, bx+22, y, WOOD)
    pixel(d, bx+22, by+4, WOOD)
    # pack
    for y in range(by+10, by+22):
        for x in range(bx-1, bx+3):
            pixel(d, x, y, (122, 82, 48))

def draw_Hermit(d, bx, by):
    # robe
    for y in range(by+8, by+24):
        for x in range(bx+3, bx+21):
            pixel(d, x, y, (74, 58, 42))
    # hood
    for y in range(by-2, by+8):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, (58, 42, 26))
    # face
    for y in range(by+4, by+10):
        for x in range(bx+9, bx+15):
            pixel(d, x, y, SKIN)
    # eyes
    pixel(d, bx+10, by+7, EYE); pixel(d, bx+13, by+7, EYE)
    # staff
    for y in range(by+4, by+30): pixel(d, bx-2, y, WOOD)

def draw_Forager(d, bx, by):
    base_body(d, bx, by, (90, 106, 58))
    # basket
    for y in range(by+18, by+26):
        for x in range(bx+18, bx+24):
            pixel(d, x, y, (140, 100, 50))
    # leaves sticking out
    for i in range(4): pixel(d, bx+19+i, by+16, LEAF_GRN)

def draw_Ember_Sage(d, bx, by):
    # red robe
    for y in range(by+8, by+24):
        for x in range(bx+3, bx+21):
            pixel(d, x, y, (122, 42, 26))
    for y in range(by-2, by+8):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, (74, 26, 18))
    # face
    for y in range(by+4, by+10):
        for x in range(bx+9, bx+15):
            pixel(d, x, y, SKIN)
    # glowing eyes
    pixel(d, bx+10, by+7, GLOW_ORG); pixel(d, bx+13, by+7, GLOW_ORG)
    # staff with ember
    for y in range(by+2, by+30): pixel(d, bx+22, y, WOOD)
    pixel(d, bx+22, by+2, GLOW_ORG); pixel(d, bx+22, by+3, GLOW_YEL)

def draw_Mayor(d, bx, by):
    base_body(d, bx, by, (58, 58, 90))
    # top hat
    for i in range(14): pixel(d, bx+5+i, by-1, (26, 26, 58))
    for i in range(10): pixel(d, bx+7+i, by-6, (26, 26, 58))
    # sash
    for i in range(14): pixel(d, bx+5+i, by+12, GOLD)
    # medal
    pixel(d, bx+11, by+14, GOLD); pixel(d, bx+12, by+14, GOLD)

def draw_Captain(d, bx, by):
    base_body(d, bx, by, (58, 78, 122))
    # helm
    for y in range(by-2, by+6):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, IRON)
    pixel(d, bx+11, by-5, RED); pixel(d, bx+12, by-5, RED)
    # visor slit
    for i in range(8): pixel(d, bx+8+i, by+4, (10, 10, 20))
    # epaulet
    for i in range(4): pixel(d, bx+3, by+9, GOLD)
    for i in range(4): pixel(d, bx+17, by+9, GOLD)

def draw_Scholar(d, bx, by):
    base_body(d, bx, by, (74, 58, 42))
    # glasses
    for i in range(3): pixel(d, bx+8+i, by+3, BLACK)
    for i in range(3): pixel(d, bx+13+i, by+3, BLACK)
    # book in hand
    for y in range(by+14, by+22):
        for x in range(bx+18, bx+24):
            pixel(d, x, y, (74, 122, 74))
    pixel(d, bx+20, by+14, GOLD)

def draw_Bard(d, bx, by):
    base_body(d, bx, by, (140, 90, 140))
    # feathered cap
    for i in range(14): pixel(d, bx+5+i, by-1, (58, 90, 122))
    for i in range(2):  pixel(d, bx+8+i, by-5, (200, 100, 100))
    for i in range(2):  pixel(d, bx+10+i, by-6, (200, 100, 100))
    # lute
    for y in range(by+14, by+22):
        for x in range(bx+18, bx+24):
            pixel(d, x, y, WOOD)
    pixel(d, bx+22, by+18, GOLD)

def draw_Banker(d, bx, by):
    base_body(d, bx, by, (26, 26, 26))
    # glasses
    for i in range(3): pixel(d, bx+8+i, by+3, BLACK)
    for i in range(3): pixel(d, bx+13+i, by+3, BLACK)
    # ledger
    for y in range(by+14, by+22):
        for x in range(bx+18, bx+24):
            pixel(d, x, y, (200, 200, 180))
    pixel(d, bx+19, by+15, BLACK)

def draw_Smith_Garon(d, bx, by):
    base_body(d, bx, by, (58, 42, 26))
    # leather apron
    for y in range(by+14, by+22):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, (90, 58, 34))
    # hammer
    for y in range(by+8, by+22): pixel(d, bx+22, y, WOOD)
    for i in range(6): pixel(d, bx+20+i, by+6, STONE)

def draw_Forge(d, bx, by):
    # not a person — the forge
    for i in range(16): pixel(d, bx+4+i, by+16, (58, 58, 68))
    for i in range(22): pixel(d, bx+1+i, by+12, (90, 90, 102))
    for i in range(12): pixel(d, bx+6+i, by+18, GLOW_ORG)
    for i in range(8):  pixel(d, bx+8+i, by+20, GLOW_YEL)

def draw_Mira(d, bx, by):
    # green robe
    for y in range(by+8, by+24):
        for x in range(bx+3, bx+21):
            pixel(d, x, y, (58, 90, 58))
    for y in range(by-2, by+8):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, (26, 58, 26))
    for y in range(by+8, by+13):
        for x in range(bx+9, bx+15):
            pixel(d, x, y, SKIN)
    pixel(d, bx+10, by+10, EYE); pixel(d, bx+13, by+10, EYE)
    # bottle
    for y in range(by+10, by+22): pixel(d, bx+22, y, WATER_BLU)

def draw_Archmage_Vael(d, bx, by):
    # purple robe
    for y in range(by+8, by+24):
        for x in range(bx+3, bx+21):
            pixel(d, x, y, MAGE_PURP)
    for y in range(by-2, by+8):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, (58, 26, 90))
    for y in range(by+8, by+13):
        for x in range(bx+9, bx+15):
            pixel(d, x, y, (40, 26, 50))
    # glowing eyes
    pixel(d, bx+10, by+10, PURPLE); pixel(d, bx+13, by+10, PURPLE)
    # star
    pixel(d, bx+11, by+16, GOLD); pixel(d, bx+12, by+16, GOLD)
    pixel(d, bx+10, by+17, GOLD); pixel(d, bx+13, by+17, GOLD)
    pixel(d, bx+10, by+18, GOLD); pixel(d, bx+13, by+18, GOLD)
    # staff
    for y in range(by+2, by+30): pixel(d, bx+22, y, WOOD)
    pixel(d, bx+22, by+2, PURPLE); pixel(d, bx+22, by+3, PURPLE)

def draw_Trader_Pol(d, bx, by):
    base_body(d, bx, by, (90, 90, 58))
    # cap
    for i in range(14): pixel(d, bx+5+i, by-1, (58, 42, 26))
    for i in range(6):  pixel(d, bx+9+i, by-2, GOLD)
    # backpack
    for y in range(by+10, by+20):
        for x in range(bx, bx+4):
            pixel(d, x, y, (122, 82, 48))
    for i in range(4): pixel(d, bx, by+10+i, (58, 42, 26))
    # coin
    pixel(d, bx+22, by+22, GOLD)

def draw_Aurora_Keeper(d, bx, by):
    # icy robe
    for y in range(by+8, by+24):
        for x in range(bx+3, bx+21):
            pixel(d, x, y, ICE)
    for y in range(by-2, by+8):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, ICE_DK)
    for y in range(by+8, by+10):
        for x in range(bx+9, bx+15):
            pixel(d, x, y, (191, 232, 255))
    # staff
    for y in range(by+4, by+26): pixel(d, bx-2, y, WOOD)
    # aurora orb
    pixel(d, bx-2, by+3, AURORA); pixel(d, bx-2, by+4, WHITE)

def draw_Merchant(d, bx, by):
    base_body(d, bx, by, (90, 58, 90))
    # coin purse
    for y in range(by+20, by+24):
        for x in range(bx+19, bx+25):
            pixel(d, x, y, GOLD)
    for i in range(2): pixel(d, bx+21+i, by+19, (122, 82, 48))


NPC_DRAW = {
    'default':           draw_default,
    'Elder':             draw_Elder,
    'Ranger':            draw_Ranger,
    'Nomad':             draw_Nomad,
    'Wayfarer':          draw_Wayfarer,
    'Hermit':            draw_Hermit,
    'Forager':           draw_Forager,
    'Ember Sage':        draw_Ember_Sage,
    'Mayor':             draw_Mayor,
    'Captain':           draw_Captain,
    'Scholar':           draw_Scholar,
    'Bard':              draw_Bard,
    'Banker':            draw_Banker,
    'Smith Garon':       draw_Smith_Garon,
    'Forge':             draw_Forge,
    'Mira the Alchemist':draw_Mira,
    'Archmage Vael':     draw_Archmage_Vael,
    'Trader Pol':        draw_Trader_Pol,
    'Aurora Keeper':     draw_Aurora_Keeper,
    'Merchant':          draw_Merchant,
}

def build_npc_atlas():
    # 5 rows × 6 cols. Row 0: default + 5 reserved. Rows 1-4: 6 each.
    rows, cols = 5, 6
    W, H = cols * 24, rows * 32
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # Order matches the manifest
    layout = [
        'default', 'Elder', 'Ranger', 'Nomad', 'Wayfarer', 'Hermit',
        'Forager', 'Ember Sage', 'Mayor', 'Captain', 'Scholar', 'Bard',
        'Banker', 'Smith Garon', 'Forge', 'Mira the Alchemist', 'Archmage Vael', None,
        'Trader Pol', 'Aurora Keeper', 'Merchant', None, None, None,
        None, None, None, None, None, None,
    ]
    d = ImageDraw.Draw(img)
    for i, name in enumerate(layout):
        if not name: continue
        r, c = i // cols, i % cols
        bx, by = c * 24, r * 32
        if name in NPC_DRAW:
            NPC_DRAW[name](d, bx, by)
    out_path = os.path.join(OUT, 'npc.png')
    img.save(out_path)
    return out_path, (W, H)


# ---- enemies ----

def draw_slime(d, bx, by):
    # rounded blob, smaller frame (24x24, sits at by+8)
    for y in range(8, 20):
        for x in range(2, 22):
            pixel(d, bx+x, by+y, (74, 138, 74))
    for x in range(2, 22):
        pixel(d, bx+x, by+8, (40, 80, 40))
        pixel(d, bx+x, by+19, (40, 80, 40))
    for y in range(8, 20):
        pixel(d, bx+1, by+y, (40, 80, 40))
        pixel(d, bx+21, by+y, (40, 80, 40))
    pixel(d, bx+8, by+12, WHITE); pixel(d, bx+8, by+13, BLACK)
    pixel(d, bx+15, by+12, WHITE); pixel(d, bx+15, by+13, BLACK)

def draw_bat(d, bx, by):
    # small round body
    for y in range(8, 18):
        for x in range(8, 16):
            pixel(d, bx+x, by+y, (60, 40, 70))
    # wings (V shape)
    for i in range(8): pixel(d, bx-i, by+8+(i//2), (60, 40, 70))
    for i in range(8): pixel(d, bx+24+i, by+8+(i//2), (60, 40, 70))
    # eyes
    pixel(d, bx+10, by+12, (200, 50, 50)); pixel(d, bx+13, by+12, (200, 50, 50))
    # fangs
    pixel(d, bx+11, by+16, WHITE); pixel(d, bx+12, by+16, WHITE)

def draw_archer(d, bx, by):
    # body
    for y in range(by+10, by+22):
        for x in range(bx+4, bx+20):
            pixel(d, x, y, (110, 80, 50))
    # head
    for y in range(by+2, by+10):
        for x in range(bx+7, bx+17):
            pixel(d, x, y, SKIN)
    # hood
    for y in range(by-2, by+2):
        for x in range(bx+5, bx+19):
            pixel(d, x, y, (90, 50, 30))
    # eyes
    pixel(d, bx+9, by+5, BLACK); pixel(d, bx+14, by+5, BLACK)
    # bow (right side, vertical)
    for y in range(by+4, by+26): pixel(d, bx+22, y, WOOD)
    pixel(d, bx+22, by+4, WOOD); pixel(d, bx+22, by+26, WOOD)
    # bowstring
    for y in range(by+4, by+26):
        if y % 2 == 0: pixel(d, bx+22, y, (220, 220, 220))

def draw_boar(d, bx, by):
    # body
    for y in range(by+12, by+24):
        for x in range(bx+2, bx+22):
            pixel(d, x, y, (90, 60, 40))
    # head
    for y in range(by+6, by+18):
        for x in range(bx+4, bx+20):
            pixel(d, x, y, (90, 60, 40))
    # snout
    for i in range(3): pixel(d, bx+20-i, by+14, (140, 110, 80))
    pixel(d, bx+22, by+15, (40, 20, 10)); pixel(d, bx+22, by+16, (40, 20, 10))
    # eyes
    pixel(d, bx+7, by+10, (200, 50, 50))
    # tusks
    pixel(d, bx+19, by+18, WHITE); pixel(d, bx+18, by+19, WHITE)

def draw_scorpion(d, bx, by):
    # body (oval)
    for y in range(8, 18):
        for x in range(6, 18):
            if (x-12)**2 + (y-13)**2 < 20:
                pixel(d, bx+x, by+y, (110, 60, 30))
    # legs
    for i in range(3):
        pixel(d, bx+5-i, by+10+i, (90, 50, 25))
        pixel(d, bx+18+i, by+10+i, (90, 50, 25))
    # claws
    pixel(d, bx+2, by+12, (90, 50, 25)); pixel(d, bx+1, by+13, (90, 50, 25))
    pixel(d, bx+21, by+12, (90, 50, 25)); pixel(d, bx+22, by+13, (90, 50, 25))
    # tail curling up
    for i in range(8): pixel(d, bx+11, by+18-i, (90, 50, 25))
    pixel(d, bx+12, by+10, (200, 50, 50))

def draw_golem(d, bx, by):
    for y in range(by+6, by+26):
        for x in range(bx+2, bx+22):
            pixel(d, x, y, (110, 100, 90))
    for x in range(bx+2, bx+22): pixel(d, x, by+6, (60, 55, 50))
    for i in range(5): pixel(d, bx+6+i, by+12, (60, 55, 50))
    pixel(d, bx+7, by+10, (255, 200, 50)); pixel(d, bx+15, by+10, (255, 200, 50))
    for i in range(4): pixel(d, bx-1, by+12+i, (110, 100, 90))
    for i in range(4): pixel(d, bx+24, by+12+i, (110, 100, 90))

def draw_skeleton(d, bx, by):
    for y in range(by+8, by+20):
        for x in range(bx+5, bx+19):
            if (x + y) % 4 == 0: pixel(d, x, y, (220, 215, 200))
    for y in range(by, by+10):
        for x in range(bx+7, bx+17):
            if (x + y) % 3 == 0: pixel(d, x, y, (220, 215, 200))
    pixel(d, bx+9, by+4, BLACK); pixel(d, bx+14, by+4, BLACK)
    for y in range(by+10, by+18):
        pixel(d, bx+8, y, (180, 175, 160))
        pixel(d, bx+15, y, (180, 175, 160))
    for y in range(by+22, by+30):
        pixel(d, bx+8, y, (220, 215, 200))
        pixel(d, bx+14, y, (220, 215, 200))
    # sword
    for y in range(by+8, by+24): pixel(d, bx+22, y, IRON)
    pixel(d, bx+22, by+8, (180, 180, 180))

def draw_frostling(d, bx, by):
    # round icy head
    for y in range(6, 18):
        for x in range(6, 18):
            if (x-12)**2 + (y-12)**2 < 24:
                pixel(d, bx+x, by+y, (191, 224, 240))
    # horns
    pixel(d, bx+5, by+8, (191, 232, 255)); pixel(d, bx+18, by+8, (191, 232, 255))
    pixel(d, bx+4, by+10, (191, 232, 255)); pixel(d, bx+19, by+10, (191, 232, 255))
    # body
    for y in range(16, 22):
        for x in range(8, 16):
            pixel(d, bx+x, by+y, (128, 160, 192))
    # eyes
    pixel(d, bx+10, by+12, (40, 80, 120)); pixel(d, bx+13, by+12, (40, 80, 120))
    # tiny legs
    for y in range(22, 26):
        pixel(d, bx+9, y, (40, 80, 120))
        pixel(d, bx+14, y, (40, 80, 120))

def draw_yeti(d, bx, by):
    # big white body
    for y in range(by+4, by+26):
        for x in range(bx+2, bx+22):
            pixel(d, x, y, (220, 220, 230))
    # fur (lighter)
    for i in range(6): pixel(d, bx+3+i, by+8, WHITE)
    for i in range(6): pixel(d, bx+15+i, by+12, WHITE)
    # eyes
    pixel(d, bx+6, by+10, (40, 80, 120)); pixel(d, bx+15, by+10, (40, 80, 120))
    # fangs
    pixel(d, bx+8, by+18, WHITE); pixel(d, bx+13, by+18, WHITE)
    # arms
    for i in range(4): pixel(d, bx-1, by+12+i, (200, 200, 220))
    for i in range(4): pixel(d, bx+24, by+12+i, (200, 200, 220))

def draw_mage(d, bx, by):
    # purple robe
    for y in range(by+8, by+24):
        for x in range(bx+3, bx+21):
            pixel(d, x, y, MAGE_PURP)
    # hat (pointy)
    for y in range(by-2, by+8):
        for x in range(bx+8, bx+16):
            if (x-12)**2 < (y-by+4)**2 + 4:
                pixel(d, x, y, (58, 26, 90))
    # face
    for y in range(by+8, by+13):
        for x in range(bx+9, bx+15):
            pixel(d, x, y, (40, 26, 50))
    pixel(d, bx+10, by+10, PURPLE); pixel(d, bx+13, by+10, PURPLE)
    # staff
    for y in range(by+2, by+30): pixel(d, bx+22, y, WOOD)
    pixel(d, bx+22, by+2, PURPLE); pixel(d, bx+22, by+3, PURPLE)

def draw_berserker(d, bx, by):
    # big brutish body (red-orange)
    for y in range(by+8, by+26):
        for x in range(bx+2, bx+22):
            pixel(d, x, y, (180, 70, 50))
    # shoulders
    for i in range(4): pixel(d, bx-1, by+10+i, (180, 70, 50))
    for i in range(4): pixel(d, bx+24, by+10+i, (180, 70, 50))
    # belt
    for i in range(20): pixel(d, bx+2+i, by+16, (40, 20, 10))
    # head
    for y in range(by+2, by+10):
        for x in range(bx+7, bx+17):
            pixel(d, x, y, SKIN)
    # angry eyes
    pixel(d, bx+8, by+5, (200, 50, 50)); pixel(d, bx+15, by+5, (200, 50, 50))
    # axe
    for y in range(by+4, by+24): pixel(d, bx+22, y, WOOD)
    for i in range(4): pixel(d, bx+22, by+5+i, IRON)

def draw_spitter(d, bx, by):
    # green bulbous body
    for y in range(8, 20):
        for x in range(4, 20):
            if (x-12)**2 + (y-14)**2 < 30:
                pixel(d, bx+x, by+y, (90, 140, 50))
    # mouth (wide)
    for i in range(8): pixel(d, bx+8+i, by+14, (40, 20, 10))
    pixel(d, bx+10, by+12, (40, 20, 10)); pixel(d, bx+13, by+12, (40, 20, 10))
    # eyes
    pixel(d, bx+7, by+8, (200, 200, 50)); pixel(d, bx+15, by+8, (200, 200, 50))
    # legs
    for i in range(4):
        pixel(d, bx+8, by+20+i, (40, 80, 40))
        pixel(d, bx+14, by+20+i, (40, 80, 40))

ENEMY_DRAW = {
    'slime':     draw_slime,
    'bat':       draw_bat,
    'archer':    draw_archer,
    'boar':      draw_boar,
    'scorpion':  draw_scorpion,
    'golem':     draw_golem,
    'skeleton':  draw_skeleton,
    'frostling': draw_frostling,
    'yeti':      draw_yeti,
    'mage':      draw_mage,
    'berserker': draw_berserker,
    'spitter':   draw_spitter,
}

def build_enemies_atlas():
    rows, cols = 2, 6
    W, H = cols * 24, rows * 32
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layout = ['slime', 'bat', 'archer', 'boar', 'scorpion', 'golem',
              'skeleton', 'frostling', 'yeti', 'mage', 'berserker', 'spitter']
    d = ImageDraw.Draw(img)
    for i, name in enumerate(layout):
        r, c = i // cols, i % cols
        bx, by = c * 24, r * 32
        if name in ENEMY_DRAW:
            ENEMY_DRAW[name](d, bx, by)
    out_path = os.path.join(OUT, 'enemies.png')
    img.save(out_path)
    return out_path, (W, H)


if __name__ == '__main__':
    npc_path, npc_dim = build_npc_atlas()
    enemy_path, enemy_dim = build_enemies_atlas()
    print(f'NPC atlas:    {npc_path}  ({npc_dim[0]}x{npc_dim[1]})')
    print(f'Enemy atlas:  {enemy_path}  ({enemy_dim[0]}x{enemy_dim[1]})')
    print('OK')
