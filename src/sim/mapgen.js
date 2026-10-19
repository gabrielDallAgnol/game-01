// Map generation. A map is a square grid of cells (1 world unit each) with
// terrain, a town site at the centre, regions (one Voronoi cell per seed),
// a nest in every region but the town's, and build slots per region.
import { Rng, hashSeed, valueNoise } from './rng.js';

export const N = 96;
const K = 1.45;          // the city grew: distances scale with this
export const T = { GRASS: 0, FOREST: 1, ROCK: 2, WATER: 3, CLIFF: 4, FORD: 5, DIRT: 6, VOID: 7 };
export const PASSABLE = [true, true, false, false, false, true, true, false];
export const BUILDABLE = [true, false, false, false, false, false, true, false];
export const MOVE_COST = [1, 1.6, Infinity, Infinity, Infinity, 2.5, 1, Infinity];

export const BIOMES = {
  riverbend: { name: 'Paris', blurb: 'The river curls around one flank; the dead must cross at the bridges. The Eiffel Tower stands across the water.', signature: 'eiffel' },
  highland:  { name: 'Rio de Janeiro', blurb: 'Your town sits on a raised plaza with few ramps up. Christ the Redeemer watches from a cliff top.', signature: 'christ' },
  lakeshore: { name: 'Berlin', blurb: 'A lake guards your back, open ground in front. The Fernsehturm towers over the east.', signature: 'tvtower' },
  vale:      { signature: 'tvtower', name: 'The Cut', blurb: 'You start at the bottom of a V-shaped sunken district. The dead only come from above, and you push up through it.' },
};

const R = 30 * K;       // playable radius
const VALE_HALF = 0.72; // half-opening of the Vale's V (radians), widened by VALE_PAD at the tip
const VALE_PAD = 6.5 * K;
/** inside the Vale: the town circle at the tip, then a V opening upward (screen up is −y) */
export function valeInside(rx, ry, pad = 0) {
  if (Math.hypot(rx, ry) < 10 * K + pad) return true;
  return ry < 0 && Math.abs(rx) <= -ry * Math.tan(VALE_HALF) + VALE_PAD + pad && Math.hypot(rx, ry) < 31 * K + pad;
}
// Landmarks: intact buildings you can claim for a bonus and a forward build zone. One signature per city.
// Sites start as 'unknown': what a district is gets decided when the story opens it (see content/districts.js).
// power: silent power · gold/food: per dawn · noise: adds to the town's heat · survivors: join when claimed
export const LANDMARKS = {
  unknown: { name: 'Sealed building', size: 3, cost: 0, desc: 'Behind the quarantine fence. Open the district to find out what it is.' },
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
};
const GRID = 4;         // lot spacing: a 3×3 building plus a one-cell street

export const idx = (x, y) => y * N + x;
export const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function generateMap(seed, biome) {
  const rng = new Rng(hashSeed(seed, biome, 'map'));
  const c = N / 2;
  const terrain = new Uint8Array(N * N);
  const f1 = valueNoise(hashSeed(seed, 'forest'), 7), f2 = valueNoise(hashSeed(seed, 'forest2'), 3);
  const rk = valueNoise(hashSeed(seed, 'rock'), 4);

  // 1. base terrain: a street grid (Red Alert-clear roads) with city blocks between them.
  //    A block is either buildings round a courtyard (with alleys), a park, or an open lot.
  const BLOCK = 12, ROADW = 2, road = new Uint8Array(N * N);
  const bx = x => Math.floor((x - c + 1000 * BLOCK) / BLOCK), inBlock = v => ((v - Math.floor(c) + 1000 * BLOCK) % BLOCK);
  const blockKind = new Map();
  const kindOf = (x, y) => { const k = bx(x) * 997 + bx(y); if (!blockKind.has(k)) { const r = rng.next(); blockKind.set(k, r < 0.5 ? 'buildings' : r < 0.78 ? 'park' : 'lot'); } return blockKind.get(k); };
  function cityCell(x, y, d) {
    const ux = inBlock(x), uy = inBlock(y);
    if (ux < ROADW || uy < ROADW) { road[idx(x, y)] = 1; return T.GRASS; }
    if (d < 11) return T.GRASS;   // the square and the streets round it: open ground to build on
    const ex = Math.min(ux - ROADW, BLOCK - 1 - ux), ey = Math.min(uy - ROADW, BLOCK - 1 - uy), e = Math.min(ex, ey);   // 0 = sidewalk
    if (e === 0) return T.GRASS;
    const kind = kindOf(x, y);
    if (kind === 'buildings') {
      if (e <= 2) { const alley = (ex === Math.floor((BLOCK - ROADW) / 2) || ey === Math.floor((BLOCK - ROADW) / 2)) && rk(x, y) > 0.45; return alley ? T.GRASS : T.ROCK; }
      return f1(x, y) > 0.55 ? T.FOREST : T.GRASS;   // the courtyard
    }
    if (kind === 'park') return (0.65 * f1(x, y) + 0.35 * f2(x, y)) > 0.38 ? T.FOREST : T.GRASS;
    return f2(x, y) > 0.8 ? T.FOREST : T.GRASS;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    let t = T.GRASS;
    const vale = biome === 'vale';
    if (vale ? !valeInside(x + 0.5 - c, y + 0.5 - c) : d > R) t = vale && valeInside(x + 0.5 - c, y + 0.5 - c, 1.6) ? T.CLIFF : T.VOID;
    else t = cityCell(x, y, d);
    terrain[idx(x, y)] = t;
  }

  // 2. biome features: each one gives the town a defensible side
  const a = rng.range(0, Math.PI * 2);
  const nx = Math.cos(a), ny = Math.sin(a), ux = -ny, uy = nx;
  const feature = { kind: biome, angle: a };
  if (biome === 'riverbend') {
    const phase = rng.range(0, 6), fords = [rng.range(-19, -9), rng.range(7, 17)];
    feature.fords = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const rx = x + 0.5 - c, ry = y + 0.5 - c;
      const s = rx * ux + ry * uy, q = rx * nx + ry * ny;
      const q0 = 13 + 2.6 * Math.sin(s * 0.12 + phase) - 0.009 * s * s; // bends back around the town
      if (Math.abs(q - q0) < 1.7 && terrain[idx(x, y)] !== T.VOID) {
        const ford = fords.some(f => Math.abs(s - f) < 1.4);
        terrain[idx(x, y)] = ford ? T.FORD : T.WATER;
      }
    }
    for (const f of fords) feature.fords.push({ x: c + ux * f + nx * (13 - 0.009 * f * f), y: c + uy * f + ny * (13 - 0.009 * f * f) });
  } else if (biome === 'highland') {
    const passes = [];
    while (passes.length < 3) {
      const p = rng.range(0, Math.PI * 2);
      if (passes.every(q => Math.abs(((p - q + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 1.4)) passes.push(p);
    }
    feature.passes = passes;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const rx = x + 0.5 - c, ry = y + 0.5 - c, d = Math.hypot(rx, ry);
      if (d >= 12.8 && d < 14.6) {
        const ang = Math.atan2(ry, rx);
        const open = passes.some(p => Math.abs(((ang - p + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.12);
        terrain[idx(x, y)] = open ? T.GRASS : T.CLIFF;
      } else if (d < 12.8 && terrain[idx(x, y)] === T.ROCK) terrain[idx(x, y)] = T.GRASS;
    }
  } else if (biome === 'lakeshore') {
    const lx = c + nx * 20, ly = c + ny * 20;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const rx = x + 0.5 - lx, ry = y + 0.5 - ly;
      const along = rx * ux + ry * uy, across = rx * nx + ry * ny;
      const e = (along / 17) ** 2 + (across / 10.5) ** 2;
      if (e < 1 && terrain[idx(x, y)] !== T.VOID) terrain[idx(x, y)] = T.WATER;
      else if (e < 1.35 && terrain[idx(x, y)] !== T.VOID) terrain[idx(x, y)] = T.GRASS; // open shore for farms
    }
    feature.lake = { x: lx, y: ly };
  }

  // 3. town clearing
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < 9) terrain[idx(x, y)] = T.DIRT;

  // 4. regions: town + a ring of 6 + an outer ring of 6 big far districts
  const seeds = [{ x: c, y: c, ring: 0 }];
  const off1 = rng.range(0, Math.PI * 2), off2 = rng.range(0, Math.PI * 2);
  if (biome === 'vale') {
    // bands across the V, each wider than the last: 4 near, 5 far
    const band = (n, r0, r1, ring) => { for (let k = 0; k < n; k++) { const f = (k + 0.5) / n * 2 - 1, an = -Math.PI / 2 + f * (VALE_HALF + 0.12) + rng.range(-0.06, 0.06), r = rng.range(r0, r1); seeds.push({ x: c + Math.cos(an) * r, y: c + Math.sin(an) * r, ring }); } };
    band(4, 20, 23, 1); band(4, 33, 37, 2);
  } else for (let k = 0; k < 6; k++) { const an = off1 + k * Math.PI / 3 + rng.range(-0.22, 0.22), r = rng.range(19.5, 23); seeds.push({ x: c + Math.cos(an) * r, y: c + Math.sin(an) * r, ring: 1 }); }
  // far districts: six big ones (an expedition, not a stroll)
  if (biome !== 'vale') for (let k = 0; k < 6; k++) { const an = off2 + k * Math.PI / 3 + rng.range(-0.15, 0.15), r = rng.range(33, 37); seeds.push({ x: c + Math.cos(an) * r, y: c + Math.sin(an) * r, ring: 2 }); }
  const region = new Int16Array(N * N).fill(-1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (terrain[idx(x, y)] === T.VOID) continue;
    let best = 0, bd = Infinity;
    for (let s = 0; s < seeds.length; s++) { const d = (x + 0.5 - seeds[s].x) ** 2 + (y + 0.5 - seeds[s].y) ** 2; if (d < bd) { bd = d; best = s; } }
    // the town owns its natural fortress: the whole plateau on Highland, a wide circle elsewhere
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    if (d < (biome === 'highland' ? 12.6 : 11)) best = 0;
    region[idx(x, y)] = best;
  }
  const regions = seeds.map((s, id) => ({ id, ring: s.ring, x: s.x, y: s.y, neighbors: new Set(), cells: 0, forest: 0, water: 0, nest: null, slots: [] }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = region[idx(x, y)]; if (r < 0) continue;
    const reg = regions[r]; reg.cells++;
    const t = terrain[idx(x, y)];
    if (t === T.FOREST) reg.forest++;
    if (t === T.WATER || t === T.FORD) reg.water++;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (!inside(x + dx, y + dy)) continue;
      const r2 = region[idx(x + dx, y + dy)];
      if (r2 >= 0 && r2 !== r) { reg.neighbors.add(r2); regions[r2].neighbors.add(r); }
    }
  }

  // 4b. high ground: small plateaus behind retaining walls, one ramp facing the town.
  //     Easy to hold: build an outpost up there and the dead can only come up the ramp.
  const high = new Uint8Array(N * N), ramp = new Uint8Array(N * N);
  feature.plateaus = [];
  for (const reg of regions) {
    if (reg.ring < 1 || biome === 'highland' && reg.ring < 1) continue;
    if (rng.next() > (reg.ring === 1 ? 0.6 : 0.45)) continue;
    // halfway between the region's heart and the town side of it
    const tx = reg.x + (c - reg.x) * 0.28 + rng.range(-2, 2), ty = reg.y + (c - reg.y) * 0.28 + rng.range(-2, 2);
    const pr = rng.range(2.6, 3.6), wall = pr + 1.2, toTown = Math.atan2(c - ty, c - tx);
    let ok = Math.hypot(tx - c, ty - c) > 15;
    for (let y = Math.floor(ty - wall - 1); y <= ty + wall + 1 && ok; y++) for (let x = Math.floor(tx - wall - 1); x <= tx + wall + 1 && ok; x++) {
      if (!inside(x, y)) { ok = false; break; }
      const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty), t = terrain[idx(x, y)];
      if (d < wall + 1 && (t === T.WATER || t === T.FORD || t === T.VOID || t === T.CLIFF || high[idx(x, y)])) ok = false;
    }
    if (!ok) continue;
    for (let y = Math.floor(ty - wall); y <= ty + wall; y++) for (let x = Math.floor(tx - wall); x <= tx + wall; x++) {
      const i = idx(x, y), d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
      const ang = Math.atan2(y + 0.5 - ty, x + 0.5 - tx), off = Math.abs(((ang - toTown + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < pr) { terrain[i] = T.GRASS; high[i] = 1; }
      else if (d < wall) { if (off < 0.32) { terrain[i] = T.GRASS; ramp[i] = 1; } else terrain[i] = T.CLIFF; }
    }
    feature.plateaus.push({ x: tx, y: ty, r: pr, region: reg.id });
  }

  // 5. which cells can be walked to from the town
  const reach = new Uint8Array(N * N);
  const qx = [Math.floor(c)], qy = [Math.floor(c)]; reach[idx(qx[0], qy[0])] = 1;
  for (let h = 0; h < qx.length; h++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = qx[h] + dx, y = qy[h] + dy;
    if (!inside(x, y) || reach[idx(x, y)] || !PASSABLE[terrain[idx(x, y)]]) continue;
    reach[idx(x, y)] = 1; qx.push(x); qy.push(y);
  }

  // 6. nests: fewer, and each one is a building that went bad. About half the districts have one;
  //    the hive sits at a building's door (solid block behind it), facing the street.
  const want = biome === 'vale' ? { 1: 2, 2: 2 } : { 1: 3, 2: 3 };
  const hasNest = new Set();
  for (const ring of [1, 2]) rng.shuffle(regions.filter(r => r.ring === ring)).slice(0, want[ring]).forEach(r => hasNest.add(r.id));
  for (const reg of regions) {
    if (reg.ring === 0 || !hasNest.has(reg.id)) continue;
    let best = null, bd = Infinity;
    for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) {
      const i = idx(x, y);
      if (region[i] !== reg.id || !reach[i]) continue;
      const t = terrain[i]; if (t !== T.GRASS && t !== T.FOREST) continue;
      if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < 17 || high[i]) continue;
      // a solid block right behind (two cells deep, three wide) in some direction
      let face = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let solid = true;
        for (let k = 1; k <= 2 && solid; k++) for (let s2 = -1; s2 <= 1 && solid; s2++) { const xx = x + dx * k + dy * s2, yy = y + dy * k + dx * s2; if (!inside(xx, yy) || terrain[idx(xx, yy)] !== T.ROCK) solid = false; }
        if (solid) { face = [dx, dy]; break; }
      }
      const d = (x + 0.5 - reg.x) ** 2 + (y + 0.5 - reg.y) ** 2 + (face ? 0 : 400);
      if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5, back: face }; }
    }
    reg.nest = best;
  }

  // 6b. landmarks: open ground in the near ring, away from hives and each other; the signature one stands further out
  const lm = new Int16Array(N * N).fill(-1), landmarks = [];
  const placeLm = (kind, cands) => {
    const sz = LANDMARKS[kind].size, h = Math.floor(sz / 2);
    for (const [x0, y0] of cands) {
      let ok = true;
      for (let dy = -h - 1; dy <= sz - h && ok; dy++) for (let dx = -h - 1; dx <= sz - h && ok; dx++) {
        const x = x0 + dx, y = y0 + dy; if (!inside(x, y)) { ok = false; break; }
        const i = idx(x, y), t = terrain[i];
        if (!(t === T.GRASS || t === T.DIRT || t === T.FOREST) || lm[i] >= 0 || ramp[i] || !reach[i]) ok = false;
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
  const ring = (d0, d1) => { const out = []; for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); if (d >= d0 && d <= d1) out.push([x, y]); } return rng.shuffle(out); };
  const sig = BIOMES[biome].signature;
  if (sig === 'christ' && feature.plateaus.length) {
    // the statue stands on a plateau: the nearest one to the town
    const p = feature.plateaus.slice().sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c))[0];
    const spots = []; for (let y = Math.floor(p.y - 1); y <= p.y + 1; y++) for (let x = Math.floor(p.x - 1); x <= p.x + 1; x++) spots.push([x, y]);
    const sz = LANDMARKS.christ.size, h = Math.floor(sz / 2), [x0, y0] = spots[4] || spots[0], cells = [], id = landmarks.length;
    for (let dy = -h; dy < sz - h; dy++) for (let dx = -h; dx < sz - h; dx++) { const i = idx(x0 + dx, y0 + dy); if (!high[i]) continue; terrain[i] = T.ROCK; lm[i] = id; cells.push(i); }
    landmarks.push({ id, kind: 'christ', x: x0 - h + sz / 2, y: y0 - h + sz / 2, size: sz, cells, region: region[idx(x0, y0)], high: true });
  } else if (sig) placeLm(sig, ring(20, 28));
  // one sealed site per district (its identity comes later, from the story)
  for (const reg of regions) {
    if (reg.ring === 0 || landmarks.some(l => l.region === reg.id)) continue;
    const near = []; for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) { if (region[idx(x, y)] !== reg.id) continue; const d = Math.hypot(x + 0.5 - reg.x, y + 0.5 - reg.y); if (d < 9 && Math.hypot(x + 0.5 - c, y + 0.5 - c) > 13) near.push([x, y, d]); }
    near.sort((a, b) => a[2] - b[2]);
    placeLm('unknown', near.map(([x, y]) => [x, y]));
  }

  // 7. build slots on a street grid: every lot is 3×3 cells with a one-cell street around it,
  //    aligned to the keep, so the town reads as blocks and streets as it grows.
  const slots = [];
  const lotOk = (cx, cy) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy; if (!inside(x, y)) return false;
      const i = idx(x, y), t = terrain[i];
      if (!reach[i] || !(BUILDABLE[t] || t === T.FOREST)) return false;   // a lot may clear a few trees
    }
    return true;
  };
  const clearLot = (cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = idx(cx + dx, cy + dy); if (terrain[i] === T.FOREST) terrain[i] = T.GRASS; } };
  const scan = (x0, y0) => {
    let forest = 0, water = false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = x0 + dx, y = y0 + dy; if (!inside(x, y) || dx * dx + dy * dy > 10) continue;
      const t = terrain[idx(x, y)]; if (t === T.FOREST) forest++; if (t === T.WATER || t === T.FORD) water = true;
    }
    return { forest, water };
  };
  const ci = Math.floor(c);
  const clear = (cx, cy) => slots.every(o => Math.max(Math.abs(o.x - 0.5 - cx), Math.abs(o.y - 0.5 - cy)) >= GRID);
  const tryLot = (cx, cy) => {
    if (Math.hypot(cx + 0.5 - c, cy + 0.5 - c) < 4.5) return false;   // the keep and its ring street
    if (!lotOk(cx, cy) || !clear(cx, cy)) return false;
    const r = region[idx(cx, cy)]; if (r < 0) return false;
    const reg = regions[r];
    if (reg.nest && Math.hypot(cx + 0.5 - reg.nest.x, cy + 0.5 - reg.nest.y) < 3.5) return false;
    const { forest, water } = scan(cx, cy);
    clearLot(cx, cy);
    const slot = { id: slots.length, x: cx + 0.5, y: cy + 0.5, region: r, forest, nearWater: water, gate: false };
    slots.push(slot); reg.slots.push(slot.id);
    return true;
  };
  // gate slots: one lot on each ford or mountain pass, for palisades and towers only.
  // They belong to the town, because they are its natural defensive line.
  const gates = [];
  if (feature.fords) gates.push(...feature.fords);
  if (feature.passes) for (const p of feature.passes) gates.push({ x: c + Math.cos(p) * 13.7, y: c + Math.sin(p) * 13.7 });
  for (const gpt of gates) {
    const x = Math.floor(gpt.x), y = Math.floor(gpt.y); if (!inside(x, y) || !reach[idx(x, y)]) continue;
    const slot = { id: slots.length, x: x + 0.5, y: y + 0.5, region: 0, forest: 0, nearWater: true, gate: true };
    slots.push(slot); regions[0].slots.push(slot.id);
  }

  // grid points, nearest to the keep first; each may shift one cell to fit the land
  const pts = [];
  for (let gy = -12; gy <= 12; gy++) for (let gx = -12; gx <= 12; gx++) pts.push([gx, gy]);
  pts.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  const nudges = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [gx, gy] of pts) for (const [dx, dy] of nudges) if (tryLot(ci + gx * GRID + dx, ci + gy * GRID + dy)) break;
  // fill pass: any leftover space that still fits a lot with a street around it
  const cells = [];
  for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) cells.push([x, y]);
  cells.sort((a, b) => Math.hypot(a[0] - c, a[1] - c) - Math.hypot(b[0] - c, b[1] - c));
  for (const [x, y] of cells) tryLot(x, y);
  for (const reg of regions) reg.neighbors = [...reg.neighbors].sort((p, q) => p - q);
  for (let i = 0; i < N * N; i++) if (terrain[i] !== T.GRASS && terrain[i] !== T.DIRT) road[i] = 0;
  return { N, seed, biome, name: BIOMES[biome].name, terrain, region, regions, slots, reach, high, ramp, lm, landmarks, road, town: { x: c, y: c }, feature };
}

/** Quick checks used by tests and by the map picker to reject weak maps. */
export function validateMap(map) {
  const problems = [];
  const core = map.regions[0];
  if (core.slots.length < 7) problems.push(`town has only ${core.slots.length} slots`);
  const nests = map.regions.filter(r => r.nest);
  if (nests.filter(r => r.ring === 1).length < 2) problems.push('fewer than 2 first-ring nests');
  for (const r of nests) if (!map.reach[idx(Math.floor(r.nest.x), Math.floor(r.nest.y))]) problems.push(`nest ${r.id} unreachable`);
  const total = map.slots.length;
  if (total < (map.biome === 'vale' ? 28 : 40)) problems.push(`only ${total} slots on the map`);
  return problems;
}

/** Two different, valid maps for the start screen. */
export function mapChoices(seed) {
  // the Vale is always one of the two; the other is drawn from the open lands
  const rng = new Rng(hashSeed(seed, 'choices'));
  const kinds = ['vale', ...rng.shuffle(Object.keys(BIOMES).filter(k => k !== 'vale'))];
  const out = [];
  for (const biome of kinds) {
    for (let tries = 0; tries < 12 && out.length < 2; tries++) {
      const s = hashSeed(seed, biome, tries) % 1000000;
      const m = generateMap(s, biome);
      if (!validateMap(m).length) { out.push({ seed: s, biome, name: m.name }); break; }
    }
    if (out.length === 2) break;
  }
  return out;
}
