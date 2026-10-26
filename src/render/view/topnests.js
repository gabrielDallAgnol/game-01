// [topnests] The nest seen from above, in the V2 game: an infested building in the town's flat style (the old mound,
// hive and Inferno models are gone under v2, see the [v2] guards in hives.js / inferno.js). A heat-source footprint
// (forecourt, substation yard, boiler house, tanker) in rot and ash, ember cracks that breathe, a pulsing core, a slow
// smoke ring, vents with live jets and an ash pad. Where: the engine town's nest (map.area.nest), else every horde
// spot that sleeps at a nest (S.hordes.spots, why 'nest'). Hot while its horde lives; red and quicker on the night it
// marches; cold grey once broken. Reads the state, never writes it; draws nothing for the hit body, bars or marks.
/* global THREE */
import { READ } from '../readable.js';
import { K } from '../kit.js';
import { lc } from './shared.js';

const RES = 256, ROOF_Y = 3.5;   // the slab sits over the town's overhead plane (3.4), like a roof, and draws over trees (no depth test)
const KINDS = ['boiler', 'petrol', 'substation', 'tanker'];

export function createTopNests(V) {
  const { S, map, game, world, Wv } = V;
  const canvasTex = (draw, res = RES) => { const c = document.createElement('canvas'); c.width = c.height = res; const x = c.getContext('2d'); draw(x, res); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
  const mat = (tex, o = {}) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, ...o });
  const plane = (size, m, y, order) => { const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.y = y; o.renderOrder = order; return o; };
  // a seeded jitter, so each nest's cracks are its own and stay put frame to frame
  const rnd = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // ---------- the footprint of each heat source, in the model's local metres (canvas y = local z) ----------
  function footprint(x, kind, s) {
    const rect = (w, h, cx = 0, cz = 0, r = 0.12) => { x.beginPath(); x.roundRect(cx - w / 2, cz - h / 2, w, h, r); };
    const shapes = [];
    if (kind === 'petrol') { shapes.push(() => rect(s * 2.4, s * 1.7), () => rect(s * 1.1, s * 0.8, -s * 0.2, -s * 1.3)); }
    else if (kind === 'substation') { shapes.push(() => rect(s * 3.1, s * 2.5, 0, 0, 0.05), () => rect(s * 1.2, s * 0.7, 0, s * 1.15)); }
    else if (kind === 'tanker') { shapes.push(() => rect(s * 2.2, 1.8, 0.1 * s, 0, 0.9), () => rect(1.4, 1.6, -s * 1.2, 0, 0.2)); }
    else { shapes.push(() => rect(s * 1.9, s * 1.6, -s * 0.2, 0), () => rect(s * 1.4, 1.5, s * 0.9, s * 0.5, 0.7), () => { x.beginPath(); x.arc(-s * 0.8, -s * 0.5, 0.6, 0, Math.PI * 2); }); }
    return shapes;
  }
  /** the rotten slab: footprint in rot, roof seams, ash flecks; returns the crack paths for the glow layer */
  function slabTex(kind, s, E, seed, cold) {
    const r = rnd(seed), cracks = [];
    const tex = canvasTex((x, R) => {
      x.setTransform(R / (2 * E), 0, 0, R / (2 * E), R / 2, R / 2);
      const shapes = footprint(x, kind, s);
      // a dark ink rim under everything, then the rot, then lighter slabs (the roof seams)
      x.lineJoin = 'round';
      for (const f of shapes) { f(); x.fillStyle = cold ? '#3b3a3c' : READ.rot; x.fill(); x.lineWidth = 0.32; x.strokeStyle = '#120d0e'; x.stroke(); }
      x.save(); for (const f of shapes) { f(); } x.clip();
      x.fillStyle = cold ? '#4a494b' : READ.rot2; for (let k = 0; k < 7; k++) { const w = 0.8 + r() * 1.6, h = 0.5 + r() * 1.2; x.fillRect((r() - 0.5) * 2 * E, (r() - 0.5) * 2 * E, w, h); }
      // rot blotches spreading from the core
      for (let k = 0; k < 9; k++) { const a = r() * 6.28, d = r() * s * 1.2, rr = 0.4 + r() * 0.9; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, Math.PI * 2); x.fillStyle = cold ? 'rgba(20,20,22,0.35)' : 'rgba(70,24,30,0.55)'; x.fill(); }
      x.fillStyle = cold ? 'rgba(160,160,165,0.35)' : 'rgba(120,104,104,0.4)'; for (let k = 0; k < 40; k++) x.fillRect((r() - 0.5) * 2 * E, (r() - 0.5) * 2 * E, 0.14, 0.14);
      x.restore();
      // the cracks: jagged lines out of the core toward the edges, kept for the glow layer
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + r() * 0.6, pts = [[Math.cos(a) * 0.7, Math.sin(a) * 0.7]]; let d = 0.7;
        for (let j = 0; j < 4; j++) { d += 0.18 * s + r() * 0.16 * s; const b = a + (r() - 0.5) * 0.9; pts.push([Math.cos(b) * d, Math.sin(b) * d]); }
        cracks.push(pts); }
      x.lineCap = 'round'; x.save(); for (const f of shapes) f(); x.clip();
      for (const pts of cracks) { x.beginPath(); pts.forEach(([px, pz], i) => (i ? x.lineTo(px, pz) : x.moveTo(px, pz))); x.lineWidth = 0.3; x.strokeStyle = cold ? '#2a292b' : '#140c0c'; x.stroke(); }
      x.restore();
      // the core's pit
      x.beginPath(); x.arc(0, 0, 0.9, 0, Math.PI * 2); x.fillStyle = cold ? '#252427' : '#0d0809'; x.fill(); x.lineWidth = 0.18; x.strokeStyle = cold ? '#555' : '#5a1a10'; x.stroke();
    });
    return { tex, cracks };
  }
  function crackTex(cracks, E, kind, s) {
    return canvasTex((x, R) => {
      x.setTransform(R / (2 * E), 0, 0, R / (2 * E), R / 2, R / 2); x.lineCap = 'round'; x.lineJoin = 'round';
      for (const f of footprint(x, kind, s)) f(); x.clip();   // the cracks stay on the building
      const pass = (w, c) => { for (const pts of cracks) { x.beginPath(); pts.forEach(([px, pz], i) => (i ? x.lineTo(px, pz) : x.moveTo(px, pz))); x.lineWidth = w; x.strokeStyle = c; x.stroke(); } };
      pass(0.5, 'rgba(255,70,20,0.35)'); pass(0.2, READ.crack); pass(0.08, READ.core);
    });
  }
  const glowTex = V.glowTex;
  const ringTex = canvasTex((x, R) => {   // the smoke ring: a soft grey band, wisps along it
    const c = R / 2; for (let k = 0; k < 90; k++) { const a = k / 90 * 6.28, rr = R * (0.34 + 0.05 * Math.sin(k * 1.7)), sz = R * (0.07 + 0.04 * Math.sin(k * 2.3 + 1));
      const g = x.createRadialGradient(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 0, c + Math.cos(a) * rr, c + Math.sin(a) * rr, sz); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, R, R); }
  });
  const padTex = canvasTex((x, R) => {   // the ash pad round the nest: dark at the middle, a ragged rim
    const g = x.createRadialGradient(R / 2, R / 2, R * 0.05, R / 2, R / 2, R / 2); g.addColorStop(0, 'rgba(30,22,24,0.85)'); g.addColorStop(0.6, 'rgba(40,30,32,0.6)'); g.addColorStop(0.85, 'rgba(60,40,38,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, R, R);
    const r = rnd(7); x.fillStyle = 'rgba(25,18,20,0.5)'; for (let k = 0; k < 26; k++) { const a = r() * 6.28, d = R * (0.3 + r() * 0.16); x.beginPath(); x.arc(R / 2 + Math.cos(a) * d, R / 2 + Math.sin(a) * d, R * (0.02 + r() * 0.04), 0, Math.PI * 2); x.fill(); }
  });
  const ventTex = canvasTex((x, R) => {   // a vent seen from above: a dark pipe mouth with a live jet in it
    const c = R / 2; x.beginPath(); x.arc(c, c, R * 0.42, 0, Math.PI * 2); x.fillStyle = '#2c2828'; x.fill(); x.lineWidth = R * 0.06; x.strokeStyle = '#0c0808'; x.stroke();
    const g = x.createRadialGradient(c, c, 0, c, c, R * 0.32); g.addColorStop(0, '#fff2c0'); g.addColorStop(0.45, '#ffb04a'); g.addColorStop(1, 'rgba(255,80,20,0.2)'); x.beginPath(); x.arc(c, c, R * 0.32, 0, Math.PI * 2); x.fillStyle = g; x.fill();
  }, 64);
  const ventGeo = new THREE.PlaneGeometry(1, 1); ventGeo.rotateX(-Math.PI / 2);

  const flatC = K.T.flat.value, tmp = new THREE.Color(), HALO = lc('#ff7a1c'), RAGE = lc('#ff3a1a');
  let list = [], key = '';
  /** where the nests are: the engine town's nest, else the horde spots that sleep at one */
  function sources() {
    const H = S.hordes, spots = H ? H.spots.filter(h => h.why === 'nest') : [], A = map.area, out = [];
    if (A && A.nest) { const r = (A.W && A.W.nest && A.W.nest.r) || 8; out.push({ x: A.nest.x, y: A.nest.y, r, spot: spots.find(h => Math.hypot(h.x - A.nest.x, h.y - A.nest.y) < r + 8) || null }); }
    else for (const h of spots) out.push({ x: h.x, y: h.y, r: 5, spot: h });
    return out;
  }
  function make(src, i) {
    const r = src.r, s = r / 1.6, kind = KINDS[(Math.floor(src.x * 7 + src.y * 13) >>> 0) % KINDS.length], E = Math.max(2.2 * s, 2.6), seed = 97 + Math.floor(src.x * 31 + src.y);
    const g = new THREE.Group(); g.position.copy(Wv(src.x, src.y)); g.rotation.y = ((src.x * 0.37 + src.y * 0.11) % 1) * Math.PI * 2; world.add(g);
    const pad = plane(1, mat(padTex, { opacity: 0.9 }), 0.055, 2); pad.scale.setScalar(r * 3.2);
    const halo = plane(1, mat(glowTex, { color: HALO.clone(), opacity: 0, blending: THREE.AdditiveBlending }), 0.06, 3); halo.scale.setScalar(r * 4);
    const live = slabTex(kind, s, E, seed, false), dead = slabTex(kind, s, E, seed, true);
    const slabM = mat(live.tex, { depthTest: false }), slab = plane(2 * E, slabM, ROOF_Y, 6);
    const cracks = plane(2 * E, mat(crackTex(live.cracks, E, kind, s), { opacity: 1, blending: THREE.AdditiveBlending, depthTest: false }), ROOF_Y + 0.01, 7);
    const coreGlow = plane(1, mat(glowTex, { color: lc(READ.crack).multiplyScalar(1.4), opacity: 0, blending: THREE.AdditiveBlending, depthTest: false }), ROOF_Y + 0.02, 7);
    const core = plane(1, mat(glowTex, { color: lc(READ.core).multiplyScalar(1.6), opacity: 0, blending: THREE.AdditiveBlending, depthTest: false }), ROOF_Y + 0.03, 8);
    const smoke = plane(1, mat(ringTex, { color: lc(READ.smoke), opacity: 0.32, depthTest: false }), ROOF_Y + 0.1, 9);
    const vents = new THREE.Group(), jets = [];
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, rr = E * 1.12, v = new THREE.Mesh(ventGeo, mat(ventTex)); v.position.set(Math.cos(a) * rr, 0.08, Math.sin(a) * rr); v.scale.setScalar(Math.max(1.1, s * 0.3)); v.renderOrder = 3; vents.add(v); jets.push(v); }
    g.add(pad, halo, slab, cracks, coreGlow, core, smoke, vents);
    return { src, g, pad, halo, slab, slabM, live, dead, cracks, coreGlow, core, smoke, vents, jets, E, r, s, ph: i * 1.3 + src.x * 0.01, cold: null, lvl: 1 };
  }

  function update(dt = 0.016) {
    const k2 = `${!!map.area}|${S.hordes ? S.hordes.spots.length : -1}`;
    if (k2 !== key) { key = k2; for (const o of list) world.remove(o.g); list = sources().map(make); }
    if (!list.length) return;
    const time = V.time, dark = V.dark, H = S.hordes, march = H && H.plan ? H.plan[S.night] : -1;
    for (const o of list) {
      const sp = o.src.spot, cold = !!(sp && sp.dead <= 0), rage = !!(sp && sp.id === march), awake = !!(sp && sp.awake && sp.awake.length);
      o.lvl += ((cold ? 0 : rage ? 1.4 : awake ? 1.2 : 1) - o.lvl) * Math.min(1, dt * 2); const L = o.lvl;
      if (cold !== o.cold) { o.cold = cold; o.slabM.map = cold ? o.dead.tex : o.live.tex; o.slabM.needsUpdate = true; }
      o.slabM.color.copy(flatC);   // the slab takes the day/night light like the town's roofs
      o.pad.material.color.copy(flatC); o.pad.material.opacity = cold ? 0.45 : 0.9;
      o.halo.material.opacity = cold ? 0 : (0.12 + 0.4 * dark) * Math.min(1, L); o.halo.material.color.copy(rage ? RAGE : HALO);
      const br = 0.75 + 0.25 * Math.sin(time * (rage ? 4.4 : 2.2) + o.ph) + 0.1 * Math.sin(time * 7.3 + o.ph);   // the cracks breathe with the fire
      o.cracks.visible = !cold; o.cracks.material.opacity = Math.min(1, (0.55 + 0.45 * Math.min(1.4, L)) * br);
      const pulse = 0.5 + 0.5 * Math.sin(time * (rage ? 6 : 3.2) + o.ph);
      o.core.visible = o.coreGlow.visible = !cold;
      o.core.scale.setScalar(o.s * 0.9 * (0.85 + 0.25 * pulse)); o.core.material.opacity = 0.85 * (0.7 + 0.3 * pulse);
      o.coreGlow.scale.setScalar(o.s * 2.6 * (0.9 + 0.2 * pulse) * Math.max(0.6, L)); o.coreGlow.material.opacity = (0.45 + 0.35 * dark) * (0.6 + 0.4 * pulse);
      // the smoke ring: turns slowly, swells and fades, a little darker by night
      const u = (time * 0.09 + o.ph * 0.1) % 1; o.smoke.rotation.y = time * 0.12 + o.ph;
      o.smoke.scale.setScalar(o.E * 2 * (1.05 + 0.5 * u)); o.smoke.material.opacity = (cold ? 0.14 : 0.36) * Math.sin(u * Math.PI) * (1 - 0.3 * dark);
      tmp.set(READ.smoke).convertSRGBToLinear().multiply(flatC); o.smoke.material.color.copy(tmp);
      o.vents.visible = !cold;
      if (!cold) o.jets.forEach((j, i) => { j.scale.setScalar(Math.max(1.1, o.s * 0.3) * (1.0 + 0.18 * Math.sin(time * 11 + i * 1.9))); });
    }
  }
  return { update, list: () => list };
}
