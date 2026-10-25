// Stage: roads. Route 9 crosses the chapter; a suburb grid sits north of it with junctions
// at every crossing; connectors join the grid to the highway. Streets meet only at ends or
// junctions (the street.end socket), so nothing overlaps by accident.
import { STREET } from '../units.js';
import { catmull, lerp, distToPoly } from '../geom.js';
import { nameStreets } from '../names.js';

export const roadsStage = {
  name: 'roads',
  run(W, seed) {
    const rng = seed.rng();
    // Route 9
    const y0 = W.h * 0.8 + rng.range(-6, 6), y1 = W.h * 0.68 + rng.range(-6, 6);
    const r9 = catmull([{ x: -12, y: y0 }, { x: W.w * 0.35, y: lerp(y0, y1, 0.3) + rng.range(-5, 5) }, { x: W.w * 0.7, y: lerp(y0, y1, 0.75) + rng.range(-5, 5) }, { x: W.w + 12, y: y1 }], 6);
    W.streets.push({ id: 'r9', name: 'route 9', pts: r9, w: STREET.highway, walk: 0, kind: 'highway', marks: 'double' });
    // the suburb grid (3 × 3 blocks): spacing from two lot depths / four lot widths plus a street
    const colSp = 4 * 18 + STREET.local + 2 * STREET.kerb + 0.4, rowSp = 2 * 24 + STREET.local + 2 * STREET.kerb + 0.4;
    const g = { x: W.w * 0.5 + rng.range(-8, 8), y: W.h * 0.34 + rng.range(-5, 5), ang: rng.range(-0.12, 0.12), colSp, rowSp, ncol: 4, nrow: 4 };
    g.lx = i => (i - (g.ncol - 1) / 2) * colSp; g.ly = j => (j - (g.nrow - 1) / 2) * rowSp;
    g.toW = (lx, ly) => ({ x: g.x + lx * Math.cos(g.ang) - ly * Math.sin(g.ang), y: g.y + lx * Math.sin(g.ang) + ly * Math.cos(g.ang) });
    const node = (i, j) => `${i},${j}`, edges = new Map();
    for (let j = 0; j < g.nrow; j++) for (let i = 0; i < g.ncol - 1; i++) edges.set(`h:${i},${j}`, [node(i, j), node(i + 1, j)]);
    for (let i = 0; i < g.ncol; i++) for (let j = 0; j < g.nrow - 1; j++) edges.set(`v:${i},${j}`, [node(i, j), node(i, j + 1)]);
    // drop up to two interior streets for variety, keeping every junction connected
    const connected = () => { const adj = new Map(); edges.forEach(([a, b]) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }); const start = adj.keys().next().value, seen = new Set([start]), q = [start]; while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); } return seen.size === g.ncol * g.nrow; };
    const tryDrop = (key, p) => { if (!edges.has(key) || !rng.chance(p)) return; const keep = edges.get(key); edges.delete(key); if (!connected()) edges.set(key, keep); else W.note('roads', `dropped ${key}`); };
    tryDrop(`v:${1 + rng.int(2)},${rng.int(3)}`, 0.7);
    tryDrop(`h:${rng.int(3)},${1 + rng.int(2)}`, 0.45);
    g.has = key => edges.has(key);
    edges.forEach(([a, b], key) => {
      const [ia, ja] = a.split(',').map(Number), [ib, jb] = b.split(',').map(Number);
      W.streets.push({ id: key, pts: [g.toW(g.lx(ia), g.ly(ja)), g.toW(g.lx(ib), g.ly(jb))], w: STREET.local, walk: STREET.kerb, kind: 'local', marks: 'dash', ends: [a, b] });
    });
    for (let j = 0; j < g.nrow; j++) for (let i = 0; i < g.ncol; i++) { const deg = [...edges.values()].filter(e => e.includes(node(i, j))).length; W.nodes.push({ id: node(i, j), ...g.toW(g.lx(i), g.ly(j)), deg }); }
    // connectors from the bottom row of junctions down to Route 9
    const down = { x: -Math.sin(g.ang), y: Math.cos(g.ang) };
    [1, 2].forEach(i => { const a = g.toW(g.lx(i), g.ly(g.nrow - 1)); let p = { ...a }; for (let k = 0; k < 400; k++) { p = { x: p.x + down.x, y: p.y + down.y }; if (distToPoly(p.x, p.y, r9) < STREET.highway / 2) break; }
      W.streets.push({ id: `c:${i}`, pts: [a, p], w: STREET.connector, walk: STREET.kerb, kind: 'local', marks: 'dash', ends: [node(i, g.nrow - 1), 'r9'] }); });
    W.grid = g;
    nameStreets(W, seed.child('names').rng(), 'suburb');
    W.note('roads', `${W.streets.length} streets, ${W.nodes.length} junctions`);
  },
};
