// Hollowmere city kit · City: apartment blocks (ruined or whole), rubble, streets, weeds and grass.
import { M } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';

// ======================================================================
// CITY: apartment blocks, ruined or whole, with recessed windows
// ======================================================================
/**
 * apartment({ w, d, floors, color, ruin 0..1, seed, shop, burnt, vines, roofStuff })
 * Built bay by bay: a recessed core with piers, spandrels and slab bands in front, so windows have real depth.
 */
function apartment(o = {}) {
  const r = rng(o.seed || 1), b = new B();
  b._wall = o.color || 'bone';
  const w = o.w || 12, d = o.d || 10, floors = o.floors || 5, fh = o.fh || 3.1, gh = o.shop === false ? fh : 3.8;
  const wall = o.color || 'bone', trim = o.trim || 'stone', ruin = o.ruin || 0;
  const nb = Math.max(2, Math.round(w / 2.6)), bw = w / nb;
  const nd = Math.max(2, Math.round(d / 2.8)), dw = d / nd;
  // bay heights: a ruined block loses its upper floors unevenly, mostly from one corner
  const corner = r() < 0.5 ? 0 : nb - 1;
  const bayFloors = [];
  for (let i = 0; i < nb; i++) {
    let f = floors;
    if (ruin > 0) { const dist = Math.abs(i - corner) / Math.max(1, nb - 1); const loss = ruin * floors * (1 - dist * 0.85) * (0.55 + r() * 0.6); f = Math.max(1, Math.round(floors - loss)); }
    bayFloors.push(f);
  }
  const inset = 0.28;
  const topOf = f => gh + (f - 1) * fh;     // height of the top of floor f (1 = ground)
  // core
  for (let i = 0; i < nb; i++) {
    const x = -w / 2 + bw * (i + 0.5), top = topOf(bayFloors[i]);
    b.box(wall, bw + 0.01, top, d - inset * 2, x, 0, 0, { r: 0.02 });
  }
  // facades front/back
  for (const side of [1, -1]) {
    const z = side * (d / 2 - inset / 2);
    for (let i = 0; i < nb; i++) {
      const x0 = -w / 2 + bw * i, xc = x0 + bw / 2, nf = bayFloors[i];
      // ground floor: shopfront on the front of a shop block
      if (o.shop !== false && side === 1) {
        b.cbox('glass', bw - 0.5, 2.4, 0.08, xc, 1.35, d / 2 - inset + 0.02, { r: 0.01 });
        b.cbox(trim, bw - 0.46, 0.12, 0.3, xc, 0.06, d / 2 - inset + 0.1, { r: 0.02 });          // step
        b.cbox(trim, bw, 0.9, inset + 0.1, xc, 3.15, z + 0.04, { r: 0.03 });                       // fascia
        if (o.shutters && r() < 0.6) { const sh = 0.6 + r() * 1.6; b.cbox('shutter', bw - 0.55, sh, 0.06, xc, 2.55 - sh / 2, d / 2 - inset + 0.07, { r: 0.01 }); }
      } else windowsRow(b, xc, z, side, bw, gh * 0.5, 1.2, 1.5, o.burnt && r() < 0.3);
      // upper floors
      for (let f = 2; f <= nf; f++) {
        const y0 = topOf(f - 1);
        windowsRow(b, xc, z, side, bw, y0 + 1.05, 1.15, 1.55, o.burnt && r() < 0.35, r() < (o.balcony ?? 0.0) && side === 1);
      }
      // piers
      b.box(trim === 'stone' ? wall : wall, 0.36, topOf(nf), inset + 0.04, x0 + 0.18, 0, z, { r: 0.04 });
      if (i === nb - 1) b.box(wall, 0.36, topOf(nf), inset + 0.04, x0 + bw - 0.18, 0, z, { r: 0.04 });
      // slab bands at each floor line
      for (let f = 1; f < nf; f++) b.cbox(trim, bw + 0.02, 0.22, inset + 0.14, xc, topOf(f), z + side * 0.05, { r: 0.04 });
    }
  }
  // side facades (fewer windows)
  for (const side of [1, -1]) {
    const bay = side === 1 ? nb - 1 : 0, nf = bayFloors[bay], x = side * (w / 2 - inset / 2);
    for (let j = 0; j < nd; j++) {
      const zc = -d / 2 + dw * (j + 0.5);
      for (let f = 2; f <= nf; f++) if ((j + f) % 2 === 0) sideWindow(b, x, zc, side, topOf(f - 1) + 1.05);
      b.box(wall, inset + 0.04, topOf(nf), 0.4, x, 0, -d / 2 + dw * j + 0.2, { r: 0.04 });
    }
    b.box(wall, inset + 0.04, topOf(nf), 0.4, x, 0, d / 2 - 0.2, { r: 0.04 });
    b.box(wall, inset, topOf(nf), d - 0.2, x - side * 0.02, 0, 0, { r: 0.02 });
    for (let f = 1; f < nf; f++) b.cbox(trim, inset + 0.14, 0.22, d + 0.02, x + side * 0.05, topOf(f), 0, { r: 0.04 });
  }
  // roofs and broken tops
  for (let i = 0; i < nb; i++) {
    const x = -w / 2 + bw * (i + 0.5), top = topOf(bayFloors[i]), whole = bayFloors[i] === floors;
    if (whole) {
      b.cbox('roof', bw + 0.02, 0.18, d + 0.04, x, top + 0.09, 0, { r: 0.02 });
      b.cbox('gravel', bw - 0.5, 0.02, d - 0.9, x, top + 0.19, 0, { r: 0.005 });
      if (r() < 0.35) b.cbox('glass', 1.0, 0.12, 1.4, x + (r() - 0.5), top + 0.24, (r() - 0.5) * (d - 3), { r: 0.03 });
      b.box(trim, bw + 0.02, 0.55, 0.22, x, top, d / 2 - 0.1, { r: 0.04 }); b.box(trim, bw + 0.02, 0.55, 0.22, x, top, -d / 2 + 0.1, { r: 0.04 });
      if (i === 0) b.box(trim, 0.22, 0.55, d, -w / 2 + 0.1, top, 0, { r: 0.04 });
      if (i === nb - 1) b.box(trim, 0.22, 0.55, d, w / 2 - 0.1, top, 0, { r: 0.04 });
    } else {
      // broken top: a jagged slab edge with rebar, and a stub of wall
      const sl = 0.24, over = 0.35 + r() * 0.6;
      b.cbox('slab', bw * (0.6 + r() * 0.5), sl, d * (0.5 + r() * 0.4), x + (r() - 0.5) * 0.6, top + 0.02, (r() - 0.5) * 1.2, { r: 0.02, rz: (r() - 0.5) * 0.08, rx: (r() - 0.5) * 0.06 });
      for (let k = 0; k < 4; k++) b.cyl('rebar', 0.025, 0.025, 0.4 + r() * 0.9, x + (r() - 0.5) * bw * 0.9, top, (r() > 0.5 ? 1 : -1) * (d / 2 - 0.3), { seg: 4, rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6 });
      const stubH = fh * (0.3 + r() * 0.7);
      b.box(wall, 0.36, stubH, inset + 0.04, x - bw / 2 + 0.18, top, d / 2 - inset / 2, { r: 0.04, rz: (r() - 0.5) * 0.05 });
      if (r() < 0.6) b.cbox('slab', bw * 0.7, sl, 1.4 + r(), x + (r() - 0.5), top + over * 0.4, d / 2 + 0.2, { r: 0.02, rx: 0.25 + r() * 0.3 });
      // soot on what's left
      b.cbox('soot', bw * 0.8, 0.9, 0.04, x, top - 0.5, d / 2 + 0.02, { r: 0.01 });
    }
  }
  if (o.roofStuff !== false && bayFloors.every(f => f === floors)) roofClutter(b, w, d, topOf(floors), r);
  else if (o.roofStuff !== false) { const i = bayFloors.indexOf(floors); if (i >= 0) { const x = -w / 2 + bw * (i + 0.5); b.box('stone', 1.2, 0.8, 1.0, x, topOf(floors) + 0.18, 0, { r: 0.08 }); } }
  // rubble where floors came down
  if (ruin > 0) {
    const lost = bayFloors.reduce((a, f) => a + floors - f, 0);
    rubble(b, (corner === 0 ? -w / 2 + 2 : w / 2 - 2), d / 2 + 2.2, 1.6 + lost * 0.25, Math.round(14 + lost * 5), r, wall);
    if (r() < 0.6) rubble(b, (corner === 0 ? -w / 2 - 1.2 : w / 2 + 1.2), 0, 1.4 + lost * 0.15, 10 + lost * 2, r, wall);
  }
  // overgrowth climbing the walls
  if (o.vines) {
    const leaf = [M('olive', { flat: true }), M('olive2', { flat: true }), M('moss', { flat: true })];
    for (let k = 0; k < o.vines; k++) {
      const x0 = -w / 2 + 0.6 + r() * (w - 1.2), hh = 2 + r() * (topOf(Math.min(...bayFloors)) * 0.8 - 2);
      // a creeper: dense at the foot, thinning as it climbs, wandering sideways
      let x = x0;
      for (let y = 0.2; y < hh; y += 0.45) {
        const t = y / hh, sz = (0.55 - t * 0.35) * (0.7 + r() * 0.6);
        x += (r() - 0.5) * 0.5;
        b.sph(leaf[Math.floor(r() * 3)], sz, x, y, d / 2 + 0.06, { detail: 0, sz: 0.35, ry: r() * 3 });
        if (r() < 0.5) b.sph(leaf[Math.floor(r() * 3)], sz * 0.7, x + (r() - 0.5) * 0.9, y + 0.2, d / 2 + 0.05, { detail: 0, sz: 0.35 });
      }
      for (let j = 0; j < 3; j++) b.sph(leaf[j], 0.45 + r() * 0.3, x0 + (r() - 0.5) * 1.4, 0.25, d / 2 + 0.4 + r() * 0.4, { detail: 1, sy: 0.6 });
    }
  }
  const g = b.build();
  g.userData.height = topOf(floors);
  return g;
}
function windowsRow(b, xc, z, side, bw, y, ww, wh, burnt, balcony) {
  ww = Math.min(ww * 1.22, bw - 0.7); wh *= 1.08;
  // spandrel below, lintel above (in the facade plane), glass set back with a slim frame
  b.cbox('glass', ww, wh, 0.06, xc, y + wh / 2, z - side * 0.12, { r: 0.01 });
  b.cbox('frame', 0.06, wh, 0.1, xc, y + wh / 2, z - side * 0.1, { r: 0.01 });                        // mullion
  b.cbox('stone', ww + 0.3, 0.09, 0.3, xc, y - 0.02, z + side * 0.06, { r: 0.03 });                     // sill
  const yb = y - 1.05 + 0.02;
  b.box(b._wall || 'bone', bw - 0.34, 1.05 - 0.04, 0.3, xc, yb, z, { r: 0.03 });                       // spandrel
  if (burnt) b.cbox('soot', ww + 0.2, 0.9, 0.03, xc, y + wh + 0.35, z + side * 0.16, { r: 0.01 });
  if (balcony) { b.cbox('stone', bw - 0.5, 0.14, 1.1, xc, y - 0.05, z + side * 0.6, { r: 0.04 }); for (let k = -1; k <= 1; k += 2) b.box('frame', 0.05, 0.95, 0.05, xc + k * (bw / 2 - 0.3), y, z + side * 1.1, { r: 0.01 }); b.cbox('frame', bw - 0.55, 0.05, 0.05, xc, y + 0.95, z + side * 1.1, { r: 0.01 }); }
}
function sideWindow(b, x, zc, side, y) { b.cbox('glass', 0.06, 1.5, 1.0, x - side * 0.12, y + 0.75, zc, { r: 0.01 }); b.cbox('stone', 0.3, 0.09, 1.2, x + side * 0.06, y - 0.02, zc, { r: 0.03 }); }
function roofClutter(b, w, d, top, r) {
  const n = 1 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { const x = (r() - 0.5) * (w - 3), z = (r() - 0.5) * (d - 3); b.box('steel', 1.1, 0.75, 0.8, x, top + 0.18, z, { r: 0.08 }); b.cbox('dark', 0.7, 0.04, 0.7, x, top + 0.95, z, { r: 0.01 }); }
  if (r() < 0.6) { const x = (r() - 0.5) * (w - 4), z = (r() - 0.5) * (d - 4); for (const [a, c] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box('metal', 0.08, 1.1, 0.08, x + a, top + 0.18, z + c, { r: 0.01 }); b.cyl('stone', 1.0, 1.0, 1.4, x, top + 1.25, z, { seg: 14 }); b.cyl('roof2', 0.15, 1.05, 0.4, x, top + 2.65, z, { seg: 14 }); }
  if (r() < 0.7) { const x = (r() - 0.5) * (w - 3); b.box('stone', 2.2, 2.4, 2.0, x, top + 0.18, -d / 2 + 1.8, { r: 0.06 }); }
}
function rubble(b, x, z, rad, n, r, wall = 'bone') {
  const cols = [wall, 'slab', 'stone', 'slab', 'dark'];
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, dd = Math.sqrt(r()) * rad, s = 0.25 + r() * 0.7 * (1 - dd / rad * 0.5);
    b.cbox(cols[k % cols.length], s * (1 + r()), s * 0.6, s * (0.8 + r()), x + Math.cos(a) * dd, s * 0.25 + (1 - dd / rad) * rad * 0.35 * r(), z + Math.sin(a) * dd, { r: 0.03, rx: r() * 3, ry: r() * 3, rz: r() * 3 });
  }
  for (let k = 0; k < n / 4; k++) { const a = r() * 6.28, dd = r() * rad; b.cyl('rebar', 0.02, 0.02, 0.6 + r(), x + Math.cos(a) * dd, 0.1, z + Math.sin(a) * dd, { seg: 4, rx: r() * 1.5, rz: r() * 1.5 }); }
}

// ======================================================================
// STREETS: asphalt, sidewalks with curbs, markings, crossings, cracks
// ======================================================================
/** a whole grid of streets. blocks: [{x, z, w, d}] are the raised sidewalk islands. */
function streets(o) {
  const b = new B(), r = rng(o.seed || 7);
  const W = o.W, D = o.D;
  b.cbox('asphalt', W, 0.1, D, 0, -0.05, 0, { r: 0.001 });
  for (const bl of o.blocks) {
    b.box('curb', bl.w, 0.16, bl.d, bl.x, 0, bl.z, { r: 0.05 });
    b.box(bl.ground || 'sidewalk', bl.w - 0.3, 0.17, bl.d - 0.3, bl.x, 0, bl.z, { r: 0.02 });
    // paving joints give the sidewalk scale
    if (!bl.ground) for (let k = -bl.w / 2 + 1.5; k < bl.w / 2; k += 1.5) { b.cbox('tile', 0.03, 0.01, 2.6, bl.x + k, 0.175, bl.z - bl.d / 2 + 1.5, { r: 0.001 }); b.cbox('tile', 0.03, 0.01, 2.6, bl.x + k, 0.175, bl.z + bl.d / 2 - 1.5, { r: 0.001 }); }
  }
  // lane markings: dashed centre lines on every street
  for (const s of o.lanes || []) {
    const len = s.len, n = Math.floor(len / 4.5);
    for (let k = 0; k < n; k++) {
      if (r() < 0.18) continue;                     // faded away
      const t = -len / 2 + (k + 0.5) * 4.5;
      if (s.axis === 'x') b.cbox('paint', 2.2, 0.012, 0.16, s.x + t, 0.006, s.z, { r: 0.001 });
      else b.cbox('paint', 0.16, 0.012, 2.2, s.x, 0.006, s.z + t, { r: 0.001 });
    }
  }
  for (const c of o.crossings || []) {
    for (let k = 0; k < 7; k++) {
      if (r() < 0.12) continue;
      const t = -3.6 + k * 1.2;
      if (c.axis === 'x') b.cbox('paint', 0.55, 0.012, 3.2, c.x + t, 0.006, c.z, { r: 0.001 });
      else b.cbox('paint', 3.2, 0.012, 0.55, c.x, 0.006, c.z + t, { r: 0.001 });
    }
  }
  // cracks and patches
  for (let k = 0; k < (o.cracks || 60); k++) {
    const x = (r() - 0.5) * W, z = (r() - 0.5) * D;
    if (r() < 0.5) b.cbox('asphalt2', 1 + r() * 3, 0.006, 0.8 + r() * 2, x, 0.003, z, { r: 0.001, ry: r() * 3 });
    else b.cbox('soot', 0.05, 0.008, 1 + r() * 2.5, x, 0.004, z, { r: 0.001, ry: r() * 3 });
  }
  for (const mh of o.manholes || []) b.cyl('dark', 0.35, 0.35, 0.02, mh[0], 0, mh[1], { seg: 16 });
  return b.build({ cast: false });
}
function weeds(o) {
  const b = new B(), r = rng(o.seed || 13), c = [M('olive', { flat: true }), M('olive2', { flat: true }), M('dry', { flat: true })];
  for (const [x0, z0, w, d, n] of o.patches) for (let k = 0; k < n; k++) b.sph(c[k % 3], 0.18 + r() * 0.3, x0 + (r() - 0.5) * w, 0.02, z0 + (r() - 0.5) * d, { detail: 0, sy: 0.45, ry: r() * 3 });
  return b.build();
}
function grass(o) {
  const b = new B(), r = rng(o.seed || 3);
  b.box(o.base || 'dry', o.w, 0.2, o.d, 0, 0, 0, { r: 0.04 });
  for (let k = 0; k < (o.n ?? 30); k++) { const x = (r() - 0.5) * (o.w - 0.6), z = (r() - 0.5) * (o.d - 0.6); b.sph(r() < 0.5 ? 'olive' : 'moss', 0.25 + r() * 0.35, x, 0.25, z, { detail: 1, sy: 0.5 }); }
  return b.build();
}

export { apartment, rubble, streets, weeds, grass };
