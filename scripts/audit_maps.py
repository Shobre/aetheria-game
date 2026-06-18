#!/usr/bin/env python3
"""
audit_maps.py — Reachability + item-in-wall audit for every Aetheria map.

For every map in js/data/maps.js:
  1. Teleport the player into the map via GAME.loadMap(mapId, tx, ty).
  2. Inspect GAME.world: cols, rows, map[y][x] tile grid, portals, npcs,
     chests, decor, enemies.
  3. BFS flood-fill from the player spawn tile. Walkable = any tile NOT in
     SOLID (WATER, WALL, LAVA). FLOOR/PATH/FLOORALT/HOLE all walkable.
  4. Report:
     a) total walkable tiles, reachable walkable tiles, unreachable count
     b) portals whose tile is SOLID, or unreachable from spawn
     c) chests whose tile is SOLID, or unreachable from spawn
     d) NPCs whose tile is SOLID, or unreachable from spawn
     e) enemies whose position resolves to a SOLID tile, or unreachable
     f) isolated walkable regions disconnected from spawn (>5 tiles = hard fail,
        1-5 tiles = cosmetic warning)

Exit 0 if every map passes. Exit 1 if any map has a hard failure.

Usage: python3 scripts/audit_maps.py
Requires: playwright, system chromium at /usr/bin/chromium-browser
"""
from __future__ import annotations
import json, os, sys, time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SCRIPT_DIR = Path(__file__).resolve().parent

LIVE_URL = os.environ.get('SMOKE_URL', 'https://aetheria-game-alpha.vercel.app')
CHROMIUM_PATH = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium-browser')

# Tile constants from js/systems/world.js — keep in sync.
TILE = 32
SOLID = {2, 7, 9}  # WATER, WALL, LAVA


def bfs_reachable(world):
    """Return (reachable_set, walkable_set, isolated_components)."""
    cols = world["cols"]; rows = world["rows"]
    grid = world["map"]
    spawn_x = world["spawn"]["tx"]; spawn_y = world["spawn"]["ty"]
    walkable = set()
    for y in range(rows):
        row = grid[y]
        for x in range(cols):
            t = row[x]
            if t is None:
                continue
            if t not in SOLID:
                walkable.add((x, y))

    # If spawn isn't on a walkable tile, search outward for one.
    if (spawn_x, spawn_y) not in walkable:
        for r in range(0, max(cols, rows)):
            found = False
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if (spawn_x + dx, spawn_y + dy) in walkable:
                        spawn_x += dx; spawn_y += dy
                        found = True
                        break
                if found:
                    break
            if found:
                break

    reachable = set()
    stack = [(spawn_x, spawn_y)]
    while stack:
        x, y = stack.pop()
        if (x, y) in reachable or (x, y) not in walkable:
            continue
        reachable.add((x, y))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < cols and 0 <= ny < rows and (nx, ny) not in reachable:
                stack.append((nx, ny))

    # Find all isolated components of walkable tiles not reachable from spawn.
    isolated_components = []
    seen = set(reachable)
    for tile in walkable:
        if tile in seen:
            continue
        comp = set(); stack = [tile]
        while stack:
            t = stack.pop()
            if t in seen or t in comp:
                continue
            seen.add(t); comp.add(t)
            x, y = t
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nt = (x + dx, y + dy)
                if nt in walkable and nt not in seen:
                    stack.append(nt)
        isolated_components.append(comp)

    return reachable, walkable, isolated_components


def audit_one_map(page, map_id):
    """Teleport into map_id, snapshot world state, run audits."""
    entry = page.evaluate("""(mid) => {
        const M = window.GAME && window.GAME.maps;
        if(!M || !M[mid]) return null;
        for(const [id, def] of Object.entries(M)){
            for(const p of (def.portals||[])){
                if(p.to === mid) return { from:id, tx:p.tx, ty:p.ty };
            }
        }
        if(M[mid].portals && M[mid].portals[0]){
            return { from:mid, tx:M[mid].portals[0].x, ty:M[mid].portals[0].y };
        }
        return { from:null, tx:1, ty:1 };
    }""", map_id)
    if entry is None:
        return {"map": map_id, "ok": False, "error": "map not in MAPS"}

    page.evaluate("""async (args) => {
        const game = window.GAME;
        if(!game) return;
        await game.loadMap(args.mid, args.tx, args.ty);
    }""", {"mid": map_id, "tx": entry["tx"], "ty": entry["ty"]})
    page.wait_for_timeout(300)  # let any post-load hooks settle

    world = page.evaluate("""() => {
        const w = window.GAME.world;
        return {
            cols: w.cols, rows: w.rows,
            map: w.map.map(row => row.slice()),
            spawn: { tx: Math.floor(window.GAME.player.x/32), ty: Math.floor(window.GAME.player.y/32) },
            portals: (w.portals||[]).map(p => ({ x: p.x, y: p.y, to: p.to })),
            npcs: (w.npcs||[]).map(n => ({ x: n.x, y: n.y, name: n.name })),
            chests: (w.chests||[]).map(c => ({ x: c.x, y: c.y, opened: c.opened })),
            enemies: (window.GAME.enemies||[]).map(e => ({
                x: Math.floor(e.x/32), y: Math.floor(e.y/32), type: e.type, hp: e.hp, hpMax: e.hpMax,
            })),
            decor: (w.decor||[]).map(d => ({ x: d.x, y: d.y, solid: d.solid })),
        };
    }""")

    reachable, walkable, isolated = bfs_reachable(world)
    issues = []

    for p in world["portals"]:
        if (p["x"], p["y"]) not in walkable:
            issues.append(("portal_solid", (p["x"], p["y"]), p["to"]))
        elif (p["x"], p["y"]) not in reachable:
            issues.append(("portal_unreachable", (p["x"], p["y"]), p["to"]))

    for c in world["chests"]:
        if (c["x"], c["y"]) not in walkable:
            issues.append(("chest_solid", (c["x"], c["y"]), ""))
        elif (c["x"], c["y"]) not in reachable:
            issues.append(("chest_unreachable", (c["x"], c["y"]), ""))

    for n in world["npcs"]:
        if (n["x"], n["y"]) not in walkable:
            issues.append(("npc_solid", (n["x"], n["y"]), n["name"]))
        elif (n["x"], n["y"]) not in reachable:
            issues.append(("npc_unreachable", (n["x"], n["y"]), n["name"]))

    for e in world["enemies"]:
        if (e["x"], e["y"]) not in walkable:
            issues.append(("enemy_solid", (e["x"], e["y"]), e["type"]))
        elif (e["x"], e["y"]) not in reachable:
            issues.append(("enemy_unreachable", (e["x"], e["y"]), e["type"]))

    big_isolated = [c for c in isolated if len(c) > 5]
    tiny_isolated = [c for c in isolated if 1 <= len(c) <= 5]
    for c in big_isolated:
        issues.append(("isolated_region", next(iter(c)), f"{len(c)} tiles"))

    stats = {
        "total_tiles": world["cols"] * world["rows"],
        "walkable": len(walkable),
        "reachable": len(reachable),
        "isolated_big": len(big_isolated),
        "isolated_tiny": len(tiny_isolated),
    }
    pct = (stats["reachable"] / stats["walkable"] * 100) if stats["walkable"] else 0

    return {
        "map": map_id,
        "ok": len(issues) == 0,
        "stats": stats,
        "reachable_pct": round(pct, 1),
        "issues": [{"code": c, "coord": list(x), "info": i} for (c, x, i) in issues],
        "warnings": [{"code": "tiny_island", "count": len(tiny_isolated)}] if tiny_isolated else [],
    }


def main():
    console_errors = []
    failed_requests = []

    with sync_playwright() as pw:
        launch_kwargs = {
            'headless': True,
            'args': ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        }
        if Path(CHROMIUM_PATH).exists():
            launch_kwargs['executable_path'] = CHROMIUM_PATH
        else:
            print(f'WARNING: chromium not found at {CHROMIUM_PATH}; using Playwright default.')

        browser = pw.chromium.launch(**launch_kwargs)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        page.on('requestfailed', lambda req: failed_requests.append(f"{req.url} - {req.failure}"))

        page.goto(LIVE_URL)
        page.wait_for_function("window.GAME && window.GAME.maps", timeout=20000)
        # Sign up as a fresh disposable user, pick slot 1, wait for the
        # canvas to mount — same flow as smoke.py so the audit runs against
        # a fully initialised game (player + enemies + audio).
        ts = int(time.time())
        smoke_user = f"audit_{ts}"
        page.click('#tab-signup')
        page.fill('#signup-user', smoke_user)
        page.fill('#signup-pass', 'audittest1234')
        page.fill('#signup-pass2', 'audittest1234')
        page.click('#signup-btn')
        page.wait_for_selector('#start-screen:not(.hidden)', timeout=20000)
        page.wait_for_selector('#save-slots button.save-slot', timeout=10000)
        page.query_selector_all('#save-slots button.save-slot')[0].click()
        page.wait_for_selector('#game-container:not(.hidden)', timeout=15000)
        page.wait_for_selector('canvas#game-canvas', timeout=5000)
        page.wait_for_timeout(2000)  # audio + initial render settle

        map_ids = page.evaluate("""() => {
            const out = [];
            for(const [k, v] of Object.entries(window.GAME.maps)){
                // Each map def has cols/rows. Skip nested entries like enemies{} or pal{}.
                if(v && typeof v.cols === 'number' && typeof v.rows === 'number') out.push(k);
            }
            return out;
        }""")
        print(f"Auditing {len(map_ids)} maps\n")

        results = []
        for mid in map_ids:
            try:
                r = audit_one_map(page, mid)
                results.append(r)
                tag = "OK  " if r["ok"] else "FAIL"
                warn = f"  (+{len(r['warnings'])} tiny-island warns)" if r["warnings"] else ""
                s = r.get("stats", {})
                print(f"  [{tag}] {mid:20} reachable={s.get('reachable', 0):5}/{s.get('walkable', 0):<5} ({r.get('reachable_pct', 0)}%){warn}")
                for issue in r["issues"]:
                    print(f"           HARD  {issue['code']:25} at {issue['coord']}  {issue['info']}")
            except Exception as e:
                print(f"  [ERR ] {mid}: {e}")
                results.append({"map": mid, "ok": False, "error": str(e)})

        # Save JSON report
        report = {
            "url": LIVE_URL,
            "ts": int(time.time()),
            "results": results,
            "console_errors": console_errors,
            "failed_requests": failed_requests,
        }
        (SCRIPT_DIR / "audit-report.json").write_text(json.dumps(report, indent=2))

        browser.close()

    fails = [r for r in results if not r["ok"]]
    print()
    print(f"=== {len(results)} maps audited | {len(fails)} hard-failed | {len(console_errors)} console errors | {len(failed_requests)} failed requests ===")
    for r in fails:
        print(f"  - {r['map']}: {len(r.get('issues', []))} issue(s)")
        for issue in r.get("issues", []):
            print(f"      {issue['code']} at {issue['coord']} {issue['info']}")
    if console_errors:
        print("\nConsole errors:")
        for e in console_errors[:10]:
            print(f"  - {e}")
    return 0 if not fails and not console_errors else 1


if __name__ == "__main__":
    sys.exit(main())
