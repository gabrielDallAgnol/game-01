// Stage: districts. Turns the town plan's zones into named polygons the game can tint, name and use for spawns:
// W.districts = [{ id, name, kind, poly, at, area, palette }], tested in order by W.districtAt(x, y) (the old town
// first, the suburbs last). Polygons are clipped to the map. Palettes are role tints from palettes.js.
import { pointInPoly, polyArea, polyCentroid, clipPolyRect } from '../geom.js';
import { DISTRICT_LOOKS } from '../palettes.js';

export const districtsStage = {
  name: 'districts',
  run(W) {
    const T = W.town; if (!T) { W.note('districts', 'no town plan'); return; }
    const { ell, at, Z, kBelt, vs } = T, BIG = 2000, arc = (a0, a1, k, n = 24) => { const d = a1 - a0 >= 2 * Math.PI - 1e-9 ? 2 * Math.PI : ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return Array.from({ length: n + 1 }, (_, i) => ell(a0 + d * i / n, k)); };
    const circle = (c, r, n = 28) => Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos(i / n * 2 * Math.PI) * r, y: c.y + Math.sin(i / n * 2 * Math.PI) * r }));
    const fan = (a0, a1) => [at(0, 0), ...arc(a0, a1, 8, 16)];
    const D = [
      ['oldtown', 'the old town', 'oldtown', arc(0, 2 * Math.PI, kBelt, 64).slice(0, -1)],
      ['station', 'station quarter', 'rail', [at(-BIG, -BIG), at(BIG, -BIG), at(BIG, Z.industry.v[0]), at(-BIG, Z.industry.v[0])]],
      ['works', 'the sugar works', 'industry', [at(Z.industry.u, Z.industry.v[0]), at(BIG, Z.industry.v[0]), at(BIG, Z.industry.v[1]), at(Z.industry.u, Z.industry.v[1])]],
      ['masts', 'the transmitter field', 'field', circle(Z.masts, Z.masts.r)],
      ['park', 'the town park', 'park', [...arc(Z.park[0], Z.park[1], kBelt), ...arc(Z.park[0], Z.park[1], Z.park[2]).reverse()]],
      ['barns', 'the barn quarter', 'barns', [...arc(Z.barns[0], Z.barns[1], kBelt), ...arc(Z.barns[0], Z.barns[1], Z.barns[2]).reverse()]],
      ['south', 'south end', 'suburb', fan(Math.PI / 4, Math.PI * 3 / 4)],
      ['west', 'west end', 'suburb', fan(Math.PI * 3 / 4, Math.PI * 1.5)],
      ['east', 'east end', 'suburb', fan(-Math.PI / 2, Math.PI / 4)],
    ];
    W.districts = D.map(([id, name, kind, poly]) => { const p = clipPolyRect(poly, 0, 0, W.w, W.h); return { id, name, kind, poly: p, at: polyCentroid(p), area: Math.round(polyArea(p)), palette: DISTRICT_LOOKS[kind] }; }).filter(d => d.poly.length >= 3).map((d, i) => ({ ...d, i }));
    W.districtAt = (x, y) => W.districts.find(d => pointInPoly(x, y, d.poly)) || null;
    W.note('districts', W.districts.map(d => `${d.name} ${(d.area / 1e4).toFixed(1)} ha`).join(', ') + ` (station road at v ${vs.toFixed(0)})`);
  },
};
