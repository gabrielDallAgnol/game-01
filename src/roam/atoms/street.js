// [roam] Street atoms (the core's examples, one per hook): the dead street lamp (glyph solids) and the manhole (a ground
// mark). Read these first when adding a family: an atom is a plain object, it says where it stands and why, and draws
// itself with the kit (K: sphere, capsule, box, M materials, S the props' scale).
import { M } from '../dress/mats.js';
export const STREET = [
  // the lamps died with the grid. They stand on every kerb, every 26 m or so, wherever the town was a town; where the
  // blight is, some lean, some are down
  { id: 'lamp', family: 'street', slot: 'kerb', every: 24, chance: 0.6, space: 1.5, collide: { w: 0.5, h: 0.5 },
    fit: (c, s) => s.path || s.crown ? 0 : 1, variant: (c, h) => c < 0.32 && h < 0.45 ? (h < 0.2 ? 'down' : 'bent') : 'up',
    volumes(i, K) { const S = K.S, nx = i.slot.nx, ny = i.slot.ny, lean = i.variant === 'bent' ? 0.5 : 0;
      if (i.variant === 'down') { const a = i.ang + (i.h - 0.5) * 1.2, c = Math.cos(a), s = Math.sin(a); K.capsule(i.x, i.y, 0.1, i.x + c * 4.6 * S, i.y + s * 4.6 * S, 0.12, 0.08 * S, M.steel); K.box(i.x + c * 4.8 * S, i.y + s * 4.8 * S, 0.15, 0.35 * S, 0.2 * S, 0.12, 0.08 * S, a, M.dark); return; }
      const tx = i.x + nx * lean * S, ty = i.y + ny * lean * S, hx = tx + nx * 1.3 * S, hy = ty + ny * 1.3 * S;
      K.capsule(i.x, i.y, 0, tx, ty, 4.4 * S, 0.08 * S, M.steel);              // the post
      K.capsule(tx, ty, 4.4 * S, hx, hy, 4.6 * S, 0.06 * S, M.steel);          // the arm, out over the road
      K.box(hx, hy, 4.5 * S, 0.34 * S, 0.17 * S, 0.1 * S, 0.06 * S, Math.atan2(ny, nx), M.dark); } },  // the dead head
];
export const MARKS = [
  // a manhole in the road's middle every 30–60 m: a dark ring, a lid with its grid
  { id: 'manhole', family: 'street', slot: 'roadway', every: 34, chance: 0.35, fit: () => 0.9,
    paint(g, i) { const r = 0.42 * 1.3; g.fillStyle = 'rgb(0,120,0)'; g.beginPath(); g.arc(i.x, i.y, r, 0, 7); g.fill(); g.fillStyle = 'rgb(0,70,0)'; g.beginPath(); g.arc(i.x, i.y, r * 0.82, 0, 7); g.fill();
      g.strokeStyle = 'rgb(40,0,0)'; g.lineWidth = 0.05; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(i.x - r * 0.7, i.y + k * r * 0.25); g.lineTo(i.x + r * 0.7, i.y + k * r * 0.25); g.stroke(); } } },
];
