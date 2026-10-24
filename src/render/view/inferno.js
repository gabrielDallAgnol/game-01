// [nest3] Inferno Nests: a heat-source building (gas station, substation, boiler house, a burning tanker in the woods)
// alight and roaring: flame sprites, a fire column you can see from far, embers and smoke, a charred pad that spreads
// the longer the nest is left alone. Its three phases are on the model: slag barricade (ring of glowing slag blocks),
// feeder vents (pipes with flame jets), the core (a white-hot heart). Broken parts go out and stay out; a snuffed
// nest is cold black iron. Parented to the old hive group (hv.g) so the rage throb and visibility rules still apply.
/* global THREE */
import { lc } from './shared.js';

export function createInferno(V) {
  const { S, map, C, game, fx2 } = V;
  const hives = V.hives.hives;
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new THREE.CanvasTexture(c); };
  const flameTex = tex(64, 128, (x, w, h) => {   // a teardrop of fire: white-yellow core, orange body, red edge
    const g = x.createRadialGradient(w / 2, h * 0.68, 2, w / 2, h * 0.62, h * 0.5); g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.28, 'rgba(255,196,70,0.95)'); g.addColorStop(0.62, 'rgba(255,92,20,0.7)'); g.addColorStop(1, 'rgba(160,20,0,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(w / 2, 2); x.bezierCurveTo(w * 0.95, h * 0.45, w * 0.98, h * 0.85, w / 2, h - 2); x.bezierCurveTo(w * 0.02, h * 0.85, w * 0.05, h * 0.45, w / 2, 2); x.fill();
  });
  const scorchTex = tex(128, 128, (x, w) => {   // charred ground: black middle, a cracked orange rim
    const g = x.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(8,6,6,0.92)'); g.addColorStop(0.62, 'rgba(14,9,8,0.8)'); g.addColorStop(0.82, 'rgba(120,36,8,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w); x.strokeStyle = 'rgba(255,110,30,0.55)'; x.lineWidth = 1.4;
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + (k % 3) * 0.2; x.beginPath(); let r = 24 + (k % 4) * 3; x.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); for (let s = 0; s < 4; s++) { r += 9 + (k * 7 % 5); const b = a + ((k + s) % 3 - 1) * 0.12; x.lineTo(64 + Math.cos(b) * r, 64 + Math.sin(b) * r); } x.stroke(); }
  });
  const haloTex = V.glowTex;
  const col = {
    soot: lc('#2a2524'), iron: lc('#3c3836'), brick: lc('#6b3b2e'), conc: lc('#7a726a'), yellow: lc('#c9a43a'), red: lc('#a6361f'),
    slag: lc('#ff6a1c').multiplyScalar(1.7), core: lc('#ffe9b0').multiplyScalar(2.2), vent: lc('#ffb04a').multiplyScalar(1.6),
  };
  const mat = c => new THREE.MeshLambertMaterial({ color: c }), glow = c => new THREE.MeshBasicMaterial({ color: c });
  const box = (m, w, h, d, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); parent.add(o); return o; };
  const cyl = (m, r, h, x, y, z, parent, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, seg), m); o.position.set(x, y + h / 2, z); parent.add(o); return o; };

  // ---------- one nest's body: the heat-source building ----------
  function building(kind, half) {
    const g = new THREE.Group(), M = { soot: mat(col.soot), iron: mat(col.iron), brick: mat(col.brick), conc: mat(col.conc), yellow: mat(col.yellow), red: mat(col.red) }, s = half;
    if (kind === 'petrol') {   // canopy on four posts, pump islands, a little shop, a price sign gone black
      box(M.conc, s * 2.4, 0.3, s * 1.7, 0, 2.5, 0, g); box(M.yellow, s * 2.44, 0.12, s * 1.74, 0, 2.42, 0, g);
      for (const [x, z] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) box(M.iron, 0.22, 2.5, 0.22, x * s * 1.05, 0, z * s * 0.72, g);
      for (const x of [-0.6, 0.6]) { box(M.red, 0.45, 1.1, 0.7, x * s, 0, 0, g); box(M.soot, 0.5, 0.2, 0.5, x * s, 1.1, 0, g); }
      box(M.conc, s * 1.1, 1.8, s * 0.8, -s * 0.2, 0, -s * 1.3, g); box(M.soot, 0.2, 3.4, 0.2, s * 1.35, 0, -s * 1.1, g); box(M.yellow, 1.1, 0.8, 0.14, s * 1.35, 3.0, -s * 1.1, g);
    } else if (kind === 'substation') {   // a fenced yard of transformers and pylons, cables arcing
      for (const x of [-0.9, 0.2, 1.1]) { box(M.iron, 1.0, 1.5, 1.2, x * s, 0, 0.1 * s, g); box(M.soot, 0.34, 0.5, 0.34, x * s - 0.25, 1.5, 0.1 * s, g); box(M.soot, 0.34, 0.5, 0.34, x * s + 0.25, 1.5, 0.1 * s, g); }
      for (const x of [-1.3, 1.3]) { box(M.iron, 0.18, 4.2, 0.18, x * s, 0, -s * 0.9, g); box(M.iron, 1.6, 0.14, 0.14, x * s, 4.0, -s * 0.9, g); }
      for (const [x, z] of [[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.2], [1.5, 1.2]]) box(M.iron, 0.1, 1.2, 0.1, x * s, 0, z * s, g);
      box(M.conc, s * 1.2, 1.6, s * 0.7, 0, 0, s * 1.15, g);
    } else {   // boiler house (and the tanker): a brick block, a fat boiler drum and a tall chimney
      if (kind === 'tanker') { const t = cyl(M.iron, 0.9, s * 2.2, 0, 0.9, 0, g, 14); t.rotation.z = Math.PI / 2; t.position.y = 1.05; box(M.red, 1.4, 1.1, 1.6, -s * 1.2, 0.2, 0, g); }
      else { box(M.brick, s * 1.8, 2.8, s * 1.5, -s * 0.2, 0, 0, g); box(M.iron, s * 1.9, 0.18, s * 1.6, -s * 0.2, 2.8, 0, g); cyl(M.iron, 0.75, s * 1.4, s * 0.9, 0.0, s * 0.5, g, 12).rotation.z = Math.PI / 2; cyl(M.brick, 0.55, 7.2, -s * 0.8, 0, -s * 0.5, g, 10); box(M.iron, 0.2, 2.2, 0.2, s * 1.3, 0, -s * 0.9, g); }
    }
    return g;
  }
  const flameMat = () => new THREE.SpriteMaterial({ map: flameTex, transparent: true, opacity: 0, depthWrite: false, fog: false });   // normal blending: it must read as orange fire on a bright day, not wash to white
  const sp = (m, parent) => { const s = new THREE.Sprite(m); parent.add(s); return s; };

  const nests = new Map();
  for (const reg of map.regions) if (reg.nest && hives.has(reg.id)) {
    const r = reg.id, hv = hives.get(r), n = reg.nest, half = n.body ? n.body.half : 1.6, kind = n.heat || 'boiler';
    hv.model.visible = false; hv.decal.visible = false; hv.haze.forEach(s => { s.visible = false; });   // the old green hive look is gone
    hv.inf = true;
    const root = new THREE.Group(); hv.g.add(root);
    const bld = building(kind, half); root.add(bld);
    const scorchMat = new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, opacity: 0.95, depthWrite: false }), scorch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), scorchMat);
    scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.04; scorch.renderOrder = 2; root.add(scorch);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: haloTex, color: lc('#ff7a1c'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.06; halo.renderOrder = 3; root.add(halo);
    // phase 1: slag barricade, a ring of glowing blocks round the building
    const slag = new THREE.Group(); root.add(slag); const slagM = mat(col.soot), crackM = glow(col.slag), blocks = [];
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr = half * 1.55 + 0.9 + (k % 2) * 0.35, w = 0.9 + (k * 37 % 5) * 0.2, h = 0.8 + (k * 53 % 4) * 0.35;
      const b = box(slagM, w, h, w * 0.8, Math.cos(a) * rr * 1.1, 0, Math.sin(a) * rr, slag); b.rotation.y = a + (k % 3) * 0.4; b.rotation.z = ((k % 3) - 1) * 0.08;
      const c2 = box(crackM, w * 0.25, h * 0.7, w * 0.82, 0, 0.05, 0, b); c2.position.y = h * 0.4; blocks.push(b); }
    // phase 2: feeder vents, pipes standing out of the ground, each with a jet
    const vents = new THREE.Group(); root.add(vents); const ventM = mat(col.iron), jets = [];
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, rr = half * 1.1 + 2.7; const x = Math.cos(a) * rr * 1.15, z = Math.sin(a) * rr;
      cyl(ventM, 0.34, 1.7, x, 0, z, vents, 8); const ring = cyl(glow(col.vent), 0.4, 0.14, x, 1.55, z, vents, 8); ring.userData = {}; const j = sp(flameMat(), vents); j.position.set(x, 2.5, z); jets.push(j); }
    // phase 3: the core, a white-hot heart on top of the building
    const core = sp(new THREE.SpriteMaterial({ map: haloTex, color: col.core, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), root);
    core.position.set(0, kind === 'petrol' ? 1.4 : 2.0, 0);
    // fire: flames round the building, a roaring column over it (visible from far)
    const flames = [];
    for (let k = 0; k < 9; k++) { const a = k * 2.4, rr = (k % 3) * half * 0.55; const f = sp(flameMat(), root); f.userData = { x: Math.cos(a) * rr, z: Math.sin(a) * rr * 0.8, y: k % 3 === 0 ? 2.8 : 0.8, ph: k * 1.7, s: 1.4 + (k % 3) * 0.5 }; flames.push(f); }
    const column = sp(flameMat(), root); column.position.set(0, 7.5, 0); column.scale.set(5, 12, 1);
    const glowTop = sp(new THREE.SpriteMaterial({ map: haloTex, color: lc('#ff8a2a').multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), root); glowTop.position.y = 5;
    nests.set(r, { r, hv, root, kind, half, scorch, scorchMat, halo, slag, vents, blocks, jets, core, flames, column, glowTop, ph: 0, cold: false, lvl: 1, emitT: Math.random(), fx: 0, seen: false });
  }
  const camD = (x, y) => Math.hypot(x - (V.camTarget.x + C), y - (V.camTarget.z + C));

  /** once a frame (after the old hive update) */
  function update(dt, events) {
    const time = V.time, dark = V.dark;
    for (const e of events || []) {
      if (e.t === 'infernoBreak') { const q = nests.get(e.region); if (q) { V.feel.burst(e.x, e.y, 3.2, '#ff8a2a'); V.feel.burst(e.x, e.y, 5, '#ffd27a'); V.feel.shake && V.feel.shake(0.5); { const p = wpos(e.x, e.y, 2); fx2.emit('flash', p.x, p.y, p.z, 4, { size: 6 }); } } }
      if (e.t === 'nestCleansed') { const q = nests.get(e.region); if (q) { V.feel.burst(e.x, e.y, 6, '#8ad0ff'); V.feel.burst(e.x, e.y, 3, '#ffffff'); } }
    }
    for (const [r, q] of nests) {
      const hv = q.hv, reg = map.regions[r], alive = !!S.nestAlive[r], info = game.infernoInfo(r), ph = info ? info.broken : 0;
      // a burning nest is on the map to see, never hidden by the fog of war (it is a beacon); a snuffed one stays as cold iron
      const sealed = !!S.sealed[r];
      if (alive && !sealed) { hv.g.visible = true; hv.glow = Math.max(hv.glow, 0.9); }
      q.cold = !alive;
      const stage = info ? info.heat : 0, rg = S.nestRage && S.nestRage[r], hot = rg ? 0.25 + Math.min(0.5, rg.lv / 8) : 0;
      // fire strength: each broken phase takes some of the roar away; a snuffed core takes all of it; time left alone adds
      const want = !alive ? 0 : Math.max(0.35, 1 - 0.2 * ph + 0.1 * Math.min(4, stage) + hot);
      q.lvl += (want - q.lvl) * Math.min(1, dt * 2);
      if (ph !== q.ph) { q.ph = ph; }
      q.slag.visible = alive && ph < 1; q.vents.visible = alive && ph < 2;
      const L = q.lvl, flick = i => 0.85 + 0.15 * Math.sin(time * 9 + i * 1.7) + 0.08 * Math.sin(time * 23 + i * 3.1);
      q.flames.forEach((f, i) => { const u = f.userData, k = L * flick(i) * u.s * (ph >= 2 && i % 3 ? 0.55 : 1); f.material.opacity = Math.min(0.92, L * 1.0) * (alive ? 1 : 0); f.scale.set(1.5 * k, 2.6 * k, 1); f.position.set(u.x, u.y + 1.3 * k, u.z); });
      q.jets.forEach((j, i) => { j.material.opacity = q.vents.visible ? 0.95 : 0; const k = (1.1 + 0.4 * Math.sin(time * 11 + i)) * L; j.scale.set(0.9 * k, 2.2 * k, 1); j.position.y = 2.5 + 1.0 * k; });
      q.column.material.opacity = (0.4 + 0.1 * Math.sin(time * 5)) * Math.min(1, L) * (alive ? 1 : 0); q.column.scale.set(4.2 + 0.4 * Math.sin(time * 3), 10 + 2 * L + Math.sin(time * 4), 1); q.column.position.y = 6 + L;
      q.glowTop.material.opacity = (0.1 + 0.45 * dark) * L * (alive ? 1 : 0); q.glowTop.scale.setScalar(13 + 5 * L);
      q.core.material.opacity = alive ? (ph >= 2 ? 0.8 : 0.35) * (0.8 + 0.2 * Math.sin(time * 7)) : 0; q.core.scale.setScalar(ph >= 2 ? 3.6 + Math.sin(time * 6) * 0.5 : 2.2);
      // the charred pad grows with the nest's age and shrinks as it is broken; a snuffed nest keeps a faint scar
      const sc = alive ? (q.half * 2 + 6 + 2.2 * Math.min(4, stage)) * (1 - 0.1 * ph) : q.half * 2 + 4;
      q.scorch.scale.setScalar(sc); q.scorchMat.opacity = alive ? 0.95 : 0.45;
      q.halo.scale.setScalar(sc * 0.95); q.halo.material.opacity = (alive ? 0.25 + 0.35 * dark : 0) * Math.min(1, L); q.halo.material.color.set(rg ? '#ff4a1a' : '#ff7a1c');
      // embers and smoke only while near the camera and on screen
      if (hv.g.visible && (q.emitT -= dt) <= 0 && camD(reg.nest.x, reg.nest.y) < 48) {
        q.emitT = 0.12 / Math.max(0.4, L);
        const b = reg.nest.body || reg.nest, p = wpos(b.x, b.y, 0);
        if (alive) {
          fx2.emit('ember', p.x + (Math.random() - 0.5) * q.half * 2, p.y + 2 + Math.random() * 2, p.z + (Math.random() - 0.5) * q.half * 2, 3, { size: 1.3, spread: 0.6 });
          if (Math.random() < 0.5) fx2.emit('smoke', p.x, p.y + (q.kind === 'boiler' ? 7.4 : 3.2), p.z, 1, { color: '#26211f', size: 2.2 });
        } else if (Math.random() < 0.25) fx2.emit('smoke', p.x, p.y + 1.5, p.z, 1, { color: '#6d6a70', size: 1.4 });
      }
    }
  }
  const _p = { x: 0, y: 0, z: 0 };
  function wpos(x, y, h) { const v = V.Wv(x, y, h); _p.x = v.x; _p.y = v.y; _p.z = v.z; return _p; }
  return { update, nests };
}
