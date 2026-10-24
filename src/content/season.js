// Pacing: one new idea at a time, the way the first episodes of an anime let you look around before the plot
// kicks in. Each system stays switched off (and out of the HUD) until its episode comes, then the System opens a
// window that explains it in three lines. See docs/research/anime-pacing.md.

// the hero earns a class through a trial, not by picking two cards
// three tiers by hero level (the XP curve, LEVEL in sim/game.js, lands them around nights 8–10, 20–25 and 35–40)
export const CALLING_LVL = 15;  // tier 1: the Calling
export const FINAL_LVL = 30;    // tier 2: the advanced class (a Calling plus a second family)
export const LEGEND_LVL = 45;   // tier 3: the legendary form
export const PARTY = { base: 1, keep3: 1 };   // companions at your side: one, a second once the keep reaches level 3

// when each system arrives. `when(S, g)` is checked at dawn and when the keep rises.
// `win` is the System window that introduces it (bold with **…**).
export const FEATURES = {
  power: {
    when: (S, g) => g.keepLevel() >= 2,
    win: { eyebrow: '[New system: Power]', title: 'The lights need power',
      lines: ['Big towers now need **power** (⚡ at the top).', 'The town hall makes a little. **Generators** make more, but they are loud.', 'Not enough power: a **blackout**. Powered things stop.'] },
  },
  heat: {
    when: (S, g) => S.night >= 6 && g.keepLevel() >= 2,
    win: { eyebrow: '[New system: Noise]', title: 'The dead can hear you',
      lines: ['**Noise** (top bar): how loud the Camp is.', 'Louder = **more dead** each night.', 'At the **red mark**, the nearest hive **bursts**.'] },
  },
  routes: {
    when: S => S.act !== 1 && (S.night >= 6 || S.actOpened > 0),   // act 1 (the woods) keeps the fences shut: routes come the dawn after the road opens
    win: { eyebrow: '[New system: Expeditions]', title: 'Beyond the fence',
      lines: ['Every other dawn, pick **one route** into a sealed district.', 'Far districts: **bigger, richer, more dangerous**.', 'Each has one **site** to claim. Some have a **hive**.'] },
  },
};

// a season is an arc: a new rule, a threat that grows, a finale on its last blood moon. After the written ones,
// the city keeps making new seasons from the pool, so an open-ended run always has a next arc.
export const SEASON_LEN = 10;
export const FIRST_SEASON = 15;   // the first season is a full cour; later arcs run SEASON_LEN nights
/** the last night of season n */
export const seasonEnd = n => FIRST_SEASON + SEASON_LEN * (n - 1);
export const SEASONS = [
  { id: 'arrival', name: 'Arrival', blurb: 'A bus, a square, a status window. Learn the town before the city learns you.', finale: 'The Gravelord' },
  { id: 'fence', name: 'Beyond the Fence', blurb: 'The quarantine fences come down one by one. Out there: people, supplies, and things that were people.', rule: 'raiders', finale: 'The Toll-King' },
  { id: 'under', name: 'Under the City', blurb: 'The metro was never empty. Now the dead come up through the stations inside your lines.', rule: 'metro', finale: 'The Station Mother' },
  { id: 'winter', name: 'The Long Winter', blurb: 'Snow on the roofs. Farms give less; the dead slow down, but so do you.', rule: 'winter', finale: 'The Frost Choir' },
];
// what a generated season can be built from
export const SEASON_POOL = {
  names: ['Ashfall', 'The Quiet Months', 'Red Rain', 'The Second Wave', 'Old Bones', 'The Choir', 'Lights Out', 'Salt and Iron'],
  rules: ['raiders', 'metro', 'winter', 'fog', 'hunger', 'storm'],
};
// what each rule does (read by the game; numbers stay small)
export const RULES = {
  raiders: { catch: 'Raiders hit some nights and steal scrap.', name: 'Raiders on the roads', desc: 'Some nights, people come instead of the dead: fast, few, and after your scrap.' },
  metro: { catch: 'Some dead climb up inside your walls.', name: 'The metro', desc: 'A few of each night\'s dead come up inside your lines, from the old stations.' },
  winter: { catch: 'Farms make ⅓ less food. Everyone walks slower.', name: 'Winter', desc: 'Farms give a third less. Everything walks a little slower, the dead included.' },
  fog: { catch: 'Towers see less at night. More dead drift in.', name: 'The fog', desc: 'Towers see two cells less at night. The dead drift in more often.' },
  hunger: { catch: 'Everyone eats more. Found food counts double.', name: 'Hunger', desc: 'Everyone eats more. Food finds in the city are worth double.' },
  // what used to be weather (sim/game.js RULE_FX sets the night for these)
  storm: { catch: 'A fifth more dead each night. A little more food.', name: 'Storm season', desc: 'Thunder every night: a fifth more dead come. The rain fills the cisterns: more food.' },
  still: { catch: 'A quarter fewer dead each night.', name: 'The still', desc: 'Quiet nights: a quarter fewer dead come.' },
  lightsOut: { catch: 'Big towers need power again.', name: 'Lights out', desc: 'Level 2–3 towers need power again. Generators return; build too few and the lights go out.' },
};
// offline episode titles: one per day of the first season (Claude writes later ones when it is on)
export const EPISODES = ['A Bus Full of Strangers', 'The Status Window', 'The Light That Went Out', 'Drawings on the Glass', 'The First Blood Moon',
  'Breathing Room', 'They Can Hear Us', 'What the Radio Said', 'A Toll for the Road', 'The Thing That Eats the Light',
  'The Long Table', 'Behind the Fence', 'The Trial', 'The Eve', 'The Gravelord'];
