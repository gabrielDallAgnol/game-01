// Stage: mill. The industrial lot faces the mill road beside the siding: the mill on it, a
// water tower beside it, and box cars standing on the siding, coupled end to end.
import { STREET } from '../units.js';
import { toWorld } from '../geom.js';

export const millStage = {
  name: 'mill',
  run(W, seed, reg) {
    const rng = seed.rng(), F = W.frame, sid = W.rails.find(r => r.id === 'siding'), mv = W.millRoad.v;
    const mill = reg.needing('lot.industrial').find(a => a.tags.includes('must'));
    const u = sid.from + rng.range(50, 70), depth = mill.size[1] + 16, front = STREET.local / 2 + STREET.kerb + 1;
    const c = F.at(u, mv + front + depth / 2), lot = { id: 'ind:mill', kind: 'industrial', street: 'mill', x: c.x, y: c.y, w: mill.size[0] + 10, h: depth, rot: F.rot };
    W.lots.push(lot);
    const bc = toWorld(lot, 0, -lot.h / 2 + 12 + mill.size[1] / 2), b = W.place(reg, mill.id, bc.x, bc.y, F.rot, { lot: lot.id });
    lot.building = b.uid; b.door = toWorld(lot, 0, -lot.h / 2 - 1.2);
    const tower = reg.withTag('landmark')[0]; if (tower) { const t = toWorld(lot, lot.w / 2 - 4, lot.h / 2 - 4); W.place(reg, tower.id, t.x, t.y, 0, { lot: lot.id }); }
    // box cars on the straight part of the siding, coupled (rail.end to rail.end, 1 m couplers)
    const car = reg.withTag('railcar')[0], n = 2 + rng.int(4);
    if (car) for (let i = 0, cu = sid.from + 52; i < n && cu + car.size[0] < sid.to - 4; i++, cu += car.size[0] + 1) { const p = F.at(cu + car.size[0] / 2, sid.v); W.place(reg, car.id, p.x, p.y, F.rot, { tone: rng.int(3), rail: 'siding' }); }
    W.note('mill', `mill at u ${u.toFixed(0)}, ${n} box cars`);
  },
};
