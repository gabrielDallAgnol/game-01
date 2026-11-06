// [roam] How M5's risk is drawn, in the town's own language (the bike's smoke and the light pools are the atoms', in
// atomlook.js). Solids for the medium: a bank is a short mast with a lamp on top (the garage's on the square, a beacon's
// where a walker fell), a death cache is a heap of scrap round a lamp. Lights on the overlay: the lamp is a steady amber
// point with a soft halo (the machines' eye idiom: amber is yours), the cache's pulses; small plates name them close up,
// and far out they turn into letters on plates like the rest of the far map (⌂ a bank, ◆ the cache).
export function riskVolumes(S, K, t, on) {
  const { sphere, capsule, box, M } = K;
  for (const q of S.sites || []) { if (!on(q.x, q.y) || q.dress) continue; const h = q.kind === 'beacon' ? 2.4 : 3.2;   // a dressed site (the garage) shows by its own props (sitedress.js)
    box(q.x, q.y, 0.1, 0.45, 0.45, 0.1, 0.05, 0.6, M.dark);   // the footing
    capsule(q.x, q.y, 0.15, q.x, q.y, h, 0.09, M.steel); capsule(q.x, q.y, h, q.x + 0.5, q.y, h + 0.1, 0.06, M.steel);
    sphere(q.x + 0.5, q.y, h, 0.16, M.lamp, 0.9 + 0.1 * Math.sin(t * 1.3)); }
  const c = S.cache; if (c && on(c.x, c.y)) { const n = Math.min(9, 3 + Math.floor(c.scrap / 8) + (c.recipes ? c.recipes.length : 0));
    for (let i = 0; i < n; i++) { const a = i * 2.39, d = 0.15 + 0.12 * (i % 3); box(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 0.08 + 0.05 * (i % 2), 0.18, 0.08, 0.06, 0.03, a * 1.7, i % 2 ? M.rust : M.steel); }
    sphere(c.x, c.y, 0.4, 0.12, M.lamp, 0.55 + 0.45 * Math.sin(t * 4)); }
}
export function riskDraw(fx, v) {
  const S = v.risk; if (!S) return;
  const { toS, cam, cssW, cssH, t, kai } = v, grow = Math.max(1, Math.min(1.8, cam.ppm / 14)), far = Math.max(0, Math.min(1, (11 - cam.ppm) / 4));
  const onS = (x, y, m = 40) => x > -m && y > -m && x < cssW + m && y < cssH + m;
  const pt = (x, y, k, r = 1) => { fx.fillStyle = '#ffc35a'; fx.globalAlpha = 0.4 * k; fx.beginPath(); fx.arc(x, y, 6 * grow * r, 0, 6.283); fx.fill(); fx.globalAlpha = Math.min(1, k); fx.beginPath(); fx.arc(x, y, 1.9 * grow * r, 0, 6.283); fx.fill(); };
  const tag = (x, y, label, col) => { fx.font = '700 10px "IBM Plex Mono", ui-monospace, monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; const w = fx.measureText(label).width + 8;
    fx.globalAlpha = 0.88; fx.fillStyle = 'rgba(8,9,11,.82)'; fx.fillRect(x - w / 2, y - 7, w, 14); fx.globalAlpha = 1; fx.fillStyle = col; fx.fillText(label, x, y + 0.5); };
  fx.save(); fx.globalCompositeOperation = 'lighter';
  const lamps = [];
  for (const q of S.sites || []) { const h = q.kind === 'beacon' ? 2.4 : 3.2, [x, y] = toS(q.x + 0.5, q.y - h * 0.5); if (onS(x, y)) { if (!q.dress) pt(x, y, 0.95, 1.2); lamps.push([x, y, q]); } }
  const c = S.cache; let cs = null; if (c) { const [x, y] = toS(c.x, c.y - 0.2); if (onS(x, y)) { pt(x, y, 0.6 + 0.4 * Math.sin(t * 4), 1.1 + 0.25 * Math.sin(t * 4)); cs = [x, y]; } }
  fx.globalCompositeOperation = 'source-over';
  if (far < 0.5) { for (const [x, y, q] of lamps) if (!q.dress && Math.hypot(q.x - kai.x, q.y - kai.y) < 45) tag(x, y - 16 * grow, { camp: 'CAMP · BANK', garage: 'GARAGE', beacon: 'BEACON · BANK' }[q.kind] || 'BANK', '#ffd36a');
    if (cs) tag(cs[0], cs[1] - 15 * grow, `CACHE ⚙${c.scrap}${c.chips ? ' ◆' + c.chips : ''}`, '#ffd36a'); }
  if (far > 0.01) { const plate = (x, y, ch) => { fx.globalAlpha = far; fx.fillStyle = 'rgba(10,11,13,.86)'; fx.beginPath(); fx.arc(x, y, 10, 0, 7); fx.fill(); fx.strokeStyle = '#f0b44c'; fx.lineWidth = 2; fx.stroke();
      fx.fillStyle = '#ffd36a'; fx.font = '700 12px "IBM Plex Mono", ui-monospace, monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(ch, x, y + 0.5); };
    for (const [x, y, q] of lamps) plate(x, y, q.kind === 'garage' ? '⚙' : '⌂'); if (cs) plate(cs[0], cs[1], '◆'); }
  fx.restore(); fx.globalAlpha = 1;
}
