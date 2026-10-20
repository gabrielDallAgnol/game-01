// Hollowmere city kit · The village the folk raise by themselves: lanterns, flower beds, benches, garden fences,
// flagstone paths, a well, a market stall, a shrine, sandbag walls, a watch-post, and the scaffold while they build.
// Built straight in grid units (one cell = 1), a touch big and bright so they read at phone zoom. Every model is one
// vertex-coloured mesh (the view instances them: one draw per kind). Lantern and window parts glow at dusk.
/* global THREE */
import { B } from './builder.js';
import { LANTERN, WIN } from './materials.js';
import { rng } from './rng.js';

const FLOWER = ['#f0a040', '#e8667a', '#ffd166', '#f4ead2', '#b88ce0'];

function lantern() {
  const b = new B();
  b.cyl('#3b3631', 0.035, 0.05, 1.05, 0, 0, 0, { seg: 6 });
  b.cbox('#3b3631', 0.28, 0.04, 0.04, 0.12, 1.02, 0, { r: 0.01 });
  b.cbox('#2f2a26', 0.17, 0.04, 0.17, 0.24, 0.98, 0, { r: 0.01 });
  b.cbox(LANTERN, 0.13, 0.18, 0.13, 0.24, 0.86, 0, { r: 0.02 });
  b.cbox('#2f2a26', 0.15, 0.03, 0.15, 0.24, 0.76, 0, { r: 0.01 });
  b.cbox('#6e5a48', 0.16, 0.06, 0.16, 0, 0.03, 0, { r: 0.02 });
  return b.build({ ao: 0.4, aoMin: 0.7 });
}
function flowers(o = {}) {
  const b = new B(), r = rng(o.seed || 3);
  b.cbox('#7a5236', 0.78, 0.12, 0.42, 0, 0.06, 0, { r: 0.03 });
  b.cbox('#4a3a2c', 0.7, 0.03, 0.34, 0, 0.125, 0, { r: 0.01 });
  for (let k = 0; k < 5; k++) b.sph(k % 2 ? '#5c8a3c' : '#4f7a34', 0.12, -0.28 + k * 0.14, 0.2, (r() - 0.5) * 0.12, { detail: 0, sy: 0.8 });
  for (let k = 0; k < 9; k++) b.sph(FLOWER[k % FLOWER.length], 0.055, -0.32 + r() * 0.64, 0.28 + r() * 0.06, (r() - 0.5) * 0.26, { detail: 0 });
  return b.build({ ao: 0.2, aoMin: 0.75 });
}
function bench() {
  const b = new B();
  for (const x of [-0.34, 0.34]) { b.box('#3b3631', 0.05, 0.24, 0.3, x, 0, 0); b.box('#3b3631', 0.05, 0.3, 0.05, x, 0.24, -0.13); }
  for (let k = 0; k < 3; k++) b.cbox(k % 2 ? 'wood' : 'wood2', 0.86, 0.04, 0.09, 0, 0.26, -0.1 + k * 0.1, { r: 0.01 });
  b.cbox('wood', 0.86, 0.09, 0.04, 0, 0.44, -0.16, { r: 0.01, rx: -0.15 });
  return b.build({ ao: 0.3, aoMin: 0.7 });
}
function fence() {
  const b = new B();
  for (let k = 0; k < 4; k++) { b.box('#b49a74', 0.06, 0.42, 0.06, -0.42 + k * 0.28, 0, 0); b.cbox('#b49a74', 0.07, 0.07, 0.07, -0.42 + k * 0.28, 0.43, 0, { r: 0.02, rz: 0.78 }); }
  for (const y of [0.14, 0.32]) b.cbox('#c9ad84', 0.96, 0.05, 0.03, 0, y, 0.035, { r: 0.01 });
  b.sph('#5c8a3c', 0.11, -0.22, 0.08, 0.14, { detail: 0, sy: 0.8 }); b.sph('#e8667a', 0.045, -0.2, 0.17, 0.17, { detail: 0 });
  return b.build({ ao: 0.3, aoMin: 0.72 });
}
function stones(o = {}) {
  const b = new B(), r = rng(o.seed || 7);
  for (let k = 0; k < 4; k++) { const x = (k % 2 - 0.5) * 0.46 + (r() - 0.5) * 0.08, z = (Math.floor(k / 2) - 0.5) * 0.46 + (r() - 0.5) * 0.08; b.cbox(k % 3 ? '#b5ad9c' : '#a39b89', 0.38 + r() * 0.06, 0.05, 0.36 + r() * 0.06, x, 0.025, z, { r: 0.02, ry: (r() - 0.5) * 0.3 }); }
  b.sph('#6b8a4c', 0.05, 0.0, 0.02, 0.0, { detail: 0, sy: 0.5 });
  return b.build({ ao: 0.05, aoMin: 0.85, cast: false });
}
function well() {
  const b = new B();
  b.cyl('#9a917f', 0.42, 0.46, 0.42, 0, 0, 0, { seg: 12 });
  b.cyl('#b3aa97', 0.45, 0.45, 0.06, 0, 0.42, 0, { seg: 12 });
  b.cyl('#2a3a44', 0.33, 0.33, 0.02, 0, 0.4, 0, { seg: 12 });
  for (const x of [-0.38, 0.38]) b.box('wood2', 0.07, 0.86, 0.07, x, 0.42, 0);
  b.cyl('wood', 0.05, 0.05, 0.8, -0.4, 1.12, 0, { rz: Math.PI / 2, seg: 8 });
  b.cbox('#7e3a2c', 1.0, 0.06, 0.62, 0, 1.38, -0.16, { r: 0.01, rx: 0.5 }); b.cbox('#8e4232', 1.0, 0.06, 0.62, 0, 1.38, 0.16, { r: 0.01, rx: -0.5 });
  b.cbox('#7a5236', 0.16, 0.16, 0.16, 0.12, 0.84, 0, { r: 0.02 });
  b.cbox(LANTERN, 0.1, 0.12, 0.1, 0.38, 1.0, 0.1, { r: 0.02 });
  return b.build({ ao: 0.6, aoMin: 0.65 });
}
function stall(o = {}) {
  const b = new B(), cloth = o.v ? '#3d6b9a' : '#c8553d';
  b.cbox('wood2', 1.1, 0.42, 0.5, 0, 0.21, 0.05, { r: 0.03 });
  b.cbox('wood', 1.14, 0.05, 0.56, 0, 0.44, 0.05, { r: 0.01 });
  for (const x of [-0.52, 0.52]) for (const z of [-0.22, 0.32]) b.box('#3b3631', 0.05, 1.05, 0.05, x, 0, z);
  for (let k = 0; k < 6; k++) b.cbox(k % 2 ? cloth : '#f4ead2', 0.2, 0.05, 0.78, -0.5 + k * 0.2, 1.1, 0.05, { r: 0.005, rx: 0.22 });
  for (let k = 0; k < 4; k++) b.sph(FLOWER[(k + 1) % 5], 0.08, -0.36 + k * 0.24, 0.52, 0.1, { detail: 0 });
  b.cbox('#8a6a40', 0.22, 0.2, 0.22, 0.42, 0.1, 0.52, { r: 0.02 }); b.cbox('#8a6a40', 0.2, 0.18, 0.2, -0.46, 0.09, 0.5, { r: 0.02, ry: 0.4 });
  b.cbox(LANTERN, 0.1, 0.12, 0.1, 0.48, 0.92, 0.38, { r: 0.02 });
  return b.build({ ao: 0.6, aoMin: 0.65 });
}
function shrine() {
  const b = new B();
  b.cbox('#8d8678', 1.0, 0.12, 1.0, 0, 0.06, 0, { r: 0.03 }); b.cbox('#9a917f', 0.76, 0.1, 0.76, 0, 0.17, 0, { r: 0.03 });
  for (const x of [-0.32, 0.32]) b.box('#c8553d', 0.08, 1.15, 0.08, x, 0.22, -0.1);
  b.cbox('#c8553d', 0.96, 0.08, 0.12, 0, 1.36, -0.1, { r: 0.02 }); b.cbox('#2f2a26', 1.12, 0.07, 0.16, 0, 1.46, -0.1, { r: 0.02 });
  b.cbox('#b3aa97', 0.34, 0.42, 0.24, 0, 0.22, 0.1, { r: 0.04 });
  b.cbox(WIN, 0.16, 0.12, 0.02, 0, 0.42, 0.225, { r: 0.01 });
  for (const x of [-0.28, 0.28]) { b.cyl('#f4ead2', 0.035, 0.035, 0.14, x, 0.22, 0.32, { seg: 6 }); b.sph(LANTERN, 0.04, x, 0.4, 0.32, { detail: 0 }); }
  b.sph('#e8667a', 0.06, -0.12, 0.3, 0.36, { detail: 0 }); b.sph('#ffd166', 0.06, 0.1, 0.3, 0.38, { detail: 0 });
  return b.build({ ao: 0.6, aoMin: 0.65 });
}
function sandbagWall(o = {}) {
  const b = new B(), r = rng(o.seed || 5);
  for (let y = 0; y < 3; y++) { const off = (y % 2) * 0.13, n = y === 2 ? 3 : 4; for (let k = 0; k < n; k++) { const x = -0.4 + off + k * 0.26, z = Math.pow(x, 2) * 0.35; b.box('bag', 0.27, 0.13, 0.19, x, y * 0.12, z, { r: 0.05, ry: -x * 0.6 + (r() - 0.5) * 0.12 }); } }
  return b.build({ ao: 0.35, aoMin: 0.7 });
}
function watchPost() {
  const b = new B();
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) b.box('wood2', 0.07, 1.5, 0.07, x * (1 - 0.1), 0, z * (1 - 0.1), { rx: z * 0.06, rz: -x * 0.06 });
  b.cbox('wood', 0.8, 0.07, 0.8, 0, 1.36, 0, { r: 0.01 });
  for (const s of [-1, 1]) { b.cbox('wood2', 0.8, 0.22, 0.04, 0, 1.52, s * 0.38, { r: 0.01 }); b.cbox('wood2', 0.04, 0.22, 0.8, s * 0.38, 1.52, 0, { r: 0.01 }); }
  for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) b.box('wood2', 0.05, 0.62, 0.05, x, 1.4, z);
  b.cbox('#6f5545', 0.96, 0.05, 0.96, 0, 2.06, 0, { r: 0.01 });
  b.cbox('wood', 0.06, 1.3, 0.3, 0.42, 0.65, 0.0, { r: 0.01, rz: 0.12 });
  b.cbox(LANTERN, 0.1, 0.12, 0.1, 0.3, 1.82, 0.3, { r: 0.02 });
  b.cbox('#c8553d', 0.03, 0.22, 0.32, 0, 2.3, 0, { r: 0.005 }); b.box('#3b3631', 0.03, 0.45, 0.03, 0, 2.06, -0.15);
  return b.build({ ao: 1.0, aoMin: 0.6 });
}
/** the scaffold the folk raise while they work: poles, planks and a canvas tarp, sized to the job (cells) */
function scaffold(n = 1) {
  const b = new B(), h = n > 1 ? 1.2 : 0.8, s = n * 0.46;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) b.box('#9a7a52', 0.05, h, 0.05, x, 0, z);
  for (const y of [h * 0.45, h * 0.95]) { b.cbox('#b08a5c', s * 2 + 0.1, 0.04, 0.05, 0, y, -s, { r: 0.01 }); b.cbox('#b08a5c', s * 2 + 0.1, 0.04, 0.05, 0, y, s, { r: 0.01 }); b.cbox('#b08a5c', 0.05, 0.04, s * 2 + 0.1, -s, y, 0, { r: 0.01 }); b.cbox('#b08a5c', 0.05, 0.04, s * 2 + 0.1, s, y, 0, { r: 0.01 }); }
  b.cbox('#c9a26a', s * 2, 0.03, 0.22, 0, h * 0.47, -s + 0.12, { r: 0.01 });
  b.cbox('#b08a5c', 0.04, 0.04, s * 2.6, 0, h * 0.7, 0, { r: 0.01, rx: 0.5, ry: 0.78 });
  b.cbox('canvas', s * 1.3, 0.02, s * 0.9, -s * 0.2, h + 0.02, s * 0.3, { r: 0.005, rz: 0.08 });
  b.cbox('#8a6a40', 0.2, 0.16, 0.2, s * 0.6, 0.08, s * 0.5, { r: 0.02 }); b.cbox('#b5ad9c', 0.24, 0.1, 0.16, -s * 0.5, 0.05, s * 0.6, { r: 0.02, ry: 0.3 });
  return b.build({ ao: 0.4, aoMin: 0.7 });
}

const VILLAGE = { lantern, flowers, bench, fence, path: stones, well, stall, shrine, sandbags: sandbagWall, watch: watchPost };
export { VILLAGE, scaffold };
