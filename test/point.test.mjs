// [point] The Point, the first map: a peninsula closed by water (the rivers and the cut are walls), one broken bridge out,
// the boss wedged in its gap (a pinned walker that never moves), and the Point itself home: clean from the start.
import '../tools/roam/headless.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
const { buildTown } = await import('../src/roam/town.js');
const { createRoam } = await import('../src/roam/sim.js');
const town = buildTown(7, { world: 'point' }), W = town.W, B = town.blocked, deck = W.decks[0];
test('the water is a wall; the bridge deck is not, its gap is', () => {
  const rivers = W.land.filter(l => l.kind === 'water' && l.lines);
  for (const l of rivers) for (const ln of l.lines) { const p = ln.pts[Math.floor(ln.pts.length / 2)]; assert.ok(B(p.x, p.y), l.name); }
  assert.ok(B(deck.x, deck.y), 'the gap is water');
  assert.ok(!B(deck.a.x, deck.a.y) && !B(deck.b.x, deck.b.y), 'both ends of the deck are road');
});
test('home is clean, the peninsula is one area held by one walker wedged in the bridge', () => {
  const sim = createRoam(town, 1), S = sim.state, home = S.areas.find(a => a.home), main = S.areas.find(a => a.pin);
  assert.ok(home && home.state === 'clean' && home.walker < 0); assert.ok(main && main.level === 1);
  const d = S.dead.find(q => q.id === main.walker); assert.ok(d); const x0 = d.x, y0 = d.y;
  for (let i = 0; i < 30 * 20; i++) sim.step({ x: 0, y: 0 });
  assert.ok(Math.hypot(d.x - x0, d.y - y0) < 0.01, 'it never moves'); assert.ok(Math.hypot(d.x - deck.x, d.y - deck.y) < 1);
});
