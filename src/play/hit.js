// [play] The hit pipeline: an elemental hit adds a pip to the target (t.pips: [{ el, left }], at most 3). Hits from one
// volley count once (a pip needs `gap` seconds since the last one of that element), so a 3-pellet shot is one pip.
// The third pip sets off the recipe of all three (play/reactions.js) and clears them. Statuses a reaction leaves live in
// t.st ({ id: { left } }). Returns the reaction's id, or null.
import { PIPS, STATUSES } from './statuses.js';
import { recipeFor } from './reactions.js';
import { EFFECTS } from './effects.js';
export const HIT = { gap: 0.25, max: 3 };
export function addStatus(t, id) { (t.st ||= {})[id] = { left: STATUSES[id].dur }; }
export function runReaction(R, t, W) { const at = { target: t, x: t.x, y: t.y }; for (const e of R.effects) EFFECTS[e.do](e, at, W); W.react(R, t); return R.id; }
export function addPip(t, el, now, W) {
  if (!el || !PIPS[el]) return null; const P = (t.pips ||= []), last = (t.pipAt ||= {});
  if (now - (last[el] ?? -9) < HIT.gap) { for (const p of P) if (p.el === el) p.left = PIPS[el].life; return null; }   // the same volley: refresh only
  last[el] = now; P.push({ el, left: PIPS[el].life });
  if (P.length < HIT.max) return null;
  const R = recipeFor(P.map(p => p.el)); P.length = 0; return runReaction(R, t, W);
}
