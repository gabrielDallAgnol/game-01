// Tonight's routes: chevrons flowing from each hive to the town, shown while you plan the day.
/* global THREE */
import { lc } from './shared.js';

export function createRoutes(V) {
  const { S, game, fx, Wv } = V;
  // ---------- tonight's routes: chevrons flowing from each hive to the town ----------
  const chevGeo = new THREE.ConeGeometry(0.28, 0.7, 3); chevGeo.rotateX(Math.PI / 2); chevGeo.scale(1, 0.25, 1);
  const routeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  let routeMesh = null, routeSig = '', routes = [];
  const SPACING = 1.2, tmpC = new THREE.Color();
  V.tmpC = tmpC;   // scratch colour, shared with the placement ghost
  function rebuildRoutes() {
    routes = game.forecast().map(r => {
      const cum = [0]; for (let k = 1; k < r.path.length; k++) cum.push(cum[k - 1] + Math.hypot(r.path[k][0] - r.path[k - 1][0], r.path[k][1] - r.path[k - 1][1]));
      return { ...r, cum, len: cum[cum.length - 1] };
    });
    const count = routes.reduce((a, r) => a + Math.max(1, Math.floor(r.len / SPACING)), 0);
    if (routeMesh) { fx.remove(routeMesh); routeMesh.dispose(); }
    routeMesh = new THREE.InstancedMesh(chevGeo, routeMat, Math.max(1, count)); routeMesh.renderOrder = 5; routeMesh.frustumCulled = false; fx.add(routeMesh);
    let k = 0; for (const r of routes) { const n = Math.max(1, Math.floor(r.len / SPACING)); for (let q = 0; q < n; q++) routeMesh.setColorAt(k++, tmpC.copy(lc(r.siege ? '#e3a54a' : '#d5513d')).multiplyScalar(1.3)); }
    if (routeMesh.instanceColor) routeMesh.instanceColor.needsUpdate = true;
  }
  const rd = new THREE.Object3D();
  V.rd = rd;   // scratch Object3D, shared with the quarantine fences
  function animateRoutes(t) {
    if (!routeMesh) return;
    let k = 0;
    for (const r of routes) {
      const n = Math.max(1, Math.floor(r.len / SPACING)); let seg = 1;
      for (let q = 0; q < n; q++) {
        const at = (q * SPACING + (t * 1.6) % SPACING);
        while (seg < r.cum.length - 1 && r.cum[seg] < at) seg++;
        const a = r.path[seg - 1], b = r.path[Math.min(seg, r.path.length - 1)], L = (r.cum[seg] - r.cum[seg - 1]) || 1, f = Math.min(1, Math.max(0, (at - r.cum[seg - 1]) / L));
        rd.position.copy(Wv(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.06));
        rd.rotation.set(0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0); const fade = Math.min(1, (r.len - at) / 3, at / 2 + 0.3); rd.scale.setScalar(Math.max(0.2, fade));
        rd.updateMatrix(); routeMesh.setMatrixAt(k++, rd.matrix);
      }
    }
    routeMesh.instanceMatrix.needsUpdate = true;
  }
  /** once a frame: rebuild when the forecast changes; visible (and flowing) by day */
  function update() {
    // routes: visible while you plan the day
    const sig = `${S.flowVersion}|${S.night}|${S.purge}|${S.claimed.size}|${S.phase}`;
    if (sig !== routeSig) { routeSig = sig; rebuildRoutes(); }
    if (routeMesh) { routeMesh.visible = S.phase === 'day'; routeMat.opacity = 0.85; if (routeMesh.visible) animateRoutes(V.time); }
  }
  return { update, list: () => routes };
}
