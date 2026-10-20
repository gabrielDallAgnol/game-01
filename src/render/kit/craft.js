// Hollowmere city kit · Helpers for the player's buildings: bunting, lights, planters, flags, drums, sheets, gables.
/* global THREE */
import { P } from './palette.js';
import { BULB } from './materials.js';
import { rboxGeo } from './builder.js';

// ---------- helpers for the player's buildings: scrap at first, then paint, then pride ----------
const shade = (hex, k) => '#' + new THREE.Color(P[hex] || hex).offsetHSL(0, 0, k).getHexString();
const BLOOM = ['#e8667a', '#ffd166', '#f6efe0', '#f08a3c', '#b47ad6'];
const PEN = (() => { const s = new THREE.Shape(); s.moveTo(-0.17, 0); s.lineTo(0.17, 0); s.lineTo(0, -0.34); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); })();
/** a thin rod from p to q ([x, y, z]) */
function rod(b, mat, p, q, t = 0.03) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], h = Math.hypot(dx, dz), L = Math.hypot(h, dy);
  b.geo(mat, rboxGeo(L, t, t, 0.001), (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, 0, Math.atan2(-dz, dx), Math.atan2(dy, h));
}
function sagPts(p, q, n, sag) { const out = []; for (let k = 0; k <= n; k++) { const t = k / n; out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - Math.sin(t * Math.PI) * sag, p[2] + (q[2] - p[2]) * t]); } return out; }
function cord(b, pts, mat = '#3b3631', t = 0.025) { for (let k = 1; k < pts.length; k++) rod(b, mat, pts[k - 1], pts[k], t); }
/** a string of pennants from p to q */
function bunting(b, p, q, n, sag, cols = BLOOM, s = 1) {
  const pts = sagPts(p, q, n, sag), ry = Math.atan2(-(q[2] - p[2]), q[0] - p[0]); cord(b, pts);
  for (let k = 1; k < pts.length - 1; k++) b.geo(cols[k % cols.length], PEN, pts[k][0], pts[k][1], pts[k][2], 0, ry, 0, s, s, s);
}
/** a string of bulbs that light up at dusk with the windows */
function lights(b, p, q, n, sag, s = 1) { const pts = sagPts(p, q, n, sag); cord(b, pts, '#2e2b28', 0.02); for (let k = 1; k < pts.length - 1; k++) b.sph(BULB, 0.08 * s, pts[k][0], pts[k][1] - 0.07 * s, pts[k][2], { detail: 0 }); }
function blooms(b, x, y, z, w, n, r, dz = 0.15) { for (let k = 0; k < n; k++) b.sph(BLOOM[Math.floor(r() * BLOOM.length)], 0.085 + r() * 0.045, x + (r() - 0.5) * w, y + r() * 0.08, z + (r() - 0.5) * dz, { detail: 0 }); }
/** a window box spilling flowers (front faces +z) */
function windowBox(b, x, y, z, w, r) { b.cbox('#8a5a3a', w, 0.2, 0.28, x, y, z, { r: 0.03 }); b.sph('#5c8a3c', 0.17, x - w / 4, y + 0.14, z, { detail: 0, sx: 1.5 }); b.sph('#4f7d34', 0.16, x + w / 4, y + 0.14, z, { detail: 0, sx: 1.5 }); blooms(b, x, y + 0.26, z + 0.04, w * 0.9, 5, r); }
function planter(b, x, z, s, r, flowers = true, y = 0) { b.box('#8a5a3a', 0.6 * s, 0.45 * s, 0.6 * s, x, y, z, { r: 0.05 }); b.sph(flowers ? '#5c8a3c' : '#56663f', 0.32 * s, x, y + 0.55 * s, z, { detail: 0 }); if (flowers) blooms(b, x, y + 0.75 * s, z, 0.45 * s, 5, r, 0.4 * s); }
/** a pole with a flag flying toward +x (turned by ry) */
function flag(b, x, y, z, h, w, col = 'amber', ry = 0) { b.cyl('#3a3a38', 0.035, 0.045, h, x, y, z, { seg: 6 }); const c = Math.cos(ry), s = Math.sin(ry); b.cbox(col, w, w * 0.62, 0.035, x + c * (w / 2 + 0.04), y + h - w * 0.34, z - s * (w / 2 + 0.04), { r: 0.005, ry }); }
function drum(b, col, x, z, s = 1, y = 0) { b.cyl(col, 0.3 * s, 0.3 * s, 0.9 * s, x, y, z, { seg: 10 }); for (const t of [0.28, 0.6]) b.cyl(shade(col, -0.07), 0.31 * s, 0.31 * s, 0.05 * s, x, y + t * s, z, { seg: 10 }); }
function bagRow(b, x, z, len, rows, ry, r, y0 = 0) { const c = Math.cos(ry), s = Math.sin(ry); for (let y = 0; y < rows; y++) { const off = (y % 2) * 0.3, n = Math.floor((len - off) / 0.6); for (let k = 0; k < n; k++) { const u = -len / 2 + off + 0.3 + k * 0.6; b.box('bag', 0.62, 0.26, 0.4, x + u * c, y0 + y * 0.24, z - u * s, { r: 0.11, ry: ry + (r() - 0.5) * 0.12 }); } } }
/** a corrugated sheet: side 0 faces +z, ±1 faces ±x */
function sheet(b, col, w, h, x, y, z, side = 0) {
  const ridge = shade(col, -0.06), n = Math.max(2, Math.round(w / 0.24));
  if (!side) { b.cbox(col, w, h, 0.03, x, y, z, { r: 0.004 }); for (let k = 0; k < n; k++) b.cbox(ridge, 0.05, h, 0.03, x - w / 2 + (k + 0.5) * w / n, y, z + 0.025, { r: 0.004 }); }
  else { b.cbox(col, 0.03, h, w, x, y, z, { r: 0.004 }); for (let k = 0; k < n; k++) b.cbox(ridge, 0.03, h, 0.05, x + side * 0.025, y, z - w / 2 + (k + 0.5) * w / n, { r: 0.004 }); }
}
/** a gable roof as two slabs (ridge along z) with the gable ends filled in the wall colour */
function gable(b, w, d, H, pitch, roof, wall, o = {}) {
  const ov = o.eave ?? 0.3, run = w / 2 + ov, a = Math.atan2(pitch, run), L = Math.hypot(run, pitch) + 0.08, t = o.t ?? 0.16;
  for (const s of [-1, 1]) b.cbox(roof, L, t, d + (o.over ?? 0.5), s * run / 2, H + pitch / 2 + t / 2 * Math.cos(a), 0, { r: 0.03, rz: -s * a });
  b.cbox(o.ridge || shade(roof, -0.1), 0.24, 0.2, d + (o.over ?? 0.5) + 0.04, 0, H + pitch + 0.08, 0, { r: 0.04 });
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, pitch * (w / 2) / run); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); b.geo(wall, g, 0, H, 0);
  return a;
}

export { shade, PEN, rod, sagPts, cord, bunting, lights, blooms, windowBox, planter, flag, drum, bagRow, sheet, gable };
