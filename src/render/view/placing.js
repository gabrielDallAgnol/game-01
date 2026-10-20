// Placement: the ghost of what you are about to build (cells tinted ok / blocked, the model itself) and the
// build zone overlay.
/* global THREE */
import { N } from '../../sim/mapgen.js';
import { K } from '../kit.js';
import { lc } from './shared.js';

export function createPlacing(V) {
  const { fx, Wv } = V, { model, faceKeep } = V.buildings;
  // ---------- placement ghost and build zone ----------
  const ghostCells = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }), 64); ghostCells.frustumCulled = false;
  ghostCells.renderOrder = 6; ghostCells.visible = false; fx.add(ghostCells);
  let ghostMesh = null, ghostKey = '';
  const ZONE_MAX = 2500;
  const zoneMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: lc('#5fd06a'), transparent: true, opacity: 0.38, depthWrite: false }), ZONE_MAX);
  zoneMesh.renderOrder = 5; zoneMesh.frustumCulled = false; zoneMesh.visible = false; fx.add(zoneMesh); let zoneRef = null;
  function setZone(z) {
    if (z === zoneRef) return; zoneRef = z;
    if (!z) { zoneMesh.visible = false; return; }
    const d = new THREE.Object3D(); let k = 0;
    for (let i = 0; i < N * N && k < ZONE_MAX; i++) if (z[i]) { d.position.copy(Wv((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.05)); d.scale.set(0.9, 1, 0.9); d.updateMatrix(); zoneMesh.setMatrixAt(k++, d.matrix); }
    zoneMesh.count = k; zoneMesh.instanceMatrix.needsUpdate = true; zoneMesh.visible = true;
  }
  function setGhost(gh) {
    const tmpC = V.tmpC;
    if (!gh) { ghostCells.visible = false; if (ghostMesh) ghostMesh.visible = false; return; }
    const d = new THREE.Object3D();
    const all = gh.cells.concat(gh.lot || []);
    all.slice(0, 64).forEach((i, k) => {
      const path = k >= gh.cells.length, ok = path ? gh.ok : gh.okCells ? gh.okCells[k] : gh.ok;
      d.position.copy(Wv((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.08)); d.scale.setScalar(path ? 0.82 : 1); d.updateMatrix(); ghostCells.setMatrixAt(k, d.matrix);
      ghostCells.setColorAt(k, tmpC.copy(lc(ok === 'skip' ? '#b8b0a0' : path ? (ok ? '#8fa0b0' : '#7a3a30') : ok ? '#fff1b8' : '#e0604a')));
    });
    ghostCells.count = Math.min(64, all.length); ghostCells.instanceMatrix.needsUpdate = true; if (ghostCells.instanceColor) ghostCells.instanceColor.needsUpdate = true; ghostCells.visible = true;
    if (gh.type === 'wall') { if (ghostMesh) ghostMesh.visible = false; return; }
    if (gh.type !== ghostKey) {
      if (ghostMesh) fx.remove(ghostMesh);
      ghostMesh = new THREE.Group(); ghostMesh.add(K.ghost(model(gh.type, 1, null), '#fff0d2', 0.6)); fx.add(ghostMesh); ghostKey = gh.type;
    }
    ghostMesh.visible = true; ghostMesh.position.copy(Wv(gh.x, gh.y)); ghostMesh.rotation.y = gh.type === 'house' || gh.type === 'farm' ? faceKeep(gh.x, gh.y) : 0;
  }
  return { setZone, setGhost };
}
