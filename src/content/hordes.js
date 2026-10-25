// [v2] Hordes: the numbers. Groups of the dead sleep at key places round the town (sites, the nest, far streets) and
// wake at dusk; now and then one marches on the camp, shown by day with the red route arrows.
export const HORDES = {
  count: 6,            // horde spots per map
  minD: 45,            // no closer than this to the camp (m)
  gap: 38,             // spots at least this far apart (m)
  size: (n, far) => Math.min(18, 4 + Math.floor(n * 0.9) + Math.floor(far / 60)),   // dead in a horde tonight
  regrow: 2,           // a horde that lost dead regains up to this many each dawn
  pity: 3,            // and at the latest every third night from night 3
  march: n => (n < 2 ? 0 : Math.min(0.75, 0.2 + 0.08 * n)),   // chance a horde marches on the camp on night n
  loot: (size, far) => 4 + Math.round(size * 0.8 + far / 40),   // scrap for breaking a horde at night
  kinds: n => (n >= 7 ? [['walker', 6], ['runner', 3], ['brute', 1]] : n >= 3 ? [['walker', 7], ['runner', 3]] : [['walker', 1]]),
};
