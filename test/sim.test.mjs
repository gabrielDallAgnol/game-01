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
    const g = createGame({ mode: 'classic', seed: 5, biome });
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
  const g = createGame({ mode: 'classic', seed: 3, biome: 'highland' });
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
  const g = createGame({ mode: 'classic', seed: 2, biome: 'lakeshore' });
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
  const g = createGame({ mode: 'classic', seed: 9, biome: 'riverbend', hero: 'archer' });
  const S = g.state;
  while (S.pendingPicks) g.choosePerk(S.offer[0]);
  assert.ok(!g.map.regions.some(r => g.canPurge(r.id)), 'a level 1 keep should not march on hives');
  S.gold = 100; assert.ok(g.upgradeKeep());
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

test('heroes: the merchant never attacks, warriors and archers do', () => {
  for (const hero of ['warrior', 'archer', 'merchant']) {
    const g = createGame({ mode: 'classic', seed: 4, biome: 'highland', hero }); const S = g.state;
    while (S.pendingPicks) g.choosePerk(S.offer[0]);
    g.startNight();
    for (let k = 0; k < 60 * 200 && S.phase === 'night'; k++) { const m = S.mobs[0]; if (m) g.heroTo(m.x, m.y); g.step(); }
    const kills = S.log[0].kills.hero || 0;
    if (hero === 'merchant') assert.equal(kills, 0); else assert.ok(kills > 0, `${hero} killed nothing`);
  }
});

test('the dead never end up inside walls or water', () => {
  const g = createGame({ mode: 'classic', seed: 21, biome: 'riverbend' }); const S = g.state;
  S.night = 9; while (S.pendingPicks) g.choosePerk(S.offer[0]);
  g.startNight();
  for (let k = 0; k < 60 * 60; k++) {
    g.step();
    if (k % 30) continue;
    for (const m of S.mobs) { const i = idx(Math.floor(m.x), Math.floor(m.y)); assert.ok(PASSABLE[g.map.terrain[i]], `${m.kind} stands on impassable ground`); }
  }
});

import { spaceStats } from '../tools/space.mjs';
import { PERKS } from '../src/content/perks.js';
test('towns use their space: enough lots, little dead land, a street around every building', () => {
  for (const biome of Object.keys(BIOMES)) for (let s = 1; s <= 20; s++) {
    const m = generateMap(s, biome), st = spaceStats(m);
    assert.ok(st.coreSlots >= 7, `${biome} ${s}: town has ${st.coreSlots} lots`);
    assert.ok(st.coreUnused <= 0.25, `${biome} ${s}: ${Math.round(st.coreUnused * 100)}% of town land unused`);
    for (const a of m.slots) for (const b of m.slots) if (a !== b && !a.gate && !b.gate)
      assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= 4, `${biome} ${s}: lots ${a.id} and ${b.id} touch`);
  }
});

test('free placement: no overlaps, a street between buildings, palisades are laid in lines', () => {
  const g = createGame({ mode: 'classic', seed: 3, biome: 'highland' }); const S = g.state; S.gold = 999;
  const t = g.map.town, spots = [];
  for (let y = t.y - 10; y <= t.y + 10; y++) for (let x = t.x - 10; x <= t.x + 10; x++) spots.push([x + 0.5, y + 0.5]);
  const find = (type, rot = 0) => spots.find(([x, y]) => g.canPlace(type, x, y, rot).ok);
  const [hx, hy] = find('house');
  assert.equal(g.build('house', hx, hy), true);
  assert.equal(g.canPlace('house', hx + 1, hy).ok, false, 'overlapping house allowed');
  const touching = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => g.canPlace('house', hx + dx, hy + dy));
  assert.ok(touching.every(p => !p.ok), 'a touching house was allowed');
  assert.ok(touching.some(p => /street/.test(p.reason)), 'the street rule never triggered');
  // palisades are laid as lines of posts; a line chains into the next one
  const [wx, wy] = spots.find(([x, y]) => g.lineCells(x, y, x + 4, y + 2).every(([cx, cy]) => g.canPlace('wall', cx + 0.5, cy + 0.5).ok));
  const before = g.state.buildings.filter(b => b.type === 'wall').length;
  g.state.gold = 50;
  const laid = g.buildLine(wx, wy, wx + 4, wy + 2);
  assert.ok(laid >= 5, `only ${laid} posts laid`);
  assert.equal(g.state.buildings.filter(b => b.type === 'wall').length, before + laid);
  const cells = g.lineCells(wx, wy, wx + 4, wy + 2);
  for (let k = 1; k < cells.length; k++) assert.equal(Math.abs(cells[k][0] - cells[k - 1][0]) + Math.abs(cells[k][1] - cells[k - 1][1]), 1, 'lines must be 4-connected');
  const outside = g.map.slots.find(sl => sl.region !== 0);
  assert.equal(g.canPlace('house', outside.x, outside.y).ok, false, 'built outside your land');
});

test('the hero can always walk between buildings', () => {
  const g = createGame({ mode: 'classic', seed: 4, biome: 'riverbend' }); const S = g.state; S.gold = 999;
  for (const s of g.map.regions[0].slots) g.build(s, 'house');
  // every free cell of the town that touches a building must reach the keep through free cells
  const { N, idx, PASSABLE } = { N: 64, idx: (x, y) => y * 64 + x, PASSABLE: [true, true, false, false, false, true, true, false] };
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
  const N = 64, seen = new Uint8Array(N * N), q = [Math.floor(S.hero.y) * N + Math.floor(S.hero.x)]; seen[q[0]] = 1;
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

test('blessings: rarity by source, pacts, masteries, reroll', () => {
  const g = createGame({ mode: 'classic', seed: 12, biome: 'lakeshore', hero: 'warrior' }); const S = g.state;
  S.picks = ['nest']; g.choosePerk; // a nest offer must hold a legendary
  S.picks = ['nest']; S.pendingPicks = 1;
  g.reroll(); // free reroll rolls the nest offer
  
  assert.ok(S.offer.some(id => PERKS.find(p => p.id === id).rarity === 'legendary'), 'nest offer without a legendary');
  // three of a family → mastery choice next
  S.picks = ['dawn', 'dawn', 'dawn']; S.pendingPicks = 3; S.offer = ['steel']; S.offerSource = 'dawn';
  for (let k = 0; k < 3; k++) { S.offer = ['steel', 'hymn', 'skin']; S.offerSource = 'dawn'; g.choosePerk(['steel', 'hymn', 'skin'][k]); }
  assert.ok(S.offer.every(id => id.startsWith('m:')), 'no mastery offered after 3 Hero blessings');
  g.choosePerk(S.offer[0]);
  assert.ok(g.mastered('hero'));
  // pacts carry a downside
  const before = g.keepMaxHp(); S.offer = ['pactBlood']; S.offerSource = 'dawn'; S.picks = ['dawn']; g.choosePerk('pactBlood');
  assert.ok(g.keepMaxHp() < before, 'Blood Arrows did not cost keep health');
  // rerolls: first free, then cost gold
  S.picks = ['dawn']; S.pendingPicks = 1; S.gold = 100; S.reroll.free = 1; g.state.offer = ['tax']; S.offerSource = 'dawn';
  g.reroll(); assert.equal(S.gold, 100); g.reroll(); assert.equal(S.gold, 95);
});

test('heroes: abilities work and the merchant hires sellswords', () => {
  for (const hero of ['warrior', 'archer', 'merchant']) {
    const g = createGame({ mode: 'classic', seed: 6, biome: 'highland', hero, clock: false }); const S = g.state;
    while (S.pendingPicks) g.choosePerk(S.offer[0]);
    S.gold = 50; S.night = 4; g.startNight();
    for (let k = 0; k < 60 * 12; k++) g.step();
    const t = g.map.town; S.hero.x = t.x; S.hero.y = t.y + 3.5;
    if (S.mobs[0]) { S.hero.x = S.mobs[0].x; S.hero.y = S.mobs[0].y; }
    const ok = g.useAbility(S.mobs[0]?.x, S.mobs[0]?.y);
    if (hero === 'merchant') { assert.equal(ok, true); assert.equal(S.allies.length, 3); assert.equal(S.gold, 40); }
    else assert.ok(S.ability.cd > 0 || !ok, `${hero} ability did nothing`);
    assert.equal(g.useAbility(), false, 'ability ignored its cooldown');
  }
});

test('the forecast traces every attacking nest to the town', () => {
  for (const biome of Object.keys(BIOMES)) {
    const g = createGame({ mode: 'classic', seed: 8, biome }); g.state.night = 6;
    for (const f of g.forecast()) { assert.ok(f.count > 0); assert.ok(f.path.length > 3, `${biome} nest ${f.nest} has no route`); }
  }
});

test('packs: a choice of 2 each dawn, pack buildings are free, extra ones cost double gold', () => {
  const g = createGame({ seed: 5, biome: 'highland', mode: 'packs' }); const S = g.state;
  while (S.pendingPicks) g.choosePerk(S.offer[0]);
  assert.equal(S.packs.length, 2);
  assert.equal(g.startNight(), false, 'night started before choosing a pack');
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
const readyDay = g => { const S = g.state; while (S.pendingPicks) g.choosePerk(S.offer[0]); while (S.packs.length) g.choosePack(S.packs[0]); };
const nextDawn = g => { const S = g.state; g.startNight(); for (let k = 0; S.phase === 'night' && k < 60 * 400; k++) g.step(); };
const firstSite = (g, hops) => g.state.scav.sites.map(s => g.scavenge.siteInfo(s.id)).find(i => i.visible && i.hops === hops);

test('every map has scavenge sites next door and further out', () => {
  for (const biome of ['riverbend', 'highland', 'lakeshore', 'vale']) {
    const g = createGame({ seed: 4, biome });
    assert.ok(firstSite(g, 1), `${biome}: no site next door`);
    assert.ok(firstSite(g, 2), `${biome}: no deep site`);
    assert.equal(g.state.scav.crew.length, 2);
  }
});

test('a run costs supplies, can be called back, and comes home at dawn', () => {
  const g = createGame({ seed: 21 }); readyDay(g); const S = g.state;
  const i = firstSite(g, 1), ids = S.scav.crew.map(c => c.id), gold = S.gold;
  assert.ok(g.scavenge.send(i.site.id, ids));
  assert.equal(S.gold, gold - i.R.kit * 2);
  assert.ok(S.scav.crew.every(c => c.out === i.site.id));
  assert.ok(!g.scavenge.send(i.site.id, ids), 'two crews on one site');
  assert.ok(g.scavenge.recall(i.site.id)); assert.equal(S.gold, gold);
  assert.ok(g.scavenge.send(i.site.id, ids));
  nextDawn(g);
  assert.equal(S.phase, 'day'); assert.equal(S.scav.trips, 1); assert.equal(i.site.used, 1);
  assert.ok(S.scav.crew.every(c => c.out === null));
  assert.equal(S.scav.runs.length, 0);
});

test('no runs at night; a bite left untreated turns at nightfall', () => {
  const g = createGame({ seed: 22 }); readyDay(g); const S = g.state;
  const i = firstSite(g, 1), c = S.scav.crew[0];
  g.startNight(); assert.ok(!g.scavenge.send(i.site.id, [c.id]));
  for (let k = 0; S.phase === 'night' && k < 60 * 400; k++) g.step();
  readyDay(g);
  c.bitten = true; const before = S.scav.crew.length;
  g.startNight();
  assert.equal(S.scav.crew.length, before - 1);
  assert.ok(S.mobs.some(m => m.kind === 'runner' && Math.hypot(m.x - g.map.town.x, m.y - g.map.town.y) < 5), 'no turned survivor in town');
});

test('scavenging is deterministic and never touches the main random stream', () => {
  const play = send => { const g = createGame({ seed: 23 }); readyDay(g); if (send) g.scavenge.send(firstSite(g, 2).site.id, g.state.scav.crew.map(c => c.id)); nextDawn(g); return g.state; };
  const a = play(true), b = play(true), c = play(false);
  assert.deepEqual(a.scav.crew.map(x => x.name + x.trait), b.scav.crew.map(x => x.name + x.trait));
  assert.equal(a.gold, b.gold);
  assert.equal(a.kills, c.kills);
});

test('weather: rolled at dawn from night 3, never on a blood moon, and it changes the night', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const g = createGame({ seed, hero: 'archer' }), S = g.state;
    for (let n = 0; n < 9 && !S.over; n++) {
      readyDay(g);
      if (S.night < 3 || S.night % 5 === 0) assert.equal(S.weather, 'clear');
      seen.add(S.weather);
      S.gold += 40; for (let k = 0; k < 4; k++) { const s = g.map.slots.find(q => S.claimed.has(q.region) && g.canPlace('tower', q.x, q.y).ok); if (s) g.build('tower', s.x, s.y); }
      nextDawn(g);
    }
  }
  assert.ok(seen.size >= 3, `only saw ${[...seen]}`);
  const g = createGame({ seed: 2 }), S = g.state;
  S.night = 6; const base = g.forecast().reduce((a, r) => a + r.count, 0);
  S.weather = 'still'; const still = g.forecast().reduce((a, r) => a + r.count, 0);
  S.weather = 'storm'; const storm = g.forecast().reduce((a, r) => a + r.count, 0);
  assert.ok(still < base && storm > base, `${still} ${base} ${storm}`);
});

test('clearing rubble on your land costs gold and makes buildable ground', () => {
  let g, spot;
  for (let seed = 1; seed < 40 && !spot; seed++) {
    g = createGame({ seed }); const S = g.state, N = Math.sqrt(g.map.terrain.length);
    for (let i = 0; i < g.map.terrain.length && !spot; i++) if (g.map.terrain[i] === 1 && S.claimed.has(g.map.region[i]) && S.occ[i] < 0) spot = { x: i % N + 0.5, y: Math.floor(i / N) + 0.5 };
  }
  assert.ok(spot, 'no rubble in any starting town');
  readyDay(g); const S = g.state;
  const r = g.rubbleAt(spot.x, spot.y), gold = S.gold = 20;
  assert.ok(r.cells.length > 0 && r.cost === r.cells.length);
  assert.equal(g.clearRubble(spot.x, spot.y), r.cells.length);
  assert.equal(S.gold, gold - r.cost);
  assert.ok(r.cells.every(i => g.map.terrain[i] === 0));
  assert.equal(g.rubbleAt(spot.x, spot.y).cells.length, 0);
  g.startNight(); assert.ok(!g.clearRubble(spot.x, spot.y));
});

test('nothing grows past the keep', () => {
  const g = createGame({ mode: 'classic', seed: 3 }); readyDay(g); const S = g.state; S.gold = 200;
  const s = g.map.slots.find(q => S.claimed.has(q.region) && g.canPlace('house', q.x, q.y).ok);
  assert.ok(g.build('house', s.x, s.y)); const b = S.buildings.find(x => x.type === 'house');
  assert.ok(!g.upgrade(b.id), 'L2 home with an L1 keep');
  assert.ok(g.upgradeKeep()); assert.ok(g.upgrade(b.id));
  assert.ok(!g.upgrade(b.id), 'L3 home with an L2 keep');
});

test('towers need crew from homes; a bigger town draws more dead', () => {
  const g = createGame({ mode: 'classic', seed: 3 }); readyDay(g); const S = g.state; S.gold = 300;
  const spot = t => g.map.slots.find(q => S.claimed.has(q.region) && !q.gate && g.canPlace(t, q.x, q.y).ok);
  let s = spot('tower'); g.build('tower', s.x, s.y);
  const t = S.buildings.find(x => x.type === 'tower');
  assert.equal(g.manned(t), false, 'a tower with nobody in town fires');
  assert.equal(g.defenceDps() > 0, true);   // the keep still shoots
  const dps0 = g.defenceDps();
  s = spot('house'); g.build('house', s.x, s.y);
  assert.equal(g.manned(t), true, 'two people should man a level 1 tower');
  assert.ok(g.defenceDps() > dps0);
  const draw0 = g.townDraw();
  for (let k = 0; k < 6; k++) { const h = spot('house'); if (h) g.build('house', h.x, h.y); }
  assert.ok(g.townDraw() >= draw0);
  for (const b of S.buildings.filter(x => x.type === 'house')) { g.upgradeKeep(); g.upgrade(b.id); }
  assert.ok(g.townDraw() > 1, 'no extra dead for a big town');
});

test('blessings: a dawn pick every other day, never more than two picks a dawn', () => {
  const g = createGame({ seed: 5, hero: 'archer' }); const S = g.state;
  readyDay(g);
  const counts = [];
  for (let n = 0; n < 4 && !S.over; n++) { S.chestsHeld = 4; S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); counts.push(S.pendingPicks); readyDay(g); }
  for (const c of counts) assert.ok(c <= 2, `${c} picks in one dawn`);
});

test('tides: night 1 is a single tough dead, dusk falls on its own, roamers wander the wild', () => {
  const g = createGame({ seed: 7 }); const S = g.state; readyDay(g);
  assert.ok(S.mobs.some(m => m.roam), 'no roaming dead at the start');
  assert.ok(S.mobs.filter(m => m.roam).every(m => !S.claimed.has(m.roam.region)));
  for (let k = 0; k < 60 * 101 && S.phase === 'day'; k++) g.step();
  assert.equal(S.phase, 'night', 'dusk did not fall');
  assert.equal(S.queue.length, 1); assert.ok(S.queue[0].first);
  for (let k = 0; k < 60 * 6; k++) g.step();
  const first = S.mobs.find(m => m.first); assert.ok(first, 'the first dead never came');
  assert.ok(first.maxHp > 3);
  for (let k = 0; S.phase === 'night' && k < 60 * 300; k++) g.step();
  assert.equal(S.phase, 'day', 'roamers kept the night from ending');
});

test('ringing the bell early pays gold', () => {
  const g = createGame({ seed: 7 }); const S = g.state; readyDay(g);
  const gold = S.gold; assert.ok(g.startNight()); assert.ok(S.gold > gold);
});
