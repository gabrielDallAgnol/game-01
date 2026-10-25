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

The shared stages (terrain, camp, props, forest, nav) and all the validators are the same code in both recipes.
`buildArea(id, seed)` builds one recipe. `chapter1.js` is now just the suburb recipe.

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
| Validators | `validators.js` | Fatal: no overlaps, every door reachable, every lot faces a street, rails clear, party walls flush with ≥ 3 m alleys. Warnings: fences clear of drives, crossing time. |
| Drawing | `draw2d.js` | A flat Canvas 2D renderer. It draws each atom by its `look` (gable, flat, ruin, railcar, nest…), using palette roles only. `paintWorld(ctx, ctxOver, W, palette, rect)` draws any rect of the world. |

## An atom

```js
{ id: 'house.suburban.a', kind: 'building', size: [11, 9], height: 6, layer: 'roof', collide: 'box',
  roles: ['roof.warm', 'roof.warm2', 'wall.light'], roof: 'gable', setback: [4, 6],
  sockets: [{ type: 'door', at: 'front' }, { type: 'drive', at: 'side' }],
  needs: ['lot.residential'], offers: ['shelter'], tags: ['house', 'ch1'] }
```

- `needs` says where the atom can go: the buildings stage asks `reg.needing('lot.residential')`.
- `layer` says what you walk under. `roof` and `canopy` fade around the hero.

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

## Rules

- Each stage reads its own seed node (`seed.child(stage)`), never a shared one.
- Stages write to the world only through `W.place`, `W.note` and the world's own arrays.
- Atoms are frozen. A stage stores per-instance data (`r`, `tone`, `lot`) on the placed record, not on the atom.
- The `try:k` branch is the only retry. A stage never loops "until it fits" on its own.
- `test/engine.test.mjs` checks determinism, the validators on seeds 1–10 for every recipe, that the `must` atoms are
  placed, sockets, roles, the registry, and that no stage or renderer branches on an atom id.
