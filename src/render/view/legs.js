// [rig3] An act's look: its ground colours (content/rig.js LEGS[].ground, mixed into the city's ground palette and
// repainted once) and its signature props from map.decor / map.rail (sim/legmap.js): freight rails with sleepers,
// boxcars, a gantry crane and a water tower for the rail yard. Built once when the view is made.
/* global THREE */
import { K } from '../kit.js';
import { legOf } from '../../content/rig.js';
import { GROUND_TINT } from '../city.js';
import { N, idx } from '../../sim/mapgen.js';

const ORIG = {};   // the ground palette as it was before any act tinted it (one page can see several acts)

export function createLegs(V) {
  const { map, world, Wv } = V, leg = map.leg || 1, L = legOf(leg);
  // ---------- the ground ----------
  for (const k of Object.keys(GROUND_TINT)) if (!(k in ORIG)) ORIG[k] = GROUND_TINT[k];
  for (const k of Object.keys(ORIG)) GROUND_TINT[k] = ORIG[k];
  if (L.ground) {
    for (const [k, hex] of Object.entries(L.ground)) if (k in ORIG) GROUND_TINT[k] = '#' + new THREE.Color(ORIG[k]).lerp(new THREE.Color(hex), 0.7).getHexString();
    if (V.city && V.city.paint) V.city.paint();
  }
  if (!map.decor || (!map.decor.length && !map.rail)) return { update() {} };
  // ---------- the rails: two steel lines on sleepers wherever the map laid track ----------
  const g = new THREE.Group(); world.add(g);
  if (map.rail && map.railLine) {
    const b = new K.B(), { ux, uy, nx, ny, off } = map.railLine, c = map.town.x, ang = -Math.atan2(uy, ux);
    for (const lane of [-1.5, 1.5]) for (let t = -95; t <= 95; t += 1.2) {
      const x = c + ux * t + nx * (off + lane), y = c + uy * t + ny * (off + lane), i = idx(Math.floor(x), Math.floor(y));
      if (x < 0 || y < 0 || x >= N || y >= N || !map.rail[i]) continue;
      const p = Wv(x, y);
      b.cbox('#5a4a3a', 0.25, 0.08, 1.3, p.x, p.y + 0.05, p.z, { r: 0.01, ry: ang });   // a sleeper across the line
    }
    // the rails proper: offset each rail sideways from the sleeper centres
    const rb = new K.B();
    for (const lane of [-1.5, 1.5]) for (const s of [-0.42, 0.42]) for (let t = -95; t <= 95; t += 2) {
      const x = c + ux * t + nx * (off + lane + s), y = c + uy * t + ny * (off + lane + s), i = idx(Math.floor(c + ux * t + nx * (off + lane)), Math.floor(c + uy * t + ny * (off + lane)));
      if (x < 0 || y < 0 || x >= N || y >= N || !map.rail[i]) continue;
      const p = Wv(x, y); rb.cbox('#a9adb0', 2.05, 0.08, 0.07, p.x, p.y + 0.13, p.z, { r: 0.005, ry: ang });
    }
    g.add(b.build({ ao: 0.2, aoMin: 0.9 }), rb.build({ ao: 0.2, aoMin: 0.9 }));
  }
  // ---------- the props ----------
  const S = 0.3;   // metres → cells, like the keep
  for (const d of map.decor) {
    const p = Wv(d.x, d.y), o = d.kind === 'boxcar' ? boxcar(d) : d.kind === 'crane' ? crane() : d.kind === 'watertower' ? waterTower() : null; if (!o) continue;
    o.scale.setScalar(S); o.position.copy(p); o.rotation.y = d.kind === 'boxcar' ? -d.rot : -d.rot + Math.PI / 2; g.add(o);
  }
  return { update() {} };
}

const BOXCOLS = ['#8a3b2c', '#5e6f7a', '#7a6a3a', '#45604c', '#8a5a3c'];
function boxcar(d) {
  const b = new K.B(), col = BOXCOLS[Math.abs(Math.floor(d.x * 7 + d.y * 3)) % BOXCOLS.length], Lc = 12, w = 3;
  b.box('#2c2b29', Lc - 1.2, 0.5, w - 0.6, 0, 0.3, 0, { r: 0.05 });
  for (const x of [-Lc / 2 + 1.6, Lc / 2 - 1.6]) for (const s of [-1, 1]) b.geo('#3a3836', new THREE.CylinderGeometry(0.42, 0.42, 0.2, 10), x, 0.42, s * (w / 2 - 0.5), Math.PI / 2, 0, 0);
  b.box(col, Lc, 3.2, w, 0, 0.8, 0, { r: 0.08 });
  for (let k = 0; k < 14; k++) b.box(col, 0.1, 3.0, w + 0.06, -Lc / 2 + 0.45 + k * 0.85, 0.9, 0, { r: 0.02 });
  b.cbox('#3f3a35', Lc + 0.1, 0.18, w + 0.1, 0, 4.05, 0, { r: 0.04 });
  b.box('#4a4440', 2.6, 2.7, 0.08, 0, 1.0, w / 2 + 0.03, { r: 0.02 });
  b.box('#d8d1c2', 2.2, 0.35, 0.05, -3.4, 2.9, w / 2 + 0.04, { r: 0.01 });   // a faded stencil
  return b.build({ ao: 2, aoMin: 0.55 });
}
function crane() {
  const b = new K.B(), Y = '#e8b021', H = 9, Wc = 10;
  for (const s of [-1, 1]) for (const z of [-3, 3]) b.box(Y, 0.5, H, 0.5, s * Wc / 2, 0, z, { r: 0.05 });
  for (const s of [-1, 1]) { b.cbox(Y, 0.5, 0.6, 6.5, s * Wc / 2, H - 0.3, 0, { r: 0.05 }); b.cbox('#3a3836', 1.2, 0.6, 7, s * Wc / 2, 0.3, 0, { r: 0.05 }); for (let k = 0; k < 3; k++) b.cbox(Y, 0.18, 0.18, 6.4, s * Wc / 2, 2.5 + k * 2.2, 0, { r: 0.02, rx: k % 2 ? 0.6 : -0.6 }); }
  for (const z of [-3, 3]) b.cbox(Y, Wc + 0.6, 0.9, 0.6, 0, H + 0.2, z, { r: 0.06 });
  b.box('#5a5d60', 1.8, 1.4, 1.8, 1.2, H + 0.6, 0, { r: 0.08 }); b.box('#33454f', 0.06, 0.6, 1.2, 2.11, H + 1.0, 0, { r: 0.01 });
  b.box('#2c2b29', 0.06, H - 4, 0.06, 1.2, 4.6, 0); b.cbox('#7d8286', 1.6, 0.4, 1.0, 1.2, 4.4, 0, { r: 0.04 });
  return b.build({ ao: 3, aoMin: 0.6 });
}
function waterTower() {
  const b = new K.B(), H = 8;
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) b.box('#5a4a3a', 0.3, H, 0.3, x, 0, z, { r: 0.04 });
  for (let k = 1; k < 4; k++) for (const [w, d, ry] of [[3.4, 0.12, 0], [0.12, 3.4, 0]]) b.cbox('#6b5038', w, 0.12, d, 0, k * 2, 0, { r: 0.02, ry });
  b.cyl('#7a5a3c', 2.4, 2.4, 3.2, 0, H, 0, { seg: 14 }); for (const y of [0.5, 1.6, 2.7]) b.cyl('#3f3a35', 2.45, 2.45, 0.1, 0, H + y, 0, { seg: 14 });
  b.geo('#5a4636', new THREE.ConeGeometry(2.7, 1.4, 14), 0, H + 3.9, 0);
  return b.build({ ao: 3, aoMin: 0.6 });
}
