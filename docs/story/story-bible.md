# Hollowmere story bible

Chapter 1 and the world around it. Written Oct 25, night. Built on Gabriel's chapter 1 decisions.
Things marked **(proposal)** are new inventions. They are small and easy to change.

Data lives in the repo, branch `v2-story`:
`src/content/story1.js`, `src/content/notes.js`, `src/content/mechanic.js`, `src/content/rig2.js`.

---

## 1. Premise

- One evening, warm grey ash falls from a clear sky for one hour. People call it **the Ashfall**. **(proposal)**
- About four in ten people go still and grey. At dusk the cracks in their skin glow orange. These are the **Ash-Born**.
- At the same moment a thin blue line appears in front of everyone who stayed human: **the System**.
- The System turns jobs into **classes**. But almost everyone gets `[Class pending]`.
- One person in Hollowmere gets a real class: Kai Brenner, a young mechanic, who had a wrench in her hand.
  `[Class granted: Mechanic]`
- Kai's tow truck broke down in the church square the same evening. She makes it her base.
  The survivors call it **the Haven Rig**.
- Goal of chapter 1: survive, rescue a few people, find the engine part, and drive the Rig out of town.

**Tone:** light anime adventure. Warm, a bit funny, brave. Scary at night, never grim. No gore.

**How the story is told:** only in the world.

| Channel | Where | Example |
|---|---|---|
| Notes | Found when you search a house | "Form 12-B. Status: empty. RECEIVED. Do not panic." |
| Graffiti | Painted on walls | `HELP ↑ NO LADDER ↑ HAVE PIZZA` |
| Radio | Car radios while salvaging; later the Rig radio | "Mast Field to anyone with a wrench..." |
| Light cues | Things you see | A torch blinking three times on the water tower |
| System lines | Thin blue line over Kai | `[Party: 2]` |

No narrator. No popups. No cutscenes.

---

## 2. The hero: Kai Brenner (proposal)

- **Who:** 23. Runs a one-woman garage on the Ring: "Brenner's Garage".
- **Look:** caution-yellow jumpsuit, sleeves tied round her waist, a red bandana, a huge wrench.
- **Personality:**
  - Cheerful and stubborn. Talks to machines more than to people.
  - Names every engine. The truck is "Hilde".
  - Fixes things when she is nervous. Hums while she welds.
  - Brave in a slightly reckless way. "It's fine. It's mostly fine."
- **Why she got a class:** nobody knows. She was mid-repair, wrench in hand, when the ash fell. The System never says.
- **How her voice shows:** only short barks over her head (the barks system) and her own old notes ("Closed for lunch. Back by one. — Kai").

**Example barks (proposal):**
- "Okay Hilde. Okay. We've got this."
- "That's not scrap. That's a future turret."
- "Nail gun, meet face."
- "Don't look at me like that, I'm a mechanic, not a hero."

---

## 3. The Haven Rig

- **What:** Kai's caution-yellow 1990s heavy recovery truck (a tow truck with a crane boom). "Brenner Recovery" on the doors.
- **Name:** Kai calls it Hilde. Everyone else calls it the Haven Rig.
- **Why here:** On Ashfall evening Kai came to the church square to tow a broken bus. Hilde's engine knocked and died.
  Her crankshaft was already cracked. Kai had ordered a new one from the Engine Works: **order 4471**. It was never collected.
- **Why the square is good:** it is the middle of the round old town. Streets come in like spokes. Open ground to build on.
  The church is next to it (the Ash-Born never go inside).
- **How it grows:** modules bolted on (see chapter 1 design). Bunks, Roof Turret, Workshop, Floodlights, Rig Radio, Plating.
- **End of chapter:** Kai fits crankshaft 4471. Hilde starts. The Rig rolls north out of town.

---

## 4. The System

**What it is:** a cold, helpful interface. Nobody understands it. It appeared with the Ash-Born.

**What it does:** turns jobs into classes, gives skills and levels, names objectives. It hides why.

### Voice rules

1. Always in square brackets. One short line.
2. Facts only. No feelings, no jokes, no "you".
3. Helpful about **mechanics** (skills, slots, objectives). Silent about **story** (why, who, what the Ash-Born are).
4. Never explains. If asked, it refuses: `[Query not recognised]`, `[Information restricted]`.
5. Shown as a thin blue line over Kai. Never a window, never a popup.

### Examples

| Moment | Line |
|---|---|
| Game start | `[Class granted: Mechanic]` |
| New skill | `[Skill: Salvage · Lv 2]` |
| Level up | `[Mechanic · Lv 3]` |
| More turrets | `[Turret slots: 4]` |
| Survivor joins | `[Party: 2]` |
| Looking at a survivor | `[Class pending]` |
| Objective | `[Objective] Salvage 3 vehicles.` |
| A nest found | `[Infestation detected]` |
| Nest cleared | `[Infestation cleared]` |
| Dusk / dawn | `[Ash activity rising]` / `[Ash activity falling]` |
| Tap the line twice | `[Information restricted]` |
| End of chapter | `[Region complete: Hollowmere]` |

---

## 5. The Ash-Born

**As far as anyone knows:** people who went still in the Ashfall. Grey like statues by day. At night the cracks glow orange and they move.
Not a disease (a nurse's note: no fever, no pulse change). Not rotting. Never call them zombies.

Folk slang **(proposal)**: "sleepers" by day, "embers" at night.

### Behaviour rules (match the game)

| Rule | In the game |
|---|---|
| Sleep by day | Hordes sleep in groups at key places (sites, streets, nests). Grey, still. |
| Wake at night | At dusk every horde wakes and roams round its spot. |
| Now and then a horde marches | Chosen at dawn. Red route arrows show it all day. It comes for the Rig at night. |
| Drawn to light and noise | Turret fire, salvaging, floodlights, a running engine. |
| You can hit sleepers by day | They wake when hit. Breaking a horde pays scrap. |
| Cannot climb ladders | Lotte survives on the water tower. |
| Never enter the church | The church is safe ground (story only for now). |
| Regrow | A horde regains a few each dawn. |
| Infested buildings (nests) | Many sleep in one building. It grows an **Ash Heart**. Inside it is always night. Break the Heart to clear it. |
| Face the masts | At night the sleepers turn toward the radio masts. Nobody knows why. |

Mob names stay as in the game: Cinder, Flicker, Slag Brute, and the Inferno Warden (finale boss).

---

## 6. The radio masts mystery

- Tall radio masts stand in a wet field south-west of town: **the Mast Field**.
- They have had no power since the Ashfall. They broadcast anyway. Every night at 3:00.
- The voice is not human. It sounds like the System, but no one sent it. People call it **the 3:00 voice**.
- What it says, night by night, is a **registry**:
  - `[Registry check] Hollowmere. Population: pending. Classes: one.`
  - `[Registry update] Mechanic: one. Seeking: Cook. Medic. Smith. Courier: pending.`
- The sleepers turn to face the masts.
- **Not solved in chapter 1.** It is the chapter 2 hook.

---

## 7. The survivors

All three have `[Class pending]`. The System has not given them a class. Yet.

### Lotte Brix — the courier

| | |
|---|---|
| Job | Pizza delivery rider for Pizza Rapido on the Ring |
| Age / look | 19. Red delivery jacket, cycling helmet, always eating |
| Personality | Fast, loud, cheerful. Never stops talking. Knows every shortcut. |
| Where found | On top of the water tower (NW). The ladder fell. |
| When | Day 2 (after the torch blinks on night 1) |
| At the Rig | Lookout. Shouts the march route at dawn. Runs half your carried scrap home. |

- She was delivering pizza to the allotments when the ash fell. She climbed the tower.
- She blinks her torch three times every half minute of the night.
- She left notes in a shed: "I have six slices of cold margherita and a torch."
- Bark: "Shortcut! Trust me! ...Okay, don't trust me, but follow me."

### Benno Scholz — the clerk

| | |
|---|---|
| Job | Town hall clerk, desk 4 |
| Age / look | 58. Cardigan, reading glasses on a chain, a rubber stamp |
| Personality | Dry, calm, very polite. Believes forms keep the world in order. |
| Where found | Locked in the town hall on Main Street (S). A horde sleeps on its steps. |
| When | Day 3 |
| At the Rig | Stores. +1 food from every house searched (he knows who lived where). Files one spare part each dawn. |

- He kept working. He walks the street by day and fills a "Household Check" form for each house.
- His stamped notes lead you to him: "RECEIVED. Filed. Do not panic."
- He finds the paper that drives the finale: **order 4471, ready, not collected**.
- Bark: "I have a form for that." / "Please queue. Even the dead queue."

### Augusta "Gus" Lindner — the radio tech (optional)

| | |
|---|---|
| Job | Retired radio technician. Worked at the masts for 30 years. |
| Age / look | 66. Big headphones, a bad knee, a thermos |
| Personality | Grumpy-kind. Sarcastic. Makes coffee for everyone. |
| Where found | The hut at the foot of Mast Two (SW). Her generator is broken. |
| When | Day 5 (after her car-radio call on night 4). Optional. |
| At the Rig | Rig Radio: names the march at dusk; the 3:00 voice plays on the Rig. Mends the Rig at night. |

- She calls for help on car radios: "Mast Field to anyone with a wrench."
- She is the only one who knows the masts have no power. She is scared of the 3:00 voice and won't say so.
- Bark: "Coffee first. Apocalypse second."

---

## 8. The town: Hollowmere

Shaped like Nauen in Brandenburg: a round old town inside a ring street, the church in the middle, a long street south.

| District | Where | What is there | Story use |
|---|---|---|---|
| Church Square | Centre | St. Marien church, fountain, cobbles, the Rig | Base. Night 1. |
| The Ring | Round the old town | Ring street on the old wall line. Shops, flats, Brenner's Garage (E), Pizza Rapido | Garage = Workshop (day 4). Lotte's clues. |
| Main Street | South | Town hall, bakery, bank | Benno (day 3). Order 4471. |
| Water Tower Hill | North-west | Brick water tower, allotments | Lotte (day 2). |
| Station and Works | North | Station, goods shed, rails, Hollowmere Engine Works | Goods shed nest (day 6). Finale (day 7). |
| The Mast Field | South-west | Radio masts, Gus's hut | Gus (day 5). The mystery. |
| East Estates | East | Family houses, school, supermarket | Flavour notes, salvage. |
| West Gardens | West | Allotments, sheds, the Lichtspiel cinema | Cinema nest (day 4). |

---

## 9. The arc of chapter 1: "The Engine Works"

1. **Alone.** Kai wakes under Hilde. A wrench, a class, and a square full of dead cars.
2. **Not alone.** A torch on the water tower. Lotte comes home.
3. **Order.** Stamped notes. Benno comes home. The Rig gets a gun on its roof.
4. **Home turf.** Kai's own garage. The workshop comes home. The cinema nest burns out.
5. **The voice.** Gus at the masts. The 3:00 voice reads a registry. Benno finds order 4471.
6. **The long night.** Clear the goods shed. Two hordes at once.
7. **The Engine Works.** Storm it by day, break the Ash Heart, carry the crankshaft home, fit it while the last horde comes. Hilde starts. The Rig rolls north.

### Why the factory for the finale (not the radio station)

- **It fits the Mechanic.** Parts, machines, a crankshaft. The finale is a repair job.
- **It closes a loop from minute one.** Kai's tow ticket names order 4471 on night 1.
- **It is on the way out.** The north road leaves past the station and the Works.
- **It keeps the masts a mystery.** The radio station is the bigger question. Solving it now would spend the hook.

---

## 10. Hook for chapter 2

- As the Rig rolls past the station, the radio plays:
  `[Region complete: Hollowmere]` `[Registry: Mechanic, one. Seeking: Cook, Medic, Smith.]`
- Then a girl's voice, close now: "Reedwater Lock. North-east. Bring the yellow truck."
- She said on night 6: "We have a crane and no one to fix it."
- **Open threads:** Who reads the registry? Why does it seek certain jobs? Will Lotte, Benno or Gus get a class? **(proposal)**
- Chalk on the cobbles where the Rig stood: `HILDE WAS HERE. SO WERE WE.`

---

## 11. Canon conflicts to settle

The repo's `src/content/solar.js` still holds the old canon (Solar Zenith Flare, a logistics-worker hero, Dee/Juno/Gloria, "Thermal Pioneer System").
This bible replaces it for V2. Not changed yet (new files only). See open questions in the chapter 1 design.
