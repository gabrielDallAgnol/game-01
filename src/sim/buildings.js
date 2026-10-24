// The grid: footprints and lots, where a building may stand (canPlace), placing and removing buildings,
// the hero's walkable ground, flow fields the dead walk by, and the build zone (Red Alert style).
import { BUILDINGS } from '../content/buildings.js';
import { CUT, LOT_PAD, SIZE, WALL_COST, ZONE } from './state.js';
import { N, PASSABLE, T, idx, inside } from './mapgen.js';
import { computeFlow, computeNext } from './flow.js';

export function createBuildings(G) {
  const { S, c, dropLive, ev, keep, map, reveal } = G;

  // ---------- buildings & footprints ----------
  // Buildings go anywhere on your land. Footprints are whole cells; every building keeps a
  // one-cell street around it so people (and you) can walk between them. Palisades may chain
  // to other palisades and to towers. Palisades have four orientations: 0 —, 1 |, 2 \, 3 /.
  // Every building owns a lot: its own cells plus a one-cell path on two sides (the street is part of the
  // building, so lots tile edge to edge). Barricade posts are a single cell with no lot.
  function shape(type, x, y, rot = 0, core = false) {
    const n = SIZE[type], f = n + (LOT_PAD[type] || 0), ax = Math.round(x - (core ? n : f) / 2), ay = Math.round(y - (core ? n : f) / 2), cells = [], lot = [];
    if (type === 'wall') { cells.push([Math.floor(x), Math.floor(y)]); lot.push([Math.floor(x), Math.floor(y)]); }
    else { for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) cells.push([ax + dx, ay + dy]); for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) lot.push([ax + dx, ay + dy]); }
    const xs = cells.map(q => q[0]), ys = cells.map(q => q[1]);
    return { cells, lot, cx: (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy: (Math.min(...ys) + Math.max(...ys) + 1) / 2 };
  }
  function footprint(type, x, y, rot) {
    if (type === 'keep') {
      const cells = [], cx = Math.floor(x), cy = Math.floor(y);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) cells.push(idx(cx + dx, cy + dy));
      return cells;
    }
    return shape(type, x, y, rot, true).cells.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b));
  }
  const lotOf = (type, x, y, rot) => shape(type, x, y, rot, true).lot.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b));
  const nestAlive = r => map.regions[r] && map.regions[r].nest && S.nestAlive[r];
  /** Can `type` go here? x, y: wanted centre (snapped to cells); rot for palisades. */
  function canPlace(type, x, y, rot = 0, opts = {}) {
    if (!SIZE[type]) return { ok: false, reason: 'Unknown building.', cells: [] };
    if (type === 'wall' && CUT.walls) return { ok: false, reason: 'Barricades are gone for now: the Ash-Born just walk round a line.', cells: [] };
    if (type === 'generator' && !G.powerLive()) return { ok: false, reason: 'No one needs a generator: the Haven runs on fire and hand-cranks.', cells: [] };
    if (BUILDINGS[type].tech) { if (keep.level < BUILDINGS[type].keep) return { ok: false, reason: `Raise the Haven Rig to level ${BUILDINGS[type].keep} first.`, cells: [] }; if (S.buildings.some(b => b.type === type)) return { ok: false, reason: `You already have a ${BUILDINGS[type].name}.`, cells: [] }; }
    const { cells, lot, cx, cy } = shape(type, x, y, rot);
    const out = { ok: false, x: cx, y: cy, rot, cells: cells.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)), lot: lot.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)), reason: '' };
    // [road] begin
    { const why = G.road && G.road.placeRule(type, cx, cy); if (why) { out.reason = why; return out; } }
    // [road] end
    if (out.cells.length !== cells.length || out.lot.length !== lot.length) { out.reason = 'Too close to the edge.'; return out; }
    const own = new Set(out.cells);
    for (const i of out.lot) {
      if (S.occ[i] >= 0 || S.res[i] >= 0) { out.reason = 'Another lot is in the way.'; return out; }
      if (!own.has(i) && !PASSABLE[map.terrain[i]]) { out.reason = 'The path round it is blocked.'; return out; }
    }
    for (const i of out.cells) {
      const t = map.terrain[i], r = map.region[i];
      if (r < 0 || !inZone(i)) { out.reason = 'Too far from your base: build near the Haven Rig or your other buildings.'; return out; }
      if (type === 'wall' ? !(t === T.GRASS || t === T.DIRT || t === T.FORD || t === T.FOREST) : !(t === T.GRASS || t === T.DIRT)) { out.reason = type === 'wall' ? 'Barricades need ground, rubble or a ford.' : t === T.FOREST ? 'Rubble in the way. Tap it to clear it first.' : 'Needs open ground.'; return out; }
      if (S.occ[i] >= 0) { out.reason = 'Something is already built here.'; return out; }
      if (map.ramp[i] && type !== 'wall') { out.reason = 'Keep the ramp clear (a barricade can close it).'; return out; }
    }
    for (const reg of map.regions) if (nestAlive(reg.id) && Math.hypot(reg.nest.x - cx, reg.nest.y - cy) < 4) { out.reason = 'Too close to an Inferno Nest.'; return out; }
    if (opts.deep && type !== 'wall' && sealsOff(out.cells)) { out.reason = 'That would close off a space you could not walk out of.'; return out; }
    out.ok = true; return out;
  }
  // the hero walks through palisades (they are the town's gates), but not through other buildings
  const heroOk = i => PASSABLE[map.terrain[i]] && (S.occ[i] < 0 || isWall(S.occ[i])) && !S.sealed[map.region[i]];
  let reachKey = '', reachSet = null;
  function heroReach(extraBlocked) {
    const seen = new Uint8Array(N * N), start = idx(Math.floor(c), Math.floor(c + 3.5)), q = [start]; seen[start] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (!inside(xx, yy)) continue;
        if (Math.abs(xx - c) > 40 || Math.abs(yy - c) > 40) continue;   // only the camp and its surroundings matter
        const j = idx(xx, yy); if (seen[j] || !heroOk(j) || (extraBlocked && extraBlocked.has(j))) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return seen;
  }
  /** would these cells cut off ground that is reachable now? (only claimed land and its border count) */
  function sealsOff(cells) {
    const key = `${S.occVersion}`;
    if (key !== reachKey) { reachKey = key; reachSet = heroReach(null); }
    const block = new Set(cells), after = heroReach(block);
    for (let y = Math.max(0, Math.floor(c) - 41); y < Math.min(N, c + 41); y++) for (let x = Math.max(0, Math.floor(c) - 41); x < Math.min(N, c + 41); x++) { const i = idx(x, y); if (reachSet[i] && !after[i] && !block.has(i)) return true; }
    return false;
  }
  /** cells of a palisade line from one cell to another: 4-connected, so the dead can't slip through corners */
  function lineCells(x0, y0, x1, y1) {
    let x = Math.floor(x0), y = Math.floor(y0); const tx = Math.floor(x1), ty = Math.floor(y1);
    const out = [[x, y]], dx = Math.abs(tx - x), dy = Math.abs(ty - y), sx = Math.sign(tx - x), sy = Math.sign(ty - y);
    let ex = 0, ey = 0;
    for (let k = 0; k < dx + dy && k < 40; k++) {
      // step along whichever axis lags behind the straight line
      if (dx && (ex + 1) / dx <= (ey + 1) / Math.max(1, dy) || !dy) { x += sx; ex++; } else { y += sy; ey++; }
      out.push([x, y]);
    }
    return out;
  }
  function nearWaterAt(x, y) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = Math.floor(x) + dx, yy = Math.floor(y) + dy; if (!inside(xx, yy)) continue;
      const t = map.terrain[idx(xx, yy)]; if (t === T.WATER || t === T.FORD) return true;
    }
    return false;
  }
  function occupy(b) { b.cells = footprint(b.type, b.x, b.y, b.rot).filter(i => S.occ[i] < 0); for (const i of b.cells) S.occ[i] = b.id; b.lot = b.type === 'keep' ? [] : lotOf(b.type, b.x, b.y, b.rot).filter(i => S.res[i] < 0 || S.res[i] === b.id); for (const i of b.lot) S.res[i] = b.id; S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; }
  function vacate(b, keepLot = false) { for (const i of b.cells) if (S.occ[i] === b.id) S.occ[i] = -1; if (!keepLot) for (const i of b.lot || []) if (S.res[i] === b.id) S.res[i] = -1; S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; }
  function placeBuilding(type, x, y, rot, level, id) {
    const b = { id: id ?? S.nextId++, type, level, x, y, rot: type === 'wall' ? rot : 0, r: type === 'wall' ? 0.6 : type === 'tower' ? 0.6 : 1.0,
      hp: G.maxHpOf(type, level), maxHp: G.maxHpOf(type, level), cd: 0, ruined: false, fell: false, nearWater: nearWaterAt(x, y), shotN: 0, rainT: 0 };
    b.built = BUILDINGS[type].buildTime && id === undefined ? 0 : 1;
    if (type === 'house') b.folk = BUILDINGS.house.pop[level - 1];   // a new home comes with its family (raise() and restore adjust this)
    S.buildings.push(b); S.byId.set(b.id, b); occupy(b); dropLive();
    reveal(x, y, type === 'tower' ? 8 : 5);
    ev('build', { id: b.id });
    return b;
  }
  function removeBuilding(b) { vacate(b); S.buildings.splice(S.buildings.indexOf(b), 1); S.byId.delete(b.id); dropLive(); ev('remove', { id: b.id }); }

  // ---------- flow fields ----------
  const isWall = id => { const b = S.byId.get(id); return !!b && b.type === 'wall'; };
  function refreshFlow() {
    if (!S.flowDirty) return;
    S.flow = computeFlow(map.terrain, S.occ, isWall, WALL_COST); S.flowNext = computeNext(map.terrain, S.flow, S.occ);
    S.climb = computeFlow(map.terrain, S.occ, isWall, 0.6); S.climbNext = computeNext(map.terrain, S.climb, S.occ);
    S.flowDirty = false; S.flowVersion = (S.flowVersion || 0) + 1;
  }
  // ---------- the build zone (Red Alert style): you build near the keep and near your own buildings ----------
  // Every home, farm and tower widens it; claimed landmarks give a forward zone; land near a living hive stays off-limits.
  let zoneKey = '', zoneCache = null, reachCache = null;
  const zoneSources = () => {
    const src = [{ x: keep.x, y: keep.y, r: ZONE.keep }];
    for (const b of S.buildings) if (b.type !== 'wall') src.push({ x: b.x, y: b.y, r: ZONE.building });
    for (const l of S.landmarks || []) if (l.owned) src.push({ x: l.x, y: l.y, r: ZONE.landmark });
    return src;
  };
  function zone() {
    const key = `${S.occVersion || 0}|${(S.landmarks || []).filter(l => l.owned).length}|${S.nestAlive.filter(Boolean).length}|${S.sealVersion}`;
    if (key === zoneKey && zoneCache) return zoneCache;
    const z = new Uint8Array(N * N), src = zoneSources();
    for (const q of src) {
      const r2 = q.r * q.r;
      for (let y = Math.max(0, Math.floor(q.y - q.r)); y <= Math.min(N - 1, Math.ceil(q.y + q.r)); y++) for (let x = Math.max(0, Math.floor(q.x - q.r)); x <= Math.min(N - 1, Math.ceil(q.x + q.r)); x++)
        if ((x + 0.5 - q.x) ** 2 + (y + 0.5 - q.y) ** 2 <= r2) z[idx(x, y)] = 1;
    }
    for (const reg of map.regions) if (reg.nest && S.nestAlive[reg.id]) {
      const n = reg.nest, R = ZONE.hiveBlock;
      for (let y = Math.max(0, Math.floor(n.y - R)); y <= Math.min(N - 1, Math.ceil(n.y + R)); y++) for (let x = Math.max(0, Math.floor(n.x - R)); x <= Math.min(N - 1, Math.ceil(n.x + R)); x++)
        if ((x + 0.5 - n.x) ** 2 + (y + 0.5 - n.y) ** 2 <= R * R) z[idx(x, y)] = 0;
    }
    for (let i = 0; i < N * N; i++) if (z[i] && S.sealed[map.region[i]]) z[i] = 0;
    zoneKey = key; zoneCache = z; reachCache = src; S.zoneVersion = (S.zoneVersion || 0) + 1;
    return z;
  }
  const inZone = i => zone()[i] === 1;
  /** how close your base (keep, buildings, landmarks) comes to a point */
  const baseDist = (x, y) => { zone(); let d = Infinity; for (const q of reachCache) d = Math.min(d, Math.hypot(q.x - x, q.y - y) - q.r); return d; };
  /** building whose footprint covers the cell under (x, y), or the keep */
  function buildingAt(x, y) { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return null; const o = S.occ[idx(cx, cy)]; return o >= 0 ? S.byId.get(o) : null; }
  return { nestAlive, canPlace, heroOk, lineCells, occupy, vacate, placeBuilding, removeBuilding, isWall, refreshFlow, zone, inZone, baseDist, buildingAt };
}
