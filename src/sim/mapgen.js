// Map generation: the frontier. You start at a camp in the woods; one long road leads to a ruined city far away.
//   the camp      — a clearing at the centre of the map (the town is always at N/2, N/2)
//   the wilds     — forest and meadows round the camp: open from day 1, sparse finds (farmsteads, lumber camps,
//                   a quarry), animals, forest hollows where the first dead come from
//   the road      — a winding track through the trees to the city's edge
//   the city      — a disc of streets and ruined blocks far away, crawling with the dead: special buildings, hives,
//                   and the old core behind the quarantine fence (opened through the story)
// A map is a square grid of cells (1 world unit each) with terrain, regions (Voronoi districts) and build slots.
import { Rng, hashSeed, valueNoise } from './rng.js';
// [area] next line
import { applyArea } from './areamap.js';

export const N = 448;
const K = 1.45;          // city scale
export const T = { GRASS: 0, FOREST: 1, ROCK: 2, WATER: 3, CLIFF: 4, FORD: 5, DIRT: 6, VOID: 7 };
export const PASSABLE = [true, true, false, false, false, true, true, false];
export const BUILDABLE = [true, false, false, false, false, false, true, false];
export const MOVE_COST = [1, 1.6, Infinity, Infinity, Infinity, 2.5, 1, Infinity];
export const WORLD = { cityD: 178, cityR: 30 * K, wildR: 70, camp: 10, corridor: 11, roadFrom: 40 };   // the city edge is ~150 cells out: about a minute on foot

export const BIOMES = {
  riverbend: { name: 'Paris', blurb: 'A river curls through the far city; the Ash-Born cross at the bridges. The Eiffel Tower stands over it.', signature: 'eiffel' },
  highland:  { name: 'Rio de Janeiro', blurb: 'The far city sits on a raised plaza with few ramps up. Christ the Redeemer watches from a cliff top.', signature: 'christ' },
  lakeshore: { name: 'Berlin', blurb: 'A lake guards one side of the far city. The Fernsehturm towers over it.', signature: 'tvtower' },
  vale:      { name: 'The Cut', blurb: 'The far city lies in a sunken bowl ringed by cliffs, with one gap facing your woods.', signature: 'tvtower' },
};
const R = WORLD.cityR;
/** kept for old callers: inside the Vale's bowl (relative to the city centre) */
export function valeInside(rx, ry, pad = 0) { return Math.hypot(rx, ry) < R + pad; }

// Landmarks: intact buildings you can claim. City sites start 'unknown': the story decides what they are.
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
  eiffel:  { name: 'Eiffel Tower', size: 5, cost: 20, signature: true, desc: 'A lookout over the city: reveals all around it, and every tower reaches 1.5 further.' },
  tvtower: { name: 'Fernsehturm', size: 4, cost: 20, signature: true, desc: 'The broadcast reaches everyone: reveals the whole city, and +3 scrap every dawn.' },
  christ:  { name: 'Christ the Redeemer', size: 4, cost: 20, signature: true, desc: 'Hope from the cliff top: a blessing for the town every third dawn.' },
  // the wilds: plain, useful places, far apart
  farmstead: { name: 'Farmstead', size: 3, cost: 4, food: 3, wild: true, desc: 'Fields and a barn: +3 food every dawn.' },
  lumber:  { name: 'Lumber Camp', size: 3, cost: 5, gold: 3, wild: true, desc: 'Saws and stacked timber: +3 scrap every dawn.' },
  quarry:  { name: 'Quarry', size: 3, cost: 6, gold: 2, hands: 1, wild: true, desc: 'Stone and a crew: +2 scrap every dawn and one more pair of hands.' },
  lodge:   { name: 'Hunting Lodge', size: 3, cost: 4, food: 2, wild: true, desc: 'Traps and smoke racks: +2 food every dawn.' },
  cabin:   { name: 'Ranger Cabin', size: 3, cost: 3, survivors: 2, wild: true, desc: 'A family who knows the woods: +2 people now.' },
};
const WILD_KINDS = ['farmstead', 'lumber', 'quarry', 'lodge', 'cabin', 'farmstead', 'lumber'];
const GRID = 4;         // lot spacing: a 3×3 building plus a one-cell street

export const idx = (x, y) => y * N + x;
export const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function generateMap(seed, biome, opts = {}) {
  const rng = new Rng(hashSeed(seed, biome, 'map'));
  const c = N / 2;
  const terrain = new Uint8Array(N * N).fill(T.VOID), wild = new Uint8Array(N * N), road = new Uint8Array(N * N);
  const f1 = valueNoise(hashSeed(seed, 'forest'), 7), f2 = valueNoise(hashSeed(seed, 'forest2'), 3);
  const rk = valueNoise(hashSeed(seed, 'rock'), 4), wn = valueNoise(hashSeed(seed, 'wild'), 9), edge = valueNoise(hashSeed(seed, 'edge'), 14);

  // where the city lies
  const th = rng.range(0, Math.PI * 2), CX = c + Math.cos(th) * WORLD.cityD, CY = c + Math.sin(th) * WORLD.cityD;
  const dCity = (x, y) => Math.hypot(x + 0.5 - CX, y + 0.5 - CY), dCamp = (x, y) => Math.hypot(x + 0.5 - c, y + 0.5 - c);
  const ux = Math.cos(th), uy = Math.sin(th);   // from the camp toward the city

  // 1. the city: a street grid with blocks of buildings, parks and open lots
  const BLOCK = 12, ROADW = 2;
  const bx = x => Math.floor((x - CX + 1000 * BLOCK) / BLOCK), inBlock = v => ((v - Math.floor(CX) + 1000 * BLOCK) % BLOCK);
  const byk = y => Math.floor((y - CY + 1000 * BLOCK) / BLOCK), inBlockY = v => ((v - Math.floor(CY) + 1000 * BLOCK) % BLOCK);
  const blockKind = new Map();
  const kindOf = (x, y) => { const k = bx(x) * 997 + byk(y); if (!blockKind.has(k)) { const r = rng.next(); blockKind.set(k, r < 0.55 ? 'buildings' : r < 0.8 ? 'park' : 'lot'); } return blockKind.get(k); };
  function cityCell(x, y) {
    const ux2 = inBlock(x), uy2 = inBlockY(y);
    if (ux2 < ROADW || uy2 < ROADW) { road[idx(x, y)] = 1; return T.GRASS; }
    const ex = Math.min(ux2 - ROADW, BLOCK - 1 - ux2), ey = Math.min(uy2 - ROADW, BLOCK - 1 - uy2), e = Math.min(ex, ey);
    if (e === 0) return T.GRASS;
    const kind = kindOf(x, y);
    if (kind === 'buildings') {
      if (e <= 2) { const alley = (ex === Math.floor((BLOCK - ROADW) / 2) || ey === Math.floor((BLOCK - ROADW) / 2)) && rk(x, y) > 0.45; return alley ? T.GRASS : T.ROCK; }
      return f1(x, y) > 0.55 ? T.FOREST : T.GRASS;
    }
    if (kind === 'park') return (0.65 * f1(x, y) + 0.35 * f2(x, y)) > 0.38 ? T.FOREST : T.GRASS;
    return f2(x, y) > 0.8 ? T.FOREST : T.GRASS;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dCity(x, y) <= R) terrain[idx(x, y)] = cityCell(x, y);

  // 2. the city's character (around its centre)
  const feature = { kind: biome, angle: th, city: { x: CX, y: CY, r: R } };
  const inCity = (x, y) => dCity(x, y) <= R;
  if (biome === 'riverbend') {
    const a = rng.range(0, Math.PI * 2), nx = Math.cos(a), ny = Math.sin(a), vx = -ny, vy = nx, phase = rng.range(0, 6), fords = [rng.range(-19, -9), rng.range(7, 17)];
    feature.fords = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inCity(x, y)) continue;
      const rx = x + 0.5 - CX, ry = y + 0.5 - CY, s = rx * vx + ry * vy, q = rx * nx + ry * ny, q0 = 9 + 2.6 * Math.sin(s * 0.12 + phase);
      if (Math.abs(q - q0) < 1.7) terrain[idx(x, y)] = fords.some(f => Math.abs(s - f) < 1.4) ? T.FORD : T.WATER;
    }
    for (const f of fords) feature.fords.push({ x: CX + vx * f + nx * 9, y: CY + vy * f + ny * 9 });
  } else if (biome === 'highland' || biome === 'vale') {
    // a ring of cliffs round the city centre, with gaps; the Vale's one gap faces the woods
    const passes = biome === 'vale' ? [Math.atan2(c - CY, c - CX)] : [Math.atan2(c - CY, c - CX), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)];
    feature.passes = passes;
    const r0 = biome === 'vale' ? R - 4 : 13;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inCity(x, y)) continue;
      const rx = x + 0.5 - CX, ry = y + 0.5 - CY, d = Math.hypot(rx, ry);
      if (d >= r0 && d < r0 + 1.8) { const ang = Math.atan2(ry, rx); const open = passes.some(p => Math.abs(((ang - p + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < (biome === 'vale' ? 0.16 : 0.12)); terrain[idx(x, y)] = open ? T.GRASS : T.CLIFF; }
    }
  } else if (biome === 'lakeshore') {
    const a = rng.range(0, Math.PI * 2), lx = CX + Math.cos(a) * 18, ly = CY + Math.sin(a) * 18, vx = -Math.sin(a), vy = Math.cos(a);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inCity(x, y)) continue;
      const rx = x + 0.5 - lx, ry = y + 0.5 - ly, e2 = ((rx * vx + ry * vy) / 15) ** 2 + ((rx * Math.cos(a) + ry * Math.sin(a)) / 8.5) ** 2;
      if (e2 < 1) terrain[idx(x, y)] = T.WATER; else if (e2 < 1.35) terrain[idx(x, y)] = T.GRASS;
    }
    feature.lake = { x: lx, y: ly };
  }

  // 3. the wilds: woods and meadows round the camp, and a corridor of forest along the way to the city
  const segD = (x, y) => { const px = x + 0.5 - c, py = y + 0.5 - c, t = Math.max(0, Math.min(WORLD.cityD, px * ux + py * uy)); return Math.hypot(px - ux * t, py - uy * t); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y); if (terrain[i] !== T.VOID) continue;
    const d = dCamp(x, y), wob = (edge(x, y) - 0.5) * 18;
    if (d < WORLD.wildR + wob || segD(x, y) < WORLD.corridor + wob * 0.5) {
      wild[i] = 1;
      const n = 0.6 * wn(x, y) + 0.4 * f1(x, y);
      terrain[i] = d < WORLD.camp ? (d < 6 ? T.DIRT : T.GRASS) : n > 0.5 || d < WORLD.camp + 5 && n > 0.38 ? T.FOREST : T.GRASS;   // trees crowd the clearing: chop them to grow
    }
  }
  // a stream across the woods, with stepping stones
  { const a = th + Math.PI / 2 + rng.range(-0.4, 0.4), nx = Math.cos(a), ny = Math.sin(a), off = rng.range(26, 40) * (rng.next() < 0.5 ? -1 : 1), ph = rng.range(0, 6);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y); if (!wild[i]) continue;
      const rx = x + 0.5 - c, ry = y + 0.5 - c, s = rx * -ny + ry * nx, q = rx * nx + ry * ny - off - 3 * Math.sin(s * 0.09 + ph);
      if (Math.abs(q) < 1.1 && dCamp(x, y) > WORLD.camp + 2) terrain[i] = Math.abs(Math.sin(s * 0.11)) < 0.12 ? T.FORD : T.WATER;
    } }
  // 4. the road: a winding track from the camp to the city's edge (two cells wide)
  const roadPts = [];
  { const ph = rng.range(0, 6), amp = rng.range(5, 9), L = WORLD.cityD - R + 4;
    // the road only begins deep in the woods: the camp is not on anyone's way
    for (let t = WORLD.roadFrom; t <= L; t += 0.5) { const w = Math.sin(t / L * Math.PI * 2.2 + ph) * amp * Math.min(1, (L - t) / 10); roadPts.push([c + ux * t - uy * w, c + uy * t + ux * w]); }
    for (const [px, py] of roadPts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = Math.floor(px + dx * 0.6), y = Math.floor(py + dy * 0.6); if (!inside(x, y)) continue; const i = idx(x, y);
      if (terrain[i] === T.VOID) { terrain[i] = T.GRASS; wild[i] = 1; }
      if (terrain[i] === T.WATER) terrain[i] = T.FORD;
      if (terrain[i] === T.FOREST || terrain[i] === T.GRASS || terrain[i] === T.DIRT) { terrain[i] = T.GRASS; road[i] = 1; }
    } }
  feature.road = roadPts.filter((_, k) => k % 8 === 0);
  // [area] begin: an engine-built town replaces the ground round the camp (only with opts.area; draws no map rng)
  const area = opts.area ? applyArea({ N, T, idx, inside, terrain, wild, road, c, seed, keep: (x, y) => dCity(x, y) <= R + 6 }, opts.area) : null;
  // [area] end

  // 5. regions: the camp, the wilds (open), the city districts (sealed)
  const seeds = [{ x: c, y: c, ring: 0 }];
  const wildOff = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 7; k++) { const an = wildOff + k * Math.PI * 2 / 7 + rng.range(-0.2, 0.2), r = rng.range(32, 50); seeds.push({ x: c + Math.cos(an) * r, y: c + Math.sin(an) * r, ring: 1 }); }
  for (const t of [80, 104, 128]) seeds.push({ x: c + ux * t, y: c + uy * t, ring: 1 });   // along the road
  const cityOff = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 3; k++) { const an = cityOff + k * Math.PI * 2 / 3, r = 11; seeds.push({ x: CX + Math.cos(an) * r, y: CY + Math.sin(an) * r, ring: 3 }); }   // the old core: sealed
  for (let k = 0; k < 7; k++) { const an = cityOff + Math.PI / 7 + k * Math.PI * 2 / 7, r = rng.range(28, 33); seeds.push({ x: CX + Math.cos(an) * r, y: CY + Math.sin(an) * r, ring: 2 }); }
  const region = new Int16Array(N * N).fill(-1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y); if (terrain[i] === T.VOID) continue;
    const city = !wild[i];
    let best = -1, bd = Infinity;
    for (let s = 0; s < seeds.length; s++) { if ((seeds[s].ring >= 2) !== city) continue; const d = (x + 0.5 - seeds[s].x) ** 2 + (y + 0.5 - seeds[s].y) ** 2; if (d < bd) { bd = d; best = s; } }
    if (!city && dCamp(x, y) < WORLD.camp + 1) best = 0;
    region[i] = best;
  }
  const regions = seeds.map((s, id) => ({ id, ring: s.ring, x: s.x, y: s.y, neighbors: new Set(), cells: 0, forest: 0, water: 0, nest: null, slots: [] }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = region[idx(x, y)]; if (r < 0) continue;
    const reg = regions[r]; reg.cells++;
    const t = terrain[idx(x, y)]; if (t === T.FOREST) reg.forest++; if (t === T.WATER || t === T.FORD) reg.water++;
    for (const [dx, dy] of [[1, 0], [0, 1]]) { if (!inside(x + dx, y + dy)) continue; const r2 = region[idx(x + dx, y + dy)]; if (r2 >= 0 && r2 !== r) { reg.neighbors.add(r2); regions[r2].neighbors.add(r); } }
  }

  // 5b. high ground in the city: small plateaus behind retaining walls, one ramp
  const high = new Uint8Array(N * N), ramp = new Uint8Array(N * N);
  feature.plateaus = [];
  for (const reg of regions) {
    if (reg.ring < 2 || rng.next() > 0.45) continue;
    const tx = reg.x + rng.range(-3, 3), ty = reg.y + rng.range(-3, 3), pr = rng.range(2.6, 3.6), wall = pr + 1.2, toCamp = Math.atan2(c - ty, c - tx);
    let ok = true;
    for (let y = Math.floor(ty - wall - 1); y <= ty + wall + 1 && ok; y++) for (let x = Math.floor(tx - wall - 1); x <= tx + wall + 1 && ok; x++) {
      if (!inside(x, y)) { ok = false; break; }
      const t = terrain[idx(x, y)]; if (Math.hypot(x + 0.5 - tx, y + 0.5 - ty) < wall + 1 && (t === T.WATER || t === T.FORD || t === T.VOID || t === T.CLIFF || high[idx(x, y)] || wild[idx(x, y)])) ok = false;
    }
    if (!ok) continue;
    for (let y = Math.floor(ty - wall); y <= ty + wall; y++) for (let x = Math.floor(tx - wall); x <= tx + wall; x++) {
      const i = idx(x, y), d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty), ang = Math.atan2(y + 0.5 - ty, x + 0.5 - tx), off = Math.abs(((ang - toCamp + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < pr) { terrain[i] = T.GRASS; high[i] = 1; } else if (d < wall) { if (off < 0.32) { terrain[i] = T.GRASS; ramp[i] = 1; } else terrain[i] = T.CLIFF; }
    }
    feature.plateaus.push({ x: tx, y: ty, r: pr, region: reg.id });
  }

  // 6. which cells can be walked to from the camp
  const reach = new Uint8Array(N * N);
  { const q = [idx(Math.floor(c), Math.floor(c))]; reach[q[0]] = 1;
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!inside(xx, yy)) continue; const j = idx(xx, yy); if (reach[j] || !PASSABLE[terrain[j]]) continue; reach[j] = 1; q.push(j); } } }

  // 7. nests: forest hollows in the wilds (the first dead), hives at the doors of city buildings (most of the dead)
  const hasNest = new Set();
  rng.shuffle(regions.filter(r => r.ring === 1 && Math.hypot(r.x - c, r.y - c) < 60)).slice(0, 3).forEach(r => hasNest.add(r.id));
  rng.shuffle(regions.filter(r => r.ring === 2)).slice(0, 3).forEach(r => hasNest.add(r.id));
  rng.shuffle(regions.filter(r => r.ring === 3)).slice(0, 2).forEach(r => hasNest.add(r.id));
  // [area] begin: the area's own Inferno Nest atom is a hollow, in whatever region it stands
  const areaNest = area && area.nest && inside(Math.floor(area.nest.x), Math.floor(area.nest.y)) && region[idx(Math.floor(area.nest.x), Math.floor(area.nest.y))] >= 0 ? region[idx(Math.floor(area.nest.x), Math.floor(area.nest.y))] : -1;
  // [area] end
  for (const reg of regions) {
    if (reg.id === areaNest && reg.ring === 1) { reg.nest = { x: area.nest.x, y: area.nest.y, back: null, hollow: true }; continue; }   // [area]
    if (!hasNest.has(reg.id)) continue;
    let best = null, bd = Infinity;
    for (let y = Math.max(2, Math.floor(reg.y - 16)); y < Math.min(N - 2, reg.y + 16); y++) for (let x = Math.max(2, Math.floor(reg.x - 16)); x < Math.min(N - 2, reg.x + 16); x++) {
      const i = idx(x, y); if (region[i] !== reg.id || !reach[i] || high[i] || road[i]) continue;
      const t = terrain[i]; if (t !== T.GRASS && t !== T.FOREST) continue;
      if (dCamp(x, y) < 26) continue;
      let face = null;
      if (reg.ring >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let solid = true;
        for (let k = 1; k <= 2 && solid; k++) for (let s2 = -1; s2 <= 1 && solid; s2++) { const xx = x + dx * k + dy * s2, yy = y + dy * k + dx * s2; if (!inside(xx, yy) || terrain[idx(xx, yy)] !== T.ROCK) solid = false; }
        if (solid) { face = [dx, dy]; break; }
      }
      const d = (x + 0.5 - reg.x) ** 2 + (y + 0.5 - reg.y) ** 2 + (reg.ring >= 2 && !face ? 400 : 0);
      if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5, back: face, hollow: reg.ring === 1 }; }
    }
    reg.nest = best;
  }

  // 8. landmarks: one place per wild region (far apart), one sealed site per city district, the signature in the city
  const lm = new Int16Array(N * N).fill(-1), landmarks = [];
  const placeLm = (kind, cands) => {
    const sz = LANDMARKS[kind].size, h = Math.floor(sz / 2);
    for (const [x0, y0] of cands) {
      let ok = true;
      for (let dy = -h - 1; dy <= sz - h && ok; dy++) for (let dx = -h - 1; dx <= sz - h && ok; dx++) {
        const x = x0 + dx, y = y0 + dy; if (!inside(x, y)) { ok = false; break; }
        const i = idx(x, y), t = terrain[i];
        if (!(t === T.GRASS || t === T.DIRT || t === T.FOREST) || lm[i] >= 0 || ramp[i] || !reach[i] || road[i]) ok = false;
      }
      if (!ok) continue;
      if (regions.some(r => r.nest && Math.hypot(r.nest.x - x0, r.nest.y - y0) < 6)) continue;
      if (landmarks.some(l => Math.hypot(l.x - x0, l.y - y0) < 9)) continue;
      const id = landmarks.length, cells = [];
      for (let dy = -h; dy < sz - h; dy++) for (let dx = -h; dx < sz - h; dx++) { const i = idx(x0 + dx, y0 + dy); terrain[i] = T.ROCK; lm[i] = id; cells.push(i); }
      landmarks.push({ id, kind, x: x0 - h + sz / 2, y: y0 - h + sz / 2, size: sz, cells, region: region[idx(x0, y0)] });
      return true;
    }
    return false;
  };
  const around = (cx0, cy0, d0, d1, reg = null) => { const out = []; for (let y = Math.max(2, Math.floor(cy0 - d1)); y < Math.min(N - 2, cy0 + d1); y++) for (let x = Math.max(2, Math.floor(cx0 - d1)); x < Math.min(N - 2, cx0 + d1); x++) { const d = Math.hypot(x + 0.5 - cx0, y + 0.5 - cy0); if (d >= d0 && d <= d1 && (reg === null || region[idx(x, y)] === reg)) out.push([x, y, d]); } return out.sort((a, b) => a[2] - b[2]).map(([x, y]) => [x, y]); };
  // [area] begin: the area's buildings that are places become sites first, footprint and all
  if (area) for (const s of area.sites) { const id = landmarks.length, r = region[s.cells[0]]; if (r < 0) continue; for (const i of s.cells) { terrain[i] = T.ROCK; lm[i] = id; } landmarks.push({ id, kind: s.kind, x: s.x, y: s.y, size: Math.round(Math.max(s.w, s.h)), cells: s.cells, region: r, engine: { w: s.w, h: s.h, rot: s.rot, atom: s.atom, door: s.door } }); }
  // [area] end
  const sig = BIOMES[biome].signature;
  if (sig === 'christ' && feature.plateaus.length) {
    const p = feature.plateaus[0], sz = LANDMARKS.christ.size, h = Math.floor(sz / 2), x0 = Math.floor(p.x), y0 = Math.floor(p.y), cells = [], id = landmarks.length;
    for (let dy = -h; dy < sz - h; dy++) for (let dx = -h; dx < sz - h; dx++) { const i = idx(x0 + dx, y0 + dy); if (!high[i]) continue; terrain[i] = T.ROCK; lm[i] = id; cells.push(i); }
    landmarks.push({ id, kind: 'christ', x: x0 - h + sz / 2, y: y0 - h + sz / 2, size: sz, cells, region: region[idx(x0, y0)], high: true });
  } else if (sig && !placeLm(sig, rng.shuffle(around(CX, CY, 4, 14)))) placeLm(sig, around(CX, CY, 4, R - 6));
  let wk = rng.int(WILD_KINDS.length);
  for (const reg of regions) {
    if (reg.ring === 0 || landmarks.some(l => l.region === reg.id)) continue;
    const cands = around(reg.x, reg.y, 0, 12, reg.id).filter(([x, y]) => dCamp(x, y) > WORLD.camp + 6 && !(area && area.mask[idx(x, y)]));   // [area] no frontier sites inside the town
    placeLm(reg.ring === 1 ? WILD_KINDS[wk++ % WILD_KINDS.length] : 'unknown', cands);
  }

  // 8b. a forest hollow beside a wild building moves into it: the building is the hive (Gabriel's call, Oct 20). Its
  // body is the building's footprint (what you hit, from any side); the nest point is its door, the walkable cell on the
  // camp side where the dead come out, so spawns, paths and homes stay on open ground. Burnt, it is the site to claim.
  for (const reg of regions) {
    const n = reg.nest; if (reg.ring !== 1 || !n) continue;
    const l = landmarks.find(q => q.region === reg.id && WILD_KINDS.includes(q.kind) && Math.hypot(q.x - n.x, q.y - n.y) < 10); if (!l) continue;
    const h = l.size / 2; let door = null, bd = Infinity;
    for (let y = Math.floor(l.y - h) - 1; y <= Math.floor(l.y + h); y++) for (let x = Math.floor(l.x - h) - 1; x <= Math.floor(l.x + h); x++) {
      const ox = x + 0.5 - l.x, oy = y + 0.5 - l.y; if (Math.max(Math.abs(ox), Math.abs(oy)) < h || (Math.abs(ox) > h && Math.abs(oy) > h)) continue;   // the ring round the walls, no corners
      if (!inside(x, y)) continue; const i = idx(x, y); if (!reach[i] || lm[i] >= 0 || !PASSABLE[terrain[i]]) continue;
      const d = dCamp(x, y); if (d < bd) { bd = d; door = { x: x + 0.5, y: y + 0.5 }; }
    }
    if (door) reg.nest = { x: door.x, y: door.y, back: null, hollow: true, site: l.id, body: { x: l.x, y: l.y, half: h } };
  }

  // 9. build slots round the camp: 3×3 lots on a street grid aligned to the keep
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
  const out = { N, seed, biome, name: BIOMES[biome].name, terrain, region, regions, slots, reach, high, ramp, lm, landmarks, road, wild, town: { x: c, y: c }, city: { x: CX, y: CY, r: R }, feature };
  if (area) out.area = area;   // [area]
  return out;
}

/** Quick checks used by tests and by the map picker to reject weak maps. */
export function validateMap(map) {
  const problems = [];
  const core = map.regions[0];
  if (core.slots.length < 7) problems.push(`camp has only ${core.slots.length} slots`);
  const nests = map.regions.filter(r => r.nest);
  if (nests.filter(r => r.ring === 1).length < 2) problems.push('fewer than 2 forest hollows');
  if (nests.filter(r => r.ring >= 2).length < 4) problems.push('fewer than 4 city Inferno Nests');
  for (const r of nests) if (!map.reach[idx(Math.floor(r.nest.x), Math.floor(r.nest.y))]) problems.push(`Inferno Nest ${r.id} unreachable`);
  const cc = idx(Math.floor(map.city.x), Math.floor(map.city.y));
  if (!map.reach[cc] && !map.regions.some(r => r.ring === 2 && r.nest)) problems.push('the city cannot be reached');
  if (map.slots.length < 30) problems.push(`only ${map.slots.length} slots`);
  return problems;
}

/** The valid map(s) for the start screen. */
export function mapChoices(seed, opts = {}) {
  const rng = new Rng(hashSeed(seed, 'choices'));
  const kinds = ['riverbend'];   // one world while we test the frontier
  const out = [];
  for (const biome of kinds) {
    for (let tries = 0; tries < 12 && !out.length; tries++) {
      const s = hashSeed(seed, biome, tries) % 1000000;
      const m = generateMap(s, biome, opts);
      if (!validateMap(m).length) { out.push({ seed: s, biome, name: m.name }); break; }
    }
    if (out.length) break;
  }
  return out;
}
