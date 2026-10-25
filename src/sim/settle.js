// [econ3] The dawn Settlement report: at dawn a well-run town pays XP (no one lost, no breach, food to spare, buildings
// finished), shown in the dawn report, so a governor levels too. (Split from the relic finds, which went with the
// blessings on Oct 25.)
import { ECON, SETTLE } from '../content/econ.js';

export function createSettle(G) {
  const { S, ev } = G;
  const E = () => S.econ || (S.econ = {});

  function settleLedger() {
    if (!ECON.settle) return {};
    const l = S.cur || {}, n = l.night || S.night, lines = [];
    const lostPeople = (l.risen || 0) > 0 || (l.rose || []).length > 0 || (l.heroDeaths || 0) > 0;
    if (!lostPeople) lines.push({ id: 'safe', name: SETTLE.safe.name, xp: Math.round(SETTLE.safe.base + SETTLE.safe.per * n) });
    if (!(l.fellB || []).length && !S.nightFlags.breach) lines.push({ id: 'held', name: SETTLE.held.name, xp: Math.round(SETTLE.held.base + SETTLE.held.per * n) });
    if ((l.foodIn || 0) > (l.foodNeed || 0)) lines.push({ id: 'fed', name: SETTLE.fed.name, xp: Math.round(SETTLE.fed.base + SETTLE.fed.per * n), n: l.foodIn - l.foodNeed });
    const done = E().done || 0; E().done = 0;
    if (done) lines.push({ id: 'built', name: SETTLE.built.name, xp: Math.min(SETTLE.built.max, done * SETTLE.built.each), n: done });
    const hauled = 0;   // (the carts' haul: carts were cut on Oct 25; the field stays for the report's shape)
    const xp = lines.reduce((a, x) => a + x.xp, 0);
    if (xp > 0) G.gainXp(xp);
    S.stats.settleXp = (S.stats.settleXp || 0) + xp;
    const settle = { xp, lines, hauled };
    ev('settle', settle);
    return { settle };
  }
  return { settleLedger };
}
