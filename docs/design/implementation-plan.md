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

**Guns, second pass (Oct 31, after studying Enter the Gungeon and Vlambeer's Nuclear Throne):**
- Lessons taken: bigger bullets read better and feel stronger; a bullet's first frame is a fat circle (the muzzle flash, Vlambeer's trick); a hit is several small responses at once (an impact pop, the target's white flash, knockback, a sound); you always see the gun, and it kicks; readable projectiles have a dark outline so they show on any ground.
- Built: pellets are pills with a dark outline, a bright body in the shot's colour (yellow plain, orange fire, blue water) and a white core, a short soft trail, a fat white circle on their first frame; slower (15 m/s, was 22) so you see them fly; a hit pops (a ring snapping open, a burst of short strokes) and pushes harder; walls pop with dust. The gun is a turret on the handlebars that turns to where it fires and kicks back on each shot (scatter: twin barrels; launcher: a fat tube; thrower: a nozzle and a tank). The camera kick is a third of what it was; the triangle flash on Kai is gone.

**Guns, third pass: projectiles in our own language (Oct 31).** Gabriel: the Gungeon pass felt "copied from another game"; every projectile must follow the design concept. The rules it follows (already the town's): the world is glyph cells; only light shouts; amber is yours, ember red is theirs (the far map's own rule).
- A projectile is a flying light, the machines' eye idiom: a lit cell at its head, the same point of light with a soft neon halo as an eye (so it reads the same close up and far away), and a trail that is a line of lit cells in the town's own glyph grid, dimming behind it, plus a faint glow on the ground (the atom map).
- Hues: amber (plain, yours), ember (fire), cold blue (water), red (the machines' bolts). The rocket: a glyph-solid body with lit exhaust cells, open flame and a smoke trail in the medium. The thrower: open flame or white mist in the medium. Hit sparks are glyphs (`* + · ×`) like the town's drifting sparkles. Pills, pops, orb bolts and ejected shells are gone.
- **The projectile lab** (`tools/roam/projectile-lab.cjs`): freezes the rules on a kerb, lines up every projectile and photographs it at close, mid and far zoom for design reviews (the main loop has a `lab` hook: freeze the rules, hold the camera).
- **The bike off walls:** it no longer stops dead and crawls backwards. The speed into the wall bounces back (0.45), the speed along it slides on (0.8), and the bike turns to its new direction: a glancing hit steers it along the wall, a head-on one throws it back out already turned away; for 0.18 s the stick can't drag it straight back in.

**Aim help (Oct 31):** shots hit a machine's whole drawn body now (a body radius per kind: crawler 0.75 m, skitter 0.6, hound 0.8, spitter 0.75, brute 1.25, plus the shot's own 0.35), not a 0.7 m point. Rockets seek: each picks the machine nearest where you pointed (within 40° of the aim and 20 m), turns toward it at 4.5 rad/s, retargets the nearest ahead if it dies, and bursts within 0.9 m of a body (a proximity fuse). Headless: scatter hits 25% → 34%, launcher 38% → 84%.

## M4. Clear an area (the goal) · about 1 week
**Why fourth:** gives a fight a purpose and an ending.

| Build | Notes |
|---|---|
| Areas | The town split into areas with a level and a state (dark → clean) |
| The walker | A `heavy` machine on a route, visible from far away; spawns crawlers; plants nests the longer it lives; plates, then a weak point |
| Clean stays clean | Killing the walker stops spawning; no respawns after |
| Glow-up | Care rises; lamps, windows and signs come on; a freeze and a light sweep |

**Play it:** Do you see the walker and want to go after it? Is farming its spawns first a real choice? Does the glow-up feel like a reward?

**As built (Oct 31, `play/m4-areas`):**
- **Areas are the town's own districts** (`src/roam/sim/areas.js`). A district with fewer than 25 street points (the park, the transmitter field, the barn quarter...) joins its nearest big neighbour, so seed 7 has six areas: the old town (level 1), south end (1), east end (1), the strip (2), the estate (4), Ashford Hollow (6). Level: one per 260 m from Kai's start; machines in an area have +30% health per level above 1.
- **The walker** (`MACHINES.walker`): a giant on four long legs, about twice a brute's size, drawn in the glyph medium with its four armour plates on its back and two red chip eyes (the biggest pair on the far map). It walks between points on its area's streets, drops a crawler every 9 s (5 at night, at most 8 alive), plants a new nest every 150 s (at most 2). Within 22 m it turns on Kai; in reach it rears (0.8 s, its eyes flare) and stomps (20 damage, throws her, flattens the grass, kicks up dust). Shots break its plates first (26 health each, more per level), then its bare, glowing core (takes 1.4x). It drops 24–32 scrap, 5 chips and a rare or epic weapon.
- **Clean stays clean:** when the walker dies its nests go dark and nothing is born in the area again (not the town's spawner, not its nests, not the hunting packs, which now come from outside).
- **The glow-up** (`src/roam/glowup.js`): a freeze and a ring of light sweeping out from where the walker fell, spreading the change; a clean area's grass greens by day, and at night its windows and street lamps light the ground warmly. A rising chord.
- **HUD:** the area under the counters ("THE OLD TOWN · LV 1 · DARK", ember while dark, gold when clean), a toast when Kai rides in, a red WALKER arrow with the distance, toasts for plates breaking and for the clean moment.
- Fix found on the way: a rocket's blast is measured to a machine's body edge, not its centre (a walker's centre is metres inside it).

**After Gabriel's M4 feedback (Oct 31): a world map, and a Horizon Zero Dawn walker**
- **The world map** (MAP, beside BAG): every area from the town's own district shapes, the streets as fine lines, live nests (♥), walkers as pairs of red eyes, Kai's @. Each area's name and fill take the colour of how hard it is for Kai now: grey clean, green at or under her level, yellow one or two above, red three or more (her level is cleaned areas + 1 until M7). TOWN / ALL zoom. The game pauses while it's open.
- **A bigger walker:** drawn 2.6x (body radius 6 m), its stomp reaches 8.5 m and hits for 22.
- **Its defence system, from Horizon Zero Dawn:** two weapon pods on its shoulders take aim (their lights flare, 0.7 s) and fire a three-bolt volley each every 3.2 s within 34 m; shoot a pod off and its volleys stop. A fuel tank on its back blows up on the walker itself: a plate off, 30% of its core, fire all round it (and Kai if she's close). Then the plates, then the core. In a fight it broods every 3 s, up to 14, a mix of crawlers, skitters, spitters and hounds, dropped around its feet.
- **Reading it (Horizon's Focus):** within 30 m Kai's lamp tags its parts on screen (POD, TANK, PLATES n / CORE, each with a health tick; × when broken). **The boss bar** at the top during a fight: its name and area, four plate segments, the core.
- Headless fight (a bot circling at 16 m, Kai taking damage): the scatter gun kills it in about 90 s with 2 downs; the launcher in about 160 s with 4 (its seeking rockets lock onto the brood).

**The map, World of Warcraft style, and no more nests (Oct 31)**
- **The map is painted from the real world:** one pixel per 2 m cell of the world's own record (grass, wheat, barley, rape, plough, pasture, woods, the mere, roads, pavements, yards, roofs with darker edges), in muted map colours. Area borders are dashed in their difficulty colour (solid once clean), names on dark plates. It opens on the area Kai is in (the land outside it dims, its quarters are named small inside it); WORLD shows everything; tap an area to open it; drag to pan, pinch or wheel to zoom; M opens and Esc closes it on a keyboard. Close now works on a phone: every panel button reacts on pointerdown, like the game's other buttons (a click could be eaten by the game's own touch handling).
- **Nests are gone** (Gabriel: they don't make sense next to walkers). The walkers are each area's only source of machines; the win is every area clean; the HUD chip reads "Clean 0/6"; the walker arrow replaces the nest arrow.

## M5. Risk and repair · 2–3 evenings
**Why fifth:** without a cost to dying, loot and fights lose tension.

| Build | Notes |
|---|---|
| Vehicle health and repair | Damage, a low-health warning, repair with scrap |
| Death cache | Dying drops unbanked scrap where you fell; you can go back for it |
| Banking | Scrap is only safe once it's banked in town |

**Play it:** Do you play more carefully when carrying a lot of scrap? Does going back for the cache feel fair?

**As built (Nov 1, `play/m5-risk`):**
- **The bike has a body** (`src/roam/sim/risk.js`, 100 health). While Kai rides it takes 70% of every hit; a crash into a wall faster than 6 m/s dents it. Below 30% it runs at 80% speed and smokes from the engine (the atom map's smoke); wrecked it limps at 55% and every hit lands on Kai. It never mends by itself.
- **Repair costs scrap.** REPAIR (above the pad, showing what a full repair costs) sets Kai working with the wrench: 8 health a second, one scrap per 4 health, only while the bike is stopped and no machine is within 10 m; the stick, a hit or a machine coming close stops her. Glyph sparks and a ratchet with each scrap spent.
- **Banks:** the garage on the square where Kai starts, and a beacon where each area's walker fell (cleaning an area gives you a bank out there). Riding within 7 m banks everything she carries and mends the bike fast from banked scrap (30 health a second). Drawn as a mast with an amber lamp and a warm pool of light on the ground; far out and on the map, ⌂ on an amber plate.
- **The death cache:** going down drops the scrap and chips she carried where she fell (a heap of scrap round a pulsing lamp, ◆ on the map, a CACHE arrow). Ride over it to take it back. A second death before that loses the first cache. Weapons in the bag are kept. The bike is towed back to the garage with at least 25% health.
- **HUD:** the bike's bar under Kai's (amber, ember when low, blinking when wrecked); ⌂ banked scrap beside what she carries; a BANK arrow once she carries 40+ or the bike is low; toasts that teach each rule the first time.
- Headless (a bot riding loops, 5 min): about 40 scrap a minute, a full repair is 25 scrap; the bot wrecks the bike by hitting walls (a real rider crashes far less).
- **Repairs stay as they are until everything is in place, then get earned (Gabriel, Nov 1):** fixing the bike yourself becomes a talent or perk (M7), not something Kai can do from the start; repairs at the garage come from a **mechanic** in town (M8): at first he charges scrap, and after you do his mission he repairs for free. Until those exist, the free-for-all repairs stay so the game is playable.

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

**Built as atoms, so every piece can be reused (Gabriel, Nov 1):**
- **The garage is a site atom, not a fixed spot.** The map generator places it like any other site (a gas station, a farm): on another map it lands somewhere else and looks different. It has an owner state (for sale, owned) so a later map can let you *buy* a garage and make it home, and a list of **services** it offers: bank, stash, workbench, repair. The walker beacons are the same atom with fewer services (just the bank). A truck form could later carry a **portable garage**: the same services on a vehicle.
- **Parts are atoms too:** one data table per part kind (slot, tags, what it does, `desc`/`why`), its look a **module** with a socket type (play-atoms §8: `mount`, `plate`, `lamp`, `wheel`, `vent`). The bike declares sockets; so will houses (M8). A weapon part on a house's `mount` socket is a turret guarding the people there; a tyre is the same tyre whether it's on your bike or the one a survivor asked for.
- **Recipes are one shape for everything:** a list of needs (scrap, chips, a part) with a result. The garage's upgrades use it now; later, missions use the same shape ("bring 40 scrap and a mount to build this house a turret", "build a tyre for the farmer").

**Recipes, not weapon drops (Gabriel, Nov 1):** machines drop scrap, chips and **recipes**, not weapons or parts (finding gear on monsters is confusing). Recipes also come from traders and as mission rewards. Everything is built, fitted and upgraded **in the garage**.
- A recipe is **learned forever** for now (Gabriel worries about how many there'll be late in the game; revisit then). A recipe you already know turns into chips. On the ground it keeps its rarity's coloured name, so a rare recipe is still a jackpot.
- Recipes Kai carries are **at risk until banked**: going down drops them into the death cache with her scrap.
- **Mods and sockets, like WoW gems:** "off-hand" is renamed **mods**. A mod (fire, water, ricochet, double shot...) is its own item, built from its own recipe. A weapon's recipe gives it some mods built in and some empty **sockets** you fill at the garage; some recipes have everything built in, others are mostly sockets.
- **A socketed mod stays for good (Gabriel, Nov 1):** like WoW gems it can't be taken back out, so putting one in is a real decision; a new mod over it destroys the old one.
- **Where damage comes from (agreed Nov 1):** the recipe decides what a gun *does* (its kind, built-in mods, sockets), never its damage. Damage comes from the weapon's **level**, raised with scrap at the garage (the main scrap sink) and capped by Kai's level (M7). So an early recipe never turns into junk, and the number of recipes stays small: each is a different behaviour, not a bigger number.

**As built (Nov 1, `play/m6-garage`):**
- **Recipes:** machines drop recipes (`src/play/recipes.js`: 12 weapons, 7 mods, 16 parts); brutes often, walkers always (rare or epic). A recipe on the ground is a rolled sheet in a tube with its rarity's paint and a lamp, its name over it in that colour. Kai carries it (BOOK shows carried and known) until a site banks it; then it's known for good. A known one turns into chips on pickup. Going down puts carried recipes in the death cache.
- **Sites are atoms** (`src/play/sites.js`): the camp (home, bank, repair), the garage (bank, repair, stash, workbench) on the forecourt of the town's own garage site (`world/sites.js` lays one out on every map; on seed 7 it's in the strip, 260 m south of the camp), beacons (bank only now). A map with no garage gives the camp the workbench.
- **The garage panel** (GARAGE at the forecourt, or G): BIKE shows the five slots with their stats, level and UPGRADE; the weapon's built-in mods and sockets. BUILD lists known recipes with their cost (common 15 scrap, tuned 40, rare 90 + 2 chips, epic 160 + 5; mods cheaper). STASH holds built gear (EQUIP, SALVAGE for 40% back) and your mods.
- **Mods in sockets are permanent:** tap an empty socket, pick a mod, confirm "for good". Socketing over an old mod destroys it. One element per weapon. The old off-hand enchant is now two mods (fire charge, water charge); the gun has none by default.
- **Levels:** a weapon's level is its damage (+10% a level); a part's level raises its main stats (engine speed, frame health, lamp reach, tyre grip). Upgrades cost banked scrap (weapon 6 x level, part 4 x level) and stop at 3 x Kai's level (areas cleaned + 1 until M7).
- **Parts change the bike** (`src/play/parts/bike.js`) and its look (`src/roam/bikelook.js`, a module per part on the bike's sockets, accents in the rarity's paint): torque, racer and charger engines; plated, light and bull-bar frames (the bull-bar rams brutes); twin, scanner and dazzle lamps (the dazzle slows machines in the beam); grip tyres, bouncers (bigger wall bounce, half crash damage), knobblies (props don't slow you).
- KIT is a test control now (only with `?dev=1`).
- Headless (a bot riding loops, 10 min): ~400 scrap, ~14 recipe drops (8 common, 4 tuned, 2 rare), a few chips: tuned builds cost scrap only so the early garage is reachable.

## M7. Levels and talents · about 1 week
| Build | Notes |
|---|---|
| Levels and XP | Kills for now (quests come in M8); a quadratic curve; kill XP drops against much weaker machines |
| Base kit | The bike's two abilities (drift strike, nitro) arrive by about level 6 |
| Talent tree | The bike's tree as behaviour data; the level-up card; respec at the garage |
| Field repair as a perk | Kai can't repair the bike herself until she takes it (Gabriel, Nov 1); later ranks make it faster or cheaper |

**Play it:** Does a level-up feel earned? Does the first talent change how you play?

## M8. Rebuild the town · 1–2 weeks
| Build | Notes |
|---|---|
| Reclaim the home town | The tutorial; trader and shops open |
| House sockets | Plate, lamp, vent and sign modules raise a house's care |
| Rebuild missions | Haul, courier, power line, guard; the main source of XP |
| Survivors move in | The hub fills up as you clean and rebuild |
| The mechanic | A survivor in town who repairs the bike: for scrap at first, free after his mission (Gabriel, Nov 1). Replaces the banks' free repair |

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
A portable garage on the truck form (the garage's services on a vehicle), buying a garage to make it home, turrets built for houses as missions; Shock and wind (and their reactions), epic modifier slots, schematics, the Deep Signal endgame, chapter 2, Kai on foot for narrow places and shops.

## Open decisions
1. **Build on Roam and freeze V2?** (Proposed: yes.)
2. **First form: the bike?** (Proposed: yes. It already exists in Roam.)
3. **How to build:** step by step in sessions like this one, or an overnight run per milestone with a playable link and a report in the morning?
