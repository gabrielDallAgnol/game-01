// [gemini3] What was ported from Gemini's fork (Oct 24): the build tag, small and strong (maturity, compact,
// garrison) and committed hunters (logging, the dead by day and the hollows went with the frontier map).
// Adapted from Gemini's test/phase1_2.test.mjs (cases 1, 5, 6); its construction-queue, flat-price, walkway, class
// and tower-spec cases belong to other areas (econ3, hero3) or are covered by our own tests (towers, classes, pacify).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { BUILD } from '../src/version.js';
import { MATURITY, COMPACT, GARRISON } from '../src/content/stronghold.js';
// [econ3] these cases predate the construction queue: buildings stand at once here
import { ECON } from '../src/content/econ.js';
Object.assign(ECON, { queue: false });

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

test('a roamer you hit turns on you and keeps on you past its lose radius', () => {
  const g = createGame({ seed: 5 }); const S = g.state; clear(g);
  const m = S.mobs.find(q => q.roam && !q.hunt && q.kind === 'walker');
  assert.ok(m, 'a roaming walker');
  S.hero.x = m.x + 0.8; S.hero.y = m.y; S.hero.target = null;   // the hero swings at what is in reach
  for (let k = 0; k < 90 && !(m.commitUntil > S.time); k++) { S.hero.hp = S.hero.maxHp; g.step(1 / 60); }
  assert.ok(m.hunt && m.commitUntil > S.time, 'it hunts and has committed');
});
