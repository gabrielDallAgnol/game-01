// [roam] Laying the open ground's things (atoms/wilds.js) on the Point: the grass between the fields, the lanes and the
// rivers had nothing on it. Deterministic (hashes of the seed). Two power lines cross the land in straight runs (a pylon
// every 64 m where the ground allows, a few toppled near Wendbridge where the fighting was); billboards stand by the
// lanes; the rest is a jittered 30 m grid over open ground, each cell maybe one thing (the camera sees ~25 x 45 m), chosen by where it is:
// machine husks and stomp craters toward the bridge, the flight (carts, camps, the bus) along the way to the Point,
// rocks and dead trees anywhere. Returns dress instances ({ atom, id, x, y, ang, h, care, variant }).
import { WILDS } from '../atoms/wilds.js';
import { hash } from '../dress/place.js';
export function layoutWilds({ W, blocked, onStreet, slots, buildings, trees, care }) {
  const out = [], seed = W.seed || 7, P = W.world || {}, home = P.home || W.camp, bridge = (W.decks || [])[0] || P.coil || home;
  const field = new Set(); for (const s of slots.by.field || []) field.add(Math.floor(s.x / 16) * 4096 + Math.floor(s.y / 16));
  const bgrid = new Map(), BG = 40; for (const b of buildings) { const k = Math.floor(b.x / BG) * 4096 + Math.floor(b.y / BG); if (!bgrid.has(k)) bgrid.set(k, []); bgrid.get(k).push(b); }
  const nearB = (x, y, r) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const b of bgrid.get((Math.floor(x / BG) + i) * 4096 + Math.floor(y / BG) + j) || []) if (Math.hypot(b.x - x, b.y - y) < r + Math.max(b.w, b.h) / 2) return true; return false; };
  const tgrid = new Set(); for (const t of trees) tgrid.add(Math.floor(t.x / 8) * 4096 + Math.floor(t.y / 8));
  const keepOff = [home, P.tomas, P.reyes, P.ines, P.scrubber, P.van, P.coil].filter(Boolean);
  const clear = (x, y, r) => { if (x < 30 || y < 30 || x > W.w - 30 || y > W.h - 30) return false; if (blocked(x, y)) return false;
    for (let k = 0; k < 6; k++) { const a = k * 1.047; if (blocked(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false; }
    if (onStreet(x, y, r + 2)) return false; if (nearB(x, y, r + 6)) return false; if (tgrid.has(Math.floor(x / 8) * 4096 + Math.floor(y / 8))) return false;
    return !keepOff.some(p => Math.hypot(p.x - x, p.y - y) < 45); };
  const taken = []; const room = (x, y, r) => !taken.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r);
  const add = (id, x, y, ang, r, variant, extra = {}) => { const h = hash(seed, x, y, id.length, out.length * 0.001), inst = { atom: WILDS[id], id: 'w' + out.length, x, y, ang, h, care: care ? care.at(x, y) : 0.5, variant, slot: {}, ...extra }; out.push(inst); taken.push({ x, y, r }); return inst; };
  // the power lines
  const LINES = [[{ x: 0.04, y: 0.36 }, { x: 0.96, y: 0.72 }], [{ x: 0.3, y: 0.97 }, { x: 0.82, y: 0.06 }]];
  for (const [a0, b0] of LINES) { const ax = a0.x * W.w, ay = a0.y * W.h, bx = b0.x * W.w, by = b0.y * W.h, L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax); let prev = null;
    for (let s = 0; s <= L; s += 64) { const x = ax + (bx - ax) * s / L, y = ay + (by - ay) * s / L;
      if (!clear(x, y, 3) || !room(x, y, 4)) { prev = null; continue; }
      const nearFight = Math.hypot(x - bridge.x, y - bridge.y) < 420, down = hash(seed, x, y, 31) < (nearFight ? 0.3 : 0.06);
      const p = add('pylon', x, y, ang + Math.PI / 2, 4, down ? 'down' : 'up'); if (down) p.ang = ang + (hash(seed, x, 3) < 0.5 ? 0.4 : -0.4);
      if (prev && !down) prev.next = p; prev = down ? null : p; } }
  // billboards by the lanes, facing them
  for (const st of W.streets || []) { if ((st.w || 5) < 4) continue; let acc = 0;
    for (let k = 0; k < st.pts.length - 1; k++) { const a = st.pts[k], b = st.pts[k + 1], L = Math.hypot(b.x - a.x, b.y - a.y); if (!L) continue;
      for (let s = 0; s < L; s += 10) { acc += 10; if (acc < 260) continue; const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, side = hash(seed, a.x, s, 9) < 0.5 ? 1 : -1, off = (st.w || 5) * 0.8 + 9;
        const x = a.x + (b.x - a.x) * s / L + nx * off * side, y = a.y + (b.y - a.y) * s / L + ny * off * side;
        if (!clear(x, y, 2) || !room(x, y, 6)) continue; acc = 0; add('billboard', x, y, Math.atan2(-ny * side, -nx * side), 5, hash(seed, x, y, 4) < 0.45 ? 'torn' : 'whole'); } } }
  // the rest: one thing in some 44 m cells of open ground
  const G = 30; for (let gy = G / 2; gy < W.h; gy += G) for (let gx = G / 2; gx < W.w; gx += G) {
    const r0 = hash(seed, gx, gy, 1); if (r0 > 0.7) continue;
    const x = gx + (hash(seed, gx, gy, 2) - 0.5) * G * 0.7, y = gy + (hash(seed, gx, gy, 3) - 0.5) * G * 0.7;
    if (field.has(Math.floor(x / 16) * 4096 + Math.floor(y / 16))) continue;
    const toBridge = Math.hypot(x - bridge.x, y - bridge.y), toHome = Math.hypot(x - home.x, y - home.y), fight = toBridge < 500 ? 1 - toBridge / 500 : 0, flight = toHome < 700 ? 1 - toHome / 700 : 0;
    const w = { rocks: 1.5, deadtree: 2.0, husk: 0.4 + 2.6 * fight, crater: 0.3 + 2.4 * fight, cart: 0.3 + 1.6 * flight, camp: 0.2 + 1.0 * flight, bus: 0.18 };
    let pick = hash(seed, gx, gy, 5) * Object.values(w).reduce((a, b) => a + b, 0), id = 'rocks'; for (const [k, v] of Object.entries(w)) { if ((pick -= v) <= 0) { id = k; break; } }
    const r = id === 'bus' ? 8 : id === 'husk' || id === 'crater' ? 5 : 3; if (!clear(x, y, r) || !room(x, y, r)) continue;
    const ang = hash(seed, gx, gy, 6) * 6.283, hv = hash(seed, gx, gy, 7);
    add(id, x, y, ang, r, id === 'deadtree' ? (hv < 0.5 + fight * 0.4 ? 'burnt' : 'bare') : id === 'camp' ? (hv < 0.4 ? 'down' : 'up') : id === 'bus' ? (hv < 0.7 ? 'burnt' : 'whole') : null); }
  return out;
}
