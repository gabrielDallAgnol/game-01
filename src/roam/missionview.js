// [roam] Chapter 1's missions on screen (the Point): Tomas at his door with a lamp he swings for help while the machines
// are there (then he stays out); the shield coil in the pump works (a drum of copper with a lit core) until it's taken;
// each defender's turret at the garage lot (a post, a welded gun turning to its target, a muzzle flash when it fires).
// Render only: reads S.mission, S.missionItem, S.turrets.
import { drawPerson } from './peopleview.js';
export function missionVolumes(v, K, on, sn) {
  const S = v.risk; if (!S || !S.turrets) return; const { sphere, capsule, box, M } = K, t = v.t, P = v.chapter;
  if (P && P.tomas && on(P.tomas.x, P.tomas.y)) { const m = S.mission, saved = !m || m.i > 1, active = m && m.id === 'tomas';
    const b = v.bike, face = Math.atan2(b.y - P.tomas.y, b.x - P.tomas.x); drawPerson(K, t, sn(P.tomas.x), sn(P.tomas.y), face, 'tarp', v.talk === 'TOMAS' || (saved && Math.hypot(b.x - P.tomas.x, b.y - P.tomas.y) < 16) ? 1 : 0, 0, false, 'sack');
    if (active) { const sw = Math.sin(t * 4) * 0.8; sphere(P.tomas.x + Math.cos(face + 1.2) * 1.4, P.tomas.y + Math.sin(face + 1.2) * 1.4, 3.6 + sw * 0.3, 0.22, M.lamp, 1); } }
  const it = S.missionItem; if (it && !it.taken && on(it.x, it.y)) { capsule(it.x - 0.4, it.y, 0.45, it.x + 0.4, it.y, 0.45, 0.42, M.rust); for (const o of [-0.3, 0, 0.3]) capsule(it.x + o, it.y - 0.43, 0.45, it.x + o, it.y + 0.43, 0.45, 0.05, M.paint); sphere(it.x, it.y, 0.95, 0.16, M.lamp, 0.7 + 0.3 * Math.sin(t * 5)); }
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
  const a = S.areas.find(o => o.id === 'lumeside'), runs = a && a.state === 'clean', m = S.mission, spin = m && m.id === 'scrubber' && m.held > 0 ? m.held / 40 : runs ? 1 : 0;
  box(x, y, 0.3, 1.6, 1.6, 0.3, 0.1, 0.4, M.dark); capsule(x, y, 0.5, x, y, 6.5, 0.9, M.rust); box(x, y, 7.0, 1.4, 1.4, 0.5, 0.2, 0.4, M.steel);
  const ang = t * 6 * spin; for (let i = 0; i < 3; i++) { const b = ang + i * 2.094; capsule(x, y, 7.6, x + Math.cos(b) * 1.2, y + Math.sin(b) * 1.2, 7.6, 0.12, M.steel); }
  sphere(x + 1.5, y, 6.0, 0.18, spin > 0 ? M.lamp : M.dark, spin > 0 ? 0.6 + 0.4 * spin : 0); }
