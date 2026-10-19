/* The autopilot: plays a boy for the title-screen demo and for the headless soak (js/check.js).
   For every cell it works out the soonest an awake raccoon could get there (seconds, along the paths). A step is safe
   when the boy would get there clearly before that. It walks the shortest safe way to the nearest cookie (or milk,
   fruit, or sleepy raccoon), turns straight back if the cell ahead isn't safe, and otherwise runs to wherever the
   raccoons would take longest to reach. Exposes CC.Brain. */
(function () {
  'use strict';
  const CC = window.CC;
  const Z = CC.Maze;
  const { W, H, DIRS, REV, idx, wrapX, walkable, COOKIE, MILK } = Z;
  const TUNE = CC.TUNE;
  const SLACK = 0.5; // seconds of head start the boy wants over any raccoon

  function neighbours(cells, c, out) {
    out.length = 0;
    const x = c % W, y = (c / W) | 0;
    for (let d = 0; d < 4; d++) {
      const ny = y + DIRS[d][1];
      if (ny < 0 || ny >= H) continue;
      const n = idx(wrapX(x + DIRS[d][0]), ny);
      if (walkable(cells[n])) out.push([d, n]);
    }
    return out;
  }

  // The soonest (in seconds) any awake raccoon could reach each cell.
  function threat(M) {
    const soon = new Float32Array(W * H).fill(Infinity);
    const L = M.L;
    for (const c of M.coons) {
      if (c.sleepy || c.state === 'home' || c.state === 'nap') continue;
      let x = wrapX(Math.round(c.x)), y = Math.max(0, Math.min(H - 1, Math.round(c.y))), delay = 0;
      if (c.state === 'den') {
        x = L.exit.x;
        y = L.exit.y;
        delay = Math.max(0, c.releaseAt - M.time) + 1;
      } else if (c.state === 'leave') {
        x = L.exit.x;
        y = L.exit.y;
        delay = 0.3;
      } else if (c.state === 'tickle') delay = 0.6;
      delay += M.freezeT;
      const speed = M.T.coon * TUNE.coonPace[c.k];
      const d = Z.bfs(L.cells, x, y);
      for (let i = 0; i < W * H; i++) if (d[i] >= 0) soon[i] = Math.min(soon[i], delay + d[i] / speed);
    }
    return soon;
  }

  // Search outward from cell `from`, which he reaches at time t0 (seconds), never stepping into cell `banned` (the one
  // he'd be turning away from). Returns the way to the nearest safe goal (and when he'd get there), and, failing that,
  // the way to the safest place he can reach.
  function search(M, p, from, t0, soon, slack, step, banned = -1, horizon = Infinity) {
    const cells = M.L.cells;
    const ok = (c, t) => soon[c] > Math.min(t, horizon) + slack || t < p.safe;
    const seen = new Uint8Array(W * H), firstDir = new Int8Array(W * H).fill(-1), steps = new Int16Array(W * H);
    seen[from] = 1;
    if (banned >= 0) seen[banned] = 1;
    const q = [from];
    const nb = [];
    const fruit = M.fruit ? idx(M.fruit.x, M.fruit.y) : -1;
    const sleepy = new Set();
    for (const c of M.coons) if (c.sleepy && c.state === 'roam' && M.sleepyT > 1.5) sleepy.add(idx(wrapX(Math.round(c.x)), Math.round(c.y)));
    const goal = (n) => sleepy.has(n) || n === fruit || M.food[n] === COOKIE || M.food[n] === MILK;
    // the cell he's heading for has something on it already (he decides there, so any way on will do)
    if (banned >= 0 && goal(from) && ok(from, t0)) return { goal: -2, time: t0 };
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      for (const [d, n] of neighbours(cells, c, nb)) {
        if (seen[n]) continue;
        steps[n] = steps[c] + 1;
        if (!ok(n, t0 + steps[n] * step)) continue;
        seen[n] = 1;
        firstDir[n] = c === from ? d : firstDir[c];
        if (goal(n)) return { goal: firstDir[n], time: t0 + steps[n] * step };
        q.push(n);
      }
    }
    let best = -1, margin = -Infinity;
    for (let h = 1; h < q.length; h++) {
      const c = q[h], v = soon[c] - (t0 + steps[c] * step);
      if (v > margin) {
        margin = v;
        best = firstDir[c];
      }
    }
    if (best < 0) {
      for (const [d, n] of neighbours(cells, from, nb)) {
        if (soon[n] - t0 > margin) {
          margin = soon[n] - t0;
          best = d;
        }
      }
    }
    return { goal: -1, best, margin: Math.min(margin, soon[from] - t0) };
  }

  // Which way should player i go next? Returns a direction (0 up, 1 right, 2 down, 3 left) or -1.
  // Between two cells he can carry on to the cell ahead or turn back to the one behind, so both are weighed the same
  // way (the time to reach each, then the best path from there); weighing only one made him dither on the spot.
  function think(M, i) {
    const p = M.players[i];
    if (!p || p.state !== 'play') return -1;
    const soon = threat(M);
    const step = 1 / M.T.speed;
    // patience: after a long time without a cookie he takes a smaller head start
    if (p.ate !== p.brainAte) {
      p.brainAte = p.ate;
      p.brainT = M.time;
    }
    // (and after a really long time he just goes for it, like a kid would: being caught sends the raccoons home)
    const idle = M.time - (p.brainT ?? M.time);
    const slack = idle > 12 ? SLACK * 0.35 : SLACK;
    const horizon = idle > 25 ? 0.5 : Infinity; // only dodge raccoons that are right there
    const here = idx(p.cx, p.cy);
    if (!(p.dir >= 0 && p.t > 0)) {
      const r = search(M, p, here, 0, soon, slack, step, -1, horizon);
      return r.goal >= 0 ? r.goal : r.best;
    }
    const ahead = idx(wrapX(p.cx + DIRS[p.dir][0]), p.cy + DIRS[p.dir][1]);
    const on = search(M, p, ahead, (1 - p.t) * step, soon, slack, step, here, horizon);
    const back = search(M, p, here, p.t * step, soon, slack, step, ahead, horizon);
    const safeAhead = soon[ahead] > (1 - p.t) * step + slack || p.safe > 0;
    const safeBack = soon[here] > p.t * step + slack || p.safe > 0;
    if (!safeAhead && safeBack) return REV[p.dir]; // the cell he's walking into isn't safe: turn back now
    if (on.goal !== -1 && (back.goal === -1 || on.time <= back.time + 1e-6)) return on.goal >= 0 ? on.goal : p.dir;
    if (back.goal !== -1) return REV[p.dir];
    // nothing safe to eat either way: go whichever way leaves the most room
    return on.margin >= back.margin ? on.best : REV[p.dir];
  }

  // Should he call his brother? When an awake raccoon is about to reach him and he isn't blinking.
  function wantsBuddy(M, i) {
    const p = M.players[i];
    if (!p || p.state !== 'play' || p.safe > 0 || M.freezeT > 0 || M.buddies[i].on) return false;
    if (M.time - (p.brainT ?? M.time) > 15) return true; // stuck for a while: STOP! and dash
    return M.coons.some((c) => c.state === 'roam' && !c.sleepy && CC.Engine.wrapDist(c.x, c.y, p.x, p.y) < 1.6);
  }

  CC.Brain = { think, wantsBuddy, threat };
})();
