#!/usr/bin/env python3
"""
smoke.py — Live browser smoke test for aetheria-game.

Visits https://aetheria-game-alpha.vercel.app in headless chromium,
logs in as the user (creds from env var), picks save slot 1, waits
for the game canvas to mount, and reports any console errors/warnings
or failed network requests.

Exits 0 if clean, exit 1 otherwise. Outputs:
  - scripts/smoke-output.png    (screenshot of the running game)
  - scripts/smoke-report.txt    (full console + network log)

Usage:
  SMOKE_PASSWORD=dinmamma911 python3 scripts/smoke.py
  SMOKE_PASSWORD=... SMOKE_USERNAME=shobre python3 scripts/smoke.py

Requires: playwright (pip install playwright && playwright install chromium)
Uses the ARM64-Pi-compatible system chromium at /usr/bin/chromium-browser
(Playwright 1.60 does not support browser auto-install on aarch64 Ubuntu).
"""

import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SCRIPT_DIR = Path(__file__).resolve().parent
SCREENSHOT_PATH = SCRIPT_DIR / 'smoke-output.png'
REPORT_PATH = SCRIPT_DIR / 'smoke-report.txt'

LIVE_URL = os.environ.get('SMOKE_URL', 'https://aetheria-game-alpha.vercel.app')
USERNAME = os.environ.get('SMOKE_USERNAME', 'shobre')
PASSWORD = os.environ.get('SMOKE_PASSWORD', '')
CHROMIUM_PATH = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium-browser')

# Console levels we treat as failures. We accept 'log'/'info'/'debug' silently.
FAIL_LEVELS = {'error', 'warning'}

# Network responses that count as failures. 4xx on our own static assets is bad
# (e.g. favicon 404 was the headline issue). 5xx is always bad. 3xx redirects
# are fine — Playwright follows them and reports the final 200.
FAIL_STATUSES = lambda status: status >= 400

# Resources we explicitly ignore (third-party font CDN can return 4xx in headless
# contexts where the browser skips rendering; doesn't indicate a bug).
IGNORE_HOSTS = {'fonts.googleapis.com', 'fonts.gstatic.com'}


def main():
    # No env vars required — the smoke creates its own disposable account.
    PASSWORD = 'unused'

    console_messages = []
    failed_requests = []
    failed_responses = []
    page_errors = []  # uncaught JS exceptions

    started = time.time()

    with sync_playwright() as pw:
        launch_kwargs = {
            'headless': True,
            'args': ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        }
        # Use system chromium on ARM64 Pi (Playwright 1.60 can't install it).
        if Path(CHROMIUM_PATH).exists():
            launch_kwargs['executable_path'] = CHROMIUM_PATH
        else:
            print(f'WARNING: chromium not found at {CHROMIUM_PATH}; trying Playwright default.')

        browser = pw.chromium.launch(**launch_kwargs)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # ---- Console listener ----
        def on_console(msg):
            level = msg.type
            text = msg.text
            location = msg.location
            console_messages.append({
                'level': level,
                'text': text,
                'url': location.get('url', ''),
                'line': location.get('lineNumber', 0),
            })

        page.on('console', on_console)

        # ---- Page errors (uncaught exceptions) ----
        def on_pageerror(err):
            page_errors.append(str(err))

        page.on('pageerror', on_pageerror)

        # ---- Network listener ----
        def on_response(resp):
            url = resp.url
            status = resp.status
            # Ignore third-party font CDN
            if any(host in url for host in IGNORE_HOSTS):
                return
            if FAIL_STATUSES(status):
                failed_responses.append({'url': url, 'status': status})

        def on_requestfailed(req):
            url = req.url
            failure = req.failure
            if any(host in url for host in IGNORE_HOSTS):
                return
            failed_requests.append({
                'url': url,
                'method': req.method,
                'reason': str(failure) if failure else 'unknown',
            })

        page.on('response', on_response)
        page.on('requestfailed', on_requestfailed)

        # ---- Navigate to live URL ----
        print(f'Navigating to {LIVE_URL}...')
        page.goto(LIVE_URL, wait_until='domcontentloaded', timeout=30000)

        # ---- Login ----
        print(f'Logging in as {USERNAME}...')
        # ---- Sign up + login ----
        # The auth API uses btoa(username+':'+password) as the hash, stored
        # server-side. To avoid coupling the smoke to a real account, we
        # sign up a fresh smoke account each run (atomic; if user exists the
        # server returns ok:false for register but the login still works).
        try:
            page.wait_for_selector('#tab-signup', timeout=5000)
            page.click('#tab-signup')
            page.wait_for_selector('#signup-user:not(.hidden)', timeout=5000)
            # Use a unique smoke username with a timestamp so re-runs don't collide
            ts = int(time.time())
            smoke_user = f'smoke_{ts}'
            print(f'Using smoke account: {smoke_user}')
            page.fill('#signup-user', smoke_user)
            page.fill('#signup-pass', 'smoketest1234')
            page.fill('#signup-pass2', 'smoketest1234')
            page.wait_for_selector('#signup-btn', timeout=5000)
            page.click('#signup-btn')

            # Wait for slot picker (#start-screen) to appear
            page.wait_for_selector('#start-screen:not(.hidden)', timeout=20000)
            print('Sign-up OK; slot picker visible.')
        except Exception as e:
            print(f'ERROR during login: {e}', file=sys.stderr)
            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            print(f'Screenshot of failure: {SCREENSHOT_PATH}')
            # Diagnostic: dump the visible screens
            visible = page.evaluate("""
                () => Array.from(document.querySelectorAll('.screen')).map(s => ({
                    id: s.id, hidden: s.classList.contains('hidden')
                }))
            """)
            print(f'Visible screens: {visible}')
            err_text = page.evaluate("() => document.getElementById('login-error')?.textContent || ''")
            print(f'Login error msg: {err_text!r}')
            browser.close()
            return 1

        # ---- Pick save slot 1 ----
        # Slot buttons live inside #save-slots as button.save-slot (no data-slot
        # attribute in the rendered DOM — the index in the NodeList maps 1:1 to
        # the slot number).
        try:
            # Give slots a moment to render (they read from Turso, async).
            page.wait_for_selector('#save-slots button.save-slot', timeout=10000)
            slot_btns = page.query_selector_all('#save-slots button.save-slot')
            if not slot_btns:
                raise RuntimeError('No save slots found on start screen.')
            slot_btns[0].click()
            print(f'Picked slot 1 of {len(slot_btns)}.')
        except Exception as e:
            print(f'ERROR picking slot: {e}', file=sys.stderr)
            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            browser.close()
            return 1

        # ---- Wait for canvas + game state ----
        # The game hides #start-screen and shows #game-container.
        print('Waiting for game canvas to mount...')
        try:
            page.wait_for_selector('#game-container:not(.hidden)', timeout=15000)
            page.wait_for_selector('canvas#game-canvas', timeout=5000)
            # Wait an extra 2 seconds so initial render + audio init + any
            # background fetches complete.
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f'ERROR: game never started: {e}', file=sys.stderr)
            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            browser.close()
            return 1

        # ---- Take screenshot ----
        page.screenshot(path=str(SCREENSHOT_PATH), full_page=False)
        print(f'Screenshot saved: {SCREENSHOT_PATH}')

        # ---- Move the player a bit to exercise input/AI/audio ----
        try:
            page.focus('canvas')
            # Press D for 500ms — moves player right
            page.keyboard.down('d')
            page.wait_for_timeout(500)
            page.keyboard.up('d')
            # And W for 500ms — moves up
            page.keyboard.down('w')
            page.wait_for_timeout(500)
            page.keyboard.up('w')
            # Cast a spell (Q)
            page.keyboard.press('q')
            page.wait_for_timeout(500)
            # Open inventory (B)
            page.keyboard.press('b')
            page.wait_for_timeout(300)
            page.keyboard.press('Escape')
            page.wait_for_timeout(300)
        except Exception as e:
            print(f'WARNING: input simulation failed: {e}', file=sys.stderr)

        page.screenshot(path=str(SCREENSHOT_PATH), full_page=False)
        browser.close()

    # ---- Report ----
    elapsed = time.time() - started
    print(f'\nSmoke test completed in {elapsed:.1f}s.')

    fail_console = [m for m in console_messages if m['level'] in FAIL_LEVELS]
    # Only treat failed_responses to our own origin as errors; some third-party
    # sites may return 4xx in headless contexts.
    fail_responses = [r for r in failed_responses
                      if LIVE_URL.split('//')[1].split('/')[0] in r['url']]

    report = []
    report.append(f'Smoke test: {LIVE_URL}')
    report.append(f'User: {USERNAME}')
    report.append(f'Elapsed: {elapsed:.1f}s')
    report.append('')
    report.append('--- Summary ---')
    report.append(f'  Console messages:     {len(console_messages)} total, {len(fail_console)} failures')
    report.append(f'  Failed requests:      {len(failed_requests)}')
    report.append(f'  Failed responses:     {len(failed_responses)}')
    report.append(f'  Uncaught exceptions:  {len(page_errors)}')
    report.append('')

    if fail_console:
        report.append('--- Console failures ---')
        for m in fail_console:
            report.append(f'  [{m["level"]}] {m["text"]}')
            if m['url']:
                report.append(f'    at {m["url"]}:{m["line"]}')
        report.append('')
    if failed_requests:
        report.append('--- Failed requests ---')
        for r in failed_requests:
            report.append(f'  {r["method"]} {r["url"]} — {r["reason"]}')
        report.append('')
    if fail_responses:
        report.append('--- Failed responses ---')
        for r in fail_responses:
            report.append(f'  {r["status"]} {r["url"]}')
        report.append('')
    if page_errors:
        report.append('--- Uncaught exceptions ---')
        for e in page_errors:
            report.append(f'  {e}')
        report.append('')

    # All console messages (debug aid)
    if console_messages:
        report.append(f'--- All console messages ({len(console_messages)}) ---')
        for m in console_messages:
            report.append(f'  [{m["level"]}] {m["text"]}')
        report.append('')

    report_text = '\n'.join(report)
    REPORT_PATH.write_text(report_text)

    # ---- Decide ----
    has_failures = bool(fail_console or failed_requests or fail_responses or page_errors)
    if has_failures:
        print('\n=== SMOKE TEST FAILED ===')
        print(f'  {len(fail_console)} console failures')
        print(f'  {len(failed_requests)} failed requests')
        print(f'  {len(fail_responses)} failed responses')
        print(f'  {len(page_errors)} uncaught exceptions')
        print(f'\nFull report: {REPORT_PATH}')
        return 1

    print('\n=== SMOKE TEST PASSED ===')
    print(f'  0 console failures')
    print(f'  0 failed requests')
    print(f'  0 failed responses')
    print(f'  0 uncaught exceptions')
    return 0


if __name__ == '__main__':
    sys.exit(main())
