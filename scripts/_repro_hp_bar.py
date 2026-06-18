#!/usr/bin/env python3
"""Sprint 18 live verification — confirm enemy HP bar is rendered on a mob next to the player.
Teleports an enemy right next to the player, screenshots, and checks for HP bar pixels.
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://aetheria-game-alpha.vercel.app"
OUT = Path(__file__).parent

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/usr/bin/chromium-browser", args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        msgs = []
        page.on("console", lambda m: msgs.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: msgs.append(f"pageerror: {e}"))
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(500)
        # Sign up
        import time
        await page.wait_for_selector("#tab-signup", timeout=8000)
        await page.click("#tab-signup")
        await page.wait_for_selector("#signup-user:not(.hidden)", timeout=5000)
        uname = f"hpbar{int(time.time())%100000}"
        await page.fill("#signup-user", uname)
        await page.fill("#signup-pass", "smoketest1234")
        await page.fill("#signup-pass2", "smoketest1234")
        await page.click("#signup-btn")
        await page.wait_for_selector("#save-slots button.save-slot", timeout=15000)
        slot = (await page.query_selector_all("#save-slots button.save-slot"))[0]
        await slot.click()
        await page.wait_for_selector("#game-container:not(.hidden)", timeout=15000)
        await page.wait_for_selector("canvas#game-canvas", timeout=5000)
        await page.wait_for_timeout(2000)

        # Dismiss tutorial
        for _ in range(20):
            t = await page.query_selector("#tutorial-modal")
            if t and await t.is_visible():
                skip = await page.query_selector(".tutorial-skip, #tutorial-skip, [data-action=tutorial-skip]")
                if skip:
                    await skip.click(); await page.wait_for_timeout(150); continue
                nb = await page.query_selector("#tutorial-next")
                if nb:
                    await nb.click(); await page.wait_for_timeout(120)
                else:
                    break
            else:
                break
        # Also force-hide any modal that's not settings/inventory/spellbook/achievements
        await page.evaluate("""() => {
          for(const m of document.querySelectorAll('.modal:not(.hidden)')){
            if(['settings-modal','inventory-modal','spellbook-modal','achievements-modal','game-container'].includes(m.id)) continue;
            m.classList.add('hidden');
          }
          // Also kill tutorial state if it exists
          if(GAME && GAME.tutorial){
            if(typeof GAME.tutorial.skip === 'function') GAME.tutorial.skip();
            if(GAME.tutorial.active) GAME.tutorial.active = false;
          }
          // Hide checkpoint notification
          for(const sel of ['#checkpoint-toast','#achievement-toast']){
            const el = document.querySelector(sel); if(el) el.classList.add('hidden');
          }
        }""")
        await page.wait_for_timeout(300)

        # Teleport to meadow, then place an enemy RIGHT NEXT to the player
        setup = await page.evaluate("""() => {
          try {
            GAME.loadMap('meadow', 26, 18);
            const p = GAME.player;
            // Force spawn one enemy right next to player
            const existing = (GAME.enemies || [])[0];
            if(existing){
              existing.x = p.x + 32;
              existing.y = p.y;
              existing.hp = Math.floor(existing.hpMax * 0.65);  // 65% to show partial bar
              return {ok:true, enemyId: existing.id, type: existing.type, hp: existing.hp, hpMax: existing.hpMax, pos: {x: existing.x, y: existing.y}};
            }
            return {ok:false, reason:'no enemy'};
          } catch(e){ return {ok:false, reason:String(e)}; }
        }""")
        # Center camera on player
        await page.evaluate("() => { GAME.cam.x = GAME.player.x - 640; GAME.cam.y = GAME.player.y - 360; }")
        await page.wait_for_timeout(500)

        info = await page.evaluate("""() => {
          const e = GAME.enemies[0];
          const p = GAME.player;
          const cam = GAME.cam;
          return {enemy: {x: e.x, y: e.y, hp: e.hp, hpMax: e.hpMax, type: e.type, dead: !!e.dead},
                  player: {x: p.x, y: p.y},
                  cam: {x: cam.x, y: cam.y},
                  screenEnemy: {sx: e.x - cam.x, sy: e.y - cam.y},
                  screenPlayer: {sx: p.x - cam.x, sy: p.y - cam.y}};
        }""")

        # Screenshot
        ss = OUT / "repro-hp-bar-final.png"
        await page.screenshot(path=str(ss))

        # Check for HP-bar pixels (gold border #caa050 + red fill #e8413c) above the enemy.
        # The enemy is at screen (sx, sy), the bar is at sy-this.r-8.
        # We'll sample a 40x8 strip centered above the enemy.
        # Read the PNG with PIL if available; else return raw data.
        from PIL import Image
        img = Image.open(str(ss))
        sx = int(info["screenEnemy"]["sx"])
        sy = int(info["screenEnemy"]["sy"])
        # Sample a 60x40 strip centered above the enemy
        strip_y_start = max(0, sy - 40)
        strip_y_end = max(0, sy)
        strip_x_start = max(0, sx - 30)
        strip_x_end = max(0, sx + 30)
        if strip_y_end > img.height or strip_x_end > img.width:
            print(f"strip out of bounds: img {img.size}, strip {strip_x_start},{strip_y_start}-{strip_x_end},{strip_y_end}")
        else:
            crop = img.crop((strip_x_start, strip_y_start, strip_x_end, strip_y_end))
            crop.save(str(OUT / "repro-hp-bar-strip.png"))
            pixels = crop.load()
            gold_pixels = 0
            red_pixels = 0
            black_bar_pixels = 0
            for y in range(crop.height):
                for x in range(crop.width):
                    r, g, b = pixels[x, y][:3]
                    # gold border #caa050 ~= (202, 160, 80)
                    if abs(r-202) < 30 and abs(g-160) < 30 and abs(b-80) < 30:
                        gold_pixels += 1
                    # red fill #e8413c ~= (232, 65, 60)
                    if abs(r-232) < 30 and abs(g-65) < 30 and abs(b-60) < 30:
                        red_pixels += 1
                    # dark track #000
                    if r < 30 and g < 30 and b < 30:
                        black_bar_pixels += 1
            result = {"gold_border_pixels": gold_pixels, "red_fill_pixels": red_pixels, "dark_track_pixels": black_bar_pixels,
                      "strip": [strip_x_start, strip_y_start, strip_x_end, strip_y_end],
                      "screen_enemy_pos": [sx, sy]}
            print(json.dumps({"setup": setup, "info": info, "hp_bar_pixels": result}, indent=2, default=str))
        await browser.close()

asyncio.run(main())
