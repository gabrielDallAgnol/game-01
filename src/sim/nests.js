// Nests defend themselves: a guard pack rises when the hero comes near a living hive, and the longer the hero stays
// close the angrier it gets (rage), sending more and tougher dead in waves. Sites next to a living hive stay locked
// until it burns. Numbers: NEST in state.js. Nothing here is saved: the dead are not saved, the rage cools by dawn.
import { MOBS } from '../content/mobs.js';
import { LANDMARKS } from './mapgen.js';
import { NEST } from './state.js';
import { Rng, hashSeed } from './rng.js';

export function createNests(G) {
  const { S, map, ev, toast, mobById, seed } = G;
  const nrng = new Rng(hashSeed(seed, 'nests'));
  const st = {};   // per hive: { pack: night the pack last rose, rage: seconds, lv: waves sent this bout, told: highest line said }
  S.nestRage = {};  // what the view and the panel read: { [region]: { rage 0..1 to the next wave, lv, guards } }
  const of = r => st[r] || (st[r] = { pack: 0, rage: 0, lv: 0, told: 0 });
  const tier = r => NEST.tier[Math.min(3, map.regions[r].ring)] || 1;
  const nightK = () => Math.min(NEST.nightMax, NEST.nightBase + NEST.nightPer * S.night);

  /** the living hive that keeps a site locked (-1 when the site is free to claim) */
  const lockedBy = l => (l && !l.owned && map.regions[l.region] && map.regions[l.region].nest && S.nestAlive[l.region] ? l.region : -1);
  const siteLocked = l => lockedBy(l) >= 0;

  function raise(r, kind, hpK) {
    const m = G.spawnAtNest(kind, r), n = map.regions[r].nest;
    if (!MOBS[kind].fixedHp) m.hp = m.maxHp = Math.ceil(m.maxHp * tier(r) * hpK);
    m.roam = { x: n.x, y: n.y, region: -1 }; m.guard = r; m.hunt = true;   // it comes for you; if it loses you it goes home to its hive
    return m;
  }
  /** the guard pack: once a day per hive, when you first come near */
  function wakePack(r) {
    const s = of(r), ring = map.regions[r].ring, n = map.regions[r].nest;
    s.pack = S.night;
    const k = Math.max(2, Math.round((NEST.pack[Math.min(3, ring)] + NEST.packPer * (S.night - 1)) * G.DIFF.threat / 0.88));
    const kinds = []; if (S.night >= 3 || ring >= 2) kinds.push('runner'); if (S.night >= 5 && ring >= 2 || S.night >= 8) kinds.push('brute');
    while (kinds.length < k) kinds.push('walker');
    for (const kind of kinds) raise(r, kind, 1);
    ev('nestGuard', { region: r, x: n.x, y: n.y, n: kinds.length });
    toast(`[Hive guard] **${kinds.length} dead** claw out to guard the hive. Stay close and it sends more.`, 'bad');
  }
  /** a wave of rage: bigger and tougher with every level */
  function rageWave(r) {
    const s = of(r), lv = Math.min(NEST.cap, s.lv), n = map.regions[r].nest;
    const k = Math.max(1, Math.round((NEST.wave + NEST.waveLv * lv) * nightK() * tier(r) * G.DIFF.threat / 0.88));
    const u = G.unlocked(Math.max(1, S.night)), kinds = [];
    if (lv >= NEST.bruteLv && (S.night >= 4 || map.regions[r].ring >= 2)) kinds.push('brute');
    if (lv >= 2) kinds.push('runner');
    while (kinds.length < k) { const [kind] = u[nrng.weighted(u.map(([, m]) => m.weight))]; kinds.push(kind); }
    for (const kind of kinds) raise(r, kind, 1 + NEST.hpLv * lv);
    ev('nestRage', { region: r, x: n.x, y: n.y, lv, n: kinds.length });
    if (lv > s.told && NEST.lines[lv]) { s.told = lv; toast(NEST.lines[lv].replace('{n}', kinds.length), 'bad'); }
  }
  /** once a step: the guard wakes, the rage climbs while you stay close and cools when you leave */
  function stepNests(dt) {
    if (!S.clock || S.over) return;
    const h = S.hero;
    for (const reg of map.regions) {
      const r = reg.id; if (!reg.nest || !S.nestAlive[r] || S.sealed[r]) { if (S.nestRage[r]) delete S.nestRage[r]; continue; }
      const d = h.dead ? Infinity : Math.hypot(h.x - reg.nest.x, h.y - reg.nest.y), s = of(r);
      if (d < NEST.wake && s.pack !== S.night) wakePack(r);
      if (d < NEST.near) s.rage = Math.min(NEST.max * NEST.step, s.rage + dt);
      else if (s.rage > 0) { s.rage = Math.max(0, s.rage - dt * NEST.decay); if (s.rage === 0) { s.lv = 0; s.told = 0; } }
      const lv = Math.floor(s.rage / NEST.step);
      if (lv > s.lv) { s.lv = lv; rageWave(r); }
      else if (lv < s.lv - 1) s.lv = lv + 1;   // cooled off a level: leaving and coming back does not start from zero, nor from the top
      if (s.rage > 0 || d < NEST.wake) S.nestRage[r] = { rage: +((s.rage % NEST.step) / NEST.step).toFixed(2), lv: s.lv, hot: +(s.rage / (NEST.max * NEST.step)).toFixed(2), near: d < NEST.near };
      else if (S.nestRage[r]) delete S.nestRage[r];
    }
  }
  /** striking the hive angers it faster */
  function angerNest(r) { const s = of(r); s.rage = Math.min(NEST.max * NEST.step, s.rage + NEST.hit); }
  /** the hive burned: its guards run out with the horde (its fire does not burn them), its sites unlock */
  function nestBurned(r) {
    for (const m of S.mobs) if (m.guard === r) { m.roam = null; m.hunt = true; m.horde = r; m.guard = undefined; }
    delete st[r]; delete S.nestRage[r];
    for (const l of S.landmarks) {
      if (l.region !== r || l.owned || l.kind === 'unknown' || S.sealed[l.region]) continue;
      const L = LANDMARKS[l.kind];
      if (l.promised) { l.promised = false; G.takeSite(l); continue; }
      ev('siteFree', { id: l.id });
      toast(`[Site unlocked] The **${L.name}** is free to claim now.`, 'good');
    }
  }
  /** a story reward that hands you a locked site: it is promised, and yours the moment its hive burns */
  function promiseSite(l) { l.promised = true; toast(`[Promised] The **${LANDMARKS[l.kind].name}** is yours once the hive beside it burns.`, 'good'); }
  const nestGuards = r => S.mobs.filter(m => m.guard === r).length;
  return { stepNests, angerNest, nestBurned, siteLocked, lockedBy, promiseSite, nestGuards };
}
