// Hollowmere city kit · [rig3] The Haven Rig: a caution-yellow diesel hauler on tracks, scrap-armoured by its crew.
// Cab at +x, flatbed behind it, a solar pylon on the bed, twin exhaust stacks, halogen lights on a roof bar.
// Moving parts are separate groups so the view can unfold them: four outriggers (arms swing down to their pads),
// two orange awnings (unroll out from the bed), the pylon (mast telescopes, panel tilts). `a` (0 packed … 1 anchored)
// poses them: setHaven(g, a). Front (the porch side, the camp fire) faces -z like the hall; the view turns it to the camera.
// o: { level (keep level 1–3), guns, plating, cargo (the Rig's systems 0–3) }. userData.fires: [[x, y, z, r]] metres.
/* global THREE */
import { lin } from './palette.js';
import { M, LANTERN } from './materials.js';
import { B } from './builder.js';
import { glowSprite } from './helpers.js';

const YEL = '#e8b021', YEL2 = '#c99318', TRACK = '#2c2b29', STEEL = '#7d8286', DARKS = '#3f4245', RUST = '#8a5a3c', RUST2 = '#6f4a34', ORANGE = '#ee7a22', ORANGE2 = '#c95f18', PANEL = '#27405e', GLASS = '#33454f', HAZ = '#1f1e1c';
const HALO = () => M('#fff6dc', { emissive: '#fff1c8', ei: 2.2 });
const BEACON = () => M('#ffb030', { emissive: '#ff9a1a', ei: 2.5 });
const L = 15, Wd = 5.6, DECK = 1.9;   // body length, width, deck height (metres)

// a pivot group placed at (x, y, z); children are built in its local frame
const pivot = (g, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); g.add(p); return p; };

function hazard(b, x, y, z, w, h, d, n = 6) {   // black and yellow chevron bar along z
  b.cbox(YEL, w, h, d, x, y, z, { r: 0.02 });
  for (let k = 0; k < n; k++) b.cbox(HAZ, w + 0.02, h * 0.98, d / n * 0.45, x, y, z - d / 2 + (k + 0.5) * d / n, { r: 0.005, rx: 0.5 });
}
function track(b, z) {
  b.box(TRACK, L - 0.4, 1.5, 1.35, -0.3, 0.05, z, { r: 0.55 });   // the belt
  for (let k = 0; k < 6; k++) b.geo(DARKS, new THREE.CylinderGeometry(0.5, 0.5, 1.42, 12), -6.2 + k * 2.4, 0.62, z, Math.PI / 2, 0, 0);   // road wheels
  for (let k = 0; k < 22; k++) b.cbox('#3a3836', 0.18, 0.1, 1.38, -7.1 + k * 0.64, 0.08, z, { r: 0.01 });   // grousers
  b.box(YEL2, L - 1.6, 0.35, 1.5, -0.3, 1.45, z, { r: 0.06 });   // track guard
}

/** the Rig, posed packed (a = 0); setHaven poses it */
function haven(o = {}) {
  const lvl = o.level || 1, guns = o.guns || 0, plating = o.plating || 0, cargo = o.cargo || 0;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.body = body;
  const b = new B(), fires = [];
  // tracks and chassis
  for (const s of [-1, 1]) track(b, s * (Wd / 2 - 0.55));
  b.box(YEL, L, 0.7, Wd - 0.4, 0, DECK - 0.7, 0, { r: 0.08 });
  b.box(DARKS, L + 0.1, 0.12, Wd - 0.3, 0, DECK - 0.06, 0, { r: 0.03 });
  hazard(b, L / 2 + 0.25, 1.1, 0, 0.5, 0.7, Wd - 0.6, 8);   // front bumper
  hazard(b, -L / 2 - 0.2, 1.3, 0, 0.4, 0.5, Wd - 0.6, 8);
  // the cab: a boxy cab-over with a roof bar of halogens
  const cx = 5.2, cw = 3.6, ch = 3.0;
  b.box(YEL, cw, ch, Wd - 0.5, cx, DECK, 0, { r: 0.25 });
  b.box(GLASS, 0.12, 1.1, Wd - 1.2, cx + cw / 2 + 0.01, DECK + 1.5, 0, { r: 0.04 });
  for (const s of [-1, 1]) b.box(GLASS, 1.6, 0.9, 0.1, cx + 0.5, DECK + 1.6, s * (Wd / 2 - 0.24), { r: 0.03 });
  b.cbox('#2a2b2c', 0.9, 0.5, Wd - 1.4, cx + cw / 2 + 0.05, DECK + 0.55, 0, { r: 0.05 });   // grille
  b.box(DARKS, 0.25, 0.25, Wd - 0.6, cx + 0.6, DECK + ch + 0.05, 0, { r: 0.04 });   // the light bar
  for (let k = 0; k < 4; k++) { const z = -1.8 + k * 1.2; b.cbox(DARKS, 0.35, 0.42, 0.55, cx + 0.75, DECK + ch + 0.45, z, { r: 0.05 }); b.cbox(HALO(), 0.06, 0.32, 0.42, cx + 0.95, DECK + ch + 0.45, z, { r: 0.02 }); }
  for (const s of [-1, 1]) b.cbox(HALO(), 0.08, 0.3, 0.5, cx + cw / 2 + 0.04, DECK + 0.95, s * (Wd / 2 - 0.7), { r: 0.03 });   // headlights
  b.cyl(BEACON(), 0.22, 0.25, 0.3, cx - 0.9, DECK + ch + 0.05, 0, { seg: 10 });
  // scrap armour: rusty plates bolted on at angles (more with Plating)
  const plates = [[cx + 0.2, 1.0, 1.8, 0.12], [cx - 1.0, 0.9, 1.4, -0.08], [0.6, 0.4, 2.4, 0.06], [-3.6, 0.5, 2.2, -0.1], [-6.0, 0.4, 1.6, 0.09]].slice(0, 2 + plating + (lvl > 1 ? 1 : 0));
  for (const [x, y, w, rz] of plates) for (const s of [-1, 1]) { b.cbox(plates.indexOf(plates.find(p => p[0] === x)) % 2 ? RUST : RUST2, w, 1.1, 0.12, x, DECK + y, s * (Wd / 2 - 0.15), { r: 0.02, rz }); for (const d of [-0.4, 0.4]) b.cyl(STEEL, 0.06, 0.06, 0.05, x + d * w, DECK + y + 0.3, s * (Wd / 2 - 0.07), { rx: Math.PI / 2, seg: 6 }); }
  if (plating >= 2) for (const s of [-1, 1]) b.cbox(STEEL, 3.2, 0.12, 1.2, cx, DECK + 1.6, s * (Wd / 2 + 0.35), { r: 0.02, rx: s * 0.9 });   // cab cage
  // twin exhaust stacks behind the cab
  for (const s of [-1, 1]) { const ex = cx - cw / 2 - 0.35, ez = s * (Wd / 2 - 0.7); b.cyl(STEEL, 0.2, 0.22, 3.6 + lvl * 0.3, ex, DECK, ez, { seg: 10 }); b.cyl('#2a2827', 0.24, 0.2, 0.25, ex, DECK + 3.55 + lvl * 0.3, ez, { seg: 10 }); fires.push([ex, DECK + 3.9 + lvl * 0.3, ez, 0]); }
  // the flatbed: a living module (container) with an orange stripe, crates and drums (more with Cargo)
  b.box(lvl >= 2 ? '#7d8a86' : '#8f8a80', 5.2, 2.5, Wd - 1.4, -1.6, DECK, 0, { r: 0.06 });
  b.cbox(ORANGE, 5.24, 0.3, Wd - 1.36, -1.6, DECK + 1.9, 0, { r: 0.02 });
  for (const z of [-1, 1]) b.cbox(LANTERN, 0.7, 0.5, 0.06, -1.6 + z * 1.4, DECK + 1.25, -(Wd - 1.4) / 2 - 0.02, { r: 0.02 });
  b.box(DARKS, 0.9, 1.9, 0.08, -1.6, DECK, -(Wd - 1.4) / 2 - 0.02, { r: 0.02 });   // the door
  const crates = [[-5.6, -1.4], [-5.6, 1.3], [-6.6, 0], [-4.6, 0.2], [-6.6, -1.4], [-6.6, 1.4]].slice(0, 2 + cargo + (lvl > 2 ? 1 : 0));
  crates.forEach(([x, z], k) => b.box(k % 2 ? '#8a6a48' : '#6f7c5a', 1.0, 0.9, 1.0, x, DECK, z, { r: 0.05, ry: k * 0.3 }));
  for (const z of [-0.6, 0.6]) b.cyl(z < 0 ? '#5d6b6a' : '#a33a2a', 0.35, 0.35, 1.0, -4.3, DECK, z - 1.6 * Math.sign(z), { seg: 10 });
  // guns: a scrap turret on the module roof per Guns level
  for (let k = 0; k < Math.min(2, guns); k++) {
    const gx = -0.4 - k * 2.6, gy = DECK + 2.5;
    b.cyl(DARKS, 0.65, 0.75, 0.45, gx, gy, 0, { seg: 10 }); b.cbox(YEL2, 1.1, 0.5, 0.9, gx, gy + 0.7, 0, { r: 0.08 });
    for (const z of [-0.18, 0.18]) b.geo(STEEL, new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), gx + 1.2, gy + 0.72, z, 0, 0, Math.PI / 2);
  }
  if (guns >= 3) { b.cbox(DARKS, 0.8, 0.4, 0.8, cx - 0.4, DECK + ch + 0.6, 1.6, { r: 0.05 }); b.geo(STEEL, new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), cx + 0.4, DECK + ch + 0.65, 1.6, 0, 0, Math.PI / 2); }
  body.add(b.build({ ao: 1.2, aoMin: 0.6 }));
  // the beacon's glow and the halogens' glow
  const bglow = glowSprite('#ffa030', 1.6, 1.0); bglow.position.set(cx - 0.9, DECK + ch + 0.25, 0); body.add(bglow); g.userData.beacon = bglow;
  const hglow = glowSprite('#fff1c8', 2.2, 0.8); hglow.position.set(cx + 1.0, DECK + ch + 0.45, 0); body.add(hglow);
  fires.push([cx + 3.5, 0.4, 0, 5.5]);   // the halogens light the ground ahead (a light pool, not a flame)

  // ---------- moving parts ----------
  // outriggers: an arm hinged at the deck edge; packed it stands up against the side, anchored it swings out and down
  const rig = [];
  for (const x of [4.2, -6.2]) for (const s of [-1, 1]) {
    const p = pivot(body, x, DECK - 0.2, s * (Wd / 2 + 0.05)), ab = new B();
    ab.cbox(YEL, 0.5, 0.45, 2.6, 0, 0, s * 1.3, { r: 0.06 });
    hazard(ab, 0, 0.0, s * 1.3, 0.52, 0.2, 2.2, 5);
    ab.cbox(DARKS, 0.32, 1.6, 0.32, 0, -0.75, s * 2.5, { r: 0.04 });   // the jack
    ab.cbox('#4a4846', 1.0, 0.18, 1.0, 0, -1.6, s * 2.5, { r: 0.04 });   // the pad
    p.add(ab.build({ ao: 0.6, aoMin: 0.7 })); p.userData.side = s; rig.push(p);
  }
  // awnings: orange canvas rolled on a bar along the bed; anchored it unrolls out over poles
  const awn = [];
  for (const s of [-1, 1]) {
    const p = pivot(body, -1.6, DECK + 2.35, s * (Wd / 2 - 0.6)), ab = new B();
    ab.cbox(ORANGE, 5.0, 0.06, 3.4, 0, 0, s * 1.7, { r: 0.01 });
    for (let k = 0; k < 4; k++) ab.cbox(k % 2 ? ORANGE2 : '#f4ead2', 5.02, 0.065, 0.32, 0, 0.005, s * (0.3 + k * 0.85), { r: 0.005 });
    ab.cbox(ORANGE2, 5.1, 0.3, 0.06, 0, -0.15, s * 3.4, { r: 0.01 });   // the valance
    const poles = new B(); for (const x of [-2.3, 2.3]) poles.box(STEEL, 0.08, 3.5, 0.08, x, -4.25, s * 3.35, { r: 0.02 });
    const roll = new B(); roll.geo(ORANGE2, new THREE.CylinderGeometry(0.22, 0.22, 5.1, 10), 0, 0, 0, 0, 0, Math.PI / 2);
    const cloth = ab.build({ vc: true, cast: true }), pg = poles.build(), rg = roll.build();
    p.add(cloth, pg, rg); p.userData = { cloth, poles: pg, roll: rg, side: s }; awn.push(p);
  }
  // the solar pylon: a mast that telescopes up out of the bed with a tilting panel and a halogen on top
  const py = pivot(body, -4.4, DECK, 1.2), mast = new B();
  mast.box(STEEL, 0.3, 3.2, 0.3, 0, 0, 0, { r: 0.04 }); mast.box(DARKS, 0.5, 0.4, 0.5, 0, 0, 0, { r: 0.04 });
  const mastG = mast.build(); py.add(mastG);
  const head = pivot(py, 0, 3.2, 0), hb = new B();
  hb.cbox(DARKS, 0.3, 0.3, 0.3, 0, 0, 0, { r: 0.04 });
  hb.cbox(STEEL, 3.0, 0.1, 1.9, 0, 0.25, 0, { r: 0.02 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) hb.cbox(PANEL, 0.66, 0.06, 0.82, -1.07 + i * 0.71, 0.32, -0.45 + j * 0.9, { r: 0.01 });
  hb.cbox(HALO(), 0.25, 0.2, 0.25, 0, 0.6, 0, { r: 0.03 });
  head.add(hb.build({ ao: 0.4, aoMin: 0.8 }));
  const hum = glowSprite('#9fd4ff', 2.6, 0.9); hum.position.set(0, 0.7, 0); head.add(hum);
  // the camp at its foot (anchored only): a barrel fire, a bench, a few crates on the porch side
  const camp = new THREE.Group(), cb = new B();
  cb.geo('#9c8664', new THREE.CylinderGeometry(9.8, 10.2, 0.05, 24), 0, 0.025, 0, 0, 0, 0, 1.0, 1, 0.75);
  cb.cyl(RUST, 0.32, 0.3, 0.9, -1.2, 0, -6.4, { seg: 10 });
  for (const [x, z, ry] of [[-3.0, -6.6, 0.3], [0.6, -6.9, -0.2]]) cb.box('#6b5038', 1.6, 0.4, 0.45, x, 0, z, { r: 0.08, ry });
  cb.box('#8a6a48', 0.8, 0.7, 0.8, 2.6, 0, -5.4, { r: 0.04 }); cb.box('#6f7c5a', 0.7, 0.6, 0.7, 3.3, 0, -6.0, { r: 0.04, ry: 0.4 });
  camp.add(cb.build({ ao: 0.8 }));
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.8, 7), new THREE.MeshBasicMaterial({ color: lin('#ffb24d').multiplyScalar(4) })); fl.position.set(-1.2, 1.3, -6.4); camp.add(fl);
  g.userData.flames = [fl];
  fires.push([-1.2, 1.0, -6.4, 4.5]);
  g.add(camp);
  Object.assign(g.userData, { rig, awn, pylon: py, head, hum, mast: mastG, camp, fires: fires.filter(f => f[3] > 0), smoke: fires.filter(f => f[3] === 0), a: -1 });
  setHaven(g, 0);
  return g;
}

const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
/** pose the Rig: a = 0 packed (outriggers up, awnings rolled, pylon down) … 1 anchored */
function setHaven(g, a) {
  const u = g.userData; if (!u.rig || Math.abs(u.a - a) < 1e-4) return; u.a = a;
  const ar = ease(a / 0.45), aw = ease((a - 0.3) / 0.45), ap = ease((a - 0.5) / 0.5);   // outriggers first, then awnings, then the pylon
  for (const p of u.rig) p.rotation.x = p.userData.side * (-1.45 + 1.45 * ar);   // folded up against the side → level
  for (const p of u.awn) { const s = p.userData.side; p.userData.cloth.scale.z = Math.max(0.02, aw); p.userData.cloth.rotation.x = s * 0.22 * aw; p.userData.poles.visible = aw > 0.95; p.userData.roll.position.z = s * 3.3 * aw; p.userData.roll.position.y = -0.75 * aw; p.userData.cloth.visible = aw > 0.02; }
  u.pylon.scale.y = 0.35 + 0.65 * ap; u.head.rotation.z = 0.5 * ap; u.head.rotation.x = -0.15 * ap; u.hum.visible = ap > 0.9;
  u.camp.visible = a > 0.98;
}

export { haven, setHaven };
