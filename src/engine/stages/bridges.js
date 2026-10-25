// Stage: bridges. Wherever a street crosses water, a bridge atom joins the two banks
// (water.edge ↔ bridge.end), sized from the water's width and the street's width.
import { segIntersect } from '../geom.js';

export const bridgesStage = {
  name: 'bridges',
  run(W, seed, reg) {
    const bridge = reg.withTag('bridge')[0]; if (!bridge) { if (W.water.length) W.note('bridges', 'no bridge atom: streets stop at the water'); return; }
    W.streets.forEach(s => W.water.forEach(wt => {
      for (let i = 0; i < s.pts.length - 1; i++) for (let k = 0; k < wt.pts.length - 1; k++) {
        const hit = segIntersect(s.pts[i], s.pts[i + 1], wt.pts[k], wt.pts[k + 1]); if (!hit) continue;
        const rot = Math.atan2(s.pts[i + 1].y - s.pts[i].y, s.pts[i + 1].x - s.pts[i].x);
        const b = W.place(reg, bridge.id, hit.x, hit.y, rot, { w: wt.w + 8, h: s.w + 2, street: s.id });
        W.bridges.push(b);
      }
    }));
    W.note('bridges', `${W.bridges.length} bridges`);
  },
};
