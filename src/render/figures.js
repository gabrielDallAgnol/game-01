// Figures for the live game: bake kit rigs into single vertex-coloured meshes (two walk frames each),
// draw the dead as instanced crowds, and animate full rigs for the hero and sellswords.
/* global THREE */
import { K, CFG } from './kit.js';

export const PEOPLE = 0.6;          // world units per metre for people (buildings use 0.3: people read a bit larger)

const tmpM = new THREE.Matrix4(), inv = new THREE.Matrix4(), col = new THREE.Color();
/** merge every mesh under obj into one geometry with a colour attribute; glowing parts go to `glow` */
export function bake(obj) {
  obj.updateMatrixWorld(true);
  inv.copy(obj.matrixWorld).invert();
  const body = [], glow = [];
  obj.traverse(m => {
    if (!m.isMesh || !m.geometry || m.isInstancedMesh) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (mat.transparent && mat.opacity < 0.6) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    tmpM.multiplyMatrices(inv, m.matrixWorld); g.applyMatrix4(tmpM);
    const isGlow = mat.emissive && mat.emissiveIntensity > 1.5;
    col.copy(isGlow ? mat.emissive : mat.color);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    (isGlow ? glow : body).push(g);
  });
  const merge = list => list.length ? THREE.BufferGeometryUtils.mergeBufferGeometries(list, false) : null;
  return { geo: merge(body), glow: merge(glow) };
}
export const vcMat = (o = {}) => K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.86, metalness: 0 }));

// second walk frame: swap the legs and counter-swing the arms
function strideFrame(root, k = 1) {
  const legs = root.userData.legs || [], j = root.userData.joints || {};
  if (legs.length === 2) {
    const [a, b] = legs, ax = a.rotation.x, bx = b.rotation.x, ka = a.children.find(c => c.isGroup), kb = b.children.find(c => c.isGroup);
    a.rotation.x = bx * k; b.rotation.x = ax * k;
    if (ka && kb) { const t = ka.rotation.x; ka.rotation.x = kb.rotation.x; kb.rotation.x = t; }
  }
  if (j.sL && j.sR) { j.sL.rotation.x += 0.25; j.sR.rotation.x -= 0.25; }
}

const KIND_RIG = {
  walker: 'walker', runner: 'runner', crawler: 'crawler', brute: 'brute', spitter: 'spitter', bloater: 'bloater', screamer: 'screamer', gravelord: 'gravelord', guardian: 'gravelord', deer: 'deer', wolf: 'wolf',
};
/** the dead, drawn in batches: two instanced frames per kind plus their glowing eyes */
export function createCrowd(world) {
  const kinds = {};
  // a faint sickly self-light keeps the dead readable against dark asphalt at night
  const bodyMat = K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: new THREE.Color(0x070c05), emissiveIntensity: 1 }));   // dark in the shroud: only their eyes show
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true }); eyeMat.color.setRGB(4, 4, 4);
  function kindOf(kind) {
    if (kinds[kind]) return kinds[kind];
    const make = alt => { CFG.eyeScale = 2.6; const r = K.dead[KIND_RIG[kind] || 'walker']({ alt }); CFG.eyeScale = 1; if (kind === 'guardian') r.scale.multiplyScalar(0.8); return r; };
    const A = make(false), B = make(true); strideFrame(B);
    const frames = [bake(A), bake(B)];
    const cap = kind === 'gravelord' || kind === 'guardian' ? 12 : kind === 'deer' || kind === 'wolf' ? 60 : 400;
    const meshes = frames.map(f => {
      const m = new THREE.InstancedMesh(f.geo, bodyMat, cap); m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.count = 0; world.add(m);
      const e = f.glow ? new THREE.InstancedMesh(f.glow, eyeMat, cap) : null; if (e) { e.frustumCulled = false; e.count = 0; world.add(e); }
      return { m, e, n: 0 };
    });
    // the guardian is a pale Gravelord: tint by instance colour
    return (kinds[kind] = { meshes, cap });
  }
  const d = new THREE.Object3D();
  return {
    begin() { for (const k of Object.values(kinds)) for (const f of k.meshes) f.n = 0; },
    /** place one of the dead: frame 0/1, position, facing, extra pitch (falling), scale */
    add(kind, frame, x, y, z, face, pitch = 0, roll = 0, s = 1) {
      const k = kindOf(kind), f = k.meshes[frame]; if (f.n >= k.cap) return;
      d.position.set(x, y, z); d.rotation.set(pitch, face, roll, 'YXZ'); d.scale.setScalar(PEOPLE * s); d.updateMatrix();
      f.m.setMatrixAt(f.n, d.matrix); if (f.e) f.e.setMatrixAt(f.n, d.matrix); f.n++;
    },
    end() {
      for (const k of Object.values(kinds)) for (const f of k.meshes) {
        f.m.count = f.n; f.m.instanceMatrix.needsUpdate = true;
        if (f.e) { f.e.count = f.n; f.e.instanceMatrix.needsUpdate = true; }
      }
    },
    warm(list) { for (const k of list) kindOf(k); },
  };
}

/** a figure that walks: two baked frames in one group (villagers, townsfolk) */
export function bakedWalker(makeRig, mat) {
  const A = makeRig(), B = makeRig(); strideFrame(B);
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const fa = bake(A), fb = bake(B);
  const ma = new THREE.Mesh(fa.geo, mat), mb = new THREE.Mesh(fb.geo, mat);
  for (const m of [ma, mb]) { m.castShadow = true; body.add(m); }
  mb.visible = false; g.scale.setScalar(PEOPLE);
  return { g, body, frames: [ma, mb] };
}

/** a full rig with live joints for the hero and sellswords */
export function liveRig(root) {
  const j = root.userData.joints, legs = root.userData.legs;
  const base = {
    legs: legs.map(l => ({ l, x: l.rotation.x, k: l.children.find(c => c.isGroup), kx: l.children.find(c => c.isGroup)?.rotation.x || 0 })),
    sL: j.sL && j.sL.rotation.x, sR: j.sR && j.sR.rotation.x, spine: j.spine.rotation.x,
  };
  const g = new THREE.Group(); g.add(root); root.scale.multiplyScalar(PEOPLE);
  return {
    g, joints: j,
    pose(walk, phase, swing = -1) {
      const s = walk ? Math.sin(phase) : 0;
      base.legs.forEach((q, i) => { q.l.rotation.x = q.x + (i ? -s : s) * 0.55; if (q.k) q.k.rotation.x = q.kx + Math.max(0, i ? s : -s) * 0.6; });
      if (j.sL) j.sL.rotation.x = base.sL - s * 0.35;
      if (j.sR) j.sR.rotation.x = swing >= 0 ? base.sR - 1.6 + swing * 2.4 : base.sR + s * 0.35;
      j.spine.rotation.x = base.spine + (walk ? 0.06 : 0);
      if (j.body.userData.y0 === undefined) j.body.userData.y0 = j.body.position.y;
      j.body.position.y = j.body.userData.y0 + (walk ? Math.abs(Math.sin(phase)) * 0.04 : 0);
    },
  };
}
