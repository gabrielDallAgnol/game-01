// The world outside the walls: wildlife in the woods and worn trails. Fast and headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { mapChoices, idx, T } from '../src/sim/mapgen.js';
import { MOBS, TIDE } from '../src/content/mobs.js';
import { WOODS } from '../src/content/woods.js';

function make(seed = 3) {
  const ch = mapChoices(seed)[0];
  const g = createGame({ seed, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor' });
  return { g, S: g.state, map: g.map, c: g.map.town.x };
}
const wild = S => S.mobs.filter(m => MOBS[m.kind].animal);

test('wildlife: herds spread over the open woods, a full stock at the start, a little back each dawn', () => {
  for (const seed of [1, 3, 5]) {
    const { g, S } = make(seed);
    const a = wild(S), deer = a.filter(m => m.kind === 'deer').length;
    assert.ok(deer >= TIDE.roam.animals.deer.start && deer <= TIDE.roam.animals.deer.cap, `seed ${seed}: ${deer} deer`);
    assert.ok(a.some(m => m.kind === 'boar'), `seed ${seed}: no boar`);
    assert.ok(new Set(a.map(m => m.roam.region)).size >= 3, `seed ${seed}: herds bunched in one place`);
    // hunt every deer, then dawn brings back one herd, not the whole stock
    for (const m of a.filter(m => m.kind === 'deer')) g.killMob(m, 'hero');
    assert.equal(S.mobs.filter(m => m.kind === 'deer').length, 0);
    g.spawnAnimals();
    const back = S.mobs.filter(m => m.kind === 'deer').length, H = TIDE.roam.animals.deer.herd;
    assert.ok(back >= H[0] && back <= H[1] * TIDE.roam.animals.deer.regrow, `seed ${seed}: ${back} deer came back at once`);
  }
});

test('trails: walking the same woods a few times over wears a trail; it is saved and restored', () => {
  const { g, S, map, c } = make(3);
  let A = null;
  for (let r = 18; r < 40 && !A; r++) for (let a = 0; a < 6.28 && !A; a += 0.1) {
    const x = Math.floor(c + Math.cos(a) * r), y = Math.floor(c + Math.sin(a) * r);
    let ok = true; for (let k = 0; k < 6; k++) { const i = idx(x + k, y); if (map.terrain[i] !== T.FOREST || g.inZone(x + k + 0.5, y + 0.5) || S.occ[i] >= 0 || map.lm[i] >= 0) ok = false; }
    if (ok) A = { x, y };
  }
  assert.ok(A, 'no woods to walk');
  const trail = () => { let n = 0; for (let k = 1; k < 5; k++) if (map.terrain[idx(A.x + k, A.y)] === T.DIRT) n++; return n; };
  const pass = () => { S.hero.x = A.x - 0.5; S.hero.y = A.y + 0.5; S.hero.target = null; S.hero.path = null; g.heroTo(A.x + 6.5, A.y + 0.5); for (let i = 0; i < 60 * 6; i++) g.step(); S.time += WOODS.gap; };
  for (let p = 1; p < WOODS.passes; p++) { pass(); assert.equal(trail(), 0, `a trail after ${p} passes`); }
  pass();
  assert.equal(trail(), 4, 'no trail after enough passes');
  assert.ok(S.events.some(e => e.t === 'trail') || S.trails.length >= 4);
  // the save carries the trail: restore a dawn snapshot of a fresh game with these trails
  const fresh = make(3), R = fresh.g.snapshot(); assert.ok(R, 'no snapshot'); R.trails = S.trails.slice();
  const g2 = createGame({ seed: 3, mapSeed: mapChoices(3)[0].seed, biome: mapChoices(3)[0].biome, hero: 'survivor', restore: R });
  for (let k = 1; k < 5; k++) assert.equal(g2.map.terrain[idx(A.x + k, A.y)], T.DIRT, 'trail lost on restore');
});
