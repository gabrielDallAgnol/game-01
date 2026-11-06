// [roam] The open ground's things (Gabriel, Nov 2: "some areas are just a grey field"): what lies between the fields and
// the lanes, each with a reason from that night or the years before it. Laid by world/wilds.js (no slots: open grass has
// none), drawn like any atom (glyph volumes at the props' 1.3x; ground marks into the decal map; wires on the overlay).
//   pylon     the power line marching across the land (the wires hang between them; one in a few is down, wires snapped)
//   rocks     boulders the plough turned up and piled at a field's corner
//   deadtree  a lone tree, dead (burnt where the grey came through)
//   husk      a machine that died out here: ribs, a head plate, a dark stain (someone fought back)
//   cart      the flight: a hand cart tipped over, suitcases spilled, a bicycle down beside it
//   camp      where people slept the first night out: a tent, a ring of stones, the fire long dead
//   crater    a walker's stomp: a scorched hollow, chunks thrown out
//   bus       the school bus that didn't make the bridge, burnt out on the verge
//   billboard by a lane: two legs and a board (colour comes back to it with the land)
// Colour is the land's: the grey world desaturates all of it until the area is clean.
import { M } from '../dress/mats.js';
import { hash } from '../dress/place.js';

const S = 1.3;
const kit = (i, K, a) => { const c = Math.cos(a), s = Math.sin(a), X = (u, w) => i.x + (u * c - w * s) * S, Y = (u, w) => i.y + (u * s + w * c) * S;
  return { box: (u, w, z, hx, hy, hz, r, rot, m, em) => K.box(X(u, w), Y(u, w), z * S, hx * S, hy * S, hz * S, r * S, a + rot, m, em),
    cap: (u0, w0, z0, u1, w1, z1, r, m, em) => K.capsule(X(u0, w0), Y(u0, w0), z0 * S, X(u1, w1), Y(u1, w1), z1 * S, r * S, m, em),
    ball: (u, w, z, r, m, em) => K.sphere(X(u, w), Y(u, w), z * S, r * S, m, em), X, Y }; };
const blot = (g, i, rx, ry, col) => { g.save(); g.translate(i.x, i.y); g.rotate(i.ang); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill(); g.restore(); };

// the pylon's wires: from its arms to the next pylon's, sagging, with their shadow (like the fence wire, bigger)
function wires(fx, i, v) { const n = i.next; if (!n || i.variant === 'down' || n.variant === 'down') return; const { toS, cam, night } = v, ppm = cam.ppm; if (ppm < 2) return;
  const sun = v.sun, day = sun ? 1 - night : 0, sh = day > 0.05 ? [-sun.x / Math.max(0.85, sun.climb), -sun.y / Math.max(0.85, sun.climb)] : null, lw = Math.max(0.6, Math.min(1.4, ppm * 0.05));
  const L = Math.hypot(n.x - i.x, n.y - i.y) || 1, nx = -(n.y - i.y) / L, ny = (n.x - i.x) / L, z = 7.6 * S, lines = [];
  for (const e of [-1, 0, 1]) { const pts = []; for (let j = 0; j <= 8; j++) { const u = j / 8, b = 4 * u * (1 - u); pts.push([i.x + (n.x - i.x) * u + nx * e * 2.2 * S, i.y + (n.y - i.y) * u + ny * e * 2.2 * S, z - b * 2.4 * S]); } lines.push(pts); }
  const path = off => { fx.beginPath(); for (const p of lines) p.forEach(([x, y, h], j) => { const [X, Y] = toS(x + (off ? off[0] * h : 0), y + (off ? off[1] * h : 0)); j ? fx.lineTo(X, Y) : fx.moveTo(X, Y); }); fx.stroke(); };
  fx.lineWidth = lw; if (sh) { fx.strokeStyle = `rgba(0,0,0,${0.18 * day})`; path(sh); }
  fx.strokeStyle = `rgba(40,40,42,${0.8 * (1 - 0.5 * night)})`; path(null); }

export const WILDS = {
  pylon: { id: 'pylon', collide: { w: 2.6, h: 2.6 },
    volumes(i, K) { const q = kit(i, K, i.ang);
      if (i.variant === 'down') {   // toppled across the grass, its legs torn out of the footings
        for (const e of [-1, 1]) q.cap(0, e * 1.1, 0.3, 7, e * 0.4, 0.4, 0.09, M.steel); q.cap(7, -1.8, 0.5, 7, 1.8, 0.5, 0.08, M.steel); for (let k = 1; k < 4; k++) q.cap(k * 1.8, -1, 0.35, k * 1.8 + 1.4, 1, 0.35, 0.05, M.steel);
        for (const e of [-1, 1]) q.box(-0.4, e * 1.1, 0.15, 0.35, 0.35, 0.15, 0.05, 0, M.stone); return; }
      for (const e of [-1, 1]) for (const f of [-1, 1]) { q.box(e * 1.1, f * 1.1, 0.12, 0.3, 0.3, 0.12, 0.04, 0, M.stone); q.cap(e * 1.1, f * 1.1, 0.2, e * 0.35, f * 0.35, 7.4, 0.08, M.steel); }
      for (const z of [2.6, 5]) { const r = 1.1 - z / 7.4 * 0.75; q.cap(-r, -r, z, r, r, z + 1.2, 0.04, M.steel); q.cap(-r, r, z, r, -r, z + 1.2, 0.04, M.steel); }
      q.cap(0, -2.4, 7.4, 0, 2.4, 7.4, 0.08, M.steel); q.cap(0, -1.6, 6.4, 0, 1.6, 6.4, 0.06, M.steel); for (const e of [-1, 0, 1]) q.ball(0, e * 2.2, 7.3, 0.14, M.glass); },
    strands: wires },
  rocks: { id: 'rocks', collide: { w: 3.4, h: 2.6 },
    volumes(i, K) { const q = kit(i, K, i.ang), n = 3 + Math.floor(i.h * 3);
      for (let k = 0; k < n; k++) { const a = k * 2.4 + i.h * 6, r = k ? 0.9 + hash(i.h, k) * 0.6 : 0, s = k ? 0.35 + hash(i.h, k, 2) * 0.35 : 0.8; q.ball(Math.cos(a) * r, Math.sin(a) * r, s * 0.7, s, M.stone); } } },
  deadtree: { id: 'deadtree', collide: { w: 0.8, h: 0.8 },
    volumes(i, K) { const q = kit(i, K, i.ang), m = i.variant === 'burnt' ? M.burnt : M.wood; q.cap(0, 0, 0, 0.2, 0.1, 4.2, 0.22, m);
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + i.h * 5, z = 2.2 + k * 0.5, L = 1.6 - k * 0.25; q.cap(0.1, 0, z, Math.cos(a) * L, Math.sin(a) * L, z + 0.9, 0.08, m); }
      if (i.variant === 'burnt') q.ball(0, 0, 0.1, 0.5, M.dark); },
    paint(g, i) { if (i.variant === 'burnt') blot(g, i, 3.2, 3.2, 'rgb(0,120,0)'); } },
  husk: { id: 'husk', collide: { w: 4.6, h: 2.6 },
    volumes(i, K) { const q = kit(i, K, i.ang); q.cap(-2.2, 0, 0.4, 2.0, 0, 0.5, 0.22, M.rust);   // the spine
      for (let k = -3; k <= 3; k++) for (const e of [-1, 1]) q.cap(k * 0.6, 0, 0.55, k * 0.6 + 0.2, e * 1.3, 0.15 + (k & 1) * 0.2, 0.07, k % 2 ? M.rust : M.dark);   // ribs, splayed
      q.box(2.5, 0, 0.45, 0.6, 0.55, 0.35, 0.15, 0.3, M.dark); q.ball(2.9, 0.25, 0.6, 0.13, M.burnt); q.box(-2.6, 0.4, 0.2, 0.4, 0.3, 0.2, 0.1, 0.8, M.steel); },
    paint(g, i) { blot(g, i, 4.6, 2.6, 'rgb(0,90,0)'); } },
  cart: { id: 'cart',
    volumes(i, K) { const q = kit(i, K, i.ang); q.box(0, 0, 0.45, 0.9, 0.55, 0.3, 0.05, 0.5, M.wood); q.cap(-0.6, 0.6, 0.3, -1.6, 1.0, 0.1, 0.05, M.wood); q.cap(-0.6, -0.4, 0.3, -1.6, -0.1, 0.1, 0.05, M.wood);
      q.box(0.6, 0.9, 0.42, 0.42, 0.06, 0.42, 0.02, 0.5, M.rubber);   // a wheel up in the air
      const C = [M.carRed, M.carBlue, M.carCream, M.tarp]; for (let k = 0; k < 3; k++) q.box(1.3 + k * 0.6, -0.5 + hash(i.h, k) * 1.4, 0.18, 0.32, 0.22, 0.18, 0.04, hash(i.h, k, 3) * 3, C[(k + Math.floor(i.h * 4)) % 4]);
      // a bicycle down beside it
      q.cap(-0.3, -1.6, 0.08, 1.0, -1.7, 0.08, 0.03, M.steel); for (const u of [-0.4, 1.1]) q.ball(u, -1.65, 0.06, 0.32, M.rubber); } },
  camp: { id: 'camp', collide: { w: 2.6, h: 2.2 },
    volumes(i, K) { const q = kit(i, K, i.ang), slump = i.variant === 'down'; for (const e of [-1, 1]) q.box(0, e * 0.55, slump ? 0.3 : 0.6, 1.2, 0.6, 0.06, 0.03, e * (slump ? 0.2 : 0.75), M.tarp);
      if (!slump) q.cap(-1.2, 0, 1.1, 1.2, 0, 1.1, 0.04, M.dark);
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; q.ball(2.4 + Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.1, 0.13, M.stone); } q.cap(2.1, -0.2, 0.08, 2.7, 0.2, 0.1, 0.06, M.burnt);
      q.box(1.2, 1.4, 0.15, 0.25, 0.18, 0.15, 0.03, 0.4, M.steel); },
    paint(g, i) { const c = Math.cos(i.ang), s = Math.sin(i.ang); g.fillStyle = 'rgb(0,140,0)'; g.beginPath(); g.arc(i.x + c * 2.4 * S, i.y + s * 2.4 * S, 0.8, 0, 7); g.fill(); } },
  crater: { id: 'crater',
    volumes(i, K) { const q = kit(i, K, i.ang); for (let k = 0; k < 5; k++) { const a = k * 1.26 + i.h * 4, r = 2.6 + hash(i.h, k) * 1.2; q.box(Math.cos(a) * r, Math.sin(a) * r, 0.12, 0.3, 0.22, 0.12, 0.05, a, k % 2 ? M.stone : M.burnt); } },
    paint(g, i) { g.save(); g.translate(i.x, i.y); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 3.6); gr.addColorStop(0, 'rgb(0,200,0)'); gr.addColorStop(0.7, 'rgb(0,120,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 3.6, 0, 7); g.fill();
      g.strokeStyle = 'rgb(90,0,0)'; g.lineWidth = 0.35; g.beginPath(); g.arc(0, 0, 2.9, 0, 7); g.stroke(); g.restore(); } },
  bus: { id: 'bus', collide: { w: 10.6, h: 2.8 },
    volumes(i, K) { const q = kit(i, K, i.ang), burnt = i.variant !== 'whole', body = burnt ? M.burnt : M.cone;
      q.box(0, 0, 1.25, 4.0, 0.95, 0.85, 0.15, 0, body); q.box(0.2, 0, 1.75, 3.6, 0.98, 0.3, 0.08, 0, burnt ? M.dark : M.glass); q.box(3.8, 0, 2.15, 0.25, 0.9, 0.06, 0.04, 0, burnt ? M.rust : body);
      for (const u of [-2.6, 2.6]) for (const e of [-1, 1]) q.box(u, e * 0.95, 0.4, 0.42, 0.16, 0.4, 0.18, 0, burnt ? M.rust : M.rubber);
      if (!burnt) q.box(4.05, 0, 1.0, 0.06, 0.8, 0.3, 0.02, 0, M.lamp); },
    paint(g, i) { blot(g, i, 6.8 * S / 1.3, 2.6, i.variant !== 'whole' ? 'rgb(0,150,0)' : 'rgb(0,60,0)'); } },
  billboard: { id: 'billboard', collide: { w: 0.8, h: 4.2 },
    volumes(i, K) { const q = kit(i, K, i.ang), torn = i.variant === 'torn', C = [M.carRed, M.carBlue, M.cone, M.carGreen][Math.floor(i.h * 4)];
      for (const e of [-1, 1]) q.cap(0, e * 1.6, 0, 0, e * 1.6, 3.2, 0.09, M.steel);
      q.box(0, 0, 3.9, 0.12, 2.3, 0.9, 0.03, 0, torn ? M.dark : M.carCream); if (!torn) { q.box(0.13, -0.6, 4.1, 0.02, 1.4, 0.45, 0.02, 0, C); q.box(0.13, 1.3, 3.6, 0.02, 0.7, 0.2, 0.02, 0, M.dark); }
      else q.box(0.13, 0.9, 3.7, 0.02, 1.1, 0.5, 0.02, 0.2, C); } },
};
