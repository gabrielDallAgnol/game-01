// The game rules. No DOM, no three.js: a renderer reads `game.state` and drains
// `game.state.events`; bots and tests drive the same API headlessly.
//
// This file is the composition root: it builds the run's state, wires the rule modules together through one shared
// context `G`, runs the start-of-run setup in a fixed order (the order is part of determinism: do not reorder), and
// owns the per-frame step(). Each rule lives in its own module (createX(G) factories, see CLAUDE.md for the map):
//   core · economy · buildings · build · waves · forecast · combat · brain · loot · districts ·
//   seasons · hero · blessings · save · nests · api
// G holds: the run's constants (S, map, c, keep, rng, mobById, seed, …), every module's functions, and five
// late or changing slots read as G.x at call time: G.HC (the hero's class), G.DIFF (difficulty),
// G.story, G.sc (scavenging), G.api.
import { Rng, hashSeed } from './rng.js';
import { generateMap, PASSABLE, idx, inside, LANDMARKS } from './mapgen.js';
import { BUILDINGS, KEEP } from '../content/buildings.js';
import { TIDE } from '../content/mobs.js';
import { heroKit } from '../content/heroes.js';
import { createScavenge } from './scavenge.js';
import { createPlanner } from './planner.js';
import { createStory } from './story.js';
import { createState, STEP, PICKS_PER_DAWN, DROPS, ZONE, CREW_NEED, SAVE_V, CUT, RULE_FX, DIFFICULTY, FOREMAN, LEVEL, TENSION, PRESENCE, REGEN } from './state.js';
import { createCore } from './core.js';
import { createEconomy } from './economy.js';
import { createBuildings } from './buildings.js';
import { createBuild } from './build.js';
import { createWaves } from './waves.js';
import { createForecast } from './forecast.js';
import { createCombat } from './combat.js';
import { createBrain } from './brain.js';
import { createLoot } from './loot.js';
import { createDistricts } from './districts.js';
import { createSeasons } from './seasons.js';
import { createHero } from './hero.js';
import { createSave } from './save.js';
import { createApi } from './api.js';
import { createSpots } from './spots.js';
import { createNests } from './nests.js';
// [pacify] begin
import { createPacify } from './pacify.js';
// [pacify] end
// [folk] the folk build by themselves
import { createFolkBuild } from './folk-build.js';
import { createSteer } from './steer.js';
import { createWoods } from './woods.js';
import { createTowers } from './towers.js';
// [income] scrap and food by the second
import { createIncome } from './income.js';
// [gemini3] begin: ported from Gemini's fork (logging)
import { createLogging } from './logging.js';
import { createStronghold } from './stronghold.js';
import { createPressure } from './pressure.js';
// [gemini3] end
// [econ3] the construction queue and the dawn Settlement
import { createConstruct } from './construct.js';
import { createSettle } from './settle.js';
// [area] next line
import { createSearch } from './search.js';
import { createCombat2 } from './combat2.js';
// [v2] next line
// [v2] next line
import { createHordes } from './hordes.js';
// [mech] the Mechanic (wrench, salvage, parts, the turret line) and the Haven Rig with its modules
import { createMechanic } from './mechanic.js';
import { createRig } from './rig.js';
// [ch1] begin: chapter 1 in Hollowmere (places, the quest chain, words in the world, survivors, nests as buildings)
import { createPlaces } from './places.js';
import { createChapter } from './chapter.js';
import { createWorldText } from './worldtext.js';
import { createSurvivors } from './survivors.js';
import { createChNests } from './chnests.js';
// [ch1] end

// the rules' public numbers (they live in state.js; tests, tools and the UI import them from here)
export { STEP, PICKS_PER_DAWN, DROPS, ZONE, CREW_NEED, SAVE_V, CUT, RULE_FX, DIFFICULTY, FOREMAN, LEVEL, TENSION, PRESENCE, REGEN };

// the rule modules, in creation order (core first: the others destructure its helpers)
const MODULES = [createCore, createEconomy, createBuildings, createBuild, createWaves, createForecast, createCombat, createBrain, createLoot, createDistricts, createSeasons, createHero, createSave, createSpots, createNests, createPacify, createFolkBuild, createSteer, createWoods, createTowers, createIncome];   // [nest3] appended   // [pacify] appended
MODULES.push(createLogging, createStronghold, createPressure);   // [gemini3] appended
MODULES.push(createConstruct, createSettle);   // [econ3] appended
MODULES.push(createSearch);   // [area] appended: searching the engine town's houses (does nothing without an area)
MODULES.push(createCombat2);   // [combat2] appended: telegraphed bites and the dash
MODULES.push(createHordes);   // [v2] appended: hordes, the V2 night
MODULES.push(createMechanic, createRig);   // [mech] appended: the Mechanic, the Haven Rig's modules
MODULES.push(createPlaces, createChapter, createWorldText, createSurvivors, createChNests);   // [ch1] appended: chapter 1 (does nothing outside Hollowmere)

export function createGame({ seed = 1, biome = 'riverbend', hero = 'warrior', mapSeed, mode = 'classic', clock = true, difficulty = 'survivor', restore = null, legacy = {}, area = 'suburb', chapter = true } = {}) {   // [area] area: an engine recipe id · [ch1] chapter: false runs Hollowmere without its story
  hero = 'mechanic';   // [mech] the only class (an old save's or caller's class plays the Mechanic)
  const map = generateMap(mapSeed ?? seed, biome, area ? { area } : {});
  const HC = heroKit(hero), DIFF = DIFFICULTY[difficulty] || DIFFICULTY.survivor;
  const c = map.town.x;
  const S = createState({ seed, biome, map, hero, mode, clock, difficulty, legacy, HC });
  const keep = { id: 0, type: 'keep', x: c, y: c, r: 2.3, level: 1, hp: KEEP.hp[0], maxHp: KEEP.hp[0], cd: 0, ruined: false, cells: [], boltT: 3 };
  S.keep = keep; S.byId = new Map([[0, keep]]);

  // ---------- the shared context: run constants, then every module's functions ----------
  const G = { S, map, c, keep, seed, mapSeed, biome, mode, clock, restore, legacy,
    rng: new Rng(hashSeed(seed, 'run')), mobById: new Map(),
    HC, DIFF, story: null, sc: null, api: null, chapter };
  for (const make of MODULES) Object.assign(G, make(G));
  const {
    rng, mobById, PICKUP, activeNests, autoHero, baseDist, checkForeman, compass, dawn,
    earn, edgeSpawns, ev, fail, gainXp, heroOk, hitMob, hurtHero, inZone, isWall, killMob,
    landmarkReach, live, mastery, moveToward, newLog, nightLen, occupy, placeBuilding, pop, rankOf,
    refreshFlow, refreshMax, restoreSnap, reveal, revealRegion, rollOffer, rollPacks, rule, scatterPickups, senseMult, siteOf,
    spawnAnimals, spawnAtNest, spawnMob, spawnRoamers, standable, startNight, stepAllies, stepDrops, stepHero, stepMobs,
    stepPickups, stepProjectiles, stepTowers, syncPicks, takeSite, toast, untitle, zone
  } = G;

  // ---------- start of the run (order matters: it draws from the seeded streams) ----------
  let planner = null;
  occupy(keep);
  S.edgeSpawns = edgeSpawns;   // the hordes' entries into the night queue (sim/hordes.js fills it)
  newLog();
  for (const r of S.claimed) revealRegion(r); reveal(c, c, 14);
  rollOffer(); rollPacks(); spawnRoamers(); spawnAnimals();
  if (!restore) scatterPickups(PICKUP.start);

  // ---------- scavenging ----------
  G.sc = createScavenge({ S, map, seed, ev, toast, earn, activeNests, spawnMob, fail });
  S.scav = G.sc.scav;
  // ---------- the story: its engine (sim/story.js) reaches the rules only through these hooks ----------
  const REVIVE = ['Hush', 'Echo', 'Lull', 'Old Song', 'Quill', 'Tam', 'Vesper', 'Nocturne'];
  G.story = createStory({ api: () => G.api, S, map, rng: new Rng(hashSeed(seed, 'story')), ev, toast, earn, siteOf, LANDMARKS, pop, refreshMax, syncPicks,
    hurtHero: n => hurtHero(n), gainXp: n => gainXp(n),
    findSpot: () => G.findSpot(),   // beacons, trials and story places (sim/spots.js)
    guard: (x, y, n) => { for (let k = 0, tries = 0; k < n && tries < 40; tries++) { const a = rng.range(0, Math.PI * 2), gx = x + Math.cos(a) * rng.range(1, 2.8), gy = y + Math.sin(a) * rng.range(1, 2.8), cx = Math.floor(gx), cy = Math.floor(gy); if (!inside(cx, cy) || !PASSABLE[map.terrain[idx(cx, cy)]] || S.occ[idx(cx, cy)] >= 0) continue; k++; const m = spawnMob(rng.pick(S.night >= 4 ? ['walker', 'runner'] : ['walker']), gx, gy, { instant: true }); m.roam = { x, y, region: -1 }; } },
    landmarkReach, claimFree: id => { const l = S.landmarks[id]; if (l && !l.owned) takeSite(l); }, reviveName: () => REVIVE[rng.int(REVIVE.length)],
    risen: n => { const h = S.buildings.filter(b => b.type === 'house' && !b.ruined); const b = h.length ? h[rng.int(h.length)] : keep; for (let k = 0; k < n; k++) spawnMob('risen', b.x + rng.range(-1, 1), b.y + rng.range(-1, 1)); toast('He turned. The house fills with the Ash-Born.', 'bad'); } });
  G.story.start();
  // legacy edges from earlier runs
  { const Lg = S.legacy; if (!restore) { S.gold += 10 * (Lg.scrap || 0); S.food += 6 * (Lg.food || 0); } S.P.heroDmgMult *= 1 + 0.08 * (Lg.dmg || 0); S.P.keepHp += 25 * (Lg.keep || 0); refreshMax(); keep.hp = keep.maxHp; }
  // ---------- the public API, the builder AI, a restored save ----------
  G.step = step;
  G.api = createApi(G);
  if (G.g3api) Object.assign(G.api, G.g3api);   // [gemini3] its modules' additions to the API
  planner = createPlanner(G.api); G.api.planner = planner;
  if (restore) { restoreSnap(restore); G.mendSpots(); }   // old saves: objectives off the map move onto good ground
  G.chapterStart();   // [ch1] the chapter's opening (or its state after a restore)
  return G.api;

  // ---------- simulation step ----------
  function step(dt = STEP) {
    if (S.over) return;
    S.time += dt;
    refreshFlow();
    if (S.autopilot) autoHero(dt);
    stepHero(dt);
    G.stepCombat2(dt);   // [combat2] the dash (no-op without the flag)
    if ((S.revealT = (S.revealT || 0) - dt) <= 0) { S.revealT = 0.25; if (!S.hero.dead) reveal(S.hero.x, S.hero.y, 8); }
    untitle();
    if (S.picks.length && !S.offer.length) rollOffer();   // a pick added at any hour (a crate, a level) is dropped: V2 has no blessings
    if (S.phase === 'day' && S.clock && !S.over) {
      S.dayT += dt;
      if (S.dayT >= (S.tide || TIDE).dayLen && !S.story.encounters.length) startNight(true);
    }
    if (planner) planner.tick(dt);
    if (S.phase === 'night') {
      S.qT += dt; S.cur.keepMin = Math.min(S.cur.keepMin ?? 1, keep.hp / keep.maxHp);
      while (S.queue.length && S.queue[0].t <= S.qT) {
        const q = S.queue.shift(); spawnAtNest(q.kind, q.nest);   // the marching horde (sim/hordes.js v2Wave)
      }
      if (mastery('mending')) for (const b of live()) if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + dt * 0.3);
      if (S.P.sanctuary && !keep.ruined) keep.hp = Math.min(keep.maxHp, keep.hp + 2 * dt);
    }
    stepMobs(dt); stepAllies(dt); stepTowers(dt);
    for (const p of [...S.purses]) { p.life -= dt; if (p.life <= 0) { S.purses.splice(S.purses.indexOf(p), 1); ev('purseGone', { id: p.id }); } }
    stepProjectiles(dt);
    if (S.drops.length) stepDrops(dt);
    if (S.pickups.length || S.hero.carry.scrap || S.hero.carry.food) stepPickups();
    G.stepPacify(dt);   // [pacify] pacified land, hives waking on the map, the way home, the dusk warning
    G.stepWoods();   // [woods] worn trails
    G.stepLogging(dt);   // [gemini3] felling trees, the Logger's Hut
    if ((S.tickT = (S.tickT || 0) - dt) <= 0) { S.tickT = 0.25; checkForeman(); G.story.tick(0.25); }   // every quarter second: the Foreman, the story
    for (const b of S.buildings) if (b.built < 1 && !b.ruined && !b.cq) {   b.built = Math.min(1, b.built + dt / BUILDINGS[b.type].buildTime); if (b.built >= 1) { ev('built', { id: b.id }); toast(`The ${BUILDINGS[b.type].name} is finished. ${BUILDINGS[b.type].desc[0]}`, 'good'); } }   // [econ3] b.cq: the construction queue raises it
    // sunrise comes on time: the night's dead do not vanish. Far from the town they lose interest and roam where they stand.
    // No early dawn: a cleared night still lasts until the moon has crossed the sky.
    if (S.phase === 'night' && !S.over && !S.queue.length && S.qT >= nightLen()) {
      let burnt = 0;
      for (const m of [...S.mobs]) {
        if (m.roam || m.stream !== undefined || m.hunt) continue;
        if (Math.hypot(m.x - c, m.y - c) > 22) { m.roam = { x: m.x, y: m.y, region: -1 }; m.lost = true; continue; }   // out in the woods: they wander
        S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); ev('die', { id: m.id, kind: m.kind, x: m.x, y: m.y, src: 'sun', dmg: 0 }); burnt++;
      }
      if (burnt) toast(`Sunrise: **${burnt}** of the Ash-Born burn at your walls.`);
      dawn();
    }
    // [folk] begin: the folk's own projects, their fund, beauty (sim/folk-build.js)
    G.stepFolk(dt);
    // [folk] end
    // [income] begin: scrap and food trickle in by the second (sim/income.js)
    G.stepIncome(dt);
    // [income] end
    G.stepSearch(dt);   // [area] houses to search (only in an engine-built area)
    if (G.stepHordes) G.stepHordes(dt);   // [v2] hordes wake, break, sleep
    G.stepSalvage(dt); G.stepSkills(dt); G.stepRig(dt);   // [mech] salvage, Field Repair, the Rig's modules
    // [econ3] begin: the construction queue (sim/construct.js)
    G.stepConstruct(dt);
    // [econ3] end
    G.stepChapter(dt);   // [ch1] last: it reads the step's events
  }
}
