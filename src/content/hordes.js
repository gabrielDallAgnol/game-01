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
  kinds: n => (n >= 5 ? [['walker', 6], ['runner', 3], ['brute', 1]] : n >= 3 ? [['walker', 7], ['runner', 3]] : [['walker', 1]]),   // Oct 26: Brutes from night 5 (was 7)
  // Oct 26, the escalation (chapter-1 design §7): how many hordes wake, how many march on the camp and how big a march is,
  // by night (index = night − 1; past the table it keeps climbing). A march is at least this big whatever the horde lost.
  awake: n => [3, 4, 5, 6, 6, 6, 6][n - 1] ?? 6,
  marches: n => [0, 1, 1, 1, 1, 2, 1][n - 1] ?? 2,
  marchSize: n => [0, 5, 7, 8, 10, 8, 12][n - 1] ?? 10 + 2 * (n - 7),
  brutes: n => (n >= 5 ? 1 : 0),   // Slag Brutes at the head of every march from night 5
  press: 4,            // a march grows by this many seconds of the camp's tower fire (in Cinders): the guns are a match, not a wall
  spacing: 0.35,       // seconds between the dead of a march leaving (a clump, not a queue: 0.7 before Oct 26)
  marchFrom: 70,       // a far horde's march sets off this far from the camp, on its way in (m): ~50 s at a Cinder's pace
};
