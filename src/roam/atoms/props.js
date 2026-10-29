// [roam] Props and cars: what people left in the street when the ash came. Parked cars where people lived and shopped,
// benches where they sat, wheelie bins by the fronts, the old town's post box; and the story-only things a crash, a
// barricade or a storm leaves (barriers, sandbags, cones, debris, a fallen tree). All solid glyph volumes at props scale.
import { M } from '../dress/mats.js';
import { hash } from '../dress/place.js';

// a local frame in life metres: (lx along the facing, ly to its left, z up), scaled by K.S into the world
const kit = (i, K, a, ox = 0, oy = 0) => { const S = K.S, c = Math.cos(a), s = Math.sin(a), X = (u, w) => i.x + ox + (u * c - w * s) * S, Y = (u, w) => i.y + oy + (u * s + w * c) * S;
  return { box: (u, w, z, hx, hy, hz, r, rot, m, em) => K.box(X(u, w), Y(u, w), z * S, hx * S, hy * S, hz * S, r * S, a + rot, m, em),
    cap: (u0, w0, z0, u1, w1, z1, r, m, em) => K.capsule(X(u0, w0), Y(u0, w0), z0 * S, X(u1, w1), Y(u1, w1), z1 * S, r * S, m, em),
    ball: (u, w, z, r, m, em) => K.sphere(X(u, w), Y(u, w), z * S, r * S, m, em) }; };
const face = i => i.slot.nx != null ? Math.atan2(i.slot.ny, i.slot.nx) + (i.ang - i.slot.ang) : i.ang;   // toward the road (stories' turn kept)
const band = c => c > 0.62 ? 2 : c > 0.32 ? 1 : 0;
// cars cluster by street block: a stretch of street (its id, a 40 m cell) either had people parking on it or did not
const block = s => hash(s.street || 0, Math.floor(s.x / 40), Math.floor(s.y / 40), 11);
const PAINT = [M.carCream, M.carBlue, M.carCream, M.carRed, M.carGreen, M.carBlue, M.carRed, M.carCream];
// the three cars (life half-sizes): L half-length, Wd half-width, cab/roof along-offsets and half-lengths, axle
const CARS = { sedan: { L: 2.2, Wd: 0.88, cab: [-0.15, 1.2], roof: [-0.3, 0.72], ax: 1.35 }, hatch: { L: 1.9, Wd: 0.86, cab: [-0.35, 1.25], roof: [-0.55, 0.85], ax: 1.2 },
  van: { L: 2.45, Wd: 0.97, ax: 1.6 } };

function carVolumes(i, K) {
  const v = i.variant, k = i.h < 0.13 ? 'van' : i.h < 0.36 ? 'hatch' : 'sedan', C = CARS[k], q = kit(i, K, i.ang), burnt = v === 'burnt', crash = v === 'crashed';
  const col = burnt ? M.burnt : PAINT[Math.floor(hash(i.h, 3) * PAINT.length)], h2 = hash(i.h, 7), L = C.L, Wd = C.Wd;
  const lift = burnt ? -0.2 : v === 'flat' ? -0.06 : 0, nose = crash ? 0.55 : 0;   // a shell sits on its rims; a crash lost its nose
  // wheels at the corners (a shell keeps rusted rims; a flat one squats)
  for (const a of [-1, 1]) for (const b of [-1, 1]) { const flat = v === 'flat' && a > 0 && b > 0;
    if (burnt) q.box(a * C.ax, b * (Wd - 0.06), 0.2, 0.22, 0.1, 0.2, 0.06, 0, M.rust); else q.box(a * C.ax - (a > 0 ? nose * 0.4 : 0), b * (Wd + 0.02), flat ? 0.2 : 0.32, 0.32, flat ? 0.17 : 0.13, flat ? 0.2 : 0.32, 0.1, flat ? 0.15 : 0, M.rubber); }
  if (k === 'van') {   // a box van: the tall cargo body, a low bonnet, the windscreen between
    q.box(-0.55, 0, 0.98 + lift, L - 0.55, Wd, 0.74, 0.22, 0, v === 'dusty' ? M.stone : col);
    q.box(L - 0.55 - nose / 2, 0, 0.62 + lift, 0.58 - nose / 2, Wd - 0.04, 0.3, 0.22, 0, col);
    if (!burnt) q.box(L - 0.95, 0, 1.05 + lift, 0.27, Wd - 0.08, 0.35, 0.12, 0, crash ? M.dark : M.glass);
    else q.box(L - 1.2, 0, 1.0 + lift, 0.36, Wd - 0.12, 0.2, 0.1, 0, M.dark);
  } else {   // sedan and hatch: the body, the glass cab over it, the roof on top (the glass shows as the windscreen and rear window)
    q.box(-nose / 2, 0, 0.56 + lift, L - nose / 2, Wd, 0.32, 0.26, 0, col);
    if (crash) q.box(L - nose - 0.25, 0, 0.82, 0.42, Wd - 0.05, 0.1, 0.08, 0.32 * (h2 < 0.5 ? 1 : -1), col);   // the bonnet, buckled up and skewed
    if (burnt) { q.box(C.cab[0], 0, 0.8 + lift, C.cab[1] - 0.15, Wd - 0.16, 0.12, 0.08, 0, M.dark);      // gutted: the black inside, the roof rails
      for (const b of [-1, 1]) q.cap(C.roof[0] - C.roof[1], b * (Wd - 0.2), 1.12 + lift, C.roof[0] + C.roof[1] + 0.3, b * (Wd - 0.18), 1.08 + lift, 0.05, M.burnt); }
    else { q.box(C.cab[0], 0, 1.02 + lift, C.cab[1], Wd - 0.1, 0.3, 0.26, 0, M.glass); q.box(C.roof[0], 0, 1.17 + lift, C.roof[1], Wd - 0.17, 0.2, 0.18, 0, v === 'dusty' ? M.stone : col);   // left a year: the ash lies on the roof
      if (crash) q.box(C.cab[0] + C.cab[1] - 0.3, 0.15 * (h2 - 0.5), 1.08, 0.24, Wd - 0.3, 0.26, 0.1, 0, M.dark); }   // the windscreen stoved in
  }
  // left open: a door swung out from the driver's side (or the other)
  if (v === 'open' || (crash && h2 > 0.6)) { const b = h2 < 0.5 ? 1 : -1, hx = 0.48, a = 0.95 * b; q.box(0.35 + Math.cos(a) * hx - hx, b * Wd + Math.sin(a) * hx, 0.62, hx, 0.04, 0.34, 0.03, a, col); }
}
function carPaint(g, i) {
  const v = i.variant, S = 1.3;
  g.save(); g.translate(i.x, i.y); g.rotate(i.ang);
  if (v === 'burnt') { g.fillStyle = 'rgb(0,150,0)'; g.beginPath(); g.ellipse(0, 0, 3.3 * S, 1.6 * S, 0, 0, 7); g.fill(); g.fillStyle = 'rgb(0,60,0)'; g.beginPath(); g.ellipse(0.4, 0.3, 4.2 * S, 2.2 * S, 0.1, 0, 7); g.fill(); }
  else if (v !== 'parked') { g.fillStyle = `rgb(0,${v === 'crashed' ? 120 : 55},0)`; g.beginPath(); g.ellipse(1.4 * S, 0, 0.9 * S, 0.6 * S, 0, 0, 7); g.fill(); }   // oil from the engine
  if (v === 'crashed') { g.fillStyle = 'rgb(150,0,0)'; for (let k = 0; k < 14; k++) { const a = hash(i.h, k) * 6.28, r = (1.5 + hash(k, i.h) * 2.2) * S; g.fillRect(2.4 * S + Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.7, 0.08, 0.08); } }   // glass in the road
  g.restore();
}

export const PROPS = [
  // parked cars: where people lived and shopped (kept streets, the old town), fewer at the works and fields, none on
  // paths (no parking slots there). By the block: a stretch either has a few or none. Tended → parked square to the kerb;
  // worn → askew, dusty, a door left open, a flat; ruined → burnt shells, some up on the pavement or slewed across
  { id: 'car', family: 'props', slot: 'parking', every: 7.5, chance: 0.42, space: 1.2, collide: { w: 6.1, h: 2.6 },
    fit: (c, s) => block(s) < 0.42 ? 0 : 0.18 + 0.82 * Math.min(1, Math.max(0, (c - 0.15) / 0.55)),
    variant(c, h, s, i) { const b = band(c), r = hash(h, 1), r2 = hash(h, 2);
      if (b === 2) { if (i) i.ang += (r - 0.5) * 0.04; return 'parked'; }
      if (b === 1) { if (i) { i.ang += (r - 0.5) * 0.22; i.x += Math.cos(i.ang + Math.PI / 2) * (r2 - 0.4) * 0.5; i.y += Math.sin(i.ang + Math.PI / 2) * (r2 - 0.4) * 0.5; } return r2 < 0.35 ? 'open' : r2 < 0.6 ? 'flat' : 'dusty'; }
      if (i) { const up = r2 < 0.35, turned = !up && r2 < 0.6, a = i.ang + Math.PI / 2;   // the kerb is the slot's left
        if (up) { i.x += Math.cos(a) * 1.3; i.y += Math.sin(a) * 1.3; i.ang += (r - 0.5) * 0.3; } else i.ang += turned ? (r < 0.5 ? -1 : 1) * (0.5 + r2) : (r - 0.5) * 0.3; }
      return r < 0.82 ? 'burnt' : 'crashed'; },
    volumes: (i, K) => carVolumes(i, K), paint: carPaint },
  // benches face the road: in the parks and the old town, and wherever a tree gives shade. Tended → whole; worn → a slat
  // gone; ruined → rare, broken down on one end
  { id: 'bench', family: 'props', slot: 'pavement', every: 34, chance: 0.08, space: 2, collide: { w: 0.9, h: 2.5 },
    fit: (c, s) => { const b = band(c); return (s.crown ? 0.9 : c > 0.45 && c < 0.75 ? 0.55 : 0.2) * (b === 0 ? 0.15 : 1); },
    variant: (c, h) => band(c) === 2 ? 'whole' : band(c) === 1 ? (hash(h, 4) < 0.6 ? 'slat' : 'whole') : 'broken',
    volumes(i, K) { const q = kit(i, K, face(i)), v = i.variant, gone = hash(i.h, 5) < 0.5 ? 1 : 0;
      if (v === 'broken') { q.box(0, 0.85, 0.38, 0.24, 0.05, 0.38, 0.03, 0, M.steel);   // one end still stands; the slats are down
        q.box(0.06, 0.1, 0.18, 0.08, 0.86, 0.04, 0.03, 0.35, M.wood); q.box(-0.25, -0.1, 0.05, 0.07, 0.9, 0.04, 0.03, -0.12, M.wood); q.box(-0.12, -0.85, 0.12, 0.24, 0.05, 0.12, 0.03, 1.2, M.steel); return; }
      for (const e of [-1, 1]) q.box(-0.02, e * 0.85, 0.38, 0.25, 0.045, 0.38, 0.03, 0, M.steel);     // the iron ends
      for (const [k, u] of [[0, 0.13], [1, -0.07]]) if (!(v === 'slat' && k === gone)) q.box(u, 0, 0.46, 0.085, 0.95, 0.035, 0.03, 0, M.wood);   // seat slats
      q.box(-0.24, 0, 0.78, 0.04, 0.95, 0.15, 0.03, 0, M.wood); } },                              // the back, away from the road
  // wheelie bins against the fronts, mostly in the kept streets. Tended → upright, lid shut; worn → lid open; ruined →
  // tipped over, rubbish spilt. 'tidy' (a story): a survivor keeps a pair, square to the wall
  { id: 'bin', family: 'props', slot: 'wall', every: 16, chance: 0.08, space: 1, collide: { w: 0.9, h: 0.9 },
    fit: (c, s) => s.path ? 0 : [0.25, 0.4, 0.75][band(c)],
    variant: (c, h) => band(c) === 2 ? 'shut' : band(c) === 1 ? (hash(h, 6) < 0.6 ? 'open' : 'shut') : 'tipped',
    volumes(i, K) { const v = i.variant, fa = face(i) + (v === 'tidy' ? 0 : (i.h - 0.5) * 0.5);
      if (v === 'tipped') { const q = kit(i, K, fa + (i.h - 0.5) * 2.4);   // on its side: its mouth to the road, the lid flung off
        q.box(0, 0, 0.3, 0.5, 0.3, 0.3, 0.06, 0, M.binGreen); q.box(0.52, 0, 0.3, 0.03, 0.26, 0.26, 0.02, 0, M.dark); q.box(1.1, 0.35, 0.03, 0.35, 0.3, 0.03, 0.02, 0.6, M.binGreen); return; }
      const one = (dy) => { const q = kit(i, K, fa, 0, 0), y = dy; q.box(0, y, 0.5, 0.36, 0.29, 0.5, 0.06, 0, M.binGreen);
        if (v === 'open') { q.box(0.02, y, 1.0, 0.31, 0.24, 0.01, 0.01, 0, M.dark); q.box(-0.41, y, 1.32, 0.03, 0.3, 0.34, 0.02, 0, M.binGreen); }   // the dark inside; the lid stood up behind
        else q.box(0.01, y, 1.03, 0.39, 0.31, 0.03, 0.02, 0, M.binGreen);
        q.cap(-0.38, y - 0.22, 0.98, -0.38, y + 0.22, 0.98, 0.035, M.dark); };   // the handle at the back
      if (v === 'tidy') { one(-0.34); one(0.34); } else one(0); },
    paint(g, i) { if (i.variant !== 'tipped') return; const a = face(i) + (i.h - 0.5) * 0.5 + (i.h - 0.5) * 2.4, c = Math.cos(a), s = Math.sin(a), S = 1.3;
      g.fillStyle = 'rgb(0,70,0)'; g.beginPath(); g.ellipse(i.x + c * 1.3 * S, i.y + s * 1.3 * S, 1.0 * S, 0.6 * S, a, 0, 7); g.fill();
      g.fillStyle = 'rgb(110,0,0)'; for (let k = 0; k < 7; k++) { const u = (0.8 + hash(i.h, k) * 1.6) * S, w = (hash(k, i.h) - 0.5) * 1.6 * S; g.fillRect(i.x + c * u - s * w, i.y + s * u + c * w, 0.14, 0.1); } } },   // litter
  // the post box: the old town only (lived-in, not the new suburbs, not the works), rare, red. Ruined → knocked down
  { id: 'postbox', family: 'props', slot: 'kerb', every: 150, chance: 0.05, space: 2, collide: { w: 0.8, h: 0.8 },
    fit: (c, s) => s.crown || s.path ? 0 : c > 0.4 && c < 0.7 ? 1 : c > 0.25 && c < 0.4 ? 0.3 : 0,
    variant: c => band(c) === 0 ? 'down' : 'up',
    volumes(i, K) { const fa = face(i);
      if (i.variant === 'down') { const q = kit(i, K, fa + 2.2 + i.h); q.cap(0.1, 0, 0.27, 1.25, 0, 0.27, 0.27, M.carRed); q.ball(1.3, 0, 0.27, 0.3, M.carRed); q.box(-0.05, 0, 0.12, 0.12, 0.32, 0.12, 0.04, 0, M.dark); return; }
      const q = kit(i, K, fa + Math.PI);   // the slot to the pavement
      q.box(0, 0, 0.06, 0.4, 0.4, 0.06, 0.04, 0, M.dark); q.cap(0, 0, 0, 0, 0, 1.2, 0.32, M.carRed); q.ball(0, 0, 1.28, 0.37, M.carRed); q.box(0.33, 0, 1.05, 0.04, 0.15, 0.03, 0.01, 0, M.dark); q.box(0.32, 0, 0.75, 0.03, 0.11, 0.09, 0.01, 0, M.cloth); } },
  // ---- story-only props (fit 0: only a story puts them down) ----
  // a police sawhorse: a safety-orange bar with dark bands on splayed legs; a few still have a blinking battery lamp
  { id: 'barrier', family: 'props', slot: 'roadway', every: 1, chance: 0, fit: () => 0, collide: { w: 2.6, h: 0.9 },
    volumes(i, K, t) { const q = kit(i, K, i.ang);
      for (const e of [-1, 1]) for (const b of [-1, 1]) q.cap(e * 0.72, 0, 0.88, e * 0.82, b * 0.34, 0, 0.035, M.dark);
      q.box(0, 0, 0.92, 0.95, 0.07, 0.1, 0.03, 0, M.cone);
      for (const u of [-0.58, 0, 0.58]) q.box(u, 0, 0.93, 0.12, 0.075, 0.105, 0.02, 0, M.dark);
      if (i.h < 0.35) q.ball(0.85, 0, 1.08, 0.06, M.lamp, Math.sin(t * 5 + i.h * 40) > 0.3 ? 1 : 0.05); } },
  // sandbags: a curved wall of sacks, two rows, the bow toward the danger
  { id: 'sandbags', family: 'props', slot: 'roadway', every: 1, chance: 0, fit: () => 0, collide: { w: 4.4, h: 1.5 },
    volumes(i, K) { const q = kit(i, K, i.ang), R = 2.6, bag = (a, row) => { const u = Math.sin(a) * R, w = (1 - Math.cos(a)) * R * -1 + 0.25; q.box(u, w, row ? 0.36 : 0.13, 0.33, 0.2, 0.13, 0.12, a, M.sack); };
      for (let k = 0; k < 5; k++) bag((k - 2) * 0.29 + (hash(i.h, k) - 0.5) * 0.04, 0);
      for (let k = 0; k < 3; k++) bag((k - 1) * 0.29 + 0.145 * (i.h < 0.5 ? 1 : -1), 1); } },
  // a traffic cone: dark foot, orange body, a pale band, the tip; one in three knocked over
  { id: 'cone', family: 'props', slot: 'roadway', every: 1, chance: 0, fit: () => 0,
    volumes(i, K) { const q = kit(i, K, i.ang + i.h * 6);
      if (i.h < 0.33) { q.box(-0.32, 0, 0.18, 0.02, 0.18, 0.18, 0.02, 0, M.rubber); q.cap(-0.28, 0, 0.13, 0.15, 0, 0.07, 0.12, M.cone); q.ball(-0.06, 0, 0.11, 0.11, M.cloth); return; }
      q.box(0, 0, 0.02, 0.19, 0.19, 0.02, 0.02, 0, M.rubber); q.ball(0, 0, 0.12, 0.16, M.cone); q.ball(0, 0, 0.3, 0.1, M.cloth); q.ball(0, 0, 0.44, 0.065, M.cone); } },
  // debris: what a crash or a fight leaves: glass, bent metal, a hubcap, scattered by its own hash
  { id: 'debris', family: 'props', slot: 'roadway', every: 1, chance: 0, fit: () => 0,
    volumes(i, K) { const q = kit(i, K, i.ang + i.h * 6.28), at = k => [(hash(i.h, k, 1) - 0.5) * 3.2, (hash(i.h, k, 2) - 0.5) * 2.4], spin = k => hash(i.h, k, 3) * 3;
      for (let k = 0; k < 3; k++) { const [u, w] = at(k); q.box(u, w, 0.03, 0.1, 0.07, 0.03, 0.01, spin(k), M.glass); }
      for (let k = 3; k < 5; k++) { const [u, w] = at(k); q.box(u, w, 0.06, 0.32, 0.12, 0.06, 0.03, spin(k), k === 3 ? M.steel : M.dark); }
      { const [u, w] = at(5); q.ball(u, w, -0.13, 0.22, M.steel); }   // the hubcap: a dome just proud of the road
      { const [u, w] = at(6); q.box(u, w, 0.04, 0.22, 0.2, 0.04, 0.03, spin(6), M.rubber); } },
    paint(g, i) { g.fillStyle = 'rgb(90,0,0)'; for (let k = 0; k < 16; k++) g.fillRect(i.x + (hash(i.h, k, 7) - 0.5) * 4.4, i.y + (hash(i.h, k, 8) - 0.5) * 3.4, 0.07, 0.07); } },   // glints of glass
  // a fallen tree across the road: the root plate torn up, the trunk, broken branches, the crown still in leaf
  { id: 'fallenTree', family: 'props', slot: 'roadway', every: 1, chance: 0, fit: () => 0, collide: { w: 10.5, h: 1.6 },
    volumes(i, K) { const q = kit(i, K, i.ang), f = i.h < 0.5 ? 1 : -1;
      q.box(-4.3, 0, 0.75, 0.28, 1.05, 0.8, 0.26, 0, M.pants);                   // the root plate, earth and all, stood on end
      q.cap(-4.0, 0, 0.42, 3.4, 0.15 * f, 0.36, 0.36, M.wood);                    // the trunk
      q.cap(0.6, 0, 0.5, 2.2, 1.1 * f, 0.6, 0.12, M.wood); q.cap(1.8, 0, 0.45, 3.0, -0.9 * f, 0.3, 0.11, M.wood); q.cap(-1.4, 0, 0.45, -0.6, -0.75 * f, 0.08, 0.1, M.wood);   // broken limbs
      q.ball(4.3, 0.4 * f, 0.15, 1.15, M.leaf); q.ball(3.4, -0.9 * f, 0.1, 0.9, M.leaf); q.ball(2.5, 1.1 * f, 0.05, 0.75, M.leaf); } },
];
