// [atoms] The atom world: every material explains itself and is complete, fire runs with the wind, wet ground won't
// catch, a burnt fence is gone, a car blows once, and a plain pellet never touches the ground.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
import { MATERIALS } from '../src/play/materials.js';
import { GROUND, PROPS, PLACED } from '../src/play/atoms-map.js';
const { buildTown } = await import('../src/roam/town.js');
const { createRoam } = await import('../src/roam/sim.js');
const town = buildTown(7);
const fresh = () => { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0; return { sim, S }; };
// fires only run near Kai, and on the bike she is where the bike is
const put = (S, x, y) => { S.kai.x = S.bike.x = x; S.kai.y = S.bike.y = y; };
const run = (sim, s, inp = {}) => { const evs = []; for (let i = 0; i < s * 30; i++) { sim.step({ x: 0, y: 0, view: 21, ...inp }); evs.push(...sim.drain()); } return evs; };
// a spot in the middle of a dry field: every cell within 12 m is grass
function field() { const CH = town.chars, c = CH.cell; for (let j = 20; j < CH.h - 20; j += 3) for (let i = 20; i < CH.w - 20; i += 3) { let ok = true;
  for (let b = -6; b <= 6 && ok; b++) for (let a = -6; a <= 6 && ok; a++) if (GROUND[String.fromCharCode(CH.codes[(j + b) * CH.w + i + a])] !== 'dryGrass') ok = false;
  if (ok) return { x: (i + 0.5) * c, y: (j + 0.5) * c }; } }
test('every material explains itself; burnables are complete; every map entry is a known material', () => {
  for (const [k, m] of Object.entries(MATERIALS)) { assert.ok(m.desc && m.why, k);
    if (m.ignite !== Infinity) for (const f of ['ignite', 'fuel', 'burnHeat', 'burnReach', 'soak', 'onBurnt', 'hurts']) assert.ok(m[f] !== undefined, `${k}.${f}`);
    if (m.explodeAt) assert.ok(m.blast && m.blast.r && m.blast.dmg, `${k}.blast`); }
  for (const t of [GROUND, PROPS, PLACED]) for (const [k, v] of Object.entries(t)) assert.ok(MATERIALS[v], `${k} → ${v}`); });
test('fire runs downwind faster than upwind', () => { const { sim, S } = fresh(), f = field(); assert.ok(f, 'a field');
  put(S, f.x - 30, f.y); sim.deliver('fire', f.x, f.y, 1, 1); const W = { x: 0.731, y: 0.682 }; let down = 0, up = 0;
  for (const e of run(sim, 6)) if (e.type === 'burnt') { const u = (e.x - f.x) * W.x + (e.y - f.y) * W.y; if (u > 1) down++; else if (u < -1) up++; }
  for (const [c, s] of S.cells) if (s.burn) { const x = (c % town.chars.w + 0.5) * town.chars.cell, y = (Math.floor(c / town.chars.w) + 0.5) * town.chars.cell, u = (x - f.x) * W.x + (y - f.y) * W.y; if (u > 1) down++; else if (u < -1) up++; }
  assert.ok(down > up * 1.5 && down > 3, `down ${down} up ${up}`); });
test('soaked ground does not catch', () => { const { sim, S } = fresh(), f = field(); put(S, f.x - 30, f.y);
  sim.deliver('water', f.x, f.y, 4, 1); sim.deliver('fire', f.x, f.y, 1, 1); run(sim, 2); let burning = 0; for (const s of S.cells.values()) if (s.burn) burning++; assert.strictEqual(burning, 0); });
test('a fence burns away; a car blows once', () => { const { sim, S } = fresh();
  const fence = S.atoms.find(a => a.mat === 'wood' && a.prop === 'fence'), car = S.atoms.find(a => a.mat === 'fuelTank' && a.prop === 'car'); assert.ok(fence && car);
  put(S, fence.x + 25, fence.y); sim.deliver('fire', fence.x, fence.y, 0.5, 2); run(sim, 12); assert.strictEqual(fence.state, 'done'); assert.ok(S.broken.has(fence.ref));
  put(S, car.x + 25, car.y); let blasts = 0; for (let k = 0; k < 4; k++) { sim.deliver('fire', car.x, car.y, 0.5, 1); for (const e of run(sim, 1)) if (e.type === 'blast' && Math.hypot(e.x - car.x, e.y - car.y) < 0.1) blasts++; }
  assert.strictEqual(blasts, 1); assert.notStrictEqual(car.state, 'ok'); assert.ok(car.wreck); });
test('a fire pellet never touches the world', () => { const { sim, S } = fresh(), f = field(); put(S, f.x, f.y); sim.setLoadout({ base: 'scatter', el: 'fire', enchant: null });
  run(sim, 4, { fire: true, aim: 0 }); assert.strictEqual(S.cells.size, 0); assert.strictEqual(S.burnt.size, 0); });
