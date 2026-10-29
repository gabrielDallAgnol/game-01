// [roam] Life and litter: the small movements that make the dead town breathe. Crows (where there is death: thick in the
// ruins and round the nests, a few in worn streets, rare where it is tended), paper the town dropped when it left in a hurry
// (lifted by the gusts, tumbling a few metres, settling), and fallen leaves (swept away where someone still sweeps, drifting
// against kerbs where nobody does, everywhere under the trees in the ruins). All of it is render-side: lives keep their
// state on inst.st, never the sim's; they init lazily (the loop only steps what is near the camera) and allocate nothing
// per frame. Soft things are strokes on the overlay; the leaf piles are ground marks too.
const S = 1.3;   // props are 1.3x life (K.S)
// the grass's own wind (ground.js gust(), ported): the same gust bands, moving with the same time, so a sheet lifts when
// the grass round it bends
const fr = x => x - Math.floor(x);
const h21 = (x, y) => { x = fr(x * 123.34); y = fr(y * 456.21); const d = x * (x + 45.32) + y * (y + 45.32); x += d; y += d; return fr(x * y); };
const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y); let u = x - i, v = y - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = h21(i, j), b = h21(i + 1, j), c = h21(i, j + 1), d = h21(i + 1, j + 1); return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v; };
const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const WX = 0.731, WY = 0.682;
const gust = (x, y, t) => ss(0.3, 0.85, vn(x * 0.045 - WX * t * 0.55, y * 0.045 - WY * t * 0.55) * 0.7 + vn(x * 0.12 - WX * t * 0.95, y * 0.12 - WY * t * 0.95) * 0.3);
const hh = (a, b) => fr(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
// how much of the soft overlay to show at this zoom: whole at the default camera, gone when the town is a map (cam.base 6)
const vis = v => ss(7, 12, v.cam.ppm);
const sx = (v, x) => (x - v.cam.x) * v.cam.ppm + v.cssW / 2, sy = (v, y) => (y - v.cam.y) * v.cam.ppm + v.cssH / 2;
// the crowns, by town (a grid built once): leaves under a crown are hidden by it, so none are drawn there
const crownsOf = new WeakMap();
const underCrown = (town, x, y) => { let g = crownsOf.get(town); if (!g) { g = new Map(); for (const p of town.trees || []) { const k = Math.floor(p.x / 12) + ',' + Math.floor(p.y / 12); if (!g.has(k)) g.set(k, []); g.get(k).push(p); } crownsOf.set(town, g); }
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const p of g.get((Math.floor(x / 12) + i) + ',' + (Math.floor(y / 12) + j)) || []) if (Math.hypot(p.x - x, p.y - y) < (p.r || p.def.size[0] / 2) * 0.86) return true; return false; };

// ---------- crows ----------
// a flock of 3–7 perched or pecking; within ~7 m of Kai (11 on the bike) they burst up, fly off downwind and away from her
// in an arc, circle once and land on a roof or a tree nearby. At night they roost: no hopping, unless startled.
// per bird, 10 floats: ox, oy (off the flock's middle), hd (heading), act (time to the next hop or peck), kind (1 hop, 2 peck),
// k (0..1 through it), px, py, z (in flight), delay (its beat behind the flock)
const crowFit = (tended, worn, ruined) => (c, s) => s.crown && s.kind !== 'tree' ? 0 : c > 0.62 ? tended : c > 0.32 ? worn : ruined;
function crowInit(i) { const n = 3 + Math.floor(i.h * 5), b = new Float32Array(n * 10), rr = i.slot.kind === 'roof' ? Math.min(1.8, Math.min(i.slot.w || 4, i.slot.h || 4) * 0.3) : i.slot.kind === 'tree' ? Math.min(1.6, (i.slot.r || 2) * 0.5) : 1.1;
  for (let k = 0; k < n; k++) { const a = hh(i.h, k) * 6.283, r = Math.sqrt(hh(k, i.h)) * rr, o = k * 10; b[o] = Math.cos(a) * r; b[o + 1] = Math.sin(a) * r; b[o + 2] = hh(i.h * 3, k) * 6.283; b[o + 3] = hh(k * 7, i.h) * 3; }
  i.st = { x: i.x, y: i.y, n, b, rr, fly: 0, ft: 0, T1: 1, T2: 2, p0x: 0, p0y: 0, cx: 0, cy: 0, p1x: 0, p1y: 0, a0: 0, cool: 0, tx: i.x, ty: i.y }; }
// the flock's path in the air: a curve out to the target's side, a shrinking circle round it, down
const R2 = 3.6;
function crowAt(st, ft, out) { if (ft < st.T1) { const u = ft / st.T1, w = 1 - u; out[0] = w * w * st.p0x + 2 * w * u * st.cx + u * u * st.p1x; out[1] = w * w * st.p0y + 2 * w * u * st.cy + u * u * st.p1y; }
  else { const k = Math.min(1, (ft - st.T1) / st.T2), a = st.a0 + k * 6.283 * (st.T2 > 0 ? 1 : 0), r = R2 * (1 - k); out[0] = st.tx + Math.cos(a) * r; out[1] = st.ty + Math.sin(a) * r; }
  const q = Math.min(1, ft / (st.T1 + st.T2)); out[2] = 5.5 * Math.pow(Math.sin(Math.PI * q), 0.6); }
const tmp = new Float64Array(3), tmp2 = new Float64Array(3);
function crowStart(i, st, ctx) { const kx = ctx.kai.x, ky = ctx.kai.y, W = ctx.WIND, sl = ctx.town.slots && ctx.town.slots.by || {};
  let ax = st.x - kx, ay = st.y - ky; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
  let best = null, bs = -9;
  for (const kind of ['roof', 'tree']) for (const s of sl[kind] || []) { const dx = s.x - st.x, dy = s.y - st.y; if (Math.abs(dx) > 40 || Math.abs(dy) > 40) continue; const d = Math.hypot(dx, dy); if (d < 14 || d > 38) continue;
    const sc = (dx * ax + dy * ay) / d * 0.6 + (dx * W.x + dy * W.y) / d * 0.4 + (1 - s.care) * 0.3 + Math.random() * 0.5 - (Math.hypot(s.x - kx, s.y - ky) < 12 ? 2 : 0); if (sc > bs) { bs = sc; best = s; } }
  const tx = best ? best.x : st.x + (ax * 0.6 + W.x * 0.4) * 24, ty = best ? best.y : st.y + (ay * 0.6 + W.y * 0.4) * 24;
  st.rr = best && best.kind === 'roof' ? Math.min(1.8, Math.min(best.w || 4, best.h || 4) * 0.3) : best ? Math.min(1.6, (best.r || 2) * 0.5) : 1.2;
  st.tx = tx; st.ty = ty; const dx = tx - st.x, dy = ty - st.y, d = Math.hypot(dx, dy) || 1, side = Math.random() < 0.5 ? -1 : 1;
  st.a0 = Math.atan2(st.y - ty, st.x - tx) + side * 0.9; st.p0x = st.x; st.p0y = st.y; st.p1x = tx + Math.cos(st.a0) * R2; st.p1y = ty + Math.sin(st.a0) * R2;
  st.cx = (st.x + st.p1x) / 2 - dy / d * side * d * 0.35; st.cy = (st.y + st.p1y) / 2 + dx / d * side * d * 0.35; st.T1 = d / 8.5 + 0.5; st.T2 = 2.2; st.ft = 0; st.fly = 1;
  for (let k = 0; k < st.n; k++) st.b[k * 10 + 9] = Math.random() * 0.35; }   // each bird goes a beat apart
function crowStep(i, dt, ctx) { const st = i.st, b = st.b, n = st.n, kai = ctx.kai, roost = ctx.night > 0.6;
  if (i.slot.kind === 'door' && !st.up) { st.up = 1; const r = (ctx.town.slots && ctx.town.slots.by.roof || []).find(q => q.uid === i.slot.uid);   // the house's roof
    if (r) { st.x = st.tx = r.x; st.y = st.ty = r.y; st.rr = Math.min(1.8, Math.min(r.w || 4, r.h || 4) * 0.3); } }
  st.cool -= dt;
  if (!st.fly) { const d = Math.hypot(kai.x - st.x, kai.y - st.y), R = (kai.riding ? 11 : 7) * (roost ? 0.75 : 1);
    if (d < R && st.cool <= 0) crowStart(i, st, ctx);
    else if (!roost) for (let k = 0; k < n; k++) { const o = k * 10; b[o + 3] -= dt;   // idle: now a hop, now a peck
      if (b[o + 4]) { b[o + 5] += dt / (b[o + 4] === 1 ? 0.28 : 0.45); if (b[o + 5] >= 1) { b[o + 4] = 0; b[o + 5] = 0; } else if (b[o + 4] === 1) { b[o] += Math.cos(b[o + 2]) * dt * 0.9; b[o + 1] += Math.sin(b[o + 2]) * dt * 0.9; } }
      else if (b[o + 3] <= 0) { b[o + 3] = 0.8 + Math.random() * 2.6; const r = Math.hypot(b[o], b[o + 1]);
        if (Math.random() < 0.45) { b[o + 4] = 1; b[o + 2] = r > st.rr ? Math.atan2(-b[o + 1], -b[o]) + (Math.random() - 0.5) : b[o + 2] + (Math.random() - 0.5) * 2.4; } else b[o + 4] = 2; } }
    return; }
  st.ft += dt; const end = st.T1 + st.T2;
  for (let k = 0; k < n; k++) { const o = k * 10, f = Math.max(0, st.ft - b[o + 9]); crowAt(st, Math.min(end, f), tmp); crowAt(st, Math.min(end, f + 0.06), tmp2);
    const sp = tmp[2] / 5.5, wob = Math.sin(ctx.t * 2.1 + k * 1.9) * 0.6 * sp;
    b[o + 6] = tmp[0] + b[o] * (1 + sp * 0.8) + wob; b[o + 7] = tmp[1] + b[o + 1] * (1 + sp * 0.8) - wob * 0.6; b[o + 8] = tmp[2];
    const hx = tmp2[0] - tmp[0], hy = tmp2[1] - tmp[1]; if (hx * hx + hy * hy > 1e-6) b[o + 2] = Math.atan2(hy, hx); }
  crowAt(st, Math.min(end, st.ft), tmp); st.x = tmp[0]; st.y = tmp[1];
  if (st.ft > end + 0.4) { st.fly = 0; st.x = st.tx; st.y = st.ty; st.cool = 1.5;
    for (let k = 0; k < n; k++) { const o = k * 10, r = Math.hypot(b[o], b[o + 1]), f = r > st.rr ? st.rr / r : 1; b[o] *= f; b[o + 1] *= f; b[o + 3] = 0.5 + Math.random() * 2; b[o + 4] = 0; b[o + 5] = 0; b[o + 8] = 0; } } }
let pX = 0, pY = 0, pc = 1, ps = 0, pl = 1, pfx = null;   // the pen: a bird's frame on screen (no closures per frame)
const P = (al, ac) => pfx.lineTo(pX + (pc * al - ps * ac) * pl, pY + (ps * al + pc * ac) * pl), Mv = (al, ac) => pfx.moveTo(pX + (pc * al - ps * ac) * pl, pY + (ps * al + pc * ac) * pl);
function crowDraw(fx, i, v) { const a0 = vis(v); if (a0 < 0.02) return; const st = i.st, b = st.b, ppm = v.cam.ppm, L = 0.62 * S * ppm, t = v.t, roost = v.night > 0.6 && !st.fly;
  fx.lineCap = 'round'; fx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < st.n; k++) { const o = k * 10, air = st.fly ? b[o + 8] : 0;
    if (pass === 0 && air < 0.05) continue;   // the shadow on the ground, under a bird in the air
    const wx = st.fly ? b[o + 6] : st.x + b[o], wy = st.fly ? b[o + 7] : st.y + b[o + 1];
    const X = sx(v, wx) + (pass ? 0 : air * 0.5 * ppm), Y = sy(v, wy) + (pass ? 0 : air * 0.65 * ppm), l = L * (1 + air * 0.035 * pass), hd = b[o + 2], c = Math.cos(hd), s = Math.sin(hd);
    if (X < -40 || Y < -40 || X > v.cssW + 40 || Y > v.cssH + 40) continue;
    pfx = fx; pX = X; pY = Y; pc = c; ps = s; pl = l;
    const ink = pass ? (k % 3 ? '#17171b' : '#232227') : 'rgba(0,0,0,0.3)';
    fx.globalAlpha = a0 * (pass ? (air > 0.05 || !roost ? 1 : 0.85) : Math.max(0, 1 - air / 9));
    fx.strokeStyle = ink;
    if (st.fly && air > 0.05) {   // in flight: the wings as strokes, flapping (seen from above, the span opens and shuts)
      const ph = t * (b[o + 8] > 4 ? 9 : 15) + k * 1.3, span = 0.45 + 0.55 * Math.abs(Math.sin(ph)), sw = 0.08 * Math.cos(ph);
      fx.lineWidth = Math.max(1.4, 0.2 * l); fx.beginPath(); Mv(0.08, 0); P(-0.02 + sw, 0.55 * span); P(-0.2 + sw * 2, 1.05 * span); Mv(0.08, 0); P(-0.02 + sw, -0.55 * span); P(-0.2 + sw * 2, -1.05 * span); fx.stroke();
      fx.lineWidth = Math.max(1.8, 0.3 * l); fx.beginPath(); Mv(-0.42, 0); P(0.34, 0); fx.stroke();
      fx.lineWidth = Math.max(1, 0.12 * l); fx.beginPath(); Mv(-0.4, 0); P(-0.62, 0.12); Mv(-0.4, 0); P(-0.62, -0.12); fx.stroke();
    } else {   // perched: a dark body, a head (forward and down when it pecks, tucked in when it roosts), a hint of sheen
      const pk = b[o + 4] === 2 ? Math.sin(Math.PI * b[o + 5]) : 0, hop = b[o + 4] === 1 ? Math.sin(Math.PI * b[o + 5]) : 0, hl = roost ? 0.28 : 0.42 + pk * 0.14;
      const bw = (roost ? 0.24 : 0.18) * (1 + hop * 0.08), bf = roost ? 0.22 : 0.3;
      fx.fillStyle = ink; fx.beginPath(); Mv(-0.3, -0.08); P(-0.66, -0.17); P(-0.7, 0); P(-0.66, 0.17); P(-0.3, 0.08); fx.closePath(); fx.fill();   // the tail, a wedge
      fx.beginPath(); fx.ellipse(X + c * (bf - 0.36) * 0.5 * l, Y + s * (bf - 0.36) * 0.5 * l, (bf + 0.36) * 0.5 * l, bw * l, hd, 0, 6.283); fx.fill();   // the body
      fx.beginPath(); fx.arc(X + c * hl * l, Y + s * hl * l, Math.max(1.6, 0.14 * l * (1 - pk * 0.2)), 0, 6.283); fx.fill();
      if (!roost) { fx.strokeStyle = '#4a4844'; fx.lineWidth = Math.max(1, 0.06 * l); fx.beginPath(); Mv(hl + 0.1, 0); P(hl + 0.26 + pk * 0.06, 0); fx.stroke(); }
      fx.strokeStyle = ink; fx.lineWidth = Math.max(1, 0.08 * l); fx.beginPath(); Mv(0.05, bw * 0.7); P(-0.6, 0.04); Mv(0.05, -bw * 0.7); P(-0.6, -0.04); fx.stroke();   // the folded wings, tips crossed over the tail
      fx.strokeStyle = 'rgba(104,114,136,0.55)'; fx.lineWidth = Math.max(0.8, 0.04 * l); fx.beginPath(); Mv(0.08, bw * 0.45); P(-0.36, bw * 0.3); Mv(0.08, -bw * 0.45); P(-0.36, -bw * 0.3); fx.stroke(); } }
  fx.globalAlpha = 1; }
const CROW = { init: crowInit, step: crowStep, draw: crowDraw };

// ---------- paper ----------
// a few sheets lie still; a gust (the grass's gust, at the sheet) lifts one and tumbles it a few metres along the street,
// flipping (a pale quad that thins to its edge as it turns), and it settles again. Leaflets carry the evacuation's orange band.
const PB = 12;   // per sheet: x, y, z, vx, vy, yaw, flip, fv, air (0/1), ft, dur, cool
const litterFit = (tended, worn, ruined) => (c, s) => s.crown || s.path ? 0 : c > 0.62 ? tended : c > 0.32 ? worn : ruined;
function paperInit(i) { const n = i.variant === 'leaflets' ? 3 : 1 + Math.floor(i.h * 2.2), b = new Float32Array(n * PB), ca = Math.cos(i.ang), sa = Math.sin(i.ang);
  for (let k = 0; k < n; k++) { const o = k * PB, al = (hh(i.h, k) - 0.5) * 2.2, ac = (hh(k, i.h) - 0.5) * 0.7; b[o] = i.x + ca * al - sa * ac; b[o + 1] = i.y + sa * al + ca * ac; b[o + 5] = hh(i.h * 5, k) * 6.283; b[o + 6] = hh(k, i.h * 3) < 0.25 ? Math.PI : 0; b[o + 11] = hh(k * 3, i.h) * 4; }
  i.st = { x: i.x, y: i.y, n, b, rest: b.slice(), far: 0 }; }
function paperStep(i, dt, ctx) { const st = i.st, b = st.b, W = ctx.WIND, t = ctx.t, bl = ctx.town.blocked;
  // gone far and out of sight: the street gets its litter back where it was (nobody sees it come home)
  if (Math.hypot(ctx.kai.x - i.x, ctx.kai.y - i.y) > 48) { if (!st.far) { b.set(st.rest); st.far = 1; } return; } st.far = 0;
  let mx = i.x, my = i.y;
  for (let k = 0; k < st.n; k++) { const o = k * PB, g = gust(b[o], b[o + 1], t);
    if (!b[o + 8]) { b[o + 11] -= dt;
      if (b[o + 11] <= 0 && g > 0.55 + hh(k, i.h) * 0.3 && Math.random() < dt * 1.2 && Math.hypot(b[o] - i.x, b[o + 1] - i.y) < 13) {
        b[o + 8] = 1; b[o + 9] = 0; b[o + 10] = 1.1 + Math.random() * 1.9; b[o + 7] = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 8); b[o + 3] = W.x * 1.5; b[o + 4] = W.y * 1.5; } }
    else { const f = b[o + 9] / b[o + 10], spd = 1.4 + 3.2 * g, wob = Math.sin(t * 3.1 + k * 2.3) * 1.1;
      b[o + 3] += (W.x * spd - W.y * wob - b[o + 3]) * Math.min(1, dt * 3); b[o + 4] += (W.y * spd + W.x * wob - b[o + 4]) * Math.min(1, dt * 3);
      const nx = b[o] + b[o + 3] * dt * (1 - f * 0.5), ny = b[o + 1] + b[o + 4] * dt * (1 - f * 0.5), hit = bl && bl(nx, ny);
      if (!hit) { b[o] = nx; b[o + 1] = ny; }
      b[o + 2] = (0.35 + 0.5 * g) * Math.sin(Math.PI * f); b[o + 6] += b[o + 7] * dt * (1 - f * 0.6); b[o + 5] += b[o + 7] * 0.25 * dt; b[o + 9] += dt;
      if (f >= 1 || hit) { b[o + 8] = 0; b[o + 2] = 0; b[o + 6] = Math.round(b[o + 6] / Math.PI) * Math.PI; b[o + 11] = 3 + Math.random() * 7; } }   // it settles flat, face up or face down
    if (k === 0) { mx = b[o]; my = b[o + 1]; } }
  st.x = mx; st.y = my; }
const quad = (fx, ox, oy, cy, sy, w, hl) => { fx.beginPath(); fx.moveTo(ox + cy * w - sy * hl, oy + sy * w + cy * hl); fx.lineTo(ox + cy * w + sy * hl, oy + sy * w - cy * hl); fx.lineTo(ox - cy * w + sy * hl, oy - sy * w - cy * hl); fx.lineTo(ox - cy * w - sy * hl, oy - sy * w + cy * hl); fx.closePath(); };
function paperDraw(fx, i, v) { const a0 = vis(v); if (a0 < 0.02) return; const st = i.st, b = st.b, ppm = v.cam.ppm, dim = 1 - 0.78 * v.night, kind = i.variant, old = i.care < 0.32;
  const hw = (kind === 'news' ? 0.21 : 0.15) * S * ppm, hl = (kind === 'news' ? 0.3 : 0.21) * S * ppm;
  fx.lineJoin = 'round';
  for (let k = 0; k < st.n; k++) { const o = k * PB, X = sx(v, b[o]), Y = sy(v, b[o + 1]), z = b[o + 2];
    if (X < -30 || Y < -30 || X > v.cssW + 30 || Y > v.cssH + 30) continue;
    const cy = Math.cos(b[o + 5]), sy2 = Math.sin(b[o + 5]), cf = Math.cos(b[o + 6]), w = hw * Math.max(0.06, Math.abs(cf)), lift = z * ppm;
    if (z > 0.02) { fx.globalAlpha = a0 * 0.28; fx.fillStyle = '#000'; quad(fx, X + lift * 0.5, Y + lift * 0.65, cy, sy2, w, hl); fx.fill(); }
    const s = 1 + z * 0.08, face = cf >= 0;
    fx.globalAlpha = a0 * dim * (z > 0.02 ? 0.95 : 0.85); fx.fillStyle = face ? (old ? '#b8b2a2' : '#cdc8ba') : (old ? '#958f80' : '#a7a294'); fx.strokeStyle = '#7f7a6e'; fx.lineWidth = 1;
    fx.save(); fx.translate(X, Y); fx.scale(s, s); quad(fx, 0, 0, cy, sy2, w, hl); fx.fill(); fx.stroke();
    if (face && Math.abs(cf) > 0.3) { const ex = cy * w * 0.8, ey = sy2 * w * 0.8;   // the print: an orange band, or lines of type (across the sheet, foreshortened with it)
      if (kind === 'leaflets') { fx.strokeStyle = old ? 'rgba(196,110,52,0.75)' : 'rgba(226,122,48,0.85)'; fx.lineWidth = Math.max(1, hl * 0.22); const ax = -sy2 * hl * 0.62, ay = cy * hl * 0.62; fx.beginPath(); fx.moveTo(ax - ex, ay - ey); fx.lineTo(ax + ex, ay + ey); fx.stroke(); }
      else { fx.strokeStyle = 'rgba(90,86,78,0.6)'; fx.lineWidth = 0.8; fx.beginPath(); for (let r = 0; r < 3; r++) { const al = hl * (0.45 - r * 0.32), ax = -sy2 * al, ay = cy * al; fx.moveTo(ax - ex, ay - ey); fx.lineTo(ax + ex, ay + ey); } fx.stroke(); } }
    fx.restore(); }
  fx.globalAlpha = 1; }
const PAPER = { init: paperInit, step: paperStep, draw: paperDraw };
const paperVariant = (c, h) => c < 0.32 ? (h < 0.4 ? 'leaflets' : h < 0.7 ? 'news' : 'sheets') : (h < 0.25 ? 'leaflets' : h < 0.5 ? 'news' : 'sheets');

// ---------- leaves ----------
// at a tree's foot: a dark, warm ground mark spilling downwind from under the crown, and a few leaf strokes that lift and
// skitter in the gusts and fall back. swept (tended: a few), drift (worn: banked up), strewn (ruined, or a storm's tree: everywhere)
const LEAFC = ['#7a5c36', '#8d6b3c', '#655634', '#94743f', '#5c4a30'];
const leafN = { swept: 3, drift: 6, strewn: 9 };
function leafSpot(i, k, out) { const s = i.slot, h = i.h, a = hh(h, k), b = hh(k + 0.5, h), r = s.kind === 'tree' ? (s.r || 2) : 0;
  if (i.atom.id === 'leafDrift') { const al = (a - 0.5) * 3.2, ac = 0.15 + b * 0.35, ca = Math.cos(i.ang), sa = Math.sin(i.ang); out[0] = i.x + ca * al + (s.nx || 0) * ac; out[1] = i.y + sa * al + (s.ny || 0) * ac; return; }
  if (r) { const th = Math.atan2(WY, WX) + (a - 0.5) * (i.variant === 'strewn' ? 6.2 : i.variant === 'drift' ? 2.6 : 1.6), rr = r * 1.02 + b * (i.variant === 'swept' ? 0.6 : 1.8); out[0] = i.x + Math.cos(th) * rr; out[1] = i.y + Math.sin(th) * rr; return; }
  const th = a * 6.283, rr = Math.sqrt(b) * 2.2, ca = Math.cos(i.ang), sa = Math.sin(i.ang), lx = Math.cos(th) * rr * 1.5, ly = Math.sin(th) * rr * 0.8; out[0] = i.x + ca * lx - sa * ly; out[1] = i.y + sa * lx + ca * ly; }
const spot = new Float64Array(2);
function leafInit(i) { const n = leafN[i.variant] || 5, b = new Float32Array(n * 4); let m = 0;
  for (let k = 0; k < n; k++) { leafSpot(i, k, spot); if (i._town && underCrown(i._town, spot[0], spot[1])) continue; const o = m * 4; b[o] = spot[0]; b[o + 1] = spot[1]; b[o + 2] = hh(k, i.h * 7) * 6.283; b[o + 3] = hh(k * 5, i.h); m++; }
  i.st = { x: i.x, y: i.y, n: m, b }; }
const LEAF = { init: i => { i.st = { x: i.x, y: i.y, n: 0, b: null }; }, step(i, dt, ctx) { if (!i.st.b) { i._town = ctx.town; leafInit(i); } },   // the crowns are known at the first step
  draw(fx, i, v) { const a0 = vis(v), st = i.st; if (a0 < 0.02 || !st.b) return; const b = st.b, ppm = v.cam.ppm, t = v.t, l = 0.1 * S * ppm, W = v.WIND, dim = 1 - 0.7 * v.night;
    fx.lineCap = 'round';
    for (let k = 0; k < st.n; k++) { const o = k * 4, ph = b[o + 3], g = ss(0.5, 0.95, gust(b[o], b[o + 1], t)) * (0.5 + ph), sk = Math.sin(t * 6 + ph * 20);
      const dx = W.x * g * 0.9 - W.y * sk * 0.18 * g, dy = W.y * g * 0.9 + W.x * sk * 0.18 * g, z = g * 0.35 * (0.6 + 0.4 * Math.sin(t * 9 + ph * 13));
      const X = sx(v, b[o] + dx), Y = sy(v, b[o + 1] + dy), a = b[o + 2] + g * Math.sin(t * 4 + ph * 9) * 2.5, c = Math.cos(a) * l, s = Math.sin(a) * l * (1 - 0.6 * g * Math.abs(sk));
      if (X < -20 || Y < -20 || X > v.cssW + 20 || Y > v.cssH + 20) continue;
      if (z > 0.04) { fx.globalAlpha = a0 * 0.25; fx.strokeStyle = '#000'; fx.lineWidth = Math.max(1.2, l * 0.55); fx.beginPath(); fx.moveTo(X - c + z * ppm * 0.5, Y - s + z * ppm * 0.65); fx.lineTo(X + c + z * ppm * 0.5, Y + s + z * ppm * 0.65); fx.stroke(); }
      fx.globalAlpha = a0 * dim * 0.9; fx.strokeStyle = LEAFC[k % LEAFC.length]; fx.lineWidth = Math.max(2, l * 0.95); fx.beginPath(); fx.moveTo(X - c * 0.7, Y - s * 0.7); fx.lineTo(X + c * 0.7, Y + s * 0.7); fx.stroke();
      fx.globalAlpha = a0 * dim * 0.45; fx.strokeStyle = '#3d3222'; fx.lineWidth = Math.max(0.5, l * 0.1); fx.beginPath(); fx.moveTo(X - c * 1.15, Y - s * 1.15); fx.lineTo(X + c * 0.6, Y + s * 0.6); fx.stroke(); }   // the stalk and midrib
    fx.globalAlpha = 1; } };
// the ground mark: soft dark blobs, warm at their hearts (g dark, a little r), where the leaves lie thickest
function leafPaint(g, i) { const s = i.slot, r = s.kind === 'tree' ? (s.r || 2) : 0, v = i.variant, drift = i.atom.id === 'leafDrift', n = drift ? 7 : v === 'strewn' ? 14 : v === 'drift' ? 9 : 4, a = v === 'strewn' ? 1 : v === 'drift' ? 0.8 : 0.45;
  for (let k = 0; k < n; k++) { leafSpot(i, k + 40, spot); const x = spot[0], y = spot[1], rad = (drift ? 0.5 : r ? 0.6 : 0.8) + hh(k, i.h * 9) * (v === 'swept' ? 0.3 : 0.7);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(34,96,0,${0.9 * a})`); gr.addColorStop(0.6, `rgba(18,60,0,${0.55 * a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill(); } }
const leafVariant = (c, h, s) => s && s.kind !== 'tree' && s.kind !== 'kerb' ? 'strewn' : c > 0.62 ? 'swept' : c > 0.32 ? 'drift' : 'strewn';

export const LIFE = [
  // crows gather where there is death: on the roofs of the ruins and round the nests, a few in worn streets, rare where kept
  // (placed by the house's door, since a roof's ground is never free to the placer; the flock flies up to its roof at once)
  { id: 'crows', family: 'life', slot: 'door', every: 34, chance: 0.5, fit: crowFit(0.03, 0.22, 0.85), live: CROW },
  { id: 'crowsTree', family: 'life', slot: 'tree', every: 48, chance: 0.12, fit: crowFit(0.02, 0.18, 0.7), live: CROW },
  // on the road they are at something dead (the dark stain they peck at)
  { id: 'crowsRoad', family: 'life', slot: 'roadway', every: 70, chance: 0.12, fit: crowFit(0, 0.08, 0.6), live: CROW,
    paint(g, i) { const gr = g.createRadialGradient(i.x, i.y, 0, i.x, i.y, 0.9); gr.addColorStop(0, 'rgba(20,80,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(i.x, i.y, 0.9, 0.55, i.ang + i.h, 0, 6.283); g.fill(); } },
];
export const LITTER = [
  // the town left in a hurry: paper on the pavements and along the walls, more the further gone a street is, none where swept
  { id: 'paper', family: 'litter', slot: 'pavement', every: 13, chance: 0.14, fit: litterFit(0.02, 0.45, 0.85), variant: paperVariant, live: PAPER },
  { id: 'paperWall', family: 'litter', slot: 'wall', every: 17, chance: 0.08, fit: litterFit(0.01, 0.35, 0.7), variant: paperVariant, live: PAPER },
  // leaf piles at the trees' feet (a fallen tree's story drops them on the road, strewn)
  { id: 'leaves', family: 'litter', slot: 'tree', every: 6, chance: 0.9, fit: c => c > 0.62 ? 0.3 : c > 0.32 ? 0.85 : 1, variant: leafVariant, paint: leafPaint, live: LEAF },
  // where nobody sweeps, the leaves bank up in the gutters, under the street trees first
  { id: 'leafDrift', family: 'litter', slot: 'kerb', every: 11, chance: 0.3, fit: (c, s) => s.path ? 0 : (c > 0.62 ? 0 : c > 0.32 ? 0.5 : 0.75) * (s.crown ? 1 : 0.3), variant: leafVariant, paint: leafPaint, live: LEAF },
];
