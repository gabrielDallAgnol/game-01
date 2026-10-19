// Light, atmosphere and post-processing: warm sun and cool fill by day, moon, fire and searchlight by night.
// Linear HDR → (SSAO) → (bloom) → grade (ACES, saturation, lift/gain, vignette, grain) → (FXAA).
// Quality: high = SSAO + bloom + FXAA, medium = bloom + FXAA, low = grade only.
/* global THREE */
import { K } from './kit.js';

const L = K.lin;
export const PRESETS = {
  day: {
    bg: '#b9b8b0', hemiSky: '#a9bdd0', hemiGnd: '#5a5246', hemi: 0.62, sun: '#ffe9cc', sunI: 2.6, sunDir: [-0.55, 1.0, 0.42],
    grade: { exposure: 0.95, saturation: 1.0, contrast: 1.1, lift: [0.008, 0.012, 0.02], gain: [1.02, 0.99, 0.95], vignette: 0.38, grain: 0.012 },
    bloom: { strength: 0.16, threshold: 0.95 }, tint: 0.8, tdark: 0.68,
  },
  night: {
    bg: '#0d131c', hemiSky: '#34507a', hemiGnd: '#0b0c0f', hemi: 0.3, sun: '#8fb0de', sunI: 0.42, sunDir: [0.5, 1.0, -0.2],
    grade: { exposure: 1.2, saturation: 0.84, contrast: 1.08, lift: [0.0, 0.012, 0.03], gain: [0.95, 1.0, 1.08], vignette: 0.5, grain: 0.018 },
    bloom: { strength: 1.0, threshold: 0.8 }, tint: 0.55, tdark: 0.8,
  },
  blood: {
    bg: '#1a0b0e', hemiSky: '#6a3238', hemiGnd: '#0f0708', hemi: 0.32, sun: '#ff8a7a', sunI: 0.48, sunDir: [0.5, 1.0, -0.2],
    grade: { exposure: 1.3, saturation: 0.9, contrast: 1.1, lift: [0.03, 0.0, 0.0], gain: [1.08, 0.95, 0.95], vignette: 0.55, grain: 0.02 },
    bloom: { strength: 1.1, threshold: 0.8 }, tint: 0.55, tdark: 0.78,
  },
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, exposure: { value: 1 }, saturation: { value: 1 }, contrast: { value: 1 },
    lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) }, vignette: { value: 0.4 }, grain: { value: 0.012 },
    resolution: { value: new THREE.Vector2(1, 1) }, time: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float exposure, saturation, contrast, vignette, grain, time; uniform vec3 lift, gain; uniform vec2 resolution;
    varying vec2 vUv;
    vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = aces(texture2D(tDiffuse, vUv).rgb * exposure);
      c = pow(c, vec3(1.0/2.2));
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c = c * gain + lift * (1.0 - c);
      vec2 d = vUv - 0.5; d.x *= resolution.x / resolution.y;
      c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(d));
      c += (hash(vUv * resolution + time) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createLook({ renderer, scene, camera, canvas }) {
  renderer.outputEncoding = THREE.LinearEncoding; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color(); scene.fog = new THREE.Fog(new THREE.Color(), 60, 160);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera; sc.near = 1; sc.far = 140;
  scene.add(hemi, sun, sun.target);

  let quality = 'high', composer = null, passes = {}, w = 1, h = 1;
  function build() {
    const ratio = quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : quality === 'medium' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    renderer.setPixelRatio(ratio);
    sun.shadow.mapSize.set(quality === 'low' ? 1024 : 2048, quality === 'low' ? 1024 : 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    const rt = new THREE.WebGLRenderTarget(w * ratio, h * ratio, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    composer = new THREE.EffectComposer(renderer, rt); composer.setPixelRatio(ratio); composer.setSize(w, h);
    passes = {};
    if (quality === 'high') {
      const ao = new THREE.SSAOPass(scene, camera, w, h); ao.kernelRadius = 0.5; ao.minDistance = 0.0006; ao.maxDistance = 0.02; composer.addPass(ao); passes.ao = ao;
    } else composer.addPass(new THREE.RenderPass(scene, camera));
    if (quality !== 'low') { passes.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.2, 0.55, 0.9); composer.addPass(passes.bloom); }
    passes.grade = new THREE.ShaderPass(GradeShader); composer.addPass(passes.grade);
    if (quality !== 'low') { passes.fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(passes.fxaa); }
    resize(w, h);
  }
  function resize(nw, nh) {
    w = nw; h = nh; if (!composer) return;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    if (passes.fxaa) passes.fxaa.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    passes.grade.uniforms.resolution.value.set(w * pr, h * pr);
  }

  // blend day ↔ night (or blood moon); k = 0 day, 1 night
  const c1 = new THREE.Color(), c2 = new THREE.Color(), v = new THREE.Vector3();
  const lc = (a, b, k) => c1.copy(L(a)).lerp(c2.copy(L(b)), k);
  const ln = (a, b, k) => a + (b - a) * k;
  // the sun crosses the sky by day (t: 0 morning → 1 dusk): low and warm at both ends, high and white at noon
  const warm = new THREE.Color(), dayDir = new THREE.Vector3();
  function blend(k, blood, target, span, t = 0.4) {
    const D = PRESETS.day, Nn = blood ? PRESETS.blood : PRESETS.night, arc = Math.sin(Math.PI * Math.min(1, Math.max(0, t))), edge = 1 - arc;
    dayDir.set(-0.95 + 1.9 * t, 0.28 + 0.9 * arc, 0.42);
    scene.background.copy(lc(D.bg, Nn.bg, k)); scene.fog.color.copy(scene.background);
    hemi.color.copy(lc(D.hemiSky, Nn.hemiSky, k)); hemi.groundColor.copy(lc(D.hemiGnd, Nn.hemiGnd, k)); hemi.intensity = ln(D.hemi, Nn.hemi, k);
    warm.copy(L(D.sun)).lerp(c2.copy(L(t > 0.5 ? '#ff9a58' : '#ffc890')), Math.pow(edge, 1.6));
    sun.color.copy(warm).lerp(c2.copy(L(Nn.sun)), k); sun.intensity = ln(D.sunI * (0.62 + 0.38 * arc), Nn.sunI, k);
    v.set(ln(dayDir.x, Nn.sunDir[0], k), ln(dayDir.y, Nn.sunDir[1], k), ln(dayDir.z, Nn.sunDir[2], k)).normalize();
    sun.position.copy(target).addScaledVector(v, 70); sun.target.position.copy(target);
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix();
    const g = passes.grade.uniforms, a = D.grade, b = Nn.grade;
    g.exposure.value = ln(a.exposure, b.exposure, k); g.saturation.value = ln(a.saturation, b.saturation, k); g.contrast.value = ln(a.contrast, b.contrast, k);
    g.vignette.value = ln(a.vignette, b.vignette, k); g.grain.value = ln(a.grain, b.grain, k);
    g.lift.value.set(ln(a.lift[0], b.lift[0], k), ln(a.lift[1], b.lift[1], k), ln(a.lift[2], b.lift[2], k));
    g.gain.value.set(ln(a.gain[0], b.gain[0], k), ln(a.gain[1], b.gain[1], k), ln(a.gain[2], b.gain[2], k));
    if (passes.bloom) { passes.bloom.strength = ln(D.bloom.strength, Nn.bloom.strength, k); passes.bloom.threshold = ln(D.bloom.threshold, Nn.bloom.threshold, k); }
    K.T.amount.value = ln(D.tint, Nn.tint, k); K.T.dark.value = ln(D.tdark, Nn.tdark, k);
  }
  function render(time) { passes.grade.uniforms.time.value = time % 10; composer.render(); }
  function setQuality(q) { if (q === quality && composer) return; quality = q; build(); }
  return { hemi, sun, blend, render, resize, setQuality, quality: () => quality, init(nw, nh, q) { w = nw; h = nh; quality = q; build(); } };
}
