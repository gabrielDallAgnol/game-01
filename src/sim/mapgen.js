// Map generation. A map is a square grid of cells (1 world unit each) with
// terrain, a town site at the centre, regions (one Voronoi cell per seed),
// a nest in every region but the town's, and build slots per region.
import { Rng, hashSeed, valueNoise } from './rng.js';

export const N = 64;
export const T = { GRASS: 0, FOREST: 1, ROCK: 2, WATER: 3, CLIFF: 4, FORD: 5, DIRT: 6, VOID: 7 };
export const PASSABLE = [true, true, false, false, false, true, true, false];
export const BUILDABLE = [true, false, false, false, false, false, true, false];
export const MOVE_COST = [1, 1.6, Infinity, Infinity, Infinity, 2.5, 1, Infinity];

export const BIOMES = {
  riverbend: { name: 'River Bend', blurb: 'A river curls around one flank. The dead must wade through the fords.' },
  highland:  { name: 'Highland Hold', blurb: 'The town sits on a plateau. Cliffs leave only a few passes up.' },
  lakeshore: { name: 'Lakeshore', blurb: 'A wide lake guards your back. Good farmland, open front.' },
};

const R = 30;           // playable radius
const SLOT_GAP = 3.1;   // minimum distance between build slots

export const idx = (x, y) => y * N + x;
export const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function generateMap(seed, biome) {
  const rng = new Rng(hashSeed(seed, biome, 'map'));
  const c = N / 2;
  const terrain = new Uint8Array(N * N);
  const f1 = valueNoise(hashSeed(seed, 'forest'), 7), f2 = valueNoise(hashSeed(seed, 'forest2'), 3);
  const rk = valueNoise(hashSeed(seed, 'rock'), 4);

  // 1. base terrain
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    let t = T.GRASS;
    if (d > R) t = T.VOID;
    else {
      const f = 0.65 * f1(x, y) + 0.35 * f2(x, y);
      if (f > 0.6 && d > 7) t = T.FOREST;
      if (rk(x, y) > 0.83 && d > 8) t = T.ROCK;
    }
    terrain[idx(x, y)] = t;
  }

  // 2. biome features: each one gives the town a defensible side
  const a = rng.range(0, Math.PI * 2);
  const nx = Math.cos(a), ny = Math.sin(a), ux = -ny, uy = nx;
  const feature = { kind: biome, angle: a };
  if (biome === 'riverbend') {
    const phase = rng.range(0, 6), fords = [rng.range(-13, -6), rng.range(5, 12)];
    feature.fords = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const rx = x + 0.5 - c, ry = y + 0.5 - c;
      const s = rx * ux + ry * uy, q = rx * nx + ry * ny;
      const q0 = 10 + 2.2 * Math.sin(s * 0.17 + phase) - 0.013 * s * s; // bends back around the town
      if (Math.abs(q - q0) < 1.7 && terrain[idx(x, y)] !== T.VOID) {
        const ford = fords.some(f => Math.abs(s - f) < 1.4);
        terrain[idx(x, y)] = ford ? T.FORD : T.WATER;
      }
    }
    for (const f of fords) feature.fords.push({ x: c + ux * f + nx * (10 - 0.013 * f * f), y: c + uy * f + ny * (10 - 0.013 * f * f) });
  } else if (biome === 'highland') {
    const passes = [];
    while (passes.length < 3) {
      const p = rng.range(0, Math.PI * 2);
      if (passes.every(q => Math.abs(((p - q + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 1.4)) passes.push(p);
    }
    feature.passes = passes;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const rx = x + 0.5 - c, ry = y + 0.5 - c, d = Math.hypot(rx, ry);
      if (d >= 10.8 && d < 12.6) {
        const ang = Math.atan2(ry, rx);
        const open = passes.some(p => Math.abs(((ang - p + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.14);
        terrain[idx(x, y)] = open ? T.GRASS : T.CLIFF;
      } else if (d < 10.8 && terrain[idx(x, y)] === T.ROCK) terrain[idx(x, y)] = T.GRASS;
    }
  } else if (biome === 'lakeshore') {
    const lx = c + nx * 15, ly = c + ny * 15;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const rx = x + 0.5 - lx, ry = y + 0.5 - ly;
      const along = rx * ux + ry * uy, across = rx * nx + ry * ny;
      const e = (along / 13) ** 2 + (across / 8.5) ** 2;
      if (e < 1 && terrain[idx(x, y)] !== T.VOID) terrain[idx(x, y)] = T.WATER;
      else if (e < 1.35 && terrain[idx(x, y)] !== T.VOID) terrain[idx(x, y)] = T.GRASS; // open shore for farms
    }
    feature.lake = { x: lx, y: ly };
  }

  // 3. town clearing
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < 5.5) terrain[idx(x, y)] = T.DIRT;

  // 4. regions: town + a ring of 6 + an outer ring of 10
  const seeds = [{ x: c, y: c, ring: 0 }];
  const off1 = rng.range(0, Math.PI * 2), off2 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 6; k++) { const an = off1 + k * Math.PI / 3 + rng.range(-0.22, 0.22), r = rng.range(11.5, 14); seeds.push({ x: c + Math.cos(an) * r, y: c + Math.sin(an) * r, ring: 1 }); }
  for (let k = 0; k < 10; k++) { const an = off2 + k * Math.PI / 5 + rng.range(-0.18, 0.18), r = rng.range(21.5, 25); seeds.push({ x: c + Math.cos(an) * r, y: c + Math.sin(an) * r, ring: 2 }); }
  const region = new Int16Array(N * N).fill(-1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (terrain[idx(x, y)] === T.VOID) continue;
    let best = 0, bd = Infinity;
    for (let s = 0; s < seeds.length; s++) { const d = (x + 0.5 - seeds[s].x) ** 2 + (y + 0.5 - seeds[s].y) ** 2; if (d < bd) { bd = d; best = s; } }
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

  // 5. which cells can be walked to from the town
  const reach = new Uint8Array(N * N);
  const qx = [Math.floor(c)], qy = [Math.floor(c)]; reach[idx(qx[0], qy[0])] = 1;
  for (let h = 0; h < qx.length; h++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = qx[h] + dx, y = qy[h] + dy;
    if (!inside(x, y) || reach[idx(x, y)] || !PASSABLE[terrain[idx(x, y)]]) continue;
    reach[idx(x, y)] = 1; qx.push(x); qy.push(y);
  }

  // 6. nests: the reachable grass/forest cell closest to each region's heart
  for (const reg of regions) {
    if (reg.ring === 0) continue;
    let best = null, bd = Infinity;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      if (region[i] !== reg.id || !reach[i]) continue;
      const t = terrain[i]; if (t !== T.GRASS && t !== T.FOREST) continue;
      if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < 13) continue;
      const d = (x + 0.5 - reg.x) ** 2 + (y + 0.5 - reg.y) ** 2;
      if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
    }
    reg.nest = best;
  }

  // 7. build slots: spaced-out buildable cells in each region
  const slots = [];
  const cand = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = idx(x, y);
    if (!BUILDABLE[terrain[i]] || !reach[i] || region[i] < 0) continue;
    const px = x + 0.5, py = y + 0.5;
    if (Math.hypot(px - c, py - c) < 3.2) continue; // keep footprint
    const reg = regions[region[i]];
    if (reg.nest && Math.hypot(px - reg.nest.x, py - reg.nest.y) < 3.5) continue;
    cand.push({ x: px, y: py, region: reg.id });
  }
  rng.shuffle(cand);
  // town slots first so the starting region is always well supplied
  cand.sort((p, q) => (regions[p.region].ring === 0 ? 0 : 1) - (regions[q.region].ring === 0 ? 0 : 1));
  for (const p of cand) {
    const reg = regions[p.region];
    if (reg.slots.length >= (reg.ring === 0 ? 10 : 9)) continue;
    if (slots.some(s => (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < SLOT_GAP * SLOT_GAP)) continue;
    let forest = 0, water = false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
      if (!inside(x, y) || dx * dx + dy * dy > 10) continue;
      const t = terrain[idx(x, y)];
      if (t === T.FOREST) forest++;
      if (t === T.WATER || t === T.FORD) water = true;
    }
    const slot = { id: slots.length, x: p.x, y: p.y, region: reg.id, forest, nearWater: water };
    slots.push(slot); reg.slots.push(slot.id);
  }

  for (const reg of regions) reg.neighbors = [...reg.neighbors].sort((p, q) => p - q);
  return { N, seed, biome, name: BIOMES[biome].name, terrain, region, regions, slots, reach, town: { x: c, y: c }, feature };
}

/** Quick checks used by tests and by the map picker to reject weak maps. */
export function validateMap(map) {
  const problems = [];
  const core = map.regions[0];
  if (core.slots.length < 8) problems.push(`town has only ${core.slots.length} slots`);
  const nests = map.regions.filter(r => r.nest);
  if (nests.filter(r => r.ring === 1).length < 4) problems.push('fewer than 4 first-ring nests');
  for (const r of nests) if (!map.reach[idx(Math.floor(r.nest.x), Math.floor(r.nest.y))]) problems.push(`nest ${r.id} unreachable`);
  const total = map.slots.length;
  if (total < 50) problems.push(`only ${total} slots on the map`);
  return problems;
}

/** Two different, valid maps for the start screen. */
export function mapChoices(seed) {
  const kinds = Object.keys(BIOMES);
  const rng = new Rng(hashSeed(seed, 'choices'));
  rng.shuffle(kinds);
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
