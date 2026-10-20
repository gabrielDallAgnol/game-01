// Hollowmere city kit · Hives (nests): landmark buildings the dead pour out of.
/* global THREE */
import { CFG } from './config.js';
import { lin } from './palette.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { sign, glowDecal, glowSprite } from './helpers.js';
import { apartment } from './city.js';
import { car } from './street.js';

// ======================================================================
// HIVES (nests): landmark buildings the dead pour out of
// ======================================================================
function hiveFx(g, x, y, z, r, night) {
  const f = CFG.hiveGlow ?? 1;
  const d = glowDecal('#8fff3a', r * 1.6, (night ? 1.4 : 0.55) * f); d.position.set(x, y + 0.02, z); g.add(d);
  if (night) { const l = new THREE.PointLight(lin('#8fff3a'), 2.4 * f, r * 3.5, 2); l.position.set(x, y + 2.5, z); g.add(l); }
  for (let k = 0; k < 7; k++) { const s = glowSprite('#9dff4a', 3 + k * 0.6, (night ? 0.35 : 0.14) * f); s.position.set(x + Math.cos(k * 2.1) * r * 0.5, y + 1 + k * 0.7, z + Math.sin(k * 2.1) * r * 0.5); g.add(s); }
}
function hospital(o = {}) {
  const g = new THREE.Group();
  const a = apartment({ w: 22, d: 13, floors: 5, color: 'pale', trim: 'stone', ruin: o.cleared ? 0.15 : 0.35, seed: 77, shop: false, burnt: !o.cleared, roofStuff: true });
  g.add(a);
  const s = sign('HOSPITAL', 7, 1.2, { bg: '#e7e1d3', fg: o.cleared ? '#c0782a' : '#3c4a2f', size: 84 }); s.position.set(0, 3.0, 6.62); g.add(s);
  const cross = new B(); cross.cbox(o.cleared ? 'amber' : 'danger', 1.6, 0.5, 0.1, -5.5, 3.0, 6.6, { r: 0.02 }); cross.cbox(o.cleared ? 'amber' : 'danger', 0.5, 1.6, 0.1, -5.5, 3.0, 6.6, { r: 0.02 }); g.add(cross.build());
  // entrance canopy and ambulances
  const c = new B(); c.cbox('pale', 8, 0.35, 4, 0, 3.0, 8.6, { r: 0.08 }); for (const x of [-3.6, 3.6]) c.box('pale', 0.3, 2.85, 0.3, x, 0, 10.3, { r: 0.04 }); g.add(c.build());
  for (const [x, ry] of [[-2, 0.3], [3.2, -0.5]]) { const am = car({ color: 'pale', wreck: !o.cleared, seed: 3 }); am.scale.set(1.25, 1.4, 1.15); am.position.set(x, 0, 12.5); am.rotation.y = ry; g.add(am); }
  if (!o.cleared) hiveFx(g, 0, 0, 9.5, 5, o.night);
  return g;
}
function metro(o = {}) {
  const g = new THREE.Group(), b = new B();
  b.box('stone', 7.5, 0.3, 4.6, 0, 0, 0, { r: 0.05 });
  b.cbox('dark', 3.0, 0.5, 4.0, 0, 0.1, 0.2, { r: 0.02 });
  for (let k = 0; k < 7; k++) b.box('slab', 2.8, 0.2, 0.42, 0, -0.1 - k * 0.0, 2.0 - k * 0.55, { r: 0.02, rx: 0 });
  for (const x of [-1.7, 1.7]) { b.box('metal', 0.06, 1.0, 0.06, x, 0.3, 2.2); b.box('metal', 0.06, 1.0, 0.06, x, 0.3, -2.0); b.cbox('steel', 0.08, 0.08, 4.4, x, 1.3, 0.1, { r: 0.02 }); b.box('pale', 0.3, 1.0, 4.4, x * 1.25, 0.3, 0.1, { r: 0.04 }); }
  b.box('metal', 0.14, 3.6, 0.14, 2.9, 0.3, 2.0, { r: 0.03 });
  g.add(b.build());
  const s = sign('M', 1.1, 1.1, { bg: o.cleared ? '#c0782a' : '#203018', fg: o.cleared ? '#fff3dc' : '#b4ff4e', size: 96, w: 128, h: 128, glow: o.cleared ? null : '#8fff3a', ei: o.night ? 3 : 1 });
  s.position.set(2.9, 4.3, 2.08); g.add(s);
  if (!o.cleared) { hiveFx(g, 0, 0.3, 0.6, 3.6, o.night); const pit = glowDecal('#b4ff4e', 1.6, (o.night ? 3 : 1.4) * (CFG.hiveGlow ?? 1)); pit.position.set(0, 0.35, -0.5); g.add(pit); }
  return g;
}
function petrol(o = {}) {
  const g = new THREE.Group(), b = new B();
  b.box('tile', 16, 0.12, 12, 0, 0, 0, { r: 0.05 });
  for (const x of [-4, 4]) { b.box('pale', 0.5, 4.6, 0.5, x, 0.12, 0, { r: 0.05 }); b.box('pale', 1.0, 1.25, 0.6, x, 0.12, 2.2, { r: 0.08 }); b.cbox('dark', 0.6, 0.4, 0.62, x, 1.0, 2.2, { r: 0.03 }); }
  b.cbox('pale', 13, 0.7, 8, 0, 5.05, 0.6, { r: 0.1 }); b.cbox(o.cleared ? 'amber' : 'stone', 13.04, 0.25, 8.04, 0, 4.85, 0.6, { r: 0.02 });
  const shop = new B(); shop.box('sand', 7, 3.4, 4, 3, 0.12, -6.5, { r: 0.05 }); shop.cbox('glass', 4, 2, 0.08, 3, 1.4, -4.48, { r: 0.01 }); g.add(shop.build());
  g.add(b.build());
  if (!o.cleared) { const c = car({ wreck: true, seed: 8 }); c.position.set(-1, 0.12, 2.5); c.rotation.y = 1.4; g.add(c); hiveFx(g, 0, 0.12, 0, 4.5, o.night); }
  return g;
}
// A forest hollow: not a building. A dark mound of earth and roots over a burrow, a dead tree, old bones; the rot-green
// lives only in the burrow's mouth and the eyes in it (and the haze over it, by night). Units: cells (the view scales ×1.35).
function hollow(o = {}) {
  const g = new THREE.Group(), b = new B(), rr = rng(o.seed || 41);
  // burnt: the same hollow after the fire (ash and charcoal, no moss, no eyes)
  const B0 = o.burnt;
  const EARTH = B0 ? '#2b2724' : '#3a322a', EARTH2 = B0 ? '#211e1b' : '#2f2923', ROOT = B0 ? '#1e1b19' : '#3d3128', MOSS = B0 ? '#4a4540' : '#3c4430', ROCK = '#57534b', BONE = '#bdb39d';
  // the mound: lumps of dark earth, mossed on top
  b.sph(EARTH, 2.3, 0, -0.35, -0.2, { detail: 1, sy: 0.5, sz: 0.9 });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.4, d = 1.3 + rr() * 0.5; b.sph(k % 2 ? EARTH2 : EARTH, 0.7 + rr() * 0.45, Math.cos(a) * d, 0.05, Math.sin(a) * d * 0.85 - 0.2, { detail: 1, sy: 0.55 + rr() * 0.25, ry: rr() * 3 }); }
  b.sph(MOSS, 1.35, -0.3, 0.55, -0.55, { detail: 1, sy: 0.32, sx: 1.2 }); b.sph(MOSS, 0.7, 1.0, 0.45, -0.1, { detail: 1, sy: 0.35 });
  // the burrow: a black mouth under an earth lip, facing the camp
  b.sph('#141210', 0.85, 0, 0.32, 1.55, { detail: 1, sx: 1.15, sy: 0.62, sz: 0.5 });
  b.sph(EARTH2, 0.62, -0.75, 0.42, 1.55, { detail: 1, sy: 0.7 }); b.sph(EARTH2, 0.58, 0.78, 0.38, 1.5, { detail: 1, sy: 0.7 });
  b.cbox(EARTH, 1.9, 0.32, 0.7, 0, 0.82, 1.35, { r: 0.14, rx: -0.25 });
  // roots arching over the mouth and down the flanks
  const root = (x0, z0, x1, z1, h, r0) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    const SEG = 5; for (let s = 0; s < SEG; s++) { const t0 = s / SEG, t1 = (s + 1) / SEG, y0 = Math.sin(t0 * Math.PI) * h, y1 = Math.sin(t1 * Math.PI) * h, seg = Math.hypot(L / SEG, y1 - y0) + 0.04;
      b.geo(ROOT, new THREE.CylinderGeometry(r0 * (1 - t1 * 0.5), r0 * (1 - t0 * 0.5), seg, 5), x0 + dx * (t0 + t1) / 2, (y0 + y1) / 2 + 0.25, z0 + dz * (t0 + t1) / 2, Math.PI / 2 - Math.atan2(y1 - y0, L / SEG), ry, 0); }
  };
  root(-1.3, 1.1, 1.25, 1.2, 0.95, 0.09); root(-1.6, -0.4, -0.6, 1.7, 0.7, 0.075); root(1.5, -0.6, 0.6, 1.8, 0.75, 0.075); root(-0.4, -1.6, 1.8, 0.4, 0.8, 0.07);
  // a dead tree leaning out of the back of the mound
  b.cyl(ROOT, 0.14, 0.26, 3.1, 0.7, 0.2, -1.0, { seg: 7, rz: -0.12, rx: -0.08 });
  b.cyl(ROOT, 0.05, 0.1, 1.3, 0.95, 2.3, -1.1, { seg: 5, rz: -0.9 }); b.cyl(ROOT, 0.04, 0.08, 1.1, 0.55, 2.6, -1.05, { seg: 5, rz: 0.75, rx: 0.3 }); b.cyl(ROOT, 0.03, 0.07, 0.9, 0.85, 3.0, -0.8, { seg: 5, rx: 0.8 });
  // rocks, and the bones of what went in
  for (const [x, z, r0] of [[-1.9, 1.0, 0.32], [1.9, 0.9, 0.26], [-1.2, 1.9, 0.18], [2.1, -0.9, 0.3]]) b.sph(ROCK, r0, x, r0 * 0.4, z, { detail: 0, sy: 0.7, ry: x });
  b.sph(BONE, 0.13, 0.55, 0.12, 2.15, { detail: 1, sy: 0.85 }); b.cbox(BONE, 0.55, 0.05, 0.05, -0.4, 0.05, 2.2, { r: 0.02, ry: 0.5 }); b.cbox(BONE, 0.42, 0.05, 0.05, -0.25, 0.05, 2.35, { r: 0.02, ry: -0.3 });
  for (let k = 0; k < 4; k++) b.cyl(BONE, 0.02, 0.025, 0.32, 0.95 + k * 0.09, 0.02, 1.95, { seg: 4, rz: 0.9, ry: 0.3 });
  g.add(b.build({ ao: 1.2, aoMin: 0.55 }));
  if (!o.cleared) {
    // the rot-green: deep in the mouth, and the eyes (the view dims them by day, blinks them, and puts them out when it burns)
    const pit = glowDecal('#8fff3a', 0.9, 1.6); pit.rotation.x = 0; pit.position.set(0, 0.36, 1.32); g.add(pit);
    const eyes = [];
    for (const [x, y, s0] of [[-0.32, 0.42, 1], [0.12, 0.3, 0.8], [0.42, 0.48, 0.9]]) for (const e of [-0.07, 0.07]) { const sp = glowSprite('#b4ff4e', 0.17 * s0 * (CFG.eyeScale ?? 1), 2.2); sp.position.set(x + e * s0, y, 1.62); sp.userData.pair = eyes.length >> 1; g.add(sp); eyes.push(sp); }
    g.userData.eyes = eyes; g.userData.pit = pit;
    hiveFx(g, 0, 0, 1.2, 2.2, o.night);
  }
  return g;
}
function police(o = {}) {
  const g = new THREE.Group();
  g.add(apartment({ w: 16, d: 11, floors: 3, color: 'stone', trim: 'sand', ruin: o.cleared ? 0 : 0.25, seed: 55, shop: false, burnt: !o.cleared }));
  const s = sign('POLICE', 5, 1.0, { bg: '#2f3536', fg: o.cleared ? '#e19f3a' : '#a9b2b5', size: 80 }); s.position.set(0, 4.6, 5.53); g.add(s);
  const b = new B(); b.box('stone', 6, 0.5, 2, 0, 0, 6.8, { r: 0.05 }); for (const x of [-2.5, 2.5]) b.box('metal', 0.1, 6, 0.1, x, 0, 7.2); g.add(b.build());
  for (const [x, ry] of [[-4.5, 0.4], [4.8, -0.3]]) { const c = car({ color: 'dark', wreck: !o.cleared, seed: 12 }); c.position.set(x, 0, 9); c.rotation.y = ry; g.add(c); }
  if (!o.cleared) hiveFx(g, 0, 0, 8.5, 4.5, o.night);
  return g;
}

export { hospital, metro, petrol, hollow, police };
