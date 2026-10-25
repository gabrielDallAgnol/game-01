// Stage: suburbs. Cuts house lots along every street the plan marked `lots` (the country roads and the grid), on
// both sides, wherever all four corners stand on suburb land; the buildings stage then puts a house, a drive and a
// yard on each. Each street side reads its own seed branch, so a new street never moves another street's lots.
import { toWorld } from '../geom.js';
import { createClearance, cutLots } from '../frontage.js';
import { LOT } from '../units.js';

export const suburbsStage = {
  name: 'suburbs',
  run(W, seed) {
    const T = W.town; if (!T) return;
    const C = createClearance(W), ok = lot => [lot, ...[0, 1, 2, 3].map(k => toWorld(lot, (k & 1 ? 1 : -1) * lot.w / 2, (k & 2 ? 1 : -1) * lot.h / 2))].every(q => T.zoneAt(q.x, q.y) === 'suburb');
    let n = 0;
    W.streets.filter(s => s.lots).forEach(s => [1, -1].forEach(sd => { n += cutLots(W, C, s, sd, { kind: 'residential', width: [LOT.width - 1, LOT.width + 1.5], depth: LOT.depth, rng: seed.child(`${s.id}:${sd}`).rng(), allow: ok }).length; }));
    W.note('suburbs', `${n} house lots`);
  },
};
