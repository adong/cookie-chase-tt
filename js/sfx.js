/* Game sounds, synthesised on top of Kit.sound.tone / hiss (so mute and volume are shared with the kit).
   Nothing is copied from any arcade game: a cookie is a soft crunch, the milk a glug, a bonk a boing. Exposes CC.sfx. */
(function () {
  'use strict';
  const S = () => window.Kit.sound;
  let crunch = 0;

  CC.sfx = {
    // a cookie: a little crunch, two notes taking turns so a row of cookies sounds like munching
    cookie() {
      crunch = (crunch + 1) % 2;
      S().tone({ type: 'triangle', f: crunch ? 620 : 520, to: crunch ? 480 : 400, dur: 0.06, vol: 0.07 });
      S().hiss({ f: 2600, to: 1400, q: 2, dur: 0.05, vol: 0.05 });
    },
    // the milk: glug glug glug, then the power-up
    milk() {
      [0, 0.11, 0.22].forEach((at, i) => S().tone({ type: 'sine', f: 300 - i * 30, to: 160 - i * 20, dur: 0.09, vol: 0.18, at }));
      S().powerup();
    },
    // the raccoons wake up again
    wake() { [660, 520].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.1, vol: 0.07, at: i * 0.1 })); },
    // bonking a sleepy raccoon: a boing and a whoosh off home
    bonk(n) {
      const up = 1 + Math.min(n || 0, 3) * 0.12;
      S().tone({ type: 'sine', f: 220 * up, to: 880 * up, dur: 0.16, vol: 0.2 });
      S().tone({ type: 'sine', f: 880 * up, to: 330 * up, dur: 0.2, vol: 0.1, at: 0.16 });
      S().hiss({ filter: 'bandpass', f: 800, to: 3000, q: 1.2, dur: 0.3, vol: 0.08, at: 0.1 });
    },
    home() { S().hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.25, vol: 0.06 }); },
    fruit() { [784, 988, 1175, 1568].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.12, vol: 0.1, at: i * 0.06 })); },
    fruitIn() { [1319, 1568].forEach((f, i) => S().tone({ type: 'sine', f, dur: 0.12, vol: 0.06, at: i * 0.08 })); },
    // getting tickled: a fast warbling giggle
    giggle() {
      for (let k = 0; k < 7; k++) S().tone({ type: 'sine', f: 900 + (k % 2) * 260 + Math.random() * 60, to: 760, dur: 0.07, vol: 0.12, at: k * 0.09 });
    },
    heart() {
      S().tone({ type: 'sine', f: 1000, to: 300, dur: 0.5, vol: 0.12 });
      S().tone({ type: 'sine', f: 200, to: 480, dur: 0.16, vol: 0.1, at: 0.5 });
    },
    pop() {
      S().tone({ type: 'sine', f: 400, to: 1200, dur: 0.12, vol: 0.14 });
      S().hiss({ f: 1500, to: 3500, dur: 0.18, vol: 0.06 });
    },
    // a brother gets his brother back on his feet: a high five
    rescue() {
      S().hiss({ filter: 'highpass', f: 2000, dur: 0.08, vol: 0.25 });
      [988, 1319, 1568].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.14, vol: 0.1, at: 0.06 + i * 0.07 }));
    },
    // the companion: a run-in fanfare, then STOP! like a big horn
    buddy() {
      [659, 784, 988].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.14, vol: 0.12, at: i * 0.07 }));
      S().hiss({ f: 1200, to: 3000, dur: 0.25, vol: 0.06 });
    },
    stop() {
      S().tone({ type: 'square', f: 392, dur: 0.16, vol: 0.06, lp: 1800 });
      S().tone({ type: 'square', f: 523, dur: 0.3, vol: 0.07, lp: 1800, at: 0.16 });
    },
    bye() { [988, 784, 659].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.12, vol: 0.08, at: i * 0.07 })); },
    treat() { [1047, 1319, 1568].forEach((f, i) => S().tone({ type: 'sine', f, dur: 0.12, vol: 0.1, at: i * 0.06 })); },
    munch() {
      for (let k = 0; k < 5; k++) {
        S().tone({ type: 'triangle', f: 560 - (k % 2) * 100, to: 420, dur: 0.06, vol: 0.08, at: k * 0.1 });
        S().hiss({ f: 2400, to: 1200, q: 2, dur: 0.05, vol: 0.05, at: k * 0.1 });
      }
    },
    swish() { S().swish(); },
    jump() { S().jump(); },
    click() { S().click(); },
    punch() { S().punch(); },
    go() {
      S().bump();
      [523, 659, 784, 1047].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.12, vol: 0.06, lp: 2600, at: i * 0.06 }));
    },
    ready() { [392, 523].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.18, vol: 0.06, lp: 2200, at: i * 0.14 })); },
    fanfare() {
      [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.65], [1047, 0.8]].forEach(([f, at]) => {
        S().tone({ type: 'square', f, dur: 0.22, vol: 0.06, lp: 2600, at });
        S().tone({ type: 'triangle', f: f / 2, dur: 0.25, vol: 0.1, at });
      });
    },
    sad() { [392, 349, 330, 262].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.25, vol: 0.09, at: i * 0.2 })); },
  };
})();
