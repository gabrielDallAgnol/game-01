# Hollowmere: overnight report (Oct 18 → 19)

## TL;DR
- The game now has **a story that builds on itself**, **a city that opens district by district**, **a hero who evolves** (Survivor → Calling → one of 6 final classes), **levels**, and **real pressure** (heat, power, hands).
- Everything on last night's list is in, at least as a first version. Weakest parts: balance at the extremes, and the AI writing, which I could not test live (it only runs inside the Claude viewer; its safety checks are unit-tested).
- **Playable**: the usual artifact link (latest version). **Code**: `main` on GitHub. **Tests**: 41 passing.

## How a run plays now
| Moment | What happens |
|---|---|
| Start | Pick a difficulty and a city. You are a **Survivor** with a pipe and a status window. The System offers a starting gift (1 of 3). |
| Day 1 | Your survivors carry plans for a home, a farm and a tower. Every build takes a **free pair of hands**; you have 3. |
| Night 1 | One slow, tough dead walks in. The camera finds it. |
| Day 2+ | **Calls** at dawn: a voice on the radio, drawings in a school window, a dead thing that hums, a crew at the bridge. A call opens a sealed district and points you there with a **blue quest arrow**. Every other dawn your scouts offer a route out of the fences (common → legendary). |
| Out in the city | **Blue beacons** are street finds (a man on a bus roof, a pharmacy, a walkie-talkie; when those run out the city generates new ones). Each district has a **site** to claim, strip, or leave. Some have a **hive** inside a real building. |
| Growth | **Levels** from your kills, quests and districts. Two blessings of Brawn / Aim / Wits / Heart → your **Calling** (Brawler / Ranger / Scavver / Medic). Two of a second family → **Vanguard, Warlord, Deadeye, Warden, Marshal or Quartermaster**. |
| People | Companions you rescue hold a post (power, hands, towers, a slowing aura) or **travel with you** and fight. Talk to them (Claude plays them in character). |
| Pressure | **Heat** rises with your noise; at the red mark a hive swells red and **bursts** after 40 s. **Power** runs the good towers; short of it, everything powered switches off (**blackout**). Blood moons: a guardian at 5, **the Lantern-Eater** (a named unique monster) at 10, the Gravelord from 15. A **breach** warning when the dead get in. |
| Chapters | After every blood moon the System retells the last five days (Claude writes it when on). |
| Idle | With 6 buildings and a level 2 hall, the **Foreman** builds by himself. **Auto** (⋯ menu) plays the hero too; you only make the choices. |
| Saves & legacy | Every dawn, to your account (phone ↔ Mac) and the device. A finished run earns **fame** for small permanent edges (Legacy, on the start screen). |
| Status | **Tap the day counter**: level, titles, companions, chronicle. |

## What I did for each request
| You asked | Done |
|---|---|
| Visuals between Thronefall and RA2 | New **HQ** (town hall, clock tower, banners, flag; a floor per level). Buildings **unfold out of the ground** with dust. **Your buildings sit on concrete pads with amber corners**. Quarantine fences; **rarity banners** over scouted districts. Bigger, named hives that **swell red** before bursting. Blackout flicker + red POWER DOWN. Named unique monster with a glow. |
| Phone UI | Build drawer, ⋯ menu, full-width action bar, encounter cards, status window, chat. Toasts below the HUD (max 2). Chat input won't zoom on iOS. |
| Fair but challenging, levels, pacing | 4 difficulties (Story / Survivor / Veteran / Nightmare). Heat + eruptions. Tougher mobs arrive later. Night 10 softened. Dusk and breach warnings. |
| Spawns explode when the city is too loud | Heat: at 80 the nearest hive swells, a countdown shows, then it bursts. |
| Instant construction but harder to get | **Hands per day** + **rising cost per copy**. Packs removed. |
| City centre boring, buildings bigger than HQ | Rebuilt the HQ. |
| 3–4 resources | **Scrap, Food, People, Power** + the **Heat** meter (`docs/resources.md`). |
| Nests as buildings, fewer, remarkable | Half the districts, at a building's door, named (Red Line Station, St. Agnes's Hospital…), bigger. |
| Procedural city, rarity, incremental | 16 sealed districts; identity (common/rare/unique/legendary) decided when first offered, so the same map grows differently. Opened by choices and story. |
| More dead around; hero can't clear early | 4–6 roamers per open district (+1 per 6 nights), tougher further out; sealed districts can't be entered. Levels and evolution let you push later. |
| Readability of your buildings | Pads + amber corners; NO CREW / NO POWER tags. |
| Reimagine classes / evolve | 4 families, 4 Callings, 6 final classes, levels. |
| Idle mode | Foreman + Auto. Cards still pause for your choices. |
| Story, people to save, buildings with story | 5 threads, 8 hand-written + endless generated street finds, 6 one-shot moments, 10 site types, titles, chapters, a chronicle. |
| AI NPCs, personality, moral choices, built on history | **The Chronicler** rewrites each encounter from your run's chronicle; companions chat in character. Choices and effects stay engine-owned. Off/unavailable = scripted text. |
| Pearl-style upgrades | **Legacy**: fame → small permanent edges. |
| Research | `docs/research/` (base building & best sellers, progression & LLM NPCs, incremental AI story). |

## Tests and balance
- `npm test`: **41 passing** (new: districts, hands/power/heat, foreman, evolution incl. Heart, saves, and 4 Chronicler safety tests with a fake Claude).
- A separate reviewer agent hunted bugs in the new systems; it found 8 (a softlock after a failed AI rewrite, save gaps, quests sent to empty districts, evolution cards blocking the story, a "Not now" loop, double charges…). **All fixed**, its repro scripts re-run clean. I also found and fixed a softlock (blessings earned mid-day) and an unreachable Status button on phones. A second reviewer drove the built page at phone size and found 4 more (tapping a sealed district froze the view, cloud saves used an invalid path, a travelling companion vanished after Continue, a stale Place bar): all fixed and re-checked.
- Balance bot (`tools/clockbot.mjs`): a mediocre player on **Auto** from a Survivor that **answers every call and opens every district it is offered**. Nights reached:

| Difficulty | Nights reached (seeds) | Median | Notes |
|---|---|---|---|
| Story | 18, 24+, 10, 10, 15, 17 | ~16 | one still alive at the cap |
| Survivor | 14, 16, 19, 6, 14, 13, 8, 21 | 14 | the Vale map is the hardest start |
| Veteran | 18, 19, 5, 5, 8, 6 | ~7 | bimodal: strong starts snowball, weak ones fall at the first blood moons |
| Nightmare | 9, 7, 4, 4, 4, 6 | 5 | as intended: brutal |

- Reading: Story is comfortable, Survivor is a real fight that usually ends in the teens for the bot, Veteran and Nightmare end early. The bot's early deaths come from over-expanding (every open district adds roamers and a hive stream). A human who is choosy about districts, builds barricades and manages heat should go further.

## Research in one table
| Source | What we took |
|---|---|
| Red Alert 2 | Sites out in the city, quiet vs loud power, hard blackout, team colour, build zone, unfolding buildings |
| They Are Billions | Noise draws the dead (heat); homes rise as dead (cascade) |
| Against the Storm | Hostility rising with growth → heat thresholds |
| RimWorld / L4D | A director with pressure and relief; difficulty as a bundle of multipliers |
| Frostpunk | One core + hard choices without judging (Hope deferred) |
| Fallout | Starting gift, titles, **Field Manuals in sites** (each claim offers blessings of one family); next: rule-changing perks |
| Hades / PoE / Vampire Survivors | Evolution through two families |
| Humankind | Districts as outposts; next: eras and fame-based goals |
| Storylets / Wildermyth / Caves of Qud | Threads that come back, callbacks, one-shot moments, chapters |
| LLM games | The engine decides; the LLM writes and judges; validate everything; fall back to text |

## Things to decide together
| # | Question | My suggestion |
|---|---|---|
| 1 | Is heat fun or a tax for a big town? | Play one Survivor run and tell me |
| 2 | Should opening a district cost something (scrap, a risky night)? | Yes, small: heavier choice, slower over-expansion |
| 3 | How much AI: rewrite only, or let Claude invent side quests from your chronicle (picking from engine templates)? | The template version next |
| 4 | Companions: one at your side, or a small party? | One, as now; a second slot from a title |
| 5 | Eras like Humankind (Scavenge → Fortify → Reclaim) with a faction pick each? | Good for long runs, after balance |
| 6 | A bigger city for long runs (a new ring when 12 districts are open)? | Yes, but check phone performance first |
| 7 | Hope / morale as a 5th number? | No: bonds, titles and chapters carry it |
| 8 | Heroes: keep the start as Survivor for everyone, or let veterans start at their Calling (a Legacy unlock)? | Legacy unlock |

## Known issues
- The AI layer is untested live. If it misbehaves, untick "Chronicler" on the start screen or in Status.
- Long Story-mode runs grow huge towns (200+ buildings by day 24): watch phone frame rate.
- Deaths can still feel like a cliff (full hall one night, gone the next). The dusk and breach warnings help; a "your defences are failing" trend line would help more.
