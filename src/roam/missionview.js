// [roam] Chapter 1's missions on screen (the Point): Tomas at his door with a lamp he swings for help while the machines
// are there (then he stays out); the shield coil in the pump works (a drum of copper with a lit core) until it's taken;
// each defender's turret at the garage lot (a post, a welded gun turning to its target, a muzzle flash when it fires).
// Render only: reads S.mission, S.missionItem, S.turrets.
import { drawPerson } from './peopleview.js';
export function missionVolumes(v, K, on, sn) {
  const S = v.risk; if (!S || !S.turrets) return; const { sphere, capsule, box, M } = K, t = v.t, P = v.chapter, b = v.bike, Q = S.quests || { active: [], done: [] };
  const face = (x, y) => Math.hypot(b.x - x, b.y - y) < 30 ? Math.atan2(b.y - y, b.x - x) : 1.57, near = (x, y, r) => Math.hypot(b.x - x, b.y - y) < r;
  // the people who give quests: Tomas at his door, Reyes at his farm, Ines at her door, Mila by her mother at the garage
  if (P) { const tm = P.tomas, active = Q.active.some(q => q.id === 'tomas' && !q.met), saved = Q.done.includes('tomas');
    if (tm && on(tm.x, tm.y)) { drawPerson(K, t, sn(tm.x), sn(tm.y), face(tm.x, tm.y), 'tarp', v.talk === 'TOMAS' || (saved && near(tm.x, tm.y, 16)) ? 1 : 0, 0, false, 'sack');
      if (active) { const sw = Math.sin(t * 4) * 0.8, f = face(tm.x, tm.y); sphere(tm.x + Math.cos(f + 1.2) * 1.4, tm.y + Math.sin(f + 1.2) * 1.4, 3.6 + sw * 0.3, 0.22, M.lamp, 1); } }
    for (const [who, coat, hair] of [['reyes', 'carGreen', 'hair'], ['ines', 'carCream', 'rust']]) { const p = P[who]; if (p && on(p.x, p.y)) drawPerson(K, t, sn(p.x), sn(p.y), face(p.x, p.y), coat, v.talk === who.toUpperCase() ? 1 : 0, 0, false, hair); }
    const q = (S.sites || []).find(o => o.bay); if (q && q.exitAng !== undefined) { const oa = q.exitAng, mx = q.bay.x - Math.sin(oa) * 4.2 - Math.cos(oa) * 2 - 2.4, my = q.bay.y + Math.cos(oa) * 4.2 - Math.sin(oa) * 2 + 1.2;
      if (on(mx, my) && v.kaiHome) drawPerson(K, t, sn(mx), sn(my), face(mx, my), 'carRed', v.talk === 'MILA' || near(mx, my, 14) ? 1 : 0, 0, false, 'hair', 0.62); } }
  // what lies about: Jonah's toy cars (while you look for them), the quest items (the coil, the medicine box), the wrecks
  for (const o of S.questItems || []) { if (o.taken || !on(o.x, o.y)) continue; const a = o.k * 1.3; box(o.x, o.y, 0.12, 0.28, 0.14, 0.1, 0.05, a, [M.carRed, M.carBlue, M.carGreen, M.paint, M.carCream][o.k % 5]); sphere(o.x, o.y, 0.35, 0.08, M.lamp, 0.6 + 0.4 * Math.sin(t * 6 + o.k)); }
  for (const qq of Q.active) { const it = qq.item; if (!it || it.taken || !on(it.x, it.y)) continue;
    if (it.what === 'coil') { capsule(it.x - 0.4, it.y, 0.45, it.x + 0.4, it.y, 0.45, 0.42, M.rust); for (const o of [-0.3, 0, 0.3]) capsule(it.x + o, it.y - 0.43, 0.45, it.x + o, it.y + 0.43, 0.45, 0.05, M.paint); }
    else box(it.x, it.y, 0.3, 0.45, 0.32, 0.3, 0.06, 0.4, M.carCream);
    sphere(it.x, it.y, 0.95, 0.16, M.lamp, 0.7 + 0.3 * Math.sin(t * 5)); }
  for (const w of S.wrecks || []) { if (!on(w.x, w.y)) continue; const c = Math.cos(w.a), s = Math.sin(w.a);
    box(w.x, w.y, 0.5, 2.1, 1.0, 0.5, 0.25, w.a, w.done ? M.dark : M.burnt); box(w.x - c * 0.3, w.y - s * 0.3, 1.05, 0.9, 0.85, 0.25, 0.2, w.a, M.burnt);
    for (const e of [-1, 1]) for (const f of [-1, 1]) sphere(w.x + c * 1.4 * e - s * 0.95 * f, w.y + s * 1.4 * e + c * 0.95 * f, 0.3, 0.3, M.rubber);
    if (!w.done) sphere(w.x, w.y, 1.5, 0.12, M.lamp, (0.5 + 0.5 * Math.sin(t * 3 + w.a)) * (0.5 + w.prog)); }
  for (const T of S.turrets) { if (!on(T.x, T.y)) continue; const c = Math.cos(T.fa), s = Math.sin(T.fa), fire = T.shot && S.t - T.shot.t < 0.07;
    box(T.x, T.y, 0.15, 0.6, 0.6, 0.15, 0.08, 0.3, M.dark); capsule(T.x, T.y, 0.2, T.x, T.y, 1.6, 0.13, M.steel); box(T.x, T.y, 1.75, 0.45, 0.35, 0.25, 0.08, T.fa, M.rust);
    capsule(T.x + c * 0.3, T.y + s * 0.3, 1.8, T.x + c * 1.5, T.y + s * 1.5, 1.8, 0.08, M.dark); sphere(T.x - c * 0.3, T.y - s * 0.3, 2.0, 0.09, M.lamp, 0.8);
    if (fire) sphere(T.x + c * 1.7, T.y + s * 1.7, 1.8, 0.28, M.flash, 1); }
}
// the shot's line, on the overlay: a short amber streak from the gun to what it hit
export function drawMissions(fx, v) { const S = v.risk; if (!S || !S.turrets) return; const { toS } = v;
  for (const T of S.turrets) { if (!T.shot || S.t - T.shot.t > 0.09) continue; const [x0, y0] = toS(T.x + Math.cos(T.fa) * 1.6, T.y + Math.sin(T.fa) * 1.6 - 1.1), [x1, y1] = toS(T.shot.x, T.shot.y);
    fx.strokeStyle = 'rgba(255,200,110,.9)'; fx.lineWidth = 2; fx.beginPath(); fx.moveTo(x0, y0); fx.lineTo(x1, y1); fx.stroke(); } }
// the pump works' scrubber: a tall stack with a fan housing on top; dead while the Lume side is grey, its fan turning and a
// lamp lit once it runs (and the air it cleans rising off it). Render only: reads the area's state.
export function scrubberVolumes(v, K, on) { const S = v.risk, P = v.chapter; if (!S || !P || !P.scrubber || !on(P.scrubber.x, P.scrubber.y)) return; const { sphere, capsule, box, M } = K, { x, y } = P.scrubber, t = v.t;
  const a = S.areas.find(o => o.id === 'tomasrow'), runs = a && a.state === 'clean', m = (S.quests ? S.quests.active : []).find(q => q.id === 'scrubber'), spin = m && m.held > 0 ? m.held / 40 : runs ? 1 : 0;
  box(x, y, 0.3, 1.6, 1.6, 0.3, 0.1, 0.4, M.dark); capsule(x, y, 0.5, x, y, 6.5, 0.9, M.rust); box(x, y, 7.0, 1.4, 1.4, 0.5, 0.2, 0.4, M.steel);
  const ang = t * 6 * spin; for (let i = 0; i < 3; i++) { const b = ang + i * 2.094; capsule(x, y, 7.6, x + Math.cos(b) * 1.2, y + Math.sin(b) * 1.2, 7.6, 0.12, M.steel); }
  sphere(x + 1.5, y, 6.0, 0.18, spin > 0 ? M.lamp : M.dark, spin > 0 ? 0.6 + 0.4 * spin : 0); }
