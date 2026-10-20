// The public game API: the one object the UI, bots and tests drive. Names and shapes are a contract
// (see src/CONTRACT.md): add, never rename.
import { CUT, HEAT, LEVEL, TOOLS } from './state.js';
import { ESCAPE, TIDE } from '../content/mobs.js';
import { FOCI } from './planner.js';
import { KEEP, START } from '../content/buildings.js';
import { LANDMARKS, idx } from './mapgen.js';

export function createApi(G) {
  const {
    S, W8, abilityCost, activeNests, addHeat, addPath, baseDist, build, buildLine, buildingAt, buyCost, canPlace, canPurge,
    checkEvolution, choosePack, choosePerk, claimLandmark, clearRubble, companionFollow, contractWon, costOf, crewing, damageBuilding,
    defenceDps, demolish, districtOffer, dropSupply, effN, endRun, escape, evolve, foodNeed, foodPerDawn, forecast, forecastStrip,
    frontier, gainXp, handsFree, handsMax, has, hasTech, hearR, heatFloor, heroDps, heroPath, hitHive, hiveHealth, houseGold, hurtHero,
    inZone, isBloodMoon, keep, keepForRing, keepMaxHp, keepNeeds, killMob, kitFor, landmarkReach, lineCells, manned, map, mastered,
    mastery, maxHpOf, newCost, nightLen, noise, noiseCalm, noiseFloor, openDistrict, owns, partySize, perkOk, planPurge, pop, powerIn,
    powerOut, powered, prosper, raiseBlock, ratingOf, rebuild, rebuildAll, rebuildCost, regionInfo, reroll, rerollPacks, reveal,
    rubbleAt, ruins, rule, setDifficulty, setFinale, setHeroInput, setSeasonRules, siteOf, snapshot, spawnMob, startNight, step,
    threatRatio, timeOfDay, toolsInfo, towerStats, townDraw, trade, upCostOf, upgrade, upgradeKeep, upgradeWall, upkeep, useAbility,
    useFlare, useSmoke, wallBudget, wallRun, zone
  } = G;
  const api = {
    setBuilders: f => { if ((S.foreman || S.autopilot) && FOCI.includes(f)) S.builders = f; },
    scavenge: { siteInfo: G.sc.siteInfo, send: G.sc.send, recall: G.sc.recall, treat: G.sc.treat, exile: G.sc.exile, hopsMap: G.sc.hopsMap },
    state: S, map, get heroDef() { return G.HC; }, evolve: cls => evolve(cls), step, build, choosePack, rerollPacks, buyCost, upgrade, demolish, upgradeKeep, startNight, choosePerk, reroll, trade, planPurge, useAbility,
    setHeroInput,
    setAutopilot: on => { S.autopilot = !!on; if (on && (!S.builders || S.builders === 'off')) { S.buildersWas = S.builders; S.builders = 'balanced'; } else if (!on) { S.builders = S.foreman ? (S.buildersWas ?? null) : null; S.buildersWas = undefined; } },
    heroTo: (x, y) => {
      const h = S.hero, t = h.target;
      if (t && h.path && Math.hypot(t.x - x, t.y - y) < 0.6) return;   // same place: keep the plan
      h.target = { x, y }; h.path = heroPath(x, y);
    },
    buildLine, upgradeWall, wallRun, wallBudget, lineCells,
    weather: () => ({ id: S.weather, ...W8() }),
    hiveHealth, hitHive, escape, escapeCost: k => (TOOLS[k] || ESCAPE[k] || {}).cost || 0,
    useFlare, useSmoke, tools: toolsInfo,
    nightFrac: () => (S.phase === 'night' ? Math.min(1, S.qT / nightLen()) : 0), nightLen,
    timeOfDay,
    dayShare: () => TIDE.dayLen / (TIDE.dayLen + nightLen()),
    duskIn: () => Math.max(0, TIDE.dayLen - S.dayT), dayFrac: () => (S.clock ? Math.min(1, S.dayT / TIDE.dayLen) : 0.4), bellBonus: () => (S.clock ? Math.floor(Math.max(0, TIDE.dayLen - S.dayT) / TIDE.bellGold) : 0),
    dropSupply,
    xpNext: () => LEVEL.xp(S.lvl), gainXp: n => gainXp(n), addPath: (f, n) => addPath(f, n), checkEvolution: () => checkEvolution(), partySize: () => partySize(), companionFollow, snapshot, frontier, districtOffer, openDistrict, kitFor, siteOf, story: () => G.story, choose: id => G.story.choose(id),
    // noise: one meter 0–100 (S.noise). noiseInfo: what it is made of and what it does right now
    noise: () => Math.round(S.noise || 0),
    noiseInfo: () => ({ noise: Math.round(S.noise || 0), floor: Math.round(noiseFloor() * noiseCalm()), choice: Math.round(S.noiseChoice || 0), spike: Math.round(S.noiseSpike || 0), hear: Math.round(hearR()), mult: +townDraw().toFixed(2), erupt: HEAT.erupt, stir: HEAT.stir, live: !!S.feat.heat }),
    hearRadius: () => hearR(),
    // tension: ruins, rebuilding, the forecast strip and the dawn ledger
    rebuild, rebuildAll, rebuildCost: id => { const b = S.byId.get(id); return b && b.ruined ? rebuildCost(b) : 0; }, ruins: () => ruins().map(b => ({ id: b.id, type: b.type, level: b.level, x: b.x, y: b.y, cost: rebuildCost(b) })),
    forecastStrip: () => forecastStrip(), ledger: () => S.ledger || null,
    keepCost: () => { const n = KEEP.need[keep.level]; return keep.level >= 3 ? null : { scrap: KEEP.cost[keep.level], food: (n && n.food) || 0, needs: keepNeeds() }; },
    // contracts (sim/contracts.js builds the offer): stacked rules, the finale, the difficulty step back
    rule: id => rule(id), contractWon, setSeasonRules, setDifficulty, endRun, setFinale, season: () => S.season, effNight: (n = S.night) => effN(n),
    cut: CUT, raiseBlock: id => raiseBlock(S.byId.get(id)), perkOk,
    hitBuilding: (id, d) => { const b = S.byId.get(id); if (b) damageBuilding(b, d); return b ? b.hp : 0; }, hurtHero: n => hurtHero(n),   // scripted events and tests
    spawnMob: (kind, x, y, o) => { const m = spawnMob(kind, x, y); if (m && o) Object.assign(m, o); return m; }, killMob: (m, src = 'hero') => killMob(m, src),
    keepNeeds, hasTech, crewing, manned, handsMax, handsFree, powerIn, powerOut, powered, heatFloor, addHeat, difficulty: () => G.DIFF, newCost, townDraw, noise, reveal, claimLandmark, landmarkReach: id => landmarkReach(S.landmarks[id]), owns, zone, inZone: (x, y) => inZone(idx(Math.floor(x), Math.floor(y))), baseDist, keepForRing, keepLevel: () => keep.level,
    rubbleAt, clearRubble,
    canPlace, buildingAt, costOf, upCostOf, maxHpOf, keepMaxHp, pop, defenceDps, heroDps, threatRatio, ratingOf, activeNests, regionInfo, canPurge,
    abilityCost, towerStats: b => towerStats(b), has,
    foodPerDawn,
    goldPerDawn: () => Math.round((START.baseIncome * G.DIFF.eco + S.P.tax + S.buildings.reduce((a, b) => a + (b.type === 'house' && !b.ruined ? houseGold(b) : 0), 0)) * prosper()) - upkeep() + S.landmarks.reduce((a, l) => a + (l.owned ? LANDMARKS[l.kind].gold || 0 : 0), 0) + (owns('tvtower') ? 3 : 0) + (G.HC.quarter ? 4 : 0),
    upkeep, foodNeed, rerollCost: () => (S.reroll.free > 0 ? 0 : S.reroll.cost),
    forecast, mastered, mastery, isBloodMoon, drainEvents: () => S.events.splice(0),
    logRows: () => S.log.concat(S.cur && !S.cur.closed && S.cur.waveHp ? [S.cur] : []),
  };
  return api;
}
