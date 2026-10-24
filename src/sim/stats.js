// [hero3] The Thermal Pioneer's stats: STR / AGI / INT / GOV and the points you raise them with (3 at the awakening,
// 3 a level, +1 a stat tome via G.addStatPoints), what each point gives (the hooks the rule modules call:
// attrDmg, attrRate, attrSpeed, attrHp, attrHive, attrHurt, attrHit, attrWard, attrTower), which abilities your
// stats unlock (content/abilities.js; sim/powers.js runs them), the title your build earns, the bots' spread,
// and saving (S.attr rides in the dawn snapshot as `hero3`, wrapped here: no edit to save.js).
// Off (STATS_FLAG.on = false): every hook is neutral and the old class picks run as before.
import { AUTO_SPREAD, HYBRID_AT, POINTS, STATS, STATS_FLAG, STAT_IDS, THRESHOLDS, TITLES_PAIR, TITLES_SOLO, TITLE_BALANCED, TITLE_START } from '../content/stats.js';
import { ABILITIES, ABILITY_ORDER } from '../content/abilities.js';
import { BUILDINGS } from '../content/buildings.js';

export const HERO3_SAVE_V = 1;

/** the abilities a stat block unlocks, in display order (pure: the UI previews with it) */
export function unlockedBy(a) {
  return ABILITY_ORDER.filter(id => { const A = ABILITIES[id]; return A.pair ? A.pair.every(s => (a[s] || 0) >= HYBRID_AT) : (a[A.stat] || 0) >= A.at; });
}
/** rank of a line ability (1, or 2 at the second threshold) */
export const rankOf = (a, id) => { const A = ABILITIES[id]; return A && A.stat && (a[A.stat] || 0) >= THRESHOLDS[1] && A.rank2 ? 2 : 1; };
/** the ability's numbers at its rank (rank 2 overrides) */
export const defOf = (a, id) => { const A = ABILITIES[id]; return rankOf(a, id) === 2 ? { ...A, ...A.rank2 } : A; };
/** the title of a build: one leading stat, a leading pair, or a balanced hand */
export function titleOf(a) {
  const tot = STAT_IDS.reduce((n, s) => n + (a[s] || 0), 0); if (tot < 12) return TITLE_START;
  const tier = tot >= 90 ? 2 : tot >= 45 ? 1 : 0, rank = STAT_IDS.slice().sort((p, q) => (a[q] || 0) - (a[p] || 0) || STAT_IDS.indexOf(p) - STAT_IDS.indexOf(q));
  const [s1, s2] = rank;
  if (a[s1] / tot >= 0.6) return TITLES_SOLO[s1][tier];
  if (a[s1] / tot >= 0.3 && a[s2] / tot >= 0.3) return TITLES_PAIR[[s1, s2].sort().join('+')];
  if (a[s1] / tot >= 0.45) return TITLES_SOLO[s1][tier];
  return TITLE_BALANCED[tier];
}

export function createStats(G) {
  const { S, ev, toast } = G;
  const on = () => STATS_FLAG.on;
  const fresh = () => ({ str: 0, agi: 0, int: 0, gov: 0, pts: on() ? POINTS.start : 0, lvlSeen: S.lvl || 1, tomes: 0, dodge: 0, auto: false, told: [], title: TITLE_START, incAcc: 0, buildAcc: 0 });
  S.attr = fresh();
  const A = () => S.attr;
  const per = (s, k) => (A()[s] || 0) * STATS[s].per[k];

  // ---------- points ----------
  /** stat points from anywhere (a stat tome, a story reward): why is the System's line */
  function addStatPoints(n, why) {
    if (!on() || !(n > 0)) return false;
    A().pts += n; if (why === 'tome') A().tomes += n;
    ev('statPoints', { n, why: why || '' }); toast(`[+${n} Stat ${n === 1 ? 'Point' : 'Points'}]${why && why !== 'level' ? ` ${why === 'tome' ? 'A stat tome.' : why}` : ''} Open your Status to spend ${n === 1 ? 'it' : 'them'}.`, 'good');
    return true;
  }
  /** spend n points on a stat: the abilities it crosses into unlock, the title follows the build */
  function spendStat(id, n = 1) {
    const a = A(); n = Math.floor(n);
    if (!on() || !STATS[id] || n < 1 || a.pts < n) return false;
    a.pts -= n; a[id] += n; settle(); return true;
  }
  /** after any change: new abilities are announced once, the title is re-read, max health follows STR */
  function settle() {
    const a = A();
    for (const id of unlockedBy(a)) if (!a.told.includes(id)) { a.told.push(id); const D = ABILITIES[id]; ev('statUnlock', { id, name: D.name, icon: D.icon, active: D.kind === 'active' }); toast(`[Skill unlocked: ${D.name}] ${D.how}`, 'good'); }
    for (const id of unlockedBy(a)) { const k = `${id}#2`; if (rankOf(a, id) === 2 && !a.told.includes(k)) { a.told.push(k); const D = defOf(a, id); ev('statUnlock', { id, name: D.name, icon: D.icon, rank: 2, active: D.kind === 'active' }); toast(`[Skill evolved: ${ABILITIES[id].name} → ${D.name}]`, 'good'); } }
    const t = titleOf(a); if (t !== a.title) { a.title = t; ev('statTitle', { title: t }); toast(`[Title: ${t}]`, 'good'); }
    G.refreshMax();
  }
  /** the bots' and the autopilot's spread: each point to the stat furthest below its share */
  function autoSpend() {
    const a = A(); if (!on()) return 0; let k = 0;
    while (a.pts > 0) {
      const tot = STAT_IDS.reduce((n, s) => n + a[s], 0) + 1;
      const s = STAT_IDS.slice().sort((p, q) => (a[p] - AUTO_SPREAD[p] * tot) - (a[q] - AUTO_SPREAD[q] * tot) || STAT_IDS.indexOf(p) - STAT_IDS.indexOf(q))[0];
      a.pts--; a[s]++; k++;
    }
    if (k) settle(); return k;
  }
  const statUnlocked = () => (on() ? unlockedBy(A()) : []);
  const hasAb = id => on() && unlockedBy(A()).includes(id);

  // ---------- once a step: levels pay points, GOV runs the town a little better ----------
  function stepStats(dt) {
    if (!on()) return;
    const a = A();
    if (S.lvl > a.lvlSeen) { const n = POINTS.perLevel * (S.lvl - a.lvlSeen); a.lvlSeen = S.lvl; addStatPoints(n, 'level'); }
    if ((a.auto || S.autopilot) && a.pts > 0) autoSpend();
    if (a.gov > 0) {
      // income: a share of the trickle on top (sim/income.js keeps its own books)
      if (G.incomeRate) { const r = G.incomeRate(); a.incAcc += Math.max(0, r.gold || 0) * per('gov', 'income') * dt; while (a.incAcc >= 1) { a.incAcc -= 1; G.earn(1); } }
      // build speed: the builders work a share faster (game.js finishes the building)
      const k = per('gov', 'build');
      for (const b of S.buildings) if (b.built < 1 && !b.ruined && BUILDINGS[b.type] && BUILDINGS[b.type].buildTime) b.built = Math.min(0.999, b.built + dt / BUILDINGS[b.type].buildTime * k);
    }
    if (G.stepPowers) G.stepPowers(dt);
  }

  // ---------- the hooks the rule modules call (neutral when off) ----------
  const attrDmg = () => (on() ? (1 + per('str', 'dmg')) * (G.powDmg ? G.powDmg() : 1) : 1);
  const attrRate = () => (on() ? (1 + per('agi', 'rate')) * (G.powRate ? G.powRate() : 1) : 1);
  const attrSpeed = () => (on() ? (1 + per('agi', 'speed')) * (G.powSpeed ? G.powSpeed() : 1) : 1);
  const attrHp = () => (on() ? per('str', 'hp') : 0);
  const attrHive = () => (on() ? 1 + per('str', 'hive') : 1);
  /** a hit on the hero: AGI's dodge (every 1/dodge-th hit misses, no dice), then the powers (Unbreakable) */
  function attrHurt(d) {
    if (!on() || d <= 0) return d; const a = A();
    a.dodge += Math.min(STATS.agi.dodgeMax, per('agi', 'dodge'));
    if (a.dodge >= 1) { a.dodge -= 1; ev('dodge', {}); return 0; }
    return G.powHurt ? G.powHurt(d) : d;
  }
  /** any hit on a dead: GOV makes your allies hit harder; the powers add marks and stealth */
  function attrHit(m, src) {
    if (!on()) return 1;
    const ally = src === 'merc' || src === 'ally' || src === 'crew';
    return (ally ? 1 + per('gov', 'ally') : 1) * (G.powHit ? G.powHit(m, src, ally) : 1);
  }
  const attrWard = b => (on() && G.powWard ? G.powWard(b) : 1);
  /** a tower's rate divisor: INT near the hero, Rally Cry, Skirmish Commander */
  const attrTower = (b, near) => (on() ? (near ? 1 + per('int', 'tower') : 1) * (G.powTower ? G.powTower(b, near) : 1) : 1);
  /** INT: what every active hits for (×) and how much of its cooldown is cut */
  const abilityPower = () => 1 + (on() ? per('int', 'power') : 0);
  const cdCut = () => 1 - (on() ? Math.min(STATS.int.cdMax, per('int', 'cd')) : 0);
  /** class picks are off while the stats are on (hero.js checkEvolution asks) */
  const classPicksOff = () => on();

  /** what the Status window shows */
  function statsInfo() {
    const a = A();
    return { on: on(), pts: a.pts, title: a.title, tomes: a.tomes, auto: a.auto, stats: STAT_IDS.map(s => ({ id: s, name: STATS[s].name, long: STATS[s].long, color: STATS[s].color, icon: STATS[s].icon, v: a[s], lines: STATS[s].lines(a[s]) })),
      abilities: ABILITY_ORDER.map(id => { const D = ABILITIES[id], got = unlockedBy(a).includes(id), r = got ? rankOf(a, id) : 0, cur = got ? defOf(a, id) : D;
        return { id, name: cur.name, base: D.name, icon: D.icon, kind: D.kind, stat: D.stat || null, pair: D.pair || null, at: D.at || HYBRID_AT, got, rank: r, hasRank2: !!D.rank2, how: D.how, how2: D.how2 || '' }; }) };
  }

  // ---------- saving ----------
  const snap0 = G.snapshot, restore0 = G.restoreSnap;
  const snapshot = () => { const o = snap0(); if (o) { const a = A(); o.hero3 = { v: HERO3_SAVE_V, str: a.str, agi: a.agi, int: a.int, gov: a.gov, pts: a.pts, lvlSeen: a.lvlSeen, tomes: a.tomes, auto: a.auto, told: a.told.slice(), title: a.title, pow: G.powSave ? G.powSave() : null }; } return o; };
  const restoreSnap = R => {
    restore0(R);
    const H = R.hero3, a = S.attr = fresh();
    if (H && H.v >= 1) Object.assign(a, { str: H.str | 0, agi: H.agi | 0, int: H.int | 0, gov: H.gov | 0, pts: H.pts | 0, lvlSeen: H.lvlSeen || S.lvl, tomes: H.tomes | 0, auto: !!H.auto, told: H.told || [], title: H.title || TITLE_START });
    else if (on()) { a.pts = POINTS.start + POINTS.perLevel * ((S.lvl || 1) - 1); a.lvlSeen = S.lvl || 1; }   // a save from before the stats: every level it earned pays now
    if (G.powLoad) G.powLoad(H ? H.pow : null);
    a.title = titleOf(a); G.refreshMax(); S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp);
  };

  return { addStatPoints, spendStat, autoSpend, statUnlocked, hasAb, stepStats, attrDmg, attrRate, attrSpeed, attrHp, attrHive, attrHurt, attrHit, attrWard, attrTower, abilityPower, cdCut, classPicksOff, statsInfo, snapshot, restoreSnap, statsOn: on };
}
