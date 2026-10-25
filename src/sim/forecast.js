// Tonight's march for the UI: the marching horde (sim/hordes.js hordeMarch) and the route it walks (traced down the
// flow field), drawn by render/view/routes.js; and region info. (The old threat ratio, rating and forecast strip were
// cut with the old waves on Oct 25.)
import { N, idx } from './mapgen.js';

export function createForecast(G) {
  const { S, map } = G;
  // ---------- forecast: where tonight's dead come from and how they walk ----------
  function tracePath(x, y, climb = false) {
    const next = climb ? S.climbNext : S.flowNext, pts = [[x, y]];
    let i = idx(Math.floor(x), Math.floor(y));
    for (let k = 0; k < 300; k++) { const j = next[i]; if (j < 0) break; pts.push([(j % N) + 0.5, ((j / N) | 0) + 0.5]); i = j; }
    return pts;
  }
  /** the marching horde's route, if one marches tonight: [{ nest, x, y, count, siege, boss, path }] */
  function forecast(n = S.night) {
    return (G.hordeMarch ? G.hordeMarch(n) : []).map(h => ({ nest: h.nest, x: h.x, y: h.y, count: h.count, siege: false, boss: false, path: (G.refreshFlow(), tracePath(h.x, h.y)) }));
  }
  // ---------- queries for UI and bots ----------
  function regionInfo(r) {
    const reg = map.regions[r]; if (!reg) return null;
    return {
      id: r, ring: reg.ring, claimed: S.claimed.has(r), nest: !!reg.nest && S.nestAlive[r], awake: S.wake[r] <= S.night, active: G.activeNests().includes(r),
      needKeep: G.keepForRing(reg.ring), slots: reg.slots.length, forest: reg.forest, water: reg.water,
    };
  }
  return { forecast, regionInfo };
}
