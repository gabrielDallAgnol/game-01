// Building definitions. Arrays are indexed by level - 1. Pure data: tune here.

export const BUILDINGS = {
  house: {
    name: 'Home', cost: [4, 6, 12], hp: [24, 36, 48], gold: [4, 7, 10], pop: [2, 4, 6],
    desc: ['+4 scrap a day · 2 people', '+7 scrap a day · 4 people', '+10 scrap a day · 6 people'],
  },
  farm: {
    name: 'Farm', cost: [3, 5, 10], hp: [14, 22, 30], food: [3, 6, 9],
    desc: ['+3 food a day', '+6 food a day', '+9 food a day'],
  },
  tower: {
    name: 'Tower', cost: [6, 8, 14], upkeep: [0, 1, 2], hp: [24, 36, 50], range: [7, 8.5, 10], dmg: [1, 1.8, 2.6], rate: [0.9, 0.75, 0.6],
    desc: ['Shoots · range 7', 'Faster · range 8.5 · upkeep 1', 'Heavy bolts · range 10 · upkeep 2'],
  },
  // barricades are real walls: the dead chew through them post by post. No salvage; a fallen post is a ruin you rebuild.
  wall: {
    name: 'Barricade', cost: [2, 3, 4], hp: [40, 90, 160], blocks: true,
    desc: ['One barricade post · 40 hp · you walk through, the Ash-Born must chew through', 'Wrecks and sandbags · 90 hp', 'Concrete and razor wire · 160 hp'],
  },
  // power: loud, but it keeps the lights (and the best guns) on
  generator: {
    name: 'Generator', cost: [8, 14], hp: [30, 45], power: [6, 10], maxLevel: 2, noise: [4, 6],
    desc: ['+6 power · loud (+heat)', '+10 power · louder'],
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
// (the generator is out of the build list while power is cut: CUT.power in sim/game.js; a Lights Out rule brings it back)
// (barricades are out too: CUT.walls; BUILD_ORDER_WALLS is the list with them)
export const BUILD_ORDER = ['house', 'farm', 'tower'];
export const BUILD_ORDER_WALLS = ['house', 'farm', 'tower', 'wall'];
export const BUILD_ORDER_POWER = ['house', 'farm', 'tower', 'wall', 'generator'];
// power: what the keep makes on its own, and what each building draws (by level). Short on power = blackout:
// every powered building switches off until supply is back (Red Alert style).
export const POWER = { keep: [3, 4, 5], draw: { tower: [0, 1, 2], workshop: [2], market: [1] } };
// each extra copy of a building costs more: the town has to choose, not spam. Towers climb in a straight line
// (+25% of the base per tower you have); homes and farms climb and flatten; barricades +1 scrap per dozen posts.
export const RISE = { house: 0.2, farm: 0.15, tower: 0.25, wall: 0, wallEvery: 12, generator: 0.5, workshop: 0, market: 0 };
// hands: every build or upgrade needs a free pair of hands for the day: 2 + √people
export const HANDS = { base: 2 };   // + the square root of your people (diminishing: a big town is not a fast town)
export const TECH_ORDER = ['workshop', 'market'];
export const UNLOCKS = { tower: 'workshop', wall: 'workshop', house: 'market', farm: 'market' };   // what level 3 needs
export const MAX_LEVEL = 3;

export const KEEP = {
  // a town hall has to be earned: scrap, people, a food income with room to spare (foodNet: food a dawn beyond what
  // everyone eats) and, for level 3, a hive burned or a site held. It costs scrap only: no food is taken.
  need: [null, { foodNet: 2, people: 8 }, { foodNet: 6, people: 18, won: 1 }],
  cost: [0, 20, 50], hp: [80, 120, 170], dmg: [3, 4, 5], range: [8, 9, 10], rate: 1.0, shots: [1, 1, 2],
  desc: ['Shoots · range 8', '+40 health · harder arrows · range 9', '+50 health · two arrows · range 10'],
};

export const START = { gold: 16, food: 9, baseIncome: 8, foodPerCitizen: 1, survivors: 3, salvage: 0.4 };   // salvage: scrap per dead put down
