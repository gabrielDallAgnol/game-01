// Stage: lots. Splits blocks into lots that face a street (residential), lays commercial
// frontage along Route 9 and one industrial lot for Depot 9. Every lot uses the same frame:
// x along the street, +y away from it, so the front edge is always local y = -h/2.
import { STREET, LOT } from '../units.js';
import { toWorld, segIntersect, obbCorners } from '../geom.js';

const tangentAt = (pts, x) => { let k = 0; while (k < pts.length - 2 && pts[k + 1].x < x) k++; const a = pts[k], b = pts[k + 1], t = (x - a.x) / ((b.x - a.x) || 1); return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, ang: Math.atan2(b.y - a.y, b.x - a.x) }; };

export const lotsStage = {
  name: 'lots',
  run(W, seed) {
    const rng = seed.rng(), g = W.grid, hs = STREET.local / 2 + STREET.kerb;
    // residential: two rows per block, each row faces its own street
    for (let i = 0; i < g.ncol - 1; i++) for (let j = 0; j < g.nrow - 1; j++) {
      const x0 = g.lx(i) + hs, x1 = g.lx(i + 1) - hs, y0 = g.ly(j) + hs, y1 = g.ly(j + 1) - hs;
      const n = Math.max(1, Math.floor((x1 - x0) / LOT.width)), lw = (x1 - x0) / n, ld = (y1 - y0) / 2;
      for (const row of [0, 1]) for (let k = 0; k < n; k++) {
        const cx = x0 + lw * (k + 0.5), cy = row === 0 ? y0 + ld / 2 : y1 - ld / 2;
        const street = row === 0 ? `h:${i},${j}` : `h:${i},${j + 1}`;
        const c = g.toW(cx, cy), rot = g.ang + (row === 0 ? 0 : Math.PI);
        W.lots.push({ id: `res:${i},${j},${row},${k}`, kind: g.has(street) ? 'residential' : 'park', street: g.has(street) ? street : null, x: c.x, y: c.y, w: lw - 0.4, h: ld - 0.4, rot, block: `${i},${j}` });
      }
    }
    // commercial frontage on the south side of Route 9, east of the camp, west of the creek
    const r9 = W.streets.find(s => s.id === 'r9'), creek = W.water[0];
    let x = W.w * 0.36;
    const widths = [22, 26, 34];
    while (x < W.w * 0.8) {
      const lw = rng.pick(widths), depth = 30, { p, ang } = tangentAt(r9.pts, x + lw / 2);
      const off = STREET.highway / 2 + 1.5 + depth / 2, nx = -Math.sin(ang), ny = Math.cos(ang);
      const lot = { id: `com:${Math.round(x)}`, kind: 'commercial', street: 'r9', x: p.x + nx * off, y: p.y + ny * off, w: lw - 0.6, h: depth, rot: ang };
      const crossesCreek = obbCorners(lot).some((q, i, arr) => { const r = arr[(i + 1) % 4]; for (let k = 0; k < creek.pts.length - 1; k++) if (segIntersect(q, r, creek.pts[k], creek.pts[k + 1])) return true; return false; });
      if (!crossesCreek && lot.y + depth / 2 < W.h - 4) W.lots.push(lot);
      x += lw + rng.range(2, 6);
    }
    // industrial: Depot 9 near the west end, south of the highway
    { const { p, ang } = tangentAt(r9.pts, W.w * 0.2), depth = 44, off = STREET.highway / 2 + 1.5 + depth / 2;
      W.lots.push({ id: 'ind:depot9', kind: 'industrial', street: 'r9', x: p.x - Math.sin(ang) * off, y: p.y + Math.cos(ang) * off, w: 52, h: depth, rot: ang }); }
    // the camp clearing, north of the highway in the west
    { const { p } = tangentAt(r9.pts, W.campHint.x); W.camp = { x: p.x, y: p.y - W.campHint.yAbove, r: 14 }; }
    W.lotFront = l => ({ a: toWorld(l, -l.w / 2, -l.h / 2), b: toWorld(l, l.w / 2, -l.h / 2) });
    W.note('lots', `${W.lots.filter(l => l.kind === 'residential').length} residential, ${W.lots.filter(l => l.kind === 'commercial').length} commercial, ${W.lots.filter(l => l.kind === 'park').length} park`);
  },
};
