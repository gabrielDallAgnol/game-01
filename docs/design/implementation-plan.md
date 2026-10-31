# Hollowmere: implementation plan (Oct 30, reordered)

How we turn the design ([new-direction.md](new-direction.md), [play-atoms.md](play-atoms.md)) into the game.

**Ordered by importance** (Gabriel, Oct 30 16:54). Each milestone is a **playable slice**: it ends with a build Gabriel can play on his phone, a short "play it" checklist for how it should feel, and automated tests. If a milestone isn't fun, we fix it before the next one.

## The starting point
| What exists | Where | Use it for |
|---|---|---|
| **Roam**: the generated town, Kai on the bike, the dead with sleep/wander/chase, nests with hearts, day/night, a fixed-step deterministic sim | `roam.html`, `src/roam/` | **The base of the new game.** The bike is the first form |
| City atoms: care, slots, atoms, stories | `src/roam/dress/`, `src/roam/atoms/` | Materials (oil puddles), house sockets, the glow-up |
| The One-medium renderer, lighting | `src/roam/medium.js`, `look.js` | Machines, reactions, beams, the glow-up |
| The old V2 town-defence game | `index.html`, `src/sim/`, `src/render/`, `src/ui/` | **Frozen** (proposed). Keep its golden test green |

## How every milestone ships
- **A playable build:** `roam.html` bundled into one page (the lab bundler already does this for any page), published as a private link Gabriel can open on his phone.
- **"Play it" checklist:** 3–5 questions about feel, answered by playing (e.g. "does steam feel like a trick, not a number?").
- **Tests:** a Roam golden test (deterministic hashes), plus unit tests and headless sims for each new system.
- **Code rules (CLAUDE.md):** one branch per milestone, new code in new modules, `src/play/` for atoms data and systems, a deterministic sim, `desc` and `why` on every data entry.

---

## M1. Ride and shoot (the heart) · about 4–5 evenings
**Why first:** if riding and shooting don't feel good, nothing else matters (all six council seats).

| Build | Notes |
|---|---|
| Safety net first | Roam golden test; split `src/roam/sim.js` into modules (no behaviour change); Kai starts on the bike |
| Machines replace the dead | One machine, the **crawler** (tags `metal`, `chipped`, `light`), using the existing chase logic and machine glyphs |
| Main weapon, auto-aimed | One weapon theme (a scatter gun), fire pipeline stages in place |
| Feel | Hitstop on kills, screen shake, hit sparks, a death burst |
| Controls | Stick steers; the main weapon button (other buttons shown, greyed out) |

**Play it:** Is riding through the town and gunning crawlers fun for 5 minutes with nothing else? Do hits land with weight? Can you read what's happening on a phone?

## M2. Combos (the atoms) · about 4–5 evenings
**Why second:** combos are what makes Hollowmere's combat its own.

| Build | Notes |
|---|---|
| `src/play/` chemistry | Tags, elements (fire, water), statuses, reactions (steam, blaze, soaked, clash), effects, the hit pipeline, the validator |
| Off-hand weapon | A water cannon on the second button |
| One material | Oil puddles on the map (fire → burning ground) |
| Readability | Status pips (●○○), one look and sound per reaction |

**Play it:** Does wet + fire → steam feel like a trick you pulled off? Does fire ×3 → blaze reward a one-element style? Do you start looking for oil puddles?

## M3. Loot that changes your guns (the Archero feel) · about 1 week
**Why third:** finding a modifier that changes how you shoot is the main reason to keep fighting.

| Build | Notes |
|---|---|
| Drops | Scrap from every kill; weapon drops from tougher machines (a second machine type: the brute) |
| Modifiers | Double shot, faster, fire, ricochet; rarity sets modifier slots (common 0, tuned 1, rare 2) |
| Loot feel | Colour beams and a sound by rarity, readable at speed; the lamp radius pulls scrap in |
| Quick swap | Compare and equip a dropped weapon on the spot (no menu dive) |

**Play it:** Do you turn back for a yellow beam? Does double shot + fire feel like a power spike? Is picking things up a jackpot or a chore?

**As built (Oct 30, `play/m3-loot`):**
- `src/play/loot.js`: rarities (common 0 slots, tuned 1 blue, rare 2 yellow and unscanned until the lamp reaches it, epic 3 violet), the modifier pool (double shot, faster, ricochet, fire, water; one element at most), the base pool (scatter; launcher and thrower rarer), drops per machine (scrap pieces, weapon chance, rarity weights), salvage values.
- `src/roam/sim/loot.js`: drops on death and on a nest breaking (chips plus a tuned-or-better weapon); the lamp pulls scrap in (4 m, 5.5 m on the bike) and banks it; quick swap: equip leaves your old weapon on the ground; salvage pays scrap (and chips for rare+).
- Ricochet: pellets glance off walls and jump to the next machine within 7 m.
- Look: scrap is bent bits of steel in the glyph medium; a weapon is a small case with a plate in its rarity's paint and a lamp; its light is a point and a soft halo in the rarity colour (the machines' eye idiom), a pale flicker while unscanned. HUD: scrap ⚙ and chips ◆ counters; the swap card above the pad.
- KIT: the element now defaults to the weapon's own; KIT mods are extra test mods on top of the weapon's.
- Not yet: sounds (there is no audio yet), auto-salvage setting, the death cache (M5), the lamp part (M6).

**After Gabriel's first M3 playtest (Oct 31):**
- **Fire weakens hop by hop:** each thing a fire lights burns at 0.85× the strength of what lit it, heat and reach included, so a grass fire dies out about 20 m from where it started (it can still jump if it reaches a car). At most 300 burning things at once (FPS).
- **Houses and cars need real fire:** a house catches at heat 22 (a grass fire beside it isn't enough; a thrower takes about 2 s, three fire rockets), a car blows at 12 (two fire rockets).
- **Scrap comes to you:** it settles for half a second, then flies to Kai from up to 14 m, speeding up, as bigger bits with a bright streak; each one pings a step up a little scale.
- **Diablo II pickup:** a weapon's name floats over it in its rarity's colour ("Burning Launcher of Haste": prefix from the first modifier, suffix from the second; '?' until the lamp scans a rare). Ride over it and it goes in the **bag** (12 slots). The pickup feed shows its name; BAG (next to the counters) opens the bag: equip (your weapon goes in the bag) or salvage. The quick-swap card is gone.
- **Guns rework, first pass:** synthesized sound for everything (a boom and thump per scatter shot, the rocket's whoosh and the blast, the thrower's roar or a hose's hiss while held, hit ticks, a machine's crunch, scrap pings, rarity chimes, crackle near fire); recoil (the camera kicks back, hardest for the launcher); muzzle and hit light in the medium; hot tracers for pellets; spent shells that fly out and lie a while; rockets start slow and accelerate, with a steel body, an exhaust glow and a smoke trail; the thrower's spray is open flame in the medium, wider and cooler as it travels (water: wet ground and mist); blasts lay the grass flat.

## M4. Clear an area (the goal) · about 1 week
**Why fourth:** gives a fight a purpose and an ending.

| Build | Notes |
|---|---|
| Areas | The town split into areas with a level and a state (dark → clean) |
| The walker | A `heavy` machine on a route, visible from far away; spawns crawlers; plants nests the longer it lives; plates, then a weak point |
| Clean stays clean | Killing the walker stops spawning; no respawns after |
| Glow-up | Care rises; lamps, windows and signs come on; a freeze and a light sweep |

**Play it:** Do you see the walker and want to go after it? Is farming its spawns first a real choice? Does the glow-up feel like a reward?

## M5. Risk and repair · 2–3 evenings
**Why fifth:** without a cost to dying, loot and fights lose tension.

| Build | Notes |
|---|---|
| Vehicle health and repair | Damage, a low-health warning, repair with scrap |
| Death cache | Dying drops unbanked scrap where you fell; you can go back for it |
| Banking | Scrap is only safe once it's banked in town |

**Play it:** Do you play more carefully when carrying a lot of scrap? Does going back for the cache feel fair?

## M6. The garage and the vehicle's look · about 1 week
**Why sixth:** turns loot into a build you care about and can see.

| Build | Notes |
|---|---|
| Home town hub, first version | A garage and a stash |
| 6 part slots | Weapon, off-hand, engine, frame, lamp, tyres (tyre terrain effects come in M9) |
| Garage actions | Equip, salvage into scrap and chips, reroll a modifier (chips), upgrade a part's level |
| Visual modules and sockets | Each slot changes the bike's look; rarity tints; uniques get their own mesh |
| Economy sim | Headless: banked scrap, drops per minute, time to the first unique |

**Play it:** Do you like looking at your bike? Is salvaging or keeping a part a real decision?

## M7. Levels and talents · about 1 week
| Build | Notes |
|---|---|
| Levels and XP | Kills for now (quests come in M8); a quadratic curve; kill XP drops against much weaker machines |
| Base kit | The bike's two abilities (drift strike, nitro) arrive by about level 6 |
| Talent tree | The bike's tree as behaviour data; the level-up card; respec at the garage |

**Play it:** Does a level-up feel earned? Does the first talent change how you play?

## M8. Rebuild the town · 1–2 weeks
| Build | Notes |
|---|---|
| Reclaim the home town | The tutorial; trader and shops open |
| House sockets | Plate, lamp, vent and sign modules raise a house's care |
| Rebuild missions | Haul, courier, power line, guard; the main source of XP |
| Survivors move in | The hub fills up as you clean and rebuild |

**Play it:** Do you want to go back to town to see what changed? Do missions feel like helping people, or like chores?

## M9. Forms and tyres · 1–2 weeks
| Build | Notes |
|---|---|
| Truck and roller | Each with its own kit, sockets and tree; the switch-form button |
| Starter choice | NFS/Pokémon-style pick at the start; the others unlock through the story |
| Tyres and terrain | Grip and speed per terrain; a spare set; never blocking |
| Form routes | Optional vents, gaps and barricades |

**Play it:** Can each form carry the whole game alone? Does switching feel optional, not required?

## M10. Chapter 1 complete
The control-node boss, the story hooks (the chip, the 3:00 radio voice), side quests, 3–5 areas, polish, a full playtest.

## Later list (not before chapter 1 is fun)
Shock and wind (and their reactions), epic modifier slots, schematics, the Deep Signal endgame, chapter 2, Kai on foot for narrow places and shops.

## Open decisions
1. **Build on Roam and freeze V2?** (Proposed: yes.)
2. **First form: the bike?** (Proposed: yes. It already exists in Roam.)
3. **How to build:** step by step in sessions like this one, or an overnight run per milestone with a playable link and a report in the morning?
