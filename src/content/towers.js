// Tower specialisations: at level 3 a tower can take one of four roles for good. Pure data: tune here
// (the rules are in sim/towers.js). Every number is a level 3 tower's base before blessings, the hero's presence,
// marks and the deadeye's mastery, which all carry over (dmg, rate and range scale with the tower's own bonuses).
// `est` is how many of the dead one hit lands on in an average crowd: the threat estimate (defenceDps) reads it.
export const SPEC_COST = 16;   // scrap to specialise a level 3 tower (crew and upkeep stay those of level 3)
export const SPEC_ORDER = ['mortar', 'brazier', 'ballista', 'bell'];
export const SPECS = {
  // splash: a slow shell that bursts where the crowd is thickest
  mortar: { name: 'Mortar', short: 'vs crowds', range: 11, min: 2.5, dmg: 4, splash: 2.5, rate: 2.2, est: 4,
    line: 'Splash: **4** to all within **2.5** of the thickest crowd · every 2.2 s · range 11' },
  // fire: a ring of flame round the tower, and the dead it licks keep burning
  brazier: { name: 'Brazier', short: 'close in', r: 4.5, dmg: 1.6, rate: 1.1, burn: { t: 3, dps: 1.2 }, est: 4,
    line: 'Fire ring: **1.6** + burning **1.2**/s to all within **4.5** · every 1.1 s' },
  // pierce: a heavy bolt down a line, made for brutes and bosses
  ballista: { name: 'Ballista', short: 'vs Brutes', range: 13, dmg: 7, width: 0.75, big: 2, rate: 2, est: 2.2,
    line: 'Piercing bolt: **7** to all in a line, **×2** vs Slag Brutes · every 2 s · range 13' },
  // support: the bell slows the dead around it and marks them for every other tower
  bell: { name: 'Watch Bell', short: 'slows, marks', r: 8, dmg: 0.6, slow: 0.55, t: 3.2, rate: 3, est: 6,
    line: 'Toll: the Ash-Born within **8** slow to **55%** and take **+30%** · every 3 s' },
};
