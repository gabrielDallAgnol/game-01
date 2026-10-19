# Decisions: Oct 19 morning (Gabriel's first play feedback)

| # | Gabriel said | Decision | Where |
|---|---|---|---|
| 1 | Heat is hard to understand in the first nights | Systems arrive one at a time: **power** at town hall 2, **heat** and **expeditions** after the first blood moon (night 6), each with a System window | `content/season.js` FEATURES |
| 2 | Opening districts: an option, but pace it like an anime | No routes before night 6; story calls open the first ones; routes cost supplies (far districts more) | `sim/story.js` districtEncounter |
| 2b | Bigger start area; new areas bigger and far | **Home ward** = home + the near districts with no hive, open from day 1. Far ring = 6 big districts (was 10) | `sim/mapgen.js`, `sim/game.js` |
| 3 | AI can do everything if it does it well; test it with story agents; fix the default → AI text swap | Cards **wait** for the Chronicler (max 9 s, "read the plain version" button). Claude **invents one side quest a day** from templates (+ AI-made companions), and tells **"Previously on"** on Continue. Tested with agents on run logs (`tools/ai-lab*.mjs`) | `ui/story-ai.js`, `content/story.js` QUEST_TEMPLATES |
| 4 | Companions: both | One at your side; a second from town hall 3 | `content/season.js` PARTY |
| 5 | Eras don't fit a post-apocalypse | **Seasons** (anime arcs): season 1 = 15 nights, then 10 each; each has a rule (raiders, metro, winter, fog, hunger) and a finale monster. Each day is an **episode** with a title card | `content/season.js` |
| 6 | "Bigger city" unclear | Merged into 2b | |
| 7 | One game mode besides idle; classes too instant | No start-at-class unlock. Classes come from **decisions** (the path: Heart / Brawn / Aim / Wits); the Calling at **level 5** through a **trial** in the city, the final class at **level 12** | `sim/game.js` checkEvolution, `sim/story.js` offerTrial |
| 8 | Special buildings hard to tell apart | Glowing frame + icon, coloured by what the site gives | `render/view.js` SITE_LOOK |
| 9 | City built itself | Foreman unlocks at town hall 3 as a **toggle, off** | `sim/game.js` checkForeman |
| 10 | Story text too long; bold the key parts | Pages of ≤2 sentences, tap to continue; effects in bold; AI writes 2–3 beats of ≤22 words | `ui/app.js` showEncounter |
| 11 | System pop-ups vanish too fast | Important ones are **full-screen windows** that wait; toasts last longer (by word count) and close on tap | `ui/app.js` queueWin |
| 12 | Classes from decisions | Done (7) | |
| 13 | Destructible map | Ruined blocks on your land can be knocked down: 3 scrap a bay, a pair of hands, some noise | `sim/game.js` clearRubble, `render/city.js` chunks |
| 14 | Outside should be dangerous; hero too fast | Roamers **hunt** you once they see you and follow you home; more roamers, runners from day 1; hero slower (3.8) | `sim/game.js` stepRoamer |
| 15 | Sun instead of a timer | The sun crosses the sky; light warms toward dusk and fades into night; a sun arc in the HUD | `render/look.js`, `ui/app.js` sunDial |
| 16 | Follow Apple HIG for spacing | Research → `docs/research/hig-ui.md`, fixes applied | |
# AI playtests, round 1 (Oct 19, build v44)

**How:** `tools/ai-play.mjs`. Each agent plays one Survivor run. At every decision point (a new day, a story card or a blessing) it reads a compact status and answers with JSON actions plus a note on why. The game replays deterministically and runs headless to the next decision, under half a second each. There were 6 agents: 2 each of Haiku, Sonnet and Opus, on seeds 11 and 22.

## Results
| Player | Seed | Nights survived | Class | Fell to |
|---|---|---|---|---|
| Haiku A | 11 | 6 (keep fell on night 7) | Survivor 4 | Night-7 spike: heat 1→52, 11 towers lost |
| Sonnet A | 11 | 14 | Ranger 6 | Night 15: Lantern-Eater back at ×2.2 plus bursts |
| Opus A | 11 | 14 | Ranger 6 | Night 15: Gravelord blood moon, heat stuck at 87 |
| Haiku B | 22 | 13 | Survivor 6 | Breach cascade, nights 12–14 |
| Sonnet B | 22 | 12 | Survivor 5 | Heat 76–78, day burst, keep at 8% |
| Opus B | 22 | 16+ (alive) | Ranger 6 | Lowest point: night 10 at 17% |

## What every player said
| Finding | Players | Fix (v45) |
|---|---|---|
| Days 1–9 too easy, then a cliff around nights 13–15 | 5/6 | Opening ramp restored, threat 0.88; night-15 blood moon ×1.15 (was ×1.3); a Lantern-Eater you hid from returns at ×1.6 (was ×2.2) |
| The forecast lies ("Easy" before losing 29 buildings) | 6/6 | The rating now counts the hives' night stream, a likely heat burst and the unique monster |
| Losing buildings meant nothing (free rebuild at dawn) | 3/6 | A rebuild costs a quarter of the price; without the scrap the ruin waits |
| Barricade lines never landed | 6/6 | The planner tries every route in, 6–11 cells out; the harness says why when nothing fits |
| Upgrades failed silently (level 3 needs a Workshop) | 5/6 | The harness gives the reason; the planner skips what it cannot upgrade |
| Heat unexplained, stuck above the burst line | 6/6 | Gunfire and kills can only take heat to 77; bursts come from loud choices and loud towns (noise floor up to 70) |
| Bounty blessings offered to a hero without Bounty | 4/6 | Not offered without the ability |
| The Ranger hits weaker than the Survivor | 2/2 who took it | Every Calling is now an upgrade (Ranger 4 dps, Scavver 2.5, Medic 2.75; Survivor 3.7) |
| Late game: hands and free people cap; scrap piles up | 4/6 | Hands +1 per 12 people; paid rebuilds sink scrap |
| A site card loops after "Not now" | 3/6 | It asks again tomorrow |
| Routes never taken: no visible payoff | 4/6 | The route card says what the site gives |
| "+X/dawn" wrong | 2/6 | The preview includes site income and class income |
| Pact prices and mastery texts missing | harness | The harness now shows them (the game always did) |

## Bottlenecks
| Days | Bottleneck |
|---|---|
| 1–4 | Food, then scrap |
| 5–9 | Scrap for towers |
| 10+ | Hands, free people, power; scrap and food pile up |

# Later on Oct 19 (v44–v46)
| Gabriel said | Done |
|---|---|
| Blessings only on special occasions, one kind | Hives burned, levels 5/10/15…, unique monsters, rare finds; no dawn blessings |
| Town hall: economic gate, not a day gate | Level 2: 20 scrap, 6 stored food, 8 people. Level 3: 50 scrap, 18 food, 18 people, a hive burned or a site claimed |
| Test with AI players, deterministic math tests, faster | `tools/ai-play.mjs` (AI playtests, 2 rounds, 8 runs), `tools/model.mjs` + `test/model.test.mjs`, `tools/sweep.mjs` (parallel) |
| Hero hidden behind buildings | X-ray silhouette |
| Start area too small and city-centre | Whole near ring open from day 1 + ~30 pickups (+1 scrap / +1 food) |
| My buildings don't read as mine / not rewarding | Painted homes, bunting, confetti "+1 Home"; per-level progression (survival → thriving) in progress |
| Stories too bookish | Consequence chips on choices, highlighted key words, all scripted text rewritten |
| Apple HIG | `docs/research/hig-ui.md`; 44-pt targets, type scale, bottom sheets |
