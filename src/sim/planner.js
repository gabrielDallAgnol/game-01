// Town builders: for the fighting heroes the town grows by itself while you fight.
// You pick a focus (defence, growth or balanced); every few seconds of daylight the builders take one step:
// place a building from your packs or buy one, or upgrade one, as gold, food and crew allow.
// Pure sim: deterministic, uses only the public game API.
import { N, T, idx } from './mapgen.js';
import { UNLOCKS as UNL, BUILDINGS } from '../content/buildings.js';
import { SPEC_ORDER } from '../content/towers.js';

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
    else score = p => dKeep(p) - Math.min(dRoute(p, pts), 6) * 0.5;                                     // homes: a compact town
    cands.sort((a, b) => score(a) - score(b));
    for (const p of cands.slice(0, 6)) if (g.build(type, p.x, p.y)) return true;
    return false;
  }
  function wallLine() {
    // try each route in: where it crosses 6–11 cells from the keep, a line of up to 5 posts across it
    for (const f of g.forecast()) for (const p of f.path) {
      const d = Math.hypot(p[0] - town.x, p[1] - town.y); if (d < 6 || d > 11) continue;
      const k = f.path.indexOf(p), q = f.path[Math.max(0, k - 2)], dx = p[0] - q[0], dy = p[1] - q[1];
      const [x, y] = [Math.floor(p[0]), Math.floor(p[1])];
      const along = Math.abs(dx) < Math.abs(dy) ? [[x - 2, y, x + 2, y]] : [[x, y - 2, x, y + 2]];
      for (const [x0, y0, x1, y1] of along) if (g.buildLine(x0 + 0.5, y0 + 0.5, x1 + 0.5, y1 + 0.5, 5) > 0) return true;
    }
    return false;
  }
  let saving = 0, savePlan = null;   // what the builders bank for, and which plan asked
  let short = 0;   // the scrap the step the builders are saving for still needs (0: nothing is held up by scrap alone)
  const lack = n => { if (S.gold >= n) return false; short = Math.max(short, n); return true; };
  function tech(type) { if (S.buildings.some(b => b.type === type) || g.keepLevel() < 2 || lack(g.buyCost(type) + RESERVE + 4)) return false; return place(type); }
  const can = type => (S.stock[type] || 0) > 0 || !lack(g.buyCost(type) + RESERVE);
  function upgradeOne(type) {
    const cap = Math.min(3, g.keepLevel());
    const cands = S.buildings.filter(x => x.type === type && !x.ruined && x.level < cap && !(x.level === 2 && UNL[type] && !g.hasTech(UNL[type])) && !x.cq && !((S.econ && S.econ.q) || []).some(j => j.bid === x.id))   /* [econ3] not one still in the queue */.sort((a, c) => a.level - c.level || a.id - c.id), b = cands[0];
    if (!b) return false;
    if (type === 'tower' && g.crewing().free < 1) return false;
    if (lack(g.upCostOf(b) + RESERVE)) return false;
    return g.upgrade(b.id);
  }
  function keepUp() { const K = g.keepCost && g.keepCost(); if (!K || K.needs.length || !S.buildings.some(b => b.level >= g.keepLevel())) return false; if (lack(K.scrap)) return false; return g.upgradeKeep(); }

  const ACT = {
    farm: () => can('farm') && place('farm'),
    house: () => (g.foodPerDawn() - g.foodNeed() >= 2 ? can('house') && place('house') : ACT.farm()),   // feed them first
    tower: () => g.crewing().free >= 1 && can('tower') && place('tower'),
    wall: () => !(g.cut && g.cut.walls) && S.night >= 3 && ((S.stock.wall || 0) >= 3 || S.gold >= 5 * g.buyCost('wall') + RESERVE + 4) && wallLine(),
    upTower: () => upgradeOne('tower'),
    upHouse: () => upgradeOne('house'),
    keep: () => keepUp(),
    // ruins first: a ruined tower or home is the cheapest strength the town can buy back (half its cost)
    rebuild: () => { if (S.phase !== 'day' || !g.ruins) return false; const r = g.ruins().find(x => x.type !== 'wall' && S.gold >= x.cost + RESERVE) || g.ruins().find(x => S.gold >= x.cost + RESERVE); return !!(r && g.rebuild(r.id)); },
    workshop: () => tech('workshop'),
    market: () => tech('market'),
  };
  // the keep comes first once the town needs it (level 2 from night 3, level 3 from night 7);
  // towers: enough of them for the night, then make them better instead of more
  ACT.keepEarly = () => g.keepLevel() < 3 && !g.keepNeeds().length && ACT.keep();   // as soon as the town has earned it
  // work toward the next hall: the people and the food income it asks for
  const wantTowers = () => Math.min(12, 2 + Math.ceil(S.night * 0.6));
  ACT.keepPush = () => {
    if (g.keepLevel() >= 3) return false;
    if (S.buildings.filter(b => b.type === 'tower' && !b.ruined).length < wantTowers() - 1) return false;   // never at the cost of tonight's defence
    const need = g.keepNeeds().join(' ');
    if (/food income/.test(need) && ACT.farm()) return true;
    if (/people/.test(need) && g.foodPerDawn() - g.foodNeed() >= 1 && can('house') && place('house')) return true;
    return false;
  };
  // towers: a few for coverage, then whatever buys the most damage per scrap (a new tower, or the cheapest upgrade)
  const TD = l => BUILDINGS.tower.dmg[l - 1] / BUILDINGS.tower.rate[l - 1];
  ACT.defend = () => {
    const towers = S.buildings.filter(b => b.type === 'tower' && !b.ruined), n = towers.length, want = wantTowers();
    if (n < Math.min(want, 3)) return ACT.tower() || ACT.upTower();
    if (g.crewing().free < 1 && ACT.spec()) return true;   // [towers] short of people: make the manned towers better
    if (n >= want) return ACT.spec() || ACT.upTower() || ACT.tower();   // [towers] enough towers: a role before another level
    const up = towers.filter(b => !(g.raiseBlock && g.raiseBlock(b.id))).sort((a, c) => a.level - c.level || a.id - c.id)[0];
    const newV = TD(1) / g.buyCost('tower'), upV = up ? (TD(up.level + 1) - TD(up.level)) / g.upCostOf(up) : 0;
    return upV >= newV ? ACT.upTower() || ACT.tower() : ACT.tower() || ACT.upTower();
  };
  // [towers] begin: a level 3 tower takes a role (no extra crew: the way to grow when the people run short).
  // The mix the builders aim for: mostly mortars for the crowds, then braziers, ballistas for brutes, a bell or two.
  const SPEC_MIX = { mortar: 0.4, brazier: 0.25, ballista: 0.2, bell: 0.15 };
  ACT.spec = () => {
    if (!g.specialise || S.gold < g.specCost() + RESERVE) return false;
    const towers = S.buildings.filter(b => b.type === 'tower' && !b.ruined), b = towers.filter(x => x.level >= 3 && !x.spec).sort((p, q) => p.id - q.id)[0];
    if (!b) return false;
    const n = towers.filter(x => x.spec).length + 1, have = r => towers.filter(x => x.spec === r).length;
    const role = SPEC_ORDER.reduce((a, r) => (SPEC_MIX[r] * n - have(r) > SPEC_MIX[a] * n - have(a) ? r : a), SPEC_ORDER[0]);
    return g.specialise(b.id, role);
  };
  // [towers] end
  const PLAN = {
    defence: ['keepEarly', 'keepPush', 'defend', 'workshop', 'wall', 'house', 'upHouse'],
    growth: ['keepEarly', 'keepPush', 'house', 'upHouse', 'market', 'defend', 'wall'],
  };

  function stepOnce() {
    const focus = S.builders; if (!focus || focus === 'off') return false;   // autopilot turns the builders on
    const net = g.foodPerDawn() - g.foodNeed();
    if ((net < 0 || (net < 1 && S.food < 4)) && ACT.farm()) return true;
    if (ACT.rebuild()) return true;
    // [income] scrap comes by the second, not in a dawn lump: the first step on the list that only lacks scrap is saved
    // for (the builders bank until it is paid, and that plan gets the first go at the purse), instead of the cheaper
    // steps below it, or the other plan, eating every trickle
    if (saving && S.gold < saving) return false;
    const list = saving && savePlan ? PLAN[savePlan] : focus === 'balanced' ? PLAN[(flip = !flip) ? 'defence' : 'growth'] : PLAN[focus];
    short = 0; let ok = false;
    for (const a of list) { if (ACT[a]()) { ok = true; break; } if (short) break; }
    saving = short; savePlan = short ? (list === PLAN.defence ? 'defence' : 'growth') : null;
    return ok;
    return false;
  }
  function tick(dt) {
    if (S.over || S.pendingPicks > 0 || S.packs.length) return;
    t += dt; if (t < EVERY) return; t = 0;
    S.quiet = true; let ok = false;
    try { ok = stepOnce(); } finally { S.quiet = false; }
    if (ok) S.stats.builderSteps = (S.stats.builderSteps || 0) + 1;
  }
  return { tick, stepOnce, place, upgradeOne, wallLine };
}
