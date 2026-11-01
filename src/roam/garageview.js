// [roam] The garage's look at the bike (M6c): while the garage is open the camera comes in close on the real bike, and the
// part selected below glows where it sits: its own cells light up (bikelook.js, medium.js's gun) under a soft round glow
// of the selection colour (both wheels for the tyres, both sides for the frame).
import { SOCKETS } from './bikelook.js';
export function drawGarageSel(fx, v, FIGM) {
  const slot = v.garageSel; if (!slot || !SOCKETS[slot]) return; const { toS, cam, bike, t } = v, S = FIGM * 0.9, c = Math.cos(bike.ang), s = Math.sin(bike.ang), pulse = 0.85 + 0.15 * Math.sin(t * 4);
  fx.save(); fx.globalCompositeOperation = 'lighter';
  // a soft round glow of the selection colour over where the part sits, strongest in the middle (no ring: the part's own
  // cells glow too, bikelook.js)
  for (const [lx, ly] of SOCKETS[slot]) { const [x, y] = toS(bike.x + (lx * c - ly * s) * S, bike.y + (lx * s + ly * c) * S), r = Math.max(14, 0.55 * S * cam.ppm);
    const g = fx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,205,90,${0.42 * pulse})`); g.addColorStop(0.5, `rgba(255,190,70,${0.18 * pulse})`); g.addColorStop(1, 'rgba(255,180,60,0)');
    fx.globalAlpha = 1; fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, r, 0, 6.283); fx.fill(); }
  fx.restore(); fx.globalAlpha = 1;
}
