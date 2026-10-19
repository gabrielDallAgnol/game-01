# Research: anime pacing → a Season 1 beat sheet for Hold Hollowmere (Oct 19)

**Problem (Gabriel):** too many mechanics in the first nights. He wants "anime pacing": the first episodes let you look around the world, then things happen little by little.

**Goal of this doc:** how anime seasons are built, how isekai/System shows drip-feed their rules episode by episode, how games already do the same, and a concrete **night-by-night beat sheet**.

Claims marked *(gk)* are general knowledge, not from a page fetched for this doc. Sources are at the end.

---

## 0. The answer on one page

| Question | Answer |
|---|---|
| Unit of pacing | **1 night = 1 episode. 5 nights = 1 arc (ends on a blood moon). 15 nights = Season 1 (a "cour").** Later seasons: 10 nights (2 blood moons), matching `SEASON_LEN = 10` in `src/content/season.js` |
| Core rule | **One new noun per night, at most.** A noun = a resource, a meter, a building type, an enemy type, a companion, or a rule |
| How each noun arrives | **Show → name → use → test → twist** (Half-Life's "behind glass" intro + Nintendo's kishōtenketsu). Never introduce a threat and expect the counter on the same night |
| Episodes 1–3 | The "3-episode rule": by night 3 the player must have seen **the premise, the hook and the promise** (System, first call, first glimpse of the hive and of a unique monster) |
| Breathers | **One quiet night per arc** (after every blood moon: Kingdom's truce; anime's slice-of-life episode). Companions, talking, building, no new rules |
| Mid-season twist | **Night 9**: the first hive eruption, caused by the story (the radio voice was bait). The rule (Heat) was taught on night 6; night 9 shows what it really means |
| Season finale | **Night 15**: the Gravelord blood moon, telegraphed from night 13, multi-phase like Shangri-La Frontier's 4-episode Wethermon fight |
| Job change | **Not a card pick.** Offered as a System quest (nights 11–12), requirements visible from night 8, a **trial away from the town** that crosses a night (cliffhanger), payoff at dawn 13 with a **new verb** (not just stats). Mirrors Solo Leveling ep 11–12 |
| Open-ended run | Every later season repeats **Ki-Shō-Ten-Ketsu** over 10 nights: a far region + a new threat + a new rule + a finale boss + a new "opening" (title card, music, HUD tint) |

---

## 1. How anime seasons are built

### 1.1 Structure vocabulary

| Term | What it is | Take for Hollowmere |
|---|---|---|
| **Cour** | The episodes of one broadcast quarter: **12–13 episodes**. A "season" of a story can be 1 cour or a **split-cour** (2 × 12–13, e.g. Attack on Titan S1 = 25 eps). Cours let studios add or cut a block if a show under/over-performs | Season 1 ≈ one cour ≈ **15 nights** (13 "episodes" + prologue + finale). Later seasons are **half-length arcs** (10 nights) |
| **3-episode rule** | Viewer habit born from the flood of new shows each season: watch three episodes, then decide. Episode 1 introduces characters, world and direction; 2–3 establish style and content | Nights 1–3 decide whether the player stays. By night 3 the hook must have **landed**, not just been promised |
| **Series composition (shirīzu kōsei)** | The lead writer splits the story across episodes "keeping narrative and pacing in mind", assigns episodes to writers, tracks changes that ripple to other episodes. Planning starts as **2–3 sentences per episode** (Urobuchi for *Aldnoah.Zero*), then script meetings (*hon-uchi*), 4–5 drafts | Write the season as a **beat sheet of one line per night** first (section 4). The engine then fills it with storylets |
| **First + last episode** | The series composer usually writes **episode 1 and the finale** personally: they set the tone and the payoff (Urobuchi on *Gargantia*) | Night 1 and night 15 are **hand-authored**, never generated. Everything between may be procedural/AI |
| **Front-loading the hook** | *Oshi no Ko* made episode 1 **90 minutes** because the key moment from volume 1 "would otherwise fall in episode 3" (Jin Tanaka) | If the hook would arrive too late, **make night 1 longer** (a long first day), don't cram mechanics |
| **Arc** | A self-contained story block inside a season. Arcs in practice **grow longer**: Re:Zero S1 = 3 → 8 → 14 episodes; Overlord S1 = 2 → 2 → 5 → 4 | Arc A is short (nights 1–3), Arc B is the longest (4–10), Arc C is the finale block (11–15) |
| **Kishōtenketsu** | 4 parts: **ki** introduce, **shō** develop (no big change yet), **ten** twist (the climax/*yama*, often changes the genre), **ketsu** conclude. Used in yonkoma manga; not centred on conflict | Use at **three scales**: inside one night, inside one arc (5 nights), across a season |
| **Setup / payoff** | A strong thing seen early, paid off later. Shangri-La Frontier: Lycagon (ep 3) marks the hero; the mark pays off in ep 22 (weak monsters flee) | Every season plants **3 setups** with a deadline (see 4.4) |
| **Cliffhanger** | Episode ends on an open question. Jin Tanaka warns against ending episodes "just to create suspense": each episode must stand on its own | Every dawn shows **one** open question (a radio crackle, a light going out), but every night still resolves its own fight |
| **Breather / slice-of-life** | Quiet episode between arcs: training, food, festival, a side game (SLF ep 14 "Squish" sits between the Wethermon plan and the 4-part fight) | One **breather night per arc**, right after the blood moon |
| **Recap episode** | Usually a sign of **production trouble** ("a white flag", ANN Answerman); Solo Leveling aired ep 7.5 as a recap. Only real use: catching up returning viewers. Slime's 24.5 OVA does it in-character (Veldora + Ifrit over shogi) | **"Previously on Hollowmere"** only on *Continue* after a break, written in-character by the Chronicler. Never as filler inside the run |
| **OP / ED** | New opening/ending signals **a new direction** (plot, focus, tone); small changes add characters after they appear; also music marketing | Each new season gets a **new title card + music + HUD tint**. The "ending" = the chapter retold after each blood moon (already exists) |

### 1.2 Three scales of kishōtenketsu

| Scale | Ki (introduce) | Shō (develop) | Ten (twist) | Ketsu (conclude) |
|---|---|---|---|---|
| **One night** | Dusk: the System shows tonight's threat from one side | First waves: the thing you prepared for | A late wave from an unexpected side / a heat spike | Dawn: salvage, a System window, one open question |
| **One arc (5 nights)** | Night 1 of arc: a call / new noun | Nights 2–3: use it, a breather | Night 4: it goes wrong in a new way | Night 5: blood moon, chapter retold |
| **Season (15 nights)** | Nights 1–3: arrival, look around | Nights 4–8: the town grows, each system once | Nights 9–10: the eruption + the unique monster | Nights 11–15: the trial, the job change, the boss |

---

## 2. How isekai / System anime introduce their rules, episode by episode

### 2.1 Solo Leveling (S1, 12 eps + recap 7.5)

| Ep | New power / mechanic / threat |
|---|---|
| 1 | Weakest hunter (E-rank). **Double dungeon**: a rare, deadly dungeon. Pure threat, no System yet |
| 2 | Trials inside the dungeon; at death's door the **System offers to make him a "Player"**; he accepts. The System arrives **as salvation at the darkest moment** |
| 3 | "It's Like a Game": a screen only he can see. **Daily quest** (push-ups, squats). Skips it → **penalty quest** (4 hours in a desert chased by monsters). Rewards: full recovery, **stat points**, a loot box. Comic, low-stakes tone |
| 4 | First **instant dungeon**; helps in a D-rank dungeon break |
| 5–6 | Joins a C-rank raid as filler; first human antagonist |
| 7 | **Secret quest**: Cerberus → key to the Demon's Castle (a long-term setup) |
| 7.5 | Recap (schedule slip) |
| 8–10 | Association raids, rivals, a guild recruits him (the world notices) |
| 11 | **Job change quest** starts; an unfamiliar, stronger opponent |
| 12 | Job change completes; **first shadow soldier ("Arise")**: the signature verb arrives in the **finale** |

**Pattern:** threat (1) → System (2) → rules taught in a funny low-stakes episode (3) → one new dungeon type per episode → job change spread over **two** episodes → the new verb is the finale reward.

### 2.2 That Time I Got Reincarnated as a Slime (S1, 24 eps + 24.5)

| Ep | New power / mechanic / threat |
|---|---|
| 1 | Reborn as a slime. **Great Sage** (the System voice) and first skills; befriends sealed dragon Veldora |
| 2 | Gets a name; **Predator** (eat = gain skills) swallows Veldora. Goblins + the Direwolf threat |
| 3 | **Naming → evolution** (goblins → hobgoblins, wolves → Tempest Star Wolves). First defence of a village |
| 4–5 | Dwarf kingdom: **crafting / artisans** (the town-building layer arrives), a king as a watchful power |
| 6–8 | Shizu: emotional arc; Ifrit fight; **new form (human)** from eating Shizu. Villain Gelmud introduced as a shadow |
| 9–10 | Ogres attack; naming **again** → kijin. Same rule, bigger stakes |
| 11–14 | Orc Lord arc: lizardmen, a famine skill ("Starved"), Orc Disaster; climax around the **cour boundary** |
| 15 | Jura Forest Alliance: **the town becomes a nation** (politics layer) |
| 16 | Demon Lord Milim (a power far above you, calmed, not beaten) |
| 17–19 | Charybdis: sky boss |
| 20–24 | School arc: slower, character-focused cour ending |
| 24.5 | In-character recap OVA |

**Pattern:** System voice (1) → core verb (2) → **the evolution rule in ep 3** → that rule is **reused with bigger stakes** (ogres ep 10, lizardmen ep 16) before new rules arrive. Town building comes in ep 4, politics in ep 15.

### 2.3 Shangri-La Frontier (S1, 25 eps)

| Ep | New power / mechanic / threat |
|---|---|
| 1 | A "trash-game hunter" logs into the most popular VR RPG *(character creation, gk)* |
| 2 | First boss (Ravenous Python, meant for 3 players) solo; **weapon crafting**; respawn point. Ends on an **unbeatable night monster** (cliffhanger) |
| 3 | **Lycagon the Nightslayer**: hopeless fight → a **curse/mark** and an **unexpected scenario**. The setup of the whole season |
| 4 | Trainer (Vysache), a **unique item**, first **companion** (Emul) |
| 5 | Swamp boss; works out **evolved skills** |
| 6 | Pencilgon: another player wants his **unique scenario** info (rivals) |
| 7–8 | Vorpal Colosseum: **trial underpowered** ("survive 5 minutes") |
| 9–10 | Solo boss runs, no-hit challenge |
| 11 | Plans the big one: **Wethermon the Tombguard**; weapon upgrade |
| 12–13 | Party forms (Oikatzo); a story NPC gives the **unique scenario** |
| 14 | **Breather**: a different game ("Squish") + skill linking |
| 15–18 | **The Wethermon fight, 4 episodes**, phases (mount Kirin → Kirin armour), resources run low |
| 19 | **The world reacts** (global announcement, angry rival clan) |
| 20 | Bonus scenario: **next hook** |
| 21–25 | Clan forms; crafting; new region setup |

**Pattern:** the overwhelming unique monster appears **early (ep 3)** and marks the hero; the season boss is **planned in ep 11** and fought over **4 episodes**; a **breather right before** the finale; the world announces the win; a new hook in the next episode.

### 2.4 Re:Zero (S1, 25 eps)

| Ep | Mechanic beat |
|---|---|
| 1 | Summoned; dies in the loot house; wakes earlier. **The power is shown, not explained** |
| 2–3 | Dies again; after the 3rd death he understands **Return by Death**; uses knowledge of the loop to win. Arc 1 closes in ep 3 |
| 4–6 | Mansion arc: the loop again, in a **new setting** with new suspects |
| 7 | First tries to **tell** someone → punished by a shadow: the **hidden rule** is revealed by punishment |
| 8–11 | Uses the rule on purpose; arc 2 ends ep 11 |
| 12–18 | Capital → despair arc; the same rule now **costs** him (he loses allies, Rem forgotten) |
| 19–25 | White Whale + Witch Cult: the rule used **strategically** to build an alliance; finale ep 25 |

**Pattern:** **show the effect first, name it later** (Heat should work like this). Arc lengths grow 3 → 8 → 14. Each arc reuses the core mechanic with a new cost.

### 2.5 Overlord (S1, 13 eps)

| Ep | Mechanic beat |
|---|---|
| 1 | The game didn't log out; NPCs are alive; senses work |
| 2 | Guardians pledge loyalty; **test his abilities** |
| 3 | Carne Village: first spell on a real enemy; raises a death knight (**power test on weak foes**) |
| 4 | A stronger foe (7th-tier angel) is trivial: **power level calibrated** |
| 5–9 | Adventurer disguise: **learn the world from the bottom** (guild ranks), Clementine arc |
| 10–13 | A trusted ally (Shalltear) turns: **the twist**; a 2-episode boss finale |

**Pattern:** the first episodes are a **sandbox to test what you can do** on weak enemies; the season twist uses something you already own.

### 2.6 What the five shows have in common

| Pattern | Seen in | Hollowmere rule |
|---|---|---|
| The System appears **at the darkest moment** | Solo Leveling 2 | Night 1: the System window opens **as the first dead reaches the hero**, not on the menu |
| First rules taught in a **light, funny episode** | Solo Leveling 3 (push-ups), Slime 1 | Day 1–2: daily System quests with silly flavour ("Lift 10 scrap. Reward: +1 Brawn") |
| **Test the power on weak foes** before real threats | Overlord 2–4, SLF 2 | Day 1: a few weak dead in the home square, satisfying to whack |
| One core rule, **reused bigger** before new rules | Slime naming 3→10→16, Re:Zero loop per arc | Teach "naming the infected" once, reuse it in each season with higher stakes |
| An **overwhelming unique monster early** that marks the hero | SLF 3 (Lycagon) | Night 3 sighting of the Lantern-Eater: can't win; it **marks** the hero (curse + boon) |
| **Hidden rule revealed by punishment** | Re:Zero 7 | Heat's eruption rule is shown on night 9, not explained on night 6 |
| Job change = **2-episode trial**, new verb as finale reward | Solo Leveling 11–12, SLF 7–8 | Trial nights 11–12, payoff dawn 13 |
| **Breather right before the finale** | SLF 14 | Night 14 "eve" |
| **World reacts** after the boss | SLF 19, Solo Leveling 10 | After night 15: survivors from other districts come; reputation title |
| Next hook **right after** the finale | SLF 20, Slime 24 | Dawn 16: Season 2's call from far away |

---

## 3. How games already pace "one new thing at a time"

| Game | Mechanism | Take |
|---|---|---|
| **Half-Life 2** | **Safe introduction** (zombie behind a fence, grenadier behind bulletproof glass, barnacles shown before they bite) → **practice** (saw blade cuts a zombie, you pull it free, a zombie appears: "In just 10 seconds, Valve taught the player that circular saws are great against zombies") → **test** → **combination** (exploding barrels near barnacles) | Every threat is first **seen from safety**: the first hive is seen across the fence on night 3; the first eruption happens on night 9 |
| **Super Mario 3D Land/World** (Hayashida) | Every stage: **introduce** (gimmick in a safe place, falling costs nothing) → **develop** (falling now kills) → **twist** ("something crazy happens that makes you think about it in a way you weren't expecting"; Miyamoto pushes the twist) → **conclude** (show mastery). One clear concept "carried through absolutely all the way" | **One concept per night**. The night's waves are built around it |
| **Thronefall** | Fixed maps with **fixed waves**; build by day, **day ends when you choose** (no clock pressure); enemies colour-coded, entry points visible; mutators for harder runs. Levels grow longer (a fan list shows ~6 nights on the first map up to ~15 on later ones; treat as approximate) *(the preview of the next wave before night, gk)* | Keep "night starts when you ring the bell". **Show tonight's threats by side** at dusk. Early nights are short |
| **Kingdom New Lands / Two Crowns** | **Blood moon every 5–6 days** (New Lands), **telegraphed** by a stormy, pink day before + music at sunset. New enemy types join on the **3rd and 5th blood moon** (floaters, then breeders + crown stealers). After a blood moon, a **truce** (2 days early, then 1, later none) | Blood moon every 5 = the arc finale. **Telegraph it a day ahead**. New enemy types only at blood moons. **Truce night after**, shrinking as seasons go on |
| **Frostpunk** | The **forecast** drives pacing: a cold icon warns, a warm icon brings a break; the scenario ends on a final storm (−150°C) | Show a **3-night forecast** strip (blood moon, fog, a call's deadline). The season finale is a forecast that grows on screen |
| **Against the Storm** | Danger in **seasons** (Drizzle, Clearance, **Storm**); Blightrot only exists on **Veteran+** difficulty; extra blight modifiers at higher Prestige; Hostility rises with your actions | **Difficulty gates mechanics**: on Story, eruptions arrive later; on Veteran+, Season 1 is compressed. Heat = Hostility |
| **Persona 5 Royal** | Each palace: a **visible deadline 19–26 days** out; free days between = social links (breathers); the player chooses when to push | Story calls carry a **deadline in nights** ("Channel 9 goes silent in 3 nights"). Free nights in between are the slice-of-life |
| **Slay the Spire** | Acts end in a boss; **rest site always before the boss**; **treasure at the act's midpoint** *(boss shown at the top of the map, gk)* | **Breather before the finale** (night 14) and a **treasure night at the arc midpoint** (night 3, 8, 13) |
| **Dome Keeper** | Loop: fight a wave → **mine with a visible timer** → upgrade → next wave | Day = visible window; show "dusk in …" when the player is far from the town |
| **Hades** | Story advances on every return, **even after death**; weapons, hub areas and upgrades unlock across runs; characters acknowledge the cycle | Legacy: a second run can **skip the prologue** ("You've been here before." System line). Companions remember the last run |

---

## 4. Proposal: Season 1 "Arrival" (nights 1–15)

### 4.1 Rules of the season

| Rule | Why |
|---|---|
| **One new noun per night, max.** Many nights add none | Gabriel's feedback; Mario "one concept per stage" |
| HUD slots stay **hidden until introduced**. Each introduction = one System window, 3 lines, bold keyword | Already started in `season.js` (`FEATURES`) |
| Each noun: **show (safe) → name → use → test → twist** across 2–5 nights | Half-Life 2, kishōtenketsu |
| New **enemy types only on blood moons** or story nights, announced at dusk | Kingdom Two Crowns |
| **Blood moon telegraphed the day before** (red tint, music, forecast strip) | Kingdom New Lands |
| **Truce/breather night after each blood moon** | Kingdom truce, anime breathers |
| Every dawn ends on **one** open question; every night resolves its own fight | Cliffhanger without "suspense for its own sake" (Jin Tanaka) |
| Nights 1 and 15 hand-authored; nights 2–14 are storylets with fixed slots | Series composer writes first + last |

### 4.2 Beat sheet

Legend: **NEW** = the one new noun · threat = what the night throws · hook = the open question at dawn.

| Night | Ep title (offline) | Kishōtenketsu | NEW | Threat | What the player does / feels | Hook at dawn |
|---|---|---|---|---|---|---|
| **1** | A Bus Full of Strangers | Ki | **System window** + **Scrap** (the only resource shown) + Survivor hero | 3–5 slow dead from one side; the System opens **as the first one reaches you** (Solo Leveling ep 2) | Long first day: walk the home square, whack weak dead (Overlord "test your power"), loot scrap, place 1 barricade + 1 tower | A radio in the bus crackles: "…anyone…" |
| **2** | The Town Hall Bell | Ki | **People → hands** (3 survivors walk in; each build needs a free pair of hands) | Slightly more dead, still one side | First **daily System quest** (comic: "Carry 10 scrap. Reward: +1 stat"). Build a home | Drawings appear on a school window across the fence |
| **3** | Drawings on the Glass | Ki → hook | **First call**: Channel 9 opens the first sealed district (close, safe-ish, back by dusk). **Level 2 + first blessing** | Two sides for the first time (announced at dusk) | First excursion. From the district's roof: **the first hive, seen across the fence** (HL2 "behind glass"). **The Lantern-Eater crosses a street far away**: the hero is spotted and **Marked** (SLF Lycagon: curse + boon, e.g. lights near you flicker, weak dead hesitate) | The streetlamps on the north corner go out, one by one |
| **4** | What the Radio Said | Shō (breather) | **Food** + **first companion moves in** (Ines or Mara). Talk to them | Same size as night 3 | Slice of life: farm, chat, name the town. **Blood moon forecast appears** ("☾ tomorrow") | The sky turns pink at sunset |
| **5** | The First Blood Moon | Ketsu (arc A finale) | Blood moon (guardian only, the "warning shot" already in `mobs.js`) | Guardian + a bigger wave | First real test of everything taught so far (scrap, hands, towers, food). **Chapter 1 retold** (the "ED") + first **title** | "Season" bar on the status window shows ⅓ |
| **6** | Breathing Room | Ki (arc B) | **Heat meter appears** (yellow mark only: noise draws the dead in). **Expeditions** (scouts offer routes) | **Truce**: very light | The effect is **shown first** (dead drift toward the noisy tower), then named (Re:Zero) | Mara: "There's a substation two districts out. If it still turns…" |
| **7** | They Can Hear Us | Shō | **Power** (Mara's call: restart the substation, the first **far** trip; generator = loud = heat). Blackout shown **safely**: a flicker by day | Normal | The first trip where the town must hold without the hero by dusk (light) | The substation hums back to life. Something else hums with it |
| **8** | A Toll for the Road | Shō + midpoint treasure | **Calling** (first class tier at level 5, already in code). **Job change requirements visible but greyed**: "Final class: Level 12 · a Calling · [???]" | **New enemy type** from the newly opened district (e.g. runners), announced at dusk | Treasure night: a rich street find (Slay the Spire midpoint chest) | Channel 9 broadcasts the town's coordinates on loop |
| **9** | The Signal | **Ten (mid-season twist)** | **Heat red mark revealed by punishment**: the radio voice was bait; heat spikes, the nearest hive **swells and bursts** (40 s countdown) | First **eruption**, scripted, survivable | Twist: the "survivor" on the radio is The One Who Hums. The rule of the world flips: **being heard is the enemy**. Choice: silence Channel 9 (lose its gifts) or keep it (more heat, more loot) | The north corner is dark all the way to the fence |
| **10** | The Thing That Eats the Light | Ten → arc B finale | Blood moon 2: **the Lantern-Eater** (named unique; pays off the night-3 Mark) | Unique monster + blood moon wave | Mid-season climax. Kill it → legendary blessing; drive it off → it returns angrier (already in `story.js`) | System: "[A Trial has noticed you]" |
| **11** | The Long Table | Breather + Ki (arc C) | **Foreman** (town builds itself: the reward that lets you leave). **Job change quest offered** (if Calling + `FINAL_LVL`, 12 in code: tune XP so a typical run reaches it by night 11; else offered later) | **Truce** | Festival/companion night: everyone you saved at one table. The quest window: name, place (the landmark), time limit, "You will go alone" | A bell rings in the landmark. Nobody is there to ring it |
| **12** | The Trial (I) | Shō → Ten | The **trial**: the hero goes alone to the landmark; companions can't follow; the town runs on the Foreman | The town fights **without the hero** (normal wave, slightly lighter). The hero fights the trial | Trial rules **change halfway** (Solo Leveling: "survive" becomes "defeat the knights"; SLF arena: underpowered, survive 5 min). Ends at dusk on a **cliffhanger**: the trial's last door closes, the town's horn sounds | Is the town still standing? |
| **13** | The Trial (II) / Arise | Ketsu of the trial | **Final class + a new verb** (not just stats): e.g. Warden → raise a ward wall; Deadeye → marked shot; Medic line → **cure and name an infected** (Slime naming) | Dawn: return to the town; a **combination night**: power + heat + two sides + runners | The big System window ("Job change complete"), new skill used **immediately** on the night's wave (Solo Leveling ep 12 "Arise") | Forecast strip: **☾ in 2 nights: the Gravelord** |
| **14** | The Eve | Breather (rest before the boss) | None | Light wave | Prepare, talk, companions' lines about tomorrow; the boss's path and phases shown on the map (Slay the Spire shows the boss) | Graves crack open across the city |
| **15** | The Gravelord | **Ketsu (season finale)** | Season boss, **multi-phase** (SLF Wethermon: mount → armour; resources run low) | Blood moon 3 + boss from a far district | Phase 1 at the fence, phase 2 inside a district, phase 3 at the hall. Everything learned is used once | **Season 1 complete** screen → "The world reacts" (survivors arrive, reputation title) → **Season 2 call from far away** |

### 4.3 Noun introduction order (check: one per night)

| Noun | Seen safely | Named | Tested | Twist |
|---|---|---|---|---|
| Scrap | n1 | n1 | n1 | n8 (rising cost per copy bites) |
| Hands / People | n2 | n2 | n3 | n12 (town holds without the hero) |
| Food | n4 | n4 | n5 | Season 2 rule (winter / hunger) |
| Heat | n6 (dead drift) | n6 (yellow) | n7 (generator noise) | **n9 eruption** |
| Power | n7 (flicker by day) | n7 | n8–10 | n13 (blackout in the combination night if over-built) |
| Expeditions | n3 (story call) | n6 | n7 | n12 (the trial is a forced expedition) |
| Hive | n3 (across the fence) | n6 | n9 | n15 (the boss comes out of one) |
| Unique monster | n3 (far away, Mark) | n9 (lights die) | n10 | Season 2: returns if spared |
| Calling / class | n2 (stat quest) | n5 (level) | n8 (Calling) | n13 (final class + verb) |
| Companions | n2 (strangers) | n4 | n7 (Mara's call) | n11 (the table) / n12 (can't follow) |

### 4.4 Setups and payoffs in Season 1

| Setup (night) | Payoff (night) | Source pattern |
|---|---|---|
| Radio crackle (1) | Channel 9 is bait (9) | Re:Zero: show first, explain by punishment |
| Lantern-Eater sighting + Mark (3) | Lantern-Eater blood moon (10) | SLF Lycagon ep 3 → payoff later |
| Greyed job change requirements (8) | Trial (12–13) | Solo Leveling: the System hints, then the quest |
| Hive across the fence (3) | Eruption (9), boss's lair (15) | HL2 "behind glass" |
| "Something else hums" (7) | The One Who Hums (9) | Cliffhanger seed |

### 4.5 How the job change should feel

| Beat | Design | Anime reference |
|---|---|---|
| **Foreshadow** | From night 8 the status window shows a greyed slot: "Final class · Requirements: Level 12, a Calling, [???]". The [???] is revealed as "Answer the Trial" when the quest appears | Solo Leveling's System shows quests the hero isn't ready for |
| **Offer** | A big System window with a name ("Trial of the Empty Hall"), a place (the city's landmark), a timer ("Begins at dawn. 1 attempt per blood-moon cycle"), and a warning ("You will go alone") | Solo Leveling ep 11 |
| **Isolation** | Companions can't enter; the town runs on the Foreman. The player watches the town's health on a mini-banner while fighting | Ep 11–12: alone against an unfamiliar enemy |
| **Rules change midway** | Phase 1: survive 90 s (dodge, kite). Phase 2: the System rewrites the goal ("Defeat the Knight") and gives a **temporary** taste of the new verb | SLF arena (survive underpowered), Solo Leveling job change |
| **Cliffhanger** | Night 12 ends with the hero inside; the dawn card shows the town's result first, then the trial's end | Two-episode structure |
| **Payoff** | Full-screen System window: "[Job change complete] Survivor → Warden". A **new verb**, used at once on night 13's wave | Ep 12 "Arise" |
| **Failure** | Not death. Lose the attempt, keep the Calling, take a scar (title "Unready"); retry after the next blood moon | Re:Zero: failure feeds the next attempt |
| **Story difficulty** | The trial waits for the player; the town gets a free night | Against the Storm gates harsh rules by difficulty |

---

## 5. Later seasons in an open-ended run

### 5.1 The season template (10 nights, 2 blood moons)

| Night in season | Beat | Content slot |
|---|---|---|
| 1 | **Ki**: a call from **far away** (new region, foothold) + new title card / music / HUD tint ("new OP") | Region |
| 2 | Show the new threat safely (across a fence, on a radio, in a dream) | Threat |
| 3 | Name the new **rule** (System window) | Rule |
| 4 | Use it; a companion's personal quest | Companion |
| 5 | **Blood moon**: the new threat type joins the wave | Threat |
| 6 | **Breather** (truce shrinks each season: 2 nights → 1 → none) | — |
| 7 | **Ten**: the rule turns against you (twist) | Rule twist |
| 8 | Trial / evolution / companion awakening (alternate each season) | Growth |
| 9 | Eve: boss telegraphed | — |
| 10 | **Ketsu**: finale boss (multi-phase) → world reacts → next call | Boss |

### 5.2 Seasons 2–5 (authored), then generated

Aligned with the four `SEASONS` already in `src/content/season.js`.

| Season | Far region | New threat | New rule | Growth beat | Finale |
|---|---|---|---|---|---|
| 1 Arrival (15 nights) | Home + 1–2 districts | Walkers, runners, the Lantern-Eater | Hands, Food, Heat, Power | Calling + job change | The Gravelord |
| 2 Beyond the Fence | The bridge / outer districts | **Raiders** (people, fast, after scrap) | Footholds: a second site that can fall | Companion awakening (the Bridge Crew boss) | A raider warlord + the spared Lantern-Eater |
| 3 Under the City | Metro stations | Dead rising **inside** your lines | The metro (spawns inside) | **Naming the infected** at scale (Slime naming reused bigger) | The Station Mother |
| 4 The Long Winter | Fuel depot / reservoir | Frost-slowed, armoured dead | Winter: farms −⅓, everything slower | Second evolution or a legendary title trial | The Frost Choir |
| 5+ Generated | Pick an unopened far district | Pick an unseen enemy modifier | Pick from `SEASON_POOL.rules` (never the last two) | Alternate trial / awakening / nation-level upgrade | A generated named unique (Chronicler names it from the run) |

### 5.3 Rules for generated seasons

| Rule | Why |
|---|---|
| Exactly **one** new rule, **one** new threat, **one** new region per season | Keeps "one noun per night" in late game |
| Reuse a known rule **bigger** before adding exotic ones | Slime naming 3 → 10 → 16 |
| Each season's finale plants the **next season's setup** (a far signal, a name) | SLF ep 20 bonus scenario |
| Arcs get **slightly longer** with the run (10 → 12 nights), truce gets shorter | Re:Zero arcs 3 → 8 → 14; Kingdom truce shrinks |
| "Previously on Hollowmere" only on Continue after real-world time away | Recaps are filler otherwise (ANN) |
| Returning players (Legacy) can **skip the prologue**: start at night 6 with Season 1's nouns unlocked | Hades: the game acknowledges you've been here |

---

## 6. What this means for the code (short)

| Item | Status / suggestion |
|---|---|
| `season.js` `FEATURES` (hidden HUD until introduced) | Exists for power, heat, routes. Add **food**, **hands**, **expeditions-by-call**, **job change** entries with the nights above |
| `SEASON_LEN = 10` | Keep for later seasons; make **Season 1 = 15** (3 blood moons: guardian, Lantern-Eater, Gravelord) |
| `EPISODES` titles | Extend to 15 using the beat sheet titles |
| Blood moon telegraph | Red-tinted sky + "☾ tomorrow" on the dawn **before** (n4, n9, n14) |
| Truce | Night after a blood moon: light wave (n6, n11) |
| New enemy types | Only on blood moons or story nights; announce at dusk with the side they come from |
| Job change | Trial quest (n11 offer, n12 trial, n13 payoff) instead of the second-family card pick |
| Difficulty | Story stretches Season 1 (eruptions from n12); Veteran+ compresses it (Heat at n4) |

---

## Sources

**Anime structure and production**
- Wave Motion Cannon, "Anime pre-production: from story to script" (series composer role, hon-uchi, 2–3 sentences per episode): https://wavemotioncannon.com/2017/07/05/anime-pre-production-from-story-to-script/
- Otaku Mode, interview with Gen Urobuchi (series composer writes first and last episodes): https://otakumode.com/news/51a1bdb5ffcbf79230012f3d/Interview-with-Gen-Urobuchi-Composer-and-Scriptwriter-of-ldquo-Gargantia-on-the-Verdurous-Planet-rdquo-1-4
- AniTrendz, Jin Tanaka on the *Oshi no Ko* adaptation (90-min episode 1, no suspense-only endings): https://www.anitrendz.com/news/2023/05/08/script-writer-jin-tanaka-shares-insights-on-oshi-no-ko-anime-adaptation
- Kanzenshuu, Animation production guide (roles): https://kanzenshuu.com/animation-production/positions-and-roles
- Mein-MMO, cour / season / split-cour: https://mein-mmo.de/en/the-year-is-divided-into-4-anime-seasons-what-do-terms-like-cour-season-and-episode-mean,1108241/
- Sci-Fi Bloggers, the three-episode rule: https://scifibloggers.com/explanation-three-episodes-rule/amp
- Wikipedia, Kishōtenketsu: https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu
- Anime News Network Answerman on recap episodes: https://cdn02.animenewsnetwork.com/answerman/2017-12-08/.125006
- Mein-MMO, Solo Leveling recap episode 7.5: https://mein-mmo.de/en/solo-leveling-anime-macht-pause-recap-episoden,1093621
- AnimeNation "Ask John", why OP/ED change: https://www.animenation.net/blog/?p=432

**Isekai / System shows**
- esports.gg, Solo Leveling anime episode guide: https://esports.gg/news/entertainment/solo-leveling-story-guide-anime-episode-to-manhwa-chapters/
- In Between Drafts, Solo Leveling ep 3 "It's Like a Game" (daily quest, penalty, rewards): https://inbetweendrafts.com/solo-leveling-review-the-rules-are-set-in-its-like-a-game/
- Sportskeeda, Solo Leveling ep 12: https://www.sportskeeda.com/anime/solo-leveling-episode-12-jinwoo-becomes-shadow-monarch-jeju-island-arc-officially-begins
- Wikipedia, That Time I Got Reincarnated as a Slime season 1: https://en.wikipedia.org/wiki/That_Time_I_Got_Reincarnated_as_a_Slime_season_1
- TVmaze, Shangri-La Frontier episode guide: https://www.tvmaze.com/shows/69007/shangri-la-frontier/episodeguide
- Bubbleblabber, Shangri-La Frontier ep 2 review: https://www.bubbleblabber.com/?p=167147
- Wikipedia, Re:Zero season 1: https://en.wikipedia.org/wiki/Re:Zero_season_1
- Anime News Network, Re:Zero episodes 1–3 review: https://animenewsnetwork.com/review/re-zero-starting-life-in-another-world/episodes-1-3/.101182
- Wikipedia, Overlord season 1: https://en.wikipedia.org/wiki/Overlord_season_1

**Games**
- Game Developer, "The secret to Mario level design" (Hayashida, kishōtenketsu): https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design
- Gigazine, Super Mario 3D World 4-step level design: https://gigazine.net/gsc_news/en/20160920-super-mario-3d-world-4-step-level-design
- WN Hub, the "invisible" tutorial in Half-Life 2: https://wnhub.io/news/other/item-11774
- Finger Guns, Thronefall early access review: https://fingerguns.net/games/2023/08/05/thronefall-early-access-review-pc-to-arms/
- Elliot C. Smith, Thronefall review: https://www.elliotcsmith.com/thronefall/
- Shapes (fan page), Thronefall levels (night counts approximate): https://shapes.inc/fandom/thronefall/levels
- Kingdom wiki, Blood Moon: https://kingdomthegame.fandom.com/wiki/Blood_Moon
- indienova, Frostpunk critical play report: https://lab.indienova.com/indie-game-review/critical-play-report-frostpunk/
- Against the Storm wiki, Blightrot: https://wiki.hoodedhorse.com/Against_the_Storm/Blightrot
- Gfinity, Persona 5 Royal palace deadlines: https://www.gfinityesports.com/guides/persona-5-royal-palaces
- Slay the Spire wiki, Map Locations: https://slaythespire.wiki.gg/wiki/Map_Locations
- Wikipedia, Dome Keeper: https://en.wikipedia.org/wiki/Dome_Keeper
- GameSpot, "Hades changes what it means to be a roguelike": https://gamespot.com/articles/hades-changes-what-it-means-to-be-a-roguelike/1100-6483420/
- ScreenHub, Greg Kasavin on Hades' narrative: https://www.screenhub.com.au/news-article/features/digital/jini-maxwell/hades-greg-kasavin-breaks-down-supergiants-unique-approach-to-narrative-262459
