// Hollowmere city kit · Player homes: townhouse levels (shack, homestead, proud house).
/* global THREE */
import { WIN, BULB, LANTERN, M } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { rubble } from './city.js';
import { shade, rod, sagPts, cord, lights, blooms, windowBox, planter, flag, drum, bagRow, sheet, gable } from './craft.js';

// ======================================================================
// PLAYER BUILDINGS (warm accent = yours). Each level must read as progress from far away:
// 1 survival (scrap, drab), 2 holding on (repaired, a coat of muted paint), 3 thriving (bright paint, flowers, bunting, lights).
// ======================================================================
/** a home; level 0 = ruin to restore, 1 a scrap shack, 2 a repaired two-storey house, 3 a proud painted townhouse */
function townhouse(o = {}) {
  const lvl = o.level ?? 1, r = rng(o.seed || 21), b = new B();
  if (lvl === 0) {
    const w = o.w || 6.4, d = o.d || 7, fh = 2.9, wall = o.color || 'sand';
    // the ruin you can restore: a burnt-out shell with jagged walls, charred joists and rubble inside
    const jag = (x0, z0, len, axis, hMax, hMin) => {
      const n = Math.round(len / 0.8);
      for (let k = 0; k < n; k++) { const t = -len / 2 + (k + 0.5) * len / n, h = hMin + (hMax - hMin) * Math.pow(r(), 0.7);
        if (axis === 'x') b.box(wall, len / n + 0.02, h, 0.3, x0 + t, 0, z0, { r: 0.03 }); else b.box(wall, 0.3, h, len / n + 0.02, x0, 0, z0 + t, { r: 0.03 }); }
    };
    jag(0, d / 2 - 0.15, w, 'x', fh * 1.9, fh * 0.9); jag(0, -d / 2 + 0.15, w, 'x', fh * 1.3, fh * 0.5);
    jag(-w / 2 + 0.15, 0, d, 'z', fh * 2.0, fh * 1.2); jag(w / 2 - 0.15, 0, d, 'z', fh * 1.1, fh * 0.3);
    for (const x of [-1.6, 1.6]) { b.cbox('soot', 1.1, 1.4, 0.32, x, 1.7, d / 2 - 0.15, { r: 0.01 }); b.cbox('soot', 1.3, 1.0, 0.04, x, 2.9, d / 2 + 0.02, { r: 0.01 }); }
    b.cbox('soot', 1.1, 2.1, 0.32, 0, 1.05, d / 2 - 0.15, { r: 0.01 });
    b.cbox('slab', w - 0.6, 0.22, d * 0.45, 0, fh, -d * 0.25, { r: 0.02, rx: 0.06 });
    for (let k = 0; k < 4; k++) b.cbox(k % 2 ? 'soot' : 'wood2', 0.14, 0.16, d * 0.8, -w / 2 + 1 + k * 1.4, fh * 1.25 + r() * 0.5, (r() - 0.5) * 0.6, { r: 0.02, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.2 });
    rubble(b, 0.5, 0.5, 2.4, 24, r, wall);
    const leaf = [M('olive', { flat: true }), M('olive2', { flat: true })];
    for (let k = 0; k < 14; k++) b.sph(leaf[k % 2], 0.35 + r() * 0.35, -w / 2 - 0.1 + r() * 0.4, r() * fh * 1.4, (r() - 0.5) * d, { detail: 0, sx: 0.4 });
    for (let k = 0; k < 6; k++) b.sph(leaf[k % 2], 0.5 + r() * 0.4, (r() - 0.5) * w * 1.2, 0.2, d / 2 + 0.6 + r(), { detail: 1, sy: 0.6 });
    return b.build();
  }
  const glass = o.game ? WIN : 'glass';
  if (lvl === 1) return shack(o, r, b);
  if (lvl === 2) return homestead(o, r, b, glass);
  return proudHouse(o, r, b, glass);
}
// level 1, survival: one room knocked together from weathered planks and tin, a tarp held down by tyres, boarded windows
function shack(o, r, b) {
  const w = 4.8, d = 5.0, H = 2.55, ox = -0.45, fz = d / 2, WOOD = ['#6f675b', '#7b766c', '#5a5045', '#6a5a48', '#807769'];
  b.box('#6d6a63', w + 0.25, 0.25, d + 0.25, ox, 0, 0, { r: 0.03 });
  b.box('#554b41', w, H, d, ox, 0.25, 0, { r: 0.03 });
  for (let y = 0.42; y < H + 0.2; y += 0.3) {
    b.cbox(WOOD[Math.floor(r() * 5)], w + 0.05, 0.25, 0.05, ox + (r() - 0.5) * 0.12, y, fz + 0.02, { r: 0.005, rz: (r() - 0.5) * 0.04 });
    for (const sx of [-1, 1]) b.cbox(WOOD[Math.floor(r() * 5)], 0.05, 0.25, d + 0.05, ox + sx * (w / 2 + 0.02), y, (r() - 0.5) * 0.12, { r: 0.005, rx: (r() - 0.5) * 0.04 });
  }
  // tin patches
  sheet(b, 'rust', 1.4, 1.5, ox + 1.55, 1.05, fz + 0.06);
  sheet(b, 'metal', 1.8, 1.6, ox + w / 2 + 0.06, 1.15, -0.9, 1);
  sheet(b, '#5f6366', 1.5, 1.3, ox - w / 2 - 0.06, 1.0, 1.0, -1);
  // a boarded window, a scrap door, one dim lantern
  const wx = ox - 1.45;
  b.cbox('#24211e', 0.95, 0.8, 0.04, wx, 1.6, fz + 0.05, { r: 0.004 });
  b.cbox('#8a7356', 1.2, 0.16, 0.04, wx, 1.6, fz + 0.09, { r: 0.005, rz: 0.55 }); b.cbox('#7b6a52', 1.2, 0.16, 0.04, wx, 1.6, fz + 0.12, { r: 0.005, rz: -0.5 });
  b.cbox('#6f675b', 1.15, 0.14, 0.04, wx, 1.25, fz + 0.1, { r: 0.005, rz: 0.06 });
  const dx = ox + 0.15;
  b.cbox('#4a3f35', 0.95, 1.95, 0.06, dx, 1.22, fz + 0.06, { r: 0.01 });
  for (const y of [0.6, 1.9]) b.cbox('#5d5246', 0.98, 0.14, 0.04, dx, y, fz + 0.1, { r: 0.005 });
  b.cbox('#2f2c29', 0.5, 0.05, 0.05, dx + 0.75, 2.4, fz + 0.2, { r: 0.004 });
  b.cbox(LANTERN, 0.15, 0.22, 0.15, dx + 0.95, 2.22, fz + 0.2, { r: 0.02 }); b.cbox('#2f2c29', 0.2, 0.05, 0.2, dx + 0.95, 2.35, fz + 0.2, { r: 0.01 });
  // a patchwork tin roof falling to the front
  const a = 0.16, ry0 = H + 0.25 + 0.48, pw = (w + 0.8) / 3, TIN = ['metal', 'rust', '#5f6366'];
  { const rise = d * Math.tan(a) + 0.05, s = new THREE.Shape(); s.moveTo(-fz, 0); s.lineTo(fz, 0); s.lineTo(fz, rise); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.rotateY(Math.PI / 2); b.geo('#554b41', g, ox - w / 2, H + 0.25, 0); }
  for (let k = 0; k < 3; k++) {
    const col = TIN[(k + Math.floor(r() * 3)) % 3], x = ox - (w + 0.8) / 2 + (k + 0.5) * pw, y = ry0 + k * 0.03;
    b.cbox(col, pw + 0.08, 0.06, d + 0.9, x, y, 0, { r: 0.005, rx: a });
    for (let j = 0; j < 4; j++) b.cbox(shade(col, -0.06), 0.06, 0.05, d + 0.9, x - pw / 2 + (j + 0.5) * pw / 4, y + 0.05, 0, { r: 0.005, rx: a });
  }
  b.cbox('#59625e', 2.2, 0.04, 2.6, ox - 0.8, ry0 + 0.2, -0.6, { r: 0.01, rx: a, rz: 0.04 });
  for (const [x, z] of [[ox - 1.3, -0.3], [ox - 0.3, -1.1]]) b.geo('tyre', new THREE.TorusGeometry(0.3, 0.12, 6, 10), x, ry0 + 0.24 - z * 0.16, z, Math.PI / 2 + a, 0, 0);
  b.cyl('#3a3836', 0.1, 0.1, 1.4, ox + 1.5, H + 0.3, -1.5, { seg: 8 }); b.cyl('#2f2c29', 0.16, 0.16, 0.12, ox + 1.5, H + 1.7, -1.5, { seg: 8 });
  // a tarp lean-to on the side: firewood, a drum, crates
  const lx = ox + w / 2, top = H + 0.15, lo = 1.75, run = 1.45;
  for (const z of [-1.3, 1.3]) b.box('#6a5a48', 0.1, lo, 0.1, lx + run, 0, z, { r: 0.02, rz: (r() - 0.5) * 0.08 });
  b.cbox('#6b6650', Math.hypot(run, top - lo) + 0.15, 0.04, 3.0, lx + run / 2, (top + lo) / 2, 0, { r: 0.01, rz: -Math.atan2(top - lo, run) });
  drum(b, 'rust', lx + 0.55, 0.8);
  b.box('wood2', 0.7, 0.55, 0.6, lx + 0.6, 0, -0.6, { r: 0.03, ry: 0.2 }); b.box('#6f675b', 0.55, 0.45, 0.5, lx + 0.6, 0.55, -0.55, { r: 0.03, ry: -0.3 });
  for (let k = 0; k < 6; k++) b.cyl('#6b5640', 0.09, 0.09, 1.0, lx + 1.0 + (k % 3) * 0.18, 0.1 + Math.floor(k / 3) * 0.17, -1.05, { rx: Math.PI / 2, seg: 6 });
  // sandbags and a drum out front, a tyre against the wall
  bagRow(b, ox + 1.85, fz + 0.75, 2.2, 2, 0, r);
  drum(b, '#4f5a4c', ox - 0.55, fz + 0.45);
  b.geo('tyre', new THREE.TorusGeometry(0.32, 0.13, 6, 10), ox - w / 2 - 0.2, 0.42, -1.4, 0, Math.PI / 2, 0.15);
  return b.build({ vc: true });
}
// level 2, holding on: two storeys, patched with brick and fresh planks, a coat of muted paint, warm windows, a small flag
function homestead(o, r, b, glass) {
  const w = 5.8, d = 6.2, fh = 2.7, H = fh * 2, fz = d / 2, wall = o.color || '#a39783', roof = o.roof || '#6e4a3e', trim = shade(wall, -0.13), brick = '#8a5a4a', wood = '#6a5848';
  b.box('#77736b', w + 0.18, 0.4, d + 0.18, 0, 0, 0, { r: 0.03 });
  b.box(wall, w, H, d, 0, 0, 0, { r: 0.04 });
  for (let y = 0.75; y < H - 0.1; y += 0.45) { const c = shade(wall, -0.045); b.cbox(c, w + 0.03, 0.05, 0.03, 0, y, fz + 0.01, { r: 0.004 }); for (const sx of [-1, 1]) b.cbox(c, 0.03, 0.05, d + 0.03, sx * (w / 2 + 0.01), y, 0, { r: 0.004 }); }
  b.cbox(trim, w + 0.12, 0.16, d + 0.12, 0, fh, 0, { r: 0.03 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(trim, 0.18, H, 0.18, x * w / 2, 0, z * d / 2, { r: 0.02 });
  // repairs: a brick patch, a few odd bricks, fresh planks on the side
  b.cbox(brick, 1.3, 1.0, 0.04, -w / 2 + 0.8, 0.95, fz + 0.03, { r: 0.006 });
  for (let k = 0; k < 6; k++) b.cbox(shade(brick, (r() - 0.5) * 0.08), 0.38, 0.16, 0.05, -w / 2 + 0.4 + (k % 3) * 0.42 + (Math.floor(k / 3) % 2) * 0.2, 0.62 + Math.floor(k / 3) * 0.55, fz + 0.05, { r: 0.004 });
  for (let k = 0; k < 4; k++) b.cbox('#8a6f52', 0.04, 1.7, 0.26, w / 2 + 0.03, 3.7, -1.6 + k * 0.28, { r: 0.004 });
  // windows: warm by night; one ground-floor window still half boarded
  const win = (x, y, z, s = 1, ww = 0.9, wh = 1.2) => { b.cbox(glass, ww, wh, 0.06, x, y + wh / 2, z, { r: 0.008 }); b.cbox(trim, ww + 0.25, 0.09, 0.2, x, y - 0.03, z + s * 0.06, { r: 0.02 }); };
  for (const x of [-1.75, 1.75]) { win(x, 0.95, fz + 0.02); for (const s of [-1, 1]) b.cbox('wood2', 0.4, 1.2, 0.05, x + s * 0.68, 1.55, fz + 0.06, { r: 0.006 }); }
  b.cbox('#7b6a52', 1.05, 0.16, 0.04, -1.75, 1.6, fz + 0.1, { r: 0.004, rz: 0.12 });
  for (const x of [-1.8, 0, 1.8]) { win(x, fh + 0.8, fz + 0.02); win(x, fh + 0.8, -fz - 0.02, -1); }
  for (const x of [-1.75, 1.75]) win(x, 0.95, -fz - 0.02, -1);
  for (const sx of [-1, 1]) for (const y of [0.95, fh + 0.8]) { b.cbox(glass, 0.06, 1.2, 0.9, sx * (w / 2 + 0.02), y + 0.6, 0.6, { r: 0.008 }); }
  // the door under a small plank porch, a wall lamp
  b.cbox(shade(wall, -0.28), 1.0, 2.1, 0.08, 0, 1.05 + 0.2, fz + 0.04, { r: 0.01 });
  b.cbox(wood, 1.8, 0.08, 0.95, 0, 2.55, fz + 0.45, { r: 0.01, rx: 0.22 });
  for (const s of [-1, 1]) rod(b, wood, [s * 0.8, 2.0, fz + 0.03], [s * 0.8, 2.5, fz + 0.75], 0.07);
  b.cbox('#77736b', 1.4, 0.18, 0.6, 0, 0.09, fz + 0.35, { r: 0.03 });
  b.cbox(glass, 0.14, 0.2, 0.12, 0.8, 2.15, fz + 0.1, { r: 0.02 });
  // a tiled roof in a faded colour, a brick chimney, a small flag on the gable
  const a = gable(b, w, d, H, 1.8, roof, wall);
  for (let k = 0; k < 3; k++) { const s = 0.8 + r() * 1.8, x = s * Math.cos(a), y = H + 1.8 - s * Math.sin(a) + 0.18; b.cbox(shade(roof, (r() - 0.5) * 0.12), 0.7, 0.04, 0.8, x, y, (r() - 0.5) * 4, { r: 0.01, rz: -a }); }
  b.box(brick, 0.6, 1.6, 0.6, -1.3, H + 0.5, -1.5, { r: 0.04 }); b.cbox('#5a4a40', 0.75, 0.12, 0.75, -1.3, H + 2.15, -1.5, { r: 0.02 });
  b.cyl(glass, 0.32, 0.32, 0.05, 0, H + 0.62, fz + 0.01, { rx: Math.PI / 2, seg: 10 });
  flag(b, 0, H + 1.7, fz + 0.15, 1.4, 0.75);
  // a clothesline on the side, a box of vegetables, a painted rain barrel
  const cx = -w / 2 - 0.6;
  for (const z of [-2.3, 2.1]) b.box(wood, 0.08, 2.0, 0.08, cx, 0, z, { r: 0.02 });
  const line = sagPts([cx, 1.95, -2.3], [cx, 1.95, 2.1], 6, 0.12); cord(b, line, '#d8d1c2', 0.02);
  ['#c9c0a8', '#8a96a0', '#a3806a', '#b8b08f'].forEach((c, k) => { const p = line[k + 1]; b.cbox(c, 0.03, 0.6, 0.55, cx, p[1] - 0.32, p[2], { r: 0.005 }); });
  b.box('wood', 1.2, 0.35, 0.55, 1.9, 0, fz + 0.75, { r: 0.03 });
  for (let k = 0; k < 5; k++) b.sph(k % 3 === 2 ? '#a8743e' : '#6f8a4a', 0.16, 1.45 + k * 0.22, 0.42, fz + 0.75 + (r() - 0.5) * 0.15, { detail: 0 });
  drum(b, '#5c6e78', -w / 2 + 0.25, fz + 0.5);
  return b.build({ vc: true });
}
// level 3, thriving: three storeys in bright paint with white trim, shutters, window boxes, a balcony with lights, a banner
function proudHouse(o, r, b, glass) {
  const w = 6.3, d = 6.6, fh = 2.7, H = fh * 3, fz = d / 2, wall = o.color || '#f2d27a', roof = o.roof || '#c8553d', acc = o.accent || '#2f8f88', trim = '#f6f0e2', pitch = 2.3;
  b.box('#8f8a80', w + 0.2, 0.45, d + 0.2, 0, 0, 0, { r: 0.03 });
  b.box(wall, w, H, d, 0, 0, 0, { r: 0.04 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(trim, 0.28, H, 0.28, x * w / 2, 0, z * d / 2, { r: 0.03 });
  for (let f = 1; f < 3; f++) b.cbox(trim, w + 0.16, 0.18, d + 0.16, 0, f * fh, 0, { r: 0.03 });
  b.cbox(trim, w + 0.3, 0.26, d + 0.3, 0, H, 0, { r: 0.04 });
  const win = (x, y, z, s = 1, sh = true, ww = 0.9, wh = 1.3) => {
    b.cbox(glass, ww, wh, 0.06, x, y + wh / 2, z, { r: 0.008 });
    b.cbox(trim, ww + 0.3, 0.1, 0.22, x, y - 0.04, z + s * 0.06, { r: 0.02 }); b.cbox(trim, ww + 0.24, 0.14, 0.12, x, y + wh + 0.08, z + s * 0.03, { r: 0.02 });
    if (sh) for (const q of [-1, 1]) { b.cbox(acc, 0.38, wh, 0.05, x + q * (ww / 2 + 0.22), y + wh / 2, z + s * 0.04, { r: 0.006 }); for (let k = 0; k < 3; k++) b.cbox(shade(acc, -0.08), 0.32, 0.04, 0.03, x + q * (ww / 2 + 0.22), y + 0.25 + k * 0.4, z + s * 0.07, { r: 0.004 }); }
  };
  const cols = [-2.0, 0, 2.0];
  // ground floor: two windows and the front door under a striped awning, lamps either side, planters
  for (const x of [-2.0, 2.0]) { win(x, 0.95, fz + 0.02); windowBox(b, x, 0.82, fz + 0.18, 1.0, r); }
  b.cbox(acc, 1.05, 2.2, 0.08, 0, 1.55, fz + 0.04, { r: 0.01 }); b.cbox(trim, 1.35, 2.45, 0.05, 0, 1.6, fz + 0.01, { r: 0.01 });
  b.cbox(glass, 0.8, 0.3, 0.04, 0, 2.45, fz + 0.09, { r: 0.006 });
  b.cbox('#8f8a80', 1.6, 0.2, 0.7, 0, 0.35, fz + 0.4, { r: 0.03 });
  for (let k = 0; k < 6; k++) b.cbox(k % 2 ? trim : 'amber', 2.0 / 6 + 0.01, 0.05, 1.05, -1.0 + (k + 0.5) * 2.0 / 6, 3.0, fz + 0.5, { r: 0.005, rx: 0.38 });
  for (const s of [-1, 1]) { b.cbox('#2f2c29', 0.08, 0.3, 0.08, s * 0.85, 2.35, fz + 0.12, { r: 0.01 }); b.sph(BULB, 0.12, s * 0.85, 2.2, fz + 0.18, { detail: 0 }); planter(b, s * 1.05, fz + 0.75, 0.9, r); }
  // upper floors: shuttered windows with flower boxes; a balcony on the first floor with string lights
  for (let f = 1; f < 3; f++) for (const x of cols) {
    const y = f * fh + 0.75;
    if (f === 1 && x === 0) { b.cbox(glass, 0.95, 2.0, 0.06, 0, f * fh + 0.2 + 1.0, fz + 0.02, { r: 0.008 }); b.cbox(trim, 1.2, 0.14, 0.12, 0, f * fh + 2.28, fz + 0.04, { r: 0.02 }); continue; }
    win(x, y, fz + 0.02); windowBox(b, x, y - 0.14, fz + 0.18, 1.0, r);
  }
  const by = fh + 0.06, bz = fz + 0.45;
  b.cbox(trim, 2.4, 0.14, 0.95, 0, by, bz, { r: 0.03 });
  for (let k = 0; k <= 6; k++) b.box(acc, 0.06, 0.9, 0.06, -1.15 + k * 2.3 / 6, by, fz + 0.88, { r: 0.01 });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.box(acc, 0.06, 0.9, 0.06, s * 1.15, by, fz + 0.1 + k * 0.26, { r: 0.01 });
  b.cbox(trim, 2.4, 0.08, 0.1, 0, by + 0.95, fz + 0.88, { r: 0.01 });
  windowBox(b, 0, by + 1.05, fz + 0.88, 2.0, r);
  for (const s of [-1, 1]) rod(b, trim, [s * 1.1, by - 0.05, fz + 0.03], [s * 1.1, by - 0.75, fz + 0.03], 0.1);
  lights(b, [-1.25, by + 2.45, fz + 0.15], [1.25, by + 2.45, fz + 0.15], 8, 0.2);
  // back and sides: plain windows (they still glow at night)
  for (let f = 0; f < 3; f++) for (const x of cols) win(x, f * fh + 0.85, -fz - 0.02, -1, false);
  for (const sx of [-1, 1]) for (let f = 0; f < 3; f++) b.cbox(glass, 0.06, 1.2, 0.9, sx * (w / 2 + 0.02), f * fh + 0.85 + 0.6, sx > 0 ? -1.4 : 1.2, { r: 0.008 });
  // a bright roof with a round attic window, string lights along the gable, a brick chimney, the town flag on top
  const a = gable(b, w, d, H + 0.12, pitch, roof, wall, { eave: 0.4 });
  b.cyl(trim, 0.52, 0.52, 0.06, 0, H + 0.95, fz + 0.01, { rx: Math.PI / 2, seg: 14 }); b.cyl(glass, 0.4, 0.4, 0.06, 0, H + 0.95, fz + 0.04, { rx: Math.PI / 2, seg: 14 });
  for (const s of [-1, 1]) lights(b, [s * (w / 2 + 0.4), H + 0.2, fz + 0.32], [0, H + pitch + 0.25, fz + 0.32], 7, 0.08);
  b.box('#b0533f', 0.65, 1.9, 0.65, 1.5, H + 0.6, -1.6, { r: 0.04 }); b.cbox(trim, 0.8, 0.14, 0.8, 1.5, H + 2.5, -1.6, { r: 0.02 });
  flag(b, 0, H + pitch + 0.1, fz + 0.1, 2.0, 1.15);
  // the town banner hung on the side, ivy and flowers climbing the other corner
  b.cbox('#2f2c29', 0.5, 0.06, 1.5, w / 2 + 0.25, H - 0.35, 0.3, { r: 0.01 });
  b.cbox('amber', 0.05, 3.2, 1.3, w / 2 + 0.18, H - 2.0, 0.3, { r: 0.006 });
  b.cbox(trim, 0.06, 0.24, 1.32, w / 2 + 0.19, H - 0.95, 0.3, { r: 0.004 }); b.cyl(trim, 0.32, 0.32, 0.06, w / 2 + 0.2, H - 2.0, 0.3, { rz: Math.PI / 2, seg: 10 });
  for (let k = 0; k < 7; k++) { const y = 0.5 + k * 0.85, z = fz - 0.25 - r() * 0.6; b.sph(k % 2 ? '#4f7d34' : '#5c8a3c', 0.35 + r() * 0.15, -w / 2 - 0.12, y, z, { detail: 0, sx: 0.5 }); }
  blooms(b, -w / 2 - 0.25, 0.4, fz - 0.6, 0.15, 7, r, 0.8);
  return b.build({ vc: true });
}

export { townhouse };
