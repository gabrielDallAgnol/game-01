// [roam] The farm side: what stands in the fields (world/land.js lays the fields and their 'field', 'edge' and 'gate'
// slots). Hay bales left in rows on the stubble near a farm and stacked by its yard, water troughs in the pasture, field
// gates where a field meets its lane, wire fences (posts, and the wire strung between them on the overlay) along the
// fenced edges, a scarecrow in a few crop fields, and, where the land was let go, a tractor left where it stopped.
// Hedgerows are the land's own (painted strands in the ground shader). Solids are glyph volumes at the props' 1.3x.
// Care: tended → whole and tidy (wrapped bales, a shut gate, taut wire); worn → weathered, a gate left open, a post leaning;
// ruined → rotten or burnt bales, a gate off its hinges, posts down and wire snapped, the tractor burnt out.
import { M } from '../dress/mats.js';
import { hash } from '../dress/place.js';

const S = 1.3;
const band = c => c > 0.62 ? 2 : c > 0.32 ? 1 : 0;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// a local frame in life metres: u along the facing, w to its left, z up; scaled by S into the world
const kit = (i, K, a) => { const c = Math.cos(a), s = Math.sin(a), X = (u, w) => i.x + (u * c - w * s) * S, Y = (u, w) => i.y + (u * s + w * c) * S;
  return { box: (u, w, z, hx, hy, hz, r, rot, m, em) => K.box(X(u, w), Y(u, w), z * S, hx * S, hy * S, hz * S, r * S, a + rot, m, em),
    cap: (u0, w0, z0, u1, w1, z1, r, m, em) => K.capsule(X(u0, w0), Y(u0, w0), z0 * S, X(u1, w1), Y(u1, w1), z1 * S, r * S, m, em),
    ball: (u, w, z, r, m, em) => K.sphere(X(u, w), Y(u, w), z * S, r * S, m, em), X, Y }; };
const CROP = { wheat: 1, barley: 1, rape: 1 }, WORKED = { wheat: 1, barley: 1, rape: 1, stubble: 1, plough: 1 };
const nearFarm = (s, r) => s.farm < r ? 1 : s.farm < r * 2.4 ? 0.45 : 0.15;
// the sun now (the overlay is handed it), for the wire's shadow
const sunOf = v => v.sun || null;

// a fence's wire from this post to the next one along the edge: two strands, taut where kept, slack and snapped where not
function wire(fx, i, v) {
  const n = i.slot.next; if (!n) return; const { toS, cam, night, t, WIND } = v, ppm = cam.ppm; if (ppm < 4) return;
  const top = i.top || [i.x, i.y, 1.15 * S], lo = i.care < 0.32, slack = i.variant !== 'up' ? 0.6 : lo ? 0.35 : i.care < 0.62 ? 0.15 : 0.04;
  const sun = sunOf(v), day = sun ? 1 - night : 0, sh = day > 0.05 ? [-sun.x / Math.max(0.85, sun.climb), -sun.y / Math.max(0.85, sun.climb)] : null;
  const far = clamp((ppm - 4) / 6, 0.4, 1), m = clamp((12 - ppm) / 6, 0, 0.7), lw = clamp(ppm * 0.035, 0.6, 1.3);
  const W = [];
  for (const [k, h] of [[0, 1.0], [1, 0.6]]) { if (lo && hash(i.h, k, 3) < 0.4) continue;   // a strand gone
    const z0 = top[2] * h / 1.15, z1 = 1.15 * S * h, sag = slack * S * (1 + k * 0.3), sw = Math.sin(t * 1.3 + i.h * 9 + k) * 0.03 * (WIND.x + WIND.y) * (1 + slack * 4);
    const pts = []; for (let j = 0; j <= 4; j++) { const u = j / 4, b = 4 * u * (1 - u), x = top[0] + (n.x - top[0]) * u, y = top[1] + (n.y - top[1]) * u; pts.push([x + i.slot.nx * sw * b, y + i.slot.ny * sw * b, Math.max(0.03, z0 + (z1 - z0) * u - sag * b)]); }
    W.push(pts); }
  if (sh) { fx.strokeStyle = `rgba(0,0,0,${0.2 * day})`; fx.lineWidth = lw; fx.beginPath(); for (const p of W) p.forEach(([x, y, z], j) => { const [X, Y] = toS(x + sh[0] * z, y + sh[1] * z); j ? fx.lineTo(X, Y) : fx.moveTo(X, Y); }); fx.stroke(); }
  fx.strokeStyle = `rgba(${Math.round(40 + 110 * m)},${Math.round(39 + 110 * m)},${Math.round(36 + 112 * m)},${0.85 * far * (1 - 0.6 * night)})`; fx.lineWidth = lw; fx.beginPath();
  for (const p of W) p.forEach(([x, y], j) => { const [X, Y] = toS(x, y); j ? fx.lineTo(X, Y) : fx.moveTo(X, Y); }); fx.stroke(); }

// a scarecrow's rags: strips off its sleeves and hem that lift and flap downwind
const RAG = [[150, 132, 100], [118, 108, 92], [140, 84, 70], [96, 104, 120]];
function rags(fx, i, v) {
  if (i.variant === 'down') return; const { toS, cam, t, night, WIND } = v, ppm = cam.ppm; if (ppm < 6) return;
  const q = kit(i, null, i.ang + (i.h - 0.5) * 0.8), dim = 1 - 0.6 * night, n = i.variant === 'tattered' ? 6 : 3;
  for (let k = 0; k < n; k++) { const w0 = k % 3 === 0 ? -0.75 : k % 3 === 1 ? 0.75 : (hash(i.h, k) - 0.5) * 0.4, u0 = k % 3 === 2 ? -0.2 : 0, x = q.X(u0, w0), y = q.Y(u0, w0);
    const L = (0.25 + 0.3 * hash(i.h, k, 2)) * S * (i.variant === 'tattered' ? 1.5 : 1), fl = Math.sin(t * (3 + k) + i.h * 9 + k * 2), a = Math.atan2(WIND.y, WIND.x) + fl * 0.5;
    const c = RAG[Math.floor(hash(i.h, k, 5) * RAG.length)]; fx.strokeStyle = `rgba(${Math.round(c[0] * dim)},${Math.round(c[1] * dim)},${Math.round(c[2] * dim)},.9)`; fx.lineWidth = clamp(ppm * 0.07, 1, 3); fx.lineCap = 'round';
    const [X0, Y0] = toS(x, y), [X1, Y1] = toS(x + Math.cos(a) * L, y + Math.sin(a) * L), [Xm, Ym] = toS(x + Math.cos(a) * L * 0.5 + Math.cos(a + 1.57) * fl * 0.05, y + Math.sin(a) * L * 0.5 + Math.sin(a + 1.57) * fl * 0.05);
    fx.beginPath(); fx.moveTo(X0, Y0); fx.quadraticCurveTo(Xm, Ym, X1, Y1); fx.stroke(); } }

export const FARM = [
  // round bales left in a row where the baler dropped them, along the rows of the stubble (and now and then in a pasture
  // or meadow), mostly near a farm. Tended → wrapped in white or black film, or fresh straw; worn → greyed by the weather;
  // ruined → slumped and rotten, some burnt, one rolled away
  { id: 'baleRow', family: 'farm', slot: 'field', every: 34, chance: 0.42, space: 3, collide: { w: 14.2, h: 2.2 },
    fit: (c, s) => s.inward < 7 ? 0 : (s.land === 'stubble' ? 1 : s.land === 'pasture' ? 0.22 : s.land === 'meadow' ? 0.16 : 0) * nearFarm(s, 260),
    variant: (c, h) => band(c) === 2 ? (h < 0.4 ? 'wrapped' : 'straw') : band(c) === 1 ? 'grey' : h < 0.35 ? 'burnt' : 'rotten',
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant, film = hash(i.h, 9) < 0.5 ? M.cloth : M.dark;
      for (let k = 0; k < 4; k++) { if ((v === 'rotten' || v === 'burnt') && hash(i.h, k, 1) < 0.25) continue;
        const u = (k - 1.5) * 3.1 + (hash(i.h, k, 2) - 0.5) * 0.8, w = (hash(i.h, k, 3) - 0.5) * 0.9, tw = (hash(i.h, k, 4) - 0.5) * 0.35, r = v === 'burnt' ? 0.55 : 0.75, z = v === 'rotten' ? 0.5 : v === 'burnt' ? 0.35 : 0.75;
        const c = Math.cos(tw), s = Math.sin(tw), m = v === 'wrapped' ? film : v === 'straw' ? M.sack : v === 'grey' ? M.stone : v === 'burnt' ? M.burnt : M.hair;
        q.cap(u - s * 0.3, w - c * 0.3, z, u + s * 0.3, w + c * 0.3, z, r, m); } } },   // lying on its side, its axis across the row
  // square bales stacked by the farm: three, two, one; a tarp over a kept stack; a ruined one toppled and scattered
  { id: 'baleStack', family: 'farm', slot: 'field', every: 60, chance: 0.5, space: 3, collide: { w: 3.6, h: 5.0 },
    fit: (c, s) => s.inward < 6 || s.farm > 420 ? 0 : (s.land === 'stubble' || s.land === 'pasture' || s.land === 'meadow' ? 1 : 0) * (s.farm < 180 ? 1 : 0.35),
    variant: c => band(c) === 2 ? 'tarp' : band(c) === 1 ? 'stack' : 'toppled',
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant, m = v === 'toppled' ? M.hair : v === 'stack' ? M.stone : M.sack;
      if (v === 'toppled') { for (let k = 0; k < 5; k++) q.box((hash(i.h, k) - 0.5) * 3.4, (k - 2) * 1.25 + (hash(i.h, k, 1) - 0.5) * 0.6, k === 2 ? 1.35 : 0.45, 1.2, 0.6, 0.45, 0.1, (hash(i.h, k, 2) - 0.5) * 1.6, m); return; }
      for (let k = 0; k < 3; k++) q.box(0, (k - 1) * 1.22, 0.45, 1.2, 0.6, 0.45, 0.1, 0, m);
      for (let k = 0; k < 2; k++) q.box(0.05, (k - 0.5) * 1.22, 1.35, 1.2, 0.6, 0.45, 0.1, 0, m);
      if (v === 'tarp') q.box(0, 0, 2.02, 1.3, 1.35, 0.22, 0.4, 0, M.tarp); else q.box(0, 0, 2.25, 1.2, 0.6, 0.45, 0.1, 0.08, m); } },
  // a water trough in the pasture, near its edge where the pipe ran: galvanised, the water in it holding the sky; let go,
  // it stands dry or lies tipped. The ground round it was trodden to mud by the herd that is gone
  { id: 'trough', family: 'farm', slot: 'field', every: 80, chance: 0.5, space: 2.5, collide: { w: 2.8, h: 1.1 },
    fit: (c, s) => s.land !== 'pasture' ? 0 : s.inward < 14 ? 1 : 0.3,
    variant: c => band(c) === 0 ? 'tipped' : band(c) === 1 ? 'dry' : 'full',
    volumes(i, K) { const q = kit(i, K, i.ang + 1.57 * (i.h < 0.5 ? 1 : 0)), v = i.variant;
      if (v === 'tipped') { q.box(0, 0, 0.36, 1.0, 0.36, 0.3, 0.06, 0.2, M.rust); return; }
      for (const e of [-1, 1]) { q.box(0, e * 0.33, 0.3, 1.0, 0.06, 0.3, 0.03, 0, M.steel); q.box(e * 0.96, 0, 0.3, 0.06, 0.36, 0.3, 0.03, 0, M.steel); }
      q.box(0, 0, v === 'full' ? 0.25 : 0.06, 0.92, 0.28, v === 'full' ? 0.25 : 0.05, 0.02, 0, v === 'full' ? M.glass : M.dark); },
    paint(g, i) { g.translate(i.x, i.y); g.rotate(i.ang); const r = i.variant === 'tipped' ? 2.2 : 3.2;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * S); gr.addColorStop(0, 'rgba(0,70,0,1)'); gr.addColorStop(0.6, 'rgba(0,40,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * S, r * S * 0.75, 0.3, 0, 7); g.fill();
      if (i.variant === 'full') { g.fillStyle = 'rgb(0,0,110)'; g.beginPath(); g.ellipse(1.6, 0.8, 0.7, 0.4, 0.5, 0, 7); g.fill(); } } },   // a spill where it overflowed
  // a field gate where the field meets its lane, a gap in the hedge or the wire: shut where kept; left open where worn
  // (swung into the field); off its hinges, lying in the grass, in the ruins. Galvanised or wooden, by the farm
  { id: 'gate', family: 'farm', slot: 'gate', every: 8, chance: 1, breakable: true, collide: { w: 5.2, h: 0.5 }, fit: () => 1,
    variant: (c, h) => band(c) === 2 ? 'shut' : band(c) === 1 ? (h < 0.6 ? 'open' : 'shut') : h < 0.5 ? 'off' : 'open',
    volumes(i, K) { const q = kit(i, K, i.ang), v = i.variant, m = hash(i.h, 7) < 0.55 ? M.steel : M.wood, into = Math.sign(-Math.sin(i.ang) * i.slot.nx + Math.cos(i.ang) * i.slot.ny) || 1;
      for (const e of [-1, 1]) q.cap(e * 2.0, 0, 0, e * 2.0, 0, 1.25, 0.11, M.wood);
      if (v === 'off') { const a = (hash(i.h, 3) - 0.5) * 1.2, c = Math.cos(a), s = Math.sin(a); for (const w of [-0.45, 0, 0.45]) q.box(0.3 + -s * w, 1.4 * into + c * w, 0.06, 1.9, 0.05, 0.04, 0.02, a, m); return; }
      const a = v === 'open' ? into * (1.2 + 0.3 * hash(i.h, 4)) : 0, c = Math.cos(a), s = Math.sin(a), hu = -1.95;   // the hinge on one post
      for (const z of [1.05, 0.68, 0.32]) q.box(hu + c * 1.9, s * 1.9, z, 1.9, 0.06, 0.04, 0.02, a, m);
      q.cap(hu, 0, 0.32, hu + c * 3.8, s * 3.8, 1.05, 0.04, m); q.box(hu + c * 3.8, s * 3.8, 0.68, 0.05, 0.05, 0.42, 0.02, a, m); } },
  // wire fence posts along the fenced edges, one a slot (3 m); the wire runs to the next. Tended upright, worn a few lean,
  // ruined some lean or lie down and the wire hangs or is gone
  { id: 'fencePost', family: 'farm', slot: 'edge', every: 2.4, chance: 1, fit: (c, s) => s.edge === 'fence' ? 1 : 0,
    variant: (c, h) => band(c) === 2 ? 'up' : band(c) === 1 ? (h < 0.18 ? 'lean' : 'up') : h < 0.22 ? 'down' : h < 0.5 ? 'lean' : 'up',
    volumes(i, K) { const H = 1.15 * S, r = 0.075 * S, a = i.h * 6.283;
      if (i.variant === 'down') { const x1 = i.x + Math.cos(a) * H, y1 = i.y + Math.sin(a) * H; K.capsule(i.x, i.y, 0.08, x1, y1, 0.08, r, M.wood); i.top = [i.x, i.y, 0.1]; return; }
      const l = i.variant === 'lean' ? 0.35 * S : 0, tx = i.x + Math.cos(a) * l, ty = i.y + Math.sin(a) * l; K.capsule(i.x, i.y, 0, tx, ty, H - l * 0.3, r, M.wood); i.top = [tx, ty, H - l * 0.3]; },
    strands(fx, i, v) { wire(fx, i, v); } },
  // a scarecrow in a few crop fields, far in from the edge: a coat on a cross of sticks, a sack head, a hat; rags in the
  // wind. Worn: tattered, or dressed by someone in a road crew's orange vest; ruined: tattered, or fallen into the crop
  { id: 'scarecrow', family: 'farm', slot: 'field', every: 150, chance: 0.14, space: 2, breakable: true, collide: { w: 0.7, h: 0.7 },
    fit: (c, s) => CROP[s.land] && s.inward > 12 ? 1 : 0,
    variant: (c, h) => band(c) === 2 ? 'up' : band(c) === 1 ? (h < 0.45 ? 'vest' : 'tattered') : h < 0.5 ? 'down' : 'tattered',
    volumes(i, K) { const v = i.variant, q = kit(i, K, i.ang + (i.h - 0.5) * 0.8), coat = v === 'vest' ? M.cone : hash(i.h, 2) < 0.5 ? M.cloth : M.tarp;
      if (v === 'down') { q.cap(-0.9, 0, 0.1, 0.8, 0, 0.1, 0.06, M.wood); q.cap(0.35, -0.7, 0.12, 0.35, 0.7, 0.12, 0.05, M.wood); q.box(0.2, 0, 0.16, 0.32, 0.3, 0.12, 0.08, 0, coat); q.ball(0.75, 0, 0.14, 0.14, M.sack); q.box(1.2, 0.4, 0.04, 0.22, 0.22, 0.03, 0.18, 0.4, M.dark); return; }
      q.cap(0, 0, 0, 0, 0, 1.55, 0.06, M.wood); q.cap(0, -0.72, 1.36, 0, 0.72, 1.36, 0.05, M.wood);
      q.box(0, 0, 1.12, 0.17, 0.33, 0.3, 0.12, 0, coat); q.cap(0, -0.62, 1.34, 0, 0.62, 1.34, 0.09, v === 'tattered' ? M.sack : coat);
      q.ball(0, 0, 1.62, 0.15, M.sack); if (v !== 'tattered') { q.box(0, 0, 1.76, 0.27, 0.27, 0.025, 0.2, 0, M.dark); q.box(0, 0, 1.84, 0.13, 0.13, 0.07, 0.1, 0, M.dark); } },
    strands(fx, i, v) { rags(fx, i, v); } },
  // a tractor left where it stopped, out in a worked field: only where the land was let go. Worn: stalled, a door open
  // (oil under the engine, its tracks behind it); ruined: burnt out, or stripped to rust with a wheel gone. In a plough
  // field the plough is still on behind it, mid-furrow
  { id: 'tractor', family: 'farm', slot: 'field', every: 260, chance: 0.1, space: 4, collide: { w: 4.8, h: 2.8 },
    fit: (c, s) => !WORKED[s.land] || s.inward < 9 ? 0 : c > 0.62 ? 0 : c > 0.32 ? 0.55 : 1,
    variant: (c, h) => band(c) >= 1 ? 'stalled' : h < 0.5 ? 'burnt' : 'stripped',
    volumes(i, K) { const v = i.variant, q = kit(i, K, i.ang), burnt = v === 'burnt', strip = v === 'stripped', col = burnt ? M.burnt : strip ? M.rust : hash(i.h, 3) < 0.65 ? M.carRed : M.carGreen, tyre = burnt ? M.rust : M.rubber;
      // read from above: two big rear wheels either side of the cab, small front wheels by a long bonnet, the exhaust stack
      for (const e of [-1, 1]) { if (!(strip && e > 0)) q.box(-0.85, e * 0.95, burnt ? 0.5 : 0.75, 0.72, 0.26, burnt ? 0.5 : 0.75, 0.34, 0, tyre); else q.box(-0.85, e * 0.6, 0.3, 0.2, 0.2, 0.3, 0.05, 0, M.wood);   // up on a block
        q.box(1.3, e * 0.72, 0.42, 0.42, 0.17, 0.42, 0.2, 0, tyre); }
      q.box(0.75, 0, 0.95, 1.05, 0.34, 0.32, 0.16, 0, col); q.box(-0.85, 0, 1.0, 0.55, 0.55, 0.3, 0.1, 0, col);
      q.box(-0.85, 0, 1.75, 0.45, 0.5, 0.45, 0.1, 0, burnt || strip ? M.dark : M.glass);
      if (!burnt) q.box(-0.85, 0, 2.28, 0.5, 0.56, 0.05, 0.08, 0, col); q.cap(1.2, 0.2, 1.2, 1.22, 0.2, 2.0, 0.06, M.dark);
      if (i.slot.land === 'plough') { q.box(-2.6, 0, 0.35, 0.7, 0.9, 0.2, 0.08, 0, M.steel); q.cap(-1.6, 0, 0.55, -2.2, 0, 0.45, 0.06, M.steel); } },
    paint(g, i) { g.translate(i.x, i.y); g.rotate(i.ang); const v = i.variant;
      if (v !== 'stripped') { const gr = g.createLinearGradient(-1.2 * S, 0, -16, 0); gr.addColorStop(0, 'rgba(0,70,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; for (const e of [-1, 1]) g.fillRect(-16, e * 0.78 * S - 0.35, 16 - 1.2 * S, 0.7); }   // its tracks behind it
      g.fillStyle = v === 'burnt' ? 'rgb(0,150,0)' : 'rgb(0,90,0)'; g.beginPath(); g.ellipse(0.6 * S, 0, (v === 'burnt' ? 3.4 : 1.0) * S, (v === 'burnt' ? 2.4 : 0.6) * S, 0, 0, 7); g.fill(); } },
];
