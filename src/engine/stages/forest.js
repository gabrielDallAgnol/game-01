// Stage: forest. Builds the occupancy of everything placed so far, then fills the woods
// mask with trees only where the ground is free, so trees never grow through a road,
// a lot, a fence or the camp.
import { STREET } from '../units.js';
import { createOcc, OCC } from '../occupancy.js';

export function occupancyOf(W) {
  const O = createOcc(W.w, W.h);
  W.streets.forEach(s => O.poly(s.pts, s.w / 2 + s.walk + 1.5, OCC.STREET));
  W.water.forEach(wt => O.poly(wt.pts, wt.w / 2 + 2, OCC.WATER));
  W.lots.forEach(l => { if (l.kind !== 'park') O.obb(l, OCC.LOT, 0.5); });
  W.placed.forEach(p => { if (p.def.kind === 'building' || p.def.kind === 'vehicle') O.obb(p, OCC.BUILDING, 1); else if (p.def.kind === 'tree') O.disc(p.x, p.y, (p.r || p.def.size[0] / 2) * 0.7, OCC.TREE); else if (p.def.kind === 'prop') O.disc(p.x, p.y, 1, OCC.PROP); });
  W.fences.forEach(f => O.seg(f.a, f.b, 0.6, OCC.PROP));
  if (W.camp) O.disc(W.camp.x, W.camp.y, W.camp.r + 4, OCC.CAMP);
  return O;
}

export const forestStage = {
  name: 'forest',
  run(W, seed, reg) {
    const rng = seed.rng(), O = occupancyOf(W), step = 5.2;
    let n = 0;
    for (let y = 2; y < W.h - 2; y += step) for (let x = 2; x < W.w - 2; x += step) {
      const px = x + rng.range(-1.8, 1.8), py = y + rng.range(-1.8, 1.8), v = W.terrain.woods(px, py);
      if (v < 0.62 || rng.chance(0.16)) continue;
      const id = rng.chance(0.55) ? 'tree.forest.a' : 'tree.forest.b', r = reg.get(id).size[0] / 2 * rng.range(0.8, 1.05);
      if (!O.free(px, py, r * 0.55)) continue;
      W.place(reg, id, px, py, 0, { r, k: rng.float() }); O.disc(px, py, r * 0.6, OCC.TREE); n++;
    }
    // a few lone trees in the open fields
    for (let i = 0; i < 40; i++) { const px = rng.range(4, W.w - 4), py = rng.range(4, W.h - 4); if (W.terrain.woods(px, py) > 0.55) continue; const r = rng.range(2.6, 3.8); if (!O.free(px, py, r + 0.5)) continue; W.place(reg, 'tree.yard.a', px, py, 0, { r, k: rng.float() }); O.disc(px, py, r, OCC.TREE); n++; }
    W.occ = O;
    W.note('forest', `${n} trees in the woods and fields (min clearance ${STREET.kerb} m from streets)`);
  },
};
