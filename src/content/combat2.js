// [combat2] The numbers of telegraphed melee and the hero's dodge (sim/combat2.js applies them).
// A bite is a wind-up you can read and step out of; the dash is the way out.

// windup: seconds from "in reach" to the bite, per kind (the big dead swing slow). A kind not listed takes
// base × (1 + (size − 1) × bySize). reach: the bite lands if the hero is still within reach + grace when it ends.
// cd: the pause after a bite or a whiff before the next wind-up.
export const WINDUP = {
  base: 0.45, bySize: 0.5, reach: 0.9, grace: 0.35, cd: 0.75,
  kinds: { walker: 0.45, risen: 0.45, runner: 0.32, crawler: 0.38, wolf: 0.34, boar: 0.5, screamer: 0.5, brute: 0.75, guardian: 0.8, gravelord: 0.95 },
};

// dash: dist cells over dur seconds, no harm taken for iframes seconds, then cd seconds before the next.
export const DASH = { dist: 3.5, dur: 0.16, iframes: 0.25, cd: 1.2 };
