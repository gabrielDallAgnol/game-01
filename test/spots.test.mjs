// Every objective stands where the hero can go: inside the world with a margin from its edge, on walkable ground
// the camp can reach, out of water and cliffs, and never behind the quarantine fence. Many seeds, several nights,
// plus a stress of each picker every dawn (beacon/trial spots, supply drops, a district opened each dawn).
// Every seed walks its nights by the calendar (pickers stressed each dawn, the fence pulled back one district a
// night); every LIVE-th seed also plays its days and nights for real, so beacons, trials, quests and ambushes come
// from the story itself. SPOT_SEEDS / SPOT_NIGHTS / SPOT_LIVE override the defaults (40 seeds, 4 nights, every 8th).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { mapChoices, N, T, idx } from '../src/sim/mapgen.js';
import { spotOk, siteOk, reachableSpot, SPOT } from '../src/sim/spots.js';
import { chooseStory } from '../tools/bot.mjs';

const SEEDS = +(process.env.SPOT_SEEDS || 40), NIGHTS = +(process.env.SPOT_NIGHTS || 4), LIVE = +(process.env.SPOT_LIVE || 8), DT = 1 / 20;

/** the plain rules, written out again so the helper is checked too, not only trusted */
function plainOk(g, x, y) {
  const S = g.state, map = g.map, cx = Math.floor(x), cy = Math.floor(y);
  if (!(cx >= SPOT.edge && cy >= SPOT.edge && cx < N - SPOT.edge && cy < N - SPOT.edge)) return 'edge';
  const i = idx(cx, cy), t = map.terrain[i];
  if (t === T.WATER || t === T.FORD || t === T.CLIFF || t === T.ROCK || t === T.VOID) return `terrain ${t}`;
  if (!map.reach[i]) return 'unreachable';
  if (map.region[i] < 0 || S.sealed[map.region[i]]) return 'sealed';
  return null;
}

test(`objectives stay inside the playable world (${SEEDS} seeds × ${NIGHTS} nights)`, () => {
  const bad = new Set(), seen = {}, badKinds = {};
  for (let s = 0; s < SEEDS; s++) {
    const seed = 900 + s, ch = mapChoices(seed)[0];
    const g = createGame({ seed, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor' }), S = g.state, map = g.map;
    S.builders = 'balanced'; g.setAutopilot(true);
    const at = (kind, x, y) => {
      seen[kind] = (seen[kind] || 0) + 1;
      const why = plainOk(g, x, y) || (spotOk(map, S.sealed, x, y) ? null : 'spotOk');
      if (why) { const k = `seed ${seed} ${kind} (${x.toFixed(1)}, ${y.toFixed(1)}): ${why}`; if (!bad.has(k)) { bad.add(k); badKinds[kind] = (badKinds[kind] || 0) + 1; } }
    };
    const site = (kind, l) => { seen[kind] = (seen[kind] || 0) + 1; if (!siteOk(map, S.sealed, l)) { const k2 = `seed ${seed} ${kind} site ${l.id} (${l.x}, ${l.y}): no open ground beside it`; if (!bad.has(k2)) { bad.add(k2); badKinds[kind] = (badKinds[kind] || 0) + 1; } } };
    const sweep = () => {
      const ST = S.story;
      if (ST.trial && !ST.trial.done) at('trial', ST.trial.x, ST.trial.y);
      for (const sp of ST.spots) at(sp.thread ? 'thread' : 'beacon', sp.x, sp.y);
      for (const q of ST.quests) site('siteQuest', S.landmarks[q.site]);
      for (const d of S.drops) at('drop', d.x, d.y);
      for (const p of S.pickups) at('pickup', p.x, p.y);
      for (const st of S.road.stations) at('station', st.x, st.y);
      for (const a of S.road.ambushes) at('ambush', a.x, a.y);
      const k = ST.contract; if (k && k.finale && k.finale.kind === 'hive' && !k.won && !k.lost && !S.sealed[k.finale.region]) { const n = map.regions[k.finale.region].nest; seen.contractHive = (seen.contractHive || 0) + 1; if (!reachableSpot(map, S.sealed, n.x, n.y, null, 2)) { bad.add(`seed ${seed} contract hive ${k.finale.region}: no ground to stand on`); badKinds.contractHive = (badKinds.contractHive || 0) + 1; } }
    };
    const stress = () => {
      const f = g.frontier(); if (f.length) g.openDistrict(f[0], 'test');   // walk the fence back, one district a dawn
      for (let k = 0; k < 25; k++) { const p = g.findSpot(); if (p) at('findSpot', p.x, p.y); }
      for (let k = 0; k < 2; k++) g.dropSupply('test');
    };
    stress(); sweep();
    if (s % LIVE) {   // the calendar: each dawn, the pickers run against a world one district wider
      for (let n = 2; n <= NIGHTS; n++) { S.night = n; S.mobs.length = 0; stress(); sweep(); }
      continue;
    }
    let night = S.night, steps = 0;
    while (!S.over && S.night <= NIGHTS && steps < 60 * 60 * 30) {
      while (S.pendingPicks > 0 && S.offer.length) g.choosePerk(S.offer[0]);
      if (S.story.encounters.length) chooseStory(g);
      g.step(DT); steps++; S.events.length = 0;
      if (steps % 120 === 0) sweep();
      if (S.night !== night) { night = S.night; stress(); sweep(); }
    }
  }
  assert.deepEqual([...bad].slice(0, 12), [], `${bad.size} objectives out of bounds ${JSON.stringify(badKinds)} · checked ${JSON.stringify(seen)}`);
  for (const k of ['findSpot', 'drop', 'station', 'pickup']) assert.ok(seen[k] > 0, `never saw a ${k}: ${JSON.stringify(seen)}`);
});

test('spotOk refuses the edge, water, cliffs, the void and the sealed core', () => {
  const ch = mapChoices(5)[0], g = createGame({ seed: 5, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor' }), S = g.state, map = g.map;
  assert.equal(spotOk(map, S.sealed, 2.5, 2.5), false);
  assert.equal(spotOk(map, S.sealed, NaN, 10), false);
  const first = pred => { for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0; if (x > SPOT.edge && y > SPOT.edge && x < N - SPOT.edge && y < N - SPOT.edge && pred(i)) return [x + 0.5, y + 0.5]; } return null; };
  for (const t of [T.WATER, T.FORD, T.CLIFF, T.VOID]) { const p = first(i => map.terrain[i] === t); if (p) assert.equal(spotOk(map, S.sealed, ...p), false, `terrain ${t} accepted`); }
  const core = first(i => map.region[i] >= 0 && S.sealed[map.region[i]] && map.reach[i] && map.terrain[i] === T.GRASS);
  if (core) { assert.equal(spotOk(map, S.sealed, ...core), false, 'the sealed core accepted'); assert.equal(spotOk(map, null, ...core), false, 'the core accepted before the run'); }
  const nearVoid = first(i => map.reach[i] && map.terrain[i] === T.GRASS && map.terrain[i + 1] === T.VOID);
  if (nearVoid) assert.equal(spotOk(map, S.sealed, ...nearVoid), false, 'a spot on the void edge accepted');
  const camp = reachableSpot(map, S.sealed, map.town.x + 20, map.town.y + 20);
  assert.ok(!camp || spotOk(map, S.sealed, camp.x, camp.y));
});

test('an old save with a beacon off the map: it moves onto good ground when the run loads', () => {
  const ch = mapChoices(7)[0], g = createGame({ seed: 7, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor' });
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  const map = g.map, edge = (() => { for (let i = 0; i < N * N; i++) if (map.reach[i] && map.terrain[i] === T.GRASS && map.terrain[i + 1] === T.VOID) return { x: (i % N) + 0.5, y: ((i / N) | 0) + 0.5 }; return { x: 3.5, y: 3.5 }; })();
  snap.story.spots = [{ id: 990, kind: 'gen990', x: edge.x, y: edge.y, day: 1 }, { id: 991, kind: 'gen991', x: 1.5, y: 1.5, day: 1 }];
  snap.pickups = [{ id: 992, x: 1.5, y: 1.5, kind: 'scrap' }];
  const h = createGame({ seed: 7, mapSeed: ch.seed, biome: ch.biome, hero: 'survivor', restore: snap }), S = h.state;
  assert.ok(S.story.spots.length >= 1, 'the beacon on the void edge was dropped instead of moved');
  for (const sp of S.story.spots) assert.ok(spotOk(h.map, S.sealed, sp.x, sp.y), `beacon ${sp.id} still at (${sp.x}, ${sp.y})`);
  assert.ok(Math.hypot(S.story.spots[0].x - edge.x, S.story.spots[0].y - edge.y) <= 9, 'the beacon slid too far');
  assert.ok(!S.pickups.some(p => p.id === 992), 'a find off the map survived the load');
});
