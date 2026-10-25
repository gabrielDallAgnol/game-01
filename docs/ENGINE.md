# The V2 engine: worlds from atoms

V2 Hollowmere builds its world from **atoms**. An atom is a data record for one thing: a house, a tree, a lamp,
a tarp. Code never draws or places a thing it has no atom for. The engine is in `src/engine/`, the atoms are in
`src/atoms/`, and nothing in v56 imports either yet, so the golden test does not see them.

Try it: run `node tools/lab/build-lab.mjs`, then open `dist/atomlab.html`. Use the variant switch to pick a recipe.

## Recipes: variants of an area

A **recipe** lists the atoms, the stages in order, and the params for one variant of an area. All recipes live in
`recipes.js`, and the same pipeline, validators and renderer build every one of them.

| Recipe | Layout | Stages |
|---|---|---|
| `suburb` | a grid of houses, Route 9, Hollow Creek | terrain → water → roads → lots → buildings → camp → bridges → props → forest → nav |
| `milltown` | a rail line, rowhouses in runs, ruins near the nest, a mill on a siding | terrain → rail → streets → mill → nest → terraces → camp → props → forest → nav |
| `downtown` | tall shopfront rows round square blocks, a plaza, a canal | terrain → water → streets → civic → terraces → camp → bridges → props → forest → nav |
| `hollowmere` | chapter 1 as one 600 × 500 m town drawn on Nauen (see below) | terrain → townplan → districts → landmarks → suburbs → buildings → terraces → courtyards → camp → props → avenues → forest → zones → nav |

The shared stages (terrain, camp, props, forest, nav) and all the validators are the same code in both recipes.
`buildArea(id, seed)` builds one recipe. `chapter1.js` is now just the suburb recipe.

## Hollowmere: the chapter-1 town

One town shaped like Nauen (Brandenburg), with the three variants above as its districts. It takes 2–3 minutes to cross on foot.

| Part of the plan | Where it comes from |
|---|---|
| A round old town, about 300 m across, in a **ring street** (Mauerstraße, where the wall stood). The ring is a closed polygon. An inner ring at 0.66 R is where the town grew from. | `townplan` draws them, and `network.js` makes the junctions |
| The **church square** in the middle: St Jacobi in its north half, the camp (Haven Rig) in its south half, the school across its north street | `landmarks` (sites `site.church`, `site.school`) |
| The **main street**, straight from the south edge through the south gate to the square, then on to the station. The town hall stands just inside the south gate. | `townplan` roles `south` and `main`, plus `landmarks` `site.townhall` |
| Lanes to the gates (E/W from the square, diagonals from the inner ring), with tall party-wall rows on them. The square and the main street get shop rows (`rowTag`). | `terraces` honours `s.sides` / `s.rowTag` |
| Back houses and sheds fill the block interiors | `courtyards` (`yard.old` atoms) |
| The wall promenade (a footpath on the old wall line), with avenues of trees on both sides | `townplan` path pieces, plus `avenues` |
| **North**: the line, the station and its platform, the sugar works on a siding (the overgrown **finale**), goods halls | `townplan` (rail), `landmarks` |
| The **water tower** at the north-west gate, the **park** east (reached by a footpath), the **barn quarter** west on a barn lane, the **mast field** south-west at the end of the mast lane | `townplan` zones, plus `landmarks` |
| Suburbs: a grid in the town frame, kept only where the land is suburb, and house lots on it and on the country roads | `townplan` (grid), `suburbs` (lots), `buildings` |

**What the game reads** (all in metres, world coordinates):
- `W.camp` `{x, y, r}`: the camp spot on the church square. `W.plaza`: the square's oriented box.
- `W.districts`: `[{ id, i, name, kind, poly, at, area, palette, buildings, homes, offers }]`, tested in that order by
  `W.districtAt(x, y)`. The ids are `oldtown`, `station`, `works`, `masts`, `park`, `barns`, `south`, `west` and `east`. The kinds are `oldtown`, `rail`,
  `industry`, `field`, `park`, `barns` and `suburb`. `palette` is `DISTRICT_LOOKS[kind]`: a ground `tint` role with an `alpha`, and a `roofs`
  role remap, which `draw2d` applies to buildings. Every placed atom gets `p.district` (an index), and every lot and street gets `.district` (an id).
- `W.sites`: `{ church, school, townhall, station, platform, works, watertower, transmitter, masts: [] }`, the placed records.
- `W.finale`: `{ uid, id, x, y, r, lot }`, the overgrown sugar works (atom tags `finale`, `nest`, `infested`; `variantOf` names the
  clean mill for after it falls). Atoms tagged `nestable` (barns, goods hall, workshop) are the ordinary buildings the dead may take.
- `W.town`: the frame and the plan maths. `at(u, v)`, `loc(x, y)`, `e(x, y)` (elliptic radius: < 1 inside the ring), `zoneAt(x, y)`,
  `ring` (the ring's corner points), `hub` (the square's node id), `vs` / `vr` (the station road and the line, in the frame).
- Offers use one vocabulary (tested): medicine, law, learning, signal, iron, work, shop, salvage, shelter, home:N.

## The parts

| Part | File | Job |
|---|---|---|
| Units | `units.js` | 1 unit = 1 m. Walking speed, street widths, lot sizes and pace targets all live here. |
| Seeds | `seeds.js` | `seedTree(seed).child('ch1').child('lot:12')`. Each node has its own `Rng`, so adding a lot never shifts another lot's draws. |
| Schema | `schema.js` | The fields an atom has, and `validateAtom`. |
| Sockets | `sockets.js` | The only places atoms may connect, and what each socket accepts. Every rule works both ways (this is tested). |
| Palettes | `palettes.js` | Atoms name **roles** (`roof.warm`); each chapter maps the roles to colours. A missing role throws an error. |
| Registry | `registry.js` | One list of atoms, stages and validators. The game, the lab, tests and agents all read it. |
| World | `world.js` | The build's output: streets, lots, placed atoms, fences, nav. `place()` is the only way to add an atom. |
| Pipeline | `pipeline.js` | Runs the stages in order, then the validators. If a fatal check fails, it rebuilds on seed branch `try:k`. |
| Stages | `stages/*.js` | One job each. A recipe picks which stages to run and in what order. |
| Validators | `validators.js` | Fatal: no overlaps, every door reachable, every lot faces a street, rails clear, party walls flush with ≥ 3 m alleys, the ring street closed, every district reachable from the square. Warnings: fences clear of drives, crossing time (a recipe may set `params.pace`). |
| Network | `network.js` | Raw straight pieces become a street network: they are split at every crossing and T, ends are merged into junction nodes, and only what the start reaches is kept. Layouts draw lines; this makes the `street.end` / `junction` grammar. |
| Frontage | `frontage.js` | Lots are cut along a street side, and a big site slides along a street until it is clear. Clearance comes from spatial hashes of streets, rails, lots and buildings. |
| Spatial hash | `spatial.js` | A uniform grid of boxes. `near(box)` returns candidates in insertion order, so a hashed scan gives the same answers as a full one. |
| Drawing | `draw2d.js` | A flat Canvas 2D renderer. It draws each atom by its `look` (gable, flat, ruin, railcar, nest…), using palette roles only. `paintWorld(ctx, ctxOver, W, palette, rect)` draws any rect of the world. |

## An atom

```js
{ id: 'house.suburban.a', kind: 'building', size: [11, 9], height: 6, layer: 'roof', collide: 'box',
  roles: ['roof.warm', 'roof.warm2', 'wall.light'], look: 'gable', setback: [4, 6],
  sockets: [{ type: 'door', at: 'front' }, { type: 'drive', at: 'side' }],
  needs: ['lot.residential'], offers: ['shelter'], tags: ['house', 'ch1'] }
```

- `needs` says where the atom can go: the buildings stage asks `reg.needing('lot.residential')`.
- `layer` says what you walk under. `roof` and `canopy` fade around the hero.
- `look` says how it is drawn. Atoms share looks, so a new atom needs no drawing code.

## How to grow it

- **A new thing:** add an atom to `src/atoms/<chapter>.js`. If a stage already places atoms of that need, the
  thing appears with no code change.
- **A new rule for what may touch what:** add a socket to `sockets.js`, with both directions.
- **A new kind of place:** add a stage file, then register it in the chapter's registry at the right point in the order.
- **A new promise about the world:** add a validator. If it is fatal, a seed that breaks it is rebuilt, never shipped.
- **A new variant:** add an atom file and a recipe. Reuse the shared stages, and add only the layout stages the
  variant needs.
- **A new palette:** add one table to `palettes.js` that has every role. Every recipe can be shown in any palette.

## What the second variant taught the engine

Building mill town showed where the first version was secretly "suburb only". Each of these is fixed, and a test
now guards it:

| Coupling found | Fix | Guard |
|---|---|---|
| The renderer branched on atom ids (`lamp.`, `car.`, `tarp.`…) | Atoms name a `look`; the renderer draws looks | Test: every look has a drawing; no id checks in `draw2d.js` |
| Stages named atoms (`tree.forest.a`, `pool.backyard.a`…) | Stages pick atoms by tag or need | Test: no atom ids in the stage files |
| The camp was built inside the buildings stage | `camp` is its own stage, reading `W.camp` | Both recipes share it |
| Terrain had fixed woods edges | `params.terrain` sets the edge bias per recipe | — |
| Touching boxes counted as an overlap | Contact up to 5 cm is a join, not an overlap | The party-wall validator |
| Spacing was a constant (`LOT.sideGap`) | Sockets set spacing: `party.wall` gives 0 m, `detached` gives 3 m | The party-wall validator |

## Speed

A 600 × 500 m town builds in about 230 ms warm and about 500 ms cold in Node, with every validator included. Speed-ups that pay:
- The overlap, rail, drive and terrace checks run against spatial hashes instead of every pair.
- OBB maths allocates nothing, and occupancy and bridge loops are bounded to the box.
- The reach BFS uses no arrays.
These changes keep the floats identical, so the suburb, milltown and downtown hashes are unchanged (a test pins them). The slowest stages
are now forest, courtyards and terraces (each about 30–45 ms warm).

## The lab

`node tools/lab/build-lab.mjs` builds the lab, which lists every recipe. The **map** button fits the whole town on screen and labels the districts and the
finale; the readout below names the district you are standing in. `node tools/lab/shot.mjs <recipe> <seed> <prefix> [w h]`
takes Playwright screenshots of the map, the camp and each site (it needs Playwright on `NODE_PATH`).

## Rules

- Each stage reads its own seed node (`seed.child(stage)`), never a shared one.
- Stages write to the world only through `W.place`, `W.note` and the world's own arrays.
- Atoms are frozen. A stage stores per-instance data (`r`, `tone`, `lot`) on the placed record, not on the atom.
- The `try:k` branch is the only retry. A stage never loops "until it fits" on its own.
- `test/engine.test.mjs` checks:
  - determinism, and the validators on seeds 1–10 for every recipe
  - that the `must` atoms are placed, plus sockets, roles and the registry
  - that no stage file (all of them are scanned) or renderer branches on an atom id
  - the town's shape on every seed: the ring is closed, the main street comes from the south, the square is central with the church and the camp on it, the station is north, the finale is in the works, the masts are south-west, and the districts are reachable
  - the old variants' hashes
- A town plan's promises are validators: **the ring street is closed**, and **every district is reachable from the square** (that check also
  fails if a landmark found no site). Both pass trivially in recipes that have no plan.
