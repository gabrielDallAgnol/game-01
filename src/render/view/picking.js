// Picking: screen → ground cell → what is there (site, landmark, keep, building, rubble, district, ground), and
// world → screen for the UI's floating labels.
/* global THREE */
import { N, T, idx } from '../../sim/mapgen.js';

export function createPicking(V) {
  const { S, map, C, game, canvas, camera, W } = V;
  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(cx, cy) {
    const r = canvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x + C, y: hit.z + C };
  }
  function pick(cx, cy) {
    const sites = V.landmarks.sites;
    const p = groundAt(cx, cy); if (!p) return null;
    for (const m of sites) if (m.g.visible && Math.hypot(m.st.x - p.x, m.st.y - p.y) < 1.1) return { type: 'site', id: m.st.id, ...p };
    { const cx = Math.floor(p.x), cy = Math.floor(p.y); if (cx >= 0 && cy >= 0 && cx < N && cy < N && map.lm[idx(cx, cy)] >= 0) return { type: 'landmark', id: map.lm[idx(cx, cy)], ...p }; }
    const b = game.buildingAt(p.x, p.y);
    if (b && b.type === 'keep') return { type: 'keep', ...p };
    if (b) return { type: 'building', id: b.id, ...p };
    const cx2 = Math.floor(p.x), cy2 = Math.floor(p.y);
    if (cx2 >= 0 && cy2 >= 0 && cx2 < N && cy2 < N) { const i = idx(cx2, cy2), r = map.region[i], t = map.terrain[i]; if (r >= 0 && (t === T.FOREST || t === T.ROCK) && S.occ[i] < 0 && game.zone()[i] === 1) return { type: 'rubble', ...p }; if (r >= 0 && !S.claimed.has(r)) return { type: 'region', id: r, ...p }; }
    return { type: 'ground', ...p };
  }
  function project(x, y, h = 0.6) { const v = W(x, y, h).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 }; }
  return { groundAt, pick, project };
}
