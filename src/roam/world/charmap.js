// [roam] The world as characters: one char per 2 m cell over the whole world, rasterised from W in plain JS (no canvas):
// the world's readable record (print a patch of it and you can see the plan) and the seed of a far map. Later layers win:
// land, water, trees, streets, the square, buildings.
//   '"' grass   'T' tree   'f' woods floor   't' farm track (earth)   'w' wheat  'b' barley  'r' rape  '%' plough  's' stubble  ',' pasture  'm' meadow
//   '~' water   'L' lot (asphalt)  ':' gravel / yard        '=' road  '.' pavement / path / the square  '+' rail
//   '#' building  '^' a canopy (ridden under)
// makeCharmap(W) → { w, h, cell, codes: Uint8Array (char codes), at(x, y) → char, toText(x0, y0, x1, y1) → string }.
import { profileOf } from './streets.js';

export const CHARS = { grass: '"', tree: 'T', woods: 'f', track: 't', wheat: 'w', barley: 'b', rape: 'r', plough: '%', stubble: 's', pasture: ',', meadow: 'm', water: '~', lot: 'L', gravel: ':', yard: ':', road: '=', pave: '.', rail: '+', building: '#', canopy: '^' };

export function makeCharmap(W, cell = 2) {
  const w = Math.ceil(W.w / cell), h = Math.ceil(W.h / cell), codes = new Uint8Array(w * h).fill(CHARS.grass.charCodeAt(0)), C = k => CHARS[k].charCodeAt(0);
  // every cell whose centre is inside the box and passes test(x, y) gets ch
  const box = (x0, y0, x1, y1, ch, test) => { const i0 = Math.max(0, Math.floor(x0 / cell)), i1 = Math.min(w - 1, Math.floor(x1 / cell)), j0 = Math.max(0, Math.floor(y0 / cell)), j1 = Math.min(h - 1, Math.floor(y1 / cell));
    for (let j = j0; j <= j1; j++) { const y = (j + 0.5) * cell; for (let i = i0; i <= i1; i++) { const x = (i + 0.5) * cell; if (!test || test(x, y)) codes[j * w + i] = ch; } } };
  // a polygon by scanlines (crossings per row), so a big field costs its rows, not its area times its edges
  const poly = (P, ch) => { const ys = P.map(p => p.y), j0 = Math.max(0, Math.floor(Math.min(...ys) / cell)), j1 = Math.min(h - 1, Math.floor(Math.max(...ys) / cell));
    for (let j = j0; j <= j1; j++) { const y = (j + 0.5) * cell, xs = [];
      for (let k = 0, m = P.length - 1; k < P.length; m = k++) { const a = P[k], b = P[m]; if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y)); }
      xs.sort((a, b) => a - b); for (let q = 0; q + 1 < xs.length; q += 2) { const i0 = Math.max(0, Math.ceil(xs[q] / cell - 0.5)), i1 = Math.min(w - 1, Math.floor(xs[q + 1] / cell - 0.5)); for (let i = i0; i <= i1; i++) codes[j * w + i] = ch; } } };
  const seg = (a, b, r, ch) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
    box(Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, ch, (x, y) => { const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)); return Math.hypot(x - a.x - dx * u, y - a.y - dy * u) < r; }); };
  const line = (pts, r, ch) => { for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i], r, ch); };
  const obb = (p, ch) => { const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0), R = Math.hypot(p.w, p.h) / 2;
    box(p.x - R, p.y - R, p.x + R, p.y + R, ch, (x, y) => { const dx = x - p.x, dy = y - p.y; return Math.abs(dx * c + dy * s) <= p.w / 2 && Math.abs(-dx * s + dy * c) <= p.h / 2; }); };
  for (const l of W.land || []) if (CHARS[l.kind]) poly(l.poly, C(l.kind));
  for (const wt of W.water || []) line(wt.pts, (wt.w || 6) / 2, C('water'));
  for (const r of W.rails || []) line(r.pts, 1.6, C('rail'));
  for (const p of W.placed) if (p.def.look === 'tree') { const r = (p.r || p.def.size[0] / 2) * 0.8; box(p.x - r, p.y - r, p.x + r, p.y + r, C('tree'), (x, y) => Math.hypot(x - p.x, y - p.y) < r); }
  // streets: the carriageway '=', a pavement '.' where the kind has one; a path is all '.'
  for (const st of W.streets) { const P = profileOf(st), half = P.width(st) / 2;
    if (st.kind === 'path') { line(st.pts, half, C('pave')); continue; }
    if (st.kind === 'track') { line(st.pts, half, C('track')); continue; }
    if (P.pavement) line(st.pts, half, C('pave')); line(st.pts, P.pavement ? half - 2.4 : half, C('road')); }
  if (W.plaza) obb(W.plaza, C('pave'));
  for (const p of W.placed) if (p.def.kind === 'building') obb(p, p.def.collide === 'none' ? C('canopy') : C('building'));
  const at = (x, y) => { const i = Math.floor(x / cell), j = Math.floor(y / cell); return i < 0 || j < 0 || i >= w || j >= h ? ' ' : String.fromCharCode(codes[j * w + i]); };
  const toText = (x0 = 0, y0 = 0, x1 = W.w, y1 = W.h) => { const i0 = Math.max(0, Math.floor(x0 / cell)), i1 = Math.min(w, Math.ceil(x1 / cell)), j0 = Math.max(0, Math.floor(y0 / cell)), j1 = Math.min(h, Math.ceil(y1 / cell)), rows = [];
    for (let j = j0; j < j1; j++) rows.push(String.fromCharCode.apply(null, codes.subarray(j * w + i0, j * w + i1))); return rows.join('\n'); };
  return { w, h, cell, codes, at, toText };
}
