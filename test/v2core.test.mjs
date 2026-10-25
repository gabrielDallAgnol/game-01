// [v2] The V2 core (?v2=1): with the flag a run plays three nights with none of the old systems: no waves or day
// stragglers from nests, no guard packs, sieges or eruptions, no blessing or relic offers, no stat points, no Rig or
// road; level-ups still pay XP; night still falls; the same seed plays the same; the save keeps the flag. Without the
// flag a short run is the same as one made before the flag existed (the golden runs cover the rest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGame } from '../src/sim/game.js';
import { heroTick } from '../tools/bot.mjs';

// a stable hash of any value (typed arrays, Maps, Sets, cycles; functions skipped), like tools/golden.mjs
function feed(h, v, stack) {
  if (v === null) return h.update('n');
  if (typeof v !== 'object') return h.update(typeof v === 'function' ? 'f' : typeof v + ':' + String(v));
  if (stack.includes(v)) return h.update('@');
  if (ArrayBuffer.isView(v)) return h.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
  stack.push(v);
  if (v instanceof Map) for (const [k, x] of [...v.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) { h.update(String(k)); feed(h, x, stack); }
  else if (v instanceof Set) h.update([...v].map(String).sort().join(','));
  else for (const k of Array.isArray(v) ? v.keys() : Object.keys(v).sort()) { h.update(String(k)); feed(h, v[k], stack); }
  stack.pop();
}
const hashOf = v => { const h = createHash('sha256'); feed(h, v, []); return h.digest('hex').slice(0, 16); };

const OLD_EVENTS = ['firstDead', 'nestGuard', 'nestRage', 'eruptWarn', 'erupt', 'horde', 'hitHive', 'hiveAwake', 'statPoints', 'statUnlock', 'statTitle', 'relic', 'rigUp', 'rigRoad', 'rigMigrate', 'actOpen', 'contract', 'missionOffer', 'convoy', 'cart', 'haul', 'blackout', 'window', 'district'];

function run(seed, opts, nights = 3) {
  const g = createGame({ seed, area: 'suburb', v2combat: true, ...opts }), S = g.state, evs = [];
  let steps = 0, queued = 0, nightsSeen = 0, sneaky = 0, xpGiven = false, wasNight = false;
  while (S.night <= nights && !S.over && steps < 20 * 60 * 40) {
    if (steps % 15 === 0) heroTick(g, 'fight');
    while (S.story.encounters.length) { const e = S.story.encounters[0]; g.choose(e.choices[e.choices.length - 1].id); }
    if (!xpGiven && steps === 300) { xpGiven = true; g.gainXp(600); }   // levels from XP: no cards, no points
    g.step(); steps++;
    queued += S.queue.filter(q => q.horde === undefined).length + (S.dayQueue || []).length;   // the hordes' march is the V2 night (test/hordes.test.mjs)
    if (S.phase === 'night' && !wasNight) nightsSeen++; wasNight = S.phase === 'night';
    sneaky += S.mobs.filter(m => m.stream !== undefined || m.guard !== undefined || m.first).length;   // (horde dead are the V2 night)
    evs.push(...S.events.splice(0));
  }
  return { g, S, evs, queued, nightsSeen, sneaky, hash: hashOf(S), steps };
}

test('v2: three nights with none of the old systems', () => {
  const r = run(7, { v2: true }), { g, S, evs } = r;
  assert.ok(!S.over && S.night === 4, `the run lives to day 4 (night ${S.night}, over ${S.over})`);
  assert.equal(r.nightsSeen, 3, 'night still falls');
  assert.equal(r.queued, 0, 'no wave or straggler is ever queued from a nest');
  assert.equal(r.sneaky, 0, 'no stream, guard, horde or first-dead mob');
  const old = evs.filter(e => OLD_EVENTS.includes(e.t));
  assert.deepEqual([...new Set(old.map(e => e.t))], [], 'no event from a switched-off system');
  assert.ok(S.lvl > 2, `levels still come (lvl ${S.lvl})`);
  assert.deepEqual(S.picks, []); assert.deepEqual(S.offer, []);
  assert.equal(S.attr.pts, 0, 'no stat points'); assert.equal(g.statsOn(), false);
  assert.ok(!g.road, 'no road');
  assert.ok(g.forecast().every(f => S.hordes && S.hordes.spots.some(h => -1 - h.edge === f.nest)), 'the only forecast is a marching horde (the V2 night)');
  assert.equal(g.useAbility(), false, 'no class ability');
  const nest = g.map.regions.find(reg => reg.nest && S.nestAlive[reg.id]);
  if (nest) assert.equal(g.hitHive(nest.id, 999), false, 'no siege');
  assert.ok(!evs.some(e => e.t === 'toast' && /blessing|Stat Point|Haven Rig|Contract|Inferno Nest awake|Flare Night|come in force/.test(e.msg)), 'no toast from the cut systems');
  assert.ok(g.v2() && g.v2Off().includes('waves'));
});

test('v2: the same seed plays the same', () => {
  assert.equal(run(11, { v2: true }, 2).hash, run(11, { v2: true }, 2).hash);
});

test('v2: the save keeps the flag, a restore keeps it on', () => {
  const g = createGame({ seed: 5, area: 'suburb', v2: true });
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  assert.equal(snap.v2, true);
  const h = createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, difficulty: snap.difficulty, restore: snap, area: snap.area, v2: !!snap.v2 });
  assert.equal(h.v2(), true);
  assert.equal(createGame({ seed: 5 }).snapshot().v2, undefined, 'a save without the flag has no v2 field');
});

test('without the flag: a short run is unchanged', () => {
  const a = run(7, {}, 1), b = run(7, { v2: false }, 1), c = run(7, { v2: true }, 1);
  assert.equal(a.hash, b.hash); assert.equal(a.evs.length, b.evs.length);
  assert.notEqual(a.hash, c.hash, 'the flag does change the run');
  assert.ok(a.queued > 0, 'the old waves still come');
});
