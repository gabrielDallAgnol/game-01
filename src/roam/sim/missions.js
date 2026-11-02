// [roam] Chapter 1's missions, the rules (data: src/play/missions.js). Only where the world has a chapter (the Point).
// S.mission = { i, t, prog, need, ... } is the step on now; each step's goal is checked from the state, its reward applied
// when it's done, then the next starts. Cause and consequence, step to step: the scrap opens Kai's bench (recipes start
// to drop); Tomas saved gives a turret at the garage; the loud test calls the machines to the Point (the turret helps);
// the coil from the pump works lets Kai build the freeing chip; the boss freed and the bridge mended open the mods.
// Also: S.recipesLocked (no recipe drops until the bench is open) and S.modsLocked (no elites, no mod recipes until the
// chapter's end) for sim/loot.js and sim/elites.js. S.turrets: the defenders' turrets (they shoot the nearest machine).
// Events: missionStart, missionStep, missionDone, chapterDone, turretShot.
import { CHAPTER1 } from '../../play/missions.js';
import { Rng, hashSeed } from '../../sim/rng.js';
export function createMissions(G) {
  const { R, S, ev, town } = G, W = town.W, M = R.missions;
  S.turrets = []; S.mission = null; S.carryItems = [];
  if (W.chapter !== 'point') return Object.assign(G, { stepMissions() {} });
  const C = CHAPTER1, P = W.world, rng = new Rng(hashSeed(G.seed, 'missions'));
  S.recipesLocked = true; S.modsLocked = true;
  const home = () => S.sites.find(q => q.bay) || S.sites[0];
  const atBank = () => S.sites.some(q => Math.hypot(q.x - S.kai.x, q.y - S.kai.y) < R.risk.bankR);
  const lot = () => town.garageLot && town.garageLot.box;
  const inLot = (x, y) => { const L = lot(); if (!L) return false; const c = Math.cos(-L.rot), s = Math.sin(-L.rot), dx = x - L.x, dy = y - L.y; return Math.abs(c * dx - s * dy) < L.hu && Math.abs(s * dx + c * dy) < L.hv; };
  const ring = (x, y, r0, r1, k) => { for (let t = 0; t < 12; t++) { const a = rng.range(0, 6.283), r = rng.range(r0, r1), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (!town.blocked(px, py)) return [px, py]; } return [x + r0, y]; };
  function begin(i) { const st = C[i]; if (!st) { S.mission = null; ev('chapterDone', {}); return; }
    S.mission = { i, id: st.id, t: 0, prog: 0, need: 0, wave: 0 }; ev('missionStart', { i, id: st.id, title: st.title, say: st.start, giver: st.giver }); }
  function finish() { const st = C[S.mission.i], r = st.reward || {};
    if (r.recipes) S.recipesLocked = false;
    if (r.recipe && G.learn) G.learn([r.recipe]);
    if (r.learn && G.learn) G.learn([r.learn]);
    if (r.turret) { const q = home(), L = lot(); const at = L ? { x: L.x + Math.cos(L.rot) * (L.hu - 2) - Math.sin(L.rot) * (L.hv - 2), y: L.y + Math.sin(L.rot) * (L.hu - 2) + Math.cos(L.rot) * (L.hv - 2) } : { x: q.x + 4, y: q.y };
      S.turrets.push({ who: r.turret, x: at.x, y: at.y, cd: 0, fa: 0 }); }
    if (r.mods) S.modsLocked = false;
    if (r.clean) { const a = S.areas.find(o => o.id === r.clean), at = P.scrubber || home(); if (a) G.cleanArea(a, at.x, at.y); }
    ev('missionDone', { i: S.mission.i, id: st.id, title: st.title, say: st.done, reward: r }); begin(S.mission.i + 1); }
  function spawnAt(kind, x, y, tag, state = 'wander') { const d = G.spawn(kind, x, y, { state, mission: tag }); return d; }
  // where the step wants you now (the HUD's arrow and marker read S.mission.at): null when the goal is "fight anywhere"
  function targetOf(m, st, g) { const k = S.kai, q = home(), B = (S.bridges || [])[0];
    if (g.type === 'bank') return S.scrap + S.bank.scrap >= g.scrap ? { x: q.x, y: q.y, label: 'KAI' } : null;
    if (g.type === 'protect') return P[g.who] ? { x: P[g.who].x, y: P[g.who].y, label: 'TOMAS' } : null;
    if (g.type === 'hold') return g.at && P[g.at] ? { x: P[g.at].x, y: P[g.at].y, label: 'SCRUBBER' } : { x: q.x, y: q.y, label: 'HOLD' };
    if (g.type === 'fetch') return S.carryItems.includes(g.item) ? { x: q.x, y: q.y, label: 'HOME' } : m.item ? { x: m.item.x, y: m.item.y, label: 'COIL' } : P[g.at] ? { x: P[g.at].x, y: P[g.at].y, label: 'COIL' } : null;
    if (g.type === 'key') return S.chips + S.bank.chips >= g.chips ? { x: q.x, y: q.y, label: 'GARAGE' } : null;
    if (g.type === 'freed') { const d = S.dead.find(o => o.boss && o.free); return d ? { x: d.x, y: d.y, label: 'BIG ONE' } : null; }
    if (g.type === 'mended') return B && (S.scrap >= R.bridges.scrap || B.state === 'mending') ? { x: B.a.x, y: B.a.y, label: 'BRIDGE' } : null;
    return null; }
  function stepMissions(dt) { const m = S.mission, k = S.kai; stepTurrets(dt); if (!m) return; const st = C[m.i], g = st.goal; m.t += dt; m.at = targetOf(m, st, g);
    if (g.type === 'bank') { m.need = g.scrap; m.prog = Math.min(g.scrap, S.bank.scrap); if (S.bank.scrap >= g.scrap) { S.bank.scrap -= g.scrap; finish(); } }
    else if (g.type === 'protect') { const at = P[g.who]; if (!at) return finish();
      if (!m.wave && Math.hypot(k.x - at.x, k.y - at.y) < g.near) { m.wave = 1; m.left = g.time; for (let i = 0; i < g.wave; i++) { const [x, y] = ring(at.x, at.y, 5, 11); spawnAt(i % 3 === 2 ? 'hound' : 'crawler', x, y, st.id); } ev('missionStep', { id: st.id, what: 'wave', x: at.x, y: at.y }); }
      if (m.wave) { const left = S.dead.filter(d => d.mission === st.id).length; m.prog = left; m.need = g.wave; m.left -= dt;
        if (!left) finish(); else if (m.left <= 0) { for (const d of S.dead.slice()) if (d.mission === st.id) { S.dead.splice(S.dead.indexOf(d), 1); } m.wave = 0; ev('missionStep', { id: st.id, what: 'failed' }); } } }
    else if (g.type === 'hold') { const q = g.at ? P[g.at] : home(), near = !k.dead && Math.hypot(k.x - q.x, k.y - q.y) < g.r && (g.at || !inLot(k.x, k.y)); m.need = g.time;
      if (m.prog === 0 && !m.started) { m.started = true; m.held = 0; m.next = 2; }
      if (near) m.held += dt; m.prog = Math.max(0, Math.ceil(g.time - m.held));
      m.next -= dt; if (m.next <= 0 && m.held < g.time) { m.next = g.every; const n = 3 + Math.floor(m.held / 20); for (let i = 0; i < n; i++) { const [x, y] = ring(q.x, q.y, g.at ? 30 : 55, g.at ? 45 : 75); spawnAt(i === n - 1 && m.held > 30 ? 'spitter' : i % 2 ? 'hound' : 'crawler', x, y, st.id, 'chase'); } ev('missionStep', { id: st.id, what: 'wave' }); }
      if (m.held >= g.time) finish(); }
    else if (g.type === 'fetch') { const at = P[g.at]; if (!at) return finish();
      if (!m.placed) { m.placed = true; m.item = { x: at.x, y: at.y, taken: false }; S.missionItem = m.item; for (const kind of g.guard || []) { const [x, y] = ring(at.x, at.y, 4, 12); spawnAt(kind, x, y, st.id); } }
      if (!m.item.taken && !k.dead && Math.hypot(k.x - at.x, k.y - at.y) < 2.6) { m.item.taken = true; S.carryItems.push(g.item); ev('missionStep', { id: st.id, what: 'taken', item: g.item }); }
      if (m.item.taken && k.dead) { S.carryItems = S.carryItems.filter(x => x !== g.item); m.item.taken = false; m.item.x = k.x; m.item.y = k.y; ev('missionStep', { id: st.id, what: 'dropped' }); }   // lost where she fell: go back for it
      if (m.item.taken && atBank()) { S.carryItems = S.carryItems.filter(x => x !== g.item); S.missionItem = null; finish(); } }
    else if (g.type === 'key') { m.need = g.chips; m.prog = Math.min(g.chips, S.chips + S.bank.chips); if ((S.keys[g.key] || 0) > 0) finish(); }
    else if (g.type === 'freed') { if ((S.guardians || []).length) finish(); }
    else if (g.type === 'mended') { m.prog = S.scrap; if ((S.bridges || []).some(b => b.state === 'mended')) finish(); } }
  // a defender's turret: a welded gun on a post at the lot's corner; it shoots the nearest machine in reach
  function stepTurrets(dt) { for (const T of S.turrets) { T.cd -= dt; if (T.cd > 0) continue; let best = null, bd = M.turretR; for (const d of S.dead) { if (d.boss) continue; const q = Math.hypot(d.x - T.x, d.y - T.y); if (q < bd) { bd = q; best = d; } }
    if (!best) { T.cd = 0.3; continue; } T.cd = M.turretEvery; T.fa = Math.atan2(best.y - T.y, best.x - T.x); T.shot = { x: best.x, y: best.y, t: S.t }; ev('turretShot', { x: T.x, y: T.y, tx: best.x, ty: best.y }); G.hurtFoe(best, M.turretDmg, 'turret', best.x, best.y); } }
  begin(0);
  Object.assign(G, { stepMissions });
}
