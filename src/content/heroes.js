// Hero classes: health, speed and the attack (`attack: null`: the hero never fights). The class ability, class
// evolution and its tiers were cut on Oct 25 (V2: the dash is the hero's move).

export const HEROES = {
  survivor: {
    name: 'Survivor', blurb: 'Nobody yet: a length of pipe, a work jacket and a status window. What you become depends on the blessings you take.',
    hp: 24, speed: 3.8, attack: { kind: 'melee', dmg: 2.2, reach: 2.0, rate: 0.6 },
  },
  warrior: {
    name: 'Brawler', blurb: 'Fire axe and a work jacket. Holds the line up close. War Cry pulls the Ash-Born onto you while you shrug off half their damage.',
    hp: 30, speed: 4.0, attack: { kind: 'melee', dmg: 3, reach: 2.2, rate: 0.55 },
  },
  archer: {
    name: 'Ranger', blurb: 'A crossbow and a hood. Fragile, but picks off the Ash-Born from far away. Volley rains bolts on the thickest crowd.',
    hp: 22, speed: 4.3, attack: { kind: 'ranged', dmg: 2.8, reach: 6.5, rate: 0.7 },
  },
  merchant: {
    name: 'Scavver', blurb: 'Quick with an old revolver, and runs the town by hand: picks up purses the Ash-Born drop, haggles 10% off every building and meets a trader at dawn. Bounty: for a while, every kill near you pays scrap.',
    hp: 22, speed: 4.2, attack: { kind: 'ranged', dmg: 2.6, reach: 5.5, rate: 0.65 }, collects: true, discount: 0.1, extraOffer: 1, trader: true,
  },
};
HEROES.medic = {
  name: 'Medic', blurb: 'A bag of bandages and a steady hand. Weak in a fight, but Patch Up mends the buildings around you and puts you back on your feet.',
  hp: 28, speed: 4.1, attack: { kind: 'ranged', dmg: 2.6, reach: 5.5, rate: 0.7 },
};
export const HERO_ORDER = ['warrior', 'archer', 'merchant', 'medic'];

export const MERC = { hp: 15, dmg: 3, rate: 0.8, speed: 5.5, leash: 6, reach: 1.1 };
export const PURSE = { chance: 0.25, life: 12, value: { default: 1, brute: 3, guardian: 8, gravelord: 8 } };
export const TRADES = [
  { id: 'reroll', name: 'A fortune-teller', desc: 'One free blessing reroll.', gold: 6 },
  { id: 'pick', name: 'A relic', desc: 'An extra blessing pick now.', gold: 15 },
  { id: 'sellfood', name: 'Hungry travellers', desc: 'Sell 5 food for 4 scrap.', food: 5, give: 4 },
  { id: 'halfup', name: 'A master builder', desc: 'Your next upgrade costs half.', gold: 4 },
  { id: 'mend', name: 'Stonemasons', desc: 'Repair the Haven Rig by a quarter.', gold: 8 },
];

// `look`: outfit accents the hero rig wears (render/kit.js heroes take an outfit override)
export const CLASS_INFO = {
  warrior: { tier: 1, icon: 'sword', who: 'Holds the line up close.', perks: ['Hits hardest up close (axe)', 'War Cry: the Ash-Born come at you; you take half damage', '+6 health'], look: { cape: '#8e1f1f', mantle: '#6d6f73', scarf: '#d8b04e' } },
  archer: { tier: 1, icon: 'eye', who: 'Kills from far away.', perks: ['Crossbow: hits from 6 cells away', 'Volley: bolts rain on the biggest crowd', 'Faster on foot'], look: { hood: '#2f5d3a', coat: '#2f5d3a' } },
  merchant: { tier: 1, icon: 'scrap', who: 'Runs the Haven, and the money.', perks: ['Picks up scrap the Ash-Born drop', 'Buildings cost 10% less', 'Bounty: every kill near you pays scrap'], look: { cap: '#c98b2e', pack: '#6b4a2a' } },
  medic: { tier: 1, icon: 'heart', who: 'Keeps everyone standing.', perks: ['Patch Up: mends buildings around you', 'Puts you back on your feet', '+4 health'], look: { top: '#e8e4dc', scarf: '#c23b2e', cap: '#e8e4dc' } },
};
/** the hero the sim plays: the class itself (the advanced and legendary tiers were cut with class evolution, Oct 25) */
export const heroKit = cls => HEROES[cls];
