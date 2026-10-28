# One medium: the visual atoms

Hollowmere draws everything with a few reusable atoms, so the player, the base, the dead and the town come from
one renderer and never look like they belong to different games. Rule of thumb: **solid things are glyphs, soft
things are strands, light means life.** Turn the look off with `?look=classic`.

| Atom | What it is | Where | Used for today | Next uses |
|---|---|---|---|---|
| **Glyph** | A lit solid drawn as letters on the screen's cell grid by its light (`' .,:-=+*%#@'`): shadow empty, light dense, the material's colour inside | `kit/territory.js` (every `territory()` material), `render/medium.js` (ramp, cell) | Kai, the Ash-Born, Hilde, turrets, roofs, props | Infested buildings, survivors, the Rig's modules |
| **Strand** | Combed strokes: a line integral of seeds along a flow; knobs are flow, density (coarsens with zoom), length and press | `kit/strand.js` (`strand`, `strandWind`, `strandGust`) | Grass (flow = wind), tree crowns (flow = round the crown) | Hair and Kai's tails, tentacles out of nests (longer, thicker, flow = outward), smoke, water (flow = current) |
| **Trample** | Where feet pressed the strands; springs back over ~30 s | `view/medium.js` (a map-sized field) | Tracks of the dead and Kai in the grass | Tyre tracks behind Hilde, a horde's path at dawn |
| **Push** | Up to 8 points that part the strands around them | `view/medium.js` (`mPush`) | Kai and the nearest dead | A shot's ring, a dash's wake |
| **Spill** | Warm light out of a lit house's windows and door | `view/atoms.js` (lamps list) | One house in five at night (no street lamps after the Ashfall) | Story houses always lit (Lotte's tower, Benno's hall) |
| **Mark** | The far map: one letter on a plate at a fixed screen size | Looks Lab (`tools/lab/medium.js`), not in the game yet | `@` Kai, `T` turrets, `&` dead, `HILDE` | |

## Adding an atom
1. Write it once (GLSL in `kit/`, per-frame state in `view/`), with its knobs as parameters.
2. Use it from at least two places before calling it an atom.
3. Add a row above.

The Looks Lab (`tools/lab/looks.js`, tab "One medium") is the playground for new atoms before they reach the game.
