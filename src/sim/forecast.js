// Threat estimates for the UI and bots: the threat ratio and its rating, the night's paths (forecast),
// the honest forecast strip ("Hall: safe · ~N buildings at risk"), and region info.
import { HEAT, RATING, STREAM } from './state.js';
import { MOBS, TIDE, WAVES } from '../content/mobs.js';
import { N, idx } from './mapgen.js';

export function createForecast(G) {
  const { S, c, houseCap, isBloodMoon, map } = G;
  /** expected wave HP divided by what the town can deal over the wave window */
  function threatRatio(n = S.night, purgeRegion = S.purge) {
    const hs = G.hpS(n);
    let hp = G.nightBudget(n) * G.hpPerBudget(n) * hs;
    if (isBloodMoon(n)) hp += G.bossesFor(n).reduce((a, k, j) => a + MOBS[k].hp * (j === 0 && S.unique && !S.unique.slain && S.unique.night === n ? S.unique.mult : 1), 0) * hs;
    { const every = Math.max(STREAM.min, STREAM.every - STREAM.drop * n) / G.DIFF.threat; hp += G.marchNests(n).length * (WAVES.duration(n) * STREAM.nightMult / every) * 2.5 * G.hpPerBudget(n) * hs; }   // awake hives keep sending their dead all night
    if (S.feat.heat && S.noise >= HEAT.erupt - 10) hp += (HEAT.burst + n) * G.DIFF.threat * 2.5 * G.hpPerBudget(n) * hs;
    if (purgeRegion !== null && purgeRegion !== undefined) hp += G.purgeBudget(purgeRegion, n) * G.hpPerBudget(n) * hs + MOBS.guardian.hp * hs;
    if (n === S.night) hp += S.mobs.reduce((a, m) => a + (!m.roam && !MOBS[m.kind].animal && (m.hunt || Math.hypot(m.x - c, m.y - c) < 30) ? m.hp : 0), 0);   // the dead already at your walls, or on your trail
    const dealt = (G.defenceDps() + G.heroDps() * 0.8) * WAVES.duration(n) * 1.6;
    return hp / Math.max(1, dealt);
  }
  const ratingOf = ratio => RATING.find(([lim]) => ratio < lim)[1];

  // ---------- forecast: where tonight's dead come from and how they walk ----------
  function tracePath(x, y, climb = false) {
    const next = climb ? S.climbNext : S.flowNext, pts = [[x, y]];
    let i = idx(Math.floor(x), Math.floor(y));
    for (let k = 0; k < 300; k++) { const j = next[i]; if (j < 0) break; pts.push([(j % N) + 0.5, ((j / N) | 0) + 0.5]); i = j; }
    return pts;
  }
  function forecast(n = S.night) {
    if (G.v2) return [];   // [v2] no wave forecast (no waves from nests)
    G.refreshFlow();
    const src = G.nightSources(n), nests = src.nests, w = src.wts;   // the same sources the wave is drawn from (fronts included)
    const u = G.unlocked(n), wsum = u.reduce((a, [, m]) => a + m.weight, 0), avgCost = u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / wsum;
    const total = n === 1 && S.purge === null ? G.N1_COUNT : G.nightBudget(n) / avgCost;
    if (n === 1) { nests.splice(1); if (S.purge === null && nests.length) { const b = G.n1Edge(nests[0]); if (b !== nests[0]) { nests.push(b); w.splice(0, w.length, 1 + TIDE.night1.packA.length, TIDE.night1.packB.length); } } }
    const tw2 = w.slice(0, nests.length).reduce((a, b) => a + b, 0);
    const out = nests.map((r, k) => {
      const p = r < 0 ? G.edgeSpawns[-1 - r] : map.regions[r].nest;
      return { nest: r, x: p.x, y: p.y, count: Math.round(total * w[k] / tw2), siege: false, boss: false, path: tracePath(p.x, p.y) };
    });
    if (S.purge !== null && n === S.night) {
      const p = map.regions[S.purge].nest, extra = Math.round(G.purgeBudget(S.purge, n) / avgCost) + 1;
      const e = out.find(o => o.nest === S.purge);
      if (e) { e.count += extra; e.siege = true; } else out.push({ nest: S.purge, x: p.x, y: p.y, count: extra, siege: true, boss: false, path: tracePath(p.x, p.y) });
    }
    if (isBloodMoon(n) && out.length) out[0].boss = true;
    return out;
  }

  // ---------- the honest forecast: "Hall: safe · ~N buildings at risk · 2 brutes" ----------
  // Calibrated from the Oct 20 sweep logs (12 seeds × 16 nights, tools/sweep.mjs with SWEEP_OUT, 125 nights): the share of
  // standing buildings a night takes is ≈ (ratio − 0.25) × 1.6; last night's losses, grown by tonight's budget, set a
  // floor (mean error 2.2 buildings, was 2.9 and 2.6 low).
  // The Camp's three states, recalibrated on the Oct 20 polish logs (a 12×16 sweep + 12 scripted playtests, 363 nights;
  // safe = the hall held ≥80%, at risk = it held but was hurt, may fall = it fell): safe below 0.7; "may fall" from 1.9,
  // or from 0.8 when last night left the hall under 40%, or from 1.15 under 55%. Agreement 93% (sweep) / 88% (playtests),
  // was 90% / 82%: every fallen hall was called; "may fall" was wrong twice (the hall held, hurt).
  const FORECAST = { r0: 0.25, slope: 1.6, last: 0.85, safe: 0.7, fall: 1.9, hurt: [[0.8, 40], [1.15, 55]] };
  function forecastStrip(n = S.night) {
    const ratio = threatRatio(n), u = G.unlocked(n), wc = u.reduce((a, [, m]) => a + m.weight * m.cost, 0);
    const budget = G.nightBudget(n), every = Math.max(STREAM.min, STREAM.every - STREAM.drop * n) / G.DIFF.threat;
    const stream = n < 5 ? 0 : G.marchNests(n).length * WAVES.duration(n) * STREAM.nightMult / every;
    const bosses = isBloodMoon(n) ? G.bossesFor(n).length : 0;
    const brutes = Math.round((budget + stream * 1.3) * ((MOBS.brute.from <= n ? MOBS.brute.weight : 0) / wc)) + bosses;
    const dead = n === 1 && S.purge === null ? G.N1_COUNT : Math.round(budget / (wc / u.reduce((a, [, m]) => a + m.weight, 0)) + stream + bosses);
    const standing = S.buildings.filter(b => !b.ruined).length;
    const last = S.log.length ? S.log[S.log.length - 1] : null, lastLost = last ? (last.lost || []).length : 0;
    const grow = last && last.night ? G.nightBudget(n) / Math.max(1, G.nightBudget(last.night)) : 1;
    const share = Math.max(0, Math.min(1, (ratio - FORECAST.r0) * FORECAST.slope));
    const atRisk = Math.min(standing, Math.round(Math.max(standing * share, lastLost * grow * FORECAST.last * (ratio > FORECAST.r0 ? 1 : 0.5))));
    const lastHeld = last && last.held !== undefined && last.held !== null ? last.held : 100;
    const hall = ratio < FORECAST.safe ? 'safe' : ratio >= FORECAST.fall || FORECAST.hurt.some(([r, h]) => ratio >= r && lastHeld < h) ? 'fall' : 'risk';
    // crew: towers without their full crew stay silent. Now, and after the homes this night is likely to take.
    const cr = G.crewing(), towersUp = S.buildings.filter(b => b.type === 'tower' && !b.ruined).length, silent = towersUp - cr.manned.size;
    const homes = S.buildings.filter(b => b.type === 'house' && !b.ruined), folk = homes.reduce((a, b) => a + (b.folk ?? houseCap(b)), 0);
    const lossP = standing ? atRisk * (homes.length / standing) * (homes.length ? folk / homes.length : 0) / 2 : 0;
    const perTower = towersUp ? cr.need / towersUp : 1, deficit = cr.need - (cr.people - lossP);
    const short = Math.max(silent, deficit > 0 ? Math.min(towersUp, Math.ceil(deficit / Math.max(1, perTower))) : 0);
    return { hall, atRisk, brutes, dead, ratio: +ratio.toFixed(2), night: n, bloodMoon: isBloodMoon(n), crew: { need: cr.need, people: cr.people, silent, short }, from: fromDirs(n) };
  }

  // ---------- where tonight's dead come from: ['NE', 'S'], most first (short compass words for the strip) ----------
  const SHORT_DIR = { north: 'N', 'north-east': 'NE', east: 'E', 'south-east': 'SE', south: 'S', 'south-west': 'SW', west: 'W', 'north-west': 'NW' };
  function fromDirs(n = S.night) {
    const by = new Map();
    for (const f of forecast(n)) { if (!f.count) continue; const d = SHORT_DIR[G.compass(f.x, f.y)]; by.set(d, (by.get(d) || 0) + f.count); }
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }

  // ---------- queries for UI and bots ----------
  function regionInfo(r) {
    const reg = map.regions[r]; if (!reg) return null;
    const ratio = G.canPurge(r) ? threatRatio(S.night, r) : null;
    return {
      id: r, ring: reg.ring, claimed: S.claimed.has(r), nest: !!reg.nest && S.nestAlive[r], awake: S.wake[r] <= S.night, active: G.activeNests().includes(r),
      needKeep: G.keepForRing(reg.ring), slots: reg.slots.length, forest: reg.forest, water: reg.water, canPurge: G.canPurge(r), ratio, rating: ratio === null ? null : ratingOf(ratio),
      wakes: reg.neighbors.filter(n => map.regions[n].nest && !S.claimed.has(n) && S.wake[n] > S.night).length,
    };
  }
  return { threatRatio, ratingOf, forecast, forecastStrip, fromDirs, regionInfo };
}
