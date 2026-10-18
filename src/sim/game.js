// The game rules. No DOM, no three.js: a renderer reads `game.state` and drains
// `game.state.events`; bots and tests drive the same API headlessly.
import { Rng, hashSeed } from './rng.js';
import { generateMap, N, T, PASSABLE, idx, inside } from './mapgen.js';
import { computeFlow, computeNext, DIRS } from './flow.js';
import { BUILDINGS, KEEP, MAX_LEVEL, START } from '../content/buildings.js';
import { MOBS, WAVES } from '../content/mobs.js';
import { HEROES } from '../content/heroes.js';
import { PERKS, FAMILIES, freshPerkState } from '../content/perks.js';

export const STEP = 1 / 60;
const WALL_COST = 6;            // extra path cost of breaking through a palisade
// thresholds calibrated from bot runs (tools/balance.mjs → threat ratio vs outcome)
export const RATING = [[0.3, 'Easy'], [0.55, 'Medium'], [0.8, 'Hard'], [Infinity, 'Impossible']];

export function createGame({ seed = 1, biome = 'riverbend', hero = 'warrior', mapSeed } = {}) {
  const map = generateMap(mapSeed ?? seed, biome);
  const rng = new Rng(hashSeed(seed, 'run'));
  const perkRng = new Rng(hashSeed(seed, 'perks'));
  const HC = HEROES[hero];
  const c = map.town.x;

  const S = {
    seed, biome, map, heroClass: hero, night: 1, phase: 'day', time: 0,
    gold: START.gold, food: START.food, kills: 0, events: [],
    buildings: [], slotB: new Int32Array(map.slots.length).fill(-1), occ: new Int32Array(N * N).fill(-1),
    claimed: new Set([0]), nestAlive: map.regions.map(r => !!r.nest), wake: map.regions.map(() => Infinity),
    mobs: [], projectiles: [], chests: [], nextId: 1, queue: [], qT: 0, purge: null, nightFlags: {},
    P: freshPerkState(), pendingPicks: 0, offer: [], chestsHeld: 0, dawns: 0,
    log: [], cur: null, over: false, won: false,
    hero: { x: c, y: c + 3.5, r: 0.4, hp: HC.hp, maxHp: HC.hp, cd: 0, dead: false, respawn: 0, target: null, input: { x: 0, y: 0 }, face: 0, swing: 0 },
    flow: null, flowNext: null, climb: null, climbNext: null, flowDirty: true,
  };

  // first-ring nests wake up one after another
  const ring1 = map.regions.filter(r => r.ring === 1 && r.nest).map(r => r.id);
  rng.shuffle(ring1);
  [1, 2, 4, 6, 8, 10].forEach((n, k) => { if (ring1[k] !== undefined) S.wake[ring1[k]] = n; });
  ring1.slice(6).forEach(id => { S.wake[id] = 12; });

  // ---------- helpers ----------
  const ev = (t, o = {}) => S.events.push({ t, ...o });
  const toast = (msg, kind) => ev('toast', { msg, kind });
  const mastered = f => S.P.fam[f] >= 3;
  const isDef = t => t === 'tower' || t === 'wall';
  const costOf = (type, level = 1) => Math.max(1, BUILDINGS[type].cost[level - 1] - (isDef(type) ? S.P.defDiscount : S.P.ecoDiscount));
  const maxHpOf = (type, level) => Math.round(BUILDINGS[type].hp[level - 1] * (1 + S.P.allHp + (type === 'wall' ? S.P.wallHp : 0)));
  const keepMaxHp = () => KEEP.hp[keep.level - 1] + S.P.keepHp;
  const pop = () => S.buildings.reduce((s, b) => s + (b.type === 'house' ? BUILDINGS.house.pop[b.level - 1] : 0), 0);
  const houseGold = b => BUILDINGS.house.gold[b.level - 1] + S.P.houseGold;
  const farmFood = b => BUILDINGS.farm.food[b.level - 1] + S.P.farmFood + (map.slots[b.slot].nearWater ? 1 : 0);
  const incomeMult = () => (mastered('harvest') ? 1.3 : 1) * (HC.goldMult || 1);
  const claimedCount = () => S.claimed.size;
  const isBloodMoon = n => n % WAVES.bloodMoonEvery === 0;
  let liveCache = null, liveTick = -1;
  const live = () => { if (liveTick !== S.time) { liveCache = S.buildings.filter(b => !b.ruined); liveTick = S.time; } return liveCache; };
  const heroMax = () => HC.hp + S.P.heroHp;
  const towerMult = () => (1 + S.P.towerDmg) * (mastered('bow') ? 1.5 : 1);
  const keepMult = () => (1 + S.P.keepDmg) * (mastered('bow') ? 1.5 : 1);
  const upkeep = () => Math.max(0, S.buildings.reduce((a, b) => a + ((BUILDINGS[b.type].upkeep || [])[b.level - 1] || 0), 0) - S.P.upkeepCut * 2);
  const foodNeed = () => Math.ceil(pop() * START.foodPerCitizen);

  // ---------- buildings & footprints ----------
  function footprint(type, x, y) {
    const cells = [], cx = Math.floor(x), cy = Math.floor(y);
    if (type === 'keep') { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) cells.push([cx + dx, cy + dy]); }
    else if (type === 'wall') {
      const ang = Math.atan2(y - c, x - c), tx = -Math.sin(ang), ty = Math.cos(ang);
      for (let k = -2; k <= 2; k++) cells.push([Math.floor(x + tx * k), Math.floor(y + ty * k)]);
    } else { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cells.push([cx + dx, cy + dy]); }
    return cells.filter(([a, b]) => inside(a, b) && PASSABLE[map.terrain[idx(a, b)]]).map(([a, b]) => idx(a, b));
  }
  function occupy(b) { b.cells = footprint(b.type, b.x, b.y).filter(i => S.occ[i] < 0); for (const i of b.cells) S.occ[i] = b.id; S.flowDirty = true; }
  function vacate(b) { for (const i of b.cells) if (S.occ[i] === b.id) S.occ[i] = -1; S.flowDirty = true; }

  const mobById = new Map();
  const keep = { id: 0, type: 'keep', x: c, y: c, r: 2.3, level: 1, hp: KEEP.hp[0], maxHp: KEEP.hp[0], cd: 0, ruined: false, cells: [] };
  S.keep = keep; S.byId = new Map([[0, keep]]);
  occupy(keep);

  function placeBuilding(slotId, type, level) {
    const s = map.slots[slotId];
    const b = { id: S.nextId++, type, level, slot: slotId, x: s.x, y: s.y, r: type === 'wall' ? 1.7 : 1.2, hp: maxHpOf(type, level), maxHp: maxHpOf(type, level), cd: 0, ruined: false, fell: false };
    S.buildings.push(b); S.byId.set(b.id, b); S.slotB[slotId] = b.id; occupy(b);
    ev('build', { id: b.id });
    return b;
  }
  function removeBuilding(b) { vacate(b); S.buildings.splice(S.buildings.indexOf(b), 1); S.byId.delete(b.id); S.slotB[b.slot] = -1; ev('remove', { id: b.id }); }

  // ---------- flow fields ----------
  const isWall = id => { const b = S.byId.get(id); return !!b && b.type === 'wall'; };
  function refreshFlow() {
    if (!S.flowDirty) return;
    S.flow = computeFlow(map.terrain, S.occ, isWall, WALL_COST); S.flowNext = computeNext(map.terrain, S.flow);
    S.climb = computeFlow(map.terrain, S.occ, isWall, 0.6); S.climbNext = computeNext(map.terrain, S.climb);
    S.flowDirty = false; S.flowVersion = (S.flowVersion || 0) + 1;
  }

  // ---------- regions & nests ----------
  const edgeSpawns = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    for (let r = 29; r > 14; r -= 0.5) {
      const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r, i = idx(Math.floor(x), Math.floor(y));
      if (map.reach[i]) { edgeSpawns.push({ x, y }); break; }
    }
  }
  const adjacentToClaimed = r => map.regions[r].neighbors.some(n => S.claimed.has(n));
  function activeNests(n = S.night) {
    return map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id) && adjacentToClaimed(r.id) && S.wake[r.id] <= n).map(r => r.id);
  }
  function canPurge(r) {
    const reg = map.regions[r];
    return S.phase === 'day' && reg && reg.nest && S.nestAlive[r] && !S.claimed.has(r) && adjacentToClaimed(r);
  }

  // ---------- threat estimate (shared by the purge rating, the log and bots) ----------
  function unlocked(n) { return Object.entries(MOBS).filter(([, m]) => m.weight > 0 && m.from <= n); }
  function hpPerBudget(n) {
    const u = unlocked(n), w = u.reduce((a, [, m]) => a + m.weight, 0);
    const hp = u.reduce((a, [, m]) => a + m.weight * m.hp, 0) / w, cost = u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / w;
    return hp / cost;
  }
  // first blood moon brings a nest guardian; from night 10 the Gravelord walks, one more every 10 nights
  function bossesFor(n) { return n < 10 ? ['guardian'] : Array.from({ length: Math.floor(n / 10) }, () => 'gravelord'); }
  function nightBudget(n) { return WAVES.budget(n) * WAVES.territory(claimedCount()) * (isBloodMoon(n) ? WAVES.bloodMoonMult(n) : 1); }
  function purgeBudget(r, n) { return WAVES.budget(n) * WAVES.purgeShare(map.regions[r].ring); }
  S.edgeSpawns = edgeSpawns;
  function defenceDps() {
    let d = 0;
    for (const b of live()) if (b.type === 'tower') { const B = BUILDINGS.tower; d += B.dmg[b.level - 1] * towerMult() / (B.rate[b.level - 1] / S.P.towerRate); }
    if (!keep.ruined) d += KEEP.dmg[keep.level - 1] * keepMult() * S.P.keepRate / KEEP.rate * KEEP.shots[keep.level - 1];
    return d;
  }
  function heroDps() {
    if (!HC.attack) return 0;
    return (HC.attack.dmg + S.P.heroDmg + (mastered('hero') ? 1 : 0)) / (HC.attack.rate / S.P.heroRate) * (mastered('hero') ? 1.6 : 1);
  }
  /** expected wave HP divided by what the town can deal over the wave window */
  function threatRatio(n = S.night, purgeRegion = S.purge) {
    const hs = WAVES.hpScale(n);
    let hp = nightBudget(n) * hpPerBudget(n) * hs;
    if (isBloodMoon(n)) hp += bossesFor(n).reduce((a, k) => a + MOBS[k].hp, 0) * hs;
    if (purgeRegion !== null && purgeRegion !== undefined) hp += purgeBudget(purgeRegion, n) * hpPerBudget(n) * hs + MOBS.guardian.hp * hs;
    const dealt = (defenceDps() + heroDps() * 0.8) * WAVES.duration(n) * 1.6;
    return hp / Math.max(1, dealt);
  }
  const ratingOf = ratio => RATING.find(([lim]) => ratio < lim)[1];

  // ---------- waves ----------
  function makeWave(n) {
    const nests = activeNests(n);
    if (!nests.length) { const any = map.regions.filter(r => r.nest && S.nestAlive[r.id] && !S.claimed.has(r.id)); if (any.length) nests.push(any[0].id); }
    // the whole valley is yours: the dead now come out of the dark woods at the edge
    if (!nests.length) edgeSpawns.forEach((_, k) => nests.push(-1 - k));
    const wts = nests.map(r => (S.wake[r] === n && n > 1 ? 0.5 : 1));
    const u = unlocked(n), list = [];
    let budget = nightBudget(n);
    while (budget > 0.5) {
      const ok = u.filter(([, m]) => m.cost <= budget + 0.3); if (!ok.length) break;
      const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))];
      list.push({ kind, nest: nests[rng.weighted(wts)] }); budget -= m.cost;
    }
    const dur = WAVES.duration(n), surges = WAVES.surges(n);
    const q = list.map((e, k) => ({ ...e, t: Math.floor(k * surges / list.length) / surges * dur + rng.range(0, 2.5) }));
    if (isBloodMoon(n)) for (const kind of bossesFor(n)) q.push({ kind, nest: nests[rng.int(nests.length)], t: dur * 0.6 + rng.range(0, 6) });
    if (S.purge !== null) {
      let pb = purgeBudget(S.purge, n);
      const last = dur * (surges - 1) / surges;
      while (pb > 0.5) { const ok = u.filter(([, m]) => m.cost <= pb + 0.3); if (!ok.length) break; const [kind, m] = ok[rng.weighted(ok.map(([, mm]) => mm.weight))]; q.push({ kind, nest: S.purge, t: last + rng.range(0, 4) }); pb -= m.cost; }
      q.push({ kind: 'guardian', nest: S.purge, t: last + 2 });
    }
    return q.sort((a, b) => a.t - b.t);
  }

  function spawnMob(kind, x, y, opts = {}) {
    const m = MOBS[kind], hs = WAVES.hpScale(S.night);
    const hp = m.fixedHp ? m.hp : Math.ceil(m.hp * hs);
    const mob = { id: S.nextId++, kind, x, y, hp, maxHp: hp, cd: rng.range(0, 0.5), speed: m.speed * rng.range(0.9, 1.1), boost: 1, rise: opts.instant ? 1 : 0, face: 0, attacking: false, summonT: m.summon ? m.summon.every : 0 };
    S.mobs.push(mob); mobById.set(mob.id, mob); ev('spawn', { id: mob.id, kind });
    return mob;
  }
  function spawnAtNest(kind, r) {
    const n = r < 0 ? edgeSpawns[-1 - r] : map.regions[r].nest;
    for (let k = 0; k < 8; k++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(0, 1.8), x = n.x + Math.cos(a) * d, y = n.y + Math.sin(a) * d;
      if (inside(Math.floor(x), Math.floor(y)) && PASSABLE[map.terrain[idx(Math.floor(x), Math.floor(y))]] && S.occ[idx(Math.floor(x), Math.floor(y))] < 0) return spawnMob(kind, x, y);
    }
    return spawnMob(kind, n.x, n.y);
  }

  // ---------- combat ----------
  function damageBuilding(b, d) {
    if (b.ruined || d <= 0) return;
    S.cur.taken[b.type] = (S.cur.taken[b.type] || 0) + Math.min(d, b.hp);
    b.hp -= d; ev('hitB', { id: b.id });
    if (b.hp <= 0) ruin(b);
  }
  function ruin(b) {
    b.ruined = true; b.fell = true; b.hp = 0; vacate(b); liveTick = -1; ev('ruin', { id: b.id });
    if (b.type === 'keep') { endRun(false); return; }
    S.cur.lost.push(b.type);
    if (b.type === 'house') {
      const n = BUILDINGS.house.pop[b.level - 1] / 2; S.cur.risen += n;
      for (let k = 0; k < n; k++) { const m = spawnMob('risen', b.x + rng.range(-1, 1), b.y + rng.range(-1, 1), { instant: false }); m.rise = 0.4; }
      toast(`A house fell. ${n === 1 ? 'Its family rises' : 'Its families rise'} with the dead.`, 'bad');
    } else toast(`${BUILDINGS[b.type].name} destroyed. It will be rebuilt at dawn.`, 'bad');
  }
  function hitMob(m, d, src) {
    if (m.hp <= 0) return;
    S.cur.dmg[src] = (S.cur.dmg[src] || 0) + Math.min(d, m.hp);
    m.hp -= d; ev('hitM', { id: m.id });
    if (m.hp <= 0) { S.cur.kills[src] = (S.cur.kills[src] || 0) + 1; killMob(m); }
  }
  function killMob(m) {
    const i = S.mobs.indexOf(m); if (i < 0) return;
    S.mobs.splice(i, 1); mobById.delete(m.id); S.kills++; ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y });
    const D = MOBS[m.kind];
    if (S.P.lifesteal && !S.hero.dead && Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 6) S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp + S.P.lifesteal);
    if (S.P.bounty && S.kills % 3 === 0) S.gold++;
    if (D.burst) { liveTick = -1; explode(m.x, m.y, D.burst); }
    if (D.dropsChest && rng.chance(D.dropsChest)) { const ch = { id: S.nextId++, x: m.x, y: m.y }; S.chests.push(ch); ev('chest', { id: ch.id }); toast('Something dropped a chest. Walk over it.', 'good'); }
  }
  function explode(x, y, burst) {
    ev('explode', { x, y, r: burst.radius });
    const dmg = burst.dmg * Math.sqrt(WAVES.hpScale(S.night));
    for (const b of live().concat(keep.ruined ? [] : [keep])) if (Math.hypot(b.x - x, b.y - y) < burst.radius + b.r) damageBuilding(b, dmg);
    if (!S.hero.dead && Math.hypot(S.hero.x - x, S.hero.y - y) < burst.radius) hurtHero(dmg * 0.5);
  }
  function hurtHero(d) {
    const h = S.hero; if (h.dead) return;
    S.cur.taken.hero = (S.cur.taken.hero || 0) + d; h.hp -= d; ev('hitH');
    if (h.hp <= 0) { h.dead = true; h.respawn = 6; h.target = null; S.cur.heroDeaths++; ev('heroDie'); toast('You fell. Back at the keep in 6 seconds.', 'bad'); }
  }
  function fire(from, x0, y0, target, dmg, src, speed = 18) {
    const p = { id: S.nextId++, x: x0, y: y0, z: from, target: target.id, tx: target.x, ty: target.y, dmg, src, speed, life: 2, enemy: false };
    S.projectiles.push(p); ev('shot', { id: p.id, src });
  }
  function spit(m, target) {
    const p = { id: S.nextId++, x: m.x, y: m.y, z: 1, target: target === S.hero ? 'hero' : target.id, tx: target.x, ty: target.y, dmg: MOBS.spitter.dmg, src: 'spit', speed: 9, life: 2, enemy: true };
    S.projectiles.push(p); ev('shot', { id: p.id, src: 'spit' });
  }

  // ---------- day actions ----------
  function build(slotId, type) {
    if (S.phase !== 'day' || S.over) return fail('Build during the day.');
    const s = map.slots[slotId]; if (!s) return fail('No such slot.');
    if (!S.claimed.has(s.region)) return fail('Claim this region first.');
    if (S.slotB[slotId] >= 0) return fail('Something is already built here.');
    if (s.gate && !isDef(type)) return fail('Gate lots only take palisades and towers.');
    const cost = costOf(type); if (S.gold < cost) return fail('Not enough gold.');
    S.gold -= cost; S.cur.spent += cost; S.cur.built.push(type);
    placeBuilding(slotId, type, 1); return true;
  }
  function upgrade(slotId) {
    if (S.phase !== 'day' || S.over) return fail('Upgrade during the day.');
    const b = S.byId.get(S.slotB[slotId]); if (!b || b.level >= MAX_LEVEL) return fail('Cannot upgrade.');
    const cost = costOf(b.type, b.level + 1); if (S.gold < cost) return fail('Not enough gold.');
    S.gold -= cost; S.cur.spent += cost; S.cur.upgraded.push(`${b.type}${b.level + 1}`);
    removeBuilding(b); const nb = placeBuilding(slotId, b.type, b.level + 1); nb.hp = Math.min(nb.maxHp, nb.hp); return true;
  }
  function upgradeKeep() {
    if (S.phase !== 'day' || keep.level >= 3) return fail('Cannot raise the keep.');
    const cost = KEEP.cost[keep.level]; if (S.gold < cost) return fail('Not enough gold.');
    S.gold -= cost; S.cur.spent += cost; S.cur.upgraded.push(`keep${keep.level + 1}`);
    keep.level++; const m = keepMaxHp(); keep.hp += m - keep.maxHp; keep.maxHp = m; keep.r = 2.3 * (1 + 0.12 * (keep.level - 1));
    ev('keepUp'); return true;
  }
  function planPurge(r) {
    if (r === null) { S.purge = null; return true; }
    if (!canPurge(r)) return fail('You can only march on a nest next to your land.');
    S.purge = r; return true;
  }
  function fail(msg) { ev('fail', { msg }); return false; }

  function startNight() {
    if (S.phase !== 'day' || S.over || S.pendingPicks > 0) return false;
    refreshFlow();
    S.phase = 'night'; S.queue = makeWave(S.night); S.qT = 0;
    for (const b of S.buildings) b.fell = false;
    const purgeReg = S.purge;
    Object.assign(S.cur, {
      goldAtBell: S.gold, pop: pop(), town: townCounts(), defDps: +defenceDps().toFixed(1), heroDps: +heroDps().toFixed(1),
      wave: S.queue.length, waveHp: Math.round(S.queue.reduce((a, q) => a + (MOBS[q.kind].fixedHp ? MOBS[q.kind].hp : Math.ceil(MOBS[q.kind].hp * WAVES.hpScale(S.night))), 0)),
      ratio: +threatRatio(S.night, purgeReg).toFixed(2), purge: purgeReg, nests: activeNests().length, claimed: claimedCount(), bloodMoon: isBloodMoon(S.night),
    });
    ev('night', { n: S.night, bloodMoon: isBloodMoon(S.night) });
    toast(isBloodMoon(S.night) ? `Blood moon. Night ${S.night} begins.` : `The bell rings. Night ${S.night} begins.`, isBloodMoon(S.night) ? 'bad' : undefined);
    return true;
  }

  function dawn() {
    S.phase = 'day'; S.dawns++;
    let foodIn = 0, hg = 0;
    for (const b of S.buildings) { if (b.fell) continue; if (b.type === 'farm') foodIn += farmFood(b); if (b.type === 'house') hg += houseGold(b); }
    foodIn = Math.round(foodIn * (mastered('harvest') ? 1.3 : 1));
    S.food += foodIn;
    const need = foodNeed(), fed = need === 0 ? 1 : Math.min(1, S.food / need);
    S.food = Math.max(0, S.food - need);
    const upk = upkeep(), goldIn = Math.round((START.baseIncome + S.P.tax + hg * fed) * incomeMult()) - upk;
    S.gold = Math.max(0, S.gold + goldIn);
    let claimedNow = null;
    if (S.purge !== null) {
      claimedNow = S.purge; S.claimed.add(S.purge); S.nestAlive[S.purge] = false;
      for (const nb of map.regions[S.purge].neighbors) if (map.regions[nb].nest && !S.claimed.has(nb) && S.wake[nb] > S.night + 1) S.wake[nb] = S.night + 1;
      const loot = WAVES.plunder(map.regions[S.purge].ring); S.gold += loot; S.chestsHeld++;
      ev('claim', { region: S.purge }); toast(`The nest burns: +${loot} gold and a blessing. The land is yours, but new nests stir beyond it.`, 'good');
      S.purge = null;
    }
    closeLog({ goldIn, foodIn, foodNeed: need, fed: +fed.toFixed(2), claimedNow });
    for (const b of [...S.buildings]) { if (b.ruined) { b.ruined = false; b.hp = b.maxHp; occupy(b); ev('rebuild', { id: b.id }); } b.hp = b.maxHp; b.fell = false; }
    keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * 0.25);
    S.hero.hp = S.hero.maxHp;
    S.night++; newLog();
    let picks = 1 + S.chestsHeld; S.chestsHeld = 0;
    if (HC.bonusPickEvery && S.dawns % HC.bonusPickEvery === 0) picks++;
    S.pendingPicks += picks; rollOffer();
    ev('dawn', { goldIn, foodIn, need, fed });
    toast(`Dawn. ${goldIn >= 0 ? '+' : ''}${goldIn} gold${upk ? ` after ${upk} tower upkeep` : ''}, +${foodIn} food. Citizens ate ${need}.`, 'good');
    if (fed < 1) toast(`Not enough food. Houses earned ${Math.round(fed * 100)}% of their gold.`, 'bad');
  }

  function endRun(won) {
    S.over = true; S.won = won; S.phase = 'over'; closeLog({ result: won ? 'won' : 'lost' }); ev('over', { won, night: S.night });
  }

  // ---------- blessings ----------
  function rollOffer() {
    if (S.pendingPicks <= 0) { S.offer = []; return; }
    const pool = PERKS.filter(p => (S.P.taken[p.id] || 0) < p.max && !(p.fam === 'hero' && !HC.attack));
    const out = [], n = 3 + (HC.extraOffer || 0);
    while (out.length < n && pool.length) {
      const i = perkRng.weighted(pool.map(p => 1 + S.P.fam[p.fam] * 0.6));
      out.push(pool.splice(i, 1)[0].id);
    }
    S.offer = out;
    if (!out.length) S.pendingPicks = 0; // every blessing taken: nothing left to offer
  }
  function choosePerk(id) {
    if (!S.offer.includes(id)) return fail('That blessing is not on offer.');
    const pk = PERKS.find(p => p.id === id);
    pk.fx(S.P); S.P.taken[id] = (S.P.taken[id] || 0) + 1; S.P.fam[pk.fam]++; S.cur.perks.push(id);
    if (S.P.fam[pk.fam] === 3) toast(FAMILIES[pk.fam].mastery, 'good');
    for (const b of S.buildings) { const m = maxHpOf(b.type, b.level); if (!b.ruined) b.hp += m - b.maxHp; b.maxHp = m; }
    const km = keepMaxHp(); keep.hp += km - keep.maxHp; keep.maxHp = km;
    const hm = heroMax(); S.hero.hp += hm - S.hero.maxHp; S.hero.maxHp = hm;
    S.pendingPicks--; rollOffer(); return true;
  }

  // ---------- run log ----------
  function townCounts() { const o = {}; for (const b of S.buildings) o[b.type] = (o[b.type] || 0) + b.level; o.keep = keep.level; return o; }
  function newLog() { S.cur = { night: S.night, goldStart: S.gold, spent: 0, built: [], upgraded: [], perks: [], dmg: {}, kills: {}, taken: {}, lost: [], risen: 0, heroDeaths: 0 }; }
  function closeLog(extra) {
    const l = S.cur; if (!l || l.closed) return; l.closed = true;
    Object.assign(l, { keepEnd: Math.max(0, Math.ceil(keep.hp)), keepMax: keep.maxHp, seconds: Math.round(S.qT) }, extra);
    S.log.push(l);
  }
  newLog();

  // ---------- simulation step ----------
  function stepHero(dt) {
    const h = S.hero;
    if (h.dead) { h.respawn -= dt; if (h.respawn <= 0) { h.dead = false; h.hp = h.maxHp; h.x = c; h.y = c + 3.5; ev('heroBack'); } return; }
    let dx = h.input.x, dy = h.input.y, moving = false;
    if (dx || dy) { h.target = null; const l = Math.hypot(dx, dy); dx /= l; dy /= l; moving = true; }
    else if (h.target) { dx = h.target.x - h.x; dy = h.target.y - h.y; const l = Math.hypot(dx, dy); if (l < 0.15) { h.target = null; dx = dy = 0; } else { dx /= l; dy /= l; moving = true; } }
    if (moving) {
      const sp = HC.speed * dt;
      const tryMove = (nx, ny) => { const i = idx(Math.floor(nx), Math.floor(ny)); if (!inside(Math.floor(nx), Math.floor(ny)) || !PASSABLE[map.terrain[i]]) return false; h.x = nx; h.y = ny; return true; };
      if (!tryMove(h.x + dx * sp, h.y + dy * sp)) { if (!tryMove(h.x + dx * sp, h.y)) tryMove(h.x, h.y + dy * sp); }
      h.face = Math.atan2(dx, dy); h.moving = true;
    } else h.moving = false;
    for (const b of live().concat(keep.ruined ? [] : [keep])) { const ddx = h.x - b.x, ddy = h.y - b.y, d = Math.hypot(ddx, ddy), m = b.r + h.r * 0.5; if (d < m && d > 1e-4) { h.x = b.x + ddx / d * m; h.y = b.y + ddy / d * m; } }
    h.cd -= dt; h.swing = Math.max(0, h.swing - dt);
    const A = HC.attack;
    if (A && h.cd <= 0) {
      const reach = A.reach + S.P.heroRange, dmg = A.dmg + S.P.heroDmg + (mastered('hero') ? 1 : 0);
      let best = null, bd = reach;
      for (const m of S.mobs) { if (m.rise < 1) continue; const d = Math.hypot(m.x - h.x, m.y - h.y) - 0.3 * MOBS[m.kind].size; if (d < bd) { bd = d; best = m; } }
      if (best) {
        h.cd = A.rate / S.P.heroRate; h.swing = 0.25; if (!moving) h.face = Math.atan2(best.x - h.x, best.y - h.y);
        if (A.kind === 'melee') {
          if (mastered('hero')) S.mobs.filter(m => Math.hypot(m.x - h.x, m.y - h.y) - 0.3 * MOBS[m.kind].size < reach).forEach(m => hitMob(m, dmg, 'hero'));
          else hitMob(best, dmg, 'hero');
          ev('swing');
        } else {
          fire(1.4, h.x, h.y, best, dmg, 'hero', 24);
          if (mastered('hero')) { const second = S.mobs.find(m => m !== best && Math.hypot(m.x - h.x, m.y - h.y) < reach); if (second) fire(1.4, h.x, h.y, second, dmg, 'hero', 24); }
        }
      }
    }
    h.hp = Math.min(h.maxHp, h.hp + dt * (S.phase === 'day' ? 3 : S.P.heroRegen));
    for (const ch of [...S.chests]) {
      if (Math.hypot(ch.x - h.x, ch.y - h.y) > 1.3) continue;
      S.chests.splice(S.chests.indexOf(ch), 1); ev('chestOpen', { id: ch.id });
      if (S.phase === 'day') { S.pendingPicks++; rollOffer(); } else { S.chestsHeld++; toast('Chest opened. Extra blessing at dawn.', 'good'); }
    }
  }

  // spatial hash for mob separation and auras
  const bucket = new Map();
  function stepMobs(dt) {
    const h = S.hero;
    bucket.clear();
    for (const m of S.mobs) { const k = (Math.floor(m.x / 2) << 8) | Math.floor(m.y / 2); let a = bucket.get(k); if (!a) bucket.set(k, a = []); a.push(m); m.boost = 1; }
    for (const s of S.mobs) {
      const au = MOBS[s.kind].aura; if (!au || s.rise < 1) continue;
      const bx = Math.floor(s.x / 2), by = Math.floor(s.y / 2), rr = Math.ceil(au.radius / 2);
      for (let ox = -rr; ox <= rr; ox++) for (let oy = -rr; oy <= rr; oy++) { const a = bucket.get(((bx + ox) << 8) | (by + oy)); if (a) for (const m of a) if (m !== s && Math.abs(m.x - s.x) < au.radius && Math.abs(m.y - s.y) < au.radius) m.boost = au.speed; }
    }
    const targets = live().concat(keep.ruined ? [] : [keep]);
    for (const m of [...S.mobs]) {
      if (m.hp <= 0) continue;
      const D = MOBS[m.kind];
      if (m.rise < 1) { m.rise = Math.min(1, m.rise + dt * 1.2); continue; }
      if (D.summon) { m.summonT -= dt; if (m.summonT <= 0) { m.summonT = D.summon.every; for (let k = 0; k < D.summon.count; k++) spawnMob(D.summon.kind, m.x + rng.range(-1.5, 1.5), m.y + rng.range(-1.5, 1.5)); ev('summon', { id: m.id }); } }
      m.cd -= dt; m.attacking = false;
      const ci = idx(Math.floor(m.x), Math.floor(m.y));
      const speed = m.speed * m.boost / (map.terrain[ci] === T.FOREST ? 1.4 : map.terrain[ci] === T.FORD ? 1.8 : 1);
      const hd = h.dead ? Infinity : Math.hypot(h.x - m.x, h.y - m.y);
      // spitters stop and spit at the first thing in range
      if (D.range) {
        let tgt = null, td = D.range;
        if (hd < td) { tgt = h; td = hd; }
        for (const b of targets) { if (b.ruined) continue; const d = Math.hypot(b.x - m.x, b.y - m.y) - b.r; if (d < td) { td = d; tgt = b; } }
        if (tgt) { m.attacking = true; m.face = Math.atan2(tgt.x - m.x, tgt.y - m.y); if (m.cd <= 0) { m.cd = D.rate; spit(m, tgt); } continue; }
      }
      // anything close to the hero turns on them
      if (hd < 3 && !D.burst && m.kind !== 'gravelord') {
        m.face = Math.atan2(h.x - m.x, h.y - m.y);
        if (hd > 0.9) { moveToward(m, h.x, h.y, speed * dt); }
        else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; hurtHero(D.dmg); ev('bite', { id: m.id }); } }
        continue;
      }
      const field = D.climbs ? S.climb : S.flow, next = D.climbs ? S.climbNext : S.flowNext;
      let attackB = null;
      if (field[ci] === 0 || !Number.isFinite(field[ci])) attackB = adjacentBuilding(m);
      const nj = next[ci];
      if (!attackB && nj >= 0 && S.occ[nj] >= 0 && !D.climbs) attackB = S.byId.get(S.occ[nj]); // a palisade stands in the way
      if (attackB && !attackB.ruined) {
        m.attacking = true; m.face = Math.atan2(attackB.x - m.x, attackB.y - m.y);
        if (D.burst) { m.hp = 0; killMob(m); continue; }
        if (m.cd <= 0) {
          m.cd = 1; damageBuilding(attackB, D.dmg); ev('bite', { id: m.id });
          if (attackB.type === 'wall' && S.P.thorns) hitMob(m, S.P.thorns, 'thorns');
        }
        continue;
      }
      if (nj >= 0) { const tx = (nj % N) + 0.5, ty = ((nj / N) | 0) + 0.5; moveToward(m, tx, ty, speed * dt); }
      else moveToward(m, c, c, speed * dt);
    }
    // separation
    for (const arr of bucket.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), mn = 0.3 * (MOBS[a.kind].size + MOBS[b.kind].size);
      if (d < mn && d > 1e-4) { const p = (mn - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
    }
    // never stand inside a building or impassable cell
    for (const m of S.mobs) {
      if (!standable(m, m.x, m.y)) {
        if (m.px !== undefined && standable(m, m.px, m.py)) { m.x = m.px; m.y = m.py; }
        else unstick(m);
      }
      m.px = m.x; m.py = m.y;
    }
  }
  function standable(m, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false;
    const i = idx(cx, cy);
    return PASSABLE[map.terrain[i]] && (S.occ[i] < 0 || (MOBS[m.kind].climbs && isWall(S.occ[i])));
  }
  function unstick(m) {
    const cx = Math.floor(m.x), cy = Math.floor(m.y);
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx + 0.5, y = cy + dy + 0.5;
      if (standable(m, x, y) && Number.isFinite(S.flow[idx(cx + dx, cy + dy)])) { m.x = x; m.y = y; return; }
    }
  }
  function moveToward(m, tx, ty, s) { const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy); if (d < 1e-4) return; m.x += dx / d * Math.min(s, d); m.y += dy / d * Math.min(s, d); m.face = Math.atan2(dx, dy); }
  function adjacentBuilding(m) {
    const x = Math.floor(m.x), y = Math.floor(m.y); let best = null, bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!inside(x + dx, y + dy)) continue; const o = S.occ[idx(x + dx, y + dy)];
      if (o >= 0) { const b = S.byId.get(o); if (b && !b.ruined) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } } }
    }
    return best;
  }

  function stepTowers(dt) {
    const shooters = live().filter(b => b.type === 'tower'); if (!keep.ruined) shooters.push(keep);
    for (const b of shooters) {
      let range, dmg, rate, shots = 1;
      if (b.type === 'tower') { const B = BUILDINGS.tower, l = b.level - 1; range = B.range[l] + S.P.towerRange; dmg = B.dmg[l] * towerMult(); rate = B.rate[l] / S.P.towerRate; }
      else { const l = keep.level - 1; range = KEEP.range[l] + S.P.towerRange; dmg = KEEP.dmg[l] * keepMult(); rate = KEEP.rate / S.P.keepRate; shots = KEEP.shots[l]; }
      b.cd -= dt; if (b.cd > 0) continue;
      let n1 = null, n2 = null, d1 = range * range, d2 = range * range;
      for (const m of S.mobs) {
        if (m.rise < 1) continue; const dx = m.x - b.x, dy = m.y - b.y, d = dx * dx + dy * dy;
        if (d < d1) { n2 = n1; d2 = d1; n1 = m; d1 = d; } else if (d < d2) { n2 = m; d2 = d; }
      }
      if (!n1) continue;
      const near = n2 ? [n1, n2] : [n1];
      for (let k = 0; k < shots; k++) fire(b.type === 'keep' ? 4 : 3, b.x, b.y, near[k % near.length], dmg, b.type === 'keep' ? 'keep' : 'tower');
      b.cd = rate;
    }
  }
  function stepProjectiles(dt) {
    for (const p of [...S.projectiles]) {
      const tgt = p.target === 'hero' ? (S.hero.dead ? null : S.hero) : (p.enemy ? S.byId.get(p.target) : mobById.get(p.target));
      if (tgt) { p.tx = tgt.x; p.ty = tgt.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy); p.life -= dt;
      if (d < 0.4 || p.life <= 0) {
        if (tgt && d < 0.8) {
          if (p.enemy) { if (tgt === S.hero) hurtHero(p.dmg); else damageBuilding(tgt, p.dmg); }
          else hitMob(tgt, p.dmg, p.src);
        }
        S.projectiles.splice(S.projectiles.indexOf(p), 1); ev('shotEnd', { id: p.id }); continue;
      }
      const s = Math.min(d, p.speed * dt); p.x += dx / d * s; p.y += dy / d * s;
    }
  }

  function step(dt = STEP) {
    if (S.over) return;
    S.time += dt;
    refreshFlow();
    stepHero(dt);
    if (S.phase === 'night') {
      S.qT += dt;
      while (S.queue.length && S.queue[0].t <= S.qT) { const q = S.queue.shift(); spawnAtNest(q.kind, q.nest); }
      stepMobs(dt);
      stepTowers(dt);
      if (mastered('stone')) for (const b of live()) if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + dt * 0.3);
    }
    stepProjectiles(dt);
    // sunrise: whatever still walks long after the last surge burns away
    if (S.phase === 'night' && !S.queue.length && S.mobs.length && S.qT > WAVES.duration(S.night) + 90) {
      for (const m of [...S.mobs]) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y }); }
      toast('The sun rises and the last of the dead burn away.');
    }
    if (S.phase === 'night' && !S.over && !S.queue.length && !S.mobs.length) dawn();
  }

  // ---------- forecast: where tonight's dead come from and how they walk ----------
  function tracePath(x, y, climb = false) {
    const next = climb ? S.climbNext : S.flowNext, pts = [[x, y]];
    let i = idx(Math.floor(x), Math.floor(y));
    for (let k = 0; k < 300; k++) { const j = next[i]; if (j < 0) break; pts.push([(j % N) + 0.5, ((j / N) | 0) + 0.5]); i = j; }
    return pts;
  }
  function forecast(n = S.night) {
    refreshFlow();
    let nests = activeNests(n);
    if (!nests.length) nests = edgeSpawns.map((_, k) => -1 - k);
    const w = nests.map(r => (S.wake[r] === n && n > 1 ? 0.5 : 1)), tw = w.reduce((a, b) => a + b, 0);
    const u = unlocked(n), wsum = u.reduce((a, [, m]) => a + m.weight, 0), avgCost = u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / wsum;
    const total = nightBudget(n) / avgCost;
    const out = nests.map((r, k) => {
      const p = r < 0 ? edgeSpawns[-1 - r] : map.regions[r].nest;
      return { nest: r, x: p.x, y: p.y, count: Math.round(total * w[k] / tw), siege: false, boss: false, path: tracePath(p.x, p.y) };
    });
    if (S.purge !== null && n === S.night) {
      const p = map.regions[S.purge].nest, extra = Math.round(purgeBudget(S.purge, n) / avgCost) + 1;
      const e = out.find(o => o.nest === S.purge);
      if (e) { e.count += extra; e.siege = true; } else out.push({ nest: S.purge, x: p.x, y: p.y, count: extra, siege: true, boss: false, path: tracePath(p.x, p.y) });
    }
    if (isBloodMoon(n) && out.length) out[0].boss = true;
    return out;
  }

  // ---------- queries for UI and bots ----------
  function regionInfo(r) {
    const reg = map.regions[r]; if (!reg) return null;
    const ratio = canPurge(r) ? threatRatio(S.night, r) : null;
    return {
      id: r, ring: reg.ring, claimed: S.claimed.has(r), nest: !!reg.nest && S.nestAlive[r], awake: S.wake[r] <= S.night, active: activeNests().includes(r),
      slots: reg.slots.length, forest: reg.forest, water: reg.water, canPurge: canPurge(r), ratio, rating: ratio === null ? null : ratingOf(ratio),
      wakes: reg.neighbors.filter(n => map.regions[n].nest && !S.claimed.has(n) && S.wake[n] > S.night).length,
    };
  }
  rollOffer(); S.pendingPicks = 1; rollOffer();

  return {
    state: S, map, heroDef: HC, step, build, upgrade, upgradeKeep, startNight, choosePerk, planPurge,
    setHeroInput: (x, y) => { S.hero.input.x = x; S.hero.input.y = y; },
    heroTo: (x, y) => { S.hero.target = { x, y }; },
    costOf, maxHpOf, keepMaxHp, pop, defenceDps, heroDps, threatRatio, ratingOf, activeNests, regionInfo, canPurge,
    foodPerDawn: () => Math.round(S.buildings.reduce((a, b) => a + (b.type === 'farm' ? farmFood(b) : 0), 0) * (mastered('harvest') ? 1.3 : 1)),
    goldPerDawn: () => Math.round((START.baseIncome + S.P.tax + S.buildings.reduce((a, b) => a + (b.type === 'house' ? houseGold(b) : 0), 0)) * incomeMult()) - upkeep(),
    upkeep, foodNeed,
    forecast, mastered, isBloodMoon, drainEvents: () => S.events.splice(0),
    logRows: () => S.log.concat(S.cur && !S.cur.closed && S.cur.waveHp ? [S.cur] : []),
  };
}
