// The dead stand on the world, never in the void: every spawn (the night's queue from nests and hordes, roamers)
// lands on open ground the camp can reach, and no dead wanders off it.
// MOB_SEEDS / MOB_NIGHTS override the defaults.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { MOBS } from '../src/content/mobs.js';
import { groundOk } from '../src/sim/steer.js';

const SEEDS = +(process.env.MOB_SEEDS || 5), NIGHTS = +(process.env.MOB_NIGHTS || 7), DT = 1 / 20;
const tidy = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } while (S.packs.length) g.choosePack(S.packs[0]); };
const onWorld = (g, m) => groundOk(g.map, m.x, m.y) || g.inZone(m.x, m.y);   // your own land counts (cleared rubble)

test(`every dead spawns and stays on reachable ground (${SEEDS} seeds × ${NIGHTS} nights, played on autopilot)`, () => {
  const bad = [];
  for (let s = 0; s < SEEDS; s++) {
    const g = createGame({ seed: 40 + s, hero: s % 2 ? 'archer' : 'warrior' }), S = g.state; S.autopilot = true;
    let t = 0;
    while (S.night <= NIGHTS && !S.over && t < NIGHTS * 260) {
      tidy(g);
      g.step(DT); t += DT;
      for (const e of S.events.splice(0)) if (e.t === 'spawn') { const m = S.mobs.find(q => q.id === e.id); if (m && !onWorld(g, m)) bad.push(`seed ${40 + s} n${S.night} spawn ${m.kind} at ${m.x.toFixed(1)},${m.y.toFixed(1)}`); }
      if (Math.abs(t - Math.round(t)) < DT / 2) for (const m of S.mobs) if (!MOBS[m.kind].animal && !onWorld(g, m)) bad.push(`seed ${40 + s} n${S.night} ${m.kind} stands at ${m.x.toFixed(1)},${m.y.toFixed(1)}`);
    }
  }
  assert.deepEqual([...new Set(bad)].slice(0, 12), []);
});

test('every spawn source lands on reachable ground, the night\'s and the hordes\' (stress)', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = createGame({ seed }), S = g.state, map = g.map;
    const nests = map.regions.filter(r => r.nest).map(r => r.id).concat(S.edgeSpawns.map((_, k) => -1 - k));
    S.night = 12;
    for (const r of nests) for (let k = 0; k < 40; k++) {
      const before = S.mobs.length;
      // spawning is internal: drive it through the night's queue, one dead from this source
      S.phase = 'night'; S.qT = 1; S.queue = [{ kind: k % 3 ? 'walker' : 'runner', nest: r, t: 0 }];
      g.step(DT); S.phase = 'day';
      const spawned = S.mobs.slice(before);
      for (const q of spawned) assert.ok(groundOk(map, q.x, q.y), `seed ${seed}: source ${r} spawned a ${q.kind} at ${q.x.toFixed(1)},${q.y.toFixed(1)} off the camp's ground`);
      S.mobs.length = before;
    }
    // the roamers: let a night pass (they rise at dawn)
    S.mobs.length = 0; S.queue = []; tidy(g); S.phase = 'day'; S.dayT = 0; g.startNight(); S.queue = []; S.qT = g.nightLen();
    for (let k = 0; k < 40 && S.phase === 'night'; k++) g.step(DT);
    assert.equal(S.phase, 'day', `seed ${seed}: no dawn`);
    for (const m of S.mobs) if (!MOBS[m.kind].animal) assert.ok(groundOk(map, m.x, m.y), `seed ${seed}: a roamer at ${m.x.toFixed(1)},${m.y.toFixed(1)} off the camp's ground`);
  }
});

