// Fast checks that run on every push: maps are valid, the sim is deterministic,
// pathing works, and the core rules hold. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, validateMap, mapChoices, BIOMES, N, idx, PASSABLE } from '../src/sim/mapgen.js';
import { createGame } from '../src/sim/game.js';
import { playRun } from '../tools/bot.mjs';

test('every biome generates valid maps across 40 seeds', () => {
  for (const biome of Object.keys(BIOMES)) for (let s = 1; s <= 40; s++) {
    const m = generateMap(s, biome);
    assert.deepEqual(validateMap(m), [], `${biome} seed ${s}`);
  }
});

test('map choice offers two different biomes', () => {
  for (let s = 1; s <= 20; s++) {
    const c = mapChoices(s);
    assert.equal(c.length, 2); assert.notEqual(c[0].biome, c[1].biome);
  }
});

test('every nest can walk to the town', () => {
  for (const biome of Object.keys(BIOMES)) {
    const g = createGame({ seed: 5, biome });
    while (g.state.pendingPicks) g.choosePerk(g.state.offer[0]);
    assert.equal(g.startNight(), true);
    for (const r of g.map.regions) if (r.nest) {
      const i = idx(Math.floor(r.nest.x), Math.floor(r.nest.y));
      assert.ok(Number.isFinite(g.state.flow[i]), `${biome} nest ${r.id} has no path`);
    }
  }
});

test('the same seed and inputs replay the same run', () => {
  const run = () => playRun(createGame, { seed: 11, biome: 'riverbend', hero: 'archer', strat: 'balanced', expansion: 'bold', path: 'any', maxNights: 6 });
  const a = run(), b = run();
  assert.equal(JSON.stringify(a.log), JSON.stringify(b.log));
});

test('palisades reroute the dead instead of being ignored', () => {
  const g = createGame({ seed: 3, biome: 'highland' });
  const S = g.state;
  while (S.pendingPicks) g.choosePerk(S.offer[0]);
  g.startNight();
  const before = Float32Array.from(S.flow);
  // fill one pass with a palisade-like block by building walls on every free town slot
  S.phase = 'day'; S.gold = 999;
  for (const s of g.map.regions[0].slots) g.build(s, 'wall');
  g.step();
  let changed = 0; for (let i = 0; i < N * N; i++) if (before[i] !== S.flow[i]) changed++;
  assert.ok(changed > 0, 'flow field did not change after walls were built');
});

test('day actions respect gold, phase and claimed land', () => {
  const g = createGame({ seed: 2, biome: 'lakeshore' });
  const S = g.state, core = g.map.regions[0].slots;
  const outside = g.map.slots.find(s => s.region !== 0);
  assert.equal(g.build(outside.id, 'house'), false, 'built outside claimed land');
  assert.equal(g.build(core[0], 'tower'), true);
  assert.equal(g.build(core[0], 'house'), false, 'built on an occupied slot');
  S.gold = 0; assert.equal(g.build(core[1], 'house'), false, 'built without gold');
  S.pendingPicks = 0; assert.equal(g.startNight(), true);
  S.gold = 99; assert.equal(g.build(core[1], 'house'), false, 'built at night');
});

test('a survived siege claims the region and wakes the nests behind it', () => {
  const g = createGame({ seed: 9, biome: 'riverbend', hero: 'archer' });
  const S = g.state;
  while (S.pendingPicks) g.choosePerk(S.offer[0]);
  const target = g.map.regions.find(r => g.canPurge(r.id));
  assert.ok(target, 'no region can be marched on');
  S.keep.hp = S.keep.maxHp = 1e6; // make the keep unkillable for this test
  assert.equal(g.planPurge(target.id), true);
  g.startNight();
  for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) g.step();
  assert.ok(S.claimed.has(target.id), 'region was not claimed');
  assert.equal(S.nestAlive[target.id], false);
  for (const nb of target.neighbors) if (g.map.regions[nb].nest && !S.claimed.has(nb)) assert.ok(S.wake[nb] <= S.night, `neighbour ${nb} did not wake`);
});

test('heroes: the steward never attacks, warriors and archers do', () => {
  for (const hero of ['warrior', 'archer', 'steward']) {
    const g = createGame({ seed: 4, biome: 'highland', hero }); const S = g.state;
    while (S.pendingPicks) g.choosePerk(S.offer[0]);
    g.startNight();
    for (let k = 0; k < 60 * 200 && S.phase === 'night'; k++) { const m = S.mobs[0]; if (m) g.heroTo(m.x, m.y); g.step(); }
    const kills = S.log[0].kills.hero || 0;
    if (hero === 'steward') assert.equal(kills, 0); else assert.ok(kills > 0, `${hero} killed nothing`);
  }
});

test('the dead never end up inside walls or water', () => {
  const g = createGame({ seed: 21, biome: 'riverbend' }); const S = g.state;
  S.night = 9; while (S.pendingPicks) g.choosePerk(S.offer[0]);
  g.startNight();
  for (let k = 0; k < 60 * 60; k++) {
    g.step();
    if (k % 30) continue;
    for (const m of S.mobs) { const i = idx(Math.floor(m.x), Math.floor(m.y)); assert.ok(PASSABLE[g.map.terrain[i]], `${m.kind} stands on impassable ground`); }
  }
});

import { spaceStats } from '../tools/space.mjs';
test('towns use their space: enough lots, little dead land, a street around every building', () => {
  for (const biome of Object.keys(BIOMES)) for (let s = 1; s <= 20; s++) {
    const m = generateMap(s, biome), st = spaceStats(m);
    assert.ok(st.coreSlots >= 7, `${biome} ${s}: town has ${st.coreSlots} lots`);
    assert.ok(st.coreUnused <= 0.25, `${biome} ${s}: ${Math.round(st.coreUnused * 100)}% of town land unused`);
    for (const a of m.slots) for (const b of m.slots) if (a !== b && !a.gate && !b.gate)
      assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= 4, `${biome} ${s}: lots ${a.id} and ${b.id} touch`);
  }
});

test('rivers and passes get gate lots, which only take towers and palisades', () => {
  const g = createGame({ seed: 3, biome: 'highland' });
  const gate = g.map.slots.find(s => s.gate);
  assert.ok(gate, 'no gate lot on a highland map');
  assert.equal(g.build(gate.id, 'house'), false);
  assert.equal(g.build(gate.id, 'wall'), true);
});

test('the forecast traces every attacking nest to the town', () => {
  for (const biome of Object.keys(BIOMES)) {
    const g = createGame({ seed: 8, biome }); g.state.night = 6;
    for (const f of g.forecast()) { assert.ok(f.count > 0); assert.ok(f.path.length > 3, `${biome} nest ${f.nest} has no route`); }
  }
});
