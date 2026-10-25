// Hives: the endless stream of dead from awake hives, the hero hitting and burning one, the horde that follows,
// bursting when the camp is too loud, and the field tools (flare, smoke).
import { ESCAPE, MOBS, WAVES, TIDE } from '../content/mobs.js';
import { CUT, HEAT, NIGHT_TAIL, STREAM, TOOLS } from './state.js';
import { N } from './mapgen.js';

export function createHives(G) {
  const { S, c, compass, earn, ev, fail, keep, map, mobById, reveal, revealRegion, rng, syncPicks, toast } = G;

  function burnHive(r) {
    G.clearRoamers(r); S.claimed.add(r); revealRegion(r); S.nestAlive[r] = false; S.stats.regionsClaimed++;
    for (const nb of map.regions[r].neighbors) if (map.regions[nb].nest && !S.claimed.has(nb) && S.wake[nb] > S.night + 1) S.wake[nb] = S.night + 1;
    const loot = WAVES.plunder(map.regions[r].ring); earn(loot);
    if (S.season && S.season.finaleHive === r && S.night <= S.season.end) G.finale(true);
    for (const m of S.mobs) if (m.stream === r) m.stream = -1;
    if (G.nestBurned) G.nestBurned(r);   // [nests] its guards run with the horde, its sites unlock
    ev('claim', { region: r }); toast(`Inferno Nest burned: +${loot} scrap and a rare blessing.`, 'good');
    // [acts] begin
    if (G.actCheck) G.actCheck();
    // [acts] end
  }
  // ---------- the stream: the dead never stop coming from awake hives, day and night ----------
  const streamAcc = {}, rage = {}, hiveDmg = S.hiveDmg || (S.hiveDmg = {});   // [nest3] hiveDmg lives in S and is saved: a broken segment never heals
  const hiveBase = r => Math.round(STREAM.hiveHp * (map.regions[r].ring <= 1 ? 1.8 : 1 + 0.6 * (map.regions[r].ring - 1)) * G.hpS(S.night));
  const hiveMax = r => (G.inferno ? G.inferno.maxOf(r, hiveBase(r)) : hiveBase(r));   // [nest3] a struck nest keeps the hp it was struck at
  function stepStream(dt) {
    if (G.v2) return;   // [v2] the hives send no stream of dead (the hordes come next)
    if (!S.clock || S.night < 2 && !(S.phase === 'night' && S.qT > 15) && !(G.dayDeadOk && G.dayDeadOk())) return;   // [gemini3] the dead by day from day 1
    if (S.phase === 'night' && S.qT > WAVES.duration(S.night) + NIGHT_TAIL && !Object.values(rage).some(v => v > 0)) return;   // the hour before dawn is quiet: the hives rest (nights are longer than the old surge + tail)
    const n = S.night, every = Math.max(STREAM.min, STREAM.every - STREAM.drop * n) / G.DIFF.threat, mult = (S.phase === 'night' ? STREAM.nightMult : TIDE.dayRef / TIDE.dayLen) * (G.dayDeadK ? G.dayDeadK() : 1);   // [pacing] a longer day, the same dead by day · [gemini3] the early days at a share
    const nests = new Set(G.activeNests(n)); for (const r in rage) if (rage[r] > 0) { nests.add(+r); rage[r] -= dt; }
    const u = G.unlocked(Math.max(1, n - 1));
    for (const r of nests) {
      if (!S.nestAlive[r] || ((S.sealed[r] || (S.night < 5 && !(G.dayDeadOk && G.dayDeadOk()))) && !(rage[r] > 0))) continue;   // [gemini3] by day the near hollows send theirs before night 5 too   // the near hives only send their dead by night until the first blood moon (unless you anger one)
      streamAcc[r] = (streamAcc[r] || rng.range(0, every)) + dt * mult * (rage[r] > 0 ? STREAM.rage : 1);
      while (streamAcc[r] >= every) {
        streamAcc[r] -= every;
        const [kind] = u[rng.weighted(u.map(([, m]) => m.weight))];
        const m = G.spawnAtNest(kind, r);
        if (G.hears(r) || rage[r] > 0) m.stream = r;
        else { m.roam = { x: m.x, y: m.y, region: r }; if (S.mobs.filter(q => q.roam && q.roam.region === r).length > 30) { S.mobs.splice(S.mobs.indexOf(m), 1); mobById.delete(m.id); } }   // too far to hear the camp: the city fills up instead
      }
    }
  }
  /** the hero hits a hive: it bleeds, it rages (pours out the dead), and at zero it burns */
  function hitHive(r, d) {
    if (G.v2) return false;   // [v2] no nest sieges
    const reg = map.regions[r];
    if (keep.level < G.keepForRing(reg.ring)) { if (!S.nightFlags.keepWarn) { S.nightFlags.keepWarn = true; fail(`This Inferno Nest is too strong: raise the Haven Rig to level ${G.keepForRing(reg.ring)} first.`); } return false; }
    if (!hiveDmg[r]) { toast('You strike the Inferno Nest. It wakes and pours out its Ash-Born!', 'bad'); if (S.wake[r] > S.night) S.wake[r] = S.night; }
    // [road] begin
    if (G.road) d *= G.road.hiveMult(r);
    // [road] end
    // [nest3] begin
    if (G.inferno && G.inferno.on()) { G.inferno.arm(r, hiveBase(r)); d = G.inferno.clamp(r, hiveDmg[r] || 0, d * (S.story && S.story.flags.hiveTip ? 1.15 : 1)) / (S.story && S.story.flags.hiveTip ? 1.15 : 1); }
    // [nest3] end
    hiveDmg[r] = (hiveDmg[r] || 0) + d * (S.story && S.story.flags.hiveTip ? 1.15 : 1); rage[r] = STREAM.rageTime;
    if (G.angerNest) G.angerNest(r);   // [nests] a strike angers it faster
    ev('hitHive', { region: r, hp: Math.max(0, 1 - hiveDmg[r] / hiveMax(r)) });
    if (G.inferno && G.inferno.on() && hiveDmg[r] < hiveMax(r)) G.inferno.after(r);   // [nest3] a segment broke: the counter-surge
    if (hiveDmg[r] >= hiveMax(r)) { if (G.inferno && G.inferno.on()) G.inferno.cleansed(r); G.gainXp(40); burnHive(r); hiveFall(r); S.picks.push('nest'); syncPicks(); if (S.picks.length === 1) G.rollOffer(); G.dropSupply('The Inferno Nest is ash.'); delete hiveDmg[r]; delete rage[r]; }
    return true;
  }
  const hiveHealth = r => (S.nestAlive[r] ? Math.max(0, 1 - (hiveDmg[r] || 0) / hiveMax(r)) : 0);
  // ---------- too loud: at HEAT.erupt the nearest awake hive warns, then bursts toward the noise ----------
  function warnEruption() {
    if (G.v2) return;   // [v2] no eruptions
    const cands = G.activeNests().map(r => map.regions[r]);
    if (!cands.length) { S.heatCool = 30; return; }
    cands.sort((a, b) => Math.hypot(a.nest.x - c, a.nest.y - c) - Math.hypot(b.nest.x - c, b.nest.y - c));
    const r = cands[0];
    S.eruption = { region: r.id, t: HEAT.warn, x: r.nest.x, y: r.nest.y };
    ev('eruptWarn', { region: r.id, x: r.nest.x, y: r.nest.y });
    toast(`[Too loud] The ${compass(r.nest.x, r.nest.y)} Inferno Nest bursts in ${HEAT.warn} s.`, 'bad');
  }
  function erupt() {
    const r = S.eruption.region; S.eruption = null; S.heatCool = HEAT.cool; S.noiseSpike = 0; S.noiseChoice = Math.min(S.noiseChoice || 0, Math.max(0, (S.noiseChoice || 0) + HEAT.after));   // the burst spends the fighting noise and most of the choices'
    if (!S.nestAlive[r]) return;
    rage[r] = STREAM.rageTime; if (S.wake[r] > S.night) S.wake[r] = S.night;
    const u = G.unlocked(Math.max(1, S.night)), n = Math.round((HEAT.burst + S.night) * G.DIFF.threat);
    for (let k = 0; k < n; k++) { const [kind] = u[rng.weighted(u.map(([, m]) => m.weight))]; const m = G.spawnAtNest(kind, r); m.stream = r; }
    const nest = map.regions[r].nest; reveal(nest.x, nest.y, 4);
    ev('erupt', { region: r, x: nest.x, y: nest.y }); toast('The Inferno Nest bursts! The Ash-Born pour out toward the noise.', 'bad');
    S.stats.eruptions = (S.stats.eruptions || 0) + 1;
  }
  // ---------- burning a hive: the horde comes at once (no pause); a flare or smoke is a button, any time ----------
  function hiveFall(r) {
    const n = map.regions[r].nest; S.escape = null;
    const u = G.unlocked(Math.max(1, S.night)), k = Math.max(3, Math.round(ESCAPE.horde(S.night) * G.DIFF.threat * (1 + 0.5 * (map.regions[r].ring - 1))));
    const kinds = [];
    if (S.night >= 2) kinds.push('runner', 'runner');   // runners from night 2: you cannot just walk away
    if (S.night >= 4) kinds.push('brute');              // and a brute from night 4
    while (kinds.length < k) { const [kind] = u[rng.weighted(u.map(([, mm]) => mm.weight))]; kinds.push(kind); }
    const ids = [];
    for (const kind of kinds) { const m = G.spawnAtNest(kind, r); m.rise = 0.6; m.hunt = true; m.horde = r; ids.push(m.id); }
    S.stats.hordes = (S.stats.hordes || 0) + 1;
    ev('horde', { region: r, x: n.x, y: n.y, n: kinds.length, ids });
    if (CUT.tools) toast(`[The Inferno Nest is ash] **${kinds.length} Ash-Born** pour out after you. Run for the towers.`, 'bad');
    else toast(`[The Inferno Nest is ash] **${kinds.length} Ash-Born** pour out after you. A **flare** (${TOOLS.flare.cost} scrap) pulls them away; **smoke** (${TOOLS.smoke.cost} food) hides your scent.`, 'bad');
  }
  /** throw a flare: the dead near you (or near the point) chase the light for 20 s. x, y: where it lands (default: ahead of you). */
  function useFlare(x, y) {
    const h = S.hero, F = TOOLS.flare;
    if (CUT.tools) return false;   // [cut] the field tools are switched off
    if (S.over || h.dead) return false;
    if (S.tools.flare > 0) return fail(`The next flare is ready in ${Math.ceil(S.tools.flare)} s.`);
    if (S.gold < F.cost) return fail(`A flare costs ${F.cost} scrap.`);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { x = h.x + Math.sin(h.face) * F.throw; y = h.y + Math.cos(h.face) * F.throw; }
    x = Math.max(1, Math.min(N - 2, x)); y = Math.max(1, Math.min(N - 2, y));
    S.gold -= F.cost; S.stats.goldSpent += F.cost; S.cur.spent += F.cost; S.tools.flare = F.cd;
    let n = 0;
    for (const m of S.mobs) {
      if (MOBS[m.kind].animal || m.kind === 'gravelord' || m.unique) continue;
      if (Math.hypot(m.x - h.x, m.y - h.y) > F.r && Math.hypot(m.x - x, m.y - y) > F.r) continue;
      m.lure = { x: x + rng.range(-1, 1), y: y + rng.range(-1, 1), t: F.t }; m.hunt = false; m.last = null; n++;
    }
    S.stats.flares = (S.stats.flares || 0) + 1;
    ev('flare', { x, y, dur: F.t, n }); toast(`[Flare] **${n} Ash-Born** turn toward the light for **${F.t} seconds**.`, 'good');
    return true;
  }
  /** light smoke: the dead near you lose your scent (they find it again only if they bump into you) */
  function useSmoke() {
    const h = S.hero, M = TOOLS.smoke;
    if (CUT.tools) return false;   // [cut] the field tools are switched off
    if (S.over || h.dead) return false;
    if (S.tools.smoke > 0) return fail(`The next smoke is ready in ${Math.ceil(S.tools.smoke)} s.`);
    if (S.food < M.cost) return fail(`Smoke takes ${M.cost} food (wet leaves and fat).`);
    S.food -= M.cost; S.tools.smoke = M.cd;
    let n = 0;
    for (const m of S.mobs) { if (MOBS[m.kind].animal || Math.hypot(m.x - h.x, m.y - h.y) > M.r) continue; m.smoke = M.t; if (m.hunt) n++; m.hunt = false; m.last = null; m.ambushAt = null; }
    S.stats.smokes = (S.stats.smokes || 0) + 1;
    ev('smoke', { x: h.x, y: h.y, r: M.r, n }); toast(`[Smoke] Grey all around you. **${n} Ash-Born** lost your scent: keep your distance.`, 'good');
    return true;
  }
  /** the old escape card's call, kept for old callers: 'flare' / 'smoke' use the tool, 'run' does nothing */
  function escape(kind) { return kind === 'flare' ? useFlare() : kind === 'smoke' ? useSmoke() : kind === 'run'; }
  const toolsInfo = () => CUT.tools ? null : Object.fromEntries(Object.entries(TOOLS).map(([k, T2]) => [k, { cost: T2.cost, pay: k === 'flare' ? 'scrap' : 'food', cd: Math.max(0, S.tools[k] || 0), cdMax: T2.cd, t: T2.t, ready: !(S.tools[k] > 0), afford: (k === 'flare' ? S.gold : S.food) >= T2.cost }]));
  return { burnHive, stepStream, hitHive, hiveHealth, warnEruption, erupt, useFlare, useSmoke, escape, toolsInfo };
}
