// [v2] The V2 core: with the v2 flag (?v2=1, createGame({ v2 }), G.v2) the old v56 systems are switched off and only
// the new core plays: hero movement, the v2combat dash and bites, building at the camp, searching houses and claiming
// sites in the engine towns, day and night, food and scrap. This file is the policy: what is off (V2_OFF, read by the
// UI through api.v2Off()) and the wraps that need no edit elsewhere. The rest are small `if (G.v2)` hooks bracketed
// `// [v2]` in the rule modules (search for `[v2]`). Nothing is deleted yet: the owner confirms the cut first.
// Without the flag nothing here changes a thing (no rng draw, no state).

/** the systems the V2 core switches off, and where their hooks live */
export const V2_OFF = [
  { id: 'stats', what: 'hero stat points and their abilities (STR/AGI/INT/GOV)', where: 'sim/stats.js on(), sim/powers.js, ui/hero3.js' },
  { id: 'ability', what: 'the class ability (Q/Space) and class evolution', where: 'sim/hero.js useAbility, autoHero, stats.js classPicksOff' },
  { id: 'blessings', what: 'blessing cards and relic finds (level-ups still give XP)', where: 'v2core rollOffer wrap, hero.js gainXp' },
  { id: 'waves', what: 'night waves and day stragglers from nests (hordes come next: waves.js makeWave/planDay hooks)', where: 'sim/waves.js' },
  { id: 'forecast', what: 'the wave forecast and threat rating', where: 'sim/forecast.js, waves.js startNight' },
  { id: 'nests', what: 'nest guard packs, nest rage, nest sieges, eruptions, the hives\' stream', where: 'sim/nests.js, sim/hives.js' },
  { id: 'inferno', what: 'the Inferno Nest segments and counter-surges', where: 'sim/inferno.js on()' },
  { id: 'rig', what: 'the Haven Rig (pack up and roll, its systems)', where: 'sim/rig.js' },
  { id: 'road', what: 'the road, stations, convoys, ambushes and night missions', where: 'game.js (G.road stays null)' },
  { id: 'contracts', what: 'season contracts and their finales', where: 'sim/story.js, sim/contracts.js' },
  { id: 'acts', what: 'acts and the quarantine fence', where: 'sim/acts.js' },
  { id: 'haul', what: 'harvester carts and resource nodes', where: 'sim/haul.js on()' },
  { id: 'power', what: 'power and the noise meter (heat) as economy pressure', where: 'sim/seasons.js checkFeatures' },
  { id: 'seals', what: 'sealed districts and the far city as goals', where: 'sim/districts.js, game.js' },
  { id: 'chronicler', what: 'the Chronicler (the AI story writer) and the story cards of the cut systems', where: 'ui/story-ai.js, sim/story.js' },
];

export function createV2Core(G) {
  const { S } = G;
  // [v2] blessings and relics: every pick that the old rules hand out (a chest, a level, a hive, a story reward) is dropped
  const roll0 = G.rollOffer;
  function rollOffer() {
    if (!G.v2) return roll0();
    S.picks.length = 0; S.offer = []; S.offerSource = null; G.syncPicks();
  }
  return { rollOffer, v2Off: () => (G.v2 ? V2_OFF.map(o => o.id) : []) };
}
