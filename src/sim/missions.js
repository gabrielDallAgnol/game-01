// Night missions: at dusk the System offers three ways to spend the night (Hold the Camp, The Hunt, The Pied Piper).
// Deterministic; created by the road (src/sim/road.js), it reaches the game only through `ctx`.
// CUT.missions (Oct 20): no offer, no choice; every night is Hold. The rest (traps, embers, the captain) stays live.
import { CUT } from './state.js';
import { MOBS, WAVES, TIDE } from '../content/mobs.js';
import { MISSIONS, MISSION } from '../content/road.js';
import { N, T, idx } from './mapgen.js';

export function createMissions(ctx, getRoad) {
  const { S, map, ev, toast, rng } = ctx, c = map.town.x;
  const M = { id: 'hold', choosing: false, t: 0, offered: 0, lantern: true, hornCd: 0, callT: 0, blows: 0, led: 0, ledKilled: 0, ledBig: 0, pay: 0, burned: 0, hornLv: 0, captain: null, captainK: 0, forecast: null, where: null };
  const piped = new Set(), embers = [], pyres = [], TR = MISSION.traps;
  // fords: where the woods' stream is shallow enough to wade. The dead that follow the horn into one flounder in the current.
  const fords = (() => {
    const cl = [];
    for (let i = 0; i < N * N; i++) {
      if (map.terrain[i] !== T.FORD || !map.wild[i]) continue;
      const x = (i % N) + 0.5, y = ((i / N) | 0) + 0.5, d = Math.hypot(x - c, y - c); if (d < 24 || d > 80) continue;
      const k = cl.find(q => Math.hypot(q.sx / q.n - x, q.sy / q.n - y) < 4);
      if (k) { k.sx += x; k.sy += y; k.n++; } else cl.push({ sx: x, sy: y, n: 1 });
    }
    return cl.filter(q => q.n >= 2).map((q, k) => ({ id: k, x: q.sx / q.n, y: q.sy / q.n }));
  })();
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
    M.id = 'hold'; M.choosing = true; M.t = MISSION.pick; M.offered++; M.lantern = true; M.hornCd = 0; M.callT = 0; M.blows = 0; M.led = 0; M.ledKilled = 0; M.ledBig = 0; M.pay = 0; M.burned = 0; piped.clear();
    M.forecast = forecast(); M.where = whereIs();
    if (S.night < MISSION.from || S.over) { M.choosing = false; M.t = 0; return; }   // night 1: no choice yet, you hold
    if (CUT.missions) { M.choosing = false; M.t = 0; }   // cut: no window, no choice
    const cap = captainName();
    if (cap && !M.captainK) { M.captainK = MISSION.captain; S.P.towerDmg += M.captainK; M.captain = cap; }
    if (!CUT.missions) ev('missionOffer', { night: S.night, forecast: M.forecast.word, where: M.where, captain: M.captain });
  }
  function choose(id, how) {
    if (!MISSIONS[id] || S.over) return false;
    if (CUT.missions && id !== 'hold') return false;
    if (!night()) return ctx.fail('Missions are chosen at dusk.');
    const was = M.id, auto = how === 'auto'; M.id = id; M.choosing = false; M.t = 0;
    if (id !== 'hunt' && !M.lantern) setLantern(true);
    if (id === 'piper') for (const f of fords) if (Math.hypot(f.x - c, f.y - c) < TR.revealFord) ctx.reveal(f.x, f.y, 3);   // the System marks the shallows
    ev('mission', { id, was, auto });
    if (auto) return true;   // nobody chose: Hold, quietly
    const D = MISSIONS[id];
    toast(`[Mission: ${D.name}] ${id === 'hold' ? 'You stand with the camp tonight.' : id === 'hunt' ? `The hives are emptying. **Lantern off** to move unseen.${M.captain ? ` ${M.captain} captains the camp.` : ''}` : `Sound the **horn** away from the camp: the dead come for you. Lead them into a **trap** (marked): a lit outpost's fire, a ford, a burning hollow. Every one that falls out there pays at dawn.`}`, 'sys');
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
    const h = S.hero; return !!(ctx.hiveInReach ? ctx.hiveInReach(h.x, h.y, reach) : map.regions.some(r => r.nest && S.nestAlive[r.id] && Math.hypot(r.nest.x - h.x, r.nest.y - h.y) < reach + 1.4));   // [nests] reach to the hive's edge
  }
  /** lantern off: the dead see you at half the distance (you seem twice as far away) */
  const perceive = (m, hd) => (M.lantern || S.hero.dead ? hd : hd / MISSION.hunt.sense);
  const unseen = (hd, sight) => !M.lantern && hd > sight * MISSION.hunt.sense && hd > 2.5;

  // ---------- The Pied Piper ----------
  // The horn: a share of the dead in earshot turn from the camp and follow you, and for a while after each blow the
  // dead still walking up into earshot hear it too. Louder with every Piper night that worked (Horn Lv) and with the
  // camp's Noise (the dead are already listening). Kills outside the camp pay at dawn; a lit outpost's fire, the embers
  // of a burned hollow and the fords are the traps.
  const H = MISSION.horn;
  const hornR = () => H.r + H.lvR * (M.hornLv || 0);
  const hornShare = () => Math.min(H.shareMax, H.share + H.lvShare * (M.hornLv || 0) + H.noiseShare * Math.min(100, S.noise || 0));
  const hornCap = () => H.cap(S.night) + H.lvCap * (M.hornLv || 0);
  const hears = m => !m.roam && !m.piped && !m.unique && !m.warden && m.rise >= 1 && !MOBS[m.kind].animal && m.hp > 0;
  const lucky = (m, share) => ((((m.id + 1) * 2654435761) ^ (M.blows * 40503)) >>> 0) % 1000 < share * 1000;
  function pipe(m) { m.piped = { t: H.t }; m.hunt = false; m.cv = null; m.siege = null; m.last = null; m.lure = null; piped.add(m.id); M.led++; }
  function horn() {
    const h = S.hero;
    if (M.id !== 'piper' || !night()) return ctx.fail('The horn is for a Pied Piper night.');
    if (h.dead || M.hornCd > 0) return false;
    const r = hornR(), room = hornCap() - M.led;
    if (room <= 0) return ctx.fail('They are all on your heels already: lead them into a trap.');
    const cand = S.mobs.filter(m => hears(m) && Math.hypot(m.x - h.x, m.y - h.y) < r)
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    if (!cand.length) return ctx.fail(`Nothing in earshot yet: the horn carries about ${Math.round(r)} steps. Wait for the dead to come.`);
    const take = cand.slice(0, Math.min(room, Math.ceil(cand.length * hornShare())));
    M.blows++;
    for (const m of take) pipe(m);
    M.hornCd = H.cd; M.callT = H.call; h.noiseT = 6;
    if (ctx.addNoise) ctx.addNoise(H.noise);   // a horn in the night is heard far off: the camp's Noise rises for nights (fading a fifth each dawn)
    ev('horn', { x: h.x, y: h.y, r, n: take.length });
    const t = nearestTrap(h.x, h.y);
    toast(`[Horn] **${take.length} dead** turn from the camp toward you.${t ? ` Nearest trap: **${t.name}**, ${Math.round(Math.hypot(t.x - h.x, t.y - h.y))} steps.` : ' Lead them somewhere that kills them.'}`, 'sys');
    return take.length;
  }
  /** how many of the dead the horn would reach right now */
  function earshot() { const h = S.hero; if (h.dead) return 0; const r = hornR(); let n = 0; for (const m of S.mobs) if (hears(m) && Math.hypot(m.x - h.x, m.y - h.y) < r) n++; return Math.max(0, Math.min(hornCap() - M.led, Math.ceil(n * hornShare()))); }
  /** the horn's echo: for a while after a blow, the dead walking up into earshot turn too (each is asked once) */
  function echo() {
    const h = S.hero; if (h.dead) return;
    const r = hornR(), share = hornShare(), cap = hornCap();
    for (const m of S.mobs) {
      if (M.led >= cap) break;
      if (m.heard === M.blows + M.offered * 100 || !hears(m) || Math.hypot(m.x - h.x, m.y - h.y) > r) continue;
      m.heard = M.blows + M.offered * 100;
      if (lucky(m, share)) pipe(m);
    }
  }
  function drivePiped(m, D, dt, speed, hd, road) {
    const h = S.hero; m.piped.t -= dt;
    if (m.piped.t <= 0 || h.dead || hd > H.lose) { m.piped = null; return false; }   // lost the tune: back to the march on the camp (only a kill takes them off the board)
    m.face = Math.atan2(h.x - m.x, h.y - m.y);
    if (D.burst && hd < 1) { m.hp = 0; ctx.killMob(m, 'fire'); return true; }
    const wade = m.wade > 0 ? TR.slow : 1; if (m.wade > 0) m.wade -= dt;   // in a trap: the current drags, the smoke blinds
    // they follow the horn in a procession: never quite as fast as you walk, so you can lead them
    const sp = Math.min(speed * (TIDE.roam.chase[m.kind] || 1.2) * road, ctx.heroSpeed() * H.follow) * wade;
    if (hd > 0.9) ctx.moveToward(m, h.x, h.y, sp * dt);
    else { m.attacking = true; if (m.cd <= 0) { m.cd = 1; ctx.hurtHero(D.dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); } }
    return true;
  }

  // ---------- traps: places that kill the dead walking into them ----------
  // A lit outpost's fire burns the dead at its ring by night; a burned hollow smoulders through the night; the fords
  // drown the dead that follow the horn into the current; a bloater out in the wilds takes its neighbours with it.
  const seen = (x, y) => S.seen[idx(Math.floor(x), Math.floor(y))] === 1;
  function traps() {
    const road = getRoad(), out = [];
    for (const st of road.stations) if (st.lit) out.push({ kind: 'outpost', id: st.id, name: st.name, x: st.x, y: st.y, r: road.ringOf(st) + TR.outpostPad });
    for (const em of embers) out.push({ kind: 'embers', id: `e${em.x | 0}_${em.y | 0}`, name: 'Burning hollow', x: em.x, y: em.y, r: MISSION.embers.r });
    for (const f of fords) if (seen(f.x, f.y)) out.push({ kind: 'ford', id: `f${f.id}`, name: 'The ford', x: f.x, y: f.y, r: TR.fordR });
    for (const p of pyres) out.push({ kind: 'pyre', id: `p${p.id}`, name: 'Flare fire', x: p.x, y: p.y, r: TR.pyreR, t: p.t });
    return out;
  }
  /** the nearest trap out of the camp (null when there is none) */
  function nearestTrap(x, y) {
    let best = null, bd = Infinity;
    for (const t of traps()) { if (!outside(t.x, t.y)) continue; const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  function burn(m, dps) { if (!m.burn || m.burn.dps < dps || m.burn.t < 0.6) m.burn = { t: TR.burnT, dps }; }
  let zoneT = 0;
  function stepTraps(dt) {
    if ((zoneT -= dt) > 0) return; zoneT = 0.2;
    const road = getRoad(), hs = WAVES.hpScale(S.night), lit = night() ? road.stations.filter(st => st.lit) : [];
    const wet = night() && M.id === 'piper' && piped.size;
    for (const m of S.mobs) {
      if (m.rise < 1 || m.hp <= 0 || MOBS[m.kind].animal) continue;
      for (const st of lit) { const r = road.ringOf(st) + TR.outpostPad; if (Math.abs(m.x - st.x) < r && Math.abs(m.y - st.y) < r && Math.hypot(m.x - st.x, m.y - st.y) < r) burn(m, TR.outpostDps * hs); }
      for (const em of embers) { const r = MISSION.embers.r; if (m.horde !== undefined && m.horde === em.region) continue; if (Math.abs(m.x - em.x) < r && Math.abs(m.y - em.y) < r && Math.hypot(m.x - em.x, m.y - em.y) < r) { burn(m, MISSION.embers.dps * hs); if (m.piped) m.wade = 0.3; } }
      for (const p of pyres) if (Math.abs(m.x - p.x) < TR.pyreR && Math.abs(m.y - p.y) < TR.pyreR && Math.hypot(m.x - p.x, m.y - p.y) < TR.pyreR) burn(m, TR.pyreDps * hs);
      if (wet && m.piped) for (const f of fords) if (Math.abs(m.x - f.x) < TR.fordR && Math.abs(m.y - f.y) < TR.fordR && Math.hypot(m.x - f.x, m.y - f.y) < TR.fordR) { m.wade = 0.3; ctx.hitMob(m, TR.fordDps * hs * 0.2, 'ford'); break; }
    }
  }

  // ---------- traps that work in every mission: embers of a burned hive, bloater chains out in the wilds ----------
  function onEvent(e) {
    if (e.t === 'die' && piped.has(e.id)) {
      piped.delete(e.id);
      if (outside(e.x, e.y)) { const big = MOBS[e.kind] && MOBS[e.kind].size >= 1.6; M.ledKilled++; if (big) M.ledBig++; M.pay += big ? H.payBig : H.pay; ctx.gainXp(1); ev('piperKill', { x: e.x, y: e.y, n: M.ledKilled }); }
    } else if (e.t === 'claim') {
      const reg = map.regions[e.region], n = reg && reg.nest; if (!n) return;
      // a burned hollow smoulders through the night that follows (or the rest of this one)
      embers.push({ x: n.x, y: n.y, until: S.night, t: MISSION.embers.t, region: e.region });   // its own horde runs out through it unhurt (stepTraps)
      ev('embers', { x: n.x, y: n.y, r: MISSION.embers.r, dur: MISSION.embers.t });   // the type wins over a payload .t: the duration rides in .dur
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
    } else if (e.t === 'flare' && M.id === 'piper' && night()) {
      // on a Piper night the flare is a pitch flare: it lights the ground where it lands, and the dead it pulls walk into it
      pyres.push({ id: M.blows * 100 + pyres.length + (S.time | 0), x: e.x, y: e.y, t: e.dur || 20 });
      ev('pyre', { x: e.x, y: e.y, r: TR.pyreR, dur: e.dur || 20 });
    } else if (e.t === 'explode' && outside(e.x, e.y)) {
      const dmg = 10 * Math.sqrt(WAVES.hpScale(S.night)) * MISSION.chainK;
      for (const m of [...S.mobs]) if (!MOBS[m.kind].animal && m.hp > 0 && Math.hypot(m.x - e.x, m.y - e.y) < (e.r || 2.4)) ctx.hitMob(m, dmg, 'fire');
    }
  }
  function tick(dt) {
    if (M.choosing) { M.t -= dt; if (M.t <= 0) choose('hold', 'auto'); }
    if (M.hornCd > 0) M.hornCd = Math.max(0, M.hornCd - dt);
    if (M.callT > 0) { M.callT -= dt; if (M.id === 'piper' && night()) echo(); }
    for (const em of [...embers]) { em.t -= dt; if (S.night > em.until && em.t <= 0) embers.splice(embers.indexOf(em), 1); }
    for (const p of [...pyres]) { p.t -= dt; if (p.t <= 0) pyres.splice(pyres.indexOf(p), 1); }
    stepTraps(dt);
  }
  function dawn() {
    if (!M.lantern) setLantern(true);
    if (M.captainK) { S.P.towerDmg -= M.captainK; M.captainK = 0; }
    if (M.id === 'piper' && M.led) {
      M.pay = Math.round(M.pay); if (M.pay) ctx.earn(M.pay);
      S.stats.piperKills = (S.stats.piperKills || 0) + M.ledKilled;
      const share = M.ledKilled / M.led;
      // the horn gets louder with every Piper night that worked
      if (share >= H.lvNeed && M.ledKilled >= H.lvKills && (M.hornLv || 0) < H.lvMax) { M.hornLv = (M.hornLv || 0) + 1; toast(`[Skill up: Horn Lv ${M.hornLv + 1}] It carries ${H.lvR} steps further and turns more of them.`, 'win'); }
      const story = ctx.story(); if (story && M.ledKilled >= 10) story.chron(`Led ${M.led} dead out of the camp by night; ${M.ledKilled} never came back.`, 3, ['piper']);
    }
    // the dead you led and left out there wander the woods now: they do not come back to the camp by day
    for (const m of S.mobs) if (m.piped && outside(m.x, m.y)) { m.roam = { x: m.x, y: m.y, region: -1 }; m.lost = true; }
    if (M.id === 'hunt' && M.burned) toast(`[The Hunt] ${M.burned} ${M.burned === 1 ? 'hive' : 'hives'} burned in the dark.`, 'win');
    for (const m of S.mobs) if (m.piped) m.piped = null;
    piped.clear(); M.choosing = false; M.last = M.id; M.id = 'hold';
  }
  /** the night's line for the dawn ledger (read by game.js before the dawn resets it) */
  const report = () => (M.id === 'piper' && M.led ? { piper: { led: M.led, killed: M.ledKilled, big: M.ledBig, pay: Math.round(M.pay) } } : M.id === 'hunt' && M.burned ? { hunt: { burned: M.burned } } : {});
  const hornInfo = () => ({ r: hornR(), share: hornShare(), cap: hornCap(), lv: (M.hornLv || 0) + 1, calling: M.callT > 0 });
  const save = () => ({ last: M.last || null, offered: M.offered, hornLv: M.hornLv || 0 });
  const load = o => { if (o) { M.last = o.last; M.offered = o.offered || 0; M.hornLv = o.hornLv || 0; } };
  return { state: M, embers, fords, pyres, traps, nearestTrap, report, hornInfo, earshot, preferHive, nightfall, choose, hiveMult, setLantern, perceive, unseen, horn, drivePiped, onEvent, tick, dawn, forecast, save, load, attach: a => { api = a; } };
}
