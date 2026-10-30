# Atomic engineering: Hollowmere's core design concept (Oct 30)

> **Every thing in the world is an atom. Every atom knows which elements affect it and how it reacts. Nothing is scripted:
> fire spreads because grass notices its neighbour is burning, not because a "fire system" paints it.**
> (Gabriel, Oct 30 20:34: "I call the game atomic engineering because every element can affect each other.")

This is a pillar, alongside free travel. It sits above [play-atoms.md](play-atoms.md) (the data shapes) and replaces the
grid-only fire of M2b. Every new thing added to the game (a weapon, a prop, a machine, a building) must answer:
*what is it made of, and what does each element do to it?*

---

## 1. What the reference games teach
| Game | What they did | What we take |
|---|---|---|
| **Breath of the Wild** (GDC 2017, Dohta) | A "chemistry engine" next to the physics engine: a rule-based state calculator. Elements (fire, water, ice, wind, electricity) are things without a constant state; materials (trees, rocks, the player) are solids. Three rules: elements change materials; elements change each other; materials never change each other directly. | The three rules, word for word. The player learns them once and uses them everywhere. |
| **Far Cry 2** (Jean-François Lévesque, 18 months on fire alone) | Grass, trees, huts, cars and explosives burn; dry savanna catches more easily than humid jungle; wind sets the direction; fire runs faster uphill; rain slows ignition until things dry; spread is limited for play and performance; chain reactions (a fire reaches a barrel) come from simple rules, not scripts; machines and people flee fire. | Fuel and dryness per material, wind, limits, chain reactions through emitters (barrels, tanks). Fire as an area "fear" tool. |
| **Red Dead Redemption 2** (behaviour as players see it; Rockstar hasn't published how it works) | A fire bottle, a shot lantern or dynamite starts fires that spread through brush, grass and trees; burnt grass stays blackened; fences burn and are destroyed; burning ground itself hurts; heavy rain puts exposed fires out. | Fire spreads through vegetation and wooden things, leaves a lasting scar, and the burning ground is dangerous in itself. |
| **Going Medieval / Don't Starve** (cell-based fire) | Each grid cell holds fire intensity, health and flammability; a neighbour catches when it passes its tests; damage is applied in batches to keep the game fast. | Heat and flammability per cell; batched updates; a hard budget. |

---

## 2. The three rules (our version)
1. **Elements change atoms.** Fire heats an atom, water wets it, wind pushes it. Each atom reacts by its own material.
2. **Elements change each other.** Water cools heat and puts fire out. Wind carries heat and embers. (Later: shock through water, cold against heat.)
3. **Atoms don't change atoms directly; they do it through what they emit.** A burning tree doesn't "set its neighbour on fire". It *gives off heat*, and the neighbour reacts to the heat it receives. That is how a fire spreads from grass to a fence to a tree to a car's fuel tank, with no special case anywhere.

---

## 3. What an atom is
Anything in the world: a 2 m patch of grass or crop, a tree, a hedge, a fence, a car, a bin, an oil stain, a puddle, a barrel, a house wall, a machine, the bike, Kai.

Every atom has:

| Part | What it is | Example (grass) |
|---|---|---|
| **Material** | Which profile it uses (shared by many atoms) | `dryGrass` |
| **State** | A few numbers that change: `heat`, `wet`, `hp`, flags (`burning`, `burnt`, `broken`) | heat 0, wet 0, hp 1 |
| **Emission** | What it gives off while in a state (a burning atom emits heat; a soaked one drips water; a lit oil spill emits heat strongly) | burning → heat 3/s within 2.5 m |

A **material profile** says how the atom answers each element:

| Field | Meaning |
|---|---|
| `ignite` | Heat needed to catch fire (low: grass; high: tree trunk; ∞: stone, asphalt) |
| `fuel` | How long it burns once lit (s) |
| `burnHeat`, `burnReach` | How much heat it gives off while burning, and how far |
| `soak`, `dry` | How much water it holds; how fast it dries (s). Wet atoms need their water boiled off before they heat up |
| `onBurnt` | What it becomes: `char` (grass, ash that never burns again), `stump` (tree), `gone` (fence: the path opens), `wreck` (car) |
| `onHeat` | Something that happens at a threshold instead of burning: a fuel tank `explodes`, glass `shatters` |
| `conducts` | (Later, for shock) passes charge on to touching atoms |
| `blocks` | Whether it stops heat (a stone wall shelters what's behind it) |
| `desc`, `why` | As every entry |

### First materials
| Material | Atoms | Ignite | Burns | Becomes | Notes |
|---|---|---|---|---|---|
| `dryGrass` | lawn, verge, meadow cells | low | 3 s | char | Fast fronts; the wind runs it |
| `crop` | wheat, barley, rape, stubble cells | low | 4–5 s | char (stubble) | Fields go up in sheets |
| `woodsFloor` | woods floor cells | medium | 5 s | char | Spreads under trees and lights them |
| `tree` | trees | high | 10 s | stump | Burns long and hot; lights the crown's neighbours |
| `hedge` | hedges | medium | 6 s | gone | Opens a gap (the bike already breaks hedges) |
| `woodFence` | fences, gates, crates, benches | medium | 6 s | gone | A fire opens new routes |
| `oil` | oil stains, machine slicks | very low | 6 s | char | Lights instantly, burns very hot |
| `fuelTank` | cars, barrels, petrol pumps | (no burn) | — | wreck | `onHeat: explode`: heat builds up, then it blows (a chain reaction) |
| `metal` | machines, bins, posts, the bike | ∞ | — | — | Doesn't burn; takes heat damage (machines get fire pips) |
| `stone` / `asphalt` | roads, walls, houses (for now) | ∞ | — | — | Firebreaks; walls block heat |
| `water` | puddles, the brook, the lake | ∞ | — | — | A water source; soaks what's dropped in |

---

## 4. How fire spreads (no fire system, only heat)
Every simulation tick (a few times a second, near the player):
1. Each **burning** atom emits heat to the atoms within its `burnReach`, more downwind, less upwind, none through a `blocks` atom.
2. Each atom adds the heat it received. If it's **wet**, the heat first boils its water off (it steams). If it's dry and its heat passes `ignite`, it **catches**.
3. A burning atom spends `fuel`. When the fuel is gone it becomes its `onBurnt` form (char, stump, gone, wreck) and stops emitting.
4. Atoms with `onHeat` (a fuel tank) do their thing when their heat passes the threshold. An explosion is a big one-off emission of heat and force.
5. Heat cools off slowly by itself, faster when wet.

Water works the same way in reverse. A soaked atom has `wet`; wet atoms resist heat and put out their own fire; water dries over time (`dry`).

This is a cellular automaton for the ground cells, plus the same rules for placed atoms (trees, fences, cars), all in one heat field. It's deterministic: the sim's own Rng stream is only used for small jitter.

---

## 5. Delivery: how an element reaches the world
An element only touches the world if the weapon **delivers** it there. Each weapon declares its `delivery`:

| Delivery | What it does | Example weapons |
|---|---|---|
| `pellet` | Hits what it strikes, then it's gone. The element affects **only the machine it hits** (its pips). It dissipates before reaching the ground. | Scatter gun, rifle |
| `splash` | Bursts on impact: puts its element into every atom within a radius (heat for fire, water for water) | Bazooka, grenade, fire bottle, water bomb |
| `stream` | A continuous cone or line that pours its element onto every atom it touches while held | Flamethrower, hose |
| `field` | A lingering area (a cloud, a burning patch) that keeps emitting | Scald and fog clouds, lit oil |

So a scatter gun with a fire modifier burns machines but never lights the grass. A bazooka with fire lights the patch where it lands. A flamethrower sweeps fire across a field. (Gabriel: "those effects should not apply on a normal shot since it will dissipate before hitting the ground, but on a bazooka or flamethrower it would affect things.")

---

## 6. Machines, the bike and Kai are atoms too
- **Machines** (material `metal`, tag `chipped`) don't burn, but heat in their atom gives them fire pips, and water gives them water pips. The pip recipes (blaze, soak, scald, fog) stay as they are: they are how elements combine on a machine.
- **Machines react to fire like in Far Cry 2:** they steer around burning ground, and a hunting pack loses its path through a fire wall. Fire becomes a tool to herd and block.
- **The bike and Kai** take heat like any atom. Whether her own fire can hurt her is an open question (see §9).

---

## 7. Limits (fun and fast)
| Rule | Why |
|---|---|
| Only atoms within a radius of the player simulate; far away, fires freeze until you come back | Phone frame rate |
| A cap on burning atoms (e.g. 600) and on heat updates per tick, processed in batches | Far Cry 2 and Going Medieval both limit spread for play and performance |
| Fuel runs out, burnt atoms never burn again | Fires end; scars stay (RDR2) |
| Wind is gentle and steady for now; weather (rain, dry spells) comes later | Rain putting fires out is a later layer (Far Cry 2, RDR2) |
| One look per state: a heat glow, flames, a wet sheen, char | Readable on a phone (Sakurai) |

---

## 8. Code shape
| File | What |
|---|---|
| `src/play/materials.js` | Material profiles (data, with `desc` and `why`) |
| `src/play/atoms-map.js` | Which atoms use which material: ground chars → material; city atom ids (tree, hedge, fence, car, bin…) → material |
| `src/roam/sim/world.js` | The atom world: state for ground cells (typed arrays over the char map) and for placed atoms (entities); heat emission, wetness, ignition, burn-out, `onHeat`; a budget per tick |
| `src/roam/sim/guns.js` | Each weapon's `delivery`; `pellet` touches only what it hits, `splash`/`stream`/`field` call the world |
| `src/roam/scars.js` | Render: char, stumps, wrecks, gaps, wet sheen written into the tiles |
| `test/atoms-world.test.mjs` | Every material complete; a line of grass burns downwind faster than upwind; wet grass doesn't catch; a fence becomes `gone`; a car near a fire explodes once |

**Adding an atom:** give it a material (or a new one in `materials.js`). Nothing else.

---

## 9. Decisions (Oct 30)
1. **Fire hurts Kai, on the bike or off it** (Gabriel). Each material has `hurts` (per second while standing in it); a car blast hurts her by distance. First time: a toast, "Fire burns you too."
2. **Houses, cars and trees burn** (Gabriel: "it would make the players less shooting everything all the time"). Houses: `building` (slow to catch, burn ~45 s, leave a gutted shell). Cars, pumps, tractors: `fuelTank` (never catch: heat up, blow, the wreck burns ~9 s). Trees leave a stump with no crown.
3. **Test weapons in KIT:** `launcher` (splash: a rocket that bursts, r 2.6) and `thrower` (stream: short spray; fire by default, water hoses). The scatter gun's pellets never touch the world.
4. **Rain:** later.

## 10. As built (M2c)
- **Heat moves on a tick** (`ROAM.atoms.tick`, 0.25 s), only within `simR` (140 m) of Kai; far fires wait. At most `maxBurn` burning things at once.
- **Placed atoms** live in a list on an 8 m grid; a house is measured by its footprint (rotated box), others by a circle. Only atoms that are warm, wet, burning or slick are touched each tick (the `live` set), so 11 000 atoms cost nothing at rest.
- **Ground cells** keep sparse state (a Map of hot, wet or burning cells over the char map); a burnt cell is char for good.
- **Machines** take fire pips while standing in fire, lose them on wet ground, and steer round fire unless already in it.
- **Tuning** found by headless runs: a dry field's fire front moves about 2 m/s downwind and barely upwind; a hedgerow carries it, slower than before; a terrace of houses goes one house every ~5 s. Numbers live in `materials.js` and `ROAM.atoms`.
- **Tests:** `test/atoms-world.test.mjs` (materials complete, downwind beats upwind, soaked ground won't catch, a fence burns away, a car blows once, a fire pellet leaves the ground untouched).
