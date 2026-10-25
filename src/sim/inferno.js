// Inferno Nests: every nest is a heat source (gas station, substation, boiler house, a burning tanker in the woods) and a
// permanent three-phase siege. The hive's hp is cut into three segments (slag barricade, feeder vents, the core); a
// segment you break stays broken (S.hiveDmg is saved, hp never heals), and each break throws a COUNTER-SURGE of Ash-Born
// at the hero (and a smaller one at the town). The last break snuffs the core: the burn flow in hives.js runs, and
// 'nestCleansed' fires (acts.js counts it, the land is yours = pacified). The building IS the hitbox: nest.body.
// Nothing here is random except the surge mix, drawn from its own stream. Off with CUT.inferno = false.
import { Rng, hashSeed } from './rng.js';
import { CUT } from './state.js';

export const INF = {
  phases: [
    { name: 'Slag barricade', frac: 0.28, next: 'Breaking it flings out a surge of Ash-Born and exposes the feeder vents.' },
    { name: 'Feeder vents', frac: 0.32, next: 'Cutting the vents throws a bigger surge and lays the core bare.' },
    { name: 'The core', frac: 0.40, next: 'Snuff the core: the regional fire dies and the road is cleansed.' },
  ],
  kinds: ['petrol', 'substation', 'boiler'], names: { petrol: 'Gas station', substation: 'Substation', boiler: 'Boiler house', tanker: 'Burning tanker' },
  surge: { hero: 3, heroPhase: 2, heroNight: 0.35, town: 0.45, cap: 16, hp: 0.08, grow: 4 },   // dead at the hero = hero + heroPhase × phase + heroNight × night; the town gets `town` of that; each `grow` nights left alone the nest burns hotter
  body: 2,   // half-width (cells) of the heat-source model on a city nest's ruin
};

export function createInferno(G) {
  const { S, map, ev, toast, seed } = G;
  const on = () => CUT.inferno !== false;
  const irng = new Rng(hashSeed(seed, 'inferno'));
  S.hiveDmg = S.hiveDmg || {}; S.inferno = S.inferno || {};
  // ---------- what each nest is: a heat source with a building for a body ----------
  for (const reg of map.regions) {
    const n = reg.nest; if (!n) continue;
    n.heat = reg.ring === 1 ? (n.body ? 'boiler' : 'tanker') : INF.kinds[reg.id % INF.kinds.length];
    if (!n.body && n.back && reg.ring >= 2) { const h = INF.body; n.vis = { x: n.x + n.back[0] * (0.5 + h), y: n.y + n.back[1] * (0.5 + h), half: h }; }   // a city nest is struck at the open face of its ruin (its door); the model stands on the ruin behind it
  }
  const heatOf = r => (map.regions[r].nest || {}).heat || 'boiler';
  const nameOf = r => INF.names[heatOf(r)] + ' nest';
  const st = r => S.inferno[r] || null;
  /** a nest's siege: null when it has no nest. segments with hp left, which one is up, what the next break does */
  function info(r) {
    const reg = map.regions[r]; if (!reg || !reg.nest) return null;
    const s = st(r), alive = !!S.nestAlive[r], max = s ? s.max : 0, dmg = S.hiveDmg[r] || 0;
    let cum = 0, ph = 0;
    const seg = INF.phases.map((P, i) => { const hp = s ? max * P.frac : 0, lo = cum; cum += hp; const broken = !alive || (s && i < s.ph); const left = !s ? 1 : broken ? 0 : Math.max(0, Math.min(1, (lo + hp - dmg) / hp)); return { name: P.name, broken, hp: Math.round(hp), frac: left, next: P.next }; });
    if (s) ph = alive ? s.ph : 3;
    return { region: r, kind: heatOf(r), name: nameOf(r), alive, phase: Math.min(2, ph), broken: ph, segments: seg, total: alive ? Math.max(0, 1 - dmg / (s ? max : Infinity)) : 0, heat: s ? s.heat : heatStage(), struck: !!s };
  }
  /** called the first time a nest is struck: fixes the hp of its three segments for good */
  function arm(r, base) { if (!S.inferno[r]) S.inferno[r] = { max: base, ph: 0, heat: heatStage() }; return S.inferno[r]; }
  const heatStage = () => Math.floor(Math.max(0, S.night - 1) / INF.surge.grow);
  const maxOf = (r, base) => (on() && st(r) ? st(r).max : base);
  /** a strike's damage can break one segment at most: the surplus is lost, so every segment fires its surge */
  function clamp(r, cur, d) {
    const s = st(r); if (!s) return d;
    if (d >= s.max - cur) return d;   // a scripted kill (tests, tools: a hit that is the whole hive) skips the siege; play never swings that hard
    let cum = 0; for (let i = 0; i <= s.ph && i < 2; i++) cum += s.max * INF.phases[i].frac;
    return s.ph >= 2 ? d : Math.min(d, Math.max(0.0001, cum - cur));
  }
  /** after a strike: did the damage break the segment that was up? */
  function after(r) {
    const s = st(r); if (!s) return;
    const dmg = S.hiveDmg[r] || 0; let cum = 0;
    for (let i = 0; i < 2; i++) { cum += s.max * INF.phases[i].frac; if (i === s.ph && dmg >= cum - 1e-6) { s.ph = i + 1; surge(r, i); } }
  }
  /** the counter-surge: Ash-Born burst out toward the hero, a smaller group toward the town */
  function surge(r, phase) {
    const reg = map.regions[r], n = reg.nest, F = INF.surge, P = INF.phases[phase], ring = Math.min(3, reg.ring);
    const base = (F.hero + F.heroPhase * phase + F.heroNight * S.night) * (1 + 0.15 * (ring - 1)) * G.DIFF.threat / 0.88;
    const kH = Math.min(F.cap, Math.max(3, Math.round(base))), kT = Math.max(2, Math.round(kH * F.town));
    const u = G.unlocked(Math.max(1, S.night)), mk = (k, toHero) => {
      const kinds = []; if (phase >= 1 && S.night >= 2) kinds.push('runner'); if (phase >= 1 && S.night >= 4) kinds.push('brute');
      while (kinds.length < k) { const [kind] = u[irng.weighted(u.map(([, m]) => m.weight))]; kinds.push(kind); }
      for (const kind of kinds.slice(0, k)) {
        const m = G.spawnAtNest(kind, r); m.rise = 0.6; m.hp = m.maxHp = Math.ceil(m.maxHp * (1 + F.hp * phase));
        if (toHero) { m.hunt = true; m.horde = r; } else m.stream = r;
      }
    };
    mk(kH, true); mk(kT, false);
    const b = n.body || n;
    ev('infernoBreak', { region: r, x: b.x, y: b.y, phase, n: kH + kT, name: P.name });
    toast(`[${P.name} broken] The ${INF.names[heatOf(r)].toLowerCase()} fire roars up: **${kH} Ash-Born** burst out at you and **${kT}** run for the town. ${phase < 2 ? INF.phases[phase + 1].name + ' is exposed.' : ''}`, 'bad');
  }
  /** the core is snuffed (called by the burn flow in hives.js) */
  function cleansed(r) {
    const reg = map.regions[r], n = reg.nest, b = n.body || n, s = st(r); if (s) { s.ph = 3; s.done = S.night; }
    ev('nestCleansed', { id: r, region: r, x: b.x, y: b.y, kind: heatOf(r) });
    toast(`[Fire snuffed] The ${INF.names[heatOf(r)].toLowerCase()} core is dead. The fire dies out and the corridor is **cleansed**.`, 'good');
    if (G.dropRelic) G.dropRelic(b.x, b.y);   // econ3 owns relic drops
  }
  /** at dawn: a nest left alone burns hotter (telegraphed), and one that wakes tomorrow is announced */
  function dawn() {
    if (!on()) return;
    const hot = heatStage() > (S.infStage || 0); S.infStage = heatStage();
    for (const reg of map.regions) {
      const r = reg.id; if (!reg.nest || !S.nestAlive[r] || S.claimed.has(r) || S.sealed[r]) continue;
      if (!(S.hiveDmg[r] > 0) && hot) toast(`[Burning hotter] The ${G.compass(reg.nest.x, reg.nest.y)} ${INF.names[heatOf(r)].toLowerCase()} nest burns hotter the longer it is left alone: its fire and its hp grow.`, 'bad');
      if (S.wake[r] === S.night + 1) toast(`[Embers rising] The ${G.compass(reg.nest.x, reg.nest.y)} ${INF.names[heatOf(r)].toLowerCase()} fire is waking: its dead come out tomorrow night.`, 'bad');
    }
  }
  /** a restored save keeps the broken segments: the damage and the siege state go back in place (the hives module holds the object) */
  function restore(R) { for (const k of Object.keys(S.hiveDmg)) delete S.hiveDmg[k]; Object.assign(S.hiveDmg, R.hiveDmg || {}); for (const k of Object.keys(S.inferno)) delete S.inferno[k]; Object.assign(S.inferno, R.inferno || {}); S.infStage = R.infStage || 0; }
  const save = () => ({ hiveDmg: S.hiveDmg, inferno: S.inferno, infStage: S.infStage || 0 });
  /** the nest (info) whose building is within d of a point and still burns: what the siege bar shows */
  function nearest(x, y, d = 14) {
    let best = null, bd = d;
    for (const reg of map.regions) { if (!reg.nest || !S.nestAlive[reg.id] || S.claimed.has(reg.id)) continue; const b = reg.nest.body || reg.nest, e = G.nestEdge(reg, x, y) + 0 * b.x; if (e < bd) { bd = e; best = reg.id; } }
    return best === null ? null : info(best);
  }
  return { inferno: { on, info, arm, maxOf, clamp, after, cleansed, dawn, restore, save, nearest, heatOf, nameOf } };
}
