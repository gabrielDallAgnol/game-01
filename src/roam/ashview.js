// [roam] The ash, seen (the Point: docs/design/the-point.md §2). The grey has a cause you can see: where the machines
// hold an area, ash drifts down through the air, slow flakes on the wind; a clean area has none (its guardian filters
// it). And a big machine to free breathes ash out of its back like a stack (ashPlume, emitted from main.js). Render only:
// reads S.areaGrid, S.areas, S.dead; each flake is a hash of its 3 m cell and the time (no state).
const h1 = (a, b) => { let n = Math.imul(a * 374761393 + b * 668265263, 1274126177); n ^= n >>> 13; n = Math.imul(n, 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
export function drawAsh(fx, v) {
  const S = v.risk; if (!S || !S.areaGrid) return; const { toS, cam, t, cssW, cssH } = v, G0 = S.areaGrid, ppm = cam.ppm;
  const C = ppm < 8 ? 6 : 3, hw = cssW / ppm / 2 + C, hh = cssH / ppm / 2 + C, x0 = Math.floor((cam.x - hw) / C), x1 = Math.ceil((cam.x + hw) / C), y0 = Math.floor((cam.y - hh) / C), y1 = Math.ceil((cam.y + hh) / C);
  const dark = (x, y) => { const i = Math.floor(x / G0.cell), j = Math.floor(y / G0.cell); if (i < 0 || j < 0 || i >= G0.gw || j >= G0.gh) return false; const k = G0.ids[j * G0.gw + i]; return k >= 0 && S.areas[k] && S.areas[k].state !== 'clean'; };
  fx.save(); const r = Math.max(1, 0.07 * ppm);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const h = h1(i, j); if (h > 0.55) continue; const life = 7 + h * 6, k = ((t / life + h * 7.3) % 1);
    const wx = (i + h1(j, i)) * C + k * 2.6 + Math.sin(t * 0.8 + h * 20) * 0.4, wy = (j + h1(i + 7, j)) * C + k * 2.4; if (!dark(wx, wy)) continue;
    const z = (1 - k) * 7, [X, Y] = toS(wx, wy - z * 0.6); const a = Math.min(1, k * 6) * Math.min(1, (1 - k) * 4) * 0.5;
    fx.fillStyle = `rgba(200,198,192,${a})`; fx.fillRect(X - r / 2, Y - r / 2, r, r); }
  fx.restore();
}
