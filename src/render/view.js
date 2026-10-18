// three.js view of a game. It only reads game state and drains events.
/* global THREE */
import { N, T, idx } from '../sim/mapgen.js';
import { mulberry32 } from '../sim/rng.js';
import { MOBS } from '../content/mobs.js';
import { mat, box, cyl, cone, buildingMesh, keepMesh, nestMesh, mobMesh, heroMesh, chestMesh, windowMat, torchMat } from './meshes.js';

const TERRAIN_COLOR = {
  [T.GRASS]: 0x6c8a4b, [T.FOREST]: 0x4f6e3c, [T.ROCK]: 0x7d7f74, [T.WATER]: 0x3d6f8a, [T.CLIFF]: 0x7a7266,
  [T.FORD]: 0x6a8f9a, [T.DIRT]: 0x8a7350, [T.VOID]: 0x2a3a2a,
};
const DAY = { bg: 0x9fc4b3, sky: 0xfff2d8, gnd: 0x4d6b3c, sun: 0xffe0ad, hemi: 0.95, sunI: 1.05 };
const NIGHT = { bg: 0x0d1720, sky: 0x5a74a8, gnd: 0x182330, sun: 0x8ea6ff, hemi: 0.34, sunI: 0.3 };
const BLOOD = { bg: 0x220c0f, sky: 0xa85a5a, gnd: 0x2a1418, sun: 0xff8a7a, hemi: 0.34, sunI: 0.35 };

export function createView(canvas, game) {
  const S = game.state, map = game.map, C = map.town.x;
  const W = (x, y, h = 0) => new THREE.Vector3(x - C, h, y - C);
  const vis = mulberry32(map.seed * 7 + 3);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 400);
  const world = new THREE.Group(), fx = new THREE.Group(); scene.add(world, fx);
  scene.background = new THREE.Color(DAY.bg); scene.fog = new THREE.Fog(DAY.bg, 80, 160);
  const hemi = new THREE.HemisphereLight(DAY.sky, DAY.gnd, DAY.hemi);
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI); sun.position.set(18, 34, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 100 }); sun.shadow.bias = -0.0008;
  scene.add(hemi, sun);

  // ---------- terrain: one mesh, one flat-coloured quad per cell ----------
  const pos = [], col = [], cellOf = [];
  const heightOf = t => (t === T.WATER ? -0.18 : t === T.FORD ? -0.08 : t === T.DIRT ? 0.01 : 0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = map.terrain[idx(x, y)]; if (t === T.VOID) continue;
    const h = heightOf(t), x0 = x - C, z0 = y - C;
    pos.push(x0, h, z0, x0, h, z0 + 1, x0 + 1, h, z0, x0 + 1, h, z0, x0, h, z0 + 1, x0 + 1, h, z0 + 1);
    cellOf.push(idx(x, y));
  }
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tgeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  tgeo.computeVertexNormals();
  const ground = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  ground.receiveShadow = true; world.add(ground);
  const under = new THREE.Mesh(new THREE.CircleGeometry(60, 40), mat(0x1f2b1f)); under.rotation.x = -Math.PI / 2; under.position.y = -0.3; world.add(under);
  const tmpC = new THREE.Color();
  function paintTerrain() {
    const ca = tgeo.attributes.color;
    cellOf.forEach((i, q) => {
      const t = map.terrain[i], r = map.region[i];
      tmpC.setHex(TERRAIN_COLOR[t]);
      const n = (Math.sin(i * 12.9898) * 43758.5453) % 1; tmpC.offsetHSL(0, 0, (n - 0.5) * 0.03);
      if (r >= 0 && !S.claimed.has(r)) tmpC.multiplyScalar(0.62).lerp(new THREE.Color(0x2a3328), 0.18);
      for (let v = 0; v < 6; v++) ca.setXYZ(q * 6 + v, tmpC.r, tmpC.g, tmpC.b);
    });
    ca.needsUpdate = true;
  }
  paintTerrain();
  // region borders
  const seg = [];
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
    const r = map.region[idx(x, y)]; if (r < 0) continue;
    const rx = map.region[idx(x + 1, y)], ry = map.region[idx(x, y + 1)];
    if (rx >= 0 && rx !== r) seg.push(x + 1 - C, 0.05, y - C, x + 1 - C, 0.05, y + 1 - C);
    if (ry >= 0 && ry !== r) seg.push(x - C, 0.05, y + 1 - C, x + 1 - C, 0.05, y + 1 - C);
  }
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const borders = new THREE.LineSegments(bgeo, new THREE.LineBasicMaterial({ color: 0xecdfc6, transparent: true, opacity: 0.18 })); world.add(borders);

  // forests, rocks, cliffs, edge woods: instanced
  const dummy = new THREE.Object3D();
  function instanced(geo, material, cells, place) {
    const m = new THREE.InstancedMesh(geo, material, cells.length); m.castShadow = true; m.receiveShadow = true;
    cells.forEach((i, k) => { place(i, dummy); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
    world.add(m); return m;
  }
  const cells = t => { const a = []; for (let i = 0; i < N * N; i++) if (map.terrain[i] === t) a.push(i); return a; };
  const forest = cells(T.FOREST), edge = [];
  for (let i = 0; i < N * N; i++) if (map.terrain[i] === T.VOID) { const x = i % N, y = (i / N) | 0, d = Math.hypot(x + 0.5 - C, y + 0.5 - C); if (d < 36 && (x + y) % 2 === 0) edge.push(i); }
  // thin the canopy so the dead stay visible between the trees
  const treeCells = forest.filter(() => vis() < 0.62).concat(edge);
  const at = (i, o, h = 0) => { const x = i % N, y = (i / N) | 0; o.position.set(x + 0.5 - C + (vis() - 0.5) * 0.5, h, y + 0.5 - C + (vis() - 0.5) * 0.5); };
  instanced(new THREE.CylinderGeometry(0.12, 0.17, 0.7, 5), mat(0x5a4030), treeCells, (i, o) => { at(i, o, 0.35); o.scale.setScalar(1); o.rotation.set(0, 0, 0); });
  const crown = instanced(new THREE.ConeGeometry(0.62, 1.55, 6), mat(0x3f6b3a), treeCells, (i, o) => { at(i, o, 1.3); const s = 0.75 + vis() * 0.45; o.scale.set(s, s * (0.9 + vis() * 0.4), s); o.rotation.y = vis() * 6; });
  treeCells.forEach((i, k) => crown.setColorAt(k, tmpC.setHex(map.terrain[i] === T.VOID ? 0x2c4630 : [0x3f6b3a, 0x4c7a3d, 0x355e3a, 0x5b7f3c][k % 4])));
  instanced(new THREE.DodecahedronGeometry(0.6, 0), mat(0x7d7f74), cells(T.ROCK), (i, o) => { at(i, o, 0.25); o.scale.set(1 + vis() * 0.4, 0.6 + vis() * 0.5, 1 + vis() * 0.4); o.rotation.set(vis(), vis() * 3, vis()); });
  instanced(new THREE.BoxGeometry(1, 1, 1), mat(0x8a8072), cells(T.CLIFF), (i, o) => { const x = i % N, y = (i / N) | 0; o.position.set(x + 0.5 - C, 0.8, y + 0.5 - C); o.scale.set(1.02, 1.6 + vis() * 0.6, 1.02); o.rotation.set(0, 0, 0); });

  // ---------- nests ----------
  const nests = new Map();
  for (const r of map.regions) if (r.nest) { const g = nestMesh(vis); g.position.copy(W(r.nest.x, r.nest.y)); world.add(g); nests.set(r.id, g); }

  // ---------- slots ----------
  const slotTiles = map.slots.map(s => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 2.1), new THREE.MeshStandardMaterial({ color: 0x7a6545, flatShading: true, roughness: 1 }));
    t.position.copy(W(s.x, s.y, 0.04)); t.receiveShadow = true;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) t.add(box(0.1, 0.28, 0.1, 0x5a4030, a * 0.95, 0.14, b * 0.95));
    world.add(t); return t;
  });

  // ---------- markers ----------
  const ringGeo = (a, b) => new THREE.RingGeometry(a, b, 48);
  const selRing = new THREE.Mesh(ringGeo(1.45, 1.65), new THREE.MeshBasicMaterial({ color: 0xeaa441, transparent: true, opacity: 0.9, depthWrite: false }));
  selRing.rotation.x = -Math.PI / 2; selRing.position.y = 0.1; selRing.visible = false; fx.add(selRing);
  const rangeRing = new THREE.Mesh(ringGeo(0.985, 1), new THREE.MeshBasicMaterial({ color: 0xeaa441, transparent: true, opacity: 0.45, depthWrite: false }));
  rangeRing.rotation.x = -Math.PI / 2; rangeRing.position.y = 0.09; rangeRing.visible = false; fx.add(rangeRing);
  const moveMark = new THREE.Mesh(ringGeo(0.3, 0.42), new THREE.MeshBasicMaterial({ color: 0xecdfc6, transparent: true, opacity: 0, depthWrite: false }));
  moveMark.rotation.x = -Math.PI / 2; moveMark.position.y = 0.07; fx.add(moveMark);

  // ---------- health bars ----------
  const barGeo = new THREE.PlaneGeometry(1, 0.2), barFg = new THREE.PlaneGeometry(1, 0.2); barFg.translate(0.5, 0, 0);
  const barBg = new THREE.MeshBasicMaterial({ color: 0x0c1112, transparent: true, opacity: 0.8, depthTest: false });
  const barM = { b: new THREE.MeshBasicMaterial({ color: 0xeaa441, depthTest: false }), z: new THREE.MeshBasicMaterial({ color: 0xa3c65c, depthTest: false }), h: new THREE.MeshBasicMaterial({ color: 0x7fb6e8, depthTest: false }), boss: new THREE.MeshBasicMaterial({ color: 0xd4553f, depthTest: false }) };
  function makeBar(kind, w) { const g = new THREE.Group(), bg = new THREE.Mesh(barGeo, barBg), fg = new THREE.Mesh(barFg, barM[kind]); fg.position.set(-0.5, 0, 0.001); bg.renderOrder = 20; fg.renderOrder = 21; g.add(bg, fg); g.scale.x = w; g.visible = false; g.userData.fg = fg; fx.add(g); return g; }
  function setBar(bar, x, y, z, f) { if (f >= 0.999 || f <= 0) { bar.visible = false; return; } bar.visible = true; bar.position.copy(W(x, z, y)); bar.quaternion.copy(camera.quaternion); bar.userData.fg.scale.x = f; }

  // ---------- entities ----------
  const keepG = keepMesh(); keepG.position.copy(W(C, C)); world.add(keepG);
  const keepBar = makeBar('b', 2.2);
  const bMeshes = new Map(); // building id -> {g, bar, level, rubble}
  const mMeshes = new Map(); // mob id -> {g, b, bar, phase}
  const pMeshes = new Map(); // projectile id -> mesh
  const cMeshes = new Map(); // chest id -> mesh
  const dying = [], effects = [];
  const H = heroMesh(game.state.heroClass); world.add(H.g); const heroBar = makeBar('h', 1.1);
  const arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.7), spitGeo = new THREE.IcosahedronGeometry(0.16, 0);

  function rubble(r) { const g = new THREE.Group(); for (let k = 0; k < 6; k++) { const m = box(0.3 + vis() * 0.5, 0.15 + vis() * 0.3, 0.3 + vis() * 0.5, vis() < 0.5 ? 0x5e5a52 : 0x3a2f26, (vis() - 0.5) * r * 1.3, 0.12, (vis() - 0.5) * r * 1.3); m.rotation.set(vis(), vis() * 3, vis()); g.add(m); } return g; }
  function syncBuildings() {
    const seen = new Set();
    for (const b of S.buildings) {
      seen.add(b.id);
      let e = bMeshes.get(b.id);
      if (!e || e.level !== b.level) {
        if (e) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); }
        const g = buildingMesh(b.type, b.level); g.position.copy(W(b.x, b.y));
        if (b.type === 'wall') { const a = Math.atan2(b.y - C, b.x - C); g.rotation.y = -Math.atan2(Math.cos(a), -Math.sin(a)); }
        else g.rotation.y = -Math.atan2(b.y - C, b.x - C) - Math.PI / 2;
        g.scale.setScalar(0.05); world.add(g);
        e = { g, bar: makeBar('b', 1.4), level: b.level, rubble: null }; bMeshes.set(b.id, e);
      }
      if (b.ruined && !e.rubble) { e.g.visible = false; e.rubble = rubble(b.r); e.rubble.position.copy(W(b.x, b.y)); world.add(e.rubble); }
      if (!b.ruined && e.rubble) { world.remove(e.rubble); e.rubble = null; e.g.visible = true; e.g.scale.setScalar(0.4); }
    }
    for (const [id, e] of bMeshes) if (!seen.has(id)) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); bMeshes.delete(id); }
  }
  function syncMobs() {
    const seen = new Set();
    for (const m of S.mobs) {
      seen.add(m.id);
      if (!mMeshes.has(m.id)) {
        const size = MOBS[m.kind].size, mm = mobMesh(m.kind, size, vis);
        world.add(mm.g); mMeshes.set(m.id, { ...mm, bar: makeBar(m.kind === 'gravelord' || m.kind === 'guardian' ? 'boss' : 'z', 0.8 * size), phase: vis() * 6, size });
      }
    }
    for (const [id, e] of mMeshes) if (!seen.has(id)) { fx.remove(e.bar); dying.push({ g: e.g, t: 0 }); mMeshes.delete(id); }
  }
  function syncProjectiles() {
    const seen = new Set();
    for (const p of S.projectiles) {
      seen.add(p.id);
      let m = pMeshes.get(p.id);
      if (!m) { m = new THREE.Mesh(p.enemy ? spitGeo : arrowGeo, mat(p.enemy ? 0xb8e04a : 0xe8dcc0)); world.add(m); pMeshes.set(p.id, m); }
      const d = Math.hypot(p.tx - p.x, p.ty - p.y), h = p.z * Math.min(1, d / 6) + 0.8;
      m.position.copy(W(p.x, p.y, h)); m.lookAt(W(p.tx, p.ty, 0.9));
    }
    for (const [id, m] of pMeshes) if (!seen.has(id)) { world.remove(m); pMeshes.delete(id); }
  }
  function syncChests() {
    const seen = new Set();
    for (const ch of S.chests) { seen.add(ch.id); if (!cMeshes.has(ch.id)) { const g = chestMesh(); g.position.copy(W(ch.x, ch.y)); world.add(g); cMeshes.set(ch.id, g); } }
    for (const [id, g] of cMeshes) if (!seen.has(id)) { world.remove(g); cMeshes.delete(id); }
  }
  function burst(x, y, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(W(x, y, 0.12)); fx.add(m); effects.push({ m, t: 0, r });
  }

  // ---------- events ----------
  function handleEvents(events) {
    for (const e of events) {
      if (e.t === 'claim') { paintTerrain(); const g = nests.get(e.region); if (g) { burst(map.regions[e.region].nest.x, map.regions[e.region].nest.y, 4, 0xeaa441); world.remove(g); nests.delete(e.region); } }
      if (e.t === 'explode') burst(e.x, e.y, e.r, 0xa3c65c);
      if (e.t === 'keepUp') { const s = 1 + 0.12 * (S.keep.level - 1); keepG.scale.setScalar(s); }
    }
  }

  // ---------- camera ----------
  let zoom = 1, zoomCur = 1; const camTarget = new THREE.Vector3(0, 0, 3);
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); window.addEventListener('resize', resize);
  const bg = new THREE.Color(), tmp = new THREE.Color();
  let dark = 0, time = 0;

  function lerpPalette(k, blood) {
    const P = blood ? BLOOD : NIGHT;
    scene.background.set(DAY.bg).lerp(tmp.set(P.bg), k); scene.fog.color.copy(scene.background);
    hemi.color.set(DAY.sky).lerp(tmp.set(P.sky), k); hemi.groundColor.set(DAY.gnd).lerp(tmp.set(P.gnd), k);
    hemi.intensity = DAY.hemi + (P.hemi - DAY.hemi) * k; sun.color.set(DAY.sun).lerp(tmp.set(P.sun), k); sun.intensity = DAY.sunI + (P.sunI - DAY.sunI) * k;
    windowMat().emissiveIntensity = k * 1.3; torchMat().emissiveIntensity = 0.4 + k * 1.4; H.light.intensity = k * 1.6;
  }

  function frame(dt, ui = {}) {
    time += dt;
    handleEvents(ui.events || []);
    syncBuildings(); syncMobs(); syncProjectiles(); syncChests();
    const night = S.phase === 'night' || S.phase === 'over';
    dark += ((night ? 1 : 0) - dark) * Math.min(1, dt * 1.4);
    lerpPalette(dark, S.phase === 'night' && game.isBloodMoon(S.night));

    // camera follows the hero
    zoomCur += (zoom - zoomCur) * Math.min(1, dt * 8);
    const narrow = camera.aspect < 1, vf = narrow ? 42 : 28;
    if (camera.fov !== vf) { camera.fov = vf; camera.updateProjectionMatrix(); }
    const vh = Math.tan(vf * Math.PI / 360), hh = vh * camera.aspect, R = 20 * zoomCur, dist = Math.max(R / hh, R / vh * 0.8);
    scene.fog.near = dist + 20; scene.fog.far = dist + 110;
    const h = S.hero;
    if (!h.dead) camTarget.lerp(W(h.x, h.y), Math.min(1, dt * 4));
    camera.position.set(camTarget.x, camTarget.y + dist * 0.8, camTarget.z + dist * 0.6); camera.lookAt(camTarget); camera.updateMatrixWorld();

    // hero
    H.g.visible = !h.dead; H.g.position.copy(W(h.x, h.y));
    let df = h.face - H.g.rotation.y; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; H.g.rotation.y += df * Math.min(1, dt * 14);
    H.body.position.y = h.moving ? Math.abs(Math.sin(time * 10)) * 0.07 : 0;
    if (S.heroClass === 'warrior') { if (h.swing > 0) { const p = 1 - h.swing / 0.25; H.weapon.rotation.set(0.15, -1.5 + p * 3, 0); } else H.weapon.rotation.set(0.9, 0, 0); }
    if (!h.dead) setBar(heroBar, h.x, 1.75, h.y, h.hp / h.maxHp); else heroBar.visible = false;

    // mobs
    for (const m of S.mobs) {
      const e = mMeshes.get(m.id); if (!e) continue;
      e.g.position.copy(W(m.x, m.y, (m.rise - 1) * 1.2 * e.size));
      let d = m.face - e.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; e.g.rotation.y += d * Math.min(1, dt * 6);
      e.phase += dt * m.speed * 4;
      e.b.position.y = m.attacking ? 0 : Math.abs(Math.sin(e.phase)) * 0.07; e.b.rotation.z = Math.sin(e.phase * 0.5) * 0.09;
      e.b.position.z = m.attacking ? Math.max(0, Math.sin(time * 6 + e.phase)) * 0.2 : 0;
      setBar(e.bar, m.x, 1.45 * e.size, m.y, m.hp / m.maxHp);
    }
    for (const d of [...dying]) { d.t += dt; d.g.rotation.x = -Math.min(1.4, d.t * 4); d.g.position.y = -Math.max(0, d.t - 0.35) * 2; if (d.t > 1) { world.remove(d.g); dying.splice(dying.indexOf(d), 1); } }
    for (const f of [...effects]) { f.t += dt; const s = 0.5 + f.t * f.r * 2.2; f.m.scale.set(s, s, s); f.m.material.opacity = Math.max(0, 0.9 - f.t * 1.4); if (f.t > 0.7) { fx.remove(f.m); effects.splice(effects.indexOf(f), 1); } }
    for (const g of cMeshes.values()) { g.rotation.y += dt; g.position.y = 0.1 + Math.abs(Math.sin(time * 3)) * 0.15; }

    // buildings
    for (const b of S.buildings) {
      const e = bMeshes.get(b.id); if (!e) continue;
      const sc = e.g.scale.x; if (sc < 1) e.g.scale.setScalar(Math.min(1, sc + dt * 3.2));
      if (!b.ruined) setBar(e.bar, b.x, b.type === 'tower' ? 4.6 : 2.8, b.y, b.hp / b.maxHp); else e.bar.visible = false;
    }
    keepG.visible = !S.keep.ruined;
    setBar(keepBar, C, 7.4, C, S.keep.hp / S.keep.maxHp);

    // slots, nests
    map.slots.forEach((s, i) => {
      const t = slotTiles[i];
      t.visible = S.claimed.has(s.region) && S.slotB[i] < 0;
      if (t.visible) t.material.color.setHex(ui.hoverSlot === i && S.phase === 'day' ? 0xb39060 : 0x7a6545);
    });
    const active = new Set(S.phase === 'night' ? game.activeNests() : game.activeNests(S.night));
    for (const [r, g] of nests) {
      const p = g.userData.pillar; p.visible = active.has(r) || S.purge === r;
      p.material.color.setHex(S.purge === r ? 0xeaa441 : 0xa8d65c);
      p.material.opacity = 0.08 + 0.05 * Math.sin(time * 2 + r) + (S.phase === 'night' ? 0.05 : 0);
    }

    // selection
    const sel = ui.selected;
    selRing.visible = !!sel; rangeRing.visible = false;
    if (sel) {
      let x, y, s = 1;
      if (sel.type === 'slot') { x = map.slots[sel.id].x; y = map.slots[sel.id].y; }
      else if (sel.type === 'keep') { x = C; y = C; s = 1.9; }
      else if (sel.type === 'region') { const n = map.regions[sel.id].nest; x = n.x; y = n.y; s = 1.8; }
      selRing.position.copy(W(x, y, 0.1)); const k = s + Math.sin(time * 4) * 0.04; selRing.scale.set(k, k, k);
      if (sel.range) { rangeRing.visible = true; rangeRing.position.copy(W(x, y, 0.09)); rangeRing.scale.set(sel.range, sel.range, sel.range); }
    }
    if (moveMark.material.opacity > 0) { moveMark.material.opacity = Math.max(0, moveMark.material.opacity - dt * 1.5); moveMark.scale.multiplyScalar(1 + dt * 0.8); }
    renderer.render(scene, camera);
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(cx, cy) {
    const r = canvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x + C, y: hit.z + C };
  }
  function pick(cx, cy) {
    const p = groundAt(cx, cy); if (!p) return null;
    if (Math.hypot(p.x - C, p.y - C) < 2.6) return { type: 'keep', ...p };
    let best = null, bd = 1.6;
    map.slots.forEach((s, i) => { if (!S.claimed.has(s.region)) return; const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; best = i; } });
    if (best !== null) return { type: 'slot', id: best, ...p };
    const cx2 = Math.floor(p.x), cy2 = Math.floor(p.y);
    if (cx2 >= 0 && cy2 >= 0 && cx2 < N && cy2 < N) { const r = map.region[idx(cx2, cy2)]; if (r >= 0 && !S.claimed.has(r)) return { type: 'region', id: r, ...p }; }
    return { type: 'ground', ...p };
  }
  function showMove(x, y) { moveMark.position.copy(W(x, y, 0.07)); moveMark.scale.set(1, 1, 1); moveMark.material.opacity = 0.9; }
  function project(x, y, h = 0.6) { const v = W(x, y, h).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 }; }

  return {
    frame, pick, project, showMove, resize,
    setZoom: z => { zoom = Math.max(0.45, Math.min(1.8, z)); }, getZoom: () => zoom,
  };
}
