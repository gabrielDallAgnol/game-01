// Stage: courtyards. An old town's blocks are full: behind the rows stand sheds, workshops and back houses. This
// stage walks the old town on a 6 m lattice and puts an outbuilding (atoms that need 'yard.old') wherever it clears
// every street, lot and building, turned to the nearest street so each block reads as one grain.
import { createClearance } from '../frontage.js';
import { distToSeg } from '../geom.js';

export const courtyardsStage = {
  name: 'courtyards',
  run(W, seed, reg) {
    const T = W.town, defs = reg.needing('yard.old'); if (!T || !defs.length) return;
    const rng = seed.rng(), C = createClearance(W, 4), old = W.streets.filter(s => T.e((s.pts[0].x + s.pts[1].x) / 2, (s.pts[0].y + s.pts[1].y) / 2) < T.kBelt);
    const P = { step: 5, chance: 0.85, ...(W.params.courtyards || {}) }; let n = 0;
    for (let y = 4; y < W.h - 4; y += P.step) for (let x = 4; x < W.w - 4; x += P.step) {
      const px = x + rng.range(-1.5, 1.5), py = y + rng.range(-1.5, 1.5); if (T.e(px, py) > 0.97 || !rng.chance(P.chance)) continue;
      let best = null, bd = 1e9; for (const s of old) { const d = distToSeg(px, py, s.pts[0], s.pts[1]); if (d < bd) { bd = d; best = s; } }
      if (!best || bd < 8) continue;
      const def = rng.pick(defs), th = Math.atan2(best.pts[1].y - best.pts[0].y, best.pts[1].x - best.pts[0].x), box = { x: px, y: py, w: def.size[0] + 1.6, h: def.size[1] + 1.6, rot: th };
      if (C.blocked(box, null)) continue;
      W.place(reg, def.id, px, py, th, { k: rng.float(), seedPath: `yard:${Math.round(px)},${Math.round(py)}` }); C.take(box); n++;
    }
    W.note('courtyards', `${n} outbuildings in the old town's blocks`);
  },
};
