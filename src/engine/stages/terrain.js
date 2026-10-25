// Stage: terrain. Decides the land's character for this seed: where the woods want to be,
// the open fields, and where the camp clearing sits. Everything later reads these masks.
import { makeNoise, lerp } from '../geom.js';

export const terrainStage = {
  name: 'terrain',
  run(W, seed) {
    const rng = seed.rng(), n = makeNoise(rng), m = makeNoise(rng);
    W.terrain = {
      woods: (x, y) => { const v = n(x / 70, y / 70) * 0.7 + n(x / 23 + 9, y / 23 + 9) * 0.3; const north = y < W.h * 0.16 ? 0.18 : 0, west = x < W.w * 0.22 && y < W.h * 0.62 ? 0.2 : 0; return v + north + west; },
      field: (x, y) => m(x / 60, y / 60),
    };
    W.campHint = { x: lerp(W.w * 0.09, W.w * 0.15, rng.float()), yAbove: lerp(26, 34, rng.float()) };
    W.note('terrain', 'woods and field masks ready');
  },
};
