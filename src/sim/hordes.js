// [v2] Hordes: the V2 night. Groups of the dead sleep at key places round the town (the town's sites, its nest,
// far doors) and wake at dusk as roamers round their spot: break one at night for
// its scrap. Now and then one marches on the camp instead: chosen at dawn (so the red route arrows show it all day)
// and sent through the night queue like the old waves. At dawn the survivors go back to sleep, and every horde regrows
// a little. Deterministic: its own Rng streams (the spot pick, each dawn's march roll). Nothing without G.v2.
import { Rng, hashSeed } from './rng.js';
import { HORDES } from '../content/hordes.js';
import { N, PASSABLE, idx, inside } from './mapgen.js';

export function createHordes(G) {
  if (!G.v2) return {};
  const { S, map, c, seed, ev, toast } = G;
  const H = () => S.hordes;
  const ok = (x, y) => { const i = idx(Math.floor(x), Math.floor(y)); return inside(Math.floor(x), Math.floor(y)) && PASSABLE[map.terrain[i]] && map.reach[i] && S.occ[i] < 0; };
  function pickSpots() {
    const rng = new Rng(hashSeed(seed, map.seed, 'hordes')), cand = [], A = map.area;
    for (const s of A.sites) cand.push({ x: s.door ? s.door.x : s.x, y: s.door ? s.door.y : s.y, why: 'site', name: s.kind }); if (A.nest) cand.push({ ...A.nest, why: 'nest', name: 'the nest' }); rng.shuffle(A.homes.slice()).slice(0, 40).forEach(h => cand.push({ x: h.x, y: h.y, why: 'street', name: h.name.replace(/^an? (house|shop|burnt-out house) on /, '') }));
    const keep = [];
    for (const p of cand) { if (keep.length >= HORDES.count) break; if (Math.hypot(p.x - c, p.y - c) < HORDES.minD || !ok(p.x, p.y) || keep.some(q => Math.hypot(q.x - p.x, q.y - p.y) < HORDES.gap)) continue; keep.push(p); }
    return keep.map((p, id) => ({ id, x: p.x, y: p.y, why: p.why, name: p.name, far: Math.hypot(p.x - c, p.y - c), dead: HORDES.size(1, Math.hypot(p.x - c, p.y - c)), awake: [], edge: -1 }));
  }
  function setup() {
    if (S.hordes) return;
    S.hordes = { spots: pickSpots(), plan: {}, broken: 0 };
    for (const h of H().spots) { h.edge = G.edgeSpawns.length; G.edgeSpawns.push({ x: h.x, y: h.y, horde: h.id }); }   // a marching horde enters the night queue like an old front
    planMarch();
  }
  const dir = h => { const a = Math.atan2(h.y - c, h.x - c), w = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']; return w[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; };
  // the march for the coming night, rolled at dawn from its own stream
  function planMarch() {
    const n = S.night, rng = new Rng(hashSeed(seed, 'march', n)), live = H().spots.filter(h => h.dead > 0);
    const last = Math.max(1, ...Object.entries(H().plan).filter(([, v]) => v >= 0).map(([k]) => +k)), due = n - last >= HORDES.pity;   // never too long without one
    const h = live.length && (rng.next() < HORDES.march(n) || (n >= 3 && due)) ? live[rng.int(live.length)] : null;
    H().plan[n] = h ? h.id : -1;
    if (h && n >= 2) toast(`[Horde] The dead at ${h.name} are restless. Tonight they may come for the camp, from the ${dir(h)}.`, 'bad');
  }
  const pickKind = (n, rng) => { const K = HORDES.kinds(n), i = rng.weighted(K.map(k => k[1])); return K[i][0]; };
  // dusk (makeWave asks for the night queue): the marching horde goes in the queue, the others wake round their spots
  function v2Wave(n) {
    setup();
    const rng = new Rng(hashSeed(seed, 'horde-night', n)), q = [], march = H().plan[n] ?? -1;
    for (const h of H().spots) {
      h.dead = Math.max(h.dead, 0); if (!h.dead) continue;
      if (h.id === march) { for (let k = 0; k < h.dead; k++) q.push({ kind: pickKind(n, rng), nest: -1 - h.edge, t: 2 + k * 0.7, horde: h.id }); ev('hordeMarch', { horde: h.id, x: h.x, y: h.y, n: h.dead }); toast(`[Horde] The dead at ${h.name} are coming for the camp, from the ${dir(h)}.`, 'bad'); h.marched = true; continue; }
      h.awake = [];
      for (let k = 0; k < h.dead; k++) { const m = G.spawnMob(pickKind(n, rng), h.x + rng.range(-2.5, 2.5), h.y + rng.range(-2.5, 2.5), { instant: true }); m.roam = { x: h.x, y: h.y, region: -1 }; m.horde = h.id; h.awake.push(m.id); }
      ev('hordeWake', { horde: h.id, x: h.x, y: h.y, n: h.dead });
    }
    return q;
  }
  // a horde broken at night pays out; at dawn the rest go back to sleep and every horde regrows
  let phase = S.phase;
  function stepHordes() {
    const st = H(); if (!st) { if (S.phase === 'day') setup(); return; }
    for (const h of st.spots) if (h.awake.length) {
      const alive = h.awake.filter(id => G.mobById.has(id)); if (alive.length === h.awake.length) continue;
      h.awake = alive; h.dead = alive.length;
      if (!alive.length) { const n = HORDES.loot(HORDES.size(S.night, h.far), h.far); G.earn(n); st.broken++; ev('hordeBroken', { horde: h.id, x: h.x, y: h.y, scrap: n }); toast(`[Horde broken] The dead at ${h.name} are gone: **+${n} scrap**.`, 'good'); }
    }
    if (phase !== S.phase) {
      phase = S.phase;
      if (S.phase === 'day') {
        for (const h of st.spots) {
          for (const id of h.awake) { const m = G.mobById.get(id); if (m) { S.mobs.splice(S.mobs.indexOf(m), 1); G.mobById.delete(id); ev('nestHome', { id, region: -1 }); } }
          const want = HORDES.size(S.night, h.far);
          h.dead = h.marched ? Math.min(want, 2) : Math.min(want, h.dead + HORDES.regrow + (h.dead ? 0 : 0)); h.awake = []; h.marched = false;
        }
        planMarch();
      }
    }
  }
  // the day's warning: the marching horde's route, drawn by the route arrows
  const hordeMarch = n => { const st = H(); if (!st) return []; const id = st.plan[n]; const h = id >= 0 ? st.spots[id] : null; return h && h.dead ? [{ nest: -1 - h.edge, x: h.x, y: h.y, count: h.dead }] : []; };
  return { v2Wave, stepHordes, hordeMarch, hordes: () => H() };
}
