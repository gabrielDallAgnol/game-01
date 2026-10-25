// Stage: mill streets. A high street runs beside the tracks from the camp at the west end;
// side streets climb north from it; one street crosses the line (a level crossing) to the
// mill road on the far side. Streets meet only at junctions, as in every layout.
import { STREET } from '../units.js';
import { segIntersect } from '../geom.js';
import { nameStreets } from '../names.js';

export const millStreetsStage = {
  name: 'streets',
  run(W, seed) {
    const rng = seed.rng(), F = W.frame, at = F.at, hv = -38, mv = 40, west = -W.w / 2;
    const street = (id, a, b, ends, extra) => { const s = { id, pts: [a, b], w: STREET.local, walk: STREET.kerb, kind: 'local', marks: 'dash', ends, ...extra }; W.streets.push(s); return s; };
    const node = (id, p, deg) => W.nodes.push({ id, ...p, deg });
    // the camp sits where the high street begins; or (params.camp = 'middle') in a clearing off its middle, up a lane
    const mid = W.params.camp === 'middle', cu0 = rng.range(-12, 12);
    W.camp = mid ? { ...at(cu0, hv - 36), r: 14 } : { ...at(west + 22, hv), r: 14 };
    street('high', at(mid ? west - 12 : west + 36, hv), at(W.w / 2 + 12, hv), [mid ? 'edge' : 'camp', 'edge'], { name: 'high street' });
    if (mid) { street('lane', at(cu0, hv), at(cu0, hv - 36 + 14), ['jl', 'camp'], { name: 'camp lane' }); node('jl', at(cu0, hv), 3); }
    // side streets north, spaced like a real mill town (50–64 m), ending in the open
    const side = [];
    for (let u = west + 70 + rng.range(0, 12); u < W.w / 2 - 30; u += rng.range(50, 64)) {
      if (mid && Math.abs(u - cu0) < 34) continue;   // the camp's clearing
      let L = rng.range(60, 105); while (L > 30 && at(u, hv - L).y < 10) L -= 5;
      if (L <= 30) continue;
      side.push(u); street(`side:${side.length}`, at(u, hv), at(u, hv - L), [`j:${side.length}`, 'end']); node(`j:${side.length}`, at(u, hv), 3);
    }
    // the crossing street and the mill road beyond the tracks
    const sid = W.rails.find(r => r.id === 'siding'), cu = side.length ? side[Math.min(side.length - 1, 1)] : west + 90;
    if (cu > sid.from - 20 && cu < sid.to + 10) W.note('streets', 'crossing street moved off the siding');
    const cuSafe = cu > sid.from - 20 && cu < sid.to + 10 ? sid.from - 26 : cu;
    const cross = street('cross', at(cuSafe, hv), at(cuSafe, mv), ['jc', 'jm'], { name: 'station road' });
    node('jc', at(cuSafe, hv), side.includes(cuSafe) ? 4 : 3); node('jm', at(cuSafe, mv), 2);
    street('mill', at(cuSafe, mv), at(W.w / 2 + 12, mv), ['jm', 'edge'], { name: 'mill road' });
    // level crossings: where any street meets a rail
    W.streets.forEach(s => W.rails.forEach(r => { for (let i = 0; i < r.pts.length - 1; i++) { const h = segIntersect(s.pts[0], s.pts[1], r.pts[i], r.pts[i + 1]); if (h) W.crossings.push({ x: h.x, y: h.y, rot: F.rot, len: s.w + 2 * s.walk, street: s.id, rail: r.id }); } }));
    nameStreets(W, seed.child('names').rng(), 'milltown');
    W.millRoad = { v: mv, from: cuSafe }; W.highStreet = { v: hv };
    W.note('streets', `${W.streets.length} streets, ${side.length} side streets, ${W.crossings.length} level crossings`);
  },
};
