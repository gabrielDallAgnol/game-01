// Hero classes. `attack: null` means the hero never fights.

export const HEROES = {
  warrior: {
    name: 'Warrior', blurb: 'Sword and shield. Holds the line up close.',
    hp: 30, speed: 6, attack: { kind: 'melee', dmg: 3, reach: 2.2, rate: 0.55 },
  },
  archer: {
    name: 'Archer', blurb: 'Fragile, but picks off the dead from far away.',
    hp: 18, speed: 6.5, attack: { kind: 'ranged', dmg: 2, reach: 7.5, rate: 0.7 },
  },
  steward: {
    name: 'Steward', blurb: 'Never fights. Runs the town: +30% gold at dawn and richer blessings.',
    hp: 15, speed: 6.5, attack: null,
    goldMult: 1.3, extraOffer: 1, bonusPickEvery: 3,
  },
};
export const HERO_ORDER = ['warrior', 'archer', 'steward'];
