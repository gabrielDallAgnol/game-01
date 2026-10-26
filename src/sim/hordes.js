// [v2] Hordes: the V2 night. Groups of the dead sleep at key places round the town (the town's sites, its nest,
// far doors) and wake at dusk as roamers round their spot (HORDES.awake(n) of them): break one at night for
// its scrap. HORDES.marches(n) of them march on the camp instead (none on night 1, two on night 6): chosen at dawn (so the red route arrows show it all day)
// and sent through the night queue like the old waves. At dawn the survivors go back to sleep, and every horde regrows
// a little. Deterministic: its own Rng streams (the spot pick, each dawn's march roll).
import { Rng, hashSeed } from './rng.js';
import { HORDES } from '../content/hordes.js';
import { N, PASSABLE, idx, inside } from './mapgen.js';

export function createHordes(G) {
  const { S, map, c, seed, ev, toast } = G;
  const H = () => S.hordes;
  const ok = (x, y) => { const i = idx(Math.floor(x), Math.floor(y)); return inside(Math.floor(x), Math.floor(y)) && PASSABLE[map.terrain[i]] && map.reach[i] && S.occ[i] < 0; };
  function pickSpots() {
    const rng = new Rng(hashSeed(seed, map.seed, 'hordes')), cand = [], A = map.area;
    for (const s of A.sites) cand.push({ x: s.door ? s.door.x : s.x, y: s.door ? s.door.y : s.y, why: 'site', name: s.label ? `the ${s.label === 'hollowmere' ? 'station' : s.label}` : s.kind });   // Oct 26: the building's own name (the town hall, not 'police') if (A.nest) cand.push({ ...A.nest, why: 'nest', name: 'the nest' }); rng.shuffle(A.homes.slice()).slice(0, 40).forEach(h => cand.push({ x: h.x, y: h.y, why: 'street', name: h.name.replace(/^an? (house|shop|burnt-out house) on /, '') }));
    const keep = [];
    for (const p of cand) { if (keep.length >= HORDES.count) break; if (Math.hypot(p.x - c, p.y - c) < HORDES.minD || !ok(p.x, p.y) || keep.some(q => Math.hypot(q.x - p.x, q.y - p.y) < HORDES.gap)) continue; keep.push(p); }
    return keep.map((p, id) => ({ id, x: p.x, y: p.y, why: p.why, name: p.name, far: Math.hypot(p.x - c, p.y - c), dead: HORDES.size(1, Math.hypot(p.x - c, p.y - c)), awake: [], edge: -1 }));
  }
  // where a march sets off: its spot, or (a far horde) the open ground HORDES.marchFrom from the camp on the way from it,
  // so a march arrives within the night (Oct 26: Hollowmere's far hordes walked all night and never reached the camp)
  function entry(h) {
    const d = Math.hypot(h.x - c, h.y - c); if (d <= HORDES.marchFrom) return { x: h.x, y: h.y };
    const x0 = c + (h.x - c) * HORDES.marchFrom / d, y0 = c + (h.y - c) * HORDES.marchFrom / d;
    for (let r = 0; r <= 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = Math.floor(x0) + dx + 0.5, y = Math.floor(y0) + dy + 0.5; if (ok(x, y)) return { x, y }; }
    return { x: h.x, y: h.y };
  }
  function setup() {
    if (S.hordes) return;
    S.hordes = { spots: pickSpots(), plan: {}, broken: 0 };
    for (const h of H().spots) { const e = entry(h); h.edge = G.edgeSpawns.length; G.edgeSpawns.push({ x: e.x, y: e.y, horde: h.id }); }   // a marching horde enters the night queue like an old front
    planMarch();
  }
  const dir = h => { const a = Math.atan2(h.y - c, h.x - c), w = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']; return w[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; };
  // the marches for the coming night, picked at dawn from their own stream: HORDES.marches(n) of the live hordes
  // (Oct 26: a fixed escalation, no more coin flips: none on night 1, two on night 6)
  function planMarch() {
    const n = S.night, rng = new Rng(hashSeed(seed, 'march', n)), live = rng.shuffle(H().spots.filter(h => h.dead > 0).slice()), k = Math.min(live.length, HORDES.marches(n));
    H().plan[n] = k ? live[0].id : -1; (H().plan2 || (H().plan2 = {}))[n] = k > 1 ? live[1].id : -1;
    for (const h of live.slice(0, k)) if (n >= 2) toast(`[Horde] The dead at ${h.name} are restless. Tonight they may come for the camp, from the ${dir(h)}.`, 'bad');
  }
  const marching = (n, id) => id >= 0 && (H().plan[n] === id || (H().plan2 && H().plan2[n] === id));
  const pickKind = (n, rng) => { const K = HORDES.kinds(n), i = rng.weighted(K.map(k => k[1])); return K[i][0]; };
  // dusk (makeWave asks for the night queue): the marching horde goes in the queue, the others wake round their spots
  function v2Wave(n) {
    setup();
    const rng = new Rng(hashSeed(seed, 'horde-night', n)), q = [];
    let woke = 0; const wake = HORDES.awake(n);
    for (const h of H().spots) {
      h.dead = Math.max(h.dead, 0);
      if (marching(n, h.id)) {   // a march is at least HORDES.marchSize(n), Brutes at its head from night 5
        const extra = Math.round(G.defenceDps() * HORDES.press / 3 * (HORDES.marches(n) > 1 ? 0.6 : 1));   // the camp's guns call a bigger march (Oct 26)
        const size = Math.max(h.dead, HORDES.marchSize(n) + extra), big = HORDES.brutes(n), t0 = q.length ? 6 : 2;
        for (let k = 0; k < size; k++) q.push({ kind: k < big ? 'brute' : pickKind(n, rng), nest: -1 - h.edge, t: t0 + k * HORDES.spacing, horde: h.id });
        h.dead = size; ev('hordeMarch', { horde: h.id, x: h.x, y: h.y, n: size }); toast(`[Horde] The dead at ${h.name} are coming for the camp, from the ${dir(h)}.`, 'bad'); h.marched = true; continue;
      }
      h.awake = [];
      if (!h.dead || woke >= wake) continue;   // the rest sleep on tonight
      woke++;
      for (let k = 0; k < h.dead; k++) { const m = G.spawnMob(pickKind(n, rng), h.x + rng.range(-2.5, 2.5), h.y + rng.range(-2.5, 2.5), { instant: true }); m.roam = { x: h.x, y: h.y, region: -1 }; m.horde = h.id; h.awake.push(m.id); }
      ev('hordeWake', { horde: h.id, x: h.x, y: h.y, n: h.dead });
    }
    q.sort((a, b) => a.t - b.t);
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
  const hordeMarch = n => { const st = H(); if (!st) return []; return [st.plan[n], st.plan2 ? st.plan2[n] : -1].filter(id => id >= 0 && st.spots[id] && st.spots[id].dead).map(id => { const h = st.spots[id]; return { nest: -1 - h.edge, x: h.x, y: h.y, count: Math.max(h.dead, HORDES.marchSize(n)) }; }); };
  return { v2Wave, stepHordes, hordeMarch, hordes: () => H() };
}
