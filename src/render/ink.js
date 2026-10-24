// The ink line: `inkify(obj)` gives every mesh under obj a back-face hull in warm ink, a constant ~1.5 px wide at any zoom
// (an inverted hull: one extra draw per mesh, its geometry shared, no post pass). Use it on ANY new model (nests, the Rig,
// carts, props) and it picks up the palette and the quality switch automatically:
//   inkify(obj, { w: 1, color: PAL.ink, kind: 'static' })   w scales the width; kind 'static' hulls (buildings, props, the
//   Rig) are switched off together by setInk(false) (the low-end cut); characters use liveRig/createCrowd, which carry
//   their own hulls in figures.js and are never switched off.
// The hull shares the source geometry, so it costs no memory; instanced meshes share their instance matrices.
/* global THREE */
import { outlineMat, outlineNormals } from './figures.js';
import { PAL } from './palette.js';

const kinds = {}, mats = new Set();   // kind → true while that kind's hulls are drawn
function matFor(kind, color, w) {
  const m = outlineMat(color || PAL.ink, { w, tag: kind });
  if (!m.userData.inkKind) { m.userData.inkKind = kind; kinds[kind] = kinds[kind] ?? true; m.visible = kinds[kind]; mats.add(m); }
  return m;
}
/** add an ink hull to every mesh under obj (skips hulls, x-ray copies, transparent and tiny glow meshes); returns obj */
export function inkify(obj, o = {}) {
  const kind = o.kind || 'static', w = o.w || 1, list = [];
  obj.traverse(m => {
    if (!m.isMesh || m.userData.outline || m.userData.xray || m.userData.noInk || m.isSkinnedMesh) return;
    if (m.material && (m.material.transparent || m.material.blending === THREE.AdditiveBlending)) return;
    list.push(m);
  });
  for (const m of list) {
    outlineNormals(m.geometry);
    const h = m.isInstancedMesh ? new THREE.InstancedMesh(m.geometry, matFor(kind, o.color, w), m.count) : new THREE.Mesh(m.geometry, matFor(kind, o.color, w));
    if (m.isInstancedMesh) { h.instanceMatrix = m.instanceMatrix; h.frustumCulled = false; }
    h.castShadow = false; h.receiveShadow = false; h.userData.outline = true; h.userData.xray = true; h.renderOrder = m.renderOrder;
    m.add(h);
  }
  return obj;
}
/** switch a kind of hulls on or off (all at once: they share materials, so this is free) */
export function setInk(on, kind = 'static') { kinds[kind] = !!on; for (const m of mats) if (m.userData.inkKind === kind) m.visible = !!on; }
