# Aetheria — Agent Notes

Browser action-RPG. Vanilla JS + Canvas 2D + Tailwind (precompiled). No bundler, no transpiler — files load as ES modules straight in the browser.

## Repo

- **Path:** `~/Projects/aetheria-game/`
- **Live:** https://aetheria-game-alpha.vercel.app
- **Owner:** Shobre (Charles Diep)
- **README:** `README.md` (player-facing). `COMBINED_ROADMAP.md` is the long-term plan + changelog.

## Layout

| Path | What lives here |
|------|-----------------|
| `index.html` | Entry. Loads `js/main.js`, mounts canvas, pulls in `css/`. |
| `js/main.js` | Bootstrap. Kicks off `Game` system. |
| `js/entities/` | `Player`, `Enemy`, `Boss`, plus the entity helpers. |
| `js/systems/` | `Game`, `World`, `Save`, `Audio`, `Input`, `Craft`, `Turso`. |
| `js/data/` | Static catalogs: `gear.js`, `maps.js`, `spells.js`, `affixes.js`, `quests.js`, `skillTree.js`. |
| `js/ui/` | HUD rendering (HP/MP/hotbar/overlays). |
| `js/interact.js` | NPC + portal + chest interaction. |
| `js/sprites.js` | Pixel-art sprite atlas + draw helpers. |
| `css/` | Precompiled Tailwind + custom game styles. |
| `api/` | Vercel serverless functions (CJS) for Turso-backed cloud saves + auth. |
| `tests/` | Custom node test runner (`tests/run.js`) + smoke loader. |
| `scripts/` | One-off dev scripts. |
| `assets/` | Sprites, tiles, audio. |

## Commands

```bash
# Run the game (port 3005)
python -m http.server 3005

# Tests (1304 unit tests, single command)
npm test

# Lint
npm run lint

# Type-check (Sprint 14)
npm run typecheck
```

There is **no `npm run build` step** — `build.cjs` is a Vercel pre-deploy hook, not a bundler. The site is shipped as-is.

## House rules

- **No bundler.** Don't introduce webpack/vite/rollup. Stay with native ES modules.
- **No new runtime deps** unless absolutely required. Current runtime deps are zero — `package.json` devDeps are eslint + globals only.
- **CJS in `api/`.** The `api/*` serverless functions are CommonJS on purpose. Adding `"type": "module"` to `package.json` breaks them (this was the Sprint 13b regression — don't repeat it).
- **Tailwind is precompiled.** CSS comes from `css/`, not from a CDN or JIT rebuild. Don't add a Tailwind CLI step locally.
- **Data catalogs are data, not code.** New gear/spells/affixes/quests belong as entries in the appropriate `js/data/*.js` file, not scattered as conditionals.
- **Turso is the source of truth for cloud saves.** `js/systems/turso.js` is the only file that should talk to the DB. Local `Save` system falls back to localStorage when Turso is unconfigured.

## Testing conventions

- Custom runner in `tests/run.js` (not Jest/Vitest). Uses `node:assert` and `node:test`-style structure but rolls its own loader.
- Tests live in `tests/` as `.mjs` files. The smoke loader `_smoke_modules.mjs` imports every module to catch syntax errors.
- Run from repo root: `npm test`.
- Adding a new test? Match the existing pattern in `tests/run.js` (one `it()` per behavior, descriptive names, no shared mutable state).

## Known gotchas

- **`/api/*` must stay CJS.** See house rules. If `package.json` ever flips to `"type": "module"`, all serverless functions 500 immediately.
- **Vercel rewrites** in `vercel.json` route `/api/*` → `/api/*`. Don't add a catch-all that shadows it.
- **ESLint `no-undef`** is on. Use the `globals.browser` / `globals.node` configs from `eslint.config.js`; don't add per-file `/* global foo */` unless the var is intentionally on `window`.
- **`prog` in `js/entities/player.js:429`** — the player progression variable. ESLint flagged it in Sprint 13. Don't introduce more latent globals; use `const`/`let` at the top of the file.

## Type conventions (Sprint 14+15)

- `npm run typecheck` runs `tsc --noEmit --project jsconfig.json` over the whole `js/` tree. Currently with `checkJs:false` — it validates syntax and import shape, silent on success.
- All 14 `js/data/*.js` catalogs have `@typedef` blocks at the top + `@type` annotations on exports. New catalog data should follow the pattern: define a `@typedef`, then `/** @type {Record<string, MyType>} */` on the export.
- Cross-file types via `@param {import('./other.js').Type} name`.
- DOM lookups in `main.js` use `@type {HTMLButtonElement|null}`, `HTMLInputElement|null`, `HTMLCanvasElement|null`, or `HTMLElement|null`. Match by ID prefix: `-btn` → button, `-user`/`-pass`/`set-*` → input, `-modal`/`-screen`/`save-slots` → HTMLElement, `-canvas` → HTMLCanvasElement.
- The full class typing (Player/Enemy/Boss/Game/HUD methods) is **Sprint 16 work**. Until then, `checkJs:true` surfaces ~291 unfixed errors (mostly my own imperfect typedef shapes — `AtlasFrame` numeric-key tuples, tutorial curried triggers, etc.) — keep it `false` in `jsconfig.json`.
- Don't add `// @ts-ignore` to silence the typechecker. Fix the JSDoc or fix the code.
- Don't add `"type": "module"` to `package.json` — would break `/api/*` CJS on Vercel (Sprint 13b regression).

## Live smoke test (Sprint 15)

- `python3 scripts/smoke.py` — Playwright headless chromium against the deployed Vercel URL.
- Captures all console errors/warnings, failed network requests, uncaught JS exceptions.
- Creates a fresh disposable account per run; no env vars needed.
- Exits non-zero on any issue. Exit 0 = clean deploy. Run after every push.

## Working agreement

- The user (Shobre) is the only developer. Don't assume a team, don't add CODEOWNERS, don't add PR templates.
- Prefer the smallest change that works. Refactors are explicitly scoped per sprint in `COMBINED_ROADMAP.md`.
- When the user asks for a feature, check the roadmap first — it's often already planned.
- Don't add CI. Local `npm test` + `npm run lint` is the gate; Vercel handles deploy.
