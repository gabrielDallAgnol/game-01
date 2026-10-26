// The folk build by themselves (sim/folk-build.js): the fund is a share of income, they build on free ground only,
// a player building always wins, the veto and the toggle refund, saves carry the village, sandbags take damage off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { FOLK, PROPS } from '../src/content/folk.js';
import { TIDE } from '../src/content/mobs.js';

FOLK.from = 1;   // let the folk work from day 1 here (the game waits for day 2)
// put a building down by hand on the first spot that takes it (rings out from the hall)
const place = (g, type) => { const c = g.map.town.x; for (let r = 5; r < 14; r++) for (let a = 0; a < 16; a++) { const x = c + Math.cos(a / 16 * 6.283) * r, y = c + Math.sin(a / 16 * 6.283) * r; if (g.canPlace(type, x, y, 0, { deep: true }).ok && g.build(type, x, y)) return g.state.buildings.at(-1); } return null; };
// a camp with its needs met (fed, housed): the folk turn to making it home
const settled = seed => { const g = createGame({ seed }); g.state.gold = 200; place(g, 'farm'); place(g, 'farm'); return g; };
const day = (g, sec) => { const S = g.state; for (let k = 0; k < sec * 60 && S.phase === 'day' && S.dayT < TIDE.dayLen - 2; k++) { if (S.story.encounters.length) S.story.encounters.length = 0; g.step(); } };

test('the fund is a share of the day\'s income, taken by the second', () => {
  const g = createGame({ seed: 7 }), S = g.state; S.gold = 100;
  const rate = g.goldPerDawn(), t0 = S.dayT; day(g, 60);
  const want = FOLK.share * rate * (S.dayT - t0) / TIDE.dayLen, took = S.folk.took + S.folk.owed;
  assert.ok(Math.abs(took - want) < 1.01, `took ${took}, want ${want}`);
});

test('the folk finish one project a day, on free ground, and leave your buildings alone', () => {
  const g = createGame({ seed: 7 }), S = g.state; S.gold = 100;
  const mine = S.buildings.map(b => `${b.id}|${b.type}|${b.x}|${b.y}`).join(',');
  S.folk.fund = 30; day(g, 60);
  assert.equal(S.stats.folkBuilt, 1, 'one project done');
  assert.equal(S.folk.job, null, 'and nothing more today');
  assert.ok(S.buildings.filter(b => !b.byFolk).map(b => `${b.id}|${b.type}|${b.x}|${b.y}`).join(',') === mine, 'a player building moved');
  for (const p of S.folk.props) for (const i of p.cells) assert.ok(S.occ[i] < 0 && S.res[i] < 0, 'a prop on a lot');
});

test('a building you put down over a prop moves the prop, never the other way round', () => {
  const g = settled(7), S = g.state;
  S.folk.fund = 30; day(g, 40);
  const p = S.folk.props[0]; assert.ok(p, 'the folk raised something');
  const i = p.cells[0], N = g.map.N, x = (i % N) + 0.5, y = Math.floor(i / N) + 0.5;   // (the grid side: map.N, not a number)
  // a tower right on the prop's cell, if the ground takes one
  assert.ok(g.build('tower', x, y), 'no tower fits there'); { g.step(); assert.ok(!S.folk.props.some(q => q.cells.includes(i)), 'the prop is still under the tower'); }
});

test('the veto and the toggle hand the scrap back', () => {
  const g = createGame({ seed: 9 }), S = g.state; S.gold = 100;
  S.folk.fund = 1; day(g, 3);
  const j = S.folk.job; assert.ok(j, 'a project started');
  const before = S.gold, paid = Math.floor(j.paid);
  assert.equal(g.folkVeto(), paid); assert.equal(S.gold, before + paid); assert.equal(S.folk.job, null);
  day(g, 5); assert.equal(S.folk.job, null, 'a vetoed day stays quiet');
  S.folk.fund = 12; const b2 = S.gold;
  assert.equal(g.setFolkBuild(false), 12); assert.equal(S.gold, b2 + 12); assert.equal(S.folk.fund, 0);
  const b3 = S.gold; day(g, 20); assert.ok(S.gold >= b3, 'the folk still take scrap while switched off');
  assert.equal(S.folk.took, 0);
});

test('a save carries the village', () => {
  const g = settled(7), S = g.state;
  S.folk.fund = 30; day(g, 40);
  const snap = g.snapshot(); assert.ok(snap.folk && snap.folk.props.length, 'no village in the save');
  const h = createGame({ seed: 7, restore: JSON.parse(JSON.stringify(snap)) });
  assert.deepEqual(h.folk().props.map(p => p.kind), g.folk().props.map(p => p.kind));
  assert.equal(h.folk().beauty, g.folk().beauty);
});

test('sandbags take damage off the buildings beside them', () => {
  const g = createGame({ seed: 7 }), S = g.state; S.gold = 100;
  const b = S.buildings.find(o => o.type !== 'keep' && o.type !== 'wall') || (g.build('house', S.keep.x + 6, S.keep.y) && S.buildings.at(-1));
  assert.ok(b, 'no building to shield');
  const hp0 = b.hp; g.hitBuilding(b.id, 5); const plain = hp0 - b.hp; b.hp = hp0;
  S.folk.props.push({ id: 99, kind: 'sandbags', x: b.x + 1.5, y: b.y, cells: [], rot: 0 }); S.folk.ver++;
  g.hitBuilding(b.id, 5); const shielded = hp0 - b.hp;
  assert.ok(Math.abs(shielded - plain * (1 - PROPS.sandbags.guard)) < 1e-6, `${shielded} vs ${plain}`);
});
