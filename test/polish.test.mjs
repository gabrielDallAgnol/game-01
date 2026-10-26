// [polish] Hollowmere's readability rules in the sim: Kai's home (the old town) and the Rig's clearing start known,
// she sees farther than the base game, a restored save keeps its shroud, and the graffiti stand apart on open ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { SIGHT } from '../src/content/ch1tune.js';
import { PASSABLE, idx } from '../src/sim/mapgen.js';

const make = (seed = 3, o = {}) => createGame({ seed, area: 'hollowmere', hero: 'survivor', ...o });
const run = (g, s) => { for (let k = 0; k < s * 60; k++) g.step(); };
const seenAt = (S, x, y) => S.seen[idx(Math.floor(x), Math.floor(y))] === 1;

test('sight: the old town and the Rig clearing start known, Kai sees SIGHT.hero round her', () => {
  const g = make(), S = g.state, c = g.map.town.x, A = g.map.area, d = A.W.districts.find(q => q.kind === 'oldtown');
  assert.ok(seenAt(S, c + SIGHT.rig - 1, c), 'the Rig clearing');
  assert.ok(seenAt(S, d.at.x + A.ox, d.at.y + A.oy), 'the old town middle');
  const p = d.poly[0]; assert.ok(seenAt(S, p.x + A.ox, p.y + A.oy), 'the ring street');
  let n = 0; for (const v of S.seen) n += v; assert.ok(n < S.seen.length * 0.5, 'most of the town is still to explore');
  S.hero.x = c; S.hero.y = c - 150; run(g, 0.5);
  assert.ok(seenAt(S, c + SIGHT.hero - 1.5, c - 150), 'Kai opens the shroud farther than the base 8 m');
});

test('sight: nothing changes outside Hollowmere', () => {
  const g = createGame({ seed: 3, area: 'suburb' }); let n = 0; for (const v of g.state.seen) n += v;
  const r = 14, approx = Math.PI * r * r; assert.ok(n < approx * 1.3, `suburb starts with the base reveal only (${n})`);
});

test('graffiti: every tag stands on open ground, apart from the others', () => {
  const g = make(), S = g.state; S.night = 9; const L = g.graffiti(), m = g.map;
  assert.ok(L.length >= 15);
  for (const a of L) {
    const i = idx(Math.floor(a.x), Math.floor(a.y)); assert.ok(PASSABLE[m.terrain[i]], `${a.id} on open ground`);
    for (const b of L) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 6, `${a.id} and ${b.id} apart`);
  }
  const sq = L.filter(q => q.id.startsWith('g.square'));
  for (const a of sq) for (const b of sq) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 9, 'the opening tags do not overlap');
});
