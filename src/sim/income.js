// Income as a trickle: scrap and food come in every second of the day (and, slower, of the night), not in one lump
// at dawn. Oct 20 (Gabriel): "make it scrap x/second and food x/second". The day's total is the same as the old dawn
// pay: every rate is (what a whole day and night used to pay) / (the cycle's weighted length), so a longer day pays
// the same per cycle, only spread out. People eat the same way (food is a net rate). With the store empty and the net
// negative, homes earn by how well they are fed (the old dawn rule, now live).
// A day cut short (bots and tests skip to dusk) pays the rest of its share at dusk; the cycle is closed at dawn
// (economy.dawn reads incomeDawn() for the ledger). Events: 'trickle' { k: 'scrap'|'food', id } now and then, so a
// home or a farm can float a small "+1".
import { BUILDINGS, START } from '../content/buildings.js';
import { TIDE } from '../content/mobs.js';
import { LANDMARKS } from './mapgen.js';

export function createIncome(G) {
  const { S, ev, has, owns } = G;
  const NIGHT_W = TIDE.nightIncome;
  const fresh = () => ({ g: 0, f: 0, dayAcc: 0, nightAcc: 0, ph: S.phase, made: 0, ate: 0, gold: 0, fedW: 0, w: 0, rr: 0, tickG: 0, tickF: 0 });
  const I = () => S.inc || (S.inc = fresh());
  /** seconds of day this cycle (day 1 is short; with no clock the day is whatever the player makes it: paid at dusk) */
  const dayLenNow = () => (S.night === 1 ? TIDE.dayOne : TIDE.dayLen);
  const cycleLen = () => dayLenNow() + NIGHT_W * G.nightLen();
  const storyFood = () => (G.story ? (S.story.garden || 0) + (S.story.flags.garden ? 1 : 0) + G.story.bonus.food() : 0);
  const storyGold = () => (G.story ? G.story.bonus.gold() : 0);
  /** what a whole day and night bring in, at today's buildings (the old dawn pay, before the store is touched) */
  function perCycle() {
    const pr = G.prosper();
    let made = 0, hg = 0;
    for (const b of S.buildings) { if (b.ruined || b.built < 1) continue;   // [econ3] still going up: no pay, no food
      if (b.type === 'farm') made += G.farmFood(b); if (b.type === 'house') hg += G.houseGold(b); }
    made = Math.round(made * pr * G.W8().food) + S.landmarks.reduce((a, l) => a + (l.owned ? LANDMARKS[l.kind].food || 0 : 0), 0) + (G.HC.quarter ? 2 : 0) + storyFood();
    const need = G.foodNeed(), fed = S.food > 0 || made >= need || need === 0 ? 1 : made / need;
    const tk = G.trickleK ? G.trickleK() : { base: 1, house: 1 };   // [econ3] the carts haul most of the scrap now
    let gold = Math.round((START.baseIncome * G.DIFF.eco * tk.base + S.P.tax + hg * tk.house * fed) * pr) - G.upkeep() + storyGold();
    if (has('granary')) gold += Math.floor(S.food / 5);
    for (const l of S.landmarks) if (l.owned) gold += LANDMARKS[l.kind].gold || 0;
    if (owns('tvtower')) gold += 3;
    if (G.HC.quarter) gold += 4;
    return { gold, made, need, fed };
  }
  let cache = null, cacheT = -1;
  /** per weighted second (a day second weighs 1, a night second NIGHT_W): re-read four times a second */
  function rates() {
    if (cache && S.time - cacheT < 0.25) return cache;
    const p = perCycle(), L = cycleLen();
    cache = { gold: p.gold / L, food: (p.made - p.need) / L, made: p.made / L, ate: p.need / L, fed: p.fed, cycle: p };
    cacheT = S.time; return cache;
  }
  const homes = type => S.buildings.filter(b => b.type === type && !b.ruined && b.built >= 1);
  function tick(k) {
    const st = I(), list = homes(k === 'scrap' ? 'house' : 'farm');
    // one small "+1" every few units, over a home or a farm in turn (the keep when there is none)
    if (k === 'scrap' ? ++st.tickG % 2 : ++st.tickF % 2) return;
    const b = list.length ? list[st.rr++ % list.length] : null;
    ev('trickle', { k, id: b ? b.id : 0 });
  }
  function accrue(w) {
    if (w <= 0) return;
    const st = I(), r = rates();
    st.g += r.gold * w; st.f += r.food * w; st.made += r.made * w; st.ate += r.ate * w; st.fedW += r.fed * w; st.w += w;
    while (st.g >= 1) { st.g -= 1; S.gold += 1; S.stats.goldEarned += 1; st.gold += 1; tick('scrap'); }
    while (st.g <= -1) { st.g += 1; if (S.gold > 0) S.gold -= 1; st.gold -= 1; }
    while (st.f >= 1) { st.f -= 1; S.food += 1; tick('food'); }
    while (st.f <= -1) { st.f += 1; if (S.food > 0) S.food -= 1; }
  }
  /** every step: the day's share by day (up to the day's length), the night's share by night */
  function stepIncome(dt) {
    if (S.over) return;
    const st = I(), day = S.phase === 'day';
    if (!day && st.ph === 'day') { accrue(Math.max(0, dayLenNow() - st.dayAcc)); st.dayAcc = dayLenNow(); }   // dusk came early: the rest of the day's share now
    st.ph = S.phase;
    if (day) { if (!S.clock) return; const a = Math.min(dt, Math.max(0, dayLenNow() - st.dayAcc)); st.dayAcc += a; accrue(a); }
    else if (S.phase === 'night') { const a = Math.min(dt, Math.max(0, G.nightLen() - st.nightAcc)); st.nightAcc += a; accrue(a * NIGHT_W); }
  }
  /** dawn: close the cycle (the night's last share, if any) and hand the ledger what came in; then a fresh cycle */
  function incomeDawn() {
    const st = I();
    if (st.ph === 'day') { accrue(Math.max(0, dayLenNow() - st.dayAcc)); st.dayAcc = dayLenNow(); }
    accrue(NIGHT_W * Math.max(0, G.nightLen() - st.nightAcc));
    const out = { gold: st.gold, food: Math.round(st.made), ate: Math.round(st.ate), fed: st.w ? Math.min(1, st.fedW / st.w) : 1 };
    S.inc = { ...fresh(), g: st.g, f: st.f, rr: st.rr, tickG: st.tickG, tickF: st.tickF, ph: 'day' };
    cache = null;
    return out;
  }
  /** the HUD: per second right now (day or night), and per whole day for the forecast */
  function incomeRate() {
    const r = rates(), k = S.phase === 'night' ? NIGHT_W : 1;
    return { gold: r.gold * k + (G.cartRate ? G.cartRate() : 0) /* [econ3] the carts' haul */, food: r.food * k, made: r.made * k, ate: r.ate * k, perDay: { gold: r.cycle.gold, food: r.cycle.made - r.cycle.need }, night: S.phase === 'night' };
  }
  return { stepIncome, incomeDawn, incomeRate, incomePerCycle: perCycle };
}
