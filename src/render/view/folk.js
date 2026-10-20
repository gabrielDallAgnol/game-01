// Townsfolk and crews: the villager logic (drawn by the crowd as six baked looks), and the scavenger crews who
// walk out to their site at nightfall and home at dawn along a grid path.
/* global THREE */
import { N, idx, PASSABLE } from '../../sim/mapgen.js';
import { createVillagers } from '../villagers.js';
import { bakedWalker } from '../figures.js';
import { K } from '../kit.js';

export function createFolk(V) {
  const { S, map, C, game, world, W, Wv, crowd } = V;
  const villagerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  // townsfolk are drawn by the crowd (six baked looks, instanced); the villager logic only moves these stand-ins
  let folkN = 0;
  const villagers = createVillagers({ THREE, world, game, W, map, figure: () => { const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.folk = folkN++ % 6; const frames = [new THREE.Object3D(), new THREE.Object3D()]; frames[1].visible = false; return { g, body, frames }; } });
  crowd.warm(['folk0', 'folk1', 'folk2', 'folk3', 'folk4', 'folk5']);
  // ---------- scavengers: crews walk out to their site at nightfall and home at dawn ----------
  const crewWalkers = [];
  const scavRig = () => { const seed = Math.floor(Math.random() * 1e6); return bakedWalker(() => K.folk(seed, { crew: true }), villagerMat); };
  function gridPath(ax, ay, bx, by) {
    const ok = i => PASSABLE[map.terrain[i]];
    const s0 = idx(Math.floor(ax), Math.floor(ay)), g0 = idx(Math.floor(bx), Math.floor(by));
    const prev = new Int32Array(N * N).fill(-1), q = [s0]; prev[s0] = s0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (i === g0) break; const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const j = idx(xx, yy); if (prev[j] < 0 && (ok(j) || j === g0)) { prev[j] = i; q.push(j); } }
    }
    if (prev[g0] < 0) return [[ax, ay], [bx, by]];
    const out = []; for (let i = g0; i !== s0; i = prev[i]) out.push([(i % N) + 0.5, ((i / N) | 0) + 0.5]); out.push([ax, ay]); out.reverse(); out[out.length - 1] = [bx, by];
    return out;
  }
  function sendWalkers(site, n, home) {
    const st = S.scav.sites[site]; if (!st) return;
    const a = [C + 0.5, C + 3.5], b = [st.x, st.y], path = home ? gridPath(b[0], b[1], a[0], a[1]) : gridPath(a[0], a[1], b[0], b[1]);
    for (let k = 0; k < Math.min(n, 4); k++) {
      const w = scavRig(); world.add(w.g);
      crewWalkers.push({ ...w, path, seg: 1, d: -k * 0.7, phase: k, ox: (k % 2 ? 0.25 : -0.25), oy: k > 1 ? 0.3 : 0 });
    }
  }
  function stepWalkers(dt) {
    for (let k = crewWalkers.length - 1; k >= 0; k--) {
      const w = crewWalkers[k]; w.d += dt * 2.2; w.phase += dt;
      if (w.d < 0) { w.g.visible = false; continue; }
      w.g.visible = true;
      let rem = dt * 2.2;
      while (rem > 0 && w.seg < w.path.length) {
        const [ax, ay] = w.pos || w.path[0], [bx, by] = w.path[w.seg], L = Math.hypot(bx - ax, by - ay);
        if (L <= rem) { w.pos = [bx, by]; w.seg++; rem -= L; } else { w.pos = [ax + (bx - ax) / L * rem, ay + (by - ay) / L * rem]; rem = 0; w.face = Math.atan2(bx - ax, by - ay); }
      }
      if (!w.pos) w.pos = w.path[0];
      if (w.seg >= w.path.length) { world.remove(w.g); crewWalkers.splice(k, 1); continue; }
      w.g.position.copy(Wv(w.pos[0] + w.ox, w.pos[1] + w.oy)); w.g.rotation.y = w.face || 0;
      const f = Math.floor(w.phase * 6) % 2; w.frames[0].visible = !f; w.frames[1].visible = !!f;
    }
  }
  return { villagers, sendWalkers, stepWalkers };
}
