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

## Next drop: town stats (agreed direction)
- **Main system: scavenge runs** (Dying Light / State of Decay / Project Zomboid): ruins in unclaimed regions hold loot. Send survivors out by day; the further out, the better the loot and the risk. Survivors arrive with traits (Medic, Carpenter, Coward…).
- **Infection and noise as natural events,** not tied to buildings. For example: a scavenger comes back bitten (treat, quarantine or exile), or a storm whose thunder draws a horde from one side.

## Known balance issues (from `npm run balance`)
- Late game (night 25+) has a gold surplus with nothing left to buy. Scavenging and survivors should become the sink.
- The economy and walls bots are weak strategies; partly bot quality, partly real: walls need towers behind them.
