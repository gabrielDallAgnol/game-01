// Where the dead come from: which hives are awake and hear the camp, the night's budget, the wave list,
// spawning, the day's stragglers, dusk (startNight), the purge march, and the light clock (timeOfDay).
import { CUT, ZONE } from './state.js';
import { MAX_LEVEL } from '../content/buildings.js';
import { MOBS, TIDE, WAVES } from '../content/mobs.js';
import { PASSABLE, idx, inside } from './mapgen.js';

export function createWaves(G) {
  const { S, c, claimedCount, ev, fail, isBloodMoon, keep, map, mobById, pop, rng, rule, toast } = G;

  // ---------- regions & nests ----------
  const edgeSpawns = [];
  // a hive notices you once your base comes within reach of it
  const adjacentToClaimed = r => { const n = map.regions[r].nest; return !!n && G.baseDist(n.x, n.y) <= ZONE.hiveReach; };
  // an awake hive sends its dead toward the noise, however far away it is (the sealed core stays shut)
  function activeNests(n = S.night) {
    return map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id) && !S.sealed[r.id] && S.wake[r.id] <= n).map(r => r.id);
  }
  // hearing: a hive marches on the camp only if the camp is loud enough to be heard from there. A loud town (heat) draws the far city.
  const HEAR = { base: 62, perHeat: 1.2 };
  const hearR = () => HEAR.base + (S.noise || 0) * HEAR.perHeat;   // the hearing ring around the camp, in cells
  const hears = r => { const n = map.regions[r].nest; return Math.hypot(n.x - c, n.y - c) < hearR(); };
  const marchNests = (n = S.night) => activeNests(n).filter(hears);
  // pacing: forest hollows can be burned from day 1; city hives need a level 2 keep, the old core level 3
  const keepForRing = ring => (ring <= 1 ? 1 : Math.min(MAX_LEVEL, ring));
  function canPurge(r) {
    const reg = map.regions[r];
    return reg && reg.nest && S.nestAlive[r] && !S.claimed.has(r) && adjacentToClaimed(r) && keep.level >= keepForRing(reg.ring);
  }

  // ---------- threat estimate (shared by the purge rating, the log and bots) ----------
  function unlocked(n) { return Object.entries(MOBS).filter(([, m]) => m.weight > 0 && m.from <= n).map(([k, m]) => (k === 'runner' && rule('raiders') ? [k, { ...m, weight: m.weight * 3 }] : [k, m])); }
  function hpPerBudget(n) {
    const u = unlocked(n), w = u.reduce((a, [, m]) => a + m.weight, 0);
    const hp = u.reduce((a, [, m]) => a + m.weight * m.hp, 0) / w, cost = u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / w;
    return hp / cost;
  }
  // blood moons: a nest guardian at 5, two at 10, the Gravelord from 15 (one more every 10 nights)
  function bossesFor(n) { return n < 15 ? ['guardian'] : Array.from({ length: Math.floor((n - 5) / 10) }, () => 'gravelord'); }   // on night 10 the season's unique monster takes the guardian's place
  const territory = () => (S.P.greed ? 1 + 0.25 * (claimedCount() - 1) : WAVES.territory(claimedCount()));
  // the difficulty curve: a won contract pulls the night the curve reads from back (see contractWon)
  const effN = n => Math.max(1, n - (S.diffNight || 0));
  const hpS = n => WAVES.hpScale(effN(n));
  function nightBudget(n) { return G.DIFF.threat * WAVES.budget(effN(n)) * (TIDE.opening[n] ?? 1) * territory() * G.townDraw() * (isBloodMoon(n) ? WAVES.bloodMoonMult(n) : 1) * (n > 1 && isBloodMoon(n - 1) ? 0.75 : 1) * G.weatherFor(n).dead; }   // the night after a blood moon is a breather
  function purgeBudget(r, n) { return WAVES.budget(effN(n)) * WAVES.purgeShare(map.regions[r].ring); }

  // ---------- waves ----------
  /** night 1's second pack: out of the deep woods on another side of the camp than the first hive (≥100° round) */
  function n1Edge(r) {
    const p = r < 0 ? edgeSpawns[-1 - r] : map.regions[r].nest, a0 = Math.atan2(p.y - c, p.x - c);
    let best = -1, bd = Infinity;
    edgeSpawns.forEach((e, k) => { let d = Math.abs(Math.atan2(e.y - c, e.x - c) - a0); if (d > Math.PI) d = 2 * Math.PI - d; const far = Math.hypot(e.x - c, e.y - c); if (d >= 1.75 && far < bd) { bd = far; best = k; } });
    return best < 0 ? r : -1 - best;
  }
  const nightLen = () => TIDE.nightLen; let todLast = 0.25;   // every night lasts its full length: the moon crosses the sky, cleared or not
  // one continuous clock for the light: 0 sunrise … dayShare dusk falls … 1 the next sunrise (day from S.dayT, night from S.qT)
  function timeOfDay() {
    const D = TIDE.dayLen / (TIDE.dayLen + nightLen());
    if (S.phase === 'over') return todLast;   // the run ended: the light holds where it was
    return (todLast = S.phase === 'night' ? D + (1 - D) * Math.min(1, S.qT / nightLen()) : D * (S.clock ? Math.min(1, S.dayT / TIDE.dayLen) : 0.4));
  }
  const N1_COUNT = 1 + TIDE.night1.packA.length + TIDE.night1.packB.length;
  function makeWave(n) {
    const nests = marchNests(n);
    if (!nests.length) { const any = map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id)).sort((p, q) => Math.hypot(p.nest.x - c, p.nest.y - c) - Math.hypot(q.nest.x - c, q.nest.y - c)); if (any.length) nests.push(any[0].id); }
    if (n === 1 && S.purge === null && nests.length) { const N1 = TIDE.night1, b = n1Edge(nests[0]);   // hand-authored: the first dead, its pack, then a pack from the far woods
      return [{ kind: 'walker', nest: nests[0], t: N1.first, first: true }, ...N1.packA.map(t => ({ kind: 'walker', nest: nests[0], t })), ...N1.packB.map(t => ({ kind: 'walker', nest: b, t }))]; }
    // the whole valley is yours: the dead now come out of the dark woods at the edge
    if (!nests.length) edgeSpawns.forEach((_, k) => nests.push(-1 - k));
    const wts = nests.map(r => (S.wake[r] === n && n > 1 ? 0.5 : 1));
    const u = unlocked(n), list = [];
    let budget = nightBudget(n);
    while (budget > 0.5) {
      const ok = u.filter(([, m]) => m.cost <= budget + 0.3); if (!ok.length) break;
      const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))];
      list.push({ kind, nest: nests[rng.weighted(wts)] }); budget -= m.cost;
    }
    const dur = WAVES.duration(n), surges = WAVES.surges(n);
    const q = list.map((e, k) => ({ ...e, t: Math.floor(k * surges / list.length) / surges * dur + rng.range(0, 2.5) }));
    if (isBloodMoon(n)) { const bs = bossesFor(n); const uq = S.unique && !S.unique.slain && S.unique.night === n; bs.forEach((kind, k) => q.push({ kind, unique: uq && k === 0, finale: k === 0 && S.season && n === S.season.end && S.season.finaleHive === undefined, nest: nests[rng.int(nests.length)], t: dur * 0.6 + rng.range(0, 6) })); }
    if (S.purge !== null) {
      let pb = purgeBudget(S.purge, n);
      const last = dur * (surges - 1) / surges;
      while (pb > 0.5) { const ok = u.filter(([, m]) => m.cost <= pb + 0.3); if (!ok.length) break; const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))]; q.push({ kind, nest: S.purge, t: last + rng.range(0, 4) }); pb -= m.cost; }
      q.push({ kind: 'guardian', nest: S.purge, t: last + 2 });
    }
    return q.sort((a, b) => a.t - b.t);
  }

  function spawnMob(kind, x, y, opts = {}) {
    const m = MOBS[kind], hs = hpS(S.night);
    const hp = m.fixedHp ? m.hp : Math.ceil(m.hp * hs * (m.weight === 0 && kind !== 'risen' ? (S.night < 10 ? Math.min(1, G.DIFF.threat) : G.DIFF.threat) : 1));   // bosses scale with the difficulty too
    const mob = { id: S.nextId++, kind, x, y, hp, maxHp: hp, cd: rng.range(0, 0.5), speed: m.speed * rng.range(0.9, 1.1), boost: 1, rise: opts.instant ? 1 : 0, face: 0, attacking: false, summonT: m.summon ? m.summon.every : 0, tauntT: 0, burn: null };
    S.mobs.push(mob); mobById.set(mob.id, mob); ev('spawn', { id: mob.id, kind });
    return mob;
  }
  function spawnAtNest(kind, r) {
    const n = r < 0 ? edgeSpawns[-1 - r] : map.regions[r].nest;
    for (let k = 0; k < 8; k++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(0, 1.8), x = n.x + Math.cos(a) * d, y = n.y + Math.sin(a) * d;
      if (inside(Math.floor(x), Math.floor(y)) && PASSABLE[map.terrain[idx(Math.floor(x), Math.floor(y))]] && S.occ[idx(Math.floor(x), Math.floor(y))] < 0) return spawnMob(kind, x, y);
    }
    return spawnMob(kind, n.x, n.y);
  }
  function planPurge(r) {
    if (r !== null && map.regions[r] && keep.level < keepForRing(map.regions[r].ring)) return fail(`Raise the keep to level ${keepForRing(map.regions[r].ring)} first.`);
    if (r === null) { S.purge = null; return true; }
    if (!canPurge(r)) return fail('You can only march on a nest next to your land.');
    S.purge = r; return true;
  }

  function startNight(dusk = false) {
    if (S.phase !== 'day' || S.over || S.story.encounters.length) return false;   // no bell: dusk comes with the sun (tests and bots may still skip ahead)
    S.dayQueue = [];
    G.refreshFlow(); G.cacheNeighbours();
    S.phase = 'night'; G.dropCrew(); G.crewing(); S.queue = makeWave(S.night); S.qT = 0; S.nightFlags = {}; S.ability.hires = 0; S.trade = null;
    for (const b of S.buildings) b.fell = false;
    const purgeReg = S.purge;
    Object.assign(S.cur, {
      goldAtBell: S.gold, pop: pop(), town: G.townCounts(), defDps: +G.defenceDps().toFixed(1), heroDps: +G.heroDps().toFixed(1),
      wave: S.queue.length, waveHp: Math.round(S.queue.reduce((a, q) => a + (MOBS[q.kind].fixedHp ? MOBS[q.kind].hp : Math.ceil(MOBS[q.kind].hp * hpS(S.night))), 0)),
      ratio: +G.threatRatio(S.night, purgeReg).toFixed(2), forecast: G.forecastStrip(), noise: Math.round(S.noise || 0), standing: S.buildings.filter(b => !b.ruined).length, purge: purgeReg, nests: activeNests().length, claimed: claimedCount(), bloodMoon: isBloodMoon(S.night),
    });
    if (!CUT.crew) G.sc.nightfall(keep);
    { const rt = G.ratingOf(S.cur.ratio); if (rt === 'Hard' || rt === 'Impossible') toast(`[Warning: ${rt}] Tonight beats your towers. Stay near the homes.`, 'bad'); }
    ev('night', { n: S.night, bloodMoon: isBloodMoon(S.night) });
    toast(isBloodMoon(S.night) ? `Blood moon. Night ${S.night} begins.` : `Dusk. Night ${S.night}: the dead come in force.`, isBloodMoon(S.night) ? 'bad' : undefined);
    return true;
  }

  // ---------- the low tide: stragglers by day, roaming dead in the wild ----------
  function planDay(n) {
    S.dayT = 0; S.dayQueue = [];
    if (!S.clock) return;
    const share = TIDE.dayShare(n), nests = activeNests(n); if (!share || !nests.length) return;
    const u = unlocked(Math.max(1, n - 2)); let budget = nightBudget(n) * share;
    while (budget > 0.5) {
      const ok = u.filter(([, m]) => m.cost <= budget + 0.3); if (!ok.length) break;
      const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))];
      S.dayQueue.push({ kind, nest: nests[rng.int(nests.length)], t: rng.range(6, TIDE.dayLen - 4) }); budget -= m.cost;
    }
    S.dayQueue.sort((a, b) => a.t - b.t);
  }
  return { edgeSpawns, activeNests, hearR, hears, marchNests, keepForRing, canPurge, unlocked, hpPerBudget, bossesFor, effN, hpS, nightBudget, purgeBudget, n1Edge, nightLen, timeOfDay, N1_COUNT, spawnMob, spawnAtNest, planPurge, startNight, planDay };
}
