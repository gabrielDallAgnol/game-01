# Hollowmere play atoms: how everything connects (Oct 30)

**What this is:** the design and code guide for Hollowmere's combat, loot and rebuilding building blocks. It extends the town's atom system ("Hollowmere city atoms Oct 29") from *how the world looks* to *how the world plays*. It is written for Gabriel and for the AI coding agents. Every section says **what it is, why it exists, and how to add one**.

Status: **design, decided Oct 30 15:34** (Gabriel: "very atomic, modules, easy to connect, everything explained"). File paths are proposals. Match them to the repo's current tree (`src/roam/`, `src/atoms/`) when building.

---

## 0. The one rule
> **Systems react to properties, never to names.**

Code never asks "is this the flamethrower?" It asks "does this hit carry **fire**?" or "is this target **metal**?" So a new weapon, enemy, house or puddle joins every existing interaction for free, as long as it declares its properties.

Everything follows from that:
- **Content is data.** A new thing means a new entry in a data file, not new logic.
- **Logic lives in a few small, general systems** (the hit pipeline, statuses, reactions, effects).
- **Every data entry explains itself** with `desc` (what the player reads) and `why` (what the designer intended). An AI agent reading the file then knows what the thing is *for*.

---

## 1. The building blocks
| Block | What it is | Example | File (proposal) |
|---|---|---|---|
| **Tag** | A property word a thing *has* | `metal`, `flammable`, `chipped`, `heavy` | `src/play/tags.js` |
| **Element** | Something a hit or a cloud *carries* | fire, water, shock, wind | `src/play/elements.js` |
| **Status** | What an element *leaves* on a thing, for a while | burning, wet, charged, gusted | `src/play/statuses.js` |
| **Reaction** | A status meeting a new element → a result | wet + fire → **steam** | `src/play/reactions.js` |
| **Effect** | One small verb that does something | `damage`, `push`, `pull`, `cloud`, `ground`, `chain`, `slow`, `blind`, `explode` | `src/play/effects.js` |
| **Material** | A thing in the world that reacts | oil puddle, water pipe, gas tank, wooden fence | `src/play/materials.js` |
| **Behaviour** | A trigger + condition + effects, attached to something | "on nitro: leave frost ground" | used by talents, uniques, mods |
| **Modifier** | An Archero-style trait on a weapon | double shot, ricochet, pierce, +rate, +size, +fire | `src/play/modifiers.js` |
| **Part** | Loot: a base + modifiers + a look | "Rare bazooka: double shot, fire" | `src/play/parts/*.js` |
| **Visual module** | A reusable mesh piece with sockets | armour plate, lamp, tyre, shutter | `src/atoms/modules/*.js` |
| **Socket** | A named place a module can attach | `frame.plate`, `wall.plate`, `mount.weapon` | declared on vehicles and buildings |

---

## 2. Tags: what things are
**What:** short words describing what a thing is made of or how it behaves.
**Why:** they are the vocabulary all interactions use. Shock conducts through `metal`, fire spreads on `flammable`, EMP hurts `chipped`.

| Tag | Meaning | Who has it |
|---|---|---|
| `metal` | Conducts shock; doesn't burn | Most machines, the vehicle, barrels |
| `chipped` | Has a hostile chip (EMP and chip loot) | Enemy machines, never Kai's vehicle |
| `flammable` | Catches fire | Oil, wood, dry grass, fuel tanks |
| `wettable` | Can become wet | Almost everything except fire itself |
| `heavy` | Barely pushed or pulled | Walkers, big machines, the truck form |
| `light` | Easily pushed or pulled | Drones, small machines, the roller form |
| `flying` | Ignores ground effects | Drones |
| `shielded` | Absorbs hits until broken | Deep Signal machine mod |
| `building` | Part of a house or structure | Houses, walls, fences |

**How to add one:** add a line to `tags.js` with `desc` and `why`. Then any reaction, effect or behaviour can check it.

---

## 3a. Revised Oct 30, 20:00 (Gabriel's playtest): pips, recipes, the off-hand as an enchant, the world on fire
This replaces the "status + element → reaction" rule below; the rest of §3 stays as background.

| Piece | How it works now | Code |
|---|---|---|
| **Pips** | Every elemental hit adds a pip (dot) to the machine, in its element's colour, up to 3. Hits from one volley count once. Each pip works while it lasts: fire pips burn, water pips slow. | `src/play/hit.js`, `PIPS` in `src/play/statuses.js` |
| **Recipes** | When three pips are full, their **mix** goes off and clears them: fire×3 **blaze**, water×3 **soak**, 2 fire + 1 water **scald** (hot steam: hurts and hides you), 2 water + 1 fire **fog** (wide cloud: the escape). With more elements, 3 different ones make a third kind of recipe. A missing recipe falls back to its pair's other lead, then to clash, so a mix is never silent. | `src/play/reactions.js` (`recipeFor`) |
| **The off-hand** | Not a button and not a second weapon: an **enchant** on the gun. Every 2nd (or 3rd) shot carries its element, so a fire gun with a water enchant lands fire, water, fire: a scald. | `S.guns.off` in `src/roam/sim/guns.js` |
| **The world** | Fire catches grass, crops, the woods floor and trees (2 m cells of the char map), spreads to neighbours (more downwind), and burns out to char that never burns again. Water soaks the ground: it stops fire, puts out burning pips, slows what walks on it (no pips: wet ground setting off soaks would loop). Oil stains and the slicks machines leak burst into flame. Burnt and soaked ground is written into the streamed tiles (`src/roam/scars.js`). | `src/roam/sim/chem.js` |
| **Testing** | The KIT button opens the loadout: the gun's element, the enchant and how often, mods. A test control until the garage exists. | `src/roam/ui.js`, `sim.setLoadout` |

**Adding an element now:** its entry in `elements.js` and `PIPS`, then a recipe for each mix with every existing element (AAB and ABB), its three-of-a-kind, and which ground chars it touches. The validator lists missing mixes.

## 3. Elements, statuses and reactions: the chemistry
**What:** a hit can carry an **element**. The element leaves a **status** on the target. If a target that already has a status gets hit by a *different* element, a **reaction** happens.

**Why:** a small, consistent rule set that players can learn by instinct (Fujibayashi #5), and that creates combos nobody had to script.

### The three laws (BotW-style)
1. **Elements change things:** they leave statuses on enemies, materials and Kai.
2. **Elements change each other:** two different elements on one thing make a reaction.
3. **Materials don't change each other:** an oil puddle next to a water pipe does nothing until an element arrives.

### Elements → statuses
| Element | Leaves status | Status does on its own | Lasts |
|---|---|---|---|
| Fire | `burning` | Damage over time; spreads to `flammable` nearby | 4 s |
| Water | `wet` | Puts out `burning`; slightly slower | 6 s |
| Shock | `charged` | Short stun on `chipped` | 3 s |
| Wind | `gusted` | Pushed back (a lot if `light`, barely if `heavy`) | 1 s |

### Reactions (status already on target + incoming element)
| Reaction | Recipe (either order) | Result (as effects) |
|---|---|---|
| **Steam** | wet + fire | `cloud(steam, r=5m, 5s)`: enemies inside lose their target |
| **Overload** | burning + shock | `explode(r=3m)` + `push` |
| **Firestorm** | burning + wind | `explode(r=5m)` + spreads `burning` |
| **Conduct** | wet + shock | `chain(shock)` to every `wet` or `metal` target within 6 m |
| **Frost** | wet + wind | `slow(60%)` → `freeze` if hit again within 2 s |
| **Storm** | charged + wind | `pull(r=6m)` + `charged` on everything pulled |

When a reaction fires, both statuses are used up. This stops endless loops and makes each combo a moment.

### Same element twice: intensify, never silence (decided Oct 30 16:15)
**Rule:** every hit gives feedback. Hitting a target with the element it already carries never does "nothing". It **intensifies**: the status stacks (up to 3), the duration refreshes, a pip counter shows above the target, and the 3rd stack triggers a small payoff. Players who build around one element are rewarded, not discouraged.

| Element | Stacks of | 1 → 2 stacks | 3 stacks: payoff |
|---|---|---|---|
| Fire | `burning` | More damage over time | **Blaze:** a burst that sets nearby `flammable` things and enemies burning |
| Water | `wet` | Slower | **Soaked:** wet lasts twice as long and Conduct/Frost hit harder on it |
| Shock | `charged` | Longer stun on `chipped` | **Short-circuit:** a big stun plus bonus chip drop chance |
| Wind | `gusted` | Further push | **Gale:** knocks the target down and pushes its neighbours |

After the payoff, the stacks reset. The pips (●○○ → ●●● → flash) make the build-up readable on a phone screen.

### The coverage rule
**The element grid has no empty cells.** For N elements there are N same-element intensify entries plus N×(N−1)/2 pair reactions. With 4 elements that's 4 + 6 = 10 entries. A validator checks that every cell is filled.

If a cell is missing (e.g. while a new element is being designed), the game falls back to a generic **Clash** (a small spark burst, a little damage and a sound) so a combination is never silent. The validator still flags the gap as a TODO.

### Adding a new element (designed to be easy)
Example: adding **acid**.

| Step | What to write | Where |
|---|---|---|
| 1 | The element and its status (`corroded`: lowers armour) | `elements.js`, `statuses.js` |
| 2 | Its intensify entry (3 stacks → **Melt**: armour plates fall off) | `reactions.js` |
| 3 | One reaction per existing element (acid + fire = toxic fumes cloud; acid + water = diluted, spreads wider…) | `reactions.js` |
| 4 | Which materials and tags care (`metal` corrodes faster; `shielded` ignores it) | `materials.js`, `tags.js` |
| 5 | A look, a sound and a colour that doesn't clash with the others | the entry's `look` / `sound` |

Until step 3 is finished, missing pairs use Clash, so the game keeps working. Run the validator to list what's still missing. **No system code changes.**

```js
// src/play/elements.js
{ id: 'acid', status: 'corroded', color: '#9BE34B', maxStacks: 3,
  desc: 'Eats through armour.', why: 'Counters shielded Deep Signal machines.' }

// src/play/reactions.js: intensify uses the same shape, with both needs the same element
{ id: 'melt', needs: ['corroded', 'acid'], stacks: 3,
  effects: [ { do: 'strip', what: 'armour' } ], consumes: true,
  look: 'acid_hiss', sound: 'sizzle',
  desc: 'Three acid hits melt armour plates off.', why: 'The acid build's payoff.' }
```

### Reaction data shape
```js
// src/play/reactions.js
{ id: 'steam',
  needs: ['wet', 'fire'],              // a status + an element, either order
  effects: [ { do: 'cloud', kind: 'steam', r: 5, t: 5 } ],
  consumes: true,                      // removes both statuses
  look: 'steam_puff', sound: 'hiss',   // one clear look and sound per reaction (readability)
  desc: 'Fire on something wet makes a cloud of steam. Machines inside lose track of you.',
  why: 'Gabriel's example (fire + water = smoke, enemy gets lost). A defensive reaction to balance the explosive ones.' }
```

**How to add a reaction:** one entry. **How to add an element:** one entry in `elements.js` (with its status) plus its reactions with the existing elements. No system code changes.

---

## 4. Materials: the world joins in
**What:** things on the map that carry tags and can take statuses: oil puddles, water pipes, gas tanks, dry grass, wooden fences, scrap piles.
**Why:** your weapons, the enemies and the map all play by the same rules (Fujibayashi #2). Oil + fire becomes burning ground without a special case.

| Material | Tags | Example interaction |
|---|---|---|
| Oil puddle | `flammable`, `liquid` | Fire → burning ground for 6 s (hurts what drives through) |
| Water pipe / puddle | `liquid`, `wet-source` | Shock → electrified puddle (Conduct on anything standing in it) |
| Gas tank | `flammable`, `metal`, `volatile` | Fire or shock → explodes |
| Dry grass | `flammable` | Fire spreads along it; wind pushes the fire |
| Wooden fence | `flammable`, `building` | Burns down, opening a path |

Materials are **city atoms with play tags**. A town atom like `car` or `bin` can get `tags: ['metal']`, and a puddle atom gets `tags: ['liquid']`. Existing atoms join combat just by adding tags.

---

## 5. Effects: the small verbs
**What:** the only things that actually change the game. Every reaction, modifier, talent and unique is built from these.
**Why:** a short list of verbs, each written and tested once. New content combines them instead of writing new code.

| Effect | Does | Parameters |
|---|---|---|
| `damage` | Removes health | amount, element (optional) |
| `apply` | Adds a status | status, duration |
| `push` / `pull` | Moves targets (scaled by `heavy` / `light`) | force, radius |
| `explode` | Damage + push in a radius | radius, amount |
| `cloud` | Spawns an area that lasts (steam, smoke, gas) | kind, radius, time |
| `ground` | Spawns a ground patch (fire, frost, oil) | kind, radius, time |
| `chain` | Jumps to nearby targets with a tag | element, range, jumps |
| `slow` / `freeze` / `blind` | Control | amount, time |
| `spawn` | Creates a projectile or an entity | what, count, spread |
| `heal` / `shield` | Defence for Kai | amount |

**How to add an effect:** this one *is* code. Write it once in `effects.js` with a test. It should be rare: most new content shouldn't need a new verb.

---

## 6. Behaviours: trigger + condition + effects
**What:** the format shared by talents, uniques, modifiers and machine mods. "When X happens, if Y is true, do Z."
**Why:** one format means one system to build and debug. A talent and a unique part are the same kind of thing.

### Triggers (events the game announces)
`onFire` (a weapon fires) · `onHit` · `onKill` · `onReact` (a reaction happened) · `onNitro` · `onDrift` · `onRam` · `onJump` / `onLand` · `onSwitchForm` · `onDamaged` · `onPickup` · `everySeconds`

### Examples
```js
// A talent (Rider tree)
{ id: 'nitro_trails', on: 'onNitro',
  do: [ { do: 'ground', kind: 'fire', r: 1.5, t: 3, along: 'path' } ],
  desc: 'Nitro leaves a trail of fire behind you.',
  why: 'Turns movement into offence; combos with wind and oil puddles.' }

// A unique part's signature behaviour
{ id: 'cryo_heart', on: 'onReact', if: { reaction: 'frost' },
  do: [ { do: 'chain', element: 'water', range: 5, jumps: 2 } ],
  desc: 'Frost spreads wetness to 2 nearby machines.',
  why: 'Unique for frost builds; sets up Conduct chains.' }

// A Deep Signal machine mod (an enemy's behaviour)
{ id: 'overcharged', on: 'onDamaged', if: { chance: 0.25 },
  do: [ { do: 'apply', status: 'charged', target: 'attacker' } ],
  desc: 'Hitting it can charge you.', why: 'Punishes careless shock builds.' }
```

---

## 7. Weapons and modifiers: the Archero layer
**What:** the main weapon and the off-hand weapon are both **parts**. Each has a **theme** (base type), **one signature trait**, and **modifier slots** that depend on rarity.
**Why:** discovering combos is the fun. A bazooka with double shot fires two rockets, and fire on one weapon plus water on the other makes steam.

### The fire pipeline (how a shot is built)
```
press button
 → base weapon makes a shot  (theme: rocket, flame, rail, scatter…)
 → modifiers edit the shot, in a fixed order:
     1 count   (double shot, triple, spread)
     2 path    (ricochet, pierce, homing, boomerang)
     3 size    (bigger blast, longer flame)
     4 rate    (faster fire)
     5 element (adds fire / water / shock / wind to every hit)
 → each projectile flies; on hit → onHit behaviours → status → reaction → effects
```
The fixed order makes stacking predictable. "Double shot + ricochet" always means "two projectiles that each ricochet".

### Rarity = modifier slots
| Rarity | Modifier slots | Extra |
|---|---|---|
| Common | 0 | Theme + signature only |
| Tuned | 1 | |
| Rare | 2 | Drops unscanned |
| Epic | 3 | |
| Unique | 2 + its named behaviour | Its own look |

### Modifier data shape
```js
// src/play/modifiers.js
{ id: 'double_shot', stage: 'count', fits: ['weapon', 'offhand'],
  edit: shot => ({ ...shot, count: shot.count + 1, spread: shot.spread + 8 }),
  stack: 'add', cap: { count: 5 },          // stacks, but capped (see §10)
  desc: '+1 projectile.', why: 'Archero staple; biggest feel upgrade, so its value scales down when stacked.' }

{ id: 'fire', stage: 'element', fits: ['weapon', 'offhand'],
  edit: shot => ({ ...shot, element: 'fire' }),
  stack: 'replace',                          // one element per weapon (keeps combos readable)
  desc: 'Hits set machines on fire.', why: 'Element modifiers are how the two weapons combo.' }
```

### Part data shape
```js
// src/play/parts/weapons.js
{ base: 'bazooka', slot: 'weapon', theme: 'rocket',
  signature: { id: 'big_boom', desc: 'Rockets knock small machines down.' },
  shot: { count: 1, speed: 22, dmg: 18, radius: 2.5, rate: 0.9 },
  module: 'mount_bazooka',                   // its look (§8)
  tags: ['metal'],
  desc: 'Slow, heavy rockets.', why: 'The heavy theme; pairs with count modifiers.' }
// A dropped item = { base, rarity, level, mods: ['double_shot', 'fire'], seed }
```

---

## 8. Visual modules and sockets: one piece, many places
**What:** every visible piece (armour plate, lamp, tyre, weapon mount, shutter, chimney) is a **module**: a small mesh with a **socket type**. Vehicles and buildings declare **sockets**. Any module whose type matches a socket fits there.
**Why:** parts change how the vehicle looks, and the same modules can rebuild houses. Your armour-plate example works: one plate module fits the vehicle's frame *and* a house wall.

### Socket types
| Socket type | On the vehicle | On a building |
|---|---|---|
| `plate` | Frame armour points | Wall shutters, boarded windows |
| `lamp` | Headlights | Porch light, street lamp (kerb slot) |
| `mount` | Weapon and off-hand mounts | Roof antenna, rooftop turret (later) |
| `wheel` | Tyres | (no) |
| `vent` | Exhausts | Chimney |
| `sign` | Decals | Shop sign, graffiti |

### Module data shape
```js
// src/atoms/modules/plates.js
{ id: 'plate_riveted', socket: 'plate',
  variants: ['tended', 'worn', 'ruined'],    // same care bands as city atoms
  volumes(inst, K) { /* glyph boxes, ≤ 10 volumes, house style */ },
  tint: 'rarity',                            // on the vehicle: paint and glow follow rarity
  desc: 'A riveted steel plate.', why: 'Shared by vehicle frames and house walls.' }
```

### How rebuilding uses it
- Each house has sockets (`plate` on windows, `lamp` at the door, `vent` on the roof, `sign` at the front).
- A **rebuild mission** fills sockets: deliver plates, hang a lamp, fix the chimney. Each one raises the house's **care**.
- The existing care system then does the rest: higher care makes the house tidier, lights its windows, grows its garden.
- Bonus: an old frame part salvaged at the garage can become shutters for a house. Loot feeds rebuilding.

---

## 9. Enemies are atoms too
**What:** a machine is data: tags + stats + behaviours + a module set.
**Why:** new enemies and Deep Signal machine mods are just tags and behaviours. The chemistry works on them automatically.

```js
// src/play/enemies/scavengers.js
{ id: 'crawler', tags: ['metal', 'chipped', 'light'],
  hp: 30, speed: 6, attack: { do: 'damage', amount: 6, range: 1.5 },
  behaviours: [],                             // machine mods add behaviours here
  drops: { table: 'small_machine' },
  module: 'crawler_body',
  desc: 'Small, fast, comes in packs.', why: 'Shows off Conduct chains and Firestorm.' }
```
- The **walker** (an area boss) is a machine with `heavy`, a spawn behaviour (`everySeconds: spawn crawler`) and armour plates that are themselves targets.
- **Deep Signal machine mods** (shielded, swarming, overcharged) add tags or behaviours to existing enemies. No new enemy code.

---

## 10. Guardrails (keep it fun, readable, fast)
| Rule | Why |
|---|---|
| **Stacking caps** per modifier (e.g. max 5 projectiles, max +150% rate), and diminishing value after the 2nd copy | Broken combos are fun, but Deep Signal tiers must still mean something (Cheng #4, Street #3) |
| **One element per weapon** | Two weapons = up to two elements, so combos stay readable |
| **Reactions use up both statuses** | No infinite loops; each combo is a moment |
| **Reactions can't trigger reactions in the same frame** (max chain depth 1–2) | Prevents runaway chains and frame drops |
| **One look + one sound per reaction**, particle budget per frame | Readable on a phone; the web game stays fast (Sakurai #9, #10) |
| **Kai is immune to his own reactions** (unless a capstone says otherwise) | Combos feel good, not self-punishing |
| **Every entry has `desc` and `why`** | The player and the AI agents always know what a thing is for |

---

## 11. Worked examples
**A. Bazooka + double shot + fire, off-hand water gun**
1. The water gun hits a pack of crawlers → `wet`.
2. The bazooka fires 2 rockets (double shot). Each hit carries fire → **Steam** on wet crawlers → a cloud, and they lose Kai.
3. Kai drives away hidden in the steam, or keeps firing and keeps `burning` going on the dry ones.

**B. Shock + puddle (world + weapon)**
1. Crawlers chase Kai across a puddle (material, `liquid`).
2. A shock weapon hits the puddle → it becomes **electrified ground** → Conduct on everything standing in it.

**C. Rider talent + oil**
1. Nitro trails (talent) leave fire behind the bike.
2. Kai drifts through an oil puddle → burning ground → a wall of fire behind him.

**D. Rebuilding a house**
1. An area is clean; a villager asks for help.
2. Kai brings 2 `plate_riveted` modules (from salvaged frames) and a `lamp_porch`.
3. The house's `plate` and `lamp` sockets fill, its care rises, and its windows light up. Next visit, a survivor lives there.

---

## 12. How to add things (cheat sheet for vibe coding)
| To add… | Touch | Code? |
|---|---|---|
| A tag | `tags.js` | No |
| An element | `elements.js` + its intensify + its reactions in `reactions.js` (see §3 "Adding a new element") | No |
| A reaction | `reactions.js` | No |
| A material | its city atom: add `tags` | No |
| A modifier | `modifiers.js` (pick a stage) | No (just an `edit` function) |
| A weapon / off-hand | `parts/weapons.js` + a module | No |
| A talent or unique behaviour | the talent / part entry (`on`, `if`, `do`) | No |
| An enemy or machine mod | `enemies/*.js` / `mods.js` | No |
| A visual module | `atoms/modules/*.js` (house style, ≤ 10 volumes) | Mesh only |
| A new effect verb | `effects.js` + a test | **Yes (rare)** |
| A new trigger | the system that announces it | **Yes (rare)** |

### Checks (headless, no browser)
- **Schema validator:** every entry has its required fields, `desc` and `why`; ids are unique; references exist.
- **Reaction grid test:** every element has an intensify entry and every pair has a reaction (no empty cells; missing ones are listed as TODOs and use Clash meanwhile).
- **Combo sim:** the headless bot simulator fires random builds at enemy packs and logs damage, chain depth and particle counts. It flags anything over the caps.

---

## 13. Build order (chapter 1 prototype)
1. The hit pipeline + `damage`, `apply`, `push`, `cloud`, `explode` effects.
2. **2 elements: fire and water**; reaction **steam**, plus intensify for both (**Blaze**, **Soaked**) and the **Clash** fallback. Oil puddle as the first material.
3. **3 modifiers:** double shot, faster, fire.
4. 2 weapons (one main, one off-hand) and one machine (crawler).
5. Vehicle sockets for one form; plate and lamp modules shared with one house.

Shock, wind, the other reactions, more modifiers and epic slots come after the prototype is fun.

## Glossary
- **Atom:** any self-describing piece of data (city prop, module, part, enemy).
- **Tag:** a property word (`metal`).
- **Element / status / reaction:** what a hit carries / what it leaves / what two of them make.
- **Effect:** a verb that changes the game (`push`).
- **Behaviour:** trigger + condition + effects.
- **Modifier:** a trait that edits a shot at one stage.
- **Module / socket:** a visible piece / the place it attaches.
- **Care:** 0–1, how kept a place is (from the city atoms system).
