// Hollowmere city kit · Defences: watchtower, barricade, wall post and its chain-link material.
/* global THREE */
import { WIN, LANTERN } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { car, sandbags } from './street.js';
import { shade, PEN, rod, flag, drum, bagRow } from './craft.js';

/** watchtower: 1 a scaffold-and-timber lookout, 2 a painted timber tower with a roof and flag, 3 a proud turret with banners */
function tower(o = {}) {
  const lvl = o.level || 1, b = new B(), r = rng(o.seed || 51);
  let H;
  if (lvl === 1) {
    // survival: scaffold poles and odd timbers lashed together, a pallet deck, sandbags, a tarp against the wind
    H = 3.9; const sz = 2.1, h = sz / 2;
    for (const [a, c, m] of [[-1, -1, '#7a5a3c'], [1, -1, '#6a5a48'], [-1, 1, '#6a5a48'], [1, 1, '#86654a']]) b.box(m, 0.13, H, 0.13, a * h, 0, c * h, { r: 0.02, rz: a * 0.02 });
    rod(b, '#6f5a45', [-h, 0.3, h], [h, 2.3, h], 0.08); rod(b, '#7a5a3c', [h, 0.5, -h], [h, 2.6, h], 0.07); rod(b, '#5a4535', [-h, 2.4, -h], [h, 0.4, -h], 0.08); rod(b, '#6c4f35', [-h, 0.2, -h], [-h, 2.0, h], 0.07);
    for (const y of [2.1]) { rod(b, '#6f675b', [-h, y, h], [h, y + 0.05, h], 0.07); rod(b, '#6f675b', [h, y, h], [h, y - 0.04, -h], 0.07); }
    for (let k = 0; k < 4; k++) b.cbox(['#8a7356', '#6f675b', '#7b6a52'][k % 3], sz + 0.45, 0.1, 0.52, (r() - 0.5) * 0.12, H + 0.05, -h - 0.05 + k * 0.62, { r: 0.01, ry: (r() - 0.5) * 0.06 });
    bagRow(b, 0, h + 0.05, sz + 0.3, 2, 0, r, H + 0.1); bagRow(b, h + 0.05, 0, sz + 0.3, 2, Math.PI / 2, r, H + 0.1);
    for (const z of [-h - 0.1, h - 0.4]) b.box('#5a5045', 0.07, 1.25, 0.07, -h - 0.15, H + 0.1, z, { r: 0.01 });
    b.cbox('#6f8a8c', 0.04, 0.95, sz + 0.1, -h - 0.18, H + 0.75, -0.25, { r: 0.006, rz: 0.08 });
    for (const s of [-0.25, 0.25]) rod(b, '#6a5a48', [s, 0, h + 0.75], [s, H, h + 0.2], 0.06);
    for (let k = 1; k < 6; k++) { const t = k / 6; b.cbox('#7b6a52', 0.55, 0.05, 0.06, 0, H * t, h + 0.75 - 0.55 * t, { r: 0.005 }); }
    b.cbox(LANTERN, 0.14, 0.2, 0.14, -h - 0.15, H + 1.45, h - 0.4, { r: 0.02 });
    drum(b, 'rust', h + 0.5, -h - 0.2, 0.9); b.geo('tyre', new THREE.TorusGeometry(0.3, 0.12, 6, 10), -h - 0.3, 0.13, 0.4, Math.PI / 2, 0, 0);
  } else if (lvl === 2) {
    // holding on: a proper timber tower, braced, plank walls in a muted coat of paint, a shingle roof, a small flag
    H = 6.2; const sz = 2.5, h = sz / 2, paint = '#7f8a74', timber = '#6a5848';
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(timber, 0.18, H, 0.18, a * h, 0, c * h, { r: 0.03 });
    for (const y0 of [0.3, 3.2]) for (const [p, q] of [[[-h, y0, h], [h, y0 + 2.7, h]], [[h, y0, h], [-h, y0 + 2.7, h]], [[h, y0, -h], [h, y0 + 2.7, h]], [[h, y0, h], [h, y0 + 2.7, -h]], [[-h, y0, -h], [h, y0 + 2.7, -h]], [[-h, y0, -h], [-h, y0 + 2.7, h]]]) rod(b, 'wood2', p, q, 0.09);
    for (const y of [3.05, H - 0.1]) { b.cbox('wood2', sz, 0.12, 0.12, 0, y, h, { r: 0.01 }); b.cbox('wood2', sz, 0.12, 0.12, 0, y, -h, { r: 0.01 }); b.cbox('wood2', 0.12, 0.12, sz, h, y, 0, { r: 0.01 }); b.cbox('wood2', 0.12, 0.12, sz, -h, y, 0, { r: 0.01 }); }
    b.box('#7a6550', sz + 0.7, 0.14, sz + 0.7, 0, H, 0, { r: 0.02 });
    const ph = h + 0.32;
    for (const s of [-1, 1]) { b.cbox(paint, sz + 0.66, 1.0, 0.08, 0, H + 0.64, s * ph, { r: 0.01 }); b.cbox(paint, 0.08, 1.0, sz + 0.66, s * ph, H + 0.64, 0, { r: 0.01 }); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const c = shade(paint, -0.06), y = H + 0.4 + k * 0.32; b.cbox(c, sz + 0.68, 0.03, 0.09, 0, y, s * ph, { r: 0.003 }); b.cbox(c, 0.09, 0.03, sz + 0.68, s * ph, y, 0, { r: 0.003 }); }
    for (const s of [-1, 1]) { b.cbox('#4a3f35', sz + 0.74, 0.1, 0.16, 0, H + 1.17, s * ph, { r: 0.01 }); b.cbox('#4a3f35', 0.16, 0.1, sz + 0.74, s * ph, H + 1.17, 0, { r: 0.01 }); }
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(timber, 0.12, 2.1, 0.12, a * ph, H + 0.1, c * ph, { r: 0.02 });
    b.cyl('#5e4c3f', 0.04, (ph + 0.35) * Math.SQRT2, 1.5, 0, H + 2.15, 0, { seg: 4, ry: Math.PI / 4 }); b.cyl('#4a3f35', (ph + 0.36) * Math.SQRT2, (ph + 0.36) * Math.SQRT2, 0.1, 0, H + 2.12, 0, { seg: 4, ry: Math.PI / 4 });
    flag(b, 0, H + 3.55, 0, 1.1, 0.7);
    b.cbox(glass(o), 0.16, 0.22, 0.16, h + 0.2, H + 1.95, h + 0.2, { r: 0.02 });
    for (const s of [-0.28, 0.28]) b.box('#6a5848', 0.07, H, 0.07, s, 0, h + 0.18, { r: 0.01 });
    for (let k = 1; k < 10; k++) b.cbox('#7b6a52', 0.6, 0.05, 0.06, 0, k * H / 10, h + 0.18, { r: 0.005 });
    b.box('wood', 0.6, 0.5, 0.6, -h - 0.3, 0, h - 0.1, { r: 0.03, ry: 0.3 }); drum(b, '#5c6e78', h + 0.45, -h + 0.2, 0.9);
  } else {
    // thriving: a tall timber lookout — log legs braced in two stages, a plank-walled platform, a shingle roof,
    // a brazier and the camp's banners
    H = 7.4; const sz = 2.8, h = sz / 2, roofC = '#5a4636';
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(b, ['#7a5a3c', '#6c4f35'][(a + c + 2) / 2 % 2], [a * (h + 0.5), 0, c * (h + 0.5)], [a * h, H, c * h], 0.26);
    for (const [y0, y1, k0, k1] of [[0.4, 3.6, 0.45, 0.25], [3.8, 7.0, 0.24, 0.02]]) for (const [p, q] of [[[-1, 1], [1, 1]], [[1, -1], [1, 1]], [[-1, -1], [1, -1]], [[-1, -1], [-1, 1]]]) { rod(b, '#5f4530', [p[0] * (h + k0), y0, p[1] * (h + k0)], [q[0] * (h + k1), y1, q[1] * (h + k1)], 0.1); rod(b, '#5f4530', [q[0] * (h + k0), y0, q[1] * (h + k0)], [p[0] * (h + k1), y1, p[1] * (h + k1)], 0.1); }
    b.box('#86654a', sz + 1.0, 0.18, sz + 1.0, 0, H, 0, { r: 0.03 });
    const ph = h + 0.45;
    for (const s2 of [-1, 1]) { for (let k = 0; k < 3; k++) { b.cbox(k % 2 ? '#7a5a3c' : '#86654a', sz + 0.95, 0.3, 0.12, 0, H + 0.35 + k * 0.32, s2 * ph, { r: 0.02 }); b.cbox(k % 2 ? '#86654a' : '#7a5a3c', 0.12, 0.3, sz + 0.95, s2 * ph, H + 0.35 + k * 0.32, 0, { r: 0.02 }); } }
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box('#5f4530', 0.16, 2.3, 0.16, a * ph, H + 0.1, c * ph, { r: 0.02 });
    // [towers] a specialised tower trades its roof for its weapon (o.spec: mortar, brazier, ballista, bell)
    if (!o.spec) {
      b.geo(roofC, new THREE.ConeGeometry((ph + 0.5) * Math.SQRT2, 1.8, 4), 0, H + 3.3, 0, 0, Math.PI / 4, 0);
      b.cbox('#3e3026', 0.3, 0.6, 0.3, 0, H + 4.35, 0, { r: 0.04 });
      flag(b, 0, H + 4.5, 0, 1.6, 1.2);
    } else specTop(b, o.spec, H, ph);
    // the brazier at the front corner and a lantern on the other
    b.cyl('#3a3836', 0.38, 0.26, 0.45, ph - 0.4, H + 1.1, ph - 0.4, { seg: 8 }); b.cbox(LANTERN, 0.5, 0.18, 0.5, ph - 0.4, H + 1.6, ph - 0.4, { r: 0.05 });
    b.cbox(LANTERN, 0.2, 0.28, 0.2, -ph, H + 1.9, -ph + 0.3, { r: 0.03 });
    // two long banners in the camp colour hanging off the platform
    { const ban = o.spec ? SPEC_BANNER[o.spec] : 'amber'; for (const s2 of [-1, 1]) { b.cbox(ban, 0.06, 2.4, 0.8, s2 * (ph + 0.08), H - 1.15, 0, { r: 0.006 }); b.geo(ban, PEN, s2 * (ph + 0.08), H - 2.35, 0, 0, Math.PI / 2, 0, 2.3, 1.2, 1); } }
    // a ladder, sandbags and a barrel at the foot
    for (const s2 of [-0.3, 0.3]) rod(b, '#6a5848', [s2, 0, h + 1.3], [s2, H, h + 0.5], 0.07);
    for (let k = 1; k < 12; k++) { const t = k / 12; b.cbox('#7b6a52', 0.66, 0.06, 0.07, 0, H * t, h + 1.3 - 0.8 * t, { r: 0.005 }); }
    bagRow(b, -h - 0.4, 0, 2.4, 2, Math.PI / 2, r); drum(b, '#6a5440', h + 0.9, -h - 0.4, 0.9);
  }
  const g = b.build({ vc: true }); g.userData.top = H; return g;
}
const glass = o => (o.game ? WIN : 'glass');
// [towers] begin: the four roles, each readable from the top-down camera by its silhouette and banner colour
const SPEC_BANNER = { mortar: '#6f7a52', brazier: '#c8452a', ballista: '#3d6b9a', bell: '#d8b24a' };
function specTop(b, spec, H, ph) {
  const y = H + 0.18;
  if (spec === 'mortar') {
    // a sandbag ring round a fat iron tube cocked at the sky, shells stacked by it
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; b.box('bag', 0.62, 0.32, 0.38, Math.cos(a) * 1.15, y, Math.sin(a) * 1.15, { r: 0.1, ry: -a }); }
    b.cyl('#3a3b38', 0.62, 0.7, 0.35, 0, y, 0, { seg: 12 });
    b.cyl('#2b2c2a', 0.42, 0.5, 1.9, 0, y + 0.35, 0.15, { seg: 12, rx: -0.5 });
    b.cyl('#141414', 0.3, 0.3, 0.06, 0, y + 2.0, 0.95, { seg: 12, rx: -0.5 });
    for (let k = 0; k < 3; k++) b.cyl('#8a6a3a', 0.13, 0.13, 0.42, -0.95 + k * 0.3, y, -0.7, { seg: 8 });
  } else if (spec === 'brazier') {
    // a great iron fire bowl on a tripod, a ring of bright coals: the beacon of the camp
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; rod(b, '#2e2b28', [Math.cos(a) * 1.1, y, Math.sin(a) * 1.1], [Math.cos(a) * 0.5, y + 1.3, Math.sin(a) * 0.5], 0.12); }
    b.cyl('#3a3634', 1.25, 0.6, 0.8, 0, y + 1.2, 0, { seg: 14 });
    b.cyl(LANTERN, 1.12, 1.12, 0.12, 0, y + 1.9, 0, { seg: 14 });
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; b.sph(LANTERN, 0.28, Math.cos(a) * 0.6, y + 2.1, Math.sin(a) * 0.6, { detail: 0 }); }
    b.sph(LANTERN, 0.42, 0, y + 2.25, 0, { detail: 0 });
  } else if (spec === 'ballista') {
    // a giant crossbow on a turntable: a long stock, a bow of two arms, a bolt laid ready
    b.cyl('#4a3a2c', 0.9, 1.0, 0.3, 0, y, 0, { seg: 12 });
    b.box('#6a4a30', 0.36, 0.36, 3.4, 0, y + 0.5, 0.2, { r: 0.05 });
    for (const s2 of [-1, 1]) rod(b, '#3a3b40', [0, y + 0.85, 1.6], [s2 * 1.7, y + 0.85, 1.0], 0.13);
    for (const s2 of [-1, 1]) rod(b, '#d8d0c0', [s2 * 1.7, y + 0.85, 1.0], [0, y + 0.9, -0.9], 0.03);
    b.box('#9a9488', 0.08, 0.08, 2.9, 0, y + 0.9, 0.5, { r: 0.02 });
    b.geo('#c9c2b0', new THREE.ConeGeometry(0.12, 0.4, 6), 0, y + 0.94, 2.1, Math.PI / 2, 0, 0);
  } else if (spec === 'bell') {
    // a timber belfry with a bronze bell and a little roof: the watch rings it when they come
    for (const s2 of [-1, 1]) b.box('#5f4530', 0.22, 2.6, 0.22, s2 * 0.95, y, 0, { r: 0.03 });
    b.cbox('#5f4530', 2.3, 0.22, 0.3, 0, y + 2.6, 0, { r: 0.03 });
    b.geo('#5a4636', new THREE.ConeGeometry(1.6, 0.9, 4), 0, y + 3.15, 0, 0, Math.PI / 4, 0);
    b.cyl('#b8862e', 0.28, 0.72, 1.1, 0, y + 1.25, 0, { seg: 14 });
    b.cyl('#b8862e', 0.75, 0.75, 0.1, 0, y + 1.22, 0, { seg: 14 });
    b.sph('#8a6420', 0.12, 0, y + 1.1, 0, { detail: 0 });
  }
}
// [towers] end

/** barricades: 1 junk & chain-link, 2 wrecked cars + sandbags, 3 concrete T-walls + razor wire. len along x. */
function barricade(o = {}) {
  const lvl = o.level || 1, len = o.len || 10, r = rng(o.seed || 31), g = new THREE.Group(), b = new B();
  if (lvl === 1) {
    // posts and a chain-link screen, stuffed with junk
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 2.5) b.box('metal', 0.08, 2.2, 0.08, x, 0, 0, { r: 0.02 });
    b.cbox('metal', len, 0.05, 0.05, 0, 2.15, 0, { r: 0.01 });
    for (let k = 0; k < len / 1.1; k++) {
      const x = -len / 2 + 0.6 + k * 1.1 + (r() - 0.5) * 0.3, t = r();
      if (t < 0.3) b.box('wood', 1.2, 0.14, 1.0, x, 0, 0.6, { r: 0.02, rx: -0.9, ry: (r() - 0.5) * 0.4 });
      else if (t < 0.5) b.geo('tyre', new THREE.TorusGeometry(0.32, 0.14, 8, 14), x, 0.16, 0.6, Math.PI / 2, 0, 0);
      else if (t < 0.7) b.box('pale', 0.75, 1.6, 0.7, x, 0, 0.55, { r: 0.08, rz: (r() - 0.5) * 0.3 });
      else b.box('wood2', 1.0, 0.9, 0.6, x, 0, 0.5, { r: 0.04, ry: r() });
    }
    const fence = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.1), chainMat()); fence.position.set(0, 1.08, 0.02); g.add(fence);
  } else if (lvl === 2) {
    let x = -len / 2 + 2.1;
    while (x < len / 2 - 1.5) { const c = car({ wreck: true, seed: Math.floor(r() * 99), color: ['rust', 'stone', 'grey', 'dark'][Math.floor(r() * 4)] }); c.position.set(x, 0, 0); c.rotation.y = (r() - 0.5) * 0.25 + (r() < 0.3 ? Math.PI : 0); g.add(c); x += 4.3; }
    const sb = sandbags(len, 3); sb.position.set(0, 0, 1.4); g.add(sb);
  } else {
    for (let x = -len / 2 + 0.9; x < len / 2; x += 1.25) {
      b.box('pale', 1.2, 3.2, 0.32, x, 0.18, 0, { r: 0.05 });
      b.box('pale', 1.2, 0.36, 1.3, x, 0, 0, { r: 0.06 });
      b.cbox('stone', 1.16, 0.05, 0.34, x, 3.25, 0, { r: 0.01 });
    }
    for (let k = 0; k < len / 0.38; k++) b.geo('steel', new THREE.TorusGeometry(0.25, 0.012, 4, 10), -len / 2 + 0.2 + k * 0.38, 3.6, 0, 0, 0.35, 0);
    // a stencil band in your colour
    for (let x = -len / 2 + 0.9; x < len / 2; x += 2.5) b.cbox('amber', 1.0, 0.28, 0.04, x, 1.6, 0.18, { r: 0.01 });
  }
  g.add(b.build()); return g;
}
/** one barricade post for the game: a 2.2 m cell, joined toward linked sides (links: {e,w,s,n}). */
function post(level, links, seed = 1) {
  const b = new B(), r = rng(seed), g = new THREE.Group(), half = 1.1;
  const dirs = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };
  const sides = Object.keys(dirs).filter(k => links[k]);
  if (!sides.length) sides.push('e', 'w');
  if (level === 1) {
    b.box('metal', 0.09, 2.0, 0.09, 0, 0, 0, { r: 0.02 });
    for (const k of sides) {
      const [dx, dz] = dirs[k];
      b.cbox('metal', dx ? half : 0.05, 0.05, dz ? half : 0.05, dx * half / 2, 1.95, dz * half / 2, { r: 0.01 });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(half, 1.9), chainMat()); f.position.set(dx * half / 2, 0.97, dz * half / 2); f.rotation.y = dx ? 0 : Math.PI / 2; g.add(f);
      const t = r();
      if (t < 0.3) b.box('wood', 0.9, 0.12, 0.8, dx * 0.55, 0, dz * 0.55 + (dx ? 0.45 : 0), { r: 0.02, rx: -0.8 });
      else if (t < 0.55) b.geo('tyre', new THREE.TorusGeometry(0.3, 0.13, 6, 12), dx * 0.5 + (dz ? 0.45 : 0), 0.14, dz * 0.5 + (dx ? 0.45 : 0), Math.PI / 2, 0, 0);
      else if (t < 0.7) b.box('pale', 0.7, 1.5, 0.6, dx * 0.55 + (dz ? 0.4 : 0), 0, dz * 0.55 + (dx ? 0.4 : 0), { r: 0.08, rz: (r() - 0.5) * 0.3 });
    }
  } else if (level === 2) {
    for (const k of sides) {
      const [dx, dz] = dirs[k];
      for (let row = 0; row < 4; row++) for (let q = 0; q < 2; q++) {
        const t = (q + 0.5 + (row % 2) * 0.25) * half / 2.2;
        b.box('bag', dx ? 0.6 : 0.42, 0.27, dz ? 0.6 : 0.42, dx * t, row * 0.25, dz * t, { r: 0.1, ry: (r() - 0.5) * 0.15 });
      }
    }
    b.box('bag', 0.62, 1.0, 0.62, 0, 0, 0, { r: 0.12 });
    b.cbox('rust', 0.06, 1.6, 1.0, 0, 1.4, 0, { r: 0.01, ry: r() * 3, rz: 0.1 });
  } else {
    for (const k of sides) {
      const [dx, dz] = dirs[k];
      b.box('pale', dx ? half : 0.34, 3.0, dz ? half : 0.34, dx * half / 2, 0.2, dz * half / 2, { r: 0.05 });
      b.box('pale', dx ? half : 1.2, 0.36, dz ? half : 1.2, dx * half / 2, 0, dz * half / 2, { r: 0.06 });
      for (let q = 0; q < 3; q++) b.geo('steel', new THREE.TorusGeometry(0.24, 0.012, 4, 10), dx * (q + 0.5) * half / 3, 3.45, dz * (q + 0.5) * half / 3, 0, dx ? 0.35 : Math.PI / 2 + 0.35, 0);
      b.cbox('amber', dx ? 0.7 : 0.04, 0.26, dz ? 0.7 : 0.04, dx * half / 2, 1.5, dz * half / 2 + (dx ? 0.18 : 0), { r: 0.01 });
    }
    b.box('stone', 0.5, 3.3, 0.5, 0, 0, 0, { r: 0.05 });
    b.cbox('amber', 0.54, 0.3, 0.54, 0, 2.6, 0, { r: 0.02 });
    if (seed % 3 === 0) flag(b, 0, 3.3, 0, 1.3, 0.75);   // the town's pennant on every third post
  }
  g.add(b.build());
  return g;
}
let chainCache = null;
function chainMat() {
  if (chainCache) return chainCache;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.strokeStyle = 'rgba(150,152,150,0.95)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 7);
  chainCache = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
  return chainCache;
}

export { tower, barricade, post, chainMat };
