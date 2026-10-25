// The Mechanic: the only class in chapter 1. A weak wrench that hits by itself, Salvage (scrap and parts from cars
// and machines), and scrap turrets that do the real killing; plus the dash (combat2.js DASH). Pure data, a first pass
// to tune: a sim module (proposed: src/sim/mechanic.js) applies it. Parts are a new stock beside scrap and food.

// the wrench: auto-hits the nearest Ash-Born in reach. Weak on purpose: a Cinder (hp 3) takes three hits.
export const WRENCH = { dmg: 1.2, reach: 1.6, rate: 0.6, perLevel: 0.08, knock: 0.6 };   // dmg + perLevel × (level − 1)

// salvage: hold near a car or machine. Each one gives once per chapter (cars do not come back).
// time: seconds to strip it at Salvage Lv 1, minus `faster` a level. part: chance of a part, plus `partUp` a level.
export const SALVAGE = {
  reach: 1.8, faster: 0.3, minTime: 1.4, scrapUp: 1, partUp: 0.15, noise: 2,   // noise: salvaging is loud, roamers nearby notice
  kinds: {
    car: { name: 'car', time: 2.4, scrap: 2, part: 0.3 },
    van: { name: 'van', time: 2.8, scrap: 3, part: 0.5 },
    bus: { name: 'bus', time: 4, scrap: 5, part: 1 },
    tractor: { name: 'tractor', time: 3.2, scrap: 3, part: 1 },        // old engines: no chip, good parts
    machine: { name: 'machine', time: 3, scrap: 3, part: 1 },         // lathes, pumps, the Works floor
    bench: { name: 'workbench', time: 3, scrap: 1, part: 1 },         // Kai's garage (q4.garage)
    gate: { name: 'gate', time: 5, scrap: 4, part: 0 },               // the Engine Works gate (q7.gate)
  },
};

// scrap turrets: built on pads round the Rig (and anywhere on cleared ground later). Tier 2 needs the Workshop,
// tier 3 the Workshop Lv 2. A turret upgrades in place (cost is the step, not the total).
export const TURRETS = [
  { id: 'nail', tier: 1, name: 'Nail Spitter', cost: { scrap: 6, parts: 0 }, build: 6, hp: 20, range: 6.5, dmg: 1, rate: 0.8, needs: null,
    line: 'Spits nails · range 6.5' },
  { id: 'bolt', tier: 2, name: 'Bolt Driver', cost: { scrap: 8, parts: 2 }, build: 8, hp: 32, range: 8, dmg: 1.8, rate: 0.7, needs: 'workshop',
    line: 'Heavy bolts · range 8' },
  { id: 'rivet', tier: 3, name: 'Rivet Cannon', cost: { scrap: 12, parts: 4 }, build: 10, hp: 45, range: 9.5, dmg: 2.8, rate: 0.65, pierce: 2, needs: 'workshop2',
    line: 'Rivets pierce two · range 9.5' },
];
// turret slots: how many turrets the System allows, by Mechanic level (the System says it as [Turret slots: n])
export const SLOTS = [3, 3, 4, 4, 5, 6, 7, 8];   // index = level − 1

// growth: one level a night or so (xp comes from story1.js rewards, salvage and turret kills)
export const XP = { salvage: 0.5, kill: 0.2, turretKill: 0.1, need: lv => 8 + 6 * (lv - 1) };
export const LEVELS = [
  { lv: 1, gets: ['salvage:1', 'turret:nail'], sys: ['[Class granted: Mechanic]', '[Skill: Salvage · Lv 1]', '[Skill: Scrap Turret · Lv 1]'] },
  { lv: 2, gets: ['salvage:2'], sys: ['[Mechanic · Lv 2]', '[Skill: Salvage · Lv 2]'] },
  { lv: 3, gets: ['repair'], sys: ['[Mechanic · Lv 3]', '[Skill acquired: Field Repair]'] },     // hold at a turret: +4 hp/s
  { lv: 4, gets: ['slots'], sys: ['[Mechanic · Lv 4]', '[Turret slots: 4]'] },
  { lv: 5, gets: ['salvage:3', 'sense'], sys: ['[Mechanic · Lv 5]', '[Skill: Salvage · Lv 3]', '[Skill acquired: Scrap Sense]'] },   // cars with parts glint
  { lv: 6, gets: ['overclock'], sys: ['[Mechanic · Lv 6]', '[Skill acquired: Overclock]'] },     // turrets within 4 m of Kai fire 25% faster
  { lv: 7, gets: ['slots'], sys: ['[Mechanic · Lv 7]', '[Turret slots: 7]'] },
];
export const SKILLS = {
  repair: { name: 'Field Repair', hps: 4, reach: 1.6 },
  sense: { name: 'Scrap Sense', r: 14 },
  overclock: { name: 'Overclock', r: 4, rate: 1.25 },
};

// the first balance table, night by night. n: the night. day, dark: seconds of day and of night at 1× speed. hordes: awake tonight (of 6 spots).
// march: dead in each marching horde (two numbers = two marches). kinds: the mix (ids from mobs.js).
// scrap: what a fair player should have earned by dusk. turrets: what they should have standing.
export const BALANCE = [
  { n: 1, day: 300, dark: 150, hordes: 3, march: [], first: 1, kinds: [['walker', 1]], scrap: 14, parts: 1, turrets: 2, lv: 1 },
  { n: 2, day: 420, dark: 200, hordes: 4, march: [5], kinds: [['walker', 1]], scrap: 30, parts: 3, turrets: 3, lv: 2 },
  { n: 3, day: 420, dark: 210, hordes: 5, march: [7], kinds: [['walker', 7], ['runner', 3]], scrap: 48, parts: 6, turrets: 3, lv: 3 },
  { n: 4, day: 420, dark: 220, hordes: 6, march: [8], kinds: [['walker', 7], ['runner', 3]], scrap: 66, parts: 10, turrets: 4, lv: 4 },
  { n: 5, day: 420, dark: 230, hordes: 6, march: [10], brute: 1, kinds: [['walker', 6], ['runner', 3], ['brute', 1]], scrap: 86, parts: 15, turrets: 5, lv: 5 },
  { n: 6, day: 420, dark: 260, hordes: 6, march: [8, 8], brute: 1, kinds: [['walker', 6], ['runner', 3], ['brute', 1]], scrap: 108, parts: 20, turrets: 6, lv: 6 },
  { n: 7, day: 600, dark: 180, hordes: 6, march: [12], works: [6, 8, 10], boss: 'guardian', kinds: [['walker', 5], ['runner', 4], ['brute', 1]], scrap: 0, parts: 0, turrets: 7, lv: 7 },
];
// day 7 is the storm (about 10 min by day), then the last march while the crankshaft goes in; the Rig rolls when it is in.
