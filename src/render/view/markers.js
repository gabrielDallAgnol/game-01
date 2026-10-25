// Ground markers: the selection and range rings, the move mark, the hero and bounty rings, and the MAIN objective
// marker (a gold beam, ring and "MAIN" System tag over each objective the System requires).
/* global THREE */
import { lc, ringGeo } from './shared.js';

export function createMarkers(V) {
  const { S, map, C, fx, Wv } = V;
  // ---------- markers ----------
  const selRing = new THREE.Mesh(ringGeo(1.45, 1.6), new THREE.MeshBasicMaterial({ color: lc('#ffffff').multiplyScalar(1.2), transparent: true, opacity: 0.9, depthWrite: false }));
  selRing.rotation.x = -Math.PI / 2; selRing.position.y = 0.1; selRing.visible = false; fx.add(selRing);
  const rangeRing = new THREE.Mesh(ringGeo(0.985, 1), new THREE.MeshBasicMaterial({ color: lc('#ffffff'), transparent: true, opacity: 0.4, depthWrite: false }));
  rangeRing.rotation.x = -Math.PI / 2; rangeRing.position.y = 0.09; rangeRing.visible = false; fx.add(rangeRing);
  const moveMark = new THREE.Mesh(ringGeo(0.3, 0.42), new THREE.MeshBasicMaterial({ color: lc('#ecdfc6'), transparent: true, opacity: 0, depthWrite: false }));
  moveMark.rotation.x = -Math.PI / 2; moveMark.position.y = 0.07; fx.add(moveMark);
  const heroRing = new THREE.Mesh(ringGeo(0.42, 0.5), new THREE.MeshBasicMaterial({ color: lc('#fff1d6'), transparent: true, opacity: 0.75, depthWrite: false }));
  heroRing.rotation.x = -Math.PI / 2; heroRing.renderOrder = 4; fx.add(heroRing);
  const bountyRing = new THREE.Mesh(ringGeo(0.97, 1), new THREE.MeshBasicMaterial({ color: lc('#f0c050').multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false }));
  bountyRing.rotation.x = -Math.PI / 2; bountyRing.renderOrder = 4; fx.add(bountyRing);

  // ---------- MAIN objectives: what the System requires (the contract, the trial, a story quest's step) ----------
  // One look for all of them, so "required" reads at a glance: a gold beam, a pulsing gold ring and a System tag
  // "MAIN · TRIAL" seen from anywhere. Optional places (beacons, sites, drops) stay small and quiet elsewhere.
  const GOLD = '#ffd36a';
  function tagTex(label) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 112; const x = c.getContext('2d'), r = 14;
    const rr = (x0, y0, w, h, rad) => { x.beginPath(); x.moveTo(x0 + rad, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, rad); x.arcTo(x0 + w, y0 + h, x0, y0 + h, rad); x.arcTo(x0, y0 + h, x0, y0, rad); x.arcTo(x0, y0, x0 + w, y0, rad); x.closePath(); };
    x.font = '700 50px Arial Narrow, Arial, sans-serif'; const tw = Math.min(300, x.measureText(label).width), W = 170 + tw + 36, x0 = (512 - W) / 2;
    rr(x0 + 3, 8, W - 6, 96, r); x.fillStyle = 'rgba(10,16,26,.92)'; x.fill(); x.lineWidth = 5; x.strokeStyle = GOLD; x.stroke();
    rr(x0 + 16, 22, 140, 68, 9); x.fillStyle = GOLD; x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#1a1206'; x.font = '800 46px Arial Narrow, Arial, sans-serif'; x.fillText('MAIN', x0 + 86, 59);
    x.textAlign = 'left'; x.fillStyle = '#fff1c9'; x.font = '700 50px Arial Narrow, Arial, sans-serif'; x.fillText(label, x0 + 174, 59, 300);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: lc(GOLD).multiplyScalar(0.9), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beamGeo = new THREE.CylinderGeometry(0.32, 0.85, 14, 14, 1, true), coreGeo = new THREE.CylinderGeometry(0.08, 0.16, 14, 8, 1, true);
  const mainViews = new Map();
  function mainMark(o) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = 7; beam.renderOrder = 5; g.add(beam);
    const core = new THREE.Mesh(coreGeo, beamMat); core.position.y = 7; core.renderOrder = 5; g.add(core);
    const ring = new THREE.Mesh(ringGeo(1.55, 1.85), new THREE.MeshBasicMaterial({ color: lc(GOLD).multiplyScalar(1.6), transparent: true, opacity: 0.8, depthWrite: false, fog: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.renderOrder = 4; g.add(ring);
    const base = new THREE.Mesh(ringGeo(1.0, 1.12), new THREE.MeshBasicMaterial({ color: lc(GOLD).multiplyScalar(1.4), transparent: true, opacity: 0.9, depthWrite: false, fog: false })); base.rotation.x = -Math.PI / 2; base.position.y = 0.09; base.renderOrder = 4; g.add(base);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(o.label.toUpperCase()), transparent: true, depthTest: false, fog: false })); tag.scale.set(6.0, 1.3, 1); tag.renderOrder = 23; g.add(tag);
    fx.add(g); return { g, ring, tag, label: o.label, big: o.kind === 'contract' };
  }
  /** every main objective with a place gets the gold marker; it goes when the objective does */
  function updateMain() {
    const time = V.time, st = V.game.story && V.game.story(), list = st && st.objectives ? st.objectives() : [], seen = new Set();
    for (const o of list) {
      if (o.priority !== 'main' || o.x === undefined) continue;
      seen.add(o.key); let v = mainViews.get(o.key);
      if (v && v.label !== o.label) { fx.remove(v.g); v = null; }
      if (!v) { v = mainMark(o); mainViews.set(o.key, v); }
      const s = v.big ? 1.5 : 1, ph = (time * 0.6) % 1;
      v.g.position.copy(Wv(o.x, o.y, 0)); v.ring.scale.setScalar(s * (1 + ph * 0.6)); v.ring.material.opacity = 0.85 * (1 - ph);
      v.tag.position.y = (v.big ? 6.4 : 5.4) + Math.sin(time * 2) * 0.12;
      if (V.topMarks) V.topMarks.main(v);   // [top] no beam from above; the tag sits above the ring on screen
    }
    for (const [k, v] of mainViews) if (!seen.has(k)) { fx.remove(v.g); mainViews.delete(k); }
  }

  /** the selection ring (and the tower's range) under whatever the UI has selected; the move mark fades */
  function updateSelection(dt, sel) {
    const time = V.time;
    selRing.visible = !!sel; rangeRing.visible = false;
    if (sel) {
      let x, y, s = 1;
      if (sel.type === 'building') { const b = S.byId.get(sel.id); if (b) { x = b.x; y = b.y; s = b.type === 'tower' ? 0.6 : b.type === 'wall' ? 0.55 : 1.0; } else { x = C; y = C; } }
      else if (sel.type === 'keep') { x = C; y = C; s = 1.9; }
      else if (sel.type === 'region') { const reg = map.regions[sel.id], n = reg.nest || reg; x = n.x; y = n.y; s = reg.nest ? 1.8 : 3; }
      else if (sel.type === 'rubble') { x = Math.floor(sel.x) + 0.5; y = Math.floor(sel.y) + 0.5; s = 1.0; }
      else if (sel.type === 'landmark') { const l = S.landmarks[sel.id]; x = l.x; y = l.y; s = l.size * 0.6; }
      else if (sel.type === 'site') { const st = S.scav.sites[sel.id]; x = st.x; y = st.y; s = 0.6; }
      selRing.position.copy(Wv(x, y, 0.1)); const k = s + Math.sin(time * 4) * 0.04; selRing.scale.set(k, k, k);
      if (sel.range) { rangeRing.visible = true; rangeRing.position.copy(Wv(x, y, 0.09)); rangeRing.scale.set(sel.range, sel.range, sel.range); }
    }
    if (moveMark.material.opacity > 0) { moveMark.material.opacity = Math.max(0, moveMark.material.opacity - dt * 1.5); moveMark.scale.multiplyScalar(1 + dt * 0.8); }
  }
  function showMove(x, y) { moveMark.position.copy(Wv(x, y, 0.07)); moveMark.scale.set(1, 1, 1); moveMark.material.opacity = 0.9; }
  return { heroRing, bountyRing, updateMain, updateSelection, showMove };
}
