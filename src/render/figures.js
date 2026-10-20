// Figures for the live game: bake kit rigs into single vertex-coloured meshes (two walk frames each),
// draw the dead as instanced crowds, and animate full rigs for the hero and sellswords.
/* global THREE */
import { K, CFG } from './kit.js';

export const PEOPLE = 0.6;          // world units per metre for people (buildings use 0.3: people read a bit larger)

const tmpM = new THREE.Matrix4(), inv = new THREE.Matrix4(), col = new THREE.Color();
/** merge every mesh under obj into one geometry with a colour attribute; glowing parts go to `glow` */
export function bake(obj, o = {}) {
  obj.updateMatrixWorld(true);
  inv.copy(obj.matrixWorld).invert();
  const body = [], glow = [];
  obj.traverse(m => {
    if (!m.isMesh || !m.geometry || m.isInstancedMesh) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (mat.transparent && mat.opacity < 0.6) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    tmpM.multiplyMatrices(inv, m.matrixWorld); g.applyMatrix4(tmpM);
    const isGlow = mat.emissive && mat.emissiveIntensity > 1.5;
    col.copy(isGlow ? mat.emissive : mat.color);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), vc = mat.vertexColors && g.attributes.color;
    // welded figure parts already carry their colours: keep them (tinted by the material colour)
    // o.ao: darken toward the feet (grounding) over this height, in the baked model's units
    const pa = g.attributes.position;
    for (let i = 0; i < n; i++) { let k = 1; if (o.ao && !isGlow) { const t = Math.min(1, Math.max(0, pa.getY(i) / o.ao)); k = 0.62 + 0.38 * t * t * (3 - 2 * t); } c[i * 3] = col.r * (vc ? vc.getX(i) : 1) * k; c[i * 3 + 1] = col.g * (vc ? vc.getY(i) : 1) * k; c[i * 3 + 2] = col.b * (vc ? vc.getZ(i) : 1) * k; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    (isGlow ? glow : body).push(g);
  });
  const merge = list => list.length ? THREE.BufferGeometryUtils.mergeBufferGeometries(list, false) : null;
  return { geo: merge(body), glow: merge(glow) };
}
// x-ray: where a building hides a figure, a soft silhouette shows through it. Drawn only where something is in front
// by more than the figure's own depth (vertices pulled toward the camera), so the figure never x-rays itself.
export function xrayMat(color, o = {}) {
  const m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(o.boost ?? 1.25), transparent: true, opacity: o.opacity ?? 0.45, depthWrite: false, depthFunc: THREE.GreaterDepth, skinning: !!o.skinning });
  const push = { value: o.push ?? 1.1 };
  m.onBeforeCompile = sh => {
    sh.uniforms.xrPush = push;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float xrPush;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  mvPosition.xyz *= max(0.0, 1.0 - xrPush / length(mvPosition.xyz));\n  gl_Position = projectionMatrix * mvPosition;');
  };
  m.customProgramCacheKey = () => 'xray';
  return m;
}
// ---------- outlines: an inverted hull a constant ~1.5 px wide at any zoom, so a figure reads without zooming in ----------
// The hull grows along smoothed normals (the welded figures have flat normals: grown along those the faces split apart).
const _key = (x, y, z) => `${Math.round(x * 2000)},${Math.round(y * 2000)},${Math.round(z * 2000)}`;
export function outlineNormals(geo) {
  if (!geo || geo.attributes.oNormal) return geo;
  const p = geo.attributes.position, n = geo.attributes.normal, acc = new Map(), keys = new Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = keys[i] = _key(p.getX(i), p.getY(i), p.getZ(i)); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]);
    if (n) { a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
  }
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const a = acc.get(keys[i]), l = Math.hypot(a[0], a[1], a[2]) || 1; out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l; }
  geo.setAttribute('oNormal', new THREE.BufferAttribute(out, 3));
  return geo;
}
export const OUTLINE = { px: 0.0011 };   // hull width per unit of view distance (~1.5 px on a phone at fov 28)
const outlineMats = {};
/** a back-face hull in one flat colour; works on plain, instanced and skinned meshes */
export function outlineMat(color, o = {}) {
  const key = `${color}|${o.skinning ? 1 : 0}|${o.w || 1}`; if (outlineMats[key]) return outlineMats[key];
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.BackSide, skinning: !!o.skinning, fog: false });
  const w = { value: OUTLINE.px * (o.w || 1) };
  m.onBeforeCompile = sh => {
    sh.uniforms.uOutline = w;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline;\nattribute vec3 oNormal;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    mat4 oM = modelMatrix;
    #ifdef USE_INSTANCING
      oM = oM * instanceMatrix;
    #endif
    vec4 oV = viewMatrix * oM * vec4(position, 1.0);
    float oS = max(length(oM[0].xyz), 1e-4);
    transformed += oNormal * uOutline * max(-oV.z, 1.0) / oS;
  }`);
  };
  m.customProgramCacheKey = () => `outline${o.skinning ? 's' : ''}`;
  return (outlineMats[key] = m);
}
/** a skinned figure gets its hull: the same geometry and skeleton, drawn back faces only */
export function outlineSkinned(sm, color, w = 1) {
  if (!sm) return null;
  outlineNormals(sm.geometry);
  const o = new THREE.SkinnedMesh(sm.geometry, outlineMat(color, { skinning: true, w }));
  o.bind(sm.skeleton, sm.bindMatrix); o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; o.userData.xray = true; o.userData.outline = true;
  sm.parent.add(o); return o;
}

/** the figure palette is lit with a rim: warm by day, moon-blue by night (K.T.rim) */
export const SKINMAT = K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, skinning: true }), { rim: true });
const _m = new THREE.Matrix4();
/** turn a welded rig (one mesh per joint) into ONE skinned mesh on the same joints: a live figure is a single draw */
export function skin(root, mat = SKINMAT) {
  root.updateMatrixWorld(true);
  const bones = []; root.traverse(o => { if (o.userData.bone) bones.push(o); });
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert(), geos = [];
  bones.forEach((b, bi) => {
    for (const c of [...b.children]) {
      if (!c.isMesh || c.material !== K.FIGMAT) continue;
      const g = c.geometry.clone(); g.applyMatrix4(_m.multiplyMatrices(rootInv, c.matrixWorld));
      const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      geos.push(g); b.remove(c);
    }
  });
  if (!geos.length) return null;
  const sm = new THREE.SkinnedMesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false), mat);
  root.add(sm); root.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones), sm.matrixWorld);
  sm.frustumCulled = false; sm.castShadow = true; sm.receiveShadow = true;
  return sm;
}
export const vcMat = (o = {}) => K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.86, metalness: 0 }), { sway: o.sway, rim: o.rim, flash: o.flash });

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

// the dead: a near-black violet edge (darker than the night ground, far darker than the meadow); people: dark umber
export const CROWD_OUTLINE = { dead: '#07060b', folk: '#1c120a' };
const KIND_RIG = {
  walker: 'walker', runner: 'runner', crawler: 'crawler', brute: 'brute', spitter: 'spitter', bloater: 'bloater', screamer: 'screamer', gravelord: 'gravelord', guardian: 'gravelord', deer: 'deer', wolf: 'wolf', boar: 'boar',
};
/** the dead (and the townsfolk), drawn in batches: two instanced frames per kind plus their glowing eyes.
 *  Each instance carries aFlash (0..1): the hit flash and squash. */
export function createCrowd(world) {
  const kinds = {};
  // the dead are ash-violet with a moon rim; in the dark beyond the light only their eyes show
  const bodyMat = K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { rim: true, flash: true });
  const folkMat = K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { rim: true, flash: true });
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true }); eyeMat.color.setRGB(5, 5, 5);
  const FOLK = /^folk(\d+)(s?)$/;
  function kindOf(kind) {
    if (kinds[kind]) return kinds[kind];
    const fm = FOLK.exec(kind);
    const make = alt => {
      if (fm) return K.folk(+fm[1] * 101 + 7, { sit: fm[2] === 's' });
      CFG.eyeScale = 2.6; const r = K.dead[KIND_RIG[kind] || 'walker']({ alt }); CFG.eyeScale = 1; if (kind === 'guardian') r.scale.multiplyScalar(0.8); return r;
    };
    const A = make(false), B = make(true); strideFrame(B);
    const frames = [bake(A, { ao: 0.45 }), bake(B, { ao: 0.45 })];
    const cap = kind === 'gravelord' || kind === 'guardian' ? 12 : kind === 'deer' || kind === 'wolf' || kind === 'boar' ? 60 : fm ? 40 : 400;
    const meshes = frames.map(f => {
      const fl = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); fl.setUsage(THREE.DynamicDrawUsage);
      f.geo.setAttribute('aFlash', fl);
      const m = new THREE.InstancedMesh(f.geo, fm ? folkMat : bodyMat, cap); m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.count = 0; world.add(m);
      const e = f.glow ? new THREE.InstancedMesh(f.glow, eyeMat, cap) : null; if (e) { e.frustumCulled = false; e.count = 0; world.add(e); }
      // the hull shares the body's instance matrices: one extra draw per kind and frame
      outlineNormals(f.geo);
      const big = kind === 'gravelord' || kind === 'guardian' || kind === 'brute';
      const ol = new THREE.InstancedMesh(f.geo, outlineMat(fm ? CROWD_OUTLINE.folk : CROWD_OUTLINE.dead, { w: big ? 1.35 : 1 }), cap); ol.instanceMatrix = m.instanceMatrix; ol.frustumCulled = false; ol.count = 0; ol.castShadow = false; world.add(ol);
      return { m, e, ol, n: 0, fl };
    });
    return (kinds[kind] = { meshes, cap });
  }
  const d = new THREE.Object3D();
  return {
    begin() { for (const k of Object.values(kinds)) for (const f of k.meshes) f.n = 0; },
    /** place one figure: frame 0/1, position, facing, extra pitch (falling), roll, scale, flash */
    add(kind, frame, x, y, z, face, pitch = 0, roll = 0, s = 1, flash = 0) {
      const k = kindOf(kind), f = k.meshes[frame]; if (f.n >= k.cap) return;
      d.position.set(x, y, z); d.rotation.set(pitch, face, roll, 'YXZ'); d.scale.setScalar(PEOPLE * s); d.updateMatrix();
      f.m.setMatrixAt(f.n, d.matrix); if (f.e) f.e.setMatrixAt(f.n, d.matrix); f.fl.array[f.n] = flash; f.n++;
    },
    end() {
      for (const k of Object.values(kinds)) for (const f of k.meshes) {
        f.m.count = f.n; f.m.instanceMatrix.needsUpdate = true; f.fl.needsUpdate = true; if (f.ol) f.ol.count = f.n;
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
export function liveRig(root, outline = '#1c120a', ow = 1) {
  const j = root.userData.joints, legs = root.userData.legs;
  const sm = skin(root), hull = outline ? outlineSkinned(sm, outline, ow) : null;
  const base = {
    legs: legs.map(l => ({ l, x: l.rotation.x, k: l.children.find(c => c.isGroup), kx: l.children.find(c => c.isGroup)?.rotation.x || 0 })),
    sL: j.sL && j.sL.rotation.x, sR: j.sR && j.sR.rotation.x, spine: j.spine.rotation.x,
  };
  const g = new THREE.Group(); g.add(root); root.scale.multiplyScalar(PEOPLE);
  return {
    g, joints: j, hull,
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
