// Night missions: at dusk the System offers three ways to spend the night (Hold the Camp, The Hunt, The Pied Piper).
// Deterministic; created by the road (src/sim/road.js), it reaches the game only through `ctx`.
import { MOBS, WAVES, TIDE } from '../content/mobs.js';
import { MISSIONS, MISSION } from '../content/road.js';

export function createMissions(ctx, getRoad) {
  const { S, map, ev, toast, rng } = ctx, c = map.town.x;
  const M = { id: 'hold', choosing: false, t: 0, offered: 0, lantern: true, hornCd: 0, led: 0, ledKilled: 0, pay: 0, burned: 0, captain: null, captainK: 0, forecast: null, where: null };
  const piped = new Set(), embers = [];
  let api = null;
  const night = () => S.phase === 'night';
  const outside = (x, y) => Math.hypot(x - c, y - c) > 22;

  // ---------- the forecast: does the camp hold without you? ----------
  function forecast() {
    if (api && typeof api.forecastStrip === 'function') {
      try { const f = api.forecastStrip(); if (f && (f.campHolds || f.withoutHero)) { const w = f.campHolds || f.withoutHero; return { word: w, ratio: f.ratio ?? null, source: 'strip' }; } } catch (e) { /* fall back to the threat model */ }
    }
    if (!api) return { word: 'likely', ratio: 0 };
    const r = api.threatRatio(), def = Math.max(0.5, api.defenceDps()), hero = api.heroDps();
    const cap = captainName() && !M.captainK ? 1 + MISSION.captain : 1;
    const without = r * (def + hero * 0.8) / (def * cap);
    const word = without < 0.55 ? 'likely' : without < 0.8 ? 'risky' : 'no';
    return { word, ratio: +without.toFixed(2), with: api.ratingOf(r) };
  }
  function captainName() {
    const ST = S.story; if (!ST || !ST.npcs) return null;
    const n = ST.npcs.find(q => q.alive && q.joined && !q.withHero);
    return n ? n.name.split(' ')[0] : null;
  }
  function whereIs() {
    const h = S.hero, road = getRoad();
    if (Math.hypot(h.x - c, h.y - c) < 18) return 'the camp';
    const st = road.stations.find(s => Math.hypot(s.x - h.x, s.y - h.y) < 9);
    if (st) return st.name;
    return road.convoys().length ? 'the road, with your convoy' : 'out on the road';
  }

  // ---------- dusk: the offer ----------
  function nightfall() {
    M.id = 'hold'; M.choosing = true; M.t = MISSION.pick; M.offered++; M.lantern = true; M.hornCd = 0; M.led = 0; M.ledKilled = 0; M.pay = 0; M.burned = 0; piped.clear();
    M.forecast = forecast(); M.where = whereIs();
    if (S.night < MISSION.from || S.over) { M.choosing = false; M.t = 0; return; }   // night 1: no choice yet, you hold
    const cap = captainName();
    if (cap && !M.captainK) { M.captainK = MISSION.captain; S.P.towerDmg += M.captainK; M.captain = cap; }
    ev('missionOffer', { night: S.night, forecast: M.forecast.word, where: M.where, captain: M.captain });
  }
  function choose(id, how) {
    if (!MISSIONS[id] || S.over) return false;
    if (!night()) return ctx.fail('Missions are chosen at dusk.');
    const was = M.id, auto = how === 'auto'; M.id = id; M.choosing = false; M.t = 0;
    if (id !== 'hunt' && !M.lantern) setLantern(true);
    ev('mission', { id, was, auto });
    if (auto) return true;   // nobody chose: Hold, quietly
    const D = MISSIONS[id];
    toast(`[Mission: ${D.name}] ${id === 'hold' ? 'You stand with the camp tonight.' : id === 'hunt' ? `The hives are emptying. **Lantern off** to move unseen.${M.captain ? ` ${M.captain} captains the camp.` : ''}` : `Sound the **horn** away from the camp: the dead come for you. Lead them into a trap: a lit outpost, a ford, a burning hive, a bloater.`}`, 'sys');
    return true;
  }

  // ---------- The Hunt ----------
  function hiveMult(r) {
    if (M.id !== 'hunt' || !night() || !(S.wake[r] <= S.night)) return 1;
    // in the dark, unnoticed: a strike the hive never saw coming
    const h = S.hero, sneak = !M.lantern && !S.mobs.some(m => m.hunt && Math.hypot(m.x - h.x, m.y - h.y) < 8) ? MISSION.hunt.sneak : 1;
    return sneak / MISSION.hunt.hiveK;
  }
  function setLantern(on) {
    on = !!on; if (on === M.lantern) return true;
    if (!on && (M.id !== 'hunt' || !night())) return ctx.fail('The lantern goes dark only on a Hunt night.');
    M.lantern = on;
    if (on) S.P.heroSpeed /= MISSION.hunt.speed; else S.P.heroSpeed *= MISSION.hunt.speed;
    ev('lantern', { on }); return true;
  }
  /** lantern off on a Hunt, by a live hive: the hero leaves the dead that have not noticed them and strikes the hive */
  function preferHive(best, reach) {
    if (M.lantern || M.id !== 'hunt' || !night() || best.hunt || best.piped || best.cv || best.attacking) return false;
    const h = S.hero; return map.regions.some(r => r.nest && S.nestAlive[r.id] && Math.hypot(r.nest.x - h.x, r.nest.y - h.y) < reach + 1.4);
  }
  /** lantern off: the dead see you at half the distance (you seem twice as far away) */
  const perceive = (m, hd) => (M.lantern || S.hero.dead ? hd : hd / MISSION.hunt.sense);
  const unseen = (hd, sight) => !M.lantern && hd > sight * MISSION.hunt.sense && hd > 2.5;

  // ---------- The Pied Piper ----------
  function horn() {
    const h = S.hero;
    if (M.id !== 'piper' || !night()) return ctx.fail('The horn is for a Pied Piper night.');
    if (h.dead || M.hornCd > 0) return false;
    const H = MISSION.horn, cand = S.mobs.filter(m => !m.roam && !MOBS[m.kind].animal && !m.piped && !m.unique && m.rise >= 1 && Math.hypot(m.x - h.x, m.y - h.y) < H.r)
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    if (!cand.length) return ctx.fail('Nothing in earshot yet: the horn carries about 32 steps. Wait for the dead to come.');
    const n = Math.min(H.cap, Math.ceil(cand.length * H.share));
    // the nearest half always, the rest by chance: the horn is loud, not a leash
    const take = cand.slice(0, n);
    for (const m of take) { m.piped = { t: H.t }; m.hunt = false; m.cv = null; m.siege = null; m.last = null; piped.add(m.id); }
    M.hornCd = H.cd; M.led += take.length; h.noiseT = 6;
    ev('horn', { x: h.x, y: h.y, r: H.r, n: take.length });
    toast(`[Horn] **${take.length} dead** turn from the camp toward you. Lead them somewhere that kills them.`, 'sys');
    return take.length;
  }
  /** how many of the dead the horn would reach right now */
  function earshot() { const h = S.hero; if (h.dead) return 0; let n = 0; for (const m of S.mobs) if (!m.roam && !m.piped && !MOBS[m.kind].animal && m.rise >= 1 && Math.hypot(m.x - h.x, m.y - h.y) < MISSION.horn.r) n++; return Math.min(MISSION.horn.cap, Math.ceil(n * MISSION.horn.share)); }
  function drivePiped(m, D, dt, speed, hd, road) {
    const h = S.hero; m.piped.t -= dt;
    if (m.piped.t <= 0 || h.dead || hd > MISSION.horn.lose) { m.piped = null; if (outside(m.x, m.y) && !h.dead) { m.roam = { x: m.x, y: m.y, region: -1 }; m.lost = true; } return false; }
    m.face = Math.atan2(h.x - m.x, h.y - m.y);
    if (D.burst && hd < 1) { m.hp = 0; ctx.killMob(m, 'fire'); return true; }
    if (hd > 0.9) ctx.moveToward(m, h.x, h.y, speed * (TIDE.roam.chase[m.kind] || 1.2) * road * dt);
    else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; ctx.hurtHero(D.dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); } }
    return true;
  }

  // ---------- traps that work in every mission: embers of a burned hive, bloater chains out in the wilds ----------
  function onEvent(e) {
    if (e.t === 'die' && piped.has(e.id)) {
      piped.delete(e.id);
      if (outside(e.x, e.y)) { M.ledKilled++; const p = MISSION.horn.pay; ctx.earn(p); M.pay += p; ctx.gainXp(1); }
    } else if (e.t === 'claim') {
      const reg = map.regions[e.region], n = reg && reg.nest; if (!n) return;
      embers.push({ x: n.x, y: n.y, t: MISSION.embers.t });
      ev('embers', { x: n.x, y: n.y, r: MISSION.embers.r, t: MISSION.embers.t });
      if (M.id === 'hunt' && night()) {
        const bonus = Math.round(WAVES.plunder(reg.ring) * (MISSION.hunt.pay - 1));
        ctx.earn(bonus); ctx.gainXp(20); M.burned++; S.stats.nightHives = (S.stats.nightHives || 0) + 1;
        toast(`[Night hunt] The hive burned while its dead were out: **+${bonus} scrap** more.`, 'good');
        const story = ctx.story(); if (story) story.chron('Burned a hive by night while its dead were out.', 4, ['hunt']);
      }
    } else if (e.t === 'horde' && M.id === 'hunt' && night() && Array.isArray(e.ids)) {
      // most of its dead are out on the road tonight: fewer pour out after you (the runners and brute stay)
      const H = e.ids.slice(), cut = Math.floor(H.length * (1 - MISSION.hunt.horde));
      for (const id of H.slice(H.length - cut)) { const m = ctx.mobById.get(id); if (m) ctx.removeMob(m); }
    } else if (e.t === 'explode' && outside(e.x, e.y)) {
      const dmg = 10 * Math.sqrt(WAVES.hpScale(S.night)) * MISSION.chainK;
      for (const m of [...S.mobs]) if (!MOBS[m.kind].animal && m.hp > 0 && Math.hypot(m.x - e.x, m.y - e.y) < (e.r || 2.4)) ctx.hitMob(m, dmg, 'fire');
    }
  }
  function tick(dt) {
    if (M.choosing) { M.t -= dt; if (M.t <= 0) choose('hold', 'auto'); }
    if (M.hornCd > 0) M.hornCd = Math.max(0, M.hornCd - dt);
    for (const em of [...embers]) {
      em.t -= dt; if (em.t <= 0) { embers.splice(embers.indexOf(em), 1); continue; }
      for (const m of S.mobs) if (!m.burn && !MOBS[m.kind].animal && m.rise >= 1 && Math.abs(m.x - em.x) < MISSION.embers.r && Math.abs(m.y - em.y) < MISSION.embers.r && Math.hypot(m.x - em.x, m.y - em.y) < MISSION.embers.r) m.burn = { t: MISSION.embers.burn, dps: MISSION.embers.dps };
    }
  }
  function dawn() {
    if (!M.lantern) setLantern(true);
    if (M.captainK) { S.P.towerDmg -= M.captainK; M.captainK = 0; }
    if (M.id === 'piper' && M.led) toast(`[Pied Piper] You led **${M.led}** dead away from the camp; **${M.ledKilled}** of them fell outside the walls: +${M.pay} scrap.`, 'win');
    if (M.id === 'hunt' && M.burned) toast(`[The Hunt] ${M.burned} ${M.burned === 1 ? 'hive' : 'hives'} burned in the dark.`, 'win');
    for (const m of S.mobs) if (m.piped) m.piped = null;
    piped.clear(); M.choosing = false; M.last = M.id; M.id = 'hold';
  }
  const save = () => ({ last: M.last || null, offered: M.offered });
  const load = o => { if (o) { M.last = o.last; M.offered = o.offered || 0; } };
  return { state: M, embers, earshot, preferHive, nightfall, choose, hiveMult, setLantern, perceive, unseen, horn, drivePiped, onEvent, tick, dawn, forecast, save, load, attach: a => { api = a; } };
}
