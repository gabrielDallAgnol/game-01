// Zoom demo (lab): one Hollowmere, one zoom, from the map down to Kai's eyes, in the One-medium style.
// The town is the real engine town raised into 3D (buildings from their footprints and heights, gable roofs, trees,
// cars), with Hilde, the turrets, Kai and the Ash-Born as simple lit solids. The frame is drawn whole into a target;
// a last pass turns every screen cell that shows a solid into a glyph by its light (shadow empty, light dense
// letters, the colour inside them), and leaves the soft things as they are: the ground as combed hair with the dead's
// tracks, grass blades that bend in the wind and part round Kai, falling ash, the sky and the haze.
// The camera is one curve: a high map (each thing a letter on a plate), straight down, tilting, behind Kai, her eyes.
// Figures are drawn bigger than life from above and life-size up close. Lab code: nothing here reaches the game.
/* global THREE */
import { RECIPES, recipeRegistry, buildArea } from '../../src/engine/recipes.js';
import { pointInObb } from '../../src/engine/geom.js';

const $ = id => document.getElementById(id);
const fail = e => { const el = $('err'); el.hidden = false; el.textContent = 'The demo could not start: ' + (e && e.message || e); };
try { start(); } catch (e) { console.error(e); fail(e); }

function start() {
  if (typeof THREE === 'undefined') throw new Error('three.js did not load (no network?)');
  // =========================================================================================
  // the town, as data
  // =========================================================================================
  const W = buildArea('hollowmere', 7, recipeRegistry('hollowmere'), RECIPES.hollowmere.game).W;
  const camp = { x: W.camp.x, y: W.camp.y }, SPAN = 220, O = { x: camp.x - SPAN / 2, y: camp.y - SPAN / 2 };
  const near = (p, m = 8) => Math.abs(p.x - camp.x) < SPAN / 2 + m && Math.abs(p.y - camp.y) < SPAN / 2 + m;
  const rigAtom = W.placed.find(p => p.def.tags.includes('camp.rig'));
  const buildings = W.placed.filter(p => near(p) && p.def.kind === 'building' && p !== rigAtom);
  const trees = W.placed.filter(p => near(p) && p.def.look === 'tree');
  const cars = W.placed.filter(p => near(p) && (p.def.tags.includes('car') || p.def.tags.includes('railcar')));
  const X = x => x - camp.x, Z = y => y - camp.y;   // engine (x, y) → three (x, z)
  // the ground's classes, 4 px a metre: r streets, g the square's setts, b under a building
  const MPX = 4, MRES = SPAN * MPX, mC = document.createElement('canvas'); mC.width = mC.height = MRES; const mX = mC.getContext('2d');
  mX.fillStyle = '#000'; mX.fillRect(0, 0, MRES, MRES); mX.setTransform(MPX, 0, 0, MPX, -O.x * MPX, -O.y * MPX); mX.globalCompositeOperation = 'lighter'; mX.lineCap = 'round';
  for (const s of W.streets) { mX.strokeStyle = s.kind === 'path' ? 'rgb(150,0,0)' : 'rgb(255,0,0)'; mX.lineWidth = s.w; mX.beginPath(); s.pts.forEach((q, i) => i ? mX.lineTo(q.x, q.y) : mX.moveTo(q.x, q.y)); mX.stroke(); }
  if (W.plaza) { const P = W.plaza; mX.save(); mX.translate(P.x, P.y); mX.rotate(P.rot); mX.fillStyle = 'rgb(0,255,0)'; mX.fillRect(-P.w / 2 + 2, -P.h / 2 + 2, P.w - 4, P.h - 4); mX.restore(); }
  const obb = (x, p, pad) => { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillRect(-p.w / 2 - pad, -p.h / 2 - pad, p.w + 2 * pad, p.h + 2 * pad); x.restore(); };
  mX.fillStyle = 'rgb(0,0,255)'; for (const p of buildings) obb(mX, p, 0.3); for (const p of cars) obb(mX, p, 0.2);
  // where feet cannot go: buildings, 2 cells a metre
  const GR = 2, GN = SPAN * GR, solid = new Uint8Array(GN * GN);
  for (const p of buildings) { const r = Math.hypot(p.w, p.h) / 2 + 0.5, gx0 = Math.max(0, Math.floor((p.x - r - O.x) * GR)), gx1 = Math.min(GN - 1, Math.ceil((p.x + r - O.x) * GR)), gy0 = Math.max(0, Math.floor((p.y - r - O.y) * GR)), gy1 = Math.min(GN - 1, Math.ceil((p.y + r - O.y) * GR));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) if (pointInObb(p, O.x + (gx + 0.5) / GR, O.y + (gy + 0.5) / GR, 0.15)) solid[gy * GN + gx] = 1; }
  // Hilde and the guns are solid too (nobody walks through the truck)
  const mark = (p, pad) => { const r = Math.hypot(p.w, p.h) / 2 + pad + 0.5, gx0 = Math.max(0, Math.floor((p.x - r - O.x) * GR)), gx1 = Math.min(GN - 1, Math.ceil((p.x + r - O.x) * GR)), gy0 = Math.max(0, Math.floor((p.y - r - O.y) * GR)), gy1 = Math.min(GN - 1, Math.ceil((p.y + r - O.y) * GR));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) if (pointInObb(p, O.x + (gx + 0.5) / GR, O.y + (gy + 0.5) / GR, pad)) solid[gy * GN + gx] = 1; };
  if (rigAtom) mark({ x: rigAtom.x, y: rigAtom.y, w: 9.2, h: 2.8, rot: rigAtom.rot }, 0.3);
  const blocked = (x, y) => { const gx = Math.floor((x - O.x) * GR), gy = Math.floor((y - O.y) * GR); return gx < 0 || gy < 0 || gx >= GN || gy >= GN || solid[gy * GN + gx] === 1; };

  // =========================================================================================
  // the scene
  // =========================================================================================
  const glc = $('gl'), fxc = $('fx'), fx = fxc.getContext('2d');
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000); camera.rotation.order = 'YXZ';
  const SKY = { day: new THREE.Color(0.22, 0.24, 0.27), night: new THREE.Color(0.035, 0.045, 0.07) };
  scene.fog = new THREE.Fog(SKY.day.clone(), 400, 900);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 }); sun.shadow.bias = -0.0008; scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xc9d4e0, 0x2a2f2a, 0.55); scene.add(hemi);
  const lamp = new THREE.PointLight(0xffb060, 0, 14, 1.6); scene.add(lamp);
  const WD = new THREE.Vector2(0.731, 0.682);
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glowMat = col => new THREE.MeshBasicMaterial({ color: col });
  const col = (r, g, b) => new THREE.Color(r, g, b);

  // ---------- merging coloured parts into one geometry (a draw a family) ----------
  function merge(parts) {
    let n = 0; const gs = parts.map(([g, c, m]) => { g = g.index ? g.toNonIndexed() : g.clone(); if (!g.attributes.normal) g.computeVertexNormals(); if (m) g.applyMatrix4(m); n += g.attributes.position.count; return [g, c]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cl = new Float32Array(n * 3); let o = 0;
    for (const [g, c] of gs) { const k = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (let i = 0; i < k; i++) { cl[(o + i) * 3] = c.r; cl[(o + i) * 3 + 1] = c.g; cl[(o + i) * 3 + 2] = c.b; } o += k; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(cl, 3)); return out;
  }
  const M4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
  const box = (w, h, d, y0 = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0 + h / 2, 0); return g; };
  function prism(w, d, rh, ov = 0.35) {   // a gable roof: ridge along x, eaves at y 0, ridge at rh
    const x0 = w / 2 + ov, z0 = d / 2 + ov, A = [-x0, 0, -z0], B = [x0, 0, -z0], C = [x0, rh, 0], D = [-x0, rh, 0], E = [-x0, 0, z0], F = [x0, 0, z0];
    const tri = [A, D, C, A, C, B, E, C, D, E, F, C, B, C, F, A, E, D].flat(), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals(); return g;
  }

  // ---------- the ground: hair on open ground (combed by the wind, parted by Kai, flattened where the dead trod) ----------
  const tMask = new THREE.CanvasTexture(mC); tMask.minFilter = THREE.LinearFilter; tMask.generateMipmaps = false;
  const PR = 256, pC = document.createElement('canvas'); pC.width = pC.height = PR; const pX = pC.getContext('2d'); pX.fillStyle = '#000'; pX.fillRect(0, 0, PR, PR);
  const tPress = new THREE.CanvasTexture(pC); tPress.minFilter = THREE.LinearFilter; tPress.generateMipmaps = false;
  const NP = 16, pushes = Array.from({ length: NP }, () => new THREE.Vector4(0, 0, 0, 0));
  const GU = { tMask: { value: tMask }, tPress: { value: tPress }, uSpan: { value: SPAN }, uTime: { value: 0 }, uNight: { value: 0 }, uPush: { value: pushes }, WD: { value: WD }, uFocus: { value: new THREE.Vector2() }, uL: { value: 32 }, uFogC: { value: SKY.day.clone() }, uFogN: { value: 400 }, uFogF: { value: 900 }, uCamH: { value: 30 } };
  const NOISE = `float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float gust(vec2 p){ return smoothstep(0.3, 0.85, vnoise(p * 0.045 - WD * uTime * 0.55) * 0.7 + vnoise(p * 0.12 - WD * uTime * 0.95) * 0.3); }
    vec2 maskUV(vec2 w){ return vec2((w.x + uSpan * 0.5) / uSpan, 1.0 - (w.y + uSpan * 0.5) / uSpan); }`;
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff, opacity: 0.0 });   // opacity 0: a soft thing, the glyph pass leaves it alone
  groundMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, GU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform sampler2D tMask, tPress; uniform float uSpan, uTime, uNight, uCamH; uniform vec2 WD; uniform vec4 uPush[${NP}];
      ${NOISE}
      vec3 groundCol(vec2 w){
        vec2 uv = maskUV(w); vec3 m = texture2D(tMask, uv).rgb; float press = texture2D(tPress, uv).r, street = m.r, setts = m.g * (1.0 - street), under = m.b, g0 = gust(w);
        vec3 earth = vec3(0.11, 0.125, 0.11) + vnoise(w * 0.35) * 0.04;
        // hair: a line integral of fine seeds along the flow
        float th = atan(WD.y, WD.x) + 2.4 * (vnoise(w * 0.05 + vec2(uTime * 0.01, 0.0)) - 0.5) + 1.1 * (vnoise(w * 0.21) - 0.5) + (g0 - 0.4) * 0.6;
        vec2 dir = vec2(cos(th), sin(th)), push = vec2(0.0);
        for (int k = 0; k < ${NP}; k++) { vec2 d = w - uPush[k].xy; float r = length(d); if (r < uPush[k].z) push += d / max(r, 0.01) * (1.0 - r / uPush[k].z); }
        float pl = length(push); if (pl > 0.02) dir = normalize(mix(dir, push / pl, clamp(pl * 1.4, 0.0, 1.0)));
        float stepL = 0.055 * mix(1.0, 0.4, press) * max(1.0, uCamH / 45.0), acc = 0.0, tip = 0.0;
        for (int k = -8; k <= 8; k++) { float fk = float(k); vec2 q = mat2(0.866, 0.5, -0.5, 0.866) * (w + dir * fk * stepL); float sd = step(0.8, h21(floor(q * 13.0 + vec2(h21(vec2(floor(q.y * 13.0), 3.0)), 0.0)))); acc += sd; tip += sd * (fk + 8.0) / 16.0; }
        float hair = clamp(acc / 3.6, 0.0, 1.0), hl = clamp(tip / max(acc, 1e-3), 0.0, 1.0), thick = 0.45 + 0.55 * smoothstep(0.2, 0.75, vnoise(w * 0.07 + 3.7));
        vec3 hc = mix(vec3(0.13, 0.17, 0.14), vec3(0.5, 0.58, 0.48), hl) * (0.8 + 0.4 * g0) * mix(1.0, 0.5, press);
        vec3 grass = mix(earth, hc, thick * smoothstep(0.1, 0.6, hair));
        // hard ground: asphalt with ash dust that feet print; setts in the square
        vec3 asph = vec3(0.1, 0.105, 0.115) + (h21(floor(w * 9.0)) - 0.5) * 0.02; float dust = smoothstep(0.55, 0.9, vnoise(w * 5.0) * 0.65 + vnoise(w * 1.3) * 0.35) * (1.0 - press * 0.9); asph = mix(asph, vec3(0.3, 0.3, 0.29), dust * 0.35);
        vec3 stone = vec3(0.2, 0.2, 0.19) + (vnoise(w * 1.4) - 0.5) * 0.05; stone = mix(stone, vec3(0.38, 0.37, 0.35), dust * 0.4); stone *= mix(1.0, 0.6, press);
        vec3 c = mix(grass, asph, street); c = mix(c, mix(stone, grass, 0.35), setts); c = mix(c, earth * 0.7, under);
        return c * 0.95; }`).replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = groundCol(vW.xz);');
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SPAN + 400, SPAN + 400), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // ---------- grass blades near the camera: a tile that follows the focus, bending with the wind ----------
  const L = 32, STEPG = 0.16, NB = Math.floor(L / STEPG) ** 2;
  const blade = new THREE.InstancedBufferGeometry(); { const seg = []; for (let i = 0; i < 3; i++) { const h0 = i / 3, h1 = (i + 1) / 3; seg.push(-1, h0, 1, h0, 1, h1, -1, h0, 1, h1, -1, h1); } seg.push(-1, 1, 1, 1, 0, 1.12); blade.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(seg.length / 2 * 3), 3)); blade.setAttribute('seg', new THREE.Float32BufferAttribute(seg, 2)); }
  { const off = new Float32Array(NB * 4), n = Math.floor(L / STEPG); for (let i = 0; i < NB; i++) { const gx = i % n, gy = Math.floor(i / n); off.set([(gx + Math.random()) * STEPG, (gy + Math.random()) * STEPG, Math.random(), Math.random()], i * 4); } blade.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); blade.instanceCount = NB; }
  const grassMat = new THREE.ShaderMaterial({ uniforms: GU, side: THREE.DoubleSide, vertexShader: `attribute vec2 seg; attribute vec4 aOff; uniform sampler2D tMask, tPress; uniform float uSpan, uTime, uL; uniform vec2 WD, uFocus; uniform vec4 uPush[${NP}];
      varying float vH, vFogD, vLit; ${NOISE}
      void main(){
        vec2 base = uFocus - uL * 0.5 + mod(aOff.xy - (uFocus - uL * 0.5), uL);
        vec2 uv = maskUV(base); vec3 m = texture2D(tMask, uv).rgb; float grass = (1.0 - m.r) * (1.0 - m.g) * (1.0 - m.b), press = texture2D(tPress, uv).r;
        float edge = 1.0 - smoothstep(uL * 0.36, uL * 0.5, max(abs(base.x - uFocus.x), abs(base.y - uFocus.y)));
        float H = (0.3 + 0.32 * aOff.z) * grass * edge * mix(1.0, 0.4, press), g = gust(base);
        vec2 lean = normalize(WD + (vec2(aOff.w, aOff.z) - 0.5) * 1.3) * (0.5 + 0.55 * g);
        for (int k = 0; k < ${NP}; k++) { vec2 d = base - uPush[k].xy; float r = length(d); if (r < uPush[k].z) lean += d / max(r, 0.01) * (1.0 - r / uPush[k].z) * 1.8; }
        lean *= mix(1.0, 2.0, press);
        float h = seg.y; vec2 ln = normalize(lean + 1e-4), sv = vec2(-ln.y, ln.x);
        vec3 p = vec3(base.x, 0.0, base.y); p.xz += sv * seg.x * 0.017 * (1.0 - h * 0.85); p.xz += lean * H * h * h * 0.85; p.y += H * h * (1.0 - 0.4 * min(length(lean), 1.6) * h);
        vH = h; vLit = 0.75 + 0.5 * g; vec4 mv = modelViewMatrix * vec4(p, 1.0); vFogD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight, uFogN, uFogF; uniform vec3 uFogC; varying float vH, vFogD, vLit;
      void main(){ vec3 c = mix(vec3(0.12, 0.15, 0.12), vec3(0.58, 0.64, 0.52), vH) * vLit * mix(1.0, 0.42, uNight);
        c = mix(c, uFogC, smoothstep(uFogN, uFogF, vFogD)); gl_FragColor = vec4(c, 0.0); }` });
  const grassMesh = new THREE.Mesh(blade, grassMat); grassMesh.frustumCulled = false; scene.add(grassMesh);

  // ---------- buildings, trees, cars ----------
  { const parts = [];
    for (const p of buildings) {
      const H = Math.max(3.5, Math.min(34, p.def.height || 6)), gable = p.def.look === 'gable' || p.def.look === 'church', wallH = gable ? H * 0.62 : H, m = M4(X(p.x), 0, Z(p.y), -p.rot), v = (p.uid * 37 % 100) / 100;
      parts.push([box(p.w, wallH, p.h), col(0.6 + v * 0.08, 0.58 + v * 0.06, 0.54 + v * 0.04), m]);
      if (gable) parts.push([prism(p.w, p.h, H - wallH), col(0.62, 0.4 + v * 0.06, 0.34), new THREE.Matrix4().multiplyMatrices(m, M4(0, wallH, 0))]);
      else parts.push([box(p.w + 0.3, 0.35, p.h + 0.3, wallH), col(0.42, 0.42, 0.44), m]);
    }
    const g = merge(parts), mesh = new THREE.Mesh(g, solidMat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); }
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), solidMat.clone(), trees.length), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0), solidMat.clone(), trees.length);
  crowns.material.vertexColors = false; crowns.material.color = col(0.36, 0.46, 0.34); trunks.material.vertexColors = false; trunks.material.color = col(0.3, 0.25, 0.2);
  crowns.castShadow = trunks.castShadow = true; crowns.receiveShadow = true; scene.add(crowns, trunks);
  const treeData = trees.map(p => { const r = (p.r || p.def.size[0] / 2) * 0.82; return { x: X(p.x), z: Z(p.y), r, h: 2.6 + r * 0.55, ph: Math.random() * 6 }; });
  treeData.forEach((t, i) => trunks.setMatrixAt(i, M4(t.x, 0, t.z, 0, 1, t.h + 0.4, 1)));
  { const parts = []; for (const p of cars) { const m = M4(X(p.x), 0, Z(p.y), -p.rot), c = [col(0.36, 0.42, 0.5), col(0.52, 0.34, 0.3), col(0.4, 0.44, 0.38), col(0.55, 0.55, 0.52)][p.uid % 4]; parts.push([box(p.w, 0.85, p.h, 0.25), c, m], [box(p.w * 0.55, 0.55, p.h * 0.9, 1.1), c.clone().multiplyScalar(0.8), m]); }
    if (parts.length) { const mesh = new THREE.Mesh(merge(parts), solidMat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); } }

  // ---------- Hilde: the recovery truck, her crane, her beacons ----------
  const rig = rigAtom ? { x: rigAtom.x, y: rigAtom.y, rot: rigAtom.rot } : { x: camp.x, y: camp.y, rot: 0 };
  const hilde = new THREE.Group(); hilde.position.set(X(rig.x), 0, Z(rig.y)); hilde.rotation.y = -rig.rot; scene.add(hilde);
  { const Y = col(1.0, 0.76, 0.18), S = col(0.62, 0.65, 0.68), D = col(0.2, 0.21, 0.23), T = col(0.5, 0.58, 0.44), R = col(0.78, 0.4, 0.24), parts = [];
    for (const ax of [3.3, -1.5, -2.8]) for (const s of [-1, 1]) parts.push([new THREE.CylinderGeometry(0.48, 0.48, 0.4, 12).rotateX(Math.PI / 2).translate(0, 0.48, 0), D, M4(ax, 0, s * 1.32)]);
    parts.push([box(6.0, 0.5, 2.4, 0.5), S, M4(-1.4, 0, 0)], [box(2.9, 1.8, 2.5, 0.6), Y, M4(3.05, 0, 0)], [box(0.4, 0.9, 2.1, 1.4), D, M4(3.85, 0, 0)], [box(0.55, 0.8, 2.2, 0.6), Y, M4(4.25, 0, 0)],
      [box(2.9, 1.2, 2.3, 1.0), T, M4(-2.5, 0, 0)], [new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12).translate(0, 1.25, 0), S, M4(-0.6, 0, 0)],
      [box(2.5, 1.6, 2.1, 0.2), R, M4(-6.35, 0, 0)], [box(0.65, 0.12, 0.12, 0.6), D, M4(-4.8, 0, 0)],
      [box(0.9, 0.5, 0.9, 2.4), S, M4(2.6, 0, 0)], [box(0.06, 2.2, 0.06, 1.0), S, M4(1.25, 0, -0.95)], [box(0.05, 2.9, 0.05, 1.0), S, M4(1.9, 0, 1.0)]);
    for (const s of [-1, 1]) parts.push([box(5.8, 0.7, 0.14, 0.55), S, M4(-1.4, 0, s * 1.33)]);
    const body = new THREE.Mesh(merge(parts), solidMat); body.castShadow = body.receiveShadow = true; hilde.add(body); }
  const boom = new THREE.Group(); boom.position.set(-0.6, 1.6, 0); hilde.add(boom);
  { const b = new THREE.Mesh(merge([[box(4.4, 0.42, 0.42, -0.21), col(1.0, 0.76, 0.18), M4(-2.2, 0, 0)], [new THREE.SphereGeometry(0.16, 8, 6).translate(-4.4, -0.5, 0), col(0.8, 0.82, 0.85)]]), solidMat); b.rotation.z = -0.08; b.castShadow = true; boom.add(b); }
  const gun = new THREE.Group(); gun.position.set(2.6, 2.9, 0); hilde.add(gun);
  gun.add(new THREE.Mesh(merge([[box(0.6, 0.35, 0.55), col(1.0, 0.72, 0.25)], [new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6).rotateZ(Math.PI / 2).translate(0.7, 0.2, -0.12), col(0.2, 0.2, 0.22)], [new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6).rotateZ(Math.PI / 2).translate(0.7, 0.2, 0.12), col(0.2, 0.2, 0.22)]]), solidMat));
  const beaconMat = glowMat(0xffb040), beacons = [-0.6, 0.6].map(s => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), beaconMat); m.position.set(3.3, 2.55, s); hilde.add(m); return m; });
  const flood = new THREE.Mesh(box(0.25, 0.25, 0.4), glowMat(0xfff0c8)); flood.position.set(1.3, 3.15, -0.95); hilde.add(flood);
  const floodLight = new THREE.SpotLight(0xffe6b0, 0, 26, 0.6, 0.6, 1.2); floodLight.position.set(1.4, 3.2, -0.95); floodLight.target.position.set(10, 0, -3); hilde.add(floodLight, floodLight.target);

  // ---------- the turrets ----------
  const turrets = [[-7, -5], [7, 4], [-3, 8]].map(([dx, dy]) => { let x = camp.x + dx, y = camp.y + dy; for (let k = 0; k < 20 && blocked(x, y); k++) { x += dx * 0.1; y += dy * 0.1; }
    const g = new THREE.Group(); g.position.set(X(x), 0, Z(y)); scene.add(g);
    const base = new THREE.Mesh(merge([[new THREE.CylinderGeometry(0.62, 0.75, 0.6, 12), col(0.5, 0.53, 0.56), M4(0, 0.3, 0)]]), solidMat); base.castShadow = true; g.add(base);
    const head = new THREE.Group(); head.position.y = 0.75; g.add(head);
    const hm = new THREE.Mesh(merge([[box(0.62, 0.42, 0.55), col(1.0, 0.72, 0.22)], ...[-0.13, 0.13].map(s => [new THREE.CylinderGeometry(0.06, 0.06, 0.95, 6).rotateZ(Math.PI / 2).translate(0.75, 0.22, s), col(0.18, 0.18, 0.2)])]), solidMat); hm.castShadow = true; head.add(hm);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), glowMat(0xffe6a0)); flash.position.set(1.3, 0.22, 0); flash.visible = false; head.add(flash);
    mark({ x, y, w: 1.5, h: 1.5, rot: 0 }, 0.1);
    return { x, y, cd: Math.random(), aim: Math.random() * 6, g, head, flash, shotT: -9 }; });

  // ---------- Kai: the Mechanic, a figure of simple solids ----------
  const kaiG = new THREE.Group(); scene.add(kaiG);
  const KC = { suit: col(0.98, 0.72, 0.16), band: col(0.95, 0.97, 0.95), red: col(0.92, 0.2, 0.17), hair: col(0.42, 0.3, 0.22), pants: col(0.4, 0.34, 0.24), steel: col(0.82, 0.85, 0.88) };
  const limb = (len, r, c) => new THREE.Mesh(merge([[new THREE.CylinderGeometry(r, r * 0.9, len, 6).translate(0, -len / 2, 0), c]]), solidMat);
  const legs = [-1, 1].map(s => { const l = limb(0.8, 0.075, KC.pants); l.position.set(0, 0.82, s * 0.1); kaiG.add(l); return l; });
  const torso = new THREE.Mesh(merge([[box(0.27, 0.58, 0.46, 0.8), KC.suit], [box(0.07, 0.58, 0.47, 0.8), KC.band, M4(0.06, 0, 0)]]), solidMat); kaiG.add(torso);
  const arms = [-1, 1].map(s => { const a = limb(0.62, 0.065, KC.suit); a.position.set(0.02, 1.33, s * 0.27); kaiG.add(a); return a; });
  const head = new THREE.Mesh(merge([[new THREE.SphereGeometry(0.135, 10, 8).translate(0, 1.53, 0), KC.hair], [new THREE.SphereGeometry(0.128, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0.025, 1.555, 0), KC.red]]), solidMat); kaiG.add(head);
  const wrench = new THREE.Group(); arms[1].add(wrench); wrench.position.set(0, -0.6, 0);
  wrench.add(new THREE.Mesh(merge([[new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6).rotateZ(Math.PI / 2).translate(0.3, 0, 0), KC.steel], [new THREE.TorusGeometry(0.08, 0.03, 5, 10, Math.PI * 1.5).translate(0.66, 0, 0), KC.steel]]), solidMat));
  kaiG.traverse(o => { if (o.isMesh) o.castShadow = true; });

  // ---------- the Ash-Born: instanced parts (stone bodies, burning cracks and eyes) ----------
  const MAXD = 90, stoneMat = solidMat.clone(); stoneMat.vertexColors = false; stoneMat.color = col(0.72, 0.7, 0.66);
  const crackMat = glowMat(0xff7a2a), eyeMat = glowMat(0xffc06a);
  const part = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, MAXD * 3); m.count = 0; m.castShadow = mat === stoneMat; m.frustumCulled = false; scene.add(m); return m; };
  const D = { torso: part(box(0.3, 0.58, 0.44, -0.29), stoneMat), head: part(new THREE.SphereGeometry(0.14, 8, 6), stoneMat), limb: part(new THREE.CylinderGeometry(0.065, 0.06, 1, 6).translate(0, -0.5, 0), stoneMat), crack: part(box(0.05, 0.02, 0.24, 0), crackMat), eye: part(new THREE.SphereGeometry(0.035, 6, 4), eyeMat) };

  // ---------- falling ash ----------
  const NA = 1400, ashGeo = new THREE.BufferGeometry(), ashPos = new Float32Array(NA * 3); for (let i = 0; i < NA; i++) ashPos.set([Math.random() * 60 - 30, Math.random() * 25, Math.random() * 60 - 30], i * 3);
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ashMat = new THREE.ShaderMaterial({ uniforms: { uTime: GU.uTime, uFocus: GU.uFocus, uNight: GU.uNight, uPx: { value: 2 } }, vertexShader: `uniform float uTime, uPx; uniform vec2 uFocus; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y - uTime * 0.6, 25.0); p.x += sin(uTime * 0.5 + position.z) * 0.6 + uTime * 0.9; p.z += uTime * 0.85;
        p.xz = uFocus + mod(p.xz - uFocus + 30.0, 60.0) - 30.0; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * 22.0 / -mv.z, 1.0, 6.0) ; vA = clamp(1.0 - (-mv.z) / 60.0, 0.0, 1.0); }`,
    fragmentShader: `uniform float uNight; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard; gl_FragColor = vec4(vec3(0.82, 0.8, 0.76) * mix(1.0, 0.5, uNight) * (0.4 + 0.6 * vA), 0.0); }` });
  const ash = new THREE.Points(ashGeo, ashMat); ash.frustumCulled = false; scene.add(ash);

  // =========================================================================================
  // the little scene: Kai, the dead walking in on the camp, the guns
  // =========================================================================================
  let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const st = { t: 0, night: 0, nightOn: false, z: 0.33 };
  const kai = { x: camp.x + 4, y: camp.y + 6, vx: 0, vy: 0, face: 0, cd: 0, swing: 0, patrol: 0, idle: 9 };
  const dead = [], deaths = [], tracers = []; let nid = 1;
  function spawn(ang, dist) { for (let k = 0; k < 12; k++) { const a = ang + (rnd() - 0.5) * 0.3 * k, d = dist + rnd() * 10, x = camp.x + Math.cos(a) * d, y = camp.y + Math.sin(a) * d; if (!blocked(x, y)) { dead.push({ id: nid++, x, y, vx: 0, vy: 0, hp: 4, sp: 0.95 + rnd() * 0.55, side: rnd() < 0.5 ? -1 : 1, hit: -9, ph: rnd() * 6, fa: 0, brute: nid % 9 === 0 }); return; } } }
  for (let k = 0; k < 30; k++) spawn(rnd() * Math.PI * 2, 16 + rnd() * 50);
  function wave() { const a = rnd() * Math.PI * 2; for (let k = 0; k < 20; k++) spawn(a + (rnd() - 0.5) * 0.35, 58 + rnd() * 14); }
  function kill(d) { const i = dead.indexOf(d); if (i < 0) return; dead.splice(i, 1); deaths.push({ x: d.x, y: d.y, t0: st.t, id: d.id, fa: d.fa, brute: d.brute }); }
  const input = { on: false, x: 0, y: 0 }; let spawnT = 0;
  function step(dt, yaw) {
    st.t += dt; st.night += ((st.nightOn ? 1 : 0) - st.night) * Math.min(1, dt * 2);
    if ((spawnT -= dt) <= 0) { spawnT = st.nightOn ? 0.8 : 1.5; if (dead.length < (st.nightOn ? 60 : 40)) spawn(rnd() * Math.PI * 2, 70); }
    // Kai: walked by the stick (relative to the camera), else on patrol when seen from above
    let tx = 0, ty = 0;
    if (input.on) { const c = Math.cos(yaw), s = Math.sin(yaw); tx = input.x * c + input.y * s; ty = -input.x * s + input.y * c; kai.idle = 0; }
    else if (st.z < 0.5 && (kai.idle += dt) > 4) { let foe = null, fd = 7; for (const d of dead) { const r = Math.hypot(d.x - kai.x, d.y - kai.y); if (r < fd && Math.hypot(d.x - camp.x, d.y - camp.y) < 22) { fd = r; foe = d; } }
      let gx, gy; if (foe) { gx = foe.x; gy = foe.y; } else { kai.patrol += dt * 0.12; gx = camp.x + Math.cos(kai.patrol) * 11; gy = camp.y + Math.sin(kai.patrol) * 9; } const dx = gx - kai.x, dy = gy - kai.y, r = Math.hypot(dx, dy); if (r > 1.1) { tx = dx / r * 0.75; ty = dy / r * 0.75; } }
    const sp = 4.2; kai.vx += (tx * sp - kai.vx) * Math.min(1, dt * 10); kai.vy += (ty * sp - kai.vy) * Math.min(1, dt * 10);
    const nx = kai.x + kai.vx * dt, ny = kai.y + kai.vy * dt; if (!blocked(nx, kai.y)) kai.x = nx; if (!blocked(kai.x, ny)) kai.y = ny;
    if (Math.hypot(kai.vx, kai.vy) > 0.3) kai.face = Math.atan2(kai.vy, kai.vx); else if (st.z > 0.85) kai.face = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    kai.cd -= dt; kai.swing = Math.max(0, kai.swing - dt);
    if (kai.cd <= 0) { const d = dead.find(q => Math.hypot(q.x - kai.x, q.y - kai.y) < 1.8); if (d) { kai.cd = 0.45; kai.swing = 0.25; if (Math.hypot(kai.vx, kai.vy) < 0.3) kai.face = Math.atan2(d.y - kai.y, d.x - kai.x); d.hp -= 1.5; d.hit = st.t; if (d.hp <= 0) kill(d); } }
    for (const d of dead) {
      let dx = camp.x - d.x, dy = camp.y - d.y; const r = Math.hypot(dx, dy) || 1; dx /= r; dy /= r;
      if (Math.hypot(kai.x - d.x, kai.y - d.y) < 7) { dx = kai.x - d.x; dy = kai.y - d.y; const q = Math.hypot(dx, dy) || 1; dx /= q; dy /= q; }
      let vx = dx, vy = dy;
      if (r < 5.5 || Math.hypot(kai.x - d.x, kai.y - d.y) < 1.1) { vx = 0; vy = 0; }
      else for (const k of [0, 0.5, 1, 1.5, 2.1]) { const a = Math.atan2(dy, dx) + k * d.side, ax = Math.cos(a), ay = Math.sin(a); if (!blocked(d.x + ax * 1.1, d.y + ay * 1.1)) { vx = ax; vy = ay; break; } }
      for (const o of dead) { if (o === d) continue; const ex = d.x - o.x, ey = d.y - o.y, e = ex * ex + ey * ey; if (e < 0.8 && e > 1e-6) { vx += ex / e * 0.25; vy += ey / e * 0.25; } }
      const s = d.sp * (st.nightOn ? 1.25 : 1) * (d.brute ? 0.75 : 1); d.vx += (vx * s - d.vx) * Math.min(1, dt * 4); d.vy += (vy * s - d.vy) * Math.min(1, dt * 4);
      const mx = d.x + d.vx * dt, my = d.y + d.vy * dt; if (!blocked(mx, d.y)) d.x = mx; if (!blocked(d.x, my)) d.y = my; d.ph += dt * d.sp * 5;
      if (Math.hypot(d.vx, d.vy) > 0.15) d.fa = Math.atan2(d.vy, d.vx); else d.fa = Math.atan2(kai.y - d.y, kai.x - d.x);
    }
    for (const T of turrets) {
      T.cd -= dt; let best = null, bd = 15; for (const d of dead) { const r = Math.hypot(d.x - T.x, d.y - T.y); if (r < bd) { bd = r; best = d; } }
      if (best) { const want = Math.atan2(best.y - T.y, best.x - T.x); let a = want - T.aim; a = Math.atan2(Math.sin(a), Math.cos(a)); T.aim += a * Math.min(1, dt * 12); } else T.aim += dt * 0.3;
      if (best && T.cd <= 0) { T.cd = 1.1; T.shotT = st.t; tracers.push({ x0: T.x + Math.cos(T.aim) * 1.2, y0: T.y + Math.sin(T.aim) * 1.2, x1: best.x, y1: best.y, t0: st.t }); best.hp -= 1; best.hit = st.t; if (best.hp <= 0) kill(best); }
    }
    for (let k = tracers.length - 1; k >= 0; k--) if (st.t - tracers[k].t0 > 0.1) tracers.splice(k, 1);
    for (let k = deaths.length - 1; k >= 0; k--) if (st.t - deaths[k].t0 > 0.9) deaths.splice(k, 1);
  }
  // the trodden grass: feet press a low-res field that springs back over half a minute
  let pressT = 0;
  function stepPress(dt) {
    if ((pressT += dt) < 0.15) return; const k = pressT; pressT = 0;
    pX.globalCompositeOperation = 'source-over'; pX.fillStyle = `rgba(0,0,0,${Math.min(1, k / 25)})`; pX.fillRect(0, 0, PR, PR);
    const s = PR / SPAN, dot = (x, y, r, a) => { pX.fillStyle = `rgba(255,255,255,${a})`; pX.beginPath(); pX.arc((x - O.x) * s, (y - O.y) * s, r * s, 0, 7); pX.fill(); };
    for (const d of dead) if (Math.hypot(d.vx, d.vy) > 0.2) dot(d.x, d.y, d.brute ? 0.9 : 0.6, 0.5);
    dot(kai.x, kai.y, 0.45, 0.25);
    tPress.needsUpdate = true;
  }

  // =========================================================================================
  // drawing the figures each frame
  // =========================================================================================
  const tmp = new THREE.Object3D(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), qY = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3(), eul = new THREE.Euler();
  let figScale = 1.7;
  function drawFigures(camDist) {
    // Kai
    const k = figScale, sp = Math.hypot(kai.vx, kai.vy), wk = sp > 0.4 ? Math.sin(st.t * 9) : 0;
    kaiG.position.set(X(kai.x), 0, Z(kai.y)); kaiG.rotation.y = -kai.face; kaiG.scale.setScalar(k); kaiG.visible = camDist > 0.7;
    legs[0].rotation.z = wk * 0.5; legs[1].rotation.z = -wk * 0.5;
    const sw = kai.swing > 0 ? kai.swing / 0.25 : 0; arms[0].rotation.z = -wk * 0.4; arms[1].rotation.z = 0.5 + sw * 1.8; arms[1].rotation.x = -0.25;
    // the dead
    let ni = 0, nl = 0, nc = 0, ne = 0;
    const add = (mesh, i, m) => { mesh.setMatrixAt(i, m); };
    const body = (x, y, fa, s, sink) => { qY.setFromEuler(eul.set(0, -fa, 0)); return mA.compose(vP.set(X(x), -sink, Z(y)), qY, vS.set(s, s, s)).clone(); };
    const local = (B, x, y, z, rx, rz, sx = 1, sy = 1, sz = 1) => { tmp.position.set(x, y, z); tmp.rotation.set(rx, 0, rz); tmp.scale.set(sx, sy, sz); tmp.updateMatrix(); return mB.multiplyMatrices(B, tmp.matrix); };
    const night = st.night, pulse = 0.6 + 0.4 * Math.sin(st.t * 3);
    crackMat.color.setRGB(0.35 + 0.65 * night * pulse + 0.25, 0.16 + 0.32 * night * pulse + 0.08, 0.06);
    const one = (d, sink, dying) => {
      const s = figScale * (d.brute ? 1.55 : 1), B = body(d.x, d.y, d.fa, s, sink), sw = Math.sin(d.ph) * (dying ? 0 : 1), hit = st.t - d.hit < 0.08;
      add(D.torso, ni, local(B, 0, 1.08, 0, 0, 0.18, d.brute ? 1.3 : 1, 1, d.brute ? 1.25 : 1)); ni++;
      add(D.head, ni - 1, local(B, 0.17, 1.52, 0, 0, 0));
      for (const sd of [-1, 1]) { add(D.limb, nl++, local(B, 0.0, 0.8, sd * 0.1, 0, sw * 0.45 * sd, 1, 0.8, 1)); add(D.limb, nl++, local(B, 0.04, 1.24, sd * 0.24, -sd * 0.15, 1.35 + sw * 0.12 * sd, 1, 0.6, 1)); }
      for (let c = 0; c < (d.brute ? 3 : 2); c++) add(D.crack, nc++, local(B, -0.04 + c * 0.06, 1.385, (c - 0.5) * 0.12, 0, 0, 1, 1, 1));
      for (const sd of [-1, 1]) add(D.eye, ne++, local(B, 0.3, 1.55, sd * 0.05, 0, 0));
      if (hit) { /* a flash: the stone goes pale for a blink (shared colour, cheap) */ }
    };
    // (the head shares the torso's index: torso and head are one instance each)
    for (const d of dead) one(d, 0, false);
    for (const dd of deaths) { const kk = (st.t - dd.t0) / 0.9; one({ ...dd, ph: 0, hit: -9 }, kk * kk * 1.6, true); }
    D.torso.count = D.head.count = ni; D.limb.count = nl; D.crack.count = nc; D.eye.count = ne;
    for (const m of Object.values(D)) m.instanceMatrix.needsUpdate = true;
    // trees sway, the guns turn, Hilde's crane and beacons
    treeData.forEach((t, i) => { const g = Math.sin(st.t * 1.3 + t.ph + t.x * 0.1) * 0.12 + Math.sin(st.t * 0.4 + t.z * 0.05) * 0.18; crowns.setMatrixAt(i, M4(t.x + WD.x * g, t.h + t.r * 0.3, t.z + WD.y * g, 0, t.r, t.r * 0.85, t.r)); }); crowns.instanceMatrix.needsUpdate = true; trunks.instanceMatrix.needsUpdate = true;
    for (const T of turrets) { T.g.scale.setScalar(Math.max(1.3, figScale * 0.6)); T.head.rotation.y = -T.aim; T.flash.visible = st.t - T.shotT < 0.07; }
    boom.rotation.y = Math.sin(st.t * 0.35) * 0.25 + Math.PI * 0; gun.rotation.y = st.t * 0.6;
    const blink = night > 0.3 ? (Math.sin(st.t * 6) > 0 ? 1 : 0.15) : 0.35; beaconMat.color.setRGB(blink, 0.55 * blink + 0.1, 0.12);
  }

  // =========================================================================================
  // the glyph pass: solids become letters by their light; soft things stay as they are
  // =========================================================================================
  const RAMP = ' .,:-=+*%#@', NG = RAMP.length, atlas = document.createElement('canvas'); let atlasPx = 0;
  const tGlyph = new THREE.CanvasTexture(atlas); tGlyph.minFilter = tGlyph.magFilter = THREE.NearestFilter; tGlyph.generateMipmaps = false;
  function paintAtlas(px) { if (px === atlasPx) return; atlasPx = px; atlas.width = px * NG; atlas.height = px; const g = atlas.getContext('2d'); g.clearRect(0, 0, atlas.width, atlas.height); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(px * 1.05)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`; for (let i = 0; i < NG; i++) g.fillText(RAMP[i], i * px + px / 2, px * 0.55); tGlyph.image = atlas; tGlyph.needsUpdate = true; }
  let rtA = null;
  const CU = { tA: { value: null }, tGlyph: { value: tGlyph }, uRes: { value: new THREE.Vector2(1, 1) }, uCell: { value: 6 } };
  const comp = new THREE.ShaderMaterial({ uniforms: CU, depthTest: false, depthWrite: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tA, tGlyph; uniform vec2 uRes; uniform float uCell;
      void main(){
        vec2 cell = floor(gl_FragCoord.xy / uCell); vec4 C = texture2D(tA, (cell * uCell + uCell * 0.5) / uRes), P = texture2D(tA, vUv);
        vec3 col = P.rgb;
        if (C.a > 0.5) {
          float lum = clamp(dot(C.rgb, vec3(0.299, 0.587, 0.114)) * 1.35, 0.0, 0.999);
          vec2 g = fract(gl_FragCoord.xy / uCell); float gm = texture2D(tGlyph, vec2((floor(pow(lum, 0.6) * ${NG}.0) + g.x) / ${NG}.0, g.y)).a;
          vec3 tint = C.rgb / max(max(C.r, max(C.g, C.b)), 0.04);
          vec3 lit = mix(vec3(0.95, 0.93, 0.88), tint, 0.55) * (0.4 + 0.85 * lum);
          col = mix(tint * lum * 0.22, lit, gm);
        } else if (P.a > 0.5) col = P.rgb * 0.25;
        gl_FragColor = vec4(col, 1.0); }` });
  const cScene = new THREE.Scene(), cCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), cQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp); cQuad.frustumCulled = false; cScene.add(cQuad);

  // =========================================================================================
  // the camera: one curve from the map to Kai's eyes
  // =========================================================================================
  // [zoom, distance, pitch°, fov°, figure scale]
  const KEYS = [[0.0, 170, 90, 30, 2.0], [0.33, 40, 90, 34, 1.7], [0.52, 17, 60, 42, 1.35], [0.74, 5.6, 22, 58, 1.0], [0.9, 2.4, 12, 64, 1.0], [1.0, 0.0, 2, 72, 1.0]];
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function rigAt(z) { let i = 0; while (i < KEYS.length - 2 && z > KEYS[i + 1][0]) i++; const a = KEYS[i], b = KEYS[i + 1], t = ss(a[0], b[0], z); return { dist: a[1] + (b[1] - a[1]) * t, pitch: (a[2] + (b[2] - a[2]) * t) * Math.PI / 180, fov: a[3] + (b[3] - a[3]) * t, fig: a[4] + (b[4] - a[4]) * t }; }
  const look = { yaw: 0, pitch: 0 };
  let cssW = 0, cssH = 0, dpr = 1;
  function resize() { cssW = innerWidth; cssH = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2); renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false); const fd = Math.min(devicePixelRatio || 1, 2); fxc.width = Math.round(cssW * fd); fxc.height = Math.round(cssH * fd); fx.setTransform(fd, 0, 0, fd, 0, 0); camera.aspect = cssW / cssH; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  const camState = { x: 0, z: 0, yaw: 0 };
  function placeCamera(dt) {
    const z = st.z, R = rigAt(z), fpK = ss(0.86, 1.0, z), tilt = ss(0.42, 0.7, z);
    figScale = R.fig;
    camState.x += (X(kai.x) - camState.x) * Math.min(1, dt * 6); camState.z += (Z(kai.y) - camState.z) * Math.min(1, dt * 6);
    const yaw = look.yaw * tilt, pitch = Math.max(-0.5, Math.min(1.5707, R.pitch - look.pitch * ss(0.55, 0.9, z)));
    const ty = (z < 0.74 ? 1.2 * ss(0.45, 0.74, z) : 1.2 + 0.38 * ss(0.74, 1.0, z));
    const f = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const tgt = new THREE.Vector3(fpK > 0.5 ? X(kai.x) : camState.x, ty, fpK > 0.5 ? Z(kai.y) : camState.z);
    const tall = Math.max(1, Math.min(1.9, 0.62 / camera.aspect)) * (1 - ss(0.5, 0.76, z)) + ss(0.5, 0.76, z);   // a phone held upright sees little across: pull back from above
    camera.position.copy(tgt).addScaledVector(f, -R.dist * tall);
    if (fpK > 0.01) camera.position.addScaledVector(new THREE.Vector3(Math.cos(kai.face), 0, Math.sin(kai.face)), 0.12 * fpK);
    camera.position.y = Math.max(0.4, camera.position.y);
    camera.rotation.set(-pitch, yaw, 0); camera.fov = R.fov; camera.updateProjectionMatrix();
    // haze: the map is clear; down at the ground the ash closes in
    const hz = ss(0.45, 0.85, z), skyC = SKY.day.clone().lerp(SKY.night, st.night);
    scene.fog.color.copy(skyC); scene.fog.near = 400 + (16 - 400) * hz; scene.fog.far = 1200 + (95 - 1200) * hz; GU.uFogC.value.copy(skyC); GU.uFogN.value = scene.fog.near; GU.uFogF.value = scene.fog.far;
    renderer.setClearColor(skyC, 0);
    // the sun follows the focus so its shadows stay sharp where you look
    sun.position.set(camState.x - 22, 44, camState.z - 28); sun.target.position.set(camState.x, 0, camState.z); sun.intensity = 0.95 * (1 - 0.85 * st.night); hemi.intensity = 0.75 * (1 - 0.6 * st.night);
    lamp.position.set(X(kai.x), 1.8 * figScale * 0.6, Z(kai.y)); lamp.intensity = 1.6 * st.night;
    floodLight.intensity = 2.2 * st.night;
    GU.uFocus.value.set(camState.x, camState.z); GU.uCamH.value = Math.max(2, camera.position.y); GU.uTime.value = st.t; GU.uNight.value = st.night;
    return { yaw: look.yaw * tilt, R };
  }

  // =========================================================================================
  // input: pinch or the rail to zoom; drag on the left to walk; on the right to look (up close)
  // =========================================================================================
  const zoomEl = $('zoom'), setZ = z => { st.z = Math.max(0, Math.min(1, z)); zoomEl.value = Math.round(st.z * 1000); };
  zoomEl.addEventListener('input', () => { st.z = zoomEl.value / 1000; });
  $('zin').addEventListener('click', () => setZ(st.z + 0.08)); $('zout').addEventListener('click', () => setZ(st.z - 0.08));
  $('wave').addEventListener('click', wave);
  $('night').addEventListener('click', () => { st.nightOn = !st.nightOn; $('night').textContent = st.nightOn ? 'Day' : 'Night'; });
  const hint = $('hint'); let hintT = 9; $('hintBtn').addEventListener('click', () => { hintT = 8; hint.style.opacity = 1; });
  const stick = $('stick'), pts = new Map(); let pinch0 = 0, mover = null, looker = null;
  glc.addEventListener('pointerdown', e => { glc.setPointerCapture(e.pointerId); const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; pts.set(e.pointerId, p);
    if (pts.size === 2) { mover = looker = null; input.on = false; stick.hidden = true; const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); return; }
    if (e.clientX > cssW * 0.5 && st.z > 0.5) looker = e.pointerId; else { mover = e.pointerId; stick.hidden = false; stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.firstElementChild.style.transform = ''; } });
  glc.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) setZ(st.z + (d - pinch0) / 500); pinch0 = d; return; }
    if (e.pointerId === looker) { look.yaw -= dx * 0.006; look.pitch = Math.max(-0.6, Math.min(0.9, look.pitch + dy * 0.004)); return; }
    if (e.pointerId === mover) { const ox = e.clientX - p.x0, oy = e.clientY - p.y0, r = Math.hypot(ox, oy); if (r > 6) { const k = Math.min(1, r / 48); input.on = true; input.x = ox / r * k; input.y = oy / r * k; stick.firstElementChild.style.transform = `translate(${ox / r * Math.min(r, 32)}px, ${oy / r * Math.min(r, 32)}px)`; } } });
  const up = e => { pts.delete(e.pointerId); if (e.pointerId === mover) { mover = null; input.on = false; stick.hidden = true; } if (e.pointerId === looker) looker = null; if (pts.size < 2) pinch0 = 0; };
  glc.addEventListener('pointerup', up); glc.addEventListener('pointercancel', up);
  glc.addEventListener('wheel', e => { e.preventDefault(); setZ(st.z - e.deltaY * 0.0008); }, { passive: false });
  const keys = {}; addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === '+' || e.key === '=') setZ(st.z + 0.05); if (e.key === '-') setZ(st.z - 0.05); }); addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  function keyInput(dt) { const x = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), y = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0); if (keys.q) look.yaw += dt * 1.8; if (keys.e) look.yaw -= dt * 1.8;
    if (x || y) { const r = Math.hypot(x, y); input.on = true; input.x = x / r; input.y = y / r; input.key = true; } else if (input.key) { input.on = false; input.key = false; } }

  // =========================================================================================
  // the far map: each thing one letter on a plate, a fixed size on screen
  // =========================================================================================
  const v3 = new THREE.Vector3(), proj = (x, y, h = 1) => { v3.set(X(x), h, Z(y)).project(camera); return [(v3.x + 1) / 2 * cssW, (1 - v3.y) / 2 * cssH, v3.z < 1]; };
  function drawOverlay() {
    fx.clearRect(0, 0, cssW, cssH);
    const far = 1 - ss(0.12, 0.26, st.z); if (far < 0.01) return;
    const plate = (x, y, r, ring, ch, c, px) => { fx.fillStyle = 'rgba(10,11,13,.86)'; fx.beginPath(); fx.arc(x, y, r, 0, 7); fx.fill(); fx.strokeStyle = ring; fx.lineWidth = 2; fx.stroke(); fx.fillStyle = c; fx.font = `700 ${px}px "IBM Plex Mono", ui-monospace, monospace`; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(ch, x, y + 0.5); };
    fx.globalAlpha = far;
    for (const T of turrets) { const [x, y] = proj(T.x, T.y); plate(x, y, 10, st.t - T.shotT < 0.1 ? '#fff2c8' : '#f0b44c', 'T', '#f6e7c8', 13); }
    { const [x, y] = proj(rig.x, rig.y, 2); fx.font = '700 11px "IBM Plex Mono", ui-monospace, monospace'; const w = fx.measureText('HILDE').width + 16; fx.fillStyle = 'rgba(10,11,13,.86)'; fx.beginPath(); fx.roundRect(x - w / 2, y - 10, w, 20, 6); fx.fill(); fx.strokeStyle = '#f0b44c'; fx.lineWidth = 2; fx.stroke(); fx.fillStyle = '#f0b44c'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText('HILDE', x, y + 0.5); }
    fx.lineJoin = 'round';
    for (const d of dead) { const [x, y, ok] = proj(d.x, d.y); if (!ok || x < -20 || y < -20 || x > cssW + 20 || y > cssH + 20) continue; const px = d.brute ? 19 : 14; fx.font = `800 ${px}px "IBM Plex Mono", ui-monospace, monospace`; fx.strokeStyle = 'rgba(8,8,10,.9)'; fx.lineWidth = 4; fx.strokeText('&', x, y); fx.fillStyle = st.t - d.hit < 0.1 ? '#fff' : st.night > 0.5 ? '#ff7a2a' : '#e8553a'; fx.fillText('&', x, y); }
    { const [x, y] = proj(kai.x, kai.y); plate(x, y, 12, '#f0b44c', '@', '#ffd36a', 17); }
    fx.globalAlpha = 1;
  }

  // =========================================================================================
  // the loop
  // =========================================================================================
  const STAGES = [[0.2, 'Map'], [0.45, 'From above'], [0.66, 'Tilted'], [0.88, 'Third person'], [1.01, 'First person']];
  let last = performance.now(), stage = '';
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    keyInput(dt);
    const { yaw, R } = placeCamera(dt); step(dt, yaw); stepPress(dt);
    // what pushes the grass: Kai, then the nearest dead
    pushes[0].set(X(kai.x), Z(kai.y), 1.3 * Math.max(1, figScale * 0.6), 0); const nd = dead.slice().sort((a, b) => Math.hypot(a.x - kai.x, a.y - kai.y) - Math.hypot(b.x - kai.x, b.y - kai.y));
    for (let i = 1; i < NP; i++) { const d = nd[i - 1]; if (d) pushes[i].set(X(d.x), Z(d.y), 0.8 * Math.max(1, figScale * 0.6), 0); else pushes[i].set(1e5, 1e5, 0, 0); }
    drawFigures(R.dist);
    // the frame into a target, then the glyph pass to the screen
    const Wd = Math.round(cssW * dpr), Hd = Math.round(cssH * dpr);
    if (!rtA || rtA.width !== Wd || rtA.height !== Hd) { if (rtA) rtA.dispose(); rtA = new THREE.WebGLRenderTarget(Wd, Hd, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, depthBuffer: true }); }
    const cell = Math.max(3, Math.round((3.2 + 3.0 * ss(0.5, 1.0, st.z)) * dpr)); paintAtlas(cell);
    CU.tA.value = rtA.texture; CU.uRes.value.set(Wd, Hd); CU.uCell.value = cell; ashMat.uniforms.uPx.value = dpr;
    renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(cScene, cCam);
    drawOverlay();
    const s = STAGES.find(q => st.z < q[0])[1]; if (s !== stage) { stage = s; $('stage').textContent = s; }
    if (hintT > 0 && (hintT -= dt) <= 0) hint.style.opacity = 0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // for screenshots: run the scene ahead
  const goTo = (dx, dy) => { kai.x = camp.x + dx; kai.y = camp.y + dy; kai.vx = kai.vy = 0; camState.x = X(kai.x); camState.z = Z(kai.y); look.yaw = Math.atan2(dx, dy); kai.face = Math.atan2(-dy, -dx); };
  window.__zoom = { st, setZ, wave, kai, dead, look, goTo, blocked: (dx, dy) => blocked(camp.x + dx, camp.y + dy), run: sec => { for (let k = 0; k < sec * 30; k++) { step(1 / 30, 0); stepPress(1 / 30); } }, night: on => { st.nightOn = on; st.night = on ? 1 : 0; } };
}
