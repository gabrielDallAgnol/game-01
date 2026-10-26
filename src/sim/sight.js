// [ch1] What Kai can see in Hollowmere: the old town she lives in starts known (its ring street and a margin past it),
// the Rig's clearing is wide, and she opens the shroud farther round her than the base game's 8 m. Nothing outside
// Hollowmere; no randomness (it only writes S.seen through reveal).
import { N, idx } from './mapgen.js';
import { pointInPoly } from '../engine/geom.js';
import { SIGHT } from '../content/ch1tune.js';

export function createSight(G) {
  const { S, map, c } = G;
  const on = !!(map.area && map.area.id === 'hollowmere') && G.chapter !== false;
  if (!on) return { sightStart: () => {}, stepSight: () => {} };
  /** the old town's cells, padded past the ring street, all marked seen */
  function revealOldTown() {
    const A = map.area, W = A.W, d = W.districts && W.districts.find(q => q.kind === 'oldtown'); if (!d) return;
    const P = d.poly, pad = SIGHT.ringPad, cx = d.at.x, cy = d.at.y;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const gx0 = Math.max(0, Math.floor(x0 - pad + A.ox)), gx1 = Math.min(N - 1, Math.ceil(x1 + pad + A.ox)), gy0 = Math.max(0, Math.floor(y0 - pad + A.oy)), gy1 = Math.min(N - 1, Math.ceil(y1 + pad + A.oy));
    for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
      const wx = x + 0.5 - A.ox, wy = y + 0.5 - A.oy, l = Math.hypot(cx - wx, cy - wy) || 1, k = Math.min(pad, l) / l;   // step toward the middle by the pad: a grown polygon
      if (pointInPoly(wx + (cx - wx) * k, wy + (cy - wy) * k, P)) S.seen[idx(x, y)] = 1;
    }
    S.seenVersion++;
  }
  function sightStart() { if (S.restored) return; revealOldTown(); G.reveal(c, c, SIGHT.rig); }
  function stepSight(dt) { const ch = S.ch; if (!ch || (ch.sightT = (ch.sightT || 0) - dt) > 0) return; ch.sightT = 0.25; if (!S.hero.dead) G.reveal(S.hero.x, S.hero.y, SIGHT.hero); G.reveal(G.keep.x, G.keep.y, SIGHT.rig); }
  return { sightStart, stepSight };
}
