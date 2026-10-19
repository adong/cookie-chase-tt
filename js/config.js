/* Every number worth tweaking, in one place. Classic script: adds to window.CC. */
(function () {
  'use strict';
  const CC = window.CC;

  CC.TUNE = {
    tile: 2, // world units per maze cell

    // the boys (cells per second); each maze adds a little
    speed: { easy: 4.1, normal: 4.6 },
    speedStep: { easy: 0.04, normal: 0.07 },

    // the Crumb Raccoons (cells per second)
    coonSpeed: { easy: 2.35, normal: 3.8 },
    coonStep: { easy: 0.07, normal: 0.1 },
    coonPace: [1, 0.97, 0.94, 0.92], // Bandit, Sneaky, Wobbles, Pip
    tunnelPace: 0.55, // raccoons slow down in the tunnels
    sleepyPace: 0.5, // after the milk
    homePace: 9, // a bonked raccoon zooming back to the den
    wander: { easy: 0.45, normal: 0.15 }, // chance a raccoon picks any way at a junction
    // when each raccoon leaves the den (seconds after the start, or after a respawn)
    release: { easy: [1.5, 5, 9, 13], normal: [0.5, 2.5, 5, 7.5] },
    // raccoons take turns: wander to their corner (scatter), then chase. The last number repeats.
    modes: {
      easy: [['scatter', 8], ['chase', 12], ['scatter', 8], ['chase', 12], ['scatter', 8], ['chase', 14]],
      normal: [['scatter', 7], ['chase', 20], ['scatter', 7], ['chase', 20], ['scatter', 5], ['chase', 1e9]],
    },
    pipShy: 6, // Pip runs off when he gets this close (cells)
    sneakyAhead: 4, // Sneaky aims this many cells ahead of you

    // the milk
    milk: { easy: 10, normal: 7 },
    milkStep: { easy: 0.3, normal: 0.45 },
    milkMin: { easy: 7, normal: 3.5 },
    milkBlink: 2, // the raccoons blink for the last seconds

    // hearts: 1 player, and the shared pool in 2 players
    hearts: { easy: 5, normal: 3 },
    coopHearts: { easy: 6, normal: 4 },
    tickle: 1.6, // seconds of giggling when caught (1 player)
    stuck: 7, // 2 players: seconds a tickled brother waits to be rescued before he pops back to the start
    safe: 2.2, // seconds of blinking after popping back or being rescued
    touch: 0.62, // how close (cells) counts as touching

    // scores
    points: { cookie: 10, milk: 50, bonk: 200, fruit: [100, 200, 300, 500, 700, 1000, 1500, 2000] },
    fruitAt: [0.3, 0.7], // a fruit appears when this share of the cookies is eaten
    fruitTime: { easy: 14, normal: 10 },

    // the companion (the other brother)
    buddy: {
      visit: 4.6, // seconds he stays
      freeze: 3, // STOP! the raccoons freeze this long
      give: 1.4, // when he tosses the treat
      munch: 1.9, // when he munches the cookies around him
      munchReach: 2, // steps along the paths
      bye: 4.0, // his goodbye move
    },
  };

  CC.FRUITS = ['🍓', '🍒', '🍎', '🍊', '🍇', '🍐', '🍑', '🍍'];

  // The raccoons: names and personalities are this game's own.
  CC.COONS = [
    { name: 'BANDIT', scarf: '#3fbf5a', does: 'follows you' },
    { name: 'SNEAKY', scarf: '#ffd23f', does: 'runs to where you are going' },
    { name: 'WOBBLES', scarf: '#a46bff', does: 'goes any old way' },
    { name: 'PIP', scarf: '#f4f1e8', does: 'is shy and runs off when he gets close' },
  ];

  CC.HEROES = ['teddy', 'tommy'];
})();
