// [roam] Road and ground marks: flat atoms painted once into the decal map (r pale paint, g dark, b water). Each says
// what the street went through: paint is crisp where the town is kept and wears off with care; holes, oil and puddles
// come with neglect; char only where the blight burnt it, more round the nests; chalk is the town's children, then its
// last survivors. Every mark draws in its own frame (u along the slot's facing, v to its left), at 1.3x life like the props.
const S = 1.3;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const rh = (i, k) => { let n = Math.imul((i.h * 4294967296) >>> 0 ^ Math.imul(k + 1, 0x9e3779b9), 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const wear = c => cl((0.72 - c) / 0.5);              // 0 kept paint .. 1 a ghost of it
const R = a => `rgb(${a | 0},0,0)`, D = a => `rgb(0,${a | 0},0)`, Wt = a => `rgb(0,0,${a | 0})`;
const frame = (g, i, du = 0, dv = 0) => { g.translate(i.x, i.y); g.rotate(i.ang); g.translate(du, dv); };
const rect = (g, u0, v0, u1, v1) => g.fillRect(Math.min(u0, u1), Math.min(v0, v1), Math.abs(u1 - u0), Math.abs(v1 - v0));
// worn paint: a bar cut into patches along u, some gone; one strength a bar (the shader cuts each mark at half its local
// peak, so a weaker patch beside a stronger one would be eaten at the join)
const bar = (g, i, k, u0, v0, u1, v1, a, w) => { const n = 4; g.fillStyle = R(a * (1 - w * 0.5 * rh(i, k * 7 + 50))); for (let j = 0; j < n; j++) { if (rh(i, k * 7 + j) < w * 0.65) continue;
  rect(g, u0 + (u1 - u0) * j / n, v0, u0 + (u1 - u0) * (j + 1) / n, v1); } };
// a ragged ring: n points round the middle at r·(1 ± jag)
const blob = (g, i, k, r, jag, n = 12) => { g.beginPath(); for (let j = 0; j < n; j++) { const a = j / n * 6.2832, q = r * (1 - jag + 2 * jag * rh(i, k + j)); j ? g.lineTo(Math.cos(a) * q, Math.sin(a) * q) : g.moveTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fill(); };
const soft = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col(a)); gr.addColorStop(0.55, col(a * 0.75)); gr.addColorStop(1, col(0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
const line = (g, pts, w) => { g.lineWidth = w; g.beginPath(); pts.forEach(([u, v], j) => j ? g.lineTo(u, v) : g.moveTo(u, v)); g.stroke(); };
const WIND = { x: 0.731, y: 0.682 };                 // the town's wind (main.js): soot lies downwind

export const GROUND_MARKS = [
  // the junction's paint, on every arm the town still keeps a road: a zebra where people crossed (most in the old town
  // and the suburbs), else the give-way teeth or a stop line on the lane coming in. It fades with care; in the ruins a ghost
  { id: 'zebra', family: 'marks', slot: 'crossing', every: 4, chance: 1, fit: (c, s) => s.w < 4 ? 0 : c > 0.45 ? 1 : c > 0.3 ? 0.85 : 0.6,
    variant: (c, h) => (c > 0.5 ? h < 0.6 : c > 0.32 ? h < 0.35 : h < 0.3) ? 'zebra' : h < 0.8 ? 'giveway' : 'stop',
    paint(g, i) { const w = wear(i.care), a = 235 * (1 - 0.72 * w), hw = i.slot.w / 2; frame(g, i);
      if (i.variant === 'zebra') { const sw = 0.5 * S, gap = 0.46 * S, n = Math.floor((2 * hw - 0.6) / (sw + gap) + 0.4), v0 = -(n * sw + (n - 1) * gap) / 2;
        for (let k = 0; k < n; k++) { const v = v0 + k * (sw + gap); bar(g, i, k, 0.2, v, 0.2 + 2.4 * S, v + sw, a, w); } return; }
      // the lane coming in: on the right of a driver heading for the junction (the slot faces away from it), so v < 0
      if (i.variant === 'stop') { bar(g, i, 1, 0.3, -hw + 0.3, 0.3 + 0.32 * S, -0.15, a, w); bar(g, i, 2, 0.3, -0.15, 0.3 + 0.32 * S, 0, a * 0.4, w); return; }
      const tw = 0.7 * S, n = Math.floor((hw - 0.3) / (tw * 1.6));   // shark's teeth, tips toward the driver
      for (let k = 0; k < n; k++) { if (rh(i, 30 + k) < w * 0.6) continue; const v = -0.2 - k * tw * 1.6; g.fillStyle = R(a * (1 - w * 0.5 * rh(i, 60 + k)));
        g.beginPath(); g.moveTo(0.3, v); g.lineTo(0.3, v - tw); g.lineTo(0.3 + 0.95 * S, v - tw / 2); g.closePath(); g.fill(); } } },

  // potholes: none where the street is kept; the worn get a crack or a patch, a few holes; the ruined are pitted, the
  // holes holding rain. A dark ragged hole with a broken rim and cracks running out of it
  { id: 'pothole', family: 'marks', slot: 'roadway', every: 6, chance: 0.3, fit: c => c > 0.62 ? 0 : c > 0.32 ? 0.3 : 1,
    variant: (c, h) => c > 0.32 ? (h < 0.35 ? 'patch' : h < 0.65 ? 'crack' : 'hole') : (h < 0.45 ? 'wet' : h < 0.85 ? 'hole' : 'crack'),
    paint(g, i) { const hw = i.slot.w / 2, r0 = (0.32 + 0.5 * rh(i, 1) ** 2) * S * (1.5 - i.care), off = (rh(i, 2) - 0.5) * 2 * Math.max(0, hw - r0 * 2 - 0.4);
      frame(g, i, (rh(i, 3) - 0.5) * 1.5, off); g.rotate(rh(i, 4) * 6.28);
      if (i.variant === 'patch') { g.fillStyle = D(38); rect(g, -r0 * 1.6, -r0, r0 * 1.4, r0 * 1.1); g.strokeStyle = D(60); g.lineWidth = 0.13; g.strokeRect(-r0 * 1.6, -r0, r0 * 3, r0 * 2.1); return; }
      const cracks = i.variant === 'crack' ? 4 : 3 + Math.floor(rh(i, 5) * 3); g.strokeStyle = D(i.variant === 'crack' ? 170 : 150);
      for (let k = 0; k < cracks; k++) { let a = rh(i, 10 + k) * 6.28, u = Math.cos(a) * r0 * 0.8, v = Math.sin(a) * r0 * 0.8; const pts = [[u, v]], L = r0 * (1.2 + 1.6 * rh(i, 20 + k));
        for (let s = 0; s < 3; s++) { a += (rh(i, 30 + k * 3 + s) - 0.5) * 1.1; u += Math.cos(a) * L / 3; v += Math.sin(a) * L / 3; pts.push([u, v]); }
        for (let s = 0; s < 3; s++) line(g, pts.slice(s, s + 2), 0.22 - s * 0.04); }
      if (i.variant === 'crack') return;
      g.fillStyle = R(70); blob(g, i, 90, r0 * 1.5, 0.3);         // grit thrown out of it, pale in the sun
      g.fillStyle = D(80); blob(g, i, 40, r0 * 1.22, 0.25);       // the broken rim
      g.fillStyle = D(175); blob(g, i, 60, r0, 0.3);              // the hole
      if (i.variant === 'wet') { g.fillStyle = Wt(230); blob(g, i, 80, r0 * 0.78, 0.22); } } },

  // standing water in the low spots: in the gutter where cars stood, and in the road's dips. More as the road sinks;
  // a few even on kept streets after the rain. Soft-edged water with a darker wet rim
  { id: 'puddle', family: 'marks', slot: 'parking', every: 12, chance: 0.12, fit: c => c > 0.62 ? 0.12 : c > 0.32 ? 0.5 : 0.8,
    paint(g, i) { frame(g, i, (rh(i, 1) - 0.5) * 2, 0.35); puddle(g, i, (1.1 + 1.3 * rh(i, 2)) * (1.3 - i.care * 0.4), 0.55 + 0.25 * rh(i, 3)); } },
  { id: 'puddle-road', family: 'marks', slot: 'roadway', every: 14, chance: 0.08, fit: c => c > 0.62 ? 0.08 : c > 0.32 ? 0.45 : 0.75,
    paint(g, i) { const hw = i.slot.w / 2, ru = (0.9 + 1.0 * rh(i, 2)) * (1.3 - i.care * 0.4), rv = Math.min(0.6 + 0.5 * rh(i, 3), hw - 0.6); frame(g, i, 0, (rh(i, 1) - 0.5) * 2 * Math.max(0, hw - rv - 0.4)); puddle(g, i, ru, rv); } },

  // the crash's tyre marks (the crash story lays them, `turn` along the slide): two long dark curves that darken as the
  // brakes bit, bending where the car began to slew
  { id: 'skid', family: 'marks', fit: () => 0,
    paint(g, i) { frame(g, i); const L = 7.5 + 2 * rh(i, 1), bend = (rh(i, 2) - 0.5) * 3, tw = 1.5 * S / 2; g.lineCap = 'round';
      for (const sd of [-1, 1]) { const at = q => { const u = q * L, v = sd * tw * (1 + q * 0.3) + bend * q * q; return [u, v]; };
        for (let s = 0; s < 8; s++) { g.strokeStyle = D(90 + 165 * (s / 7)); line(g, [at(s / 8), at((s + 1) / 8)], 0.3); } } } },

  // oil where cars stood a long time and were never moved: a dark blot under the engine, drips beside it. Worn streets
  { id: 'oil', family: 'marks', slot: 'parking', every: 9, chance: 0.14, fit: c => c > 0.62 ? 0.08 : c > 0.32 ? 0.65 : 0.3,
    paint(g, i) { frame(g, i, (rh(i, 1) < 0.5 ? -1 : 1) * (0.9 + 0.8 * rh(i, 2)), (rh(i, 3) - 0.5) * 0.5); const r = (0.32 + 0.3 * rh(i, 4)) * S;
      g.fillStyle = D(80); blob(g, i, 10, r, 0.3, 9); soft(g, 0, 0, r * 0.85, D, 150); soft(g, r * 0.15, -r * 0.1, r * 0.45, Wt, 110);   // a dull sheen
      for (let k = 0; k < 3; k++) { const a = rh(i, 20 + k) * 6.28, d = r * (1.1 + 0.8 * rh(i, 30 + k)); soft(g, Math.cos(a) * d, Math.sin(a) * d, r * (0.18 + 0.2 * rh(i, 40 + k)), D, 150); } } },

  // char where something burned (a car, a pyre, a fire to keep the dead off): only in the ruins, more round the nests.
  // Black at the heart with grey ash in it, a ragged rim, soot laid downwind
  { id: 'scorch', family: 'marks', slot: 'roadway', every: 10, chance: 0.12, fit: c => cl((0.32 - c) / 0.2),
    paint(g, i) { const hw = i.slot.w / 2, r = Math.min((0.9 + 0.9 * rh(i, 1)) * S, hw - 0.3); frame(g, i, 0, (rh(i, 2) - 0.5) * 2 * Math.max(0, hw - r - 0.3)); char(g, i, r, 1); } },
  { id: 'scorch-pave', family: 'marks', slot: 'pavement', every: 14, chance: 0.05, fit: c => cl((0.3 - c) / 0.2),
    paint(g, i) { frame(g, i); char(g, i, (0.55 + 0.3 * rh(i, 1)), 0.45); } },

  // chalk: in the kept suburbs, a child's hopscotch or a drawing on the pavement, faint; in the ruins, the survivors' marks
  // on the road (tallies of the dead, a warning cross, an arrow to where it's safe), rarely
  { id: 'chalk', family: 'marks', slot: 'pavement', every: 40, chance: 0.06, fit: (c, s) => s.crown ? 0 : c > 0.68 ? 0.7 : c < 0.28 ? 0.2 : 0,
    variant: (c, h) => c > 0.5 ? (h < 0.55 ? 'hopscotch' : 'drawing') : h < 0.5 ? 'tally' : 'warning',
    paint(g, i) { g.lineCap = 'round'; g.lineJoin = 'round';
      if (i.variant === 'hopscotch') { frame(g, i); g.strokeStyle = R(150); g.lineWidth = 0.22; const q = 0.66 * S, rows = [1, 2, 1, 2, 1]; let u = -rows.length * q / 2;
        for (const n of rows) { for (let k = 0; k < n; k++) g.strokeRect(u, -n * q / 2 + k * q, q, q); u += q; }
        g.beginPath(); g.arc(u, 0, q * 0.9, -Math.PI / 2, Math.PI / 2); g.stroke(); g.fillStyle = R(140); g.beginPath(); g.arc(-rows.length * q / 2 + q * 0.5 + q * Math.floor(rh(i, 1) * 3), 0, 0.16, 0, 7); g.fill(); return; }   // the stone on its square
      if (i.variant === 'drawing') { frame(g, i, (rh(i, 1) - 0.5) * 2); g.scale(1.4, 1.4); g.strokeStyle = R(150); g.lineWidth = 0.15; const k = rh(i, 2);
        if (k < 0.5) { g.beginPath(); g.arc(0, 0, 0.42, 0, 7); g.stroke(); for (let j = 0; j < 8; j++) { const a = j * 0.785; line(g, [[Math.cos(a) * 0.62, Math.sin(a) * 0.62], [Math.cos(a) * 0.95, Math.sin(a) * 0.95]], 0.15); } }   // a sun
        else line(g, [[-0.7, 0.6], [-0.7, -0.3], [0, -0.85], [0.7, -0.3], [0.7, 0.6], [-0.7, 0.6]], 0.15);   // a house
        line(g, [[1.3, 0.5], [1.3, -0.1]], 0.15); g.beginPath(); g.arc(1.3, -0.32, 0.22, 0, 7); g.stroke(); line(g, [[1.0, 0.0], [1.6, 0.0]], 0.15); line(g, [[1.05, 0.85], [1.3, 0.5], [1.55, 0.85]], 0.15); return; }   // and someone by it
      // the ruins: out on the road, where whoever passes will see it
      const nx = i.slot.nx, ny = i.slot.ny; g.translate(i.x + nx * 2.4, i.y + ny * 2.4); g.rotate(i.ang); g.strokeStyle = R(165);
      if (i.variant === 'tally') { const groups = 1 + Math.floor(rh(i, 1) * 4); for (let k = 0; k < groups; k++) { const u0 = -groups * 1.0 + k * 2.0, full = k < groups - 1 || rh(i, 2) < 0.5, n = full ? 4 : 1 + Math.floor(rh(i, 3) * 3);
        for (let j = 0; j < n; j++) line(g, [[u0 + j * 0.4, -0.55], [u0 + j * 0.4 + 0.06, 0.55]], 0.2); if (full) line(g, [[u0 - 0.25, 0.45], [u0 + 1.45, -0.45]], 0.2); } return; }
      const dir = rh(i, 1) < 0.5 ? 1 : -1; line(g, [[-0.7, -0.7], [0.7, 0.7]], 0.22); line(g, [[-0.7, 0.7], [0.7, -0.7]], 0.22); g.beginPath(); g.arc(0, 0, 1.0, 0, 7); g.lineWidth = 0.2; g.stroke();
      line(g, [[dir * 1.6, 0], [dir * 3.6, 0]], 0.22); line(g, [[dir * 3.0, -0.5], [dir * 3.7, 0], [dir * 3.0, 0.5]], 0.22); } },

  // parking bays in the lived-in streets (the old town's care, not the suburbs' driveways, not the ruins): the dividers
  // off the kerb, faded with the street
  { id: 'bays', family: 'marks', slot: 'parking', every: 28, chance: 0.1, fit: c => c > 0.42 && c < 0.72 ? 1 : 0,
    paint(g, i) { const w = wear(i.care), a = 210 * (1 - 0.6 * w), L = 4.6 * S, n = 2 + Math.floor(rh(i, 1) * 2); frame(g, i);
      for (let k = 0; k <= n; k++) { const u = (k - n / 2) * L; bar(g, i, k, u - 0.1, 1.1, u + 0.1, -1.35, a, w); bar(g, i, k + 20, u - 0.45, -1.35, u + 0.45, -1.2, a, w); } } },
];
// water in a dip: overlapping soft ellipses (b) over a wider damp darkening (g)
function puddle(g, i, ru, rv) { g.rotate((rh(i, 9) - 0.5) * 0.3); g.save(); g.scale(ru, rv); soft(g, 0, 0, 1.25, D, 40); g.restore();
  for (let k = 0; k < 3; k++) { const u = (rh(i, 10 + k) - 0.5) * ru * 0.8, v = (rh(i, 20 + k) - 0.5) * rv * 0.5, s = 0.55 + 0.35 * rh(i, 30 + k); g.save(); g.translate(u, v); g.scale(ru * s, rv * s); soft(g, 0, 0, 1, Wt, 200); g.restore(); } }
// a burn: rim, heart, ash, soot downwind (k scales the soot's reach: short on a pavement)
function char(g, i, r, k) { g.fillStyle = D(85); blob(g, i, 10, r, 0.32, 16); soft(g, 0, 0, r * 0.85, D, 170);
  const wu = WIND.x * Math.cos(i.ang) + WIND.y * Math.sin(i.ang), wv = -WIND.x * Math.sin(i.ang) + WIND.y * Math.cos(i.ang);   // the wind in this frame
  g.strokeStyle = D(70); g.lineCap = 'round'; for (let j = 0; j < 4; j++) { const a = Math.atan2(wv, wu) + (rh(i, 40 + j) - 0.5) * 0.9, d0 = r * 0.6, d1 = r * (1.2 + 1.2 * rh(i, 50 + j) * k);
    for (let s = 0; s < 3; s++) line(g, [[Math.cos(a) * (d0 + (d1 - d0) * s / 3), Math.sin(a) * (d0 + (d1 - d0) * s / 3)], [Math.cos(a) * (d0 + (d1 - d0) * (s + 1) / 3), Math.sin(a) * (d0 + (d1 - d0) * (s + 1) / 3)]], r * 0.28 * (1 - s * 0.3)); }
  // grey ash in the black
  g.fillStyle = R(90); for (let j = 0; j < 7; j++) { const a = rh(i, 60 + j) * 6.28, d = r * 0.55 * rh(i, 70 + j); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.08 + 0.1 * rh(i, 80 + j)), 0, 7); g.fill(); } }
