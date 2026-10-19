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
