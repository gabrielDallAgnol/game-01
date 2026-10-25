// The hero's and the town's modifiers (S.P): what story choices ('perk' ops), sites and the old blessings move. The
// blessing cards, their families, masteries and synergies were cut on Oct 25 (V2 has no blessings); `taken` and
// `mastery` stay empty, so core.js has() / mastery() are false and the perk hooks in the rules do nothing.
export function freshPerkState() {
  return {
    taken: {}, fam: { hero: 0, ranger: 0, scavver: 0, heart: 0, bow: 0, stone: 0, harvest: 0 }, mastery: {},
    abilityCd: 1, bountyTime: 0, bountyGold: 0, bountyRadius: 0, abilityRadius: 0, abilityDmg: 1, heroSpeed: 1, runHeal: 0, hireDiscount: 0, hireExtra: 0, mercHp: 0, mercDmg: 0, purseBonus: 0, purseChance: 1,
    heroDmg: 0, heroDmgMult: 1, heroRate: 1, heroRange: 0, heroHp: 0, heroHpMult: 1, heroRegen: 0, lifesteal: 0,
    towerDmg: 0, towerRange: 0, towerRate: 1, keepDmg: 0, keepRate: 1, keepHpMult: 1,
    wallHp: 0, thorns: 0, allHp: 0, keepHp: 0, defDiscount: 0,
    houseGold: 0, farmFood: 0, tax: 0, bounty: false, ecoDiscount: 0, upkeepCut: 0,
  };
}
