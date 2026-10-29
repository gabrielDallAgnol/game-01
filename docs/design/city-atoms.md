# The city's atoms: what stands where, and why

Hollowmere's town is dressed by **atoms**: small stand-alone parts (a parked car, a dead lamp, a washing line, a flock
of crows, a zebra crossing). Each one says **where it may stand** and **where it belongs**, so any town the engine lays
out dresses itself, deterministically, with no AI. The same seed always dresses the same way.

Code: `src/roam/dress/` (the system) and `src/roam/atoms/` (the families).

## 1. Care: how kept a place still is
`dress/care.js` gives every point a **care** value, 0 (ruin) to 1 (tended), on a 4 m grid:

| Input | Effect |
|---|---|
| The district's kind | suburbs 0.78, park 0.66, old town 0.58, barns 0.5, fields 0.46, station 0.36, works 0.26 |
| Each nest | up to −0.62, fading out by ~95 m (the blight spreads from them) |
| Each ruin | up to −0.45 within ~24 m |
| Slow noise | ±0.17 at 70 m, ±0.05 at 18 m (streets differ inside a district) |

Bands: **tended** (> 0.62), **worn** (> 0.32), **ruined**. Everything that dresses the town reads care: atoms, the
gardens (most tended houses keep one, few gone wild; the ruins almost none, all wild), and the lit windows (half the
tended houses, one in ten in the ruins).

## 2. Slots: where an atom may stand
`dress/slots.js` reads the engine's town (streets at the widths the game draws them, junctions, buildings, doors, trees)
and lists every place an atom could stand. Each slot carries its `care`, its `district`, whether it is under a tree
`crown`, and on the pavement whether it is by a front `door`.

| Slot | Where | Typical atoms |
|---|---|---|
| `parking` | on the road against the kerb, not near a junction | cars, oil stains, puddles |
| `kerb` | the pavement's road edge | lamps, poles, post boxes, gutter leaves |
| `pavement` | the pavement's middle | benches, paper, chalk, scorch |
| `wall` | the pavement's outer edge, by fronts and gardens | bins, paper against walls |
| `roadway` | the road's middle lanes | manholes, potholes, crows on a carcass, stories |
| `crossing` | across a street just before a junction | zebra crossings, the crash story |
| `junction` | the middle of a junction | |
| `door` | in front of a house's door | the survivor story, a flock on that house |
| `roof` | on a building | chimney smoke, smouldering ruins |
| `yard` | behind a house | washing lines |
| `tree` | a tree's foot | leaf piles, a flock in the crown |

## 3. An atom
A plain object in a family file (`atoms/<family>.js`), listed in `atoms/index.js`:

```js
{ id: 'car', family: 'props', slot: 'parking',
  every: 9, chance: 0.42, space: 1.2,            // ≥ 9 m from another car, at most 42% of slots, 1.2 m clear of solids
  fit: (care, slot, flags) => weight 0..1,        // where it belongs (0 never, 1 always welcome)
  variant: (care, h, slot, inst) => 'parked',     // how it looks there: tidy → worn → ruined
  collide: { w, h },                              // a wall for feet and the bike (optional)
  volumes(inst, K, t, v) { … },                   // solids: glyph volumes (K.sphere / capsule / box, K.M materials, K.S = 1.3)
  paint(g, inst) { … },                           // flat: a ground mark (r pale paint, g dark, b water)
  strands(fx, inst, v) { … },                     // soft: strokes on the overlay that sway with the wind
  live: { init, step, draw } }                    // little lives (render-side state only)
```

The house style keeps every family in one game: **solids are glyphs, soft things are strands, flat things are marks**;
props are drawn at 1.3× life (houses 1×, figures 2.6×); one material palette (`dress/mats.js`), muted and a little grey
with the ash, where only lights, embers and safety orange may shout. Every variant follows care: **tended** whole and
tidy, **worn** dusty, open, faded, **ruined** burnt, broken, down.

## 4. Stories: the exceptions, with a reason
`dress/stories.js`. A story claims ground first and may break the care rule, because something happened there:

| Story | Where | What |
|---|---|---|
| crash | a junction's mouth, any care (rare where tended) | two crashed cars, skid marks, debris, a cone |
| barricade | a road where the blight reached | barriers, sandbags, a burnt car |
| survivor | a door in the ruins | a tended garden, a lit window, washing out, smoke from the chimney |
| fallen | a road in a worn place | a fallen tree, leaves |

A story is `{ id, slot, count, apart, r, where(care, slot, flags), build(slot, put, h, flags) }`; `put(atomId, along,
across, { variant, turn })` places an atom relative to the slot. Stories can mark houses in `flags` (`flags.survivor`),
which the lights, the gardens and the smoke read.

## 5. Adding to the town
- **A new atom** in an existing family: add the object to its file. Pick the slot, write `fit` from care (and district,
  crown, door), give it variants per band, keep it ≤ 10 volumes.
- **A new family**: a new file exporting an array; one import and one spread at the end of `atoms/index.js`.
- **A new story**: an entry in `stories.js` built from existing atoms.
- **A new town**: nothing to do: a new seed or recipe gets its own care map, slots and dressing.

Check placement in node (fast, no browser): run `makeCare` → `makeSlots` → `makePlacer` (stories, then atoms) as the
`[dress]` block in `src/roam/town.js` does, and count atoms by variant and band.
