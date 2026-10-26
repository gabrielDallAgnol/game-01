// [area] The engine-built towns as game maps: valid for the game's own checks, deterministic, the camp on the keep;
// a map asked for without an area is the default town. (Assert on small values: a failing assert on the whole map
// object makes the test runner print it, and that runs out of memory.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, validateMap, idx, T, PASSABLE, DEFAULT_AREA } from '../src/sim/mapgen.js';
import { AREAS } from '../src/sim/areamap.js';

const sum = m => { let h = 0; for (let i = 0; i < m.terrain.length; i++) h = (h * 31 + m.terrain[i] * 7 + m.road[i]) >>> 0; return h; };

test('a map without an area is the default town', () => {
  const a = generateMap(42, 'riverbend'), b = generateMap(42, 'riverbend', {}), c = generateMap(42, 'riverbend', { area: DEFAULT_AREA });
  assert.equal(a.area && a.area.id, DEFAULT_AREA); assert.equal(sum(a), sum(b)); assert.equal(sum(a), sum(c));
});

for (const id of AREAS) test(`${id}: game maps pass the game's checks and repeat per seed`, () => {
  for (const s of [42, 9001, 123457]) {
    const m = generateMap(s, 'riverbend', { area: id });
    assert.deepEqual(validateMap(m), [], `${id} seed ${s}`);
    assert.equal(sum(m), sum(generateMap(s, 'riverbend', { area: id })), `${id} seed ${s} repeats`);
    const A = m.area, c = m.town.x;
    assert.ok(Math.abs(A.W.camp.x + A.ox - c) < 1 && Math.abs(A.W.camp.y + A.oy - c) < 1, 'the area camp sits on the keep');
    assert.ok(PASSABLE[m.terrain[idx(Math.floor(c), Math.floor(c))]], 'the keep stands on open ground');
    let rock = 0, road = 0; for (let i = 0; i < A.mask.length; i++) if (A.mask[i]) { if (m.terrain[i] === T.ROCK) rock++; if (m.road[i]) road++; }
    assert.ok(rock > 1500 && road > 3000, `${id} seed ${s}: buildings ${rock} m², streets ${road} m²`);
  }
});
