// [roam] The country round the town, laid out without AI: what claims the ground (a coarse 4 m map of roads, sites,
// towns, water, woods and fields, so nothing overlaps), the fields round a farm (a grid turned to the farm's lane, cells
// 80–250 m a side, split where a road or a wood cuts through, hedge gaps between them), the woods (trees on a jittered
// grid inside a polygon) and the hedgerows (tree lines along some field edges). Deterministic: everything is a hash of
// the seed and the place.
import { segDist, inPoly } from './net.js';

const mixh = (n, v) => { n = Math.imul(n ^ (Math.round(v * 977) | 0), 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return n ^ (n >>> 16); };
export const hash = (a, b = 0, c = 0, d = 0) => (mixh(mixh(mixh(mixh(0x2545f491, a), b), c), d) >>> 0) / 4294967296;
export const CLAIM = { free: 0, hard: 1, field: 2, woods: 3, water: 4 };

/** the claim map: G metres a cell over w × h; mark shapes, ask what is there */
export function makeClaim(w, h, G = 4) {
  const nx = Math.ceil(w / G), ny = Math.ceil(h / G), m = new Uint8Array(nx * ny);
  const at = (x, y) => { const i = Math.floor(x / G), j = Math.floor(y / G); return i < 0 || j < 0 || i >= nx || j >= ny ? CLAIM.hard : m[j * nx + i]; };
  const box = (x0, y0, x1, y1, f) => { for (let j = Math.max(0, Math.floor(y0 / G)); j <= Math.min(ny - 1, Math.floor(y1 / G)); j++) for (let i = Math.max(0, Math.floor(x0 / G)); i <= Math.min(nx - 1, Math.floor(x1 / G)); i++) f(i, j, (i + 0.5) * G, (j + 0.5) * G); };
  const put = (i, j, v) => { const k = j * nx + i; if (m[k] === CLAIM.hard) return; m[k] = v; };
  return { G, nx, ny, m, at,
    line(pts, r, v = CLAIM.hard) { for (let s = 1; s < pts.length; s++) { const a = pts[s - 1], b = pts[s];
      box(Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, (i, j, x, y) => { if (segDist(x, y, a.x, a.y, b.x, b.y) < r) put(i, j, v); }); } },
    poly(P, v, pad = 0) { const xs = P.map(p => p.x), ys = P.map(p => p.y); box(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad, (i, j, x, y) => { if (inPoly(x, y, P) || (pad && P.some((p, k) => { const q = P[(k + 1) % P.length]; return segDist(x, y, p.x, p.y, q.x, q.y) < pad; }))) put(i, j, v); }); },
    rect(x0, y0, x1, y1, v = CLAIM.hard) { box(x0, y0, x1, y1, (i, j) => put(i, j, v)); },
    obb(o, pad, v = CLAIM.hard) { const P = obbPoly(o, pad); this.poly(P, v); },
    /** how much of a polygon's area is taken (0..1), sampled on the map's cells */
    taken(P) { const xs = P.map(p => p.x), ys = P.map(p => p.y); let n = 0, t = 0; box(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (i, j, x, y) => { if (!inPoly(x, y, P)) return; n++; if (m[j * nx + i]) t++; }); return n ? t / n : 1; },
  };
}
export const obbPoly = (o, pad = 0) => { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), hw = o.w / 2 + pad, hh = o.h / 2 + pad;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => ({ x: o.x + u * c - v * s, y: o.y + u * s + v * c })); };

const CROPS = [['wheat', 0.27], ['barley', 0.2], ['rape', 0.13], ['plough', 0.13], ['stubble', 0.13], ['pasture', 0.08], ['meadow', 0.06]];
const crop = h => { for (const [k, p] of CROPS) { if (h < p) return k; h -= p; } return 'wheat'; };

/** fields round (cx, cy) out to R m, the grid turned to `ang` (the farm's lane); wet(x, y): near water (meadow there) */
export function fieldsAround({ cx, cy, R, ang, seed, claim, salt = 0, wet = () => false, home = 140 }) {
  const out = [], c = Math.cos(ang), s = Math.sin(ang), toW = (u, v) => ({ x: cx + u * c - v * s, y: cy + u * s + v * c }), GAP = 3;
  const tryRect = (u0, v0, u1, v1, depth) => { if (u1 - u0 < 72 || v1 - v0 < 72) return;   // no slivers: a field is at least ~65 m a side
    const P = [toW(u0 + GAP, v0 + GAP), toW(u1 - GAP, v0 + GAP), toW(u1 - GAP, v1 - GAP), toW(u0 + GAP, v1 - GAP)];
    const t = claim.taken(P);
    if (t === 0) { const m = toW((u0 + u1) / 2, (v0 + v1) / 2), d = Math.hypot(m.x - cx, m.y - cy), h = hash(seed, m.x, m.y, 11 + salt);
      const kind = wet(m.x, m.y) && h < 0.7 ? 'meadow' : d < home && h < 0.55 ? 'pasture' : crop(hash(seed, m.x, m.y, 12 + salt));
      const along = (u1 - u0) >= (v1 - v0), dir = hash(seed, m.x, m.y, 13) < 0.78 === along ? ang : ang + Math.PI / 2;   // rows mostly along the long edge
      out.push({ kind, poly: P, dir: ((dir % Math.PI) + Math.PI) % Math.PI, u: [u0, v0, u1, v1], frame: { cx, cy, ang } });
      claim.poly(P, CLAIM.field); return; }
    if (t > 0.9 || depth > 3) return;
    const du = u1 - u0, dv = v1 - v0, k = 0.38 + hash(seed, u0, v0, depth + 20 + salt) * 0.24;
    if (du >= dv && du > 150) { const m = u0 + du * k; tryRect(u0, v0, m, v1, depth + 1); tryRect(m, v0, u1, v1, depth + 1); }
    else if (dv > 150) { const m = v0 + dv * k; tryRect(u0, v0, u1, m, depth + 1); tryRect(u0, m, u1, v1, depth + 1); }
    else if (du > 90 && dv > 90 && t < 0.4) {   // small and nicked: try it shrunk away from the corner that is taken
      for (const [a, b, e, f] of [[u0 + du * 0.3, v0, u1, v1], [u0, v0, u1 - du * 0.3, v1], [u0, v0 + dv * 0.3, u1, v1], [u0, v0, u1, v1 - dv * 0.3]]) {
        const Q = [toW(a + GAP, b + GAP), toW(e - GAP, b + GAP), toW(e - GAP, f - GAP), toW(a + GAP, f - GAP)]; if (claim.taken(Q) === 0) { tryRect(a, b, e, f, 9); return; } } } };
  // rows of varying depth, each with its own column breaks, so the hedges do not line up like a chessboard
  for (let v = -R, row = 0; v < R; row++) { const dv = 90 + hash(seed, row, salt, 1) * 140, v1 = Math.min(R, v + dv);
    for (let u = -R + (hash(seed, row, salt, 2) - 0.5) * 80, col = 0; u < R; col++) { const du = 95 + hash(seed, row, col, 3 + salt) * 155, u1 = u + du;
      const m = toW((u + u1) / 2, (v + v1) / 2); if (Math.hypot(m.x - cx, m.y - cy) < R * (0.85 + hash(seed, row, col, 4) * 0.3)) tryRect(u, v, u1, v1, 0); u = u1; }
    v = v1; }
  return out;
}

/** trees on a jittered grid inside P (step m apart), where the claim map says `ok` */
export function woodsIn(P, { step = 8, seed, salt = 0, ok, gaps = 0.14 }) {
  const xs = P.map(p => p.x), ys = P.map(p => p.y), out = [];
  for (let y = Math.min(...ys); y < Math.max(...ys); y += step) for (let x = Math.min(...xs); x < Math.max(...xs); x += step) {
    const h = hash(seed, x, y, 31 + salt); if (h < gaps) continue;
    const px = x + (hash(seed, x, y, 32) - 0.5) * step * 0.8, py = y + (hash(seed, x, y, 33) - 0.5) * step * 0.8;
    if (inPoly(px, py, P) && ok(px, py)) out.push({ x: px, y: py, h: hash(seed, x, y, 34) }); }
  return out;
}

/** hedgerow trees: some edges of some fields, in the gap between fields (a line every ~6 m, with holes) */
export function hedgesOf(fields, { seed, ok }) {
  const out = [];
  for (const f of fields) { const [u0, v0, u1, v1] = f.u, { cx, cy, ang } = f.frame, c = Math.cos(ang), s = Math.sin(ang), toW = (u, v) => ({ x: cx + u * c - v * s, y: cy + u * s + v * c });
    const edges = [[u0, v0, u1, v0], [u1, v0, u1, v1], [u0, v1, u1, v1], [u0, v0, u0, v1]];
    edges.forEach(([a, b, e, g], k) => { if (hash(seed, u0 + k, v0 - k, 41) > 0.42) return; const L = Math.hypot(e - a, g - b);
      for (let d = 3; d < L - 3; d += 5 + hash(seed, a + d, b, 42) * 3) { if (hash(seed, a + d, b + k, 43) < 0.18) continue; const p = toW(a + (e - a) * d / L, b + (g - b) * d / L); if (ok(p.x, p.y)) out.push({ x: p.x, y: p.y, h: hash(seed, p.x, p.y, 44) }); } }); }
  return out;
}

/** a rounded blob polygon round (cx, cy): rx, ry, wobble by hash */
export function blob(cx, cy, rx, ry, seed, salt = 0, n = 18, wob = 0.18) { const P = [];
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, r = 1 + (hash(seed, k, salt, 51) - 0.5) * 2 * wob; P.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r }); }
  return P; }
