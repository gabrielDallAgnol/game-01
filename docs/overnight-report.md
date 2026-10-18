# Hollowmere: overnight report (Oct 18 → 19)

## TL;DR
- **The game now has a story layer, a city that opens district by district, a hero who evolves, and real pacing pressure** (heat, power, hands).
- Everything from last night's list is in, at least as a first version. The weakest parts are balance at the extremes and the AI writing, which I could not test live (it only runs inside the Claude viewer).
- Playable: the usual artifact link (latest version). Code: `main` on GitHub. Tests: 36 passing.

## How a run plays now
| Moment | What happens |
|---|---|
| Start | Pick a difficulty and a city. You are a **Survivor** with a pipe and a status window. The System offers a starting gift (1 of 3). |
| Day 1 | Your survivors carry plans for a home, a farm and a tower. Every build takes a **free pair of hands**; you have 3. |
| Night 1 | One slow, tough dead walks in. The camera finds it. |
| Day 2+ | **Calls** at dawn: a voice on the radio, kids' drawings in a school window, a dead thing that hums. Each one opens a sealed district and points you there with a **blue quest arrow**. Every other dawn your scouts offer a route out of the fences (common → legendary). |
| Out in the city | Blue beacons are **street encounters** (a man on a bus roof, a pharmacy, a walkie-talkie). Each district has a **site** to claim, strip for scrap, or leave. Some districts have a **hive** in a real building. |
| Growth | Two blessings of Brawn / Aim / Wits → your **Calling** (Brawler / Ranger / Scavver). Two of a second family → **Vanguard / Warlord / Deadeye**. |
| Pressure | **Heat** rises with your noise; at the red mark a hive swells and **bursts** after 40 s. **Power** runs the good towers; short of it, everything powered switches off (**blackout**). Blood moons bring guardians, then **the Lantern-Eater**, a named unique monster. |
| Idle | Once the town has 6 buildings and a level 2 keep, the **Foreman** builds by himself. **Auto** (⋯ menu) plays the hero too; you only make the choices. |
| Saves | Every dawn, to your account (continue on phone or Mac) and on the device. |

## What I did for each request
| You asked | Done |
|---|---|
| Visuals between Thronefall and RA2 | New **HQ** (town hall, clock tower, banners, flag; a floor per level). **Your buildings sit on concrete pads with amber corners**. Quarantine fences. Bigger, named hives that **swell red** before bursting. Blackout flicker and red POWER DOWN. Named unique monster with a glow. |
| Phone UI | Build drawer, ⋯ menu, full-width action bar, encounter cards, status window, chat. Toasts sit below the HUD (max 2). iOS: chat input won't zoom. |
| Fair but challenging; levels; pacing | 4 difficulties (Story / Survivor / Veteran / Nightmare). Heat + eruptions. Blood moon at night 10 softened (two guardians; the Gravelord from 15). Tougher mobs arrive later (brutes 7, bloaters 9, screamers 11). |
| Spawns explode when the city is too loud | **Heat**: at 80 the nearest hive swells, a countdown shows, then it bursts. |
| Instant construction but harder to get | **Hands per day** + **rising cost per copy**. Packs removed. |
| City centre too boring, buildings bigger than HQ | Rebuilt the HQ (see above). |
| 3–4 resources with a good catch | **Scrap, Food, People, Power** + the **Heat** meter (`docs/resources.md`). |
| Nests as real buildings, fewer and remarkable | About half the districts have one, at a building's door, named (Red Line Station, St. Agnes's Hospital…), bigger. |
| Procedural city with rarity, incremental | 16 sealed districts; each gets its identity (common/rare/unique/legendary) when first offered, so the same map grows differently. You open them through choices and story. |
| More dead around; hero can't clear early | Every open district has 4–6 roamers (+1 per 6 nights), tougher further out; sealed districts can't be entered at all. |
| Readability of player buildings | Pads with amber corner marks; NO CREW / NO POWER tags. |
| Reimagine classes / evolve the hero | Survivor → Calling → final class (above). |
| Idle mode | Foreman + Auto. Cards still pause for your choices. |
| Story, people to save, important buildings | 5 threads, 8 street encounters, 6 one-shot moments, 10 site types, titles, a chronicle. |
| AI NPCs with personality and moral choices | **The Chronicler**: Claude rewrites each encounter's words from your run's chronicle; companions can be chatted with in character. Effects stay engine-owned (fair, can't be talked out of the rules). Off or unavailable = scripted text. |
| Research (RA2, best sellers, Fallout, Humankind, procedural design, LLM NPCs) | `docs/research/` (3 reports). Short version below. |

## Tests and balance
- `npm test`: **36 passing** (new: districts, hands/power/heat, foreman, evolution, saves).
- Balance bot (`tools/clockbot.mjs`): a mediocre player on **Auto** from a Survivor, opening every district it is offered. Nights reached:

BALANCE_TABLE

- Reading: Story is comfortable, Survivor ends around night 10 for the bot, Veteran and Nightmare end early. A human who builds walls, manages heat and is choosy about districts should go further. The bot's deaths are cliffs: full keep one night, gone the next, when the outer ring breaks and homes rise as dead inside the town.

## Research in one table
| Source | What we took |
|---|---|
| Red Alert 2 | Tech buildings out in the city (sites), quiet vs loud power, hard blackout, team colour, build zone |
| They Are Billions | Noise draws the dead (heat); infection cascades (homes rise) |
| Against the Storm | Hostility rising with growth → heat thresholds |
| RimWorld / L4D | A director: pressure and relief; difficulty as a bundle of multipliers |
| Frostpunk | One core + a social meter (deferred: Hope); hard choices without judging |
| Fallout | Starting gift; titles; rule-changing perks (next) |
| Hades / PoE / Vampire Survivors | Evolution through two families |
| Humankind | Districts as outposts; eras and fame (next) |
| Storylets / Wildermyth / Qud | Threads that come back, callbacks, one-shot moments |
| LLM games (AI Dungeon, NEO NPC, Suck Up!) | The engine decides; the LLM writes and judges. Validate everything; fall back to text |

## Things to decide together
| # | Question | My suggestion |
|---|---|---|
| 1 | Is heat too punishing for a big town? | Play one run on Survivor and tell me if eruptions feel like a choice or a tax |
| 2 | Should opening a district cost something (scrap, a night of risk)? | Yes, small: makes the choice heavier |
| 3 | A 4th hero family (Heart: Medic) for 6 final classes? | Yes, next |
| 4 | Hope / morale as a 5th number? | No: bonds and titles carry it |
| 5 | Companions at your side (fighting) or only at posts? | One slot at your side, from bond 3 |
| 6 | How much AI: rewrite only, or let Claude invent new side quests from your chronicle? | Next step: Claude picks from engine-made quest templates (safe) |
| 7 | Eras like Humankind (Scavenge → Fortify → Reclaim) with a faction pick each? | Good for long runs; after the above |
| 8 | Map size: grow beyond 16 districts in long runs? | Later: generate a new ring when 12 are open |

## Known issues
- The AI layer is untested live (the cloud container can't call Claude as a viewer). If it misbehaves, untick "Chronicler" on the start screen or in Status.
- Desktop headless screenshots occasionally time out (slow software GPU); phone-size checks pass.
- Bot deaths are cliffs (see above); the threat rating warns, but a clearer "your defences are failing" signal would help.
