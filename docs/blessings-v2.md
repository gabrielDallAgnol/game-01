# Blessings v2 and hero abilities

Goal: blessings that change *where and how* you build, not only stat bumps. Every rare or legendary blessing should change one decision you make by day.

## Offer rules

| Source | Choices | Common / Rare / Legendary | Notes |
|---|---|---|---|
| Dawn | 3 (Merchant: 4) | 70 / 27 / 3 % | Legendary at dawn only from night 10 |
| Chest (brute, guardian, gravelord) | 3 | 30 / 55 / 15 % | At least one rare |
| Claimed nest | 3 | 0 / 60 / 40 % | At least one legendary if any are left |
| Reroll | — | — | 1 free reroll per run; then 5 gold, +5 each time (resets at dawn) |

- **Family weighting** stays: each blessing you already hold in a family adds +0.6 weight to that family.
- **Mastery:** taking 3 of one family still unlocks it, but now it's a **choice of 2 mastery cards** (see the Masteries section), shown as a special offer.
- **Pacts** appear only as rares, and at most one per offer. A red frame marks the downside.
- **Exclusivity:** a blessing taken at max stacks leaves the pool. Legendaries are 1 per run each.

## Hero family

| id | Rarity | Name | Player text | Implementation |
|---|---|---|---|---|
| steel | common | Sharpened Steel | Hero attacks deal +1 damage. (max 3) | existing `heroDmg` |
| hymn | common | Battle Hymn | Hero attacks 20% faster. (max 3) | existing `heroRate` |
| skin | common | Iron Skin | +12 max health; heal 1/s at night. (max 2) | existing `heroHp`, `heroRegen` |
| blood | rare | Bloodthirst | Heal 2 for each zombie that dies within 6 of you. | existing `lifesteal` |
| rally | rare | Rallying Cry | While you stand within 5 of a tower, it shoots 30% faster. | `stepTowers`: if hero alive and dist(hero,b)<5, rate /= 1.3 |
| execute | rare | Executioner | Your hits kill zombies below 25% health outright. | `hitMob(src='hero')`: if (hp−d)/maxHp < 0.25 → hp=0 |
| wardance | rare | War Dance | Every 3rd hero attack hits all zombies within reach. | counter on hero; reuse mastery cleave branch |
| last | legendary | Last Stand | Below 30% health you deal double damage and can't drop below 1 health for 4 s (once per night). | per-night flag `S.nightFlags.lastStand`; check in `hurtHero` |

## Bow family

| id | Rarity | Name | Player text | Implementation |
|---|---|---|---|---|
| fletch | common | Fletchers | Towers deal 25% more damage. (max 3) | existing `towerDmg` |
| draw | common | Quick Draw | Towers shoot 20% faster. (max 3) | existing `towerRate` |
| eyes | common | Keen Eyes | Towers and keep reach +1.5. (max 2) | existing `towerRange` |
| volley | rare | Volley Towers | Level 3 towers fire a second arrow. | `stepTowers`: shots = level===3 ? 2 : 1 |
| watch | rare | Watch Fires | Towers within 4 of another tower reach +2. | at night start, cache `b.paired` = any tower within 4 |
| fire | rare | Fire Arrows | Every 5th tower arrow sets the target burning: 1 damage/s for 4 s. | per-tower counter; mob `burn` {t, dps} ticked in `stepMobs` |
| hunter | rare | Big Game | Towers deal +60% damage to brutes, guardians and Gravelords. | `hitMob`: if src tower/keep and size ≥ 1.6 → ×1.6 |
| ballista | legendary | Ballista Keep | The keep fires a piercing bolt every 3 s: 8 damage to every zombie in a 1-wide line, range 12. | keep timer; line hit = mobs with distance to segment < 0.6 |

## Stone family

| id | Rarity | Name | Player text | Implementation |
|---|---|---|---|---|
| timber | common | Thick Timber | Palisades +60% health. (max 2) | existing `wallHp` |
| mortar | common | Lime Mortar | All buildings +20% health; keep +20. (max 2) | existing `allHp`, `keepHp` |
| masons | common | Guild of Masons | Towers and palisades cost 1 less. (max 2) | existing `defDiscount` |
| thorns | rare | Thorned Stakes | Zombies that hit a palisade take 3 damage. | existing `thorns` (3) |
| tar | rare | Tar Pits | Zombies within 2 of a palisade move 40% slower. | `stepMobs`: speed × 0.6 if a wall within 2 (spatial check on wall list) |
| bastion | rare | Bastions | Towers within 3 of a palisade deal +40% damage. | cache `b.walled` at night start |
| rubble | rare | Salvage | When any building falls, gain 2 gold and it rebuilds at dawn at full health. | `ruin()`: S.gold += 2 |
| bell | legendary | Bell of Last Light | Once per run: when the keep would fall, it survives at 30% and every zombie within 8 burns for 20 damage. | flag `S.P.bell`; check in `ruin(keep)` before `endRun` |

## Harvest family

| id | Rarity | Name | Player text | Implementation |
|---|---|---|---|---|
| market | common | Market Day | Each house +1 gold at dawn. (max 3) | existing `houseGold` |
| soil | common | Fertile Soil | Each farm +2 food at dawn. (max 3) | existing `farmFood` |
| tax | common | Tax Collector | +5 gold every dawn. (max 2) | existing `tax` |
| guarded | rare | Guarded Streets | Houses within 6 of a tower pay +2 gold. | dawn: per house, any tower within 6 |
| granary | rare | Granary | Unused food is kept; each 5 spare food at dawn gives +1 gold. | dawn: S.gold += floor(spare/5) |
| bounty | rare | Bounty | +1 gold for every 3 zombies killed. | existing `bounty` |
| labour | rare | Cheap Labour | Houses and farms cost 1 less; tower upkeep −2. | existing |
| guild | legendary | Merchant Guild | Every 4 houses unlock a free tower upgrade at dawn. | dawn: floor(houses/4) − used → upgrade cheapest tower |

## Pacts (rare, red frame, real downside)

| id | Family | Name | Upside | Downside | Implementation |
|---|---|---|---|---|---|
| pactBlood | Bow | Blood Arrows | Towers +50% damage | Keep −30% max health | `towerDmg += .5`, `keepHp -= 0.3×` (store as multiplier) |
| pactGreed | Harvest | Usury | +12 gold every dawn | Each claimed region adds +25% threat instead of +12% | `tax += 12`, territory factor override |
| pactRage | Hero | Berserker | Hero +100% damage | Hero can't heal by day; −40% max health | flags in `stepHero` day regen |
| pactStone | Stone | Walls of Bone | Palisades +150% health | Houses −1 gold each | `wallHp += 1.5`, `houseGold -= 1` |

## Synergies (shown as a gold "Combo!" tag on the card when you hold the partner)

| Combo | Families | Effect when both held |
|---|---|---|
| Tar Pits + Fire Arrows | Stone + Bow | Burning zombies in tar take double burn damage |
| Rallying Cry + Watch Fires | Hero + Bow | Rally radius 8, and paired towers get the Rally bonus anywhere |
| Guarded Streets + Bastions | Harvest + Stone | Houses next to a palisade (within 3) also pay +1 gold |
| Bloodthirst + Bounty | Hero + Harvest | Kills by the hero pay 1 gold each |
| Salvage + Lime Mortar | Stone + Stone | Fallen buildings refund 4 instead of 2 |

Implementation: `SYNERGIES = [{a, b, id}]`; `has(id)` checks `S.P.taken`; effects read `has()` at their hook.

## Masteries (3 of a family → pick 1 of 2)

| Family | Option A | Option B |
|---|---|---|
| Hero | Whirlwind: attacks hit everything in reach, +1 damage | Champion: +25 max health, attacks 30% faster |
| Bow | Deadeye: towers and keep +40% damage | Rain of Arrows: every 6 s each tower fires at 3 targets |
| Stone | Mending: buildings repair 0.3/s at night | Fortress: palisades can't be crawled over and reflect 50% of damage |
| Harvest | Prosperity: +30% gold and food at dawn | Patronage: every dawn, one random blessing offer is rare or better |

## Hero abilities (one button, bottom-right)

| Hero | Ability | Cost / cooldown | Effect | Sim API |
|---|---|---|---|---|
| Warrior | War Cry | 25 s, night only | Zombies within 6 turn on you for 4 s; you take −50% damage meanwhile | `useAbility()`; mob `taunt` timer → target hero |
| Archer | Volley | 20 s, night only | Rain of arrows at the target area (or the nearest crowd): radius 2.5, 6 damage | `useAbility(x,y)`; instant AoE `hitMob` |
| Merchant | Hire Sellswords | 10 gold, +5 per use each night, 6 s cooldown | 2 sellswords appear at you | `hireMercs()` (see below) |

## Merchant (replaces the Steward)

The goal: never swings a sword, but is busy every night spending gold to fight and collecting gold to spend.

| Mechanic | Rules | Numbers |
|---|---|---|
| **Sellswords** (night) | Ability button. Allies spawn at the Merchant, chase the nearest zombie within 6 of the Merchant (else follow him), melee, and leave at dawn | 2 per hire; 12 hp, 2 dmg / 0.8 s, speed 5.5, ×hpScale-free; cost 10, +5 per hire that night; cooldown 6 s; max 8 alive |
| **Coin purses** (night) | Every zombie death has a chance to drop a purse that lasts 12 s; only the Merchant collects (walk within 1.2) | Drop 25% (brute/guardian 100%); value 1 gold (brute 3, guardian 8) |
| **Travelling trader** (dawn) | After blessings, a trader card offers 3 deals; pick 0–1 | Pool: buy a blessing reroll 6g · buy an extra blessing pick 15g · sell 5 food for 4g · next upgrade −50% · rebuild keep +25% health for 8g |
| Passive | Haggle | Buildings cost 10% less (round down, min 1). No more +30% gold |

Sim API:
- `game.hireMercs()` → fail if not night, not merchant, gold < cost, cooldown or cap; pushes `{id, kind:'merc', x, y, hp, cd}` to `S.allies`.
- `stepAllies(dt)` reuses `moveToward` and `hitMob(src='merc')`. Zombies within 2 of an ally may target it (treat it like the hero in `stepMobs`: `hd` = nearest of hero and allies).
- `S.purses[]` like `S.chests`, with a `life` timer, picked up in `stepHero` when `HC.collects`.
- `game.tradeOffer()` / `game.trade(id)`: generated at dawn for the Merchant, stored in `S.trade`.
- Log: `dmg.merc`, `kills.merc`, `goldFromPurses`, `mercsHired`.

Balance hooks to watch in bots:
- Merchant bot hires when ≥ 4 zombies are within 8 of the keep and gold ≥ cost + 6.
- Target: Merchant median within ±3 nights of Archer.
