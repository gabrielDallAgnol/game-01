// The game rules. No DOM, no three.js: a renderer reads `game.state` and drains
// `game.state.events`; bots and tests drive the same API headlessly.
import { Rng, hashSeed } from './rng.js';
import { generateMap, N, T, PASSABLE, idx, inside, LANDMARKS } from './mapgen.js';
import { computeFlow, computeNext } from './flow.js';
import { BUILDINGS, KEEP, MAX_LEVEL, START, UNLOCKS, POWER, RISE, HANDS } from '../content/buildings.js';
import { MOBS, WAVES, TIDE, BRAIN, ESCAPE } from '../content/mobs.js';
import { HEROES, MERC, PURSE, TRADES, CALLINGS, FINALS, EVOLVE_AT } from '../content/heroes.js';
import { PERKS, FAMILIES, MASTERIES, SYNERGIES, ODDS, REROLL, freshPerkState, NEEDS, NEST_POOL } from '../content/perks.js';
import { PACKS, PACK_RULES } from '../content/packs.js';
import { createScavenge } from './scavenge.js';
import { createPlanner, FOCI } from './planner.js';
import { WEATHER } from '../content/weather.js';
import { KITS, RARITY_ODDS } from '../content/districts.js';
import { createStory } from './story.js';
// [road] begin
import { createRoad } from './road.js';
// [road] end
import { TITLES } from '../content/story.js';
import { FEATURES, CALLING_LVL, FINAL_LVL, PARTY, SEASONS, SEASON_POOL, RULES, seasonEnd } from '../content/season.js';

export const STEP = 1 / 60;
export const PICKS_PER_DAWN = 2;
export const DROPS = { channel: 3, reach: 1.7, life: 2 };   // seconds to open, how close, nights it lasts
export const NIGHT_TAIL = 30;   // seconds of night after the last surge before the sun comes up
export const STREAM = { every: 11, drop: 0.35, min: 3.5, nightMult: 1.6, rage: 4, rageTime: 18, hiveHp: 102 };   // hiveHp: 60 × 1.7 (hollows are no longer free loot)   // seconds between dead per hive
export const ZONE = { keep: 13, building: 4.5, landmark: 7, hiveBlock: 6, hiveReach: 14 };
export const TOWN_DRAW = { free: 12, per: 0.012 };   // (old population draw: replaced by NOISE.mult, kept for old callers)
export const CREW_NEED = [1, 2, 3];        // people a tower needs at level 1/2/3
// ---------- cuts (decided Oct 20): each system stays in the code behind a flag so it can return ----------
// power: no generators in the build list, no blackouts (the data stays for a "Lights Out" contract rule)
// hands: no daily hand limit · weather: never rolled at dawn, its effects live in season rules (storm, still)
// titleStats: titles are flavour, their stat effects are undone · finalClass / secondCompanion: parked
// trader: the Scavver meets no trader · crew: the scavenge crew generates no events or bonuses
// walls: barricades are out of the build list. Measured (Oct 20, same camp on night 8, 4 seeds): 25 posts laid
// across the routes soaked 50 damage in all; the dead walk round a line. They come back with a ring-building tool.
// the save format: v4 (Oct 20) carries ruins, Noise, tools, contracts and the road; older saves are ignored at the start screen
export const SAVE_V = 4;
export const CUT = { walls: true, power: true, hands: true, weather: true, titleStats: true, finalClass: true, secondCompanion: true, trader: true, crew: true };
// Heat (old name, same meter): see NOISE below. `stir`, `erupt`, `warn`, `cool`, `burst` still apply.
export const HEAT = { floorPer: 1.4, floorMax: 70, combatMax: 77, decay: 0.1, rise: 2.5, shot: 0.03, kill: 0.15, stir: 50, erupt: 80, warn: 40, after: -35, cool: 90, burst: 9 };
// Noise: ONE meter (0–100). It rests on a floor set by loud CHOICES (level 3 towers, the market and workshop,
// loud sites, story choices), spikes with gunfire and fighting (the spike fades at `HEAT.decay` per second), and
// decides three things: how far the hives hear the camp (HEAR), how many dead come (×1 → ×`mult` at 100) and,
// at `HEAT.erupt`, a hive bursts. A story choice moves the meter for nights: it fades by `choiceFade` each dawn.
export const NOISE = {
  tower: [0, 0.5, 3], market: 8, workshop: 5, generator: [10, 14], wall: 0, house: 0, farm: 0,   // the floor, per building (by level)
  site: 2,               // × a site's noise (the fuel depot pumps)
  choiceFade: 0.2,       // a story choice's noise fades by a fifth each dawn
  choiceMax: 40,         // story choices can move the meter by at most this much either way
  mult: 0.5,             // wave multiplier: 1 + mult × noise/100 (≤ ×1.5)
};
// Tension: ruins persist until rebuilt by hand; the hall falls over ~30 s; dying costs the night.
export const TENSION = { hallCap: 0.03, hallGuard: 0.5, guardR: 3, respawn: 30, downRate: 0.75, rebuild: 0.5 };
// The hero's presence: towers near the hero shoot faster and further; whatever the hero hits is Marked for the towers.
export const PRESENCE = { r: 6, rate: 1.3, range: 2, markT: 4, mark: 1.3 };
// Field tools (any time, no pause): a flare lures the dead near you to a point; smoke makes them lose your scent.
export const TOOLS = { flare: { cost: 4, t: 20, cd: 20, r: 14, throw: 9 }, smoke: { cost: 3, t: 25, cd: 20, r: 10 } };
// Season rules that used to be weather (rolled at dawn, now a contract's rule): what they do to a night
export const RULE_FX = {
  storm: { name: RULES.storm.name, desc: RULES.storm.desc, weather: 'storm' },
  still: { name: RULES.still.name, desc: RULES.still.desc, weather: 'still' },
  lightsOut: { name: RULES.lightsOut.name, desc: RULES.lightsOut.desc },
};
// Difficulty: threat (how many dead), economy (what homes and farms give), heat (how fast attention builds).
export const DIFFICULTY = {
  story:     { name: 'Story', blurb: 'For the story and the city. Fewer dead, richer homes.', threat: 0.55, eco: 1.25, heat: 0.7 },
  survivor:  { name: 'Survivor', blurb: 'Fair but hard. The way it is meant to be played.', threat: 0.88, eco: 1, heat: 1 },
  veteran:   { name: 'Veteran', blurb: 'More dead, thinner supplies. Mistakes cost buildings.', threat: 1.15, eco: 0.9, heat: 1.2 },
  nightmare: { name: 'Nightmare', blurb: 'The city wants you dead. It usually gets its way.', threat: 1.45, eco: 0.8, heat: 1.4 },
};
export const FOREMAN = { buildings: 6, keep: 3 };   // the Foreman: a toggle, never on by itself
// hero levels: XP from the dead you put down yourself, sites, quests and districts. Each level: a little harder, a little tougher.
export const LEVEL = { xp: lv => Math.round(20 * Math.pow(lv, 1.2)), dmg: 0.09, hp: 4, max: 50 };   // level 12 is reachable in a season   // the town learns to build by itself once it is this established
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
const SIZE = { house: 2, farm: 2, tower: 1, wall: 1, workshop: 3, market: 3, generator: 2 };
const LOT_PAD = { house: 1, farm: 1, tower: 1, workshop: 1, market: 1, wall: 0, generator: 1 };   // the path each lot includes   // compact footprints; palisades are single posts, laid in lines
const BIG = 1.6; // mobs at least this size count as "big game"

export function createGame({ seed = 1, biome = 'riverbend', hero = 'warrior', mapSeed, mode = 'classic', clock = true, difficulty = 'survivor', restore = null, legacy = {} } = {}) {
  if (hero === 'steward') hero = 'merchant';
  const map = generateMap(mapSeed ?? seed, biome);
  const rng = new Rng(hashSeed(seed, 'run'));
  const perkRng = new Rng(hashSeed(seed, 'perks'));
  let HC = HEROES[hero];
  let DIFF = DIFFICULTY[difficulty] || DIFFICULTY.survivor;
  const c = map.town.x;

  const S = {
    seed, biome, map, heroClass: hero, mode, evo: { calling: null, offered: {} }, path: { hero: 0, ranger: 0, scavver: 0, heart: 0 }, lvl: 1, xp: 0, night: 1, phase: 'day', time: 0,
    stock: { ...PACK_RULES.start }, packs: [], difficulty: DIFFICULTY[difficulty] ? difficulty : 'survivor', handsUsed: 0, handsExtra: 0, heat: 0, noise: 0, noiseChoice: 0, noiseSpike: 0, mourned: 0, diffNight: 0, tools: { flare: 0, smoke: 0 }, eruption: null, heatCool: 0, blackout: false, foreman: false, feat: {}, season: { n: 1, id: SEASONS[0].id, rule: SEASONS[0].rule || null, rules: SEASONS[0].rule ? [SEASONS[0].rule] : [], name: SEASONS[0].name, finale: SEASONS[0].finale, end: seasonEnd(1), start: 1, won: false },
    gold: START.gold, food: START.food, kills: 0, events: [],
    buildings: [], occ: new Int32Array(N * N).fill(-1), res: new Int32Array(N * N).fill(-1),
    claimed: new Set([0]), nestAlive: map.regions.map(r => !!r.nest), wake: map.regions.map(() => Infinity),
    mobs: [], projectiles: [], chests: [], purses: [], allies: [], nextId: 1, queue: [], qT: 0, purge: null, nightFlags: {},
    P: freshPerkState(), picks: [], pendingPicks: 0, offer: [], offerSource: null, chestsHeld: 0, dawns: 0,
    reroll: { free: REROLL.free, cost: REROLL.base }, trade: null, halfUpgrade: false,
    ability: { cd: 0, hires: 0 }, weather: 'clear', clock, dayT: 0, dayQueue: [], drops: [], landmarks: map.landmarks.map(l => ({ ...l, owned: false })), seen: new Uint8Array(N * N), seenVersion: 0, builders: null, survivors: START.survivors,
    log: [], cur: null, over: false, won: false,
    sealed: Uint8Array.from(map.regions, r => (r.ring > 2 ? 1 : 0)) /* only the old core is behind the quarantine fence */, kits: {}, pickups: [], sealVersion: 0, legacy: { ...legacy },
    hero: { x: c, y: c + 3.5, r: 0.4, hp: HC.hp, maxHp: HC.hp, cd: 0, dead: false, respawn: 0, target: null, input: { x: 0, y: 0 }, face: 0, swing: 0, guardT: 0, attacks: 0, carry: { scrap: 0, food: 0 } },
    flow: null, flowNext: null, climb: null, climbNext: null, flowDirty: true,
    stats: { goldEarned: 0, goldSpent: 0, built: 0, upgraded: 0, killsByKind: {}, killsBy: {}, peakPop: 0, buildingsLost: 0, housesLost: 0, risen: 0,
      regionsClaimed: 0, blessings: 0, chests: 0, bosses: 0, mercsHired: 0, pursesGold: 0, heroDeaths: 0 },
  };

  // the forest hollows wake first, nearest first; the city's hives later (their dead have a long walk)
  const byDist = ids => ids.sort((p, q) => Math.hypot(map.regions[p].nest.x - c, map.regions[p].nest.y - c) - Math.hypot(map.regions[q].nest.x - c, map.regions[q].nest.y - c));
  const ring1 = byDist(map.regions.filter(r => r.ring === 1 && r.nest).map(r => r.id));
  [1, 3, 5, 7].forEach((n, k) => { if (ring1[k] !== undefined) S.wake[ring1[k]] = n; });
  ring1.slice(4).forEach(id => { S.wake[id] = 9; });
  const cityNests = byDist(map.regions.filter(r => r.ring >= 2 && r.nest).map(r => r.id));
  cityNests.forEach((id, k) => { S.wake[id] = 6 + 2 * k; });

  // ---------- helpers ----------
  const ev = (t, o = {}) => S.events.push({ ...o, t });   // the type always wins over a payload field
  const toast = (msg, kind) => ev('toast', { msg, kind });
  const has = id => (S.P.taken[id] || 0) > 0;
  const combo = (a, b) => has(a) && has(b);
  let mastSet = new Set();
  const mastery = id => mastSet.has(id);
  const mastered = f => !!S.P.mastery[f];
  const isDef = t => t === 'tower' || t === 'wall';
  const earn = g => { S.gold += g; S.stats.goldEarned += Math.max(0, g); };
  const costOf = (type, level = 1) => Math.max(1, Math.floor(BUILDINGS[type].cost[level - 1] * (1 - (HC.discount || 0))) - (isDef(type) ? S.P.defDiscount : S.P.ecoDiscount));
  // a new building costs more for every one of its kind you already have
  const copies = type => S.buildings.filter(b => b.type === type).length;
  // towers climb in a straight line (every copy +25% of the base: more towers is a real choice against better ones);
  // everything else climbs and flattens; barricade posts get dearer by one scrap per dozen
  const newCost = type => Math.max(1, Math.round(type === 'tower' ? costOf(type) * (1 + RISE.tower * copies(type))
    : type === 'wall' ? costOf(type) + Math.floor(copies(type) / (RISE.wallEvery || 12))
    : costOf(type) * (1 + 2 * (RISE[type] || 0) * Math.sqrt(copies(type)))));
  const buyCost = type => newCost(type) * (S.mode === 'packs' && !BUILDINGS[type].tech ? PACK_RULES.premium : 1);
  // hands: every build or upgrade takes a free pair of hands for the rest of the day (CUT: scrap is the only limit)
  const handsMax = () => (CUT.hands ? 99 : HANDS.base + Math.ceil(Math.sqrt(pop())) + Math.floor(pop() / 8) + S.handsExtra + (S.legacy.hands || 0) + (S.landmarks || []).reduce((a, l) => a + (l.owned && LANDMARKS[l.kind].hands || 0), 0) + (story ? story.bonus.hands() : 0));
  const handsFree = () => (CUT.hands ? 99 : Math.max(0, handsMax() - S.handsUsed));
  const useHand = () => { if (CUT.hands) return true; if (handsFree() < 1) return fail('No free hands today. More people (homes) means more hands; they rest at dawn.'); S.handsUsed++; return true; };
  const upCostOf = (b) => { const c0 = costOf(b.type, b.level + 1); return S.halfUpgrade ? Math.max(1, Math.ceil(c0 / 2)) : c0; };
  const maxHpOf = (type, level) => Math.round(BUILDINGS[type].hp[level - 1] * (1 + S.P.allHp + (type === 'wall' ? S.P.wallHp : 0)));
  const keepMaxHp = () => Math.round((KEEP.hp[keep.level - 1] + S.P.keepHp) * S.P.keepHpMult);
  // people: survivors, the families in the homes (b.folk) and the homeless who fled a fallen home to the Camp.
  // A fallen home loses half its people (they rise with the dead, for good); the rest flee to the Camp and move back in
  // when you rebuild it. New homes and upgrades bring new people; convoys, rescues and lit outposts bring people back.
  const houseCap = b => BUILDINGS.house.pop[b.level - 1];
  const pop = () => Math.max(0, S.survivors + (S.homeless || 0) + S.buildings.reduce((s, b) => s + (b.type === 'house' ? (b.folk ?? houseCap(b)) : 0), 0));
  const near = (b, type, r) => S.buildings.some(o => o !== b && o.type === type && !o.ruined && Math.hypot(o.x - b.x, o.y - b.y) <= r);
  const hasTech = t => !S.blackout && S.buildings.some(b => b.type === t && !b.ruined && b.built >= 1);
  // ---------- power (CUT: only a "Lights Out" season rule brings it back) ----------
  const powerLive = () => !CUT.power || rule('lightsOut');
  const powerDraw = b => (powerLive() ? ((POWER.draw[b.type] || [])[b.level - 1] || 0) : 0);
  const powerIn = () => POWER.keep[keep.level - 1] + S.buildings.reduce((a, b) => a + (b.type === 'generator' && !b.ruined ? BUILDINGS.generator.power[b.level - 1] : 0), 0) + (S.landmarks || []).reduce((a, l) => a + (l.owned && LANDMARKS[l.kind].power || 0), 0) + (story ? story.bonus.power() : 0);
  const powerOut = () => S.buildings.reduce((a, b) => a + (b.ruined ? 0 : powerDraw(b)), 0);
  const powered = b => powerDraw(b) === 0 || !S.blackout;
  function checkPower() {
    const out = powerLive() && powerIn() < powerOut();
    if (!out && S.feat.power && powerOut() > 0 && powerIn() - powerOut() < 2 && !S.powerWarned) { S.powerWarned = true; toast('[Warning: power] Only **' + (powerIn() - powerOut()) + '** power to spare. Lose a generator and everything powered switches off.', 'bad'); }
    if (powerIn() - powerOut() >= 3) S.powerWarned = false;
    if (out !== S.blackout) { S.blackout = out; ev(out ? 'blackout' : 'powerBack'); toast(out ? `POWER DOWN. Your powered buildings switched off: ${powerOut()} needed, ${powerIn()} made. Build a generator or pull something down.` : 'Power restored. The lights come back on.', out ? 'bad' : 'good'); }
  }
  const houseGold = b => Math.round(BUILDINGS.house.gold[b.level - 1] * DIFF.eco) + S.P.houseGold + (hasTech('market') ? 1 : 0) + (mastery('tycoon') ? 1 : 0) + (has('guarded') && near(b, 'tower', 6) ? 2 : 0) + (combo('guarded', 'bastion') && near(b, 'wall', 3) ? 1 : 0);
  const farmFood = b => Math.round((BUILDINGS.farm.food[b.level - 1] * DIFF.eco + S.P.farmFood + (b.nearWater ? 1 : 0)) * (rule('winter') ? 0.67 : 1));
  const prosper = () => (mastery('prosperity') ? 1.3 : 1);
  const claimedCount = () => S.claimed.size;
  const isBloodMoon = n => n % WAVES.bloodMoonEvery === 0;
  // weather for tonight, rolled at dawn on its own random stream (never on blood moons)
  const weatherRng = new Rng(hashSeed(seed, 'weather'));
  const W8 = () => WEATHER[S.weather] || WEATHER.clear;
  const weatherFor = n => (n === S.night ? W8() : WEATHER.clear);
  // CUT.weather: nothing is rolled; a season rule (storm, still) sets every night's weather instead
  const ruleWeather = () => { for (const id of Object.keys(RULE_FX)) if (RULE_FX[id].weather && rule(id)) return RULE_FX[id].weather; return 'clear'; };
  function rollWeather(n) {
    if (CUT.weather) return ruleWeather();
    if (n < 3 || isBloodMoon(n)) return 'clear';
    const ids = Object.keys(WEATHER); return ids[weatherRng.weighted(ids.map(k => WEATHER[k].odds))];
  }
  let liveCache = null, liveTick = -1;
  const live = () => { if (liveTick !== S.time) { liveCache = S.buildings.filter(b => !b.ruined); liveTick = S.time; } return liveCache; };
  const heroMax = () => Math.round((HC.hp + S.P.heroHp + LEVEL.hp * ((S.lvl || 1) - 1) + (mastery('champion') ? 25 : 0)) * S.P.heroHpMult);
  let sc = null, story = null;
  const owns = k => S.landmarks.some(l => l.owned && l.kind === k);
  const towerMult = () => (1 + S.P.towerDmg + (sc && !CUT.crew ? sc.towerBonus() : 0) + (owns('police') ? 0.15 : 0) + (story ? story.bonus.towers() : 0)) * (mastery('deadeye') ? 1.4 : 1);
  const keepMult = () => (1 + S.P.keepDmg) * (mastery('deadeye') ? 1.4 : 1);
  const upkeep = () => Math.max(0, S.buildings.reduce((a, b) => a + ((BUILDINGS[b.type].upkeep || [])[b.level - 1] || 0), 0) - S.P.upkeepCut * 2);
  const foodNeed = () => Math.ceil(pop() * START.foodPerCitizen * (rule('hunger') ? 1.3 : 1));
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
    if (type === 'wall' && CUT.walls) return { ok: false, reason: 'Barricades are gone for now: the dead just walk round a line.', cells: [] };
    if (type === 'generator' && !powerLive()) return { ok: false, reason: 'No one needs a generator: the camp runs on fire and hand-cranks.', cells: [] };
    if (BUILDINGS[type].tech) { if (keep.level < BUILDINGS[type].keep) return { ok: false, reason: `Raise the keep to level ${BUILDINGS[type].keep} first.`, cells: [] }; if (S.buildings.some(b => b.type === type)) return { ok: false, reason: `You already have a ${BUILDINGS[type].name}.`, cells: [] }; }
    const { cells, lot, cx, cy } = shape(type, x, y, rot);
    const out = { ok: false, x: cx, y: cy, rot, cells: cells.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)), lot: lot.filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)), reason: '' };
    // [road] begin
    { const why = road && road.placeRule(type, cx, cy); if (why) { out.reason = why; return out; } }
    // [road] end
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

  const mobById = new Map();
  const keep = { id: 0, type: 'keep', x: c, y: c, r: 2.3, level: 1, hp: KEEP.hp[0], maxHp: KEEP.hp[0], cd: 0, ruined: false, cells: [], boltT: 3 };
  S.keep = keep; S.byId = new Map([[0, keep]]);
  occupy(keep);
  // [road] begin: stations, convoys, ambushes and night missions live in src/sim/road.js and src/sim/missions.js
  let road = null;
  road = createRoad({ S, map, ev, toast, rng: new Rng(hashSeed(seed, 'road')), LANDMARKS, mobById, story: () => story, fail: m => fail(m), earn: g => earn(g), gainXp: n => gainXp(n), reveal, compass: (x, y) => compass(x, y),
    placeBuilding, isWall: id => isWall(id), spawnMob, killMob, hitMob, hurtHero, moveToward, standable, heroOk: i => heroOk(i), inZone: i => inZone(i), zone: () => zone(), rankOf: m => rankOf(m), senseMult: m => senseMult(m),
    heroSpeed: () => HC.speed * S.P.heroSpeed, addNoise: v => addHeat(v), removeMob: m => { const i = S.mobs.indexOf(m); if (i >= 0) { S.mobs.splice(i, 1); mobById.delete(m.id); } } });
  // [road] end

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
    if (type === 'house') b.folk = BUILDINGS.house.pop[level - 1];   // a new home comes with its family (raise() and restore adjust this)
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
    for (let r = 58; r > 36; r -= 0.5) {   // the deep woods
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
  // a hive notices you once your base comes within reach of it
  const adjacentToClaimed = r => { const n = map.regions[r].nest; return !!n && baseDist(n.x, n.y) <= ZONE.hiveReach; };
  // an awake hive sends its dead toward the noise, however far away it is (the sealed core stays shut)
  function activeNests(n = S.night) {
    return map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id) && !S.sealed[r.id] && S.wake[r.id] <= n).map(r => r.id);
  }
  // hearing: a hive marches on the camp only if the camp is loud enough to be heard from there. A loud town (heat) draws the far city.
  const HEAR = { base: 62, perHeat: 1.2 };
  const hearR = () => HEAR.base + (S.noise || 0) * HEAR.perHeat;   // the hearing ring around the camp, in cells
  const hears = r => { const n = map.regions[r].nest; return Math.hypot(n.x - c, n.y - c) < hearR(); };
  const marchNests = (n = S.night) => activeNests(n).filter(hears);
  // pacing: forest hollows can be burned from day 1; city hives need a level 2 keep, the old core level 3
  const keepForRing = ring => (ring <= 1 ? 1 : Math.min(MAX_LEVEL, ring));
  function canPurge(r) {
    const reg = map.regions[r];
    return reg && reg.nest && S.nestAlive[r] && !S.claimed.has(r) && adjacentToClaimed(r) && keep.level >= keepForRing(reg.ring);
  }

  // ---------- threat estimate (shared by the purge rating, the log and bots) ----------
  function unlocked(n) { return Object.entries(MOBS).filter(([, m]) => m.weight > 0 && m.from <= n).map(([k, m]) => (k === 'runner' && rule('raiders') ? [k, { ...m, weight: m.weight * 3 }] : [k, m])); }
  function hpPerBudget(n) {
    const u = unlocked(n), w = u.reduce((a, [, m]) => a + m.weight, 0);
    const hp = u.reduce((a, [, m]) => a + m.weight * m.hp, 0) / w, cost = u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / w;
    return hp / cost;
  }
  // blood moons: a nest guardian at 5, two at 10, the Gravelord from 15 (one more every 10 nights)
  function bossesFor(n) { return n < 15 ? ['guardian'] : Array.from({ length: Math.floor((n - 5) / 10) }, () => 'gravelord'); }   // on night 10 the season's unique monster takes the guardian's place
  const territory = () => (S.P.greed ? 1 + 0.25 * (claimedCount() - 1) : WAVES.territory(claimedCount()));
  // ---------- noise: one meter (see NOISE). Loud choices set its floor; fighting spikes it; story choices hold for nights ----------
  let floorKey = '', floorCache = 0;
  function noiseFloor() {
    const key = `${S.occVersion || 0}|${S.landmarks.filter(l => l.owned).length}`;
    if (key === floorKey) return floorCache;
    let f = 0;
    for (const b of S.buildings) { if (b.ruined) continue; const v = NOISE[b.type]; f += Array.isArray(v) ? (v[b.level - 1] || 0) : (v || 0); }
    f += S.landmarks.reduce((a, l) => a + (l.owned && LANDMARKS[l.kind].noise || 0) * NOISE.site, 0);
    floorKey = key; floorCache = f; return f;
  }
  const noiseCalm = () => DIFF.heat * (story ? story.bonus.heat() : 1) * (S.P.calm || 1);
  const noiseBase = () => noiseFloor() * noiseCalm() + (S.noiseChoice || 0);
  const noise = () => Math.round(S.noise || 0);
  // the louder the camp, the more dead come: ×1 when silent, ×1.5 at 100
  const townDraw = () => 1 + NOISE.mult * Math.min(100, S.noise || 0) / 100;
  // the difficulty curve: a won contract pulls the night the curve reads from back (see contractWon)
  const effN = n => Math.max(1, n - (S.diffNight || 0));
  const hpS = n => WAVES.hpScale(effN(n));
  function nightBudget(n) { return DIFF.threat * WAVES.budget(effN(n)) * (TIDE.opening[n] ?? 1) * territory() * townDraw() * (isBloodMoon(n) ? WAVES.bloodMoonMult(n) : 1) * (n > 1 && isBloodMoon(n - 1) ? 0.75 : 1) * weatherFor(n).dead; }   // the night after a blood moon is a breather
  function purgeBudget(r, n) { return WAVES.budget(effN(n)) * WAVES.purgeShare(map.regions[r].ring); }
  function towerStats(b) {
    const B = BUILDINGS.tower, l = b.level - 1;
    const h = S.hero, hd = h.dead ? Infinity : Math.hypot(h.x - b.x, h.y - b.y);
    // the hero's presence (everyone, from day 1): towers near you shoot faster and further. Rallying Cry widens and deepens it.
    const presR = PRESENCE.r + (has('rally') ? 3 : 0), near = hd < presR || (combo('rally', 'watch') && b.paired && !h.dead);
    let range = (B.range[l] + S.P.towerRange + (owns('eiffel') ? 1.5 : 0) + (has('watch') && b.paired ? 2 : 0) + (map.high[idx(Math.floor(b.x), Math.floor(b.y))] ? 2 : 0) + (near ? PRESENCE.range : 0) - (rule('fog') && S.phase === 'night' ? 2 : 0)) * (S.phase === 'night' ? W8().range : 1);
    let dmg = B.dmg[l] * towerMult() * (has('bastion') && b.walled ? 1.4 : 1);
    let rate = B.rate[l] / S.P.towerRate;
    if (S.P.kingpin && S.bountyT > 0 && hd < 9) rate /= 1.4;
    if (HC.marshal && hd < 6) rate /= HC.marshal;
    if (near) rate /= PRESENCE.rate * (has('rally') ? 1.15 : 1);
    if (h.dead) rate /= TENSION.downRate;   // the hero is down: the town loses heart (25% slower)
    return { range, dmg, rate, shots: has('volley') && b.level === 3 ? 2 : 1, presence: near };
  }
  // towers are manned by people from your homes, oldest tower first; a tower without its full crew stays silent
  let crewKey = -1, crewCache = null;
  function crewing() {
    const key = (S.occVersion || 0) * 1000 + (S.phase === 'night' ? 1 : 0);
    if (S.phase === 'night' && crewCache && crewCache.night === S.night) return crewCache;   // posts are fixed for the night
    if (key === crewKey && crewCache) return crewCache;
    let free = pop(); const manned = new Set(); let need = 0;
    for (const b of S.buildings.filter(x => x.type === 'tower' && !x.ruined).sort((a, c) => a.id - c.id)) { const n = CREW_NEED[b.level - 1]; need += n; if (free >= n) { manned.add(b.id); free -= n; } }
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
    for (const b of live()) if (b.type === 'tower' && manned(b) && powered(b)) { const t = towerStats(b); d += t.dmg * t.shots / t.rate; }
    if (!keep.ruined) d += KEEP.dmg[keep.level - 1] * keepMult() * S.P.keepRate / KEEP.rate * KEEP.shots[keep.level - 1] + (has('ballista') ? 8 / 3 * 2 : 0);
    return d;
  }
  function heroDmg() { return HC.attack ? (HC.attack.dmg + S.P.heroDmg + (mastery('whirlwind') ? 1 : 0)) * S.P.heroDmgMult * (1 + LEVEL.dmg * (S.lvl - 1)) * (S.drained === S.night ? 0.75 : 1) : 0; }
  function gainXp(n) {
    if (S.lvl >= LEVEL.max) return; S.xp += n;
    while (S.lvl < LEVEL.max && S.xp >= LEVEL.xp(S.lvl)) { S.xp -= LEVEL.xp(S.lvl); S.lvl++; refreshMax(); S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp + LEVEL.hp * 2); ev('levelUp', { lvl: S.lvl }); toast(`[Level up: ${S.lvl}] Damage +${Math.round(LEVEL.dmg * 100)}%, health +${LEVEL.hp}.`, 'good'); }
    checkEvolution();
    if (S.lvl % 5 === 0 && S.lvl > (S.blessLvl || 0)) { S.blessLvl = S.lvl; S.picks.push('chest'); syncPicks(); if (S.picks.length === 1) rollOffer(); toast(`[Level ${S.lvl}] The System grants a blessing.`, 'good'); }
  }
  function heroRate() { return HC.attack ? HC.attack.rate / S.P.heroRate / (mastery('champion') ? 1.3 : 1) : 1; }
  function heroDps() {
    if (!HC.attack) return HC.ability && HC.ability.id === 'hire' ? Math.min(4, Math.floor(S.gold / 15)) * MERC.dmg / MERC.rate : 0;
    return heroDmg() / heroRate() * (mastery('whirlwind') ? 1.6 : has('wardance') ? 1.25 : 1);
  }
  /** expected wave HP divided by what the town can deal over the wave window */
  function threatRatio(n = S.night, purgeRegion = S.purge) {
    const hs = hpS(n);
    let hp = nightBudget(n) * hpPerBudget(n) * hs;
    if (isBloodMoon(n)) hp += bossesFor(n).reduce((a, k, j) => a + MOBS[k].hp * (j === 0 && S.unique && !S.unique.slain && S.unique.night === n ? S.unique.mult : 1), 0) * hs;
    { const every = Math.max(STREAM.min, STREAM.every - STREAM.drop * n) / DIFF.threat; hp += marchNests(n).length * (WAVES.duration(n) * STREAM.nightMult / every) * 2.5 * hpPerBudget(n) * hs; }   // awake hives keep sending their dead all night
    if (S.feat.heat && S.noise >= HEAT.erupt - 10) hp += (HEAT.burst + n) * DIFF.threat * 2.5 * hpPerBudget(n) * hs;
    if (purgeRegion !== null && purgeRegion !== undefined) hp += purgeBudget(purgeRegion, n) * hpPerBudget(n) * hs + MOBS.guardian.hp * hs;
    if (n === S.night) hp += S.mobs.reduce((a, m) => a + (!m.roam && !MOBS[m.kind].animal && (m.hunt || Math.hypot(m.x - c, m.y - c) < 30) ? m.hp : 0), 0);   // the dead already at your walls, or on your trail
    const dealt = (defenceDps() + heroDps() * 0.8) * WAVES.duration(n) * 1.6;
    return hp / Math.max(1, dealt);
  }
  const ratingOf = ratio => RATING.find(([lim]) => ratio < lim)[1];

  // ---------- waves ----------
  const nightLen = () => TIDE.nightLen; let todLast = 0.25;   // every night lasts its full length: the moon crosses the sky, cleared or not
  function makeWave(n) {
    const nests = marchNests(n);
    if (!nests.length) { const any = map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id)).sort((p, q) => Math.hypot(p.nest.x - c, p.nest.y - c) - Math.hypot(q.nest.x - c, q.nest.y - c)); if (any.length) nests.push(any[0].id); }
    if (n === 1 && S.purge === null && nests.length) return [{ kind: 'walker', nest: nests[0], t: 3, first: true }];
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
    if (isBloodMoon(n)) { const bs = bossesFor(n); const uq = S.unique && !S.unique.slain && S.unique.night === n; bs.forEach((kind, k) => q.push({ kind, unique: uq && k === 0, finale: k === 0 && S.season && n === S.season.end && S.season.finaleHive === undefined, nest: nests[rng.int(nests.length)], t: dur * 0.6 + rng.range(0, 6) })); }
    if (S.purge !== null) {
      let pb = purgeBudget(S.purge, n);
      const last = dur * (surges - 1) / surges;
      while (pb > 0.5) { const ok = u.filter(([, m]) => m.cost <= pb + 0.3); if (!ok.length) break; const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))]; q.push({ kind, nest: S.purge, t: last + rng.range(0, 4) }); pb -= m.cost; }
      q.push({ kind: 'guardian', nest: S.purge, t: last + 2 });
    }
    return q.sort((a, b) => a.t - b.t);
  }

  function spawnMob(kind, x, y, opts = {}) {
    const m = MOBS[kind], hs = hpS(S.night);
    const hp = m.fixedHp ? m.hp : Math.ceil(m.hp * hs * (m.weight === 0 && kind !== 'risen' ? (S.night < 10 ? Math.min(1, DIFF.threat) : DIFF.threat) : 1));   // bosses scale with the difficulty too
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
    if (b.type === 'keep') {   // the hall falls over ~30 s, not in a blink: at most 3% of its health a second, half that with the hero on its steps
      if (S.time - (b.winT || 0) >= 1) { b.winT = S.time; b.winD = 0; }
      const guarded = !S.hero.dead && Math.hypot(S.hero.x - b.x, S.hero.y - b.y) < b.r + TENSION.guardR;
      d = Math.min(d, Math.max(0, b.maxHp * TENSION.hallCap * (guarded ? TENSION.hallGuard : 1) - (b.winD || 0))); b.winD = (b.winD || 0) + d; if (d <= 0) return;
    }
    if (HC.ward && !S.hero.dead && Math.hypot(S.hero.x - b.x, S.hero.y - b.y) < 5) d *= HC.ward;
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
    b.ruined = true; b.fell = true; b.hp = 0; vacate(b, true); liveTick = -1; ev('ruin', { id: b.id });
    if (b.type === 'keep') { endRun(false); return; }
    S.cur.lost.push(b.type); S.stats.buildingsLost++; (S.cur.fellB || (S.cur.fellB = [])).push({ id: b.id, type: b.type, level: b.level });
    if (rule('raiders') && S.phase === 'night') S.gold = Math.max(0, S.gold - 2);
    if (S.phase === 'night' && !S.nightFlags.breach && b.type !== 'wall') { S.nightFlags.breach = true; ev('breach', { x: b.x, y: b.y }); toast(`[Warning: breach] The dead are inside the ${compass(b.x, b.y)} ring. Get there, or pull back to the hall.`, 'bad'); }
    // Salvage: a quarter of what the building cost (never a barricade post: no profit in losing things)
    if (has('salvage') && b.type !== 'wall') earn(Math.max(1, Math.floor(investOf(b) * (combo('salvage', 'mortar') ? 0.4 : 0.25))));
    if (b.type === 'house' && S.P.shelter) { S.stats.housesLost++; toast('A home fell. Its families hid in the safe room.', 'bad'); }
    else if (b.type === 'house') {
      // a fallen home: half its people rise with the dead (lost for good), the rest flee to the Camp (homeless until it is rebuilt)
      const folk = b.folk ?? houseCap(b), n = Math.round(folk / 2), people = n, fled = folk - n; S.mourned = (S.mourned || 0) + people;
      b.folk = 0; S.homeless = (S.homeless || 0) + fled; S.stats.fled = (S.stats.fled || 0) + fled;
      S.cur.risen += n; S.stats.risen += n; S.stats.housesLost++; S.stats.peopleLost = (S.stats.peopleLost || 0) + people;
      (S.cur.rose || (S.cur.rose = [])).push({ id: b.id, n, people, fled });
      for (let k = 0; k < n; k++) { const m = spawnMob('risen', b.x + rng.range(-1, 1), b.y + rng.range(-1, 1), { instant: false }); m.rise = 0.4; }
      crewCache = null;
      toast(n ? `A home fell. ${n === 1 ? 'One of its people rises' : `${n} of its people rise`} with the dead${fled ? `; ${fled} fled to the Camp` : ''}.` : `A home fell${fled ? `; ${fled} fled to the Camp` : ''}. Rebuild it to take them in.`, 'bad');
    } else toast(`${BUILDINGS[b.type].name} destroyed. It stays a ruin until you rebuild it.`, 'bad');
  }
  /** what a building cost to put up at its level (its rebuild price is half of this) */
  const investOf = b => { let s = 0; for (let l = 1; l <= b.level; l++) s += costOf(b.type, l); return s; };
  const rebuildCost = b => Math.max(1, Math.ceil(investOf(b) * TENSION.rebuild));
  function hitMob(m, d, src) {
    if (m.hp <= 0) return;
    if (src === 'hero' && has('execute') && (m.hp - d) / m.maxHp < 0.25) d = m.hp;
    // Marked: whatever the hero hits takes more from the towers for a few seconds (the Marked blessing makes it longer and deeper)
    if (src === 'hero') m.markT = PRESENCE.markT * (S.P.mark ? 2 : 1);
    if (src === 'tower' && m.markT > 0) d *= S.P.mark ? 1.6 : PRESENCE.mark;
    S.cur.dmg[src] = (S.cur.dmg[src] || 0) + Math.min(d, m.hp);
    m.hp -= d; m.lastHit = d; ev('hitM', { id: m.id, src, dmg: +d.toFixed(2) });
    if (m.hp <= 0) { S.cur.kills[src] = (S.cur.kills[src] || 0) + 1; S.stats.killsBy[src] = (S.stats.killsBy[src] || 0) + 1; killMob(m, src); }
  }
  function killMob(m, src) {
    const i = S.mobs.indexOf(m); if (i < 0) return;
    if (MOBS[m.kind].animal) { S.mobs.splice(i, 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: src || null, dmg: +(m.lastHit || 0).toFixed(2) }); S.food += MOBS[m.kind].food; S.stats.hunted = (S.stats.hunted || 0) + 1; ev('pickup', { id: m.id, kind: 'food', x: m.x, y: m.y, n: MOBS[m.kind].food }); if (src === 'hero') gainXp(1); return; }
    S.mobs.splice(i, 1); mobById.delete(m.id); S.kills++; ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: src || null, dmg: +(m.lastHit || 0).toFixed(2) }); addSpike(HEAT.kill); S.salvage = (S.salvage || 0) + START.salvage * (MOBS[m.kind].size >= BIG ? 4 : 1);
    if (S.bountyT > 0 && HC.ability && HC.ability.id === 'bounty' && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) <= HC.ability.radius + S.P.bountyRadius) {
      const big = MOBS[m.kind].size >= BIG, pay = (big ? HC.ability.bigGold * (mastery('warband') ? 3 : 1) : HC.ability.gold) + S.P.bountyGold;
      earn(pay); S.stats.bountyGold = (S.stats.bountyGold || 0) + pay; ev('bountyGold', { x: m.x, y: m.y, gold: pay });
    }
    if (HC.cryPays && S.hero.guardT > 0 && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 7) { earn(HC.cryPays); ev('bountyGold', { x: m.x, y: m.y, gold: HC.cryPays }); }
    if (HC.volleyPays && src === 'volley') { earn(HC.volleyPays); ev('bountyGold', { x: m.x, y: m.y, gold: HC.volleyPays }); }
    S.stats.killsByKind[m.kind] = (S.stats.killsByKind[m.kind] || 0) + 1;
    if (m.kind === 'guardian' || m.kind === 'gravelord') S.stats.bosses++;
    if (m.finale === S.season.n || (m.unique && S.unique && S.unique.season === S.season.n && S.night <= S.season.end)) finale(true);   // the season's finale monster
    if (m.unique && S.unique) { S.unique.slain = true; S.picks.push('nest'); syncPicks(); toast(`[Unique Monster slain: ${m.unique}] A legendary blessing waits at dawn.`, 'good'); if (story) { story.chron(`Killed ${m.unique}, the unique monster.`, 5, ['unique']); story.grant('uniqueSlayer'); } }
    const D = MOBS[m.kind];
    if (S.P.lifesteal && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 6) S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp + S.P.lifesteal);
    if (S.P.bounty && S.kills % 3 === 0) earn(1);
    if (src === 'hero' || src === 'volley' || src === 'merc') gainXp(MOBS[m.kind].size >= BIG ? 6 : 1);
    if (m.trial && story) story.trialWon(m.trial);
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
    const dmg = burst.dmg * Math.sqrt(hpS(S.night));
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
    if (h.hp <= 0) heroDown();
  }
  // death costs the night: back at dawn or after 30 s (whichever comes first), the towers shoot slower meanwhile,
  // and whatever you were carrying stays where you fell
  function heroDown() {
    const h = S.hero; h.dead = true; h.respawn = mastery('lifeline') ? TENSION.respawn / 3 : TENSION.respawn; h.target = null; h.path = null;
    S.cur.heroDeaths++; S.stats.heroDeaths++;
    const cs = h.carry.scrap, cf = h.carry.food, dropped = [];
    if (cs > 0) { const p = { id: S.nextId++, x: h.x, y: h.y, kind: 'scrap', n: cs, dropped: true }; S.pickups.push(p); dropped.push(`${cs} scrap`); }
    if (cf > 0) { const p = { id: S.nextId++, x: h.x + 0.5, y: h.y, kind: 'food', n: cf, dropped: true }; S.pickups.push(p); dropped.push(`${cf} food`); }
    h.carry.scrap = 0; h.carry.food = 0;
    ev('heroDie', { x: h.x, y: h.y, respawn: h.respawn, dropped: { scrap: cs, food: cf } });
    toast(`You fell. Back at the hall in ${Math.round(h.respawn)} seconds (or at dawn); the towers shoot slower without you.${dropped.length ? ` You dropped ${dropped.join(' and ')} where you fell.` : ''}`, 'bad');
  }
  function heroBack() {
    const h = S.hero; h.dead = false; h.respawn = 0; h.hp = h.maxHp; h.x = c; h.y = c + 3.5; unstickHero(); ev('heroBack');
  }
  function fire(from, x0, y0, target, dmg, src, speed = 18, extra = {}) {
    if (src !== 'hero' && has('hunter') && MOBS[target.kind] && MOBS[target.kind].size >= BIG) dmg *= 1.6;
    const p = { id: S.nextId++, x: x0, y: y0, z: from, target: target.id, tx: target.x, ty: target.y, dmg, src, speed, life: 2, enemy: false, ...extra };
    S.projectiles.push(p); ev('shot', { id: p.id, src }); if (src !== 'hero') addSpike(HEAT.shot);
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
    if (S.over) return false;
    const p = canPlace(type, x, y, rot || 0, { deep: true }); if (!p.ok) return fail(p.reason);
    if (handsFree() < 1) return useHand();
    if (!pay(type)) return false;
    S.handsUsed++;
    S.cur.built.push(type); S.stats.built++;
    placeBuilding(type, p.x, p.y, p.rot, 1);
    unstickHero();
    return true;
  }
  function pay(type) {
    if ((S.stock[type] || 0) > 0) { S.stock[type]--; return true; }
    const cost = buyCost(type); if (S.gold < cost) return fail(S.mode === 'packs' ? `None left in your packs. Buying one costs ${cost} scrap.` : 'Not enough scrap.');
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; return true;
  }
  /** how many palisade posts you can still lay: stock first, then scrap */
  function wallBudget() { return (S.stock.wall || 0) + Math.floor(S.gold / buyCost('wall')); }
  /** lay a palisade line between two cells; skips cells that don't fit, stops when you run out. Returns posts laid. */
  function buildLine(x0, y0, x1, y1, max = Infinity) {
    if (S.over) return 0;
    if (handsFree() < 1) return useHand() && 0;   // a whole line is one job
    let n = 0;
    for (const [x, y] of lineCells(x0, y0, x1, y1)) {
      if (n >= max) break;
      const p = canPlace('wall', x + 0.5, y + 0.5, 0); if (!p.ok) continue;
      if ((S.stock.wall || 0) <= 0 && S.gold < buyCost('wall')) { if (!n) fail(`A barricade post costs ${buyCost('wall')} scrap.`); break; }
      pay('wall'); S.cur.built.push('wall'); S.stats.built++; placeBuilding('wall', p.x, p.y, 0, 1); n++;
    }
    if (n) { unstickHero(); S.handsUsed++; }
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
  /** upgrade a whole palisade line at once, as far as your scrap goes. Returns posts upgraded. */
  function upgradeWall(id) {
    if (S.over) return 0;
    const run = wallRun(id); if (!run.length) return fail('Cannot upgrade.') && 0;
    { const why = raiseBlock(run[0]); if (why) return fail(why) && 0; }
    if (handsFree() < 1) return useHand() && 0;
    let n = 0;
    for (const b of run) {
      const cost = upCostOf(b); if (S.gold < cost) break;
      S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; S.stats.upgraded++; S.halfUpgrade = false; raise(b); n++;
    }
    if (n) { S.cur.upgraded.push(`wall${run[0].level + 1}×${n}`); S.handsUsed++; } else fail('Not enough scrap.');
    return n;
  }
  // a palisade on a suggested lot runs across the way to the keep
  function lotRot(lot, type) { if (type !== 'wall') return 0; const a = Math.atan2(lot.y - c, lot.x - c), q = ((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4; return [1, 3, 0, 2][q]; }
  /** why this building cannot go up a level right now ('' = it can): the one rule for upgrades, wall lines and the Guild */
  function raiseBlock(b) {
    if (!b || b.type === 'keep' || b.level >= (BUILDINGS[b.type].maxLevel || MAX_LEVEL)) return 'Cannot upgrade.';
    if (b.ruined) return 'Rebuild it first.';
    if (b.level + 1 === 3 && UNLOCKS[b.type] && !hasTech(UNLOCKS[b.type])) return `Level 3 needs a ${BUILDINGS[UNLOCKS[b.type]].name}.`;
    if (b.level >= keep.level) return `Raise the keep first: nothing grows past the keep (level ${keep.level}).`;
    if (powerLive()) { const more = ((POWER.draw[b.type] || [])[b.level] || 0) - ((POWER.draw[b.type] || [])[b.level - 1] || 0); if (more > 0 && powerIn() - powerOut() < more) return `Not enough power: that needs ${more} more.`; }
    return '';
  }
  function upgrade(id) {
    if (S.over) return false;
    const b = S.byId.get(id); { const why = raiseBlock(b); if (why) return fail(why); }
    const cost = upCostOf(b); if (S.gold < cost) return fail('Not enough scrap.');
    if (!useHand()) return false;
    S.gold -= cost; S.halfUpgrade = false; S.cur.spent += cost; S.cur.upgraded.push(`${b.type}${b.level + 1}`); S.stats.upgraded++; S.stats.goldSpent += cost;
    raise(b); return true;
  }
  function raise(b) { removeBuilding(b); const nb = placeBuilding(b.type, b.x, b.y, b.rot, b.level + 1, b.id); nb.hp = Math.min(nb.maxHp, nb.hp); if (b.type === 'house') nb.folk = (b.folk ?? houseCap(b)) + houseCap(nb) - houseCap(b); return nb; }
  function demolish(id) {
    if (S.over) return false;
    const b = S.byId.get(id); if (!b || b.type === 'keep') return fail('Cannot demolish that.');
    if (!b.ruined) earn(Math.floor(costOf(b.type) / 2)); if (b.type === 'house' && b.folk) { S.homeless = (S.homeless || 0) + b.folk; crewCache = null; } removeBuilding(b); return true;   // clearing a ruin pays nothing; a pulled-down home's family moves to the Camp
  }
  // ---------- ruins: a fallen building stays on its lot (no income, no defence) until you rebuild it by hand ----------
  function rebuild(id) {
    if (S.over) return false;
    const b = S.byId.get(id); if (!b || !b.ruined || b.type === 'keep') return fail('Nothing to rebuild there.');
    if (S.phase === 'night') return fail('Rebuild by day: nobody lays bricks with the dead at the gate.');
    const cost = rebuildCost(b); if (S.gold < cost) return fail(`Rebuilding the ${BUILDINGS[b.type].name} costs ${cost} scrap.`);
    if (b.cells.some(i => S.occ[i] >= 0 && S.occ[i] !== b.id)) return fail('Something stands in the way.');
    if (!useHand()) return false;
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost; S.stats.rebuilt = (S.stats.rebuilt || 0) + 1; (S.cur.rebuilt || (S.cur.rebuilt = [])).push(b.type);
    b.ruined = false; b.fell = false; b.hp = b.maxHp; occupy(b); liveTick = -1; crewCache = null; unstickHero();
    if (b.type === 'house') { const k = Math.min(houseCap(b), S.homeless || 0); b.folk = (b.folk || 0) + k; S.homeless = (S.homeless || 0) - k; }   // the homeless move back in
    ev('rebuild', { id: b.id, cost }); return true;
  }
  const REBUILD_ORDER = { tower: 0, house: 1, farm: 2, workshop: 3, market: 3, wall: 4, generator: 5 };
  const ruins = () => S.buildings.filter(b => b.ruined).sort((p, q) => (REBUILD_ORDER[p.type] ?? 9) - (REBUILD_ORDER[q.type] ?? 9) || p.id - q.id);
  /** rebuild every ruin you can afford, towers first, then homes, farms, barricades. Returns how many. */
  function rebuildAll(max = Infinity) {
    let n = 0; const q = S.quiet; S.quiet = true;
    try { for (const b of ruins()) { if (n >= max) break; if (S.gold >= rebuildCost(b) && rebuild(b.id)) n++; } } finally { S.quiet = q; }
    return n;
  }
  // ---------- clearing the city: rubble is cheap; a ruined block costs scrap, a pair of hands and noise ----------
  // The town grows the way you want it to, at a price. The dead cross open ground faster.
  const RUBBLE_COST = 1, BLOCK_COST = 3;
  function rubbleAt(x, y) {
    const cx = Math.floor(x), cy = Math.floor(y), cells = [];
    let blocks = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = cx + dx, yy = cy + dy; if (!inside(xx, yy)) continue;
      const i = idx(xx, yy), r = map.region[i], t = map.terrain[i];
      if ((t === T.FOREST || t === T.ROCK) && r >= 0 && inZone(i) && S.occ[i] < 0 && map.lm[i] < 0) { cells.push(i); if (t === T.ROCK) blocks++; }
    }
    return { cells, blocks, cost: (cells.length - blocks) * RUBBLE_COST + blocks * BLOCK_COST, hands: blocks > 0 };
  }
  function clearRubble(x, y) {
    if (S.over) return false;
    const { cells, cost, blocks } = rubbleAt(x, y);
    if (!cells.length) return fail('Nothing to clear on your land here.');
    if (S.gold < cost) return fail(`Clearing this costs ${cost} scrap.`);
    if (blocks && !useHand()) return false;
    S.gold -= cost; S.cur.spent += cost; S.stats.goldSpent += cost;
    if (blocks) { addSpike(blocks * 1.5); S.stats.blocksDown = (S.stats.blocksDown || 0) + blocks; }
    for (const i of cells) map.terrain[i] = map.terrain[i] === T.ROCK ? T.DIRT : T.GRASS;
    (S.clearedIdx || (S.clearedIdx = [])).push(...cells);
    S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; S.cleared = (S.cleared || 0) + cells.length;
    ev('clear', { cells });
    return cells.length;
  }
  // ---------- landmarks: walk up to one and pay to claim it ----------
  function landmarkReach(l) { return Math.hypot(S.hero.x - l.x, S.hero.y - l.y) <= l.size / 2 + 2.6; }
  function claimLandmark(id) {
    const l = S.landmarks[id]; if (!l || l.owned) return false;
    const L = LANDMARKS[l.kind];
    if (S.over) return false;
    if (S.hero.dead || !landmarkReach(l)) return fail(`Walk up to the ${L.name} to claim it.`);
    if (l.kind === 'unknown' || S.sealed[l.region]) return fail('That district is still sealed.');
    if (S.gold < L.cost) return fail(`Claiming the ${L.name} costs ${L.cost} scrap.`);
    S.gold -= L.cost; S.cur.spent += L.cost; S.stats.goldSpent += L.cost;
    return takeSite(l);
  }
  function takeSite(l) {
    const L = LANDMARKS[l.kind], id = l.id;
    l.owned = true; S.occVersion = (S.occVersion || 0) + 1;
    if (l.kind === 'tvtower' || L.reveal) { S.seen.fill(1); S.seenVersion++; } else reveal(l.x, l.y, l.kind === 'eiffel' ? 22 : 9);
    if (L.survivors) S.survivors += L.survivors;
    gainXp(15);   // (the path leans on choices only: claiming a site no longer leans Wits)
    S.stats.sites = (S.stats.sites || 0) + 1;
    ev('landmark', { id }); toast(`[Site claimed: ${L.name}] ${L.desc}`, 'good');
    if (story) { S.story.quests = S.story.quests.filter(q => q.site !== id); story.chron(`Claimed the ${L.name}.`, 3); }
    return true;
  }
  /** what the next town hall level still needs besides scrap (empty = ready) */
  // the hall is gated on food INCOME (the town can feed itself with room to spare) and people, never on food in store
  const foodPerDawn = () => Math.round(S.buildings.reduce((a, b) => a + (b.type === 'farm' && !b.ruined ? farmFood(b) : 0), 0) * prosper()) + S.landmarks.reduce((a, l) => a + (l.owned ? LANDMARKS[l.kind].food || 0 : 0), 0);
  function keepNeeds() {
    const n = KEEP.need[keep.level]; if (!n) return [];
    const out = [];
    if (n.foodNet !== undefined && foodPerDawn() - foodNeed() < n.foodNet) out.push(`food income ${foodNeed() + n.foodNet} a dawn (now ${foodPerDawn()})`);
    if (n.food && S.food < n.food) out.push(`${n.food} food in store`);
    if (pop() < n.people) out.push(`${n.people} people`);
    if (n.won && S.stats.regionsClaimed + (S.stats.sites || 0) < n.won) out.push('a hive burned or a site claimed');
    return out;
  }
  function upgradeKeep() {
    if (S.over || keep.level >= 3) return fail('Cannot raise the keep.');
    { const miss = keepNeeds(); if (miss.length) return fail(`The town hall needs more first: ${miss.join(', ')}.`); }
    const cost = KEEP.cost[keep.level]; if (S.gold < cost) return fail('Not enough scrap.');
    if (!useHand()) return false;
    S.gold -= cost; S.food -= (KEEP.need[keep.level] || {}).food || 0; S.cur.spent += cost;   // (no level asks for food now; if one does, keepCost() says so) S.cur.upgraded.push(`keep${keep.level + 1}`); S.stats.goldSpent += cost;
    keep.level++; const m = keepMaxHp(); keep.hp += m - keep.maxHp; keep.maxHp = m; keep.r = 2.3 * (1 + 0.12 * (keep.level - 1));
    ev('keepUp'); checkFeatures(); return true;
  }
  function planPurge(r) {
    if (r !== null && map.regions[r] && keep.level < keepForRing(map.regions[r].ring)) return fail(`Raise the keep to level ${keepForRing(map.regions[r].ring)} first.`);
    if (r === null) { S.purge = null; return true; }
    if (!canPurge(r)) return fail('You can only march on a nest next to your land.');
    S.purge = r; return true;
  }
  function fail(msg) { if (!S.quiet) ev('fail', { msg }); return false; }

  function startNight(dusk = false) {
    if (S.phase !== 'day' || S.over || S.story.encounters.length) return false;   // no bell: dusk comes with the sun (tests and bots may still skip ahead)
    S.dayQueue = [];
    refreshFlow(); cacheNeighbours();
    S.phase = 'night'; crewCache = null; crewing(); S.queue = makeWave(S.night); S.qT = 0; S.nightFlags = {}; S.ability.hires = 0; S.trade = null;
    for (const b of S.buildings) b.fell = false;
    const purgeReg = S.purge;
    Object.assign(S.cur, {
      goldAtBell: S.gold, pop: pop(), town: townCounts(), defDps: +defenceDps().toFixed(1), heroDps: +heroDps().toFixed(1),
      wave: S.queue.length, waveHp: Math.round(S.queue.reduce((a, q) => a + (MOBS[q.kind].fixedHp ? MOBS[q.kind].hp : Math.ceil(MOBS[q.kind].hp * hpS(S.night))), 0)),
      ratio: +threatRatio(S.night, purgeReg).toFixed(2), forecast: forecastStrip(), noise: Math.round(S.noise || 0), standing: S.buildings.filter(b => !b.ruined).length, purge: purgeReg, nests: activeNests().length, claimed: claimedCount(), bloodMoon: isBloodMoon(S.night),
    });
    if (!CUT.crew) sc.nightfall(keep);
    { const rt = ratingOf(S.cur.ratio); if (rt === 'Hard' || rt === 'Impossible') toast(`[Warning: ${rt}] Tonight is stronger than your defences. Expect the outer ring to break: keep the hero near the homes.`, 'bad'); }
    ev('night', { n: S.night, bloodMoon: isBloodMoon(S.night) });
    toast(isBloodMoon(S.night) ? `Blood moon. Night ${S.night} begins.` : `Dusk. Night ${S.night}: the dead come in force.`, isBloodMoon(S.night) ? 'bad' : undefined);
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
    for (const m of S.mobs) if (m.roam && !MOBS[m.kind].animal) have.set(m.roam.region, (have.get(m.roam.region) || 0) + 1);
    let total = S.mobs.filter(m => m.roam && !MOBS[m.kind].animal).length;
    for (const reg of map.regions) {
      if (S.claimed.has(reg.id) || reg.ring < 1 || S.sealed[reg.id]) continue;
      const ring = Math.min(2, reg.ring), want = Math.round(R.perRing[ring] * Math.min(1, 0.4 + S.night / 10)) + Math.floor(S.night / (ring >= 2 ? 3 : 8));   // the streets fill up as the nights go on
      for (let k = have.get(reg.id) || 0; k < want && total < R.cap; k++) {
        let spot = null;
        for (let t = 0; t < 20 && !spot; t++) {
          const sp = ring >= 2 ? 9 : 7, x = reg.x + rng.range(-sp, sp), y = reg.y + rng.range(-sp, sp), cx = Math.floor(x), cy = Math.floor(y);
          if (inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && map.region[idx(cx, cy)] === reg.id && S.occ[idx(cx, cy)] < 0 && baseDist(x, y) > 8) spot = { x, y };
        }
        if (!spot) break;
        const kind = ring >= 2 ? rng.pick(S.night >= 6 ? ['walker', 'runner', 'walker', 'brute'] : ['walker', 'runner', 'walker']) : rng.next() < 0.22 ? 'runner' : 'walker';
        const m = spawnMob(kind, spot.x, spot.y, { instant: true });
        const tough = 1 + 0.6 * (ring - 1); m.hp = m.maxHp = Math.ceil(m.maxHp * tough);
        m.roam = { x: spot.x, y: spot.y, region: reg.id }; total++;
      }
    }
  }
  // the woods: a few herds of deer, and from the second night wolves (both are food)
  function spawnAnimals() {
    const A = TIDE.roam.animals, wild = map.regions.filter(r => r.ring === 1);
    const have = k => S.mobs.filter(m => m.kind === k).length;
    const herd = (kind, size) => {
      for (let t = 0; t < 30; t++) {
        const reg = wild[rng.int(wild.length)], x = reg.x + rng.range(-8, 8), y = reg.y + rng.range(-8, 8), cx = Math.floor(x), cy = Math.floor(y);
        if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || map.region[idx(cx, cy)] !== reg.id || Math.hypot(x - c, y - c) < 16 || S.occ[idx(cx, cy)] >= 0) continue;   // away from the camp (claimed sites don't count)
        for (let k = 0; k < size; k++) { const m = spawnMob(kind, x + rng.range(-1, 1), y + rng.range(-1, 1), { instant: true }); m.roam = { x, y, region: reg.id }; }
        return true;
      }
      return false;
    };
    for (let t = 0; t < 12 && have('deer') < A.deer * 2.5; t++) if (!herd('deer', 2 + rng.int(2))) break;
    if (S.night >= 2) for (let t = 0; t < 8 && have('wolf') < A.wolves * 2; t++) if (!herd('wolf', 2)) break;
  }
  function clearRoamers(region) {
    for (const m of S.mobs.filter(q => q.roam && q.roam.region === region && !MOBS[q.kind].animal)) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: 'cleared', dmg: 0 }); }
  }
  /** a roamer wanders near home, chases the hero who comes close, and never walks on the town */
  function stepRoamer(m, dt, speed) {
    const R = TIDE.roam, h = S.hero, home = m.roam, rank = rankOf(m);
    if (m.smoke > 0) m.smoke -= dt;
    if (m.lure) { m.lure.t -= dt; if (m.lure.t <= 0) m.lure = null; else { if (Math.hypot(m.lure.x - m.x, m.lure.y - m.y) > 1) moveToward(m, m.lure.x, m.lure.y, speed * dt); return; } }
    if (m.kind === 'deer') {   // deer graze, and bolt when you come close
      const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
      if (hd < 6) m.flee = 1.6;
      if (m.flee > 0) { m.flee -= dt; const ox = m.x, oy = m.y; moveToward(m, m.x + (m.x - h.x) * 4, m.y + (m.y - h.y) * 4, speed * 1.2 * dt); if (!standable(m, m.x, m.y)) { m.x = ox; m.y = oy; m.wp = null; } return; }
    }
    if (m.lost && Math.hypot(m.x - c, m.y - c) < 26 && !(rng.next() < 0.995)) { m.roam = null; m.lost = false; return; }   // a straggler from the night that wanders near the town again
    // now and then a roamer next to your land drifts in and walks on the town
    if (!MOBS[m.kind].animal && S.clock && S.night >= 2 && home.region >= 0 && baseDist(home.x, home.y) < (S.heat >= HEAT.stir ? 20 : 12) && rng.next() < TIDE.drift * Math.min(1, S.night / 6) * (S.heat >= HEAT.stir ? 2.5 : 1) * (rule('fog') ? 1.5 : 1) * dt) { m.roam = null; ev('drift', { id: m.id }); return; }
    const fromHome = Math.hypot(m.x - home.x, m.y - home.y);
    const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y), heroHome = inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    // once a roamer has your scent it hunts you: it follows you home and joins the attack on the town
    const sight = Math.max(R.sight, BRAIN.sense[rank]) * senseMult(m), lose = Math.max(R.lose, sight * BRAIN.forget[rank]);
    // [road] begin
    if (road && !m.hunt && hd < sight && road.unseen(hd, sight)) return;   // lantern off: it stops and sniffs the air
    // [road] end
    if (m.kind !== 'deer' && !m.hunt && !h.dead && !(m.giveUp > S.time) && hd < sight - (S.story.flags.quiet ? 1.5 : 0) && !heroHome && (m.warden || huntN < huntCap()) && (!m.warden || Math.hypot(h.x - home.x, h.y - home.y) < R.leash)) aggro(m);
    if (m.hunt && (h.dead || hd > lose || Math.hypot(m.x - home.x, m.y - home.y) > (m.warden ? R.leash + 4 : 30))) { m.hunt = false; m.giveUp = S.time + 8; m.wp = { x: home.x, y: home.y }; }   // nobody follows you more than 30 cells from its ground (and it walks home before it tries again)
    if (m.hunt && !m.warden && heroHome && baseDist(m.x, m.y) < 4) { if (S.night < 4 || MOBS[m.kind].animal || rng.next() < 0.7) { m.hunt = false; m.wp = { x: home.x, y: home.y }; } else { m.roam = null; m.hunt = false; ev('drift', { id: m.id }); return; } }
    if (m.hunt || (m.tauntT > 0 && !h.dead)) {
      m.face = Math.atan2(h.x - m.x, h.y - m.y);
      if (hd > 0.9) moveToward(m, h.x, h.y, speed * (R.chase[m.kind] || 1.2) * dt); else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; hurtHero(MOBS[m.kind].dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); } }
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

  // ---------- pickups: little finds in the open streets, worth a detour while you explore ----------
  const PICKUP = { start: 18, perDawn: 4, max: 26, apart: 12 };   // a find now and then, not every few steps
  function scatterPickups(n) {
    for (let k = 0, tries = 0; k < n && tries < n * 30 && S.pickups.length < PICKUP.max; tries++) {
      const x = rng.int(N), y = rng.int(N), i = idx(x, y), r = map.region[i];
      if (r < 0 || S.sealed[r] || !PASSABLE[map.terrain[i]] || !map.reach[i] || S.occ[i] >= 0 || inZone(i) || map.lm[i] >= 0) continue;
      if (S.pickups.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < PICKUP.apart)) continue;
      S.pickups.push({ id: S.nextId++, x: x + 0.5, y: y + 0.5, kind: rng.next() < 0.55 ? 'scrap' : 'food' }); k++;
    }
  }
  // finds out in the wild are carried: they count once you are back on your land (and stay where you fall if you die)
  function stepPickups() {
    const h = S.hero; if (h.dead) return;
    const home = inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    for (const p of [...S.pickups]) if (Math.abs(p.x - h.x) < 0.9 && Math.abs(p.y - h.y) < 0.9) {
      S.pickups.splice(S.pickups.indexOf(p), 1);
      const v = p.n || 2 + Math.floor(S.night / 4); p.n = v;
      if (home) { if (p.kind === 'scrap') earn(v); else S.food += v; } else h.carry[p.kind] += v;
      if (!p.dropped) S.stats.pickups = (S.stats.pickups || 0) + 1;
      ev('pickup', { id: p.id, kind: p.kind, x: p.x, y: p.y, n: p.n, carried: !home });
    }
    if (home) depositCarry();
  }
  function depositCarry() {
    const h = S.hero, cs = h.carry.scrap, cf = h.carry.food; if (!cs && !cf) return;
    earn(cs); S.food += cf; h.carry.scrap = 0; h.carry.food = 0;
    ev('deposit', { scrap: cs, food: cf }); toast(`Home with **${[cs ? `${cs} scrap` : '', cf ? `${cf} food` : ''].filter(Boolean).join(' and ')}**.`, 'good');
  }
  // ---------- supply drops: after big nights a crate comes down in the wild, guarded ----------
  const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function compass(x, y) { const a = Math.atan2(x - c, -(y - c)); return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
  function dropSupply(why) {
    if (!S.clock) return;
    let spot = null;
    for (let t = 0; t < 60 && !spot; t++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(22, 50), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y);
      if (!inside(cx, cy)) continue; const i = idx(cx, cy);
      if (!PASSABLE[map.terrain[i]] || !map.reach[i] || S.occ[i] >= 0 || inZone(i) || baseDist(x, y) < 7 || S.sealed[map.region[i]]) continue;
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
    if (d.reward === 'blueprint') { S.stock.tower = (S.stock.tower || 0) + 1; S.stock.house = (S.stock.house || 0) + 1; if (CUT.walls) { earn(8); msg = 'Plans and parts: a free tower, a free home and 8 scrap of fittings.'; } else { S.stock.wall = (S.stock.wall || 0) + 6; msg = 'Plans and parts: a free tower, a free home and 6 barricade posts.'; } }
    else if (d.reward === 'cache') { const g = 10 + 2 * S.night; S.hero.carry.scrap += g; msg = `A cash box: **${g} scrap** to carry home.`; }
    else if (d.reward === 'blessing') { S.picks.push('chest'); syncPicks(); if (S.picks.length === 1) rollOffer(); msg = 'A sealed case: a rare blessing.'; }
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
    if (S.season && S.season.finaleHive === r && S.night <= S.season.end) finale(true);
    for (const m of S.mobs) if (m.stream === r) m.stream = -1;
    ev('claim', { region: r }); toast(`The hive burns: +${loot} scrap and a rare blessing. New hives stir beyond it.`, 'good');
  }
  // ---------- the stream: the dead never stop coming from awake hives, day and night ----------
  const streamAcc = {}, hiveDmg = {}, rage = {};
  const hiveMax = r => Math.round(STREAM.hiveHp * (map.regions[r].ring <= 1 ? 1.8 : 1 + 0.6 * (map.regions[r].ring - 1)) * hpS(S.night));
  function stepStream(dt) {
    if (!S.clock || S.night < 2 && !(S.phase === 'night' && S.qT > 15)) return;
    const n = S.night, every = Math.max(STREAM.min, STREAM.every - STREAM.drop * n) / DIFF.threat, mult = S.phase === 'night' ? STREAM.nightMult : 1;
    const nests = new Set(activeNests(n)); for (const r in rage) if (rage[r] > 0) { nests.add(+r); rage[r] -= dt; }
    const u = unlocked(Math.max(1, n - 1));
    for (const r of nests) {
      if (!S.nestAlive[r] || ((S.sealed[r] || S.night < 5) && !(rage[r] > 0))) continue;   // the near hives only send their dead by night until the first blood moon (unless you anger one)
      streamAcc[r] = (streamAcc[r] || rng.range(0, every)) + dt * mult * (rage[r] > 0 ? STREAM.rage : 1);
      while (streamAcc[r] >= every) {
        streamAcc[r] -= every;
        const [kind] = u[rng.weighted(u.map(([, m]) => m.weight))];
        const m = spawnAtNest(kind, r);
        if (hears(r) || rage[r] > 0) m.stream = r;
        else { m.roam = { x: m.x, y: m.y, region: r }; if (S.mobs.filter(q => q.roam && q.roam.region === r).length > 30) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); } }   // too far to hear the camp: the city fills up instead
      }
    }
  }
  /** the hero hits a hive: it bleeds, it rages (pours out the dead), and at zero it burns */
  function hitHive(r, d) {
    const reg = map.regions[r];
    if (keep.level < keepForRing(reg.ring)) { if (!S.nightFlags.keepWarn) { S.nightFlags.keepWarn = true; fail(`This hive is too strong: raise the keep to level ${keepForRing(reg.ring)} first.`); } return false; }
    if (!hiveDmg[r]) { toast('You strike the hive. It wakes and pours out its dead!', 'bad'); if (S.wake[r] > S.night) S.wake[r] = S.night; }
    // [road] begin
    if (road) d *= road.hiveMult(r);
    // [road] end
    hiveDmg[r] = (hiveDmg[r] || 0) + d * (S.story && S.story.flags.hiveTip ? 1.15 : 1); rage[r] = STREAM.rageTime;
    ev('hitHive', { region: r, hp: Math.max(0, 1 - hiveDmg[r] / hiveMax(r)) });
    if (hiveDmg[r] >= hiveMax(r)) { gainXp(40); burnHive(r); hiveFall(r); S.picks.push('nest'); syncPicks(); if (S.picks.length === 1) rollOffer(); dropSupply('The hive is ash.'); delete hiveDmg[r]; delete rage[r]; }
    return true;
  }
  const hiveHealth = r => (S.nestAlive[r] ? Math.max(0, 1 - (hiveDmg[r] || 0) / hiveMax(r)) : 0);

  // ---------- noise: a loud camp draws the dead; past the limit a hive bursts ----------
  // (kept the old names: heatFloor, addHeat, S.heat mirrors S.noise for old readers)
  const heatFloor = () => Math.min(100, Math.max(0, noiseBase()));
  /** a story choice (or any lasting deed): moves the meter for nights, fading a fifth each dawn */
  function addHeat(v) {
    if (!S.clock || S.over || !S.feat.heat || !v) return;
    const k = v > 0 ? noiseCalm() : 1;
    S.noiseChoice = Math.max(-NOISE.choiceMax, Math.min(NOISE.choiceMax, (S.noiseChoice || 0) + v * k));
    S.noise = Math.max(0, Math.min(100, noiseBase() + S.noiseSpike)); S.heat = S.noise;
  }
  /** fighting: a spike that fades in seconds; fighting alone never pushes the meter past HEAT.combatMax */
  function addSpike(v) {
    if (!S.clock || S.over || !S.feat.heat) return;
    S.noiseSpike = Math.max(0, Math.min((S.noiseSpike || 0) + v * noiseCalm(), HEAT.combatMax - noiseBase()));
  }
  const hiveOpen = r => !S.sealed || !S.sealed[r];
  function stepHeat(dt) {
    if (!S.clock || !S.feat.heat) { S.noise = S.heat = 0; S.noiseSpike = 0; return; }
    S.noiseSpike = Math.max(0, (S.noiseSpike || 0) * (1 - HEAT.decay * dt));
    S.noise = Math.max(0, Math.min(100, noiseBase() + S.noiseSpike)); S.heat = S.noise;
    S.heatCool = Math.max(0, S.heatCool - dt);
    if (S.eruption) { S.eruption.t -= dt; if (S.eruption.t <= 0) erupt(); return; }
    if (S.noise >= HEAT.erupt && S.heatCool <= 0 && S.night >= 2) warnEruption();
  }
  function warnEruption() {
    const cands = activeNests().map(r => map.regions[r]);
    if (!cands.length) { S.heatCool = 30; return; }
    cands.sort((a, b) => Math.hypot(a.nest.x - c, a.nest.y - c) - Math.hypot(b.nest.x - c, b.nest.y - c));
    const r = cands[0];
    S.eruption = { region: r.id, t: HEAT.warn, x: r.nest.x, y: r.nest.y };
    ev('eruptWarn', { region: r.id, x: r.nest.x, y: r.nest.y });
    toast(`[Warning] The town is too loud. The hive to the ${compass(r.nest.x, r.nest.y)} is swelling: it bursts in ${HEAT.warn} seconds.`, 'bad');
  }
  function erupt() {
    const r = S.eruption.region; S.eruption = null; S.heatCool = HEAT.cool; S.noiseSpike = 0; S.noiseChoice = Math.min(S.noiseChoice || 0, Math.max(0, (S.noiseChoice || 0) + HEAT.after));   // the burst spends the fighting noise and most of the choices'
    if (!S.nestAlive[r]) return;
    rage[r] = STREAM.rageTime; if (S.wake[r] > S.night) S.wake[r] = S.night;
    const u = unlocked(Math.max(1, S.night)), n = Math.round((HEAT.burst + S.night) * DIFF.threat);
    for (let k = 0; k < n; k++) { const [kind] = u[rng.weighted(u.map(([, m]) => m.weight))]; const m = spawnAtNest(kind, r); m.stream = r; }
    const nest = map.regions[r].nest; reveal(nest.x, nest.y, 4);
    ev('erupt', { region: r, x: nest.x, y: nest.y }); toast('The hive bursts! The dead pour out toward the noise.', 'bad');
    S.stats.eruptions = (S.stats.eruptions || 0) + 1;
  }
  // ---------- districts: sealed behind quarantine fences; the story opens them one at a time ----------
  const distRng = new Rng(hashSeed(seed, 'districts'));
  const siteOf = r => S.landmarks.find(l => l.region === r);
  for (const l of S.landmarks) if (LANDMARKS[l.kind].signature) S.kits[l.region] = 'signature';
  /** what a district is: decided the first time it is offered */
  function kitFor(r, force) {
    if (S.kits[r]) return S.kits[r];
    const reg = map.regions[r], odds = RARITY_ODDS[Math.min(2, Math.max(1, reg.ring))];
    const used = {}; for (const k of Object.values(S.kits)) used[k] = (used[k] || 0) + 1;
    const ok = id => (used[id] || 0) < (KITS[id].max || 9);
    const rars = Object.keys(odds); let rar = force || rars[distRng.weighted(rars.map(k => odds[k]))];
    let pool = Object.keys(KITS).filter(id => KITS[id].rarity === rar && ok(id));
    if (!pool.length) pool = Object.keys(KITS).filter(ok);
    if (!pool.length) pool = ['flats'];
    return (S.kits[r] = pool[distRng.int(pool.length)]);
  }
  const kitInfo = r => { const k = kitFor(r); if (k === 'signature') { const l = siteOf(r); return { id: k, name: LANDMARKS[l.kind].name, rarity: 'legendary', lm: l.kind, call: 'It stands over the whole city. From up there you could see everything.' }; } return { id: k, ...KITS[k] }; };
  // the home ward: the near districts with no hive are open from day 1 (common finds: a place to look around)
  for (const reg of map.regions) if (reg.ring >= 1 && !S.sealed[reg.id] && S.kits[reg.id] !== 'signature') { const l = siteOf(reg.id); if (l && l.kind === 'unknown') l.kind = KITS[kitFor(reg.id, reg.ring === 1 ? 'common' : undefined)].lm; }
  /** sealed districts that touch one you hold */
  function frontier() { return map.regions.filter(r => S.sealed[r.id] && r.neighbors.some(n => !S.sealed[n])).map(r => r.id); }
  function districtOffer(r) { const k = kitInfo(r), reg = map.regions[r]; return { region: r, kit: k.id, name: k.name, rarity: k.rarity, call: k.call, lm: k.lm, dir: compass(reg.x, reg.y), nest: !!(reg.nest && S.nestAlive[r]), ring: reg.ring }; }
  function openDistrict(r, why) {
    if (!S.sealed[r]) return false;
    const k = kitInfo(r), l = siteOf(r);
    S.sealed[r] = 0; S.sealVersion++; S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1;
    if (l && l.kind === 'unknown') l.kind = k.lm;
    revealRegion(r);
    S.stats.districts = (S.stats.districts || 0) + 1; gainXp(10);
    ev('district', { region: r, kit: k.id });
    toast(`[District opened: ${k.name}] ${why || ''}${map.regions[r].nest && S.nestAlive[r] ? ' A hive nests there: it will pour out its dead now.' : ''}`.trim(), 'good');
    spawnRoamers();
    return true;
  }

  // ---------- pacing: the systems arrive one at a time, each with its own System window ----------
  function checkFeatures() {
    for (const [k, F] of Object.entries(FEATURES)) if (!S.feat[k] && !(k === 'power' && CUT.power) && F.when(S, api)) { S.feat[k] = true; ev('window', { ...F.win, feat: k }); }
  }
  // CUT.titleStats: titles stay as flavour; their stat effects (applied by the story) are undone here
  let titlesSeen = 0;
  function untitle() {
    const T = S.story && S.story.titles; if (!CUT.titleStats || !T || T.length === titlesSeen) return;
    let changed = false;
    for (; titlesSeen < T.length; titlesSeen++) for (const f of (TITLES[T[titlesSeen]] || {}).fx || []) {
      if (f.op === 'perk') { if (f.mul) S.P[f.key] /= f.mul; else S.P[f.key] -= f.add; changed = true; }
      else if (f.op === 'power') S.story.power -= f.n;
      else if (f.op === 'hands') S.story.hands -= f.n;
      // ('flag': the children's garden is the thread's reward, not the title's stat: it stays)
    }
    if (changed) refreshMax();
  }
  // ---------- seasons: an arc every SEASON_LEN nights, with a rule and a finale on its last blood moon ----------
  // a season's rules live in S.season.rules (a won contract's rules stack); S.season.rule is the newest, for old readers
  const RULE_ALIAS = { lightsout: 'lightsOut', 'lights-out': 'lightsOut' };
  const rule = id => { if (!S.season) return false; const list = S.season.rules || [], a = RULE_ALIAS[id] || id; return list.some(r => (RULE_ALIAS[r] || r) === a) || (RULE_ALIAS[S.season.rule] || S.season.rule) === a; };
  const ADJ = ['Hollow', 'Weeping', 'Iron', 'Burning', 'Silent', 'Thousand-Handed', 'Pale', 'Drowned'], NOUN = ['Choir', 'Shepherd', 'Matron', 'Engine', 'Bride', 'Tide', 'Bellringer', 'Warden'];
  function startSeason(n) {
    const seasonRng = new Rng(hashSeed(seed, 'season', n));
    const def = SEASONS[n - 1] || { id: `gen${n}`, name: SEASON_POOL.names[seasonRng.int(SEASON_POOL.names.length)], blurb: 'The city changes again. Something new learned your name.', rule: SEASON_POOL.rules[seasonRng.int(SEASON_POOL.rules.length)], finale: `The ${ADJ[seasonRng.int(ADJ.length)]} ${NOUN[seasonRng.int(NOUN.length)]}` };
    const kept = S.season && S.season.won ? (S.season.rules || []) : [];   // a won contract's rules stay with you
    const rules = [...new Set([...kept, ...(def.rule ? [def.rule] : [])])];
    S.season = { n, id: def.id, name: def.name, rule: def.rule || null, rules, finale: def.finale, end: seasonEnd(n), start: S.night, won: false };
    if (n >= 2 && !(S.unique && !S.unique.slain && !S.unique.escaped)) S.unique = { name: def.finale, mult: 1.5 + 0.25 * (n - 1), night: seasonEnd(n), season: n };
    S.weather = rollWeather(S.night);
    if (story) story.seasonCard(def, n, def.rule ? RULES[def.rule] : null);
  }
  // ---------- contracts (engine side; the offer, card and words live in sim/contracts.js) ----------
  /** the season's finale is decided: its unique died (or its finale hive burned) in time, or the season ran out */
  function finale(won) {
    if (!S.season || S.season.finaleDone) return;
    S.season.finaleDone = true; S.season.won = !!won;
    ev('finale', { won: !!won, season: S.season.n, name: S.season.finale, night: S.night });
    if (won) contractWon();
  }
  /** a won contract: the difficulty curve steps back ~40% of the nights this season ran (night N then plays like
   *  N − 0.4×(N − season start)); the rules you chose stay. Idempotent per season. */
  function contractWon(share = 0.4) {
    if (!S.season || S.season.contractWon) return false;
    S.season.contractWon = true; S.season.won = true;
    const back = +(Math.max(0, Math.min(1, +share || 0)) * Math.max(0, S.night - (S.season.start || 1))).toFixed(2);
    S.diffNight = +((S.diffNight || 0) + back).toFixed(2);
    ev('contractWon', { season: S.season.n, back, diffNight: S.diffNight });
    return true;
  }
  /** contracts.js sets the rules it offered (and the player chose); they stack with the ones a won contract kept */
  function setSeasonRules(rules = []) {
    const list = [...new Set(rules.filter(Boolean))];
    S.season.rules = list; S.season.rule = list[list.length - 1] || null; S.weather = rollWeather(S.night); floorKey = '';
    return list;
  }
  /** contracts.js names the finale: { kind: 'unique', name, mult } (the season's last blood moon) or { kind: 'hive', region } */
  function setFinale(f = {}) {
    if (f.kind === 'hive' && map.regions[f.region] && map.regions[f.region].nest) { S.season.finaleHive = f.region; if (f.name) S.season.finale = f.name; return true; }
    if (f.kind === 'unique') { S.season.finaleHive = undefined; S.season.finale = f.name || S.season.finale; S.unique = { name: S.season.finale, mult: f.mult || (S.unique && S.unique.mult) || 1.5, night: f.night || S.season.end, season: S.season.n }; return true; }
    return false;
  }
  function metroSpot() {
    for (let t = 0; t < 30; t++) { const a = rng.range(0, Math.PI * 2), d = rng.range(6.5, 10), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, cx = Math.floor(x), cy = Math.floor(y); if (inside(cx, cy) && PASSABLE[map.terrain[idx(cx, cy)]] && S.occ[idx(cx, cy)] < 0) return { x: cx + 0.5, y: cy + 0.5 }; }
    return null;
  }
  const partySize = () => PARTY.base + (keep.level >= 3 && !CUT.secondCompanion ? PARTY.keep3 : 0);   // the second companion slot is parked

  // the town learns to build by itself once it is established
  function checkForeman() {
    if (S.foreman || keep.level < FOREMAN.keep || S.buildings.filter(b => b.type !== 'wall').length < FOREMAN.buildings) return;
    S.foreman = true; ev('skill', { id: 'foreman' });
    toast('[Skill acquired: Foreman] Your people **can** build and upgrade by themselves now. It is **off**: switch it on in the **build menu** when you want to step away.', 'win');
  }

  function dawn() {
    S.phase = 'day'; S.dawns++; S.handsUsed = 0; S.chestsToday = 0;
    let foodIn = CUT.crew ? 0 : sc.dawnFood(), hg = 0;
    for (const b of S.buildings) { if (b.ruined) continue; if (b.type === 'farm') foodIn += farmFood(b); if (b.type === 'house') hg += houseGold(b); }   // ruins pay nothing
    foodIn = Math.round(foodIn * prosper() * W8().food) + S.landmarks.reduce((a, l) => a + (l.owned ? LANDMARKS[l.kind].food || 0 : 0), 0);   // farms and the sites you hold
    S.food += foodIn;
    const need = foodNeed(), fed = need === 0 ? 1 : Math.min(1, S.food / need);
    S.food = Math.max(0, S.food - need);
    const upk = upkeep();
    const salv = Math.min(8 + S.night, Math.floor(S.salvage || 0)); S.salvage = 0;   // what the town can haul in a morning
    let goldIn = Math.round((START.baseIncome * DIFF.eco + S.P.tax + hg * fed) * prosper()) - upk + salv;
    if (has('granary')) goldIn += Math.floor(S.food / 5);
    for (const l of S.landmarks) if (l.owned) { const L = LANDMARKS[l.kind]; goldIn += L.gold || 0; if (L.reveal && S.night % 2 === 0) { S.survivors++; toast('A survivor followed the broadcast to your gates.', 'good'); } }
    if (owns('tvtower')) goldIn += 3;
    if (HC.quarter) { goldIn += 4; S.food += 2; }
    S.gold = Math.max(0, S.gold + goldIn); S.stats.goldEarned += Math.max(0, goldIn);
    let claimedNow = null, nestPick = false;
    if (S.purge !== null) { claimedNow = S.purge; burnHive(S.purge); nestPick = true; S.purge = null; }
    // Merchant Guild: free tower upgrades, by the same rules as any upgrade (hall level, Workshop, power)
    if (has('guild')) {
      let free = Math.floor(S.buildings.filter(b => b.type === 'house' && !b.ruined).length / 4), done = 0;
      while (free-- > 0) { const t = S.buildings.filter(b => b.type === 'tower' && !raiseBlock(b)).sort((a, b) => a.level - b.level || a.id - b.id)[0]; if (!t) break; raise(t); done++; }
      if (done) toast(`The guild raises ${done === 1 ? 'a tower' : `${done} towers`} for free.`, 'good');
    }
    // the ledger: what the night took, said once, at dawn
    const fellB = S.cur.fellB || [], roseB = S.cur.rose || [], held = Math.max(0, Math.round(100 * (S.cur.keepMin ?? keep.hp / keep.maxHp)));
    closeLog({ goldIn, foodIn, foodNeed: need, fed: +fed.toFixed(2), claimedNow, held });
    // ruins stay ruins until you rebuild them by hand (api.rebuild): only standing buildings mend overnight
    for (const b of S.buildings) { if (!b.ruined) b.hp = b.maxHp; b.fell = false; }
    liveTick = -1;
    if (S.hero.dead) heroBack();   // the dead hero is back at dawn at the latest
    { const left = S.buildings.filter(b => b.ruined); S.ledger = { night: S.night, fell: fellB, rose: roseB, held, people: roseB.reduce((a, r) => a + r.people, 0), ruins: left.length, rebuildAll: left.reduce((a, b) => a + rebuildCost(b), 0), kills: Object.values(S.cur.kills || {}).reduce((a, b) => a + b, 0), heroDowns: S.cur.heroDeaths || 0, ...(road ? road.missions.report() : {}) };
      ev('ledger', S.ledger); }
    keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * 0.25);
    S.hero.hp = S.hero.maxHp; S.hero.guardT = 0;
    if (S.P.kingpin && S.allies.length) { earn(S.allies.length); for (const a of S.allies) a.hp = a.maxHp; }
    if (S.allies.length && !S.P.loyal) { for (const a of S.allies.filter(q => !q.comp)) ev('allyGone', { id: a.id }); S.allies = S.allies.filter(q => q.comp); }
    for (const a of S.allies) if (a.comp) a.hp = a.maxHp;
    if (story) for (const n of S.story.npcs) if (n.withHero && n.alive && n.joined && !S.allies.some(a => a.comp === n.id)) spawnCompanion(n);
    S.purses = []; S.ability.cd = 0;
    if (!CUT.crew) sc.dawn(isBloodMoon(S.night));
    S.night++; newLog();
    S.noiseChoice = Math.abs(S.noiseChoice || 0) < 1 ? 0 : S.noiseChoice * (1 - NOISE.choiceFade);   // a choice's noise holds for nights, fading a fifth each dawn
    S.weather = rollWeather(S.night); if (S.weather !== 'clear' && !CUT.weather) toast(`Tonight: ${W8().name.toLowerCase()}. ${W8().desc}`, W8().kind);
    planDay(S.night); spawnRoamers(); spawnAnimals(); scatterPickups(PICKUP.perDawn);
    for (const d of [...S.drops]) if (--d.ttl <= 0) { S.drops.splice(S.drops.indexOf(d), 1); ev('dropGone', { id: d.id }); }
    { const was = S.night - 1; if (isBloodMoon(was)) dropSupply('The blood moon has set.'); else if (claimedNow !== null) dropSupply('With the hive burned,'); else if (was >= 3 && rng.next() < 0.2) dropSupply('At first light,'); }
    S.reroll.cost = REROLL.base;
    const want = [];
    if (owns('christ') && S.night % 3 === 0) want.push('chest');   // no dawn blessings: they come from hives (epic loot) and key levels
    if (nestPick) want.push('nest');
    for (let k = 0; k < S.chestsHeld; k++) want.push('chest');
    const keepPicks = Math.max(1, PICKS_PER_DAWN), extra = want.slice(keepPicks).filter(x => x === 'chest').length;
    S.picks.push(...want.slice(0, keepPicks)); S.chestsHeld = 0;
    if (extra) { earn(extra * 5); toast(`${extra} more ${extra === 1 ? 'chest' : 'chests'} sold for ${extra * 5} gold: two blessings a dawn is the most.`, 'good'); }
    syncPicks(); rollOffer();
    rollPacks();
    if (S.sawBlackout && !S.blackout) story.grant('ironGrid');
    checkFeatures();
    if (S.night - 1 === seasonEnd(S.season.n)) { if (!S.season.won) finale(false); startSeason(S.season.n + 1); }
    // [road] begin
    if (road) road.dawn();
    // [road] end
    story.dawn();
    checkEvolution();
    if (HC.trader && !CUT.trader) S.trade = { deals: rng.shuffle([...TRADES]).slice(0, 3).map(t => t.id), done: false };
    S.stats.peakPop = Math.max(S.stats.peakPop, pop());
    ev('dawn', { goldIn, foodIn, need, fed });
    toast(`Dawn. ${goldIn >= 0 ? '+' : ''}${goldIn} scrap${salv ? ` (${salv} salvaged from the dead)` : ''}${upk ? ` after ${upk} tower upkeep` : ''}, +${foodIn} food. Citizens ate ${need}.`, 'good');
    if (fed < 1) toast(`Not enough food. Houses earned ${Math.round(fed * 100)}% of their scrap.`, 'bad');
    if (isBloodMoon(S.night + 1)) toast(`[Warning: red sky] The sky is turning red. **Tomorrow night is a blood moon**${S.unique && !S.unique.slain && S.unique.night === S.night + 1 ? `, and ${S.unique.name} comes with it` : ''}. Build up today and tomorrow.`, 'win');
  }

  /** the run ends: the hall fell, or (contracts.js) a lost contract ends it with a name. Closes the run log. */
  function endRun(won, reason) {
    if (S.over) return false;
    S.over = true; S.won = !!won; S.phase = 'over'; if (reason) S.endReason = reason; closeLog({ result: won ? 'won' : 'lost', reason: reason || (won ? 'won' : 'hall') });
    S.stats.nights = S.night - 1; S.stats.peakPop = Math.max(S.stats.peakPop, pop());
    ev('over', { won: !!won, night: S.night, reason: reason || null });
    return true;
  }
  /** retune the live run (never mutates the shared DIFFICULTY table) */
  function setDifficulty(key) {
    if (!DIFFICULTY[key]) return false;
    DIFF = DIFFICULTY[key]; S.difficulty = key; floorKey = ''; return true;
  }

  // ---------- abilities ----------
  function abilityCost() { const A = HC.ability; return A.cost ? Math.max(1, A.cost + A.costStep * S.ability.hires - S.P.hireDiscount) : 0; }
  function useAbility(x, y) {
    const A = HC.ability, h = S.hero;
    if (!A || S.over) return false;
    if (A.id !== 'patch' && !S.mobs.some(m => !m.roam || Math.hypot(m.x - h.x, m.y - h.y) < 10)) return fail('No dead nearby.');
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
      const dmg = A.dmg * S.P.abilityDmg * Math.sqrt(hpS(S.night)), rad = A.radius + S.P.abilityRadius;
      for (const m of [...S.mobs]) if (Math.hypot(m.x - tx, m.y - ty) < rad) hitMob(m, dmg, HC.volleyPays ? 'volley' : 'hero');
      ev('volley', { x: tx, y: ty, r: rad });
    } else if (A.id === 'patch') {
      const rad = (HC.quarter ? 99 : A.radius) + S.P.abilityRadius, heal = A.heal * S.P.abilityDmg;
      for (const b of live().concat(keep.ruined ? [] : [keep])) if (Math.hypot(b.x - h.x, b.y - h.y) < rad) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * heal);
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.4); for (const a of S.allies) a.hp = a.maxHp;
      if (mastery('saint')) for (const m of [...S.mobs]) if (Math.hypot(m.x - h.x, m.y - h.y) < Math.min(rad, 7)) hitMob(m, 6, 'hero');
      ev('volley', { x: h.x, y: h.y, r: Math.min(rad, 8) });
    } else if (A.id === 'shove') {
      const rad = A.radius + S.P.abilityRadius;
      for (const m of [...S.mobs]) { const d = Math.hypot(m.x - h.x, m.y - h.y); if (d > rad || m.kind === 'gravelord') continue; const k = A.push * (1 - d / rad * 0.5) / Math.max(0.3, MOBS[m.kind].size); const nx = m.x + (m.x - h.x) / (d || 1) * k, ny = m.y + (m.y - h.y) / (d || 1) * k; if (standable(m, nx, ny)) { m.x = nx; m.y = ny; } m.cd = Math.max(m.cd, 0.8); hitMob(m, A.dmg * S.P.abilityDmg, 'hero'); }
      ev('warcry', { x: h.x, y: h.y, r: rad });
    } else if (A.id === 'bounty') {
      S.bountyT = A.duration + S.P.bountyTime + (mastery('warband') ? 10 : 0);
      ev('bounty', { dur: S.bountyT }); toast('Bounty is on: every kill near you pays scrap.', 'good');
    } else if (A.id === 'hire') {
      const cost = abilityCost();
      const count = A.count + S.P.hireExtra + (mastery('warband') ? 2 : 0), max = A.max + (mastery('warband') ? 6 : 0) + S.P.hireExtra * 3;
      if (S.allies.length + count > max) return fail('You cannot pay more sellswords right now.');
      if (S.gold < cost) return fail(`Sellswords cost ${cost} scrap.`);
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
    if (source.startsWith('mastery:')) { const fam = source.split(':')[1], ms = MASTERIES[fam].filter(m => perkOk(m.id)); S.offer = (ms.length ? ms : MASTERIES[fam]).map(m => `m:${m.id}`); return; }
    const manual = source.startsWith('manual:') ? source.split(':')[1] : null;   // a field manual found in a site: blessings of one family
    const usable = p => perkOk(p.id);   // filtered by what you have: walls, weapon, ability, companions
    // a burned hive: three of the curated run-changers you can use
    if (source === 'nest') {
      const nest = NEST_POOL.map(id => PERKS.find(p => p.id === id)).filter(p => p && (S.P.taken[p.id] || 0) < p.max && usable(p));
      const out = [], legs = nest.filter(p => p.rarity === 'legendary');
      if (legs.length) { const p = legs[perkRng.int(legs.length)]; out.push(p.id); nest.splice(nest.indexOf(p), 1); }   // a burned hive always holds a legendary
      while (out.length < 3 && nest.length) out.push(nest.splice(perkRng.int(nest.length), 1)[0].id);
      if (out.length >= 2) { S.offer = out; return; }
    }
    let pool = PERKS.filter(p => (S.P.taken[p.id] || 0) < p.max && usable(p) && (manual ? p.fam === manual && !p.pact : famOk(p.fam)));   // one kind of blessing; only special moments bring one
    if (manual && !pool.length) pool = PERKS.filter(p => (S.P.taken[p.id] || 0) < p.max && famOk(p.fam));
    const n = 3 + (source === 'dawn' ? (HC.extraOffer || 0) : 0);
    const odds = ODDS[manual ? 'chest' : source] || ODDS.dawn, out = [];
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
      const pk = cands[perkRng.weighted(cands.map(p => (1 + S.P.fam[p.fam] * 0.6) * famWeight(p.fam)))];
      if (pk.pact) pacts++;
      out.push(pk.id);
    }
    S.offer = out;
    if (!out.length) { S.picks.shift(); rollOffer(); }
  }
  /** is this blessing any use to you right now? (see NEEDS in content/perks.js) */
  function perkOk(id) {
    const need = NEEDS[id]; if (!need) return true;
    const A = HC.attack, ab = HC.ability && HC.ability.id;
    switch (need) {
      case 'walls': return S.buildings.filter(b => b.type === 'wall' && !b.ruined).length >= 4;
      case 'ranged': return !!A && A.kind === 'ranged';
      case 'melee': return !!A && A.kind === 'melee';
      case 'attack': return !!A;
      case 'warcry': case 'volley': case 'patch': case 'bounty': return ab === need;
      case 'purses': return !!HC.collects;
      case 'companion': return !!(S.story && S.story.npcs && S.story.npcs.some(n => n.joined && n.alive));
      case 'homes': return S.buildings.filter(b => b.type === 'house').length >= 4;
      case 'noise': return !!S.feat.heat;
      default: return true;
    }
  }
  // hero families: a Survivor sees all three; a Calling sees its own (and, rarer, the others: a second one makes the final class);
  // a final class sees its two
  function famOk(f) {
    const F = FAMILIES[f]; if (!F.hero) return true;
    const cls = S.heroClass, H = HEROES[cls];
    if (cls === 'survivor' || !H.base && !S.evo.final) return true;
    return [H.base || cls, S.evo.second].includes(F.hero);
  }
  function famWeight(f) {
    const F = FAMILIES[f]; if (!F.hero) return f === 'bow' ? 0.7 : 1;
    const cls = S.heroClass; if (cls === 'survivor') return 1.3;
    return F.hero === (HEROES[cls].base || cls) ? 2 : 0.6;
  }
  /** become another class: the Calling, then the final class */
  function evolve(cls) {
    const H = HEROES[cls]; if (!H) return false;
    const was = HC.name; S.heroClass = cls; HC = H; S.ability.cd = 0;
    if (H.base) S.evo.final = cls; else S.evo.calling = cls;
    refreshMaxSoon(); ev('evolve', { cls });
    toast(`[Class evolution: ${was} → ${H.name}] ${H.blurb}`, 'good');
    return true;
  }
  // ---------- the path: what you do decides what you become ----------
  // Every decision and deed leans the hero toward a family (Brawn, Aim, Wits, Heart). At CALLING_LVL the System
  // reads the path and offers the Calling you have been living (as a trial); at FINAL_LVL the second family
  // decides the final class.
  const PATH_FAMS = ['hero', 'ranger', 'scavver', 'heart'];
  function addPath(fam, n) { if (!PATH_FAMS.includes(fam) || !n) return; S.path[fam] = Math.max(0, +(S.path[fam] + n).toFixed(3)); }
  const pathRank = (skip = []) => PATH_FAMS.filter(f => !skip.includes(FAMILIES[f].hero)).sort((a, b) => S.path[b] - S.path[a]);
  function checkEvolution() {
    if (!story || S.over || S.story.encounters.some(e => e.kind === 'evolve') || (S.story.trial && !S.story.trial.done)) return;
    const cls = S.heroClass;
    if (cls === 'survivor') {
      if (S.lvl < CALLING_LVL || S.evo.offered.calling) return;
      const [a, b] = pathRank();
      const opts = [FAMILIES[a].hero, FAMILIES[b].hero];   // always two Callings: the path you lived, and the next one
      S.evo.offered.calling = true; story.offerTrial(opts.map(c => ({ cls: c })), cls);
    } else if (!HEROES[cls].base && !CUT.finalClass) {   // the final class is parked
      if (S.lvl < FINAL_LVL || S.evo.offered.final) return;
      const ranked = pathRank([cls]).map(f => FAMILIES[f].hero).filter(h => FINALS[[cls, h].sort().join('+')]);
      if (!ranked.length) return;
      const opts = ranked.slice(0, 2).map(h => ({ cls: FINALS[[cls, h].sort().join('+')], second: h }));
      S.evo.offered.final = true; story.offerTrial(opts, cls);
    }
  }
  function reroll() {
    if (!S.offer.length || S.offerSource.startsWith('mastery:')) return false;
    const cost = S.reroll.free > 0 ? 0 : S.reroll.cost;
    if (S.gold < cost) return fail(`A reroll costs ${cost} scrap.`);
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
      if (PATH_FAMS.includes(pk.fam)) addPath(pk.fam, 0.5);
      checkEvolution();
    }
    for (const b of S.buildings) { const m = maxHpOf(b.type, b.level); if (!b.ruined) b.hp += m - b.maxHp; b.maxHp = m; }
    const km = keepMaxHp(); keep.hp = Math.min(km, keep.hp + Math.max(0, km - keep.maxHp)); keep.maxHp = km;
    const hm = heroMax(); S.hero.hp = Math.min(hm, S.hero.hp + Math.max(0, hm - S.hero.maxHp)); S.hero.maxHp = hm;
    S.picks.shift(); rollOffer(); return true;
  }
  function trade(id) {
    if (!S.trade || S.trade.done || !S.trade.deals.includes(id)) return false;
    const t = TRADES.find(x => x.id === id);
    if (t.gold && S.gold < t.gold) return fail(`That costs ${t.gold} scrap.`);
    if (t.food && S.food < t.food) return fail(`You need ${t.food} food.`);
    if (t.gold) { S.gold -= t.gold; S.stats.goldSpent += t.gold; }
    if (id === 'reroll') S.reroll.free++;
    if (id === 'pick') { S.picks.push('dawn'); syncPicks(); if (S.picks.length === 1) rollOffer(); }
    if (id === 'sellfood') { S.food -= t.food; earn(t.give); }
    if (id === 'halfup') S.halfUpgrade = true;
    if (id === 'mend') keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * 0.25);
    S.trade.done = true; addPath('scavver', 0.6); toast(`Deal: ${t.name.toLowerCase()}.`, 'good'); return true;
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
    if (S.gold < PACK_RULES.reroll) return fail(`Other packs cost ${PACK_RULES.reroll} scrap.`);
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
      if (i === goal || dist[i] > 300) break;
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
  // ---------- companions at your side: one at a time, and their post stands empty while they travel with you ----------
  function spawnCompanion(n) {
    const h = S.hero, k = S.P.compBuff || 1, hp = Math.round((24 + n.bond * 4 + (n.named ? 14 : 0)) * k);
    const a = { id: S.nextId++, ally: true, comp: n.id, name: n.name.split(' ')[0], x: h.x + 0.6, y: h.y + 0.6, hp, maxHp: hp, dmg: (2.5 + n.bond * 0.4 + (n.named ? 2 : 0)) * k, cd: 0, face: 0, attacking: false };
    S.allies.push(a); ev('ally', { id: a.id });
  }
  function companionFollow(id, on) {
    const n = S.story.npcs.find(q => q.id === id); if (!n || !n.alive || !n.joined) return false;
    if (on) { const others = S.story.npcs.filter(o => o !== n && o.withHero); while (others.length >= partySize()) companionFollow(others.shift().id, false); n.withHero = true; if (!S.allies.some(a => a.comp === n.id)) spawnCompanion(n); toast(`${n.name} travels with you. Their post stands empty until they return.`, 'good'); }
    else { n.withHero = false; for (const a of S.allies.filter(q => q.comp === n.id)) { S.allies.splice(S.allies.indexOf(a), 1); ev('allyGone', { id: a.id }); } }
    return true;
  }
  // ---------- autopilot: the hero plays by itself (defends the town, fetches crates, rests when hurt) ----------
  let autoT = 0, handT = 0;
  function autoHero(dt) {
    const h = S.hero; if (h.dead || (handT -= dt) > 0 || (autoT -= dt) > 0) return; autoT = 0.3;
    const home = { x: c, y: c + 3.5 };
    const A = HC.ability, near = r => S.mobs.filter(m => m.rise >= 1 && !m.roam && Math.hypot(m.x - h.x, m.y - h.y) < r).length;
    if (A && S.ability.cd <= 0 && near(A.id === 'volley' ? 9 : 5) >= 4 && (A.id !== 'warcry' || h.hp > h.maxHp * 0.5)) useAbility();
    if (h.hp < h.maxHp * 0.35) { api.heroTo(home.x, home.y); return; }
    const threats = S.mobs.filter(m => m.rise >= 1 && (!m.roam || Math.hypot(m.x - c, m.y - c) < 12) && Math.hypot(m.x - c, m.y - c) < 15);
    if (threats.length && HC.attack) {
      threats.sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c));
      const m = threats[0], reach = HC.attack.reach * 0.8;
      if (Math.hypot(m.x - h.x, m.y - h.y) > reach) api.heroTo(m.x, m.y);
      return;
    }
    const loot = S.chests[0] || (S.phase === 'day' && h.hp > h.maxHp * 0.7 && S.drops.find(d => Math.hypot(d.x - c, d.y - c) < 55));
    if (loot) { api.heroTo(loot.x, loot.y); return; }
    // by day, with time and health to spare: the trial, then quests, then beacons
    if (S.phase === 'day' && !S.autoStay && h.hp > h.maxHp * 0.7 && TIDE.dayLen - S.dayT > 25) {
      const ST = S.story, tr = ST.trial && !ST.trial.done ? ST.trial : null;
      const goal = tr || ST.quests[0] || ST.spots.slice().sort((a, b) => Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c))[0];
      if (goal) { api.heroTo(goal.x, goal.y + (goal.site !== undefined ? 2.5 : 0)); return; }
    }
    if (Math.hypot(h.x - home.x, h.y - home.y) > 2) api.heroTo(home.x, home.y);
  }
  function unstickHero() {
    const h = S.hero; if (walkable(h.x, h.y)) return;
    for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.floor(h.x) + dx + 0.5, y = Math.floor(h.y) + dy + 0.5; if (walkable(x, y)) { h.x = x; h.y = y; return; }
    }
  }
  function stepHero(dt) {
    const h = S.hero;
    if (h.dead) { h.respawn -= dt; if (h.respawn <= 0) heroBack(); return; }
    h.guardT = Math.max(0, h.guardT - dt); h.noiseT = Math.max(0, (h.noiseT || 0) - dt);
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
      const ti = idx(Math.floor(h.x), Math.floor(h.y)), ground = map.road[ti] ? 1.4 : map.terrain[ti] === T.FOREST && !inZone(ti) ? 0.72 : 1;   // the old road is quick; the woods are slow
      const sp = HC.speed * S.P.heroSpeed * ground * (rule('winter') ? 0.92 : 1) * dt; if (S.P.runHeal) h.hp = Math.min(h.maxHp, h.hp + S.P.runHeal * dt);
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
      // [road] begin
      if (best && road && road.preferHive(best, reach)) best = null;   // lantern off on a Hunt: leave the sleeping dead, strike the hive
      // [road] end
      if (!best) {
        // nothing to fight: strike a hive in reach
        const hv = map.regions.find(r => r.nest && S.nestAlive[r.id] && Math.hypot(r.nest.x - h.x, r.nest.y - h.y) < reach + 1.4);
        if (hv && hitHive(hv.id, dmg)) { h.cd = heroRate(); h.swing = 0.25; h.attacks++; h.face = Math.atan2(hv.nest.x - h.x, hv.nest.y - h.y); ev(A.kind === 'melee' ? 'swing' : 'shot', { src: 'hero' }); }
      }
      if (best) {
        h.cd = heroRate(); h.swing = 0.25; h.attacks++; h.noiseT = 3; if (!moving) h.face = Math.atan2(best.x - h.x, best.y - h.y);
        const cleave = mastery('whirlwind') || (has('wardance') && h.attacks % 3 === 0);
        if (A.kind === 'melee') {
          if (cleave) S.mobs.filter(m => Math.hypot(m.x - h.x, m.y - h.y) - 0.3 * MOBS[m.kind].size < reach).forEach(m => hitMob(m, dmg, 'hero'));
          else { hitMob(best, dmg, 'hero'); if (HC.twin) { const sec = S.mobs.find(o => o !== best && o.rise >= 1 && Math.hypot(o.x - h.x, o.y - h.y) - 0.3 * MOBS[o.kind].size < reach); if (sec) hitMob(sec, dmg * 0.7, 'hero'); } }
          ev('swing');
        } else {
          const shot = m => fire(1.4, h.x, h.y, m, dmg * (mastery('sniper') && m.hp >= m.maxHp ? 2 : 1), 'hero', 24);
          shot(best);
          if (S.P.pierce) { const behind = S.mobs.find(o => o !== best && o.rise >= 1 && Math.hypot(o.x - best.x, o.y - best.y) < 1.8); if (behind) shot(behind); }
          if (cleave || (S.P.sentinel && !moving && h.attacks % 3 === 0)) for (const m of S.mobs.filter(o => o !== best && Math.hypot(o.x - h.x, o.y - h.y) < reach).slice(0, 2)) shot(m);
        }
      }
    }
    h.hp = Math.min(h.maxHp, h.hp + dt * ((S.phase === 'day' ? (S.P.noDayHeal ? 0 : 3) : S.P.heroRegen) + (owns('clinic') ? 2 : 0) + (story ? story.bonus.regen() : 0)));
    for (const ch of [...S.chests]) {
      if (Math.hypot(ch.x - h.x, ch.y - h.y) > 1.3) continue;
      S.chests.splice(S.chests.indexOf(ch), 1); ev('chestOpen', { id: ch.id }); S.stats.chests++;
      if ((S.chestsToday = (S.chestsToday || 0) + 1) > 1) { earn(5); toast('Another chest: **+5 scrap** (one chest blessing a day is the most).', 'good'); continue; }
      S.picks.push('chest'); syncPicks(); if (S.picks.length === 1) rollOffer();
    }
    if (HC.collects) for (const p of [...S.purses]) {
      if (Math.hypot(p.x - h.x, p.y - h.y) > 1.2) continue;
      S.purses.splice(S.purses.indexOf(p), 1); earn(p.value); S.stats.pursesGold += p.value; ev('purseTaken', { id: p.id, value: p.value });
    }
  }
  function stepAllies(dt) {
    const h = S.hero;
    for (const a of [...S.allies]) {
      if (a.hp <= 0 && a.comp && mastery('lifeline')) { a.hp = a.maxHp; continue; }
      if (a.hp <= 0) { S.allies.splice(S.allies.indexOf(a), 1); ev('allyGone', { id: a.id, died: true }); if (a.comp) toast(`${a.name} is down. They will be back on their feet at dawn.`, 'bad'); continue; }
      a.cd -= dt; a.attacking = false;
      let best = null, bd = Infinity;
      for (const m of S.mobs) { if (m.rise < 1) continue; if (Math.hypot(m.x - h.x, m.y - h.y) > MERC.leash + 2) continue; const d = Math.hypot(m.x - a.x, m.y - a.y); if (d < bd) { bd = d; best = m; } }
      if (best) {
        if (bd > MERC.reach) moveAlly(a, best.x, best.y, MERC.speed * dt);
        else { a.attacking = true; a.face = Math.atan2(best.x - a.x, best.y - a.y); if (a.cd <= 0) { a.cd = MERC.rate; hitMob(best, (a.dmg || MERC.dmg) + S.P.mercDmg, 'merc'); ev('swingAlly', { id: a.id }); } }
      } else if (Math.hypot(h.x - a.x, h.y - a.y) > 2) moveAlly(a, h.x, h.y, MERC.speed * dt);
    }
  }
  function moveAlly(a, tx, ty, s) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1e-4) return;
    const nx = a.x + dx / d * Math.min(s, d), ny = a.y + dy / d * Math.min(s, d);
    if (walkable(nx, ny)) { a.x = nx; a.y = ny; } else if (walkable(nx, a.y)) a.x = nx; else if (walkable(a.x, ny)) a.y = ny;
    a.face = Math.atan2(dx, dy);
  }

  // ---------- the brain: hunt you, search where you were, wait on your road home, or march on the noise ----------
  let speedK = 1, huntN = 0, aggroT = -1, aggroN = 0;
  // a dead that picks up your scent: the 'aggro' event fires on that change only, at most once per dead per 10 s
  // and at most 6 a second in all (it used to fire thousands of times a trip)
  function aggro(m) {
    m.hunt = true; huntN++;
    if (S.time - (m.aggroAt ?? -1e9) < 10) return; m.aggroAt = S.time;
    if (S.time - aggroT >= 1) { aggroT = S.time; aggroN = 0; }
    if (aggroN++ < 6) ev('aggro', { id: m.id });
  }
  const huntCap = () => 8 + Math.floor(S.night / 4);
  const rankOf = m => (m.unique ? 4 : BRAIN.rank[m.kind] ?? 1);
  const senseMult = m => (S.hero.noiseT > 0 ? 1.4 : 1) * (m.smoke > 0 ? 0.3 : 1) * (S.phase === 'night' ? 1.15 : 1) * (S.story.flags.quiet ? 0.85 : 1);
  function think(m, hd, dt) {
    const h = S.hero, rank = rankOf(m);
    // [road] begin
    if (road) hd = road.perceive(m, hd);
    // [road] end
    if (m.smoke > 0) m.smoke -= dt;
    if (m.lure) { m.lure.t -= dt; if (m.lure.t <= 0 || hd < 1.5) m.lure = null; else return Math.hypot(m.lure.x - m.x, m.lure.y - m.y) < 1 ? { wait: true } : m.lure; }
    if (MOBS[m.kind].burst || m.kind === 'gravelord') return null;
    const heroHome = !h.dead && inZone(idx(Math.floor(h.x), Math.floor(h.y)));
    const sense = BRAIN.sense[rank] * senseMult(m);
    if (!m.hunt && !h.dead && (hd < sense && !heroHome && huntN < huntCap() && !(m.giveUp > S.time) || hd < 3 || m.tauntT > 0)) { aggro(m); m.ambushAt = null; }
    if (m.hunt) {
      const lost = h.dead || (hd > Math.max(4, sense * BRAIN.forget[rank]) && m.tauntT <= 0);
      if (lost || (heroHome && baseDist(m.x, m.y) < 8 && hd > 3)) {   // you got home: most give up and wander off; a few stay for the town
        m.hunt = false;
        if (!lost && rng.next() < 0.7) { m.roam = { x: m.x + (m.x - c) * 0.6, y: m.y + (m.y - c) * 0.6, region: -1 }; m.lost = true; return null; }
        if (lost && !h.dead && BRAIN.remember[rank]) m.last = { x: h.x, y: h.y, t: BRAIN.remember[rank] };
      } else return h;
    }
    if (m.last) { m.last.t -= dt; if (m.last.t <= 0 || Math.hypot(m.last.x - m.x, m.last.y - m.y) < 1) m.last = null; else return m.last; }
    // the clever ones read where you will go: out in the wilds, they wait on the way home
    if (m.ambush === undefined) m.ambush = rng.next() < BRAIN.ambush[rank];
    if (m.ambush && !h.dead && !heroHome && baseDist(h.x, h.y) > 16 && hd < 45) {
      const k = 0.45, ax = c + (h.x - c) * k, ay = c + (h.y - c) * k;
      if (!m.ambushAt || Math.hypot(m.ambushAt.x - ax, m.ambushAt.y - ay) > 6) m.ambushAt = { x: ax, y: ay };
      return Math.hypot(m.ambushAt.x - m.x, m.ambushAt.y - m.y) < 1.2 ? { wait: true } : m.ambushAt;
    }
    m.ambushAt = null;
    return null;
  }
  // ---------- burning a hive: the horde comes at once (no pause); a flare or smoke is a button, any time ----------
  function hiveFall(r) {
    const n = map.regions[r].nest; S.escape = null;
    const u = unlocked(Math.max(1, S.night)), k = Math.max(3, Math.round(ESCAPE.horde(S.night) * DIFF.threat * (1 + 0.5 * (map.regions[r].ring - 1))));
    const kinds = [];
    if (S.night >= 2) kinds.push('runner', 'runner');   // runners from night 2: you cannot just walk away
    if (S.night >= 4) kinds.push('brute');              // and a brute from night 4
    while (kinds.length < k) { const [kind] = u[rng.weighted(u.map(([, mm]) => mm.weight))]; kinds.push(kind); }
    const ids = [];
    for (const kind of kinds) { const m = spawnAtNest(kind, r); m.rise = 0.6; m.hunt = true; m.horde = r; ids.push(m.id); }
    S.stats.hordes = (S.stats.hordes || 0) + 1;
    ev('horde', { region: r, x: n.x, y: n.y, n: kinds.length, ids });
    toast(`[The hive is ash] **${kinds.length} dead** pour out after you. A **flare** (${TOOLS.flare.cost} scrap) pulls them away; **smoke** (${TOOLS.smoke.cost} food) hides your scent.`, 'bad');
  }
  /** throw a flare: the dead near you (or near the point) chase the light for 20 s. x, y: where it lands (default: ahead of you). */
  function useFlare(x, y) {
    const h = S.hero, F = TOOLS.flare;
    if (S.over || h.dead) return false;
    if (S.tools.flare > 0) return fail(`The next flare is ready in ${Math.ceil(S.tools.flare)} s.`);
    if (S.gold < F.cost) return fail(`A flare costs ${F.cost} scrap.`);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { x = h.x + Math.sin(h.face) * F.throw; y = h.y + Math.cos(h.face) * F.throw; }
    x = Math.max(1, Math.min(N - 2, x)); y = Math.max(1, Math.min(N - 2, y));
    S.gold -= F.cost; S.stats.goldSpent += F.cost; S.cur.spent += F.cost; S.tools.flare = F.cd;
    let n = 0;
    for (const m of S.mobs) {
      if (MOBS[m.kind].animal || m.kind === 'gravelord' || m.unique) continue;
      if (Math.hypot(m.x - h.x, m.y - h.y) > F.r && Math.hypot(m.x - x, m.y - y) > F.r) continue;
      m.lure = { x: x + rng.range(-1, 1), y: y + rng.range(-1, 1), t: F.t }; m.hunt = false; m.last = null; n++;
    }
    S.stats.flares = (S.stats.flares || 0) + 1;
    ev('flare', { x, y, dur: F.t, n }); toast(`[Flare] **${n} dead** turn toward the light for **${F.t} seconds**.`, 'good');
    return true;
  }
  /** light smoke: the dead near you lose your scent (they find it again only if they bump into you) */
  function useSmoke() {
    const h = S.hero, M = TOOLS.smoke;
    if (S.over || h.dead) return false;
    if (S.tools.smoke > 0) return fail(`The next smoke is ready in ${Math.ceil(S.tools.smoke)} s.`);
    if (S.food < M.cost) return fail(`Smoke takes ${M.cost} food (wet leaves and fat).`);
    S.food -= M.cost; S.tools.smoke = M.cd;
    let n = 0;
    for (const m of S.mobs) { if (MOBS[m.kind].animal || Math.hypot(m.x - h.x, m.y - h.y) > M.r) continue; m.smoke = M.t; if (m.hunt) n++; m.hunt = false; m.last = null; m.ambushAt = null; }
    S.stats.smokes = (S.stats.smokes || 0) + 1;
    ev('smoke', { x: h.x, y: h.y, r: M.r, n }); toast(`[Smoke] Grey all around you. **${n} dead** lost your scent: keep your distance.`, 'good');
    return true;
  }
  /** the old escape card's call, kept for old callers: 'flare' / 'smoke' use the tool, 'run' does nothing */
  function escape(kind) { return kind === 'flare' ? useFlare() : kind === 'smoke' ? useSmoke() : kind === 'run'; }
  const toolsInfo = () => Object.fromEntries(Object.entries(TOOLS).map(([k, T2]) => [k, { cost: T2.cost, pay: k === 'flare' ? 'scrap' : 'food', cd: Math.max(0, S.tools[k] || 0), cdMax: T2.cd, t: T2.t, ready: !(S.tools[k] > 0), afford: (k === 'flare' ? S.gold : S.food) >= T2.cost }]));

  // spatial hash for mob separation and auras
  const bucket = new Map();
  function stepMobs(dt) {
    const h = S.hero;
    bucket.clear();
    for (const m of S.mobs) { const k = (Math.floor(m.x / 2) << 8) | Math.floor(m.y / 2); let a = bucket.get(k); if (!a) bucket.set(k, a = []); a.push(m); m.boost = 1; }
    huntN = 0; for (const m of S.mobs) if (m.hunt) huntN++;
    for (const s of S.mobs) {
      const au = MOBS[s.kind].aura; if (!au || s.rise < 1) continue;
      const bx = Math.floor(s.x / 2), by = Math.floor(s.y / 2), rr = Math.ceil(au.radius / 2);   // (auras)
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
      const lull = story && Math.abs(m.x - c) < 7 && Math.abs(m.y - c) < 7 ? story.bonus.lullaby() : 1;
      const speed = (rule('winter') ? 0.9 : 1) * lull * m.speed * m.boost * W8().speed * (inTar ? 0.6 : 1) / (map.terrain[ci] === T.FOREST ? 1.4 : map.terrain[ci] === T.FORD ? 1.8 : 1);
      // [road] begin
      if (road && road.drive(m, dt, speed)) continue;
      // [road] end
      if (m.roam) { stepRoamer(m, dt, speed); continue; }
      const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
      const goal = think(m, hd, dt);
      if (goal && !(goal === h && D.range && hd < D.range)) {
        const far = hd > 30 && Math.hypot(m.x - c, m.y - c) > 40 ? BRAIN.farSpeed : 1;
        if (goal === h) {
          m.face = Math.atan2(h.x - m.x, h.y - m.y);
          if (hd > 0.9) moveToward(m, h.x, h.y, speed * (TIDE.roam.chase[m.kind] || 1.2) * dt);
          else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; hurtHero(D.dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); } }
        } else if (goal.wait) { m.face = Math.atan2(h.x - m.x, h.y - m.y); }
        else moveToward(m, goal.x, goal.y, speed * far * dt);
        continue;
      }
      if (hd > 30 && Math.hypot(m.x - c, m.y - c) > 40) speedK = BRAIN.farSpeed; else speedK = 1;
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
      const foe = ad < 2.5 ? ally : null;
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
      if (nj >= 0) { const tx = (nj % N) + 0.5, ty = ((nj / N) | 0) + 0.5; moveToward(m, tx, ty, speed * speedK * dt); }
      else moveToward(m, c, c, speed * speedK * dt);
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
      if (b.type !== 'tower' || !manned(b) || !powered(b)) continue;
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
    if (S.autopilot) autoHero(dt);
    stepHero(dt);
    if ((S.revealT = (S.revealT || 0) - dt) <= 0) { S.revealT = 0.25; if (!S.hero.dead) reveal(S.hero.x, S.hero.y, 8); }
    untitle();
    if (S.picks.length && !S.offer.length) rollOffer();   // a pick added at any hour (a crate, a story reward) gets its cards
    if (S.phase === 'day' && S.clock && !S.over) {
      S.dayT += dt;
      while (S.dayQueue.length && S.dayQueue[0].t <= S.dayT) { const q = S.dayQueue.shift(); if (nestAlive(q.nest) && !S.claimed.has(q.nest)) spawnAtNest(q.kind, q.nest); }
      if (S.dayT >= TIDE.dayLen && !S.story.encounters.length) startNight(true);
    }
    if (planner) planner.tick(dt);
    if (S.phase === 'night') {
      S.qT += dt; S.cur.keepMin = Math.min(S.cur.keepMin ?? 1, keep.hp / keep.maxHp);
      while (S.queue.length && S.queue[0].t <= S.qT) {
        const q = S.queue.shift(), up = rule('metro') && !q.unique && !q.first && rng.next() < 0.15 ? metroSpot() : null, m = up ? spawnMob(q.kind, up.x, up.y) : spawnAtNest(q.kind, q.nest);
        if (q.unique) { m.hp = m.maxHp = Math.ceil(m.maxHp * S.unique.mult); m.unique = S.unique.name; m.speed *= 0.85; ev('firstDead', { id: m.id }); toast(`[Unique Monster: ${S.unique.name}] It is here.`, 'bad'); }
        if (q.finale) m.finale = S.season.n;
        if (q.first) { m.hp = m.maxHp = TIDE.first.hp; m.speed *= TIDE.first.speed; m.first = true; ev('firstDead', { id: m.id }); toast('Something crawls out of the dark. It is coming for the town.', 'bad'); }
      }
      if (mastery('mending')) for (const b of live()) if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + dt * 0.3);
      if (S.P.sanctuary && !keep.ruined) keep.hp = Math.min(keep.maxHp, keep.hp + 2 * dt);
    }
    stepMobs(dt); stepAllies(dt); stepTowers(dt);
    for (const k in S.tools) if (S.tools[k] > 0) S.tools[k] = Math.max(0, S.tools[k] - dt);
    for (const p of [...S.purses]) { p.life -= dt; if (p.life <= 0) { S.purses.splice(S.purses.indexOf(p), 1); ev('purseGone', { id: p.id }); } }
    stepProjectiles(dt);
    if (S.drops.length) stepDrops(dt);
    if (S.pickups.length || S.hero.carry.scrap || S.hero.carry.food) stepPickups();
    stepStream(dt);
    // [road] begin
    if (road) road.tick(dt);
    // [road] end
    stepHeat(dt);
    if ((S.powerT = (S.powerT || 0) - dt) <= 0) { S.powerT = 0.25; checkPower(); checkForeman(); story.tick(); if (S.blackout) S.sawBlackout = true; }
    for (const b of S.buildings) if (b.built < 1 && !b.ruined) { b.built = Math.min(1, b.built + dt / BUILDINGS[b.type].buildTime); if (b.built >= 1) { ev('built', { id: b.id }); toast(`The ${BUILDINGS[b.type].name} is finished. ${BUILDINGS[b.type].desc[0]}`, 'good'); } }
    // sunrise comes on time: the night's dead do not vanish. Far from the town they lose interest and roam where they stand.
    if (S.phase === 'night' && !S.over && !S.queue.length && (S.qT > nightLen() || !S.mobs.some(m => !m.roam && m.stream === undefined))) {
      let burnt = 0;
      for (const m of [...S.mobs]) {
        if (m.roam || m.stream !== undefined || m.hunt) continue;
        if (Math.hypot(m.x - c, m.y - c) > 22) { m.roam = { x: m.x, y: m.y, region: -1 }; m.lost = true; continue; }   // out in the woods: they wander
        if (m.unique && S.unique) S.unique.escaped = true;   // at your walls: the sunrise burns the night's dead (the hives' stream keeps coming)
        S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: 'sun', dmg: 0 }); burnt++;
      }
      if (burnt) toast(`The sun rises: **${burnt}** of the night's dead burn at your walls. The rest of the dead keep coming.`);
      dawn();
    }
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
    let nests = marchNests(n);
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

  // ---------- the honest forecast: "Hall: safe · ~N buildings at risk · 2 brutes" ----------
  // Calibrated from the Oct 20 sweep logs (12 seeds × 16 nights, tools/sweep.mjs with SWEEP_OUT, 125 nights): the share of
  // standing buildings a night takes is ≈ (ratio − 0.25) × 1.6; last night's losses, grown by tonight's budget, set a
  // floor (mean error 2.2 buildings, was 2.9 and 2.6 low).
  // The Camp's three states, recalibrated on the Oct 20 polish logs (a 12×16 sweep + 12 scripted playtests, 363 nights;
  // safe = the hall held ≥80%, at risk = it held but was hurt, may fall = it fell): safe below 0.7; "may fall" from 1.9,
  // or from 0.8 when last night left the hall under 40%, or from 1.15 under 55%. Agreement 93% (sweep) / 88% (playtests),
  // was 90% / 82%: every fallen hall was called; "may fall" was wrong twice (the hall held, hurt).
  const FORECAST = { r0: 0.25, slope: 1.6, last: 0.85, safe: 0.7, fall: 1.9, hurt: [[0.8, 40], [1.15, 55]] };
  function forecastStrip(n = S.night) {
    const ratio = threatRatio(n), u = unlocked(n), wc = u.reduce((a, [, m]) => a + m.weight * m.cost, 0);
    const budget = nightBudget(n), every = Math.max(STREAM.min, STREAM.every - STREAM.drop * n) / DIFF.threat;
    const stream = n < 5 ? 0 : marchNests(n).length * WAVES.duration(n) * STREAM.nightMult / every;
    const bosses = isBloodMoon(n) ? bossesFor(n).length : 0;
    const brutes = Math.round((budget + stream * 1.3) * ((MOBS.brute.from <= n ? MOBS.brute.weight : 0) / wc)) + bosses;
    const dead = n === 1 && S.purge === null ? 1 : Math.round(budget / (wc / u.reduce((a, [, m]) => a + m.weight, 0)) + stream + bosses);
    const standing = S.buildings.filter(b => !b.ruined).length;
    const last = S.log.length ? S.log[S.log.length - 1] : null, lastLost = last ? (last.lost || []).length : 0;
    const grow = last && last.night ? nightBudget(n) / Math.max(1, nightBudget(last.night)) : 1;
    const share = Math.max(0, Math.min(1, (ratio - FORECAST.r0) * FORECAST.slope));
    const atRisk = Math.min(standing, Math.round(Math.max(standing * share, lastLost * grow * FORECAST.last * (ratio > FORECAST.r0 ? 1 : 0.5))));
    const lastHeld = last && last.held !== undefined && last.held !== null ? last.held : 100;
    const hall = ratio < FORECAST.safe ? 'safe' : ratio >= FORECAST.fall || FORECAST.hurt.some(([r, h]) => ratio >= r && lastHeld < h) ? 'fall' : 'risk';
    // crew: towers without their full crew stay silent. Now, and after the homes this night is likely to take.
    const cr = crewing(), towersUp = S.buildings.filter(b => b.type === 'tower' && !b.ruined).length, silent = towersUp - cr.manned.size;
    const homes = S.buildings.filter(b => b.type === 'house' && !b.ruined), folk = homes.reduce((a, b) => a + (b.folk ?? houseCap(b)), 0);
    const lossP = standing ? atRisk * (homes.length / standing) * (homes.length ? folk / homes.length : 0) / 2 : 0;
    const perTower = towersUp ? cr.need / towersUp : 1, deficit = cr.need - (cr.people - lossP);
    const short = Math.max(silent, deficit > 0 ? Math.min(towersUp, Math.ceil(deficit / Math.max(1, perTower))) : 0);
    return { hall, atRisk, brutes, dead, ratio: +ratio.toFixed(2), night: n, bloodMoon: isBloodMoon(n), crew: { need: cr.need, people: cr.people, silent, short } };
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
  rollOffer(); rollPacks(); spawnRoamers(); spawnAnimals();   // day 1 is quiet: the first blessing comes at dawn 2
  if (!restore) scatterPickups(PICKUP.start);

  // ---------- scavenging ----------
  sc = createScavenge({ S, map, seed, ev, toast, earn, activeNests, isBloodMoon, spawnMob, fail });
  S.scav = sc.scav;

  const REVIVE = ['Hush', 'Echo', 'Lull', 'Old Song', 'Quill', 'Tam', 'Vesper', 'Nocturne'];
  function refreshMaxSoon() { refreshMax(); }
  const refreshMax = () => {
    for (const b of S.buildings) { const m = maxHpOf(b.type, b.level); if (!b.ruined) b.hp += m - b.maxHp; b.maxHp = m; }
    const km = keepMaxHp(); keep.hp = Math.min(km, keep.hp + Math.max(0, km - keep.maxHp)); keep.maxHp = km;
    const hm = heroMax(); S.hero.hp = Math.min(hm, S.hero.hp + Math.max(0, hm - S.hero.maxHp)); S.hero.maxHp = hm;
  };
  story = createStory({ api: () => api, heroes: HEROES, evolve: cls => evolve(cls), S, map, rng: new Rng(hashSeed(seed, 'story')), ev, toast, earn, addHeat, openDistrict, frontier, districtOffer, siteOf, LANDMARKS, pop, refreshMax, syncPicks,
    hurtHero: n => hurtHero(n), gainXp: n => gainXp(n), addPath: (f, n) => addPath(f, n),
    // the trial warden: tougher than a brute, hits softer than one, never leaves its ground
    spawnTrial: tr => { const m = spawnMob('brute', tr.x, tr.y, { instant: true }); m.hp = m.maxHp = Math.round((10 + 4 * S.lvl) * Math.min(1.3, DIFF.threat)); m.dmgK = tr.second ? 0.8 : 0.5; m.trial = { cls: tr.cls, from: tr.from, second: tr.second }; m.roam = { x: tr.x, y: tr.y, region: -1 }; m.warden = true;
      for (let k = 0; k < 3; k++) { const a = rng.range(0, 6.28), w = spawnMob(k === 2 && S.night >= 4 ? 'runner' : 'walker', tr.x + Math.cos(a) * 2, tr.y + Math.sin(a) * 2, { instant: true }); w.roam = { x: tr.x, y: tr.y, region: -1 }; w.hunt = true; }
      ev('trial', { id: m.id }); },
    findSpot: () => { for (let t = 0; t < 80; t++) { const reg = map.regions[rng.int(map.regions.length)]; if (reg.ring < 1 || S.sealed[reg.id]) continue; const x = reg.x + rng.range(-7, 7), y = reg.y + rng.range(-7, 7), cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) continue; const i = idx(cx, cy); if (map.region[i] !== reg.id || !PASSABLE[map.terrain[i]] || !map.reach[i] || S.occ[i] >= 0 || inZone(i) || baseDist(x, y) < 6 || Math.hypot(x - c, y - c) > (t < 60 ? 120 : 200)) continue; return { x: cx + 0.5, y: cy + 0.5 }; } return null; },   // beacons and trials stay within a day's reach
    guard: (x, y, n) => { for (let k = 0, tries = 0; k < n && tries < 40; tries++) { const a = rng.range(0, Math.PI * 2), gx = x + Math.cos(a) * rng.range(1, 2.8), gy = y + Math.sin(a) * rng.range(1, 2.8), cx = Math.floor(gx), cy = Math.floor(gy); if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || S.occ[idx(cx, cy)] >= 0) continue; k++; const m = spawnMob(rng.pick(S.night >= 4 ? ['walker', 'runner'] : ['walker']), gx, gy, { instant: true }); m.roam = { x, y, region: -1 }; } },
    landmarkReach, claimFree: id => { const l = S.landmarks[id]; if (l && !l.owned) takeSite(l); }, reviveName: () => REVIVE[rng.int(REVIVE.length)],
    risen: n => { const h = S.buildings.filter(b => b.type === 'house' && !b.ruined); const b = h.length ? h[rng.int(h.length)] : keep; for (let k = 0; k < n; k++) spawnMob('risen', b.x + rng.range(-1, 1), b.y + rng.range(-1, 1)); toast('He turned. The house fills with the dead.', 'bad'); } });
  story.start();
  // legacy edges from earlier runs
  { const Lg = S.legacy; if (!restore) { S.gold += 10 * (Lg.scrap || 0); S.food += 6 * (Lg.food || 0); } S.P.heroDmgMult *= 1 + 0.08 * (Lg.dmg || 0); S.P.keepHp += 25 * (Lg.keep || 0); refreshMax(); keep.hp = keep.maxHp; }

  // ---------- saving: a dawn snapshot (what you built, chose and met; the dead are not saved) ----------
  const b64 = u8 => { let s2 = ''; for (let i = 0; i < u8.length; i += 8) { let v = 0; for (let k = 0; k < 8; k++) if (u8[i + k]) v |= 1 << k; s2 += String.fromCharCode(v); } return btoa(s2); };
  const unb64 = (str, n) => { const bin = atob(str), out = new Uint8Array(n); for (let i = 0; i < bin.length; i++) { const v = bin.charCodeAt(i); for (let k = 0; k < 8; k++) if (v & (1 << k) && i * 8 + k < n) out[i * 8 + k] = 1; } return out; };
  function snapshot() {
    if (S.phase !== 'day' || S.over) return null;
    return { v: SAVE_V, seed, mapSeed: mapSeed ?? seed, biome, hero: S.heroClass, mode: S.mode, difficulty: S.difficulty, clock: S.clock, city: map.name, savedAt: Date.now(),
      legacy: S.legacy, night: S.night, gold: S.gold, food: S.food, kills: S.kills, stock: S.stock, survivors: S.survivors, heat: S.heat, foreman: S.foreman, builders: S.builders, autopilot: !!S.autopilot,
      sealed: [...S.sealed], kits: S.kits, claimed: [...S.claimed], nestAlive: S.nestAlive, wake: S.wake.map(w => (Number.isFinite(w) ? w : -1)),
      P: S.P, picks: S.picks, chestsHeld: S.chestsHeld, dawns: S.dawns, weather: S.weather, reroll: S.reroll, halfUpgrade: S.halfUpgrade,
      landmarks: S.landmarks.map(l => [l.owned ? 1 : 0, l.kind, l.stripped ? 1 : 0]), seen: b64(S.seen), stats: S.stats, log: S.log.slice(-30),
      evo: S.evo, path: S.path, feat: S.feat, noiseChoice: S.noiseChoice || 0, mourned: S.mourned || 0, diffNight: S.diffNight || 0, tools: S.tools, carry: S.hero.carry, ledger: S.ledger || null, pickups: S.pickups, season: S.season, buildersWas: S.buildersWas ?? null, story: S.story, lvl: S.lvl, xp: S.xp, unique: S.unique || null, eruption: S.eruption, heatCool: S.heatCool, sawBlackout: !!S.sawBlackout, trade: S.trade, drained: S.drained, salvage: S.salvage, cleared: S.clearedIdx || [], nextId: S.nextId, handsUsed: S.handsUsed, dayT: S.dayT,
      buildings: S.buildings.map(b => [b.id, b.type, b.level, +b.x.toFixed(2), +b.y.toFixed(2), b.rot || 0, b.ruined ? 1 : 0, b.type === 'house' ? (b.folk ?? -1) : -1]), homeless: S.homeless || 0, keep: [keep.level, Math.ceil(keep.hp)], heroAt: [Math.ceil(S.hero.hp), +S.hero.x.toFixed(2), +S.hero.y.toFixed(2)] };
  }
  function restoreSnap(R) {
    Object.assign(S, { night: R.night, gold: R.gold, food: R.food, kills: R.kills, stock: R.stock, survivors: R.survivors, heat: R.heat, foreman: R.foreman, builders: R.builders, autopilot: R.autopilot,
      kits: R.kits, claimed: new Set(R.claimed), nestAlive: R.nestAlive, wake: R.wake.map(w => (w < 0 ? Infinity : w)), P: R.P, picks: R.picks, chestsHeld: R.chestsHeld, dawns: R.dawns,
      weather: R.weather, reroll: R.reroll, halfUpgrade: R.halfUpgrade, stats: R.stats, log: R.log || [], evo: R.evo, pickups: R.pickups || [], path: R.path || S.path, feat: R.feat || {}, season: R.season || S.season, buildersWas: R.buildersWas ?? undefined, lvl: R.lvl || 1, xp: R.xp || 0, unique: R.unique || undefined, eruption: R.eruption || null, heatCool: R.heatCool || 0, sawBlackout: !!R.sawBlackout, trade: R.trade || null, drained: R.drained, salvage: R.salvage, clearedIdx: R.cleared, handsUsed: R.handsUsed, dayT: R.dayT });
    S.sealed = Uint8Array.from(R.sealed); S.sealVersion++;
    mastSet = new Set(Object.values(S.P.mastery));
    R.landmarks.forEach(([o, k, st], i) => { const l = S.landmarks[i]; if (l) { l.owned = !!o; l.kind = k; l.stripped = !!st; } });
    S.seen = unb64(R.seen, N * N); S.seenVersion++;
    for (const k of Object.keys(S.story)) delete S.story[k]; Object.assign(S.story, R.story);
    for (const e of S.story.encounters) if (!e.ai || typeof e.ai !== 'object') e.ai = null;
    for (const i of R.cleared || []) map.terrain[i] = map.terrain[i] === T.ROCK ? T.DIRT : T.GRASS;
    for (const b of [...S.buildings]) removeBuilding(b);
    let oldFolk = false;
    for (const [id, type, level, x, y, rot, ru, folk] of R.buildings) { const b = placeBuilding(type, x, y, rot, level, id); if (ru) { b.ruined = true; b.hp = 0; vacate(b, true); } if (type === 'house') { if (folk === undefined) oldFolk = true; b.folk = folk >= 0 ? folk : ru ? 0 : houseCap(b); } }
    S.homeless = R.homeless || 0;
    if (oldFolk) {   // a save from before homes had families of their own: keep its head count (homes' capacity − the mourned)
      const was = S.survivors + S.buildings.reduce((a, b) => a + (b.type === 'house' ? houseCap(b) : 0), 0) - (R.mourned || 0), now = pop();
      if (was > now) S.homeless += was - now; else S.survivors = Math.max(0, S.survivors - (now - was));
    }
    Object.assign(S, { noiseChoice: R.noiseChoice || 0, mourned: R.mourned || 0, diffNight: R.diffNight || 0, tools: R.tools || { flare: 0, smoke: 0 }, ledger: R.ledger || null });
    if (R.carry) S.hero.carry = { scrap: R.carry.scrap || 0, food: R.carry.food || 0 };
    if (!S.season.rules) S.season.rules = S.season.rule ? [S.season.rule] : [];
    titlesSeen = (S.story.titles || []).length;
    S.nextId = Math.max(R.nextId, S.nextId);
    keep.level = R.keep[0]; keep.r = 2.3 * (1 + 0.12 * (keep.level - 1)); refreshMax(); keep.hp = Math.min(keep.maxHp, R.keep[1]);
    refreshMax(); S.hero.hp = Math.min(S.hero.maxHp, R.heroAt[0]); S.hero.x = R.heroAt[1]; S.hero.y = R.heroAt[2]; unstickHero();
    for (const m of S.mobs) mobById.delete(m.id); S.mobs.length = 0; S.projectiles.length = 0; S.drops = []; S.chests = []; S.purses = [];
    S.flowDirty = true; S.occVersion = (S.occVersion || 0) + 1; liveTick = -1; crewCache = null;
    for (const n of S.story.npcs) if (n.withHero && n.alive && n.joined) spawnCompanion(n);   // a travelling companion comes back with you
    spawnRoamers(); spawnAnimals(); syncPicks(); rollOffer(); newLog(); S.events.length = 0; S.restored = true;
  }
  let planner = null;
  const api = {
    setBuilders: f => { if ((S.foreman || S.autopilot) && FOCI.includes(f)) S.builders = f; },
    scavenge: { siteInfo: sc.siteInfo, send: sc.send, recall: sc.recall, treat: sc.treat, exile: sc.exile, hopsMap: sc.hopsMap },
    state: S, map, get heroDef() { return HC; }, evolve: cls => evolve(cls), step, build, choosePack, rerollPacks, buyCost, upgrade, demolish, upgradeKeep, startNight, choosePerk, reroll, trade, planPurge, useAbility,
    setHeroInput: (x, y) => { S.hero.input.x = x; S.hero.input.y = y; if (x || y) handT = 2; },
    setAutopilot: on => { S.autopilot = !!on; if (on && (!S.builders || S.builders === 'off')) { S.buildersWas = S.builders; S.builders = 'balanced'; } else if (!on) { S.builders = S.foreman ? (S.buildersWas ?? null) : null; S.buildersWas = undefined; } },
    heroTo: (x, y) => {
      const h = S.hero, t = h.target;
      if (t && h.path && Math.hypot(t.x - x, t.y - y) < 0.6) return;   // same place: keep the plan
      h.target = { x, y }; h.path = heroPath(x, y);
    },
    buildLine, upgradeWall, wallRun, wallBudget, lineCells,
    weather: () => ({ id: S.weather, ...W8() }),
    hiveHealth, hitHive, escape, escapeCost: k => (TOOLS[k] || ESCAPE[k] || {}).cost || 0,
    useFlare, useSmoke, tools: toolsInfo,
    nightFrac: () => (S.phase === 'night' ? Math.min(1, S.qT / nightLen()) : 0), nightLen,
    // one continuous clock for the light: 0 sunrise … dayShare dusk falls … 1 the next sunrise (day from S.dayT, night from S.qT)
    timeOfDay: () => { const D = TIDE.dayLen / (TIDE.dayLen + nightLen());
      if (S.phase === 'over') return todLast;   // the run ended: the light holds where it was
      return (todLast = S.phase === 'night' ? D + (1 - D) * Math.min(1, S.qT / nightLen()) : D * (S.clock ? Math.min(1, S.dayT / TIDE.dayLen) : 0.4)); },
    dayShare: () => TIDE.dayLen / (TIDE.dayLen + nightLen()),
    duskIn: () => Math.max(0, TIDE.dayLen - S.dayT), dayFrac: () => (S.clock ? Math.min(1, S.dayT / TIDE.dayLen) : 0.4), bellBonus: () => (S.clock ? Math.floor(Math.max(0, TIDE.dayLen - S.dayT) / TIDE.bellGold) : 0),
    dropSupply,
    xpNext: () => LEVEL.xp(S.lvl), gainXp: n => gainXp(n), addPath: (f, n) => addPath(f, n), checkEvolution: () => checkEvolution(), partySize: () => partySize(), companionFollow, snapshot, frontier, districtOffer, openDistrict, kitFor, siteOf, story: () => story, choose: id => story.choose(id),
    // noise: one meter 0–100 (S.noise). noiseInfo: what it is made of and what it does right now
    noise: () => Math.round(S.noise || 0),
    noiseInfo: () => ({ noise: Math.round(S.noise || 0), floor: Math.round(noiseFloor() * noiseCalm()), choice: Math.round(S.noiseChoice || 0), spike: Math.round(S.noiseSpike || 0), hear: Math.round(hearR()), mult: +townDraw().toFixed(2), erupt: HEAT.erupt, stir: HEAT.stir, live: !!S.feat.heat }),
    hearRadius: () => hearR(),
    // tension: ruins, rebuilding, the forecast strip and the dawn ledger
    rebuild, rebuildAll, rebuildCost: id => { const b = S.byId.get(id); return b && b.ruined ? rebuildCost(b) : 0; }, ruins: () => ruins().map(b => ({ id: b.id, type: b.type, level: b.level, x: b.x, y: b.y, cost: rebuildCost(b) })),
    forecastStrip: () => forecastStrip(), ledger: () => S.ledger || null,
    keepCost: () => { const n = KEEP.need[keep.level]; return keep.level >= 3 ? null : { scrap: KEEP.cost[keep.level], food: (n && n.food) || 0, needs: keepNeeds() }; },
    // contracts (sim/contracts.js builds the offer): stacked rules, the finale, the difficulty step back
    rule: id => rule(id), contractWon, setSeasonRules, setDifficulty, endRun, setFinale, season: () => S.season, effNight: (n = S.night) => effN(n),
    cut: CUT, raiseBlock: id => raiseBlock(S.byId.get(id)), perkOk,
    hitBuilding: (id, d) => { const b = S.byId.get(id); if (b) damageBuilding(b, d); return b ? b.hp : 0; }, hurtHero: n => hurtHero(n),   // scripted events and tests
    spawnMob: (kind, x, y, o) => { const m = spawnMob(kind, x, y); if (m && o) Object.assign(m, o); return m; }, killMob: (m, src = 'hero') => killMob(m, src),
    keepNeeds, hasTech, crewing, manned, handsMax, handsFree, powerIn, powerOut, powered, heatFloor, addHeat, difficulty: () => DIFF, newCost, townDraw, noise, reveal, claimLandmark, landmarkReach: id => landmarkReach(S.landmarks[id]), owns, zone, inZone: (x, y) => inZone(idx(Math.floor(x), Math.floor(y))), baseDist, keepForRing, keepLevel: () => keep.level,
    rubbleAt, clearRubble,
    canPlace, buildingAt, costOf, upCostOf, maxHpOf, keepMaxHp, pop, defenceDps, heroDps, threatRatio, ratingOf, activeNests, regionInfo, canPurge,
    abilityCost, towerStats: b => towerStats(b), has,
    foodPerDawn,
    goldPerDawn: () => Math.round((START.baseIncome * DIFF.eco + S.P.tax + S.buildings.reduce((a, b) => a + (b.type === 'house' && !b.ruined ? houseGold(b) : 0), 0)) * prosper()) - upkeep() + S.landmarks.reduce((a, l) => a + (l.owned ? LANDMARKS[l.kind].gold || 0 : 0), 0) + (owns('tvtower') ? 3 : 0) + (HC.quarter ? 4 : 0),
    upkeep, foodNeed, rerollCost: () => (S.reroll.free > 0 ? 0 : S.reroll.cost),
    forecast, mastered, mastery, isBloodMoon, drainEvents: () => S.events.splice(0),
    logRows: () => S.log.concat(S.cur && !S.cur.closed && S.cur.waveHp ? [S.cur] : []),
  };
  planner = createPlanner(api); api.planner = planner;
  if (restore) restoreSnap(restore);
  // [road] begin
  if (road) { road.attach(api); if (restore && restore.road) road.load(restore.road); }
  // [road] end
  return api;
}
