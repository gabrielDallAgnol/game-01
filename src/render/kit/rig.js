// Hollowmere city kit · People and the dead: the low-poly figure rig (body, head, hair, outfit), welded into few meshes.
/* global THREE */
import { CFG } from './config.js';
import { territory } from './territory.js';
import { M } from './materials.js';
import { rng } from './rng.js';
import { glowSprite } from './helpers.js';
import { PAL } from '../palette.js';

// ======================================================================
// PEOPLE & THE DEAD — stylised low-poly figures: ~1.75 m, a big readable head, short legs, chunky hands and boots
// ======================================================================
// A joint hierarchy (hips → spine → neck → head; shoulder → elbow → hand; hip → knee → ankle) whose pieces are then
// welded into ONE flat-shaded vertex-coloured mesh per joint: no joint balls, ~16 draw calls for a live figure,
// a few hundred triangles once baked for the crowd.
// pose angles: rotation.x < 0 swings a limb forward; rotation.z swings an arm out to the side
const FIGMAT = territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
// people colours (hex, linearised by M)
const C = {
  cape: '#d9822b', capeIn: '#6e3a1c', scarf: '#f0a040', leather: '#5a3d29', leather2: '#7a5434', belt: '#3a2a20', buckle: '#d8b25a',
  shirt: '#d9c8a2', shirtB: '#4f6f8f', denim: '#3e5a78', olive: '#56603e', khaki: '#8a7a58', forest: '#3f5a36', tabard: '#cf8a32', mail: '#8b9094', helm: '#7b8286',
  hairDark: '#2a221d', hairBrown: '#5a3922', hairAuburn: '#8a4326', hairBlond: '#d2a95e', hairGrey: '#9a9690', hairBlack: '#1e1c1b',
  // the Ash-Born: charcoal-black skin cracked with ember; clothes keep their kind's colour
  zskin: PAL.ash.skin, zskin2: PAL.ash.skin2, zrot: PAL.ash.rot, wound: PAL.ember, zshirt: '#5b5765', zshirt2: '#6a6170', zpants: '#45424d', zpants2: '#3c3a44',
};
const SKINS = ['#efc3a0', '#d9a47e', '#b07a55', '#7d5136'];
// a lathe from [radius, y] pairs (bottom to top), flat faces front/back/sides
const lathe = (pts, n = 8) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n, Math.PI / n);
// a limb hanging along -y: a tapered tube with a domed top that hides the joint when it bends
const seg = (len, r0, r1, n = 6, dome = 2) => lathe(dome > 1 ? [[r1, -len], [r0, 0], [r0 * 0.62, r0 * 0.62], [0, r0 * 0.85]] : [[r1, -len], [r0, 0], [0, r0 * 0.75]], n);
// a torn edge: drop every other vertex of a cylinder's bottom ring
function ragged(g, depth, seed = 1) {
  const p = g.attributes.position, r = rng(seed); let lo = Infinity; for (let i = 0; i < p.count; i++) lo = Math.min(lo, p.getY(i));
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - lo) < 1e-5) { const a = Math.atan2(p.getX(i), p.getZ(i)); const k = Math.round((a + Math.PI) / (Math.PI / 4)); if (k % 2) p.setY(i, lo - depth * (0.6 + r() * 0.6)); }
  return g;
}
// the same surface seen from inside (capes, coat linings)
function flip(g) {
  g = g.index ? g.toNonIndexed() : g.clone(); const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  return g;
}
const bone = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.userData.bone = true; g.position.set(x, y, z); parent.add(g); return g; };
function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; return m; }
// add a piece to a joint: colour is a palette key, '#hex' or a material
function pc(parent, geo, col, x = 0, y = 0, z = 0, o = {}) {
  const m = mesh(geo, typeof col === 'object' ? col : M(col), x, y, z, ...(o.s || [1, 1, 1]));
  m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); if (o.smooth) m.userData.smooth = true; parent.add(m); return m;
}
// weld every joint's pieces (props included) into one mesh; glowing or see-through pieces stay separate
const _wm = new THREE.Matrix4(), _wi = new THREE.Matrix4(), _wa = new THREE.Vector3(), _wb = new THREE.Vector3(), _wc = new THREE.Vector3();
function solid(g) {
  const p = g.attributes.position, keep = [];
  for (let i = 0; i < p.count; i += 3) { _wa.fromBufferAttribute(p, i); _wb.fromBufferAttribute(p, i + 1).sub(_wa); _wc.fromBufferAttribute(p, i + 2).sub(_wa); if (_wb.cross(_wc).lengthSq() > 1e-12) keep.push(i); }
  if (keep.length * 3 === p.count) return g;
  const out = new THREE.BufferGeometry();
  for (const k of Object.keys(g.attributes)) { const a = g.attributes[k], s = a.itemSize, arr = new Float32Array(keep.length * 3 * s); keep.forEach((i, j) => arr.set(a.array.subarray(i * s, (i + 3) * s), j * 3 * s)); out.setAttribute(k, new THREE.BufferAttribute(arr, s)); }
  return out;
}
function weld(root) {
  root.updateMatrixWorld(true);
  const bones = []; root.traverse(o => { if (o.userData.bone) bones.push(o); });
  for (const b of bones) {
    _wi.copy(b.matrixWorld).invert();
    const list = [];
    const walk = o => { for (const c of o.children) { if (c.userData.bone) continue; const mt = c.material; if (c.isMesh && !(mt.emissive && mt.emissiveIntensity > 1.5) && !mt.transparent && !mt.vertexColors) list.push(c); walk(c); } };
    walk(b); if (!list.length) continue;
    const geos = list.map(m => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && !(k === 'normal' && m.userData.smooth)) g.deleteAttribute(k);
      g.applyMatrix4(_wm.multiplyMatrices(_wi, m.matrixWorld)); g = solid(g);
      if (!m.userData.smooth) g.computeVertexNormals();      // non-indexed: one normal per face (flat)
      const n = g.attributes.position.count, a = new Float32Array(n * 3), c = m.material.color;
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return g;
    });
    for (const m of list) m.parent.remove(m);
    const w = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false), FIGMAT); w.castShadow = true; w.receiveShadow = true;
    b.add(w);
  }
  // props leave empty holders behind
  root.traverse(o => { for (let i = o.children.length - 1; i >= 0; i--) { const c = o.children[i]; if (c.isGroup && !c.userData.bone && !c.children.length) o.remove(c); } });
}
// shared shapes (built once)
const G = {};
const geo = (k, make) => G[k] || (G[k] = make());

function hair(head, F, R) {
  const st = F.hairStyle || 'short', col = F.hair;
  if (!col || st === 'bald') return;
  const cap = geo('hairCap', () => new THREE.SphereGeometry(R * 1.07, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.52));
  if (st === 'patchy') { pc(head, geo('patch', () => new THREE.SphereGeometry(R * 1.05, 6, 2, 0, Math.PI * 2, 0, Math.PI * 0.32)), col, 0, 0.0, -0.02, { rz: 0.5, rx: -0.4 }); return; }
  pc(head, cap, col, 0, 0.012, -0.012, { s: st === 'mop' ? [1.08, 1.05, 1.1] : [1, 1, 1.04] });
  if (st === 'quiff') pc(head, geo('tuft', () => new THREE.IcosahedronGeometry(0.075, 0)), col, 0.02, R * 0.88, R * 0.55, { s: [1.5, 0.75, 1], rx: -0.4 });
  if (st === 'mop') pc(head, geo('mop', () => new THREE.IcosahedronGeometry(R, 0)), col, 0, -0.01, -0.06, { s: [1.02, 0.85, 0.9] });
  if (st === 'long') pc(head, geo('long', () => new THREE.IcosahedronGeometry(R, 0)), col, 0, -0.08, -0.07, { s: [1.05, 1.15, 0.75] });
  if (st === 'bun') pc(head, geo('bun', () => new THREE.IcosahedronGeometry(0.07, 0)), col, 0, R * 0.75, -R * 0.75);
  if (st === 'pony') pc(head, geo('pony', () => new THREE.CylinderGeometry(0.045, 0.02, 0.24, 5)), col, 0, -0.02, -R * 1.1, { rx: 0.35 });
}


// [look3] Ash-Born cracks: thin ember veins on the skin. Emissive ei 2 (the eyes are 6): bake() sends them to the glow mesh,
// scaled down by ei/6, so they read orange at game zoom without blooming white. A zig-zag of 3 slim boxes per crack.
const CRACK = () => M('toxic', { emissive: PAL.ember, ei: 2 });
function zig(parent, pts, w, d) {   // pts: [x,y,z] polyline; one slim box per segment
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 0.05;
    const m = mesh(geo('crk' + len.toFixed(3) + w, () => new THREE.BoxGeometry(w, len, d)), CRACK(), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.rotation.z = -Math.atan2(dx, dy); parent.add(m);
  }
}
function crackHead(hg, R) {   // a vein over the crown (read from above) and one down the forehead
  zig(hg, [[0.05, R * 0.98, 0.0], [-0.03, R * 0.97, -0.07], [0.04, R * 0.9, -0.13]].map(([x, y, z]) => [x, y, z]), 0.018, 0.05);
  zig(hg, [[-0.07, R * 0.45, R * 0.9], [-0.03, R * 0.2, R * 0.97], [-0.09, -0.01, R * 0.95]], 0.016, 0.02);
}
function crackTorso(spine, cr, cd, chestH, bw) {   // chest, shoulders and back
  const zf = cr * 0.66 * cd + 0.004;
  zig(spine, [[0.03 * bw, chestH * 0.85, zf], [-0.04 * bw, chestH * 0.68, zf + 0.004], [0.04 * bw, chestH * 0.5, zf + 0.004], [-0.02 * bw, chestH * 0.3, zf]], 0.022, 0.02);
  zig(spine, [[-0.1 * bw, chestH * 0.78, zf - 0.01], [-0.15 * bw, chestH * 0.6, zf - 0.03]], 0.018, 0.02);
  zig(spine, [[-0.05 * bw, chestH * 0.95, -zf], [0.04 * bw, chestH * 0.7, -zf], [-0.03 * bw, chestH * 0.42, -zf]], 0.022, 0.02);
  zig(spine, [[0.0, chestH * 1.03, 0.02], [0.08 * bw, chestH * 1.0, -0.06]], 0.02, 0.06);   // across the shoulders, seen from above
}
/**
 * rig({ outfit, pose, bw (body width), bh (height), belly, chestDepth, scale, eyes, props })
 * outfit: { top, sleeve, legs, boots, skin, hair, hairStyle (short|quiff|mop|long|bun|pony|patchy|bald), beard,
 *           hood, cap, beanie, helmet, pack, vest, coat, cape, scarf, apron, belt, tabard, bareArms, sleeveless, torn, wounds, belly }
 * pose: { lean, twist, neck, head, headTilt, sL:[x,y,z], sR, eL, eR, hL:[x,z], hR, kL, kR }
 */
function rig(o = {}) {
  const F = o.outfit || {}, P = o.pose || {}, bw = o.bw || 1, bh = o.bh || 1, cd = o.chestDepth || 1, sw = Math.sqrt(bw);
  const top = F.top || 'cloth1', sleeve = F.sleeve || top, legs = F.legs || 'cloth3', boots = F.boots || 'tyre', skin = F.skin || 'skin', z = o.eyes;
  const seed = o.seed || 7;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const thigh = 0.36 * bh, shin = 0.33 * bh, hipH = thigh + shin + 0.1;
  // pelvis: trousers, with a belt
  const hips = bone(body, 0, hipH, 0);
  const hr = 0.172 * bw;
  pc(hips, geo('pelvis' + bw, () => lathe([[0, -0.13], [hr * 0.88, -0.1], [hr, -0.01], [hr * 0.98, 0.1]])), legs, 0, 0, 0, { s: [1, 1, 0.7 * cd] });
  if (F.belt) { pc(hips, geo('belt' + bw, () => new THREE.CylinderGeometry(hr * 1.04, hr * 1.04, 0.055, 8, 1, true)), F.belt, 0, 0.07, 0, { s: [1, 1, 0.72 * cd] }); pc(hips, geo('buckle', () => new THREE.BoxGeometry(0.06, 0.05, 0.03)), C.buckle, 0, 0.07, hr * 0.72 * cd); }
  if (F.apron) pc(hips, geo('apron', () => new THREE.BoxGeometry(0.28 * bw, 0.4, 0.02)), F.apron, 0, -0.12, hr * 0.74 * cd);
  // spine & chest: a broad-shouldered barrel, flattened front to back
  const spine = bone(hips, 0, 0.07, 0); spine.rotation.x = P.lean || 0; spine.rotation.y = P.twist || 0;
  const chestH = 0.5 * bh, wr = 0.17 * bw, cr = 0.215 * bw;
  const torso = geo(`torso${bw}|${bh}`, () => lathe([[wr * 0.98, -0.04], [wr * 1.04, chestH * 0.36], [cr, chestH * 0.7], [cr, chestH * 0.84], [cr * 0.8, chestH * 0.95], [cr * 0.42, chestH * 1.02], [0, chestH * 1.04]]));
  pc(spine, torso, top, 0, 0, 0, { s: [1, 1, 0.66 * cd] });
  if (F.torn) { // a ragged shirt-tail over the trousers
    pc(spine, geo('hem' + bw, () => ragged(new THREE.CylinderGeometry(wr * 1.04, wr * 1.1, 0.12, 8, 1, true), 0.07, seed)), top, 0, -0.04, 0, { s: [1, 1, 0.7 * cd] });
  }
  if (o.belly) pc(spine, geo('belly', () => new THREE.SphereGeometry(0.2, 8, 6)), F.belly || top, 0, 0.17, 0.07, { s: [o.belly, o.belly * 0.88, o.belly * 0.85] });
  if (F.vest) pc(spine, geo('vest' + bw, () => lathe([[wr * 1.07, 0.03], [wr * 1.1, chestH * 0.36], [cr * 1.04, chestH * 0.7], [cr * 0.98, chestH * 0.82]])), F.vest, 0, 0, 0, { s: [1, 1, 0.7 * cd] });
  if (F.tabard) pc(spine, geo(`tabard${bw}|${bh}`, () => lathe([[hr * 1.22, -0.3], [wr * 1.1, 0.0], [wr * 1.12, chestH * 0.36], [cr * 1.05, chestH * 0.7], [cr * 0.99, chestH * 0.8]])), F.tabard, 0, 0, 0, { s: [1, 1, 0.72 * cd] });
  if (F.coat) { // a long coat skirt from the waist, open at the front
    const sk = geo('coat' + bw, () => new THREE.CylinderGeometry(wr * 1.1, wr * 1.55, 0.48, 7, 1, true, Math.PI * 0.2, Math.PI * 1.6));
    pc(spine, sk, F.coat, 0, -0.2, 0, { s: [1, 1, 0.78 * cd] }); pc(spine, flip(sk), F.coatIn || 'tyre', 0, -0.2, 0, { s: [0.97, 1, 0.76 * cd] });
  }
  if (F.cape) { // the hero's cape: hangs off the shoulders, flares back
    const cp = geo('cape' + bw, () => new THREE.CylinderGeometry(cr * 0.95, cr * 1.55, 0.78, 6, 1, true, Math.PI * 0.6, Math.PI * 0.8));
    pc(spine, cp, F.cape, 0, chestH * 0.92 - 0.39, -0.03, { s: [1, 1, 0.82 * cd], rx: 0.12 }); pc(spine, flip(cp), F.capeIn || C.capeIn, 0, chestH * 0.92 - 0.39, -0.03, { s: [0.97, 1, 0.8 * cd], rx: 0.12 });
  }
  if (F.mantle) { // a short shoulder cape: the hero's colour reads from every side and from above
    const mt = geo(`mantle${bw}|${bh}`, () => new THREE.LatheGeometry([[cr * 1.16, chestH * 0.56], [cr * 1.1, chestH * 0.8], [cr * 0.82, chestH * 0.98], [cr * 0.5, chestH * 1.04]].map(([r, y]) => new THREE.Vector2(r, y)), 7, Math.PI * 0.2, Math.PI * 1.6));
    pc(spine, mt, F.mantle, 0, 0, -0.005, { s: [1, 1, 0.74 * cd] }); pc(spine, flip(mt), F.capeIn || C.capeIn, 0, 0, -0.005, { s: [0.98, 1, 0.72 * cd] });
  }
  if (F.pack) {
    pc(spine, geo('pack', () => new THREE.BoxGeometry(0.3, 0.36, 0.17)), F.pack, 0, chestH * 0.52, -cr * 0.66 * cd - 0.07);
    pc(spine, geo('roll', () => new THREE.CylinderGeometry(0.07, 0.07, 0.36, 6)), F.roll || C.olive, 0, chestH * 0.52 + 0.24, -cr * 0.66 * cd - 0.07, { rz: Math.PI / 2 });
    pc(spine, geo('flap', () => new THREE.BoxGeometry(0.31, 0.12, 0.18)), F.packFlap || C.leather, 0, chestH * 0.52 + 0.12, -cr * 0.66 * cd - 0.075);
  }
  if (F.wounds) for (const [x, y, zz, s] of [[0.08, chestH * 0.55, 1, 1], [-0.06, chestH * 0.6, -1, 1.2]]) pc(spine, geo('wound', () => new THREE.BoxGeometry(0.09, 0.08, 0.04)), F.wounds, x * bw, y, zz * cr * 0.6 * cd, { s: [s, s, 1], rz: x * 4 });
  if (z && !o.noCracks) crackTorso(spine, cr, cd, chestH, bw);   // [look3] ember cracks
  // neck & head: the head is big — it is what you read from above
  const neck = bone(spine, 0, chestH * 0.98, 0); neck.rotation.x = P.neck || 0;
  pc(neck, geo('neck', () => new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6, 1, true)), skin, 0, 0.03, 0);
  if (F.scarf) { pc(neck, geo('scarf', () => new THREE.CylinderGeometry(0.11, 0.15, 0.1, 8)), F.scarf, 0, 0.0, 0, { s: [1, 1, 0.9] }); pc(neck, geo('scarfTail', () => new THREE.BoxGeometry(0.08, 0.26, 0.03)), F.scarf, 0.06, -0.12, -0.13, { rx: 0.25, rz: 0.15 }); }
  const head = bone(neck, 0, 0.07, 0); head.rotation.x = P.head || 0; head.rotation.z = P.headTilt || 0;
  const R = 0.165;
  const hg = new THREE.Group(); hg.position.y = R * 0.85; head.add(hg);  // head centre
  pc(hg, geo('head', () => new THREE.SphereGeometry(R, 8, 6, Math.PI / 8)), skin, 0, 0, 0, { s: z ? [0.95, 1.02, 1] : [1, 1.04, 1] });
  if (z) {
    const em = M('toxic', { emissive: PAL.emberHot, ei: o.eyesI || 6 }), es = 0.018 * (CFG.eyeScale || 1);
    pc(hg, geo('brow', () => new THREE.BoxGeometry(0.2, 0.055, 0.04)), '#2a2724', 0, 0.005, R * 0.86);
    for (const x of [-0.058, 0.058]) hg.add(mesh(geo('eye' + es, () => new THREE.IcosahedronGeometry(es, 0)), em, x * (CFG.eyeScale > 1 ? 1.08 : 1), 0.0, R * 0.95));
    pc(hg, geo('maw', () => new THREE.BoxGeometry(0.09, 0.035, 0.03)), C.wound, 0.01, -0.085, R * 0.88, { rz: 0.15 });
    if (!o.noCracks) crackHead(hg, R);
    if (o.eyeGlow) { const sp = glowSprite(PAL.ember, o.eyeGlow, 1.3); sp.position.set(0, 0, 0.12); hg.add(sp); }
  } else {
    for (const x of [-0.06, 0.06]) pc(hg, geo('eyeD', () => new THREE.BoxGeometry(0.028, 0.045, 0.02)), C.hairBlack, x, 0.0, R * 0.95);
    pc(hg, geo('nose', () => new THREE.BoxGeometry(0.035, 0.05, 0.04)), skin, 0, -0.035, R * 0.98);
  }
  if (F.beard) pc(hg, geo('beard', () => new THREE.IcosahedronGeometry(0.1, 0)), F.beard, 0, -0.1, 0.07, { s: [1.45, 0.85, 0.85] });
  if (F.hood) { // hood up: a big rounded shape, the face showing
    const hd = geo('hood', () => new THREE.SphereGeometry(R * 1.22, 8, 5, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.7));
    pc(hg, hd, F.hood, 0, 0.0, -0.03, { rx: -0.75 }); pc(hg, flip(hd), F.hoodIn || C.belt, 0, 0.0, -0.03, { rx: -0.75, s: [0.97, 0.97, 0.97] });
    pc(hg, geo('hoodDrape', () => new THREE.IcosahedronGeometry(0.17, 0)), F.hood, 0, -0.17, -0.1, { s: [1.3, 0.75, 0.9] });
  } else if (F.helmet) {
    pc(hg, geo('helm', () => new THREE.SphereGeometry(R * 1.13, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.5)), F.helmet, 0, 0.02, 0);
    pc(hg, geo('helmRim', () => new THREE.CylinderGeometry(R * 1.28, R * 1.28, 0.03, 8)), F.helmet, 0, 0.02, 0);
    hair(hg, { ...F, hairStyle: F.hairStyle === 'long' ? 'long' : 'bald' }, R);
  } else if (F.cap) {
    pc(hg, geo('capDome', () => new THREE.SphereGeometry(R * 1.08, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.5)), F.cap, 0, 0.03, -0.005, { s: [1, 0.85, 1.02] });
    pc(hg, geo('brim', () => new THREE.BoxGeometry(0.2, 0.025, 0.13)), F.cap, 0, 0.04, R * 1.05, { rx: 0.12 });
    hair(hg, { ...F, hairStyle: ['long', 'pony'].includes(F.hairStyle) ? F.hairStyle : 'bald' }, R);
  } else if (F.beanie) {
    pc(hg, geo('beanie', () => new THREE.SphereGeometry(R * 1.1, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.5)), F.beanie, 0, 0.02, -0.005, { s: [1, 1.08, 1.02] });
    pc(hg, geo('beanieRim', () => new THREE.CylinderGeometry(R * 1.13, R * 1.13, 0.06, 8)), F.beanie, 0, 0.04, -0.005);
  } else hair(hg, F, R);
  // arms: the domed top of the upper arm is the shoulder
  const arms = {}, shoulders = {};
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'L' : 'R', sh = bone(spine, side * 0.232 * bw, chestH * 0.8, 0);
    const a = P['s' + k] || [0, 0, 0]; sh.rotation.set(a[0], a[1] || 0, side * (0.1 + (a[2] || 0)));
    const ua = 0.27 * bh, fa = 0.24 * bh, torn = F.torn && side < 0;
    pc(sh, geo(`ua${ua}|${sw}`, () => seg(ua + 0.02, 0.078 * sw, 0.064 * sw)), F.sleeveless ? skin : sleeve);
    if (torn && !F.sleeveless && !F.bareArms) pc(sh, geo('cuff' + sw, () => ragged(new THREE.CylinderGeometry(0.068 * sw, 0.072 * sw, 0.06, 6, 1, true), 0.05, seed + 3)), sleeve, 0, -ua + 0.04, 0);
    const el = bone(sh, 0, -ua, 0); el.rotation.x = P['e' + k] ?? -0.15;
    pc(el, geo(`fa${fa}|${sw}`, () => seg(fa, 0.064 * sw, 0.054 * sw, 6, 1)), F.bareArms || F.sleeveless || torn ? skin : sleeve);
    const hand = bone(el, 0, -fa - 0.02, 0);
    pc(hand, geo('mitt', () => new THREE.IcosahedronGeometry(0.068, 0)), F.gloves || skin, 0, -0.035, 0.005, { s: [0.85, 1.1, 1] });
    arms[k] = hand; shoulders[k] = sh;
  }
  // legs, chunky boots
  const feet = [];
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'L' : 'R', hp = new THREE.Group(); hp.userData.bone = true; hp.position.set(side * 0.092 * bw, -0.02, 0);
    hp.rotation.x = P['h' + k] ? P['h' + k][0] : 0; hp.rotation.z = P['h' + k] ? (P['h' + k][1] || 0) * side : 0; hips.add(hp);
    const kn = bone(hp, 0, -thigh, 0); kn.rotation.x = P['k' + k] ?? 0;      // the knee is the leg's first group (strideFrame/liveRig rely on it)
    pc(hp, geo(`th${thigh}|${sw}`, () => seg(thigh + 0.02, 0.105 * sw, 0.082 * sw)), legs);
    pc(kn, geo(`sh${shin}|${sw}`, () => seg(shin, 0.082 * sw, 0.068 * sw, 6, 1)), legs);
    pc(kn, geo('bootTop' + sw, () => new THREE.CylinderGeometry(0.08 * sw, 0.082 * sw, 0.12, 6, 1, true)), boots, 0, -shin + 0.06, 0);
    const an = bone(kn, 0, -shin, 0); an.rotation.x = -(hp.rotation.x + kn.rotation.x) * 0.8;
    const ft = pc(an, geo('boot', () => new THREE.BoxGeometry(0.15, 0.12, 0.27)), boots, 0, -0.045, 0.045); feet.push(ft);
    if (F.sole !== false) pc(an, geo('sole', () => new THREE.BoxGeometry(0.155, 0.03, 0.28)), F.sole || C.belt, 0, -0.095, 0.045);
  }
  // props in the hands (or anywhere)
  if (o.props) o.props({ hand: arms.R, handL: arms.L, spine, head: hg });
  // plant the feet: lift or drop the body so the lowest boot touches the ground
  root.updateMatrixWorld(true);
  let minY = Infinity; const v = new THREE.Vector3();
  for (const f of feet) { f.geometry.computeBoundingBox(); const bb = f.geometry.boundingBox; for (const x of [bb.min.x, bb.max.x]) for (const zz of [bb.min.z, bb.max.z]) { v.set(x, bb.min.y - 0.03 / f.scale.y, zz).applyMatrix4(f.matrixWorld); minY = Math.min(minY, v.y); } }
  body.position.y = -minY + (o.lift || 0);
  weld(root);
  root.scale.setScalar(o.scale || 1);
  root.userData.joints = { body, hips, spine, neck, head, sL: shoulders.L, sR: shoulders.R, hand: arms.R, handL: arms.L };
  root.userData.legs = hips.children.filter(c => c.isGroup && c !== spine);
  return root;
}

export { FIGMAT, C, SKINS, mesh, pc, geo, rig };
