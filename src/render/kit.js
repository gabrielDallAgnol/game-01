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

  // ---------- the world-space hook every lit material shares ----------
  // A 512×512 mask (one texel per cell, sampled in world space): r = your land, g = explored (blurred),
  // b = spare, a = contact shadow (blurred footprints of buildings, ruins and trees; 255 = open ground).
  // On top of the material's own lighting, territory() adds: the footprint contact shadow, the cooler wild,
  // the night light pools (a top-down additive light texture around the camera), glowing vertices (aEmit),
  // rim light on figures, the hit flash on the crowd, dawn/dusk mist, and the System's fog of war.
  const MS = 512, maskData = new Uint8Array(MS * MS * 4);
  const maskTex = new THREE.DataTexture(maskData, MS, MS, THREE.RGBAFormat);
  maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter; maskTex.needsUpdate = true;
  for (let k = 3; k < maskData.length; k += 4) maskData[k] = 255;
  const T = {
    mask: { value: maskTex }, off: { value: 32 }, amount: { value: 0.8 }, dark: { value: 0.7 },
    light: { value: null }, lightO: { value: new THREE.Vector2(-1e4, -1e4) }, lightS: { value: 64 }, lightK: { value: 0 },
    emitK: { value: 0 }, emitCol: { value: lin('#ffb15a') }, rim: { value: new THREE.Vector4(1, 0.8, 0.6, 0.15) },
    mist: { value: new THREE.Vector4(0.8, 0.8, 0.85, 0) }, time: { value: 0 }, ao: { value: 0.55 },
    fogCol: { value: lin('#16223a') }, cyan: { value: lin('#5fd3ff') }, front: { value: 1 }, scan: { value: new THREE.Vector4(0, 0, 0, 0) },
    sway: { value: 1 }, night: { value: 0 },
  };
  // the explored channel is blurred so the frontier is soft; the contact-shadow channel is a blurred footprint
  const blurA = new Float32Array(MS * MS), blurB = new Float32Array(MS * MS);
  function blur(src, n, passes) {
    let a = src, b = blurB;
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * MS + x; b[i] = (a[i] * 2 + (x > 0 ? a[i - 1] : a[i]) + (x < n - 1 ? a[i + 1] : a[i])) * 0.25; }
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * MS + x; a[i] = (b[i] * 2 + (y > 0 ? b[i - MS] : b[i]) + (y < n - 1 ? b[i + MS] : b[i])) * 0.25; }
    }
  }
  let footFn = null;
  /** foot(i) → 0..1 how much a cell is covered (buildings 1, trees ~0.5); stamped into the contact-shadow channel */
  function setFootprints(fn) { footFn = fn; }
  // fast path: arrays straight from the sim (zone and shroud), one texel per cell
  function setMaskArrays(zone, seen, n) {
    T.off.value = n / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) blurA[y * MS + x] = seen[y * n + x] === 1 ? 1 : 0;
    blur(blurA, n, 2);
    for (let y = 0; y < MS; y++) for (let x = 0; x < MS; x++) { const k = (y * MS + x) * 4, inMap = x < n && y < n, i = y * n + x; maskData[k] = maskData[k + 2] = inMap && zone[i] === 1 ? 255 : 0; maskData[k + 1] = inMap ? Math.round(blurA[y * MS + x] * 255) : 0; }
    if (footFn) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) blurA[y * MS + x] = footFn(y * n + x);
      blur(blurA, n, 2);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) maskData[(y * MS + x) * 4 + 3] = Math.round(255 * (1 - Math.min(1, blurA[y * MS + x] * 1.25)));
    }
    maskTex.needsUpdate = true;
  }
  function setMask(fn, n = 64, seen = null) { T.off.value = n / 2; for (let y = 0; y < MS; y++) for (let x = 0; x < MS; x++) { const inMap = x < n && y < n, v = inMap && fn(x, y) ? 255 : 0, k = (y * MS + x) * 4; maskData[k] = maskData[k + 2] = v; maskData[k + 1] = !seen || (inMap && seen(x, y)) ? 255 : 0; maskData[k + 3] = 255; } maskTex.needsUpdate = true; }
  const NOISE = `
    float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y); }`;
  /**
   * territory(material, { emit, rim, flash, ground, sway, fog })
   *   emit:  the geometry carries aEmit (0..2): those vertices glow amber with the town's lights (windows, lanterns, bulbs)
   *   rim:   a rim light (warm by day, moon-blue by night) — figures
   *   flash: instanced aFlash (0..1): white flash + squash when hit — the crowd
   *   ground: ground textures with organic path edges and noise variation (see city.js)
   *   sway:  wind sway for instanced trees and scrub
   *   fog: false to skip the fog of war (things drawn above it)
   */
  function territory(m, o = {}) {
    const defs = [o.emit && 'T_EMIT', o.rim && 'T_RIM', o.flash && 'T_FLASH', o.ground && 'T_GROUND', o.sway && 'T_SWAY', o.fog === false && 'T_NOFOG'].filter(Boolean);
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { tMask: T.mask, tOff: T.off, tAmount: T.amount, tDark: T.dark, tLight: T.light, tLightO: T.lightO, tLightS: T.lightS, tLightK: T.lightK,
        tEmitK: T.emitK, tEmitCol: T.emitCol, tRim: T.rim, tMist: T.mist, tTime: T.time, tAO: T.ao, tFogCol: T.fogCol, tCyan: T.cyan, tFront: T.front, tScan: T.scan, tSway: T.sway, tNight: T.night }, o.uniforms || {});
      const head = defs.map(d => `#define ${d}`).join('\n');
      sh.vertexShader = head + '\n' + sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vTWorld;
uniform float tTime, tSway;
#ifdef T_EMIT
attribute float aEmit; varying float vEmit;
#endif
#ifdef T_FLASH
attribute float aFlash; varying float vFlash;
#endif`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef T_FLASH
  vFlash = aFlash; transformed.y *= 1.0 - 0.16 * aFlash; transformed.xz *= 1.0 + 0.12 * aFlash;
#endif
#ifdef T_EMIT
  vEmit = aEmit;
#endif
#if defined(T_SWAY) && defined(USE_INSTANCING)
  { vec2 ip = instanceMatrix[3].xz; float hh = max(transformed.y, 0.0);
    float w = sin(tTime * 1.7 + ip.x * 0.37 + ip.y * 0.23) + 0.5 * sin(tTime * 2.9 + ip.x * 0.11 - ip.y * 0.31);
    transformed.xz += vec2(0.8, 0.45) * w * hh * hh * 0.012 * tSway; }
#endif`)
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vec4 tw = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  tw = instanceMatrix * tw;\n  #endif\n  vTWorld = (modelMatrix * tw).xyz;');
      sh.fragmentShader = head + '\n' + sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTWorld; uniform sampler2D tMask, tLight; uniform float tOff, tAmount, tDark, tLightS, tLightK, tEmitK, tTime, tAO, tFront, tNight;
uniform vec2 tLightO; uniform vec3 tEmitCol, tFogCol, tCyan; uniform vec4 tRim, tMist, tScan;
#ifdef T_EMIT
varying float vEmit;
#endif
#ifdef T_FLASH
varying float vFlash;
#endif
${NOISE}
${o.fragHead || ''}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
${o.fragColor || ''}`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  vec4 tM = texture2D(tMask, (vTWorld.xz + tOff) / 512.0);
  float tLow = 1.0 - smoothstep(0.02, 0.7, vTWorld.y);
  gl_FragColor.rgb *= mix(1.0, 0.25 + 0.75 * tM.a, tLow * tAO);
  float own = tM.r, wild = (1.0 - smoothstep(0.25, 0.75, own)) * tAmount;
  vec3 c = gl_FragColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb = mix(c, mix(vec3(l), c, 0.55) * vec3(0.92, 0.97, 1.06) * tDark, wild);
#ifdef STANDARD
  if (tLightK > 0.001) {
    vec2 lUv = (vTWorld.xz - tLightO) / tLightS; lUv.y = 1.0 - lUv.y;
    vec2 eg = smoothstep(0.0, 0.08, lUv) * smoothstep(1.0, 0.92, lUv);
    vec3 lp = texture2D(tLight, lUv).rgb * (tLightK * eg.x * eg.y);
    float up = dot(normal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    gl_FragColor.rgb += diffuseColor.rgb * lp * exp(-max(vTWorld.y, 0.0) * 0.32) * (0.5 + 0.5 * max(up, 0.0));
  }
#endif
#ifdef T_EMIT
  gl_FragColor.rgb += tEmitCol * vEmit * tEmitK;
#endif
#ifdef T_RIM
  float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
  gl_FragColor.rgb += tRim.rgb * rim * tRim.a;
#endif
#ifdef T_FLASH
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(2.4, 2.3, 2.2), vFlash);
#endif
  float mist = tMist.a * exp(-max(vTWorld.y, 0.0) * 1.5) * (0.5 + 0.5 * tNoise(vTWorld.xz * 0.08 + tTime * vec2(0.035, 0.02)));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, tMist.rgb, clamp(mist, 0.0, 1.0));
#ifndef T_NOFOG
  // the System's fog of war: unexplored land is a dim navy blueprint with a faint cyan grid;
  // the frontier is a living cyan line, and new ground lights up under a scan wave
  float sw = tM.g + (tNoise(vTWorld.xz * 0.42 + tTime * 0.12) - 0.5) * 0.3;
  float seen = smoothstep(0.36, 0.6, sw);
  if (seen < 0.999 || tScan.w > 0.001) {
    float gl = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec2 gq = abs(fract(vTWorld.xz * 0.5) - 0.5);
    float grid = smoothstep(0.455, 0.49, max(gq.x, gq.y));
    vec3 bp = (tFogCol * (0.75 + 0.5 * tNoise(vTWorld.xz * 0.06)) + gl * vec3(0.10, 0.14, 0.22) + tCyan * grid * 0.04) * (1.0 - 0.6 * tNight);
    float front = smoothstep(0.11, 0.0, abs(sw - 0.48)) * tFront;
    float sd = distance(vTWorld.xz, tScan.xy);
    float scan = tScan.w * smoothstep(1.4, 0.0, abs(sd - tScan.z)) * smoothstep(tScan.z + 1.0, tScan.z - 6.0, sd);
    gl_FragColor.rgb = mix(bp, gl_FragColor.rgb, seen) + tCyan * (front * 0.55 + scan * 0.5 * seen);
  }
#endif`);
    };
    m.customProgramCacheKey = () => 'territory|' + defs.join(',');
    return m;
  }
  // shared materials the renderer animates by night: lit windows and searchlight lenses
  const WIN = new THREE.MeshStandardMaterial({ color: lin('#3c454a'), roughness: 0.4, emissive: lin('#ffb45c'), emissiveIntensity: 0 });
  const LENS = new THREE.MeshStandardMaterial({ color: lin('#d8d1c2'), roughness: 0.3, emissive: lin('#fff1d0'), emissiveIntensity: 0.2 });
  // bulbs and lanterns follow the windows: their glow is read straight from WIN at render time (no per-frame work)
  const glowWith = (m, k, base) => Object.defineProperty(m, 'emissiveIntensity', { get: () => base + WIN.emissiveIntensity * k, set() {}, configurable: true });
  const BULB = glowWith(new THREE.MeshStandardMaterial({ color: lin('#f6e6bd'), roughness: 0.4, emissive: lin('#ffc468') }), 1.6, 0.12);
  const LANTERN = glowWith(new THREE.MeshStandardMaterial({ color: lin('#7d6c50'), roughness: 0.5, emissive: lin('#ff9038') }), 0.5, 0);
  const VCM = territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }), { emit: true });
  // how strongly each night-lit material glows once merged into a vertex-coloured model
  const EMITW = new Map([[WIN, 1.0], [LANTERN, 0.6], [BULB, 1.7], [LENS, 1.3]]);
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
    // Every plain colour (a palette key, '#hex', or a plain lit material) is merged into ONE vertex-coloured mesh, so a
    // many-coloured model costs a single draw call. Glowing parts (windows, lanterns, bulbs) join it too: they carry
    // aEmit and light up with the town at dusk. Grounding: vertex colours darken toward the model's base (aoH: the
    // height in model units over which the darkening fades) and on faces turned to the ground.
    // o.vc = false keeps one mesh per material (old behaviour); o.ao = aoH; o.aoMin = darkest; o.cast = shadows.
    build(o = {}) {
      const g = new THREE.Group();
      let parts = [...this.parts.values()];
      if (o.vc !== false) {
        const rest = [], list = [], aoH = o.ao ?? 1.4, aoMin = o.aoMin ?? 0.6;
        for (const p of parts) {
          const mt = p.mat, em = EMITW.get(mt) || 0;
          const plainLit = mt.isMeshStandardMaterial && !mt.transparent && !mt.map && mt.side === THREE.FrontSide && !mt.vertexColors && (em > 0 || !(mt.emissive && mt.emissive.r + mt.emissive.g + mt.emissive.b > 0 && mt.emissiveIntensity > 0));
          if (!plainLit) { rest.push(p); continue; }
          const c = mt.color;
          for (let gg of p.list) {
            if (gg.attributes.uv) gg.deleteAttribute('uv');
            if (mt.flatShading) gg.computeVertexNormals();
            const pa = gg.attributes.position, na = gg.attributes.normal, n = pa.count, a = new Float32Array(n * 3), e = new Float32Array(n);
            for (let i = 0; i < n; i++) {
              let k = 1;
              if (!em) { const y = pa.getY(i), t = Math.min(1, Math.max(0, y / aoH)); k = aoMin + (1 - aoMin) * t * t * (3 - 2 * t); const ny = na.getY(i); if (ny < -0.3) k *= 0.78; else if (ny > 0.6) k *= 1.04; }
              a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; e[i] = em;
            }
            gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); gg.setAttribute('aEmit', new THREE.BufferAttribute(e, 1));
            list.push(gg);
          }
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
      for (const [a, c, m] of [[-1, -1, '#7a5a3c'], [1, -1, '#6a5a48'], [-1, 1, '#6a5a48'], [1, 1, '#86654a']]) b.box(m, 0.13, H, 0.13, a * h, 0, c * h, { r: 0.02, rz: a * 0.02 });
      rod(b, '#6f5a45', [-h, 0.3, h], [h, 2.3, h], 0.08); rod(b, '#7a5a3c', [h, 0.5, -h], [h, 2.6, h], 0.07); rod(b, '#5a4535', [-h, 2.4, -h], [h, 0.4, -h], 0.08); rod(b, '#6c4f35', [-h, 0.2, -h], [-h, 2.0, h], 0.07);
      for (const y of [2.1]) { rod(b, '#6f675b', [-h, y, h], [h, y + 0.05, h], 0.07); rod(b, '#6f675b', [h, y, h], [h, y - 0.04, -h], 0.07); }
      for (let k = 0; k < 4; k++) b.cbox(['#8a7356', '#6f675b', '#7b6a52'][k % 3], sz + 0.45, 0.1, 0.52, (r() - 0.5) * 0.12, H + 0.05, -h - 0.05 + k * 0.62, { r: 0.01, ry: (r() - 0.5) * 0.06 });
      bagRow(b, 0, h + 0.05, sz + 0.3, 2, 0, r, H + 0.1); bagRow(b, h + 0.05, 0, sz + 0.3, 2, Math.PI / 2, r, H + 0.1);
      for (const z of [-h - 0.1, h - 0.4]) b.box('#5a5045', 0.07, 1.25, 0.07, -h - 0.15, H + 0.1, z, { r: 0.01 });
      b.cbox('#6f8a8c', 0.04, 0.95, sz + 0.1, -h - 0.18, H + 0.75, -0.25, { r: 0.006, rz: 0.08 });
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
      // thriving: a tall timber lookout — log legs braced in two stages, a plank-walled platform, a shingle roof,
      // a brazier and the camp's banners
      H = 7.4; const sz = 2.8, h = sz / 2, roofC = '#5a4636';
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(b, ['#7a5a3c', '#6c4f35'][(a + c + 2) / 2 % 2], [a * (h + 0.5), 0, c * (h + 0.5)], [a * h, H, c * h], 0.26);
      for (const [y0, y1, k0, k1] of [[0.4, 3.6, 0.45, 0.25], [3.8, 7.0, 0.24, 0.02]]) for (const [p, q] of [[[-1, 1], [1, 1]], [[1, -1], [1, 1]], [[-1, -1], [1, -1]], [[-1, -1], [-1, 1]]]) { rod(b, '#5f4530', [p[0] * (h + k0), y0, p[1] * (h + k0)], [q[0] * (h + k1), y1, q[1] * (h + k1)], 0.1); rod(b, '#5f4530', [q[0] * (h + k0), y0, q[1] * (h + k0)], [p[0] * (h + k1), y1, p[1] * (h + k1)], 0.1); }
      b.box('#86654a', sz + 1.0, 0.18, sz + 1.0, 0, H, 0, { r: 0.03 });
      const ph = h + 0.45;
      for (const s2 of [-1, 1]) { for (let k = 0; k < 3; k++) { b.cbox(k % 2 ? '#7a5a3c' : '#86654a', sz + 0.95, 0.3, 0.12, 0, H + 0.35 + k * 0.32, s2 * ph, { r: 0.02 }); b.cbox(k % 2 ? '#86654a' : '#7a5a3c', 0.12, 0.3, sz + 0.95, s2 * ph, H + 0.35 + k * 0.32, 0, { r: 0.02 }); } }
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box('#5f4530', 0.16, 2.3, 0.16, a * ph, H + 0.1, c * ph, { r: 0.02 });
      b.geo(roofC, new THREE.ConeGeometry((ph + 0.5) * Math.SQRT2, 1.8, 4), 0, H + 3.3, 0, 0, Math.PI / 4, 0);
      b.cbox('#3e3026', 0.3, 0.6, 0.3, 0, H + 4.35, 0, { r: 0.04 });
      flag(b, 0, H + 4.5, 0, 1.6, 1.2);
      // the brazier at the front corner and a lantern on the other
      b.cyl('#3a3836', 0.38, 0.26, 0.45, ph - 0.4, H + 1.1, ph - 0.4, { seg: 8 }); b.cbox(LANTERN, 0.5, 0.18, 0.5, ph - 0.4, H + 1.6, ph - 0.4, { r: 0.05 });
      b.cbox(LANTERN, 0.2, 0.28, 0.2, -ph, H + 1.9, -ph + 0.3, { r: 0.03 });
      // two long banners in the camp colour hanging off the platform
      for (const s2 of [-1, 1]) { b.cbox('amber', 0.06, 2.4, 0.8, s2 * (ph + 0.08), H - 1.15, 0, { r: 0.006 }); b.geo('amber', PEN, s2 * (ph + 0.08), H - 2.35, 0, 0, Math.PI / 2, 0, 2.3, 1.2, 1); }
      // a ladder, sandbags and a barrel at the foot
      for (const s2 of [-0.3, 0.3]) rod(b, '#6a5848', [s2, 0, h + 1.3], [s2, H, h + 0.5], 0.07);
      for (let k = 1; k < 12; k++) { const t = k / 12; b.cbox('#7b6a52', 0.66, 0.06, 0.07, 0, H * t, h + 1.3 - 0.8 * t, { r: 0.005 }); }
      bagRow(b, -h - 0.4, 0, 2.4, 2, Math.PI / 2, r); drum(b, '#6a5440', h + 0.9, -h - 0.4, 0.9);
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
  // ======================================================================
  // THE FRONTIER KIT: timber, tarp and canvas. Everything the camp builds speaks one language.
  // ======================================================================
  const TIMBER = ['#7a5a3c', '#6c4f35', '#86654a', '#5f4530'], TARP = '#6f8a8c', CANVAS = '#d8c9a4', CANVAS2 = '#c9b78e', SHINGLE = '#5a4636', STONE = '#8f8a80';
  /** a log lying along x (axis 'x') or z, centred on (x, y, z) */
  function log(b, col, len, r, x, y, z, axis = 'x', seg = 6) { b.geo(col, new THREE.CylinderGeometry(r, r * 1.06, len, seg, 1, false), x, y, z, axis === 'x' ? 0 : Math.PI / 2, 0, axis === 'x' ? Math.PI / 2 : 0); }
  /** a wall of stacked logs from (x0, z0) to (x1, z1), h tall, alternating tones */
  function logWall(b, x0, z0, x1, z1, h, r = 0.17, y0 = 0, tones = TIMBER) {
    const len = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 'x' : 'z', n = Math.max(1, Math.round(h / (r * 1.8)));
    for (let k = 0; k < n; k++) log(b, tones[k % tones.length], len + r * 1.6, r, (x0 + x1) / 2, y0 + r + k * r * 1.8, (z0 + z1) / 2, ax);
  }
  function fireRing(b, x, z, s = 1) {
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; b.sph(k % 2 ? STONE : '#7c776d', 0.2 * s, x + Math.cos(a) * 0.62 * s, 0.08 * s, z + Math.sin(a) * 0.62 * s, { detail: 0, sy: 0.7 }); }
    for (let k = 0; k < 4; k++) { const a = k * 0.8 + 0.3; b.geo('#4a3626', new THREE.CylinderGeometry(0.07 * s, 0.08 * s, 0.9 * s, 5), x, 0.18 * s, z, 0.9, a, 0); }
    b.cbox('#2a2220', 0.8 * s, 0.04, 0.8 * s, x, 0.02, z, { r: 0.02 });
  }
  /** the flames of a fire: emissive cones (they bloom at night and burn by day) */
  function flames(g, x, z, s = 1, y = 0.15) {
    const m1 = new THREE.MeshBasicMaterial({ color: lin('#ff9a3a').multiplyScalar(3) }), m2 = new THREE.MeshBasicMaterial({ color: lin('#ffe0a0').multiplyScalar(4) });
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.34 * s, 1.0 * s, 6), m1); f1.position.set(x, y + 0.5 * s, z); g.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.2 * s, 0.7 * s, 5), m2); f2.position.set(x + 0.08 * s, y + 0.38 * s, z - 0.05 * s); g.add(f2);
    g.userData.flames = (g.userData.flames || []).concat([f1, f2]);
  }
  function bench(b, x, z, ry, len = 1.6) { const c = Math.cos(ry), s2 = Math.sin(ry); log(b, TIMBER[(len * 10 | 0) % 4], len, 0.17, x, 0.2, z, Math.abs(c) > 0.7 ? 'x' : 'z'); }
  function crate(b, x, z, s = 1, y = 0, ry = 0) { b.box('#8a6a48', 0.7 * s, 0.6 * s, 0.6 * s, x, y, z, { r: 0.03, ry }); b.cbox('#6b5038', 0.72 * s, 0.08 * s, 0.62 * s, x, y + 0.3 * s, z, { r: 0.01, ry }); }
  function barrel(b, x, z, col = '#6a5440', s = 1) { b.cyl(col, 0.3 * s, 0.28 * s, 0.85 * s, x, 0, z, { seg: 8 }); for (const t of [0.15, 0.68]) b.cyl('#3f3a35', 0.31 * s, 0.31 * s, 0.05 * s, x, t * s, z, { seg: 8 }); }
  function lanternPost(b, x, z, h = 2.1) { b.box(TIMBER[1], 0.09, h, 0.09, x, 0, z, { r: 0.02 }); b.cbox(TIMBER[0], 0.5, 0.07, 0.07, x + 0.22, h - 0.05, z, { r: 0.01 }); b.cbox(LANTERN, 0.16, 0.22, 0.16, x + 0.42, h - 0.25, z, { r: 0.03 }); b.cbox('#2f2c29', 0.2, 0.05, 0.2, x + 0.42, h - 0.12, z, { r: 0.01 }); }
  /** a tarp stretched between four corners [x, y, z] (two triangles, slightly sagging) */
  function tarp(b, col, a, c, d, e) { const s = new THREE.BufferGeometry(); const mid = [(a[0] + c[0] + d[0] + e[0]) / 4, (a[1] + c[1] + d[1] + e[1]) / 4 - 0.12, (a[2] + c[2] + d[2] + e[2]) / 4]; const P = [a, c, mid, c, d, mid, d, e, mid, e, a, mid].flat(); s.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); s.computeVertexNormals(); b.geo(col, s); const s2 = s.clone(); const p2 = s2.attributes.position; for (let i = 0; i < p2.count; i += 3) { const t = [p2.getX(i + 1), p2.getY(i + 1), p2.getZ(i + 1)]; p2.setXYZ(i + 1, p2.getX(i + 2), p2.getY(i + 2), p2.getZ(i + 2)); p2.setXYZ(i + 2, ...t); } s2.computeVertexNormals(); b.geo(shade(col, -0.12), s2); }
  function pennants(b, p, q, n) { bunting(b, p, q, n, 0.25, ['#f0a040', '#d8c9a4', '#c9702e', '#f4ead2']); }
  /** a school bus that stalled here: faded yellow, flat tyres, roof rack of salvage */
  function busInto(b, x, z, ry, o = {}) {
    const c = Math.cos(ry), s2 = Math.sin(ry), P = (u, w) => [x + u * c + w * s2, z - u * s2 + w * c];
    const L = 11, Wd = 2.5, body = o.color || '#d9a441', at = (u, w, y, wx, hy, dz, col, r = 0.06) => { const [px, pz] = P(u, w); b.cbox(col, wx, hy, dz, px, y, pz, { r, ry }); };
    at(0, 0, 1.75, L, 2.4, Wd, body, 0.3);
    at(-0.3, 0, 2.15, L - 2.6, 0.9, Wd + 0.03, '#3a4648', 0.08);   // window band
    for (let k = 0; k < 7; k++) at(-4.1 + k * 1.25, 0, 2.15, 0.12, 0.95, Wd + 0.06, body, 0.02);
    at(0, 0, 1.25, L + 0.03, 0.22, Wd + 0.05, '#2f2c29', 0.04);   // black rub strip
    at(L / 2 + 0.6, 0, 0.95, 1.4, 1.2, Wd - 0.1, body, 0.25); at(L / 2 + 1.25, 0, 0.9, 0.1, 0.5, Wd - 0.6, '#3a3836', 0.02);   // the nose
    at(L / 2 + 0.05, 0, 2.1, 0.08, 1.1, Wd - 0.3, '#3a4648', 0.02);
    at(-L / 2 - 0.02, 0, 1.0, 0.1, 0.25, 0.6, '#c0462f', 0.02);
    for (const u of [-3.4, 3.8]) for (const w of [-1.2, 1.2]) { const [px, pz] = P(u, w); b.geo('tyre', new THREE.CylinderGeometry(0.5, 0.5, 0.32, 10), px, 0.45, pz, Math.PI / 2, ry, 0, 1, 1, 0.92); }
    // roof rack: salvage, a rolled tarp, crates
    at(-1, 0, 3.02, 6, 0.08, Wd - 0.3, '#4a4440', 0.02);
    at(-2.6, 0.2, 3.3, 1.0, 0.5, 0.8, '#8a6a48', 0.04); at(-1.2, -0.3, 3.25, 0.8, 0.4, 0.7, '#6b5038', 0.04);
    const [rx, rz] = P(0.6, 0); log(b, TARP, 2.2, 0.22, rx, 3.3, rz, Math.abs(c) > 0.7 ? 'z' : 'x');
  }

  /**
   * the hall: the heart of the camp, by level.
   *   1 — the stalled bus with tarps stretched off it, a campfire ringed with log benches
   *   2 — a timber longhouse built round the bus (its nose still sticks out of the end wall), a porch and lit windows
   *   3 — the palisaded lodge: a bigger hall with a lookout loft, a stake palisade with a gate, braziers and banners
   * Front faces -z (the view turns it to face the camera). userData.fires: [[x, y, z, r]] in model metres.
   */
  function hall(o = {}) {
    const lvl = o.level || 1, g = new THREE.Group(), b = new B(), r = rng(91 + lvl);
    const fires = [];
    // packed earth yard
    b.cbox('#8f7a5c', 19, 0.06, 15, 0, 0.03, -0.5, { r: 0.4 });
    if (lvl === 1) {
      busInto(b, 0.5, 2.8, 0);
      // tarps off the bus roof to poles in front: the camp's first shelter
      for (const [x0, x1] of [[-5, -1.2], [-0.8, 3.4]]) {
        for (const x of [x0, x1]) b.box(TIMBER[2], 0.12, 2.1, 0.12, x, 0, -0.9, { r: 0.02, rz: (r() - 0.5) * 0.06 });
        tarp(b, x0 < -2 ? TARP : CANVAS2, [x0, 2.9, 1.6], [x1, 2.9, 1.6], [x1, 2.1, -0.9], [x0, 2.1, -0.9]);
      }
      // bedrolls and crates under the tarps
      for (let k = 0; k < 4; k++) b.cbox(['#7a5a48', '#5d6b6a', '#8a7a5a', '#6b4a3a'][k], 0.7, 0.16, 1.7, -4.2 + k * 1.15, 0.08, 0.5, { r: 0.07 });
      crate(b, 2.6, 0.9); crate(b, 3.2, 0.4, 0.8, 0, 0.4); barrel(b, 4.4, 1.2); barrel(b, 4.9, 0.6, '#59625e');
      // the campfire and its benches
      const fx = 0.5, fz = -3.6; fireRing(b, fx, fz); fires.push([fx, 0.4, fz, 5]);
      bench(b, fx - 2.0, fz, Math.PI / 2, 2.2); bench(b, fx + 2.1, fz - 0.2, Math.PI / 2, 2.0); bench(b, fx, fz - 2.1, 0, 2.4);
      b.cbox('#6b5038', 0.5, 0.5, 0.5, fx + 1.4, 0.25, fz + 1.5, { r: 0.04, ry: 0.4 });
      // a cooking tripod over the fire
      for (let k = 0; k < 3; k++) { const a = k * 2.1; rod(b, '#3a2f28', [fx + Math.cos(a) * 0.8, 0, fz + Math.sin(a) * 0.8], [fx, 1.7, fz], 0.05); }
      b.cyl('#3a3836', 0.22, 0.18, 0.3, fx, 0.95, fz, { seg: 8 });
      lanternPost(b, -5.8, -2.5); lanternPost(b, 6, -1.8);
      flag(b, 6.3, 0, 2.6, 4.2, 1.3);
      // the woodpile and a chopping block
      for (let k = 0; k < 9; k++) log(b, TIMBER[k % 4], 1.3, 0.14, -7.2, 0.15 + Math.floor(k / 3) * 0.26, 1.6 + (k % 3) * 0.3, 'x');
      b.cyl('#6b5038', 0.32, 0.36, 0.5, -6.6, 0, -0.6, { seg: 8 });
    } else {
      // the longhouse: log walls on a stone footing, a shingle roof, the bus's yellow nose out of the east end
      const hw = lvl === 2 ? 13 : 15, hd = lvl === 2 ? 6.4 : 7.2, wh = lvl === 2 ? 2.9 : 3.3, cz = 2.2;
      busInto(b, 1.5, cz, 0);
      b.box(STONE, hw + 0.4, 0.4, hd + 0.4, 0, 0, cz, { r: 0.06 });
      for (const s of [-1, 1]) logWall(b, -hw / 2, cz + s * hd / 2, hw / 2 - (s < 0 ? 0 : 0), cz + s * hd / 2, wh, 0.19, 0.4);
      // west end wall closed; east end wall with a gap the bus nose fills
      logWall(b, -hw / 2, cz - hd / 2, -hw / 2, cz + hd / 2, wh, 0.19, 0.4);
      for (const s of [-1, 1]) logWall(b, hw / 2, cz + s * hd / 2, hw / 2, cz + s * 1.5, wh, 0.19, 0.4);
      logWall(b, hw / 2, cz - 1.5, hw / 2, cz + 1.5, 0.6, 0.19, wh - 0.2);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(TIMBER[3], 0.4, wh + 0.4, 0.4, x * hw / 2, 0, cz + z * hd / 2, { r: 0.05 });
      // windows (warm by night) and the door under the porch
      for (const x of [-4.4, -1.6, 1.6, 4.4]) { if (x === 1.6 && lvl === 2) continue; b.cbox(WIN, 1.0, 0.9, 0.08, x, 1.9, cz - hd / 2 - 0.16, { r: 0.01 }); b.cbox(TIMBER[0], 1.25, 0.12, 0.22, x, 1.4, cz - hd / 2 - 0.2, { r: 0.02 }); b.cbox(TIMBER[0], 1.25, 0.12, 0.22, x, 2.42, cz - hd / 2 - 0.2, { r: 0.02 }); }
      b.cbox('#4a3626', 1.4, 2.2, 0.1, 0, 1.5, cz - hd / 2 - 0.16, { r: 0.01 }); b.cbox(WIN, 1.1, 0.25, 0.06, 0, 2.75, cz - hd / 2 - 0.2, { r: 0.01 });
      for (const x of [-3, 3]) b.cbox(WIN, 0.9, 0.8, 0.08, x, 1.9, cz + hd / 2 + 0.16, { r: 0.01 });
      // roof: two shingle slabs with a ridge and a smoke hole
      const pitch = lvl === 2 ? 2.6 : 3.0, H = wh + 0.4;
      const ov = 0.6, run = hd / 2 + ov, a = Math.atan2(pitch, run), Lr = Math.hypot(run, pitch) + 0.1;
      for (const s of [-1, 1]) { b.cbox(SHINGLE, hw + 1.2, 0.2, Lr, 0, H + pitch / 2, cz + s * run / 2, { r: 0.04, rx: s * a }); for (let k = 1; k < 5; k++) b.cbox(shade(SHINGLE, -0.05), hw + 1.22, 0.05, 0.08, 0, H + pitch * (1 - k / 5) + 0.12, cz + s * run * k / 5, { r: 0.01 }); }
      b.cbox('#3e3026', hw + 1.3, 0.3, 0.4, 0, H + pitch + 0.05, cz, { r: 0.05 });
      { const sg = new THREE.Shape(); sg.moveTo(-hd / 2, 0); sg.lineTo(hd / 2, 0); sg.lineTo(0, pitch); sg.closePath(); const eg = new THREE.ExtrudeGeometry(sg, { depth: 0.3, bevelEnabled: false }); for (const x of [-hw / 2 - 0.15, hw / 2 - 0.15]) b.geo(TIMBER[2], eg, x, H, cz, 0, Math.PI / 2, 0); }
      b.cbox('#2a2422', 1.2, 0.5, 1.0, -2.5, H + pitch - 0.1, cz, { r: 0.04 }); fires.push([-2.5, H + pitch, cz, 0]);
      // porch: posts and a lean-to roof over the door
      for (const x of [-2.4, 2.4]) b.box(TIMBER[1], 0.22, 2.6, 0.22, x, 0, cz - hd / 2 - 2.0, { r: 0.04 });
      b.cbox(SHINGLE, 6, 0.15, 2.5, 0, 2.75, cz - hd / 2 - 1.05, { r: 0.03, rx: -0.2 });
      b.cbox(TIMBER[2], 5.2, 0.1, 2.1, 0, 0.45, cz - hd / 2 - 1.0, { r: 0.02 });
      b.cbox(LANTERN, 0.2, 0.28, 0.2, -2.4, 2.25, cz - hd / 2 - 2.0, { r: 0.03 }); b.cbox(LANTERN, 0.2, 0.28, 0.2, 2.4, 2.25, cz - hd / 2 - 2.0, { r: 0.03 });
      // amber banners either side of the door
      for (const x of [-3.4, 3.4]) { b.cbox('amber', 0.9, 2.0, 0.06, x, 2.1, cz - hd / 2 - 0.3, { r: 0.01 }); b.geo('amber', PEN, x, 1.1, cz - hd / 2 - 0.3, 0, 0, 0, 2.6, 1.3, 1); }
      // the yard fire, benches, the woodpile along the west wall
      const fx = 0, fz = -5.2; fireRing(b, fx, fz, 1.1); fires.push([fx, 0.4, fz, 5.5]);
      bench(b, fx - 2.2, fz, Math.PI / 2, 2.2); bench(b, fx + 2.2, fz, Math.PI / 2, 2.2); bench(b, fx, fz - 2.1, 0, 2.6);
      for (let k = 0; k < 12; k++) log(b, TIMBER[k % 4], 1.3, 0.14, -hw / 2 - 0.9, 0.15 + Math.floor(k / 4) * 0.26, cz - 1.5 + (k % 4) * 0.3 + 1, 'x');
      barrel(b, hw / 2 + 0.9, cz - 3.4); crate(b, hw / 2 + 1.0, cz - 2.4, 0.9);
      if (lvl === 2) { lanternPost(b, -6, -5.6); lanternPost(b, 6.2, -5.4); flag(b, -hw / 2 - 0.4, 0, cz - hd / 2 - 0.4, 5.2, 1.5); pennants(b, [-2.4, 2.6, cz - hd / 2 - 2.0], [-6, 2.0, -5.6], 6); pennants(b, [2.4, 2.6, cz - hd / 2 - 2.0], [6.2, 2.0, -5.4], 6); }
      if (lvl === 3) {
        // a lookout loft on the roof: posts, a rail, a little roof, a lantern
        const lx = 3.5, ly = H + pitch - 0.2;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(TIMBER[1], 0.16, 2.2, 0.16, lx + x * 1.1, ly, cz + z * 1.1, { r: 0.02 });
        b.cbox(TIMBER[2], 2.6, 0.12, 2.6, lx, ly + 0.2, cz, { r: 0.02 }); for (const s of [-1, 1]) { b.cbox(TIMBER[0], 2.5, 0.09, 0.09, lx, ly + 1.1, cz + s * 1.1, { r: 0.01 }); b.cbox(TIMBER[0], 0.09, 0.09, 2.5, lx + s * 1.1, ly + 1.1, cz, { r: 0.01 }); }
        b.geo(SHINGLE, new THREE.ConeGeometry(2.0, 1.2, 4), lx, ly + 2.8, cz, 0, Math.PI / 4, 0);
        b.cbox(LANTERN, 0.22, 0.3, 0.22, lx, ly + 1.7, cz, { r: 0.03 });
        flag(b, lx, ly + 3.3, cz, 2.2, 1.6);
        // the palisade: sharpened stakes round the yard, a gate in front with two braziers
        const PX = 9.2, PZ0 = -8.4, PZ1 = 6.9, stake = (x, z, k) => { const hh = 2.6 + ((k * 7) % 5) * 0.12; b.cyl(TIMBER[k % 4], 0.19, 0.21, hh, x, 0, z, { seg: 6 }); b.geo(TIMBER[(k + 1) % 4], new THREE.ConeGeometry(0.2, 0.5, 6), x, hh + 0.25, z); };
        let k = 0;
        for (let x = -PX; x <= PX + 0.01; x += 0.42) { if (Math.abs(x) > 1.9) stake(x, PZ0, k++); stake(x, PZ1, k++); }
        for (let z = PZ0 + 0.42; z < PZ1; z += 0.42) { stake(-PX, z, k++); stake(PX, z, k++); }
        for (const s of [-1, 1]) for (const y of [0.8, 2.0]) b.cbox(TIMBER[3], 0.12, 0.16, PZ1 - PZ0, s * (PX - 0.25), y, (PZ0 + PZ1) / 2, { r: 0.02 });
        // the gate: two big posts, a lintel with the camp's banner, braziers
        for (const s of [-1, 1]) { b.box(TIMBER[1], 0.42, 3.8, 0.42, s * 2.1, 0, PZ0, { r: 0.05 }); b.cyl('#3a3836', 0.32, 0.22, 0.5, s * 2.9, 0.7, PZ0 - 0.5, { seg: 8 }); b.box('#3a3836', 0.1, 0.7, 0.1, s * 2.9, 0, PZ0 - 0.5); fires.push([s * 2.9, 1.3, PZ0 - 0.5, 3.2]); }
        b.cbox(TIMBER[0], 4.8, 0.36, 0.42, 0, 3.7, PZ0, { r: 0.04 }); b.cbox('amber', 2.2, 0.9, 0.08, 0, 3.0, PZ0 - 0.26, { r: 0.01 });
        // string lights from the porch to the gate
        lights(b, [-2.4, 2.65, cz - hd / 2 - 2.0], [-2.1, 3.5, PZ0], 6, 0.35); lights(b, [2.4, 2.65, cz - hd / 2 - 2.0], [2.1, 3.5, PZ0], 6, 0.35);
        pennants(b, [-PX, 3.1, PZ0], [-2.1, 3.6, PZ0], 9); pennants(b, [2.1, 3.6, PZ0], [PX, 3.1, PZ0], 9);
        barrel(b, -7.5, -6.8, '#59625e'); crate(b, 7.4, -7, 0.9); crate(b, 7.9, -6.3, 0.7, 0, 0.6);
      }
    }
    g.add(b.build({ ao: 1.6, aoMin: 0.55 }));
    for (const f of fires) if (f[3] > 0) flames(g, f[0], f[2], f[3] > 4 ? 1.1 : 0.7, f[1] - 0.3);
    g.userData.fires = fires.filter(f => f[3] > 0);
    g.userData.smoke = fires.filter(f => f[3] === 0);
    return g;
  }

  /** homes: 1 a canvas tent with a tarp lean-to, 2 a log cabin with a chimney, 3 a bigger cabin with a porch and lit windows. Front +z. */
  function home(o = {}) {
    const lvl = o.level || 1, b = new B(), r = rng(o.seed || 21), v = (o.seed || 0) % 4;
    const tones = [CANVAS, CANVAS2, '#c7b99a', '#b9a888'];
    if (lvl === 1) {
      // an A-frame canvas tent, guy ropes, a patched tarp lean-to, bedroll and a small fire ring
      const tw = 3.6, td = 4.6, th = 2.6, col = tones[v];
      const s = new THREE.Shape(); s.moveTo(-tw / 2, 0); s.lineTo(tw / 2, 0); s.lineTo(0, th); s.closePath();
      const tg = new THREE.ExtrudeGeometry(s, { depth: td, bevelEnabled: false }); tg.translate(0, 0, -td / 2); b.geo(col, tg, -0.6, 0, -0.3);
      b.geo(shade(col, -0.06), new THREE.BoxGeometry(0.6, 0.6, 0.02), -0.6 + 0.9, 1.1, -0.3 + td / 2 + 0.01, 0, 0, Math.atan2(th, tw / 2) - Math.PI / 2);
      b.cbox('#3a3028', 1.1, 1.5, 0.04, -0.6, 0.75, -0.3 + td / 2 + 0.02, { r: 0.01 });   // the open flap
      b.cbox('#7a5a48', 0.06, th + 0.3, 0.06, -0.6, th / 2, -0.3 + td / 2 + 0.05, { r: 0.01 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(b, '#d8d1c2', [-0.6 + sx * tw * 0.3, th * 0.45, -0.3 + sz * td * 0.42], [-0.6 + sx * (tw / 2 + 0.9), 0.02, -0.3 + sz * td * 0.48], 0.02);
      // lean-to tarp on two poles at the side, sacks and crates under it
      const lx = 2.0;
      for (const z of [-1.4, 1.2]) b.box(TIMBER[(z > 0) + 1], 0.09, 1.7, 0.09, lx + 0.9, 0, z, { r: 0.02 });
      tarp(b, v % 2 ? TARP : '#7f7a5e', [lx - 0.6, 1.25, -1.4], [lx - 0.6, 1.25, 1.2], [lx + 0.9, 1.7, 1.2], [lx + 0.9, 1.7, -1.4]);
      crate(b, lx + 0.2, -0.6, 0.8); for (let k = 0; k < 3; k++) b.sph('bag', 0.26, lx + 0.1 + (k % 2) * 0.4, 0.22, 0.4 + k * 0.25, { detail: 0, sy: 0.75 });
      b.cbox('#7a5a48', 0.6, 0.14, 1.6, -0.6, 0.07, td / 2 + 0.8, { r: 0.07, ry: 0.2 });
      fireRing(b, 0.9, td / 2 + 1.4, 0.55);
      b.cbox(LANTERN, 0.14, 0.2, 0.14, -0.6, th - 0.25, -0.3 + td / 2 + 0.12, { r: 0.02 });
      return b.build({ ao: 1.1, aoMin: 0.6 });
    }
    // cabins
    const w = lvl === 2 ? 5.2 : 6.0, d = lvl === 2 ? 4.8 : 5.4, wh = lvl === 2 ? 2.5 : 2.8, ox = lvl === 2 ? 0 : -0.2;
    const logTones = lvl === 2 ? TIMBER : ['#8a6644', '#7c5b3c', '#957050', '#6e5136'];
    b.box(STONE, w + 0.3, 0.35, d + 0.3, ox, 0, 0, { r: 0.05 });
    logWall(b, ox - w / 2, -d / 2, ox + w / 2, -d / 2, wh, 0.16, 0.35, logTones); logWall(b, ox - w / 2, d / 2, ox + w / 2, d / 2, wh, 0.16, 0.35, logTones);
    logWall(b, ox - w / 2, -d / 2, ox - w / 2, d / 2, wh, 0.16, 0.35, logTones); logWall(b, ox + w / 2, -d / 2, ox + w / 2, d / 2, wh, 0.16, 0.35, logTones);
    const H = wh + 0.35, pitch = lvl === 2 ? 1.9 : 2.2, roof = lvl === 2 ? ['#5a4636', '#4f4a44', '#5d4a3a', '#6a5040'][v] : ['#7a4a36', '#3d5a5c', '#6a3a30', '#4a5a3c'][v];
    // windows and door on the front (+z)
    const win = (x, y, z, s = 1, ww = 1.0, hh = 0.95) => { b.cbox(WIN, ww, hh, 0.08, x, y, z, { r: 0.01 }); b.cbox(TIMBER[0], ww + 0.24, 0.1, 0.2, x, y - hh / 2 - 0.04, z + s * 0.06, { r: 0.02 }); b.cbox(TIMBER[0], ww + 0.24, 0.1, 0.16, x, y + hh / 2 + 0.04, z + s * 0.04, { r: 0.02 }); };
    win(ox - 1.5, 1.65, d / 2 + 0.17); win(ox + 1.5, 1.65, d / 2 + 0.17); win(ox, 1.65, -d / 2 - 0.17, -1); win(ox + w / 2 + 0.17, 1.65, 0, 1, 0.08, 0.8);
    b.cbox('#4a3626', 0.95, 1.9, 0.08, ox, 1.3, d / 2 + 0.18, { r: 0.01 });
    // the gable roof (ridge along x), gable ends in planks, a stone chimney
    { const run = d / 2 + 0.45, a = Math.atan2(pitch, run), Lr = Math.hypot(run, pitch) + 0.1;
      for (const s of [-1, 1]) b.cbox(roof, w + 0.8, 0.16, Lr, ox, H + pitch / 2, s * run / 2, { r: 0.03, rx: s * a });
      b.cbox(shade(roof, -0.1), w + 0.9, 0.2, 0.28, ox, H + pitch + 0.04, 0, { r: 0.04 });
      const sg = new THREE.Shape(); sg.moveTo(-d / 2, 0); sg.lineTo(d / 2, 0); sg.lineTo(0, pitch); sg.closePath(); const eg = new THREE.ExtrudeGeometry(sg, { depth: 0.2, bevelEnabled: false });
      for (const x of [ox - w / 2 - 0.1, ox + w / 2 - 0.1]) b.geo(TIMBER[2], eg, x, H, 0, 0, Math.PI / 2, 0); }
    b.box(STONE, 0.75, H + pitch + 0.6, 0.75, ox - w / 2 + 0.7, 0, -d / 2 + 0.9, { r: 0.05 }); b.cbox('#5f5a52', 0.9, 0.14, 0.9, ox - w / 2 + 0.7, H + pitch + 0.65, -d / 2 + 0.9, { r: 0.02 });
    // the woodpile and a barrel
    for (let k = 0; k < 6; k++) log(b, TIMBER[k % 4], 1.1, 0.13, ox + w / 2 + 0.55, 0.14 + Math.floor(k / 3) * 0.24, -d / 2 + 0.6 + (k % 3) * 0.28, 'x');
    barrel(b, ox - w / 2 - 0.45, d / 2 - 0.3, '#5c6e78', 0.85);
    if (lvl === 2) { b.cbox(LANTERN, 0.16, 0.22, 0.16, ox + 0.75, 2.2, d / 2 + 0.3, { r: 0.02 }); return b.build({ ao: 1.2, aoMin: 0.58 }); }
    // level 3: a porch the width of the house, posts, a lean-to roof, a rocking chair, flower boxes, lights, a flag
    const pz = d / 2 + 1.5;
    b.cbox(TIMBER[2], w + 0.6, 0.14, 1.8, ox, 0.42, d / 2 + 0.95, { r: 0.02 });
    for (const x of [-w / 2, -w / 6, w / 6, w / 2]) b.box(TIMBER[1], 0.16, 2.35, 0.16, ox + x, 0.42, pz, { r: 0.02 });
    b.cbox(roof, w + 0.9, 0.12, 2.1, ox, 2.95, d / 2 + 0.95, { r: 0.02, rx: 0.2 });
    b.cbox(TIMBER[0], w + 0.2, 0.08, 0.08, ox, 1.15, pz, { r: 0.01 });
    for (const x of [-1.5, 1.5]) windowBox(b, ox + x, 1.1, d / 2 + 0.35, 1.0, r);
    b.cbox('#6b4a32', 0.6, 0.08, 0.55, ox + 1.6, 0.85, pz - 0.6, { r: 0.02 }); b.cbox('#6b4a32', 0.6, 0.7, 0.08, ox + 1.6, 1.2, pz - 0.85, { r: 0.02, rx: -0.15 });
    lights(b, [ox - w / 2, 2.6, pz], [ox + w / 2, 2.6, pz], 9, 0.18);
    b.cbox(LANTERN, 0.18, 0.24, 0.18, ox - w / 6, 2.15, pz, { r: 0.02 });
    flag(b, ox + w / 2 + 0.3, H, -d / 2 + 0.4, 2.6, 0.9);
    planter(b, ox - w / 2 - 0.5, d / 2 + 1.2, 0.8, r);
    return b.build({ ao: 1.2, aoMin: 0.58 });
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
  // PEOPLE & THE DEAD — stylised low-poly figures: ~1.75 m, a big readable head, short legs, chunky hands and boots
  // ======================================================================
  // A joint hierarchy (hips → spine → neck → head; shoulder → elbow → hand; hip → knee → ankle) whose pieces are then
  // welded into ONE flat-shaded vertex-coloured mesh per joint: no joint balls, ~16 draw calls for a live figure,
  // a few hundred triangles once baked for the crowd.
  // pose angles: rotation.x < 0 swings a limb forward; rotation.z swings an arm out to the side
  const FIGMAT = territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
  // people colours (hex, linearised by M)
  const C = {
    cape: '#d9822b', capeIn: '#6e3a1c', scarf: '#f0a040', leather: '#5a3d29', leather2: '#7a5434', belt: '#3a2a20', buckle: '#d8b25a',
    shirt: '#d9c8a2', shirtB: '#4f6f8f', denim: '#3e5a78', olive: '#56603e', khaki: '#8a7a58', forest: '#3f5a36', tabard: '#cf8a32', mail: '#8b9094', helm: '#7b8286',
    hairDark: '#2a221d', hairBrown: '#5a3922', hairAuburn: '#8a4326', hairBlond: '#d2a95e', hairGrey: '#9a9690', hairBlack: '#1e1c1b',
    // the dead: ash-violet skin and clothes gone grey; rot-green is for their eyes and wounds only
    zskin: '#8a8794', zskin2: '#9a96a2', zrot: '#6f6a78', wound: '#8fc443', zshirt: '#5b5765', zshirt2: '#6a6170', zpants: '#45424d', zpants2: '#3c3a44',
  };
  const SKINS = ['#efc3a0', '#d9a47e', '#b07a55', '#7d5136'];
  // a lathe from [radius, y] pairs (bottom to top), flat faces front/back/sides
  const lathe = (pts, n = 8) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n, Math.PI / n);
  // a limb hanging along -y: a tapered tube with a domed top that hides the joint when it bends
  const seg = (len, r0, r1, n = 6, dome = 2) => lathe(dome > 1 ? [[r1, -len], [r0, 0], [r0 * 0.62, r0 * 0.62], [0, r0 * 0.85]] : [[r1, -len], [r0, 0], [0, r0 * 0.75]], n);
  // a torn edge: drop every other vertex of a cylinder's bottom ring
  function ragged(g, depth, seed = 1) {
    const p = g.attributes.position, r = rng(seed); let lo = Infinity; for (let i = 0; i < p.count; i++) lo = Math.min(lo, p.getY(i));
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - lo) < 1e-5) { const a = Math.atan2(p.getX(i), p.getZ(i)); const k = Math.round((a + Math.PI) / (Math.PI / 4)); if (k % 2) p.setY(i, lo - depth * (0.6 + r() * 0.6)); }
    return g;
  }
  // the same surface seen from inside (capes, coat linings)
  function flip(g) {
    g = g.index ? g.toNonIndexed() : g.clone(); const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    return g;
  }
  const bone = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.userData.bone = true; g.position.set(x, y, z); parent.add(g); return g; };
  function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; return m; }
  // add a piece to a joint: colour is a palette key, '#hex' or a material
  function pc(parent, geo, col, x = 0, y = 0, z = 0, o = {}) {
    const m = mesh(geo, typeof col === 'object' ? col : M(col), x, y, z, ...(o.s || [1, 1, 1]));
    m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); if (o.smooth) m.userData.smooth = true; parent.add(m); return m;
  }
  // weld every joint's pieces (props included) into one mesh; glowing or see-through pieces stay separate
  const _wm = new THREE.Matrix4(), _wi = new THREE.Matrix4(), _wa = new THREE.Vector3(), _wb = new THREE.Vector3(), _wc = new THREE.Vector3();
  function solid(g) {
    const p = g.attributes.position, keep = [];
    for (let i = 0; i < p.count; i += 3) { _wa.fromBufferAttribute(p, i); _wb.fromBufferAttribute(p, i + 1).sub(_wa); _wc.fromBufferAttribute(p, i + 2).sub(_wa); if (_wb.cross(_wc).lengthSq() > 1e-12) keep.push(i); }
    if (keep.length * 3 === p.count) return g;
    const out = new THREE.BufferGeometry();
    for (const k of Object.keys(g.attributes)) { const a = g.attributes[k], s = a.itemSize, arr = new Float32Array(keep.length * 3 * s); keep.forEach((i, j) => arr.set(a.array.subarray(i * s, (i + 3) * s), j * 3 * s)); out.setAttribute(k, new THREE.BufferAttribute(arr, s)); }
    return out;
  }
  function weld(root) {
    root.updateMatrixWorld(true);
    const bones = []; root.traverse(o => { if (o.userData.bone) bones.push(o); });
    for (const b of bones) {
      _wi.copy(b.matrixWorld).invert();
      const list = [];
      const walk = o => { for (const c of o.children) { if (c.userData.bone) continue; const mt = c.material; if (c.isMesh && !(mt.emissive && mt.emissiveIntensity > 1.5) && !mt.transparent && !mt.vertexColors) list.push(c); walk(c); } };
      walk(b); if (!list.length) continue;
      const geos = list.map(m => {
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && !(k === 'normal' && m.userData.smooth)) g.deleteAttribute(k);
        g.applyMatrix4(_wm.multiplyMatrices(_wi, m.matrixWorld)); g = solid(g);
        if (!m.userData.smooth) g.computeVertexNormals();      // non-indexed: one normal per face (flat)
        const n = g.attributes.position.count, a = new Float32Array(n * 3), c = m.material.color;
        for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3));
        return g;
      });
      for (const m of list) m.parent.remove(m);
      const w = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false), FIGMAT); w.castShadow = true; w.receiveShadow = true;
      b.add(w);
    }
    // props leave empty holders behind
    root.traverse(o => { for (let i = o.children.length - 1; i >= 0; i--) { const c = o.children[i]; if (c.isGroup && !c.userData.bone && !c.children.length) o.remove(c); } });
  }
  // shared shapes (built once)
  const G = {};
  const geo = (k, make) => G[k] || (G[k] = make());

  function hair(head, F, R) {
    const st = F.hairStyle || 'short', col = F.hair;
    if (!col || st === 'bald') return;
    const cap = geo('hairCap', () => new THREE.SphereGeometry(R * 1.07, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.52));
    if (st === 'patchy') { pc(head, geo('patch', () => new THREE.SphereGeometry(R * 1.05, 6, 2, 0, Math.PI * 2, 0, Math.PI * 0.32)), col, 0, 0.0, -0.02, { rz: 0.5, rx: -0.4 }); return; }
    pc(head, cap, col, 0, 0.012, -0.012, { s: st === 'mop' ? [1.08, 1.05, 1.1] : [1, 1, 1.04] });
    if (st === 'quiff') pc(head, geo('tuft', () => new THREE.IcosahedronGeometry(0.075, 0)), col, 0.02, R * 0.88, R * 0.55, { s: [1.5, 0.75, 1], rx: -0.4 });
    if (st === 'mop') pc(head, geo('mop', () => new THREE.IcosahedronGeometry(R, 0)), col, 0, -0.01, -0.06, { s: [1.02, 0.85, 0.9] });
    if (st === 'long') pc(head, geo('long', () => new THREE.IcosahedronGeometry(R, 0)), col, 0, -0.08, -0.07, { s: [1.05, 1.15, 0.75] });
    if (st === 'bun') pc(head, geo('bun', () => new THREE.IcosahedronGeometry(0.07, 0)), col, 0, R * 0.75, -R * 0.75);
    if (st === 'pony') pc(head, geo('pony', () => new THREE.CylinderGeometry(0.045, 0.02, 0.24, 5)), col, 0, -0.02, -R * 1.1, { rx: 0.35 });
  }

  /**
   * rig({ outfit, pose, bw (body width), bh (height), belly, chestDepth, scale, eyes, props })
   * outfit: { top, sleeve, legs, boots, skin, hair, hairStyle (short|quiff|mop|long|bun|pony|patchy|bald), beard,
   *           hood, cap, beanie, helmet, pack, vest, coat, cape, scarf, apron, belt, tabard, bareArms, sleeveless, torn, wounds, belly }
   * pose: { lean, twist, neck, head, headTilt, sL:[x,y,z], sR, eL, eR, hL:[x,z], hR, kL, kR }
   */
  function rig(o = {}) {
    const F = o.outfit || {}, P = o.pose || {}, bw = o.bw || 1, bh = o.bh || 1, cd = o.chestDepth || 1, sw = Math.sqrt(bw);
    const top = F.top || 'cloth1', sleeve = F.sleeve || top, legs = F.legs || 'cloth3', boots = F.boots || 'tyre', skin = F.skin || 'skin', z = o.eyes;
    const seed = o.seed || 7;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const thigh = 0.36 * bh, shin = 0.33 * bh, hipH = thigh + shin + 0.1;
    // pelvis: trousers, with a belt
    const hips = bone(body, 0, hipH, 0);
    const hr = 0.172 * bw;
    pc(hips, geo('pelvis' + bw, () => lathe([[0, -0.13], [hr * 0.88, -0.1], [hr, -0.01], [hr * 0.98, 0.1]])), legs, 0, 0, 0, { s: [1, 1, 0.7 * cd] });
    if (F.belt) { pc(hips, geo('belt' + bw, () => new THREE.CylinderGeometry(hr * 1.04, hr * 1.04, 0.055, 8, 1, true)), F.belt, 0, 0.07, 0, { s: [1, 1, 0.72 * cd] }); pc(hips, geo('buckle', () => new THREE.BoxGeometry(0.06, 0.05, 0.03)), C.buckle, 0, 0.07, hr * 0.72 * cd); }
    if (F.apron) pc(hips, geo('apron', () => new THREE.BoxGeometry(0.28 * bw, 0.4, 0.02)), F.apron, 0, -0.12, hr * 0.74 * cd);
    // spine & chest: a broad-shouldered barrel, flattened front to back
    const spine = bone(hips, 0, 0.07, 0); spine.rotation.x = P.lean || 0; spine.rotation.y = P.twist || 0;
    const chestH = 0.5 * bh, wr = 0.17 * bw, cr = 0.215 * bw;
    const torso = geo(`torso${bw}|${bh}`, () => lathe([[wr * 0.98, -0.04], [wr * 1.04, chestH * 0.36], [cr, chestH * 0.7], [cr, chestH * 0.84], [cr * 0.8, chestH * 0.95], [cr * 0.42, chestH * 1.02], [0, chestH * 1.04]]));
    pc(spine, torso, top, 0, 0, 0, { s: [1, 1, 0.66 * cd] });
    if (F.torn) { // a ragged shirt-tail over the trousers
      pc(spine, geo('hem' + bw, () => ragged(new THREE.CylinderGeometry(wr * 1.04, wr * 1.1, 0.12, 8, 1, true), 0.07, seed)), top, 0, -0.04, 0, { s: [1, 1, 0.7 * cd] });
    }
    if (o.belly) pc(spine, geo('belly', () => new THREE.SphereGeometry(0.2, 8, 6)), F.belly || top, 0, 0.17, 0.07, { s: [o.belly, o.belly * 0.88, o.belly * 0.85] });
    if (F.vest) pc(spine, geo('vest' + bw, () => lathe([[wr * 1.07, 0.03], [wr * 1.1, chestH * 0.36], [cr * 1.04, chestH * 0.7], [cr * 0.98, chestH * 0.82]])), F.vest, 0, 0, 0, { s: [1, 1, 0.7 * cd] });
    if (F.tabard) pc(spine, geo(`tabard${bw}|${bh}`, () => lathe([[hr * 1.22, -0.3], [wr * 1.1, 0.0], [wr * 1.12, chestH * 0.36], [cr * 1.05, chestH * 0.7], [cr * 0.99, chestH * 0.8]])), F.tabard, 0, 0, 0, { s: [1, 1, 0.72 * cd] });
    if (F.coat) { // a long coat skirt from the waist, open at the front
      const sk = geo('coat' + bw, () => new THREE.CylinderGeometry(wr * 1.1, wr * 1.55, 0.48, 7, 1, true, Math.PI * 0.2, Math.PI * 1.6));
      pc(spine, sk, F.coat, 0, -0.2, 0, { s: [1, 1, 0.78 * cd] }); pc(spine, flip(sk), F.coatIn || 'tyre', 0, -0.2, 0, { s: [0.97, 1, 0.76 * cd] });
    }
    if (F.cape) { // the hero's cape: hangs off the shoulders, flares back
      const cp = geo('cape' + bw, () => new THREE.CylinderGeometry(cr * 0.95, cr * 1.55, 0.78, 6, 1, true, Math.PI * 0.6, Math.PI * 0.8));
      pc(spine, cp, F.cape, 0, chestH * 0.92 - 0.39, -0.03, { s: [1, 1, 0.82 * cd], rx: 0.12 }); pc(spine, flip(cp), F.capeIn || C.capeIn, 0, chestH * 0.92 - 0.39, -0.03, { s: [0.97, 1, 0.8 * cd], rx: 0.12 });
    }
    if (F.mantle) { // a short shoulder cape: the hero's colour reads from every side and from above
      const mt = geo(`mantle${bw}|${bh}`, () => new THREE.LatheGeometry([[cr * 1.16, chestH * 0.56], [cr * 1.1, chestH * 0.8], [cr * 0.82, chestH * 0.98], [cr * 0.5, chestH * 1.04]].map(([r, y]) => new THREE.Vector2(r, y)), 7, Math.PI * 0.2, Math.PI * 1.6));
      pc(spine, mt, F.mantle, 0, 0, -0.005, { s: [1, 1, 0.74 * cd] }); pc(spine, flip(mt), F.capeIn || C.capeIn, 0, 0, -0.005, { s: [0.98, 1, 0.72 * cd] });
    }
    if (F.pack) {
      pc(spine, geo('pack', () => new THREE.BoxGeometry(0.3, 0.36, 0.17)), F.pack, 0, chestH * 0.52, -cr * 0.66 * cd - 0.07);
      pc(spine, geo('roll', () => new THREE.CylinderGeometry(0.07, 0.07, 0.36, 6)), F.roll || C.olive, 0, chestH * 0.52 + 0.24, -cr * 0.66 * cd - 0.07, { rz: Math.PI / 2 });
      pc(spine, geo('flap', () => new THREE.BoxGeometry(0.31, 0.12, 0.18)), F.packFlap || C.leather, 0, chestH * 0.52 + 0.12, -cr * 0.66 * cd - 0.075);
    }
    if (F.wounds) for (const [x, y, zz, s] of [[0.08, chestH * 0.55, 1, 1], [-0.06, chestH * 0.6, -1, 1.2]]) pc(spine, geo('wound', () => new THREE.BoxGeometry(0.09, 0.08, 0.04)), F.wounds, x * bw, y, zz * cr * 0.6 * cd, { s: [s, s, 1], rz: x * 4 });
    // neck & head: the head is big — it is what you read from above
    const neck = bone(spine, 0, chestH * 0.98, 0); neck.rotation.x = P.neck || 0;
    pc(neck, geo('neck', () => new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6, 1, true)), skin, 0, 0.03, 0);
    if (F.scarf) { pc(neck, geo('scarf', () => new THREE.CylinderGeometry(0.11, 0.15, 0.1, 8)), F.scarf, 0, 0.0, 0, { s: [1, 1, 0.9] }); pc(neck, geo('scarfTail', () => new THREE.BoxGeometry(0.08, 0.26, 0.03)), F.scarf, 0.06, -0.12, -0.13, { rx: 0.25, rz: 0.15 }); }
    const head = bone(neck, 0, 0.07, 0); head.rotation.x = P.head || 0; head.rotation.z = P.headTilt || 0;
    const R = 0.165;
    const hg = new THREE.Group(); hg.position.y = R * 0.85; head.add(hg);  // head centre
    pc(hg, geo('head', () => new THREE.SphereGeometry(R, 8, 6, Math.PI / 8)), skin, 0, 0, 0, { s: z ? [0.95, 1.02, 1] : [1, 1.04, 1] });
    if (z) {
      const em = M('toxic', { emissive: '#b4ff4e', ei: o.eyesI || 6 }), es = 0.018 * (CFG.eyeScale || 1);
      pc(hg, geo('brow', () => new THREE.BoxGeometry(0.2, 0.055, 0.04)), '#2a2724', 0, 0.005, R * 0.86);
      for (const x of [-0.058, 0.058]) hg.add(mesh(geo('eye' + es, () => new THREE.IcosahedronGeometry(es, 0)), em, x * (CFG.eyeScale > 1 ? 1.08 : 1), 0.0, R * 0.95));
      pc(hg, geo('maw', () => new THREE.BoxGeometry(0.09, 0.035, 0.03)), C.wound, 0.01, -0.085, R * 0.88, { rz: 0.15 });
      if (o.eyeGlow) { const sp = glowSprite('#b4ff4e', o.eyeGlow, 1.3); sp.position.set(0, 0, 0.12); hg.add(sp); }
    } else {
      for (const x of [-0.06, 0.06]) pc(hg, geo('eyeD', () => new THREE.BoxGeometry(0.028, 0.045, 0.02)), C.hairBlack, x, 0.0, R * 0.95);
      pc(hg, geo('nose', () => new THREE.BoxGeometry(0.035, 0.05, 0.04)), skin, 0, -0.035, R * 0.98);
    }
    if (F.beard) pc(hg, geo('beard', () => new THREE.IcosahedronGeometry(0.1, 0)), F.beard, 0, -0.1, 0.07, { s: [1.45, 0.85, 0.85] });
    if (F.hood) { // hood up: a big rounded shape, the face showing
      const hd = geo('hood', () => new THREE.SphereGeometry(R * 1.22, 8, 5, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.7));
      pc(hg, hd, F.hood, 0, 0.0, -0.03, { rx: -0.75 }); pc(hg, flip(hd), F.hoodIn || C.belt, 0, 0.0, -0.03, { rx: -0.75, s: [0.97, 0.97, 0.97] });
      pc(hg, geo('hoodDrape', () => new THREE.IcosahedronGeometry(0.17, 0)), F.hood, 0, -0.17, -0.1, { s: [1.3, 0.75, 0.9] });
    } else if (F.helmet) {
      pc(hg, geo('helm', () => new THREE.SphereGeometry(R * 1.13, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.5)), F.helmet, 0, 0.02, 0);
      pc(hg, geo('helmRim', () => new THREE.CylinderGeometry(R * 1.28, R * 1.28, 0.03, 8)), F.helmet, 0, 0.02, 0);
      hair(hg, { ...F, hairStyle: F.hairStyle === 'long' ? 'long' : 'bald' }, R);
    } else if (F.cap) {
      pc(hg, geo('capDome', () => new THREE.SphereGeometry(R * 1.08, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.5)), F.cap, 0, 0.03, -0.005, { s: [1, 0.85, 1.02] });
      pc(hg, geo('brim', () => new THREE.BoxGeometry(0.2, 0.025, 0.13)), F.cap, 0, 0.04, R * 1.05, { rx: 0.12 });
      hair(hg, { ...F, hairStyle: ['long', 'pony'].includes(F.hairStyle) ? F.hairStyle : 'bald' }, R);
    } else if (F.beanie) {
      pc(hg, geo('beanie', () => new THREE.SphereGeometry(R * 1.1, 8, 4, Math.PI / 8, Math.PI * 2, 0, Math.PI * 0.5)), F.beanie, 0, 0.02, -0.005, { s: [1, 1.08, 1.02] });
      pc(hg, geo('beanieRim', () => new THREE.CylinderGeometry(R * 1.13, R * 1.13, 0.06, 8)), F.beanie, 0, 0.04, -0.005);
    } else hair(hg, F, R);
    // arms: the domed top of the upper arm is the shoulder
    const arms = {}, shoulders = {};
    for (const side of [-1, 1]) {
      const k = side < 0 ? 'L' : 'R', sh = bone(spine, side * 0.232 * bw, chestH * 0.8, 0);
      const a = P['s' + k] || [0, 0, 0]; sh.rotation.set(a[0], a[1] || 0, side * (0.1 + (a[2] || 0)));
      const ua = 0.27 * bh, fa = 0.24 * bh, torn = F.torn && side < 0;
      pc(sh, geo(`ua${ua}|${sw}`, () => seg(ua + 0.02, 0.078 * sw, 0.064 * sw)), F.sleeveless ? skin : sleeve);
      if (torn && !F.sleeveless && !F.bareArms) pc(sh, geo('cuff' + sw, () => ragged(new THREE.CylinderGeometry(0.068 * sw, 0.072 * sw, 0.06, 6, 1, true), 0.05, seed + 3)), sleeve, 0, -ua + 0.04, 0);
      const el = bone(sh, 0, -ua, 0); el.rotation.x = P['e' + k] ?? -0.15;
      pc(el, geo(`fa${fa}|${sw}`, () => seg(fa, 0.064 * sw, 0.054 * sw, 6, 1)), F.bareArms || F.sleeveless || torn ? skin : sleeve);
      const hand = bone(el, 0, -fa - 0.02, 0);
      pc(hand, geo('mitt', () => new THREE.IcosahedronGeometry(0.068, 0)), F.gloves || skin, 0, -0.035, 0.005, { s: [0.85, 1.1, 1] });
      arms[k] = hand; shoulders[k] = sh;
    }
    // legs, chunky boots
    const feet = [];
    for (const side of [-1, 1]) {
      const k = side < 0 ? 'L' : 'R', hp = new THREE.Group(); hp.userData.bone = true; hp.position.set(side * 0.092 * bw, -0.02, 0);
      hp.rotation.x = P['h' + k] ? P['h' + k][0] : 0; hp.rotation.z = P['h' + k] ? (P['h' + k][1] || 0) * side : 0; hips.add(hp);
      const kn = bone(hp, 0, -thigh, 0); kn.rotation.x = P['k' + k] ?? 0;      // the knee is the leg's first group (strideFrame/liveRig rely on it)
      pc(hp, geo(`th${thigh}|${sw}`, () => seg(thigh + 0.02, 0.105 * sw, 0.082 * sw)), legs);
      pc(kn, geo(`sh${shin}|${sw}`, () => seg(shin, 0.082 * sw, 0.068 * sw, 6, 1)), legs);
      pc(kn, geo('bootTop' + sw, () => new THREE.CylinderGeometry(0.08 * sw, 0.082 * sw, 0.12, 6, 1, true)), boots, 0, -shin + 0.06, 0);
      const an = bone(kn, 0, -shin, 0); an.rotation.x = -(hp.rotation.x + kn.rotation.x) * 0.8;
      const ft = pc(an, geo('boot', () => new THREE.BoxGeometry(0.15, 0.12, 0.27)), boots, 0, -0.045, 0.045); feet.push(ft);
      if (F.sole !== false) pc(an, geo('sole', () => new THREE.BoxGeometry(0.155, 0.03, 0.28)), F.sole || C.belt, 0, -0.095, 0.045);
    }
    // props in the hands (or anywhere)
    if (o.props) o.props({ hand: arms.R, handL: arms.L, spine, head: hg });
    // plant the feet: lift or drop the body so the lowest boot touches the ground
    root.updateMatrixWorld(true);
    let minY = Infinity; const v = new THREE.Vector3();
    for (const f of feet) { f.geometry.computeBoundingBox(); const bb = f.geometry.boundingBox; for (const x of [bb.min.x, bb.max.x]) for (const zz of [bb.min.z, bb.max.z]) { v.set(x, bb.min.y - 0.03 / f.scale.y, zz).applyMatrix4(f.matrixWorld); minY = Math.min(minY, v.y); } }
    body.position.y = -minY + (o.lift || 0);
    weld(root);
    root.scale.setScalar(o.scale || 1);
    root.userData.joints = { body, hips, spine, neck, head, sL: shoulders.L, sR: shoulders.R, hand: arms.R, handL: arms.L };
    root.userData.legs = hips.children.filter(c => c.isGroup && c !== spine);
    return root;
  }
  // props, built along the hand's -y (the way the fingers point)
  function axe(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.85, 6), M(C.leather2), 0, -0.2, 0)); g.add(mesh(new THREE.BoxGeometry(0.04, 0.2, 0.2), M('steel'), 0, -0.56, 0.1)); g.add(mesh(new THREE.BoxGeometry(0.045, 0.22, 0.05), M('#d8dcdc'), 0, -0.56, 0.21)); g.add(mesh(new THREE.BoxGeometry(0.035, 0.08, 0.06), M('tyre'), 0, -0.56, -0.03)); g.rotation.x = -1.2; g.position.set(0, -0.05, 0.02); parts.hand.add(g); }
  function crossbow(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.06, 0.07, 0.62), M(C.leather2), 0, 0, 0.18)); g.add(mesh(new THREE.BoxGeometry(0.66, 0.035, 0.05), M('#3a3836'), 0, 0.02, 0.44)); g.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.16), M(C.leather), 0, -0.05, -0.08)); g.position.set(0, -0.06, 0.03); g.rotation.set(1.45, 0, 0); parts.hand.add(g); }
  function crowbar(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 5), M('#b8412e'), 0, -0.3, 0)); g.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), M('#b8412e'), 0, -0.68, 0.05)); g.rotation.x = -0.4; parts.hand.add(g); }
  function torch(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), M('dark'), 0, -0.05, 0.04)); g.rotation.x = -1.4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 8), M('pale', { emissive: '#fff2cc', ei: 6 })); l.position.set(0, -0.16, 0.04); g.add(l); parts.handL.add(g); }
  function sword(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.05, 0.62, 0.016), M('#c9cdcf'), 0, -0.42, 0)); g.add(mesh(new THREE.BoxGeometry(0.18, 0.035, 0.04), M(C.buckle), 0, -0.1, 0)); g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 5), M(C.leather), 0, -0.03, 0)); g.rotation.x = -1.1; parts.hand.add(g); }
  function shield(parts) { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 8), M(C.tabard), 0, 0, 0)); g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6), M('steel'), 0, 0.02, 0)); g.rotation.set(0, 0, Math.PI / 2); g.position.set(-0.05, -0.05, 0.04); parts.handL.add(g); }

  const HERO = { cape: C.cape, mantle: C.cape, scarf: C.scarf, belt: C.belt };
  const heroes = {
    // the Survivor (and every fighter class): rolled sleeves, leather vest, red cape and scarf, a big axe
    brawler: () => rig({ outfit: { ...HERO, top: C.shirt, sleeve: C.shirt, vest: C.leather, legs: C.olive, boots: C.leather, hair: C.hairBrown, hairStyle: 'quiff', beard: C.hairBrown, bareArms: true, gloves: C.leather }, bw: 1.1, pose: { lean: 0.08, twist: -0.15, sR: [-0.5, 0, 0.15], eR: -1.1, sL: [-0.35, 0, 0.12], eL: -0.9, hL: [-0.25], kL: 0.35, hR: [0.15], kR: 0.15, head: 0.05 }, props: axe }),
    ranger: () => rig({ outfit: { ...HERO, cape: null, top: C.leather2, legs: C.khaki, hood: C.forest, coat: C.forest, coatIn: '#2a3a26', boots: C.leather, hair: C.hairAuburn, gloves: C.leather }, pose: { lean: 0.05, sR: [-1.25, 0, 0.0], eR: -0.25, sL: [-1.35, -0.3, -0.35], eL: -0.45, hL: [-0.3], kL: 0.3, hR: [0.12], kR: 0.1 }, props: crossbow }),
    scavver: () => rig({ outfit: { ...HERO, cape: null, top: C.denim, legs: C.khaki, cap: '#56623a', pack: C.leather2, roll: C.olive, hair: C.hairDark, boots: C.leather, gloves: '#3a3836' }, pose: { lean: 0.12, sL: [-0.25, 0, 0.05], eL: -0.7, sR: [0.15, 0, 0.0], eR: -0.25, hL: [0.25], kL: 0.2, hR: [-0.3], kR: 0.45 }, props: p => { crowbar(p); torch(p); } }),
    // sellswords and companions: helmet, amber tabard over mail, a sword and a round shield
    sellsword: () => rig({ outfit: { top: C.mail, sleeve: C.mail, tabard: C.tabard, belt: C.belt, legs: '#3c3a36', boots: C.leather, helmet: C.helm, hair: C.hairDark, gloves: C.leather }, bw: 1.05, pose: { sR: [-0.5, 0, 0.15], eR: -1.0, sL: [-0.3, 0, 0.1], eL: -0.8 }, props: p => { sword(p); shield(p); } }),
  };
  // townsfolk: a seeded mix of skin, hair, clothes and hats; crew = a scavenging crew member (pack, amber vest)
  const FOLK_TOPS = ['#c98b4a', '#8a6a52', '#a8584a', '#d9c8a2', '#d8b04e', '#6d7f8f', '#b86a4a', '#9a7a52', '#c9a27a'];   // survivors: warm, earthy — never ash-violet or rot-green
  const FOLK_LEGS = ['#3e5a78', '#5b4a3a', '#46464a', '#7a6a52', '#56603e'];
  const FOLK_HAIR = [C.hairDark, C.hairBrown, C.hairAuburn, C.hairBlond, C.hairGrey, C.hairBlack];
  function folk(seed = 1, o = {}) {
    const r = rng(seed * 7919 + 13), pick = a => a[Math.floor(r() * a.length)];
    const hairStyle = pick(['short', 'short', 'mop', 'long', 'bun', 'pony', 'bald']), hat = r();
    const F = { top: pick(FOLK_TOPS), legs: pick(FOLK_LEGS), skin: pick(SKINS), hair: pick(FOLK_HAIR), hairStyle, boots: pick([C.leather, '#2e2c2a', C.leather2]), belt: r() < 0.4 ? C.belt : null };
    if (hat < 0.14) F.cap = pick(['#d08a2e', '#4f6f8f', '#a8584a']); else if (hat < 0.24) F.beanie = pick(['#b8412e', '#5f8fa8', '#d8b04e']);
    if (r() < 0.25 && hairStyle !== 'long') F.beard = F.hair;
    if (r() < 0.3) F.vest = pick([C.leather, '#6b5d4c', '#3f4447']);
    else if (r() < 0.2) F.apron = pick(['#e2d6bc', C.leather2]);
    if (r() < 0.3) { F.pack = C.leather2; F.roll = pick([C.olive, '#a8584a', '#5f8fa8']); }
    if (r() < 0.3) F.bareArms = true;
    if (o.crew) Object.assign(F, { vest: '#c9702e', pack: C.leather2, roll: C.olive, apron: null, beanie: null, cap: '#8a8780' });
    const pose = o.sit ? { lean: 0.22, neck: 0.15, hL: [-1.45, 0.12], kL: 1.55, hR: [-1.45, 0.12], kR: 1.55, sL: [-0.75, 0, 0.12], eL: -1.15, sR: [-0.75, 0, 0.12], eR: -1.15 }
      : { sL: [0.15, 0, 0], sR: [-0.15, 0, 0], hL: [0.25], hR: [-0.25], kR: 0.2 };
    return rig({ outfit: F, bw: 0.92 + Math.floor(r() * 4) * 0.07, bh: 0.94 + Math.floor(r() * 3) * 0.05, pose });
  }
  // the dead: grey-green skin, torn and stained clothes, hunched, glowing eyes
  const ZO = { top: C.zshirt, legs: C.zpants, skin: C.zskin, boots: '#34323a', hair: '#2c2a30', hairStyle: 'patchy', torn: true, wounds: C.wound, sole: false };
  const dead = {
    walker: o => rig({ ...o, outfit: { ...ZO, ...(o && o.outfit) }, eyes: true, pose: { lean: 0.48, neck: 0.15, head: -0.05, headTilt: 0.25, sL: [-1.25, 0, -0.05], eL: -0.2, sR: [-0.95, 0, 0.1], eR: -0.35, hL: [-0.35], kL: 0.4, hR: [0.25], kR: 0.1 } }),
    runner: o => rig({ ...o, outfit: { ...ZO, top: C.zshirt2, legs: C.zpants2, skin: C.zskin2, bareArms: true, hairStyle: 'short' }, seed: 3, eyes: true, bw: 0.9, pose: { lean: 0.6, neck: -0.25, head: -0.3, sL: [-1.4, 0, -0.1], eL: -0.4, sR: [0.8, 0, 0.1], eR: -0.9, hL: [-0.9], kL: 1.1, hR: [0.5], kR: 0.6 } }),
    crawler: o => rig({ ...o, outfit: { ...ZO, top: '#5b5a50', skin: C.zrot, bareArms: true, hairStyle: 'bald' }, seed: 5, eyes: true, bw: 0.85, pose: { lean: 1.25, neck: -0.9, head: -0.4, sL: [-1.7, 0, -0.25], eL: 0.2, sR: [-1.2, 0, 0.3], eR: 0.1, hL: [-1.4], kL: 1.9, hR: [-0.6], kR: 1.6 } }),
    brute: o => rig({ ...o, outfit: { ...ZO, top: '#5e5466', sleeveless: true, hairStyle: 'bald', legs: '#38353f', skin: C.zrot }, seed: 9, eyes: true, bw: 1.55, chestDepth: 1.2, scale: 1.4, pose: { lean: 0.22, neck: 0.4, head: 0.1, sL: [-0.4, 0, 0.25], eL: -0.5, sR: [-0.6, 0, 0.2], eR: -0.6, hL: [-0.2], kL: 0.25, hR: [0.15], kR: 0.1 } }),
    spitter: o => { const r = rig({ ...o, outfit: { ...ZO, top: '#686572', skin: C.zskin2 }, seed: 11, eyes: true, bw: 0.95, pose: { lean: -0.15, neck: -0.45, head: -0.35, sL: [0.2, 0, 0.35], eL: -0.3, sR: [0.15, 0, 0.35], eR: -0.3, hL: [0.1], hR: [-0.1] } }); const s = glowSprite('#b4ff4e', 0.5, 1.4); s.position.set(0, 1.6, 0.2); r.add(s); return r; },
    bloater: o => rig({ ...o, outfit: { ...ZO, top: '#605a68', belly: '#9a92a0', hairStyle: 'bald' }, seed: 13, eyes: true, belly: 1.6, bw: 1.35, chestDepth: 1.4, scale: 1.1, pose: { lean: -0.05, neck: 0.2, sL: [-0.2, 0, 0.6], eL: -0.3, sR: [-0.2, 0, 0.6], eR: -0.3, hL: [0, 0.15], hR: [0, 0.15] } }),
    screamer: o => rig({ ...o, outfit: { ...ZO, top: '#b8b3bd', skin: C.zskin2, bareArms: true, hair: '#8a8790', hairStyle: 'long' }, seed: 17, eyes: true, bw: 0.85, pose: { lean: -0.3, neck: -0.5, head: -0.4, sL: [-2.7, 0, -0.35], eL: -0.3, sR: [-2.6, 0, -0.3], eR: -0.25, hL: [0.1], hR: [-0.1] } }),
    gravelord: o => rig({ ...o, outfit: { ...ZO, top: '#2e2b33', legs: '#26242b', sleeveless: true, skin: C.zrot, hairStyle: 'bald' }, seed: 19, eyes: true, eyesI: 10, bw: 1.7, chestDepth: 1.25, scale: 2.4, pose: { lean: 0.18, neck: 0.3, sL: [-0.35, 0, 0.35], eL: -0.4, sR: [-1.3, 0, 0.25], eR: -0.5, hL: [-0.15], kL: 0.2, hR: [0.15], kR: 0.1 }, props: p => { for (let k = 0; k < 7; k++) { const a = k * 0.9; pc(p.head, geo('crown', () => new THREE.BoxGeometry(0.05, 0.2, 0.03)), k % 2 ? 'slab' : 'rebar', Math.cos(a) * 0.12, 0.2 + (k % 3) * 0.03, Math.sin(a) * 0.12, { s: [1, 0.8 + (k % 3) * 0.3, 1], rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 }); } } }),
  };
  // the woods: simple four-legged game (two frames: legs swapped)
  function beast(o, c) {
    const b = new B(), sw = o && o.alt ? -1 : 1, L = c.leg, top = L + c.body * 0.5;
    b.cbox(c.coat, c.body * 0.8, c.body, c.len, 0, top, 0, { r: 0.08 });
    b.cbox(c.belly, c.body * 0.7, c.body * 0.35, c.len * 0.8, 0, top - c.body * 0.35, 0, { r: 0.06 });
    for (const [lx, lz, ph] of [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]]) b.cbox(c.legc, 0.09, L, 0.09, lx * c.body * 0.28, L / 2, lz * c.len * 0.36, { r: 0.02, rx: 0.35 * ph * sw });
    b.cbox(c.coat, c.body * 0.38, c.neck, c.body * 0.38, 0, top + c.neck * 0.45, c.len * 0.5, { r: 0.05, rx: -0.5 });
    b.cbox(c.coat, c.body * 0.42, c.body * 0.38, c.head, 0, top + c.neck * 0.85, c.len * 0.5 + c.head * 0.55, { r: 0.05 });
    b.cbox(c.nose, c.body * 0.22, c.body * 0.2, 0.12, 0, top + c.neck * 0.8, c.len * 0.5 + c.head * 1.05, { r: 0.03 });
    b.cbox(c.coat, 0.08, 0.12 * c.ear, 0.05, -c.body * 0.15, top + c.neck * 0.85 + c.body * 0.25, c.len * 0.5 + c.head * 0.3, { r: 0.02, rz: -0.3 });
    b.cbox(c.coat, 0.08, 0.12 * c.ear, 0.05, c.body * 0.15, top + c.neck * 0.85 + c.body * 0.25, c.len * 0.5 + c.head * 0.3, { r: 0.02, rz: 0.3 });
    b.cbox(c.tail, 0.08, 0.08, c.tl, 0, top + c.body * 0.2, -c.len * 0.55, { r: 0.03, rx: c.tailUp });
    if (c.antlers) for (const sx of [-1, 1]) { b.cbox('bone', 0.04, 0.38, 0.04, sx * 0.1, top + c.neck * 0.85 + 0.35, c.len * 0.5 + c.head * 0.3, { r: 0.01, rz: sx * 0.35 }); b.cbox('bone', 0.03, 0.2, 0.03, sx * 0.2, top + c.neck * 0.85 + 0.5, c.len * 0.5 + c.head * 0.45, { r: 0.01, rx: 0.5 }); }
    const g = new THREE.Group(); g.add(b.build()); return g;
  }
  dead.deer = o => beast(o, { coat: '#8a5a34', belly: '#c9a77e', legc: '#6b4528', nose: '#2a2420', tail: '#e8dcc8', leg: 0.62, body: 0.36, len: 0.95, neck: 0.42, head: 0.3, ear: 1.2, tl: 0.12, tailUp: -0.6, antlers: true });
  dead.wolf = o => beast(o, { coat: '#6d6a66', belly: '#a8a49c', legc: '#4c4946', nose: '#1d1c1b', tail: '#5e5b57', leg: 0.42, body: 0.34, len: 0.95, neck: 0.22, head: 0.36, ear: 1.4, tl: 0.42, tailUp: 0.5 });
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

  // ---------- one draw per model: fold every vertex-coloured mesh under a group into one ----------
  const _fm = new THREE.Matrix4(), _fi = new THREE.Matrix4();
  function flattenVC(g) {
    g.updateMatrixWorld(true); _fi.copy(g.matrixWorld).invert();
    const list = [], drop = [];
    g.traverse(o => { if (o.isMesh && o.material === VCM && !o.isInstancedMesh) { const gg = o.geometry.clone(); gg.applyMatrix4(_fm.multiplyMatrices(_fi, o.matrixWorld)); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'color', 'aEmit'].includes(k)) gg.deleteAttribute(k); list.push(gg); drop.push(o); } });
    if (!list.length) return g;
    for (const o of drop) o.parent.remove(o);
    const out = new THREE.Group(), m = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(list, false), VCM); m.castShadow = true; m.receiveShadow = true; out.add(m);
    // what could not be folded (glass, canvas, chain-link) keeps its own meshes, re-parented with its world transform
    const rest = []; g.traverse(o => { if (o.isMesh) rest.push(o); });
    for (const o of rest) { const c = new THREE.Mesh(o.geometry, o.material); _fm.multiplyMatrices(_fi, o.matrixWorld).decompose(c.position, c.quaternion, c.scale); c.castShadow = o.castShadow; c.receiveShadow = true; out.add(c); }
    return out;
  }
  /** a ruin of a flattened model: the walls slump and break, everything is charred, a heap of rubble in the middle */
  function ruinOf(g, seed = 1, height = 1) {
    let src = null; g.traverse(o => { if (!src && o.isMesh && o.material === VCM) src = o; }); if (!src) return new THREE.Group();
    const gg = src.geometry.clone(), pa = gg.attributes.position, ca = gg.attributes.color, ea = gg.attributes.aEmit, r = rng(seed);
    const bx = new THREE.Box3().setFromBufferAttribute(pa), H = Math.max(0.01, bx.max.y - bx.min.y), cx = (bx.min.x + bx.max.x) / 2, cz = (bx.min.z + bx.max.z) / 2;
    const ph = r() * 6.28, keep = 0.22 + r() * 0.12;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(z - cz, x - cx);
      // a jagged break line round the walls: high on one side, low on the other
      const cut = H * (keep + 0.18 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 7 + ph * 2) + 0.12 * Math.cos(a - ph));
      if (y > cut) { pa.setY(i, cut + (y - cut) * 0.06); pa.setX(i, x + (x - cx) * 0.05); pa.setZ(i, z + (z - cz) * 0.05); }
      const t = Math.min(1, Math.max(0, y / H)), soot = 0.16 + 0.14 * (1 - t) + r() * 0.04;
      ca.setXYZ(i, ca.getX(i) * soot + 0.012, ca.getY(i) * soot + 0.01, ca.getZ(i) * soot + 0.012); ea.setX(i, 0);
    }
    gg.computeVertexNormals();
    const out = new THREE.Group(), m = new THREE.Mesh(gg, VCM); m.castShadow = true; m.receiveShadow = true; out.add(m);
    const b = new B(); rubble(b, cx, cz, Math.max(0.6, (bx.max.x - bx.min.x) * 0.32), 16, r, 'soot');
    for (let k = 0; k < 4; k++) b.cbox(k % 2 ? 'soot' : '#3a2f28', 0.12 * height, 0.12 * height, (bx.max.z - bx.min.z) * 0.7, cx + (r() - 0.5) * H * 0.5, H * 0.12 + r() * H * 0.1, cz, { r: 0.01, rx: (r() - 0.5) * 0.6, ry: r() * 3, rz: (r() - 0.5) * 0.5 });
    const rb = b.build({ ao: H * 0.3, aoMin: 0.5 }); rb.traverse(o => { if (o.isMesh && o.geometry.attributes.color) { const c = o.geometry.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.5, c.getY(i) * 0.5, c.getZ(i) * 0.5); } });
    out.add(rb);
    return flattenVC(out);
  }
  // the upgrade sweep: new colours climb the building from the ground behind an amber band (one at a time)
  const sweepY = { value: -99 };
  const SWEEP = territory(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }), { emit: true, uniforms: { tSweepY: sweepY },
    fragHead: 'uniform float tSweepY;',
    fragColor: `float swd = vTWorld.y - tSweepY; float swl = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(swl) * 0.7, step(0.0, swd)) + vec3(1.6, 0.85, 0.3) * smoothstep(0.35, 0.0, abs(swd));` });
  SWEEP.userData.y = sweepY;

  return { hall, home, VCM, flattenVC, ruinOf, SWEEP, P, M, T, setMask, setMaskArrays, setFootprints, territory, EMITW, WIN, LENS, lin, rng, B, weeds, beam, place, post, rboxGeo, sign, textTex, glowDecal, glowSprite, apartment, rubble, streets, grass, car, bus, container, sandbags, jersey, lamp, trafficLight, busStop, tree, bush, barrelFire, townhouse, tower, barricade, farm, keep, hospital, metro, petrol, police, figure, heroes, dead, folk, FIGMAT, zoneCells, chevrons, ghost, ring, chainMat };
})();
