// three.js view of a game: the ruined city. It only reads game state and drains events.
// Composition root: every concern lives in src/render/view/ as a createX(V) factory over one shared context V
// (the game, the scene graph, grid → world mapping, the frame clock); this file builds them in order and runs the
// frame. The order of construction and of the per-frame calls is load-bearing: it fixes the order materials and
// meshes are created (render sort ties) and the order the visual rng (vis) is drawn.
/* global THREE */
import { mulberry32 } from '../sim/rng.js';
import { K } from './kit.js';
import { createLook } from './look.js';
import { bakedWalker } from './figures.js';
import { createFx } from './fx.js';
import { lc } from './view/shared.js';
import { createTerrain } from './view/terrain.js';
import { createFeel } from './view/feel.js';
import { createLandmarks } from './view/landmarks.js';
import { createBeacons } from './view/beacons.js';
import { createMarkers } from './view/markers.js';
import { createRoutes } from './view/routes.js';
import { createBars } from './view/bars.js';
import { createKeep } from './view/keep.js';
import { createMobs } from './view/mobs.js';
import { createHero } from './view/hero.js';
import { createRest } from './view/rest.js';
import { createBirds } from './view/birds.js';
import { createProjectiles } from './view/projectiles.js';
import { createBuildings } from './view/buildings.js';
import { createAllies } from './view/allies.js';
import { createLoot } from './view/loot.js';
import { createPlacing } from './view/placing.js';
import { createFolk } from './view/folk.js';
import { createCamera } from './view/camera.js';
import { createWeather } from './view/weather.js';
import { createLights } from './view/lights.js';
import { createEvents } from './view/events.js';
import { createPicking } from './view/picking.js';
import { createCinema } from './view/cinema.js';
// [assets3] the ?gltf=1 test path
import { createGltf } from './view/gltf.js';
// [folk] the village the folk raise by themselves
import { createVillage } from './view/village.js';
// [econ3] scaffolds on the construction queue
import { createScaffolds } from './view/scaffolds.js';
// [top] begin
import { TOP } from './top.js';
import { createTopCamera } from './view/topdown.js';
import { createTopFlat } from './view/topflat.js';
import { createTopMarks } from './view/topmarks.js';
// [area] next line
import { createAtoms } from './view/atoms.js';
// [v2] next line
import { createHordeMarks } from './view/hordes.js';
import { createTelegraph } from './view/telegraph.js';
// [toppop] next line
import { createTopPop } from './view/toppop.js';
// [topnests] next line
import { createTopNests } from './view/topnests.js';
// [top] end

export function createView(canvas, game, opts = {}) {
  const S = game.state, map = game.map, C = map.town.x;
  const vis = mulberry32(map.seed * 7 + 3);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  // [top] begin: ?top=1 looks straight down through an orthographic camera (view/topdown.js)
  const camera = TOP.on ? new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 300) : new THREE.PerspectiveCamera(28, 1, 0.5, 300);
  // [top] end
  const world = new THREE.Group(), fx = new THREE.Group(); scene.add(world, fx);
  const look = createLook({ renderer, scene, camera, canvas });
  const fx2 = createFx({ renderer, scene });

  // the shared context every view module reads; time, animT and dark are the frame clock, written here and in feel/lights
  const V = { game, S, map, C, opts, canvas, vis, renderer, scene, camera, world, fx, look, fx2, time: 0, animT: 0, dark: 0, repaint: false, focus: null };
  const terrain = createTerrain(V), city = terrain.city;   // sets V.W, V.Wv, V.seenAt, V.city

  // ---------- night light: the hero's lantern is the one real light; every other fire, lamp and window paints the
  // top-down light-pool texture (fx.js), which every lit material samples ----------
  const heroLight = new THREE.PointLight(lc('#ffc890'), 0, 7, 2); scene.add(heroLight);
  V.heroLight = heroLight;

  const feel = V.feel = createFeel(V);
  const landmarks = V.landmarks = createLandmarks(V);
  const beacons = createBeacons(V);
  const markers = V.markers = createMarkers(V);
  const routes = createRoutes(V);
  const bars = V.bars = createBars(V);
  const keep = V.keep = createKeep(V);
  V.gltf = createGltf(V);   // [assets3] null unless ?gltf=1
  const mobs = V.mobs = createMobs(V);
  const hero = V.hero = createHero(V);
  const projectiles = V.projectiles = createProjectiles(V);
  const buildings = V.buildings = createBuildings(V);
  const allies = createAllies(V);
  const loot = createLoot(V);
  const placing = createPlacing(V);
  const folk = V.folk = createFolk(V);
  const cam = V.cam = TOP.on ? createTopCamera(V) : createCamera(V);   // [top]
  const weather = createWeather(V);
  const lights = createLights(V);
  const events = createEvents(V);
  const picking = createPicking(V);
  const cinema = V.cinema = createCinema(V);   // [cinema] the look-at shot (camera.js reads it)
  const rest = createRest(V);   // [nests] the "+ resting" tag at the Camp
  const village = V.village = createVillage(V);   // [folk] the folk's props and scaffold
  const birds = V.birds = createBirds(V);   // [woods] birds flushed from the trees
  const scaffolds = V.scaffolds = createScaffolds(V);   // [econ3] scaffolds on the construction queue
  const topFlat = createTopFlat(V);   // [top] the flat look's light (null without ?top=1)
  V.topMarks = createTopMarks(V);   // [top] bars and tags toward screen-up (null without ?top=1)
  V.atoms = createAtoms(V);   // [area] the engine-built town in its own flat looks (null without an area)
  V.hordeMarks = createHordeMarks(V);   // [v2] where the hordes sleep (null without v2)
  const telegraph = createTelegraph(V);   // [combat2] wind-up rings, whiffs, the dash streak (null without ?v2combat=1)
  V.topPop = createTopPop(V);   // [toppop] the hero, your buildings and the dead pop from above (null without ?top=1)
  V.topNests = createTopNests(V);   // [topnests] the nests as infested buildings in the flat style (null without ?top=1)

  function frame(dt, ui = {}) {
    V.time += dt;
    events.handle(ui.events || []);
    const frozen = feel.tick(dt);
    keep.sync(); buildings.sync(); mobs.sync(); projectiles.sync(); loot.syncChests(); allies.sync(); loot.syncPurses(); landmarks.updateSites(dt, V.time); folk.stepWalkers(dt); weather.stepRain(dt); landmarks.update(V.time); beacons.syncDrops(V.time); beacons.syncSpots(V.time); loot.syncPickups(V.time);
    game.zone();
    terrain.update(dt);
    const dayT = S.phase === 'day' ? game.dayFrac() : 1;
    const skyNow = lights.clock(dt, dayT);

    cinema.update(dt);
    const { R, dist } = cam.update(dt, dayT);
    weather.fog(dt, dist);
    // [top] begin: from above the window is the frustum, the same on every side
    if (TOP.on) city.stream(cam.camTarget.x, cam.camTarget.z, cam.half.w + 4, cam.half.h + 4, cam.half.h + 4);
    // [top] end
    if (!TOP.on) city.stream(cam.camTarget.x, cam.camTarget.z, R * Math.max(1.7, camera.aspect * 1.4) + 4, R * 4.2 + 5, R * 2.3 + 4);
    lights.cycle(R);
    weather.storm(dt);
    lights.night(dt, skyNow);

    folk.villagers.update(dt, V.time, V.dark);
    allies.update(dt);
    loot.bobPurses(dt);
    mobs.updateFlames();
    hero.update(dt, frozen);
    mobs.draw(dt, frozen);
    projectiles.updateEffects(dt);
    loot.bobChests(dt);
    buildings.update(dt);
    keep.update();
    markers.updateMain();
    rest.update(dt);
    village.update(dt, ui.events);   // [folk]
    birds.update(dt, ui.events);   // [woods]
    scaffolds.update(dt);   // [econ3]
    routes.update();
    markers.updateSelection(dt, ui.selected);
    placing.setGhost(ui.ghost || null); placing.setZone(ui.zone || null);
    weather.ambient(dt, frozen, R);
    fx2.blobs.end(0.42 - 0.12 * V.dark);
    fx2.update(V.animT, 1 - 0.78 * V.dark);
    if (topFlat) topFlat.update();   // [top]
    if (V.topMarks) V.topMarks.update();   // [top]
    if (V.atoms) V.atoms.update(cam.camTarget);   // [area]
    if (V.hordeMarks) V.hordeMarks.update();   // [v2]
    if (telegraph) telegraph.update(dt, ui.events);   // [combat2]
    if (V.topPop) V.topPop.update();   // [toppop]
    if (V.topNests) V.topNests.update(dt);   // [topnests]
    look.render(V.time);
  }

  const { resize } = cam;
  return {
    frame, pick: picking.pick, project: picking.project, showMove: markers.showMove, resize, routes: routes.list, groundAt: picking.groundAt, startOrbit: cam.startOrbit,
    debug: { K, look, fx: fx2, city, snap: lights.snap },   // snap: jump the light to the current time of day (tests, screenshots)
    scene, camera, info: () => new Promise(res => { const I = renderer.info; I.autoReset = false; requestAnimationFrame(() => { I.reset(); requestAnimationFrame(() => { const o = { calls: I.render.calls, tris: I.render.triangles, geos: I.memory.geometries }; I.autoReset = true; res(o); }); }); }),   // one whole frame (all passes)
    setZoom: cam.setZoom, getZoom: cam.getZoom,
    lookAt: (x, y, o) => { V.focus = null; cinema.look(x, y, o); }, skipLook: cinema.skip, looking: cinema.active,   // [cinema]
    // let this view go: free what it put on the GPU
    dispose: () => { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); world.clear(); fx.clear(); scene.clear(); renderer.renderLists.dispose(); renderer.dispose(); },
    setQuality: q => { look.setQuality(q); resize(); }, quality: () => look.quality(),
  };
}
