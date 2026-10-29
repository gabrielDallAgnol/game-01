// [roam] The ground's shaders (the One-medium look, from the Looks Lab): HEAD holds the shared helpers and uniforms,
// GROUND is the town's ground (grass blades, hard streets with dust and cracks, setts, lit crowns, roofs, cast shadows,
// the night), and DIST the disturbance field (what parts the grass and where feet pressed it). src/roam/medium.js
// builds on GROUND (hair grass, glyph roofs and solids). NS: the stamps a frame.
export const NS = 48;
export const HEAD = `precision highp float; varying vec2 vUv;
    uniform sampler2D tDist, tRoof, tStreet, tMisc, tTreeH; uniform vec2 uCam, uView, uOrigin, uKai, uFire, uWorld; uniform float uS, uTime, uPpm, uNight, uGrid; uniform vec4 uSun;   // uSun: the way to the sun (xy), the ray's climb a metre (z), the dawn/dusk warmth (w); uGrid: the zoom the grass's seeds are laid for (steps, not every frame)
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec2 h22(vec2 p){ float a = h21(p); return vec2(a, h21(p + a * 17.7 + 3.1)); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    vec2 world(){ return uCam + vec2(vUv.x - 0.5, 0.5 - vUv.y) * uView; }
    // the data maps are streamed tiles in a ring (src/roam/tiles.js), sampled with repeat wrapping: world metres / the ring's span
    vec2 toTex(vec2 w){ return (w - uOrigin) / uS; }
    float inside(vec2 t){ vec2 w = t * uS + uOrigin, e = smoothstep(0.0, 8.0, w) * smoothstep(0.0, 8.0, uWorld - w); return e.x * e.y; }
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }`;
export const GROUND = `float lines(float v, float sp, float wd){ float f = abs(fract(v / sp) - 0.5) * sp; return 1.0 - smoothstep(wd, wd + 1.0 / uPpm, f); }
      const vec2 WD = vec2(0.731, 0.682);
#define SUNV (uSun.xy)

      float gust(vec2 p){ return smoothstep(0.3, 0.85, vnoise(p * 0.045 - WD * uTime * 0.55) * 0.7 + vnoise(p * 0.12 - WD * uTime * 0.95) * 0.3); }
      vec2 voro(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), r = g + h22(i + g) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return vec2(sqrt(d1), sqrt(d2)); }
      float treeH(vec2 p){ return texture2D(tTreeH, toTex(p)).r; }
      void main(){ vec2 w = world(), t = toTex(w); float g0 = gust(w);
        // the crown sways with the gusts: tree lookups come from upwind
        float h0 = treeH(w); vec2 sway = WD * ((g0 - 0.3) * 0.6 + 0.08 * sin(uTime * 1.7 + w.x * 0.3)) * smoothstep(0.0, 0.25, h0 + 0.15);
        vec2 tw = w - sway;
        vec4 rf = texture2D(tRoof, t), sx = texture2D(tStreet, t); vec3 ms = texture2D(tMisc, t).rgb; float treeM = texture2D(tMisc, toTex(tw)).r, th = treeH(tw);
        float roof = smoothstep(0.35, 0.65, rf.a), tree = smoothstep(0.3, 0.7, treeM) * (1.0 - roof), street = smoothstep(0.35, 0.65, sx.a) * (1.0 - roof) * (1.0 - tree), ground = (1.0 - roof) * (1.0 - tree) * (1.0 - street);
        float inward = sx.b, lit = rf.g, flatRoof = step(rf.b, 0.5), edgeLine = 0.0;
        float side = lit; { vec2 ax = vec2(cos(rf.r * 3.14159), sin(rf.r * 3.14159)) * (side * 2.0 - 1.0); lit = flatRoof > 0.5 ? lit : smoothstep(0.2, 0.98, dot(normalize(vec3(ax * 0.62, 0.78)), normalize(vec3(SUNV, uSun.z)))); }   // a slope lit by where the sun is now
        // cast shadows from the sun where it is now: walk toward it and ask whether a roof (6 m) or a crown (3–7 m) stands above the ray
        float bShadow = 0.0, tShadow = 0.0; { float clim = max(0.12, uSun.z), D = min(6.0 / clim, 18.0), Dt = min(7.0 / clim, 14.0);
          float jt = h21(gl_FragCoord.xy * 0.37);   // a jittered start: few taps, no banding
          for (int k = 0; k < 6; k++) { float d = D * (float(k) + jt) / 6.0; bShadow = max(bShadow, smoothstep(0.4, 0.7, texture2D(tRoof, toTex(w + SUNV * d)).a) * step(d * clim, 6.0)); }
          for (int k = 0; k < 4; k++) { float d = Dt * (float(k) + jt) / 4.0, hh = treeH(w + SUNV * d - sway * 0.7); tShadow = max(tShadow, smoothstep(0.03, 0.2, hh) * smoothstep(-0.6, 0.6, 3.0 + 4.0 * hh - d * clim)); } }
        tShadow *= 1.0 - tree;
        float shadow = max(bShadow, tShadow) * (1.0 - roof) * mix(1.0, 0.55, uNight);   // the buildings' cast shadows (the static tree ones are ash2's), and the crowns' own, swaying
        vec4 dP = texture2D(tDist, t); float pressHere = dP.b * (1.0 - roof);
        // grounds
        float mott = vnoise(w * 0.35) * 0.06 + vnoise(w * 2.1) * 0.03;
        vec3 earth = vec3(0.17, 0.175, 0.155) + mott;
        vec3 asph = vec3(0.155, 0.16, 0.168) + (h21(floor(w * 9.0)) - 0.5) * 0.025;
        vec2 v = voro(w / 1.9); float crack = (1.0 - smoothstep(0.012, 0.035, v.y - v.x)) * smoothstep(0.56, 0.7, vnoise(w * 0.18 + 9.0));
        asph = mix(asph, asph * 0.4, crack); asph = mix(asph, vec3(0.24, 0.29, 0.21), crack * 0.35 * (1.0 - inward));
        float dust = smoothstep(0.45, 0.85, vnoise(w * 2.4) * 0.6 + vnoise(w * 0.5) * 0.4) * mix(1.0, 0.25, inward) * (1.0 - pressHere * 0.95);
        asph = mix(asph, vec3(0.56, 0.55, 0.52), dust * 0.55); asph = mix(asph, asph * 0.55, pressHere * 0.8 * (1.0 - dust * 0.3));
        float setts = 1.0 - smoothstep(0.06, 0.12, abs(sx.g - 0.784));
        vec2 vs = voro(w / 0.6); float grout = (1.0 - smoothstep(0.03, 0.08, vs.y - vs.x)) * smoothstep(5.0, 11.0, 0.6 * uPpm); vec3 stone = vec3(0.29, 0.285, 0.275) + (vnoise(w * 1.3) - 0.5) * 0.05;
        stone = mix(stone, vec3(0.20, 0.205, 0.195), grout * 0.4); stone = mix(stone, vec3(0.56, 0.55, 0.52), dust * 0.5); stone = mix(stone, stone * 0.55, pressHere * 0.8);
        asph = mix(asph, stone, setts);
        asph = mix(asph, vec3(0.78, 0.76, 0.68), ms.g * 0.7 * (0.5 + 0.5 * vnoise(w * 1.7)) * (1.0 - setts));
        // pavements: the street's outer metre and a half is slabs (fine joints along and across the street), a pale kerb
        // stone where the slabs meet the road, and a fine dark-and-light edge where the grass meets the pavement
        { float walk = street * (1.0 - smoothstep(0.44, 0.52, inward)) * step(sx.g, 0.6) + street * step(0.25, sx.g) * (1.0 - step(0.5, sx.g)) * 0.0;
          float footpath = street * (1.0 - smoothstep(0.3, 0.4, sx.g)) * step(0.2, sx.g);
          walk = max(street * (1.0 - smoothstep(0.44, 0.52, inward)) * (1.0 - setts), footpath);
          float sa2 = sx.r * 3.14159; vec2 Sd = vec2(cos(sa2), sin(sa2)), Sp = vec2(-Sd.y, Sd.x); float lw = max(0.018, 0.55 / uPpm);
          float joint = max(lines(dot(w, Sd), 1.1, lw), lines(dot(w, Sp) + 0.3, 0.75, lw) * 0.0 + lines(dot(w, Sp), 1.5, lw) * 0.6);
          vec3 slab = vec3(0.27, 0.27, 0.265) + (h21(floor(vec2(dot(w, Sd) / 1.1, dot(w, Sp) / 1.5))) - 0.5) * 0.035; slab = mix(slab, vec3(0.13, 0.135, 0.13), joint * 0.85);
          slab = mix(slab, vec3(0.5, 0.49, 0.46), dust * 0.4); slab = mix(slab, slab * 0.55, pressHere * 0.8);
          asph = mix(asph, slab, walk);
          float kerb = street * (1.0 - setts) * step(0.6, sx.g) * (1.0 - smoothstep(0.0, 0.05, abs(inward - 0.48)));   // where the slabs meet the road
          asph = mix(asph, vec3(0.62, 0.61, 0.57), kerb * 0.85);
          edgeLine = 1.0 - smoothstep(0.0, 0.1, abs(sx.a - 0.5)); }
        // the dome of a tree, lit from the sun's side
        float e = 0.35, gx = treeH(tw + vec2(e, 0.0)) - treeH(tw - vec2(e, 0.0)), gy = treeH(tw + vec2(0.0, e)) - treeH(tw - vec2(0.0, e));
        vec3 nrm = normalize(vec3(-gx * 3.0, -gy * 3.0, 1.0)); float tl = clamp(dot(nrm, normalize(vec3(SUNV, max(0.3, uSun.z)))), 0.0, 1.0);
        vec3 canopy = mix(vec3(0.07, 0.085, 0.07), vec3(0.30, 0.345, 0.27), tl) * (0.75 + 0.45 * th);
        vec3 roofC = mix(mix(vec3(0.16, 0.16, 0.17), vec3(0.42, 0.415, 0.40), lit), vec3(0.30, 0.30, 0.31), flatRoof);
        vec3 base = earth * ground + asph * street + canopy * tree + roofC * roof;
        // strokes: blades on open ground and at the kerb, engraving on roofs, leaves on crowns
        float c = max(0.52, 6.5 / uGrid), wid = max(0.022, 0.5 / uPpm), aa = 1.0 / uPpm;
        float kerbWeeds = street * (1.0 - smoothstep(0.12, 0.3, inward)) + street * crack * 0.6;
        vec2 tang = normalize(vec2(-gy, gx) + 1e-5);
        vec2 cell = floor(w / c); float best = 0.0; vec3 sc = vec3(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 id = cell + vec2(float(i), float(j)), r = h22(id); float jit = mix(0.8, 0.14, roof);
          vec2 ctr = (id + 0.5 - jit * 0.5 + jit * r) * c;
          vec4 d = texture2D(tDist, toTex(ctr)); vec2 push = (d.rg - 0.5) * 2.0; float press = d.b;
          float m = 0.0; vec3 col = vec3(0.0); vec2 a, b;
          if (roof > 0.5) {
            vec2 dir = vec2(cos(rf.r * 3.14159), sin(rf.r * 3.14159)); a = ctr - dir * c * 0.58; b = ctr + dir * c * 0.58;
            col = flatRoof > 0.5 ? mix(vec3(0.52), vec3(0.62), r.y) : mix(mix(vec3(0.30, 0.30, 0.31), vec3(0.40, 0.40, 0.41), r.y), mix(vec3(0.72, 0.71, 0.68), vec3(0.88, 0.86, 0.81), r.y), lit);
            m = 1.0;
          } else if (tree > 0.5) {
            float flick = gust(ctr); vec2 dir = normalize(tang + WD * (flick - 0.3) * 0.8 + (r - 0.5) * 0.9); a = ctr - dir * c * 0.32; b = ctr + dir * c * 0.32;
            col = mix(vec3(0.14, 0.17, 0.13), vec3(0.50, 0.56, 0.42), tl * (0.6 + 0.4 * r.y)) + vec3(0.12, 0.13, 0.08) * flick * tl;
            m = step(0.12, r.x);
          } else {
            float grassK = ground * mix(0.25, 0.95, smoothstep(0.25, 0.75, vnoise(ctr * 0.08 + 3.7))) + kerbWeeds * 0.85;
            float gl = gust(ctr), lean = atan(WD.y, WD.x) + (vnoise(ctr * 0.21) - 0.5) * 1.6 + (r.x - 0.5) * 0.7;
            vec2 dir = normalize(mix(vec2(cos(lean), sin(lean)), WD, gl * 0.6)); float pl = length(push); if (pl > 0.02) dir = normalize(mix(dir, push / pl, clamp(pl * 1.6, 0.0, 1.0)));
            float len = c * (0.72 + 0.26 * r.y) * mix(1.0, 0.78, gl) * mix(1.0, 0.3, press) * mix(1.0, 0.55, street);
            a = ctr; b = ctr + dir * len;
            vec3 tip = mix(vec3(0.52, 0.56, 0.46), vec3(0.78, 0.78, 0.68), r.y) + vec3(0.12, 0.12, 0.09) * gl;
            col = tip * mix(0.85, 1.0, r.x) * mix(1.0, 0.6, press);
            m = step(1.0 - grassK, h21(id + 7.31));
          }
          vec2 pa = w - a, ba = b - a; float q = clamp(dot(pa, ba) / max(1e-5, dot(ba, ba)), 0.0, 1.0); float dd = length(pa - ba * q);
          float wd = roof > 0.5 ? wid * 1.25 : tree > 0.5 ? wid * 1.3 : wid * mix(1.5, 0.5, q);
          float cov = m * (1.0 - smoothstep(wd, wd + aa, dd));
          if (roof < 0.5 && tree < 0.5) col = mix(col * 0.45, col, smoothstep(0.0, 0.7, q));   // a blade darkens to its root
          if (cov > best) { best = cov; sc = col; }
        }
        // shadow: darker, cross-hatched; ridges and eaves on roofs, a dark rim round a crown
        float hs = max(0.3, 3.6 / uPpm), xh = max(lines(w.x - w.y, hs, wid * 0.7), lines(w.x + w.y, hs, wid * 0.7) * step(0.55, shadow));
        base = mix(base, base * 0.5, shadow * 0.6); base = mix(base, base * 0.35, xh * shadow * (1.0 - street * 0.5));
        float alpha = best * (roof * 0.8 + tree * 0.85 + (1.0 - roof - tree) * 0.9) * (1.0 - shadow * 0.4);
        vec3 col = mix(base, sc * mix(1.0, 0.6, shadow), alpha);
        float ridge = roof * (1.0 - flatRoof) * (1.0 - smoothstep(0.1, 0.25, abs(side - 0.5))), eave = roof * (1.0 - smoothstep(0.6, 0.97, rf.a));
        col = mix(col, vec3(0.06), max(ridge * 0.9, eave * 0.75));
        col = mix(col, vec3(0.04, 0.05, 0.04), (1.0 - smoothstep(0.25, 0.75, treeM)) * smoothstep(0.05, 0.25, treeM) * 0.9 * (1.0 - roof));
        col = mix(col, vec3(0.05, 0.055, 0.05), edgeLine * 0.8 * (1.0 - roof)); col = mix(col, vec3(0.55, 0.54, 0.5), (1.0 - smoothstep(0.0, 0.05, abs(sx.a - 0.62))) * 0.6 * (1.0 - roof) * (1.0 - tree));   // grass | pavement: a dark line, a pale lip
        col *= mix(vec3(1.0), vec3(0.33, 0.35, 0.40), uNight);
        float lamp = exp(-dot(w - uKai, w - uKai) / mix(5.0, 20.0, uNight)) * mix(0.10, 0.6, uNight);
        float fire = exp(-dot(w - uFire, w - uFire) / 30.0) * mix(0.08, 0.7, uNight) * (0.88 + 0.12 * sin(uTime * 13.0) * sin(uTime * 7.3));
        col += vec3(0.62, 0.40, 0.16) * (lamp + fire) * (0.45 + 0.55 * best);
        gl_FragColor = vec4(mix(vec3(0.03), col, inside(t)), 1.0); }`;
export const DIST = `precision highp float; varying vec2 vUv;
    uniform sampler2D tPrev; uniform vec4 uA[48]; uniform vec4 uB[48]; uniform int uN; uniform float uDecayPush, uDecayPress, uS; uniform vec2 uOrigin, uCam;
    void main(){ vec4 d = texture2D(tPrev, vUv); vec2 push = (d.rg - 0.5) * 2.0; float press = d.b;
      float pl = length(push); if (pl > 0.0) push *= max(0.0, pl - uDecayPush) / pl; press = max(0.0, press - uDecayPress);
      vec2 w0 = uOrigin + vUv * uS, w = w0 + uS * floor((uCam - w0) / uS + 0.5);   // the field is a ring too: this texel's place nearest the camera
      for (int k = 0; k < 48; k++) { if (k >= uN) break; vec4 A = uA[k], B = uB[k]; vec2 dv = w - A.xy; float r = length(dv);
        if (r < B.x) { float f = 1.0 - r / B.x; vec2 o = r > 0.001 ? dv / r : vec2(0.0); float vl = length(A.zw); vec2 v = vl > 0.05 ? A.zw / vl : vec2(0.0);
          vec2 p = (o * 0.85 + v * 0.55) * min(1.0, vl / 1.2);   // only what moves parts the grass (a standing figure just presses it: no cowlick) float q = length(p); if (q > 0.001) push = mix(push, p / q * min(1.0, q), clamp(f * 0.7, 0.0, 1.0));
          press = max(press, B.y * smoothstep(0.0, 0.55, f)); } }
      gl_FragColor = vec4(push * 0.5 + 0.5, press, 1.0); }`;
