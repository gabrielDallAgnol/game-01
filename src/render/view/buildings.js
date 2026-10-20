// Your buildings: models cached per (type, level, look) and folded into one draw each (model + pad + cheer),
// ruins, the build pop, the upgrade sweep, the tower's NO CREW / NO POWER tags and the bars.
/* global THREE */
import { N, idx } from '../../sim/mapgen.js';
import { K } from '../kit.js';
import { BSCALE, FOOT, HOUSE_COLORS } from './shared.js';

export function createBuildings(V) {
  const { S, C, game, world, fx, Wv } = V;
  const bMeshes = new Map();
  // ---------- buildings ----------
  // models are built once per (type, level, look) and cloned: clones share geometry and materials
  const modelCache = new Map();
  function model(type, level, b) {
    const id = b ? b.id : 0, pal = HOUSE_COLORS[level], v = type === 'house' && pal ? id % pal.length : type === 'farm' ? id % 2 : type === 'wall' ? id % 3 : 0;
    const links = type === 'wall' ? (b && b.links) || { e: true, w: true } : null;
    const key = `${type}|${level}|${v}|${links ? links.key || [links.e, links.w, links.s, links.n].map(Number).join('') : ''}`;
    const hit = modelCache.get(key); if (hit) return hit.clone();
    // the model, its pad and its cheer folded into one vertex-coloured mesh: one draw per building
    const g0 = new THREE.Group(); g0.add(buildModel(type, level, v, links));
    if (FOOT[type]) { g0.add(padFor(FOOT[type])); if (type !== 'wall') { const c = cheer(type, FOOT[type], 0, level); if (c) g0.add(c); } }
    const m = K.flattenVC(g0);
    modelCache.set(key, m); return m.clone();
  }
  const ruinCache = new Map();
  function ruinModel(type, level, b) {
    const key = `${type}|${level}|${b.id % 3}`; let r = ruinCache.get(key);
    if (!r) { r = K.ruinOf(model(type, level, b), b.id * 13 + 7, BSCALE[type] || 1); ruinCache.set(key, r); }
    return r.clone();
  }
  function buildModel(type, level, v, links) {
    let m;
    if (type === 'house') m = K.home({ level, seed: v });
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

  function rubbleModel(seed) { const b = new K.B(), r = K.rng(seed); K.rubble(b, 0, 0, 2.2, 22, r, 'sand'); const g = b.build(); g.scale.setScalar(0.3); return g; }
  function wallLinks(b) {
    const x = Math.floor(b.x), y = Math.floor(b.y);
    const l = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) return false; const o = S.byId.get(S.occ[idx(xx, yy)]); return !!(o && (o.type === 'wall' || o.type === 'tower') && !o.ruined); });
    return { e: l[0], w: l[1], s: l[2], n: l[3], key: l.map(v => (v ? 1 : 0)).join('') };
  }
  const noCrewMat = new THREE.SpriteMaterial({ map: K.textTex('NO CREW', { w: 256, h: 64, size: 40, bg: '#2a1512', fg: '#f0a090', spacing: '2px' }), transparent: true, depthTest: false });
  // your buildings stand on a concrete pad with amber corner marks: nothing else in the city has them
  function padFor(n) {
    const b = new K.B(), s2 = n - 0.12, L = Math.min(0.5, n * 0.22), t = 0.07;
    b.cbox('#a49c8c', s2, 0.05, s2, 0, 0.025, 0, { r: 0.02 });
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { b.cbox('#e08a3c', L, 0.02, t, sx * (s2 / 2 - L / 2), 0.06, sz * (s2 / 2 - t / 2), { r: 0.005 }); b.cbox('#e08a3c', t, 0.02, L, sx * (s2 / 2 - t / 2), 0.06, sz * (s2 / 2 - L / 2), { r: 0.005 }); }
    return b.build({ ao: 0.05, aoMin: 0.9 });
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
        for (const [z, ax] of [[h, 'x'], [h, 'z']]) for (let k = 1; k < 8; k++) { const t = k / 8, u = -h + 2 * h * t, sag = Math.sin(t * Math.PI) * 0.16; if (ax === 'x') b.cbox(CHEER[k % CHEER.length], 0.24, 0.24, 0.02, u, 1.02 - sag, z, { r: 0.002, rz: Math.PI / 4 }); else b.cbox(CHEER[(k + 2) % CHEER.length], 0.02, 0.24, 0.24, z, 1.02 - sag, u, { r: 0.002, rx: Math.PI / 4 }); }
        for (const [z, ax] of [[h, 'x'], [h, 'z']]) for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8, y0 = 1.14 - Math.sin(t0 * Math.PI) * 0.16, y1 = 1.14 - Math.sin(t1 * Math.PI) * 0.16, u = -h + 2 * h * (t0 + t1) / 2, L = 2 * h / 8, rz = Math.atan2(y1 - y0, L); if (ax === 'x') b.cbox('#3b3631', L + 0.01, 0.012, 0.012, u, (y0 + y1) / 2, z, { r: 0.001, rz }); else b.cbox('#3b3631', 0.012, 0.012, L + 0.01, z, (y0 + y1) / 2, u, { r: 0.001, rx: -rz }); }
        // planters with flowers on two corners
        for (const [x, z] of posts.slice(2)) { b.cbox('#8a5a3a', 0.34, 0.16, 0.34, x, 0.08, z, { r: 0.03 }); b.sph('#5c8a3c', 0.15, x, 0.2, z, { detail: 0 }); for (let k = 0; k < 4; k++) b.sph(CHEER[(k + Math.floor(r() * 4)) % CHEER.length], 0.05, x + (r() - 0.5) * 0.22, 0.32, z + (r() - 0.5) * 0.22, { detail: 0 }); }
      } else if (type !== 'tower') {
        // a single pot of greens by the lamp: someone is looking after the place
        const [x, z] = posts[3]; b.cbox('#6e5a48', 0.3, 0.14, 0.3, x, 0.07, z, { r: 0.03 }); b.sph('#56663f', 0.14, x, 0.2, z, { detail: 0 });
      }
      // the lamp: lights up at dusk with the windows
      b.cyl('#3a3a3a', 0.02, 0.025, 0.9, h, 0, h, { seg: 5 });
      b.sph(K.WIN, 0.07, h, 0.95, h, { detail: 1 });
      cheerGeo[key] = b.build({ ao: 0.3, aoMin: 0.75 });
    }
    return cheerGeo[key].clone();
  }
  const NICE = { house: '+1 Home', farm: '+1 Farm', tower: '+1 Tower', generator: '+1 Generator', workshop: 'Workshop', market: 'Market' };
  const noPowerMat = new THREE.SpriteMaterial({ map: K.textTex('NO POWER', { w: 256, h: 64, size: 40, bg: '#3a0d08', fg: '#ff6a50', spacing: '2px' }), transparent: true, depthTest: false });
  // ruins persist until rebuilt: a fallen building is drawn as its own charred, collapsed shell
  function syncBuildings() {
    const time = V.time, { makeBar } = V.bars, { dust, burst, celebrate } = V.feel;
    const seen = new Set();
    for (const b of S.buildings) {
      seen.add(b.id);
      let e = bMeshes.get(b.id);
      const links = b.type === 'wall' ? wallLinks(b) : null, lk = links ? links.key : '';
      if (!e || e.level !== b.level || e.lk !== lk) {
        const relink = e && e.level === b.level, upgrade = e && e.level < b.level;
        if (e) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); if (e.nc) fx.remove(e.nc); }
        const g = new THREE.Group(), m = model(b.type, b.level, { id: b.id, links }); g.add(m);
        g.position.copy(Wv(b.x, b.y)); if (b.type === 'house' || b.type === 'farm') g.rotation.y = faceKeep(b.x, b.y);
        world.add(g);
        e = { g, bar: makeBar('b', b.type === 'wall' ? 0.6 : 1.1), level: b.level, lk, rubble: null, type: b.type, pop: relink ? -1 : 0, sweep: upgrade ? 0 : -1, ruined: false }; bMeshes.set(b.id, e);
        if (!relink) { g.scale.set(1, 0.001, 1); if (b.type !== 'wall') { dust(b.x, b.y, FOOT[b.type] || 1); if (time > 1) celebrate(b.x, b.y, e.level > 1 ? `Level ${b.level}!` : NICE[b.type]); } }
        if (upgrade) g.traverse(o => { if (o.isMesh && o.material === K.VCM) o.material = K.SWEEP; });
      }
      if (b.built < 1) { e.g.scale.set(1, 0.15 + 0.85 * b.built, 1); e.building = true; } else if (e.building) { e.building = false; e.pop = 0; burst(b.x, b.y, 1.2, '#d9843a'); }
      if (b.type === 'tower') {
        if (!e.nc) { e.nc = new THREE.Sprite(noCrewMat); e.nc.scale.set(1.0, 0.25, 1); e.nc.renderOrder = 9; fx.add(e.nc); }
        const unpowered = !b.ruined && game.powered && !game.powered(b), uncrewed = !b.ruined && game.manned && !game.manned(b);
        e.nc.material = unpowered ? noPowerMat : noCrewMat;
        e.nc.visible = unpowered ? Math.sin(time * 8) > -0.3 : uncrewed; if (e.nc.visible) e.nc.position.copy(Wv(b.x, b.y, 2.1 + Math.sin(time * 3) * 0.05));
      }
      if (b.ruined && !e.ruined) { e.ruined = true; e.g.visible = false; e.rubble = ruinModel(b.type, b.level, b); e.rubble.position.copy(e.g.position); e.rubble.rotation.y = e.g.rotation.y; world.add(e.rubble); }
      if (!b.ruined && e.ruined) { e.ruined = false; world.remove(e.rubble); e.rubble = null; e.g.visible = true; e.pop = 0; e.g.scale.set(1, 0.001, 1); dust(b.x, b.y, FOOT[b.type] || 1); }
    }
    for (const [id, e] of bMeshes) if (!seen.has(id)) { world.remove(e.g); fx.remove(e.bar); if (e.rubble) world.remove(e.rubble); if (e.nc) fx.remove(e.nc); bMeshes.delete(id); }
  }

  /** once a frame: the pop, construction height, the upgrade sweep and the bars */
  function update(dt) {
    const { setBar } = V.bars;
    // buildings
    for (const b of S.buildings) {
      const e = bMeshes.get(b.id); if (!e) continue;
      // the pop: rises out of the ground 0 → 1.08 → 1 in 350 ms
      if (e.pop >= 0 && !(b.built < 1)) { e.pop += dt / 0.35; const k = Math.min(1, e.pop), y = k < 0.65 ? 1.08 * Math.sin(k / 0.65 * Math.PI / 2) : 1.08 - 0.08 * Math.sin((k - 0.65) / 0.35 * Math.PI / 2); e.g.scale.set(1 + (1 - k) * 0.06, Math.max(0.001, y), 1 + (1 - k) * 0.06); if (k >= 1) { e.pop = -1; e.g.scale.set(1, 1, 1); } }
      if (b.built < 1) e.g.scale.set(1, 0.15 + 0.85 * b.built, 1);
      // the upgrade sweep: the new colours climb from the ground
      if (e.sweep >= 0) { e.sweep += dt / 0.9; K.SWEEP.userData.y.value = e.g.position.y - 0.3 + e.sweep * (b.type === 'tower' ? 3.6 : 3.2); if (e.sweep >= 1) { e.sweep = -1; K.SWEEP.userData.y.value = -99; e.g.traverse(o => { if (o.isMesh && o.material === K.SWEEP) o.material = K.VCM; }); } }
      if (!b.ruined) setBar(e.bar, b.x, b.type === 'tower' ? 2.9 + b.level * 0.25 : b.type === 'wall' ? 1.7 : 3.2, b.y, b.hp / b.maxHp); else e.bar.visible = false;
    }
  }
  return { model, faceKeep, sync: syncBuildings, update };
}
