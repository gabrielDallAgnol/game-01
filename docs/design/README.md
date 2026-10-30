# Design docs: start here

Current direction as of **Oct 30, 2026**. Read these in this order before building anything new:

| Doc | What it is | Status |
|---|---|---|
| [atomic-engineering.md](atomic-engineering.md) | **The core concept:** every thing is an atom with a material; elements change atoms, atoms change each other only through what they emit (heat, water); weapons deliver elements to the world only by splash, stream or field. | **Pillar: every new thing must fit it** |
| [new-direction.md](new-direction.md) | The game: free travel, one transforming vehicle, walkers, rebuild missions, talents, loot, currencies, endgame. Decided items are marked **[decided]**. | **Current source of truth** |
| [play-atoms.md](play-atoms.md) | How combat, loot and rebuilding are built: tags, elements, reactions, effects, behaviours, modifiers, parts, modules and sockets. Data shapes and the "how to add" cheat sheet. | **Current: build from this** |
| [city-atoms.md](city-atoms.md) | How the town dresses itself (care, slots, atoms, stories). Play atoms extend this system. | Current, implemented in `src/roam/` |
| [atoms.md](atoms.md) | The visual medium (glyphs, strands, marks). | Current look |
| [design-council.md](design-council.md) | Six design lenses (Cheng, Sakurai, Fujibayashi, Brevik, Street, Yu) used to review decisions, and the first review of the new direction. | Reference |
| [wyatt-cheng-lens.md](wyatt-cheng-lens.md) | The full Wyatt Cheng lens. | Reference |

Older docs in `docs/` (decisions-2026-10-1x, design.md, blessings, resources) describe the earlier town-defence direction. Keep them for history; don't build from them.

## Rules for coding agents
- **Systems react to properties, never to names** (play-atoms §0). New content is data with `desc` and `why`.
- Build in the order of play-atoms §13 (the chapter 1 prototype): fire + water + steam, an oil puddle, 3 modifiers, 2 weapons, a crawler, a walker, one house with sockets.
- Anything marked "Later" in new-direction.md stays out until the prototype is fun.
