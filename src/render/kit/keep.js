// Hollowmere city kit · The keep (legacy depot model).
/* global THREE */
import { LENS, M } from './materials.js';
import { B } from './builder.js';
import { apartment } from './city.js';
import { bus, container, jersey, barrelFire, sandbagsInto } from './street.js';

/** the keep: 1 a bus and tarps around a fire, 2 a depot walled with containers, 3 + radio mast and searchlight */
function keep(o = {}) {
  // The HQ: the old town hall, taken back. It must read as the heart of the town from any zoom:
  // the tallest thing you own, a clock tower, amber banners, a lit forecourt. Each keep level adds a floor and defences.
  const lvl = o.level || 1, g = new THREE.Group(), b = new B(), night = !!o.night;
  b.box('tile', 22, 0.12, 18, 0, 0, 0, { r: 0.05 });
  b.box('curb', 22.4, 0.08, 18.4, 0, 0, 0, { r: 0.04 });
  for (let k = -9; k <= 9; k += 3) b.cbox('paint', 0.12, 0.01, 3.5, k, 0.125, 6.5, { r: 0.001 });
  // the hall: a pale civic block with a portico, one more floor per keep level
  const floors = 3 + lvl, fh = 3.1, H = floors * fh, hw = 14, hd = 8, hz = -3.8;
  const hall = apartment({ w: hw, d: hd, floors, fh, color: 'pale', trim: 'stone', shop: false, seed: 91, ruin: 0 });
  hall.position.set(0, 0.12, hz); g.add(hall);
  // portico: columns and a pediment over the door
  for (const x of [-2.4, -0.8, 0.8, 2.4]) b.cyl('pale', 0.28, 0.32, 4.2, x, 0.12, hz + hd / 2 + 1.0, { seg: 12 });
  b.cbox('pale', 6.2, 0.5, 2.4, 0, 4.32, hz + hd / 2 + 0.7, { r: 0.04 });
  b.geo('stone', new THREE.CylinderGeometry(0.01, 3.4, 1.3, 3), 0, 5.4, hz + hd / 2 + 0.7, 0, Math.PI / 2, 0);
  b.box('dark', 1.4, 2.6, 0.1, 0, 0.12, hz + hd / 2 + 0.03, { r: 0.02 });
  // amber banners down the facade: this is yours
  for (const x of [-4.4, 4.4]) { b.cbox('amber', 1.1, H * 0.62, 0.06, x, H * 0.3, hz + hd / 2 + 0.08, { r: 0.01 }); b.cbox('amberDeep', 1.1, 0.25, 0.08, x, H * 0.3, hz + hd / 2 + 0.09, { r: 0.01 }); }
  // the clock tower on the roof
  const ty = H + 0.12, tw = 3.2, th = 4.5 + lvl;
  b.cbox('pale', tw, th, tw, 0, ty, hz, { r: 0.05 });
  b.cbox('stone', tw + 0.3, 0.3, tw + 0.3, 0, ty + th, hz, { r: 0.03 });
  b.geo('amberDeep', new THREE.ConeGeometry(tw * 0.78, 2.6, 4), 0, ty + th + 1.6, hz, 0, Math.PI / 4, 0);
  b.cyl('pale', 1.0, 1.0, 0.1, 0, ty + th - 1.6, hz + tw / 2 + 0.02, { rx: Math.PI / 2, seg: 20 });
  b.cbox('dark', 0.08, 0.75, 0.04, 0, ty + th - 1.6, hz + tw / 2 + 0.08, { r: 0.01 }); b.cbox('dark', 0.55, 0.08, 0.04, 0.2, ty + th - 1.45, hz + tw / 2 + 0.08, { r: 0.01 });
  // flag
  b.cyl('steel', 0.05, 0.06, 3.2, 0, ty + th + 2.8, hz, { seg: 6 });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.15, 6, 2), M('amber', { side: THREE.DoubleSide, emissive: '#c9702e', ei: 0.25 }));
  { const pa = flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + 1) * 2.4) * 0.12 * (pa.getX(i) + 1)); flag.geometry.computeVertexNormals(); }
  flag.position.set(1.0, ty + th + 5.3, hz); flag.castShadow = true; g.add(flag);
  // forecourt life: the bus you came in, a fire, crates, a table
  const bs = bus({ color: 'pale', stripe: 'amber' }); bs.position.set(-5.2, 0.12, 5.6); bs.rotation.y = 0.12; g.add(bs);
  const f = barrelFire({ light: night ? 3.2 : 0, dist: 16, shadow: night }); f.position.set(3.4, 0.12, 2.6); g.add(f);
  for (let k = 0; k < 4; k++) b.box('wood2', 0.9, 0.7, 0.7, 7.2 + (k % 2) * 1.0, 0.12 + Math.floor(k / 2) * 0.7, 5.6, { r: 0.04 });
  b.box('wood', 2.0, 0.08, 0.9, 4.6, 0.92, 5.2, { r: 0.02 }); for (const [x, z] of [[3.7, 4.8], [5.5, 4.8], [3.7, 5.6], [5.5, 5.6]]) b.box('wood', 0.07, 0.8, 0.07, x, 0.12, z);
  sandbagsInto(g, -7.5, 0.12, 1.2, 3.0, Math.PI / 2); sandbagsInto(g, 7.5, 0.12, 1.2, 3.0, Math.PI / 2);
  if (lvl >= 2) {
    // containers as walls, a gate, a lookout on top
    const spots = [[-9.5, -4, Math.PI / 2], [-9.5, 2.2, Math.PI / 2], [9.5, -4, Math.PI / 2], [9.5, 2.2, Math.PI / 2], [-6.6, -8.4, 0], [6.6, -8.4, 0]];
    const cols = ['rust', 'grey', 'stone', 'grey', 'rust', 'stone'];
    spots.forEach(([x, z, ry], k) => { const c = container({ color: cols[k] }); c.position.set(x, 0.12, z); c.rotation.y = ry; g.add(c); });
    const c2 = container({ color: 'amberDeep' }); c2.position.set(-9.5, 2.72, -4); c2.rotation.y = Math.PI / 2; g.add(c2);
    for (const x of [-1.8, 1.8]) { const j = jersey(2.2, { color: 'pale', stripe: 'amber' }); j.position.set(x * 2.4, 0.12, 8.6); g.add(j); }
  }
  if (lvl >= 3) {
    // radio mast with a searchlight
    const m = new B(), MH = 9;
    for (const [a, c] of [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]]) m.box('steel', 0.1, MH, 0.1, 4.3 + a, H + 0.12, hz - 1.5 + c, { r: 0.02 });
    for (let y = 1; y < MH; y += 1.5) m.cbox('steel', 1.1, 0.05, 0.05, 4.3, H + y, hz - 1.6, { r: 0.01, ry: y % 3 ? 0.5 : -0.5 });
    m.cyl('steel', 0.35, 0.42, 0.55, 4.3, H + MH - 0.6, hz - 1.4, { rx: -1.1, seg: 14 });
    m.cyl(o.game ? LENS : M('pale', { emissive: '#fff1d0', ei: night ? 6 : 0.2 }), 0.33, 0.33, 0.04, 4.3, H + MH - 0.35, hz - 0.98, { rx: -1.1, seg: 14 });
    g.add(m.build());
  }
  g.add(b.build());
  return g;
}

export { keep };
