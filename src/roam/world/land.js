// [roam] Land: what covers the ground outside streets and lots (fields of wheat or barley in rows, ploughed soil,
// pasture, meadow, woodland floor, gravel and hard lots…). The world gives W.land = [{ kind, poly, dir?, care? }]; this paints
// them into the 'land' map (landItems) and adds the look to the ground shader (landLook, a swap into GROUND like
// gardenLook). The kinds the world uses (fixed, so the world and the look can be built apart): wheat, barley, rape, plough,
// stubble, pasture, meadow, woods (the floor under trees), lot (asphalt: car parks), gravel, yard (concrete or packed
// earth round farm and works buildings), water. `dir` is the rows' angle (radians) where it matters (else the longest side).
// The world's autumn: wheat and barley stand ripe and uncut (nobody came for the harvest), rape is the young winter crop
// (dark leafy rosettes, a stray bolted flower where nobody tends it), stubble is last year's cut, plough is turned soil.
//
// The land map (one streamed layer, black = no land), 4 texels a metre:
//   r = kind * 16 + 4·q + 2 (care q 0..3)  read NEAREST (a code, never blended)   kinds: LAND_KINDS (hedge 13: a strip over an edge)
//   g = the grain's angle, 0..π in 64 steps (4k + 2: rows, slabs, a hedge's run)   read nearest with r
// Codes sit mid-step because the canvas's antialiased strokes nudge a texel's r and g by ±1 even inside a field.
//   b = metres in from the thing's edge × 32 (0 at the edge, 6 m = 192)     read LINEAR: smooth; its gradient points inward
// The canvas antialiases polygon edges, so an edge texel's r is a blend of two codes (a false kind). The shader never
// reads r there: within 2 m of an edge it reads r 0.45 m further in, along b's gradient (into the thing the pixel is in).
// Edges: every field keeps a grass margin (narrow and neat where tended, wide and ragged where not); the outer rows turn
// to follow the edge (the headland). Some edges carry a hedge (painted here, strands in the shader) or a wire fence
// (posts and wire: atoms/farm.js on 'edge' slots); a field meets its lane at a gate ('gate' slots), with a gap in the hedge.
// landSlots adds the slots (field, edge, gate) to dress/slots.js, and hands the care map over for the painting (care is
// made after the land's items are registered; the tiles paint later, when it exists).
import { profileOf } from './streets.js';
import { TILE } from '../tiles.js';
const CPX = TILE * 8 * 4;   // the land canvas's texels a side (tiles.js: TILE · RING · TPX; its later names do not survive the bundler)

export const LAND_KINDS = { wheat: 1, barley: 2, rape: 3, plough: 4, stubble: 5, pasture: 6, meadow: 7, woods: 8, lot: 9, gravel: 10, yard: 11, water: 12, hedge: 13 };
export const FARM_KINDS = ['wheat', 'barley', 'rape', 'plough', 'stubble', 'pasture', 'meadow'];
const CROP = new Set(['wheat', 'barley', 'rape', 'plough', 'stubble']), FARM = new Set(FARM_KINDS);
const ORDER = { woods: 110, water: 120, lot: 130, gravel: 130, yard: 130 };   // farmland 100 first; a site's ground over it
const PPM = 32;   // b: levels a metre (6 m = 192)
const HEDGE_W = 1.4;   // a hedge's half-width (m)

const hsh = (a, b = 0, c = 0) => { let n = Math.imul((a * 73856093) ^ (b * 19349663) ^ (c * 83492791), 0x85ebca6b) | 0; n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const ang = a => { a %= Math.PI; if (a < 0) a += Math.PI; return Math.min(63, Math.round(a / Math.PI * 64)) * 4 + 2; };   // 64 steps, mid-step
export function pip(p, x, y) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
const segD = (x, y, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)); return Math.hypot(x - a.x - dx * u, y - a.y - dy * u); };
export function edgeDist(p, x, y) { let d = 1e9; for (let i = 0; i < p.length; i++) d = Math.min(d, segD(x, y, p[i], p[(i + 1) % p.length])); return d; }

// the plan, once per world: the polygons, how each edge is treated, the gates; shared by the painting and the slots
export function landPlan(W) {
  if (W._landPlan) return W._landPlan;
  const seed = W.seed || 7, land = W.land || [];
  const polys = land.map((l, i) => { const p = l.poly, xs = p.map(q => q.x), ys = p.map(q => q.y);
    let A = 0, lx = 0, ld = 0; for (let k = 0; k < p.length; k++) { const a = p[k], b = p[(k + 1) % p.length]; A += a.x * b.y - b.x * a.y; const L = Math.hypot(b.x - a.x, b.y - a.y); if (L > lx) { lx = L; ld = Math.atan2(b.y - a.y, b.x - a.x); } }
    return { i, kind: l.kind, poly: p, dir: l.dir ?? ld, careIn: l.care, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], area: Math.abs(A) / 2, care: null }; });
  const inBox = (P, x, y, m = 0) => x >= P.box[0] - m && y >= P.box[1] - m && x <= P.box[2] + m && y <= P.box[3] + m;
  const polyAt = (x, y, skip) => { for (const P of polys) if (P !== skip && inBox(P, x, y) && pip(P.poly, x, y)) return P; return null; };
  // the streets: segments with their drawn half-widths, on a grid
  const SG = 32, sg = new Map(), sk = (i, j) => i * 65536 + j;
  for (const st of W.streets || []) { const hw = profileOf(st).width(st) / 2; for (let k = 0; k < st.pts.length - 1; k++) { const a = st.pts[k], b = st.pts[k + 1], g = { a, b, hw, st };
    for (let j = Math.floor((Math.min(a.y, b.y) - hw) / SG); j <= Math.floor((Math.max(a.y, b.y) + hw) / SG); j++) for (let i = Math.floor((Math.min(a.x, b.x) - hw) / SG); i <= Math.floor((Math.max(a.x, b.x) + hw) / SG); i++) { const q = sk(i, j); if (!sg.has(q)) sg.set(q, []); sg.get(q).push(g); } } }
  const roadGap = (x, y) => { let d = 1e9; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const g of sg.get(sk(Math.floor(x / SG) + i, Math.floor(y / SG) + j)) || []) d = Math.min(d, segD(x, y, g.a, g.b) - g.hw); return d; };
  // each farm field's edges: what lies beyond (road, field, wood, water, nothing) and so what bounds it
  const edges = [], gates = [];
  for (const P of polys) { if (!FARM.has(P.kind)) continue; const p = P.poly, pasture = P.kind === 'pasture' || P.kind === 'meadow';
    for (let k = 0; k < p.length; k++) { const a = p[k], b = p[(k + 1) % p.length], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1) continue;
      const dx = (b.x - a.x) / L, dy = (b.y - a.y) / L, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; let nx = -dy, ny = dx;
      if (pip(p, mx + nx * 0.8, my + ny * 0.8)) { nx = -nx; ny = -ny; }   // (nx, ny) out of the field
      const ox = mx + nx * 2.5, oy = my + ny * 2.5, road = roadGap(mx, my) < 3.5 || roadGap(ox, oy) < 0.5, nb = road ? null : polyAt(ox, oy, P);
      if (nb && FARM.has(nb.kind) && nb.i < P.i) continue;   // a shared edge: the lower field treats it
      const h = hsh(Math.round(mx / 4), Math.round(my / 4), seed + 3), nbP = nb && (nb.kind === 'pasture');
      const kind = road ? (pasture ? (h < 0.55 ? 'fence' : 'hedge') : h < 0.55 ? 'hedge' : h < 0.8 ? 'fence' : 'none')
        : nb && FARM.has(nb.kind) ? (pasture || nbP ? (h < 0.6 ? 'fence' : h < 0.9 ? 'hedge' : 'none') : h < 0.35 ? 'hedge' : h < 0.45 ? 'fence' : 'none')
        : pasture ? (h < 0.6 ? 'fence' : 'hedge') : h < 0.3 ? 'hedge' : h < 0.5 ? 'fence' : 'none';
      edges.push({ a, b, L, dx, dy, nx: -nx, ny: -ny, kind, road, P, cuts: [] }); }   // (nx, ny) on the edge: into the field
    // a gate where the field meets its lane: the road edge's best spot (one a field, two for a big one, 60 m apart)
    const cand = []; for (const e of edges) { if (e.P !== P || !e.road) continue; for (let d = 4; d < e.L - 4; d += 2) { const x = e.a.x + e.dx * d, y = e.a.y + e.dy * d; if (roadGap(x, y) < 3.5) cand.push({ e, d, x, y, s: hsh(Math.round(x), Math.round(y), seed + 9) }); } }
    cand.sort((u, v) => u.s - v.s); const want = P.area > 40000 ? 2 : 1, got = [];
    for (const c of cand) { if (got.length >= want) break; if (got.some(g => Math.hypot(g.x - c.x, g.y - c.y) < 60)) continue; got.push(c); c.e.cuts.push(c.d);
      let gx = c.x, gy = c.y; for (let k = 0; k < 16 && roadGap(gx, gy) < 0.8; k++) { gx += c.e.nx * 0.5; gy += c.e.ny * 0.5; }   // off the lane: where the field begins
      gates.push({ x: gx, y: gy, ang: Math.atan2(c.e.dy, c.e.dx), nx: c.e.nx, ny: c.e.ny, land: P.kind, P }); } }
  // the hedges: each hedge edge minus a gap at its gates
  const hedges = []; for (const e of edges) { if (e.kind !== 'hedge') continue; let s = 0; for (const d of e.cuts.slice().sort((u, v) => u - v)) { if (d - 2.8 > s + 1) hedges.push([s, d - 2.8, e]); s = d + 2.8; } if (e.L > s + 1) hedges.push([s, e.L, e]); }
  const hedgeSegs = hedges.map(([s0, s1, e]) => ({ a: { x: e.a.x + e.dx * s0, y: e.a.y + e.dy * s0 }, b: { x: e.a.x + e.dx * s1, y: e.a.y + e.dy * s1 }, e, P: e.P }));
  const plan = { polys, edges, gates, hedgeSegs, polyAt, roadGap, care: null,
    careOf(P) { if (P.care != null) return P.care; const c = plan.care; if (!c) return P.careIn ?? 0.5;   // the field's own: the mean over its ground
      let s = 0, n = 0; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const x = P.box[0] + (P.box[2] - P.box[0]) * (i + 0.5) / 5, y = P.box[1] + (P.box[3] - P.box[1]) * (j + 0.5) / 5; if (pip(P.poly, x, y)) { s += c.at(x, y); n++; } }
      P.care = P.careIn ?? (n ? s / n : 0.5); return P.care; } };
  // what lies over each polygon (a pond in a pasture, a yard on a field): its b falls to 0 at their edges too, so the
  // shader finds that edge like any other (no texel steps where a pond's blended rim meets the pasture's inside)
  const ordOf = P => ORDER[P.kind] || 100, lap = (P, Q) => P.box[0] < Q.box[2] && Q.box[0] < P.box[2] && P.box[1] < Q.box[3] && Q.box[1] < P.box[3];
  for (const P of polys) P.holes = polys.filter(Q => Q !== P && ordOf(Q) > ordOf(P) && lap(P, Q));
  W._landPlan = plan; return plan;
}

const careQ = c => 2 + 4 * Math.round(Math.max(0, Math.min(1, c)) * 3);   // 4 levels, mid-step
const code = (P, plan) => LAND_KINDS[P.kind] * 16 + careQ(plan.careOf(P));
// b's bands: fine near the edge (the shader reads its gradient there), coarser inward; stroked widest first, clipped
const BANDS = []; for (let d = 6; d > 2.01; d -= 0.5) BANDS.push([d, d - 0.25]); for (let d = 2; d > 0.01; d -= 0.25) BANDS.push([d, d - 0.125]);
const HBANDS = []; for (let d = 0; d < HEDGE_W - 0.05; d += 0.15) HBANDS.push(d);

export function landItems(W, add) {
  const plan = landPlan(W);
  const tilesOf = (x0, y0, x1, y1, keep, ord, draw) => { for (let j = Math.floor(y0 / TILE); j <= Math.floor(y1 / TILE); j++) for (let i = Math.floor(x0 / TILE); i <= Math.floor(x1 / TILE); i++) { const cx = (i + 0.5) * TILE, cy = (j + 0.5) * TILE; if (keep(cx, cy)) add('land', ord, cx, cy, TILE / 2 - 1, draw); } };
  // each polygon: one item a tile it covers (a bounding circle round a huge field would touch every tile near it)
  for (const P of plan.polys) { if (!LAND_KINDS[P.kind] || P.poly.length < 3) continue; const p = P.poly;
    tilesOf(P.box[0] - 1, P.box[1] - 1, P.box[2] + 1, P.box[3] + 1, (cx, cy) => pip(p, cx, cy) || edgeDist(p, cx, cy) < TILE * 0.72 + 1, ORDER[P.kind] || 100, X => {
      const c = code(P, plan), g = ang(P.dir); X.beginPath(); p.forEach((q, k) => k ? X.lineTo(q.x, q.y) : X.moveTo(q.x, q.y)); X.closePath(); X.clip();
      X.fillStyle = `rgb(${c},${g},${6 * PPM})`; X.fill(); X.lineJoin = 'round';
      for (const Q of P.holes) { Q.poly.forEach((q, k) => k ? X.lineTo(q.x, q.y) : X.moveTo(q.x, q.y)); X.closePath(); }   // their edges join the stroked path
      for (const [d, lv] of BANDS) { X.strokeStyle = `rgb(${c},${g},${Math.round(lv * PPM)})`; X.lineWidth = 2 * d; X.stroke(); } }); }
  // the hedges: per tile, every hedge in it band by band (rim first), so hedges that meet at a corner join as one
  const HS = plan.hedgeSegs, hg = new Map();
  for (const h of HS) { const m = HEDGE_W + 1; for (let j = Math.floor((Math.min(h.a.y, h.b.y) - m) / TILE); j <= Math.floor((Math.max(h.a.y, h.b.y) + m) / TILE); j++) for (let i = Math.floor((Math.min(h.a.x, h.b.x) - m) / TILE); i <= Math.floor((Math.max(h.a.x, h.b.x) + m) / TILE); i++) {
    const cx = (i + 0.5) * TILE, cy = (j + 0.5) * TILE; if (segD(cx, cy, h.a, h.b) > TILE * 0.72 + m) continue; const k = i * 65536 + j; if (!hg.has(k)) hg.set(k, { cx, cy, list: [] }); hg.get(k).list.push(h); } }
  for (const { cx, cy, list } of hg.values()) add('land', 200, cx, cy, TILE / 2 - 1, X => { X.lineCap = 'round';
    for (const d of HBANDS) for (const h of list) { const c = LAND_KINDS.hedge * 16 + careQ(plan.careOf(h.P));
      X.strokeStyle = `rgb(${c},${ang(Math.atan2(h.b.y - h.a.y, h.b.x - h.a.x))},${Math.round(d * PPM)})`; X.lineWidth = 2 * (HEDGE_W - d); X.beginPath(); X.moveTo(h.a.x, h.a.y); X.lineTo(h.b.x, h.b.y); X.stroke(); } });
  return plan;
}

// the land's slots (called from dress/slots.js): push(kind, x, y, ang, extra) as there.
//   field  inside a farm field or wood, every ~9 m, ≥ 2.5 m in from its edge   ang: the rows; land, inward (m), farm (m
//          to the nearest farm site), poly
//   edge   along a farm field's edge, every 3 m, on the line                    ang: along; nx,ny: into the field; edge
//          ('hedge' | 'fence' | 'none'), road (a lane beyond), land, next (the next edge slot on that line, or null)
//   gate   where a field meets its lane                                          ang: along the edge; nx,ny: into the field
export function landSlots({ W, push, blocked, care }) {
  const plan = landPlan(W); plan.care = care; for (const P of plan.polys) P.care = null;   // the painting reads care from here on; a field's slots carry the field's care (its atoms match its look)
  const seed = W.seed || 7, farms = (W.sites || []).filter(s => s.id === 'farm'), farmD = (x, y) => farms.reduce((d, f) => Math.min(d, Math.hypot(f.x - x, f.y - y)), 1e9);
  const ord = P => ORDER[P.kind] || 100, covered = (P, x, y) => plan.polys.some(Q => Q !== P && ord(Q) > ord(P) && pip(Q.poly, x, y));   // a pond or a yard over the field
  for (const P of plan.polys) { if (!FARM.has(P.kind) && P.kind !== 'woods') continue; const G = P.kind === 'woods' ? 12 : 9, [x0, y0, x1, y1] = P.box;
    for (let y = y0 + G / 2; y < y1; y += G) for (let x = x0 + G / 2; x < x1; x += G) { const jx = x + (hsh(Math.round(x), Math.round(y), seed) - 0.5) * G * 0.6, jy = y + (hsh(Math.round(y), Math.round(x), seed + 1) - 0.5) * G * 0.6;
      if (!pip(P.poly, jx, jy) || covered(P, jx, jy)) continue; const inward = edgeDist(P.poly, jx, jy); if (inward < 2.5 || blocked(jx, jy)) continue;
      push('field', jx, jy, P.dir, { land: P.kind, inward, farm: farmD(jx, jy), poly: P.i, care: plan.careOf(P) }); } }
  for (const e of plan.edges) { const pts = [];   // a post or a slot never stands on a lane, a wall or by a gate
    for (let d = 1.5; d < e.L - 0.5; d += 3) { const x = e.a.x + e.dx * d, y = e.a.y + e.dy * d; if (e.cuts.some(c => Math.abs(c - d) < 2.6) || blocked(x, y) || plan.roadGap(x, y) < 0.3) { pts.push(null); continue; } pts.push({ x, y }); }
    pts.forEach((q, k) => { if (q) push('edge', q.x, q.y, Math.atan2(e.dy, e.dx), { nx: e.nx, ny: e.ny, edge: e.kind, road: e.road, land: e.P.kind, next: pts[k + 1] || null, poly: e.P.i, care: plan.careOf(e.P) }); }); }
  for (const g of plan.gates) if (!blocked(g.x + g.nx, g.y + g.ny)) push('gate', g.x, g.y, g.ang, { nx: g.nx, ny: g.ny, land: g.land, poly: g.P.i, care: plan.careOf(g.P) });
}

// ---------- the look: swaps into the ground shader (after the gardens'; see medium.js) ----------
const MAIN = '      void main(){ vec2 w = world(), t = toTex(w); float g0 = gust(w);';
const NIGHT = '        col *= mix(vec3(1.0), vec3(0.33, 0.35, 0.40), uNight);';
const HAIRK = '        float hairK = ground + street * (1.0 - smoothstep(0.12, 0.3, inward)) * 0.8 + tree + trkM * max(smoothstep(0.86, 0.97, inward), 1.0 - smoothstep(0.15, 0.3, inward)) * 0.9;';
const HAIRL = '            float f = L == 0 ? 1.5 : L == 1 ? 4.2 : 12.0, len = (L == 0 ? 2.4 : L == 1 ? 0.85 : 0.34) * pr,';
const HAIRC = '            vec3 hc = mix(vec3(0.16, 0.2, 0.17), vec3(0.6, 0.67, 0.57), hl) * (0.75 + 0.5 * g0) * mix(1.0, 0.55, pressH) * mix(1.0, 0.6, shadow) * (L == 0 ? 0.8 : L == 1 ? 0.92 : 1.05);';
const CLUMP = '            if (h21(cid + 9.1) < 0.45) {';
const BLOOM = 'step(fl, 0.549)';
const T = CPX.toFixed(1);

export function landLook(swap, NG) {
  swap(MAIN, `      // [land] the land's helpers: the nearest texel of the land map (its codes are never blended); the woods' leaf colours
      vec4 landAt(vec2 t){ return texture2D(tLand, (floor(t * ${T}) + 0.5) / ${T}); }
      vec3 lLeaf(float x){ return x < 0.25 ? vec3(0.55, 0.4, 0.2) : x < 0.45 ? vec3(0.48, 0.25, 0.13) : x < 0.7 ? vec3(0.3, 0.21, 0.13) : x < 0.85 ? vec3(0.6, 0.53, 0.28) : vec3(0.34, 0.31, 0.25); }
      float hedgeH(vec2 p){ vec4 L = landAt(toTex(p)); return floor(L.r * 255.0 / 16.0) == 13.0 ? smoothstep(0.05, 0.9, L.b * 8.0) : 0.0; }
${MAIN}`);
  // A: what the land is here, and how the open grass grows on it (the hair below reads lGrass, lLen, lTone, lClump)
  swap(HAIRK, `        // [land] begin: the land map: kind and care (r), the grain's way (g), metres in from the edge (b)
        float lK = 0.0, lCare = 1.0, lDir = 0.0, lIn = 6.0, lGrass = 1.0, lLen = 1.0, lClump = 0.45, lBloom = 0.549, lFv = 0.0, lMw = 1.0, lWeed = 0.0, lCov = 1.0; vec3 lTone = vec3(1.0); vec2 lN = vec2(0.0);
        if (ground > 0.02 && ms.b < 0.02) { vec4 LC = landAt(t);
          if (LC.r > 0.03) { vec4 L0 = texture2D(tLand, t); lIn = L0.b * 8.0; bool bare = false;
            if (lIn < 3.6) { float e = 0.5 / uS; lN = vec2(texture2D(tLand, t + vec2(e, 0.0)).b - texture2D(tLand, t - vec2(e, 0.0)).b, texture2D(tLand, t + vec2(0.0, e)).b - texture2D(tLand, t - vec2(0.0, e)).b);
              float nl = length(lN); lN = nl > 1e-4 ? lN / nl : vec2(0.0); if (lIn < 2.0) { LC = landAt(toTex(w + lN * 0.45)); bare = landAt(toTex(w - lN * 0.45)).r < 0.03; } }   // off the edge's blended texels; bare: no land beyond
            float code = floor(LC.r * 255.0 + 0.5), gq = floor(LC.g * 255.0 / 4.0); lK = floor(code / 16.0); lCare = floor(mod(code, 16.0) / 4.0) / 3.0; lDir = (gq + 0.5) / 64.0 * 3.14159; lFv = h21(vec2(gq, lK));
            if (bare) lCov = smoothstep(0.35, 0.65, L0.r * 255.0 / max(code, 1.0));   // against bare ground: the true edge, from the blended r (no texel steps)
            // the margin: neat and narrow where tended, wide and ragged where not; weeds take patches of a neglected field
            lMw = mix(2.6, 1.0, lCare) + (vnoise(w * 0.45 + lFv * 9.0) - 0.5) * mix(0.3, 1.8, 1.0 - lCare);
            lWeed = smoothstep(0.58, 0.8, vnoise(w * 0.14 + lFv * 7.0) * 0.7 + vnoise(w * 0.55) * 0.3 + (0.45 - lCare) * 0.9);
            float inF = smoothstep(lMw, lMw + 0.35, lIn);
            if (lK < 5.5) { lGrass = max(1.0 - inF, lWeed); lLen = mix(1.15, 0.9, lWeed); lTone = mix(vec3(1.0), vec3(0.86, 0.9, 0.78), lWeed); lClump *= step(0.5, lGrass); lBloom = 0.3; }
            else if (lK < 6.5) { lLen = mix(0.5, 0.85, lWeed); lTone = vec3(0.74, 0.88, 0.74) * (0.94 + 0.12 * lFv); lClump = mix(0.16, 0.4, lWeed); lBloom = 0.12; }
            else if (lK < 7.5) { lLen = 1.45; lTone = vec3(1.08, 1.03, 0.84) * (0.94 + 0.12 * lFv); lClump = 0.85; lBloom = 0.72; }
            else if (lK < 8.5) { lGrass = 1.0 - smoothstep(0.6, 2.4, lIn + (vnoise(w * 0.6) - 0.5) * 1.2); lLen = 1.2; lClump = 0.0; }
            else if (lK < 11.5) { lGrass = smoothstep(0.62, 0.85, vnoise(w * 0.35 + 3.0) * 0.6 + vnoise(w * 1.7) * 0.4 + (0.45 - lCare) * 0.7) + (1.0 - smoothstep(0.1, 0.5, lIn)) * (1.0 - lCare) * 0.8; lLen = 0.6; lClump = 0.0; }
            else if (lK < 12.5) { lGrass = 0.0; lClump = 0.0; }
            else { lGrass = 1.0 - smoothstep(0.05, 0.35, lIn); lLen = 1.2; lClump = 0.0; } } }
        // [land] end
${HAIRK}
        lGrass = mix(1.0, lGrass, lCov); hairK -= ground * (1.0 - clamp(lGrass, 0.0, 1.0));   // [land] crops, woods floor, water and hard lots grow no lawn`);
  swap(HAIRL, HAIRL.replace('* pr,', '* pr * lLen,'));
  swap('          float grassH = 0.12;', '          float grassH = 0.12 * pow(lLen, 3.8);');   // the land's grass height for the trample rule: lawn 12 cm, pasture a few, meadow ~50 cm
  swap(HAIRC, HAIRC + '\n            hc *= lTone;');
  swap(CLUMP, '            if (h21(cid + 9.1) < lClump) {');   // [land] 0.45 on a lawn
  swap(BLOOM, 'step(fl, lBloom)');
  // B: the land's own look, painted over the grass where the map says so
  swap(NIGHT, `        // [land] begin
        if (lK > 0.5 && ground > 0.02) {
          vec3 SUN3 = normalize(vec3(SUNV, max(0.3, uSun.z))); float lsh = mix(1.0, 0.55, shadow);
          vec2 lPush = (dP.rg - 0.5) * 2.0; float lPl = length(lPush);
          vec3 lc = col; float lA = 0.0;
          if (lK < 5.5) {
            // crops: rows along the field's way (the outer rows follow the edge), tramlines, a margin of grass
            vec2 rd = vec2(cos(lDir), sin(lDir)); float head = (1.0 - smoothstep(lMw + 2.4, lMw + 2.9, lIn)) * step(0.5, dot(lN, lN)); if (head > 0.5) rd = vec2(-lN.y, lN.x);
            vec2 rp = vec2(-rd.y, rd.x); float u = dot(w, rd), v = dot(w, rp);
            float sp = lK < 2.5 ? 0.5 : lK < 3.5 ? 0.55 : lK < 4.5 ? 0.62 : 0.3, rv = v / sp, rowc = 1.0 - abs(fract(rv) - 0.5) * 2.0, rowVis = smoothstep(2.5, 6.0, sp * uPpm);
            float tv = mod(v + lFv * 24.0, 24.0), tram = max(1.0 - smoothstep(0.14, 0.32, abs(tv - 11.1)), 1.0 - smoothstep(0.14, 0.32, abs(tv - 12.9))) * (1.0 - head) * step(lK, 2.5);
            vec3 soil = vec3(0.2, 0.16, 0.12) * (0.85 + 0.3 * vnoise(w * 0.9));
            if (lK < 2.5) {   // wheat and barley: ripe, uncut; combed along the rows, swaying in the gusts that roll across the field
              bool bar = lK > 1.5; vec3 dk = bar ? vec3(0.4, 0.39, 0.27) : vec3(0.38, 0.31, 0.17), lt = bar ? vec3(0.8, 0.79, 0.6) : vec3(0.84, 0.73, 0.45);
              dk *= 0.92 + 0.16 * lFv; lt *= 0.94 + 0.12 * lFv;
              float lodge = smoothstep(0.62, 0.72, vnoise(w * 0.2 + lFv * 5.0)) * (1.0 - lCare);   // flattened by the rain where nobody came
              vec2 sd = normalize(rd + WD * (g0 - 0.25) * 1.3 + rp * (vnoise(w * 0.3) - 0.5) * 0.5); if (lodge > 0.5) sd = normalize(rp + rd * 0.3);
              if (lPl > 0.02) sd = normalize(mix(sd, lPush / lPl, clamp(lPl * 2.2, 0.0, 1.0)));   // a metre tall: it parts wide round what pushes through
              vec4 tr = trample(w, bar ? 0.85 : 1.0); if (tr.z > 0.05 && dot(tr.xy, tr.xy) > 0.1) sd = normalize(mix(sd, tr.xy * sign(dot(tr.xy, sd) + 1e-3), tr.z));   // laid: the stalks lie along the track
              vec3 cc = mix(dk * 0.7, dk, rowc) * (0.85 + 0.3 * g0);
              for (int L = 0; L < 2; L++) { float f = L == 0 ? 3.0 : 8.0, len = (L == 0 ? (bar ? 0.55 : 0.42) : 0.22) * mix(1.0, 0.6, dP.b) * (1.0 + 0.9 * tr.z), r = L == 0 ? 0.05 : 0.022, p = 0.85;   // a laid stalk shows its whole length
                float vis = smoothstep(0.35, 1.0, 2.0 * r * uPpm), mean = 1.0 - exp(-p * f * f * 1.4 * r * len);
                vec2 st = vis > 0.01 ? strands(w, sd, f, len, r, p, float(L) * 23.1 + 5.0) : vec2(0.0, 0.5);
                float cov = mix(mean, st.x, vis), hl = mix(0.55, st.y, vis);
                vec3 sc = mix(dk, lt, hl) * (0.8 + 0.4 * g0) * (L == 0 ? 0.92 : 1.05);
                cc = mix(cc, sc, cov * 0.92); }
              cc *= mix(1.0, 0.62 + 0.38 * smoothstep(0.1, 0.6, rowc), rowVis * (1.0 - lodge) * (1.0 - tr.z)); cc = mix(cc, cc * vec3(0.8, 0.8, 0.85), lodge * 0.5);
              // a laid track: the flattened straw catches the sun (a paler, glossier band), the standing wall shades its far side
              cc = mix(cc, mix(cc, lt * 1.12, 0.45), tr.z * 0.8 * (1.0 - uNight * 0.6)); cc *= 1.0 - 0.45 * tr.w;
              cc = mix(cc, mix(cc, vec3(0.34, 0.31, 0.25), 0.35), (1.0 - lCare) * 0.6);   // a neglected crop goes grey
              lc = mix(cc, soil * 0.9, tram * 0.85);
            } else if (lK < 3.5) {   // rape, the young winter crop: dark leafy rosettes in rows on bare soil
              float vis = smoothstep(2.5, 6.0, 0.3 * uPpm); vec3 rc = soil;
              if (vis > 0.01) { vec2 gb = floor(vec2(u / 0.5, v / sp) - 0.5);
                for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) { vec2 cid = gb + vec2(float(i), float(j)), rr = h22(cid + 3.1 + lFv);
                  if (h21(cid + 1.7) > mix(0.95, 0.6, 1.0 - lCare)) continue;
                  vec2 lp = vec2((cid.x + 0.5 + (rr.x - 0.5) * 0.3) * 0.5, (cid.y + 0.5) * sp); vec2 ctr = rd * lp.x + rp * lp.y + WD * (g0 - 0.35) * 0.05;
                  rc = clump(rc, w, ctr, 0.24 + 0.08 * rr.y, rr, cid, step(h21(cid + 8.8), 0.05 * (1.0 - lCare)), vec3(0.88, 0.78, 0.26), 0.55, g0, dP.b); } }
              vec3 avg = mix(soil, vec3(0.2, 0.3, 0.18), 0.62);
              lc = mix(avg, rc * vec3(0.72, 0.84, 0.76), vis);
            } else if (lK < 4.5) {   // plough: turned furrows along the rows, a pale crest and a dark trough (they read in any light), the
              // sun on their faces, clods along the ridges, damp patches, and rain standing in some troughs
              float ph = fract(rv), ridge = 1.0 - abs(ph - 0.5) * 2.0, slope = ph < 0.5 ? 1.0 : -1.0;
              vec3 n3 = normalize(vec3(rp * slope * 0.75 * rowVis, 1.0)); float li = clamp(dot(n3, SUN3), 0.0, 1.0);
              float cv = smoothstep(2.0, 5.0, 0.18 * uPpm), clod = (vnoise(vec2(u * 2.2, v * 9.0) + lFv * 3.0) - 0.5) * cv * (0.4 + 0.6 * ridge);
              float damp = smoothstep(0.45, 0.75, vnoise(w * 0.06 + lFv * 7.0) * 0.7 + vnoise(w * 0.4) * 0.3);
              vec3 dry = vec3(0.36, 0.28, 0.2), wet = vec3(0.2, 0.15, 0.11);
              lc = mix(dry, wet, damp * 0.7) * (0.55 + 0.55 * li + clod * 0.5);
              lc *= mix(1.0, 0.55 + 0.6 * smoothstep(0.08, 0.7, ridge), rowVis);   // crest light, trough dark (ambient), whatever the sun
              lc = mix(lc, lc * 1.25 + vec3(0.03, 0.025, 0.02), (1.0 - smoothstep(0.0, 0.12, abs(ph - 0.5))) * rowVis * 0.6);   // the crest's dry pale lip
              { float pool = step(0.62, vnoise(vec2(u * 0.12, floor(rv) * 0.7) + lFv * 4.0)) * damp * (1.0 - smoothstep(0.0, 0.1, ridge)) * rowVis;   // rain in a trough
                vec3 sky = mix(vec3(0.5, 0.57, 0.64) * tint(), vec3(0.05, 0.06, 0.09), uNight); lc = mix(lc, sky * 0.55, pool * 0.75); }
              { vec2 sc = floor(w / 0.9); vec2 sp2 = (sc + 0.2 + 0.6 * h22(sc + 3.3)) * 0.9; float sv = smoothstep(2.0, 4.0, 0.07 * uPpm);   // stones the plough turned up
                lc = mix(lc, vec3(0.5, 0.48, 0.44) * (0.6 + 0.6 * li), step(h21(sc + 7.7), 0.12) * (1.0 - smoothstep(0.045, 0.075, length(w - sp2))) * sv); }
            } else {   // stubble: last year's cut, pale short stalks in the combine's swaths, a windrow of loose straw
              float sw = fract(v / 6.0 + lFv), wr = 1.0 - smoothstep(0.06, 0.12, abs(sw - 0.5));
              vec3 sb = vec3(0.42, 0.38, 0.28) * (0.94 + 0.08 * step(0.5, fract(v / 12.0 + lFv))) * (0.88 + 0.24 * vnoise(w * 0.8));
              float vis = smoothstep(0.35, 1.0, 2.0 * 0.018 * uPpm); vec2 st = vis > 0.01 ? strands(w, rd, 10.0, 0.08, 0.018, 0.9, 41.0) : vec2(0.0);
              sb = mix(sb, vec3(0.74, 0.68, 0.5), mix(0.3, st.x, vis) * 0.8);
              if (wr > 0.01) { float v2 = smoothstep(0.35, 1.0, 2.0 * 0.025 * uPpm); vec2 s2 = v2 > 0.01 ? strands(w, normalize(rd + rp * 0.3 * sin(u * 0.7)), 6.0, 0.5, 0.025, 0.9, 43.0) : vec2(0.0, 0.5);
                sb = mix(sb, mix(vec3(0.55, 0.5, 0.36), vec3(0.8, 0.74, 0.55), s2.y) * (0.85 + 0.3 * g0), wr * mix(0.55, s2.x, v2)); }
              sb = mix(sb, sb * 0.8, tram);
              lc = sb;
            }
            lA = 1.0 - lGrass; lc *= lsh;
          } else if (lK < 8.5 && lK > 7.5) {
            // the woods' floor: leaf litter in autumn colours, moss, bracken gone russet; no lawn
            vec3 fl = vec3(0.12, 0.1, 0.075) * (0.8 + 0.4 * vnoise(w * 0.7));
            float lv = smoothstep(2.0, 5.0, 0.13 * uPpm);
            if (lv > 0.01) { vec2 gb = floor(w / 0.3 - 0.5);
              for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) { vec2 cid = gb + vec2(float(i), float(j)), rr = h22(cid + 6.6); vec2 ctr = (cid + 0.5 + (rr - 0.5) * 0.8) * 0.3, dv = w - ctr;
                float a = rr.x * 6.28, c = cos(a), s = sin(a); vec2 q = vec2(c * dv.x + s * dv.y, -s * dv.x + c * dv.y) / vec2(0.15, 0.075);
                float leaf = 1.0 - smoothstep(0.75, 1.0, length(q) + abs(q.x) * 0.15); if (h21(cid + 2.2) < 0.85) fl = mix(fl, lLeaf(h21(cid + 4.1)) * (0.75 + 0.35 * rr.y) * (0.85 + 0.3 * clamp(-q.y, 0.0, 1.0)), leaf * 0.9); } }
            fl = mix(vec3(0.27, 0.2, 0.13) * (0.8 + 0.4 * vnoise(w * 0.7)), fl, lv);
            fl = mix(fl, vec3(0.2, 0.26, 0.14) * (0.8 + 0.4 * vnoise(w * 2.0)), smoothstep(0.66, 0.8, vnoise(w * 0.22 + 4.0)) * 0.7);   // moss
            { vec2 cid = floor(w / 2.6), rr = h22(cid + 7.7);   // bracken in the glades and at the wood's edge
              if (h21(cid + 1.3) < mix(0.15, 0.6, smoothstep(0.45, 0.7, vnoise(w * 0.07 + 2.0)) + (1.0 - smoothstep(2.0, 8.0, lIn)) * 0.4)) { vec2 ctr = (cid + 0.25 + 0.5 * rr) * 2.6 + WD * (gust(cid * 2.6) - 0.35) * 0.2; vec3 c0 = fl;
                vec3 c1 = clump(c0, w, ctr, 0.9 + 0.5 * rr.x, rr, cid, 0.0, vec3(0.0), 1.0, g0, dP.b);
                fl = mix(c0, c1 * mix(vec3(1.22, 0.9, 0.58), vec3(0.85, 0.95, 0.75), step(0.65, rr.y)), clamp(length(c1 - c0) * 5.0, 0.0, 1.0)); } }
            lc = fl * 0.85 * lsh; lA = 1.0 - lGrass;
          } else if (lK > 8.5 && lK < 11.5) {
            // hard ground: a car park's asphalt (lighter than the roads, oil spots), gravel, a yard of slabs or packed earth
            vec3 hc;
            if (lK < 9.5) { hc = vec3(0.225, 0.228, 0.235) + (h21(floor(w * 9.0)) - 0.5) * 0.02 + mott * 0.4;
              hc = mix(hc, hc * 0.5, smoothstep(0.66, 0.8, vnoise(w * 0.8 + 9.0) * 0.6 + vnoise(w * 3.0) * 0.4) * 0.8);   // oil where cars stood
              vec2 vv = voro(w / 2.2); float ck = (1.0 - smoothstep(0.012, 0.035, vv.y - vv.x)) * smoothstep(0.5, 0.66, vnoise(w * 0.2 + 3.0) + (0.5 - lCare) * 0.5);
              hc = mix(hc, hc * 0.45, ck); hc = mix(hc, vec3(0.5, 0.49, 0.46), dust * 0.35);
              hc = mix(hc, vec3(0.5, 0.49, 0.46), (1.0 - smoothstep(0.18, 0.28, lIn)) * 0.85);   // the kerb round it
            } else if (lK < 10.5) { float gf = min(14.0, uPpm * 0.45);
              hc = mix(vec3(0.34, 0.32, 0.29), vec3(0.55, 0.53, 0.49), h21(floor(w * gf))) * (0.88 + 0.24 * vnoise(w * 1.3));
              hc = mix(hc, hc * 0.62, smoothstep(0.6, 0.78, vnoise(w * 0.4 + 5.0)) * 0.7);   // damp hollows
            } else { vec2 rd = vec2(cos(lDir), sin(lDir)), rp = vec2(-rd.y, rd.x); float lw = max(0.02, 0.6 / uPpm);
              vec2 sl = floor(vec2(dot(w, rd), dot(w, rp)) / 3.0); float jt = max(lines(dot(w, rd), 3.0, lw), lines(dot(w, rp), 3.0, lw));
              hc = vec3(0.4, 0.395, 0.375) * (0.92 + 0.12 * h21(sl)) + mott * 0.3; hc = mix(hc, hc * 0.5, jt * 0.7);
              hc = mix(hc, hc * 0.6, smoothstep(0.65, 0.8, vnoise(w * 0.5 + 1.0)) * 0.6);   // stains
              float mud = smoothstep(0.5, 0.75, vnoise(w * 0.22 + 6.0) * 0.7 + vnoise(w * 1.1) * 0.3 + (0.5 - lCare) * 0.8);
              hc = mix(hc, vec3(0.2, 0.17, 0.13) * (0.8 + 0.4 * vnoise(w * 2.2)), mud); }   // packed earth where it is let go
            lc = hc * mix(1.0, 0.6, pressHere) * lsh; lA = 1.0 - clamp(lGrass, 0.0, 1.0) * 0.85;
          } else if (lK > 11.5 && lK < 12.5) {
            // water: the sky in it, a little moving; darker with depth; wet mud at the shore, reeds round it
            float d = lIn + (vnoise(w * 0.5) - 0.5) * 0.5, sv = smoothstep(4.0, 12.0, uPpm * 0.25);
            vec3 sky = vec3(0.5, 0.57, 0.64);
            vec3 wc = mix(sky * 0.8, vec3(0.09, 0.11, 0.12), 0.3 + 0.35 * smoothstep(0.5, 5.0, d)) * (0.65 + 0.35 * vnoise(w * 0.3 + vec2(uTime * 0.05, 0.0)));
            wc *= mix(0.72, 1.0, smoothstep(0.3, 2.2, d));   // the bank's dark in it
            wc += vec3(0.12) * smoothstep(0.75, 1.0, sin(dot(w, WD) * 5.0 - uTime * 1.6 + vnoise(w * 0.7) * 6.0)) * vnoise(w * 0.25 - WD * uTime * 0.1) * sv;   // ripples down the wind
            wc += vec3(0.3, 0.28, 0.24) * smoothstep(0.6, 0.8, vnoise(mat2(0.8, 0.6, -0.6, 0.8) * w * 6.3 + uTime * 0.4) * vnoise(w * 4.1 - uTime * 0.27) * 1.5) * 0.7 * (1.0 - uNight) * sv;   // the sun's glints (two noises crossed: no lattice in them)
            wc = mix(vec3(0.12, 0.1, 0.075) * (0.8 + 0.3 * vnoise(w * 3.0)), wc, smoothstep(0.15, 0.45, d));   // wet mud
            float reedK = (1.0 - smoothstep(0.9, 1.9, d)) * smoothstep(0.1, 0.3, d) * smoothstep(0.4, 0.6, vnoise(w * 0.3 + 8.0) + (0.5 - lCare) * 0.3);
            if (reedK > 0.01) { vec2 rdir = normalize(WD * (0.6 + g0) + (vec2(vnoise(w * 0.5), vnoise(w * 0.5 + 3.0)) - 0.5) * 1.6); if (lPl > 0.02) rdir = normalize(mix(rdir, lPush / lPl, clamp(lPl * 1.6, 0.0, 1.0)));
              float vis = smoothstep(0.35, 1.0, 2.0 * 0.03 * uPpm); vec2 st = vis > 0.01 ? strands(w, rdir, 4.0, 0.6, 0.03, 0.8, 51.0) : vec2(0.0, 0.5);
              vec3 rc = mix(vec3(0.24, 0.24, 0.15), vec3(0.62, 0.56, 0.36), mix(0.5, st.y, vis)) * (0.85 + 0.3 * g0); rc = mix(rc, vec3(0.24, 0.15, 0.09), step(0.88, st.y) * vis);   // a bulrush's head
              wc = mix(wc, rc, reedK * mix(0.6, st.x, vis)); }
            lc = wc * mix(1.0, 0.75, shadow); lA = 1.0;
          } else if (lK > 12.5) {
            // a hedgerow: a row of bushes (hawthorn going russet, a few red berries), each a dome lit on its sun side and combed
            // round its middle like the town's crowns; gaps and ragged bushes where it was let go
            vec2 ha = vec2(cos(lDir), sin(lDir)); float hu = dot(w, ha), dv = max(0.0, ${HEDGE_W.toFixed(2)} - lIn), best = 0.0; vec3 bn = vec3(0.0, 0.0, 1.0);
            for (int k = -1; k <= 1; k++) { float id = floor(hu / 1.3) + float(k); vec2 r2 = h22(vec2(id, lFv * 13.0 + 1.0)); float uc = (id + 0.5 + (r2.x - 0.5) * 0.5) * 1.3;
              float R = mix(1.0, 1.5, r2.y) * mix(1.0, 0.7, (1.0 - lCare) * step(0.55, r2.x)) * (1.0 - smoothstep(0.6, 0.72, vnoise(vec2(id * 0.37, lFv * 9.0))) * (1.0 - lCare));   // let go: thin and gapped
              vec2 rel = vec2(hu - uc, dv + (r2.y - 0.5) * 0.3); float d = length(rel);
              if (d < R) { float h = sqrt(R * R - d * d); if (h > best) { best = h; bn = vec3(ha * rel.x - lN * rel.y, h); } } }
            vec4 hT = trample(w, 1.6); best *= 1.0 - 0.75 * hT.z;   // where something broke through: a ragged, flattened gap
            float hh = smoothstep(0.0, 0.3, best);
            vec3 hn = normalize(bn); float hl = clamp(dot(hn, SUN3), 0.0, 1.0);
            vec2 hd = normalize(normalize(vec2(-bn.y, bn.x) + 1e-4) + (vec2(vnoise(w * 0.9), vnoise(w * 0.9 + 7.0)) - 0.5) * 0.9 + WD * (g0 - 0.3) * 0.4);
            float fq = clamp(uGrid * 0.5, 4.0, 24.0), stp = 0.03 * (20.0 / fq), acc = 0.0, tip = 0.0;
            for (int k = -5; k <= 5; k++) { float fk = float(k); vec2 q = mat2(0.866, 0.5, -0.5, 0.866) * (w + hd * fk * stp); float s = step(0.78, h21(floor(q * fq + vec2(h21(vec2(floor(q.y * fq), 5.0)), 0.0)))); acc += s; tip += s * (fk + 5.0) / 10.0; }
            float hair = smoothstep(0.1, 0.6, clamp(acc / 3.0, 0.0, 1.0)), hlt = clamp(tip / max(acc, 1e-3), 0.0, 1.0);
            vec3 hc = mix(vec3(0.05, 0.065, 0.045), vec3(0.42, 0.48, 0.32), hl * (0.55 + 0.45 * hlt)) * (0.85 + 0.25 * g0);
            hc = mix(hc, vec3(0.5, 0.32, 0.16) * (0.4 + 0.8 * hl), smoothstep(0.55, 0.8, vnoise(w * 0.5 + 2.0)) * 0.5);   // russet
            { vec2 bc = floor(w / 0.32); vec2 bp = (bc + 0.2 + 0.6 * h22(bc + 1.9)) * 0.32; float bv = smoothstep(2.0, 4.0, 0.06 * uPpm);
              hc = mix(hc, vec3(0.55, 0.13, 0.1) * (0.6 + 0.6 * hl), step(h21(bc + 4.4), 0.12) * (1.0 - smoothstep(0.03, 0.05, length(w - bp))) * bv * smoothstep(0.3, 0.8, best)); }
            hc = mix(hc * 0.6, hc, hair) * lsh;
            lc = mix(col * 0.55, hc, hh); lc = mix(lc, vec3(0.03, 0.04, 0.03), (1.0 - smoothstep(0.0, 0.25, best)) * smoothstep(0.0, 0.05, best) * 0.6);   // a dark rim round each bush
            lc = mix(col, lc, smoothstep(0.0, 0.2, lIn));
            lA = 1.0;
          }
          col = mix(col, lc, clamp(lA, 0.0, 1.0) * ground * lCov);
          // a meadow's late flowers: small heads in the long grass (white yarrow, yellow hawkbit, a few knapweed)
          if (lK > 6.5 && lK < 7.5) { vec2 fc = floor(w / 0.55); vec2 fp = (fc + 0.2 + 0.6 * h22(fc + 1.1)) * 0.55 + WD * (g0 - 0.35) * 0.08; float fh = h21(fc + 9.3), fv = smoothstep(2.0, 4.0, 0.08 * uPpm);
            vec3 fcl = fh < 0.45 ? vec3(0.9, 0.88, 0.8) : fh < 0.8 ? vec3(0.9, 0.76, 0.26) : vec3(0.62, 0.42, 0.66);
            col = mix(col, fcl * mix(1.0, 0.45, uNight) * lsh, step(h21(fc + 4.6), 0.3) * (1.0 - smoothstep(0.04, 0.07, length(w - fp))) * fv * (1.0 - dP.b) * ground); }
          // thistles: where a field, pasture or meadow is let go
          if (lK < 7.5 && lWeed > 0.2) { vec2 cid = floor(w / 2.3), rr = h22(cid + 3.9);
            if (h21(cid + 5.5) < 0.45 * lWeed) { vec2 ctr = (cid + 0.3 + 0.4 * rr) * 2.3 + WD * (gust(cid * 2.3) - 0.35) * 0.2; vec3 c0 = col, c1 = clump(c0, w, ctr, 0.45 + 0.2 * rr.x, rr, cid, step(rr.y, 0.7), vec3(0.62, 0.42, 0.66), 0.7, g0, dP.b);
              col = mix(c0, c1 * vec3(0.85, 0.92, 0.88), ground); } }
          // a hedge's shadow, away from the sun
          if (lK < 12.5 && lIn < 3.6) { float sl = min(2.8, 1.5 / max(0.3, uSun.z)); float hs = max(hedgeH(w + SUNV * sl * 0.5), hedgeH(w + SUNV * sl));
            col *= 1.0 - 0.45 * hs * mix(1.0, 0.5, uNight); }
        }
        // [land] end
${NIGHT}`);
}
