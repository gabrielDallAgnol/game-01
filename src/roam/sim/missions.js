// [roam] Chapter 1's quests, the rules (data: src/play/missions.js). Only on the Point (W.chapter 'point').
// Several at once, as in WoW: the story's chain comes by radio as soon as its step before is done; side quests wait at
// their giver ("!" over them: S.quests.offers) until you take them (accept), and some are handed in to the giver in person
// ("?" once the goal is met). S.quests = { active: [{ id, t, prog, need, at, met, … }], done: [ids], offers: [ids] };
// S.mission is the one the HUD follows (the chain's current step, else the first active).
// Cause and consequence: the scrap opens Kai's bench; Tomas's house saved gives two turrets (his door, Kai's); his
// workshop's scrubber turns his row green; the loud test calls the machines to the Point; the coil teaches the freeing
// chip; Reyes's barn pays chips; Ines's medicine opens a repair spot at her door; wrecks salvaged harden the turrets.
// Also: S.recipesLocked, S.modsLocked (for loot.js, elites.js), S.turrets (they shoot the nearest machine), S.wrecks
// (salvage: stop by one a moment), S.questItems (things lying about for a quest), packs asleep in the fields.
import { QUESTS, QUEST } from '../../play/missions.js';
import { Rng, hashSeed } from '../../sim/rng.js';
export function createMissions(G) {
  const { R, S, ev, town } = G, W = town.W, M = R.missions;
  S.turrets = []; S.mission = null; S.carryItems = []; S.quests = { active: [], done: [], offers: [] }; S.wrecks = []; S.questItems = [];
  if (W.chapter !== 'point') return Object.assign(G, { stepMissions() {}, accept() { return false; } });
  const P = W.world, rng = new Rng(hashSeed(G.seed, 'missions'));
  S.recipesLocked = true; S.modsLocked = true; S.salvaged = 0; S.turretMult = 1;   // (scalars only on the Point: the golden runs hash the state's scalars)
  const home = () => S.sites.find(q => q.bay) || S.sites[0];
  const kaiAt = () => { const q = S.sites.find(o => o.bay); if (!q || q.exitAng === undefined) return q ? { x: q.x, y: q.y } : null; const oa = q.exitAng; return { x: q.bay.x - Math.sin(oa) * 4.2 - Math.cos(oa) * 2, y: q.bay.y + Math.cos(oa) * 4.2 - Math.sin(oa) * 2 }; };
  const giverAt = g => g === 'KAI' ? kaiAt() : g === 'MILA' ? (k => k && { x: k.x - 2.4, y: k.y + 1.2 })(kaiAt()) : P[g.toLowerCase()] || null;
  const atBank = () => S.sites.some(q => q.services.includes('bank') && Math.hypot(q.x - S.kai.x, q.y - S.kai.y) < R.risk.bankR);
  const lot = () => town.garageLot && town.garageLot.box;
  const inLot = (x, y) => { const L = lot(); if (!L) return false; const c = Math.cos(-L.rot), s = Math.sin(-L.rot), dx = x - L.x, dy = y - L.y; return Math.abs(c * dx - s * dy) < L.hu && Math.abs(s * dx + c * dy) < L.hv; };
  const ring = (x, y, r0, r1) => { for (let t = 0; t < 12; t++) { const a = rng.range(0, 6.283), r = rng.range(r0, r1), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (!town.blocked(px, py)) return [px, py]; } return [x + r0, y]; };
  const spawnAt = (kind, x, y, tag, state = 'wander', siege) => G.spawn(kind, x, y, siege ? { state, mission: tag, nest: -1, siege } : { state, mission: tag, nest: -1 });   // nest: kept when far (populate thins the rest)
  // the wrecks to salvage, and the little packs asleep out in the fields (the open ground isn't empty)
  for (const w of P.wrecks || []) { const [x, y] = !w.solid && town.blocked(w.x, w.y) ? ring(w.x, w.y, 2, 8) : [w.x, w.y], a = rng.range(0, 6.28); S.wrecks.push({ x, y, done: false, prog: 0, a: w.solid ? w.ang : a }); }
  for (const p of P.packs || []) for (let i = 0; i < 3; i++) { const [x, y] = ring(p.x, p.y, 1, 6); spawnAt(i === 2 && rng.chance(0.4) ? 'hound' : 'crawler', x, y, 'pack', 'sleep'); }
  const has = id => S.quests.done.includes(id), on = id => S.quests.active.find(q => q.id === id);
  const ready = st => st.after.every(has) && !has(st.id) && !on(st.id);
  function start(st) { const q = { id: st.id, t: 0, prog: 0, need: 0, wave: 0, base: S.salvaged }; S.quests.active.push(q); ev('missionStart', { i: QUESTS.indexOf(st), id: st.id, title: st.title, say: st.start, giver: st.giver, main: !!st.main });
    if (st.goal.type === 'collect') (P[st.goal.what] || []).forEach((p, k) => { const [x, y] = town.blocked(p.x, p.y) ? ring(p.x, p.y, 1, 6) : [p.x, p.y]; S.questItems.push({ q: st.id, x, y, taken: false, k }); });
    if (st.goal.type === 'kill') { const at = P[st.goal.at]; if (at) for (const kind of st.goal.kinds) { const [x, y] = ring(at.x, at.y, 6, 16); spawnAt(kind, x, y, st.id, 'sleep'); } }
    if (st.goal.type === 'fetch') { const at = P[st.goal.at]; if (at) { q.item = { x: at.x, y: at.y, taken: false, what: st.goal.item }; for (const kind of st.goal.guard || []) { const [x, y] = ring(at.x, at.y, 4, 12); spawnAt(kind, x, y, st.id); } } }
    return q; }
  function accept(id) { const st = QUEST[id]; if (!st || st.main || !ready(st)) return false; const at = giverAt(st.giver); if (!at || Math.hypot(at.x - S.kai.x, at.y - S.kai.y) > M.talkR) return false; start(st); return true; }
  function finish(q) { const st = QUEST[q.id], r = st.reward || {}, g = st.goal;
    if (g.type === 'bank') S.bank.scrap -= g.scrap;
    if (g.type === 'fetch') S.carryItems = S.carryItems.filter(x => x !== g.item);
    if (r.recipes) S.recipesLocked = false;
    if (r.recipe && G.learn) G.learn([r.recipe]);
    if (r.learn && G.learn) G.learn([r.learn]);
    for (const w of r.turrets || []) { let at; if (w === 'garage') { const L = lot(), hm = home(); at = L ? { x: L.x + Math.cos(L.rot) * (L.hu - 2) - Math.sin(L.rot) * (L.hv - 2), y: L.y + Math.sin(L.rot) * (L.hu - 2) + Math.cos(L.rot) * (L.hv - 2) } : { x: hm.x + 4, y: hm.y }; }
      else { const p = P[w]; if (!p) continue; const [x, y] = ring(p.x, p.y, 3, 5); at = { x, y }; } S.turrets.push({ who: w, x: at.x, y: at.y, cd: 0, fa: 0 }); }
    if (r.mods) S.modsLocked = false;
    if (r.clean) { const a = S.areas.find(o => o.id === r.clean), at = P[g.at] || P.scrubber || home(); if (a) G.cleanArea(a, at.x, at.y); }
    if (r.scrap) S.bank.scrap += r.scrap; if (r.chips) S.bank.chips += r.chips;
    if (r.repair && P[r.repair] && G.addSite) G.addSite('clinic', P[r.repair].x, P[r.repair].y);
    if (r.turretDmg) S.turretMult *= r.turretDmg;
    S.quests.active.splice(S.quests.active.indexOf(q), 1); S.quests.done.push(q.id); S.questItems = S.questItems.filter(o => o.q !== q.id);
    ev('missionDone', { i: QUESTS.indexOf(st), id: st.id, title: st.title, say: st.done, reward: r, giver: st.giver, main: !!st.main });
    if (st.main && !QUESTS.some(o => o.main && !has(o.id))) ev('chapterDone', {}); }
  // where a quest wants you now (the HUD's markers read q.at): null when its goal is "fight anywhere"
  function targetOf(q, st) { const g = st.goal, hm = home(), B = (S.bridges || [])[0], give = () => { const a = giverAt(st.giver); return a && { x: a.x, y: a.y, label: st.giver }; };
    if (q.met && st.turnIn) return give();
    if (g.type === 'bank') return S.scrap + S.bank.scrap >= g.scrap ? { x: hm.x, y: hm.y, label: 'KAI' } : null;
    if (g.type === 'protect') return P[g.who] ? { x: P[g.who].x, y: P[g.who].y, label: 'TOMAS' } : null;
    if (g.type === 'hold') return g.at && P[g.at] ? { x: P[g.at].x, y: P[g.at].y, label: 'SCRUBBER' } : { x: hm.x, y: hm.y, label: 'HOLD' };
    if (g.type === 'fetch') return S.carryItems.includes(g.item) ? (g.handIn ? give() : { x: hm.x, y: hm.y, label: 'HOME' }) : q.item ? { x: q.item.x, y: q.item.y, label: g.item === 'coil' ? 'COIL' : 'VAN' } : null;
    if (g.type === 'collect') { const k = S.kai; let b = null, bd = 1e9; for (const o of S.questItems) if (o.q === q.id && !o.taken) { const d = Math.hypot(o.x - k.x, o.y - k.y); if (d < bd) { bd = d; b = o; } } return b ? { x: b.x, y: b.y, label: 'TOY' } : null; }
    if (g.type === 'kill') return P[g.at] ? { x: P[g.at].x, y: P[g.at].y, label: 'BARN' } : null;
    if (g.type === 'salvage') { const k = S.kai; let b = null, bd = 1e9; for (const w of S.wrecks) if (!w.done) { const d = Math.hypot(w.x - k.x, w.y - k.y); if (d < bd) { bd = d; b = w; } } return b ? { x: b.x, y: b.y, label: 'WRECK' } : null; }
    if (g.type === 'key') return S.chips + S.bank.chips >= g.chips ? { x: hm.x, y: hm.y, label: 'GARAGE' } : null;
    if (g.type === 'freed') { const d = S.dead.find(o => o.boss && o.free); return d ? { x: d.x, y: d.y, label: 'BIG ONE' } : null; }
    if (g.type === 'mended') return B && (S.scrap >= R.bridges.scrap || B.state === 'mending') ? { x: B.a.x, y: B.a.y, label: 'BRIDGE' } : null;
    return null; }
  // halfway there (a beat for the givers to say): counted up (bank, collect, salvage, key) or down (protect, kill, hold)
  function halfway(q, st) { if (q.half || !q.need) return; const down = ['protect', 'kill', 'hold'].includes(st.goal.type), f = down ? 1 - q.prog / q.need : q.prog / q.need;
    if (f >= 0.5 && (st.goal.type !== 'protect' || q.wave)) { q.half = true; ev('missionStep', { id: st.id, what: 'half' }); } }
  // machines at the thing a quest guards wear it down (true while it's under siege); a cry at 75/50/25%
  function batter(q, st, dt) { if (q.hp === undefined) return false; let n = 0; for (const d of S.dead) if (d.mission === st.id && d.siege && Math.hypot(d.x - q.sx, d.y - q.sy) < M.siegeR) n++;
    if (!n) return false; const h0 = q.hp; q.hp -= n * M.siegeDps * dt; for (const m of [75, 50, 25]) if (h0 > m && q.hp <= m) ev('missionStep', { id: st.id, what: 'battered', hp: m, x: q.sx, y: q.sy }); return true; }
  function stepQuest(q, dt) { const st = QUEST[q.id], g = st.goal, k = S.kai; q.t += dt;
    // fragile (the medicine's glass): a hard crash breaks it; there's one more in the van
    if (g.fragile && q.item && q.item.taken && S.carryItems.includes(g.item) && G.lastCrash === S.t) { const at = P[g.at], it = q.item; S.carryItems = S.carryItems.filter(x => x !== g.item); it.taken = false; q.met = false; it.x = at.x; it.y = at.y; ev('missionStep', { id: st.id, what: 'broke' }); }
    if (q.met) { if (st.turnIn) { const a = giverAt(st.giver); if (a && !k.dead && Math.hypot(a.x - k.x, a.y - k.y) < M.talkR) finish(q); } else finish(q); return; }
    const met = () => { q.met = true; if (!st.turnIn) finish(q); else ev('missionStep', { id: st.id, what: 'met' }); };
    if (g.type === 'bank') { q.need = g.scrap; q.prog = Math.min(g.scrap, S.bank.scrap); if (S.bank.scrap >= g.scrap) met(); }
    else if (g.type === 'protect') { const at = P[g.who]; if (!at) return met();
      // they come out of the fields for his door (it has hp: the stake you can see); if it breaks, he's hurt and they scatter: come back and try again
      if (!q.wave && Math.hypot(k.x - at.x, k.y - at.y) < g.near) { q.wave = 1; q.hp = M.siegeHp; q.sx = at.x; q.sy = at.y; for (let i = 0; i < g.wave; i++) { const [x, y] = ring(at.x, at.y, 22, 34); spawnAt(i % 3 === 2 ? 'hound' : 'crawler', x, y, st.id, 'chase', { x: at.x, y: at.y }); } ev('missionStep', { id: st.id, what: 'wave', x: at.x, y: at.y }); }
      if (q.wave) { const left = S.dead.filter(d => d.mission === st.id).length; q.prog = left; q.need = g.wave; batter(q, st, dt);
        if (!left) met(); else if (q.hp <= 0) { for (const d of S.dead.slice()) if (d.mission === st.id) S.dead.splice(S.dead.indexOf(d), 1); q.wave = 0; q.hp = undefined; q.fails = (q.fails || 0) + 1; ev('missionStep', { id: st.id, what: 'failed', x: at.x, y: at.y }); } } }
    else if (g.type === 'hold') { const c = g.at ? P[g.at] : home(), near = !k.dead && Math.hypot(k.x - c.x, k.y - c.y) < g.r && (g.at || !inLot(k.x, k.y)); q.need = g.time;
      if (!q.started) { const gt = town.garageLot && town.garageLot.gate, door = g.at ? c : gt ? { x: gt.x, y: gt.y } : c; q.started = true; q.held = 0; q.next = 2; q.hp = M.siegeHp; q.sx = door.x; q.sy = door.y; }   // at home they come for the garage's gate
      // what they come for (the scrubber, Kai's garage) has hp: broken, it costs the hold some seconds and it's set going again
      if (batter(q, st, dt) && q.hp <= 0) { q.held = Math.max(0, q.held - M.holdLoss); q.hp = M.siegeHp; q.fails = (q.fails || 0) + 1; ev('missionStep', { id: st.id, what: 'broken', x: c.x, y: c.y }); }
      if (near) q.held += dt; q.prog = Math.max(0, Math.ceil(g.time - q.held));
      if (q.held > 0 || near) { q.next -= dt; if (q.next <= 0 && q.held < g.time && S.dead.filter(d => d.mission === st.id).length < M.holdCap) { q.next = g.every; const n = 3 + Math.floor(q.held / 20); for (let i = 0; i < n; i++) { const [x, y] = ring(c.x, c.y, g.at ? 30 : 55, g.at ? 45 : 75); { const kind = i === n - 1 && q.held > 30 ? 'spitter' : i % 2 ? 'hound' : 'crawler'; spawnAt(kind, x, y, st.id, 'chase', kind === 'spitter' ? null : { x: q.sx, y: q.sy }); } } ev('missionStep', { id: st.id, what: 'wave' }); } }
      if (q.held >= g.time) met(); }
    else if (g.type === 'fetch') { const it = q.item; if (!it) return met();
      if (!it.taken && !k.dead && Math.hypot(k.x - it.x, k.y - it.y) < 2.8) { it.taken = true; S.carryItems.push(g.item); ev('missionStep', { id: st.id, what: 'taken', item: g.item }); }
      if (it.taken && k.dead && S.carryItems.includes(g.item)) { S.carryItems = S.carryItems.filter(x => x !== g.item); it.taken = false; it.x = k.x; it.y = k.y; ev('missionStep', { id: st.id, what: 'dropped' }); }   // lost where she fell: go back for it
      if (it.taken && S.carryItems.includes(g.item) && (g.handIn || atBank())) met(); }
    else if (g.type === 'collect') { for (const o of S.questItems) if (o.q === q.id && !o.taken && !k.dead && Math.hypot(k.x - o.x, k.y - o.y) < 2.8) { o.taken = true; ev('missionStep', { id: st.id, what: 'found', n: S.questItems.filter(o2 => o2.q === q.id && o2.taken).length, x: o.x, y: o.y }); }
      q.need = g.n; q.prog = S.questItems.filter(o => o.q === q.id && o.taken).length; if (q.prog >= g.n) met(); }
    else if (g.type === 'kill') { const left = S.dead.filter(d => d.mission === st.id).length; q.need = g.kinds.length; q.prog = left; if (!left) met(); }
    else if (g.type === 'salvage') { q.need = g.n; q.prog = Math.min(g.n, S.salvaged - q.base); if (q.prog >= g.n) met(); }
    else if (g.type === 'key') { q.need = g.chips; q.prog = Math.min(g.chips, S.chips + S.bank.chips); if ((S.keys[g.key] || 0) > 0) met(); }
    else if (g.type === 'freed') { if ((S.guardians || []).length) met(); }
    else if (g.type === 'mended') { q.prog = S.scrap; if ((S.bridges || []).some(b => b.state === 'mended')) met(); } }
  // a wreck: stop by it (slow, within reach) a moment and the robot strips it: scrap, sometimes a chip
  function stepWrecks(dt) { const k = S.kai, slow = !k.riding || Math.abs(S.bike.speed) < M.salvageSpeed;
    for (const w of S.wrecks) { if (w.done) continue; const near = !k.dead && slow && Math.hypot(w.x - k.x, w.y - k.y) < M.salvageR; w.prog = near ? w.prog + dt : Math.max(0, w.prog - dt);
      if (w.prog >= M.salvageTime) { w.done = true; const n = 4 + rng.int(4); S.scrap += n; const chip = rng.chance(0.15); if (chip) S.chips++; S.salvaged++; ev('salvaged', { x: w.x, y: w.y, scrap: n, chip }); } } }
  function stepTurrets(dt) { for (const T of S.turrets) { T.cd -= dt; if (T.cd > 0) continue; let best = null, bd = M.turretR; for (const d of S.dead) { if (d.boss) continue; const q = Math.hypot(d.x - T.x, d.y - T.y); if (q < bd) { bd = q; best = d; } }
    if (!best) { T.cd = 0.3; continue; } T.cd = M.turretEvery; T.fa = Math.atan2(best.y - T.y, best.x - T.x); T.shot = { x: best.x, y: best.y, t: S.t }; ev('turretShot', { x: T.x, y: T.y, tx: best.x, ty: best.y }); G.hurtFoe(best, M.turretDmg * S.turretMult, 'turret', best.x, best.y); } }
  function stepMissions(dt) { stepTurrets(dt); stepWrecks(dt);
    for (const st of QUESTS) if (st.main && ready(st)) start(st);
    for (const q of S.quests.active.slice()) { stepQuest(q, dt); if (S.quests.active.includes(q) && !q.met) halfway(q, QUEST[q.id]); }
    for (const st of QUESTS) if (st.main && ready(st)) start(st);   // the next in the chain comes at once
    for (const q of S.quests.active) q.at = targetOf(q, QUEST[q.id]);
    S.quests.offers = QUESTS.filter(st => !st.main && ready(st)).map(st => st.id);
    // the one you chose to follow (the quest log), else the main chain, else the first
    S.mission = S.quests.active.find(q => q.id === S.quests.track) || S.quests.active.find(q => QUEST[q.id].main) || S.quests.active[0] || null;
    if (S.mission) S.mission.i = QUESTS.indexOf(QUEST[S.mission.id]); }
  // [questlog] follow one quest: its marker leads; done or unknown, the main chain leads again
  const track = id => { S.quests.track = S.quests.active.some(q => q.id === id) ? id : null; stepMissions(0); };
  stepMissions(0);
  Object.assign(G, { stepMissions, accept, giverAt, track });
}
