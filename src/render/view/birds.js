// Birds: pure ambience. Now and then, as the hero walks the woods by day, a few birds burst out of the trees ahead
// and flap away; a kill out in the woods (a shot, a felled deer) flushes a flock too. Render only: no game state.
/* global THREE */
import { T, idx, inside } from '../../sim/mapgen.js';
import { MOBS } from '../../content/mobs.js';

const CAP = 40;
export function createBirds(V) {
  const { S, map, world, Wv } = V;
  // one bird: two thin wings in a shallow V; scaling y flips the tips up and down (the flap)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.1, -0.34, 0.12, -0.04, 0, 0, -0.1, 0, 0, 0.1, 0, 0, -0.1, 0.34, 0.12, -0.04], 3));
  g.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x1c1d22, side: THREE.DoubleSide }), CAP);
  mesh.count = 0; mesh.frustumCulled = false; world.add(mesh);
  const birds = [], d0 = new THREE.Object3D();
  let walkT = 8 + Math.random() * 10;
  const woodsAt = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return inside(cx, cy) && map.terrain[idx(cx, cy)] === T.FOREST; };
  function flush(x, y, n) {
    if (V.dark > 0.6) return;   // roosting at night
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < n && birds.length < CAP; k++) {
      const a = a0 + (Math.random() - 0.5) * 1.2, sp = 3 + Math.random() * 2;
      const p = Wv(x + (Math.random() - 0.5) * 1.5, y + (Math.random() - 0.5) * 1.5, 1.6 + Math.random() * 0.8);
      birds.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2.4 + Math.random() * 1.2, ph: Math.random() * 6, life: 0, max: 4 + Math.random() * 2 });
    }
  }
  /** once a frame: maybe flush a flock near the walking hero, react to kills in the woods, fly the flocks */
  function update(dt, events) {
    const h = S.hero;
    if (!h.dead && h.moving && S.phase === 'day' && woodsAt(h.x, h.y) && (walkT -= dt) <= 0) {
      walkT = 14 + Math.random() * 20;
      const ax = h.x + Math.sin(h.face || 0) * 3, ay = h.y + Math.cos(h.face || 0) * 3;
      if (woodsAt(ax, ay)) flush(ax, ay, 4 + Math.floor(Math.random() * 4));
    }
    for (const e of events || []) if (e.t === 'die' && MOBS[e.kind] && MOBS[e.kind].animal && woodsAt(e.x, e.y) && Math.hypot(e.x - h.x, e.y - h.y) < 22) flush(e.x, e.y, 3 + Math.floor(Math.random() * 3));
    let n = 0;
    for (let k = birds.length - 1; k >= 0; k--) {
      const b = birds[k]; b.life += dt; if (b.life > b.max) { birds.splice(k, 1); continue; }
      b.vy = Math.max(0.3, b.vy - dt * 0.8); b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.ph += dt * 16;
      const s = Math.min(1, b.life * 4) * Math.min(1, (b.max - b.life) * 1.5);
      d0.position.set(b.x, b.y, b.z); d0.rotation.set(0, Math.atan2(b.vx, b.vz), 0); d0.scale.set(s, s * Math.sin(b.ph) * 1.4, s);
      d0.updateMatrix(); mesh.setMatrixAt(n++, d0.matrix);
    }
    mesh.count = n; if (n) mesh.instanceMatrix.needsUpdate = true;
  }
  return { update, flush };
}
