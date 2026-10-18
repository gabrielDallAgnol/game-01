// Building definitions. Arrays are indexed by level - 1. Pure data: tune here.

export const BUILDINGS = {
  house: {
    name: 'House', cost: [4, 6, 12], hp: [24, 36, 48], gold: [2, 4, 6], pop: [2, 4, 6],
    desc: ['+2 gold · 2 people', '+4 gold · 4 people', '+6 gold · 6 people'],
  },
  farm: {
    name: 'Farm', cost: [3, 5, 10], hp: [14, 22, 30], food: [3, 6, 9],
    desc: ['+3 food', '+6 food', '+9 food'],
  },
  tower: {
    name: 'Watchtower', cost: [6, 8, 14], upkeep: [0, 1, 2], hp: [24, 36, 50], range: [7, 8.5, 10], dmg: [1, 2, 3], rate: [0.9, 0.75, 0.6],
    desc: ['Shoots · range 7', 'Faster · range 8.5 · upkeep 1', 'Heavy bolts · range 10 · upkeep 2'],
  },
  wall: {
    name: 'Palisade', cost: [1, 2, 3], hp: [30, 60, 100], blocks: true,
    desc: ['One post of a wall · 30 hp · you walk through, the dead do not', 'Stone · 60 hp', 'Bastion · 100 hp'],
  },
};
export const BUILD_ORDER = ['house', 'farm', 'tower', 'wall'];
export const MAX_LEVEL = 3;

export const KEEP = {
  cost: [0, 12, 24], hp: [80, 120, 170], dmg: [3, 4, 5], range: [8, 9, 10], rate: 1.0, shots: [1, 1, 2],
  desc: ['Shoots · range 8', '+40 health · harder arrows · range 9', '+50 health · two arrows · range 10'],
};

export const START = { gold: 12, food: 6, baseIncome: 3, foodPerCitizen: 1 };
