// Stage: civic. The buildings round the plaza: each civic atom takes the middle of a block side that faces the plaza,
// on its own lot (so the rows of shopfronts step round it). The plaza gets its fountain and a ring of trees.
import { STREET } from '../units.js';
import { toWorld } from '../geom.js';

export const civicStage = {
  name: 'civic',
  run(W, seed, reg) {
    const rng = seed.rng(), G = W.grid, pz = W.plaza; if (!G || !pz) return;
    const civics = rng.shuffle(reg.needing('lot.civic').slice()), [bi, bj] = pz.block, front = G.P.w / 2 + G.P.walk + 1.2;
    // the four streets round the plaza; the civic building stands across each one, facing the plaza
    const faces = [{ id: `h:${bi},${bj}`, side: -1 }, { id: `h:${bi},${bj + 1}`, side: 1 }, { id: `v:${bi},${bj}`, side: 1 }, { id: `v:${bi + 1},${bj}`, side: -1 }];
    let k = 0;
    for (const f of faces) {
      const s = W.streets.find(q => q.id === f.id), def = civics[k]; if (!s || !def) continue;
      const [a, b] = s.pts, th = Math.atan2(b.y - a.y, b.x - a.x), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, side = f.side;   // the side across the street from the plaza (faces lists it per street)
      const nx = -Math.sin(th) * side, ny = Math.cos(th) * side, rot = side > 0 ? th : th + Math.PI, h = def.size[1] + 2;
      const lot = { id: `civic:${f.id}`, kind: 'civic', street: s.id, x: mid.x + nx * (front + h / 2), y: mid.y + ny * (front + h / 2), w: def.size[0] + 2, h, rot };
      const c = toWorld(lot, 0, -lot.h / 2 + def.size[1] / 2), p = W.place(reg, def.id, c.x, c.y, rot, { lot: lot.id });
      p.door = toWorld(p, 0, -p.h / 2 - 1.2); lot.building = p.uid; W.lots.push(lot); k++;
    }
    // the plaza: a fountain (off-centre if the camp is here) and trees round its edge
    const fountain = reg.withTag('fountain')[0], camp = W.camp && Math.hypot(W.camp.x - pz.x, W.camp.y - pz.y) < 5;
    if (fountain) { const fp = toWorld(pz, camp ? pz.w * 0.3 : 0, camp ? -pz.h * 0.3 : 0); W.place(reg, fountain.id, fp.x, fp.y, 0); }
    const tree = reg.withTag('lone')[0];
    if (tree) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = pz.w * 0.42, p = toWorld(pz, Math.cos(a) * r, Math.sin(a) * r); if (!camp || Math.hypot(p.x - W.camp.x, p.y - W.camp.y) > W.camp.r + 4) W.place(reg, tree.id, p.x, p.y, 0, { r: rng.range(2.6, 3.4), k: rng.float() }); }
    W.note('civic', `${k} civic buildings round the plaza`);
  },
};
