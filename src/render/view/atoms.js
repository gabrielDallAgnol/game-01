// [area] The engine-built town drawn with its own flat looks (src/engine/draw2d.js), the same picture as the Atom Lab:
// 32 m tiles round the camera are painted (two a frame, nearest first) into canvases at 10 px/m and laid as two planes: the ground
// (streets, lots, shadows, props) just above the terrain, and the overhead (roofs, canopies) above the figures, with
// a soft hole round the hero so you see him under a roof or a tree. Both planes take the shared territory() patch,
// so the fog of war, the night tint and the light pools fall on the town like on everything else. Null without an area.
/* global THREE */
import { K } from '../kit.js';
import { paintWorld } from '../../engine/draw2d.js';
// [medium] the Strand atom, and whether the One-medium look is on
import { STRAND } from '../kit/strand.js';
import { MEDIUM } from '../medium.js';

const TILE = 32, PX = 10, RES = TILE * PX;   // tiles of 32 m at 10 px/m
const OVER_Y = 3.4;                           // the overhead plane: above a standing figure
const PER_FRAME = 1, BUDGET = 6, POOL = 48;   // at least one tile a frame, more while under 6 ms (no hitch when you walk far); tiles kept

// [medium] begin: the town's tiles in the One-medium look. Painted grass (green over blue) becomes combed strands that
// bend with the gusts, part round Kai and the dead and lie flat where they trod; the rest of the ground darkens so only
// light carries form. Painted crowns overhead become strands too (and skip the glyph pass); roofs become glyphs.
const GRASS = `if (mOn > 0.5) {
  vec3 pc = diffuseColor.rgb, sg = sqrt(max(pc, 0.0)); float grass = smoothstep(0.08, 0.15, sg.g - sg.b) * smoothstep(0.35, 0.55, sg.g);
  vec2 w = vTWorld.xz, dir = strandWind(w, mTime), push = vec2(0.0);
  for (int k = 0; k < 8; k++) { vec2 d = w - mPush[k].xy; float r = length(d); if (r < mPush[k].z) push += d / max(r, 0.01) * (1.0 - r / mPush[k].z); }
  float pl = length(push); if (pl > 0.02) dir = normalize(mix(dir, push / pl, clamp(pl * 1.4, 0.0, 1.0)));
  float press = texture2D(mPress, (w + mPressO) / mPressN).r, fq = clamp(mPxM * 0.3, 3.0, 13.0), g0 = strandGust(w, mTime);
  vec2 sd = strand(w, dir, fq, 0.9 * (13.0 / fq) * mix(1.0, 0.4, press));
  vec3 hc = mix(vec3(0.05, 0.075, 0.07), vec3(0.36, 0.43, 0.39), sd.y) * (0.75 + 0.5 * g0) * mix(1.0, 0.5, press);
  vec3 grassC = mix(vec3(0.035, 0.05, 0.048), hc, smoothstep(0.1, 0.6, sd.x) * (0.5 + 0.5 * smoothstep(0.2, 0.75, sNoise(w * 0.07 + 3.7))));
  vec3 hard = mix(vec3(dot(sg, vec3(0.3, 0.59, 0.11))), sg, 0.35) * vec3(0.17, 0.18, 0.21);   // screen values   // streets, setts, lots: a dark, cool, quiet ground
  diffuseColor.rgb = pow(mix(hard, grassC, grass) * mix(1.0, 0.62, press * (1.0 - grass)), vec3(2.2));   // (the lab's colours are screen values: to linear)
}`;
const CROWN = `if (mOn > 0.5) {
  vec3 pc = diffuseColor.rgb, sg = sqrt(max(pc, 0.0)); float tr = smoothstep(0.16, 0.22, sg.g - sg.b);
  if (tr > 0.5) { tNoGlyph = 1.0; vec2 w = vTWorld.xz; float g0 = strandGust(w, mTime);
    vec2 dir = normalize(strandWind(w * 1.7, mTime) + (vec2(sNoise(w * 0.6), sNoise(w * 0.6 + 7.0)) - 0.5) * 1.6), sd = strand(w, dir, clamp(mPxM * 0.3, 3.0, 13.0), 0.5 * 13.0 / clamp(mPxM * 0.3, 3.0, 13.0));
    diffuseColor.rgb = pow(mix(vec3(0.03, 0.045, 0.04), vec3(0.3, 0.38, 0.3) + 0.05 * g0, smoothstep(0.1, 0.6, sd.x) * (0.4 + 0.6 * sd.y)), vec3(2.2)); }
}`;
// [medium] end
export function createAtoms(V) {
  const A = V.map.area; if (!A) return null;
  const { world, S, C, map } = V, Wd = A.W, palette = Wd.chapter || 'ch1';
  const Wpaint = { ...Wd, placed: Wd.placed.filter(p => !p.def.tags.includes('camp.rig')) };   // [mech] the Rig is drawn by view/keep.js (Hilde and her modules), not as a flat atom
  const hero = { value: new THREE.Vector3(0, 0, 0) };   // xz: the hero in world space; z of the vec: hole on (1) / off (0)
  const geo = new THREE.PlaneGeometry(TILE, TILE);
  const layer = over => {
    const cv = document.createElement('canvas'); cv.width = cv.height = RES;
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, transparent: over, alphaTest: over ? 0.02 : 0.5, depthWrite: !over, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    if (over) K.territory(mat, { uniforms: { uHole: hero }, fragHead: 'uniform vec3 uHole;' + STRAND, fragColor: 'diffuseColor.a *= mix(1.0, mix(0.1, 1.0, smoothstep(2.2, 4.2, distance(vTWorld.xz, uHole.xy))), uHole.z);' + CROWN });
    else K.territory(mat, { ground: false, glyph: false, fragHead: STRAND, fragColor: GRASS });   // [medium] the ground is strands, not letters
    const mesh = new THREE.Mesh(geo, mat); mesh.rotation.x = -Math.PI / 2; mesh.visible = false; if (over) mesh.renderOrder = 5; else mesh.receiveShadow = true; world.add(mesh);
    return { cv, ctx: cv.getContext('2d'), tex, mesh };
  };
  // tiles live in a pool: a tile is (re)painted for a key "tx,ty" when the camera needs it, the farthest is reused
  const tiles = new Map(), free = [], queue = [];
  const nTx = Math.ceil(Wd.w / TILE), nTy = Math.ceil(Wd.h / TILE);
  function paintTile(T) {
    const x0 = T.tx * TILE, y0 = T.ty * TILE, R = { x0, y0, x1: Math.min(Wd.w, x0 + TILE), y1: Math.min(Wd.h, y0 + TILE) };
    for (const L of [T.g, T.o]) { L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, RES, RES); L.ctx.setTransform(PX, 0, 0, PX, -x0 * PX, -y0 * PX); L.ctx.save(); L.ctx.beginPath(); L.ctx.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0); L.ctx.clip(); }
    paintWorld(T.g.ctx, T.o.ctx, Wpaint, palette, R);
    for (const L of [T.g, T.o]) L.ctx.restore();
    grade(T.g.ctx, GRADE.ground, false); grade(T.o.ctx, GRADE.over, true);   // [clarity]
    // cells the area left to the frontier (the far city) stay the frontier's
    for (let y = y0; y < R.y1; y++) for (let x = x0; x < R.x1; x++) { const mx = x + A.ox, my = y + A.oy; if (mx < 0 || my < 0 || mx >= map.N || my >= map.N || !A.mask[my * map.N + mx]) { T.g.ctx.clearRect(x, y, 1, 1); T.o.ctx.clearRect(x, y, 1, 1); } }
    T.g.tex.needsUpdate = T.o.tex.needsUpdate = true;
    const wx = x0 + TILE / 2 + A.ox - C, wz = y0 + TILE / 2 + A.oy - C;
    T.g.mesh.position.set(wx, 0.04, wz); T.o.mesh.position.set(wx, OVER_Y, wz); T.g.mesh.visible = T.o.mesh.visible = true; T.ready = true;
  }
  // [clarity] begin: the town steps back so what moves reads: a luminosity-keeping desaturation of each painted tile
  // (the ground more than the roofs). The overhead layer is transparent, so its alpha is restored from a copy after.
  const GRADE = { ground: 0.34, over: 0.22 }, keepA = document.createElement('canvas'); keepA.width = keepA.height = RES; const keepX = keepA.getContext('2d');
  function grade(ctx, a, alpha) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha) { keepX.clearRect(0, 0, RES, RES); keepX.drawImage(ctx.canvas, 0, 0); }
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, RES, RES);
    if (alpha) { ctx.globalCompositeOperation = 'destination-in'; ctx.globalAlpha = 1; ctx.drawImage(keepA, 0, 0); }
    ctx.restore();
  }
  // [clarity] end
  function want(ex, ey, hx, hy) {
    const need = new Set(), tx0 = Math.max(0, Math.floor((ex - hx) / TILE)), tx1 = Math.min(nTx - 1, Math.floor((ex + hx) / TILE)), ty0 = Math.max(0, Math.floor((ey - hy) / TILE)), ty1 = Math.min(nTy - 1, Math.floor((ey + hy) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) need.add(`${tx},${ty}`);
    for (const key of need) if (!tiles.has(key)) {
      let T = free.pop();
      if (!T && tiles.size >= POOL) { let far = null, fd = -1; for (const [k, t] of tiles) { if (need.has(k)) continue; const d = Math.hypot((t.tx + 0.5) * TILE - ex, (t.ty + 0.5) * TILE - ey); if (d > fd) { fd = d; far = k; } } if (far) { T = tiles.get(far); tiles.delete(far); } }
      if (!T) T = { g: layer(false), o: layer(true) };
      const [tx, ty] = key.split(',').map(Number); Object.assign(T, { tx, ty, ready: false }); T.g.mesh.visible = T.o.mesh.visible = false;
      tiles.set(key, T); queue.push(T);
    }
    // nearest first, a couple per frame
    queue.sort((a, b) => Math.hypot((a.tx + 0.5) * TILE - ex, (a.ty + 0.5) * TILE - ey) - Math.hypot((b.tx + 0.5) * TILE - ex, (b.ty + 0.5) * TILE - ey));
    const t0 = performance.now(); for (let n = 0; queue.length && (n < PER_FRAME || performance.now() - t0 < BUDGET); n++) { const T = queue.shift(); if (tiles.get(`${T.tx},${T.ty}`) === T && !T.ready) paintTile(T); }
  }
  let first = true;
  function update(target) {
    const ex = target.x + C - A.ox, ey = target.z + C - A.oy, half = V.cam && V.cam.half ? V.cam.half : { w: 40, h: 60 };
    const hx = Math.max(half.w, half.h * 0.6) + 12, hy = Math.max(half.h, half.w * 0.6) + 12;
    if (first) { first = false; want(ex, ey, hx, hy); while (queue.length) paintTile(queue.shift()); }   // the opening view is complete at once
    else want(ex, ey, hx, hy);
    const h = S.hero; hero.value.set(h.x - C, h.y - C, h.dead ? 0 : 1);
  }
  // houses still to search: a soft ring at the door of each one near the hero (it fills while he searches)
  const homes = V.game.searchHomes ? V.game.searchHomes() : [], ringGeo = new THREE.RingGeometry(0.55, 0.75, 24), fillGeo = new THREE.CircleGeometry(0.5, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').convertSRGBToLinear().multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false });
  const pool = Array.from({ length: 14 }, () => { const g = new THREE.Group(), r = new THREE.Mesh(ringGeo, ringMat), f = new THREE.Mesh(fillGeo, ringMat); r.rotation.x = f.rotation.x = -Math.PI / 2; g.add(r, f); g.visible = false; g.renderOrder = 6; world.add(g); return { g, f }; });
  function marks() {
    const h = S.hero, at = V.game.searchAt(), near = h.dead ? [] : homes.filter(o => Math.abs(o.x - h.x) < 22 && Math.abs(o.y - h.y) < 22 && !V.game.searched(o.id));
    near.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    pool.forEach((p, k) => { const o = near[k]; p.g.visible = !!o; if (!o) return; p.g.position.set(o.x - C, 0.09, o.y - C);
      const s = o.id === at ? Math.min(1, (S.search ? S.search.t : 0) / 1.4) : 0; p.f.scale.setScalar(Math.max(0.001, s)); p.f.visible = s > 0; p.g.scale.setScalar(1 + 0.08 * Math.sin(V.time * 4 + o.id)); });
  }
  // the town at night: every atom with a light chance is lit or dark by its own hash (lamps always, homes about half),
  // and paints the night's light pools like the camp's fires do
  const LAMP = new THREE.Color('#ffd9a0').convertSRGBToLinear(), WIN = new THREE.Color('#ffb868').convertSRGBToLinear(), FIRE = new THREE.Color('#ff7a3a').convertSRGBToLinear();
  const hash = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  // [medium] the power died in the Ashfall: no street lamps, light only in the houses someone hides in (one in five)
  const lamps = Wd.placed.filter(p => p.def.light && !p.def.tags.includes('camp') && (MEDIUM ? p.def.kind === 'building' && hash(p.uid + Wd.seed * 31) < 0.2 : hash(p.uid + Wd.seed * 31) < p.def.light)).map(p => {
    const x = p.x + A.ox - C, z = p.y + A.oy - C, look = p.def.look;
    return look === 'lamp' ? { x, z, r: 5.5, c: LAMP, k: 0.9, core: 0.35 } : look === 'nest' ? { x, z, r: 14, c: FIRE, k: 1.6, core: 0.4 } : { x, z, r: 2.6 + Math.min(p.w, p.h) * 0.12, c: WIN, k: 0.42, core: 0.1, win: true, id: p.uid };
  });
  function lights(pools, lit, fl, cam) {
    for (const l of lamps) { if (Math.abs(l.x - cam.x) > 60 || Math.abs(l.z - cam.z) > 60) continue; pools.light(l.x, l.z, l.r, l.c, l.k * (l.win ? lit * fl(l.id) : 1), l.core); }
  }
  return { update: t => { update(t); if (homes.length) marks(); }, lights, repaint: () => { for (const T of tiles.values()) { T.ready = false; queue.push(T); } } };
}
