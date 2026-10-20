// Hollowmere city kit · Gameplay overlays drawn in the world: zone cells, chevrons, ghosts, beams, rings.
/* global THREE */
import { lin } from './palette.js';
import { glowDecal } from './helpers.js';

// ---------- gameplay overlays (drawn in the world, like the game) ----------
function zoneCells(cells, color = '#5fd06a', op = 0.35) {
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshBasicMaterial({ color: lin(color), transparent: true, opacity: op, depthWrite: false }), cells.length);
  const o = new THREE.Object3D(); cells.forEach(([x, z], i) => { o.position.set(x, 0.2, z); o.rotation.set(-Math.PI / 2, 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.renderOrder = 4; return m;
}
function chevrons(points, color = '#d5513d', op = 0.9) {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-0.55, -0.35); s.lineTo(0, 0.1); s.lineTo(0.55, -0.35); s.lineTo(0.55, -0.05); s.lineTo(0, 0.4); s.lineTo(-0.55, -0.05); s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const mat = new THREE.MeshBasicMaterial({ color: lin(color).multiplyScalar(1.4), transparent: true, opacity: op, depthWrite: false });
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 1.6), ang = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, m = new THREE.Mesh(geo, mat); m.position.set(x0 + (x1 - x0) * t, 0.06, z0 + (z1 - z0) * t); m.rotation.set(-Math.PI / 2, 0, ang + Math.PI); m.renderOrder = 4; m.scale.setScalar(0.9); g.add(m); }
  }
  return g;
}
function ghost(obj, color = '#ffe9b8', op = 0.45) {
  obj.traverse(m => { if (m.isMesh) { m.material = new THREE.MeshStandardMaterial({ color: lin(color), transparent: true, opacity: op, roughness: 0.6, emissive: lin(color), emissiveIntensity: 0.15, depthWrite: false }); m.castShadow = false; } });
  return obj;
}
/** a visible light beam from `from` to `to` (world points) and the pool it lights */
function beam(from, to, radius, color = '#fff1d6', op = 0.07) {
  const g = new THREE.Group();
  const a = new THREE.Vector3(...from), b2 = new THREE.Vector3(...to), len = a.distanceTo(b2);
  // gradient along the cone: bright at the lamp, fading at the far end
  const geo = new THREE.CylinderGeometry(0.25, radius, len, 24, 8, true);
  const cols = []; const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const t = (pa.getY(i) + len / 2) / len; const v = 0.15 + 0.85 * Math.pow(t, 1.6); cols.push(v, v, v); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: lin(color).multiplyScalar(op * 10), vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(a).add(b2).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), b2.clone().sub(a).normalize());
  g.add(m);
  const pool = glowDecal(color, radius * 1.3, 0.22); pool.position.set(to[0], 0.08, to[2]); pool.scale.set(1, 1.5, 1); g.add(pool);
  return g;
}
function ring(r, color = '#ffffff', op = 0.8, width = 0.12) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - width, r, 48), new THREE.MeshBasicMaterial({ color: lin(color).multiplyScalar(1.3), transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 5; return m;
}

export { zoneCells, chevrons, ghost, beam, ring };
