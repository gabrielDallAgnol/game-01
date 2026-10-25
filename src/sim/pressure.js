// [gemini3] The dead by day, hunters that commit, hollows you have to find (numbers and the why: content/pressure.js).
// Hooks, all `[gemini3]`: hives.js stepStream (the day gate and rate), brain.js roamers (drift on day 1, commit),
// combat.js hitMob (what you hit hunts you). The act-1 goal (acts.js actGoal) is wrapped here: no edit there.
import { DAYDEAD, COMMIT, SCOUT } from '../content/pressure.js';
import { MOBS } from '../content/mobs.js';
import { idx } from './mapgen.js';

export function createPressure(G) {
  const { S, map, c } = G;
  // ---------- the dead by day ----------
  /** the early days' stream is open (a day before night 5, past the morning's grace) */
  const dayDeadOk = () => DAYDEAD.on && S.clock && S.phase === 'day' && S.night < 5 && (S.dayT || 0) > DAYDEAD.grace;
  /** the day stream's rate before night 5 (1 otherwise) */
  const dayDeadK = () => (DAYDEAD.on && S.phase === 'day' && S.night < 5 ? DAYDEAD.k[S.night] ?? 1 : 1);
  // ---------- hunters commit ----------
  const commit = (m, sec) => { if (COMMIT.on) m.commitUntil = Math.max(m.commitUntil || 0, S.time + sec); };
  const committed = m => COMMIT.on && m.commitUntil > S.time;
  const huntCommit = m => commit(m, COMMIT.aggro);
  const giveUpT = () => (COMMIT.on ? COMMIT.giveUp : 8);
  /** the hero hit a roamer (wolves too, not deer or boar): it turns on him and stays on him */
  function hitCommit(m) {
    if (!COMMIT.on || !m.roam || m.hp <= 0 || (MOBS[m.kind].animal && m.kind !== 'wolf')) return;
    m.hunt = true; m.giveUp = 0; commit(m, COMMIT.hit);
  }
  // ---------- hollows you have to find ----------
  const baseGoal = G.actGoal;
  const seenAt = (x, y) => !!S.seen[idx(Math.floor(x), Math.floor(y))];
  function actGoal() {
    const A = baseGoal ? baseGoal() : null;
    if (!SCOUT.on || !A || A.act !== 1 || A.x === undefined) return A;
    const left = map.regions.filter(r => r.ring === 1 && r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id) && !S.sealed[r.id]);
    const byDist = left.sort((a, b) => Math.hypot(a.nest.x - c, a.nest.y - c) - Math.hypot(b.nest.x - c, b.nest.y - c));
    const found = byDist.find(r => { const b = r.nest.body || r.nest; return seenAt(b.x, b.y) || seenAt(r.nest.x, r.nest.y); });
    if (found) return { ...A, x: found.nest.x, y: found.nest.y, extra: `Found: ${G.compass(found.nest.x, found.nest.y)}` };
    const near = byDist[0];
    return { ...A, x: undefined, y: undefined, extra: near ? `Tracks lead ${G.compass(near.nest.x, near.nest.y)}` : '' };
  }
  if (baseGoal) G.actGoal = actGoal;
  return { dayDeadOk, dayDeadK, huntCommit, committed, giveUpT, hitCommit, actGoal: G.actGoal };
}
