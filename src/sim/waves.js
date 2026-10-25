// Where the dead come from and when: which hives are awake, the edge spawns (the hordes' march enters the night queue
// from there, sim/hordes.js), spawning, dusk (startNight: the night queue is the hordes' march), and the light clock
// (timeOfDay). The old wave builder (budgets, fronts, purges, day stragglers) was cut on Oct 25: V2's night is hordes.
import { MOBS, TIDE, WAVES } from '../content/mobs.js';
import { MAX_LEVEL } from '../content/buildings.js';
import { CUT } from './state.js';
import { PASSABLE, idx, inside } from './mapgen.js';

export function createWaves(G) {
  const { S, claimedCount, ev, keep, map, mobById, pop, rng, toast } = G;

  // ---------- regions & nests ----------
  const edgeSpawns = [];   // [{ x, y, horde? }]: where a marching horde enters (sim/hordes.js pushes one per horde)
  /** the hives awake tonight (they send nothing in V2; the hero just heals nowhere near one) */
  function activeNests(n = S.night) {
    return map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id) && !S.sealed[r.id] && S.wake[r.id] <= n).map(r => r.id);
  }
  // pacing: forest hollows can be burned from day 1; city hives need a level 2 keep, the old core level 3
  const keepForRing = ring => (ring <= 1 ? 1 : Math.min(MAX_LEVEL, ring));
  // the difficulty curve: the night the hp curve reads from
  const effN = n => Math.max(1, n - (S.diffNight || 0));
  const hpS = n => WAVES.hpScale(effN(n));
  const nightLen = () => TIDE.nightLen; let todLast = 0.25;   // every night lasts its full length: the moon crosses the sky, cleared or not
  // one continuous clock for the light: 0 sunrise … dayShare dusk falls … 1 the next sunrise (day from S.dayT, night from S.qT)
  function timeOfDay() {
    const D = TIDE.dayLen / (TIDE.dayLen + nightLen());
    if (S.phase === 'over') return todLast;   // the run ended: the light holds where it was
    return (todLast = S.phase === 'night' ? D + (1 - D) * Math.min(1, S.qT / nightLen()) : D * (S.clock ? Math.min(1, S.dayT / TIDE.dayLen) : 0.4));
  }
  function spawnMob(kind, x, y, opts = {}) {
    if (G.spawnPoint) ({ x, y } = G.spawnPoint(x, y));   // never in the void, a walled-in yard or a roof: the nearest open ground (sim/steer.js)
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
      if (inside(Math.floor(x), Math.floor(y)) && PASSABLE[map.terrain[idx(Math.floor(x), Math.floor(y))]] && map.reach[idx(Math.floor(x), Math.floor(y))] && S.occ[idx(Math.floor(x), Math.floor(y))] < 0) return spawnMob(kind, x, y);
    }
    return spawnMob(kind, n.x, n.y);
  }
  function startNight(dusk = false) {
    if (S.phase !== 'day' || S.over || S.story.encounters.length) return false;   // no bell: dusk comes with the sun (tests and bots may still skip ahead)
    G.refreshFlow(); G.cacheNeighbours();
    S.phase = 'night'; G.dropCrew(); G.crewing(); S.queue = G.v2Wave ? G.v2Wave(S.night) : []; S.qT = 0; S.nightFlags = {}; S.trade = null;
    for (const b of S.buildings) b.fell = false;
    Object.assign(S.cur, {
      goldAtBell: S.gold, pop: pop(), town: G.townCounts(), defDps: +G.defenceDps().toFixed(1), heroDps: +G.heroDps().toFixed(1),
      wave: S.queue.length, waveHp: Math.round(S.queue.reduce((a, q) => a + (MOBS[q.kind].fixedHp ? MOBS[q.kind].hp : Math.ceil(MOBS[q.kind].hp * hpS(S.night))), 0)),
      standing: S.buildings.filter(b => !b.ruined).length, nests: activeNests().length, claimed: claimedCount(),
    });
    if (!CUT.crew) G.sc.nightfall(keep);
    ev('night', { n: S.night });
    toast(`Dusk. Night ${S.night}.`);
    return true;
  }

  return { edgeSpawns, activeNests, keepForRing, effN, hpS, nightLen, timeOfDay, spawnMob, spawnAtNest, startNight };
}
