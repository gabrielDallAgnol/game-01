# The V2 engine: worlds from atoms

V2 Hollowmere builds its world from **atoms**. An atom is a data record for one thing: a house, a tree, a lamp,
a tarp. Code never draws or places a thing it has no atom for. The engine is in `src/engine/`, the atoms are in
`src/atoms/`, and nothing in v56 imports either yet, so the golden test does not see them.

Try it: run `node tools/lab/build-lab.mjs`, then open `dist/atomlab.html`.

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
| Stages | `stages/*.js` | terrain → water → roads → lots → buildings → bridges → props → forest → nav |
| Validators | `validators.js` | no overlaps, every door reachable, every lot faces a street (all fatal); fences clear of drives, crossing time (warnings) |
| Drawing | `draw2d.js` | A flat Canvas 2D renderer that reads only roles. `paintWorld(ctx, ctxOver, W, chapter, rect)` draws any rect of the world. |

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
- **A new chapter:** add a palette that has every role, an atom file, and a `chapterN.js` that registers them.

## Rules

- Each stage reads its own seed node (`seed.child(stage)`), never a shared one.
- Stages write to the world only through `W.place`, `W.note` and the world's own arrays.
- Atoms are frozen. A stage stores per-instance data (`r`, `tone`, `lot`) on the placed record, not on the atom.
- The `try:k` branch is the only retry. A stage never loops "until it fits" on its own.
- `test/engine.test.mjs` checks determinism, the validators on seeds 1–12, sockets, roles and the registry.
