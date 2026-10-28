// [medium] The One-medium figures: Kai and the Ash-Born built from simple solids (as in the Looks Lab), so the Glyph
// atom turns them into letters that read: Kai a yellow suit with a hi-vis band, a red bandana with its knot and a long
// wrench; the dead pale hunched stone with arms reaching, burning cracks and ember eyes (bright, through the letters).
// A fall sinks into the grass as a lump with a few stones. The old rig and crowd bodies are hidden in this look.
// Render only. Null with ?look=classic.
/* global THREE */
import { MEDIUM } from '../medium.js';
import { TOP_FIG } from '../top.js';
import { MOBS } from '../../content/mobs.js';
import { K } from '../kit.js';

export function createFigs(V) {
  if (!MEDIUM) return null;
  const { S, world, Wv } = V;
  if (V.crowd && V.crowd.mats) { V.crowd.mats.body.visible = false; V.crowd.mats.eye.visible = false; }   // the dead are drawn here
  const solid = K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { rim: true });
  const glow = c => new THREE.MeshBasicMaterial({ color: c });
  const col = (r, g, b) => new THREE.Color(r, g, b).convertSRGBToLinear();
  // coloured parts merged into one geometry
  function merge(parts) {
    let n = 0; const gs = parts.map(([g, c, m]) => { g = g.index ? g.toNonIndexed() : g.clone(); if (m) g.applyMatrix4(m); n += g.attributes.position.count; return [g, c]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cl = new Float32Array(n * 3); let o = 0;
    for (const [g, c] of gs) { const k = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (let i = 0; i < k; i++) cl.set([c.r, c.g, c.b], (o + i) * 3); o += k; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(cl, 3)); return out;
  }
  const M4 = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const box = (w, h, d, y0 = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0 + h / 2, 0); return g; };
  const limb = (len, r, c) => { const m = new THREE.Mesh(merge([[new THREE.CylinderGeometry(r, r * 0.9, len, 6).translate(0, -len / 2, 0), c]]), solid); m.castShadow = true; return m; };

  // ---------- Kai ----------
  const KC = { suit: col(0.98, 0.72, 0.16), band: col(0.95, 0.97, 0.95), red: col(0.92, 0.2, 0.17), hair: col(0.42, 0.3, 0.22), pants: col(0.42, 0.36, 0.26), steel: col(0.84, 0.87, 0.9) };
  const kai = new THREE.Group(); world.add(kai);
  const legs = [-1, 1].map(s => { const l = limb(0.8, 0.08, KC.pants); l.position.set(0, 0.82, s * 0.1); kai.add(l); return l; });
  const torso = new THREE.Mesh(merge([[box(0.28, 0.58, 0.46, 0.8), KC.suit], [box(0.08, 0.59, 0.47, 0.8), KC.band, M4(0.06, 0, 0)]]), solid); torso.castShadow = true; kai.add(torso);
  const arms = [-1, 1].map(s => { const a = limb(0.62, 0.07, KC.suit); a.position.set(0.02, 1.33, s * 0.28); kai.add(a); return a; });
  const head = new THREE.Mesh(merge([[new THREE.SphereGeometry(0.155, 10, 8).translate(0, 1.55, 0), KC.hair], [new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0.03, 1.58, 0), KC.red], [new THREE.SphereGeometry(0.065, 6, 5).translate(-0.17, 1.6, 0), KC.red]]), solid); head.castShadow = true; kai.add(head);
  const wrench = new THREE.Mesh(merge([[new THREE.CylinderGeometry(0.045, 0.045, 0.85, 6).rotateZ(Math.PI / 2).translate(0.42, 0, 0), KC.steel], [new THREE.TorusGeometry(0.1, 0.04, 5, 10, Math.PI * 1.4).rotateZ(-Math.PI * 0.7).translate(0.92, 0, 0), KC.steel]]), solid);
  wrench.position.set(0, -0.6, 0); arms[1].add(wrench);

  // ---------- the Ash-Born: instanced parts ----------
  const CAP = 260, stone = col(0.78, 0.76, 0.72);
  const stoneMat = K.territory(new THREE.MeshStandardMaterial({ color: stone, roughness: 0.95 }), { rim: true });
  const crackMat = glow(new THREE.Color(1, 0.42, 0.12)), eyeMat = glow(new THREE.Color(1.6, 0.9, 0.4));
  const part = (geo, mat, n = 1) => { const m = new THREE.InstancedMesh(geo, mat, CAP * n); m.count = 0; m.frustumCulled = false; m.castShadow = mat === stoneMat; world.add(m); return m; };
  const P = { torso: part(box(0.3, 0.58, 0.44, -0.29), stoneMat), head: part(new THREE.SphereGeometry(0.14, 8, 6), stoneMat), limb: part(new THREE.CylinderGeometry(0.065, 0.06, 1, 6).translate(0, -0.5, 0), stoneMat, 4), crack: part(box(0.05, 0.02, 0.24, 0), crackMat, 3), eye: part(new THREE.SphereGeometry(0.035, 6, 4), eyeMat, 2), lump: part(new THREE.SphereGeometry(0.3, 8, 6), stoneMat, 6) };
  const tmp = new THREE.Object3D(), B = new THREE.Matrix4(), mB = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), vs = new THREE.Vector3(), vp = new THREE.Vector3();
  const local = (x, y, z, rx, rz, sx = 1, sy = 1, sz = 1) => { tmp.position.set(x, y, z); tmp.rotation.set(rx, 0, rz); tmp.scale.set(sx, sy, sz); tmp.updateMatrix(); return mB.multiplyMatrices(B, tmp.matrix); };
  const face = new Map(), falls = [], alive = new Map();
  let lastT = 0;

  function update(dt) {
    const t = V.time, h = S.hero, F = TOP_FIG;
    // Kai
    kai.visible = !h.dead;
    if (!h.dead) {
      kai.position.copy(Wv(h.x, h.y)); kai.scale.setScalar(F);
      const yaw = (h.face || 0) - Math.PI / 2;   // (the game's face 0 looks down +z; these figures are built facing +x) let d = yaw - kai.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); kai.rotation.y += d * Math.min(1, dt * 14);
      const wk = h.moving ? Math.sin(t * 10) : 0, sw = h.swing > 0 ? 1 - h.swing / 0.25 : 0;
      legs[0].rotation.z = wk * 0.5; legs[1].rotation.z = -wk * 0.5; arms[0].rotation.z = -wk * 0.4; arms[1].rotation.z = 0.5 + Math.sin(sw * Math.PI) * 1.8; arms[1].rotation.x = -0.25;
    }
    // the dead
    let nt = 0, nl = 0, nc = 0, ne = 0, nm = 0;
    const seen = new Set();
    for (const m of S.mobs) {
      const def = MOBS[m.kind]; if (!def || def.animal || def.still) continue;
      seen.add(m.id); const pr = alive.get(m.id) || { x: m.x, y: m.y, fa: m.face || 0, ph: Math.random() * 6, kind: m.kind }; alive.set(m.id, pr);
      const vx = m.x - pr.x, vy = m.y - pr.y, sp = Math.hypot(vx, vy) / Math.max(dt, 1e-3); if (sp > 0.2) pr.fa = Math.atan2(vy, vx); pr.x = m.x; pr.y = m.y; pr.ph += dt * Math.min(6, sp) * 2.4;
      if (V.seenAt && !V.seenAt(m.x, m.y)) continue;
      const big = def.size >= 1.6, s = F * (def.size || 1) * (m.unique ? 1.35 : 1), rise = Math.max(0.15, Math.min(1, m.rise ?? 1));
      vp.copy(Wv(m.x, m.y)); vp.y -= (1 - rise) * 1.6 * s; q.setFromEuler(e3.set(0, -pr.fa, 0)); B.compose(vp, q, vs.set(s, s, s));
      const sw = Math.sin(pr.ph), lunge = m.attacking ? Math.max(0, Math.sin(t * 6 + pr.ph)) * 0.35 : 0;
      P.torso.setMatrixAt(nt, local(lunge * 0.3, 1.08, 0, 0, 0.18 + lunge * 0.4, big ? 1.3 : 1, 1, big ? 1.25 : 1)); P.head.setMatrixAt(nt, local(0.22 + lunge * 0.4, 1.24, 0, 0, 0)); nt++;
      for (const sd of [-1, 1]) { P.limb.setMatrixAt(nl++, local(0, 0.8, sd * 0.1, 0, sw * 0.45 * sd, 1, 0.8, 1)); P.limb.setMatrixAt(nl++, local(0.06, 1.2, sd * 0.24, -sd * 0.12, 1.4 + lunge + sw * 0.12 * sd, 1, 0.68, 1)); }
      for (let c = 0; c < (big ? 3 : 2); c++) P.crack.setMatrixAt(nc++, local(-0.04 + c * 0.06, 1.385, (c - 0.5) * 0.12, 0, 0.18));
      for (const sd of [-1, 1]) P.eye.setMatrixAt(ne++, local(0.34 + lunge * 0.4, 1.28, sd * 0.05, 0, 0));
      if (nt >= CAP) break;
    }
    // a fall: the body sinks into the grass as a lump, a few stones roll off
    for (const [id, pr] of alive) if (!seen.has(id)) { falls.push({ x: pr.x, y: pr.y, fa: pr.fa, t0: t, big: MOBS[pr.kind] && MOBS[pr.kind].size >= 1.6 }); alive.delete(id); }
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i], k = (t - f.t0) / 0.8; if (k >= 1) { falls.splice(i, 1); continue; }
      const s = F * (f.big ? 1.6 : 1), ee = 1 - (1 - k) * (1 - k), r = 0.85 * (1 - 0.7 * k);
      vp.copy(Wv(f.x, f.y)); q.setFromEuler(e3.set(0, -f.fa, 0)); B.compose(vp, q, vs.set(s, s, s));
      P.lump.setMatrixAt(nm++, local(0.3 * ee, 0.3 * r - 0.5 * k, 0, 0, 0, r, r * 0.8, r));
      for (let j = 0; j < 4; j++) { const a = (j - 1.5) * 1.1, dd = 0.2 + 0.55 * ee; P.lump.setMatrixAt(nm++, local(Math.cos(a) * dd, 0.02, Math.sin(a) * dd, 0, 0, 0.2 * (1 - k), 0.2 * (1 - k), 0.2 * (1 - k))); }
    }
    P.torso.count = P.head.count = nt; P.limb.count = nl; P.crack.count = nc; P.eye.count = ne; P.lump.count = nm;
    for (const m of Object.values(P)) m.instanceMatrix.needsUpdate = true;
    // the cracks breathe; at night they burn
    const pulse = 0.6 + 0.4 * Math.sin(t * 3), n = V.dark || 0; crackMat.color.setRGB(0.5 + 0.9 * n * pulse, 0.2 + 0.35 * n * pulse, 0.06);
    lastT = t;
  }
  return { update };
}
