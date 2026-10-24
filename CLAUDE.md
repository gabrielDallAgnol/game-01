# CLAUDE.md: agent guide for Hold Hollowmere

A browser town-defence game against the dead. It is built from zero-dependency ES modules on three.js r128,
which loads from a CDN as the global `THREE`. Read `docs/ARCHITECTURE.md` for the full module map and the data flow.

## Layout: where things live

| Change you want | Go to |
|---|---|
| A number (cost, hp, damage, timing, wave budget) | `src/content/*.js` (data) or `src/sim/state.js` (the rules' constants) |
| A rule (how something behaves) | `src/sim/<concern>.js`, a `createX(G)` factory wired in `src/sim/game.js` |
| The public API used by the UI, bots and tests | `src/sim/api.js`: add, never rename |
| Story text, encounter words, contract names | `src/content/story.js`, `src/content/contracts.js` |
| Story effects and offers | `src/sim/story.js`, `src/sim/contracts.js` |
| World canon, the opening cards, crew, act and Rig lines, System voice | `src/content/solar.js` (player-facing names: Ash-Born, Inferno Nest, Haven Rig; code ids keep their old names) |
| Citizen and crew barks | `src/content/barks.js` (`pick(kind)`, `pickWho(kind)`) |
| What the Chronicler (Claude) may write | `src/ui/story-ai.js` (prompts and validators) |
| A 3D model or prop | `src/render/kit/<family>.js`, exposed through `K` in `src/render/kit.js` |
| How the game state is drawn | `src/render/view/<concern>.js`, a `createX(V)` factory wired in `src/render/view.js` |
| The ground, woods and city streaming | `src/render/city.js` |
| Light, sky, post-processing, quality | `src/render/look.js`; the time-of-day and night lights are in `src/render/view/lights.js` |
| Particles, rings, labels, light pools | `src/render/fx.js`; hooks in `src/render/view/feel.js` |
| HUD, cards, panels, input, screens | `src/ui/<concern>.js`, a `createX(ui)` factory wired in `src/ui/app.js` |

## Build, run and test

```sh
node tools/build.mjs             # → dist/index.html (one self-contained page; dist/ is gitignored)
npm run dev                      # serve the folder at :5173 (the unbundled ES modules)
node tools/golden.mjs --check    # the golden runs, a few minutes (one process per scenario)
npm test                         # golden + sim + ai + model + story + road; 6–15 min, so run it in the background
node tools/sweep.mjs survivor 16 12 survivor   # balance sweep: the per-seed "reached" list
```

To check the rendering, use `tools/dev/shot.cjs`. It is local-only because `tools/dev/` is gitignored. It needs
Playwright and a local copy of three.js r128, passed in `THREE_LOCAL`, since the CDN is unreachable in the
container:

```sh
SEED=3 THREE_LOCAL=<path>/three.min.js TOUCH=1 Q=medium \
  STEPS="await page.click('#begin'); await page.waitForTimeout(3000)" \
  node tools/dev/shot.cjs dist/index.html out.png 390 844
```

Screenshots vary from run to run, because the game loop runs on wall-clock time. Compare them by eye; a byte
diff will not match. The page exposes `window.__game` (the API) and `window.__view`: `setZoom`, `getZoom`,
`info()`, `scene`, `camera`, `pick`, `project`, `debug.snap()` (jump the light to the current time of day),
`debug.K`, `debug.look`, `debug.fx` and `debug.city`.

## The golden test rule

`test/golden.json` holds the hash of the full state and event stream, every night, across scripted runs
(`tools/golden.mjs`).
- **A refactor must leave it byte for byte identical.** Run `node tools/golden.mjs --check` before every commit.
- Only an intended rule or balance change may re-record it, with `node tools/golden.mjs --write`. Do that in its
  own commit and say so in the message. Never re-record to make a refactor pass.
- The balance sweep (`tools/sweep.mjs`) is the second net for sim changes: its per-seed list must not move
  unless you meant it to.

## Conventions

- **One module per concern.** A file does one job and starts with a comment saying what that job is. Grow the
  system by adding a module and wiring it in the composition root (`game.js`, `app.js`, `view.js`, `kit.js`).
  Do not grow a big file.
- **Factories over a shared context.** Write `createX(G)`, `createX(ui)` or `createX(V)`. Destructure fixed
  things once. Read changing slots at call time as `G.x`, `ui.x` or `V.x`, for example `V.time`, `V.dark`,
  `ui.game`, `G.story`.
- **Order is part of the behaviour.** In `game.js` the creation and setup order fixes the seeded RNG draws. In
  `view.js` it fixes material and mesh creation (render-sort ties) and the visual rng `vis`. Add new things at
  the end, and do not reorder existing calls in a refactor.
- **Events:** emit with `ev(type, payload)` (`sim/core.js`). The payload is spread first and then `t` is set,
  so **a payload field named `t` is silently overwritten**. Use `dur` for durations (see the flare), and pick
  other names for times.
- **The engine owns the numbers, the story AI owns the words.** Every effect, cost, reward and number comes from
  the sim. The Chronicler (`ui/story-ai.js`) may only rewrite text and choose from engine-offered menus. Its
  answers are validated, and an invalid answer falls back to the script. Never let AI output set a number.
- **Render never writes game state, and the sim never touches the DOM or three.js.** The UI changes the game
  only through the API.
- **Determinism:** all sim randomness goes through `Rng` streams (`sim/rng.js`). Use no `Math.random` in the sim, no
  clock-dependent logic (`Date.now` appears only as save metadata) and no iteration-order surprises. Render-side randomness is fine (`Math.random`, `vis`).
- **Bundler limits** (`tools/build.mjs` is a set of regexes):
  - imports must be `import { a, b as c } from './x.js';`
  - exports must be `export function|const|let|class name …` or `export { a, b };`. Re-exporting an imported
    binding with `export { a };` is fine. `export *`, `export … from`, default exports and side-effect-only
    imports are not supported.
  - No import cycles: a module that needs another module's binding at load time breaks in the bundle.
  - An exported `let` is a snapshot in the bundle, not a live binding, so never reassign one from outside.
    Share mutable state through an object instead.
  - A name that is not `\w+` (such as `$`) can only be exported from a list: `export { $ };`.
- **Style:** dense one-line helpers are the house style, and comments say why. Write terse, plain English in
  the game's voice.

## Working in parallel worktrees without conflicts

Several branches are usually live at once (`git worktree list`: `hm-road`, `hm-look`, `hm-economy`…).
- Give each feature its own worktree and branch. Never commit to `main` or `master` directly, and merge
  through an integration branch.
- **Put new code in new modules.** Most conflicts come from two branches editing the same big file. A new
  `src/sim/x.js`, `src/render/view/x.js` or `src/ui/x.js`, plus one wiring line in the composition root,
  merges cleanly.
- **Bracket feature hooks in shared files** with marker comments, like the road does:
  `// [road] begin` … `// [road] end` (search for `[road]`). One merge then resolves each block as a unit, and
  the feature is easy to find and remove.
- **Append, don't reorder.** Add to the end of `MODULES` (`game.js`), of the view build sequence (`view.js`)
  and of content tables. Reordering changes behaviour (see Order above) and conflicts with everyone.
- Keep commits small and single-purpose: one concern, golden green, and a message that says whether behaviour
  changed. Re-recording the golden file is a separate commit.
- Keep generated output out of the repo: `dist/`, `reports/*.json`/`*.txt` and `tools/dev/` are gitignored.
- When two branches both change balance, merge them, then re-run the golden test and the sweep on the
  integration branch, and re-record there once.
