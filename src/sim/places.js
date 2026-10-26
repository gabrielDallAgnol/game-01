// [ch1] Hollowmere's places for chapter 1: the engine town's sites (church, town hall, school, water tower, station,
// transmitter hall, the sugar works) and the buildings the story borrows (Kai's garage on the Ring, Pizza Rapido, the
// Lichtspiel cinema in a west-side barn, the goods shed in the works quarter, the hut at Mast Two) as game places, each
// with a spot to stand on (reachable ground at its door) and a radius that counts as "at" it; and which story district
// (content/story1.js DISTRICTS) a point is in. Deterministic and draws no rng: everything is picked by distance.
// Only the `hollowmere` area has places; in any other town every function answers null.
import { PASSABLE, idx, inside } from './mapgen.js';
import { PLACES, DISTRICTS } from '../content/story1.js';

export function createPlaces(G) {
  const { map, c } = G, A = map.area, W = A && A.W;
  const on = !!(A && A.id === 'hollowmere' && W && W.sites);
  if (!on) return { places: () => null, placeAt: () => null, districtOf: () => null, districtName: () => '', atPlace: () => false };
  const ox = A.ox, oy = A.oy, toG = p => ({ x: p.x + ox, y: p.y + oy });
  const walk = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false; const i = idx(cx, cy); return PASSABLE[map.terrain[i]] && map.reach[i]; };
  /** the nearest reachable ground to (x, y), searched in rings out to r cells */
  function ground(x, y, r = 30) {
    if (walk(x, y)) return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
    for (let d = 1; d <= r; d++) { let best = null, bd = Infinity;
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue; const px = Math.floor(x) + dx + 0.5, py = Math.floor(y) + dy + 0.5; if (!walk(px, py)) continue; const q = Math.hypot(px - x, py - y); if (q < bd) { bd = q; best = { x: px, y: py }; } }
      if (best) return best; }
    return { x, y };
  }
  // a placed atom → a place: its middle, its size, the spot at its door (or the nearest ground toward the camp)
  const fromAtom = (p, kind, extra = {}) => {
    const m = toG(p), half = Math.max(p.w || 6, p.h || 6) / 2;
    const d = p.door ? toG(p.door) : { x: m.x + (c - m.x) / Math.max(1, Math.hypot(c - m.x, c - m.y)) * (half + 1), y: m.y + (c - m.y) / Math.max(1, Math.hypot(c - m.x, c - m.y)) * (half + 1) };
    const at = ground(d.x, d.y);
    return { kind, x: m.x, y: m.y, w: p.w || 6, h: p.h || 6, rot: p.rot || 0, uid: p.uid, at, r: half + 7, ...extra };
  };
  const S1 = W.sites, P = {};
  const placed = W.placed.filter(p => p.def.kind === 'building');
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const camp = { x: W.camp.x, y: W.camp.y };
  // ---------- the town's own sites ----------
  P.rig = { kind: 'rig', x: c, y: c, w: 6, h: 6, at: { x: c, y: c + 3.5 }, r: 7 };
  if (S1.church) P.church = fromAtom(S1.church, 'church');
  if (S1.townhall) P.townhall = fromAtom(S1.townhall, 'townhall');
  if (S1.school) P.school = fromAtom(S1.school, 'school');
  if (S1.watertower) P.watertower = fromAtom(S1.watertower, 'watertower', { r: 14 });
  if (S1.station) P.station = fromAtom(S1.station, 'station');
  if (S1.transmitter) P.hut = fromAtom(S1.transmitter, 'hut');   // the hut at Mast Two: the transmitter hall at the masts' feet
  if (W.finale) { const f = placed.find(p => p.uid === W.finale.uid) || W.finale; P.works = fromAtom(f, 'factory', { r: 30 }); }
  else if (S1.works) P.works = fromAtom(S1.works, 'factory', { r: 30 });
  // ---------- the buildings the story borrows ----------
  const nestable = placed.filter(p => p.def.tags.includes('nestable'));
  const goods = nestable.filter(p => p.def.id.startsWith('hall.goods')).sort((a, b) => dist(a, camp) - dist(b, camp))[0] || nestable.filter(p => p.def.tags.includes('industrial')).sort((a, b) => dist(a, camp) - dist(b, camp))[0];
  if (goods) P.shed = fromAtom(goods, 'shed', { r: 18 });
  // the cinema: a big barn west of the square (the town has no cinema atom: an old barn on the edge of the Ring stands in)
  const west = nestable.filter(p => p !== goods && p.x < camp.x - 40 && !p.def.tags.includes('industrial')).sort((a, b) => dist(a, camp) - dist(b, camp))[0]
    || nestable.filter(p => p !== goods && !p.def.tags.includes('industrial')).sort((a, b) => dist(a, camp) - dist(b, camp))[0];
  if (west) P.cinema = fromAtom(west, 'cinema', { r: 16 });
  // Kai's garage: a shop on the Ring east of the square; Pizza Rapido: the shop nearest the square on the Ring
  const shops = placed.filter(p => p.door && p.def.offers.includes('shop') && p.def.tags.includes('oldtown'));
  const ringD = p => dist(p, camp);
  const east = shops.filter(p => p.x > camp.x + 50 && Math.abs(p.y - camp.y) < 80).sort((a, b) => ringD(b) - ringD(a))[0] || shops.sort((a, b) => ringD(b) - ringD(a))[0];
  if (east) P.garage = fromAtom(east, 'garage', { r: 9 });
  const pizza = shops.filter(p => p !== east && ringD(p) > 50).sort((a, b) => ringD(a) - ringD(b))[0];
  if (pizza) P.pizzeria = fromAtom(pizza, 'shop', { r: 8 });
  for (const [id, p] of Object.entries(P)) Object.assign(p, { id, name: PLACES[id] ? PLACES[id].name : id });

  // ---------- districts: the story's eight, read from the engine's districts and the places ----------
  const plaza = W.plaza ? toG(W.plaza) : { x: c, y: c }, wt = P.watertower;
  function districtOf(x, y) {
    if (Math.hypot(x - plaza.x, y - plaza.y) < 42) return 'square';
    if (wt && Math.hypot(x - wt.x, y - wt.y) < 60) return 'tower';
    const d = W.districtAt ? W.districtAt(x - ox, y - oy) : null, k = d && d.kind, name = d && d.name || '';
    if (k === 'rail' || k === 'industry') return 'north';
    if (k === 'field') return 'masts';
    if (k === 'oldtown') return y > plaza.y + 25 && Math.abs(x - plaza.x) < 45 ? 'main' : 'ring';
    if (k === 'suburb') return /south/.test(name) ? 'main' : /east/.test(name) ? 'east' : /west/.test(name) ? 'west' : x < plaza.x ? 'west' : 'east';
    if (k === 'park' || k === 'barns') return x < plaza.x ? 'west' : 'east';
    // beyond the districts: by direction from the square
    const a = Math.atan2(y - plaza.y, x - plaza.x) * 180 / Math.PI;
    return a < -45 && a > -135 ? 'north' : a > 100 && a < 170 ? 'masts' : Math.abs(a) < 60 ? 'east' : a > 0 ? 'main' : 'west';
  }
  const atPlace = (id, x, y, pad = 0) => { const p = P[id]; return !!p && Math.hypot(x - p.x, y - p.y) < p.r + pad; };
  /** the place whose ground (x, y) stands on, if any (nearest first) */
  const placeAt = (x, y) => { let best = null, bd = Infinity; for (const p of Object.values(P)) { const d = Math.hypot(x - p.x, y - p.y); if (d < p.r && d < bd) { bd = d; best = p.id; } } return best; };
  return { places: () => P, placeAt, atPlace, districtOf, districtName: (x, y) => { const d = districtOf(x, y); return d ? DISTRICTS[d].name : ''; }, groundNear: ground };
}
