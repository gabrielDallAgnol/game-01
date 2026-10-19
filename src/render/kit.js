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
  // bulbs and lanterns follow the windows: their glow is read straight from WIN at render time (no per-frame work)
  const glowWith = (m, k, base) => Object.defineProperty(m, 'emissiveIntensity', { get: () => base + WIN.emissiveIntensity * k, set() {}, configurable: true });
  const BULB = glowWith(new THREE.MeshStandardMaterial({ color: lin('#f6e6bd'), roughness: 0.4, emissive: lin('#ffc468') }), 1.6, 0.12);
  const LANTERN = glowWith(new THREE.MeshStandardMaterial({ color: lin('#7d6c50'), roughness: 0.5, emissive: lin('#ff9038') }), 0.5, 0);
  const VCM = territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }));
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
      if (!this.parts.has(key)) this.parts.set(key, { mat: typeof mat === 'string' ? M(mat) : mat, list: [], plain: typeof mat === 'string' });
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
    // vc: every plain colour (a palette key or '#hex' with default options) is merged into ONE vertex-coloured mesh,
    // so a many-coloured model still costs a single draw call (used for the player's buildings).
    build(o = {}) {
      const g = new THREE.Group();
      let parts = [...this.parts.values()];
      if (o.vc) {
        const rest = [], list = [];
        for (const p of parts) {
          if (!p.plain) { rest.push(p); continue; }
          const c = p.mat.color;
          for (const gg of p.list) { const n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(gg); }
        }
        if (list.length) rest.push({ mat: VCM, list });
        parts = rest;
      }
      for (const { mat, list } of parts) {
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

  // ---------- helpers for the player's buildings: scrap at first, then paint, then pride ----------
  const shade = (hex, k) => '#' + new THREE.Color(P[hex] || hex).offsetHSL(0, 0, k).getHexString();
  const BLOOM = ['#e8667a', '#ffd166', '#f6efe0', '#f08a3c', '#b47ad6'];
  const PEN = (() => { const s = new THREE.Shape(); s.moveTo(-0.17, 0); s.lineTo(0.17, 0); s.lineTo(0, -0.34); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); })();
  /** a thin rod from p to q ([x, y, z]) */
  function rod(b, mat, p, q, t = 0.03) {
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], h = Math.hypot(dx, dz), L = Math.hypot(h, dy);
    b.geo(mat, rboxGeo(L, t, t, 0.001), (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, 0, Math.atan2(-dz, dx), Math.atan2(dy, h));
  }
  function sagPts(p, q, n, sag) { const out = []; for (let k = 0; k <= n; k++) { const t = k / n; out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - Math.sin(t * Math.PI) * sag, p[2] + (q[2] - p[2]) * t]); } return out; }
  function cord(b, pts, mat = '#3b3631', t = 0.025) { for (let k = 1; k < pts.length; k++) rod(b, mat, pts[k - 1], pts[k], t); }
  /** a string of pennants from p to q */
  function bunting(b, p, q, n, sag, cols = BLOOM, s = 1) {
    const pts = sagPts(p, q, n, sag), ry = Math.atan2(-(q[2] - p[2]), q[0] - p[0]); cord(b, pts);
    for (let k = 1; k < pts.length - 1; k++) b.geo(cols[k % cols.length], PEN, pts[k][0], pts[k][1], pts[k][2], 0, ry, 0, s, s, s);
  }
  /** a string of bulbs that light up at dusk with the windows */
  function lights(b, p, q, n, sag, s = 1) { const pts = sagPts(p, q, n, sag); cord(b, pts, '#2e2b28', 0.02); for (let k = 1; k < pts.length - 1; k++) b.sph(BULB, 0.08 * s, pts[k][0], pts[k][1] - 0.07 * s, pts[k][2], { detail: 0 }); }
  function blooms(b, x, y, z, w, n, r, dz = 0.15) { for (let k = 0; k < n; k++) b.sph(BLOOM[Math.floor(r() * BLOOM.length)], 0.085 + r() * 0.045, x + (r() - 0.5) * w, y + r() * 0.08, z + (r() - 0.5) * dz, { detail: 0 }); }
  /** a window box spilling flowers (front faces +z) */
  function windowBox(b, x, y, z, w, r) { b.cbox('#8a5a3a', w, 0.2, 0.28, x, y, z, { r: 0.03 }); b.sph('#5c8a3c', 0.17, x - w / 4, y + 0.14, z, { detail: 0, sx: 1.5 }); b.sph('#4f7d34', 0.16, x + w / 4, y + 0.14, z, { detail: 0, sx: 1.5 }); blooms(b, x, y + 0.26, z + 0.04, w * 0.9, 5, r); }
  function planter(b, x, z, s, r, flowers = true, y = 0) { b.box('#8a5a3a', 0.6 * s, 0.45 * s, 0.6 * s, x, y, z, { r: 0.05 }); b.sph(flowers ? '#5c8a3c' : '#56663f', 0.32 * s, x, y + 0.55 * s, z, { detail: 0 }); if (flowers) blooms(b, x, y + 0.75 * s, z, 0.45 * s, 5, r, 0.4 * s); }
  /** a pole with a flag flying toward +x (turned by ry) */
  function flag(b, x, y, z, h, w, col = 'amber', ry = 0) { b.cyl('#3a3a38', 0.035, 0.045, h, x, y, z, { seg: 6 }); const c = Math.cos(ry), s = Math.sin(ry); b.cbox(col, w, w * 0.62, 0.035, x + c * (w / 2 + 0.04), y + h - w * 0.34, z - s * (w / 2 + 0.04), { r: 0.005, ry }); }
  function drum(b, col, x, z, s = 1, y = 0) { b.cyl(col, 0.3 * s, 0.3 * s, 0.9 * s, x, y, z, { seg: 10 }); for (const t of [0.28, 0.6]) b.cyl(shade(col, -0.07), 0.31 * s, 0.31 * s, 0.05 * s, x, y + t * s, z, { seg: 10 }); }
  function bagRow(b, x, z, len, rows, ry, r, y0 = 0) { const c = Math.cos(ry), s = Math.sin(ry); for (let y = 0; y < rows; y++) { const off = (y % 2) * 0.3, n = Math.floor((len - off) / 0.6); for (let k = 0; k < n; k++) { const u = -len / 2 + off + 0.3 + k * 0.6; b.box('bag', 0.62, 0.26, 0.4, x + u * c, y0 + y * 0.24, z - u * s, { r: 0.11, ry: ry + (r() - 0.5) * 0.12 }); } } }
  /** a corrugated sheet: side 0 faces +z, ±1 faces ±x */
  function sheet(b, col, w, h, x, y, z, side = 0) {
    const ridge = shade(col, -0.06), n = Math.max(2, Math.round(w / 0.24));
    if (!side) { b.cbox(col, w, h, 0.03, x, y, z, { r: 0.004 }); for (let k = 0; k < n; k++) b.cbox(ridge, 0.05, h, 0.03, x - w / 2 + (k + 0.5) * w / n, y, z + 0.025, { r: 0.004 }); }
    else { b.cbox(col, 0.03, h, w, x, y, z, { r: 0.004 }); for (let k = 0; k < n; k++) b.cbox(ridge, 0.03, h, 0.05, x + side * 0.025, y, z - w / 2 + (k + 0.5) * w / n, { r: 0.004 }); }
  }
  /** a gable roof as two slabs (ridge along z) with the gable ends filled in the wall colour */
  function gable(b, w, d, H, pitch, roof, wall, o = {}) {
    const ov = o.eave ?? 0.3, run = w / 2 + ov, a = Math.atan2(pitch, run), L = Math.hypot(run, pitch) + 0.08, t = o.t ?? 0.16;
    for (const s of [-1, 1]) b.cbox(roof, L, t, d + (o.over ?? 0.5), s * run / 2, H + pitch / 2 + t / 2 * Math.cos(a), 0, { r: 0.03, rz: -s * a });
    b.cbox(o.ridge || shade(roof, -0.1), 0.24, 0.2, d + (o.over ?? 0.5) + 0.04, 0, H + pitch + 0.08, 0, { r: 0.04 });
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, pitch * (w / 2) / run); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); b.geo(wall, g, 0, H, 0);
    return a;
  }

  // ======================================================================
  // PLAYER BUILDINGS (warm accent = yours). Each level must read as progress from far away:
  // 1 survival (scrap, drab), 2 holding on (repaired, a coat of muted paint), 3 thriving (bright paint, flowers, bunting, lights).
  // ======================================================================
  /** a home; level 0 = ruin to restore, 1 a scrap shack, 2 a repaired two-storey house, 3 a proud painted townhouse */
  function townhouse(o = {}) {
    const lvl = o.level ?? 1, r = rng(o.seed || 21), b = new B();
    if (lvl === 0) {
      const w = o.w || 6.4, d = o.d || 7, fh = 2.9, wall = o.color || 'sand';
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
    const glass = o.game ? WIN : 'glass';
    if (lvl === 1) return shack(o, r, b);
    if (lvl === 2) return homestead(o, r, b, glass);
    return proudHouse(o, r, b, glass);
  }
  // level 1, survival: one room knocked together from weathered planks and tin, a tarp held down by tyres, boarded windows
  function shack(o, r, b) {
    const w = 4.8, d = 5.0, H = 2.55, ox = -0.45, fz = d / 2, WOOD = ['#6f675b', '#7b766c', '#5a5045', '#6a5a48', '#807769'];
    b.box('#6d6a63', w + 0.25, 0.25, d + 0.25, ox, 0, 0, { r: 0.03 });
    b.box('#554b41', w, H, d, ox, 0.25, 0, { r: 0.03 });
    for (let y = 0.42; y < H + 0.2; y += 0.3) {
      b.cbox(WOOD[Math.floor(r() * 5)], w + 0.05, 0.25, 0.05, ox + (r() - 0.5) * 0.12, y, fz + 0.02, { r: 0.005, rz: (r() - 0.5) * 0.04 });
      for (const sx of [-1, 1]) b.cbox(WOOD[Math.floor(r() * 5)], 0.05, 0.25, d + 0.05, ox + sx * (w / 2 + 0.02), y, (r() - 0.5) * 0.12, { r: 0.005, rx: (r() - 0.5) * 0.04 });
    }
    // tin patches
    sheet(b, 'rust', 1.4, 1.5, ox + 1.55, 1.05, fz + 0.06);
    sheet(b, 'metal', 1.8, 1.6, ox + w / 2 + 0.06, 1.15, -0.9, 1);
    sheet(b, '#5f6366', 1.5, 1.3, ox - w / 2 - 0.06, 1.0, 1.0, -1);
    // a boarded window, a scrap door, one dim lantern
    const wx = ox - 1.45;
    b.cbox('#24211e', 0.95, 0.8, 0.04, wx, 1.6, fz + 0.05, { r: 0.004 });
    b.cbox('#8a7356', 1.2, 0.16, 0.04, wx, 1.6, fz + 0.09, { r: 0.005, rz: 0.55 }); b.cbox('#7b6a52', 1.2, 0.16, 0.04, wx, 1.6, fz + 0.12, { r: 0.005, rz: -0.5 });
    b.cbox('#6f675b', 1.15, 0.14, 0.04, wx, 1.25, fz + 0.1, { r: 0.005, rz: 0.06 });
    const dx = ox + 0.15;
    b.cbox('#4a3f35', 0.95, 1.95, 0.06, dx, 1.22, fz + 0.06, { r: 0.01 });
    for (const y of [0.6, 1.9]) b.cbox('#5d5246', 0.98, 0.14, 0.04, dx, y, fz + 0.1, { r: 0.005 });
    b.cbox('#2f2c29', 0.5, 0.05, 0.05, dx + 0.75, 2.4, fz + 0.2, { r: 0.004 });
    b.cbox(LANTERN, 0.15, 0.22, 0.15, dx + 0.95, 2.22, fz + 0.2, { r: 0.02 }); b.cbox('#2f2c29', 0.2, 0.05, 0.2, dx + 0.95, 2.35, fz + 0.2, { r: 0.01 });
    // a patchwork tin roof falling to the front
    const a = 0.16, ry0 = H + 0.25 + 0.48, pw = (w + 0.8) / 3, TIN = ['metal', 'rust', '#5f6366'];
    { const rise = d * Math.tan(a) + 0.05, s = new THREE.Shape(); s.moveTo(-fz, 0); s.lineTo(fz, 0); s.lineTo(fz, rise); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.rotateY(Math.PI / 2); b.geo('#554b41', g, ox - w / 2, H + 0.25, 0); }
    for (let k = 0; k < 3; k++) {
      const col = TIN[(k + Math.floor(r() * 3)) % 3], x = ox - (w + 0.8) / 2 + (k + 0.5) * pw, y = ry0 + k * 0.03;
      b.cbox(col, pw + 0.08, 0.06, d + 0.9, x, y, 0, { r: 0.005, rx: a });
      for (let j = 0; j < 4; j++) b.cbox(shade(col, -0.06), 0.06, 0.05, d + 0.9, x - pw / 2 + (j + 0.5) * pw / 4, y + 0.05, 0, { r: 0.005, rx: a });
    }
    b.cbox('#59625e', 2.2, 0.04, 2.6, ox - 0.8, ry0 + 0.2, -0.6, { r: 0.01, rx: a, rz: 0.04 });
    for (const [x, z] of [[ox - 1.3, -0.3], [ox - 0.3, -1.1]]) b.geo('tyre', new THREE.TorusGeometry(0.3, 0.12, 6, 10), x, ry0 + 0.24 - z * 0.16, z, Math.PI / 2 + a, 0, 0);
    b.cyl('#3a3836', 0.1, 0.1, 1.4, ox + 1.5, H + 0.3, -1.5, { seg: 8 }); b.cyl('#2f2c29', 0.16, 0.16, 0.12, ox + 1.5, H + 1.7, -1.5, { seg: 8 });
    // a tarp lean-to on the side: firewood, a drum, crates
    const lx = ox + w / 2, top = H + 0.15, lo = 1.75, run = 1.45;
    for (const z of [-1.3, 1.3]) b.box('#6a5a48', 0.1, lo, 0.1, lx + run, 0, z, { r: 0.02, rz: (r() - 0.5) * 0.08 });
    b.cbox('#6b6650', Math.hypot(run, top - lo) + 0.15, 0.04, 3.0, lx + run / 2, (top + lo) / 2, 0, { r: 0.01, rz: -Math.atan2(top - lo, run) });
    drum(b, 'rust', lx + 0.55, 0.8);
    b.box('wood2', 0.7, 0.55, 0.6, lx + 0.6, 0, -0.6, { r: 0.03, ry: 0.2 }); b.box('#6f675b', 0.55, 0.45, 0.5, lx + 0.6, 0.55, -0.55, { r: 0.03, ry: -0.3 });
    for (let k = 0; k < 6; k++) b.cyl('#6b5640', 0.09, 0.09, 1.0, lx + 1.0 + (k % 3) * 0.18, 0.1 + Math.floor(k / 3) * 0.17, -1.05, { rx: Math.PI / 2, seg: 6 });
    // sandbags and a drum out front, a tyre against the wall
    bagRow(b, ox + 1.85, fz + 0.75, 2.2, 2, 0, r);
    drum(b, '#4f5a4c', ox - 0.55, fz + 0.45);
    b.geo('tyre', new THREE.TorusGeometry(0.32, 0.13, 6, 10), ox - w / 2 - 0.2, 0.42, -1.4, 0, Math.PI / 2, 0.15);
    return b.build({ vc: true });
  }
  // level 2, holding on: two storeys, patched with brick and fresh planks, a coat of muted paint, warm windows, a small flag
  function homestead(o, r, b, glass) {
    const w = 5.8, d = 6.2, fh = 2.7, H = fh * 2, fz = d / 2, wall = o.color || '#a39783', roof = o.roof || '#6e4a3e', trim = shade(wall, -0.13), brick = '#8a5a4a', wood = '#6a5848';
    b.box('#77736b', w + 0.18, 0.4, d + 0.18, 0, 0, 0, { r: 0.03 });
    b.box(wall, w, H, d, 0, 0, 0, { r: 0.04 });
    for (let y = 0.75; y < H - 0.1; y += 0.45) { const c = shade(wall, -0.045); b.cbox(c, w + 0.03, 0.05, 0.03, 0, y, fz + 0.01, { r: 0.004 }); for (const sx of [-1, 1]) b.cbox(c, 0.03, 0.05, d + 0.03, sx * (w / 2 + 0.01), y, 0, { r: 0.004 }); }
    b.cbox(trim, w + 0.12, 0.16, d + 0.12, 0, fh, 0, { r: 0.03 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(trim, 0.18, H, 0.18, x * w / 2, 0, z * d / 2, { r: 0.02 });
    // repairs: a brick patch, a few odd bricks, fresh planks on the side
    b.cbox(brick, 1.3, 1.0, 0.04, -w / 2 + 0.8, 0.95, fz + 0.03, { r: 0.006 });
    for (let k = 0; k < 6; k++) b.cbox(shade(brick, (r() - 0.5) * 0.08), 0.38, 0.16, 0.05, -w / 2 + 0.4 + (k % 3) * 0.42 + (Math.floor(k / 3) % 2) * 0.2, 0.62 + Math.floor(k / 3) * 0.55, fz + 0.05, { r: 0.004 });
    for (let k = 0; k < 4; k++) b.cbox('#8a6f52', 0.04, 1.7, 0.26, w / 2 + 0.03, 3.7, -1.6 + k * 0.28, { r: 0.004 });
    // windows: warm by night; one ground-floor window still half boarded
    const win = (x, y, z, s = 1, ww = 0.9, wh = 1.2) => { b.cbox(glass, ww, wh, 0.06, x, y + wh / 2, z, { r: 0.008 }); b.cbox(trim, ww + 0.25, 0.09, 0.2, x, y - 0.03, z + s * 0.06, { r: 0.02 }); };
    for (const x of [-1.75, 1.75]) { win(x, 0.95, fz + 0.02); for (const s of [-1, 1]) b.cbox('wood2', 0.4, 1.2, 0.05, x + s * 0.68, 1.55, fz + 0.06, { r: 0.006 }); }
    b.cbox('#7b6a52', 1.05, 0.16, 0.04, -1.75, 1.6, fz + 0.1, { r: 0.004, rz: 0.12 });
    for (const x of [-1.8, 0, 1.8]) { win(x, fh + 0.8, fz + 0.02); win(x, fh + 0.8, -fz - 0.02, -1); }
    for (const x of [-1.75, 1.75]) win(x, 0.95, -fz - 0.02, -1);
    for (const sx of [-1, 1]) for (const y of [0.95, fh + 0.8]) { b.cbox(glass, 0.06, 1.2, 0.9, sx * (w / 2 + 0.02), y + 0.6, 0.6, { r: 0.008 }); }
    // the door under a small plank porch, a wall lamp
    b.cbox(shade(wall, -0.28), 1.0, 2.1, 0.08, 0, 1.05 + 0.2, fz + 0.04, { r: 0.01 });
    b.cbox(wood, 1.8, 0.08, 0.95, 0, 2.55, fz + 0.45, { r: 0.01, rx: 0.22 });
    for (const s of [-1, 1]) rod(b, wood, [s * 0.8, 2.0, fz + 0.03], [s * 0.8, 2.5, fz + 0.75], 0.07);
    b.cbox('#77736b', 1.4, 0.18, 0.6, 0, 0.09, fz + 0.35, { r: 0.03 });
    b.cbox(glass, 0.14, 0.2, 0.12, 0.8, 2.15, fz + 0.1, { r: 0.02 });
    // a tiled roof in a faded colour, a brick chimney, a small flag on the gable
    const a = gable(b, w, d, H, 1.8, roof, wall);
    for (let k = 0; k < 3; k++) { const s = 0.8 + r() * 1.8, x = s * Math.cos(a), y = H + 1.8 - s * Math.sin(a) + 0.18; b.cbox(shade(roof, (r() - 0.5) * 0.12), 0.7, 0.04, 0.8, x, y, (r() - 0.5) * 4, { r: 0.01, rz: -a }); }
    b.box(brick, 0.6, 1.6, 0.6, -1.3, H + 0.5, -1.5, { r: 0.04 }); b.cbox('#5a4a40', 0.75, 0.12, 0.75, -1.3, H + 2.15, -1.5, { r: 0.02 });
    b.cyl(glass, 0.32, 0.32, 0.05, 0, H + 0.62, fz + 0.01, { rx: Math.PI / 2, seg: 10 });
    flag(b, 0, H + 1.7, fz + 0.15, 1.4, 0.75);
    // a clothesline on the side, a box of vegetables, a painted rain barrel
    const cx = -w / 2 - 0.6;
    for (const z of [-2.3, 2.1]) b.box(wood, 0.08, 2.0, 0.08, cx, 0, z, { r: 0.02 });
    const line = sagPts([cx, 1.95, -2.3], [cx, 1.95, 2.1], 6, 0.12); cord(b, line, '#d8d1c2', 0.02);
    ['#c9c0a8', '#8a96a0', '#a3806a', '#b8b08f'].forEach((c, k) => { const p = line[k + 1]; b.cbox(c, 0.03, 0.6, 0.55, cx, p[1] - 0.32, p[2], { r: 0.005 }); });
    b.box('wood', 1.2, 0.35, 0.55, 1.9, 0, fz + 0.75, { r: 0.03 });
    for (let k = 0; k < 5; k++) b.sph(k % 3 === 2 ? '#a8743e' : '#6f8a4a', 0.16, 1.45 + k * 0.22, 0.42, fz + 0.75 + (r() - 0.5) * 0.15, { detail: 0 });
    drum(b, '#5c6e78', -w / 2 + 0.25, fz + 0.5);
    return b.build({ vc: true });
  }
  // level 3, thriving: three storeys in bright paint with white trim, shutters, window boxes, a balcony with lights, a banner
  function proudHouse(o, r, b, glass) {
    const w = 6.3, d = 6.6, fh = 2.7, H = fh * 3, fz = d / 2, wall = o.color || '#f2d27a', roof = o.roof || '#c8553d', acc = o.accent || '#2f8f88', trim = '#f6f0e2', pitch = 2.3;
    b.box('#8f8a80', w + 0.2, 0.45, d + 0.2, 0, 0, 0, { r: 0.03 });
    b.box(wall, w, H, d, 0, 0, 0, { r: 0.04 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(trim, 0.28, H, 0.28, x * w / 2, 0, z * d / 2, { r: 0.03 });
    for (let f = 1; f < 3; f++) b.cbox(trim, w + 0.16, 0.18, d + 0.16, 0, f * fh, 0, { r: 0.03 });
    b.cbox(trim, w + 0.3, 0.26, d + 0.3, 0, H, 0, { r: 0.04 });
    const win = (x, y, z, s = 1, sh = true, ww = 0.9, wh = 1.3) => {
      b.cbox(glass, ww, wh, 0.06, x, y + wh / 2, z, { r: 0.008 });
      b.cbox(trim, ww + 0.3, 0.1, 0.22, x, y - 0.04, z + s * 0.06, { r: 0.02 }); b.cbox(trim, ww + 0.24, 0.14, 0.12, x, y + wh + 0.08, z + s * 0.03, { r: 0.02 });
      if (sh) for (const q of [-1, 1]) { b.cbox(acc, 0.38, wh, 0.05, x + q * (ww / 2 + 0.22), y + wh / 2, z + s * 0.04, { r: 0.006 }); for (let k = 0; k < 3; k++) b.cbox(shade(acc, -0.08), 0.32, 0.04, 0.03, x + q * (ww / 2 + 0.22), y + 0.25 + k * 0.4, z + s * 0.07, { r: 0.004 }); }
    };
    const cols = [-2.0, 0, 2.0];
    // ground floor: two windows and the front door under a striped awning, lamps either side, planters
    for (const x of [-2.0, 2.0]) { win(x, 0.95, fz + 0.02); windowBox(b, x, 0.82, fz + 0.18, 1.0, r); }
    b.cbox(acc, 1.05, 2.2, 0.08, 0, 1.55, fz + 0.04, { r: 0.01 }); b.cbox(trim, 1.35, 2.45, 0.05, 0, 1.6, fz + 0.01, { r: 0.01 });
    b.cbox(glass, 0.8, 0.3, 0.04, 0, 2.45, fz + 0.09, { r: 0.006 });
    b.cbox('#8f8a80', 1.6, 0.2, 0.7, 0, 0.35, fz + 0.4, { r: 0.03 });
    for (let k = 0; k < 6; k++) b.cbox(k % 2 ? trim : 'amber', 2.0 / 6 + 0.01, 0.05, 1.05, -1.0 + (k + 0.5) * 2.0 / 6, 3.0, fz + 0.5, { r: 0.005, rx: 0.38 });
    for (const s of [-1, 1]) { b.cbox('#2f2c29', 0.08, 0.3, 0.08, s * 0.85, 2.35, fz + 0.12, { r: 0.01 }); b.sph(BULB, 0.12, s * 0.85, 2.2, fz + 0.18, { detail: 0 }); planter(b, s * 1.05, fz + 0.75, 0.9, r); }
    // upper floors: shuttered windows with flower boxes; a balcony on the first floor with string lights
    for (let f = 1; f < 3; f++) for (const x of cols) {
      const y = f * fh + 0.75;
      if (f === 1 && x === 0) { b.cbox(glass, 0.95, 2.0, 0.06, 0, f * fh + 0.2 + 1.0, fz + 0.02, { r: 0.008 }); b.cbox(trim, 1.2, 0.14, 0.12, 0, f * fh + 2.28, fz + 0.04, { r: 0.02 }); continue; }
      win(x, y, fz + 0.02); windowBox(b, x, y - 0.14, fz + 0.18, 1.0, r);
    }
    const by = fh + 0.06, bz = fz + 0.45;
    b.cbox(trim, 2.4, 0.14, 0.95, 0, by, bz, { r: 0.03 });
    for (let k = 0; k <= 6; k++) b.box(acc, 0.06, 0.9, 0.06, -1.15 + k * 2.3 / 6, by, fz + 0.88, { r: 0.01 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.box(acc, 0.06, 0.9, 0.06, s * 1.15, by, fz + 0.1 + k * 0.26, { r: 0.01 });
    b.cbox(trim, 2.4, 0.08, 0.1, 0, by + 0.95, fz + 0.88, { r: 0.01 });
    windowBox(b, 0, by + 1.05, fz + 0.88, 2.0, r);
    for (const s of [-1, 1]) rod(b, trim, [s * 1.1, by - 0.05, fz + 0.03], [s * 1.1, by - 0.75, fz + 0.03], 0.1);
    lights(b, [-1.25, by + 2.45, fz + 0.15], [1.25, by + 2.45, fz + 0.15], 8, 0.2);
    // back and sides: plain windows (they still glow at night)
    for (let f = 0; f < 3; f++) for (const x of cols) win(x, f * fh + 0.85, -fz - 0.02, -1, false);
    for (const sx of [-1, 1]) for (let f = 0; f < 3; f++) b.cbox(glass, 0.06, 1.2, 0.9, sx * (w / 2 + 0.02), f * fh + 0.85 + 0.6, sx > 0 ? -1.4 : 1.2, { r: 0.008 });
    // a bright roof with a round attic window, string lights along the gable, a brick chimney, the town flag on top
    const a = gable(b, w, d, H + 0.12, pitch, roof, wall, { eave: 0.4 });
    b.cyl(trim, 0.52, 0.52, 0.06, 0, H + 0.95, fz + 0.01, { rx: Math.PI / 2, seg: 14 }); b.cyl(glass, 0.4, 0.4, 0.06, 0, H + 0.95, fz + 0.04, { rx: Math.PI / 2, seg: 14 });
    for (const s of [-1, 1]) lights(b, [s * (w / 2 + 0.4), H + 0.2, fz + 0.32], [0, H + pitch + 0.25, fz + 0.32], 7, 0.08);
    b.box('#b0533f', 0.65, 1.9, 0.65, 1.5, H + 0.6, -1.6, { r: 0.04 }); b.cbox(trim, 0.8, 0.14, 0.8, 1.5, H + 2.5, -1.6, { r: 0.02 });
    flag(b, 0, H + pitch + 0.1, fz + 0.1, 2.0, 1.15);
    // the town banner hung on the side, ivy and flowers climbing the other corner
    b.cbox('#2f2c29', 0.5, 0.06, 1.5, w / 2 + 0.25, H - 0.35, 0.3, { r: 0.01 });
    b.cbox('amber', 0.05, 3.2, 1.3, w / 2 + 0.18, H - 2.0, 0.3, { r: 0.006 });
    b.cbox(trim, 0.06, 0.24, 1.32, w / 2 + 0.19, H - 0.95, 0.3, { r: 0.004 }); b.cyl(trim, 0.32, 0.32, 0.06, w / 2 + 0.2, H - 2.0, 0.3, { rz: Math.PI / 2, seg: 10 });
    for (let k = 0; k < 7; k++) { const y = 0.5 + k * 0.85, z = fz - 0.25 - r() * 0.6; b.sph(k % 2 ? '#4f7d34' : '#5c8a3c', 0.35 + r() * 0.15, -w / 2 - 0.12, y, z, { detail: 0, sx: 0.5 }); }
    blooms(b, -w / 2 - 0.25, 0.4, fz - 0.6, 0.15, 7, r, 0.8);
    return b.build({ vc: true });
  }

  /** watchtower: 1 a scaffold-and-timber lookout, 2 a painted timber tower with a roof and flag, 3 a proud turret with banners */
  function tower(o = {}) {
    const lvl = o.level || 1, b = new B(), r = rng(o.seed || 51);
    let H;
    if (lvl === 1) {
      // survival: scaffold poles and odd timbers lashed together, a pallet deck, sandbags, a tarp against the wind
      H = 3.9; const sz = 2.1, h = sz / 2;
      for (const [a, c, m] of [[-1, -1, 'steel'], [1, -1, '#6a5a48'], [-1, 1, '#6a5a48'], [1, 1, 'metal']]) b.box(m, 0.11, H, 0.11, a * h, 0, c * h, { r: 0.02, rz: a * 0.02 });
      rod(b, '#6f675b', [-h, 0.3, h], [h, 2.3, h], 0.08); rod(b, 'metal', [h, 0.5, -h], [h, 2.6, h], 0.06); rod(b, '#5a5045', [-h, 2.4, -h], [h, 0.4, -h], 0.08); rod(b, 'steel', [-h, 0.2, -h], [-h, 2.0, h], 0.06);
      for (const y of [2.1]) { rod(b, '#6f675b', [-h, y, h], [h, y + 0.05, h], 0.07); rod(b, '#6f675b', [h, y, h], [h, y - 0.04, -h], 0.07); }
      for (let k = 0; k < 4; k++) b.cbox(['#8a7356', '#6f675b', '#7b6a52'][k % 3], sz + 0.45, 0.1, 0.52, (r() - 0.5) * 0.12, H + 0.05, -h - 0.05 + k * 0.62, { r: 0.01, ry: (r() - 0.5) * 0.06 });
      bagRow(b, 0, h + 0.05, sz + 0.3, 2, 0, r, H + 0.1); bagRow(b, h + 0.05, 0, sz + 0.3, 2, Math.PI / 2, r, H + 0.1);
      for (const z of [-h - 0.1, h - 0.4]) b.box('#5a5045', 0.07, 1.25, 0.07, -h - 0.15, H + 0.1, z, { r: 0.01 });
      b.cbox('#59625e', 0.04, 0.95, sz + 0.1, -h - 0.18, H + 0.75, -0.25, { r: 0.006, rz: 0.08 });
      for (const s of [-0.25, 0.25]) rod(b, '#6a5a48', [s, 0, h + 0.75], [s, H, h + 0.2], 0.06);
      for (let k = 1; k < 6; k++) { const t = k / 6; b.cbox('#7b6a52', 0.55, 0.05, 0.06, 0, H * t, h + 0.75 - 0.55 * t, { r: 0.005 }); }
      b.cbox(LANTERN, 0.14, 0.2, 0.14, -h - 0.15, H + 1.45, h - 0.4, { r: 0.02 });
      drum(b, 'rust', h + 0.5, -h - 0.2, 0.9); b.geo('tyre', new THREE.TorusGeometry(0.3, 0.12, 6, 10), -h - 0.3, 0.13, 0.4, Math.PI / 2, 0, 0);
    } else if (lvl === 2) {
      // holding on: a proper timber tower, braced, plank walls in a muted coat of paint, a shingle roof, a small flag
      H = 6.2; const sz = 2.5, h = sz / 2, paint = '#7f8a74', timber = '#6a5848';
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(timber, 0.18, H, 0.18, a * h, 0, c * h, { r: 0.03 });
      for (const y0 of [0.3, 3.2]) for (const [p, q] of [[[-h, y0, h], [h, y0 + 2.7, h]], [[h, y0, h], [-h, y0 + 2.7, h]], [[h, y0, -h], [h, y0 + 2.7, h]], [[h, y0, h], [h, y0 + 2.7, -h]], [[-h, y0, -h], [h, y0 + 2.7, -h]], [[-h, y0, -h], [-h, y0 + 2.7, h]]]) rod(b, 'wood2', p, q, 0.09);
      for (const y of [3.05, H - 0.1]) { b.cbox('wood2', sz, 0.12, 0.12, 0, y, h, { r: 0.01 }); b.cbox('wood2', sz, 0.12, 0.12, 0, y, -h, { r: 0.01 }); b.cbox('wood2', 0.12, 0.12, sz, h, y, 0, { r: 0.01 }); b.cbox('wood2', 0.12, 0.12, sz, -h, y, 0, { r: 0.01 }); }
      b.box('#7a6550', sz + 0.7, 0.14, sz + 0.7, 0, H, 0, { r: 0.02 });
      const ph = h + 0.32;
      for (const s of [-1, 1]) { b.cbox(paint, sz + 0.66, 1.0, 0.08, 0, H + 0.64, s * ph, { r: 0.01 }); b.cbox(paint, 0.08, 1.0, sz + 0.66, s * ph, H + 0.64, 0, { r: 0.01 }); }
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const c = shade(paint, -0.06), y = H + 0.4 + k * 0.32; b.cbox(c, sz + 0.68, 0.03, 0.09, 0, y, s * ph, { r: 0.003 }); b.cbox(c, 0.09, 0.03, sz + 0.68, s * ph, y, 0, { r: 0.003 }); }
      for (const s of [-1, 1]) { b.cbox('#4a3f35', sz + 0.74, 0.1, 0.16, 0, H + 1.17, s * ph, { r: 0.01 }); b.cbox('#4a3f35', 0.16, 0.1, sz + 0.74, s * ph, H + 1.17, 0, { r: 0.01 }); }
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(timber, 0.12, 2.1, 0.12, a * ph, H + 0.1, c * ph, { r: 0.02 });
      b.cyl('#5e4c3f', 0.04, (ph + 0.35) * Math.SQRT2, 1.5, 0, H + 2.15, 0, { seg: 4, ry: Math.PI / 4 }); b.cyl('#4a3f35', (ph + 0.36) * Math.SQRT2, (ph + 0.36) * Math.SQRT2, 0.1, 0, H + 2.12, 0, { seg: 4, ry: Math.PI / 4 });
      flag(b, 0, H + 3.55, 0, 1.1, 0.7);
      b.cbox(glass(o), 0.16, 0.22, 0.16, h + 0.2, H + 1.95, h + 0.2, { r: 0.02 });
      for (const s of [-0.28, 0.28]) b.box('#6a5848', 0.07, H, 0.07, s, 0, h + 0.18, { r: 0.01 });
      for (let k = 1; k < 10; k++) b.cbox('#7b6a52', 0.6, 0.05, 0.06, 0, k * H / 10, h + 0.18, { r: 0.005 });
      b.box('wood', 0.6, 0.5, 0.6, -h - 0.3, 0, h - 0.1, { r: 0.03, ry: 0.3 }); drum(b, '#5c6e78', h + 0.45, -h + 0.2, 0.9);
    } else {
      // thriving: a turret on a painted base, a bright conical roof, the town banners, pennants and lights
      H = 7.6; const acc = o.accent || '#2f8f88', cream = '#efe6d2', trim = '#f6f0e2', roofC = o.roof || '#c8553d';
      b.box('#d9cfbb', 3.4, 2.2, 3.4, 0, 0, 0, { r: 0.12 });
      b.cbox('#8f8a80', 3.46, 0.4, 3.46, 0, 0.2, 0, { r: 0.04 }); b.cbox('amber', 3.44, 0.3, 3.44, 0, 1.55, 0, { r: 0.02 });
      b.cbox(trim, 3.6, 0.16, 3.6, 0, 2.2, 0, { r: 0.03 });
      b.cyl(cream, 1.0, 1.25, H - 2.2, 0, 2.2, 0, { seg: 16 });
      for (let k = 0; k < 2; k++) b.cyl(k ? acc : 'amber', 1.12 - k * 0.07, 1.12 - k * 0.07, 0.24, 0, 3.4 + k * 1.6, 0, { seg: 16 });
      for (let k = 0; k < 3; k++) b.cbox(glass(o), 0.3, 0.55, 0.06, Math.sin(k * 2.1) * 1.1, 3.9 + k * 0.6, Math.cos(k * 2.1) * 1.1, { r: 0.01, ry: k * 2.1 });
      b.cyl('steel', 1.55, 1.3, 1.0, 0, H, 0, { seg: 8 });
      b.cyl(acc, 1.6, 1.6, 0.14, 0, H + 1.0, 0, { seg: 8 });
      b.cbox('dark', 0.5, 0.42, 0.9, 0, H + 0.55, 1.3, { r: 0.06 });
      b.cbox('dark', 0.14, 0.14, 1.7, 0.09, H + 0.6, 2.4, { r: 0.04 }); b.cbox('dark', 0.14, 0.14, 1.7, -0.09, H + 0.6, 2.4, { r: 0.04 });
      b.cyl('steel', 0.35, 0.42, 0.55, 0.9, H + 1.12, -0.5, { rx: -1.15, seg: 14 });
      b.cyl(o.game ? LENS : M('pale', { emissive: '#fff1d0', ei: o.night ? 6 : 0.2 }), 0.33, 0.33, 0.04, 0.9, H + 1.33, -0.12, { rx: -1.15, seg: 14 });
      // the roof on four posts, lights around its eaves, the flag on top
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; b.box('#3a3a38', 0.09, 1.5, 0.09, Math.cos(a) * 1.45, H + 1.0, Math.sin(a) * 1.45, { r: 0.01 }); }
      b.cyl(roofC, 0.05, 2.05, 1.6, 0, H + 2.5, 0, { seg: 8 }); b.cyl(trim, 2.08, 2.08, 0.14, 0, H + 2.44, 0, { seg: 8 });
      for (let k = 0; k < 8; k++) { const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4, R = 2.08; lights(b, [Math.cos(a0) * R, H + 2.4, Math.sin(a0) * R], [Math.cos(a1) * R, H + 2.4, Math.sin(a1) * R], 2, 0.12); }
      flag(b, 0, H + 3.95, 0, 1.7, 1.2);
      // two long banners in the town colour hanging from the turret
      for (const s of [-1, 1]) { b.cbox('amber', 0.05, 2.6, 0.75, s * 1.32, H - 1.4, 0, { r: 0.006 }); b.cbox(trim, 0.06, 0.18, 0.77, s * 1.33, H - 0.55, 0, { r: 0.004 }); b.geo('amber', PEN, s * 1.32, H - 2.7, 0, 0, Math.PI / 2, 0, 2.2, 1.2, 1); }
      // bunting round the base, planters with flowers at its feet, sandbags only on the gun side
      const c = 1.75;
      for (const [x, z] of [[-c, -c], [c, -c], [c, c], [-c, c]]) b.box('#3a3a38', 0.07, 1.0, 0.07, x, 2.28, z, { r: 0.01 });
      bunting(b, [-c, 3.2, c], [c, 3.2, c], 6, 0.18); bunting(b, [c, 3.2, -c], [c, 3.2, c], 6, 0.18); bunting(b, [-c, 3.2, -c], [-c, 3.2, c], 6, 0.18); bunting(b, [-c, 3.2, -c], [c, 3.2, -c], 6, 0.18);
      bagRow(b, 0, 1.45, 2.6, 2, 0, r, 2.28);
      for (const [x, z] of [[-1.95, 1.95], [1.95, 1.95], [1.95, -1.95], [-1.95, -1.95]]) planter(b, x, z, 0.8, r);
    }
    const g = b.build({ vc: true }); g.userData.top = H; return g;
  }
  const glass = o => (o.game ? WIN : 'glass');

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
      b.cbox('amber', 0.54, 0.3, 0.54, 0, 2.6, 0, { r: 0.02 });
      if (seed % 3 === 0) flag(b, 0, 3.3, 0, 1.3, 0.75);   // the town's pennant on every third post
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

  /** farms: 1 a scratched-out plot behind a scrap fence, 2 tidy beds + polytunnel + shed, 3 a red barn, greenhouse, bright crops, wind pump */
  function farm(o = {}) {
    const lvl = o.level || 1, b = new B(), r = rng(o.seed || 41), w = o.w || 9, d = o.d || 8, own = !!o.own;
    const fenceLine = (p, q, step, post) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / step)), pts = []; for (let k = 0; k <= n; k++) { const t = k / n, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t; pts.push([x, z]); post(x, z, k); } return pts; };
    if (lvl === 1) {
      // survival: dug-over ground, sparse muted rows, tyre planters, a scrap fence, a tarp over the sacks, a scarecrow
      b.box('#5f5444', w - 0.8, 0.12, d - 0.8, 0, 0, 0, { r: 0.04 });
      for (let k = 0; k < 4; k++) {
        const z = -d / 2 + 1.7 + k * 1.15, x = -0.7, bw = w - 3.4;
        b.cbox('#4e4436', bw, 0.16, 0.5, x, 0.16, z, { r: 0.06 });
        for (let c = 0; c < 9; c++) if (r() < 0.6) b.sph(r() < 0.5 ? 'olive2' : 'dry', 0.12 + r() * 0.1, x - bw / 2 + 0.3 + c * ((bw - 0.6) / 8), 0.28, z + (r() - 0.5) * 0.2, { detail: 0, sy: 0.8 });
      }
      for (const [x, z] of [[w / 2 - 1.0, d / 2 - 1.0], [w / 2 - 1.9, d / 2 - 0.9], [w / 2 - 1.4, d / 2 - 1.8]]) { b.geo('tyre', new THREE.TorusGeometry(0.36, 0.15, 6, 10), x, 0.24, z, Math.PI / 2, 0, 0); b.sph('#5f6a42', 0.26, x, 0.32, z, { detail: 0, sy: 0.7 }); }
      // scrap fence: odd posts and sagging wire on two sides, a sheet of tin
      const posts = ['#6a5a48', 'metal', '#7b766c', '#5a5045'];
      const wire = pts => { for (const y of [0.45, 0.95]) for (let k = 1; k < pts.length; k++) cord(b, sagPts([pts[k - 1][0], y, pts[k - 1][1]], [pts[k][0], y, pts[k][1]], 2, 0.05), '#5a5650', 0.025); };
      const post = (x, z) => b.box(posts[Math.floor(r() * 4)], 0.1, 1.0 + r() * 0.35, 0.1, x, 0, z, { r: 0.02, rx: (r() - 0.5) * 0.12, rz: (r() - 0.5) * 0.12 });
      wire(fenceLine([-w / 2 + 0.3, -d / 2 + 0.3], [w / 2 - 0.3, -d / 2 + 0.3], 1.4, post));
      wire(fenceLine([-w / 2 + 0.3, -d / 2 + 0.3], [-w / 2 + 0.3, d / 2 - 0.3], 1.4, post));
      sheet(b, 'rust', 1.7, 1.0, 0.8, 0.6, -d / 2 + 0.36);
      // the tarp lean-to with sacks and a drum
      const tx = w / 2 - 1.2, tz = -d / 2 + 1.5;
      for (const [x, z, hh] of [[tx + 0.85, tz - 1.1, 1.8], [tx + 0.85, tz + 1.1, 1.8], [tx - 0.85, tz - 1.1, 1.25], [tx - 0.85, tz + 1.1, 1.25]]) b.box('#6a5a48', 0.09, hh, 0.09, x, 0, z, { r: 0.02 });
      b.cbox('#6b6650', 1.95, 0.04, 2.5, tx, 1.55, tz, { r: 0.01, rz: 0.3 });
      for (let k = 0; k < 4; k++) b.sph('bag', 0.3, tx - 0.4 + (k % 2) * 0.55, 0.25 + Math.floor(k / 2) * 0.32, tz - 0.4 + (k % 3) * 0.35, { detail: 0, sy: 0.7 });
      drum(b, 'rust', tx + 0.4, tz + 0.75);
      // a scarecrow in rags
      const sx = -1.2, sz2 = 0.5;
      b.box('#6a5a48', 0.09, 2.3, 0.09, sx, 0, sz2, { r: 0.02 }); b.cbox('#6a5a48', 1.4, 0.08, 0.08, sx, 1.75, sz2, { r: 0.01 });
      b.cbox('#5b5348', 0.7, 0.85, 0.28, sx, 1.45, sz2, { r: 0.04, rz: 0.06 }); b.cbox('#4e463c', 0.25, 0.4, 0.2, sx + 0.55, 1.6, sz2, { r: 0.03, rz: 0.4 });
      b.sph('bag', 0.2, sx, 2.25, sz2, { detail: 0 }); b.cyl('#3a3633', 0.26, 0.26, 0.04, sx, 2.36, sz2, { seg: 8 }); b.cyl('#3a3633', 0.13, 0.15, 0.2, sx, 2.38, sz2, { seg: 8 });
      b.cyl('metal', 0.14, 0.11, 0.28, -w / 2 + 1.1, 0.12, d / 2 - 0.9, { seg: 8 });
    } else if (lvl === 2) {
      // holding on: tidy raised beds full of green, a polytunnel, a little painted shed with a flag, a post-and-rail fence
      b.box('#6f6048', w - 0.3, 0.16, d - 0.3, 0, 0, 0, { r: 0.04 });
      const bx = 1.0, bw = w - 4.2;
      for (const z of [-2.5, -0.8, 0.9]) {
        b.box('wood2', bw, 0.42, 1.15, bx, 0.16, z, { r: 0.03 });
        b.box('#3f362c', bw - 0.16, 0.05, 1.0, bx, 0.56, z, { r: 0.01 });
        for (let c = 0; c < 8; c++) for (const dz of [-0.25, 0.25]) b.sph((c + (dz > 0)) % 2 ? '#6f8f45' : '#5d7f3a', 0.17 + r() * 0.06, bx - bw / 2 + 0.3 + c * ((bw - 0.6) / 7), 0.72, z + dz, { detail: 0, sy: 0.8 });
      }
      const tg = new THREE.CylinderGeometry(1.3, 1.3, 5.2, 12, 1, true, 0, Math.PI), tm = new THREE.Mesh(tg, M('canvas', { opacity: 0.85, side: THREE.DoubleSide }));
      tm.rotation.x = Math.PI / 2; tm.rotation.y = Math.PI / 2; tm.position.set(-w / 2 + 1.75, 0.16, -0.4); tm.castShadow = true; tm.receiveShadow = true; b.add(tm);
      for (let k = 0; k < 5; k++) b.geo('#cfc6ae', new THREE.TorusGeometry(1.3, 0.035, 4, 12, Math.PI), -w / 2 + 1.75, 0.16, -2.9 + k * 1.25, 0, 0, 0);
      // the shed
      const hx = w / 2 - 1.3, hz = d / 2 - 1.25, sw = o.color || '#8e9a88';
      b.box(sw, 1.9, 1.9, 1.6, hx, 0.16, hz, { r: 0.03 });
      for (let y = 0.5; y < 2.0; y += 0.4) b.cbox(shade(sw, -0.05), 1.93, 0.04, 1.63, hx, y, hz, { r: 0.004 });
      b.cbox('#5a4d42', 2.3, 0.1, 2.0, hx, 2.25, hz, { r: 0.01, rx: 0.18 });
      b.cbox('wood2', 0.7, 1.4, 0.05, hx - 0.3, 0.86, hz + 0.81, { r: 0.006 });
      if (own) flag(b, hx + 0.8, 2.2, hz - 0.6, 1.1, 0.6);
      drum(b, '#5c7080', w / 2 - 0.55, -d / 2 + 0.7); drum(b, '#5c7080', w / 2 - 1.2, -d / 2 + 0.6);
      for (const [x, c] of [[-0.4, '#b77a40'], [0.35, '#6f8a4a']]) { b.box('wood', 0.65, 0.35, 0.5, x, 0.16, d / 2 - 0.8, { r: 0.03, ry: x }); for (let k = 0; k < 3; k++) b.sph(c, 0.13, x - 0.17 + k * 0.17, 0.55, d / 2 - 0.8, { detail: 0 }); }
      // post-and-rail fence with a gap for the gate
      const rails = (pts, gap) => { for (let k = 1; k < pts.length; k++) { if (gap && k === gap) continue; for (const y of [0.45, 0.85]) rod(b, '#7a6550', [pts[k - 1][0], y, pts[k - 1][1]], [pts[k][0], y, pts[k][1]], 0.06); } };
      const post = (x, z) => b.box('#6a5848', 0.12, 1.0, 0.12, x, 0, z, { r: 0.02 });
      const e = 0.2;
      rails(fenceLine([-w / 2 + e, -d / 2 + e], [w / 2 - e, -d / 2 + e], 1.5, post));
      rails(fenceLine([-w / 2 + e, -d / 2 + e], [-w / 2 + e, d / 2 - e], 1.5, post));
      rails(fenceLine([w / 2 - e, -d / 2 + e], [w / 2 - e, d / 2 - e], 1.5, post));
      rails(fenceLine([-w / 2 + e, d / 2 - e], [w / 2 - e, d / 2 - e], 1.5, post), 3);
    } else {
      // thriving: a red barn with white trim, a greenhouse, bright rows of pumpkins, tomatoes and sunflowers, a wind pump, beehives, a picket fence
      b.box('#7f9a4f', w, 0.14, d, 0, 0, 0, { r: 0.04 });
      // the barn (gable to the front)
      const gx = -w / 2 + 1.7, gz = -d / 2 + 1.55, bw = 2.8, bd = 2.5, bh = 2.3, red = '#c0462f', white = '#f4efe4', roofC = o.roof || '#2f8f88';
      b.box(red, bw, bh, bd, gx, 0.14, gz, { r: 0.03 });
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(white, 0.14, bh, 0.14, gx + x * bw / 2, 0.14, gz + z * bd / 2, { r: 0.02 });
      { const s = new THREE.Shape(); s.moveTo(-bd / 2, 0); s.lineTo(bd / 2, 0); s.lineTo(0, 1.12); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: bw, bevelEnabled: false }); g.translate(0, 0, -bw / 2); g.rotateY(Math.PI / 2); b.geo(red, g, gx, bh + 0.14, gz); }
      const run = bd / 2 + 0.25, ang = Math.atan2(1.35, run), Lr = Math.hypot(run, 1.35) + 0.06;
      for (const s of [-1, 1]) b.cbox(roofC, bw + 0.4, 0.12, Lr, gx, bh + 0.14 + 0.68, gz + s * run / 2, { r: 0.02, rx: s * ang });
      b.cbox(white, bw + 0.44, 0.14, 0.2, gx, bh + 0.14 + 1.38, gz, { r: 0.02 });
      const fzb = gz + bd / 2;
      b.cbox(white, 1.4, 1.75, 0.06, gx, 1.0, fzb + 0.01, { r: 0.005 }); b.cbox(shade(red, -0.08), 1.2, 1.55, 0.05, gx, 1.0, fzb + 0.03, { r: 0.005 });
      rod(b, white, [gx - 0.55, 0.3, fzb + 0.06], [gx + 0.55, 1.7, fzb + 0.06], 0.08); rod(b, white, [gx + 0.55, 0.3, fzb + 0.06], [gx - 0.55, 1.7, fzb + 0.06], 0.08);
      b.cbox(o.game ? WIN : 'glass', 0.05, 0.5, 0.5, gx + bw / 2 + 0.02, bh + 0.6, gz, { r: 0.005 });
      if (own) flag(b, gx, bh + 1.5, gz, 1.3, 0.8, 'amber', -Math.PI / 2);
      // the greenhouse
      const hx = w / 2 - 2.0, hz = -d / 2 + 1.5, hw = 3.4, hd = 2.4;
      b.box('steel', hw, 0.3, hd, hx, 0.14, hz, { r: 0.02 });
      for (let k = 0; k <= 4; k++) { const x = hx - hw / 2 + k * hw / 4; b.box('steel', 0.06, 1.6, 0.06, x, 0.44, hz - hd / 2, { r: 0.01 }); b.box('steel', 0.06, 1.6, 0.06, x, 0.44, hz + hd / 2, { r: 0.01 }); }
      const gm = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.05, 1.6, hd - 0.05), M('#cfe3d6', { opacity: 0.32, rough: 0.15, depthWrite: false })); gm.position.set(hx, 1.24, hz); b.add(gm);
      { const s = new THREE.Shape(); s.moveTo(-hd / 2, 0); s.lineTo(hd / 2, 0); s.lineTo(0, 0.9); s.closePath(); const rg = new THREE.ExtrudeGeometry(s, { depth: hw, bevelEnabled: false }); rg.translate(0, 0, -hw / 2); const rm = new THREE.Mesh(rg, M('#cfe3d6', { opacity: 0.38, rough: 0.15, depthWrite: false })); rm.rotation.y = Math.PI / 2; rm.position.set(hx, 2.04, hz); b.add(rm); }
      for (let k = 0; k < 7; k++) { const x = hx + (r() - 0.5) * (hw - 0.6), z = hz + (r() - 0.5) * (hd - 0.6); b.sph('#5c8a3c', 0.3, x, 0.7, z, { detail: 0 }); if (k % 2) b.sph('#d8452f', 0.09, x + 0.15, 0.85, z + 0.15, { detail: 0 }); }
      // crop rows: lettuce, tomatoes, pumpkins, cabbages
      const x0 = -w / 2 + 1.6, x1 = w / 2 - 1.4;
      [0.05, 1.05, 2.05, 3.0].forEach((z, row) => {
        b.cbox('#4a3a2a', x1 - x0, 0.1, 0.7, (x0 + x1) / 2, 0.18, z, { r: 0.03 });
        for (let c = 0; c < 10; c++) {
          const x = x0 + 0.3 + c * (x1 - x0 - 0.6) / 9, zz = z + (r() - 0.5) * 0.12;
          if (row === 0) b.sph('#8cc152', 0.2, x, 0.32, zz, { detail: 0, sy: 0.75 });
          else if (row === 1) { b.sph('#5d8a3a', 0.24, x, 0.42, zz, { detail: 0, sy: 1.2 }); b.sph('#d8452f', 0.08, x + 0.12, 0.45, zz + 0.12, { detail: 0 }); b.sph('#e0562f', 0.08, x - 0.1, 0.6, zz + 0.1, { detail: 0 }); }
          else if (row === 2) { if (c % 2) b.sph('#e8862e', 0.25, x, 0.33, zz, { detail: 0, sy: 0.72 }); else b.sph('#4f7d34', 0.22, x, 0.3, zz, { detail: 0, sy: 0.5, sx: 1.4 }); }
          else b.sph('#9bc06a', 0.21, x, 0.32, zz, { detail: 0 });
        }
      });
      // sunflowers along the side
      for (let k = 0; k < 5; k++) { const x = -w / 2 + 0.7, z = -0.2 + k * 0.85, hh = 1.6 + r() * 0.5; b.box('#4f7d34', 0.06, hh, 0.06, x, 0.14, z, { r: 0.01 }); b.cyl('#ffd166', 0.26, 0.26, 0.06, x + 0.04, hh + 0.14, z, { rz: Math.PI / 2 - 0.4, seg: 10 }); b.cyl('#6b4a2a', 0.12, 0.12, 0.07, x + 0.06, hh + 0.14, z, { rz: Math.PI / 2 - 0.4, seg: 8 }); }
      // the wind pump between barn and greenhouse
      const px = -0.1, pz = -d / 2 + 0.75, PH = 6.4;
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(b, white, [px + a * 0.6, 0.14, pz + c * 0.6], [px + a * 0.12, PH, pz + c * 0.12], 0.07);
      for (const y of [1.8, 3.6]) { const q = 0.6 - 0.48 * y / PH; rod(b, white, [px - q, y, pz + q], [px + q, y, pz + q], 0.05); rod(b, white, [px + q, y, pz - q], [px + q, y, pz + q], 0.05); }
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; b.cbox(k % 2 ? white : 'amber', 0.2, 1.1, 0.04, px + Math.sin(a) * 0.62, PH + 0.3 + Math.cos(a) * 0.62, pz + 0.3, { r: 0.01, rz: -a }); }
      b.cyl('#3a3a38', 0.12, 0.12, 0.2, px, PH + 0.3, pz + 0.2, { rx: Math.PI / 2, seg: 8 }); b.cbox(red, 0.04, 0.5, 0.8, px, PH + 0.3, pz - 0.5, { r: 0.006 });
      // beehives
      for (const z of [0.3, 1.3]) { const x = w / 2 - 0.55; b.box(white, 0.5, 0.55, 0.45, x, 0.14, z, { r: 0.03 }); b.cbox('#ffd166', 0.58, 0.08, 0.52, x, 0.72, z, { r: 0.02 }); }
      // a white picket fence with flowers along it
      const pick = (x, z) => b.box(white, 0.08, 0.75, 0.05, x, 0.14, z, { r: 0.01 });
      const runP = (p, q, ax) => { const L = ax === 'x' ? q - p : q - p, n = Math.round(Math.abs(L) / 0.36); for (let k = 0; k <= n; k++) { const t = p + (q - p) * k / n; ax === 'x' ? pick(t, d / 2 - 0.15) : pick(ax, t); } };
      runP(-w / 2 + 0.15, -0.7, 'x'); runP(0.7, w / 2 - 0.15, 'x');
      for (const y of [0.42, 0.72]) { b.cbox(white, w / 2 - 0.85, 0.06, 0.04, (-w / 2 + 0.15 - 0.7) / 2, y, d / 2 - 0.12, { r: 0.005 }); b.cbox(white, w / 2 - 0.85, 0.06, 0.04, (w / 2 - 0.15 + 0.7) / 2, y, d / 2 - 0.12, { r: 0.005 }); }
      for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.15); const n = 9; for (let k = 0; k <= n; k++) b.box(white, 0.05, 0.75, 0.08, x, 0.14, -0.5 + k * (d / 2 - 0.15 + 0.5) / n, { r: 0.01 }); for (const y of [0.42, 0.72]) b.cbox(white, 0.04, 0.06, d / 2 + 0.35, x + sx * 0.02, y, (d / 2 - 0.65) / 2, { r: 0.005 }); }
      for (const [a, c] of [[-w / 2 + 0.5, -0.9], [0.9, w / 2 - 0.5]]) blooms(b, (a + c) / 2, 0.3, d / 2 - 0.45, c - a, 12, r, 0.3);
    }
    return b.build({ vc: true });
  }

  /** the keep: 1 a bus and tarps around a fire, 2 a depot walled with containers, 3 + radio mast and searchlight */
  function keep(o = {}) {
    // The HQ: the old town hall, taken back. It must read as the heart of the town from any zoom:
    // the tallest thing you own, a clock tower, amber banners, a lit forecourt. Each keep level adds a floor and defences.
    const lvl = o.level || 1, g = new THREE.Group(), b = new B(), night = !!o.night;
    b.box('tile', 22, 0.12, 18, 0, 0, 0, { r: 0.05 });
    b.box('curb', 22.4, 0.08, 18.4, 0, 0, 0, { r: 0.04 });
    for (let k = -9; k <= 9; k += 3) b.cbox('paint', 0.12, 0.01, 3.5, k, 0.125, 6.5, { r: 0.001 });
    // the hall: a pale civic block with a portico, one more floor per keep level
    const floors = 3 + lvl, fh = 3.1, H = floors * fh, hw = 14, hd = 8, hz = -3.8;
    const hall = apartment({ w: hw, d: hd, floors, fh, color: 'pale', trim: 'stone', shop: false, seed: 91, ruin: 0 });
    hall.position.set(0, 0.12, hz); g.add(hall);
    // portico: columns and a pediment over the door
    for (const x of [-2.4, -0.8, 0.8, 2.4]) b.cyl('pale', 0.28, 0.32, 4.2, x, 0.12, hz + hd / 2 + 1.0, { seg: 12 });
    b.cbox('pale', 6.2, 0.5, 2.4, 0, 4.32, hz + hd / 2 + 0.7, { r: 0.04 });
    b.geo('stone', new THREE.CylinderGeometry(0.01, 3.4, 1.3, 3), 0, 5.4, hz + hd / 2 + 0.7, 0, Math.PI / 2, 0);
    b.box('dark', 1.4, 2.6, 0.1, 0, 0.12, hz + hd / 2 + 0.03, { r: 0.02 });
    // amber banners down the facade: this is yours
    for (const x of [-4.4, 4.4]) { b.cbox('amber', 1.1, H * 0.62, 0.06, x, H * 0.3, hz + hd / 2 + 0.08, { r: 0.01 }); b.cbox('amberDeep', 1.1, 0.25, 0.08, x, H * 0.3, hz + hd / 2 + 0.09, { r: 0.01 }); }
    // the clock tower on the roof
    const ty = H + 0.12, tw = 3.2, th = 4.5 + lvl;
    b.cbox('pale', tw, th, tw, 0, ty, hz, { r: 0.05 });
    b.cbox('stone', tw + 0.3, 0.3, tw + 0.3, 0, ty + th, hz, { r: 0.03 });
    b.geo('amberDeep', new THREE.ConeGeometry(tw * 0.78, 2.6, 4), 0, ty + th + 1.6, hz, 0, Math.PI / 4, 0);
    b.cyl('pale', 1.0, 1.0, 0.1, 0, ty + th - 1.6, hz + tw / 2 + 0.02, { rx: Math.PI / 2, seg: 20 });
    b.cbox('dark', 0.08, 0.75, 0.04, 0, ty + th - 1.6, hz + tw / 2 + 0.08, { r: 0.01 }); b.cbox('dark', 0.55, 0.08, 0.04, 0.2, ty + th - 1.45, hz + tw / 2 + 0.08, { r: 0.01 });
    // flag
    b.cyl('steel', 0.05, 0.06, 3.2, 0, ty + th + 2.8, hz, { seg: 6 });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.15, 6, 2), M('amber', { side: THREE.DoubleSide, emissive: '#c9702e', ei: 0.25 }));
    { const pa = flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + 1) * 2.4) * 0.12 * (pa.getX(i) + 1)); flag.geometry.computeVertexNormals(); }
    flag.position.set(1.0, ty + th + 5.3, hz); flag.castShadow = true; g.add(flag);
    // forecourt life: the bus you came in, a fire, crates, a table
    const bs = bus({ color: 'pale', stripe: 'amber' }); bs.position.set(-5.2, 0.12, 5.6); bs.rotation.y = 0.12; g.add(bs);
    const f = barrelFire({ light: night ? 3.2 : 0, dist: 16, shadow: night }); f.position.set(3.4, 0.12, 2.6); g.add(f);
    for (let k = 0; k < 4; k++) b.box('wood2', 0.9, 0.7, 0.7, 7.2 + (k % 2) * 1.0, 0.12 + Math.floor(k / 2) * 0.7, 5.6, { r: 0.04 });
    b.box('wood', 2.0, 0.08, 0.9, 4.6, 0.92, 5.2, { r: 0.02 }); for (const [x, z] of [[3.7, 4.8], [5.5, 4.8], [3.7, 5.6], [5.5, 5.6]]) b.box('wood', 0.07, 0.8, 0.07, x, 0.12, z);
    sandbagsInto(g, -7.5, 0.12, 1.2, 3.0, Math.PI / 2); sandbagsInto(g, 7.5, 0.12, 1.2, 3.0, Math.PI / 2);
    if (lvl >= 2) {
      // containers as walls, a gate, a lookout on top
      const spots = [[-9.5, -4, Math.PI / 2], [-9.5, 2.2, Math.PI / 2], [9.5, -4, Math.PI / 2], [9.5, 2.2, Math.PI / 2], [-6.6, -8.4, 0], [6.6, -8.4, 0]];
      const cols = ['rust', 'grey', 'stone', 'grey', 'rust', 'stone'];
      spots.forEach(([x, z, ry], k) => { const c = container({ color: cols[k] }); c.position.set(x, 0.12, z); c.rotation.y = ry; g.add(c); });
      const c2 = container({ color: 'amberDeep' }); c2.position.set(-9.5, 2.72, -4); c2.rotation.y = Math.PI / 2; g.add(c2);
      for (const x of [-1.8, 1.8]) { const j = jersey(2.2, { color: 'pale', stripe: 'amber' }); j.position.set(x * 2.4, 0.12, 8.6); g.add(j); }
    }
    if (lvl >= 3) {
      // radio mast with a searchlight
      const m = new B(), MH = 9;
      for (const [a, c] of [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]]) m.box('steel', 0.1, MH, 0.1, 4.3 + a, H + 0.12, hz - 1.5 + c, { r: 0.02 });
      for (let y = 1; y < MH; y += 1.5) m.cbox('steel', 1.1, 0.05, 0.05, 4.3, H + y, hz - 1.6, { r: 0.01, ry: y % 3 ? 0.5 : -0.5 });
      m.cyl('steel', 0.35, 0.42, 0.55, 4.3, H + MH - 0.6, hz - 1.4, { rx: -1.1, seg: 14 });
      m.cyl(o.game ? LENS : M('pale', { emissive: '#fff1d0', ei: night ? 6 : 0.2 }), 0.33, 0.33, 0.04, 4.3, H + MH - 0.35, hz - 0.98, { rx: -1.1, seg: 14 });
      g.add(m.build());
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
