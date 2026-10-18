// Hero classes. `attack: null` means the hero never fights. Every hero has one ability button.

export const HEROES = {
  warrior: {
    name: 'Brawler', blurb: 'Fire axe and a work jacket. Holds the line up close. War Cry pulls the dead onto you while you shrug off half their damage.',
    hp: 30, speed: 6, attack: { kind: 'melee', dmg: 3, reach: 2.2, rate: 0.55 },
    ability: { id: 'warcry', name: 'War Cry', cooldown: 25, nightOnly: true, radius: 6, taunt: 4, guard: 0.5 },
  },
  archer: {
    name: 'Ranger', blurb: 'A crossbow and a hood. Fragile, but picks off the dead from far away. Volley rains bolts on the thickest crowd.',
    hp: 18, speed: 6.5, attack: { kind: 'ranged', dmg: 2, reach: 7.5, rate: 0.7 },
    ability: { id: 'volley', name: 'Volley', cooldown: 20, nightOnly: true, radius: 2.5, dmg: 6, reach: 10 },
  },
  merchant: {
    name: 'Scavver', blurb: 'Never fights. Hires sellswords with gold, picks up purses the dead drop, haggles 10% off every building and meets a trader at dawn.',
    hp: 16, speed: 6.6, attack: null, collects: true, discount: 0.1, extraOffer: 1, trader: true,
    ability: { id: 'hire', name: 'Hire sellswords', cooldown: 6, nightOnly: true, cost: 10, costStep: 5, count: 3, max: 9 },
  },
};
export const HERO_ORDER = ['warrior', 'archer', 'merchant'];

export const MERC = { hp: 15, dmg: 3, rate: 0.8, speed: 5.5, leash: 6, reach: 1.1 };
export const PURSE = { chance: 0.25, life: 12, value: { default: 1, brute: 3, guardian: 8, gravelord: 8 } };
export const TRADES = [
  { id: 'reroll', name: 'A fortune-teller', desc: 'One free blessing reroll.', gold: 6 },
  { id: 'pick', name: 'A relic', desc: 'An extra blessing pick now.', gold: 15 },
  { id: 'sellfood', name: 'Hungry travellers', desc: 'Sell 5 food for 4 gold.', food: 5, give: 4 },
  { id: 'halfup', name: 'A master builder', desc: 'Your next upgrade costs half.', gold: 4 },
  { id: 'mend', name: 'Stonemasons', desc: 'Repair the keep by a quarter.', gold: 8 },
];
