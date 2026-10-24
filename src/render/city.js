// The world: turns the cell map into the woods round the camp and the ruined city down the road.
//   ground  → gridless: chunked meshes with shared vertices; its colour comes from two cell textures (base ground and
//             paths) sampled in world space with a noise-warped lookup, so transitions are soft and path edges organic
//   rock    → ruined apartment blocks (one bay per cell, so walls match collisions exactly), built in 16×16 chunks
//   forest  → in the woods: pines, round trees and scrub; in the city: rubble fields, dead trees and wrecks.
//             Every prop is instanced and STREAMED: only instances near the camera are uploaded (one draw per kind)
//   water   → streams with soft banks in the woods; canals with concrete banks in the city
/* global THREE */
import { N, T, idx } from '../sim/mapgen.js';
import { mulberry32 } from '../sim/rng.js';
import { K } from './kit.js';
import { PAL } from './palette.js';
import { bake, vcMat } from './figures.js';

// ground colours (sRGB): soft pastel-earthy by day; the grade and the night light do the rest
const GROUND = PAL.ground;   // [look3] tokens live in palette.js
const FLOOR = 0.85, GROUND_FLOOR = 1.05;
export const HIGH = 1.1;     // height of the plateaus (high ground)
const GCH = 64;              // ground chunk size (cells)

export function buildCity({ map, S, world, W, C, rand, game }) {
  const lin = K.lin;
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? T.VOID : map.terrain[idx(x, y)]);
  const wildAt = i => !!(map.wild && map.wild[i]);

  // ---------- ground: shared-vertex chunks; plateaus rise, stream beds sink with soft banks ----------
  const isHigh = (x, y) => x >= 0 && y >= 0 && x < N && y < N && map.high[idx(x, y)] === 1;
  const isWet = (x, y) => { const t = at(x, y); return t === T.WATER || t === T.FORD; };
  const cornerH = (x, y) => (isHigh(x - 1, y - 1) || isHigh(x, y - 1) || isHigh(x - 1, y) || isHigh(x, y) ? HIGH : 0);
  const cornerW = (x, y) => -0.42 * ((isWet(x - 1, y - 1) ? 1 : 0) + (isWet(x, y - 1) ? 1 : 0) + (isWet(x - 1, y) ? 1 : 0) + (isWet(x, y) ? 1 : 0)) / 4;
  const vtxH = (x, y) => { const h = cornerH(x, y); return h > 0 ? h : cornerW(x, y); };
  /** ground height under a point (what figures stand on): plateau tops are HIGH, ramps blend between corners */
  function heightAt(x, y) {
    const cx = Math.floor(x), cy = Math.floor(y); if (cx < 0 || cy < 0 || cx >= N || cy >= N) return 0;
    const i = idx(cx, cy); if (map.high[i]) return HIGH; if (!map.ramp[i]) return 0;
    const fx = x - cx, fy = y - cy;
    const a = cornerH(cx, cy), b = cornerH(cx + 1, cy), c2 = cornerH(cx, cy + 1), d = cornerH(cx + 1, cy + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c2 * (1 - fx) + d * fx) * fy;
  }
  // the two ground textures: base colour per cell, and paths (colour + amount), one texel per cell
  const GS = 512, gData = new Uint8Array(GS * GS * 4), pData = new Uint8Array(GS * GS * 4);
  const tex = d => { const t = new THREE.DataTexture(d, GS, GS, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
  const gTex = tex(gData), pTex = tex(pData);
  const groundMat = K.territory(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 }), {
    ground: true, uniforms: { tGround: { value: gTex }, tPath: { value: pTex } },
    fragHead: 'uniform sampler2D tGround, tPath;',
    fragColor: `
      vec2 gw = vTWorld.xz + (vec2(tNoise(vTWorld.xz * 0.8), tNoise(vTWorld.xz * 0.8 + 17.3)) - 0.5) * 0.75;
      vec2 guv = (gw + tOff) / 512.0;
      vec3 gb = texture2D(tGround, guv).rgb; gb *= gb;
      vec4 gp = texture2D(tPath, guv); gp.rgb *= gp.rgb;
      float gn = tNoise(vTWorld.xz * 0.27) * 0.55 + tNoise(vTWorld.xz * 1.6) * 0.45;
      float pe = smoothstep(0.42, 0.58, gp.a + (tNoise(vTWorld.xz * 2.2 + 5.1) - 0.5) * 0.3);
      diffuseColor.rgb = mix(gb * (0.84 + 0.3 * gn), gp.rgb * (0.9 + 0.18 * gn), pe);`,
  });
  const ground = new THREE.Group(); world.add(ground);
  for (let cy0 = 0; cy0 < N; cy0 += GCH) for (let cx0 = 0; cx0 < N; cx0 += GCH) {
    const w = Math.min(GCH, N - cx0), h = Math.min(GCH, N - cy0), pos = new Float32Array((w + 1) * (h + 1) * 3), ind = [];
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) { const k = (y * (w + 1) + x) * 3; pos[k] = cx0 + x - C; pos[k + 1] = vtxH(cx0 + x, cy0 + y); pos[k + 2] = cy0 + y - C; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (at(cx0 + x, cy0 + y) === T.VOID) continue;   // the dark between the woods and the city: nothing to draw
      const a = y * (w + 1) + x, b = a + 1, c = a + w + 1, d = c + 1;
      // split each quad along the diagonal that follows the slope best
      if (Math.abs(pos[a * 3 + 1] - pos[d * 3 + 1]) > Math.abs(pos[b * 3 + 1] - pos[c * 3 + 1])) ind.push(a, c, b, b, c, d); else ind.push(a, c, d, a, d, b);
    }
    if (!ind.length) continue;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(ind); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, groundMat); m.receiveShadow = true; ground.add(m);
  }
  const under = new THREE.Mesh(new THREE.PlaneGeometry(N * 2.2, N * 2.2), K.M('#1d1f22')); under.rotation.x = -Math.PI / 2; under.position.y = -0.5; world.add(under);
  const col = new THREE.Color();
  const put = (d, i, hex, a, k = 1) => { col.set(hex); const q = ((i / N | 0) * GS + i % N) * 4; d[q] = Math.min(255, col.r * 255 * k); d[q + 1] = Math.min(255, col.g * 255 * k); d[q + 2] = Math.min(255, col.b * 255 * k); d[q + 3] = a; };
  const jitter = new Float32Array(N * N).map(() => 0.96 + rand() * 0.08);
  /** repaint the ground textures: all of it, or only the box { x0, y0, x1, y1 } (cells, inclusive) round a change */
  function paint(box) {
    const zone = game.zone(), X0 = box ? Math.max(0, box.x0) : 0, Y0 = box ? Math.max(0, box.y0) : 0, X1 = box ? Math.min(N - 1, box.x1) : N - 1, Y1 = box ? Math.min(N - 1, box.y1) : N - 1;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const i = y * N + x, t = map.terrain[i], own = zone[i] === 1, wild = wildAt(i);
      let base, path = null;
      if (wild) {
        base = t === T.FOREST ? (own ? 'forestOwn' : 'forestFloor') : t === T.WATER || t === T.FORD ? 'bed' : t === T.VOID ? 'voidc' : own ? 'meadowOwn' : 'meadow';
        if (map.road[i]) path = own ? 'trailOwn' : 'trail';
        else if (t === T.DIRT || map.lm[i] >= 0) path = 'plaza';
      } else {
        const isWalk = t === T.GRASS && !map.road[i] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < N && yy < N && map.road[idx(xx, yy)]; });
        base = map.lm[i] >= 0 ? 'plaza' : map.road[i] ? (own ? 'roadOwn' : 'road') : isWalk ? 'walk' : t === T.FOREST ? 'park' : map.high[i] ? (own ? 'deckOwn' : 'deck') : map.ramp[i] ? 'ramp' : t === T.GRASS ? (own ? 'paved' : 'open') : t === T.DIRT ? 'plaza' : t === T.ROCK ? 'rock' : t === T.WATER || t === T.FORD ? 'bed' : t === T.CLIFF ? 'cliff' : 'voidc';
      }
      if (t === T.GRASS || t === T.DIRT || t === T.FOREST) {
        if (S.occ[i] >= 0) path = 'lot';
        else if (S.res[i] >= 0) path = 'street';   // the path that belongs to a building's lot
      }
      put(gData, i, GROUND[base], 255, jitter[i]);
      if (path) put(pData, i, GROUND[path], 255, jitter[i]); else pData[((y * GS) + x) * 4 + 3] = 0;
    }
    // paths: the colour bleeds one cell out so the edge never fades to black (the amount stays 0 there)
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const q = (y * GS + x) * 4; if (pData[q + 3]) continue;
      let best = -1; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const qq = (yy * GS + xx) * 4; if (pData[qq + 3]) { best = qq; break; } }
      if (best >= 0) { pData[q] = pData[best]; pData[q + 1] = pData[best + 1]; pData[q + 2] = pData[best + 2]; } else { pData[q] = gData[q]; pData[q + 1] = gData[q + 1]; pData[q + 2] = gData[q + 2]; }
    }
    gTex.needsUpdate = true; pTex.needsUpdate = true;
  }
  paint();

  // ---------- static detail, built per 64×64 chunk so the camera culls what it cannot see ----------
  const SCH = 64, staticChunks = new Map();
  const statics = {};
  const chunkB = (x, z) => { const k = Math.floor((z + C) / SCH) * 64 + Math.floor((x + C) / SCH); let b = staticChunks.get(k); if (!b) staticChunks.set(k, b = new K.B()); return b; };
  statics.box = (m, w, h, d, x, y, z, o) => chunkB(x, z).box(m, w, h, d, x, y, z, o);
  statics.cbox = (m, w, h, d, x, y, z, o) => chunkB(x, z).cbox(m, w, h, d, x, y, z, o);
  statics.cyl = (m, a, b, h, x, y, z, o) => chunkB(x, z).cyl(m, a, b, h, x, y, z, o);
  statics.sph = (m, r, x, y, z, o) => chunkB(x, z).sph(m, r, x, y, z, o);

  // asphalt detail in the city: cracks, patches, manholes
  for (let i = 0; i < N * N; i++) {
    const t = map.terrain[i]; if ((t !== T.GRASS && t !== T.DIRT) || map.high[i] || map.ramp[i] || wildAt(i)) continue;
    const x = (i % N) - C + 0.5, z = ((i / N) | 0) - C + 0.5, r = rand();
    if (r < 0.05) statics.cbox('soot', 0.03, 0.006, 0.5 + rand() * 0.7, x + (rand() - 0.5) * 0.6, 0.004, z + (rand() - 0.5) * 0.6, { r: 0.001, ry: rand() * 3 });
    else if (r < 0.08) statics.cbox('asphalt2', 0.4 + rand() * 0.5, 0.005, 0.3 + rand() * 0.5, x, 0.003, z, { r: 0.001, ry: rand() * 3 });
    else if (r < 0.084) statics.cyl('dark', 0.16, 0.16, 0.01, x, 0, z, { seg: 8 });
  }
  // road markings in the city: a dashed centre line, zebra crossings before each junction
  const isRoad = (x, y) => x >= 0 && y >= 0 && x < N && y < N && map.road[idx(x, y)] === 1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!isRoad(x, y) || map.high[idx(x, y)] || wildAt(idx(x, y))) continue;
    const X = x - C, Z = y - C;
    const vert = isRoad(x + 1, y) && !isRoad(x - 1, y) && !isRoad(x + 2, y);
    const horiz = isRoad(x, y + 1) && !isRoad(x, y - 1) && !isRoad(x, y + 2);
    const junction = (isRoad(x - 1, y) || isRoad(x + 2, y)) && (isRoad(x, y - 1) || isRoad(x, y + 2));
    if (vert && !junction && y % 2 === 0) statics.cbox('paint', 0.07, 0.006, 0.55, X + 1, 0.005, Z + 0.5, { r: 0.001 });
    if (horiz && !junction && x % 2 === 0) statics.cbox('paint', 0.55, 0.006, 0.07, X + 0.5, 0.005, Z + 1, { r: 0.001 });
    if (vert && !junction && (isRoad(x - 1, y + 1) || isRoad(x + 2, y + 1)) && !(isRoad(x - 1, y) || isRoad(x + 2, y))) for (let k = 0; k < 5; k++) statics.cbox('paint', 0.28, 0.006, 0.12, X + 0.2 + k * 0.4, 0.005, Z + 0.8, { r: 0.001 });
    if (horiz && !junction && (isRoad(x + 1, y - 1) || isRoad(x + 1, y + 2)) && !(isRoad(x, y - 1) || isRoad(x, y + 2))) for (let k = 0; k < 5; k++) statics.cbox('paint', 0.12, 0.006, 0.28, X + 0.8, 0.005, Z + 0.2 + k * 0.4, { r: 0.001 });
  }

  // ---------- ruins: every rock cell is one bay of a ruined block ----------
  const cluster = new Int32Array(N * N).fill(-1), clusters = [];
  for (let i = 0; i < N * N; i++) {
    if (map.terrain[i] !== T.ROCK || cluster[i] >= 0 || map.lm[i] >= 0) continue;
    const id = clusters.length, q = [i], cells = []; cluster[i] = id;
    while (q.length) { const j = q.pop(); cells.push(j); const x = j % N, y = (j / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const k = idx(xx, yy); if (map.terrain[k] === T.ROCK && cluster[k] < 0 && map.lm[k] < 0) { cluster[k] = id; q.push(k); } } }
    clusters.push(cells);
  }
  const WALLS = ['bone', 'sand', 'stone', 'pale', 'grey', 'sand'];
  const floorsOf = new Int8Array(N * N), damaged = new Uint8Array(N * N);
  clusters.forEach(cells => {
    const base = Math.min(5, 2 + Math.floor(rand() * 2.6) + (cells.length > 14 ? 1 : 0)), hit = rand() < 0.3;
    const ruinCorner = cells[Math.floor(rand() * cells.length)];
    for (const i of cells) {
      damaged[i] = hit ? 1 : 0;
      const d = Math.hypot((i % N) - (ruinCorner % N), ((i / N) | 0) - ((ruinCorner / N) | 0));
      const drop = hit && d < 2.5 ? Math.floor(base * (0.4 + rand() * 0.5)) : 0;
      floorsOf[i] = Math.max(1, base - drop);
    }
  });
  const hOfCell = f => GROUND_FLOOR + (f - 1) * FLOOR;
  const leaf = [K.M('olive', { flat: true }), K.M('olive2', { flat: true })];
  const clusterOf = new Int32Array(N * N).fill(-1); clusters.forEach((cells, id) => { for (const i of cells) clusterOf[i] = id; });
  function ruinCell(b, i) {
    const id = clusterOf[i], rnd = mulberry32(i * 7907 + 101), wall = WALLS[id % WALLS.length], trim = wall === 'stone' ? 'sand' : 'stone';
    const cx = i % N, cy = (i / N) | 0, x = cx - C + 0.5, z = cy - C + 0.5, f = floorsOf[i], h = hOfCell(f);
    b.box(wall, 1.0, h, 1.0, x, 0, z, { r: 0.02 });
    let top = true;
    for (const [dx, dy, ax] of [[1, 0, 'x'], [-1, 0, 'x'], [0, 1, 'z'], [0, -1, 'z']]) {
      const k = cx + dx >= 0 && cy + dy >= 0 && cx + dx < N && cy + dy < N ? idx(cx + dx, cy + dy) : -1;
      const nf = k >= 0 && map.terrain[k] === T.ROCK ? floorsOf[k] : 0;
      if (nf > f) top = false;
      const ox = dx * 0.51, oz = dy * 0.51;
      for (let fl = Math.max(1, nf + 1); fl <= f; fl++) {
        const y0 = fl === 1 ? 0 : hOfCell(fl - 1), ww = fl === 1 ? 0.62 : 0.46, wh = fl === 1 ? 0.75 : 0.56, wy = y0 + (fl === 1 ? 0.18 : 0.26);
        const burnt = rnd() < (damaged[i] ? 0.25 : 0.04);
        if (ax === 'x') { b.box(burnt ? 'soot' : 'glass', 0.04, wh, ww, x + ox, wy, z, { r: 0.004 }); b.box(trim, 0.07, 0.05, ww + 0.12, x + ox, wy - 0.05, z, { r: 0.005 }); }
        else { b.box(burnt ? 'soot' : 'glass', ww, wh, 0.04, x, wy, z + oz, { r: 0.004 }); b.box(trim, ww + 0.12, 0.05, 0.07, x, wy - 0.05, z + oz, { r: 0.005 }); }
        if (burnt && fl < f) { if (ax === 'x') b.box('soot', 0.02, 0.35, ww * 0.9, x + dx * 0.505, wy + wh, z, { r: 0.002 }); else b.box('soot', ww * 0.9, 0.35, 0.02, x, wy + wh, z + dy * 0.505, { r: 0.002 }); }
        if (fl > 1) { if (ax === 'x') b.box(trim, 0.06, 0.07, 1.0, x + dx * 0.505, y0 - 0.035, z, { r: 0.005 }); else b.box(trim, 1.0, 0.07, 0.06, x, y0 - 0.035, z + dy * 0.505, { r: 0.005 }); }
      }
      if (nf < f) { if (ax === 'x') b.box(trim, 0.08, 0.22, 1.0, x + dx * 0.46, h, z, { r: 0.01 }); else b.box(trim, 1.0, 0.22, 0.08, x, h, z + dy * 0.46, { r: 0.01 }); }
      if (nf === 0 && rnd() < (damaged[i] ? 0.08 : 0.02)) for (let k2 = 0; k2 < 5; k2++) b.sph(leaf[k2 % 2], 0.18 + rnd() * 0.12, x + ox * 1.02 + (ax === 'z' ? (rnd() - 0.5) * 0.8 : 0), rnd() * Math.min(h, 2.6), z + oz * 1.02 + (ax === 'x' ? (rnd() - 0.5) * 0.8 : 0), { detail: 0, sx: ax === 'x' ? 0.4 : 1, sz: ax === 'z' ? 0.4 : 1 });
    }
    b.cbox('roof', 0.98, 0.04, 0.98, x, h + 0.02, z, { r: 0.004 });
    if (top) {
      const r = rnd();
      if (r < 0.1) b.box('steel', 0.36, 0.26, 0.28, x + (rnd() - 0.5) * 0.4, h, z + (rnd() - 0.5) * 0.4, { r: 0.03 });
      else if (r < 0.14) { b.cyl('stone', 0.28, 0.28, 0.45, x, h + 0.35, z, { seg: 8 }); for (const [a, bb] of [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]]) b.box('metal', 0.03, 0.35, 0.03, x + a, h, z + bb, { r: 0.005 }); }
    }
    if (damaged[i] && f < 3 && rnd() < 0.5) {
      b.cbox('slab', 0.8, 0.08, 0.6, x + (rnd() - 0.5) * 0.3, h + 0.08, z + (rnd() - 0.5) * 0.3, { r: 0.01, rx: (rnd() - 0.5) * 0.5, rz: (rnd() - 0.5) * 0.5 });
      for (let k2 = 0; k2 < 2; k2++) b.cyl('rebar', 0.012, 0.012, 0.35 + rnd() * 0.3, x + (rnd() - 0.5) * 0.8, h, z + (rnd() - 0.5) * 0.8, { seg: 4, rx: (rnd() - 0.5) * 0.7, rz: (rnd() - 0.5) * 0.7 });
    }
  }
  const RCH = 16, RCW = Math.ceil(N / RCH), ruinChunks = new Map();
  function buildRuins(key) {
    const old = ruinChunks.get(key); if (old) { world.remove(old); old.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); ruinChunks.delete(key); }
    const cx0 = (key % RCW) * RCH, cy0 = Math.floor(key / RCW) * RCH, b = new K.B(); let any = false;
    for (let y = cy0; y < Math.min(N, cy0 + RCH); y++) for (let x0 = cx0; x0 < Math.min(N, cx0 + RCH); x0++) { const i = idx(x0, y); if (map.terrain[i] !== T.ROCK || clusterOf[i] < 0) continue; any = true; ruinCell(b, i); }
    if (!any) return;
    const m = b.build({ ao: 0.6, aoMin: 0.55 }); world.add(m); ruinChunks.set(key, m);
  }
  const ruinKey = i => Math.floor(((i / N) | 0) / RCH) * RCW + Math.floor((i % N) / RCH);
  new Set(clusters.flat().map(ruinKey)).forEach(buildRuins);

  // ---------- props: instanced, streamed around the camera ----------
  // Each kind keeps every instance's matrix, bucketed in 16×16 cells; stream() uploads only the buckets in a window
  // round the camera (and its shadow), so each kind is one draw however big the woods get.
  const BK = 16, BW = Math.ceil(N / BK);
  const kinds = [];
  const treeCov = new Float32Array(N * N);
  const propMat = vcMat({ sway: false }), swayMat = vcMat({ sway: true });
  const d0 = new THREE.Object3D();
  function kind(make, o = {}) {
    const { geo } = bake(make()); if (!geo) return null;
    const k = { geo, mats: [], cells: [], buckets: new Map(), mesh: null, cap: 0, dead: null, cover: o.cover || 0, shadow: !o.noShadow };
    k.mat = o.sway ? swayMat : propMat; kinds.push(k); return k;
  }
  function place(k, i, fn) {
    if (!k) return;
    fn(d0); d0.updateMatrix();
    const n = k.cells.length; k.cells.push(i); k.mats.push(...d0.matrix.elements);
    const b = Math.floor(((i / N) | 0) / BK) * BW + Math.floor((i % N) / BK); let l = k.buckets.get(b); if (!l) k.buckets.set(b, l = []); l.push(n);
    if (k.cover) treeCov[i] = Math.max(treeCov[i], k.cover);
  }
  function finishKinds() {
    for (const k of kinds) {
      k.mats = new Float32Array(k.mats); k.dead = new Uint8Array(k.cells.length);
      k.cap = Math.min(k.cells.length, 6000);
      const m = new THREE.InstancedMesh(k.geo, k.mat, Math.max(1, k.cap)); m.count = 0; m.frustumCulled = false; m.castShadow = k.shadow; m.receiveShadow = true;
      k.mesh = m; world.add(m);
    }
  }
  const cellPos = (i, d, j = 0.3) => d.position.set((i % N) - C + 0.5 + (rand() - 0.5) * j, 0, ((i / N) | 0) - C + 0.5 + (rand() - 0.5) * j);
  const forest = []; for (let i = 0; i < N * N; i++) if (map.terrain[i] === T.FOREST) forest.push(i);
  // a forest hollow's mound clears its own glade: no trees grow through it
  const hollows = map.regions.filter(r => r.nest && r.ring === 1).map(r => r.nest.body || r.nest);   // a hollow in a building clears the glade round the building
  const inHollow = i => { const x = (i % N) + 0.5, y = ((i / N) | 0) + 0.5; return hollows.some(n => Math.abs(n.x - x) < 3.6 && Math.abs(n.y - y) < 3.6 && Math.hypot(n.x - x, n.y - y) < 3.6); };
  const woods = forest.filter(i => wildAt(i) && !inHollow(i)), parks = forest.filter(i => !wildAt(i));
  const pick = (list, p) => list.filter(() => rand() < p);
  // the woods: chunky low-poly pines in forest teal-greens make the mass; round trees break it up; scrub fills the floor
  // a pine: an open trunk and stacked six-sided cones (≈46 triangles)
  const pine = (tone, tone2, tall) => { const b = new K.B(); b.cyl('#5a4330', 0.12, 0.17, 1.1, 0, 0, 0, { seg: 5, open: true }); const L = tall ? 3 : 2; for (let k = 0; k < L; k++) { const hh = 1.5 - k * 0.2; b.geo(k % 2 ? tone2 : tone, new THREE.ConeGeometry(1.2 - k * 0.3, hh, 6, 1), 0, 0.8 + k * 0.95 + hh / 2, 0, 0, k * 0.5, 0); } return b.build({ ao: 2.2, aoMin: 0.5 }); };
  const roundTree = (seed, h) => K.tree({ seed, h });
  const kPineT = kind(() => pine('#2f5a4a', '#33604c', true), { sway: true, cover: 0.55 });
  const kPineS = kind(() => pine('#3e6b52', '#467456', false), { sway: true, cover: 0.45 });
  const kRound = kind(() => roundTree(7, 5), { sway: true, cover: 0.5 });
  const kStreet = kind(() => roundTree(9, 4), { sway: true, cover: 0.35 });
  const kDead = kind(() => K.tree({ dead: true, seed: 3 }), { cover: 0.2 });
  const kBush = kind(() => K.bush({ seed: 5, n: 5 }), { sway: true, cover: 0.2 });
  const kScrub = kind(() => { const b = new K.B(); for (let k = 0; k < 2; k++) b.sph(k % 2 ? '#5f7a46' : '#6b8a4c', 0.19 + k * 0.04, (k - 0.5) * 0.26, 0.06, (k % 2) * 0.16 - 0.08, { detail: 0, sy: 0.6 }); return b.build({ ao: 0.25, aoMin: 0.7 }); }, { sway: true, noShadow: true });
  const kStone = kind(() => { const b = new K.B(); b.sph('#9a958a', 0.22, 0, 0.04, 0, { detail: 0, sy: 0.55, sx: 1.3 }); b.sph('#8a857b', 0.14, 0.24, 0.03, 0.1, { detail: 0, sy: 0.6 }); return b.build({ ao: 0.2, aoMin: 0.7 }); }, { noShadow: true });
  const kRubble = kind(() => { const b = new K.B(), r = mulberry32(77); for (let k = 0; k < 3; k++) { const s = 0.1 + r() * 0.16; b.cbox(['slab', 'stone', 'grey'][k], s * 1.6, s * 0.7, s, (r() - 0.5) * 0.6, s * 0.3, (r() - 0.5) * 0.6, { r: 0.01, rx: r() * 3, ry: r() * 3, rz: r() * 3 }); } for (let k = 0; k < 3; k++) b.sph(leaf[k % 2], 0.16 + r() * 0.12, (r() - 0.5) * 0.6, 0.08, (r() - 0.5) * 0.6, { detail: 0, sy: 0.6 }); return b.build({ ao: 0.25, aoMin: 0.7 }); });
  const wrecks = ['rust', 'stone', 'grey', 'pale'].map((color, v) => kind(() => K.car({ wreck: true, color, seed: 11 + v })));
  for (const i of woods) {
    const r = mulberry32(i * 7919 + 13);
    if (r() < 0.35) place(kScrub, i, d => { cellPos(i, d, 0.6); d.scale.setScalar(0.9 + r() * 0.5); d.rotation.set(0, r() * 6, 0); });
    if (r() < 0.05) place(kStone, i, d => { cellPos(i, d, 0.6); d.scale.setScalar(0.7 + r() * 0.6); d.rotation.set(0, r() * 6, 0); });
  }
  for (const i of parks) {
    const r = mulberry32(i * 7919 + 13);
    if (r() < 0.18) place(kRubble, i, d => { cellPos(i, d, 0.5); d.scale.setScalar(0.8 + r() * 0.4); d.rotation.set(0, r() * 6, 0); });
    else if (r() < 0.5) place(kScrub, i, d => { cellPos(i, d, 0.6); d.scale.setScalar(0.8 + r() * 0.4); d.rotation.set(0, r() * 6, 0); });
  }
  for (const i of pick(parks, 0.025)) place(kDead, i, d => { cellPos(i, d); d.scale.setScalar(0.3 + rand() * 0.1); d.rotation.set(0, rand() * 6, 0); });
  for (const i of woods.filter(() => rand() < 0.22)) place(kPineT, i, d => { cellPos(i, d); d.scale.setScalar(0.55 + rand() * 0.25); d.rotation.set(0, rand() * 6, 0); });
  for (const i of woods.filter(() => rand() < 0.2)) place(kPineS, i, d => { cellPos(i, d); d.scale.setScalar(0.45 + rand() * 0.2); d.rotation.set(0, rand() * 6, 0); });
  for (const i of woods.filter(() => rand() < 0.035).concat(parks.filter(() => rand() < 0.22))) place(kRound, i, d => { cellPos(i, d); d.scale.setScalar(0.26 + rand() * 0.06); d.rotation.set(0, rand() * 6, 0); });
  for (const i of pick(forest, 0.08)) place(kBush, i, d => { cellPos(i, d); d.scale.set(0.34 + rand() * 0.12, 0.22, 0.34 + rand() * 0.12); d.rotation.set(0, rand() * 6, 0); });
  const walks = []; for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0; if (map.terrain[i] === T.GRASS && !wildAt(i) && !map.road[i] && !map.high[i] && map.lm[i] < 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoad(x + dx, y + dy)) && (x + y) % 3 === 0) walks.push(i); }
  for (const i of pick(walks, 0.35)) place(kStreet, i, d => { cellPos(i, d, 0.1); d.scale.setScalar(0.2 + rand() * 0.04); d.rotation.set(0, rand() * 6, 0); });
  const wreckCells = pick(parks.concat(pick([...Array(N * N).keys()].filter(i => map.terrain[i] === T.GRASS && !wildAt(i) && !map.high[i] && !map.ramp[i] && !(map.region[i] >= 0 && S.claimed.has(map.region[i]))), 0.01)), 0.04);
  wreckCells.forEach((i, k) => place(wrecks[k % 4], i, d => { cellPos(i, d, 0.2); d.scale.setScalar(0.3); d.rotation.set((rand() - 0.5) * 0.08, rand() * 6, (rand() - 0.5) * 0.08); }));
  finishKinds();
  let sx0 = 1e9, sz0 = 1e9, shx = 0, shz = 0, sNear = 0, sFar = 0;
  /** upload the props in the window x ± hx, z - far … z + near (the camera looks toward -z) — call every frame;
   *  it only does work when the window moved, and then only for the 16×16 buckets inside it */
  function stream(x, z, hx, far, near) {
    if (Math.abs(x - sx0) < 2 && Math.abs(z - sz0) < 2 && hx <= shx && far <= sFar && near <= sNear && hx > shx * 0.75) return;
    sx0 = x; sz0 = z; shx = hx + 2; sFar = far + 2; sNear = near + 2; hx = shx; far = sFar; near = sNear;
    const bx0 = Math.max(0, Math.floor((x - hx + C) / BK)), bx1 = Math.min(BW - 1, Math.floor((x + hx + C) / BK)), by0 = Math.max(0, Math.floor((z - far + C) / BK)), by1 = Math.min(BW - 1, Math.floor((z + near + C) / BK));
    const X0 = x - hx, X1 = x + hx, Z0 = z - far, Z1 = z + near;
    for (const k of kinds) {
      const arr = k.mesh.instanceMatrix.array; let n = 0;
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
        const l = k.buckets.get(by * BW + bx); if (!l) continue;
        for (let q = 0; q < l.length && n < k.cap; q++) { const j = l[q]; if (k.dead[j]) continue; const px = k.mats[j * 16 + 12], pz = k.mats[j * 16 + 14]; if (px < X0 || px > X1 || pz < Z0 || pz > Z1) continue; for (let e = 0; e < 16; e++) arr[n * 16 + e] = k.mats[j * 16 + e]; n++; }
      }
      k.mesh.count = n; k.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- water: streams with soft banks in the woods, canals with concrete banks in the city ----------
  const waterCells = []; for (let i = 0; i < N * N; i++) if (map.terrain[i] === T.WATER || map.terrain[i] === T.FORD) waterCells.push(i);
  if (waterCells.length) {
    const wp = [];
    for (const i of waterCells) { const x0 = (i % N) - C, z0 = ((i / N) | 0) - C, h = -0.2; wp.push(x0 - 0.3, h, z0 - 0.3, x0 - 0.3, h, z0 + 1.3, x0 + 1.3, h, z0 - 0.3, x0 + 1.3, h, z0 - 0.3, x0 - 0.3, h, z0 + 1.3, x0 + 1.3, h, z0 + 1.3); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.computeVertexNormals();
    const water = new THREE.Mesh(wg, K.territory(new THREE.MeshStandardMaterial({ color: lin('#4f8a8c'), roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.82 }))); water.receiveShadow = true; water.renderOrder = 1; world.add(water);
    for (const i of waterCells) {
      const cx = i % N, cy = (i / N) | 0, x = cx - C + 0.5, z = cy - C + 0.5;
      if (wildAt(i)) {   // a stream in the woods: reeds on the banks, stepping stones at the fords
        if (map.terrain[i] === T.FORD) for (let k = 0; k < 2; k++) statics.cyl('#9a958a', 0.22, 0.26, 0.24, x + (rand() - 0.5) * 0.5, -0.24, z + (rand() - 0.5) * 0.5, { seg: 7 });
        else if (rand() < 0.3) statics.sph('#6f8a4c', 0.18, x + (rand() - 0.5) * 0.9, -0.05, z + (rand() - 0.5) * 0.9, { detail: 0, sy: 1.4 });
        continue;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const t = at(cx + dx, cy + dy); if (t === T.WATER || t === T.FORD || t === T.VOID) continue;
        if (dx) statics.box('stone', 0.12, 0.62, 1.0, x + dx * 0.56, -0.48, z, { r: 0.01 }); else statics.box('stone', 1.0, 0.62, 0.12, x, -0.48, z + dy * 0.56, { r: 0.01 });
      }
      if (map.terrain[i] === T.FORD) {
        statics.box('grey', 1.0, 0.12, 1.0, x, -0.1, z, { r: 0.02 });
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const t = at(cx + dx, cy + dy); if (t !== T.WATER) continue;
          if (dx) statics.box('metal', 0.04, 0.45, 1.0, x + dx * 0.46, 0.02, z, { r: 0.005 }); else statics.box('metal', 1.0, 0.45, 0.04, x, 0.02, z + dy * 0.46, { r: 0.005 });
        }
      }
    }
  }
  for (let i = 0; i < N * N; i++) {
    if (map.terrain[i] !== T.CLIFF) continue;
    const cx = i % N, cy = (i / N) | 0, x = cx - C + 0.5, z = cy - C + 0.5;
    const terrace = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => cx + dx >= 0 && cy + dy >= 0 && cx + dx < N && cy + dy < N && map.high[idx(cx + dx, cy + dy)]);
    const h = terrace ? HIGH + 0.22 : 1.4 + rand() * 0.5;
    statics.box(terrace ? 'stone' : 'grey', 1.0, h, 1.0, x, 0, z, { r: 0.02 });
    for (let k = 1; k < 3; k++) statics.cbox('soot', 1.02, 0.04, 1.02, x, h * k / 3, z, { r: 0.005 });
    statics.cbox('dark', 1.02, 0.08, 1.02, x, h, z, { r: 0.01 });
  }
  for (const b of staticChunks.values()) world.add(b.build({ ao: 0.5, aoMin: 0.6 }));

  // ---------- territory, explored ground and contact shadows ----------
  const isRuin = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) if (map.terrain[i] === T.ROCK || map.terrain[i] === T.CLIFF) isRuin[i] = 1;
  K.setFootprints(i => (S.occ[i] >= 0 ? 0.9 : isRuin[i] ? 0.9 : treeCov[i]));
  function setTerritory() { K.setMaskArrays(game.zone(), S.seen, N); }
  setTerritory();

  /** rubble cleared: rebuild the touched ruin chunks and drop the props standing on those cells
   *  (`local`: a worn trail; repaint only the ground round it, the territory mask has not changed) */
  function clear(cells, local) {
    const set = new Set(cells);
    const near = new Set(); for (const i of cells) for (const d of [0, 1, -1, N, -N]) if (i + d >= 0 && i + d < N * N) near.add(ruinKey(i + d));
    near.forEach(buildRuins);
    for (const k of kinds) k.cells.forEach((i, j) => { if (set.has(i)) { k.dead[j] = 1; treeCov[i] = 0; } });
    for (const i of cells) isRuin[i] = map.terrain[i] === T.ROCK || map.terrain[i] === T.CLIFF ? 1 : 0;
    sx0 = 1e9;
    if (local) { let x0 = N, y0 = N, x1 = 0, y1 = 0; for (const i of cells) { const x = i % N, y = (i / N) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } paint({ x0: x0 - 2, y0: y0 - 2, x1: x1 + 2, y1: y1 + 2 }); return; }
    paint(); setTerritory();
  }
  return { paint, setTerritory, ground, clear, heightAt, stream };
}
