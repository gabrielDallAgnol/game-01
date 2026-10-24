// [gemini3] What was ported from Gemini's fork (Oct 24): the build tag, small and strong (maturity, compact,
// garrison), logging and the Logger's Hut, the dead by day, committed hunters, hollows you have to find.
// Adapted from Gemini's test/phase1_2.test.mjs (cases 1, 5, 6); its construction-queue, flat-price, walkway, class
// and tower-spec cases belong to other areas (econ3, hero3) or are covered by our own tests (towers, classes, pacify).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { BUILD } from '../src/version.js';
import { MATURITY, COMPACT, GARRISON } from '../src/content/stronghold.js';
import { LOGGING } from '../src/content/logging.js';
import { N } from '../src/sim/mapgen.js';

const clear = g => { const S = g.state; for (let k = 0; k < 20 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose((e.choices && e.choices[0] && e.choices[0].id) || 'ok'); } };
function placeNear(g, type, n = 1) {
  const S = g.state, c = S.map.town.x; let k = 0;
  for (let r = 3; r < 14 && k < n; r++) for (let y = c - r; y <= c + r && k < n; y++) for (let x = c - r; x <= c + r && k < n; x++) {
    const p = g.canPlace(type, x + 0.5, y + 0.5, 0); if (p.ok && g.build(type, p.x, p.y, 0)) k++;
  }
  return k;
}

test('the build tag names tonight\'s build', () => {
  assert.equal(BUILD.version, 'v56');
  assert.equal(typeof BUILD.time, 'string');
});

test('small and strong: the Camp waits for its day, not for building spam (Gemini case 5)', () => {
  const g = createGame({ seed: 23, clock: false }); const S = g.state; clear(g);
  S.gold = 500; S.food = 100;
  assert.equal(placeNear(g, 'house', 1), 1); assert.equal(placeNear(g, 'farm', 2), 2); assert.equal(placeNear(g, 'tower', 1), 1);
  S.night = 2;
  assert.ok(g.keepNeeds().some(t => /^day 3/.test(t)), g.keepNeeds().join(' · '));
  assert.equal(g.upgradeKeep(), false);
  S.night = MATURITY.need[1].minDay;
  assert.deepEqual(g.keepNeeds(), [], 'a home, two farms and a tower raise the Camp on day 3');
  assert.ok(g.upgradeKeep()); assert.equal(S.keep.level, 2);
  // level 3: not on day 5 whatever you have; on day 7 with two raised buildings, the people, the food and a win
  S.night = 5; S.stats.regionsClaimed = 1;
  assert.ok(g.keepNeeds().some(t => /^day 7/.test(t)));
  assert.equal(placeNear(g, 'house', 1), 1);
  for (const b of S.buildings.filter(b => b.type !== 'tower')) assert.ok(g.upgrade(b.id), `upgrade ${b.type}`);
  assert.ok(S.buildings.length <= COMPACT.max, 'still a compact Camp');
  S.night = MATURITY.need[2].minDay;
  assert.deepEqual(g.keepNeeds(), [], g.keepNeeds().join(' · '));
  assert.ok(g.upgradeKeep()); assert.equal(S.keep.level, 3);
});

test('a compact Camp hits harder and takes less; a raised Camp mans towers with its garrison', () => {
  const g = createGame({ seed: 31, clock: false }); const S = g.state; clear(g); S.gold = 500;
  placeNear(g, 'tower', 1); const tw = S.buildings.find(b => b.type === 'tower');
  for (let k = 0; k < 70; k++) g.step(1 / 60);   // (the compact count is read once a second)
  assert.ok(g.compact());
  const d0 = g.towerStats(tw).dmg;
  placeNear(g, 'house', COMPACT.max); for (let k = 0; k < 70; k++) g.step(1 / 60);
  assert.equal(g.compact(), false);
  assert.ok(Math.abs(d0 / g.towerStats(tw).dmg - COMPACT.towerDmg) < 1e-9, `${d0} vs ${g.towerStats(tw).dmg}`);
  const p1 = g.crewing().people; S.keep.level = 2; g.dropCrew && g.dropCrew();
  assert.equal(g.crewing().people - p1, GARRISON[1]);
});

test('trees are a job: by hand slow, the Logger\'s Hut quick, and it pays timber (Gemini case 6)', () => {
  const g = createGame({ seed: 29 }); const S = g.state; clear(g); S.gold = 100;
  const z = g.zone(); let cell = -1;
  for (let i = 0; i < z.length && cell < 0; i++) if (z[i] && S.map.terrain[i] === 1 && S.occ[i] < 0 && S.map.lm[i] < 0 && S.map.region[i] >= 0) cell = i;
  assert.ok(cell >= 0, 'a tree on the Camp\'s land');
  const tx = cell % N + 0.5, ty = Math.floor(cell / N) + 0.5;
  let r = g.rubbleAt(tx, ty);
  assert.ok(r.trees && !r.loggers && r.dur === LOGGING.hand && r.cost === 0);
  assert.ok(g.clearRubble(tx, ty) > 0 && S.chop && !S.chop.crew);
  S.hero.x = 5; S.hero.y = 5; S.hero.target = null; S.hero.path = null;   // the hero is away: the job waits
  const before = S.chop.done; g.step(0.5); assert.equal(S.chop.done, before);
  g.cancelChop();
  // the hut: one, from Camp 1, then the crew fells from anywhere
  assert.ok(placeNear(g, 'lumbermill', 1) === 1, 'built a Logger\'s Hut');
  const hut = S.buildings.find(b => b.type === 'lumbermill'); hut.built = 1;
  r = g.rubbleAt(tx, ty);
  assert.ok(r.loggers && r.dur === LOGGING.crew);
  const gold = S.gold; assert.ok(g.clearRubble(tx, ty) > 0);
  for (let k = 0; k < 60 * 2; k++) g.step(1 / 60);
  assert.equal(S.chop, null); assert.equal(S.map.terrain[cell], 0, 'felled'); assert.ok(S.gold >= gold + LOGGING.pay.crew);
});

test('the dead by day from day 1, and hollows you have to find (Gemini cases 1, 6)', () => {
  const g = createGame({ seed: 29 }); const S = g.state; clear(g);
  const A = g.actGoal();
  assert.ok(A && A.act === 1 && A.x === undefined && /Find/.test(A.text), JSON.stringify(A));
  // seen once: the System names it
  const h = S.map.regions.filter(r => r.ring === 1 && r.nest)[0], b = h.nest.body || h.nest;
  S.seen[Math.floor(b.y) * N + Math.floor(b.x)] = 1;
  assert.ok(g.actGoal().x !== undefined);
  // a day before night 5 sends stragglers out of the awake hollows
  const g2 = createGame({ seed: 7 }); const S2 = g2.state; clear(g2);
  S2.night = 3; S2.dayT = 20; S2.phase = 'day';
  for (const r of S2.map.regions) if (r.ring === 1 && r.nest) S2.wake[r.id] = 1;
  const n0 = S2.mobs.filter(m => m.stream !== undefined || (m.roam && m.roam.region >= 0 && S2.map.regions[m.roam.region].nest)).length;
  for (let k = 0; k < 60 * 60; k++) { S2.hero.hp = S2.hero.maxHp; S2.keep.hp = S2.keep.maxHp; S2.dayT = Math.min(S2.dayT, 100); g2.step(1 / 60); }
  const n1 = S2.mobs.filter(m => m.stream !== undefined || (m.roam && m.roam.region >= 0 && S2.map.regions[m.roam.region].nest)).length;
  assert.ok(n1 > n0 || S2.kills > 0, `day stragglers (${n0} → ${n1}, kills ${S2.kills})`);
});

test('a roamer you hit turns on you and keeps on you past its lose radius', () => {
  const g = createGame({ seed: 5 }); const S = g.state; clear(g);
  const m = S.mobs.find(q => q.roam && !q.hunt && q.kind === 'walker');
  assert.ok(m, 'a roaming walker');
  S.hero.x = m.x + 0.8; S.hero.y = m.y; S.hero.target = null;   // the hero swings at what is in reach
  for (let k = 0; k < 90 && !(m.commitUntil > S.time); k++) { S.hero.hp = S.hero.maxHp; g.step(1 / 60); }
  assert.ok(m.hunt && m.commitUntil > S.time, 'it hunts and has committed');
});
