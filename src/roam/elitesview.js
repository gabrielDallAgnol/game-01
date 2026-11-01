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
