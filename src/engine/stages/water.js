// Stage: water. Hollow Creek runs north to south near the east edge; its banks are the
// water.edge socket that bridges attach to. A recipe moves and widens it with params.water { x: [a, b], w, name }.
import { lerp } from '../geom.js';

export const waterStage = {
  name: 'water',
  run(W, seed) {
    const P = { x: [0.86, 0.92], w: 6, name: 'hollow creek', wiggle: 1, ...(W.params.water || {}) };
    const rng = seed.rng(), x0 = lerp(W.w * P.x[0], W.w * P.x[1], rng.float()), a = rng.range(6, 12), f = rng.range(70, 110), ph = rng.range(0, 6);
    const fx = y => x0 + P.wiggle * (a * Math.sin(y / f + ph) + 3 * Math.sin(y / 23 + ph * 2));
    const pts = []; for (let y = -6; y <= W.h + 6; y += 3) pts.push({ x: fx(y), y });
    W.water.push({ id: 'creek', name: P.name, pts, w: P.w, fx });
    W.note('water', `creek at x≈${x0.toFixed(0)} m`);
  },
};
