# Architecture

Hold Hollowmere is a zero-dependency ES-module game. three.js r128 is the only runtime library; it is loaded
from a CDN as a global (`THREE`), along with the classic helper scripts in `vendor/`.

There is one game: **V2**. The camp stands in an engine-built town (`src/engine`, a recipe such as `suburb`), the
world is seen from straight above, the hero fights with telegraphed bites and a dash, searches houses and claims
sites by day, and by night the hordes wake round their spots and one of them now and then marches on the camp.
The old frontier game (the frontier map, waves and forecast, hives and the Inferno, the Rig's systems, the road
and missions, contracts, acts, carts, power and noise, districts, stats, class abilities and evolution,
blessings and relics, Flare Nights, the Chronicler, the tilted camera) was deleted on Oct 25; git history keeps it.

The code has three layers that talk in one direction:

```
 content/ (data: numbers and words)        engine/ (the town generator: recipes → a world of atoms)
     │                                          │
     ▼                                          ▼
 sim/  ── game.state (S) ──►  render/  (reads S, draws the world)
  ▲   └─ S.events  ─drain─►   ui/      (reads S, HUD, cards and input)
  │                              │
  └──── public API (sim/api.js) ◄┘   commands: build, heroTo, dash, choose, claimLandmark …
```

- **sim** owns every rule and every number. It has no DOM and no three.js. It is seeded and deterministic: the same
  seed and the same inputs give the same run.
- **render** only reads `game.state` and the events that the UI drains each frame. It never changes the game.
- **ui** drives the game only through its public API. Bots and tests use the same API.

## Data flow, one frame

1. `ui/app.js` frame loop: it steps the sim at a fixed `STEP` (1/60 s, up to 240 steps a frame, scaled by game speed).
2. Rules push events with `ev(t, payload)` (`sim/core.js`) into `S.events`.
3. `ui.game.drainEvents()` empties the queue once a frame. The events go to audio, the HUD and then
   `view.frame(dt, { events, selected, ghost, zone })`.
4. `render/view.js` runs its frame. It turns the events into feedback (rings, particles, shake), syncs the meshes
   with `S` (buildings, mobs, allies, loot…), moves the camera, sets the light, and renders.

Event payloads must not carry a field called `t`, because `ev` spreads the payload first and then sets
`{ t: type }`, so the type overwrites it. Durations go in `dur`, for example the wind-up's `e.dur`.

## Composition roots

Each layer has one composition root. It builds a shared context and fills it from small factories, one module
per concern:

| Layer | Root | Context | Factories |
|---|---|---|---|
| sim | `src/sim/game.js` | `G` (S, map, rngs, every module's functions; late slots read as `G.x`) | `createX(G)` in `MODULES` order |
| ui | `src/ui/app.js` | `ui` (game, view, card, selected, placing…; changing slots read as `ui.x`) | `createX(ui)` |
| render | `src/render/view.js` | `V` (game, S, scene graph, `W`/`Wv`, frame clock `time`/`animT`/`dark`) | `createX(V)` in `src/render/view/` |
| kit | `src/render/kit.js` | none: `K` is a namespace object | plain modules in `src/render/kit/` |
| engine | `src/engine/pipeline.js` | a `world` (`engine/world.js`) | stages, atoms and validators in `engine/registry.js`, listed per recipe in `engine/recipes.js` |

In every root, creation order and per-frame call order are load-bearing:
- **sim**: the order fixes the draws from the seeded streams. The golden test catches any change.
- **render**: the order fixes when materials and meshes are created, which sets the render-sort ties, and the
  order of draws from the visual rng `vis`.

## The map

`sim/mapgen.js` always builds an engine area (`DEFAULT_AREA = 'hollowmere'`, chapter 1's town; `createGame({ area })` picks another
recipe). `sim/areamap.js` rasterises the engine's world onto the square grid round the camp: terrain, the
town's houses (`map.area.homes`, searched by day), its sites (landmarks you claim) and its nest. The grid is
`N` cells a side, one exported constant in `mapgen.js` (672 today, so the 600 × 500 m Hollowmere fits): raise it there and nowhere else. Regions are
the camp plus eight sectors in two bands (all ring 1). The map keeps its old fields (`terrain`, `reach`,
`region`, `regions`, `slots`, `landmarks`, `town`, `high`, `lm`…), so the rules read it as before.

Chapter 1 starts in Hollowmere; the start screen offers the other recipes in `AREAS` (`sim/areamap.js`) only when
`?area=` is in the URL, which also picks one (`ui/area-flag.js`).

## Chapter 1

In Hollowmere `sim/chapter.js` runs the chain in `content/story1.js` (numbers in `content/ch1tune.js`): the story
is told only in the world (notes on search, graffiti, radios: `content/notes.js`), plus short [bracketed] System
lines over Kai (`sys1` events). The old card engine (`sim/story.js`) is quiet there. `tools/ch1bot.mjs` plays the
chapter through (`test/chapter1.test.mjs`); `api.chapterJump(id)` skips ahead for tests and screenshots. The
Mechanic class and the Rig's modules come from another branch: the chapter reads them through guarded hooks
(`G.salvage`, `G.rigHas`, `G.rigBeds`, `G.addParts`, `G.partsHave`, `G.rigUnlock`) and passes without them.

## Module map

### `src/content/`: pure data, so tuning starts here

`buildings` · `towers` (the level 3 roles) · `mobs` (mobs, the tide: day and night lengths) · `heroes` ·
`combat2` (wind-ups and the dash) · `hordes` (horde count, size, spacing, march odds) · `perks` (the `S.P`
modifiers story choices move) · `packs` · `names` · `solar` (the Solar Flare canon, the opening, the crew,
the turn-of-day lines) · `barks` (citizen and crew lines) · `season` (pacing, rules) · `folk` (the folk's
projects) · `story` (encounters, with their text) · `story1`, `notes`, `mechanic`, `rig2` (chapter 1,
"The Engine Works", for the `hollowmere` recipe) · `scavenge` · `weather` · `legacy` · `woods` (worn trails) ·
`econ` (the construction queue, the Settlement) · `stronghold`, `logging`, `pressure` (ported from Gemini's fork)

### `src/engine/`: the town generator

A recipe (`recipes.js`) lists atoms, stages and validators; `pipeline.js` runs them on a fresh `world` from a
seed tree (`seeds.js`), retrying when a fatal validator fails. `schema.js` (atoms are data), `sockets.js`,
`network.js` (street networks), `frontage.js` (lots along a street), `occupancy.js`, `spatial.js`, `geom.js`,
`units.js` (one unit is one metre), `palettes.js` (colours are roles), `names.js` (street names), `draw2d.js`
(the flat top-down look, also used by the view), `chapter1.js` (the suburb recipe under its old name).

### `src/sim/`: the rules

| Module | Concern |
|---|---|
| `game.js` | composition root: state, `G`, start-of-run setup (in a fixed order), `step()` |
| `state.js` | every tuning constant the rules read, plus `createState` (the shape of S) |
| `api.js` | the public API object (a contract: add, never rename) |
| `core.js` | `ev`, `toast`, `fail`, `earn`, pop, rules, reveal, `rollOffer` (drops picks: V2 has no blessing cards) |
| `mapgen.js`, `areamap.js` | the map (always an engine area), `N`, terrain kinds, landmarks; the engine town rasterised |
| `economy.js` | costs, hands, what homes and farms give, the keep's needs, the dawn |
| `income.js` | scrap and food by the second (day and, slower, night); dawn closes the cycle for the ledger |
| `buildings.js`, `build.js` | grid, footprints, `canPlace`, placing and removing; build, upgrade, demolish, rebuild |
| `construct.js` | the construction queue: a placed building is a scaffold until a crew finishes it |
| `settle.js` | the dawn Settlement: a well-run night pays XP |
| `waves.js` | night length and time of day, `spawnMob` / `spawnAtNest`, `startNight`, the night queue the hordes fill |
| `hordes.js` | the V2 night: hordes sleep at the town's sites, nest and far doors, wake at dusk, one marches now and then |
| `forecast.js` | tonight's march for the UI: the marching horde and its traced route (`view/routes.js` draws it) |
| `combat.js` | towers, crews, damage, hits, death |
| `combat2.js` | telegraphed bites (`windup`, `whiff`) and the hero's dash with i-frames |
| `brain.js`, `steer.js` | the dead's minds (roamers, scent, hunting) and feet round walls; where a dead may stand |
| `nests.js` | where a nest's body stands, and what is near one |
| `search.js` | searching the town's houses: stand at a door and the hero turns it over (once a day) |
| `districts.js` | sites: walking up to a landmark and claiming it (`landmarkReach`, `claimLandmark`) |
| `pacify.js` | Return to Camp from a held site, and the dusk warning |
| `towers.js` | tower specialisations at level 3 (Mortar, Brazier, Ballista, Watch Bell) |
| `loot.js`, `spots.js` | street finds, supply drops; where an objective may stand |
| `hero.js` | xp and levels, walking and pathing, the autopilot |
| `seasons.js` | season rules, weather from rules, difficulty |
| `story.js`, `daily.js` | the story engine (own RNG); the daily quest |
| `folk-build.js` | the folk build by themselves: needs, the village fund, one project a day |
| `woods.js`, `logging.js`, `pressure.js`, `stronghold.js` | worn trails; felling trees; committed hunters; small and strong |
| `save.js` | dawn snapshot and restore (`SAVE_V`) |
| `places.js` | [ch1] Hollowmere's sites and borrowed buildings as the story's places (a spot at each door), the story district under a point |
| `chapter.js` | [ch1] the chapter-1 quest engine: story1 STEPS (triggers, goals, rewards), work spots, packs, the finale, the end; `S.tide` day and night lengths |
| `worldtext.js`, `survivors.js`, `chnests.js` | [ch1] notes, graffiti spots, radios; Lotte, Benno, Gus; the cinema, goods shed and Works as Ash Hearts with halls |
| `flow.js`, `planner.js`, `scavenge.js`, `rng.js` | flow fields, the town builders, scavenging, seeded RNG |

### `src/render/`: the three.js view

The camera is orthographic and looks straight down (`view/topdown.js`); people are drawn `TOP_FIG` (1.8×) bigger
than true scale (`render/top.js`).

| Module | Concern |
|---|---|
| `view.js` | composition root: builds `V` and the view modules in order, runs `frame()`, returns the API (`window.__view`) |
| `view/shared.js` | constant tables: `lc`, `BSCALE`, `FOOT`, `UNIT`, hero rigs, house colours, `ringGeo` |
| `view/terrain.js` | grid → world (`W`, `Wv`), `seenAt`, the shroud and territory repaint |
| `view/atoms.js` | the engine town drawn in its own flat looks (`engine/draw2d.js`) |
| `view/topdown.js` | the top-down camera: follow spring, lead, dusk dolly, cinema, shake, resize |
| `view/topflat.js`, `view/topmarks.js`, `view/toppop.js`, `view/topnests.js` | the flat light; bars and tags toward screen-up; the hero, buildings and dead popping from above; the nest as an infested building |
| `view/worldtext.js`, `view/chapter.js` | [ch1] graffiti decals, radio lines, the System over Kai; jobs, hearts, survivors, radios, the torch, the objective beacon, the Rig rolling out |
| `view/hordes.js`, `view/routes.js`, `view/telegraph.js` | where the hordes sleep; tonight's march chevrons; wind-up rings, whiffs and the dash streak |
| `view/feel.js`, `view/events.js` | fx hooks (`burst`, `dust`, `celebrate`, `floatLabel`, hit-stop, trauma); drained events → feedback |
| `view/keep.js` | the camp's heart: the Haven Rig truck model (`K.haven`), its fires, smoke, beacon and hum |
| `view/buildings.js`, `view/scaffolds.js` | building models (cached, flattened), pads, ruins, upgrade sweep; a scaffold on every blueprint |
| `view/mobs.js`, `view/hero.js`, `view/allies.js`, `view/folk.js`, `view/village.js` | the crowd; the hero rig; sellswords and companions; townsfolk; the folk's props |
| `view/landmarks.js`, `view/beacons.js`, `view/markers.js`, `view/loot.js`, `view/projectiles.js`, `view/bars.js` | sites and their frames and icons; drops and beacons; rings and the MAIN marker; loot; shots; health bars |
| `view/lights.js`, `view/weather.js`, `view/birds.js`, `view/rest.js` | the time-of-day clock (`V.dark`), light pools, windows; rain and lightning; birds; the resting tag |
| `view/picking.js`, `view/placing.js`, `view/cinema.js`, `view/gltf.js` | `groundAt`, `pick`, `project`; the ghost; the look-at shot; the GLTF test path (`--gltf`) |
| `kit.js` + `kit/` | the model kit (`K`): `builder` (B), `materials`, `palette`, `territory`, `houses`, `defences`, `farm`, `keep`, `haven` (the truck), `people`, `hives` (landmark props), `village`, `lumber`… |
| `city.js` | woods, ground and streets from the cell map; streaming |
| `look.js`, `palette.js`, `readable.js`, `ink.js` | light, sky, post-processing, quality; the colour tokens; the readability colours from above; the ink line |
| `fx.js`, `figures.js`, `meshes.js`, `villagers.js` | pooled particles, rings, labels, light pools; baked crowd figures; mesh builders; villager logic |

### `src/ui/`: screens, HUD and input

| Module | Concern |
|---|---|
| `app.js` | composition root: `ui` context, the modules, the frame loop |
| `shared.js` | `$`, `store`, audio, saves, flags, text helpers, `WHATS_NEW` |
| `start.js`, `intro.js`, `area-flag.js` | start screen, beginning or continuing a run (creates the game and the view); the opening cards; which recipe |
| `hud.js`, `system.js`, `solar-voice.js` | the System strip and toasts, banners, top bar; the System's voice; one crew bark a dawn |
| `cards.js`, `status.js`, `panels.js` | the one modal (story cards, System windows); the Status window and More sheet; the selection panel |
| `placing.js`, `econ-ui.js`, `folk-ui.js`, `logging-ui.js` | the build tray and placing; the construction queue chip; the folk's project chip; the trees panel |
| `chapter-ui.js` | [ch1] the district, the objective line, the notes drawer, the chapter's end card |
| `input.js`, `dodge.js`, `homeward.js` | touch, mouse and keys; the dash key and button; the walk home and Return to Camp |
| `map.js`, `cinema.js` | world map and minimap; first-time look-at shots |
| `icons.js`, `audio.js`, `saves.js`, `version.js` | the icon set, synthesised sound, cloud saves, the build tag |

## The story split

`sim/story.js` builds every offer, cost and effect; `content/story.js` (and `story1.js` for chapter 1) holds the
text. The engine owns every number.

## Tools

- `tools/build.mjs`: inlines every module reachable from `src/main.js` into `index.html` as one classic script
  (plus the `vendor/` helpers) → `dist/index.html`. `--area <id>` sets the build's default recipe, `--gltf` the
  GLTF test path. The bundler is a set of regexes, so the module syntax must stay simple (CLAUDE.md).
- `tools/golden.mjs`: four scripted V2 runs (A suburb survivor with a save round trip, B milltown on autopilot,
  C downtown nightmare with nobody building, D suburb story with a hand-built camp and a claimed site), each
  hashing the core state, the event stream and the API's queries every dawn.
- `tools/bot.mjs`: the scripted player (day turn, hero tick, the V2 habits `storyTurn`, `dodge`, `searchTick`,
  and `playRun`).
- `tools/clockbot.mjs`, `tools/sweep.mjs`: the V2 survival sweep (one JSON line per seed; the sweep prints the
  per-seed `reached` list, the falls, and how the camp held on the nights a horde marched).
