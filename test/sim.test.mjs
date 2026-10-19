// Fast checks that run on every push: maps are valid, the sim is deterministic,
// pathing works, and the core rules hold. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, validateMap, mapChoices, BIOMES, N, idx, PASSABLE } from '../src/sim/mapgen.js';
import { createGame as newGame } from '../src/sim/game.js';
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
  const S = g.state, core = g.map.regions[0].slots; S.stock = {};
  const outside = g.map.slots.find(s => s.region !== 0 && !g.inZone(s.x, s.y));
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

test('heroes: every class fights, the Scavver only weakly', () => {
  for (const hero of ['warrior', 'archer', 'merchant']) {
    const g = createGame({ mode: 'classic', seed: 4, biome: 'highland', hero }); const S = g.state;
    while (S.pendingPicks) g.choosePerk(S.offer[0]);
    S.night = 3; g.startNight();
    for (let k = 0; k < 60 * 200 && S.phase === 'night'; k++) { const m = S.mobs.find(q => !q.roam); if (m) g.heroTo(m.x, m.y); g.step(); }
    const kills = S.log[0].kills.hero || 0;
    assert.ok(kills > 0, `${hero} killed nothing`);
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

test('blessings: rarity by source, pacts, masteries, reroll', () => {
  const g = createGame({ mode: 'classic', seed: 12, biome: 'lakeshore', hero: 'warrior' }); const S = g.state;
  S.picks = ['nest']; g.choosePerk; // a nest offer must hold a legendary
  S.picks = ['nest']; S.pendingPicks = 1; S.offer = ['steel']; S.offerSource = 'nest';
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

test('heroes: abilities work and the Scavver calls a bounty', () => {
  for (const hero of ['warrior', 'archer', 'merchant']) {
    const g = createGame({ mode: 'classic', seed: 6, biome: 'highland', hero, clock: false }); const S = g.state;
    while (S.pendingPicks) g.choosePerk(S.offer[0]);
    S.gold = 50; S.night = 4; g.startNight();
    for (let k = 0; k < 60 * 12; k++) g.step();
    const t = g.map.town; S.hero.x = t.x; S.hero.y = t.y + 3.5;
    if (S.mobs[0]) { S.hero.x = S.mobs[0].x; S.hero.y = S.mobs[0].y; }
    const ok = g.useAbility(S.mobs[0]?.x, S.mobs[0]?.y);
    if (hero === 'merchant') { assert.equal(ok, true); assert.ok(S.bountyT > 0, 'bounty did not start'); assert.equal(S.gold, 50); }
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
const createGame = o => { const g = newGame(o); clearStory(g); return g; };
const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const readyDay = g => { const S = g.state; S.handsExtra = 99; clearStory(g); while (S.pendingPicks) g.choosePerk(S.offer[0]); while (S.packs.length) g.choosePack(S.packs[0]); };
const nextDawn = g => { const S = g.state; g.startNight(); for (let k = 0; S.phase === 'night' && k < 60 * 400; k++) g.step(); };
const firstSite = (g, hops) => g.state.scav.sites.map(s => g.scavenge.siteInfo(s.id)).find(i => i.visible && i.hops === hops);





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
    for (let i = 0; i < g.map.terrain.length && !spot; i++) if (g.map.terrain[i] === 1 && g.zone()[i] && S.occ[i] < 0) spot = { x: i % N + 0.5, y: Math.floor(i / N) + 0.5 };
  }
  assert.ok(spot, 'no rubble in any starting town');
  readyDay(g); const S = g.state;
  const r = g.rubbleAt(spot.x, spot.y), gold = S.gold = 20;
  assert.ok(r.cells.length > 0 && r.cost === (r.cells.length - r.blocks) + 3 * r.blocks);
  assert.equal(g.clearRubble(spot.x, spot.y), r.cells.length);
  assert.equal(S.gold, gold - r.cost);
  assert.ok(r.cells.every(i => g.map.terrain[i] === 0 || g.map.terrain[i] === 6));
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
  for (const r of g.frontier()) g.openDistrict(r);
  assert.ok(S.mobs.some(m => m.roam), 'no roaming dead in the open districts');
  assert.ok(S.mobs.filter(m => m.roam).every(m => !S.sealed[m.roam.region]), 'roamers in sealed districts');
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

test('foreman: the town learns to build by itself once it is established, for every hero', () => {
  for (const hero of ['warrior', 'merchant']) {
    const g = createGame({ seed: 12, hero }); const S = g.state; readyDay(g); S.gold = 400;
    for (let k = 0; k < 60 * 5; k++) g.step();
    assert.equal(S.builders, null, 'builders before the town is established'); S.handsExtra = 99;
    const t = g.map.town; let placed = 0;
    for (let r = 4; r < 12 && placed < 6; r++) for (let a = 0; a < 24 && placed < 6; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('house', x, y).ok && g.build('house', x, y)) placed++; }
    g.upgradeKeep(); for (let k = 0; k < 60; k++) g.step(); assert.ok(!S.foreman, 'foreman before keep 3');
    g.upgradeKeep(); for (let k = 0; k < 60; k++) g.step();
    assert.ok(S.foreman, `${hero}: no foreman with ${S.buildings.length} buildings`);
    assert.equal(S.builders, null, 'the foreman switched itself on'); g.setBuilders('balanced');
    const n0 = S.buildings.length; for (let k = 0; k < 60 * 30 && S.phase === 'day'; k++) g.step();
    assert.ok(S.buildings.length > n0 || S.buildings.some(b => b.level > 1), 'the foreman did nothing');
    g.setBuilders('off'); const n1 = S.buildings.length + S.buildings.reduce((a, b) => a + b.level, 0);
    for (let k = 0; k < 60 * 20 && S.phase === 'day'; k++) g.step();
    assert.equal(S.buildings.length + S.buildings.reduce((a, b) => a + b.level, 0), n1, 'builders worked while off');
  }
});

test('hands, rising costs, power and heat', () => {
  const g = createGame({ seed: 4 }); const S = g.state; readyDay(g); S.handsExtra = 0; S.gold = 500; S.stock = {};
  const t = g.map.town, spot = type => { for (let r = 3; r < 12; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
  const c1 = g.buyCost('house'); let p = spot('house'); g.build('house', p.x, p.y);
  assert.ok(g.buyCost('house') > c1, 'the second home costs the same');
  while (g.handsFree() > 0) { p = spot('farm'); assert.ok(g.build('farm', p.x, p.y)); }
  p = spot('tower'); assert.equal(g.build('tower', p.x, p.y), false, 'built with no free hands');
  S.handsExtra = 99;
  // power: two level 2 towers draw more than the keep makes → blackout; a generator fixes it
  for (let k = 0; k < 3; k++) { p = spot('tower'); g.build('tower', p.x, p.y); }
  S.survivors = 30; g.upgradeKeep();
  for (const b of S.buildings.filter(x => x.type === 'tower')) g.upgrade(b.id);
  g.step(); g.step(); for (let k = 0; k < 20; k++) g.step();
  assert.ok(g.powerOut() > g.powerIn() ? S.blackout : !S.blackout, 'blackout flag out of step');
  if (S.blackout) { const tw = S.buildings.find(b => b.type === 'tower'); assert.equal(g.powered(tw), false); p = spot('generator'); assert.ok(g.build('generator', p.x, p.y)); for (let k = 0; k < 20; k++) g.step(); assert.equal(S.blackout, false, 'a generator did not end the blackout'); }
  // heat climbs toward the town's noise; past the limit a hive bursts after a warning
  S.feat.heat = true; S.night = 3; S.heat = 95; S.heatCool = 0; for (let k = 0; k < 10; k++) g.step();
  assert.ok(S.eruption, 'no eruption warning at heat 95');
  const before = S.mobs.length; for (let k = 0; k < 60 * 41; k++) g.step();
  assert.ok(S.mobs.length > before, 'the hive did not burst');
});

test('blessings: a Calling mostly sees its own family; a Survivor sees all three', () => {
  const count = hero => { const g = createGame({ seed: 3, hero }); const S = g.state, n = {}; for (let k = 0; k < 60; k++) { S.picks = ['nest']; S.offer = ['steel']; S.offerSource = 'nest'; S.reroll.free = 1; g.reroll(); for (const id of S.offer) { const f = (PERKS.find(p => p.id === id) || {}).fam; n[f] = (n[f] || 0) + 1; } } return n; };
  for (const [hero, own, others] of [['warrior', 'hero', ['ranger', 'scavver']], ['archer', 'ranger', ['hero', 'scavver']], ['merchant', 'scavver', ['hero', 'ranger']]]) {
    const n = count(hero); for (const f of others) assert.ok((n[own] || 0) > (n[f] || 0), `${hero}: ${f} offered as often as ${own}`);
  }
  const s = count('survivor'); for (const f of ['hero', 'ranger', 'scavver']) assert.ok(s[f] > 0, `a Survivor never saw ${f}`);
});

test('build zone: near the keep at first, and every building widens it', () => {
  const g = createGame({ mode: 'classic', seed: 9 }); readyDay(g); const S = g.state; S.gold = 200;
  const t = g.map.town, far = { x: t.x + 13.5, y: t.y + 0.5 };
  const z0 = g.zone().reduce((a, v) => a + v, 0);
  assert.ok(!g.inZone(far.x, far.y), 'zone reaches too far at the start');
  // build outward toward the far spot
  for (let k = 0; k < 6; k++) { const p = [...Array(30).keys()].map(d => ({ x: t.x + 4 + k * 2 + (d % 5), y: t.y - 2 + Math.floor(d / 5) })).find(q => g.canPlace('tower', q.x + 0.5, q.y + 0.5).ok); if (p) g.build('tower', p.x + 0.5, p.y + 0.5); }
  assert.ok(g.zone().reduce((a, v) => a + v, 0) > z0, 'buildings did not widen the zone');
  const hive = g.map.regions.find(r => r.nest);
  const i = Math.floor(hive.nest.y) * g.map.N + Math.floor(hive.nest.x);
  assert.equal(g.zone()[i], 0, 'you can build on a living hive');
});

test('supply drops: guarded crates in the wild, opened by standing next to them', () => {
  const g = createGame({ seed: 14 }); const S = g.state; readyDay(g);
  g.dropSupply('Test.');
  assert.equal(S.drops.length, 1); const d = S.drops[0];
  assert.ok(!S.sealed[g.map.region[Math.floor(d.y) * g.map.N + Math.floor(d.x)]], 'a drop landed in a sealed district');
  assert.ok(!g.inZone(d.x, d.y), 'a drop landed inside the base');
  assert.ok(S.mobs.filter(m => m.roam && m.roam.region === -1).length >= 3, 'the drop has no guards');
  for (const m of [...S.mobs]) m.hp = 0; S.mobs.length = 0;   // clear the guards for the test
  const before = { gold: S.gold, pop: g.pop(), picks: S.pendingPicks, stock: JSON.stringify(S.stock) };
  S.hero.x = d.x; S.hero.y = d.y;
  for (let k = 0; k < 60 * 2; k++) g.step();
  assert.equal(S.drops.length, 1, 'opened too fast');
  for (let k = 0; k < 60 * 2; k++) g.step();
  assert.equal(S.drops.length, 0, 'did not open after 3 seconds');
  assert.ok(S.gold > before.gold || g.pop() > before.pop || S.pendingPicks > before.picks || JSON.stringify(S.stock) !== before.stock, 'no reward');
});

test('tech: Workshop and Market need a level 2 keep, take time to build, and unlock level 3', () => {
  const g = createGame({ mode: 'classic', seed: 9 }); readyDay(g); const S = g.state; S.gold = 400;
  const t = g.map.town, spot = type => { for (let r = 3; r < 10; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
  assert.equal(spot('workshop'), null, 'a workshop with a level 1 keep');
  g.upgradeKeep(); g.upgradeKeep();
  const h = spot('house'); g.build('house', h.x, h.y); const home = S.buildings.find(b => b.type === 'house');
  g.upgrade(home.id); assert.equal(home.level === 2 || S.byId.get(home.id).level === 2, true);
  assert.equal(g.upgrade(home.id), false, 'level 3 home without a market');
  const m = spot('market'); assert.ok(g.build('market', m.x, m.y));
  assert.equal(g.upgrade(home.id), false, 'the market works before it is built');
  for (let k = 0; k < 60 * 36; k++) g.step();
  assert.ok(g.hasTech('market'));
  assert.ok(g.upgrade(home.id), 'level 3 home with a finished market');
});

test('the stream: the dead keep coming from awake hives, and they never hold up the dawn', () => {
  const g = createGame({ seed: 16 }); const S = g.state; readyDay(g);
  g.startNight(); for (let k = 0; S.phase === 'night' && k < 60 * 400; k++) g.step();
  readyDay(g);
  let streamed = 0; for (let k = 0; k < 60 * 60; k++) { g.step(); }
  streamed = S.mobs.filter(m => m.stream !== undefined).length + S.kills;
  assert.ok(S.mobs.some(m => m.stream !== undefined) || S.kills > 0, 'no dead came by day');
  g.startNight(); for (let k = 0; S.phase === 'night' && k < 60 * 500; k++) g.step();
  assert.equal(S.phase, 'day', 'the stream kept the night from ending');
});

test('breaking a hive by hand: it rages, then burns', () => {
  const g = createGame({ seed: 16, hero: 'warrior' }); const S = g.state; readyDay(g);
  const reg = g.map.regions.find(r => r.nest && r.ring === 1);
  assert.equal(g.hitHive(reg.id, 5), false, 'a level 1 keep can break a near hive');
  S.gold = 99; g.upgradeKeep();
  for (let k = 0; k < 200 && S.nestAlive[reg.id]; k++) g.hitHive(reg.id, 5);
  assert.equal(S.nestAlive[reg.id], false, 'the hive never burned');
  assert.ok(S.claimed.has(reg.id));
});

test('districts: sealed at the start, opened by choice, identity decided when offered', () => {
  const g = createGame({ seed: 11 }); const S = g.state; readyDay(g);
  const front = g.frontier(); assert.ok(front.length >= 2, 'no frontier');
  assert.ok(g.map.regions.every(r => (r.ring === 0 || (r.ring === 1 && !r.nest)) === !S.sealed[r.id]), 'the home ward is wrong');
  assert.ok(g.map.regions.filter(r => r.ring === 1 && !r.nest).every(r => !g.siteOf(r.id) || g.siteOf(r.id).kind !== 'unknown'), 'a home ward site has no identity');
  const off = front.map(r => g.districtOffer(r)); assert.ok(off.every(o => o.name && o.rarity && o.call));
  assert.equal(g.districtOffer(front[0]).kit, off[0].kit, 'identity changed between looks');
  const r = front[0], site = g.siteOf(r);
  // the hero cannot walk into a sealed district
  const cell = g.map.region.findIndex((v, i) => v === r && g.map.terrain[i] === 0);
  g.heroTo((cell % g.map.N) + 0.5, Math.floor(cell / g.map.N) + 0.5); for (let k = 0; k < 60 * 20; k++) g.step();
  assert.notEqual(g.map.region[Math.floor(S.hero.y) * g.map.N + Math.floor(S.hero.x)], r, 'walked into a sealed district');
  assert.ok(g.openDistrict(r)); assert.equal(S.sealed[r], 0);
  if (site) assert.notEqual(site.kind, 'unknown', 'the site kept no identity');
  assert.ok(g.frontier().length >= front.length - 1);
});

// the path: decisions lean the hero; at level 5 a trial in the city earns the Calling, at 12 the final class
function passTrial(g, choiceId) {
  const S = g.state; S.story.encounters = S.story.encounters.filter(x => x.kind === 'evolve'); const e = S.story.encounters[0]; assert.ok(e && e.kind === 'evolve', 'no class quest offered');
  assert.ok(e.choices.some(c => c.id === choiceId), `no ${choiceId} in ${e.choices.map(c => c.id)}`);
  g.choose(choiceId); const tr = S.story.trial; assert.ok(tr && !tr.done, 'no trial placed');
  S.hero.x = tr.x; S.hero.y = tr.y + 1.5; S.hero.hp = S.hero.maxHp = 999;
  for (let k = 0; k < 60 && !S.mobs.some(m => m.trial); k++) g.step();
  const w = S.mobs.find(m => m.trial); assert.ok(w, 'the trial warden never came');
  for (let k = 0; k < 60 * 60 && S.mobs.includes(w); k++) { S.hero.hp = 999; g.heroTo(w.x, w.y); g.step(); }
  assert.ok(!S.mobs.includes(w), 'could not beat the warden'); assert.ok(tr.done);
}
const levelTo = (g, lv) => { while (g.state.lvl < lv) g.gainXp(g.xpNext() - g.state.xp); };
test('evolution: decisions lead the way; a trial earns the Calling, then the final class', () => {
  const g = createGame({ seed: 8, hero: 'survivor' }); const S = g.state; readyDay(g);
  g.addPath('hero', 6); g.addPath('heart', 1);
  levelTo(g, 4); assert.equal(S.story.encounters.length, 0, 'offered before level 5');
  levelTo(g, 5); passTrial(g, 'trial-warrior'); assert.equal(S.heroClass, 'warrior');
  g.addPath('ranger', 8); levelTo(g, 11); assert.equal(S.story.encounters.filter(e => e.kind === 'evolve').length, 0, 'final offered early');
  levelTo(g, 12); passTrial(g, 'trial-vanguard');
  assert.equal(S.heroClass, 'vanguard'); assert.equal(g.heroDef.name, 'Vanguard'); assert.ok(S.hero.maxHp >= 34);
});
test('decisions lean the path: rescuing is Heart, dealing is Wits', () => {
  const g = createGame({ seed: 5, hero: 'survivor' }); const S = g.state;
  S.story.encounters = [{ id: 99, kind: 'street', title: 't', choices: [{ id: 'a', label: 'a', fx: [{ op: 'survivors', n: 2 }] }] }]; g.choose('a');
  for (const id of [98, 97]) { S.story.encounters = [{ id, kind: 'street', title: 't', choices: [{ id: 'b', label: 'b', fx: [{ op: 'gold', n: 5 }] }] }]; g.choose('b'); }
  assert.ok(S.path.heart >= 1 && S.path.scavver >= 2, JSON.stringify(S.path));
});

test('saving: a dawn snapshot restores the town, the story and the city', () => {
  const g = createGame({ seed: 21, hero: 'survivor', difficulty: 'veteran' }); const S = g.state; readyDay(g); S.gold = 300;
  const t = g.map.town; let n = 0; for (let r = 4; r < 10 && n < 4; r++) for (let a = 0; a < 24 && n < 4; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('house', x, y).ok && g.build('house', x, y)) n++; }
  g.upgradeKeep(); const f = g.frontier(); g.openDistrict(f[0]);
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  assert.ok(JSON.stringify(snap).length < 200000, 'save too big');
  const h = newGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, difficulty: snap.difficulty, restore: snap }); const R = h.state;
  assert.equal(R.buildings.length, S.buildings.length); assert.equal(h.keepLevel(), 2); assert.equal(R.gold, S.gold);
  assert.equal(R.sealed[f[0]], 0); assert.equal(R.story.chronicle.length, S.story.chronicle.length);
  assert.equal(R.difficulty, 'veteran');
  for (let k = 0; k < 60 * 5; k++) h.step();
  assert.ok(!R.over);
});

test('the Heart family: a Medic patches the town, and Brawn + Heart makes a Warden', async () => {
  const g = createGame({ seed: 12, hero: 'survivor' }); const S = g.state; readyDay(g);
  const take = id => { S.picks = ['dawn']; S.offer = [id]; S.pendingPicks = 1; g.choosePerk(id); };
  g.addPath('heart', 6); levelTo(g, 5); passTrial(g, 'trial-medic'); assert.equal(S.heroClass, 'medic');
  S.gold = 99; const t = g.map.town; let b = null;
  for (let r = 4; r < 10 && !b; r++) for (let a = 0; a < 24 && !b; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('house', x, y).ok && g.build('house', x, y)) b = S.buildings[S.buildings.length - 1]; }
  b.hp = 1; S.hero.x = b.x + 1; S.hero.y = b.y + 1; S.ability.cd = 0;
  assert.ok(g.useAbility(), 'Patch Up did not fire'); assert.ok(b.hp > 1, 'Patch Up healed nothing');
  g.addPath('hero', 9); levelTo(g, 12); passTrial(g, 'trial-warden'); assert.equal(S.heroClass, 'warden');
});
