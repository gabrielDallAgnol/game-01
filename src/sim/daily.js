// The daily quest, fair and trackable (Oct 20, Gabriel: "system missions I don't do are hard to keep track of; in the
// middle of a fight it just punishes me for not reading it"). The rules now:
// - it is OFFERED, by day, only when the hero is calm (no dead close by): a System card with Accept / Not now;
// - saying no (or never meeting it) costs nothing: there is no penalty quest any more;
// - an ACCEPTED quest that is not done by dawn costs what the card said, settled at dawn with the ledger, never
//   mid-fight; its timer counts the day and its night, not seconds under fire;
// - while it runs it is a MAIN objective (story.objectives) with its progress, and a short reminder comes before dusk.
// ST.daily = { id, title, goal, n, base, state: 'offered'|'active'|'done'|'failed'|'declined', day, far, back, fail, said }
import { DAILY, DAILY_TEXT } from '../content/story.js';
import { MOBS, TIDE } from '../content/mobs.js';

export const DAILY_RULES = {
  offerFrom: 2,                       // the first day a quest is offered
  dayLeft: 0.4,                       // offered only while this share of the day is still ahead
  calmR: 12, calmT: 3,                // nothing hostile within calmR cells for calmT seconds: the System may speak
  fail: n => 2 + Math.floor(n / 3),   // scrap an accepted quest costs if it is not done by dawn (said on the card)
  remind: 25,                         // seconds before dusk: one reminder while it is not done
};

export function createDaily(ctx) {
  const { S, map, rng, toast, ev, apply, chron, grant, push, roomForQuest } = ctx;
  const ST = () => S.story;
  const tmpl = q => DAILY.find(x => x.id === q.id);
  const openSites = () => S.landmarks.filter(l => !l.owned && !l.stripped && l.kind !== 'unknown').length;
  const active = () => { const q = ST().daily; return q && q.state === 'active' && q.day === S.night ? q : null; };
  let calmFor = 0;
  /** the hero is calm: alive, and no hostile dead close (the System never opens a window mid-fight) */
  function calm() {
    const h = S.hero; if (h.dead) return false;
    return !S.mobs.some(m => !m.dying && !(MOBS[m.kind] && MOBS[m.kind].animal) && (m.rise === undefined || m.rise >= 1) && Math.hypot(m.x - h.x, m.y - h.y) < DAILY_RULES.calmR);
  }
  const rewardFx = (T, n) => T.reward(n);
  const say = fx => fx.filter(f => f.op !== 'lean').map(f => (f.op === 'xp' ? `+${f.n} xp` : f.op === 'gold' ? `+${f.n} scrap` : f.op === 'food' ? `+${f.n} food` : '')).filter(Boolean).join(' · ');
  /** the offer: a System card, Accept or Not now. Called by the story's day gate (it checks the quest cap). */
  function offer() {
    const st = ST(), prev = st.daily;
    if (S.night < DAILY_RULES.offerFrom || S.phase !== 'day' || (prev && prev.day === S.night)) return false;
    const pool = DAILY.filter(q => (!q.when || q.when(S, openSites())) && (!prev || q.id !== prev.id));
    const T = pool.length ? pool[rng.int(pool.length)] : null; if (!T) return false;
    const n0 = T.n(S.night), n = T.far ? Math.min(70, n0) : n0;   // the long walk stays a walk you can make
    const fail = DAILY_RULES.fail(S.night), fx = rewardFx(T, S.night), goal = T.goal.replace('{n}', n);
    st.daily = { id: T.id, title: T.title, goal, n, base: 0, state: 'offered', day: S.night, far: 0, back: false, fail, done: false };
    push({ kind: 'daily', eyebrow: DAILY_TEXT.offer, title: T.title, scene: DAILY_TEXT.scene.replace('{goal}', goal),
      choices: [
        { id: 'accept', label: DAILY_TEXT.accept, hint: DAILY_TEXT.terms.replace('{reward}', say(fx)).replace('{fail}', fail), fx: [{ op: 'dailyAccept', reward: fx, fail }] },
        { id: 'later', label: DAILY_TEXT.later, hint: DAILY_TEXT.laterHint, fx: [{ op: 'dailyDecline' }] },
      ] });
    ev('daily', { id: T.id, offered: true });
    return true;
  }
  function accept() {
    const q = ST().daily; if (!q || q.state !== 'offered') return;
    const T = tmpl(q); q.state = 'active'; q.base = T ? T.stat(S, ST()) : 0; q.far = 0; q.back = false;
    toast(`${DAILY_TEXT.issued.replace('{title}', q.title)} ${q.goal}. ${DAILY_TEXT.ends}`, 'sys'); ev('daily', { id: q.id });
  }
  function decline() { const q = ST().daily; if (q && q.state === 'offered') q.state = 'declined'; }
  /** "Put down 12 of the dead · 4/12" (null unless one was accepted today) */
  function progress() {
    const q = ST().daily; if (!q || q.day !== S.night || !(q.state === 'active' || q.state === 'done')) return null;
    const T = tmpl(q); if (!T) return null;
    const have = q.state === 'done' ? q.n : T.far ? (q.back ? q.n : Math.min(q.n, Math.round(q.far))) : Math.max(0, Math.min(q.n, T.stat(S, ST()) - q.base));
    return { title: q.title, goal: q.goal, have, n: q.n, done: q.state === 'done', penalty: false, fail: q.fail, ends: DAILY_TEXT.endsShort };
  }
  /** a few times a second: progress (by day or night), completion, the reminder, and the offer gate's calm clock */
  function tick(dt) {
    calmFor = calm() ? calmFor + dt : 0;
    const q = active(); if (!q || S.over) return;
    const T = tmpl(q); if (!T) return;
    if (T.far && !S.hero.dead) { const d = Math.hypot(S.hero.x - map.town.x, S.hero.y - map.town.y); if (d > q.far) q.far = d; if (q.far >= q.n && d < 9) q.back = true; }
    if (S.phase === 'day' && !q.said && S.clock && TIDE.dayLen - (S.dayT || 0) <= DAILY_RULES.remind) { q.said = true; const p = progress(); toast(DAILY_TEXT.remind.replace('{title}', q.title).replace('{have}', p.have).replace('{n}', p.n), 'sys'); }
    if (T.stat(S, ST()) - q.base < q.n) return;
    q.state = 'done'; q.done = true; const st = ST(); st.dailies = (st.dailies || 0) + 1;
    const fx = rewardFx(T, q.day); for (const f of fx) apply(f, null);
    toast(`${DAILY_TEXT.done.replace('{title}', q.title)} ${say(fx)}.`, 'sys'); ev('dailyDone', { id: q.id });
    chron(`Finished the daily quest ${q.title}.`, 1);
    if (st.dailies === 7) grant('diligent');
  }
  /** dawn: an accepted quest still open costs what its card said (and only that); then the slate is clean */
  function settle() {
    const q = ST().daily; if (!q || q.state !== 'active' || q.day >= S.night) return;
    q.state = 'failed';
    const cost = Math.min(S.gold, q.fail || 0); S.gold -= cost;
    toast(DAILY_TEXT.failed.replace('{title}', q.title).replace('{cost}', cost ? `−${cost} scrap, as agreed` : 'nothing left to pay'), 'bad');
    chron(`Failed the daily quest ${q.title}.`, 1);
  }
  /** the story's day gate asks: may a quest be offered now? */
  const offerOk = () => S.phase === 'day' && S.night >= DAILY_RULES.offerFrom && calmOk() && (!ST().daily || ST().daily.day < S.night)
    && (!S.clock || TIDE.dayLen - (S.dayT || 0) > TIDE.dayLen * DAILY_RULES.dayLeft) && roomForQuest();
  const calmOk = () => calmFor >= DAILY_RULES.calmT;
  return { offer, offerOk, accept, decline, progress, tick, settle, active, calm, calmOk };
}
