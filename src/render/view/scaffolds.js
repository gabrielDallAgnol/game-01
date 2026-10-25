// [econ3] A scaffold on every blueprint in the construction queue (sim/construct.js: S.econ.q); the building itself
// rises with the work (view/buildings.js). Reads S.econ only.
import { scaffold } from '../kit/village.js';
import { FOOT } from './shared.js';

export function createScaffolds(V) {
  const { S, world, Wv } = V;
  const scafG = new Map();
  function update() {
    if (!S.econ) return;
    const live = new Set();
    for (const j of S.econ.q || []) {
      if (j.kind !== 'build') continue;
      const b = S.byId.get(j.bid); if (!b) continue;
      live.add(j.id);
      let g = scafG.get(j.id);
      if (!g) { g = scaffold(Math.min(3, FOOT[b.type] || 1)); world.add(g); scafG.set(j.id, g); g.position.copy(Wv(b.x, b.y)); }
      g.scale.y = 0.4 + 0.6 * Math.min(1, j.work * 1.5);
    }
    for (const [id, g] of scafG) if (!live.has(id)) { world.remove(g); scafG.delete(id); }
  }
  return { update };
}
