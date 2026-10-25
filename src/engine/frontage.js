// Frontage: cutting lots along one side of a street, and finding a free place for a big site. Every lot uses the
// engine's frame (x along the street, +y away from it, front edge at local y = -h/2). Clearance comes from spatial
// hashes of street boxes, rail corridors, lots and solid buildings, so a 600 m town stays fast.
import { toWorld, segBox, obbBox, obbOverlap, obbCorners, dist } from './geom.js';
import { createHash } from './spatial.js';

export function createClearance(W, margin = 2, pad = 1) {   // pad: the gap kept round solid buildings
  const SB = createHash(32), T = createHash(32);
  W.streets.forEach(s => { for (let i = 0; i < s.pts.length - 1; i++) { const b = segBox(s.pts[i], s.pts[i + 1], s.w + 2 * s.walk + 1); SB.add({ s, b }, obbBox(b)); } });
  W.rails.forEach(r => { for (let i = 0; i < r.pts.length - 1; i++) { const b = segBox(r.pts[i], r.pts[i + 1], 4.6 + 6); SB.add({ s: { id: r.id }, b }, obbBox(b)); } });
  const take = o => T.add(o, obbBox(o));
  W.lots.forEach(take); W.placed.forEach(p => { if (p.def.kind === 'building' && p.def.collide !== 'none') T.add({ x: p.x, y: p.y, w: p.w + 2 * pad, h: p.h + 2 * pad, rot: p.rot }, obbBox(p, pad)); });
  const inMap = o => obbCorners(o).every(q => q.x > margin && q.y > margin && q.x < W.w - margin && q.y < W.h - margin);
  const C = {
    take,
    /** true if the box would touch a street other than `sid`, a rail, a lot, a building, the camp or the plaza */
    blocked(o, sid) { if (!inMap(o)) return true; const lb = obbBox(o); return SB.some(lb, ({ s, b }) => s.id !== sid && obbOverlap(o, b, -0.05)) || T.some(lb, q => obbOverlap(o, q, -0.05))
      || (W.camp && dist(o, W.camp) < W.camp.r + 8 + Math.max(o.w, o.h) / 2) || (W.plaza && obbOverlap(o, W.plaza, -0.05)); },
  };
  return C;
}

/** the frame of a lot of size w × h whose front is `u` m along street s on `side` (±1), `front` m off the centreline */
export function lotOn(s, side, u, w, h, front) {
  const [a, b] = s.pts, th = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(th) * side, ny = Math.cos(th) * side, f = front == null ? s.w / 2 + s.walk + 0.3 : front;
  return { x: a.x + Math.cos(th) * u + nx * (f + h / 2), y: a.y + Math.sin(th) * u + ny * (f + h / 2), w, h, rot: side > 0 ? th : th + Math.PI };
}

/** cut lots along a street side; o: { kind, width: [a, b], depth, rng, allow(lot), gap } → the lots made */
export function cutLots(W, C, s, side, o) {
  const [a, b] = s.pts, L = dist(a, b), out = [], gap = o.gap || 0; let u = o.start == null ? 3 : o.start;
  while (u < L - 3) {
    const w = o.rng.range(o.width[0], o.width[1]); if (u + w > L - 2) break;
    const lot = { id: `${o.kind}:${s.id}:${side}:${Math.round(u)}`, kind: o.kind, street: s.id, ...lotOn(s, side, u + w / 2, w - 0.4, o.depth) };
    if (C.blocked(lot, s.id) || (o.allow && !o.allow(lot))) { u += 2; continue; }
    W.lots.push(lot); C.take(lot); out.push(lot); u += w + gap;
  }
  return out;
}

/** slide a w × h site along a street side from fraction t0 (both ways, 2 m steps) until it is clear; null if none */
export function siteOn(W, C, s, side, t0, w, h, allow) {
  const L = dist(s.pts[0], s.pts[1]);
  for (let k = 0; k < L; k += 2) for (const sg of k ? [1, -1] : [1]) { const u = t0 * L + sg * k; if (u < 0 || u > L) continue; const lot = { street: s.id, ...lotOn(s, side, u, w, h) }; if (!C.blocked(lot, s.id) && (!allow || allow(lot))) return lot; }
  return null;
}

