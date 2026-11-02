// [roam] The Point: the first map (Nov 1, Gabriel). A peninsula where two rivers meet, closed on its third side by the old
// cut (a canal from one river to the other), so the machines cannot reach it and you cannot leave it. buildPeninsula(seed)
// returns one W in the same shape as world/region.js (streets, nodes, placed, water, land, sites, districts, districtAt,
// camp) plus W.decks: the bridges' decks over water that cannot be crossed ([{ a, b, half, gap? }]; a broken deck's gap
// stays water, see town.js). The plan (x east, y south, a 1800 × 1600 m world):
//   · the Wend comes down the west side, the Lume in from the east; they meet near the south-west corner (the junction J)
//     and leave the map together. Your home is the garage on the point between them.
//   · the old cut runs from the Wend (north-west) to the Lume (south-east): the peninsula is the land inside the three.
//   · Wendbridge, a small town (the engine's suburb), sits by the cut; its road runs north-east over Wend Bridge, which is
//     broken: mending it is the first thing that opens the world. Beyond the water: fields, woods, the road on.
//   · on the peninsula: the point lane from the town down to the garage, two farms, the pump works, two woods.
//   · the first boss is wedged in the gap of Wend Bridge: it cannot get out, and while it is there nobody can mend the
//     bridge. It breeds small machines that stand guard round the town. Freed (hacked), it filters the ash and the colour
//     comes back; then the bridge can be mended.
// Everything is a hash of the seed: the same seed, the same world.
import { RECIPES, recipeRegistry, buildArea } from '../../engine/recipes.js';
import { makeNet, smooth, along, len, polyDist, inPoly } from './net.js';
import { SITES } from './sites.js';
import { profileOf } from './streets.js';
import { makeClaim, CLAIM, obbPoly, fieldsAround, woodsIn, hedgesOf, blob, hash } from './country.js';
import { shift, exitsOf, nearestExit, standIn } from './region.js';

export const POINT = { w: 1800, h: 1600, J: { x: 330, y: 1330 }, village: { x: 430, y: 700 } };
const P = (x, y) => ({ x, y });
const SIZE = { gas: [44, 34], garage: [30, 26], warehouse: [64, 48], farm: [110, 90] };

// a river network that meets at one point: one polygon round all its arms (no bank drawn across a confluence). arms:
// [{ pts (from J outward, past the map's edge), half }]. Corners between neighbouring arms are where their banks meet.
function confluence(J, arms) {
  const A = arms.map(a => { const p = a.pts, k = p.findIndex(q => Math.hypot(q.x - J.x, q.y - J.y) > 40), q = p[Math.max(1, k)], th = Math.atan2(q.y - J.y, q.x - J.x); return { ...a, th }; }).sort((a, b) => a.th - b.th);
  const side = (a, s) => { const p = a.pts, out = [], r0 = 2.4 * Math.max(...A.map(q => q.half));
    for (let i = 0; i < p.length; i++) { if (Math.hypot(p[i].x - J.x, p[i].y - J.y) < r0) continue; const q0 = p[Math.max(0, i - 1)], q1 = p[Math.min(p.length - 1, i + 1)], d = Math.hypot(q1.x - q0.x, q1.y - q0.y) || 1;
      out.push(P(p[i].x - (q1.y - q0.y) / d * a.half * s, p[i].y + (q1.x - q0.x) / d * a.half * s)); }
    return out; };
  const corner = (a, b) => { const da = P(Math.cos(a.th), Math.sin(a.th)), db = P(Math.cos(b.th), Math.sin(b.th)), na = P(-da.y, da.x), nb = P(-db.y, db.x);
    const pa = P(J.x + na.x * a.half, J.y + na.y * a.half), pb = P(J.x - nb.x * b.half, J.y - nb.y * b.half), det = da.x * -db.y - da.y * -db.x;
    let gap = b.th - a.th; if (gap <= 0) gap += Math.PI * 2; const bis = a.th + gap / 2, far = P(J.x + Math.cos(bis) * Math.max(a.half, b.half) * 1.2, J.y + Math.sin(bis) * Math.max(a.half, b.half) * 1.2);
    if (Math.abs(det) < 1e-6 || gap > 2.6) return far; const t = ((pb.x - pa.x) * -db.y - (pb.y - pa.y) * -db.x) / det, c = P(pa.x + da.x * t, pa.y + da.y * t);
    return t < 0 || Math.hypot(c.x - J.x, c.y - J.y) > 4 * Math.max(a.half, b.half) ? far : c; };
  const poly = [];
  A.forEach((a, i) => { const prev = A[(i - 1 + A.length) % A.length], next = A[(i + 1) % A.length]; poly.push(corner(prev, a), ...side(a, -1), ...side(a, 1).reverse()); if (i === A.length - 1) poly.push(corner(a, next)); });
  return poly; }
// a ribbon round a line (one polygon)
const ribbon = (pts, half) => { const L = [], R = []; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
  L.push(P(pts[i].x + nx * half, pts[i].y + ny * half)); R.push(P(pts[i].x - nx * half, pts[i].y - ny * half)); } return L.concat(R.reverse()); };
// where two polylines cross (the first crossing), with the second's direction there
function crossing(A, B) { for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) { const p = A[i - 1], r = P(A[i].x - p.x, A[i].y - p.y), q = B[j - 1], s = P(B[j].x - q.x, B[j].y - q.y), d = r.x * s.y - r.y * s.x; if (Math.abs(d) < 1e-9) continue;
  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / d, u = ((q.x - p.x) * r.y - (q.y - p.y) * r.x) / d; if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { const L = Math.hypot(r.x, r.y); return { x: p.x + r.x * t, y: p.y + r.y * t, i, ux: r.x / L, uy: r.y / L }; } } return null; }

export function buildPeninsula(seed = 7) {
  const { w: WW, h: WH, J } = POINT, VX = POINT.village.x, VY = POINT.village.y, reg = recipeRegistry('hollowmere');
  // ---------- Wendbridge: the engine's suburb, moved into place; its creek left out (the cut is its water) ----------
  const W = buildArea('suburb', seed + 101, recipeRegistry('suburb'), { ...RECIPES.suburb.game, wideStreets: true }).W, VW = W.w, VH = W.h;
  W.water = []; shift(W, VX, VY); W.w = WW; W.h = WH; W.land = W.land || []; W.sites = []; W.decks = []; W.camp = null;
  W.placed = W.placed.filter(p => !p.def.tags.includes('camp'));
  for (const p of W.placed) p.district = 'village';
  for (const st of W.streets) { st.district = 'village'; if (st.kind === 'highway') st.kind = 'road'; if (st.kind === 'road' && st.w < 7) st.w = 7; }
  const vex = exitsOf(W, VX, VY, VW, VH), vE = nearestExit(vex, 0), vW = nearestExit(vex, Math.PI);

  // ---------- the water ----------
  const wend = smooth([J, P(305, 1180), P(330, 1000), P(300, 820), P(268, 640), P(300, 440), P(262, 240), P(282, 60), P(270, -40)], 2, 12);
  const lume = smooth([J, P(450, 1385), P(620, 1372), P(800, 1395), P(980, 1412), P(1180, 1382), P(1400, 1420), P(1600, 1392), P(1850, 1408)], 2, 12);
  const mouth = smooth([J, P(250, 1420), P(150, 1500), P(60, 1580), P(-40, 1660)], 2, 12);
  const cut = smooth([P(250, 428), P(420, 500), P(650, 560), P(1000, 800), P(1240, 1080), P(1350, 1250), P(1420, 1420)], 1, 14);
  const arms = [{ pts: wend, half: 17, name: 'the Wend' }, { pts: lume, half: 15, name: 'the Lume' }, { pts: mouth, half: 21, name: 'the Wend' }];
  const rivers = { kind: 'water', poly: confluence(J, arms), name: 'the Wend', lines: arms.map(a => ({ pts: a.pts, half: a.half })) };
  const canal = { kind: 'water', poly: ribbon(cut, 9), name: 'the old cut', lines: [{ pts: cut, half: 9 }] };
  W.land.push(canal, rivers);   // the cut first: the rivers' banks run across its two mouths (its weirs)

  // ---------- the roads ----------
  const roads = [], byName = {}, road = (name, kind, w, raw, o = {}) => { const pts = o.rounds === 0 ? raw.map(p => P(p.x, p.y)) : smooth(raw, o.rounds ?? 2); const r = { name, kind, w, pts, district: o.district || 'country' }; roads.push(r); byName[name] = r; return r; };
  const snap = (name, x, y) => { const pts = byName[name].pts; let best = null, bd = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)), q = P(a.x + dx * u, a.y + dy * u), d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } } return best; };
  const sOf = (name, x, y) => { const pts = byName[name].pts; let best = 0, bd = Infinity, s = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), dx = b.x - a.x, dy = b.y - a.y, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (L * L || 1))), d = Math.hypot(a.x + dx * u - x, a.y + dy * u - y); if (d < bd) { bd = d; best = s + u * L; } s += L; } return best; };
  // the bridge road: from Wendbridge's east end north-east over the cut and on to the edge; Wend Bridge is broken in the middle
  const bridgeLine = smooth([P(vE.x, vE.y), P(vE.x + 55, vE.y - 60), P(900, 790), P(918, 720), P(950, 660), P(1040, 590), P(1250, 460), P(1500, 335), P(1810, 205)], 2);
  const X = crossing(bridgeLine, cut), DECK = 13, GAP = 4.5;   // the deck: 13 m each way from the middle (over 18 m of water); the gap 9 m wide
  const END = GAP + profileOf({ kind: 'road', w: 7 }).width({ kind: 'road', w: 7 }) / 2;   // a road's end is drawn round, half its drawn width past its last point: the drawn deck stops at the gap's edge
  const alongX = q => (q.x - X.x) * X.ux + (q.y - X.y) * X.uy;   // where a point is along the road, from the gap's middle
  const before = bridgeLine.filter(q => alongX(q) < -END - 1).concat([P(X.x - X.ux * END, X.y - X.uy * END)]), after = [P(X.x + X.ux * END, X.y + X.uy * END)].concat(bridgeLine.filter(q => alongX(q) > END + 1));
  road('Wendbridge road', 'road', 7, before, { rounds: 0 }); road('the north road', 'road', 7, after, { rounds: 0 });
  W.decks.push({ name: 'Wend Bridge', a: P(X.x - X.ux * DECK, X.y - X.uy * DECK), b: P(X.x + X.ux * DECK, X.y + X.uy * DECK), half: 5.5, gap: { x: X.x, y: X.y, r: GAP }, broken: true, x: X.x, y: X.y, ux: X.ux, uy: X.uy });
  road('the point lane', 'lane', 4.5, [P(vW.x, vW.y), P(vW.x - 14, vW.y + 50), P(402, 1010), P(418, 1100), P(448, 1185), P(432, 1252), P(412, 1286)]);
  road('Lume lane', 'lane', 4.5, [snap('the point lane', 418, 1100), P(560, 1128), P(750, 1170), P(950, 1240), P(1110, 1290)]);
  road('cut lane', 'lane', 4.5, [snap('Wendbridge road', vE.x + 55, vE.y - 60), P(1000, 905), P(1120, 1010), P(1210, 1130)]);
  const fixed = [vE, vW].filter(e => e.node).map(e => ({ id: e.node.id, x: e.node.x, y: e.node.y, deg: e.node.deg }));
  const net = makeNet(roads, { fixed, prefix: 'p' });
  W.streets.push(...net.streets); W.nodes.push(...net.nodes);
  for (const n of W.nodes) if (net.fixedDeg.has(n.id)) n.deg = net.fixedDeg.get(n.id);
  const halfOf = r => profileOf(r).width(r) / 2;

  // ---------- what claims the ground (4 m) ----------
  const claim = makeClaim(WW, WH, 4);
  claim.rect(VX - 6, VY - 6, VX + VW + 6, VY + VH + 6);
  for (const st of W.streets) if (st.district !== 'village') claim.line(st.pts, halfOf(st) + 2.5);
  for (const l of [canal, rivers]) for (const ln of l.lines) claim.line(ln.pts, ln.half + 5, CLAIM.water);
  const wet = (x, y) => [canal, rivers].some(l => l.lines.some(ln => polyDist(x, y, ln.pts) < ln.half + 50));

  // ---------- sites (as world/region.js lays them: along a road, set back past its verge, clear of every claim) ----------
  const sites = W.sites, H = seed * 131;
  function siteAt(id, roadName, s0, sides, extra = {}) { const r = byName[roadName], pts = r.pts, L = len(pts), sz = (SITES[id] && SITES[id].size) || SIZE[id], hw = halfOf(r);
    for (let k = 0; k < 13; k++) for (const side of sides) { const s = s0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10; if (s < sz[0] / 2 + 4 || s > L - sz[0] / 2 - 4) continue;
      const a = along(pts, s), nx = -a.ty * side, ny = a.tx * side, d = hw + 4.5 + sz[1] / 2, o = { x: a.x + nx * d, y: a.y + ny * d, w: sz[0], h: sz[1], rot: Math.atan2(nx, -ny) };
      if (claim.taken(obbPoly(o, 1)) > 0) continue;
      const site = { id, x: o.x, y: o.y, rot: o.rot, h: hash(H, o.x, o.y, 3), size: [sz[0], sz[1]], road: roadName, ...extra }; site.box = o;
      claim.obb(o, 4); sites.push(site); return site; }
    return null; }
  const pl = byName['the point lane'];
  const home = siteAt('garage', 'the point lane', len(pl.pts) - 34, [1, -1], { name: 'the Point' });
  const farms = [siteAt('farm', 'Lume lane', sOf('Lume lane', 760, 1172), [-1, 1], { name: 'Lume Farm' }), siteAt('farm', 'cut lane', sOf('cut lane', 1080, 975), [-1, 1], { name: 'Cut Farm' })].filter(Boolean);
  const works = siteAt('warehouse', 'Lume lane', sOf('Lume lane', 1000, 1255), [1, -1], { name: 'the pump works' });
  if (works) works.nest = true;
  const reserved = new Set(['uid', 'id']);
  for (const site of sites) { const ids0 = W.placed.length, c = Math.cos(site.rot), sn = Math.sin(site.rot), at = (lx, ly) => P(site.x + lx * c - ly * sn, site.y + lx * sn + ly * c);
    const ctx = { seed, at, hash: (...a) => hash(H, site.x, site.y, ...a),
      place(b) { const def = { kind: 'building', look: 'flat', light: 0.5, height: 6, collide: 'box', ...b.def, size: (b.def && b.def.size) || [b.w, b.h] }; def.tags = [...((b.def && b.def.tags) || []), 'site', 'site.' + site.id]; def.id = def.id || 'site.' + site.id;
        const p = { ...Object.fromEntries(Object.entries(b).filter(([k]) => !reserved.has(k))), uid: ++W.uid, id: def.id, def, rot: b.rot || 0, district: 'site:' + site.id, site: site.id }; b.uid = p.uid; W.placed.push(p); return p; },
      land(poly, kind, extra = {}) { const l = { kind, poly, ...extra, site: site.id }; W.land.push(l); return l; },
      street(pts, kind = 'service', w = 5) { if (pts.length >= 2) { const ext = (a, b, d) => { const L = Math.hypot(a.x - b.x, a.y - b.y) || 1; return { x: a.x + (a.x - b.x) / L * d, y: a.y + (a.y - b.y) / L * d }; };
          const n = pts.length; pts = [ext(pts[0], pts[1], 3), ...pts.slice(1, n - 1), ext(pts[n - 1], pts[n - 2], 3)]; const dRoad = p => -((p.x - site.x) * -Math.sin(site.rot) + (p.y - site.y) * Math.cos(site.rot));
          const ri = dRoad(pts[0]) < dRoad(pts[n - 1]) ? 0 : n - 1; pts[ri] = ext(pts[ri], pts[ri === 0 ? 1 : n - 2], 7); }
        const st = { id: 'ps' + W.streets.length, kind, w, walk: 0, marks: 'none', role: kind, pts, ends: [], district: 'site:' + site.id, site: site.id }; W.streets.push(st); return st; } };
    if (SITES[site.id] && SITES[site.id].build) SITES[site.id].build(site, ctx); else standIn(site, ctx);
    site.buildings = W.placed.slice(ids0).filter(p => p.def.kind === 'building');
    if (site.nest && site.buildings.length) { const b = site.buildings.slice().sort((a, q) => q.w * q.h - a.w * a.h)[0]; b.def = { ...b.def, tags: [...b.def.tags, 'nestable'] }; } }
  // Kai's slipway: hard standing from her garage's lot down to the nearest river bank (where the water meets it, a stone quay)
  if (home) { let best = null; for (const a of arms) for (let i = 1; i < a.pts.length; i++) { const p = a.pts[i], d = Math.hypot(p.x - home.x, p.y - home.y); if (!best || d < best.d) best = { d, p, half: a.half }; }
    if (best && best.d < 110) { const ux = (best.p.x - home.x) / best.d, uy = (best.p.y - home.y) / best.d, far = best.d - best.half + 0.6, near = 6, w = 9, px = -uy, py = ux;
      const q = (s2, o) => P(home.x + ux * s2 + px * o, home.y + uy * s2 + py * o); W.land.push({ kind: 'lot', poly: [q(near, -w), q(far, -w), q(far, w), q(near, w)], name: 'the slipway', site: 'garage' }); } }
  // you start up the lane from the garage, on the road (the camp's bank stands there)
  { const s = sOf('the point lane', home ? home.x : J.x, home ? home.y : J.y), a = along(pl.pts, Math.max(10, s - 26)); W.camp = P(a.x, a.y); }

  // ---------- woods, then fields on both sides of the water ----------
  const treeDefs = ['tree.forest.a', 'tree.forest.b'].map(id => reg.get(id)), hedgeDef = reg.get('tree.yard.a'), trees = [];
  const grove = (P0, name, step) => { W.land.push({ kind: 'woods', poly: P0, name }); const t = woodsIn(P0, { step, seed, salt: trees.length, ok: (x, y) => claim.at(x, y) === CLAIM.free || claim.at(x, y) === CLAIM.woods });
    claim.poly(P0, CLAIM.woods); for (const q of t) { const def = treeDefs[q.h < 0.5 ? 0 : 1]; trees.push(W.place(reg, def.id, q.x, q.y, 0, { r: def.size[0] / 2 * (0.82 + q.h * 0.4), k: q.h, district: 'woods' })); } };
  const woods = [['the point wood', blob(640, 1288, 92, 42, seed, 1), 7.5], ['Lume end wood', blob(1255, 1262, 78, 62, seed, 2), 7.5],
    ['the far wood', blob(1560, 250, 170, 110, seed, 3), 8.5], ['the west bank wood', blob(120, 1120, 95, 150, seed, 4), 8], ['the south bank wood', blob(820, 1535, 200, 48, seed, 5), 8]];
  for (const [name, poly, step] of woods) grove(poly, name, step);
  const fields = [];
  for (const [x, y, R, a, k] of [[700, 1060, 260, 0.35, 1], [1050, 1120, 220, 0.75, 2], [1320, 640, 300, -0.4, 3], [1560, 1050, 260, 0.1, 4], [120, 760, 220, 1.5, 5], [700, 260, 260, -0.3, 6], [1250, 1540, 240, 0.05, 7]])
    fields.push(...fieldsAround({ cx: x, cy: y, R, ang: a, seed, claim, salt: k * 13, wet, home: 0 }));
  for (const f of fields) W.land.push({ kind: f.kind, poly: f.poly, dir: f.dir, field: true });
  { const TG = 6, tg = new Set(), tk = (x, y) => Math.floor(x / TG) * 65536 + Math.floor(y / TG);
    const hedge = hedgesOf(fields, { seed, ok: (x, y) => { const c = claim.at(x, y); if (c === CLAIM.hard || c === CLAIM.water) return false; const k = tk(x, y); if (tg.has(k)) return false; tg.add(k); return true; } });
    for (const q of hedge) trees.push(W.place(reg, hedgeDef.id, q.x, q.y, 0, { r: 2.4 + q.h * 1.3, k: q.h, district: 'fields' })); }

  // ---------- districts (the areas the machines hold): a 4 m map of the world ----------
  const D = [], dmap = new Uint8Array(claim.nx * claim.ny), G = 4, dput = (d, test, x0, y0, x1, y1) => { for (let j = Math.max(0, Math.floor(y0 / G)); j <= Math.min(claim.ny - 1, Math.ceil(y1 / G)); j++) for (let i = Math.max(0, Math.floor(x0 / G)); i <= Math.min(claim.nx - 1, Math.ceil(x1 / G)); i++) if (test((i + 0.5) * G, (j + 0.5) * G)) dmap[j * claim.nx + i] = d.ix; };
  const district = (id, kind, name, poly, at) => { const d = { id, kind, name, poly: poly || [P(0, 0), P(WW, 0), P(WW, WH), P(0, WH)], ix: D.length + 1, raster: !poly, ...(at ? { at } : {}) }; D.push(d); return d; };
  const bb = (pts, pad) => { const xs = pts.map(p => p.x), ys = pts.map(p => p.y); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; };
  const fillPoly = (d, poly, pad = 0) => dput(d, (x, y) => inPoly(x, y, poly) || (pad > 0 && poly.some((p, k) => { const q = poly[(k + 1) % poly.length]; return polyDist(x, y, [p, q]) < pad; })), ...bb(poly, pad));
  const country = district('country', 'country', 'the country'); dmap.fill(country.ix);
  const dF = district('fields', 'fields', 'the fields'); for (const f of fields) fillPoly(dF, f.poly, 2);
  for (const [name, poly] of woods) fillPoly(district('woods:' + name, 'woods', name, poly), poly);
  { const dR = district('river', 'lake', 'the Wend'); for (const l of [canal, rivers]) for (const ln of l.lines) for (let i = 1; i < ln.pts.length; i++) { const a = ln.pts[i - 1], b = ln.pts[i]; dput(dR, (x, y) => polyDist(x, y, [a, b]) < ln.half + 2, ...bb([a, b], ln.half + 2)); } }
  // the peninsula is one area, Wendbridge, held by one walker: the first boss, wedged in the gap of Wend Bridge (pin: it
  // never walks). Freed, the colour comes back over all of it. The Point, home, is clean from the start (home: true)
  const penin = [P(300, 440), P(430, 515), P(650, 575), P(1000, 815), P(1235, 1095), P(1345, 1262), P(1408, 1398), P(1180, 1365), P(980, 1395), P(800, 1378), P(620, 1355), P(450, 1368), P(345, 1312), P(318, 1180), P(345, 1000), P(316, 820), P(284, 640)];
  { const X0 = W.decks[0], d = district('wendbridge', 'village', 'Wendbridge', penin, P(X0.x, X0.y)); d.pin = P(X0.x, X0.y); d.level = 1; d.free = true; fillPoly(d, penin); fillPoly(d, obbPoly({ x: X0.x, y: X0.y, w: 40, h: 40, rot: 0 })); }
  for (const l of [canal, rivers]) for (const ln of l.lines) for (let i = 1; i < ln.pts.length; i++) { const a = ln.pts[i - 1], b = ln.pts[i], dR = D.find(q => q.id === 'river'); dput(dR, (x, y) => polyDist(x, y, [a, b]) < ln.half + 2 && Math.hypot(x - W.decks[0].x, y - W.decks[0].y) > 26, ...bb([a, b], ln.half + 2)); }
  // the Lume side: the peninsula's south strip (the pump works, Lume Farm, the lane's south end). No walker of its own;
  // it turns clean when the pump works' scrubber runs again (a chapter 1 mission): the colour before the boss
  { const lume = [P(338, 1070), P(560, 1060), P(760, 1100), P(1000, 1160), P(1200, 1235), P(1345, 1262), P(1408, 1398), P(1180, 1365), P(980, 1395), P(800, 1378), P(620, 1355), P(450, 1368), P(345, 1312), P(318, 1180)];
    const d = district('lumeside', 'village', 'the Lume side', lume, works ? P(works.x, works.y) : null); d.keep = true; d.level = 1; fillPoly(d, lume); }
  for (const l of [canal, rivers]) for (const ln of l.lines) for (let i = 1; i < ln.pts.length; i++) { const a = ln.pts[i - 1], b = ln.pts[i], dR = D.find(q => q.id === 'river'); dput(dR, (x, y) => polyDist(x, y, [a, b]) < ln.half + 2, ...bb([a, b], ln.half + 2)); }
  if (home) { const poly = obbPoly({ ...home.box, w: home.box.w + 70, h: home.box.h + 60 }); fillPoly(district('point', 'home', 'the Point', poly, P(home.x, home.y)), poly); D[D.length - 1].home = true; }
  W.districts = D;
  W.districtAt = (x, y) => { const i = Math.floor(x / G), j = Math.floor(y / G); if (i < 0 || j < 0 || i >= claim.nx || j >= claim.ny) return country; return D[dmap[j * claim.nx + i] - 1] || country; };
  // [missions] where chapter 1's people and things are (src/play/missions.js): Tomas the welder at the town's first door
  // off the point lane; the shield coil inside the pump works' big shed, by its door
  const doorOf = p => p.door || { x: p.x, y: p.y + p.h / 2 + 1.5 };
  const vh = W.placed.filter(p => p.district === 'village' && p.def.kind === 'building' && p.door).sort((a, b) => Math.hypot(a.door.x - vW.x, a.door.y - vW.y) - Math.hypot(b.door.x - vW.x, b.door.y - vW.y))[0];
  const wb = works && works.buildings.length ? works.buildings.slice().sort((a, q) => q.w * q.h - a.w * a.h)[0] : null;
  W.chapter = 'point';
  W.world = { ...POINT, roads: byName, claim, home, farms, works, trees: trees.length, fields: fields.length, tomas: vh ? { ...doorOf(vh), uid: vh.uid } : null, coil: wb ? doorOf(wb) : null, scrubber: works ? (() => { const ap = (works.anchors || []).filter(a => a.kind === 'apron'); const a = ap[Math.floor(ap.length / 2)]; return a ? { x: a.x, y: a.y } : { x: works.x, y: works.y }; })() : null };
  W.nav = null; W.occ = null;
  return W;
}
