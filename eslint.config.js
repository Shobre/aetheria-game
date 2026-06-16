import globals from "globals";

export default [
  // Ignore generated + vendor + tests
  {
    ignores: [
      "node_modules/**",
      "tests/**",
      "assets/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "*.min.js",
    ],
  },
  // Apply to the project's own browser JS
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        // WebAudio and Canvas 2D extensions not in `globals.browser`:
        AudioContext: "readonly",
        OfflineAudioContext: "readonly",
        // Hermes/Test API surface we use in tests/_smoke_modules.mjs is
        // not in this project; nothing else needs Node globals here.
      },
    },
    rules: {
      // The headline rule: any reference to an identifier that is not
      // declared in scope, not imported, and not a known global → fail.
      // This is what would have caught all 5 of the recent browser
      // ReferenceErrors:
      //   1. getKeybindOverrides at main.js:145 (top-level missing import)
      //   2. input at game.js:111 (in-method missing this.X — but no-undef
      //      catches `input` itself if it's not in scope, which it isn't)
      //   3. cam at game.js:437 (in-method missing local alias)
      //   4. p at hud.js:339 (in-method missing local alias)
      //   5. resolveEquip at game.js:483 (module-scope missing import)
      "no-undef": "error",
    },
  },
];
