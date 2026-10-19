/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: CC.TITLE,
  cols: ['Player 1', 'Player 2'],
  keys: [
    ['move', 'W A S D', '↑ ← ↓ →'],
    ['call your brother', 'T', 'Enter'],
    ['pause · sound', 'P or Esc · M', ''],
  ],
  note: 'In 1 player both sets of keys work. Press a way early and he turns at the next corner.',
  touch: "Swipe anywhere to steer (two players: left half and right half), and tap your brother's face to call him.",
  // a little higher than the kit's default, so on a phone held sideways the A文 button clears player 1's d-pad
  button: { top: 'calc(50% - 72px)', left: 'max(10px, env(safe-area-inset-left))' },
});
Kit.lang.setup({ button: { top: 'calc(50% - 24px)', left: 'max(10px, env(safe-area-inset-left))' } });
