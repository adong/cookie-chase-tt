/* Headless checks, run in Node by tools/check.js and in the page by game.check():
   - every maze: each cookie and milk can be reached from the start (and from both 2-player starts), the den gate is
     open and leads out into the maze, every tunnel has a partner on the other side, and there are no dead ends;
   - the wall watch: thousands of steps of random steering and raccoon chasing, and nobody ever stands in or moves
     into a hedge (each step checks every boy, raccoon and companion);
   - the tunnels: a boy and a raccoon walked through each side come out on the other;
   - the soak: the autopilot plays mazes through to the end;
   - sabotage: deliberately broken mazes and a cheating mover, to prove the checks can fail.
   Exposes CC.Check. */
(function () {
  'use strict';
  const CC = window.CC;
  const Z = CC.Maze;
  const E = CC.Engine;
  const { W, H, DIRS, idx, wrapX, at, walkable, denPass, bfs, COOKIE, MILK, TUNNEL } = Z;

  // ---------------------------------------------------------------- the mazes themselves
  function checkMaze(L) {
    const probs = [];
    if (L.rows.length !== H) probs.push(`has ${L.rows.length} rows, not ${H}`);
    L.rows.forEach((r, y) => r.length !== W && probs.push(`row ${y} is ${r.length} wide, not ${W}`));
    const cells = L.cells;
    for (const s of [L.start, ...L.starts]) {
      if (!walkable(at(cells, s.x, s.y))) {
        probs.push(`start ${s.x},${s.y} is not on a path`);
        continue;
      }
      const d = bfs(cells, s.x, s.y);
      for (let c = 0; c < W * H; c++) {
        if ((L.food[c] === COOKIE || L.food[c] === MILK) && d[c] < 0) probs.push(`${L.food[c] === COOKIE ? 'cookie' : 'milk'} at ${c % W},${(c / W) | 0} can't be reached from ${s.x},${s.y}`);
      }
      if (d[idx(L.exit.x, L.exit.y)] < 0) probs.push(`the den's way out at ${L.exit.x},${L.exit.y} can't be reached from ${s.x},${s.y}`);
    }
    // the den: every raccoon spot leads out through the gate
    for (const s of L.spots) {
      const d = bfs(cells, s.x, s.y, denPass);
      if (d[idx(L.exit.x, L.exit.y)] < 0) probs.push(`a raccoon at ${s.x},${s.y} can't get out of the den`);
    }
    if (at(cells, L.door.x, L.door.y) !== Z.DOOR) probs.push('no den gate');
    if (!walkable(at(cells, L.exit.x, L.exit.y))) probs.push('the den gate opens into a hedge');
    // tunnels: an open edge cell needs an open partner on the other side
    for (let y = 0; y < H; y++) {
      const a = at(cells, 0, y), b = at(cells, W - 1, y);
      if (walkable(a) !== walkable(b)) probs.push(`row ${y} has a tunnel on one side only`);
      if (walkable(a) && (a !== TUNNEL || b !== TUNNEL)) probs.push(`row ${y} opens at the edge without a tunnel`);
    }
    // no dead ends (a dead end is a trap with a raccoon behind you)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!walkable(at(cells, x, y))) continue;
        let n = 0;
        for (const [dx, dy] of DIRS) if (walkable(at(cells, x + dx, y + dy))) n++;
        if (n < 2 && !(x === L.exit.x && y === L.exit.y)) probs.push(`dead end at ${x},${y}`);
      }
    }
    let milk = 0;
    for (let c = 0; c < W * H; c++) if (L.food[c] === MILK) milk++;
    if (milk !== 4) probs.push(`${milk} milks, not 4`);
    if (L.cookies < 50) probs.push(`only ${L.cookies} cookies`);
    return probs;
  }

  // ---------------------------------------------------------------- the wall watch
  // Is anybody standing in, or walking into, a cell he may not be in?
  function watch(M) {
    const cells = M.L.cells;
    const bad = (who, e, pass) => {
      if (!(e.t >= 0 && e.t < 1) || e.cx < 0 || e.cx >= W || e.cy < 0 || e.cy >= H) return `${who} is off the grid (${e.cx},${e.cy} t ${e.t})`;
      if (!pass(at(cells, e.cx, e.cy))) return `${who} is inside a hedge at ${e.cx},${e.cy}`;
      if (e.t > 0) {
        const nx = e.cx + DIRS[e.dir][0], ny = e.cy + DIRS[e.dir][1];
        if (!pass(at(cells, nx, ny))) return `${who} is walking into a hedge at ${wrapX(nx)},${ny}`;
      }
      return null;
    };
    for (const p of M.players) {
      const r = bad(`player ${p.i}`, p, walkable);
      if (r) return r;
    }
    for (const c of M.coons) {
      const pass = c.state === 'roam' ? walkable : denPass; // only roaming raccoons must stay out of the den
      const r = bad(`raccoon ${c.name} (${c.state})`, c, pass);
      if (r) return r;
    }
    for (const b of M.buddies) {
      if (b.on && !walkable(at(cells, b.cx, b.cy))) return `the companion is inside a hedge at ${b.cx},${b.cy}`;
    }
    return null;
  }

  // Random steering (and random companion calls) for a while on every maze, watching every step.
  function walls({ seconds = 120, seeds = 2, two = false } = {}) {
    let steps = 0, wraps = 0;
    const fails = [];
    for (let n = 0; n < Z.count; n++) {
      for (let seed = 1; seed <= seeds; seed++) {
        for (const diff of ['easy', 'normal']) {
          const M = E.create({ n, diff, seed, heroes: two ? ['teddy', 'tommy'] : ['teddy'] });
          M.hearts = 999;
          const r = E.rng(seed * 7919 + n);
          const want = M.players.map(() => 0);
          for (let k = 0; k < seconds * 60 && M.state === 'play'; k++) {
            if (r() < 0.04) want.forEach((_, i) => (want[i] = (r() * 4) | 0));
            M.step(E.DT, want.map((d) => ({ dir: d, buddy: r() < 0.002 })));
            M.events.length = 0;
            steps++;
            const w = watch(M);
            if (w) {
              fails.push(`maze ${n + 1} ${diff} seed ${seed} at ${M.time.toFixed(2)} s: ${w}`);
              break;
            }
          }
          wraps += M.stats.wraps;
        }
      }
    }
    return { steps, wraps, fails };
  }

  // ---------------------------------------------------------------- the tunnels
  // Walk a boy, then a raccoon, out of each side of each tunnel and see them come out on the other side.
  function tunnels() {
    const fails = [];
    let tried = 0;
    for (let n = 0; n < Z.count; n++) {
      const L = Z.level(n);
      for (let y = 0; y < H; y++) {
        if (at(L.cells, 0, y) !== TUNNEL) continue;
        for (const [fromX, dir, toX] of [[2, 3, W - 3], [W - 3, 1, 2]]) {
          for (const who of ['boy', 'raccoon']) {
            tried++;
            const M = E.create({ n, diff: 'normal', seed: 3 });
            for (const c of M.coons) c.state = 'nap';
            const e = who === 'boy' ? M.players[0] : M.coons[0];
            Object.assign(e, { cx: fromX, cy: y, t: 0, dir, want: dir, state: who === 'boy' ? 'play' : 'roam', sleepy: false });
            let ok = false, jumped = false, lastX = fromX;
            for (let k = 0; k < 60 * 6; k++) {
              M.step(E.DT, who === 'boy' ? [{ dir }] : []);
              M.events.length = 0;
              const w = watch(M);
              if (w) {
                fails.push(`maze ${n + 1} row ${y} ${who}: ${w}`);
                break;
              }
              if (Math.abs(e.cx - lastX) > 1) jumped = true;
              lastX = e.cx;
              if (e.cy !== y) {
                fails.push(`maze ${n + 1} row ${y} ${who} left the tunnel row`);
                break;
              }
              if (jumped && e.cx === toX) {
                ok = true;
                break;
              }
            }
            if (!ok && !fails.length) fails.push(`maze ${n + 1} row ${y}: the ${who} going ${dir === 3 ? 'left' : 'right'} never came out the other side`);
          }
        }
      }
    }
    return { tried, fails };
  }

  // ---------------------------------------------------------------- the soak: the autopilot plays
  function soak({ n = 0, diff = 'easy', seed = 1, two = false, buddy = false, maxTime = 400 } = {}) {
    const M = E.create({ n, diff, seed, heroes: two ? ['teddy', 'tommy'] : ['teddy'], cpu: [true, true] });
    let left = M.cookiesLeft, lastT = 0, wall = null, result = 'time';
    while (M.time < maxTime) {
      const inputs = M.players.map((p, i) => ({ dir: CC.Brain.think(M, i), buddy: buddy && CC.Brain.wantsBuddy(M, i) }));
      M.step(E.DT, inputs);
      M.events.length = 0;
      wall = wall || watch(M);
      if (M.cookiesLeft < left) {
        left = M.cookiesLeft;
        lastT = M.time;
      }
      if (M.state === 'clear') {
        result = 'clear';
        break;
      }
      if (M.state === 'over') {
        result = 'over';
        break;
      }
      if (M.time - lastT > 45) {
        result = 'stuck';
        break;
      }
    }
    return {
      n, name: Z.MAZES[n].name, diff, seed, result, time: Math.round(M.time), left: M.cookiesLeft, hearts: M.hearts,
      score: M.score, wall, ...M.stats,
    };
  }

  // ---------------------------------------------------------------- sabotage: prove the checks can fail
  function broken(n, edit) {
    const def = JSON.parse(JSON.stringify(Z.MAZES[n]));
    edit(def.rows);
    return Z.parse(def, n);
  }
  const put = (rows, x, y, ch) => (rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1));
  function sabotage() {
    const out = [];
    const tryMaze = (name, L) => {
      const probs = checkMaze(L);
      out.push({ name, caught: probs.length > 0, probs });
    };
    // a cookie walled in by hedges on all four sides (sunny garden, top-left corridor)
    tryMaze('a cookie nobody can reach', broken(0, (r) => {
      put(r, 3, 1, '#');
      put(r, 5, 1, '#');
      put(r, 4, 2, '#');
    }));
    // the den gate bricked up
    tryMaze('the den gate is shut', broken(1, (r) => put(r, 10, 8, '=')));
    // a tunnel with a hedge at the far end
    tryMaze('a tunnel with no way out the other side', broken(2, (r) => put(r, 20, 9, '#')));
    // a dead end poked into a hedge
    tryMaze('a dead end', broken(3, (r) => put(r, 3, 2, '.')));
    // a mover that cheats: steps a boy into a hedge, which the wall watch must notice
    {
      const M = E.create({ n: 0, diff: 'easy', seed: 1 });
      M.step(E.DT, []);
      Object.assign(M.players[0], { cx: 0, cy: 0, t: 0 });
      const w = watch(M);
      out.push({ name: 'a boy pushed into a hedge', caught: !!w, probs: w ? [w] : [] });
    }
    // and one that walks a raccoon through the den fence
    {
      const M = E.create({ n: 0, diff: 'easy', seed: 1 });
      Object.assign(M.coons[0], { state: 'roam', cx: 7, cy: 7, t: 0.5, dir: 2 });
      const w = watch(M);
      out.push({ name: 'a raccoon walking through the den fence', caught: !!w, probs: w ? [w] : [] });
    }
    return out;
  }

  function checkAll() {
    const fails = [];
    for (let n = 0; n < Z.count; n++) {
      const probs = checkMaze(Z.level(n));
      if (probs.length) fails.push({ n: n + 1, name: Z.MAZES[n].name, probs });
    }
    return { mazes: Z.count, failed: fails.length, fails };
  }

  CC.Check = { checkMaze, checkAll, watch, walls, tunnels, soak, sabotage };
})();
