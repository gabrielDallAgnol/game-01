// Hollowmere city kit · Farms: plot, beds and polytunnel, barn and greenhouse.
/* global THREE */
import { WIN, M } from './materials.js';
import { rng } from './rng.js';
import { B } from './builder.js';
import { shade, rod, sagPts, cord, blooms, flag, drum, sheet } from './craft.js';

/** farms: 1 a scratched-out plot behind a scrap fence, 2 tidy beds + polytunnel + shed, 3 a red barn, greenhouse, bright crops, wind pump */
function farm(o = {}) {
  const lvl = o.level || 1, b = new B(), r = rng(o.seed || 41), w = o.w || 9, d = o.d || 8, own = !!o.own;
  const fenceLine = (p, q, step, post) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / step)), pts = []; for (let k = 0; k <= n; k++) { const t = k / n, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t; pts.push([x, z]); post(x, z, k); } return pts; };
  if (lvl === 1) {
    // survival: dug-over ground, sparse muted rows, tyre planters, a scrap fence, a tarp over the sacks, a scarecrow
    b.box('#5f5444', w - 0.8, 0.12, d - 0.8, 0, 0, 0, { r: 0.04 });
    for (let k = 0; k < 4; k++) {
      const z = -d / 2 + 1.7 + k * 1.15, x = -0.7, bw = w - 3.4;
      b.cbox('#4e4436', bw, 0.16, 0.5, x, 0.16, z, { r: 0.06 });
      for (let c = 0; c < 9; c++) if (r() < 0.6) b.sph(r() < 0.5 ? 'olive2' : 'dry', 0.12 + r() * 0.1, x - bw / 2 + 0.3 + c * ((bw - 0.6) / 8), 0.28, z + (r() - 0.5) * 0.2, { detail: 0, sy: 0.8 });
    }
    for (const [x, z] of [[w / 2 - 1.0, d / 2 - 1.0], [w / 2 - 1.9, d / 2 - 0.9], [w / 2 - 1.4, d / 2 - 1.8]]) { b.geo('tyre', new THREE.TorusGeometry(0.36, 0.15, 6, 10), x, 0.24, z, Math.PI / 2, 0, 0); b.sph('#5f6a42', 0.26, x, 0.32, z, { detail: 0, sy: 0.7 }); }
    // scrap fence: odd posts and sagging wire on two sides, a sheet of tin
    const posts = ['#6a5a48', 'metal', '#7b766c', '#5a5045'];
    const wire = pts => { for (const y of [0.45, 0.95]) for (let k = 1; k < pts.length; k++) cord(b, sagPts([pts[k - 1][0], y, pts[k - 1][1]], [pts[k][0], y, pts[k][1]], 2, 0.05), '#5a5650', 0.025); };
    const post = (x, z) => b.box(posts[Math.floor(r() * 4)], 0.1, 1.0 + r() * 0.35, 0.1, x, 0, z, { r: 0.02, rx: (r() - 0.5) * 0.12, rz: (r() - 0.5) * 0.12 });
    wire(fenceLine([-w / 2 + 0.3, -d / 2 + 0.3], [w / 2 - 0.3, -d / 2 + 0.3], 1.4, post));
    wire(fenceLine([-w / 2 + 0.3, -d / 2 + 0.3], [-w / 2 + 0.3, d / 2 - 0.3], 1.4, post));
    sheet(b, 'rust', 1.7, 1.0, 0.8, 0.6, -d / 2 + 0.36);
    // the tarp lean-to with sacks and a drum
    const tx = w / 2 - 1.2, tz = -d / 2 + 1.5;
    for (const [x, z, hh] of [[tx + 0.85, tz - 1.1, 1.8], [tx + 0.85, tz + 1.1, 1.8], [tx - 0.85, tz - 1.1, 1.25], [tx - 0.85, tz + 1.1, 1.25]]) b.box('#6a5a48', 0.09, hh, 0.09, x, 0, z, { r: 0.02 });
    b.cbox('#6b6650', 1.95, 0.04, 2.5, tx, 1.55, tz, { r: 0.01, rz: 0.3 });
    for (let k = 0; k < 4; k++) b.sph('bag', 0.3, tx - 0.4 + (k % 2) * 0.55, 0.25 + Math.floor(k / 2) * 0.32, tz - 0.4 + (k % 3) * 0.35, { detail: 0, sy: 0.7 });
    drum(b, 'rust', tx + 0.4, tz + 0.75);
    // a scarecrow in rags
    const sx = -1.2, sz2 = 0.5;
    b.box('#6a5a48', 0.09, 2.3, 0.09, sx, 0, sz2, { r: 0.02 }); b.cbox('#6a5a48', 1.4, 0.08, 0.08, sx, 1.75, sz2, { r: 0.01 });
    b.cbox('#5b5348', 0.7, 0.85, 0.28, sx, 1.45, sz2, { r: 0.04, rz: 0.06 }); b.cbox('#4e463c', 0.25, 0.4, 0.2, sx + 0.55, 1.6, sz2, { r: 0.03, rz: 0.4 });
    b.sph('bag', 0.2, sx, 2.25, sz2, { detail: 0 }); b.cyl('#3a3633', 0.26, 0.26, 0.04, sx, 2.36, sz2, { seg: 8 }); b.cyl('#3a3633', 0.13, 0.15, 0.2, sx, 2.38, sz2, { seg: 8 });
    b.cyl('metal', 0.14, 0.11, 0.28, -w / 2 + 1.1, 0.12, d / 2 - 0.9, { seg: 8 });
  } else if (lvl === 2) {
    // holding on: tidy raised beds full of green, a polytunnel, a little painted shed with a flag, a post-and-rail fence
    b.box('#6f6048', w - 0.3, 0.16, d - 0.3, 0, 0, 0, { r: 0.04 });
    const bx = 1.0, bw = w - 4.2;
    for (const z of [-2.5, -0.8, 0.9]) {
      b.box('wood2', bw, 0.42, 1.15, bx, 0.16, z, { r: 0.03 });
      b.box('#3f362c', bw - 0.16, 0.05, 1.0, bx, 0.56, z, { r: 0.01 });
      for (let c = 0; c < 8; c++) for (const dz of [-0.25, 0.25]) b.sph((c + (dz > 0)) % 2 ? '#6f8f45' : '#5d7f3a', 0.17 + r() * 0.06, bx - bw / 2 + 0.3 + c * ((bw - 0.6) / 7), 0.72, z + dz, { detail: 0, sy: 0.8 });
    }
    const tg = new THREE.CylinderGeometry(1.3, 1.3, 5.2, 12, 1, true, 0, Math.PI), tm = new THREE.Mesh(tg, M('canvas', { opacity: 0.85, side: THREE.DoubleSide }));
    tm.rotation.x = Math.PI / 2; tm.rotation.y = Math.PI / 2; tm.position.set(-w / 2 + 1.75, 0.16, -0.4); tm.castShadow = true; tm.receiveShadow = true; b.add(tm);
    for (let k = 0; k < 5; k++) b.geo('#cfc6ae', new THREE.TorusGeometry(1.3, 0.035, 4, 12, Math.PI), -w / 2 + 1.75, 0.16, -2.9 + k * 1.25, 0, 0, 0);
    // the shed
    const hx = w / 2 - 1.3, hz = d / 2 - 1.25, sw = o.color || '#8e9a88';
    b.box(sw, 1.9, 1.9, 1.6, hx, 0.16, hz, { r: 0.03 });
    for (let y = 0.5; y < 2.0; y += 0.4) b.cbox(shade(sw, -0.05), 1.93, 0.04, 1.63, hx, y, hz, { r: 0.004 });
    b.cbox('#5a4d42', 2.3, 0.1, 2.0, hx, 2.25, hz, { r: 0.01, rx: 0.18 });
    b.cbox('wood2', 0.7, 1.4, 0.05, hx - 0.3, 0.86, hz + 0.81, { r: 0.006 });
    if (own) flag(b, hx + 0.8, 2.2, hz - 0.6, 1.1, 0.6);
    drum(b, '#5c7080', w / 2 - 0.55, -d / 2 + 0.7); drum(b, '#5c7080', w / 2 - 1.2, -d / 2 + 0.6);
    for (const [x, c] of [[-0.4, '#b77a40'], [0.35, '#6f8a4a']]) { b.box('wood', 0.65, 0.35, 0.5, x, 0.16, d / 2 - 0.8, { r: 0.03, ry: x }); for (let k = 0; k < 3; k++) b.sph(c, 0.13, x - 0.17 + k * 0.17, 0.55, d / 2 - 0.8, { detail: 0 }); }
    // post-and-rail fence with a gap for the gate
    const rails = (pts, gap) => { for (let k = 1; k < pts.length; k++) { if (gap && k === gap) continue; for (const y of [0.45, 0.85]) rod(b, '#7a6550', [pts[k - 1][0], y, pts[k - 1][1]], [pts[k][0], y, pts[k][1]], 0.06); } };
    const post = (x, z) => b.box('#6a5848', 0.12, 1.0, 0.12, x, 0, z, { r: 0.02 });
    const e = 0.2;
    rails(fenceLine([-w / 2 + e, -d / 2 + e], [w / 2 - e, -d / 2 + e], 1.5, post));
    rails(fenceLine([-w / 2 + e, -d / 2 + e], [-w / 2 + e, d / 2 - e], 1.5, post));
    rails(fenceLine([w / 2 - e, -d / 2 + e], [w / 2 - e, d / 2 - e], 1.5, post));
    rails(fenceLine([-w / 2 + e, d / 2 - e], [w / 2 - e, d / 2 - e], 1.5, post), 3);
  } else {
    // thriving: a red barn with white trim, a greenhouse, bright rows of pumpkins, tomatoes and sunflowers, a wind pump, beehives, a picket fence
    b.box('#7f9a4f', w, 0.14, d, 0, 0, 0, { r: 0.04 });
    // the barn (gable to the front)
    const gx = -w / 2 + 1.7, gz = -d / 2 + 1.55, bw = 2.8, bd = 2.5, bh = 2.3, red = '#c0462f', white = '#f4efe4', roofC = o.roof || '#2f8f88';
    b.box(red, bw, bh, bd, gx, 0.14, gz, { r: 0.03 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(white, 0.14, bh, 0.14, gx + x * bw / 2, 0.14, gz + z * bd / 2, { r: 0.02 });
    { const s = new THREE.Shape(); s.moveTo(-bd / 2, 0); s.lineTo(bd / 2, 0); s.lineTo(0, 1.12); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: bw, bevelEnabled: false }); g.translate(0, 0, -bw / 2); g.rotateY(Math.PI / 2); b.geo(red, g, gx, bh + 0.14, gz); }
    const run = bd / 2 + 0.25, ang = Math.atan2(1.35, run), Lr = Math.hypot(run, 1.35) + 0.06;
    for (const s of [-1, 1]) b.cbox(roofC, bw + 0.4, 0.12, Lr, gx, bh + 0.14 + 0.68, gz + s * run / 2, { r: 0.02, rx: s * ang });
    b.cbox(white, bw + 0.44, 0.14, 0.2, gx, bh + 0.14 + 1.38, gz, { r: 0.02 });
    const fzb = gz + bd / 2;
    b.cbox(white, 1.4, 1.75, 0.06, gx, 1.0, fzb + 0.01, { r: 0.005 }); b.cbox(shade(red, -0.08), 1.2, 1.55, 0.05, gx, 1.0, fzb + 0.03, { r: 0.005 });
    rod(b, white, [gx - 0.55, 0.3, fzb + 0.06], [gx + 0.55, 1.7, fzb + 0.06], 0.08); rod(b, white, [gx + 0.55, 0.3, fzb + 0.06], [gx - 0.55, 1.7, fzb + 0.06], 0.08);
    b.cbox(o.game ? WIN : 'glass', 0.05, 0.5, 0.5, gx + bw / 2 + 0.02, bh + 0.6, gz, { r: 0.005 });
    if (own) flag(b, gx, bh + 1.5, gz, 1.3, 0.8, 'amber', -Math.PI / 2);
    // the greenhouse
    const hx = w / 2 - 2.0, hz = -d / 2 + 1.5, hw = 3.4, hd = 2.4;
    b.box('steel', hw, 0.3, hd, hx, 0.14, hz, { r: 0.02 });
    for (let k = 0; k <= 4; k++) { const x = hx - hw / 2 + k * hw / 4; b.box('steel', 0.06, 1.6, 0.06, x, 0.44, hz - hd / 2, { r: 0.01 }); b.box('steel', 0.06, 1.6, 0.06, x, 0.44, hz + hd / 2, { r: 0.01 }); }
    const gm = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.05, 1.6, hd - 0.05), M('#cfe3d6', { opacity: 0.32, rough: 0.15, depthWrite: false })); gm.position.set(hx, 1.24, hz); b.add(gm);
    { const s = new THREE.Shape(); s.moveTo(-hd / 2, 0); s.lineTo(hd / 2, 0); s.lineTo(0, 0.9); s.closePath(); const rg = new THREE.ExtrudeGeometry(s, { depth: hw, bevelEnabled: false }); rg.translate(0, 0, -hw / 2); const rm = new THREE.Mesh(rg, M('#cfe3d6', { opacity: 0.38, rough: 0.15, depthWrite: false })); rm.rotation.y = Math.PI / 2; rm.position.set(hx, 2.04, hz); b.add(rm); }
    for (let k = 0; k < 7; k++) { const x = hx + (r() - 0.5) * (hw - 0.6), z = hz + (r() - 0.5) * (hd - 0.6); b.sph('#5c8a3c', 0.3, x, 0.7, z, { detail: 0 }); if (k % 2) b.sph('#d8452f', 0.09, x + 0.15, 0.85, z + 0.15, { detail: 0 }); }
    // crop rows: lettuce, tomatoes, pumpkins, cabbages
    const x0 = -w / 2 + 1.6, x1 = w / 2 - 1.4;
    [0.05, 1.05, 2.05, 3.0].forEach((z, row) => {
      b.cbox('#4a3a2a', x1 - x0, 0.1, 0.7, (x0 + x1) / 2, 0.18, z, { r: 0.03 });
      for (let c = 0; c < 10; c++) {
        const x = x0 + 0.3 + c * (x1 - x0 - 0.6) / 9, zz = z + (r() - 0.5) * 0.12;
        if (row === 0) b.sph('#8cc152', 0.2, x, 0.32, zz, { detail: 0, sy: 0.75 });
        else if (row === 1) { b.sph('#5d8a3a', 0.24, x, 0.42, zz, { detail: 0, sy: 1.2 }); b.sph('#d8452f', 0.08, x + 0.12, 0.45, zz + 0.12, { detail: 0 }); b.sph('#e0562f', 0.08, x - 0.1, 0.6, zz + 0.1, { detail: 0 }); }
        else if (row === 2) { if (c % 2) b.sph('#e8862e', 0.25, x, 0.33, zz, { detail: 0, sy: 0.72 }); else b.sph('#4f7d34', 0.22, x, 0.3, zz, { detail: 0, sy: 0.5, sx: 1.4 }); }
        else b.sph('#9bc06a', 0.21, x, 0.32, zz, { detail: 0 });
      }
    });
    // sunflowers along the side
    for (let k = 0; k < 5; k++) { const x = -w / 2 + 0.7, z = -0.2 + k * 0.85, hh = 1.6 + r() * 0.5; b.box('#4f7d34', 0.06, hh, 0.06, x, 0.14, z, { r: 0.01 }); b.cyl('#ffd166', 0.26, 0.26, 0.06, x + 0.04, hh + 0.14, z, { rz: Math.PI / 2 - 0.4, seg: 10 }); b.cyl('#6b4a2a', 0.12, 0.12, 0.07, x + 0.06, hh + 0.14, z, { rz: Math.PI / 2 - 0.4, seg: 8 }); }
    // the wind pump between barn and greenhouse
    const px = -0.1, pz = -d / 2 + 0.75, PH = 6.4;
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(b, white, [px + a * 0.6, 0.14, pz + c * 0.6], [px + a * 0.12, PH, pz + c * 0.12], 0.07);
    for (const y of [1.8, 3.6]) { const q = 0.6 - 0.48 * y / PH; rod(b, white, [px - q, y, pz + q], [px + q, y, pz + q], 0.05); rod(b, white, [px + q, y, pz - q], [px + q, y, pz + q], 0.05); }
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; b.cbox(k % 2 ? white : 'amber', 0.2, 1.1, 0.04, px + Math.sin(a) * 0.62, PH + 0.3 + Math.cos(a) * 0.62, pz + 0.3, { r: 0.01, rz: -a }); }
    b.cyl('#3a3a38', 0.12, 0.12, 0.2, px, PH + 0.3, pz + 0.2, { rx: Math.PI / 2, seg: 8 }); b.cbox(red, 0.04, 0.5, 0.8, px, PH + 0.3, pz - 0.5, { r: 0.006 });
    // beehives
    for (const z of [0.3, 1.3]) { const x = w / 2 - 0.55; b.box(white, 0.5, 0.55, 0.45, x, 0.14, z, { r: 0.03 }); b.cbox('#ffd166', 0.58, 0.08, 0.52, x, 0.72, z, { r: 0.02 }); }
    // a white picket fence with flowers along it
    const pick = (x, z) => b.box(white, 0.08, 0.75, 0.05, x, 0.14, z, { r: 0.01 });
    const runP = (p, q, ax) => { const L = ax === 'x' ? q - p : q - p, n = Math.round(Math.abs(L) / 0.36); for (let k = 0; k <= n; k++) { const t = p + (q - p) * k / n; ax === 'x' ? pick(t, d / 2 - 0.15) : pick(ax, t); } };
    runP(-w / 2 + 0.15, -0.7, 'x'); runP(0.7, w / 2 - 0.15, 'x');
    for (const y of [0.42, 0.72]) { b.cbox(white, w / 2 - 0.85, 0.06, 0.04, (-w / 2 + 0.15 - 0.7) / 2, y, d / 2 - 0.12, { r: 0.005 }); b.cbox(white, w / 2 - 0.85, 0.06, 0.04, (w / 2 - 0.15 + 0.7) / 2, y, d / 2 - 0.12, { r: 0.005 }); }
    for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.15); const n = 9; for (let k = 0; k <= n; k++) b.box(white, 0.05, 0.75, 0.08, x, 0.14, -0.5 + k * (d / 2 - 0.15 + 0.5) / n, { r: 0.01 }); for (const y of [0.42, 0.72]) b.cbox(white, 0.04, 0.06, d / 2 + 0.35, x + sx * 0.02, y, (d / 2 - 0.65) / 2, { r: 0.005 }); }
    for (const [a, c] of [[-w / 2 + 0.5, -0.9], [0.9, w / 2 - 0.5]]) blooms(b, (a + c) / 2, 0.3, d / 2 - 0.45, c - a, 12, r, 0.3);
  }
  return b.build({ vc: true });
}

export { farm };
