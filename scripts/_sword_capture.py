"""Capture sword screenshots for each facing direction."""
from playwright.sync_api import sync_playwright
import time, json

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        headless=True,
        executable_path='/usr/bin/chromium-browser',
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    )
    page = browser.new_context(viewport={'width': 1280, 'height': 720}).new_page()
    page.goto('https://aetheria-game-alpha.vercel.app')
    page.wait_for_function("window.GAME && window.GAME.maps", timeout=20000)
    user = f"sword_{int(time.time())}"
    page.click('#tab-signup')
    page.fill('#signup-user', user)
    page.fill('#signup-pass', 'audittest1234')
    page.fill('#signup-pass2', 'audittest1234')
    page.click('#signup-btn')
    page.wait_for_selector('#start-screen:not(.hidden)', timeout=20000)
    page.wait_for_selector('#save-slots button.save-slot', timeout=10000)
    page.query_selector_all('#save-slots button.save-slot')[0].click()
    page.wait_for_selector('#game-container:not(.hidden)', timeout=15000)
    page.wait_for_timeout(2000)

    # Click SKIP TOUR if present, then hide any remaining tutorial
    page.evaluate("""() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const skip = buttons.find(b => b.textContent && b.textContent.includes('SKIP TOUR'));
        if(skip) skip.click();
        // Aggressive hide: any element containing tutorial text or in front of canvas
        for(const el of document.querySelectorAll('div')){
            const txt = el.textContent || '';
            if(txt.includes('Welcome to Aetheria') || txt.includes('SKIP TOUR')){
                el.style.display = 'none';
            }
        }
        if(GAME.tutorial){
            GAME.tutorial.done = true;
            GAME.tutorial.active = false;
            GAME.tutorial.step = -1;
        }
    }""")
    page.wait_for_timeout(500)

    # Move player to a clear area in meadow and center camera
    page.evaluate("""() => {
        GAME.player.x = 1600;
        GAME.player.y = 1200;
        GAME.cam.x = GAME.player.x - 640;
        GAME.cam.y = GAME.player.y - 360;
    }""")
    page.wait_for_timeout(300)

    state = page.evaluate("""() => ({
        px: GAME.player.x, py: GAME.player.y,
        cam: { x: GAME.cam.x, y: GAME.cam.y },
        screenX: GAME.player.x - GAME.cam.x,
        screenY: GAME.player.y - GAME.cam.y,
        tutorial: GAME.tutorial ? { done: GAME.tutorial.done, step: GAME.tutorial.step } : null,
    })""")
    print("State:", json.dumps(state, indent=2))

    # Equip sword
    page.evaluate("""() => {
        const p = GAME.player;
        const sword = { id: 'sword_iron', name: 'Iron Sword', type: 'weapon', slot: 'weapon' };
        p.weapon = sword;
        if(typeof p.attackCd === 'number') p.attackCd = 0;
    }""")
    page.wait_for_timeout(200)

    # Snapshot state of the canvas by capturing player frame coords
    for facing in ['right', 'left', 'up', 'down']:
        page.evaluate("(f) => { GAME.player.facing = f; }", facing)
        page.wait_for_timeout(300)
        page.screenshot(path=f'/home/shobre/Projects/aetheria-game/scripts/repro-sword-{facing}.png')
        print(f"  saved {facing}")

    browser.close()
print("done")
