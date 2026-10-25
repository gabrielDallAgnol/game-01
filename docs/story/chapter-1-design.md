# Hollowmere chapter 1 design: "The Engine Works"

The playable slice. 6 nights plus a finale day. About 75 minutes. Saved at every dawn.
Read with the story bible. Data: `src/content/story1.js` (steps), `notes.js` (words), `mechanic.js` (class and balance), `rig2.js` (modules).

---

## 1. Pacing

| Night | Day (s) | Night (s) | Cycle (min) |
|---|---|---|---|
| 1 | 300 | 150 | 7.5 |
| 2 | 420 | 200 | 10.3 |
| 3 | 420 | 210 | 10.5 |
| 4 | 420 | 220 | 10.7 |
| 5 | 420 | 230 | 10.8 |
| 6 | 420 | 260 | 11.3 |
| 7 (finale) | 600 | 180 | 13 |
| **Total** | | | **~74 min** |

- Today `TIDE.dayLen` is 170 s and `dayOne` 60 s. This plan needs a longer day: there is a lot to walk to.
- Range check: a fast player skips dusk early (~60 min). A slow one explores (~90 min).
- Save at each dawn. A session can stop after any night.

---

## 2. Night by night

### Night 1 — Wrench in hand
- **Beat:** Kai wakes under Hilde. Salvage, first turret, hold.
- **World:** Kai's tow ticket on the Rig (`n.rig.1`, names order 4471). Fountain graffiti `QUIET BY DAY. LOUD BY NIGHT. LIGHT = TROUBLE.`
- **System:** `[Class granted: Mechanic]` `[Skill: Salvage · Lv 1]` `[Skill: Scrap Turret · Lv 1]`
- **Radio:** a car radio crackles an emergency message (`r.1`).
- **Threat:** 3 hordes wake, none marches. One slow first Ash-Born walks to the Rig at dusk.
- **Light cue at night:** a torch blinks three times from the water tower. This opens night 2.

### Night 2 — The light on the tower
- **Beat:** Find Lotte. Build bunks. Fix the ladder. First march.
- **World:** graffiti on the tower base `HELP ↑ NO LADDER ↑ HAVE PIZZA`. Lotte's notes in an allotment shed. Pizza Rapido note on the Ring.
- **Radio:** the 3:00 voice, first time (`r.2`): `[Registry check] Hollowmere. Population: pending. Classes: one.`
- **Threat:** 4 hordes awake. First march: 5 Cinders.

### Night 3 — Stamped and filed
- **Beat:** Benno's stamped forms on Main Street lead to the town hall. Break the sleepers on its steps. Roof turret.
- **World:** "RECEIVED. Filed. Do not panic." notes. Wall graffiti `OFFICE OPEN. KNOCK 3 TIMES.` A blind twitches upstairs.
- **Radio:** a trucker: old engines with no chip still run (`r.3`).
- **Threat:** 5 hordes. March of 7, Flickers join. The cinema sign starts glowing orange (first nest).

### Night 4 — Back by one
- **Beat:** Kai's own garage. Strip the bench, vice and welder: Workshop. Clear the cinema nest: Floodlights (from its projector lamp).
- **World:** Kai's note `CLOSED FOR LUNCH. BACK BY ONE.` Graffiti on the shutter. Cinema notes and `THE HEART IS IN HALL 1. HIT IT HARD.`
- **Radio:** Gus on a car radio (`r.4`): "Mast Field to anyone with a wrench."
- **Threat:** all 6 hordes. March of 8.

### Night 5 — Mast Two
- **Beat:** Gus at the masts (optional). Benno finds order 4471. The goods shed is a nest.
- **World:** Gus's notes at the hut, fence graffiti `GUS IS IN THE HUT. BRING SCRAP. SHE HAS COFFEE.` Benno waves a yellow form at the Rig door: the order note.
- **Radio:** the 3:00 voice reads the registry: "Mechanic: one. Seeking: Cook. Medic. Smith." Gus: "I do not like it."
- **Threat:** 6 hordes. March of 10 with the first **Slag Brute**.

### Night 6 — The Long Night
- **Beat:** Clear the goods shed: the road to the Works opens. Workshop Lv 2 unlocks (Rivet Cannons). Two hordes march at once.
- **World:** shed graffiti `SHED FEEDS THE WORKS. KILL THE SHED.` Signal-box note: "Clear the shed, clear the way."
- **Radio:** `[Movement: north] [Movement: south] [Advisory: hold position]`. A far girl: "Reedwater Lock... we have a crane and no one to fix it."
- **Threat:** two marches of 8, from north and south. Two red routes all day.

### Day 7 — The Engine Works (finale)
- **Beat:** Storm the Works by day. Break the gate. Clear 3 halls. Kill the Inferno Warden. Break the Ash Heart. Take crankshaft 4471. Carry it home (slow). Fit it at the Rig for 20 s while the last horde comes. The Rig rolls north.
- **World:** gate graffiti `IT NEVER GETS DARK IN THERE.` Shift board, locker note, dispatch desk ("Rack 9: 4469, 4470, 4471"). Scrawl on the press: "Break it and they will feel it."
- **Radio:** `[Infestation: Engine Works] [Core: active] [Recommended: Mechanic]`, later `[Core destroyed] [Ash activity: all sectors] [Advisory: leave]`.
- **Twist:** when the Heart breaks, every sleeping horde stirs and dusk comes early.
- **End:** chalk where the Rig stood: `HILDE WAS HERE. SO WERE WE.` The last broadcast (chapter 2 hook).

---

## 3. The quest chain (data-friendly)

Each step: **trigger → what the player sees → objective → reward.** Ids match `STEPS` in `story1.js`.

| Id | Trigger | Player sees | Objective | Reward |
|---|---|---|---|---|
| q1.salvage | Start | Tow ticket, fountain graffiti, cars glint | Salvage 3 vehicles | 3 xp |
| q1.turret | q1.salvage done | Turret pads round the Rig | Build a Nail Spitter | 3 turret slots |
| q1.hold | Dusk 1 | Car radio `r.1` | Survive | 4 scrap |
| q2.light | Dusk 1 | Torch blinks on the tower | Reach the water tower | Bunks unlock |
| q2.bunks | Enter the tower | Lotte's notes, tower graffiti | Build Bunks | — |
| q2.ladder | Bunks built | Fallen ladder sparks | Repair it (5 s, 4 scrap) | **Lotte** |
| q2.hold | Dusk 2 | 3:00 voice `r.2` | Survive the first march | 5 scrap |
| q3.stamps | Search a Main Street house | Stamped forms, town hall graffiti | Reach the town hall | — |
| q3.steps | Enter the town hall | Horde asleep on the steps | Break the horde (6) | **Benno**, 6 scrap |
| q3.roof | First march survived | Kai's napkin sketch | Build the Roof Turret | — |
| q3.glow | Dusk 3 | Cinema glows, poster graffiti | Survive | 6 scrap |
| q4.garage | Dawn 4 | Garage shutter half up, Kai's note | Salvage the bench (3) | Workshop unlock, 2 parts |
| q4.cinema | Enter the cinema | Notes, side-door graffiti | Break the cinema Heart | Floodlights unlock |
| q4.voice | Car radio, night 4 | Gus's call `r.4` | Survive | 7 scrap |
| q5.gus *(optional)* | q4.voice done | Hut notes, fence graffiti | Fix the generator (6 s, 6 scrap 2 parts) | **Gus**, Rig Radio unlock |
| q5.order | Dawn 5 | Benno's yellow form | Reach the goods shed | — |
| q5.hold | Dusk 5 | Registry `r.6`, Gus `r.7` | Survive (first Brute) | 8 scrap |
| q6.shed | Enter the shed | Shed graffiti, signal-box note | Break the shed Heart | Workshop Lv 2, Works open |
| q6.hold | Dusk 6 | Two red routes, `r.8`, `r.9` | Survive two marches | 10 scrap |
| q7.gate | Dawn 7 | Gate graffiti, `r.10` | Salvage the gate | — |
| q7.halls | Gate open | Shift board, locker, dispatch | Clear 3 halls (6, 8, 10) | 4 parts |
| q7.heart | Halls clear | Press line glows | Kill the Warden, break the Heart | Crankshaft 4471 |
| q7.carry | Heart broken | All hordes stir, dusk comes early | Carry it to the Rig (70% speed) | — |
| q7.fit | At the Rig | `r.11` | Hold to fit, 20 s, defend | — |
| q7.roll | Fitted | `r.12`, chalk on the cobbles | Drive out north | **Chapter end** |

Notes: `q*.hold` steps give dawn pay on top of normal income. XP per step is in the data.

---

## 4. Rig modules

| Module | Unlocks | Cost (scrap / parts) | Effect |
|---|---|---|---|
| Bunks | Day 2 (tower) | 10 / 2; Lv 2: 8 / 2 | 2 beds, then 3. A survivor only comes home with a free bed. |
| Plating | Day 2 | 10 / 1 a level (×3) | +15% Rig health a level |
| Roof Turret | Day 3 (after the first march) | 14 / 3 | Range 9, dmg 1.6, every 0.8 s, all round. Free of turret slots. |
| Workshop | Day 4 (garage) | 18 / 4; Lv 2: 12 / 6 (day 6) | Bolt Drivers; builds 25% faster. Lv 2: Rivet Cannons. |
| Floodlights | Day 4 (cinema) | 12 / 2 | Lit cone 12 m: Ash-Born slow to 70%, turrets +20% dmg. But noise ×1.5. |
| Rig Radio | Day 5 (Gus) | 8 / 3 | Names the march at dusk. Broadcasts play on the Rig. |

The engine fix is not a module. It is the finale (crankshaft 4471).

---

## 5. Survivors

| Survivor | Day | Where | Needs | At the Rig |
|---|---|---|---|---|
| Lotte Brix, courier | 2 | Water tower (NW) | Bunks, ladder fixed | Route at dawn; runs half your carry home |
| Benno Scholz, clerk | 3 | Town hall (S) | Bunks, horde on the steps broken | +1 food a search; 1 part each dawn; finds order 4471 |
| Gus Lindner, radio tech | 5 *(optional)* | Mast Two hut (SW) | Bunks Lv 2, generator fixed | Rig Radio; mends the Rig at night |

---

## 6. The Mechanic's growth

### Wrench
- 1.2 dmg, reach 1.6, every 0.6 s, auto-hit. +0.08 dmg a level. A Cinder (hp 3) takes 3 hits. Weak on purpose.
- Dash: as `combat2.js` (3.5 m, 0.25 s i-frames, 1.2 s cooldown).

### Salvage

| Target | Time (Lv 1) | Scrap | Part chance |
|---|---|---|---|
| Car | 2.4 s | 2 | 30% |
| Van | 2.8 s | 3 | 50% |
| Bus | 4 s | 5 | 100% |
| Tractor | 3.2 s | 3 | 100% |
| Machine | 3 s | 3 | 100% |

- Each level: −0.3 s (min 1.4 s), +1 scrap, +15% part chance.
- Each car gives once per chapter. Salvage is loud (draws roamers).
- The first car each night plays a radio broadcast.

### Turrets

| Tier | Name | Cost (scrap / parts) | HP | Range | Dmg | Every | Needs |
|---|---|---|---|---|---|---|---|
| 1 | Nail Spitter | 6 / 0 | 20 | 6.5 | 1.0 | 0.8 s | — |
| 2 | Bolt Driver | +8 / 2 | 32 | 8 | 1.8 | 0.7 s | Workshop |
| 3 | Rivet Cannon | +12 / 4 | 45 | 9.5 | 2.8 (pierce 2) | 0.65 s | Workshop Lv 2 |

### Levels (about one a night)

| Lv | Gets |
|---|---|
| 1 | Salvage 1, Nail Spitter, 3 turret slots |
| 2 | Salvage 2 |
| 3 | Field Repair (hold at a turret: +4 hp/s) |
| 4 | 4 turret slots |
| 5 | Salvage 3, Scrap Sense (cars with parts glint) |
| 6 | Overclock (turrets within 4 m of Kai fire 25% faster) |
| 7 | 7 turret slots |

---

## 7. Horde escalation and first balance table

| Night | Hordes awake (of 6) | March | Mix | Scrap by dusk | Parts | Turrets | Kai Lv |
|---|---|---|---|---|---|---|---|
| 1 | 3 | — (one first Ash-Born) | Cinder | 14 | 1 | 2 | 1 |
| 2 | 4 | 5 | Cinder | 30 | 3 | 3 | 2 |
| 3 | 5 | 7 | Cinder 7 : Flicker 3 | 48 | 6 | 3 + roof | 3 |
| 4 | 6 | 8 | Cinder 7 : Flicker 3 | 66 | 10 | 4 + roof | 4 |
| 5 | 6 | 10 (+1 Brute) | + Slag Brute | 86 | 15 | 5 + roof | 5 |
| 6 | 6 | 8 + 8 | + Slag Brute | 108 | 20 | 6 + roof | 6 |
| 7 | Works: 6, 8, 10 + Warden | 12 (the chase) | Cinder 5 : Flicker 4 : Brute 1 | — | — | 7 + roof | 7 |

Changes this needs in `src/content/hordes.js` (proposal, not done):
- `march(n)`: fixed by the table (night 1 none, night 6 two).
- `kinds(n)`: Brutes from night 5 (today from night 7).
- Nests (cinema, shed, Works) are new: their dead stay awake inside by day.

---

## 8. The finale in detail

1. **Dawn 7.** The road north is open (the shed is cleared). The Works gate waits. 10 minutes of day.
2. **Gate.** Salvage it (5 s, loud).
3. **Halls A, B, C.** Each is a dark room with an awake horde (6, 8, 10). Build turrets at the hall doors; they carry over.
4. **The press line.** The Inferno Warden guards the Ash Heart (hp 80). The wrench is weak: turrets do the killing.
5. **The Heart breaks.** `[Item: Crankshaft, order 4471]`. Every horde in town stirs. Dusk comes early.
6. **Carry home.** Kai is slow (70%). Lotte calls the route. The roof turret covers the last stretch.
7. **Fit it.** Hold at the Rig for 20 s. The last march (12) hits the turrets.
8. **Hilde starts.** The Rig rolls north past the station. Final broadcast. Chalk on the cobbles.

---

## 9. Open questions for Gabriel

1. **Replace the old canon?** `solar.js` still says Solar Flare, a logistics-worker hero, Dee/Juno/Gloria. OK to retire it for V2?
2. **Hero:** Kai Brenner, a young woman mechanic. OK? Or a male / player-chosen hero?
3. **Parts:** a second resource beside scrap. OK, or keep scrap only?
4. **Gus optional?** The chain does not wait for her. Or make all three required?
5. **Day length:** 420 s days (today 170 s). Too long?
6. **The church is safe ground:** story only, or a real rule (the Ash-Born never enter)?
7. **System on screen:** a thin blue line over Kai. Is that "in the world" enough, or no System text at all?
8. **Ashfall:** the cause stays a mystery. OK to name the event "the Ashfall"?
9. **Map:** the town needs a new Nauen-shaped recipe (ring, square, main street, tower, works, masts). Who builds it?
