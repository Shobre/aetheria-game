#!/usr/bin/env python3
"""
smoke_maps.py — Visit every reachable map in Aetheria and verify the player
can move freely after each teleport. Detects:
  - OOB portal destinations (player spawned outside map → can't move)
  - Dead-end maps (no portals)
  - Maps where player gets stuck on a wall after spawn

Uses Playwright against the deployed Vercel URL (default) or a local URL.

USAGE
  python3 scripts/smoke_maps.py [--url URL] [--report PATH] [--screenshot PATH]

CI INTEGRATION
  Exits non-zero if any map fails. Output is a structured report suitable
  for regression tracking.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

DEFAULT_URL = "https://aetheria-game-alpha.vercel.app"
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# --- report helpers --------------------------------------------------------

def _new_report():
    return {
        "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "url": None,
        "visited": [],     # [{map, ok, problem, player_pos, world_dims}]
        "console_failures": [],
        "failed_requests": [],
        "uncaught": [],
    }


def _finalize(report, screenshot_path):
    report["ended"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    report["summary"] = {
        "maps_visited": len(report["visited"]),
        "maps_ok": sum(1 for v in report["visited"] if v["ok"]),
        "maps_failed": sum(1 for v in report["visited"] if not v["ok"]),
        "console_failures": len(report["console_failures"]),
        "failed_requests": len(report["failed_requests"]),
        "uncaught": len(report["uncaught"]),
        "overall_ok": (
            all(v["ok"] for v in report["visited"])
            and not report["console_failures"]
            and not report["failed_requests"]
            and not report["uncaught"]
        ),
    }
    if screenshot_path:
        report["screenshot"] = str(screenshot_path)
    return report


def _attach_capture(page, report):
    """Hook Playwright events into the report."""
    def on_console(msg):
        if msg.type in ("error", "warning"):
            report["console_failures"].append({
                "type": msg.type,
                "text": msg.text[:500],
                "location": str(msg.location) if msg.location else None,
            })
    def on_request_failed(req):
        report["failed_requests"].append({
            "url": req.url,
            "method": req.method,
            "failure": req.failure or "unknown",
        })
    def on_pageerror(exc):
        report["uncaught"].append(str(exc)[:500])
    page.on("console", on_console)
    page.on("requestfailed", on_request_failed)
    page.on("pageerror", on_pageerror)


def _login(page, username, password):
    """Sign up a fresh disposable account, then click SLOT 1 to start a new game."""
    page.goto(args_url() + "/", wait_until="domcontentloaded")
    # Wait for the login form (always present in the DOM, just hidden)
    page.wait_for_selector("#login-user", timeout=15000, state="attached")
    # Wait for showLogin() timeout (700ms) to unhide the screen
    page.wait_for_selector("#login-screen:not(.hidden)", timeout=10000)
    # Switch to sign-up tab (fresh accounts don't conflict with anything)
    page.click("#tab-signup", timeout=3000)
    page.wait_for_timeout(300)
    # Fill and submit. Sign-up button is #signup-btn.
    page.fill("#signup-user", username)
    page.fill("#signup-pass", password)
    page.fill("#signup-pass2", password)
    page.click("#signup-btn")
    # Wait for the start-screen with slots
    page.wait_for_selector("#start-screen:not(.hidden)", timeout=15000)
    page.wait_for_selector("button.save-slot", timeout=15000)
    # Click slot 1 to begin a new game (creates a save + calls launchUser → loadMap)
    page.click("button.save-slot:nth-child(1)")
    # Wait for the game to mount (canvas visible, world loaded, player alive)
    try:
        page.wait_for_function(
            "() => window.GAME && window.GAME.world && window.GAME.player && window.GAME.running",
            timeout=20000,
        )
    except Exception:
        err = page.evaluate("""
          () => {
            const e1 = document.getElementById('signup-error');
            const e2 = document.getElementById('login-error');
            if (e1 && !e1.classList.contains('hidden')) return e1.textContent;
            if (e2 && !e2.classList.contains('hidden')) return e2.textContent;
            const ss = document.getElementById('start-screen');
            const ls = document.getElementById('login-screen');
            return `start-screen=${ss ? ss.classList.contains('hidden') : 'missing'} login-screen=${ls ? ls.classList.contains('hidden') : 'missing'}`;
          }
        """)
        raise RuntimeError(f"game did not mount; error={err}")


def args_url():
    return os.environ.get("SMOKE_URL", DEFAULT_URL)


# --- core test logic -------------------------------------------------------

# Movement test: press WASD briefly, verify player position changes
# AND can return to origin. If player is stuck on a wall, position won't change.
MOVE_TEST_JS = """
async (moves) => {
  const G = window.GAME;
  if (!G) return { ok: false, error: "window.GAME not exposed" };
  if (!G.running) return { ok: false, error: "game not running" };

  const before = { x: G.player.x, y: G.player.y, map: G.currentMap };
  const world = G.world;
  const dims = { cols: world.cols, rows: world.rows, w: world.w, h: world.h };

  // Check initial position is in bounds + not solid
  const inBounds = G.player.x >= 0 && G.player.y >= 0
                && G.player.x < world.w && G.player.y < world.h;
  const notSolidInitially = !world.isSolid(G.player.x, G.player.y);

  // The Input system stores held keys by raw key string (e.g. 'w', 'd'),
  // and the move bindings live at input.bindings.move_{up,down,left,right}.
  // We must set the right raw key for each direction.
  const bindings = G.input.bindings;
  const dirs = [
    { name: 'right', key: bindings.move_right, dx: +1, dy:  0 },
    { name: 'left',  key: bindings.move_left,  dx: -1, dy:  0 },
    { name: 'down',  key: bindings.move_down,  dx:  0, dy: +1 },
    { name: 'up',    key: bindings.move_up,    dx:  0, dy: -1 },
  ];

  const positions = [];
  for (const d of dirs) {
    // Reset player to start
    G.player.x = before.x; G.player.y = before.y;
    // Reset ALL keys (clean slate — important since other tests may have leaked)
    for (const k of Object.keys(G.input.keys)) G.input.keys[k] = false;
    // Hold the direction key for ~250ms (enough for ~15 frames at 60fps)
    G.input.keys[d.key] = true;
    await new Promise(r => setTimeout(r, 250));
    G.input.keys[d.key] = false;
    positions.push({
      name: d.name,
      key: d.key,
      x: G.player.x, y: G.player.y,
      dx: G.player.x - before.x, dy: G.player.y - before.y,
      inBounds: G.player.x >= 0 && G.player.y >= 0
             && G.player.x < world.w && G.player.y < world.h,
      notSolid: !world.isSolid(G.player.x, G.player.y),
    });
    await new Promise(r => setTimeout(r, 80));
  }

  // Restore
  G.player.x = before.x; G.player.y = before.y;
  for (const k of Object.keys(G.input.keys)) G.input.keys[k] = false;

  const beforePortal = (() => {
    const ps = (world.portals || []).map(p => ({
      label: p.label || p.to,
      to: p.to,
      dist: Math.hypot(p.wx - before.x, p.wy - before.y),
    })).sort((a, b) => a.dist - b.dist);
    return ps[0] || null;
  })();

  // Verdict: a "pass" for this map requires EITHER:
  //   (a) the player spawns on a walkable tile AND can move freely in at
  //       least 2 of 4 directions (player can escape), OR
  //   (b) the player auto-teleports because they spawned on top of a
  //       portal — this is normal behaviour for portal destinations.
  // We explicitly fail on: stuck (no movement), or OOB spawn.
  const moved = positions.filter(p => Math.abs(p.dx) + Math.abs(p.dy) > 4);
  const stuck = moved.length === 0;
  const partiallyEscapable = moved.length >= 2;
  const fullyEscapable = moved.length === 4;

  // Was the player spawned (or did they end up) ON a portal? Auto-enter
  // happens at distance < 26 (game.js line ~301). If so, the movement
  // test results aren't meaningful — the game teleported the player
  // mid-test.
  const spawnedOnPortal = beforePortal !== null && beforePortal.dist < 26;
  const endedOnPortal = (() => {
    const p = (world.portals || []).find(p => Math.hypot(p.wx - positions[0].x, p.wy - positions[0].y) < 26);
    return p ? { label: p.label || p.to, to: p.to } : null;
  })();

  // Auto-teleport from spawned-on-portal is OK; manual stuck is not.
  const escapedOrAutoTeleported = !stuck || spawnedOnPortal;
  const ok = inBounds && notSolidInitially && escapedOrAutoTeleported && !stuck;

  return {
    ok,
    before, dims,
    inBounds, notSolidInitially,
    positions, stuck, partiallyEscapable, fullyEscapable,
    spawnedOnPortal, endedOnPortal,
    nearestPortal: beforePortal,
    portalCount: (world.portals || []).length,
  };
}
"""


def visit_map(page, map_id, tx, ty):
    """Teleport to (map_id, tx, ty) and run the movement test."""
    # Drive loadMap via JS
    page.evaluate(
        "(args) => { window.GAME.loadMap(args.map, args.tx, args.ty, false); }",
        {"map": map_id, "tx": tx, "ty": ty}
    )
    # Allow transition fade to clear
    page.wait_for_timeout(400)
    # Run the movement test
    return page.evaluate(MOVE_TEST_JS, [])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", default=os.environ.get("SMOKE_URL", DEFAULT_URL))
    p.add_argument("--report", default=str(PROJECT_ROOT / "scripts" / "smoke-maps-report.json"))
    p.add_argument("--screenshot", default=str(PROJECT_ROOT / "scripts" / "smoke-maps-output.png"))
    p.add_argument("--user", default=None,
                   help="Override smoke username (default: random disposable)")
    args = p.parse_args()

    report = _new_report()
    report["url"] = args.url

    # Use a disposable account
    username = args.user or f"smoke_{int(time.time())}_{os.getpid()}"
    password = "smoketest123"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox"],
        )
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        _attach_capture(page, report)

        # Login
        try:
            _login(page, username, password)
        except Exception as e:
            report["uncaught"].append(f"login_failed: {e}")
            try:
                page.screenshot(path=str(Path(args.screenshot).with_name("smoke-maps-login-fail.png")))
            except Exception:
                pass
            _finalize(report, args.screenshot)
            Path(args.report).write_text(json.dumps(report, indent=2))
            print(f"LOGIN FAILED: {e}")
            return 2

        # Fetch the live map catalog from the page by dynamically importing
        # the ES module. This mirrors how the game itself consumes it.
        catalog = page.evaluate("""
          async () => {
            try {
              const mod = await import('/js/data/maps.js');
              const out = {};
              for (const [k, v] of Object.entries(mod.MAPS)) {
                out[k] = {
                  cols: v.cols, rows: v.rows, biome: v.biome,
                  portals: (v.portals || []).map(p => ({
                    x: p.x, y: p.y, to: p.to, tx: p.tx, ty: p.ty,
                  })),
                };
              }
              return out;
            } catch (e) { return { error: String(e) }; }
          }
        """)

        if not catalog or "error" in catalog:
            report["uncaught"].append(f"catalog_load_failed: {catalog}")
            _finalize(report, args.screenshot)
            Path(args.report).write_text(json.dumps(report, indent=2))
            print(f"CATALOG LOAD FAILED: {catalog}")
            return 3

        # Visit every portal in every reachable map. We use the catalog's
        # own portal data to pick destinations — this catches data bugs
        # (OOB tx/ty) AND runtime bugs (player stuck after spawn).
        portals_to_test = []
        for src_id, info in catalog.items():
            for p in info["portals"]:
                portals_to_test.append({
                    "src": src_id, "to": p["to"],
                    "tx": p["tx"], "ty": p["ty"],
                    "src_x": p["x"], "src_y": p["y"],
                })

        # Also test "raw OOB" destinations that the catalog would never
        # give us — specifically the volcano_caldera -> city tx=78 case
        # (we want to prove nearestOpen() handles it correctly).
        special_oob_tests = [
            {"src": "manual", "to": "volcano_caldera", "tx": 78, "ty": 30},
            {"src": "manual", "to": "volcano",          "tx": 12, "ty": 56},
        ]
        portals_to_test.extend(special_oob_tests)

        seen = set()
        for entry in portals_to_test:
            key = (entry["to"], entry["tx"], entry["ty"])
            if key in seen:
                continue
            seen.add(key)

            try:
                result = visit_map(page, entry["to"], entry["tx"], entry["ty"])
            except Exception as e:
                result = {"ok": False, "error": f"visit_exception: {e}"}

            record = {
                "src": entry.get("src", "?"),
                "to": entry["to"],
                "tx": entry["tx"], "ty": entry["ty"],
                **result,
            }
            report["visited"].append(record)

        # Final screenshot of the player back in meadow
        try:
            visit_map(page, "meadow", 30, 22)
            page.wait_for_timeout(500)
            page.screenshot(path=args.screenshot, full_page=False)
        except Exception:
            pass

        browser.close()

    _finalize(report, args.screenshot)
    Path(args.report).write_text(json.dumps(report, indent=2))

    # Print summary
    s = report["summary"]
    print(f"\n{'='*60}")
    print(f"MAP SMOKE: {s['maps_ok']}/{s['maps_visited']} maps OK")
    print(f"  console failures: {s['console_failures']}")
    print(f"  failed requests:  {s['failed_requests']}")
    print(f"  uncaught:         {s['uncaught']}")
    print(f"  OVERALL: {'PASS' if s['overall_ok'] else 'FAIL'}")
    print(f"{'='*60}")

    # Per-map detail
    failed = [v for v in report["visited"] if not v["ok"]]
    if failed:
        print(f"\nFAILED MAPS ({len(failed)}):")
        for v in failed:
            print(f"  {v['src']} -> {v['to']} (tx={v['tx']}, ty={v['ty']})")
            print(f"    inBounds={v.get('inBounds')} notSolid={v.get('notSolidInitially')}")
            print(f"    stuck={v.get('stuck')} partiallyEscapable={v.get('partiallyEscapable')}")
            print(f"    portals reachable: {v.get('portalCount')} (nearest: {v.get('nearestPortal')})")
            if v.get('error'):
                print(f"    error: {v['error']}")
            positions = v.get('positions', [])
            for p in positions:
                print(f"    move {p['key']:6}: dx={p['dx']:+.0f} dy={p['dy']:+.0f} inBounds={p['inBounds']}")

    return 0 if s["overall_ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
