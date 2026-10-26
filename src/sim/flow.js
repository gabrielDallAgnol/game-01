// Flow fields: distance from every cell to the nearest cell next to a building.
// The dead walk downhill on this field. Palisades are walkable but very costly,
// so the dead go around them when they can and break through when they can't.
import { N, PASSABLE, MOVE_COST } from './mapgen.js';

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
export { DIRS };

// A binary heap on typed arrays (keys are float32 distances, values cell indices), grown by doubling. Dijkstra's
// answer is the same whatever order equal keys pop in, so this gives the very fields the old array heap gave.
class Heap {
  constructor(cap = 1 << 16) { this.k = new Float32Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  push(key, val) {
    if (this.n === this.k.length) { const k = new Float32Array(this.n * 2), v = new Int32Array(this.n * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
    const k = this.k, v = this.v; let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0]; this.topKey = k[0]; const n = --this.n;
    if (n > 0) {
      const lk = k[n], lv = v[n]; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = -1, mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) m = r; if (m < 0) break; k[i] = k[m]; v[i] = v[m]; i = m; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  get size() { return this.n; }
}
const DX = Int32Array.from(DIRS, d => d[0]), DY = Int32Array.from(DIRS, d => d[1]), LEN = Float64Array.from(DIRS, d => d[2]);

/**
 * @param terrain Uint8Array of terrain types
 * @param occ Int32Array: -1 free, otherwise the building id on that cell
 * @param isWall (id) => boolean
 * @param wallCost extra cost to step onto a palisade cell
 */
export function computeFlow(terrain, occ, isWall, wallCost) {
  const NN = N * N, dist = new Float32Array(NN).fill(Infinity);
  const heap = new Heap();
  // per cell, once: 1 = blocked (impassable ground or a solid building), 2 = a palisade, 4 = any building (solid or palisade)
  const fl = new Uint8Array(NN), wallOf = new Map();
  for (let i = 0; i < NN; i++) {
    const o = occ[i]; let f = PASSABLE[terrain[i]] ? 0 : 1;
    if (o >= 0) { let w = wallOf.get(o); if (w === undefined) { w = !!isWall(o); wallOf.set(o, w); } f |= w ? 6 : 5; }
    fl[i] = f;
  }
  const solid = i => (fl[i] & 6) === 4;   // a building that is not a palisade
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (fl[i] & 5) continue;
    for (let d = 0; d < 8; d++) {
      const xx = x + DX[d], yy = y + DY[d];
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      if (solid(yy * N + xx)) { dist[i] = 0; heap.push(0, i); break; }
    }
  }
  while (heap.size) {
    const i = heap.pop(); const dd = dist[i];
    if (heap.topKey > dd) continue; // stale entry
    const x = i % N, y = (i / N) | 0;
    for (let d = 0; d < 8; d++) {
      const dx = DX[d], dy = DY[d], xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx, fj = fl[j];
      if (fj & 1) continue;
      if (dx && dy && ((fl[y * N + xx] | fl[yy * N + x]) & 5)) continue; // no corner cutting, not even between two palisade posts
      const step = LEN[d] * MOVE_COST[terrain[j]] + (fj & 4 ? wallCost : 0);
      const nd = Math.fround(dd + step);   // compare as stored (float32): an equal value read as 'shorter' re-queued a cell forever on big open ground
      if (nd < dist[j]) { dist[j] = nd; heap.push(nd, j); }
    }
  }
  return dist;
}

/** For every cell, the neighbour cell that is one step downhill (or -1). */
export function computeNext(terrain, dist, occ) {
  const next = new Int32Array(N * N).fill(-1), INF = Infinity;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, di = dist[i]; if (di === INF || di === 0 || di !== di) continue;
    let best = -1, bd = di;
    for (let d = 0; d < 8; d++) {
      const dx = DX[d], dy = DY[d], xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      if (dist[j] < bd) { if (dx && dy) { const a = y * N + xx, b = yy * N + x; if (dist[a] === INF || dist[b] === INF || (occ && (occ[a] >= 0 || occ[b] >= 0))) continue; } bd = dist[j]; best = j; }
    }
    next[i] = best;
  }
  return next;
}
