// Street networks from raw straight pieces: split every piece wherever another crosses it or ends on it, merge
// nearby ends into junction nodes, and keep only what is reachable from a start. The result obeys the street.end /
// junction grammar (streets meet only at ends or junctions), so stages can lay out by drawing lines and let this
// module make the junctions. Deterministic: pieces and nodes come out in input order.
import { segIntersect, distToSeg } from './geom.js';

/** raw: [{ a, b, ...props }] → { streets: [{ ...props, id, pts, ends }], nodes: [{ id, x, y, deg }] } */
export function nodeNetwork(raw, { snap = 3, prefix = 's' } = {}) {
  const cuts = raw.map(() => [0, 1]), L = raw.map(r => Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y));
  for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) {
    const A = raw[i], B = raw[j];
    if (Math.max(A.a.x, A.b.x) + snap < Math.min(B.a.x, B.b.x) || Math.max(B.a.x, B.b.x) + snap < Math.min(A.a.x, A.b.x) || Math.max(A.a.y, A.b.y) + snap < Math.min(B.a.y, B.b.y) || Math.max(B.a.y, B.b.y) + snap < Math.min(A.a.y, A.b.y)) continue;
    const h = segIntersect(A.a, A.b, B.a, B.b); if (h) { cuts[i].push(h.t); cuts[j].push(h.u); continue; }
    // a T: one piece ends on (or just short of) the other
    const tee = (P, Q, qi, Lq) => [P.a, P.b].forEach(e => { if (distToSeg(e.x, e.y, Q.a, Q.b) < snap) { const t = ((e.x - Q.a.x) * (Q.b.x - Q.a.x) + (e.y - Q.a.y) * (Q.b.y - Q.a.y)) / (Lq * Lq); if (t > 0 && t < 1) cuts[qi].push(t); } });
    tee(A, B, j, L[j]); tee(B, A, i, L[i]);
  }
  const nodes = [], nodeAt = p => { for (const n of nodes) if (Math.hypot(n.x - p.x, n.y - p.y) < snap) return n; const n = { id: `${prefix}n${nodes.length}`, x: p.x, y: p.y, deg: 0 }; nodes.push(n); return n; };
  const streets = [], seen = new Set();
  raw.forEach((r, i) => {
    const ts = [...new Set(cuts[i])].sort((a, b) => a - b), { a: A, b: B, ...props } = r;
    const pt = t => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
    for (let k = 0; k < ts.length - 1; k++) {
      const na = nodeAt(pt(ts[k])), nb = nodeAt(pt(ts[k + 1])); if (na === nb) continue;
      const key = na.id < nb.id ? `${na.id}|${nb.id}` : `${nb.id}|${na.id}`; if (seen.has(key)) continue; seen.add(key);
      streets.push({ ...props, id: `${prefix}${streets.length}`, pts: [{ x: na.x, y: na.y }, { x: nb.x, y: nb.y }], ends: [na.id, nb.id] });
    }
  });
  streets.forEach(s => s.ends.forEach(e => nodes.find(n => n.id === e).deg++));
  return { streets, nodes };
}

/** keep the streets reachable from node `start`; drop orphaned nodes */
export function reachableNetwork(net, start) {
  const adj = new Map(); net.streets.forEach(s => { const [a, b] = s.ends; (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); });
  const seen = new Set([start]), q = [start]; while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  const streets = net.streets.filter(s => seen.has(s.ends[0])), nodes = net.nodes.filter(n => seen.has(n.id));
  nodes.forEach(n => { n.deg = streets.filter(s => s.ends.includes(n.id)).length; });
  return { streets, nodes, dropped: net.streets.length - streets.length };
}

/** node ids reachable from `start` over W.streets (validators use it) */
export function reachNodes(streets, start) {
  const adj = new Map(); streets.forEach(s => { if (!s.ends) return; const [a, b] = s.ends; (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); });
  const seen = new Set([start]), q = [start]; while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  return seen;
}
