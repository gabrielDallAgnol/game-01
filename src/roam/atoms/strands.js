// [roam] Wires, washing and smoke: the soft, swaying things. Wooden poles carry wires from one to the next along the
// streets outside the old town (its wires ran underground); washing hangs out only where people still live; smoke rises
// from the hearths still lit and from what still smoulders in the ruins. The poles, posts and chimneys are glyph volumes;
// the wires, the clothes and the smoke are strokes on the overlay that sway with the wind and time, drawn only on screen.
import { M } from '../dress/mats.js';

const S = 1.3, TAU = Math.PI * 2, PH = 6.2 * S, ARM = PH - 0.3 * S;   // the props' scale; a pole's top and its cross-arm
const hs = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, u) => a + (b - a) * u, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// the sun now, for the wires' shadows: v.sun when the overlay is handed it, else read off the game's clock (render only)
let sunT = -1, sunV = null;
const sunOf = v => { if (v.sun) return v.sun; if (v.t !== sunT) { sunT = v.t; const R = globalThis.__roam; sunV = R && R.skyAt && R.S ? R.skyAt(R.S.clock).sun : null; } return sunV; };
// a gust: the wind's strength wanders slowly, a little different street to street
const gust = (v, x, y) => 0.7 + 0.3 * Math.sin(v.t * 0.55 + x * 0.031 + y * 0.017) * Math.sin(v.t * 0.23 + y * 0.05);

// ---------- poles and wires ----------
// a pole's top: a leaning pole tips toward the road (a little along it too); a fallen one lies across the pavement
const tip = i => { const b = Math.atan2(i.slot.ny, i.slot.nx) + (i.h - 0.5) * (i.variant === 'down' ? 1.6 : 1), c = Math.cos(b), s = Math.sin(b);
  if (i.variant === 'down') return [i.x + c * PH * 0.95, i.y + s * PH * 0.95, 0.18, b];
  const l = i.variant === 'lean' ? (0.9 + 0.8 * i.h) * S : 0; return [i.x + c * l, i.y + s * l, i.variant === 'lean' ? ARM - 0.15 * S : ARM, b]; };
// who is next along the street: the nearest pole ahead within ~50 m on the same street and side (or on the next stretch
// of the same road, in line with this one). Found once from the placed poles, cached on the instances.
function link(list) { const P = list.filter(q => q.atom.id === 'pole');
  for (const a of P) { const c = Math.cos(a.ang), s = Math.sin(a.ang); let best = null, bd = 52;
    for (const b of P) { if (b === a) continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= bd || d < 4 || dx * c + dy * s < d * 0.85) continue;
      if (b.slot.street !== a.slot.street ? Math.abs(dy * c - dx * s) > 3.5 || Math.cos(b.ang - a.ang) < 0.85 : b.slot.side !== a.slot.side) continue; best = b; bd = d; }
    a.wNext = best; a.wLinked = true; }
  for (const a of P) if (a.wNext && !a.wNext.wPrev) a.wNext.wPrev = a; }
// one span of wire from pole A to pole B: 2–3 wires off the cross-arms, sagging in a catenary (seen from above the sag
// shows in the shadow, which comes closer to the wire where it hangs low) and bowing with the wind. Tended: taut;
// worn or by a leaning pole: slack; ruined: one wire snapped, hanging down from each pole and coiled on the ground;
// to a fallen pole the wires run down to the ground.
function span(fx, A, B, v) {
  const { toS, cam } = v, ppm = cam.ppm, [ax, ay, az] = tip(A), [bx, by, bz] = tip(B), dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
  const lo = Math.min(A.care, B.care), down = A.variant === 'down' || B.variant === 'down', slack = down ? 1 : lo < 0.62 || A.variant === 'lean' || B.variant === 'lean' ? 0.6 : 0;
  const snap = !down && lo < 0.32 && hs(A.h, B.h) < 0.7, n = hs(B.h, A.h) < 0.4 ? 2 : 3, N = clamp(Math.round(L * ppm / 40), 3, 9);
  const wl = (v.WIND.x * px + v.WIND.y * py) * gust(v, ax, ay), sun = sunOf(v), day = sun && ppm > 8 ? 1 - v.night : 0;
  const sh = day > 0.05 ? [-sun.x / Math.max(0.85, sun.climb), -sun.y / Math.max(0.85, sun.climb)] : null;
  const W = [], Sh = [];   // the wires' polylines (with their heights), and the coils on the ground
  const arm = (i, k) => { const b = Math.atan2(i.slot.ny, i.slot.nx), o = (k - (n - 1) / 2) * 0.65 * S; return [Math.cos(b) * o, Math.sin(b) * o]; };
  for (let k = 0; k < n; k++) { const [oax, oay] = arm(A, k), [obx, oby] = arm(B, k), sag = (slack ? 1.1 + 0.5 * hs(A.h, k) : 0.3) * S * (1 + k * 0.08);
    const sw = (wl * (0.35 + slack) * sag * 0.55 + Math.sin(v.t * (1.1 + 0.2 * k) + A.h * 9 + k) * (0.08 + 0.12 * slack) * sag), pts = [];
    const at = (u, z) => { const b = 4 * u * (1 - u), s = z > 0.3 ? sw * b : sw * b * 0.1; return [lerp(ax + oax, bx + obx, u) + px * s, lerp(ay + oay, by + oby, u) + py * s, z]; };
    if (snap && k === 0) {   // snapped: from each pole a length hangs down and lies coiled where it landed
      for (const [s0, f] of [[0, 0.3 + 0.15 * A.h], [1, 0.22 + 0.12 * B.h]]) { const p = [], z0 = s0 ? bz : az;
        for (let j = 0; j <= 4; j++) { const u = j / 4, uu = s0 ? 1 - f * u : f * u; p.push(at(uu, j < 4 ? z0 * (1 - u * u) : 0)); } W.push(p); Sh.push(p[p.length - 1]); }
      continue; }
    for (let j = 0; j <= N; j++) { const u = j / N; let z = lerp(az, bz, u) - sag * 4 * u * (1 - u); if (down) z = Math.max(0.04, Math.min(z, lerp(az, bz, u) * (1 - u * 0.4) - sag * u)); pts.push(at(u, Math.max(0.04, z))); }
    W.push(pts); }
  const lw = clamp(ppm * 0.06, 0.7, 1.8), far = clamp((ppm - 4) / 6, 0.6, 1);
  if (sh) { fx.strokeStyle = `rgba(0,0,0,${0.22 * day})`; fx.lineWidth = lw * 1.3; fx.beginPath();
    for (const p of W) p.forEach(([x, y, z], j) => { const o = Math.min(1, 7 / (Math.hypot(sh[0], sh[1]) * z + 1e-3)), [X, Y] = toS(x + sh[0] * z * o, y + sh[1] * z * o); j ? fx.lineTo(X, Y) : fx.moveTo(X, Y); }); fx.stroke(); }
  // dark against the pavement up close; paler with the night (moonlit) and with distance (fine pale lines over the dark town)
  const m = clamp((12 - ppm) / 6, 0, 0.85); fx.strokeStyle = `rgba(${Math.round(lerp(26, 150, m))},${Math.round(lerp(25, 150, m))},${Math.round(lerp(24, 152, m))},${0.9 * far * (1 - 0.6 * v.night)})`;   // at night only a faint line: the wires carry no light fx.lineWidth = lw; fx.beginPath();
  for (const p of W) p.forEach(([x, y], j) => { const [X, Y] = toS(x, y); j ? fx.lineTo(X, Y) : fx.moveTo(X, Y); });
  for (const [x, y] of Sh) { const [X, Y] = toS(x, y), r = 0.32 * S * ppm; fx.moveTo(X + r, Y); fx.ellipse(X, Y, r, r * 0.7, 0.4, 0, TAU); fx.moveTo(X + r * 0.6 + 2, Y + 1); fx.ellipse(X + 2, Y + 1, r * 0.6, r * 0.45, 1.1, 0, TAU); }
  fx.stroke(); }

export const STRANDS = [
  // utility poles: every 30–40 m along one side of the streets in the suburbs, the barns and the fields (none in the old
  // town: its wires ran underground). Out of the crowns. Tended: upright; worn: some lean; ruined: lean or down.
  { id: 'pole', family: 'strands', slot: 'kerb', every: 32, chance: 0.55, space: 1.5, collide: { w: 0.5, h: 0.5 },
    fit: (c, s) => s.path || s.crown || s.side !== 1 || s.district === 'oldtown' || s.district === 'park' ? 0 : 1,
    variant: (c, h) => c > 0.62 ? 'up' : c > 0.32 ? (h < 0.22 ? 'lean' : 'up') : h < 0.3 ? 'down' : h < 0.62 ? 'lean' : 'up',
    volumes(i, K) { const [tx, ty, tz, b] = tip(i);
      if (i.variant === 'down') { K.capsule(i.x, i.y, 0, i.x + Math.cos(b) * 0.1, i.y + Math.sin(b) * 0.1, 0.8 * S, 0.12 * S, M.wood);   // the snapped stump
        K.capsule(i.x + Math.cos(b) * 0.5 * S, i.y + Math.sin(b) * 0.5 * S, 0.14, tx, ty, 0.12, 0.11 * S, M.wood); K.box(tx, ty, 0.1, 0.8 * S, 0.07 * S, 0.06 * S, 0.04, i.ang, M.wood); return; }
      K.capsule(i.x, i.y, 0, tx, ty, PH, 0.11 * S, M.wood);                                            // the post
      K.box(tx, ty, tz, 0.8 * S, 0.07 * S, 0.06 * S, 0.04, Math.atan2(i.slot.ny, i.slot.nx), M.wood);    // the cross-arm, across the street
      for (const k of [-0.65, 0, 0.65]) K.sphere(tx + i.slot.nx * k * S, ty + i.slot.ny * k * S, tz + 0.04, 0.06 * S, M.glass);   // insulators
      if (i.h > 0.8 && i.variant === 'up') { const ox = Math.cos(i.ang) * 0.32 * S, oy = Math.sin(i.ang) * 0.32 * S; K.capsule(tx + ox, ty + oy, PH - 1.7 * S, tx + ox, ty + oy, PH - 1.0 * S, 0.26 * S, M.steel); } },   // a transformer can
    strands(fx, i, v) { if (!i.wLinked) link(v.strands); if (i.wNext) span(fx, i, i.wNext, v);
      const p = i.wPrev; if (p) { const [X, Y] = v.toS(p.x, p.y); if (X < -300 || Y < -300 || X > v.cssW + 300 || Y > v.cssH + 300) span(fx, p, i, v); } } },   // its own span is drawn by the pole behind, unless that one is off screen

  // a washing line between two posts behind a house, clothes out to dry: only where people still live (tended, and the
  // survivor's house in the ruins); in a worn yard, rarely, left out and half fallen; never in a ruin
  { id: 'laundry', family: 'strands', slot: 'yard', every: 16, chance: 0.5, space: 1.2,
    fit: (c, s, f) => f && f.survivor && f.survivor.has(s.uid) ? (s.survivor = true, 0.6) : c > 0.62 ? 0.4 : c > 0.32 ? 0.05 : 0,
    variant: (c, h, s) => s.kind === 'door' || s.survivor || c > 0.62 ? 'up' : 'fallen',   // the story places it off a door slot: kept
    volumes(i, K) { const [p0, p1] = posts(i), r = 0.05 * S, ht = 1.75 * S;
      K.capsule(p0[0], p0[1], 0, p0[0], p0[1], ht, r, M.wood);
      if (i.variant === 'fallen') { const [cx, cy] = [Math.cos(i.h * TAU), Math.sin(i.h * TAU)]; K.capsule(p1[0], p1[1], 0.05, p1[0] + cx * ht * 0.9, p1[1] + cy * ht * 0.9, 0.06, r, M.wood); }
      else K.capsule(p1[0], p1[1], 0, p1[0], p1[1], ht, r, M.wood); },
    strands(fx, i, v) { laundry(fx, i, v); } },

  // chimney smoke: some tended houses keep a fire, a worn one now and then, every survivor's house does; in the ruins some
  // buildings still smoulder (darker, thicker, embers at night). The smoke leans downwind; a kept hearth has a chimney.
  { id: 'smoke', family: 'strands', slot: 'roof', every: 10, chance: 1,
    fit: (c, s, f) => { const t = s.tags || [];
      if (f && f.survivor && f.survivor.has(s.uid)) { s.survivor = true; return 1; }   // marked on the slot, for variant()
      if (/mast|tower|canopy|camp/.test(s.look) || t.includes('camp')) return 0;
      return c > 0.62 ? (t.includes('house') ? 0.22 : 0) : c > 0.32 ? (t.includes('house') ? 0.04 : 0) : 0.16; },
    variant: (c, h, s) => s.survivor || c > 0.32 ? 'hearth' : 'smoulder',
    volumes(i, K) { if (i.variant !== 'hearth' || !(i.slot.look === 'gable' || i.slot.look === 'flat')) return; const [x, y] = vent(i);
      K.box(x, y, 1.2, 0.32, 0.32, 0.6, 0.05, i.slot.ang, M.brick); K.box(x, y, 1.82, 0.2, 0.2, 0.04, 0.02, i.slot.ang, M.dark); },   // the chimney at the ridge, its flue
    strands(fx, i, v) { smoke(fx, i, v); } },
];

// ---------- washing ----------
// the posts: across the yard (parallel to the house); off a door slot (the story turns it) along its own facing
// (the story sets it beside the door, against the wall: it is strung along the front, a step out from the wall)
function posts(i) { if (!i.wp) { const door = i.slot.kind === 'door', a = i.ang + (door ? 0 : Math.PI / 2), c = Math.cos(a), s = Math.sin(a), L = 1.7 * S, ox = door ? s * 1.7 : 0, oy = door ? -c * 1.7 : 0;
  i.wa = a; i.wp = [[i.x + ox - c * L, i.y + oy - s * L], [i.x + ox + c * L, i.y + oy + s * L]]; } return i.wp; }
const CLOTH = [[230, 224, 209], [196, 192, 182], [96, 118, 142], [168, 153, 117], [150, 88, 76], [148, 166, 130]];
function laundry(fx, i, v) {
  const { toS, cam, t, night, WIND } = v, ppm = cam.ppm, [p0, p1] = posts(i), a = i.wa, ax = Math.cos(a), ay = Math.sin(a), px = -ay, py = ax, L = 3.4 * S;
  const wl = (WIND.x * px + WIND.y * py) * gust(v, i.x, i.y), wa = WIND.x * ax + WIND.y * ay, dim = 1 - 0.6 * night, fallen = i.variant === 'fallen';
  const line = u => fallen ? [lerp(p0[0], p1[0], u) + px * 0.3 * Math.sin(u * 3), lerp(p0[1], p1[1], u) + py * 0.3 * Math.sin(u * 3)] : [lerp(p0[0], p1[0], u) + px * wl * 0.12 * 4 * u * (1 - u), lerp(p0[1], p1[1], u) + py * wl * 0.12 * 4 * u * (1 - u)];
  // the line
  fx.strokeStyle = `rgba(${Math.round(200 * dim)},${Math.round(194 * dim)},${Math.round(180 * dim)},.75)`; fx.lineWidth = clamp(ppm * 0.035, 0.5, 1.1); fx.beginPath();
  for (let j = 0; j <= 4; j++) { const [X, Y] = toS(...line(j / 4)); j ? fx.lineTo(X, Y) : fx.moveTo(X, Y); } fx.stroke();
  // the clothes: seen from above a hanging thing is an edge; the wind lifts it out sideways, and it flaps
  const n = fallen ? 2 : 3 + Math.floor(i.h * 3), side = wl < 0 ? -1 : 1;
  for (let k = 0; k < n; k++) { const r = hs(i.h * 31, k), kind = r < 0.35 ? 0 : r < 0.75 ? 1 : 2, w = [0.95, 0.5, 0.3][kind] * S / L, hang = [1.1, 0.7, 0.45][kind] * S;
    const u = fallen ? 0.55 + k * 0.25 : (k + 0.5) / n + (hs(i.h, k) - 0.5) * 0.08, u0 = clamp(u - w / 2, 0.03, 0.97), u1 = clamp(u + w / 2, 0.03, 0.97), q0 = line(u0), q1 = line(u1);
    const col = CLOTH[kind === 0 ? (r < 0.2 ? 0 : 1) : 2 + Math.floor(hs(k, i.h * 17) * 4)], f = fallen ? 0.4 : 0.7;   // fallen washing is dusty
    fx.fillStyle = `rgba(${Math.round(col[0] * dim * f / 0.7)},${Math.round(col[1] * dim * f / 0.7)},${Math.round(col[2] * dim * f / 0.7)},.92)`;
    let d0, d1, sl; if (fallen) { d0 = d1 = hang * 0.8 * (k ? -1 : 1); sl = 0.2; }   // lying flat where it fell
    else { const fl = Math.sin(t * (2.2 + kind * 0.7) + k * 1.7 + i.h * 7); d0 = side * hang * (0.28 + 0.72 * Math.abs(wl)) * (0.62 + 0.38 * fl); d1 = d0 * (1 + 0.14 * Math.sin(t * 6.3 + k)); sl = wa * hang * 0.3; }
    const P = [q0, q1, [q1[0] + px * d1 + ax * sl, q1[1] + py * d1 + ay * sl], [q0[0] + px * d0 + ax * sl, q0[1] + py * d0 + ay * sl]].map(q => toS(q[0], q[1]));
    fx.beginPath(); fx.moveTo(P[0][0], P[0][1]); for (let j = 1; j < 4; j++) fx.lineTo(P[j][0], P[j][1]); fx.closePath(); fx.fill(); } }

// ---------- smoke ----------
// where it comes out: a kept hearth's chimney on the ridge, off the middle; a smouldering ruin anywhere in its footprint
function vent(i) { if (!i.vp) { const s = i.slot, c = Math.cos(s.ang), sn = Math.sin(s.ang), w = s.w || 6, h = s.h || 6;
  const lx = i.variant === 'hearth' ? (i.h < 0.5 ? -1 : 1) * (0.18 + 0.2 * i.h) * w : (i.h - 0.5) * w * 0.5, ly = i.variant === 'hearth' ? 0 : (hs(i.h, 3) - 0.5) * h * 0.5;
  i.vp = [i.x + lx * c - ly * sn, i.y + lx * sn + ly * c]; } return i.vp; }
function smoke(fx, i, v) {
  const { toS, cam, t, night, WIND } = v, ppm = cam.ppm, [sx, sy] = vent(i), hot = i.variant === 'smoulder', g = gust(v, sx, sy);
  const a = Math.atan2(WIND.y, WIND.x) + Math.sin(t * 0.3 + i.h * 5) * 0.22, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, L = (hot ? 11 : 7) * S * (0.75 + 0.35 * g);
  const n = hot ? 6 : 4, base = hot ? [64, 60, 58] : [206, 201, 190], al = (hot ? 0.5 : 0.36) * (1 - 0.45 * night), [X0, Y0] = toS(sx, sy), [X1, Y1] = toS(sx + dx * L, sy + dy * L);
  const grad = fx.createLinearGradient(X0, Y0, X1, Y1), c = base.join(','); grad.addColorStop(0, `rgba(${c},${al})`); grad.addColorStop(0.45, `rgba(${c},${al * 0.55})`); grad.addColorStop(1, `rgba(${c},0)`);
  // the column: seen from above it rises as a soft blob at the vent, then drifts downwind as a faint body and a fan of
  // fine strands that curl and part (the curl travels down the plume with time)
  fx.fillStyle = `rgba(${c},${al * 0.9})`; fx.beginPath(); fx.arc(X0, Y0, Math.max(1.2, (hot ? 0.7 : 0.42) * S * ppm), 0, TAU); fx.fill();
  fx.strokeStyle = grad; fx.lineCap = 'round'; fx.globalAlpha = 0.45; fx.lineWidth = Math.max(1.5, (hot ? 1.6 : 1.0) * S * ppm); fx.beginPath(); fx.moveTo(X0, Y0);
  { const [X, Y] = toS(sx + dx * L * 0.6, sy + dy * L * 0.6); fx.lineTo(X, Y); } fx.stroke(); fx.globalAlpha = 1;
  for (let k = 0; k < n; k++) { const sp = (k - (n - 1) / 2) * (hot ? 0.11 : 0.1), ph = i.h * 9 + k * 2.1; fx.lineWidth = Math.max(0.8, (hot ? 0.34 : 0.22) * S * ppm * (1 - k * 0.06)); fx.beginPath();
    for (let j = 0; j <= 7; j++) { const u = j / 7, d = L * Math.pow(u, 0.85), o = sp * d + Math.sin(t * 1.4 - u * 6 + ph) * 0.55 * S * u * (1 + g * 0.5), [X, Y] = toS(sx + dx * d + px * o, sy + dy * d + py * o); j ? fx.lineTo(X, Y) : fx.moveTo(X, Y); }
    fx.stroke(); }
  // a smouldering ruin glows a little at night, an ember or two lifting off downwind
  if (hot && night > 0.2) { fx.globalCompositeOperation = 'lighter'; const r = 1.2 * S * ppm, gl = fx.createRadialGradient(X0, Y0, 0, X0, Y0, r); gl.addColorStop(0, `rgba(255,110,40,${0.32 * night})`); gl.addColorStop(1, 'rgba(255,110,40,0)'); fx.fillStyle = gl; fx.fillRect(X0 - r, Y0 - r, 2 * r, 2 * r);
    fx.fillStyle = '#ffb060'; for (let e = 0; e < 3; e++) { const k = (t * 0.35 + hs(i.h, e)) % 1, o = (hs(e, i.h) - 0.5) * 2 * S * k, [X, Y] = toS(sx + dx * k * L * 0.45 + px * o, sy + dy * k * L * 0.45 + py * o); fx.globalAlpha = (1 - k) * night; fx.fillRect(X - 0.8, Y - 0.8, 1.7, 1.7); } fx.globalAlpha = 1; } }
