# Architecture

Hold Hollowmere is a zero-dependency ES-module game. three.js r128 is the only runtime library; it is loaded
from a CDN as a global (`THREE`), along with the classic helper scripts in `vendor/`.

The code has three layers that talk in one direction:

```
 content/ (data: numbers and words)
     │
     ▼
 sim/  ── game.state (S) ──►  render/  (reads S, draws the world)
  ▲   └─ S.events  ─drain─►   ui/      (reads S, HUD, cards and input)
  │                              │
  └──── public API (sim/api.js) ◄┘   commands: build, heroTo, choose, startNight …
```

- **sim** owns every rule and every number. It has no DOM and no three.js. It is seeded and deterministic: the same
  seed and the same inputs give the same run.
- **render** only reads `game.state` and the events that the UI drains each frame. It never changes the game.
- **ui** drives the game only through its public API. Bots and tests use the same API.

## Data flow, one frame

1. `ui/app.js` frame loop: it steps the sim at a fixed `STEP` (1/60 s, up to 240 steps a frame, scaled by game speed).
2. Rules push events with `ev(t, payload)` (`sim/core.js`) into `S.events`.
3. `ui.game.drainEvents()` empties the queue once a frame. The events go to audio, the HUD, the road UI and then
   `view.frame(dt, { events, selected, ghost, zone })`.
4. `render/view.js` runs its frame. It turns the events into feedback (rings, particles, shake), syncs the meshes
   with `S` (buildings, mobs, allies, loot…), moves the camera, sets the light, and renders.

Event payloads must not carry a field called `t`, because `ev` spreads the payload first and then sets
`{ t: type }`, so the type overwrites it. Durations go in `dur`, for example the flare's `e.dur`.

## Composition roots

Each layer has one composition root. It builds a shared context and fills it from small factories, one module
per concern:

| Layer | Root | Context | Factories |
|---|---|---|---|
| sim | `src/sim/game.js` | `G` (S, map, rngs, every module's functions; late slots read as `G.x`) | `createX(G)` in `MODULES` order |
| ui | `src/ui/app.js` | `ui` (game, view, card, selected, placing…; changing slots read as `ui.x`) | `createX(ui)` |
| render | `src/render/view.js` | `V` (game, S, scene graph, `W`/`Wv`, frame clock `time`/`animT`/`dark`) | `createX(V)` in `src/render/view/` |
| kit | `src/render/kit.js` | none: `K` is a namespace object | plain modules in `src/render/kit/` |

In every root, creation order and per-frame call order are load-bearing:
- **sim**: the order fixes the draws from the seeded streams. The golden test catches any change.
- **render**: the order fixes when materials and meshes are created, which sets the render-sort ties, and the
  order of draws from the visual rng `vis`.

## Module map

### `src/content/`: pure data, so tuning starts here

`buildings` · `mobs` (mobs, waves, tide) · `heroes` · `perks` (blessings) · `packs` · `districts` · `names` ·
`solar` (the Solar Flare canon, opening, acts, System voice) · `barks` (citizen lines) · `season` (pacing, rules) · `folk` (the folk's projects) · `contracts` · `story` (encounters, with the offline text) · `scavenge` · `road`
(numbers and words for the road and missions) · `weather` · `legacy` · `woods` (worn trails)
`season` (pacing, rules) · `folk` (the folk's projects) · `contracts` · `story` (encounters, with the offline text) · `scavenge` · `road`
(numbers and words for the road and missions) · `weather` · `legacy` · `woods` (worn trails) · `econ` (`[econ3]` queue, carts, nodes, trickle share, settlement; `ECON` flags) · `relics` (`[econ3]` relics, tomes, blueprints)
`buildings` · `towers` (the level 3 roles) · `mobs` (mobs, waves, tide) · `heroes` · `perks` (blessings) · `packs` · `districts` · `names` ·
`season` (pacing, rules) · `contracts` · `story` (encounters, with the offline text) · `scavenge` · `road`
(numbers and words for the road and missions) · `weather` · `legacy`

### `src/sim/`: the rules

| Module | Concern |
|---|---|
| `game.js` | composition root: state, `G`, start-of-run setup (in a fixed order), `step()` |
| `state.js` | every tuning constant the rules read, plus `createState` (the shape of S) |
| `api.js` | the public API object (a contract: add, never rename) |
| `core.js` | `ev`, `toast`, `fail`, blessings owned, `earn`, pop, rules, reveal (created first) |
| `economy.js` | costs, hands, power, what homes and farms give, the keep's needs |
| `buildings.js` | grid, footprints, `canPlace`, placing and removing |
| `build.js` | day actions: build, palisade lines, upgrade, demolish, rebuild |
| `waves.js` | which hives are awake, the night's budget and waves |
| `forecast.js` | threat ratio and rating, the night's paths |
| `combat.js` | towers, crews, damage, hits, death |
| `noise.js` | the Noise meter |
| `brain.js` | the dead's minds: roamers, scent, hunting, ambushes |
| `hives.js` | streams from hives, burning a hive, the horde |
| `nests.js` | hives defend themselves: the guard pack, proximity rage, sites locked until their hive burns |
| `pacify.js` | `[pacify]` quiet land: the Camp, claimed regions and `PACIFY.r` beyond the base (minus an awake hive's reach); a hive asleep there is smothered (never wakes, on the map, still burnable); every waking hive is revealed with a System line; the home threat `homeK` (a ≤ 1 ratio on `nightBudget` after night 10: the curve read at a "home night" = slow plateau + a load per awake, unpacified hive); Return to Camp (by day, from a lit fire or a held site, 2.5 s channel, 45 s cooldown) and the dusk warning |
| `steer.js` | the dead's feet round walls (a small cached A* when the straight line is blocked) and the spawn-ground test |
| `towers.js` | tower specialisations at level 3 (Mortar, Brazier, Ballista, Watch Bell): choosing one, how each fires, the shell burst, their share of the threat estimate (`[towers]` hooks in combat.js and brain.js) |
| `loot.js` | street finds, supply drops |
| `districts.js` | sites, sealed districts, kits |
| `seasons.js`, `contracts.js` | season rules, weather, contracts (the engine side) |
| `hero.js` | xp and levels, ability, class evolution, pathing, autopilot |
| `blessings.js` | offers and rerolls |
| `save.js` | dawn snapshot and restore |
| `story.js` | story engine: picks encounters and applies their effects (own RNG) |
| `daily.js` | the daily quest: offered when calm (Accept / Not now), progress, settled at dawn |
| `income.js` | scrap and food by the second (day and, slower, night); dawn closes the cycle for the ledger |
| `road.js`, `missions.js` | the road, stations, convoys, night missions (`[road]` feature) |
| `folk-build.js` | the folk build by themselves: needs, the village fund (a share of income), one project a day, props, beauty (`[folk]` hooks) |
| `woods.js` | worn trails: woods the hero keeps walking through turn to dirt (`[woods]` hooks in game.js, save.js) |
| `rig.js` | `[rig3]` the Haven Rig (the keep that moves): Plating / Guns / Cargo / Speed rise for good with the town's building tiers (`content/rig.js`), `rigK` scales the keep's hp, damage and shots; Pack up & roll (`rigPack`: by day, once the act's road is open) salvages every ground building into cargo (80–100%: tier, Cargo, the hero's GOV); `rigArrive` gives the next act's run what rode along; events `rigUp`, `rigRoad`, `rigMigrate`, `rigAnchor`, `actStart`; wraps snapshot/restore with a versioned `rig` block |
| `migrate.js` | `[rig3]` the act change: `migrateRun(api)` builds the next act's game (new seed and map seed, the act theme, the carried hero, stats, story, cargo); not imported by game.js (no cycle) |
| `legmap.js` | `[rig3]` an act's map theme on top of mapgen: act 2 (the rail yard) thins the woods, lays freight lines (`map.rail`) and places boxcars, a gantry crane and a water tower (`map.decor`) |
| `construct.js` | `[econ3]` the construction queue: a placed building is a blueprint (scaffold, attackable, does nothing yet); upgrades and carts are jobs too; crews (1 + one per 5 people) work it top down, skipping a site with the dead close by; reorder and cancel (full refund) |
| `haul.js` | `[econ3]` harvester carts and resource nodes: timber stands and scrap heaps in three bands that run dry; carts drive from the keep's yard, load, drive home and unload (the main scrap income; the trickle keeps `TRICKLE`); the dead go for a passing cart; more carts by Camp level |
| `relics.js` | `[econ3]` no blessing cards: every pick becomes a find (relic, stat tome, blueprint: `content/relics.js`); the dawn Settlement report pays XP for a well-run town |
| `mapgen.js`, `flow.js`, `planner.js`, `scavenge.js`, `rng.js` | map generation, flow fields, town builders, scavenging, seeded RNG |

### `src/render/`: the three.js view

| Module | Concern |
|---|---|
| `view.js` | composition root: builds `V` and the view modules in order, runs `frame()`, returns the API (`window.__view`) |
| `view/shared.js` | constant tables: `lc`, `BSCALE`, `FOOT`, `UNIT`, hero rigs, house colours, `ringGeo` |
| `view/terrain.js` | grid → world (`W`, `Wv`, plateaus), `seenAt`, city build, shroud and territory repaint, scan wave |
| `view/feel.js` | fx hooks: `burst`, `dust`, `celebrate`, `floatLabel`; hit-stop, trauma, `mobOf`, flares list |
| `view/events.js` | turns drained events into feedback |
| `view/hives.js` | hive models (a hollow that took a building: the rot on that building), glow, haze, eyes, eruption swell, hive bars |
| `view/rest.js` | the "+ RESTING" tag while the hero heals at the Camp |
| `view/birds.js` | birds flushed from the trees as the hero walks the woods, or by a kill there (ambience only) |
| `view/landmarks.js` | landmark and district-site models, lot frames, icons, quest marks (plus retired scavenge caches) |
| `view/beacons.js` | supply drops, street-encounter and trial beacons |
| `view/fences.js` | quarantine fences, scouted-district banners |
| `view/markers.js` | selection, range, move, hero and bounty rings, contract tag |
| `view/routes.js` | tonight's route chevrons |
| `view/bars.js` | health bars (`makeBar`, `setBar`) |
| `view/keep.js` | the hall: rebuilt on level change, its fires and smoke (`fires`, `smoke`) |
| `view/buildings.js` | building models (cached, flattened), pads, cheer, ruins, pop, upgrade sweep, tower tags |
| `view/mobs.js` | the crowd (instanced dead, dying, townsfolk, camp-fire circle), boss tags, flames |
| `view/hero.js` | hero rig, x-ray, aura, hero and bounty ring placement, hero bar |
| `view/allies.js` | sellswords and companions |
| `view/projectiles.js` | arrows, spit, bolts |
| `view/loot.js` | chests, purses, street pickups |
| `view/placing.js` | placement ghost and build-zone overlay |
| `view/folk.js` | villagers and scavenger crews |
| `view/village.js` | the folk's props (instanced, `kit/village.js`) and the scaffold on today's project |
| `view/haul.js` | `[econ3]` resource nodes (shrink as they are picked), harvester carts, a scaffold on every blueprint in the queue |
| `view/camera.js` | zoom, follow spring, dusk dolly, orbit, shake, resize |
| `view/weather.js` | rain, fog, lightning, ambient particles |
| `view/lights.js` | time-of-day clock (sets `V.dark`), light pools, windows, lenses, rim, mist, blackout |
| `view/picking.js` | `groundAt`, `pick`, `project` |
| `view/cinema.js` | the look-at shot: camera eases to a place and back, beam, ring and tag (`lookAt`, `skipLook`, `looking`) |
| `kit.js` + `kit/` | the city kit: `config` (CFG), `palette`, `territory` (mask and shader hook), `materials`, `rng`, `builder` (B), `helpers`, `city`, `street`, `craft`, `houses`, `defences`, `farm`, `keep`, `frontier` (hall, home), `hives`, `rig`, `people`, `overlays`, `flatten` |
| `city.js` | woods, ground, streets and ruins from the cell map; streaming |
| `look.js` | lights, sky, post-processing, quality levels |
| `palette.js` | the storybook colour tokens (`PAL`: sky, haze, ground, caution-yellow, ember, System blue, warm ink, Ash-Born skin). Change a colour here, not in look.js / city.js |
| `ink.js` | `inkify(obj, { w, color, kind })`: gives every mesh under `obj` a back-face ink hull in `PAL.ink` (constant ~1.5 px, shares the geometry, one extra draw per mesh). Call it on any new static model (nests, the Rig, carts) once, where the model is built or cached; `setInk(false)` switches all `static` hulls off. Characters (`liveRig`, `createCrowd`) have their own hulls in figures.js. |
| `fx.js` | pooled particles, rings, labels, light pools, blob shadows |
| `figures.js` | baked crowd figures, live rigs, x-ray material |
| `meshes.js`, `villagers.js` | small mesh builders, villager logic |
| `road-view.js` | the road, drawn (`[road]` feature) |
| `view/haven.js` | `[rig3]` the Haven Rig in motion: packed ↔ anchored pose, fold → drive off (camera follows via `V.rigCam`), drive in → unfold; a tap skips |
| `view/legs.js` | `[rig3]` an act's look: its ground colours (`GROUND_TINT` in city.js) and the rail yard's rails, boxcars, crane, water tower |
| `kit/haven.js` | `[rig3]` the Haven Rig model (`K.haven`, `K.setHaven`): cab, tracks, flatbed, stacks, halogens, outriggers, awnings, solar pylon; turrets, plates and crates follow the Rig's systems |

### `src/ui/`: screens, HUD and input

| Module | Concern |
|---|---|
| `app.js` | composition root: `ui` context, the modules, the frame loop |
| `shared.js` | `$`, `store`, audio, Chronicler, saves, flags, text helpers |
| `start.js` | start screen, beginning or continuing a run, creates game and view |
| `map.js` | world map and minimap |
| `cards.js` | the one modal: story cards and System windows |
| `status.js` | Status window, companion chat, More sheet |
| `hud.js` | System strip and toasts, banners, top bar |
| `placing.js` | build tray, placing, palisade lines |
| `panels.js` | selection panel |
| `input.js` | touch, mouse, keys |
| `cinema.js` | first-time hive shots (the first hollow, city hive, burst): queues them past cards, slows the sim, tap skips |
| `system.js`, `icons.js`, `audio.js`, `saves.js` | the System's voice, icon set, synthesised sound, cloud saves |
| `story-ai.js` | the Chronicler: Claude rewrites words only; every answer is validated |
| `road-ui.js` | road and mission HUD (`[road]` feature) |
| `homeward.js` | `[pacify]` the walk home on the Camp pill and the Return to Camp button |
| `folk-ui.js` | the folk's project chip (veto), "Let them build" in the build menu, their ledger line |
| `rig-ui.js` | `[rig3]` the Rig section of the Camp panel (systems, what raises them, the cargo), the Pack up & roll pill and confirmation, the act change (`ui.beginRun` swaps the game and the view, then saves) |
| `econ-ui.js` | `[econ3]` the construction queue chip (reorder, call off), the carts row in the build menu, a blueprint's panel, the Settlement report toast |

## The story split: the engine owns the numbers, the story AI owns the words

`sim/story.js` and `sim/contracts.js` build every offer, cost and effect. `content/story.js` and
`content/contracts.js` hold the offline text. `ui/story-ai.js` (the Chronicler) may rewrite names, framing and
prose, and may pick from menus that the engine offers. Its answers are parsed and validated, and anything that
does not validate is dropped in favour of the script. A Chronicler answer never sets a number.

## Build

`node tools/build.mjs` inlines every module reachable from `src/main.js` into `index.html` as one classic
script, and inlines the `vendor/` helpers too. The output is `dist/index.html`. The bundler is a set of regexes,
so the module syntax must stay simple. CLAUDE.md lists the rules.
