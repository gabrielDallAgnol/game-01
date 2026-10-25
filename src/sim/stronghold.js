// [gemini3] Small and strong: the Camp's maturity gates, the compact-stronghold bonus, the garrison and the Camp
// captain (numbers and the why: content/stronghold.js). Hooks, all `[gemini3]`: economy.js keepNeeds / houseGold /
// farmFood, combat.js towerStats / crewing / damageBuilding. Each hook reads G.x at call time, so this module is
// appended to MODULES like any other and the old rule comes back with the flags off.
import { MATURITY, COMPACT, GARRISON, CAPTAIN } from '../content/stronghold.js';
import { PRESENCE, TENSION } from './state.js';

export function createStronghold(G) {
  const { S, c, keep } = G;
  const standing = () => S.buildings.filter(b => b.type !== 'wall' && !b.ruined && b.built >= 1);
  // ---------- maturity ----------
  /** what the next Camp level asks for (economy.keepNeeds reads this instead of KEEP.need) */
  const keepNeed = level => (MATURITY.on ? MATURITY.need[level] : null);
  /** the extra needs: a day, standing buildings, level 2 buildings (the people, food and win checks stay economy's) */
  function maturityNeeds(n) {
    const out = [];
    if (!MATURITY.on || !n) return out;
    if (n.minDay && S.night < n.minDay) out.push(`day ${n.minDay} (now day ${S.night})`);
    const st = standing();
    if (n.buildings && st.length < n.buildings) out.push(`${n.buildings} standing buildings (now ${st.length})`);
    if (n.lv2) { const k = st.filter(b => b.level >= 2).length; if (k < n.lv2) out.push(`${n.lv2} buildings at level 2 (now ${k})`); }
    return out;
  }
  // ---------- compact stronghold ----------
  let ck = '', cv = false;
  function compact() {
    if (!COMPACT.on) return false;
    const key = `${S.occVersion || 0}|${S.buildings.length}|${Math.floor(S.time)}`; if (key === ck) return cv;   // (re-counted once a second: a finished build does not bump occVersion)
    const n = standing().length; ck = key; cv = n > 0 && n <= COMPACT.max; return cv;
  }
  const strongPay = b => (!compact() ? 0 : b.type === 'farm' ? COMPACT.farmFood : b.type === 'house' && b.level >= 2 ? COMPACT.homeGold : 0);
  const strongTaken = b => (b.type !== 'keep' && compact() ? COMPACT.taken : 1);
  // ---------- garrison and captain ----------
  const garrison = () => GARRISON[keep.level - 1] || 0;
  const captainHome = () => CAPTAIN.on && !!(S.story && S.story.npcs && S.story.npcs.some(n => n.joined && n.alive && !n.withHero));
  /** a tower's share of the compact bonus and of the captain's presence: { dmg, rate, range } multipliers/adds */
  function towerHold(b, heroNear) {
    const out = { dmg: compact() ? COMPACT.towerDmg : 1, rate: 1, range: 0, captain: false };
    if (!heroNear && captainHome() && Math.hypot(b.x - c, b.y - c) < PRESENCE.r + CAPTAIN.pad) {
      out.captain = true; out.rate = 1 + (PRESENCE.rate - 1) * CAPTAIN.share; out.range = PRESENCE.range * CAPTAIN.share;
      if (S.hero.dead) out.rate /= TENSION.downRate;   // the captain keeps heart in the towers while the hero is down
    }
    return out;
  }
  Object.assign(G.g3api || (G.g3api = {}), { compact, garrison, captainHome, strongInfo: () => ({ compact: compact(), n: standing().length, max: COMPACT.max, garrison: garrison(), captain: captainHome() }) });
  return { keepNeed, maturityNeeds, compact, strongPay, strongTaken, garrison, towerHold };
}
