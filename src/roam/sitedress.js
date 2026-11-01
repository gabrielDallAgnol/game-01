// [roam] A service site's dressing (M6c): the props that make the garage read as the garage just by looking (Gabriel
// Nov 1), in the town's own language: glyph solids for the medium, and its lights on the overlay as warm points with a
// soft halo (only light shouts; amber is yours). A tall lamp at each corner of the lot (seen from far away), a sign board over the doors with GARAGE lit on it, work lamps either side,
// the open doors' warm light, a bench, stacks of tyres, oil drums, a car up on a lift, an air line, a few cones. The pieces and where they stand come
// from the site's data (play/sites.js `dress`, placed by sim/garage.js); the ground's light pools and oil stains are the
// atom map's (atomlook.js).
export function dressVolumes(S, K, t, on) {
  const { sphere, capsule, box, M } = K;
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
