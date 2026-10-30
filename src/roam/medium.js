// [roam] One medium, the game's renderer (from the Looks Lab): everything solid is drawn in glyphs, everything soft in strokes, so Kai, the Ash-Born, Hilde,
// the guns and the roofs come out of one renderer and read as one world.
//   · Solids are built from simple 3D volumes (spheres, capsules, rounded boxes) as a height field seen from straight
//     above. Each frame a low-res pass evaluates them once per screen cell: height, the lit value under one sun (north-
//     west, high), the material, and its glow. The composite turns each cell into a glyph from a light ramp
//     (' .,:-=+*%#@'): shadow is empty black, light is dense letters, the colour sits inside the letters.
//   · Roofs use the same cells and ramp. The ground stays the Overgrown stroke field (grass, trees, hard streets).
//   · Soft things are strokes on the 2D layer: Kai's bandana tails and tied sleeves, shed ash, embers, sparkles.
// Lab code: it reads the lab's little scene and draws it; nothing here reaches the game yet.
/* global THREE */
import { MACHINES } from '../play/machines.js';
import { M, MATCOL } from './dress/mats.js';
import { gardenLook } from './garden-look.js';
import { landLook } from './world/land.js';

export const MAXP = 1024;          // volumes a frame (the dead off screen are left out)
const RAMP = ' .,:-=+*%#@';
const NG = RAMP.length;
export const FIGM = 2.6;
export const CELLW = 0.15;        // a glyph cell's size in the world (m): 5 px at the default zoom on a phone          // figures are drawn bigger than life, as in the game (Thronefall-style)
// materials (the composite's palette): ids are stored in the cell pass as id / 32
// the materials (the composite's palette) are shared with the city's atoms: src/roam/dress/mats.js

export function createMedium(o) {
  const { renderer, U, mat, VERT, quadGeo, quadCam, ASH3F } = o;
  // ---------- the volumes: three texels each, in a float texture ----------
  const data = new Float32Array(3 * MAXP * 4);
  const tPrim = new THREE.DataTexture(data, 3, MAXP, THREE.RGBAFormat, THREE.FloatType); tPrim.minFilter = tPrim.magFilter = THREE.NearestFilter; tPrim.generateMipmaps = false; tPrim.needsUpdate = true;
  let n = 0;
  const put = (ty, x, y, z, b0, b1, b2, b3, rot, m, em, reach) => { if (n >= MAXP) return; const i = n * 12; data.set([ty, x, y, z, b0, b1, b2, b3, rot, m, em, reach], i); n++; };
  const sphere = (x, y, z, r, m, em = 0) => put(0, x, y, z, 0, 0, 0, r, 0, m, em, r + 0.2);
  const capsule = (x0, y0, z0, x1, y1, z1, r, m, em = 0) => put(1, x0, y0, z0, x1, y1, z1, r, 0, m, em, Math.hypot(x1 - x0, y1 - y0) + r + 0.2);
  const box = (x, y, cz, hx, hy, hz, r, rot, m, em = 0) => put(2, x, y, cz, hx, hy, hz, r, rot, m, em, Math.hypot(hx, hy) + 0.2);   // (x, y) the centre, cz the centre's height

  // the kit a city atom draws its solids with (props are drawn 1.3x life: between the houses, 1x, and the figures, 2.6x)
  const K = { sphere, capsule, box, M, S: 1.3 };

  // what's left of a small prop the bike smashed: a few dark chunks thrown the way the bike went
  const hw = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
  function wreck(i) { for (let k = 0; k < 4; k++) { const a = i.ang + (hw(i.id, k) - 0.5) * 2.4, d = 0.3 + 1.6 * hw(k, i.id); box(i.x + Math.cos(a) * d, i.y + Math.sin(a) * d, 0.06, 0.16 + 0.12 * hw(i.id, k + 9), 0.07, 0.06, 0.03, a * 3.1, k % 2 ? M.dark : M.steel); } }

  // ---------- the glyph ramp, one row of white letters ----------
  // drawn at the cell's own pixel size and sampled nearest: a big atlas shrunk without mips loses the letters' strokes
  const atlas = document.createElement('canvas'); let atlasPx = 0;
  const tGlyph = new THREE.CanvasTexture(atlas); tGlyph.minFilter = tGlyph.magFilter = THREE.NearestFilter; tGlyph.generateMipmaps = false;
  function paintAtlas(px) {
    if (px === atlasPx) return; atlasPx = px; atlas.width = px * NG; atlas.height = px; const g = atlas.getContext('2d');
    g.clearRect(0, 0, atlas.width, atlas.height); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(px * 1.05)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
    for (let i = 0; i < NG; i++) g.fillText(RAMP[i], i * px + px / 2, px * 0.55);
    tGlyph.image = atlas; tGlyph.needsUpdate = true;
  }

  // ---------- the cell pass: one texel per screen cell ----------
  let rt = null; const cells = new THREE.Vector2(1, 1), res = new THREE.Vector2(1, 1);
  Object.assign(U, { tPrim: { value: tPrim }, uPN: { value: 0 }, tCells: { value: null }, tGlyph: { value: tGlyph }, uCells: { value: cells }, uCellPx: { value: 6 }, uCellOff: { value: new THREE.Vector2() }, uRes: { value: res } });
  const CELL = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, depthTest: false, depthWrite: false, fragmentShader: `precision highp float; varying vec2 vUv;
    uniform sampler2D tPrim; uniform float uPN, uCellPx; uniform vec2 uCam, uView, uCells, uRes, uCellOff; uniform vec4 uSun;
    vec4 P(float i, float k){ return texture2D(tPrim, vec2((k + 0.5) / 3.0, (i + 0.5) / ${MAXP}.0)); }
    float sdRect(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
    float hOf(vec2 q, vec4 A, vec4 B, vec4 C){
      if (A.x < 0.5) { float d = length(q - A.yz), r = B.w; return d < r ? A.w + sqrt(r * r - d * d) : -9.0; }
      if (A.x < 1.5) { vec2 pa = q - A.yz, ba = B.xy - A.yz; float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0), d = length(pa - ba * t), r = B.w; return d < r ? mix(A.w, B.z, t) + sqrt(r * r - d * d) : -9.0; }
      float c = cos(C.x), s = sin(C.x); vec2 l = q - A.yz; l = vec2(c * l.x + s * l.y, -s * l.x + c * l.y);
      float r = min(B.w, min(B.x, B.y)), d = sdRect(l, B.xy - r), top = A.w + B.z;
      if (d <= 0.0) return top; if (d < r) return top - r + sqrt(r * r - d * d); return -9.0; }
    void main(){
      vec2 ci = floor(vUv * uCells), fc = (ci + 0.5) * uCellPx - uCellOff, w = uCam + vec2(fc.x / uRes.x - 0.5, 0.5 - fc.y / uRes.y) * uView;
      float e = 0.05, h0 = -9.0, hx = -9.0, hy = -9.0, m = 0.0, em = 0.0;
      for (int i = 0; i < ${MAXP}; i++) { if (float(i) >= uPN) break;
        vec4 A = P(float(i), 0.0), C = P(float(i), 2.0); if (length(w - A.yz) > C.w) continue; vec4 B = P(float(i), 1.0);
        float h = hOf(w, A, B, C); if (h > h0) { h0 = h; m = C.y; em = C.z; }
        hx = max(hx, hOf(w + vec2(e, 0.0), A, B, C)); hy = max(hy, hOf(w + vec2(0.0, e), A, B, C)); }
      if (h0 < -1.0) { gl_FragColor = vec4(0.0); return; }
      if (hx < -1.0) hx = h0 - 0.15; if (hy < -1.0) hy = h0 - 0.15;
      vec3 nrm = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.0));
      float L = clamp(dot(nrm, normalize(vec3(uSun.xy, max(0.3, uSun.z)))), 0.0, 1.0);   // the sun where it is now (world y runs down the screen)
      float lum = (0.16 + 0.84 * clamp(L * 1.2, 0.0, 1.0)) * (0.8 + 0.2 * clamp(h0 / 2.4, 0.0, 1.0));   // a little sky light: no face goes fully black
      gl_FragColor = vec4(lum, m / 32.0, em, 0.52 + 0.48 * clamp(h0 / 8.0, 0.0, 1.0)); }` });   // alpha: solid, and how tall (for cast shadows)
  const cScene = new THREE.Scene(), cQuad = new THREE.Mesh(quadGeo, CELL); cQuad.frustumCulled = false; cScene.add(cQuad);
  // the same pass, drawn the cheap way: each volume is a quad over its own footprint (not every cell asking every volume),
  // its height written as depth so the tallest wins. Cost goes with the area the figures cover, not cells x volumes, so a
  // night horde no longer drowns the phone. Needs fragment depth (WebGL2, or EXT_frag_depth); else the full-screen pass.
  const fragDepth = renderer.capabilities.isWebGL2 || !!renderer.extensions.get('EXT_frag_depth');
  const qA = new Float32Array(MAXP * 16), qB = new Float32Array(MAXP * 16), qC = new Float32Array(MAXP * 16), qK = new Float32Array(MAXP * 8), qI = [];
  for (let i = 0; i < MAXP; i++) { qK.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8); const v = i * 4; qI.push(v, v + 1, v + 2, v, v + 2, v + 3); }
  const qGeo = new THREE.BufferGeometry(), at = (a, k) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); return b; };
  qGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 12), 3)); qGeo.setAttribute('aA', at(qA, 4)); qGeo.setAttribute('aB', at(qB, 4)); qGeo.setAttribute('aC', at(qC, 4)); qGeo.setAttribute('aK', new THREE.BufferAttribute(qK, 2)); qGeo.setIndex(qI);
  const QUADS = new THREE.ShaderMaterial({ uniforms: U, depthTest: true, depthWrite: true, side: THREE.DoubleSide, extensions: { fragDepth: true },
    vertexShader: `attribute vec4 aA, aB, aC; attribute vec2 aK; uniform vec2 uCam, uView, uCells, uRes, uCellOff; uniform float uCellPx; varying vec4 vA, vB, vC;
      void main(){ vA = aA; vB = aB; vC = aC; vec2 w = aA.yz + aK * aC.w;
        vec2 s = (vec2((w.x - uCam.x) / uView.x + 0.5, 0.5 - (w.y - uCam.y) / uView.y) * uRes + uCellOff) / (uCells * uCellPx);   // the cell grid's own mapping
        gl_Position = vec4(s * 2.0 - 1.0, 0.0, 1.0); }`,
    fragmentShader: `precision highp float; uniform vec2 uCam, uView, uCells, uRes, uCellOff; uniform float uCellPx; uniform vec4 uSun; varying vec4 vA, vB, vC;
      float sdRect(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      float hOf(vec2 q, vec4 A, vec4 B, vec4 C){
        if (A.x < 0.5) { float d = length(q - A.yz), r = B.w; return d < r ? A.w + sqrt(r * r - d * d) : -9.0; }
        if (A.x < 1.5) { vec2 pa = q - A.yz, ba = B.xy - A.yz; float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0), d = length(pa - ba * t), r = B.w; return d < r ? mix(A.w, B.z, t) + sqrt(r * r - d * d) : -9.0; }
        float c = cos(C.x), s = sin(C.x); vec2 l = q - A.yz; l = vec2(c * l.x + s * l.y, -s * l.x + c * l.y);
        float r = min(B.w, min(B.x, B.y)), d = sdRect(l, B.xy - r), top = A.w + B.z;
        if (d <= 0.0) return top; if (d < r) return top - r + sqrt(r * r - d * d); return -9.0; }
      void main(){
        vec2 fc = (floor(gl_FragCoord.xy) + 0.5) * uCellPx - uCellOff, w = uCam + vec2(fc.x / uRes.x - 0.5, 0.5 - fc.y / uRes.y) * uView;
        float e = 0.05, h0 = hOf(w, vA, vB, vC); if (h0 < -1.0) discard;
        float hx = hOf(w + vec2(e, 0.0), vA, vB, vC), hy = hOf(w + vec2(0.0, e), vA, vB, vC); if (hx < -1.0) hx = h0 - 0.15; if (hy < -1.0) hy = h0 - 0.15;
        vec3 nrm = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.0));
        float L = clamp(dot(nrm, normalize(vec3(uSun.xy, max(0.3, uSun.z)))), 0.0, 1.0);
        float lum = (0.16 + 0.84 * clamp(L * 1.2, 0.0, 1.0)) * (0.8 + 0.2 * clamp(h0 / 2.4, 0.0, 1.0));
        gl_FragDepthEXT = clamp(1.0 - (h0 + 1.0) / 12.0, 0.0, 1.0);   // the tallest volume over a cell wins
        gl_FragColor = vec4(lum, vC.y / 32.0, vC.z, 0.52 + 0.48 * clamp(h0 / 8.0, 0.0, 1.0)); }` });
  const qMesh = new THREE.Mesh(qGeo, QUADS); qMesh.frustumCulled = false; const qScene = new THREE.Scene(); qScene.add(qMesh);
  const clearC = new THREE.Color(); let clearA = 1;

  // ---------- the composite: the Overgrown ground, roofs as glyphs, the solids' cells as glyphs on black ----------
  let src = ASH3F;
  const swap = (a, b) => { if (!src.includes(a)) throw new Error('medium: the Overgrown shader moved: ' + a.slice(0, 40)); src = src.replace(a, b); };
  swap('        float inward = sx.b, lit = rf.g, flatRoof = step(rf.b, 0.5), edgeLine = 0.0;', '        float inward = sx.b, lit = rf.g, flatRoof = step(rf.b, 0.5), edgeLine = 0.0;\n        { float sk = 1.0 - smoothstep(0.06, 0.12, abs(sx.g - 0.784)); street *= 1.0 - sk * 0.88; ground = (1.0 - roof) * (1.0 - tree) * (1.0 - street); }   // [medium] the square is overgrown too: grass through the setts');
  // [garden] begin: the plants' clump as a function, shared by the open grass and the gardens: leaves fanned round the
  // middle, lit from the sun's side, the shadow falling away; in flower (bloom 1) a ring of seven blooms of colour fc, size fs
  swap('      void main(){ vec2 w = world(), t = toTex(w); float g0 = gust(w);', `      vec3 clump(vec3 col, vec2 w, vec2 ctr, float R0, vec2 rr, vec2 cid, float bloom, vec3 fc, float fs, float g0, float pressH){
        vec2 dv = w - ctr; float d = length(dv); if (d >= R0 * 1.1) return col;
        float a = atan(dv.y, dv.x), nl = 5.0 + floor(rr.y * 4.0), leaf = abs(fract(a * nl / 6.2832 + rr.x) - 0.5) * 2.0;
        float shape = 1.0 - smoothstep(0.0, mix(0.85, 0.35, d / R0), leaf); float body = shape * (1.0 - smoothstep(R0 * 0.85, R0 * 1.05, d)) * (1.0 - pressH * 0.85);
        vec3 lc = mix(vec3(0.1, 0.16, 0.1), vec3(0.55, 0.7, 0.44), clamp(0.35 + 0.65 * dot(normalize(dv + 1e-4), -normalize(SUNV)) * (d / R0), 0.0, 1.0)) * (0.8 + 0.3 * g0);
        col = mix(col * (1.0 - 0.4 * (1.0 - smoothstep(0.0, R0 * 1.2, length(dv + SUNV * min(1.2, 0.5 / max(0.3, uSun.z)) * min(1.0, R0 / 0.8))))), lc, body * 0.95);
        if (bloom > 0.5) for (int f = 0; f < 7; f++) { float fa = rr.x * 6.28 + float(f) * 0.9, fd = R0 * (0.3 + 0.5 * h21(cid + float(f))); vec2 fp = ctr + vec2(cos(fa), sin(fa)) * fd; float fdd = length(w - fp), fr = (0.15 + 0.08 * h21(cid * 3.0 + float(f))) * fs;
          col = mix(col, fc * mix(1.0, 0.45, uNight) * (0.75 + 0.35 * smoothstep(fr, 0.0, fdd)), (1.0 - smoothstep(fr * 0.6, fr, fdd)) * (1.0 - pressH)); col = mix(col, vec3(0.5, 0.36, 0.08), 1.0 - smoothstep(0.0, fr * 0.35, fdd)); }
        return col; }
      void main(){ vec2 w = world(), t = toTex(w); float g0 = gust(w);`);
  // [garden] end
  swap('            m = 1.0;\n          } else if (tree > 0.5) {', '            m = 0.0;   // [medium] roofs are glyphs, not strokes\n          } else if (tree > 0.5) {');

  // [medium] the grass as combed hair (a line integral of fine noise along the flow): dense, continuous strands that curve
  // together, bend with the gusts, part round Kai, and lie short and dark where the dead have trodden
  swap('            m = step(1.0 - grassK, h21(id + 7.31));', '            m = 0.0;   // [medium] the grass is hair, below');
  swap('            m = step(0.12, r.x);', '            m = 0.0;   // [medium] crowns are hair too, below');
  swap('        vec3 col = mix(base, sc * mix(1.0, 0.6, shadow), alpha);', `        vec3 col = mix(base, sc * mix(1.0, 0.6, shadow), alpha);
        float trkM = street * step(0.08, sx.g) * (1.0 - step(0.2, sx.g));   // a farm track's grass crown and verges
        float hairK = ground + street * (1.0 - smoothstep(0.12, 0.3, inward)) * 0.8 + tree + trkM * max(smoothstep(0.86, 0.97, inward), 1.0 - smoothstep(0.15, 0.3, inward)) * 0.9;
        if (hairK > 0.01) {
          vec2 o1 = vec2(0.45 / uS, 0.0), o2 = vec2(0.0, 0.45 / uS);   // the field is coarse (0.42 m a texel): blurred, so up close the parting is one smooth flow, not rings
          vec4 dH = (texture2D(tDist, t) * 2.0 + texture2D(tDist, t + o1) + texture2D(tDist, t - o1) + texture2D(tDist, t + o2) + texture2D(tDist, t - o2)) / 6.0; vec2 pushH = (dH.rg - 0.5) * 2.0; float pressH = dH.b;
          float th = atan(WD.y, WD.x) + 2.4 * (vnoise(w * 0.05 + vec2(uTime * 0.01, 0.0)) - 0.5) + 1.1 * (vnoise(w * 0.21) - 0.5) + (g0 - 0.4) * 0.6;
          vec2 dir = vec2(cos(th), sin(th)); if (tree > 0.5) dir = normalize(tang + WD * (g0 - 0.3) * 0.5);   // a crown is combed round its middle
          float pl = length(pushH); if (pl > 0.02) dir = normalize(mix(dir, pushH / pl, clamp(pl * 1.6, 0.0, 1.0)));
          // the grass has a size in the world (three layers: clumps, tufts, blades); the zoom only reveals or hides detail. A
          // layer too fine for the pixels fades into its own average, so nothing swaps as you zoom (see strands())
          float pr = mix(1.0, 0.65, pressH), thick = smoothstep(0.2, 0.75, vnoise(w * 0.07 + 3.7)) * 0.55 + 0.45;
          // how tall this grass stands (a lawn ~12 cm; the land makes pasture shorter, a meadow knee-high): the trample
          // rule answers by height: a lawn only presses and springs back; a meadow keeps a laid, combed track for minutes
          float grassH = 0.12; vec4 trG = trample(w, grassH);
          if (trG.z > 0.05 && dot(trG.xy, trG.xy) > 0.1) dir = normalize(mix(dir, trG.xy * sign(dot(trG.xy, dir) + 1e-3), trG.z));
          if (tree > 0.5) thick = 1.0;
          col *= mix(1.0, 0.7, hairK);
          // the combed partings: dark lanes where the strands part, running along the flow (world-fixed, so every zoom has them)
          // (noise smeared along the flow: the lanes follow its curves)
          float part = 0.0; for (int k = -2; k <= 2; k++) part += vnoise((w + dir * float(k) * 0.55) * 1.7 + 11.0); part = smoothstep(0.36, 0.6, part / 5.0);
          if (tree > 0.5) part = 1.0;
          for (int L = 0; L < 3; L++) {
            float f = L == 0 ? 1.5 : L == 1 ? 4.2 : 12.0, len = (L == 0 ? 2.4 : L == 1 ? 0.85 : 0.34) * pr, r = L == 0 ? 0.12 : L == 1 ? 0.042 : 0.02, p = L == 0 ? 0.45 : L == 1 ? 0.85 : 0.85;
            float vis = smoothstep(0.35, 1.0, 2.0 * r * uPpm), mean = 1.0 - exp(-p * f * f * 1.4 * r * len);
            vec2 st = vis > 0.01 ? strands(w, dir, f, len, r, p, float(L) * 17.3) : vec2(0.0, 0.5);
            float cov = mix(mean, st.x, vis), hl = mix(0.5, st.y, vis);
            vec3 hc = mix(vec3(0.16, 0.2, 0.17), vec3(0.6, 0.67, 0.57), hl) * (0.75 + 0.5 * g0) * mix(1.0, 0.55, pressH) * mix(1.0, 0.6, shadow) * (L == 0 ? 0.8 : L == 1 ? 0.92 : 1.05);
            hc = mix(hc, hc * 1.28 + vec3(0.03, 0.03, 0.0), trG.z * (1.0 - uNight * 0.6)) * (1.0 - 0.35 * trG.w);   // laid grass shows its pale sheen; the standing edge shades it
            if (tree > 0.5) hc = mix(vec3(0.07, 0.09, 0.07), vec3(0.62, 0.7, 0.55), tl * (0.5 + 0.5 * hl)) * (0.85 + 0.3 * g0) * (L == 0 ? 0.75 : 1.0);
            col = mix(col, hc * (L == 0 ? 1.0 : mix(0.8, 1.0, part)), hairK * thick * cov * (L == 0 ? 0.7 : mix(0.82, 1.0, part))); }   // the lanes only shade the grass, they never thin it
          // bigger plants: leafy clumps every few metres of open grass, swaying in the gusts; some in flower
          if (ground > 0.5) { vec2 cid = floor(w / 4.6), rr = h22(cid + 4.7);
            if (h21(cid + 9.1) < 0.45) { vec2 ctr = (cid + 0.33 + 0.34 * rr) * 4.6 + WD * (gust(cid * 4.6) - 0.35) * 0.3; float fl = h21(cid + 2.3);   // in flower: a ring of small blooms
              if (texture2D(tMisc, toTex(ctr)).b < 0.02)   // [garden] a garden grows its own
              col = clump(col, w, ctr, 0.8 + 0.55 * rr.x, rr, cid, step(fl, 0.549), fl < 0.2 ? vec3(0.95, 0.82, 0.28) : fl < 0.38 ? vec3(0.93, 0.92, 0.86) : vec3(0.92, 0.48, 0.58), 1.0, g0, pressH); } }
        }`);
  // [garden] begin
  gardenLook(swap, NG);
  // [garden] end
  landLook(swap, NG);   // the land outside the town (world/land.js): fields, pasture, woodland floor…
  swap('        col *= mix(vec3(1.0), vec3(0.33, 0.35, 0.40), uNight);', `        col *= mix(vec3(1.02, 1.04, 1.04) * tint(), vec3(0.24, 0.27, 0.36), uNight);   // [medium] by day bright, warm when the sun is low; by night dark and cool
        // [medium] roofs: the same cells and ramp as the solids, lit by slope (after the ground's darkening: they are solids)
        { vec2 cp = (gl_FragCoord.xy + uCellOff) / uCellPx, g = fract(cp); float rl = flatRoof > 0.5 ? 0.55 : mix(0.34, 0.95, lit); rl *= (1.0 - 0.85 * ridge) * (1.0 - 0.75 * eave) * (0.88 + 0.24 * h21(floor(cp)));
          float rlev = floor(pow(clamp(rl, 0.0, 0.999), 0.6) * ${NG}.0), gm = mix(0.14 + 0.62 * rlev / ${NG - 1}.0, texture2D(tGlyph, vec2((rlev + g.x) / ${NG}.0, g.y)).a, smoothstep(2.4, 4.6, uCellPx));
          vec3 rc = vec3(0.9, 0.88, 0.82) * (0.45 + 0.6 * rl) * mix(tint(), vec3(0.55), uNight);
          // a lit house at night: its windows show as warm letters along the eaves, the roof catches a little of its own glow
          vec4 LM = texture2D(tLight, t); float win = LM.g * uNight * step(0.55, h21(floor(cp * vec2(0.5, 1.0)) + 3.1)) * smoothstep(0.35, 0.95, 1.0 - rf.a + eave);
          rc = mix(rc, vec3(1.0, 0.7, 0.32) * (0.9 + 0.3 * rl), clamp(win * 1.4, 0.0, 1.0)); rc += vec3(0.22, 0.12, 0.04) * LM.g * uNight * 0.6;
          col = mix(col, mix(rc * 0.16, rc, gm), roof); }
`);
  swap('        gl_FragColor = vec4(mix(vec3(0.03), col, inside(t)), 1.0); }', `        // [medium] the solids: each cell a glyph by its light, the material's colour in the letters, glow through them
        // the city's ground marks (atoms paint them once): r pale paint, worn; g dark (stains, oil, char, holes); b water
        { vec3 dk = texture2D(tDecal, t).rgb;
          // [atoms-marks] begin: the map is 4 texels a metre, so magnified paint and holes blur; cut each mark at half its
          // local peak (the brightest of its 4 neighbours, so worn, faint paint keeps its strength): crisp edges at any zoom
          // (the map is 4 texels a metre: magnified, a mark's edge is a 25 cm ramp. Each mark is cut at half its plateau (its
          // brightest within 45 cm, so worn faint paint keeps its strength) with an edge one screen pixel wide: crisp at any zoom)
          if (dk.r + dk.g > 0.004) { vec3 m = dk; for (int k = 0; k < 8; k++) { float a = float(k) * 0.785; m = max(m, texture2D(tDecal, t + vec2(cos(a), sin(a)) * 0.45 / uS).rgb); }
            float ew = 3.0 / uPpm; dk.r = m.r * smoothstep(0.5 - ew, 0.5 + ew, dk.r / max(m.r, 1e-3)); dk.g = m.g * smoothstep(0.5 - ew * 1.5, 0.5 + ew * 1.5, dk.g / max(m.g, 1e-3)); }
          // [atoms-marks] end
          dk *= (1.0 - roof) * (1.0 - tree);
          col = mix(col, vec3(0.8, 0.79, 0.74) * mix(tint(), vec3(0.42), uNight) * (0.8 + 0.2 * vnoise(w * 3.0)), clamp(dk.r * (0.65 + 0.45 * vnoise(w * 1.7 + 4.0)), 0.0, 1.0));
          col *= 1.0 - 0.7 * dk.g;
          vec3 sky = mix(vec3(0.5, 0.57, 0.64) * tint(), vec3(0.05, 0.06, 0.09), uNight);   // a puddle holds the sky, a little moving
          col = mix(col, sky * (0.5 + 0.5 * vnoise(w * 0.8 + vec2(uTime * 0.07, 0.0))) + vec3(0.25) * pow(max(0.0, vnoise(w * 6.0 + uTime * 0.3)), 6.0) * (1.0 - uNight), smoothstep(0.15, 0.55, dk.b) * 0.85); }
        vec2 ci = floor((gl_FragCoord.xy + uCellOff) / uCellPx); vec4 A = texture2D(tCells, (ci + 0.5) / uCells);
        float hp = A.a > 0.5 ? (A.a - 0.52) / 0.48 * 8.0 : 0.0, skip = A.a > 0.5 ? 0.8 : 0.25;
        // lit windows and open doors: the light falls out of the house; whoever stands in it throws a shadow away from the window
        float lm = 0.0; { float l0 = texture2D(tLight, t).r; if (l0 * uNight > 0.01) { vec3 LD = texture2D(tLDir, t).rgb; vec2 back = (LD.rg * 255.0 - 128.0) / 127.0; float dist = LD.b * 8.0;
          lm = l0 * (0.88 + 0.12 * vnoise(w * 0.4 + uTime * 1.3)) * (1.0 - 0.9 * occl(w, w + back * dist, hp, 1.7, skip, 1.0, 0.45)) * (1.0 - roof) * (1.0 - tree); }
          col += vec3(1.0, 0.64, 0.3) * lm * uNight * (0.35 + 0.65 * smoothstep(0.0, 0.25, lm)) * 0.75; }
        // the bike's headlight: a cone of real light; walls stop it, and the dead in it throw long shadows down the beam
        float head = 0.0; if (uHead.w > 0.01) { vec2 dv = w - uHead.xy; float r = length(dv), cs = dot(dv, vec2(cos(uHead.z), sin(uHead.z))) / max(r, 1e-3);
          head = smoothstep(0.84, 0.95, cs) * (1.0 - smoothstep(6.0, 24.0, r)) * smoothstep(0.2, 1.0, r) * uHead.w;
          head *= (1.0 - tree) * (1.0 - roof);   // the beam runs under crowns and stops at walls: it never lights their tops
          if (head > 0.003) head *= 1.0 - occl(w, uHead.xy, hp, 1.45, skip, 1.0, 1.1);
          col += col * head * 2.2 + vec3(1.0, 0.92, 0.76) * head * 0.42; }
        vec3 under = col;   // the ground as lit, before any figure: a crown above a figure keeps most of it
        // cast shadows: from this point walk toward the sun (north-west, the same sun as the town's) and ask whether
        // a solid stands taller than the light's ray there. The ray climbs 1.8 m a metre (shadows ~0.55× their height).
        float h0s = A.a > 0.5 ? (A.a - 0.52) / 0.48 * 8.0 : 0.0, shade = 0.0;
        float clim = max(0.85, uSun.z), stp = 0.26 * clamp(1.8 / clim, 1.0, 2.0), j2 = h21(gl_FragCoord.xy * 0.53);   // figures are drawn big: a low sun would throw a 10 m shadow
        for (int k = 0; k < 14; k++) { float d = (float(k) + 0.6 + j2) * stp; vec2 sc = ((gl_FragCoord.xy + uCellOff) + vec2(SUNV.x, -SUNV.y) * d * uPpm) / uCellPx;
          vec4 S2 = texture2D(tCells, (floor(sc) + 0.5) / uCells); float hs = S2.a > 0.5 ? (S2.a - 0.52) / 0.48 * 8.0 : -1.0;
          shade = max(shade, smoothstep(-0.15, 0.25, hs - (h0s + d * clim))); }
        float sMask = shade * (A.a > 0.5 ? 0.55 : 1.0) * (1.0 - tree) * mix(1.0, 0.3, uNight);   // a crown is above any figure's shadow
        col *= 1.0 - 0.42 * sMask;
        if (A.a > 0.5) {
          float mi = floor(A.g * 32.0 + 0.5), em = A.b; vec3 mc = matCol(mi, em), ec = emCol(mi);
          float lev = max(max(floor(pow(clamp(A.r, 0.0, 0.999), 0.5) * ${NG}.0), floor(em * ${NG - 1}.0)), floor(clamp(head * 1.4 + lm * uNight, 0.0, 0.95) * ${NG}.0));   // light on it fills its letters
          vec2 g = fract((gl_FragCoord.xy + uCellOff) / uCellPx); float gm = mix(0.14 + 0.62 * lev / ${NG - 1}.0, texture2D(tGlyph, vec2((lev + g.x) / ${NG}.0, g.y)).a, smoothstep(2.4, 4.6, uCellPx));   // far: a cell too small for a letter shows its average ink
          vec3 lc = mix(vec3(0.94, 0.92, 0.87), mc, 0.6) * (0.55 + 0.75 * A.r) * mix(tint(), vec3(0.62), uNight);   // pale letters, the colour as a tint
          lc += vec3(1.0, 0.66, 0.32) * lm * uNight * 0.9 + vec3(1.0, 0.92, 0.76) * head * 0.9;   // a figure in a window's light or the headlight is lit by it
          lc *= 1.0 - 0.45 * sMask;
          col = mix(mc * (0.1 + 0.2 * A.r) * mix(1.0, 0.6, uNight), lc, gm) + ec * em * (0.25 + 1.1 * gm);   // a dark backing in the material's own colour keeps a small figure's silhouette
          col = mix(col, under, tree * 0.8);   // under a tree: the crown covers the figure, a ghost of it shows through
        }
        gl_FragColor = vec4(mix(vec3(0.03), col, inside(t)), 1.0); }`);
  // [atoms-look] begin: the atoms show their own state, in the medium (docs/design/atomic-engineering.md). Real-world logic,
  // per surface: water films over hard ground (darker, holds the sky, glints) but soaks into grass (darker, deeper green)
  // and darkens a roof or a crown; fresh oil is a black glossy film with a thin rainbow on tarmac, a brown stain on grass;
  // a burning atom glows cell by cell (dull red embers, orange, a yellow core), its letters filling with the heat, and
  // lights what is near; smoke drifts downwind and dims what is under it; hot grass browns before it catches; a burnt
  // roof is black rafters with an ember or two; steam and fog are white haze; a blast is a flash of light.
  swap('        vec2 ci = floor((gl_FragCoord.xy + uCellOff) / uCellPx); vec4 A = texture2D(tCells, (ci + 0.5) / uCells);', `        { vec2 at = (w - uAtomO) / uAtomS, aE = vec2(1.0 / uAtomS); float inA = step(0.0, at.x) * step(at.x, 1.0) * step(0.0, at.y) * step(at.y, 1.0);
          vec2 atW = at + (vec2(vnoise(w * 0.9), vnoise(w * 0.9 + 7.3)) - 0.5) * aE * 2.2 + (vec2(vnoise(w * 3.1), vnoise(w * 3.1 + 2.9)) - 0.5) * aE * 0.7;   // ragged, natural edges (no 2 m squares)
          vec4 AS = texture2D(tAtom, atW) * inA, A2 = texture2D(tAtom2, atW) * inA; vec2 cpA = floor((gl_FragCoord.xy + uCellOff) / uCellPx), gA = fract((gl_FragCoord.xy + uCellOff) / uCellPx);
          float glyphOn = smoothstep(2.4, 4.6, uCellPx);
          vec3 skyA = mix(vec3(0.5, 0.57, 0.64) * tint(), vec3(0.05, 0.06, 0.09), uNight);
          // a burnt roof (the char mark under it): black rafters, now and then an ember
          float chr = texture2D(tDecal, t).g * roof; if (chr > 0.02) { float k = smoothstep(0.04, 0.3, chr);
            float raft = lines(dot(w, vec2(cos(rf.r * 3.14159), sin(rf.r * 3.14159))), 0.9, max(0.04, 0.6 / uPpm));
            col = mix(col, vec3(0.055, 0.05, 0.047) * (0.7 + 0.6 * h21(cpA)) + vec3(0.1, 0.09, 0.08) * raft, k * 0.92);
            col += vec3(0.9, 0.28, 0.06) * k * step(0.988, h21(cpA + floor(uTime * 0.6))) * (0.6 + 0.4 * sin(uTime * 3.0 + h21(cpA) * 6.0)); }
          // hot grass browns before it catches
          col = mix(col, col * vec3(1.05, 0.8, 0.5), smoothstep(0.1, 0.9, A2.a) * (ground + tree) * 0.7);
          // water
          float wk = smoothstep(0.04, 0.45, AS.b); if (wk > 0.0) {
            float pool = smoothstep(0.5, 0.72, vnoise(w * 0.55 + 3.1) * 0.75 + vnoise(w * 1.9) * 0.25 + AS.b * 0.22);
            vec3 puddle = skyA * (0.5 + 0.5 * vnoise(w * 0.8 + vec2(uTime * 0.07, 0.0))) + vec3(0.25) * pow(max(0.0, vnoise(w * 6.0 + uTime * 0.3)), 6.0) * (1.0 - uNight);
            col = mix(col, mix(col * 0.55, puddle, pool * 0.85), wk * street);
            col = mix(col, col * vec3(0.6, 0.74, 0.62) + vec3(0.0, 0.015, 0.0), wk * ground * 0.9);
            col = mix(col, col * 0.72 + skyA * 0.05, wk * (tree + roof) * 0.8); }
          // fresh oil
          float ok = smoothstep(0.04, 0.4, AS.a); if (ok > 0.0) { float edge = ok * (1.0 - smoothstep(0.35, 0.9, AS.a)); vec3 irid = 0.5 + 0.5 * cos(6.2832 * (vnoise(w * 2.2) * 1.4 + vec3(0.0, 0.33, 0.67)));
            col = mix(col, vec3(0.03, 0.03, 0.035) + irid * 0.045 * edge * (1.0 - uNight * 0.7) + vec3(0.16) * pow(max(0.0, vnoise(w * 2.5)), 6.0) * (1.0 - uNight), ok * (street + roof) * 0.92);
            col = mix(col, col * vec3(0.32, 0.27, 0.22), ok * (ground + tree) * 0.85); }
          // fire: ground fire shows under open sky (a crown hides most of it); a solid's fire is its own footprint
          float fire = max(AS.r * (1.0 - roof) * (1.0 - tree * 0.65), AS.g);
          // its light on what is near (more at night) and its smoke downwind
          float near = 0.0, smk = 0.0;
          for (int k = 0; k < 6; k++) { float a = float(k) * 1.047; vec2 o = vec2(cos(a), sin(a)); vec4 n1 = texture2D(tAtom, at + o * aE * 3.5) * inA, n2 = texture2D(tAtom, at + o * aE * 8.0) * inA; near += max(n1.r, n1.g) * 0.5 + max(n2.r, n2.g) * 0.22; }
          near = min(1.2, near / 3.0 + fire * 0.6);
          for (int k = 1; k <= 5; k++) { vec4 u1 = texture2D(tAtom, at - WD * aE * (float(k) * 3.2) + vec2(-WD.y, WD.x) * aE * sin(float(k) + uTime * 0.4) * 1.5) * inA; smk += max(u1.r, u1.g) * (1.0 - float(k) * 0.12); }
          smk = clamp(smk * 0.5, 0.0, 0.82) * (0.55 + 0.45 * vnoise(w * 0.22 - WD * uTime * 1.3)) * (0.6 + 0.4 * vnoise(w * 0.9 - WD * uTime * 2.1));
          col = mix(col, mix(vec3(0.36, 0.34, 0.32) * tint(), vec3(0.05, 0.05, 0.055), uNight), smk * (1.0 - 0.5 * fire));   // smoke: a grey haze, lighter than tarmac by day, dark by night
          col += col * near * mix(0.5, 1.6, uNight) + vec3(1.0, 0.45, 0.12) * near * mix(0.03, 0.2, uNight);
          if (fire > 0.004) {
            // under the flames the atom chars and glows dull red; the flames break through in patches that shift with the
            // wind, more of them the harder it burns; each cell flickers on its own; a yellow core only where it's fiercest
            float n1 = vnoise(w * 0.5 + vec2(0.0, -uTime * 0.4) - WD * uTime * 0.6), n2 = h21(cpA + floor(uTime * 7.0 + h21(cpA) * 3.0));
            float cover = smoothstep(1.0 - fire * 0.36, 1.16 - fire * 0.36, n1 * 0.72 + n2 * 0.38);
            col = mix(col, col * 0.24 + vec3(0.11, 0.018, 0.0) * fire * (0.35 + 0.65 * n1) * (0.8 + 0.2 * n2), smoothstep(0.0, 0.45, fire));
            float I = clamp(cover * fire * (0.45 + 0.55 * n2), 0.0, 1.0);
            vec3 fc = I < 0.5 ? mix(vec3(0.42, 0.05, 0.01), vec3(0.92, 0.3, 0.05), I / 0.5) : mix(vec3(0.92, 0.3, 0.05), vec3(1.0, 0.78, 0.4), (I - 0.5) / 0.5);
            float lev = floor(clamp(I * 1.1, 0.0, 0.999) * ${NG}.0), gmF = mix(0.2 + 0.7 * lev / ${NG - 1}.0, texture2D(tGlyph, vec2((lev + gA.x) / ${NG}.0, gA.y)).a, glyphOn);
            col = mix(col, fc * (0.45 + 0.85 * gmF), cover * (0.35 + 0.65 * gmF)); }
          // steam (warm grey), fog (white), a blast's flash
          float stm = A2.r * (0.6 + 0.4 * vnoise(w * 0.7 + vec2(0.0, -uTime * 0.8))), fog = A2.g * (0.75 + 0.25 * vnoise(w * 0.35 + uTime * 0.1));
          col = mix(col, vec3(0.86, 0.84, 0.8) * mix(tint(), vec3(0.32), uNight), clamp(stm * 0.75, 0.0, 0.8));
          col = mix(col, vec3(0.9, 0.92, 0.93) * mix(tint(), vec3(0.3), uNight), clamp(fog * 0.8, 0.0, 0.85));
          col += (col * 1.5 + vec3(1.0, 0.82, 0.55) * 0.5) * A2.b; }
        vec2 ci = floor((gl_FragCoord.xy + uCellOff) / uCellPx); vec4 A = texture2D(tCells, (ci + 0.5) / uCells);`);
  // [atoms-look] end
  const PAL = `uniform sampler2D tCells, tGlyph, tLight, tLDir, tDecal, tLand; uniform vec2 uCells, uCellOff; uniform float uCellPx; uniform vec4 uHead;
    uniform sampler2D tAtom, tAtom2; uniform vec2 uAtomO; uniform float uAtomS;   // [atoms-look] the atom world's state (src/roam/atomlook.js)
    // one layer of strands with a fixed size in the world: seeds on a turned, jittered lattice (f a metre, p of the cells),
    // each combed len metres along the flow, r wide at the root and tapering. A pixel asks the cells behind it along the
    // flow whether a strand passes within its width; edges are antialiased by the pixel's own size. Returns (coverage, how
    // far along the strand: the tip's light)
    vec2 strands(vec2 w, vec2 dir, float f, float len, float r, float p, float salt){
      mat2 RT = mat2(0.866, 0.5, -0.5, 0.866); vec2 P = RT * w * f, D = RT * dir; float best = 0.0, tip = 0.5, aa = 0.7 / uPpm;
      for (int k = 0; k < 9; k++) { vec2 id = floor(P - D * (len * f * float(k) / 8.0)), h = h22(id + salt);
        if (h.x < p) { vec2 sp = id + 0.15 + 0.7 * vec2(h.y, h21(id + salt + 3.7)), rel = P - sp; float a = dot(rel, D), sd = a / f, pd = length(rel - D * a) / f;
          float u = sd / len, rr = r * (1.0 - 0.6 * clamp(u, 0.0, 1.0)), c = (1.0 - smoothstep(rr - aa, rr + aa, pd)) * smoothstep(-0.02, 0.0, sd) * (1.0 - smoothstep(len * 0.9, len, sd));
          if (c > best) { best = c; tip = clamp(u, 0.0, 1.0); } } }
      return vec2(best, tip); }
    vec3 tint(){ return mix(vec3(1.0), vec3(1.1, 0.88, 0.68), uSun.w); }
    // how much stands between the point w (at height hp) and a light at L (height hl): solids taller than the ray, from the cell
    // pass; roofs too when bld. Taps within skip of w (the figure itself) and within tail of the light (its own bike) don't count
    float occl(vec2 w, vec2 L, float hp, float hl, float skip, float bld, float tail){
      vec2 dv = L - w; float r = length(dv), o = 0.0;
      float j = h21(gl_FragCoord.xy * 0.71);
      for (int k = 0; k < 7; k++) { float u = (float(k) + j) / 7.5, s = r * u; if (s < skip || s > r - tail) continue; vec2 q = w + dv * u;
        if (bld > 0.5) o = max(o, max(smoothstep(0.45, 0.7, texture2D(tRoof, toTex(q)).a), smoothstep(0.93, 0.97, texture2D(tTreeH, toTex(q)).r)));   // walls, and tree trunks
        vec4 S3 = texture2D(tCells, (floor(((gl_FragCoord.xy + uCellOff) + vec2(dv.x, -dv.y) * u * uPpm) / uCellPx) + 0.5) / uCells);
        float hs = S3.a > 0.5 ? (S3.a - 0.52) / 0.48 * 8.0 : -1.0; o = max(o, smoothstep(0.0, 0.4, hs - mix(hp, hl, u))); }
      return o; }
    vec3 matCol(float m, float em){
${MATCOL}    vec3 emCol(float m){ if (m > 7.5 && m < 8.5) return vec3(1.0, 0.42, 0.1); if (m > 8.5 && m < 9.5) return vec3(1.0, 0.78, 0.3); if (m > 14.5 && m < 15.5) return vec3(0.9); return vec3(1.0, 0.68, 0.28); }
  `;
  const material = mat(PAL + src);

  // ---------- the figures as volumes ----------
  function kaiVolumes(k, t) {
    const S = FIGM, a = k.face, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [k.x + (lx * ca - ly * sa) * S, k.y + (lx * sa + ly * ca) * S];
    const sp = Math.hypot(k.vx, k.vy), stride = sp > 0.4 ? Math.sin(t * 9) * 0.18 : 0;
    if (k.riding) { for (const s of [-1, 1]) { const [x0, y0] = P(-0.05, s * 0.1), [x1, y1] = P(0.3, s * 0.26); capsule(x0, y0, 0.95 * S, x1, y1, 0.5 * S, 0.075 * S, M.pants); } }   // on the bike: knees out, feet on the pegs
    else for (const s of [-1, 1]) { const [x0, y0] = P(-0.02, s * 0.09), [x1, y1] = P(-0.02 + stride * s, s * 0.1); capsule(x0, y0, 0.75 * S, x1, y1, 0.12 * S, 0.075 * S, M.pants); }
    { const [x, y] = P(-0.01, 0); box(x, y, 1.02 * S, 0.13 * S, 0.22 * S, 0.29 * S, 0.11 * S, a, M.suit); }
    { const [x, y] = P(0.02, 0); box(x, y, 1.04 * S, 0.032 * S, 0.215 * S, 0.29 * S, 0.02 * S, a, M.hivis); }
    for (const s of [-1, 1]) { const [x0, y0] = P(0.03, s * 0.21), [x1, y1] = P(0.17, s * 0.25); capsule(x0, y0, 1.24 * S, x1, y1, 1.0 * S, 0.068 * S, M.suit); }
    const sw = k.swing > 0 ? k.swing / 0.2 : 0, wa = a - 0.7 + (1 - (1 - sw) * (1 - sw)) * 2.2, [hx, hy] = P(0.17, 0.25), ex = hx + Math.cos(wa) * 0.82 * S, ey = hy + Math.sin(wa) * 0.82 * S;
    capsule(hx, hy, 1.04 * S, ex, ey, 1.12 * S, 0.05 * S, M.steel); for (const j of [-1, 1]) { const ja = wa + j * 0.55; sphere(ex + Math.cos(ja) * 0.09 * S, ey + Math.sin(ja) * 0.09 * S, 1.12 * S, 0.065 * S, M.steel); }   // the jaw: two prongs
    { const [x, y] = P(0.03, 0); sphere(x, y, 1.42 * S, 0.155 * S, M.hair); }
    { const [x, y] = P(0.08, 0); sphere(x, y, 1.46 * S, 0.135 * S, M.bandana); }
    { const [x, y] = P(-0.13, 0); sphere(x, y, 1.48 * S, 0.06 * S, M.bandana); }   // the knot at the back
  }
  // [m1] the machines: one family (a steel shell on six scuttling legs, a chip eye that burns red when it hunts), each kind
  // its own build. Crawler: low and plain. Skitter: small, rust, quick legs. Hound: long and lean, legs long, a dorsal
  // fin. Spitter: a dome with a barrel; its eye flares white-hot while it aims. Brute: big, dark armour plates, thick legs.
  const MLOOK = {
    crawler: { S: 0.95, hz: 0.2, shell: [0.2, 0.14, 0.07], legL: 0.27, legR: 0.022, spine: 'rust' },
    skitter: { S: 0.78, hz: 0.18, shell: [0.17, 0.11, 0.06], legL: 0.3, legR: 0.026, spine: 'rust', shellM: 'rust', quick: 2.4 },
    hound: { S: 1.05, hz: 0.26, shell: [0.3, 0.1, 0.07], legL: 0.34, legR: 0.024, spine: 'dark', fin: true },
    spitter: { S: 1.0, hz: 0.24, shell: [0.17, 0.17, 0.1], legL: 0.25, legR: 0.024, spine: 'paint', barrel: true },
    brute: { S: 1.7, hz: 0.24, shell: [0.24, 0.17, 0.1], legL: 0.3, legR: 0.04, spine: 'dark', shellM: 'dark', plates: true, slow: 0.6 },
  };
  function machineVolumes(d, t, awake, kind) {
    const L = MLOOK[kind] || MLOOK.crawler, S = FIGM * L.S, a = d.fa ?? 0, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [d.x + (lx * ca - ly * sa) * S, d.y + (lx * sa + ly * ca) * S];
    const hit = t - d.hit < 0.08, base = M[L.shellM || 'steel'], shell = hit ? M.flash : base, hem = hit ? 1 : 0, ph = (d.ph || 0) * (L.quick || 1) * (L.slow || 1), hz = awake ? L.hz : L.hz * 0.55, [sx, sy, sz] = L.shell;
    { const [x, y] = P(-0.02, 0); box(x, y, (hz + sz) * S, sx * S, sy * S, sz * S, 0.05 * S, a, shell, hem); }   // the shell
    { const [x, y] = P(-0.04, 0); box(x, y, (hz + sz * 2 + 0.01) * S, sx * 0.6 * S, sy * 0.55 * S, 0.03 * S, 0.03 * S, a, hit ? M.flash : M[L.spine], hem); }   // the spine plate
    if (L.plates) for (const s2 of [-1, 1]) { const [x, y] = P(-0.02, s2 * sy * 0.95); box(x, y, (hz + sz) * S, sx * 0.9 * S, 0.035 * S, sz * 0.9 * S, 0.02 * S, a, hit ? M.flash : M.steel, hem); }   // the brute's side armour
    if (L.fin) { const [x0, y0] = P(-0.2, 0), [x1, y1] = P(0.08, 0); capsule(x0, y0, (hz + sz * 2 + 0.05) * S, x1, y1, (hz + sz * 2 + 0.02) * S, 0.02 * S, hit ? M.flash : M.dark, hem); }
    const hx = sx + 0.02; { const [x, y] = P(hx, 0); sphere(x, y, (hz + sz) * S, 0.06 * S, hit ? M.flash : M.dark, hem); }   // the head
    if (L.barrel) { const [x0, y0] = P(hx, 0), [x1, y1] = P(hx + 0.2, 0); capsule(x0, y0, (hz + sz * 1.4) * S, x1, y1, (hz + sz * 1.4) * S, 0.03 * S, M.dark, 0); }
    const aiming = d.aim > 0, eye = aiming ? 1 : awake ? 0.75 + 0.25 * Math.sin(t * 9 + d.id) : 0.15;
    { const [x, y] = P(hx + 0.05, 0); sphere(x, y, (hz + sz + 0.02) * S, (aiming ? 0.05 : 0.032) * S, aiming ? M.lamp : M.crackHot, eye); }   // the chip eye (white-hot while a spitter aims)
    for (let i = 0; i < 3; i++) for (const s2 of [-1, 1]) {   // six legs: alternate pairs lift as it scuttles
      const lx = sx * 0.55 - i * sx * 0.6, step = awake ? Math.sin(ph * 1.6 + i * 2.1 + (s2 > 0 ? Math.PI : 0)) : 0, [x0, y0] = P(lx, s2 * sy * 0.7), [x1, y1] = P(lx + 0.05 * step, s2 * (awake ? L.legL : L.legL * 0.63));
      capsule(x0, y0, (hz + 0.04) * S, x1, y1, Math.max(0.01, 0.02 + 0.05 * Math.max(0, step)) * S, L.legR * S, M.dark, 0); }
  }
  function deadVolumes(d, t, awake, kind = 'cinder') {
    const big = kind === 'brute', S = FIGM * (big ? 1.6 : kind === 'flicker' ? 0.88 : 1), a = d.fa ?? 0, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [d.x + (lx * ca - ly * sa) * S, d.y + (lx * sa + ly * ca) * S];
    const hit = t - d.hit < 0.08, skin = hit ? M.flash : M.stone, crackM = kind === 'flicker' ? M.crackHot : M.crack, pulse = awake ? 0.7 + 0.3 * Math.sin(t * 3 + d.id) : 0, hem = hit ? 1 : 0;
    if (!awake) {   // asleep: a kneeling mound, grey as rubble; its cracks dark
      { const [x, y] = P(-0.03, 0); box(x, y, 0.42 * S, 0.21 * S, 0.25 * S, 0.3 * S, 0.19 * S, a, skin, hem); }
      { const [x, y] = P(0.17, 0); sphere(x, y, 0.62 * S, 0.13 * S, skin, hem); }
      for (let i = 0; i < 2; i++) { const [x0, y0] = P(-0.12 + 0.1 * i, -0.12 + 0.2 * i), [x1, y1] = P(0.0 + 0.08 * i, 0.06 - 0.18 * i); capsule(x0, y0, 0.72 * S + 0.01, x1, y1, 0.72 * S + 0.01, 0.024 * S, crackM, 0); }
      return;
    }
    const sw = Math.sin(d.ph) * 0.07, stride = Math.sin(d.ph) * 0.16;
    for (const s of [-1, 1]) { const [x0, y0] = P(-0.03, s * 0.09), [x1, y1] = P(-0.03 + stride * s, s * 0.1); capsule(x0, y0, 0.72 * S, x1, y1, 0.1 * S, 0.075 * S, skin, hem); }
    { const [x, y] = P(0, 0); box(x, y, 0.98 * S, 0.15 * S, 0.21 * S, 0.3 * S, 0.12 * S, a, skin, hem); }
    if (big) for (const s of [-1, 1]) { const [x, y] = P(0.02, s * 0.2); sphere(x, y, 1.18 * S, 0.12 * S, skin, hem); }
    for (const s of [-1, 1]) { const [x0, y0] = P(0.06, s * 0.2), [x1, y1] = P(0.66, s * (0.15 + sw * s)); capsule(x0, y0, 1.18 * S, x1, y1, 1.0 * S, 0.055 * S, skin, hem); }
    { const [x, y] = P(0.22, 0); sphere(x, y, 1.22 * S, 0.13 * S, skin, hem); }   // hunched: the head low and ahead of the shoulders
    const nc = big ? 5 : 3, hsh = (i, j) => { let q = (d.id * 374761393 + i * 668265263 + j * 1274126177) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
    for (let i = 0; i < nc; i++) { const lx = (hsh(i, 1) - 0.5) * 0.22, ly = (hsh(i, 2) - 0.5) * 0.34, [x0, y0] = P(lx, ly), [x1, y1] = P(lx + (hsh(i, 3) - 0.5) * 0.16, ly + (hsh(i, 4) - 0.5) * 0.2); capsule(x0, y0, 1.285 * S, x1, y1, 1.285 * S, 0.026 * S, crackM, pulse); }
    for (const s of [-1, 1]) { const [x, y] = P(0.33, s * 0.05); sphere(x, y, 1.28 * S, 0.034 * S, crackM, awake ? 1 : 0); }
  }
  // the motorcycle: a scrambler in rust red with a yellow tank; a headlight that burns at night
  function bikeVolumes(b, t, night, riding) {
    const S = FIGM * 0.9, a = b.ang, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [b.x + (lx * ca - ly * sa) * S, b.y + (lx * sa + ly * ca) * S];
    for (const lx of [0.62, -0.58]) { const [x, y] = P(lx, 0); box(x, y, 0.3 * S, 0.3 * S, 0.1 * S, 0.3 * S, 0.08 * S, a, M.dark); }
    { const [x0, y0] = P(-0.55, 0), [x1, y1] = P(0.55, 0); capsule(x0, y0, 0.48 * S, x1, y1, 0.55 * S, 0.16 * S, M.rust); }
    { const [x, y] = P(0.18, 0); box(x, y, 0.7 * S, 0.22 * S, 0.17 * S, 0.12 * S, 0.1 * S, a, M.paint); }
    { const [x, y] = P(-0.27, 0); box(x, y, 0.66 * S, 0.26 * S, 0.14 * S, 0.07 * S, 0.06 * S, a, M.dark); }
    { const [x0, y0] = P(0.48, -0.32), [x1, y1] = P(0.48, 0.32); capsule(x0, y0, 0.86 * S, x1, y1, 0.86 * S, 0.035 * S, M.steel); }
    { const [x, y] = P(0.72, 0); sphere(x, y, 0.62 * S, 0.08 * S, M.lamp, night > 0.3 || riding ? 1 : 0.15); }
  }
  // a nest: a swollen heart of stone at the infested building's door, cracks pulsing; a dying nest goes dark
  function nestVolumes(nst, t) {
    const S = FIGM * 1.4, beat = 1 + 0.08 * Math.max(0, Math.sin(t * 3.2 + nst.id)) * (nst.alive ? 1 : 0), hit = t - nst.hit < 0.1;
    const r = 0.42 * S * beat * (nst.alive ? 0.5 + 0.5 * nst.hp / nst.maxHp : 0.35);
    sphere(nst.x, nst.y, 0.1 * S, r, hit ? M.flash : M.stone);
    if (nst.alive) for (let i = 0; i < 5; i++) { const a = i * 1.26 + nst.id, c = Math.cos(a), s2 = Math.sin(a); capsule(nst.x + c * r * 0.3, nst.y + s2 * r * 0.3, 0.1 * S + r * 0.95, nst.x + c * r * 0.85, nst.y + s2 * r * 0.85, 0.1 * S + r * 0.5, 0.05 * S, M.crack, 0.6 + 0.4 * Math.sin(t * 3.2 + nst.id)); }
  }
  // ---------- each frame: gather the volumes, size the cells, render the cell pass ----------
  function render(v) {
    n = 0;
    const { cam, cssW, cssH, dpr, kai, dead, bike, nests, t, night } = v, mW = cssW / cam.ppm / 2 + 4, mH = cssH / cam.ppm / 2 + 4, on = (x, y) => Math.abs(x - cam.x) < mW && Math.abs(y - cam.y) < mH;
    for (const nst of nests) if (on(nst.x, nst.y)) nestVolumes(nst, t);
    // what moves is drawn snapped to the cell grid: its letters ride with it instead of re-sampling as it slides
    const sn = q => Math.round(q / CELLW) * CELLW, snap = o => ({ ...o, x: sn(o.x), y: sn(o.y) });
    if (on(bike.x, bike.y)) bikeVolumes(snap(bike), t, night, kai.riding);
    if (!kai.dead) { const k2 = kai.riding ? { ...snap(kai), vx: 0, vy: 0, swing: 0 } : snap(kai); kaiVolumes(k2, t); }
    const awake = night > 0.5 || v.forceAwake;
    // a fall: the body topples forward and sinks into the grass as a shrinking lump, a few stones roll off (no block)
    // a fall: the body topples forward and sinks into the grass as a shrinking lump, a few stones roll off (no block)
    for (const D of v.deaths || []) { const k = (t - D.t0) / 0.8; if (D.prop || k >= 1 || !on(D.x, D.y)) continue; const S = FIGM * (D.brute ? 1.6 : 1), a = D.fa ?? 0, ca = Math.cos(a), sa = Math.sin(a), e = 1 - (1 - k) * (1 - k);
      const r = 0.24 * S * (1 - 0.7 * k), fx0 = 0.25 * S * e;
      sphere(D.x + ca * fx0, D.y + sa * fx0, r * 0.4 - k * r * 1.2, r, D.metal ? M.steel : M.stone);
      for (let i = 0; i < 5; i++) { const ang = a + (i - 2) * 0.9 + (D.id % 7) * 0.3, dd = (0.15 + 0.5 * e) * S * (0.7 + 0.1 * i); sphere(D.x + Math.cos(ang) * dd, D.y + Math.sin(ang) * dd, -0.02, 0.06 * S * (1 - k), D.metal ? (i % 2 ? M.dark : M.rust) : M.stone); } }   // [m1] a machine falls apart into steel and rust
    const near = dead.filter(d => on(d.x, d.y)).sort((p, q) => Math.hypot(p.x - kai.x, p.y - kai.y) - Math.hypot(q.x - kai.x, q.y - kai.y));
    for (const d of near) { const sp = Math.hypot(d.vx, d.vy); if (sp > 0.1) d.fa = Math.atan2(d.vy, d.vx); if (MLOOK[d.kind]) machineVolumes({ ...d, x: sn(d.x), y: sn(d.y) }, t, d.state !== 'sleep', d.kind); else deadVolumes({ ...d, x: sn(d.x), y: sn(d.y) }, t, d.state !== 'sleep', d.kind); }
    // the city's solid atoms in view, last (if the frame's volumes run out, a lamp goes before a dead)
    for (const i of v.props || []) if (on(i.x, i.y)) { if (v.broken && v.broken.has(i.id)) wreck(i); else i.atom.volumes(i, K, t, v); }
    tPrim.needsUpdate = true; U.uPN.value = n;
    // the glyph grid is pinned to the world, not the screen: the camera glides freely and a still roof keeps its letters.
    // uCellOff is where the screen sits inside the world's grid (one spare cell each way covers the slide)
    // the glyph cells have a size in the world (CELLW metres), like the grass: zooming in makes the letters bigger, zooming
    // out smaller, and no cell ever re-samples: each stays on its own patch of world. Below a few pixels a cell's letter
    // fades into its average ink (see the composite), so far away a solid reads as a shaded silhouette, not noise
    const W = Math.floor(cssW * dpr), H = Math.floor(cssH * dpr), pxm = W / (cssW / cam.ppm), cp = Math.max(1.5, CELLW * pxm), cw = Math.ceil(W / cp) + 1, ch = Math.ceil(H / cp) + 1;
    { const py = H / (cssH / cam.ppm), m = a => ((a % cp) + cp) % cp; U.uCellOff.value.set(m(cam.x * pxm - W / 2), m(-(H / 2 + cam.y * py))); }
    if (!rt || rt.width !== cw || rt.height !== ch) { if (rt) rt.dispose(); rt = new THREE.WebGLRenderTarget(cw, ch, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: fragDepth }); }
    paintAtlas(Math.max(4, Math.min(18, Math.round(cp)))); cells.set(cw, ch); res.set(W, H); U.uCellPx.value = cp; U.tCells.value = rt.texture;
    if (fragDepth) {   // the volumes as quads into a cleared cell target
      for (let i = 0; i < n; i++) for (let v = 0; v < 4; v++) { const o = (i * 4 + v) * 4, d = i * 12; qA.set(data.subarray(d, d + 4), o); qB.set(data.subarray(d + 4, d + 8), o); qC.set(data.subarray(d + 8, d + 12), o); }
      for (const k of ['aA', 'aB', 'aC']) { const a = qGeo.getAttribute(k); a.needsUpdate = true; a.updateRange.offset = 0; a.updateRange.count = n * 16; }
      qGeo.setDrawRange(0, n * 6);
      renderer.getClearColor(clearC); clearA = renderer.getClearAlpha(); renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(rt); renderer.clear(true, true, false); if (n) renderer.render(qScene, quadCam); renderer.setRenderTarget(null); renderer.setClearColor(clearC, clearA);
    } else { renderer.setRenderTarget(rt); renderer.render(cScene, quadCam); renderer.setRenderTarget(null); }
  }

  // ---------- the soft things, in strokes; sparkles in the dark ----------
  const hashN = (a, b = 0, c = 0) => { let q = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  function draw(fx, v) {
    const { toS, cam, cssW, cssH, kai, dead, flakes, deaths, tracers, t, night, WIND } = v, s = cam.ppm * FIGM, L = (x0, y0, x1, y1) => { fx.moveTo(x0, y0); fx.lineTo(x1, y1); };
    fx.lineCap = 'round';
    // Kai's tied sleeves and bandana tails: bundles of thin strands that trail with her walk and the wind
    if (!v.kaiUnder) { const [x, y] = toS(kai.x, kai.y), a = kai.face, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [x + (lx * ca - ly * sa) * s, y + (lx * sa + ly * ca) * s], mv = Math.min(1, Math.hypot(kai.vx, kai.vy) / 3);
      const strand = (lx, ly, len, col, k, w) => { fx.strokeStyle = col; fx.lineWidth = w; fx.beginPath(); for (let i = 0; i < k; i++) { const [x0, y0] = P(lx, ly + (i - k / 2) * 0.012), wob = Math.sin(t * 7 + i * 1.7 + lx * 9) * 0.05 * (0.4 + mv); let px = x0, py = y0; fx.moveTo(px, py); for (let j = 1; j <= 4; j++) { const u = j / 4, [qx, qy] = P(lx - len * u, ly + (i - k / 2) * 0.02 * u + wob * u * u * 2); px = qx + WIND.x * u * 3 * (1 - mv); py = qy + WIND.y * u * 3 * (1 - mv); fx.lineTo(px, py); } } fx.stroke(); };
      for (const sd of [-1, 1]) strand(-0.1, sd * 0.17, 0.26 + 0.04 * Math.sin(t * 5 + sd), '#d9a01c', 5, Math.max(1, s * 0.012));
      for (const sd of [-1, 1]) strand(-0.06, sd * 0.03, 0.22, '#e8392f', 4, Math.max(1, s * 0.01)); }
    // shed ash off the dead, embers rising off the awake ones at night
    fx.strokeStyle = '#2a2624'; fx.lineWidth = 1.1;
    for (const f of flakes) { const k = (t - f.t0) / 2.6; if (k > 1) continue; const [X, Y] = toS(f.x + WIND.x * k * 2.4, f.y + WIND.y * k * 2.4); if (X < -10 || Y < -10 || X > cssW + 10 || Y > cssH + 10) continue; const l = 0.14 * s * (1 - k * 0.5); fx.globalAlpha = (1 - k) * 0.85; fx.beginPath(); L(X, Y, X + Math.cos(f.a) * l, Y + Math.sin(f.a) * l); fx.stroke(); }
    fx.globalAlpha = 1;
    if (night > 0.3) { fx.fillStyle = '#ffb060'; for (const d of dead) { const [x, y] = toS(d.x, d.y); if (x < -20 || y < -20 || x > cssW + 20 || y > cssH + 20) continue; for (let i = 0; i < 3; i++) { const k = (t * 0.7 + hashN(d.id, i)) % 1; fx.globalAlpha = (1 - k) * night; fx.fillRect(x + (hashN(d.id, i, 2) - 0.5) * 0.5 * s + WIND.x * k * 10, y - k * 0.9 * s + WIND.y * k * 10, 1.6, 1.6); } } fx.globalAlpha = 1; }
    // a nest's tentacles: dark strands out of the infested building, writhing; and Kai's headlight on the bike at night
    for (const nst of v.nests || []) { if (!nst.alive) continue; const [x, y] = toS(nst.x, nst.y); if (x < -200 || y < -200 || x > cssW + 200 || y > cssH + 200) continue;
      for (let i = 0; i < 22; i++) { const a0 = hashN(nst.id, i) * 6.283, len = (1.6 + hashN(nst.id, i, 1) * 2.8) * s * 0.5, w0 = Math.max(1.5, s * 0.05) * (1 - hashN(nst.id, i, 2) * 0.5);
        fx.strokeStyle = i % 3 ? 'rgba(40,10,12,.85)' : 'rgba(120,24,20,.8)'; fx.lineWidth = w0; fx.beginPath(); fx.moveTo(x, y);
        for (let j = 1; j <= 6; j++) { const u = j / 6, a = a0 + Math.sin(t * 1.6 + i + u * 3) * 0.5 * u; fx.lineTo(x + Math.cos(a) * len * u, y + Math.sin(a) * len * u); } fx.stroke(); } }
    // the city's soft atoms (wires, washing, smoke) and its little lives (birds, paper), in view
    { const onS = (x, y, m) => { const [X, Y] = toS(x, y); return X > -m && Y > -m && X < cssW + m && Y < cssH + m; };
      for (const i of v.strands || []) if (onS(i.x, i.y, 300)) { fx.save(); i.atom.strands(fx, i, v); fx.restore(); }
      for (const i of v.live || []) if (i.st && onS(i.st.x ?? i.x, i.st.y ?? i.y, 60)) { fx.save(); i.atom.live.draw(fx, i, v); fx.restore(); } }
    // a fall: the glyphs come apart and drift off as ash
    fx.font = `700 ${Math.max(7, Math.round(0.14 * s))}px "IBM Plex Mono", ui-monospace, monospace`; fx.textAlign = 'center'; fx.textBaseline = 'middle';
    for (const D of deaths) { const k = (t - D.t0) / 2.1; if (k > 1) continue; const [x, y] = toS(D.x, D.y);
      for (let i = 0; i < 26; i++) { const a = hashN(D.id, i) * 6.283, r = (1 - (1 - Math.min(1, k * 2)) ** 2) * (0.25 + hashN(D.id, i, 1) * 0.8) * s; fx.globalAlpha = 1 - k; fx.fillStyle = i % 4 === 0 && k < 0.5 ? '#ffa04a' : '#cfc9bc'; fx.fillText(k < 0.4 ? '#%@*'[i % 4] : k < 0.7 ? '+:'[i % 2] : '.,'[i % 2], x + Math.cos(a) * r + WIND.x * k * 12, y + Math.sin(a) * r + WIND.y * k * 12); } }
    fx.globalAlpha = 1;
    fx.strokeStyle = 'rgba(255,236,200,.9)'; fx.lineWidth = 1.2; fx.beginPath(); for (const T of tracers) { const [a, b] = toS(T.x0, T.y0), [c, d] = toS(T.x1, T.y1); L(a, b, c, d); } fx.stroke();
    // sparkles: a few glyphs adrift in the air, pale, one in eight warm
    fx.font = '600 9px "IBM Plex Mono", ui-monospace, monospace';
    for (let i = 0; i < 60; i++) { const sp = 0.3 + hashN(i, 7) * 0.6, x = (hashN(i, 1) * cssW + t * 9 * sp * WIND.x) % (cssW + 20) - 10, y = (hashN(i, 2) * cssH + t * 9 * sp * WIND.y) % (cssH + 20) - 10, tw = 0.5 + 0.5 * Math.sin(t * (1.5 + hashN(i, 3) * 2) + i);
      const lt = v.lightAt ? Math.min(1, v.lightAt(cam.x + (x - cssW / 2) / cam.ppm, cam.y + (y - cssH / 2) / cam.ppm)) : 1;   // ash in the air: seen where light falls on it
      fx.globalAlpha = (0.25 + 0.55 * tw) * lt; fx.fillStyle = i % 8 === 0 ? '#e8c060' : '#e9e6dc'; fx.fillText('*o·*·8·°'[i % 8], x, y); }

    // ---------- zoomed out: each thing becomes one letter on a dark plate, a fixed size on screen (the roguelike map) ----------
    // far 0 at the close camera, 1 when a figure would be a couple of cells. Amber rings are yours, ember red is the dead.
    const far = Math.max(0, Math.min(1, (11 - cam.ppm) / 4));
    // [read] the machines' eyes, at every zoom (the one marker they have: close up it sits on the model's chip eye, far away
    // it is all you see of them, so pulling the camera back and forth is seamless). A tiny point of light with a soft neon
    // glow in the kind's hue; a brute shows two, a spitter's flares while it aims; asleep, barely a glimmer
    { fx.save(); fx.globalCompositeOperation = 'lighter'; const grow = Math.max(1, Math.min(1.8, cam.ppm / 14));
      for (const d of dead) { const L = MLOOK[d.kind]; if (!L) continue; const fwd = (L.shell[0] + 0.07) * L.S * FIGM, a = d.fa || 0, [x, y] = toS(d.x + Math.cos(a) * fwd, d.y + Math.sin(a) * fwd);
        if (x < -20 || y < -20 || x > cssW + 20 || y > cssH + 20) continue; const K = MACHINES[d.kind], asleep = d.state === 'sleep', hit = t - d.hit < 0.1;
        const glow = (asleep ? 0.25 : 0.85 + 0.15 * Math.sin(t * 6 + d.id)) * (d.aim > 0 ? 1.6 : 1) * (0.75 + 0.35 * night), col = hit ? '#ffffff' : K.color, sep = d.kind === 'brute' ? 2.2 * grow : 0;
        for (const o of sep ? [-sep, sep] : [0]) { const ex = x - Math.sin(a) * o, ey = y + Math.cos(a) * o;
          fx.globalAlpha = 0.35 * glow; fx.fillStyle = col; fx.beginPath(); fx.arc(ex, ey, 4.5 * grow, 0, 6.283); fx.fill();   // the halo
          fx.globalAlpha = Math.min(1, glow); fx.beginPath(); fx.arc(ex, ey, 1.6 * grow, 0, 6.283); fx.fill(); } }   // the point
      fx.restore(); fx.globalAlpha = 1; }
    if (far > 0.01) {
      const { nests = [], bike = null } = v, onS = (x, y) => x > -30 && y > -30 && x < cssW + 30 && y < cssH + 30;
      const plate = (x, y, r, ring, ch, col, px, a) => { fx.globalAlpha = a; fx.fillStyle = 'rgba(10,11,13,.86)'; fx.beginPath(); fx.arc(x, y, r, 0, 7); fx.fill(); fx.strokeStyle = ring; fx.lineWidth = 2; fx.stroke();
        fx.fillStyle = col; fx.font = `700 ${px}px "IBM Plex Mono", ui-monospace, monospace`; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(ch, x, y + 0.5); };
      // nests: a red ring with a heart in it while alive, grey once broken; the bike: an amber M when Kai is off it
      for (const nst of nests) { const [x, y] = toS(nst.x, nst.y); if (!onS(x, y)) continue; plate(x, y, 11, nst.alive ? '#ff4a3a' : '#5d5952', nst.alive ? '♥' : '×', nst.alive ? '#ff8a6a' : '#8a857c', 13, far); }
      if (bike && !kai.riding) { const [x, y] = toS(bike.x, bike.y); if (onS(x, y)) plate(x, y, 9, '#f0b44c', 'M', '#f6e7c8', 11, far); }
      // Kai: an @ on an amber ring, with a tick for where she faces
      // Kai: a hollow ring as wide as her wrench's reach (a dead inside it is in the fight), the @ on a small tag above, a facing tick
      { const [x, y] = toS(kai.x, kai.y), R = Math.max(11, 1.8 * cam.ppm); fx.globalAlpha = far; fx.strokeStyle = 'rgba(10,11,13,.7)'; fx.lineWidth = 4; fx.beginPath(); fx.arc(x, y, R, 0, 7); fx.stroke(); fx.strokeStyle = '#f0b44c'; fx.lineWidth = 2; fx.beginPath(); fx.arc(x, y, R, 0, 7); fx.stroke();
        fx.beginPath(); fx.moveTo(x + Math.cos(kai.face) * R, y + Math.sin(kai.face) * R); fx.lineTo(x + Math.cos(kai.face) * (R + 6), y + Math.sin(kai.face) * (R + 6)); fx.lineWidth = 2.5; fx.stroke();
        plate(x, y - R - 10, 8, '#f0b44c', '@', '#ffd36a', 11, far); fx.fillStyle = '#ffd36a'; fx.beginPath(); fx.arc(x, y, 2.2, 0, 7); fx.fill(); }
      fx.globalAlpha = 1;
    }
  }
  return { material, render, draw };
}
