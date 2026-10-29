// [roam] The town, once: the engine builds Hollowmere (recipe hollowmere), and this lays out what the ground shader reads
// as paint items for the streamed tiles (src/roam/tiles.js: roofs as slopes, streets with their direction, trees, water,
// the lit houses at night, gardens, the atoms' marks), the walls feet cannot cross (2 cells a metre), and where the nests
// are. Everything is in world metres: x east, y south, from (0, 0).
/* global THREE */
import { buildRegion } from './world/region.js';
import { profileOf } from './world/streets.js';
import { roofLook } from './world/sites.js';
import { landItems } from './world/land.js';
import { pointInObb } from '../engine/geom.js';
import { layoutGardens } from './gardens.js';
import { createTiles } from './tiles.js';
import { makeCare } from './dress/care.js';
import { makeSlots } from './dress/slots.js';
import { makePlacer } from './dress/place.js';
import { STORIES } from './dress/stories.js';
import { ATOMS } from './atoms/index.js';

export function buildTown(seed = 7) {
  const W = buildRegion(seed);
  const rigAtom = W.placed.find(p => p.def.tags.includes('camp.rig'));
  const start = { x: W.camp.x, y: W.camp.y };
  const size = { w: W.w, h: W.h };
  const placed = W.placed.filter(p => p !== rigAtom && !p.def.tags.includes('camp'));   // no base in roam: the square is open
  const buildings = placed.filter(p => p.def.kind === 'building');
  const trees = placed.filter(p => p.def.look === 'tree');
  const cars = placed.filter(p => p.def.tags.includes('car') || p.def.tags.includes('railcar'));
  const obb = (x, p, pad) => { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillRect(-p.w / 2 - pad, -p.h / 2 - pad, p.w + 2 * pad, p.h + 2 * pad); x.restore(); };
  const ang = a => { a %= Math.PI; if (a < 0) a += Math.PI; return Math.round(a / Math.PI * 255); };
  // the data maps, streamed round the camera (each layer one canvas): roof (rgb downslope axis, which side, gable; a roof),
  // street (r angle, g kind, b inward; a street), misc (r crown, g lane marks and water, b garden plot), trees (r crown
  // height, g garden growth, b garden borders), light (r spill, g lit house, b garden paths), ldir (the way back to the
  // window), decal (the atoms' marks: r paint, g dark, b water)
  const tiles = createTiles({ world: size, layers: [{ name: 'roof', bg: 'rgba(0,0,0,0)' }, { name: 'street', bg: 'rgba(0,0,0,0)' }, { name: 'misc', bg: '#000' }, { name: 'trees', bg: '#000' },
    { name: 'light', bg: '#000' }, { name: 'ldir', bg: '#808000' }, { name: 'decal', bg: '#000' }, { name: 'land', bg: '#000' }] });
  landItems(W, (layer, order, x, y, r, draw) => tiles.add({ layer, order, x, y, r, draw }));   // the land's map (world/land.js)
  const item = (layer, order, x, y, r, draw) => tiles.add({ layer, order, x, y, r, draw });
  const rOf = p => Math.hypot(p.w, p.h) / 2 + 1;
  for (const p of trees) { const r = (p.r || p.def.size[0] / 2) * 0.86;
    item('misc', 1000, p.x, p.y, r + 1, X => { X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgb(255,0,0)'; X.beginPath(); X.arc(p.x, p.y, r, 0, 7); X.fill(); });
    item('trees', 1000, p.x, p.y, r + 1, X => { X.globalCompositeOperation = 'lighten'; const g = X.createRadialGradient(p.x - r * 0.15, p.y - r * 0.2, 0, p.x, p.y, r); g.addColorStop(0, 'rgb(255,0,0)'); g.addColorStop(0.6, 'rgb(187,0,0)'); g.addColorStop(1, 'rgb(0,0,0)'); X.fillStyle = g; X.beginPath(); X.arc(p.x, p.y, r, 0, 7); X.fill(); }); }
  for (const wt of W.water || []) { const xs = wt.pts.map(q => q.x), ys = wt.pts.map(q => q.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    item('misc', 1500, cx, cy, Math.hypot(Math.max(...xs) - cx, Math.max(...ys) - cy) + (wt.w || 6), X => { X.globalCompositeOperation = 'lighter'; X.strokeStyle = 'rgb(0,255,0)'; X.lineWidth = wt.w || 6; X.beginPath(); wt.pts.forEach((q, i) => i ? X.lineTo(q.x, q.y) : X.moveTo(q.x, q.y)); X.stroke(); }); }
  // roofs: r the slope's axis, g which way along it this side faces (the shader lights it from the moving sun), b gable
  for (const p of buildings) item('roof', 1000, p.x, p.y, rOf(p), X => { X.translate(p.x, p.y); X.rotate(p.rot);
    if (p.def.look === 'gable' || p.def.look === 'church') for (const side of [-1, 1]) { const nx = -Math.sin(p.rot) * side, ny = Math.cos(p.rot) * side, A = ang(p.rot + Math.PI / 2) / 255 * Math.PI, pos = nx * Math.cos(A) + ny * Math.sin(A) > 0; X.fillStyle = `rgb(${Math.round(A / Math.PI * 255)},${pos ? 255 : 0},255)`; X.fillRect(-p.w / 2, side < 0 ? -p.h / 2 : 0, p.w, p.h / 2); }
    else if (!roofLook(p.def.look, X, p)) { X.fillStyle = `rgb(${ang(p.rot)},150,0)`; X.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); } });
  if (W.plaza) { const P = W.plaza; item('street', 2000, P.x, P.y, Math.hypot(P.w, P.h) / 2 + 1, X => { for (const [inset, lvl] of [[0, 80], [1.5, 255]]) { X.save(); X.translate(P.x, P.y); X.rotate(P.rot); X.fillStyle = `rgb(${ang(P.rot)},200,${lvl})`; X.fillRect(-P.w / 2 + inset, -P.h / 2 + inset, P.w - 2 * inset, P.h - 2 * inset); X.restore(); } }); }
  // streets drawn wider than the engine lays them (x1.6, paths x1.4) with 2.4 m pavements: the figures are drawn big, and a
  // life-size road looked like a lane beside them (roofs still win where a house stands close to the kerb)
  // each street kind has its profile (world/streets.js): width, the bands from its edge in (pavement, kerb, road), marks
  const sw = st => profileOf(st).width(st);
  for (let k = 0; k < 3; k++) for (const st of W.streets) { const P = profileOf(st), band = P.bands[k]; if (!band) continue; const [inset, lvl] = band; for (let i = 0; i < st.pts.length - 1; i++) { const a = st.pts[i], b = st.pts[i + 1], w = sw(st) - 2 * inset; if (w <= 0.4) continue;
    item('street', 3000 + k * 1000, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(b.x - a.x, b.y - a.y) / 2 + w / 2 + 1, X => { X.lineCap = 'round'; X.strokeStyle = `rgb(${ang(Math.atan2(b.y - a.y, b.x - a.x))},${P.kind},${lvl})`; X.lineWidth = w; X.beginPath(); X.moveTo(a.x, a.y); X.lineTo(b.x, b.y); X.stroke(); }); } }
  for (const st of W.streets) if (profileOf(st).marks && st.w >= 7) { const xs = st.pts.map(q => q.x), ys = st.pts.map(q => q.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    item('misc', 6000, cx, cy, Math.hypot(Math.max(...xs) - cx, Math.max(...ys) - cy) + 1, X => { X.globalCompositeOperation = 'lighter'; X.strokeStyle = 'rgb(0,255,0)'; X.lineWidth = 0.24; X.setLineDash([3, 4]); X.beginPath(); st.pts.forEach((q, i) => i ? X.lineTo(q.x, q.y) : X.moveTo(q.x, q.y)); X.stroke(); }); }
  // on a street or its pavement (from the streets' own lines, on a 16 m grid of segments): for the gardens, the dead's
  // spawning and the bike's parking
  const SG = 16, sgrid = new Map(), sk = (i, j) => i * 65536 + j;
  for (const st of W.streets) for (let i = 0; i < st.pts.length - 1; i++) { const a = st.pts[i], b = st.pts[i + 1], hw = sw(st) / 2, g = { ax: a.x, ay: a.y, bx: b.x, by: b.y, hw };
    for (let j = Math.floor((Math.min(a.y, b.y) - hw) / SG); j <= Math.floor((Math.max(a.y, b.y) + hw) / SG); j++) for (let q = Math.floor((Math.min(a.x, b.x) - hw) / SG); q <= Math.floor((Math.max(a.x, b.x) + hw) / SG); q++) { const k = sk(q, j); if (!sgrid.has(k)) sgrid.set(k, []); sgrid.get(k).push(g); } }
  const onStreet = (x, y, pad = 0) => { for (const g of sgrid.get(sk(Math.floor(x / SG), Math.floor(y / SG))) || []) { const dx = g.bx - g.ax, dy = g.by - g.ay, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - g.ax) * dx + (y - g.ay) * dy) / L2)); if (Math.hypot(x - g.ax - dx * u, y - g.ay - dy * u) < g.hw + pad) return true; }
    if (W.plaza) { const P = W.plaza, c = Math.cos(P.rot), s = Math.sin(P.rot), lx = (x - P.x) * c + (y - P.y) * s, ly = -(x - P.x) * s + (y - P.y) * c; if (Math.abs(lx) < P.w / 2 + pad && Math.abs(ly) < P.h / 2 + pad) return true; } return false; };
  // walls: buildings and the edge of the town
  const GR = 2, GW = Math.ceil(size.w * GR), GH = Math.ceil(size.h * GR), solid = new Uint8Array(GW * GH);
  const mark = (p, pad) => { const r = Math.hypot(p.w, p.h) / 2 + pad + 0.5, gx0 = Math.max(0, Math.floor((p.x - r) * GR)), gx1 = Math.min(GW - 1, Math.ceil((p.x + r) * GR)), gy0 = Math.max(0, Math.floor((p.y - r) * GR)), gy1 = Math.min(GH - 1, Math.ceil((p.y + r) * GR));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) if (pointInObb(p, (gx + 0.5) / GR, (gy + 0.5) / GR, pad)) solid[gy * GW + gx] = 1; };
  for (const p of buildings) if (p.def.collide !== 'none') mark(p, 0.15);   // a canopy (a gas station's) is ridden under
  const blocked = (x, y) => { if (x < 2 || y < 2 || x > W.w - 2 || y > W.h - 2) return true; const gx = Math.floor(x * GR), gy = Math.floor(y * GR); return gx < 0 || gy < 0 || gx >= GW || gy >= GH || solid[gy * GW + gx] === 1; };
  // the nests: infested and nestable buildings first, then the biggest houses, spread across the town
  const cand = buildings.filter(p => p.def.tags.includes('infested') || p.def.tags.includes('nestable')).concat(buildings.slice().sort((a, b) => b.w * b.h - a.w * a.h));
  const nests = [];
  for (const p of cand) { if (nests.length >= 9) break; if (Math.hypot(p.x - start.x, p.y - start.y) < 70 || nests.some(q => Math.hypot(q.b.x - p.x, q.b.y - p.y) < 80)) continue;
    let at = p.door || { x: p.x, y: p.y + p.h / 2 + 1.5 }; for (let k = 0; k < 12 && blocked(at.x, at.y); k++) at = { x: at.x + (at.x - p.x) * 0.15, y: at.y + (at.y - p.y) * 0.15 };
    if (!blocked(at.x, at.y)) nests.push({ b: p, x: at.x, y: at.y }); }
  // [dress] begin: how kept each place is, where things may stand, and the stories (they mark houses the lights and gardens read)
  const care = makeCare({ W, nests, buildings, seed: W.seed }), slots = makeSlots({ W, buildings, trees, blocked, care, sw });
  const flags = {}, placer = makePlacer({ ATOMS, STORIES, slots, care, seed: W.seed, flags });
  placer.stories((x, y) => !blocked(x, y));
  const kept = p => flags.survivor && flags.survivor.has(p.uid) ? 1 : care.at(p.x, p.y);
  // [dress] end
  // the night: no street lamps (the power died in the Ashfall); someone hides in some houses: more where it is kept
  const hashL = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const spill = (x, y, nx, ny, w, len, a) => { item('light', 7100, x, y, len + w, lX => { lX.globalCompositeOperation = 'lighter'; lX.translate(x, y); lX.rotate(Math.atan2(ny, nx)); const g = lX.createRadialGradient(0, 0, 0, 0, 0, len); g.addColorStop(0, `rgba(255,0,0,${a})`); g.addColorStop(0.5, `rgba(255,0,0,${a * 0.35})`); g.addColorStop(1, 'rgba(255,0,0,0)'); lX.fillStyle = g; const shape = X => { X.beginPath(); X.moveTo(0, -w / 2); X.lineTo(len, -w * 0.9); X.lineTo(len, w * 0.9); X.lineTo(0, w / 2); X.closePath(); X.fill(); }; shape(lX); });
    item('ldir', 7100, x, y, len + w, dX => { const shape = X => { X.beginPath(); X.moveTo(0, -w / 2); X.lineTo(len, -w * 0.9); X.lineTo(len, w * 0.9); X.lineTo(0, w / 2); X.closePath(); X.fill(); }; dX.translate(x, y); dX.rotate(Math.atan2(ny, nx)); const r = Math.round(128 - nx * 127), gg = Math.round(128 - ny * 127), dg = dX.createLinearGradient(0, 0, 8, 0); dg.addColorStop(0, `rgb(${r},${gg},0)`); dg.addColorStop(1, `rgb(${r},${gg},255)`); dX.fillStyle = dg; shape(dX); }); };
  // about two houses in five: a house's windows share a size (a cottage's small panes, a shopfront's wide glass), and
  // light shows on any wall, the ends too
  for (const p of buildings) { const kp = kept(p); if (!p.def.light || hashL(p.uid + W.seed * 31) >= (kp >= 0.99 ? 1 : kp > 0.62 ? 0.5 : kp > 0.32 ? 0.4 : 0.1)) continue;
    item('light', 7000, p.x, p.y, rOf(p), X => { X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgba(0,255,0,1)'; obb(X, p, 0); }); const c = Math.cos(p.rot), sn = Math.sin(p.rot), big = hashL(p.uid * 5 + 1), ww = 0.7 + big * 1.9, len = 2.4 + big * 3.4, gap = ww + 1.6 + hashL(p.uid * 11) * 2.5;
    const wall = (L, ox, oy, ex, ey, nx, ny, salt) => { const m = Math.max(1, Math.floor(L / gap)); for (let k = 0; k < m; k++) { if (hashL(p.uid * 7 + k * 3 + salt) < 0.35) continue; const u = (k + 0.5) / m - 0.5, lx = ox + ex * u * L, ly = oy + ey * u * L, a = 0.75 + 0.25 * hashL(p.uid * 3 + k + salt);
      const wx = p.x + lx * c - ly * sn, wy = p.y + lx * sn + ly * c, ox2 = nx * c - ny * sn, oy2 = nx * sn + ny * c; if (blocked(wx + ox2 * 0.6, wy + oy2 * 0.6) || blocked(wx + ox2 * 1.4, wy + oy2 * 1.4)) continue;   // a wall shared with the house next door has no window
      spill(p.x + lx * c - ly * sn, p.y + lx * sn + ly * c, nx * c - ny * sn, nx * sn + ny * c, ww, len, a); } };
    for (const side of [-1, 1]) { wall(p.w, 0, side * p.h / 2, 1, 0, 0, side, side + 2); if (p.h > 5 && hashL(p.uid * 17 + side) < 0.6) wall(p.h, side * p.w / 2, 0, 0, 1, side, 0, side + 6); }
    if (p.door && hashL(p.uid * 13) < 0.4) { const dx = p.door.x - p.x, dy = p.door.y - p.y, r = Math.hypot(dx, dy) || 1; spill(p.door.x, p.door.y, dx / r, dy / r, 1.1, 4.0, 1.0); } }
  // [garden] begin
  const gardens = layoutGardens({ buildings, blocked, street: (x, y) => onStreet(x, y, 0.2), size, seed: W.seed, keep: kept }); for (const it of gardens.items) tiles.add(it);
  // [garden] end
  // [dress] begin: the atoms, round the gardens; their ground marks into the decal map (r pale paint, g dark: stains, oil,
  // char, holes; b water); the solid ones (cars, barriers, lamps) become walls
  let dress; {
    placer.atoms((x, y) => !blocked(x, y) && !gardens.at(x, y)); dress = placer.done();
    for (const i of dress.paint) item('decal', 90000, i.x, i.y, 16, X => { X.globalCompositeOperation = 'lighter'; i.atom.paint(X, i); });
    for (const i of dress.solid) if (!i.atom.breakable) mark({ x: i.x, y: i.y, rot: i.ang, w: i.atom.collide.w, h: i.atom.collide.h }, 0); }
  // what the bike smashes instead of crashing into (small props: benches, bins, lamps, cones, barriers)
  const breakables = dress.list.filter(i => i.atom.breakable).map(i => ({ id: i.id, x: i.x, y: i.y, r: i.atom.collide ? Math.max(i.atom.collide.w, i.atom.collide.h) / 2 : 0.5 }));
  // [dress] end
  // where on a street: for spawning the dead and parking the bike (a street cell, 1 m grid)
  const streetCells = []; for (let y = 4; y < W.h - 4; y += 2) for (let x = 4; x < W.w - 4; x += 2) if (onStreet(x, y, -0.6) && !blocked(x, y)) streetCells.push(x, y);
  return { W, start, size, tiles, onStreet, gardens, blocked, streetCells, nests, buildings, trees, cars, care, slots, flags, dress, breakables };
}
