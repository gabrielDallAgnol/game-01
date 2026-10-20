// Hollowmere city kit · Street furniture and vehicles: cars, buses, containers, sandbags, lamps, trees, bushes.
/* global THREE */
import { lin } from './palette.js';
import { M } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { glowSprite } from './helpers.js';

// ======================================================================
// STREET FURNITURE & VEHICLES
// ======================================================================
function car(o = {}) {
  const r = rng(o.seed || 11), b = new B(), body = o.color || (['stone', 'grey', 'rust', 'pale', 'dark'][Math.floor(r() * 5)]);
  const L = 4.1, Wd = 1.8;
  b.box(body, L, 0.72, Wd, 0, 0.32, 0, { r: 0.22 });
  b.box(o.wreck ? 'glass' : 'glass', 2.2, 0.62, Wd - 0.16, -0.15, 0.95, 0, { r: 0.2 });
  b.box(body, 2.0, 0.08, Wd - 0.22, -0.2, 1.55, 0, { r: 0.04 });
  for (const sx of [-1, 1]) { b.box(body, 0.1, 0.62, 0.1, sx * 1.0 - 0.15, 0.95, Wd / 2 - 0.12, { r: 0.03 }); b.box(body, 0.1, 0.62, 0.1, sx * 1.0 - 0.15, 0.95, -Wd / 2 + 0.12, { r: 0.03 }); }
  b.cbox('dark', 0.1, 0.22, Wd - 0.3, L / 2 - 0.02, 0.62, 0, { r: 0.04 });
  b.cbox('pale', 0.06, 0.12, 0.3, L / 2, 0.75, 0.6, { r: 0.02 }); b.cbox('pale', 0.06, 0.12, 0.3, L / 2, 0.75, -0.6, { r: 0.02 });
  for (const [x, z] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) {
    if (o.wreck && r() < 0.25) continue;
    b.geo('tyre', new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), x, 0.34, z, Math.PI / 2, 0, 0);
  }
  if (o.wreck) { b.cbox('rust', 1.6, 0.5, 0.06, 0.3, 0.7, Wd / 2 + 0.4, { r: 0.02, ry: 0.5 }); b.cbox('soot', 1.4, 0.03, 1.2, -0.2, 1.6, 0, { r: 0.01 }); }
  const g = b.build();
  if (o.wreck) { g.rotation.z = (r() - 0.5) * 0.08; g.rotation.x = (r() - 0.5) * 0.06; g.position.y = -0.06; }
  const w = new THREE.Group(); w.add(g); return w;
}
function bus(o = {}) {
  const b = new B(), L = 11.5, Wd = 2.5, c = o.color || 'pale';
  b.box(c, L, 2.7, Wd, 0, 0.35, 0, { r: 0.28 });
  b.box('glass', L - 2.4, 1.05, Wd + 0.02, -0.4, 1.55, 0, { r: 0.12 });
  b.box('glass', 0.1, 1.4, Wd - 0.3, L / 2, 1.3, 0, { r: 0.04 });
  b.box(o.stripe || 'stone', L + 0.02, 0.28, Wd + 0.04, 0, 1.0, 0, { r: 0.1 });
  b.box('steel', 3.4, 0.35, 1.6, -2, 3.05, 0, { r: 0.1 });
  for (const x of [-3.8, 3.6]) for (const z of [-1.2, 1.2]) b.geo('tyre', new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), x, 0.5, z, Math.PI / 2, 0, 0);
  if (o.wreck) b.cbox('soot', 4, 0.03, 2.2, 1, 3.07, 0, { r: 0.01 });
  return b.build();
}
function container(o = {}) {
  const b = new B(), c = o.color || 'rust', L = o.L || 6.05, H = 2.6, Wd = 2.44;
  b.box(c, L, H, Wd, 0, 0, 0, { r: 0.04 });
  for (let k = 0; k < Math.round(L / 0.3); k++) { const x = -L / 2 + 0.15 + k * 0.3; b.box(c, 0.1, H - 0.3, Wd + 0.06, x, 0.15, 0, { r: 0.02 }); }
  b.box('dark', L + 0.04, 0.12, Wd + 0.04, 0, H - 0.12, 0, { r: 0.02 }); b.box('dark', L + 0.04, 0.14, Wd + 0.04, 0, 0, 0, { r: 0.02 });
  return b.build();
}
function sandbags(len, rows = 3, o = {}) {
  const b = new B(), r = rng(o.seed || 5);
  for (let y = 0; y < rows; y++) { const off = (y % 2) * 0.3, n = Math.floor((len - off) / 0.6); for (let k = 0; k < n; k++) b.box('bag', 0.62, 0.26, 0.4, -len / 2 + off + 0.3 + k * 0.6, y * 0.24, (r() - 0.5) * 0.05, { r: 0.11, ry: (r() - 0.5) * 0.12 }); }
  return b.build();
}
function jersey(len = 3.6, o = {}) {
  const s = new THREE.Shape(); s.moveTo(-0.32, 0); s.lineTo(0.32, 0); s.lineTo(0.3, 0.2); s.lineTo(0.12, 0.42); s.lineTo(0.1, 0.95); s.lineTo(-0.1, 0.95); s.lineTo(-0.12, 0.42); s.lineTo(-0.3, 0.2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len - 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); g.translate(0, 0, -len / 2);
  const b = new B(); b.geo(o.color || 'pale', g, 0, 0, 0, 0, Math.PI / 2, 0);
  if (o.stripe) b.cbox(o.stripe, len - 0.3, 0.12, 0.25, 0, 0.6, 0, { r: 0.01 });
  return b.build();
}
function lamp(o = {}) {
  const b = new B();
  b.cyl('metal', 0.07, 0.1, 6, 0, 0, 0, { seg: 8 });
  b.cbox('metal', 1.4, 0.08, 0.1, 0.65, 5.95, 0, { r: 0.03 });
  b.cbox(o.lit ? M('pale', { emissive: '#ffd59a', ei: 3 }) : 'dark', 0.6, 0.12, 0.3, 1.3, 5.88, 0, { r: 0.05 });
  if (o.bent) { const g = b.build(); g.rotation.z = 0.28; return g; }
  const g = b.build();
  if (o.lit && o.light) { const l = new THREE.PointLight(lin('#ffcf8a'), o.light, o.dist || 18, 2); l.position.set(1.3, 5.6, 0); g.add(l); const sp = glowSprite('#ffd9a0', 1.6, 1.0); sp.position.set(1.3, 5.75, 0); g.add(sp); }
  return g;
}
function trafficLight(o = {}) {
  const b = new B();
  b.cyl('metal', 0.07, 0.08, 3.8, 0, 0, 0, { seg: 8 });
  b.box('dark', 0.35, 1.0, 0.3, 0, 3.0, 0.2, { r: 0.06 });
  for (let k = 0; k < 3; k++) b.cyl('tyre', 0.09, 0.09, 0.03, 0, 3.2 + k * 0.3, 0.36, { rx: Math.PI / 2, seg: 10 });
  const g = b.build(); if (o.bent) { g.rotation.z = 0.45; g.rotation.x = 0.1; } return g;
}
function busStop() {
  const b = new B();
  b.box('metal', 0.08, 2.4, 0.08, -1.6, 0, -0.6); b.box('metal', 0.08, 2.4, 0.08, 1.6, 0, -0.6);
  b.box('glass', 3.3, 2.0, 0.05, 0, 0.3, -0.62, { r: 0.01 }); b.cbox('steel', 3.6, 0.08, 1.5, 0, 2.45, -0.1, { r: 0.03 });
  b.box('wood', 2.4, 0.08, 0.4, 0, 0.45, -0.35, { r: 0.02 });
  return b.build();
}
function tree(o = {}) {
  const r = rng(o.seed || 9), b = new B(), h = o.h || 5 + r() * 2.5, dead = o.dead;
  b.cyl('bark', 0.12, 0.22, h * 0.55, 0, 0, 0, { seg: 7 });
  if (dead) { for (let k = 0; k < 4; k++) { const a = r() * 6.28; b.cyl('bark', 0.03, 0.07, 1.6 + r(), Math.cos(a) * 0.15, h * 0.4 + r() * 0.8, Math.sin(a) * 0.15, { seg: 5, rz: Math.cos(a) * 0.7, rx: Math.sin(a) * 0.7 }); } return b.build(); }
  const cols = ['olive', 'olive2', 'moss'].map(c => M(c, { flat: true }));
  for (let k = 0; k < (o.n || 5); k++) {
    const a = r() * 6.28, dd = r() * 1.0, s = 1.0 + r() * 0.9;
    b.sph(cols[k % 3], s, Math.cos(a) * dd, h * 0.62 + r() * h * 0.3, Math.sin(a) * dd, { detail: 1, sy: 0.85 });
  }
  return b.build();
}
function bush(o = {}) { const r = rng(o.seed || 4), b = new B(), c = [M('olive', { flat: true }), M('olive2', { flat: true })]; for (let k = 0; k < (o.n || 4); k++) { const a = r() * 6.28, dd = r() * 0.6; b.sph(c[k % 2], 0.4 + r() * 0.45, Math.cos(a) * dd, 0.3, Math.sin(a) * dd, { detail: 1, sy: 0.75 }); } return b.build(); }
function barrelFire(o = {}) {
  const b = new B(); b.cyl('rust', 0.3, 0.3, 0.9, 0, 0, 0, { seg: 12 }); b.cyl('soot', 0.28, 0.28, 0.02, 0, 0.9, 0, { seg: 12 });
  const g = b.build();
  if (o.lit !== false) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 7), new THREE.MeshBasicMaterial({ color: lin('#ffb24d').multiplyScalar(4) })); fl.position.y = 1.2; g.add(fl);
    const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), new THREE.MeshBasicMaterial({ color: lin('#ffe1a0').multiplyScalar(6) })); fl2.position.set(0.06, 1.15, 0.04); g.add(fl2);
    const s = glowSprite('#ff9a3a', 2.6, 1.2); s.position.y = 1.2; g.add(s);
    if (o.light) { const l = new THREE.PointLight(lin('#ff9f45'), o.light, o.dist || 14, 2); l.position.y = 1.6; l.castShadow = !!o.shadow; if (o.shadow) { l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; } g.add(l); }
  }
  return g;
}
function pallet(b, x, y, z, ry = 0) { for (let k = 0; k < 4; k++) b.cbox('wood', 1.2, 0.04, 0.12, x + Math.cos(ry) * 0 , y + 0.02, z, { r: 0.01, ry }); }
function sandbagsInto(g, x, y, z, len, ry = 0) { const s = sandbags(len, 3); s.position.set(x, y, z); s.rotation.y = ry; g.add(s); return s; }

export { car, bus, container, sandbags, jersey, lamp, trafficLight, busStop, tree, bush, barrelFire, sandbagsInto };
