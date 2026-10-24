// [rig3] An act's map theme: the same generator, a new seed, then the act's own ground. Act 1 (the suburbs) is the
// map as generated. Act 2 (the rail yard) thins the woods, lays two freight lines across the wilds (dirt, walkable,
// buildable) and parks boxcars and a gantry crane beside them (solid props on rock, never on a lot, a site, a road or
// a hive's door). The props are listed in map.decor for the renderer. Deterministic: its own Rng stream.
import { Rng, hashSeed } from './rng.js';
import { N, T, idx, inside } from './mapgen.js';

export function themeMap(map, leg = 1) {
  map.leg = leg; map.decor = map.decor || [];
  if (leg < 2) return map;
  const rng = new Rng(hashSeed(map.seed, 'leg', leg)), c = map.town.x;
  const lot = new Uint8Array(N * N);   // cells a prop may never take: lots (+1), sites, roads, hive doors, the camp
  for (const s of map.slots) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = Math.floor(s.x) + dx, y = Math.floor(s.y) + dy; if (inside(x, y)) lot[idx(x, y)] = 1; }
  for (const r of map.regions) if (r.nest) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = Math.floor(r.nest.x) + dx, y = Math.floor(r.nest.y) + dy; if (inside(x, y)) lot[idx(x, y)] = 1; }
  const free = i => !lot[i] && map.lm[i] < 0 && !map.road[i] && map.wild[i] && (map.terrain[i] === T.GRASS || map.terrain[i] === T.FOREST || map.terrain[i] === T.DIRT);
  // thinner woods: an industrial outskirt, more open ground
  if (leg >= 2) for (let i = 0; i < N * N; i++) if (map.wild[i] && map.terrain[i] === T.FOREST && ((i * 2654435761) >>> 0) % 100 < 30) map.terrain[i] = T.GRASS;
  if (leg !== 2) return map;   // (later acts: thinner woods and their own ground colours for now)
  // the freight lines: two parallel tracks crossing the wilds, passing the camp at a distance
  const a = rng.range(0, Math.PI), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, off = rng.range(16, 22) * (rng.next() < 0.5 ? -1 : 1);
  const rail = new Uint8Array(N * N), line = [];
  for (const lane of [0, 3]) for (let t = -95; t <= 95; t += 0.5) {
    const x = Math.floor(c + ux * t + nx * (off + lane)), y = Math.floor(c + uy * t + ny * (off + lane)); if (!inside(x, y)) continue;
    const i = idx(x, y); if (!map.wild[i] || map.terrain[i] === T.WATER || map.terrain[i] === T.VOID || map.terrain[i] === T.CLIFF || map.terrain[i] === T.ROCK) continue;
    if (map.terrain[i] === T.FOREST || map.terrain[i] === T.GRASS) map.terrain[i] = T.DIRT;
    rail[i] = 1; if (lane === 0 && t % 4 === 0) line.push([c + ux * t + nx * (off + 1.5), c + uy * t + ny * (off + 1.5)]);
  }
  map.rail = rail; map.railLine = { ux, uy, nx, ny, off: off + 1.5 };
  // solid props: a run of boxcars on the far track, a gantry crane over the yard, a water tower (never near the camp)
  const solid = (x0, y0, w, h, kind, rot) => {
    const xs = Math.floor(x0 - w / 2), ys = Math.floor(y0 - h / 2), cells = [];
    for (let y = ys; y < ys + h; y++) for (let x = xs; x < xs + w; x++) { if (!inside(x, y)) return false; const i = idx(x, y); if (!free(i) && !rail[i]) return false; if (lot[i] || map.road[i]) return false; cells.push(i); }
    if (Math.hypot(x0 - c, y0 - c) < 18) return false;
    for (const i of cells) { map.terrain[i] = T.ROCK; map.reach[i] = 0; lot[i] = 1; }
    map.decor.push({ kind, x: x0, y: y0, rot, w, h }); return true;
  };
  let cars = 0;
  for (const [px, py] of rng.shuffle(line.slice())) { if (cars >= 9) break; if (solid(px + nx * 1.5, py + ny * 1.5, Math.abs(ux) > Math.abs(uy) ? 4 : 2, Math.abs(ux) > Math.abs(uy) ? 2 : 4, 'boxcar', a)) cars++; }
  for (let k = 0; k < 40; k++) { const t = rng.range(-60, 60), x = c + ux * t + nx * (off + 6), y = c + uy * t + ny * (off + 6); if (solid(x, y, 3, 3, 'crane', a)) break; }
  for (let k = 0; k < 40; k++) { const t = rng.range(-70, 70), x = c + ux * t + nx * (off - 5), y = c + uy * t + ny * (off - 5); if (solid(x, y, 2, 2, 'watertower', 0)) break; }
  return map;
}
