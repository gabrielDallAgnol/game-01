// One medium (Looks Lab): everything solid is drawn in glyphs, everything soft in strokes, so Kai, the Ash-Born, Hilde,
// the guns and the roofs come out of one renderer and read as one world.
//   · Solids are built from simple 3D volumes (spheres, capsules, rounded boxes) as a height field seen from straight
//     above. Each frame a low-res pass evaluates them once per screen cell: height, the lit value under one sun (north-
//     west, high), the material, and its glow. The composite turns each cell into a glyph from a light ramp
//     (' .,:-=+*%#@'): shadow is empty black, light is dense letters, the colour sits inside the letters.
//   · Roofs use the same cells and ramp. The ground stays the Overgrown stroke field (grass, trees, hard streets).
//   · Soft things are strokes on the 2D layer: Kai's bandana tails and tied sleeves, shed ash, embers, sparkles.
// Lab code: it reads the lab's little scene and draws it; nothing here reaches the game yet.
/* global THREE */

export const MAXP = 384;          // volumes a frame (the dead off screen are left out)
const RAMP = ' .,:-=+*%#@';
const NG = RAMP.length;
export const FIGM = 2.6;          // figures are drawn bigger than life, as in the game (Thronefall-style)
// materials (the composite's palette): ids are stored in the cell pass as id / 32
const M = { suit: 1, bandana: 2, hair: 3, steel: 4, hivis: 5, pants: 6, stone: 7, crack: 8, crackHot: 9, paint: 10, truck: 11, dark: 12, tarp: 13, rust: 14, flash: 15, lamp: 16 };

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
  Object.assign(U, { tPrim: { value: tPrim }, uPN: { value: 0 }, tCells: { value: null }, tGlyph: { value: tGlyph }, uCells: { value: cells }, uCellPx: { value: 6 }, uRes: { value: res } });
  const CELL = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, depthTest: false, depthWrite: false, fragmentShader: `precision highp float; varying vec2 vUv;
    uniform sampler2D tPrim; uniform float uPN, uCellPx; uniform vec2 uCam, uView, uCells, uRes;
    vec4 P(float i, float k){ return texture2D(tPrim, vec2((k + 0.5) / 3.0, (i + 0.5) / ${MAXP}.0)); }
    float sdRect(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
    float hOf(vec2 q, vec4 A, vec4 B, vec4 C){
      if (A.x < 0.5) { float d = length(q - A.yz), r = B.w; return d < r ? A.w + sqrt(r * r - d * d) : -9.0; }
      if (A.x < 1.5) { vec2 pa = q - A.yz, ba = B.xy - A.yz; float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0), d = length(pa - ba * t), r = B.w; return d < r ? mix(A.w, B.z, t) + sqrt(r * r - d * d) : -9.0; }
      float c = cos(C.x), s = sin(C.x); vec2 l = q - A.yz; l = vec2(c * l.x + s * l.y, -s * l.x + c * l.y);
      float r = min(B.w, min(B.x, B.y)), d = sdRect(l, B.xy - r), top = A.w + B.z;
      if (d <= 0.0) return top; if (d < r) return top - r + sqrt(r * r - d * d); return -9.0; }
    void main(){
      vec2 ci = floor(vUv * uCells), fc = (ci + 0.5) * uCellPx, w = uCam + vec2(fc.x / uRes.x - 0.5, 0.5 - fc.y / uRes.y) * uView;
      float e = 0.05, h0 = -9.0, hx = -9.0, hy = -9.0, m = 0.0, em = 0.0;
      for (int i = 0; i < ${MAXP}; i++) { if (float(i) >= uPN) break;
        vec4 A = P(float(i), 0.0), C = P(float(i), 2.0); if (length(w - A.yz) > C.w) continue; vec4 B = P(float(i), 1.0);
        float h = hOf(w, A, B, C); if (h > h0) { h0 = h; m = C.y; em = C.z; }
        hx = max(hx, hOf(w + vec2(e, 0.0), A, B, C)); hy = max(hy, hOf(w + vec2(0.0, e), A, B, C)); }
      if (h0 < -1.0) { gl_FragColor = vec4(0.0); return; }
      if (hx < -1.0) hx = h0 - 0.15; if (hy < -1.0) hy = h0 - 0.15;
      vec3 nrm = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.0));
      float L = clamp(dot(nrm, normalize(vec3(-0.5, -0.62, 0.6))), 0.0, 1.0);   // world y runs down the screen: north-west is (-x, -y)
      float lum = (0.16 + 0.84 * clamp(L * 1.2, 0.0, 1.0)) * (0.8 + 0.2 * clamp(h0 / 2.4, 0.0, 1.0));   // a little sky light: no face goes fully black
      gl_FragColor = vec4(lum, m / 32.0, em, 0.52 + 0.48 * clamp(h0 / 8.0, 0.0, 1.0)); }` });   // alpha: solid, and how tall (for cast shadows)
  const cScene = new THREE.Scene(), cQuad = new THREE.Mesh(quadGeo, CELL); cQuad.frustumCulled = false; cScene.add(cQuad);

  // ---------- the composite: the Overgrown ground, roofs as glyphs, the solids' cells as glyphs on black ----------
  let src = ASH3F;
  const swap = (a, b) => { if (!src.includes(a)) throw new Error('medium: the Overgrown shader moved: ' + a.slice(0, 40)); src = src.replace(a, b); };
  swap('        float inward = sx.b, lit = rf.g, flatRoof = step(rf.b, 0.5);', '        float inward = sx.b, lit = rf.g, flatRoof = step(rf.b, 0.5);\n        { float sk = 1.0 - smoothstep(0.06, 0.12, abs(sx.g - 0.784)); street *= 1.0 - sk * 0.88; ground = (1.0 - roof) * (1.0 - tree) * (1.0 - street); }   // [medium] the square is overgrown too: grass through the setts');
  swap('            m = 1.0;\n          } else if (tree > 0.5) {', '            m = 0.0;   // [medium] roofs are glyphs, not strokes\n          } else if (tree > 0.5) {');

  // [medium] the grass as combed hair (a line integral of fine noise along the flow): dense, continuous strands that curve
  // together, bend with the gusts, part round Kai, and lie short and dark where the dead have trodden
  swap('            m = step(1.0 - grassK, h21(id + 7.31));', '            m = 0.0;   // [medium] the grass is hair, below');
  swap('            m = step(0.12, r.x);', '            m = 0.0;   // [medium] crowns are hair too, below');
  swap('        vec3 col = mix(base, sc * mix(1.0, 0.6, shadow), alpha);', `        vec3 col = mix(base, sc * mix(1.0, 0.6, shadow), alpha);
        float hairK = ground + street * (1.0 - smoothstep(0.12, 0.3, inward)) * 0.8 + tree;
        if (hairK > 0.01) {
          vec4 dH = texture2D(tDist, t); vec2 pushH = (dH.rg - 0.5) * 2.0; float pressH = dH.b;
          float th = atan(WD.y, WD.x) + 2.4 * (vnoise(w * 0.05 + vec2(uTime * 0.01, 0.0)) - 0.5) + 1.1 * (vnoise(w * 0.21) - 0.5) + (g0 - 0.4) * 0.6;
          vec2 dir = vec2(cos(th), sin(th)); if (tree > 0.5) dir = normalize(tang + WD * (g0 - 0.3) * 0.5);   // a crown is combed round its middle
          float pl = length(pushH); if (pl > 0.02) dir = normalize(mix(dir, pushH / pl, clamp(pl * 1.6, 0.0, 1.0)));
          // (the seeds sit on a turned, jittered lattice, so the strands never line up in columns)
          float stepL = 0.055 * mix(1.0, 0.4, pressH), acc = 0.0, tip = 0.0;
          for (int k = -9; k <= 9; k++) { float fk = float(k); vec2 q = w + dir * fk * stepL; q = mat2(0.866, 0.5, -0.5, 0.866) * q; float sd = step(0.8, h21(floor(q * 13.0 + vec2(h21(vec2(floor(q.y * 13.0), 3.0)), 0.0)))); acc += sd; tip += sd * (fk + 9.0) / 18.0; }
          float hair = clamp(acc / 4.0, 0.0, 1.0), hl = clamp(tip / max(acc, 1e-3), 0.0, 1.0);
          float thick = smoothstep(0.2, 0.75, vnoise(w * 0.07 + 3.7)) * 0.55 + 0.45;
          vec3 hc = mix(vec3(0.16, 0.2, 0.17), vec3(0.6, 0.67, 0.57), hl) * (0.75 + 0.5 * g0) * mix(1.0, 0.55, pressH) * mix(1.0, 0.6, shadow);
          if (tree > 0.5) { hc = mix(vec3(0.07, 0.09, 0.07), vec3(0.62, 0.7, 0.55), tl * (0.5 + 0.5 * hl)) * (0.85 + 0.3 * g0); thick = 1.0; }
          col = mix(col * mix(1.0, 0.7, hairK), hc, hairK * thick * smoothstep(0.1, 0.6, hair));
        }`);
  swap('        col *= mix(vec3(1.0), vec3(0.33, 0.35, 0.40), uNight);', `        col *= mix(vec3(0.5, 0.56, 0.66), vec3(0.24, 0.27, 0.36), uNight);   // [medium] a dark, cool ground: only the light carries form
        // [medium] roofs: the same cells and ramp as the solids, lit by slope (after the ground's darkening: they are solids)
        { vec2 cp = gl_FragCoord.xy / uCellPx, g = fract(cp); float rl = flatRoof > 0.5 ? 0.55 : mix(0.34, 0.95, lit); rl *= (1.0 - 0.85 * ridge) * (1.0 - 0.75 * eave) * (0.88 + 0.24 * h21(floor(cp)));
          float gm = texture2D(tGlyph, vec2((floor(pow(clamp(rl, 0.0, 0.999), 0.6) * ${NG}.0) + g.x) / ${NG}.0, g.y)).a;
          vec3 rc = vec3(0.9, 0.88, 0.82) * (0.45 + 0.6 * rl) * mix(1.0, 0.55, uNight);
          // a lit house at night: its windows show as warm letters along the eaves, the roof catches a little of its own glow
          vec4 LM = texture2D(tLight, t); float win = LM.g * uNight * step(0.55, h21(floor(cp * vec2(0.5, 1.0)) + 3.1)) * smoothstep(0.35, 0.95, 1.0 - rf.a + eave);
          rc = mix(rc, vec3(1.0, 0.7, 0.32) * (0.9 + 0.3 * rl), clamp(win * 1.4, 0.0, 1.0)); rc += vec3(0.22, 0.12, 0.04) * LM.g * uNight * 0.6;
          col = mix(col, mix(rc * 0.16, rc, gm), roof); }
        // the night's lights on the ground: street lamps, lit windows, a doorway left open (they breathe a little)
        { float lm = texture2D(tLight, t).r * (0.88 + 0.12 * vnoise(w * 0.4 + uTime * 1.3)); col += vec3(1.0, 0.64, 0.3) * lm * uNight * (0.35 + 0.65 * smoothstep(0.0, 0.25, lm)) * 0.75; }`);
  swap('        gl_FragColor = vec4(mix(vec3(0.03), col, inside(t)), 1.0); }', `        // [medium] the solids: each cell a glyph by its light, the material's colour in the letters, glow through them
        vec2 ci = floor(gl_FragCoord.xy / uCellPx); vec4 A = texture2D(tCells, (ci + 0.5) / uCells);
        // cast shadows: from this point walk toward the sun (north-west, the same sun as the town's) and ask whether
        // a solid stands taller than the light's ray there. The ray climbs 1.8 m a metre (shadows ~0.55× their height).
        float h0s = A.a > 0.5 ? (A.a - 0.52) / 0.48 * 8.0 : 0.0, shade = 0.0;
        for (int k = 1; k <= 16; k++) { float d = float(k) * 0.28; vec2 sc = (gl_FragCoord.xy + vec2(-0.6, 0.8) * d * uPpm) / uCellPx;
          vec4 S2 = texture2D(tCells, (floor(sc) + 0.5) / uCells); float hs = S2.a > 0.5 ? (S2.a - 0.52) / 0.48 * 8.0 : -1.0;
          shade = max(shade, smoothstep(-0.15, 0.25, hs - (h0s + d * 1.8))); }
        float sMask = shade * (A.a > 0.5 ? 0.55 : 1.0);
        col *= 1.0 - 0.52 * sMask;
        if (A.a > 0.5) {
          float mi = floor(A.g * 32.0 + 0.5), em = A.b; vec3 mc = matCol(mi, em), ec = emCol(mi);
          float lev = max(floor(pow(clamp(A.r, 0.0, 0.999), 0.5) * ${NG}.0), floor(em * ${NG - 1}.0));
          vec2 g = fract(gl_FragCoord.xy / uCellPx); float gm = texture2D(tGlyph, vec2((lev + g.x) / ${NG}.0, g.y)).a;
          vec3 lc = mix(vec3(0.94, 0.92, 0.87), mc, 0.6) * (0.55 + 0.75 * A.r) * mix(1.0, 0.62, uNight);   // pale letters, the colour as a tint
          lc += vec3(1.0, 0.66, 0.32) * texture2D(tLight, t).r * uNight * 0.9;   // a figure under a lamp is lit by it
          lc *= 1.0 - 0.45 * sMask;
          col = mix(mc * (0.1 + 0.2 * A.r) * mix(1.0, 0.6, uNight), lc, gm) + ec * em * (0.25 + 1.1 * gm);   // a dark backing in the material's own colour keeps a small figure's silhouette
        }
        gl_FragColor = vec4(mix(vec3(0.03), col, inside(t)), 1.0); }`);
  const PAL = `uniform sampler2D tCells, tGlyph, tLight; uniform vec2 uCells; uniform float uCellPx;
    vec3 matCol(float m, float em){
      if (m < 1.5) return vec3(0.98, 0.72, 0.16); if (m < 2.5) return vec3(0.96, 0.24, 0.2); if (m < 3.5) return vec3(0.5, 0.38, 0.28); if (m < 4.5) return vec3(0.88, 0.9, 0.92);
      if (m < 5.5) return vec3(0.95, 0.97, 0.95); if (m < 6.5) return vec3(0.42, 0.36, 0.26); if (m < 7.5) return vec3(0.74, 0.72, 0.68); if (m < 9.5) return mix(vec3(0.24, 0.22, 0.2), vec3(1.0, 0.6, 0.25), em);
      if (m < 10.5) return vec3(1.0, 0.78, 0.2); if (m < 11.5) return vec3(0.72, 0.75, 0.78); if (m < 12.5) return vec3(0.3, 0.31, 0.33); if (m < 13.5) return vec3(0.58, 0.66, 0.5); if (m < 14.5) return vec3(0.82, 0.44, 0.26); if (m < 15.5) return vec3(1.0); return vec3(1.0, 0.8, 0.45); }
    vec3 emCol(float m){ if (m > 7.5 && m < 8.5) return vec3(1.0, 0.42, 0.1); if (m > 8.5 && m < 9.5) return vec3(1.0, 0.78, 0.3); if (m > 14.5 && m < 15.5) return vec3(0.9); return vec3(1.0, 0.68, 0.28); }
  `;
  const material = mat(PAL + src);

  // ---------- the figures as volumes ----------
  function kaiVolumes(k, t) {
    const S = FIGM, a = k.face, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [k.x + (lx * ca - ly * sa) * S, k.y + (lx * sa + ly * ca) * S];
    const sp = Math.hypot(k.vx, k.vy), stride = sp > 0.4 ? Math.sin(t * 9) * 0.18 : 0;
    for (const s of [-1, 1]) { const [x0, y0] = P(-0.02, s * 0.09), [x1, y1] = P(-0.02 + stride * s, s * 0.1); capsule(x0, y0, 0.75 * S, x1, y1, 0.12 * S, 0.075 * S, M.pants); }
    { const [x, y] = P(-0.01, 0); box(x, y, 1.02 * S, 0.13 * S, 0.22 * S, 0.29 * S, 0.11 * S, a, M.suit); }
    { const [x, y] = P(0.02, 0); box(x, y, 1.04 * S, 0.032 * S, 0.215 * S, 0.29 * S, 0.02 * S, a, M.hivis); }
    for (const s of [-1, 1]) { const [x0, y0] = P(0.03, s * 0.21), [x1, y1] = P(0.17, s * 0.25); capsule(x0, y0, 1.24 * S, x1, y1, 1.0 * S, 0.068 * S, M.suit); }
    const sw = k.swing > 0 ? k.swing / 0.2 : 0, wa = a - 0.7 + (1 - (1 - sw) * (1 - sw)) * 2.2, [hx, hy] = P(0.17, 0.25), ex = hx + Math.cos(wa) * 0.82 * S, ey = hy + Math.sin(wa) * 0.82 * S;
    capsule(hx, hy, 1.04 * S, ex, ey, 1.12 * S, 0.05 * S, M.steel); for (const j of [-1, 1]) { const ja = wa + j * 0.55; sphere(ex + Math.cos(ja) * 0.09 * S, ey + Math.sin(ja) * 0.09 * S, 1.12 * S, 0.065 * S, M.steel); }   // the jaw: two prongs
    { const [x, y] = P(0.03, 0); sphere(x, y, 1.42 * S, 0.155 * S, M.hair); }
    { const [x, y] = P(0.08, 0); sphere(x, y, 1.46 * S, 0.135 * S, M.bandana); }
    { const [x, y] = P(-0.13, 0); sphere(x, y, 1.48 * S, 0.06 * S, M.bandana); }   // the knot at the back
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
  function turretVolumes(T, t) {
    const S = 1.3, a = T.aim, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [T.x + (lx * ca - ly * sa) * S, T.y + (lx * sa + ly * ca) * S];
    box(T.x, T.y, 0.25 * S, 0.55 * S, 0.55 * S, 0.25 * S, 0.5 * S, 0, M.truck);
    for (const s of [-1, 1]) { const [x0, y0] = P(0.18, s * 0.12), [x1, y1] = P(0.95, s * 0.12); capsule(x0, y0, 0.78 * S, x1, y1, 0.78 * S, 0.06 * S, M.dark); }
    { const [x, y] = P(0, 0); box(x, y, 0.7 * S, 0.28 * S, 0.24 * S, 0.2 * S, 0.07 * S, a, M.paint); }
    if (T.shotT !== undefined && t - T.shotT < 0.07) { const [x, y] = P(1.1, 0); sphere(x, y, 0.8 * S, 0.22 * S, M.lamp, 1); }
  }
  function rigVolumes(R, t, night, lvl = 3) {
    const a = R.rot, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [R.x + lx * ca - ly * sa, R.y + lx * sa + ly * ca];
    const B = (lx, ly, cz, hx, hy, hz, r, m, em = 0, rr = 0) => { const [x, y] = P(lx, ly); box(x, y, cz, hx, hy, hz, r, a + rr, m, em); };
    const Cp = (x0, y0, z0, x1, y1, z1, r, m, em = 0) => { const [ax, ay] = P(x0, y0), [bx, by] = P(x1, y1); capsule(ax, ay, z0, bx, by, z1, r, m, em); };
    const Sp = (lx, ly, z, r, m, em = 0) => { const [x, y] = P(lx, ly); sphere(x, y, z, r, m, em); };
    for (const ax of [3.3, -1.5, -2.8]) for (const s of [-1, 1]) B(ax, s * 1.32, 0.45, 0.5, 0.2, 0.45, 0.18, M.dark);
    B(-1.4, 0, 0.75, 3.0, 1.2, 0.25, 0.05, M.truck);
    for (const s of [-1, 1]) B(-1.4, s * 1.14, 1.08, 3.0, 0.06, 0.1, 0.05, M.truck);
    B(3.05, 0, 1.5, 1.45, 1.25, 0.9, 0.32, M.paint);
    B(3.86, 0, 1.92, 0.2, 1.05, 0.55, 0.08, M.dark);
    B(3.3, 0, 2.48, 0.13, 0.95, 0.08, 0.05, M.dark);
    const blink = night > 0.3 ? (Math.sin(t * 6) > 0 ? 1 : 0.15) : 0.1; for (const s of [-1, 1]) Sp(3.3, s * 0.62, 2.55, 0.17, M.lamp, blink);
    if (lvl === 0) { for (const s of [-1, 1]) B(4.55, s * 0.6, 1.55, 0.45, 0.5, 0.06, 0.05, M.paint, 0, s * 0.5); B(4.25, 0, 1.0, 0.25, 0.6, 0.35, 0.1, M.dark); }
    else B(4.25, 0, 1.12, 0.27, 1.1, 0.4, 0.14, M.paint);
    B(-0.6, 0, 1.18, 0.55, 0.55, 0.25, 0.5, M.truck);
    const ba = Math.PI + Math.sin(t * 0.35) * 0.25, tx = -0.6 + Math.cos(ba) * 4.4, ty = Math.sin(ba) * 4.4; Cp(-0.6, 0, 1.55, tx, ty, 1.95, 0.22, M.paint); Sp(tx, ty, 1.55, 0.15, M.steel);
    if (lvl >= 1) B(-2.5, 0, 1.15, 1.45, 1.15, 0.6, 0.62, M.tarp);
    if (lvl >= 2) { B(2.6, 0, 2.55, 0.45, 0.45, 0.15, 0.4, M.truck); const aim = R.aim ?? t * 0.6; B(2.6, 0, 2.86, 0.28, 0.24, 0.14, 0.07, M.paint, 0, aim - a); for (const s of [-1, 1]) { const ox = Math.cos(aim - a), oy = Math.sin(aim - a); Cp(2.6 + ox * 0.2 - oy * s * 0.12, oy * 0.2 + ox * s * 0.12, 2.92, 2.6 + ox * 1.0 - oy * s * 0.12, oy * 1.0 + ox * s * 0.12, 2.92, 0.06, M.dark); } }
    if (lvl >= 3) {
      B(-6.35, 0, 0.92, 1.25, 1.05, 0.82, 0.16, M.rust); Cp(-5.1, 0, 0.6, -4.45, 0, 0.6, 0.08, M.dark);
      for (const s of [-1, 1]) B(-1.4, s * 1.33, 0.9, 2.9, 0.08, 0.35, 0.04, M.truck);
      Cp(1.25, -0.95, 1.0, 1.25, -0.95, 3.1, 0.07, M.truck); B(1.32, -0.95, 3.15, 0.14, 0.22, 0.12, 0.05, M.lamp, night > 0.3 ? 1 : 0.2);
      Cp(1.9, 1.0, 1.0, 1.9, 1.0, 3.9, 0.04, M.steel); Sp(1.9, 1.0, 3.9, 0.07, M.lamp, Math.sin(t * 4) > 0.6 ? 1 : 0);
    }
  }

  // ---------- each frame: gather the volumes, size the cells, render the cell pass ----------
  function render(v) {
    n = 0;
    const { cam, cssW, cssH, dpr, kai, dead, turrets, rig, t, night } = v, mW = cssW / cam.ppm / 2 + 4, mH = cssH / cam.ppm / 2 + 4, on = (x, y) => Math.abs(x - cam.x) < mW && Math.abs(y - cam.y) < mH;
    if (on(rig.x, rig.y) || Math.abs(rig.x - cam.x) < mW + 8) rigVolumes(rig, t, night, v.rigLevel ?? 3);
    for (const T of turrets) if (on(T.x, T.y)) turretVolumes(T, t);
    kaiVolumes(kai, t);
    const awake = night > 0.5 || v.forceAwake;
    // a fall: the body topples forward and sinks into the grass as a shrinking lump, a few stones roll off (no block)
    // a fall: the body topples forward and sinks into the grass as a shrinking lump, a few stones roll off (no block)
    for (const D of v.deaths || []) { const k = (t - D.t0) / 0.8; if (k >= 1 || !on(D.x, D.y)) continue; const S = FIGM * (D.brute ? 1.6 : 1), a = D.fa ?? 0, ca = Math.cos(a), sa = Math.sin(a), e = 1 - (1 - k) * (1 - k);
      const r = 0.24 * S * (1 - 0.7 * k), fx0 = 0.25 * S * e;
      sphere(D.x + ca * fx0, D.y + sa * fx0, r * 0.4 - k * r * 1.2, r, M.stone);
      for (let i = 0; i < 5; i++) { const ang = a + (i - 2) * 0.9 + (D.id % 7) * 0.3, dd = (0.15 + 0.5 * e) * S * (0.7 + 0.1 * i); sphere(D.x + Math.cos(ang) * dd, D.y + Math.sin(ang) * dd, -0.02, 0.06 * S * (1 - k), M.stone); } }
    const near = dead.filter(d => on(d.x, d.y)).sort((p, q) => Math.hypot(p.x - kai.x, p.y - kai.y) - Math.hypot(q.x - kai.x, q.y - kai.y));
    for (const d of near) { const sp = Math.hypot(d.vx, d.vy); if (sp > 0.1) d.fa = Math.atan2(d.vy, d.vx); deadVolumes(d, t, awake || sp > 0.2, d.kind || (d.id % 9 === 0 ? 'brute' : d.id % 5 === 0 ? 'flicker' : 'cinder')); }
    tPrim.needsUpdate = true; U.uPN.value = n;
    const cp = Math.max(3, Math.round(3 * dpr)), W = Math.round(cssW * dpr), H = Math.round(cssH * dpr), cw = Math.ceil(W / cp), ch = Math.ceil(H / cp);
    if (!rt || rt.width !== cw || rt.height !== ch) { if (rt) rt.dispose(); rt = new THREE.WebGLRenderTarget(cw, ch, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false }); }
    paintAtlas(cp); cells.set(cw, ch); res.set(W, H); U.uCellPx.value = cp; U.tCells.value = rt.texture;
    renderer.setRenderTarget(rt); renderer.render(cScene, quadCam); renderer.setRenderTarget(null);
  }

  // ---------- the soft things, in strokes; sparkles in the dark ----------
  const hashN = (a, b = 0, c = 0) => { let q = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  function draw(fx, v) {
    const { toS, cam, cssW, cssH, kai, dead, flakes, deaths, tracers, t, night, WIND } = v, s = cam.ppm * FIGM, L = (x0, y0, x1, y1) => { fx.moveTo(x0, y0); fx.lineTo(x1, y1); };
    fx.lineCap = 'round';
    // Kai's tied sleeves and bandana tails: bundles of thin strands that trail with her walk and the wind
    { const [x, y] = toS(kai.x, kai.y), a = kai.face, ca = Math.cos(a), sa = Math.sin(a), P = (lx, ly) => [x + (lx * ca - ly * sa) * s, y + (lx * sa + ly * ca) * s], mv = Math.min(1, Math.hypot(kai.vx, kai.vy) / 3);
      const strand = (lx, ly, len, col, k, w) => { fx.strokeStyle = col; fx.lineWidth = w; fx.beginPath(); for (let i = 0; i < k; i++) { const [x0, y0] = P(lx, ly + (i - k / 2) * 0.012), wob = Math.sin(t * 7 + i * 1.7 + lx * 9) * 0.05 * (0.4 + mv); let px = x0, py = y0; fx.moveTo(px, py); for (let j = 1; j <= 4; j++) { const u = j / 4, [qx, qy] = P(lx - len * u, ly + (i - k / 2) * 0.02 * u + wob * u * u * 2); px = qx + WIND.x * u * 3 * (1 - mv); py = qy + WIND.y * u * 3 * (1 - mv); fx.lineTo(px, py); } } fx.stroke(); };
      for (const sd of [-1, 1]) strand(-0.1, sd * 0.17, 0.26 + 0.04 * Math.sin(t * 5 + sd), '#d9a01c', 5, Math.max(1, s * 0.012));
      for (const sd of [-1, 1]) strand(-0.06, sd * 0.03, 0.22, '#e8392f', 4, Math.max(1, s * 0.01)); }
    // shed ash off the dead, embers rising off the awake ones at night
    fx.strokeStyle = '#2a2624'; fx.lineWidth = 1.1;
    for (const f of flakes) { const k = (t - f.t0) / 2.6; if (k > 1) continue; const [X, Y] = toS(f.x + WIND.x * k * 2.4, f.y + WIND.y * k * 2.4); if (X < -10 || Y < -10 || X > cssW + 10 || Y > cssH + 10) continue; const l = 0.14 * s * (1 - k * 0.5); fx.globalAlpha = (1 - k) * 0.85; fx.beginPath(); L(X, Y, X + Math.cos(f.a) * l, Y + Math.sin(f.a) * l); fx.stroke(); }
    fx.globalAlpha = 1;
    if (night > 0.3) { fx.fillStyle = '#ffb060'; for (const d of dead) { const [x, y] = toS(d.x, d.y); if (x < -20 || y < -20 || x > cssW + 20 || y > cssH + 20) continue; for (let i = 0; i < 3; i++) { const k = (t * 0.7 + hashN(d.id, i)) % 1; fx.globalAlpha = (1 - k) * night; fx.fillRect(x + (hashN(d.id, i, 2) - 0.5) * 0.5 * s + WIND.x * k * 10, y - k * 0.9 * s + WIND.y * k * 10, 1.6, 1.6); } } fx.globalAlpha = 1; }
    // a fall: the glyphs come apart and drift off as ash
    fx.font = `700 ${Math.max(7, Math.round(0.14 * s))}px "IBM Plex Mono", ui-monospace, monospace`; fx.textAlign = 'center'; fx.textBaseline = 'middle';
    for (const D of deaths) { const k = (t - D.t0) / 2.1; if (k > 1) continue; const [x, y] = toS(D.x, D.y);
      for (let i = 0; i < 26; i++) { const a = hashN(D.id, i) * 6.283, r = (1 - (1 - Math.min(1, k * 2)) ** 2) * (0.25 + hashN(D.id, i, 1) * 0.8) * s; fx.globalAlpha = 1 - k; fx.fillStyle = i % 4 === 0 && k < 0.5 ? '#ffa04a' : '#cfc9bc'; fx.fillText(k < 0.4 ? '#%@*'[i % 4] : k < 0.7 ? '+:'[i % 2] : '.,'[i % 2], x + Math.cos(a) * r + WIND.x * k * 12, y + Math.sin(a) * r + WIND.y * k * 12); } }
    fx.globalAlpha = 1;
    fx.strokeStyle = 'rgba(255,236,200,.9)'; fx.lineWidth = 1.2; fx.beginPath(); for (const T of tracers) { const [a, b] = toS(T.x0, T.y0), [c, d] = toS(T.x1, T.y1); L(a, b, c, d); } fx.stroke();
    // sparkles: a few glyphs adrift in the air, pale, one in eight warm
    fx.font = '600 9px "IBM Plex Mono", ui-monospace, monospace';
    for (let i = 0; i < 60; i++) { const sp = 0.3 + hashN(i, 7) * 0.6, x = (hashN(i, 1) * cssW + t * 9 * sp * WIND.x) % (cssW + 20) - 10, y = (hashN(i, 2) * cssH + t * 9 * sp * WIND.y) % (cssH + 20) - 10, tw = 0.5 + 0.5 * Math.sin(t * (1.5 + hashN(i, 3) * 2) + i);
      fx.globalAlpha = (0.25 + 0.55 * tw) * (0.6 + 0.4 * night); fx.fillStyle = i % 8 === 0 ? '#e8c060' : '#e9e6dc'; fx.fillText('*o·*·8·°'[i % 8], x, y); }

    // ---------- zoomed out: each thing becomes one letter on a dark plate, a fixed size on screen (the roguelike map) ----------
    // far 0 at the close camera, 1 when a figure would be a couple of cells. Amber rings are yours, ember red is the dead.
    const far = Math.max(0, Math.min(1, (13.5 - cam.ppm) / 5));
    if (far > 0.01) {
      const { turrets = [], rig = null } = v, onS = (x, y) => x > -30 && y > -30 && x < cssW + 30 && y < cssH + 30;
      const plate = (x, y, r, ring, ch, col, px, a) => { fx.globalAlpha = a; fx.fillStyle = 'rgba(10,11,13,.86)'; fx.beginPath(); fx.arc(x, y, r, 0, 7); fx.fill(); fx.strokeStyle = ring; fx.lineWidth = 2; fx.stroke();
        fx.fillStyle = col; fx.font = `700 ${px}px "IBM Plex Mono", ui-monospace, monospace`; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(ch, x, y + 0.5); };
      // turrets: their reach, faintly, then a T on an amber ring (a flash in the ring when it fires)
      fx.setLineDash([3, 5]); fx.lineWidth = 1; fx.strokeStyle = `rgba(240,180,76,${0.28 * far})`; for (const T of turrets) { const [x, y] = toS(T.x, T.y); fx.beginPath(); fx.arc(x, y, 15 * cam.ppm, 0, 7); fx.stroke(); } fx.setLineDash([]);
      for (const T of turrets) { const [x, y] = toS(T.x, T.y); if (!onS(x, y)) continue; const hot = T.shotT !== undefined && t - T.shotT < 0.1; plate(x, y, 10, hot ? '#fff2c8' : '#f0b44c', 'T', '#f6e7c8', 13, far); }
      // Hilde: a long plate with her name
      if (rig) { const [x, y] = toS(rig.x, rig.y); if (onS(x, y)) { fx.globalAlpha = far; fx.font = '700 11px "IBM Plex Mono", ui-monospace, monospace'; const w = fx.measureText('HILDE').width + 16;
        fx.fillStyle = 'rgba(10,11,13,.86)'; fx.beginPath(); fx.roundRect(x - w / 2, y - 10, w, 20, 6); fx.fill(); fx.strokeStyle = '#f0b44c'; fx.lineWidth = 2; fx.stroke(); fx.fillStyle = '#f0b44c'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText('HILDE', x, y + 0.5); } }
      // the dead: an ember & with a dark edge, no plate (a horde stays a horde, not a pile of discs); a Brute bigger
      fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.lineJoin = 'round';
      for (const d of dead) { const [x, y] = toS(d.x, d.y); if (!onS(x, y)) continue; const big = (d.kind || (d.id % 9 === 0 ? 'brute' : '')) === 'brute', px = big ? 19 : 14, hit = t - d.hit < 0.1;
        fx.globalAlpha = far; fx.font = `800 ${px}px "IBM Plex Mono", ui-monospace, monospace`; fx.strokeStyle = 'rgba(8,8,10,.9)'; fx.lineWidth = 4; fx.strokeText('&', x, y); fx.fillStyle = hit ? '#ffffff' : night > 0.5 ? '#ff7a2a' : '#e8553a'; fx.fillText('&', x, y); }
      // Kai: an @ on an amber ring, with a tick for where she faces
      { const [x, y] = toS(kai.x, kai.y); plate(x, y, 12, '#f0b44c', '@', '#ffd36a', 17, far); fx.strokeStyle = '#f0b44c'; fx.lineWidth = 2.5; fx.beginPath(); fx.moveTo(x + Math.cos(kai.face) * 13, y + Math.sin(kai.face) * 13); fx.lineTo(x + Math.cos(kai.face) * 19, y + Math.sin(kai.face) * 19); fx.stroke(); }
      fx.globalAlpha = 1;
    }
  }
  return { material, render, draw, kaiVolumes, deadVolumes, rigVolumes, turretVolumes };
}
