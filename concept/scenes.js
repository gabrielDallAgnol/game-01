// Scene definitions for the concept renders.
const SCENES = {};

// ---------- light & atmosphere rigs ----------
const LOOKS = {
  day: {
    bg: '#b9b8b0', fog: ['#b9b8b0', 90, 210],
    hemi: ['#a9bdd0', '#5a5246', 0.6], sun: ['#ffe9cc', 2.75], sunDir: [-0.55, 1.0, 0.42], ambient: 0.0,
    grade: { exposure: 0.95, saturation: 1.0, contrast: 1.12, lift: [0.008, 0.012, 0.02], gain: [1.02, 0.99, 0.95], vignette: 0.42, grain: 0.012 },
    bloom: { strength: 0.18, radius: 0.4, threshold: 0.95 },
  },
  night: {
    bg: '#0f1620', fog: ['#101823', 70, 170],
    hemi: ['#3f5b80', '#0e0f12', 0.42], sun: ['#8fb0de', 0.62], sunDir: [0.5, 1.0, -0.2], ambient: 0.0,
    grade: { exposure: 1.25, saturation: 0.82, contrast: 1.08, lift: [0.0, 0.012, 0.03], gain: [0.95, 1.0, 1.08], vignette: 0.55, grain: 0.02 },
    bloom: { strength: 1.05, radius: 0.62, threshold: 0.82 },
  },
  studio: {
    bg: '#b9b3a7', fog: ['#b9b3a7', 60, 140],
    hemi: ['#e3e5e2', '#73695a', 0.7], sun: ['#ffe6c6', 2.3], sunDir: [-0.65, 1.0, 0.75], ambient: 0.0,
    grade: { exposure: 1.0, saturation: 0.88, contrast: 1.05, lift: [0.02, 0.016, 0.008], gain: [1.02, 1.0, 0.96], vignette: 0.25, grain: 0.008 },
    bloom: { strength: 0.15, radius: 0.4, threshold: 0.95 },
  },
  studioNight: {
    bg: '#141b25', fog: ['#141b25', 60, 140],
    hemi: ['#41608a', '#0c0d10', 0.45], sun: ['#9cb9e4', 0.7], sunDir: [0.5, 1.0, 0.6], ambient: 0.0,
    grade: { exposure: 1.25, saturation: 0.85, contrast: 1.06, lift: [0.0, 0.012, 0.03], gain: [0.95, 1.0, 1.08], vignette: 0.4, grain: 0.012 },
    bloom: { strength: 1.0, radius: 0.55, threshold: 0.82 },
  },
};
function setupLook(scene, name, box) {
  const L = LOOKS[name];
  scene.background = K.lin(L.bg);
  scene.fog = new THREE.Fog(K.lin(L.fog[0]), L.fog[1], L.fog[2]);
  const hemi = new THREE.HemisphereLight(K.lin(L.hemi[0]), K.lin(L.hemi[1]), L.hemi[2]); scene.add(hemi);
  const sun = new THREE.DirectionalLight(K.lin(L.sun[0]), L.sun[1]);
  const [dx, dy, dz] = L.sunDir, len = Math.hypot(dx, dy, dz), c = box.center || [0, 0, 0], R = box.radius || 60;
  sun.position.set(c[0] + dx / len * 120, dy / len * 120, c[2] + dz / len * 120); sun.target.position.set(c[0], 0, c[2]);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2.5;
  const cam = sun.shadow.camera; cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 1; cam.far = 300;
  scene.add(sun); scene.add(sun.target);
  return { look: { grade: L.grade, bloom: L.bloom, sao: box.sao }, sun, hemi };
}
// Thronefall-like camera: tilted ~52°, long lens, looking at a point on the ground
function tiltCam(W, H, target, dist, o = {}) {
  const cam = new THREE.PerspectiveCamera(o.fov || 30, W / H, 5, 400);
  const pitch = (o.pitch || 46) * Math.PI / 180, yaw = (o.yaw || 0) * Math.PI / 180;
  cam.position.set(target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.lookAt(target[0], target[1], target[2]); return cam;
}
const add = (scene, obj, x, y, z, ry = 0, s = 1) => { K.place(obj, x, y, z, ry, s); scene.add(obj); return obj; };

// ---------- quick lighting test ----------
SCENES.test = ({ W, H }) => {
  const scene = new THREE.Scene();
  const { look } = setupLook(scene, 'day', { center: [0, 0, 0], radius: 45 });
  scene.add(K.streets({ W: 120, D: 120, blocks: [{ x: -16, z: -16, w: 22, d: 22 }, { x: 16, z: -16, w: 22, d: 22 }, { x: -16, z: 16, w: 22, d: 22 }, { x: 16, z: 16, w: 22, d: 22 }], lanes: [{ axis: 'x', x: 0, z: 0, len: 120 }, { axis: 'z', x: 0, z: 0, len: 120 }], crossings: [{ axis: 'x', x: 0, z: -7 }] }));
  add(scene, K.apartment({ w: 16, d: 11, floors: 5, seed: 3, ruin: 0.5, burnt: true, vines: 5, shutters: true }), -16, 0.17, -18);
  add(scene, K.apartment({ w: 14, d: 10, floors: 4, seed: 5, color: 'sand', balcony: 0.6 }), 16, 0.17, -18);
  add(scene, K.townhouse({ level: 2 }), -20, 0.17, 16); add(scene, K.townhouse({ level: 3, seed: 3 }), -12, 0.17, 16);
  add(scene, K.tower({ level: 2 }), 12, 0.17, 12); add(scene, K.barricade({ level: 2, len: 10 }), 0, 0, 8);
  add(scene, K.car({ wreck: true }), 3, 0, -3, 0.4); add(scene, K.tree({}), 20, 0.17, 20); add(scene, K.lamp({}), -6, 0.17, -6);
  add(scene, K.heroes.brawler(), -2, 0, 4); add(scene, K.dead.walker(), 2, 0, -1, Math.PI); add(scene, K.dead.brute(), 4, 0, -2, Math.PI);
  return { scene, camera: tiltCam(W, H, [0, 0, -2], 78, { fov: 28 }), look };
};

// ---------- the cast ----------
function plinthScene(look, W, H, items, o = {}) {
  K.T.amount.value = 0;
  const scene = new THREE.Scene();
  const span = o.span || 10;
  const { look: lk } = setupLook(scene, look, { center: [0, 0, 0], radius: span, sao: o.sao });
  const b = new K.B(); b.box(o.ground || 'asphalt', span * 8, 0.1, span * 6, 0, -0.1, 0, { r: 0.02 }); for (let k = -span * 4; k < span * 4; k += 4.5) b.cbox('paint', 2.2, 0.012, 0.16, k, 0.006, 2.2, { r: 0.001 }); scene.add(b.build());
  items.forEach((it, i) => { const x = (i - (items.length - 1) / 2) * (o.gap || 1.6); const obj = it(); obj.position.x = x; obj.rotation.y = o.ry ?? 0.35; scene.add(obj); });
  const cam = new THREE.PerspectiveCamera(o.fov || 22, W / H, 1, 200);
  cam.position.set(0, o.camY || 4.2, o.camZ || 14); cam.lookAt(0, o.lookY || 0.9, 0);
  const bg = '#cdc9c0'; scene.background = K.lin(bg); scene.fog = new THREE.Fog(K.lin(bg), (o.camZ || 14) * 1.15, (o.camZ || 14) * 2.6);
  const rim = new THREE.DirectionalLight(K.lin('#fff4e2'), 1.2); rim.position.set(2, 5, -8); scene.add(rim);
  return { scene, camera: cam, look: lk };
}
SCENES.heroes = ({ W, H }) => plinthScene('day', W, H, [K.heroes.brawler, K.heroes.ranger, K.heroes.scavver], { gap: 1.7, camZ: 9, camY: 2.6, lookY: 0.95, fov: 24, span: 6 });
SCENES.dead = ({ W, H }) => plinthScene('day', W, H, [K.dead.crawler, K.dead.runner, K.dead.walker, K.dead.spitter, K.dead.screamer, K.dead.bloater, K.dead.brute, K.dead.gravelord], { gap: 1.75, camZ: 19, camY: 4.5, lookY: 1.4, fov: 24, span: 10, ry: -0.35 });

// ======================================================================
// THE HAVEN — the main concept scene (day: planning with overlays; night: the siege)
// ======================================================================
function haven(W, H, night, camOpt) {
  const scene = new THREE.Scene();
  const { look, sun } = setupLook(scene, night ? 'night' : 'day', { center: [0, 0, -2], radius: 70 });
  const r = K.rng(4242);
  const BS = 30, ST = 12, P = BS + ST;                      // block size, street width, pitch
  const blocks = [];
  for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 1; gz++) blocks.push({ x: (gx - 0.5) * P + P / 2 - P / 2 + gx * 0, z: 0, gx, gz });
  // block centres: x = ±21, ±63 ; z = ±21, -63, 63
  const centres = [];
  for (const cx of [-105, -63, -21, 21, 63, 105]) for (const cz of [-105, -63, -21, 21, 63]) centres.push([cx, cz]);
  scene.add(K.streets({ W: 260, D: 240, seed: 9, cracks: 140,
    blocks: centres.map(([x, z]) => ({ x, z, w: BS, d: BS, ground: z < 0 ? 'wildwalk' : undefined })),
    lanes: [{ axis: 'x', x: 0, z: 0, len: 260 }, { axis: 'z', x: 0, z: 0, len: 240 }, { axis: 'x', x: 0, z: -42, len: 260 }, { axis: 'z', x: 42, z: 0, len: 240 }, { axis: 'z', x: -42, z: 0, len: 240 }, { axis: 'x', x: 0, z: 42, len: 260 }],
    crossings: [{ axis: 'x', x: 0, z: 9 }, { axis: 'z', x: 9, z: 0 }, { axis: 'z', x: -9, z: 0 }],
    manholes: [[3, 14], [-14, -3], [20, 3]] }));
  const A = (o, x, z, ry = 0, s = 1) => add(scene, o, x, 0.17, z, ry, s);
  const G = (o, x, z, ry = 0, s = 1) => add(scene, o, x, 0, z, ry, s);

  // ---------- the wild: ruined blocks beyond the barricade ----------
  const wallCols = ['bone', 'sand', 'stone', 'pale', 'grey'];
  // overgrowth in the wild: weeds breaking through asphalt and sidewalks north of the line
  const patches = [];
  // weeds hug kerbs and walls: clusters along the block edges, not scattered over the road
  for (let k = 0; k < 34; k++) { const cx = [-36, -6, 6, 36, -48, 48][Math.floor(r() * 6)] + (r() - 0.5) * 2, cz = -8 - r() * 60; patches.push([cx, cz, 1.6, 4 + r() * 6, 10 + Math.floor(r() * 10)]); }
  for (let k = 0; k < 14; k++) patches.push([(r() - 0.5) * 70, [-6.8, -35.2, -48.8][Math.floor(r() * 3)], 5 + r() * 6, 1.2, 10 + Math.floor(r() * 8)]);
  scene.add(K.weeds({ patches, seed: 77 }));
  A(K.apartment({ w: 26, d: 12, floors: 5, seed: 31, ruin: 0.6, burnt: true, vines: 6, shutters: true, color: 'sand' }), -21, -28);
  A(K.apartment({ w: 11, d: 10, floors: 3, seed: 32, ruin: 0.75, burnt: true, vines: 3, color: 'stone', shop: false }), -29, -11, Math.PI / 2);
  A(K.apartment({ w: 24, d: 11, floors: 6, seed: 33, ruin: 0.45, burnt: true, vines: 4, balcony: 0.5, color: 'bone' }), 21, -28);
  A(K.apartment({ w: 12, d: 9, floors: 4, seed: 34, ruin: 0.5, burnt: true, shutters: true, color: 'grey' }), 29, -12, -Math.PI / 2);
  for (const [x, z] of [[-12, -14], [12, -12], [-5, -20]]) A(K.tree({ dead: true, seed: x * 3 + z }), x, z);
  A(K.bush({ seed: 3, n: 6 }), -14, -10); A(K.bush({ seed: 8 }), 16, -8); A(K.bush({ seed: 5, n: 5 }), 7.5, -16);
  // outer ring of ruins fading into the haze
  for (const [cx, cz] of centres) {
    if (Math.abs(cx) <= 21 && Math.abs(cz) <= 21) continue;
    const n = 2;
    for (let k = 0; k < n; k++) {
      const w = 11 + r() * 12, d = 9 + r() * 4, fl = 3 + Math.floor(r() * 4);
      const ox = (k - 0.5) * 14 + (r() - 0.5) * 2, oz = (r() - 0.5) * 8;
      A(K.apartment({ w: Math.min(w, 13), d, floors: fl, seed: Math.floor(r() * 9999), ruin: cz > 21 ? 0.2 + r() * 0.3 : 0.3 + r() * 0.5, burnt: r() < 0.6, vines: Math.floor(r() * 4), color: wallCols[Math.floor(r() * 5)], shutters: true, balcony: r() * 0.5 }), cx + ox, cz + oz, r() < 0.5 ? 0 : Math.PI);
    }
  }
  // wrecks in the wild streets
  for (const [x, z, ry] of [[4, -24, 0.3], [-3.5, -33, 2.8], [5, -52, 1.2], [26, -3, 1.6], [-30, -2.5, 1.4], [44, -18, 0.1], [-44, -30, 3.0], [39, 8, 0.4]]) G(K.car({ wreck: true, seed: Math.floor(x * 7 + z) }), x, z, ry);
  G(K.bus({ color: 'pale', wreck: true }), -46, 12, 1.62);
  A(K.trafficLight({ bent: true }), 7.6, -7.6, -0.6); A(K.trafficLight({}), -7.6, 7.6, Math.PI);

  // ---------- the hive: a metro entrance the dead pour out of ----------
  A(K.metro({ night }), -9.8, -34.5, 0);
  A(K.hospital({ night }), 26, -63, 0);

  // ---------- the frontier: one barricade line across the avenue, stepping up in level ----------
  G(K.barricade({ level: 1, len: 14, seed: 3 }), -31, -6.2);
  G(K.barricade({ level: 2, len: 13, seed: 4 }), -15.5, -6.4);
  G(K.barricade({ level: 2, len: 10, seed: 7 }), 0, -6.6, Math.PI);
  G(K.barricade({ level: 3, len: 16, seed: 5 }), 15, -6.2);
  G(K.barricade({ level: 3, len: 14, seed: 6 }), 31, -6.2);
  const t1 = A(K.tower({ level: 1 }), -38, 1.8); const t2 = A(K.tower({ level: 2 }), -7.4, -2.2, 0.2); const t3 = G(K.tower({ level: 3, night }), 7.8, -2.4);

  // ---------- your land ----------
  // the keep: a bus depot walled with containers
  A(K.keep({ level: 2, night }), -21, 20, 0);
  // restored homes facing the avenue, levels 2 / 3 / 1
  A(K.townhouse({ level: 2, night, seed: 4, color: 'sand' }), 10.4, 12.8, Math.PI);
  A(K.townhouse({ level: 3, night, seed: 6, color: 'bone' }), 17.8, 12.8, Math.PI);
  A(K.townhouse({ level: 1, night, seed: 8, color: 'stone' }), 25.2, 12.8, Math.PI);
  // the avenue on your side: living trees in planters along the kerb
  for (const x of [-34, -27, -13, 13, 27, 34]) { A(K.tree({ seed: x + 50, h: 5.5 }), x, 7.6); const pl = new K.B(); pl.box('curb', 1.6, 0.3, 1.6, 0, 0, 0, { r: 0.05 }); pl.box('olive2', 1.3, 0.32, 1.3, 0, 0, 0, { r: 0.04 }); A(pl.build(), x, 7.6); }
  A(K.farm({ level: 2 }), 13.5, 26); A(K.farm({ level: 1, seed: 4 }), 27.5, 27);
  A(K.tree({ seed: 2 }), 33, 22); A(K.tree({ seed: 5, h: 6 }), 7.5, 33); A(K.bush({ seed: 11 }), 22.5, 21);
  // street life: lamps (lit at night), a bus stop, people
  for (const [x, z, ry] of [[-7.4, 12, 0], [7.4, 24, Math.PI], [-26, 6.8, -Math.PI / 2], [24, 6.8, -Math.PI / 2]]) A(K.lamp({ lit: night, light: night ? 2.6 : 0, dist: 20 }), x, z, ry);
  A(K.busStop(), 22, 7.6, Math.PI);
  G(K.car({ color: 'stone', seed: 6 }), 3.2, 22, 0.05); G(K.car({ color: 'dark', seed: 9 }), 3.2, 29, -0.02);

  if (!night) {
    // townsfolk at work
    const folk = [[-14, 15, 0.4, 'cloth2'], [-17, 23, 2.4, 'cloth1'], [12, 20, 1.2, 'cloth2'], [27, 24, -0.4, 'cloth1'], [20, 22, 3.0, 'stone'], [-2, 16, 1.6, 'cloth2']];
    for (const [x, z, ry, top] of folk) G(K.figure({ outfit: { top, legs: 'cloth3', hair: 'bark' }, pose: { sL: [-0.3, 0, 0], sR: [0.25, 0, 0], hL: [0.25], hR: [-0.2], kR: 0.2 } }), x, z, ry);
    // the hero, placing a house
    G(K.heroes.scavver(), 27.6, 8.4, Math.PI * 0.8);
    // overlays: the build zone, a ghost house, the selected turret with its range, the dead's route
    const cells = [];
    for (let x = 28; x <= 34; x++) for (let z = 9; z <= 18; z++) cells.push([x + 0.5, z + 0.5]);
    for (let x = 7; x <= 34; x++) for (let z = 19; z <= 21; z++) if (x < 9 || x > 31) cells.push([x + 0.5, z + 0.5]);
    scene.add(K.zoneCells(cells, '#7fe08a', 0.3));
    const gh = K.ghost(K.townhouse({ level: 1, seed: 9 }), '#fff0d2', 0.66); add(scene, gh, 31.4, 0.17, 13.2, Math.PI);
    const sel = K.ring(1.9, '#ffffff', 0.9); sel.position.set(7.8, 0.06, -2.4); scene.add(sel);
    const range = K.ring(12, '#ffffff', 0.35, 0.08); range.position.set(7.8, 0.06, -2.4); scene.add(range);
    scene.add(K.chevrons([[-9.8, -30], [-3, -27], [0, -21], [0, -9]], '#d5513d', 0.85));
    scene.add(K.chevrons([[-12, -30], [-36, -20], [-38, -9]], '#d5513d', 0.6));
  } else {
    // the horde: down the avenue from the metro, piling onto the gate; a few at the junk fence
    const kinds = ['walker', 'walker', 'walker', 'walker', 'runner', 'walker', 'crawler', 'walker'];
    for (let k = 0; k < 46; k++) {
      const t = r(); const z = -9 - t * 30 - r() * 3, x = (r() - 0.5) * (6 + t * 10) - t * 4;
      const kind = kinds[Math.floor(r() * kinds.length)];
      G(K.dead[kind]({ eyeGlow: 0.5 }), x, z, (r() - 0.5) * 0.7);
    }
    for (let k = 0; k < 10; k++) G(K.dead.walker({ eyeGlow: 0.5 }), -34 + r() * 8, -8.6 - r() * 5, (r() - 0.5) * 0.6);
    G(K.dead.brute({ eyeGlow: 0.6 }), 1.5, -11, -0.1); G(K.dead.bloater({ eyeGlow: 0.5 }), -2.6, -12.5, 0.2); G(K.dead.spitter({ eyeGlow: 0.5 }), 4.5, -15, -0.3); G(K.dead.screamer({ eyeGlow: 0.5 }), -4, -22, 0.1);
    // the hero at the gate, a burning barrel, the searchlight raking the horde
    G(K.heroes.brawler(), 0.8, -3.6, Math.PI);
    const hl = new THREE.PointLight(K.lin('#ffc890'), 2.2, 9, 2); hl.position.set(0.8, 2.6, -3.0); scene.add(hl);
    const hr = K.ring(0.9, '#fff1d6', 0.75, 0.07); hr.position.set(0.8, 0.07, -3.6); scene.add(hr);
    scene.add(K.beam([8.7, 8.6, -2.9], [-1, 0, -20], 6.5, '#fff1d6', 0.045));
    for (const [x, z, l] of [[-4, -2.5, 2.2], [11.5, 3, 1.6], [-30, 3, 1.8]]) G(K.barrelFire({ light: l, dist: 13 }), x, z);
    const spot = new THREE.SpotLight(K.lin('#fff1d6'), 20, 70, 0.32, 0.85, 1.2); spot.position.set(8.7, 8.6, -2.9); spot.target.position.set(-1, 0, -20);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; scene.add(spot); scene.add(spot.target);
    const t2l = new THREE.PointLight(K.lin('#ffb25a'), 1.4, 10, 2); t2l.position.set(-7.4, 7.5, -2.2); scene.add(t2l);
  }
  K.T.z.value = -7.5; K.T.soft.value = 2.5; K.T.amount.value = night ? 0.55 : 0.8; K.T.dark.value = night ? 0.8 : 0.68;
  const cam = camOpt ? tiltCam(W, H, camOpt.target, camOpt.dist, { fov: camOpt.fov || 28, pitch: camOpt.pitch || 49 }) : tiltCam(W, H, [-1, 0, 0], 120, { fov: 28, pitch: 49 });
  return { scene, camera: cam, look: { ...look, sao: { kernelRadius: 1.1, minDistance: 0.0003, maxDistance: 0.01 } } };
}
SCENES.havenDay = ({ W, H }) => haven(W, H, false);
SCENES.havenNight = ({ W, H }) => haven(W, H, true);

// ======================================================================
// SHEETS — one building per tile, same game-camera angle for all
// ======================================================================
function tile(W, H, make, o = {}) {
  const scene = new THREE.Scene();
  K.T.amount.value = 0;
  const S = o.size || 16;
  const { look } = setupLook(scene, o.look || 'day', { center: [0, 0, 0], radius: S * 1.2 });
  const b = new K.B();
  b.cbox('asphalt', S * 4, 0.1, S * 4, 0, -0.05, 0, { r: 0.001 });
  b.box('curb', S, 0.16, S, 0, 0, 0, { r: 0.05 }); b.box(o.ground || 'sidewalk', S - 0.3, 0.17, S - 0.3, 0, 0, 0, { r: 0.02 });
  if (!o.ground) for (let k = -S / 2 + 1.5; k < S / 2; k += 1.5) { b.cbox('tile', 0.03, 0.01, S - 0.6, k, 0.175, 0, { r: 0.001 }); }
  // a strip of street with its markings, and a few props, so each tile reads as a corner of the city
  for (let k = -S * 1.5; k < S * 1.5; k += 4.5) b.cbox('paint', 2.2, 0.012, 0.16, k, 0.006, S / 2 + 6, { r: 0.001 });
  scene.add(b.build({ cast: false }));
  if (!o.bare) {
    const rr = K.rng(S * 7);
    const lp = K.lamp({ lit: /ight/.test(o.look || ''), light: /ight/.test(o.look || '') ? 2 : 0 }); K.place(lp, S / 2 - 0.6, 0.17, S / 2 - 0.6, -Math.PI / 2); scene.add(lp);
    const bin = new K.B(); bin.box('dark', 0.7, 1.0, 0.6, 0, 0, 0, { r: 0.08 }); bin.cbox('grey', 0.74, 0.08, 0.64, 0, 1.03, 0, { r: 0.03 }); const bn = bin.build(); K.place(bn, -S / 2 + 1.0, 0.17, S / 2 - 1.0, 0.3); scene.add(bn);
    const wd = K.weeds({ patches: [[-S / 2 + 0.4, 0, 0.6, S * 0.8, 10], [0, S / 2 + 0.3, S * 0.8, 0.4, 8]], seed: S }); scene.add(wd);
  }
  const obj = make(); K.place(obj, o.x || 0, 0.17, o.z || 0, o.ry ?? 0); scene.add(obj);
  if (o.extra) o.extra(scene);
  const dist = o.dist || S * 2.1;
  const cam = tiltCam(W, H, [0, o.ty ?? 1.5, o.tz ?? 0], dist, { fov: 26, pitch: 44, yaw: o.yaw ?? 28 });
  // the diorama fades into a soft backdrop
  const night = /ight/.test(o.look || ''), bg = night ? '#121925' : '#cdc9c0';
  scene.background = K.lin(bg); scene.fog = new THREE.Fog(K.lin(bg), dist * 0.95, dist * 1.75);
  return { scene, camera: cam, look: { ...look, sao: { kernelRadius: 0.6, minDistance: 0.0005, maxDistance: 0.02 } } };
}
const T = (name, make, o) => { SCENES[name] = ({ W, H }) => tile(W, H, make, o); };
for (let l = 0; l <= 3; l++) T('house' + l, () => K.townhouse({ level: l, seed: 6, color: 'sand' }), { size: 14, dist: 38, ty: 3.6 });
for (let l = 1; l <= 3; l++) T('keep' + l, () => K.keep({ level: l }), { size: 26, dist: 52, ty: 2.5 });
for (let l = 1; l <= 3; l++) T('tower' + l, () => K.tower({ level: l }), { size: 10, dist: 30, ty: 3.6 });
for (let l = 1; l <= 3; l++) T('wall' + l, () => K.barricade({ level: l, len: 11, seed: 4 }), { size: 14, dist: 25, ty: 1.0, ground: 'asphalt' });
for (let l = 1; l <= 3; l++) T('farm' + l, () => K.farm({ level: l }), { size: 13, dist: 25, ty: 1.2 });
// night detail of the top keep
T('keep3night', () => K.keep({ level: 3, night: true }), { size: 26, dist: 52, ty: 2.5, look: 'studioNight', extra: sc => { for (const [x, z] of [[-8, 9], [9, 9]]) { const l = K.lamp({ lit: true, light: 2.2 }); K.place(l, x, 0.17, z, Math.PI / 2); sc.add(l); } } });

// ---------- hives ----------
function hiveTile(W, H, make, o = {}) {
  K_.HIVE_GLOW = o.glow ?? 0.5;
  const r = tile(W, H, make, { ...o, look: o.look || 'night' });
  // a few of the dead shambling out
  if (o.dead) { const rr = K.rng(5); for (let k = 0; k < o.dead; k++) { const z = K.dead[k % 5 === 4 ? 'runner' : 'walker']({ eyeGlow: 0.22 }); K.place(z, (rr() - 0.5) * o.spread + (o.dx || 0), 0.17, (o.dz || 4) + rr() * 5, (rr() - 0.5) * 1.2); r.scene.add(z); } }
  return r;
}
const HV = (name, make, o) => { SCENES[name] = ({ W, H }) => hiveTile(W, H, make, o); };
HV('hiveHospital', () => K.hospital({ night: true }), { size: 34, dist: 66, ty: 4, tz: 3, dead: 10, spread: 12, dz: 9 });
HV('hiveMetro', () => K.metro({ night: true }), { size: 14, dist: 27, ty: 1.2, tz: 1, dead: 7, spread: 6, dz: 3, glow: 0.25 });
HV('hivePolice', () => K.police({ night: true }), { size: 28, dist: 54, ty: 3, tz: 3, dead: 8, spread: 10, dz: 8 });
HV('hivePetrol', () => K.petrol({ night: true }), { size: 22, dist: 44, ty: 2.5, dead: 8, spread: 10, dz: 3 });
T('hospitalCleared', () => K.hospital({ cleared: true }), { size: 34, dist: 66, ty: 4, tz: 3 });

SCENES.phoneNight = ({ W, H }) => haven(W, H, true, { target: [1, 0, -8], dist: 78, fov: 30, pitch: 52 });
SCENES.phoneDay = ({ W, H }) => haven(W, H, false, { target: [29.5, 0, 15.5], dist: 76, fov: 30, pitch: 54 });
SCENES.tintOn = ({ W, H }) => haven(W, H, false, { target: [0, 0, -6], dist: 92, fov: 28, pitch: 49 });
SCENES.tintOff = ({ W, H }) => { const r = haven(W, H, false, { target: [0, 0, -6], dist: 92, fov: 28, pitch: 49 }); K.T.amount.value = 0; return r; };
