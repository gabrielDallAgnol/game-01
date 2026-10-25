// Nests defend themselves: a guard pack rises when the hero comes near a living hive, and the longer the hero stays
// close the angrier it gets (rage), sending more and tougher dead in waves. Sites next to a living hive stay locked
// until it burns. Numbers: NEST in state.js. Nothing here is saved: the dead are not saved, the rage cools by dawn.
import { MOBS } from '../content/mobs.js';
import { LANDMARKS, T, idx, inside } from './mapgen.js';
import { NEST } from './state.js';
import { Rng, hashSeed } from './rng.js';

export function createNests(G) {
  const { S, map, ev, toast, mobById, seed } = G;
  const nrng = new Rng(hashSeed(seed, 'nests'));
  const st = {};   // per hive: { pack: night the pack last rose, rage: seconds, lv: waves sent this bout, told: highest line said, struck: s since a strike counts as near }
  S.nestRage = {};  // what the view and the panel read: { [region]: { rage 0..1 to the next wave, lv, guards } }
  const of = r => st[r] || (st[r] = { pack: 0, rage: 0, lv: 0, told: 0 });
  const tier = r => NEST.tier[Math.min(3, map.regions[r].ring)] || 1;
  const nightK = () => Math.min(NEST.nightMax, NEST.nightBase + NEST.nightPer * S.night);

  // ---------- the hive's body: a mound (round) or the building it nests in (its footprint) ----------
  /** where the hive's body stands (the building's middle for a hive in a building) */
  const nestBody = reg => reg.nest.body || reg.nest;
  /** how far a point is from the hive's outer edge (0 inside it): what the hero's reach is measured to */
  function nestEdge(reg, x, y) {
    const n = reg.nest, b = n.body;
    if (b) return Math.hypot(Math.max(0, Math.abs(x - b.x) - b.half), Math.max(0, Math.abs(y - b.y) - b.half));
    return Math.max(0, Math.hypot(x - n.x, y - n.y) - (reg.ring === 1 ? NEST.body.hollow : NEST.body.city));
  }
  /** the point of the hive's edge nearest (x, y) */
  function edgePoint(reg, x, y) {
    const n = reg.nest, b = n.body;
    if (b) return { x: Math.max(b.x - b.half, Math.min(b.x + b.half, x)), y: Math.max(b.y - b.half, Math.min(b.y + b.half, y)) };
    const rad = reg.ring === 1 ? NEST.body.hollow : NEST.body.city, d = Math.hypot(x - n.x, y - n.y) || 1;
    return d <= rad ? { x, y } : { x: n.x + (x - n.x) * rad / d, y: n.y + (y - n.y) * rad / d };
  }
  /** a clear line from (x, y) to the hive's open face: no solid cell (a building, rock, a cliff) between. A hive in a
   *  building is struck at its own walls (its footprint does not block); a city hive's open face is its door, so the
   *  line runs to the nearest edge of its mound or to the door itself, never through the block behind it. */
  function hiveInSight(reg, x, y) {
    const n = reg.nest, b = n.body;
    const own = (cx, cy) => !!b && Math.abs(cx + 0.5 - b.x) < b.half + 0.01 && Math.abs(cy + 0.5 - b.y) < b.half + 0.01;
    const clear = e => {
      const k = Math.ceil(Math.hypot(e.x - x, e.y - y) / 0.25);
      for (let s = 1; s <= k; s++) {
        const cx = Math.floor(x + (e.x - x) * s / k), cy = Math.floor(y + (e.y - y) * s / k);
        if (!inside(cx, cy)) return false;
        const i = idx(cx, cy), t = map.terrain[i];
        if ((t === T.ROCK || t === T.CLIFF || t === T.VOID || map.lm[i] >= 0) && !own(cx, cy)) return false;
      }
      return true;
    };
    return clear(edgePoint(reg, x, y)) || (!b && clear(n));
  }
  /** the living hive whose edge is within reach of a point (the nearest edge) and in clear sight of it, or null */
  function hiveInReach(x, y, reach) {
    if (G.v2) return null;   // [v2] no nest sieges: the hero never strikes a hive
    let best = null, bd = reach;
    for (const r of map.regions) { if (!r.nest || !S.nestAlive[r.id]) continue; const d = nestEdge(r, x, y); if (d < bd && hiveInSight(r, x, y)) { bd = d; best = r; } }
    return best;
  }
  /** is a point within d of a living hive's body (centre to point)? (the hero rests nowhere near one) */
  const nearHive = (x, y, d) => map.regions.some(r => r.nest && S.nestAlive[r.id] && !S.sealed[r.id] && Math.hypot(x - nestBody(r).x, y - nestBody(r).y) < d);
  /** the living hive that keeps a site locked (-1 when the site is free to claim) */
  const lockedBy = l => (!G.v2 /* [v2] no hive locks a site */ && l && !l.owned && !S.sealed[l.region] && map.regions[l.region] && map.regions[l.region].nest && S.nestAlive[l.region] ? l.region : -1);
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
    const kinds = []; if (S.night >= 3 || ring >= 2) kinds.push('runner'); if (S.night >= 5 && ring >= 2 || S.night >= NEST.bruteNight + 3) kinds.push('brute');
    while (kinds.length < k) kinds.push('walker');
    for (const kind of kinds) raise(r, kind, 1);
    ev('nestGuard', { region: r, x: n.x, y: n.y, n: kinds.length });
    toast(`[Inferno Nest guard] **${kinds.length} Ash-Born** claw out to guard the Inferno Nest. Stay close and it sends more.`, 'bad');
  }
  /** a wave of rage: bigger and tougher with every level */
  function rageWave(r) {
    const s = of(r), lv = Math.min(NEST.cap, s.lv), n = map.regions[r].nest;
    const k = Math.max(1, Math.round((NEST.wave + NEST.waveLv * lv) * nightK() * tier(r) * G.DIFF.threat / 0.88));
    const u = G.unlocked(Math.max(1, S.night)), kinds = [];
    if (lv >= NEST.bruteLv && (map.regions[r].ring >= 2 || S.night >= NEST.bruteNight)) kinds.push('brute');   // a city hive's frenzy brings a brute; a hollow's only late (bruteNight)
    if (lv >= 2) kinds.push('runner');
    while (kinds.length < k) { const [kind] = u[nrng.weighted(u.map(([, m]) => m.weight))]; kinds.push(kind); }
    for (const kind of kinds) raise(r, kind, 1 + NEST.hpLv * lv);
    ev('nestRage', { region: r, x: n.x, y: n.y, lv, n: kinds.length });
    if (lv > s.told && NEST.lines[lv]) { s.told = lv; toast(NEST.lines[lv].replace('{n}', kinds.length), 'bad'); }
  }
  /** once a step: the guard wakes, the rage climbs while you stay close and cools when you leave */
  function stepNests(dt) {
    if (!S.clock || S.over || G.v2) return;   // [v2] no guard packs, no rage
    const h = S.hero;
    for (const reg of map.regions) {
      const r = reg.id; if (!reg.nest || !S.nestAlive[r] || S.sealed[r]) { if (S.nestRage[r]) delete S.nestRage[r]; continue; }
      const b = nestBody(reg), s = of(r); if (s.struck > 0) s.struck -= dt;
      const d = h.dead ? Infinity : s.struck > 0 ? Math.min(NEST.near - 0.01, Math.hypot(h.x - b.x, h.y - b.y)) : Math.hypot(h.x - b.x, h.y - b.y);   // striking it from range angers it as much as standing close
      if (d < NEST.wake && s.pack !== S.night) wakePack(r);
      if (d < NEST.near) s.rage = Math.min(NEST.max * NEST.step, s.rage + dt);
      else if (s.rage > 0) { s.rage = Math.max(0, s.rage - dt * NEST.decay); if (s.rage === 0) { s.lv = 0; s.told = 0; } }
      const lv = Math.floor(s.rage / NEST.step);
      if (lv > s.lv) { s.lv = lv; rageWave(r); s.top = 0; }
      else if (d < NEST.near && s.rage >= NEST.max * NEST.step && (s.top = (s.top || 0) + dt) >= NEST.step) { s.top = 0; rageWave(r); }   // frenzied: it never stops sending while you stay
      else if (lv < s.lv - 1) s.lv = lv + 1;   // cooled off a level: leaving and coming back does not start from zero, nor from the top
      if (s.rage > 0 || d < NEST.wake) S.nestRage[r] = { rage: +((s.rage % NEST.step) / NEST.step).toFixed(2), lv: s.lv, hot: +(s.rage / (NEST.max * NEST.step)).toFixed(2), near: d < NEST.near };
      else if (S.nestRage[r]) delete S.nestRage[r];
    }
  }
  /** striking the hive angers it faster */
  function angerNest(r) { const s = of(r); s.rage = Math.min(NEST.max * NEST.step, s.rage + NEST.hit); s.struck = NEST.struck; }
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
  function promiseSite(l) { l.promised = true; toast(`[Promised] The **${LANDMARKS[l.kind].name}** is yours once the Inferno Nest beside it burns.`, 'good'); }
  const nestGuards = r => S.mobs.filter(m => m.guard === r).length;
  return { nestBody, nestEdge, hiveInSight, hiveInReach, nearHive, stepNests, angerNest, nestBurned, siteLocked, lockedBy, promiseSite, nestGuards };
}
