// Plane geometry in metres: oriented boxes, segments, polylines. Shared by stages,
// validators, the nav grid and the renderer so they all agree on what "overlap" means.

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Oriented box: centre (x,y), width w along angle rot, depth h across it.
// The hot paths below allocate nothing; their float operations match the plain forms term for term, so results are
// identical (the existing recipes' hashes are pinned by a test).
const SX = [-1, 1, 1, -1], SY = [-1, -1, 1, 1];
export function obbCorners(o) {
  const c = Math.cos(o.rot), s = Math.sin(o.rot), hw = o.w / 2, hh = o.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: o.x + x * c - y * s, y: o.y + x * s + y * c }));
}
export function obbBox(o, pad = 0) {
  const c = Math.cos(o.rot), s = Math.sin(o.rot), hw = o.w / 2, hh = o.h / 2; let a = 1e9, b = 1e9, cc = -1e9, d = -1e9;
  for (let k = 0; k < 4; k++) { const x = SX[k] * hw, y = SY[k] * hh, qx = o.x + x * c - y * s, qy = o.y + x * s + y * c; a = Math.min(a, qx); b = Math.min(b, qy); cc = Math.max(cc, qx); d = Math.max(d, qy); }
  return [a - pad, b - pad, cc + pad, d + pad];
}
export function toLocal(o, x, y) { const c = Math.cos(-o.rot), s = Math.sin(-o.rot), dx = x - o.x, dy = y - o.y; return { x: dx * c - dy * s, y: dx * s + dy * c }; }
export function toWorld(o, lx, ly) { const c = Math.cos(o.rot), s = Math.sin(o.rot); return { x: o.x + lx * c - ly * s, y: o.y + lx * s + ly * c }; }
export function pointInObb(o, x, y, pad = 0) { const c = Math.cos(-o.rot), s = Math.sin(-o.rot), dx = x - o.x, dy = y - o.y; return Math.abs(dx * c - dy * s) <= o.w / 2 + pad && Math.abs(dx * s + dy * c) <= o.h / 2 + pad; }

// Separating-axis test for two oriented boxes; pad grows both (a gap requirement).
const PA = new Float64Array(8), PB = new Float64Array(8);
const fill = (o, w, h, P) => { const c = Math.cos(o.rot), s = Math.sin(o.rot), hw = w / 2, hh = h / 2; for (let k = 0; k < 4; k++) { const x = SX[k] * hw, y = SY[k] * hh; P[2 * k] = o.x + x * c - y * s; P[2 * k + 1] = o.y + x * s + y * c; } };
export function obbOverlap(a, b, pad = 0) {
  fill(a, a.w + pad, a.h + pad, PA); fill(b, b.w + pad, b.h + pad, PB);
  for (let q = 0; q < 4; q++) {
    const ang = q < 2 ? (q ? a.rot + Math.PI / 2 : a.rot) : (q > 2 ? b.rot + Math.PI / 2 : b.rot), ax = Math.cos(ang), ay = Math.sin(ang);
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < 4; k++) { const u = PA[2 * k] * ax + PA[2 * k + 1] * ay, v = PB[2 * k] * ax + PB[2 * k + 1] * ay; if (u < a0) a0 = u; if (u > a1) a1 = u; if (v < b0) b0 = v; if (v > b1) b1 = v; }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

export function distToSeg(px, py, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, wx = px - a.x, wy = py - a.y;
  const t = clamp((vx * wx + vy * wy) / ((vx * vx + vy * vy) || 1), 0, 1);
  return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
}
export function distToPoly(px, py, pts) { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distToSeg(px, py, pts[i], pts[i + 1])); return m; }

export function segIntersect(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y), t, u } : null;
}

// A straight street piece as an oriented box (for overlap checks), with kerbs included.
export function segBox(a, b, width) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: Math.hypot(b.x - a.x, b.y - a.y), h: width, rot: Math.atan2(b.y - a.y, b.x - a.x) }; }

export function catmull(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push({ x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                 y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Smooth value noise from an rng-built table (deterministic per seed).
export function makeNoise(rng) {
  const p = []; for (let i = 0; i < 256; i++) p[i] = i; rng.shuffle(p);
  const Q = new Uint8Array(512); for (let i = 0; i < 512; i++) Q[i] = p[i & 255];
  const sm = t => t * t * (3 - 2 * t), gv = (ix, iy) => Q[(Q[ix & 255] + iy) & 255] / 255;
  return (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); const a = gv(x0, y0), b = gv(x0 + 1, y0), c = gv(x0, y0 + 1), d = gv(x0 + 1, y0 + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
