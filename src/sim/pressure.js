// [gemini3] The dead by day and hunters that commit (numbers and the why: content/pressure.js).
// Hooks, all `[gemini3]`: hives.js stepStream (the day gate and rate), brain.js roamers (drift on day 1, commit),
// combat.js hitMob (what you hit hunts you).
import { DAYDEAD, COMMIT } from '../content/pressure.js';
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
  return { dayDeadOk, dayDeadK, huntCommit, committed, giveUpT, hitCommit };
}
