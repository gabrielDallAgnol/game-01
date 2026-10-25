// Quarantine: chain-link fences where a district you hold meets a sealed one, and a banner over each scouted
// sealed district in its rarity colour.
/* global THREE */
import { N, idx, PASSABLE, LANDMARKS } from '../../sim/mapgen.js';
import { KITS, RARITY } from '../../content/districts.js';
import { K } from '../kit.js';

export function createFences(V) {
  const { S, map, world, fx, Wv } = V;
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
      const reg = map.regions[r]; sp.position.copy(Wv(reg.x, reg.y, 4)); sp.scale.set(5.6, 0.7, 1); sp.renderOrder = 8; fx.add(sp); banners.set(r, sp);
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
    const rd = V.rd;   // the routes' scratch Object3D (shared, as before the split)
    for (const src of meshes) {
      const im = new THREE.InstancedMesh(src.geometry, src.material, spots.length); im.castShadow = false; im.frustumCulled = false;   // spread over the map (and no shadow: far fences streak across the shadow map): never cull by the base shape
      spots.forEach(([x, y, ry], k) => { rd.position.copy(Wv(x, y)); rd.rotation.set(0, ry, 0); rd.scale.setScalar(1); rd.updateMatrix(); im.setMatrixAt(k, rd.matrix); });
      fenceMesh.add(im);
    }
    world.add(fenceMesh);
  }
  return { sync: syncFences };
}
