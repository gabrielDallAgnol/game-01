// Map generation: an engine-built town round the camp (src/engine, rasterised by areamap.js), on a square grid of
// cells (1 m each). The camp is always at N/2, N/2 and the area recipe is placed so its camp sits there; beyond the
// town's rectangle a band of woods, then the void. The grid carries what the rules read: terrain, regions (the camp,
// then sectors round it), build slots, reach from the camp, the street cells (road), the sites (landmarks).
// (The old frontier — a camp in the woods, a road to a far city, Voronoi districts — was cut on Oct 25.)
import { hashSeed } from './rng.js';
import { applyArea } from './areamap.js';
import { RECIPES } from '../engine/recipes.js';

/** the grid's side in cells (1 cell = 1 m). One constant: raise it to fit a bigger town (every reader uses N) */
export const N = 672;   // Oct 26: 448 → 672, so the 600 × 500 m Hollowmere fits round the church square with its band of woods
export const T = { GRASS: 0, FOREST: 1, ROCK: 2, WATER: 3, CLIFF: 4, FORD: 5, DIRT: 6, VOID: 7 };
export const PASSABLE = [true, true, false, false, false, true, true, false];
export const BUILDABLE = [true, false, false, false, false, false, true, false];
export const MOVE_COST = [1, 1.6, Infinity, Infinity, Infinity, 2.5, 1, Infinity];
// the run's world label (saves keep it); the town itself comes from the area recipe
export const BIOMES = { riverbend: { name: 'Hollowmere', blurb: 'A town the Ashfall left standing: streets to search, sites to claim, hordes asleep in the ruins.' } };
export const DEFAULT_AREA = 'hollowmere';   // chapter 1's town (the other recipes stay reachable by ?area=)
// regions: the camp (CAMP_R round it), then SECTORS slices of the town in two bands split at BAND_R
const CAMP_R = 11, SECTORS = 8, BAND_R = 70;

// Landmarks: intact buildings you can claim (an engine town's sites: areamap.js OFFER_SITE).
// power: silent power · gold/food: per dawn · noise: adds to heat · survivors: join when claimed · hands: per day
export const LANDMARKS = {
  unknown: { name: 'Sealed building', size: 3, cost: 0, desc: 'Behind the cordon fence. Open the district to find out what it is.' },
  flats:   { name: 'Tower Block', size: 3, cost: 6, manual: 'stone', survivors: 3, gold: 1, desc: 'Families holed up on the top floors: +3 people now, +1 scrap every dawn.' },
  allotment: { name: 'Allotments', size: 3, cost: 6, manual: 'harvest', food: 4, desc: 'Vegetable plots behind a fence: +4 food every dawn.' },
  market:  { name: 'High Street', size: 3, cost: 8, manual: 'scavver', gold: 4, desc: 'Shops to strip and a market to run: +4 scrap every dawn.' },
  police:  { name: 'Police Station', size: 3, cost: 10, manual: 'hero', desc: 'The armory: your towers deal 15% more damage.' },
  clinic:  { name: 'Clinic', size: 3, cost: 10, manual: 'heart', desc: 'Field medics: you heal 2 health a second, day and night. The infected can be treated here.' },
  substation: { name: 'Substation', size: 3, cost: 10, manual: 'ranger', power: 6, desc: 'The grid, quiet: +6 power with no noise at all.' },
  fuel:    { name: 'Fuel Depot', size: 3, cost: 8, manual: 'bow', power: 5, gold: 3, noise: 5, desc: 'Diesel: +5 power and +3 scrap every dawn, but the pumps are loud (+heat).' },
  school:  { name: 'School', size: 3, cost: 6, manual: 'heart', survivors: 4, hands: 1, desc: 'A teacher kept them alive: +4 people now and one more pair of hands every day.' },
  radio:   { name: 'Radio Station', size: 3, cost: 14, manual: 'scavver', reveal: true, desc: 'Broadcasts reach every block: reveals the whole city and draws a survivor every other dawn.' },
  // the wilds: plain, useful places, far apart
  farmstead: { name: 'Farmstead', size: 3, cost: 4, food: 3, wild: true, desc: 'Fields and a barn: +3 food every dawn.' },
  lumber:  { name: 'Lumber Camp', size: 3, cost: 5, gold: 3, wild: true, desc: 'Saws and stacked timber: +3 scrap every dawn.' },
  quarry:  { name: 'Quarry', size: 3, cost: 6, gold: 2, hands: 1, wild: true, desc: 'Stone and a crew: +2 scrap every dawn and one more pair of hands.' },
  lodge:   { name: 'Hunting Lodge', size: 3, cost: 4, food: 2, wild: true, desc: 'Traps and smoke racks: +2 food every dawn.' },
  cabin:   { name: 'Ranger Cabin', size: 3, cost: 3, survivors: 2, wild: true, desc: 'A family who knows the woods: +2 people now.' },
};
const GRID = 4;         // lot spacing: a 3×3 building plus a one-cell street

export const idx = (x, y) => y * N + x;
export const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function generateMap(seed, biome = 'riverbend', opts = {}) {
  const c = N / 2, areaId = RECIPES[opts.area] ? opts.area : DEFAULT_AREA;
  const terrain = new Uint8Array(N * N).fill(T.VOID), wild = new Uint8Array(N * N), road = new Uint8Array(N * N);
  const dCamp = (x, y) => Math.hypot(x + 0.5 - c, y + 0.5 - c);

  // 1. the town: the engine builds the area and rasterises it round the camp (draws no map rng)
  const area = applyArea({ N, T, idx, inside, terrain, wild, road, c, seed, keep: null }, areaId);

  // 2. regions: the camp, then sectors round it (ring 1: open from day 1)
  const region = new Int16Array(N * N).fill(-1);
  const sectorOf = (x, y) => { const a = Math.atan2(y + 0.5 - c, x + 0.5 - c), k = ((Math.floor((a + Math.PI) / (2 * Math.PI) * SECTORS) % SECTORS) + SECTORS) % SECTORS; return 1 + k + (dCamp(x, y) >= BAND_R ? SECTORS : 0); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = idx(x, y); if (terrain[i] === T.VOID) continue; region[i] = dCamp(x, y) < CAMP_R ? 0 : sectorOf(x, y); }
  const all = Array.from({ length: 1 + 2 * SECTORS }, (_, id) => ({ id, ring: id ? 1 : 0, x: 0, y: 0, neighbors: new Set(), cells: 0, forest: 0, water: 0, nest: null, slots: [] }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = region[idx(x, y)]; if (r < 0) continue;
    const reg = all[r]; reg.cells++; reg.x += x + 0.5; reg.y += y + 0.5;
    const t = terrain[idx(x, y)]; if (t === T.FOREST) reg.forest++; if (t === T.WATER || t === T.FORD) reg.water++;
  }
  // keep the regions that have ground, numbered in order
  const live = all.filter(r => r.id === 0 || r.cells > 0), remap = new Int16Array(all.length).fill(-1);
  live.forEach((r, k) => { remap[r.id] = k; r.id = k; if (r.cells) { r.x /= r.cells; r.y /= r.cells; } else { r.x = c; r.y = c; } });
  for (let i = 0; i < N * N; i++) if (region[i] >= 0) region[i] = remap[region[i]];
  const regions = live;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = region[idx(x, y)]; if (r < 0) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) { if (!inside(x + dx, y + dy)) continue; const r2 = region[idx(x + dx, y + dy)]; if (r2 >= 0 && r2 !== r) { regions[r].neighbors.add(r2); regions[r2].neighbors.add(r); } }
  }

  // 3. which cells can be walked to from the camp
  const reach = new Uint8Array(N * N);
  { const q = [idx(Math.floor(c), Math.floor(c))]; reach[q[0]] = 1;
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!inside(xx, yy)) continue; const j = idx(xx, yy); if (reach[j] || !PASSABLE[terrain[j]]) continue; reach[j] = 1; q.push(j); } } }

  // 4. the nest: the area's own Inferno Nest atom is a hollow in whatever region it stands
  if (area.nest && inside(Math.floor(area.nest.x), Math.floor(area.nest.y))) { const r = region[idx(Math.floor(area.nest.x), Math.floor(area.nest.y))]; if (r > 0) regions[r].nest = { x: area.nest.x, y: area.nest.y, back: null, hollow: true }; }

  // 5. landmarks: the area's buildings that are places, footprint and all
  const lm = new Int16Array(N * N).fill(-1), landmarks = [];
  for (const s of area.sites) { const id = landmarks.length, r = region[s.cells[0]]; if (r < 0) continue; for (const i of s.cells) { terrain[i] = T.ROCK; lm[i] = id; } landmarks.push({ id, kind: s.kind, x: s.x, y: s.y, size: Math.round(Math.max(s.w, s.h)), cells: s.cells, region: r, engine: { w: s.w, h: s.h, rot: s.rot, atom: s.atom, door: s.door } }); }

  // 6. build slots round the camp: 3×3 lots on a street grid aligned to the keep
  const slots = [];
  const lotOk = (cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (!inside(x, y)) return false; const i = idx(x, y), t = terrain[i]; if (!reach[i] || !(BUILDABLE[t] || t === T.FOREST) || road[i]) return false; } return true; };
  const clearLot = (cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = idx(cx + dx, cy + dy); if (terrain[i] === T.FOREST) terrain[i] = T.GRASS; } };
  const ci = Math.floor(c);
  const clear = (cx, cy) => slots.every(o => Math.max(Math.abs(o.x - 0.5 - cx), Math.abs(o.y - 0.5 - cy)) >= GRID);
  const tryLot = (cx, cy) => {
    if (Math.hypot(cx + 0.5 - c, cy + 0.5 - c) < 4.5 || Math.hypot(cx + 0.5 - c, cy + 0.5 - c) > 30) return false;
    if (!lotOk(cx, cy) || !clear(cx, cy)) return false;
    const r = region[idx(cx, cy)]; if (r < 0) return false;
    const reg = regions[r]; if (reg.nest && Math.hypot(cx + 0.5 - reg.nest.x, cy + 0.5 - reg.nest.y) < 3.5) return false;
    let forest = 0, water = false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, y = cy + dy; if (!inside(x, y) || dx * dx + dy * dy > 10) continue; const t = terrain[idx(x, y)]; if (t === T.FOREST) forest++; if (t === T.WATER || t === T.FORD) water = true; }
    clearLot(cx, cy);
    const slot = { id: slots.length, x: cx + 0.5, y: cy + 0.5, region: r, forest, nearWater: water, gate: false };
    slots.push(slot); reg.slots.push(slot.id); return true;
  };
  const pts = []; for (let gy = -7; gy <= 7; gy++) for (let gx = -7; gx <= 7; gx++) pts.push([gx, gy]);
  pts.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  const nudges = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [gx, gy] of pts) for (const [dx, dy] of nudges) if (tryLot(ci + gx * GRID + dx, ci + gy * GRID + dy)) break;
  for (const reg of regions) reg.neighbors = [...reg.neighbors].sort((p, q) => p - q);
  for (let i = 0; i < N * N; i++) if (terrain[i] !== T.GRASS && terrain[i] !== T.DIRT) road[i] = 0;
  const high = new Uint8Array(N * N), ramp = new Uint8Array(N * N);   // (no plateaus in an engine town: the renderer still reads them)
  return { N, seed, biome, name: area.name, terrain, region, regions, slots, reach, high, ramp, lm, landmarks, road, wild, town: { x: c, y: c }, feature: { kind: biome }, area };
}

/** Quick checks used by tests and by the map picker to reject weak maps. */
export function validateMap(map) {
  const problems = [];
  const core = map.regions[0];
  if (core.slots.length < 7) problems.push(`camp has only ${core.slots.length} slots`);
  for (const r of map.regions) if (r.nest && !map.reach[idx(Math.floor(r.nest.x), Math.floor(r.nest.y))]) problems.push(`Inferno Nest ${r.id} unreachable`);
  if (map.slots.length < 30) problems.push(`only ${map.slots.length} slots`);
  return problems;
}

/** The valid map(s) for the start screen: the first seed (from this one) whose town passes the checks. */
export function mapChoices(seed, opts = {}) {
  const biome = 'riverbend', out = [];
  for (let tries = 0; tries < 12 && !out.length; tries++) {
    const s = hashSeed(seed, biome, tries) % 1000000;
    const m = generateMap(s, biome, opts);
    if (!validateMap(m).length) out.push({ seed: s, biome, name: m.name });
  }
  return out;
}
