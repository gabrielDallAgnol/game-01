// Where an objective may stand: the one test every quest, beacon, trial, drop, station and contract place goes
// through. A good spot is on walkable ground (grass, woods, dirt: never water, a ford, a cliff or rock), the hero can
// walk to it from the camp, its district is open (not behind the quarantine fence), and it keeps a margin from the
// world's edge (the grid's border and the dark void round the woods and the city).
import { N, T, idx, inside } from './mapgen.js';

export const SPOT = { edge: 8, void: 3, snap: 5 };   // cells from the grid border · cells clear of the void · how far a spot may slide to find good ground
const LAND = [true, true, false, false, false, false, true, false];   // grass, forest, dirt

/** a point an objective may sit on. sealed: S.sealed · null before the run exists (the old core counts as sealed) ·
 *  false to ignore the fences (a district the caller is about to open) */
export function spotOk(map, sealed, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const cx = Math.floor(x), cy = Math.floor(y), E = SPOT.edge;
  if (cx < E || cy < E || cx >= N - E || cy >= N - E) return false;
  const i = idx(cx, cy);
  if (!LAND[map.terrain[i]] || !map.reach[i] || map.lm[i] >= 0) return false;
  const r = map.region[i]; if (r < 0 || (sealed && sealed[r]) || (sealed === null && map.regions[r].ring > 2)) return false;   // null: the old core starts sealed
  const V = SPOT.void;
  for (let dy = -V; dy <= V; dy++) for (let dx = -V; dx <= V; dx++) if (map.terrain[idx(cx + dx, cy + dy)] === T.VOID) return false;
  return true;
}
/** a landmark (a site quest) is a fair objective when its district is open and good ground touches it */
export function siteOk(map, sealed, l) {
  if (!l || (sealed && sealed[l.region])) return false;
  const r = l.size / 2 + 1.5;
  for (let y = Math.floor(l.y - r); y <= l.y + r; y++) for (let x = Math.floor(l.x - r); x <= l.x + r; x++) if (spotOk(map, sealed, x + 0.5, y + 0.5)) return true;
  return false;
}
/** the good cell nearest (x, y) within SPOT.snap (cell centre), or null. extra(i) may veto a cell (occupied, home ground…) */
export function reachableSpot(map, sealed, x, y, extra = null, snap = SPOT.snap) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const cx = Math.floor(x), cy = Math.floor(y);
  let best = null, bd = Infinity;
  for (let dy = -snap; dy <= snap; dy++) for (let dx = -snap; dx <= snap; dx++) {
    const d = dx * dx + dy * dy; if (d > snap * snap || d >= bd) continue;
    const px = cx + dx + 0.5, py = cy + dy + 0.5;
    if (!spotOk(map, sealed, px, py) || (extra && !extra(idx(cx + dx, cy + dy)))) continue;
    bd = d; best = { x: px, y: py };
  }
  return best;
}

/** the run's objective picker: a random open district, a point near its middle, good ground, off your land, out of
 *  the camp, within a day's walk (120 cells; 200 when the near ones are full). Draws from the run stream. */
export function createSpots(G) {
  const { S, map, c } = G;
  function findSpot() {
    const rng = G.rng;
    for (let t = 0; t < 80; t++) {
      const reg = map.regions[rng.int(map.regions.length)]; if (reg.ring < 1 || S.sealed[reg.id]) continue;
      const x = reg.x + rng.range(-7, 7), y = reg.y + rng.range(-7, 7), cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) continue;
      const i = idx(cx, cy);
      if (map.region[i] !== reg.id || !spotOk(map, S.sealed, x, y) || S.occ[i] >= 0 || G.inZone(i) || G.baseDist(x, y) < 6 || Math.hypot(x - c, y - c) > (t < 60 ? 120 : 200)) continue;
      return { x: cx + 0.5, y: cy + 0.5 };
    }
    return null;
  }
  /** a save from before this check may hold objectives off the map: slide each onto good ground nearby, or a fresh spot */
  function mendSpots() {
    const ST = S.story, ok = o => spotOk(map, S.sealed, o.x, o.y), move = o => { const p = reachableSpot(map, S.sealed, o.x, o.y, null, 8) || findSpot(); if (p) { o.x = p.x; o.y = p.y; } return !!p; };
    if (ST) {
      ST.spots = ST.spots.filter(sp => ok(sp) || move(sp));
      if (ST.trial && !ST.trial.done && !ok(ST.trial)) move(ST.trial);
      ST.quests = ST.quests.filter(q => siteOk(map, S.sealed, S.landmarks[q.site]));
    }
    S.drops = S.drops.filter(d => ok(d) || move(d));
    S.pickups = S.pickups.filter(ok);
  }
  return { findSpot, mendSpots, spotOk: (x, y) => spotOk(map, S.sealed, x, y) };
}
