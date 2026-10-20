// Projectiles in flight (arrows, rot spit) and the bolts that flash between two points.
/* global THREE */
import { lc } from './shared.js';

export function createProjectiles(V) {
  const { S, world, fx, W, Wv } = V;
  const pMeshes = new Map(), effects = [];
  const arrowGeo = new THREE.BoxGeometry(0.04, 0.04, 0.6), spitGeo = new THREE.IcosahedronGeometry(0.13, 0);
  const arrowMat = new THREE.MeshBasicMaterial({ color: lc('#f0e2c4').multiplyScalar(1.5) }), spitMat = new THREE.MeshBasicMaterial({ color: lc('#b4ff4e').multiplyScalar(2) });
  const shellGeo = new THREE.IcosahedronGeometry(0.2, 1), shellMat = new THREE.MeshBasicMaterial({ color: lc('#ffb060').multiplyScalar(1.6) });   // [towers] a mortar shell: a glowing ball on a high arc
  function syncProjectiles() {
    const seen = new Set();
    for (const p of S.projectiles) {
      seen.add(p.id);
      let m = pMeshes.get(p.id);
      if (!m) { m = new THREE.Mesh(p.enemy ? spitGeo : p.shell ? shellGeo : arrowGeo, p.enemy ? spitMat : p.shell ? shellMat : arrowMat); m.userData.d0 = Math.max(1, Math.hypot(p.tx - p.x, p.ty - p.y)); world.add(m); pMeshes.set(p.id, m); }
      const d = Math.hypot(p.tx - p.x, p.ty - p.y);
      if (p.shell) { const k = 1 - Math.min(1, d / m.userData.d0); m.position.copy(Wv(p.x, p.y, 3 * (1 - k) + 0.4 + Math.sin(k * Math.PI) * m.userData.d0 * 0.45)); continue; }
      const h = p.z * Math.min(1, d / 6) * 0.7 + 0.6;
      m.position.copy(Wv(p.x, p.y, h)); m.lookAt(W(p.tx, p.ty, 0.7));
    }
    for (const [id, m] of pMeshes) if (!seen.has(id)) { world.remove(m); pMeshes.delete(id); }
  }
  function bolt(e) {
    const len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0), m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, len), new THREE.MeshBasicMaterial({ color: lc('#ffe0a0').multiplyScalar(2), transparent: true, opacity: 0.95 }));
    m.position.copy(Wv((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, 1.8)); m.lookAt(W(e.x1, e.y1, 1.8)); fx.add(m); effects.push({ m, t: 0, r: 0, line: true });
  }
  /** once a frame: bolts (and any ring effects) fade out */
  function updateEffects(dt) {
    for (const f of [...effects]) { f.t += dt; if (!f.line) { const s = 0.5 + f.t * f.r * 2.2; f.m.scale.set(s, s, s); } f.m.material.opacity = Math.max(0, 0.9 - f.t * 1.4); if (f.t > 0.7) { fx.remove(f.m); effects.splice(effects.indexOf(f), 1); } }
  }
  return { sync: syncProjectiles, bolt, updateEffects };
}
