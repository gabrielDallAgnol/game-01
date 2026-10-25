// A uniform spatial hash over axis-aligned boxes, so "does anything near this overlap?" costs a few cells, not a scan
// of the whole world. Queries visit each item once and in insertion order, so results never depend on the cell size.
export function createHash(cell = 32) {
  const cells = new Map(), items = [], boxes = []; let stamp = 0; const seen = [];
  const key = (i, j) => i * 73856093 ^ j * 19349663;
  const span = (b, f) => { const i0 = Math.floor(b[0] / cell), j0 = Math.floor(b[1] / cell), i1 = Math.floor(b[2] / cell), j1 = Math.floor(b[3] / cell); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(key(i, j)); };
  const H = {
    size: () => items.length,
    /** add an item with its box [x0, y0, x1, y1]; returns its index */
    add(item, box) { const n = items.length; items.push(item); boxes.push(box); seen.push(0); span(box, k => { const c = cells.get(k); if (c) c.push(n); else cells.set(k, [n]); }); return n; },
    /** indices of items whose box meets `box`, ascending */
    near(box) { const out = [], s = ++stamp; span(box, k => { const c = cells.get(k); if (c) for (const n of c) if (seen[n] !== s) { seen[n] = s; const b = boxes[n]; if (b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1]) out.push(n); } }); return out.sort((a, b) => a - b); },
    /** true if pred holds for some item whose box meets `box` */
    some(box, pred) { for (const n of H.near(box)) if (pred(items[n], n)) return true; return false; },
    item: n => items[n],
  };
  return H;
}
