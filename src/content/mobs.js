// Mob definitions and wave-budget rules. `cost` is how much of a night's budget one mob uses.
// `from` is the first night the mob can appear. `weight` is its relative share once unlocked.

export const MOBS = {
  walker:    { name: 'Walker',    hp: 3,  speed: 1.5,  dmg: 2,  cost: 1,   from: 1, weight: 10, size: 1 },
  runner:    { name: 'Runner',    hp: 2,  speed: 3.0,  dmg: 1,  cost: 1.2, from: 3, weight: 4,  size: 0.85 },
  crawler:   { name: 'Crawler',   hp: 3,  speed: 1.8,  dmg: 2,  cost: 1.5, from: 4, weight: 3,  size: 0.8, climbs: true },
  brute:     { name: 'Brute',     hp: 18, speed: 0.95, dmg: 6,  cost: 5,   from: 6, weight: 1.5, size: 1.6, dropsChest: 0.2 },
  spitter:   { name: 'Spitter',   hp: 3,  speed: 1.3,  dmg: 2,  cost: 2,   from: 6, weight: 2,  size: 0.95, range: 5, rate: 1.6 },
  bloater:   { name: 'Bloater',   hp: 8,  speed: 1.0,  dmg: 0,  cost: 2.5, from: 7, weight: 2,  size: 1.35, burst: { dmg: 10, radius: 2.4 } },
  screamer:  { name: 'Screamer',  hp: 5,  speed: 1.6,  dmg: 1,  cost: 3,   from: 9, weight: 1,  size: 1.05, aura: { speed: 1.35, radius: 4.5 } },
  // not drawn from the budget: spawned by events
  guardian:  { name: 'Nest Guardian', hp: 30, speed: 0.9, dmg: 8, cost: 0, from: 99, weight: 0, size: 1.8, dropsChest: 1 },
  gravelord: { name: 'Gravelord', hp: 70, speed: 0.8, dmg: 12, cost: 0, from: 99, weight: 0, size: 2.3, summon: { kind: 'walker', every: 6, count: 2 }, dropsChest: 1 },
  risen:     { name: 'Risen',     hp: 2,  speed: 1.5,  dmg: 2,  cost: 0, from: 99, weight: 0, size: 0.95, fixedHp: true },
};

export const WAVES = {
  budget: n => 6 + 2.6 * n + 0.42 * n * n,          // mob-cost points per night
  hpScale: n => Math.pow(1.06, n - 1) * (1 + 0.04 * (n - 1)),   // exponential: endless runs always end
  territory: claimed => 1 + 0.12 * (claimed - 1),    // each claimed region beyond the core adds 12%
  plunder: ring => 6 + 6 * ring,                     // gold found in a burned nest
  bloodMoonEvery: 5,
  bloodMoonMult: n => (n < 10 ? 1 : 1.35),      // the first blood moon is a warning shot: just its guardian
  surges: n => 2 + Math.floor(n / 3),
  duration: n => Math.min(40, 14 + 1.4 * n),
  // a purge siege adds this share of the night's budget, scaled by the nest's ring
  purgeShare: ring => (ring === 1 ? 0.55 : 0.85),
};
