// [econ3] The Solar Flare economy: the construction queue (order, crews, refund, scaffolds that do not work yet), flat
// tower price, never walling yourself in, and the dawn Settlement XP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { N, PASSABLE, idx, inside } from '../src/sim/mapgen.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const ring = (g, type, r0 = 3) => { const t = g.map.town; for (let r = r0; r < 16; r++) for (let a = 0; a < 24; a++) { const x = Math.floor(t.x + Math.cos(a / 24 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 24 * 6.28) * r) + 0.5; if (g.canPlace(type, x, y, 0, { deep: true }).ok) return { x, y }; } return null; };
const quiet = (g, n) => { const S = g.state; for (let k = 0; k < n; k++) { S.mobs.length = 0; clearStory(g); g.step(); } };
const fresh = (seed = 5) => { const g = createGame({ seed, hero: 'warrior' }); g.state.keep.hp = g.state.keep.maxHp = 1e6; clearStory(g); return g; };

test('the queue: blueprints go up in order, one crew at a time early, and cancelling refunds what was paid', () => {
  const g = fresh(), S = g.state; S.gold = 200;
  const ids = [];
  for (const t of ['house', 'farm', 'tower']) { const p = ring(g, t); assert.ok(p && g.build(t, p.x, p.y), `no ${t}`); ids.push(S.buildings[S.buildings.length - 1].id); }
  const q = g.queue(); assert.equal(q.length, 3); assert.deepEqual(q.map(j => j.type), ['house', 'farm', 'tower']);
  assert.ok(S.buildings.every(b => b.built < 1), 'something stood up at once');
  assert.equal(g.crews(), 1, 'one crew at the start');
  // reorder: the tower to the top
  assert.ok(g.queueMove(q[2].id, 'top')); assert.deepEqual(g.queue().map(j => j.type), ['tower', 'house', 'farm']);
  quiet(g, 60 * 3); const q2 = g.queue();
  assert.ok(q2[0].pct > 0 && q2[1].pct === 0, `only the top job works: ${q2.map(j => j.pct)}`);
  // cancel the farm: its scrap comes back and its lot is free again
  const farm = q2.find(j => j.type === 'farm'), gold0 = S.gold;
  assert.ok(g.queueCancel(farm.id)); assert.equal(S.gold, gold0 + farm.paid); assert.ok(!S.buildings.some(b => b.type === 'farm'), 'the farm scaffold stayed');
  // the tower finishes first, then the home
  const done = []; for (let k = 0; k < 60 * 40 && g.queue().length; k++) { quiet(g, 1); for (const b of S.buildings) if (b.built >= 1 && !done.includes(b.type)) done.push(b.type); }
  assert.deepEqual(done, ['tower', 'house']);
  const home = S.buildings.find(b => b.type === 'house'); assert.ok(home.folk > 0, 'the family never moved in');
});

test('a scaffold does not work: a tower going up does not shoot, a home going up does not pay; upgrades queue too', () => {
  const g = fresh(6), S = g.state; S.gold = 200;
  const p = ring(g, 'tower', 6); g.build('tower', p.x, p.y); const tw = S.buildings.find(b => b.type === 'tower');
  const m = g.spawnMob('walker', tw.x + 2, tw.y); m.hp = m.maxHp = 1e6; m.speed = 0;
  S.keep.ruined = true;   // keep its arrows out of it
  for (let k = 0; k < 60; k++) g.step();
  assert.ok(!S.projectiles.some(q => q.src === 'tower'), 'a scaffold tower shot');
  assert.equal(g.incomePerCycle().gold, g.incomePerCycle().gold);   // smoke
  tw.built = 1; quiet(g, 2); S.keep.ruined = false; S.keep.level = 2;
  assert.equal(g.queue().length, 0);
  assert.ok(g.upgrade(tw.id)); assert.equal(tw.level, 1, 'the upgrade was instant');
  assert.equal(g.queue()[0].kind, 'up'); assert.equal(g.upgrade(tw.id), false, 'two upgrades of one tower at once');
  for (let k = 0; k < 60 * 20 && g.queue().length; k++) quiet(g, 1);
  assert.equal(S.byId.get(tw.id).level, 2);
});

test('towers cost the same however many you have, and the dead tear a scaffold down for good', () => {
  const g = fresh(7), S = g.state; S.gold = 500;
  const c0 = g.buyCost('tower');
  for (let k = 0; k < 4; k++) { const p = ring(g, 'tower'); assert.ok(p && g.build('tower', p.x, p.y)); }
  assert.equal(g.buyCost('tower'), c0, 'the tower price climbed');
  const b = S.buildings[S.buildings.length - 1], n = S.buildings.length;
  g.hitBuilding(b.id, 1e6);
  assert.equal(S.buildings.length, n - 1, 'a torn scaffold left a ruin'); assert.ok(!g.queue().some(j => j.bid === b.id));
});

test('the hero never walls himself in, and never walks inside a building', () => {
  const g = fresh(8), S = g.state; S.gold = 5000; S.instantBuild = true;
  const t = g.map.town;
  // build over the yard cell first (it used to be where the reach check started, so after it any wall passed)
  const yard = g.canPlace('house', t.x, t.y + 3.5, 0, { deep: true }); if (yard.ok) g.build('house', yard.x, yard.y);
  let n = 0;
  for (let r = 2; r < 12; r++) for (let a = 0; a < 40; a++) for (const type of ['house', 'farm', 'tower']) {
    const x = Math.floor(t.x + Math.cos(a / 40 * 6.28) * r) + 0.5, y = Math.floor(t.y + Math.sin(a / 40 * 6.28) * r) + 0.5;
    if (g.canPlace(type, x, y, 0, { deep: true }).ok && g.build(type, x, y)) n++;
  }
  assert.ok(n > 15, `only ${n} buildings`);
  // flood from the hero over open ground: it must reach the woods well beyond the town
  const h = S.hero, seen = new Uint8Array(N * N), q = [idx(Math.floor(h.x), Math.floor(h.y))]; seen[q[0]] = 1; let far = 0;
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % N, y = (i / N) | 0; far = Math.max(far, Math.hypot(x - t.x, y - t.y)); if (far > 22) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, j = idx(xx, yy); if (!inside(xx, yy) || seen[j] || !PASSABLE[S.map.terrain[j]] || S.occ[j] >= 0) continue; seen[j] = 1; q.push(j); }
  }
  assert.ok(far > 22, `the hero is walled in (reaches ${far.toFixed(1)} cells)`);
  // walk straight at a home: he stops at its wall
  const home = S.buildings.find(b => b.type === 'house');
  h.x = home.x + 2.5; h.y = home.y; g.setHeroInput(-1, 0);
  for (let k = 0; k < 120; k++) { g.step(); assert.ok(S.occ[idx(Math.floor(h.x), Math.floor(h.y))] < 0, 'the hero walked into a building'); }
  g.setHeroInput(0, 0);
});

test('dawn Settlement: a well-run night pays XP and says why', () => {
  const g = fresh(12), S = g.state; S.gold = 100; S.food = 40;
  const p = ring(g, 'farm'); g.build('farm', p.x, p.y);
  for (let k = 0; k < 60 * 20 && g.queue().length; k++) quiet(g, 1);
  const xp0 = S.xp + 1000 * S.lvl;
  g.startNight(); let settle = null;
  for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) { S.mobs.length = 0; g.step(); for (const e of S.events) if (e.t === 'settle') settle = e; S.events.length = 0; }
  assert.ok(settle, 'no settlement report'); assert.ok(settle.xp > 0);
  const ids = settle.lines.map(l => l.id); assert.ok(ids.includes('safe') && ids.includes('held') && ids.includes('built'), ids.join());
  assert.ok(S.ledger.settle && S.ledger.settle.xp === settle.xp, 'not in the dawn ledger');
  assert.ok(S.xp + 1000 * S.lvl > xp0, 'no XP');
});

test('a dawn save carries the queue', () => {
  const g = fresh(13), S = g.state; S.gold = 100;
  quiet(g, 1); const p = ring(g, 'house'); g.build('house', p.x, p.y);
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  const g2 = createGame({ seed: 13, hero: 'warrior', restore: snap }), S2 = g2.state;
  assert.equal(g2.queue().length, 1);
  const b = S2.buildings.find(x => x.type === 'house'); assert.ok(b.built < 1 && b.folk === 0, 'the scaffold came back whole');
});
