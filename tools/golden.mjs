// The refactor safety net: a handful of deterministic scripted V2 runs (the three engine towns, heroes, difficulties,
// hordes, the dash, building at the camp, searching houses, claiming a site, a save → restore round trip), each hashing
// the game's core state and the event stream every night. Any change in behaviour changes a hash. Refactors must keep
// the output byte for byte. (The V2 golden replaced the classic one on Oct 25: the old scenarios drove systems that are gone.)
//   node tools/golden.mjs            print the lines (runs the scenarios in parallel, one process each)
//   node tools/golden.mjs --write    record them into test/golden.json
//   node tools/golden.mjs --check    compare with test/golden.json (exit 1 on the first difference)
//   node tools/golden.mjs --one A    run one scenario in this process (used by the parallel runner)
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGame } from '../src/sim/game.js';
import { heroTick, dayTurn, storyTurn as story, dodge, searchTick } from './bot.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GOLDEN = ROOT + 'test/golden.json';

// ---------- a stable, order-independent hash of any value (Maps, Sets, typed arrays, cycles; functions skipped) ----------
function feed(h, v, stack) {
  if (v === null) return h.update('n');
  switch (typeof v) {
    case 'undefined': return h.update('u');
    case 'number': return h.update(Object.is(v, -0) ? '#-0' : '#' + String(v));
    case 'string': return h.update(JSON.stringify(v));
    case 'boolean': return h.update(v ? 'T' : 'F');
    case 'function': return h.update('f');
    case 'bigint': return h.update('b' + v);
  }
  if (stack.includes(v)) return h.update('@cycle');
  if (ArrayBuffer.isView(v)) { h.update(`<${v.constructor.name}:${v.length}>`); return h.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength)); }
  stack.push(v);
  if (Array.isArray(v)) { h.update('['); for (const x of v) { feed(h, x, stack); h.update(','); } h.update(']'); }
  else if (v instanceof Map) { h.update('M{'); for (const [k, x] of [...v.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) { feed(h, k, stack); h.update(':'); feed(h, x, stack); h.update(','); } h.update('}'); }
  else if (v instanceof Set) { h.update('S['); for (const x of [...v].map(String).sort()) { h.update(x); h.update(','); } h.update(']'); }
  else { h.update('{'); for (const k of Object.keys(v).sort()) { if (typeof v[k] === 'function') continue; h.update(k); h.update(':'); feed(h, v[k], stack); h.update(','); } h.update('}'); }
  stack.pop();
}
export const hashOf = v => { const h = createHash('sha256'); feed(h, v, []); return h.digest('hex').slice(0, 16); };

// ---------- what the run is: the core state, picked field by field (a deleted system's leftovers never move a hash) ----------
const pick = (o, keys) => (o ? Object.fromEntries(keys.map(k => [k, o[k]])) : null);
const MOB = ['id', 'kind', 'x', 'y', 'hp', 'maxHp', 'horde', 'rise', 'windT'], BLD = ['id', 'type', 'x', 'y', 'rot', 'level', 'hp', 'maxHp', 'ruined', 'built'];
function core(S) {
  return {
    ...pick(S, ['time', 'night', 'phase', 'dayT', 'qT', 'gold', 'food', 'kills', 'lvl', 'xp', 'over', 'survivors', 'homeless', 'nextId']),
    hero: { ...pick(S.hero, ['x', 'y', 'hp', 'maxHp', 'dead', 'respawn', 'face']), carry: S.hero.carry },
    keep: pick(S.keep, ['hp', 'maxHp', 'level', 'ruined']), dash: S.dash || null,
    buildings: S.buildings.map(b => pick(b, BLD)), mobs: S.mobs.map(m => pick(m, MOB)), allies: S.allies.map(a => pick(a, ['id', 'kind', 'x', 'y', 'hp'])),
    chests: S.chests.map(c => pick(c, ['x', 'y'])), purses: S.purses.map(c => pick(c, ['x', 'y', 'gold'])), pickups: S.pickups.map(c => pick(c, ['x', 'y', 'kind', 'n'])), shots: S.projectiles.length,
    sites: S.landmarks.map(l => [l.kind, !!l.owned]), hordes: S.hordes || null, search: S.search || null, queue: S.queue.length,
  };
}
// ---------- what the UI and bots read: the public API's queries the V2 game keeps ----------
function probe(g) {
  const t = g.map.town;
  return {
    pop: g.pop(), foodPerDawn: g.foodPerDawn(), foodNeed: g.foodNeed(), upkeep: g.upkeep(), defenceDps: g.defenceDps(), heroDps: g.heroDps(), keepCost: g.keepCost(), ruins: g.ruins(),
    xpNext: g.xpNext(), party: g.partySize(), clock: [g.nightFrac(), g.timeOfDay(), g.dayShare(), g.duskIn(), g.dayFrac()], income: g.incomeRate(),
    place: ['house', 'farm', 'tower'].map(k => g.canPlace(k, t.x + 6, t.y + 5)), costs: ['house', 'farm', 'tower'].map(k => [g.buyCost(k), g.newCost(k), g.costOf(k)]),
    forecast: g.forecast().map(f => ({ nest: f.nest, x: f.x, y: f.y, count: f.count, path: f.path.length })), dash: g.dashInfo(), searchAt: g.searchAt(), searched: g.searchHomes().filter(h => g.searched(h.id)).length,
  };
}
const mapHash = m => hashOf({ terrain: m.terrain, reach: m.reach, road: m.road, slots: m.slots, landmarks: m.landmarks.map(l => pick(l, ['kind', 'x', 'y', 'size'])), town: m.town, area: m.area && pick(m.area, ['id', 'hash', 'ox', 'oy']), homes: m.area && m.area.homes });

// ---------- one scenario: drives the game, emits a line per night ----------
function runner(name, g) {
  const lines = [], evHash = createHash('sha256'); let evN = 0;
  const step = () => { g.step(); const evs = g.state.events.splice(0); for (const e of evs) feed(evHash, e, []); evN += evs.length; };
  const mark = tag => {
    const S = g.state, ev = evHash.copy().digest('hex').slice(0, 16);
    lines.push(`${name} ${tag} night=${S.night} phase=${S.phase} over=${S.over} gold=${S.gold} food=${S.food} kills=${S.kills} mobs=${S.mobs.length} bld=${S.buildings.length} ev=${evN}:${ev} state=${hashOf(core(S))} probe=${hashOf(probe(g))}`);
  };
  lines.push(`${name} map ${mapHash(g.map)} area=${g.map.area ? g.map.area.id : '-'} homes=${g.map.area ? g.map.area.homes.length : 0} sites=${g.state.landmarks.length}`);
  return { lines, step, mark, swap: ng => { g = ng; }, get g() { return g; } };
}
const NIGHTS = 7, CAP = 60 * 60 * 40;

const SCEN = {
  // the suburb, the survivor (the UI's hero): builders on, searching by day, dashing, a save → restore round trip at dawn 4
  A() {
    let g = createGame({ seed: 100, mapSeed: 300, hero: 'survivor', difficulty: 'survivor', area: 'suburb' });
    const R = runner('A', g); g.state.builders = 'balanced'; let steps = 0, saved = false;
    while (!g.state.over && g.state.night <= NIGHTS && steps < CAP) {
      const S = g.state; story(g);
      if (steps % 15 === 0) { dodge(g); if (!searchTick(g, 40)) heroTick(g, 'active'); }
      const ph = S.phase; R.step(); steps++;
      if (ph === 'night' && g.state.phase === 'day') {
        R.mark('dawn');
        if (g.state.night === 4 && !saved) {
          saved = true; g.rebuildAll();
          const snap = JSON.parse(JSON.stringify(g.snapshot())); delete snap.savedAt;
          g = createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, difficulty: snap.difficulty, restore: snap, legacy: snap.legacy || {}, area: snap.area });
          g.state.events.length = 0; R.swap(g); R.mark('restored');
        }
      }
    }
    R.mark('end'); return R.lines;
  },
  // the mill town, veteran, the warrior on autopilot (the planner builds, the autopilot fights)
  B() {
    const g = createGame({ seed: 101, mapSeed: 301, hero: 'warrior', difficulty: 'veteran', area: 'milltown' });
    const R = runner('B', g); g.setAutopilot(true); let steps = 0;
    while (!g.state.over && g.state.night <= NIGHTS && steps < CAP) {
      const S = g.state; story(g);
      if (steps % 15 === 0) dodge(g);
      const ph = S.phase; R.step(); steps++;
      if (ph === 'night' && S.phase === 'day') R.mark('dawn');
    }
    R.mark('end'); return R.lines;
  },
  // downtown, nightmare: nobody builds, the hero stays home; the hordes come until the camp falls (or night 9)
  C() {
    const g = createGame({ seed: 7, mapSeed: 7, hero: 'survivor', difficulty: 'nightmare', area: 'downtown' });
    const R = runner('C', g), S = g.state; let steps = 0;
    while (!S.over && S.night <= 9 && steps < 60 * 60 * 60) {
      story(g); if (steps % 15 === 0) heroTick(g, 'idle');
      const ph = S.phase; R.step(); steps++;
      if (ph === 'night' && S.phase === 'day') R.mark('dawn');
    }
    R.mark(S.over ? 'fell' : 'end'); R.lines.push(`C log ${hashOf(S.log)} stats ${hashOf(S.stats)}`); return R.lines;
  },
  // the suburb, story difficulty, the archer: a hand-built camp (the bot's day turn at every dawn), a site claimed on
  // day 2 (the hero walks to its door), searching far out, dashing
  D() {
    const g = createGame({ seed: 3, mapSeed: 3, hero: 'archer', difficulty: 'story', area: 'suburb' });
    const R = runner('D', g), S = g.state, t = g.map.town; let steps = 0, claim = null;
    S.gold += 30; dayTurn(g, 'balanced'); R.mark('built');
    while (!S.over && S.night <= NIGHTS && steps < CAP) {
      story(g);
      if (S.night === 2 && S.phase === 'day' && claim === null) { claim = S.landmarks.filter(l => !l.owned).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0] || false; if (claim) S.gold += 40; }
      const going = claim && !claim.owned && S.night === 2 && S.phase === 'day';
      if (going && steps % 30 === 0 && g.landmarkReach(claim.id)) R.lines.push(`D claim ${claim.kind} ${!!g.claimLandmark(claim.id)} at step ${steps}`);
      if (steps % 15 === 0) { dodge(g); if (going) { const d = claim.engine && claim.engine.door; g.heroTo(d ? d.x : claim.x, d ? d.y : claim.y + claim.size / 2 + 0.6); } else if (!searchTick(g, 70)) heroTick(g, 'active'); }
      const ph = S.phase; R.step(); steps++;
      if (ph === 'night' && S.phase === 'day') { R.mark('dawn'); g.rebuildAll(); dayTurn(g, 'balanced'); }
    }
    R.mark('end'); return R.lines;
  },
};

const args = process.argv.slice(2);
if (args[0] === '--one') {
  const out = SCEN[args[1]]();
  process.stdout.write(out.join('\n') + '\n');
} else {
  const header = [];
  const names = Object.keys(SCEN);
  const results = await Promise.all(names.map(n => new Promise((done, fail) => {
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--one', n], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = ''; p.stdout.on('data', d => { buf += d; }); p.on('close', code => (code === 0 ? done(buf.trim().split('\n')) : fail(new Error(`scenario ${n} exited ${code}`))));
  })));
  const lines = header.concat(...results);
  if (args[0] === '--write') { writeFileSync(GOLDEN, JSON.stringify(lines, null, 1) + '\n'); console.log(`wrote ${lines.length} lines to test/golden.json`); }
  else if (args[0] === '--check') {
    const want = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    const k = want.findIndex((l, i) => l !== lines[i]);
    if (k < 0 && want.length === lines.length) console.log(`golden: identical (${lines.length} lines)`);
    else { console.log(`golden: DIFFERS at line ${k}\n  want ${want[k]}\n  got  ${lines[k]}`); process.exit(1); }
  } else console.log(lines.join('\n'));
}
