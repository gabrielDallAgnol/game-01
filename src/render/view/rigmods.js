// [mech] The Haven Rig's modules drawn on the truck (view/keep.js draws Hilde herself): flat shapes that read from
// above, each with a signal-blue rim (it is yours): Bunks on the bed, the Roof Turret on the module roof (it turns to
// the nearest Ash-Born in range), the Workshop bench behind the truck, Floodlights on the cab (a warm lit disc on the
// ground at night), the Rig Radio's mast and Plating along the sides. Built in the truck's own frame (metres before
// its 0.3 scale), rebuilt when a module's level changes or the truck model is rebuilt.
/* global THREE */
import { READ } from '../readable.js';

const lin = c => new THREE.Color(c).convertSRGBToLinear();
export function createRigMods(V) {
  const { S, C, game } = V;
  if (!game.rigLevel) return null;
  const mats = {}, mat = (c, o = {}) => mats[c + (o.opacity || '')] || (mats[c + (o.opacity || '')] = new THREE.MeshBasicMaterial({ color: lin(c), transparent: !!o.opacity, opacity: o.opacity || 1, depthWrite: !o.opacity }));
  const box = (g, c, w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  const rim = (g, w, d, x, y, z) => box(g, READ.own, w + 0.5, 0.05, d + 0.5, x, y - 0.06, z);   // the owned-blue edge under each module
  let host = null, sig = '', grp = null, gun = null, pool = null;
  const IDS = ['bunks', 'roofTurret', 'workshop', 'floodlights', 'radio', 'plating'];
  function build() {
    const L = id => game.rigLevel(id), g = new THREE.Group(); gun = null; pool = null;
    if (L('plating')) for (let k = 0; k < L('plating'); k++) for (const s of [-1, 1]) box(g, k % 2 ? '#8d9398' : '#6e757b', 3.4, 1.2, 0.35, 2.6 - k * 3.6, 2.2, s * 3.05);
    if (L('bunks')) { const n = L('bunks') + 1, x = -5.8; rim(g, 2.6, 4.2, x, 4.2, 0); box(g, '#4f6d8f', 2.6, 0.5 + 0.4 * L('bunks'), 4.2, x, 4.2, 0); for (let k = 0; k < n; k++) box(g, '#e8e2d2', 2.0, 0.08, 0.9, x, 4.75 + 0.4 * L('bunks'), -1.5 + k * (3 / Math.max(1, n - 1))); }
    if (L('roofTurret')) { rim(g, 2.2, 2.2, -0.6, 4.45, 0); box(g, '#2d3135', 2.2, 0.3, 2.2, -0.6, 4.45, 0); const t = new THREE.Group(); t.position.set(-0.6, 4.8, 0); box(t, '#e8b021', 1.4, 0.6, 1.1, 0, 0, 0); box(t, '#9aa3aa', 2.4, 0.22, 0.22, 1.4, 0.2, -0.2); box(t, '#9aa3aa', 2.4, 0.22, 0.22, 1.4, 0.2, 0.2); g.add(t); gun = t; }
    if (L('workshop')) { const x = -9.6; rim(g, 2.4, 4.4, x, 0, 0); box(g, '#b4532a', 2.4, 1.1, 4.4, x, 0, 0); box(g, '#3a3f44', 0.8, 0.5, 0.8, x, 1.1, -1.2); box(g, '#cfd6db', 1.6, 0.12, 0.3, x, 1.2, 0.9); if (L('workshop') > 1) box(g, '#e8b021', 0.9, 0.6, 0.9, x, 1.1, 1.6); }
    if (L('floodlights')) { for (const s of [-1, 1]) { box(g, '#3a3f44', 0.3, 1.6, 0.3, 6.8, 4.9, s * 2.3); box(g, '#fff4cc', 0.9, 0.5, 1.1, 6.8, 6.5, s * 2.3); }
      pool = new THREE.Mesh(new THREE.CircleGeometry(12 / 0.3, 48), mat('#ffe7a8', { opacity: 0.14 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.15; pool.renderOrder = 2; g.add(pool); }
    if (L('radio')) { box(g, '#c9ced2', 0.18, 5.5, 0.18, 3.6, 4.9, 1.9); box(g, '#c9ced2', 1.8, 0.12, 0.12, 3.6, 9.6, 1.9); const d = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), mat(READ.own)); d.rotation.x = -Math.PI / 2; d.position.set(3.6, 10.5, 1.9); g.add(d); }
    return g;
  }
  function update() {
    const KP = V.keep; if (!KP || !KP.g) return;
    const body = KP.g.userData.body || KP.g, s = IDS.map(id => game.rigLevel(id)).join('') + (KP.rebuilt || 0);
    if (s !== sig || host !== body) { if (grp && grp.parent) grp.parent.remove(grp); sig = s; host = body; grp = build(); body.add(grp); }
    grp.visible = !S.keep.ruined;
    if (pool) pool.visible = V.dark > 0.3;
    if (gun) {   // the roof gun turns to the nearest Ash-Born in its range
      const G = game.rigGun(), R = G ? G.range : 0; let best = null, bd = R;
      for (const m of S.mobs) { if (m.rise < 1 || m.hp <= 0) continue; const d = Math.hypot(m.x - C, m.y - C); if (d < bd) { bd = d; best = m; } }
      if (best) { const want = Math.atan2(-(best.y - C), best.x - C) - KP.g.rotation.y; let d = want - gun.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); gun.rotation.y += d * 0.25; }
      else gun.rotation.y += 0.004;
    }
  }
  return { update };
}
