# The Point: story, the grey world and the first map (Nov 1, 2026)

Decided with Gabriel on Nov 1. This doc **updates new-direction.md** where they differ (the hero, the world's colour, how
an area is won). Status marks: **[decided]**, **[built]** (in the prototype), **[later]**, **[open]**.

## 1. The story in one breath

A machine is about to kill a woman and her two kids when something in its chip makes it stop. It saves them instead.
The woman is **Kai**, a mechanic. She takes it home to her garage on the point where two rivers meet, fixes it and
improves it. The machine is the hero; Kai is its mechanic, its voice to people and the one who builds what it needs.

| Piece | Decision |
|---|---|
| The hero | **The robot** [decided]. It starts as one of the basic machines (a crawler-class body on wheels) and grows into bigger forms by beating stronger machines: bike, car, truck, and late in the game a humanoid. Never called a transformer. |
| How it talks | It doesn't speak. Its eye's light and short lines of glyphs, put into words by Kai [decided]. |
| Kai | A mother of two and the mechanic [decided]. She runs the garage (the workbench, the recipes), and she builds the chips that free the big machines. She replaces the separate mechanic NPC of M8. |
| The kids | The first humans to trust the robot; through them the town learns to trust it [proposal]. |
| On screen | The robot rides alone; Kai is at the garage, not riding it [decided]. |
| Cutscenes | In the game camera: letterbox bars, zoom in, lines on screen. The robot has one **rest pose** (its front tilts up a little, the eye turns to the person), reused in every scene; later forms add richer poses [decided, later to build]. |

## 2. The grey world: ash [decided]

Real-world logic: the machines burn fuel and their nests burn, so **ash settles on everything**. An area the machines
hold is grey because it is covered in it.

- Each area's big machine (its walker) is also its biggest smokestack.
- **You free it instead of destroying it.** Kai builds a chip for it: a copy of whatever woke the robot up.
- Freed, it becomes the area's **guardian and its filter**: the air clears, rain washes the ash off, the colour sweeps
  back from where it stood, and the area stays safe.
- So freeing robots, Kai the mechanic and the colour are one act: the robot gives other machines the chance it got.
- **Colour never goes grey again** [decided]. Cleared ground is yours; pressure, if any, comes at the frontier (the
  bridge being mended, survivors on the move), never back home.
- **All assets** take the colour back, not only the ground: cars, flowers, windows, the small details too [decided;
  the prototype colours the ground and most solids; the small details drawn on the separate layer still need it].
- **Only light shouts** holds in grey areas: amber (yours), ember (theirs) and lamps keep their colour; water keeps a
  little of its sky so the rivers read as walls [built].

## 3. Chips and the economy [decided]

- **Chips** (the second currency) drop from machines, and **become rarer** than today.
- They are what the **freeing chip** for a big machine is built from (with scrap) at the garage. So farming machines has
  two purposes: getting stronger (levels, the vehicle) and freeing the map.
- Chips also go into upgrading the vehicle, so there is a real choice where they go.
- The first parts the bike has may not need levels at all [open; left as it is for now].

## 4. Freeing a big machine [built: first shape, §6]

A mini-game made of one simple input done well (it's a phone game). First idea: the robot holds a chip link to the boss
while you tap in time to its pulses; its small machines keep attacking, so clearing its guards first matters. To be
prototyped once the first map plays.

## 5. The first map: the Point [built, §6]

A peninsula where two rivers meet, closed on its third side by an old canal, so it is fully surrounded by water. Machines
cannot cross water (it shorts them out), and neither can you, except over a bridge.

| Place | What it is |
|---|---|
| **The Point** | Kai's garage at the tip where the Wend and the Lume meet: water on two sides, one way out. Home, the first garage, **clean from the start** (in colour, no machines). |
| **The Wend, the Lume** | The two rivers; they meet near the south-west corner and leave the map together. |
| **The old cut** | The canal from the Wend to the Lume that closes the peninsula. Its mouths read as weirs. |
| **Wendbridge** | A small town (the engine's suburb) by the cut, where the bridge road starts. People are there; the trust missions start there. |
| **Wend Bridge** | The road bridge over the cut to the north-east, toward the first town. **Broken in the middle.** |
| **The first boss** | **Wedged in the gap of Wend Bridge.** It can't get out, and while it is there nobody can mend the bridge. It breeds small machines that stand guard round the town. That is why it never destroyed the town on its own, and why people can't leave. |
| Also on it | The point lane (town → garage), Lume Farm, Cut Farm, the pump works, two woods, fields. |
| Beyond the water | Fields, woods and the road on to the edge (the first town comes later). Machines walk there; you see them across the water. |

### The tutorial chain (to build)

1. Wake at the Point (home, in colour). The robot and Kai; the first garage.
2. Ride out: the grey begins at the edge of the Point. Small machines; scrap and the first chips.
3. Wendbridge: meet the people; small missions earn their trust (and the first recipe from a mission, per the incremental
   start in the plan).
4. Kai builds the first freeing chip (chips + scrap).
5. Wend Bridge: clear the boss's guards, free the boss. It starts filtering; the colour sweeps over the peninsula.
6. With the boss free and the town on your side, mend Wend Bridge. The world opens toward the first town.

Later, each **season** (chapter) is one ring of the map with its own type of machine: beating that type unlocks its
body (the evolution), and a season ends with the colour reaching a new landmark. Areas further in are more destroyed,
with fewer survivors; the centre holds the reason for it all.

## 6. What is built (Nov 1–2)

| Piece | Where |
|---|---|
| **The base:** the Point in the grey world is what `roam.html` opens now (`?world=region` for Hollowmere, `?proto=none` for the old look) | `src/roam/main.js` |
| The grey world: colour drains where machines hold an area, returns when it is cleaned (the sweep); light keeps its colour; water keeps some of its sky | `src/roam/medium.js` `[grey]` |
| The robot alone (no rider, can't dismount), Kai at home by the garage doors (she turns to watch it come in); the LOOK chip | `src/roam/main.js`, `medium.js` `[point]` |
| The Point: rivers, canal, Wendbridge, broken Wend Bridge, the garage at the tip, farms, works, woods, fields | `src/roam/world/peninsula.js` |
| Water is a wall for wheels and feet, **not for what flies** (shots and bolts cross it); a bridge deck is road; a broken deck's gap is a shut gate over water | `src/roam/town.js` `[point]` |
| Water meets its neighbours: a soft bank by grass and fields (mud, stones, rank grass, reeds, shallows, lapping), a stone quay by hard ground, a bridge's shadow on the water | `src/roam/world/land.js` `[shore]` |
| A home district (clean from the start, no walker); a pinned walker (the boss in the bridge); a free area (its walker can only be freed) | `src/roam/sim/areas.js` |
| **Freeing:** shot down, the boss's core stops at 15% and lies open (the boss bar: OPEN · FREE IT, an amber call on it). The **freeing chip** (garage BUILD, key items: 40 scrap, 6 chips; Kai knows it from the start). LINK beside FIRE; tap as the closing ring meets it (a pulse every 1.3 s, 0.36 s window), 5 in time; a miss costs one and locks the link 0.6 s; riding away breaks it (the chip is kept). Freed: its brood powers down (they drop what they carry), the area is clean, the colour sweeps from it, its eyes turn amber, ash motes rise off it (it filters), and it climbs out of the gap to a post on the bank | `src/roam/sim/freeing.js`, `freeview.js`, `freeui.js` |
| **Chips are a machine's own chip:** it comes through a death whole only sometimes (crawler and skitter 2%, hound 4%, spitter 5%, brute 35%: about 4 minutes of fighting for six); a machine that died burning keeps none (x0.3). Fire costs you chips | `src/play/loot.js`, `src/roam/sim/loot.js` |
| **Mending Wend Bridge:** while the boss is wedged in it nobody can mend it; once it is free, MEND at the bridge's end with 60 scrap carried; the people of Wendbridge work while Kai guards (14 s; the work waits while she's away); mended, the gate opens and the road north runs on. Drawn: snapped ends (concrete chunks, rebar, rubble), then girders and planks, then rails | `src/roam/sim/bridges.js`, `bridgeview.js`, `bridgeui.js` |
| **The objective line:** the tutorial chain read from the state (Wendbridge → chips → the freeing chip → free the boss → mend the bridge → the road north) | `src/roam/objui.js` |
| **The ash, seen:** flakes drift down in dark areas, none in clean ones; the boss breathes ash from its back like a stack | `src/roam/ashview.js`, plume preset `ash` |
| **The people of Wendbridge:** hidden while the boss holds the town; out at their doors once it is free but shy (they step back in when the robot comes close); hi-vis workers at the bridge while it is mended; after it stands they trust the robot and wave | `src/roam/peopleview.js` |
| The overlay's colours (washing, signs, birds) go grey in dark areas too | `medium.js` `[grey]` |

Not yet: trust missions with the people (they are on screen, but don't ask anything yet), the first recipe from a mission (the incremental start), the kids, the robot's rest pose and cutscenes, the rivers' flow, the first town beyond the bridge.
