// Hero classes. `attack: null` means the hero never fights. Every hero has one ability button.
import { CALLING_LVL, FINAL_LVL, LEGEND_LVL } from './season.js';

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

// ---------- class tiers: the Calling (Lv 15), the advanced class (Lv 30), the legendary form (Lv 45) ----------
// Each class says who it is in one line and what it gives in 2–3 plain perks (the job-change window shows these).
// `look`: outfit accents the hero rig wears (render/kit.js heroes take an outfit override); `glow`: an aura colour.
// `boss`: the named warden of its trial.
export const CLASS_TIERS = [
  { tier: 1, lvl: CALLING_LVL, key: 'calling', eyebrow: '[Job change available]', title: 'Your Calling', boss: 'The Warden of the Old Road' },
  { tier: 2, lvl: FINAL_LVL, key: 'advanced', eyebrow: '[Advanced class unlocked]', title: 'The window cracks', boss: 'The Hollow Knight' },
  { tier: 3, lvl: LEGEND_LVL, key: 'legend', eyebrow: '[LEGENDARY CLASS]', title: 'A name the city will fear', boss: 'The Last Gravekeeper' },
];
export const CLASS_INFO = {
  warrior: { tier: 1, icon: 'sword', who: 'Holds the line up close.', perks: ['Hits hardest up close (axe)', 'War Cry: the dead come at you; you take half damage', '+6 health'], look: { cape: '#8e1f1f', mantle: '#6d6f73', scarf: '#d8b04e' } },
  archer: { tier: 1, icon: 'eye', who: 'Kills from far away.', perks: ['Crossbow: hits from 6 cells away', 'Volley: bolts rain on the biggest crowd', 'Faster on foot'], look: { hood: '#2f5d3a', coat: '#2f5d3a' } },
  merchant: { tier: 1, icon: 'scrap', who: 'Runs the Camp, and the money.', perks: ['Picks up scrap the dead drop', 'Buildings cost 10% less', 'Bounty: every kill near you pays scrap'], look: { cap: '#c98b2e', pack: '#6b4a2a' } },
  medic: { tier: 1, icon: 'heart', who: 'Keeps everyone standing.', perks: ['Patch Up: mends buildings around you', 'Puts you back on your feet', '+4 health'], look: { top: '#e8e4dc', scarf: '#c23b2e', cap: '#e8e4dc' } },
  vanguard: { tier: 2, icon: 'sword', who: 'A Brawler who throws.', perks: ['Every swing hits a second dead', 'Longer reach', '+4 health'], look: { cape: '#8e1f1f', mantle: '#9aa0a6', helmet: '#7d838a', scarf: '#d8b04e' } },
  warlord: { tier: 2, icon: 'fist', who: 'A Brawler who gets paid.', perks: ['War Cry kills pay 1 scrap each', 'Toughest of all: 42 health'], look: { cape: '#5a1414', mantle: '#c99a3a', helmet: '#3a3a3e' } },
  warden: { tier: 2, icon: 'shield', who: 'A Brawler who shields the Camp.', perks: ['Buildings near you take 30% less damage', '40 health'], look: { cape: '#2e4f7a', mantle: '#d8d4cc', helmet: '#9aa0a6' } },
  marshal: { tier: 2, icon: 'tower', who: 'A Ranger who leads the towers.', perks: ['Towers near you shoot 25% faster', 'Crossbow and Volley stay'], look: { hood: '#2e4f7a', coat: '#2e4f7a', mantle: '#c99a3a' } },
  deadeye: { tier: 2, icon: 'eye', who: 'A Ranger who sells the shot.', perks: ['Reach 8: hits from further', 'Volley kills pay 2 scrap each'], look: { hood: '#1f2a24', coat: '#1f2a24', scarf: '#c23b2e' } },
  quartermaster: { tier: 2, icon: 'food', who: 'Keeps everyone fed and patched.', perks: ['+4 scrap and +2 food every dawn', 'Patch Up mends the whole Camp'], look: { top: '#e8e4dc', scarf: '#c99a3a', pack: '#3a5a7a', cap: '#3a5a7a' } },
};
// the legendary form of each Calling: its ability becomes a signature, its look transforms (stats on top of the
// advanced class you have); data only — the engine reads ability ids, so a signature is the same move, much bigger
export const LEGENDS = {
  warrior: { name: 'Juggernaut', who: 'The wall the dead break on.', hpAdd: 14, dmgMult: 1.35, ability: { name: 'Titan\'s Roar', radius: 9, taunt: 6, guard: 0.3, cooldown: 20 }, perks: ['Titan\'s Roar: pulls the dead from 9 cells; you take 70% less damage', '+35% damage, +14 health'], look: { cape: '#2a1240', mantle: '#e6b84a', helmet: '#e6b84a', scarf: '#e6b84a' }, glow: '#ffb02e' },
  archer: { name: 'Stormeye', who: 'Nothing walks out of range.', hpAdd: 10, dmgMult: 1.4, ability: { name: 'Bolt Storm', radius: 3.6, dmg: 9, reach: 12, cooldown: 20 }, perks: ['Bolt Storm: a huge rain of bolts, 12 cells away', '+40% damage, +10 health'], look: { hood: '#1c2f4a', coat: '#1c2f4a', mantle: '#e6b84a' }, glow: '#7fd4ff' },
  merchant: { name: 'Kingpin', who: 'The city pays you to live.', hpAdd: 10, dmgMult: 1.3, ability: { name: 'Gold Rush', duration: 30, radius: 12, gold: 2, bigGold: 6, cooldown: 40 }, perks: ['Gold Rush: every kill near you pays double, for 30 s', '+30% damage, +10 health'], look: { cap: '#e6b84a', pack: '#2a1240', scarf: '#e6b84a' }, glow: '#ffd77a' },
  medic: { name: 'Saint of Hollowmere', who: 'Where you stand, nothing falls.', hpAdd: 14, dmgMult: 1.3, ability: { name: 'Sanctuary', radius: 12, heal: 0.5, cooldown: 18 }, perks: ['Sanctuary: mends every building in 12 cells by half', '+30% damage, +14 health'], look: { top: '#f4f0e6', scarf: '#e6b84a', cap: '#e6b84a' }, glow: '#fff2cc' },
};
// one legendary class per advanced class and the Calling you took to get there (it keeps the advanced twist and
// takes the Calling's signature): id `<advanced>_<legend>`, e.g. warlord_kingpin. LEGEND_OF[adv][calling] → id
export const LEGEND_OF = {};
for (const [pair, adv] of Object.entries(FINALS)) {
  const A = HEROES[adv];
  for (const calling of pair.split('+')) {
    const L = LEGENDS[calling]; if (!A || !L) continue;
    const id = `${adv}_${L.name.toLowerCase().split(' ')[0]}`;
    // the signature is the Calling's own move, made legendary
    HEROES[id] = { ...A, name: L.name, blurb: L.who, legend: true, legendOf: adv, calling, hp: A.hp + L.hpAdd,
      attack: A.attack ? { ...A.attack, dmg: +(A.attack.dmg * L.dmgMult).toFixed(2) } : A.attack, ability: { ...HEROES[calling].ability, ...L.ability },
      collects: A.collects || HEROES[calling].collects };
    CLASS_INFO[id] = { tier: 3, icon: 'star', who: L.who, perks: [...L.perks, `Keeps the ${A.name}'s twist`], look: L.look, glow: L.glow };
    (LEGEND_OF[adv] = LEGEND_OF[adv] || {})[calling] = id;
  }
}
