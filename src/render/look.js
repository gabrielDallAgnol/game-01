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
import { PAL } from './palette.js';

const L = K.lin;
export const PRESETS = {
  day: {
    bg: PAL.day.bg, hemiSky: PAL.day.hemiSky, hemiGnd: PAL.day.hemiGnd, hemi: 0.62, sun: PAL.day.sun, sunI: 2.35, sunDir: [-0.55, 1.0, 0.42],
    exposure: 0.86, vignette: 0.26, grain: 0.012, outline: 0.42, haze: 0.14, hazeCol: PAL.day.haze, tilt: 1.0,
    tint: 0.3, tdark: 0.85,
  },
  night: {
    bg: PAL.night.bg, hemiSky: PAL.night.hemiSky, hemiGnd: PAL.night.hemiGnd, hemi: 0.36, sun: '#7f9fd6', sunI: 0.62, sunDir: [0.5, 1.0, -0.2],
    exposure: 1.18, vignette: 0.5, grain: 0.02, outline: 0.22, haze: 0.22, hazeCol: PAL.night.haze, tilt: 1.0,
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
  { lift: [0.02, 0.022, 0.03], gamma: [1.0, 0.99, 1.0], gain: [1.03, 1.01, 0.98], sat: 1.05, pastel: 0.26, contrast: 1.08, shadowTint: [0.58, 0.58, 0.74], highTint: [1.0, 0.94, 0.8], split: 0.08 },
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
    hit: { value: 0 }, fade: { value: 0 }, outlineCol: { value: new THREE.Color(PAL.ink).convertSRGBToLinear().multiplyScalar(3.0) },
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

// ---------- the day: one continuous cycle ----------
// tod runs 0 → 1 over a whole day and night: 0 is sunrise, D (the day's share) is when dusk falls and the dead come,
// 1 is the next sunrise. Keys are placed in day time (d: 0 sunrise … 1 nightfall) or night time (n: 0 … 1 dawn), so the
// arc keeps its shape whatever the lengths are. Between keys every value eases (smoothstep): no snaps.
//   dark   0 day … 1 night: drives the presets, windows, light pools, bloom, fireflies
//   grade  the colour grade along dawn(0) → noon(1) → dusk(2) → night(3) → dawn(4)
//   keyI   the key light's strength (the sun, then the moon in the night; they hand over when both are faint)
//   tw     twilight: how much dawn peach / dusk mauve is in the air; warm: how orange the low sun is
export const SKY = [
  // at     dark  grade keyI  tw    warm
  ['d0.00', 0.24, 0.00, 0.80, 0.70, 0.8],    // sunrise: a low, peach sun through the mist
  ['d0.10', 0.06, 0.55, 1.70, 0.40, 0.6],    // morning
  ['d0.24', 0.00, 1.00, 2.35, 0.00, 0.1],    // the bright miniature day
  ['d0.60', 0.00, 1.00, 2.35, 0.00, 0.1],
  ['d0.78', 0.00, 1.22, 2.20, 0.12, 0.35],    // golden hour
  ['d0.90', 0.14, 1.62, 1.45, 0.55, 0.75],    // sunset
  ['d1.00', 0.46, 2.00, 0.55, 0.85, 1.0],    // dusk falls: the dead come
  ['n0.10', 0.82, 2.60, 0.12, 0.55, 1.0],    // blue hour: the sun hands the sky to the moon
  ['n0.24', 1.00, 3.00, 0.62, 0.00, 0.0],    // night: the moon climbs
  ['n0.84', 1.00, 3.00, 0.62, 0.00, 0.0],
  ['n0.93', 0.76, 3.40, 0.16, 0.50, 0.8],    // pre-dawn glow: the moon sets, the east goes lilac
  ['n1.00', 0.24, 4.00, 0.80, 0.70, 0.8],    // = sunrise
];
const SWAP = [0.10, 0.93];   // night time at which the key light becomes the moon, and the sun again
export const TWILIGHT = {
  dawn: { bg: PAL.dawn.bg, hemiSky: PAL.dawn.hemiSky, hazeCol: PAL.dawn.haze },
  dusk: { bg: PAL.dusk.bg, hemiSky: PAL.dusk.hemiSky, hazeCol: PAL.dusk.haze },
};
const smooth = x => x * x * (3 - 2 * x);
/** the sky at tod (0…1) for a day share D; pure, so tests and tools can read it */
export function skyAt(tod, D, out = {}) {
  tod = ((tod % 1) + 1) % 1; D = Math.min(0.95, Math.max(0.05, D));
  const at = key => (key[0] === 'd' ? D * +key.slice(1) : D + (1 - D) * +key.slice(1));
  let j = 0; while (j < SKY.length - 2 && at(SKY[j + 1][0]) <= tod) j++;
  const a = SKY[j], b = SKY[j + 1], ta = at(a[0]), tb = at(b[0]), f = smooth(tb > ta ? Math.min(1, Math.max(0, (tod - ta) / (tb - ta))) : 0);
  const v = k => a[k] + (b[k] - a[k]) * f;
  out.dark = v(1); out.grade = v(2) % 4; out.keyI = v(3); out.tw = v(4); out.warm = v(5);
  const day = tod < D, s = day ? tod / D : 0, q = day ? 0 : (tod - D) / (1 - D);
  out.day = day; out.s = s; out.q = q; out.side = (day ? s < 0.5 : q > 0.5) ? 'dawn' : 'dusk';
  // where the key light stands: the sun crosses east → west by day and sinks on after dusk; the moon crosses in the night
  out.moon = !day && q >= SWAP[0] && q < SWAP[1];
  if (out.moon) { const m = (q - 0.04) / 0.92; out.dx = -0.9 + 1.8 * m; out.dy = 0.42 + 0.62 * Math.sin(Math.PI * m); out.dz = -0.25; }
  else { const p = day ? s : q < SWAP[0] ? 1 + q * 0.6 : (q - 1) * 0.6;   // the sun's crossing, a little past either horizon
    const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, p))); out.dx = -0.95 + 1.9 * Math.min(1.1, Math.max(-0.1, p)); out.dy = 0.32 + 0.9 * arc; out.dz = 0.42; out.sunT = p; }
  return out;
}

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
  const c1 = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color(), v = new THREE.Vector3();
  const lc = (a, b, k) => c1.copy(L(a)).lerp(c2.copy(L(b)), k);
  const ln = (a, b, k) => a + (b - a) * k;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /** the whole look at one point of the cycle: tod 0 sunrise … D dusk falls … 1 the next sunrise (see SKY);
   *  bloodK 0…1 swaps the night for the blood moon. Everything is a smooth function of tod: no phase can snap it. */
  const sky = {};
  function cycle(tod, D, bloodK, target, span) {
    skyAt(tod, D, sky);
    const k = sky.dark, Dp = PRESETS.day, Nt = PRESETS.night, Bl = PRESETS.blood, side = sky.side;
    const nc = (key, out) => out.copy(L(Nt[key])).lerp(c2.copy(L(Bl[key])), bloodK);   // the night's colour, or the blood moon's
    const nn = key => ln(Nt[key], Bl[key], bloodK);
    const twc = (key, out) => out.lerp(c2.copy(L(TWILIGHT[side][key])), sky.tw);           // dawn peach / dusk mauve on the day colour
    const mix3 = (key, out) => { out.copy(L(Dp[key])); twc(key, out); return out.lerp(nc(key, c3), k); };
    mix3('bg', scene.background); scene.fog.color.copy(scene.background);
    mix3('hemiSky', hemi.color); hemi.groundColor.copy(L(Dp.hemiGnd)).lerp(nc('hemiGnd', c3), k);
    hemi.intensity = ln(Dp.hemi, nn('hemi'), k) * (1 - 0.12 * sky.tw);
    // the key light: the sun by day, the moon by night; they hand over in the blue hour and before dawn, when both are faint
    if (sky.moon) { nc('sun', sun.color); v.set(sky.dx, sky.dy, sky.dz); }
    else { sun.color.copy(L(Dp.sun)).lerp(c2.copy(L(side === 'dawn' ? '#ffd9bf' : '#ffa86e')), sky.warm); v.set(sky.dx, sky.dy, sky.dz); }
    sun.intensity = sky.keyI * (sky.moon ? nn('sunI') / Nt.sunI : 1);
    v.normalize(); sun.position.copy(target).addScaledVector(v, 70); sun.target.position.copy(target);
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix();
    const u = final.uniforms;
    u.exposure.value = ln(Dp.exposure, nn('exposure'), k); u.vignette.value = ln(Dp.vignette, nn('vignette'), k); u.grain.value = ln(Dp.grain, nn('grain'), k);
    u.outline.value = ln(Dp.outline, nn('outline'), k); u.haze.value = ln(Dp.haze, nn('haze'), k) + 0.06 * sky.tw; u.tilt.value = ln(Dp.tilt, nn('tilt'), k);
    mix3('hazeCol', u.hazeCol.value);
    // the grade walks one chain round the clock: dawn → noon → dusk → night (or blood) → dawn
    const g = sky.grade, i = Math.floor(g) % 4, f = g - Math.floor(g), row = j => (j === 3 ? (bloodK > 0.5 ? LUT.blood : LUT.night) : [LUT.dawn, LUT.noon, LUT.dusk][j]);
    if (f < 1e-3 && i === 3 && bloodK > 0.001 && bloodK < 0.999) { u.lutA.value = LUT.night; u.lutB.value = LUT.blood; u.lutMix.value = bloodK; }
    else { u.lutA.value = row(i); u.lutB.value = row((i + 1) % 4); u.lutMix.value = f; }
    fx.bloomK = sm(0.25, 0.85, k);
    K.T.amount.value = ln(Dp.tint, nn('tint'), k); K.T.dark.value = ln(Dp.tdark, nn('tdark'), k);
    return sky;
  }
  /** the old two-state entry point (k 0 day … 1 night, t the sun's crossing): maps onto the cycle */
  function blend(k, blood, target, span, t = 0.4) { const D = 0.58; return cycle(k >= 0.999 ? D + (1 - D) * 0.5 : D * Math.min(1, Math.max(0, t)), D, blood ? 1 : 0, target, span); }
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
  return { hemi, sun, blend, cycle, sky: () => sky, render, resize, setQuality, fx, quality: () => quality, init(nw, nh, q) { w = nw; h = nh; quality = q; build(); } };
}
