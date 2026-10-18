// Hero classes. `attack: null` means the hero never fights. Every hero has one ability button.

export const HEROES = {
  warrior: {
    name: 'Brawler', blurb: 'Fire axe and a work jacket. Holds the line up close. War Cry pulls the dead onto you while you shrug off half their damage.',
    hp: 30, speed: 4.3, attack: { kind: 'melee', dmg: 3, reach: 2.2, rate: 0.55 },
    ability: { id: 'warcry', name: 'War Cry', cooldown: 25, radius: 6, taunt: 4, guard: 0.5 },
  },
  archer: {
    name: 'Ranger', blurb: 'A crossbow and a hood. Fragile, but picks off the dead from far away. Volley rains bolts on the thickest crowd.',
    hp: 18, speed: 4.6, attack: { kind: 'ranged', dmg: 1.5, reach: 6.5, rate: 0.85 },
    ability: { id: 'volley', name: 'Volley', cooldown: 28, radius: 2.2, dmg: 4, reach: 9 },
  },
  merchant: {
    name: 'Scavver', blurb: 'Never fights. Runs the town by hand, picks up purses the dead drop, haggles 10% off every building and meets a trader at dawn. Bounty: for a while, every kill near you pays scrap.',
    hp: 16, speed: 4.6, attack: null, collects: true, discount: 0.1, extraOffer: 1, trader: true,
    ability: { id: 'bounty', name: 'Bounty', cooldown: 45, duration: 20, radius: 9, gold: 1, bigGold: 3 },
  },
};
export const HERO_ORDER = ['warrior', 'archer', 'merchant'];

export const MERC = { hp: 15, dmg: 3, rate: 0.8, speed: 5.5, leash: 6, reach: 1.1 };
export const PURSE = { chance: 0.25, life: 12, value: { default: 1, brute: 3, guardian: 8, gravelord: 8 } };
export const TRADES = [
  { id: 'reroll', name: 'A fortune-teller', desc: 'One free blessing reroll.', gold: 6 },
  { id: 'pick', name: 'A relic', desc: 'An extra blessing pick now.', gold: 15 },
  { id: 'sellfood', name: 'Hungry travellers', desc: 'Sell 5 food for 4 scrap.', food: 5, give: 4 },
  { id: 'halfup', name: 'A master builder', desc: 'Your next upgrade costs half.', gold: 4 },
  { id: 'mend', name: 'Stonemasons', desc: 'Repair the keep by a quarter.', gold: 8 },
];
