// The road, drawn: the four stations (a stalled bus, a fire lookout, a toll gate, a substation), their fires and lit rings,
// the convoy walking home, an ambush mark on the road ahead, the horn's call, embers of a burned hive.
// Renderer-only: reads game.state.road and game.road, never changes the sim. Created by one `// [road]` line in view.js.
/* global THREE */
import { N } from '../sim/mapgen.js';

const SC = 0.3;   // world units per metre for props (the same as the buildings)
const WARM = '#ffb15a';

export function createRoadView({ world, fx, game, W, K, lc, makeBar, setBar, burst, floatLabel, heroLight, bakedWalker, camera }) {
  const S = game.state, road = game.road; if (!road) return null;
  const R = S.road, group = new THREE.Group(); world.add(group);
  const glowFx = new THREE.Group(); fx.add(glowFx);
  const ringGeo = (a, b, seg = 64) => new THREE.RingGeometry(a, b, seg);

  // ---------- props, each one merged into one vertex-coloured mesh ----------
  function rod(b, mat, p, q, r) {
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = Math.hypot(dx, dy, dz), g = new THREE.CylinderGeometry(r, r, L, 5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)), e = new THREE.Euler().setFromQuaternion(quat);
    b.geo(mat, g, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, e.x, e.y, e.z);
  }
  function busProp() {
    const g = new THREE.Group(), bus = K.bus({ color: '#d8a640', stripe: 'soot', wreck: true }); bus.rotation.z = 0.035; g.add(bus);
    const b = new K.B();
    b.box('soot', 1.2, 0.04, 0.9, 3.4, 0.36, 1.35, { r: 0.01 });           // a scorched patch by the door
    b.box('canvas', 2.6, 0.06, 1.6, -1.5, 2.2, 2.0, { r: 0.02, rx: -0.45 });   // a tarp lean-to off the side
    rod(b, 'wood2', [-2.7, 0, 2.7], [-2.7, 2.0, 2.6], 0.06); rod(b, 'wood2', [-0.3, 0, 2.7], [-0.3, 2.0, 2.6], 0.06);
    for (let k = 0; k < 3; k++) b.box(['bag', 'rust', 'canvas'][k], 0.6, 0.45, 0.5, -2.2 + k * 0.7, 0, 2.3, { r: 0.06 });
    b.box('pale', 0.9, 0.06, 0.06, 1.2, 1.9, 1.32, {});   // chalk on the windows: WE ARE STILL HERE (a pale smear)
    b.box('pale', 0.6, 0.06, 0.06, 0.4, 1.7, 1.32, {});
    g.add(b.build({ vc: true }));
    return g;
  }
  function lookoutProp() {
    const b = new K.B(), H = 6.4, s = 1.25;
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(b, 'wood2', [a * s * 1.25, 0, c * s * 1.25], [a * s, H, c * s], 0.12);
    for (const y of [1.6, 3.4, 5.0]) for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { const k = 1.25 - 0.25 * y / H; rod(b, 'wood', [p[0] * s * k, y, p[1] * s * k], [q[0] * s * k, y + 0.9, q[1] * s * k], 0.05); }
    b.box('wood2', 3.2, 0.16, 3.2, 0, H, 0, { r: 0.03 });
    b.box('#8a6b4a', 2.7, 0.9, 2.7, 0, H + 0.16, 0, { r: 0.03 });        // the cabin's lower walls
    b.box('glass', 2.72, 0.75, 2.72, 0, H + 1.06, 0, { r: 0.02 });       // a ring of windows
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box('wood2', 0.12, 0.8, 0.12, a * 1.32, H + 1.04, c * 1.32, { r: 0.01 });
    b.geo('#6e3d2c', new THREE.ConeGeometry(2.4, 1.2, 4), 0, H + 2.4, 0, 0, Math.PI / 4, 0);
    b.cyl('metal', 0.03, 0.03, 1.1, 0, H + 2.9, 0, { seg: 4 });
    // a switchback stair on one side
    for (let k = 0; k < 6; k++) { const y = k * (H / 6), z = 1.8 + (k % 2) * 0.1, x = (k % 2 ? -1 : 1) * 0.6; b.box('wood', 1.4, 0.08, 0.6, x, y + 0.5, z, { r: 0.01, rz: (k % 2 ? 1 : -1) * 0.5 }); }
    const g = b.build({ vc: true }), w = new THREE.Group(); w.add(g);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: lc('#ffcf80').multiplyScalar(3) })); lamp.position.set(0, H + 0.95, 0); lamp.visible = false; w.add(lamp); w.userData.lamp = lamp;
    return w;
  }
  function tollProp() {
    const b = new K.B();
    b.box('pale', 1.8, 2.5, 1.6, 0, 0, 0, { r: 0.08 });
    b.box('glass', 1.82, 0.9, 1.62, 0, 1.15, 0, { r: 0.04 });
    b.box('amber', 1.84, 0.18, 1.64, 0, 2.3, 0, { r: 0.03 });
    b.box('grey', 5.2, 0.22, 3.0, 1.6, 3.0, 0, { r: 0.04 });            // the canopy
    for (const [x, z] of [[-0.6, 1.25], [-0.6, -1.25], [3.9, 1.25], [3.9, -1.25]]) b.box('steel', 0.18, 3.0, 0.18, x, 0, z, { r: 0.03 });
    b.box('soot', 0.5, 1.1, 0.5, 1.15, 0, -0.2, { r: 0.05 });             // the barrier post
    for (let k = 0; k < 7; k++) b.cbox(k % 2 ? '#d8d1c2' : '#b8412e', 0.62, 0.14, 0.14, 1.15 + 0.32 + k * 0.6 * Math.cos(0.5), 1.05 + k * 0.6 * Math.sin(0.5), -0.2, { r: 0.01, rz: 0.5 });   // the boom, stuck half up
    const j = K.jersey(3.2, { color: 'pale', stripe: 'amber' }); j.position.set(-1.6, 0, 2.2); j.rotation.y = 0.15;
    const g = b.build({ vc: true }), w = new THREE.Group(); w.add(g, j);
    return w;
  }
  function substationProp() {
    const b = new K.B();
    b.box('gravel', 6.2, 0.08, 5.0, 0, 0, 0, { r: 0.02 });
    for (const [x, z] of [[-1.6, -0.8], [1.2, -0.8]]) { b.box('#6d776e', 1.5, 1.7, 1.3, x, 0.08, z, { r: 0.08 }); for (let k = 0; k < 5; k++) b.box('#5d665e', 0.08, 1.3, 1.5, x - 0.6 + k * 0.3, 0.25, z, { r: 0.02 }); for (const dx of [-0.4, 0, 0.4]) { b.cyl('pale', 0.09, 0.12, 0.6, x + dx, 1.78, z, { seg: 6 }); } }
    // an H-frame with insulators
    for (const x of [-2.4, 2.4]) b.cyl('metal', 0.1, 0.13, 5.4, x, 0, 1.4, { seg: 6 });
    b.box('metal', 5.3, 0.18, 0.18, 0, 4.7, 1.4, { r: 0.02 });
    for (const x of [-1.6, 0, 1.6]) b.cyl('#b9b4a6', 0.07, 0.1, 0.5, x, 4.2, 1.4, { seg: 6 });
    // a chain fence on three sides, one panel down
    for (const [x0, z0, x1, z1] of [[-3, -2.4, 3, -2.4], [-3, -2.4, -3, 2.4], [3, -2.4, 3, 0.6]]) {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.5);
      for (let k = 0; k <= n; k++) b.cyl('steel', 0.04, 0.04, 1.8, x0 + (x1 - x0) * k / n, 0, z0 + (z1 - z0) * k / n, { seg: 4 });
      b.cbox(K.M('steel', { opacity: 0.35, depthWrite: false }), Math.abs(x1 - x0) || 0.03, 1.5, Math.abs(z1 - z0) || 0.03, (x0 + x1) / 2, 0.9, (z0 + z1) / 2, { r: 0.005 });
    }
    b.box('steel', 1.5, 0.05, 1.6, 3.6, 0.05, 1.6, { r: 0.01, ry: 0.4 });  // the fallen panel
    const g = b.build({ vc: true }), w = new THREE.Group(); w.add(g);
    return w;
  }
  const PROPS = { bus: busProp, ranger: lookoutProp, toll: tollProp, substation: substationProp };

  // ---------- the fire: a ring of stones and crossed logs; lit, it burns and throws a warm pool on the ground ----------
  const flameMat = new THREE.MeshBasicMaterial({ color: lc('#ffb24d').multiplyScalar(4) }), coreMat = new THREE.MeshBasicMaterial({ color: lc('#ffe1a0').multiplyScalar(6) });
  const flameGeo = new THREE.ConeGeometry(0.2, 0.75, 7), coreGeo = new THREE.ConeGeometry(0.12, 0.5, 6);
  function firePit() {
    const b = new K.B(), g = new THREE.Group();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.sph(k % 2 ? 'stone' : 'grey', 0.13, Math.cos(a) * 0.42, 0.07, Math.sin(a) * 0.42, { detail: 0, sy: 0.7 }); }
    for (let k = 0; k < 3; k++) b.cbox('bark', 0.7, 0.1, 0.1, 0, 0.12 + k * 0.03, 0, { r: 0.02, ry: k * Math.PI / 3 });
    b.box('soot', 0.6, 0.02, 0.6, 0, 0, 0, { r: 0.01 });
    g.add(b.build({ vc: true }));
    const flames = new THREE.Group(); flames.visible = false;
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(flameGeo, flameMat); f.position.set(Math.cos(k * 2.1) * 0.1, 0.45, Math.sin(k * 2.1) * 0.1); flames.add(f); }
    const core = new THREE.Mesh(coreGeo, coreMat); core.position.y = 0.38; flames.add(core);
    const glow = K.glowSprite('#ff9a3a', 2.4, 1.2); glow.position.y = 0.6; flames.add(glow);
    g.add(flames); g.userData = { flames, glow };
    return g;
  }
  // the warm pool of light on the ground (and the lit ring's edge)
  const poolMat = () => new THREE.MeshBasicMaterial({ map: K.glowDecal('#fff', 1).material.map, color: lc(WARM), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const edgeMat = () => new THREE.MeshBasicMaterial({ color: lc('#ffcf80').multiplyScalar(1.2), transparent: true, opacity: 0, depthWrite: false });
  const progMat = new THREE.MeshBasicMaterial({ color: lc('#ffd27a').multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });

  const views = road.stations.map((st, k) => {
    const g = new THREE.Group(); g.position.copy(W(st.x, st.y)); group.add(g);
    const prop = PROPS[st.kind](); prop.scale.setScalar(SC);
    const off = W(st.prop.x, st.prop.y).sub(W(st.x, st.y)); prop.position.set(off.x, 0, off.z); prop.rotation.y = st.prop.face + (st.kind === 'bus' ? Math.PI / 2 : st.kind === 'toll' ? Math.PI / 2 : 0); g.add(prop);
    const pit = firePit(); g.add(pit);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat()); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; pool.renderOrder = 3; g.add(pool);
    const edge = new THREE.Mesh(ringGeo(0.965, 1), edgeMat()); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.05; edge.renderOrder = 4; g.add(edge);
    const prog = new THREE.Mesh(ringGeo(0.55, 0.7, 40), progMat); prog.rotation.x = -Math.PI / 2; prog.position.y = 0.06; prog.visible = false; g.add(prog);
    const pads = st.pads.map(p => { const m = new THREE.Mesh(ringGeo(0.38, 0.46, 4), edgeMat()); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 4; m.position.copy(W(p.x, p.y, 0.05)).sub(g.position); g.add(m); return m; });
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(st.name.toUpperCase(), { w: 512, h: 72, size: 34, bg: 'rgba(20,14,8,0.72)', fg: '#ffd9a0', spacing: '3px' }), transparent: true, depthTest: false, opacity: 0 }));
    tag.scale.set(3.4, 0.48, 1); tag.position.copy(W(st.x, st.y, 3.3)); tag.renderOrder = 22; fx.add(tag);
    const bar = makeBar('b', 1.6);
    return { st, g, prop, pit, pool, edge, prog, pads, tag, bar, lit: 0, hitT: 0 };
  });

  // ---------- the convoy: townsfolk (two baked walk frames each) and a handcart ----------
  const folkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const templates = [11, 23, 37, 41, 59, 67].map(seed => bakedWalker(() => K.folk(seed), folkMat));
  function personFigure(k) { const t = templates[k % templates.length], g = new THREE.Group(), body = new THREE.Group(); g.add(body); const a = new THREE.Mesh(t.frames[0].geometry, folkMat), b = new THREE.Mesh(t.frames[1].geometry, folkMat); a.castShadow = b.castShadow = true; b.visible = false; body.add(a, b); g.scale.setScalar(t.g.scale.x * 1.25); return { g, frames: [a, b] }; }
  function cartFigure() {
    const b = new K.B();
    b.box('wood', 1.4, 0.5, 0.9, 0, 0.45, 0, { r: 0.04 }); b.box('wood2', 1.5, 0.08, 1.0, 0, 0.42, 0, { r: 0.02 });
    for (const z of [-0.52, 0.52]) b.geo('tyre', new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10), -0.1, 0.34, z, Math.PI / 2, 0, 0);
    rod(b, 'wood2', [0.7, 0.6, 0.35], [1.5, 0.85, 0.35], 0.04); rod(b, 'wood2', [0.7, 0.6, -0.35], [1.5, 0.85, -0.35], 0.04);
    b.box('bag', 0.5, 0.35, 0.4, -0.3, 0.95, 0.15, { r: 0.1 }); b.box('canvas', 0.5, 0.3, 0.4, 0.25, 0.95, -0.15, { r: 0.08 }); b.box('rust', 0.3, 0.3, 0.3, -0.35, 0.95, -0.25, { r: 0.04 });
    const g = new THREE.Group(), m = b.build({ vc: true }); m.rotation.y = -Math.PI / 2; m.scale.setScalar(0.62); g.add(m);
    return { g, frames: null };
  }
  const mViews = new Map();
  const halo = new THREE.Mesh(ringGeo(0.36, 0.44, 24), new THREE.MeshBasicMaterial({ color: lc('#ffd27a'), transparent: true, opacity: 0.7, depthWrite: false }));
  function syncConvoy(dt, time, dark) {
    const seen = new Set();
    for (const cv of R.convoys) for (const m of cv.members) {
      seen.add(m.id);
      let v = mViews.get(m.id);
      if (!v) {
        v = m.cart ? cartFigure() : personFigure(m.id); v.ring = halo.clone(); v.ring.material = halo.material; v.ring.rotation.x = -Math.PI / 2; v.ring.renderOrder = 4; fx.add(v.ring);
        v.bar = makeBar('h', 0.6); v.phase = m.id * 1.7; v.face = m.face; group.add(v.g); mViews.set(m.id, v); burst(m.x, m.y, 0.7, '#ffd27a');
      }
      let d = (m.face || 0) - v.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; v.face += d * Math.min(1, dt * 8);
      v.g.position.copy(W(m.x, m.y)); v.g.rotation.y = v.face;
      if (v.frames) { if (m.moving) v.phase += dt * 7; const f = m.moving && Math.sin(v.phase) > 0 ? 1 : 0; v.frames[0].visible = f === 0; v.frames[1].visible = f === 1; v.g.position.y += m.moving ? Math.abs(Math.sin(v.phase)) * 0.03 : 0; }
      else if (m.moving) v.g.rotation.z = Math.sin(time * 9) * 0.02;
      // a soft warm ring under each of them: who is yours at a glance; red when bitten, pulsing while they wait
      v.ring.position.copy(W(m.x, m.y, 0.05)); v.ring.material = m.hurtT > 0 ? hurtHalo : m.state === 'wait' ? waitHalo : halo.material;
      if (m.state === 'wait') v.ring.scale.setScalar(1 + Math.sin(time * 4) * 0.12); else v.ring.scale.setScalar(1);
      setBar(v.bar, m.x, 1.35, m.y, m.hp / m.maxHp);
    }
    for (const [id, v] of mViews) if (!seen.has(id)) { group.remove(v.g); fx.remove(v.ring); fx.remove(v.bar); mViews.delete(id); }
  }
  const hurtHalo = new THREE.MeshBasicMaterial({ color: lc('#ff5a3a').multiplyScalar(1.4), transparent: true, opacity: 0.9, depthWrite: false });
  const waitHalo = new THREE.MeshBasicMaterial({ color: lc('#9fd6ff'), transparent: true, opacity: 0.8, depthWrite: false });

  // ---------- an ambush waits on the road: a red mark you can see coming ----------
  const ambushMarks = new Map();
  const warnTex = K.textTex('!', { w: 64, h: 64, size: 52, bg: 'rgba(0,0,0,0)', fg: '#ff6a4a' });
  function syncAmbush(time) {
    const seen = new Set();
    for (const a of R.ambushes) {
      seen.add(a.id); let v = ambushMarks.get(a.id);
      if (!v) {
        const ring = new THREE.Mesh(ringGeo(2.2, 2.45, 48), new THREE.MeshBasicMaterial({ color: lc('#ff5a3a'), transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 5;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: warnTex, transparent: true, depthTest: false })); sp.scale.set(0.9, 0.9, 1); sp.renderOrder = 22;
        fx.add(ring, sp); v = { ring, sp }; ambushMarks.set(a.id, v);
      }
      const k = 0.5 + 0.5 * Math.sin(time * 5);
      v.ring.position.copy(W(a.x, a.y, 0.06)); v.ring.material.opacity = 0.35 + 0.4 * k; v.ring.scale.setScalar(1 + 0.08 * k);
      v.sp.position.copy(W(a.x, a.y, 2.4 + 0.15 * k));
    }
    for (const [id, v] of ambushMarks) if (!seen.has(id)) { fx.remove(v.ring, v.sp); ambushMarks.delete(id); }
  }

  // ---------- one-shot effects: the horn's call, embers of a burned hive, a fire catching ----------
  const waves = [], embers = [];
  function wave(x, y, r, color, life = 1.4, width = 0.06) {
    const m = new THREE.Mesh(ringGeo(1 - width, 1, 72), new THREE.MeshBasicMaterial({ color: lc(color).multiplyScalar(1.3), transparent: true, opacity: 0.85, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 6;
    m.position.copy(W(x, y, 0.1)); fx.add(m); waves.push({ m, r, t: 0, life });
  }
  function onEvents(events) {
    for (const e of events) {
      if (e.t === 'horn') { for (let k = 0; k < 3; k++) setTimeout(() => wave(e.x, e.y, e.r, '#ffcf80', 1.6), k * 160); }
      else if (e.t === 'outpost') { burst(e.x, e.y, 2.2, '#ffcf80'); wave(e.x, e.y, 6, '#ffcf80', 1.0, 0.1); floatLabel(e.x, e.y, 'OUTPOST', '#ffd9a0'); }
      else if (e.t === 'outpostLost') { burst(e.x, e.y, 2.5, '#6b6b6b'); }
      else if (e.t === 'convoyTurned') { burst(e.x, e.y, 1.2, '#a3d65c'); floatLabel(e.x, e.y, e.name || 'lost', '#ff8a6a'); }
      else if (e.t === 'convoyHome') { burst(e.x, e.y, 0.9, '#ffd27a'); floatLabel(e.x, e.y, e.cart ? '+cart' : '+1 person', '#ffd9a0'); }
      else if (e.t === 'roadAmbush') { /* the mark is drawn from state */ }
      else if (e.t === 'ambushSprung') { burst(e.x, e.y, 2.4, '#ff5a3a'); }
      else if (e.t === 'embers') { const d = K.glowDecal('#ff6a2a', e.r, 1.4); d.position.copy(W(e.x, e.y, 0.05)); fx.add(d); const dur = e.dur || 30; embers.push({ d, t: dur, life: dur, x: e.x, y: e.y }); }
      else if (e.t === 'fireHit') { const v = views.find(q => q.st.id === e.id); if (v) v.hitT = 0.25; }
    }
  }

  // ---------- the trip planner's path: dotted, warm, fading ----------
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.13, 8), new THREE.MeshBasicMaterial({ color: lc('#ffe0a8').multiplyScalar(1.3), transparent: true, opacity: 0.85, depthWrite: false }), 400);
  dots.rotation.x = 0; dots.renderOrder = 6; dots.count = 0; dots.frustumCulled = false; fx.add(dots);
  const tmp = new THREE.Object3D(); let pathSig = '';
  function syncPath(time) {
    const pv = road.preview, h = S.hero;
    const path = pv && pv.path && pv.path.length ? pv.path : h.tripTo && h.path && h.path.length ? h.path : null;
    if (!path) { dots.count = 0; pathSig = ''; return; }
    const pts = [{ x: h.x, y: h.y }, ...path]; let n = 0, carry = (time * 1.4) % 1;
    for (let k = 1; k < pts.length && n < 400; k++) {
      const a = pts[k - 1], b = pts[k], L = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = carry; s < L && n < 400; s += 1) { const t = s / L; tmp.position.copy(W(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0.07)); tmp.rotation.set(-Math.PI / 2, 0, 0); tmp.updateMatrix(); dots.setMatrixAt(n++, tmp.matrix); }
      carry = (carry - L % 1 + 1) % 1;
    }
    dots.count = n; dots.instanceMatrix.needsUpdate = true; dots.material.opacity = pv ? 0.95 : 0.55;
  }

  // ---------- per frame ----------
  function frame(dt, time, dark, events) {
    onEvents(events || []);
    const h = S.hero;
    for (const v of views) {
      const st = v.st, near = Math.hypot(h.x - st.x, h.y - st.y), seen = S.seen[Math.floor(st.y) * N + Math.floor(st.x)] === 1;
      v.g.visible = seen; v.lit += ((st.lit ? 1 : 0) - v.lit) * Math.min(1, dt * 2.5);
      const fl = v.pit.userData.flames; fl.visible = v.lit > 0.05;
      if (fl.visible) { const f = 0.85 + Math.sin(time * 13 + st.at) * 0.08 + Math.sin(time * 7.3) * 0.07; fl.scale.set(v.lit * f, v.lit * (f + Math.sin(time * 17) * 0.1), v.lit * f); fl.children.forEach((c, k) => { if (c.isSprite) c.material.opacity = (0.55 + dark * 0.45) * v.lit; else c.rotation.y = time * (1 + k * 0.3); }); }
      const r = road.ringOf(st) || 3;
      v.pool.scale.setScalar(r * 2.6); v.pool.material.opacity = v.lit * (0.12 + dark * 0.55) * (1 + Math.sin(time * 9 + st.at) * 0.05) * (v.hitT > 0 ? 1.6 : 1);
      v.edge.scale.setScalar(r); v.edge.material.opacity = v.lit * (0.2 + dark * 0.35) * (st.hp < st.maxHp * 0.35 ? 0.6 + 0.4 * Math.sin(time * 8) : 1);
      v.hitT = Math.max(0, v.hitT - dt);
      if (v.prop.userData.lamp) v.prop.userData.lamp.visible = st.lit;
      // kindling: a ring fills while you stand by the fire
      v.prog.visible = !st.lit && st.prog > 0; if (v.prog.visible) { v.prog.geometry.dispose(); v.prog.geometry = new THREE.RingGeometry(0.62, 0.78, 40, 1, Math.PI / 2, Math.PI * 2 * Math.min(1, st.prog / 3)); }
      const free = st.lit && st.towers.filter(id => S.byId.get(id)).length < 2;
      v.pads.forEach(p => { p.visible = free && near < 14; p.material.opacity = 0.35 + 0.25 * Math.sin(time * 3); });
      const tagOn = seen && (near < 16 || st.lit) && near > 2.2;
      v.tag.material.opacity += ((tagOn ? (near < 16 ? 1 : 0.65) : 0) - v.tag.material.opacity) * Math.min(1, dt * 4); v.tag.visible = v.tag.material.opacity > 0.02;
      setBar(v.bar, st.x, 2.0, st.y, st.lit && st.hp < st.maxHp ? st.hp / st.maxHp : 1);
    }
    syncConvoy(dt, time, dark); syncAmbush(time); syncPath(time);
    for (const w of [...waves]) { w.t += dt; const k = w.t / w.life; w.m.scale.setScalar(Math.max(0.01, w.r * (1 - Math.pow(1 - k, 3)))); w.m.material.opacity = 0.85 * (1 - k); if (k >= 1) { fx.remove(w.m); w.m.geometry.dispose(); w.m.material.dispose(); waves.splice(waves.indexOf(w), 1); } }
    for (const em of [...embers]) { em.t -= dt; em.d.material.opacity = Math.max(0, Math.min(1, em.t / 6)) * (0.6 + 0.3 * Math.sin(time * 6 + em.x)); if (em.t <= 0) { fx.remove(em.d); embers.splice(embers.indexOf(em), 1); } }
    // the lantern: dark on a Hunt, your light goes out
    const M = road.mission; if (M && M.lantern === false && heroLight) heroLight.intensity *= 0.08;
  }
  /** warm lights for the view's light pool: lit fires */
  function lights() { return road.stations.filter(s => s.lit).map(s => ({ x: s.x, y: s.y, h: 1.1, i: 2.6, d: 11 })); }
  /** triangles drawn for the stations (budget: under 40k for all four) */
  function tris() { let n = 0; group.traverse(o => { if (o.isMesh && o.visible !== false && o.geometry) { const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return Math.round(n); }
  const api = { frame, lights, tris, group };
  if (typeof window !== 'undefined') window.__roadView = api;
  return api;
}
