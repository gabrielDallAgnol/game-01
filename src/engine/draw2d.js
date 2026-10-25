// Flat top-down renderer for an engine world (Canvas 2D). It draws only from palette roles
// and atom data, layer by layer, in metres. Used by the Atom Lab; the three.js view will read
// the same world later. Returns cached layer canvases: ground (everything under figures) and
// over (roofs and canopies, drawn after figures so they can fade over the hero).
// paintWorld draws any rect of the world into two contexts already scaled to metres, so a
// viewer can keep a sharp window cache at device resolution instead of one blurry big canvas.
import { resolve } from './palettes.js';
import { obbCorners, toWorld } from './geom.js';

export const SUN = { x: -0.6, y: -0.8 };
const SHADOW_K = 0.38; // shadow length per metre of height

function convex(pts) { pts = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y); const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); const lo = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } up.pop(); lo.pop(); return lo.concat(up); }
const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); };
const line = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); };
const box = (c, o, r) => { c.save(); c.translate(o.x, o.y); c.rotate(o.rot); c.beginPath(); c.roundRect(-o.w / 2, -o.h / 2, o.w, o.h, r || 0); c.restore(); };

export function drawWorld(W, chapter, px) {
  const mk = () => { const cv = document.createElement('canvas'); cv.width = Math.ceil(W.w * px); cv.height = Math.ceil(W.h * px); const c = cv.getContext('2d'); c.scale(px, px); return [cv, c]; };
  const [g, c] = mk(), [o, d] = mk();
  paintWorld(c, d, W, chapter, { x0: 0, y0: 0, x1: W.w, y1: W.h });
  return { ground: g, over: o, px };
}

export function paintWorld(c, d, W, chapter, R) {
  const P = role => resolve(chapter, role), sh = h => ({ dx: -SUN.x * h * SHADOW_K, dy: -SUN.y * h * SHADOW_K * 0.8 });
  const M = 14, near = p => p.x > R.x0 - M && p.x < R.x1 + M && p.y > R.y0 - M && p.y < R.y1 + M;   // M covers the largest atom
  const span = (a, b, st, lo, hi) => [Math.max(lo, Math.floor(a / st) * st), Math.min(hi, b)];
  const placed = W.placed.filter(p => near(p) || p.w > 2 * M);
  // ground and the land's character
  c.fillStyle = P('ground.base'); c.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
  { const [ya, yb] = span(R.y0 - 8, R.y1 + 2, 6, 0, W.h), [xa, xb] = span(R.x0 - 8, R.x1 + 2, 6, 0, W.w); c.fillStyle = P('ground.field'); c.globalAlpha = 0.45; for (let y = ya; y < yb; y += 6) for (let x = xa; x < xb; x += 6) if (W.terrain.field(x, y) > 0.6) { c.beginPath(); c.arc(x + 3, y + 3, 4.6, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; }
  { const [ya, yb] = span(R.y0 - 5, R.y1 + 2, 3, 0, W.h), [xa, xb] = span(R.x0 - 5, R.x1 + 2, 3, 0, W.w); c.fillStyle = P('ground.forest'); for (let y = ya; y < yb; y += 3) for (let x = xa; x < xb; x += 3) if (W.terrain.woods(x, y) > 0.6) { c.beginPath(); c.arc(x + 1.5, y + 1.5, 2.6, 0, Math.PI * 2); c.fill(); } }
  // water
  W.water.forEach(wt => { const L = wt.pts.map(p => ({ x: p.x - wt.w / 2, y: p.y })), Rr = wt.pts.map(p => ({ x: p.x + wt.w / 2, y: p.y })).reverse(); poly(c, L.concat(Rr)); c.strokeStyle = P('water.bank'); c.lineWidth = 2.4; c.stroke(); c.fillStyle = P('water.deep'); c.fill();
    c.save(); poly(c, L.concat(Rr)); c.clip(); c.strokeStyle = P('water.ripple'); c.lineWidth = 0.5; c.globalAlpha = 0.6; for (let k = -1; k <= 1; k++) { line(c, wt.pts.map(p => ({ x: p.x + k * wt.w * 0.22 + 0.8 * Math.sin(p.y / 4 + k), y: p.y }))); c.stroke(); } c.restore(); c.globalAlpha = 1; });
  // lots: lawns, parking, yards
  W.lots.forEach(l => { if (l.kind === 'residential' && l.building) { box(c, l, 0.8); c.fillStyle = P('ground.lawn'); c.fill(); }
    if (l.kind === 'commercial' || l.kind === 'industrial') { box(c, l, 1); c.fillStyle = P('road.lot'); c.globalAlpha = l.building ? 1 : 0.5; c.fill(); c.globalAlpha = 1;
      if (l.parking || l.kind === 'industrial') { const pk = l.parking || { ...toWorld(l, 0, -l.h / 2 + 8), w: l.w - 4, h: 12, rot: l.rot }; c.save(); c.translate(pk.x, pk.y); c.rotate(pk.rot); c.strokeStyle = P('road.lotline'); c.lineWidth = 0.15; c.beginPath(); for (let x = -pk.w / 2 + 1; x < pk.w / 2 - 1; x += 2.6) { c.moveTo(x, -pk.h / 2 + 0.6); c.lineTo(x, -pk.h / 2 + 5.2); } c.stroke(); c.restore(); } } });
  // streets: pavement, kerb, asphalt, markings
  const S = W.streets;
  c.lineCap = 'round'; c.lineJoin = 'round';
  S.forEach(s => { line(c, s.pts); if (s.walk) { c.strokeStyle = P('road.walk'); c.lineWidth = s.w + 2 * s.walk; } else { c.strokeStyle = P('road.kerb'); c.lineWidth = s.w + 1.2; } c.stroke(); });
  S.forEach(s => { if (!s.walk) return; line(c, s.pts); c.strokeStyle = P('road.kerb'); c.lineWidth = s.w + 0.35; c.stroke(); });
  S.forEach(s => { line(c, s.pts); c.strokeStyle = P('road.asphalt'); c.lineWidth = s.w; c.stroke(); });
  S.forEach(s => { c.strokeStyle = P('road.line'); if (s.marks === 'dash') { line(c, s.pts); c.lineWidth = 0.14; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
    if (s.marks === 'double') { [-0.18, 0.18].forEach(off => { c.beginPath(); s.pts.forEach((p, i) => { const q = s.pts[Math.min(s.pts.length - 1, i + 1)], pp = s.pts[Math.max(0, i - 1)], dx = q.x - pp.x, dy = q.y - pp.y, L = Math.hypot(dx, dy) || 1; const x = p.x - dy / L * off, y = p.y + dx / L * off; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.lineWidth = 0.12; c.stroke(); }); } });
  // drives and pools
  W.lots.forEach(l => { if (l.drive) { box(c, l.drive, 0.3); c.fillStyle = P('road.walk'); c.fill(); } });
  placed.filter(p => p.id.startsWith('pool.')).forEach(p => { box(c, { ...p, w: p.w + 0.8, h: p.h + 0.8 }, 0.8); c.fillStyle = P('road.walk'); c.fill(); box(c, p, 0.6); c.fillStyle = P('pool'); c.fill(); });
  // bridges
  W.bridges.forEach(b => { const s = sh(1.2); box(c, { ...b, x: b.x + s.dx, y: b.y + s.dy }); c.fillStyle = P('shadow'); c.fill(); box(c, b, 0.2); c.fillStyle = P('roof.slate'); c.fill(); box(c, { ...b, h: b.h - 2 }); c.fillStyle = P('road.asphalt'); c.fill(); });
  // camp ground
  if (W.camp) { c.beginPath(); c.arc(W.camp.x, W.camp.y, W.camp.r, 0, Math.PI * 2); c.fillStyle = P('ground.field'); c.fill(); }
  // shadows of everything with height
  c.fillStyle = P('shadow');
  placed.forEach(p => { const h = p.def.height; if (!h || p.def.kind === 'street') return; const s = sh(h);
    if (p.def.kind === 'tree') { const r = p.r || p.def.size[0] / 2; c.beginPath(); c.ellipse(p.x + s.dx * 0.6, p.y + s.dy * 0.6, r, r * 0.9, 0, 0, Math.PI * 2); c.fill(); return; }
    if (p.def.collide === 'circle') { c.beginPath(); c.ellipse(p.x + s.dx * 0.5, p.y + s.dy * 0.5, 0.5, 0.3, Math.atan2(s.dy, s.dx), 0, Math.PI * 2); c.fill(); return; }
    const pts = obbCorners(p); poly(c, convex(pts.concat(pts.map(q => ({ x: q.x + s.dx, y: q.y + s.dy }))))); c.fill(); });
  // low props: fences, lamps, cars, the fire pit
  c.strokeStyle = P('fence'); c.lineWidth = 0.16; c.lineCap = 'butt'; W.fences.forEach(f => { line(c, [f.a, f.b]); c.stroke(); });
  c.fillStyle = P('fence'); W.fences.forEach(f => { const L = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y); for (let k = 0; k <= L; k += 2) { const t = k / L; c.fillRect(f.a.x + (f.b.x - f.a.x) * t - 0.13, f.a.y + (f.b.y - f.a.y) * t - 0.13, 0.26, 0.26); } });
  placed.forEach(p => { if (p.id.startsWith('lamp.')) { c.beginPath(); c.arc(p.x, p.y, 0.28, 0, Math.PI * 2); c.fillStyle = P('metal'); c.fill(); }
    else if (p.id.startsWith('car.')) { const tones = ['roof.cream', 'metal', 'roof.warm', 'roof.sand']; box(c, p, 0.5); c.fillStyle = P(tones[(p.tone || 0) % 4]); c.fill(); c.fillStyle = 'rgba(20,22,30,0.45)'; box(c, { ...toWorld(p, 0.2, 0), w: p.w * 0.4, h: p.h - 0.5, rot: p.rot }, 0.3); c.fill(); }
    else if (p.id.startsWith('firepit.')) { c.beginPath(); c.arc(p.x, p.y, 1, 0, Math.PI * 2); c.strokeStyle = P('metal'); c.lineWidth = 0.4; c.stroke(); } });
  // overhead: roofs, then canopies
  placed.forEach(p => { if (p.def.layer !== 'roof') return; const roles = p.def.roles;
    if (p.id.startsWith('tarp.')) { box(d, p, 0.4); d.fillStyle = P(roles[(p.tone || 0) % roles.length]); d.fill(); d.fillStyle = 'rgba(0,0,0,0.22)'; d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.fillRect(-p.w / 2, -0.1, p.w, 0.2); d.restore(); return; }
    if (p.id.startsWith('rig.')) { box(d, p, 0.5); d.fillStyle = P('accent.caution'); d.fill(); d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.fillStyle = P('roof.slate'); d.fillRect(-p.w / 2 + p.w * 0.32, -p.h / 2 + 0.4, p.w * 0.62, p.h - 0.8); d.restore(); return; }
    const roof = p.def.roof || 'flat';
    d.save(); d.translate(p.x, p.y); d.rotate(p.rot);
    if (roof === 'gable') { d.beginPath(); d.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 0.4); d.fillStyle = P(roles[0]); d.fill();
      const away = (SUN.y * Math.cos(p.rot) - SUN.x * Math.sin(p.rot)) > 0; d.fillStyle = P(roles[1]); d.fillRect(-p.w / 2, away ? -p.h / 2 : 0, p.w, p.h / 2);
      d.fillStyle = 'rgba(0,0,0,0.2)'; d.fillRect(-p.w / 2 + 0.4, -0.12, p.w - 0.8, 0.24);
      if (p.def.kind === 'building' && p.w > 6) { d.fillStyle = P('roof.cream2'); d.fillRect(p.w / 2 - 2.2, -p.h / 2 + 0.8, 0.9, 1.2); } }
    else if (roof === 'canopy') { d.beginPath(); d.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 0.4); d.fillStyle = P(roles[0]); d.fill(); d.fillStyle = P(roles[1]); d.fillRect(-p.w / 2, -p.h / 2, p.w, 1); d.fillRect(-p.w / 2, p.h / 2 - 1, p.w, 1); }
    else { d.beginPath(); d.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 0.3); d.fillStyle = P(roles[0]); d.fill(); d.fillStyle = P(roles[1]); d.fillRect(-p.w / 2, p.h / 2 - 1.2, p.w, 1.2); d.fillStyle = P(roles[2] || 'metal'); for (let x = -p.w / 2 + 2; x < p.w / 2 - 2; x += 4.5) d.fillRect(x, -p.h / 2 + 1.4, 1.6, 1.6); }
    if (p.def.label) { d.fillStyle = P(p.id.startsWith('depot') ? 'accent.caution' : 'wall.light'); d.font = `500 ${p.id.startsWith('depot') ? 2.6 : 0.9}px 'IBM Plex Mono', monospace`; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText(p.def.label.toUpperCase(), 0, p.id.startsWith('depot') ? 1.5 : p.h / 2 - 0.6); }
    d.restore(); });
  placed.forEach(p => { if (p.def.kind !== 'tree') return; const r = p.r || p.def.size[0] / 2, k = p.k || 0, roles = p.def.roles;
    const lobes = 3 + Math.floor(k * 3); d.beginPath(); for (let i = 0; i < lobes; i++) { const a = i / lobes * Math.PI * 2 + k * 6, dd = r * 0.36, rr = r * (0.62 + 0.12 * Math.sin(i * 2.1 + k * 9)); d.moveTo(p.x + Math.cos(a) * dd + rr, p.y + Math.sin(a) * dd); d.arc(p.x + Math.cos(a) * dd, p.y + Math.sin(a) * dd, rr, 0, Math.PI * 2); }
    d.fillStyle = P(roles[0]); d.fill(); d.fillStyle = P(roles[1]); d.beginPath(); d.arc(p.x - SUN.x * r * 0.3, p.y - SUN.y * r * 0.3, r * 0.6, 0, Math.PI * 2); d.fill(); d.fillStyle = P(roles[2]); d.beginPath(); d.arc(p.x + SUN.x * r * 0.42, p.y + SUN.y * r * 0.42, r * 0.28, 0, Math.PI * 2); d.fill(); });
}

// Debug overlays for the lab and the screenshot tool: sockets, nav, collision, lots.
export function drawOverlays(W, px, which) {
  const cv = document.createElement('canvas'); cv.width = Math.ceil(W.w * px); cv.height = Math.ceil(W.h * px); const c = cv.getContext('2d'); c.scale(px, px);
  paintOverlays(c, W, which, { x0: 0, y0: 0, x1: W.w, y1: W.h });
  return cv;
}

export function paintOverlays(c, W, which, R) {
  if (which.nav && W.nav) { c.fillStyle = 'rgba(214,69,69,0.45)'; const N = W.nav; for (let j = Math.max(0, R.y0 | 0); j < Math.min(N.h, R.y1 + 1); j++) for (let i = Math.max(0, R.x0 | 0); i < Math.min(N.w, R.x1 + 1); i++) if (N.blocked[j * N.w + i]) c.fillRect(i, j, 1, 1); }
  if (which.collision) { c.strokeStyle = 'rgba(214,69,69,0.95)'; c.lineWidth = 0.18; W.placed.forEach(p => { if (p.def.collide === 'box') { poly(c, obbCorners(p)); c.stroke(); } else if (p.def.collide === 'circle') { c.beginPath(); c.arc(p.x, p.y, p.def.trunk || p.def.size[0] / 2, 0, Math.PI * 2); c.stroke(); } }); W.fences.forEach(f => { line(c, [f.a, f.b]); c.stroke(); }); }
  if (which.lots) { W.lots.forEach(l => { poly(c, obbCorners(l)); c.strokeStyle = l.kind === 'park' ? 'rgba(90,140,60,0.9)' : l.kind === 'residential' ? 'rgba(61,90,128,0.9)' : 'rgba(180,120,40,0.9)'; c.lineWidth = 0.22; c.setLineDash([1, 0.6]); c.stroke(); c.setLineDash([]); const f = W.lotFront(l); line(c, [f.a, f.b]); c.lineWidth = 0.5; c.stroke(); }); }
  if (which.sockets) {
    const dot = (p, col, r) => { c.beginPath(); c.arc(p.x, p.y, r || 0.6, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
    W.nodes.forEach(n => { dot(n, '#7F3FBF', 1.1); });
    W.lots.forEach(l => { if (l.driveMouth) dot(l.driveMouth, '#E3B23C', 0.7); });
    W.placed.forEach(p => { if (p.door) { dot(p.door, '#2F86A6', 0.7); c.strokeStyle = '#2F86A6'; c.lineWidth = 0.15; line(c, [p.door, { x: p.x, y: p.y }]); c.stroke(); } if (p.id.startsWith('tree.street')) dot(p, '#3B8F3B', 0.45); if (p.id.startsWith('lamp.')) dot(p, '#F0A020', 0.45); });
    W.bridges.forEach(b => { obbCorners(b).forEach(q => dot(q, '#B03A8F', 0.5)); });
  }
}
