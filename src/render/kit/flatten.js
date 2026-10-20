// Hollowmere city kit · One draw per model: flattenVC(), ruinOf() and the upgrade-sweep material.
/* global THREE */
import { territory } from './territory.js';
import { VCM } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { rubble } from './city.js';

// ---------- one draw per model: fold every vertex-coloured mesh under a group into one ----------
const _fm = new THREE.Matrix4(), _fi = new THREE.Matrix4();
function flattenVC(g) {
  g.updateMatrixWorld(true); _fi.copy(g.matrixWorld).invert();
  const list = [], drop = [];
  g.traverse(o => { if (o.isMesh && o.material === VCM && !o.isInstancedMesh) { const gg = o.geometry.clone(); gg.applyMatrix4(_fm.multiplyMatrices(_fi, o.matrixWorld)); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'color', 'aEmit'].includes(k)) gg.deleteAttribute(k); list.push(gg); drop.push(o); } });
  if (!list.length) return g;
  for (const o of drop) o.parent.remove(o);
  const out = new THREE.Group(), m = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(list, false), VCM); m.castShadow = true; m.receiveShadow = true; out.add(m);
  // what could not be folded (glass, canvas, chain-link) keeps its own meshes, re-parented with its world transform
  const rest = []; g.traverse(o => { if (o.isMesh) rest.push(o); });
  for (const o of rest) { const c = new THREE.Mesh(o.geometry, o.material); _fm.multiplyMatrices(_fi, o.matrixWorld).decompose(c.position, c.quaternion, c.scale); c.castShadow = o.castShadow; c.receiveShadow = true; out.add(c); }
  return out;
}
/** a ruin of a flattened model: the walls slump and break, everything is charred, a heap of rubble in the middle */
function ruinOf(g, seed = 1, height = 1) {
  let src = null; g.traverse(o => { if (!src && o.isMesh && o.material === VCM) src = o; }); if (!src) return new THREE.Group();
  const gg = src.geometry.clone(), pa = gg.attributes.position, ca = gg.attributes.color, ea = gg.attributes.aEmit, r = rng(seed);
  const bx = new THREE.Box3().setFromBufferAttribute(pa), H = Math.max(0.01, bx.max.y - bx.min.y), cx = (bx.min.x + bx.max.x) / 2, cz = (bx.min.z + bx.max.z) / 2;
  const ph = r() * 6.28, keep = 0.22 + r() * 0.12;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(z - cz, x - cx);
    // a jagged break line round the walls: high on one side, low on the other
    const cut = H * (keep + 0.18 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 7 + ph * 2) + 0.12 * Math.cos(a - ph));
    if (y > cut) { pa.setY(i, cut + (y - cut) * 0.06); pa.setX(i, x + (x - cx) * 0.05); pa.setZ(i, z + (z - cz) * 0.05); }
    const t = Math.min(1, Math.max(0, y / H)), soot = 0.16 + 0.14 * (1 - t) + r() * 0.04;
    ca.setXYZ(i, ca.getX(i) * soot + 0.012, ca.getY(i) * soot + 0.01, ca.getZ(i) * soot + 0.012); ea.setX(i, 0);
  }
  gg.computeVertexNormals();
  const out = new THREE.Group(), m = new THREE.Mesh(gg, VCM); m.castShadow = true; m.receiveShadow = true; out.add(m);
  const b = new B(); rubble(b, cx, cz, Math.max(0.6, (bx.max.x - bx.min.x) * 0.32), 16, r, 'soot');
  for (let k = 0; k < 4; k++) b.cbox(k % 2 ? 'soot' : '#3a2f28', 0.12 * height, 0.12 * height, (bx.max.z - bx.min.z) * 0.7, cx + (r() - 0.5) * H * 0.5, H * 0.12 + r() * H * 0.1, cz, { r: 0.01, rx: (r() - 0.5) * 0.6, ry: r() * 3, rz: (r() - 0.5) * 0.5 });
  const rb = b.build({ ao: H * 0.3, aoMin: 0.5 }); rb.traverse(o => { if (o.isMesh && o.geometry.attributes.color) { const c = o.geometry.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.5, c.getY(i) * 0.5, c.getZ(i) * 0.5); } });
  out.add(rb);
  return flattenVC(out);
}
// the upgrade sweep: new colours climb the building from the ground behind an amber band (one at a time)
const sweepY = { value: -99 };
const SWEEP = territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }), { emit: true, uniforms: { tSweepY: sweepY },
  fragHead: 'uniform float tSweepY;',
  fragColor: `float swd = vTWorld.y - tSweepY; float swl = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(swl) * 0.7, step(0.0, swd)) + vec3(1.6, 0.85, 0.3) * smoothstep(0.35, 0.0, abs(swd));` });
SWEEP.userData.y = sweepY;

export { flattenVC, ruinOf, SWEEP };
