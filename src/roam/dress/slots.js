// [roam] Slots: the places a dressing atom may stand, read off the engine's town at the widths the game draws its streets.
// Each slot is { kind, x, y, ang (facing, radians), care, ...extra }. Kinds:
//   parking   on the road against the kerb, along the street (not near a junction)      ang: along the street
//   kerb      the pavement's road edge (lamps, poles, bins, post boxes)                  ang: along; nx,ny: toward the road
//   pavement  the pavement's middle (benches face the road, litter)                     ang: along; nx,ny: toward the road
//   wall      the pavement's outer edge, by the gardens and fronts                        ang: along; nx,ny: toward the road
//   roadway   the road's middle lanes (manholes, potholes, crashes)                        ang: along the street
//   crossing  across a street just before a junction (zebra crossings)                    ang: along the street; w: road width
//   junction  the middle of a junction of three or more streets                           ang: 0; r: its rough radius
//   door      in front of a house's door                                                   ang: out of the door; uid
//   roof      on a building (crows, chimneys)                                              ang: the building's; w, h, uid, look
//   yard      behind a house, open ground (sheds, laundry, bins)                           ang: away from the house; uid
//   tree      at a tree's foot (leaf piles)                                                r: crown radius
// Every slot also carries `crown`: true under a tree's crown (tall atoms keep out; leaf piles and benches like the shade),
// `district` (the engine's district id: oldtown, station, works, masts, park, barns, south, west, east) and, on pavement
// slots (kerb, pavement, wall), `door`: true within 4 m of a house's front door.
// Slots are sampled every `step` metres along streets; placement (place.js) spaces atoms itself.
export const PAVE = 2.4;   // the pavement's width (matches town.js's street painting)
import { profileOf } from '../world/streets.js';
import { landSlots } from '../world/land.js';
export function makeSlots({ W, buildings, trees, blocked, care, sw, step = 3 }) {
  const TG = 12, tgrid = new Map(); for (const p of trees) { const k = Math.floor(p.x / TG) * 4096 + Math.floor(p.y / TG); if (!tgrid.has(k)) tgrid.set(k, []); tgrid.get(k).push(p); }
  const crown = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const p of tgrid.get((Math.floor(x / TG) + i) * 4096 + Math.floor(y / TG) + j) || []) if (Math.hypot(p.x - x, p.y - y) < (p.r || p.def.size[0] / 2) * 0.9 + 0.4) return true; return false; };
  const DG = 8, dgrid = new Map(); for (const p of buildings) if (p.door) { const k = Math.floor(p.door.x / DG) * 4096 + Math.floor(p.door.y / DG); if (!dgrid.has(k)) dgrid.set(k, []); dgrid.get(k).push(p.door); }
  const nearDoor = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const d of dgrid.get((Math.floor(x / DG) + i) * 4096 + Math.floor(y / DG) + j) || []) if (Math.hypot(d.x - x, d.y - y) < 4) return true; return false; };
  const S = [], push = (kind, x, y, ang, extra) => S.push({ kind, x, y, ang, care: care.at(x, y), crown: crown(x, y), district: care.district(x, y),
    door: kind === 'kerb' || kind === 'pavement' || kind === 'wall' ? nearDoor(x, y) : false, ...extra });
  const nodes = new Map(W.nodes.map(n => [n.id, n])), nodeW = new Map();
  for (const st of W.streets) for (const id of st.ends || []) nodeW.set(id, Math.max(nodeW.get(id) || 0, sw(st)));
  const juncs = W.nodes.filter(n => n.deg >= 3), nearJ = (x, y, m) => juncs.some(n => Math.hypot(n.x - x, n.y - y) < (nodeW.get(n.id) || 8) / 2 + m);
  for (const st of W.streets) { const half = sw(st) / 2, P = profileOf(st), path = st.kind === 'path', pave = P.pavement ? PAVE : 0, pts = st.pts;   // a kind with no pavement: its kerb and verge slots sit at the road's edge
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 0.5) continue;
      const dx = (b.x - a.x) / L, dy = (b.y - a.y) / L, ang = Math.atan2(dy, dx), px = -dy, py = dx;
      for (let d = step / 2; d < L; d += step) { const cx = a.x + dx * d, cy = a.y + dy * d;
        if (path) { for (const s of [-1, 1]) { const x = cx + px * s * (half + 0.6), y = cy + py * s * (half + 0.6); if (!blocked(x, y)) push('wall', x, y, ang, { nx: -px * s, ny: -py * s, street: st.id, path: true }); } continue; }
        for (const s of [-1, 1]) { const o = (k, m) => [cx + px * s * k, cy + py * s * k], nx = -px * s, ny = -py * s;
          const [kx, ky] = o(pave ? half - pave + 0.35 : half + 0.7), [mx, my] = o(half - pave / 2), [wx, wy] = o(pave ? half - 0.35 : half + 1.6), [qx, qy] = o(half - pave - 1.15);
          if (!blocked(kx, ky)) push('kerb', kx, ky, ang, { nx, ny, street: st.id, side: s, district: st.district, verge: !pave });
          if (pave && !blocked(mx, my)) push('pavement', mx, my, ang, { nx, ny, street: st.id, side: s });
          if (!blocked(wx, wy)) push('wall', wx, wy, ang, { nx, ny, street: st.id, side: s, verge: !pave });
          if (P.parking && !blocked(qx, qy) && !nearJ(qx, qy, 7)) push('parking', qx, qy, ang + (s < 0 ? Math.PI : 0), { street: st.id, side: s }); }
        if (half - pave > 2.2 && !nearJ(cx, cy, 3)) push('roadway', cx, cy, ang, { street: st.id, w: 2 * (half - pave), road: st.kind }); } }
    // crossings: across the street just before each junction it meets
    if (!path) for (const [k, id] of (st.ends || []).entries()) { const n = nodes.get(id); if (!n || n.deg < 3) continue;
      const p0 = k === 0 ? pts[0] : pts[pts.length - 1], p1 = k === 0 ? pts[1] : pts[pts.length - 2], L = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1, dx = (p1.x - p0.x) / L, dy = (p1.y - p0.y) / L, off = (nodeW.get(id) || 8) / 2 + 1.6;
      if (L > off + 3) push('crossing', p0.x + dx * off, p0.y + dy * off, Math.atan2(dy, dx), { street: st.id, w: 2 * (half - pave), node: id, road: st.kind }); } }
  for (const n of juncs) push('junction', n.x, n.y, 0, { r: (nodeW.get(n.id) || 8) / 2, node: n.id });
  for (const p of buildings) {
    push('roof', p.x, p.y, p.rot, { w: p.w, h: p.h, uid: p.uid, look: p.def.look, tags: p.def.tags });
    if (p.door) { const dx = p.door.x - p.x, dy = p.door.y - p.y, r = Math.hypot(dx, dy) || 1, ux = dx / r, uy = dy / r, x = p.door.x + ux * 1.2, y = p.door.y + uy * 1.2;
      if (!blocked(x, y)) push('door', x, y, Math.atan2(uy, ux), { uid: p.uid });
      const bx = p.x - ux * (r + 3.2), by = p.y - uy * (r + 3.2); if (!blocked(bx, by)) push('yard', bx, by, Math.atan2(-uy, -ux), { uid: p.uid }); } }
  for (const p of trees) push('tree', p.x, p.y, 0, { r: (p.r || p.def.size[0] / 2) * 0.86 });
  // [sites] begin: the special places' own anchors (world/sites.js: pumps, bays, yards, rooftop plant); a site's
  // works buildings have no back yard for a washing line (only its homes do)
  for (const st of W.sites || []) for (const a of st.anchors || []) push(a.kind, a.x, a.y, a.ang, a);
  { const works = new Set(buildings.filter(p => p.def.tags.includes('site') && !p.def.tags.includes('house')).map(p => p.uid)); for (let k = S.length - 1; k >= 0; k--) if (S[k].kind === 'yard' && works.has(S[k].uid)) S.splice(k, 1); }
  // [sites] end
  // [land] begin: inside fields and woods ('field'), along field edges ('edge'), where a field meets its lane ('gate'): world/land.js
  landSlots({ W, push, blocked, care });
  // [land] end
  const by = {}; for (const s of S) (by[s.kind] ||= []).push(s);
  return { all: S, by };
}
