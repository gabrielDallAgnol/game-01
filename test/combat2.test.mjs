// [combat2] Telegraphed bites and the dash: a dead in reach winds up first; a hero who dashes out of reach makes it
// whiff, one who stays is bitten when the wind-up ends; the same seed plays the same; the dash cools down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { DASH, WINDUP } from '../src/content/combat2.js';

const DT = 1 / 20;

// a tough walker at the hero's side (between the hero and the hall), so the dash outward has open ground
function setup(seed) {
  const g = createGame({ seed }), S = g.state, h = S.hero, c = g.map.town.x;
  let ox = h.x - c, oy = h.y - c; const l = Math.hypot(ox, oy) || 1; ox /= l; oy /= l;
  const m = g.spawnMob('walker', h.x - ox * 0.6, h.y - oy * 0.6, { hp: 9999, maxHp: 9999, rise: 1, hunt: true });
  g.drainEvents();
  return { g, S, h, m, out: { x: ox, y: oy } };
}
const mine = (es, id) => es.filter(e => (e.t === 'windup' || e.t === 'whiff' || e.t === 'bite') && e.id === id);
function run(g, secs, log, onWind) {
  for (let k = 0; k < secs / DT; k++) { g.step(DT); const es = g.drainEvents(); log.push(...es.map(e => ({ ...e, at: +(k * DT).toFixed(3) }))); if (onWind && es.some(e => e.t === 'windup')) { onWind(); onWind = null; } }
}

function dodge(seed) {
  const { g, h, m, out } = setup(seed), log = [];
  let dashed = false;
  run(g, 1.5, log, () => { dashed = g.dash(out.x, out.y); });   // (Oct 26: 0.9 → 1.5 s, the wind-up's start moves with the seed's draws; cut at the whiff)
  const L = mine(log, m.id), cut = L.findIndex(e => e.t === 'whiff');
  return { log: cut >= 0 ? L.slice(0, cut + 1) : L, dashed, hero: [h.x, h.y], mob: [m.x, m.y], hp: h.hp };
}

test('a hero who dashes out of a wind-up makes the dead whiff', () => {
  const r = dodge(3);
  assert.ok(r.dashed, 'the dash went');
  const kinds = r.log.map(e => e.t);
  assert.equal(kinds[0], 'windup');
  assert.ok(kinds.includes('whiff'), `whiffs: ${kinds}`);
  assert.ok(!kinds.includes('bite'), `no bite: ${kinds}`);
  assert.ok(Math.hypot(r.hero[0] - r.mob[0], r.hero[1] - r.mob[1]) > WINDUP.reach + WINDUP.grace, 'out of reach');
});

test('a hero who stays is bitten when the wind-up ends', () => {
  const { g, m } = setup(3), log = [];
  run(g, 1.5, log);
  const es = mine(log, m.id), w = es.find(e => e.t === 'windup'), b = es.find(e => e.t === 'bite');
  assert.ok(w && b, `wind-up then bite: ${es.map(e => e.t)}`);
  assert.equal(w.dur, WINDUP.kinds.walker);
  assert.ok(Math.abs(b.at - w.at - w.dur) < DT * 1.5, `the bite lands at the end of the wind-up (${(b.at - w.at).toFixed(2)} s)`);
  assert.ok(!es.some(e => e.t === 'whiff'));
});

test('the same seed plays the same', () => {
  assert.deepEqual(dodge(3), dodge(3));
  assert.deepEqual(dodge(11), dodge(11));
});

test('the dash has a cooldown', () => {
  const { g } = setup(5);
  assert.ok(g.dash(1, 0)); assert.ok(!g.dash(1, 0), 'cooling down');
  for (let k = 0; k < DASH.cd / DT + 2; k++) g.step(DT);
  assert.ok(g.dashInfo().ready, 'ready again'); assert.ok(g.combat2());
});
