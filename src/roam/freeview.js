// [roam] Freeing on screen (the Point): a weak big machine shows its open core with a slow amber call; while linked, an
// amber line runs from the robot to it and a ring closes on it with every pulse (tap as it meets the inner ring), the
// landed taps as pips round it. A freed machine (S.guardians) wears amber eyes, and above it the ash it filters rises as
// pale motes that fade: the cause of the colour coming back, visible. Render only: reads S.link, S.dead, S.guardians.
import { ROAM } from './sim.js';
export function drawFreeing(fx, v) {
  const S = v.risk; if (!S || !S.guardians) return; const { toS, cam, t, cssW, cssH } = v, F = ROAM.free, ppm = cam.ppm;
  const vis = (x, y) => x > -200 && y > -200 && x < cssW + 200 && y < cssH + 200;
  fx.save(); fx.lineCap = 'round';
  for (const d of S.dead) { if (!d.boss || !d.free || !d.weak || (S.link && S.link.id === d.id)) continue; const [x, y] = toS(d.x, d.y); if (!vis(x, y)) continue;
    const k = (t * 0.6) % 1; fx.strokeStyle = `rgba(255,195,90,${0.55 * (1 - k)})`; fx.lineWidth = 3; fx.beginPath(); fx.arc(x, y, (2 + 5 * k) * ppm, 0, 6.283); fx.stroke(); }
  if (S.link) { const d = S.dead.find(q => q.id === S.link.id), b = v.bike;
    if (d) { const [x, y] = toS(d.x, d.y), [bx, by] = toS(b.x, b.y), L = S.link, ph = L.t % F.pulse, toNext = F.pulse - ph, r0 = F.body * ppm * 0.9;
      fx.setLineDash([2, 6]); fx.strokeStyle = 'rgba(255,195,90,.9)'; fx.lineWidth = 2.5; fx.beginPath(); fx.moveTo(bx, by); fx.lineTo(x, y); fx.stroke(); fx.setLineDash([]);
      const inWin = Math.min(ph, toNext) < F.window / 2;
      fx.strokeStyle = inWin ? 'rgba(255,225,150,1)' : 'rgba(255,195,90,.55)'; fx.lineWidth = inWin ? 5 : 3; fx.beginPath(); fx.arc(x, y, r0, 0, 6.283); fx.stroke();
      const rr = r0 * (1 + 1.6 * (toNext / F.pulse)); fx.strokeStyle = L.lock > 0 ? 'rgba(255,90,60,.8)' : 'rgba(255,210,120,.95)'; fx.lineWidth = 3; fx.beginPath(); fx.arc(x, y, rr, 0, 6.283); fx.stroke();
      for (let i = 0; i < F.need; i++) { const a = -Math.PI / 2 + (i - (F.need - 1) / 2) * 0.32, px = x + Math.cos(a) * (r0 + 18), py = y + Math.sin(a) * (r0 + 18);
        fx.fillStyle = i < L.prog ? '#ffd36a' : 'rgba(255,255,255,.18)'; fx.beginPath(); fx.arc(px, py, 5, 0, 6.283); fx.fill(); } } }
  for (const g of S.guardians) { const [x, y] = toS(g.x, g.y); if (!vis(x, y)) continue;
    const c = Math.cos(g.fa || 0), s = Math.sin(g.fa || 0);
    for (const e of [-0.32, 0.32]) { const ex = g.x + (2.42 * c - e * s) * 2.6, ey = g.y + (2.42 * s + e * c) * 2.6, [px, py] = toS(ex, ey), r = Math.max(3, 0.5 * ppm);
      const gr = fx.createRadialGradient(px, py, 0, px, py, r * 3); gr.addColorStop(0, 'rgba(255,215,130,.9)'); gr.addColorStop(1, 'rgba(255,195,90,0)'); fx.fillStyle = gr; fx.beginPath(); fx.arc(px, py, r * 3, 0, 6.283); fx.fill(); }
    // the filter: motes rising off it, drifting with the wind, fading as they climb (deterministic per mote: no state)
    for (let i = 0; i < 26; i++) { const h = (i * 0.6180339) % 1, life = 6, k = ((t + h * life) % life) / life, ang = h * 6.283, rad = (1.5 + 4 * ((i * 0.37) % 1)) * ppm;
      const px = x + Math.cos(ang) * rad + k * 3.5 * ppm, py = y + Math.sin(ang) * rad * 0.6 - k * 9 * ppm; fx.fillStyle = `rgba(235,240,230,${0.55 * (1 - k) * Math.min(1, k * 5)})`; fx.beginPath(); fx.arc(px, py, Math.max(1.2, 0.12 * ppm), 0, 6.283); fx.fill(); } }
  fx.restore();
}
