// The road and the night missions: stations, outposts, convoys, ambushes, trip planning, missions. Fast and headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { mapChoices, idx, PASSABLE } from '../src/sim/mapgen.js';
import { STATIONS, ROAD, MISSION } from '../src/content/road.js';

function make(seed = 3) {
  const ch = mapChoices(seed)[0];
  const g = createGame({ seed, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor' });
  const S = g.state;
  const sweep = pick => { while (S.story.encounters.length) { const e = S.story.encounters[0]; g.choose((pick && pick(e)) || e.choices[0].id); } while (S.pendingPicks && S.offer.length) g.choosePerk(S.offer[0]); };
  const run = (sec, until, pick) => { for (let i = 0; i < sec * 60; i++) { if (until && until()) return true; g.step(); sweep(pick); if (S.over) return false; } return false; };
  const tp = (x, y) => { S.hero.x = x; S.hero.y = y; S.hero.target = null; S.hero.path = null; };
  return { g, S, c: g.map.town.x, road: g.road, run, tp, sweep };
}

test('four stations stand along the road, in order, in reachable glades, the same for the same map', () => {
  for (const seed of [1, 3, 5, 8]) {
    const { g, c, road } = make(seed);
    assert.equal(road.stations.length, STATIONS.length, `seed ${seed}`);
    let prev = 0;
    for (const st of road.stations) {
      const d = Math.hypot(st.x - c, st.y - c);
      assert.ok(d > prev && d > 35 && d < 145, `seed ${seed} ${st.id} at ${d}`);
      prev = d;
      const i = idx(Math.floor(st.x), Math.floor(st.y));
      assert.ok(PASSABLE[g.map.terrain[i]] && g.map.reach[i], `${st.id} not walkable`);
    }
    const again = make(seed).road.stations.map(s => [s.x, s.y]);
    assert.deepEqual(road.stations.map(s => [s.x, s.y]), again);
  }
});

test('standing by the fire for 3 s lights an outpost: it costs scrap, rests the hero, keeps small dead out and takes two towers', () => {
  const { g, S, road, run, tp } = make(3);
  const st = road.stations[0]; S.gold = 60;
  tp(st.x + 1, st.y); run(ROAD.lightTime + 0.5);
  assert.equal(st.lit, true); assert.ok(S.gold <= 60 - ROAD.lightCost);
  S.hero.hp = 5; run(1); assert.ok(S.hero.hp > 8, 'no rest by the fire');
  assert.equal(road.buildTower(st.id), true); assert.equal(road.buildTower(st.id), true); assert.equal(road.buildTower(st.id), false);
  assert.equal(st.towers.length, 2);
  assert.equal(g.canPlace('house', st.x + 3, st.y + 3).ok, false, 'houses must not creep down the road');
});

test('the dead keep out of a lit ring, gnaw at the fire by night, and the fire can go out', () => {
  const { g, S, road, run, tp } = make(3);
  const st = road.stations[1]; S.gold = 60;
  tp(st.x + 1, st.y); run(ROAD.lightTime + 0.5); assert.ok(st.lit);
  tp(g.map.town.x, g.map.town.y + 3.5);
  g.startNight(); run(0.1);
  const before = st.hp;
  // a pack of the night's dead marching past the fire
  const pack = S.mobs.filter(q => q.roam && q.kind === 'walker').slice(0, 8);
  assert.ok(pack.length >= 4);
  for (const m of pack) { m.roam = null; m.hunt = false; m.x = st.x + 7; m.y = st.y + 0.5; m.rise = 1; m.stream = -1; m.siege = undefined; }
  run(12);
  assert.ok(st.hp < before || !st.lit, 'nobody gnawed the fire');
  for (const m of S.mobs) if (m.siege && m.rise >= 1) assert.ok(Math.hypot(m.x - st.x, m.y - st.y) >= road.ringOf(st) - 0.6, 'a walker inside the lit ring');
  st.hp = 0.5; run(3);
  assert.equal(st.lit, false); assert.equal(st.fell, true);
});

test('people found far from the camp walk home as a convoy and count only when they arrive', () => {
  const { S, c, road, run, tp } = make(3);
  const st = road.stations[0];
  const before = S.survivors;
  tp(st.x + 1, st.y); run(0.5, null, e => (e.road ? 'home' : null));
  assert.equal(road.convoys().length, 1); assert.equal(road.members().length, 4);
  assert.equal(S.survivors, before, 'they counted before they got home');
  road.go(c, c + 3.5);
  assert.ok(run(120, () => !road.convoys().length), 'the convoy never got home');
  assert.equal(S.survivors, before + 4);
  assert.equal(S.road.home, 4);
});

test('the dead hunt the convoy, and a caught member rises with the dead', () => {
  const { g, S, road, run, tp } = make(3);
  const st = road.stations[2];
  tp(st.x, st.y + 6); road.makeConvoy(3);
  const spawnAt = road.members()[2];
  const before = S.mobs.length;
  S.hero.dead = true; S.hero.respawn = 60;
  // put some city dead on them
  const dead = S.mobs.filter(q => !g.road.members().includes(q) && q.kind === 'walker').slice(0, 4);
  for (const q of dead) { q.roam = null; q.x = spawnAt.x + 1; q.y = spawnAt.y; q.rise = 1; q.stream = -1; }
  assert.ok(dead.length >= 2, 'not enough walkers on the map to test with');
  run(30, () => road.members().length < 3);
  assert.ok(road.members().length < 3, 'nobody was caught');
  assert.ok(S.mobs.some(q => q.kind === 'risen'), 'the caught did not rise');
  assert.ok(S.mobs.length >= before - dead.length, 'mob bookkeeping');
});

test('trip planning: the road is quicker than the woods, and Go walks the planned path', () => {
  const { S, road, run } = make(3);
  const st = road.stations[1];
  const t = road.tripInfo(st.x, st.y);
  assert.ok(t.reached && t.secs > 5 && t.round > t.secs, JSON.stringify(t.label));
  assert.match(t.label, /^round trip \d+:\d\d · dusk in \d+:\d\d$/);
  assert.equal(road.go(st.x, st.y), true);
  const t0 = S.time; run(t.secs * 1.5 + 5, () => Math.hypot(S.hero.x - st.x, S.hero.y - st.y) < 1.5);
  assert.ok(Math.hypot(S.hero.x - st.x, S.hero.y - st.y) < 2, 'did not arrive');
  assert.ok(S.time - t0 < t.secs * 1.35 + 2, `took ${S.time - t0} s for a ${t.secs} s plan`);
});

test('an ambush waits on the road home after 40 s out, with a warning, and springs when you come near', () => {
  const { S, road, run, tp, g } = make(3);
  g.setAutopilot(true); S.builders = 'balanced'; run(400, () => S.night >= 3 && S.phase === 'day'); g.setAutopilot(false);
  const st = road.stations[3]; tp(st.x, st.y + 2);
  S.road.outT = 45; S.road.ambushCd = 0;
  road.go(g.map.town.x, g.map.town.y + 3.5);
  run(3, () => S.road.ambushes.length > 0);
  assert.equal(S.road.ambushes.length, 1, 'no ambush');
  assert.ok(S.events.some(e => e.t === 'toast' && e.msg.startsWith('[Movement on the road ahead]')), 'no warning');
  const a = S.road.ambushes[0];
  assert.ok(Math.hypot(a.x - S.hero.x, a.y - S.hero.y) > 12, 'the ambush spawned on top of you');
  assert.ok(run(60, () => S.events.some(e => e.t === 'ambushSprung')), 'the ambush never sprang');
});

test('missions: dusk offers a choice, Hold is chosen quietly after 6 s, Hunt halves hive health, the horn pulls the dead', () => {
  const { g, S, road, run } = make(3);
  g.startNight(); run(0.1);
  assert.equal(road.mission.choosing, true);
  assert.ok(['likely', 'risky', 'no'].includes(road.mission.forecast.word));
  run(MISSION.pick + 0.5);
  assert.equal(road.mission.choosing, false); assert.equal(road.mission.id, 'hold');
  assert.equal(S.events.filter(e => e.t === 'toast' && /^\[Mission/.test(e.msg)).length, 0, 'auto Hold should be quiet');
  // the Hunt: hives at 40%, the lantern
  assert.equal(road.setMission('hunt'), true);
  const r = g.map.regions.find(q => q.nest && S.wake[q.id] <= S.night);
  assert.ok(road.hiveMult(r.id) >= 1 / MISSION.hunt.hiveK - 1e-9);
  const sp = S.P.heroSpeed; road.setLantern(false); assert.ok(S.P.heroSpeed < sp); road.setLantern(true); assert.ok(Math.abs(S.P.heroSpeed - sp) < 1e-9);
  // the Pied Piper: dead in earshot turn on you
  road.setMission('piper');
  const ws = S.mobs.filter(q => q.roam && q.kind === 'walker').slice(0, 6);
  for (const m of ws) { m.roam = null; m.x = S.hero.x + 10; m.y = S.hero.y; m.rise = 1; }
  const n = road.horn();
  assert.ok(n >= 3, `the horn pulled ${n}`);
  assert.ok(S.mobs.filter(m => m.piped).length === n);
});

test('a run with the road saves and restores its stations', () => {
  const { g, S, road, run, tp } = make(3);
  const st = road.stations[0]; S.gold = 40; tp(st.x + 1, st.y); run(4); assert.ok(st.lit);
  tp(g.map.town.x, g.map.town.y + 3.5);
  const snap = g.snapshot(); assert.ok(snap && snap.road);
  const ch = mapChoices(3)[0];
  const g2 = createGame({ seed: 3, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor', restore: JSON.parse(JSON.stringify(snap)) });
  assert.equal(g2.road.stations[0].lit, true);
  assert.equal(g2.road.stations[0].met, true);
});
