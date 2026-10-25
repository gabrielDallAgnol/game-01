// Stage: town plan. Hollowmere is drawn on Nauen's plan: a round old town inside a ring street (where the wall
// stood) with an inner ring it grew from, the church square in the middle, a long main street from the south gate
// to the station, lanes radiating from the square, a promenade on the old wall line, and outside it the suburbs
// on a clipped grid, the rail line and works to the north, the park east, the barns west and the mast field
// south-west. The stage draws straight pieces and lets network.js make the junctions. It writes W.town (the frame,
// the ring maths and the zone map later stages and the districts read), W.streets, W.nodes, W.rails, W.plaza, W.camp.
import { RAIL } from '../units.js';
import { toWorld, toLocal } from '../geom.js';
import { nodeNetwork, reachableNetwork } from '../network.js';
import { STREET_NAMES, STREET_KINDS, TOWN_NAMES as N } from '../names.js';

const TAU = Math.PI * 2;
const angIn = (a, a0, a1) => { const d = (x) => ((x % TAU) + TAU) % TAU; return d(a - a0) <= d(a1 - a0); };

export const townPlanStage = {
  name: 'townplan',
  run(W, seed) {
    const rng = seed.rng(), P = { rx: 148, ry: 132, inner: 0.66, plaza: [46, 31], belt: 16, rail: 30, ...(W.params.town || {}) };
    const F = { x: W.w / 2 + rng.range(-6, 6), y: W.h * 0.53 + rng.range(-4, 4), rot: rng.range(-0.035, 0.035), w: 0, h: 0 };
    const at = (u, v) => toWorld(F, u, v), loc = (x, y) => toLocal(F, x, y);
    const ph = [rng.range(0, 6), rng.range(0, 6)], wob = th => 1 + 0.035 * (0.6 * Math.sin(3 * th + ph[0]) + 0.4 * Math.sin(5 * th + ph[1]));
    const ell = (th, k) => at(Math.cos(th) * P.rx * k * wob(th), Math.sin(th) * P.ry * k * wob(th));
    const param = (x, y) => { const l = loc(x, y); return Math.atan2(l.y / P.ry, l.x / P.rx); };
    const e = (x, y) => { const l = loc(x, y); return Math.hypot(l.x / P.rx, l.y / P.ry) / wob(Math.atan2(l.y / P.ry, l.x / P.rx)); };
    const [px, py] = P.plaza, kBelt = 1 + P.belt / P.rx, kProm = 1 + P.belt * 0.5 / P.rx;
    // the gates: the main axis is exact (north and south); the lanes wander a little per seed
    const A = { E: rng.range(-0.06, 0.06), SE: 0.72 + rng.range(-0.08, 0.08), S: Math.PI / 2, SW: 2.42 + rng.range(-0.08, 0.08), W: Math.PI + rng.range(-0.06, 0.06), NW: 3.86 + rng.range(-0.08, 0.08), N: Math.PI * 1.5, NE: 5.5 + rng.range(-0.08, 0.08) };
    const gates = Object.values(A).sort((a, b) => a - b);
    const ringAngles = n => { const off = rng.range(0, TAU / n), out = gates.slice(); for (let i = 0; i < n; i++) { const a = (off + i * TAU / n) % TAU; if (gates.every(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) > 0.13)) out.push(a); } return out.sort((a, b) => a - b); };
    // the rail line (north) and the station road beside it, in the town frame
    const vr = (P.rail - F.y) / Math.cos(F.rot), vs = vr + 28, uL = -F.x - 30, uR = W.w - F.x + 30;
    W.rails.push({ id: 'main', name: 'the line', pts: [at(uL, vr), at(uR, vr)], ends: [at(uL + 30, vr), at(uR - 30, vr)], sockets: ['rail.end', 'rail.end'] });
    // zones (what the land outside the streets is for); the districts stage turns them into named polygons
    const M = { x: W.w * 0.17 + rng.range(-4, 4), y: W.h * 0.82 + rng.range(-4, 4) }, look = ell(A.NW - 0.2, 1.25);
    const Z = { park: [-0.5, 0.45, 1.62], barns: [Math.PI - 0.5, Math.PI + 0.42, 1.72], masts: { ...M, r: 84 }, lookout: { ...look, r: 20 }, industry: { u: 40, v: [vs + 4, vs + 100] } };
    const zoneAt = (x, y) => {
      const k = e(x, y); if (k < kBelt) return 'oldtown';
      const l = loc(x, y), th = param(x, y); if (l.y < Z.industry.v[0]) return 'rail';
      if (l.x > Z.industry.u && l.y < Z.industry.v[1]) return 'industry';
      if (Math.hypot(x - M.x, y - M.y) < Z.masts.r) return 'masts';
      if (Math.hypot(x - look.x, y - look.y) < Z.lookout.r) return 'lookout';
      if (k < Z.park[2] && angIn(th, Z.park[0], Z.park[1])) return 'park';
      if (k < Z.barns[2] && angIn(th, Z.barns[0], Z.barns[1])) return 'barns';
      return 'suburb';
    };
    // ---- raw street pieces ----
    const raw = [], add = (a, b, p) => raw.push({ a, b, ...p }), lanes = rng.shuffle(N.lanes.slice()), roads = rng.shuffle(N.roads.slice());
    const OLD = { kind: 'local', marks: 'none' }, ROAD = { kind: 'local', w: 7, walk: 1.8, marks: 'dash', role: 'road', sides: [], lots: true };
    const PATH = { kind: 'path', w: 3, walk: 0, marks: 'none', role: 'path', sides: [] };
    const edgeFrom = (p, d) => { let t = 1e9; if (d.x > 1e-6) t = Math.min(t, (W.w - p.x) / d.x); if (d.x < -1e-6) t = Math.min(t, -p.x / d.x); if (d.y > 1e-6) t = Math.min(t, (W.h - p.y) / d.y); if (d.y < -1e-6) t = Math.min(t, -p.y / d.y); return { x: p.x + d.x * (t + 12), y: p.y + d.y * (t + 12) }; };
    const out = p => { const L = Math.hypot(p.x - F.x, p.y - F.y); return { x: (p.x - F.x) / L, y: (p.y - F.y) / L }; };
    // the church square
    const c = [at(-px, -py), at(px, -py), at(px, py), at(-px, py)], PLAZA = { ...OLD, w: 8, walk: 2.5, role: 'plaza', rowTag: 'row-shop', name: N.plaza };
    for (let i = 0; i < 4; i++) add(c[i], c[(i + 1) % 4], PLAZA);
    // the main axis: south gate → square → north gate → station
    const MAIN = { ...OLD, w: 10, walk: 3, marks: 'dash', role: 'main', rowTag: 'row-shop', name: N.main };
    add(at(0, py), ell(A.S, P.inner), MAIN); add(ell(A.S, P.inner), ell(A.S, 1), MAIN);
    add(at(0, -py), ell(A.N, P.inner), MAIN); add(ell(A.N, P.inner), ell(A.N, 1), MAIN);
    // the inner ring and the ring street (Mauerstraße); the promenade on the old wall line just outside
    const ia = ringAngles(6), ra = ringAngles(14);
    ia.forEach((a, i) => add(ell(a, P.inner), ell(ia[(i + 1) % ia.length], P.inner), { ...OLD, w: 6, walk: 1.5, role: 'inner', rowTag: 'row-home', name: N.inner }));
    ra.forEach((a, i) => add(ell(a, 1), ell(ra[(i + 1) % ra.length], 1), { ...OLD, w: 7, walk: 2, role: 'ring', ring: true, rowTag: 'row-home', name: N.ring }));
    ra.forEach((a, i) => add(ell(a, kProm), ell(ra[(i + 1) % ra.length], kProm), { ...PATH, name: N.path, promenade: true }));
    // lanes: E and W from the square's sides out to the ring gates; the diagonals only from the inner ring outward,
    // so the four blocks round the square stay whole (the town grew outward from the inner ring)
    const LANE = { ...OLD, w: 6, walk: 1.5, role: 'lane', rowTag: 'row-home' };
    [['E', at(px, 0), 'row-shop'], ['W', at(-px, 0)], ['SE', c[2]], ['SW', c[3]], ['NW', c[0]], ['NE', c[1]]].forEach(([g, s, tag], i) => { const L = { ...LANE, rowTag: tag || 'row-home', name: lanes[i % lanes.length], gate: g }; if (g === 'E' || g === 'W') add(s, ell(A[g], P.inner), L); add(ell(A[g], P.inner), ell(A[g], 1), L); });
    // country roads out of the gates
    add(ell(A.S, 1), edgeFrom(ell(A.S, 1), out(at(0, 1e3))), { ...ROAD, w: 9, walk: 2.2, marks: 'double', name: N.south, role: 'south' });
    add(ell(A.N, 1), at(0, vs), { ...ROAD, w: 9, walk: 2.2, name: N.north, role: 'north' });
    add(ell(A.W, 1), edgeFrom(ell(A.W, 1), out(ell(A.W, 1))), { ...ROAD, name: roads[2], role: 'barnroad' });
    { const b0 = Z.barns[0] + 0.06, b1 = Z.barns[1] - 0.06, q = [0, 1, 2, 3, 4].map(i => ell(b0 + (b1 - b0) * i / 4, 1.42)); q.slice(1).forEach((p, i) => add(q[i], p, { ...ROAD, w: 6, walk: 1, marks: 'none', lots: false, name: N.barn, role: 'barnroad' })); }   // the barn lane, an arc outside the wall
    add(ell(A.SE, 1), edgeFrom(ell(A.SE, 1), out(ell(A.SE, 1))), { ...ROAD, name: roads[0] });
    { const g = ell(A.NE, 1), d = out(g), lg = loc(g.x, g.y), dl = loc(g.x + d.x, g.y + d.y), t = (vs - lg.y) / (dl.y - lg.y); add(g, { x: g.x + d.x * t, y: g.y + d.y * t }, { ...ROAD, name: roads[1] }); }
    { const g = ell(A.SW, 1), dx = M.x - g.x, dy = M.y - g.y, L = Math.hypot(dx, dy); add(g, { x: M.x - dx / L * 40, y: M.y - dy / L * 40 }, { ...ROAD, w: 5, walk: 0, marks: 'none', lots: false, name: N.mast, role: 'mastlane' }); }
    add(at(uL, vs), at(uR, vs), { ...ROAD, w: 8, walk: 2, name: N.rail, role: 'railroad' });
    // the park path: from the promenade into the park and once round it
    { const p0 = ell((Z.park[0] + Z.park[1]) / 2, kProm), pc = ell((Z.park[0] + Z.park[1]) / 2, 1.36), r = 20; add(p0, { x: pc.x - r, y: pc.y }, { ...PATH, name: N.park, role: 'parkpath' });
      const q = [0, 1, 2, 3, 4, 5].map(i => ({ x: pc.x + Math.cos(i / 6 * TAU + Math.PI) * r, y: pc.y + Math.sin(i / 6 * TAU + Math.PI) * r * 0.8 })); q.forEach((a, i) => add(a, q[(i + 1) % 6], { ...PATH, name: N.park, role: 'parkpath' })); }
    // the suburb grid: lines in the town frame, kept only where the land is suburb, so they stop at the belt, the park,
    // the barns, the works and the mast field
    const names = rng.shuffle(STREET_NAMES.hollowmere.slice()), kinds = STREET_KINDS.hollowmere; let gn = 0;
    const gridLine = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(L / 2), ok = t => { const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; return x > 8 && y > 8 && x < W.w - 8 && y < W.h - 8 && (zoneAt(x, y) === 'suburb' || (zoneAt(x, y) === 'rail' && loc(x, y).y > vs - 1 && loc(x, y).x < Z.industry.u)) && e(x, y) > kBelt + 4 / P.rx; };   // verticals start on the station road
      let t0 = null; const name = `${names[gn % names.length]}${kinds[gn % 2]}`.toLowerCase(); gn++;
      for (let i = 0; i <= n; i++) { const t = i / n, good = i < n && ok(t); if (good && t0 === null) t0 = t; if (!good && t0 !== null) { if ((t - t0) * L > 36) add({ x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 }, { x: a.x + (b.x - a.x) * (t - 1 / n), y: a.y + (b.y - a.y) * (t - 1 / n) }, { ...ROAD, name, role: 'grid' }); t0 = null; } } };
    for (let k = 1; vs + k * 61 < W.h - F.y; k++) gridLine(at(uL, vs + k * 61), at(uR, vs + k * 61));   // 61 m: two lot rows back to back, 2 × (24 + 5.6), never touch
    for (let i = -3; i <= 3; i++) if (i) gridLine(at(Math.sign(i) * (Math.abs(i) * 100 - 50), vs), at(Math.sign(i) * (Math.abs(i) * 100 - 50), W.h - F.y + 30));
    // ---- junctions, then keep what the square reaches ----
    const all = nodeNetwork(raw, { snap: 3, prefix: 'h' }), pm = at(0, -py), start = all.nodes.reduce((b, n) => Math.hypot(n.x - pm.x, n.y - pm.y) < Math.hypot(b.x - pm.x, b.y - pm.y) ? n : b);
    const net = reachableNetwork(all, start.id);
    W.streets.push(...net.streets); W.nodes.push(...net.nodes);
    // rows: the ring and the square face inward / outward only; every other old-town street has rows both sides
    W.streets.forEach(s => { if (s.sides) return; const [a, b] = s.pts, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, th = Math.atan2(b.y - a.y, b.x - a.x), toC = (-Math.sin(th)) * (F.x - m.x) + Math.cos(th) * (F.y - m.y) > 0 ? 1 : -1;
      s.sides = s.role === 'ring' ? [toC] : s.role === 'plaza' ? [-toC] : [1, -1]; });
    W.plaza = { ...at(0, 0), w: 2 * px - 13, h: 2 * py - 13, rot: F.rot };
    W.camp = { ...at(0, py * 0.3), r: 14 };
    const woods = W.terrain.woods, WB = { park: 0.34, oldtown: -0.14, masts: -0.45, suburb: -0.05, industry: -0.2, lookout: -0.2 };
    W.terrain.woods = (x, y) => woods(x, y) + (WB[zoneAt(x, y)] || 0);
    W.town = { F, at, loc, e, param, ell, P, A, Z, M, vr, vs, kBelt, kProm, zoneAt, hub: start.id, ring: ra.map(a => ell(a, 1)), gauge: RAIL.gauge };
    W.note('townplan', `${raw.length} pieces → ${W.streets.length} streets, ${W.nodes.length} junctions (${net.dropped} unreached dropped); ring ${ra.length} sides`);
  },
};
