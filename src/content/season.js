// Pacing: one new idea at a time, the way the first episodes of an anime let you look around before the plot
// kicks in. Each system stays switched off (and out of the HUD) until its episode comes, then the System opens a
// window that explains it in three lines. See docs/research/anime-pacing.md.

// the hero earns a class through a trial, not by picking two cards
export const CALLING_LVL = 5;   // level for the first class change (the Calling)
export const FINAL_LVL = 12;    // level for the final class
export const PARTY = { base: 1, keep3: 1 };   // companions at your side: one, a second once the keep reaches level 3

// when each system arrives. `when(S, g)` is checked at dawn and when the keep rises.
// `win` is the System window that introduces it (bold with **…**).
export const FEATURES = {
  power: {
    when: (S, g) => g.keepLevel() >= 2,
    win: { eyebrow: '[New system: Power]', title: 'The lights need power',
      lines: ['Level 2 towers and the tech buildings now draw **power** (⚡ at the top).', 'The town hall makes a little. **Generators** make more, but they are loud.', 'Need more than you make and you get a **blackout**: everything powered switches off.'] },
  },
  heat: {
    when: (S, g) => S.night >= 6 && g.keepLevel() >= 2,
    win: { eyebrow: '[New system: Heat]', title: 'The dead can hear you',
      lines: ['Your town is big enough to be heard. The **heat bar** shows how loud it is.', 'Past the **yellow mark** the dead out in the streets drift toward you.', 'At the **red mark** the nearest hive **bursts** (40 seconds warning). Heat cools by itself; generators, guns and crowds raise it.'] },
  },
  routes: {
    when: S => S.night >= 6,
    win: { eyebrow: '[New system: Expeditions]', title: 'Beyond the fence',
      lines: ['Your scouts can now cut a route into a **sealed district** every other dawn.', 'An expedition costs **supplies**. Far districts are bigger, richer and more dangerous.', 'Each district has one **site** to claim, and some have a **hive**.'] },
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
  { id: 'fence', name: 'Beyond the Fence', blurb: 'The quarantine fences come down one by one. Out there: people, power, and things that were people.', rule: 'raiders', finale: 'The Toll-King' },
  { id: 'under', name: 'Under the City', blurb: 'The metro was never empty. Now the dead come up through the stations inside your lines.', rule: 'metro', finale: 'The Station Mother' },
  { id: 'winter', name: 'The Long Winter', blurb: 'Snow on the barricades. Farms give less; the dead slow down, but so do you.', rule: 'winter', finale: 'The Frost Choir' },
];
// what a generated season can be built from
export const SEASON_POOL = {
  names: ['Ashfall', 'The Quiet Months', 'Red Rain', 'The Second Wave', 'Old Bones', 'The Choir', 'Lights Out', 'Salt and Iron'],
  rules: ['raiders', 'metro', 'winter', 'fog', 'hunger'],
};
// what each rule does (read by the game; numbers stay small)
export const RULES = {
  raiders: { name: 'Raiders on the roads', desc: 'Some nights, people come instead of the dead: fast, few, and after your scrap.' },
  metro: { name: 'The metro', desc: 'A few of each night\'s dead come up inside your lines, from the old stations.' },
  winter: { name: 'Winter', desc: 'Farms give a third less. Everything walks a little slower, the dead included.' },
  fog: { name: 'The fog', desc: 'Towers see two cells less at night. The dead drift in more often.' },
  hunger: { name: 'Hunger', desc: 'Everyone eats more. Food finds in the city are worth double.' },
};
// offline episode titles: one per day of the first season (Claude writes later ones when it is on)
export const EPISODES = ['A Bus Full of Strangers', 'The Status Window', 'The Light That Went Out', 'Drawings on the Glass', 'The First Blood Moon',
  'Breathing Room', 'They Can Hear Us', 'What the Radio Said', 'A Toll for the Road', 'The Thing That Eats the Light',
  'The Long Table', 'Behind the Fence', 'The Trial', 'The Eve', 'The Gravelord'];
