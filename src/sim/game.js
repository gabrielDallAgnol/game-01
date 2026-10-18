// The game rules. No DOM, no three.js: a renderer reads `game.state` and drains
// `game.state.events`; bots and tests drive the same API headlessly.
import { Rng, hashSeed } from './rng.js';
import { generateMap, N, T, PASSABLE, idx, inside, LANDMARKS } from './mapgen.js';
import { computeFlow, computeNext } from './flow.js';
import { BUILDINGS, KEEP, MAX_LEVEL, START, UNLOCKS } from '../content/buildings.js';
import { MOBS, WAVES, TIDE } from '../content/mobs.js';
import { HEROES, MERC, PURSE, TRADES } from '../content/heroes.js';
import { PERKS, FAMILIES, MASTERIES, SYNERGIES, ODDS, REROLL, freshPerkState } from '../content/perks.js';
import { PACKS, PACK_RULES } from '../content/packs.js';
import { createScavenge } from './scavenge.js';
import { createPlanner, FOCI } from './planner.js';
import { WEATHER } from '../content/weather.js';

export const STEP = 1 / 60;
export const PICKS_PER_DAWN = 2;
export const DROPS = { channel: 3, reach: 1.7, life: 2 };   // seconds to open, how close, nights it lasts
export const STREAM = { every: 11, drop: 0.35, min: 3.5, nightMult: 1.6, rage: 4, rageTime: 18, hiveHp: 60 };   // seconds between dead per hive
export const ZONE = { keep: 10, building: 4.5, landmark: 7, hiveBlock: 6, hiveReach: 14 };
export const TOWN_DRAW = { free: 12, per: 0.012 };
export const CREW_NEED = [1, 2, 3];        // people a tower needs at level 1/2/3
const WALL_COST = 6;            // extra path cost of breaking through a palisade
// thresholds calibrated from bot runs (tools/balance.mjs → threat ratio vs outcome)
export const RATING = [[0.3, 'Easy'], [0.55, 'Medium'], [0.8, 'Hard'], [Infinity, 'Impossible']];
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } }
  pop() {
    const k = this.k, v = this.v, top = v[0]; this.lastKey = k[0]; const lk = k.pop(), lv = v.pop();
    if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } }
    return top;
  }
}
const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
const SIZE = { house: 2, farm: 2, tower: 1, wall: 1, workshop: 3, market: 3 };
const LOT_PAD = { house: 1, farm: 1, tower: 1, workshop: 1, market: 1, wall: 0 };   // the path each lot includes   // compact footprints; palisades are single posts, laid in lines
const BIG = 1.6; // mobs at least this size count as "big game"

export function createGame({ seed = 1, biome = 'riverbend', hero = 'warrior', mapSeed, mode = 'packs', clock = true } = {}) {
  if (hero === 'steward') hero = 'merchant';
  const map = generateMap(mapSeed ?? seed, biome);
  const rng = new Rng(hashSeed(seed, 'run'));
  const perkRng = new Rng(hashSeed(seed, 'perks'));
  const HC = HEROES[hero];
  const c = map.town.x;

  const S = {
    seed, biome, map, heroClass: hero, mode, night: 1, phase: 'day', time: 0,
    stock: mode === 'packs' ? { ...PACK_RULES.start } : {}, packs: [],
    gold: START.gold, food: START.food, kills: 0, events: [],
    buildings: [], occ: new Int32Array(N * N).fill(-1), res: new Int32Array(N * N).fill(-1),
    claimed: new Set([0]), nestAlive: map.regions.map(r => !!r.nest), wake: map.regions.map(() => Infinity),
    mobs: [], projectiles: [], chests: [], purses: [], allies: [], nextId: 1, queue: [], qT: 0, purge: null, nightFlags: {},
    P: freshPerkState(), picks: [], pendingPicks: 0, offer: [], offerSource: null, chestsHeld: 0, dawns: 0,
    reroll: { free: REROLL.free, cost: REROLL.base }, trade: null, halfUpgrade: false,
    ability: { cd: 0, hires: 0 }, weather: 'clear', clock, dayT: 0, dayQueue: [], drops: [], survivors: 0, landmarks: map.landmarks.map(l => ({ ...l, owned: false })), seen: new Uint8Array(N * N), seenVersion: 0, builders: clock && HEROES[hero === 'steward' ? 'merchant' : hero].autoBuild ? 'balanced' : null,
    log: [], cur: null, over: false, won: false,
    hero: { x: c, y: c + 3.5, r: 0.4, hp: HC.hp, maxHp: HC.hp, cd: 0, dead: false, respawn: 0, target: null, input: { x: 0, y: 0 }, face: 0, swing: 0, guardT: 0, attacks: 0 },
    flow: null, flowNext: null, climb: null, climbNext: null, flowDirty: true,
    stats: { goldEarned: 0, goldSpent: 0, built: 0, upgraded: 0, killsByKind: {}, killsBy: {}, peakPop: 0, buildingsLost: 0, housesLost: 0, risen: 0,
      regionsClaimed: 0, blessings: 0, chests: 0, bosses: 0, mercsHired: 0, pursesGold: 0, heroDeaths: 0 },
  };

  // first-ring nests wake up one after another
  const ring1 = map.regions.filter(r => r.ring === 1 && r.nest).map(r => r.id);
  rng.shuffle(ring1);
  [1, 2, 4, 6, 8, 10].forEach((n, k) => { if (ring1[k] !== undefined) S.wake[ring1[k]] = n; });
  ring1.slice(6).forEach(id => { S.wake[id] = 12; });

  // ---------- helpers ----------
  const ev = (t, o = {}) => S.events.push({ t, ...o });
  const toast = (msg, kind) => ev('toast', { msg, kind });
  const has = id => (S.P.taken[id] || 0) > 0;
  const combo = (a, b) => has(a) && has(b);
  let mastSet = new Set();
  const mastery = id => mastSet.has(id);
  const mastered = f => !!S.P.mastery[f];
  const isDef = t => t === 'tower' || t === 'wall';
  const earn = g => { S.gold += g; S.stats.goldEarned += Math.max(0, g); };
  const costOf = (type, level = 1) => Math.max(1, Math.floor(BUILDINGS[type].cost[level - 1] * (1 - (HC.discount || 0))) - (isDef(type) ? S.P.defDiscount : S.P.ecoDiscount));
  const buyCost = type => costOf(type) * (S.mode === 'packs' && !BUILDINGS[type].tech ? PACK_RULES.premium : 1);
  const upCostOf = (b) => { const c0 = costOf(b.type, b.level + 1); return S.halfUpgrade ? Math.max(1, Math.ceil(c0 / 2)) : c0; };
  const maxHpOf = (type, level) => Math.round(BUILDINGS[type].hp[level - 1] * (1 + S.P.allHp + (type === 'wall' ? S.P.wallHp : 0)));
  const keepMaxHp = () => Math.round((KEEP.hp[keep.level - 1] + S.P.keepHp) * S.P.keepHpMult);
  const pop = () => S.survivors + S.buildings.reduce((s, b) => s + (b.type === 'house' ? BUILDINGS.house.pop[b.level - 1] : 0), 0);
  const near = (b, type, r) => S.buildings.some(o => o !== b && o.type === type && !o.ruined && Math.hypot(o.x - b.x, o.y - b.y) <= r);
  const hasTech = t => S.buildings.some(b => b.type === t && !b.ruined && b.built >= 1);
  const houseGold = b => BUILDINGS.house.gold[b.level - 1] + S.P.houseGold + (hasTech('market') ? 1 : 0) + (mastery('tycoon') ? 1 : 0) + (has('guarded') && near(b, 'tower', 6) ? 2 : 0) + (combo('guarded', 'bastion') && near(b, 'wall', 3) ? 1 : 0);
  const farmFood = b => BUILDINGS.farm.food[b.level - 1] + S.P.farmFood + (b.nearWater ? 1 : 0);
  const prosper = () => (mastery('prosperity') ? 1.3 : 1);
  const claimedCount = () => S.claimed.size;
  const isBloodMoon = n => n % WAVES.bloodMoonEvery === 0;
  // weather for tonight, rolled at dawn on its own random stream (never on blood moons)
  const weatherRng = new Rng(hashSeed(seed, 'weather'));
  const W8 = () => WEATHER[S.weather] || WEATHER.clear;
  const weatherFor = n => (n === S.night ? W8() : WEATHER.clear);
  function rollWeather(n) {
    if (n < 3 || isBloodMoon(n)) return 'clear';
    const ids = Object.keys(WEATHER); return ids[weatherRng.weighted(ids.map(k => WEATHER[k].odds))];
  }
  let liveCache = null, liveTick = -1;
  const live = () => { if (liveTick !== S.time) { liveCache = S.buildings.filter(b => !b.ruined); liveTick = S.time; } return liveCache; };
  const heroMax = () => Math.round((HC.hp + S.P.heroHp + (mastery('champion') ? 25 : 0)) * S.P.heroHpMult);
  let sc = null;
  const owns = k => S.landmarks.some(l => l.owned && l.kind === k);
  const towerMult = () => (1 + S.P.towerDmg + (sc ? sc.towerBonus() : 0) + (owns('police') ? 0.15 : 0)) * (mastery('deadeye') ? 1.4 : 1);
  const keepMult = () => (1 + S.P.keepDmg) * (mastery('deadeye') ? 1.4 : 1);
  const upkeep = () => Math.max(0, S.buildings.reduce((a, b) => a + ((BUILDINGS[b.type].upkeep || [])[b.level - 1] || 0), 0) - S.P.upkeepCut * 2);
  const foodNeed = () => Math.ceil(pop() * START.foodPerCitizen);
  const syncPicks = () => { S.pendingPicks = S.picks.length; };

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
    if (BUILDINGS[type].tech) { if (keep.level < BUILDINGS[type].keep) return { ok: false, reason: `Raise the keep to level ${BUILDINGS[type].keep} first.`, cells: [] }; if (S.buildings.some(b => b.type === type)) return { ok: false, reason: `You already have a ${BUILDINGS[type].name}.`, cells: [] }; }
    const { cells, lot, cx, cy } = shape(type, x, y, rot);
    const out = { ok: false, x: cx, y: cy, rot, cells: cells.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)), lot: lot.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)), reason: '' };
    if (out.cells.length !== cells.length || out.lot.length !== lot.length) { out.reason = 'Too close to the edge.'; return out; }
    const own = new Set(out.cells);
    for (const i of out.lot) {
      if (S.occ[i] >= 0 || S.res[i] >= 0) { out.reason = 'Another lot is in the way.'; return out; }
      if (!own.has(i) && !PASSABLE[map.terrain[i]]) { out.reason = 'The path round it is blocked.'; return out; }
    }
    for (const i of out.cells) {
      const t = map.terrain[i], r = map.region[i];
      if (r < 0 || !inZone(i)) { out.reason = 'Too far from your base: build near the keep or your other buildings.'; return out; }
      if (type === 'wall' ? !(t === T.GRASS || t === T.DIRT || t === T.FORD || t === T.FOREST) : !(t === T.GRASS || t === T.DIRT)) { out.reason = type === 'wall' ? 'Barricades need ground, rubble or a ford.' : t === T.FOREST ? 'Rubble in the way. Tap it to clear it first.' : 'Needs open ground.'; return out; }
      if (S.occ[i] >= 0) { out.reason = 'Something is already built here.'; return out; }
      if (map.ramp[i] && type !== 'wall') { out.reason = 'Keep the ramp clear (a barricade can close it).'; return out; }
    }
    for (const reg of map.regions) if (nestAlive(reg.id) && Math.hypot(reg.nest.x - cx, reg.nest.y - cy) < 4) { out.reason = 'Too close to a nest.'; return out; }
    if (opts.deep && type !== 'wall' && sealsOff(out.cells)) { out.reason = 'That would close off a space you could not walk out of.'; return out; }
    out.ok = true; return out;
  }
  // the hero walks through palisades (they are the town's gates), but not through other buildings
  const heroOk = i => PASSABLE[map.terrain[i]] && (S.occ[i] < 0 || isWall(S.occ[i]));
  let reachKey = '', reachSet = null;
  function heroReach(extraBlocked) {
    const seen = new Uint8Array(N * N), start = idx(Math.floor(c), Math.floor(c + 3.5)), q = [start]; seen[start] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (!inside(xx, yy)) continue;
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
    for (let i = 0; i < N * N; i++) if (reachSet[i] && !after[i] && !block.has(i)) return true;
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
  function vacate(b) { for (const i of b.cells) if (S.occ[i] === b.id) S.occ[i] = -1; for (const i of b.lot || []) if (S.res[i] === b.id) S.res[i] = -1; S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; }

  const mobById = new Map();
  const keep = { id: 0, type: 'keep', x: c, y: c, r: 2.3, level: 1, hp: KEEP.hp[0], maxHp: KEEP.hp[0], cd: 0, ruined: false, cells: [], boltT: 3 };
  S.keep = keep; S.byId = new Map([[0, keep]]);
  occupy(keep);

  // ---------- the shroud: the city starts dark; you, your buildings and your land reveal it ----------
  function reveal(x, y, r) {
    const r2 = r * r; let changed = false;
    for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(N - 1, Math.ceil(y + r)); yy++) for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(N - 1, Math.ceil(x + r)); xx++) {
      const i = idx(xx, yy); if (S.seen[i]) continue;
      if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r2) { S.seen[i] = 1; changed = true; }
    }
    if (changed) S.seenVersion++;
  }
  function revealRegion(r) { for (let i = 0; i < N * N; i++) if (map.region[i] === r) S.seen[i] = 1; S.seenVersion++; }
  function placeBuilding(type, x, y, rot, level, id) {
    const b = { id: id ?? S.nextId++, type, level, x, y, rot: type === 'wall' ? rot : 0, r: type === 'wall' ? 0.6 : type === 'tower' ? 0.6 : 1.0,
      hp: maxHpOf(type, level), maxHp: maxHpOf(type, level), cd: 0, ruined: false, fell: false, nearWater: nearWaterAt(x, y), shotN: 0, rainT: 0 };
    b.built = BUILDINGS[type].buildTime && id === undefined ? 0 : 1;
    S.buildings.push(b); S.byId.set(b.id, b); occupy(b); liveTick = -1;
    reveal(x, y, type === 'tower' ? 8 : 5);
    ev('build', { id: b.id });
    return b;
  }
  function removeBuilding(b) { vacate(b); S.buildings.splice(S.buildings.indexOf(b), 1); S.byId.delete(b.id); liveTick = -1; ev('remove', { id: b.id }); }

  // ---------- flow fields ----------
  const isWall = id => { const b = S.byId.get(id); return !!b && b.type === 'wall'; };
  function refreshFlow() {
    if (!S.flowDirty) return;
    S.flow = computeFlow(map.terrain, S.occ, isWall, WALL_COST); S.flowNext = computeNext(map.terrain, S.flow, S.occ);
    S.climb = computeFlow(map.terrain, S.occ, isWall, 0.6); S.climbNext = computeNext(map.terrain, S.climb, S.occ);
    S.flowDirty = false; S.flowVersion = (S.flowVersion || 0) + 1;
  }

  // ---------- regions & nests ----------
  const edgeSpawns = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    for (let r = 29; r > 14; r -= 0.5) {
      const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r, i = idx(Math.floor(x), Math.floor(y));
      if (map.reach[i]) { edgeSpawns.push({ x, y }); break; }
    }
  }
  S.edgeSpawns = edgeSpawns;
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
    const key = `${S.occVersion || 0}|${(S.landmarks || []).filter(l => l.owned).length}|${S.nestAlive.filter(Boolean).length}`;
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
    zoneKey = key; zoneCache = z; reachCache = src; S.zoneVersion = (S.zoneVersion || 0) + 1;
    return z;
  }
  const inZone = i => zone()[i] === 1;
  /** how close your base (keep, buildings, landmarks) comes to a point */
  const baseDist = (x, y) => { zone(); let d = Infinity; for (const q of reachCache) d = Math.min(d, Math.hypot(q.x - x, q.y - y) - q.r); return d; };
  // a hive notices you once your base comes within reach of it
  const adjacentToClaimed = r => { const n = map.regions[r].nest; return !!n && baseDist(n.x, n.y) <= ZONE.hiveReach; };
  function activeNests(n = S.night) {
    return map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id) && adjacentToClaimed(r.id) && S.wake[r.id] <= n).map(r => r.id);
  }
  // pacing: near hives need a level 2 keep, far ones level 3
  const keepForRing = ring => Math.min(MAX_LEVEL, 1 + Math.max(1, ring));
  function canPurge(r) {
    const reg = map.regions[r];
    return S.phase === 'day' && reg && reg.nest && S.nestAlive[r] && !S.claimed.has(r) && adjacentToClaimed(r) && keep.level >= keepForRing(reg.ring);
  }

  // ---------- threat estimate (shared by the purge rating, the log and bots) ----------
  function unlocked(n) { return Object.entries(MOBS).filter(([, m]) => m.weight > 0 && m.from <= n); }
  function hpPerBudget(n) {
    const u = unlocked(n), w = u.reduce((a, [, m]) => a + m.weight, 0);
    const hp = u.reduce((a, [, m]) => a + m.weight * m.hp, 0) / w, cost = u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / w;
    return hp / cost;
  }
  // first blood moon brings a nest guardian; from night 10 the Gravelord walks, one more every 10 nights
  function bossesFor(n) { return n < 10 ? ['guardian'] : Array.from({ length: Math.floor(n / 10) }, () => 'gravelord'); }
  const territory = () => (S.P.greed ? 1 + 0.25 * (claimedCount() - 1) : WAVES.territory(claimedCount()));
  // a bigger town draws more dead: +1% per citizen past the first 15
  // noise: people, homes, workshops and gunfire carry; the louder the town, the more dead it draws
  const NOISE = { house: 1, farm: 0.5, tower: 1.5, wall: 0.1, workshop: 2, market: 1 };
  const noise = () => pop() * 0.5 + S.buildings.reduce((a, b) => a + (NOISE[b.type] || 0) * (b.type === 'wall' ? 1 : b.level), 0);
  const townDraw = () => 1 + Math.max(0, noise() - TOWN_DRAW.free) * TOWN_DRAW.per;
  function nightBudget(n) { return WAVES.budget(n) * (TIDE.opening[n] ?? 1) * territory() * townDraw() * (isBloodMoon(n) ? WAVES.bloodMoonMult(n) : 1) * weatherFor(n).dead; }
  function purgeBudget(r, n) { return WAVES.budget(n) * WAVES.purgeShare(map.regions[r].ring); }
  function towerStats(b) {
    const B = BUILDINGS.tower, l = b.level - 1;
    let range = (B.range[l] + S.P.towerRange + (owns('eiffel') ? 1.5 : 0) + (has('watch') && b.paired ? 2 : 0) + (map.high[idx(Math.floor(b.x), Math.floor(b.y))] ? 2 : 0)) * (S.phase === 'night' ? W8().range : 1);
    let dmg = B.dmg[l] * towerMult() * (has('bastion') && b.walled ? 1.4 : 1);
    let rate = B.rate[l] / S.P.towerRate;
    if (S.P.kingpin && S.bountyT > 0 && !S.hero.dead && Math.hypot(S.hero.x - b.x, S.hero.y - b.y) < 9) rate /= 1.4;
    const h = S.hero, rallyR = combo('rally', 'watch') ? 8 : 5;
    if (has('rally') && !h.dead && (Math.hypot(h.x - b.x, h.y - b.y) < rallyR || (combo('rally', 'watch') && b.paired))) rate /= 1.3;
    return { range, dmg, rate, shots: has('volley') && b.level === 3 ? 2 : 1 };
  }
  // towers are manned by people from your homes, oldest tower first; a tower without its full crew stays silent
  let crewKey = -1, crewCache = null;
  function crewing() {
    const key = (S.occVersion || 0) * 1000 + (S.phase === 'night' ? 1 : 0);
    if (S.phase === 'night' && crewCache && crewCache.night === S.night) return crewCache;   // posts are fixed for the night
    if (key === crewKey && crewCache) return crewCache;
    let free = pop(); const manned = new Set(); let need = 0;
    for (const b of S.buildings.filter(x => x.type === 'tower').sort((a, c) => a.id - c.id)) { const n = CREW_NEED[b.level - 1]; need += n; if (free >= n) { manned.add(b.id); free -= n; } }
    crewKey = key; crewCache = { manned, free, need, people: pop(), night: S.phase === 'night' ? S.night : null };
    return crewCache;
  }
  const manned = b => crewing().manned.has(b.id);
  function cacheNeighbours() {
    for (const b of S.buildings) if (b.type === 'tower') { b.paired = near(b, 'tower', 4); b.walled = near(b, 'wall', 3); }
  }
  function defenceDps() {
    cacheNeighbours();
    let d = 0;
    for (const b of live()) if (b.type === 'tower' && manned(b)) { const t = towerStats(b); d += t.dmg * t.shots / t.rate; }
    if (!keep.ruined) d += KEEP.dmg[keep.level - 1] * keepMult() * S.P.keepRate / KEEP.rate * KEEP.shots[keep.level - 1] + (has('ballista') ? 8 / 3 * 2 : 0);
    return d;
  }
  function heroDmg() { return HC.attack ? (HC.attack.dmg + S.P.heroDmg + (mastery('whirlwind') ? 1 : 0)) * S.P.heroDmgMult : 0; }
  function heroRate() { return HC.attack ? HC.attack.rate / S.P.heroRate / (mastery('champion') ? 1.3 : 1) : 1; }
  function heroDps() {
    if (!HC.attack) return HC.ability && HC.ability.id === 'hire' ? Math.min(4, Math.floor(S.gold / 15)) * MERC.dmg / MERC.rate : 0;
    return heroDmg() / heroRate() * (mastery('whirlwind') ? 1.6 : has('wardance') ? 1.25 : 1);
  }
  /** expected wave HP divided by what the town can deal over the wave window */
  function threatRatio(n = S.night, purgeRegion = S.purge) {
    const hs = WAVES.hpScale(n);
    let hp = nightBudget(n) * hpPerBudget(n) * hs;
    if (isBloodMoon(n)) hp += bossesFor(n).reduce((a, k) => a + MOBS[k].hp, 0) * hs;
    if (purgeRegion !== null && purgeRegion !== undefined) hp += purgeBudget(purgeRegion, n) * hpPerBudget(n) * hs + MOBS.guardian.hp * hs;
    const dealt = (defenceDps() + heroDps() * 0.8) * WAVES.duration(n) * 1.6;
    return hp / Math.max(1, dealt);
  }
  const ratingOf = ratio => RATING.find(([lim]) => ratio < lim)[1];

  // ---------- waves ----------
  function makeWave(n) {
    const nests = activeNests(n);
    if (n === 1 && S.purge === null && nests.length) return [{ kind: 'walker', nest: nests[0], t: 3, first: true }];
    if (!nests.length) { const any = map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id)); if (any.length) nests.push(any[0].id); }
    // the whole valley is yours: the dead now come out of the dark woods at the edge
    if (!nests.length) edgeSpawns.forEach((_, k) => nests.push(-1 - k));
    const wts = nests.map(r => (S.wake[r] === n && n > 1 ? 0.5 : 1));
    const u = unlocked(n), list = [];
    let budget = nightBudget(n);
    while (budget > 0.5) {
      const ok = u.filter(([, m]) => m.cost <= budget + 0.3); if (!ok.length) break;
      const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))];
      list.push({ kind, nest: nests[rng.weighted(wts)] }); budget -= m.cost;
    }
    const dur = WAVES.duration(n), surges = WAVES.surges(n);
    const q = list.map((e, k) => ({ ...e, t: Math.floor(k * surges / list.length) / surges * dur + rng.range(0, 2.5) }));
    if (isBloodMoon(n)) for (const kind of bossesFor(n)) q.push({ kind, nest: nests[rng.int(nests.length)], t: dur * 0.6 + rng.range(0, 6) });
    if (S.purge !== null) {
      let pb = purgeBudget(S.purge, n);
      const last = dur * (surges - 1) / surges;
      while (pb > 0.5) { const ok = u.filter(([, m]) => m.cost <= pb + 0.3); if (!ok.length) break; const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))]; q.push({ kind, nest: S.purge, t: last + rng.range(0, 4) }); pb -= m.cost; }
      q.push({ kind: 'guardian', nest: S.purge, t: last + 2 });
    }
    return q.sort((a, b) => a.t - b.t);
  }

  function spawnMob(kind, x, y, opts = {}) {
    const m = MOBS[kind], hs = WAVES.hpScale(S.night);
    const hp = m.fixedHp ? m.hp : Math.ceil(m.hp * hs);
    const mob = { id: S.nextId++, kind, x, y, hp, maxHp: hp, cd: rng.range(0, 0.5), speed: m.speed * rng.range(0.9, 1.1), boost: 1, rise: opts.instant ? 1 : 0, face: 0, attacking: false, summonT: m.summon ? m.summon.every : 0, tauntT: 0, burn: null };
    S.mobs.push(mob); mobById.set(mob.id, mob); ev('spawn', { id: mob.id, kind });
    return mob;
  }
  function spawnAtNest(kind, r) {
    const n = r < 0 ? edgeSpawns[-1 - r] : map.regions[r].nest;
    for (let k = 0; k < 8; k++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(0, 1.8), x = n.x + Math.cos(a) * d, y = n.y + Math.sin(a) * d;
      if (inside(Math.floor(x), Math.floor(y)) && PASSABLE[map.terrain[idx(Math.floor(x), Math.floor(y))]] && S.occ[idx(Math.floor(x), Math.floor(y))] < 0) return spawnMob(kind, x, y);
    }
    return spawnMob(kind, n.x, n.y);
  }

  // ---------- combat ----------
  function damageBuilding(b, d, by) {
    if (b.ruined || d <= 0) return;
    S.cur.taken[b.type] = (S.cur.taken[b.type] || 0) + Math.min(d, b.hp);
    b.hp -= d; ev('hitB', { id: b.id });
    if (b.type === 'wall' && by && mastery('fortress')) hitMob(by, d * 0.5, 'thorns');
    if (b.hp <= 0) ruin(b);
  }
  function ruin(b) {
    if (b.type === 'keep' && has('bell') && !S.P.bellUsed) {
      S.P.bellUsed = true; b.hp = Math.round(b.maxHp * 0.3);
      for (const m of [...S.mobs]) if (Math.hypot(m.x - b.x, m.y - b.y) < 8) hitMob(m, 20, 'keep');
      ev('bell'); toast('The Bell of Last Light rings. The keep holds.', 'good'); return;
    }
    b.ruined = true; b.fell = true; b.hp = 0; vacate(b); liveTick = -1; ev('ruin', { id: b.id });
    if (b.type === 'keep') { endRun(false); return; }
    S.cur.lost.push(b.type); S.stats.buildingsLost++;
    if (has('salvage')) earn(combo('salvage', 'mortar') ? 4 : 2);
    if (b.type === 'house') {
      const n = BUILDINGS.house.pop[b.level - 1] / 2; S.cur.risen += n; S.stats.risen += n; S.stats.housesLost++;
      for (let k = 0; k < n; k++) { const m = spawnMob('risen', b.x + rng.range(-1, 1), b.y + rng.range(-1, 1), { instant: false }); m.rise = 0.4; }
      toast(`A house fell. ${n === 1 ? 'Its family rises' : 'Its families rise'} with the dead.`, 'bad');
    } else toast(`${BUILDINGS[b.type].name} destroyed. It will be rebuilt at dawn.`, 'bad');
  }
  function hitMob(m, d, src) {
    if (m.hp <= 0) return;
    if (src === 'hero' && has('execute') && (m.hp - d) / m.maxHp < 0.25) d = m.hp;
    if (src === 'hero' && S.P.mark) m.markT = 4;
    if (src === 'tower' && m.markT > 0) d *= 1.3;
    S.cur.dmg[src] = (S.cur.dmg[src] || 0) + Math.min(d, m.hp);
    m.hp -= d; ev('hitM', { id: m.id });
    if (m.hp <= 0) { S.cur.kills[src] = (S.cur.kills[src] || 0) + 1; S.stats.killsBy[src] = (S.stats.killsBy[src] || 0) + 1; killMob(m, src); }
  }
  function killMob(m, src) {
    const i = S.mobs.indexOf(m); if (i < 0) return;
    S.mobs.splice(i, 1); mobById.delete(m.id); S.kills++; ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y });
    if (S.bountyT > 0 && HC.ability && HC.ability.id === 'bounty' && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) <= HC.ability.radius + S.P.bountyRadius) {
      const big = MOBS[m.kind].size >= BIG, pay = (big ? HC.ability.bigGold * (mastery('warband') ? 3 : 1) : HC.ability.gold) + S.P.bountyGold;
      earn(pay); S.stats.bountyGold = (S.stats.bountyGold || 0) + pay; ev('bountyGold', { x: m.x, y: m.y, gold: pay });
    }
    S.stats.killsByKind[m.kind] = (S.stats.killsByKind[m.kind] || 0) + 1;
    if (m.kind === 'guardian' || m.kind === 'gravelord') S.stats.bosses++;
    const D = MOBS[m.kind];
    if (S.P.lifesteal && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 6) S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp + S.P.lifesteal);
    if (S.P.bounty && S.kills % 3 === 0) earn(1);
    if (src === 'hero' && combo('blood', 'bounty')) earn(1);
    if (D.burst) { liveTick = -1; explode(m.x, m.y, D.burst); }
    if (D.dropsChest && rng.chance(D.dropsChest)) { const ch = { id: S.nextId++, x: m.x, y: m.y }; S.chests.push(ch); ev('chest', { id: ch.id }); toast('Something dropped a chest. Walk over it.', 'good'); }
    if (HC.collects && m.kind !== 'risen') {
      const big = PURSE.value[m.kind];
      if (big || rng.chance(PURSE.chance * S.P.purseChance)) { const p = { id: S.nextId++, x: m.x, y: m.y, life: PURSE.life, value: ((big || PURSE.value.default) + S.P.purseBonus) * (mastery('tycoon') ? 2 : 1) }; S.purses.push(p); ev('purse', { id: p.id }); }
    }
  }
  function explode(x, y, burst) {
    ev('explode', { x, y, r: burst.radius });
    const dmg = burst.dmg * Math.sqrt(WAVES.hpScale(S.night));
    for (const b of live().concat(keep.ruined ? [] : [keep])) if (Math.hypot(b.x - x, b.y - y) < burst.radius + b.r) damageBuilding(b, dmg);
    if (!S.hero.dead && Math.hypot(S.hero.x - x, S.hero.y - y) < burst.radius) hurtHero(dmg * 0.5);
    for (const a of S.allies) if (Math.hypot(a.x - x, a.y - y) < burst.radius) a.hp -= dmg;
  }
  function hurtHero(d) {
    const h = S.hero; if (h.dead) return;
    if (h.guardT > 0) d *= 1 - HC.ability.guard;
    if (has('last') && !S.nightFlags.lastUsed && h.hp - d < h.maxHp * 0.3) { S.nightFlags.lastUsed = true; S.nightFlags.lastT = 4; ev('lastStand'); toast('Last Stand!', 'good'); }
    S.cur.taken.hero = (S.cur.taken.hero || 0) + d; h.hp -= d; ev('hitH');
    if (S.nightFlags.lastT > 0 && h.hp < 1) h.hp = 1;
    if (h.hp <= 0) { h.dead = true; h.respawn = 6; h.target = null; S.cur.heroDeaths++; S.stats.heroDeaths++; ev('heroDie'); toast('You fell. Back at the keep in 6 seconds.', 'bad'); }
  }
  function fire(from, x0, y0, target, dmg, src, speed = 18, extra = {}) {
    if (src !== 'hero' && has('hunter') && MOBS[target.kind] && MOBS[target.kind].size >= BIG) dmg *= 1.6;
    const p = { id: S.nextId++, x: x0, y: y0, z: from, target: target.id, tx: target.x, ty: target.y, dmg, src, speed, life: 2, enemy: false, ...extra };
    S.projectiles.push(p); ev('shot', { id: p.id, src });
  }
  function spit(m, target) {
    const tid = target === S.hero ? 'hero' : target.ally ? `a${target.id}` : target.id;
    const p = { id: S.nextId++, x: m.x, y: m.y, z: 1, target: tid, tx: target.x, ty: target.y, dmg: MOBS.spitter.dmg, src: 'spit', speed: 9, life: 2, enemy: true };
    S.projectiles.push(p); ev('shot', { id: p.id, src: 'spit' });
  }

  // ---------- day actions ----------
  /** build(type, x, y, rot) — or the older form build(lotId, type) using a suggested lot from the map */
  function build(a, b, c2, rot) {
    let type, x, y;
    if (typeof a === 'number' && typeof b === 'string') { const lot = map.slots[a]; if (!lot) return fail('No such lot.'); type = b; x = lot.x; y = lot.y; rot = rot ?? lotRot(lot, type); }
    else { type = a; x = b; y = c2; }
    if (S.phase !== 'day' || S.over) return fail('Build during the day.');
    const p = canPlace(type, x, y, rot || 0, { deep: true }); if (!p.ok) return fail(p.reason);
    if (!pay(type)) return false;
    S.cur.built.push(type); S.stats.built++;
    placeBuilding(type, p.x, p.y, p.rot, 1);
    unstickHero();
    return true;
  }
  function pay(type) {
    if ((S.stock[type] || 0) > 0) { S.stock[type]--; return true; }
    const cost = buyCost(type); if (S.gold < cost) return fail(S.mode === 'packs' ? `None left in your packs. Buying one costs ${cost} gold.` : 'Not enough gold.');
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; return true;
  }
  /** how many palisade posts you can still lay: stock first, then gold */
  function wallBudget() { return (S.stock.wall || 0) + Math.floor(S.gold / buyCost('wall')); }
  /** lay a palisade line between two cells; skips cells that don't fit, stops when you run out. Returns posts laid. */
  function buildLine(x0, y0, x1, y1, max = Infinity) {
    if (S.phase !== 'day' || S.over) return fail('Build during the day.') && 0;
    let n = 0;
    for (const [x, y] of lineCells(x0, y0, x1, y1)) {
      if (n >= max) break;
      const p = canPlace('wall', x + 0.5, y + 0.5, 0); if (!p.ok) continue;
      if ((S.stock.wall || 0) <= 0 && S.gold < buyCost('wall')) { if (!n) fail(`A barricade post costs ${buyCost('wall')} gold.`); break; }
      pay('wall'); S.cur.built.push('wall'); S.stats.built++; placeBuilding('wall', p.x, p.y, 0, 1); n++;
    }
    if (n) unstickHero();
    return n;
  }
  /** the palisade posts joined to this one (same level), nearest first */
  function wallRun(id) {
    const b0 = S.byId.get(id); if (!b0 || b0.type !== 'wall') return [];
    const out = [b0], seen = new Set([b0.id]);
    for (let h = 0; h < out.length; h++) {
      const b = out[h], x = Math.floor(b.x), y = Math.floor(b.y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!inside(x + dx, y + dy)) continue;
        const o = S.byId.get(S.occ[idx(x + dx, y + dy)]);
        if (o && o.type === 'wall' && !seen.has(o.id) && o.level === b0.level && !o.ruined) { seen.add(o.id); out.push(o); }
      }
    }
    return out;
  }
  /** upgrade a whole palisade line at once, as far as your gold goes. Returns posts upgraded. */
  function upgradeWall(id) {
    if (S.phase !== 'day' || S.over) return fail('Upgrade during the day.') && 0;
    const run = wallRun(id); if (!run.length || run[0].level >= MAX_LEVEL) return fail('Cannot upgrade.') && 0;
    if (run[0].level + 1 === 3 && !hasTech('workshop')) return fail('Concrete barricades need a Workshop.') && 0;
    if (run[0].level >= keep.level) return fail(`Raise the keep first: nothing grows past the keep (level ${keep.level}).`) && 0;
    let n = 0;
    for (const b of run) {
      const cost = upCostOf(b); if (S.gold < cost) break;
      S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; S.stats.upgraded++; S.halfUpgrade = false; raise(b); n++;
    }
    if (n) S.cur.upgraded.push(`wall${run[0].level + 1}×${n}`); else fail('Not enough gold.');
    return n;
  }
  // a palisade on a suggested lot runs across the way to the keep
  function lotRot(lot, type) { if (type !== 'wall') return 0; const a = Math.atan2(lot.y - c, lot.x - c), q = ((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4; return [1, 3, 0, 2][q]; }
  function upgrade(id) {
    if (S.phase !== 'day' || S.over) return fail('Upgrade during the day.');
    const b = S.byId.get(id); if (!b || b.type === 'keep' || b.level >= (BUILDINGS[b.type].maxLevel || MAX_LEVEL)) return fail('Cannot upgrade.');
    if (b.level + 1 === 3 && UNLOCKS[b.type] && !hasTech(UNLOCKS[b.type])) return fail(`Level 3 needs a ${BUILDINGS[UNLOCKS[b.type]].name}.`);
    if (b.level >= keep.level) return fail(`Raise the keep first: nothing grows past the keep (level ${keep.level}).`);
    const cost = upCostOf(b); if (S.gold < cost) return fail('Not enough gold.');
    S.gold -= cost; S.halfUpgrade = false; S.cur.spent += cost; S.cur.upgraded.push(`${b.type}${b.level + 1}`); S.stats.upgraded++; S.stats.goldSpent += cost;
    raise(b); return true;
  }
  function raise(b) { removeBuilding(b); const nb = placeBuilding(b.type, b.x, b.y, b.rot, b.level + 1, b.id); nb.hp = Math.min(nb.maxHp, nb.hp); return nb; }
  function demolish(id) {
    if (S.phase !== 'day' || S.over) return fail('Demolish during the day.');
    const b = S.byId.get(id); if (!b || b.type === 'keep') return fail('Cannot demolish that.');
    earn(Math.floor(costOf(b.type) / 2)); removeBuilding(b); return true;
  }
  // ---------- clearing rubble: more room to build, but the dead cross open ground faster ----------
  const RUBBLE_COST = 1;
  function rubbleAt(x, y) {
    const cx = Math.floor(x), cy = Math.floor(y), cells = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = cx + dx, yy = cy + dy; if (!inside(xx, yy)) continue;
      const i = idx(xx, yy), r = map.region[i];
      if (map.terrain[i] === T.FOREST && r >= 0 && inZone(i) && S.occ[i] < 0) cells.push(i);
    }
    return { cells, cost: cells.length * RUBBLE_COST };
  }
  function clearRubble(x, y) {
    if (S.phase !== 'day' || S.over) return fail('Clear rubble during the day.');
    const { cells, cost } = rubbleAt(x, y);
    if (!cells.length) return fail('No rubble on your land here.');
    if (S.gold < cost) return fail(`Clearing this costs ${cost} gold.`);
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost;
    for (const i of cells) map.terrain[i] = T.GRASS;
    S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; S.cleared = (S.cleared || 0) + cells.length;
    ev('clear', { cells });
    return cells.length;
  }
  // ---------- landmarks: walk up to one and pay to claim it ----------
  function landmarkReach(l) { return Math.hypot(S.hero.x - l.x, S.hero.y - l.y) <= l.size / 2 + 2.6; }
  function claimLandmark(id) {
    const l = S.landmarks[id]; if (!l || l.owned) return false;
    const L = LANDMARKS[l.kind];
    if (S.phase !== 'day' || S.over) return fail('Claim landmarks during the day.');
    if (S.hero.dead || !landmarkReach(l)) return fail(`Walk up to the ${L.name} to claim it.`);
    if (S.gold < L.cost) return fail(`Claiming the ${L.name} costs ${L.cost} gold.`);
    S.gold -= L.cost; S.cur.spent += L.cost; S.stats.goldSpent += L.cost;
    l.owned = true; S.occVersion = (S.occVersion || 0) + 1;
    if (l.kind === 'tvtower') { S.seen.fill(1); S.seenVersion++; } else reveal(l.x, l.y, l.kind === 'eiffel' ? 22 : 9);
    ev('landmark', { id }); toast(`The ${L.name} is yours. ${L.desc}`, 'good');
    return true;
  }
  function upgradeKeep() {
    if (S.phase !== 'day' || keep.level >= 3) return fail('Cannot raise the keep.');
    const cost = KEEP.cost[keep.level]; if (S.gold < cost) return fail('Not enough gold.');
    S.gold -= cost; S.cur.spent += cost; S.cur.upgraded.push(`keep${keep.level + 1}`); S.stats.goldSpent += cost;
    keep.level++; const m = keepMaxHp(); keep.hp += m - keep.maxHp; keep.maxHp = m; keep.r = 2.3 * (1 + 0.12 * (keep.level - 1));
    ev('keepUp'); return true;
  }
  function planPurge(r) {
    if (r !== null && map.regions[r] && keep.level < keepForRing(map.regions[r].ring)) return fail(`Raise the keep to level ${keepForRing(map.regions[r].ring)} first.`);
    if (r === null) { S.purge = null; return true; }
    if (!canPurge(r)) return fail('You can only march on a nest next to your land.');
    S.purge = r; return true;
  }
  function fail(msg) { if (!S.quiet) ev('fail', { msg }); return false; }

  function startNight(dusk = false) {
    if (S.phase !== 'day' || S.over || S.pendingPicks > 0 || S.packs.length) return false;
    if (S.clock && !dusk) { const bonus = Math.floor(Math.max(0, TIDE.dayLen - S.dayT) / TIDE.bellGold); if (bonus > 0) { earn(bonus); toast(`You ring the bell early: +${bonus} gold.`, 'good'); } }
    if (dusk) toast('Dusk falls.');
    S.dayQueue = [];
    refreshFlow(); cacheNeighbours();
    S.phase = 'night'; crewCache = null; crewing(); S.queue = makeWave(S.night); S.qT = 0; S.nightFlags = {}; S.ability.hires = 0; S.trade = null;
    for (const b of S.buildings) b.fell = false;
    const purgeReg = S.purge;
    Object.assign(S.cur, {
      goldAtBell: S.gold, pop: pop(), town: townCounts(), defDps: +defenceDps().toFixed(1), heroDps: +heroDps().toFixed(1),
      wave: S.queue.length, waveHp: Math.round(S.queue.reduce((a, q) => a + (MOBS[q.kind].fixedHp ? MOBS[q.kind].hp : Math.ceil(MOBS[q.kind].hp * WAVES.hpScale(S.night))), 0)),
      ratio: +threatRatio(S.night, purgeReg).toFixed(2), purge: purgeReg, nests: activeNests().length, claimed: claimedCount(), bloodMoon: isBloodMoon(S.night),
    });
    sc.nightfall(keep);
    ev('night', { n: S.night, bloodMoon: isBloodMoon(S.night) });
    toast(isBloodMoon(S.night) ? `Blood moon. Night ${S.night} begins.` : `The bell rings. Night ${S.night} begins.`, isBloodMoon(S.night) ? 'bad' : undefined);
    return true;
  }

  // ---------- the low tide: stragglers by day, roaming dead in the wild ----------
  function planDay(n) {
    S.dayT = 0; S.dayQueue = [];
    if (!S.clock) return;
    const share = TIDE.dayShare(n), nests = activeNests(n); if (!share || !nests.length) return;
    const u = unlocked(Math.max(1, n - 2)); let budget = nightBudget(n) * share;
    while (budget > 0.5) {
      const ok = u.filter(([, m]) => m.cost <= budget + 0.3); if (!ok.length) break;
      const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))];
      S.dayQueue.push({ kind, nest: nests[rng.int(nests.length)], t: rng.range(6, TIDE.dayLen - 4) }); budget -= m.cost;
    }
    S.dayQueue.sort((a, b) => a.t - b.t);
  }
  function spawnRoamers() {
    if (!S.clock) return;
    const R = TIDE.roam, have = new Map();
    for (const m of S.mobs) if (m.roam) have.set(m.roam.region, (have.get(m.roam.region) || 0) + 1);
    let total = S.mobs.filter(m => m.roam).length;
    for (const reg of map.regions) {
      if (S.claimed.has(reg.id) || reg.ring < 1) continue;
      const ring = Math.min(2, reg.ring), want = R.perRing[ring] + Math.floor(S.night / 8);
      for (let k = have.get(reg.id) || 0; k < want && total < R.cap; k++) {
        let spot = null;
        for (let t = 0; t < 20 && !spot; t++) {
          const x = reg.x + rng.range(-5, 5), y = reg.y + rng.range(-5, 5), cx = Math.floor(x), cy = Math.floor(y);
          if (inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && map.region[idx(cx, cy)] === reg.id && S.occ[idx(cx, cy)] < 0 && baseDist(x, y) > 8) spot = { x, y };
        }
        if (!spot) break;
        const kind = ring >= 2 ? rng.pick(S.night >= 6 ? ['walker', 'runner', 'brute'] : ['walker', 'runner']) : 'walker';
        const m = spawnMob(kind, spot.x, spot.y, { instant: true });
        const tough = 1 + 0.6 * (ring - 1); m.hp = m.maxHp = Math.ceil(m.maxHp * tough);
        m.roam = { x: spot.x, y: spot.y, region: reg.id }; total++;
      }
    }
  }
  function clearRoamers(region) {
    for (const m of S.mobs.filter(q => q.roam && q.roam.region === region)) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y }); }
  }
  /** a roamer wanders near home, chases the hero who comes close, and never walks on the town */
  function stepRoamer(m, dt, speed) {
    const R = TIDE.roam, h = S.hero, home = m.roam;
    // now and then a roamer next to your land drifts in and walks on the town
    if (S.clock && S.night >= 2 && home.region >= 0 && baseDist(home.x, home.y) < 12 && rng.next() < TIDE.drift * dt) { m.roam = null; ev('drift', { id: m.id }); return; }
    const fromHome = Math.hypot(m.x - home.x, m.y - home.y);
    const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
    const heroNear = hd < R.sight && Math.hypot(h.x - home.x, h.y - home.y) < R.leash && !inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    if (heroNear || (m.tauntT > 0 && !h.dead)) {
      m.face = Math.atan2(h.x - m.x, h.y - m.y);
      if (hd > 0.9) moveToward(m, h.x, h.y, speed * dt); else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; hurtHero(MOBS[m.kind].dmg); ev('bite', { id: m.id }); } }
      return;
    }
    if (fromHome > R.leash) { m.wp = { x: home.x, y: home.y }; }
    if (!m.wp || Math.hypot(m.wp.x - m.x, m.wp.y - m.y) < 0.3) {
      if (m.idleT > 0) { m.idleT -= dt; return; }
      const a = rng.range(0, Math.PI * 2), d = rng.range(0.5, R.radius), x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y);
      m.wp = inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && S.occ[idx(cx, cy)] < 0 ? { x, y } : { x: home.x, y: home.y };
      m.idleT = rng.range(1, 4);
    }
    const ox = m.x, oy = m.y; moveToward(m, m.wp.x, m.wp.y, speed * 0.4 * dt);
    const cx = Math.floor(m.x), cy = Math.floor(m.y); if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || S.occ[idx(cx, cy)] >= 0) { m.x = ox; m.y = oy; m.wp = null; }
  }

  // ---------- supply drops: after big nights a crate comes down in the wild, guarded ----------
  const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function compass(x, y) { const a = Math.atan2(x - c, -(y - c)); return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
  function dropSupply(why) {
    if (!S.clock) return;
    let spot = null;
    for (let t = 0; t < 60 && !spot; t++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(16, 26), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y);
      if (!inside(cx, cy)) continue; const i = idx(cx, cy);
      if (!PASSABLE[map.terrain[i]] || !map.reach[i] || S.occ[i] >= 0 || inZone(i) || baseDist(x, y) < 7) continue;
      if (map.regions.some(r => r.nest && S.nestAlive[r.id] && Math.hypot(r.nest.x - x, r.nest.y - y) < 5)) continue;
      spot = { x: cx + 0.5, y: cy + 0.5 };
    }
    if (!spot) return;
    const n = S.night, kinds = ['blueprint', 'cache', 'blessing', 'survivors'];
    const d = { id: S.nextId++, x: spot.x, y: spot.y, reward: kinds[rng.int(kinds.length)], ttl: DROPS.life, prog: 0 };
    S.drops.push(d); reveal(d.x, d.y, 2.5);
    // its guards: tougher than the roamers around them
    const guards = Math.min(7, 3 + Math.floor(n / 4));
    for (let k = 0, tries = 0; k < guards && tries < 60; tries++) {
      const kind = n >= 6 && k === 0 ? 'brute' : rng.pick(n >= 3 ? ['walker', 'runner', 'walker'] : ['walker']);
      const a = rng.range(0, Math.PI * 2), x = d.x + Math.cos(a) * rng.range(0.8, 2.6), y = d.y + Math.sin(a) * rng.range(0.8, 2.6), cx = Math.floor(x), cy = Math.floor(y);
      if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || S.occ[idx(cx, cy)] >= 0) continue;
      k++;
      const m = spawnMob(kind, x, y, { instant: true }); m.hp = m.maxHp = Math.ceil(m.maxHp * 1.5); m.roam = { x: d.x, y: d.y, region: -1 };
    }
    ev('drop', { id: d.id, x: d.x, y: d.y }); toast(`${why} A supply drop came down to the ${compass(d.x, d.y)}. It is guarded. Stand by it for 3 seconds to open it.`, 'good');
  }
  function openDrop(d) {
    S.drops.splice(S.drops.indexOf(d), 1);
    let msg;
    if (d.reward === 'blueprint') { S.stock.tower = (S.stock.tower || 0) + 1; S.stock.house = (S.stock.house || 0) + 1; S.stock.wall = (S.stock.wall || 0) + 6; msg = 'Plans and parts: a free tower, a free home and 6 barricade posts.'; }
    else if (d.reward === 'cache') { const g = 10 + 2 * S.night; earn(g); msg = `A cash box: +${g} gold.`; }
    else if (d.reward === 'blessing') { if (S.phase === 'day') { S.picks.push('chest'); syncPicks(); if (S.picks.length === 1) rollOffer(); } else S.chestsHeld++; msg = 'A sealed case: a rare blessing.'; }
    else { S.survivors += 3; msg = 'Three survivors hiding in the crate join your town (+3 people).'; }
    ev('dropOpen', { id: d.id, x: d.x, y: d.y }); toast(msg, 'good');
  }
  function stepDrops(dt) {
    const h = S.hero;
    for (const d of [...S.drops]) {
      if (!h.dead && Math.hypot(h.x - d.x, h.y - d.y) < DROPS.reach) { d.prog += dt; if (d.prog >= DROPS.channel) openDrop(d); }
      else d.prog = Math.max(0, d.prog - dt * 2);
    }
  }

  function burnHive(r) {
    clearRoamers(r); S.claimed.add(r); revealRegion(r); S.nestAlive[r] = false; S.stats.regionsClaimed++;
    for (const nb of map.regions[r].neighbors) if (map.regions[nb].nest && !S.claimed.has(nb) && S.wake[nb] > S.night + 1) S.wake[nb] = S.night + 1;
    const loot = WAVES.plunder(map.regions[r].ring); earn(loot);
    for (const m of S.mobs) if (m.stream === r) m.stream = -1;
    ev('claim', { region: r }); toast(`The hive burns: +${loot} gold and a rare blessing. New hives stir beyond it.`, 'good');
  }
  // ---------- the stream: the dead never stop coming from awake hives, day and night ----------
  const streamAcc = {}, hiveDmg = {}, rage = {};
  const hiveMax = r => Math.round(STREAM.hiveHp * (1 + 0.6 * (map.regions[r].ring - 1)) * WAVES.hpScale(S.night));
  function stepStream(dt) {
    if (!S.clock || S.night < 2 && !(S.phase === 'night' && S.qT > 15)) return;
    const n = S.night, every = Math.max(STREAM.min, STREAM.every - STREAM.drop * n), mult = S.phase === 'night' ? STREAM.nightMult : 1;
    const nests = new Set(activeNests(n)); for (const r in rage) if (rage[r] > 0) { nests.add(+r); rage[r] -= dt; }
    const u = unlocked(Math.max(1, n - 1));
    for (const r of nests) {
      if (!S.nestAlive[r]) continue;
      streamAcc[r] = (streamAcc[r] || rng.range(0, every)) + dt * mult * (rage[r] > 0 ? STREAM.rage : 1);
      while (streamAcc[r] >= every) {
        streamAcc[r] -= every;
        const [kind] = u[rng.weighted(u.map(([, m]) => m.weight))];
        const m = spawnAtNest(kind, r); m.stream = r;
      }
    }
  }
  /** the hero hits a hive: it bleeds, it rages (pours out the dead), and at zero it burns */
  function hitHive(r, d) {
    const reg = map.regions[r];
    if (keep.level < keepForRing(reg.ring)) { if (!S.nightFlags.keepWarn) { S.nightFlags.keepWarn = true; fail(`This hive is too strong: raise the keep to level ${keepForRing(reg.ring)} first.`); } return false; }
    if (!hiveDmg[r]) { toast('You strike the hive. It wakes and pours out its dead!', 'bad'); if (S.wake[r] > S.night) S.wake[r] = S.night; }
    hiveDmg[r] = (hiveDmg[r] || 0) + d; rage[r] = STREAM.rageTime;
    ev('hitHive', { region: r, hp: Math.max(0, 1 - hiveDmg[r] / hiveMax(r)) });
    if (hiveDmg[r] >= hiveMax(r)) { burnHive(r); S.picks.push('nest'); syncPicks(); if (S.picks.length === 1 && S.phase === 'day') rollOffer(); dropSupply('The hive is ash.'); delete hiveDmg[r]; delete rage[r]; }
    return true;
  }
  const hiveHealth = r => (S.nestAlive[r] ? Math.max(0, 1 - (hiveDmg[r] || 0) / hiveMax(r)) : 0);

  function dawn() {
    S.phase = 'day'; S.dawns++;
    let foodIn = sc.dawnFood(), hg = 0;
    for (const b of S.buildings) { if (b.fell) continue; if (b.type === 'farm') foodIn += farmFood(b); if (b.type === 'house') hg += houseGold(b); }
    foodIn = Math.round(foodIn * prosper() * W8().food);
    S.food += foodIn;
    const need = foodNeed(), fed = need === 0 ? 1 : Math.min(1, S.food / need);
    S.food = Math.max(0, S.food - need);
    const upk = upkeep();
    let goldIn = Math.round((START.baseIncome + S.P.tax + hg * fed) * prosper()) - upk;
    if (has('granary')) goldIn += Math.floor(S.food / 5);
    if (owns('fuel')) goldIn += 4;
    if (owns('tvtower')) goldIn += 3;
    S.gold = Math.max(0, S.gold + goldIn); S.stats.goldEarned += Math.max(0, goldIn);
    let claimedNow = null, nestPick = false;
    if (S.purge !== null) { claimedNow = S.purge; burnHive(S.purge); nestPick = true; S.purge = null; }
    // Merchant Guild: free tower upgrades
    if (has('guild')) {
      let free = Math.floor(S.buildings.filter(b => b.type === 'house').length / 4);
      while (free-- > 0) { const t = S.buildings.filter(b => b.type === 'tower' && b.level < MAX_LEVEL).sort((a, b) => a.level - b.level)[0]; if (!t) break; raise(t); toast('The guild raises a tower for free.', 'good'); }
    }
    closeLog({ goldIn, foodIn, foodNeed: need, fed: +fed.toFixed(2), claimedNow });
    for (const b of [...S.buildings]) { if (b.ruined) { b.ruined = false; b.hp = b.maxHp; occupy(b); ev('rebuild', { id: b.id }); } b.hp = b.maxHp; b.fell = false; }
    liveTick = -1;
    keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * 0.25);
    S.hero.hp = S.hero.maxHp; S.hero.guardT = 0;
    if (S.P.kingpin && S.allies.length) { earn(S.allies.length); for (const a of S.allies) a.hp = a.maxHp; }
    if (S.allies.length && !S.P.loyal) { for (const a of S.allies) ev('allyGone', { id: a.id }); S.allies = []; }
    S.purses = []; S.ability.cd = 0;
    sc.dawn(isBloodMoon(S.night));
    S.night++; newLog();
    S.weather = rollWeather(S.night); if (S.weather !== 'clear') toast(`Tonight: ${W8().name.toLowerCase()}. ${W8().desc}`, W8().kind);
    planDay(S.night); spawnRoamers();
    for (const d of [...S.drops]) if (--d.ttl <= 0) { S.drops.splice(S.drops.indexOf(d), 1); ev('dropGone', { id: d.id }); }
    { const was = S.night - 1; if (isBloodMoon(was)) dropSupply('The blood moon has set.'); else if (claimedNow !== null) dropSupply('With the hive burned,'); else if (was >= 3 && rng.next() < 0.2) dropSupply('At first light,'); }
    S.reroll.cost = REROLL.base;
    const want = [];
    if (S.night % 2 === 0 || owns('christ')) want.push('dawn');              // S.night is already the coming night: a dawn blessing every other day
    if (nestPick) want.push('nest');
    for (let k = 0; k < S.chestsHeld; k++) want.push('chest');
    const keepPicks = Math.max(1, PICKS_PER_DAWN), extra = want.slice(keepPicks).filter(x => x === 'chest').length;
    S.picks.push(...want.slice(0, keepPicks)); S.chestsHeld = 0;
    if (extra) { earn(extra * 5); toast(`${extra} more ${extra === 1 ? 'chest' : 'chests'} sold for ${extra * 5} gold: two blessings a dawn is the most.`, 'good'); }
    syncPicks(); rollOffer();
    rollPacks();
    if (HC.trader) S.trade = { deals: rng.shuffle([...TRADES]).slice(0, 3).map(t => t.id), done: false };
    S.stats.peakPop = Math.max(S.stats.peakPop, pop());
    ev('dawn', { goldIn, foodIn, need, fed });
    toast(`Dawn. ${goldIn >= 0 ? '+' : ''}${goldIn} gold${upk ? ` after ${upk} tower upkeep` : ''}, +${foodIn} food. Citizens ate ${need}.`, 'good');
    if (fed < 1) toast(`Not enough food. Houses earned ${Math.round(fed * 100)}% of their gold.`, 'bad');
  }

  function endRun(won) {
    S.over = true; S.won = won; S.phase = 'over'; closeLog({ result: won ? 'won' : 'lost' });
    S.stats.nights = S.night - 1; S.stats.peakPop = Math.max(S.stats.peakPop, pop());
    ev('over', { won, night: S.night });
  }

  // ---------- abilities ----------
  function abilityCost() { const A = HC.ability; return A.cost ? Math.max(1, A.cost + A.costStep * S.ability.hires - S.P.hireDiscount) : 0; }
  function useAbility(x, y) {
    const A = HC.ability, h = S.hero;
    if (!A || S.over) return false;
    if (!S.mobs.some(m => !m.roam || Math.hypot(m.x - h.x, m.y - h.y) < 10)) return fail('No dead nearby.');
    if (S.ability.cd > 0 || h.dead) return false;
    if (A.id === 'warcry') {
      const rad = A.radius + S.P.abilityRadius;
      for (const m of S.mobs) if (Math.hypot(m.x - h.x, m.y - h.y) < rad && m.kind !== 'gravelord') m.tauntT = A.taunt;
      h.guardT = A.taunt; ev('warcry', { x: h.x, y: h.y, r: rad });
    } else if (A.id === 'volley') {
      let tx = x, ty = y;
      if (tx === undefined || Math.hypot(tx - h.x, ty - h.y) > A.reach) {
        let best = null, bn = 0;
        for (const m of S.mobs) { if (Math.hypot(m.x - h.x, m.y - h.y) > A.reach) continue; const n = S.mobs.filter(o => Math.hypot(o.x - m.x, o.y - m.y) < A.radius).length; if (n > bn) { bn = n; best = m; } }
        if (!best) return fail('No dead in range.');
        tx = best.x; ty = best.y;
      }
      const dmg = A.dmg * S.P.abilityDmg * Math.sqrt(WAVES.hpScale(S.night)), rad = A.radius + S.P.abilityRadius;
      for (const m of [...S.mobs]) if (Math.hypot(m.x - tx, m.y - ty) < rad) hitMob(m, dmg, 'hero');
      ev('volley', { x: tx, y: ty, r: rad });
    } else if (A.id === 'bounty') {
      S.bountyT = A.duration + S.P.bountyTime + (mastery('warband') ? 10 : 0);
      ev('bounty', { t: S.bountyT }); toast('Bounty is on: every kill near you pays gold.', 'good');
    } else if (A.id === 'hire') {
      const cost = abilityCost();
      const count = A.count + S.P.hireExtra + (mastery('warband') ? 2 : 0), max = A.max + (mastery('warband') ? 6 : 0) + S.P.hireExtra * 3;
      if (S.allies.length + count > max) return fail('You cannot pay more sellswords right now.');
      if (S.gold < cost) return fail(`Sellswords cost ${cost} gold.`);
      S.gold -= cost; S.stats.goldSpent += cost; S.ability.hires++; S.stats.mercsHired += count;
      for (let k = 0; k < count; k++) {
        const a = { id: S.nextId++, ally: true, x: h.x + rng.range(-0.8, 0.8), y: h.y + rng.range(-0.8, 0.8), hp: MERC.hp + S.P.mercHp, maxHp: MERC.hp + S.P.mercHp, cd: 0, face: 0, attacking: false };
        S.allies.push(a); ev('ally', { id: a.id });
      }
    }
    S.ability.cd = A.cooldown * S.P.abilityCd * (A.id === 'volley' && mastery('hail') ? 0.5 : 1); return true;
  }

  // ---------- blessings ----------
  function rollOffer() {
    syncPicks();
    if (!S.picks.length) { S.offer = []; S.offerSource = null; return; }
    const source = S.picks[0];
    S.offerSource = source;
    if (source.startsWith('mastery:')) { const fam = source.split(':')[1]; S.offer = MASTERIES[fam].map(m => `m:${m.id}`); return; }
    const pool = PERKS.filter(p => (S.P.taken[p.id] || 0) < p.max && !(FAMILIES[p.fam].hero && FAMILIES[p.fam].hero !== S.heroClass));
    const n = 3 + (source === 'dawn' ? (HC.extraOffer || 0) : 0);
    const odds = ODDS[source] || ODDS.dawn, out = [];
    const want = [];
    for (let k = 0; k < n; k++) {
      let r = perkRng.weighted(odds);
      if (r === 2 && source === 'dawn' && S.night < 10) r = 1;
      want.push(['common', 'rare', 'legendary'][r]);
    }
    if (source === 'chest' && !want.some(r => r !== 'common')) want[0] = 'rare';
    if (source === 'nest' && !want.includes('legendary')) want[0] = 'legendary';
    if (mastery('patronage') && !want.some(r => r !== 'common')) want[0] = 'rare';
    let pacts = 0;
    for (const rar of want) {
      let cands = pool.filter(p => !out.includes(p.id) && p.rarity === rar && !(p.pact && pacts));
      if (!cands.length) cands = pool.filter(p => !out.includes(p.id) && !(p.pact && pacts));
      if (!cands.length) break;
      const pk = cands[perkRng.weighted(cands.map(p => (1 + S.P.fam[p.fam] * 0.6) * (FAMILIES[p.fam].hero ? 2 : p.fam === 'bow' ? 0.7 : 1)))];
      if (pk.pact) pacts++;
      out.push(pk.id);
    }
    S.offer = out;
    if (!out.length) { S.picks.shift(); rollOffer(); }
  }
  function reroll() {
    if (!S.offer.length || S.offerSource.startsWith('mastery:')) return false;
    const cost = S.reroll.free > 0 ? 0 : S.reroll.cost;
    if (S.gold < cost) return fail(`A reroll costs ${cost} gold.`);
    if (S.reroll.free > 0) S.reroll.free--; else { S.gold -= cost; S.reroll.cost += REROLL.step; }
    rollOffer(); return true;
  }
  function choosePerk(id) {
    if (!S.offer.includes(id)) return fail('That blessing is not on offer.');
    if (id.startsWith('m:')) {
      const mid = id.slice(2), fam = S.offerSource.split(':')[1];
      S.P.mastery[fam] = mid; mastSet = new Set(Object.values(S.P.mastery)); S.cur.perks.push(id);
      if (mid === 'champion') S.P.heroRate *= 1;
      toast(`${MASTERIES[fam].find(m => m.id === mid).name}!`, 'good');
    } else {
      const pk = PERKS.find(p => p.id === id);
      pk.fx(S.P); S.P.taken[id] = (S.P.taken[id] || 0) + 1; S.P.fam[pk.fam]++; S.cur.perks.push(id); S.stats.blessings++;
      for (const sy of SYNERGIES) if ((sy.a === id && has(sy.b)) || (sy.b === id && has(sy.a))) toast(`Combo! ${sy.text}`, 'good');
      if (S.P.fam[pk.fam] === 3 && !S.P.mastery[pk.fam] && !(pk.fam === 'hero' && !HC.attack)) S.picks.splice(1, 0, `mastery:${pk.fam}`);
    }
    for (const b of S.buildings) { const m = maxHpOf(b.type, b.level); if (!b.ruined) b.hp += m - b.maxHp; b.maxHp = m; }
    const km = keepMaxHp(); keep.hp = Math.min(km, keep.hp + Math.max(0, km - keep.maxHp)); keep.maxHp = km;
    const hm = heroMax(); S.hero.hp = Math.min(hm, S.hero.hp + Math.max(0, hm - S.hero.maxHp)); S.hero.maxHp = hm;
    S.picks.shift(); rollOffer(); return true;
  }
  function trade(id) {
    if (!S.trade || S.trade.done || !S.trade.deals.includes(id) || S.phase !== 'day') return false;
    const t = TRADES.find(x => x.id === id);
    if (t.gold && S.gold < t.gold) return fail(`That costs ${t.gold} gold.`);
    if (t.food && S.food < t.food) return fail(`You need ${t.food} food.`);
    if (t.gold) { S.gold -= t.gold; S.stats.goldSpent += t.gold; }
    if (id === 'reroll') S.reroll.free++;
    if (id === 'pick') { S.picks.push('dawn'); syncPicks(); if (S.picks.length === 1) rollOffer(); }
    if (id === 'sellfood') { S.food -= t.food; earn(t.give); }
    if (id === 'halfup') S.halfUpgrade = true;
    if (id === 'mend') keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * 0.25);
    S.trade.done = true; toast(`Deal: ${t.name.toLowerCase()}.`, 'good'); return true;
  }

  // ---------- building packs ----------
  function rollPacks() {
    if (S.mode !== 'packs') { S.packs = []; return; }
    const pool = PACKS.filter(p => p.from <= S.night);
    const pick = list => list[rng.weighted(list.map(p => p.weight))];
    const eco = pool.filter(p => p.kind !== 'def'), def = pool.filter(p => p.kind !== 'eco');
    let a = pick(eco), b = pick(def.filter(p => p.id !== a.id));
    if (rng.chance(0.25)) { const other = pool.filter(p => p.id !== a.id); b = pick(other); }
    S.packs = [a.id, b.id];
  }
  function choosePack(id) {
    if (!S.packs.includes(id)) return fail('That pack is not on offer.');
    const pk = PACKS.find(p => p.id === id);
    for (const [t, n] of Object.entries(pk.items)) S.stock[t] = (S.stock[t] || 0) + n;
    S.packs = []; S.cur.pack = id; ev('pack', { id }); return true;
  }
  function rerollPacks() {
    if (!S.packs.length) return false;
    if (S.gold < PACK_RULES.reroll) return fail(`Other packs cost ${PACK_RULES.reroll} gold.`);
    S.gold -= PACK_RULES.reroll; S.stats.goldSpent += PACK_RULES.reroll; rollPacks(); return true;
  }

  // ---------- run log ----------
  function townCounts() { const o = {}; for (const b of S.buildings) o[b.type] = (o[b.type] || 0) + b.level; o.keep = keep.level; return o; }
  function newLog() { S.cur = { night: S.night, goldStart: S.gold, spent: 0, built: [], upgraded: [], perks: [], dmg: {}, kills: {}, taken: {}, lost: [], risen: 0, heroDeaths: 0 }; }
  function closeLog(extra) {
    const l = S.cur; if (!l || l.closed) return; l.closed = true;
    Object.assign(l, { keepEnd: Math.max(0, Math.ceil(keep.hp)), keepMax: keep.maxHp, seconds: Math.round(S.qT) }, extra);
    S.log.push(l);
  }
  newLog();

  // ---------- simulation step ----------
  const walkable = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false; return heroOk(idx(cx, cy)); };
  /** shortest walk to a point, around buildings (8 directions, no squeezing past corners) */
  function heroPath(tx, ty) {
    const h = S.hero, s = idx(Math.floor(h.x), Math.floor(h.y));
    let goal = idx(Math.floor(tx), Math.floor(ty));
    if (!inside(Math.floor(tx), Math.floor(ty))) return null;
    // a clear straight walk needs no planning
    const L = Math.hypot(tx - h.x, ty - h.y), steps = Math.ceil(L / 0.3);
    let clear = true; for (let k = 1; k <= steps && clear; k++) if (!walkable(h.x + (tx - h.x) * k / steps, h.y + (ty - h.y) * k / steps)) clear = false;
    if (clear) return [{ x: tx, y: ty }];
    const dist = new Float32Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1), open = new MinHeap(); open.push(0, s); dist[s] = 0;
    // A* on the grid; the goal may be a building cell: stop at the closest reachable cell
    let best = s, bestD = Math.hypot(tx - h.x, ty - h.y);
    while (open.size) {
      const i = open.pop(); if (open.lastKey > dist[i] + Math.hypot((i % N) + 0.5 - tx, ((i / N) | 0) + 0.5 - ty) + 1e-6) continue;
      const x = i % N, y = (i / N) | 0, dg = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
      if (dg < bestD) { bestD = dg; best = i; }
      if (i === goal || dist[i] > 90) break;
      for (const [dx, dy, len] of DIRS8) {
        const xx = x + dx, yy = y + dy; if (!inside(xx, yy)) continue;
        const j = idx(xx, yy); if (!heroOk(j)) continue;
        if (dx && dy && (!heroOk(idx(x + dx, y)) || !heroOk(idx(x, y + dy)))) continue;
        const nd = dist[i] + len; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; open.push(nd + Math.hypot((j % N) + 0.5 - tx, ((j / N) | 0) + 0.5 - ty), j); }
      }
    }
    const path = []; for (let i = best; i !== s && i >= 0; i = prev[i]) path.push({ x: (i % N) + 0.5, y: ((i / N) | 0) + 0.5 });
    path.reverse();
    if (best === goal && heroOk(goal)) path[path.length - 1] = { x: tx, y: ty };
    return path;
  }
  function unstickHero() {
    const h = S.hero; if (walkable(h.x, h.y)) return;
    for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.floor(h.x) + dx + 0.5, y = Math.floor(h.y) + dy + 0.5; if (walkable(x, y)) { h.x = x; h.y = y; return; }
    }
  }
  function stepHero(dt) {
    const h = S.hero;
    if (h.dead) { h.respawn -= dt; if (h.respawn <= 0) { h.dead = false; h.hp = h.maxHp; h.x = c; h.y = c + 3.5; unstickHero(); ev('heroBack'); } return; }
    h.guardT = Math.max(0, h.guardT - dt);
    if (S.nightFlags.lastT > 0) S.nightFlags.lastT -= dt;
    let dx = h.input.x, dy = h.input.y, moving = false;
    if (dx || dy) { h.target = null; const l = Math.hypot(dx, dy); dx /= l; dy /= l; moving = true; }
    else if (h.target) {
      // follow the planned path; the next waypoint is skipped once we reach it
      if (h.path && h.path.length) { const w = h.path[0]; if (Math.hypot(w.x - h.x, w.y - h.y) < 0.2) h.path.shift(); }
      const w = h.path && h.path.length ? h.path[0] : (h.path ? null : h.target);
      if (!w) { h.target = null; h.path = null; }
      else { dx = w.x - h.x; dy = w.y - h.y; const l = Math.hypot(dx, dy); if (l < 0.15 && !(h.path && h.path.length > 1)) { h.target = null; h.path = null; dx = dy = 0; } else if (l > 1e-4) { dx /= l; dy /= l; moving = true; } }
    }
    if (moving) {
      const sp = HC.speed * S.P.heroSpeed * dt; if (S.P.runHeal) h.hp = Math.min(h.maxHp, h.hp + S.P.runHeal * dt);
      const tryMove = (nx, ny) => { if (!walkable(nx, ny)) return false; h.x = nx; h.y = ny; return true; };
      if (!tryMove(h.x + dx * sp, h.y + dy * sp)) { if (!tryMove(h.x + dx * sp, h.y)) if (!tryMove(h.x, h.y + dy * sp)) { h.target = null; h.path = null; } }
      h.face = Math.atan2(dx, dy); h.moving = true;
    } else h.moving = false;
    h.cd -= dt; h.swing = Math.max(0, h.swing - dt);
    const A = HC.attack;
    if (A && h.cd <= 0) {
      const reach = A.reach + S.P.heroRange, dmg = heroDmg() * (S.nightFlags.lastT > 0 ? 2 : 1);
      let best = null, bd = reach;
      for (const m of S.mobs) { if (m.rise < 1) continue; const d = Math.hypot(m.x - h.x, m.y - h.y) - 0.3 * MOBS[m.kind].size; if (d < bd) { bd = d; best = m; } }
      if (!best) {
        // nothing to fight: strike a hive in reach
        const hv = map.regions.find(r => r.nest && S.nestAlive[r.id] && Math.hypot(r.nest.x - h.x, r.nest.y - h.y) < reach + 1.4);
        if (hv && hitHive(hv.id, dmg)) { h.cd = heroRate(); h.swing = 0.25; h.attacks++; h.face = Math.atan2(hv.nest.x - h.x, hv.nest.y - h.y); ev(A.kind === 'melee' ? 'swing' : 'shot', { src: 'hero' }); }
      }
      if (best) {
        h.cd = heroRate(); h.swing = 0.25; h.attacks++; if (!moving) h.face = Math.atan2(best.x - h.x, best.y - h.y);
        const cleave = mastery('whirlwind') || (has('wardance') && h.attacks % 3 === 0);
        if (A.kind === 'melee') {
          if (cleave) S.mobs.filter(m => Math.hypot(m.x - h.x, m.y - h.y) - 0.3 * MOBS[m.kind].size < reach).forEach(m => hitMob(m, dmg, 'hero'));
          else hitMob(best, dmg, 'hero');
          ev('swing');
        } else {
          const shot = m => fire(1.4, h.x, h.y, m, dmg * (mastery('sniper') && m.hp >= m.maxHp ? 2 : 1), 'hero', 24);
          shot(best);
          if (S.P.pierce) { const behind = S.mobs.find(o => o !== best && o.rise >= 1 && Math.hypot(o.x - best.x, o.y - best.y) < 1.8); if (behind) shot(behind); }
          if (cleave || (S.P.sentinel && !moving && h.attacks % 3 === 0)) for (const m of S.mobs.filter(o => o !== best && Math.hypot(o.x - h.x, o.y - h.y) < reach).slice(0, 2)) shot(m);
        }
      }
    }
    h.hp = Math.min(h.maxHp, h.hp + dt * ((S.phase === 'day' ? (S.P.noDayHeal ? 0 : 3) : S.P.heroRegen) + (owns('clinic') ? 2 : 0)));
    for (const ch of [...S.chests]) {
      if (Math.hypot(ch.x - h.x, ch.y - h.y) > 1.3) continue;
      S.chests.splice(S.chests.indexOf(ch), 1); ev('chestOpen', { id: ch.id }); S.stats.chests++;
      if (S.phase === 'day') { S.picks.push('chest'); syncPicks(); if (S.picks.length === 1) rollOffer(); } else { S.chestsHeld++; toast('Chest opened. Extra blessing at dawn.', 'good'); }
    }
    if (HC.collects) for (const p of [...S.purses]) {
      if (Math.hypot(p.x - h.x, p.y - h.y) > 1.2) continue;
      S.purses.splice(S.purses.indexOf(p), 1); earn(p.value); S.stats.pursesGold += p.value; ev('purseTaken', { id: p.id, value: p.value });
    }
  }
  function stepAllies(dt) {
    const h = S.hero;
    for (const a of [...S.allies]) {
      if (a.hp <= 0) { S.allies.splice(S.allies.indexOf(a), 1); ev('allyGone', { id: a.id, died: true }); continue; }
      a.cd -= dt; a.attacking = false;
      let best = null, bd = Infinity;
      for (const m of S.mobs) { if (m.rise < 1) continue; if (Math.hypot(m.x - h.x, m.y - h.y) > MERC.leash + 2) continue; const d = Math.hypot(m.x - a.x, m.y - a.y); if (d < bd) { bd = d; best = m; } }
      if (best) {
        if (bd > MERC.reach) moveAlly(a, best.x, best.y, MERC.speed * dt);
        else { a.attacking = true; a.face = Math.atan2(best.x - a.x, best.y - a.y); if (a.cd <= 0) { a.cd = MERC.rate; hitMob(best, MERC.dmg + S.P.mercDmg, 'merc'); ev('swingAlly', { id: a.id }); } }
      } else if (Math.hypot(h.x - a.x, h.y - a.y) > 2) moveAlly(a, h.x, h.y, MERC.speed * dt);
    }
  }
  function moveAlly(a, tx, ty, s) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1e-4) return;
    const nx = a.x + dx / d * Math.min(s, d), ny = a.y + dy / d * Math.min(s, d);
    if (walkable(nx, ny)) { a.x = nx; a.y = ny; } else if (walkable(nx, a.y)) a.x = nx; else if (walkable(a.x, ny)) a.y = ny;
    a.face = Math.atan2(dx, dy);
  }

  // spatial hash for mob separation and auras
  const bucket = new Map();
  function stepMobs(dt) {
    const h = S.hero;
    bucket.clear();
    for (const m of S.mobs) { const k = (Math.floor(m.x / 2) << 8) | Math.floor(m.y / 2); let a = bucket.get(k); if (!a) bucket.set(k, a = []); a.push(m); m.boost = 1; }
    for (const s of S.mobs) {
      const au = MOBS[s.kind].aura; if (!au || s.rise < 1) continue;
      const bx = Math.floor(s.x / 2), by = Math.floor(s.y / 2), rr = Math.ceil(au.radius / 2);
      for (let ox = -rr; ox <= rr; ox++) for (let oy = -rr; oy <= rr; oy++) { const a = bucket.get(((bx + ox) << 8) | (by + oy)); if (a) for (const m of a) if (m !== s && Math.abs(m.x - s.x) < au.radius && Math.abs(m.y - s.y) < au.radius) m.boost = au.speed; }
    }
    const targets = live().concat(keep.ruined ? [] : [keep]);
    const walls = has('tar') ? live().filter(b => b.type === 'wall') : [];
    const climbOk = !mastery('fortress');
    for (const m of [...S.mobs]) {
      if (m.hp <= 0) continue;
      const D = MOBS[m.kind];
      if (m.rise < 1) { m.rise = Math.min(1, m.rise + dt * 1.2); continue; }
      if (m.markT > 0) m.markT -= dt;
      const inTar = walls.length && walls.some(w => Math.hypot(w.x - m.x, w.y - m.y) < 3.2);
      if (m.burn) { m.burn.t -= dt; hitMob(m, m.burn.dps * dt * (inTar && combo('tar', 'fire') ? 2 : 1), 'fire'); if (m.burn && m.burn.t <= 0) m.burn = null; if (m.hp <= 0) continue; }
      if (D.summon) { m.summonT -= dt; if (m.summonT <= 0) { m.summonT = D.summon.every; for (let k = 0; k < D.summon.count; k++) spawnMob(D.summon.kind, m.x + rng.range(-1.5, 1.5), m.y + rng.range(-1.5, 1.5)); ev('summon', { id: m.id }); } }
      m.cd -= dt; m.attacking = false; m.tauntT = Math.max(0, m.tauntT - dt);
      const ci = idx(Math.floor(m.x), Math.floor(m.y));
      const speed = m.speed * m.boost * W8().speed * (inTar ? 0.6 : 1) / (map.terrain[ci] === T.FOREST ? 1.4 : map.terrain[ci] === T.FORD ? 1.8 : 1);
      if (m.roam) { stepRoamer(m, dt, speed); continue; }
      const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
      // nearest sellsword
      let ally = null, ad = Infinity;
      for (const a of S.allies) { const d = Math.hypot(a.x - m.x, a.y - m.y); if (d < ad) { ad = d; ally = a; } }
      // spitters stop and spit at the first thing in range
      if (D.range) {
        let tgt = null, td = D.range;
        if (hd < td) { tgt = h; td = hd; }
        if (ad < td) { tgt = ally; td = ad; }
        for (const b of targets) { if (b.ruined) continue; const d = Math.hypot(b.x - m.x, b.y - m.y) - b.r; if (d < td) { td = d; tgt = b; } }
        if (tgt) { m.attacking = true; m.face = Math.atan2(tgt.x - m.x, tgt.y - m.y); if (m.cd <= 0) { m.cd = D.rate; spit(m, tgt); } continue; }
      }
      // taunted, or close to the hero or a sellsword: turn on them
      const foe = (m.tauntT > 0 && !h.dead) || (hd < 3 && hd <= ad) ? (h.dead ? null : h) : ad < 2.5 ? ally : null;
      if (foe && !D.burst && m.kind !== 'gravelord') {
        const fd = Math.hypot(foe.x - m.x, foe.y - m.y);
        m.face = Math.atan2(foe.x - m.x, foe.y - m.y);
        if (fd > 0.9) moveToward(m, foe.x, foe.y, speed * dt);
        else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; if (foe === h) hurtHero(D.dmg); else foe.hp -= D.dmg; ev('bite', { id: m.id }); } }
        continue;
      }
      const climbs = D.climbs && climbOk;
      const field = climbs ? S.climb : S.flow, next = climbs ? S.climbNext : S.flowNext;
      let attackB = null;
      if (field[ci] === 0 || !Number.isFinite(field[ci])) attackB = adjacentBuilding(m);
      const nj = next[ci];
      if (!attackB && nj >= 0 && S.occ[nj] >= 0 && !climbs) attackB = S.byId.get(S.occ[nj]); // a palisade stands in the way
      if (attackB && !attackB.ruined) {
        m.attacking = true; m.face = Math.atan2(attackB.x - m.x, attackB.y - m.y);
        if (D.burst) { m.hp = 0; killMob(m); continue; }
        if (m.cd <= 0) {
          m.cd = 1; damageBuilding(attackB, D.dmg, m); ev('bite', { id: m.id });
          if (attackB.type === 'wall' && S.P.thorns) hitMob(m, S.P.thorns, 'thorns');
        }
        continue;
      }
      if (nj >= 0) { const tx = (nj % N) + 0.5, ty = ((nj / N) | 0) + 0.5; moveToward(m, tx, ty, speed * dt); }
      else moveToward(m, c, c, speed * dt);
    }
    // separation
    for (const arr of bucket.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), mn = 0.3 * (MOBS[a.kind].size + MOBS[b.kind].size);
      if (d < mn && d > 1e-4) { const p = (mn - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
    }
    // never stand inside a building or impassable cell
    for (const m of S.mobs) {
      if (!standable(m, m.x, m.y)) {
        if (m.px !== undefined && standable(m, m.px, m.py)) { m.x = m.px; m.y = m.py; }
        else unstick(m);
      }
      m.px = m.x; m.py = m.y;
    }
  }
  function standable(m, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false;
    const i = idx(cx, cy);
    return PASSABLE[map.terrain[i]] && (S.occ[i] < 0 || (MOBS[m.kind].climbs && !mastery('fortress') && isWall(S.occ[i])));
  }
  function unstick(m) {
    const cx = Math.floor(m.x), cy = Math.floor(m.y);
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx + 0.5, y = cy + dy + 0.5;
      if (standable(m, x, y) && Number.isFinite(S.flow[idx(cx + dx, cy + dy)])) { m.x = x; m.y = y; return; }
    }
  }
  function moveToward(m, tx, ty, s) { const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy); if (d < 1e-4) return; m.x += dx / d * Math.min(s, d); m.y += dy / d * Math.min(s, d); m.face = Math.atan2(dx, dy); }
  function adjacentBuilding(m) {
    const x = Math.floor(m.x), y = Math.floor(m.y); let best = null, bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!inside(x + dx, y + dy)) continue; const o = S.occ[idx(x + dx, y + dy)];
      if (o >= 0) { const b = S.byId.get(o); if (b && !b.ruined) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } } }
    }
    return best;
  }

  function nearestMobs(x, y, range, k) {
    const out = [];
    for (const m of S.mobs) { if (m.rise < 1) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < range) out.push([d, m]); }
    out.sort((a, b) => a[0] - b[0]); return out.slice(0, k).map(q => q[1]);
  }
  function stepTowers(dt) {
    for (const b of live()) {
      if (b.type !== 'tower' || !manned(b)) continue;
      const t = towerStats(b);
      if (mastery('rain')) { b.rainT += dt; if (b.rainT >= 6) { b.rainT = 0; for (const m of nearestMobs(b.x, b.y, t.range, 3)) fire(3, b.x, b.y, m, t.dmg, 'tower'); } }
      b.cd -= dt; if (b.cd > 0) continue;
      const near2 = nearestMobs(b.x, b.y, t.range, 2); if (!near2.length) continue;
      for (let k = 0; k < t.shots; k++) {
        b.shotN++;
        fire(3, b.x, b.y, near2[k % near2.length], t.dmg, 'tower', 18, has('fire') && b.shotN % 5 === 0 ? { burn: true } : {});
      }
      b.cd = t.rate;
    }
    if (!keep.ruined) {
      const l = keep.level - 1, range = (KEEP.range[l] + S.P.towerRange) * W8().range, dmg = KEEP.dmg[l] * keepMult();
      keep.cd -= dt;
      if (keep.cd <= 0) { const ms = nearestMobs(c, c, range, 2); if (ms.length) { for (let k = 0; k < KEEP.shots[l]; k++) fire(4, c, c, ms[k % ms.length], dmg, 'keep'); keep.cd = KEEP.rate / S.P.keepRate; } }
      if (has('ballista')) {
        keep.boltT -= dt;
        if (keep.boltT <= 0) {
          const tgt = nearestMobs(c, c, 12, 1)[0];
          if (tgt) {
            keep.boltT = 3; const dx = tgt.x - c, dy = tgt.y - c, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ex = c + ux * 12, ey = c + uy * 12;
            for (const m of [...S.mobs]) { const px = m.x - c, py = m.y - c, along = px * ux + py * uy; if (along < 0 || along > 12) continue; if (Math.abs(px * uy - py * ux) < 0.6) hitMob(m, 8, 'keep'); }
            ev('bolt', { x0: c, y0: c, x1: ex, y1: ey });
          }
        }
      }
    }
  }
  function stepProjectiles(dt) {
    for (const p of [...S.projectiles]) {
      let tgt;
      if (p.target === 'hero') tgt = S.hero.dead ? null : S.hero;
      else if (typeof p.target === 'string' && p.target[0] === 'a') tgt = S.allies.find(a => `a${a.id}` === p.target) || null;
      else tgt = p.enemy ? S.byId.get(p.target) : mobById.get(p.target);
      if (tgt) { p.tx = tgt.x; p.ty = tgt.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy); p.life -= dt;
      if (d < 0.4 || p.life <= 0) {
        if (tgt && d < 0.8) {
          if (p.enemy) { if (tgt === S.hero) hurtHero(p.dmg); else if (tgt.ally) tgt.hp -= p.dmg; else damageBuilding(tgt, p.dmg); }
          else { if (p.burn) tgt.burn = { t: 4, dps: 1 }; hitMob(tgt, p.dmg, p.src); }
        }
        S.projectiles.splice(S.projectiles.indexOf(p), 1); ev('shotEnd', { id: p.id }); continue;
      }
      const s = Math.min(d, p.speed * dt); p.x += dx / d * s; p.y += dy / d * s;
    }
  }

  function step(dt = STEP) {
    if (S.over) return;
    S.time += dt;
    refreshFlow();
    if (S.ability.cd > 0) S.ability.cd = Math.max(0, S.ability.cd - dt);
    if (S.bountyT > 0) S.bountyT = Math.max(0, S.bountyT - dt);
    stepHero(dt);
    if ((S.revealT = (S.revealT || 0) - dt) <= 0) { S.revealT = 0.25; if (!S.hero.dead) reveal(S.hero.x, S.hero.y, 8); }
    if (S.phase === 'day' && S.clock && !S.over) {
      S.dayT += dt;
      while (S.dayQueue.length && S.dayQueue[0].t <= S.dayT) { const q = S.dayQueue.shift(); if (nestAlive(q.nest) && !S.claimed.has(q.nest)) spawnAtNest(q.kind, q.nest); }
      if (S.dayT >= TIDE.dayLen && S.pendingPicks === 0 && !S.packs.length) startNight(true);
    }
    if (S.phase === 'day') { stepMobs(dt); stepAllies(dt); stepTowers(dt); if (planner) planner.tick(dt); }
    if (S.phase === 'night') {
      S.qT += dt;
      while (S.queue.length && S.queue[0].t <= S.qT) {
        const q = S.queue.shift(), m = spawnAtNest(q.kind, q.nest);
        if (q.first) { m.hp = m.maxHp = TIDE.first.hp; m.speed *= TIDE.first.speed; m.first = true; ev('firstDead', { id: m.id }); toast('Something crawls out of the dark. It is coming for the town.', 'bad'); }
      }
      stepMobs(dt);
      stepAllies(dt);
      stepTowers(dt);
      if (mastery('mending')) for (const b of live()) if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + dt * 0.3);
    }
    for (const p of [...S.purses]) { p.life -= dt; if (p.life <= 0) { S.purses.splice(S.purses.indexOf(p), 1); ev('purseGone', { id: p.id }); } }
    stepProjectiles(dt);
    if (S.drops.length) stepDrops(dt);
    stepStream(dt);
    for (const b of S.buildings) if (b.built < 1 && !b.ruined) { b.built = Math.min(1, b.built + dt / BUILDINGS[b.type].buildTime); if (b.built >= 1) { ev('built', { id: b.id }); toast(`The ${BUILDINGS[b.type].name} is finished. ${BUILDINGS[b.type].desc[0]}`, 'good'); } }
    // sunrise: whatever still walks long after the last surge burns away
    if (S.phase === 'night' && !S.queue.length && S.mobs.some(m => !m.roam && m.stream === undefined) && S.qT > WAVES.duration(S.night) + 90) {
      for (const m of S.mobs.filter(q => !q.roam && q.stream === undefined)) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y }); }
      toast('The sun rises and the last of the dead burn away.');
    }
    if (S.phase === 'night' && !S.over && !S.queue.length && !S.mobs.some(m => !m.roam && m.stream === undefined)) dawn();
  }

  // ---------- forecast: where tonight's dead come from and how they walk ----------
  function tracePath(x, y, climb = false) {
    const next = climb ? S.climbNext : S.flowNext, pts = [[x, y]];
    let i = idx(Math.floor(x), Math.floor(y));
    for (let k = 0; k < 300; k++) { const j = next[i]; if (j < 0) break; pts.push([(j % N) + 0.5, ((j / N) | 0) + 0.5]); i = j; }
    return pts;
  }
  function forecast(n = S.night) {
    refreshFlow();
    let nests = activeNests(n);
    if (!nests.length) nests = edgeSpawns.map((_, k) => -1 - k);
    const w = nests.map(r => (S.wake[r] === n && n > 1 ? 0.5 : 1)), tw = w.reduce((a, b) => a + b, 0);
    const u = unlocked(n), wsum = u.reduce((a, [, m]) => a + m.weight, 0), avgCost = u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / wsum;
    const total = n === 1 && S.purge === null ? 1 : nightBudget(n) / avgCost;
    if (n === 1) nests.splice(1);
    const out = nests.map((r, k) => {
      const p = r < 0 ? edgeSpawns[-1 - r] : map.regions[r].nest;
      return { nest: r, x: p.x, y: p.y, count: Math.round(total * w[k] / tw), siege: false, boss: false, path: tracePath(p.x, p.y) };
    });
    if (S.purge !== null && n === S.night) {
      const p = map.regions[S.purge].nest, extra = Math.round(purgeBudget(S.purge, n) / avgCost) + 1;
      const e = out.find(o => o.nest === S.purge);
      if (e) { e.count += extra; e.siege = true; } else out.push({ nest: S.purge, x: p.x, y: p.y, count: extra, siege: true, boss: false, path: tracePath(p.x, p.y) });
    }
    if (isBloodMoon(n) && out.length) out[0].boss = true;
    return out;
  }

  // ---------- queries for UI and bots ----------
  function regionInfo(r) {
    const reg = map.regions[r]; if (!reg) return null;
    const ratio = canPurge(r) ? threatRatio(S.night, r) : null;
    return {
      id: r, ring: reg.ring, claimed: S.claimed.has(r), nest: !!reg.nest && S.nestAlive[r], awake: S.wake[r] <= S.night, active: activeNests().includes(r),
      needKeep: keepForRing(reg.ring), slots: reg.slots.length, forest: reg.forest, water: reg.water, canPurge: canPurge(r), ratio, rating: ratio === null ? null : ratingOf(ratio),
      wakes: reg.neighbors.filter(n => map.regions[n].nest && !S.claimed.has(n) && S.wake[n] > S.night).length,
    };
  }
  /** building whose footprint covers the cell under (x, y), or the keep */
  function buildingAt(x, y) { const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return null; const o = S.occ[idx(cx, cy)]; return o >= 0 ? S.byId.get(o) : null; }
  for (const r of S.claimed) revealRegion(r); reveal(c, c, 14);
  S.picks.push('dawn'); rollOffer(); rollPacks(); spawnRoamers();

  // ---------- scavenging ----------
  sc = createScavenge({ S, map, seed, ev, toast, earn, activeNests, isBloodMoon, spawnMob, fail });
  S.scav = sc.scav;

  let planner = null;
  const api = {
    setBuilders: f => { if (S.builders !== null && FOCI.includes(f)) S.builders = f; },
    scavenge: { siteInfo: sc.siteInfo, send: sc.send, recall: sc.recall, treat: sc.treat, exile: sc.exile, hopsMap: sc.hopsMap },
    state: S, map, heroDef: HC, step, build, choosePack, rerollPacks, buyCost, upgrade, demolish, upgradeKeep, startNight, choosePerk, reroll, trade, planPurge, useAbility,
    setHeroInput: (x, y) => { S.hero.input.x = x; S.hero.input.y = y; },
    heroTo: (x, y) => {
      const h = S.hero, t = h.target;
      if (t && h.path && Math.hypot(t.x - x, t.y - y) < 0.6) return;   // same place: keep the plan
      h.target = { x, y }; h.path = heroPath(x, y);
    },
    buildLine, upgradeWall, wallRun, wallBudget, lineCells,
    weather: () => ({ id: S.weather, ...W8() }),
    hiveHealth, hitHive,
    duskIn: () => Math.max(0, TIDE.dayLen - S.dayT), bellBonus: () => (S.clock ? Math.floor(Math.max(0, TIDE.dayLen - S.dayT) / TIDE.bellGold) : 0),
    dropSupply,
    hasTech, crewing, manned, townDraw, noise, reveal, claimLandmark, landmarkReach: id => landmarkReach(S.landmarks[id]), owns, zone, inZone: (x, y) => inZone(idx(Math.floor(x), Math.floor(y))), baseDist, keepForRing, keepLevel: () => keep.level,
    rubbleAt, clearRubble,
    canPlace, buildingAt, costOf, upCostOf, maxHpOf, keepMaxHp, pop, defenceDps, heroDps, threatRatio, ratingOf, activeNests, regionInfo, canPurge,
    abilityCost, towerStats: b => towerStats(b), has,
    foodPerDawn: () => Math.round(S.buildings.reduce((a, b) => a + (b.type === 'farm' ? farmFood(b) : 0), 0) * prosper()),
    goldPerDawn: () => Math.round((START.baseIncome + S.P.tax + S.buildings.reduce((a, b) => a + (b.type === 'house' ? houseGold(b) : 0), 0)) * prosper()) - upkeep(),
    upkeep, foodNeed, rerollCost: () => (S.reroll.free > 0 ? 0 : S.reroll.cost),
    forecast, mastered, mastery, isBloodMoon, drainEvents: () => S.events.splice(0),
    logRows: () => S.log.concat(S.cur && !S.cur.closed && S.cur.waveHp ? [S.cur] : []),
  };
  planner = createPlanner(api);
  return api;
}
