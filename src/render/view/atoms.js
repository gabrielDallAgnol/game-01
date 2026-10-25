// [area] The engine-built town drawn with its own flat looks (src/engine/draw2d.js), the same picture as the Atom Lab:
// a window round the camera is painted into two canvases at 10 px/m and laid in the world as two planes: the ground
// (streets, lots, shadows, props) just above the terrain, and the overhead (roofs, canopies) above the figures, with
// a soft hole round the hero so you see him under a roof or a tree. Both planes take the shared territory() patch,
// so the fog of war, the night tint and the light pools fall on the town like on everything else. Null without an area.
/* global THREE */
import { K } from '../kit.js';
import { paintWorld } from '../../engine/draw2d.js';

const SIZE = 160, PX = 10, RES = SIZE * PX, KEEP = 26;   // the window (m), its resolution, how far the camera may drift before a repaint
const OVER_Y = 3.4;                                        // the overhead plane: above a standing figure

export function createAtoms(V) {
  const A = V.map.area; if (!A) return null;
  const { world, S, C, map } = V, Wd = A.W, palette = Wd.chapter || 'ch1';
  const layer = transparentOver => {
    const cv = document.createElement('canvas'); cv.width = cv.height = RES;
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, transparent: transparentOver, alphaTest: transparentOver ? 0.02 : 0.5, depthWrite: !transparentOver, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return { cv, ctx: cv.getContext('2d'), tex, mat };
  };
  const g = layer(false), o = layer(true);
  const hero = { value: new THREE.Vector3(0, 0, 0) };   // xz: the hero in world space; z of the vec: hole on (1) / off (0)
  K.territory(g.mat, { ground: false });
  K.territory(o.mat, { uniforms: { uHole: hero }, fragHead: 'uniform vec3 uHole;', fragColor: 'diffuseColor.a *= mix(1.0, mix(0.1, 1.0, smoothstep(2.2, 4.2, distance(vTWorld.xz, uHole.xy))), uHole.z);' });
  const geo = new THREE.PlaneGeometry(SIZE, SIZE);
  const gm = new THREE.Mesh(geo, g.mat), om = new THREE.Mesh(geo, o.mat);
  gm.rotation.x = om.rotation.x = -Math.PI / 2; gm.receiveShadow = true; om.renderOrder = 5;
  world.add(gm, om);
  let cx = NaN, cy = NaN;   // the window's centre in engine metres
  function paint(ex, ey) {
    cx = Math.round(ex); cy = Math.round(ey);
    const x0 = cx - SIZE / 2, y0 = cy - SIZE / 2, R = { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(Wd.w, x0 + SIZE), y1: Math.min(Wd.h, y0 + SIZE) };
    for (const L of [g, o]) { L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, RES, RES); L.ctx.setTransform(PX, 0, 0, PX, -x0 * PX, -y0 * PX); }
    if (R.x1 > R.x0 && R.y1 > R.y0) {
      for (const L of [g, o]) { L.ctx.save(); L.ctx.beginPath(); L.ctx.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0); L.ctx.clip(); }
      paintWorld(g.ctx, o.ctx, Wd, palette, R);
      for (const L of [g, o]) L.ctx.restore();
      // cells the area left to the frontier (the far city) stay the frontier's
      for (let y = Math.floor(R.y0); y < R.y1; y++) for (let x = Math.floor(R.x0); x < R.x1; x++) { const mx = x + A.ox, my = y + A.oy; if (mx < 0 || my < 0 || mx >= map.N || my >= map.N || !A.mask[my * map.N + mx]) { g.ctx.clearRect(x, y, 1, 1); o.ctx.clearRect(x, y, 1, 1); } }
    }
    g.tex.needsUpdate = o.tex.needsUpdate = true;
    const wx = cx + A.ox - C, wz = cy + A.oy - C;
    gm.position.set(wx, 0.04, wz); om.position.set(wx, OVER_Y, wz);
  }
  function update(target) {
    const ex = target.x + C - A.ox, ey = target.z + C - A.oy;
    if (!(Math.abs(ex - cx) < KEEP && Math.abs(ey - cy) < KEEP)) paint(ex, ey);
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
  const lamps = Wd.placed.filter(p => p.def.light && !p.def.tags.includes('camp') && hash(p.uid + Wd.seed * 31) < p.def.light).map(p => {
    const x = p.x + A.ox - C, z = p.y + A.oy - C, look = p.def.look;
    return look === 'lamp' ? { x, z, r: 5.5, c: LAMP, k: 0.9, core: 0.35 } : look === 'nest' ? { x, z, r: 14, c: FIRE, k: 1.6, core: 0.4 } : { x, z, r: 2.6 + Math.min(p.w, p.h) * 0.12, c: WIN, k: 0.42, core: 0.1, win: true, id: p.uid };
  });
  function lights(pools, lit, fl, cam) {
    for (const l of lamps) { if (Math.abs(l.x - cam.x) > 60 || Math.abs(l.z - cam.z) > 60) continue; pools.light(l.x, l.z, l.r, l.c, l.k * (l.win ? lit * fl(l.id) : 1), l.core); }
  }
  return { update: t => { update(t); if (homes.length) marks(); }, lights, repaint: () => { cx = NaN; } };
}
