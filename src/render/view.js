// three.js view of a game: the ruined city. It only reads game state and drains events.
/* global THREE */
import { N, T, idx, PASSABLE, LANDMARKS } from '../sim/mapgen.js';
import { mulberry32 } from '../sim/rng.js';
import { MOBS } from '../content/mobs.js';
import { mat, chestMesh, purseMesh, flameMesh } from './meshes.js';
import { createVillagers } from './villagers.js';
import { K, CFG } from './kit.js';
import { createLook } from './look.js';
import { buildCity } from './city.js';
import { createCrowd, bakedWalker, liveRig, vcMat, PEOPLE, xrayMat } from './figures.js';
import { KITS, RARITY } from '../content/districts.js';

const lc = hex => new THREE.Color(hex).convertSRGBToLinear();
const BSCALE = { house: 0.3, farm: 0.21, tower: 0.3, wall: 1 / 2.2, workshop: 1, market: 1, generator: 1 };
const FOOT = { house: 2, farm: 2, tower: 1, workshop: 3, market: 3, generator: 2 };   // cells each building covers   // world units per metre of each kit model
const HERO_RIG = { warrior: 'brawler', archer: 'ranger', merchant: 'scavver', steward: 'scavver', survivor: 'brawler', vanguard: 'brawler', warlord: 'brawler', deadeye: 'ranger', medic: 'scavver', warden: 'brawler', marshal: 'ranger', quartermaster: 'scavver' };
const UNIT = { hero: 1.7, companion: 1.45, ally: 1.3, dead: 1.25 };   // people read bigger than the buildings (Thronefall-style scale)
// your homes by level: 1 bare scrap (the kit's own drab woods and tin), 2 one coat of muted paint, 3 bright paint and a coloured roof
// (index i of each list goes together: wall, roof and, at level 3, the shutters and door)
const HOUSE_COLORS = { 2: ['#a39783', '#8e9886', '#8b95a0', '#ad9a7c'], 3: ['#f2d27a', '#ee9a7a', '#9fd6c9', '#f4ead2', '#f2d27a', '#f4ead2', '#ee9a7a', '#9fd6c9'] };
const ROOF_COLORS = { 2: ['#6e4a3e', '#4f585b', '#6b5a48', '#5d4a44'], 3: ['#c8553d', '#2f8f88', '#c8553d', '#3d6b9a', '#3d6b9a', '#2f8f88', '#3d6b9a', '#d9843a'] };
const ACCENTS = ['#2f8f88', '#3d6b9a', '#3d6b9a', '#c8553d', '#c8553d', '#d9843a', '#2f8f88', '#2f8f88'];
const HIVES = ['metro', 'petrol', 'hospital'];

export function createView(canvas, game, opts = {}) {
  const S = game.state, map = game.map, C = map.town.x;
  const seenAt = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return cx >= 0 && cy >= 0 && cx < N && cy < N && S.seen[idx(cx, cy)] === 1; };
  let elev = () => 0;   // ground height (plateaus), set once the city is built
  const W = (x, y, h = 0) => new THREE.Vector3(x - C, h + elev(x, y), y - C);
  const vis = mulberry32(map.seed * 7 + 3);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 300);
  const world = new THREE.Group(), fx = new THREE.Group(); scene.add(world, fx);
  const look = createLook({ renderer, scene, camera, canvas });

  // ---------- the city ----------
  CFG.lite = true;
  const city = buildCity({ game, map, S, world, W: (x, y, h = 0) => new THREE.Vector3(x - C, h, y - C), C, rand: vis }); elev = city.heightAt;

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
    g.scale.multiplyScalar(1.35);   // fewer hives, so each one is a landmark
    const pale = K.M('pale'), stone = K.M('stone');
    g.traverse(o => { if (o.isMesh && o.material === pale) o.material = stone; });
    return g;
  }
  const hives = new Map(); let nestKey = '', nearNests = new Set();
  for (const r of map.regions) if (r.nest) {
    const kind = HIVES[r.id % HIVES.length], g = new THREE.Group(); g.position.copy(W(r.nest.x, r.nest.y)); g.rotation.y = r.nest.back ? Math.atan2(-r.nest.back[0], -r.nest.back[1]) : Math.atan2(C - r.nest.x, C - r.nest.y);
    g.add(hiveModel(kind));
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: glowTex, color: lc('#8fff3a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    decal.rotation.x = -Math.PI / 2; decal.position.y = 0.05; decal.renderOrder = 3; g.add(decal);
    const haze = [];
    for (let k = 0; k < 5; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lc('#9dff4a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(1.6 + k * 0.4); sp.position.set(Math.cos(k * 2.1) * 0.8, 0.6 + k * 0.45, Math.sin(k * 2.1) * 0.8); g.add(sp); haze.push(sp); }
    world.add(g); hives.set(r.id, { g, decal, haze, glow: 0 });
  }

  // ---------- scavenge sites: a cache of supplies at a doorway into the ruins ----------
  const diaGeo = new THREE.OctahedronGeometry(0.3, 0); diaGeo.scale(1, 1.5, 1);
  const diaGeoL = new THREE.OctahedronGeometry(0.4, 0); diaGeoL.scale(1, 1.5, 1); const diaWhite = new THREE.MeshBasicMaterial({ color: lc('#f4efe2').multiplyScalar(1.5) });
  // marker colour by distance: pale = your land, amber = next door, red = deep in the city
  const diaMats = ['#e8dcb0', '#f0a24a', '#e8553a'].map(c => new THREE.MeshBasicMaterial({ color: lc(c).multiplyScalar(1.7) })), diaMat = diaMats[1];
  const sites = [].map(st => {   // scavenging retired (supply drops replace it)
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
        m.g.visible = show; m.dia.visible = show && !out; m.lamp.visible = out; if (show && !out) m.dia.material = diaMats[Math.min(2, i.hops)];
        if (show && !out) siteVis.add(m.st.id);
      }
    }
    for (const m of sites) if (m.g.visible) { m.dia.position.y = 1.9 + Math.sin(t * 2.2 + m.st.id) * 0.12; m.dia.rotation.y = t * 1.2; m.lamp.material.opacity = 0.6 + Math.sin(t * 7 + m.st.id) * 0.15; }
  }

  // ---------- landmarks: intact buildings to claim; the city's signature one rises above the shroud ----------
  const LMAT = {
    iron: new THREE.MeshStandardMaterial({ color: lc('#6b5a48'), roughness: 0.7, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: lc('#c9ccd0'), roughness: 0.35, metalness: 0.6 }),
    stone: new THREE.MeshStandardMaterial({ color: lc('#e3ddd0'), roughness: 0.85 }),
    red: new THREE.MeshStandardMaterial({ color: lc('#c4473a'), roughness: 0.6 }),
    concrete: new THREE.MeshStandardMaterial({ color: lc('#b9b4aa'), roughness: 0.9 }),
  };
  const part = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; if (o.ry) m.rotation.y = o.ry; m.castShadow = true; m.receiveShadow = true; return m; };
  function eiffel() {
    const g = new THREE.Group(), H = 13;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {   // four curved legs as three tapering segments
      let px = 2.1 * sx, pz = 2.1 * sz, py = 0;
      for (const [len, k, w] of [[3.4, 0.62, 0.42], [3.2, 0.42, 0.3], [5.2, 0.12, 0.2]]) {
        const nx = px * k, nz = pz * k, ny = py + len, mx = (px + nx) / 2, mz = (pz + nz) / 2, l = Math.hypot(nx - px, len, nz - pz);
        const leg = part(new THREE.BoxGeometry(w, l, w), LMAT.iron, mx, py + len / 2, mz);
        leg.lookAt(nx, ny, nz); leg.rotateX(Math.PI / 2); g.add(leg);
        px = nx; pz = nz; py = ny;
      }
    }
    g.add(part(new THREE.BoxGeometry(3.4, 0.25, 3.4), LMAT.iron, 0, 3.4, 0));
    g.add(part(new THREE.BoxGeometry(1.9, 0.2, 1.9), LMAT.iron, 0, 6.6, 0));
    g.add(part(new THREE.BoxGeometry(0.5, 0.5, 0.5), LMAT.iron, 0, 11.8, 0));
    g.add(part(new THREE.CylinderGeometry(0.03, 0.08, 1.6, 6), LMAT.iron, 0, 12.8, 0));
    for (const [sx] of [[1], [-1]]) g.add(part(new THREE.TorusGeometry(1.35, 0.09, 6, 16, Math.PI), LMAT.iron, 0, 0.05, 2.1 * sx, { ry: sx > 0 ? 0 : Math.PI }));
    return g;
  }
  function tvtower() {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(0.32, 0.55, 10, 16), LMAT.concrete, 0, 5, 0));
    g.add(part(new THREE.SphereGeometry(1.15, 24, 16), LMAT.steel, 0, 10.4, 0));
    g.add(part(new THREE.CylinderGeometry(0.5, 0.6, 0.35, 16), LMAT.concrete, 0, 9.1, 0));
    g.add(part(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 10), LMAT.concrete, 0, 12.6, 0));
    for (let k = 0; k < 4; k++) g.add(part(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 6), k % 2 ? LMAT.stone : LMAT.red, 0, 13.9 + k * 0.45, 0));
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.add(part(new THREE.BoxGeometry(1.8, 0.7, 0.35), LMAT.concrete, Math.cos(a) * 1.0, 0.35, Math.sin(a) * 1.0, { ry: -a })); }
    return g;
  }
  function christ() {
    const g = new THREE.Group();
    g.add(part(new THREE.BoxGeometry(1.4, 1.6, 1.4), LMAT.stone, 0, 0.8, 0));
    g.add(part(new THREE.CylinderGeometry(0.42, 0.62, 2.6, 12), LMAT.stone, 0, 2.9, 0));
    g.add(part(new THREE.BoxGeometry(3.6, 0.42, 0.38), LMAT.stone, 0, 3.95, 0));
    g.add(part(new THREE.CylinderGeometry(0.3, 0.42, 0.7, 10), LMAT.stone, 0, 4.35, 0));
    g.add(part(new THREE.SphereGeometry(0.27, 14, 10), LMAT.stone, 0, 4.85, 0));
    return g;
  }
  const fitTo = (m, size) => { const b = new THREE.Box3().setFromObject(m), w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1; m.scale.multiplyScalar(size * 0.92 / w); return m; };
  const flagGeo = new THREE.PlaneGeometry(0.7, 0.42), flagMat = new THREE.MeshBasicMaterial({ color: lc('#d9843a').multiplyScalar(1.3), side: THREE.DoubleSide });
  // district sites: what they look like depends on what the story made them
  function siteModel(kind, size, seed) {
    let m;
    CFG.hiveGlow = 0;
    if (kind === 'police') m = K.police({});
    else if (kind === 'clinic') m = K.hospital({});
    else if (kind === 'fuel') m = K.petrol({});
    else if (kind === 'flats') m = K.apartment({ w: 10, d: 9, floors: 8, color: 'bone', trim: 'stone', seed: seed + 5, shop: true });
    else if (kind === 'allotment') m = K.farm({ level: 3, seed });
    else if (kind === 'market') { m = new THREE.Group(); const a = K.apartment({ w: 12, d: 7, floors: 2, color: 'sand', trim: 'stone', seed: seed + 9, shop: true }); m.add(a); const sg = K.sign('HIGH STREET', 6, 0.9, { bg: '#2c3a40', fg: '#f0c050', size: 80 }); sg.position.set(0, 4.6, 3.6); m.add(sg); }
    else if (kind === 'school') { m = new THREE.Group(); const a = K.apartment({ w: 13, d: 8, floors: 3, color: 'sand', trim: 'pale', seed: seed + 3, shop: false }); m.add(a); const sg = K.sign('SCHOOL', 4.5, 1, { bg: '#e7e1d3', fg: '#9e5426', size: 84 }); sg.position.set(0, 7.2, 4.06); m.add(sg); }
    else if (kind === 'substation') {   // a fenced transformer yard and a control hut
      const b = new K.B();
      b.box('gravel', 12, 0.1, 10, 0, 0, 0, { r: 0.02 });
      for (const x of [-3.2, 0, 3.2]) { b.cbox('grey', 2.2, 2.4, 1.8, x, 0.1, -1.5, { r: 0.06 }); for (const z of [-2, -1, 0]) b.cyl('pale', 0.12, 0.16, 0.9, x - 0.6 + (z + 2) * 0.6, 2.5, -1.5, { seg: 8 }); }
      b.cbox('stone', 3.5, 2.6, 2.6, -3, 0.1, 3, { r: 0.05 }); b.cbox('dark', 0.9, 1.9, 0.08, -3, 0.1, 4.32, { r: 0.02 });
      for (let k = -5.5; k <= 5.5; k += 1.1) { b.box('metal', 0.05, 2, 0.05, k, 0.1, -4.8); b.box('metal', 0.05, 2, 0.05, k, 0.1, 4.8); }
      b.box('metal', 11.2, 0.05, 0.05, 0, 2, -4.8); b.box('metal', 11.2, 0.05, 0.05, 0, 2, 4.8);
      b.cbox('amber', 1.2, 0.8, 0.05, 2, 1.0, 4.85, { r: 0.01 });
      m = b.build();
    } else if (kind === 'radio') {
      const b = new K.B(), H = 22;
      b.cbox('stone', 7, 3.2, 5, 0, 0, 2, { r: 0.05 }); b.cbox('danger', 2.4, 0.5, 0.1, 0, 2.2, 4.55, { r: 0.02 });
      for (const [a, c2] of [[-0.8, -0.8], [0.8, -0.8], [0, 0.8]]) b.box('steel', 0.14, H, 0.14, a, 0, -3 + c2, { r: 0.02 });
      for (let y = 1.5; y < H; y += 2) b.cbox('steel', 1.7, 0.06, 0.06, 0, y, -3.4, { r: 0.01, ry: y % 4 > 2 ? 0.5 : -0.5 });
      b.cbox('danger', 0.4, 0.4, 0.4, 0, H, -3, { r: 0.05 });
      m = b.build();
    } else m = K.apartment({ w: 10, d: 10, floors: 4, color: 'grey', trim: 'stone', seed: seed + 1, ruin: 0.2, shop: false });
    CFG.hiveGlow = 1;
    return fitTo(m, size);
  }
  // special buildings read at a glance: a glowing frame round the lot in the colour of what it gives, and an icon
  const SITE_LOOK = { substation: ['#ffd84a', '⚡'], fuel: ['#ffd84a', '⛽'], allotment: ['#8fe36a', '❀'], flats: ['#ff8ac0', '⌂'], school: ['#ff8ac0', '✎'], police: ['#ff5a4a', '★'],
    market: ['#f0a040', '$'], clinic: ['#7fffd0', '✚'], radio: ['#7fd4ff', '◉'], eiffel: ['#f0b04a', '♛'], tvtower: ['#f0b04a', '♛'], christ: ['#f0b04a', '♛'], unknown: ['#8a8a8a', '?'] };
  const iconMats = {};
  const iconMat = kind => { const [col, ch] = SITE_LOOK[kind] || SITE_LOOK.unknown; return iconMats[kind] || (iconMats[kind] = new THREE.SpriteMaterial({ map: K.textTex(ch, { w: 96, h: 96, size: 62, bg: '#101418', fg: col }), transparent: true, depthTest: false })); };
  function siteFrame(size) {
    const g = new THREE.Group(), h = size / 2 + 0.55, th = 0.2, mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
    for (const [x, z, w, d] of [[0, -h, 2 * h + th, th], [0, h, 2 * h + th, th], [-h, 0, th, 2 * h], [h, 0, th, 2 * h]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat); m.position.set(x, 0.07, z); g.add(m); }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(2 * h, 2 * h), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.05; g.add(fill);
    g.userData = { mat, fill: fill.material }; return g;
  }
  const lmViews = S.landmarks.map(l => {
    const g = new THREE.Group(); g.position.copy(W(l.x, l.y)); g.rotation.y = Math.atan2(C - l.x, C - l.y);
    let m;
    if (l.kind === 'eiffel') m = eiffel(); else if (l.kind === 'tvtower') m = tvtower(); else if (l.kind === 'christ') m = christ();
    else m = siteModel(l.kind, l.size, l.id * 7);
    g.add(m);
    const pole = new THREE.Group(); pole.add(part(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), LMAT.iron, 0, 0.8, 0)); const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0.36, 1.35, 0); pole.add(flag);
    pole.position.set(l.size / 2 + 0.3, 0, 0); pole.visible = false; g.add(pole);
    const mark = new THREE.Mesh(diaGeoL, diaWhite); mark.position.y = l.kind === 'eiffel' || l.kind === 'tvtower' ? 2.5 : l.kind === 'christ' ? 6 : 3.2; g.add(mark);
    const frame = siteFrame(l.size); frame.rotation.y = -g.rotation.y; g.add(frame);
    const icon = new THREE.Sprite(iconMat(l.kind)); icon.scale.set(1.1, 1.1, 1); icon.position.y = mark.position.y + 1.1; icon.renderOrder = 9; g.add(icon);
    world.add(g); return { l, g, pole, flag, mark, m, kind: l.kind, frame, icon };
  });
  // ---------- supply drops: a crate under a canopy, red smoke you can see from afar, a ring while you open it ----------
  const dropViews = new Map();
  const smokeMat = () => new THREE.SpriteMaterial({ map: glowTex, color: lc('#e0603a'), transparent: true, opacity: 0.5, depthWrite: false, depthTest: false });
  function dropModel() {
    const g = new THREE.Group(), b = new K.B();
    b.cbox('amberDeep', 0.9, 0.6, 0.7, 0, 0, 0, { r: 0.04 }); b.cbox('canvas', 0.95, 0.08, 0.75, 0, 0.6, 0, { r: 0.02 });
    b.box('metal', 0.95, 0.06, 0.06, 0, 0.3, 0.36); b.box('metal', 0.95, 0.06, 0.06, 0, 0.3, -0.36);
    const crate = b.build(); crate.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(crate);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: lc('#d9c9a3'), roughness: 0.9, side: THREE.DoubleSide }));
    canopy.position.set(0.9, 0.05, 0.4); canopy.rotation.z = 1.35; canopy.scale.y = 0.4; g.add(canopy);
    const smoke = []; for (let k = 0; k < 7; k++) { const sp = new THREE.Sprite(smokeMat()); sp.position.set(0, 1 + k * 0.9, 0); sp.scale.setScalar(1 + k * 0.35); g.add(sp); smoke.push(sp); }
    const ring = new THREE.Mesh(ringGeo(1.55, 1.75), new THREE.MeshBasicMaterial({ color: lc('#f0c050').multiplyScalar(1.4), transparent: true, opacity: 0.9, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    return { g, smoke, ring };
  }
  // street encounters: a blue beacon you can see from far away
  const spotViews = new Map(), beamTex = glowTex;
  const bangMat = new THREE.SpriteMaterial({ map: K.textTex('!', { w: 64, h: 64, size: 54, bg: '#0e2230', fg: '#7fd4ff' }), transparent: true, depthTest: false });
  function syncSpots(t) {
    const list = (S.story && S.story.spots) || [], seenIds = new Set();
    for (const sp of list) {
      seenIds.add(sp.id); let v = spotViews.get(sp.id);
      if (!v) {
        const g = new THREE.Group(); g.position.copy(W(sp.x, sp.y));
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, 7, 12, 1, true), new THREE.MeshBasicMaterial({ color: lc('#7fd4ff').multiplyScalar(0.8), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        col.position.y = 3.5; g.add(col);
        const bang = new THREE.Sprite(bangMat); bang.scale.set(0.8, 0.8, 1); bang.renderOrder = 9; g.add(bang);
        const ring = new THREE.Mesh(ringGeo(0.9, 1.05), new THREE.MeshBasicMaterial({ color: lc('#7fd4ff').multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
        world.add(g); v = { g, bang, ring, col }; spotViews.set(sp.id, v);
      }
      v.g.visible = S.phase === 'day'; v.bang.position.y = 2.2 + Math.sin(t * 3 + sp.id) * 0.15; v.ring.scale.setScalar(1 + (t * 0.8 % 1) * 0.6); v.ring.material.opacity = 0.8 * (1 - (t * 0.8 % 1));
    }
    // the trial: a red beacon
    const tr = S.story && S.story.trial;
    if (tr && !tr.done) {
      seenIds.add('trial'); let v = spotViews.get('trial');
      if (!v) {
        const g = new THREE.Group(); g.position.copy(W(tr.x, tr.y));
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: lc('#ff5a3c').multiplyScalar(0.9), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        col.position.y = 5; g.add(col);
        const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex('⚔', { w: 64, h: 64, size: 46, bg: '#2a0e0a', fg: '#ff7a62' }), transparent: true, depthTest: false })); bang.scale.set(1, 1, 1); bang.renderOrder = 9; g.add(bang);
        const ring = new THREE.Mesh(ringGeo(1.6, 1.8), new THREE.MeshBasicMaterial({ color: lc('#ff5a3c').multiplyScalar(1.5), transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
        world.add(g); v = { g, bang, ring, col }; spotViews.set('trial', v);
      }
      v.bang.position.y = 2.6 + Math.sin(t * 3) * 0.15; v.ring.scale.setScalar(1 + (t * 0.6 % 1) * 0.4); v.ring.material.opacity = 0.8 * (1 - (t * 0.6 % 1));
    }
    for (const [id, v] of spotViews) if (!seenIds.has(id)) { world.remove(v.g); spotViews.delete(id); }
  }
  function syncDrops(t) {
    const seen = new Set();
    for (const d of S.drops) {
      seen.add(d.id); let v = dropViews.get(d.id);
      if (!v) { v = dropModel(); v.g.position.copy(W(d.x, d.y)); world.add(v.g); dropViews.set(d.id, v); }
      v.smoke.forEach((sp, k) => { const ph = (t * 0.35 + k / v.smoke.length) % 1; sp.position.y = 1 + ph * 6.5; sp.material.opacity = 0.55 * (1 - ph); sp.scale.setScalar(0.8 + ph * 2.6); sp.position.x = Math.sin(ph * 3 + k) * 0.4; });
      const p = d.prog / 3; v.ring.visible = p > 0.01; v.ring.scale.setScalar(0.3 + p * 0.7);
    }
    for (const [id, v] of dropViews) if (!seen.has(id)) { world.remove(v.g); dropViews.delete(id); burst(v.g.position.x + C, v.g.position.z + C, 1.5, '#f0c050'); }
  }
  const questMat = new THREE.MeshBasicMaterial({ color: lc('#7fd4ff').multiplyScalar(1.8) });
  function updateLandmarks(t) {
    for (const v of lmViews) {
      if (v.kind !== v.l.kind) { v.g.remove(v.m); v.m = siteModel(v.l.kind, v.l.size, v.l.id * 7); v.g.add(v.m); v.kind = v.l.kind; v.icon.material = iconMat(v.l.kind); }
      { const open = !S.sealed[v.l.region] && !v.l.stripped && v.l.kind !== 'unknown', col = v.l.owned ? '#d9843a' : (SITE_LOOK[v.l.kind] || SITE_LOOK.unknown)[0], U = v.frame.userData;
        v.frame.visible = open; v.icon.visible = open && !v.l.owned;
        if (open) { U.mat.color.copy(lc(col)).multiplyScalar(v.l.owned ? 1.2 : 1.6 + 0.4 * Math.sin(t * 3 + v.l.id)); U.fill.color.copy(lc(col)); U.fill.opacity = v.l.owned ? 0.06 : 0.12; } }
      const quest = S.story && S.story.quests.some(q => q.site === v.l.id);
      v.g.visible = LANDMARKS[v.l.kind].signature || seenAt(v.l.x, v.l.y); v.pole.visible = v.l.owned;
      v.mark.visible = !v.l.owned && !v.l.stripped && v.l.kind !== 'unknown' && S.phase === 'day' && !S.sealed[v.l.region];
      v.mark.material = quest ? questMat : diaWhite; v.mark.scale.setScalar(quest ? 1.4 + Math.sin(t * 4) * 0.12 : 1);
      if (v.mark.visible) { v.mark.rotation.y = t; } if (v.l.owned) v.flag.rotation.y = Math.sin(t * 2 + v.l.id) * 0.3;
      if (v.l.stripped && !v.gutted) { v.gutted = true; v.m.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.45); } }); }
    }
  }
  // ---------- quarantine fences: where a district you hold meets a sealed one, the streets are fenced off ----------
  let fenceMesh = null, fenceV = -1;
  // a chain-link panel with a red-and-white barrier in front: reads as QUARANTINE from any zoom
  const fenceGeo = (() => { const b = new K.B(); b.box('metal', 0.06, 1.5, 0.06, -0.5, 0, -0.15); b.box('metal', 0.06, 1.5, 0.06, 0.5, 0, -0.15); b.box('steel', 1.0, 1.25, 0.02, 0, 0.2, -0.15); b.cbox('pale', 1.0, 0.5, 0.16, 0, 0.1, 0.12, { r: 0.04 }); b.cbox('danger', 0.3, 0.51, 0.17, -0.3, 0.1, 0.12, { r: 0.01 }); b.cbox('danger', 0.3, 0.51, 0.17, 0.3, 0.1, 0.12, { r: 0.01 }); return b.build(); })();
  // scouted districts: a banner over each sealed district whose identity is known, in its rarity colour
  const banners = new Map(); let bannerKey = '';
  function syncBanners() {
    const key = `${S.sealVersion}|${Object.keys(S.kits).length}`; if (key === bannerKey) return; bannerKey = key;
    for (const [r, sp] of banners) if (!S.sealed[r] || !S.kits[r]) { fx.remove(sp); banners.delete(r); }
    for (const [rs, kit] of Object.entries(S.kits)) {
      const r = +rs; if (!S.sealed[r] || banners.has(r)) continue;
      const l = S.landmarks.find(q => q.region === r), name = kit === 'signature' && l ? LANDMARKS[l.kind].name : (KITS[kit] || {}).name || kit;
      const rar = kit === 'signature' ? RARITY.legendary : RARITY[(KITS[kit] || {}).rarity || 'common'];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(`${rar.name.toUpperCase()} · ${name.toUpperCase()}`, { w: 512, h: 64, size: 30, bg: '#0d1418', fg: rar.color, spacing: '2px' }), transparent: true, opacity: 0.92, depthTest: false }));
      const reg = map.regions[r]; sp.position.copy(W(reg.x, reg.y, 4)); sp.scale.set(5.6, 0.7, 1); sp.renderOrder = 8; fx.add(sp); banners.set(r, sp);
    }
  }
  function syncFences() {
    syncBanners();
    if (S.sealVersion === fenceV) return; fenceV = S.sealVersion;
    if (fenceMesh) { world.remove(fenceMesh); fenceMesh = null; }
    const spots = [];
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = idx(x, y), r = map.region[i]; if (r < 0 || S.sealed[r] || !PASSABLE[map.terrain[i]]) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const j = idx(x + dx, y + dy), r2 = map.region[j]; if (r2 >= 0 && S.sealed[r2] && PASSABLE[map.terrain[j]]) spots.push([x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5, dx ? Math.PI / 2 : 0]); }   // every edge: the panels join corner to corner
    }
    if (!spots.length) return;
    fenceMesh = new THREE.Group();
    const meshes = []; fenceGeo.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const src of meshes) {
      const im = new THREE.InstancedMesh(src.geometry, src.material, spots.length); im.castShadow = false; im.frustumCulled = false;   // spread over the map (and no shadow: far fences streak across the shadow map): never cull by the base shape
      spots.forEach(([x, y, ry], k) => { rd.position.copy(W(x, y)); rd.rotation.set(0, ry, 0); rd.scale.setScalar(1); rd.updateMatrix(); im.setMatrixAt(k, rd.matrix); });
      fenceMesh.add(im);
    }
    world.add(fenceMesh);
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
  const bountyRing = new THREE.Mesh(ringGeo(0.97, 1), new THREE.MeshBasicMaterial({ color: lc('#f0c050').multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false }));
  bountyRing.rotation.x = -Math.PI / 2; bountyRing.renderOrder = 4; fx.add(bountyRing);

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
    routeMesh = new THREE.InstancedMesh(chevGeo, routeMat, Math.max(1, count)); routeMesh.renderOrder = 5; routeMesh.frustumCulled = false; fx.add(routeMesh);
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
  // models are built once per (type, level, look) and cloned: clones share geometry and materials
  const modelCache = new Map();
  function model(type, level, b) {
    const id = b ? b.id : 0, pal = HOUSE_COLORS[level], v = type === 'house' && pal ? id % pal.length : type === 'farm' ? id % 2 : type === 'wall' ? id % 3 : 0;
    const links = type === 'wall' ? (b && b.links) || { e: true, w: true } : null;
    const key = `${type}|${level}|${v}|${links ? links.key || [links.e, links.w, links.s, links.n].map(Number).join('') : ''}`;
    const hit = modelCache.get(key); if (hit) return hit.clone();
    const m = buildModel(type, level, v, links);
    modelCache.set(key, m); return m.clone();
  }
  function buildModel(type, level, v, links) {
    let m;
    if (type === 'house') m = K.townhouse({ level, seed: v * 13 + 5, color: HOUSE_COLORS[level] && HOUSE_COLORS[level][v], roof: ROOF_COLORS[level] && ROOF_COLORS[level][v], accent: level === 3 ? ACCENTS[v] : undefined, game: true });
    else if (type === 'farm') m = K.farm({ level, seed: v + 1, own: true, game: true, color: ['#8e9a88', '#8b95a0'][v], roof: ['#2f8f88', '#3d6b9a'][v] });
    else if (type === 'tower') m = K.tower({ level, game: true });
    else if (type === 'wall') m = K.post(level, links, v);
    else if (type === 'workshop') {   // a corrugated shed with a sawtooth roof, a roller door and a chimney
      const B = new K.B();
      B.cbox('grey', 2.5, 1.1, 2.1, 0, 0, 0, { r: 0.04 });
      for (let k = 0; k < 3; k++) B.cbox('metal', 0.85, 0.45, 2.15, -0.83 + k * 0.83, 1.1, 0, { r: 0.02, rz: 0.35 });
      B.cbox('amberDeep', 1.0, 0.8, 0.06, 0.4, 0, 1.06, { r: 0.02 }); B.cbox('dark', 0.5, 0.5, 0.06, -0.7, 0.35, 1.06, { r: 0.02 });
      B.cyl('dark', 0.12, 0.14, 1.2, -0.9, 1.1, -0.6, { seg: 10 }); B.cbox('steel', 0.6, 0.3, 0.4, 1.4, 0, 0.7, { r: 0.03 });
      m = B.build();
    } else if (type === 'market') {   // three stalls under striped awnings around a plaza of crates
      const B = new K.B();
      B.cbox('stone', 2.6, 0.08, 2.6, 0, 0, 0, { r: 0.02 });
      for (let k = 0; k < 3; k++) { const a = k * 2.1, x = Math.cos(a) * 0.75, z = Math.sin(a) * 0.75;
        B.cbox('canvas', 0.9, 0.5, 0.6, x, 0.08, z, { r: 0.03, ry: -a }); B.cbox(k % 2 ? 'amber' : 'canvas', 1.05, 0.06, 0.8, x, 0.95, z, { r: 0.01, ry: -a, rx: 0.15 });
        for (const s2 of [-0.45, 0.45]) B.box('metal', 0.04, 0.9, 0.04, x + Math.cos(-a) * s2, 0.08, z + Math.sin(-a) * s2); }
      B.cbox('amberDeep', 0.35, 0.3, 0.35, 0.2, 0.08, 0.2, { r: 0.03 }); B.cbox('canvas', 0.3, 0.25, 0.3, -0.25, 0.08, -0.1, { r: 0.03, ry: 0.5 });
      m = B.build();
    } else if (type === 'generator') {   // a diesel genset on skids: a red housing, fuel tank, exhaust stacks, cables
      const B = new K.B(), L2 = level >= 2;
      B.cbox('dark', 1.7, 0.12, 1.1, 0, 0, 0, { r: 0.02 });
      B.cbox('danger', 1.4, 0.75, 0.85, 0, 0.12, 0, { r: 0.05 }); B.cbox('amber', 1.42, 0.08, 0.87, 0, 0.62, 0, { r: 0.01 });
      for (let k = 0; k < 5; k++) B.box('dark', 0.05, 0.4, 0.02, -0.5 + k * 0.18, 0.25, 0.44);
      B.cyl('steel', 0.24, 0.24, 1.3, 0, 0.32, -0.75, { rz: Math.PI / 2, seg: 12 });
      B.cyl('dark', 0.06, 0.07, 0.6, 0.45, 0.87, -0.2, { seg: 8 }); if (L2) { B.cyl('dark', 0.06, 0.07, 0.75, 0.25, 0.87, -0.2, { seg: 8 }); B.cbox('danger', 1.0, 0.6, 0.7, -0.15, 0.12, 0.85, { r: 0.05 }); }
      B.cbox('lit', 0.12, 0.08, 0.04, -0.55, 0.5, 0.44, { r: 0.01 });
      m = B.build();
    }
    m.scale.setScalar(BSCALE[type]);
    return m;
  }
  // homes face the keep, square to the street grid
  function faceKeep(x, y) { const dx = C - x, dy = C - y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dy > 0 ? 0 : Math.PI); }

  let keepLevel = 0, keepG = null; const lampGlow = [];
  function syncKeep() {
    if (keepLevel === S.keep.level && keepG) return;
    if (keepG) world.remove(keepG); lampGlow.length = 0;
    keepLevel = S.keep.level; keepG = K.keep({ level: keepLevel, game: true }); keepG.scale.setScalar(0.27); keepG.position.copy(W(C, C)); keepG.rotation.y = Math.PI; world.add(keepG);
    for (const [x, z, ry] of [[-11.5, 9.5, Math.PI / 2], [11.5, 9.5, Math.PI / 2], [-11.5, -9.5, -Math.PI / 2], [11.5, -9.5, -Math.PI / 2]]) { const l = K.lamp({}); l.position.set(x, 0, z); l.rotation.y = ry; l.traverse(o => { if (o.isMesh && o.material.emissive === undefined) return; }); keepG.add(l); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lc('#ffd9a0'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x + (ry > 0 ? 0 : 0), 5.8, z + (ry > 0 ? -1.3 : 1.3)); sp.scale.setScalar(3.5); keepG.add(sp); lampGlow.push(sp); }
  }
  syncKeep();
  const keepBar = makeBar('b', 2.2);
  const bMeshes = new Map(), mobState = new Map(), pMeshes = new Map(), cMeshes = new Map();
  const dying = [], effects = [];
  const crowd = createCrowd(world); crowd.warm(['walker', 'runner']);

  // x-ray: where a building hides the hero (or a companion), a soft silhouette shows through it (never over the figure itself)
  const xrayMats = {};
  function xray(g, col) {
    const mat = xrayMats[col] || (xrayMats[col] = xrayMat(lc(col)));
    const list = []; g.traverse(o => { if (o.isMesh && !o.userData.xray) list.push(o); });
    for (const o of list) { const x = new THREE.Mesh(o.geometry, mat); x.userData.xray = true; x.renderOrder = 30; x.castShadow = false; o.add(x); }
    return g;
  }
  let heroRig = liveRig(K.heroes[HERO_RIG[S.heroClass] || 'brawler']()), rigClass = S.heroClass; xray(heroRig.g, '#7fd4ff'); world.add(heroRig.g);
  function syncRig() { if (rigClass === S.heroClass) return; const want = HERO_RIG[S.heroClass] || 'brawler'; if (want !== HERO_RIG[rigClass]) { world.remove(heroRig.g); heroRig = liveRig(K.heroes[want]()); xray(heroRig.g, '#7fd4ff'); world.add(heroRig.g); } rigClass = S.heroClass; burst(S.hero.x, S.hero.y, 2.2, '#7fd4ff'); }
  const heroBar = makeBar('h', 1.0);
  const arrowGeo = new THREE.BoxGeometry(0.04, 0.04, 0.6), spitGeo = new THREE.IcosahedronGeometry(0.13, 0);
  const arrowMat = new THREE.MeshBasicMaterial({ color: lc('#f0e2c4').multiplyScalar(1.5) }), spitMat = new THREE.MeshBasicMaterial({ color: lc('#b4ff4e').multiplyScalar(2) });

  function rubbleModel(seed) { const b = new K.B(), r = K.rng(seed); K.rubble(b, 0, 0, 2.2, 22, r, 'sand'); const g = b.build(); g.scale.setScalar(0.3); return g; }
  function wallLinks(b) {
    const x = Math.floor(b.x), y = Math.floor(b.y);
    const l = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) return false; const o = S.byId.get(S.occ[idx(xx, yy)]); return !!(o && (o.type === 'wall' || o.type === 'tower') && !o.ruined); });
    return { e: l[0], w: l[1], s: l[2], n: l[3], key: l.map(v => (v ? 1 : 0)).join('') };
  }
  const noCrewMat = new THREE.SpriteMaterial({ map: K.textTex('NO CREW', { w: 256, h: 64, size: 40, bg: '#2a1512', fg: '#f0a090', spacing: '2px' }), transparent: true, depthTest: false });
  // your buildings stand on a concrete pad with amber corner marks: nothing else in the city has them
  const padGeo = {}, padMat = new THREE.MeshStandardMaterial({ color: lc('#9c968a'), roughness: 0.95 }), markMat = new THREE.MeshBasicMaterial({ color: lc('#e08a3c').multiplyScalar(1.25) });
  function padFor(n) {
    if (!padGeo[n]) {
      const s2 = n - 0.12, parts = [];
      const slab = new THREE.BoxGeometry(s2, 0.06, s2); slab.translate(0, 0.03, 0); parts.push(slab);
      padGeo[n] = { slab, marks: [] };
      const L = Math.min(0.5, n * 0.22), t = 0.07;
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (const along of ['x', 'z']) {
        const gm = new THREE.BoxGeometry(along === 'x' ? L : t, 0.02, along === 'x' ? t : L);
        gm.translate(sx * (s2 / 2 - (along === 'x' ? L / 2 : t / 2)), 0.07, sz * (s2 / 2 - (along === 'x' ? t / 2 : L / 2))); padGeo[n].marks.push(gm);
      }
      padGeo[n].mark = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(padGeo[n].marks) : null;
    }
    const g = new THREE.Group(), sl = new THREE.Mesh(padGeo[n].slab, padMat); sl.receiveShadow = true; g.add(sl);
    if (padGeo[n].mark) g.add(new THREE.Mesh(padGeo[n].mark, markMat)); else for (const gm of padGeo[n].marks) g.add(new THREE.Mesh(gm, markMat));
    return g;
  }
  // what you built should feel cared for: bunting in bright colours, planters, a warm lamp, a little flag
  const CHEER = ['#f0a040', '#3fb8a8', '#f4ead2', '#e8667a', '#ffd166'], cheerGeo = {};
  // Level 1 is survival: nothing. Level 2 gets a warm lamp and a pot of greens; level 3 the full set:
  // pennants strung round the lot, planters full of flowers, the lamp. (The models carry their own flags and lights.)
  function cheer(type, n, id, level) {
    const lv = type === 'workshop' || type === 'market' ? 2 : level;
    if (lv < 2) return null;
    const h = n / 2 + 0.38, key = `${type}${n}L${lv}`;
    if (!cheerGeo[key]) {
      const b = new K.B(), r = K.rng(n * 31 + type.length);
      const posts = [[-h, -h], [h, -h], [h, h], [-h, h]];
      if (lv >= 3 && type !== 'tower') {
        // corner posts with strings of pennants on all four sides
        for (const [x, z] of posts) { b.box('#5a4630', 0.06, 1.2, 0.06, x, 0, z); b.sph(CHEER[0], 0.05, x, 1.22, z, { detail: 0 }); }
        for (const [z, ax] of [[-h, 'x'], [h, 'x'], [-h, 'z'], [h, 'z']]) for (let k = 1; k < 8; k++) { const t = k / 8, u = -h + 2 * h * t, sag = Math.sin(t * Math.PI) * 0.16; if (ax === 'x') b.cbox(CHEER[k % CHEER.length], 0.24, 0.24, 0.02, u, 1.02 - sag, z, { r: 0.002, rz: Math.PI / 4 }); else b.cbox(CHEER[(k + 2) % CHEER.length], 0.02, 0.24, 0.24, z, 1.02 - sag, u, { r: 0.002, rx: Math.PI / 4 }); }
        for (const [z, ax] of [[-h, 'x'], [h, 'x'], [-h, 'z'], [h, 'z']]) for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8, y0 = 1.14 - Math.sin(t0 * Math.PI) * 0.16, y1 = 1.14 - Math.sin(t1 * Math.PI) * 0.16, u = -h + 2 * h * (t0 + t1) / 2, L = 2 * h / 8, rz = Math.atan2(y1 - y0, L); if (ax === 'x') b.cbox('#3b3631', L + 0.01, 0.012, 0.012, u, (y0 + y1) / 2, z, { r: 0.001, rz }); else b.cbox('#3b3631', 0.012, 0.012, L + 0.01, z, (y0 + y1) / 2, u, { r: 0.001, rx: -rz }); }
        // planters with flowers on two corners
        for (const [x, z] of posts.slice(2)) { b.cbox('#8a5a3a', 0.34, 0.16, 0.34, x, 0.08, z, { r: 0.03 }); b.sph('#5c8a3c', 0.15, x, 0.2, z, { detail: 0 }); for (let k = 0; k < 4; k++) b.sph(CHEER[(k + Math.floor(r() * 4)) % CHEER.length], 0.05, x + (r() - 0.5) * 0.22, 0.32, z + (r() - 0.5) * 0.22, { detail: 0 }); }
      } else if (type !== 'tower') {
        // a single pot of greens by the lamp: someone is looking after the place
        const [x, z] = posts[3]; b.cbox('#6e5a48', 0.3, 0.14, 0.3, x, 0.07, z, { r: 0.03 }); b.sph('#56663f', 0.14, x, 0.2, z, { detail: 0 });
      }
      // the lamp: lights up at dusk with the windows
      b.cyl('#3a3a3a', 0.02, 0.025, 0.9, h, 0, h, { seg: 5 });
      cheerGeo[key] = b.build({ vc: true });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), K.WIN); bulb.position.set(h, 0.95, h); cheerGeo[key].add(bulb);
    }
    return cheerGeo[key].clone();
  }
  // building something is a small celebration: confetti and a "+1" that floats up
  const confetti = [], confMats = CHEER.map(c => new THREE.MeshBasicMaterial({ color: lc(c).multiplyScalar(1.2), side: THREE.DoubleSide })), confGeo = new THREE.PlaneGeometry(0.12, 0.07);
  function celebrate(x, y, label) {
    for (let k = 0; k < 26; k++) { const m = new THREE.Mesh(confGeo, confMats[k % confMats.length]); m.position.copy(W(x, y, 0.6)); fx.add(m); const a = vis() * Math.PI * 2, s = 1.2 + vis() * 2.2; confetti.push({ m, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 3.2 + vis() * 2.5, spin: vis() * 12, t: 0 }); }
    if (label) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(label, { w: 256, h: 64, size: 40, bg: 'rgba(0,0,0,0)', fg: '#ffd166' }), transparent: true, depthTest: false })); sp.scale.set(1.6, 0.4, 1); sp.position.copy(W(x, y, 2.2)); sp.renderOrder = 12; fx.add(sp); confetti.push({ m: sp, label: true, t: 0 }); }
  }
  function floatLabel(x, y, text, col) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(text, { w: 256, h: 64, size: 36, bg: 'rgba(0,0,0,0)', fg: col }), transparent: true, depthTest: false })); sp.scale.set(1.2, 0.3, 1); sp.position.copy(W(x, y, 1.2)); sp.renderOrder = 12; fx.add(sp); confetti.push({ m: sp, label: true, t: 0.4 }); }
  function stepConfetti(dt) {
    for (const c of [...confetti]) {
      c.t += dt;
      if (c.label) { c.m.position.y += dt * 0.9; c.m.material.opacity = Math.max(0, 1 - Math.max(0, c.t - 0.8) / 0.8); }
      else { c.vy -= 9 * dt; c.m.position.x += c.vx * dt; c.m.position.y = Math.max(0.03, c.m.position.y + c.vy * dt); c.m.position.z += c.vz * dt; c.m.rotation.x += c.spin * dt; c.m.rotation.y += c.spin * 0.7 * dt; c.vx *= 0.97; c.vz *= 0.97; }
      if (c.t > (c.label ? 1.6 : 1.4)) { fx.remove(c.m); confetti.splice(confetti.indexOf(c), 1); }
    }
  }
  const NICE = { house: '+1 Home', farm: '+1 Farm', tower: '+1 Tower', generator: '+1 Generator', workshop: 'Workshop', market: 'Market' };
  const noPowerMat = new THREE.SpriteMaterial({ map: K.textTex('NO POWER', { w: 256, h: 64, size: 40, bg: '#3a0d08', fg: '#ff6a50', spacing: '2px' }), transparent: true, depthTest: false });
  function syncBuildings() {
    const seen = new Set();
    for (const b of S.buildings) {
      seen.add(b.id);
      let e = bMeshes.get(b.id);
      const links = b.type === 'wall' ? wallLinks(b) : null, lk = links ? links.key : '';
      if (!e || e.level !== b.level || e.lk !== lk) {
        const relink = e && e.level === b.level;
        if (e) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); if (e.nc) fx.remove(e.nc); }
        const g = new THREE.Group(), m = model(b.type, b.level, { id: b.id, links }); g.add(m);
        if (FOOT[b.type]) { g.add(padFor(FOOT[b.type])); if (b.type !== 'wall') { const c = cheer(b.type, FOOT[b.type], b.id, b.level); if (c) g.add(c); } }
        g.position.copy(W(b.x, b.y)); if (b.type === 'house' || b.type === 'farm') g.rotation.y = faceKeep(b.x, b.y);
        g.scale.set(1, relink ? 1 : 0.02, 1); world.add(g);
        e = { g, bar: makeBar('b', b.type === 'wall' ? 0.6 : 1.1), level: b.level, lk, rubble: null, type: b.type, rise: relink ? 1 : 0 }; bMeshes.set(b.id, e);
        if (!relink && b.type !== 'wall') { dust(b.x, b.y, FOOT[b.type] || 1); if (time > 1) celebrate(b.x, b.y, e.level > 1 ? `Level ${b.level}!` : NICE[b.type]); }
        if (b.ruined) e.g.visible = false;
      }
      if (b.built < 1) { e.g.scale.set(1, 0.15 + 0.85 * b.built, 1); e.building = true; } else if (e.building) { e.building = false; e.g.scale.setScalar(1); burst(b.x, b.y, 1.2, '#d9843a'); }
      if (b.type === 'tower') {
        if (!e.nc) { e.nc = new THREE.Sprite(noCrewMat); e.nc.scale.set(1.0, 0.25, 1); e.nc.renderOrder = 9; fx.add(e.nc); }
        const unpowered = !b.ruined && !game.powered(b), uncrewed = !b.ruined && !game.manned(b);
        e.nc.material = unpowered ? noPowerMat : noCrewMat;
        e.nc.visible = unpowered ? Math.sin(time * 8) > -0.3 : uncrewed; if (e.nc.visible) e.nc.position.copy(W(b.x, b.y, 2.1 + Math.sin(time * 3) * 0.05));
      }
      if (b.ruined && !e.rubble) { e.g.visible = false; e.rubble = rubbleModel(b.id); e.rubble.position.copy(W(b.x, b.y)); e.rubble.scale.multiplyScalar(b.type === 'wall' ? 0.4 : 0.8); world.add(e.rubble); }
      if (!b.ruined && e.rubble) { world.remove(e.rubble); e.rubble = null; e.g.visible = true; e.g.scale.setScalar(0.4); }
    }
    for (const [id, e] of bMeshes) if (!seen.has(id)) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); if (e.nc) fx.remove(e.nc); bMeshes.delete(id); }
  }
  function syncMobs() {
    const seen = new Set();
    for (const m of S.mobs) {
      seen.add(m.id);
      if (!mobState.has(m.id)) {
        const size = MOBS[m.kind].size * (m.unique ? 1.35 : 1);
        const st = { bar: makeBar(m.kind === 'gravelord' || m.kind === 'guardian' ? 'boss' : 'z', 0.7 * size), phase: vis() * 6, face: m.face || 0, size, kind: m.kind, x: m.x, y: m.y };
        if (m.unique) { st.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(m.unique.toUpperCase(), { w: 512, h: 64, size: 34, bg: '#2a0a10', fg: '#ff8a6a', spacing: '3px' }), transparent: true, depthTest: false })); st.tag.scale.set(3.2, 0.4, 1); st.tag.renderOrder = 22; fx.add(st.tag); st.glow = K.glowSprite('#ffd27a', 2.6, 1.6); fx.add(st.glow); }
        mobState.set(m.id, st);
      }
      const st = mobState.get(m.id); if (st.tag) { st.tag.position.copy(W(m.x, m.y, 3.4)); st.glow.position.copy(W(m.x, m.y, 2.4)); st.glow.material.opacity = 0.6 + Math.sin(time * 6) * 0.3; }
    }
    for (const [id, e] of mobState) if (!seen.has(id)) { fx.remove(e.bar); if (e.tag) { fx.remove(e.tag); fx.remove(e.glow); } dying.push({ kind: e.kind, x: e.x, y: e.y, face: e.face, t: 0 }); mobState.delete(id); }
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
  // construction dust: a few grey puffs rolling out from the footprint
  const puffs = [], puffMat = () => new THREE.SpriteMaterial({ map: glowTex, color: lc('#b9b1a2'), transparent: true, opacity: 0.55, depthWrite: false });
  function dust(x, y, n) {
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + vis(), sp = new THREE.Sprite(puffMat()); sp.position.copy(W(x + Math.cos(a) * n * 0.45, y + Math.sin(a) * n * 0.45, 0.3)); sp.scale.setScalar(0.6 + n * 0.3); fx.add(sp); puffs.push({ sp, vx: Math.cos(a) * (0.8 + n * 0.3), vz: Math.sin(a) * (0.8 + n * 0.3), t: 0 }); }
    burst(x, y, 0.6 + n * 0.5, '#e08a3c');
  }
  function stepPuffs(dt) { for (const p of [...puffs]) { p.t += dt; p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt; p.sp.position.y += dt * 0.6; p.sp.scale.multiplyScalar(1 + dt * 0.9); p.sp.material.opacity = Math.max(0, 0.55 * (1 - p.t / 0.9)); if (p.t > 0.9) { fx.remove(p.sp); p.sp.material.dispose(); puffs.splice(puffs.indexOf(p), 1); } } }
  function burst(x, y, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 32), new THREE.MeshBasicMaterial({ color: lc(color).multiplyScalar(1.4), transparent: true, opacity: 0.9, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(W(x, y, 0.12)); fx.add(m); effects.push({ m, t: 0, r });
  }

  // ---------- sellswords, purses ----------
  const aMeshes = new Map(), puMeshes = new Map();
  const mercRig = () => K.heroes.sellsword();
  function syncAllies() {
    const seen = new Set();
    for (const a of S.allies) {
      seen.add(a.id);
      if (!aMeshes.has(a.id)) {
        const r = liveRig(mercRig()); if (a.comp) xray(r.g, '#f0b060'); world.add(r.g); const e = { ...r, bar: makeBar('h', 0.6), phase: vis() * 6 };
        if (a.comp) { e.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.textTex(a.name.toUpperCase(), { w: 256, h: 64, size: 36, bg: '#2a1a0c', fg: '#f0b060', spacing: '2px' }), transparent: true, depthTest: false })); e.tag.scale.set(1.3, 0.32, 1); e.tag.renderOrder = 21; fx.add(e.tag); }
        aMeshes.set(a.id, e); burst(a.x, a.y, 0.8, a.comp ? '#f0b060' : '#d9843a');
      }
      const e = aMeshes.get(a.id); if (e.tag) e.tag.position.copy(W(a.x, a.y, 1.9));
    }
    for (const [id, e] of aMeshes) if (!seen.has(id)) { fx.remove(e.bar); if (e.tag) fx.remove(e.tag); world.remove(e.g); aMeshes.delete(id); }
  }
  // little finds in the streets: a scrap crate (amber glint) or a food sack (green), bobbing gently
  const pkMeshes = new Map();
  const pkModel = kind => { const b = new K.B(); if (kind === 'scrap') { b.cbox('#7a6a55', 0.36, 0.24, 0.28, 0, 0, 0, { r: 0.03 }); b.cbox('#f0a040', 0.38, 0.05, 0.3, 0, 0.12, 0, { r: 0.01 }); } else { b.sph('#8aa860', 0.2, 0, 0.18, 0, { detail: 1, sy: 0.85 }); b.cbox('#c9b36a', 0.08, 0.08, 0.08, 0, 0.34, 0, { r: 0.02 }); } const g = b.build(); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; };
  function syncPickups(t) {
    const seen = new Set();
    for (const p of S.pickups || []) {
      seen.add(p.id); let g = pkMeshes.get(p.id);
      if (!g) { g = pkModel(p.kind); g.position.copy(W(p.x, p.y)); world.add(g); pkMeshes.set(p.id, g); }
      g.visible = seenAt(p.x, p.y); g.position.y = 0.05 + Math.sin(t * 2.4 + p.id) * 0.05; g.rotation.y = t * 0.6 + p.id;
    }
    for (const [id, g] of pkMeshes) if (!seen.has(id)) { world.remove(g); pkMeshes.delete(id); }
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
  const ghostCells = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }), 64); ghostCells.frustumCulled = false;
  ghostCells.renderOrder = 6; ghostCells.visible = false; fx.add(ghostCells);
  let ghostMesh = null, ghostKey = '';
  const ZONE_MAX = 2500;
  const zoneMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: lc('#5fd06a'), transparent: true, opacity: 0.38, depthWrite: false }), ZONE_MAX);
  zoneMesh.renderOrder = 5; zoneMesh.frustumCulled = false; zoneMesh.visible = false; fx.add(zoneMesh); let zoneRef = null;
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
    const all = gh.cells.concat(gh.lot || []);
    all.slice(0, 64).forEach((i, k) => {
      const path = k >= gh.cells.length, ok = path ? gh.ok : gh.okCells ? gh.okCells[k] : gh.ok;
      d.position.copy(W((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.08)); d.scale.setScalar(path ? 0.82 : 1); d.updateMatrix(); ghostCells.setMatrixAt(k, d.matrix);
      ghostCells.setColorAt(k, tmpC.copy(lc(ok === 'skip' ? '#b8b0a0' : path ? (ok ? '#8fa0b0' : '#7a3a30') : ok ? '#fff1b8' : '#e0604a')));
    });
    ghostCells.count = Math.min(64, all.length); ghostCells.instanceMatrix.needsUpdate = true; if (ghostCells.instanceColor) ghostCells.instanceColor.needsUpdate = true; ghostCells.visible = true;
    if (gh.type === 'wall') { if (ghostMesh) ghostMesh.visible = false; return; }
    if (gh.type !== ghostKey) {
      if (ghostMesh) fx.remove(ghostMesh);
      ghostMesh = new THREE.Group(); ghostMesh.add(K.ghost(model(gh.type, 1, null), '#fff0d2', 0.6)); fx.add(ghostMesh); ghostKey = gh.type;
    }
    ghostMesh.visible = true; ghostMesh.position.copy(W(gh.x, gh.y)); ghostMesh.rotation.y = gh.type === 'house' || gh.type === 'farm' ? faceKeep(gh.x, gh.y) : 0;
  }

  const villagerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const villagers = createVillagers({ THREE, world, game, W, map, figure: () => { const seed = Math.floor(Math.random() * 1e6); return bakedWalker(() => K.folk(seed), villagerMat); } });
  // ---------- scavengers: crews walk out to their site at nightfall and home at dawn ----------
  const crewWalkers = [];
  const scavRig = () => { const seed = Math.floor(Math.random() * 1e6); return bakedWalker(() => K.folk(seed, { crew: true }), villagerMat); };
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
      if (e.t === 'clear') { city.clear(e.cells); for (const i of e.cells) burst((i % N) + 0.5, ((i / N) | 0) + 0.5, 0.5, '#b8ae9c'); }
      if (e.t === 'firstDead') focus = { id: e.id, t: 5 };
      if (e.t === 'hitHive') { const n = map.regions[e.region].nest; burst(n.x, n.y, 1.4, '#9dff4a'); }
      if (e.t === 'bountyGold') burst(e.x, e.y, 0.6, '#f0c050');
      if (e.t === 'pickup') { burst(e.x, e.y, 0.5, e.kind === 'scrap' ? '#f0a040' : '#9fe08a'); floatLabel(e.x, e.y, `+${e.n || 1} ${e.kind === 'scrap' ? 'scrap' : 'food'}`, e.kind === 'scrap' ? '#ffc070' : '#b4f09a'); }
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
  let focus = null, seenV = -1, zoneV = -1, shroudT = 0;
  let dark = 0, sunT = 0, time = 0, lightT = 0, wxFog = 0, flash = 0, flashN = 0, nextFlash = 4; const fogCol = K.lin('#5d6670');

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

  let boK = 0;
  function frame(dt, ui = {}) {
    time += dt;
    handleEvents(ui.events || []);
    syncKeep(); syncBuildings(); syncMobs(); syncProjectiles(); syncChests(); syncAllies(); syncPurses(); updateSites(dt, time); stepWalkers(dt); stepRain(dt); updateLandmarks(time); syncDrops(time); syncSpots(time); syncPickups(time); syncFences();
    game.zone();
    if ((S.seenVersion !== seenV || S.zoneVersion !== zoneV) && (shroudT -= dt) <= 0) { shroudT = 0.3; if (S.zoneVersion !== zoneV) repaint = true; seenV = S.seenVersion; zoneV = S.zoneVersion; city.setTerritory(); }
    if (repaint) { repaint = false; city.paint(); }
    const night = S.phase === 'night' || S.phase === 'over';
    // the sun: its place in the sky is the time of day; the last stretch of the day slides into dusk
    const dayT = S.phase === 'day' ? game.dayFrac() : 1, duskK = S.phase === 'day' ? Math.max(0, (dayT - 0.8) / 0.2) * 0.45 : 0;
    dark += ((night ? 1 : duskK) - dark) * Math.min(1, dt * (night ? 0.9 : 1.4));

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
      const fm = focus && focus.t > 0 ? S.mobs.find(m => m.id === focus.id) : null;
      if (fm) { focus.t -= dt; camTarget.lerp(W(fm.x, fm.y), Math.min(1, dt * 1.6)); }
      else if (!h.dead) camTarget.lerp(W(h.x, h.y), Math.min(1, dt * 4));
      camera.position.set(camTarget.x, camTarget.y + dist * 0.76, camTarget.z + dist * 0.65);
    }
    camera.lookAt(camTarget); camera.updateMatrixWorld();
    sunT += ((S.phase === 'day' ? dayT : sunT) - sunT) * Math.min(1, dt * 2); if (S.phase === 'day' && dayT < 0.02) sunT = dayT;
    look.blend(dark, S.phase === 'night' && game.isBloodMoon(S.night), camTarget, Math.max(22, R * 1.7), sunT);
    // weather: fog thickens the night air; a storm throws lightning
    if (wxFog > 0.01) { scene.fog.color.lerp(fogCol, wxFog * 0.35); scene.background.copy(scene.fog.color); }
    if (S.weather === 'storm' && S.phase === 'night') { nextFlash -= dt; if (nextFlash <= 0) { flash = 1; flashN = 1; nextFlash = 3 + vis() * 8; if (opts.onFlash) opts.onFlash(); } }
    if (flash > 0.01) { look.hemi.intensity += flash * 1.4; look.sun.intensity += flash * 2.2; flash *= Math.exp(-dt * (flash > 0.5 ? 9 : 4)); if (flash < 0.33 && flashN > 0) { flashN--; flash = 0.8; } }

    // night: windows, lenses, the light pool, the hero's lantern, the searchlight
    // a blackout kills the town's lights, with a dying flicker
    const boT = S.blackout ? 1 : 0; boK += (boT - boK) * Math.min(1, dt * (S.blackout ? 2.5 : 1.2));
    const lit = (1 - boK) * (boK > 0.05 && boK < 0.95 ? (Math.sin(time * 37) > 0 ? 1 : 0.3) : 1);
    for (const sp of lampGlow) sp.material.opacity = dark * 0.9 * lit;
    K.WIN.emissiveIntensity = dark * 2.4 * (0.25 + 0.75 * lit); K.LENS.emissiveIntensity = 0.2 + dark * 6 * lit;
    lightT -= dt; if (lightT <= 0) { placeLights(); lightT = 0.5; }
    for (const l of pool) l.intensity = (l.userData.i || 0) * dark * lit;
    heroLight.intensity = dark * 2.0; heroLight.position.copy(W(h.x, h.y, 1.6));
    let searching = false;
    if (dark > 0.3 && !S.blackout) {
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
      e.g.position.copy(W(a.x, a.y)); e.g.rotation.y = a.face || 0; e.g.scale.setScalar(a.comp ? UNIT.companion : UNIT.ally);
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
    // like Thronefall: people are drawn bigger than the buildings, so you can always pick them out
    syncRig(); heroRig.g.visible = !h.dead; heroRig.g.position.copy(W(h.x, h.y)); heroRig.g.scale.setScalar(UNIT.hero);
    let df = h.face - heroRig.g.rotation.y; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; heroRig.g.rotation.y += df * Math.min(1, dt * 14);
    heroRig.pose(h.moving, time * 10, h.swing > 0 ? 1 - h.swing / 0.25 : -1);
    heroRing.visible = !h.dead; heroRing.position.copy(W(h.x, h.y, 0.05));
    { const on = S.bountyT > 0 && !h.dead, R = (game.heroDef.ability && game.heroDef.ability.radius || 9) + S.P.bountyRadius; bountyRing.visible = on; if (on) { bountyRing.position.copy(W(h.x, h.y, 0.06)); bountyRing.scale.setScalar(R); bountyRing.material.opacity = 0.35 + Math.sin(time * 5) * 0.15; } }
    if (!h.dead) setBar(heroBar, h.x, 1.55, h.y, h.hp / h.maxHp); else heroBar.visible = false;

    // the dead
    crowd.begin();
    for (const m of S.mobs) {
      const e = mobState.get(m.id); if (!e) continue;
      e.x = m.x; e.y = m.y;
      if (!seenAt(m.x, m.y)) { e.bar.visible = false; continue; }   // the dead in unexplored streets stay hidden
      let d = (m.face || 0) - e.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; e.face += d * Math.min(1, dt * 6);
      e.phase += dt * (m.speed || 1.5) * 3.2;
      const fr = m.attacking ? 0 : (Math.sin(e.phase) > 0 ? 0 : 1);
      const lunge = m.attacking ? Math.max(0, Math.sin(time * 6 + e.phase)) * 0.25 : 0;
      const p = W(m.x, m.y, (m.rise - 1) * 1.1 + (m.attacking ? 0 : Math.abs(Math.sin(e.phase)) * 0.03));
      crowd.add(m.kind, fr, p.x, p.y, p.z, e.face, lunge, Math.sin(e.phase * 0.5) * 0.06, (m.unique ? 1.35 : 1) * UNIT.dead);
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
    stepPuffs(dt); stepConfetti(dt);

    // buildings
    for (const b of S.buildings) {
      const e = bMeshes.get(b.id); if (!e) continue;
      // Red Alert style: the building unfolds out of the ground with a little overshoot
      if (e.rise < 1 && !(b.built < 1)) { e.rise = Math.min(1, e.rise + dt * 2.4); const k = e.rise, c1 = 1.9, ob = 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); e.g.scale.set(1, Math.max(0.02, ob), 1); }
      else { const sc = e.g.scale.x; if (sc < 1 && !(b.built < 1)) e.g.scale.setScalar(Math.min(1, sc + dt * 3.2)); }
      if (b.built < 1) e.g.scale.set(1, 0.15 + 0.85 * b.built, 1);
      if (!b.ruined) setBar(e.bar, b.x, b.type === 'tower' ? 2.9 + b.level * 0.25 : b.type === 'wall' ? 1.7 : 3.2, b.y, b.hp / b.maxHp); else e.bar.visible = false;
    }
    keepG.visible = !S.keep.ruined;
    setBar(keepBar, C, 4.6, C, S.keep.hp / S.keep.maxHp);

    // hives: live ones glow and breathe; sleeping ones next to your land stay dark; far ones stay hidden in the ruins
    const active = new Set(S.phase === 'night' ? game.activeNests() : game.activeNests(S.night));
    const nk = `${S.claimed.size}|${S.night}|${S.phase}`;
    if (nk !== nestKey) { nestKey = nk; nearNests = new Set(S.phase === 'day' ? [...hives.keys()].filter(r => game.canPurge(r)) : []); }
    for (const [r, hv] of hives) {
      { const hp = game.hiveHealth(r), n = map.regions[r].nest; if (!hv.bar) hv.bar = makeBar('boss', 2.4); if (hp > 0 && hp < 1) setBar(hv.bar, n.x, 3.4, n.y, hp); else hv.bar.visible = false; }
      const live = (active.has(r) || S.purge === r) && !hv.cleared;
      hv.g.visible = seenAt(map.regions[r].nest.x, map.regions[r].nest.y) || live;
      const swell = S.eruption && S.eruption.region === r;   // a hive about to burst swells and throbs red
      const want = hv.cleared ? 0 : swell ? 1.6 + Math.sin(time * (10 - S.eruption.t / 5)) * 0.5 : live ? 1 : nearNests.has(r) ? 0.15 : 0;
      hv.glow += (want - hv.glow) * Math.min(1, dt * (swell ? 8 : 2));
      if (swell) hv.g.visible = true;
      hv.g.scale.setScalar(swell ? 1 + 0.04 * Math.sin(time * 9) + 0.08 * (1 - S.eruption.t / 40) : 1);
      const siege = S.purge === r, colr = swell ? lc('#ff5a3a') : siege ? lc('#e3a54a') : lc('#8fff3a');
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
      else if (sel.type === 'region') { const reg = map.regions[sel.id], n = reg.nest || reg; x = n.x; y = n.y; s = reg.nest ? 1.8 : 3; }
      else if (sel.type === 'rubble') { x = Math.floor(sel.x) + 0.5; y = Math.floor(sel.y) + 0.5; s = 1.0; }
      else if (sel.type === 'landmark') { const l = S.landmarks[sel.id]; x = l.x; y = l.y; s = l.size * 0.6; }
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
    { const cx = Math.floor(p.x), cy = Math.floor(p.y); if (cx >= 0 && cy >= 0 && cx < N && cy < N && map.lm[idx(cx, cy)] >= 0) return { type: 'landmark', id: map.lm[idx(cx, cy)], ...p }; }
    const b = game.buildingAt(p.x, p.y);
    if (b && b.type === 'keep') return { type: 'keep', ...p };
    if (b) return { type: 'building', id: b.id, ...p };
    const cx2 = Math.floor(p.x), cy2 = Math.floor(p.y);
    if (cx2 >= 0 && cy2 >= 0 && cx2 < N && cy2 < N) { const i = idx(cx2, cy2), r = map.region[i], t = map.terrain[i]; if (r >= 0 && (t === T.FOREST || t === T.ROCK) && S.occ[i] < 0 && game.zone()[i] === 1) return { type: 'rubble', ...p }; if (r >= 0 && !S.claimed.has(r)) return { type: 'region', id: r, ...p }; }
    return { type: 'ground', ...p };
  }
  function showMove(x, y) { moveMark.position.copy(W(x, y, 0.07)); moveMark.scale.set(1, 1, 1); moveMark.material.opacity = 0.9; }
  function project(x, y, h = 0.6) { const v = W(x, y, h).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 }; }

  return {
    frame, pick, project, showMove, resize, routes: () => routes, groundAt, startOrbit: () => { orbit = 0.001; },
    scene, camera, info: () => new Promise(res => { const I = renderer.info; I.autoReset = false; requestAnimationFrame(() => { I.reset(); requestAnimationFrame(() => { const o = { calls: I.render.calls, tris: I.render.triangles, geos: I.memory.geometries }; I.autoReset = true; res(o); }); }); }),   // one whole frame (all passes)
    setZoom: z => { zoom = Math.max(0.45, Math.min(1.8, z)); }, getZoom: () => zoom,
    setQuality: q => { look.setQuality(q); resize(); }, quality: () => look.quality(),
  };
}
