// The city: turns the cell map into a ruined modern city.
//   open ground → cracked asphalt · town plaza → paving · building lots and their street ring → kerbs and sidewalks
//   rock → ruined apartment blocks (one bay per cell, so walls match collisions exactly)
//   forest → rubble fields with wrecks, dead trees and scrub (kept low so the dead stay visible)
//   water → canal with concrete banks · fords → footbridges · cliffs → retaining walls · the edge → a skyline of ruins
/* global THREE */
import { N, T, idx } from '../sim/mapgen.js';
import { mulberry32 } from '../sim/rng.js';
import { K } from './kit.js';
import { bake, vcMat } from './figures.js';

const GROUND = {
  open: '#3d3c39', paved: '#4c4a45', plaza: '#54514b', rubble: '#45433d', rock: '#2f2e2b', ford: '#8d887d', cliff: '#56534c', voidc: '#262522', bed: '#1c2527',
  lot: '#5c5951', street: '#68645c',
};
const FLOOR = 0.85, GROUND_FLOOR = 1.05;

export function buildCity({ map, S, world, W, C, rand }) {
  const lin = K.lin;
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? T.VOID : map.terrain[idx(x, y)]);

  // ---------- ground: one quad per cell, coloured by what stands on it ----------
  const pos = [], cellOf = [], hOf = t => (t === T.WATER ? -0.42 : t === T.FORD ? -0.42 : 0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = at(x, y), h = hOf(t), x0 = x - C, z0 = y - C;
    pos.push(x0, h, z0, x0, h, z0 + 1, x0 + 1, h, z0, x0 + 1, h, z0, x0, h, z0 + 1, x0 + 1, h, z0 + 1);
    cellOf.push(idx(x, y));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  geo.computeVertexNormals();
  const groundMat = K.territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  const ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true; world.add(ground);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), K.M('#262522')); under.rotation.x = -Math.PI / 2; under.position.y = -0.5; world.add(under);
  const jitter = new Float32Array(N * N).map(() => 0.97 + rand() * 0.05);
  const c = new THREE.Color(), c2 = new THREE.Color();
  function paint() {
    const ca = geo.attributes.color;
    cellOf.forEach((i, q) => {
      const t = map.terrain[i], x = i % N, y = (i / N) | 0;
      const own = map.region[i] >= 0 && S.claimed.has(map.region[i]);
      let key = t === T.GRASS ? (own ? 'paved' : 'open') : t === T.DIRT ? 'plaza' : t === T.FOREST ? 'rubble' : t === T.ROCK ? 'rock' : t === T.WATER || t === T.FORD ? 'bed' : t === T.CLIFF ? 'cliff' : 'voidc';
      if (t === T.GRASS || t === T.DIRT || t === T.FOREST) {
        if (S.occ[i] >= 0) key = 'lot';
        else { let st = false; for (let dy = -1; dy <= 1 && !st; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && S.occ[idx(xx, yy)] >= 0) { st = true; break; } } if (st) key = 'street'; }
      }
      c.set(GROUND[key]).convertSRGBToLinear().multiplyScalar(jitter[i]);
      for (let v = 0; v < 6; v++) ca.setXYZ(q * 6 + v, c.r, c.g, c.b);
    });
    ca.needsUpdate = true;
  }
  paint();

  const statics = new K.B();          // everything that never changes, merged per material

  // ---------- asphalt detail: cracks, patches, manholes, faded paint ----------
  for (let i = 0; i < N * N; i++) {
    const t = map.terrain[i]; if (t !== T.GRASS && t !== T.DIRT) continue;
    const x = (i % N) - C + 0.5, z = ((i / N) | 0) - C + 0.5, r = rand();
    if (r < 0.07) statics.cbox('soot', 0.03, 0.006, 0.5 + rand() * 0.7, x + (rand() - 0.5) * 0.6, 0.004, z + (rand() - 0.5) * 0.6, { r: 0.001, ry: rand() * 3 });
    else if (r < 0.11) statics.cbox('asphalt2', 0.4 + rand() * 0.5, 0.005, 0.3 + rand() * 0.5, x, 0.003, z, { r: 0.001, ry: rand() * 3 });
    else if (r < 0.115) statics.cyl('dark', 0.16, 0.16, 0.01, x, 0, z, { seg: 12 });
    else if (r < 0.135 && t === T.GRASS) statics.cbox('paint', 0.5, 0.006, 0.06, x, 0.004, z, { r: 0.001, ry: rand() < 0.5 ? 0 : Math.PI / 2 });
  }

  // ---------- ruins: every rock cell is one bay of a ruined block ----------
  const cluster = new Int32Array(N * N).fill(-1), clusters = [];
  for (let i = 0; i < N * N; i++) {
    if (map.terrain[i] !== T.ROCK || cluster[i] >= 0) continue;
    const id = clusters.length, q = [i], cells = []; cluster[i] = id;
    while (q.length) { const j = q.pop(); cells.push(j); const x = j % N, y = (j / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const k = idx(xx, yy); if (map.terrain[k] === T.ROCK && cluster[k] < 0) { cluster[k] = id; q.push(k); } } }
    clusters.push(cells);
  }
  const WALLS = ['bone', 'sand', 'stone', 'pale', 'grey', 'sand'];
  const floorsOf = new Int8Array(N * N);
  clusters.forEach((cells, id) => {
    const base = Math.min(4, 1 + Math.floor(rand() * 2.6) + (cells.length > 14 ? 1 : 0));
    const ruinCorner = cells[Math.floor(rand() * cells.length)];
    for (const i of cells) {
      const d = Math.hypot((i % N) - (ruinCorner % N), ((i / N) | 0) - ((ruinCorner / N) | 0));
      const drop = d < 2.5 ? Math.floor(base * (0.4 + rand() * 0.5)) : rand() < 0.15 ? 1 : 0;
      floorsOf[i] = Math.max(1, base - drop + (rand() < 0.2 ? 1 : 0));
    }
  });
  const hOfCell = f => GROUND_FLOOR + (f - 1) * FLOOR;
  const leaf = [K.M('olive', { flat: true }), K.M('olive2', { flat: true })];
  clusters.forEach((cells, id) => {
    const wall = WALLS[id % WALLS.length], trim = wall === 'stone' ? 'sand' : 'stone';
    for (const i of cells) {
      const cx = i % N, cy = (i / N) | 0, x = cx - C + 0.5, z = cy - C + 0.5, f = floorsOf[i], h = hOfCell(f);
      statics.box(wall, 1.0, h, 1.0, x, 0, z, { r: 0.02 });
      let top = true;
      for (const [dx, dy, ax] of [[1, 0, 'x'], [-1, 0, 'x'], [0, 1, 'z'], [0, -1, 'z']]) {
        const k = cx + dx >= 0 && cy + dy >= 0 && cx + dx < N && cy + dy < N ? idx(cx + dx, cy + dy) : -1;
        const nf = k >= 0 && map.terrain[k] === T.ROCK ? floorsOf[k] : 0;
        if (nf > f) top = false;
        const ox = dx * 0.51, oz = dy * 0.51;
        // windows on every floor that shows on this side
        for (let fl = Math.max(1, nf + 1); fl <= f; fl++) {
          const y0 = fl === 1 ? 0 : hOfCell(fl - 1), ww = fl === 1 ? 0.62 : 0.46, wh = fl === 1 ? 0.75 : 0.56, wy = y0 + (fl === 1 ? 0.18 : 0.26);
          const burnt = rand() < 0.22;
          if (ax === 'x') { statics.box(burnt ? 'soot' : 'glass', 0.04, wh, ww, x + ox, wy, z, { r: 0.004 }); statics.box(trim, 0.07, 0.05, ww + 0.12, x + ox, wy - 0.05, z, { r: 0.005 }); }
          else { statics.box(burnt ? 'soot' : 'glass', ww, wh, 0.04, x, wy, z + oz, { r: 0.004 }); statics.box(trim, ww + 0.12, 0.05, 0.07, x, wy - 0.05, z + oz, { r: 0.005 }); }
          if (burnt && fl < f) { if (ax === 'x') statics.box('soot', 0.02, 0.35, ww * 0.9, x + dx * 0.505, wy + wh, z, { r: 0.002 }); else statics.box('soot', ww * 0.9, 0.35, 0.02, x, wy + wh, z + dy * 0.505, { r: 0.002 }); }
          if (fl > 1) { if (ax === 'x') statics.box(trim, 0.06, 0.07, 1.0, x + dx * 0.505, y0 - 0.035, z, { r: 0.005 }); else statics.box(trim, 1.0, 0.07, 0.06, x, y0 - 0.035, z + dy * 0.505, { r: 0.005 }); }
        }
        // parapet where the roof meets a lower neighbour
        if (nf < f) { if (ax === 'x') statics.box(trim, 0.08, 0.22, 1.0, x + dx * 0.46, h, z, { r: 0.01 }); else statics.box(trim, 1.0, 0.22, 0.08, x, h, z + dy * 0.46, { r: 0.01 }); }
        // creepers on the lower walls
        if (nf === 0 && rand() < 0.08) for (let k2 = 0; k2 < 5; k2++) statics.sph(leaf[k2 % 2], 0.18 + rand() * 0.12, x + ox * 1.02 + (ax === 'z' ? (rand() - 0.5) * 0.8 : 0), rand() * Math.min(h, 2.6), z + oz * 1.02 + (ax === 'x' ? (rand() - 0.5) * 0.8 : 0), { detail: 0, sx: ax === 'x' ? 0.4 : 1, sz: ax === 'z' ? 0.4 : 1 });
      }
      // roof: a tar membrane with clutter, or a broken top with slabs and rebar
      statics.cbox('roof', 0.98, 0.04, 0.98, x, h + 0.02, z, { r: 0.004 });
      if (top) {
        const r = rand();
        if (r < 0.1) statics.box('steel', 0.36, 0.26, 0.28, x + (rand() - 0.5) * 0.4, h, z + (rand() - 0.5) * 0.4, { r: 0.03 });
        else if (r < 0.14) { statics.cyl('stone', 0.28, 0.28, 0.45, x, h + 0.35, z, { seg: 10 }); for (const [a, b] of [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]]) statics.box('metal', 0.03, 0.35, 0.03, x + a, h, z + b, { r: 0.005 }); }
      }
      if (f < 3 && rand() < 0.5) {
        statics.cbox('slab', 0.8, 0.08, 0.6, x + (rand() - 0.5) * 0.3, h + 0.08, z + (rand() - 0.5) * 0.3, { r: 0.01, rx: (rand() - 0.5) * 0.5, rz: (rand() - 0.5) * 0.5 });
        for (let k2 = 0; k2 < 2; k2++) statics.cyl('rebar', 0.012, 0.012, 0.35 + rand() * 0.3, x + (rand() - 0.5) * 0.8, h, z + (rand() - 0.5) * 0.8, { seg: 4, rx: (rand() - 0.5) * 0.7, rz: (rand() - 0.5) * 0.7 });
      }
    }
  });

  // ---------- rubble fields (forest cells): debris, scrub, dead trees, wrecks ----------
  const forest = []; for (let i = 0; i < N * N; i++) if (map.terrain[i] === T.FOREST) forest.push(i);
  // built in 8×8 chunks from a per-cell random stream, so a chunk can be rebuilt without a cleared cell
  const rubCols = ['slab', 'stone', 'dark', 'slab', 'grey'], CH = 8, chunks = new Map();
  function buildChunk(key) {
    const old = chunks.get(key); if (old) { world.remove(old); old.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); chunks.delete(key); }
    const cx0 = (key % 8) * CH, cy0 = Math.floor(key / 8) * CH, rub = new K.B(); let any = false;
    for (let y = cy0; y < cy0 + CH; y++) for (let x0 = cx0; x0 < cx0 + CH; x0++) {
      const i = idx(x0, y); if (map.terrain[i] !== T.FOREST) continue;
      any = true; const r = mulberry32(i * 7919 + 13), x = x0 - C + 0.5, z = y - C + 0.5;
      for (let k = 0, n = r() < 0.5 ? 1 : 2; k < n; k++) { const sz = 0.1 + r() * 0.2; rub.cbox(rubCols[Math.floor(r() * 5)], sz * 1.6, sz * 0.7, sz, x + (r() - 0.5) * 0.85, sz * 0.3, z + (r() - 0.5) * 0.85, { r: 0.01, rx: r() * 3, ry: r() * 3, rz: r() * 3 }); }
      if (r() < 0.35) for (let k = 0; k < 3; k++) rub.sph(leaf[k % 2], 0.16 + r() * 0.16, x + (r() - 0.5) * 0.7, 0.08, z + (r() - 0.5) * 0.7, { detail: 0, sy: 0.6 });
      if (r() < 0.08) rub.cyl('rebar', 0.012, 0.012, 0.4, x + (r() - 0.5) * 0.6, 0.05, z + (r() - 0.5) * 0.6, { seg: 4, rx: r(), rz: r() });
    }
    if (!any) return;
    const m = rub.build(); world.add(m); chunks.set(key, m);
  }
  const chunkOf = i => Math.floor(((i / N) | 0) / CH) * 8 + Math.floor((i % N) / CH);
  new Set(forest.map(chunkOf)).forEach(buildChunk);
  // instanced props baked from the kit
  const propMeshes = [];
  const props = (make, cells, place) => {
    if (!cells.length) return;
    const { geo: g } = bake(make()); if (!g) return;
    const m = new THREE.InstancedMesh(g, vcMat(), cells.length), d = new THREE.Object3D();
    cells.forEach((i, k) => { place(i, d); d.updateMatrix(); m.setMatrixAt(k, d.matrix); });
    m.castShadow = true; m.receiveShadow = true; world.add(m); propMeshes.push({ m, cells }); return m;
  };
  const cellPos = (i, d, jitter = 0.3) => d.position.set((i % N) - C + 0.5 + (rand() - 0.5) * jitter, 0, ((i / N) | 0) - C + 0.5 + (rand() - 0.5) * jitter);
  const pickCells = (list, p) => list.filter(() => rand() < p);
  props(() => K.tree({ dead: true, seed: 3 }), pickCells(forest, 0.1), (i, d) => { cellPos(i, d); d.scale.setScalar(0.3 + rand() * 0.1); d.rotation.set(0, rand() * 6, 0); });
  props(() => K.tree({ seed: 7, h: 5 }), pickCells(forest, 0.015), (i, d) => { cellPos(i, d); d.scale.setScalar(0.24 + rand() * 0.05); d.rotation.set(0, rand() * 6, 0); });
  props(() => K.bush({ seed: 5, n: 5 }), pickCells(forest, 0.1), (i, d) => { cellPos(i, d); d.scale.set(0.34 + rand() * 0.12, 0.22, 0.34 + rand() * 0.12); d.rotation.set(0, rand() * 6, 0); });
  const wreckCells = pickCells(forest.concat(pickCells([...Array(N * N).keys()].filter(i => map.terrain[i] === T.GRASS && !(map.region[i] >= 0 && S.claimed.has(map.region[i]))), 0.01)), 0.04);
  ['rust', 'stone', 'grey', 'pale'].forEach((color, v) => props(() => K.car({ wreck: true, color, seed: 11 + v }), wreckCells.filter((_, k) => k % 4 === v), (i, d) => { cellPos(i, d, 0.2); d.scale.setScalar(0.3); d.rotation.set((rand() - 0.5) * 0.08, rand() * 6, (rand() - 0.5) * 0.08); }));

  // ---------- canals, footbridges, retaining walls ----------
  const waterCells = []; for (let i = 0; i < N * N; i++) if (map.terrain[i] === T.WATER || map.terrain[i] === T.FORD) waterCells.push(i);
  if (waterCells.length) {
    const wp = [];
    for (const i of waterCells) { const x0 = (i % N) - C, z0 = ((i / N) | 0) - C, h = -0.24; wp.push(x0, h, z0, x0, h, z0 + 1, x0 + 1, h, z0, x0 + 1, h, z0, x0, h, z0 + 1, x0 + 1, h, z0 + 1); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.computeVertexNormals();
    const water = new THREE.Mesh(wg, K.territory(new THREE.MeshStandardMaterial({ color: lin('#2c4a52'), roughness: 0.18, metalness: 0.2 }))); water.receiveShadow = true; world.add(water);
    for (const i of waterCells) {
      const cx = i % N, cy = (i / N) | 0, x = cx - C + 0.5, z = cy - C + 0.5;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const t = at(cx + dx, cy + dy); if (t === T.WATER || t === T.FORD || t === T.VOID) continue;
        if (dx) statics.box('stone', 0.12, 0.62, 1.0, x + dx * 0.56, -0.48, z, { r: 0.01 }); else statics.box('stone', 1.0, 0.62, 0.12, x, -0.48, z + dy * 0.56, { r: 0.01 });
      }
      if (map.terrain[i] === T.FORD) {
        statics.box('grey', 1.0, 0.12, 1.0, x, -0.1, z, { r: 0.02 }); statics.cbox('dark', 0.04, 0.005, 1.0, x - 0.25, 0.025, z, { r: 0.001 }); statics.cbox('dark', 0.04, 0.005, 1.0, x + 0.25, 0.025, z, { r: 0.001 });
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const t = at(cx + dx, cy + dy); if (t !== T.WATER) continue;
          if (dx) statics.box('metal', 0.04, 0.45, 1.0, x + dx * 0.46, 0.02, z, { r: 0.005 }); else statics.box('metal', 1.0, 0.45, 0.04, x, 0.02, z + dy * 0.46, { r: 0.005 });
        }
      }
    }
  }
  for (let i = 0; i < N * N; i++) {
    if (map.terrain[i] !== T.CLIFF) continue;
    const x = (i % N) - C + 0.5, z = ((i / N) | 0) - C + 0.5, h = 1.4 + rand() * 0.5;
    statics.box('grey', 1.0, h, 1.0, x, 0, z, { r: 0.02 });
    for (let k = 1; k < 3; k++) statics.cbox('soot', 1.02, 0.04, 1.02, x, h * k / 3, z, { r: 0.005 });
    statics.cbox('dark', 1.02, 0.08, 1.02, x, h, z, { r: 0.01 });
    if (rand() < 0.3) statics.box('metal', 0.04, 0.35, 0.04, x + (rand() - 0.5) * 0.8, h, z + (rand() - 0.5) * 0.8, { r: 0.005 });
  }

  // the edge of the map is left dark: fog and night swallow it
  world.add(statics.build());

  // ---------- territory: claimed land warm, the wild cool and grey ----------
  function setTerritory() { K.setMask((x, y) => { const r = map.region[idx(x, y)]; return r >= 0 && S.claimed.has(r); }); }
  setTerritory();

  /** rubble cleared: rebuild the touched chunks and hide props standing on those cells */
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function clear(cells) {
    const set = new Set(cells);
    new Set(cells.map(chunkOf)).forEach(buildChunk);
    for (const { m, cells: pc } of propMeshes) { let hit = false; pc.forEach((i, k) => { if (set.has(i)) { m.setMatrixAt(k, zero); hit = true; } }); if (hit) m.instanceMatrix.needsUpdate = true; }
    paint();
  }
  return { paint, setTerritory, ground, clear };
}
