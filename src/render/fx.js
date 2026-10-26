// Pooled effects for the live game. Everything here is allocated once; emitting never allocates.
//   particles — one GPU particle system (2048 instanced quads, motion in the vertex shader): blood, dust, sparks,
//               embers, smoke, confetti, pollen, fireflies. Alpha-blended and additive particles share one draw
//               (premultiplied alpha: additive ones write alpha 0).
//   labels    — floating numbers and words from one glyph atlas (instanced quads, one draw)
//   rings     — expanding ground rings (bursts), instanced
//   blobs     — a soft dark ellipse under every unit (grounding without SSAO), instanced
//   stains    — ground stains where the dead fall, fading out, instanced
//   pools     — the night's light: a 256² top-down additive light texture round the camera (fires, lamps, windows,
//               hives, flares, the lantern), sampled by every lit material in K.territory()
/* global THREE */
import { K } from './kit.js';
// [top]

const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

export function createFx({ renderer, scene }) {
  const time = { value: 0 };
  const group = new THREE.Group(); group.name = 'fx'; scene.add(group);
  const quadGeo = (n, attrs) => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const out = {};
    for (const [k, size] of Object.entries(attrs)) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); out[k] = a; }
    g.instanceCount = n;
    return { g, a: out };
  };

  // ---------- particles ----------
  const PN = 2048;
  const P = quadGeo(PN, { aP: 3, aV: 3, aT: 4, aC: 4, aM: 4 });   // start; velocity; birth, life, size0, size1; colour + additive; gravity, drag, wobble, spin
  for (let i = 0; i < PN; i++) P.a.aT.array[i * 4 + 1] = -1;     // dead
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uLit: { value: 1 } },
    vertexShader: `
      attribute vec3 aP, aV; attribute vec4 aT, aC, aM; uniform float uTime, uLit;
      varying vec4 vC; varying vec2 vQ; varying float vF;
      void main(){
        float age = uTime - aT.x, t = age / aT.y;
        if (aT.y <= 0.0 || t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float dr = max(aM.y, 0.001), k = (1.0 - exp(-dr * age)) / dr;
        vec3 p = aP + aV * k + vec3(0.0, -0.5 * aM.x * age * age, 0.0);
        p.xz += aM.z * vec2(sin(age * 1.7 + aT.z * 31.0), cos(age * 1.3 + aT.w * 17.0));
        p.y += aM.z * 0.5 * sin(age * 2.3 + aT.z * 13.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float s = mix(aT.z, aT.w, t), a = aM.w * age;
        vec2 q = position.xy; vQ = q;
        mv.xy += mat2(cos(a), -sin(a), sin(a), cos(a)) * q * s;
        gl_Position = projectionMatrix * mv;
        vC = aC; vF = (1.0 - smoothstep(0.5, 1.0, t)) * smoothstep(0.0, 0.06, t);
        if (fract(aC.a) < 0.25) { vC.rgb *= uLit; vF *= 0.75; }   // dust, smoke, blood take the scene's light; sparks and embers glow
      }`,
    fragmentShader: `
      varying vec4 vC; varying vec2 vQ; varying float vF;
      void main(){
        float r = length(vQ), a = (vC.a > 1.5 ? step(max(abs(vQ.x), abs(vQ.y)), 0.9) : 1.0 - smoothstep(0.35, 1.0, r)) * vF;
        if (a < 0.01) discard;
        float add = step(0.5, fract(vC.a));   // .5 = additive
        gl_FragColor = vec4(vC.rgb * a, a * (1.0 - add));
      }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const pMesh = new THREE.Mesh(P.g, pMat); pMesh.frustumCulled = false; pMesh.renderOrder = 7; group.add(pMesh);
  let pi = 0, pDirty = false;
  const tc = new THREE.Color();
  const PRESET = {
    //          colour        mode  size0 size1 life  speed up   grav drag wob spin
    blood:  { c: '#b8402e', m: 0, s0: 0.11, s1: 0.06, life: 0.55, sp: 2.6, up: 2.2, g: 9, dr: 1.5, w: 0, spin: 0 },
    ichor:  { c: '#7a7484', m: 0, s0: 0.12, s1: 0.06, life: 0.5, sp: 2.4, up: 2.0, g: 9, dr: 1.5, w: 0, spin: 0 },
    dust:   { c: '#b9ad95', m: 0, s0: 0.14, s1: 0.4, life: 0.75, sp: 1.3, up: 0.5, g: -0.3, dr: 3.5, w: 0, spin: 1 },
    smoke:  { c: '#6d6a70', m: 0, s0: 0.35, s1: 1.2, life: 2.6, sp: 0.4, up: 1.1, g: -0.15, dr: 0.8, w: 0.25, spin: 0.4 },
    spark:  { c: '#ffd08a', m: 0.5, s0: 0.06, s1: 0.02, life: 0.35, sp: 5.5, up: 3.0, g: 12, dr: 2.5, w: 0, spin: 0, k: 4 },
    ember:  { c: '#ff9a40', m: 0.5, s0: 0.05, s1: 0.02, life: 1.6, sp: 0.35, up: 1.2, g: -0.6, dr: 0.6, w: 0.25, spin: 0, k: 3 },
    rot:    { c: '#b4ff4e', m: 0.5, s0: 0.07, s1: 0.03, life: 0.9, sp: 1.2, up: 1.2, g: -0.4, dr: 1.2, w: 0.15, spin: 0, k: 2 },
    cyan:   { c: '#5fd3ff', m: 0.5, s0: 0.08, s1: 0.02, life: 0.9, sp: 2.2, up: 2.4, g: 2, dr: 2.0, w: 0, spin: 0, k: 2.5 },
    gold:   { c: '#ffc070', m: 0.5, s0: 0.08, s1: 0.03, life: 0.8, sp: 2.0, up: 3.0, g: 6, dr: 1.5, w: 0, spin: 0, k: 2 },
    confetti: { c: '#ffffff', m: 2, s0: 0.07, s1: 0.06, life: 1.4, sp: 2.4, up: 4.2, g: 8, dr: 1.4, w: 0.1, spin: 9 },
    pollen: { c: '#fff3c8', m: 0.5, s0: 0.035, s1: 0.03, life: 5, sp: 0.15, up: 0.05, g: 0, dr: 0.2, w: 0.5, spin: 0, k: 0.8 },
    firefly:{ c: '#ffd36a', m: 0.5, s0: 0.05, s1: 0.04, life: 4, sp: 0.1, up: 0.05, g: 0, dr: 0.2, w: 0.7, spin: 0, k: 3.5 },
    flash:  { c: '#ffe2b0', m: 0.5, s0: 0.4, s1: 1.4, life: 0.18, sp: 0, up: 0, g: 0, dr: 1, w: 0, spin: 0, k: 3 },
  };
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  /** emit n particles of a kind at (x, y, z). o: { color, dir: [x, z] (bias), spread, speed, size, life } */
  function emit(kind, x, y, z, n = 8, o = {}) {
    const p = PRESET[kind] || PRESET.dust; tc.set(o.color || p.c).convertSRGBToLinear().multiplyScalar(p.k || 1);
    const A = P.a;
    for (let q = 0; q < n; q++) {
      const i = pi; pi = (pi + 1) % PN;
      const a = rnd() * Math.PI * 2, sp = p.sp * (o.speed ?? 1) * (0.4 + rnd() * 0.8), sx = Math.cos(a) * sp, sz = Math.sin(a) * sp;
      const bx = o.dir ? o.dir[0] * sp * 1.2 : 0, bz = o.dir ? o.dir[1] * sp * 1.2 : 0, R = o.spread ?? 0.15;
      A.aP.array.set([x + (rnd() - 0.5) * R * 2, y + (rnd() - 0.5) * R, z + (rnd() - 0.5) * R * 2], i * 3);
      A.aV.array.set([sx + bx, p.up * (o.speed ?? 1) * (0.5 + rnd() * 0.8), sz + bz], i * 3);
      const sz0 = p.s0 * (o.size ?? 1) * (0.7 + rnd() * 0.6);
      A.aT.array.set([time.value, p.life * (o.life ?? 1) * (0.7 + rnd() * 0.6), sz0, p.s1 * (o.size ?? 1) * (0.7 + rnd() * 0.6)], i * 4);
      let r = tc.r, g = tc.g, b = tc.b;
      if (kind === 'confetti') { tc.set(CONF[q % CONF.length]).convertSRGBToLinear(); r = tc.r * 1.2; g = tc.g * 1.2; b = tc.b * 1.2; }
      A.aC.array.set([r, g, b, p.m], i * 4);
      A.aM.array.set([p.g, p.dr, p.w, p.spin * (rnd() - 0.5) * 2], i * 4);
    }
    pDirty = true;
  }
  const CONF = ['#f0a040', '#5fd3ff', '#f4ead2', '#e8667a', '#ffd166'];

  // ---------- labels: one glyph atlas ----------
  const CH = ' 0123456789+-x!.:/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const GW = 32, GH = 48, COLS = 32, ROWS = Math.ceil(CH.length / COLS);
  const atlas = document.createElement('canvas'); atlas.width = GW * COLS; atlas.height = GH * ROWS;
  { const x = atlas.getContext('2d'); x.font = `800 ${GH * 0.72}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    for (let k = 0; k < CH.length; k++) { const cx = (k % COLS) * GW + GW / 2, cy = Math.floor(k / COLS) * GH + GH / 2 + 2; x.lineWidth = 7; x.strokeStyle = 'rgba(12,10,14,0.92)'; x.strokeText(CH[k], cx, cy); x.fillStyle = '#ffffff'; x.fillText(CH[k], cx, cy); } }
  const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.minFilter = THREE.LinearFilter; atlasTex.generateMipmaps = false;
  const LN = 512, labelK = { value: 1 };   // [top] labelK
  const Lq = quadGeo(LN, { aP: 3, aG: 4, aT: 4, aC: 3 });   // anchor; glyph col,row, x offset, size; birth, life, rise, pop
  const lMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, tAtlas: { value: atlasTex }, uCell: { value: new THREE.Vector2(1 / COLS, 1 / ROWS) }, uTopK: labelK },   // [top] uTopK: labels grow as the ortho view pulls back
    vertexShader: `
      attribute vec3 aP, aC; attribute vec4 aG, aT; uniform float uTime; uniform vec2 uCell; uniform float uTopK;
      varying vec2 vUv; varying vec3 vC; varying float vA;
      void main(){
        float age = uTime - aT.x, t = age / aT.y;
        if (aT.y <= 0.0 || t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec3 p = aP + vec3(0.0, aT.z * (1.0 - pow(1.0 - min(1.0, t * 1.4), 2.0)), 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        mv.y += (p.y - aP.y) + 0.6 + aP.y * 0.3; // [top] rise on screen, not in the air (edge-on from above)
        float pop = 1.0 + aT.w * max(0.0, 1.0 - age / 0.14);
        float s = aG.w * pop * uTopK;
        mv.xy += (position.xy * vec2(0.5, 0.75) + vec2(aG.z * 0.62, 0.0)) * s;
        gl_Position = projectionMatrix * mv;
        vec2 q = position.xy * 0.5 + 0.5; vUv = vec2((aG.x + q.x) * uCell.x, 1.0 - (aG.y + 1.0 - q.y) * uCell.y);
        vC = aC; vA = 1.0 - smoothstep(0.7, 1.0, t);
      }`,
    fragmentShader: `uniform sampler2D tAtlas; varying vec2 vUv; varying vec3 vC; varying float vA;
      void main(){ vec4 g = texture2D(tAtlas, vUv); if (g.a < 0.02) discard; gl_FragColor = vec4(g.rgb * vC, g.a * vA); }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const lMesh = new THREE.Mesh(Lq.g, lMat); lMesh.frustumCulled = false; lMesh.renderOrder = 40; group.add(lMesh);
  let li = 0, lDirty = false;
  /** float a short label at a world point: text uses the atlas characters */
  function label(x, y, z, text, color = '#ffffff', o = {}) {
    tc.set(color).convertSRGBToLinear().multiplyScalar(o.k ?? 1.6);
    const n = text.length, size = o.size ?? 0.34, life = o.life ?? 1.2;
    for (let k = 0; k < n; k++) {
      const ci = CH.indexOf(text[k]); if (ci <= 0) continue;
      const i = li; li = (li + 1) % LN;
      Lq.a.aP.array.set([x, y, z], i * 3);
      Lq.a.aG.array.set([ci % COLS, Math.floor(ci / COLS), k - (n - 1) / 2, size], i * 4);
      Lq.a.aT.array.set([time.value, life, o.rise ?? 0.9, o.pop ?? 0.5], i * 4);
      Lq.a.aC.array.set([tc.r, tc.g, tc.b], i * 3);
    }
    lDirty = true;
  }

  // ---------- rings (bursts) ----------
  const RN = 48;
  const ringGeo = new THREE.RingGeometry(0.72, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  const Rg = new THREE.InstancedBufferGeometry(); Rg.index = ringGeo.index; Rg.setAttribute('position', ringGeo.attributes.position);
  const rA = new THREE.InstancedBufferAttribute(new Float32Array(RN * 4), 4), rB = new THREE.InstancedBufferAttribute(new Float32Array(RN * 4), 4);   // x, y, z, radius; birth, life, colour (packed r,g,b in .z .w? no: rgb in rC)
  const rC = new THREE.InstancedBufferAttribute(new Float32Array(RN * 3), 3);
  [rA, rB, rC].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
  Rg.setAttribute('aA', rA); Rg.setAttribute('aB', rB); Rg.setAttribute('aC', rC); Rg.instanceCount = RN;
  const rMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: `attribute vec4 aA, aB; attribute vec3 aC; uniform float uTime; varying vec3 vC; varying float vA;
      void main(){ float t = (uTime - aB.x) / aB.y; if (aB.y <= 0.0 || t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float e = 1.0 - pow(1.0 - t, 3.0); vec3 p = position * aA.w * (0.25 + 0.75 * e); p.y = 0.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p + aA.xyz, 1.0); vC = aC; vA = (1.0 - t) * 0.9; }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC * vA * 0.6, 0.0); }',
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const rMesh = new THREE.Mesh(Rg, rMat); rMesh.frustumCulled = false; rMesh.renderOrder = 6; group.add(rMesh);
  let ri = 0, rDirty = false;
  function ring(x, y, z, r, color, life = 0.6) {
    const i = ri; ri = (ri + 1) % RN; tc.set(color).convertSRGBToLinear().multiplyScalar(1.6);
    rA.array.set([x, y, z, r], i * 4); rB.array.set([time.value, life, 0, 0], i * 4); rC.array.set([tc.r, tc.g, tc.b], i * 3); rDirty = true;
  }

  // ---------- blobs: a soft dark ellipse under every unit ----------
  const BN = 1200;
  const blobGeo = new THREE.PlaneGeometry(2, 2); blobGeo.rotateX(-Math.PI / 2);
  const blobMat = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0.5 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uK; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = 1.0 - smoothstep(0.15, 1.0, d); gl_FragColor = vec4(0.02, 0.02, 0.04, a * a * uK); }`,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, BN); blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = 2; group.add(blobs);
  let bn = 0; const bm = blobs.instanceMatrix.array;
  function blob(x, y, z, rx, rz = rx) { if (bn >= BN) return; const o = bn * 16; bm[o] = rx; bm[o + 1] = 0; bm[o + 2] = 0; bm[o + 3] = 0; bm[o + 4] = 0; bm[o + 5] = 1; bm[o + 6] = 0; bm[o + 7] = 0; bm[o + 8] = 0; bm[o + 9] = 0; bm[o + 10] = rz; bm[o + 11] = 0; bm[o + 12] = x; bm[o + 13] = y + 0.03; bm[o + 14] = z; bm[o + 15] = 1; bn++; }

  // ---------- stains: where the dead fall ----------
  const SN = 96;
  const stA = new THREE.InstancedBufferAttribute(new Float32Array(SN * 4), 4); stA.setUsage(THREE.DynamicDrawUsage);   // x, y, z, birth
  const stB = new THREE.InstancedBufferAttribute(new Float32Array(SN * 2), 2); stB.setUsage(THREE.DynamicDrawUsage);   // size, rotation
  const Sg = new THREE.InstancedBufferGeometry(); Sg.index = blobGeo.index; Sg.setAttribute('position', blobGeo.attributes.position); Sg.setAttribute('uv', blobGeo.attributes.uv); Sg.setAttribute('aA', stA); Sg.setAttribute('aB', stB); Sg.instanceCount = SN;
  for (let i = 0; i < SN; i++) stA.array[i * 4 + 3] = -1e4;
  const sMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uCol: { value: lin('#2a2226') } },
    vertexShader: `attribute vec4 aA; attribute vec2 aB; uniform float uTime; varying vec2 vUv; varying float vA; varying float vS;
      void main(){ float age = uTime - aA.w; vA = (1.0 - smoothstep(14.0, 24.0, age)) * smoothstep(0.0, 0.3, age); vS = aA.x * 1.7 + aA.z * 3.1;
        float c = cos(aB.y), s = sin(aB.y); vec3 p = vec3(c * position.x - s * position.z, 0.0, s * position.x + c * position.z) * aB.x * min(1.0, 0.4 + age * 3.0);
        vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(p + aA.xyz + vec3(0.0, 0.035, 0.0), 1.0); }`,
    fragmentShader: `uniform vec3 uCol; varying vec2 vUv; varying float vA; varying float vS;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + vS) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){ vec2 q = vUv - 0.5; float d = length(q) * 2.0 + (n(q * 7.0) - 0.5) * 0.55; float a = (1.0 - smoothstep(0.5, 0.85, d)) * vA * 0.7; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }`,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const sMesh = new THREE.Mesh(Sg, sMat); sMesh.frustumCulled = false; sMesh.renderOrder = 1; group.add(sMesh);
  let si = 0, sDirty = false;
  function stain(x, y, z, size = 0.7) { const i = si; si = (si + 1) % SN; stA.array.set([x, y, z, time.value], i * 4); stB.array.set([size * (0.8 + rnd() * 0.4), rnd() * 6.28], i * 2); sDirty = true; }

  // ---------- light pools ----------
  const LS = 256, LMAX = 160;
  const lrt = new THREE.WebGLRenderTarget(LS, LS, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
  const lScene = new THREE.Scene(), lCam = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  lCam.up.set(0, 0, -1); lCam.position.set(0, 5, 0); lCam.lookAt(0, 0, 0);
  const lpA = new THREE.InstancedBufferAttribute(new Float32Array(LMAX * 4), 4), lpC = new THREE.InstancedBufferAttribute(new Float32Array(LMAX * 3), 3);
  lpA.setUsage(THREE.DynamicDrawUsage); lpC.setUsage(THREE.DynamicDrawUsage);
  const lG = new THREE.InstancedBufferGeometry(); lG.index = blobGeo.index; lG.setAttribute('position', blobGeo.attributes.position); lG.setAttribute('aA', lpA); lG.setAttribute('aC', lpC); lG.instanceCount = 0;
  const lMatP = new THREE.ShaderMaterial({
    vertexShader: `attribute vec4 aA; attribute vec3 aC; varying vec2 vQ; varying vec3 vC; varying float vS;
      void main(){ vQ = position.xz; vC = aC; vS = aA.w; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * aA.z + vec3(aA.x, 0.0, aA.y), 1.0); }`,
    fragmentShader: `varying vec2 vQ; varying vec3 vC; varying float vS;
      void main(){ float d = length(vQ); if (d > 1.0) discard; float f = 1.0 - d * d; f *= f; float core = exp(-d * d * 18.0) * vS; gl_FragColor = vec4(vC * (f + core), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
  });
  const lMeshP = new THREE.Mesh(lG, lMatP); lMeshP.frustumCulled = false; lScene.add(lMeshP);
  let ln = 0; const lo = new THREE.Vector2(), clearCol = new THREE.Color(0, 0, 0);
  K.T.light.value = lrt.texture;
  /** pools: begin(cx, cz, size) → light(x, z, r, hex|Color, k, core) … → end() renders the texture */
  const pools = {
    size: 72,
    begin(cx, cz, size = 72) { const tx = size / LS; this.size = size; lo.set(Math.floor((cx - size / 2) / tx) * tx, Math.floor((cz - size / 2) / tx) * tx); ln = 0; },
    light(x, z, r, color, k = 1, core = 0) {
      if (ln >= LMAX || x + r < lo.x || z + r < lo.y || x - r > lo.x + this.size || z - r > lo.y + this.size) return;
      if (color.isColor) tc.copy(color); else tc.set(color).convertSRGBToLinear();
      lpA.array.set([x, z, r, core], ln * 4); lpC.array.set([tc.r * k, tc.g * k, tc.b * k], ln * 3); ln++;
    },
    end(strength) {
      K.T.lightO.value.copy(lo); K.T.lightS.value = this.size; K.T.lightK.value = strength;
      if (strength <= 0.001) return;
      lCam.left = lo.x; lCam.right = lo.x + this.size; lCam.top = -lo.y; lCam.bottom = -(lo.y + this.size); lCam.updateProjectionMatrix();
      lG.instanceCount = ln; lpA.needsUpdate = true; lpC.needsUpdate = true;
      const prev = renderer.getRenderTarget(), pc = renderer.getClearColor(new THREE.Color()), pa = renderer.getClearAlpha();
      renderer.setRenderTarget(lrt); renderer.setClearColor(clearCol, 1); renderer.clear(true, false, false);
      if (ln) renderer.render(lScene, lCam);
      renderer.setRenderTarget(prev); renderer.setClearColor(pc, pa);
    },
  };

  return {
    time, emit, label, ring, stain, pools, labelK,
    blobs: { begin() { bn = 0; }, add: blob, end(k) { blobs.count = bn; blobs.instanceMatrix.needsUpdate = true; blobMat.uniforms.uK.value = k; } },
    /** per frame: advance the clock and upload what changed */
    /** lit: how much daylight the unlit particles (dust, smoke, blood) catch: 1 day … ~0.2 night */
    update(t, lit = 1) {
      time.value = t; K.T.time.value = t; pMat.uniforms.uLit.value = lit;
      if (pDirty) { for (const k of ['aP', 'aV', 'aT', 'aC', 'aM']) P.a[k].needsUpdate = true; pDirty = false; }
      if (lDirty) { for (const k of ['aP', 'aG', 'aT', 'aC']) Lq.a[k].needsUpdate = true; lDirty = false; }
      if (rDirty) { rA.needsUpdate = rB.needsUpdate = rC.needsUpdate = true; rDirty = false; }
      if (sDirty) { stA.needsUpdate = stB.needsUpdate = true; sDirty = false; }
    },
  };
}
