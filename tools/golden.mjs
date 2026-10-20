// The refactor safety net: a handful of deterministic scripted runs (seeds, heroes, difficulties, a contract, a hive burn,
// the road, packs, a purge, a save → restore round trip), each hashing the full game state and the event stream every
// night. Any change in behaviour changes a hash. Refactors must keep the output byte for byte.
//   node tools/golden.mjs            print the lines (runs the scenarios in parallel, one process each)
//   node tools/golden.mjs --write    record them into test/golden.json
//   node tools/golden.mjs --check    compare with test/golden.json (exit 1 on the first difference)
//   node tools/golden.mjs --one A    run one scenario in this process (used by the parallel runner)
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as GAME from '../src/sim/game.js';
import { heroTick, chooseStory, dayTurn, choosePerks, scavengeTurn, EXPANSION } from './bot.mjs';

const { createGame } = GAME;
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

// ---------- what the UI and bots read: the public API's queries (same calls before and after a refactor) ----------
function probe(g) {
  const S = g.state, t = g.map.town, R = g.road;
  const o = {
    pop: g.pop(), foodPerDawn: g.foodPerDawn(), goldPerDawn: g.goldPerDawn(), foodNeed: g.foodNeed(), upkeep: g.upkeep(), defenceDps: g.defenceDps(), heroDps: g.heroDps(),
    threat: g.threatRatio(), strip: g.forecastStrip(), forecast: g.forecast().map(f => ({ ...f, path: f.path.length })), noise: g.noiseInfo(), tools: g.tools(), crew: g.crewing(),
    hands: [g.handsMax(), g.handsFree()], power: [g.powerIn(), g.powerOut()], heatFloor: g.heatFloor(), keepCost: g.keepCost(), ruins: g.ruins(), regions: g.map.regions.map(r => g.regionInfo(r.id)),
    active: g.activeNests(), reroll: g.rerollCost(), xpNext: g.xpNext(), party: g.partySize(), frontier: g.frontier(), weather: g.weather(), clock: [g.nightFrac(), g.timeOfDay(), g.dayShare(), g.duskIn(), g.dayFrac(), g.bellBonus()],
    rows: g.logRows().length, zone: g.zone(), place: ['house', 'farm', 'tower'].map(k => g.canPlace(k, t.x + 6, t.y + 5)), costs: ['house', 'farm', 'tower', 'workshop', 'market'].map(k => [g.buyCost(k), g.newCost(k), g.costOf(k)]),
    keepNeeds: g.keepNeeds(), season: g.season(), eff: g.effNight(), ledger: g.ledger(), diff: g.difficulty(), hear: g.hearRadius(), noiseN: g.noise(), draw: g.townDraw(),
    stations: R ? R.stations.map(st => R.tripInfo(st.x, st.y)).map(x => x && { ...x, path: x.path.length }) : null, places: R ? R.places() : null, missionF: R ? R.forecast() : null,
    lm: S.landmarks.map(l => g.landmarkReach(l.id)), scav: S.scav ? S.scav.sites.map(s => g.scavenge.siteInfo(s.id)) : null, story: g.story() && g.story().strip ? g.story().strip() : null,
  };
  return o;
}

// ---------- one scenario: drives the game, emits a line per night ----------
const snapState = S => S;   // the whole state (map included)
function runner(name, g, opts = {}) {
  const lines = [], evHash = createHash('sha256'); let evN = 0;
  const api = g => Object.keys(g).sort().map(k => `${k}:${typeof g[k]}`).join(',');
  const step = () => { g.step(); const evs = g.state.events.splice(0); for (const e of evs) feed(evHash, e, []); evN += evs.length; };
  const mark = tag => {
    const S = g.state;
    const ev = evHash.copy().digest('hex').slice(0, 16);
    lines.push(`${name} ${tag} night=${S.night} phase=${S.phase} over=${S.over} gold=${S.gold} food=${S.food} kills=${S.kills} mobs=${S.mobs.length} bld=${S.buildings.length} ev=${evN}:${ev} state=${hashOf(snapState(S))} probe=${hashOf(probe(g))}`);
  };
  return { lines, step, mark, api, swap: ng => { g = ng; }, get g() { return g; } };
}

const SCEN = {
  // the clock bot: survivor, warrior; a save → restore round trip at dawn 6; a contract comes from the story
  A() {
    let g = createGame({ seed: 100, mapSeed: 300, biome: 'riverbend', hero: 'warrior', difficulty: 'survivor' });
    const R = runner('A', g); R.lines.push(`A api ${hashOf(R.api(g))}`);
    g.state.builders = 'balanced'; let steps = 0, saved = false;
    while (!g.state.over && g.state.night <= 12 && steps < 60 * 60 * 40) {
      const S = g.state;
      while (S.pendingPicks > 0 && S.offer.length) g.choosePerk(S.offer[0]);
      if (S.story.encounters.length) chooseStory(g);
      if (steps % 15 === 0) heroTick(g, 'active');
      const ph = S.phase; R.step(); steps++;
      if (ph === 'night' && g.state.phase === 'day') {
        R.mark('dawn');
        if (g.state.night === 6 && !saved) {
          saved = true; g.rebuildAll();
          const snap = JSON.parse(JSON.stringify(g.snapshot())); delete snap.savedAt;
          R.lines.push(`A snapshot ${hashOf(snap)}`);
          g = createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, mode: 'classic', difficulty: snap.difficulty, restore: snap, legacy: snap.legacy || {} });
          g.state.events.length = 0; R.swap(g); R.mark('restored');
        }
      }
    }
    R.mark('end'); R.lines.push(`A contract ${JSON.stringify(g.state.story.contract ? { id: g.state.story.contract.id, won: !!g.state.story.contract.won } : null)}`);
    return R.lines;
  },
  // autopilot, veteran, archer; a hive burned by hand on day 3, then a flare and smoke against the horde
  B() {
    const g = createGame({ seed: 101, mapSeed: 301, biome: 'riverbend', hero: 'archer', difficulty: 'veteran' });
    const R = runner('B', g); g.setAutopilot(true); let steps = 0, burned = false, horde = -1;
    while (!g.state.over && g.state.night <= 12 && steps < 60 * 60 * 40) {
      const S = g.state;
      while (S.pendingPicks > 0 && S.offer.length) g.choosePerk(S.offer[S.offer.length - 1]);
      if (S.story.encounters.length) chooseStory(g);
      if (!burned && S.night === 3 && S.phase === 'day' && S.dayT > 10) {
        const t = g.map.town, reg = g.map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.sealed[r.id] && r.ring === 1).sort((a, b) => Math.hypot(a.nest.x - t.x, a.nest.y - t.y) - Math.hypot(b.nest.x - t.x, b.nest.y - t.y))[0];
        if (reg) { S.hero.x = reg.nest.x + 1.5; S.hero.y = reg.nest.y; S.hero.target = null; S.hero.path = null; g.hitHive(reg.id, 30); g.hitHive(reg.id, 9999); horde = steps; R.lines.push(`B burned ${reg.id} claimed=${S.claimed.has(reg.id)}`); }
        burned = true;
      }
      if (horde >= 0 && steps === horde + 120) { S.gold += 10; g.useFlare(); }
      if (horde >= 0 && steps === horde + 240) { S.food += 5; g.useSmoke(); g.heroTo(g.map.town.x, g.map.town.y + 3.5); }
      const ph = S.phase; R.step(); steps++;
      if (ph === 'night' && g.state.phase === 'day') R.mark('dawn');
    }
    R.mark('end'); return R.lines;
  },
  // the classic turn bot (no clock): packs, perk paths, a purge march, scavenging, story difficulty, the merchant
  C() {
    const g = createGame({ seed: 11, biome: 'riverbend', hero: 'merchant', mode: 'packs', difficulty: 'story', clock: false });
    const R = runner('C', g), S = g.state;
    choosePerks(g, 'harvest');
    while (!S.over && S.night <= 12) {
      dayTurn(g, 'balanced');
      const target = EXPANSION.reckless(g, S.night); if (target !== null) { g.planPurge(target); dayTurn(g, 'balanced'); }
      scavengeTurn(g);
      if (S.night === 4) { const t = g.map.town; for (let d = 4; d < 14; d++) if (g.clearRubble(t.x + d, t.y - d)) break; }
      g.startNight();
      let steps = 0;
      while (S.phase === 'night' && steps < 60 * 400) { if (steps % 15 === 0) heroTick(g, 'active'); R.step(); steps++; }
      if (S.phase === 'night') break;
      R.mark('dawn'); g.rebuildAll(); choosePerks(g, 'harvest');
    }
    R.mark('end'); return R.lines;
  },
  // the road: an outpost lit and its tower, a convoy brought home, missions (hunt, lantern, horn), nightmare medic
  D() {
    const g = createGame({ seed: 3, mapSeed: 3, biome: 'riverbend', hero: 'medic', difficulty: 'nightmare' });
    const R = runner('D', g), S = g.state, road = g.road, t = g.map.town;
    S.builders = 'balanced'; let steps = 0;
    const tp = (x, y) => { S.hero.x = x; S.hero.y = y; S.hero.target = null; S.hero.path = null; };
    const st = road.stations[0]; S.gold += 60; tp(st.x + 1, st.y);
    for (let k = 0; k < 60 * 4; k++) { R.step(); steps++; }
    R.lines.push(`D lit ${st.lit} tower ${road.buildTower(st.id)}`);
    road.makeConvoy(3); road.go(t.x, t.y + 3.5);
    for (let k = 0; k < 60 * 90 && road.convoys().length; k++) { if (S.story.encounters.length) chooseStory(g); R.step(); steps++; }
    R.mark('convoy');
    while (!S.over && S.night <= 10 && steps < 60 * 60 * 40) {
      while (S.pendingPicks > 0 && S.offer.length) g.choosePerk(S.offer[0]);
      if (S.story.encounters.length) chooseStory(g);
      if (road.mission.choosing && S.night === 2) road.setMission('hunt');
      if (S.phase === 'night' && S.night === 2 && S.qT > 20 && S.qT < 20 + 1 / 60) { road.setLantern(false); }
      if (S.phase === 'night' && S.night === 2 && S.qT > 40 && S.qT < 40 + 1 / 60) { road.setLantern(true); }
      if (road.mission.choosing && S.night === 3) road.setMission('piper');
      if (S.phase === 'night' && S.night === 3 && S.qT > 15 && S.qT < 15 + 1 / 60) R.lines.push(`D horn ${road.horn()}`);
      if (S.night === 5 && S.phase === 'day' && S.dayT < 1 / 60) g.setDifficulty('veteran');
      if (S.phase === 'night' && steps % 600 === 0) g.useAbility();
      if (steps % 15 === 0) heroTick(g, 'active');
      const ph = S.phase; R.step(); steps++;
      if (ph === 'night' && S.phase === 'day') { R.mark('dawn'); g.rebuildAll(); }
    }
    R.mark('end'); return R.lines;
  },
  // a camp that falls: nightmare, nobody builds, the hero stays home; the hall goes down and the run ends
  E() {
    const g = createGame({ seed: 7, biome: 'riverbend', hero: 'survivor', difficulty: 'nightmare', clock: false });
    const R = runner('E', g), S = g.state;
    while (!S.over && S.night <= 30) {
      chooseStory(g); while (S.pendingPicks > 0 && S.offer.length) g.choosePerk(S.offer[0]);
      g.startNight();
      let steps = 0;
      while (S.phase === 'night' && steps < 60 * 400) { if (steps % 15 === 0) heroTick(g, 'idle'); R.step(); steps++; }
      R.mark(S.over ? 'fell' : 'dawn');
      if (S.phase === 'night') break;
    }
    R.mark('end'); R.lines.push(`E log ${hashOf(S.log)} stats ${hashOf(S.stats)}`); return R.lines;
  },
};

const args = process.argv.slice(2);
if (args[0] === '--one') {
  const out = SCEN[args[1]]();
  process.stdout.write(out.join('\n') + '\n');
} else {
  const header = [`exports ${Object.keys(GAME).sort().join(',')}`, `consts ${hashOf(Object.fromEntries(Object.entries(GAME).filter(([, v]) => typeof v !== 'function')))}`];
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
