// Feet round walls, and where a dead may stand up. A dead that wants a point it cannot walk to in a straight line (the
// hero behind a building, its home round a corner) plans a short grid walk there instead of pressing into the wall.
// Plans are small (a window round both ends), cached on the dead and capped per step, so a crowd costs little.
// groundOk: the one test for a spawn point (open ground the camp can reach: never the void, a sealed courtyard, a roof).
import { N, PASSABLE, idx, inside } from './mapgen.js';
import { DIRS8, MinHeap } from './state.js';

export const STEER = { pad: 8, far: 44, perStep: 10, replan: 1.5, moved: 2.5, snap: 6 };   // window margin · longest plan · plans a step · s a plan lasts · target drift that replans · spawn snap radius

/** open ground the camp can walk to (reach is the camp's walkable component: never the void or a walled-in yard) */
export function groundOk(map, x, y) {
  const cx = Math.floor(x), cy = Math.floor(y); if (!inside(cx, cy)) return false;
  const i = idx(cx, cy); return !!map.reach[i] && PASSABLE[map.terrain[i]];
}
/** the reachable cell centre nearest (x, y) within r, or null */
export function nearestGround(map, x, y, r = STEER.snap) {
  if (groundOk(map, x, y)) return { x, y };
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let k = 1; k <= r; k++) {
    let best = null, bd = Infinity;
    for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue;
      const px = cx + dx + 0.5, py = cy + dy + 0.5, d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bd && groundOk(map, px, py)) { bd = d; best = { x: px, y: py }; }
    }
    if (best) return best;
  }
  return null;
}

export function createSteer(G) {
  const { S, map } = G;
  const W = 2 * (STEER.far + STEER.pad) + 2, dist = new Float32Array(W * W), prev = new Int32Array(W * W);
  let budgetT = -1, budget = 0;
  const cellOk = (m, cx, cy) => G.standable(m, cx + 0.5, cy + 0.5);
  /** can the dead walk straight from where it stands to (tx, ty)? */
  function lineClear(m, tx, ty) {   // every cell the segment crosses (a grid walk, so no corner is skipped)
    let cx = Math.floor(m.x), cy = Math.floor(m.y); const ex = Math.floor(tx), ey = Math.floor(ty), dx = tx - m.x, dy = ty - m.y;
    const sx = Math.sign(dx), sy = Math.sign(dy), ix = dx ? Math.abs(1 / dx) : Infinity, iy = dy ? Math.abs(1 / dy) : Infinity;
    let nx = dx ? (sx > 0 ? cx + 1 - m.x : m.x - cx) * ix : Infinity, ny = dy ? (sy > 0 ? cy + 1 - m.y : m.y - cy) * iy : Infinity;
    for (let k = 0; k < 400 && (cx !== ex || cy !== ey); k++) {
      if (nx < ny) { cx += sx; nx += ix; } else if (ny < nx) { cy += sy; ny += iy; }
      else { if (!cellOk(m, cx + sx, cy) || !cellOk(m, cx, cy + sy)) return false; cx += sx; cy += sy; nx += ix; ny += iy; }   // through a corner: both sides open
      if (!cellOk(m, cx, cy)) return false;
    }
    return true;
  }
  /** A* inside a window round both ends; the goal may be unreachable: then the closest cell to it */
  function plan(m, tx, ty) {
    const sx = Math.floor(m.x), sy = Math.floor(m.y), gx = Math.floor(tx), gy = Math.floor(ty);
    const x0 = Math.max(0, Math.min(sx, gx) - STEER.pad), y0 = Math.max(0, Math.min(sy, gy) - STEER.pad);
    const x1 = Math.min(N - 1, Math.max(sx, gx) + STEER.pad), y1 = Math.min(N - 1, Math.max(sy, gy) + STEER.pad), w = x1 - x0 + 1, hgt = y1 - y0 + 1;
    if (w > W || hgt > W) return null;
    dist.fill(Infinity, 0, w * hgt); prev.fill(-1, 0, w * hgt);
    const L = (x, y) => (y - y0) * w + (x - x0), s = L(sx, sy), heap = new MinHeap();
    dist[s] = 0; heap.push(Math.hypot(gx - sx, gy - sy), s);
    let best = s, bestD = Math.hypot(gx - sx, gy - sy);
    while (heap.size) {
      const i = heap.pop(), x = (i % w) + x0, y = ((i / w) | 0) + y0, dg = Math.hypot(gx - x, gy - y);
      if (heap.lastKey > dist[i] + dg + 1e-6) continue;
      if (dg < bestD) { bestD = dg; best = i; }
      if (x === gx && y === gy) break;
      for (const [dx, dy, len] of DIRS8) {
        const xx = x + dx, yy = y + dy; if (xx < x0 || yy < y0 || xx > x1 || yy > y1 || !cellOk(m, xx, yy)) continue;
        if (dx && dy && (!cellOk(m, x + dx, y) || !cellOk(m, x, y + dy))) continue;   // no squeezing past corners
        const j = L(xx, yy), nd = dist[i] + len; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; heap.push(nd + Math.hypot(gx - xx, gy - yy), j); }
      }
    }
    const pts = []; for (let i = best; i !== s && i >= 0; i = prev[i]) pts.push({ x: (i % w) + x0 + 0.5, y: ((i / w) | 0) + y0 + 0.5 });
    return pts.reverse();
  }
  /** walk toward (tx, ty) at speed s (already × dt): straight when clear, else along a planned route round the walls */
  function walkTo(m, tx, ty, s) {
    const D = Math.hypot(tx - m.x, ty - m.y);
    if (D <= STEER.far ? lineClear(m, tx, ty) : lineClear(m, m.x + (tx - m.x) * 4 / D, m.y + (ty - m.y) * 4 / D)) { m.route = null; G.moveToward(m, tx, ty, s); return; }
    if (D > STEER.far) { const k = (STEER.far - 2) / D; tx = m.x + (tx - m.x) * k; ty = m.y + (ty - m.y) * k; }   // far away: plan toward a point on the way
    let r = m.route;
    if (!r || Math.hypot(r.tx - tx, r.ty - ty) > STEER.moved || S.time - r.at > STEER.replan) {
      if (budgetT !== S.time) { budgetT = S.time; budget = STEER.perStep; }
      if (budget > 0) { budget--; const pts = plan(m, tx, ty); r = m.route = pts ? { tx, ty, at: S.time, pts, k: 0 } : null; }
    }
    if (!r) { G.moveToward(m, tx, ty, s); return; }   // no plan this step: lean on (the next step may plan)
    if (!r.pts.length) return;   // nowhere nearer to stand: wait for the next plan
    let p = r.pts[r.k];
    if (Math.hypot(p.x - m.x, p.y - m.y) < 0.35 && r.k < r.pts.length - 1) p = r.pts[++r.k];
    G.moveToward(m, p.x, p.y, s);
  }
  /** a spawn point on reachable ground: (x, y) if good, else the nearest good cell, else the fallback point */
  const spawnPoint = (x, y, fx, fy) => nearestGround(map, x, y) || (fx !== undefined ? nearestGround(map, fx, fy) : null) || { x, y };
  return { walkTo, lineClear, spawnPoint, groundOk: (x, y) => groundOk(map, x, y) };
}
