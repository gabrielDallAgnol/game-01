// [play] The hit pipeline: an elemental hit on a target → intensify (same element again, up to 3 stacks) or a reaction
// (a different element's status already there) → effects. A target keeps its statuses in `t.st` ({ id: { stacks, left } }).
// Same-element hits from one volley count once (a stack needs `stackGap` seconds since the last), so a 3-pellet shot is
// one stack, not a free Blaze. Returns the reaction's id, or null.
import { ELEMENTS } from './elements.js';
import { STATUSES } from './statuses.js';
import { REACTIONS, CLASH, reactionFor } from './reactions.js';
import { EFFECTS } from './effects.js';
export const HIT = { stackGap: 0.25 };
export function addStatus(t, id, now, stacks = 1) { t.st = t.st || {}; const S = STATUSES[id], cur = t.st[id]; const max = S.dps ? S.dps.length : S.slow ? S.slow.length : 1;
  if (cur) { cur.stacks = Math.min(max, cur.stacks + stacks); cur.left = S.dur; cur.at = now; } else t.st[id] = { stacks: Math.min(max, stacks), left: S.dur, at: now }; return t.st[id]; }
export function runReaction(R, t, W) { const at = { target: t, x: t.x, y: t.y }; for (const e of R.effects) EFFECTS[e.do](e, at, W); W.react(R, t); return R.id; }
export function hitElement(t, element, now, W) {
  if (!element) return null; const E = ELEMENTS[element]; t.st = t.st || {};
  const mine = t.st[E.status];
  if (mine) {   // the same element again: intensify (one stack per volley), the third stack sets off its reaction
    if (now - mine.at < HIT.stackGap) { mine.left = STATUSES[E.status].dur; return null; }
    const R = reactionFor(element, element), stacks = mine.stacks + 1;
    if (R && R.stacks && stacks >= R.stacks) { if (R.consumes) delete t.st[E.status]; return runReaction(R, t, W); }
    addStatus(t, E.status, now); return null;
  }
  for (const sid of Object.keys(t.st)) { const other = STATUSES[sid].element; if (!other || other === element) continue;   // a different element's status: react
    const R = reactionFor(other, element) || CLASH; if (R.consumes) delete t.st[sid]; return runReaction(R, t, W); }
  addStatus(t, E.status, now); return null;
}
