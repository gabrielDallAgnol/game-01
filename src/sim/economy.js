// The camp's economy: what things cost (scrap, hands, power), what homes and farms give, the keep's needs,
// dawn (income, food, the ledger, the next day's setup), the run log, the end of the run, building packs, the trader.
import { BUILDINGS, HANDS, KEEP, POWER, RISE, START } from '../content/buildings.js';
import { CUT, FOREMAN, NOISE, PICKS_PER_DAWN } from './state.js';
import { LANDMARKS } from './mapgen.js';
import { PACKS, PACK_RULES } from '../content/packs.js';
import { REROLL } from '../content/perks.js';
import { TRADES } from '../content/heroes.js';
import { seasonEnd } from '../content/season.js';
// [econ3] a flat tower price
import { ECON } from '../content/econ.js';

export function createEconomy(G) {
  const { S, combo, dropLive, earn, ev, fail, has, hasTech, isBloodMoon, isDef, keep, mastery, near, owns, pop, rng, rule, syncPicks, toast } = G;
  const costOf = (type, level = 1) => Math.max(1, Math.floor(BUILDINGS[type].cost[level - 1] * (1 - (G.HC.discount || 0))) - (isDef(type) ? S.P.defDiscount : S.P.ecoDiscount));
  // a new building costs more for every one of its kind you already have
  const copies = type => S.buildings.filter(b => b.type === type).length;
  // towers climb in a straight line (every copy +25% of the base: more towers is a real choice against better ones);
  // everything else climbs and flattens; barricade posts get dearer by one scrap per dozen
  const newCost = type => Math.max(1, Math.round(type === 'tower' ? costOf(type) * (1 + (ECON.flatTower ? 0 : RISE.tower * copies(type)))   // [econ3] a tower always costs the same
    : type === 'wall' ? costOf(type) + Math.floor(copies(type) / (RISE.wallEvery || 12))
    : costOf(type) * (1 + 2 * (RISE[type] || 0) * Math.sqrt(copies(type)))));
  const buyCost = type => newCost(type) * (S.mode === 'packs' && !BUILDINGS[type].tech ? PACK_RULES.premium : 1);
  // hands: every build or upgrade takes a free pair of hands for the rest of the day (CUT: scrap is the only limit)
  const handsMax = () => (CUT.hands ? 99 : HANDS.base + Math.ceil(Math.sqrt(pop())) + Math.floor(pop() / 8) + S.handsExtra + (S.legacy.hands || 0) + (S.landmarks || []).reduce((a, l) => a + (l.owned && LANDMARKS[l.kind].hands || 0), 0) + (G.story ? G.story.bonus.hands() : 0));
  const handsFree = () => (CUT.hands ? 99 : Math.max(0, handsMax() - S.handsUsed));
  const useHand = () => { if (CUT.hands) return true; if (handsFree() < 1) return fail('No free hands today. More people (homes) means more hands; they rest at dawn.'); S.handsUsed++; return true; };
  const upCostOf = (b) => { const c0 = costOf(b.type, b.level + 1); return S.halfUpgrade ? Math.max(1, Math.ceil(c0 / 2)) : c0; };
  const maxHpOf = (type, level) => Math.round(BUILDINGS[type].hp[level - 1] * (1 + S.P.allHp + (type === 'wall' ? S.P.wallHp : 0)));
  const keepMaxHp = () => Math.round((KEEP.hp[keep.level - 1] + S.P.keepHp) * S.P.keepHpMult);
  // ---------- power (CUT: only a "Lights Out" season rule brings it back) ----------
  const powerLive = () => !CUT.power || rule('lightsOut');
  const powerDraw = b => (powerLive() ? ((POWER.draw[b.type] || [])[b.level - 1] || 0) : 0);
  const powerIn = () => POWER.keep[keep.level - 1] + S.buildings.reduce((a, b) => a + (b.type === 'generator' && !b.ruined ? BUILDINGS.generator.power[b.level - 1] : 0), 0) + (S.landmarks || []).reduce((a, l) => a + (l.owned && LANDMARKS[l.kind].power || 0), 0) + (G.story ? G.story.bonus.power() : 0);
  const powerOut = () => S.buildings.reduce((a, b) => a + (b.ruined ? 0 : powerDraw(b)), 0);
  const powered = b => powerDraw(b) === 0 || !S.blackout;
  function checkPower() {
    const out = powerLive() && powerIn() < powerOut();
    if (!out && S.feat.power && powerOut() > 0 && powerIn() - powerOut() < 2 && !S.powerWarned) { S.powerWarned = true; toast('[Warning: power] Only **' + (powerIn() - powerOut()) + '** power to spare. Lose a generator and everything powered switches off.', 'bad'); }
    if (powerIn() - powerOut() >= 3) S.powerWarned = false;
    if (out !== S.blackout) { S.blackout = out; ev(out ? 'blackout' : 'powerBack'); toast(out ? `POWER DOWN. Your powered buildings switched off: ${powerOut()} needed, ${powerIn()} made. Build a generator or pull something down.` : 'Power restored. The lights come back on.', out ? 'bad' : 'good'); }
  }
  const houseGold = b => Math.round(BUILDINGS.house.gold[b.level - 1] * G.DIFF.eco) + S.P.houseGold + (G.strongPay ? G.strongPay(b) : 0) /* [gemini3] compact */ + (hasTech('market') ? 1 : 0) + (mastery('tycoon') ? 1 : 0) + (has('guarded') && near(b, 'tower', 6) ? 2 : 0) + (combo('guarded', 'bastion') && near(b, 'wall', 3) ? 1 : 0);
  const farmFood = b => Math.round((BUILDINGS.farm.food[b.level - 1] * G.DIFF.eco + S.P.farmFood + (G.strongPay ? G.strongPay(b) : 0) /* [gemini3] compact */ + (b.nearWater ? 1 : 0)) * (rule('winter') ? 0.67 : 1));
  const prosper = () => (mastery('prosperity') ? 1.3 : 1);
  const upkeep = () => Math.max(0, S.buildings.reduce((a, b) => a + ((BUILDINGS[b.type].upkeep || [])[b.level - 1] || 0), 0) - S.P.upkeepCut * 2);
  const foodNeed = () => Math.ceil(pop() * START.foodPerCitizen * (rule('hunger') ? 1.3 : 1));
  /** what the next town hall level still needs besides scrap (empty = ready) */
  // the hall is gated on food INCOME (the town can feed itself with room to spare) and people, never on food in store
  const foodPerDawn = () => Math.round(S.buildings.reduce((a, b) => a + (b.type === 'farm' && !b.ruined ? farmFood(b) : 0), 0) * prosper()) + S.landmarks.reduce((a, l) => a + (l.owned ? LANDMARKS[l.kind].food || 0 : 0), 0);
  function keepNeeds() {
    const n = (G.keepNeed && G.keepNeed(keep.level)) || KEEP.need[keep.level]; if (!n) return [];   // [gemini3] maturity gates
    const out = G.maturityNeeds ? G.maturityNeeds(n) : [];   // [gemini3]
    if (n.foodNet !== undefined && foodPerDawn() - foodNeed() < n.foodNet) out.push(`food income ${foodNeed() + n.foodNet} a day (now ${foodPerDawn()})`);
    if (n.food && S.food < n.food) out.push(`${n.food} food in store`);
    if (pop() < n.people) out.push(`${n.people} people`);
    if (n.won && S.stats.regionsClaimed + (S.stats.sites || 0) < n.won) out.push('an Inferno Nest burned or a site claimed');
    return out;
  }

  // the town learns to build by itself once it is established
  function checkForeman() {
    if (S.foreman || keep.level < FOREMAN.keep || S.buildings.filter(b => b.type !== 'wall').length < FOREMAN.buildings) return;
    S.foreman = true; ev('skill', { id: 'foreman' });
    toast('[Skill acquired: Foreman] Your people can **build by themselves**. Switch it on in the **build menu**.', 'win');
  }

  function dawn() {
    S.phase = 'day'; S.dawns++; S.handsUsed = 0; S.chestsToday = 0;
    // [income] scrap and food came in all day and night (sim/income.js): dawn only closes the cycle for the ledger.
    // What stays a dawn lump: the salvage hauled off the night's dead, the crew's cook, a broadcast's survivor.
    const inc = G.incomeDawn();
    let foodIn = inc.food;
    const need = inc.ate, fed = inc.fed;
    if (!CUT.crew) { const cf = G.sc.dawnFood(); S.food += cf; foodIn += cf; }
    const upk = upkeep();
    const salv = Math.min(8 + S.night, Math.floor(S.salvage || 0)); S.salvage = 0;   // what the town can haul in a morning
    for (const l of S.landmarks) if (l.owned) { const L = LANDMARKS[l.kind]; if (L.reveal && S.night % 2 === 0) { S.survivors++; toast('A survivor followed the broadcast to your gates.', 'good'); } }
    S.gold += salv; S.stats.goldEarned += salv;
    const goldIn = inc.gold + salv;
    let claimedNow = null, nestPick = false;
    if (S.purge !== null) { claimedNow = S.purge; G.burnHive(S.purge); nestPick = true; S.purge = null; }
    // Merchant Guild: free tower upgrades, by the same rules as any upgrade (hall level, Workshop, power)
    if (has('guild')) {
      let free = Math.floor(S.buildings.filter(b => b.type === 'house' && !b.ruined).length / 4), done = 0;
      while (free-- > 0) { const t = S.buildings.filter(b => b.type === 'tower' && !G.raiseBlock(b)).sort((a, b) => a.level - b.level || a.id - b.id)[0]; if (!t) break; G.raise(t); done++; }
      if (done) toast(`The guild raises ${done === 1 ? 'a tower' : `${done} towers`} for free.`, 'good');
    }
    // the ledger: what the night took, said once, at dawn
    const fellB = S.cur.fellB || [], roseB = S.cur.rose || [], held = Math.max(0, Math.round(100 * (S.cur.keepMin ?? keep.hp / keep.maxHp)));
    closeLog({ goldIn, foodIn, foodNeed: need, fed: +fed.toFixed(2), claimedNow, held });
    // ruins stay ruins until you rebuild them by hand (api.rebuild): only standing buildings mend overnight
    for (const b of S.buildings) { if (!b.ruined) b.hp = b.maxHp; b.fell = false; }
    dropLive();
    if (S.hero.dead) G.heroBack();   // the dead hero is back at dawn at the latest
    { const left = S.buildings.filter(b => b.ruined); S.ledger = { night: S.night, fell: fellB, rose: roseB, held, people: roseB.reduce((a, r) => a + r.people, 0), ruins: left.length, rebuildAll: left.reduce((a, b) => a + G.rebuildCost(b), 0), kills: Object.values(S.cur.kills || {}).reduce((a, b) => a + b, 0), heroDowns: S.cur.heroDeaths || 0, ...(G.road ? G.road.missions.report() : {}), ...(G.folkLedger ? G.folkLedger() : {}), ...(G.settleLedger ? G.settleLedger() : {}) };   // [econ3] the Settlement report   // [folk] what the folk kept and built
      ev('ledger', S.ledger); }
    keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * 0.25);
    S.hero.hp = S.hero.maxHp; S.hero.guardT = 0;
    if (S.P.kingpin && S.allies.length) { earn(S.allies.length); for (const a of S.allies) a.hp = a.maxHp; }
    if (S.allies.length && !S.P.loyal) { for (const a of S.allies.filter(q => !q.comp)) ev('allyGone', { id: a.id }); S.allies = S.allies.filter(q => q.comp); }
    for (const a of S.allies) if (a.comp) a.hp = a.maxHp;
    if (G.story) for (const n of S.story.npcs) if (n.withHero && n.alive && n.joined && !S.allies.some(a => a.comp === n.id)) G.spawnCompanion(n);
    S.purses = [];
    if (!CUT.crew) G.sc.dawn(isBloodMoon(S.night));
    S.night++; newLog();
    S.noiseChoice = Math.abs(S.noiseChoice || 0) < 1 ? 0 : S.noiseChoice * (1 - NOISE.choiceFade);   // a choice's noise holds for nights, fading a fifth each dawn
    S.weather = G.rollWeather(S.night); if (S.weather !== 'clear' && !CUT.weather) toast(`Tonight: ${G.W8().name.toLowerCase()}. ${G.W8().desc}`, G.W8().kind);
    G.planDay(S.night); G.spawnRoamers(); G.spawnAnimals(); G.scatterPickups(G.PICKUP.perDawn);
    for (const d of [...S.drops]) if (--d.ttl <= 0) { S.drops.splice(S.drops.indexOf(d), 1); ev('dropGone', { id: d.id }); }
    { const was = S.night - 1; if (isBloodMoon(was)) G.dropSupply('The Flare Night has set.'); else if (claimedNow !== null) G.dropSupply('With the Inferno Nest burned,'); else if (was >= 3 && rng.next() < 0.2) G.dropSupply('At first light,'); }
    S.reroll.cost = REROLL.base;
    const want = [];
    if (owns('christ') && S.night % 3 === 0) want.push('chest');   // no dawn blessings: they come from hives (epic loot) and key levels
    if (nestPick) want.push('nest');
    for (let k = 0; k < S.chestsHeld; k++) want.push('chest');
    const keepPicks = Math.max(1, PICKS_PER_DAWN), extra = want.slice(keepPicks).filter(x => x === 'chest').length;
    S.picks.push(...want.slice(0, keepPicks)); S.chestsHeld = 0;
    if (extra) { earn(extra * 5); toast(`${extra} more ${extra === 1 ? 'chest' : 'chests'} sold for ${extra * 5} gold: two blessings a dawn is the most.`, 'good'); }
    syncPicks(); G.rollOffer();
    rollPacks();
    if (S.sawBlackout && !S.blackout) G.story.grant('ironGrid');
    G.checkFeatures();
    if (S.night - 1 === seasonEnd(S.season.n)) { if (!S.season.won) G.finale(false); G.startSeason(S.season.n + 1); }
    G.story.dawn();
    if (G.inferno) G.inferno.dawn();   // [nest3] hotter nests, embers before a nest wakes
    if (G.HC.trader && !CUT.trader) S.trade = { deals: rng.shuffle([...TRADES]).slice(0, 3).map(t => t.id), done: false };
    S.stats.peakPop = Math.max(S.stats.peakPop, pop());
    ev('dawn', { goldIn, foodIn, need, fed });
    toast(`Dawn. ${goldIn >= 0 ? '+' : ''}${goldIn} scrap${salv ? ` (${salv} salvaged from the dead)` : ''}${upk ? ` after ${upk} tower upkeep` : ''}, +${foodIn} food. Citizens ate ${need}.`, 'good');   // (the HUD reads this line: it came in since yesterday)
    if (fed < 0.99) toast(`Not enough food. Houses earned ${Math.round(fed * 100)}% of their scrap.`, 'bad');
    if (isBloodMoon(S.night + 1)) toast(`[Warning: red sky] The sky is turning red. **Tomorrow night is a Flare Night**${S.unique && !S.unique.slain && S.unique.night === S.night + 1 ? `, and ${S.unique.name} comes with it` : ''}. Build up today and tomorrow.`, 'win');
  }

  /** the run ends: the hall fell, or (contracts.js) a lost contract ends it with a name. Closes the run log. */
  function endRun(won, reason) {
    if (S.over) return false;
    S.over = true; S.won = !!won; S.phase = 'over'; if (reason) S.endReason = reason; closeLog({ result: won ? 'won' : 'lost', reason: reason || (won ? 'won' : 'hall') });
    S.stats.nights = S.night - 1; S.stats.peakPop = Math.max(S.stats.peakPop, pop());
    ev('over', { won: !!won, night: S.night, reason: reason || null });
    return true;
  }
  function trade(id) {
    if (!S.trade || S.trade.done || !S.trade.deals.includes(id)) return false;
    const t = TRADES.find(x => x.id === id);
    if (t.gold && S.gold < t.gold) return fail(`That costs ${t.gold} scrap.`);
    if (t.food && S.food < t.food) return fail(`You need ${t.food} food.`);
    if (t.gold) { S.gold -= t.gold; S.stats.goldSpent += t.gold; }
    if (id === 'reroll') S.reroll.free++;
    if (id === 'pick') { S.picks.push('dawn'); syncPicks(); if (S.picks.length === 1) G.rollOffer(); }
    if (id === 'sellfood') { S.food -= t.food; earn(t.give); }
    if (id === 'halfup') S.halfUpgrade = true;
    if (id === 'mend') keep.hp = Math.min(keep.maxHp, keep.hp + keep.maxHp * 0.25);
    S.trade.done = true; toast(`Deal: ${t.name.toLowerCase()}.`, 'good'); return true;
  }

  // ---------- building packs ----------
  function rollPacks() {
    if (S.mode !== 'packs') { S.packs = []; return; }
    const pool = PACKS.filter(p => p.from <= S.night);
    const pick = list => list[rng.weighted(list.map(p => p.weight))];
    const eco = pool.filter(p => p.kind !== 'def'), def = pool.filter(p => p.kind !== 'eco');
    let a = pick(eco), b = pick(def.filter(p => p.id !== a.id));
    if (rng.chance(0.25)) { const other = pool.filter(p => p.id !== a.id); b = pick(other); }
    S.packs = [a.id, b.id];
  }
  function choosePack(id) {
    if (!S.packs.includes(id)) return fail('That pack is not on offer.');
    const pk = PACKS.find(p => p.id === id);
    for (const [t, n] of Object.entries(pk.items)) S.stock[t] = (S.stock[t] || 0) + n;
    S.packs = []; S.cur.pack = id; ev('pack', { id }); return true;
  }
  function rerollPacks() {
    if (!S.packs.length) return false;
    if (S.gold < PACK_RULES.reroll) return fail(`Other packs cost ${PACK_RULES.reroll} scrap.`);
    S.gold -= PACK_RULES.reroll; S.stats.goldSpent += PACK_RULES.reroll; rollPacks(); return true;
  }

  // ---------- run log ----------
  function townCounts() { const o = {}; for (const b of S.buildings) o[b.type] = (o[b.type] || 0) + b.level; o.keep = keep.level; return o; }
  function newLog() { S.cur = { night: S.night, goldStart: S.gold, spent: 0, built: [], upgraded: [], perks: [], dmg: {}, kills: {}, taken: {}, lost: [], risen: 0, heroDeaths: 0 }; }
  function closeLog(extra) {
    const l = S.cur; if (!l || l.closed) return; l.closed = true;
    Object.assign(l, { keepEnd: Math.max(0, Math.ceil(keep.hp)), keepMax: keep.maxHp, seconds: Math.round(S.qT) }, extra);
    S.log.push(l);
  }
  return { costOf, newCost, buyCost, handsMax, handsFree, useHand, upCostOf, maxHpOf, keepMaxHp, powerLive, powerIn, powerOut, powered, checkPower, houseGold, farmFood, prosper, upkeep, foodNeed, foodPerDawn, keepNeeds, checkForeman, dawn, endRun, trade, rollPacks, choosePack, rerollPacks, townCounts, newLog };
}
