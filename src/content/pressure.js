// [gemini3] The dead by day, hunters that commit, hollows you have to find (ported from Gemini's fork, Oct 24).
// Gabriel: "I find it kind of boring that zombies only come at night, since in series and movies you have this
// constant fear. And it would be more interesting to find nests by myself instead of the forced see on night 1."
// and: "there is a clear line where they stop following me… I can find the line and just walk back and forward".
// DAYDEAD: the awake hollows near the Camp trickle their dead by day before night 5 too (from day 1, after `grace`
// seconds), at `k[night]` of the later days' rate (night 5+ is unchanged: 1). Roamers start to drift in on day 1.
// COMMIT: a roamer that takes your scent, or that you hit, keeps on you for `aggro` / `hit` seconds whatever the
// distance (still never more than 30 cells from its ground), and gives up for `giveUp` s (was 8) before it looks again.
// SCOUT: in act 1 the System names the hollows only once you have seen them; until then it gives the tracks' direction.
export const DAYDEAD = { on: true, grace: 12, k: [0, 0.45, 0.55, 0.55, 0.6] };
export const COMMIT = { on: true, aggro: 6, hit: 10, giveUp: 3 };
export const SCOUT = { on: true };
