// [roam] Sites: the special places of a town and its land (a gas station, a supermarket and its car park, a farm), each
// a template that lays out its own buildings, ground and atoms round a point. The world (region.js) decides where.
//   SITES[id] = { size: [w, h] (its footprint, m, facing +y = its road side), build(site, ctx) }
//   build(site, ctx): site = { id, x, y, rot, h (0..1) }; ctx.place(building) adds a building in the engine's shape
//   ({ x, y, w, h, rot, def: { kind: 'building', look, tags, light, height, size } , door? }), ctx.land(poly, kind)
//   covers ground (see land.js), ctx.street(pts, kind, w) adds a drive or lot lane.
// Roof looks beyond gable and flat are painted by roofLook(look, X, p) (into the roof map: rgb = slope axis, which side,
// gable flag; a = roof), or fall back to flat.
// The ids the world places (fixed, so the world and the buildings can be built apart): gas, supermarket, diy, warehouse,
// farm, garage, school. A building with def.collide 'none' (a canopy) is not a wall.
// The layout, in the site's own frame: u across (−w/2..w/2), v from the back (−h/2) to the road (+h/2); the front edge
// sits on the road's verge and each drive runs ~5 m past it to meet the road (kind 'drive': asphalt, no pavement).
// build() also fills site.anchors = [{ kind, x, y, ang, …}]: where the site's atoms stand (atoms/sites.js), read by
// dress/slots.js [sites]. Everything is a hash of site.h: the same site always comes out the same.
import { hash } from '../dress/place.js';

const PI = Math.PI, BW = 3.2, BD = 6.6;   // a bay (the cars are drawn 1.3x life): 3.2 m wide, 6.6 m deep
// the site's frame and its tools
function frame(site, ctx) {
  const c = Math.cos(site.rot), s = Math.sin(site.rot), seed = Math.floor((site.h || 0) * 1e6), R = (k, j = 0) => hash(seed, k, j, 31);
  const P = (u, v) => ({ x: site.x + u * c - v * s, y: site.y + u * s + v * c });
  const anchors = site.anchors = [];
  const an = (kind, u, v, a = 0, extra = {}) => { const q = P(u, v); anchors.push({ kind, x: q.x, y: q.y, ang: site.rot + a, site: site.id, ...extra }); };
  const bld = (u, v, w, h, look, tags, o = {}) => { const q = P(u, v), b = { x: q.x, y: q.y, w, h, rot: site.rot + (o.a || 0),
      def: { kind: 'building', look, tags: ['site', 'site.' + site.id, ...tags], light: o.light || 0, height: o.height || 6, size: [w, h], ...(o.collide ? { collide: o.collide } : {}) } };
    if (o.door) b.door = P(o.door[0], o.door[1]); ctx.place(b); return b; };
  const land = (u0, v0, u1, v1, kind) => ctx.land([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], kind);
  const drive = (pts, w = 7, kind = 'drive') => ctx.street(pts.map(([u, v]) => P(u, v)), kind, w);
  // a big flat roof's plant: skylight strips in rows, HVAC units near the back, a few vents
  const plant = (b, u0, v0, w, h) => { const spot = (u, v, plant, extra = {}) => an('roof', u, v, 0, { spot: true, plant, look: b.def.look, tags: b.def.tags, uid: b.uid, w: 4, h: 4, ...extra });
    const rows = h > 30 ? 3 : 2; for (let r = 0; r < rows; r++) { const v = v0 - h / 2 + h * (r + 1) / (rows + 1) + 1.5; for (let u = u0 - w / 2 + 7; u + 5 < u0 + w / 2 - 4; u += 13) spot(u + 5, v, 'sky', { len: 10 }); }
    const nh = 2 + Math.floor(R(90) * 4), hu = u0 + (R(91) - 0.5) * (w - 20); for (let k = 0; k < nh; k++) spot(hu + (k - (nh - 1) / 2) * 3.8, v0 - h / 2 + 3.2 + (k % 2) * 0.4, 'hvac');
    for (let k = 0; k < 3; k++) spot(u0 + (R(92 + k) - 0.5) * (w - 8), v0 - h / 2 + 6 + R(95 + k) * (h - 12), 'vent'); };
  // a row of bays (n along u from u0, nose toward `face` = ±1 in v) and its paint; `two`: a double row about v
  const bays = (uc, v, n, two, kind, face = -1) => { an('mark', uc, v, 0, { use: 'bays', n, bw: BW, bd: BD, two });
    for (const side of two ? [-1, 1] : [0]) for (let k = 0; k < n; k++) { const u = uc + (k - (n - 1) / 2) * BW, vv = two ? v + side * BD / 2 : v, f = two ? -side : face; an('bay', u, vv, f > 0 ? PI / 2 : -PI / 2, { bay: kind }); } };
  const grid = (u0, v0, u1, v1, step, zone, keep = () => true) => { for (let v = v0 + step / 2; v < v1; v += step) for (let u = u0 + step / 2; u < u1; u += step) if (keep(u, v)) an('apron', u, v, R(u * 7, v * 3) * 2 * PI, { zone }); };
  const fence = (u0, v0, u1, v1, style, gap) => { const L = Math.hypot(u1 - u0, v1 - v0), n = Math.floor(L / 6), a = Math.atan2(v1 - v0, u1 - u0);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) * 6 + (L - n * 6) / 2, u = u0 + (u1 - u0) * t / L, v = v0 + (v1 - v0) * t / L; if (gap && Math.hypot(u - gap[0], v - gap[1]) < gap[2]) continue; an('fixture', u, v, a, { use: 'fence', style }); } };
  return { P, R, an, bld, land, drive, plant, bays, grid, fence };
}

export const SITES = {
  // a petrol station: a canopy over two or three pump islands, the kiosk shop at the back, the price pylon by the road,
  // the air and water point; a car wash in one back corner now and then; a few bays by the kiosk
  gas: { size: [46, 36], build(site, ctx) { const { R, an, bld, land, drive, bays, grid } = frame(site, ctx), W = 46, H = 36;
    const n = R(1) < 0.45 ? 2 : 3, sp = 8.6, cw = n * sp + 3.4, ch = 11, vc = 3.5;
    const ks = R(2) < 0.33 ? -1 : R(2) < 0.66 ? 0 : 1, kw = 11 + Math.round(R(3) * 5), kh = 8, ku = ks * (W / 2 - kw / 2 - 3), kv = -H / 2 + 2.5 + kh / 2, side = ks <= 0 ? 1 : -1;
    land(-W / 2, -H / 2, W / 2, H / 2, 'lot');
    bld(0, vc, cw, ch, 'gascanopy', ['canopy'], { collide: 'none', height: 5.5 });
    for (let k = 0; k < n; k++) an('fixture', (k - (n - 1) / 2) * sp, vc, 0, { use: 'pump' });
    an('mark', 0, vc, 0, { use: 'forecourt', len: cw });
    bld(ku, kv, kw, kh, 'flat', ['shop', 'kiosk'], { light: 1, height: 4, door: [ku + (R(4) - 0.5) * kw * 0.4, kv + kh / 2 + 0.6] });
    an('fixture', ku, kv + kh / 2 + 0.7, 0, { use: 'shopfront', len: kw * 0.7 });
    an('fixture', ku + side * (kw / 2 + 2.2), kv + 1, 0, { use: 'air' });
    an('fixture', side * (W / 2 - 3), H / 2 - 2, 0, { use: 'pylon' });
    // bays by the kiosk, on the air point's side; a car wash in the other back corner
    const bu = ku + side * (kw / 2 + 4 + 1.5 * BW); if (Math.abs(bu) + 1.5 * BW < W / 2 - 1) bays(bu, -H / 2 + BD / 2 + 0.6, 3, false, 'staff', -1);
    if (ks !== 0 && R(5) < 0.5) { const wu = -ks * (W / 2 - 4.5); bld(wu, -H / 2 + 7, 11, 7, 'flat', ['carwash'], { a: PI / 2, height: 4 }); an('fixture', wu, -H / 2 + 13.3, 0, { use: 'roller', len: 4.5 }); }
    grid(-W / 2 + 1, -H / 2 + 12, W / 2 - 1, H / 2 - 1, 4, 'front', (u, v) => !(Math.abs(v - vc) < 6.5 && Math.abs(u) < cw / 2 + 1));
    grid(-cw / 2, vc - 6.5, cw / 2, vc + 6.5, 3.2, 'pumps', (u, v) => Math.abs(v - vc) > 1.6);
    for (const e of [-1, 1]) drive([[e * (W / 2 - 5), H / 2 - 3], [e * (W / 2 - 5), H / 2 + 5]], 7); } },

  // a supermarket: a big flat box at the back (skylights, HVAC and vents on its roof), its glass entrance, a loading
  // yard behind reached by a service drive down one side; in front the car park: double rows of bays in blocks of
  // seven, lamps and trolley shelters in the gaps, arrows in the aisles, a zebra to the door
  supermarket: { size: [112, 104], build(site, ctx) { const { R, an, bld, land, drive, plant, bays, grid } = frame(site, ctx), W = 112, H = 104;
    const sw = 54 + Math.round(R(1) * 18), sd = 32 + Math.round(R(2) * 8), side = R(3) < 0.5 ? -1 : 1, us = -side * Math.max(0, W / 2 - 11 - sw / 2) * R(4);
    const vb = -H / 2 + 12, vf = vb + sd, ue = us + (R(5) - 0.5) * sw * 0.5, ud = side * (W / 2 - 5);
    land(-W / 2, -H / 2, W / 2, vb, 'yard'); land(-W / 2, vb, W / 2, H / 2, 'lot');
    const store = bld(us, (vb + vf) / 2, sw, sd, 'flat', ['shop', 'supermarket', 'nestable'], { light: 1, height: 9, door: [ue, vf + 0.6] });
    plant(store, us, (vb + vf) / 2, sw, sd);
    an('fixture', ue, vf + 0.8, 0, { use: 'shopfront', len: 14, role: 'entrance' });
    // the loading yard: docks on the back wall, lorries backed onto some
    const nd = 2 + Math.floor(R(6) * 2), du = us + side * (sw / 2 - nd * 2.9 - 3);
    for (let k = 0; k < nd; k++) { const u = du + (k - (nd - 1) / 2) * 5.8; an('fixture', u, vb - 0.9, PI, { use: 'dock' }); an('bay', u, vb - 6.4, -PI / 2, { bay: 'dock' }); }
    an('mark', du, vb - 6, 0, { use: 'bays', n: nd, bw: 5.8, bd: 11, style: 'dock' });
    grid(-W / 2 + 2, -H / 2 + 1, W / 2 - 9, vb - 1, 4.5, 'dock', u => Math.abs(u - du) > nd * 2.9 + 2);
    // the car park: aisle, double row, aisle, double row, aisle
    const u0 = side > 0 ? -W / 2 + 3 : -W / 2 + 10, u1 = side > 0 ? W / 2 - 10 : W / 2 - 3, blk = 7 * BW + 3.4, nb = Math.floor((u1 - u0 + 3.4) / blk), bc = (u0 + u1) / 2;
    let v = vf + 2 + 7; const rows = [];
    while (v + 2 * BD + 6 <= H / 2) { rows.push(v + BD); v += 2 * BD + 7; }
    rows.forEach((rv, ri) => { for (let b = 0; b < nb; b++) bays(bc + (b - (nb - 1) / 2) * blk, rv, 7, true, 'shop');
      for (let g = 0; g <= nb; g++) { const gu = bc + (g - nb / 2) * blk; if (ri === 0 && g % 2 === 1) an('fixture', gu, rv, PI / 2, { use: 'shelter' }); else if ((g + ri) % 2 === 0) an('fixture', gu, rv, 0, { use: 'lotlamp' }); } });
    const aisles = [vf + 5.5, ...rows.map(rv => rv + BD + 3.5)];
    aisles.forEach((av, k) => { for (let u = u0 + 4; u < u1 - 2; u += 5) an('apron', u, av + (R(u, k) - 0.5) * 2, R(u, k + 9) * 6.28, { zone: k ? 'park' : 'front' });
      for (const f of [0.25, 0.75]) an('mark', u0 + (u1 - u0) * f, av, k % 2 ? PI : 0, { use: 'arrow' }); });
    an('mark', ue, vf + 5.5, 0, { use: 'walk', w: 7 });
    drive([[ud, H / 2 + 5], [ud, -H / 2 + 6]], 7);
    drive([[bc + (R(7) - 0.5) * 30, H / 2 - 4], [bc + (R(7) - 0.5) * 30, H / 2 + 5]], 8); } },

  // a DIY store: a big ribbed shed at the back, the garden centre in a fenced gravel yard beside it (pallets, sacks,
  // benches of plants, sometimes a shade canopy), a loading yard behind with roller doors, a car park in front
  diy: { size: [100, 88], build(site, ctx) { const { R, an, bld, land, drive, bays, grid, fence } = frame(site, ctx), W = 100, H = 88;
    const g = R(1) < 0.5 ? 1 : -1, sw = 46 + Math.round(R(2) * 12), sd = 28 + Math.round(R(3) * 6), gw = 22 + Math.round(R(4) * 6);
    const x0 = -W / 2 + 10, vb = -H / 2 + 10, vf = vb + sd, U = u => g * u, us = U(x0 + sw / 2), gu0 = x0 + sw, gu1 = x0 + sw + gw;
    land(-W / 2, -H / 2, W / 2, vb, 'yard'); land(-W / 2, vf, W / 2, H / 2, 'lot'); land(Math.min(U(gu0), U(gu1)), vb + 4, Math.max(U(gu0), U(gu1)), vf + 2, 'gravel');
    land(Math.min(U(-W / 2), U(x0)), vb, Math.max(U(-W / 2), U(x0)), vf, 'lot');
    bld(us, (vb + vf) / 2, sw, sd, 'ribbed', ['shop', 'diy', 'nestable'], { light: 0.8, height: 9, door: [U(x0 + sw * 0.7), vf + 0.6] });
    an('fixture', U(x0 + sw * 0.7), vf + 0.8, 0, { use: 'shopfront', len: 10, role: 'entrance' });
    // the garden centre: fenced on its three open sides, the gate by the shop's front
    fence(U(gu0 + 0.5), vb + 4, U(gu1), vb + 4, 'rail'); fence(U(gu1), vb + 4, U(gu1), vf + 2, 'rail'); fence(U(gu1), vf + 2, U(gu0 + 0.5), vf + 2, 'rail', [U(gu0 + 6), vf + 2, 5]);
    if (R(5) < 0.55) bld(U((gu0 + gu1) / 2), vb + 11, gw - 6, 9, 'ribbed', ['canopy'], { collide: 'none', height: 4 });
    grid(Math.min(U(gu0 + 1), U(gu1 - 1)), vb + 5, Math.max(U(gu0 + 1), U(gu1 - 1)), vf + 1, 3.4, 'garden');
    // the back: roller doors, the yard
    for (const f of [0.3, 0.65]) an('fixture', U(x0 + sw * f), vb - 0.8, PI, { use: 'roller', len: 5 });
    an('bay', U(x0 + sw * 0.3), vb - 6.4, -PI / 2, { bay: 'dock' });
    grid(-W / 2 + 1, -H / 2 + 1, W / 2 - 1, vb - 1, 4.5, 'dock', u => Math.abs(u - U(x0 + sw * 0.3)) > 3.5);
    // the car park: a double row between two aisles
    const blk = 7 * BW + 3.4, a0 = -W / 2 + 4, a1 = W / 2 - 4, nb = Math.floor((a1 - a0 + 3.4) / blk), rv = vf + 2 + 7 + BD;
    for (let b = 0; b < nb; b++) bays((b - (nb - 1) / 2) * blk, rv, 7, true, 'shop');
    for (let k = 0; k <= nb; k++) an('fixture', (k - nb / 2) * blk, rv, k % 2 ? PI / 2 : 0, { use: k % 2 ? 'shelter' : 'lotlamp' });
    for (const av of [vf + 5.5, rv + BD + 3.5]) for (let u = a0 + 3; u < a1; u += 5) an('apron', u, av, R(u, av) * 6.28, { zone: av < rv ? 'front' : 'park' });
    drive([[U(-W / 2 + 4), H / 2 + 5], [U(-W / 2 + 4), -H / 2 + 5]], 7); drive([[g * 10, H / 2 - 3], [g * 10, H / 2 + 5]], 8); } },

  // industrial units: one big sawtooth shed, two ribbed sheds side by side, or a terrace of units with a door each; a
  // yard in front (lorries at the doors, containers stacked down one side, pallets, a forklift), an office by the gate,
  // and a palisade along the road now and then
  warehouse: { size: [104, 84], build(site, ctx) { const { R, an, bld, land, drive, bays, grid, fence } = frame(site, ctx), W = 104, H = 84;
    const kind = R(1) < 0.4 ? 'one' : R(1) < 0.75 ? 'two' : 'row', g = R(2) < 0.5 ? 1 : -1, vb = -H / 2 + 5;
    const sheds = kind === 'one' ? [[0, 64 + Math.round(R(3) * 12), 30 + Math.round(R(4) * 4), 'sawtooth']] : kind === 'two' ? [[-25, 42, 24, R(3) < 0.5 ? 'sawtooth' : 'ribbed'], [25, 42, 24, R(4) < 0.5 ? 'ribbed' : 'sawtooth']] : [[0, 84, 20, 'ribbed']];
    const vfs = sheds.map(([, , d]) => vb + d), vf = Math.max(...vfs);
    land(-W / 2, -H / 2, W / 2, H / 2, 'yard');
    const doorsAt = [];
    for (const [u, w, d, look] of sheds) { bld(u, vb + d / 2, w, d, look, ['industrial', 'warehouse', 'nestable'], { light: 0.4, height: 8 });
      const nd = kind === 'row' ? 4 : 2; for (let k = 0; k < nd; k++) { const du = u + (k - (nd - 1) / 2) * w / nd; an('fixture', du, vb + d + 0.8, 0, { use: 'roller', len: 4.5 }); doorsAt.push([du, vb + d]); } }
    for (const [du, dv] of doorsAt) an('bay', du, dv + 6.5, PI / 2, { bay: 'dock' });
    // the office by the gate, its staff bays
    const ou = g * (W / 2 - 8), ov = H / 2 - 9; bld(ou, ov, 12, 8, 'flat', ['office', 'industrial'], { light: 1, height: 4, door: [ou - g * 6.6, ov] });
    bays(ou - g * 2, ov - 4 - BD / 2 - 1.5, 4, false, 'staff', 1);
    // the containers down the far side, side by side
    const cu = -g * (W / 2 - 5.5); for (let v = vf + 4; v < H / 2 - 4; v += 3.4) an('apron', cu, v, 0, { zone: 'stack' });
    grid(-W / 2 + 12, vf + 2, W / 2 - 16, H / 2 - 2, 5, 'yard', (u, v) => !doorsAt.some(([du, dv]) => Math.abs(u - du) < 3 && v < dv + 13));
    const gate = -g * 20; if (R(5) < 0.6) fence(-W / 2 + 1, H / 2 - 0.6, W / 2 - 1, H / 2 - 0.6, 'mesh', [gate, H / 2 - 0.6, 7]);
    an('mark', 0, vf + 15, g > 0 ? 0 : PI, { use: 'arrow' });
    drive([[gate, H / 2 - 4], [gate, H / 2 + 5]], 9); } },

  // a farm: the farmhouse by the lane (a house: its garden, its lit window), the yard, a big barn across the back with
  // its silos, an open-fronted machine shed down one side (the tractor under it), a muck heap in the far corner, a
  // stack of bales by the barn; an old byre now and then. Fields round it are the world's
  farm: { size: [100, 90], build(site, ctx) { const { R, an, bld, land, drive, grid } = frame(site, ctx), H = 90, m = R(1) < 0.5 ? 1 : -1, U = u => m * u;
    land(U(-36), -24, U(30), 14, 'yard');
    const hw = 12 + Math.round(R(2) * 3), hh = 8 + Math.round(R(3) * 2), hu = U(24), hv = 28;
    bld(hu, hv, hw, hh, 'gable', ['house', 'farm', 'farmhouse'], { light: 1, height: 7, door: [hu - m * hw * 0.2, hv + hh / 2 + 0.6] });
    const bw = 28 + Math.round(R(4) * 6), bh = 13 + Math.round(R(5) * 3), bu = U(-6), bv = -24 - bh / 2;
    bld(bu, bv, bw, bh, 'barn', ['barn', 'farm', 'nestable'], { light: 0.5, height: 10, door: [bu, bv + bh / 2 + 0.6] });
    an('fixture', bu, bv + bh / 2 + 0.8, 0, { use: 'roller', len: 6 });
    const ns = R(6) < 0.2 ? 0 : 1 + Math.floor(R(7) * 3); for (let k = 0; k < ns; k++) an('fixture', U(-6 + bw / 2 + 4 + k * 5.2), -31 + (k % 2) * 1.2, R(8 + k) * 6.28, { use: 'silo' });
    // the machine shed: a walled back half and an open front half under one lean-to roof, posts along the open side
    const su = U(-41), sv = -6; bld(su - m * 2.5, sv, 22, 5, 'lean', ['outbuilding', 'farm'], { a: PI / 2 + (m < 0 ? PI : 0), height: 5 });
    bld(su + m * 2.5, sv, 22, 5, 'lean', ['outbuilding', 'farm', 'canopy'], { a: PI / 2 + (m < 0 ? PI : 0), collide: 'none', height: 5 });
    an('fixture', su + m * 4.9, sv, PI / 2, { use: 'posts', len: 21 });
    for (const dv of [-6, 1.5]) an('apron', su + m * 2.5, sv + dv, PI / 2, { zone: 'shed' });
    an('fixture', U(23), -17, R(9) * 6.28, { use: 'muck' });
    for (const [u, v] of [[-28, -29], [-24, -33], [16, -16]]) an('apron', U(u), v, 0.2 * R(u + 40), { zone: 'bales' });
    if (R(10) < 0.6) bld(U(27), 0, 14, 6, 'gable', ['outbuilding', 'farm'], { a: PI / 2, height: 5 });
    grid(U(-34) < U(22) ? U(-34) : U(22), -20, U(-34) < U(22) ? U(22) : U(-34), 12, 6.5, 'farmyard', (u, v) => Math.hypot(u - U(23), v + 17) > 6);
    drive([[U(-12), 12], [U(-12), H / 2 + 5]], 5, 'track'); } },

  // a car repair garage: a ribbed workshop unit with one or two roller doors, a ramp on the forecourt, tyres against the
  // walls, the cars waiting in a row of bays by the road
  garage: { size: [42, 32], build(site, ctx) { const { R, an, bld, land, drive, bays, grid } = frame(site, ctx), W = 42, H = 32;
    const uw = 18 + Math.round(R(1) * 6), uh = 12, uu = (R(2) - 0.5) * (W - uw - 6), uv = -H / 2 + 1 + uh / 2, nd = R(3) < 0.5 ? 1 : 2, fv = uv + uh / 2;
    land(-W / 2, -H / 2, W / 2, H / 2, 'lot');
    bld(uu, uv, uw, uh, 'ribbed', ['garage', 'workshop'], { light: 1, height: 5, door: [uu + uw / 2 - 1.5, fv + 0.6] });
    const doors = []; for (let k = 0; k < nd; k++) { const du = uu - uw / 2 + 4 + k * 6; doors.push(du); an('fixture', du, fv + 0.8, 0, { use: 'roller', len: 4.5 }); }
    const ru = uu + (R(4) < 0.5 ? -1 : 1) * (uw / 2 + 3.5); if (Math.abs(ru) < W / 2 - 3) an('fixture', ru, fv + 2, PI / 2, { use: 'ramp' }); else an('fixture', doors[0], fv + 4.5, PI / 2, { use: 'ramp' });
    for (const e of [-1, 1]) for (let v = uv - uh / 2 + 1.5; v < fv - 1; v += 2.4) an('apron', uu + e * (uw / 2 + 0.9), v, 0, { zone: 'wall' });
    for (let u = uu + uw / 2 - 5; u > uu - uw / 2 + 10; u -= 2.4) an('apron', u, fv + 0.9, 0, { zone: 'wall' });
    const n = 4 + Math.floor(R(5) * 2); bays(0, H / 2 - BD / 2 - 0.6, n, false, 'wait', -1);
    for (const du of doors) an('bay', du, fv + 4.2, PI / 2, { bay: 'wait' });
    grid(-W / 2 + 1, fv + 1, W / 2 - 1, H / 2 - BD - 1, 3.5, 'garage');
    drive([[0, H / 2 - 2], [0, H / 2 + 5]], 10); } },

  // a school: a long flat block (a wing toward the road now and then, a gabled hall behind), the playground's court on
  // the hard ground, a football pitch on the grass with its goals, a bike shed by the door, staff bays and railings
  school: { size: [104, 84], build(site, ctx) { const { R, an, bld, land, drive, bays, fence } = frame(site, ctx), W = 104, H = 84, m = R(1) < 0.5 ? 1 : -1, U = u => m * u;
    const mw = 56 + Math.round(R(2) * 10), mu = U(-8), mv = -18, mf = mv + 6.5;
    bld(mu, mv, mw, 13, 'flat', ['school', 'civic', 'nestable'], { light: 1, height: 8, door: [mu, mf + 0.6] });
    if (R(3) < 0.6) bld(mu + m * (mw / 2 - 6.5), mf + 11, 13, 22, 'flat', ['school', 'civic'], { light: 1, height: 7 });
    if (R(4) < 0.5) bld(mu - m * (mw / 2 - 12), mv - 6.5 - 8, 22, 15, 'gable', ['school', 'hall'], { light: 0.6, height: 9 });
    an('fixture', mu + m * 8, mf + 2.4, 0, { use: 'bikeshed' });
    // the playground: hard ground with a court, by the block's front (the side away from the wing)
    const pu0 = U(-50), pu1 = U(-8), pv0 = mf + 1, pv1 = 22; land(Math.min(pu0, pu1), pv0, Math.max(pu0, pu1), pv1, 'lot');
    an('mark', (pu0 + pu1) / 2, (pv0 + pv1) / 2, 0, { use: 'court', w: 26, h: 13 });
    // the pitch on the grass behind the wing's side, its goals at the ends
    const cu = U(32), cv = -6; for (const e of [-1, 1]) { an('mark', cu + e * 8, cv, 0, { use: 'pitch', side: e, w: 16, h: 22 }); an('fixture', cu + e * 16, cv, e > 0 ? PI : 0, { use: 'goal' }); }
    // staff bays off the drive, railings along the road
    const du = U(-30); land(du - 18, H / 2 - BD - 9, du + 18, H / 2, 'lot'); bays(du, H / 2 - BD / 2 - 9, 8, false, 'staff', -1);
    fence(-W / 2 + 1, H / 2 - 0.6, W / 2 - 1, H / 2 - 0.6, 'rail', [du, H / 2 - 0.6, 6]);
    drive([[du, H / 2 - 5], [du, H / 2 + 5]], 7); } },
};

// ---------------- roofs ----------------
// the roof map (see town.js): r the downslope's axis (0..255 over 0..π), g 255 when the slope faces +axis, b 255 a slope
// (0 flat), a the roof (a little under 1 darkens it like an eave: glazing, ribs, an old barn's tin)
const ang = a => { a %= PI; if (a < 0) a += PI; return Math.round(a / PI * 255); };
// a band of roof in the building's frame (X is already there), its downslope along local (dx, dy); flat when dx = dy = 0
function band(X, p, u0, v0, u1, v1, dx, dy, a = 1) {
  if (!dx && !dy) { X.fillStyle = `rgba(${ang(p.rot)},150,0,${a})`; X.fillRect(u0, v0, u1 - u0, v1 - v0); return; }
  const c = Math.cos(p.rot), s = Math.sin(p.rot), wx = dx * c - dy * s, wy = dx * s + dy * c, A = ang(Math.atan2(wy, wx)), Af = A / 255 * PI;
  X.fillStyle = `rgba(${A},${wx * Math.cos(Af) + wy * Math.sin(Af) > 0 ? 255 : 0},255,${a})`; X.fillRect(u0, v0, u1 - u0, v1 - v0); }
// ribbed sheet: stripes across u, every other one a little darker (the corrugation)
const ribs = (X, p, v0, v1, dx, dy, a0, a1, pitch = 0.9) => { for (let u = -p.w / 2, k = 0; u < p.w / 2 - 1e-6; u += pitch, k++) band(X, p, u, v0, Math.min(p.w / 2, u + pitch), v1, dx, dy, k % 2 ? a1 : a0); };
export function roofLook(look, X, p) {
  const hw = p.w / 2, hh = p.h / 2;
  // sawtooth: teeth across the length, each a long slope and a short steep glazed one (darker); the moving sun lights one
  // face of every tooth and leaves the other, so the shed's roof reads as stripes that swap through the day
  if (look === 'sawtooth') { const P = 6, n = Math.max(1, Math.round(p.w / P)), t = p.w / n;
    for (let k = 0; k < n; k++) { const u0 = -hw + k * t; band(X, p, u0, -hh, u0 + t * 0.7, hh, -1, 0, 1); band(X, p, u0 + t * 0.7, -hh, u0 + t, hh, 1, 0, 0.8); } return true; }
  // ribbed: a low-pitch portal shed, ridge along its length, the sheets corrugated
  if (look === 'ribbed') { ribs(X, p, -hh, 0, 0, -1, 1, 0.9); ribs(X, p, 0, hh, 0, 1, 1, 0.9); return true; }
  // barn: a big gable in old tin, darker than a house's tiles
  if (look === 'barn') { ribs(X, p, -hh, 0, 0, -1, 0.9, 0.84, 1.1); ribs(X, p, 0, hh, 0, 1, 0.9, 0.84, 1.1); return true; }
  // lean-to: one slope over the whole roof (toward local −v), ribbed
  if (look === 'lean') { ribs(X, p, -hh, hh, 0, -1, 0.95, 0.87); return true; }
  // a forecourt canopy: flat, its fascia round the edge a darker band
  if (look === 'gascanopy') { const f = 0.7; band(X, p, -hw, -hh, hw, hh, 0, 0, 0.8); band(X, p, -hw + f, -hh + f, hw - f, hh - f, 0, 0, 1); return true; }
  return false;
}
// the size of each site (for the world's planning): [w, h]
export const siteSize = id => SITES[id] ? SITES[id].size : [0, 0];
