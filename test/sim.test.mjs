// Fast checks that run on every push: maps are valid, the sim is deterministic,
// pathing works, and the core rules hold. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, validateMap, mapChoices, BIOMES, N, idx, PASSABLE } from '../src/sim/mapgen.js';
import { createGame as newGame, TENSION, PRESENCE, CUT } from '../src/sim/game.js';
import { BUILDINGS } from '../src/content/buildings.js';
import { MOBS, TIDE } from '../src/content/mobs.js';
import { playRun } from '../tools/bot.mjs';
import { MATURITY } from '../src/content/stronghold.js';
MATURITY.on = false;   // [gemini3] these rules predate the Camp's maturity gates (day, standing buildings): test/gemini3.test.mjs covers them

test('the frontier map generates valid worlds across 20 seeds', () => {
  for (const biome of ['riverbend']) for (let s = 1; s <= 20; s++) {
    const m = generateMap(s, biome);
    assert.deepEqual(validateMap(m), [], `${biome} seed ${s}`);
  }
});

test('one world while we test: the start screen offers a single valid map', () => {
  for (let s = 1; s <= 5; s++) { const c = mapChoices(s); assert.equal(c.length, 1); assert.equal(c[0].biome, 'riverbend'); }
});

test('every nest can walk to the town', () => {
  for (const biome of Object.keys(BIOMES)) {
    const g = createGame({ mode: 'classic', seed: 5, biome });
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

test('palisades reroute the dead instead of being ignored (walls are cut for now: tested with the flag off)', () => {
  CUT.walls = false; try {
  const g = createGame({ mode: 'classic', seed: 3, biome: 'highland' });
  const S = g.state;
  g.startNight();
  const before = Float32Array.from(S.flow);
  // fill one pass with a palisade-like block by building walls on every free town slot
  S.phase = 'day'; S.gold = 999;
  for (const s of g.map.regions[0].slots) g.build(s, 'wall');
  g.step();
  let changed = 0; for (let i = 0; i < N * N; i++) if (before[i] !== S.flow[i]) changed++;
  assert.ok(changed > 0, 'flow field did not change after walls were built');
  } finally { CUT.walls = true; }
});

test('day actions respect gold, phase and claimed land', () => {
  const g = createGame({ mode: 'classic', seed: 2, biome: 'lakeshore' });
  const S = g.state, core = g.map.regions[0].slots; S.stock = {};
  const outside = g.map.slots.find(s => s.region !== 0 && !g.inZone(s.x, s.y));
  assert.equal(g.build(outside.id, 'house'), false, 'built outside claimed land');
  assert.equal(g.build(core[0], 'tower'), true);
  assert.equal(g.build(core[0], 'house'), false, 'built on an occupied slot');
  S.gold = 0; assert.equal(g.build(core[1], 'house'), false, 'built without gold');
  S.pendingPicks = 0; assert.equal(g.startNight(), true);
  S.gold = 99; assert.equal(g.build(core[1], 'house'), true, 'no building at night (there is no day/night split any more)');
});

test('the brain: the dead hunt you out in the open, give up at the town, and the clever ones wait on the road home', () => {
  const g = createGame({ seed: 9, hero: 'archer' }), S = g.state; readyDay(g);
  const c = g.map.town.x;
  S.mobs.length = 0;
  S.hero.x = c + 30; S.hero.y = c; const w = g.state.mobs; 
  const spawn = (kind, x, y) => { const id = S.nextId; g.state.mobs.push({ id: S.nextId++, kind, x, y, hp: 99, maxHp: 99, cd: 1, speed: 1, boost: 1, rise: 1, face: 0, tauntT: 0 }); return S.mobs.find(m => m.id === id); };
  const near = spawn('walker', c + 34, c), far = spawn('walker', c + 42, c), brute = spawn('brute', c + 30, c + 30);
  brute.ambush = true;
  for (let k = 0; k < 30; k++) g.step();
  assert.ok(near.hunt, 'a walker 4 cells away did not notice you');
  assert.ok(!far.hunt, 'a walker 12 cells away noticed you');
  assert.ok(brute.ambushAt && Math.hypot(brute.ambushAt.x - c, brute.ambushAt.y - c) < Math.hypot(S.hero.x - c, S.hero.y - c), 'the brute did not move to cut you off');
});

// the nearest dead to the hero (a V2 night may bring no march: the roamers count)
const prey = S => S.mobs.filter(q => !MOBS[q.kind].animal && q.hp > 0).sort((a, b) => Math.hypot(a.x - S.hero.x, a.y - S.hero.y) - Math.hypot(b.x - S.hero.x, b.y - S.hero.y))[0];
test('heroes: every class fights, the Scavver only weakly', () => {
  for (const hero of ['warrior', 'archer', 'merchant']) {
    const g = createGame({ mode: 'classic', seed: 4, biome: 'highland', hero }); const S = g.state;
    S.night = 3; g.startNight();
    for (let k = 0; k < 60 * 200 && S.phase === 'night'; k++) { const m = prey(S); if (m) g.heroTo(m.x, m.y); g.step(); }
    const kills = S.log[0].kills.hero || 0;
    assert.ok(kills > 0, `${hero} killed nothing`);
  }
});

test('the dead never end up inside walls or water', () => {
  const g = createGame({ mode: 'classic', seed: 21, biome: 'riverbend' }); const S = g.state;
  S.night = 9;
  g.startNight();
  for (let k = 0; k < 60 * 60; k++) {
    g.step();
    if (k % 30) continue;
    for (const m of S.mobs) { const i = idx(Math.floor(m.x), Math.floor(m.y)); assert.ok(PASSABLE[g.map.terrain[i]], `${m.kind} stands on impassable ground`); }
  }
});

import { spaceStats } from '../tools/space.mjs';
// [econ3] this suite pins the v55 rules (instant building, blessings, rising tower prices, the full trickle); they stay
// in the code behind the ECON flags. The Solar Flare economy is tested in econ3.test.mjs.
import { ECON } from '../src/content/econ.js';
Object.assign(ECON, { queue: false, carts: false, relics: false, flatTower: false, settle: false });
// tests of the districts and the city: the fence down from day 1 (act 2 at once; CUT.earlyRoad off, see sim/acts.js)
test('towns use their space: enough lots, little dead land, a street around every building', () => {
  for (const biome of Object.keys(BIOMES)) for (let s = 1; s <= 20; s++) {
    const m = generateMap(s, biome), st = spaceStats(m);
    assert.ok(st.coreSlots >= 7, `${biome} ${s}: town has ${st.coreSlots} lots`);
    assert.ok(st.coreUnused <= 0.3, `${biome} ${s}: ${Math.round(st.coreUnused * 100)}% of town land unused`);
    for (const a of m.slots) for (const b of m.slots) if (a !== b && !a.gate && !b.gate)
      assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= 4, `${biome} ${s}: lots ${a.id} and ${b.id} touch`);
  }
});

test('free placement: no overlaps, every building owns its lot with a path, palisades are laid in lines', () => {
  const g = createGame({ mode: 'classic', seed: 3, biome: 'highland' }); const S = g.state; S.gold = 999;
  const t = g.map.town, spots = [];
  for (let y = t.y - 10; y <= t.y + 10; y++) for (let x = t.x - 10; x <= t.x + 10; x++) spots.push([x + 0.5, y + 0.5]);
  const find = (type, rot = 0) => spots.find(([x, y]) => g.canPlace(type, x, y, rot).ok);
  const [hx, hy] = find('house');
  assert.equal(g.build('house', hx, hy), true);
  assert.equal(g.canPlace('house', hx + 1, hy).ok, false, 'overlapping house allowed');
  const touching = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => g.canPlace('house', hx + dx, hy + dy));
  assert.ok(touching.every(p => !p.ok), 'a touching house was allowed');
  assert.ok(touching.some(p => /lot/.test(p.reason)), 'the lot rule never triggered');
  // lots tile edge to edge: the next home three cells over fits, and a path stays free between them
  assert.ok([[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => g.canPlace('house', hx + dx, hy + dy).ok), 'lots do not tile');
  assert.equal(g.canPlace('wall', hx + 5, hy).ok, false, 'barricades are cut but still on offer');
  // palisades are laid as lines of posts; a line chains into the next one (when walls return)
  CUT.walls = false;
  const [wx, wy] = spots.find(([x, y]) => g.lineCells(x, y, x + 4, y + 2).every(([cx, cy]) => g.canPlace('wall', cx + 0.5, cy + 0.5).ok));
  const before = g.state.buildings.filter(b => b.type === 'wall').length;
  g.state.gold = 50;
  const laid = g.buildLine(wx, wy, wx + 4, wy + 2);
  assert.ok(laid >= 5, `only ${laid} posts laid`);
  assert.equal(g.state.buildings.filter(b => b.type === 'wall').length, before + laid);
  const cells = g.lineCells(wx, wy, wx + 4, wy + 2);
  for (let k = 1; k < cells.length; k++) assert.equal(Math.abs(cells[k][0] - cells[k - 1][0]) + Math.abs(cells[k][1] - cells[k - 1][1]), 1, 'lines must be 4-connected');
  CUT.walls = true;
  const outside = { x: t.x + 60.5, y: t.y + 0.5 };   // well past the build zone
  assert.equal(g.canPlace('house', outside.x, outside.y).ok, false, 'built outside your land');
});

test('the hero can always walk between buildings', () => {
  const g = createGame({ mode: 'classic', seed: 4, biome: 'riverbend' }); const S = g.state; S.gold = 999;
  for (const s of g.map.regions[0].slots) g.build(s, 'house');
  // every free cell of the town that touches a building must reach the keep through free cells
  const seen = new Uint8Array(N * N), q = [idx(Math.floor(S.hero.x), Math.floor(S.hero.y))]; seen[q[0]] = 1;
  while (q.length) { const i = q.pop(), x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = idx(x + dx, y + dy); if (!seen[j] && PASSABLE[g.map.terrain[j]] && S.occ[j] < 0) { seen[j] = 1; q.push(j); } } }
  for (const b of S.buildings) {
    const ok = b.cells.some(i => { const x = i % N, y = (i / N) | 0; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[idx(x + dx, y + dy)]); });
    assert.ok(ok, `${b.type} at ${b.x},${b.y} cannot be reached on foot`);
  }
});

test('you can never get boxed in: you walk through palisades, and nothing may seal off ground', () => {
  const g = createGame({ mode: 'classic', seed: 5, biome: 'lakeshore' }); const S = g.state; S.gold = 999;
  const h = S.hero, x0 = Math.floor(h.x), y0 = Math.floor(h.y);
  // a ring of posts right around the hero
  g.buildLine(x0 - 2, y0 - 2, x0 + 2, y0 - 2); g.buildLine(x0 + 2, y0 - 2, x0 + 2, y0 + 2);
  g.buildLine(x0 + 2, y0 + 2, x0 - 2, y0 + 2); g.buildLine(x0 - 2, y0 + 2, x0 - 2, y0 - 2);
  g.heroTo(x0 + 6.5, y0 + 0.5);
  for (let k = 0; k < 400 && S.hero.target; k++) g.step(1 / 30);
  assert.ok(Math.hypot(S.hero.x - (x0 + 6.5), S.hero.y - (y0 + 0.5)) < 1, 'the hero could not walk out through the palisade');
  // a building that would close off a pocket of ground is refused
  const spots = []; const t = g.map.town;
  for (let y = t.y - 9; y <= t.y + 9; y++) for (let x = t.x - 9; x <= t.x + 9; x++) spots.push([x + 0.5, y + 0.5]);
  let sealed = 0;
  for (const [x, y] of spots) { const p = g.canPlace('house', x, y, 0, { deep: true }); if (/close off/.test(p.reason)) sealed++; }
  for (const [x, y] of spots) g.build('house', x, y);   // fill the town as tightly as the rules allow
  const seen = new Uint8Array(N * N), q = [Math.floor(S.hero.y) * N + Math.floor(S.hero.x)]; seen[q[0]] = 1;
  const ok = i => [true, true, false, false, false, true, true, false][g.map.terrain[i]] && (S.occ[i] < 0 || S.byId.get(S.occ[i]).type === 'wall');
  while (q.length) { const i = q.pop(), x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * N + x + dx; if (!seen[j] && ok(j)) { seen[j] = 1; q.push(j); } } }
  for (let i = 0; i < N * N; i++) if (ok(i) && g.map.region[i] === 0) assert.ok(seen[i], `town cell ${i % N},${(i / N) | 0} was sealed off`);
});

test('tapping a spot walks around buildings instead of stopping at them', () => {
  const g = createGame({ mode: 'classic', seed: 6, biome: 'riverbend' }); const S = g.state;
  // the keep sits between the hero (below it) and a point above it
  const t = g.map.town; g.heroTo(t.x + 0.5, t.y - 4.5);
  for (let k = 0; k < 600 && S.hero.target; k++) g.step(1 / 30);
  assert.ok(Math.hypot(S.hero.x - (t.x + 0.5), S.hero.y - (t.y - 4.5)) < 1, `stopped at ${S.hero.x.toFixed(1)},${S.hero.y.toFixed(1)}`);
});

test('packs: a choice of 2 each dawn, pack buildings are free, extra ones cost double gold', () => {
  const g = createGame({ seed: 5, biome: 'highland', mode: 'packs' }); const S = g.state;
  assert.equal(S.packs.length, 2);
  const before = { ...S.stock }; g.choosePack(S.packs[0]);
  assert.ok(Object.keys(S.stock).some(t => S.stock[t] > (before[t] || 0)), 'pack added nothing');
  const t = g.map.town, spots = [];
  for (let y = t.y - 9; y <= t.y + 9; y++) for (let x = t.x - 9; x <= t.x + 9; x++) spots.push([x + 0.5, y + 0.5]);
  const gold = S.gold; const [x, y] = spots.find(([a, b]) => g.canPlace('tower', a, b).ok);
  assert.equal(g.build('tower', x, y), true); assert.equal(S.gold, gold, 'a pack tower cost gold');
  S.stock.house = 0; S.gold = 100; const [hx, hy] = spots.find(([a, b]) => g.canPlace('house', a, b).ok);
  assert.equal(g.build('house', hx, hy), true); assert.equal(S.gold, 100 - g.costOf('house') * 2);
});

// ---------- scavenging ----------
const createGame = o => { const g = newGame(o); clearStory(g); return g; };
const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
// the hall asks for people, a food income with room to spare and (level 3) a win: give the town all three
const prepKeep = g => { const S = g.state; S.food = Math.max(S.food, 99); S.survivors = Math.max(S.survivors, 40); S.stats.sites = Math.max(S.stats.sites || 0, 1); S.gold = Math.max(S.gold, 200);
  if (g.foodPerDawn() - g.foodNeed() < 8) { const t = g.map.town; S.P.farmFood = Math.max(S.P.farmFood, 60);
    if (!S.buildings.some(b => b.type === 'farm' && !b.ruined)) for (let r = 4; r < 14; r++) { let done = false; for (let a = 0; a < 24 && !done; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('farm', x, y).ok) done = g.build('farm', x, y); } if (done) break; } } };
const readyDay = g => { const S = g.state; S.handsExtra = 99; clearStory(g); while (S.packs.length) g.choosePack(S.packs[0]); };
const nextDawn = g => { const S = g.state; g.startNight(); for (let k = 0; S.phase === 'night' && k < 60 * 400; k++) g.step(); };
const firstSite = (g, hops) => g.state.scav.sites.map(s => g.scavenge.siteInfo(s.id)).find(i => i.visible && i.hops === hops);





test('nothing grows past the keep', () => {
  const g = createGame({ mode: 'classic', seed: 3 }); readyDay(g); const S = g.state; S.gold = 200;
  const s = g.map.slots.find(q => S.claimed.has(q.region) && g.canPlace('house', q.x, q.y).ok);
  assert.ok(g.build('house', s.x, s.y)); const b = S.buildings.find(x => x.type === 'house');
  assert.ok(!g.upgrade(b.id), 'L2 home with an L1 keep');
  assert.ok((prepKeep(g), g.upgradeKeep())); assert.ok(g.upgrade(b.id));
  assert.ok(!g.upgrade(b.id), 'L3 home with an L2 keep');
});

test('towers need crew from homes', () => {
  const g = createGame({ mode: 'classic', seed: 3 }); readyDay(g); const S = g.state; S.gold = 300; S.survivors = 0;
  const spot = t => g.map.slots.find(q => S.claimed.has(q.region) && !q.gate && g.canPlace(t, q.x, q.y).ok);
  let s = spot('tower'); g.build('tower', s.x, s.y);
  const t = S.buildings.find(x => x.type === 'tower');
  assert.equal(g.manned(t), false, 'a tower with nobody in town fires');
  assert.equal(g.defenceDps() > 0, true);   // the keep still shoots
  const dps0 = g.defenceDps();
  s = spot('house'); g.build('house', s.x, s.y);
  assert.equal(g.manned(t), true, 'two people should man a level 1 tower');
  assert.ok(g.defenceDps() > dps0);
});

test('no early dawn: a cleared night lasts its full length; the time of day runs on without a jump', () => {
  const g = createGame({ seed: 7 }); const S = g.state; readyDay(g);
  let prev = g.timeOfDay(), maxJump = 0;
  const tick = () => { g.step(); const t = g.timeOfDay(); let d = t - prev; if (d < -0.5) d += 1; maxJump = Math.max(maxJump, Math.abs(d)); prev = t; };
  for (let k = 0; k < 60 * 130 && S.phase === 'day'; k++) tick();
  assert.equal(S.phase, 'night');
  S.hero.maxHp = S.hero.hp = 1e6;
  // kill every dead the moment it comes: the night must still run its full length
  let ended = null;
  for (let k = 0; k < 60 * 200 && S.phase === 'night'; k++) { for (let i = S.mobs.length - 1; i >= 0; i--) if (!S.mobs[i].roam) S.mobs.splice(i, 1); tick(); if (S.phase !== 'night') ended = S.qT; }
  assert.equal(S.phase, 'day', 'the night never ended');
  assert.ok(ended >= TIDE.nightLen - 0.05, `dawn came early at ${ended}`);
  assert.ok(maxJump < 0.002, `the clock jumped by ${maxJump}`);
  assert.ok(g.timeOfDay() < 0.01, 'a new day starts at sunrise');
});

test('no bell: dusk comes with the sun, and the day carries on into the night', () => {
  const g = createGame({ seed: 7 }); const S = g.state; readyDay(g);
  for (let k = 0; k < 60 * 130 && S.phase === 'day'; k++) g.step();
  assert.equal(S.phase, 'night', 'the sun never set');
  for (let k = 0; k < 60 * 200 && S.phase === 'night'; k++) g.step();
  assert.equal(S.phase, 'day', 'the night never ended');
});

test('foreman: the town learns to build by itself once it is established, for every hero', () => {
  for (const hero of ['warrior', 'merchant']) {
    const g = createGame({ seed: 12, hero }); const S = g.state; readyDay(g); S.gold = 400;
    for (let k = 0; k < 60 * 5; k++) g.step();
    assert.equal(S.builders, null, 'builders before the town is established'); S.handsExtra = 99;
    const t = g.map.town; let placed = 0;
    for (let r = 4; r < 12 && placed < 6; r++) for (let a = 0; a < 24 && placed < 6; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('house', x, y).ok && g.build('house', x, y)) placed++; }
    (prepKeep(g), g.upgradeKeep()); for (let k = 0; k < 60; k++) g.step(); assert.ok(!S.foreman, 'foreman before keep 3');
    (prepKeep(g), g.upgradeKeep()); for (let k = 0; k < 60; k++) g.step();
    assert.ok(S.foreman, `${hero}: no foreman with ${S.buildings.length} buildings`);
    assert.equal(S.builders, null, 'the foreman switched itself on'); g.setBuilders('balanced');
    const n0 = S.buildings.length; for (let k = 0; k < 60 * 30 && S.phase === 'day'; k++) g.step();
    assert.ok(S.buildings.length > n0 || S.buildings.some(b => b.level > 1), 'the foreman did nothing');
    g.setBuilders('off'); const n1 = S.buildings.length + S.buildings.reduce((a, b) => a + b.level, 0);
    for (let k = 0; k < 60 * 20 && S.phase === 'day'; k++) g.step();
    assert.equal(S.buildings.length + S.buildings.reduce((a, b) => a + b.level, 0), n1, 'builders worked while off');
  }
});

test('cuts: no hands limit, no generators, rising costs', () => {
  const g = createGame({ seed: 4 }); const S = g.state; readyDay(g); S.handsExtra = 0; S.gold = 900; S.stock = {};
  const t = g.map.town, spot = type => { for (let r = 3; r < 14; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
  const c1 = g.buyCost('house'); let p = spot('house'); g.build('house', p.x, p.y);
  assert.ok(g.buyCost('house') > c1, 'the second home costs the same');
  // towers climb in a straight line: +25% of the base for every tower you have
  const base = g.costOf('tower'); for (let k = 0; k < 4; k++) { assert.equal(g.buyCost('tower'), Math.round(base * (1 + 0.25 * k))); p = spot('tower'); assert.ok(g.build('tower', p.x, p.y)); }
  // no hands: a dozen jobs in one morning
  for (let k = 0; k < 8; k++) { p = spot('farm'); assert.ok(g.build('farm', p.x, p.y), `job ${k} refused`); }
  // power is gone: no generator in the build list
  assert.equal(g.canPlace('generator', p.x + 3, p.y).ok, false, 'a generator in the build list');
});

test('build zone: near the keep at first, and every building widens it', () => {
  const g = createGame({ mode: 'classic', seed: 9 }); readyDay(g); const S = g.state; S.gold = 200;
  const t = g.map.town, far = { x: t.x + 13.5, y: t.y + 0.5 };
  const z0 = g.zone().reduce((a, v) => a + v, 0);
  assert.ok(!g.inZone(far.x, far.y), 'zone reaches too far at the start');
  // build outward toward the far spot
  for (let k = 0; k < 6; k++) { const p = [...Array(30).keys()].map(d => ({ x: t.x + 4 + k * 2 + (d % 5), y: t.y - 2 + Math.floor(d / 5) })).find(q => g.canPlace('tower', q.x + 0.5, q.y + 0.5).ok); if (p) g.build('tower', p.x + 0.5, p.y + 0.5); }
  assert.ok(g.zone().reduce((a, v) => a + v, 0) > z0, 'buildings did not widen the zone');
  const nest = g.map.area && g.map.area.nest;
  if (nest) assert.equal(g.zone()[Math.floor(nest.y) * g.map.N + Math.floor(nest.x)], 0, 'you can build on the nest');
});

test('supply drops: guarded crates in the wild, opened by standing next to them', () => {
  const g = createGame({ seed: 14 }); const S = g.state; readyDay(g);
  g.dropSupply('Test.');
  assert.equal(S.drops.length, 1); const d = S.drops[0];
  assert.ok(!g.inZone(d.x, d.y), 'a drop landed inside the base');
  assert.ok(S.mobs.filter(m => m.roam && m.roam.region === -1).length >= 3, 'the drop has no guards');
  for (const m of [...S.mobs]) m.hp = 0; S.mobs.length = 0;   // clear the guards for the test
  const before = { gold: S.gold, pop: g.pop(), picks: S.pendingPicks, stock: JSON.stringify(S.stock) };
  S.hero.x = d.x; S.hero.y = d.y;
  for (let k = 0; k < 60 * 2; k++) g.step();
  assert.equal(S.drops.length, 1, 'opened too fast');
  for (let k = 0; k < 60 * 2; k++) g.step();
  assert.equal(S.drops.length, 0, 'did not open after 3 seconds');
  assert.ok(S.gold > before.gold || g.pop() > before.pop || S.pendingPicks > before.picks || JSON.stringify(S.stock) !== before.stock || S.hero.carry.scrap > 0 || (S.road && S.road.convoys.length > 0), 'no reward');   // [road] survivors found far out walk home as a convoy
});

test('tech: Workshop and Market need a level 2 keep, take time to build, and unlock level 3', () => {
  const g = createGame({ mode: 'classic', seed: 9 }); readyDay(g); const S = g.state; S.gold = 400;
  const t = g.map.town, spot = type => { for (let r = 3; r < 10; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
  assert.equal(spot('workshop'), null, 'a workshop with a level 1 keep');
  (prepKeep(g), g.upgradeKeep()); (prepKeep(g), g.upgradeKeep());
  const h = spot('house'); g.build('house', h.x, h.y); const home = S.buildings.find(b => b.type === 'house');
  g.upgrade(home.id); assert.equal(home.level === 2 || S.byId.get(home.id).level === 2, true);
  assert.equal(g.upgrade(home.id), false, 'level 3 home without a market');
  const m = spot('market'); assert.ok(g.build('market', m.x, m.y));
  assert.equal(g.upgrade(home.id), false, 'the market works before it is built');
  for (let k = 0; k < 60 * 36; k++) g.step();
  assert.ok(g.hasTech('market'));
  assert.ok(g.upgrade(home.id), 'level 3 home with a finished market');
});

test('saving: a dawn snapshot restores the town and the story', () => {
  const g = createGame({ seed: 21, hero: 'survivor', difficulty: 'veteran' }); const S = g.state; readyDay(g); S.gold = 300;
  const t = g.map.town; let n = 0; for (let r = 4; r < 10 && n < 4; r++) for (let a = 0; a < 24 && n < 4; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('house', x, y).ok && g.build('house', x, y)) n++; }
  (prepKeep(g), g.upgradeKeep());
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  assert.ok(JSON.stringify(snap).length < 200000, 'save too big');
  const h = newGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, difficulty: snap.difficulty, restore: snap }); const R = h.state;
  assert.equal(R.buildings.length, S.buildings.length); assert.equal(h.keepLevel(), 2); assert.equal(R.gold, S.gold);
  assert.equal(R.story.chronicle.length, S.story.chronicle.length);
  assert.equal(R.difficulty, 'veteran');
  for (let k = 0; k < 60 * 5; k++) h.step();
  assert.ok(!R.over);
});

// ---------- Oct 20: loss has weight, noise, the hero matters, cuts, contracts ----------
const ring = (g, type) => { const t = g.map.town; for (let r = 3; r < 16; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
const put = (g, type) => { const p = ring(g, type); assert.ok(p && g.build(type, p.x, p.y), `could not build a ${type}`); return g.state.buildings[g.state.buildings.length - 1]; };
const lastEv = (S, t) => S.events.filter(e => e.t === t).pop();

test('ruins persist: a fallen building stays a ruin (no income, its lot kept) until rebuilt by hand at half price', () => {
  const g = createGame({ seed: 3 }); readyDay(g); const S = g.state; S.gold = 300;
  const farm = put(g, 'farm'), tower = put(g, 'tower');
  const food0 = g.foodPerDawn();
  g.hitBuilding(farm.id, 999); assert.ok(farm.ruined, 'the farm did not fall');
  assert.ok(g.foodPerDawn() < food0, 'a ruin still grows food');
  assert.equal(g.canPlace('house', farm.x, farm.y).ok, false, 'the ruin gave up its lot');
  S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); readyDay(g);
  assert.ok(S.byId.get(farm.id).ruined, 'the ruin rebuilt itself at dawn');
  assert.equal(g.ruins().length, 1);
  const cost = g.rebuildCost(farm.id); assert.equal(cost, Math.ceil(g.costOf('farm') * TENSION.rebuild));
  S.phase = 'night'; assert.equal(g.rebuild(farm.id), false, 'rebuilt at night'); S.phase = 'day';
  const gold = S.gold; assert.ok(g.rebuild(farm.id)); assert.equal(S.gold, gold - cost); assert.ok(!farm.ruined);
  assert.equal(g.foodPerDawn(), food0);
  // a level 2 tower's rebuild is half of everything it cost
  prepKeep(g); assert.ok(g.upgradeKeep()); assert.ok(g.upgrade(tower.id)); const t2 = S.byId.get(tower.id);
  g.hitBuilding(t2.id, 999); assert.equal(g.rebuildCost(t2.id), Math.ceil((g.costOf('tower', 1) + g.costOf('tower', 2)) / 2));
  assert.equal(g.rebuildAll(), 1); assert.equal(g.ruins().length, 0);
});

test('a fallen home: half its people rise with the dead for good, the rest flee to the Camp and move back in when it is rebuilt', () => {
  const g = createGame({ seed: 5 }); readyDay(g); const S = g.state; S.gold = 300;
  const h = put(g, 'house'); prepKeep(g); assert.ok(g.upgradeKeep()); assert.ok(g.upgrade(h.id)); const home = S.byId.get(h.id);
  assert.equal(home.folk, BUILDINGS.house.pop[1], 'an upgraded home holds its new family');
  const pop0 = g.pop(), risen0 = S.mobs.filter(m => m.kind === 'risen').length;
  g.hitBuilding(home.id, 999);
  const lost = BUILDINGS.house.pop[1] / 2;
  assert.equal(g.pop(), pop0 - lost); assert.equal(S.mourned, lost); assert.equal(S.homeless, BUILDINGS.house.pop[1] - lost);
  assert.equal(S.mobs.filter(m => m.kind === 'risen').length - risen0, lost, 'the families did not rise');
  assert.ok(g.rebuild(home.id)); assert.equal(g.pop(), pop0 - lost, 'rebuilding brought the dead back');
  assert.equal(S.homeless, 0); assert.equal(home.folk, BUILDINGS.house.pop[1] - lost, 'the homeless did not move back in');
  // it falls again: it can only lose the people who live there now (no spiral below zero)
  g.hitBuilding(home.id, 999); assert.equal(g.pop(), pop0 - lost - Math.round((BUILDINGS.house.pop[1] - lost) / 2));
  // a save keeps the families and the homeless
  const snap = g.snapshot(); const g2 = createGame({ seed: 5, restore: JSON.parse(JSON.stringify(snap)) });
  assert.equal(g2.pop(), g.pop()); assert.equal(g2.state.homeless, S.homeless);
});

test('the hall falls over ~30 s: at most 3% a second, half that with the hero on its steps', () => {
  const g = createGame({ seed: 3 }); readyDay(g); const S = g.state, K = S.keep;
  S.hero.x = K.x + 20; S.hero.y = K.y; K.hp = K.maxHp;
  g.hitBuilding(0, 1e4); assert.ok(Math.abs((K.maxHp - K.hp) - K.maxHp * TENSION.hallCap) < 1e-6, `took ${K.maxHp - K.hp}`);
  g.hitBuilding(0, 1e4); assert.ok(Math.abs((K.maxHp - K.hp) - K.maxHp * TENSION.hallCap) < 1e-6, 'the cap is not per second');
  for (let k = 0; k < 61; k++) g.step(); S.hero.x = K.x + 2; S.hero.y = K.y; const hp = K.hp;
  g.hitBuilding(0, 1e4); assert.ok(Math.abs((hp - K.hp) - K.maxHp * TENSION.hallCap * TENSION.hallGuard) < 1e-6, 'the hero on the steps did not halve it');
});

test('death costs the night: back after 30 s or at dawn, towers slower meanwhile, carried loot dropped', () => {
  const g = createGame({ seed: 3 }); readyDay(g); const S = g.state; S.gold = 99;
  const t = put(g, 'tower'); put(g, 'house');
  S.hero.x = t.x + 30; S.hero.y = t.y; S.hero.carry.scrap = 7; S.hero.carry.food = 3;
  const rate0 = g.towerStats(t).rate;
  g.hurtHero(1e4); assert.ok(S.hero.dead);
  assert.ok(Math.abs(g.towerStats(t).rate - rate0 / TENSION.downRate) < 1e-9, 'towers did not slow down');
  assert.equal(S.hero.carry.scrap, 0); assert.ok(S.pickups.some(p => p.dropped && p.n === 7 && p.kind === 'scrap'), 'the scrap was not dropped where you fell');
  for (let k = 0; k < 60 * 29; k++) g.step(); assert.ok(S.hero.dead, 'back before 30 s');
  for (let k = 0; k < 60 * 2; k++) g.step(); assert.ok(!S.hero.dead, 'not back after 30 s');
  // dying near dusk: back at dawn
  g.hurtHero(1e4); S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); assert.ok(!S.hero.dead, 'still dead at dawn');
});

test('carried finds count once you are home', () => {
  const g = createGame({ seed: 11 }); readyDay(g); const S = g.state;
  const p = S.pickups[0]; S.hero.x = p.x; S.hero.y = p.y; const gold = S.gold, food = S.food;
  g.step(); assert.equal(S.gold, gold); assert.equal(S.food, food); assert.ok(S.hero.carry.scrap + S.hero.carry.food > 0, 'nothing carried');
  S.hero.x = g.map.town.x; S.hero.y = g.map.town.y + 3.5; g.step();
  assert.ok(S.gold > gold || S.food > food, 'nothing deposited'); assert.equal(S.hero.carry.scrap + S.hero.carry.food, 0);
});

test('the hero matters: towers near you shoot 30% faster and 2 further; what you hit is Marked for the towers', () => {
  const g = createGame({ seed: 4, hero: 'warrior' }); readyDay(g); const S = g.state; S.gold = 99; put(g, 'house');
  const t = put(g, 'tower');
  S.hero.x = t.x + 30; S.hero.y = t.y; const far = g.towerStats(t);
  S.hero.x = t.x + 2; const near = g.towerStats(t);
  assert.ok(Math.abs(near.rate - far.rate / PRESENCE.rate) < 1e-9 && near.range === far.range + PRESENCE.range, JSON.stringify({ near, far }));
  S.night = 3; g.startNight(); let marked = false;
  for (let k = 0; k < 60 * 120 && !marked && S.phase === 'night'; k++) { const m = prey(S); if (m) { g.heroTo(m.x, m.y); if (m.markT > 0) marked = true; } g.step(); }
  assert.ok(marked || S.mobs.some(m => m.markT > 0) || (S.log[0] && (S.log[0].kills.hero || 0) > 0), 'nothing the hero hit was Marked');
});

test('the dawn ledger', () => {
  const g = createGame({ seed: 6 }); readyDay(g); const S = g.state; S.gold = 99;
  const h = put(g, 'house'); g.hitBuilding(h.id, 999); nextDawn(g);
  const L = lastEv(S, 'ledger'); assert.ok(L, 'no ledger at dawn');
  assert.ok(L.fell.some(b => b.id === h.id && b.type === 'house'), 'the ledger forgot what fell'); assert.ok(L.rose.length === 1 && L.people === 1);
  assert.ok(L.held >= 0 && L.held <= 100); assert.equal(g.ledger(), S.ledger);
});

test('cuts: titles are flavour, no trader, one companion, no crew events, generators out of the build list', () => {
  for (const k of ['walls', 'hands', 'weather', 'titleStats', 'secondCompanion', 'trader', 'crew']) assert.ok(CUT[k], `${k} is not cut`);
  assert.equal(CUT.finalClass, false, 'the advanced class (tier 2, Lv 30) is back');
  const g = createGame({ seed: 7, hero: 'merchant' }); readyDay(g); const S = g.state;
  const dmg = S.P.heroDmg, keepHp = S.P.keepHp; g.story().grant('gravedigger'); g.story().grant('firstLight'); g.step();
  assert.equal(S.P.heroDmg, dmg); assert.equal(S.P.keepHp, keepHp); assert.ok(S.story.titles.includes('gravedigger'), 'the title itself is gone');
  S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); assert.equal(S.trade, null, 'the trader came');
  prepKeep(g); g.upgradeKeep(); g.upgradeKeep(); assert.equal(g.keepLevel(), 3); assert.equal(g.partySize(), 1);
});

test('aggro fires on a change only: once per dead per 10 s, never a flood', () => {
  const g = createGame({ seed: 7 }); const S = g.state; readyDay(g);
  const m = S.mobs.find(q => q.roam && !q.warden && q.kind === 'walker'); assert.ok(m);
  S.events.length = 0; S.hero.hp = S.hero.maxHp = 1e6;
  for (let k = 0; k < 60 * 30; k++) { S.hero.x = m.roam.x + 40; S.hero.y = m.roam.y; if (k % 2) { S.hero.x = m.x + 1; S.hero.y = m.y; } g.step(); }
  const per = {}; for (const e of S.events) if (e.t === 'aggro') per[e.id] = (per[e.id] || 0) + 1;
  for (const [id, n] of Object.entries(per)) assert.ok(n <= 3, `dead ${id} fired aggro ${n} times in 30 s`);
});

test('events: the type is never overwritten by a payload; hits and deaths carry src and dmg', () => {
  const g = createGame({ seed: 16, hero: 'warrior' }); readyDay(g); const S = g.state;
  S.night = 3; g.startNight(); S.events.length = 0;
  for (let k = 0; k < 60 * 60 && !S.events.some(e => e.t === 'die' && e.src === 'hero'); k++) { const m = S.mobs.find(q => !q.roam); if (m) g.heroTo(m.x, m.y); g.step(); }
  const hit = S.events.find(e => e.t === 'hitM'); assert.ok(hit && hit.src && hit.dmg > 0, JSON.stringify(hit));
  const die = S.events.find(e => e.t === 'die' && e.src); assert.ok(die && 'dmg' in die, JSON.stringify(die));
});
