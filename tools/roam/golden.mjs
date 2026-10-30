// [roam] The Roam golden runs: the town and the rules, headless, under scripted input for a fixed time; the state is hashed
// every few seconds. A refactor must leave the hashes byte for byte identical; only an intended rule change re-records them
// (--write, in its own commit). Usage: node tools/roam/golden.mjs [--check | --write]
import './headless.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const { buildTown } = await import('../../src/roam/town.js');
const { createRoam } = await import('../../src/roam/sim.js');

const FILE = new URL('../../test/roam-golden.json', import.meta.url);
const SCENARIOS = [{ name: 'ride-and-walk', town: 7, seed: 1, secs: 120 }, { name: 'night', town: 7, seed: 5, secs: 90, clock: 30 }];
const r3 = v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
// what the run is judged on: the player, the vehicle, every enemy and nest, the score; numbers to 3 decimals
function snapshot(S) {
  const pick = o => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'object' || v === null).map(([k, v]) => [k, r3(v)]));
  const scalars = Object.fromEntries(Object.entries(S).filter(([, v]) => typeof v !== 'object').map(([k, v]) => [k, r3(v)]));
  return JSON.stringify({ ...scalars, kai: pick(S.kai), bike: pick(S.bike), foes: (S.machines || S.dead).map(pick), nests: S.nests.map(pick), shots: (S.shots || []).map(pick), broken: [...S.broken].sort() });
}
// the script: she starts on the bike; ride loops round the town firing on and off, get off and fight on foot (dashing),
// get back on
function input(i, S) {
  const t = i / 30, inp = { x: 0, y: 0, view: 30, fire: t % 8 < 5 };   // the gun held five seconds in eight
  if (Math.abs(t - 70) < 0.02 || Math.abs(t - 95) < 0.02) inp.ride = true;
  else if (t < 70 || t > 95) { inp.x = Math.cos(t * 0.35) * 0.9; inp.y = Math.sin(t * 0.21) * 0.9; }
  else { inp.x = Math.sin(t * 0.9); inp.y = Math.cos(t * 0.6); if (i % 90 === 0) inp.dash = true; }
  return inp;
}
export function runScenario(sc) {
  const town = buildTown(sc.town), sim = createRoam(town, sc.seed), hashes = [];
  if (sc.clock) sim.state.clock = sc.clock + 240 * 0;   // start time of day
  if (sc.clock) sim.setClockRate(20);
  const steps = sc.secs * 30;
  for (let i = 1; i <= steps; i++) { sim.step(input(i, sim.state)); sim.drain(); if (i % 150 === 0) hashes.push(crypto.createHash('sha1').update(snapshot(sim.state)).digest('hex').slice(0, 16)); }
  return hashes;
}
const mode = process.argv[2];
if (mode === '--check' || mode === '--write') {
  const got = {}; for (const sc of SCENARIOS) got[sc.name] = runScenario(sc);
  if (mode === '--write') { fs.writeFileSync(FILE, JSON.stringify(got, null, 1) + '\n'); console.log('roam golden written'); }
  else { const want = JSON.parse(fs.readFileSync(FILE, 'utf8')); let ok = true;
    for (const k of Object.keys(want)) { const a = want[k], b = got[k] || []; const i = a.findIndex((h, j) => h !== b[j]); if (i >= 0 || a.length !== b.length) { ok = false; console.log(`${k}: differs from ${(i + 1) * 5} s`); } else console.log(`${k}: ok (${a.length} hashes)`); }
    process.exit(ok ? 0 : 1); }
}
