// three.js view of a game: the ruined city. It only reads game state and drains events.
/* global THREE */
import { N, idx, PASSABLE } from '../sim/mapgen.js';
import { mulberry32 } from '../sim/rng.js';
import { MOBS } from '../content/mobs.js';
import { mat, chestMesh, purseMesh, flameMesh } from './meshes.js';
import { createVillagers } from './villagers.js';
import { K, CFG } from './kit.js';
import { createLook } from './look.js';
import { buildCity } from './city.js';
import { createCrowd, bakedWalker, liveRig, vcMat, PEOPLE } from './figures.js';

const lc = hex => new THREE.Color(hex).convertSRGBToLinear();
const BSCALE = { house: 0.3, farm: 0.21, tower: 0.3, wall: 1 / 2.2 };   // world units per metre of each kit model
const HERO_RIG = { warrior: 'brawler', archer: 'ranger', merchant: 'scavver', steward: 'scavver' };
const HOUSE_COLORS = ['sand', 'bone', 'stone', 'pale'];
const HIVES = ['metro', 'petrol', 'hospital'];

export function createView(canvas, game, opts = {}) {
  const S = game.state, map = game.map, C = map.town.x;
  const W = (x, y, h = 0) => new THREE.Vector3(x - C, h, y - C);
  const vis = mulberry32(map.seed * 7 + 3);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 300);
  const world = new THREE.Group(), fx = new THREE.Group(); scene.add(world, fx);
  const look = createLook({ renderer, scene, camera, canvas });

  // ---------- the city ----------
  CFG.lite = true;
  const city = buildCity({ map, S, world, W, C, rand: vis });

  // ---------- night lights: a fixed pool, handed to the sources nearest the camera ----------
  const POOL = 6, pool = [];
  for (let k = 0; k < POOL; k++) { const l = new THREE.PointLight(lc('#ffb15a'), 0, 9, 2); scene.add(l); pool.push(l); }
  const heroLight = new THREE.PointLight(lc('#ffc890'), 0, 6, 2); scene.add(heroLight);
  const spot = new THREE.SpotLight(lc('#fff1d6'), 0, 26, 0.32, 0.8, 1.2); spot.castShadow = false; scene.add(spot, spot.target);
  const beamGeo = new THREE.CylinderGeometry(0.06, 1, 1, 20, 6, true); beamGeo.translate(0, -0.5, 0);
  { const pa = beamGeo.attributes.position, cols = []; for (let i = 0; i < pa.count; i++) { const t = -pa.getY(i); const v = 0.15 + 0.85 * Math.pow(t, 1.6); cols.push(v, v, v); } beamGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); }
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: lc('#fff1d6').multiplyScalar(0.5), vertexColors: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.visible = false; fx.add(beam);

  // ---------- hives: landmarks the dead pour out of ----------
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  function hiveModel(kind) {
    CFG.hiveGlow = 0;
    let g;
    if (kind === 'metro') { g = K.metro({}); g.scale.setScalar(0.42); }
    else if (kind === 'petrol') { g = K.petrol({}); g.scale.setScalar(0.24); }
    else {
      // a hospital ambulance bay: canopy, sign wall, wrecked ambulances
      g = new THREE.Group(); const b = new K.B();
      b.cbox('pale', 8, 0.35, 4, 0, 3.0, 0, { r: 0.08 }); for (const x of [-3.6, 3.6]) b.box('pale', 0.3, 2.85, 0.3, x, 0, 1.7, { r: 0.04 });
      b.box('pale', 9, 2.4, 0.5, 0, 0, -2.2, { r: 0.05 }); b.cbox('danger', 1.4, 0.45, 0.1, -3, 1.5, -1.92, { r: 0.02 }); b.cbox('danger', 0.45, 1.4, 0.1, -3, 1.5, -1.92, { r: 0.02 });
      g.add(b.build());
      const s = K.sign('HOSPITAL', 4.5, 0.8, { bg: '#e7e1d3', fg: '#3c4a2f', size: 84 }); s.position.set(1.4, 1.6, -1.93); g.add(s);
      for (const [x, ry] of [[-2, 0.3], [2.6, -0.5]]) { const am = K.car({ color: 'pale', wreck: true, seed: 3 }); am.scale.set(1.25, 1.4, 1.15); am.position.set(x, 0, 3.2); am.rotation.y = ry; g.add(am); }
      g.scale.setScalar(0.3);
    }
    CFG.hiveGlow = 1;
    const pale = K.M('pale'), stone = K.M('stone');
    g.traverse(o => { if (o.isMesh && o.material === pale) o.material = stone; });
    return g;
  }
  const hives = new Map(); let nestKey = '', nearNests = new Set();
  for (const r of map.regions) if (r.nest) {
    const kind = HIVES[r.id % HIVES.length], g = new THREE.Group(); g.position.copy(W(r.nest.x, r.nest.y)); g.rotation.y = Math.atan2(C - r.nest.x, C - r.nest.y);
    g.add(hiveModel(kind));
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: glowTex, color: lc('#8fff3a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    decal.rotation.x = -Math.PI / 2; decal.position.y = 0.05; decal.renderOrder = 3; g.add(decal);
    const haze = [];
    for (let k = 0; k < 5; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lc('#9dff4a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(1.6 + k * 0.4); sp.position.set(Math.cos(k * 2.1) * 0.8, 0.6 + k * 0.45, Math.sin(k * 2.1) * 0.8); g.add(sp); haze.push(sp); }
    world.add(g); hives.set(r.id, { g, decal, haze, glow: 0 });
  }

  // ---------- scavenge sites: a cache of supplies at a doorway into the ruins ----------
  const diaGeo = new THREE.OctahedronGeometry(0.3, 0); diaGeo.scale(1, 1.5, 1);
  const diaMat = new THREE.MeshBasicMaterial({ color: lc('#f0a24a').multiplyScalar(1.7) });
  const sites = S.scav.sites.map(st => {
    const g = new THREE.Group(); g.position.copy(W(st.x, st.y)); g.rotation.y = st.face;
    const b = new K.B();
    b.cbox('canvas', 0.42, 0.3, 0.32, -0.12, 0, 0.1, { r: 0.03 }); b.cbox('amberDeep', 0.3, 0.24, 0.3, 0.22, 0, -0.05, { r: 0.03, ry: 0.4 });
    b.cbox('canvas', 0.3, 0.22, 0.24, -0.08, 0.3, 0.08, { r: 0.03, ry: -0.3 }); b.cyl('steel', 0.11, 0.11, 0.36, 0.3, 0, 0.32, { seg: 10 });
    b.box('metal', 0.03, 1.1, 0.03, -0.4, 0, -0.25); b.cbox('amber', 0.32, 0.2, 0.02, -0.24, 0.86, -0.25, { r: 0.005 });
    const cache = b.build(); cache.scale.setScalar(1.5); cache.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(cache);
    const dia = new THREE.Mesh(diaGeo, diaMat); dia.position.y = 1.5; g.add(dia);
    const lamp = K.glowSprite('#ffb060', 1.4, 1.2); lamp.position.set(0, 0.5, 0); lamp.visible = false; g.add(lamp);
    g.visible = false; world.add(g);
    return { st, g, dia, lamp, cache };
  });
  const siteVis = new Set(); let siteT = 0;
  function updateSites(dt, t) {
    siteT -= dt;
    if (siteT <= 0) {
      siteT = 0.4; siteVis.clear();
      for (const m of sites) {
        const i = game.scavenge.siteInfo(m.st.id), out = !!i.run, show = out || (i.visible && S.phase === 'day');
        m.g.visible = show; m.dia.visible = show && !out; m.lamp.visible = out;
        if (show && !out) siteVis.add(m.st.id);
      }
    }
    for (const m of sites) if (m.g.visible) { m.dia.position.y = 1.9 + Math.sin(t * 2.2 + m.st.id) * 0.12; m.dia.rotation.y = t * 1.2; m.lamp.material.opacity = 0.6 + Math.sin(t * 7 + m.st.id) * 0.15; }
  }

  // ---------- markers ----------
  const ringGeo = (a, b) => new THREE.RingGeometry(a, b, 48);
  const selRing = new THREE.Mesh(ringGeo(1.45, 1.6), new THREE.MeshBasicMaterial({ color: lc('#ffffff').multiplyScalar(1.2), transparent: true, opacity: 0.9, depthWrite: false }));
  selRing.rotation.x = -Math.PI / 2; selRing.position.y = 0.1; selRing.visible = false; fx.add(selRing);
  const rangeRing = new THREE.Mesh(ringGeo(0.985, 1), new THREE.MeshBasicMaterial({ color: lc('#ffffff'), transparent: true, opacity: 0.4, depthWrite: false }));
  rangeRing.rotation.x = -Math.PI / 2; rangeRing.position.y = 0.09; rangeRing.visible = false; fx.add(rangeRing);
  const moveMark = new THREE.Mesh(ringGeo(0.3, 0.42), new THREE.MeshBasicMaterial({ color: lc('#ecdfc6'), transparent: true, opacity: 0, depthWrite: false }));
  moveMark.rotation.x = -Math.PI / 2; moveMark.position.y = 0.07; fx.add(moveMark);
  const heroRing = new THREE.Mesh(ringGeo(0.42, 0.5), new THREE.MeshBasicMaterial({ color: lc('#fff1d6'), transparent: true, opacity: 0.75, depthWrite: false }));
  heroRing.rotation.x = -Math.PI / 2; heroRing.renderOrder = 4; fx.add(heroRing);

  // ---------- tonight's routes: chevrons flowing from each hive to the town ----------
  const chevGeo = new THREE.ConeGeometry(0.28, 0.7, 3); chevGeo.rotateX(Math.PI / 2); chevGeo.scale(1, 0.25, 1);
  const routeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  let routeMesh = null, routeSig = '', routes = [];
  const SPACING = 1.2, tmpC = new THREE.Color();
  function rebuildRoutes() {
    routes = game.forecast().map(r => {
      const cum = [0]; for (let k = 1; k < r.path.length; k++) cum.push(cum[k - 1] + Math.hypot(r.path[k][0] - r.path[k - 1][0], r.path[k][1] - r.path[k - 1][1]));
      return { ...r, cum, len: cum[cum.length - 1] };
    });
    const count = routes.reduce((a, r) => a + Math.max(1, Math.floor(r.len / SPACING)), 0);
    if (routeMesh) { fx.remove(routeMesh); routeMesh.dispose(); }
    routeMesh = new THREE.InstancedMesh(chevGeo, routeMat, Math.max(1, count)); routeMesh.renderOrder = 5; fx.add(routeMesh);
    let k = 0; for (const r of routes) { const n = Math.max(1, Math.floor(r.len / SPACING)); for (let q = 0; q < n; q++) routeMesh.setColorAt(k++, tmpC.copy(lc(r.siege ? '#e3a54a' : '#d5513d')).multiplyScalar(1.3)); }
    if (routeMesh.instanceColor) routeMesh.instanceColor.needsUpdate = true;
  }
  const rd = new THREE.Object3D();
  function animateRoutes(t) {
    if (!routeMesh) return;
    let k = 0;
    for (const r of routes) {
      const n = Math.max(1, Math.floor(r.len / SPACING)); let seg = 1;
      for (let q = 0; q < n; q++) {
        const at = (q * SPACING + (t * 1.6) % SPACING);
        while (seg < r.cum.length - 1 && r.cum[seg] < at) seg++;
        const a = r.path[seg - 1], b = r.path[Math.min(seg, r.path.length - 1)], L = (r.cum[seg] - r.cum[seg - 1]) || 1, f = Math.min(1, Math.max(0, (at - r.cum[seg - 1]) / L));
        rd.position.copy(W(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.06));
        rd.rotation.set(0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0); const fade = Math.min(1, (r.len - at) / 3, at / 2 + 0.3); rd.scale.setScalar(Math.max(0.2, fade));
        rd.updateMatrix(); routeMesh.setMatrixAt(k++, rd.matrix);
      }
    }
    routeMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- health bars ----------
  const barGeo = new THREE.PlaneGeometry(1, 0.16), barFg = new THREE.PlaneGeometry(1, 0.16); barFg.translate(0.5, 0, 0);
  const barBg = new THREE.MeshBasicMaterial({ color: lc('#0c1112'), transparent: true, opacity: 0.8, depthTest: false });
  const barM = { b: new THREE.MeshBasicMaterial({ color: lc('#d9843a'), depthTest: false }), z: new THREE.MeshBasicMaterial({ color: lc('#a3d65c'), depthTest: false }), h: new THREE.MeshBasicMaterial({ color: lc('#e9e3d6'), depthTest: false }), boss: new THREE.MeshBasicMaterial({ color: lc('#d5513d'), depthTest: false }) };
  function makeBar(kind, w) { const g = new THREE.Group(), bg = new THREE.Mesh(barGeo, barBg), fg = new THREE.Mesh(barFg, barM[kind]); fg.position.set(-0.5, 0, 0.001); bg.renderOrder = 20; fg.renderOrder = 21; g.add(bg, fg); g.scale.x = w; g.visible = false; g.userData.fg = fg; fx.add(g); return g; }
  function setBar(bar, x, y, z, f) { if (f >= 0.999 || f <= 0) { bar.visible = false; return; } bar.visible = true; bar.position.copy(W(x, z, y)); bar.quaternion.copy(camera.quaternion); bar.userData.fg.scale.x = f; }

  // ---------- buildings ----------
  function model(type, level, b) {
    let m;
    if (type === 'house') m = K.townhouse({ level, seed: (b ? b.id : 1) * 13 + 5, color: HOUSE_COLORS[(b ? b.id : 0) % HOUSE_COLORS.length], game: true });
    else if (type === 'farm') m = K.farm({ level, seed: b ? b.id : 1 });
    else if (type === 'tower') m = K.tower({ level, game: true });
    else if (type === 'wall') m = K.post(level, b ? b.links : { e: true, w: true }, b ? b.id : 1);
    m.scale.setScalar(BSCALE[type]);
    return m;
  }
  // homes face the keep, square to the street grid
  function faceKeep(x, y) { const dx = C - x, dy = C - y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dy > 0 ? 0 : Math.PI); }

  let keepLevel = 0, keepG = null; const lampGlow = [];
  function syncKeep() {
    if (keepLevel === S.keep.level && keepG) return;
    if (keepG) world.remove(keepG); lampGlow.length = 0;
    keepLevel = S.keep.level; keepG = K.keep({ level: keepLevel, game: true }); keepG.scale.setScalar(0.24); keepG.position.copy(W(C, C)); keepG.rotation.y = Math.PI; world.add(keepG);
    for (const [x, z, ry] of [[-11.5, 9.5, Math.PI / 2], [11.5, 9.5, Math.PI / 2], [-11.5, -9.5, -Math.PI / 2], [11.5, -9.5, -Math.PI / 2]]) { const l = K.lamp({}); l.position.set(x, 0, z); l.rotation.y = ry; l.traverse(o => { if (o.isMesh && o.material.emissive === undefined) return; }); keepG.add(l); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lc('#ffd9a0'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x + (ry > 0 ? 0 : 0), 5.8, z + (ry > 0 ? -1.3 : 1.3)); sp.scale.setScalar(3.5); keepG.add(sp); lampGlow.push(sp); }
  }
  syncKeep();
  const keepBar = makeBar('b', 2.2);
  const bMeshes = new Map(), mobState = new Map(), pMeshes = new Map(), cMeshes = new Map();
  const dying = [], effects = [];
  const crowd = createCrowd(world); crowd.warm(['walker', 'runner']);

  const heroRig = liveRig(K.heroes[HERO_RIG[S.heroClass] || 'brawler']()); world.add(heroRig.g);
  const heroBar = makeBar('h', 1.0);
  const arrowGeo = new THREE.BoxGeometry(0.04, 0.04, 0.6), spitGeo = new THREE.IcosahedronGeometry(0.13, 0);
  const arrowMat = new THREE.MeshBasicMaterial({ color: lc('#f0e2c4').multiplyScalar(1.5) }), spitMat = new THREE.MeshBasicMaterial({ color: lc('#b4ff4e').multiplyScalar(2) });

  function rubbleModel(seed) { const b = new K.B(), r = K.rng(seed); K.rubble(b, 0, 0, 2.2, 22, r, 'sand'); const g = b.build(); g.scale.setScalar(0.3); return g; }
  function wallLinks(b) {
    const x = Math.floor(b.x), y = Math.floor(b.y);
    const l = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) return false; const o = S.byId.get(S.occ[idx(xx, yy)]); return !!(o && (o.type === 'wall' || o.type === 'tower') && !o.ruined); });
    return { e: l[0], w: l[1], s: l[2], n: l[3], key: l.map(v => (v ? 1 : 0)).join('') };
  }
  function syncBuildings() {
    const seen = new Set();
    for (const b of S.buildings) {
      seen.add(b.id);
      let e = bMeshes.get(b.id);
      const links = b.type === 'wall' ? wallLinks(b) : null, lk = links ? links.key : '';
      if (!e || e.level !== b.level || e.lk !== lk) {
        const relink = e && e.level === b.level;
        if (e) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); }
        const g = new THREE.Group(), m = model(b.type, b.level, { id: b.id, links }); g.add(m);
        g.position.copy(W(b.x, b.y)); if (b.type === 'house' || b.type === 'farm') g.rotation.y = faceKeep(b.x, b.y);
        g.scale.setScalar(relink ? 1 : 0.05); world.add(g);
        e = { g, bar: makeBar('b', b.type === 'wall' ? 0.6 : 1.1), level: b.level, lk, rubble: null, type: b.type }; bMeshes.set(b.id, e);
        if (b.ruined) e.g.visible = false;
      }
      if (b.ruined && !e.rubble) { e.g.visible = false; e.rubble = rubbleModel(b.id); e.rubble.position.copy(W(b.x, b.y)); e.rubble.scale.multiplyScalar(b.type === 'wall' ? 0.4 : 0.8); world.add(e.rubble); }
      if (!b.ruined && e.rubble) { world.remove(e.rubble); e.rubble = null; e.g.visible = true; e.g.scale.setScalar(0.4); }
    }
    for (const [id, e] of bMeshes) if (!seen.has(id)) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); bMeshes.delete(id); }
  }
  function syncMobs() {
    const seen = new Set();
    for (const m of S.mobs) {
      seen.add(m.id);
      if (!mobState.has(m.id)) { const size = MOBS[m.kind].size; mobState.set(m.id, { bar: makeBar(m.kind === 'gravelord' || m.kind === 'guardian' ? 'boss' : 'z', 0.7 * size), phase: vis() * 6, face: m.face || 0, size, kind: m.kind, x: m.x, y: m.y }); }
    }
    for (const [id, e] of mobState) if (!seen.has(id)) { fx.remove(e.bar); dying.push({ kind: e.kind, x: e.x, y: e.y, face: e.face, t: 0 }); mobState.delete(id); }
  }
  function syncProjectiles() {
    const seen = new Set();
    for (const p of S.projectiles) {
      seen.add(p.id);
      let m = pMeshes.get(p.id);
      if (!m) { m = new THREE.Mesh(p.enemy ? spitGeo : arrowGeo, p.enemy ? spitMat : arrowMat); world.add(m); pMeshes.set(p.id, m); }
      const d = Math.hypot(p.tx - p.x, p.ty - p.y), h = p.z * Math.min(1, d / 6) * 0.7 + 0.6;
      m.position.copy(W(p.x, p.y, h)); m.lookAt(W(p.tx, p.ty, 0.7));
    }
    for (const [id, m] of pMeshes) if (!seen.has(id)) { world.remove(m); pMeshes.delete(id); }
  }
  function syncChests() {
    const seen = new Set();
    for (const ch of S.chests) { seen.add(ch.id); if (!cMeshes.has(ch.id)) { const g = chestMesh(); g.scale.setScalar(0.75); g.position.copy(W(ch.x, ch.y)); world.add(g); cMeshes.set(ch.id, g); } }
    for (const [id, g] of cMeshes) if (!seen.has(id)) { world.remove(g); cMeshes.delete(id); }
  }
  function burst(x, y, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 32), new THREE.MeshBasicMaterial({ color: lc(color).multiplyScalar(1.4), transparent: true, opacity: 0.9, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(W(x, y, 0.12)); fx.add(m); effects.push({ m, t: 0, r });
  }

  // ---------- sellswords, purses ----------
  const aMeshes = new Map(), puMeshes = new Map();
  const mercRig = () => K.figure({ outfit: { top: 'cloth3', sleeve: 'cloth3', legs: 'dark', vest: 'amberDeep', cap: 'grey', boots: 'tyre' }, bw: 1.05, pose: { sR: [-0.5, 0, 0.15], eR: -1.0, sL: [-0.3, 0, 0.1], eL: -0.8 }, props: p => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), K.M('steel')); m.position.y = -0.3; g.add(m); g.rotation.x = -1.1; p.hand.add(g); } });
  function syncAllies() {
    const seen = new Set();
    for (const a of S.allies) { seen.add(a.id); if (!aMeshes.has(a.id)) { const r = liveRig(mercRig()); world.add(r.g); aMeshes.set(a.id, { ...r, bar: makeBar('h', 0.6), phase: vis() * 6 }); burst(a.x, a.y, 0.8, '#d9843a'); } }
    for (const [id, e] of aMeshes) if (!seen.has(id)) { fx.remove(e.bar); world.remove(e.g); aMeshes.delete(id); }
  }
  function syncPurses() {
    const seen = new Set();
    for (const p of S.purses) { seen.add(p.id); if (!puMeshes.has(p.id)) { const g = purseMesh(); g.scale.setScalar(0.7); g.position.copy(W(p.x, p.y)); world.add(g); puMeshes.set(p.id, g); } }
    for (const [id, g] of puMeshes) if (!seen.has(id)) { world.remove(g); puMeshes.delete(id); }
  }
  function bolt(e) {
    const len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0), m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, len), new THREE.MeshBasicMaterial({ color: lc('#ffe0a0').multiplyScalar(2), transparent: true, opacity: 0.95 }));
    m.position.copy(W((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, 1.8)); m.lookAt(W(e.x1, e.y1, 1.8)); fx.add(m); effects.push({ m, t: 0, r: 0, line: true });
  }
  const flames = []; const flameFor = new Map();

  // ---------- placement ghost and build zone ----------
  const ghostCells = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }), 64);
  ghostCells.renderOrder = 6; ghostCells.visible = false; fx.add(ghostCells);
  let ghostMesh = null, ghostKey = '';
  const ZONE_MAX = 2500;
  const zoneMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: lc('#5fd06a'), transparent: true, opacity: 0.38, depthWrite: false }), ZONE_MAX);
  zoneMesh.renderOrder = 5; zoneMesh.visible = false; fx.add(zoneMesh); let zoneRef = null;
  function setZone(z) {
    if (z === zoneRef) return; zoneRef = z;
    if (!z) { zoneMesh.visible = false; return; }
    const d = new THREE.Object3D(); let k = 0;
    for (let i = 0; i < N * N && k < ZONE_MAX; i++) if (z[i]) { d.position.copy(W((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.05)); d.scale.set(0.9, 1, 0.9); d.updateMatrix(); zoneMesh.setMatrixAt(k++, d.matrix); }
    zoneMesh.count = k; zoneMesh.instanceMatrix.needsUpdate = true; zoneMesh.visible = true;
  }
  function setGhost(gh) {
    if (!gh) { ghostCells.visible = false; if (ghostMesh) ghostMesh.visible = false; return; }
    const d = new THREE.Object3D();
    gh.cells.slice(0, 64).forEach((i, k) => {
      const ok = gh.okCells ? gh.okCells[k] : gh.ok;
      d.position.copy(W((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.08)); d.updateMatrix(); ghostCells.setMatrixAt(k, d.matrix);
      ghostCells.setColorAt(k, tmpC.copy(lc(ok === 'skip' ? '#b8b0a0' : ok ? '#fff1b8' : '#e0604a')));
    });
    ghostCells.count = Math.min(64, gh.cells.length); ghostCells.instanceMatrix.needsUpdate = true; if (ghostCells.instanceColor) ghostCells.instanceColor.needsUpdate = true; ghostCells.visible = true;
    if (gh.type === 'wall') { if (ghostMesh) ghostMesh.visible = false; return; }
    if (gh.type !== ghostKey) {
      if (ghostMesh) fx.remove(ghostMesh);
      ghostMesh = new THREE.Group(); ghostMesh.add(K.ghost(model(gh.type, 1, null), '#fff0d2', 0.6)); fx.add(ghostMesh); ghostKey = gh.type;
    }
    ghostMesh.visible = true; ghostMesh.position.copy(W(gh.x, gh.y)); ghostMesh.rotation.y = gh.type === 'house' || gh.type === 'farm' ? faceKeep(gh.x, gh.y) : 0;
  }

  const villagerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const TOPS = ['cloth1', 'cloth2', 'stone', 'cloth3', 'sand'];
  const villagers = createVillagers({ THREE, world, game, W, map, figure: () => {
    const top = TOPS[Math.floor(Math.random() * TOPS.length)], pack = Math.random() < 0.3;
    return bakedWalker(() => K.figure({ outfit: { top, legs: Math.random() < 0.5 ? 'cloth3' : 'dark', hair: Math.random() < 0.5 ? 'bark' : 'tyre', cap: Math.random() < 0.2 ? 'amber' : null, pack: pack ? 'canvas' : null }, pose: { sL: [0.15, 0, 0], sR: [-0.15, 0, 0], hL: [0.25], hR: [-0.25], kR: 0.2 } }), villagerMat);
  } });
  // ---------- scavengers: crews walk out to their site at nightfall and home at dawn ----------
  const crewWalkers = [];
  const scavRig = () => bakedWalker(() => K.figure({ outfit: { top: 'cloth3', legs: 'dark', hair: 'tyre', cap: 'grey', pack: 'canvas', vest: 'amberDeep' }, pose: { sL: [0.15, 0, 0], sR: [-0.15, 0, 0], hL: [0.25], hR: [-0.25], kR: 0.2 } }), villagerMat);
  function gridPath(ax, ay, bx, by) {
    const ok = i => PASSABLE[map.terrain[i]];
    const s0 = idx(Math.floor(ax), Math.floor(ay)), g0 = idx(Math.floor(bx), Math.floor(by));
    const prev = new Int32Array(N * N).fill(-1), q = [s0]; prev[s0] = s0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (i === g0) break; const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const j = idx(xx, yy); if (prev[j] < 0 && (ok(j) || j === g0)) { prev[j] = i; q.push(j); } }
    }
    if (prev[g0] < 0) return [[ax, ay], [bx, by]];
    const out = []; for (let i = g0; i !== s0; i = prev[i]) out.push([(i % N) + 0.5, ((i / N) | 0) + 0.5]); out.push([ax, ay]); out.reverse(); out[out.length - 1] = [bx, by];
    return out;
  }
  function sendWalkers(site, n, home) {
    const st = S.scav.sites[site]; if (!st) return;
    const a = [C + 0.5, C + 3.5], b = [st.x, st.y], path = home ? gridPath(b[0], b[1], a[0], a[1]) : gridPath(a[0], a[1], b[0], b[1]);
    for (let k = 0; k < Math.min(n, 4); k++) {
      const w = scavRig(); world.add(w.g);
      crewWalkers.push({ ...w, path, seg: 1, d: -k * 0.7, phase: k, ox: (k % 2 ? 0.25 : -0.25), oy: k > 1 ? 0.3 : 0 });
    }
  }
  function stepWalkers(dt) {
    for (let k = crewWalkers.length - 1; k >= 0; k--) {
      const w = crewWalkers[k]; w.d += dt * 2.2; w.phase += dt;
      if (w.d < 0) { w.g.visible = false; continue; }
      w.g.visible = true;
      let rem = dt * 2.2;
      while (rem > 0 && w.seg < w.path.length) {
        const [ax, ay] = w.pos || w.path[0], [bx, by] = w.path[w.seg], L = Math.hypot(bx - ax, by - ay);
        if (L <= rem) { w.pos = [bx, by]; w.seg++; rem -= L; } else { w.pos = [ax + (bx - ax) / L * rem, ay + (by - ay) / L * rem]; rem = 0; w.face = Math.atan2(bx - ax, by - ay); }
      }
      if (!w.pos) w.pos = w.path[0];
      if (w.seg >= w.path.length) { world.remove(w.g); crewWalkers.splice(k, 1); continue; }
      w.g.position.copy(W(w.pos[0] + w.ox, w.pos[1] + w.oy)); w.g.rotation.y = w.face || 0;
      const f = Math.floor(w.phase * 6) % 2; w.frames[0].visible = !f; w.frames[1].visible = !!f;
    }
  }
  let orbit = 0;

  // ---------- events ----------
  let repaint = false;
  function handleEvents(events) {
    for (const e of events) {
      if (e.t === 'claim') { city.setTerritory(); repaint = true; const h = hives.get(e.region); if (h) { const n = map.regions[e.region].nest; burst(n.x, n.y, 4, '#d9843a'); h.cleared = true; } }
      if (e.t === 'scavGo') sendWalkers(e.site, e.n, false);
      if (e.t === 'scavBack') sendWalkers(e.site, e.n, true);
      if (e.t === 'explode') burst(e.x, e.y, e.r, '#a3c65c');
      if (e.t === 'build' || e.t === 'remove' || e.t === 'ruin' || e.t === 'rebuild') repaint = true;
      if (e.t === 'volley') burst(e.x, e.y, e.r, '#d9843a');
      if (e.t === 'warcry') burst(e.x, e.y, e.r, '#d5513d');
      if (e.t === 'bell') { burst(C, C, 8, '#ffd27a'); burst(C, C, 5, '#ffd27a'); }
      if (e.t === 'bolt') bolt(e);
      if (e.t === 'purseTaken') burst(S.hero.x, S.hero.y, 0.8, '#d9843a');
    }
  }

  // ---------- camera ----------
  let zoom = 1, zoomCur = 1; const camTarget = new THREE.Vector3(0, 0, 3);
  const touch = matchMedia('(pointer: coarse)').matches;
  look.init(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, opts.quality || (touch ? 'medium' : 'high'));
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; look.resize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); window.addEventListener('resize', resize);
  // rain for thunderstorms: streaks falling in a box that follows the camera
  const RAIN = 700, rainGeo = new THREE.BoxGeometry(0.012, 0.5, 0.012);
  const rain = new THREE.InstancedMesh(rainGeo, new THREE.MeshBasicMaterial({ color: K.lin('#9fb3c8'), transparent: true, opacity: 0.35, depthWrite: false }), RAIN);
  rain.frustumCulled = false; rain.visible = false; fx.add(rain);
  const drops = Array.from({ length: RAIN }, () => ({ x: (Math.random() - 0.5) * 40, y: Math.random() * 14, z: (Math.random() - 0.5) * 30, v: 16 + Math.random() * 6 }));
  const rd2 = new THREE.Object3D(); let rainK = 0;
  function stepRain(dt) {
    rainK += ((S.weather === 'storm' && S.phase === 'night' ? 1 : 0) - rainK) * Math.min(1, dt * 0.7);
    rain.visible = rainK > 0.02; if (!rain.visible) return;
    rain.material.opacity = 0.35 * rainK;
    const n = Math.floor(RAIN * rainK);
    for (let k = 0; k < n; k++) {
      const d = drops[k]; d.y -= d.v * dt; d.x -= d.v * dt * 0.18;
      if (d.y < 0) { d.y = 12 + Math.random() * 2; d.x = (Math.random() - 0.5) * 40; d.z = (Math.random() - 0.5) * 30; }
      rd2.position.set(camTarget.x + d.x, d.y, camTarget.z + d.z); rd2.rotation.set(0, 0, 0.18); rd2.updateMatrix(); rain.setMatrixAt(k, rd2.matrix);
    }
    rain.count = n; rain.instanceMatrix.needsUpdate = true;
  }
  let dark = 0, time = 0, lightT = 0, wxFog = 0, flash = 0, flashN = 0, nextFlash = 4; const fogCol = K.lin('#5d6670');

  // which warm lights matter: the keep fire, lanterns on towers, lit homes; the nearest win the pool
  function lightSources() {
    const out = [{ x: C, y: C + 0.6, h: 1.0, i: 2.4, d: 9 }, { x: C - 2.6, y: C - 2.2, h: 1.4, i: 1.6, d: 7 }, { x: C + 2.6, y: C + 2.2, h: 1.4, i: 1.6, d: 7 }];
    for (const b of S.buildings) {
      if (b.ruined) continue;
      if (b.type === 'tower' && b.level >= 2) out.push({ x: b.x, y: b.y, h: 2.2, i: 1.4, d: 7 });
      else if (b.type === 'house' && b.level >= 2) out.push({ x: b.x, y: b.y + 0.2, h: 1.0, i: 1.1, d: 5 });
    }
    return out;
  }
  function placeLights() {
    const src = lightSources().sort((a, b) => Math.hypot(a.x - C - camTarget.x, a.y - C - camTarget.z) - Math.hypot(b.x - C - camTarget.x, b.y - C - camTarget.z));
    pool.forEach((l, k) => { const s = src[k]; if (!s) { l.userData.i = 0; return; } l.position.copy(W(s.x, s.y, s.h)); l.userData.i = s.i; l.distance = s.d; });
  }

  function frame(dt, ui = {}) {
    time += dt;
    handleEvents(ui.events || []);
    syncKeep(); syncBuildings(); syncMobs(); syncProjectiles(); syncChests(); syncAllies(); syncPurses(); updateSites(dt, time); stepWalkers(dt); stepRain(dt);
    if (repaint) { repaint = false; city.paint(); }
    const night = S.phase === 'night' || S.phase === 'over';
    dark += ((night ? 1 : 0) - dark) * Math.min(1, dt * 1.4);

    // camera follows the hero
    zoomCur += (zoom - zoomCur) * Math.min(1, dt * 8);
    const narrow = camera.aspect < 1, vf = narrow ? 40 : 28;
    if (camera.fov !== vf) { camera.fov = vf; camera.updateProjectionMatrix(); }
    const vh = Math.tan(vf * Math.PI / 360), hh = vh * camera.aspect, R = (narrow ? 8.5 : 13) * zoomCur, dist = Math.max(R / hh, R / vh * 0.8);
    const wx = S.weather, fogK = (wx === 'fog' ? 1 : 0) * dark; wxFog += (fogK - wxFog) * Math.min(1, dt * 0.8);
    scene.fog.near = dist + 14 - wxFog * (dist + 8); scene.fog.far = dist + 95 - wxFog * 70;
    const h = S.hero;
    if (orbit > 0) {
      orbit += dt * 0.12; camTarget.lerp(W(C, C), Math.min(1, dt * 1.5));
      const od = dist * 1.1; camera.position.set(camTarget.x + Math.sin(orbit) * od * 0.6, camTarget.y + od * 0.7, camTarget.z + Math.cos(orbit) * od * 0.6);
    } else {
      if (!h.dead) camTarget.lerp(W(h.x, h.y), Math.min(1, dt * 4));
      camera.position.set(camTarget.x, camTarget.y + dist * 0.76, camTarget.z + dist * 0.65);
    }
    camera.lookAt(camTarget); camera.updateMatrixWorld();
    look.blend(dark, S.phase === 'night' && game.isBloodMoon(S.night), camTarget, Math.max(22, R * 1.7));
    // weather: fog thickens the night air; a storm throws lightning
    if (wxFog > 0.01) { scene.fog.color.lerp(fogCol, wxFog * 0.35); scene.background.copy(scene.fog.color); }
    if (S.weather === 'storm' && S.phase === 'night') { nextFlash -= dt; if (nextFlash <= 0) { flash = 1; flashN = 1; nextFlash = 3 + vis() * 8; if (opts.onFlash) opts.onFlash(); } }
    if (flash > 0.01) { look.hemi.intensity += flash * 1.4; look.sun.intensity += flash * 2.2; flash *= Math.exp(-dt * (flash > 0.5 ? 9 : 4)); if (flash < 0.33 && flashN > 0) { flashN--; flash = 0.8; } }

    // night: windows, lenses, the light pool, the hero's lantern, the searchlight
    for (const sp of lampGlow) sp.material.opacity = dark * 0.9;
    K.WIN.emissiveIntensity = dark * 2.4; K.LENS.emissiveIntensity = 0.2 + dark * 6;
    lightT -= dt; if (lightT <= 0) { placeLights(); lightT = 0.5; }
    for (const l of pool) l.intensity = (l.userData.i || 0) * dark;
    heroLight.intensity = dark * 2.0; heroLight.position.copy(W(h.x, h.y, 1.6));
    let searching = false;
    if (dark > 0.3) {
      const t3 = S.buildings.filter(b => b.type === 'tower' && b.level >= 3 && !b.ruined).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (t3) {
        let tgt = null, bd = 13; for (const m of S.mobs) { const d = Math.hypot(m.x - t3.x, m.y - t3.y); if (d < bd) { bd = d; tgt = m; } }
        const aim = tgt ? W(tgt.x, tgt.y) : W(t3.x + 6 * Math.sin(time * 0.4), t3.y + 6 * Math.cos(time * 0.4));
        const from = W(t3.x, t3.y, 2.6);
        spot.position.copy(from); spot.target.position.lerp(aim, Math.min(1, dt * 3)); spot.intensity = 6 * dark; searching = true;
        const dir = spot.target.position.clone().sub(from), len = dir.length();
        beam.position.copy(from); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()); beam.scale.set(len * 0.2, len, len * 0.2); beam.visible = true; beam.material.opacity = 0.07 * dark;
      }
    }
    if (!searching) { spot.intensity = 0; beam.visible = false; }

    villagers.update(dt, time, dark);
    for (const a of S.allies) {
      const e = aMeshes.get(a.id); if (!e) continue;
      e.g.position.copy(W(a.x, a.y)); e.g.rotation.y = a.face || 0;
      e.phase += dt * 8; e.pose(!a.attacking, e.phase, a.attacking ? (Math.sin(time * 10) * 0.5 + 0.5) : -1);
      setBar(e.bar, a.x, 1.25, a.y, a.hp / a.maxHp);
    }
    for (const g of puMeshes.values()) { g.rotation.y += dt * 2; g.position.y = 0.05 + Math.abs(Math.sin(time * 4)) * 0.1; }
    for (const m of S.mobs) {
      let f = flameFor.get(m.id);
      if (m.burn && !f) { f = flames.pop() || flameMesh(); fx.add(f); flameFor.set(m.id, f); }
      if (f) { if (!m.burn) { fx.remove(f); flames.push(f); flameFor.delete(m.id); } else { f.position.copy(W(m.x, m.y, 1.1 + Math.sin(time * 20) * 0.04)); f.scale.setScalar(0.7 + Math.sin(time * 17 + m.id) * 0.15); } }
    }
    for (const [id, f] of flameFor) if (!mobState.has(id)) { fx.remove(f); flames.push(f); flameFor.delete(id); }

    // hero
    heroRig.g.visible = !h.dead; heroRig.g.position.copy(W(h.x, h.y));
    let df = h.face - heroRig.g.rotation.y; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; heroRig.g.rotation.y += df * Math.min(1, dt * 14);
    heroRig.pose(h.moving, time * 10, h.swing > 0 ? 1 - h.swing / 0.25 : -1);
    heroRing.visible = !h.dead; heroRing.position.copy(W(h.x, h.y, 0.05));
    if (!h.dead) setBar(heroBar, h.x, 1.55, h.y, h.hp / h.maxHp); else heroBar.visible = false;

    // the dead
    crowd.begin();
    for (const m of S.mobs) {
      const e = mobState.get(m.id); if (!e) continue;
      e.x = m.x; e.y = m.y;
      let d = (m.face || 0) - e.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; e.face += d * Math.min(1, dt * 6);
      e.phase += dt * (m.speed || 1.5) * 3.2;
      const fr = m.attacking ? 0 : (Math.sin(e.phase) > 0 ? 0 : 1);
      const lunge = m.attacking ? Math.max(0, Math.sin(time * 6 + e.phase)) * 0.25 : 0;
      const p = W(m.x, m.y, (m.rise - 1) * 1.1 + (m.attacking ? 0 : Math.abs(Math.sin(e.phase)) * 0.03));
      crowd.add(m.kind, fr, p.x, p.y, p.z, e.face, lunge, Math.sin(e.phase * 0.5) * 0.06, 1);
      setBar(e.bar, m.x, 1.3 * Math.max(1, e.size), m.y, m.hp / m.maxHp);
    }
    for (const dd of [...dying]) {
      dd.t += dt; const p = W(dd.x, dd.y, -Math.max(0, dd.t - 0.4) * 1.2);
      crowd.add(dd.kind, 0, p.x, p.y, p.z, dd.face, -Math.min(1.45, dd.t * 4), 0, 1);
      if (dd.t > 1.2) dying.splice(dying.indexOf(dd), 1);
    }
    crowd.end();
    for (const f of [...effects]) { f.t += dt; if (!f.line) { const s = 0.5 + f.t * f.r * 2.2; f.m.scale.set(s, s, s); } f.m.material.opacity = Math.max(0, 0.9 - f.t * 1.4); if (f.t > 0.7) { fx.remove(f.m); effects.splice(effects.indexOf(f), 1); } }
    for (const g of cMeshes.values()) { g.rotation.y += dt; g.position.y = 0.08 + Math.abs(Math.sin(time * 3)) * 0.12; }

    // buildings
    for (const b of S.buildings) {
      const e = bMeshes.get(b.id); if (!e) continue;
      const sc = e.g.scale.y; if (sc < 1) e.g.scale.setScalar(Math.min(1, sc + dt * 3.2));
      if (!b.ruined) setBar(e.bar, b.x, b.type === 'tower' ? 2.9 + b.level * 0.25 : b.type === 'wall' ? 1.7 : 3.2, b.y, b.hp / b.maxHp); else e.bar.visible = false;
    }
    keepG.visible = !S.keep.ruined;
    setBar(keepBar, C, 4.6, C, S.keep.hp / S.keep.maxHp);

    // hives: live ones glow and breathe; sleeping ones next to your land stay dark; far ones stay hidden in the ruins
    const active = new Set(S.phase === 'night' ? game.activeNests() : game.activeNests(S.night));
    const nk = `${S.claimed.size}|${S.night}|${S.phase}`;
    if (nk !== nestKey) { nestKey = nk; nearNests = new Set(S.phase === 'day' ? [...hives.keys()].filter(r => game.canPurge(r)) : []); }
    for (const [r, hv] of hives) {
      const live = (active.has(r) || S.purge === r) && !hv.cleared;
      hv.g.visible = !hv.cleared || true;
      const want = hv.cleared ? 0 : live ? 1 : nearNests.has(r) ? 0.15 : 0;
      hv.glow += (want - hv.glow) * Math.min(1, dt * 2);
      const siege = S.purge === r, colr = siege ? lc('#e3a54a') : lc('#8fff3a');
      hv.decal.material.color.copy(colr); hv.decal.material.opacity = hv.glow * (0.35 + dark * 0.55);
      hv.haze.forEach((s, k) => { s.material.color.copy(colr); s.material.opacity = hv.glow * (0.12 + dark * 0.22) * (0.8 + 0.2 * Math.sin(time * 1.5 + k)); s.position.y = 0.6 + k * 0.45 + Math.sin(time * 0.7 + k) * 0.1; });
    }

    // routes: visible while you plan the day
    const sig = `${S.flowVersion}|${S.night}|${S.purge}|${S.claimed.size}|${S.phase}`;
    if (sig !== routeSig) { routeSig = sig; rebuildRoutes(); }
    if (routeMesh) { routeMesh.visible = S.phase === 'day'; routeMat.opacity = 0.85; if (routeMesh.visible) animateRoutes(time); }

    // selection
    const sel = ui.selected;
    selRing.visible = !!sel; rangeRing.visible = false;
    if (sel) {
      let x, y, s = 1;
      if (sel.type === 'building') { const b = S.byId.get(sel.id); if (b) { x = b.x; y = b.y; s = b.type === 'tower' ? 0.6 : b.type === 'wall' ? 0.55 : 1.0; } else { x = C; y = C; } }
      else if (sel.type === 'keep') { x = C; y = C; s = 1.9; }
      else if (sel.type === 'region') { const n = map.regions[sel.id].nest; x = n.x; y = n.y; s = 1.8; }
      else if (sel.type === 'site') { const st = S.scav.sites[sel.id]; x = st.x; y = st.y; s = 0.6; }
      selRing.position.copy(W(x, y, 0.1)); const k = s + Math.sin(time * 4) * 0.04; selRing.scale.set(k, k, k);
      if (sel.range) { rangeRing.visible = true; rangeRing.position.copy(W(x, y, 0.09)); rangeRing.scale.set(sel.range, sel.range, sel.range); }
    }
    if (moveMark.material.opacity > 0) { moveMark.material.opacity = Math.max(0, moveMark.material.opacity - dt * 1.5); moveMark.scale.multiplyScalar(1 + dt * 0.8); }
    setGhost(ui.ghost || null); setZone(ui.zone || null);
    look.render(time);
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
    for (const m of sites) if (m.g.visible && Math.hypot(m.st.x - p.x, m.st.y - p.y) < 1.1) return { type: 'site', id: m.st.id, ...p };
    const b = game.buildingAt(p.x, p.y);
    if (b && b.type === 'keep') return { type: 'keep', ...p };
    if (b) return { type: 'building', id: b.id, ...p };
    const cx2 = Math.floor(p.x), cy2 = Math.floor(p.y);
    if (cx2 >= 0 && cy2 >= 0 && cx2 < N && cy2 < N) { const r = map.region[idx(cx2, cy2)]; if (r >= 0 && !S.claimed.has(r)) return { type: 'region', id: r, ...p }; }
    return { type: 'ground', ...p };
  }
  function showMove(x, y) { moveMark.position.copy(W(x, y, 0.07)); moveMark.scale.set(1, 1, 1); moveMark.material.opacity = 0.9; }
  function project(x, y, h = 0.6) { const v = W(x, y, h).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 }; }

  return {
    frame, pick, project, showMove, resize, routes: () => routes, groundAt, startOrbit: () => { orbit = 0.001; },
    setZoom: z => { zoom = Math.max(0.45, Math.min(1.8, z)); }, getZoom: () => zoom,
    setQuality: q => { look.setQuality(q); resize(); }, quality: () => look.quality(),
  };
}
