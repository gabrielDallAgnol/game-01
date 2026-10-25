// Stage: nav. The walkable grid (1 m cells) is derived from what atoms declare as their
// collision — never drawn by hand — so paths, collisions and placement always agree.
import { NAV_CELL } from '../units.js';
import { createOcc } from '../occupancy.js';
import { pointInObb } from '../geom.js';

export const navStage = {
  name: 'nav',
  run(W) {
    const O = createOcc(W.w / NAV_CELL, W.h / NAV_CELL), BLOCK = 1;
    W.water.forEach(wt => O.poly(wt.pts, wt.w / 2, BLOCK));
    // bridges reopen the water under them
    W.bridges.forEach(b => { for (let j = 0; j < O.h; j++) for (let i = 0; i < O.w; i++) if (pointInObb(b, i + 0.5, j + 0.5)) O.g[j * O.w + i] = 0; });
    W.placed.forEach(p => {
      const c = p.def.collide;
      if (c === 'box') O.obb(p, BLOCK);
      else if (c === 'circle') O.disc(p.x, p.y, p.def.trunk || p.def.size[0] / 2, BLOCK);
    });
    W.fences.forEach(f => O.seg(f.a, f.b, f.def && f.def.thick ? f.def.thick / 2 : 0.2, BLOCK));
    W.nav = { w: O.w, h: O.h, cell: NAV_CELL, blocked: O.g, at: (x, y) => O.at(x / NAV_CELL, y / NAV_CELL) };
    let walk = 0; for (const v of O.g) if (!v) walk++;
    W.note('nav', `${walk} walkable m² of ${O.w * O.h}`);
  },
};

// Breadth-first reach from a point over the nav grid; returns a function telling if a point is reachable.
export function reachFrom(W, x, y) {
  const N = W.nav, seen = new Uint8Array(N.w * N.h), q = new Int32Array(N.w * N.h);
  let h = 0, t = 0; const s = Math.floor(y) * N.w + Math.floor(x);
  if (N.blocked[s]) { for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const k = (Math.floor(y) + dy) * N.w + Math.floor(x) + dx; if (!h && k >= 0 && k < N.w * N.h && !N.blocked[k]) { q[t++] = k; seen[k] = 1; h = -1; } } h = 0; }
  else { q[t++] = s; seen[s] = 1; }
  while (h < t) { const k = q[h++], i = k % N.w, j = (k / N.w) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N.w || jj >= N.h) continue; const kk = jj * N.w + ii; if (!seen[kk] && !N.blocked[kk]) { seen[kk] = 1; q[t++] = kk; } } }
  return (px, py) => { const i = Math.floor(px), j = Math.floor(py); if (i < 0 || j < 0 || i >= N.w || j >= N.h) return false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = (j + dy) * N.w + i + dx; if (k >= 0 && k < seen.length && seen[k]) return true; } return false; };
}
