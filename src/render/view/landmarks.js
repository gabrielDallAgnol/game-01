// Landmarks and district sites: intact buildings to claim (the city's signature one rises above the shroud), their
// lot frames and icons, quiet quest marks (MAIN ones get markers.js's gold marker); and the (retired) scavenge-site caches.
/* global THREE */
import { LANDMARKS } from '../../sim/mapgen.js';
import { K, CFG } from '../kit.js';
import { lc } from './shared.js';

export function createLandmarks(V) {
  const { S, C, game, world, Wv, seenAt } = V;
  // ---------- scavenge sites: a cache of supplies at a doorway into the ruins ----------
  const diaGeo = new THREE.OctahedronGeometry(0.3, 0); diaGeo.scale(1, 1.5, 1);
  const diaGeoL = new THREE.OctahedronGeometry(0.4, 0); diaGeoL.scale(1, 1.5, 1); const diaWhite = new THREE.MeshBasicMaterial({ color: lc('#f4efe2').multiplyScalar(1.5) });
  // marker colour by distance: pale = your land, amber = next door, red = deep in the city
  const diaMats = ['#e8dcb0', '#f0a24a', '#e8553a'].map(c => new THREE.MeshBasicMaterial({ color: lc(c).multiplyScalar(1.7) })), diaMat = diaMats[1];
  const sites = [].map(st => {   // scavenging retired (supply drops replace it)
    const g = new THREE.Group(); g.position.copy(Wv(st.x, st.y)); g.rotation.y = st.face;
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
    market: ['#f0a040', '$'], clinic: ['#7fffd0', '✚'], radio: ['#7fd4ff', '◉'], eiffel: ['#f0b04a', '♛'], tvtower: ['#f0b04a', '♛'], christ: ['#f0b04a', '♛'], unknown: ['#8a8a8a', '?'],
    farmstead: ['#8fe36a', '❀'], lodge: ['#8fe36a', '❀'], lumber: ['#f0a040', '$'], quarry: ['#f0a040', '$'], cabin: ['#ff8ac0', '⌂'] };   // the wild sites (a hollow may have taken one)
  const iconMats = {};
  const iconMat = kind => { const [col, ch] = SITE_LOOK[kind] || SITE_LOOK.unknown; return iconMats[kind] || (iconMats[kind] = new THREE.SpriteMaterial({ map: K.textTex(ch, { w: 96, h: 96, size: 62, bg: '#101418', fg: col }), transparent: true, depthTest: false })); };
  function siteFrame(size, depth = size) {   // [area] depth: an engine building's frame is its own rectangle
    const g = new THREE.Group(), h = size / 2 + 0.55, hd = depth / 2 + 0.55, th = 0.2, mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
    for (const [x, z, w, d] of [[0, -hd, 2 * h + th, th], [0, hd, 2 * h + th, th], [-h, 0, th, 2 * hd], [h, 0, th, 2 * hd]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat); m.position.set(x, 0.07, z); g.add(m); }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(2 * h, 2 * hd), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.05; g.add(fill);
    g.userData = { mat, fill: fill.material }; return g;
  }
  const lmViews = S.landmarks.map(l => {
    const g = new THREE.Group(); g.position.copy(Wv(l.x, l.y)); g.rotation.y = Math.atan2(C - l.x, C - l.y);
    let m;
    if (l.kind === 'eiffel') m = eiffel(); else if (l.kind === 'tvtower') m = tvtower(); else if (l.kind === 'christ') m = christ();
    else if (l.engine) { m = new THREE.Group(); g.rotation.y = 0; }   // [area] the engine town draws the building itself (view/atoms.js)
    else m = siteModel(l.kind, l.size, l.id * 7);
    g.add(m);
    const pole = new THREE.Group(); pole.add(part(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), LMAT.iron, 0, 0.8, 0)); const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0.36, 1.35, 0); pole.add(flag);
    pole.position.set(l.size / 2 + 0.3, 0, 0); pole.visible = false; g.add(pole);
    const mark = new THREE.Mesh(diaGeoL, diaWhite); mark.position.y = l.kind === 'eiffel' || l.kind === 'tvtower' ? 2.5 : l.kind === 'christ' ? 6 : 3.2; g.add(mark);
    const frame = l.engine ? siteFrame(l.engine.w, l.engine.h) : siteFrame(l.size); frame.rotation.y = l.engine ? -l.engine.rot : -g.rotation.y; g.add(frame);   // [area] engine sites: their own rectangle
    const icon = new THREE.Sprite(iconMat(l.kind)); icon.scale.set(1.1, 1.1, 1); icon.position.y = mark.position.y + 1.1; icon.renderOrder = 9; g.add(icon);
    world.add(g); return { l, g, pole, flag, mark, m, kind: l.kind, frame, icon };
  });
  const ROT = new THREE.Color(0.58, 0.68, 0.5), ASH = new THREE.Color(0.3, 0.28, 0.26);   // [nests] tints: a building the rot took, and what the fire left
  // quest marks: a story quest at a site is MAIN (the gold marker in markers.js stands over it, so the diamond steps
  // aside); a site you opened yourself is OPTIONAL (the same small diamond as any place to claim, a touch brighter)
  function updateLandmarks(t) {
    const objs = (S.story && game.story && game.story() && game.story().objectives) ? game.story().objectives() : [];
    for (const v of lmViews) {
      if (v.kind !== v.l.kind && !v.l.engine) { v.g.remove(v.m); v.m = siteModel(v.l.kind, v.l.size, v.l.id * 7); v.g.add(v.m); v.kind = v.l.kind; v.icon.material = iconMat(v.l.kind); }
      const locked = game.siteLock && game.siteLock(v.l.id) >= 0;   // [nests] a living hive guards it: a dull red frame, no claim marker
      { const open = !S.sealed[v.l.region] && !v.l.stripped && v.l.kind !== 'unknown', col = v.l.owned ? '#d9843a' : locked ? '#8a3a30' : (SITE_LOOK[v.l.kind] || SITE_LOOK.unknown)[0], U = v.frame.userData;
        v.frame.visible = open; v.icon.visible = open && !v.l.owned;
        if (open) { U.mat.color.copy(lc(col)).multiplyScalar(v.l.owned ? 1.2 : locked ? 1 : 1.6 + 0.4 * Math.sin(t * 3 + v.l.id)); U.fill.color.copy(lc(col)); U.fill.opacity = v.l.owned ? 0.06 : 0.12; } }
      const main = objs.some(q => q.site === v.l.id && q.priority === 'main'), opt = !main && objs.some(q => q.site === v.l.id);
      v.g.visible = (LANDMARKS[v.l.kind].signature && S.act !== 1) || seenAt(v.l.x, v.l.y); v.pole.visible = v.l.owned;
      v.mark.visible = !main && !v.l.owned && !v.l.stripped && v.l.kind !== 'unknown' && S.phase === 'day' && !S.sealed[v.l.region] && (!locked || opt);
      v.mark.scale.setScalar(opt ? 0.9 + Math.sin(t * 3) * 0.06 : 0.75);
      if (v.mark.visible) { v.mark.rotation.y = t; } if (v.l.owned) v.flag.rotation.y = Math.sin(t * 2 + v.l.id) * 0.3;
      // [nests] begin: a building a hollow took is rot-dark while the hive lives, scorched once it burns, itself again once claimed
      if (v.nestR === undefined) { const reg = V.map.regions.find(r => r.nest && r.nest.site === v.l.id); v.nestR = reg ? reg.id : -1; }
      if (v.nestR >= 0) {
        const look = S.nestAlive[v.nestR] ? 'rot' : v.l.owned ? '' : 'ash';
        if (look !== (v.look || '')) {
          if (!v.orig) { v.orig = new Map(); v.m.traverse(o => { if (o.isMesh && o.material && o.material.color) v.orig.set(o, o.material); }); }
          for (const [o, mt] of v.orig) { if (!look) { o.material = mt; continue; } const c = mt.clone(); c.color.multiply(look === 'rot' ? ROT : ASH); o.material = c; }
          v.look = look;
        }
      }
      // [nests] end
      if (v.l.stripped && !v.gutted) { v.gutted = true; v.m.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.45); } }); }
    }
  }
  return { sites, updateSites, update: updateLandmarks };
}
