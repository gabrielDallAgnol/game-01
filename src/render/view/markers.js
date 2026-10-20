// Ground markers: the selection and range rings, the move mark, the hero and bounty rings, and the contract's
// hive tag (a cyan System label and a slow ring over the objective).
/* global THREE */
import { K } from '../kit.js';
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

  let kTag = null, kRing = null;   // the contract's hive marker
  /** the contract's hive: a cyan System tag and a slow ring over it, seen from anywhere (the objective has a place) */
  function updateContract() {
    const time = V.time;
    { const k = S.story && S.story.contract, on = !!(k && !k.won && !k.lost && k.finale.kind === 'hive' && S.nestAlive[k.finale.region]);
      if (on && (!kTag || kTag.userData.name !== k.finale.name)) {
        if (kTag) { fx.remove(kTag); fx.remove(kRing); }
        kTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(`CONTRACT · ${k.finale.name.toUpperCase()}`, { w: 512, h: 64, size: 30, bg: '#06202c', fg: '#7fe3ff', spacing: '3px' }), transparent: true, depthTest: false, fog: false }));
        kTag.scale.set(4.4, 0.55, 1); kTag.renderOrder = 23; kTag.userData.name = k.finale.name; fx.add(kTag);
        kRing = new THREE.Mesh(ringGeo(3.0, 3.25), new THREE.MeshBasicMaterial({ color: lc('#7fe3ff').multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false, fog: false })); kRing.rotation.x = -Math.PI / 2; fx.add(kRing);
      }
      if (kTag) { kTag.visible = kRing.visible = on; if (on) { const n = map.regions[k.finale.region].nest; kTag.position.copy(Wv(n.x, n.y, 5.2 + Math.sin(time * 2) * 0.12)); kRing.position.copy(Wv(n.x, n.y, 0.1)); kRing.scale.setScalar(1 + (time * 0.5 % 1) * 0.25); kRing.material.opacity = 0.7 * (1 - (time * 0.5 % 1)); } } }
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
  return { heroRing, bountyRing, updateContract, updateSelection, showMove };
}
