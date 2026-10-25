// [gemini3] Small and strong (ported from Gemini's fork, Oct 24; numbers re-derived for v55's trickle income).
// Gabriel: "the base upgrade forces me to build more and more buildings, where I would like my base to be small and
// strong, but also not allow me to have everything maxed out on day 5."
// MATURITY: what each Camp level asks for (replaces KEEP.need while `on`): fewer people and less food than before, but
// a day it cannot come before, standing buildings, and for level 3 two buildings already raised to level 2. The days
// match the builders' own pacing (sim/planner.js: "level 2 from night 3, level 3 from night 7").
// COMPACT: a Camp of at most `max` standing buildings (palisade posts not counted) holds tighter: its towers hit
// harder, its buildings take less, its farms and raised homes give a little more. GARRISON: a raised Camp mans towers
// with its own people. CAPTAIN: a companion at their post holds the line near the Camp with part of the hero's presence.
export const MATURITY = {
  on: true,
  need: [null,
    { minDay: 3, buildings: 3, people: 5, foodNet: 1 },
    { minDay: 7, buildings: 4, lv2: 2, people: 10, foodNet: 2, won: 1 }],
};
export const COMPACT = { on: true, max: 6, towerDmg: 1.2, taken: 0.85, farmFood: 1, homeGold: 1 };   // homeGold: level 2+ homes
export const GARRISON = [0, 2, 4];   // tower crew the Camp itself provides, by Camp level
export const CAPTAIN = { on: true, share: 0.7, pad: 2 };   // share of the hero's presence; towers within PRESENCE.r + pad of the Camp
