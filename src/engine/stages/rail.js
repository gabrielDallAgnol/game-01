// Stage: rail. A main line crosses the area edge to edge (a rail.end socket at each map edge);
// a siding leaves it at a switch and ends at a buffer. The line also sets the town frame
// (W.frame: u along the tracks, v across, +v south) that the mill town's other stages use.
import { RAIL } from '../units.js';
import { toWorld, catmull } from '../geom.js';

export const railStage = {
  name: 'rail',
  run(W, seed) {
    const rng = seed.rng(), F = { x: W.w / 2, y: W.h * rng.range(0.52, 0.58), rot: rng.range(-0.07, 0.07), w: 0, h: 0 };
    const at = (u, v) => toWorld(F, u, v), half = W.w / 2 + 14;
    const main = [at(-half, 0), at(half, 0)];
    W.rails.push({ id: 'main', name: 'ironvale line', pts: main, ends: [at(-W.w / 2, 0), at(W.w / 2, 0)], sockets: ['rail.end', 'rail.end'] });
    const su = W.w * rng.range(0.02, 0.1), len = rng.range(105, 125);
    const siding = catmull([at(su, 0), at(su + 18, 2.2), at(su + 36, 9), at(su + 48, 10), at(su + len, 10)], 4);
    W.rails.push({ id: 'siding', name: 'mill siding', pts: siding, ends: [at(su + len, 10)], sockets: ['rail.switch', 'rail.buffer'], from: su, to: su + len, v: 10 });
    W.frame = { ...F, at, gauge: RAIL.gauge };
    W.note('rail', `main line at ${F.y.toFixed(0)} m, siding ${len.toFixed(0)} m`);
  },
};
