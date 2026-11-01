// [m6b] Elites: a machine may carry a mod and act it (quick, twin, glancing, burning, soaking); beating it drops that mod,
// which Kai carries (into the death cache if she goes down) until a bank sends it to the garage.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
import { ELITES } from '../src/play/elites.js';
import { MODIFIERS } from '../src/play/modifiers.js';
const { buildTown } = await import('../src/roam/town.js');
const { createRoam, ROAM } = await import('../src/roam/sim.js');
const town = buildTown(7);
test('every elite explains itself and drops a real mod', () => { for (const [k, e] of Object.entries(ELITES)) { assert.ok(e.desc && e.why, k); assert.ok(MODIFIERS[e.mod], k); } });
test('an elite is tougher, drops its mod, and the mod reaches the garage through a bank', () => { const c0 = ROAM.elites.chance; ROAM.elites.chance = 1;
  try { const sim = createRoam(town, 3), S = sim.state; S.dead.length = 0;
    const d = sim.debug.spawn('crawler', S.kai.x + 30, S.kai.y); assert.ok(d.elite, 'made an elite'); assert.ok(d.maxHp > ROAM.dead.crawler.hp * 2, 'tougher');
    const mod = ELITES[d.elite].mod; d.hp = 0.01; d.x = S.kai.x + 3; d.y = S.kai.y;
    for (let i = 0; i < 90 && S.dead.includes(d); i++) { sim.step({ x: 0, y: 0, view: 21, fire: true, aim: 0 }); sim.drain(); }
    assert.ok(!S.dead.includes(d), 'killed'); const drop = S.drops.find(q => q.kind === 'mod'); assert.ok(drop && drop.m === mod, 'its mod dropped');
    // carried, then banked at the camp (she stands there)
    drop.x = S.kai.x; drop.y = S.kai.y; for (let i = 0; i < 3; i++) { S.dead.length = 0; sim.step({ x: 0, y: 0, view: 21 }); sim.drain(); }
    assert.strictEqual(S.carryMods.length, 0, 'banked'); assert.strictEqual(S.mods[mod], 1, 'in the garage'); }
  finally { ROAM.elites.chance = c0; } });
