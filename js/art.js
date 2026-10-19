/* Everything you see that isn't a boy: the garden maze for each theme (sandy paths, leafy hedges, the raccoons' den
   with its fence and gate, tunnel arches, garden things around it), the cookies, the milk, the fruit, the Crumb
   Raccoons themselves, and the effects (puffs, stars, crumbs, confetti, comic words).
   All textures are painted on canvases; no image files. Exposes CC.Art. */
(function () {
  'use strict';
  const CC = window.CC;
  const T = THREE;
  const gfx = Kit.gfx;
  const Z = CC.Maze;
  const { W, H, idx, at, walkable } = Z;
  const TILE = CC.TUNE.tile;
  const wx = (x) => (x - (W - 1) / 2) * TILE;
  const wz = (y) => (y - (H - 1) / 2) * TILE;

  function lcg(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const cache = {};
  const once = (key, make) => cache[key] || (cache[key] = make());
  const geo = (key, make) => once('g:' + key, make);

  // ---------------------------------------------------------------- the floor: grass, sandy paths, the den
  function floorTexture(L) {
    const th = L.theme;
    const S = 48, pad = 2; // two cells of lawn around the maze
    const cw = (W + pad * 2) * S, ch = (H + pad * 2) * S;
    const [c, g] = gfx.makeCanvas(cw, ch);
    const r = lcg(L.n * 31 + 5);
    const ox = pad * S, oy = pad * S;
    g.fillStyle = th.ground;
    g.fillRect(0, 0, cw, ch);
    // lawn stripes and tufts
    for (let y = 0; y < H + pad * 2; y++) {
      g.fillStyle = gfx.shade(th.ground, y % 2 ? 0.05 : -0.03);
      g.fillRect(0, y * S, cw, S);
    }
    g.strokeStyle = gfx.shade(th.ground, -0.2);
    g.lineWidth = 2;
    for (let k = 0; k < 900; k++) {
      const x = r() * cw, y = r() * ch;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 4, y - 5 - r() * 4);
      g.stroke();
    }
    const open = (x, y) => {
      const t = at(L.cells, x, y);
      return walkable(t) || t === Z.DEN || t === Z.DOOR;
    };
    const cellPath = (x, y, w, col) => {
      g.fillStyle = col;
      const cx = ox + x * S + S / 2, cy = oy + y * S + S / 2;
      gfx.roundRect(g, cx - w / 2, cy - w / 2, w, w, w * 0.32);
      g.fill();
      if (x + 1 < W && open(x + 1, y)) g.fillRect(cx, cy - w / 2, S, w);
      if (y + 1 < H && open(x, y + 1)) g.fillRect(cx - w / 2, cy, w, S);
      // the tunnels run off the edge of the map
      if (at(L.cells, x, y) === Z.TUNNEL && (x === 0 || x === W - 1)) g.fillRect(x === 0 ? 0 : cx, cy - w / 2, ox + S, w);
    };
    const each = (fn) => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open(x, y)) fn(x, y);
    };
    each((x, y) => cellPath(x, y, S * 0.96, gfx.shade(th.path, -0.22))); // the path's darker edge
    each((x, y) => cellPath(x, y, S * 0.82, th.path));
    // pebbles
    each((x, y) => {
      for (let k = 0; k < 3; k++) {
        g.fillStyle = gfx.shade(th.path, r() < 0.5 ? -0.12 : 0.1);
        g.beginPath();
        g.arc(ox + x * S + 8 + r() * (S - 16), oy + y * S + 8 + r() * (S - 16), 1.5 + r() * 2, 0, Math.PI * 2);
        g.fill();
      }
    });
    // the den: warm wooden boards
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = at(L.cells, x, y);
        if (t !== Z.DEN && t !== Z.DOOR) continue;
        const px = ox + x * S, py = oy + y * S;
        g.fillStyle = '#c98f55';
        g.fillRect(px - 1, py - 1, S + 2, S + 2);
        g.strokeStyle = '#9b6434';
        g.lineWidth = 2;
        for (let k = 0; k <= 3; k++) {
          g.beginPath();
          g.moveTo(px, py + (k * S) / 3);
          g.lineTo(px + S, py + (k * S) / 3);
          g.stroke();
        }
      }
    }
    // a soft shadow line along the bottom of every hedge, so the hedges sit on the ground
    g.fillStyle = 'rgba(20,40,10,0.18)';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = at(L.cells, x, y);
        if ((t === Z.WALL || t === Z.FENCE) && y + 1 < H && open(x, y + 1)) g.fillRect(ox + x * S, oy + (y + 1) * S, S, 5);
      }
    }
    const tex = gfx.toTexture(c);
    tex.anisotropy = 4;
    return { tex, w: (W + pad * 2) * TILE, h: (H + pad * 2) * TILE };
  }

  function hedgeTexture(th, top) {
    return once(`hedge-${th.hedge}-${top}`, () => {
      const S = 128;
      const [c, g] = gfx.makeCanvas(S, S);
      const r = lcg(top ? 11 : 3);
      g.fillStyle = top ? gfx.shade(th.hedge, 0.12) : th.hedge;
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 140; k++) {
        const x = r() * S, y = r() * S, rr = 5 + r() * 9;
        g.fillStyle = gfx.shade(th.hedge, (top ? 0.1 : -0.05) + (r() - 0.5) * 0.35);
        g.beginPath();
        g.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      for (let k = 0; k < 40; k++) {
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.arc(r() * S, r() * S, 1.5 + r() * 2, 0, Math.PI * 2);
        g.fill();
      }
      if (!top) {
        const gr = g.createLinearGradient(0, 0, 0, S);
        gr.addColorStop(0, 'rgba(255,255,255,0.08)');
        gr.addColorStop(1, 'rgba(0,30,0,0.35)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
      }
      return gfx.toTexture(c);
    });
  }

  function woodTexture() {
    return once('wood', () => {
      const [c, g] = gfx.makeCanvas(64, 64);
      g.fillStyle = '#e8b97a';
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = '#b47b42';
      g.lineWidth = 3;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(k * 16 + 1, 0);
        g.lineTo(k * 16 + 1, 64);
        g.stroke();
      }
      return gfx.toTexture(c);
    });
  }

  // ---------------------------------------------------------------- the maze
  // Returns { group, dispose() }.
  function buildMaze(L) {
    const th = L.theme;
    const group = new T.Group();
    const r = lcg(L.n * 97 + 1);
    const disposables = [];

    // the ground: a big lawn, and the painted maze floor on it
    const lawn = new T.Mesh(geo('lawn', () => new T.PlaneGeometry(400, 400)), new T.MeshStandardMaterial({ color: gfx.shade(th.ground, -0.08), roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.02;
    lawn.receiveShadow = true;
    group.add(lawn);
    const f = floorTexture(L);
    const floorMat = new T.MeshStandardMaterial({ map: f.tex, roughness: 0.95 });
    const floor = new T.Mesh(new T.PlaneGeometry(f.w, f.h), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);
    disposables.push(floor.geometry, floorMat, f.tex, lawn.material);

    // hedges: one instanced box per hedge cell
    const walls = [], fences = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = at(L.cells, x, y);
        if (t === Z.WALL) walls.push([x, y]);
        if (t === Z.FENCE) fences.push([x, y]);
      }
    }
    const HH = 1.15;
    const side = new T.MeshStandardMaterial({ map: hedgeTexture(th, false), roughness: 0.95 });
    const top = new T.MeshStandardMaterial({ map: hedgeTexture(th, true), roughness: 0.9 });
    if (th.night) {
      side.color.set('#9fb4d8');
      top.color.set('#b6c8e8');
    }
    const box = geo('hedge', () => new T.BoxGeometry(TILE, HH, TILE));
    const hedges = new T.InstancedMesh(box, [side, side, top, side, side, side], walls.length);
    const m4 = new T.Matrix4();
    walls.forEach(([x, y], k) => {
      m4.makeTranslation(wx(x), HH / 2, wz(y));
      hedges.setMatrixAt(k, m4);
    });
    hedges.castShadow = true;
    hedges.receiveShadow = true;
    group.add(hedges);
    disposables.push(side, top);

    // blooms on top of the hedges: little round flowers or fruit, in the theme's colours
    const blooms = [];
    for (const [x, y] of walls) {
      if (r() < 0.45) blooms.push([wx(x) + (r() - 0.5) * 1.4, HH + 0.06, wz(y) + (r() - 0.5) * 1.4, gfx.pick(th.bloom), 0.11 + r() * 0.08]);
    }
    const bloomMesh = new T.InstancedMesh(geo('bloom', () => new T.SphereGeometry(1, 10, 8)), new T.MeshStandardMaterial({ roughness: 0.6, emissive: th.night ? '#ffffff' : '#000000', emissiveIntensity: th.night ? 0.25 : 0 }), blooms.length);
    const col = new T.Color();
    blooms.forEach(([x, y, z, c, s], k) => {
      m4.makeScale(s, s * 0.8, s);
      m4.setPosition(x, y, z);
      bloomMesh.setMatrixAt(k, m4);
      bloomMesh.setColorAt(k, col.set(c));
    });
    group.add(bloomMesh);
    disposables.push(bloomMesh.material);

    // a few garden things standing on the hedges (carrots, pumpkins, apples...)
    const DECO = { flowers: '🌷', apples: '🍎', carrots: '🥕', pumpkins: '🎃', berries: '🍓', sunflowers: '🌻', picnic: '🧺', moon: '🍄' };
    const deco = DECO[th.deco] || '🌷';
    const decoMat = new T.SpriteMaterial({ map: gfx.emojiTexture(deco) });
    disposables.push(decoMat);
    const inner = walls.filter(([x, y]) => x > 0 && x < W - 1 && y > 0 && y < H - 1);
    for (let k = 0; k < 14 && inner.length; k++) {
      const [x, y] = inner.splice((r() * inner.length) | 0, 1)[0];
      const s = new T.Sprite(decoMat);
      s.position.set(wx(x), HH + 0.5, wz(y));
      s.scale.setScalar(1.05);
      group.add(s);
    }

    // the den's fence and gate
    const fenceMat = new T.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 });
    const fenceMesh = new T.InstancedMesh(geo('fence', () => new T.BoxGeometry(TILE, 0.85, 0.42)), fenceMat, fences.length);
    fences.forEach(([x, y], k) => {
      // fence boards sit along the den's edge, not in the middle of the cell
      const inDen = (dx, dy) => [Z.DEN, Z.DOOR].includes(at(L.cells, x + dx, y + dy));
      const toward = inDen(0, 1) ? 1 : inDen(0, -1) ? -1 : 0;
      const sideways = !toward && (inDen(1, 0) || inDen(-1, 0));
      m4.makeRotationY(sideways ? Math.PI / 2 : 0);
      m4.setPosition(wx(x) + (sideways ? (inDen(1, 0) ? 0.55 : -0.55) : 0), 0.425, wz(y) + toward * 0.55);
      fenceMesh.setMatrixAt(k, m4);
    });
    fenceMesh.castShadow = true;
    group.add(fenceMesh);
    disposables.push(fenceMat);
    const gate = new T.Mesh(geo('gate', () => new T.BoxGeometry(TILE, 0.16, 0.16)), new T.MeshStandardMaterial({ color: '#ff8fb8', roughness: 0.5 }));
    gate.position.set(wx(L.door.x), 0.5, wz(L.door.y) + 0.5);
    group.add(gate);
    disposables.push(gate.material);
    const sign = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('🦝') }));
    sign.position.set(wx(L.door.x), 0.9, wz(L.inside.y) + 0.2);
    sign.scale.setScalar(0.9);
    group.add(sign);
    disposables.push(sign.material);

    // tunnel arches: leafy tunnels at both edges, dark inside
    const archMat = side;
    const darkMat = new T.MeshBasicMaterial({ color: '#0e1a0c' });
    disposables.push(darkMat);
    for (let y = 0; y < H; y++) {
      if (at(L.cells, 0, y) !== Z.TUNNEL) continue;
      for (const sx of [-1, 1]) {
        const x = sx < 0 ? wx(0) - TILE * 1.1 : wx(W - 1) + TILE * 1.1;
        const arch = new T.Group();
        const beam = new T.Mesh(geo('archBeam', () => new T.BoxGeometry(TILE * 1.3, 0.7, TILE * 1.6)), archMat);
        beam.position.y = 1.55;
        arch.add(beam);
        for (const sz of [-1, 1]) {
          const post = new T.Mesh(geo('archPost', () => new T.BoxGeometry(TILE * 1.3, 1.9, 0.5)), archMat);
          post.position.set(0, 0.95, sz * (TILE * 0.8 - 0.25 + 0.25));
          post.castShadow = true;
          arch.add(post);
        }
        const hole = new T.Mesh(geo('archHole', () => new T.PlaneGeometry(TILE * 1.2, 1.25)), darkMat);
        hole.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
        hole.position.set(sx * TILE * 0.62, 0.62, 0);
        arch.add(hole);
        arch.position.set(x, 0, wz(y));
        group.add(arch);
      }
    }

    // trees and bushes on the lawn round the maze
    const trunkMat = new T.MeshStandardMaterial({ color: '#8a5a32', roughness: 1 });
    const crownMat = new T.MeshStandardMaterial({ color: th.night ? '#2b6a55' : gfx.shade(th.hedge, 0.08), roughness: 0.9 });
    disposables.push(trunkMat, crownMat);
    const halfW = (W * TILE) / 2, halfH = (H * TILE) / 2;
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2;
      const rr = 1 + r() * 0.35;
      const x = Math.cos(a) * (halfW + 6) * rr, z = Math.sin(a) * (halfH + 7) * rr;
      if (Math.abs(z - wz(9)) < 4 && Math.abs(x) > halfW) continue; // keep the tunnel mouths clear
      const tree = new T.Group();
      const s = 0.8 + r() * 0.8;
      const trunk = new T.Mesh(geo('trunk', () => new T.CylinderGeometry(0.25, 0.32, 1.6, 8)), trunkMat);
      trunk.position.y = 0.8;
      const crown = new T.Mesh(geo('crown', () => new T.SphereGeometry(1.4, 12, 10)), crownMat);
      crown.position.y = 2.4;
      tree.add(trunk, crown);
      tree.scale.setScalar(s);
      tree.position.set(x, 0, z);
      tree.traverse((o) => o.isMesh && (o.castShadow = true));
      group.add(tree);
    }

    return {
      group,
      dispose() {
        for (const d of disposables) d.dispose && d.dispose();
        hedges.dispose && hedges.dispose();
      },
    };
  }

  // ---------------------------------------------------------------- cookies, milk, fruit
  function cookieTexture() {
    return once('cookieTop', () => {
      const S = 128;
      const [c, g] = gfx.makeCanvas(S, S);
      const gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
      gr.addColorStop(0, '#f2c27c');
      gr.addColorStop(0.75, '#dca05a');
      gr.addColorStop(1, '#b8773a');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      const r = lcg(9);
      g.fillStyle = '#5a3418';
      for (let k = 0; k < 9; k++) {
        const a = r() * Math.PI * 2, d = r() * 40;
        g.beginPath();
        g.ellipse(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 7 + r() * 4, 6 + r() * 3, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      return gfx.toTexture(c);
    });
  }

  // One instanced mesh for every cookie in the maze; hide one with hide(cell).
  function Cookies(scene, L) {
    const cells = [];
    for (let c = 0; c < W * H; c++) if (L.food[c] === Z.COOKIE) cells.push(c);
    const g = geo('cookie', () => new T.CylinderGeometry(0.34, 0.34, 0.13, 20));
    const sideMat = new T.MeshStandardMaterial({ color: '#c98a45', roughness: 0.8 });
    const topMat = new T.MeshStandardMaterial({ map: cookieTexture(), roughness: 0.8 });
    const mesh = new T.InstancedMesh(g, [sideMat, topMat, sideMat], cells.length);
    mesh.castShadow = true;
    scene.add(mesh);
    const slot = new Map(cells.map((c, k) => [c, k]));
    const shown = new Uint8Array(cells.length).fill(1);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    const spot = new Float32Array(cells.length);
    cells.forEach((c, k) => (spot[k] = ((c * 37) % 100) / 100));
    let glow = 0;
    return {
      mesh,
      hide(c) {
        const k = slot.get(c);
        if (k !== undefined) shown[k] = 0;
      },
      // the last few cookies grow and glow so they're easy to find
      update(t, food, left) {
        glow = left <= 6 ? 1 : 0;
        for (let k = 0; k < cells.length; k++) {
          const c = cells[k];
          const on = shown[k] && food[c] === Z.COOKIE;
          const big = on && glow ? 1.35 + Math.sin(t * 6 + k) * 0.15 : 1;
          s.setScalar(on ? big : 0.0001);
          e.set(0.75, t * 0.6 + spot[k] * 6, 0);
          q.setFromEuler(e);
          p.set(wx(c % W), 0.42 + Math.sin(t * 2.4 + spot[k] * 6) * 0.06 + (glow && on ? 0.25 : 0), wz((c / W) | 0));
          m4.compose(p, q, s);
          mesh.setMatrixAt(k, m4);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
      dispose(sc) {
        sc.remove(mesh);
        sideMat.dispose();
        topMat.dispose();
        mesh.dispose && mesh.dispose();
      },
    };
  }

  function emojiSprite(emoji, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(emoji), depthWrite: false }));
    s.scale.setScalar(size);
    return s;
  }

  // ---------------------------------------------------------------- the Crumb Raccoons
  const COONCOL = {
    fur: '#8f929c', dark: '#3a3c46', light: '#ece7dc', mask: '#1c1c24',
    sleepyFur: '#86aaff', sleepyDark: '#3d5ec8', sleepyLight: '#e2ebff', sleepyMask: '#25307a',
  };
  function makeRaccoon(scarf) {
    const mats = {
      fur: gfx.std(COONCOL.fur, { roughness: 0.85 }),
      dark: gfx.std(COONCOL.dark, { roughness: 0.85 }),
      light: gfx.std(COONCOL.light, { roughness: 0.85 }),
      mask: gfx.std(COONCOL.mask, { roughness: 0.6 }),
    };
    const white = gfx.std('#ffffff', { roughness: 0.3 });
    const black = gfx.std('#101014', { roughness: 0.3 });
    const scarfMat = gfx.std(scarf, { roughness: 0.7 });
    const ball = geo('ball', () => new T.SphereGeometry(1, 16, 12));
    const add = (parent, mat, x, y, z, sx, sy, sz) => {
      const m = new T.Mesh(ball, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy ?? sx, sz ?? sx);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const root = new T.Group();
    const rig = new T.Group();
    root.add(rig);
    // body and belly (faces -z, like the kit's people)
    add(rig, mats.fur, 0, 0.72, 0, 0.55, 0.58, 0.5);
    add(rig, mats.light, 0, 0.68, -0.27, 0.4, 0.44, 0.28);
    // the scarf
    const knot = new T.Mesh(geo('scarf', () => new T.TorusGeometry(0.36, 0.1, 8, 20)), scarfMat);
    knot.rotation.x = Math.PI / 2;
    knot.position.y = 1.12;
    rig.add(knot);
    const tail1 = new T.Mesh(geo('scarfEnd', () => new T.BoxGeometry(0.16, 0.32, 0.06)), scarfMat);
    tail1.position.set(0.18, 0.95, -0.36);
    tail1.rotation.z = 0.3;
    rig.add(tail1);
    // head
    const head = new T.Group();
    head.position.y = 1.5;
    rig.add(head);
    add(head, mats.fur, 0, 0, 0, 0.52, 0.46, 0.46);
    add(head, mats.light, -0.3, -0.13, -0.24, 0.22, 0.19, 0.18);
    add(head, mats.light, 0.3, -0.13, -0.24, 0.22, 0.19, 0.18);
    add(head, mats.light, 0, 0.2, -0.3, 0.2, 0.08, 0.12); // the white stripe above the mask
    add(head, mats.mask, 0, 0.04, -0.29, 0.44, 0.16, 0.2); // the bandit mask
    add(head, mats.mask, -0.18, 0.03, -0.32, 0.16, 0.14, 0.14);
    add(head, mats.mask, 0.18, 0.03, -0.32, 0.16, 0.14, 0.14);
    const eyes = [];
    for (const sx of [-1, 1]) {
      const eye = add(head, white, sx * 0.17, 0.05, -0.42, 0.095, 0.11, 0.06);
      const pupil = add(head, black, sx * 0.17, 0.04, -0.47, 0.055, 0.065, 0.04);
      add(head, white, sx * 0.15, 0.08, -0.5, 0.02, 0.02, 0.01); // a shine
      eyes.push(eye, pupil);
    }
    add(head, mats.light, 0, -0.16, -0.38, 0.17, 0.12, 0.16); // snout
    add(head, black, 0, -0.12, -0.53, 0.06, 0.05, 0.05); // nose
    for (const sx of [-1, 1]) {
      add(head, mats.fur, sx * 0.34, 0.36, 0.02, 0.15, 0.17, 0.08);
      add(head, mats.dark, sx * 0.34, 0.35, -0.04, 0.09, 0.1, 0.04);
    }
    // arms and legs (dark paws), pivoting at the shoulder and hip
    const limb = (x, y, z, len, r) => {
      const pivot = new T.Group();
      pivot.position.set(x, y, z);
      const m = new T.Mesh(geo(`limb${len}`, () => T.CapsuleGeometry ? new T.CapsuleGeometry(r, len, 4, 8) : new T.CylinderGeometry(r, r, len + r * 2, 8)), mats.dark);
      m.position.y = -len / 2;
      m.castShadow = true;
      pivot.add(m);
      rig.add(pivot);
      return pivot;
    };
    const armL = limb(-0.48, 1.0, -0.05, 0.36, 0.1);
    const armR = limb(0.48, 1.0, -0.05, 0.36, 0.1);
    const legL = limb(-0.24, 0.36, 0, 0.18, 0.12);
    const legR = limb(0.24, 0.36, 0, 0.18, 0.12);
    // the stripy tail, curling up behind
    const tail = new T.Group();
    tail.position.set(0, 0.5, 0.42);
    rig.add(tail);
    const rings = [];
    for (let k = 0; k < 6; k++) {
      const u = k / 5;
      const m = add(tail, k % 2 ? mats.dark : mats.fur, 0, Math.sin(u * 1.4) * 0.75, 0.12 + u * 0.55 - u * u * 0.25, 0.2 - u * 0.05);
      rings.push(m);
    }
    const fur = new T.Color(), dk = new T.Color(), lt = new T.Color(), mk = new T.Color();
    return {
      root, rig, head, armL, armR, legL, legR, tail, eyes, mats,
      // 0 = his own colours, 1 = sleepy blue
      tint(k) {
        mats.fur.color.copy(fur.set(COONCOL.fur)).lerp(new T.Color(COONCOL.sleepyFur), k);
        mats.dark.color.copy(dk.set(COONCOL.dark)).lerp(new T.Color(COONCOL.sleepyDark), k);
        mats.light.color.copy(lt.set(COONCOL.light)).lerp(new T.Color(COONCOL.sleepyLight), k);
        mats.mask.color.copy(mk.set(COONCOL.mask)).lerp(new T.Color(COONCOL.sleepyMask), k);
      },
      // eyes half shut when sleepy, shut when napping
      lids(open) {
        for (let k = 0; k < eyes.length; k++) eyes[k].scale.y = (k % 2 ? 0.065 : 0.11) * Math.max(0.12, open);
      },
    };
  }

  // ---------------------------------------------------------------- effects (from BombasTTic!, kit candidates)
  function puffTexture() {
    return once('puff', () => {
      const [c, g] = gfx.makeCanvas(128, 128);
      const blob = (x, y, r) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.55, 'rgba(250,250,255,1)');
        gr.addColorStop(0.8, 'rgba(215,215,235,0.9)');
        gr.addColorStop(1, 'rgba(200,200,225,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      };
      blob(64, 70, 40);
      blob(40, 60, 28);
      blob(88, 58, 30);
      blob(62, 40, 30);
      blob(80, 84, 24);
      return gfx.toTexture(c);
    });
  }
  function crumbTexture() {
    return once('crumb', () => {
      const [c, g] = gfx.makeCanvas(32, 32);
      g.fillStyle = '#c98a45';
      g.beginPath();
      g.moveTo(6, 10);
      g.lineTo(24, 5);
      g.lineTo(28, 22);
      g.lineTo(10, 27);
      g.closePath();
      g.fill();
      g.fillStyle = '#5a3418';
      g.beginPath();
      g.arc(17, 15, 4, 0, Math.PI * 2);
      g.fill();
      return gfx.toTexture(c);
    });
  }

  // Comic words (STOP!, BONK!, HEE HEE!) on a starburst, drawn in the current language and cached per language.
  function wordTexture(en, fill, burst) {
    const word = Kit.lang ? Kit.lang.t(en) : en;
    return once(`word-${word}-${fill}-${burst}`, () => {
      const [c, g] = gfx.makeCanvas(320, 160);
      if (burst) {
        g.fillStyle = burst;
        g.beginPath();
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2, rr = k % 2 ? 50 : 76;
          g.lineTo(160 + Math.cos(a) * rr * 1.9, 80 + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.lineWidth = 6;
        g.strokeStyle = '#14121f';
        g.stroke();
      }
      const size = word.length > 7 ? 46 : 58;
      g.font = `${size}px ${gfx.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.lineJoin = 'round';
      g.strokeStyle = '#14121f';
      g.strokeText(word, 160, 84);
      g.fillStyle = fill;
      g.fillText(word, 160, 84);
      return gfx.toTexture(c);
    });
  }
  function wordSprite(word, fill, burst) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: wordTexture(word, fill, burst), depthWrite: false, depthTest: false }));
    s.scale.set(2.6, 1.3, 1);
    s.renderOrder = 10;
    return s;
  }

  // A pool of sprites that grow, drift and fade: puffs, stars, crumbs, sparkles.
  function SpritePool(scene, n, map, blending) {
    const items = [];
    for (let k = 0; k < n; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: blending || T.NormalBlending }));
      s.visible = false;
      scene.add(s);
      items.push({ s, life: 0, max: 1, v: new T.Vector3(), s0: 1, s1: 1, a: 1, spin: 0, g: 0, drag: 2 });
    }
    let next = 0;
    return {
      emit(x, y, z, o = {}) {
        const it = items[next];
        next = (next + 1) % n;
        it.s.position.set(x, y, z);
        it.s.visible = true;
        it.life = 0;
        it.max = o.life || 0.7;
        it.v.set(o.vx || 0, o.vy || 0, o.vz || 0);
        it.s0 = o.s0 ?? 1;
        it.s1 = o.s1 ?? 2;
        it.a = o.alpha ?? 1;
        it.spin = o.spin || 0;
        it.g = o.gravity || 0;
        it.drag = o.drag ?? 2;
        it.s.material.color.set(o.color || '#ffffff');
        it.s.material.rotation = o.rot || 0;
        it.s.material.opacity = it.a;
        it.s.scale.setScalar(it.s0);
        return it;
      },
      update(dt) {
        for (const it of items) {
          if (!it.s.visible) continue;
          it.life += dt;
          const k = it.life / it.max;
          if (k >= 1) {
            it.s.visible = false;
            continue;
          }
          it.v.y -= it.g * dt;
          it.v.multiplyScalar(Math.exp(-it.drag * dt));
          it.s.position.addScaledVector(it.v, dt);
          if (it.s.position.y < 0.05 && it.g) {
            it.s.position.y = 0.05;
            it.v.set(0, 0, 0);
          }
          const e = 1 - Math.pow(1 - k, 3);
          it.s.scale.setScalar(it.s0 + (it.s1 - it.s0) * e);
          it.s.material.opacity = it.a * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
          it.s.material.rotation += it.spin * dt;
        }
      },
      clear() {
        for (const it of items) it.s.visible = false;
      },
    };
  }

  // Confetti: little coloured squares that pop out, tumble and flutter down.
  const CONFETTI = ['#ff3d7f', '#ffd400', '#18d4ff', '#2fc27a', '#b45cff', '#ff8a1f', '#ffffff'];
  function Confetti(scene, n) {
    const pos = new Float32Array(n * 3).fill(-1000);
    const col = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const life = new Float32Array(n);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ size: 0.26, vertexColors: true, sizeAttenuation: true }));
    pts.frustumCulled = false;
    scene.add(pts);
    const c = new T.Color();
    let next = 0;
    return {
      emit(x, y, z, count, o = {}) {
        const sp = o.speed ?? 4, up = o.up ?? 5;
        for (let k = 0; k < count; k++) {
          const i = next;
          next = (next + 1) % n;
          pos[i * 3] = x + (Math.random() - 0.5) * (o.spread ?? 0.8);
          pos[i * 3 + 1] = y + Math.random() * 0.4;
          pos[i * 3 + 2] = z + (Math.random() - 0.5) * (o.spread ?? 0.8);
          const a = Math.random() * Math.PI * 2;
          vel[i * 3] = Math.cos(a) * sp * Math.random();
          vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.8);
          vel[i * 3 + 2] = Math.sin(a) * sp * Math.random();
          c.set(o.colors ? gfx.pick(o.colors) : gfx.pick(CONFETTI));
          col[i * 3] = c.r;
          col[i * 3 + 1] = c.g;
          col[i * 3 + 2] = c.b;
          life[i] = o.life || 1.6 + Math.random() * 0.8;
        }
        g.attributes.color.needsUpdate = true;
      },
      update(dt) {
        let any = false;
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          any = true;
          life[i] -= dt;
          if (life[i] <= 0 || pos[i * 3 + 1] < 0.05) {
            if (life[i] <= 0) pos[i * 3 + 1] = -1000;
            else {
              pos[i * 3 + 1] = 0.05;
              vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0;
            }
            continue;
          }
          const drag = Math.exp(-1.8 * dt);
          vel[i * 3] *= drag;
          vel[i * 3 + 2] *= drag;
          vel[i * 3 + 1] = vel[i * 3 + 1] * drag - 9 * dt;
          if (vel[i * 3 + 1] < -2.2) vel[i * 3 + 1] = -2.2;
          pos[i * 3] += vel[i * 3] * dt + Math.sin(life[i] * 9 + i) * 0.01;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        }
        if (any) g.attributes.position.needsUpdate = true;
      },
      clear() {
        life.fill(0);
        pos.fill(-1000);
        g.attributes.position.needsUpdate = true;
      },
    };
  }

  function dizzyStars() {
    const g = new T.Group();
    for (let k = 0; k < 3; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('⭐'), depthWrite: false, depthTest: false }));
      s.scale.setScalar(0.45);
      s.renderOrder = 9;
      g.add(s);
    }
    g.visible = false;
    return g;
  }

  CC.Art = {
    wx, wz, TILE, buildMaze, Cookies, emojiSprite, makeRaccoon, wordSprite, wordTexture, puffTexture, crumbTexture,
    SpritePool, Confetti, dizzyStars, CONFETTI,
  };
})();
