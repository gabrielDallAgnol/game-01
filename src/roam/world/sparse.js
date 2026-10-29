// [roam] A sparse byte grid: the world is big and mostly open fields, so a full Uint8Array at 2 cells a metre (23 MB for
// 2.6 × 2.2 km) is mostly zeros. Cells live in 64 × 64 chunks made on first write; a read of an untouched chunk is 0.
// get(gx, gy) / set(gx, gy, v) by cell, getI(k) / setI(k, v) by the flat index gy * w + gx (a drop-in for code written
// against a flat array). `bytes()` is what it holds.
export function sparseGrid(w, h) {
  const B = 6, M = 63, cw = (w + M) >> B, ch = (h + M) >> B, chunks = new Array(cw * ch).fill(null);
  const get = (gx, gy) => { if (gx < 0 || gy < 0 || gx >= w || gy >= h) return 0; const c = chunks[(gy >> B) * cw + (gx >> B)]; return c ? c[((gy & M) << B) | (gx & M)] : 0; };
  const set = (gx, gy, v = 1) => { if (gx < 0 || gy < 0 || gx >= w || gy >= h) return; const k = (gy >> B) * cw + (gx >> B); let c = chunks[k];
    if (!c) { if (!v) return; c = chunks[k] = new Uint8Array(4096); } c[((gy & M) << B) | (gx & M)] = v; };
  return { w, h, get, set, getI: k => get(k % w, (k / w) | 0), setI: (k, v = 1) => set(k % w, (k / w) | 0, v), bytes: () => chunks.reduce((n, c) => n + (c ? 4096 : 0), 0) + chunks.length * 8 };
}
