// [area] The engine's town as the game map round the camp. An area recipe (src/engine/recipes.js) is built from the
// map seed, placed so its camp sits on the game's camp (N/2, N/2), at 1 cell = 1 m, and rasterised into the grid:
// streets and drives are road, buildings, cars and walls are rock, the woods' canopies are forest, the creek is
// water, rails are dirt. Outside the area's rectangle, and inside the far city, the frontier stays as generated. Deterministic and DOM-free;
// the built world rides along on map.area for the renderer (it is never saved: the seed rebuilds it).
import { buildArea, RECIPES } from '../engine/recipes.js';
import { obbBox, pointInObb, distToSeg } from '../engine/geom.js';

export const AREAS = Object.keys(RECIPES);
// what an atom offers → the game's site it becomes (claim it to get the site's dawn income and effect)
export const OFFER_SITE = { medicine: 'clinic', fuel: 'fuel', iron: 'quarry', work: 'substation', shop: 'market' };
const siteOf = def => { for (const o of Object.keys(OFFER_SITE)) if (def.offers.includes(o)) return OFFER_SITE[o]; return null; };   // the table's order is the priority

export function applyArea(g, id) {
  const { N, T, idx, inside, terrain, wild, road, c, seed, keep } = g;
  const res = buildArea(id, seed >>> 0, undefined, RECIPES[id].game), W = res.W;
  const ox = Math.round(c - W.camp.x), oy = Math.round(c - W.camp.y);   // whole metres, so engine and cells line up
  const mask = new Uint8Array(N * N), x0 = Math.max(0, ox), y0 = Math.max(0, oy), x1 = Math.min(N, ox + Math.ceil(W.w)), y1 = Math.min(N, oy + Math.ceil(W.h));
  const set = (x, y, t, r) => { if (!inside(x, y) || !mask[idx(x, y)]) return; const i = idx(x, y); terrain[i] = t; road[i] = r ? 1 : 0; };
  // shapes in engine metres → the cells whose centres they cover
  const fillObb = (o, t, r, pad = 0) => { const b = obbBox(o, pad); for (let y = Math.floor(b[1] + oy); y <= Math.ceil(b[3] + oy); y++) for (let x = Math.floor(b[0] + ox); x <= Math.ceil(b[2] + ox); x++) if (pointInObb(o, x + 0.5 - ox, y + 0.5 - oy, pad)) set(x, y, t, r); };
  const fillSeg = (a, b, half, t, r) => { const xa = Math.min(a.x, b.x) - half + ox, xb = Math.max(a.x, b.x) + half + ox, ya = Math.min(a.y, b.y) - half + oy, yb = Math.max(a.y, b.y) + half + oy;
    for (let y = Math.floor(ya); y <= Math.ceil(yb); y++) for (let x = Math.floor(xa); x <= Math.ceil(xb); x++) if (distToSeg(x + 0.5 - ox, y + 0.5 - oy, a, b) <= half) set(x, y, t, r); };
  const fillPoly = (pts, half, t, r) => { for (let k = 0; k < pts.length - 1; k++) fillSeg(pts[k], pts[k + 1], half, t, r); };
  const fillDisc = (p, rad, t, r) => { for (let y = Math.floor(p.y - rad + oy); y <= Math.ceil(p.y + rad + oy); y++) for (let x = Math.floor(p.x - rad + ox); x <= Math.ceil(p.x + rad + ox); x++) if (Math.hypot(x + 0.5 - ox - p.x, y + 0.5 - oy - p.y) <= rad) set(x, y, t, r); };
  // 1. the ground: open grass, part of the wilds (open from day 1)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (keep && keep(x, y)) continue; const i = idx(x, y); mask[i] = 1; terrain[i] = T.GRASS; wild[i] = 1; road[i] = 0; }
  // 2. the woods: canopies of the forest atoms (choppable, as in the frontier)
  W.placed.forEach(p => { if (p.def.kind === 'tree' && (p.def.tags.includes('forest') || p.def.tags.includes('forest-dead'))) fillDisc(p, (p.r || p.def.size[0] / 2) * 0.55, T.FOREST, false); });
  // 3. water, rails, then streets, drives and bridges on top
  W.water.forEach(wt => fillPoly(wt.pts, wt.w / 2, T.WATER, false));
  W.rails.forEach(r => fillPoly(r.pts, 1.8, T.DIRT, false));
  W.streets.forEach(s => fillPoly(s.pts, s.w / 2 + (s.walk || 0), T.GRASS, true));
  W.lots.forEach(l => { if (l.drive) fillObb(l.drive, T.GRASS, true); if (l.parking) fillObb(l.parking, T.DIRT, false); });
  W.bridges.forEach(b => fillObb(b, T.GRASS, true));
  // 4. solid things: buildings, vehicles, walls (thin fences stay passable for now)
  W.placed.forEach(p => { const d = p.def; if (d.tags.includes('camp') || d.tags.includes('nest')) return;
    if ((d.kind === 'building' || d.kind === 'vehicle') && d.collide === 'box') fillObb(p, T.ROCK, false);
    else if (d.kind === 'building' && d.collide === 'circle') fillDisc(p, p.w / 2, T.ROCK, false); });
  W.fences.forEach(f => { if (f.def && f.def.thick >= 0.3) fillSeg(f.a, f.b, 0.5, T.ROCK, false); });
  // 5. the camp clearing, as the frontier makes it (the keep stands at its centre)
  for (let y = Math.floor(c - 11); y <= c + 11; y++) for (let x = Math.floor(c - 11); x <= c + 11; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); if (d < 10) set(x, y, d < 6 ? T.DIRT : T.GRASS, false); }
  const nest = W.nest ? { x: W.nest.x + ox, y: W.nest.y + oy } : null;
  // the buildings that are places: their footprint cells, so the map can make them claimable sites
  const sites = [];
  W.placed.forEach(p => { const kind = p.def.kind === 'building' && siteOf(p.def); if (!kind || sites.some(s => s.kind === kind)) return;
    const cells = [], b = obbBox(p); for (let y = Math.floor(b[1] + oy); y <= Math.ceil(b[3] + oy); y++) for (let x = Math.floor(b[0] + ox); x <= Math.ceil(b[2] + ox); x++) if (inside(x, y) && mask[idx(x, y)] && pointInObb(p, x + 0.5 - ox, y + 0.5 - oy)) cells.push(idx(x, y));
    if (cells.length > 6) sites.push({ kind, atom: p.id, x: p.x + ox, y: p.y + oy, w: p.w, h: p.h, rot: p.rot, cells, door: p.door ? { x: p.door.x + ox, y: p.door.y + oy } : null }); });
  // houses to search: every building with a door that offers a home or a shop (and is not a site); the door is the spot
  const homes = [], STREETS = {}; W.streets.forEach(s => { STREETS[s.id] = s.name; });
  W.placed.forEach(p => { if (p.def.kind !== 'building' || !p.door || sites.some(s => s.atom === p.id && Math.hypot(s.x - p.x - ox, s.y - p.y - oy) < 1)) return;
    const home = p.def.offers.some(o => o.startsWith('home')), shop = p.def.offers.includes('shop'), salvage = p.def.offers.includes('salvage'); if (!home && !shop && !salvage) return;
    const x = p.door.x + ox, y = p.door.y + oy; if (!inside(Math.floor(x), Math.floor(y)) || !mask[idx(Math.floor(x), Math.floor(y))]) return;
    const lot = W.lots.find(l => l.id === p.lot), street = lot && lot.street && STREETS[lot.street];
    const where = street ? ` on ${street}` : '';
    homes.push({ id: homes.length, x, y, kind: shop || salvage ? 'scrap' : 'food', base: shop ? 2 : 1, name: shop ? (p.def.label ? `the ${p.def.label}` : 'a shop') : salvage ? `a burnt-out house${where}` : `a house${where}` }); });
  return { id, name: RECIPES[id].name, ox, oy, w: W.w, h: W.h, hash: res.hash, tries: res.attempts, mask, nest, sites, homes, W };
}
