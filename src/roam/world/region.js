// [roam] The world: Hollowmere and the land round it. buildRegion(seed) returns one W in the engine's shape (streets,
// nodes, placed, plaza, water, districts, districtAt, camp) for the whole world, in world metres from (0, 0), plus:
//   land:  [{ kind, poly: [{ x, y }…], dir?, … }]   what covers the ground outside lots and streets (see world/land.js)
//   sites: [{ id, x, y, rot, … }]                   the special places laid out by world/sites.js (gas station, farm…)
// Street kinds: 'local' (a town street with pavements), 'path', and any kind in world/streets.js (country lanes, the
// bypass): the painting and the slots read the kind's profile there.
// The plan (WORLD below; x east, y south): the engine's town (600 × 500) sits north-west of the middle; a dual-carriageway
// bypass arcs round its east and south ~220 m out, from the north edge to the west road; its five exits run on as
// country roads and lanes. The main road south carries the edge-of-town strip (garage, gas, supermarket, DIY) between the
// town and the bypass, then runs on 1.5 km to the village (the engine's suburb recipe, moved into place). The industrial
// estate hangs off the north-east road past the bypass, by the railway. Six farms sit on lanes 0.5–1.5 km out, each in
// its fields; woods north-west (round the lake) and north-east, copses between; a brook runs from the lake south.
// Everything is a hash of the seed: the same seed, the same world.
import { RECIPES, recipeRegistry, buildArea } from '../../engine/recipes.js';
import { makeNet, smooth, offset, along, len, polyDist, inPoly } from './net.js';
import { SITES } from './sites.js';
import { profileOf } from './streets.js';
import { makeClaim, CLAIM, obbPoly, fieldsAround, woodsIn, hedgesOf, blob, hash } from './country.js';

export const WORLD = { w: 2600, h: 2200, town: { x: 500, y: 420 }, village: { x: 1400, y: 1850 } };
// a site's footprint (m, along its road × deep) when world/sites.js gives none
const SIZE = { gas: [44, 34], garage: [30, 26], supermarket: [96, 110], diy: [72, 84], warehouse: [64, 48], farm: [110, 90], school: [76, 60] };

// move every position in an engine W by (dx, dy): anything with numeric x and y, once, through arrays and objects
function shift(W, dx, dy) { const seen = new WeakSet(), skip = new Set(['def', 'nav', 'occ', 'terrain', 'params', 'log', 'grid', 'A', 'P', 'Z']);
  const walk = o => { if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o);
    if (Array.isArray(o)) { for (const v of o) walk(v); return; }
    if (typeof o.x === 'number' && typeof o.y === 'number') { o.x += dx; o.y += dy; }
    for (const [k, v] of Object.entries(o)) if (!skip.has(k) && v && typeof v === 'object') walk(v); };
  for (const k of ['streets', 'nodes', 'water', 'bridges', 'lots', 'placed', 'fences', 'areas', 'rails', 'crossings', 'runs', 'camp', 'plaza', 'districts', 'finale', 'town', 'sites', 'land']) walk(W[k]); }
// an area's road exits: the streets with an end on or past its edge → { dir (radians from the area's middle), x, y, node }
function exitsOf(W, x0, y0, w, h) { const out = [], ids = new Map(W.nodes.map(n => [n.id, n]));
  for (const st of W.streets) for (const [k, p] of [[0, st.pts[0]], [1, st.pts[st.pts.length - 1]]]) {
    const lx = p.x - x0, ly = p.y - y0; if (lx > 4 && ly > 4 && lx < w - 4 && ly < h - 4) continue;
    const n = ids.get(st.ends && st.ends[k]); out.push({ st, x: p.x, y: p.y, node: n && Math.hypot(n.x - p.x, n.y - p.y) < 1.5 ? n : null, dir: Math.atan2(ly - h / 2, lx - w / 2) }); }
  return out; }
const nearestExit = (ex, a) => ex.reduce((b, e) => { const d = Math.abs(Math.atan2(Math.sin(e.dir - a), Math.cos(e.dir - a))); return !b || d < b.d ? { e, d } : b; }, null).e;
const P = (x, y) => ({ x, y });

export function buildRegion(seed = 7) {
  const reg = recipeRegistry('hollowmere');
  const W = buildArea('hollowmere', seed, reg, RECIPES.hollowmere.game).W, TW = W.w, TH = W.h, OX = WORLD.town.x, OY = WORLD.town.y;
  shift(W, OX, OY); W.w = WORLD.w; W.h = WORLD.h; W.land = W.land || []; W.sites = [];
  const townD = W.districts.slice(), townBox = { x0: OX, y0: OY, x1: OX + TW, y1: OY + TH };
  for (const d of townD) d.area = 'hollowmere';
  const exits = exitsOf(W, OX, OY, TW, TH);
  // ---------- the village: the engine's suburb, moved into place, its camp left out (the green stays open) ----------
  const VR = RECIPES.suburb, V = buildArea('suburb', seed + 101, recipeRegistry('suburb'), VR.game).W, VX = WORLD.village.x, VY = WORLD.village.y;
  shift(V, VX, VY);
  const vex = exitsOf(V, VX, VY, V.w, V.h);
  { const base = W.uid; for (const p of V.placed) { p.uid += base; p.district = 'village'; } W.uid = base + V.uid;
    W.placed.push(...V.placed.filter(p => !p.def.tags.includes('camp')));
    const vid = id => 'v' + id; for (const n of V.nodes) n.id = vid(n.id);
    for (const st of V.streets) { st.id = vid(st.id); st.ends = (st.ends || []).map(vid); st.district = 'village'; if (st.kind === 'highway') st.kind = 'road'; if (st.kind === 'road' && st.w < 7) st.w = 7; }
    W.streets.push(...V.streets); W.nodes.push(...V.nodes); W.lots.push(...V.lots); W.fences.push(...V.fences); W.bridges.push(...(V.bridges || []));
    for (const wt of V.water || []) { const top = wt.pts[0]; wt.pts.unshift(P(top.x - 22, top.y - 300), P(top.x - 8, top.y - 150)); const end = wt.pts[wt.pts.length - 1]; wt.pts.push(P(end.x + 10, WORLD.h + 6)); wt.id = 'v' + wt.id; W.water.push(wt); } }
  const vW = nearestExit(vex, Math.PI), vE = nearestExit(vex, 0);

  // ---------- the roads ----------
  const ex = { S: nearestExit(exits, Math.PI / 2), W: nearestExit(exits, Math.PI), SE: nearestExit(exits, 0.7), NW: nearestExit(exits, -2.5), NE: nearestExit(exits, -0.5) };
  const E = k => P(ex[k].x, ex[k].y);
  const roads = [], byName = {}, road = (name, kind, w, raw, o = {}) => { const pts = o.rounds === 0 ? raw.map(p => P(p.x, p.y)) : smooth(raw, o.rounds ?? 2); const r = { name, kind, w, pts, district: o.district || (kind === 'highway' ? 'bypass' : 'country') }; roads.push(r); byName[name] = r; return r; };
  const snap = (name, x, y) => { const pts = byName[name].pts; let best = null, bd = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)), q = P(a.x + dx * u, a.y + dy * u), d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } } return best; };
  const sOf = (name, x, y) => { const pts = byName[name].pts; let best = 0, bd = Infinity, s = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), dx = b.x - a.x, dy = b.y - a.y, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (L * L || 1))), d = Math.hypot(a.x + dx * u - x, a.y + dy * u - y); if (d < bd) { bd = d; best = s + u * L; } s += L; } return best; };
  const CX = OX + TW / 2, CY = OY + TH / 2, RX = 540, RY = 470;
  road('west road', 'road', 7, [E('W'), P(380, 672), P(260, 670), P(120, 680), P(-6, 690)]);
  road('main road', 'road', 7, [E('S'), P(ex.S.x - 3, 1050), P(ex.S.x - 4, 1150), P(830, 1300), P(900, 1450), P(1000, 1600), P(1120, 1760), P(1250, 1950), P(vW.x, vW.y)]);
  road('north-east road', 'road', 7, [E('NE'), P(1300, ex.NE.y + 2), P(1420, 478), P(1640, 478), P(2000, 468), P(WORLD.w + 6, 452)]);
  road('south-east road', 'road', 7, [E('SE'), P(1180, 930), P(1300, 965), P(1500, 1000), P(1800, 1020), P(2100, 1000), P(WORLD.w + 6, 985)]);
  road('north-west lane', 'lane', 4.5, [E('NW'), P(330, 478), P(150, 470), P(-6, 466)]);
  road('village road', 'road', 7, [P(vE.x, vE.y), P(1950, 2040), P(2200, 2020), P(WORLD.w + 6, 2000)]);
  // the bypass: from the north edge down to the ellipse round the town, clockwise round the east and south to the west road
  { const c = [P(1240, -6), P(1232, 170)]; for (let a = -40; a <= 180; a += 5) { const t = a * Math.PI / 180; c.push(P(CX + RX * Math.cos(t), CY + RY * Math.sin(t))); }
    c[c.length - 1] = snap('west road', c[c.length - 1].x, c[c.length - 1].y);
    const mid = smooth(c, 1, 12), L = len(mid), half = 7.2, taper = s => half * Math.min(1, (L - s) / 110) ** 0.7;   // the two carriageways close up into the junction with the west road
    const cw = (name, sg) => { const r = { name, kind: 'highway', w: 7, pts: offset(mid, s => sg * taper(s)), district: 'bypass' }; r.pts[r.pts.length - 1] = P(mid[mid.length - 1].x, mid[mid.length - 1].y); roads.push(r); byName[name] = r; };
    cw('bypass in', 1); cw('bypass out', -1); byName.bypass = { pts: mid }; }
  road('north lane', 'lane', 4.5, [snap('north-east road', 1200, 475), P(1185, 390), P(1080, 270), P(880, 195), P(700, 185), P(500, 160), P(300, 110), P(120, 95), P(-6, 100)]);
  road('mill lane', 'lane', 4.5, [snap('main road', 830, 1300), P(700, 1330), P(560, 1340), P(430, 1420), P(380, 1600), P(330, 1800), P(290, 2000), P(270, WORLD.h + 6)]);
  road('marsh lane', 'lane', 4.5, [snap('main road', 1000, 1600), P(900, 1660), P(790, 1715)]);
  road('east lane', 'lane', 4.5, [snap('south-east road', 1800, 1020), P(1840, 1200), P(1960, 1360), P(2080, 1480), P(2140, 1700), P(2180, 1900), snap('village road', 2200, 2020)]);
  { const a = snap('north-east road', 1420, 478), b = snap('north-east road', 1640, 478); road('estate loop', 'service', 6.5, [a, P(1420, 600), P(1420, 690), P(1530, 690), P(1640, 690), P(1640, 600), b], { rounds: 1, district: 'estate' }); }
  const fixed = [...exits, vW, vE].filter(e => e.node).map(e => ({ id: e.node.id, x: e.node.x, y: e.node.y, deg: e.node.deg }));
  const net = makeNet(roads.filter(r => r.kind), { fixed, prefix: 'w' });
  W.streets.push(...net.streets); W.nodes.push(...net.nodes);
  for (const n of W.nodes) if (net.fixedDeg.has(n.id)) n.deg = net.fixedDeg.get(n.id);
  const halfOf = r => profileOf(r).width(r) / 2;

  // ---------- the railway runs on to the edges (it is a line in the charmap; roam draws no rails) ----------
  for (const r of W.rails) if (r.id === 'main') { const a = r.pts[0], b = r.pts[r.pts.length - 1], m = (b.y - a.y) / (b.x - a.x); r.pts.unshift(P(-6, a.y + (-6 - a.x) * m)); r.pts.push(P(WORLD.w + 6, b.y + (WORLD.w + 6 - b.x) * m)); }
  // ---------- what claims the ground (4 m): roads, the town, the village; then sites, water, woods, fields ----------
  const claim = makeClaim(WORLD.w, WORLD.h, 4);
  claim.rect(townBox.x0 - 6, townBox.y0 - 6, townBox.x1 + 6, townBox.y1 + 6); claim.rect(VX - 6, VY - 6, VX + V.w + 6, VY + V.h + 6);
  for (const st of W.streets) if (st.pts.some(p => p.x < townBox.x0 || p.y < townBox.y0 || p.x > townBox.x1 || p.y > townBox.y1)) claim.line(st.pts, halfOf(st) + 2.5);
  for (const wt of W.water) claim.line(wt.pts, (wt.w || 6) / 2 + 4, CLAIM.water);
  for (const r of W.rails) claim.line(r.pts, 6);

  // ---------- water: the lake in the north-west woods, the brook from it south through the farms ----------
  const lake = blob(232, 268, 125, 76, seed, 7, 22, 0.12);
  claim.poly(lake, CLAIM.water, 6);   // its water is laid over the woods' floor below
  const brook = { id: 'brook', name: 'the mere brook', w: 4.5, pts: smooth([P(300, 335), P(318, 420), P(362, 560), P(332, 700), P(384, 850), P(470, 1000), P(556, 1150), P(512, 1330), P(468, 1500), P(560, 1700), P(650, 1900), P(700, WORLD.h + 6)], 2, 10) };
  W.water.push(brook); claim.line(brook.pts, 7, CLAIM.water);
  const wet = (x, y) => polyDist(x, y, brook.pts) < 60;

  // ---------- sites: along a road, set back past its verge, the footprint clear of every claim ----------
  const sites = W.sites, H = seed * 131;
  function siteAt(id, roadName, s0, sides, extra = {}) { const r = byName[roadName], pts = r.pts, L = len(pts), sz = (SITES[id] && SITES[id].size) || SIZE[id], hw = halfOf(r);
    for (let k = 0; k < 9; k++) for (const side of sides) { const s = s0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 12; if (s < sz[0] / 2 + 4 || s > L - sz[0] / 2 - 4) continue;
      const a = along(pts, s), nx = -a.ty * side, ny = a.tx * side, d = hw + 4.5 + sz[1] / 2, o = { x: a.x + nx * d, y: a.y + ny * d, w: sz[0], h: sz[1], rot: Math.atan2(nx, -ny) };
      if (claim.taken(obbPoly(o, 1)) > 0) continue;
      const site = { id, x: o.x, y: o.y, rot: o.rot, h: hash(H, o.x, o.y, 3), size: [sz[0], sz[1]], road: roadName, ...extra }; site.box = o;
      claim.obb(o, 4); sites.push(site); return site; }
    return null; }
  const near = (roadName, x, y) => sOf(roadName, x, y);
  // the strip: the garage and the gas station first off the town, then the supermarket and the DIY shed (heading south, +1 is west)
  siteAt('garage', 'main road', 26, [1]); siteAt('gas', 'main road', 30, [-1]); siteAt('supermarket', 'main road', 112, [1]); siteAt('diy', 'main road', 108, [-1]);
  // the estate: warehouses round the loop, inside and out; the farthest one is where the blight took hold
  for (const [s, side] of [[62, 1], [150, 1], [104, -1], [272, 1], [362, 1], [322, -1], [532, 1], [470, -1]]) siteAt('warehouse', 'estate loop', s, [side]);
  // farms on their lanes, the school by the village
  const farmAt = (name, roadName, x, y, sides) => siteAt('farm', roadName, near(roadName, x, y), sides, { name });
  const farms = [farmAt('Hollow Farm', 'north lane', 700, 185, [1, -1]), farmAt('Mill Farm', 'mill lane', 560, 1340, [1, -1]), farmAt('Brook Farm', 'mill lane', 330, 1800, [-1, 1]),
    farmAt('Marsh Farm', 'marsh lane', 820, 1700, [1, -1]), farmAt('Ridge Farm', 'south-east road', 1950, 1010, [1, -1]), farmAt('East Farm', 'east lane', 2080, 1480, [-1, 1])].filter(Boolean);
  siteAt('school', 'main road', near('main road', 1290, 1990), [1, -1]);
  const nestSites = new Set([farms.find(f => f.name === 'Ridge Farm'), sites.filter(s => s.id === 'warehouse').pop()].filter(Boolean));

  // ---------- build the sites (world/sites.js), or a plain stand-in while a template is missing ----------
  const reserved = new Set(['uid', 'id']);
  for (const site of sites) { const ids0 = W.placed.length, c = Math.cos(site.rot), sn = Math.sin(site.rot), at = (lx, ly) => P(site.x + lx * c - ly * sn, site.y + lx * sn + ly * c);
    const ctx = { seed, at, hash: (...a) => hash(H, site.x, site.y, ...a),
      place(b) { const def = { kind: 'building', look: 'flat', light: 0.5, height: 6, collide: 'box', ...b.def, size: (b.def && b.def.size) || [b.w, b.h] }; def.tags = [...((b.def && b.def.tags) || []), 'site', 'site.' + site.id]; def.id = def.id || 'site.' + site.id;
        const p = { ...Object.fromEntries(Object.entries(b).filter(([k]) => !reserved.has(k))), uid: ++W.uid, id: def.id, def, rot: b.rot || 0, district: 'site:' + site.id, site: site.id }; W.placed.push(p); return p; },
      land(poly, kind, extra = {}) { const l = { kind, poly, ...extra, site: site.id }; W.land.push(l); return l; },
      street(pts, kind = 'service', w = 5) { const st = { id: 'ws' + W.streets.length, kind, w, walk: 0, marks: 'none', role: kind, pts, ends: [], district: 'site:' + site.id, site: site.id }; W.streets.push(st); return st; } };
    if (SITES[site.id] && SITES[site.id].build) SITES[site.id].build(site, ctx);
    else standIn(site, ctx);
    site.buildings = W.placed.slice(ids0).filter(p => p.def.kind === 'building');
    if (nestSites.has(site) && site.buildings.length) { const b = site.buildings.slice().sort((a, q) => q.w * q.h - a.w * a.h)[0]; b.def = { ...b.def, tags: [...b.def.tags, 'nestable'] }; site.nest = true; } }

  // ---------- woods: polygons of trees with the woods floor under them ----------
  const treeDefs = ['tree.forest.a', 'tree.forest.b'].map(id => reg.get(id)), hedgeDef = reg.get('tree.yard.a'), trees = [];
  const grove = (P0, name, step) => { W.land.push({ kind: 'woods', poly: P0, name }); const t = woodsIn(P0, { step, seed, salt: trees.length, ok: (x, y) => claim.at(x, y) === CLAIM.free || claim.at(x, y) === CLAIM.woods });
    claim.poly(P0, CLAIM.woods); for (const q of t) { const def = treeDefs[q.h < 0.5 ? 0 : 1]; trees.push(W.place(reg, def.id, q.x, q.y, 0, { r: def.size[0] / 2 * (0.82 + q.h * 0.4), k: q.h, district: 'woods' })); } };
  const woods = [
    ['the mere woods', [P(-4, -4), P(480, -4), P(500, 140), P(440, 300), P(470, 410), P(300, 436), P(-4, 440)], 8.5],
    ['the north wood', [P(1800, -4), P(2350, -4), P(2420, 240), P(2220, 380), P(1900, 370), P(1770, 200)], 8.5],
    ['the copse', blob(1235, 1330, 88, 62, seed, 1), 7.5], ['the long wood', blob(2380, 1530, 115, 82, seed, 2), 7.5],
    ['the hanger', blob(1110, 2120, 82, 56, seed, 3), 7.5], ['the west wood', blob(140, 1260, 96, 128, seed, 4), 8], ['the spinney', blob(960, 1890, 64, 48, seed, 5), 7] ];
  for (const [name, poly, step] of woods) grove(poly, name, step);
  W.land.push({ kind: 'water', poly: lake, name: 'the mere' });

  // ---------- fields: round each farm (the grid turned to its lane) and round the village ----------
  const fields = [];
  farms.forEach((f, i) => fields.push(...fieldsAround({ cx: f.x, cy: f.y, R: 400, ang: f.rot, seed, claim, salt: i * 7, wet })));
  fields.push(...fieldsAround({ cx: VX + V.w / 2, cy: VY + V.h / 2, R: 430, ang: 0.04, seed, claim, salt: 91, wet, home: 0 }));
  // and the land between farms, farmed from somewhere (smaller grids, their own turn)
  for (const [x, y, R, a, k] of [[1250, 1160, 300, 0.3, 1], [2050, 700, 320, -0.05, 2], [2380, 1180, 300, 0.5, 3], [2330, 1820, 300, -0.2, 4], [180, 700, 230, 1.5, 5], [1520, 260, 250, 0.1, 6], [1030, 1420, 220, -0.6, 7]])
    fields.push(...fieldsAround({ cx: x, cy: y, R, ang: a, seed, claim, salt: 100 + k * 13, wet, home: 0 }));
  for (const f of fields) W.land.push({ kind: f.kind, poly: f.poly, dir: f.dir, field: true });
  // hedgerows between some fields (trees in lines), clear of roads and other trees
  { const TG = 6, tg = new Set(), tk = (x, y) => Math.floor(x / TG) * 65536 + Math.floor(y / TG);
    const hedge = hedgesOf(fields, { seed, ok: (x, y) => { const c = claim.at(x, y); if (c === CLAIM.hard || c === CLAIM.water) return false; const k = tk(x, y); if (tg.has(k)) return false; tg.add(k); return true; } });
    for (const q of hedge) trees.push(W.place(reg, hedgeDef.id, q.x, q.y, 0, { r: 2.4 + q.h * 1.3, k: q.h, district: 'fields' })); }


  // ---------- districts: the town's own inside the town, a 4 m map of the world's outside ----------
  const D = [], dmap = new Uint8Array(claim.nx * claim.ny), G = 4, dput = (d, test, x0, y0, x1, y1) => { for (let j = Math.max(0, Math.floor(y0 / G)); j <= Math.min(claim.ny - 1, Math.ceil(y1 / G)); j++) for (let i = Math.max(0, Math.floor(x0 / G)); i <= Math.min(claim.nx - 1, Math.ceil(x1 / G)); i++) if (test(i * G, j * G)) dmap[j * claim.nx + i] = d.ix; };
  const district = (id, kind, name, poly) => { const d = { id, kind, name, poly: poly || [P(0, 0), P(WORLD.w, 0), P(WORLD.w, WORLD.h), P(0, WORLD.h)], ix: D.length + 1, raster: !poly }; D.push(d); return d; };
  const bb = (pts, pad) => { const xs = pts.map(p => p.x), ys = pts.map(p => p.y); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; };
  const fillPoly = (d, poly, pad = 0) => dput(d, (x, y) => inPoly(x, y, poly) || (pad > 0 && poly.some((p, k) => { const q = poly[(k + 1) % poly.length]; return polyDist(x, y, [p, q]) < pad; })), ...bb(poly, pad));
  const country = district('country', 'country', 'the country');
  dmap.fill(country.ix);
  const dF = district('fields', 'fields', 'the fields'); for (const f of fields) fillPoly(dF, f.poly, 2);
  for (const [name, poly] of woods) fillPoly(district('woods:' + name, 'woods', name, poly), poly);
  fillPoly(district('lake', 'lake', 'the mere', lake), lake, 4);
  { const dB = district('bypass', 'bypass', 'the bypass'), mid = byName.bypass.pts; for (let i = 1; i < mid.length; i++) { const a = mid[i - 1], b = mid[i]; dput(dB, (x, y) => polyDist(x, y, [a, b]) < 18, ...bb([a, b], 18)); } }
  for (const f of farms) { const poly = obbPoly(f.box, 30); fillPoly(district('farm:' + f.name, 'farm', f.name, poly), poly); }
  { const strip = sites.filter(s => ['gas', 'garage', 'supermarket', 'diy'].includes(s.id)); if (strip.length) { const [x0, y0, x1, y1] = bb(strip.flatMap(s => obbPoly(s.box, 10)), 0), poly = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]; fillPoly(district('strip', 'commercial', 'the strip', poly), poly); } }
  { const wh = sites.filter(s => s.id === 'warehouse'); if (wh.length) { const [x0, y0, x1, y1] = bb([...wh.flatMap(s => obbPoly(s.box, 12)), ...byName['estate loop'].pts], 10), poly = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]; fillPoly(district('estate', 'industrial', 'the estate', poly), poly); } }
  { const s = sites.find(q => q.id === 'school'); if (s) { const poly = obbPoly(s.box, 8); fillPoly(district('school', 'village', 'the school', poly), poly); } }
  { const poly = [P(VX, VY), P(VX + V.w, VY), P(VX + V.w, VY + V.h), P(VX, VY + V.h)]; fillPoly(district('village', 'village', 'Ashford Hollow', poly), poly); }
  W.districts = [...townD, ...D];
  const inTown = (x, y) => x >= townBox.x0 && y >= townBox.y0 && x <= townBox.x1 && y <= townBox.y1;
  W.districtAt = (x, y) => { if (inTown(x, y)) return townD.find(d => inPoly(x, y, d.poly)) || null;
    const i = Math.floor(x / G), j = Math.floor(y / G); if (i < 0 || j < 0 || i >= claim.nx || j >= claim.ny) return country; return D[dmap[j * claim.nx + i] - 1] || country; };
  W.world = { ...WORLD, townBox, villageBox: { x0: VX, y0: VY, x1: VX + V.w, y1: VY + V.h }, farms, roads: byName, claim, trees: trees.length, fields: fields.length };
  W.nav = null; W.occ = null;   // the town's own nav grids are in its old frame and roam never reads them
  return W;
}

// a site with no template yet: its ground (hard standing, or a yard) and one plain building at the back, door to the road
function standIn(site, ctx) { const [w, h] = site.size, hard = ['gas', 'supermarket', 'diy'].includes(site.id), bw = Math.min(w * 0.62, site.id === 'gas' ? 14 : 60), bh = Math.min(h * 0.42, site.id === 'gas' ? 9 : 40);
  ctx.land([ctx.at(-w / 2, -h / 2), ctx.at(w / 2, -h / 2), ctx.at(w / 2, h / 2), ctx.at(-w / 2, h / 2)], hard ? 'lot' : site.id === 'farm' ? 'yard' : 'gravel');
  const c = ctx.at(0, -h / 2 + bh / 2 + 3), door = ctx.at(0, -h / 2 + bh + 3.3);
  ctx.place({ x: c.x, y: c.y, w: bw, h: bh, rot: site.rot, door, def: { look: site.id === 'farm' ? 'gable' : 'flat', tags: ['placeholder'], light: 0.6, height: 7, size: [bw, bh] } }); }
