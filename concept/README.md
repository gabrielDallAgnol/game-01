# Visual concept renderer

Offline renders for the "Reclaim the city" visual direction (modern ruined city, Thronefall camera).
It is also the prototype for the game's new look: the model kit, the territory-tint shader and the light rigs
are written so they can move into `src/render/` later.

| File | What it is |
|---|---|
| `kit.js` | Model kit: ruined/whole apartment blocks with recessed windows, streets, cars, barricades L1–3, homes (ruin + L1–3), towers, farms, the keep, hives, a jointed figure rig, gameplay overlays. One palette, bevelled geometry merged per material. |
| `scenes.js` | Light rigs (day, night, studio) and every scene: `havenDay`, `havenNight`, tiles (`house0`…`farm3`, `keep3night`), hives, cast, phone frames, tint comparison. |
| `render.html` | Linear HDR → SSAO → bloom → grade (ACES, saturation, lift/gain, vignette, grain) → SMAA. |
| `render.cjs` | Headless Chromium runner: `node render.cjs havenDay:1920x1080 house3:900x640` → `out/<scene>.png`. |

## Setup
`lib/` must hold three.js **r128** `three.min.js` plus these files from `examples/js`: EffectComposer, RenderPass, ShaderPass, MaskPass, SAOPass, SSAOPass, UnrealBloomPass, SMAAPass, CopyShader, SAOShader, SSAOShader, DepthLimitedBlurShader, UnpackDepthRGBAShader, LuminosityHighPassShader, SMAAShader, RoundedBoxGeometry, BufferGeometryUtils, SimplexNoise.

The board with the results lives in the "Hollowmere visual concept" artifact.
