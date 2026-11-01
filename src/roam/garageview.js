// [roam] The garage's look at the bike (M6c): while the garage is open the camera comes in close on the real bike, and the
// part selected below is ringed in amber light where it sits (both wheels for the tyres, both sides for the frame).
import { SOCKETS } from './bikelook.js';
export function drawGarageSel(fx, v, FIGM) {
  const slot = v.garageSel; if (!slot || !SOCKETS[slot]) return; const { toS, cam, bike, t } = v, S = FIGM * 0.9, c = Math.cos(bike.ang), s = Math.sin(bike.ang), pulse = 0.6 + 0.4 * Math.sin(t * 4);
  fx.save(); fx.globalCompositeOperation = 'lighter';
  for (const [lx, ly] of SOCKETS[slot]) { const [x, y] = toS(bike.x + (lx * c - ly * s) * S, bike.y + (lx * s + ly * c) * S), r = Math.max(10, 0.42 * S * cam.ppm);
    fx.fillStyle = '#ffc35a'; fx.globalAlpha = 0.12 * pulse; fx.beginPath(); fx.arc(x, y, r * 1.3, 0, 6.283); fx.fill();
    fx.strokeStyle = '#ffc35a'; fx.globalAlpha = 0.9 * pulse; fx.lineWidth = 2.5; fx.beginPath(); fx.arc(x, y, r, 0, 6.283); fx.stroke(); }
  fx.restore(); fx.globalAlpha = 1;
}
