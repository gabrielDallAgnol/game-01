// Tower specialisations: at level 3 a tower can take one of four roles for good. Pure data: tune here
// (the rules are in sim/towers.js). Every number is a level 3 tower's base before blessings, the hero's presence,
// marks and the deadeye's mastery, which all carry over (dmg, rate and range scale with the tower's own bonuses).
// `est` is how many of the dead one hit lands on in an average crowd: the threat estimate (defenceDps) reads it.
export const SPEC_COST = 16;   // scrap to specialise a level 3 tower (crew and upkeep stay those of level 3)
export const SPEC_ORDER = ['mortar', 'brazier', 'ballista', 'bell'];
export const SPECS = {
  // splash: a slow shell that bursts where the crowd is thickest
  mortar: { name: 'Mortar', short: 'Splash vs crowds', range: 11, min: 2.5, dmg: 3.4, splash: 2.3, rate: 2.2, est: 4,
    line: 'Shells burst on the thickest crowd · **3.4** to all within **2.3** · every 2.2 s · range 11' },
  // fire: a ring of flame round the tower, and the dead it licks keep burning
  brazier: { name: 'Brazier', short: 'Fire ring, burns', r: 4.2, dmg: 1.6, rate: 1.1, burn: { t: 3, dps: 1.2 }, est: 4,
    line: 'A ring of fire · **1.6** to all within **4.2** and they burn (**1.2**/s for 3 s) · every 1.1 s' },
  // pierce: a heavy bolt down a line, made for brutes and bosses
  ballista: { name: 'Ballista', short: 'Piercing bolt vs brutes', range: 13, dmg: 7, width: 0.75, big: 2, rate: 2, est: 2.2,
    line: 'A bolt through everything in a line · **7** dmg, **×2** vs brutes and bosses · every 2 s · range 13' },
  // support: the bell slows the dead around it and marks them for every other tower
  bell: { name: 'Watch Bell', short: 'Slows and marks', r: 7.5, dmg: 0.6, slow: 0.55, t: 3.2, rate: 3, est: 6,
    line: 'Tolls every 3 s · the dead within **7.5** walk at **55%** speed and take **+30%** from towers for 3 s' },
};
