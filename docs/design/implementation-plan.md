# Hollowmere: implementation plan (Oct 30)

How we turn the design ([new-direction.md](new-direction.md), [play-atoms.md](play-atoms.md)) into the game. One phase at a time, each ending in something playable and a **fun gate**: if the phase isn't fun, fix it before the next one (Design Council: build the core first).

## The starting point
| What exists | Where | Use it for |
|---|---|---|
| **Roam**: the generated town, Kai walking and riding the bike, the dead with sleep/wander/chase, nests with hearts, day/night, a fixed-step deterministic sim (`ROAM.step = 1/30`) | `roam.html`, `src/roam/` (≈3.6k lines) | **The base of the new game.** The bike is the first form; nests become the walker's nests |
| City atoms: care, slots, atoms, stories | `src/roam/dress/`, `src/roam/atoms/` | Materials (oil puddles…), house sockets, the glow-up through care |
| The One-medium renderer (glyphs, strands, marks), lighting | `src/roam/medium.js`, `look.js` | Machines, reactions, beams, the glow-up |
| The town engine and world stages | `src/engine/`, `src/roam/world/` | Areas, regions, sites |
| The old V2 town-defence game | `index.html`, `src/sim/`, `src/render/`, `src/ui/` | **Frozen.** Keep its golden test green; don't build new features in it |

**Key decision (proposed):** the new game grows from **Roam**. V2 town-defence stays as it is (history and golden tests). CLAUDE.md and ARCHITECTURE.md get updated to say so.

## How we work (from CLAUDE.md)
- One branch per phase step (`play/<step>`), merged through an integration branch, never straight to `main`.
- **New code in new modules**; one wiring line in the composition root; append, don't reorder.
- `src/play/` holds the play atoms (data + small general systems). `src/roam/` holds the game that uses them.
- The sim stays deterministic (one `Rng` stream per system, fixed step, no `Math.random`); render and UI only read state and send input.
- Every data entry has `desc` and `why`. Every phase adds headless tests.

---

## Phase 0: Ground (1–2 evenings)
Make Roam safe to change before changing it.

| Step | Build | Done when |
|---|---|---|
| 0.1 | **Roam golden test:** build the town headless, run the sim for N seconds with scripted input, hash the state every few seconds (`tools/roam-golden.mjs`, `test/roam.test.mjs`) | Same seed gives the same hashes; runs in seconds |
| 0.2 | **Split `src/roam/sim.js` into modules** with `createX(G)` factories: `sim/kai.js`, `sim/vehicle.js`, `sim/machines.js`, `sim/nests.js`, `sim/clock.js`, wired in `sim/game.js` | Roam golden byte-identical (pure refactor) |
| 0.3 | **Docs:** CLAUDE.md and ARCHITECTURE.md point to Roam as the game, `src/play/` as the atoms, and V2 as frozen | An agent reading CLAUDE.md builds in the right place |
| 0.4 | **Vehicle-first start:** Kai starts on the bike. Walking stays in the code but is off (decided: Kai on foot comes later) | Play starts riding |

## Phase 1: Combat atoms, the heart (about 1 week)
The council's prototype: is fighting from the bike fun?

| Step | Build | Done when |
|---|---|---|
| 1.1 | **`src/play/` data:** `tags.js`, `elements.js` (fire, water), `statuses.js`, `reactions.js` (steam, blaze, soaked, clash), `effects.js` (damage, apply, push, explode, cloud, ground), each entry with `desc`/`why` | Validator test passes: schema, unique ids, no empty cells in the element grid |
| 1.2 | **Hit pipeline** (`play/hit.js`): hit → onHit behaviours → status → intensify or reaction → effects; caps; chain depth 1–2 | Unit tests: wet + fire = steam; fire ×3 = blaze; missing pair = clash |
| 1.3 | **Weapons:** main + off-hand as parts; the fire pipeline (count → path → size → rate → element); 3 modifiers (double shot, faster, fire); auto-target | Bike fires both weapons; modifiers stack predictably (tests) |
| 1.4 | **Machines replace the dead:** a crawler (tags `metal`, `chipped`, `light`) with the existing chase logic; machine glyphs in the medium | Crawlers chase, take statuses, react |
| 1.5 | **One material:** oil puddles as a city atom with play tags (fire → burning ground) | Shooting a puddle lights it |
| 1.6 | **Controls:** 5 buttons (main, off-hand, ability 1, ability 2, switch form; the last 3 can be placeholders); stick steers | Playable on phone and keyboard |
| 1.7 | **Feel pass (Sakurai):** hitstop on kills, one look + one sound per reaction, status pips (●○○), screen shake on blasts | Readable on a 390 px wide screen |
| 1.8 | **Combo sim** (`tools/combo-sim.mjs`): random builds against crawler packs, logs damage, chain depth, particle counts | Nothing over the caps |

**Fun gate 1:** 10 minutes of riding and fighting in one area. Do steam and blaze feel good? Does auto-target still need timing or position?

## Phase 2: The area loop (about 1 week)
| Step | Build | Done when |
|---|---|---|
| 2.1 | **Areas:** the town split into areas with a level and a state (dark → clean); the area level drives machine stats (quadratic) | Each area knows its level and state |
| 2.2 | **The walker:** a `heavy` machine on a route, visible from far away; spawns crawlers (an `everySeconds` behaviour); plants nests the longer it lives; armour plates as targets, then a weak point | It walks, spawns, can be killed |
| 2.3 | **Clean stays clean:** killing the walker stops spawning; nests left behind can be broken; no respawns after; an odd stray may wander | Cleared area stays empty (test) |
| 2.4 | **Glow-up:** the area's care rises; lamps, windows and signs come on; a freeze and a light sweep (the payoff moment) | It looks and sounds like a reward |
| 2.5 | **Death cache:** dying drops unbanked scrap as a cache you can recover | Die, return, pick it up |

**Fun gate 2:** clear one area start to finish. Is the farming window a real choice? Is the glow-up a moment?

## Phase 3: Loot and economy (1–2 weeks)
| Step | Build | Done when |
|---|---|---|
| 3.1 | **Drops:** scrap on every kill, parts and chips from elites, nests and walkers; drop tables per machine | Drops follow the tables (seeded tests) |
| 3.2 | **Parts:** 6 slots (weapon, off-hand, engine, frame, lamp, tyres); rarity sets modifier slots or stats; item level from area level; unscanned rares | Generated parts are valid (validator) |
| 3.3 | **Loot feel:** colour beams and sounds by rarity, readable at speed; lamp radius pulls scrap; auto-salvage junk | You know a rare dropped without looking |
| 3.4 | **Inventory and garage:** equip, salvage, reroll a modifier (chips), upgrade a part's level | Full loop: find → equip → upgrade |
| 3.5 | **Visual modules and sockets on the vehicle:** each slot changes the look; rarity tints; uniques get their own mesh | A rare bazooka looks different on the bike |
| 3.6 | **Economy sim** (extend the old headless bot sim): 2 hours of play → banked scrap, drops per minute, time to the first unique | Numbers within targets |

**Fun gate 3:** does stopping for loot feel like a jackpot or a chore?

## Phase 4: Town and rebuilding (1–2 weeks)
| Step | Build | Done when |
|---|---|---|
| 4.1 | **The home town:** reclaiming it is the tutorial; shops open (trader, garage, stash) | Start → reclaim → shops |
| 4.2 | **Trader rules:** sells commons and tuned only; selling pays less than salvaging | Tests |
| 4.3 | **House sockets:** plate, lamp, vent and sign sockets on houses, filled by modules; filling one raises the house's care | A house visibly improves |
| 4.4 | **Rebuild missions:** haul, courier, power line, guard (data-driven mission types), with XP and town upgrades | 4 mission types playable |
| 4.5 | **Survivors move in** as areas are cleaned and houses rebuilt | The hub fills up |

## Phase 5: Progression (about 1 week)
| Step | Build | Done when |
|---|---|---|
| 5.1 | **Levels and XP:** quests/rebuilds about 60%, kills about 30%, discovery about 10%; kill XP drops when enemies are more than 5 levels below; quadratic curve | XP sim: story ends around level 30 |
| 5.2 | **Base kit** for the bike: two abilities arrive by about level 6 | Buttons 3–4 live |
| 5.3 | **The bike's talent tree** as behaviour data; the level-up card; respec at the garage | Tree tiers 1–4 playable |

## Phase 6: Forms and tyres (1–2 weeks)
| Step | Build | Done when |
|---|---|---|
| 6.1 | **Truck and roller forms**, each with its own kit, sockets and tree; the switch button | All three forms complete chapter 1 alone |
| 6.2 | **Starter choice** screen (NFS/Pokémon style); the others unlock through the story | New game starts with a choice |
| 6.3 | **Tyres and terrain:** terrain types on the ground map; grip and speed per tyre; a spare set | The wrong tyre slows you but never blocks you |
| 6.4 | **Form routes:** vents, gaps and barricades as optional detours | Each form has its own shortcuts |

## Phase 7: Chapter 1 complete
The control-node boss, the story hooks (the chip, the 3:00 radio voice), side quests, 3–5 areas, polish, and a full playtest.

## Later list (not before chapter 1 is fun)
Shock and wind (and their reactions), epic modifier slots, schematics, the Deep Signal endgame, chapter 2, Kai on foot for narrow places and shops.

## Open decisions
1. **Build on Roam and freeze V2?** (Proposed: yes.)
2. **First form: the bike?** (Proposed: yes. It already exists in Roam.)
3. **Who builds:** step by step in sessions like this one, or overnight agent runs per phase, with reports in the morning?
