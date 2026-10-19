#!/usr/bin/env node
/* Runs the headless checks in Node (no browser, no npm):
     node tools/check.js            the maze check, sabotage, tunnels, the wall watch and the soak (first 3 mazes, Easy)
     node tools/check.js --all      the soak on every maze, Easy and Normal, 1 and 2 players, with and without the companion
     node tools/check.js --seeds=N  more seeds for the wall watch and the soak
   Loads the kit roster and the game's own rule files into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
ctx.Kit = {};
vm.createContext(ctx);
for (const f of ['kit/roster.js', 'js/title.js', 'js/config.js', 'js/mazes.js', 'js/engine.js', 'js/brain.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const C = ctx.CC.Check;
const args = process.argv.slice(2);
const seeds = Number((args.find((a) => a.startsWith('--seeds=')) || '').split('=')[1]) || 3;
let bad = 0;

const all = C.checkAll();
console.log(`maze check: ${all.mazes} mazes, ${all.failed} with problems`);
for (const f of all.fails) console.log(`  FAIL maze ${f.n} ${f.name}: ${f.probs.join('; ')}`);
bad += all.failed;

const sab = C.sabotage();
console.log(`sabotage: ${sab.filter((s) => s.caught).length} of ${sab.length} broken things caught`);
for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.caught ? ' (' + s.probs[0] + ')' : ''}`);
bad += sab.filter((s) => !s.caught).length;

const tun = C.tunnels();
console.log(`tunnels: ${tun.tried} trips through the side tunnels, ${tun.fails.length} problems`);
for (const f of tun.fails) console.log('  FAIL', f);
bad += tun.fails.length;

for (const two of [false, true]) {
  const t0 = Date.now();
  const w = C.walls({ seconds: 90, seeds, two });
  console.log(`wall watch (${two ? '2 players' : '1 player'}): ${w.steps.toLocaleString()} steps of random steering on every maze, ${w.wraps} tunnel wraps, ${w.fails.length} problems (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const f of w.fails.slice(0, 10)) console.log('  FAIL', f);
  bad += w.fails.length;
}

const line = (r) => `  ${String(r.n + 1).padStart(2)} ${r.name.padEnd(17)} ${r.diff.padEnd(6)} seed ${r.seed}  ${r.result.padEnd(5)} ${String(r.time).padStart(4)} s  hearts left ${r.hearts}  caught ${r.caught}  bonks ${r.bonks}  fruit ${r.fruits}  calls ${r.calls}  munched ${r.munched}  rescues ${r.rescues}  wraps ${r.wraps}${r.left ? '  cookies left ' + r.left : ''}${r.wall ? '  WALL: ' + r.wall : ''}`;
const runs = [];
if (args.includes('--all')) {
  for (const diff of ['easy', 'normal']) for (const two of [false, true]) for (const buddy of [false, true]) for (let n = 0; n < 8; n++) for (let s = 1; s <= seeds; s++) runs.push({ n, diff, seed: s, two, buddy });
} else {
  for (let n = 0; n < 3; n++) for (let s = 1; s <= seeds; s++) runs.push({ n, diff: 'easy', seed: s, two: false, buddy: false });
}
const groups = {};
for (const o of runs) {
  const r = C.soak(o);
  const key = `${o.diff} ${o.two ? '2P' : '1P'}${o.buddy ? ' + companion' : ''}`;
  (groups[key] = groups[key] || []).push(r);
  if (!args.includes('--all') || r.result !== 'clear') console.log(line(r) + (args.includes('--all') ? `  [${key}]` : ''));
  if (r.wall) bad++;
  if (!args.includes('--all') && r.result !== 'clear') bad++;
}
for (const [key, rs] of Object.entries(groups)) {
  const cleared = rs.filter((r) => r.result === 'clear').length;
  console.log(`soak ${key}: cleared ${cleared}/${rs.length}, caught ${rs.reduce((s, r) => s + r.caught, 0)} times, average ${Math.round(rs.reduce((s, r) => s + r.time, 0) / rs.length)} s a maze`);
}
process.exitCode = bad ? 1 : 0;
