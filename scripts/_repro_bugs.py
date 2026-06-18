#!/usr/bin/env python3
"""Reproduce all 5 reported bugs against the live build (default: localhost).

Bug 1: Settings scrollbar styling (visual capture)
Bug 2: Walking animation facing mismatch (capture sprite in 4 directions)
Bug 3: Cursor — round crosshair + hand on UI hover (CSS inspection)
Bug 4: Enemy health bar on damage (gameplay capture)
Bug 5: Forgotten Crypt portal in wall (map walk test)
"""
import asyncio, json, os, sys, traceback
from pathlib import Path
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3015"
OUT = Path(__file__).parent
console_msgs, page_errors, failed_requests = [], [], []

async def safe(name, fn, report):
    """Run a section; on failure record but don't crash the whole script."""
    try:
        result = await fn(report)
        report[name] = {"ok": True, "data": result}
    except Exception as e:
        report[name] = {"ok": False, "error": str(e), "tb": traceback.format_exc()}
    with open("/tmp/repro_running.json", "w") as f:
        json.dump(report, f, indent=2, default=str)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path="/usr/bin/chromium-browser",
            args=["--no-sandbox"],
        )
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        page.on("console", lambda m: console_msgs.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("requestfailed", lambda r: failed_requests.append(f"{r.url} :: {r.failure}"))

        report = {"base": BASE, "console": console_msgs, "page_errors": page_errors, "failed_requests": failed_requests}
        with open("/tmp/repro_running.json", "w") as f:
            json.dump(report, f, indent=2, default=str)

        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(800)

        # Auto-signup (follow smoke.py proven flow)
        try:
            await page.wait_for_selector("#tab-signup", timeout=8000)
            await page.click("#tab-signup")
            await page.wait_for_selector("#signup-user:not(.hidden)", timeout=5000)
            import time
            uname = f"buginsp{int(time.time())%100000}"
            await page.fill("#signup-user", uname)
            await page.fill("#signup-pass", "smoketest1234")
            await page.fill("#signup-pass2", "smoketest1234")
            await page.click("#signup-btn")
            report["signed_up_as"] = uname
        except Exception as e:
            report["signup_error"] = str(e)
        with open("/tmp/repro_running.json", "w") as f:
            json.dump(report, f, indent=2, default=str)
        await page.wait_for_timeout(500)

        # Pick slot 1
        try:
            await page.wait_for_selector("#save-slots button.save-slot", timeout=15000)
            slot_btns = await page.query_selector_all("#save-slots button.save-slot")
            if slot_btns:
                await slot_btns[0].click()
        except Exception as e:
            report["slot_error"] = str(e)

        # Wait for game
        try:
            await page.wait_for_selector("#game-container:not(.hidden)", timeout=15000)
            await page.wait_for_selector("canvas#game-canvas", timeout=5000)
            await page.wait_for_timeout(2500)
        except Exception as e:
            report["game_start_error"] = str(e)
            with open("/tmp/repro_running.json", "w") as f:
                json.dump(report, f, indent=2, default=str)
            await browser.close()
            return

        # Dismiss ALL tutorial modals + skip tutorial entirely
        for _ in range(15):
            t = await page.query_selector("#tutorial-modal")
            if t and await t.is_visible():
                # First try skip-tour button
                skip = await page.query_selector(".tutorial-skip, #tutorial-skip, [data-action=tutorial-skip]")
                if skip:
                    await skip.click()
                    await page.wait_for_timeout(150)
                    continue
                nb = await page.query_selector("#tutorial-next")
                if nb:
                    await nb.click()
                    await page.wait_for_timeout(120)
                else:
                    # Force hide via JS
                    await page.evaluate("() => { const t = document.querySelector('#tutorial-modal'); if(t) t.classList.add('hidden'); }")
                    break
            else:
                break
        # Also: programmatically dismiss via game state if possible
        await page.evaluate("""() => {
          try {
            if(GAME && GAME.tutorial && typeof GAME.tutorial.skip === 'function') GAME.tutorial.skip();
            if(GAME && GAME.tutorial && GAME.tutorial.active) GAME.tutorial.active = false;
            // Hide any visible tutorial-overlay / achievement-overlay
            for(const id of ['tutorial-modal','tutorial-overlay','achievement-toast']){
              const el = document.getElementById(id);
              if(el) el.classList.add('hidden');
            }
            // Also force-hide via inline style for stubborn overlays
            for(const el of document.querySelectorAll('.modal:not(.hidden)')){
              if(el.id !== 'game-container' && el.id !== 'hud'){
                // don't close settings/game UI
                if(!['settings-modal','inventory-modal','spellbook-modal','achievements-modal','shop-spells','shop-gear'].includes(el.id)){
                  el.style.display = 'none';
                }
              }
            }
          } catch(e){}
        }""")
        await page.wait_for_timeout(200)

        # Capture initial game state
        debug = await page.evaluate("""() => ({
          hasGame: typeof GAME !== 'undefined',
          gameKeys: typeof GAME !== 'undefined' ? Object.keys(GAME).length : 0,
          hasPlayer: typeof GAME !== 'undefined' && !!GAME.player,
          hasCam: typeof GAME !== 'undefined' && !!GAME.cam,
          hasWorld: typeof GAME !== 'undefined' && !!GAME.world,
          mapName: typeof GAME !== 'undefined' && GAME.world ? GAME.world.mapName : null,
          playerInfo: (typeof GAME !== 'undefined' && GAME.player) ? {facing: GAME.player.facing, x: GAME.player.x, y: GAME.player.y} : null,
          camInfo: (typeof GAME !== 'undefined' && GAME.cam) ? {x: GAME.cam.x, y: GAME.cam.y} : null,
        })""")
        report["game_debug"] = debug
        with open("/tmp/repro_running.json", "w") as f:
            json.dump(report, f, indent=2, default=str)

        # ============= BUG 4: Enemy health bar (do first, before mods to game state) =============
        async def bug4(report):
            # Teleport to a map with enemies and place player next to one
            setup = await page.evaluate("""() => {
              try {
                // Load meadow (has 6 slimes and bats)
                if(typeof GAME.loadMap !== 'function') return {ok:false, reason:'no loadMap'};
                GAME.loadMap('meadow', 26, 18);  // near the Elder NPC, lots of slimes around
                return {ok: true, map: 'meadow'};
              } catch(e){ return {ok: false, reason: String(e)}; }
            }""")
            out = {"setup": setup}
            await page.wait_for_timeout(500)
            enemies = await page.evaluate("""() => {
              const p = GAME.player;
              const list = GAME.enemies || (GAME.world && GAME.world.enemies) || [];
              const out = [];
              list.forEach((e, i) => {
                const d = Math.hypot(e.x - p.x, e.y - p.y);
                out.push({idx: i, x: e.x, y: e.y, hp: e.hp, hpMax: e.hpMax, type: e.type, dead: !!e.dead, dist: d});
              });
              out.sort((a,b)=>a.dist-b.dist);
              return {all_count: list.length, nearest: out.slice(0, 5), playerPos: {x: p.x, y: p.y}};
            }""")
            out["nearby_enemies"] = enemies
            # Handle empty / None cases
            nearest = enemies.get("nearest", []) if isinstance(enemies, dict) else enemies
            if not nearest:
                out["skip_attack"] = "no nearby enemies"
                return out
            target = nearest[0]
            target_idx = target["idx"]
            before = await page.evaluate(f"""() => {{
              const list = GAME.enemies || (GAME.world && GAME.world.enemies) || [];
              const e = list[{target_idx}];
              return e ? {{hp: e.hp, hpMax: e.hpMax, type: e.type, dead: !!e.dead}} : null;
            }}""")
            esp = await page.evaluate(f"""() => {{
              const list = GAME.enemies || (GAME.world && GAME.world.enemies) || [];
              const e = list[{target_idx}];
              const p = GAME.player; const cam = GAME.cam;
              if(!e || !cam) return null;
              return {{sx: e.x - cam.x, sy: e.y - cam.y, px: p.x - cam.x, py: p.y - cam.y}};
            }}""")
            if not esp:
                out["skip_attack"] = "no screen pos for enemy"
                return out
            # Click toward enemy to attack
            for _ in range(20):
                await page.mouse.click(esp["sx"], esp["sy"])
                await page.wait_for_timeout(120)
            after = await page.evaluate(f"""() => {{
              const list = GAME.enemies || (GAME.world && GAME.world.enemies) || [];
              const e = list[{target_idx}];
              return e ? {{hp: e.hp, hpMax: e.hpMax, type: e.type, dead: !!e.dead}} : null;
            }}""")
            out["target_idx"] = target_idx
            out["target_type"] = target["type"] if target else None
            out["target_screen_pos"] = esp
            out["before"] = before
            out["after"] = after
            ss = OUT / "repro-enemy-hp.png"
            await page.screenshot(path=str(ss))
            out["screenshot"] = str(ss)
            # Check for enemy HP UI element
            hud_check = await page.evaluate("""() => {
              const ids = [];
              for(const el of document.querySelectorAll('[id]')) ids.push(el.id);
              return {has_enemy_hp_id: ids.some(i => i.includes('enemy') && i.includes('hp')),
                      ids_with_hp: ids.filter(i => i.toLowerCase().includes('hp'))};
            }""")
            out["dom_hp_check"] = hud_check
            return out
        await safe("bug4_enemy_health", bug4, report)

        # ============= BUG 2: Walking animation facing =============
        async def bug2(report):
            out = {}
            for label, opts in [("up", {"key": "w"}), ("down", {"key": "s"}),
                                 ("left", {"key": "a"}), ("right", {"key": "d"})]:
                # Get current position
                p0 = await page.evaluate("""() => ({x: GAME.player.x, y: GAME.player.y})""")
                # Move for one bob period (350ms gives time for bob to oscillate)
                await page.keyboard.down(opts["key"])
                await page.wait_for_timeout(250)
                # Hold key, screenshot in mid-bob
                p1 = await page.evaluate("""() => ({x: GAME.player.x, y: GAME.player.y, facing: GAME.player.facing})""")
                # Center camera on player (offset so player is in middle of screen)
                await page.evaluate(f"""() => {{
                  GAME.cam.x = GAME.player.x - 640;
                  GAME.cam.y = GAME.player.y - 360;
                }}""")
                await page.wait_for_timeout(40)
                psp = await page.evaluate("""() => {
                  const p = GAME.player; const cam = GAME.cam;
                  return {sx: Math.round(p.x - cam.x), sy: Math.round(p.y - cam.y)};
                }""")
                # Screenshot full screen
                ss = OUT / f"repro-walk-{label}.png"
                await page.screenshot(path=str(ss))
                # Crop around player
                crop_box = {
                    "x": max(0, psp["sx"] - 40),
                    "y": max(0, psp["sy"] - 40),
                    "width": 80,
                    "height": 80,
                }
                cropped = OUT / f"repro-walk-{label}-crop.png"
                await page.screenshot(path=str(cropped), clip=crop_box)
                await page.keyboard.up(opts["key"])
                await page.wait_for_timeout(50)
                data = await page.evaluate("""() => ({facing: GAME.player.facing, x: GAME.player.x, y: GAME.player.y})""")
                out[label] = {
                    "start_pos": p0, "mid_pos": p1, "end_pos": data,
                    "screen_pos": psp,
                    "screenshot": str(ss),
                    "cropped": str(cropped),
                }
                # Move back to original position
                back = {"up":"s","down":"w","left":"d","right":"a"}[label]
                await page.keyboard.down(back)
                await page.wait_for_timeout(250)
                await page.keyboard.up(back)
                await page.wait_for_timeout(60)
            return out
        await safe("bug2_walk_4dirs", bug2, report)

        # ============= BUG 5: Forgotten Crypt portal =============
        async def bug5(report):
            out = {}
            # Walk player south a few times to escape the tutorial hut area,
            # so we end up in open meadow with potential enemies and can
            # teleport to dungeon1.
            for _ in range(60):
                await page.keyboard.down("s")
                await page.wait_for_timeout(30)
            await page.keyboard.up("s")
            await page.wait_for_timeout(500)
            crypt_check = await page.evaluate("""() => {
              const mapName = GAME.world && GAME.world.mapName;
              // Find Forgotten Crypt in the world via game's stored map defs
              const cur = GAME.world && GAME.world.def;
              let crypt = null;
              // All maps live in module-level MAPS but not on window. Inspect via game state.
              if(GAME.world && GAME.world.maps){ crypt = Object.values(GAME.world.maps).find(m => m.name && m.name.toLowerCase().includes('crypt')); }
              // Fallback: try common property names
              if(!crypt && cur){
                for(const k of Object.keys(cur)){
                  if(k.toLowerCase().includes('crypt')) crypt = cur[k];
                }
              }
              return {
                currentMap: mapName,
                gameKeys: Object.keys(GAME),
                worldKeys: GAME.world ? Object.keys(GAME.world).slice(0, 30) : [],
                cryptDef: crypt ? { name: crypt.name, id: crypt.id || Object.keys(crypt), portals: crypt.portals || [] } : null,
                playerPos: {x: GAME.player.x, y: GAME.player.y}
              };
            }""")
            out["crypt_check"] = crypt_check
            # Try to load dungeon1 directly
            tp = await page.evaluate("""() => {
              try {
                if(typeof GAME.loadMap !== 'function'){
                  return {ok: false, reason: 'GAME.loadMap not a function'};
                }
                const before = GAME.world && GAME.world.def && GAME.world.def.name;
                GAME.loadMap('dungeon1', 9, 5);
                // Force immediate sync read
                const after = GAME.world && GAME.world.def && GAME.world.def.name;
                const currentMap = GAME.currentMap;
                return {ok: true, before, after, currentMap, newMap: 'dungeon1'};
              } catch(e){ return {ok: false, reason: String(e), stack: e.stack}; }
            }""")
            out["teleport"] = tp
            await page.wait_for_timeout(1200)  # extra wait for any async portal auto-teleport
            post = await page.evaluate("""() => ({
              worldDefName: GAME.world && GAME.world.def && GAME.world.def.name,
              currentMap: GAME.currentMap,
              playerPos: {x: GAME.player.x, y: GAME.player.y},
              transition: GAME.transition,
            })""")
            out["post_teleport"] = post
            if tp.get("ok"):
                state = await page.evaluate("""() => {
                  const map = GAME.world.def;
                  const portalList = (GAME.world.portals || []).map(p => ({x:p.x, y:p.y, target:p.target, kind: p.kind || null, wx: p.wx, wy: p.wy}));
                  let solidCheck = [];
                  if(map.portals){
                    for(const p of map.portals){
                      let isSolid = null, neighbors = {};
                      try { isSolid = GAME.world.isSolid(p.x, p.y); } catch(e){}
                      // Check 4 cardinal neighbors
                      for(const [dx, dy, name] of [[1,0,'r'],[-1,0,'l'],[0,1,'d'],[0,-1,'u']]){
                        try { neighbors[name] = GAME.world.isSolid(p.x+dx, p.y+dy); } catch(e){}
                      }
                      // Also check raw tile
                      const tx = Math.floor(p.x), ty = Math.floor(p.y);
                      const t = (map.tiles && map.tiles[ty] && map.tiles[ty][tx]);
                      solidCheck.push({x:p.x, y:p.y, target:p.target, kind:p.kind, isSolid, neighbors, tile: t});
                    }
                  }
                  return {mapName: map.name, mapSize: {w: map.w, h: map.h}, portals: portalList, playerPos: {x: GAME.player.x, y: GAME.player.y}, solidCheck};
                }""")
                out["crypt_state"] = state
                ss = OUT / "repro-crypt.png"
                await page.screenshot(path=str(ss))
                out["crypt_state"]["screenshot"] = str(ss)
            return out
        await safe("bug5_forgotten_crypt", bug5, report)

        # ============= BUG 3: Cursor style inspection =============
        async def bug3(report):
            cursor_check = await page.evaluate("""() => {
              const samples = {};
              for(const sel of ['html', '#game-canvas', 'button', '.btn', 'a', 'input', '[role=button]']){
                const el = document.querySelector(sel);
                if(!el) { samples[sel] = 'no-element'; continue; }
                samples[sel] = getComputedStyle(el).cursor;
              }
              const rules = [];
              for(const ss of document.styleSheets){
                try {
                  for(const r of ss.cssRules){
                    const t = r.cssText || '';
                    if(t.includes('cursor') || t.includes('scrollbar') || t.includes('webkit-scrollbar')) rules.push(t.slice(0, 250));
                  }
                } catch(e){}
              }
              // Check for canvas-specific cursor
              const canvas = document.querySelector('#game-canvas');
              const canvasCs = canvas ? getComputedStyle(canvas).cursor : null;
              return {samples, canvasCursor: canvasCs, rules_with_cursor_or_scrollbar: rules};
            }""")
            ss = OUT / "repro-cursor.png"
            await page.screenshot(path=str(ss), full_page=False)
            return {**cursor_check, "screenshot": str(ss)}
        await safe("bug3_cursor", bug3, report)

        # ============= BUG 1: Settings scrollbar styling =============
        async def bug1(report):
            # First close any open modals (Escape might be intercepted by game)
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
            # Force-hide any modal that's not settings/inventory/spellbook
            await page.evaluate("""() => {
              for(const m of document.querySelectorAll('.modal:not(.hidden)')){
                if(['settings-modal','inventory-modal','spellbook-modal','achievements-modal'].includes(m.id)) continue;
                m.classList.add('hidden');
              }
              const tm = document.getElementById('tutorial-modal');
              if(tm) tm.classList.add('hidden');
            }""")
            await page.wait_for_timeout(200)
            # Click settings button (it's in HUD)
            sb = await page.query_selector("#settings-btn")
            if sb:
                # Scroll into view first
                await sb.scroll_into_view_if_needed()
                await sb.click(force=True, timeout=8000)
                await page.wait_for_timeout(500)
            else:
                return {"error": "#settings-btn not found"}
            m = await page.query_selector("#settings-modal")
            if not m:
                return {"error": "settings modal did not open"}
            visible = await m.is_visible()
            scrollbar = await page.evaluate("""() => {
              const m = document.querySelector('#settings-modal');
              if(!m) return {found:false};
              const scroll = m.querySelector('.modal-scroll');
              let info = {found:true, modalHeight: m.getBoundingClientRect().height, modalVisible: m.getBoundingClientRect().width > 0};
              if(scroll){
                const cs = getComputedStyle(scroll);
                info.scroll = {
                  height: scroll.getBoundingClientRect().height,
                  scrollHeight: scroll.scrollHeight,
                  overflowY: cs.overflowY,
                  scrollbarWidth: cs.scrollbarWidth,
                  customScrollbar: cs.getPropertyValue('scrollbar-color') || cs.scrollbarColor,
                };
                // Find ALL scrollbar rules
                const rules = [];
                for(const ss of document.styleSheets){
                  try {
                    for(const r of ss.cssRules){
                      const t = r.cssText || '';
                      if(t.includes('scrollbar') || t.includes('webkit-scrollbar')) rules.push(t.slice(0, 300));
                    }
                  } catch(e){}
                }
                info.scrollbar_rules = rules;
                info.has_modal_scroll_rule = rules.some(r => r.includes('modal-scroll'));
              }
              return info;
            }""")
            ss = OUT / "repro-settings.png"
            await page.screenshot(path=str(ss))
            return {**scrollbar, "modal_visible": visible, "screenshot": str(ss)}
        await safe("bug1_settings_scrollbar", bug1, report)

        await browser.close()

    print(json.dumps(report, indent=2, default=str))

try:
    asyncio.run(main())
except SystemExit:
    raise
except Exception:
    sys.stderr.write("=== TOP-LEVEL TRACEBACK ===\n")
    traceback.print_exc(file=sys.stderr)
    sys.exit(2)
