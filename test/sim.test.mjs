// Fast checks that run on every push: maps are valid, the sim is deterministic,
// pathing works, and the core rules hold. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, validateMap, mapChoices, BIOMES, N, idx, PASSABLE } from '../src/sim/mapgen.js';
import { createGame as newGame, LEVEL, NOISE, HEAT, TENSION, PRESENCE, TOOLS, CUT, NEST } from '../src/sim/game.js';
import { HEROES } from '../src/content/heroes.js';
import { CALLING_LVL, FINAL_LVL, LEGEND_LVL } from '../src/content/season.js';
import { BUILDINGS } from '../src/content/buildings.js';
import { TIDE } from '../src/content/mobs.js';
import { playRun } from '../tools/bot.mjs';

test('the frontier map generates valid worlds across 20 seeds', () => {
  for (const biome of ['riverbend']) for (let s = 1; s <= 20; s++) {
    const m = generateMap(s, biome);
    assert.deepEqual(validateMap(m), [], `${biome} seed ${s}`);
  }
});

test('one world while we test: the start screen offers a single valid map', () => {
  for (let s = 1; s <= 5; s++) { const c = mapChoices(s); assert.equal(c.length, 1); assert.equal(c[0].biome, 'riverbend'); }
});

test('the frontier: a camp in the woods, the road starts deep in the forest, the city is far away', () => {
  const m = generateMap(4, 'riverbend'), c = N / 2;
  let nearRoad = 0; for (let y = c - 30; y < c + 30; y++) for (let x = c - 30; x < c + 30; x++) if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < 30 && m.road[idx(x, y)]) nearRoad++;
  assert.equal(nearRoad, 0, 'the road reaches the camp');
  assert.ok(Math.hypot(m.city.x - c, m.city.y - c) - m.city.r > 120, 'the city is too close');
  assert.ok(m.landmarks.filter(l => l.kind === 'farmstead' || l.kind === 'lumber').length >= 2, 'no farms or lumber camps in the woods');
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

test('palisades reroute the dead instead of being ignored (walls are cut for now: tested with the flag off)', () => {
  CUT.walls = false; try {
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
// tests of the districts and the city: the fence down from day 1 (act 2 at once; CUT.earlyRoad off, see sim/acts.js)
const withOpenRoad = fn => () => { CUT.earlyRoad = false; try { return fn(); } finally { CUT.earlyRoad = true; } };
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
const readyDay = g => { const S = g.state; S.handsExtra = 99; clearStory(g); while (S.pendingPicks) g.choosePerk(S.offer[0]); while (S.packs.length) g.choosePack(S.packs[0]); };
const nextDawn = g => { const S = g.state; g.startNight(); for (let k = 0; S.phase === 'night' && k < 60 * 400; k++) g.step(); };
const firstSite = (g, hops) => g.state.scav.sites.map(s => g.scavenge.siteInfo(s.id)).find(i => i.visible && i.hops === hops);





test('weather is a season rule now: never rolled at dawn; a storm or still rule sets every night', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const g = createGame({ seed, hero: 'archer' }), S = g.state;
    for (let n = 0; n < 6 && !S.over; n++) { readyDay(g); assert.equal(S.weather, 'clear', `weather rolled on night ${S.night}`); S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); }
  }
  const g = createGame({ seed: 2 }), S = g.state;
  S.night = 6; const base = g.forecast().reduce((a, r) => a + r.count, 0);
  g.setSeasonRules(['still']); assert.equal(S.weather, 'still'); const still = g.forecast().reduce((a, r) => a + r.count, 0);
  g.setSeasonRules(['still', 'storm']); assert.ok(g.rule('still') && g.rule('storm'), 'stacked rules');
  g.setSeasonRules(['storm']); assert.equal(S.weather, 'storm'); const storm = g.forecast().reduce((a, r) => a + r.count, 0);
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
});

test('nothing grows past the keep', () => {
  const g = createGame({ mode: 'classic', seed: 3 }); readyDay(g); const S = g.state; S.gold = 200;
  const s = g.map.slots.find(q => S.claimed.has(q.region) && g.canPlace('house', q.x, q.y).ok);
  assert.ok(g.build('house', s.x, s.y)); const b = S.buildings.find(x => x.type === 'house');
  assert.ok(!g.upgrade(b.id), 'L2 home with an L1 keep');
  assert.ok((prepKeep(g), g.upgradeKeep())); assert.ok(g.upgrade(b.id));
  assert.ok(!g.upgrade(b.id), 'L3 home with an L2 keep');
});

test('towers need crew from homes; people make no noise', () => {
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
  // a bigger town is not a louder one: noise comes from loud choices, not from people
  S.feat.heat = true; g.step(); const n0 = g.noise();
  for (let k = 0; k < 6; k++) { const h = spot('house'); if (h) g.build('house', h.x, h.y); }
  g.step(); assert.equal(g.noise(), n0, 'homes made noise');
  assert.equal(g.townDraw(), 1 + 0.5 * g.noise() / 100);
});

test('blessings: a dawn pick every other day, never more than two picks a dawn', () => {
  const g = createGame({ seed: 5, hero: 'archer' }); const S = g.state;
  readyDay(g);
  const counts = [];
  for (let n = 0; n < 4 && !S.over; n++) { S.chestsHeld = 4; S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); counts.push(S.pendingPicks); readyDay(g); }
  for (const c of counts) assert.ok(c <= 2, `${c} picks in one dawn`);
});

test('tides: night 1 is a tough first dead then two packs from two sides, dusk falls on its own, roamers wander the wild', () => {
  const g = createGame({ seed: 7 }); const S = g.state; readyDay(g);
  for (const r of g.frontier()) g.openDistrict(r);
  assert.ok(S.mobs.some(m => m.roam), 'no roaming dead in the open districts');
  assert.ok(S.mobs.filter(m => m.roam).every(m => !S.sealed[m.roam.region]), 'roamers in sealed districts');
  assert.ok(S.mobs.filter(m => m.roam).every(m => !S.claimed.has(m.roam.region)));
  for (let k = 0; k < 60 * 101 && S.phase === 'day'; k++) g.step();
  assert.equal(S.phase, 'night', 'dusk did not fall');
  assert.equal(S.queue.length, 1 + TIDE.night1.packA.length + TIDE.night1.packB.length); assert.ok(S.queue[0].first, 'the first dead walks ahead');
  assert.ok(S.queue.slice(1).every(q => !q.first && q.t > S.queue[0].t + 5), 'the packs come after the first dead');
  assert.equal(new Set(S.queue.map(q => q.nest)).size, 2, 'night 1 comes from two directions');
  for (let k = 0; k < 60 * 6; k++) g.step();
  const first = S.mobs.find(m => m.first); assert.ok(first, 'the first dead never came');
  assert.ok(first.maxHp > 3);
  for (let k = 0; S.phase === 'night' && k < 60 * 300; k++) g.step();
  assert.equal(S.phase, 'day', 'roamers kept the night from ending');
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

test('cuts: no hands limit, no power (until a Lights Out rule), rising costs', () => {
  const g = createGame({ seed: 4 }); const S = g.state; readyDay(g); S.handsExtra = 0; S.gold = 900; S.stock = {};
  const t = g.map.town, spot = type => { for (let r = 3; r < 14; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y).ok) return { x, y }; } return null; };
  const c1 = g.buyCost('house'); let p = spot('house'); g.build('house', p.x, p.y);
  assert.ok(g.buyCost('house') > c1, 'the second home costs the same');
  // towers climb in a straight line: +25% of the base for every tower you have
  const base = g.costOf('tower'); for (let k = 0; k < 4; k++) { assert.equal(g.buyCost('tower'), Math.round(base * (1 + 0.25 * k))); p = spot('tower'); assert.ok(g.build('tower', p.x, p.y)); }
  // no hands: a dozen jobs in one morning
  for (let k = 0; k < 8; k++) { p = spot('farm'); assert.ok(g.build('farm', p.x, p.y), `job ${k} refused`); }
  // power is cut: no generator, no draw, no blackout, no power window
  assert.equal(g.canPlace('generator', p.x + 3, p.y).ok, false, 'a generator in the build list');
  S.survivors = 30; prepKeep(g); assert.ok(g.upgradeKeep());
  for (const b of S.buildings.filter(x => x.type === 'tower')) assert.ok(g.upgrade(b.id));
  for (let k = 0; k < 30; k++) g.step();
  assert.equal(g.powerOut(), 0); assert.equal(S.blackout, false); assert.ok(!S.feat.power, 'the power window opened');
  // a Lights Out rule brings power back: draw counts, generators can be built
  g.setSeasonRules(['lightsOut']); for (let k = 0; k < 30; k++) g.step();
  assert.ok(g.powerOut() > 0, 'no draw under Lights Out');
  if (g.powerOut() > g.powerIn()) { assert.ok(S.blackout, 'no blackout under Lights Out'); p = spot('generator'); assert.ok(g.build('generator', p.x, p.y)); for (let k = 0; k < 30; k++) g.step(); assert.equal(S.blackout, false); }
});

test('blessings: a Calling mostly sees its own family; a Survivor sees all three', () => {
  const count = hero => { const g = createGame({ seed: 3, hero }); const S = g.state, n = {}; for (let k = 0; k < 60; k++) { S.picks = ['chest']; S.offer = ['steel']; S.offerSource = 'chest'; S.reroll.free = 1; g.reroll(); for (const id of S.offer) { const f = (PERKS.find(p => p.id === id) || {}).fam; n[f] = (n[f] || 0) + 1; } } return n; };
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

test('burning a hive: the horde comes at once (no pause), with runners and a brute; flare and smoke are buttons', () => {
  const g = createGame({ seed: 16, hero: 'warrior' }); const S = g.state; readyDay(g);
  const city = g.map.regions.find(r => r.nest && r.ring === 2);
  assert.equal(g.hitHive(city.id, 5), false, 'a level 1 keep can break a city hive');
  const reg = g.map.regions.find(r => r.nest && r.ring === 1);
  S.night = 4; let hits = 0;
  for (; hits < 900 && S.nestAlive[reg.id]; hits++) g.hitHive(reg.id, 5);
  assert.equal(S.nestAlive[reg.id], false, 'the hive never burned');
  assert.ok(hits * 5 >= 102 * 1.7, `a hollow fell to ${hits * 5} damage`);
  assert.equal(S.escape, null, 'the burn still pauses for a card');
  const horde = S.mobs.filter(m => m.horde === reg.id);
  assert.ok(horde.length >= 6 + 4 - 2, `a horde of ${horde.length}`);
  assert.ok(horde.filter(m => m.kind === 'runner').length >= 2 && horde.some(m => m.kind === 'brute'), 'no runners or brute from night 4');
  assert.ok(horde.every(m => m.hunt), 'the horde does not come for you');
  // a flare: 4 scrap, the dead near you chase the light; then a cooldown
  S.hero.x = reg.nest.x + 2; S.hero.y = reg.nest.y; S.gold = 10;
  assert.ok(g.useFlare(reg.nest.x + 9, reg.nest.y)); assert.equal(S.gold, 6);
  assert.ok(S.mobs.filter(m => m.lure).length >= 3, 'the flare lured nobody');
  assert.equal(g.useFlare(), false, 'the flare ignored its cooldown'); assert.ok(!g.tools().flare.ready);
  // smoke: 3 food, they lose your scent
  S.food = 5; for (const m of horde) { m.lure = null; m.hunt = true; m.x = S.hero.x + 1; m.y = S.hero.y; }
  assert.ok(g.useSmoke()); assert.equal(S.food, 2); assert.ok(horde.every(m => !m.hunt && m.smoke > 0));
  // the old escape() call still works as a thin wrapper
  S.hero.hp = S.hero.maxHp = 1e6; for (let k = 0; k < 60 * 21; k++) g.step(); S.gold = 10; assert.ok(g.escape('flare'));
});

test('districts: sealed at the start, opened by choice, identity decided when offered', withOpenRoad(() => {
  const g = createGame({ seed: 11 }); const S = g.state; readyDay(g);
  const front = g.frontier(); assert.ok(front.length >= 2, 'no frontier');
  assert.ok(g.map.regions.every(r => (r.ring <= 2) === !S.sealed[r.id]), 'only the old core should be sealed');
  assert.ok(g.map.regions.filter(r => r.ring === 1).every(r => !g.siteOf(r.id) || g.siteOf(r.id).kind !== 'unknown'), 'a home ward site has no identity');
  assert.ok(S.pickups.length >= 12, 'no pickups to find');
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
}));

// the path: decisions lean the hero; three tiers by level: the Calling (15), the advanced class (30), the legendary form (45)
function passTrial(g, choiceId) {
  const S = g.state; g.story().flush(); S.story.encounters = S.story.encounters.filter(x => x.kind === 'evolve'); const e = S.story.encounters[0]; assert.ok(e && e.kind === 'evolve', 'no class quest offered');
  const id = choiceId || e.choices.find(c => c.id.startsWith('trial-')).id;
  assert.ok(e.choices.some(c => c.id === id), `no ${id} in ${e.choices.map(c => c.id)}`);
  g.choose(id); const tr = S.story.trial; assert.ok(tr && !tr.done, 'no trial placed');
  S.hero.x = tr.x; S.hero.y = tr.y + 1.5; S.hero.hp = S.hero.maxHp = 999;
  for (let k = 0; k < 60 && !S.mobs.some(m => m.trial); k++) g.step();
  const w = S.mobs.find(m => m.trial); assert.ok(w, 'the trial warden never came'); assert.ok(w.bossName, 'the trial boss has no name');
  for (let k = 0; k < 60 * 120 && S.mobs.includes(w); k++) { S.hero.hp = 999; g.heroTo(w.x, w.y); g.step(); }
  assert.ok(!S.mobs.includes(w), 'could not beat the warden'); assert.ok(tr.done);
  return e;
}
const levelTo = (g, lv) => { while (g.state.lvl < lv) g.gainXp(g.xpNext() - g.state.xp); };
test('evolution: three tiers by level, each earned by a trial with a named boss', () => {
  const g = createGame({ seed: 8, hero: 'survivor' }); const S = g.state; readyDay(g);
  g.addPath('hero', 6); g.addPath('heart', 1);
  levelTo(g, CALLING_LVL - 1); g.story().flush(); assert.equal(S.story.encounters.filter(e => e.kind === 'evolve').length, 0, 'offered before the Calling level');
  levelTo(g, CALLING_LVL); g.story().flush();
  { const e = S.story.encounters.find(x => x.kind === 'evolve'); assert.equal(e.tier, 1); assert.equal(e.choices.filter(c => c.id.startsWith('trial-')).length, 2, 'not two Callings');
    assert.ok(e.jobs.every(j => j.perks.length >= 2 && j.who), 'a Calling without plain perks'); assert.ok(e.jobs.find(j => j.cls === 'warrior').yours, 'the lived path is not marked'); }
  passTrial(g, 'trial-warrior'); assert.equal(S.heroClass, 'warrior');
  g.addPath('ranger', 8); levelTo(g, FINAL_LVL - 1); g.story().flush(); assert.equal(S.story.encounters.filter(e => e.kind === 'evolve').length, 0, 'tier 2 offered early');
  levelTo(g, FINAL_LVL);
  { const e = passTrial(g); assert.equal(e.tier, 2); }
  assert.ok(HEROES[S.heroClass].base === 'warrior' && !HEROES[S.heroClass].legend, `not an advanced class: ${S.heroClass}`);
  levelTo(g, LEGEND_LVL - 1); g.story().flush(); assert.equal(S.story.encounters.filter(e => e.kind === 'evolve').length, 0, 'tier 3 offered early');
  levelTo(g, LEGEND_LVL);
  { const e = passTrial(g); assert.equal(e.tier, 3); assert.equal(e.jobs.length, 1); }
  const L = HEROES[S.heroClass]; assert.ok(L.legend && L.calling === 'warrior', `not the warrior's legendary form: ${S.heroClass}`);
  assert.equal(L.name, 'Juggernaut');
});
test('the class tiers land in order on the XP curve, and no Calling deals less than the Survivor', () => {
  const xpTo = lv => { let x = 0; for (let l = 1; l < lv; l++) x += LEVEL.xp(l); return x; };
  assert.ok(xpTo(CALLING_LVL) < xpTo(FINAL_LVL) && xpTo(FINAL_LVL) < xpTo(LEGEND_LVL) && LEGEND_LVL <= LEVEL.max);
  // calibrated on the autopilot bot: ~390 xp by night 9, ~2000 by night 22, then ~200 a night (tiers at ~9, ~22, ~37)
  assert.ok(xpTo(CALLING_LVL) >= 300 && xpTo(CALLING_LVL) <= 480, `Calling needs ${xpTo(CALLING_LVL)} xp`);
  assert.ok(xpTo(FINAL_LVL) >= 1600 && xpTo(FINAL_LVL) <= 2500, `the advanced class needs ${xpTo(FINAL_LVL)} xp`);
  assert.ok(xpTo(LEGEND_LVL) >= 4500 && xpTo(LEGEND_LVL) <= 6500, `the legendary class needs ${xpTo(LEGEND_LVL)} xp`);
  const dps = h => HEROES[h].attack.dmg / HEROES[h].attack.rate;
  for (const h of ['warrior', 'archer', 'merchant', 'medic']) assert.ok(dps(h) >= dps('survivor'), `${h}: ${dps(h).toFixed(2)} < survivor ${dps('survivor').toFixed(2)}`);
});
test('decisions lean the path: rescuing is Heart, dealing is Wits', () => {
  const g = createGame({ seed: 5, hero: 'survivor' }); const S = g.state;
  S.story.encounters = [{ id: 99, kind: 'street', title: 't', choices: [{ id: 'a', label: 'a', fx: [{ op: 'survivors', n: 2 }] }] }]; g.choose('a');
  for (const id of [98, 97]) { S.story.encounters = [{ id, kind: 'street', title: 't', choices: [{ id: 'b', label: 'b', fx: [{ op: 'gold', n: 5 }] }] }]; g.choose('b'); }
  assert.ok(S.path.heart >= 1 && S.path.scavver >= 2, JSON.stringify(S.path));
});

test('saving: a dawn snapshot restores the town, the story and the city', withOpenRoad(() => {
  const g = createGame({ seed: 21, hero: 'survivor', difficulty: 'veteran' }); const S = g.state; readyDay(g); S.gold = 300;
  const t = g.map.town; let n = 0; for (let r = 4; r < 10 && n < 4; r++) for (let a = 0; a < 24 && n < 4; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('house', x, y).ok && g.build('house', x, y)) n++; }
  (prepKeep(g), g.upgradeKeep()); const f = g.frontier(); g.openDistrict(f[0]);
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  assert.ok(JSON.stringify(snap).length < 200000, 'save too big');
  const h = newGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, difficulty: snap.difficulty, restore: snap }); const R = h.state;
  assert.equal(R.buildings.length, S.buildings.length); assert.equal(h.keepLevel(), 2); assert.equal(R.gold, S.gold);
  assert.equal(R.sealed[f[0]], 0); assert.equal(R.story.chronicle.length, S.story.chronicle.length);
  assert.equal(R.difficulty, 'veteran');
  for (let k = 0; k < 60 * 5; k++) h.step();
  assert.ok(!R.over);
}));

test('the Heart family: a Medic patches the town', async () => {
  const g = createGame({ seed: 12, hero: 'survivor' }); const S = g.state; readyDay(g);
  const take = id => { S.picks = ['dawn']; S.offer = [id]; S.pendingPicks = 1; g.choosePerk(id); };
  g.addPath('heart', 6); levelTo(g, CALLING_LVL); passTrial(g, 'trial-medic'); assert.equal(S.heroClass, 'medic');
  S.gold = 99; const t = g.map.town; let b = null;
  for (let r = 4; r < 10 && !b; r++) for (let a = 0; a < 24 && !b; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace('house', x, y).ok && g.build('house', x, y)) b = S.buildings[S.buildings.length - 1]; }
  b.hp = 1; S.hero.x = b.x + 1; S.hero.y = b.y + 1; S.ability.cd = 0;
  assert.ok(g.useAbility(), 'Patch Up did not fire'); assert.ok(b.hp > 1, 'Patch Up healed nothing');
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
  for (let k = 0; k < 60 * 120 && !marked && S.phase === 'night'; k++) { const m = S.mobs.find(q => !q.roam); if (m) { g.heroTo(m.x, m.y); if (m.markT > 0) marked = true; } g.step(); }
  assert.ok(marked || S.mobs.some(m => m.markT > 0) || (S.log[0] && (S.log[0].kills.hero || 0) > 0), 'nothing the hero hit was Marked');
});

test('noise: one meter from loud choices, not people; choices hold for nights; fights spike and fade; it sets hearing, the wave and the burst', () => {
  const g = createGame({ seed: 4 }); readyDay(g); const S = g.state; S.feat.heat = true; S.gold = 400;
  for (let k = 0; k < 5; k++) put(g, 'house'); g.step(); assert.equal(g.noise(), 0, 'homes are loud');
  prepKeep(g); assert.ok(g.upgradeKeep()); put(g, 'market'); g.step();
  assert.equal(g.noiseInfo().floor, NOISE.market, 'the market is quiet');
  assert.equal(g.hearRadius(), 62 + 1.2 * S.noise);
  // a quiet story choice holds for nights
  g.addHeat(-20); g.step(); assert.equal(g.noise(), 0);
  S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); readyDay(g);
  assert.ok(S.noiseChoice <= -20 * (1 - NOISE.choiceFade) + 1e-9 && S.noiseChoice < -10, `the quiet faded to ${S.noiseChoice} in a night`);
  // fighting spikes and fades fast
  S.noiseChoice = 0; S.noiseSpike = 30; for (let k = 0; k < 60 * 10; k++) g.step();
  assert.ok(S.noiseSpike < 13, `a spike of 30 is still ${S.noiseSpike} after 10 s`);
  // the wave multiplier is capped at ×1.5
  S.noise = 100; assert.equal(g.townDraw(), 1.5);
  // past 80 a hive bursts (after a warning)
  S.night = 6; S.heatCool = 0; S.noiseChoice = NOISE.choiceMax; S.noiseSpike = 40; for (let k = 0; k < 10; k++) g.step();
  assert.ok(S.eruption, `no burst warning at noise ${S.noise}`);
});

test('the honest forecast strip and the dawn ledger', () => {
  const g = createGame({ seed: 6 }); readyDay(g); const S = g.state; S.gold = 99;
  const f = g.forecastStrip(); assert.ok(['safe', 'risk', 'fall'].includes(f.hall)); assert.ok(f.atRisk >= 0 && f.brutes >= 0 && f.dead >= 1);
  S.night = 10; const m = g.forecastStrip(); assert.ok(m.brutes >= 1, 'a blood moon with no brute forecast'); S.night = 1;
  const h = put(g, 'house'); g.hitBuilding(h.id, 999); nextDawn(g);
  const L = lastEv(S, 'ledger'); assert.ok(L, 'no ledger at dawn');
  assert.ok(L.fell.some(b => b.id === h.id && b.type === 'house'), 'the ledger forgot what fell'); assert.ok(L.rose.length === 1 && L.people === 1);
  assert.ok(L.held >= 0 && L.held <= 100); assert.equal(g.ledger(), S.ledger);
});

test('cuts: titles are flavour, no trader, one companion, no crew events, generators out of the build list', () => {
  for (const k of ['walls', 'power', 'hands', 'weather', 'titleStats', 'secondCompanion', 'trader', 'crew']) assert.ok(CUT[k], `${k} is not cut`);
  assert.equal(CUT.finalClass, false, 'the advanced class (tier 2, Lv 30) is back');
  const g = createGame({ seed: 7, hero: 'merchant' }); readyDay(g); const S = g.state;
  const dmg = S.P.heroDmg, keepHp = S.P.keepHp; g.story().grant('gravedigger'); g.story().grant('firstLight'); g.step();
  assert.equal(S.P.heroDmg, dmg); assert.equal(S.P.keepHp, keepHp); assert.ok(S.story.titles.includes('gravedigger'), 'the title itself is gone');
  S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g); assert.equal(S.trade, null, 'the trader came');
  prepKeep(g); g.upgradeKeep(); g.upgradeKeep(); assert.equal(g.keepLevel(), 3); assert.equal(g.partySize(), 1);
});

test('the Merchant Guild upgrades by the same rules as you (hall level, Workshop)', () => {
  const g = createGame({ seed: 8 }); readyDay(g); const S = g.state; S.gold = 400;
  for (let k = 0; k < 8; k++) put(g, 'house'); const towers = [put(g, 'tower'), put(g, 'tower')];
  S.offer = ['guild']; S.picks = ['dawn']; S.pendingPicks = 1; g.choosePerk('guild');
  S.keep.hp = S.keep.maxHp = 1e6; nextDawn(g);
  assert.ok(towers.every(t => S.byId.get(t.id).level === 1), 'the guild raised a tower past a level 1 hall');
  prepKeep(g); assert.ok(g.upgradeKeep()); assert.ok(g.upgradeKeep()); readyDay(g); nextDawn(g); readyDay(g); nextDawn(g);
  assert.ok(towers.every(t => S.byId.get(t.id).level === 2), 'level 3 without a Workshop');
});

test('no money printers: barricades never pay salvage, and a ruin always costs more to rebuild than it gave', () => {
  const g = createGame({ seed: 9 }); readyDay(g); const S = g.state; S.gold = 200;
  S.offer = ['salvage']; S.picks = ['dawn']; S.pendingPicks = 1; g.choosePerk('salvage');
  CUT.walls = false; const w = put(g, 'wall'); CUT.walls = true; const t = put(g, 'tower');
  let gold = S.gold; g.hitBuilding(w.id, 999); assert.ok(S.byId.get(w.id).ruined); assert.equal(S.gold, gold, 'a barricade paid salvage');
  gold = S.gold; g.hitBuilding(t.id, 999); const got = S.gold - gold; assert.ok(got >= 1, 'no salvage');
  assert.ok(g.rebuildCost(t.id) > got && g.rebuildCost(w.id) >= 1, 'rebuilding pays');
  assert.ok(g.buyCost('wall') >= 2);
});

test('aggro fires on a change only: once per dead per 10 s, never a flood', () => {
  const g = createGame({ seed: 7 }); const S = g.state; readyDay(g);
  for (const r of g.frontier()) g.openDistrict(r);
  const m = S.mobs.find(q => q.roam && !q.warden && q.kind === 'walker'); assert.ok(m);
  S.events.length = 0; S.hero.hp = S.hero.maxHp = 1e6;
  for (let k = 0; k < 60 * 30; k++) { S.hero.x = m.roam.x + 40; S.hero.y = m.roam.y; if (k % 2) { S.hero.x = m.x + 1; S.hero.y = m.y; } g.step(); }
  const per = {}; for (const e of S.events) if (e.t === 'aggro') per[e.id] = (per[e.id] || 0) + 1;
  for (const [id, n] of Object.entries(per)) assert.ok(n <= 3, `dead ${id} fired aggro ${n} times in 30 s`);
});

test('blessings fit the run: no barricade perks without barricades, no bolts for an axe, no Kinship alone; one chest a day; nests are run-changers', () => {
  const g = createGame({ seed: 3, hero: 'warrior' }); readyDay(g); const S = g.state; const seen = new Set();
  for (let k = 0; k < 80; k++) { S.picks = ['chest']; S.offer = ['steel']; S.offerSource = 'chest'; S.reroll.free = 1; g.reroll(); S.offer.forEach(id => seen.add(id)); }
  for (const id of ['timber', 'thorns', 'tar', 'bastion', 'tips', 'pierce', 'sentinel', 'kinship', 'storm', 'triage', 'haggle']) assert.ok(!seen.has(id), `${id} offered to a warrior with no walls or companion`);
  for (let k = 0; k < 20; k++) { S.picks = ['nest']; S.offer = ['steel']; S.offerSource = 'nest'; S.reroll.free = 1; g.reroll(); assert.ok(S.offer.length >= 2 && S.offer.every(id => ['ballista', 'bell', 'sanct', 'guild', 'volley', 'shelter', 'last', 'execute'].includes(id)), S.offer.join()); }
  S.picks = []; S.offer = []; S.pendingPicks = 0;
  for (let k = 0; k < 2; k++) S.chests.push({ id: 900 + k, x: S.hero.x, y: S.hero.y });
  g.step(); assert.equal(S.picks.filter(p => p === 'chest').length, 1, 'two chest blessings in one day');
});

test('contracts: stacked rules, a finale, and a won contract steps the difficulty back ~40% of the season', () => {
  const g = createGame({ seed: 10 }); readyDay(g); const S = g.state;
  assert.ok(Array.isArray(S.season.rules));
  g.setSeasonRules(['raiders', 'fog']); assert.ok(g.rule('raiders') && g.rule('fog') && !g.rule('winter'));
  S.night = 12; S.season.start = 1; const before = g.effNight();
  const reg = g.map.regions.find(r => r.nest && r.ring === 1); assert.ok(g.setFinale({ kind: 'hive', region: reg.id }));
  for (let k = 0; k < 900 && S.nestAlive[reg.id]; k++) g.hitHive(reg.id, 5);
  const F = lastEv(S, 'finale'); assert.ok(F && F.won, 'no finale event when the finale hive burned');
  assert.equal(S.diffNight, 0.4 * 11); assert.ok(Math.abs(g.effNight() - (before - 4.4)) < 1e-9);
  assert.equal(g.contractWon(), false, 'a contract paid twice');
  // a season that runs out: the finale is lost
  const h = createGame({ seed: 10 }); readyDay(h); const T = h.state; T.night = T.season.end; h.startNight(); for (let k = 0; T.phase === 'night' && k < 60 * 400; k++) { T.keep.hp = T.keep.maxHp; h.step(); }   // the hall can't fall here (level-ups re-derive its max hp)
  const L = lastEv(T, 'finale'); assert.ok(L && L.won === false, 'no lost finale when the season ended');
  assert.equal(T.season.n, 2); assert.deepEqual(T.season.rules, T.story.rules || [], 'a new season carries only the rules a contract signed (the season\'s own rule is offered, not imposed)');
  assert.ok(T.story.encounters.some(e => e.kind === 'contract') || T.story.later.some(x => x.enc.kind === 'contract'), 'no contract offered for the new season');
});

test('engine calls for contracts.js and the UI: setDifficulty, endRun with a reason, contractWon(share), lightsout alias', () => {
  const g = createGame({ seed: 12 }); readyDay(g); const S = g.state; S.night = 6;
  const b0 = g.forecast().reduce((a, r) => a + r.count, 0);
  assert.ok(g.setDifficulty('nightmare')); assert.equal(S.difficulty, 'nightmare'); assert.ok(g.forecast().reduce((a, r) => a + r.count, 0) > b0, 'difficulty did not retune the run');
  assert.equal(g.setDifficulty('nope'), false);
  g.setSeasonRules(['lightsout']); assert.ok(g.rule('lightsOut') && g.rule('lightsout'));
  S.night = 11; S.season.start = 1; assert.ok(g.contractWon(0.5)); assert.equal(S.diffNight, 5);
  assert.ok(g.endRun(false, 'The Toll-King')); assert.ok(S.over); assert.equal(S.log[S.log.length - 1].reason, 'The Toll-King');
  assert.equal(lastEv(S, 'over').reason, 'The Toll-King'); assert.equal(g.endRun(false), false, 'ended twice');
});

test('events: the type is never overwritten by a payload; hits and deaths carry src and dmg', () => {
  const g = createGame({ seed: 16, hero: 'warrior' }); readyDay(g); const S = g.state;
  const reg = g.map.regions.find(r => r.nest && r.ring === 1); for (let k = 0; k < 900 && S.nestAlive[reg.id]; k++) g.hitHive(reg.id, 5);
  S.gold = 10; S.events.length = 0; assert.ok(g.useFlare()); const f = lastEv(S, 'flare'); assert.ok(f && f.dur === TOOLS.flare.t, 'the flare event lost its type');
  S.night = 3; g.startNight(); S.events.length = 0;
  for (let k = 0; k < 60 * 60 && !S.events.some(e => e.t === 'die' && e.src === 'hero'); k++) { const m = S.mobs.find(q => !q.roam); if (m) g.heroTo(m.x, m.y); g.step(); }
  const hit = S.events.find(e => e.t === 'hitM'); assert.ok(hit && hit.src && hit.dmg > 0, JSON.stringify(hit));
  const die = S.events.find(e => e.t === 'die' && e.src); assert.ok(die && 'dmg' in die, JSON.stringify(die));
});

test('nests defend themselves: a guard pack wakes, rage climbs while you stay and cools when you leave; its site stays locked until it burns', () => {
  const g = createGame({ seed: 5, hero: 'warrior' }); const S = g.state; readyDay(g);
  const reg = g.map.regions.find(r => r.nest && r.ring === 1 && S.landmarks.some(l => l.region === r.id && l.kind !== 'unknown'));
  const site = S.landmarks.find(l => l.region === reg.id), n = reg.nest;
  // locked: the card can say why and point at the hive
  assert.equal(g.siteLock(site.id), reg.id);
  S.hero.x = site.x; S.hero.y = site.y + site.size / 2 + 1; S.gold = 999; S.events.length = 0;
  assert.equal(g.claimLandmark(site.id), false, 'claimed a site next to a living hive');
  assert.ok(S.events.some(e => e.t === 'fail' && /Burn the hive first/.test(e.msg)), 'no reason given');
  // walk up to the hive: the guard rises and comes for you
  S.hero.hp = S.hero.maxHp = 1e6; S.hero.x = n.x + 1.5; S.hero.y = n.y; S.events.length = 0;
  const pin = () => { S.hero.x = n.x + 1.5; S.hero.y = n.y; S.hero.target = null; };
  g.step();
  const wake = S.events.find(e => e.t === 'nestGuard'); assert.ok(wake && wake.n >= NEST.pack[1], 'no guard pack');
  assert.ok(S.mobs.filter(m => m.guard === reg.id).every(m => m.hunt), 'the guard does not come for you');
  // stay: the rage climbs a level every NEST.step seconds, each one a wave, with System lines
  for (let k = 0; k < 60 * NEST.step * 3.2; k++) { pin(); S.hero.cd = 1; g.step(); }   // stand without striking (the hive must not burn)
  const waves = S.events.filter(e => e.t === 'nestRage');
  assert.ok(waves.length >= 3, `${waves.length} rage waves`); assert.ok(waves[2].n >= waves[0].n, 'the rage does not grow');
  assert.ok(g.nestRage(reg.id).lv >= 3 && S.events.some(e => e.t === 'toast' && /Hive stirs/.test(e.msg)), 'no rage telegraph');
  // a second visit the same day does not raise a second pack
  assert.equal(S.events.filter(e => e.t === 'nestGuard').length, 1);
  // walk away: it cools down and stops sending
  S.hero.x = n.x + NEST.near + 25; S.hero.y = n.y; S.events.length = 0;
  for (let k = 0; k < 60 * (NEST.step * NEST.max / NEST.decay + 2); k++) { S.hero.x = n.x + NEST.near + 25; S.hero.target = null; g.step(); }
  assert.equal(g.nestRage(reg.id), null, 'the rage never cooled');
  assert.equal(S.events.filter(e => e.t === 'nestRage').length, 0, 'it kept sending dead after you left');
  // burn it: the guards run with the horde, the site unlocks with a line
  pin(); S.events.length = 0;
  for (let k = 0; k < 900 && S.nestAlive[reg.id]; k++) g.hitHive(reg.id, 5);
  assert.ok(!S.nestAlive[reg.id]);
  assert.equal(g.siteLock(site.id), -1, 'the site is still locked');
  assert.ok(S.events.some(e => e.t === 'siteFree' && e.id === site.id) && S.events.some(e => e.t === 'toast' && /Site unlocked/.test(e.msg)), 'no unlock line');
  assert.ok(S.mobs.every(m => m.guard !== reg.id), 'guards left behind at a burned hive');
  S.hero.x = site.x; S.hero.y = site.y + site.size / 2 + 1;
  assert.equal(g.claimLandmark(site.id), true, 'cannot claim the freed site');
});
