# Hold Hollowmere

A small browser game about holding a town against the dead. Build by day, hold the keep by night,
burn the nests around you to claim more land, and see how many nights you last.

Inspired by Thronefall (day/night town defence), Townsfolk and Dotage (small-town survival under pressure).

## Play locally

```sh
npm run dev        # serves the folder; open http://localhost:5173
npm run build      # bundles everything into dist/index.html (one self-contained page)
```

No install step: the game has zero npm dependencies. three.js (r128) loads from cdnjs.

## How the code is laid out

| Folder | What lives there |
|---|---|
| `src/content/` | Pure data: buildings, mobs, waves, heroes, blessings, names. **Balance changes start here.** |
| `src/sim/` | The game rules. No DOM, no three.js. Seeded and deterministic: same seed + same inputs = same run. |
| `src/render/` | three.js view. Reads `game.state` and drains `game.state.events`; never changes the game. |
| `src/ui/` | Screens, HUD, panels, input. Talks to the game only through its public API. |
| `tools/` | Bots, the balance runner and the bundler. |
| `test/` | `node:test` suites: fast rule checks and slower balance gates. |
| `docs/` | Design notes and balance history. |

## Testing and balancing

```sh
npm test               # ~3 s: map validity, determinism, pathing, rules
npm run test:balance   # ~1 min: bot runs must land inside target bands
npm run balance        # full bot matrix (heroes × strategies × expansion × maps) → reports/
```

The balance runner prints win curves per hero, strategy, expansion style and map, a per-night threat curve,
and a calibration table that maps the in-game threat ratio to how often a night ends a run.
The **Easy / Medium / Hard / Impossible** labels in the game come from that table.

The in-game **Log** button records the same numbers for real games. "Copy log" gives JSON you can diff against bot runs.

## Game API (used by the UI, bots and tests)

```js
import { createGame } from './src/sim/game.js';
const g = createGame({ seed, mapSeed, biome: 'riverbend' | 'highland' | 'lakeshore', hero: 'warrior' | 'archer' | 'steward' });
g.build(slotId, 'tower'); g.upgrade(slotId); g.upgradeKeep(); g.planPurge(regionId);
g.choosePerk(id); g.startNight(); g.step(1/60);
g.heroTo(x, y); g.setHeroInput(dx, dy);
g.regionInfo(regionId); g.threatRatio(); g.state.log;
```

In the browser the running game is exposed as `window.__game` for Playwright tests.
