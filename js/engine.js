/* The game rules, as plain state stepped at a fixed rate. No Three.js in here: js/game.js only reads this state and
   turns the events into effects and sounds, and the headless checks (js/check.js, tools/check.js) run the same code.
   Everyone moves centre to centre along the paths: an entity stands in cell (cx, cy) and is t of the way (0..1)
   toward the next cell in direction dir. That makes walls impossible to cross, and the side tunnels just wrap x.
   Exposes CC.Engine. */
(function () {
  'use strict';
  const CC = window.CC;
  const Z = CC.Maze;
  const { W, H, DIRS, REV, idx, wrapX, at, walkable, denPass, COOKIE, MILK, NONE, TUNNEL } = Z;
  const TUNE = CC.TUNE, BUD = TUNE.buddy;
  const DT = 1 / 60;

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  // How fast and how long, for maze n (0-based) on a difficulty.
  function tuning(n, diff) {
    return {
      speed: TUNE.speed[diff] + TUNE.speedStep[diff] * n,
      coon: TUNE.coonSpeed[diff] + TUNE.coonStep[diff] * n,
      milk: Math.max(TUNE.milkMin[diff], TUNE.milk[diff] - TUNE.milkStep[diff] * n),
      release: TUNE.release[diff].map((t) => t * Math.max(0.6, 1 - n * 0.05)),
      wander: TUNE.wander[diff],
      modes: TUNE.modes[diff],
      fruitTime: TUNE.fruitTime[diff],
    };
  }

  // ---------------------------------------------------------------- a maze
  // cfg: { n, diff, heroes: [id] or [id, id], seed, score, hearts, level? (a parsed maze, for tests), cpu: [bool] }
  function create(cfg) {
    const L = cfg.level || Z.level(cfg.n);
    const diff = cfg.diff || 'easy';
    const heroes = cfg.heroes || ['teddy'];
    const two = heroes.length > 1;
    const M = {
      n: cfg.n || 0, diff, L, T: tuning(cfg.n || 0, diff), two,
      food: L.food.slice(), cookiesLeft: L.cookies, total: L.cookies, eaten: 0,
      players: [], coons: [], buddies: [],
      time: 0, state: 'play', stateT: 0, winner: -1,
      hearts: cfg.hearts ?? (two ? TUNE.coopHearts : TUNE.hearts)[diff], score: cfg.score || 0,
      events: [], rand: rng(cfg.seed || 1),
      sleepyT: 0, chain: 0, freezeT: 0, pauseT: 0, modeIdx: 0, modeT: 0, mode: 'scatter',
      fruit: null, fruitsShown: 0,
      stats: { caught: 0, bonks: 0, fruits: 0, milks: 0, calls: 0, munched: 0, rescues: 0, popbacks: 0, wraps: 0 },
    };
    heroes.forEach((id, i) => {
      const s = two ? L.starts[i] : L.start;
      M.players.push({
        i, id, cpu: !!(cfg.cpu && cfg.cpu[i]), sx: s.x, sy: s.y, cx: s.x, cy: s.y, t: 0, dir: -1, want: -1, face: 2,
        x: s.x, y: s.y, moving: false, state: 'play', st: 0, safe: 0, stuckT: 0, ate: 0,
      });
      M.buddies.push({ i, id: Kit.roster.buddyFor(id), on: false, t: 0, cx: s.x, cy: s.y, x: s.x, y: s.y, gave: false, munched: false, visits: 0 });
    });
    CC.COONS.forEach((def, k) => {
      const s = L.spots[k];
      M.coons.push({
        k, name: def.name, cx: s.x, cy: s.y, t: 0, dir: -1, x: s.x, y: s.y, moving: false,
        state: 'den', sleepy: false, releaseAt: M.T.release[k], st: 0, calm: 0,
      });
    });
    M.step = (dt, inputs) => step(M, dt, inputs);
    M.callBuddy = (i) => callBuddy(M, i);
    return M;
  }

  const emit = (M, type, data) => M.events.push(Object.assign({ type }, data));

  // ---------------------------------------------------------------- moving along the paths
  function open(M, x, y, d, pass) {
    const ny = y + DIRS[d][1];
    if (ny < 0 || ny >= H) return false;
    return pass(at(M.L.cells, x + DIRS[d][0], ny));
  }
  function place(e) {
    const d = e.dir >= 0 ? DIRS[e.dir] : [0, 0];
    e.x = e.cx + d[0] * e.t;
    e.y = e.cy + d[1] * e.t;
  }
  // The cell an entity counts as standing in: the nearer of the two centres.
  function cellOf(e) {
    if (e.t < 0.5 || e.dir < 0) return { x: e.cx, y: e.cy };
    return { x: wrapX(e.cx + DIRS[e.dir][0]), y: e.cy + DIRS[e.dir][1] };
  }
  function reverse(e) {
    if (e.dir < 0) return;
    if (e.t > 0) {
      e.cx = wrapX(e.cx + DIRS[e.dir][0]);
      e.cy += DIRS[e.dir][1];
      e.t = 1 - e.t;
    }
    e.dir = REV[e.dir];
  }
  // Walk `dist` cells. At each centre, decide(e) picks the way on (or -1 to stop), and arrive(e) runs on arrival.
  function travel(M, e, dist, pass, decide, arrive) {
    for (let guard = 0; dist > 1e-9 && guard < 6; guard++) {
      if (e.t === 0) {
        const d = decide(e);
        if (d < 0 || !open(M, e.cx, e.cy, d, pass(e))) {
          e.moving = false;
          break;
        }
        e.dir = d;
      }
      const s = Math.min(dist, 1 - e.t);
      e.t += s;
      dist -= s;
      e.moving = true;
      if (e.t >= 1 - 1e-9) {
        const nx = e.cx + DIRS[e.dir][0];
        if (nx < 0 || nx >= W) M.stats.wraps++;
        e.cx = wrapX(nx);
        e.cy += DIRS[e.dir][1];
        e.t = 0;
        if (arrive && arrive(e) === false) break;
      }
    }
    place(e);
  }
  const wrapDist = (ax, ay, bx, by) => {
    let dx = Math.abs(ax - bx);
    dx = Math.min(dx, W - dx);
    return Math.hypot(dx, ay - by);
  };

  // ---------------------------------------------------------------- the step
  function step(M, dt, inputs) {
    M.time += dt;
    M.stateT += dt;
    for (const p of M.players) p.st += dt;
    for (const c of M.coons) c.st += dt;
    if (M.state !== 'play') {
      stepBuddies(M, dt);
      return;
    }
    (inputs || []).forEach((inp, i) => {
      const p = M.players[i];
      if (!inp || !p) return;
      if (inp.dir >= 0 && inp.dir <= 3) p.want = inp.dir;
      if (inp.buddy) callBuddy(M, i);
    });
    // caught in 1 player: everyone holds still while the raccoon tickles
    if (M.pauseT > 0) {
      M.pauseT -= dt;
      if (M.pauseT <= 0) afterTickle(M);
      stepBuddies(M, dt);
      return;
    }
    M.freezeT = Math.max(0, M.freezeT - dt);
    if (M.sleepyT > 0) {
      M.sleepyT -= dt;
      if (M.sleepyT <= 0) {
        M.sleepyT = 0;
        for (const c of M.coons) c.sleepy = false;
        emit(M, 'wake');
      }
    } else stepMode(M, dt);

    for (const p of M.players) stepPlayer(M, p, dt);
    for (const c of M.coons) stepCoon(M, c, dt);
    touches(M);
    stepFruit(M, dt);
    stepBuddies(M, dt);
    if (M.cookiesLeft <= 0 && M.state === 'play') clear(M, M.lastEater ?? 0);
  }

  function stepMode(M, dt) {
    const modes = M.T.modes;
    M.modeT += dt;
    if (M.modeT < modes[M.modeIdx][1]) return;
    M.modeT = 0;
    M.modeIdx++;
    if (M.modeIdx >= modes.length) M.modeIdx = modes.length - 2; // the last two keep taking turns
    const mode = modes[M.modeIdx][0];
    if (mode !== M.mode) {
      M.mode = mode;
      for (const c of M.coons) if (c.state === 'roam') reverse(c);
    }
  }

  // ---------------------------------------------------------------- the boys
  const passWalk = () => walkable;
  function stepPlayer(M, p, dt) {
    p.safe = Math.max(0, p.safe - dt);
    if (p.state === 'stuck') {
      p.stuckT -= dt;
      if (p.stuckT <= 0) popBack(M, p);
      return;
    }
    if (p.state !== 'play') return;
    // turning back is instant, even between two cells
    if (p.want >= 0 && p.dir >= 0 && p.want === REV[p.dir] && p.t > 0) reverse(p);
    const decide = (e) => {
      const ok = (d) => d >= 0 && open(M, e.cx, e.cy, d, walkable);
      if (ok(e.want)) return e.want;
      if (ok(e.dir)) return e.dir;
      // round a bend by itself: at an L-shaped corner there is only one way on
      if (e.dir >= 0) {
        const side = [(e.dir + 1) % 4, (e.dir + 3) % 4].filter(ok);
        if (side.length === 1) return side[0];
      }
      return -1;
    };
    travel(M, p, M.T.speed * dt, passWalk, decide, null);
    if (p.dir >= 0) p.face = p.dir;
    const c = cellOf(p);
    eat(M, p, c.x, c.y);
  }

  function eat(M, p, x, y) {
    const c = idx(x, y);
    const f = M.food[c];
    if (f === NONE) return;
    M.food[c] = NONE;
    if (f === COOKIE) {
      M.cookiesLeft--;
      M.eaten++;
      p.ate++;
      M.lastEater = p.i;
      M.score += TUNE.points.cookie;
      emit(M, 'cookie', { x, y, i: p.i, left: M.cookiesLeft });
      maybeFruit(M);
    } else if (f === MILK) {
      M.score += TUNE.points.milk;
      M.sleepyT = M.T.milk;
      M.chain = 0;
      M.stats.milks++;
      for (const k of M.coons) {
        if (k.state === 'home' || k.state === 'nap') continue;
        k.sleepy = true;
        if (k.state === 'roam') reverse(k);
      }
      emit(M, 'milk', { x, y, i: p.i });
    }
  }

  // ---------------------------------------------------------------- the Crumb Raccoons
  const CORNERS = [{ x: W - 2, y: -3 }, { x: 1, y: -3 }, { x: W - 1, y: H + 2 }, { x: 0, y: H + 2 }];

  function targetOf(M, c) {
    const live = M.players.filter((p) => p.state === 'play');
    if (!live.length || M.mode === 'scatter' || c.calm > 0) return CORNERS[c.k];
    let p = live[0];
    for (const q of live) if (wrapDist(q.x, q.y, c.x, c.y) < wrapDist(p.x, p.y, c.x, c.y)) p = q;
    if (c.k === 1) {
      const d = DIRS[p.dir >= 0 ? p.dir : p.face];
      return { x: p.cx + d[0] * TUNE.sneakyAhead, y: p.cy + d[1] * TUNE.sneakyAhead };
    }
    if (c.k === 3 && wrapDist(p.x, p.y, c.x, c.y) < TUNE.pipShy) return CORNERS[3];
    return { x: p.x, y: p.y };
  }

  function coonSpeed(M, c) {
    if (c.state === 'home') return TUNE.homePace;
    let s = M.T.coon * TUNE.coonPace[c.k];
    if (c.state === 'leave') s = Math.min(s, 2.4);
    if (c.sleepy) s *= TUNE.sleepyPace;
    if (at(M.L.cells, Math.round(c.x), Math.round(c.y)) === TUNNEL) s *= TUNE.tunnelPace;
    return s;
  }

  function stepCoon(M, c, dt) {
    const L = M.L;
    c.calm = Math.max(0, c.calm - dt);
    if (c.state === 'den') {
      if (M.time >= c.releaseAt && M.freezeT <= 0) {
        c.state = 'leave';
        c.st = 0;
      }
      return;
    }
    if (c.state === 'tickle') {
      if (c.st > 1) {
        c.state = c.was || 'roam';
        c.calm = 3; // happy for a moment: off to his corner
        if (c.state === 'roam') reverse(c);
      }
      return;
    }
    if (c.state === 'nap') return;
    if (M.freezeT > 0 && c.state !== 'home') {
      c.moving = false;
      return;
    }
    const sp = coonSpeed(M, c) * dt;
    if (c.state === 'leave') {
      travel(M, c, sp, () => denPass, (e) => {
        if (e.cy === L.inside.y && e.cx !== L.inside.x) return e.cx < L.inside.x ? 1 : 3;
        return 0;
      }, (e) => {
        if (e.cx === L.exit.x && e.cy === L.exit.y) {
          e.state = 'roam';
          e.dir = e.k % 2 ? 3 : 1;
          return false;
        }
      });
      return;
    }
    if (c.state === 'home') {
      travel(M, c, sp, () => denPass, (e) => {
        if (e.cx === L.exit.x && (e.cy === L.exit.y || e.cy === L.door.y)) return 2;
        let best = -1, bd = 1e9;
        for (let d = 0; d < 4; d++) {
          if (!open(M, e.cx, e.cy, d, walkable)) continue;
          const v = L.homeDist[idx(wrapX(e.cx + DIRS[d][0]), e.cy + DIRS[d][1])];
          if (v >= 0 && v < bd) {
            bd = v;
            best = d;
          }
        }
        return best;
      }, (e) => {
        if (e.cx === L.inside.x && e.cy === L.inside.y) {
          e.state = 'den';
          e.sleepy = false;
          e.releaseAt = M.time + 1;
          emit(M, 'home', { k: e.k });
          return false;
        }
      });
      return;
    }
    // roaming the maze
    travel(M, c, sp, () => walkable, (e) => {
      const opts = [0, 3, 2, 1].filter((d) => d !== REV[e.dir] && open(M, e.cx, e.cy, d, walkable));
      if (!opts.length) return e.dir >= 0 ? REV[e.dir] : -1;
      if (opts.length === 1) return opts[0];
      const wobbly = e.k === 2 && M.rand() < 0.7;
      if (e.sleepy || wobbly || M.rand() < M.T.wander) return opts[(M.rand() * opts.length) | 0];
      const tg = targetOf(M, e);
      let best = opts[0], bd = Infinity;
      for (const d of opts) {
        const dd = (e.cx + DIRS[d][0] - tg.x) ** 2 + (e.cy + DIRS[d][1] - tg.y) ** 2;
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      return best;
    }, null);
  }

  // ---------------------------------------------------------------- bumping into each other
  function touches(M) {
    for (const p of M.players) {
      if (p.state !== 'play') continue;
      for (const c of M.coons) {
        if (c.state !== 'roam' && c.state !== 'leave') continue;
        if (wrapDist(p.x, p.y, c.x, c.y) >= TUNE.touch) continue;
        if (c.sleepy) bonk(M, p, c);
        else if (p.safe <= 0 && M.freezeT <= 0) {
          caught(M, p, c);
          break;
        }
      }
    }
    // 2 players: touch your tickled brother to get him back on his feet
    for (const p of M.players) {
      if (p.state !== 'stuck') continue;
      for (const q of M.players) {
        if (q !== p && q.state === 'play' && wrapDist(p.x, p.y, q.x, q.y) < TUNE.touch * 1.3) rescue(M, p, q.id);
      }
    }
  }

  function bonk(M, p, c) {
    const pts = TUNE.points.bonk * 2 ** Math.min(M.chain, 3);
    M.chain++;
    M.score += pts;
    M.stats.bonks++;
    c.state = 'home';
    c.sleepy = false;
    emit(M, 'bonk', { k: c.k, i: p.i, x: c.x, y: c.y, pts });
  }

  function caught(M, p, c) {
    M.stats.caught++;
    c.was = c.state;
    c.state = 'tickle';
    c.st = 0;
    p.st = 0;
    const cell = cellOf(p); // stand still in the nearer cell
    Object.assign(p, { cx: cell.x, cy: cell.y, t: 0, dir: -1, want: -1, moving: false });
    place(p);
    if (!M.two) {
      p.state = 'caught';
      M.pauseT = TUNE.tickle;
      emit(M, 'caught', { i: p.i, k: c.k, x: p.x, y: p.y });
      return;
    }
    p.state = 'stuck';
    p.stuckT = TUNE.stuck;
    emit(M, 'stuck', { i: p.i, k: c.k, x: p.x, y: p.y });
    // both tickled: nobody can help, so they pop back soon
    if (M.players.every((q) => q.state === 'stuck')) for (const q of M.players) q.stuckT = Math.min(q.stuckT, 1.4);
  }

  function rescue(M, p, by) {
    p.state = 'play';
    p.safe = TUNE.safe;
    p.st = 0;
    M.stats.rescues++;
    emit(M, 'rescue', { i: p.i, by, x: p.x, y: p.y });
  }

  function loseHeart(M) {
    M.hearts = Math.max(0, M.hearts - 1);
    emit(M, 'heart', { left: M.hearts });
    if (M.hearts <= 0) {
      M.state = 'over';
      M.stateT = 0;
      emit(M, 'over');
      return false;
    }
    return true;
  }

  function toStart(p) {
    Object.assign(p, { cx: p.sx, cy: p.sy, t: 0, dir: -1, want: -1, face: 2, state: 'play', st: 0, safe: TUNE.safe, moving: false });
    place(p);
  }

  function denAll(M) {
    for (const c of M.coons) {
      const s = M.L.spots[c.k];
      Object.assign(c, { cx: s.x, cy: s.y, t: 0, dir: -1, state: 'den', sleepy: false, calm: 0, releaseAt: M.time + M.T.release[c.k], moving: false });
      place(c);
    }
    M.sleepyT = 0;
    M.modeIdx = 0;
    M.modeT = 0;
    M.mode = M.T.modes[0][0];
  }

  // 1 player: after the giggles, lose a heart and start again from the start; the raccoons go home
  function afterTickle(M) {
    M.pauseT = 0;
    const p = M.players[0];
    if (!loseHeart(M)) return;
    toStart(p);
    denAll(M);
    emit(M, 'respawn', { i: 0 });
  }

  // 2 players: nobody came, so he pops back to the start
  function popBack(M, p) {
    M.stats.popbacks++;
    if (!loseHeart(M)) return;
    toStart(p);
    emit(M, 'respawn', { i: p.i });
    if (!M.players.some((q) => q !== p && q.state === 'play')) denAll(M);
  }

  // ---------------------------------------------------------------- fruit
  function maybeFruit(M) {
    const at = TUNE.fruitAt[M.fruitsShown];
    if (at === undefined || M.eaten < at * M.total) return;
    M.fruitsShown++;
    M.fruit = { x: M.L.fruit.x, y: M.L.fruit.y, t: M.T.fruitTime, emoji: CC.FRUITS[M.n % CC.FRUITS.length], pts: TUNE.points.fruit[M.n % 8] };
    emit(M, 'fruitIn', { x: M.fruit.x, y: M.fruit.y, emoji: M.fruit.emoji });
  }
  function stepFruit(M, dt) {
    const f = M.fruit;
    if (!f) return;
    f.t -= dt;
    for (const p of M.players) {
      if (p.state === 'play' && wrapDist(p.x, p.y, f.x, f.y) < TUNE.touch) {
        M.score += f.pts;
        M.stats.fruits++;
        emit(M, 'fruit', { i: p.i, x: f.x, y: f.y, emoji: f.emoji, pts: f.pts });
        M.fruit = null;
        return;
      }
    }
    if (f.t <= 0) {
      M.fruit = null;
      emit(M, 'fruitOut', { x: f.x, y: f.y });
    }
  }

  // ---------------------------------------------------------------- the companion
  // Call him any time, as often as you like: he pops in beside you (or starts over if he's already here), shouts
  // STOP! so the raccoons freeze, tosses you a treat, and munches the cookies around him. In 2 players he gets a
  // tickled brother back on his feet too.
  function callBuddy(M, i) {
    const p = M.players[i], b = M.buddies[i];
    if (!p || !b || M.state !== 'play' || p.state === 'caught') return false;
    if (!b.on) {
      const c = cellOf(p);
      let spot = c;
      // beside you, behind you if he can, and not on top of a raccoon
      const order = [REV[p.face], (p.face + 1) % 4, (p.face + 3) % 4, p.face];
      for (const d of order) {
        if (!open(M, c.x, c.y, d, walkable)) continue;
        const nx = wrapX(c.x + DIRS[d][0]), ny = c.y + DIRS[d][1];
        if (M.coons.some((k) => Math.round(k.x) === nx && Math.round(k.y) === ny)) continue;
        spot = { x: nx, y: ny };
        break;
      }
      Object.assign(b, { on: true, cx: spot.x, cy: spot.y, x: spot.x, y: spot.y });
      b.visits++;
      emit(M, 'buddyIn', { i, x: b.x, y: b.y });
    }
    b.t = 0;
    b.gave = b.munched = false;
    M.freezeT = Math.max(M.freezeT, BUD.freeze);
    M.stats.calls++;
    emit(M, 'stop', { i, x: b.x, y: b.y });
    if (p.state === 'stuck') rescue(M, p, b.id);
    return true;
  }

  function stepBuddies(M, dt) {
    for (const b of M.buddies) {
      if (!b.on) continue;
      b.t += dt;
      if (M.state !== 'play') continue;
      if (!b.gave && b.t >= BUD.give) {
        b.gave = true;
        emit(M, 'treat', { i: b.i });
      }
      if (!b.munched && b.t >= BUD.munch) {
        b.munched = true;
        munch(M, b);
      }
      if (b.t >= BUD.visit) {
        b.on = false;
        emit(M, 'buddyOut', { i: b.i, x: b.x, y: b.y });
      }
    }
  }

  function munch(M, b) {
    const dist = Z.bfs(M.L.cells, b.cx, b.cy);
    const got = [];
    for (let c = 0; c < W * H; c++) {
      if (M.food[c] !== COOKIE || dist[c] < 0 || dist[c] > BUD.munchReach) continue;
      M.food[c] = NONE;
      M.cookiesLeft--;
      M.eaten++;
      M.stats.munched++;
      M.score += TUNE.points.cookie;
      M.lastEater = b.i;
      got.push({ x: c % W, y: (c / W) | 0, d: dist[c] });
    }
    got.sort((a, b2) => a.d - b2.d);
    emit(M, 'munch', { i: b.i, x: b.cx, y: b.cy, cells: got, left: M.cookiesLeft });
    if (got.length) maybeFruit(M);
  }

  // ---------------------------------------------------------------- the end of a maze
  function clear(M, i) {
    M.state = 'clear';
    M.stateT = 0;
    M.winner = i;
    M.fruit = null;
    for (const p of M.players) {
      if (p.state === 'stuck' || p.state === 'caught') p.state = 'play';
      p.st = 0;
      p.state = 'win';
    }
    for (const c of M.coons) {
      c.state = 'nap';
      c.sleepy = false;
      c.st = 0;
    }
    emit(M, 'clear', { i });
  }

  CC.Engine = { DT, create, tuning, cellOf, open, wrapDist, rng, CORNERS };
})();
