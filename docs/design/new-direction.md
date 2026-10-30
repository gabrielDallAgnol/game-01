# Hollowmere: the new direction (draft, Oct 29–30)

Status: **design discovery, not decided.** Gabriel wants the design settled before building core gameplay. Decided items are marked **[decided]**. Everything else is a proposal waiting for his call. The Oct 30 afternoon decisions came from a Design Council review (see "Design Council - six lenses"). **Combat, loot and rebuilding building blocks: see "Hollowmere play atoms Oct 30".**

## What changes from the chapter 1 design
- **[decided]** Free travel is the heart of the game. There is no truck or Rig to escort and no base to defend.
- **[decided]** Machines and robots replace the dead. They drop parts and scrap.
- **[decided]** One transforming vehicle. Every part and upgrade goes onto the same machine.
- **[decided]** Cleaning an area makes it light up again, and it stays clean (an odd enemy may wander back).
- **[decided]** A home town to come back to, Diablo 2 style: store, sell, repair, upgrade. The tutorial is reclaiming the first town so its shops open.
- **[decided]** Kai on foot comes later, after the core game works. Even then, only for narrow places (special parts) and for walking into the town's shops.
- **[decided]** The economy stays simple, a middle ground between depth and a small game.
- **[decided]** Levels and talent trees, like WoW's (Gabriel, Oct 29 23:19).
- **[decided, Oct 29 23:26]** The three trees sit on a spectrum from Kai's own power to the vehicle's:
  - a light **roller** form (Kai fights);
  - the **bike** (both fight);
  - the **car/truck** (the vehicle fights).
- **[decided, Oct 29 23:32]** **Bosses give equipment and story, not class abilities** (as in WoW and D2). Talents and bosses never clash. Bosses do tie into going on to the next chapter.
- **[decided, Oct 29 23:32]** **Story premise A: the chip.**
- **Done:** deep research on WoW class talents and D2 skill trees (report "WoW and D2 talent trees"). Gabriel: "a good document explaining everything".
- **[decided, Oct 30]** **Talents open at level 10**, as in WoW Classic. Levels 1–9 are breathing room to take in everything else before one more system arrives.
- **[decided, Oct 30]** **Built to scale: a mix of WoW and D2.** WoW's closed, defined trees made the game hard to expand. ~~D2 stays open: after the story you replay on a higher difficulty and keep everything.~~ **Updated Oct 30 15:17:** no replay cycles; the endgame is a special zone (see below).

### Oct 30 afternoon (after the council review)
- **[decided]** **No respawning in cleared areas.** Gabriel hated D2's respawns: the effort of clearing felt wasted. Once an area is clean it stays clean.
- **[decided]** **Each area has a walking boss machine.** It roams the map and keeps putting out more machines as it goes. While it lives, the area keeps refilling (that is the farming window). Killing it, which is hard, stops the spawning for good and the area lights up.
- **[decided]** **After an area is clean, small missions help villagers rebuild their homes, in several ways.**
- **[decided]** **Levelling is an accomplishment, not cheap.** XP comes mainly from side quests and helping people. Farming machines alone works too, but it is slow.
- **[decided]** **The whole game can be played in one form.** The forms are not the core combat mechanic. (Gabriel: druid-style switching loses most players, who prefer straightforward combat decisions.)
- **[decided]** **Each slot changes how the vehicle looks.**
- **[decided]** **A tyre slot.** Tyres work well on some terrains and badly on others.
- **[decided]** Agreed from the council review:
  - dying drops unbanked scrap as a recoverable cache;
  - four loop layers (moment, area, chapter, endgame);
  - **one scaling setting: the area level**;
  - build chapter 1 fully first;
  - **two currencies: scrap and chips**;
  - rarity follows the number of stats;
  - the trader never sells rares or uniques, and selling pays less than salvaging;
  - every boss has a signature unique plus guaranteed chips;
  - auto-salvage junk, and the lamp radius pulls in scrap;
  - rare parts drop "unscanned" (one tap to reveal);
  - a favourite part can be upgraded to a higher level (scrap + chips).
- **[decided, Oct 30 15:08]** **Starter form is the player's choice**, as in NFS or Pokémon. Pick one of the three at the start. (Proposal: the other two unlock through the story, then any can be the main at the garage.)
- **[decided, Oct 30 15:17]** **Buttons:** main weapon attack; an **off-hand weapon** that combos with the main weapon and the vehicle; **two talent abilities**; switch form. That makes 5 buttons.
- **[decided, Oct 30 15:17]** **No difficulty cycles (option C).** After the story, the endgame is a special zone where everything is stronger and special. The world you cleared stays clean.
- **[decided, Oct 30 15:34]** **Archero-style weapons and element reactions** (Gabriel, 15:28):
  - the main and off-hand weapons each have a theme and one signature trait;
  - modifiers stack (double shot, faster, ricochet, an element…), and higher rarity means more modifier slots;
  - elements combine into reactions (fire + water = steam, fire + wind = a bigger explosion);
  - world materials react too (oil + fire).
- **[decided, Oct 30 15:34]** **The harpoon (and similar utility moves) belong to talent abilities**, not the off-hand.
- **[decided, Oct 30 15:34]** **Everything is atomic and modular**, so things interact without new code, and modules connect anywhere (e.g. one armour plate fits the vehicle and a house wall). Every entry explains itself (`desc` + `why`) for vibe coding. Full guide: **"Hollowmere play atoms Oct 30"**.

## Story: premise A, the chip
Every machine with a chip turned in one night. Only old engines with no chip still run (this is already a line in the story bible's radio). Kai's vehicle has no chip, so it is free, and the garage scrubs salvaged parts.

Each region is run by a control node, which is the chapter boss. Breaking the node frees the region, and the power comes back. The main quest is to follow the 3:00 radio voice to whatever reads the registry.

Side quests fit the main one, D2 style:
- a survivor's missing person;
- a rare part in a narrow place;
- a machine that is a friend;
- a town's own mystery.

Chips tie the story to the economy: the enemy's chip is also the rare material. The garage scrubs chips, and they power rerolls and crafting.

Endgame hook (proposal): the end of the story reveals where the signal comes from. That place, the **Deep Signal**, is the endgame zone.

Next: a story discovery session covering the main quest across chapters, chapter 1's side quests and the characters.

## Proposal: structure (Diablo 2 acts)
| Piece | Proposal |
|---|---|
| A chapter | One region: its town (the hub, once reclaimed), 3–5 surrounding areas with their own challenges, and a chapter boss (its control node). |
| Opening a chapter | Reclaim the town first. In chapter 1 this is the tutorial. The power comes back on and the shops open. |
| An area | **[decided]** A walking boss machine refills the area while it lives; killing it clears the area for good. See "The area loop" below. |
| Reasons to come back | The hub's trader, stash and garage; quest givers; survivors who move in as you clear areas; **rebuild missions**. |
| Old chapters | Stay reachable by fast travel, like D2's waypoints (the radio masts, say). Rare parts or side quests can send you back. |
| Glow-up | Clearing an area brings the power back: street lamps, windows and signs come on, and people return. The lighting system already supports this. |
| Bosses | Drop equipment (rare parts) and move the story on. The chapter boss opens the road to the next chapter. |
| **Endgame [decided: option C]** | No replay cycles. After the story, the **Deep Signal** zone opens. Everything there is stronger and special. See "Endgame" below. |

## Proposal: the area loop (Oct 30)
### Four layers
| Layer | What happens | Target length |
|---|---|---|
| Moment | One fight; a drop with a light beam and a sound | 10–30 s |
| Area | Farm while the walker lives → kill the walker → glow-up → rebuild missions | 15–30 min plus missions |
| Chapter | Town → 3–5 areas → control-node boss | 1–2 h |
| Endgame | Deep Signal runs, unique and chip chase, rebuilding | Open-ended |

### The walker (each area's boss machine)
| Item | Proposal |
|---|---|
| Visible | A huge machine on a route through the area, seen from far away (searchlights, smoke). It is the area's landmark and its pull. |
| Spawning | It drops machines and builds small nests as it walks. Destroying a nest stops that trickle and gives XP and loot. |
| Pressure | The longer it lives, the more nests it plants. Farming has a natural cost, so it can't go on forever in safety. |
| Fight | Several phases: break armour plates, then its weak point. Any form can win; each form has an easier way in (no form required). |
| Reward | Its signature part (low chance), guaranteed chips, big XP, then the glow-up. |
| Choice | Kill it early and move on, or farm its spawns first. Both are fine. |

### Rebuild missions (after an area is clean)
The main XP source, alongside quests. Each one visibly changes the town or the area. Houses have **sockets** that rebuild missions fill with modules (plates, lamps, chimneys), which raises the house's **care** (see "Hollowmere play atoms Oct 30", §8).

| Type | Example | Form that shines (never required) |
|---|---|---|
| Haul | Bring beams and glass from the next dark area | Truck |
| Courier | Medicine or messages against a timer | Bike |
| Repair | Reach a broken pump through pipes or vents | Roller |
| Power line | Drive a cable from mast to mast to light a street | Any |
| Guard | Protect a building site from a stray machine | Any |
| Salvage | Find a named part for someone's workshop | Any |

Rewards: XP, scrap, sometimes chips, and town upgrades (new shop stock, a stash tab, a survivor moving in).

### Levelling pace
| Rule | Proposal |
|---|---|
| Share of XP | Quests and rebuilds about 60%, kills about 30%, discovery about 10%. |
| Farming | Possible but slow. Kill XP drops sharply when an enemy is more than 5 levels below Kai. |
| Curve | Quadratic, graphed before tuning. The story ends around level 30. |
| Feel | Every level-up is a moment: a freeze, a light pulse, the talent card. |

## Proposal: endgame, the Deep Signal (option C)
| Item | Proposal |
|---|---|
| What | A separate zone at the source of the signal, opened by the end of the story. The cleared world stays clean. |
| Runs | Short runs (about 10–15 min) through generated sections built from handmade pieces, ending in a signal core boss. |
| Tiers | Each run is played at a tier. Clearing it unlocks the next tier: tougher machines, more **machine mods** (shielded, swarming, overcharged), better drops. Same formula as the area level, so it scales without new content. Machine mods are just tags and behaviours on existing enemies (play atoms §9). |
| Special | Endgame-only uniques and mods, extra chips, and cosmetic looks for the vehicle. |
| Wager (Sakurai) | Optional: stake chips to push a tier for better rewards; the tier drops quietly after failures. |
| Levels | The cap can rise past 30 here (e.g. to 45), with talent tiers 5–6 opening in the endgame or in later expansions. |
| Build order | **Later list.** Chapter 1 first. |

## Proposal: forms (Oct 30, after "the whole game in one form")
| Item | Proposal |
|---|---|
| Model | **The main form works like a spec.** It has a full kit and its own talent tree, and it can finish the whole game alone. |
| Starter | **[decided]** The player picks the starter form (NFS/Pokémon style). Proposal: the other two unlock through the story; switch main at the garage. |
| Switching in the field | **[decided]** A button switches form. Optional: for routes (roller through vents, bike over gaps, truck through barricades) and situations. Never needed in combat. |
| Duo nodes | **Dropped.** Nothing rewards switch rotations. |
| Content | Content never requires a form ("bring the player, not the class"). Detours and rebuild missions can favour one. |
| Build order | A starter choice means all three forms exist at release. Proposal: prototype and polish **one form first**, then build the other two before release. The choice screen comes last. |

## Proposal: levels and talents (after the research and Gabriel's Oct 30 notes)
**What the research says:** every WoW overhaul, and the move from D2 to D4, fixed the same problem. A tree full of small +% nodes collapses into one copied build. Dragonflight and D4 both converge on the same answers:
- frequent points;
- few ranks;
- choice nodes;
- talents that change behaviour;
- raw power on gear;
- cheap respecs.

**Council notes:**
- 21 points means about 21 behaviours to design for each tree.
- Real choices arrive late (tier 4 around level 25).
- Option: themed rows, one pick per tier, with one meaningful pick at level 10–12.

Talents use the same **behaviour** format as uniques and machine mods: trigger + condition + effects (play atoms §6).

### Three layers, each scaling a different way
| Layer | Pattern | Opens | How it grows with the game |
|---|---|---|---|
| **Base kit** | WoW Classic before level 10: new abilities simply arrive as you level | Level 1 | Each form's two abilities arrive by about level 6. A small, fixed set |
| **Talent trees** | Dragonflight trees, opening at level 10 like Classic | Level 10 | New tiers come with the endgame or later expansions (new chapters). Council: later tiers should be sidegrades, not raw power |
| **Parts** | D2 items: rarities, uniques, sets, combos like runewords ("schematics") | Always | **Most new content goes here.** New chapters and Deep Signal tiers add parts, so the trees don't have to change |

Build now: the base kit, tiers 1–4 of one form's tree, and parts. The later tiers, the other forms, the endgame and the schematics are space kept free for later, not work for now.

### Levels and points
| Item | Proposal |
|---|---|
| XP | From quests and rebuild missions (mostly), machines destroyed, and **places discovered**. See "Levelling pace". |
| Points | **1 per level from level 10.** None from bosses. Perhaps 1–2 from side quests. |
| Story | Ends around **level 30, with 21 points**: one capstone plus a small splash, or two trees halfway. |
| After the story | The cap can rise in the Deep Signal or with expansions (e.g. to 45), opening tiers 5–6. |

### Each tree (tiers 1–4 now)
| Tier | Opens at (points in this tree) | Content |
|---|---|---|
| 1 | 0 | A modifier of the form's starting ability; 2 behaviour passives |
| 2 | 4 | **The tree's new active**; 1 choice node (pick 1 of 2); 2 passives |
| 3 | 9 | 1 choice node that reshapes the new active; 3 passives (at least one defensive or utility) |
| 4 | 15 | **Capstone:** pick 1 of 2 keystones, each with an upside and a drawback |
| 5, 6 | Endgame or expansions | Kept free: a deeper version of the form, never a flat power bump |

### Rules that keep it expandable (what WoW got wrong)
1. **Talents are behaviours, not numbers** (trigger plus effect, such as "after a drift, the next strike staggers"). A behaviour does not go stale when power rises, so old nodes never need retuning. WoW's % talents had to be reworked every expansion.
2. **The numbers live only on parts**, with a part level that follows the area level. That is the one dial that scales, so there is no talent squish.
3. **Trees have more nodes than points.** A new node can be added without rebalancing the budget.
4. ~~Duo nodes are the seam for new forms.~~ **Superseded Oct 30:** forms work like specs, so a new form simply adds its own tree.
5. **Respec is cheap** (at the garage: free up to level 10, then a flat small scrap fee). New content can then change old nodes without stranding builds.

### The three trees (examples, to refine)
Utility moves such as a harpoon/grapple live here as talent abilities **[decided]**.

| | Hunter (roller, Kai fights) | Rider (bike, both) | Driver (car/truck, the vehicle fights) |
|---|---|---|---|
| Base kit | Aimed shot, dodge roll | Drift strike, nitro | Ram, mounted gun |
| The tree's new active | Grapple/harpoon or a dropped turret | Jousting lance charge | Shockwave |
| Sample passives | Weak-point hits mark targets; a dodge reloads | Nitro trails burn; a ramp jump slows time | Spikes knock boarders off; rams repair armour |
| Capstone A | Glass Edge: huge weak-point crits, but you take more damage | Joust: a lance kill refills nitro, but you can't brake mid-charge | Juggernaut: unstoppable at full speed, but it turns poorly |
| Capstone B | Ghost: a dodge leaves a decoy, but the dodge cooldown is longer | Ramp King: airtime powers the next strike | Gun Deck: the guns auto-fire, but rams do less damage |

### Controls and UI
| Item | Proposal |
|---|---|
| Buttons **[decided, Oct 30 15:17]** | Left thumb steers. Right thumb has **5 buttons**: **main weapon** (auto-target), **off-hand weapon**, **ability 1** and **ability 2** (talent abilities), **switch form**. Four are used often, which matches the council's "about 4" (Street #8); switching is occasional. Cooldowns about 6–12 s; hold to aim. |
| Layout (proposal) | Main weapon big; off-hand and the two abilities in an arc around it; switch form small and out of the way (like Diablo Immortal's layout). |
| Level-up | A "pick 1 of 2–3" card, so a point can be spent without opening the tree. The tree screen is short columns. |
| Code | Talents are behaviour data (play atoms §6). Tiers are data, so adding one needs no code. |

## Weapons: main + off-hand (decided Oct 30 15:34)
Full design and data shapes: **"Hollowmere play atoms Oct 30"** (§3 chemistry, §7 weapons and modifiers).

| Piece | Summary |
|---|---|
| Two weapons | Main and off-hand are both parts. Each has a **theme** (rocket, flame, rail, scatter…) and **one signature trait**. |
| Modifiers | Archero-style, stacking: double shot, faster, ricochet, pierce, bigger, an element. Applied in a fixed order (count → path → size → rate → element). Capped. |
| Rarity | Common 0 modifier slots, tuned 1, rare 2, epic 3, unique 2 + a named behaviour. |
| Elements | Fire, water, shock, wind. One element per weapon, so two weapons = up to two elements. |
| Reactions | wet + fire = **steam** (enemies lose you) · burning + shock = **overload** · burning + wind = **firestorm** · wet + shock = **conduct** · wet + wind = **frost** · charged + wind = **storm**. |
| World | Oil puddles, water, gas tanks, dry grass and fences react too (oil + fire = burning ground). |
| Prototype | Fire + water (steam), an oil puddle, 3 modifiers (double shot, faster, fire), one main and one off-hand weapon. |

## Economy: loot and currency (Oct 30)
### Currencies [decided]
| Currency | Comes from | Spent on |
|---|---|---|
| **Scrap** (common) | Every kill, salvaging parts, missions | Repair, the trader, upgrades, respecs |
| **Chips** (rare) | Elites, nests, walkers, bosses, salvaging rare parts | Rerolling a modifier, crafting a boss's signature part, upgrading a part's level, Deep Signal wagers; schematics later |

### Parts: 6 slots
| Slot | Does | Look on the vehicle |
|---|---|---|
| Weapon (main) | Theme, signature, modifiers, element | The weapon mount (gun, lance, launcher) |
| **Off-hand weapon** | Theme, signature, modifiers, element; combos with the main | A second mount (water cannon, rocket pod, coil) |
| Engine | Speed, nitro, ram damage | Engine block, exhausts, flame colour |
| Frame | Armour and health | Armour plates, bull bar, cage |
| Lamp | Loot pickup radius, light radius, scan | Headlights, beam colour and shape |
| **Tyres** | Grip by terrain, handling | Wheel and tread style |

Power is spread across slots so the weapons don't decide everything. Tyres are mostly about movement, not damage.

### Rarity [decided]
| Tier | Weapons: modifier slots | Other parts: stats | Signal |
|---|---|---|---|
| Common | 0 | Base only | Auto-salvaged if chosen |
| Tuned | 1 | +1 stat | Blue beam |
| Rare | 2 | +2 stats | Yellow beam + sound; drops "unscanned" |
| Epic | 3 | +3 stats | Purple beam + sound |
| Unique | 2 + named behaviour | A named behaviour | Gold beam + its own sound; its own look |
| Schematic | Later | Later | |

### Tyres and terrain (proposal)
| Terrain | Good tyre | Wrong tyre |
|---|---|---|
| Asphalt / city | Slicks (top speed) | Knobby: slower |
| Sand / dust | Wide paddles | Slicks: bog down, lose speed |
| Mud / swamp | Knobby / tractor | Slicks: slide, poor turning |
| Snow / ice | Studded / chained | Others: drift and slide |
| Rubble / scrap fields | Armoured / run-flat | Others: chip damage over time |

Rules:
- The wrong tyre makes travel slower or slipperier but **never blocks** it.
- Kai carries one spare set and can swap it in the field with a short animation.
- Tyre mods can add twists, e.g. "studded: rams freeze on ice".

### How the look changes
See play atoms §8: every visible piece is a **module** with a socket type (`plate`, `lamp`, `mount`, `wheel`, `vent`, `sign`). Vehicles and houses declare sockets, so the same plate fits a vehicle frame and a house window. Rarity changes paint and glow; only uniques get their own mesh; small variations come from the part's seed.

### Rules that protect the loop [decided]
- The trader never sells rares or uniques, and selling pays less than salvaging.
- Every walker and boss has a signature unique plus guaranteed chips, so effort eventually wins.
- Auto-salvage junk; the lamp radius pulls in scrap.
- Dying drops unbanked scrap as a cache you can recover.
- A favourite part can be upgraded to a higher level (scrap + chips).

## Open questions
1. Which form gets prototyped first?
2. The six reactions and their effects: right feel? Any to swap (e.g. frost vs. something else)?
3. Rebuild missions: how many per area, and do they unlock anything beyond XP and town upgrades?
4. Deep Signal: generated runs with tiers (as proposed), or a fixed special region?
5. Story length: does the story end around level 30?

## Next step the council recommends
- **Economy sim (1 evening):** run 2 hours of play through the old headless simulator. Check banked scrap, drops per minute and time to the first unique.
- **One-area prototype (about 1 week):** one form; main + off-hand weapons with fire, water and steam; an oil puddle; double shot, faster and fire; a walker that spawns crawlers; drops with beams; auto-salvage; the death cache; one house with plate and lamp sockets.
