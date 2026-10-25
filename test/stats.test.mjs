// [hero3] The Thermal Pioneer's stats: points, thresholds, hybrids, the hooks, titles, saving, the bots' spread and
// the class picks switched off. Run with: node --test test/stats.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { STATS_FLAG, POINTS, HYBRID_AT } from '../src/content/stats.js';
import { CALLING_LVL } from '../src/content/season.js';
import { LEVEL } from '../src/sim/state.js';
import { titleOf } from '../src/sim/stats.js';

const clearStory = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } };
const fresh = (seed = 7) => { const g = createGame({ seed, hero: 'survivor' }); clearStory(g); return g; };
const xpTo = lv => { let n = 0; for (let l = 1; l < lv; l++) n += LEVEL.xp(l); return n; };
const levelTo = (g, lv) => { g.gainXp(Math.max(0, xpTo(lv) - xpTo(g.state.lvl) - g.state.xp)); g.step(); };

test('points: 3 at the awakening, 3 a level, +1 a stat tome', () => {
  const g = fresh(), S = g.state;
  assert.equal(g.statsInfo().pts, POINTS.start);
  levelTo(g, 5); assert.equal(S.lvl, 5);
  assert.equal(S.attr.pts, POINTS.start + POINTS.perLevel * 4);
  assert.ok(g.addStatPoints(1, 'tome')); assert.equal(S.attr.pts, POINTS.start + POINTS.perLevel * 4 + 1); assert.equal(S.attr.tomes, 1);
  assert.ok(!g.spendStat('str', 999), 'cannot spend more than you have'); assert.ok(!g.spendStat('luck', 1), 'no such stat');
});

test('thresholds: an ability at 10, its second rank at 20, a capstone at 30; hybrids at 15 + 15', () => {
  const g = fresh(), S = g.state; g.addStatPoints(200, 'test');
  const got = () => g.statsInfo().abilities.filter(a => a.got).map(a => a.id);
  g.spendStat('str', 9); assert.ok(!got().includes('cleave'));
  g.spendStat('str', 1); assert.ok(got().includes('cleave'));
  assert.equal(g.statsInfo().abilities.find(a => a.id === 'cleave').rank, 1);
  g.spendStat('str', 10); assert.equal(g.statsInfo().abilities.find(a => a.id === 'cleave').rank, 2, 'rank 2 at 20');
  assert.equal(g.statsInfo().abilities.find(a => a.id === 'cleave').name, 'Shockwave Cleave');
  assert.ok(!got().includes('unbreak')); g.spendStat('str', 10); assert.ok(got().includes('unbreak'), 'capstone at 30');
  g.spendStat('int', HYBRID_AT - 1); assert.ok(!got().includes('radiant'));
  g.spendStat('int', 1); assert.ok(got().includes('radiant'), 'STR + INT: Radiant Blade');
  g.spendStat('agi', HYBRID_AT); assert.ok(got().includes('whirl') && got().includes('wild'), 'STR+AGI and AGI+INT');
  g.spendStat('gov', HYBRID_AT); for (const id of ['iron', 'skirm', 'arise']) assert.ok(got().includes(id), `${id} unlocked`);
  // every pair of stats has a hybrid
  const pairs = g.statsInfo().abilities.filter(a => a.pair).map(a => a.pair.slice().sort().join('+'));
  assert.equal(new Set(pairs).size, 6);
  // each unlock is announced once
  assert.equal(S.events.filter(e => e.t === 'statUnlock' && e.id === 'cleave' && !e.rank).length, 1);
});

test('what a point gives: STR health and damage, AGI attack rate and speed, INT power and cooldowns', () => {
  const g = fresh(), S = g.state; g.addStatPoints(60, 'test');
  const hp0 = S.hero.maxHp, dps0 = g.heroDps();
  g.spendStat('str', 20); assert.ok(S.hero.maxHp >= hp0 + 3, `STR adds health (${hp0} → ${S.hero.maxHp})`);
  const dps1 = g.heroDps(); assert.ok(dps1 > dps0 * 1.06 && dps1 < dps0 * 1.09, `20 STR ≈ +7% damage (${dps0} → ${dps1})`);
  g.spendStat('agi', 20); const dps2 = g.heroDps(); assert.ok(dps2 > dps1 * 1.045 && dps2 < dps1 * 1.075, '20 AGI ≈ +6% attack rate');
  g.spendStat('int', 10); const cd = g.powersInfo().actives.find(a => a.id === 'burst').cdMax; assert.ok(cd < 14 * 1.4 && cd > 12 * 1.4, `INT cuts cooldowns (${cd})`);
});

test('an active: Heavy Cleave hits and throws back the dead round you, then cools down', () => {
  const g = fresh(), S = g.state; g.addStatPoints(10, 'test'); g.spendStat('str', 10);
  const h = S.hero, ms = [0, 1, 2].map(k => g.spawnMob('walker', h.x + Math.cos(k * 2) * 1.5, h.y + Math.sin(k * 2) * 1.5, { rise: 1, hp: 200, maxHp: 200 }));
  const d0 = ms.map(m => Math.hypot(m.x - h.x, m.y - h.y));
  assert.ok(g.usePower('cleave'));
  assert.ok(ms.every(m => m.hp < 200), 'every dead in reach is hit');
  assert.ok(ms.some((m, i) => Math.hypot(m.x - h.x, m.y - h.y) > d0[i] + 0.3), 'and thrown back');
  assert.ok(!g.usePower('cleave'), 'cooling down'); assert.ok(g.powersInfo().actives[0].cd > 10);
  assert.ok(!g.usePower('blink'), 'locked');
});

test('titles follow the build', () => {
  assert.equal(titleOf({ str: 0, agi: 0, int: 0, gov: 0 }), 'Thermal Pioneer');
  assert.equal(titleOf({ str: 30, agi: 5, int: 5, gov: 5 }), 'Rackbreaker');
  assert.equal(titleOf({ str: 2, agi: 2, int: 40, gov: 3 }), 'Ember Sage');
  assert.equal(titleOf({ str: 2, agi: 2, int: 3, gov: 40 }), 'Warden of the Rig');
  assert.equal(titleOf({ str: 20, agi: 2, int: 20, gov: 3 }), 'Radiant Knight');
  const g = fresh(); g.addStatPoints(20, 'test'); g.spendStat('gov', 15); assert.equal(g.state.attr.title, 'Shift Lead');
});

test('saving: stats, points and what was told come back; an old save is paid for its levels', () => {
  const g = fresh(), S = g.state; levelTo(g, 8); g.addStatPoints(10, 'test'); g.spendStat('str', 12); g.spendStat('gov', 10);
  const snap = JSON.parse(JSON.stringify(g.snapshot())); assert.ok(snap.hero3 && snap.hero3.v === 1);
  const g2 = createGame({ seed: 7, hero: 'survivor', restore: snap }), A = g2.state.attr;
  assert.deepEqual([A.str, A.agi, A.int, A.gov, A.pts], [S.attr.str, S.attr.agi, S.attr.int, S.attr.gov, S.attr.pts]);
  assert.equal(g2.state.hero.maxHp, S.hero.maxHp, 'STR health survives the load');
  assert.ok(g2.statsInfo().abilities.find(a => a.id === 'cleave').got && g2.statsInfo().abilities.find(a => a.id === 'rally').got);
  g2.step(); assert.equal(g2.state.events.filter(e => e.t === 'statUnlock').length, 0, 'no unlock is announced twice after a load');
  const old = { ...snap }; delete old.hero3;
  const g3 = createGame({ seed: 7, hero: 'survivor', restore: old });
  assert.equal(g3.state.attr.pts, POINTS.start + POINTS.perLevel * (S.lvl - 1), 'an old save gets its levels\' points');
  g3.step(); assert.equal(g3.state.attr.pts, POINTS.start + POINTS.perLevel * (S.lvl - 1), 'and no level is paid twice');
});

test('the bots and the autopilot spend their points by the spread, and use their abilities', () => {
  const g = fresh(), S = g.state; levelTo(g, 15);
  assert.ok(g.autoStats() > 0); assert.equal(S.attr.pts, 0);
  assert.ok(S.attr.str > S.attr.agi && S.attr.agi > S.attr.int && S.attr.int >= 5, `a fighter's spread: ${JSON.stringify(S.attr)}`);
  const g2 = fresh(); g2.setAutopilot(true); levelTo(g2, 6); g2.step(); assert.equal(g2.state.attr.pts, 0, 'the autopilot spends');
  // fires Heavy Cleave when a crowd is on it
  const h = S.hero; for (let k = 0; k < 4; k++) g.spawnMob('walker', h.x + 0.8 * Math.cos(k), h.y + 0.8 * Math.sin(k), { rise: 1 });
  assert.ok(g.powersAuto(), 'a crowd: the bot fires'); assert.ok(g.powersInfo().actives.find(a => a.id === 'cleave').cd > 0);
});

test('class picks are off while the stats are on, and back with the flag off', () => {
  const g = fresh(); levelTo(g, CALLING_LVL); g.story().flush(); g.step();
  assert.equal(g.state.story.encounters.filter(e => e.kind === 'evolve').length, 0, 'no Calling offered');
  assert.equal(g.state.heroClass, 'survivor');
  STATS_FLAG.on = false;
  try {
    const g2 = fresh(); assert.equal(g2.statsInfo().pts, 0); levelTo(g2, CALLING_LVL); g2.story().flush();
    assert.equal(g2.state.attr.pts, 0, 'no points with the flag off');
    assert.ok(g2.state.story.encounters.some(e => e.kind === 'evolve'), 'the Calling is offered again');
  } finally { STATS_FLAG.on = true; }
});
