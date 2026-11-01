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
test('the boss in the bridge can only be freed: shot down it lies open; a chip and five taps in time free it, its brood powers down, the area is clean', () => {
  const sim = createRoam(town, 2), S = sim.state, d = S.dead.find(q => q.boss), F = 1.3;
  assert.ok(S.known.includes('link_chip'));
  d.plates = 0; d.hp = 1; S.kai.x = S.bike.x = d.x - 14; S.kai.y = S.bike.y = d.y; S.kai.riding = true;
  for (let i = 0; i < 30 * 60 && !d.weak; i++) { S.kai.hp = 1e6; sim.step({ x: 0, y: 0, fire: true }); }
  assert.ok(d.weak && S.dead.includes(d) && d.hp > 0, 'it lies open, not destroyed');
  const inp = { x: 0, y: 0, link: true }; sim.step(inp); assert.ok(!S.link, 'no chip, no link');
  S.keys.link = 1; inp.link = true; sim.step(inp); assert.ok(S.link);
  for (let k = 0; k < 30 * 30 && S.link; k++) { const L = S.link, ph = L.t % F; if (Math.min(ph, F - ph) < 0.04 && L.lock <= 0) inp.link = true; S.kai.hp = 1e6; sim.step(inp); }
  assert.strictEqual(S.guardians.length, 1); assert.ok(!S.dead.includes(d)); assert.strictEqual(S.keys.link, 0);
  assert.ok(!S.dead.some(q => q.mother === d.id), 'its brood powered down'); assert.ok(S.areas.every(a => a.state === 'clean'));
});
test('Wend Bridge: shut while the boss is wedged in it; once it is free, 60 carried scrap and Kai guarding the work open the road', () => {
  const sim = createRoam(town, 3), S = sim.state, b = S.bridges[0], gate = town.gates.find(g => g.deck === b.name); gate.open = false;
  assert.ok(B(b.x, b.y) && !town.wall(b.x, b.y), 'the gap stops wheels, not shots');
  S.kai.x = S.bike.x = b.a.x; S.kai.y = S.bike.y = b.a.y; S.scrap = 100; sim.step({ x: 0, y: 0 });
  assert.ok(!sim.canMend(), 'the boss is wedged in it');
  const d = S.dead.find(q => q.boss); S.dead.splice(S.dead.indexOf(d), 1);
  assert.ok(sim.canMend()); assert.ok(sim.mend()); assert.strictEqual(S.scrap, 40);
  for (let i = 0; i < 30 * 20; i++) { S.kai.hp = 1e6; S.kai.x = S.bike.x = b.a.x; S.kai.y = S.bike.y = b.a.y; sim.step({ x: 0, y: 0 }); }
  assert.strictEqual(b.state, 'mended'); assert.ok(!B(b.x, b.y), 'the road runs on'); gate.open = false;
});
