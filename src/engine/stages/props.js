// Stage: props. Fences run on lot edges (sides and back, never the front; shared edges
// once), street trees stand on the kerb but never in front of a drive or a junction,
// lamps line the streets, cars sit in drives and along kerbs.
import { STREET, GAP } from '../units.js';
import { toWorld, dist } from '../geom.js';

export const propsStage = {
  name: 'props',
  run(W, seed, reg) {
    const rng = seed.rng(), seen = new Set();
    const key = (a, b) => { const r = p => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`; const k1 = r(a), k2 = r(b); return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`; };
    const P = { streetTrees: 0.7, kerbCars: 0.35, ...(W.params.props || {}) }, fenceDef = reg.withTag('fence')[0], treeIds = reg.withTag('street-tree').map(a => a.id), lampIds = reg.withTag('lamp').map(a => a.id), carIds = reg.withTag('car').map(a => a.id);
    const fence = (a, b, lot) => { const k = key(a, b); if (seen.has(k) || !fenceDef) return; seen.add(k); W.fences.push({ a, b, atom: fenceDef.id, def: fenceDef, lot }); };
    W.lots.filter(l => l.kind === 'residential' && l.building).forEach(l => {
      const b = W.placed.find(p => p.uid === l.building), sb = (b.def.setback || [4])[0];
      const fy = -l.h / 2 + sb * 0.7;
      fence(toWorld(l, -l.w / 2, l.h / 2), toWorld(l, l.w / 2, l.h / 2), l.id);
      fence(toWorld(l, -l.w / 2, fy), toWorld(l, -l.w / 2, l.h / 2), l.id);
      fence(toWorld(l, l.w / 2, fy), toWorld(l, l.w / 2, l.h / 2), l.id);
    });
    const mouths = W.lots.filter(l => l.driveMouth).map(l => l.driveMouth);
    // street trees and lamps along local streets
    W.streets.filter(s => s.kind === 'local').forEach(s => {
      const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]], L = dist(a, b), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy, ny = ux;
      for (const side of [-1, 1]) {
        let d = rng.range(6, 10); const off = s.w / 2 + s.walk * 0.62;
        while (d < L - 6) {
          const x = a.x + ux * d + nx * off * side, y = a.y + uy * d + ny * off * side;
          const nearMouth = mouths.some(m => Math.hypot(m.x - x, m.y - y) < 4.5), nearJunction = W.nodes.some(n => Math.hypot(n.x - x, n.y - y) < 9);
          if (!nearMouth && !nearJunction && treeIds.length && rng.chance(P.streetTrees)) W.place(reg, rng.pick(treeIds), x, y, 0, { street: s.id, r: rng.range(2.8, 3.5), k: rng.float() });
          d += rng.range(GAP.streetTreeEvery[0], GAP.streetTreeEvery[1]);
        }
      }
      for (let d = 8, k = 0; d < L - 4; d += GAP.lampEvery, k++) { const side = k % 2 ? 1 : -1, off = s.w / 2 + 0.4; const x = a.x + ux * d + nx * off * side, y = a.y + uy * d + ny * off * side; if (lampIds.length && !mouths.some(m => Math.hypot(m.x - x, m.y - y) < 3) && !(W.doorAt && W.doorAt(x, y, 1.6))) W.place(reg, lampIds[0], x, y, 0, { street: s.id }); }
    });
    // cars: in some drives, and a few on the kerb
    if (carIds.length) W.lots.filter(l => l.drive && l.kind === 'residential').forEach(l => { if (rng.chance(0.4)) { const d = l.drive; const p = toWorld(d, 0, d.h / 2 - 2.6); W.place(reg, rng.pick(carIds), p.x, p.y, d.rot + Math.PI / 2, { tone: rng.int(4) }); } });
    W.streets.filter(s => s.kind === 'local').forEach(s => { const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]], L = dist(a, b); if (L < 30 || !carIds.length || !rng.chance(P.kerbCars)) return; const d = rng.range(12, L - 12), side = rng.chance(0.5) ? 1 : -1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, off = s.w / 2 - 1.2; const x = a.x + ux * d - uy * off * side, y = a.y + uy * d + ux * off * side; if (!mouths.some(m => Math.hypot(m.x - x, m.y - y) < 4)) W.place(reg, rng.pick(carIds), x, y, Math.atan2(uy, ux), { tone: rng.int(4), parked: s.id }); });
    W.note('props', `${W.fences.length} fence runs, ${W.byTag('street').length} street trees, ${W.byTag('lamp').length} lamps, ${W.byTag('car').length} cars`);
  },
};
