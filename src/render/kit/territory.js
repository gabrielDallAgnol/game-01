// Hollowmere city kit · The world-space hook every lit material shares: the territory / fog-of-war mask and the territory() shader patch.
/* global THREE */
import { lin } from './palette.js';
// [top]

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
  mist: { value: new THREE.Vector4(0.8, 0.8, 0.85, 0) }, time: { value: 0 }, ao: { value: 0.72 },
  fogCol: { value: lin('#16223a') }, cyan: { value: lin('#5fd3ff') }, front: { value: 1 }, scan: { value: new THREE.Vector4(0, 0, 0, 0) },
  sway: { value: 1 }, night: { value: 0 },
  flat: { value: new THREE.Color(1, 1, 1) },   // [top] the flat path's light: day white, night navy (view/topflat.js)
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
  const defs = [o.emit && 'T_EMIT', o.rim && 'T_RIM', o.flash && 'T_FLASH', o.ground && 'T_GROUND', o.sway && 'T_SWAY', o.fog === false && 'T_NOFOG', 'T_FLAT'].filter(Boolean);   // [top] T_FLAT
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tMask: T.mask, tOff: T.off, tAmount: T.amount, tDark: T.dark, tLight: T.light, tLightO: T.lightO, tLightS: T.lightS, tLightK: T.lightK,
      tEmitK: T.emitK, tEmitCol: T.emitCol, tRim: T.rim, tMist: T.mist, tTime: T.time, tAO: T.ao, tFogCol: T.fogCol, tCyan: T.cyan, tFront: T.front, tScan: T.scan, tSway: T.sway, tNight: T.night, tFlat: T.flat }, o.uniforms || {});
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
#ifdef T_FLAT
uniform vec3 tFlat;
#endif
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
#if defined(T_FLAT) && defined(STANDARD)
// [top] flat colour: the material's own colour under one light (no sun, no shading), a hint of slope so cones read
gl_FragColor.rgb = diffuseColor.rgb * tFlat * (0.8 + 0.2 * clamp(dot(normal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), 0.0, 1.0)) + totalEmissiveRadiance;
#endif
vec4 tM = texture2D(tMask, (vTWorld.xz + tOff) / 512.0);
float tLow = 1.0 - smoothstep(0.02, 0.7, vTWorld.y);
gl_FragColor.rgb *= mix(1.0, 0.25 + 0.75 * tM.a, tLow * tAO);
float own = tM.r, wild = (1.0 - smoothstep(0.25, 0.75, own)) * tAmount;
vec3 c = gl_FragColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
gl_FragColor.rgb = mix(c, mix(vec3(l), c, 0.55) * vec3(0.92, 0.97, 1.06) * tDark, wild);
float tPool = 0.0;
#ifdef STANDARD
if (tLightK > 0.001) {
  vec2 lUv = (vTWorld.xz - tLightO) / tLightS; lUv.y = 1.0 - lUv.y;
  vec2 eg = smoothstep(0.0, 0.08, lUv) * smoothstep(1.0, 0.92, lUv);
  vec3 lp = texture2D(tLight, lUv).rgb * (tLightK * eg.x * eg.y);
  float up = dot(normal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  gl_FragColor.rgb += diffuseColor.rgb * lp * exp(-max(vTWorld.y, 0.0) * 0.32) * (0.5 + 0.5 * max(up, 0.0));
  tPool = dot(lp, vec3(0.33));
}
#endif
#ifdef T_EMIT
gl_FragColor.rgb += tEmitCol * vEmit * tEmitK;
#endif
#ifdef T_RIM
float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
#ifdef T_FLASH
// the dead beyond the light: no moon rim, so only their eyes show until they step into a pool of light
rim *= mix(1.0, clamp(tPool * 2.5, 0.05, 1.0), tNight);
gl_FragColor.rgb *= mix(1.0, 0.45 + 0.55 * clamp(tPool * 3.0, 0.0, 1.0), tNight * 0.8);
#endif
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

export { T, setFootprints, setMaskArrays, setMask, territory };
