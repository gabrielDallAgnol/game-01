# Hold Hollowmere — overnight decisions (Gabriel, Oct 20, 03:50)

Read this before you write any code. These are product decisions, not suggestions.

## Pitch
"You are the only one who can see the System. Hold the camp, walk the road, and let the Chronicler write your legend."
Quality bar: it should feel like a premium (AAA-polished) game, from design to gameplay. Prefer fewer things done beautifully over many things done roughly.

## The five pillars (from the vision doc)
1. **The Window is a character** — a persistent System strip (HP · Lv · today's quest), daily quests, skills/titles announced on screen; no toast spam, no popup flood.
2. **The Road is the stage** — stations along the old road (bus, ranger tower, bridge toll, substation), each with a fire you can hold for a night; convoys (rescued people/carts follow you home at walking pace and the dead hunt them); "round trip 2:10 · dusk in 1:40".
3. **Light is safety (visual)** — lantern-lit diorama: bright miniature days, cold navy nights, warm pools of fire. NOTE: the "towers only shoot in light" mechanic is REJECTED (it pins the player to the base). Light is a look and a readability tool, not a rule that binds the hero to the camp.
4. **Loss has weight, arcs have endings** — ruins persist until rebuilt by hand, fallen homes lose people, the hall falls over ~30 s not 5, honest forecast, a dawn line that says what fell.
5. **Few nouns, real levers** — Scrap, Food, People, Noise.

## Cuts and merges (decided — systems review list)
- **Power**: removed as a resource. Becomes a possible contract/season rule ("Lights Out") later; generators go away or become a contract building.
- **Hands**: cut (scrap already limits building).
- **Heat + town noise/draw**: merged into ONE visible **Noise** meter. It is both what draws the far hives (hearing radius) and the wave multiplier (capped), and the burst trigger. Shown on the HUD and as a hearing ring on the map.
- **Barricades**: rework into real walls the dead must chew through (no cheap-post salvage loop, no free rebuild money printer) — or cut if they can't be made good tonight.
- **Weather**: folded into contract/season rules.
- **Titles**: story flavour only, no stat bonuses.
- **Final classes and the second companion slot**: parked (hidden behind flags).
- Also cut/hidden: the 60-perk shop look (families, pips, rerolls, pacts) → blessings become filtered [Skill acquired] windows; the trader; the scavenge-crew screen; Legacy shop except 3 upgrades; changelog start screen; Easy/Medium/Hard badge → forecast strip; seven names for the hall → "the Camp".
Everything cut goes behind a flag so it can return.

## Nights: three missions, one choice at dusk (decided — Gabriel liked all three as play styles)
At dusk the System offers the night's mission. The player picks one (default: Hold). Each is a different play style to accomplish the night:
- **Hold the Camp** — the classic: stand with your towers.
- **The Hunt** — at night the hives empty as their dead march on the camp, so hives are weakest; the towers (and a companion captain if you have one) hold the camp while you sneak to a hive and burn it. Lantern off = unseen but slow; lantern on = fast but noticed. Rewards: a hive burned at night pays more.
- **The Pied Piper** — the dead hunt the loudest thing; you can make yourself the loudest (a flare / horn) and pull part of the wave off the camp, leading it into a trap (a ford, a station's kill zone, a bloater chain). Flare and smoke are your tools.
- Frame (**Two fronts**): before dusk the forecast says "Camp holds without you: likely / risky / no". Wherever the hero is — camp, a station, the road with a convoy — is where the hero's night happens. Companions can captain the camp.

## Seasons as contracts you can win (decided — AI-driven)
- At the start of each season the System offers a **contract**: 2–3 rule options (raiders, metro, winter, fog, hunger, lights-out, …) plus a finale (unique monster or a hive) — the player picks one.
- Win the finale before the season ends → victory card, fame, the Chronicler writes the recap and "next time on", and the difficulty exponent partly resets (~40%) while the chosen rules stack. Lose → the run ends with a name.
- **AI-driven**: the Chronicler (Claude via the artifact `sample` capability, src/ui/story-ai.js pattern) writes each contract from EVERYTHING that happened so far (the chronicle, companions, threads, losses, choices), as an anime-style plot twist ("the teacher you saved was the one who opened the gates", "the Lantern-Eater remembers your face"). Rule: the ENGINE owns effects (it builds the offer from a pool of rules/finales with exact numbers); Claude only names, frames and twists them, and can pick which known NPC/place/thread the twist hangs on. Scripted fallback text when AI is off or slow (2.5 s).

## Road (decided — recommended option)
Stations every ~35 cells on the road with fires (light it → outpost: rest, lit ring for the night, a story site; each station hosts a thread), convoys (rescued people/carts follow at walking pace, hunted), city reached station by station; city trip = two days with a station night. Hive burn has no pause: horde first, Flare/Smoke become HUD buttons.

## Art (decided)
Frontier kit as much as quality allows (bus hall → longhouse → palisaded lodge; tents → cabins; survivors at the fire). Lantern-lit diorama look per the research (LUTs, grounding, gridless ground, faction palette + rim, night light pools, combat feedback, System fog-of-war, combined post, build pop, wind). Phone performance budget: ≤0.85 M tris, ~250 draw calls, 60 fps at medium.

## Review findings every agent must respect (from the three Fable reviews)
- Card flood → at most 1 story card + 1 System window per dawn; nothing non-night pauses at night.
- Hero matters at night; death costs the night (back at dawn or after 30 s; camp weaker meanwhile).
- Forecast tells the truth ("Hall: safe · ~N buildings at risk · 2 brutes"); dawn closes the loop.
- Growth must help: cap the noise/draw multiplier (×1.5), slow hpScale (≈1.035ⁿ), hall gate on food income.
- Bugs: Channel 9 / districtFor silent fail and duplicate School/Substation sites; Guild blessing bypasses hall level/power; salvage + wall rebuild money printer; 'aggro' event spam (thousands per trip).
- First 10 minutes: hand-authored night 1 with the System's arrival; one-screen start; no tips on day 1.
