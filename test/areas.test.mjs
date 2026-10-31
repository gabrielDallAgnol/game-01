// [m4] Areas: the town's districts become a few areas with levels (further is harder), each with one walker; a walker's
// plates take hits before its core; killing it makes the area clean: its nests go dark and no machine is born there.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
import { MACHINES } from '../src/play/machines.js';
import { DROPS } from '../src/play/loot.js';
const { buildTown } = await import('../src/roam/town.js');
const { createRoam } = await import('../src/roam/sim.js');
const town = buildTown(7);
const fresh = () => { const sim = createRoam(town, 3); return { sim, S: sim.state }; };
const run = (sim, s, inp = {}) => { for (let i = 0; i < s * 30; i++) { sim.step({ x: 0, y: 0, view: 21, ...inp }); sim.drain(); } };
test('the walker explains itself and has a drop table', () => { assert.ok(MACHINES.walker.desc && MACHINES.walker.why); assert.ok(DROPS.walker.desc && DROPS.walker.why); });
test('a few areas, each with one walker; the start area is level 1 and further ones are higher', () => { const { S } = fresh(); const roots = S.areas.filter(a => a.root === undefined);
  assert.ok(roots.length >= 3 && roots.length <= 10, `${roots.length} areas`); const w = S.dead.filter(d => d.boss); assert.strictEqual(w.length, roots.filter(a => a.walker >= 0).length);
  const here = S.areas[S.areaGrid.ids[Math.floor(S.kai.y / 8) * S.areaGrid.gw + Math.floor(S.kai.x / 8)]]; assert.strictEqual(here.level, 1); assert.ok(Math.max(...roots.map(a => a.level)) > 1); });
test('plates take hits first; the core after; killing it cleans the area, darkens its nests, and nothing more is born there', () => { const { sim, S } = fresh();
  const w = S.dead.filter(d => d.boss).sort((a, b) => Math.hypot(a.x - S.kai.x, a.y - S.kai.y) - Math.hypot(b.x - S.kai.x, b.y - S.kai.y))[0], a = S.areas[w.area];
  let st = null; for (let ang = 0; ang < 6.28 && !st; ang += 0.2) { const x = w.x + Math.cos(ang) * 13, y = w.y + Math.sin(ang) * 13; let clear = true; for (let q = 0; q <= 1; q += 0.05) if (town.blocked(x + (w.x - x) * q, y + (w.y - y) * q)) clear = false; if (clear) st = { x, y }; }
  assert.ok(st, 'a clear line to the walker'); S.kai.x = S.bike.x = st.x; S.kai.y = S.bike.y = st.y; const only = () => { S.dead = S.dead.filter(d => d === w); }; const aim = () => Math.atan2(w.y - S.kai.y, w.x - S.kai.x); sim.setLoadout({ base: 'launcher', el: null, enchant: null }); const hp0 = w.hp;
  for (let i = 0; i < 30 * 8 && w.plates === 4; i++) { S.kai.hp = 999; only(); sim.step({ x: 0, y: 0, view: 21, fire: true, aim: aim() }); sim.drain(); } assert.ok(w.plates < 4); assert.strictEqual(w.hp, hp0, 'core untouched while plates stand');
  for (let i = 0; i < 30 * 120 && S.dead.includes(w); i++) { S.kai.hp = 999; only(); sim.step({ x: 0, y: 0, view: 21, fire: true, aim: aim() }); sim.drain(); }
  assert.ok(!S.dead.includes(w), 'walker down'); assert.strictEqual(a.state, 'clean');
  for (const n of S.nests) if (sim.state.areas[S.areaGrid.ids[Math.floor(n.y / 8) * S.areaGrid.gw + Math.floor(n.x / 8)]] === a) assert.ok(!n.alive, 'its nests are dark');
  S.dead.length = 0; run(sim, 20); const born = S.dead.filter(d => { const k = S.areaGrid.ids[Math.floor(d.y0 / 8) * S.areaGrid.gw + Math.floor(d.x0 / 8)]; return k === a.i; }); assert.strictEqual(born.length, 0, 'nothing born in a clean area (packs may still come in from outside)'); });
