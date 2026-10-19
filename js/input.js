/* Controls: the keyboard for one or two players, swipes anywhere on a touch screen, and optional round d-pads.
   P1: W A S D, T calls your brother.  P2: arrows, Enter calls your brother.  In 1 player both sets drive player 1.
   A turn is remembered until it can happen, so a kid can press early before a corner (the engine keeps it).
   Swipes: a finger that moves a little picks a way, and keeps steering as it moves on, without lifting. With two
   players on one iPad, the left half of the screen steers player 1 and the right half player 2.
   Exposes CC.Input. */
(function () {
  'use strict';
  const CC = window.CC;
  const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

  const KEYS = {
    KeyW: [0, UP], KeyD: [0, RIGHT], KeyS: [0, DOWN], KeyA: [0, LEFT], KeyT: [0, 'buddy'],
    ArrowUp: [1, UP], ArrowRight: [1, RIGHT], ArrowDown: [1, DOWN], ArrowLeft: [1, LEFT], Enter: [1, 'buddy'], NumpadEnter: [1, 'buddy'],
  };

  const sets = [{ held: [], press: -1, buddy: false }, { held: [], press: -1, buddy: false }];
  const touch = [{ pad: -1, swipe: -1, buddy: false }, { pad: -1, swipe: -1, buddy: false }];
  let two = false, swipeOn = false;
  const listeners = [];

  function key(code, down, repeat) {
    const m = KEYS[code];
    if (!m) return false;
    const [side, act] = m;
    const s = sets[side];
    if (act === 'buddy') {
      if (down && !repeat) s.buddy = true;
      return true;
    }
    s.held = s.held.filter((d) => d !== act);
    if (down) {
      s.held.push(act);
      if (!repeat) s.press = act;
    }
    return true;
  }

  // What player i asks for right now: { dir: -1 or 0..3, buddy }. Presses and swipes are latched until read.
  function read(i) {
    const out = { dir: -1, buddy: false };
    const srcs = two ? [i] : i === 0 ? [0, 1] : [];
    for (const k of srcs) {
      const s = sets[k];
      if (s.held.length) out.dir = s.held[s.held.length - 1];
      if (s.press >= 0) out.dir = s.press;
      if (s.buddy) out.buddy = true;
      s.press = -1;
      s.buddy = false;
    }
    const t = touch[i];
    if (t.pad >= 0) out.dir = t.pad;
    if (t.swipe >= 0) out.dir = t.swipe;
    if (t.buddy) out.buddy = true;
    t.swipe = -1;
    t.buddy = false;
    return out;
  }

  function clear() {
    for (const s of sets) {
      s.held = [];
      s.press = -1;
      s.buddy = false;
    }
    for (const t of touch) {
      t.pad = t.swipe = -1;
      t.buddy = false;
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!swipeOn) return; // only while playing; the menus have their own keys
    if (key(e.code, true, e.repeat) && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => key(e.code, false, false));
  window.addEventListener('blur', clear);

  // ---------------------------------------------------------------- swipes
  const fingers = new Map();
  const ignore = (el) => el && el.closest && el.closest('button, .pad, .screen:not(.hidden), #kit-help, [data-no-swipe]');
  const step = () => Math.max(14, Math.min(innerWidth, innerHeight) * 0.028);
  function dirOf(dx, dy) {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP;
  }
  function swiped(side, dir) {
    touch[side].swipe = dir;
    for (const f of listeners) f(side, dir);
  }
  addEventListener('pointerdown', (e) => {
    if (!swipeOn || ignore(e.target)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, side: two && e.clientX > innerWidth / 2 ? 1 : 0, moved: false });
  }, { passive: true });
  addEventListener('pointermove', (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < step()) return;
    swiped(f.side, dirOf(dx, dy));
    f.x = e.clientX;
    f.y = e.clientY;
    f.moved = true;
  }, { passive: true });
  const lift = (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    fingers.delete(e.pointerId);
    // a short quick flick that never reached the full step still counts
    const dx = e.clientX - f.x0, dy = e.clientY - f.y0;
    if (!f.moved && Math.max(Math.abs(dx), Math.abs(dy)) >= 7) swiped(f.side, dirOf(dx, dy));
  };
  addEventListener('pointerup', lift, { passive: true });
  addEventListener('pointercancel', (e) => fingers.delete(e.pointerId), { passive: true });

  // ---------------------------------------------------------------- the optional round d-pads
  const capture = (el, e) => {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no active pointer */ }
  };
  function bindPad(i, pad) {
    let finger = null;
    const zone = (e) => {
      const r = pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const dir = Math.hypot(dx, dy) > 0.2 ? dirOf(dx, dy) : -1;
      touch[i].pad = dir;
      pad.dataset.dir = ['up', 'right', 'down', 'left'][dir] || '';
    };
    const release = (e) => {
      if (e.pointerId !== finger) return;
      finger = null;
      touch[i].pad = -1;
      pad.dataset.dir = '';
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      finger = e.pointerId;
      capture(pad, e);
      zone(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === finger) zone(e);
    });
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
  }

  CC.Input = {
    read, clear, bindPad, KEYS,
    setTwoPlayer(on) { two = !!on; },
    // steering keys and swipes only count while a maze is being played
    setActive(on) {
      swipeOn = !!on;
      if (!on) {
        fingers.clear();
        clear();
      }
    },
    onSwipe(f) { listeners.push(f); },
  };
})();
