// The game rules. No DOM, no three.js: a renderer reads `game.state` and drains
// `game.state.events`; bots and tests drive the same API headlessly.
//
// This file is the composition root: it builds the run's state, wires the rule modules together through one shared
// context `G`, runs the start-of-run setup in a fixed order (the order is part of determinism: do not reorder), and
// owns the per-frame step(). Each rule lives in its own module (createX(G) factories, see CLAUDE.md for the map):
//   core · economy · buildings · build · waves · forecast · combat · noise · brain · hives · loot · districts ·
//   seasons · hero · blessings · save · nests · api
// G holds: the run's constants (S, map, c, keep, rng, perkRng, mobById, seed, …), every module's functions, and five
// late or changing slots read as G.x at call time: G.HC (the hero's class, changes on evolve), G.DIFF (difficulty),
// G.story, G.sc (scavenging), G.road, G.api.
import { Rng, hashSeed } from './rng.js';
import { generateMap, PASSABLE, idx, inside, LANDMARKS } from './mapgen.js';
import { BUILDINGS, KEEP } from '../content/buildings.js';
import { TIDE } from '../content/mobs.js';
import { HEROES, heroKit } from '../content/heroes.js';
import { KITS } from '../content/districts.js';
import { createScavenge } from './scavenge.js';
import { createPlanner } from './planner.js';
import { createStory } from './story.js';
// [road] begin
import { createRoad } from './road.js';
// [road] end
import { createState, STEP, PICKS_PER_DAWN, DROPS, NIGHT_TAIL, STREAM, ZONE, TOWN_DRAW, CREW_NEED, SAVE_V, CUT, HEAT, NOISE, RULE_FX, DIFFICULTY, FOREMAN, LEVEL, RATING, TENSION, PRESENCE, TOOLS, NEST, REGEN } from './state.js';
import { createCore } from './core.js';
import { createEconomy } from './economy.js';
import { createBuildings } from './buildings.js';
import { createBuild } from './build.js';
import { createWaves } from './waves.js';
import { createForecast } from './forecast.js';
import { createCombat } from './combat.js';
import { createNoise } from './noise.js';
import { createBrain } from './brain.js';
import { createHives } from './hives.js';
import { createLoot } from './loot.js';
import { createDistricts } from './districts.js';
import { createSeasons } from './seasons.js';
import { createHero } from './hero.js';
import { createBlessings } from './blessings.js';
import { createSave } from './save.js';
import { createApi } from './api.js';
import { createActs } from './acts.js';
import { createSpots } from './spots.js';
import { createNests } from './nests.js';
// [pacify] begin
import { createPacify } from './pacify.js';
// [pacify] end
// [folk] the folk build by themselves
import { createFolkBuild } from './folk-build.js';
import { createSteer } from './steer.js';
import { spotOk } from './spots.js';
import { createWoods } from './woods.js';
import { createTowers } from './towers.js';
// [income] scrap and food by the second
import { createIncome } from './income.js';
// [econ3] the construction queue, harvester carts on resource nodes, relics instead of blessings, the dawn Settlement
import { createConstruct } from './construct.js';
import { createHaul } from './haul.js';
import { createRelics } from './relics.js';

// the rules' public numbers (they live in state.js; tests, tools and the UI import them from here)
export { STEP, PICKS_PER_DAWN, DROPS, NIGHT_TAIL, STREAM, ZONE, TOWN_DRAW, CREW_NEED, SAVE_V, CUT, HEAT, NOISE, RULE_FX, DIFFICULTY, FOREMAN, LEVEL, RATING, TENSION, PRESENCE, TOOLS, NEST, REGEN };

// the rule modules, in creation order (core first: the others destructure its helpers)
const MODULES = [createCore, createEconomy, createBuildings, createBuild, createWaves, createForecast, createCombat, createNoise, createBrain, createHives, createLoot, createDistricts, createSeasons, createHero, createBlessings, createSave, createActs, createSpots, createNests, createPacify, createFolkBuild, createSteer, createWoods, createTowers, createIncome, createConstruct, createHaul, createRelics];   // [econ3] appended   // [pacify] appended

export function createGame({ seed = 1, biome = 'riverbend', hero = 'warrior', mapSeed, mode = 'classic', clock = true, difficulty = 'survivor', restore = null, legacy = {} } = {}) {
  if (hero === 'steward') hero = 'merchant';
  const map = generateMap(mapSeed ?? seed, biome);
  const HC = heroKit(hero), DIFF = DIFFICULTY[difficulty] || DIFFICULTY.survivor;
  const c = map.town.x;
  const S = createState({ seed, biome, map, hero, mode, clock, difficulty, legacy, HC });
  const keep = { id: 0, type: 'keep', x: c, y: c, r: 2.3, level: 1, hp: KEEP.hp[0], maxHp: KEEP.hp[0], cd: 0, ruined: false, cells: [], boltT: 3 };
  S.keep = keep; S.byId = new Map([[0, keep]]);

  // ---------- the shared context: run constants, then every module's functions ----------
  const G = { S, map, c, keep, seed, mapSeed, biome, mode, clock, restore, legacy,
    rng: new Rng(hashSeed(seed, 'run')), perkRng: new Rng(hashSeed(seed, 'perks')), mobById: new Map(),
    HC, DIFF, story: null, sc: null, road: null, api: null };
  for (const make of MODULES) Object.assign(G, make(G));
  const {
    rng, mobById, PICKUP, activeNests, addHeat, addPath, autoHero, baseDist, checkForeman, checkPower, compass, dawn, districtOffer,
    earn, edgeSpawns, ev, evolve, fail, frontier, gainXp, heroOk, hitMob, hurtHero, inZone, isBloodMoon, isWall, killMob, kitFor,
    landmarkReach, live, mastery, metroSpot, moveToward, nestAlive, newLog, nightLen, occupy, openDistrict, placeBuilding, pop, rankOf,
    refreshFlow, refreshMax, restoreSnap, reveal, revealRegion, rollOffer, rollPacks, rule, scatterPickups, senseMult, siteOf,
    spawnAnimals, spawnAtNest, spawnMob, spawnRoamers, standable, startNight, stepAllies, stepDrops, stepHeat, stepHero, stepMobs,
    stepPickups, stepProjectiles, stepStream, stepTowers, syncPicks, takeSite, toast, untitle, zone
  } = G;

  // ---------- start of the run (order matters: it draws from the seeded streams) ----------
  let planner = null;
  occupy(keep);
  // [road] begin: stations, convoys, ambushes and night missions live in src/sim/road.js and src/sim/missions.js
  G.road = createRoad({ S, map, ev, toast, rng: new Rng(hashSeed(seed, 'road')), LANDMARKS, mobById, story: () => G.story, fail: m => fail(m), earn: g => earn(g), gainXp: n => gainXp(n), reveal, compass: (x, y) => compass(x, y),
    placeBuilding, isWall: id => isWall(id), spawnMob, killMob, hitMob, hurtHero, moveToward, standable, heroOk: i => heroOk(i), inZone: i => inZone(i), zone: () => zone(), rankOf: m => rankOf(m), senseMult: m => senseMult(m),
    heroSpeed: () => G.HC.speed * S.P.heroSpeed, addNoise: v => addHeat(v), removeMob: m => { const i = S.mobs.indexOf(m); if (i >= 0) { S.mobs.splice(i, 1); mobById.delete(m.id); } }, hiveInReach: (x, y, r) => G.hiveInReach(x, y, r) });
  // [road] end
  // the deep woods at the edge, where the dead come from once every hive is burned (after the road: its glades change map.reach)
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    let at = null;   // the deep woods: open ground the camp can reach, clear of the void round the world (spotOk), else any reachable cell
    for (let r = 58; r > 36 && !at; r -= 0.5) { const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; if (spotOk(map, false, x, y)) at = { x, y }; }
    for (let r = 58; r > 36 && !at; r -= 0.5) { const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; if (map.reach[idx(Math.floor(x), Math.floor(y))]) at = { x, y }; }
    if (at) edgeSpawns.push(at);
  }
  S.edgeSpawns = edgeSpawns;
  // districts: the signature site's district, then the home ward's kits (draws from the districts stream)
  for (const l of S.landmarks) if (LANDMARKS[l.kind].signature) S.kits[l.region] = 'signature';
  // the home ward: the near districts with no hive are open from day 1 (common finds: a place to look around)
  for (const reg of map.regions) if (reg.ring >= 1 && !S.sealed[reg.id] && S.kits[reg.id] !== 'signature') { const l = siteOf(reg.id); if (l && l.kind === 'unknown') l.kind = KITS[kitFor(reg.id, reg.ring === 1 ? 'common' : undefined)].lm; }
  // [acts] begin: act 1 fences off the road and the city until every forest hollow burns (sim/acts.js)
  G.actSetup();
  // [acts] end
  newLog();
  for (const r of S.claimed) revealRegion(r); reveal(c, c, 14);
  rollOffer(); rollPacks(); spawnRoamers(); spawnAnimals();   // day 1 is quiet: the first blessing comes at dawn 2
  if (!restore) scatterPickups(PICKUP.start);

  // ---------- scavenging ----------
  G.sc = createScavenge({ S, map, seed, ev, toast, earn, activeNests, isBloodMoon, spawnMob, fail });
  S.scav = G.sc.scav;
  // ---------- the story: its engine (sim/story.js) reaches the rules only through these hooks ----------
  const REVIVE = ['Hush', 'Echo', 'Lull', 'Old Song', 'Quill', 'Tam', 'Vesper', 'Nocturne'];
  G.story = createStory({ api: () => G.api, heroes: HEROES, evolve: cls => evolve(cls), S, map, rng: new Rng(hashSeed(seed, 'story')), ev, toast, earn, addHeat, openDistrict, frontier, districtOffer, siteOf, LANDMARKS, pop, refreshMax, syncPicks,
    hurtHero: n => hurtHero(n), gainXp: n => gainXp(n), addPath: (f, n) => addPath(f, n),
    // the trial warden: tougher than a brute, hits softer than one, never leaves its ground
    spawnTrial: tr => { const m = spawnMob('brute', tr.x, tr.y, { instant: true }); m.hp = m.maxHp = Math.round((10 + 4 * S.lvl) * Math.min(1.3, G.DIFF.threat)); m.dmgK = tr.second ? 0.8 : 0.5; m.trial = { cls: tr.cls, from: tr.from, second: tr.second }; m.roam = { x: tr.x, y: tr.y, region: -1 }; m.warden = true;
      for (let k = 0; k < 3; k++) { const a = rng.range(0, 6.28), w = spawnMob(k === 2 && S.night >= 4 ? 'runner' : 'walker', tr.x + Math.cos(a) * 2, tr.y + Math.sin(a) * 2, { instant: true }); w.roam = { x: tr.x, y: tr.y, region: -1 }; w.hunt = true; }
      ev('trial', { id: m.id }); },
    findSpot: () => G.findSpot(),   // beacons, trials and story places (sim/spots.js)
    guard: (x, y, n) => { for (let k = 0, tries = 0; k < n && tries < 40; tries++) { const a = rng.range(0, Math.PI * 2), gx = x + Math.cos(a) * rng.range(1, 2.8), gy = y + Math.sin(a) * rng.range(1, 2.8), cx = Math.floor(gx), cy = Math.floor(gy); if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || S.occ[idx(cx, cy)] >= 0) continue; k++; const m = spawnMob(rng.pick(S.night >= 4 ? ['walker', 'runner'] : ['walker']), gx, gy, { instant: true }); m.roam = { x, y, region: -1 }; } },
    actGoal: () => G.actGoal(),   // [acts]
    landmarkReach, claimFree: id => { const l = S.landmarks[id]; if (l && !l.owned) { if (G.siteLocked(l)) G.promiseSite(l); else takeSite(l); } }, reviveName: () => REVIVE[rng.int(REVIVE.length)],
    risen: n => { const h = S.buildings.filter(b => b.type === 'house' && !b.ruined); const b = h.length ? h[rng.int(h.length)] : keep; for (let k = 0; k < n; k++) spawnMob('risen', b.x + rng.range(-1, 1), b.y + rng.range(-1, 1)); toast('He turned. The house fills with the dead.', 'bad'); } });
  G.story.start();
  // legacy edges from earlier runs
  { const Lg = S.legacy; if (!restore) { S.gold += 10 * (Lg.scrap || 0); S.food += 6 * (Lg.food || 0); } S.P.heroDmgMult *= 1 + 0.08 * (Lg.dmg || 0); S.P.keepHp += 25 * (Lg.keep || 0); refreshMax(); keep.hp = keep.maxHp; }
  // ---------- the public API, the builder AI, a restored save, the road's hooks ----------
  G.step = step;
  G.api = createApi(G);
  planner = createPlanner(G.api); G.api.planner = planner;
  if (restore) { restoreSnap(restore); G.mendSpots(); }   // old saves: objectives off the map move onto good ground
  // [acts] begin
  if (restore) G.actRestore();
  // [acts] end
  // [road] begin
  if (G.road) { G.road.attach(G.api); if (restore && restore.road) G.road.load(restore.road); }
  // [road] end
  return G.api;

  // ---------- simulation step ----------
  function step(dt = STEP) {
    if (S.over) return;
    S.time += dt;
    refreshFlow();
    if (S.ability.cd > 0) S.ability.cd = Math.max(0, S.ability.cd - dt);
    if (S.bountyT > 0) S.bountyT = Math.max(0, S.bountyT - dt);
    if (S.autopilot) autoHero(dt);
    stepHero(dt);
    if ((S.revealT = (S.revealT || 0) - dt) <= 0) { S.revealT = 0.25; if (!S.hero.dead) reveal(S.hero.x, S.hero.y, 8); }
    untitle();
    if (S.picks.length && !S.offer.length) rollOffer();   // a pick added at any hour (a crate, a story reward) gets its cards
    if (S.phase === 'day' && S.clock && !S.over) {
      S.dayT += dt;
      while (S.dayQueue.length && S.dayQueue[0].t <= S.dayT) { const q = S.dayQueue.shift(); if (nestAlive(q.nest) && !S.claimed.has(q.nest)) spawnAtNest(q.kind, q.nest); }
      if (S.dayT >= TIDE.dayLen && !S.story.encounters.length) startNight(true);
    }
    if (planner) planner.tick(dt);
    if (S.phase === 'night') {
      S.qT += dt; S.cur.keepMin = Math.min(S.cur.keepMin ?? 1, keep.hp / keep.maxHp);
      while (S.queue.length && S.queue[0].t <= S.qT) {
        const q = S.queue.shift(), up = rule('metro') && !q.unique && !q.first && rng.next() < 0.15 ? metroSpot() : null, m = up ? spawnMob(q.kind, up.x, up.y) : spawnAtNest(q.kind, q.nest);
        if (q.unique) { m.hp = m.maxHp = Math.ceil(m.maxHp * S.unique.mult); m.unique = S.unique.name; m.speed *= 0.85; ev('firstDead', { id: m.id }); toast(`[Unique Monster: ${S.unique.name}] It is here.`, 'bad'); }
        if (q.finale) m.finale = S.season.n;
        if (q.first) { m.hp = m.maxHp = TIDE.first.hp; m.speed *= TIDE.first.speed; m.first = true; ev('firstDead', { id: m.id }); toast('Something crawls out of the dark. It is coming for the town.', 'bad'); }
      }
      if (mastery('mending')) for (const b of live()) if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + dt * 0.3);
      if (S.P.sanctuary && !keep.ruined) keep.hp = Math.min(keep.maxHp, keep.hp + 2 * dt);
    }
    stepMobs(dt); stepAllies(dt); stepTowers(dt);
    for (const k in S.tools) if (S.tools[k] > 0) S.tools[k] = Math.max(0, S.tools[k] - dt);
    for (const p of [...S.purses]) { p.life -= dt; if (p.life <= 0) { S.purses.splice(S.purses.indexOf(p), 1); ev('purseGone', { id: p.id }); } }
    stepProjectiles(dt);
    if (S.drops.length) stepDrops(dt);
    if (S.pickups.length || S.hero.carry.scrap || S.hero.carry.food) stepPickups();
    stepStream(dt);
    G.stepNests(dt);   // [nests] the hives defend themselves
    G.stepPacify(dt);   // [pacify] pacified land, hives waking on the map, the way home, the dusk warning
    // [road] begin
    if (G.road) G.road.tick(dt);
    // [road] end
    G.stepWoods();   // [woods] worn trails
    stepHeat(dt);
    if ((S.powerT = (S.powerT || 0) - dt) <= 0) { S.powerT = 0.25; checkPower(); checkForeman(); G.story.tick(0.25); if (S.blackout) S.sawBlackout = true; }
    for (const b of S.buildings) if (b.built < 1 && !b.ruined && !b.cq) {   b.built = Math.min(1, b.built + dt / BUILDINGS[b.type].buildTime); if (b.built >= 1) { ev('built', { id: b.id }); toast(`The ${BUILDINGS[b.type].name} is finished. ${BUILDINGS[b.type].desc[0]}`, 'good'); } }   // [econ3] b.cq: the construction queue raises it
    // sunrise comes on time: the night's dead do not vanish. Far from the town they lose interest and roam where they stand.
    // No early dawn: a cleared night still lasts until the moon has crossed the sky.
    if (S.phase === 'night' && !S.over && !S.queue.length && S.qT >= nightLen()) {
      let burnt = 0;
      for (const m of [...S.mobs]) {
        if (m.roam || m.stream !== undefined || m.hunt) continue;
        if (Math.hypot(m.x - c, m.y - c) > 22) { m.roam = { x: m.x, y: m.y, region: -1 }; m.lost = true; continue; }   // out in the woods: they wander
        if (m.unique && S.unique) S.unique.escaped = true;   // at your walls: the sunrise burns the night's dead (the hives' stream keeps coming)
        S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: 'sun', dmg: 0 }); burnt++;
      }
      if (burnt) toast(`Sunrise: **${burnt}** of the dead burn at your walls.`);
      dawn();
    }
    // [folk] begin: the folk's own projects, their fund, beauty (sim/folk-build.js)
    G.stepFolk(dt);
    // [folk] end
    // [income] begin: scrap and food trickle in by the second (sim/income.js)
    G.stepIncome(dt);
    // [income] end
    // [econ3] begin: the construction queue and the harvester carts (sim/construct.js, sim/haul.js)
    G.stepConstruct(dt); G.stepHaul(dt);
    // [econ3] end
  }
}
