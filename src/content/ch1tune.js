// [ch1] Chapter 1's numbers for the rules (sim/chapter.js and friends). The words and the quest chain are story1.js
// and notes.js; this is what the engine reads to run them: the day and night lengths, how long a repair takes, how big
// the sleepers and the nests' halls are, what the survivors do, the finale's beats.
export const PACE = {
  // day and night length (s) by night (design §1); the last entry holds for later nights
  day: [300, 420, 420, 420, 420, 420, 600], night: [150, 200, 210, 220, 230, 260, 180],
};
export const WORK = {
  reach: 1.9,                 // stand this close to a job to work it
  carSalvage: 2.4, carScrap: 2,   // the fallback salvage (no Mechanic module yet): seconds and scrap a car
  bench: 6, gate: 5,          // Kai's bench at the garage, the Works gate (s)
  hurtPause: 0.6,             // a hit knocks the hands off the job for this long
};
export const PACKS = {
  townhall: 6,                // sleepers on the town hall steps (q3.steps): awake once you are there
  works: [6, 8, 10],          // the Works' halls, one after another (q7.halls)
  spread: 3.2,                // how far round its spot a pack stands (m)
};
export const NEST1 = {
  hall: 0.7,                  // a nest's halls come out at this share of story1's numbers (the wrench is weak)
  heal: true,                 // a heart is sealed (heals) while its halls stand
  kinds: n => (n >= 5 ? [['walker', 6], ['runner', 3], ['brute', 1]] : [['walker', 7], ['runner', 3]]),
  wardenHp: 60,               // the Inferno Warden at the press line
};
export const CREW = {
  carryEvery: 20,             // Lotte: every this many seconds out in the town she runs half your carry home
  repairRig: 2,               // Gus: the Rig mends this many hp a second at night
  partsDawn: 1, partsAsScrap: 2,   // Benno: a part a dawn (scrap if there is no parts store yet)
  searchFood: 1,              // Benno: food on top of every house searched
  beds: 3,                    // beds at the Rig when the Rig has no bunks module yet (another branch builds it)
};
export const FINALE = {
  duskLeft: 75,               // when the Heart breaks, dusk comes early: this many seconds of day left
  chase: 12, chaseFrom: 42,   // the last march, while Kai fits the crankshaft: this many, from this far north of the Rig (m)
  fit: 20, slow: 0.7,         // hold-to-fit at the Rig (s); Kai's speed with the crankshaft
  roll: 8,                    // seconds the Rig takes to roll out of the square before the end
};
export const SIGHT = {
  hero: 14,                   // Kai opens the shroud this far round her (m); the base game's 8 hid the town on a phone
  rig: 26,                    // the Rig's clearing at the start (m)
  ringPad: 10,                // the old town (Kai's home) starts known, plus this margin past its ring street (m)
};
