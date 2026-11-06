// [roam] A service site's dressing (M6c): the props that make the garage read as the garage just by looking (Gabriel
// Nov 1), in the town's own language: glyph solids for the medium, and its lights on the overlay as warm points with a
// soft halo (only light shouts; amber is yours). A tall lamp at each corner of the lot (seen from far away), a sign board over the doors with GARAGE lit on it, work lamps either side,
// the open doors' warm light, a bench, stacks of tyres, oil drums, a car up on a lift, an air line, a few cones. The pieces and where they stand come
// from the site's data (play/sites.js `dress`, placed by sim/garage.js); the ground's light pools and oil stains are the
// atom map's (atomlook.js).
// [m6f] the gate's opening, eased render-side toward what the sim says (open or shut)
let gateK = 0, gateT = -1;
export function dressVolumes(S, K, t, on) {
  const { sphere, capsule, box, M } = K;
  // [m6f] the fence round the lot: steel posts and panels; the gate: two posts with lamps, an arch with GARAGE lit on it, two
  // leaves that slide apart, and amber bars painted on the ground in front (the one way in)
  for (const q of S.sites || []) { if (!q.fence) continue;
    for (const f of q.fence) { const len = Math.hypot(f.bx - f.ax, f.by - f.ay), a = Math.atan2(f.by - f.ay, f.bx - f.ax), np = Math.max(1, Math.ceil(len / 2.4)), nb = Math.max(1, Math.ceil(len / 4.8));
      for (let i = 0; i <= np; i++) { const x = f.ax + (f.bx - f.ax) * i / np, y = f.ay + (f.by - f.ay) * i / np; if (on(x, y)) capsule(x, y, 0, x, y, 1.9, 0.06, M.steel); }
      for (let i = 0; i < nb; i++) { const x = f.ax + (f.bx - f.ax) * (i + 0.5) / nb, y = f.ay + (f.by - f.ay) * (i + 0.5) / nb; if (on(x, y)) { box(x, y, 0.95, len / nb / 2, 0.06, 0.8, 0.01, a, M.dark); box(x, y, 1.85, len / nb / 2, 0.07, 0.05, 0.02, a, M.steel); } } }
    const g = q.gate; if (!g || !on(g.x, g.y)) continue; const dt = gateT < 0 ? 0 : Math.min(0.1, Math.max(0, t - gateT)); gateT = t; gateK += ((g.open ? 1 : 0) - gateK) * Math.min(1, dt * 3);
    const tx = -g.ny, ty = g.nx, ta = Math.atan2(ty, tx), hw = g.w / 2;
    for (const sd of [-1, 1]) { const px = g.x + tx * sd * (hw + 0.35), py = g.y + ty * sd * (hw + 0.35); box(px, py, 1.6, 0.25, 0.25, 1.6, 0.05, ta, M.dark); sphere(px, py, 3.35, 0.2, M.lamp, 1);
      const off = hw / 2 + gateK * hw * 0.98, lx = g.x + tx * sd * off, ly = g.y + ty * sd * off; box(lx, ly, 0.95, hw / 2, 0.05, 0.8, 0.02, ta, M.paint); box(lx, ly, 1.78, hw / 2, 0.07, 0.04, 0.02, ta, M.dark); }
    { const ax = g.x + tx * (hw + 0.35), ay = g.y + ty * (hw + 0.35), bx = g.x - tx * (hw + 0.35), by = g.y - ty * (hw + 0.35); capsule(ax, ay, 3.5, bx, by, 3.5, 0.09, M.dark); box(g.x, g.y, 3.75, 2.1, 0.12, 0.38, 0.05, ta, M.dark); box(g.x, g.y, 3.77, 1.95, 0.14, 0.28, 0.03, ta, M.lamp, 0.9); }
    for (let i = 0; i < 4; i++) { const d = 1.2 + i * 1.1, x = g.x + g.nx * d, y = g.y + g.ny * d; box(x, y, 0.02, hw * 0.85, 0.22, 0.02, 0.01, ta, M.paint, 0.15); } }
  for (const q of S.sites || []) for (const d of q.dress || []) { if (!on(d.x, d.y)) continue; const a = d.a, c = Math.cos(a), s = Math.sin(a), P = (u, v) => [d.x + c * u - s * v, d.y + s * u + c * v];
    // the open doors: warm light from inside spills out across the threshold
    if (d.k === 'doors') { box(d.x, d.y, 0.02, 4.4, 0.6, 0.02, 0.02, d.a, M.lamp, 0.45); continue; }
    if (d.k === 'lotlamp') { capsule(d.x, d.y, 0, d.x, d.y, 5, 0.09, M.steel); sphere(d.x, d.y, 5, 0.24, M.lamp, 1); continue; }
    if (d.k === 'sign') { for (const u of [-1.3, 1.3]) { const [x, y] = P(u, 0); capsule(x, y, 0, x, y, 2.6, 0.06, M.steel); } box(d.x, d.y, 2.7, 1.5, 0.12, 0.42, 0.05, a, M.dark); box(d.x, d.y, 2.72, 1.38, 0.14, 0.32, 0.03, a, M.lamp, 0.85); }
    else if (d.k === 'worklamp') { capsule(d.x, d.y, 0, d.x, d.y, 3, 0.07, M.steel); const [x, y] = P(0, 0.5); capsule(d.x, d.y, 3, x, y, 3.05, 0.05, M.steel); sphere(x, y, 3, 0.18, M.lamp, 1); }
    else if (d.k === 'bench') { box(d.x, d.y, 0.45, 1.1, 0.4, 0.45, 0.04, a, M.wood); const [x, y] = P(-0.6, 0); box(x, y, 0.95, 0.28, 0.18, 0.12, 0.04, a, M.carRed); const [vx, vy] = P(0.7, 0); box(vx, vy, 0.98, 0.12, 0.1, 0.1, 0.02, a, M.steel); }
    else if (d.k === 'tyres') { capsule(d.x, d.y, 0.05, d.x, d.y, 0.85, 0.38, M.rubber); sphere(d.x, d.y, 0.88, 0.15, M.dark); }
    else if (d.k === 'drums') { const C = [M.carRed, M.carBlue, M.steel]; for (let i = 0; i < 3; i++) { const [x, y] = P((i - 1) * 0.7, (i % 2) * 0.5); capsule(x, y, 0.05, x, y, 0.85, 0.3, C[i]); sphere(x, y, 0.9, 0.1, M.dark); } }
    else if (d.k === 'lift') { for (const u of [-1.2, 1.2]) { const [x0, y0] = P(u, -1.9), [x1, y1] = P(u, 1.9); capsule(x0, y0, 0.15, x1, y1, 0.15, 0.1, M.paint); const [px, py] = P(u, 0); capsule(px, py, 0, px, py, 1.1, 0.12, M.paint); }
      box(d.x, d.y, 1.45, 0.85, 1.9, 0.3, 0.25, a + Math.PI / 2, M.carCream); box(d.x, d.y, 1.8, 0.7, 1.0, 0.18, 0.2, a + Math.PI / 2, M.glass); }
    else if (d.k === 'air') { box(d.x, d.y, 0.4, 0.4, 0.3, 0.4, 0.06, a, M.carRed); for (let i = 0; i < 5; i++) { const [x0, y0] = P(0.4 + i * 0.25, Math.sin(i) * 0.3), [x1, y1] = P(0.65 + i * 0.25, Math.sin(i + 1) * 0.3); capsule(x0, y0, 0.05, x1, y1, 0.05, 0.035, M.dark); } }
    else if (d.k === 'cones') for (let i = 0; i < 3; i++) { const [x, y] = P((i - 1) * 1.4, 0); sphere(x, y, 0.2, 0.17, M.cone); } }
}
export function dressDraw(fx, v) {
  const S = v.risk; if (!S) return; const { toS, cam, cssW, cssH, t } = v, grow = Math.max(1, Math.min(1.8, cam.ppm / 14));
  fx.save(); fx.globalCompositeOperation = 'lighter';
  // [m6f] the gate: a lamp on each post and GARAGE lit along the arch, at every zoom it's on screen
  for (const q of S.sites || []) { const g = q.gate; if (!g) continue; const tx = -g.ny, ty = g.nx, hw = g.w / 2, g2 = Math.max(1.4, grow);
    fx.fillStyle = '#ffc35a'; for (const sd of [-1, 1]) { const [x, y] = toS(g.x + tx * sd * (hw + 0.35), g.y + ty * sd * (hw + 0.35) - 1.7); fx.globalAlpha = 0.4; fx.beginPath(); fx.arc(x, y, 8 * g2, 0, 6.283); fx.fill(); fx.globalAlpha = 1; fx.beginPath(); fx.arc(x, y, 2 * g2, 0, 6.283); fx.fill(); }
    if (cam.ppm > 8) { const [x, y] = toS(g.x, g.y - 1.9), px = Math.max(8, 0.55 * cam.ppm); fx.globalAlpha = 0.95; fx.font = `700 ${px}px "IBM Plex Mono", ui-monospace, monospace`; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.save(); fx.translate(x, y); let ra = Math.atan2(ty, tx); if (Math.cos(ra) < 0) ra += Math.PI; fx.rotate(ra); fx.fillText('GARAGE', 0, 0); fx.restore(); } }
  // [m6d] the lot's corner lamps: a steady amber point with a wide halo at every zoom, so the garage shows from far away
  for (const q of S.sites || []) for (const d of q.dress || []) { if (d.k !== 'lotlamp') continue; const [x, y] = toS(d.x, d.y - 2.5); if (x < -40 || y < -40 || x > cssW + 40 || y > cssH + 40) continue;
    const g2 = Math.max(1.4, grow); fx.fillStyle = '#ffc35a'; fx.globalAlpha = 0.18; fx.beginPath(); fx.arc(x, y, 14 * g2, 0, 6.283); fx.fill(); fx.globalAlpha = 0.45; fx.beginPath(); fx.arc(x, y, 6 * g2, 0, 6.283); fx.fill(); fx.globalAlpha = 1; fx.beginPath(); fx.arc(x, y, 2.2 * g2, 0, 6.283); fx.fill(); }
  for (const q of S.sites || []) for (const d of q.dress || []) { if (d.k !== 'worklamp' && d.k !== 'sign') continue;
    const off = d.k === 'worklamp' ? 0.5 : 0, [x, y] = toS(d.x - Math.sin(d.a) * off, d.y + Math.cos(d.a) * off - (d.k === 'sign' ? 1.3 : 1.5)); if (x < -60 || y < -60 || x > cssW + 60 || y > cssH + 60) continue;
    fx.fillStyle = '#ffc35a';
    if (d.k === 'worklamp') { fx.globalAlpha = 0.4; fx.beginPath(); fx.arc(x, y, 6 * grow, 0, 6.283); fx.fill(); fx.globalAlpha = 1; fx.beginPath(); fx.arc(x, y, 1.9 * grow, 0, 6.283); fx.fill(); }
    else if (cam.ppm > 9) { const px = Math.max(7, 0.5 * cam.ppm); fx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 3); fx.font = `700 ${px}px "IBM Plex Mono", ui-monospace, monospace`; fx.textAlign = 'center'; fx.textBaseline = 'middle';
      fx.save(); fx.translate(x, y); fx.rotate(d.a); fx.fillText('GARAGE', 0, 0); fx.restore(); } }
  fx.restore(); fx.globalAlpha = 1;
}
