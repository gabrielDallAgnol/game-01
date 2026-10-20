// The balance model: no randomness, no combat, only the game's own tables and formulas.
// A "sensible town" follows fixed rules each day (feed everyone, raise the town hall as soon as it is earned,
// keep enough towers for tonight, put the rest into homes) and the model compares what it can deal against
// what each night throws at it. Used by test/model.test.mjs to catch nights that become unwinnable or trivial.
//   node tools/model.mjs [difficulty] [nights]
import { BUILDINGS, KEEP, START, RISE, HANDS, POWER, MAX_LEVEL } from '../src/content/buildings.js';
import { MOBS, WAVES, TIDE } from '../src/content/mobs.js';
import { HEROES } from '../src/content/heroes.js';
import { DIFFICULTY, LEVEL, CREW_NEED, NOISE, CUT, PRESENCE } from '../src/sim/game.js';
const unlocked = n => Object.entries(MOBS).filter(([, m]) => m.weight > 0 && m.from <= n);
function hpPerBudget(n) { const u = unlocked(n), w = u.reduce((a, [, m]) => a + m.weight, 0); return (u.reduce((a, [, m]) => a + m.weight * m.hp, 0) / w) / (u.reduce((a, [, m]) => a + m.weight * m.cost, 0) / w); }
const isMoon = n => n % WAVES.bloodMoonEvery === 0;

/** play `nights` days by the rules; returns one row per night */
export function model(difficulty = 'survivor', nights = 20) {
  const D = DIFFICULTY[difficulty];
  const T = { gold: START.gold, food: START.food, survivors: START.survivors, keep: 1, houses: [], farms: [], towers: [], xp: 0, lvl: 1, wins: 0 };
  const pop = () => T.survivors + T.houses.reduce((a, l) => a + BUILDINGS.house.pop[l - 1], 0);
  // the game's rising costs: towers climb in a straight line, homes and farms climb and flatten
  const cost = (type, have) => Math.round(BUILDINGS[type].cost[0] * (type === 'tower' ? 1 + RISE.tower * have : 1 + 2 * (RISE[type] || 0) * Math.sqrt(have)));
  const rows = [];
  for (let n = 1; n <= nights; n++) {
    // ---- the day: hands, then the rules in order ----
    let hands = CUT.hands ? Infinity : HANDS.base + Math.ceil(Math.sqrt(pop())) + Math.floor(pop() / 12);
    const spend = c => { if (hands < 1 || T.gold < c) return false; T.gold -= c; hands--; return true; };
    const foodIn = () => T.farms.reduce((a, l) => a + Math.round(BUILDINGS.farm.food[l - 1] * D.eco), 0);
    // 1. the town hall as soon as it is earned (scrap, people, a food income with room to spare, a victory for level 3)
    const need = KEEP.need[T.keep];
    if (T.keep < 3 && need && foodIn() - pop() >= (need.foodNet || 0) && T.food >= (need.food || 0) && pop() >= need.people && (!need.won || T.wins >= need.won) && spend(KEEP.cost[T.keep])) { T.food -= need.food || 0; T.keep++; }
    // 2. feed everyone, with the room to spare the next hall asks for
    const spare = T.keep < 3 ? Math.max(1, (KEEP.need[T.keep] || {}).foodNet || 0) : 1;
    while (foodIn() < pop() + spare && spend(cost('farm', T.farms.length))) T.farms.push(1);
    // 3. towers: a few for coverage, then the people the next hall asks for, then the rest of tonight's towers and upgrades
    const wantTowers = Math.min(12, 2 + Math.ceil(n * 0.6)), crewFree = () => pop() - T.towers.reduce((a, l) => a + CREW_NEED[l - 1], 0);
    const addTowers = upTo => { while (T.towers.length < upTo && crewFree() >= 1 && spend(cost('tower', T.towers.length))) T.towers.push(1); };
    addTowers(Math.min(wantTowers, 3));
    const hallNeed = T.keep < 3 ? KEEP.need[T.keep] : null;
    while (hallNeed && pop() < hallNeed.people && foodIn() > pop() && spend(cost('house', T.houses.length))) T.houses.push(1);
    addTowers(wantTowers);
    for (let k = 0; k < T.towers.length; k++) if (T.towers[k] < T.keep && T.towers[k] < MAX_LEVEL && crewFree() >= 1 && spend(BUILDINGS.tower.cost[T.towers[k]])) T.towers[k]++;
    // 4. the rest into homes (income and people), saving for the hall once everything else it asks for is there
    const hallReady = hallNeed && foodIn() - pop() >= (hallNeed.foodNet || 0) && pop() >= hallNeed.people && (!hallNeed.won || T.wins >= hallNeed.won);
    const reserve = hallReady ? KEEP.cost[T.keep] : 0;
    while (T.gold - cost('house', T.houses.length) >= reserve && spend(cost('house', T.houses.length))) T.houses.push(1);
    for (let k = 0; k < T.houses.length; k++) if (T.houses[k] < Math.min(2, T.keep) && T.gold - BUILDINGS.house.cost[T.houses[k]] >= reserve && spend(BUILDINGS.house.cost[T.houses[k]])) T.houses[k]++;
    // a hive or a site falls about every 5 nights for a town that pushes out
    if (n % 5 === 0) T.wins++;

    // ---- the night: what comes, and what the town deals ----
    // noise: loud choices only (level 2–3 towers here; the model builds no market or workshop)
    const noise = Math.min(100, T.towers.reduce((a, l) => a + NOISE.tower[l - 1], 0));
    const draw = 1 + NOISE.mult * noise / 100;
    const budget = D.threat * WAVES.budget(n) * (TIDE.opening[n] ?? 1) * draw * (isMoon(n) ? WAVES.bloodMoonMult(n) : 1) * (n > 1 && isMoon(n - 1) ? 0.75 : 1);
    const hs = WAVES.hpScale(n);
    let waveHp = budget * hpPerBudget(n) * hs; if (isMoon(n)) waveHp += (n < 15 ? MOBS.guardian.hp : MOBS.gravelord.hp * Math.floor((n - 5) / 10)) * hs;
    // about a third of the towers fight next to the hero (presence: +30% rate)
    const towerDps = T.towers.reduce((a, l) => a + BUILDINGS.tower.dmg[l - 1] / BUILDINGS.tower.rate[l - 1], 0) * (1 + (PRESENCE.rate - 1) / 3);
    const keepDps = KEEP.dmg[T.keep - 1] / KEEP.rate * KEEP.shots[T.keep - 1];
    const H = HEROES.survivor, heroDps = H.attack.dmg * (1 + LEVEL.dmg * (T.lvl - 1)) / H.attack.rate;
    const dealt = (towerDps + keepDps + heroDps * 0.8) * WAVES.duration(n) * 1.6;
    const ratio = waveHp / Math.max(1, dealt);
    // ---- dawn: income, food, xp ----
    const fed = Math.min(1, (T.food + foodIn()) / Math.max(1, pop()));
    T.food = Math.max(0, T.food + foodIn() - pop());
    const kills = Math.round(budget / 1.2);
    const income = Math.round(START.baseIncome * D.eco) + Math.round(T.houses.reduce((a, l) => a + BUILDINGS.house.gold[l - 1] * D.eco, 0) * fed) + Math.min(8 + n, Math.floor(kills * START.salvage)) - T.towers.reduce((a, l) => a + (BUILDINGS.tower.upkeep[l - 1] || 0), 0);
    T.gold += income;
    T.xp += kills * 0.4 + 12; while (T.xp >= LEVEL.xp(T.lvl)) { T.xp -= LEVEL.xp(T.lvl); T.lvl++; }
    rows.push({ night: n, noise, draw: +draw.toFixed(2), keep: T.keep, pop: pop(), homes: T.houses.length, farms: T.farms.length, towers: T.towers.join(''), income, dps: +(towerDps + keepDps + heroDps).toFixed(1), waveHp: Math.round(waveHp), ratio: +ratio.toFixed(2), lvl: T.lvl, moon: isMoon(n) });
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = model(process.argv[2] || 'survivor', +(process.argv[3] || 20));
  console.log('night keep pop homes farms towers      income  dps   waveHP ratio lvl');
  for (const r of rows) console.log(`${String(r.night).padStart(5)}${r.moon ? '☾' : ' '} ${r.keep}   ${String(r.pop).padStart(3)} ${String(r.homes).padStart(5)} ${String(r.farms).padStart(5)} ${r.towers.padEnd(12)} ${String(r.income).padStart(6)} ${String(r.dps).padStart(5)} ${String(r.waveHp).padStart(8)} ${String(r.ratio).padStart(5)} ${r.lvl}`);
}
