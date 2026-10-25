// Stage: nest. The Inferno Nest takes the corner farthest from streets, rails and the camp;
// craters ring it and a scorch mask spreads from it, which later stages read (ruins near it,
// dead trees, bare ground at the centre).
import { distToPoly, dist, makeNoise } from '../geom.js';

export const nestStage = {
  name: 'nest',
  run(W, seed, reg) {
    const rng = seed.rng(), nest = reg.withTag('nest')[0]; if (!nest) return;
    const lines = [...W.streets.map(s => s.pts), ...W.rails.map(r => r.pts)];
    const score = p => Math.min(...lines.map(L => distToPoly(p.x, p.y, L)), W.camp ? dist(p, W.camp) - 40 : 1e9, ...W.lots.map(l => dist(p, l) - Math.hypot(l.w, l.h) / 2));
    const cand = [[W.w - 32, 32], [W.w - 32, W.h - 32], [W.w * 0.62, W.h - 30], [W.w * 0.3, W.h - 30], [W.w - 30, W.h * 0.3]].map(([x, y]) => ({ x: x + rng.range(-6, 6), y: y + rng.range(-6, 6) }));
    const best = cand.map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s)[0];
    const c = best.p, n = makeNoise(rng);
    W.place(reg, nest.id, c.x, c.y, 0, { k: rng.float() });
    const crater = reg.withTag('crater')[0];
    if (crater) for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rng.range(-0.3, 0.3), r = rng.range(13, 32), s = rng.range(0.7, 1.4), p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }; if (p.x > 3 && p.y > 3 && p.x < W.w - 3 && p.y < W.h - 3) W.place(reg, crater.id, p.x, p.y, rng.range(0, 3), { w: crater.size[0] * s, h: crater.size[1] * s }); }
    W.terrain.scorch = (x, y) => { const d = Math.hypot(x - c.x, y - c.y); return Math.max(0, 1 - d / 85) * 1.15 + (n(x / 24, y / 24) - 0.5) * 0.35; };
    W.nest = { x: c.x, y: c.y, r: nest.size[0] / 2, clear: best.s };
    W.note('nest', `nest at ${c.x.toFixed(0)}, ${c.y.toFixed(0)} (${best.s.toFixed(0)} m from the nearest street)`);
  },
};
