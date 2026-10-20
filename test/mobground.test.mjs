// The dead stand on the world, never in the void: every spawn (night waves, deep-woods edge packs, hive guards,
// roamers, stragglers) lands on open ground the camp can reach, and no dead wanders off it. Around a hive no crowd
// freezes: the dead march, hunt, or go back inside. And a hive is struck only in clear sight of its open face.
// MOB_SEEDS / MOB_NIGHTS override the defaults.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { MOBS } from '../src/content/mobs.js';
import { N, T, idx, inside } from '../src/sim/mapgen.js';
import { spotOk } from '../src/sim/spots.js';
import { groundOk } from '../src/sim/steer.js';

const SEEDS = +(process.env.MOB_SEEDS || 5), NIGHTS = +(process.env.MOB_NIGHTS || 7), DT = 1 / 20;
const tidy = g => { const S = g.state; for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); } while (S.pendingPicks) g.choosePerk(S.offer[0]); while (S.packs.length) g.choosePack(S.packs[0]); };
const onWorld = (g, m) => groundOk(g.map, m.x, m.y) || g.inZone(m.x, m.y);   // your own land counts (cleared rubble)

test('the deep woods\' edge packs come out of open woods, clear of the void', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = createGame({ seed }), e = g.state.edgeSpawns;
    assert.ok(e.length >= 6, `seed ${seed}: only ${e.length} edge sources`);
    for (const p of e) assert.ok(spotOk(g.map, false, p.x, p.y), `seed ${seed}: an edge source at ${p.x.toFixed(1)},${p.y.toFixed(1)} sits by the void or off the camp's ground`);
  }
});

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

test('every spawn source lands on reachable ground, the night\'s and the hives\' (stress)', () => {
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
    // the roamers of every district, the city's walled blocks too: open them all and let a night pass (they rise at dawn)
    for (const r of map.regions) S.sealed[r.id] = 0; S.sealVersion++;
    S.mobs.length = 0; S.queue = []; tidy(g); S.phase = 'day'; S.dayT = 0; g.startNight(); S.queue = []; S.qT = g.nightLen();
    for (let k = 0; k < 40 && S.phase === 'night'; k++) g.step(DT);
    assert.equal(S.phase, 'day', `seed ${seed}: no dawn`);
    for (const m of S.mobs) if (!MOBS[m.kind].animal) assert.ok(groundOk(map, m.x, m.y), `seed ${seed}: a roamer at ${m.x.toFixed(1)},${m.y.toFixed(1)} off the camp's ground`);
  }
});

test('no crowd freezes at a hive: the dead march, hunt, or go back inside', () => {
  const frozen = [];
  for (const seed of [3, 7, 11]) {
    const g = createGame({ seed, hero: 'archer' }), S = g.state, map = g.map; tidy(g);
    // late game: the city's hives are awake and the streets are full
    S.night = 14; for (const r of map.regions) if (r.nest) { S.wake[r.id] = 1; S.sealed[r.id] = 0; }
    S.sealVersion++; g.state.flowDirty = true;
    const hives = map.regions.filter(r => r.nest && r.ring >= 2);
    const h = S.hero; h.hp = h.maxHp = 1e6;
    S.dayT = 0; g.startNight(); tidy(g);
    const hist = new Map(); let t = 0, k = 0;
    while (S.phase === 'night' && t < 70) {
      // the hero calls on each hive in turn (wakes its guards and rage), then walks off and leaves them
      const hv = hives[Math.floor(t / 14) % hives.length], near = t % 14 < 6;
      if (near) { h.x = hv.nest.x + 5; h.y = hv.nest.y; h.target = null; } else if (k++ % 40 === 0) g.heroTo(map.town.x, map.town.y + 4);
      tidy(g); g.step(DT); t += DT;
      if (Math.abs(t - Math.round(t)) >= DT / 2) continue;
      const T = Math.round(t);
      for (const m of S.mobs) { let a = hist.get(m.id); if (!a) hist.set(m.id, a = []); a.push([T, m.x, m.y, m.attacking]); if (a.length > 21) a.shift(); }
      for (const r of hives) {
        const still = S.mobs.filter(m => {
          const a = hist.get(m.id); if (!a || a.length < 21 || a.some(q => q[3]) || Math.hypot(m.x - r.nest.x, m.y - r.nest.y) > 8) return false;
          let path = 0; for (let q = 1; q < a.length; q++) path += Math.hypot(a[q][1] - a[q - 1][1], a[q][2] - a[q - 1][2]);
          return path < 1;
        });
        if (still.length >= 3) frozen.push(`seed ${seed} t${T}: ${still.length} dead stand still at hive ${r.id} (${still.slice(0, 4).map(m => `${m.kind}${m.roam ? ' roam' : ''}${m.guard !== undefined ? ' guard' : ''}${m.hunt ? ' hunt' : ''}`).join(', ')})`);
      }
    }
  }
  assert.deepEqual(frozen.slice(0, 8), []);
});

/** a city hive whose block has open ground behind it within the hero's reach of the hive's edge */
function throughBlock(g, reach) {
  const map = g.map;
  for (const r of map.regions.filter(q => q.nest && q.nest.back)) {
    const n = r.nest, [bx, by] = n.back;
    // walk from the door into the block and out the other side: the first open cell past the rock
    let k = 1, seenRock = false;
    for (; k < 12; k++) { const x = Math.floor(n.x + bx * k), y = Math.floor(n.y + by * k); if (!inside(x, y)) break; const t = map.terrain[idx(x, y)]; if (t === T.ROCK) seenRock = true; else if (seenRock && t !== T.CLIFF && t !== T.VOID && t !== T.WATER) break; }
    if (!seenRock || k >= 12) continue;
    const far = { x: n.x + bx * (k + 0.2), y: n.y + by * (k + 0.2) };
    if (g.hiveEdge(r.id, far.x, far.y) < reach - 0.1) return { r, far, open: { x: n.x - bx * 1.5, y: n.y - by * 1.5 } };
  }
  return null;
}

test('a hive is struck only in clear sight of its open face, never through a building', () => {
  let tried = 0;
  for (let seed = 1; seed <= 40 && tried < 4; seed++) {
    const g = createGame({ seed, hero: 'archer' }), S = g.state; tidy(g);
    for (const reg of g.map.regions) if (reg.nest) S.sealed[reg.id] = 0;
    const reach = g.heroDef.attack.reach + S.P.heroRange, hit = throughBlock(g, reach); if (!hit) continue;
    tried++;
    const h = S.hero; h.hp = h.maxHp = 1e6; S.keep.level = 3;   // a city hive needs a strong keep before it can be struck at all
    assert.equal(g.hiveInReach(hit.far.x, hit.far.y, reach), -1, `seed ${seed}: hive ${hit.r.id} counts as in reach through its block`);
    assert.equal(g.hiveInReach(hit.open.x, hit.open.y, reach), hit.r.id, `seed ${seed}: hive ${hit.r.id} not in reach at its door`);
    const at = p => { S.mobs.length = 0; h.x = p.x; h.y = p.y; h.target = null; h.path = null; h.cd = 0; S.events.length = 0; g.step(); return S.events.some(e => e.t === 'hitHive' && e.region === hit.r.id); };
    assert.ok(!at(hit.far), `seed ${seed}: struck hive ${hit.r.id} through its block from ${hit.far.x.toFixed(1)},${hit.far.y.toFixed(1)}`);
    assert.ok(at(hit.open), `seed ${seed}: could not strike hive ${hit.r.id} from its open face`);
  }
  assert.ok(tried >= 2, `only ${tried} hives with open ground behind their block within reach`);
});
