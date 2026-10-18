// Scripted players. They use only the public game API, the same one the UI uses.
import { MOBS } from '../src/content/mobs.js';

export const STRATEGIES = {
  // what to buy, in priority order, while gold allows
  balanced: night => ['food', 'tower', 'house', 'house', 'upTower', 'farm', 'wall', 'upHouse', 'keep'],
  towers:   night => ['food', 'tower', 'upTower', 'house', 'keep', 'wall'],
  economy:  night => (night <= 4 ? ['food', 'house', 'house', 'upHouse', 'tower'] : ['food', 'tower', 'upTower', 'keep', 'house', 'upHouse', 'wall']),
  walls:    night => ['food', 'wall', 'tower', 'house', 'upWall', 'upTower', 'keep'],
};
// when to march on a nest
export const EXPANSION = {
  never:   () => null,
  careful: (g, n) => pickPurge(g, n, ['Easy']),
  bold:    (g, n) => pickPurge(g, n, ['Easy', 'Medium']),
  reckless:(g, n) => pickPurge(g, n, ['Easy', 'Medium', 'Hard', 'Impossible']),
};
const PERK_PATHS = ['hero', 'bow', 'stone', 'harvest', 'any'];
export { PERK_PATHS };

function pickPurge(g, n, ok) {
  if (n < 3) return null;
  const S = g.state;
  const opts = g.map.regions.map(r => g.regionInfo(r.id)).filter(i => i && i.canPurge && ok.includes(i.rating));
  if (!opts.length) return null;
  opts.sort((a, b) => a.ratio - b.ratio || b.slots - a.slots);
  // only expand when the town is mostly built
  const free = g.map.slots.filter(s => S.claimed.has(s.region) && S.slotB[s.id] < 0).length;
  return free <= 3 ? opts[0].id : null;
}

function nestPoints(g) { return g.activeNests(g.state.night + 1).concat(g.activeNests()).map(r => g.map.regions[r].nest); }

function slotFor(g, kind) {
  const S = g.state, map = g.map;
  const def = kind === 'tower' || kind === 'wall';
  const free = map.slots.filter(s => S.claimed.has(s.region) && S.slotB[s.id] < 0 && (def || !s.gate));
  if (!free.length) return null;
  if (kind === 'wall') { const gate = free.find(s => s.gate); if (gate) return gate; }
  const nests = nestPoints(g);
  const near = s => nests.length ? Math.min(...nests.map(n => Math.hypot(n.x - s.x, n.y - s.y))) : Math.hypot(s.x - map.town.x, s.y - map.town.y);
  const town = s => Math.hypot(s.x - map.town.x, s.y - map.town.y);
  let order;
  if (kind === 'tower') order = free.sort((a, b) => (near(a) + town(a) * 0.6) - (near(b) + town(b) * 0.6));
  else if (kind === 'wall') order = free.sort((a, b) => near(a) - near(b));
  else if (kind === 'farm') order = free.sort((a, b) => (b.nearWater - a.nearWater) || (near(b) - near(a)));
  else order = free.sort((a, b) => near(b) - near(a));
  return order[0];
}

export function dayTurn(g, strat) {
  // walk the shopping list round-robin, so every item gets its turn instead of the first one eating all the gold
  const S = g.state, list = STRATEGIES[strat](S.night);
  let k = 0, misses = 0;
  while (misses < list.length + 2) {
    const act = list[k % list.length]; k++;
    if (tryAct(g, act)) misses = 0; else misses++;
  }
  // leftovers: upgrade towers and houses, then the keep
  for (let guard = 0; guard < 20; guard++) {
    const b = S.buildings.filter(x => (x.type === 'tower' || x.type === 'house') && x.level < 3).sort((a, c) => a.level - c.level)[0];
    if (!(b && g.upgrade(b.slot)) && !(S.night >= 3 && g.upgradeKeep())) break;
  }
}
function tryAct(g, act) {
  const S = g.state, foodNet = g.foodPerDawn() - g.foodNeed();
  if (act === 'food') { if (foodNet < 1 && S.food < 6) { const s = slotFor(g, 'farm'); return !!(s && g.build(s.id, 'farm')); } return false; }
  if (act === 'keep') return S.night >= 3 && g.upgradeKeep();
  if (act.startsWith('up')) {
    const t = act.slice(2).toLowerCase();
    const b = S.buildings.filter(x => x.type === t && x.level < 3).sort((a, c) => a.level - c.level)[0];
    return !!(b && g.upgrade(b.slot));
  }
  if (act === 'farm' && foodNet > 3) return false;
  if (act === 'house' && foodNet < 0) return false; // do not add mouths you cannot feed
  const s = slotFor(g, act);
  return !!(s && g.build(s.id, act));
}

export function choosePerks(g, path) {
  const S = g.state;
  while (S.pendingPicks > 0 && S.offer.length) {
    let pick = S.offer.find(id => PERK_FAM[id] === path);
    if (!pick) pick = S.offer[0];
    g.choosePerk(pick);
  }
}
const PERK_FAM = {};
import { PERKS } from '../src/content/perks.js';
for (const p of PERKS) PERK_FAM[p.id] = p.fam;

/** steer the hero for one decision tick: fight what threatens the town, else rest at the keep */
export function heroTick(g, mode) {
  const S = g.state, h = S.hero, t = g.map.town;
  if (h.dead) return;
  if (mode === 'idle' || !g.heroDef.attack) {
    // non-fighters still walk over chests
    if (S.chests.length) { const ch = S.chests[0]; g.heroTo(ch.x, ch.y); } else g.heroTo(t.x, t.y + 3.5);
    return;
  }
  const lowHp = h.hp < h.maxHp * 0.3;
  const threats = S.mobs.filter(m => m.rise >= 1 && Math.hypot(m.x - t.x, m.y - t.y) < 16).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y));
  if (lowHp) { g.heroTo(t.x, t.y + 3.5); return; }
  if (threats.length) {
    const m = threats[0], reach = g.heroDef.attack.reach * 0.8, d = Math.hypot(m.x - h.x, m.y - h.y);
    if (d > reach) g.heroTo(m.x, m.y); else g.heroTo(h.x, h.y);
  } else if (S.chests.length) { const ch = S.chests[0]; g.heroTo(ch.x, ch.y); }
  else g.heroTo(t.x, t.y + 3.5);
}

export function playRun(createGame, opts) {
  const { seed, biome, hero, strat, path, expansion, heroMode = 'active', maxNights = 40, mapSeed } = opts;
  const g = createGame({ seed, biome, hero, mapSeed });
  const S = g.state;
  choosePerks(g, path);
  while (!S.over && S.night <= maxNights) {
    dayTurn(g, strat);
    const target = EXPANSION[expansion](g, S.night);
    if (target !== null) { g.planPurge(target); dayTurn(g, strat); }
    // walk over any chests lying around before the bell
    if (S.chests.length && heroMode === 'active') { for (let k = 0; k < 600 && S.chests.length; k++) { g.heroTo(S.chests[0].x, S.chests[0].y); g.step(); } choosePerks(g, path); }
    g.startNight();
    let steps = 0;
    while (S.phase === 'night' && steps < 60 * 400) { if (steps % 15 === 0) heroTick(g, heroMode); g.step(); steps++; }
    if (S.phase === 'night') break; // stuck night: report as is
    S.events.length = 0;
    choosePerks(g, path);
  }
  return { nights: S.over ? S.night - 1 : S.night - 1, over: S.over, log: S.log, claimed: S.claimed.size };
}
