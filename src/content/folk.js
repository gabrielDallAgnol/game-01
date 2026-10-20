// The folk build by themselves (sim/folk-build.js): numbers and words. Pure data: tune here.
// Each day the village picks ONE small project from its most pressing need and builds it over the day, paid from the
// village fund: a share of the day's income the folk keep (the player keeps the rest; "Let them build" in the build
// menu switches it off and hands the fund back).
export const FOLK = {
  share: 0.25,       // of the day's scrap income the folk keep for their own projects
  fundCap: 30,       // the folk stop keeping scrap once the fund holds this much (they never hoard)
  buildT: 28,        // seconds of daylight a project takes at the least (the scaffold stands that long)
  regen: 0.03,       // +3% faster healing at the Camp per point of beauty…
  regenMax: 0.6,     // …up to +60%
  draw: [6, 14, 24], // beauty at which word of a living village spreads: a family walks in (once each)
  drawN: 2,          // people in that family
  from: 2,          // the folk settle in on day 2 (day 1 is yours)
  reach: 22,         // how far from the hall the folk look for a spot (cells)
};
// why the folk build (the chip says it): one line per need
export const NEEDS = {
  defence: 'for the walls', housing: 'for the homeless', food: 'against hunger', crew: 'for the tower crews', beauty: 'to make it home',
};
// what the folk can raise. cost: scrap from the fund · beauty: what it adds to the village · guard: buildings within r
// take that much less damage · max: how many the village wants · from: the earliest night · near: where it goes.
export const PROPS = {
  lantern:  { one: 'a lantern',         name: 'Lantern',     cost: 2,  beauty: 1, max: 14, near: 'home',  gap: 2.5 },
  flowers:  { one: 'a flower bed',      name: 'Flower bed',  cost: 2,  beauty: 1, max: 12, near: 'home',  gap: 2 },
  bench:    { one: 'a bench',           name: 'Bench',       cost: 3,  beauty: 1, max: 6,  near: 'keep',  gap: 3 },
  fence:    { one: 'a garden fence',    name: 'Fence',       cost: 3,  beauty: 1, max: 8,  near: 'farm',  gap: 2 },
  path:     { one: 'a path between the homes', name: 'Path', cost: 4,  beauty: 2, max: 6,  near: 'path',  gap: 0 },
  well:     { one: 'a well',            name: 'Well',        cost: 8,  beauty: 3, max: 1,  near: 'keep',  gap: 4, from: 3 },
  stall:    { one: 'a market stall',    name: 'Stall',       cost: 8,  beauty: 3, max: 2,  near: 'keep',  gap: 4, from: 4 },
  shrine:   { one: 'a shrine',          name: 'Shrine',      cost: 12, beauty: 4, max: 1,  near: 'quiet', gap: 5, from: 6 },
  sandbags: { one: 'a sandbag wall',    name: 'Sandbags',    cost: 4,  beauty: 0, max: 12, near: 'hit',   gap: 1.5, guard: 0.2, r: 2.4, defence: true },
  watch:    { one: 'a watch-post',      name: 'Watch-post',  cost: 6,  beauty: 0, max: 4,  near: 'hit',   gap: 5, guard: 0.12, r: 3.6, defence: true, from: 3 },
};
export const BEAUTY_ORDER = ['lantern', 'flowers', 'bench', 'fence', 'path', 'well', 'stall', 'shrine'];
// the System's lines
export const FOLK_TEXT = {
  done: '[Village] The folk raised {one}.',
  rebuilt: '[Village] The folk rebuilt the fallen {name}.',
  built: '[Village] The folk built {one} {why}.',
  drawn: '[Village] Word of a living village spreads. A family of {n} walks in from the woods.',
  veto: 'The folk put down their tools. {n} scrap back in your chest.',
  off: 'The folk leave the building to you. {n} scrap from their fund back in your chest.',
  on: 'The folk will build by themselves again: a quarter of the day\'s scrap goes to their fund.',
};
