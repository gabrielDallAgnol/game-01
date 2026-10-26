// The hero's class: health, speed and the attack. One class now, the Mechanic (Oct 26); the old classes, their
// abilities and evolution are gone (git history keeps them). The dash (content/combat2.js) is the hero's move.
import { WRENCH } from './mechanic.js';

export const HEROES = {
  // [mech] the only class: Kai Brenner, a mechanic with a wrench in her hand (content/mechanic.js has the numbers)
  mechanic: {
    name: 'Mechanic', blurb: 'A wrench, a tow truck and a status window. The wrench is weak on purpose: Salvage the town for scrap and parts, and let the scrap turrets do the killing.',
    hp: 24, speed: 3.8, attack: { kind: 'melee', dmg: WRENCH.dmg, reach: WRENCH.reach, rate: WRENCH.rate, perLevel: WRENCH.perLevel },
  },
};
export const HERO_ORDER = ['mechanic'];

export const MERC = { hp: 15, dmg: 3, rate: 0.8, speed: 5.5, leash: 6, reach: 1.1 };
export const PURSE = { chance: 0.25, life: 12, value: { default: 1, brute: 3, guardian: 8, gravelord: 8 } };
export const TRADES = [
  { id: 'sellfood', name: 'Hungry travellers', desc: 'Sell 5 food for 4 scrap.', food: 5, give: 4 },
  { id: 'halfup', name: 'A master builder', desc: 'Your next upgrade costs half.', gold: 4 },
  { id: 'mend', name: 'Stonemasons', desc: 'Repair the Haven Rig by a quarter.', gold: 8 },
];

// `look`: outfit accents the hero rig wears (render/kit.js heroes take an outfit override)
export const CLASS_INFO = {
  mechanic: { tier: 1, icon: 'build', who: 'Fixes things. Turrets do the killing.', perks: ['Wrench: a weak auto-hit', 'Salvage: scrap and parts from cars and machines', 'Scrap turrets'], look: { top: '#2f4f6f', legs: '#2f4f6f', cap: '#e8b021', hair: '#6b3a22', hairStyle: 'pony', pack: null, roll: null } },
};
/** the hero the sim plays: the Mechanic, whatever an old save says */
export const heroKit = () => HEROES.mechanic;   // every run is the Mechanic (old saves' classes too)
