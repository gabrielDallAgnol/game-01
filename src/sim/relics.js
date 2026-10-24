// [econ3] Loot without blessings, and the dawn Settlement report.
// Loot: every pick the old rules hand out (a chest, a burned hive, a level, a story reward) becomes a find instead of
// three blessing cards: a relic (passive: content/relics.js), a stat tome (+1 stat point through G.addStatPoints when
// the hero's stats are in, else a little XP) or a blueprint (a variant for the run). Each find is its own roll from a
// stream seeded by the run and the find's number, so saves and replays agree. ECON.relics off: the blessings return.
// Settlement: at dawn a well-run town pays XP (no one lost, no breach, food to spare, buildings finished), shown in
// the dawn report, so a governor levels too.
import { ECON, SETTLE } from '../content/econ.js';
import { RELICS, TOME, BLUEPRINTS, LOOT } from '../content/relics.js';
import { PERKS } from '../content/perks.js';
import { Rng, hashSeed } from './rng.js';

const ADD = { cartCap: 1, crews: 1, maxCarts: 1 };   // additive mods; the rest multiply

export function createRelics(G) {
  const { S, ev, toast, seed } = G;
  const E = () => S.econ || (S.econ = {});
  const baseRoll = G.rollOffer;   // the blessings' offer (blessings.js), kept for ECON.relics off
  const on = () => ECON.relics;

  function applyEcon(fx) { const m = E().mods || (E().mods = {}); for (const [k, v] of Object.entries(fx)) m[k] = ADD[k] ? (m[k] || 0) + v : (m[k] || 1) * v; }
  function takeRelic(r) {
    const owned = E().relics || (E().relics = []); owned.push(r.id);
    if (r.perk) { const pk = PERKS.find(p => p.id === r.perk); if (pk) { pk.fx(S.P); S.P.taken[pk.id] = (S.P.taken[pk.id] || 0) + 1; G.syncMastery(); } }
    if (r.econ) applyEcon(r.econ);
    G.refreshMax();
    for (const b of S.buildings) { const m = G.maxHpOf(b.type, b.level); if (!b.ruined) b.hp += m - b.maxHp; b.maxHp = m; }
    S.stats.relics = (S.stats.relics || 0) + 1;
  }
  const relicOk = r => !(E().relics || []).includes(r.id) && (!r.perk || G.perkOk(r.perk));
  function find(source) {
    const n = E().rolls = (E().rolls || 0) + 1, rng = new Rng(hashSeed(seed, 'econ-loot', n));
    const L = LOOT[source] || LOOT.chest, out = [];
    let what = ['relic', 'tome', 'blueprint'][rng.weighted(L.what)];
    const bps = BLUEPRINTS.filter(b => !(E().bps || []).includes(b.id));
    if (what === 'blueprint' && !bps.length) what = 'relic';
    if (what === 'relic') {
      let rar = ['c', 'r', 'l'][rng.weighted(L.rarity)], pool = RELICS.filter(r => r.rarity === rar && relicOk(r));
      if (!pool.length) pool = RELICS.filter(relicOk);
      if (pool.length) { const r = pool[rng.int(pool.length)]; takeRelic(r); out.push({ kind: 'relic', id: r.id, name: r.name, desc: r.desc, rarity: r.rarity }); }
      else what = 'tome';
    }
    if (what === 'blueprint') { const b = bps[rng.int(bps.length)]; (E().bps || (E().bps = [])).push(b.id); applyEcon(b.econ); out.push({ kind: 'blueprint', id: b.id, name: b.name, desc: b.desc }); }
    if (what === 'tome' || L.tome) out.push(tome());
    for (const f of out) {
      ev('relic', f);
      toast(f.kind === 'tome' ? `[Stat Tome] **+1 stat point**${G.addStatPoints ? '' : ` (+${TOME.xp} XP)`}.` : `[${f.kind === 'blueprint' ? 'Blueprint' : f.rarity === 'l' ? 'Legendary relic' : 'Relic'}] **${f.name}**: ${f.desc}`, f.rarity === 'l' ? 'win' : 'good');
    }
    return out;
  }
  function tome() {
    E().tomes = (E().tomes || 0) + 1;
    if (G.addStatPoints) G.addStatPoints(1, 'tome'); else G.gainXp(TOME.xp);
    return { kind: 'tome', id: 'tome', name: TOME.name, desc: TOME.desc };
  }
  /** replaces the blessings' offer: every pick waiting becomes a find (ECON.relics off: the old offer) */
  function rollOffer() {
    if (!on()) return baseRoll();
    let guard = 0;
    while (S.picks.length && guard++ < 20) { const src = S.picks.shift(); if (String(src).startsWith('mastery:')) continue; find(src === 'nest' ? 'nest' : src === 'dawn' ? 'dawn' : 'chest'); }
    S.offer = []; S.offerSource = null; G.syncPicks();
  }

  // ---------- the dawn Settlement report ----------
  function settleLedger() {
    if (!ECON.settle) return {};
    const l = S.cur || {}, n = l.night || S.night, lines = [];
    const lostPeople = (l.risen || 0) > 0 || (l.rose || []).length > 0 || (l.heroDeaths || 0) > 0;
    if (!lostPeople) lines.push({ id: 'safe', name: SETTLE.safe.name, xp: Math.round(SETTLE.safe.base + SETTLE.safe.per * n) });
    if (!(l.fellB || []).length && !S.nightFlags.breach) lines.push({ id: 'held', name: SETTLE.held.name, xp: Math.round(SETTLE.held.base + SETTLE.held.per * n) });
    if ((l.foodIn || 0) > (l.foodNeed || 0)) lines.push({ id: 'fed', name: SETTLE.fed.name, xp: Math.round(SETTLE.fed.base + SETTLE.fed.per * n), n: l.foodIn - l.foodNeed });
    const done = E().done || 0; E().done = 0;
    if (done) lines.push({ id: 'built', name: SETTLE.built.name, xp: Math.min(SETTLE.built.max, done * SETTLE.built.each), n: done });
    const hauled = G.haulDawn ? G.haulDawn() : 0;
    const xp = lines.reduce((a, x) => a + x.xp, 0);
    if (xp > 0) G.gainXp(xp);
    S.stats.settleXp = (S.stats.settleXp || 0) + xp;
    const settle = { xp, lines, hauled };
    ev('settle', settle);
    return { settle };
  }
  return { rollOffer, relicFind: find, settleLedger, relicsInfo: () => ({ relics: (E().relics || []).map(id => RELICS.find(r => r.id === id)).filter(Boolean), tomes: E().tomes || 0, blueprints: (E().bps || []).map(id => BLUEPRINTS.find(b => b.id === id)).filter(Boolean) }) };
}
