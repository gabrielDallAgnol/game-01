// Hollowmere city kit · The frontier kit: timber, tarp and canvas. The hall (camp) and the homes.
/* global THREE */
import { lin } from './palette.js';
import { WIN, LANTERN } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { shade, PEN, rod, bunting, lights, windowBox, planter, flag } from './craft.js';

// ======================================================================
// THE FRONTIER KIT: timber, tarp and canvas. Everything the camp builds speaks one language.
// ======================================================================
const TIMBER = ['#7a5a3c', '#6c4f35', '#86654a', '#5f4530'], TARP = '#6f8a8c', CANVAS = '#d8c9a4', CANVAS2 = '#c9b78e', SHINGLE = '#5a4636', STONE = '#8f8a80';
/** a log lying along x (axis 'x') or z, centred on (x, y, z) */
function log(b, col, len, r, x, y, z, axis = 'x', seg = 6) { b.geo(col, new THREE.CylinderGeometry(r, r * 1.06, len, seg, 1, false), x, y, z, axis === 'x' ? 0 : Math.PI / 2, 0, axis === 'x' ? Math.PI / 2 : 0); }
/** a wall of stacked logs from (x0, z0) to (x1, z1), h tall, alternating tones */
function logWall(b, x0, z0, x1, z1, h, r = 0.17, y0 = 0, tones = TIMBER) {
  const len = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 'x' : 'z', n = Math.max(1, Math.round(h / (r * 1.8)));
  for (let k = 0; k < n; k++) log(b, tones[k % tones.length], len + r * 1.6, r, (x0 + x1) / 2, y0 + r + k * r * 1.8, (z0 + z1) / 2, ax);
}
function fireRing(b, x, z, s = 1) {
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; b.sph(k % 2 ? STONE : '#7c776d', 0.2 * s, x + Math.cos(a) * 0.62 * s, 0.08 * s, z + Math.sin(a) * 0.62 * s, { detail: 0, sy: 0.7 }); }
  for (let k = 0; k < 4; k++) { const a = k * 0.8 + 0.3; b.geo('#4a3626', new THREE.CylinderGeometry(0.07 * s, 0.08 * s, 0.9 * s, 5), x, 0.18 * s, z, 0.9, a, 0); }
  b.cbox('#2a2220', 0.8 * s, 0.04, 0.8 * s, x, 0.02, z, { r: 0.02 });
}
/** the flames of a fire: emissive cones (they bloom at night and burn by day) */
function flames(g, x, z, s = 1, y = 0.15) {
  const m1 = new THREE.MeshBasicMaterial({ color: lin('#ff9a3a').multiplyScalar(3) }), m2 = new THREE.MeshBasicMaterial({ color: lin('#ffe0a0').multiplyScalar(4) });
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.34 * s, 1.0 * s, 6), m1); f1.position.set(x, y + 0.5 * s, z); g.add(f1);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.2 * s, 0.7 * s, 5), m2); f2.position.set(x + 0.08 * s, y + 0.38 * s, z - 0.05 * s); g.add(f2);
  g.userData.flames = (g.userData.flames || []).concat([f1, f2]);
}
function bench(b, x, z, ry, len = 1.6) { const c = Math.cos(ry), s2 = Math.sin(ry); log(b, TIMBER[(len * 10 | 0) % 4], len, 0.17, x, 0.2, z, Math.abs(c) > 0.7 ? 'x' : 'z'); }
function crate(b, x, z, s = 1, y = 0, ry = 0) { b.box('#8a6a48', 0.7 * s, 0.6 * s, 0.6 * s, x, y, z, { r: 0.03, ry }); b.cbox('#6b5038', 0.72 * s, 0.08 * s, 0.62 * s, x, y + 0.3 * s, z, { r: 0.01, ry }); }
function barrel(b, x, z, col = '#6a5440', s = 1) { b.cyl(col, 0.3 * s, 0.28 * s, 0.85 * s, x, 0, z, { seg: 8 }); for (const t of [0.15, 0.68]) b.cyl('#3f3a35', 0.31 * s, 0.31 * s, 0.05 * s, x, t * s, z, { seg: 8 }); }
function lanternPost(b, x, z, h = 2.1) { b.box(TIMBER[1], 0.09, h, 0.09, x, 0, z, { r: 0.02 }); b.cbox(TIMBER[0], 0.5, 0.07, 0.07, x + 0.22, h - 0.05, z, { r: 0.01 }); b.cbox(LANTERN, 0.16, 0.22, 0.16, x + 0.42, h - 0.25, z, { r: 0.03 }); b.cbox('#2f2c29', 0.2, 0.05, 0.2, x + 0.42, h - 0.12, z, { r: 0.01 }); }
/** a tarp stretched between four corners [x, y, z] (two triangles, slightly sagging) */
function tarp(b, col, a, c, d, e) { const s = new THREE.BufferGeometry(); const mid = [(a[0] + c[0] + d[0] + e[0]) / 4, (a[1] + c[1] + d[1] + e[1]) / 4 - 0.12, (a[2] + c[2] + d[2] + e[2]) / 4]; const P = [a, c, mid, c, d, mid, d, e, mid, e, a, mid].flat(); s.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); s.computeVertexNormals(); b.geo(col, s); const s2 = s.clone(); const p2 = s2.attributes.position; for (let i = 0; i < p2.count; i += 3) { const t = [p2.getX(i + 1), p2.getY(i + 1), p2.getZ(i + 1)]; p2.setXYZ(i + 1, p2.getX(i + 2), p2.getY(i + 2), p2.getZ(i + 2)); p2.setXYZ(i + 2, ...t); } s2.computeVertexNormals(); b.geo(shade(col, -0.12), s2); }
function pennants(b, p, q, n) { bunting(b, p, q, n, 0.25, ['#f0a040', '#d8c9a4', '#c9702e', '#f4ead2']); }
/** a school bus that stalled here: faded yellow, flat tyres, roof rack of salvage */
function busInto(b, x, z, ry, o = {}) {
  const c = Math.cos(ry), s2 = Math.sin(ry), P = (u, w) => [x + u * c + w * s2, z - u * s2 + w * c];
  const L = 11, Wd = 2.5, body = o.color || '#d9a441', at = (u, w, y, wx, hy, dz, col, r = 0.06) => { const [px, pz] = P(u, w); b.cbox(col, wx, hy, dz, px, y, pz, { r, ry }); };
  at(0, 0, 1.75, L, 2.4, Wd, body, 0.3);
  at(-0.3, 0, 2.15, L - 2.6, 0.9, Wd + 0.03, '#3a4648', 0.08);   // window band
  for (let k = 0; k < 7; k++) at(-4.1 + k * 1.25, 0, 2.15, 0.12, 0.95, Wd + 0.06, body, 0.02);
  at(0, 0, 1.25, L + 0.03, 0.22, Wd + 0.05, '#2f2c29', 0.04);   // black rub strip
  at(L / 2 + 0.6, 0, 0.95, 1.4, 1.2, Wd - 0.1, body, 0.25); at(L / 2 + 1.25, 0, 0.9, 0.1, 0.5, Wd - 0.6, '#3a3836', 0.02);   // the nose
  at(L / 2 + 0.05, 0, 2.1, 0.08, 1.1, Wd - 0.3, '#3a4648', 0.02);
  at(-L / 2 - 0.02, 0, 1.0, 0.1, 0.25, 0.6, '#c0462f', 0.02);
  for (const u of [-3.4, 3.8]) for (const w of [-1.2, 1.2]) { const [px, pz] = P(u, w); b.geo('tyre', new THREE.CylinderGeometry(0.5, 0.5, 0.32, 10), px, 0.45, pz, Math.PI / 2, ry, 0, 1, 1, 0.92); }
  // roof rack: salvage, a rolled tarp, crates
  at(-1, 0, 3.02, 6, 0.08, Wd - 0.3, '#4a4440', 0.02);
  at(-2.6, 0.2, 3.3, 1.0, 0.5, 0.8, '#8a6a48', 0.04); at(-1.2, -0.3, 3.25, 0.8, 0.4, 0.7, '#6b5038', 0.04);
  const [rx, rz] = P(0.6, 0); log(b, TARP, 2.2, 0.22, rx, 3.3, rz, Math.abs(c) > 0.7 ? 'z' : 'x');
}

/**
 * the hall: the heart of the camp, by level.
 *   1 — the stalled bus with tarps stretched off it, a campfire ringed with log benches
 *   2 — a timber longhouse built round the bus (its nose still sticks out of the end wall), a porch and lit windows
 *   3 — the palisaded lodge: a bigger hall with a lookout loft, a stake palisade with a gate, braziers and banners
 * Front faces -z (the view turns it to face the camera). userData.fires: [[x, y, z, r]] in model metres.
 */
function hall(o = {}) {
  const lvl = o.level || 1, g = new THREE.Group(), b = new B(), r = rng(91 + lvl);
  const fires = [];
  // packed earth yard
  b.geo('#9c8664', new THREE.CylinderGeometry(9.5, 9.8, 0.06, 20), 0, 0.03, -0.5, 0, 0, 0, 1, 1, 0.8);
  if (lvl === 1) {
    busInto(b, 0.5, 2.8, 0);
    // tarps off the bus roof to poles in front: the camp's first shelter
    for (const [x0, x1] of [[-5, -1.2], [-0.8, 3.4]]) {
      for (const x of [x0, x1]) b.box(TIMBER[2], 0.12, 2.1, 0.12, x, 0, -0.9, { r: 0.02, rz: (r() - 0.5) * 0.06 });
      tarp(b, x0 < -2 ? TARP : CANVAS2, [x0, 2.9, 1.6], [x1, 2.9, 1.6], [x1, 2.1, -0.9], [x0, 2.1, -0.9]);
    }
    // bedrolls and crates under the tarps
    for (let k = 0; k < 4; k++) b.cbox(['#7a5a48', '#5d6b6a', '#8a7a5a', '#6b4a3a'][k], 0.7, 0.16, 1.7, -4.2 + k * 1.15, 0.08, 0.5, { r: 0.07 });
    crate(b, 2.6, 0.9); crate(b, 3.2, 0.4, 0.8, 0, 0.4); barrel(b, 4.4, 1.2); barrel(b, 4.9, 0.6, '#59625e');
    // the campfire and its benches
    const fx = 0.5, fz = -3.6; fireRing(b, fx, fz); fires.push([fx, 0.4, fz, 5]);
    bench(b, fx - 2.0, fz, Math.PI / 2, 2.2); bench(b, fx + 2.1, fz - 0.2, Math.PI / 2, 2.0); bench(b, fx, fz - 2.1, 0, 2.4);
    b.cbox('#6b5038', 0.5, 0.5, 0.5, fx + 1.4, 0.25, fz + 1.5, { r: 0.04, ry: 0.4 });
    // a cooking tripod over the fire
    for (let k = 0; k < 3; k++) { const a = k * 2.1; rod(b, '#3a2f28', [fx + Math.cos(a) * 0.8, 0, fz + Math.sin(a) * 0.8], [fx, 1.7, fz], 0.05); }
    b.cyl('#3a3836', 0.22, 0.18, 0.3, fx, 0.95, fz, { seg: 8 });
    lanternPost(b, -5.8, -2.5); lanternPost(b, 6, -1.8);
    flag(b, 6.3, 0, 2.6, 4.2, 1.3);
    // the woodpile and a chopping block
    for (let k = 0; k < 9; k++) log(b, TIMBER[k % 4], 1.3, 0.14, -7.2, 0.15 + Math.floor(k / 3) * 0.26, 1.6 + (k % 3) * 0.3, 'x');
    b.cyl('#6b5038', 0.32, 0.36, 0.5, -6.6, 0, -0.6, { seg: 8 });
  } else {
    // the longhouse: log walls on a stone footing, a shingle roof, the bus's yellow nose out of the east end
    const hw = lvl === 2 ? 13 : 15, hd = lvl === 2 ? 6.4 : 7.2, wh = lvl === 2 ? 2.9 : 3.3, cz = 2.2;
    busInto(b, 1.5, cz, 0);
    b.box(STONE, hw + 0.4, 0.4, hd + 0.4, 0, 0, cz, { r: 0.06 });
    for (const s of [-1, 1]) logWall(b, -hw / 2, cz + s * hd / 2, hw / 2 - (s < 0 ? 0 : 0), cz + s * hd / 2, wh, 0.19, 0.4);
    // west end wall closed; east end wall with a gap the bus nose fills
    logWall(b, -hw / 2, cz - hd / 2, -hw / 2, cz + hd / 2, wh, 0.19, 0.4);
    for (const s of [-1, 1]) logWall(b, hw / 2, cz + s * hd / 2, hw / 2, cz + s * 1.5, wh, 0.19, 0.4);
    logWall(b, hw / 2, cz - 1.5, hw / 2, cz + 1.5, 0.6, 0.19, wh - 0.2);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(TIMBER[3], 0.4, wh + 0.4, 0.4, x * hw / 2, 0, cz + z * hd / 2, { r: 0.05 });
    // windows (warm by night) and the door under the porch
    for (const x of [-4.4, -1.6, 1.6, 4.4]) { if (x === 1.6 && lvl === 2) continue; b.cbox(WIN, 1.0, 0.9, 0.08, x, 1.9, cz - hd / 2 - 0.16, { r: 0.01 }); b.cbox(TIMBER[0], 1.25, 0.12, 0.22, x, 1.4, cz - hd / 2 - 0.2, { r: 0.02 }); b.cbox(TIMBER[0], 1.25, 0.12, 0.22, x, 2.42, cz - hd / 2 - 0.2, { r: 0.02 }); }
    b.cbox('#4a3626', 1.4, 2.2, 0.1, 0, 1.5, cz - hd / 2 - 0.16, { r: 0.01 }); b.cbox(WIN, 1.1, 0.25, 0.06, 0, 2.75, cz - hd / 2 - 0.2, { r: 0.01 });
    for (const x of [-3, 3]) b.cbox(WIN, 0.9, 0.8, 0.08, x, 1.9, cz + hd / 2 + 0.16, { r: 0.01 });
    // roof: two shingle slabs with a ridge and a smoke hole
    const pitch = lvl === 2 ? 2.6 : 3.0, H = wh + 0.4;
    const ov = 0.6, run = hd / 2 + ov, a = Math.atan2(pitch, run), Lr = Math.hypot(run, pitch) + 0.1;
    for (const s of [-1, 1]) { b.cbox(SHINGLE, hw + 1.2, 0.2, Lr, 0, H + pitch / 2, cz + s * run / 2, { r: 0.04, rx: s * a }); for (let k = 1; k < 5; k++) b.cbox(shade(SHINGLE, -0.05), hw + 1.22, 0.05, 0.08, 0, H + pitch * (1 - k / 5) + 0.12, cz + s * run * k / 5, { r: 0.01 }); }
    b.cbox('#3e3026', hw + 1.3, 0.3, 0.4, 0, H + pitch + 0.05, cz, { r: 0.05 });
    { const sg = new THREE.Shape(); sg.moveTo(-hd / 2, 0); sg.lineTo(hd / 2, 0); sg.lineTo(0, pitch); sg.closePath(); const eg = new THREE.ExtrudeGeometry(sg, { depth: 0.3, bevelEnabled: false }); for (const x of [-hw / 2 - 0.15, hw / 2 - 0.15]) b.geo(TIMBER[2], eg, x, H, cz, 0, Math.PI / 2, 0); }
    b.cbox('#2a2422', 1.2, 0.5, 1.0, -2.5, H + pitch - 0.1, cz, { r: 0.04 }); fires.push([-2.5, H + pitch, cz, 0]);
    // porch: posts and a lean-to roof over the door
    for (const x of [-2.4, 2.4]) b.box(TIMBER[1], 0.22, 2.6, 0.22, x, 0, cz - hd / 2 - 2.0, { r: 0.04 });
    b.cbox(SHINGLE, 6, 0.15, 2.5, 0, 2.75, cz - hd / 2 - 1.05, { r: 0.03, rx: -0.2 });
    b.cbox(TIMBER[2], 5.2, 0.1, 2.1, 0, 0.45, cz - hd / 2 - 1.0, { r: 0.02 });
    b.cbox(LANTERN, 0.2, 0.28, 0.2, -2.4, 2.25, cz - hd / 2 - 2.0, { r: 0.03 }); b.cbox(LANTERN, 0.2, 0.28, 0.2, 2.4, 2.25, cz - hd / 2 - 2.0, { r: 0.03 });
    // amber banners either side of the door
    for (const x of [-3.4, 3.4]) { b.cbox('amber', 0.9, 2.0, 0.06, x, 2.1, cz - hd / 2 - 0.3, { r: 0.01 }); b.geo('amber', PEN, x, 1.1, cz - hd / 2 - 0.3, 0, 0, 0, 2.6, 1.3, 1); }
    // the yard fire, benches, the woodpile along the west wall
    const fx = 0, fz = -5.2; fireRing(b, fx, fz, 1.1); fires.push([fx, 0.4, fz, 5.5]);
    bench(b, fx - 2.2, fz, Math.PI / 2, 2.2); bench(b, fx + 2.2, fz, Math.PI / 2, 2.2); bench(b, fx, fz - 2.1, 0, 2.6);
    for (let k = 0; k < 12; k++) log(b, TIMBER[k % 4], 1.3, 0.14, -hw / 2 - 0.9, 0.15 + Math.floor(k / 4) * 0.26, cz - 1.5 + (k % 4) * 0.3 + 1, 'x');
    barrel(b, hw / 2 + 0.9, cz - 3.4); crate(b, hw / 2 + 1.0, cz - 2.4, 0.9);
    if (lvl === 2) { lanternPost(b, -6, -5.6); lanternPost(b, 6.2, -5.4); flag(b, -hw / 2 - 0.4, 0, cz - hd / 2 - 0.4, 5.2, 1.5); pennants(b, [-2.4, 2.6, cz - hd / 2 - 2.0], [-6, 2.0, -5.6], 6); pennants(b, [2.4, 2.6, cz - hd / 2 - 2.0], [6.2, 2.0, -5.4], 6); }
    if (lvl === 3) {
      // a lookout loft on the roof: posts, a rail, a little roof, a lantern
      const lx = 3.5, ly = H + pitch - 0.2;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(TIMBER[1], 0.16, 2.2, 0.16, lx + x * 1.1, ly, cz + z * 1.1, { r: 0.02 });
      b.cbox(TIMBER[2], 2.6, 0.12, 2.6, lx, ly + 0.2, cz, { r: 0.02 }); for (const s of [-1, 1]) { b.cbox(TIMBER[0], 2.5, 0.09, 0.09, lx, ly + 1.1, cz + s * 1.1, { r: 0.01 }); b.cbox(TIMBER[0], 0.09, 0.09, 2.5, lx + s * 1.1, ly + 1.1, cz, { r: 0.01 }); }
      b.geo(SHINGLE, new THREE.ConeGeometry(2.0, 1.2, 4), lx, ly + 2.8, cz, 0, Math.PI / 4, 0);
      b.cbox(LANTERN, 0.22, 0.3, 0.22, lx, ly + 1.7, cz, { r: 0.03 });
      flag(b, lx, ly + 3.3, cz, 2.2, 1.6);
      // the palisade: sharpened stakes round the yard, a gate in front with two braziers
      const PX = 9.2, PZ0 = -8.4, PZ1 = 6.9, stake = (x, z, k) => { const hh = 2.6 + ((k * 7) % 5) * 0.12; b.cyl(TIMBER[k % 4], 0.19, 0.21, hh, x, 0, z, { seg: 6 }); b.geo(TIMBER[(k + 1) % 4], new THREE.ConeGeometry(0.2, 0.5, 6), x, hh + 0.25, z); };
      let k = 0;
      for (let x = -PX; x <= PX + 0.01; x += 0.42) { if (Math.abs(x) > 1.9) stake(x, PZ0, k++); stake(x, PZ1, k++); }
      for (let z = PZ0 + 0.42; z < PZ1; z += 0.42) { stake(-PX, z, k++); stake(PX, z, k++); }
      for (const s of [-1, 1]) for (const y of [0.8, 2.0]) b.cbox(TIMBER[3], 0.12, 0.16, PZ1 - PZ0, s * (PX - 0.25), y, (PZ0 + PZ1) / 2, { r: 0.02 });
      // the gate: two big posts, a lintel with the camp's banner, braziers
      for (const s of [-1, 1]) { b.box(TIMBER[1], 0.42, 3.8, 0.42, s * 2.1, 0, PZ0, { r: 0.05 }); b.cyl('#3a3836', 0.32, 0.22, 0.5, s * 2.9, 0.7, PZ0 - 0.5, { seg: 8 }); b.box('#3a3836', 0.1, 0.7, 0.1, s * 2.9, 0, PZ0 - 0.5); fires.push([s * 2.9, 1.3, PZ0 - 0.5, 3.2]); }
      b.cbox(TIMBER[0], 4.8, 0.36, 0.42, 0, 3.7, PZ0, { r: 0.04 }); b.cbox('amber', 2.2, 0.9, 0.08, 0, 3.0, PZ0 - 0.26, { r: 0.01 });
      // string lights from the porch to the gate
      lights(b, [-2.4, 2.65, cz - hd / 2 - 2.0], [-2.1, 3.5, PZ0], 6, 0.35); lights(b, [2.4, 2.65, cz - hd / 2 - 2.0], [2.1, 3.5, PZ0], 6, 0.35);
      pennants(b, [-PX, 3.1, PZ0], [-2.1, 3.6, PZ0], 9); pennants(b, [2.1, 3.6, PZ0], [PX, 3.1, PZ0], 9);
      barrel(b, -7.5, -6.8, '#59625e'); crate(b, 7.4, -7, 0.9); crate(b, 7.9, -6.3, 0.7, 0, 0.6);
    }
  }
  g.add(b.build({ ao: 1.6, aoMin: 0.55 }));
  for (const f of fires) if (f[3] > 0) flames(g, f[0], f[2], f[3] > 4 ? 1.1 : 0.7, f[1] - 0.3);
  g.userData.fires = fires.filter(f => f[3] > 0);
  g.userData.smoke = fires.filter(f => f[3] === 0);
  return g;
}

/** homes: 1 a canvas tent with a tarp lean-to, 2 a log cabin with a chimney, 3 a bigger cabin with a porch and lit windows. Front +z. */
function home(o = {}) {
  const lvl = o.level || 1, b = new B(), r = rng(o.seed || 21), v = (o.seed || 0) % 4;
  const tones = [CANVAS, CANVAS2, '#c7b99a', '#b9a888'];
  if (lvl === 1) {
    // an A-frame canvas tent, guy ropes, a patched tarp lean-to, bedroll and a small fire ring
    const tw = 3.6, td = 4.6, th = 2.6, col = tones[v];
    const s = new THREE.Shape(); s.moveTo(-tw / 2, 0); s.lineTo(tw / 2, 0); s.lineTo(0, th); s.closePath();
    const tg = new THREE.ExtrudeGeometry(s, { depth: td, bevelEnabled: false }); tg.translate(0, 0, -td / 2); b.geo(col, tg, -0.6, 0, -0.3);
    b.geo(shade(col, -0.06), new THREE.BoxGeometry(0.6, 0.6, 0.02), -0.6 + 0.9, 1.1, -0.3 + td / 2 + 0.01, 0, 0, Math.atan2(th, tw / 2) - Math.PI / 2);
    b.cbox('#3a3028', 1.1, 1.5, 0.04, -0.6, 0.75, -0.3 + td / 2 + 0.02, { r: 0.01 });   // the open flap
    b.cbox('#7a5a48', 0.06, th + 0.3, 0.06, -0.6, th / 2, -0.3 + td / 2 + 0.05, { r: 0.01 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(b, '#d8d1c2', [-0.6 + sx * tw * 0.3, th * 0.45, -0.3 + sz * td * 0.42], [-0.6 + sx * (tw / 2 + 0.9), 0.02, -0.3 + sz * td * 0.48], 0.02);
    // lean-to tarp on two poles at the side, sacks and crates under it
    const lx = 2.0;
    for (const z of [-1.4, 1.2]) b.box(TIMBER[(z > 0) + 1], 0.09, 1.7, 0.09, lx + 0.9, 0, z, { r: 0.02 });
    tarp(b, v % 2 ? TARP : '#7f7a5e', [lx - 0.6, 1.25, -1.4], [lx - 0.6, 1.25, 1.2], [lx + 0.9, 1.7, 1.2], [lx + 0.9, 1.7, -1.4]);
    crate(b, lx + 0.2, -0.6, 0.8); for (let k = 0; k < 3; k++) b.sph('bag', 0.26, lx + 0.1 + (k % 2) * 0.4, 0.22, 0.4 + k * 0.25, { detail: 0, sy: 0.75 });
    b.cbox('#7a5a48', 0.6, 0.14, 1.6, -0.6, 0.07, td / 2 + 0.8, { r: 0.07, ry: 0.2 });
    fireRing(b, 0.9, td / 2 + 1.4, 0.55);
    b.cbox(LANTERN, 0.14, 0.2, 0.14, -0.6, th - 0.25, -0.3 + td / 2 + 0.12, { r: 0.02 });
    return b.build({ ao: 1.1, aoMin: 0.6 });
  }
  // cabins
  const w = lvl === 2 ? 5.2 : 6.0, d = lvl === 2 ? 4.8 : 5.4, wh = lvl === 2 ? 2.5 : 2.8, ox = lvl === 2 ? 0 : -0.2;
  const logTones = lvl === 2 ? TIMBER : ['#8a6644', '#7c5b3c', '#957050', '#6e5136'];
  b.box(STONE, w + 0.3, 0.35, d + 0.3, ox, 0, 0, { r: 0.05 });
  logWall(b, ox - w / 2, -d / 2, ox + w / 2, -d / 2, wh, 0.16, 0.35, logTones); logWall(b, ox - w / 2, d / 2, ox + w / 2, d / 2, wh, 0.16, 0.35, logTones);
  logWall(b, ox - w / 2, -d / 2, ox - w / 2, d / 2, wh, 0.16, 0.35, logTones); logWall(b, ox + w / 2, -d / 2, ox + w / 2, d / 2, wh, 0.16, 0.35, logTones);
  const H = wh + 0.35, pitch = lvl === 2 ? 1.9 : 2.2, roof = lvl === 2 ? ['#5a4636', '#4f4a44', '#5d4a3a', '#6a5040'][v] : ['#7a4a36', '#3d5a5c', '#6a3a30', '#4a5a3c'][v];
  // windows and door on the front (+z)
  const win = (x, y, z, s = 1, ww = 1.0, hh = 0.95) => { b.cbox(WIN, ww, hh, 0.08, x, y, z, { r: 0.01 }); b.cbox(TIMBER[0], ww + 0.24, 0.1, 0.2, x, y - hh / 2 - 0.04, z + s * 0.06, { r: 0.02 }); b.cbox(TIMBER[0], ww + 0.24, 0.1, 0.16, x, y + hh / 2 + 0.04, z + s * 0.04, { r: 0.02 }); };
  win(ox - 1.5, 1.65, d / 2 + 0.17); win(ox + 1.5, 1.65, d / 2 + 0.17); win(ox - 1.2, 1.65, -d / 2 - 0.17, -1); win(ox + 1.2, 1.65, -d / 2 - 0.17, -1); b.cbox(WIN, 0.08, 0.9, 1.0, ox + w / 2 + 0.17, 1.65, 0.3, { r: 0.01 }); b.cbox(WIN, 0.08, 0.9, 1.0, ox - w / 2 - 0.17, 1.65, 0.6, { r: 0.01 });
  b.cbox('#4a3626', 0.95, 1.9, 0.08, ox, 1.3, d / 2 + 0.18, { r: 0.01 });
  // the gable roof (ridge along x), gable ends in planks, a stone chimney
  { const run = d / 2 + 0.45, a = Math.atan2(pitch, run), Lr = Math.hypot(run, pitch) + 0.1;
    for (const s of [-1, 1]) b.cbox(roof, w + 0.8, 0.16, Lr, ox, H + pitch / 2, s * run / 2, { r: 0.03, rx: s * a });
    b.cbox(shade(roof, -0.1), w + 0.9, 0.2, 0.28, ox, H + pitch + 0.04, 0, { r: 0.04 });
    const sg = new THREE.Shape(); sg.moveTo(-d / 2, 0); sg.lineTo(d / 2, 0); sg.lineTo(0, pitch); sg.closePath(); const eg = new THREE.ExtrudeGeometry(sg, { depth: 0.2, bevelEnabled: false });
    for (const x of [ox - w / 2 - 0.1, ox + w / 2 - 0.1]) b.geo(TIMBER[2], eg, x, H, 0, 0, Math.PI / 2, 0); }
  b.box(STONE, 0.75, H + pitch + 0.6, 0.75, ox - w / 2 + 0.7, 0, -d / 2 + 0.9, { r: 0.05 }); b.cbox('#5f5a52', 0.9, 0.14, 0.9, ox - w / 2 + 0.7, H + pitch + 0.65, -d / 2 + 0.9, { r: 0.02 });
  // the woodpile and a barrel
  for (let k = 0; k < 6; k++) log(b, TIMBER[k % 4], 1.1, 0.13, ox + w / 2 + 0.55, 0.14 + Math.floor(k / 3) * 0.24, -d / 2 + 0.6 + (k % 3) * 0.28, 'x');
  barrel(b, ox - w / 2 - 0.45, d / 2 - 0.3, '#5c6e78', 0.85);
  if (lvl === 2) { b.cbox(LANTERN, 0.16, 0.22, 0.16, ox + 0.75, 2.2, d / 2 + 0.3, { r: 0.02 }); return b.build({ ao: 1.2, aoMin: 0.58 }); }
  // level 3: a porch the width of the house, posts, a lean-to roof, a rocking chair, flower boxes, lights, a flag
  const pz = d / 2 + 1.5;
  b.cbox(TIMBER[2], w + 0.6, 0.14, 1.8, ox, 0.42, d / 2 + 0.95, { r: 0.02 });
  for (const x of [-w / 2, -w / 6, w / 6, w / 2]) b.box(TIMBER[1], 0.16, 2.35, 0.16, ox + x, 0.42, pz, { r: 0.02 });
  b.cbox(roof, w + 0.9, 0.12, 2.1, ox, 2.95, d / 2 + 0.95, { r: 0.02, rx: 0.2 });
  b.cbox(TIMBER[0], w + 0.2, 0.08, 0.08, ox, 1.15, pz, { r: 0.01 });
  for (const x of [-1.5, 1.5]) windowBox(b, ox + x, 1.1, d / 2 + 0.35, 1.0, r);
  b.cbox('#6b4a32', 0.6, 0.08, 0.55, ox + 1.6, 0.85, pz - 0.6, { r: 0.02 }); b.cbox('#6b4a32', 0.6, 0.7, 0.08, ox + 1.6, 1.2, pz - 0.85, { r: 0.02, rx: -0.15 });
  lights(b, [ox - w / 2, 2.6, pz], [ox + w / 2, 2.6, pz], 9, 0.18);
  b.cbox(LANTERN, 0.18, 0.24, 0.18, ox - w / 6, 2.15, pz, { r: 0.02 });
  flag(b, ox + w / 2 + 0.3, H, -d / 2 + 0.4, 2.6, 0.9);
  planter(b, ox - w / 2 - 0.5, d / 2 + 1.2, 0.8, r);
  return b.build({ ao: 1.2, aoMin: 0.58 });
}

export { hall, home };
