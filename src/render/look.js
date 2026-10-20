// Light, atmosphere and post-processing for the lantern-lit diorama.
// Day: a bright, high-key miniature (warm sun, pastel-earthy colour). Night: a cold navy world where the only
// warm values are fires, lit windows and the hero's lantern.
//
// One scene render into a half-float target with depth, then (at night only) three half-res bloom levels, then ONE
// combined pass: FXAA → depth-edge outlines → haze → subtle tilt-shift → bloom → exposure/ACES → colour-grade LUT
// (two of five per-time-of-day LUTs, generated here at load as 256×16 strips) → vignette, hit pulse and grain.
// Quality: high = full pass at DPR 2, medium = full pass at DPR 1.5, low = grade + vignette only at DPR 1, no bloom.
/* global THREE */
import { K } from './kit.js';

const L = K.lin;
export const PRESETS = {
  day: {
    bg: '#b9c2b6', hemiSky: '#b8cde0', hemiGnd: '#6a5a44', hemi: 0.62, sun: '#fff0d8', sunI: 2.35, sunDir: [-0.55, 1.0, 0.42],
    exposure: 0.86, vignette: 0.26, grain: 0.012, outline: 0.42, haze: 0.14, hazeCol: '#cfd6cc', tilt: 1.0,
    tint: 0.3, tdark: 0.85,
  },
  night: {
    bg: '#0a1222', hemiSky: '#34508a', hemiGnd: '#0a0c12', hemi: 0.36, sun: '#7f9fd6', sunI: 0.62, sunDir: [0.5, 1.0, -0.2],
    exposure: 1.18, vignette: 0.5, grain: 0.02, outline: 0.22, haze: 0.22, hazeCol: '#0f1a30', tilt: 1.0,
    tint: 0.4, tdark: 0.85,
  },
  blood: {
    bg: '#1a0a10', hemiSky: '#5a2a3c', hemiGnd: '#100608', hemi: 0.3, sun: '#e0706a', sunI: 0.5, sunDir: [0.5, 1.0, -0.2],
    exposure: 1.05, vignette: 0.6, grain: 0.022, outline: 0.25, haze: 0.26, hazeCol: '#260c14', tilt: 1.0,
    tint: 0.4, tdark: 0.82,
  },
};

// ---------- colour-grade LUTs ----------
// Each LUT is a 16×16×16 cube laid out as a 256×16 strip (blue picks the 16×16 slice). Input and output are
// display-referred (after ACES and gamma). Five grades share one 256×80 texture: dawn, noon, dusk, night, blood.
export const LUT = { dawn: 0, noon: 1, dusk: 2, night: 3, blood: 4 };
const GRADES = [
  // dawn: lilac shadows, peach-gold light, soft
  { lift: [0.035, 0.02, 0.05], gamma: [1.0, 1.02, 1.0], gain: [1.04, 0.98, 0.93], sat: 0.95, pastel: 0.22, contrast: 0.96, shadowTint: [0.62, 0.55, 0.82], highTint: [1.0, 0.86, 0.72], split: 0.14 },
  // noon: high-key miniature — lifted shadows, gentle contrast, saturated but pastel (the strongest colours compress)
  { lift: [0.02, 0.022, 0.03], gamma: [1.0, 0.99, 1.0], gain: [1.03, 1.01, 0.99], sat: 1.0, pastel: 0.3, contrast: 1.08, shadowTint: [0.55, 0.62, 0.72], highTint: [1.0, 0.96, 0.88], split: 0.08 },
  // dusk: amber light, plum-blue shadows
  { lift: [0.02, 0.0, 0.04], gamma: [1.0, 1.04, 1.06], gain: [1.08, 0.95, 0.84], sat: 1.04, pastel: 0.18, contrast: 1.06, shadowTint: [0.5, 0.42, 0.75], highTint: [1.0, 0.78, 0.55], split: 0.2 },
  // night: navy world; warm hues (fire, windows, the lantern) keep their colour and lift, everything else goes cold and quiet
  { lift: [0.012, 0.022, 0.05], gamma: [1.06, 1.02, 0.96], gain: [0.86, 0.94, 1.06], sat: 0.62, pastel: 0.0, contrast: 1.08, shadowTint: [0.2, 0.32, 0.62], highTint: [0.8, 0.9, 1.0], split: 0.3, keepWarm: 1.0, keepGreen: 0.9, keepCyan: 0.9, keepRed: 0.9 },
  // blood moon: maroon shadows, red cast; fire and rot-green still read
  { lift: [0.022, 0.004, 0.012], gamma: [1.04, 1.1, 1.06], gain: [0.98, 0.8, 0.82], sat: 0.65, pastel: 0.0, contrast: 1.1, shadowTint: [0.62, 0.16, 0.22], highTint: [1.0, 0.7, 0.66], split: 0.32, keepWarm: 1.0, keepGreen: 0.8, keepCyan: 0.6, keepRed: 1.0 },
];
function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-5) return 0;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h;
}
const near = (h, c, w) => { let d = Math.abs(h - c); if (d > 180) d = 360 - d; return Math.max(0, 1 - d / w); };
function gradeTexel(G, r, g, b, out) {
  const l0 = 0.2126 * r + 0.7152 * g + 0.0722 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), s0 = mx > 1e-4 ? (mx - mn) / mx : 0, h = hueOf(r, g, b);
  // hue-selective protection: how much of the original pixel survives the grade (warm light at night, eyes, the System)
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const vivid = ss(0.55, 0.85, s0) * ss(0.35, 0.7, mx);   // only bright, saturated light: eyes, hives, the System's cyan
  const warm = near(h, 32, 36) * ss(0.25, 0.6, s0) * ss(0.12, 0.45, mx), green = near(h, 88, 26) * vivid, cyan = near(h, 197, 24) * vivid, red = near(h, 6, 16) * vivid;
  const keep = Math.min(1, (G.keepWarm || 0) * warm + (G.keepGreen || 0) * green + (G.keepCyan || 0) * cyan + (G.keepRed || 0) * red);
  let c = [r, g, b];
  // saturation, with the most saturated colours compressed toward pastel
  const sat = G.sat * (1 - G.pastel * s0 * s0);
  c = c.map(v => l0 + (v - l0) * sat);
  // split toning: tint shadows and highlights
  const ls = Math.pow(Math.max(0, 1 - l0 * 1.6), 1.5), lh = Math.max(0, l0 * 1.6 - 0.6);
  const lumOf = t => 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  const sT = G.shadowTint.map(v => v / lumOf(G.shadowTint)), hT = G.highTint.map(v => v / lumOf(G.highTint));
  c = c.map((v, k) => v * (1 + G.split * ls * (sT[k] - 1)) * (1 + G.split * 0.7 * lh * (hT[k] - 1)));
  // contrast around mid grey, lift / gamma / gain
  c = c.map((v, k) => { v = (v - 0.5) * G.contrast + 0.5; v = Math.max(0, v); v = Math.pow(v, G.gamma[k]); return v * G.gain[k] + G.lift[k] * (1 - v); });
  for (let k = 0; k < 3; k++) { const o = [r, g, b][k] * 1.04; out[k] = Math.min(1, Math.max(0, c[k] * (1 - keep) + o * keep)); }
}
function makeLUTs() {
  const W = 256, H = 16 * GRADES.length, data = new Uint8Array(W * H * 4), o = [0, 0, 0];
  GRADES.forEach((G, row) => {
    for (let bz = 0; bz < 16; bz++) for (let gy = 0; gy < 16; gy++) for (let rx = 0; rx < 16; rx++) {
      gradeTexel(G, rx / 15, gy / 15, bz / 15, o);
      const k = ((row * 16 + gy) * W + bz * 16 + rx) * 4;
      data[k] = Math.round(o[0] * 255); data[k + 1] = Math.round(o[1] * 255); data[k + 2] = Math.round(o[2] * 255); data[k + 3] = 255;
    }
  });
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// bloom: a 13-tap downsample (the first level also thresholds); three levels at 1/2, 1/4 and 1/8
const DownShader = (first) => ({
  uniforms: { tIn: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1.0 } },
  vertexShader: VERT,
  fragmentShader: `uniform sampler2D tIn; uniform vec2 texel; uniform float threshold; varying vec2 vUv;
    vec3 s(vec2 o){ return texture2D(tIn, vUv + o * texel).rgb; }
    void main(){
      vec3 a = s(vec2(-1.0,-1.0)) + s(vec2(1.0,-1.0)) + s(vec2(-1.0,1.0)) + s(vec2(1.0,1.0));
      vec3 b = s(vec2(-2.0,0.0)) + s(vec2(2.0,0.0)) + s(vec2(0.0,-2.0)) + s(vec2(0.0,2.0));
      vec3 c = s(vec2(-2.0,-2.0)) + s(vec2(2.0,-2.0)) + s(vec2(-2.0,2.0)) + s(vec2(2.0,2.0));
      vec3 col = s(vec2(0.0)) * 0.125 + a * 0.125 + b * 0.0625 + c * 0.03125;
      ${first ? 'float br = max(col.r, max(col.g, col.b)); col *= max(0.0, br - threshold) / max(br, 1e-4); col = min(col, vec3(24.0));' : ''}
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const FinalShader = q => ({
  defines: { QUALITY: q },
  uniforms: {
    tScene: { value: null }, tDepth: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tLUT: { value: null },
    lutA: { value: 1 }, lutB: { value: 1 }, lutMix: { value: 0 }, bloom: { value: 0 },
    exposure: { value: 1 }, vignette: { value: 0.3 }, grain: { value: 0.012 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
    near: { value: 0.5 }, far: { value: 300 }, outline: { value: 0.4 }, haze: { value: 0.2 }, hazeCol: { value: new THREE.Color() }, focus: { value: 30 }, tilt: { value: 1 },
    hit: { value: 0 }, fade: { value: 0 }, outlineCol: { value: new THREE.Color(0.05, 0.04, 0.06) },
  },
  vertexShader: VERT,
  fragmentShader: `
    uniform sampler2D tScene, tDepth, tB0, tB1, tB2, tLUT;
    uniform float lutA, lutB, lutMix, bloom, exposure, vignette, grain, time, near, far, outline, haze, focus, tilt, hit, fade;
    uniform vec2 res; uniform vec3 hazeCol, outlineCol;
    varying vec2 vUv;
    float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
    float D(vec2 uv){ return lin(texture2D(tDepth, uv).x); }
    float luma(vec3 c){ return sqrt(dot(c, vec3(0.299, 0.587, 0.114))); }
    vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
    vec3 lut(vec3 c, float row){
      c = clamp(c, 0.0, 1.0); float bz = c.b * 15.0, s0 = floor(bz), s1 = min(s0 + 1.0, 15.0), f = bz - s0;
      float y = (row * 16.0 + c.g * 15.0 + 0.5) / ${(16 * GRADES.length).toFixed(1)};
      vec3 a = texture2D(tLUT, vec2((s0 * 16.0 + c.r * 15.0 + 0.5) / 256.0, y)).rgb;
      vec3 b = texture2D(tLUT, vec2((s1 * 16.0 + c.r * 15.0 + 0.5) / 256.0, y)).rgb;
      return mix(a, b, f);
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec3 bl(sampler2D t, vec2 uv, vec2 px){ return (texture2D(t, uv + vec2(-px.x, -px.y)).rgb + texture2D(t, uv + vec2(px.x, -px.y)).rgb + texture2D(t, uv + vec2(-px.x, px.y)).rgb + texture2D(t, uv + vec2(px.x, px.y)).rgb) * 0.25; }
    void main(){
      vec2 px = 1.0 / res;
      vec3 c = texture2D(tScene, vUv).rgb;
      float dc = D(vUv);
    #if QUALITY > 0
      // FXAA (lite): blend along the local edge where luma contrast is high
      vec3 cN = texture2D(tScene, vUv + vec2(0.0, px.y)).rgb, cS = texture2D(tScene, vUv - vec2(0.0, px.y)).rgb;
      vec3 cE = texture2D(tScene, vUv + vec2(px.x, 0.0)).rgb, cW = texture2D(tScene, vUv - vec2(px.x, 0.0)).rgb;
      float lM = luma(c), lN = luma(cN), lS = luma(cS), lE = luma(cE), lW = luma(cW);
      float lMin = min(lM, min(min(lN, lS), min(lE, lW))), lMax = max(lM, max(max(lN, lS), max(lE, lW))), range = lMax - lMin;
      if (range > max(0.04, lMax * 0.12)) {
        vec2 dir = vec2(-((lN + lS) - (lE + lW)), (lE + lW) - (lN + lS));
        float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + max((lN + lS + lE + lW) * 0.03, 0.002));
        dir = clamp(dir * rcp, -4.0, 4.0) * px;
        vec3 a = 0.5 * (texture2D(tScene, vUv + dir * (1.0/3.0 - 0.5)).rgb + texture2D(tScene, vUv + dir * (2.0/3.0 - 0.5)).rgb);
        vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, vUv - dir * 0.5).rgb + texture2D(tScene, vUv + dir * 0.5).rgb);
        float lb = luma(b); c = (lb < lMin || lb > lMax) ? a : b;
      }
      // tilt-shift: the miniature look — a soft blur toward the top and bottom of the frame
      float tb = tilt * smoothstep(0.26, 0.5, abs(vUv.y - 0.47)) * 2.2;
      if (tb > 0.05) {
        vec3 acc = c; vec2 r = px * tb;
        acc += texture2D(tScene, vUv + vec2( 1.0, 0.4) * r).rgb + texture2D(tScene, vUv + vec2(-1.0,-0.4) * r).rgb;
        acc += texture2D(tScene, vUv + vec2(-0.4, 1.0) * r).rgb + texture2D(tScene, vUv + vec2( 0.4,-1.0) * r).rgb;
        acc += texture2D(tScene, vUv + vec2( 1.4,-1.1) * r).rgb + texture2D(tScene, vUv + vec2(-1.4, 1.1) * r).rgb;
        c = acc / 7.0;
      }
      // depth-edge outlines: a thin ink line where something nearer stands in front of something farther
      float dN = D(vUv + vec2(0.0, px.y)), dS = D(vUv - vec2(0.0, px.y)), dE = D(vUv + vec2(px.x, 0.0)), dW = D(vUv - vec2(px.x, 0.0));
      float e = (max(max(dN, dS), max(dE, dW)) - dc) / dc;
      float edge = smoothstep(0.035, 0.11, e) * step(dc, far * 0.9);
      c = mix(c, c * outlineCol * 4.0, edge * outline);
      // haze: the far ground softens toward the air colour (aerial perspective)
      c = mix(c, hazeCol, haze * smoothstep(focus * 0.85, focus * 2.4, dc));
      // bloom (night only)
      if (bloom > 0.001) c += (bl(tB0, vUv, px * 2.0) * 0.55 + bl(tB1, vUv, px * 4.0) * 0.8 + bl(tB2, vUv, px * 8.0) * 1.1) * bloom;
    #endif
      c = aces(c * exposure);
      c = pow(c, vec3(1.0 / 2.2));
      c = mix(lut(c, lutA), lut(c, lutB), lutMix);
      vec2 d = vUv - 0.5; d.x *= res.x / res.y; float r = length(d);
      c *= 1.0 - vignette * smoothstep(0.32, 1.0, r);
      // taking a hit: a red pulse from the edges
      c = mix(c, vec3(0.88, 0.31, 0.23) * (0.5 + 0.5 * c), hit * smoothstep(0.25, 0.85, r) * 0.85);
      c = mix(c, vec3(0.0), fade);
      c += (hash(vUv * res + time) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
});

export function createLook({ renderer, scene, camera, canvas }) {
  renderer.outputEncoding = THREE.LinearEncoding; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color(); scene.fog = new THREE.Fog(new THREE.Color(), 60, 160);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025;
  const sc = sun.shadow.camera; sc.near = 1; sc.far = 140;
  scene.add(hemi, sun, sun.target);

  const lutTex = makeLUTs();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let quality = 'high', w = 1, h = 1, rt = null, bl = [], final = null, downs = [], built = false;
  const fx = { hit: 0, fade: 0, bloomK: 0 };
  const mk = (sw, sh, depth) => {
    const t = new THREE.WebGLRenderTarget(Math.max(1, sw), Math.max(1, sh), { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth, stencilBuffer: false });
    if (depth) { t.depthTexture = new THREE.DepthTexture(Math.max(1, sw), Math.max(1, sh)); t.depthTexture.type = THREE.UnsignedIntType; }
    return t;
  };
  function build() {
    const dpr = window.devicePixelRatio || 1, ratio = quality === 'high' ? Math.min(dpr, 2) : quality === 'medium' ? Math.min(dpr, 1.5) : 1;
    renderer.setPixelRatio(ratio);
    sun.shadow.mapSize.set(quality === 'low' ? 1024 : 2048, quality === 'low' ? 1024 : 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.shadowMap.type = quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (rt) { rt.dispose(); bl.forEach(t => t.dispose()); }
    const q = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
    final = new THREE.ShaderMaterial(FinalShader(q)); final.depthTest = final.depthWrite = false;
    final.uniforms.tLUT.value = lutTex;
    downs = [new THREE.ShaderMaterial(DownShader(true)), new THREE.ShaderMaterial(DownShader(false)), new THREE.ShaderMaterial(DownShader(false))];
    built = true; resize(w, h);
  }
  function resize(nw, nh) {
    w = nw; h = nh; if (!built) return;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio(), W = Math.round(w * pr), H = Math.round(h * pr);
    if (rt) { rt.dispose(); bl.forEach(t => t.dispose()); }
    rt = mk(W, H, true);
    bl = [mk(W >> 1, H >> 1), mk(W >> 2, H >> 2), mk(W >> 3, H >> 3)];
    final.uniforms.res.value.set(W, H);
    final.uniforms.tScene.value = rt.texture; final.uniforms.tDepth.value = rt.depthTexture;
    final.uniforms.tB0.value = bl[0].texture; final.uniforms.tB1.value = bl[1].texture; final.uniforms.tB2.value = bl[2].texture;
    downs[0].uniforms.tIn.value = rt.texture; downs[1].uniforms.tIn.value = bl[0].texture; downs[2].uniforms.tIn.value = bl[1].texture;
    downs[0].uniforms.texel.value.set(1 / W, 1 / H); downs[1].uniforms.texel.value.set(2 / W, 2 / H); downs[2].uniforms.texel.value.set(4 / W, 4 / H);
  }

  // ---------- time of day ----------
  const c1 = new THREE.Color(), c2 = new THREE.Color(), v = new THREE.Vector3();
  const lc = (a, b, k) => c1.copy(L(a)).lerp(c2.copy(L(b)), k);
  const ln = (a, b, k) => a + (b - a) * k;
  const warm = new THREE.Color(), dayDir = new THREE.Vector3(), hz = new THREE.Color();
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /** blend the light: k 0 day … 1 night (or blood moon); t is the sun's crossing (0 morning … 1 dusk) */
  function blend(k, blood, target, span, t = 0.4) {
    const D = PRESETS.day, Nn = blood ? PRESETS.blood : PRESETS.night, arc = Math.sin(Math.PI * Math.min(1, Math.max(0, t))), edge = 1 - arc;
    dayDir.set(-0.95 + 1.9 * t, 0.5 + 0.75 * arc, 0.42);
    scene.background.copy(lc(D.bg, Nn.bg, k)); scene.fog.color.copy(scene.background);
    hemi.color.copy(lc(D.hemiSky, Nn.hemiSky, k)); hemi.groundColor.copy(lc(D.hemiGnd, Nn.hemiGnd, k)); hemi.intensity = ln(D.hemi, Nn.hemi, k);
    warm.copy(L(D.sun)).lerp(c2.copy(L(t > 0.5 ? '#ffb078' : '#ffdcc0')), Math.pow(edge, 2.2));
    sun.color.copy(warm).lerp(c2.copy(L(Nn.sun)), k); sun.intensity = ln(D.sunI * (0.7 + 0.3 * arc), Nn.sunI, k);
    v.set(ln(dayDir.x, Nn.sunDir[0], k), ln(dayDir.y, Nn.sunDir[1], k), ln(dayDir.z, Nn.sunDir[2], k)).normalize();
    sun.position.copy(target).addScaledVector(v, 70); sun.target.position.copy(target);
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix();
    const u = final.uniforms;
    u.exposure.value = ln(D.exposure, Nn.exposure, k); u.vignette.value = ln(D.vignette, Nn.vignette, k); u.grain.value = ln(D.grain, Nn.grain, k);
    u.outline.value = ln(D.outline, Nn.outline, k); u.haze.value = ln(D.haze, Nn.haze, k); u.tilt.value = ln(D.tilt, Nn.tilt, k);
    u.hazeCol.value.copy(hz.copy(L(D.hazeCol)).lerp(c2.copy(L(Nn.hazeCol)), k));
    // LUTs: dawn → noon → dusk across the day, then toward night / blood moon with the dark
    const dawnK = 1 - sm(0.0, 0.2, t), duskK = sm(0.62, 0.95, t);
    let a = LUT.noon, b = LUT.noon, m = 0;
    if (dawnK > 0) { a = LUT.dawn; b = LUT.noon; m = 1 - dawnK; } else if (duskK > 0) { a = LUT.noon; b = LUT.dusk; m = duskK; }
    if (k > 0.002) { a = m > 0.5 ? b : a; b = blood ? LUT.blood : LUT.night; m = k; }
    u.lutA.value = a; u.lutB.value = b; u.lutMix.value = m;
    fx.bloomK = sm(0.25, 0.85, k);
    K.T.amount.value = ln(D.tint, Nn.tint, k); K.T.dark.value = ln(D.tdark, Nn.tdark, k);
  }
  function blit(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); }
  function render(time) {
    const u = final.uniforms;
    u.time.value = time % 10; u.hit.value = fx.hit; u.fade.value = fx.fade;
    u.near.value = camera.near; u.far.value = camera.far; u.focus.value = camera.position.distanceTo(sun.target.position);
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    const bloomOn = quality !== 'low' && fx.bloomK > 0.01;
    u.bloom.value = bloomOn ? 0.55 * fx.bloomK : 0;
    if (bloomOn) { downs[0].uniforms.threshold.value = 0.85; blit(downs[0], bl[0]); blit(downs[1], bl[1]); blit(downs[2], bl[2]); }
    blit(final, null);
  }
  function setQuality(q) { if (q === quality && built) return; quality = q; build(); }
  return { hemi, sun, blend, render, resize, setQuality, fx, quality: () => quality, init(nw, nh, q) { w = nw; h = nh; quality = q; build(); } };
}
