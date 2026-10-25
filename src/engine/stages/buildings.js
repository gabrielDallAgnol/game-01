// Stage: buildings. Each lot asks the registry for atoms that need its kind
// (lot.residential, lot.commercial…), picks one that fits, and places it with its door
// socket facing the street and its drive reaching the kerb. Backyards get yard atoms.
import { LOT } from '../units.js';
import { toWorld, lerp } from '../geom.js';

const fits = (def, lot) => def.size[0] <= lot.w - 2 * LOT.sideGap && def.size[1] + (def.setback ? def.setback[0] : 4) + 2 <= lot.h;

export const buildingsStage = {
  name: 'buildings',
  run(W, seed, reg) {
    const once = new Set(), yardAtoms = reg.needing('yard'), yardExtras = yardAtoms.filter(d => d.kind !== 'tree'), yardTree = yardAtoms.find(d => d.kind === 'tree');
    W.lots.forEach(lot => {
      const ls = seed.child(lot.id), rng = ls.rng();
      if (lot.kind === 'park' || lot.building) return;   // a site stage may have built it already
      let pool = reg.needing(`lot.${lot.kind}`).filter(d => fits(d, lot) && !(d.tags.includes('poi') && once.has(d.id)));
      if (lot.kind === 'commercial') { const poi = pool.filter(d => d.tags.includes('poi') || d.tags.includes('canopy')); if (poi.length && rng.chance(0.6)) pool = poi; }
      if (!pool.length) { W.note('buildings', `${lot.id}: nothing fits ${lot.w.toFixed(1)}×${lot.h.toFixed(1)}`); return; }
      const def = rng.pick(pool); if (def.tags.includes('poi') || def.tags.includes('canopy')) once.add(def.id);
      const sb = def.setback ? lerp(def.setback[0], def.setback[1], rng.float()) : 5;
      const hasDrive = def.sockets.some(s => s.type === 'drive'), side = rng.chance(0.5) ? -1 : 1, DW = 3.2;
      const slack = (lot.w - def.size[0]) / 2 - LOT.sideGap;
      // houses leave room for a drive beside them (drive edge 0.3 m inside the lot line, 0.2 m from the wall)
      let lx = rng.range(-slack, slack) * 0.6;
      if (hasDrive && lot.kind === 'residential') lx = side * (lot.w / 2 - 0.3 - DW - 0.2 - def.size[0] / 2);
      const ly = -lot.h / 2 + sb + def.size[1] / 2;
      if (lot.kind === 'residential' && Math.abs(lx) + def.size[0] / 2 > lot.w / 2 - 0.3) { W.note('buildings', `${lot.id}: no room for a drive`); return; }
      const c = toWorld(lot, lx, ly);
      const b = W.place(reg, def.id, c.x, c.y, lot.rot, { lot: lot.id, seedPath: ls.path });
      lot.building = b.uid;
      // sockets resolved into the world: the door and the drive
      b.door = toWorld(lot, lx, ly - def.size[1] / 2 - 1.2);
      if (hasDrive) {
        const res = lot.kind === 'residential';
        const dx = res ? side * (lot.w / 2 - 0.3 - DW / 2) : lx + side * (def.size[0] / 2 - 1.8);
        const len = res ? sb + def.size[1] * 0.7 : sb;   // a residential drive runs beside the house, long enough for a car
        const mid = toWorld(lot, dx, -lot.h / 2 + len / 2);
        b.drive = { x: mid.x, y: mid.y, w: DW, h: len, rot: lot.rot };
        lot.drive = b.drive; lot.driveMouth = toWorld(lot, dx, -lot.h / 2);
      }
      if (lot.kind === 'commercial' && def.look !== 'canopy') { const pk = toWorld(lot, 0, -lot.h / 2 + (sb - 1) / 2); lot.parking = { x: pk.x, y: pk.y, w: lot.w - 2, h: sb - 2, rot: lot.rot }; }
      // backyard: one yard atom between the building's back and the lot's back
      if (lot.kind === 'residential') {
        const backY = ly + def.size[1] / 2, depth = lot.h / 2 - backY;
        const roll = rng.float(), yd = yardExtras[Math.floor(roll / 0.18)] || null;
        if (yd) { const yard = yd.id; if (yd.size[1] + 2 < depth) { const p = toWorld(lot, rng.range(-lot.w / 2 + yd.size[0], lot.w / 2 - yd.size[0]) * 0.8, backY + depth * 0.5); W.place(reg, yard, p.x, p.y, lot.rot, { lot: lot.id }); } }
        if (yardTree && rng.chance(0.72) && depth > 6) { const p = toWorld(lot, rng.range(-lot.w / 2 + 3, lot.w / 2 - 3), backY + depth * rng.range(0.55, 0.8)); W.place(reg, yardTree.id, p.x, p.y, 0, { lot: lot.id, r: rng.range(2.8, 3.8), k: rng.float() }); }
      }
    });
    W.note('buildings', `${W.placed.filter(p => p.def.kind === 'building').length} buildings`);
  },
};
