// Hollowmere city kit — refined low-poly modern ruins (ported from concept/kit.js).
/* global THREE */
// Units: metres. Every builder returns a THREE.Group with its origin at ground centre; front faces +z.
// lite: cheaper bevels for the live game. hiveGlow: hive effect strength.
export const CFG = { lite: true, hiveGlow: 1, eyeScale: 1 };
export const K = (() => {
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

  // ---------- palette: one dusty-concrete family, one warm accent, one toxic accent ----------
  const P = {
    asphalt: '#393836', asphalt2: '#3d3c39', paint: '#aaa392', sidewalk: '#6f6b63', curb: '#878277', tile: '#625e57', wildwalk: '#5f5d53',
    bone: '#cbc3b2', sand: '#b3aa97', stone: '#9a917f', pale: '#d8d1c2', grey: '#8a8780', dark: '#5f5b53',
    slab: '#8d8678', rebar: '#4a423a', soot: '#34312c', glass: '#3c454a', frame: '#6c665b', shutter: '#7b7d79',
    roof: '#6c675e', roof2: '#5b564e', tar: '#4c4a45', gravel: '#77726a',
    olive: '#6c7350', olive2: '#545b3d', moss: '#7c7f55', dry: '#88836a', bark: '#5b4a3a',
    rust: '#6f5545', metal: '#6e7173', steel: '#8d9194', tyre: '#2b2a28', bag: '#a7976d', wood: '#94714e', wood2: '#7a5c40',
    amber: '#c9702e', amberDeep: '#9e5426', canvas: '#d9c9a3', lit: '#ffc070',
    skin: '#c99b7a', cloth1: '#55606a', cloth2: '#6b5d4c', cloth3: '#3f4447',
    zskin: '#8e957c', zcloth: '#5e5f58', zcloth2: '#6e675b', toxic: '#b4ff4e', hive: '#8fff3a', danger: '#d5513d', blood: '#5a3a30',
  };

  // territory tint: every surface outside your land is drawn cooler, darker and desaturated.
  // A 128×128 mask texture (1 = claimed, one texel per cell) is sampled in world space by every standard material.
  const MS = 128, maskData = new Uint8Array(MS * MS * 4);
  const maskTex = new THREE.DataTexture(maskData, MS, MS, THREE.RGBAFormat);
  maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter; maskTex.needsUpdate = true;
  const T = { mask: { value: maskTex }, off: { value: 32 }, amount: { value: 0.8 }, dark: { value: 0.7 } };
  // R = your land, G = explored (the shroud is black where G = 0)
  function setMask(fn, n = 64, seen = null) { T.off.value = n / 2; for (let y = 0; y < MS; y++) for (let x = 0; x < MS; x++) { const inMap = x < n && y < n, v = inMap && fn(x, y) ? 255 : 0, k = (y * MS + x) * 4; maskData[k] = maskData[k + 2] = v; maskData[k + 1] = !seen || (inMap && seen(x, y)) ? 255 : 0; maskData[k + 3] = 255; } maskTex.needsUpdate = true; }
  function territory(m) {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { tMask: T.mask, tOff: T.off, tAmount: T.amount, tDark: T.dark });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTWorld;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vec4 tw = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  tw = instanceMatrix * tw;\n  #endif\n  vTWorld = (modelMatrix * tw).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTWorld; uniform sampler2D tMask; uniform float tOff, tAmount, tDark;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  float own = texture2D(tMask, (vTWorld.xz + tOff) / 128.0).r;
  float wild = (1.0 - smoothstep(0.25, 0.75, own)) * tAmount;
  vec3 c = gl_FragColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 cool = mix(vec3(l), c, 0.45) * vec3(0.9, 0.97, 1.08) * tDark;
  gl_FragColor.rgb = mix(c, cool, wild);
  float seen = texture2D(tMask, (vTWorld.xz + tOff) / 128.0).g;
  // unexplored: the land shows through, grey and dim, like a map not yet walked
  float lit = smoothstep(0.15, 0.85, seen); float gl = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb = mix(vec3(gl) * vec3(0.78, 0.84, 0.95) * 0.5, gl_FragColor.rgb, lit);`);
    };
    m.customProgramCacheKey = () => 'territory';
    return m;
  }
  // shared materials the renderer animates by night: lit windows and searchlight lenses
  const WIN = new THREE.MeshStandardMaterial({ color: lin('#3c454a'), roughness: 0.4, emissive: lin('#ffb45c'), emissiveIntensity: 0 });
  const LENS = new THREE.MeshStandardMaterial({ color: lin('#d8d1c2'), roughness: 0.3, emissive: lin('#fff1d0'), emissiveIntensity: 0.2 });
  const mats = new Map();
  function M(key, o = {}) {
    const id = key + JSON.stringify(o);
    if (mats.has(id)) return mats.get(id);
    const hex = P[key] || key;
    const m = new THREE.MeshStandardMaterial({ color: lin(hex), roughness: o.rough ?? 0.86, metalness: o.metal ?? 0, flatShading: !!o.flat, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true });
    if (o.emissive) { m.emissive = lin(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (!o.emissive) territory(m);
    mats.set(id, m); return m;
  }

  // ---------- seeded randomness ----------
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- geometry builder: collects pieces per material, merges at the end ----------
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const gcache = new Map();
  function rboxGeo(w, h, d, r) {
    r = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
    const round = r > 0.0015 && !(CFG.lite && Math.min(w, h, d) < 0.35);
    if (!gcache.has(key)) { const g0 = round ? new THREE.RoundedBoxGeometry(w, h, d, CFG.lite ? 1 : 2, r) : new THREE.BoxGeometry(w, h, d); gcache.set(key, g0.index ? g0.toNonIndexed() : g0); }
    return gcache.get(key);
  }
  class B {
    constructor() { this.parts = new Map(); this.extra = []; }
    geo(mat, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE); tmpS.set(sx, sy, sz); tmpP.set(x, y, z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      const gg = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(tmpM);
      if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
      for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
      const key = typeof mat === 'string' ? mat : mat.uuid;
      if (!this.parts.has(key)) this.parts.set(key, { mat: typeof mat === 'string' ? M(mat) : mat, list: [] });
      this.parts.get(key).list.push(gg);
      return this;
    }
    // a bevelled box standing on y (bottom), centred on x/z
    box(mat, w, h, d, x = 0, y = 0, z = 0, o = {}) { return this.geo(mat, rboxGeo(w, h, d, o.r ?? 0.035), x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0); }
    // a box centred on (x, y, z)
    cbox(mat, w, h, d, x, y, z, o = {}) { return this.geo(mat, rboxGeo(w, h, d, o.r ?? 0.03), x, y, z, o.rx || 0, o.ry || 0, o.rz || 0); }
    cyl(mat, rt, rb, h, x, y, z, o = {}) { return this.geo(mat, new THREE.CylinderGeometry(rt, rb, h, o.seg || 10, 1, !!o.open), x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0); }
    sph(mat, r, x, y, z, o = {}) { return this.geo(mat, new THREE.IcosahedronGeometry(r, o.detail ?? 2), x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1); }
    add(obj) { this.extra.push(obj); return this; }
    build(o = {}) {
      const g = new THREE.Group();
      for (const { mat, list } of this.parts.values()) {
        const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(list, false);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = o.cast ?? !mat.transparent; mesh.receiveShadow = true;
        g.add(mesh);
      }
      for (const e of this.extra) g.add(e);
      return g;
    }
  }

  // ---------- small helpers ----------
  function place(obj, x, y, z, ry = 0, s = 1) { obj.position.set(x, y, z); obj.rotation.y = ry; obj.scale.setScalar(s); return obj; }
  function textTex(text, o = {}) {
    const c = document.createElement('canvas'); c.width = o.w || 512; c.height = o.h || 128;
    const x = c.getContext('2d'); x.fillStyle = o.bg || '#2a2a28'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = o.fg || '#d8d1c2'; x.font = `${o.weight || 700} ${o.size || 72}px ${o.font || 'Arial Narrow, Arial, sans-serif'}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (o.spacing) x.letterSpacing = o.spacing;
    x.fillText(text, c.width / 2, c.height / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function sign(text, w, h, o = {}) {
    const m = new THREE.MeshStandardMaterial({ map: textTex(text, o), roughness: 0.8 });
    if (o.glow) { m.emissive = lin(o.glow); m.emissiveMap = m.map; m.emissiveIntensity = o.ei ?? 1.5; }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
  }
  function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = radialTex();
  function glowDecal(color, r, intensity = 1) {
    const m = new THREE.MeshBasicMaterial({ map: glowTex, color: lin(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 3; return mesh;
  }
  function glowSprite(color, size, intensity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lin(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  }

  // ======================================================================
  // CITY: apartment blocks, ruined or whole, with recessed windows
  // ======================================================================
  /**
   * apartment({ w, d, floors, color, ruin 0..1, seed, shop, burnt, vines, roofStuff })
   * Built bay by bay: a recessed core with piers, spandrels and slab bands in front, so windows have real depth.
   */
  function apartment(o = {}) {
    const r = rng(o.seed || 1), b = new B();
    b._wall = o.color || 'bone';
    const w = o.w || 12, d = o.d || 10, floors = o.floors || 5, fh = o.fh || 3.1, gh = o.shop === false ? fh : 3.8;
    const wall = o.color || 'bone', trim = o.trim || 'stone', ruin = o.ruin || 0;
    const nb = Math.max(2, Math.round(w / 2.6)), bw = w / nb;
    const nd = Math.max(2, Math.round(d / 2.8)), dw = d / nd;
    // bay heights: a ruined block loses its upper floors unevenly, mostly from one corner
    const corner = r() < 0.5 ? 0 : nb - 1;
    const bayFloors = [];
    for (let i = 0; i < nb; i++) {
      let f = floors;
      if (ruin > 0) { const dist = Math.abs(i - corner) / Math.max(1, nb - 1); const loss = ruin * floors * (1 - dist * 0.85) * (0.55 + r() * 0.6); f = Math.max(1, Math.round(floors - loss)); }
      bayFloors.push(f);
    }
    const inset = 0.28;
    const topOf = f => gh + (f - 1) * fh;     // height of the top of floor f (1 = ground)
    // core
    for (let i = 0; i < nb; i++) {
      const x = -w / 2 + bw * (i + 0.5), top = topOf(bayFloors[i]);
      b.box(wall, bw + 0.01, top, d - inset * 2, x, 0, 0, { r: 0.02 });
    }
    // facades front/back
    for (const side of [1, -1]) {
      const z = side * (d / 2 - inset / 2);
      for (let i = 0; i < nb; i++) {
        const x0 = -w / 2 + bw * i, xc = x0 + bw / 2, nf = bayFloors[i];
        // ground floor: shopfront on the front of a shop block
        if (o.shop !== false && side === 1) {
          b.cbox('glass', bw - 0.5, 2.4, 0.08, xc, 1.35, d / 2 - inset + 0.02, { r: 0.01 });
          b.cbox(trim, bw - 0.46, 0.12, 0.3, xc, 0.06, d / 2 - inset + 0.1, { r: 0.02 });          // step
          b.cbox(trim, bw, 0.9, inset + 0.1, xc, 3.15, z + 0.04, { r: 0.03 });                       // fascia
          if (o.shutters && r() < 0.6) { const sh = 0.6 + r() * 1.6; b.cbox('shutter', bw - 0.55, sh, 0.06, xc, 2.55 - sh / 2, d / 2 - inset + 0.07, { r: 0.01 }); }
        } else windowsRow(b, xc, z, side, bw, gh * 0.5, 1.2, 1.5, o.burnt && r() < 0.3);
        // upper floors
        for (let f = 2; f <= nf; f++) {
          const y0 = topOf(f - 1);
          windowsRow(b, xc, z, side, bw, y0 + 1.05, 1.15, 1.55, o.burnt && r() < 0.35, r() < (o.balcony ?? 0.0) && side === 1);
        }
        // piers
        b.box(trim === 'stone' ? wall : wall, 0.36, topOf(nf), inset + 0.04, x0 + 0.18, 0, z, { r: 0.04 });
        if (i === nb - 1) b.box(wall, 0.36, topOf(nf), inset + 0.04, x0 + bw - 0.18, 0, z, { r: 0.04 });
        // slab bands at each floor line
        for (let f = 1; f < nf; f++) b.cbox(trim, bw + 0.02, 0.22, inset + 0.14, xc, topOf(f), z + side * 0.05, { r: 0.04 });
      }
    }
    // side facades (fewer windows)
    for (const side of [1, -1]) {
      const bay = side === 1 ? nb - 1 : 0, nf = bayFloors[bay], x = side * (w / 2 - inset / 2);
      for (let j = 0; j < nd; j++) {
        const zc = -d / 2 + dw * (j + 0.5);
        for (let f = 2; f <= nf; f++) if ((j + f) % 2 === 0) sideWindow(b, x, zc, side, topOf(f - 1) + 1.05);
        b.box(wall, inset + 0.04, topOf(nf), 0.4, x, 0, -d / 2 + dw * j + 0.2, { r: 0.04 });
      }
      b.box(wall, inset + 0.04, topOf(nf), 0.4, x, 0, d / 2 - 0.2, { r: 0.04 });
      b.box(wall, inset, topOf(nf), d - 0.2, x - side * 0.02, 0, 0, { r: 0.02 });
      for (let f = 1; f < nf; f++) b.cbox(trim, inset + 0.14, 0.22, d + 0.02, x + side * 0.05, topOf(f), 0, { r: 0.04 });
    }
    // roofs and broken tops
    for (let i = 0; i < nb; i++) {
      const x = -w / 2 + bw * (i + 0.5), top = topOf(bayFloors[i]), whole = bayFloors[i] === floors;
      if (whole) {
        b.cbox('roof', bw + 0.02, 0.18, d + 0.04, x, top + 0.09, 0, { r: 0.02 });
        b.cbox('gravel', bw - 0.5, 0.02, d - 0.9, x, top + 0.19, 0, { r: 0.005 });
        if (r() < 0.35) b.cbox('glass', 1.0, 0.12, 1.4, x + (r() - 0.5), top + 0.24, (r() - 0.5) * (d - 3), { r: 0.03 });
        b.box(trim, bw + 0.02, 0.55, 0.22, x, top, d / 2 - 0.1, { r: 0.04 }); b.box(trim, bw + 0.02, 0.55, 0.22, x, top, -d / 2 + 0.1, { r: 0.04 });
        if (i === 0) b.box(trim, 0.22, 0.55, d, -w / 2 + 0.1, top, 0, { r: 0.04 });
        if (i === nb - 1) b.box(trim, 0.22, 0.55, d, w / 2 - 0.1, top, 0, { r: 0.04 });
      } else {
        // broken top: a jagged slab edge with rebar, and a stub of wall
        const sl = 0.24, over = 0.35 + r() * 0.6;
        b.cbox('slab', bw * (0.6 + r() * 0.5), sl, d * (0.5 + r() * 0.4), x + (r() - 0.5) * 0.6, top + 0.02, (r() - 0.5) * 1.2, { r: 0.02, rz: (r() - 0.5) * 0.08, rx: (r() - 0.5) * 0.06 });
        for (let k = 0; k < 4; k++) b.cyl('rebar', 0.025, 0.025, 0.4 + r() * 0.9, x + (r() - 0.5) * bw * 0.9, top, (r() > 0.5 ? 1 : -1) * (d / 2 - 0.3), { seg: 4, rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6 });
        const stubH = fh * (0.3 + r() * 0.7);
        b.box(wall, 0.36, stubH, inset + 0.04, x - bw / 2 + 0.18, top, d / 2 - inset / 2, { r: 0.04, rz: (r() - 0.5) * 0.05 });
        if (r() < 0.6) b.cbox('slab', bw * 0.7, sl, 1.4 + r(), x + (r() - 0.5), top + over * 0.4, d / 2 + 0.2, { r: 0.02, rx: 0.25 + r() * 0.3 });
        // soot on what's left
        b.cbox('soot', bw * 0.8, 0.9, 0.04, x, top - 0.5, d / 2 + 0.02, { r: 0.01 });
      }
    }
    if (o.roofStuff !== false && bayFloors.every(f => f === floors)) roofClutter(b, w, d, topOf(floors), r);
    else if (o.roofStuff !== false) { const i = bayFloors.indexOf(floors); if (i >= 0) { const x = -w / 2 + bw * (i + 0.5); b.box('stone', 1.2, 0.8, 1.0, x, topOf(floors) + 0.18, 0, { r: 0.08 }); } }
    // rubble where floors came down
    if (ruin > 0) {
      const lost = bayFloors.reduce((a, f) => a + floors - f, 0);
      rubble(b, (corner === 0 ? -w / 2 + 2 : w / 2 - 2), d / 2 + 2.2, 1.6 + lost * 0.25, Math.round(14 + lost * 5), r, wall);
      if (r() < 0.6) rubble(b, (corner === 0 ? -w / 2 - 1.2 : w / 2 + 1.2), 0, 1.4 + lost * 0.15, 10 + lost * 2, r, wall);
    }
    // overgrowth climbing the walls
    if (o.vines) {
      const leaf = [M('olive', { flat: true }), M('olive2', { flat: true }), M('moss', { flat: true })];
      for (let k = 0; k < o.vines; k++) {
        const x0 = -w / 2 + 0.6 + r() * (w - 1.2), hh = 2 + r() * (topOf(Math.min(...bayFloors)) * 0.8 - 2);
        // a creeper: dense at the foot, thinning as it climbs, wandering sideways
        let x = x0;
        for (let y = 0.2; y < hh; y += 0.45) {
          const t = y / hh, sz = (0.55 - t * 0.35) * (0.7 + r() * 0.6);
          x += (r() - 0.5) * 0.5;
          b.sph(leaf[Math.floor(r() * 3)], sz, x, y, d / 2 + 0.06, { detail: 0, sz: 0.35, ry: r() * 3 });
          if (r() < 0.5) b.sph(leaf[Math.floor(r() * 3)], sz * 0.7, x + (r() - 0.5) * 0.9, y + 0.2, d / 2 + 0.05, { detail: 0, sz: 0.35 });
        }
        for (let j = 0; j < 3; j++) b.sph(leaf[j], 0.45 + r() * 0.3, x0 + (r() - 0.5) * 1.4, 0.25, d / 2 + 0.4 + r() * 0.4, { detail: 1, sy: 0.6 });
      }
    }
    const g = b.build();
    g.userData.height = topOf(floors);
    return g;
  }
  function windowsRow(b, xc, z, side, bw, y, ww, wh, burnt, balcony) {
    ww = Math.min(ww * 1.22, bw - 0.7); wh *= 1.08;
    // spandrel below, lintel above (in the facade plane), glass set back with a slim frame
    b.cbox('glass', ww, wh, 0.06, xc, y + wh / 2, z - side * 0.12, { r: 0.01 });
    b.cbox('frame', 0.06, wh, 0.1, xc, y + wh / 2, z - side * 0.1, { r: 0.01 });                        // mullion
    b.cbox('stone', ww + 0.3, 0.09, 0.3, xc, y - 0.02, z + side * 0.06, { r: 0.03 });                     // sill
    const yb = y - 1.05 + 0.02;
    b.box(b._wall || 'bone', bw - 0.34, 1.05 - 0.04, 0.3, xc, yb, z, { r: 0.03 });                       // spandrel
    if (burnt) b.cbox('soot', ww + 0.2, 0.9, 0.03, xc, y + wh + 0.35, z + side * 0.16, { r: 0.01 });
    if (balcony) { b.cbox('stone', bw - 0.5, 0.14, 1.1, xc, y - 0.05, z + side * 0.6, { r: 0.04 }); for (let k = -1; k <= 1; k += 2) b.box('frame', 0.05, 0.95, 0.05, xc + k * (bw / 2 - 0.3), y, z + side * 1.1, { r: 0.01 }); b.cbox('frame', bw - 0.55, 0.05, 0.05, xc, y + 0.95, z + side * 1.1, { r: 0.01 }); }
  }
  function sideWindow(b, x, zc, side, y) { b.cbox('glass', 0.06, 1.5, 1.0, x - side * 0.12, y + 0.75, zc, { r: 0.01 }); b.cbox('stone', 0.3, 0.09, 1.2, x + side * 0.06, y - 0.02, zc, { r: 0.03 }); }
  function roofClutter(b, w, d, top, r) {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) { const x = (r() - 0.5) * (w - 3), z = (r() - 0.5) * (d - 3); b.box('steel', 1.1, 0.75, 0.8, x, top + 0.18, z, { r: 0.08 }); b.cbox('dark', 0.7, 0.04, 0.7, x, top + 0.95, z, { r: 0.01 }); }
    if (r() < 0.6) { const x = (r() - 0.5) * (w - 4), z = (r() - 0.5) * (d - 4); for (const [a, c] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box('metal', 0.08, 1.1, 0.08, x + a, top + 0.18, z + c, { r: 0.01 }); b.cyl('stone', 1.0, 1.0, 1.4, x, top + 1.25, z, { seg: 14 }); b.cyl('roof2', 0.15, 1.05, 0.4, x, top + 2.65, z, { seg: 14 }); }
    if (r() < 0.7) { const x = (r() - 0.5) * (w - 3); b.box('stone', 2.2, 2.4, 2.0, x, top + 0.18, -d / 2 + 1.8, { r: 0.06 }); }
  }
  function rubble(b, x, z, rad, n, r, wall = 'bone') {
    const cols = [wall, 'slab', 'stone', 'slab', 'dark'];
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, dd = Math.sqrt(r()) * rad, s = 0.25 + r() * 0.7 * (1 - dd / rad * 0.5);
      b.cbox(cols[k % cols.length], s * (1 + r()), s * 0.6, s * (0.8 + r()), x + Math.cos(a) * dd, s * 0.25 + (1 - dd / rad) * rad * 0.35 * r(), z + Math.sin(a) * dd, { r: 0.03, rx: r() * 3, ry: r() * 3, rz: r() * 3 });
    }
    for (let k = 0; k < n / 4; k++) { const a = r() * 6.28, dd = r() * rad; b.cyl('rebar', 0.02, 0.02, 0.6 + r(), x + Math.cos(a) * dd, 0.1, z + Math.sin(a) * dd, { seg: 4, rx: r() * 1.5, rz: r() * 1.5 }); }
  }

  // ======================================================================
  // STREETS: asphalt, sidewalks with curbs, markings, crossings, cracks
  // ======================================================================
  /** a whole grid of streets. blocks: [{x, z, w, d}] are the raised sidewalk islands. */
  function streets(o) {
    const b = new B(), r = rng(o.seed || 7);
    const W = o.W, D = o.D;
    b.cbox('asphalt', W, 0.1, D, 0, -0.05, 0, { r: 0.001 });
    for (const bl of o.blocks) {
      b.box('curb', bl.w, 0.16, bl.d, bl.x, 0, bl.z, { r: 0.05 });
      b.box(bl.ground || 'sidewalk', bl.w - 0.3, 0.17, bl.d - 0.3, bl.x, 0, bl.z, { r: 0.02 });
      // paving joints give the sidewalk scale
      if (!bl.ground) for (let k = -bl.w / 2 + 1.5; k < bl.w / 2; k += 1.5) { b.cbox('tile', 0.03, 0.01, 2.6, bl.x + k, 0.175, bl.z - bl.d / 2 + 1.5, { r: 0.001 }); b.cbox('tile', 0.03, 0.01, 2.6, bl.x + k, 0.175, bl.z + bl.d / 2 - 1.5, { r: 0.001 }); }
    }
    // lane markings: dashed centre lines on every street
    for (const s of o.lanes || []) {
      const len = s.len, n = Math.floor(len / 4.5);
      for (let k = 0; k < n; k++) {
        if (r() < 0.18) continue;                     // faded away
        const t = -len / 2 + (k + 0.5) * 4.5;
        if (s.axis === 'x') b.cbox('paint', 2.2, 0.012, 0.16, s.x + t, 0.006, s.z, { r: 0.001 });
        else b.cbox('paint', 0.16, 0.012, 2.2, s.x, 0.006, s.z + t, { r: 0.001 });
      }
    }
    for (const c of o.crossings || []) {
      for (let k = 0; k < 7; k++) {
        if (r() < 0.12) continue;
        const t = -3.6 + k * 1.2;
        if (c.axis === 'x') b.cbox('paint', 0.55, 0.012, 3.2, c.x + t, 0.006, c.z, { r: 0.001 });
        else b.cbox('paint', 3.2, 0.012, 0.55, c.x, 0.006, c.z + t, { r: 0.001 });
      }
    }
    // cracks and patches
    for (let k = 0; k < (o.cracks || 60); k++) {
      const x = (r() - 0.5) * W, z = (r() - 0.5) * D;
      if (r() < 0.5) b.cbox('asphalt2', 1 + r() * 3, 0.006, 0.8 + r() * 2, x, 0.003, z, { r: 0.001, ry: r() * 3 });
      else b.cbox('soot', 0.05, 0.008, 1 + r() * 2.5, x, 0.004, z, { r: 0.001, ry: r() * 3 });
    }
    for (const mh of o.manholes || []) b.cyl('dark', 0.35, 0.35, 0.02, mh[0], 0, mh[1], { seg: 16 });
    return b.build({ cast: false });
  }
  function weeds(o) {
    const b = new B(), r = rng(o.seed || 13), c = [M('olive', { flat: true }), M('olive2', { flat: true }), M('dry', { flat: true })];
    for (const [x0, z0, w, d, n] of o.patches) for (let k = 0; k < n; k++) b.sph(c[k % 3], 0.18 + r() * 0.3, x0 + (r() - 0.5) * w, 0.02, z0 + (r() - 0.5) * d, { detail: 0, sy: 0.45, ry: r() * 3 });
    return b.build();
  }
  function grass(o) {
    const b = new B(), r = rng(o.seed || 3);
    b.box(o.base || 'dry', o.w, 0.2, o.d, 0, 0, 0, { r: 0.04 });
    for (let k = 0; k < (o.n ?? 30); k++) { const x = (r() - 0.5) * (o.w - 0.6), z = (r() - 0.5) * (o.d - 0.6); b.sph(r() < 0.5 ? 'olive' : 'moss', 0.25 + r() * 0.35, x, 0.25, z, { detail: 1, sy: 0.5 }); }
    return b.build();
  }

  // ======================================================================
  // STREET FURNITURE & VEHICLES
  // ======================================================================
  function car(o = {}) {
    const r = rng(o.seed || 11), b = new B(), body = o.color || (['stone', 'grey', 'rust', 'pale', 'dark'][Math.floor(r() * 5)]);
    const L = 4.1, Wd = 1.8;
    b.box(body, L, 0.72, Wd, 0, 0.32, 0, { r: 0.22 });
    b.box(o.wreck ? 'glass' : 'glass', 2.2, 0.62, Wd - 0.16, -0.15, 0.95, 0, { r: 0.2 });
    b.box(body, 2.0, 0.08, Wd - 0.22, -0.2, 1.55, 0, { r: 0.04 });
    for (const sx of [-1, 1]) { b.box(body, 0.1, 0.62, 0.1, sx * 1.0 - 0.15, 0.95, Wd / 2 - 0.12, { r: 0.03 }); b.box(body, 0.1, 0.62, 0.1, sx * 1.0 - 0.15, 0.95, -Wd / 2 + 0.12, { r: 0.03 }); }
    b.cbox('dark', 0.1, 0.22, Wd - 0.3, L / 2 - 0.02, 0.62, 0, { r: 0.04 });
    b.cbox('pale', 0.06, 0.12, 0.3, L / 2, 0.75, 0.6, { r: 0.02 }); b.cbox('pale', 0.06, 0.12, 0.3, L / 2, 0.75, -0.6, { r: 0.02 });
    for (const [x, z] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) {
      if (o.wreck && r() < 0.25) continue;
      b.geo('tyre', new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), x, 0.34, z, Math.PI / 2, 0, 0);
    }
    if (o.wreck) { b.cbox('rust', 1.6, 0.5, 0.06, 0.3, 0.7, Wd / 2 + 0.4, { r: 0.02, ry: 0.5 }); b.cbox('soot', 1.4, 0.03, 1.2, -0.2, 1.6, 0, { r: 0.01 }); }
    const g = b.build();
    if (o.wreck) { g.rotation.z = (r() - 0.5) * 0.08; g.rotation.x = (r() - 0.5) * 0.06; g.position.y = -0.06; }
    const w = new THREE.Group(); w.add(g); return w;
  }
  function bus(o = {}) {
    const b = new B(), L = 11.5, Wd = 2.5, c = o.color || 'pale';
    b.box(c, L, 2.7, Wd, 0, 0.35, 0, { r: 0.28 });
    b.box('glass', L - 2.4, 1.05, Wd + 0.02, -0.4, 1.55, 0, { r: 0.12 });
    b.box('glass', 0.1, 1.4, Wd - 0.3, L / 2, 1.3, 0, { r: 0.04 });
    b.box(o.stripe || 'stone', L + 0.02, 0.28, Wd + 0.04, 0, 1.0, 0, { r: 0.1 });
    b.box('steel', 3.4, 0.35, 1.6, -2, 3.05, 0, { r: 0.1 });
    for (const x of [-3.8, 3.6]) for (const z of [-1.2, 1.2]) b.geo('tyre', new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), x, 0.5, z, Math.PI / 2, 0, 0);
    if (o.wreck) b.cbox('soot', 4, 0.03, 2.2, 1, 3.07, 0, { r: 0.01 });
    return b.build();
  }
  function container(o = {}) {
    const b = new B(), c = o.color || 'rust', L = o.L || 6.05, H = 2.6, Wd = 2.44;
    b.box(c, L, H, Wd, 0, 0, 0, { r: 0.04 });
    for (let k = 0; k < Math.round(L / 0.3); k++) { const x = -L / 2 + 0.15 + k * 0.3; b.box(c, 0.1, H - 0.3, Wd + 0.06, x, 0.15, 0, { r: 0.02 }); }
    b.box('dark', L + 0.04, 0.12, Wd + 0.04, 0, H - 0.12, 0, { r: 0.02 }); b.box('dark', L + 0.04, 0.14, Wd + 0.04, 0, 0, 0, { r: 0.02 });
    return b.build();
  }
  function sandbags(len, rows = 3, o = {}) {
    const b = new B(), r = rng(o.seed || 5);
    for (let y = 0; y < rows; y++) { const off = (y % 2) * 0.3, n = Math.floor((len - off) / 0.6); for (let k = 0; k < n; k++) b.box('bag', 0.62, 0.26, 0.4, -len / 2 + off + 0.3 + k * 0.6, y * 0.24, (r() - 0.5) * 0.05, { r: 0.11, ry: (r() - 0.5) * 0.12 }); }
    return b.build();
  }
  function jersey(len = 3.6, o = {}) {
    const s = new THREE.Shape(); s.moveTo(-0.32, 0); s.lineTo(0.32, 0); s.lineTo(0.3, 0.2); s.lineTo(0.12, 0.42); s.lineTo(0.1, 0.95); s.lineTo(-0.1, 0.95); s.lineTo(-0.12, 0.42); s.lineTo(-0.3, 0.2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: len - 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); g.translate(0, 0, -len / 2);
    const b = new B(); b.geo(o.color || 'pale', g, 0, 0, 0, 0, Math.PI / 2, 0);
    if (o.stripe) b.cbox(o.stripe, len - 0.3, 0.12, 0.25, 0, 0.6, 0, { r: 0.01 });
    return b.build();
  }
  function lamp(o = {}) {
    const b = new B();
    b.cyl('metal', 0.07, 0.1, 6, 0, 0, 0, { seg: 8 });
    b.cbox('metal', 1.4, 0.08, 0.1, 0.65, 5.95, 0, { r: 0.03 });
    b.cbox(o.lit ? M('pale', { emissive: '#ffd59a', ei: 3 }) : 'dark', 0.6, 0.12, 0.3, 1.3, 5.88, 0, { r: 0.05 });
    if (o.bent) { const g = b.build(); g.rotation.z = 0.28; return g; }
    const g = b.build();
    if (o.lit && o.light) { const l = new THREE.PointLight(lin('#ffcf8a'), o.light, o.dist || 18, 2); l.position.set(1.3, 5.6, 0); g.add(l); const sp = glowSprite('#ffd9a0', 1.6, 1.0); sp.position.set(1.3, 5.75, 0); g.add(sp); }
    return g;
  }
  function trafficLight(o = {}) {
    const b = new B();
    b.cyl('metal', 0.07, 0.08, 3.8, 0, 0, 0, { seg: 8 });
    b.box('dark', 0.35, 1.0, 0.3, 0, 3.0, 0.2, { r: 0.06 });
    for (let k = 0; k < 3; k++) b.cyl('tyre', 0.09, 0.09, 0.03, 0, 3.2 + k * 0.3, 0.36, { rx: Math.PI / 2, seg: 10 });
    const g = b.build(); if (o.bent) { g.rotation.z = 0.45; g.rotation.x = 0.1; } return g;
  }
  function busStop() {
    const b = new B();
    b.box('metal', 0.08, 2.4, 0.08, -1.6, 0, -0.6); b.box('metal', 0.08, 2.4, 0.08, 1.6, 0, -0.6);
    b.box('glass', 3.3, 2.0, 0.05, 0, 0.3, -0.62, { r: 0.01 }); b.cbox('steel', 3.6, 0.08, 1.5, 0, 2.45, -0.1, { r: 0.03 });
    b.box('wood', 2.4, 0.08, 0.4, 0, 0.45, -0.35, { r: 0.02 });
    return b.build();
  }
  function tree(o = {}) {
    const r = rng(o.seed || 9), b = new B(), h = o.h || 5 + r() * 2.5, dead = o.dead;
    b.cyl('bark', 0.12, 0.22, h * 0.55, 0, 0, 0, { seg: 7 });
    if (dead) { for (let k = 0; k < 4; k++) { const a = r() * 6.28; b.cyl('bark', 0.03, 0.07, 1.6 + r(), Math.cos(a) * 0.15, h * 0.4 + r() * 0.8, Math.sin(a) * 0.15, { seg: 5, rz: Math.cos(a) * 0.7, rx: Math.sin(a) * 0.7 }); } return b.build(); }
    const cols = ['olive', 'olive2', 'moss'].map(c => M(c, { flat: true }));
    for (let k = 0; k < (o.n || 5); k++) {
      const a = r() * 6.28, dd = r() * 1.0, s = 1.0 + r() * 0.9;
      b.sph(cols[k % 3], s, Math.cos(a) * dd, h * 0.62 + r() * h * 0.3, Math.sin(a) * dd, { detail: 1, sy: 0.85 });
    }
    return b.build();
  }
  function bush(o = {}) { const r = rng(o.seed || 4), b = new B(), c = [M('olive', { flat: true }), M('olive2', { flat: true })]; for (let k = 0; k < (o.n || 4); k++) { const a = r() * 6.28, dd = r() * 0.6; b.sph(c[k % 2], 0.4 + r() * 0.45, Math.cos(a) * dd, 0.3, Math.sin(a) * dd, { detail: 1, sy: 0.75 }); } return b.build(); }
  function barrelFire(o = {}) {
    const b = new B(); b.cyl('rust', 0.3, 0.3, 0.9, 0, 0, 0, { seg: 12 }); b.cyl('soot', 0.28, 0.28, 0.02, 0, 0.9, 0, { seg: 12 });
    const g = b.build();
    if (o.lit !== false) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 7), new THREE.MeshBasicMaterial({ color: lin('#ffb24d').multiplyScalar(4) })); fl.position.y = 1.2; g.add(fl);
      const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), new THREE.MeshBasicMaterial({ color: lin('#ffe1a0').multiplyScalar(6) })); fl2.position.set(0.06, 1.15, 0.04); g.add(fl2);
      const s = glowSprite('#ff9a3a', 2.6, 1.2); s.position.y = 1.2; g.add(s);
      if (o.light) { const l = new THREE.PointLight(lin('#ff9f45'), o.light, o.dist || 14, 2); l.position.y = 1.6; l.castShadow = !!o.shadow; if (o.shadow) { l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; } g.add(l); }
    }
    return g;
  }
  function pallet(b, x, y, z, ry = 0) { for (let k = 0; k < 4; k++) b.cbox('wood', 1.2, 0.04, 0.12, x + Math.cos(ry) * 0 , y + 0.02, z, { r: 0.01, ry }); }

  // ======================================================================
  // PLAYER BUILDINGS (warm accent = yours)
  // ======================================================================
  /** a two/three storey townhouse; level 0 = ruin to restore, 1 boarded, 2 repaired, 3 fortified */
  function townhouse(o = {}) {
    const lvl = o.level ?? 1, r = rng(o.seed || 21), b = new B();
    const w = o.w || 6.4, d = o.d || 7, floors = o.floors || (lvl >= 2 ? 3 : 2), fh = 2.9, wall = o.color || 'sand';
    const H = floors * fh;
    if (lvl === 0) {
      // the ruin you can restore: a burnt-out shell with jagged walls, charred joists and rubble inside
      const jag = (x0, z0, len, axis, hMax, hMin) => {
        const n = Math.round(len / 0.8);
        for (let k = 0; k < n; k++) { const t = -len / 2 + (k + 0.5) * len / n, h = hMin + (hMax - hMin) * Math.pow(r(), 0.7);
          if (axis === 'x') b.box(wall, len / n + 0.02, h, 0.3, x0 + t, 0, z0, { r: 0.03 }); else b.box(wall, 0.3, h, len / n + 0.02, x0, 0, z0 + t, { r: 0.03 }); }
      };
      jag(0, d / 2 - 0.15, w, 'x', fh * 1.9, fh * 0.9); jag(0, -d / 2 + 0.15, w, 'x', fh * 1.3, fh * 0.5);
      jag(-w / 2 + 0.15, 0, d, 'z', fh * 2.0, fh * 1.2); jag(w / 2 - 0.15, 0, d, 'z', fh * 1.1, fh * 0.3);
      for (const x of [-1.6, 1.6]) { b.cbox('soot', 1.1, 1.4, 0.32, x, 1.7, d / 2 - 0.15, { r: 0.01 }); b.cbox('soot', 1.3, 1.0, 0.04, x, 2.9, d / 2 + 0.02, { r: 0.01 }); }
      b.cbox('soot', 1.1, 2.1, 0.32, 0, 1.05, d / 2 - 0.15, { r: 0.01 });
      b.cbox('slab', w - 0.6, 0.22, d * 0.45, 0, fh, -d * 0.25, { r: 0.02, rx: 0.06 });
      for (let k = 0; k < 4; k++) b.cbox(k % 2 ? 'soot' : 'wood2', 0.14, 0.16, d * 0.8, -w / 2 + 1 + k * 1.4, fh * 1.25 + r() * 0.5, (r() - 0.5) * 0.6, { r: 0.02, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.2 });
      rubble(b, 0.5, 0.5, 2.4, 24, r, wall);
      const leaf = [M('olive', { flat: true }), M('olive2', { flat: true })];
      for (let k = 0; k < 14; k++) b.sph(leaf[k % 2], 0.35 + r() * 0.35, -w / 2 - 0.1 + r() * 0.4, r() * fh * 1.4, (r() - 0.5) * d, { detail: 0, sx: 0.4 });
      for (let k = 0; k < 6; k++) b.sph(leaf[k % 2], 0.5 + r() * 0.4, (r() - 0.5) * w * 1.2, 0.2, d / 2 + 0.6 + r(), { detail: 1, sy: 0.6 });
      return b.build();
    }
    b.box(wall, w, H, d, 0, 0, 0, { r: 0.05 });
    for (let f = 1; f < floors; f++) b.cbox('stone', w + 0.12, 0.18, d + 0.12, 0, f * fh, 0, { r: 0.04 });
    // pitched roof (extruded gable)
    const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.35, 0); s.lineTo(w / 2 + 0.35, 0); s.lineTo(0, 2.0); s.closePath();
    const rg = new THREE.ExtrudeGeometry(s, { depth: d + 0.5, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }); rg.translate(0, 0, -(d + 0.5) / 2);
    b.geo(lvl >= 2 ? 'roof2' : 'roof', rg, 0, H, 0);
    // front: windows per floor, door
    const cols = [-w / 2 + 1.3, 0, w / 2 - 1.3];
    for (let f = 0; f < floors; f++) for (let c = 0; c < 3; c++) {
      if (f === 0 && c === 1) continue;
      const x = cols[c], y = f * fh + 0.95, lit = lvl >= 2 && (o.night || o.game) && r() < 0.75;
      const glass = lit ? (o.game ? WIN : M('lit', { emissive: '#ffb45c', ei: 2.2 })) : 'glass';
      b.cbox(glass, 0.95, 1.3, 0.08, x, y + 0.65, d / 2 + 0.02, { r: 0.01 });
      b.cbox('stone', 1.2, 0.09, 0.22, x, y - 0.03, d / 2 + 0.08, { r: 0.02 });
      if (lvl === 1 || (lvl >= 3 && f === 0)) for (let k = 0; k < 3; k++) b.cbox('wood', 1.25, 0.18, 0.05, x, y + 0.25 + k * 0.42, d / 2 + 0.1, { r: 0.02, rz: (r() - 0.5) * 0.25 });
      // back windows
      b.cbox(glass, 0.95, 1.3, 0.08, x, y + 0.65, -d / 2 - 0.02, { r: 0.01 });
    }
    b.cbox('wood2', 1.1, 2.15, 0.1, 0, 1.08, d / 2 + 0.04, { r: 0.02 }); b.cbox('stone', 1.5, 0.15, 0.6, 0, 0.08, d / 2 + 0.3, { r: 0.03 });
    // yours: a warm awning over the door
    const aw = new THREE.Shape(); aw.moveTo(0, 0); aw.lineTo(1.1, 0); aw.lineTo(1.1, 0.06); aw.lineTo(0, 0.5); aw.closePath();
    const ag = new THREE.ExtrudeGeometry(aw, { depth: 1.9, bevelEnabled: false }); ag.translate(0, 0, -0.95);
    b.geo('amber', ag, 0, 2.35, d / 2 + 1.1, 0, -Math.PI / 2, 0);
    if (lvl === 1) {
      // tarp patching the roof, a ladder
      b.cbox('amber', w * 0.55, 0.05, 2.2, -w * 0.15, H + 0.9, d * 0.18, { r: 0.02, rz: 0.55 });
      for (let k = 0; k < 6; k++) b.cbox('wood', 0.5, 0.05, 0.05, w / 2 + 0.25, 0.3 + k * 0.45, d / 2 - 0.6, { r: 0.01 });
      b.box('wood', 0.05, 2.8, 0.05, w / 2 + 0.25, 0, d / 2 - 0.85); b.box('wood', 0.05, 2.8, 0.05, w / 2 + 0.25, 0, d / 2 - 0.35);
    }
    if (lvl >= 2) {
      // planters, a chimney, laundry
      for (const x of [-w / 2 + 1.3, w / 2 - 1.3]) { b.box('wood2', 1.2, 0.35, 0.35, x, 0, d / 2 + 0.35, { r: 0.04 }); b.sph('olive', 0.35, x - 0.3, 0.45, d / 2 + 0.35, { detail: 1 }); b.sph('olive2', 0.3, x + 0.25, 0.45, d / 2 + 0.35, { detail: 1 }); }
      b.box('stone', 0.6, 1.4, 0.6, w / 2 - 1.2, H + 0.6, -1.2, { r: 0.05 });
    }
    if (lvl >= 3) {
      // fortified: solar panels, water tank, rooftop lookout rail, steel door
      const slope = Math.atan2(2.0, w / 2 + 0.35);
      for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) {
        const along = 0.9 + j * 1.15, x = along * Math.cos(slope), y = H + 2.0 - along * Math.sin(slope) + 0.1;
        b.cbox(M('#2d3a48', { rough: 0.35 }), 1.05, 0.06, 1.5, x, y, -d / 2 + 1.3 + k * 1.6, { r: 0.02, rz: -slope });
      }
      // rooftop lookout on the -x slope with a rail
      b.box('wood', 2.0, 0.12, 2.0, -w / 2 + 1.4, H + 0.9, 1.5, { r: 0.02 });
      for (const [a, c] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) b.box('wood2', 0.08, 0.95, 0.08, -w / 2 + 1.4 + a, H + 1.0, 1.5 + c, { r: 0.01 });
      b.cbox('amber', 0.05, 0.6, 0.9, -w / 2 + 0.5, H + 2.5, 1.5, { r: 0.01 }); b.box('metal', 0.04, 2.6, 0.04, -w / 2 + 0.45, H + 0.9, 1.05);
      // steel shutters on the ground floor and a fenced yard
      for (const x of [-w / 2 + 1.3, w / 2 - 1.3]) b.cbox('steel', 1.2, 1.5, 0.08, x, 1.6, d / 2 + 0.12, { r: 0.02 });
      b.cyl('stone', 0.7, 0.7, 1.3, -w / 2 + 1.5, H + 0.6, -1.9, { seg: 14 }); b.cyl('amberDeep', 0.72, 0.72, 0.12, -w / 2 + 1.5, H + 1.9, -1.9, { seg: 14 });
      b.cbox('steel', 1.15, 2.1, 0.12, 0, 1.06, d / 2 + 0.07, { r: 0.02 });
    }
    const g = b.build();
    if (lvl >= 2 && o.night) { const l = new THREE.PointLight(lin('#ffb25a'), 0.9, 7, 2); l.position.set(0, 2.2, d / 2 + 1.6); g.add(l); }
    return g;
  }

  /** watchtower: 1 sniper platform on scaffolding, 2 timber tower with roof, 3 steel turret with searchlight */
  function tower(o = {}) {
    const lvl = o.level || 1, b = new B(), H = lvl === 1 ? 4.2 : lvl === 2 ? 6.4 : 7.2;
    if (lvl <= 2) {
      const sz = lvl === 1 ? 2.2 : 2.6, legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [a, c] of legs) b.box('steel', 0.09, H, 0.09, a * sz / 2, 0, c * sz / 2, { r: 0.02 });
      for (let y = 1.4; y < H; y += 1.4) { for (const [a, c] of [[0, 1], [0, -1]]) b.cbox('steel', sz, 0.06, 0.06, 0, y, c * sz / 2, { r: 0.01 }); for (const a of [1, -1]) b.cbox('steel', 0.06, 0.06, sz, a * sz / 2, y, 0, { r: 0.01 }); }
      for (let y = 0.2; y < H - 0.6; y += 1.4) b.cbox('steel', 0.05, 0.05, Math.hypot(sz, 1.4), sz / 2, y + 0.7, 0, { r: 0.01, rx: Math.atan2(1.4, sz) });
      b.box('wood', sz + 0.5, 0.12, sz + 0.5, 0, H, 0, { r: 0.02 });
      if (lvl === 1) { const sb = sandbags(sz + 0.4, 2); sb.position.set(0, H + 0.12, sz / 2 + 0.05); b.add(sb); const sb2 = sandbags(sz + 0.4, 2); sb2.position.set(sz / 2 + 0.05, H + 0.12, 0); sb2.rotation.y = Math.PI / 2; b.add(sb2); }
      else {
        for (const [a, c] of legs) b.box('wood', 0.1, 1.9, 0.1, a * (sz / 2 + 0.15), H + 0.12, c * (sz / 2 + 0.15), { r: 0.02 });
        for (const z of [-1, 1]) b.cbox('wood2', sz + 0.4, 0.9, 0.06, 0, H + 0.6, z * (sz / 2 + 0.2), { r: 0.02 });
        for (const x of [-1, 1]) b.cbox('wood2', 0.06, 0.9, sz + 0.4, x * (sz / 2 + 0.2), H + 0.6, 0, { r: 0.02 });
        const s = new THREE.Shape(); s.moveTo(-sz / 2 - 0.6, 0); s.lineTo(sz / 2 + 0.6, 0); s.lineTo(0, 1.0); s.closePath();
        const rg = new THREE.ExtrudeGeometry(s, { depth: sz + 1.0, bevelEnabled: false }); rg.translate(0, 0, -(sz + 1.0) / 2);
        b.geo('amberDeep', rg, 0, H + 2.0, 0);
        for (let k = 0; k < 7; k++) b.cbox('wood', 0.5, 0.05, 0.05, 0, 0.3 + k * 0.62, sz / 2 + 0.25, { r: 0.01 });
      }
    } else {
      // steel turret on a concrete base
      b.box('stone', 3.4, 2.2, 3.4, 0, 0, 0, { r: 0.12 });
      for (let k = 0; k < 4; k++) b.cbox('soot', 3.42, 0.08, 3.42, 0, 0.5 + k * 0.5, 0, { r: 0.02 });
      b.cyl('grey', 1.0, 1.25, H - 2.2, 0, 2.2, 0, { seg: 16 });
      for (let k = 0; k < 3; k++) b.cyl('dark', 1.07 + k * 0.03, 1.07 + k * 0.03, 0.08, 0, 3.0 + k * 1.2, 0, { seg: 16 });
      b.cyl('steel', 1.55, 1.3, 1.0, 0, H, 0, { seg: 8 });
      b.cyl('dark', 1.6, 1.6, 0.12, 0, H + 1.0, 0, { seg: 8 });
      b.cbox('dark', 0.5, 0.42, 0.9, 0, H + 0.55, 1.3, { r: 0.06 });
      b.cbox('dark', 0.14, 0.14, 1.7, 0.09, H + 0.6, 2.4, { r: 0.04 }); b.cbox('dark', 0.14, 0.14, 1.7, -0.09, H + 0.6, 2.4, { r: 0.04 });
      const sbt = sandbags(3.2, 2); sbt.position.set(0, 2.2, 1.55); b.add(sbt); const sbt2 = sandbags(3.2, 2); sbt2.position.set(1.55, 2.2, 0); sbt2.rotation.y = Math.PI / 2; b.add(sbt2);
      b.cyl('amber', 1.32, 1.32, 0.2, 0, H - 0.2, 0, { seg: 16 });
      // searchlight
      b.cyl('steel', 0.35, 0.42, 0.55, 0.9, H + 1.12, -0.5, { rx: -1.15, seg: 14 });
      b.cyl(o.game ? LENS : M('pale', { emissive: '#fff1d0', ei: o.night ? 6 : 0.2 }), 0.33, 0.33, 0.04, 0.9, H + 1.33, -0.12, { rx: -1.15, seg: 14 });
      // razor wire on the base
      for (let k = 0; k < 10; k++) b.geo('steel', new THREE.TorusGeometry(0.22, 0.015, 4, 10), -1.6 + k * 0.36, 2.35, 1.62, 0, 0.3, 0);
    }
    const g = b.build(); g.userData.top = H; return g;
  }

  /** barricades: 1 junk & chain-link, 2 wrecked cars + sandbags, 3 concrete T-walls + razor wire. len along x. */
  function barricade(o = {}) {
    const lvl = o.level || 1, len = o.len || 10, r = rng(o.seed || 31), g = new THREE.Group(), b = new B();
    if (lvl === 1) {
      // posts and a chain-link screen, stuffed with junk
      for (let x = -len / 2; x <= len / 2 + 0.01; x += 2.5) b.box('metal', 0.08, 2.2, 0.08, x, 0, 0, { r: 0.02 });
      b.cbox('metal', len, 0.05, 0.05, 0, 2.15, 0, { r: 0.01 });
      for (let k = 0; k < len / 1.1; k++) {
        const x = -len / 2 + 0.6 + k * 1.1 + (r() - 0.5) * 0.3, t = r();
        if (t < 0.3) b.box('wood', 1.2, 0.14, 1.0, x, 0, 0.6, { r: 0.02, rx: -0.9, ry: (r() - 0.5) * 0.4 });
        else if (t < 0.5) b.geo('tyre', new THREE.TorusGeometry(0.32, 0.14, 8, 14), x, 0.16, 0.6, Math.PI / 2, 0, 0);
        else if (t < 0.7) b.box('pale', 0.75, 1.6, 0.7, x, 0, 0.55, { r: 0.08, rz: (r() - 0.5) * 0.3 });
        else b.box('wood2', 1.0, 0.9, 0.6, x, 0, 0.5, { r: 0.04, ry: r() });
      }
      const fence = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.1), chainMat()); fence.position.set(0, 1.08, 0.02); g.add(fence);
    } else if (lvl === 2) {
      let x = -len / 2 + 2.1;
      while (x < len / 2 - 1.5) { const c = car({ wreck: true, seed: Math.floor(r() * 99), color: ['rust', 'stone', 'grey', 'dark'][Math.floor(r() * 4)] }); c.position.set(x, 0, 0); c.rotation.y = (r() - 0.5) * 0.25 + (r() < 0.3 ? Math.PI : 0); g.add(c); x += 4.3; }
      const sb = sandbags(len, 3); sb.position.set(0, 0, 1.4); g.add(sb);
    } else {
      for (let x = -len / 2 + 0.9; x < len / 2; x += 1.25) {
        b.box('pale', 1.2, 3.2, 0.32, x, 0.18, 0, { r: 0.05 });
        b.box('pale', 1.2, 0.36, 1.3, x, 0, 0, { r: 0.06 });
        b.cbox('stone', 1.16, 0.05, 0.34, x, 3.25, 0, { r: 0.01 });
      }
      for (let k = 0; k < len / 0.38; k++) b.geo('steel', new THREE.TorusGeometry(0.25, 0.012, 4, 10), -len / 2 + 0.2 + k * 0.38, 3.6, 0, 0, 0.35, 0);
      // a stencil band in your colour
      for (let x = -len / 2 + 0.9; x < len / 2; x += 2.5) b.cbox('amber', 1.0, 0.28, 0.04, x, 1.6, 0.18, { r: 0.01 });
    }
    g.add(b.build()); return g;
  }
  /** one barricade post for the game: a 2.2 m cell, joined toward linked sides (links: {e,w,s,n}). */
  function post(level, links, seed = 1) {
    const b = new B(), r = rng(seed), g = new THREE.Group(), half = 1.1;
    const dirs = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };
    const sides = Object.keys(dirs).filter(k => links[k]);
    if (!sides.length) sides.push('e', 'w');
    if (level === 1) {
      b.box('metal', 0.09, 2.0, 0.09, 0, 0, 0, { r: 0.02 });
      for (const k of sides) {
        const [dx, dz] = dirs[k];
        b.cbox('metal', dx ? half : 0.05, 0.05, dz ? half : 0.05, dx * half / 2, 1.95, dz * half / 2, { r: 0.01 });
        const f = new THREE.Mesh(new THREE.PlaneGeometry(half, 1.9), chainMat()); f.position.set(dx * half / 2, 0.97, dz * half / 2); f.rotation.y = dx ? 0 : Math.PI / 2; g.add(f);
        const t = r();
        if (t < 0.3) b.box('wood', 0.9, 0.12, 0.8, dx * 0.55, 0, dz * 0.55 + (dx ? 0.45 : 0), { r: 0.02, rx: -0.8 });
        else if (t < 0.55) b.geo('tyre', new THREE.TorusGeometry(0.3, 0.13, 6, 12), dx * 0.5 + (dz ? 0.45 : 0), 0.14, dz * 0.5 + (dx ? 0.45 : 0), Math.PI / 2, 0, 0);
        else if (t < 0.7) b.box('pale', 0.7, 1.5, 0.6, dx * 0.55 + (dz ? 0.4 : 0), 0, dz * 0.55 + (dx ? 0.4 : 0), { r: 0.08, rz: (r() - 0.5) * 0.3 });
      }
    } else if (level === 2) {
      for (const k of sides) {
        const [dx, dz] = dirs[k];
        for (let row = 0; row < 4; row++) for (let q = 0; q < 2; q++) {
          const t = (q + 0.5 + (row % 2) * 0.25) * half / 2.2;
          b.box('bag', dx ? 0.6 : 0.42, 0.27, dz ? 0.6 : 0.42, dx * t, row * 0.25, dz * t, { r: 0.1, ry: (r() - 0.5) * 0.15 });
        }
      }
      b.box('bag', 0.62, 1.0, 0.62, 0, 0, 0, { r: 0.12 });
      b.cbox('rust', 0.06, 1.6, 1.0, 0, 1.4, 0, { r: 0.01, ry: r() * 3, rz: 0.1 });
    } else {
      for (const k of sides) {
        const [dx, dz] = dirs[k];
        b.box('pale', dx ? half : 0.34, 3.0, dz ? half : 0.34, dx * half / 2, 0.2, dz * half / 2, { r: 0.05 });
        b.box('pale', dx ? half : 1.2, 0.36, dz ? half : 1.2, dx * half / 2, 0, dz * half / 2, { r: 0.06 });
        for (let q = 0; q < 3; q++) b.geo('steel', new THREE.TorusGeometry(0.24, 0.012, 4, 10), dx * (q + 0.5) * half / 3, 3.45, dz * (q + 0.5) * half / 3, 0, dx ? 0.35 : Math.PI / 2 + 0.35, 0);
        b.cbox('amber', dx ? 0.7 : 0.04, 0.26, dz ? 0.7 : 0.04, dx * half / 2, 1.5, dz * half / 2 + (dx ? 0.18 : 0), { r: 0.01 });
      }
      b.box('stone', 0.5, 3.3, 0.5, 0, 0, 0, { r: 0.05 });
    }
    g.add(b.build());
    return g;
  }
  let chainCache = null;
  function chainMat() {
    if (chainCache) return chainCache;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.strokeStyle = 'rgba(150,152,150,0.95)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 7);
    chainCache = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
    return chainCache;
  }

  /** farms: 1 raised beds in a park, 2 beds + polytunnel + water, 3 greenhouse + wind pump */
  function farm(o = {}) {
    const lvl = o.level || 1, b = new B(), r = rng(o.seed || 41), w = o.w || 9, d = o.d || 8;
    b.box('dry', w, 0.18, d, 0, 0, 0, { r: 0.04 });
    const beds = lvl === 1 ? 3 : 4;
    for (let k = 0; k < beds; k++) {
      const z = -d / 2 + 1.2 + k * ((d - 2.4) / (beds - 1)), bw2 = lvl === 3 ? w * 0.4 : w - 1.6, x = lvl === 3 ? -w * 0.25 : 0;
      b.box('wood2', bw2, 0.45, 1.2, x, 0.18, z, { r: 0.04 });
      b.box('tar', bw2 - 0.2, 0.05, 1.0, x, 0.6, z, { r: 0.01 });
      for (let c = 0; c < Math.floor(bw2 / 0.45); c++) b.sph(k % 2 ? 'olive' : 'moss', 0.17 + r() * 0.08, x - bw2 / 2 + 0.3 + c * 0.45, 0.78, z + (r() - 0.5) * 0.3, { detail: 1, sy: 0.8 });
    }
    if (lvl >= 2) {
      for (let k = 0; k < 3; k++) b.cyl('amberDeep', 0.35, 0.35, 0.95, w / 2 - 0.6, 0.18, -d / 2 + 0.7 + k * 0.8, { seg: 12 });
      // polytunnel or greenhouse
      if (lvl === 2) {
        const tg = new THREE.CylinderGeometry(1.4, 1.4, 4.2, 14, 1, true, 0, Math.PI); const g = new THREE.Mesh(tg, M('canvas', { opacity: 0.85, side: THREE.DoubleSide }));
        g.rotation.z = Math.PI / 2; g.rotation.y = Math.PI / 2; g.position.set(-w / 2 + 2.0, 0.18, d / 2 - 1.6); g.castShadow = true; g.receiveShadow = true; b.add(g);
      }
    }
    if (lvl === 3) {
      const gx = w * 0.2, gw = w * 0.5, gd = d - 1.2;
      b.box('steel', gw, 0.3, gd, gx, 0.18, 0, { r: 0.02 });
      for (let k = 0; k <= 4; k++) { const z = -gd / 2 + k * gd / 4; b.box('steel', 0.06, 2.0, 0.06, gx - gw / 2, 0.48, z, { r: 0.01 }); b.box('steel', 0.06, 2.0, 0.06, gx + gw / 2, 0.48, z, { r: 0.01 }); }
      const glass = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.05, 2.0, gd - 0.05), M('#cfe3d6', { opacity: 0.32, rough: 0.15, depthWrite: false })); glass.position.set(gx, 1.48, 0); b.add(glass);
      const s = new THREE.Shape(); s.moveTo(-gw / 2, 0); s.lineTo(gw / 2, 0); s.lineTo(0, 1.1); s.closePath();
      const rg = new THREE.ExtrudeGeometry(s, { depth: gd, bevelEnabled: false }); rg.translate(0, 0, -gd / 2);
      const roof = new THREE.Mesh(rg, M('#cfe3d6', { opacity: 0.38, rough: 0.15, depthWrite: false })); roof.position.set(gx, 2.48, 0); b.add(roof);
      for (let k = 0; k < 6; k++) b.sph('olive', 0.35, gx + (r() - 0.5) * (gw - 1), 0.75, (r() - 0.5) * (gd - 1), { detail: 1 });
      // wind pump
      b.box('steel', 0.1, 6, 0.1, -w / 2 + 1, 0.18, d / 2 - 1, { r: 0.02 });
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; b.cbox('amber', 0.12, 1.3, 0.04, -w / 2 + 1 + Math.sin(a) * 0.65, 6.0 + Math.cos(a) * 0.65, d / 2 - 0.9, { r: 0.01, rz: -a }); }
    }
    return b.build();
  }

  /** the keep: 1 a bus and tarps around a fire, 2 a depot walled with containers, 3 + radio mast and searchlight */
  function keep(o = {}) {
    const lvl = o.level || 1, g = new THREE.Group(), b = new B(), night = !!o.night;
    // forecourt slab
    b.box('tile', 22, 0.12, 18, 0, 0, 0, { r: 0.05 });
    for (let k = -9; k <= 9; k += 3) b.cbox('paint', 0.12, 0.01, 4.5, k, 0.125, -5.2, { r: 0.001 });
    const bs = bus({ color: 'pale', stripe: 'amber' }); bs.position.set(-3, 0.12, 3.6); bs.rotation.y = 0.12; g.add(bs);
    // tarp shelter off the bus
    const tarp = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.2, 6, 4), M('canvas', { side: THREE.DoubleSide }));
    const pa = tarp.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, -Math.sin((pa.getX(i) / 6 + 0.5) * Math.PI) * 0.25);
    tarp.geometry.computeVertexNormals(); tarp.rotation.x = -Math.PI / 2 + 0.28; tarp.position.set(-2.6, 2.7, -0.9); tarp.castShadow = true; tarp.receiveShadow = true; g.add(tarp);
    for (const x of [-5.4, 0.2]) b.box('wood', 0.1, 2.2, 0.1, x, 0.12, -2.9, { r: 0.02 });
    const f = barrelFire({ light: night ? 3.2 : 0, dist: 16, shadow: night }); f.position.set(3.2, 0.12, -1.2); g.add(f);
    // crates, a table, bedrolls
    for (let k = 0; k < 4; k++) b.box('wood2', 0.9, 0.7, 0.7, 6.5 + (k % 2) * 1.0, 0.12 + Math.floor(k / 2) * 0.7, 4.5, { r: 0.04 });
    b.box('wood', 2.0, 0.08, 0.9, 2.5, 0.92, 3.0, { r: 0.02 }); for (const [x, z] of [[1.6, 2.6], [3.4, 2.6], [1.6, 3.4], [3.4, 3.4]]) b.box('wood', 0.07, 0.8, 0.07, x, 0.12, z);
    b.box('amberDeep', 1.9, 0.18, 0.8, -1.2, 0.12, -2.2, { r: 0.08 }); b.box('canvas', 1.9, 0.18, 0.8, -3.6, 0.12, -2.0, { r: 0.08, ry: 0.2 });
    if (lvl >= 2) {
      // containers as walls, a gate, a lookout on top
      const spots = [[-9.5, -4, Math.PI / 2], [-9.5, 2.2, Math.PI / 2], [9.5, -4, Math.PI / 2], [9.5, 2.2, Math.PI / 2], [-6, 8.4, 0], [6, 8.4, 0], [-6.6, -8.4, 0], [6.6, -8.4, 0]];
      const cols = ['rust', 'grey', 'stone', 'grey', 'dark', 'grey', 'rust', 'stone'];
      spots.forEach(([x, z, ry], k) => { const c = container({ color: cols[k] }); c.position.set(x, 0.12, z); c.rotation.y = ry; g.add(c); });
      const c2 = container({ color: 'amberDeep' }); c2.position.set(-6, 2.72, 8.4); g.add(c2);
      sandbagsInto(g, 0, 0.12, -8.6, 4.0);
      for (const x of [-1.8, 1.8]) { const j = jersey(2.2, { color: 'pale' }); j.position.set(x * 1.4, 0.12, -9.2); g.add(j); }
    }
    if (lvl >= 3) {
      // radio mast with a searchlight and a flag
      const m = new B(), H = 18;
      for (const [a, c] of [[-0.6, -0.6], [0.6, -0.6], [0, 0.6]]) m.box('steel', 0.1, H, 0.1, 6 + a * (1 - 0) , 0.12, 2 + c, { r: 0.02 });
      for (let y = 1; y < H; y += 1.5) m.cbox('steel', 1.3, 0.05, 0.05, 6, y, 1.4, { r: 0.01, ry: y % 3 ? 0.5 : -0.5 });
      m.cbox('amber', 1.6, 0.4, 0.05, 6, H - 1, 2.3, { r: 0.01 });
      m.cyl('steel', 0.35, 0.42, 0.55, 6, H - 3.5, 2.0, { rx: -1.1, seg: 14 });
      m.cyl(o.game ? LENS : M('pale', { emissive: '#fff1d0', ei: night ? 6 : 0.2 }), 0.33, 0.33, 0.04, 6, H - 3.25, 2.42, { rx: -1.1, seg: 14 });
      g.add(m.build());
      const dish = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), M('pale', { side: THREE.DoubleSide })); dish.position.set(5.2, H - 5, 2.6); dish.rotation.x = 1.2; dish.castShadow = true; g.add(dish);
    }
    g.add(b.build());
    return g;
  }
  function sandbagsInto(g, x, y, z, len, ry = 0) { const s = sandbags(len, 3); s.position.set(x, y, z); s.rotation.y = ry; g.add(s); return s; }

  // ======================================================================
  // HIVES (nests): landmark buildings the dead pour out of
  // ======================================================================
  function hiveFx(g, x, y, z, r, night) {
    const f = CFG.hiveGlow ?? 1;
    const d = glowDecal('#8fff3a', r * 1.6, (night ? 1.4 : 0.55) * f); d.position.set(x, y + 0.02, z); g.add(d);
    if (night) { const l = new THREE.PointLight(lin('#8fff3a'), 2.4 * f, r * 3.5, 2); l.position.set(x, y + 2.5, z); g.add(l); }
    for (let k = 0; k < 7; k++) { const s = glowSprite('#9dff4a', 3 + k * 0.6, (night ? 0.35 : 0.14) * f); s.position.set(x + Math.cos(k * 2.1) * r * 0.5, y + 1 + k * 0.7, z + Math.sin(k * 2.1) * r * 0.5); g.add(s); }
  }
  function hospital(o = {}) {
    const g = new THREE.Group();
    const a = apartment({ w: 22, d: 13, floors: 5, color: 'pale', trim: 'stone', ruin: o.cleared ? 0.15 : 0.35, seed: 77, shop: false, burnt: !o.cleared, roofStuff: true });
    g.add(a);
    const s = sign('HOSPITAL', 7, 1.2, { bg: '#e7e1d3', fg: o.cleared ? '#c0782a' : '#3c4a2f', size: 84 }); s.position.set(0, 3.0, 6.62); g.add(s);
    const cross = new B(); cross.cbox(o.cleared ? 'amber' : 'danger', 1.6, 0.5, 0.1, -5.5, 3.0, 6.6, { r: 0.02 }); cross.cbox(o.cleared ? 'amber' : 'danger', 0.5, 1.6, 0.1, -5.5, 3.0, 6.6, { r: 0.02 }); g.add(cross.build());
    // entrance canopy and ambulances
    const c = new B(); c.cbox('pale', 8, 0.35, 4, 0, 3.0, 8.6, { r: 0.08 }); for (const x of [-3.6, 3.6]) c.box('pale', 0.3, 2.85, 0.3, x, 0, 10.3, { r: 0.04 }); g.add(c.build());
    for (const [x, ry] of [[-2, 0.3], [3.2, -0.5]]) { const am = car({ color: 'pale', wreck: !o.cleared, seed: 3 }); am.scale.set(1.25, 1.4, 1.15); am.position.set(x, 0, 12.5); am.rotation.y = ry; g.add(am); }
    if (!o.cleared) hiveFx(g, 0, 0, 9.5, 5, o.night);
    return g;
  }
  function metro(o = {}) {
    const g = new THREE.Group(), b = new B();
    b.box('stone', 7.5, 0.3, 4.6, 0, 0, 0, { r: 0.05 });
    b.cbox('dark', 3.0, 0.5, 4.0, 0, 0.1, 0.2, { r: 0.02 });
    for (let k = 0; k < 7; k++) b.box('slab', 2.8, 0.2, 0.42, 0, -0.1 - k * 0.0, 2.0 - k * 0.55, { r: 0.02, rx: 0 });
    for (const x of [-1.7, 1.7]) { b.box('metal', 0.06, 1.0, 0.06, x, 0.3, 2.2); b.box('metal', 0.06, 1.0, 0.06, x, 0.3, -2.0); b.cbox('steel', 0.08, 0.08, 4.4, x, 1.3, 0.1, { r: 0.02 }); b.box('pale', 0.3, 1.0, 4.4, x * 1.25, 0.3, 0.1, { r: 0.04 }); }
    b.box('metal', 0.14, 3.6, 0.14, 2.9, 0.3, 2.0, { r: 0.03 });
    g.add(b.build());
    const s = sign('M', 1.1, 1.1, { bg: o.cleared ? '#c0782a' : '#203018', fg: o.cleared ? '#fff3dc' : '#b4ff4e', size: 96, w: 128, h: 128, glow: o.cleared ? null : '#8fff3a', ei: o.night ? 3 : 1 });
    s.position.set(2.9, 4.3, 2.08); g.add(s);
    if (!o.cleared) { hiveFx(g, 0, 0.3, 0.6, 3.6, o.night); const pit = glowDecal('#b4ff4e', 1.6, (o.night ? 3 : 1.4) * (CFG.hiveGlow ?? 1)); pit.position.set(0, 0.35, -0.5); g.add(pit); }
    return g;
  }
  function petrol(o = {}) {
    const g = new THREE.Group(), b = new B();
    b.box('tile', 16, 0.12, 12, 0, 0, 0, { r: 0.05 });
    for (const x of [-4, 4]) { b.box('pale', 0.5, 4.6, 0.5, x, 0.12, 0, { r: 0.05 }); b.box('pale', 1.0, 1.25, 0.6, x, 0.12, 2.2, { r: 0.08 }); b.cbox('dark', 0.6, 0.4, 0.62, x, 1.0, 2.2, { r: 0.03 }); }
    b.cbox('pale', 13, 0.7, 8, 0, 5.05, 0.6, { r: 0.1 }); b.cbox(o.cleared ? 'amber' : 'stone', 13.04, 0.25, 8.04, 0, 4.85, 0.6, { r: 0.02 });
    const shop = new B(); shop.box('sand', 7, 3.4, 4, 3, 0.12, -6.5, { r: 0.05 }); shop.cbox('glass', 4, 2, 0.08, 3, 1.4, -4.48, { r: 0.01 }); g.add(shop.build());
    g.add(b.build());
    if (!o.cleared) { const c = car({ wreck: true, seed: 8 }); c.position.set(-1, 0.12, 2.5); c.rotation.y = 1.4; g.add(c); hiveFx(g, 0, 0.12, 0, 4.5, o.night); }
    return g;
  }
  function police(o = {}) {
    const g = new THREE.Group();
    g.add(apartment({ w: 16, d: 11, floors: 3, color: 'stone', trim: 'sand', ruin: o.cleared ? 0 : 0.25, seed: 55, shop: false, burnt: !o.cleared }));
    const s = sign('POLICE', 5, 1.0, { bg: '#2f3536', fg: o.cleared ? '#e19f3a' : '#a9b2b5', size: 80 }); s.position.set(0, 4.6, 5.53); g.add(s);
    const b = new B(); b.box('stone', 6, 0.5, 2, 0, 0, 6.8, { r: 0.05 }); for (const x of [-2.5, 2.5]) b.box('metal', 0.1, 6, 0.1, x, 0, 7.2); g.add(b.build());
    for (const [x, ry] of [[-4.5, 0.4], [4.8, -0.3]]) { const c = car({ color: 'dark', wreck: !o.cleared, seed: 12 }); c.position.set(x, 0, 9); c.rotation.y = ry; g.add(c); }
    if (!o.cleared) hiveFx(g, 0, 0, 8.5, 4.5, o.night);
    return g;
  }

  // ======================================================================
  // PEOPLE & THE DEAD — a jointed rig with tapered limbs, ~1.8 m, 7.5 heads
  // ======================================================================
  // pose angles: rotation.x < 0 swings a limb forward; rotation.z swings an arm out to the side
  function limb(mat, len, r0, r1) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 12, 1), mat); c.position.y = -len / 2; g.add(c);
    const a = new THREE.Mesh(new THREE.SphereGeometry(r0, 12, 8), mat); g.add(a);
    const b = new THREE.Mesh(new THREE.SphereGeometry(r1, 12, 8), mat); b.position.y = -len; g.add(b);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
  }
  function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; return m; }
  /**
   * rig({ outfit, pose, bw (body width), bh (height), belly, eyes, props })
   * outfit: { top, sleeve, legs, boots, skin, hair, hood, cap, pack, vest, coat }
   * pose: { lean, twist, neck, head, sL:[x,y,z], sR, eL, eR, hL:[x,z], hR, kL, kR, crouch }
   */
  function rig(o = {}) {
    const F = o.outfit || {}, P = o.pose || {}, bw = o.bw || 1, bh = o.bh || 1;
    const m = k => typeof k === 'object' ? k : M(k || 'cloth1');
    const top = m(F.top || 'cloth1'), sleeve = m(F.sleeve || F.top || 'cloth1'), legs = m(F.legs || 'cloth3'), boots = m(F.boots || 'tyre'), skin = m(F.skin || 'skin');
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const thigh = 0.42 * bh, shin = 0.41 * bh, hipH = thigh + shin + 0.07;
    const hips = new THREE.Group(); hips.position.y = hipH; body.add(hips);
    hips.add(mesh(new THREE.CylinderGeometry(0.15 * bw, 0.14 * bw, 0.18, 12), legs, 0, 0, 0, 1, 1, 0.68));
    // spine & chest: a tapered barrel, flattened front to back
    const spine = new THREE.Group(); spine.position.y = 0.06; spine.rotation.x = P.lean || 0; spine.rotation.y = P.twist || 0; hips.add(spine);
    const chestH = 0.56 * bh;
    spine.add(mesh(new THREE.CylinderGeometry(0.2 * bw, 0.155 * bw, chestH, 14), top, 0, chestH / 2, 0, 1, 1, 0.64 * (o.chestDepth || 1)));
    spine.add(mesh(new THREE.CylinderGeometry(0.16 * bw, 0.155 * bw, 0.1, 14), top, 0, -0.02, 0, 1, 1, 0.7));
    spine.add(mesh(new THREE.SphereGeometry(0.19 * bw, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), top, 0, chestH, 0, 1.05, 0.38, 0.64));
    if (o.belly) spine.add(mesh(new THREE.SphereGeometry(0.2 * o.belly, 16, 12), m(F.belly || F.top || 'zcloth'), 0, 0.2, 0.06, 1, 0.9, 0.9));
    if (F.vest) spine.add(mesh(new THREE.CylinderGeometry(0.205 * bw, 0.17 * bw, chestH * 0.62, 14), m(F.vest), 0, chestH * 0.55, 0, 1, 1, 0.66));
    if (F.coat) spine.add(mesh(new THREE.CylinderGeometry(0.17 * bw, 0.21 * bw, 0.42, 14, 1, true), m(F.coat), 0, -0.12, 0, 1, 1, 0.7));
    if (F.pack) { const pk = new THREE.Group(); pk.position.set(0, chestH * 0.55, -0.16 * bw); pk.add(mesh(new THREE.BoxGeometry(0.32, 0.42, 0.18), m(F.pack))); pk.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 10), m('canvas'), 0, 0.25, 0, 1, 1, 1)); pk.children[1].rotation.z = Math.PI / 2; spine.add(pk); }
    // neck & head
    const neck = new THREE.Group(); neck.position.y = chestH + 0.02; neck.rotation.x = P.neck || 0; spine.add(neck);
    neck.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 10), skin, 0, 0.05, 0));
    const head = new THREE.Group(); head.position.y = 0.12; head.rotation.x = P.head || 0; head.rotation.z = P.headTilt || 0; neck.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.105, 16, 12), skin, 0, 0.1, 0.005, 0.95, 1.12, 1.02));
    head.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), skin, 0, 0.035, 0.045, 1.1, 0.8, 1.0));          // jaw
    head.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), skin, 0, 0.09, 0.105));                           // nose
    if (F.hair) head.add(mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m(F.hair), 0, 0.105, -0.008, 0.98, 1.08, 1.04));
    if (F.hood) { head.add(mesh(new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), m(F.hood), 0, 0.09, -0.015, 1, 1.16, 1.08)); head.add(mesh(new THREE.TorusGeometry(0.105, 0.025, 6, 16, Math.PI), m(F.hood), 0, 0.1, 0.06, 1, 1.15, 1)); }
    if (F.cap) { head.add(mesh(new THREE.SphereGeometry(0.112, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(F.cap), 0, 0.13, 0, 1, 0.75, 1.04)); head.add(mesh(new THREE.BoxGeometry(0.17, 0.018, 0.12), m(F.cap), 0, 0.135, 0.12)); }
    if (o.eyes) { const em = M('toxic', { emissive: '#b4ff4e', ei: o.eyesI || 6 }); for (const x of [-0.035, 0.035]) head.add(mesh(new THREE.SphereGeometry(0.016 * (CFG.eyeScale || 1), 8, 6), em, x * (CFG.eyeScale > 1 ? 1.15 : 1), 0.11, 0.092)); head.add(mesh(new THREE.BoxGeometry(0.05, 0.014, 0.02), M('soot'), 0, 0.045, 0.1)); if (o.eyeGlow) { const sp = glowSprite('#b4ff4e', o.eyeGlow, 1.3); sp.position.set(0, 0.11, 0.12); head.add(sp); } }
    else for (const x of [-0.035, 0.035]) head.add(mesh(new THREE.SphereGeometry(0.011, 6, 4), M('soot'), x, 0.11, 0.096));
    // arms
    const arms = {};
    for (const side of [-1, 1]) {
      const k = side < 0 ? 'L' : 'R', sh = new THREE.Group();
      sh.position.set(side * 0.21 * bw, chestH - 0.04, 0); spine.add(sh);
      const a = P['s' + k] || [0, 0, 0]; sh.rotation.set(a[0], a[1] || 0, side * (0.1 + (a[2] || 0)));
      sh.add(mesh(new THREE.SphereGeometry(0.075 * bw, 12, 8), top, 0, 0, 0, 1.1, 1, 1));
      sh.add(limb(top, 0.29 * bh, 0.072 * Math.sqrt(bw), 0.058 * Math.sqrt(bw)));
      const el = new THREE.Group(); el.position.y = -0.29 * bh; el.rotation.x = P['e' + k] ?? -0.15; sh.add(el);
      el.add(limb(F.bareArms ? skin : sleeve, 0.26 * bh, 0.056 * Math.sqrt(bw), 0.045 * Math.sqrt(bw)));
      const hand = new THREE.Group(); hand.position.y = -0.26 * bh - 0.02; el.add(hand);
      hand.add(mesh(new THREE.SphereGeometry(0.052, 10, 8), skin, 0, -0.035, 0.005, 0.8, 1.15, 1));
      arms[k] = hand;
    }
    // legs
    const feet = [];
    for (const side of [-1, 1]) {
      const k = side < 0 ? 'L' : 'R', hp = new THREE.Group(); hp.position.set(side * 0.09 * bw, -0.03, 0); hp.rotation.x = P['h' + k] ? P['h' + k][0] : 0; hp.rotation.z = P['h' + k] ? (P['h' + k][1] || 0) * side : 0; hips.add(hp);
      hp.add(limb(legs, thigh, 0.095 * Math.sqrt(bw), 0.07 * Math.sqrt(bw)));
      const kn = new THREE.Group(); kn.position.y = -thigh; kn.rotation.x = P['k' + k] ?? 0; hp.add(kn);
      kn.add(limb(legs, shin, 0.068 * Math.sqrt(bw), 0.052 * Math.sqrt(bw)));
      const an = new THREE.Group(); an.position.y = -shin; an.rotation.x = -(hp.rotation.x + kn.rotation.x) * 0.8; kn.add(an);
      const ft = mesh(new THREE.BoxGeometry(0.11, 0.09, 0.26), boots, 0, -0.04, 0.05); an.add(ft); feet.push(ft);
    }
    // props in the right hand (or attached anywhere)
    if (o.props) o.props({ hand: arms.R, handL: arms.L, spine, head });
    // plant the feet: lift or drop the body so the lowest foot touches the ground
    root.updateMatrixWorld(true);
    let minY = Infinity; const v = new THREE.Vector3();
    for (const f of feet) { f.geometry.computeBoundingBox(); const bb = f.geometry.boundingBox; for (const y of [bb.min.y]) for (const x of [bb.min.x, bb.max.x]) for (const z of [bb.min.z, bb.max.z]) { v.set(x, y, z).applyMatrix4(f.matrixWorld); minY = Math.min(minY, v.y); } }
    body.position.y = -minY + (o.lift || 0);
    root.scale.setScalar(o.scale || 1);
    root.userData.joints = { body, hips, spine, neck, head, sL: spine.children.find(c => c.isGroup && c.position.x < -0.01 && c.position.y > 0.3), sR: spine.children.find(c => c.isGroup && c.position.x > 0.01 && c.position.y > 0.3), hand: arms.R, handL: arms.L };
    root.userData.legs = hips.children.filter(c => c.isGroup && c !== spine);
    return root;
  }
  // props, built along the hand's -y (the way the fingers point)
  function axe(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.85, 8), M('wood'), 0, -0.2, 0)); g.add(mesh(new THREE.BoxGeometry(0.03, 0.17, 0.22), M('amber'), 0, -0.56, 0.08)); g.add(mesh(new THREE.BoxGeometry(0.025, 0.15, 0.06), M('steel'), 0, -0.56, 0.21)); g.rotation.x = -1.2; g.position.set(0, -0.05, 0.02); parts.hand.add(g); }
  function crossbow(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.05, 0.06, 0.62), M('dark'), 0, 0, 0.18)); g.add(mesh(new THREE.BoxGeometry(0.62, 0.025, 0.04), M('steel'), 0, 0.02, 0.44)); g.add(mesh(new THREE.BoxGeometry(0.04, 0.09, 0.16), M('amber'), 0, -0.05, -0.08)); g.position.set(0, -0.06, 0.03); g.rotation.set(1.45, 0, 0); parts.hand.add(g); }
  function crowbar(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.75, 8), M('amberDeep'), 0, -0.3, 0)); g.add(mesh(new THREE.BoxGeometry(0.025, 0.025, 0.1), M('amberDeep'), 0, -0.68, 0.04)); g.rotation.x = -0.4; parts.hand.add(g); }
  function torch(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 8), M('dark'), 0, -0.05, 0.04)); g.rotation.x = -1.4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 8), M('pale', { emissive: '#fff2cc', ei: 6 })); l.position.set(0, -0.16, 0.04); g.add(l); parts.handL.add(g); }

  const heroes = {
    brawler: () => rig({ outfit: { top: 'amberDeep', sleeve: 'amberDeep', legs: 'cloth3', vest: 'dark', hair: 'tyre', boots: 'tyre' }, bw: 1.12, pose: { lean: 0.08, twist: -0.15, sR: [-0.5, 0, 0.15], eR: -1.1, sL: [-0.35, 0, 0.12], eL: -0.9, hL: [-0.25], kL: 0.35, hR: [0.15], kR: 0.15, head: 0.05 }, props: axe }),
    ranger: () => rig({ outfit: { top: 'cloth1', legs: 'cloth2', hood: 'amber', boots: 'tyre', coat: 'cloth1' }, pose: { lean: 0.05, sR: [-1.25, 0, 0.0], eR: -0.25, sL: [-1.35, -0.3, -0.35], eL: -0.45, hL: [-0.3], kL: 0.3, hR: [0.12], kR: 0.1 }, props: crossbow }),
    scavver: () => rig({ outfit: { top: 'cloth2', legs: 'cloth3', cap: 'amber', pack: 'amberDeep', hair: 'bark', boots: 'tyre' }, pose: { lean: 0.12, sL: [-0.25, 0, 0.05], eL: -0.7, sR: [0.15, 0, 0.0], eR: -0.25, hL: [0.25], kL: 0.2, hR: [-0.3], kR: 0.45 }, props: p => { crowbar(p); torch(p); } }),
  };
  const ZO = { top: 'zcloth', legs: 'zcloth2', skin: 'zskin', boots: 'dark', hair: 'dark' };
  const dead = {
    walker: o => rig({ ...o, outfit: { ...ZO, ...(o && o.outfit) }, eyes: true, pose: { lean: 0.48, neck: 0.15, head: -0.05, headTilt: 0.25, sL: [-1.25, 0, -0.05], eL: -0.2, sR: [-0.95, 0, 0.1], eR: -0.35, hL: [-0.35], kL: 0.4, hR: [0.25], kR: 0.1 } }),
    runner: o => rig({ ...o, outfit: { ...ZO, top: 'stone', bareArms: true }, eyes: true, bw: 0.9, pose: { lean: 0.6, neck: -0.25, head: -0.3, sL: [-1.4, 0, -0.1], eL: -0.4, sR: [0.8, 0, 0.1], eR: -0.9, hL: [-0.9], kL: 1.1, hR: [0.5], kR: 0.6 } }),
    crawler: o => { const r = rig({ ...o, outfit: { ...ZO, bareArms: true }, eyes: true, bw: 0.85, pose: { lean: 1.25, neck: -0.9, head: -0.4, sL: [-1.7, 0, -0.25], eL: 0.2, sR: [-1.2, 0, 0.3], eR: 0.1, hL: [-1.4], kL: 1.9, hR: [-0.6], kR: 1.6 } }); return r; },
    brute: o => rig({ ...o, outfit: { ...ZO, top: 'rust', bareArms: true }, eyes: true, bw: 1.55, chestDepth: 1.2, scale: 1.4, pose: { lean: 0.22, neck: 0.4, head: 0.1, sL: [-0.4, 0, 0.25], eL: -0.5, sR: [-0.6, 0, 0.2], eR: -0.6, hL: [-0.2], kL: 0.25, hR: [0.15], kR: 0.1 } }),
    spitter: o => { const r = rig({ ...o, outfit: { ...ZO, top: 'olive2' }, eyes: true, bw: 0.95, pose: { lean: -0.15, neck: -0.45, head: -0.35, sL: [0.2, 0, 0.35], eL: -0.3, sR: [0.15, 0, 0.35], eR: -0.3, hL: [0.1], hR: [-0.1] } }); const s = glowSprite('#b4ff4e', 0.5, 1.4); s.position.set(0, 1.6, 0.2); r.add(s); return r; },
    bloater: o => rig({ ...o, outfit: { ...ZO, top: 'moss', belly: 'moss' }, eyes: true, belly: 1.85, bw: 1.35, chestDepth: 1.4, scale: 1.1, pose: { lean: -0.05, neck: 0.2, sL: [-0.2, 0, 0.6], eL: -0.3, sR: [-0.2, 0, 0.6], eR: -0.3, hL: [0, 0.15], hR: [0, 0.15] } }),
    screamer: o => rig({ ...o, outfit: { ...ZO, top: 'pale', bareArms: true }, eyes: true, bw: 0.85, pose: { lean: -0.3, neck: -0.5, head: -0.4, sL: [-2.7, 0, -0.35], eL: -0.3, sR: [-2.6, 0, -0.3], eR: -0.25, hL: [0.1], hR: [-0.1] } }),
    gravelord: o => { const r = rig({ ...o, outfit: { ...ZO, top: 'soot', legs: 'dark', bareArms: true }, eyes: true, eyesI: 10, bw: 1.7, chestDepth: 1.25, scale: 2.4, pose: { lean: 0.18, neck: 0.3, sL: [-0.35, 0, 0.35], eL: -0.4, sR: [-1.3, 0, 0.25], eR: -0.5, hL: [-0.15], kL: 0.2, hR: [0.15], kR: 0.1 }, props: p => { const b = new B(); for (let k = 0; k < 7; k++) b.cbox(k % 2 ? 'slab' : 'rebar', 0.05, 0.16 + (k % 3) * 0.06, 0.03, Math.cos(k * 0.9) * 0.1, 0.22, Math.sin(k * 0.9) * 0.1, { r: 0.005, rz: Math.cos(k * 0.9) * 0.4, rx: Math.sin(k * 0.9) * 0.4 }); p.head.add(b.build()); } }); return r; },
  };
  const figure = rig;

  // ---------- gameplay overlays (drawn in the world, like the game) ----------
  function zoneCells(cells, color = '#5fd06a', op = 0.35) {
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshBasicMaterial({ color: lin(color), transparent: true, opacity: op, depthWrite: false }), cells.length);
    const o = new THREE.Object3D(); cells.forEach(([x, z], i) => { o.position.set(x, 0.2, z); o.rotation.set(-Math.PI / 2, 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.renderOrder = 4; return m;
  }
  function chevrons(points, color = '#d5513d', op = 0.9) {
    const g = new THREE.Group();
    const s = new THREE.Shape(); s.moveTo(-0.55, -0.35); s.lineTo(0, 0.1); s.lineTo(0.55, -0.35); s.lineTo(0.55, -0.05); s.lineTo(0, 0.4); s.lineTo(-0.55, -0.05); s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    const mat = new THREE.MeshBasicMaterial({ color: lin(color).multiplyScalar(1.4), transparent: true, opacity: op, depthWrite: false });
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i], [x1, z1] = points[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 1.6), ang = Math.atan2(x1 - x0, z1 - z0);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, m = new THREE.Mesh(geo, mat); m.position.set(x0 + (x1 - x0) * t, 0.06, z0 + (z1 - z0) * t); m.rotation.set(-Math.PI / 2, 0, ang + Math.PI); m.renderOrder = 4; m.scale.setScalar(0.9); g.add(m); }
    }
    return g;
  }
  function ghost(obj, color = '#ffe9b8', op = 0.45) {
    obj.traverse(m => { if (m.isMesh) { m.material = new THREE.MeshStandardMaterial({ color: lin(color), transparent: true, opacity: op, roughness: 0.6, emissive: lin(color), emissiveIntensity: 0.15, depthWrite: false }); m.castShadow = false; } });
    return obj;
  }
  /** a visible light beam from `from` to `to` (world points) and the pool it lights */
  function beam(from, to, radius, color = '#fff1d6', op = 0.07) {
    const g = new THREE.Group();
    const a = new THREE.Vector3(...from), b2 = new THREE.Vector3(...to), len = a.distanceTo(b2);
    // gradient along the cone: bright at the lamp, fading at the far end
    const geo = new THREE.CylinderGeometry(0.25, radius, len, 24, 8, true);
    const cols = []; const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const t = (pa.getY(i) + len / 2) / len; const v = 0.15 + 0.85 * Math.pow(t, 1.6); cols.push(v, v, v); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: lin(color).multiplyScalar(op * 10), vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(a).add(b2).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), b2.clone().sub(a).normalize());
    g.add(m);
    const pool = glowDecal(color, radius * 1.3, 0.22); pool.position.set(to[0], 0.08, to[2]); pool.scale.set(1, 1.5, 1); g.add(pool);
    return g;
  }
  function ring(r, color = '#ffffff', op = 0.8, width = 0.12) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - width, r, 48), new THREE.MeshBasicMaterial({ color: lin(color).multiplyScalar(1.3), transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 5; return m;
  }

  return { P, M, T, setMask, territory, WIN, LENS, lin, rng, B, weeds, beam, place, post, rboxGeo, sign, textTex, glowDecal, glowSprite, apartment, rubble, streets, grass, car, bus, container, sandbags, jersey, lamp, trafficLight, busStop, tree, bush, barrelFire, townhouse, tower, barricade, farm, keep, hospital, metro, petrol, police, figure, heroes, dead, zoneCells, chevrons, ghost, ring, chainMat };
})();
