// Stage: avenues. Trees that belong to the plan, not to the woods: an avenue on both sides of every footpath (the
// wall promenade, the park path) and a tree in each corner of the square. Trees are picked by tag ('street-tree',
// 'lone') and never stand on a lot, a building, a street or the camp.
import { createClearance } from '../frontage.js';
import { dist } from '../geom.js';

export const avenuesStage = {
  name: 'avenues',
  run(W, seed, reg) {
    const rng = seed.rng(), tree = reg.withTag('street-tree')[0], lone = reg.withTag('lone')[0]; if (!tree) return;
    const C = createClearance(W, 3), free = (x, y, sid) => !C.blocked({ x, y, w: 2.4, h: 2.4, rot: 0 }, sid) && !W.nodes.some(n => Math.hypot(n.x - x, n.y - y) < 7);
    let n = 0;
    W.streets.filter(s => s.kind === 'path').forEach(s => { const [a, b] = s.pts, L = dist(a, b), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
      for (const sd of [1, -1]) for (let d = rng.range(3, 7); d < L - 3; d += rng.range(8, 11)) { const x = a.x + ux * d - uy * sd * 3.4, y = a.y + uy * d + ux * sd * 3.4; if (free(x, y, s.id)) { W.place(reg, tree.id, x, y, 0, { street: s.id, r: rng.range(3, 3.8), k: rng.float() }); C.take({ x, y, w: 3, h: 3, rot: 0 }); n++; } } });
    const pz = W.plaza; if (pz && lone) [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j]) => { const c = Math.cos(pz.rot), s = Math.sin(pz.rot), lx = i * (pz.w / 2 - 4), ly = j * (pz.h / 2 - 4), x = pz.x + lx * c - ly * s, y = pz.y + lx * s + ly * c;
      if (!W.camp || Math.hypot(x - W.camp.x, y - W.camp.y) > W.camp.r + 4) if (!W.placed.some(p => p.def.kind === 'building' && Math.hypot(p.x - x, p.y - y) < Math.hypot(p.w, p.h) / 2 + 2)) { W.place(reg, lone.id, x, y, 0, { r: rng.range(3.2, 4), k: rng.float() }); n++; } });
    W.note('avenues', `${n} avenue and square trees`);
  },
};
