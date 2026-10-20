// Beacons: supply drops (a crate under a canopy with red smoke and an opening ring) and street encounters
// (a blue beacon; the trial's red one).
/* global THREE */
import { K } from '../kit.js';
import { lc, ringGeo } from './shared.js';

export function createBeacons(V) {
  const { S, C, world, Wv, glowTex } = V;
  // ---------- supply drops: a crate under a canopy, red smoke you can see from afar, a ring while you open it ----------
  const dropViews = new Map();
  const smokeMat = () => new THREE.SpriteMaterial({ map: glowTex, color: lc('#e0603a'), transparent: true, opacity: 0.5, depthWrite: false, depthTest: false });
  function dropModel() {
    const g = new THREE.Group(), b = new K.B();
    b.cbox('amberDeep', 0.9, 0.6, 0.7, 0, 0, 0, { r: 0.04 }); b.cbox('canvas', 0.95, 0.08, 0.75, 0, 0.6, 0, { r: 0.02 });
    b.box('metal', 0.95, 0.06, 0.06, 0, 0.3, 0.36); b.box('metal', 0.95, 0.06, 0.06, 0, 0.3, -0.36);
    const crate = b.build(); crate.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(crate);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: lc('#d9c9a3'), roughness: 0.9, side: THREE.DoubleSide }));
    canopy.position.set(0.9, 0.05, 0.4); canopy.rotation.z = 1.35; canopy.scale.y = 0.4; g.add(canopy);
    const smoke = []; for (let k = 0; k < 7; k++) { const sp = new THREE.Sprite(smokeMat()); sp.position.set(0, 1 + k * 0.9, 0); sp.scale.setScalar(1 + k * 0.35); g.add(sp); smoke.push(sp); }
    const ring = new THREE.Mesh(ringGeo(1.55, 1.75), new THREE.MeshBasicMaterial({ color: lc('#f0c050').multiplyScalar(1.4), transparent: true, opacity: 0.9, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    return { g, smoke, ring };
  }
  // street encounters: a blue beacon you can see from far away
  const spotViews = new Map(), beamTex = glowTex;
  const bangMat = new THREE.SpriteMaterial({ map: K.textTex('!', { w: 64, h: 64, size: 54, bg: '#0e2230', fg: '#7fd4ff' }), transparent: true, depthTest: false });
  function syncSpots(t) {
    const list = (S.story && S.story.spots) || [], seenIds = new Set();
    for (const sp of list) {
      seenIds.add(sp.id); let v = spotViews.get(sp.id);
      if (!v) {
        const g = new THREE.Group(); g.position.copy(Wv(sp.x, sp.y));
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, 7, 12, 1, true), new THREE.MeshBasicMaterial({ color: lc('#7fd4ff').multiplyScalar(0.8), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        col.position.y = 3.5; g.add(col);
        const bang = new THREE.Sprite(bangMat); bang.scale.set(0.8, 0.8, 1); bang.renderOrder = 9; g.add(bang);
        const ring = new THREE.Mesh(ringGeo(0.9, 1.05), new THREE.MeshBasicMaterial({ color: lc('#7fd4ff').multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
        world.add(g); v = { g, bang, ring, col }; spotViews.set(sp.id, v);
      }
      v.g.visible = S.phase === 'day'; v.bang.position.y = 2.2 + Math.sin(t * 3 + sp.id) * 0.15; v.ring.scale.setScalar(1 + (t * 0.8 % 1) * 0.6); v.ring.material.opacity = 0.8 * (1 - (t * 0.8 % 1));
    }
    // the trial: a red beacon
    const tr = S.story && S.story.trial;
    if (tr && !tr.done) {
      seenIds.add('trial'); let v = spotViews.get('trial');
      if (!v) {
        const g = new THREE.Group(); g.position.copy(Wv(tr.x, tr.y));
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: lc('#ff5a3c').multiplyScalar(0.9), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        col.position.y = 5; g.add(col);
        const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex('⚔', { w: 64, h: 64, size: 46, bg: '#2a0e0a', fg: '#ff7a62' }), transparent: true, depthTest: false })); bang.scale.set(1, 1, 1); bang.renderOrder = 9; g.add(bang);
        const ring = new THREE.Mesh(ringGeo(1.6, 1.8), new THREE.MeshBasicMaterial({ color: lc('#ff5a3c').multiplyScalar(1.5), transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
        world.add(g); v = { g, bang, ring, col }; spotViews.set('trial', v);
      }
      v.bang.position.y = 2.6 + Math.sin(t * 3) * 0.15; v.ring.scale.setScalar(1 + (t * 0.6 % 1) * 0.4); v.ring.material.opacity = 0.8 * (1 - (t * 0.6 % 1));
    }
    for (const [id, v] of spotViews) if (!seenIds.has(id)) { world.remove(v.g); spotViews.delete(id); }
  }
  function syncDrops(t) {
    const seen = new Set();
    for (const d of S.drops) {
      seen.add(d.id); let v = dropViews.get(d.id);
      if (!v) { v = dropModel(); v.g.position.copy(Wv(d.x, d.y)); world.add(v.g); dropViews.set(d.id, v); }
      v.smoke.forEach((sp, k) => { const ph = (t * 0.35 + k / v.smoke.length) % 1; sp.position.y = 1 + ph * 6.5; sp.material.opacity = 0.55 * (1 - ph); sp.scale.setScalar(0.8 + ph * 2.6); sp.position.x = Math.sin(ph * 3 + k) * 0.4; });
      const p = d.prog / 3; v.ring.visible = p > 0.01; v.ring.scale.setScalar(0.3 + p * 0.7);
    }
    for (const [id, v] of dropViews) if (!seen.has(id)) { world.remove(v.g); dropViews.delete(id); V.feel.burst(v.g.position.x + C, v.g.position.z + C, 1.5, '#f0c050'); }
  }
  return { syncDrops, syncSpots };
}
