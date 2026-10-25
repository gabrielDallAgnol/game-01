// [gemini3] Logging: the Logger's Hut and felling trees on your land (ported from Gemini's fork, Oct 24).
// Gabriel: "removing trees could be something my character could do, but time consuming, until I have a special
// building for this kind of labor." Trees on your land are a job, not a purchase: the hero walks over and fells a
// 3×3 patch by hand (slow, he has to stand there, a scrap of timber for it); with a Logger's Hut a crew does it from
// the hut (quick, more timber), fells a tree on your land now and then by day, and sends a little timber in at dawn.
// Rock (a ruined block) is unchanged: scrap, a pair of hands and noise. Pure data; the rule is sim/logging.js.
import { BUILDINGS, RISE, TECH_ORDER } from './buildings.js';

export const LOGGING = {
  on: true,            // off: trees go back to the old instant, paid clearing
  hand: 7.5,           // seconds of the hero's own work on one 3×3 patch (he must stand within `reach`)
  crew: 1.2,           // seconds for the hut's crew (from anywhere)
  reach: 2.6,          // how close the hero must stand to chop
  pay: { hand: 1, crew: 2 },   // timber (scrap) a felled patch brings in
  auto: { every: 18, pay: 1 }, // by day the crew fells the tree on your land nearest the Camp every this many seconds
  dawn: 2,             // timber the hut sends in at dawn
  swing: 0.65,         // seconds between the hero's axe swings (the view's swing + a 'chop' event)
};

// the hut: a tech building (one, scrap only, takes time to build) from the first Camp level
BUILDINGS.lumbermill = {
  name: "Logger's Hut", cost: [10], hp: [45], tech: true, keep: 1, buildTime: 14, maxLevel: 1,
  desc: ['A crew fells trees on your land (quick, +2 timber a patch), clears a tree now and then by day, +2 scrap at dawn.'],
};
RISE.lumbermill = 0;
if (!TECH_ORDER.includes('lumbermill')) TECH_ORDER.push('lumbermill');   // appended: the hotkeys 1–6 keep their buildings
