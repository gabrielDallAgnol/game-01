// The Haven Rig: the numbers and words for the keep that moves. The keep is a caution-yellow diesel hauler on tracks,
// scrap-armoured by the people who ride it. It anchors (outriggers down, awnings out, the solar pylon humming), the
// town is built on the ground round it, and when the act's road is open it packs up and rolls to the next region:
// every ground building is salvaged into its cargo hold (80–100% of what it cost) and the cargo comes back as the
// starting stock where it anchors next. Pure data: tune here (sim/rig.js applies it, sim/migrate.js moves the run).

export const RIG = {
  on: true,            // off: the old hall, no packing up (the rest of the game is unchanged)
  v: 1,                // the rig block's version inside a save (save.v stays SAVE_V: old saves load as leg 1)
  // salvage: base share of a building's cost that rides along, + per building level above 1, + per Cargo level,
  // + per point of the hero's GOV (hero3's stats, when present), capped at `max`. A ruin gives `ruin` of that.
  salvage: { base: 0.8, perLevel: 0.04, perCargo: 0.03, perGov: 0.004, max: 1, ruin: 0.5 },
  // the rig's four systems: each rises (never falls) as the town's building tiers rise. `score(t)` reads a tally of the
  // town (sim/rig.js `tally`); `at` are the scores for levels 1..3; `fx` is what one level does.
  ups: {
    plating: { name: 'Plating', at: [2, 5, 9], src: 'Level 2–3 homes and farms', fx: '+12% Rig health a level', score: t => t.homeUp + t.farmUp },
    guns: { name: 'Guns', at: [1, 3, 6], src: 'Level 2–3 towers (a specialised tower counts double)', fx: '+20% Rig damage a level · a second gun at 3', score: t => t.towerUp + t.spec },
    cargo: { name: 'Cargo', at: [3, 7, 12], src: 'Every building level above 1, and the Workshop and Market (3 each)', fx: '+3% salvage a level', score: t => t.allUp + 3 * t.tech },
    speed: { name: 'Speed', at: [2, 4, 7], src: 'Rig level (×2) and level 3 buildings', fx: 'Arrive earlier in the day: more daylight to rebuild', score: t => 2 * (t.keepLvl - 1) + t.lvl3 },
  },
  hpPer: 0.12, dmgPer: 0.2,
  arrive: [0.3, 0.2, 0.1, 0.02],   // share of the day already gone when the Rig anchors, by Speed level
  // render timings (seconds of wall clock): fold up, drive off, unfold
  anim: { pack: 2.2, drive: 5.5, unpack: 2.4 },
};

// The acts are regions on the way to the cool mountain valleys. Each act is a fresh map: a new seed and a theme
// (ground palette, signature props). Past the last entry the last theme repeats with new seeds.
export const LEGS = [
  { n: 1, id: 'suburbs', name: 'The Suburbs', blurb: 'The depot, the cul-de-sacs, the woods behind the estate.' },
  { n: 2, id: 'railyard', name: 'The Rail Yard', blurb: 'Rust, ballast and boxcars. The freight lines run to the hills.',
    ground: { meadow: '#8a8456', meadowOwn: '#958d5c', forestFloor: '#5a5a3e', forestOwn: '#646244', trail: '#9a7a5a', trailOwn: '#a78462', plaza: '#8f7d66', bed: '#4a5550' } },
  { n: 3, id: 'highway', name: 'The Cracked Highway', blurb: 'Six lanes of dead traffic climbing into the cool.',
    ground: { meadow: '#7d8a5a', meadowOwn: '#88945f', forestFloor: '#4c5e44', forestOwn: '#56684a', trail: '#7c7a72', trailOwn: '#86847b', plaza: '#8a867a' } },
];
export const legOf = n => LEGS[Math.min(LEGS.length, Math.max(1, n || 1)) - 1];

// what rides along to the next act, beyond what sim/migrate.js already carries (other features append their S keys)
export const RIG_CARRY = [];
// the hero's fields that are about where they stand, not who they are (everything else on S.hero rides along)
export const HERO_PLACE = ['x', 'y', 'r', 'hp', 'maxHp', 'cd', 'dead', 'respawn', 'target', 'path', 'input', 'face', 'swing', 'guardT', 'attacks'];
