/* The eight hand-made mazes, each with its garden theme, and the grid helpers everyone shares.
   Legend: # hedge   = the den's fence   . cookie   o milk   (space) path with nothing on it   t tunnel (wraps around)
           D inside the den   - the den's gate (only raccoons pass)   P where the boys start (2 players: one cell each side)
   Grid y grows toward the camera. Every maze is 21 x 19 and mirrored left-right; tools/check.js proves each one
   can be cleared (every cookie reachable, the den gate open, no dead ends). Exposes CC.Maze. */
(function () {
  'use strict';
  const CC = window.CC;
  const W = 21, H = 19;
  const WALL = 0, PATH = 1, TUNNEL = 2, DEN = 3, DOOR = 4, FENCE = 5;
  const NONE = 0, COOKIE = 1, MILK = 2;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down (toward the camera), left
  const REV = [2, 3, 0, 1];

  const MAZES = [
    {
      id: 'sunny', name: 'SUNNY GARDEN',
      theme: { sky: '#9fd8ff', ground: '#8fd36a', path: '#f3e2b3', hedge: '#3f9d48', deco: 'flowers', bloom: ['#ff7eb6', '#ffe066', '#ffffff'] },
      rows: [
        '#####################',
        '#o........#........o#',
        '#.##.####.#.####.##.#',
        '#...................#',
        '#.##.#.#######.#.##.#',
        '#....#.........#....#',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.##.#####.##.####',
        '#.........P.........#',
        '#.##.####.#.####.##.#',
        '#o##.####.#.####.##o#',
        '#.##.####.#.####.##.#',
        '#...................#',
        '#####################',
      ],
    },
    {
      id: 'orchard', name: 'APPLE ORCHARD',
      theme: { sky: '#a8dcff', ground: '#7cc65a', path: '#ecd9aa', hedge: '#2f8a45', deco: 'apples', bloom: ['#ff4b4b', '#ff6a3d', '#9be15d'] },
      rows: [
        '#####################',
        '#o.................o#',
        '#.#.#.#.#.#.#.#.#.#.#',
        '#...................#',
        '#.#.#.#.#.#.#.#.#.#.#',
        '#...................#',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.##.#####.##.####',
        '#.........P.........#',
        '#.#.#.#.#.#.#.#.#.#.#',
        '#o.................o#',
        '#.#.#.#.#.#.#.#.#.#.#',
        '#...................#',
        '#####################',
      ],
    },
    {
      id: 'carrot', name: 'CARROT ROWS',
      theme: { sky: '#b4e3ff', ground: '#a3cc66', path: '#e8cb98', hedge: '#4caf50', deco: 'carrots', bloom: ['#ff8a1f', '#ffa13d', '#ffffff'] },
      rows: [
        '#####################',
        '#o.................o#',
        '#.####.#######.####.#',
        '#....#.........#....#',
        '#.##.#.##.#.##.#.##.#',
        '#...................#',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.##.#####.##.####',
        '#.........P.........#',
        '#.##.##.##.##.##.##.#',
        '#o.................o#',
        '#.#.####.###.####.#.#',
        '#...................#',
        '#####################',
      ],
    },
    {
      id: 'pumpkin', name: 'PUMPKIN PATCH',
      theme: { sky: '#ffd9a8', ground: '#c4b664', path: '#f2d9a6', hedge: '#6c9a3a', deco: 'pumpkins', bloom: ['#ff8a1f', '#ffb347', '#e05a00'] },
      rows: [
        '#####################',
        '#o.................o#',
        '#.###.###.#.###.###.#',
        '#.###.###.#.###.###.#',
        '#.###.###.#.###.###.#',
        '#...................#',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.#.#######.#.####',
        '#o........P........o#',
        '#.###.###.#.###.###.#',
        '#.###.###.#.###.###.#',
        '#.###.###.#.###.###.#',
        '#...................#',
        '#####################',
      ],
    },
    {
      id: 'strawberry', name: 'STRAWBERRY FIELD',
      theme: { sky: '#ffd6e8', ground: '#93d676', path: '#fbe3c8', hedge: '#3aa45a', deco: 'berries', bloom: ['#ff3d5a', '#ffffff', '#ff7e9b'] },
      rows: [
        '#####################',
        '#o........#........o#',
        '#.##.#.##.#.##.#.##.#',
        '#....#.........#....#',
        '##.#.###.###.###.#.##',
        '##.................##',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.#.#######.#.####',
        '#o...#....P....#...o#',
        '#.#.##.##.#.##.##.#.#',
        '#.#...............#.#',
        '#.####.#######.####.#',
        '#...................#',
        '#####################',
      ],
    },
    {
      id: 'sunflower', name: 'SUNFLOWER LANE',
      theme: { sky: '#bfe8ff', ground: '#b5dc6c', path: '#f6e7b5', hedge: '#5aa63c', deco: 'sunflowers', bloom: ['#ffd400', '#ffb800', '#7a4a1e'] },
      rows: [
        '#####################',
        '#o..##....#....##..o#',
        '#.#.##.##.#.##.##.#.#',
        '#.#...............#.#',
        '#.#.##.#######.##.#.#',
        '#....#.........#....#',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.##.#####.##.####',
        '#....#....P....#....#',
        '#.##.#.##.#.##.#.##.#',
        '#o.#.............#.o#',
        '##.#.####.#.####.#.##',
        '##.................##',
        '#####################',
      ],
    },
    {
      id: 'picnic', name: 'PICNIC PARK',
      theme: { sky: '#a6e1ff', ground: '#86cf86', path: '#fde9cc', hedge: '#41a35b', deco: 'picnic', bloom: ['#ff4b5c', '#ffffff', '#3d8bff'] },
      rows: [
        '#####################',
        '#o.....#.....#.....o#',
        '#.####.#.###.#.####.#',
        '#.##...#.....#...##.#',
        '#.##.#.##.#.##.#.##.#',
        '#....#.........#....#',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.##.#####.##.####',
        '##o..#....P....#..o##',
        '##.#.#.##.#.##.#.#.##',
        '#..#.............#..#',
        '#.##.##.#####.##.##.#',
        '#...................#',
        '#####################',
      ],
    },
    {
      id: 'moonlight', name: 'MOONLIGHT GARDEN',
      theme: { sky: '#1d2456', ground: '#2e5b4b', path: '#9a9cc8', hedge: '#1f6b4c', deco: 'moon', bloom: ['#fff3a0', '#b6f0ff', '#ffffff'], night: true },
      rows: [
        '#####################',
        '#o..#...........#..o#',
        '#.#.#.####.####.#.#.#',
        '#.#...#.......#...#.#',
        '#.###.#.#####.#.###.#',
        '#.....#.......#.....#',
        '####.##.#####.##.####',
        '####.#         #.####',
        '####.# ===-=== #.####',
        'tttt.  =DDDDD=  .tttt',
        '####.# ======= #.####',
        '####.#         #.####',
        '####.##.#####.##.####',
        '#o...#....P....#...o#',
        '#.#.##.##.#.##.##.#.#',
        '#.#..#....#....#..#.#',
        '#.##.####.#.####.##.#',
        '#...................#',
        '#####################',
      ],
    },
  ];

  const idx = (x, y) => y * W + x;
  const wrapX = (x) => ((x % W) + W) % W;
  const walkable = (t) => t === PATH || t === TUNNEL;
  const denPass = (t) => t === PATH || t === TUNNEL || t === DEN || t === DOOR;
  function at(cells, x, y) {
    if (y < 0 || y >= H) return WALL;
    return cells[idx(wrapX(x), y)];
  }

  // Breadth-first distances (in steps) from one cell over the cells pass() allows; -1 = can't get there.
  function bfs(cells, sx, sy, pass = walkable) {
    const dist = new Int16Array(W * H).fill(-1);
    const q = [idx(sx, sy)];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        const n = idx(wrapX(x + dx), ny);
        if (dist[n] >= 0 || !pass(cells[n])) continue;
        dist[n] = dist[c] + 1;
        q.push(n);
      }
    }
    return dist;
  }

  // Turn a maze's rows into a level: cell types, food, starts, the den, and the way home from anywhere.
  function parse(def, n) {
    const rows = def.rows;
    const cells = new Uint8Array(W * H), food = new Uint8Array(W * H);
    const den = [];
    let start = null, door = null;
    rows.forEach((row, y) => {
      for (let x = 0; x < W; x++) {
        const ch = row[x] || '#';
        const c = idx(x, y);
        cells[c] = { '#': WALL, '=': FENCE, t: TUNNEL, D: DEN, '-': DOOR }[ch] ?? PATH;
        if (ch === '.') food[c] = COOKIE;
        if (ch === 'o') food[c] = MILK;
        if (ch === 'D') den.push({ x, y });
        if (ch === '-') door = { x, y };
        if (ch === 'P') start = { x, y };
      }
    });
    door = door || { x: (W - 1) / 2, y: 8 };
    const exit = { x: door.x, y: door.y - 1 }; // the cell just outside the gate
    const inside = { x: door.x, y: door.y + 1 }; // the cell just inside it
    start = start || { x: (W - 1) / 2, y: 13 };
    const side = (dx) => (walkable(at(cells, start.x + dx, start.y)) ? { x: start.x + dx, y: start.y } : { x: start.x, y: start.y });
    // the raccoons' spots in the den: the middle one leaves first
    const byMid = den.slice().sort((a, b) => Math.abs(a.x - inside.x) - Math.abs(b.x - inside.x) || a.x - b.x);
    const spots = [0, 1, 2, 3].map((k) => byMid[k] || inside);
    let cookies = 0;
    for (let c = 0; c < W * H; c++) if (food[c] === COOKIE) cookies++;
    return {
      n, id: def.id, name: def.name, theme: def.theme, rows,
      cells, food, cookies, start, starts: [side(-1), side(1)], door, exit, inside, spots,
      fruit: { x: exit.x, y: inside.y + 2 }, // on the path just below the den
      homeDist: bfs(cells, exit.x, exit.y),
    };
  }

  const cache = {};
  CC.Maze = {
    W, H, WALL, PATH, TUNNEL, DEN, DOOR, FENCE, NONE, COOKIE, MILK, DIRS, REV, MAZES,
    count: MAZES.length,
    idx, wrapX, at, walkable, denPass, bfs, parse,
    level: (n) => cache[n] || (cache[n] = parse(MAZES[n], n)),
  };
})();
