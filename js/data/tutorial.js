// Sprint 10 — Tutorial / Onboarding.
//
// A small linear (with one fork) step machine. Each step declares:
//   id          — unique key, persisted when complete
//   title       — short heading
//   body        — 1-2 sentence explanation
//   where       — 'top' | 'center' | 'bottom' | 'corner' (panel anchor)
//   trigger     — when this step is "done" (advances to the next)
//   requires    — optional prerequisite step id (otherwise just previous)
//
// The runner shows the current step until its trigger is true, then
// completes it and shows the next. The skip button on the panel calls
// Tutorial.skip(), which marks the rest as completed.
//
// The step list is intentionally short and discoverable. New players get
// 7 quick hints; veterans can press Escape / click Skip to never see them
// again. The skip state is persisted in the save blob + localStorage so
// it follows the account across devices.

import { ACTIONS } from './keybinds.js';

/**
 * @typedef {'top'|'center'|'bottom'|'corner'} PanelWhere
 *
 * @typedef {Object} TutorialStep
 * @property {string}    id
 * @property {string}    title
 * @property {string}    body
 * @property {PanelWhere} where
 * @property {(game: any) => boolean} trigger
 */

/**
 * @typedef {Object} TutorialState
 * @property {number}    version
 * @property {string[]}  completed
 * @property {boolean}   skipped
 */

// A few common trigger patterns get named so the steps below stay readable.
/** @type {Record<string, (game: any) => boolean>} */
const T = {
  // Player has moved at least `px` total from spawn.
  movedPx: (px) => (game) => !!(game.player) && (game.player._totalMoved || 0) >= px,
  // Player has attacked at least N times.
  attackedN: (n) => (game) => !!(game.player) && (game.player._attackCount || 0) >= n,
  // Player has picked up an item (game._tutorialFlag.pickedUp flipped by Game).
  pickedUp: () => (game) => !!(game._tutorialFlag && game._tutorialFlag.pickedUp),
  // Player has opened the bag.
  openedBag: () => (game) => !!(game._tutorialFlag && game._tutorialFlag.openedBag),
  // Player has cast a spell.
  castSpell: () => (game) => !!(game._tutorialFlag && game._tutorialFlag.castSpell),
  // Player has reached the city (just walked through the city portal from meadow).
  reachedCity: () => (game) => game.currentMap === 'city',
  // Player has talked to an NPC (game.tutorialFlag.spokeNpc).
  spokeNpc: () => (game) => !!(game._tutorialFlag && game._tutorialFlag.spokeNpc),
};

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Aetheria',
    body: 'A top-down action-RPG. This quick tour will teach you the basics — ' +
          'or press SKIP to head straight into the world.',
    where: 'center',
    trigger: (game) => !!(game._tutorialFlag && game._tutorialFlag.ackWelcome),
  },
  {
    id: 'move',
    title: 'Move',
    body: 'WASD or the left stick to move. Try walking a few steps.',
    where: 'bottom',
    trigger: T.movedPx(80),
  },
  {
    id: 'attack',
    title: 'Attack',
    body: 'Left-click or ✕/A to swing your weapon. Hit something!',
    where: 'bottom',
    trigger: T.attackedN(1),
  },
  {
    id: 'pickup',
    title: 'Loot',
    body: 'Walk over dropped gold and items to pick them up. ' +
          'The gold pile ahead is yours.',
    where: 'top',
    trigger: T.pickedUp(),
  },
  {
    id: 'open_bag',
    title: 'Inventory',
    body: 'Press B (or ◯/B) to open your bag. ' +
          'You can swap gear, compare items, and use consumables from here.',
    where: 'center',
    trigger: T.openedBag(),
  },
  {
    id: 'spell',
    title: 'Spells',
    body: 'Q / E cast the spell in each slot. ' +
          'You can re-bind them or buy new ones at the city mage.',
    where: 'center',
    trigger: T.castSpell(),
  },
  {
    id: 'portal',
    title: 'Explore',
    body: 'Walk into a portal to travel. The city hub to the north has ' +
          'shops, a forge, and a stash.',
    where: 'top',
    trigger: T.reachedCity(),
  },
];

/** @type {TutorialState} */
export const TUTORIAL_DEFAULT = Object.freeze({
  // If the user has never seen the tutorial (or never skipped it), run it
  // from the start. setVersion bumps if the step list ever changes
  // incompatibly.
  version: 1,
  completed: [],   // step ids the user has finished
  skipped: false,  // user pressed Skip
});

export const TUTORIAL_VERSION = TUTORIAL_DEFAULT.version;

// Build a human-readable hint for a given step's "what key?" by reading the
// live bindings. Falls back to the default key label if the action id isn't
// in ACTIONS (which would itself be a bug).
/**
 * @param {string|null|undefined} actionId
 * @param {Record<string, string>|null|undefined} bindings
 * @returns {string}
 */
export function tutorialKeyHint(actionId, bindings){
  if(!actionId) return '';
  const a = ACTIONS.find(x => x.id === actionId);
  if(!a) return '';
  const k = bindings && bindings[actionId] != null ? bindings[actionId] : a.defaultKey;
  // Pretty-print
  if(k === ' ') return 'SPACE';
  if(k === 'mouse1') return 'LMB';
  if(k === 'mouse2') return 'RMB';
  if(k === 'mouse3') return 'MMB';
  if(k.length === 1) return k.toUpperCase();
  return k.toUpperCase();
}
