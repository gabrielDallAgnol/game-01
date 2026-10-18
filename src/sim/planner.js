// Town builders: for the fighting heroes the town grows by itself while you fight.
// You pick a focus (defence, growth or balanced); every few seconds of daylight the builders take one step:
// place a building from your packs or buy one, or upgrade one, as gold, food and crew allow.
// Pure sim: deterministic, uses only the public game API.
import { N, T, idx } from './mapgen.js';

export const FOCI = ['defence', 'balanced', 'growth', 'off'];
const EVERY = 3;        // seconds between builder steps
const RESERVE = 4;      // gold the builders leave in the chest

export function createPlanner(g) {
  const S = g.state, map = g.map, town = map.town;
  let t = 0, flip = false;

  // candidate spots: a 3-cell grid over your land (homes and farms are 2×2 with a street, towers 1×1)
  function spots() {
    const out = [], ox = Math.floor(town.x), oy = Math.floor(town.y);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if ((x - ox) % 3 || (y - oy) % 3) continue;
      const i = idx(x, y), r = map.region[i]; if (r < 0 || !g.zone()[i]) continue;
      const tt = map.terrain[i]; if (tt !== T.GRASS && tt !== T.DIRT) continue;
      out.push({ x: x + 0.5, y: y + 0.5 });
    }
    return out;
  }
  function routePts() { const pts = []; for (const f of g.forecast()) for (let k = 0; k < f.path.length; k += 2) pts.push(f.path[k]); return pts; }
  const dRoute = (p, pts) => { let d = 1e9; for (const q of pts) { const e = Math.hypot(q[0] - p.x, q[1] - p.y); if (e < d) d = e; } return d; };
  const dKeep = p => Math.hypot(p.x - town.x, p.y - town.y);

  function place(type) {
    const pts = routePts(), cands = spots().filter(p => g.canPlace(type, p.x, p.y).ok);
    if (!cands.length) return false;
    let score;
    if (type === 'tower') score = p => dRoute(p, pts) * 1.0 + Math.abs(dKeep(p) - 6) * 0.35;           // on the way in, not too far out
    else if (type === 'farm') score = p => dKeep(p) * 0.5 - Math.min(dRoute(p, pts), 8) * 0.6;          // out of the dead's way
    else if (type === 'generator') score = p => dKeep(p) * 0.6 - Math.min(dRoute(p, pts), 8) * 0.4;   // loud: behind the town, off the routes
    else score = p => dKeep(p) - Math.min(dRoute(p, pts), 6) * 0.5;                                     // homes: a compact town
    cands.sort((a, b) => score(a) - score(b));
    for (const p of cands.slice(0, 6)) if (g.build(type, p.x, p.y)) return true;
    return false;
  }
  function wallLine() {
    const f = g.forecast()[0]; if (!f) return false;
    // where the route crosses ~7 cells from the keep, a short line across it
    const p = f.path.find(q => Math.hypot(q[0] - town.x, q[1] - town.y) < 7.5); if (!p) return false;
    const k = f.path.indexOf(p), q = f.path[Math.max(0, k - 2)], dx = p[0] - q[0], dy = p[1] - q[1];
    const horiz = Math.abs(dx) < Math.abs(dy);   // route runs north-south: lay the line east-west
    const [x, y] = [Math.floor(p[0]), Math.floor(p[1])];
    return (horiz ? g.buildLine(x - 2, y, x + 2, y, 5) : g.buildLine(x, y - 2, x, y + 2, 5)) > 0;
  }
  function tech(type) { if (S.buildings.some(b => b.type === type) || g.keepLevel() < 2 || S.gold < g.buyCost(type) + RESERVE + 4) return false; return place(type); }
  const can = type => (S.stock[type] || 0) > 0 || S.gold >= g.buyCost(type) + RESERVE;
  function upgradeOne(type) {
    const cap = Math.min(3, g.keepLevel());
    const b = S.buildings.filter(x => x.type === type && !x.ruined && x.level < cap).sort((a, c) => a.level - c.level || a.id - c.id)[0];
    if (!b || S.gold < g.upCostOf(b) + RESERVE) return false;
    if (type === 'tower' && g.crewing().free < 1) return false;
    if (type === 'tower' && g.powerIn() - g.powerOut() < 1) return ACT.power();   // never upgrade into a blackout
    return g.upgrade(b.id);
  }
  function keepUp() { return g.keepLevel() < 3 && S.buildings.some(b => b.level >= g.keepLevel()) && g.upgradeKeep(); }

  const ACT = {
    farm: () => can('farm') && place('farm'),
    house: () => (g.foodPerDawn() - g.foodNeed() >= 2 ? can('house') && place('house') : ACT.farm()),   // feed them first
    tower: () => g.crewing().free >= 1 && can('tower') && place('tower'),
    wall: () => (S.stock.wall || 0) >= 3 && wallLine(),
    upTower: () => upgradeOne('tower'),
    upHouse: () => upgradeOne('house'),
    keep: () => keepUp(),
    power: () => can('generator') && place('generator'),
    workshop: () => tech('workshop'),
    market: () => tech('market'),
  };
  // the keep comes first once the town needs it (level 2 from night 3, level 3 from night 7);
  // towers: enough of them for the night, then make them better instead of more
  ACT.keepEarly = () => ((g.keepLevel() < 2 && S.night >= 3) || (g.keepLevel() < 3 && S.night >= 7)) && ACT.keep();
  ACT.defend = () => { const n = S.buildings.filter(b => b.type === 'tower').length, want = Math.min(12, 2 + Math.ceil(S.night * 0.6)); return n < want ? ACT.tower() || ACT.upTower() : ACT.upTower() || ACT.tower(); };
  const PLAN = {
    defence: ['keepEarly', 'defend', 'workshop', 'wall', 'house', 'upHouse'],
    growth: ['keepEarly', 'house', 'upHouse', 'market', 'defend', 'wall'],
  };

  function stepOnce() {
    const focus = S.builders; if (!focus || focus === 'off') return false;   // autopilot turns the builders on
    const net = g.foodPerDawn() - g.foodNeed();
    if ((net < 0 || (net < 1 && S.food < 4)) && ACT.farm()) return true;
    if (S.blackout && ACT.power()) return true;
    const list = focus === 'balanced' ? PLAN[(flip = !flip) ? 'defence' : 'growth'] : PLAN[focus];
    for (const a of list) if (ACT[a]()) return true;
    return false;
  }
  function tick(dt) {
    if (S.phase !== 'day' || S.over || S.pendingPicks > 0 || S.packs.length) return;
    t += dt; if (t < EVERY) return; t = 0;
    S.quiet = true; let ok = false;
    try { ok = stepOnce(); } finally { S.quiet = false; }
    if (ok) S.stats.builderSteps = (S.stats.builderSteps || 0) + 1;
  }
  return { tick, stepOnce };
}
