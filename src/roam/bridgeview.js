// [roam] Bridges on screen (the Point): a broken deck's two snapped ends (concrete chunks, rebar reaching over the gap,
// rubble in the water under it); while it is mended, two steel girders across first, then timber planks laid from one end
// as the work goes; mended, a full deck with rails. Volumes in the glyph medium; reads S.bridges, writes nothing.
const hb = (a, b) => { let n = Math.imul(a * 73856093 ^ b * 19349663, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
export function bridgeVolumes(S, K, t, on) {
  const { sphere, capsule, box, M } = K;
  for (const b of S.bridges || []) { if (!on(b.x, b.y)) continue; const ux = b.ux, uy = b.uy, px = -uy, py = ux, a = Math.atan2(uy, ux), W = b.half - 0.4, G = b.gap;
    const at = (s, o) => [b.x + ux * s + px * o, b.y + uy * s + py * o];
    // the snapped ends: a ragged row of concrete chunks along each broken edge, rebar bent out over the gap
    for (const sg of [-1, 1]) for (let i = 0; i < 9; i++) { const o = -W + (i + 0.5) * (2 * W / 9), r = hb(i, sg + 5), len = 0.4 + 1.1 * r, [x, y] = at(sg * (G + len / 2 - 0.2), o);
      if (b.state === 'mended') break; box(x, y, 0.05, len / 2, W / 9, 0.32, 0.04, a, M.stone);
      if (r > 0.45) { const [x0, y0] = at(sg * (G - 0.1), o), [x1, y1] = at(sg * (G - 0.9 - r), o + (hb(i, 9) - 0.5)); capsule(x0, y0, 0.2, x1, y1, 0.05 - r * 0.4, 0.035, M.rust); } }
    if (b.state === 'broken') { for (let i = 0; i < 6; i++) { const [x, y] = at((hb(i, 3) - 0.5) * G * 1.4, (hb(i, 4) - 0.5) * W * 1.6); box(x, y, -0.25, 0.5 + hb(i, 6) * 0.5, 0.4, 0.3, 0.1, hb(i, 7) * 6, M.stone); } continue; }
    // the mend: girders first, then planks from the town's end (the deck's a-side) as prog goes
    const k = b.state === 'mended' ? 1 : b.prog, gir = Math.min(1, k / 0.3), plk = Math.max(0, (k - 0.3) / 0.7);
    for (const o of [-W * 0.6, W * 0.6]) { const [x0, y0] = at(-G - 0.6, o), [x1, y1] = at(-G - 0.6 + (2 * G + 1.2) * gir, o); capsule(x0, y0, 0.15, x1, y1, 0.15, 0.22, M.steel); }
    const n = Math.floor(plk * 22); for (let i = 0; i < n; i++) { const s = -G + (i + 0.5) * (2 * G / 22), [x, y] = at(s, 0); box(x, y, 0.32, G / 22 * 0.9, W, 0.06, 0.02, a, M.wood); }
    if (b.state === 'mended') for (const o of [-W, W]) { const [x0, y0] = at(-G, o), [x1, y1] = at(G, o); capsule(x0, y0, 1.0, x1, y1, 1.0, 0.06, M.steel); for (let i = 0; i <= 6; i++) { const [x, y] = at(-G + i * (2 * G / 6), o); capsule(x, y, 0.3, x, y, 1.0, 0.05, M.steel); } }
    else { const [x, y] = at(-G - 1.5, W + 0.8); box(x, y, 0.4, 0.5, 0.5, 0.4, 0.05, a, M.wood); sphere(x, y, 1.2, 0.12, M.lamp, 0.8 + 0.2 * Math.sin(t * 5)); }   // the work: a stack of timber and a work lamp
  }
}
