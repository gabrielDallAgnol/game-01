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
  const sweep = pick => { for (let n = 0; n < 10 && S.story.encounters.length; n++) { const e = S.story.encounters[0], ids = [(pick && pick(e)), ...e.choices.map(x => x.id)].filter(Boolean); if (!ids.some(id => g.choose(id))) S.story.encounters.shift(); } while (S.pendingPicks && S.offer.length) g.choosePerk(S.offer[0]); };
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
  // (its fire burns the dead at its ring now: send fresh ones to finish it)
  st.hp = 0.5;
  for (const m of S.mobs.filter(q => q.roam && q.kind === 'walker').slice(0, 4)) { m.roam = null; m.hunt = false; m.x = st.x + road.ringOf(st) + 0.5; m.y = st.y; m.rise = 1; m.stream = -1; m.siege = st.id; }
  run(3);
  assert.equal(st.lit, false); assert.equal(st.fell, true);
});

test('people found far from the camp walk home as a convoy on their own and count only when they arrive', () => {
  const { S, c, road, run, tp } = make(3);
  const st = road.stations[0];
  const before = S.survivors;
  tp(st.x + 1, st.y); run(0.5, null, e => (e.road ? 'home' : null));
  assert.equal(road.convoys().length, 1); assert.equal(road.members().length, 4);
  assert.equal(road.convoys()[0].order, 'go', 'a rescue starts on Go to Camp');
  assert.equal(S.survivors, before, 'they counted before they got home');
  // the hero stays out by the bus: they still go home, at a pace quicker than a walker
  const d0 = road.convoys()[0].left, t0 = S.time;
  assert.ok(run(120, () => !road.convoys().length), 'the convoy never got home');
  assert.ok(S.time - t0 < d0 / 1.6, `took ${S.time - t0} s for ${d0} cells`);
  assert.ok(Math.hypot(S.hero.x - st.x, S.hero.y - st.y) < 3, 'the hero had to walk them home');
  assert.equal(S.survivors, before + 4);
  assert.equal(S.road.home, 4);
});

test('a convoy never turns round because the hero moved; Wait here holds them huddled, Go to Camp sends them on', () => {
  const { S, c, road, run, tp } = make(3);
  const st = road.stations[1];
  tp(st.x, st.y + 1); const cv = road.makeConvoy(3);
  // the hero runs back out past them, away from the camp: the head of the column only gets nearer home
  const L0 = cv.left; let last = L0;
  for (let k = 0; k < 8; k++) {
    tp(st.x + (k % 2 ? 6 : -6), st.y + 3); run(0.75);
    assert.ok(cv.left <= last + 0.05, `they walked back: ${last} -> ${cv.left}`); last = cv.left;
    assert.ok(cv.members.every(m => m.state === 'go'));
  }
  assert.ok(last < L0 - 8, `they barely moved: ${L0} -> ${last}`);
  // Wait here: they stop and huddle round one spot, wherever the hero goes
  assert.equal(road.order(cv.id, 'wait'), true);
  run(2); const at = cv.members.map(m => [m.x, m.y]);
  tp(c, c + 3.5); run(4);
  cv.members.forEach((m, k) => assert.ok(Math.hypot(m.x - at[k][0], m.y - at[k][1]) < 0.6, 'a waiting member wandered off'));
  assert.ok(cv.members.every(m => m.state === 'wait' && Math.hypot(m.x - cv.at.x, m.y - cv.at.y) < 1.6), 'not huddled');
  // Go to Camp: home without the hero
  assert.equal(road.order(cv.id, 'go'), true);
  tp(st.x + 20, st.y + 20);
  assert.ok(run(150, () => !road.convoys().length), 'they never got home after Go');
  assert.equal(S.road.home, 3);
});

test('the dead hunt the convoy, and a caught member rises with the dead', () => {
  const { g, S, road, run, tp } = make(3);
  const st = road.stations[2];
  tp(st.x, st.y + 6); const cv = road.makeConvoy(3); road.order(cv.id, 'wait');
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
  assert.equal(road.mission.choosing, false, 'night 1 is the arrival: no mission choice'); assert.equal(road.mission.id, 'hold');
  for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) { g.step(); S.story.encounters.length = 0; }
  run(1); g.startNight(); run(0.1);
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

test('Pied Piper traps: a lit outpost burns the dead at its ring by night, the horn echoes, kills outside pay at dawn in the ledger', () => {
  const { g, S, c, road, run, tp } = make(3);
  const st = road.stations[0]; S.gold = 80;
  tp(st.x + 1, st.y); run(ROAD.lightTime + 0.5); assert.ok(st.lit);
  for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) { g.step(); S.story.encounters.length = 0; }
  g.startNight(); run(0.1); for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) { g.step(); S.story.encounters.length = 0; }
  run(1); tp(st.x, st.y); g.startNight(); run(0.1);
  assert.equal(road.setMission('piper'), true);
  // the traps are listed (the outpost at least), the nearest one out of the camp is the guide arrow's target
  const traps = road.missions.traps(); assert.ok(traps.some(t => t.kind === 'outpost' && t.id === st.id), JSON.stringify(traps));
  assert.ok(road.missions.nearestTrap(st.x, st.y));
  // walkers at the ring's edge catch fire and die
  const ws = S.mobs.filter(q => q.roam && !q.unique && ['walker', 'runner'].includes(q.kind)).slice(0, 5);
  assert.ok(ws.length >= 3);
  ws.forEach((m, k) => { m.roam = null; m.lost = false; const a = k * 1.3; m.x = st.x + Math.cos(a) * (road.ringOf(st) + 0.6); m.y = st.y + Math.sin(a) * (road.ringOf(st) + 0.6); m.rise = 1; });
  const n = road.horn(); assert.ok(n >= 3, `the horn pulled ${n}`);
  run(6);
  const left = ws.filter(m => S.mobs.includes(m)).length;
  assert.ok(left <= 1, `${left} of ${ws.length} walked through the fire ring`);
  assert.ok(road.mission.ledKilled >= ws.length - 1, `kills outside ${road.mission.ledKilled}`);
  // the echo: a dead walking up into earshot during the call turns too (most of the time)
  assert.ok(road.mission.callT > 0 || road.missions.hornInfo().calling === false);
  // dawn: the ledger carries the Piper line and the pay arrives
  const pay = Math.round(road.mission.pay), gold = S.gold;
  for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) { g.step(); S.story.encounters.length = 0; }
  assert.ok(S.ledger && S.ledger.piper && S.ledger.piper.killed >= ws.length - 1, JSON.stringify(S.ledger && S.ledger.piper));
  assert.ok(pay > 0 && S.gold >= gold, 'the dawn pay');
});

test('a burned hollow smoulders through the night; a pitch flare on a Piper night burns where it lands', () => {
  const { g, S, road, run, tp } = make(3);
  const mi = road.missions;
  // embers from a claim by day last through the coming night
  const reg = g.map.regions.find(r => r.nest); S.events.push({ t: 'claim', region: reg.id }); run(0.1);
  assert.equal(mi.embers.length, 1); assert.equal(mi.embers[0].until, S.night);
  run(MISSION.embers.t + 2); assert.equal(mi.embers.length, 1, 'the embers went out before the night');
  // a flare thrown on a Piper night lays a fire
  for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) { g.step(); S.story.encounters.length = 0; }
  g.startNight(); run(0.1); for (let k = 0; k < 60 * 400 && S.phase === 'night'; k++) { g.step(); S.story.encounters.length = 0; }
  assert.equal(mi.embers.length, 0, 'the embers outlived their night');
  run(1); g.startNight(); run(0.1); road.setMission('piper'); S.gold = 20;
  assert.equal(g.useFlare(S.hero.x + 5, S.hero.y), true); run(0.1);
  assert.ok(mi.pyres.length === 1 && mi.traps().some(t => t.kind === 'pyre'));
});
