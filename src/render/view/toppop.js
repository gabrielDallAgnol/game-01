// [toppop] Readable from above: the hero, your buildings and the dead pop against the engine town at any zoom
// (30–100 m across), day and night. Flat unlit tokens on the ground, sized with the zoom like the marks:
// the hero stands on a violet ring with an ink edge, a facing tick and a soft light pool; your buildings get
// signal-blue roofs (own(): a vertex recolour of the cached model) and a blue frame round a cream pad; the dead
// darken to ash with ember eyes and stand on an ember pip that glows red at night. Colours: src/render/readable.js.
// Render only: reads the state, never writes it.
/* global THREE */
import { MOBS } from '../../content/mobs.js';
import { outlineMat } from '../figures.js';
import { TOP_FIG } from '../top.js';
import { READ } from '../readable.js';
import { K } from '../kit.js';
import { lc, FOOT, HERO_OUTLINE } from './shared.js';

const Y = 0.075, FIG = Math.sqrt(TOP_FIG);   // tokens grow with the bigger figures, a little less than they do
   // the tokens' height: over the town's ground plane (0.04), under every figure

export function createTopPop(V) {
  const { S, world, Wv, seenAt } = V;
  const k = () => (V.topMarks ? V.topMarks.k() : 1);
  const basic = (hex, o = {}) => new THREE.MeshBasicMaterial({ color: lc(hex), transparent: true, depthWrite: false, fog: false, ...o });
  const flat = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.renderOrder = order; return m; };
  /** concentric bands [r0, r1, hex] folded into one vertex-coloured flat geometry */
  function bands(list, seg = 32) {
    const geos = list.map(([a, b, hex]) => { const g = a > 0 ? new THREE.RingGeometry(a, b, seg) : new THREE.CircleGeometry(b, seg), c = lc(hex), n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv'); return g; });
    const g = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false); g.rotateX(-Math.PI / 2); return g;
  }
  const glowTex = V.glowTex;

  // ---------- the hero: violet ring, ink edge, a facing tick, a light pool by day and night ----------
  const hero = new THREE.Group(); world.add(hero);
  const hDay = flat(new THREE.PlaneGeometry(4.4, 4.4), basic(READ.heroGlow, { map: glowTex, opacity: 0.55 }), 3);
  const hNight = flat(new THREE.PlaneGeometry(5.2, 5.2), basic(READ.heroGlow, { map: glowTex, opacity: 0, blending: THREE.AdditiveBlending }), 3);
  const hRing = new THREE.Mesh(bands([[0.56, 0.66, READ.heroInk], [0.66, 0.86, READ.hero], [0.86, 0.96, READ.heroInk]], 48), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false })); hRing.renderOrder = 4;
  const tickGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 1.34); s.lineTo(-0.3, 0.98); s.lineTo(0.3, 0.98); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.scale(1, 1, -1); return g; })();
  const tickInk = new THREE.Mesh(tickGeo, basic(READ.heroInk)); tickInk.scale.setScalar(1.18); tickInk.position.y = -0.002; tickInk.renderOrder = 4;
  const tick = new THREE.Mesh(tickGeo, basic(READ.hero)); tick.renderOrder = 5;
  const tickG = new THREE.Group(); tickG.add(tickInk, tick);
  hero.add(hDay, hNight, hRing, tickG);
  outlineMat(HERO_OUTLINE, { skinning: true, w: 1.2 }).color.copy(lc(READ.heroInk));   // the hero's own hull: ink, not hi-vis amber (the amber read as a sand roof from above)

  // ---------- the dead: ash bodies, ember eyes; an ember pip under each (ink edge, ash heart), a red glow at night ----------
  if (V.crowd && V.crowd.mats) { V.crowd.mats.body.color.setRGB(0.36, 0.33, 0.35); V.crowd.mats.eye.color.copy(lc(READ.deadEmber)).multiplyScalar(5); }
  const CAP = 400;
  const pipMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false });
  const pips = new THREE.InstancedMesh(bands([[0, 0.6, READ.dead], [0.6, 0.84, READ.deadEmber], [0.84, 1, READ.deadInk]], 20), pipMat, CAP);
  const glowGeo = new THREE.PlaneGeometry(1, 1); glowGeo.rotateX(-Math.PI / 2);
  const glows = new THREE.InstancedMesh(glowGeo, basic(READ.deadEmber, { map: glowTex, opacity: 0, blending: THREE.AdditiveBlending }), CAP);
  for (const m of [pips, glows]) { m.frustumCulled = false; m.count = 0; world.add(m); }
  pips.renderOrder = 4; glows.renderOrder = 3;
  const d = new THREE.Object3D();
  const sizeOf = m => (MOBS[m.kind] ? MOBS[m.kind].size : 1) * (m.unique ? 1.35 : m.bossTier ? 1.2 + 0.2 * m.bossTier : 1);

  // ---------- your buildings: signal-blue roofs, a cream pad, a blue frame with an ink edge ----------
  const OWN = lc(READ.own), PAD = lc(READ.ownPad), padSrc = lc('#a49c8c'), cornerSrc = lc('#e08a3c');
  const near = (r, g, b, c) => Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b) < 0.04;
  /** recolour a cached building model once (all its clones share the geometry): what faces the sky above the walls goes blue */
  function own(m) {
    m.traverse(o => {
      if (!o.isMesh || o.material !== K.VCM) return;
      const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, ca = g.attributes.color; if (!ca || !na) return;
      g.computeBoundingBox(); const H = g.boundingBox.max.y - g.boundingBox.min.y, y0 = g.boundingBox.min.y;
      for (let i = 0; i < pa.count; i++) {
        const r = ca.getX(i), gg = ca.getY(i), b = ca.getZ(i), y = pa.getY(i) - y0, ny = na.getY(i);
        if (near(r, gg, b, padSrc)) ca.setXYZ(i, PAD.r, PAD.g, PAD.b);
        else if (near(r, gg, b, cornerSrc)) ca.setXYZ(i, OWN.r, OWN.g, OWN.b);
        else if (ny > 0.3 && y > Math.max(0.12, H * 0.42)) { const s = 0.8 + 0.2 * ny; ca.setXYZ(i, OWN.r * s, OWN.g * s, OWN.b * s); }
      }
      ca.needsUpdate = true;
    });
    return m;
  }
  const frameGeo = {};
  function frameFor(n, wall) {
    const key = n + (wall ? 'w' : ''); if (frameGeo[key]) return frameGeo[key];
    const h = n / 2 + (wall ? 0.02 : 0.1), t = wall ? 0.1 : 0.16, e = 0.06;
    const sq = (a, b, hex) => { const s = new THREE.Shape(); s.moveTo(-a, -a); s.lineTo(a, -a); s.lineTo(a, a); s.lineTo(-a, a); s.closePath(); const hole = new THREE.Path(); hole.moveTo(-b, -b); hole.lineTo(-b, b); hole.lineTo(b, b); hole.lineTo(b, -b); hole.closePath(); s.holes.push(hole); const g = new THREE.ShapeGeometry(s), c = lc(hex), cnt = g.attributes.position.count, arr = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv'); return g; };
    const g = THREE.BufferGeometryUtils.mergeBufferGeometries([sq(h + e, h, READ.ownInk), sq(h, h - t, READ.ownEdge), sq(h - t, h - t - e, READ.ownInk)], false); g.rotateX(-Math.PI / 2);
    return (frameGeo[key] = g);
  }
  const frameMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const frames = new Map();

  function update() {
    const time = V.time, dark = V.dark, h = S.hero, kk = k();
    // hero
    hero.visible = !h.dead;
    if (!h.dead) {
      hero.position.copy(Wv(h.x, h.y, Y));
      const s = Math.min(2.4, (0.85 + 0.35 * kk) * FIG); hRing.scale.setScalar(s); tickG.scale.setScalar(s); tickG.rotation.y = h.face || 0;
      hDay.material.opacity = 0.5 * (1 - dark); hNight.material.opacity = (0.55 + 0.08 * Math.sin(time * 2.4)) * dark;
      hDay.scale.setScalar((0.8 + 0.25 * kk) * FIG); hNight.scale.setScalar((0.85 + 0.25 * kk) * FIG);
      if (V.markers && V.markers.heroRing) V.markers.heroRing.visible = false;   // the old cream ring: the token replaces it
    }
    // the dead
    let n = 0; const ps = Math.min(2.4, (0.8 + 0.3 * kk) * FIG), gA = 0.5 * dark;
    for (const m of S.mobs) {
      if (n >= CAP) break;
      const def = MOBS[m.kind]; if (!def || def.animal || def.still || !seenAt(m.x, m.y)) continue;   // [ch1] a heart is no pip
      const sz = sizeOf(m), r = 0.5 * sz * ps * Math.max(0.15, Math.min(1, m.rise ?? 1)), p = Wv(m.x, m.y, Y - 0.005);
      d.position.copy(p); d.rotation.set(0, 0, 0); d.scale.setScalar(r); d.updateMatrix(); pips.setMatrixAt(n, d.matrix);
      d.scale.setScalar(2.8 * sz * (0.85 + 0.15 * kk) * (1 + 0.06 * Math.sin(time * 3 + m.id))); d.position.y -= 0.004; d.updateMatrix(); glows.setMatrixAt(n, d.matrix);
      n++;
    }
    pips.count = n; glows.count = gA > 0.01 ? n : 0; pips.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true; glows.material.opacity = gA;
    // your buildings
    const seen = new Set();
    for (const b of S.buildings) {
      seen.add(b.id); let f = frames.get(b.id);
      const nn = b.type === 'wall' ? 1 : FOOT[b.type] || 1;
      if (!f) { f = new THREE.Mesh(frameFor(nn, b.type === 'wall'), frameMat); f.renderOrder = 2; world.add(f); frames.set(b.id, f); f.position.copy(Wv(b.x, b.y, 0.07)); }
      f.visible = !b.ruined;
    }
    for (const [id, f] of frames) if (!seen.has(id)) { world.remove(f); frames.delete(id); }
  }
  return { update, own };
}
