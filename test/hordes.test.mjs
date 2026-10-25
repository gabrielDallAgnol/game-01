// [v2] Hordes: with v2 the night is hordes. They sleep at key places at least 45 m from the camp, wake round their spot
// at dusk, and one marches on the camp at the latest every third night from night 3, warned by day through the
// forecast's route. The same seed plays the same; without v2 there are no hordes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';

function run(seed, nights, v2 = true) {
  const g = createGame({ seed, area: 'suburb', v2, v2combat: true }), S = g.state, seen = { wake: 0, march: 0, warned: 0, nightDead: 0 };
  let steps = 0, wasNight = false;
  while (S.night <= nights && !S.over && steps < 20 * 60 * 80) {
    S.hero.hp = S.hero.maxHp;   // the hero stands still and lives: this test is about the night, not the fight
    while (S.story.encounters.length) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); }
    if (S.phase === 'day' && g.forecast().length) seen.warned = Math.max(seen.warned, S.night);
    g.step(); steps++;
    for (const e of S.events.splice(0)) { if (e.t === 'hordeWake') seen.wake++; if (e.t === 'hordeMarch') seen.march++; }
    if (S.phase === 'night' && !wasNight) seen.nightDead = Math.max(seen.nightDead, S.mobs.filter(m => m.horde !== undefined).length);
    wasNight = S.phase === 'night';
  }
  return { g, S, seen };
}

test('hordes sleep away from the camp, wake at night, and one marches by night 4, warned by day', () => {
  const { S, seen } = run(3, 4);
  assert.ok(S.hordes && S.hordes.spots.length >= 3, 'hordes placed');
  for (const h of S.hordes.spots) assert.ok(h.far >= 45, `${h.name} sits ${h.far.toFixed(0)} m from the camp`);
  assert.ok(seen.wake >= 3 && seen.nightDead > 0, 'hordes wake round their spots');
  assert.ok(seen.march >= 1, 'a horde marched on the camp');
  assert.ok(seen.warned >= 3, 'the march was shown by day');
});

test('hordes repeat per seed', () => {
  const a = run(11, 3), b = run(11, 3);
  assert.deepEqual(a.S.hordes.spots.map(h => [h.x, h.y, h.dead]), b.S.hordes.spots.map(h => [h.x, h.y, h.dead]));
  assert.deepEqual(a.S.hordes.plan, b.S.hordes.plan);
});

test('no hordes without v2', () => {
  const { S, seen } = run(3, 1, false);
  assert.equal(S.hordes, undefined); assert.equal(seen.wake + seen.march, 0);
});
