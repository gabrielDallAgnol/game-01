// Hollowmere city kit · Geometry builder B: collects pieces per material and merges them into one vertex-coloured mesh.
/* global THREE */
import { CFG } from './config.js';
import { VCM, EMITW, M } from './materials.js';
// [top]

// ---------- geometry builder: collects pieces per material, merges at the end ----------
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const gcache = new Map();
function rboxGeo(w, h, d, r) {
  r = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
  const round = r > 0.0015 && !(CFG.lite && Math.min(w, h, d) < 0.35);
  if (!gcache.has(key)) { const g0 = round ? new THREE.RoundedBoxGeometry(w, h, d, CFG.lite ? 1 : 2, r) : new THREE.BoxGeometry(w, h, d); gcache.set(key, g0.index ? g0.toNonIndexed() : g0); }
  return gcache.get(key);
}
class B {
  constructor() { this.parts = new Map(); this.extra = []; }
  geo(mat, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE); tmpS.set(sx, sy, sz); tmpP.set(x, y, z);
    tmpM.compose(tmpP, tmpQ, tmpS);
    const gg = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(tmpM);
    if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
    const key = typeof mat === 'string' ? mat : mat.uuid;
    if (!this.parts.has(key)) this.parts.set(key, { mat: typeof mat === 'string' ? M(mat) : mat, list: [], plain: typeof mat === 'string' });
    this.parts.get(key).list.push(gg);
    return this;
  }
  // a bevelled box standing on y (bottom), centred on x/z
  box(mat, w, h, d, x = 0, y = 0, z = 0, o = {}) { return this.geo(mat, rboxGeo(w, h, d, o.r ?? 0.035), x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0); }
  // a box centred on (x, y, z)
  cbox(mat, w, h, d, x, y, z, o = {}) { return this.geo(mat, rboxGeo(w, h, d, o.r ?? 0.03), x, y, z, o.rx || 0, o.ry || 0, o.rz || 0); }
  cyl(mat, rt, rb, h, x, y, z, o = {}) { return this.geo(mat, new THREE.CylinderGeometry(rt, rb, h, o.seg || 10, 1, !!o.open), x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0); }
  sph(mat, r, x, y, z, o = {}) { return this.geo(mat, new THREE.IcosahedronGeometry(r, o.detail ?? 2), x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1); }
  add(obj) { this.extra.push(obj); return this; }
  // Every plain colour (a palette key, '#hex', or a plain lit material) is merged into ONE vertex-coloured mesh, so a
  // many-coloured model costs a single draw call. Glowing parts (windows, lanterns, bulbs) join it too: they carry
  // aEmit and light up with the town at dusk. Grounding: vertex colours darken toward the model's base (aoH: the
  // height in model units over which the darkening fades) and on faces turned to the ground.
  // o.vc = false keeps one mesh per material (old behaviour); o.ao = aoH; o.aoMin = darkest; o.cast = shadows.
  build(o = {}) {
    const g = new THREE.Group();
    let parts = [...this.parts.values()];
    if (o.vc !== false) {
      const rest = [], list = [], aoH = o.ao ?? 1.4, aoMin = o.aoMin ?? 0.6;
      for (const p of parts) {
        const mt = p.mat, em = EMITW.get(mt) || 0;
        const plainLit = mt.isMeshStandardMaterial && !mt.transparent && !mt.map && mt.side === THREE.FrontSide && !mt.vertexColors && (em > 0 || !(mt.emissive && mt.emissive.r + mt.emissive.g + mt.emissive.b > 0 && mt.emissiveIntensity > 0));
        if (!plainLit) { rest.push(p); continue; }
        const c = mt.color;
        for (let gg of p.list) {
          if (gg.attributes.uv) gg.deleteAttribute('uv');
          if (mt.flatShading) gg.computeVertexNormals();
          const pa = gg.attributes.position, na = gg.attributes.normal, n = pa.count, a = new Float32Array(n * 3), e = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            let k = 1;
            // (no grounding bake from above: the flat look)
            a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; e[i] = em;
          }
          gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); gg.setAttribute('aEmit', new THREE.BufferAttribute(e, 1));
          list.push(gg);
        }
      }
      if (list.length) rest.push({ mat: VCM, list });
      parts = rest;
    }
    for (const { mat, list } of parts) {
      const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(list, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = o.cast ?? !mat.transparent; mesh.receiveShadow = true;
      g.add(mesh);
    }
    for (const e of this.extra) g.add(e);
    return g;
  }
}

export { rboxGeo, B };
