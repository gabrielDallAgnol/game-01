// Blessings. Taking 3 from one family unlocks its mastery.

export const FAMILIES = {
  hero:    { name: 'Hero',    color: '#e58a6a', mastery: 'Hero mastery: your attacks hit everything nearby and deal +1.' },
  bow:     { name: 'Bow',     color: '#eaa441', mastery: 'Bow mastery: towers and the keep deal +50% damage.' },
  stone:   { name: 'Stone',   color: '#a9bccd', mastery: 'Stone mastery: buildings repair themselves at night.' },
  harvest: { name: 'Harvest', color: '#a3c65c', mastery: 'Harvest mastery: +30% gold and food at dawn.' },
};

export const PERKS = [
  { id: 'steel',   fam: 'hero', name: 'Sharpened Steel', desc: 'Hero attacks deal +1 damage.', max: 3, fx: P => { P.heroDmg += 1; } },
  { id: 'hymn',    fam: 'hero', name: 'Battle Hymn', desc: 'Hero attacks 25% faster.', max: 3, fx: P => { P.heroRate *= 1.25; } },
  { id: 'reach',   fam: 'hero', name: 'Long Reach', desc: 'Hero reach +1.', max: 2, fx: P => { P.heroRange += 1; } },
  { id: 'skin',    fam: 'hero', name: 'Iron Skin', desc: '+12 max health. Heal slowly at night.', max: 2, fx: P => { P.heroHp += 12; P.heroRegen += 1; } },
  { id: 'blood',   fam: 'hero', name: 'Bloodthirst', desc: 'Heal 2 for every zombie that dies near you.', max: 1, fx: P => { P.lifesteal = 2; } },
  { id: 'fletch',  fam: 'bow', name: 'Fletchers', desc: 'Towers deal 30% more damage.', max: 3, fx: P => { P.towerDmg += 0.3; } },
  { id: 'eyes',    fam: 'bow', name: 'Keen Eyes', desc: 'Towers and keep reach +1.5.', max: 2, fx: P => { P.towerRange += 1.5; } },
  { id: 'draw',    fam: 'bow', name: 'Quick Draw', desc: 'Towers shoot 25% faster.', max: 3, fx: P => { P.towerRate *= 1.25; } },
  { id: 'keepbow', fam: 'bow', name: 'Keep Archers', desc: 'The keep deals 40% more damage and shoots 20% faster.', max: 2, fx: P => { P.keepDmg += 0.4; P.keepRate *= 1.2; } },
  { id: 'timber',  fam: 'stone', name: 'Thick Timber', desc: 'Palisades +60% health.', max: 2, fx: P => { P.wallHp += 0.6; } },
  { id: 'thorns',  fam: 'stone', name: 'Thorned Stakes', desc: 'Zombies that hit a palisade take 2 damage.', max: 2, fx: P => { P.thorns += 2; } },
  { id: 'mortar',  fam: 'stone', name: 'Lime Mortar', desc: 'All buildings +25% health. Keep +20.', max: 2, fx: P => { P.allHp += 0.25; P.keepHp += 20; } },
  { id: 'masons',  fam: 'stone', name: 'Guild of Masons', desc: 'Towers and palisades cost 1 less.', max: 2, fx: P => { P.defDiscount += 1; } },
  { id: 'market',  fam: 'harvest', name: 'Market Day', desc: 'Each house +2 gold at dawn.', max: 2, fx: P => { P.houseGold += 2; } },
  { id: 'soil',    fam: 'harvest', name: 'Fertile Soil', desc: 'Each farm +2 food at dawn.', max: 3, fx: P => { P.farmFood += 2; } },
  { id: 'tax',     fam: 'harvest', name: 'Tax Collector', desc: '+6 gold every dawn.', max: 2, fx: P => { P.tax += 6; } },
  { id: 'bounty',  fam: 'harvest', name: 'Bounty', desc: '+1 gold for every 3 zombies killed.', max: 1, fx: P => { P.bounty = true; } },
  { id: 'labour',  fam: 'harvest', name: 'Cheap Labour', desc: 'Houses and farms cost 1 less, and tower upkeep is 2 lower.', max: 2, fx: P => { P.ecoDiscount += 1; P.upkeepCut += 1; } },
];

export function freshPerkState() {
  return {
    taken: {}, fam: { hero: 0, bow: 0, stone: 0, harvest: 0 },
    heroDmg: 0, heroRate: 1, heroRange: 0, heroHp: 0, heroRegen: 0, lifesteal: 0,
    towerDmg: 0, towerRange: 0, towerRate: 1, keepDmg: 0, keepRate: 1,
    wallHp: 0, thorns: 0, allHp: 0, keepHp: 0, defDiscount: 0,
    houseGold: 0, farmFood: 0, tax: 0, bounty: false, ecoDiscount: 0, upkeepCut: 0,
  };
}
