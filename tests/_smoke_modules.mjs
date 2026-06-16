// Browser shim for Node test of browser boot-path modules.
// Catches the class of bug where a module references an undefined global
// at the top level (e.g. main.js's `getKeybindOverrides is not defined`
// regression that survived from Sprint 7 to Sprint 12 undetected).
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

globalThis.window = {
  addEventListener: () => {}, __keybinds: null, GAME: null,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
globalThis.document = {
  getElementById: () => ({ classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {}, querySelectorAll: () => [], appendChild: () => {}, style: {}, dataset: {} }),
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: { appendChild: () => {} },
  createElement: () => ({ classList: { add: () => {} }, style: {}, dataset: {}, addEventListener: () => {} }),
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.Image = function(){};
globalThis.performance = { now: () => 0 };
globalThis.Audio = function(){};

// Modules loaded by the browser boot path (main.js + its direct imports).
// If any of these throws ReferenceError on import, the page won't load.
const BOOT_MODULES = [
  'js/main.js',
  'js/systems/sprite-atlas.js',
  'js/systems/tutorial.js',
  'js/systems/gamepad.js',
  'js/systems/save.js',
  'js/ui/keybinds.js',
  'js/ui/hud.js',
];

const referenceErrors = [];
const otherErrors = [];
const oks = [];

for (const rel of BOOT_MODULES) {
  const abs = resolve(PROJECT_ROOT, rel);
  try {
    await import('file://' + abs);
    oks.push(rel);
  } catch (e) {
    if (e instanceof ReferenceError) {
      referenceErrors.push({ module: rel, message: e.message });
    } else {
      const msg = (e.message || '').split('\n')[0];
      if (/window|document|navigator|Image|Audio|HTMLElement|HTMLCanvas|getContext|history|location/.test(msg)) {
        // Browser-only error, expected in Node (e.g. canvas.getContext)
        otherErrors.push({ module: rel, message: msg, expected: true });
      } else {
        otherErrors.push({ module: rel, message: msg, expected: false });
      }
    }
  }
}

// Export for run.js to consume.
export const result = {
  modules: BOOT_MODULES,
  oks,
  referenceErrors,
  otherErrors,
  summary: () => {
    for (const o of oks) console.log('  ' + o + ': OK');
    for (const e of referenceErrors) console.log('  ' + e.module + ': ReferenceError -> ' + e.message);
    for (const e of otherErrors) {
      const tag = e.expected ? 'browser-only (expected)' : 'other error';
      console.log('  ' + e.module + ': ' + tag + ': ' + e.message);
    }
    console.log('  ReferenceErrors: ' + referenceErrors.length + ' (any > 0 is a bug)');
    console.log('  Other errors: ' + otherErrors.length + ' (mostly expected)');
  },
};
export default result;
