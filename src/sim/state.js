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
// missions: the dusk choice (Hold / The Hunt / The Pied Piper) is gone; every night is a plain hold. The code in
// (sim/missions.js was deleted with the road, Oct 25.)
// tools: the Flare and Smoke buttons are gone (Oct 20: "no idea what they do"); useFlare/useSmoke fail quietly,
// the code, the fx and the tuning stay in sim/hives.js and TOOLS below.
// the save format: v4 (Oct 20) carries ruins, Noise, tools, contracts and the road; older saves are ignored at the start screen
export const SAVE_V = 4;
export const CUT = { walls: true, power: true, hands: true, weather: true, titleStats: true, finalClass: false, secondCompanion: true, trader: true, crew: true, missions: true, tools: true };
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
// Fronts: the dead come from at least `want(n)` sides a night (sources closer than `side` radians are one side). When
// the awake hives lie on one side, a pack walks out of the deep woods ≥`far` round (weight `pack` of a hive), and each
// source gets at least `min` of the night's dead. Same budget: only where it comes from.
export const FRONTS = { want: n => (n >= 5 ? 3 : 2), side: 1.4, far: 1.75, pack: 0.5, min: 3 };
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
// thresholds calibrated from bot runs (tools/balance.mjs → threat ratio vs outcome)
export const RATING = [[0.3, 'Easy'], [0.55, 'Medium'], [0.8, 'Hard'], [Infinity, 'Impossible']];
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
export const SIZE = { house: 2, farm: 2, tower: 1, wall: 1, workshop: 3, market: 3, generator: 2 };
export const LOT_PAD = { house: 1, farm: 1, tower: 1, workshop: 1, market: 1, wall: 0, generator: 1 };   // the path each lot includes   // compact footprints; palisades are single posts, laid in lines
export const BIG = 1.6; // mobs at least this size count as "big game"

/** the run's state at the start of day 1 (before any building, roamer or story): S */
export function createState({ seed, biome, map, hero, mode, clock, difficulty, legacy, HC }) {
  const c = map.town.x;
  const S = {
    seed, biome, map, heroClass: hero, mode, lvl: 1, xp: 0, night: 1, phase: 'day', time: 0,
    stock: { ...PACK_RULES.start }, packs: [], difficulty: DIFFICULTY[difficulty] ? difficulty : 'survivor', handsUsed: 0, handsExtra: 0, heat: 0, noise: 0, noiseChoice: 0, noiseSpike: 0, mourned: 0, diffNight: 0, tools: { flare: 0, smoke: 0 }, eruption: null, heatCool: 0, blackout: false, foreman: false, feat: {}, season: { n: 1, id: SEASONS[0].id, rule: SEASONS[0].rule || null, rules: SEASONS[0].rule ? [SEASONS[0].rule] : [], name: SEASONS[0].name, finale: SEASONS[0].finale, end: seasonEnd(1), start: 1, won: false },
    gold: START.gold, food: START.food, kills: 0, events: [],
    buildings: [], occ: new Int32Array(N * N).fill(-1), res: new Int32Array(N * N).fill(-1),
    claimed: new Set([0]), nestAlive: map.regions.map(r => !!r.nest), wake: map.regions.map(() => Infinity),
    mobs: [], projectiles: [], chests: [], purses: [], allies: [], nextId: 1, queue: [], qT: 0, purge: null, nightFlags: {},
    P: freshPerkState(), picks: [], pendingPicks: 0, offer: [], offerSource: null, chestsHeld: 0, dawns: 0,
    trade: null, halfUpgrade: false,
    weather: 'clear', clock, dayT: 0, dayQueue: [], drops: [], landmarks: map.landmarks.map(l => ({ ...l, owned: false })), seen: new Uint8Array(N * N), seenVersion: 0, builders: null, survivors: START.survivors,
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
  return S;
}
// Nests defend themselves (sim/nests.js): a guard pack rises when you come within `wake` of a living hive (once a
// day), and while you stay within `near` its rage climbs one level every `step` seconds (a strike adds `hit`), each
// level a wave of (wave + waveLv × lv) × night × tier dead, tougher by hpLv a level. Away from it the rage cools at `decay`.
// Re-measured with no healing by a hive (Oct 20 pm, tools: day-1 warrior striking a hollow from its edge, War Cry when
// 3+ dead are on him): it burns in ~45 s and he ends at 59–80% (lowest 18–48% mid-fight); without War Cry 41–62%.
// Standing beside it without striking, he dies in 90–260 s: a frenzied hive (rage at max) keeps sending a wave every
// `step`. Brutes: city hives' frenzy only. `hit` 0.2 → 0.1: with no regen, every strike also stoking the rage was too much.
// The hero's own healing (sim/hero.js): none while fighting (hit or hitting in the last `combat` s) or within `hive`
// cells of a living hive; slow out in the field by day, quick at the Camp (within `campR` of the fire, or on your land).
// Perks, the Clinic and companions add their regen on top, except next to a hive.
export const REGEN = { combat: 5, hive: 11, field: 0.5, camp: 4, campNight: 2, campR: 7 };
export const NEST = {
  wake: 11, near: 8, step: 9, hit: 0.1, decay: 1.2, max: 12, cap: 5, bruteLv: 5, bruteNight: 11, hpLv: 0.05,
  body: { hollow: 3, city: 2.2 }, struck: 2.5,   // a mound hive's body radius (the model's footprint, cells); striking it counts as standing near it this long
  pack: [0, 3, 5, 7], packPer: 0.25, wave: 1, waveLv: 0.45, nightBase: 0.85, nightPer: 0.02, nightMax: 1.15, tier: [1, 1, 1.6, 2.2],
  lines: { 1: '[Inferno Nest stirs] It knows you are here: **{n} more** crawl out. The longer you stay, the more it sends.', 3: '[Inferno Nest enraged] **{n} more**, faster and tougher. Burn it now or back off.', 5: '[Inferno Nest frenzied] It pours out everything it has.' },
};
