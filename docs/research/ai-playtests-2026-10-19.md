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
