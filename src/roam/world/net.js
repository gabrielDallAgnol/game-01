// [roam] The world's road network, from polylines: each road is { name, kind, w, pts, district }; makeNet finds where
// roads cross or touch (segment intersections, endpoints on another road), merges those points into shared nodes (3 m),
// and cuts every road there into engine-shaped streets ({ id, kind, w, walk, pts, ends, district, name }) and nodes
// ({ id, x, y, deg }). A point within 1.5 m of a given outside node (a town's exit) joins that node instead.
// Also the geometry the world's layout needs: smoothing, lengths, a point along a line, offsets, distances.
export const len = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; };
/** the point and unit tangent at arc length s along pts */
export function along(pts, s) { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (s <= L || i === pts.length - 1) { const u = L ? Math.max(0, Math.min(1, s / L)) : 0, tx = L ? (b.x - a.x) / L : 1, ty = L ? (b.y - a.y) / L : 0; return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tx, ty }; } s -= L; }
  return { x: pts[0].x, y: pts[0].y, tx: 1, ty: 0 }; }
/** Chaikin corner-cutting (ends kept), then no segment longer than `max` m */
export function smooth(pts, rounds = 2, max = 14) { let P = pts.map(p => ({ x: p.x, y: p.y }));
  for (let r = 0; r < rounds; r++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1];
      if (i > 0) Q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }); if (i < P.length - 2) Q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 }); }
    Q.push(P[P.length - 1]); P = Q; }
  const out = [P[0]]; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / max); for (let k = 1; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }); }
  return out; }
/** pts offset sideways by off(s) metres (left of travel is +), s the arc length */
export function offset(pts, off) { let s = 0; return pts.map((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, o = off(s); return { x: p.x - (b.y - a.y) / L * o, y: p.y + (b.x - a.x) / L * o }; }); }
export const segDist = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)); return Math.hypot(x - ax - dx * u, y - ay - dy * u); };
export const polyDist = (x, y, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)); return d; };
export const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

export function makeNet(roads, { fixed = [], prefix = 'w' } = {}) {
  const cuts = roads.map(() => []), pts = [];   // pts: every cut point in the world (for merging into nodes)
  const cut = (ri, s, x, y) => { const c = { s, x, y, node: null }; cuts[ri].push(c); pts.push(c); };
  // arc lengths of each road's vertices
  const S = roads.map(r => { const a = [0]; for (let i = 1; i < r.pts.length; i++) a.push(a[i - 1] + Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].y - r.pts[i - 1].y)); return a; });
  roads.forEach((r, ri) => { cut(ri, 0, r.pts[0].x, r.pts[0].y); const L = S[ri][S[ri].length - 1], e = r.pts[r.pts.length - 1]; cut(ri, L, e.x, e.y); });
  // crossings: every segment pair of two different roads (or far-apart parts of one); the ends touching a segment
  const E = 0.02;
  for (let A = 0; A < roads.length; A++) for (let B = A; B < roads.length; B++) { const P = roads[A].pts, Q = roads[B].pts;
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], minx = Math.min(a.x, b.x) - 2, maxx = Math.max(a.x, b.x) + 2, miny = Math.min(a.y, b.y) - 2, maxy = Math.max(a.y, b.y) + 2;
      for (let j = A === B ? i + 2 : 0; j < Q.length - 1; j++) { const c = Q[j], d = Q[j + 1];
        if (Math.max(c.x, d.x) < minx || Math.min(c.x, d.x) > maxx || Math.max(c.y, d.y) < miny || Math.min(c.y, d.y) > maxy) continue;
        const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) continue;
        const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
        const Lp = Math.hypot(rx, ry), Lq = Math.hypot(sx, sy), et = 1.5 / Lp, eu = 1.5 / Lq;
        if (t < -et || t > 1 + et || u < -eu || u > 1 + eu) continue;
        const tt = Math.max(0, Math.min(1, t)), uu = Math.max(0, Math.min(1, u)), x = a.x + rx * tt, y = a.y + ry * tt;
        cut(A, S[A][i] + tt * Lp, x, y); cut(B, S[B][j] + uu * Lq, x, y); } } }
  // merge cut points into nodes (3 m), outside nodes first
  const nodes = [], NG = 8, grid = new Map(), gk = (x, y) => Math.floor(x / NG) * 65536 + Math.floor(y / NG);
  const near = (x, y, r) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const n of grid.get(gk(x + i * NG, y + j * NG)) || []) if (Math.hypot(n.x - x, n.y - y) < r) return n; return null; };
  const addNode = n => { nodes.push(n); const k = gk(n.x, n.y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(n); return n; };
  for (const f of fixed) addNode({ ...f, fixed: true });
  for (const c of pts) c.node = near(c.x, c.y, 3) || addNode({ id: prefix + 'n' + nodes.length, x: c.x, y: c.y, deg: 0 });
  // cut each road at its nodes: one street between consecutive distinct nodes
  const streets = [];
  roads.forEach((r, ri) => { const cs = cuts[ri].sort((a, b) => a.s - b.s), list = [];
    for (const c of cs) if (!list.length || (c.node !== list[list.length - 1].node && c.s - list[list.length - 1].s > 0.5)) list.push(c);
    for (let k = 0; k < list.length - 1; k++) { const c0 = list[k], c1 = list[k + 1], seg = [{ x: c0.node.x, y: c0.node.y }];
      for (let i = 0; i < r.pts.length; i++) if (S[ri][i] > c0.s + 0.5 && S[ri][i] < c1.s - 0.5) seg.push({ x: r.pts[i].x, y: r.pts[i].y });
      seg.push({ x: c1.node.x, y: c1.node.y });
      streets.push({ id: prefix + streets.length, kind: r.kind, w: r.w, walk: 0, marks: r.marks || 'none', role: r.role || r.kind, name: r.name, road: r.name, pts: seg, ends: [c0.node.id, c1.node.id], district: r.district || 'country' });
      c0.node.deg++; c1.node.deg++; } });
  return { streets, nodes: nodes.filter(n => !n.fixed), fixedDeg: new Map(nodes.filter(n => n.fixed).map(n => [n.id, n.deg])) };
}
