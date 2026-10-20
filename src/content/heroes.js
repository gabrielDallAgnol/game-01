// Hero classes. `attack: null` means the hero never fights. Every hero has one ability button.

export const HEROES = {
  survivor: {
    name: 'Survivor', blurb: 'Nobody yet: a length of pipe, a work jacket and a status window. What you become depends on the blessings you take.',
    hp: 24, speed: 3.8, attack: { kind: 'melee', dmg: 2.2, reach: 2.0, rate: 0.6 },
    ability: { id: 'shove', name: 'Shove', cooldown: 14, radius: 2.8, dmg: 2, push: 2.4 },
  },
  warrior: {
    name: 'Brawler', blurb: 'Fire axe and a work jacket. Holds the line up close. War Cry pulls the dead onto you while you shrug off half their damage.',
    hp: 30, speed: 4.0, attack: { kind: 'melee', dmg: 3, reach: 2.2, rate: 0.55 },
    ability: { id: 'warcry', name: 'War Cry', cooldown: 25, radius: 6, taunt: 4, guard: 0.5 },
  },
  archer: {
    name: 'Ranger', blurb: 'A crossbow and a hood. Fragile, but picks off the dead from far away. Volley rains bolts on the thickest crowd.',
    hp: 22, speed: 4.3, attack: { kind: 'ranged', dmg: 2.8, reach: 6.5, rate: 0.7 },
    ability: { id: 'volley', name: 'Volley', cooldown: 28, radius: 2.2, dmg: 4, reach: 9 },
  },
  merchant: {
    name: 'Scavver', blurb: 'Quick with an old revolver, and runs the town by hand: picks up purses the dead drop, haggles 10% off every building and meets a trader at dawn. Bounty: for a while, every kill near you pays scrap.',
    hp: 22, speed: 4.2, attack: { kind: 'ranged', dmg: 2.6, reach: 5.5, rate: 0.65 }, collects: true, discount: 0.1, extraOffer: 1, trader: true,
    ability: { id: 'bounty', name: 'Bounty', cooldown: 45, duration: 20, radius: 9, gold: 1, bigGold: 3 },
  },
};
HEROES.medic = {
  name: 'Medic', blurb: 'A flare pistol and a bag of bandages. Weak in a fight, but Patch Up mends the buildings around you and puts you back on your feet.',
  hp: 28, speed: 4.1, attack: { kind: 'ranged', dmg: 2.6, reach: 5.5, rate: 0.7 },
  ability: { id: 'patch', name: 'Patch Up', cooldown: 22, radius: 6, heal: 0.25 },
};
export const HERO_ORDER = ['warrior', 'archer', 'merchant', 'medic'];
// final classes: a Calling plus a second hero family. Each keeps its Calling's ability and adds one twist.
Object.assign(HEROES, {
  vanguard: { ...HEROES.warrior, name: 'Vanguard', base: 'warrior', blurb: 'Brawler who learned to throw: every swing also strikes a second dead within reach.', hp: 34, attack: { kind: 'melee', dmg: 3.4, reach: 2.5, rate: 0.55 }, twin: true },
  warlord: { ...HEROES.warrior, name: 'Warlord', base: 'warrior', blurb: 'War Cry pays: every dead that falls near you while it lasts pays 1 scrap. Tougher than anyone.', hp: 42, cryPays: 1 },
  warden: { ...HEROES.warrior, name: 'Warden', base: 'warrior', blurb: 'Brawler with a medic\'s heart: buildings within 5 of you take 30% less damage.', hp: 40, ward: 0.7 },
  marshal: { ...HEROES.archer, name: 'Marshal', base: 'archer', blurb: 'Ranger who leads: towers within 6 of you shoot 25% faster.', hp: 26, marshal: 1.25 },
  quartermaster: { ...HEROES.medic, name: 'Quartermaster', base: 'medic', blurb: 'Keeps everyone fed and patched: +4 scrap and +2 food every dawn, and Patch Up mends the whole town.', hp: 26, quarter: true },
  deadeye: { ...HEROES.archer, name: 'Deadeye', base: 'archer', blurb: 'Ranger who sells the shot: reach 8, and every dead your Volley kills pays 2 scrap.', hp: 26, attack: { kind: 'ranged', dmg: 3.6, reach: 8, rate: 0.7 }, volleyPays: 2 },
});
// no Calling deals less than the Survivor (2.2 / 0.6 s ≈ 3.7 a second): a job change is never a downgrade
// which hero family leads to which Calling, and which pair to which final class
export const CALLINGS = { hero: 'warrior', ranger: 'archer', scavver: 'merchant', heart: 'medic' };
export const FINALS = { 'archer+warrior': 'vanguard', 'merchant+warrior': 'warlord', 'archer+merchant': 'deadeye', 'medic+warrior': 'warden', 'archer+medic': 'marshal', 'medic+merchant': 'quartermaster' };
export const EVOLVE_AT = 2;   // blessings of one hero family that unlock its Calling (and the second family the final class)

export const MERC = { hp: 15, dmg: 3, rate: 0.8, speed: 5.5, leash: 6, reach: 1.1 };
export const PURSE = { chance: 0.25, life: 12, value: { default: 1, brute: 3, guardian: 8, gravelord: 8 } };
export const TRADES = [
  { id: 'reroll', name: 'A fortune-teller', desc: 'One free blessing reroll.', gold: 6 },
  { id: 'pick', name: 'A relic', desc: 'An extra blessing pick now.', gold: 15 },
  { id: 'sellfood', name: 'Hungry travellers', desc: 'Sell 5 food for 4 scrap.', food: 5, give: 4 },
  { id: 'halfup', name: 'A master builder', desc: 'Your next upgrade costs half.', gold: 4 },
  { id: 'mend', name: 'Stonemasons', desc: 'Repair the keep by a quarter.', gold: 8 },
];
