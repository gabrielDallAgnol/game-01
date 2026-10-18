// Blessings v2 (design: docs/blessings-v2.md).
// common = stat bumps · rare = build-around · legendary = changes how you play (chests and nests).
// Pacts are rares with a real downside. Taking 3 of a family offers a choice of 2 masteries.

// Each hero has a family of their own; the town families (bow, stone, harvest) are shared.
export const FAMILIES = {
  hero:    { name: 'Brawler', color: '#e58a6a', hero: 'warrior' },
  ranger:  { name: 'Ranger',  color: '#7fc4d8', hero: 'archer' },
  scavver: { name: 'Scavver', color: '#d9b45a', hero: 'merchant' },
  bow:     { name: 'Bow',     color: '#eaa441' },
  stone:   { name: 'Stone',   color: '#a9bccd' },
  harvest: { name: 'Harvest', color: '#a3c65c' },
};

const C = 'common', R = 'rare', L = 'legendary';
export const PERKS = [
  // Hero
  { id: 'steel',   fam: 'hero', rarity: C, name: 'Sharpened Steel', desc: 'Hero attacks deal +1 damage.', max: 3, fx: P => { P.heroDmg += 1; } },
  { id: 'hymn',    fam: 'hero', rarity: C, name: 'Battle Hymn', desc: 'Hero attacks 20% faster.', max: 3, fx: P => { P.heroRate *= 1.2; } },
  { id: 'skin',    fam: 'hero', rarity: C, name: 'Iron Skin', desc: '+12 max health. Heal 1 per second at night.', max: 2, fx: P => { P.heroHp += 12; P.heroRegen += 1; } },
  { id: 'blood',   fam: 'hero', rarity: R, name: 'Bloodthirst', desc: 'Heal 2 for each zombie that dies within 6 of you.', max: 1, fx: P => { P.lifesteal = 2; } },
  { id: 'rally',   fam: 'hero', rarity: R, name: 'Rallying Cry', desc: 'Towers within 5 of you shoot 30% faster.', max: 1, fx: P => { P.rally = true; } },
  { id: 'execute', fam: 'hero', rarity: R, name: 'Executioner', desc: 'Your hits kill zombies left below 25% health.', max: 1, fx: P => { P.execute = true; } },
  { id: 'wardance',fam: 'hero', rarity: R, name: 'War Dance', desc: 'Every 3rd attack hits every zombie in reach.', max: 1, fx: P => { P.wardance = true; } },
  { id: 'shout',   fam: 'hero', rarity: C, name: 'Big Voice', desc: 'War Cry recharges 40% faster and reaches 2 further.', max: 1, fx: P => { P.abilityCd *= 0.6; P.abilityRadius += 2; } },
  { id: 'last',    fam: 'hero', rarity: L, name: 'Last Stand', desc: 'Once a night, below 30% health: double damage and you cannot fall for 4 seconds.', max: 1, fx: P => { P.lastStand = true; } },
  // Bow
  { id: 'fletch',  fam: 'bow', rarity: C, name: 'Fletchers', desc: 'Towers deal 20% more damage.', max: 2, fx: P => { P.towerDmg += 0.2; } },
  { id: 'draw',    fam: 'bow', rarity: C, name: 'Quick Draw', desc: 'Towers shoot 15% faster.', max: 2, fx: P => { P.towerRate *= 1.15; } },
  { id: 'eyes',    fam: 'bow', rarity: C, name: 'Keen Eyes', desc: 'Towers and the keep reach 1.5 further.', max: 2, fx: P => { P.towerRange += 1.5; } },
  { id: 'volley',  fam: 'bow', rarity: R, name: 'Volley Towers', desc: 'Level 3 towers fire a second arrow.', max: 1, fx: P => { P.volley = true; } },
  { id: 'watch',   fam: 'bow', rarity: R, name: 'Watch Fires', desc: 'Towers within 4 of another tower reach 2 further.', max: 1, fx: P => { P.watch = true; } },
  { id: 'fire',    fam: 'bow', rarity: R, name: 'Fire Arrows', desc: 'Every 5th tower arrow sets its target burning: 1 damage a second for 4 seconds.', max: 1, fx: P => { P.fire = true; } },
  { id: 'hunter',  fam: 'bow', rarity: R, name: 'Big Game', desc: 'Towers deal 60% more damage to brutes, guardians and Gravelords.', max: 1, fx: P => { P.hunter = true; } },
  { id: 'ballista',fam: 'bow', rarity: L, name: 'Ballista Keep', desc: 'Every 3 seconds the keep fires a bolt that pierces a whole line: 8 damage, range 12.', max: 1, fx: P => { P.ballista = true; } },
  // Stone
  { id: 'timber',  fam: 'stone', rarity: C, name: 'Thick Timber', desc: 'Barricades +60% health.', max: 2, fx: P => { P.wallHp += 0.6; } },
  { id: 'mortar',  fam: 'stone', rarity: C, name: 'Lime Mortar', desc: 'All buildings +20% health. Keep +20.', max: 2, fx: P => { P.allHp += 0.2; P.keepHp += 20; } },
  { id: 'masons',  fam: 'stone', rarity: C, name: 'Guild of Masons', desc: 'Towers and barricades cost 1 less.', max: 2, fx: P => { P.defDiscount += 1; } },
  { id: 'thorns',  fam: 'stone', rarity: R, name: 'Thorned Stakes', desc: 'Zombies that hit a barricade take 3 damage.', max: 1, fx: P => { P.thorns += 3; } },
  { id: 'tar',     fam: 'stone', rarity: R, name: 'Tar Pits', desc: 'Zombies within 2 of a barricade move 40% slower.', max: 1, fx: P => { P.tar = true; } },
  { id: 'bastion', fam: 'stone', rarity: R, name: 'Bastions', desc: 'Towers within 3 of a barricade deal 40% more damage.', max: 1, fx: P => { P.bastion = true; } },
  { id: 'salvage', fam: 'stone', rarity: R, name: 'Salvage', desc: 'Whenever a building falls, gain 2 gold.', max: 1, fx: P => { P.salvage = true; } },
  { id: 'bell',    fam: 'stone', rarity: L, name: 'Bell of Last Light', desc: 'Once a run, when the keep would fall it holds at 30% and every zombie within 8 takes 20 damage.', max: 1, fx: P => { P.bell = true; } },
  // Harvest
  { id: 'market',  fam: 'harvest', rarity: C, name: 'Market Day', desc: 'Each house pays 1 more gold at dawn.', max: 3, fx: P => { P.houseGold += 1; } },
  { id: 'soil',    fam: 'harvest', rarity: C, name: 'Fertile Soil', desc: 'Each farm grows 2 more food.', max: 3, fx: P => { P.farmFood += 2; } },
  { id: 'tax',     fam: 'harvest', rarity: C, name: 'Tax Collector', desc: '+5 gold every dawn.', max: 2, fx: P => { P.tax += 5; } },
  { id: 'guarded', fam: 'harvest', rarity: R, name: 'Guarded Streets', desc: 'Houses within 6 of a tower pay 2 more gold.', max: 1, fx: P => { P.guarded = true; } },
  { id: 'granary', fam: 'harvest', rarity: R, name: 'Granary', desc: 'Every 5 spare food at dawn turns into 1 gold.', max: 1, fx: P => { P.granary = true; } },
  { id: 'bounty',  fam: 'harvest', rarity: R, name: 'Bounty', desc: '+1 gold for every 3 zombies killed.', max: 1, fx: P => { P.bounty = true; } },
  { id: 'labour',  fam: 'harvest', rarity: R, name: 'Cheap Labour', desc: 'Houses and farms cost 1 less; tower upkeep 2 lower.', max: 1, fx: P => { P.ecoDiscount += 1; P.upkeepCut += 1; } },
  { id: 'guild',   fam: 'harvest', rarity: L, name: 'Merchant Guild', desc: 'Every dawn, one tower is upgraded free for each 4 houses you have.', max: 1, fx: P => { P.guild = true; } },
  // Ranger
  { id: 'tips',    fam: 'ranger', rarity: C, name: 'Hollow Points', desc: 'Your bolts deal +1 damage.', max: 3, fx: P => { P.heroDmg += 1; } },
  { id: 'quiver',  fam: 'ranger', rarity: C, name: 'Quick Hands', desc: 'You shoot 20% faster.', max: 2, fx: P => { P.heroRate *= 1.2; } },
  { id: 'longshot',fam: 'ranger', rarity: C, name: 'Long Shot', desc: 'You reach 1.5 further.', max: 2, fx: P => { P.heroRange += 1.5; } },
  { id: 'pierce',  fam: 'ranger', rarity: R, name: 'Pierce', desc: 'Each bolt also hits one zombie just behind its target.', max: 1, fx: P => { P.pierce = true; } },
  { id: 'mark',    fam: 'ranger', rarity: R, name: 'Marked', desc: 'Zombies you hit take 30% more damage from towers for 4 seconds.', max: 1, fx: P => { P.mark = true; } },
  { id: 'storm',   fam: 'ranger', rarity: R, name: 'Bolt Storm', desc: 'Volley covers a wider area and hits 50% harder.', max: 1, fx: P => { P.abilityRadius += 1; P.abilityDmg *= 1.5; } },
  { id: 'nimble',  fam: 'ranger', rarity: R, name: 'Light Feet', desc: 'You run 20% faster and heal 1 per second while running.', max: 1, fx: P => { P.heroSpeed *= 1.2; P.runHeal = 1; } },
  { id: 'sentinel',fam: 'ranger', rarity: L, name: 'Sentinel', desc: 'Standing still, every 3rd bolt also hits two more zombies.', max: 1, fx: P => { P.sentinel = true; } },
  // Scavver
  { id: 'haggle',  fam: 'scavver', rarity: C, name: 'Open Contract', desc: 'Bounty lasts 8 seconds longer.', max: 2, fx: P => { P.bountyTime += 8; } },
  { id: 'captains',fam: 'scavver', rarity: C, name: 'Blood Money', desc: 'Bounty kills pay 1 more gold.', max: 2, fx: P => { P.bountyGold += 1; } },
  { id: 'pockets', fam: 'scavver', rarity: C, name: 'Deep Pockets', desc: 'Purses hold 1 more gold.', max: 2, fx: P => { P.purseBonus += 1; } },
  { id: 'nose',    fam: 'scavver', rarity: R, name: 'Nose for Coin', desc: 'The dead drop purses twice as often.', max: 1, fx: P => { P.purseChance *= 2; } },
  { id: 'band',    fam: 'scavver', rarity: R, name: 'Wide Net', desc: 'Bounty reaches 5 further.', max: 1, fx: P => { P.bountyRadius += 5; } },
  { id: 'deals',   fam: 'scavver', rarity: R, name: 'Wholesale', desc: 'Towers and homes cost 1 less for you.', max: 1, fx: P => { P.defDiscount += 1; P.ecoDiscount += 1; } },
  { id: 'loyal',   fam: 'scavver', rarity: R, name: 'Quick Contracts', desc: 'Bounty recharges 35% faster.', max: 1, fx: P => { P.abilityCd *= 0.65; } },
  { id: 'kingpin', fam: 'scavver', rarity: L, name: 'Kingpin', desc: 'While Bounty runs, towers near you shoot 40% faster.', max: 1, fx: P => { P.kingpin = true; } },
  // Pacts: rare, with a real downside
  { id: 'pactBlood', fam: 'bow', rarity: R, pact: true, name: 'Blood Arrows', desc: 'Towers deal 50% more damage.', cost: 'The keep has 30% less health.', max: 1, fx: P => { P.towerDmg += 0.5; P.keepHpMult *= 0.7; } },
  { id: 'pactGreed', fam: 'harvest', rarity: R, pact: true, name: 'Usury', desc: '+12 gold every dawn.', cost: 'Each claimed region adds 25% threat instead of 12%.', max: 1, fx: P => { P.tax += 12; P.greed = true; } },
  { id: 'pactRage',  fam: 'hero', rarity: R, pact: true, name: 'Berserker', desc: 'Your attacks deal double damage.', cost: 'You no longer heal by day and lose 40% max health.', max: 1, fx: P => { P.heroDmgMult *= 2; P.noDayHeal = true; P.heroHpMult *= 0.6; } },
  { id: 'pactStone', fam: 'stone', rarity: R, pact: true, name: 'Walls of Bone', desc: 'Barricades +150% health.', cost: 'Every house pays 1 less gold.', max: 1, fx: P => { P.wallHp += 1.5; P.houseGold -= 1; } },
];

// two partners held together give a bonus; the card shows "Combo!" when you hold the partner
export const SYNERGIES = [
  { a: 'tar', b: 'fire', text: 'Burning zombies in tar take double burn damage.' },
  { a: 'rally', b: 'watch', text: 'Rallying Cry reaches 8, and paired towers get it anywhere.' },
  { a: 'guarded', b: 'bastion', text: 'Houses within 3 of a barricade pay 1 more gold.' },
  { a: 'blood', b: 'bounty', text: 'Every kill by your hero pays 1 gold.' },
  { a: 'salvage', b: 'mortar', text: 'Fallen buildings give 4 gold instead of 2.' },
];

export const MASTERIES = {
  hero: [
    { id: 'whirlwind', name: 'Whirlwind', desc: 'Your attacks hit everything in reach and deal +1 damage.' },
    { id: 'champion', name: 'Champion', desc: '+25 max health and you attack 30% faster.' },
  ],
  ranger: [
    { id: 'sniper', name: 'Sniper', desc: 'Bolts deal double damage to zombies at full health.' },
    { id: 'hail', name: 'Hail', desc: 'Volley recharges twice as fast.' },
  ],
  scavver: [
    { id: 'warband', name: 'Headhunter', desc: 'Bounty pays triple for brutes, guardians and Gravelords, and it lasts 10 seconds longer.' },
    { id: 'tycoon', name: 'Tycoon', desc: 'Purses are worth double, and homes pay 1 more gold.' },
  ],
  bow: [
    { id: 'deadeye', name: 'Deadeye', desc: 'Towers and the keep deal 40% more damage.' },
    { id: 'rain', name: 'Rain of Arrows', desc: 'Every 6 seconds each tower fires at 3 targets at once.' },
  ],
  stone: [
    { id: 'mending', name: 'Mending', desc: 'Buildings repair themselves at night.' },
    { id: 'fortress', name: 'Fortress', desc: 'Crawlers cannot climb barricades, and barricades hit back for half the damage they take.' },
  ],
  harvest: [
    { id: 'prosperity', name: 'Prosperity', desc: '+30% gold and food at dawn.' },
    { id: 'patronage', name: 'Patronage', desc: 'Every blessing offer includes at least one rare.' },
  ],
};

export const ODDS = {                 // common / rare / legendary
  dawn:  [0.70, 0.27, 0.03],
  chest: [0.30, 0.55, 0.15],
  nest:  [0, 0.60, 0.40],
};
export const REROLL = { free: 1, base: 5, step: 5 };

export function freshPerkState() {
  return {
    taken: {}, fam: { hero: 0, ranger: 0, scavver: 0, bow: 0, stone: 0, harvest: 0 }, mastery: {},
    abilityCd: 1, bountyTime: 0, bountyGold: 0, bountyRadius: 0, abilityRadius: 0, abilityDmg: 1, heroSpeed: 1, runHeal: 0, hireDiscount: 0, hireExtra: 0, mercHp: 0, mercDmg: 0, purseBonus: 0, purseChance: 1,
    heroDmg: 0, heroDmgMult: 1, heroRate: 1, heroRange: 0, heroHp: 0, heroHpMult: 1, heroRegen: 0, lifesteal: 0,
    towerDmg: 0, towerRange: 0, towerRate: 1, keepDmg: 0, keepRate: 1, keepHpMult: 1,
    wallHp: 0, thorns: 0, allHp: 0, keepHp: 0, defDiscount: 0,
    houseGold: 0, farmFood: 0, tax: 0, bounty: false, ecoDiscount: 0, upkeepCut: 0,
  };
}
