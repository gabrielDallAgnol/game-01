// Scripted players. They use only the public game API, the same one the UI uses.
import { MOBS } from '../src/content/mobs.js';

export const STRATEGIES = {
  // what to buy, in priority order, while gold allows
  balanced: night => ['food', 'tower', 'house', 'house', 'upTower', 'farm', 'wall', 'upHouse', 'keep'],
  towers:   night => ['food', 'tower', 'upTower', 'house', 'keep', 'wall'],
  economy:  night => (night <= 4 ? ['food', 'house', 'house', 'upHouse', 'tower'] : ['food', 'tower', 'upTower', 'keep', 'house', 'upHouse', 'wall']),
  walls:    night => ['food', 'wall', 'tower', 'house', 'upWall', 'upTower', 'keep'],
};
function nestPoints(g) { return g.activeNests(g.state.night + 1).concat(g.activeNests()).map(r => g.map.regions[r].nest); }

// candidate spots = the map's suggested lots (gates, a 4-cell street grid) plus a denser 3-cell grid,
// which is how tightly a player can pack 2×2 homes with a one-cell street between them
const denseCache = new WeakMap();
function candidates(g) {
  const S = g.state, map = g.map; g.zone(); const key = S.zoneVersion;
  const c = denseCache.get(g); if (c && c.key === key) return c.list;
  const list = map.slots.slice(), N = Math.sqrt(map.terrain.length), seen = new Set(list.map(s => Math.floor(s.x) + ',' + Math.floor(s.y)));
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    if ((x - Math.floor(map.town.x)) % 3 || (y - Math.floor(map.town.y)) % 3) continue;
    const r = map.region[y * N + x]; if (r < 0 || !g.zone()[y * N + x] || seen.has(x + ',' + y)) continue;
    list.push({ x: x + 0.5, y: y + 0.5, region: r, gate: false, nearWater: false });
  }
  denseCache.set(g, { key, list });
  return list;
}
function spotFor(g, kind) {
  const S = g.state, map = g.map;
  const def = kind === 'tower' || kind === 'wall';
  const fits = s => { if (!g.inZone(s.x, s.y) || (s.gate && !def)) return null; for (const rot of kind === 'wall' ? [gateRot(g, s), 0, 1, 2, 3] : [0]) { const p = g.canPlace(kind, s.x, s.y, rot); if (p.ok) return { x: s.x, y: s.y, rot, gate: s.gate, nearWater: s.nearWater }; } return null; };
  const free = candidates(g).map(fits).filter(Boolean);
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
function gateRot(g, s) { const a = Math.atan2(s.y - g.map.town.y, s.x - g.map.town.x), q = ((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4; return [1, 3, 0, 2][q]; }
// palisades: a short line of posts across the way to the keep, centred on the chosen spot
const WALL_DIR = [[1, 0], [0, 1], [1, 1], [1, -1]];
const place = (g, kind) => {
  const s = spotFor(g, kind); if (!s) return false;
  if (kind !== 'wall') return !!g.build(kind, s.x, s.y, s.rot);
  const [dx, dy] = WALL_DIR[s.rot || 0], half = s.rot >= 2 ? 1 : 2;
  return g.buildLine(s.x - dx * half, s.y - dy * half, s.x + dx * half, s.y + dy * half, 5) > 0;
};

export function dayTurn(g, strat) {
  choosePack(g, strat);
  // walk the shopping list round-robin, so every item gets its turn instead of the first one eating all the gold
  const S = g.state, list = STRATEGIES[strat](S.night);
  for (const t of ['house', 'farm', 'tower', 'wall']) for (let k = 0; k < (t === 'wall' ? 12 : 6) && (S.stock[t] || 0) > 0; k++) { if (t === 'tower' && g.crewing().free < 1) break; if (!place(g, t)) break; }
  let k = 0, misses = 0;
  while (misses < list.length + 2) {
    const act = list[k % list.length]; k++;
    if (tryAct(g, act)) misses = 0; else misses++;
  }
  // leftovers: upgrade towers and houses, then the keep
  for (let guard = 0; guard < 20; guard++) {
    const b = S.buildings.filter(x => (x.type === 'tower' ? g.crewing().free >= 1 : x.type === 'house') && x.level < Math.min(3, g.keepLevel())).sort((a, c) => a.level - c.level)[0];
    if (!(b && g.upgrade(b.id)) && !(S.night >= 2 && g.upgradeKeep())) break;
  }
}
function tryAct(g, act) {
  const S = g.state, foodNet = g.foodPerDawn() - g.foodNeed();
  if (act === 'food') { if (foodNet < 1 && S.food < 6) return place(g, 'farm'); return false; }
  if (act === 'keep') return S.night >= 3 && g.upgradeKeep();
  if (act.startsWith('up')) {
    const t = act.slice(2).toLowerCase();
    const b = S.buildings.filter(x => x.type === t && x.level < 3).sort((a, c) => a.level - c.level)[0];
    if (b && t === 'wall') return g.upgradeWall(b.id) > 0;
    if (b && t === 'tower' && g.crewing().free < 1) return false;
    return !!(b && g.upgrade(b.id));
  }
  if (act === 'farm' && foodNet > 3) return false;
  if (act === 'house' && foodNet < 0) return false; // do not add mouths you cannot feed
  if (act === 'tower' && g.crewing().free < 1) return foodNet >= 0 ? place(g, 'house') : place(g, 'farm');   // no one to man it: build homes first
  return place(g, act);
}

import { PACKS } from '../src/content/packs.js';
export function choosePack(g, strat) {
  const S = g.state; if (!S.packs.length) return;
  const want = { towers: 'def', walls: 'def', economy: 'eco', balanced: g.foodPerDawn() < g.foodNeed() + 2 || S.buildings.filter(b => b.type === 'tower').length > S.buildings.filter(b => b.type === 'house').length ? 'eco' : 'def' }[strat] || 'def';
  const ps = S.packs.map(id => PACKS.find(p => p.id === id));
  const pick = ps.find(p => p.kind === want) || ps.find(p => p.kind === 'mix') || ps[0];
  g.choosePack(pick.id);
}
export function chooseStory(g) { const S = g.state; for (let k = 0; k < 9 && S.story && S.story.encounters.length; k++) { const e = S.story.encounters[0]; const c = (e.kind === 'difficulty' && e.choices.find(x => x.id === 'keep')) || (e.kind === 'evolve' && e.choices.find(x => /Fights/.test(x.hint || ''))) || e.choices.find(x => g.story().can(x)) || e.choices[e.choices.length - 1]; g.choose(c.id); } }   // a sensible player keeps a hero that fights
/** steer the hero for one decision tick: fight what threatens the town, else rest at the keep */
export function heroTick(g, mode) {
  const S = g.state, h = S.hero, t = g.map.town;
  if (h.dead) return;
  if (g.heroDef.collects && mode !== 'idle') {
    const p = S.purses.filter(q => Math.hypot(q.x - t.x, q.y - t.y) < 12).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (p) g.heroTo(p.x, p.y); else if (S.chests.length) g.heroTo(S.chests[0].x, S.chests[0].y); else g.heroTo(t.x, t.y + 3.5);
    return;
  }
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

/** optional: send the crew to the safest worthwhile cache, treat bites first */
export function scavengeTurn(g) {
  const S = g.state, sc = S.scav;
  for (const c of sc.crew) if (c.bitten) { if (!g.scavenge.treat(c.id, S.food >= 10 ? 'food' : 'gold')) g.scavenge.exile(c.id); }
  const home = sc.crew.filter(c => !c.out && !c.bitten); if (!home.length) return;
  const opts = sc.sites.map(s => g.scavenge.siteInfo(s.id)).filter(i => i.visible && !i.run && i.hops >= 1 && !i.awake && i.die < 0.15);
  if (!opts.length) return;
  opts.sort((a, b) => b.hops - a.hops || a.die - b.die);
  const i = opts[0]; if (S.gold < i.R.kit * home.length + 8) return;
  g.scavenge.send(i.site.id, home.map(c => c.id));
}

// ---------- the V2 player (tools/golden.mjs, tools/clockbot.mjs, tests) ----------
// the bot's habits on top of heroTick: the last story choice, a dash away from a bite being wound up, by day a walk to
// the nearest house not yet searched (within `far` of the camp) until the hands are full, then home
export const storyTurn = g => { const S = g.state, can = x => g.story().can(x); for (let k = 0; k < 9 && S.story.encounters.length; k++) { const e = S.story.encounters[0], last = e.choices[e.choices.length - 1]; g.choose((can(last) ? last : e.choices.find(can) || last).id); } };
export function dodge(g) {
  const S = g.state, h = S.hero; if (h.dead) return;
  const m = S.mobs.find(q => q.windT > 0 && Math.hypot(q.x - h.x, q.y - h.y) < 2); if (m) g.dash(h.x - m.x, h.y - m.y);
}
export function searchTick(g, far) {
  const S = g.state, h = S.hero, t = g.map.town; if (h.dead || S.phase !== 'day' || S.dayT < 3) return false;
  if (h.carry.scrap + h.carry.food >= 6) { g.heroTo(t.x, t.y + 3.5); return true; }
  const o = g.searchHomes().filter(q => !g.searched(q.id) && Math.hypot(q.x - t.x, q.y - t.y) < far).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  if (!o) return false; g.heroTo(o.x, o.y); return true;
}
/** a whole V2 run by the clock: builders on, the story's choices, searching by day within `far`, dashing, the hero
 *  defending; returns what the run reached. opts: { seed, mapSeed, hero, difficulty, area, maxNights, far, auto } */
export function playRun(createGame, opts) {
  const { seed, mapSeed, hero = 'survivor', difficulty = 'survivor', area = 'suburb', maxNights = 14, far = 40, auto = false } = opts;
  const g = createGame({ seed, mapSeed, hero, difficulty, area }), S = g.state; S.builders = 'balanced'; if (auto) g.setAutopilot(true);
  let steps = 0;
  while (!S.over && S.night <= maxNights && steps < 60 * 60 * 60) {
    storyTurn(g);
    if (steps % 15 === 0) { dodge(g); if (!auto && !searchTick(g, far)) heroTick(g, 'active'); }
    g.step(); steps++; S.events.length = 0;
  }
  return { g, nights: S.night - 1, over: S.over, log: S.log };
}
