// The rules' numbers and the initial state. Every tuning constant the rules read lives here (game.js re-exports the
// public ones); createState builds the run's state object S (every field the UI, bots, saves and the story read:
// see src/CONTRACT.md before renaming one).
import { N } from './mapgen.js';
import { START } from '../content/buildings.js';
import { freshPerkState } from '../content/perks.js';
import { PACK_RULES } from '../content/packs.js';
import { SEASONS, RULES, seasonEnd } from '../content/season.js';

export const STEP = 1 / 60;
export const PICKS_PER_DAWN = 2;
export const DROPS = { channel: 3, reach: 1.7, life: 2 };   // seconds to open, how close, nights it lasts
export const ZONE = { keep: 13, building: 4.5, landmark: 7, hiveBlock: 6, hiveReach: 14 };
export const CREW_NEED = [1, 2, 3];        // people a tower needs at level 1/2/3
// ---------- cuts (decided Oct 20): each system stays in the code behind a flag so it can return ----------
// hands: no daily hand limit · weather: never rolled at dawn, its effects live in season rules (storm, still)
// titleStats: titles are flavour, their stat effects are undone · finalClass / secondCompanion: parked
// trader: the Scavver meets no trader · crew: the scavenge crew generates no events or bonuses
// walls: barricades are out of the build list. Measured (Oct 20, same camp on night 8, 4 seeds): 25 posts laid
// across the routes soaked 50 damage in all; the dead walk round a line. They come back with a ring-building tool.
// missions: the dusk choice (Hold / The Hunt / The Pied Piper) is gone; every night is a plain hold. The code in
// (sim/missions.js was deleted with the road, Oct 25.)
// the save format: v4 (Oct 20) carries ruins, Noise, tools, contracts and the road; older saves are ignored at the start screen
export const SAVE_V = 4;
export const CUT = { walls: true, hands: true, weather: true, titleStats: true, finalClass: false, secondCompanion: true, trader: true, crew: true, missions: true };
// Tension: ruins persist until rebuilt by hand; the hall falls over ~30 s; dying costs the night.
export const TENSION = { hallCap: 0.03, hallGuard: 0.5, guardR: 3, respawn: 30, downRate: 0.75, rebuild: 0.5 };
// The hero's presence: towers near the hero shoot faster and further; whatever the hero hits is Marked for the towers.
export const PRESENCE = { r: 6, rate: 1.3, range: 2, markT: 4, mark: 1.3 };
// Season rules that used to be weather (rolled at dawn, now a contract's rule): what they do to a night
export const RULE_FX = {
  storm: { name: RULES.storm.name, desc: RULES.storm.desc, weather: 'storm' },
  still: { name: RULES.still.name, desc: RULES.still.desc, weather: 'still' },
};
// Difficulty: threat (how many dead), economy (what homes and farms give), heat (how fast attention builds).
export const DIFFICULTY = {
  story:     { name: 'Story', blurb: 'For the story and the city. Fewer Ash-Born, richer homes.', threat: 0.55, eco: 1.25, heat: 0.7 },
  survivor:  { name: 'Survivor', blurb: 'Fair but hard. The way it is meant to be played.', threat: 0.88, eco: 1, heat: 1 },
  veteran:   { name: 'Veteran', blurb: 'More Ash-Born, thinner supplies. Mistakes cost buildings.', threat: 1.15, eco: 0.9, heat: 1.2 },
  nightmare: { name: 'Nightmare', blurb: 'The city wants you dead. It usually gets its way.', threat: 1.45, eco: 0.8, heat: 1.4 },
};
export const FOREMAN = { buildings: 6, keep: 3 };   // the Foreman: a toggle, never on by itself
// hero levels: XP from the dead you put down yourself, sites, quests and districts. Each level: a little harder, a little tougher.
// three class tiers (15 / 30 / 45) land around nights 9, 22 and ~37 for the autopilot bot (measured: ~390 xp by night 9,
// ~2000 by night 22, then ~200 a night); each level is a small step (a third of the old one)
export const LEVEL = { xp: lv => Math.round(1.2 * Math.pow(lv, 1.44) + 4), dmg: 0.03, hp: 1.3, max: 50, blessEvery: 15 };
export const WALL_COST = 6;            // extra path cost of breaking through a palisade
export class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } }
  pop() {
    const k = this.k, v = this.v, top = v[0]; this.lastKey = k[0]; const lk = k.pop(), lv = v.pop();
    if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } }
    return top;
  }
}
export const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
export const SIZE = { house: 2, farm: 2, tower: 1, wall: 1, workshop: 3, market: 3 };
export const LOT_PAD = { house: 1, farm: 1, tower: 1, workshop: 1, market: 1, wall: 0 };   // the path each lot includes   // compact footprints; palisades are single posts, laid in lines
export const BIG = 1.6; // mobs at least this size count as "big game"

/** the run's state at the start of day 1 (before any building, roamer or story): S */
export function createState({ seed, biome, map, hero, mode, clock, difficulty, legacy, HC }) {
  const c = map.town.x;
  const S = {
    seed, biome, map, heroClass: hero, mode, lvl: 1, xp: 0, night: 1, phase: 'day', time: 0,
    stock: { ...PACK_RULES.start }, packs: [], difficulty: DIFFICULTY[difficulty] ? difficulty : 'survivor', handsUsed: 0, handsExtra: 0, mourned: 0, diffNight: 0, foreman: false, feat: {}, season: { n: 1, id: SEASONS[0].id, rule: SEASONS[0].rule || null, rules: SEASONS[0].rule ? [SEASONS[0].rule] : [], name: SEASONS[0].name, finale: SEASONS[0].finale, end: seasonEnd(1), start: 1, won: false },
    gold: START.gold, food: START.food, kills: 0, events: [],
    buildings: [], occ: new Int32Array(N * N).fill(-1), res: new Int32Array(N * N).fill(-1),
    claimed: new Set([0]), nestAlive: map.regions.map(r => !!r.nest), wake: map.regions.map(() => Infinity),
    mobs: [], projectiles: [], chests: [], purses: [], allies: [], nextId: 1, queue: [], qT: 0, purge: null, nightFlags: {},
    P: freshPerkState(), picks: [], pendingPicks: 0, offer: [], offerSource: null, chestsHeld: 0, dawns: 0,
    trade: null, halfUpgrade: false,
    weather: 'clear', clock, dayT: 0, drops: [], landmarks: map.landmarks.map(l => ({ ...l, owned: false })), seen: new Uint8Array(N * N), seenVersion: 0, builders: null, survivors: START.survivors,
    log: [], cur: null, over: false, won: false,
    pickups: [], legacy: { ...legacy },
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
  return S;
}
// The hero's own healing (sim/hero.js): none while fighting (hit or hitting in the last `combat` s) or within `hive`
// cells of a living hive; slow out in the field by day, quick at the Camp (within `campR` of the fire, or on your land).
// Perks, the Clinic and companions add their regen on top, except next to a hive.
export const REGEN = { combat: 5, hive: 11, field: 0.5, camp: 4, campNight: 2, campR: 7 };
