# Design notes

## Pillars
1. **Day is for decisions, night is for consequences.** Everything you buy by day is tested at night.
2. **Your town's shape is your strategy.** Generated maps give each run a different defensive puzzle: fords, passes, a lake at your back.
3. **Greed is a choice with a visible price.** Expanding gives land, gold and a blessing, but wakes nests and raises the threat for good. The game tells you how risky each siege is before you commit.
4. **Endless, but always ending.** Threat grows exponentially, so every town eventually falls. Your score is the night you reach.

## World drop (this version)
| System | Rules |
|---|---|
| Maps | 64×64 cells. Biomes: River Bend (river with fords), Highland Hold (cliff ring with 3 passes), Lakeshore (lake guards one flank). Two valid maps offered per run. |
| Regions | Voronoi: town + 6 near + 10 far. Each non-town region has a nest and up to 9 build slots. |
| Nests | Near nests wake on nights 1, 2, 4, 6, 8, 10. A nest only sends the dead if its region touches your land. When the whole valley is yours, the dead come from the dark woods at the edge. |
| Expansion | Pick a nest next to your land → that night it sends a siege (extra budget + a Nest Guardian) at the end. Survive → region claimed, +6/+12 gold plunder, +1 blessing, neighbours wake next night. Each claimed region adds +12% threat for the rest of the run. |
| Rating | `threatRatio = expected wave HP / (tower DPS + hero DPS × 0.8) × wave seconds × 1.6`. Thresholds calibrated from bot runs: Easy < 0.3, Medium < 0.55, Hard < 0.8, Impossible ≥ 0.8. |
| Waves | Budget points per night `6 + 2.6n + 0.42n²` × territory × blood moon. Mobs bought by weight from those unlocked. HP × `1.06^(n−1) × (1 + 0.04(n−1))`. Arrive in surges. |
| Blood moon | Every 5th night. Night 5: normal budget + a Nest Guardian. From night 10: ×1.35 + one Gravelord per 10 nights. |
| Mobs | Walker, Runner (n3), Crawler (n4, climbs palisades), Brute (n6), Spitter (n6, ranged), Bloater (n7, bursts on death), Screamer (n9, speeds others up). |
| Pathing | Flow field to the nearest building. Palisades cost 6 extra steps: the dead walk around them when they can and break through when they can't. Crawlers climb them. |
| Heroes | Warrior (melee 3 dmg), Archer (ranged 2 dmg, 7.5 reach), Steward (never fights; +30% gold, 4 blessings offered, an extra pick every 3rd dawn). |

## Readability & economy pass (Oct 18)
| Change | Why | Measured |
|---|---|---|
| Lots on a 4-cell street grid, nudged ±1 to fit, then a fill pass | Random lots clumped together; the town didn't read as a city | Town lots 9 → 13–19, unused town land ≈10%, every lot has a street (tests) |
| Town owns the plateau (Highland) or a 9-cell circle | Empty land inside the cliffs could not be built on | Highland town ≈19 lots |
| Gate lots on fords and passes (towers/palisades only) | Natural chokepoints are where walls belong | 2 per river map, 3 per highland map |
| Calmer palette: warm town with streets, muted wild, one border | Too many colours; hard to see where things are | — |
| Daytime forecast: animated routes + "~N" on each nest | Hard to know where the next wave comes from | Test: every attacking nest has a route to town |
| Citizens eat 1 food each (was ½) | One farm fed three houses, so farms barely mattered | — |
| Tower upkeep 1/2 gold at level 2/3 | Tower-only builds had no cost of doing business | — |
| Tower blessings are % (was +1 flat on a 1-damage tower) | Bow blessings replaced building towers | Paths now median 12–23 (was Bow far ahead) |
| Ratings recalibrated: Easy < 0.3, Medium < 0.55, Hard < 0.8 | Monotonic table after bot fixes | Easy 1–3% of nights end the run, Impossible 59%+ |

## Packs, free placement & the Vale (Oct 18, afternoon)

| Area | What changed |
|---|---|
| Building | Free placement: any spot on claimed open ground, a one-cell street around every building (palisades and towers may chain). Palisades rotate in 4 directions. Pull down refunds half. |
| Packs mode (default) | Islanders-style: each dawn pick 1 of 2 packs (town / defence / mixed) and place them free. Extra buildings cost double gold. Classic mode keeps gold-only buying. |
| Blessings v2 | Common / rare / legendary, pacts with a real downside, 5 combos, masteries after 3 of a family (choice of 2), rerolls (first free, then 5g +5). Chests guarantee a rare, nests a legendary. See `docs/blessings-v2.md`. |
| Heroes | Every hero has one button: War Cry (taunt + guard), Volley (area arrows), Hire sellswords. The Merchant collects purses, gets 10% off, a 4th blessing card and a dawn trader. |
| Phone | Drag anywhere = joystick; a tap selects or walks. Cards ignore taps for 0.7 s, and dawn waits 1.2 s after the last kill. |
| Town life | Villagers walk between homes, farms and the keep by day. |
| Nests | Only nests that will send dead tonight are drawn in full; sleeping nests next to your land show as a faint scar (still marchable); far nests are hidden. |
| The Vale | New V-shaped map: the town sits at the bottom tip; 4 near and 5 far regions widen up the valley. Always one of the two start choices for now. |
| Ending | The camera circles the fallen keep, then a stat card counts up: nights, kills by kind, gold, buildings, peak citizens, land, blessings, bosses, hero or merchant numbers, plus the ledger. |

Balance (96 bot runs, packs mode): median night warrior 24, archer 27, merchant 24. Vale bots 19–29. Rating calibration unchanged (Easy ends 1% of runs, 0.5+ ends half).

## RTS-style placement (Oct 18, evening)
Inspired by Red Alert 2 / OpenRA: you always see where things can go, and walls are drawn as lines.

| Change | Rule |
|---|---|
| Build zone | While a building is in hand, every cell a valid footprint could cover is washed green. |
| Snap | The building snaps to the best valid spot within ~2.5 cells of the pointer, preferring spots that leave exactly a one-cell street to their neighbours (tidy blocks). |
| Palisade lines | Palisades are 1-cell posts (cost 1/2/3, 30/60/100 hp; packs give 8–20). Pick a start, then an end; the line is 4-connected so the dead can't slip through corners. Posts join visually to neighbouring posts and towers. Posts can stand in woods. |
| Upgrading walls | "Upgrade this palisade" upgrades the whole joined line, nearest posts first, as far as your gold goes. |
| Never boxed in | The hero (and sellswords) walk through your palisades; they are the town's gates. A house, farm or tower that would seal off reachable ground is refused. |
| Tap to walk | The hero plans a path around buildings (A*) instead of stopping at the first wall. |
| The dead | Can no longer squeeze diagonally between two building corners or posts. |

## Balance after placement + pathing (Oct 18, evening)
Smarter hero pathing helped the fighters more than the Merchant (median 28–29 vs 24). Fix: sellswords 15 hp / 3 dmg, three per hire (max 9).
24-run check (balanced + towers, careful): mean night warrior 25.2, archer 24.6, merchant 24.3. Medians cluster at blood moons (19/24/29). All balance gates pass.

## Reclaim the city: the new look in the game (Oct 18, night)
| Area | What changed |
|---|---|
| Footprints | Homes and farms 2×2 (were 3×3), towers 1 cell (were 2×2): about twice the buildings in the same land, still with a street around each |
| World | Rock → ruined apartment blocks (one bay per cell: windows, floor bands, broken tops); forest → rubble fields with wrecks, scrub, dead trees; water → canals with concrete banks; fords → footbridges; cliffs → retaining walls; claimed ground is paved |
| Look | Linear lighting, warm sun and cool fill, soft shadows, SSAO, bloom, ACES grade; territory tint from a claim mask (your land warm, the wild grey) |
| Night | Fixed pool of warm lights (keep fire, lamps, lanterns, lit homes), hero lantern, L3 turret searchlight with beam; windows light up |
| Kit | Homes ruin→L3, towers, farms, keep (camp → depot → compound), barricade posts that join (chain-link, sandbags, concrete), hive landmarks (metro, petrol, hospital bay) |
| Figures | Jointed hero and sellswords; the dead as instanced crowds (two walk frames per kind) with glowing eyes; baked villagers |
| UI | Barlow Condensed / Barlow / Plex Mono, dark glass pills; Brawler, Ranger, Scavver; Home, Barricade; hives; city map names |
| Quality | HQ (SSAO + bloom), MQ (bloom, phone default), LQ (grade only); button on the right, remembered |

## Scavenge runs v1 (Oct 18, evening)
The first part of the agreed next drop: the ruins hold supplies, and survivors go out to get them.

| Rule | Detail |
|---|---|
| Sites | One supply cache per region, at a doorway into a ruined block (or the open spot nearest the region's middle). A glowing marker by day, coloured by distance (pale on your land, amber next door, red deep in the city). Tap it to open the site panel. Crews walk out at nightfall and home at dawn; a lantern burns at a site while a crew is there. |
| Distance | Counted in regions from your land. 0 = inside your land, 1 = next door, 2 = deep in the city. Further than 2 is out of reach. |
| Crew | You start with 2 survivors (max 8), each with a trait. Runs can find new survivors. |
| A run | Pick who goes, pay supplies (1 / 3 / 5 gold per survivor by distance). They leave now and come back at dawn. Call them back before the bell for a refund. One crew per site; each site has 2–3 searches. |
| Loot per survivor | 2–4 / 3–7 / 6–12 gold and 1–3 / 2–4 / 3–6 food, plus per run: a free building (15 / 30 / 45%), a new survivor (12 / 22 / 35%), a sealed cache = a rare blessing (0 / 8 / 20%). |
| Risk per survivor | Death 0 / 8 / 18%, +10% if the site's hive is awake, +8% on a blood moon. Bites 0 / 10 / 15%. |
| Bites | A bitten survivor turns at nightfall inside the town (a runner at the keep) unless treated: 4 food or 6 gold, from the Crew card. Or turn them out. The Crew button turns red while someone is bitten. |
| Traits | Scout (run half as deadly), Medic (no bites on their run), Mule (double food), Tinker (more free buildings), Marksman (at home at night: towers +6%), Cook (at home at night: +2 food at dawn), Coward (never dies, half loot). Sending a Marksman or Cook costs their home bonus that night. |
| Sim | `src/sim/scavenge.js`, own random stream: a run without scavenging plays out exactly as before. Bots scavenge only with `node tools/balance.mjs --scav 1`. |

## Clearing rubble (Oct 18, evening)
Rubble (the old forest cells) on your land blocks homes, farms and towers but slows the dead (×1.4 slower). Tap it by day to clear a 3×3 patch for 1 gold per cell: it becomes paved, buildable ground, and the dead cross it at full speed. A trade between room to build and a natural slow zone. The placement hint says "Rubble in the way. Tap it to clear it first." Bots don't clear yet.

## Weather and sound (Oct 18, evening)
| Weather | Odds | Effect |
|---|---|---|
| Clear | 70% | — |
| Fog | 10% | Towers and keep reach 25% less; the dead walk 12% slower. Thicker grey air. |
| Thunderstorm | 10% | 20% more dead; 40% more food next dawn. Lightning and thunder. |
| Still night | 10% | 25% fewer dead. |

Rolled at dawn for the coming night (from night 3, never on a blood moon), announced in a toast and shown in the forecast line, included in the rating. Own random stream.

Sound is synthesised with WebAudio (no files): a cracked bell at nightfall, a dawn chime, tower shots and keep bolts, hits and deaths that fade with distance from the hero, groans of the nearest dead, gnawing, build thuds, crashes, coins, war cries, thunder, night wind. Starts on the first tap; a mute button sits under the quality button.

Also this evening: auto graphics (steps HQ → MQ → LQ after ~6 s under 30 fps, unless you picked a level), calmer town ground, closer desktop camera, balance bots pack buildings on a 3-cell grid.

## Next drop: town stats (agreed direction)
- **Main system: scavenge runs** (v1 shipped, see above) (Dying Light / State of Decay / Project Zomboid): ruins in unclaimed regions hold loot. Send survivors out by day; the further out, the better the loot and the risk. Survivors arrive with traits (Medic, Carpenter, Coward…).
- **Infection and noise as natural events,** not tied to buildings. For example: a scavenger comes back bitten (treat, quarantine or exile), or a storm whose thunder draws a horde from one side.

## Known balance issues (from `npm run balance`)
- Late game (night 25+) has a gold surplus with nothing left to buy. Scavenging and survivors should become the sink.
- The economy and walls bots are weak strategies; partly bot quality, partly real: walls need towers behind them.
