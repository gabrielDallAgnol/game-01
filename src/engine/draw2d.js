// Flat top-down renderer for an engine world (Canvas 2D). It draws only from palette roles
// and atom data, in metres. Each atom names a `look` (a drawing grammar shared by many atoms);
// this file never checks an atom's id, so a new atom draws with no new code.
// paintWorld draws any rect of the world into two contexts already scaled to metres: ground
// (under figures) and over (roofs and canopies, drawn after figures so they fade over the hero).
import { resolve } from './palettes.js';
import { obbCorners, toWorld } from './geom.js';

export const SUN = { x: -0.6, y: -0.8 };
const SHADOW_K = 0.38; // shadow length per metre of height

function convex(pts) { pts = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y); const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); const lo = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } up.pop(); lo.pop(); return lo.concat(up); }
const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); };
const line = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); };
const box = (c, o, r) => { c.save(); c.translate(o.x, o.y); c.rotate(o.rot); c.beginPath(); c.roundRect(-o.w / 2, -o.h / 2, o.w, o.h, r || 0); c.restore(); };
const offsetLine = (pts, off) => pts.map((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], pp = pts[Math.max(0, i - 1)], dx = q.x - pp.x, dy = q.y - pp.y, L = Math.hypot(dx, dy) || 1; return { x: p.x - dy / L * off, y: p.y + dx / L * off }; });

export function drawWorld(W, chapter, px) {
  const mk = () => { const cv = document.createElement('canvas'); cv.width = Math.ceil(W.w * px); cv.height = Math.ceil(W.h * px); const c = cv.getContext('2d'); c.scale(px, px); return [cv, c]; };
  const [g, c] = mk(), [o, d] = mk();
  paintWorld(c, d, W, chapter, { x0: 0, y0: 0, x1: W.w, y1: W.h });
  return { ground: g, over: o, px };
}

// looks drawn on the ground pass (under figures) and on the over pass (roofs and canopies)
const LOW = {
  pool(c, p, P) { box(c, { ...p, w: p.w + 0.8, h: p.h + 0.8 }, 0.8); c.fillStyle = P(p.def.roles[1] || 'road.walk'); c.fill(); box(c, p, 0.6); c.fillStyle = P(p.def.roles[0]); c.fill(); },
  lamp(c, p, P) { c.beginPath(); c.arc(p.x, p.y, 0.28, 0, Math.PI * 2); c.fillStyle = P(p.def.roles[0]); c.fill(); },
  car(c, p, P) { const R = p.def.roles; box(c, p, 0.5); c.fillStyle = P(R[(p.tone || 0) % R.length]); c.fill(); c.fillStyle = 'rgba(20,22,30,0.45)'; box(c, { ...toWorld(p, 0.2, 0), w: p.w * 0.4, h: p.h - 0.5, rot: p.rot }, 0.3); c.fill(); },
  ring(c, p, P) { c.beginPath(); c.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2); c.strokeStyle = P(p.def.roles[0]); c.lineWidth = 0.4; c.stroke(); if (p.def.roles[1]) { c.beginPath(); c.arc(p.x, p.y, p.w * 0.22, 0, Math.PI * 2); c.fillStyle = P(p.def.roles[1]); c.fill(); } },
  ruin(c, p, P) { box(c, p, 0.2); c.fillStyle = P(p.def.roles[0]); c.fill(); c.save(); c.translate(p.x, p.y); c.rotate(p.rot); const k = p.k || 0; c.fillStyle = P(p.def.roles[2] || 'roof.slate'); for (let i = 0; i < 3; i++) { const a = (k * 7 + i * 2.3) % 1, b = (k * 13 + i * 1.7) % 1; c.fillRect(-p.w / 2 + 0.4 + a * (p.w - 2.4), -p.h / 2 + 0.4 + b * (p.h - 1.6), 1.6, 0.5); } if (p.embers) { c.fillStyle = P('accent.ember'); c.globalAlpha = 0.85; c.beginPath(); c.arc((k - 0.5) * p.w * 0.5, ((k * 3) % 1 - 0.5) * p.h * 0.4, 0.5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; } c.restore(); },
  crater(c, p, P) { c.beginPath(); c.ellipse(p.x, p.y, p.w / 2, p.h / 2, p.rot, 0, Math.PI * 2); c.fillStyle = P(p.def.roles[0]); c.fill(); c.beginPath(); c.ellipse(p.x + SUN.x * 0.3, p.y + SUN.y * 0.3, p.w * 0.36, p.h * 0.34, p.rot, 0, Math.PI * 2); c.fillStyle = P(p.def.roles[1]); c.fill(); },
  nest(c, p, P) { const R = p.def.roles, r = p.w / 2; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(p.x, p.y, r * (1 - k * 0.22), 0, Math.PI * 2); c.fillStyle = P(R[k % R.length]); c.fill(); } c.strokeStyle = P('accent.ember'); c.lineWidth = 0.35; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + (p.k || 0) * 6; c.beginPath(); c.moveTo(p.x + Math.cos(a) * r * 0.3, p.y + Math.sin(a) * r * 0.3); c.lineTo(p.x + Math.cos(a + 0.25) * r * 1.25, p.y + Math.sin(a + 0.25) * r * 1.25); c.stroke(); } },
  pylon(c, p, P) { box(c, p, 0.1); c.strokeStyle = P(p.def.roles[0]); c.lineWidth = 0.18; c.stroke(); const q = obbCorners(p); line(c, [q[0], q[2]]); c.stroke(); line(c, [q[1], q[3]]); c.stroke(); },
};
const OVER = {
  gable(d, p, P) { const R = p.def.roles; d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.beginPath(); d.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, p.def.sockets.some(s => s.type === 'party.wall') ? 0 : 0.4); d.fillStyle = P(R[0]); d.fill();
    const away = (SUN.y * Math.cos(p.rot) - SUN.x * Math.sin(p.rot)) > 0; d.fillStyle = P(R[1]); d.fillRect(-p.w / 2, away ? -p.h / 2 : 0, p.w, p.h / 2);
    d.fillStyle = 'rgba(0,0,0,0.2)'; d.fillRect(-p.w / 2 + 0.4, -0.12, p.w - 0.8, 0.24);
    if (p.def.kind === 'building' && p.w > 6 && R[2]) { d.fillStyle = P(R[2]); d.fillRect(p.w / 2 - 2.2, -p.h / 2 + 0.8, 0.9, 1.2); }
    if (p.def.sockets.some(s => s.type === 'party.wall')) { d.fillStyle = 'rgba(0,0,0,0.16)'; d.fillRect(-p.w / 2, -p.h / 2, 0.14, p.h); if (p.chimney) { d.fillStyle = P(R[2] || 'roof.slate'); d.fillRect(-p.w / 2 - 0.4, -0.5, 0.8, 1); } }
    label(d, p, P); d.restore(); },
  flat(d, p, P) { const R = p.def.roles; d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.beginPath(); d.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 0.3); d.fillStyle = P(R[0]); d.fill(); d.fillStyle = P(R[1]); d.fillRect(-p.w / 2, p.h / 2 - 1.2, p.w, 1.2); d.fillStyle = P(R[2] || 'metal'); for (let x = -p.w / 2 + 2; x < p.w / 2 - 2; x += 4.5) d.fillRect(x, -p.h / 2 + 1.4, 1.6, 1.6); label(d, p, P); d.restore(); },
  canopy(d, p, P) { const R = p.def.roles; d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.beginPath(); d.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 0.4); d.fillStyle = P(R[0]); d.fill(); d.fillStyle = P(R[1]); d.fillRect(-p.w / 2, -p.h / 2, p.w, 1); d.fillRect(-p.w / 2, p.h / 2 - 1, p.w, 1); label(d, p, P); d.restore(); },
  tarp(d, p, P) { const R = p.def.roles; box(d, p, 0.4); d.fillStyle = P(R[(p.tone || 0) % R.length]); d.fill(); d.fillStyle = 'rgba(0,0,0,0.22)'; d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.fillRect(-p.w / 2, -0.1, p.w, 0.2); d.restore(); },
  rig(d, p, P) { const R = p.def.roles; box(d, p, 0.5); d.fillStyle = P(R[0]); d.fill(); d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.fillStyle = P(R[1]); d.fillRect(-p.w / 2 + p.w * 0.32, -p.h / 2 + 0.4, p.w * 0.62, p.h - 0.8); d.restore(); },
  railcar(d, p, P) { const R = p.def.roles; box(d, p, 0.2); d.fillStyle = P(R[(p.tone || 0) % (R.length - 1)]); d.fill(); d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = -p.w / 2 + 1.5; x < p.w / 2 - 1; x += 2.5) d.fillRect(x, -p.h / 2 + 0.2, 0.12, p.h - 0.4); d.fillStyle = P(R[R.length - 1]); d.fillRect(-p.w / 2, -p.h / 2, 0.5, p.h); d.fillRect(p.w / 2 - 0.5, -p.h / 2, 0.5, p.h); d.restore(); },
  tower(d, p, P) { const R = p.def.roles, r = p.w / 2; d.beginPath(); d.arc(p.x, p.y, r, 0, Math.PI * 2); d.fillStyle = P(R[0]); d.fill(); d.beginPath(); d.arc(p.x - SUN.x * r * 0.25, p.y - SUN.y * r * 0.25, r * 0.55, 0, Math.PI * 2); d.fillStyle = P(R[1]); d.fill(); d.beginPath(); d.arc(p.x, p.y, r * 0.15, 0, Math.PI * 2); d.fillStyle = P(R[2] || 'metal'); d.fill(); },
  tree(d, p, P) { const r = p.r || p.def.size[0] / 2, k = p.k || 0, R = p.def.roles, lobes = 3 + Math.floor(k * 3); d.beginPath(); for (let i = 0; i < lobes; i++) { const a = i / lobes * Math.PI * 2 + k * 6, dd = r * 0.36, rr = r * (0.62 + 0.12 * Math.sin(i * 2.1 + k * 9)); d.moveTo(p.x + Math.cos(a) * dd + rr, p.y + Math.sin(a) * dd); d.arc(p.x + Math.cos(a) * dd, p.y + Math.sin(a) * dd, rr, 0, Math.PI * 2); }
    d.fillStyle = P(R[0]); d.fill(); d.fillStyle = P(R[1]); d.beginPath(); d.arc(p.x - SUN.x * r * 0.3, p.y - SUN.y * r * 0.3, r * 0.6, 0, Math.PI * 2); d.fill(); d.fillStyle = P(R[2]); d.beginPath(); d.arc(p.x + SUN.x * r * 0.42, p.y + SUN.y * r * 0.42, r * 0.28, 0, Math.PI * 2); d.fill(); },
  // a church: the nave a gable with a rounded east end, the tower at the west end with its spire in four facets
  church(d, p, P) { const R = p.def.roles, tw = Math.min(p.h * 0.95, p.w * 0.3), hw = p.w / 2, hh = p.h / 2, c = Math.cos(p.rot), s = Math.sin(p.rot), lit = (nx, ny) => (nx * c - ny * s) * SUN.x + (nx * s + ny * c) * SUN.y > 0;
    d.save(); d.translate(p.x, p.y); d.rotate(p.rot);
    d.beginPath(); d.roundRect(-hw + tw * 0.7, -hh, p.w - tw * 0.7, p.h, [0, hh * 0.9, hh * 0.9, 0]); d.fillStyle = P(R[0]); d.fill();
    d.save(); d.clip(); d.fillStyle = P(R[1]); d.fillRect(-hw, lit(0, -1) ? 0 : -hh, p.w, hh); d.restore();
    d.fillStyle = 'rgba(0,0,0,0.22)'; d.fillRect(-hw + tw, -0.15, p.w - tw - hh * 0.6, 0.3);
    const tx = -hw + tw / 2, q = tw / 2, F = [[0, -1, [-q, -q], [q, -q]], [1, 0, [q, -q], [q, q]], [0, 1, [q, q], [-q, q]], [-1, 0, [-q, q], [-q, -q]]];
    d.fillStyle = P(R[2]); d.fillRect(tx - q - 0.3, -q - 0.3, tw + 0.6, tw + 0.6);
    F.forEach(([nx, ny, a, b]) => { d.beginPath(); d.moveTo(tx + a[0], a[1]); d.lineTo(tx + b[0], b[1]); d.lineTo(tx, 0); d.closePath(); d.fillStyle = P(R[2]); d.fill(); if (!lit(nx, ny)) { d.fillStyle = 'rgba(0,0,0,0.3)'; d.fill(); } });
    d.beginPath(); d.arc(tx, 0, 0.45, 0, Math.PI * 2); d.fillStyle = P('accent.glow'); d.fill();
    d.translate(tw * 0.35, 0); label(d, p, P); d.restore(); },
  // a lattice radio mast on three guy wires (def.guy = anchor radius): the wires, the anchors, the lattice, the red tip
  mast(d, p, P) { const R = p.def.roles, g = p.def.guy || 0, hw = p.w / 2; d.save(); d.translate(p.x, p.y); d.rotate(p.rot);
    d.strokeStyle = P(R[2] || R[0]); d.lineWidth = 0.09; d.globalAlpha = 0.7;
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5, ax = Math.cos(a), ay = Math.sin(a); [0.55, 1].forEach(f => { d.beginPath(); d.moveTo(ax * hw * 0.5, ay * hw * 0.5); d.lineTo(ax * g * f, ay * g * f); d.stroke(); }); d.fillStyle = P(R[2] || R[0]); d.fillRect(ax * g - 0.5, ay * g - 0.5, 1, 1); }
    d.globalAlpha = 1; d.strokeStyle = P(R[0]); d.lineWidth = 0.22; d.strokeRect(-hw, -hw, p.w, p.w); d.beginPath(); d.moveTo(-hw, -hw); d.lineTo(hw, hw); d.moveTo(hw, -hw); d.lineTo(-hw, hw); d.stroke();
    d.lineWidth = 0.16; d.strokeRect(-hw * 0.55, -hw * 0.55, p.w * 0.55, p.w * 0.55);
    d.beginPath(); d.arc(0, 0, 0.6, 0, Math.PI * 2); d.fillStyle = P(R[1]); d.fill(); d.restore(); },
  // a building the Ash-Born have taken: dark ash-flesh heaped round a few hearts and spilling past the walls, ember
  // cracks running out from each heart, glowing sores, a low glow; the sawtooth roof still shows between the heaps
  infested(d, p, P) { const R = p.def.roles, k = p.k || 0.37, fr = i => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    d.save(); d.translate(p.x, p.y); d.rotate(p.rot); d.beginPath(); d.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 0.3); d.fillStyle = P(R[0]); d.fill();
    d.fillStyle = P(R[1]); for (let x = -p.w / 2 + 1.5; x < p.w / 2 - 1; x += 4) d.fillRect(x, -p.h / 2 + 0.5, 1.3, p.h - 1);
    const hearts = Array.from({ length: 2 + Math.floor(p.w / 22) }, (_, i) => ({ x: (fr(i + 1) - 0.5) * p.w * 0.8, y: (fr(i + 31) - 0.5) * p.h * 0.6, r: Math.min(p.w, p.h) * (0.35 + fr(i + 61) * 0.25) }));
    hearts.forEach((h, i) => { const g = d.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * 1.8); g.addColorStop(0, P(R[2])); g.addColorStop(1, 'rgba(0,0,0,0)'); d.globalAlpha = 0.35; d.fillStyle = g; d.fillRect(h.x - h.r * 2, h.y - h.r * 2, h.r * 4, h.r * 4); d.globalAlpha = 1; });
    d.fillStyle = 'rgba(34,24,28,0.92)';
    hearts.forEach((h, i) => { for (let j = 0; j < 9; j++) { const a = fr(i * 17 + j) * Math.PI * 2, rr = h.r * Math.sqrt(fr(i * 23 + j + 5)), x = h.x + Math.cos(a) * rr, y = h.y + Math.sin(a) * rr * 0.8; d.beginPath(); d.arc(x, y, h.r * (0.22 + fr(i * 29 + j) * 0.3), 0, Math.PI * 2); d.fill(); } });
    d.strokeStyle = P(R[3] || R[2]); d.lineCap = 'round';
    hearts.forEach((h, i) => { for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI * 2 + fr(i * 7 + j) * 0.8, L = h.r * (0.8 + fr(i * 13 + j) * 0.9); d.lineWidth = 0.35; d.beginPath(); d.moveTo(h.x, h.y);
      const mx = h.x + Math.cos(a + 0.3) * L * 0.5, my = h.y + Math.sin(a + 0.3) * L * 0.5; d.quadraticCurveTo(mx, my, h.x + Math.cos(a) * L, h.y + Math.sin(a) * L); d.stroke(); d.lineWidth = 0.18; d.beginPath(); d.moveTo(mx, my); d.lineTo(mx + Math.cos(a - 0.9) * L * 0.3, my + Math.sin(a - 0.9) * L * 0.3); d.stroke(); } });
    d.fillStyle = P(R[2]); hearts.forEach((h, i) => { for (let j = 0; j < 5; j++) { const a = fr(i * 41 + j) * Math.PI * 2, rr = h.r * 0.6 * fr(i * 43 + j); d.beginPath(); d.arc(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr, 0.35 + fr(i * 47 + j) * 0.45, 0, Math.PI * 2); d.fill(); } });
    label(d, p, P); d.restore(); },
  deadtree(d, p, P) { const r = p.r || p.def.size[0] / 2, k = p.k || 0, R = p.def.roles, n = 5 + Math.floor(k * 3); d.strokeStyle = P(R[0]); d.lineCap = 'round';
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + k * 5, l = r * (0.7 + 0.3 * Math.sin(i * 3.1 + k * 7)), mx = p.x + Math.cos(a) * l * 0.55, my = p.y + Math.sin(a) * l * 0.55; d.lineWidth = 0.32; line(d, [p, { x: mx, y: my }, { x: p.x + Math.cos(a) * l, y: p.y + Math.sin(a) * l }]); d.stroke(); d.lineWidth = 0.18; line(d, [{ x: mx, y: my }, { x: mx + Math.cos(a + 0.8) * l * 0.35, y: my + Math.sin(a + 0.8) * l * 0.35 }]); d.stroke(); }
    d.beginPath(); d.arc(p.x, p.y, 0.45, 0, Math.PI * 2); d.fillStyle = P(R[1] || R[0]); d.fill(); },
};
function label(d, p, P) { const L = p.def.label; if (!L) return; const big = p.w > 30; if (Math.cos(p.rot) < -0.2) d.rotate(Math.PI);   /* never upside down */ d.fillStyle = P(p.def.labelRole || 'wall.light'); d.font = `500 ${big ? 2.6 : 0.9}px 'IBM Plex Mono', monospace`; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText(L.toUpperCase(), 0, big ? 1.5 : p.h / 2 - 0.6); }
// a soft field from a mask function: sampled every 2 m into a tiny image, scaled up smoothly
function paintMask(c, f, R, W, color, lo, k) {
  const st = 2, x0 = Math.max(0, Math.floor(R.x0 / st) * st), y0 = Math.max(0, Math.floor(R.y0 / st) * st), x1 = Math.min(W.w, R.x1 + st), y1 = Math.min(W.h, R.y1 + st), nx = Math.ceil((x1 - x0) / st), ny = Math.ceil((y1 - y0) / st); if (nx < 1 || ny < 1) return;
  const cv = document.createElement('canvas'); cv.width = nx; cv.height = ny; const g = cv.getContext('2d'), img = g.createImageData(nx, ny), n = parseInt(color.slice(1), 16);
  let any = false; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = Math.max(0, Math.min(1, (f(x0 + (i + 0.5) * st, y0 + (j + 0.5) * st) - lo) * k)), o = (j * nx + i) * 4; img.data[o] = n >> 16; img.data[o + 1] = (n >> 8) & 255; img.data[o + 2] = n & 255; img.data[o + 3] = a * 255; if (a) any = true; }
  if (!any) return; g.putImageData(img, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(cv, x0, y0, nx * st, ny * st);
}
export const DRAWN_LOOKS = ['none', ...Object.keys(LOW), ...Object.keys(OVER)];

export function paintWorld(c, d, W, chapter, R) {
  const P = role => resolve(chapter, role), sh = h => ({ dx: -SUN.x * h * SHADOW_K, dy: -SUN.y * h * SHADOW_K * 0.8 });
  const M = 14;   // the least margin round the window; big atoms (and mast guys) widen their own
  const span = (a, b, st, lo, hi) => [Math.max(lo, Math.floor(a / st) * st), Math.min(hi, b)];
  const reach = p => Math.max(M, Math.hypot(p.w, p.h) / 2 + (p.def.guy || 0) + 2), placed = W.placed.filter(p => { const m = reach(p); return (p.x > R.x0 - m && p.x < R.x1 + m && p.y > R.y0 - m && p.y < R.y1 + m) || p.w > 2 * M; });
  // [town] districts: a role remap per district (old town red tile, the works slate); atoms without a district use P
  const PD = W.districts ? W.districts.map(dd => { const m = (dd.palette && dd.palette.roofs) || {}; return role => resolve(chapter, m[role] || role); }) : null, PF = p => (PD && p.district != null && p.def.kind === 'building' ? PD[p.district] : P);
  // ground and the land's character
  c.fillStyle = P('ground.base'); c.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
  (W.districts || []).forEach(dd => { const L = dd.palette; if (!L || !L.tint || !L.alpha) return; poly(c, dd.poly); c.globalAlpha = L.alpha; c.fillStyle = P(L.tint); c.fill(); c.globalAlpha = 1; });
  { const [ya, yb] = span(R.y0 - 8, R.y1 + 2, 6, 0, W.h), [xa, xb] = span(R.x0 - 8, R.x1 + 2, 6, 0, W.w); c.fillStyle = P('ground.field'); c.globalAlpha = 0.45; for (let y = ya; y < yb; y += 6) for (let x = xa; x < xb; x += 6) if (W.terrain.field(x, y) > 0.6) { c.beginPath(); c.arc(x + 3, y + 3, 4.6, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; }
  { const [ya, yb] = span(R.y0 - 5, R.y1 + 2, 3, 0, W.h), [xa, xb] = span(R.x0 - 5, R.x1 + 2, 3, 0, W.w); c.fillStyle = P('ground.forest'); for (let y = ya; y < yb; y += 3) for (let x = xa; x < xb; x += 3) if (W.terrain.woods(x, y) > 0.6) { c.beginPath(); c.arc(x + 1.5, y + 1.5, 2.6, 0, Math.PI * 2); c.fill(); } }
  if (W.terrain.scorch) paintMask(c, W.terrain.scorch, R, W, P('ground.gravel'), 0.45, 2.2);
  // water
  W.water.forEach(wt => { const L = wt.pts.map(p => ({ x: p.x - wt.w / 2, y: p.y })), Rr = wt.pts.map(p => ({ x: p.x + wt.w / 2, y: p.y })).reverse(); poly(c, L.concat(Rr)); c.strokeStyle = P('water.bank'); c.lineWidth = 2.4; c.stroke(); c.fillStyle = P('water.deep'); c.fill();
    c.save(); poly(c, L.concat(Rr)); c.clip(); c.strokeStyle = P('water.ripple'); c.lineWidth = 0.5; c.globalAlpha = 0.6; for (let k = -1; k <= 1; k++) { line(c, wt.pts.map(p => ({ x: p.x + k * wt.w * 0.22 + 0.8 * Math.sin(p.y / 4 + k), y: p.y }))); c.stroke(); } c.restore(); c.globalAlpha = 1; });
  // lots: lawns, yards, parking
  W.lots.forEach(l => { if ((l.kind === 'residential' || l.kind === 'terrace') && l.building) { box(c, l, l.kind === 'terrace' ? 0 : 0.8); c.fillStyle = P(l.kind === 'terrace' ? 'ground.alt' : 'ground.lawn'); c.fill(); }
    if (l.kind === 'commercial' || l.kind === 'industrial') { box(c, l, 1); c.fillStyle = P('road.lot'); c.globalAlpha = l.building ? 1 : 0.5; c.fill(); c.globalAlpha = 1;
      if (l.parking || l.kind === 'industrial') { const pk = l.parking || { ...toWorld(l, 0, -l.h / 2 + 8), w: l.w - 4, h: 12, rot: l.rot }; c.save(); c.translate(pk.x, pk.y); c.rotate(pk.rot); c.strokeStyle = P('road.lotline'); c.lineWidth = 0.15; c.beginPath(); for (let x = -pk.w / 2 + 1; x < pk.w / 2 - 1; x += 2.6) { c.moveTo(x, -pk.h / 2 + 0.6); c.lineTo(x, -pk.h / 2 + 5.2); } c.stroke(); c.restore(); } } });
  // rails: ballast, sleepers, two steel lines
  (W.rails || []).forEach(r => { c.lineCap = 'butt'; c.lineJoin = 'round'; line(c, r.pts); c.strokeStyle = P('ground.gravel'); c.lineWidth = 3.6; c.stroke(); line(c, r.pts); c.strokeStyle = P('road.kerb'); c.lineWidth = 2.6; c.setLineDash([0.22, 0.48]); c.stroke(); c.setLineDash([]);
    [-0.72, 0.72].forEach(o => { line(c, offsetLine(r.pts, o)); c.strokeStyle = P('metal'); c.lineWidth = 0.12; c.stroke(); }); });
  // streets: pavement, kerb, asphalt, markings
  const S = W.streets.filter(s => s.kind !== 'path');
  c.lineCap = 'round'; c.lineJoin = 'round';
  // footpaths: a gravel edge and a pale walk, under the streets
  W.streets.forEach(s => { if (s.kind !== 'path') return; line(c, s.pts); c.strokeStyle = P('ground.gravel'); c.lineWidth = s.w + 0.6; c.stroke(); line(c, s.pts); c.strokeStyle = P('road.walk'); c.lineWidth = s.w; c.stroke(); });
  S.forEach(s => { line(c, s.pts); if (s.walk) { c.strokeStyle = P('road.walk'); c.lineWidth = s.w + 2 * s.walk; } else { c.strokeStyle = P('road.kerb'); c.lineWidth = s.w + 1.2; } c.stroke(); });
  S.forEach(s => { if (!s.walk) return; line(c, s.pts); c.strokeStyle = P('road.kerb'); c.lineWidth = s.w + 0.35; c.stroke(); });
  S.forEach(s => { line(c, s.pts); c.strokeStyle = P('road.asphalt'); c.lineWidth = s.w; c.stroke(); });
  S.forEach(s => { c.strokeStyle = P('road.line'); if (s.marks === 'dash') { line(c, s.pts); c.lineWidth = 0.14; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
    if (s.marks === 'double') { [-0.18, 0.18].forEach(off => { line(c, offsetLine(s.pts, off)); c.lineWidth = 0.12; c.stroke(); }); } });
  // level crossings: the rails show through the asphalt
  (W.crossings || []).forEach(x => { c.save(); c.translate(x.x, x.y); c.rotate(x.rot); c.fillStyle = P('metal'); for (let k = -1; k <= 1; k += 2) c.fillRect(-x.len / 2, k * 0.72 - 0.06, x.len, 0.12); c.restore(); });
  // drives
  W.lots.forEach(l => { if (l.drive) { box(c, l.drive, 0.3); c.fillStyle = P('road.walk'); c.fill(); } });
  // bridges
  W.bridges.forEach(b => { const s = sh(1.2); box(c, { ...b, x: b.x + s.dx, y: b.y + s.dy }); c.fillStyle = P('shadow'); c.fill(); box(c, b, 0.2); c.fillStyle = P('roof.slate'); c.fill(); box(c, { ...b, h: b.h - 2 }); c.fillStyle = P('road.asphalt'); c.fill(); });
  // camp ground
  if (W.camp) { c.beginPath(); c.arc(W.camp.x, W.camp.y, W.camp.r, 0, Math.PI * 2); c.fillStyle = P('ground.field'); c.fill(); }
  // flat looks that sit on the ground (pools, ruins' floors, craters) go under the shadows
  placed.forEach(p => { const f = LOW[p.def.look]; if (f && !p.def.height) f(c, p, PF(p)); });
  // shadows of everything with height
  c.fillStyle = P('shadow');
  placed.forEach(p => { const h = p.def.height; if (!h || p.def.kind === 'street') return; const s = sh(h);
    if (p.def.look === 'tree') { const r = p.r || p.def.size[0] / 2; c.beginPath(); c.ellipse(p.x + s.dx * 0.6, p.y + s.dy * 0.6, r, r * 0.9, 0, 0, Math.PI * 2); c.fill(); return; }
    if (p.def.look === 'deadtree') { c.save(); c.strokeStyle = P('shadow'); c.lineWidth = 0.35; line(c, [p, { x: p.x + s.dx, y: p.y + s.dy }]); c.stroke(); c.restore(); return; }
    if (p.def.collide === 'circle' && p.w < 3) { c.beginPath(); c.ellipse(p.x + s.dx * 0.5, p.y + s.dy * 0.5, 0.5, 0.3, Math.atan2(s.dy, s.dx), 0, Math.PI * 2); c.fill(); return; }
    if (p.def.collide === 'circle') { c.beginPath(); c.arc(p.x + s.dx * 0.5, p.y + s.dy * 0.5, p.w / 2, 0, Math.PI * 2); c.fill(); return; }
    const pts = obbCorners(p); poly(c, convex(pts.concat(pts.map(q => ({ x: q.x + s.dx, y: q.y + s.dy }))))); c.fill(); });
  // segment shadows: walls cast a thin band
  W.fences.forEach(f => { if (!f.def || !f.def.height || f.def.height < 2) return; const s = sh(f.def.height); poly(c, [f.a, f.b, { x: f.b.x + s.dx, y: f.b.y + s.dy }, { x: f.a.x + s.dx, y: f.a.y + s.dy }]); c.fill(); });
  // low props with height: lamps, cars, rings, nests
  placed.forEach(p => { const f = LOW[p.def.look]; if (f && p.def.height) f(c, p, PF(p)); });
  // fences and walls (segment atoms): a line plus posts
  W.fences.forEach(f => { const def = f.def; c.strokeStyle = P(def ? def.roles[0] : 'fence'); c.lineWidth = def && def.thick ? def.thick : 0.16; c.lineCap = def && def.thick ? 'square' : 'butt'; line(c, [f.a, f.b]); c.stroke();
    if (def && def.posts === false) return; c.fillStyle = c.strokeStyle; const L = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y); for (let k = 0; k <= L; k += 2) { const t = k / L; c.fillRect(f.a.x + (f.b.x - f.a.x) * t - 0.13, f.a.y + (f.b.y - f.a.y) * t - 0.13, 0.26, 0.26); } });
  // overhead: roofs, then canopies
  placed.forEach(p => { if (p.def.layer === 'roof') { const f = OVER[p.def.look]; if (f) f(d, p, PF(p)); } });
  placed.forEach(p => { if (p.def.layer === 'canopy') { const f = OVER[p.def.look]; if (f) f(d, p, P); } });
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
  if (which.lots) { W.lots.forEach(l => { poly(c, obbCorners(l)); c.strokeStyle = l.kind === 'park' ? 'rgba(90,140,60,0.9)' : l.kind === 'residential' || l.kind === 'terrace' ? 'rgba(61,90,128,0.9)' : 'rgba(180,120,40,0.9)'; c.lineWidth = 0.22; c.setLineDash([1, 0.6]); c.stroke(); c.setLineDash([]); const f = W.lotFront(l); line(c, [f.a, f.b]); c.lineWidth = 0.5; c.stroke(); }); }
  if (which.sockets) {
    const dot = (p, col, r) => { c.beginPath(); c.arc(p.x, p.y, r || 0.6, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
    W.nodes.forEach(n => { dot(n, '#7F3FBF', 1.1); });
    W.lots.forEach(l => { if (l.driveMouth) dot(l.driveMouth, '#E3B23C', 0.7); });
    W.placed.forEach(p => { if (p.door) { dot(p.door, '#2F86A6', 0.7); c.strokeStyle = '#2F86A6'; c.lineWidth = 0.15; line(c, [p.door, { x: p.x, y: p.y }]); c.stroke(); }
      if (p.def.tags.includes('street-tree')) dot(p, '#3B8F3B', 0.45); if (p.def.look === 'lamp') dot(p, '#F0A020', 0.45);
      if (p.def.sockets.some(s => s.type === 'party.wall')) [-1, 1].forEach(sd => dot(toWorld(p, sd * p.w / 2, 0), '#D64545', 0.4)); });
    (W.rails || []).forEach(r => (r.ends || []).forEach(e => dot(e, '#B03A8F', 0.9)));
    W.bridges.forEach(b => { obbCorners(b).forEach(q => dot(q, '#B03A8F', 0.5)); });
  }
}
