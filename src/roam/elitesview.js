// [roam] Elites on screen (M6b): over an elite machine within 32 m, a small dark plate with its name in ember (theirs):
// QUICK CRAWLER, BURNING HOUND. Its eyes are drawn bigger (medium.js). Far out, nothing more: the bigger eyes read alone.
import { ELITES } from '../play/elites.js';
import { MACHINES } from '../play/machines.js';
export function drawElites(fx, v) {
  const { toS, cssW, cssH, kai, dead, cam } = v; if (cam.ppm < 9) return;
  fx.save(); fx.font = '700 10px "IBM Plex Mono", ui-monospace, monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle';
  for (const d of dead) { if (!d.elite || Math.hypot(d.x - kai.x, d.y - kai.y) > 32) continue; const [x, y0] = toS(d.x, d.y), y = y0 - 26; if (x < -60 || y < -20 || x > cssW + 60 || y > cssH + 20) continue;
    const label = `${ELITES[d.elite].name} ${(MACHINES[d.kind] || { name: d.kind }).name}`.toUpperCase(), w = fx.measureText(label).width + 8;
    fx.globalAlpha = 0.88; fx.fillStyle = 'rgba(8,9,11,.85)'; fx.fillRect(x - w / 2, y - 7, w, 14); fx.globalAlpha = 1; fx.fillStyle = '#ff8a6a'; fx.fillText(label, x, y + 0.5);
    const f = Math.max(0, d.hp / d.maxHp); fx.fillStyle = '#ff3a2a'; fx.fillRect(x - w / 2, y + 7, w * f, 2); }
  fx.restore(); fx.globalAlpha = 1;
}
// [vehicle] a brute's charge, warned: while it winds up, a red stripe on the ground along its line (14 m, its width),
// flashing faster as it's about to go; while it rams, a fading streak behind it. Render only: reads d.cw, d.ct, d.cx, d.cy.
export function drawCharges(fx, v) { const { toS, cam, dead, t } = v, ppm = cam.ppm;
  for (const d of dead) { if (!(d.cw > 0) && !(d.ct > 0)) continue; const [x0, y0] = toS(d.x, d.y), L = d.cw > 0 ? 14 : 3, [x1, y1] = toS(d.x + d.cx * L, d.y + d.cy * L), w = 1.7 * 2 * ppm;
    fx.save(); fx.lineCap = 'round';
    if (d.cw > 0) { const k = 1 - d.cw, flash = 0.35 + 0.35 * (Math.sin(t * (8 + k * 22)) * 0.5 + 0.5); fx.strokeStyle = `rgba(255,58,42,${flash * 0.55})`; fx.lineWidth = w; fx.beginPath(); fx.moveTo(x0, y0); fx.lineTo(x1, y1); fx.stroke();
      fx.strokeStyle = `rgba(255,120,90,${flash})`; fx.lineWidth = 2; fx.setLineDash([6, 6]); fx.beginPath(); fx.moveTo(x0, y0); fx.lineTo(x1, y1); fx.stroke(); }
    else { const [bx, by] = toS(d.x - d.cx * 4, d.y - d.cy * 4); fx.strokeStyle = 'rgba(255,90,60,.35)'; fx.lineWidth = w * 0.6; fx.beginPath(); fx.moveTo(bx, by); fx.lineTo(x0, y0); fx.stroke(); }
    fx.restore(); } }
