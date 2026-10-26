// Building definitions. Arrays are indexed by level - 1. Pure data: tune here.
import { TURRETS } from './mechanic.js';
import { RIG2 } from './rig2.js';

export const BUILDINGS = {
  house: {
    name: 'Home', cost: [4, 6, 12], hp: [24, 36, 48], gold: [4, 7, 10], pop: [2, 4, 6],
    desc: ['+4 scrap a day · 2 people', '+7 scrap a day · 4 people', '+10 scrap a day · 6 people'],
  },
  farm: {
    name: 'Farm', cost: [3, 5, 10], hp: [14, 22, 30], food: [3, 6, 9],
    desc: ['+3 food a day', '+6 food a day', '+9 food a day'],
  },
  // [mech] the scrap turret line (content/mechanic.js TURRETS): Nail Spitter, Bolt Driver, Rivet Cannon. A level is a tier;
  // tiers 2 and 3 need the Rig's Workshop and cost parts too (sim/mechanic.js). No crew, no upkeep: it is a machine.
  tower: {
    name: 'Turret', names: TURRETS.map(t => t.name), cost: TURRETS.map(t => t.cost.scrap), parts: TURRETS.map(t => t.cost.parts), upkeep: [0, 0, 0],
    hp: TURRETS.map(t => t.hp), range: TURRETS.map(t => t.range), dmg: TURRETS.map(t => t.dmg), rate: TURRETS.map(t => t.rate),
    desc: TURRETS.map(t => t.line),
  },
  // barricades are real walls: the dead chew through them post by post. No salvage; a fallen post is a ruin you rebuild.
  wall: {
    name: 'Barricade', cost: [2, 3, 4], hp: [40, 90, 160], blocks: true,
    desc: ['One barricade post · 40 hp · you walk through, the Ash-Born must chew through', 'Wrecks and sandbags · 90 hp', 'Concrete and razor wire · 160 hp'],
  },
  // tech: one of each, bought with scrap only, take time to build, unlock level 3
  workshop: {
    name: 'Workshop', cost: [18], hp: [60], tech: true, keep: 2, buildTime: 40, maxLevel: 1,
    desc: ['Unlocks level 3 towers.'],
  },
  market: {
    name: 'Market', cost: [16], hp: [50], tech: true, keep: 2, buildTime: 35, maxLevel: 1,
    desc: ['Unlocks level 3 homes and farms. Every home pays 1 more scrap.'],
  },
};
// (barricades are out too: CUT.walls; BUILD_ORDER_WALLS is the list with them)
export const BUILD_ORDER = ['house', 'farm', 'tower'];
export const BUILD_ORDER_WALLS = ['house', 'farm', 'tower', 'wall'];
// each extra copy of a building costs more: the town has to choose, not spam. Towers climb in a straight line
// (+25% of the base per tower you have); homes and farms climb and flatten; barricades +1 scrap per dozen posts.
export const RISE = { house: 0.2, farm: 0.15, tower: 0, wall: 0, wallEvery: 12, workshop: 0, market: 0 };
// hands: every build or upgrade needs a free pair of hands for the day: 2 + √people
export const HANDS = { base: 2 };   // + the square root of your people (diminishing: a big town is not a fast town)
export const TECH_ORDER = ['workshop', 'market'];
export const UNLOCKS = { wall: 'workshop', house: 'market', farm: 'market' };   // what level 3 needs
export const MAX_LEVEL = 3;

export const KEEP = {
  // a town hall has to be earned: scrap, people, a food income with room to spare (foodNet: food a dawn beyond what
  // everyone eats) and, for level 3, a hive burned or a site held. It costs scrap only: no food is taken.
  need: [null, { foodNet: 2, people: 8 }, { foodNet: 6, people: 18, won: 1 }],
  cost: [0, 20, 50], hp: [RIG2.hp, RIG2.hp + 40, RIG2.hp + 90], dmg: [3, 4, 5], range: [8, 9, 10], rate: 1.0, shots: [1, 1, 2],
  desc: ['Shoots · range 8', '+40 health · harder arrows · range 9', '+50 health · two arrows · range 10'],
};

export const START = { gold: 16, food: 9, baseIncome: 8, foodPerCitizen: 1, survivors: 3, salvage: 0.4 };   // salvage: scrap per dead put down
