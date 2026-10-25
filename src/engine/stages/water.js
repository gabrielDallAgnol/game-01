// Stage: water. Hollow Creek runs north to south near the east edge; its banks are the
// water.edge socket that bridges attach to.
import { lerp } from '../geom.js';

export const waterStage = {
  name: 'water',
  run(W, seed) {
    const rng = seed.rng(), x0 = lerp(W.w * 0.86, W.w * 0.92, rng.float()), a = rng.range(6, 12), f = rng.range(70, 110), ph = rng.range(0, 6);
    const fx = y => x0 + a * Math.sin(y / f + ph) + 3 * Math.sin(y / 23 + ph * 2);
    const pts = []; for (let y = -6; y <= W.h + 6; y += 3) pts.push({ x: fx(y), y });
    W.water.push({ id: 'creek', name: 'hollow creek', pts, w: 6, fx });
    W.note('water', `creek at x≈${x0.toFixed(0)} m`);
  },
};
