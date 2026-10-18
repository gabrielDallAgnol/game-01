// Flow fields: distance from every cell to the nearest cell next to a building.
// The dead walk downhill on this field. Palisades are walkable but very costly,
// so the dead go around them when they can and break through when they can't.
import { N, PASSABLE, MOVE_COST, idx } from './mapgen.js';

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
export { DIRS };

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v, top = v[0]; this.topKey = k[0]; const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; }
    }
    return top;
  }
  get size() { return this.k.length; }
}

/**
 * @param terrain Uint8Array of terrain types
 * @param occ Int32Array: -1 free, otherwise the building id on that cell
 * @param isWall (id) => boolean
 * @param wallCost extra cost to step onto a palisade cell
 */
export function computeFlow(terrain, occ, isWall, wallCost) {
  const dist = new Float32Array(N * N).fill(Infinity);
  const heap = new Heap();
  const blocked = i => !PASSABLE[terrain[i]] || (occ[i] >= 0 && !isWall(occ[i]));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    if (blocked(i) || occ[i] >= 0) continue;
    for (const [dx, dy] of DIRS) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = idx(xx, yy);
      if (occ[j] >= 0 && !isWall(occ[j])) { dist[i] = 0; heap.push(0, i); break; }
    }
  }
  while (heap.size) {
    const i = heap.pop(); const d = dist[i];
    if (heap.topKey > d) continue; // stale entry
    const x = i % N, y = (i / N) | 0;
    for (const [dx, dy, len] of DIRS) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = idx(xx, yy);
      if (blocked(j)) continue;
      if (dx && dy && (occ[idx(x + dx, y)] >= 0 || occ[idx(x, y + dy)] >= 0 || blocked(idx(x + dx, y)) || blocked(idx(x, y + dy)))) continue; // no corner cutting, not even between two palisade posts
      const step = len * MOVE_COST[terrain[j]] + (occ[j] >= 0 ? wallCost : 0);
      if (d + step < dist[j]) { dist[j] = d + step; heap.push(dist[j], j); }
    }
  }
  return dist;
}

/** For every cell, the neighbour cell that is one step downhill (or -1). */
export function computeNext(terrain, dist, occ) {
  const next = new Int32Array(N * N).fill(-1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y); if (!Number.isFinite(dist[i]) || dist[i] === 0) continue;
    let best = -1, bd = dist[i];
    for (const [dx, dy] of DIRS) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = idx(xx, yy);
      if (dist[j] < bd) { if (dx && dy && (!Number.isFinite(dist[idx(x + dx, y)]) || !Number.isFinite(dist[idx(x, y + dy)]) || (occ && (occ[idx(x + dx, y)] >= 0 || occ[idx(x, y + dy)] >= 0)))) continue; bd = dist[j]; best = j; }
    }
    next[i] = best;
  }
  return next;
}
