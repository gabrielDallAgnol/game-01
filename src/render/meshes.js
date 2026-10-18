// Low-poly mesh builders. Everything is flat-shaded boxes, cones and cylinders.
/* global THREE */

const matCache = new Map();
export function mat(c) {
  if (!matCache.has(c)) matCache.set(c, new THREE.MeshStandardMaterial({ color: new THREE.Color(c).convertSRGBToLinear(), flatShading: true, roughness: 0.95, metalness: 0 }));
  return matCache.get(c);
}
export const windowMat = () => (windowMat.m ||= new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xffb24a, emissiveIntensity: 0, flatShading: true }));
export const torchMat = () => (torchMat.m ||= new THREE.MeshStandardMaterial({ color: 0xffb24a, emissive: 0xff9a2a, emissiveIntensity: 0.4 }));
export const eyeMat = () => (eyeMat.m ||= new THREE.MeshStandardMaterial({ color: 0xd8ff6a, emissive: 0xc8ff4a, emissiveIntensity: 1.2 }));
export const redEyeMat = () => (redEyeMat.m ||= new THREE.MeshStandardMaterial({ color: 0xff6a4a, emissive: 0xff3a2a, emissiveIntensity: 1.4 }));

const shadow = m => { m.castShadow = true; m.receiveShadow = true; return m; };
export function box(w, h, d, c, x = 0, y = 0, z = 0) { const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c) : c)); m.position.set(x, y, z); return m; }
export function cyl(rt, rb, h, seg, c, x = 0, y = 0, z = 0) { const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? mat(c) : c)); m.position.set(x, y, z); return m; }
export function cone(r, h, seg, c, x = 0, y = 0, z = 0) { const m = shadow(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c))); m.position.set(x, y, z); return m; }

/** one palisade post, joined to its neighbours. links: which sides (e, w, s, n) hold another post or a tower */
export function wallMesh(level, links) {
  const g = new THREE.Group(), dirs = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };
  if (level === 1) {
    const wood = 0x7a5636, dark = 0x5a4030;
    g.add(cyl(0.16, 0.19, 1.35, 5, wood, 0, 0.67, 0)); g.add(cone(0.18, 0.3, 5, wood, 0, 1.49, 0));
    for (const [k, [dx, dz]] of Object.entries(dirs)) {
      if (!links[k]) continue;
      const hh = 1.15 + (k.charCodeAt(0) % 3) * 0.08;
      g.add(cyl(0.15, 0.17, hh, 5, wood, dx * 0.36, hh / 2, dz * 0.36)); g.add(cone(0.16, 0.28, 5, wood, dx * 0.36, hh + 0.14, dz * 0.36));
      const rail = box(dx ? 0.5 : 0.1, 0.1, dz ? 0.5 : 0.1, dark, dx * 0.25, 0.72, dz * 0.25); g.add(rail);
    }
  } else {
    const stone = 0x9a9586, cap = 0x8a8578;
    g.add(box(0.78, 1.35, 0.78, stone, 0, 0.675, 0));
    for (const [k, [dx, dz]] of Object.entries(dirs)) if (links[k]) g.add(box(dx ? 0.52 : 0.7, 1.3, dz ? 0.52 : 0.7, stone, dx * 0.26, 0.65, dz * 0.26));
    g.add(box(0.5, 0.32, 0.5, cap, 0, 1.5, 0));
    if (level >= 3) { g.add(cyl(0.04, 0.04, 1.0, 4, 0x3d3027, 0.2, 2.0, 0.2)); g.add(box(0.04, 0.3, 0.45, 0xeaa441, 0.2, 2.35, 0.42)); }
  }
  return g;
}

export function buildingMesh(type, level) {
  if (level >= 3) {
    const g = buildingMesh(type, 2), h = { house: 3.3, farm: 1.7, tower: 5.7, wall: 2.4 }[type];
    g.add(cyl(0.04, 0.04, 1.2, 4, 0x3d3027, 0.75, h, 0.55)); g.add(box(0.05, 0.36, 0.6, 0xeaa441, 0.75, h + 0.4, 0.86));
    if (type === 'tower') g.add(cyl(0.5, 0.5, 0.25, 6, 0xd8b04a, 0, 4.0, 0));
    return g;
  }
  const g = new THREE.Group();
  if (type === 'house') {
    const h = level === 1 ? 1.1 : 1.75;
    g.add(box(1.7, h, 1.5, 0xd9c6a1, 0, h / 2, 0));
    g.add(box(1.76, 0.12, 1.56, 0x6b4a2c, 0, h * 0.55, 0));
    const roof = cone(1.45, 1.0, 4, 0xa4492f, 0, h + 0.5, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.9; g.add(roof);
    g.add(box(0.36, 0.34, 0.05, windowMat(), -0.42, h * 0.62, 0.76));
    g.add(box(0.36, 0.34, 0.05, windowMat(), 0.42, h * 0.62, -0.76));
    g.add(box(0.42, 0.62, 0.05, 0x5a3b22, 0.4, 0.31, 0.76));
    if (level === 2) { g.add(box(0.3, 0.9, 0.3, 0x8a8578, 0.5, h + 0.65, -0.3)); g.add(box(0.36, 0.34, 0.05, windowMat(), -0.42, h * 0.25, 0.76)); }
  } else if (type === 'farm') {
    g.add(box(2.1, 0.09, 2.0, 0x86643a, 0, 0.045, 0));
    const rows = level === 1 ? 4 : 5, col = level === 1 ? 0xcfae47 : 0xe0be4f;
    for (let k = 0; k < rows; k++) { const x = -0.8 + k * (1.6 / (rows - 1)); g.add(box(0.22, level === 1 ? 0.3 : 0.42, 1.7, col, x, 0.2, 0)); }
    for (let k = -1; k <= 1; k += 2) { g.add(box(2.2, 0.08, 0.06, 0x6b4a2c, 0, 0.4, k * 1.05)); g.add(box(0.08, 0.5, 0.08, 0x5a4030, -1.08, 0.25, k * 1.05)); g.add(box(0.08, 0.5, 0.08, 0x5a4030, 1.08, 0.25, k * 1.05)); }
    if (level === 2) g.add(cyl(0.38, 0.45, 0.6, 8, 0xd9b75a, 0.8, 0.4, 0.75));
  } else if (type === 'tower') {
    const h = level === 1 ? 2.6 : 3.5;
    g.add(cyl(0.68, 0.85, h, 6, 0x8f8c80, 0, h / 2, 0));
    g.add(cyl(0.98, 0.98, 0.28, 6, 0x6b4a2c, 0, h + 0.14, 0));
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.add(box(0.12, 0.4, 0.12, 0x5a4030, Math.cos(a) * 0.88, h + 0.48, Math.sin(a) * 0.88)); }
    g.add(cone(1.08, 0.9, 6, level === 1 ? 0x4b5a6a : 0x7a2f2a, 0, h + 1.15, 0));
    g.add(box(0.14, 0.22, 0.14, torchMat(), 0, h * 0.75, 0.78));
  } else if (type === 'wall') {
    if (level === 1) {
      for (let k = 0; k < 13; k++) { const x = -2.4 + k * 0.4; const hh = 1.25 + ((k * 7) % 3) * 0.08; g.add(cyl(0.17, 0.19, hh, 5, 0x7a5636, x, hh / 2, 0)); g.add(cone(0.19, 0.32, 5, 0x7a5636, x, hh + 0.16, 0)); }
      g.add(box(5, 0.12, 0.12, 0x5a4030, 0, 0.75, 0.17));
    } else {
      g.add(box(5, 1.35, 0.8, 0x9a9586, 0, 0.675, 0));
      for (let k = 0; k < 7; k++) g.add(box(0.42, 0.32, 0.85, 0x8a8578, -2.2 + k * 0.73, 1.5, 0));
    }
  }
  return g;
}

export function keepMesh() {
  const g = new THREE.Group();
  g.add(box(3.4, 2.2, 3.4, 0x9a9586, 0, 1.1, 0));
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => g.add(box(0.7, 0.5, 0.7, 0x8a8578, a * 1.5, 2.45, b * 1.5)));
  g.add(box(1.7, 2.0, 1.7, 0xa8a293, 0, 3.2, 0));
  const roof = cone(1.45, 1.5, 4, 0x3f5a7a, 0, 4.95, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
  g.add(cyl(0.04, 0.04, 1.4, 4, 0x3d3027, 0, 6.3, 0));
  g.add(box(0.06, 0.4, 0.7, 0xeaa441, 0, 6.75, 0.35));
  g.add(box(0.8, 1.2, 0.06, 0x4a3220, 0, 0.6, 1.72));
  g.add(box(0.4, 0.5, 0.06, windowMat(), 0, 3.4, 0.86)); g.add(box(0.4, 0.5, 0.06, windowMat(), 0, 3.4, -0.86));
  g.add(box(0.14, 0.26, 0.14, torchMat(), -0.7, 1.4, 1.78)); g.add(box(0.14, 0.26, 0.14, torchMat(), 0.7, 1.4, 1.78));
  return g;
}

export function nestMesh(rand) {
  const g = new THREE.Group();
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(2.6, 18), mat(0x4a3d2e)); dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.03; dirt.receiveShadow = true; g.add(dirt);
  for (let k = 0; k < 6; k++) {
    const a = rand() * Math.PI * 2, r = 0.6 + rand() * 1.7;
    const st = box(0.42, 0.62, 0.13, 0x7a7c72, Math.cos(a) * r, 0.27, Math.sin(a) * r);
    st.rotation.set((rand() - 0.5) * 0.35, rand() * 3, (rand() - 0.5) * 0.3); g.add(st);
  }
  const t = new THREE.Group(); t.add(cyl(0.1, 0.16, 2.2, 5, 0x3d3027, 0, 1.1, 0));
  const br = cyl(0.05, 0.08, 1, 4, 0x3d3027, 0.28, 1.7, 0); br.rotation.z = -0.9; t.add(br);
  t.position.set(1.6, 0, -1.2); g.add(t);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 7, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xa8d65c, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  pillar.position.y = 3.5; pillar.visible = false; g.add(pillar); g.userData.pillar = pillar;
  return g;
}

// ---------- the dead ----------
const ZG = {};
function zg() {
  if (ZG.body) return ZG;
  ZG.body = new THREE.BoxGeometry(0.55, 0.7, 0.35); ZG.head = new THREE.BoxGeometry(0.4, 0.4, 0.4); ZG.arm = new THREE.BoxGeometry(0.14, 0.14, 0.62);
  ZG.leg = new THREE.BoxGeometry(0.18, 0.5, 0.18); ZG.eye = new THREE.BoxGeometry(0.08, 0.06, 0.02); ZG.ball = new THREE.IcosahedronGeometry(0.5, 0);
  return ZG;
}
const LOOK = {
  walker:    { skin: 0x88a86a, shirts: [0x56664a, 0x6b5a49, 0x4b5466, 0x6d6a55] },
  runner:    { skin: 0x9fb47c, shirts: [0x7a6a5a, 0x5a6a7a], lean: 0.35 },
  crawler:   { skin: 0x7d9a62, shirts: [0x3e3a34], crawl: true },
  brute:     { skin: 0x6c8c52, shirts: [0x5a3b2a] },
  spitter:   { skin: 0xb6c24a, shirts: [0x4d5a2a], sac: 0xc8e04a },
  bloater:   { skin: 0x8e7a9e, shirts: [0x6a5a6e], bloat: true },
  screamer:  { skin: 0xd8d2c0, shirts: [0x3a3440], armsUp: true },
  guardian:  { skin: 0x5e7a48, shirts: [0x2e2a26], red: true, bones: true },
  gravelord: { skin: 0x6a5a7e, shirts: [0x2a1e33], red: true, crown: true },
  risen:     { skin: 0xa0a898, shirts: [0x8a8070] },
};
export function mobMesh(kind, size, rand) {
  const G = zg(), L = LOOK[kind] || LOOK.walker;
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const shirt = mat(L.shirts[Math.floor(rand() * L.shirts.length)]), skin = mat(L.skin);
  const add = (geo, m, x, y, z) => { const o = shadow(new THREE.Mesh(geo, m)); o.position.set(x, y, z); b.add(o); return o; };
  if (L.crawl) {
    const body = add(G.body, shirt, 0, 0.32, 0); body.rotation.x = Math.PI / 2;
    add(G.head, skin, 0, 0.32, 0.55);
    for (const s of [-1, 1]) { const a = add(G.arm, skin, s * 0.32, 0.12, 0.3); a.rotation.y = s * 0.4; const l = add(G.arm, skin, s * 0.3, 0.12, -0.35); l.rotation.y = -s * 0.4; }
    const e1 = new THREE.Mesh(G.eye, eyeMat()); e1.position.set(-0.09, 0.36, 0.76); b.add(e1);
    const e2 = new THREE.Mesh(G.eye, eyeMat()); e2.position.set(0.09, 0.36, 0.76); b.add(e2);
  } else {
    add(G.leg, mat(0x3a3530), -0.13, 0.25, 0); add(G.leg, mat(0x3a3530), 0.13, 0.25, 0);
    if (L.bloat) { const ball = add(G.ball, skin, 0, 0.95, 0.05); ball.scale.set(1.1, 1.05, 1); }
    else add(G.body, shirt, 0, 0.85, 0);
    const head = add(G.head, skin, 0, 1.4, 0.04); head.rotation.z = (rand() - 0.5) * 0.4;
    if (L.armsUp) { const a1 = add(G.arm, skin, -0.34, 1.45, 0); a1.rotation.x = -1.4; const a2 = add(G.arm, skin, 0.34, 1.45, 0); a2.rotation.x = -1.4; }
    else { add(G.arm, skin, -0.34, 1.02, 0.28); add(G.arm, skin, 0.34, 1.0, 0.3); }
    const em = L.red ? redEyeMat() : eyeMat();
    const e1 = new THREE.Mesh(G.eye, em); e1.position.set(-0.09, 1.44, 0.25); b.add(e1);
    const e2 = new THREE.Mesh(G.eye, em); e2.position.set(0.09, 1.44, 0.25); b.add(e2);
    if (L.sac) add(G.ball, mat(L.sac), 0, 1.0, -0.3).scale.setScalar(0.55);
    if (L.lean) b.rotation.x = L.lean;
    if (L.bones) { add(G.arm, mat(0xd8d0bc), -0.38, 1.25, -0.05).rotation.z = 0.5; add(G.arm, mat(0xd8d0bc), 0.38, 1.25, -0.05).rotation.z = -0.5; }
    if (L.crown) for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; add(new THREE.ConeGeometry(0.06, 0.25, 4), mat(0xd8b04a), Math.cos(a) * 0.2, 1.72, Math.sin(a) * 0.2 + 0.04); }
  }
  b.scale.setScalar(size * 0.8);
  return { g, b };
}

// ---------- heroes ----------
export function heroMesh(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const cloth = { warrior: 0x2f5d8a, archer: 0x3d6b3a, steward: 0x5a3a72, merchant: 0x5a3a72 }[kind];
  const trim = { warrior: 0xd99a3a, archer: 0x8a6a3a, steward: 0xd8b04a, merchant: 0xd8b04a }[kind];
  body.add(box(0.2, 0.55, 0.22, 0x3b2f26, -0.15, 0.27, 0)); body.add(box(0.2, 0.55, 0.22, 0x3b2f26, 0.15, 0.27, 0));
  if (kind === 'steward' || kind === 'merchant') { body.add(cone(0.48, 1.0, 6, cloth, 0, 0.75, 0)); }
  body.add(box(0.64, 0.72, 0.42, cloth, 0, 0.9, 0));
  body.add(box(0.2, 0.72, 0.44, trim, 0, 0.9, 0));
  body.add(box(0.42, 0.42, 0.42, 0xe2b48c, 0, 1.5, 0));
  let weapon = new THREE.Group();
  if (kind === 'warrior') {
    body.add(box(0.48, 0.2, 0.48, 0x9aa3a8, 0, 1.76, 0));
    body.add(box(0.62, 0.85, 0.06, 0x7b2f2a, 0, 0.95, -0.24));
    weapon.position.set(0.44, 1.0, 0.05); weapon.add(box(0.08, 0.08, 1.0, 0xd8dde0, 0, 0, 0.55)); weapon.add(box(0.3, 0.08, 0.08, 0x6b4a2c, 0, 0, 0.06));
    body.add(box(0.08, 0.6, 0.5, 0x8a6a3a, -0.4, 1.0, 0.1));
  } else if (kind === 'archer') {
    body.add(cone(0.32, 0.4, 6, cloth, 0, 1.85, -0.04));
    weapon.position.set(0.42, 1.05, 0.1);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 4, 10, Math.PI), mat(0x6b4a2c)); bow.rotation.y = Math.PI / 2; weapon.add(bow);
    body.add(box(0.16, 0.6, 0.16, 0x6b4a2c, -0.2, 1.05, -0.28));
  } else {
    body.add(cyl(0.34, 0.34, 0.06, 8, 0x2a1e33, 0, 1.74, 0)); body.add(cyl(0.2, 0.22, 0.32, 8, 0x2a1e33, 0, 1.92, 0));
    weapon.position.set(0.38, 1.0, 0.18); weapon.add(box(0.36, 0.06, 0.28, 0xe8dcc0, 0, 0, 0));
  }
  body.add(weapon);
  body.scale.setScalar(0.72);
  const light = new THREE.PointLight(0xffb15a, 0, 11, 2); light.position.set(0, 2.4, 0.4); g.add(light);
  return { g, body, weapon, light };
}

export function chestMesh() {
  const g = new THREE.Group();
  g.add(box(0.7, 0.45, 0.48, 0x6b4a2c, 0, 0.25, 0)); g.add(box(0.74, 0.12, 0.52, 0xeaa441, 0, 0.42, 0)); g.add(box(0.12, 0.16, 0.06, 0xeaa441, 0, 0.3, 0.26));
  const l = new THREE.PointLight(0xffc35a, 1.2, 4, 2); l.position.y = 1; g.add(l);
  return g;
}

// ---------- sellswords, purses ----------
export function mercMesh() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(box(0.2, 0.55, 0.22, 0x3b2f26, -0.15, 0.27, 0)); body.add(box(0.2, 0.55, 0.22, 0x3b2f26, 0.15, 0.27, 0));
  body.add(box(0.64, 0.72, 0.42, 0x7a5a3a, 0, 0.9, 0));
  body.add(box(0.66, 0.16, 0.44, 0x4a3a2a, 0, 0.72, 0));
  body.add(box(0.42, 0.42, 0.42, 0xd8a882, 0, 1.5, 0));
  body.add(cone(0.34, 0.36, 6, 0x8a8f94, 0, 1.86, 0));
  const spear = new THREE.Group(); spear.position.set(0.42, 0.9, 0.1);
  spear.add(cyl(0.035, 0.035, 1.8, 4, 0x6b4a2c, 0, 0.3, 0)); spear.add(cone(0.08, 0.28, 4, 0xd8dde0, 0, 1.33, 0));
  body.add(spear); body.scale.setScalar(0.62);
  return { g, body, weapon: spear };
}
export function purseMesh() {
  const g = new THREE.Group();
  g.add(cyl(0.22, 0.26, 0.3, 7, 0x8a6a3a, 0, 0.18, 0)); g.add(cyl(0.1, 0.16, 0.1, 6, 0x6b4a2c, 0, 0.38, 0));
  const coin = cyl(0.13, 0.13, 0.04, 10, new THREE.MeshStandardMaterial({ color: 0xeaa441, emissive: 0xb8781a, emissiveIntensity: 0.6, flatShading: true }), 0.2, 0.42, 0); coin.rotation.z = 1.2; g.add(coin);
  return g;
}
export function flameMesh() {
  return new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 5), new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.85 }));
}
