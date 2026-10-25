// Mob definitions and wave-budget rules. `cost` is how much of a night's budget one mob uses.
// `from` is the first night the mob can appear. `weight` is its relative share once unlocked.

export const MOBS = {
  walker:    { name: 'Cinder',   hp: 3,  speed: 1.5,  dmg: 2,  cost: 1,   from: 1, weight: 10, size: 1 },
  runner:    { name: 'Flicker',   hp: 2,  speed: 3.0,  dmg: 1,  cost: 1.2, from: 3, weight: 4,  size: 0.85 },
  crawler:   { name: 'Ember Crawler',  hp: 3,  speed: 1.8,  dmg: 2,  cost: 1.5, from: 4, weight: 3,  size: 0.8, climbs: true },
  brute:     { name: 'Slag Brute',    hp: 18, speed: 0.95, dmg: 6,  cost: 5,   from: 7, weight: 1.5, size: 1.6, dropsChest: 0.04 },
  spitter:   { name: 'Spark Spitter',  hp: 3,  speed: 1.3,  dmg: 2,  cost: 2,   from: 7, weight: 2,  size: 0.95, range: 5, rate: 1.6 },
  bloater:   { name: 'Boiler Bloat',  hp: 8,  speed: 1.0,  dmg: 0,  cost: 2.5, from: 9, weight: 2,  size: 1.35, burst: { dmg: 10, radius: 2.4 } },
  screamer:  { name: 'Siren', hp: 5,  speed: 1.6,  dmg: 1,  cost: 3,   from: 11, weight: 1,  size: 1.05, aura: { speed: 1.35, radius: 4.5 } },
  // not drawn from the budget: spawned by events
  guardian:  { name: 'Inferno Warden', hp: 30, speed: 0.9, dmg: 8, cost: 0, from: 99, weight: 0, size: 1.8, dropsChest: 1 },
  gravelord: { name: 'Cinder Lord', hp: 70, speed: 0.8, dmg: 12, cost: 0, from: 99, weight: 0, size: 2.3, summon: { kind: 'walker', every: 6, count: 2 }, dropsChest: 1 },
  risen:     { name: 'Husk',     hp: 2,  speed: 1.5,  dmg: 2,  cost: 0, from: 99, weight: 0, size: 0.95, fixedHp: true },
  // the woods: game for the pot, and the wolves that hunt it
  deer:      { name: 'Deer',      hp: 3,  speed: 2.6,  dmg: 0,  cost: 0, from: 99, weight: 0, size: 0.95, fixedHp: true, animal: true, food: 2 },
  wolf:      { name: 'Wolf',      hp: 5,  speed: 3.1,  dmg: 2,  cost: 0, from: 99, weight: 0, size: 0.85, fixedHp: true, animal: true, food: 1 },
  boar:      { name: 'Boar',      hp: 8,  speed: 2.3,  dmg: 3,  cost: 0, from: 99, weight: 0, size: 0.9,  fixedHp: true, animal: true, food: 3, sight: 2.5 },   // roots and grunts; charges only when you come close or strike it
};

// The brain: every dead goes for the loudest thing it senses. You, if you are close and out in the open; the town otherwise.
// Rank is brains: higher ranks sense you further, keep your trail longer, remember where they last saw you,
// and (rank 3+) wait for you on the road home.
export const BRAIN = {
  rank: { walker: 1, risen: 1, crawler: 1, runner: 2, spitter: 2, bloater: 2, brute: 3, screamer: 3, guardian: 4, gravelord: 4, wolf: 2, deer: 0, boar: 1 },
  sense: [0, 5, 8, 11, 14],        // cells: how far they notice you (more when you are fighting, less in smoke)
  forget: [0, 1.6, 2.2, 2.6, 3],   // they lose you past sense × this
  remember: [0, 0, 6, 10, 14],     // seconds they search where they last saw you
  ambush: [0, 0, 0, 0.45, 0.8],    // chance a rank-3+ dead waits on your road home instead of marching on the town
  farSpeed: 2,                     // far from you and the town (off screen), the dead walk this much faster
};
// The dead toughen slowly with the nights (the hordes' size carries the climb: content/hordes.js).
export const WAVES = {
  hpScale: n => Math.pow(1.035, n - 1),
};

// Continuous pressure: a clock-driven day with a low tide of stragglers, roaming dead in the wild, and a gentle opening.
export const TIDE = {
  dayLen: 170,                 // seconds of day before dusk falls on its own (at 1× speed). Oct 20: 100 → 170, "days are a rush"
  dayOne: 60,                  // day 1 is shorter (the story starts its clock this close to dusk) but not rushed: 40 → 60
  dayRef: 100,                 // the day length the day's pressure was tuned for: the stream and roamer drift by day run at dayRef/dayLen, so a longer day is not more dead
  nightIncome: 0.5,            // scrap and food trickle in all day; at night at this share of the day's rate (sim/income.js)
  bellGold: 10,                // ringing early pays 1 gold per this many seconds left
  drift: 0.012,                        // per second: chance a roamer next to your land wanders in toward the town
  nightLen: 72,                // seconds every night lasts, cleared or not: the moon crosses the whole sky before dawn
  roam: { perRing: [0, 3, 12], hiveGap: 7, radius: 4.5, sight: 6, leash: 10, lose: 16, cap: 150, animals: { deer: { cap: 20, start: 14, herd: [2, 4], regrow: 1 }, boar: { cap: 6, start: 2, herd: [2, 2], regrow: 1 }, wolf: { cap: 6, start: 0, herd: [2, 3], regrow: 1, from: 2 } }, chase: { walker: 1.35, runner: 1.1, brute: 1.25, crawler: 1.2 } },   // a hunting roamer moves this much faster than it wanders
};

