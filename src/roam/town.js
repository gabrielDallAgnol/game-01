// [roam] The town, once: the engine builds Hollowmere (recipe hollowmere), and this paints what the ground shader reads
// (the flat town, roofs as slopes, streets with their direction, trees, shadows, water, the lit houses at night), the
// walls feet cannot cross (2 cells a metre), and where the nests are. Everything is in engine metres: x east, y south.
/* global THREE */
import { RECIPES, recipeRegistry, buildArea } from '../engine/recipes.js';
import { paintWorld, SUN } from '../engine/draw2d.js';
import { pointInObb } from '../engine/geom.js';

export function buildTown(seed = 7) {
  const W = buildArea('hollowmere', seed, recipeRegistry('hollowmere'), RECIPES.hollowmere.game).W;
  const rigAtom = W.placed.find(p => p.def.tags.includes('camp.rig'));
  const start = { x: W.camp.x, y: W.camp.y };
  const SPAN = Math.ceil(Math.max(W.w, W.h) + 20), O = { x: -10, y: -10 }, PX = 4, MPX = 4, RES = SPAN * PX;
  const placed = W.placed.filter(p => p !== rigAtom && !p.def.tags.includes('camp'));   // no base in roam: the square is open
  const buildings = placed.filter(p => p.def.kind === 'building');
  const trees = placed.filter(p => p.def.look === 'tree');
  const cars = placed.filter(p => p.def.tags.includes('car') || p.def.tags.includes('railcar'));
  const canvas = (px, bg) => { const c = document.createElement('canvas'); c.width = c.height = SPAN * px; const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); } x.setTransform(px, 0, 0, px, -O.x * px, -O.y * px); return [c, x]; };
  const obb = (x, p, pad) => { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillRect(-p.w / 2 - pad, -p.h / 2 - pad, p.w + 2 * pad, p.h + 2 * pad); x.restore(); };
  const ang = a => { a %= Math.PI; if (a < 0) a += Math.PI; return Math.round(a / Math.PI * 255); };
  // the flat town (ground and roofs in one picture), and its overhead layer alone
  const [gC, gX] = canvas(PX), [oC, oX] = canvas(PX), R = { x0: O.x, y0: O.y, x1: O.x + SPAN, y1: O.y + SPAN };
  paintWorld(gX, oX, { ...W, placed }, 'ch1', R);
  gX.setTransform(1, 0, 0, 1, 0, 0); gX.drawImage(oC, 0, 0);
  const [mC, mX] = canvas(PX); mX.fillStyle = '#fff'; for (const p of cars) obb(mX, p, 0.25);
  // roofs (rgb = downslope angle, lit side, gable; a = roof), streets (r angle, g kind, b inward; a street), misc (r crown, g lane marks, b shadow)
  const [rC, rX] = canvas(MPX), [sC, sX] = canvas(MPX), [xC, xX] = canvas(MPX, '#000'), [hC, hX] = canvas(MPX, '#000');
  xX.globalCompositeOperation = 'lighter';
  for (const p of buildings) { const h = (p.def.height || 6) * 0.38, dx = -SUN.x * h, dy = -SUN.y * h * 0.8; xX.fillStyle = 'rgb(0,0,255)'; for (let k = 1; k <= 8; k++) obb(xX, { ...p, x: p.x + dx * k / 8, y: p.y + dy * k / 8 }, 0); }
  for (const p of trees) { const r = (p.r || p.def.size[0] / 2) * 0.86; xX.fillStyle = 'rgb(0,0,140)'; xX.beginPath(); xX.arc(p.x + 1.1, p.y + 1.5, r, 0, 7); xX.fill(); xX.fillStyle = 'rgb(255,0,0)'; xX.beginPath(); xX.arc(p.x, p.y, r, 0, 7); xX.fill(); }
  for (const wt of W.water || []) { xX.strokeStyle = 'rgb(0,255,0)'; xX.lineWidth = wt.w || 6; xX.beginPath(); wt.pts.forEach((q, i) => i ? xX.lineTo(q.x, q.y) : xX.moveTo(q.x, q.y)); xX.stroke(); }
  for (const p of buildings) {
    rX.save(); rX.translate(p.x, p.y); rX.rotate(p.rot);
    if (p.def.look === 'gable' || p.def.look === 'church') for (const side of [-1, 1]) { const nx = -Math.sin(p.rot) * side, ny = Math.cos(p.rot) * side, lit = nx * SUN.x + ny * SUN.y > 0; rX.fillStyle = `rgb(${ang(p.rot + Math.PI / 2)},${lit ? 255 : 0},255)`; rX.fillRect(-p.w / 2, side < 0 ? -p.h / 2 : 0, p.w, p.h / 2); }
    else { rX.fillStyle = `rgb(${ang(p.rot)},150,0)`; rX.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
    rX.restore();
  }
  sX.lineCap = 'round';
  if (W.plaza) { const P = W.plaza; for (const [inset, lvl] of [[0, 80], [1.5, 255]]) { sX.save(); sX.translate(P.x, P.y); sX.rotate(P.rot); sX.fillStyle = `rgb(${ang(P.rot)},200,${lvl})`; sX.fillRect(-P.w / 2 + inset, -P.h / 2 + inset, P.w - 2 * inset, P.h - 2 * inset); sX.restore(); } }
  for (const [inset, lvl] of [[0, 80], [1.5, 170], [3.2, 255]]) for (const st of W.streets) for (let i = 0; i < st.pts.length - 1; i++) { const a = st.pts[i], b = st.pts[i + 1], w = st.w - 2 * inset; if (w <= 0.4) continue; sX.strokeStyle = `rgb(${ang(Math.atan2(b.y - a.y, b.x - a.x))},${st.kind === 'path' ? 90 : 255},${lvl})`; sX.lineWidth = w; sX.beginPath(); sX.moveTo(a.x, a.y); sX.lineTo(b.x, b.y); sX.stroke(); }
  xX.strokeStyle = 'rgb(0,255,0)'; xX.lineWidth = 0.16; xX.setLineDash([3, 4]); for (const st of W.streets) if (st.kind !== 'path' && st.w >= 7) { xX.beginPath(); st.pts.forEach((q, i) => i ? xX.lineTo(q.x, q.y) : xX.moveTo(q.x, q.y)); xX.stroke(); } xX.setLineDash([]);
  hX.globalCompositeOperation = 'lighten';
  for (const p of trees) { const r = (p.r || p.def.size[0] / 2) * 0.86, g = hX.createRadialGradient(p.x - r * 0.15, p.y - r * 0.2, 0, p.x, p.y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#bbb'); g.addColorStop(1, '#000'); hX.fillStyle = g; hX.beginPath(); hX.arc(p.x, p.y, r, 0, 7); hX.fill(); }
  // the night: no street lamps (the power died in the Ashfall); one house in five has someone hiding in it
  const [lC, lX] = canvas(MPX, '#000'); lX.globalCompositeOperation = 'lighter';
  const hashL = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const spill = (x, y, nx, ny, w, len, a) => { lX.save(); lX.translate(x, y); lX.rotate(Math.atan2(ny, nx)); const g = lX.createRadialGradient(0, 0, 0, 0, 0, len); g.addColorStop(0, `rgba(255,0,0,${a})`); g.addColorStop(0.5, `rgba(255,0,0,${a * 0.35})`); g.addColorStop(1, 'rgba(255,0,0,0)'); lX.fillStyle = g; lX.beginPath(); lX.moveTo(0, -w / 2); lX.lineTo(len, -w * 0.9); lX.lineTo(len, w * 0.9); lX.lineTo(0, w / 2); lX.closePath(); lX.fill(); lX.restore(); };
  for (const p of buildings) { if (!p.def.light || hashL(p.uid + W.seed * 31) >= 0.2) continue;
    lX.fillStyle = 'rgba(0,255,0,1)'; obb(lX, p, 0); const c = Math.cos(p.rot), sn = Math.sin(p.rot), n = Math.max(1, Math.floor(p.w / 5));
    for (const side of [-1, 1]) for (let k = 0; k < n; k++) { if (hashL(p.uid * 7 + k * 3 + side) < 0.45) continue; const lx = -p.w / 2 + (k + 0.5) * p.w / n, ly = side * p.h / 2; spill(p.x + lx * c - ly * sn, p.y + lx * sn + ly * c, -sn * side, c * side, 1.2, 3.2, 0.9); }
    if (p.door && hashL(p.uid * 13) < 0.4) { const dx = p.door.x - p.x, dy = p.door.y - p.y, r = Math.hypot(dx, dy) || 1; spill(p.door.x, p.door.y, dx / r, dy / r, 1.1, 4.0, 1.0); } }
  // walls: buildings and the edge of the town
  const GR = 2, GN = SPAN * GR, solid = new Uint8Array(GN * GN);
  const mark = (p, pad) => { const r = Math.hypot(p.w, p.h) / 2 + pad + 0.5, gx0 = Math.max(0, Math.floor((p.x - r - O.x) * GR)), gx1 = Math.min(GN - 1, Math.ceil((p.x + r - O.x) * GR)), gy0 = Math.max(0, Math.floor((p.y - r - O.y) * GR)), gy1 = Math.min(GN - 1, Math.ceil((p.y + r - O.y) * GR));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) if (pointInObb(p, O.x + (gx + 0.5) / GR, O.y + (gy + 0.5) / GR, pad)) solid[gy * GN + gx] = 1; };
  for (const p of buildings) mark(p, 0.15);
  const blocked = (x, y) => { if (x < 2 || y < 2 || x > W.w - 2 || y > W.h - 2) return true; const gx = Math.floor((x - O.x) * GR), gy = Math.floor((y - O.y) * GR); return gx < 0 || gy < 0 || gx >= GN || gy >= GN || solid[gy * GN + gx] === 1; };
  // where on a street: for spawning the dead and parking the bike (a street cell, 1 m grid)
  const streetCells = []; { const d = sX.getImageData(0, 0, sC.width, sC.height).data; for (let y = 4; y < W.h - 4; y += 2) for (let x = 4; x < W.w - 4; x += 2) { const i = (Math.floor((y - O.y) * MPX) * sC.width + Math.floor((x - O.x) * MPX)) * 4; if (d[i + 3] > 128 && !blocked(x, y)) streetCells.push(x, y); } }
  // the nests: infested and nestable buildings first, then the biggest houses, spread across the town
  const cand = buildings.filter(p => p.def.tags.includes('infested') || p.def.tags.includes('nestable')).concat(buildings.slice().sort((a, b) => b.w * b.h - a.w * a.h));
  const nests = [];
  for (const p of cand) { if (nests.length >= 9) break; if (Math.hypot(p.x - start.x, p.y - start.y) < 70 || nests.some(q => Math.hypot(q.b.x - p.x, q.b.y - p.y) < 80)) continue;
    let at = p.door || { x: p.x, y: p.y + p.h / 2 + 1.5 }; for (let k = 0; k < 12 && blocked(at.x, at.y); k++) at = { x: at.x + (at.x - p.x) * 0.15, y: at.y + (at.y - p.y) * 0.15 };
    if (!blocked(at.x, at.y)) nests.push({ b: p, x: at.x, y: at.y }); }
  return { W, start, SPAN, O, PX, MPX, canvases: { gC, oC, mC, rC, sC, xC, hC, lC }, blocked, streetCells, nests, buildings, trees, cars };
}
