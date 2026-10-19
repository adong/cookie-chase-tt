/* The game you see: scene, camera, the boys, the raccoons, effects, the HUD, menus, the companion's visits, the main
   loop and the window.game test hooks. It only reads the engine's state (js/engine.js) and turns its events into
   effects and sounds.
   Sections: setup · world · characters · effects · events · companion · camera · HUD · screens · flow · loop · hooks */
(function () {
  'use strict';
  const CC = window.CC;
  const T = THREE;
  const gfx = Kit.gfx;
  const People = Kit.people;
  const A = CC.Art;
  const E = CC.Engine;
  const Z = CC.Maze;
  const TUNE = CC.TUNE, BUD = TUNE.buddy;
  const { W, H } = Z;
  const TILE = TUNE.tile;
  const wx = A.wx, wz = A.wz;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const FACE_ANGLE = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // up, right, down (toward the camera), left
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const SCALE = { player: 1.02, coon: 1.04 };
  const nice = (name) => name[0] + name.slice(1).toLowerCase();

  // ---------------------------------------------------------------- saved settings
  const SAVE_KEY = 'cookieChaseTT.v1';
  let saved = { unlocked: 0, diff: 'easy', heroes: ['teddy', 'tommy'], pads: false, best: { easy: 0, normal: 0 } };
  try { Object.assign(saved, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  saved.best = Object.assign({ easy: 0, normal: 0 }, saved.best);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) { /* storage blocked */ } };

  // ---------------------------------------------------------------- state
  const G = {
    screen: 'loading', two: false, diff: saved.diff, heroes: saved.heroes.slice(), M: null, attract: false,
    phase: 'intro', phaseT: 0, time: 0, hold: false, autoPause: true, run: null, acc: 0, shake: 0, touch: false, bannerT: 0,
  };

  // ---------------------------------------------------------------- setup
  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const FOV = 30, TILT = (57 * Math.PI) / 180;
  const camera = new T.PerspectiveCamera(FOV, 1, 0.5, 600);
  const hemi = new T.HemisphereLight('#ffffff', '#6a7a50', 0.8);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff4e0', 1.1);
  sun.position.set(-14, 34, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 110 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  const fx = {
    puffs: A.SpritePool(scene, 160, A.puffTexture()),
    stars: A.SpritePool(scene, 120, gfx.emojiTexture('⭐')),
    crumbs: A.SpritePool(scene, 160, A.crumbTexture()),
    flyers: A.SpritePool(scene, 40, gfx.emojiTexture('🍪')),
    glows: A.SpritePool(scene, 30, gfx.glowTexture(), T.AdditiveBlending),
    confetti: A.Confetti(scene, 2400),
    words: [],
  };
  const PASTEL = ['#ffffff', '#ffe066', '#ff9ecd', '#8fe3ff', '#a8f08a', '#d0a8ff', '#ffc38a'];
  let thumbs = {};

  // ---------------------------------------------------------------- world
  const world = { maze: null, cookies: null, milks: new Map(), fruit: null, theme: null, moon: null };

  const milkRing = new T.RingGeometry(0.55, 0.85, 28);
  function buildWorld(M) {
    if (world.maze) {
      scene.remove(world.maze.group);
      world.maze.dispose();
    }
    if (world.cookies) world.cookies.dispose(scene);
    for (const m of world.milks.values()) scene.remove(m);
    world.milks.clear();
    world.maze = A.buildMaze(M.L);
    scene.add(world.maze.group);
    world.cookies = A.Cookies(scene, M.L);
    const th = M.L.theme;
    world.theme = th;
    scene.background = new T.Color(th.sky);
    scene.fog = new T.Fog(th.sky, 90, 220);
    hemi.color.set(th.night ? '#aab8ff' : '#ffffff');
    hemi.intensity = th.night ? 0.62 : 0.8;
    sun.color.set(th.night ? '#c9d4ff' : '#fff4e0');
    sun.intensity = th.night ? 0.75 : 1.1;
    // the milks: a glass of milk bouncing on a soft glow
    for (let c = 0; c < W * H; c++) {
      if (M.L.food[c] !== Z.MILK) continue;
      const g = new T.Group();
      const glow = new T.Sprite(new T.SpriteMaterial({ map: gfx.glowTexture(), color: '#bfe8ff', blending: T.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(1.6);
      glow.material.opacity = 0.55;
      glow.position.y = 0.6;
      const s = A.emojiSprite('🥛', 1.35);
      s.position.y = 0.9;
      const ring = new T.Mesh(milkRing, new T.MeshBasicMaterial({ color: '#4fb6ff', transparent: true, opacity: 0.75, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring, glow, s);
      g.userData.ring = ring;
      g.position.set(wx(c % W), 0, wz((c / W) | 0));
      Object.assign(g.userData, { s, glow, ph: c });
      scene.add(g);
      world.milks.set(c, g);
    }
    if (!world.fruit) {
      world.fruit = A.emojiSprite('🍓', 1.2);
      scene.add(world.fruit);
    }
    world.fruit.visible = false;
    if (!world.moon) {
      world.moon = A.emojiSprite('🌙', 9);
      scene.add(world.moon);
    }
    world.moon.visible = !!th.night;
    world.moon.position.set(-W * TILE * 0.55, 16, -H * TILE * 0.9);
    fx.puffs.clear();
    fx.stars.clear();
    fx.crumbs.clear();
    fx.flyers.clear();
    fx.confetti.clear();
    for (const w of fx.words) w.s.visible = false;
    buildCast(M);
    G.camFit = null;
  }

  // ---------------------------------------------------------------- characters
  // People are pooled by look, so maze after maze reuses the same boys.
  const pool = {};
  function lookFor(id, variant) {
    const e = Kit.roster.get(id);
    if (!variant) return e.look;
    // a second copy of the same boy (2 players, and his brother drops in to help): new colours
    return Object.assign({}, e.look, { top: variant === 'p2' ? '#ff8a5a' : '#ffd27a', shoes: variant === 'p2' ? '#3d8bff' : e.look.shoes });
  }
  function getModel(id, variant) {
    const key = id + ':' + (variant || '');
    const list = pool[key] || (pool[key] = []);
    const free = list.find((m) => !m.used);
    if (free) {
      free.used = true;
      free.root.visible = true;
      return free;
    }
    const m = People.build(lookFor(id, variant));
    m.used = true;
    m.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    scene.add(m.root);
    list.push(m);
    return m;
  }
  function releaseModel(m) {
    if (!m) return;
    m.used = false;
    m.root.visible = false;
    for (const extra of m.extras || []) m.root.remove(extra);
    m.extras = [];
  }

  const cast = { players: [], coons: [], buddies: [] };

  function buildCast(M) {
    for (const v of cast.players) {
      releaseModel(v.m);
      dropTreat(v);
      scene.remove(v.stars, v.word.s, v.help);
    }
    for (const v of cast.buddies) releaseModel(v.m);
    cast.players = [];
    cast.buddies = [];
    const ids = M.players.map((p) => p.id);
    M.players.forEach((p, i) => {
      const variant = i === 1 && ids[0] === p.id ? 'p2' : '';
      const m = getModel(p.id, variant);
      m.root.scale.setScalar(SCALE.player);
      m.extras = [];
      const v = { m, entry: Kit.roster.get(p.id), ang: Math.PI, ph: 0, treat: null, ball: null, shot: false, last: 'play' };
      if (M.two) {
        const tag = gfx.nameTag(Kit.roster.get(p.id).name, i === 0 ? '#8cc2ff' : '#ffb0b0');
        tag.position.y = 2.75;
        tag.scale.multiplyScalar(0.85);
        m.root.add(tag);
        m.extras.push(tag);
      }
      v.stars = A.dizzyStars();
      scene.add(v.stars);
      v.word = { s: A.wordSprite('HEE HEE!', '#ffd400', '#ff6a8a'), t: 9 };
      v.word.s.visible = false;
      scene.add(v.word.s);
      v.help = A.wordSprite('HELP!', '#ffffff', '#3d8bff');
      v.help.visible = false;
      scene.add(v.help);
      cast.players.push(v);
    });
    // the raccoons are built once and kept
    if (!cast.coons.length) {
      CC.COONS.forEach((def) => {
        const r = A.makeRaccoon(def.scarf);
        r.root.scale.setScalar(SCALE.coon);
        r.root.traverse((o) => o.isMesh && (o.castShadow = true));
        scene.add(r.root);
        const tag = gfx.nameTag(def.name, def.scarf);
        tag.position.y = 2.55;
        tag.scale.multiplyScalar(0.8);
        r.root.add(tag);
        const stop = A.emojiSprite('🛑', 0.8);
        stop.position.y = 2.6;
        r.root.add(stop);
        const zzz = A.emojiSprite('💤', 0.85);
        zzz.position.set(0.5, 2.3, 0);
        r.root.add(zzz);
        const daze = A.dizzyStars();
        scene.add(daze);
        cast.coons.push({ r, def, tag, stop, zzz, daze, ang: Math.PI, ph: Math.random() * 6, hop: 0 });
      });
    }
    M.buddies.forEach((b, i) => {
      const clash = ids.includes(b.id) || M.buddies.some((o, k) => k < i && o.id === b.id);
      const entry = Kit.roster.get(b.id);
      const m = getModel(b.id, clash ? 'buddy' : '');
      m.root.visible = false;
      const s = SCALE.player * (entry.buddyScale || 0.8);
      m.root.scale.setScalar(s);
      m.extras = [];
      const tag = gfx.nameTag(entry.name, entry.tag || '#ffb02e');
      tag.position.y = 2.75;
      m.root.add(tag);
      m.extras.push(tag);
      cast.buddies.push({ m, entry, scale: s, ang: Math.PI, ph: 0, shown: 0, ball: null, shot: false, mode: '', modeT: 0, leaving: 0 });
    });
  }

  // Ease the extra channels the kit's pose() doesn't touch back to standing.
  function settle(m, k) {
    m.rig.position.y += (0.55 - m.rig.position.y) * k;
    m.rig.rotation.x += (0 - m.rig.rotation.x) * k;
    m.rig.rotation.z += (0 - m.rig.rotation.z) * k;
    m.head.rotation.z += (0 - m.head.rotation.z) * k;
    m.legL.rotation.z += (0 - m.legL.rotation.z) * k;
    m.legR.rotation.z += (0 - m.legR.rotation.z) * k;
  }
  function plantFeet(m) {
    m.legL.rotation.x *= 0.25;
    m.legR.rotation.x *= 0.25;
  }
  // Tickled: sitting on the floor, rocking with laughter, hugging his tummy, feet kicking.
  function poseGiggle(m, t, k) {
    People.pose(m, 0, 'stand', k);
    const to = (o, p, v) => { o[p] += (v - o[p]) * k; };
    to(m.rig.position, 'y', -0.2);
    to(m.legL.rotation, 'x', 1.35 + Math.sin(t * 15) * 0.25);
    to(m.legR.rotation, 'x', 1.35 - Math.sin(t * 15) * 0.25);
    to(m.armL.rotation, 'x', 0.9);
    to(m.armR.rotation, 'x', 0.9);
    to(m.armL.rotation, 'z', 0.55);
    to(m.armR.rotation, 'z', -0.55);
    m.rig.rotation.x = -0.25 + Math.sin(t * 9) * 0.18;
    m.head.rotation.z = Math.sin(t * 13) * 0.22;
  }

  // Signature celebration: Teddy shadow-boxes then sinks a jump shot, Tommy does his Y, everyone else waves.
  function celebrate(m, entry, t, k, v) {
    const sig = (entry && entry.signature) || ['wave'];
    if (sig.includes('jumpshot')) {
      const cyc = t % 2.7;
      if (cyc < 1.5) {
        People.pose(m, t * 7, 'boxing', k);
        v.shot = false;
        return 0;
      }
      const u = (cyc - 1.5) / 1.2;
      People.pose(m, 0, 'jumpshot', k);
      if (u > 0.42 && !v.shot) {
        v.shot = true;
        shootBall(m, v);
      }
      return u < 1 ? Math.max(0, Math.sin(u * Math.PI)) * 0.9 : 0;
    }
    const mode = sig[0];
    People.pose(m, t * 4, mode, k);
    plantFeet(m);
    return mode === 'peace' ? Math.abs(Math.sin(t * 5)) * 0.18 : 0;
  }

  function turnTo(v, target, dt, rate = 14) {
    let d = target - v.ang;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.ang += d * damp(rate, dt);
    return v.ang;
  }

  // Where to draw something at grid x (the tunnels wrap, so keep it near the maze) and whether it's hidden in a tunnel.
  function drawX(x) {
    if (x < -0.5) x += W;
    if (x > W - 0.5) x -= W;
    return x;
  }
  const inTunnel = (x) => x < -0.32 || x > W - 0.68;

  const tmpV = new T.Vector3();
  function syncPlayers(M, dt) {
    M.players.forEach((p, i) => {
      const v = cast.players[i];
      if (!v) return;
      const m = v.m;
      const k = damp(18, dt);
      v.ph += dt * (p.moving ? 11 : 3);
      let hop = 0;
      const st = p.state;
      if (st !== v.last) {
        if (st === 'play') v.ang = Math.PI;
        v.last = st;
      }
      const giggling = st === 'caught' || st === 'stuck';
      if (giggling) {
        poseGiggle(m, p.st, k);
        turnTo(v, Math.PI, dt, 6);
      } else if (st === 'win') {
        settle(m, k);
        turnTo(v, Math.PI, dt, 8);
        if (M.winner === i || M.two) hop = celebrate(m, v.entry, p.st + i * 0.4, k, v);
        else {
          People.pose(m, p.st * 4, 'wave', k);
          plantFeet(m);
        }
      } else {
        settle(m, k);
        if (p.moving) {
          People.pose(m, v.ph, 'run', k);
          turnTo(v, FACE_ANGLE[p.face], dt);
        } else {
          People.pose(m, v.ph, 'stand', k);
          turnTo(v, G.phase === 'intro' ? Math.PI : FACE_ANGLE[p.face], dt, 8);
        }
      }
      const x = drawX(p.x);
      m.root.rotation.y = v.ang;
      m.root.position.set(wx(x), hop, wz(p.y));
      m.root.visible = !inTunnel(x);
      if (p.safe > 0 && st === 'play') m.root.visible = m.root.visible && Math.floor(G.time * 12) % 2 === 0;
      // giggles: stars, HEE HEE!, and HELP! while waiting for his brother
      v.stars.visible = giggling;
      if (giggling) {
        m.root.updateMatrixWorld(true);
        m.head.getWorldPosition(tmpV);
        v.stars.position.set(tmpV.x, tmpV.y + 0.7, tmpV.z);
        v.stars.children.forEach((s, j) => {
          const a = G.time * 4 + (j * Math.PI * 2) / 3;
          s.position.set(Math.cos(a) * 0.6, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.6);
        });
      }
      v.word.t += dt;
      const w = v.word;
      w.s.visible = w.t < 1.5;
      if (w.s.visible) {
        const pop = w.t < 0.15 ? w.t / 0.15 : 1;
        w.s.position.set(wx(x), 3.4 + w.t * 0.5, wz(p.y));
        w.s.scale.set(2.6 * pop, 1.3 * pop, 1);
        w.s.material.opacity = w.t > 1.1 ? 1 - (w.t - 1.1) / 0.4 : 1;
      }
      v.help.visible = st === 'stuck' && !G.attract;
      if (v.help.visible) {
        const s = 1 + Math.sin(G.time * 8) * 0.08;
        v.help.position.set(wx(x), 3.5, wz(p.y));
        v.help.scale.set(2.3 * s, 1.15 * s, 1);
      }
      updateBall(v, dt);
    });
  }

  function syncCoons(M, dt) {
    const L = M.L;
    M.coons.forEach((c, k) => {
      const v = cast.coons[k];
      const r = v.r;
      const kk = damp(14, dt);
      const frozen = M.freezeT > 0 && c.state !== 'home' && c.state !== 'nap' && M.state === 'play';
      // colours: sleepy blue, blinking white-ish near the end of the milk
      let tint = c.sleepy ? 1 : 0;
      if (c.sleepy && M.sleepyT < TUNE.milkBlink) tint = Math.floor(G.time * 6) % 2 ? 1 : 0.15;
      r.tint(tint);
      r.lids(c.state === 'nap' ? 0 : c.sleepy ? 0.45 : c.state === 'home' ? 0.3 : 1);
      v.ph += dt * (c.moving ? (c.state === 'home' ? 22 : 10) : 3);
      const swing = c.moving ? Math.sin(v.ph) * 0.7 : 0;
      const to = (o, p, val) => { o[p] += (val - o[p]) * kk; };
      let hop = 0, target = FACE_ANGLE[c.dir >= 0 ? c.dir : 2];
      r.rig.rotation.z = 0;
      r.rig.rotation.x = 0;
      if (c.state === 'den') {
        hop = Math.abs(Math.sin(G.time * 5 + k * 1.3)) * 0.3;
        target = Math.PI;
        to(r.armL.rotation, 'x', 0);
        to(r.armR.rotation, 'x', 0);
        to(r.legL.rotation, 'x', 0);
        to(r.legR.rotation, 'x', 0);
      } else if (c.state === 'nap') {
        target = Math.PI;
        to(r.legL.rotation, 'x', -1.4);
        to(r.legR.rotation, 'x', -1.4);
        to(r.armL.rotation, 'x', -0.3);
        to(r.armR.rotation, 'x', -0.3);
        to(r.rig.position, 'y', -0.32);
        r.head.rotation.z = 0.3 + Math.sin(G.time * 1.5 + k) * 0.06;
      } else if (c.state === 'tickle') {
        // wiggly fingers at the tickled boy
        const p = M.players.reduce((a, q) => (E.wrapDist(q.x, q.y, c.x, c.y) < E.wrapDist(a.x, a.y, c.x, c.y) ? q : a));
        target = Math.atan2(-(p.x - c.x), -(p.y - c.y));
        to(r.armL.rotation, 'x', -1.4 + Math.sin(G.time * 30) * 0.4);
        to(r.armR.rotation, 'x', -1.4 - Math.sin(G.time * 30) * 0.4);
        hop = Math.abs(Math.sin(G.time * 14)) * 0.15;
      } else if (frozen) {
        // STOP! hands up, shivering
        to(r.armL.rotation, 'x', -2.8);
        to(r.armR.rotation, 'x', -2.8);
        to(r.legL.rotation, 'x', 0);
        to(r.legR.rotation, 'x', 0);
        r.rig.rotation.z = Math.sin(G.time * 40) * 0.04;
        target = v.ang;
      } else {
        to(r.armL.rotation, 'x', swing * 0.8);
        to(r.armR.rotation, 'x', -swing * 0.8);
        to(r.legL.rotation, 'x', -swing);
        to(r.legR.rotation, 'x', swing);
        hop = c.moving ? Math.abs(Math.sin(v.ph)) * 0.12 : 0;
      }
      if (c.state !== 'nap') {
        to(r.rig.position, 'y', 0);
        r.head.rotation.z *= 0.9;
      }
      r.tail.rotation.y = Math.sin(G.time * (c.sleepy ? 3 : 7) + k) * 0.35;
      r.root.rotation.y = turnTo(v, target, dt, 12);
      let x = drawX(c.x), y = c.y;
      if (c.state === 'tickle') {
        // stand just beside the boy he's tickling, not on top of him
        const p = M.players.reduce((a, q) => (E.wrapDist(q.x, q.y, c.x, c.y) < E.wrapDist(a.x, a.y, c.x, c.y) ? q : a));
        let dx = c.x - p.x, dy = c.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        if (len < 0.05) dx = 1;
        x = drawX(p.x + (dx / (Math.hypot(dx, dy) || 1)) * 0.75);
        y = p.y + (dy / len) * 0.75;
      }
      r.root.position.set(wx(x), hop, wz(y) + (c.state === 'den' ? 0.2 : 0));
      r.root.visible = !inTunnel(x);
      v.tag.visible = (c.state === 'den' || G.phase === 'intro') && !G.attract && M.state === 'play';
      v.stop.visible = frozen;
      v.zzz.visible = c.state === 'nap' || (c.sleepy && Math.floor(G.time * 2) % 2 === 0);
      v.daze.visible = c.state === 'home' && r.root.visible;
      if (v.daze.visible) {
        v.daze.position.set(wx(x), 2.4, wz(c.y));
        v.daze.children.forEach((s, j) => {
          const a = G.time * 7 + (j * Math.PI * 2) / 3;
          s.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
        });
      }
      void L;
    });
  }

  // ---------------------------------------------------------------- effects
  function word(text, fill, burst, x, y, z, size = 1) {
    let w = fx.words.find((q) => !q.s.visible);
    if (!w) {
      w = { s: A.wordSprite(text, fill, burst), t: 0 };
      scene.add(w.s);
      fx.words.push(w);
    }
    w.s.material.map = A.wordTexture(text, fill, burst);
    w.s.material.needsUpdate = true;
    w.s.visible = true;
    Object.assign(w, { t: 0, x, y, z, size });
  }
  function updateWords(dt) {
    for (const w of fx.words) {
      if (!w.s.visible) continue;
      w.t += dt;
      if (w.t > 1.2) {
        w.s.visible = false;
        continue;
      }
      const pop = w.t < 0.12 ? w.t / 0.12 : 1 + Math.max(0, 0.25 - w.t) * 0.5;
      w.s.scale.set(2.6 * pop * w.size, 1.3 * pop * w.size, 1);
      w.s.position.set(w.x, w.y + w.t * 0.8, w.z);
      w.s.material.opacity = w.t > 0.9 ? 1 - (w.t - 0.9) / 0.3 : 1;
    }
  }
  function puffAt(x, z, n, o = {}) {
    for (let k = 0; k < n; k++) {
      fx.puffs.emit(x + (Math.random() - 0.5) * (o.spread ?? 0.6), (o.y ?? 0.6) + Math.random() * 0.5, z + (Math.random() - 0.5) * (o.spread ?? 0.6), {
        color: o.color || gfx.pick(PASTEL), s0: o.s0 ?? 1.0, s1: (o.s1 ?? 2.4) * (0.8 + Math.random() * 0.4), life: (o.life ?? 0.75) * (0.8 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * 1.5, vy: 1.6, vz: (Math.random() - 0.5) * 1.5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 2, drag: 2.5,
      });
    }
  }
  function crumbsAt(x, z, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      fx.crumbs.emit(x, 0.6, z, { s0: 0.28, s1: 0.18, life: 0.55, vx: Math.cos(a) * 2.2, vy: 2.5 + Math.random() * 2, vz: Math.sin(a) * 2.2, gravity: 12, drag: 1, rot: Math.random() * 6, spin: 8 });
    }
  }
  function burstStars(x, y, z, n = 9) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      fx.stars.emit(x, y, z, { s0: 0.7, s1: 0.25, life: 0.9, vx: Math.cos(a) * 5, vy: 3 + Math.random() * 3, vz: Math.sin(a) * 5, gravity: 7, drag: 1.2, spin: 6, rot: Math.random() * 6 });
    }
  }
  const ballTex = () => gfx.emojiTexture('🏀');
  function shootBall(m, v) {
    if (!v.ball) {
      v.ball = { s: new T.Sprite(new T.SpriteMaterial({ map: ballTex(), depthWrite: false })), t: -1, from: new T.Vector3(), to: new T.Vector3() };
      v.ball.s.scale.setScalar(0.6);
      scene.add(v.ball.s);
    }
    m.root.updateMatrixWorld(true);
    People.handWorld(m, 1, v.ball.from);
    v.ball.to.set(v.ball.from.x + 0.5, v.ball.from.y + 1.2, v.ball.from.z - 4.5);
    v.ball.t = 0;
    v.ball.s.visible = true;
    sfx('jump');
  }
  function updateBall(v, dt) {
    const b = v.ball;
    if (!b || b.t < 0) return;
    b.t += dt / 0.8;
    const k = Math.min(1, b.t);
    b.s.position.lerpVectors(b.from, b.to, k);
    b.s.position.y += Math.sin(k * Math.PI) * 2.6;
    b.s.material.rotation = -b.t * 8;
    if (k >= 1) {
      b.t = -1;
      b.s.visible = false;
      fx.confetti.emit(b.to.x, b.to.y, b.to.z, 20, { colors: ['#ff9f1c', '#ffffff', '#ffd400'], speed: 2.5, up: 2 });
      word('SWISH!', '#ffffff', '#ff9f1c', b.to.x, b.to.y + 0.6, b.to.z, 0.8);
      sfx('swish');
    }
  }

  function syncThings(M, dt) {
    if (!M) return;
    world.cookies.update(G.time, M.food, M.cookiesLeft);
    for (const [c, g] of world.milks) {
      g.visible = M.food[c] === Z.MILK;
      if (!g.visible) continue;
      const u = g.userData;
      u.s.position.y = 0.9 + Math.abs(Math.sin(G.time * 3 + u.ph)) * 0.35;
      u.glow.scale.setScalar(1.6 + Math.sin(G.time * 5 + u.ph) * 0.25);
      u.ring.scale.setScalar(1 + Math.sin(G.time * 5 + u.ph) * 0.12);
    }
    const f = M.fruit;
    world.fruit.visible = !!f;
    if (f) {
      if (world.fruit.userData.emoji !== f.emoji) {
        world.fruit.material.map = gfx.emojiTexture(f.emoji);
        world.fruit.material.needsUpdate = true;
        world.fruit.userData.emoji = f.emoji;
      }
      world.fruit.position.set(wx(f.x), 0.9 + Math.sin(G.time * 4) * 0.15, wz(f.y));
      world.fruit.scale.setScalar(f.t < 2 && Math.floor(G.time * 8) % 2 ? 0.0001 : 1.2);
      if (Math.random() < dt * 4) fx.stars.emit(wx(f.x) + (Math.random() - 0.5), 1.4, wz(f.y), { s0: 0.3, s1: 0.05, life: 0.6, vy: 0.8 });
    }
    if (world.moon.visible) world.moon.lookAt && 0;
  }

  // ---------------------------------------------------------------- sound helpers
  function sfx(name, ...args) {
    if (G.attract || G.silent) return;
    if (CC.sfx[name]) CC.sfx[name](...args);
  }

  // ---------------------------------------------------------------- engine events -> effects
  const nameOf = (M, i) => Kit.roster.get(M.players[i].id).name;
  function handleEvents(M) {
    for (const ev of M.events) {
      switch (ev.type) {
        case 'cookie':
          crumbsAt(wx(ev.x), wz(ev.y), 3);
          sfx('cookie');
          if (ev.left === 5 && !G.attract) toast('🍪 5 COOKIES LEFT!', 'good');
          break;
        case 'milk':
          fx.glows.emit(wx(ev.x), 1, wz(ev.y), { color: '#d8f2ff', s0: 2, s1: 7, life: 0.5, drag: 0 });
          burstStars(wx(ev.x), 1.2, wz(ev.y), 8);
          toast('🥛 MILK! THE RACCOONS ARE SLEEPY!', 'good');
          sfx('milk');
          break;
        case 'wake':
          sfx('wake');
          break;
        case 'bonk': {
          const x = wx(drawX(ev.x)), z = wz(ev.y);
          word('BONK!', '#ffffff', '#3d8bff', x, 2.6, z, 0.9);
          word(`+${ev.pts}`, '#ffd400', null, x + 0.6, 3.6, z, 0.6);
          burstStars(x, 1.4, z, 10);
          sfx('bonk', M.chain);
          break;
        }
        case 'home':
          sfx('home');
          break;
        case 'fruitIn':
          puffAt(wx(ev.x), wz(ev.y), 4, { s1: 1.8 });
          sfx('fruitIn');
          break;
        case 'fruit':
          burstStars(wx(ev.x), 1.2, wz(ev.y), 10);
          word(`+${ev.pts}`, '#ffd400', null, wx(ev.x), 3, wz(ev.y), 0.7);
          toast(`${ev.emoji} YUM! +${ev.pts}`, 'good');
          sfx('fruit');
          break;
        case 'fruitOut':
          puffAt(wx(ev.x), wz(ev.y), 3, { s1: 1.4 });
          break;
        case 'caught':
        case 'stuck': {
          const v = cast.players[ev.i];
          if (v) {
            v.word.s.material.map = A.wordTexture('HEE HEE!', '#ffd400', '#ff6a8a');
            v.word.t = 0;
          }
          toast(ev.type === 'stuck' ? `${nameOf(M, ev.i)} IS GETTING TICKLED! HELP HIM!` : 'TICKLE TICKLE!', 'oops');
          sfx('giggle');
          break;
        }
        case 'rescue':
          burstStars(wx(drawX(M.players[ev.i].x)), 1.6, wz(M.players[ev.i].y), 12);
          word('HIGH FIVE!', '#ffffff', '#2fc27a', wx(drawX(M.players[ev.i].x)), 2.8, wz(M.players[ev.i].y), 0.9);
          toast(`✋ ${ev.by.toUpperCase()} SAVED ${nameOf(M, ev.i)}!`, 'save');
          sfx('rescue');
          break;
        case 'heart':
          $('hearts').classList.remove('hit');
          void $('hearts').offsetWidth;
          $('hearts').classList.add('hit');
          sfx('heart');
          break;
        case 'respawn': {
          const p = M.players[ev.i];
          puffAt(wx(p.x), wz(p.y), 6, { s1: 2.4 });
          if (!M.two && G.M === M) G.snapCam = true;
          sfx('pop');
          break;
        }
        case 'buddyIn':
          buddyArrives(M, ev);
          break;
        case 'stop':
          stopShout(M, ev);
          break;
        case 'treat':
          giveTreat(M, ev);
          break;
        case 'munch':
          buddyMunch(M, ev);
          break;
        case 'buddyOut':
          buddyLeaves(M, ev);
          break;
        case 'clear':
          if (!G.attract) mazeCleared(M);
          break;
        case 'over':
          if (!G.attract) mazeLost(M);
          break;
      }
    }
    M.events.length = 0;
  }

  // ---------------------------------------------------------------- the companion (the other brother)
  function buddyArrives(M, ev) {
    const v = cast.buddies[ev.i];
    if (!v) return;
    v.m.root.visible = true;
    v.shown = 0;
    v.leaving = 0;
    v.ang = Math.PI;
    puffAt(wx(ev.x), wz(ev.y), 6, { s1: 2.6 });
    fx.confetti.emit(wx(ev.x), 1.2, wz(ev.y), 30, { speed: 3, up: 6 });
    sfx('buddy');
  }
  function stopShout(M, ev) {
    const v = cast.buddies[ev.i];
    if (!v) return;
    const b = M.buddies[ev.i];
    v.cheer = 0;
    word('STOP!', '#ffffff', '#ff4b5c', wx(b.x), 2.7, wz(b.y), 1.1);
    toast(`${v.entry.name} SAYS: GO GO GO!`, 'good');
    sfx('stop');
  }
  function buddyLeaves(M, ev) {
    const v = cast.buddies[ev.i];
    if (!v) return;
    v.leaving = 0.001;
    sfx('bye');
  }
  function giveTreat(M, ev) {
    const v = cast.buddies[ev.i], pv = cast.players[ev.i];
    if (!v || !pv) return;
    const [emoji, label] = gfx.pick(TREATS);
    dropTreat(pv);
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(emoji), depthWrite: false }));
    s.scale.setScalar(0.7);
    scene.add(s);
    v.m.root.updateMatrixWorld(true);
    const from = People.handWorld(v.m, 1, new T.Vector3());
    s.position.copy(from);
    pv.treat = { s, t: 0, from, held: false };
    toast(`${emoji} ${label} FROM ${v.entry.name}!`, 'good');
    sfx('treat');
  }
  function dropTreat(pv) {
    if (!pv || !pv.treat) return;
    const s = pv.treat.s;
    if (s.parent) s.parent.remove(s);
    s.material.dispose();
    pv.treat = null;
  }
  function updateTreats(dt) {
    for (const pv of cast.players) {
      const tr = pv.treat;
      if (!tr) continue;
      tr.t += dt;
      if (!tr.held) {
        const k = Math.min(1, tr.t / 0.5);
        pv.m.root.updateMatrixWorld(true);
        const to = People.handWorld(pv.m, 1, tmpV);
        tr.s.position.lerpVectors(tr.from, to, k);
        tr.s.position.y += Math.sin(k * Math.PI) * 1.4;
        if (k >= 1) {
          tr.held = true;
          tr.t = 0;
          pv.m.armR.add(tr.s);
          tr.s.position.set(0.12, -0.95, 0.3);
          tr.s.scale.setScalar(1.05);
          fx.stars.emit(to.x, to.y + 0.3, to.z, { s0: 0.3, s1: 0.9, life: 0.4, spin: 5 });
        }
      } else if (tr.t > 5) dropTreat(pv);
    }
  }
  function buddyMunch(M, ev) {
    const bx = wx(ev.x), bz = wz(ev.y);
    ev.cells.forEach((c, k) => {
      const x = wx(c.x), z = wz(c.y), life = 0.3 + c.d * 0.08;
      fx.flyers.emit(x, 0.5, z, { s0: 0.7, s1: 0.35, life, vx: (bx - x) / life, vy: 1.6 / life, vz: (bz - z) / life, drag: 0, alpha: 1 });
      void k;
    });
    crumbsAt(bx, bz, 8);
    if (ev.cells.length) {
      word('MUNCH!', '#ffd400', '#d99a52', bx, 3.2, bz, 0.9);
      toast(`${cast.buddies[ev.i].entry.name} MUNCHED ${ev.cells.length} ${ev.cells.length === 1 ? 'COOKIE' : 'COOKIES'}!`, 'good');
      sfx('munch');
    }
  }

  function syncBuddies(M, dt) {
    M.buddies.forEach((b, i) => {
      const v = cast.buddies[i];
      if (!v) return;
      const m = v.m;
      if (!b.on) {
        if (v.leaving > 0) {
          v.leaving += dt;
          const u = v.leaving / 0.25;
          m.root.scale.setScalar(v.scale * Math.max(0.01, 1 - u));
          if (u >= 1) {
            v.leaving = 0;
            m.root.visible = false;
            puffAt(m.root.position.x, m.root.position.z, 5, { s1: 2.4 });
          }
        } else m.root.visible = false;
        updateBall(v, dt);
        return;
      }
      m.root.visible = true;
      v.shown += dt;
      const pop = Math.min(1, v.shown / 0.2);
      const k = damp(16, dt);
      const t = b.t;
      let mode;
      if (t < 1.3) mode = Kit.roster.signature(v.entry, 'hello');
      else if (t < BUD.munch) mode = 'give';
      else if (t < BUD.bye) mode = 'munch';
      else mode = Kit.roster.signature(v.entry, 'goodbye');
      v.modeT = mode === v.mode ? v.modeT + dt : 0;
      if (mode !== v.mode) v.shot = false;
      v.mode = mode;
      settle(m, k);
      let hop = 0;
      v.ph += dt * 4;
      if (mode === 'jumpshot') {
        const u = Math.min(1, v.modeT / 0.8);
        People.pose(m, 0, 'jumpshot', k);
        hop = Math.sin(u * Math.PI) * 0.8;
        if (u > 0.45 && !v.shot) {
          v.shot = true;
          shootBall(m, v);
        }
      } else if (mode === 'munch') {
        // both hands to his mouth, chomping
        People.pose(m, 0, 'grab', k);
        m.armL.rotation.x = -2.2 + Math.sin(G.time * 18) * 0.25;
        m.armR.rotation.x = -2.2 - Math.sin(G.time * 18) * 0.25;
        m.head.rotation.x = Math.sin(G.time * 18) * 0.1;
        plantFeet(m);
        if (Math.random() < dt * 10) crumbsAt(m.root.position.x, m.root.position.z, 1);
      } else {
        People.pose(m, mode === 'boxing' ? t * 7 : v.ph, mode, k);
        plantFeet(m);
        if (mode === 'peace') hop = Math.abs(Math.sin(t * 5)) * 0.15;
      }
      const owner = M.players[i];
      let target = Math.PI;
      if (mode === 'give' && owner) target = Math.atan2(-(owner.x - b.x), -(owner.y - b.y));
      m.root.rotation.y = turnTo(v, target, dt, 10);
      m.root.scale.setScalar(v.scale * (pop < 1 ? 0.3 + pop * 0.7 + Math.sin(pop * Math.PI) * 0.3 : 1));
      m.root.position.set(wx(b.x), hop, wz(b.y));
      updateBall(v, dt);
    });
  }

  function callBuddy(i) {
    if (!G.M || G.screen !== 'play' || G.phase !== 'play') return;
    Kit.sound.init();
    G.M.callBuddy(i);
  }

  // ---------------------------------------------------------------- camera
  const corners = [];
  for (const x of [wx(-1.7), wx(W + 0.7)]) for (const z of [wz(-0.6), wz(H - 0.4)]) for (const y of [0, 1.2]) corners.push(new T.Vector3(x, y, z));
  const cam = { d: 60, tx: 0, tz: 0 };

  function placeCam(d, tx, tz) {
    camera.position.set(tx, d * Math.sin(TILT), tz + d * Math.cos(TILT));
    camera.lookAt(tx, 0, tz);
    camera.updateMatrixWorld();
  }
  // The distance (and a small forward/back nudge) that fits the whole maze between the HUD and the bottom.
  function fitMaze() {
    const w = innerWidth || 800, h = innerHeight || 600;
    const top = 1 - (2 * Math.min(G.screen === 'play' || G.screen === 'pause' ? 108 : 20, h * 0.2)) / h;
    const bottom = -0.98 + (G.touch && G.screen === 'play' && document.body.classList.contains('pads') && h >= 500 ? (2 * 120) / h : 0);
    const fits = (d, tz) => {
      placeCam(d, 0, tz);
      for (const c of corners) {
        tmpV.copy(c).project(camera);
        if (Math.abs(tmpV.x) > 0.98 || tmpV.y > top || tmpV.y < bottom) return false;
      }
      return true;
    };
    let best = { d: 400, tz: 0 };
    for (const tz of [-4, -3, -2, -1, 0, 1, 2]) {
      let lo = 10, hi = 400;
      if (!fits(hi, tz)) continue;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (fits(mid, tz)) hi = mid;
        else lo = mid;
      }
      if (hi < best.d) best = { d: hi, tz };
    }
    // small screens: don't let the maze get tiny; get closer and follow the boys instead
    const minTile = Math.min(w, h) < 500 ? 32 : 0;
    const dMax = minTile ? (TILE * h) / (2 * Math.tan((FOV * Math.PI) / 360) * minTile) : Infinity;
    return { d: best.d, tz: best.tz, dMax, follow: best.d > dMax * 1.05 };
  }

  function updateCamera(M, dt) {
    if (!G.camFit) G.camFit = fitMaze();
    const f = G.camFit;
    let d = Math.min(f.d, f.dMax), tx = 0, tz = f.tz;
    const live = M ? M.players.filter((p) => p.state !== 'out') : [];
    if (f.follow && live.length) {
      const fx0 = live.reduce((s, p) => s + wx(drawX(p.x)), 0) / live.length;
      const fz0 = live.reduce((s, p) => s + wz(p.y), 0) / live.length;
      // two boys far apart: step back until both are on screen
      if (live.length > 1) {
        const tan = Math.tan((FOV * Math.PI) / 360);
        const dx = Math.abs(wx(drawX(live[0].x)) - wx(drawX(live[1].x))) / 2 + 2.5;
        const dz = Math.abs(wz(live[0].y) - wz(live[1].y)) / 2 + 2.5;
        d = Math.min(f.d, Math.max(d, dx / (tan * camera.aspect * 0.85), (dz * Math.sin(TILT)) / (tan * 0.7)));
      }
      const half = d * Math.tan((FOV * Math.PI) / 360);
      const visW = half * camera.aspect, visD = half / Math.sin(TILT);
      const mx = Math.max(0, (W * TILE) / 2 + 2 - visW * 0.92), mz = Math.max(0, (H * TILE) / 2 + 1.5 - visD * 0.8);
      tx = clamp(fx0, -mx, mx);
      tz = clamp(fz0 + 1, -mz, mz + 1.5);
    }
    // maze clear: lean in on the boy who ate the last cookie
    if (M && M.state === 'clear' && !G.attract) {
      const p = M.players[M.winner] || M.players[0];
      const u = Math.min(1, M.stateT / 1.2);
      d += (Math.min(d, 22) - d) * u;
      tx += (wx(drawX(p.x)) - tx) * u;
      tz += (wz(p.y) - 2.5 - tz) * u;
    }
    if (G.camOverride) {
      const o = G.camOverride;
      d = o.d;
      tx = wx(o.x);
      tz = wz(o.y) + (o.dz || 0);
    }
    const k = damp(4, dt);
    cam.d += (d - cam.d) * k;
    cam.tx += (tx - cam.tx) * k;
    cam.tz += (tz - cam.tz) * k;
    if (G.snapCam) {
      cam.d = d;
      cam.tx = tx;
      cam.tz = tz;
      G.snapCam = false;
    }
    G.shake = Math.max(0, G.shake - dt * 1.6);
    const s = G.shake * G.shake;
    placeCam(cam.d, cam.tx + (Math.random() - 0.5) * s, cam.tz + (Math.random() - 0.5) * s);
    sun.position.set(cam.tx - 14, 34, cam.tz + 18);
    sun.target.position.set(cam.tx, 0, cam.tz);
  }

  function resize() {
    const w = innerWidth || 800, h = innerHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    G.camFit = null;
  }
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- HUD
  const cacheText = {};
  const setText = (el, key, v) => {
    if (cacheText[key] !== v) {
      cacheText[key] = v;
      el.textContent = v;
    }
  };
  function toast(text, cls) {
    if (G.attract) return;
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 1800);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }
  // banners are timed in game time, so step() in tests controls them too
  function banner(html, cls, ms) {
    const b = $('banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.innerHTML = html;
    b.className = 'banner show' + (cls ? ' ' + cls : '');
    G.bannerT = ms ? ms / 1000 : Infinity;
  }
  function hideBanner() {
    G.bannerT = 0;
    $('banner').classList.remove('show');
  }

  function setupHud(M) {
    document.body.classList.toggle('two', M.two);
    $('pb1').style.visibility = M.two ? 'visible' : 'hidden';
    M.players.forEach((p, i) => {
      const pb = $('pb' + i);
      const entry = Kit.roster.get(p.id);
      pb.querySelector('.face img').src = thumbs[i === 1 && M.players[0].id === p.id ? 'p2:' + p.id : p.id] || thumbs[p.id];
      pb.querySelector('.nm').textContent = entry.name;
      const b = M.buddies[i], be = Kit.roster.get(b.id);
      pb.querySelector('.bud img').src = thumbs[b.id];
      pb.querySelector('.bud').title = `Call ${nice(be.name)}`;
      pb.querySelector('.bud .k').textContent = i === 0 ? 'T' : 'Enter';
      const btn = $('bud' + i);
      btn.querySelector('img').src = thumbs[b.id];
      btn.querySelector('small').textContent = be.name;
      btn.title = `Call ${nice(be.name)} (${i === 0 ? 'T' : 'Enter'})`;
    });
    $('mazeName').textContent = `MAZE ${M.n + 1} · ${M.L.name}`;
    for (const k in cacheText) delete cacheText[k];
    padsClass();
  }

  function updateHud(M) {
    if (!M || G.attract) return;
    M.players.forEach((p, i) => {
      const pb = $('pb' + i);
      setText(pb.querySelector('.ate b'), `a${i}`, String(p.ate));
      pb.classList.toggle('stuck', p.state === 'stuck' || p.state === 'caught');
      const b = M.buddies[i];
      const fill = b.on ? clamp(1 - b.t / BUD.visit, 0, 1) : 1;
      pb.querySelector('.bud').classList.toggle('on', b.on);
      pb.querySelector('.bud i').style.setProperty('--fill', b.on ? fill.toFixed(3) : '0');
      const btn = $('bud' + i);
      btn.classList.toggle('on', b.on);
      btn.style.setProperty('--fill', fill.toFixed(3));
    });
    const max = Math.max(M.hearts, (M.two ? TUNE.coopHearts : TUNE.hearts)[M.diff]);
    setText($('hearts'), 'hearts', '❤️'.repeat(M.hearts) + '🤍'.repeat(Math.max(0, max - M.hearts)));
    setText($('cookies').querySelector('b'), 'cookies', String(M.cookiesLeft));
    $('cookies').classList.toggle('few', M.cookiesLeft <= 6 && M.cookiesLeft > 0);
    setText($('score'), 'score', `SCORE ${M.score.toLocaleString('en-US')}`);
    const milk = $('milk');
    milk.classList.toggle('hidden', !(M.sleepyT > 0));
    if (M.sleepyT > 0) {
      milk.querySelector('i').style.setProperty('--fill', clamp(M.sleepyT / M.T.milk, 0, 1).toFixed(3));
      milk.classList.toggle('low', M.sleepyT < TUNE.milkBlink);
    }
  }

  // ---------------------------------------------------------------- screens
  const SCREENS = ['title', 'select', 'pause', 'results'];
  function show(name) {
    G.screen = name;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
    $('hud').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
    CC.Input.setActive(name === 'play');
    padsClass();
    G.camFit = null;
    Kit.sound.music(name === 'play' ? 'play' : name === 'pause' ? 'pause' : name === 'results' ? 'over' : 'title');
  }
  function padsClass() {
    const on = G.touch && (G.screen === 'play' || G.screen === 'pause') && (G.two || saved.pads);
    document.body.classList.toggle('pads', on);
  }

  function titleScreen() {
    G.run = null;
    hideBanner();
    show('title');
    startAttract();
    focusMode(0);
  }

  // The autopilot plays behind the menus: Teddy and Tommy clearing a maze together.
  function startAttract() {
    G.attract = true;
    const n = Math.floor(Math.random() * 3);
    const M = E.create({ n, diff: 'easy', heroes: ['teddy', 'tommy'], seed: (Math.random() * 1e9) >>> 0, cpu: [true, true] });
    M.hearts = 99;
    G.M = M;
    document.body.classList.remove('two');
    buildWorld(M);
    G.phase = 'play';
    G.phaseT = 0;
    G.snapCam = true;
  }

  // ---- title: pick 1 or 2 players and a difficulty
  const modeBtns = ['mode1', 'mode2'];
  let modeFocus = 0;
  function focusMode(k) {
    modeFocus = (k + modeBtns.length) % modeBtns.length;
    modeBtns.forEach((id, j) => $(id).classList.toggle('focus', j === modeFocus && G.keyNav));
  }
  function setDiff(d) {
    G.diff = d;
    saved.diff = d;
    persist();
    document.querySelectorAll('.lvl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === d)));
  }
  function setPads(on) {
    saved.pads = !!on;
    persist();
    $('padToggle').classList.toggle('on', saved.pads);
    $('padToggle').textContent = saved.pads ? '🎮 D-PAD: ON' : '🎮 D-PAD: OFF';
    padsClass();
  }

  // ---- select: heroes and the maze
  const sel = { k: [0, 1], maze: 0 };
  function selectScreen(two) {
    G.two = two;
    const heroes = CC.HEROES;
    sel.k = [Math.max(0, heroes.indexOf(G.heroes[0])), Math.max(0, heroes.indexOf(G.heroes[1] || 'tommy'))];
    if (two && sel.k[0] === sel.k[1]) sel.k[1] = (sel.k[0] + 1) % heroes.length;
    sel.maze = Math.min(saved.unlocked, Z.count - 1);
    $('slot1').style.display = two ? '' : 'none';
    $('selVs').style.display = two ? '' : 'none';
    $('selTitle').textContent = two ? 'TEAM UP!' : 'PICK YOUR HERO';
    const k = (...keys) => keys.map((x) => `<kbd>${x}</kbd>`).join('');
    $('selHint').innerHTML = two
      ? `1P ${k('A', 'D')} · 2P ${k('←', '→')} · ${k('W', 'S')} maze · ${k('Enter')} go · ${k('Esc')} back`
      : `${k('A', 'D')} or ${k('←', '→')} hero · ${k('W', 'S')} maze · ${k('Enter')} go · ${k('Esc')} back`;
    renderSelect();
    show('select');
  }
  function renderSelect() {
    const heroes = CC.HEROES;
    [0, 1].forEach((i) => {
      const id = heroes[sel.k[i]];
      const slot = $('slot' + i);
      const same = i === 1 && heroes[sel.k[0]] === id;
      slot.querySelector('.pick img').src = thumbs[same ? 'p2:' + id : id];
      slot.querySelector('.nm').textContent = Kit.roster.get(id).name;
      const bid = Kit.roster.buddyFor(id);
      slot.querySelector('.pal img').src = thumbs[bid];
      slot.querySelector('.pal b').textContent = Kit.roster.get(bid).name;
    });
    const def = Z.MAZES[sel.maze];
    $('mazeLabel').innerHTML = `MAZE ${sel.maze + 1}<small>${def.name}${sel.maze < saved.unlocked ? ' ✓' : ''}</small>`;
    const pips = $('pips');
    pips.innerHTML = '';
    for (let n = 0; n < Z.count; n++) {
      const i = document.createElement('i');
      const lock = n > saved.unlocked;
      i.className = (n === sel.maze ? 'on ' : '') + (lock ? 'lock' : n < saved.unlocked ? 'done' : '');
      i.textContent = lock ? '🔒' : String(n + 1);
      if (!lock) i.addEventListener('click', () => pickMaze(n));
      pips.appendChild(i);
    }
    document.querySelectorAll('.mazepick .arrow').forEach((a) => (a.disabled = +a.dataset.s < 0 ? sel.maze <= 0 : sel.maze >= Math.min(saved.unlocked, Z.count - 1)));
  }
  function cycleHero(i, d) {
    sel.k[i] = (sel.k[i] + d + CC.HEROES.length) % CC.HEROES.length;
    sfx('click');
    renderSelect();
  }
  function pickMaze(n) {
    sel.maze = clamp(n, 0, Math.min(saved.unlocked, Z.count - 1));
    sfx('click');
    renderSelect();
  }

  // ---------------------------------------------------------------- game flow
  function startGame() {
    const heroes = CC.HEROES;
    G.heroes = [heroes[sel.k[0]], heroes[sel.k[1]]];
    saved.heroes = G.heroes.slice();
    persist();
    G.attract = false;
    G.run = { n: sel.maze, score: 0, startScore: 0, newBest: false };
    startMaze();
  }

  function startMaze() {
    const r = G.run;
    r.startScore = r.score;
    const M = E.create({ n: r.n, diff: G.diff, heroes: G.two ? G.heroes.slice(0, 2) : [G.heroes[0]], seed: (Math.random() * 1e9) >>> 0, score: r.score });
    begin(M);
    banner(`MAZE ${r.n + 1}<small>${M.L.name}</small>`, 'cool', 1600);
    CC.Input.setTwoPlayer(G.two);
  }

  function begin(M) {
    G.M = M;
    G.attract = false;
    buildWorld(M);
    setupHud(M);
    CC.Input.clear();
    G.phase = 'intro';
    G.phaseT = 0;
    G.acc = 0;
    G.snapCam = true;
    show('play');
    sfx('ready');
  }

  function mazeCleared(M) {
    G.phase = 'outro';
    G.phaseT = 0;
    const p = M.players[M.winner] || M.players[0];
    const name = Kit.roster.get(p.id).name;
    banner(`MAZE CLEAR!<small>${name} ate the last cookie!</small>`, 'win');
    fx.confetti.emit(wx(drawX(p.x)), 3, wz(p.y), 160, { speed: 6, up: 8 });
    sfx('fanfare');
    const r = G.run;
    r.score = M.score;
    saved.unlocked = Math.min(Z.count - 1, Math.max(saved.unlocked, r.n + 1));
    if (r.n + 1 >= Z.count) saved.allDone = true;
    if (r.score > (saved.best[G.diff] || 0)) {
      saved.best[G.diff] = r.score;
      r.newBest = true;
    }
    persist();
    G.after = () => results(r.n + 1 >= Z.count ? 'done' : 'clear', M);
  }

  function mazeLost(M) {
    G.phase = 'outro';
    G.phaseT = 0;
    banner('OOPS!<small>Out of hearts</small>', '');
    sfx('sad');
    const r = G.run;
    if (M.score > (saved.best[G.diff] || 0)) {
      saved.best[G.diff] = M.score;
      r.newBest = true;
      persist();
    }
    G.after = () => results('over', M);
  }

  // results: 'clear' (next maze), 'over' (out of hearts), 'done' (every maze cleared)
  function results(kind, M) {
    hideBanner();
    G.resKind = kind;
    const stats = $('resStats');
    stats.innerHTML = '';
    const line = (k, v, extra = '') => (stats.innerHTML += `<div><b>${k}</b>${v}${extra}</div>`);
    const winner = M.players[M.winner] || M.players[0];
    $('resFace').src = thumbs[M.winner === 1 && M.players[0].id === winner.id ? 'p2:' + winner.id : winner.id];
    const r = G.run;
    if (kind === 'over') {
      $('resTitle').textContent = 'OOPS!';
      $('resSub').textContent = `Out of hearts in maze ${M.n + 1}. Have another go!`;
      $('againBtn').textContent = '↻ TRY AGAIN';
      $('resHint').textContent = 'Enter try again · Esc menu';
    } else if (kind === 'done') {
      $('resTitle').textContent = 'YOU DID IT!';
      $('resSub').textContent = 'Every maze cleared. High five! ✋';
      $('againBtn').textContent = '↻ PLAY AGAIN';
      $('resHint').textContent = 'Enter play again · Esc menu';
    } else {
      $('resTitle').textContent = 'MAZE CLEAR!';
      $('resSub').textContent = `${Kit.roster.get(winner.id).name} ate the last cookie!`;
      $('againBtn').textContent = 'NEXT MAZE ▶';
      $('resHint').textContent = 'Enter next maze · Esc menu';
    }
    line('SCORE', M.score.toLocaleString('en-US'));
    line('BEST', (saved.best[G.diff] || 0).toLocaleString('en-US'), r && r.newBest ? ' <span class="new">⭐ NEW BEST!</span>' : '');
    M.players.forEach((p) => line(Kit.roster.get(p.id).name, `🍪 ${p.ate}`));
    show('results');
  }

  function again() {
    const r = G.run;
    if (!r) return titleScreen();
    if (G.resKind === 'over') {
      r.score = r.startScore;
    } else if (G.resKind === 'done') {
      r.n = 0;
      r.score = 0;
    } else r.n++;
    r.newBest = false;
    startMaze();
  }

  function pause(on) {
    if (on && G.screen === 'play') show('pause');
    else if (!on && G.screen === 'pause') show('play');
  }

  // ---------------------------------------------------------------- the loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (G.hold) {
      last = now;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt);
    renderer.render(scene, camera);
  }

  function tick(dt) {
    G.time += dt;
    const M = G.M;
    if (!M) return;
    const playing = G.screen === 'play' || (G.attract && (G.screen === 'title' || G.screen === 'select')) || (G.screen === 'results' && M.state === 'clear');
    if (playing) {
      G.phaseT += dt;
      if (G.phase === 'intro') {
        if (G.phaseT > 1.7) {
          G.phase = 'play';
          G.phaseT = 0;
          banner('GO!', '', 600);
          sfx('go');
        }
      } else {
        const inputs = G.attract
          ? M.players.map((p, i) => ({ dir: CC.Brain.think(M, i), buddy: CC.Brain.wantsBuddy(M, i) && Math.random() < 0.02 }))
          : G.screen === 'play' ? [CC.Input.read(0), CC.Input.read(1)] : [];
        G.acc += dt;
        while (G.acc >= E.DT) {
          M.step(E.DT, inputs);
          for (const inp of inputs) inp.buddy = false;
          G.acc -= E.DT;
        }
        handleEvents(M);
        if (G.attract && M.state !== 'play' && M.stateT > 4) {
          startAttract();
          return;
        }
        if (G.phase === 'outro' && G.phaseT > (M.state === 'over' ? 2.2 : 3.6) && G.after) {
          const f = G.after;
          G.after = null;
          f();
          return;
        }
      }
    }
    syncThings(G.M, dt);
    syncPlayers(G.M, dt);
    syncCoons(G.M, dt);
    syncBuddies(G.M, dt);
    updateTreats(dt);
    fx.puffs.update(dt);
    fx.stars.update(dt);
    fx.crumbs.update(dt);
    fx.flyers.update(dt);
    fx.glows.update(dt);
    fx.confetti.update(dt);
    updateWords(dt);
    updateCamera(G.M, dt);
    if (G.screen === 'play') updateHud(G.M);
    if (G.bannerT > 0) {
      G.bannerT -= dt;
      if (G.bannerT <= 0) $('banner').classList.remove('show');
    }
  }

  // ---------------------------------------------------------------- input wiring
  function wire() {
    const tap = (id, fn) => $(id).addEventListener('click', (e) => {
      Kit.sound.init();
      sfx('click');
      fn(e);
      e.currentTarget.blur();
    });
    tap('mode1', () => selectScreen(false));
    tap('mode2', () => selectScreen(true));
    document.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => {
      Kit.sound.init();
      setDiff(b.dataset.level);
      sfx('click');
    }));
    tap('padToggle', () => setPads(!saved.pads));
    document.querySelectorAll('.slot').forEach((slot, i) => slot.querySelectorAll('.arrow').forEach((a) => a.addEventListener('click', () => cycleHero(i, +a.dataset.d))));
    document.querySelectorAll('.mazepick .arrow').forEach((a) => a.addEventListener('click', () => pickMaze(sel.maze + +a.dataset.s)));
    tap('selGo', startGame);
    tap('selBack', titleScreen);
    tap('pauseBtn', () => pause(true));
    tap('resumeBtn', () => pause(false));
    tap('quitBtn', titleScreen);
    tap('againBtn', again);
    tap('menuBtn', titleScreen);
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => {
      Kit.sound.init();
      Kit.sound.toggleMute();
      muteIcon();
    }));
    // the companion buttons: big, with his face
    [0, 1].forEach((i) => {
      const btn = $('bud' + i);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('down');
        callBuddy(i);
      });
      const up = () => btn.classList.remove('down');
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });
    CC.Input.bindPad(0, $('pad0'));
    CC.Input.bindPad(1, $('pad1'));
    CC.Input.onSwipe(swipeArrow);

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !G.touch) setTouch(true);
    }, true);
    addEventListener('keydown', (e) => {
      Kit.sound.init();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      onKey(e);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.autoPause) pause(true);
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
  }

  function swipeArrow(side, dir) {
    const el = $('swipeArrow');
    el.textContent = ['▲', '▶', '▼', '◀'][dir];
    el.style.left = G.two ? (side ? '75%' : '25%') : '50%';
    el.style.top = '70%';
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  function setTouch(on) {
    G.touch = on;
    G.camFit = null;
    document.body.classList.toggle('touch', on);
    padsClass();
  }

  function muteIcon() {
    document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
  }

  function onKey(e) {
    const k = e.code;
    if (k === 'KeyM') {
      Kit.sound.toggleMute();
      muteIcon();
      return;
    }
    if (G.screen === 'title') {
      G.keyNav = true;
      if (k === 'ArrowLeft' || k === 'KeyA') focusMode(modeFocus - 1);
      else if (k === 'ArrowRight' || k === 'KeyD') focusMode(modeFocus + 1);
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'ArrowDown' || k === 'KeyS') setDiff(G.diff === 'easy' ? 'normal' : 'easy');
      else if (k === 'Digit1') selectScreen(false);
      else if (k === 'Digit2') selectScreen(true);
      else if (k === 'Enter' || k === 'Space') {
        e.preventDefault();
        selectScreen(modeFocus === 1);
      }
      focusMode(modeFocus);
    } else if (G.screen === 'select') {
      if (k === 'KeyA') cycleHero(0, -1);
      else if (k === 'KeyD') cycleHero(0, 1);
      else if (k === 'ArrowLeft') cycleHero(G.two ? 1 : 0, -1);
      else if (k === 'ArrowRight') cycleHero(G.two ? 1 : 0, 1);
      else if (k === 'KeyW' || k === 'ArrowUp') pickMaze(sel.maze + 1);
      else if (k === 'KeyS' || k === 'ArrowDown') pickMaze(sel.maze - 1);
      else if (k === 'Enter' || k === 'Space') {
        e.preventDefault();
        startGame();
      } else if (k === 'Escape') titleScreen();
    } else if (G.screen === 'play') {
      if (k === 'KeyP' || k === 'Escape') pause(true);
    } else if (G.screen === 'pause') {
      if (k === 'KeyP' || k === 'Escape' || k === 'Space' || k === 'Enter') {
        e.preventDefault();
        pause(false);
      } else if (k === 'KeyQ') titleScreen();
    } else if (G.screen === 'results') {
      if (k === 'Enter' || k === 'Space') {
        e.preventDefault();
        again();
      } else if (k === 'Escape') titleScreen();
    }
  }

  // Switching language mid-game: the HEE HEE! bursts already made are redrawn (other words are drawn fresh each time).
  if (Kit.lang) {
    Kit.lang.onChange(() => {
      for (const v of cast.players) {
        v.word.s.material.map = A.wordTexture('HEE HEE!', '#ffd400', '#ff6a8a');
        v.help.material.map = A.wordTexture('HELP!', '#ffffff', '#3d8bff');
        v.word.s.material.needsUpdate = v.help.material.needsUpdate = true;
      }
    });
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    document.title = `${CC.TITLE} · Teddy & Tommy`;
    $('logoMain').innerHTML = CC.TITLE.replace(/TT/g, '<span class="tt">TT</span>');
    $('tagline').textContent = CC.SUBTITLE;
    resize();
    const entries = Kit.roster.list.slice();
    for (const id of CC.HEROES) entries.push({ id: 'p2:' + id, look: lookFor(id, 'p2'), pose: Kit.roster.get(id).pose });
    thumbs = Kit.portraits(entries, { size: 152 });
    // the raccoons' portraits for the title screen
    const cl = $('coonList');
    CC.COONS.forEach((c, k) => {
      const s = document.createElement('span');
      s.innerHTML = `<img alt="" src="${coonPortrait(k)}"><span><b data-no-lang>${c.name}</b> ${c.does}</span>`;
      cl.appendChild(s);
    });
    setDiff(G.diff);
    setPads(saved.pads);
    muteIcon();
    if (Kit.sound.onMute) Kit.sound.onMute(muteIcon); // the kit's own speaker button and the ? panel flip it too
    wire();
    if (matchMedia('(hover: none) and (pointer: coarse)').matches) setTouch(true);
    $('loading').classList.add('hidden');
    titleScreen();
    requestAnimationFrame(frame);
  }

  // A head-and-shoulders picture of raccoon k, drawn once with a throwaway renderer.
  function coonPortrait(k) {
    const size = 96;
    const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(size, size, false);
    r.outputEncoding = T.sRGBEncoding;
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight('#ffffff', '#666688', 1.1));
    const l = new T.DirectionalLight('#ffffff', 0.8);
    l.position.set(2, 3, 4);
    sc.add(l);
    const rc = A.makeRaccoon(CC.COONS[k].scarf);
    rc.root.rotation.y = Math.PI + 0.35;
    sc.add(rc.root);
    const c = new T.PerspectiveCamera(28, 1, 0.1, 50);
    c.position.set(0, 1.45, 3.3);
    c.lookAt(0, 1.25, 0);
    r.render(sc, c);
    const url = r.domElement.toDataURL('image/png');
    r.dispose();
    if (r.forceContextLoss) r.forceContextLoss();
    return url;
  }

  // ---------------------------------------------------------------- test hooks (window.game)
  // The hidden Browser pane throttles requestAnimationFrame, so step() ticks and renders synchronously.
  const DIRS = { up: 0, right: 1, down: 2, left: 3 };
  window.game = {
    G, cast, world, scene, camera,
    step(seconds = 0.5) {
      G.autoPause = false;
      const n = Math.max(1, Math.round(seconds / (1 / 60)));
      for (let k = 0; k < n; k++) tick(1 / 60);
      renderer.render(scene, camera);
      return this.state();
    },
    hold(on = true) {
      G.hold = on;
      G.autoPause = false;
      return on;
    },
    render() {
      renderer.render(scene, camera);
    },
    // jump straight into a maze: { two, diff, heroes, maze }
    start(o = {}) {
      Kit.sound.init();
      G.autoPause = false;
      G.diff = o.diff || G.diff;
      G.two = !!o.two;
      const heroes = o.heroes || ['teddy', 'tommy'];
      sel.k = heroes.map((h) => CC.HEROES.indexOf(h));
      if (sel.k.length < 2) sel.k.push(1);
      sel.maze = o.maze || 0;
      startGame();
      if (o.go !== false) this.step(1.8);
      return this.state();
    },
    state() {
      const M = G.M;
      if (!M) return { screen: G.screen };
      return {
        screen: G.screen, phase: G.phase, state: M.state, maze: M.n + 1, name: M.L.name, hearts: M.hearts, score: M.score, left: M.cookiesLeft,
        sleepy: +M.sleepyT.toFixed(2), freeze: +M.freezeT.toFixed(2), mode: M.mode, fruit: M.fruit && M.fruit.emoji,
        players: M.players.map((p) => ({ id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), dir: p.dir, want: p.want, state: p.state, safe: +p.safe.toFixed(2), ate: p.ate })),
        coons: M.coons.map((c) => ({ name: c.name, x: +c.x.toFixed(2), y: +c.y.toFixed(2), state: c.state, sleepy: c.sleepy })),
        buddies: M.buddies.map((b) => ({ id: b.id, on: b.on, t: +b.t.toFixed(2), x: b.x, y: b.y })),
      };
    },
    // steer player i for a moment: game.press(0, 'left', 0.5)
    press(i, what, seconds = 0.05) {
      const n = Math.max(1, Math.round(seconds * 60));
      const M = G.M;
      for (let k = 0; k < n; k++) {
        const inputs = [];
        inputs[i] = { dir: DIRS[what] ?? -1, buddy: what === 'buddy' && k === 0 };
        M.step(E.DT, inputs);
        handleEvents(M);
        tick(0);
      }
      renderer.render(scene, camera);
      return this.state();
    },
    // put player i at a cell, facing a way
    put(i, x, y, dir = -1) {
      Object.assign(G.M.players[i], { cx: x, cy: y, t: 0, dir, want: dir, x, y, safe: 0 });
      return this.step(0.02);
    },
    buddy(i = 0) {
      callBuddy(i);
      return this.step(0.05);
    },
    // eat every cookie but one, and put player i next to it
    almost(i = 0) {
      const M = G.M;
      const cells = [];
      for (let c = 0; c < W * H; c++) if (M.food[c] === Z.COOKIE) cells.push(c);
      const keep = cells[cells.length - 1];
      for (const c of cells) if (c !== keep) M.food[c] = Z.NONE;
      M.cookiesLeft = 1;
      M.eaten = M.total - 1;
      const x = keep % W, y = (keep / W) | 0;
      const d = Z.walkable(Z.at(M.L.cells, x - 1, y)) ? [x - 1, y, 1] : Z.walkable(Z.at(M.L.cells, x + 1, y)) ? [x + 1, y, 3] : Z.walkable(Z.at(M.L.cells, x, y - 1)) ? [x, y - 1, 2] : [x, y + 1, 0];
      for (const c of M.coons) if (c.state === 'roam') Object.assign(c, { state: 'den', cx: M.L.spots[c.k].x, cy: M.L.spots[c.k].y, t: 0, releaseAt: M.time + 99 });
      return this.put(i, d[0], d[1], d[2]);
    },
    cam(o) {
      G.camOverride = o;
      G.snapCam = true;
      return this.step(0.02);
    },
    check: () => CC.Check.checkAll(),
    sabotage: () => CC.Check.sabotage(),
    tunnels: () => CC.Check.tunnels(),
    walls: (o) => CC.Check.walls(o || { seconds: 30, seeds: 1 }),
    soak: (o) => CC.Check.soak(o),
    title: titleScreen,
    results: (kind) => results(kind, G.M),
    toast,
    setTouch,
    setPads,
    saved: () => saved,
  };

  try {
    boot();
  } catch (err) {
    $('loading').textContent = 'Oops, something went wrong: ' + err.message;
    throw err;
  }
})();
