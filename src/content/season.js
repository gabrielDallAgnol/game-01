// Pacing and seasons: the party size, the season (its rules and episodes).

export const PARTY = { base: 1, keep3: 1 };   // companions at your side: one, a second once the keep reaches level 3

// a season is an arc: a new rule, a threat that grows, a finale on its last Flare Night. After the written ones,
// the city keeps making new seasons from the pool, so an open-ended run always has a next arc.
export const SEASON_LEN = 10;
export const FIRST_SEASON = 15;   // the first season is a full cour; later arcs run SEASON_LEN nights
/** the last night of season n */
export const seasonEnd = n => FIRST_SEASON + SEASON_LEN * (n - 1);
export const SEASONS = [
  { id: 'arrival', name: 'Arrival', blurb: 'A flatbed, a depot, a blue window. Learn the suburbs before the suburbs learn you.', finale: 'The Cinder Lord' },
  { id: 'fence', name: 'Beyond the Fence', blurb: 'The cordon fences come down one by one. Out there: people, supplies, and things that were people.', rule: 'raiders', finale: 'The Toll-King' },
  { id: 'under', name: 'Under the City', blurb: 'The metro was never empty. Now the Ash-Born come up through the stations inside your lines.', rule: 'metro', finale: 'The Station Mother' },
  { id: 'winter', name: 'The Long Winter', blurb: 'Snow on the roofs. Farms give less; the Ash-Born slow down, but so do you.', rule: 'winter', finale: 'The Frost Choir' },
];
// what a generated season can be built from
export const SEASON_POOL = {
  names: ['Ashfall', 'The Quiet Months', 'Red Rain', 'The Second Wave', 'Old Bones', 'The Choir', 'Lights Out', 'Salt and Iron'],
  rules: ['raiders', 'metro', 'winter', 'fog', 'hunger', 'storm'],
};
// what each rule does (read by the game; numbers stay small)
export const RULES = {
  raiders: { catch: 'Raiders hit some nights and steal scrap.', name: 'Raiders on the roads', desc: 'Some nights, people come instead of the Ash-Born: fast, few, and after your scrap.' },
  metro: { catch: 'Some Ash-Born climb up inside your walls.', name: 'The metro', desc: 'A few of each night\'s Ash-Born come up inside your lines, from the old stations.' },
  winter: { catch: 'Farms make ⅓ less food. Everyone walks slower.', name: 'Winter', desc: 'Farms give a third less. Everything walks a little slower, the Ash-Born included.' },
  fog: { catch: 'Towers see less at night. More Ash-Born drift in.', name: 'The fog', desc: 'Towers see two cells less at night. The Ash-Born drift in more often.' },
  hunger: { catch: 'Everyone eats more. Found food counts double.', name: 'Hunger', desc: 'Everyone eats more. Food finds in the city are worth double.' },
  // what used to be weather (sim/game.js RULE_FX sets the night for these)
  storm: { catch: 'A fifth more Ash-Born each night. A little more food.', name: 'Storm season', desc: 'Thunder every night: a fifth more Ash-Born come. The rain fills the cisterns: more food.' },
  still: { catch: 'A quarter fewer Ash-Born each night.', name: 'The still', desc: 'Quiet nights: a quarter fewer Ash-Born come.' },
};
// offline episode titles: one per day of the first season (Claude writes later ones when it is on)
export const EPISODES = ['A Flatbed Full of Coworkers', 'The Thermal Pioneer', 'The Light That Went Out', 'Drawings on the Glass', 'The First Flare Night',
  'Breathing Room', 'They Can Hear Us', 'What the Radio Said', 'A Toll for the Road', 'The Thing That Eats the Light',
  'The Long Table', 'Behind the Fence', 'The Trial', 'The Eve', 'The Cinder Lord'];
