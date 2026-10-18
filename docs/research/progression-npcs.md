# Research: Fallout perks, class evolution, Humankind, narrative systems, LLM NPCs (Oct 18 night)

## Fallout
| System | Take for Hollowmere |
|---|---|
| Fallout 4 SPECIAL chart: perks gated by a stat; best perks change rules (Lone Wanderer, Local Leader, Idiot Savant) | Hero families as light stats; ~30% of blessings should change rules, not add numbers |
| Bobbleheads, magazines, companion perks placed in the world | Field Manuals in sites give free family ranks: a reason to explore |
| New Vegas traits: upside + downside at start | 1-of-3 starting gift (done: Lantern, Quiet Boots, Iron Will); traits with downsides later |
| Fallout 76 cards | Builds as budget puzzles; random packs keep runs different |

## Class evolution
| Game | Pattern |
|---|---|
| Hades | fixed slots force trade-offs; duo boons need two gods |
| Vampire Survivors | evolution = max weapon + matching passive + a chest after minute 10 |
| Path of Exile | ascendancy earned through a trial |
| Thronefall | warning: unbalanced perks make levels trivial or impossible; players reuse the same 5 |
Implemented: Survivor → Calling at 2 blessings of a hero family → final class from a second family (Vanguard, Warlord, Deadeye). Next: a 4th family (Heart: Medic/Preacher) gives 6 pairs; a Trial night at a landmark before the final class; log pick rates and win rates per class.

## Humankind
Eras with a new culture each time, legacy traits that stay, Era Stars, Fame as the score, outposts that merge into cities. For us: eras (Scavenge / Fortify / Reclaim), a faction pick per era with a legacy trait, Era Stars as optional goals, Fame as the end score; landmarks as outposts.

## Narrative systems
| Game | What works |
|---|---|
| RimWorld storytellers | director weighs wealth, deaths, time since the last threat; pressure and relief |
| Frostpunk | laws the player chooses when to sign; each a little more extreme; Hope and Discontent; "don't judge the player" |
| This War of Mine | one site, one story; good deeds may be rewarded, punished or ignored |
| Darkest Dungeon | quirks drive behaviour and barks |
| Slay the Spire, FTL | act-specific pools; options gated by build ("blue options"); one-time events |
| Dwarf Fortress | legends from a simulated history log |
Keep it fresh: build-gated options, events that come back only as sequels, named NPC chains, varied locations, a director, callbacks to past choices.

## LLM NPCs
| Example | Works | Fails |
|---|---|---|
| Ubisoft NEO NPC | writer-authored bios and arcs | drift, no free will |
| Suck Up! | the LLM decides a binary outcome inside a fixed loop | latency |
| 1001 Nights | keywords → items from a fixed vocabulary | gameable |
| AI Dungeon | open play is fun | forgets, moderation trouble |
| Generative Agents | memory stream: recency 0.5, relevance 3, importance 2 | one call per observation |
| Prompt-injection study | | 10% of attacks pulled a secret; a system prompt alone does not protect |
Consensus: **the LLM writes and judges, the engine decides**. Structured output, validate, fall back to a template. `sample`: quick tier ~1–2 s; first call asks consent; never call from a loop; branch on error codes.

Sources: fallout.fandom.com (Fallout 4 perks, New Vegas traits), gamespot.com (Fallout 76 cards), hades.fandom.com, vampire-survivors.fandom.com, fingerguns.net and elliotcsmith.com (Thronefall), godisageek.com (Ravenswatch), gamesradar.com (Humankind), rimworldwiki.com, pcgamer.com (Frostpunk), pcgamesn.com (This War of Mine), dreadcentral.com (Darkest Dungeon), slay-the-spire.fandom.com, news.ubisoft.com (NEO NPC), keithschacht.com (Suck Up!), arxiv.org/abs/2308.12915v2 (1001 Nights), help.aidungeon.io, github.com/art-from-the-machine/Mantella, agentpatterns.ai (generative agents), arxiv.org/pdf/2508.19288 (prompt injection).
