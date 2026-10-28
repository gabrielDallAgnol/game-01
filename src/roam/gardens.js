// [roam] The gardens: about half the houses kept a plot, and this lays them out and paints them into the town's data
// canvases for the ground shader (src/roam/garden-look.js draws them). Visual only: nothing here blocks feet.
//   kinds: a front strip of flowers along the door wall (a path through it to the street, sometimes a picket fence);
//   a back garden behind the house, hedged or fenced on its three open sides, laid out as beds round a lawn, kitchen
//   rows, or a path between beds; and the overgrown one, gone to bush behind a ragged hedge.
//   channels (all free before this ran): xC.b the plot and its kind (padded 0.5 m, so the shader knows the kind at the
//   border: 64 strip, 128 hedged, 192 fenced, 255 wild); hC.g how much grows (115 lawn, 255 bed, 205 wild; 0 on paths
//   and under borders); hC.b the border (hedge or fence by kind); lC.b the paths (255 gravel, 140 trodden earth).
// Deterministic: everything hangs off the house's uid and the town's seed.
const hashG = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const KIND = { strip: 64, hedge: 128, fence: 192, wild: 255 };

export function paintGardens({ buildings, blocked, sC, xX, hX, lX, O, SPAN, MPX, seed }) {
  const sd = sC.getContext('2d').getImageData(0, 0, sC.width, sC.height).data, SW = sC.width;
  const street = (x, y) => { const px = Math.floor((x - O.x) * MPX), py = Math.floor((y - O.y) * MPX); return px < 0 || py < 0 || px >= SW || py >= SW || sd[(py * SW + px) * 4 + 3] > 20; };
  const GR = 2, GN = SPAN * GR, taken = new Uint8Array(GN * GN);   // the gardens' padded plots, so no two touch
  const cellOf = (x, y) => { const gx = Math.floor((x - O.x) * GR), gy = Math.floor((y - O.y) * GR); return gx < 0 || gy < 0 || gx >= GN || gy >= GN ? -1 : gy * GN + gx; };
  // a side of a house as a frame: u along the wall, v out from it (0 at the wall)
  const SIDES = [[0, 1], [Math.PI, 1], [-Math.PI / 2, 0], [Math.PI / 2, 0]];
  const frame = (p, s) => { const [a, ax] = SIDES[s], half = ax ? p.h / 2 : p.w / 2, A = p.rot + a, c = Math.cos(A), sn = Math.sin(A);
    return { A, c, sn, L: ax ? p.w : p.h, ox: p.x - sn * half, oy: p.y + c * half }; };
  const at = (F, u, v) => [F.ox + u * F.c - v * F.sn, F.oy + u * F.sn + v * F.c];
  const sideOf = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y, c = Math.cos(p.rot), s = Math.sin(p.rot), lx = dx * c + dy * s, ly = -dx * s + dy * c;
    return Math.abs(lx) / (p.w / 2) > Math.abs(ly) / (p.h / 2) ? (lx > 0 ? 2 : 3) : (ly > 0 ? 0 : 1); };
  const OPP = [1, 0, 3, 2];
  // a plot is free when every point of it (and a margin) is open ground: no wall, no street, no other garden
  const free = (F, u0, u1, v0, v1, m) => { for (let v = v0 + 0.35; v <= v1 + m + 1e-6; v += 0.45) for (let u = u0 - m; u <= u1 + m + 1e-6; u += 0.45) { const [x, y] = at(F, u, v);
    if (blocked(x, y) || street(x, y)) return false; const k = cellOf(x, y); if (k < 0 || taken[k]) return false; } return true; };
  const take = (F, u0, u1, v0, v1) => { for (let v = v0 - 0.75; v <= v1 + 0.75; v += 0.25) for (let u = u0 - 0.75; u <= u1 + 0.75; u += 0.25) { const k = cellOf(...at(F, u, v)); if (k >= 0) taken[k] = 1; } };
  const shapes = [];   // { F, layer: gate|grow|cut|border|path, val, r: [u0, v0, u1, v1] } or { …, c: [u, v, rad] }
  const rect = (F, layer, val, u0, v0, u1, v1) => shapes.push({ F, layer, val, r: [u0, v0, u1, v1] });
  const blob = (F, layer, val, u, v, rad) => shapes.push({ F, layer, val, c: [u, v, rad] });
  const border = (F, layer, val, u0, v0, u1, v1) => { rect(F, layer, val, u0, v0, u1, v1); rect(F, 'cut', 255, u0, v0, u1, v1); };

  // a front strip: beds along the door wall, the path from the door cut through to the street
  function strip(p, s, h, door) {
    const F = frame(p, s), u0 = -F.L / 2 + 0.3, u1 = F.L / 2 - 0.3; if (u1 - u0 < 2.5) return false;
    let D = 0; for (const d of [2.2, 1.8, 1.4, 1.1]) if (free(F, u0, u1, 0.35, 0.35 + d, 0.4)) { D = d; break; } if (!D) return false;
    const v1 = 0.35 + D, fence = hashG(h + 3) < 0.4; take(F, u0, u1, 0.35, v1);
    rect(F, 'gate', fence ? KIND.fence : KIND.strip, u0 - 0.5, 0, u1 + 0.5, v1 + 0.5); rect(F, 'grow', 255, u0, 0.35, u1, v1 - (fence ? 0.35 : 0));
    let ud = 0; if (door) { const dx = door.x - F.ox, dy = door.y - F.oy; ud = dx * F.c + dy * F.sn; }
    if (fence) { if (door) { border(F, 'border', 255, u0, v1 - 0.3, ud - 0.75, v1 - 0.05); border(F, 'border', 255, ud + 0.75, v1 - 0.3, u1, v1 - 0.05); } else border(F, 'border', 255, u0, v1 - 0.3, u1, v1 - 0.05); border(F, 'border', 255, u0, 0.35, u0 + 0.25, v1); border(F, 'border', 255, u1 - 0.25, 0.35, u1, v1); }
    if (door) { let len = v1 + 0.3; for (let v = v1; v < 14; v += 0.25) { const [x, y] = at(F, ud, v); if (street(x, y) || blocked(x, y)) { len = v + 0.25; break; } len = v; }
      rect(F, 'path', 255, ud - 0.6, 0, ud + 0.6, len); rect(F, 'cut', 255, ud - 0.75, 0, ud + 0.75, len);
      if (len > v1 + 0.5) { rect(F, 'gate', fence ? KIND.fence : KIND.strip, ud - 1.1, v1 + 0.5, ud + 1.1, len + 0.3); take(F, ud - 0.6, ud + 0.6, v1, len); } }   // the plot reaches along its path
    return true;
  }
  // a back garden (or one off a gable end): the plot, its border on the three open sides with a gap, then its layout
  function back(p, s, h) {
    const F = frame(p, s); let fit = null;
    for (const D of [9, 8, 7, 6, 5, 4]) { for (const ex of [1.5, 0.6, 0]) { const u0 = -F.L / 2 - ex, u1 = F.L / 2 + ex; if (u1 - u0 > 4 && u1 - u0 < 22 && free(F, u0, u1, 0.35, D, 0.3)) { fit = [u0, u1, D]; break; } } if (fit) break; }
    if (!fit) return false;
    const [u0, u1, D] = fit, k = hashG(h + 5), wild = k < 0.2, fence = !wild && k > 0.62, bw = wild ? 0.9 : fence ? 0.32 : 0.75, iv = 0.35;
    take(F, u0, u1, iv, D); rect(F, 'gate', wild ? KIND.wild : fence ? KIND.fence : KIND.hedge, u0 - 0.5, 0, u1 + 0.5, D + 0.5);
    const gapL = hashG(h + 7) < 0.5, gv = iv + 0.6;   // the way in: a gap in one side, near the house
    const side = (ua, ub, va, vb) => { if (!wild) return border(F, 'border', 255, ua, va, ub, vb);
      // the wild hedge: a run of uneven bushes, gaps where one died
      const along = ub - ua > vb - va, n = Math.max(2, Math.round((along ? ub - ua : vb - va) / 0.55));
      for (let i = 0; i <= n; i++) { const r = hashG(h * 13 + i * 7 + Math.round(ua * 10 + va * 100)); if (r < 0.12) continue; const f = i / n, cu = along ? ua + (ub - ua) * f : (ua + ub) / 2, cv = along ? (va + vb) / 2 : va + (vb - va) * f;
        blob(F, 'border', 255, cu, cv, 0.28 + 0.3 * hashG(h + i * 31 + 1)); blob(F, 'cut', 255, cu, cv, 0.28 + 0.3 * hashG(h + i * 31 + 1)); } };
    const i0 = 0.1, i1 = 0.1 + bw;
    side(u0 + i0, u1 - i0, D - i1, D - i0);   // the far side
    if (gapL) { side(u0 + i0, u0 + i1, gv + 1.2, D - i0); side(u1 - i1, u1 - i0, iv, D - i0); } else { side(u0 + i0, u0 + i1, iv, D - i0); side(u1 - i1, u1 - i0, gv + 1.2, D - i0); }
    if (!wild) { const gu = gapL ? u0 + i0 : u1 - i1; rect(F, 'path', 140, gu - 0.3, gv, gu + bw + 0.3, gv + 1.2); }
    const a0 = u0 + i1 + 0.15, a1 = u1 - i1 - 0.15, b1 = D - i1 - 0.15, lay = hashG(h + 11);
    if (wild) { rect(F, 'grow', 205, a0, iv, a1, b1); for (let i = 0; i < 4; i++) blob(F, 'grow', 255, a0 + (a1 - a0) * hashG(h + i * 5 + 40), iv + (b1 - iv) * hashG(h + i * 5 + 41), 0.8 + 0.9 * hashG(h + i * 5 + 42)); return true; }
    if (lay < 0.4) {   // beds round a lawn
      rect(F, 'grow', 115, a0, iv, a1, b1); const bd = 1.1; rect(F, 'grow', 255, a0, b1 - bd, a1, b1);
      if (gapL) rect(F, 'grow', 255, a1 - bd, iv + 0.6, a1, b1); else rect(F, 'grow', 255, a0, iv + 0.6, a0 + bd, b1);
      if (hashG(h + 13) < 0.5) rect(F, 'path', 255, a0, iv, a1, iv + 0.7);   // a gravel walk along the back wall
    } else if (lay < 0.72) {   // kitchen rows, out from the house, trodden earth between
      rect(F, 'path', 255, a0, iv, a1, iv + 0.7); const rw = 0.85, gp = 0.55;
      for (let u = a0; u + rw <= a1 + 0.01; u += rw + gp) { rect(F, 'grow', 255, u, iv + 0.9, u + rw, b1); if (u + rw + gp <= a1) rect(F, 'path', 140, u + rw, iv + 0.9, u + rw + gp, b1); }
    } else {   // a path down the middle between beds, lawn either side
      const uc = (a0 + a1) / 2; rect(F, 'grow', 115, a0, iv, a1, b1); rect(F, 'grow', 255, uc - 1.75, iv, uc + 1.75, b1); rect(F, 'grow', 255, a0, b1 - 1.0, a1, b1);
      rect(F, 'path', 255, uc - 0.5, iv, uc + 0.5, b1 - 1.0); rect(F, 'cut', 255, uc - 0.55, iv, uc + 0.55, b1 - 1.0);
    }
    return true;
  }
  for (const p of buildings) { const t = p.def.tags; if (!t.includes('house') || t.includes('poi') || t.includes('row-shop')) continue;
    const h = Math.floor(hashG(p.uid * 977 + seed * 31) * 1e9); if (hashG(h) >= 0.48) continue;
    const front = p.door ? sideOf(p, p.door) : p.w >= p.h ? 0 : 2, pick = hashG(h + 1);
    if (pick < 0.3) { strip(p, front, h, p.door); continue; }
    if (back(p, OPP[front], h)) { if (pick > 0.85) strip(p, front, h + 17, p.door); continue; }
    if (p.h < 9 && p.w < 9 && back(p, front < 2 ? 2 + (h & 1) : h & 1, h)) continue;   // a detached house: off the gable end
    strip(p, front, h, p.door); }

  // paint: clear the free channels, then each layer in its own pass (gardens never overlap, so lighten is a plain fill)
  const pass = (X, op, style, layer) => { X.save(); X.globalCompositeOperation = op; for (const S of shapes) { if (S.layer !== layer) continue; X.fillStyle = style(S.val); X.save(); X.translate(S.F.ox, S.F.oy); X.rotate(S.F.A);
    if (S.r) X.fillRect(S.r[0], S.r[1], S.r[2] - S.r[0], S.r[3] - S.r[1]); else { X.beginPath(); X.arc(S.c[0], S.c[1], S.c[2], 0, 7); X.fill(); } X.restore(); } X.restore(); };
  const wipe = (X, style) => { X.save(); X.globalCompositeOperation = 'multiply'; X.fillStyle = style; X.fillRect(O.x, O.y, SPAN, SPAN); X.restore(); };
  wipe(xX, 'rgb(255,255,0)'); wipe(hX, 'rgb(255,0,0)');   // xC.b held the old baked shadows, hC.gb a grey copy of the crowns
  pass(xX, 'lighten', v => `rgb(0,0,${v})`, 'gate');
  pass(hX, 'lighten', v => `rgb(0,${v},0)`, 'grow');
  pass(hX, 'multiply', v => `rgb(255,${255 - v},255)`, 'cut');
  pass(hX, 'lighten', v => `rgb(0,0,${v})`, 'border');
  pass(lX, 'lighten', v => `rgb(0,0,${v})`, 'path');
  return shapes.filter(S => S.layer === 'gate').length;
}
