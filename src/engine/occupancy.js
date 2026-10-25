// A 1 m occupancy grid: stages mark what they used, so later stages (forest, props)
// only place where it is free. Codes say what took the cell; 0 is free.
import { obbBox, pointInObb, distToSeg } from './geom.js';

export const OCC = { FREE: 0, STREET: 1, WATER: 2, LOT: 3, BUILDING: 4, PROP: 5, TREE: 6, CAMP: 7, EDGE: 8 };

export function createOcc(w, h) {
  const W = Math.ceil(w), H = Math.ceil(h), g = new Uint8Array(W * H);
  const set = (i, j, v, force) => { if (i < 0 || j < 0 || i >= W || j >= H) return; const k = j * W + i; if (force || g[k] < v) g[k] = v; };
  const O = {
    w: W, h: H, g,
    at: (x, y) => { const i = Math.floor(x), j = Math.floor(y); return (i < 0 || j < 0 || i >= W || j >= H) ? OCC.EDGE : g[j * W + i]; },
    obb(o, v, pad = 0) { const b = obbBox(o, pad); for (let j = Math.floor(b[1]); j <= Math.ceil(b[3]); j++) for (let i = Math.floor(b[0]); i <= Math.ceil(b[2]); i++) if (pointInObb(o, i + 0.5, j + 0.5, pad)) set(i, j, v); },
    seg(a, b, half, v) { const x0 = Math.min(a.x, b.x) - half, x1 = Math.max(a.x, b.x) + half, y0 = Math.min(a.y, b.y) - half, y1 = Math.max(a.y, b.y) + half;
      for (let j = Math.floor(y0); j <= Math.ceil(y1); j++) for (let i = Math.floor(x0); i <= Math.ceil(x1); i++) if (distToSeg(i + 0.5, j + 0.5, a, b) <= half) set(i, j, v); },
    poly(pts, half, v) { for (let k = 0; k < pts.length - 1; k++) O.seg(pts[k], pts[k + 1], half, v); },
    disc(x, y, r, v) { for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) if (Math.hypot(i + 0.5 - x, j + 0.5 - y) <= r) set(i, j, v); },
    free(x, y, r, below = OCC.LOT) { for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) { if (Math.hypot(i + 0.5 - x, j + 0.5 - y) > r) continue; const v = O.at(i + 0.5, j + 0.5); if (v !== OCC.FREE && v >= below) return false; if (v === OCC.EDGE) return false; } return true; },
  };
  return O;
}
