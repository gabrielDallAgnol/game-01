// [roam] How the gardens look (their layout is src/roam/gardens.js): text swaps on the ground shader, run by createMedium.
// Gravel paths and trodden earth, dug beds thick with flowering clumps (the plants' own clump(), smaller and closer),
// hedges as combed strands like the crowns, a picket fence as a row of letters like the roofs, and the overgrown plot
// gone to big bush. Only pixels inside a plot (tMisc.b) do any of this work.
const MAIN = '      void main(){ vec2 w = world(), t = toTex(w); float g0 = gust(w);';
const NIGHT = '        col *= mix(vec3(1.0), vec3(0.33, 0.35, 0.40), uNight);';

export function gardenLook(swap, NG) {
  swap(MAIN, `      // [garden] a bed's flowers: yellow, white, pink, lavender, red, marigold
      vec3 gHue(float x){ return x < 0.18 ? vec3(0.95, 0.82, 0.28) : x < 0.34 ? vec3(0.93, 0.92, 0.86) : x < 0.5 ? vec3(0.92, 0.48, 0.58) : x < 0.64 ? vec3(0.68, 0.55, 0.9) : x < 0.8 ? vec3(0.9, 0.32, 0.27) : vec3(0.96, 0.62, 0.3); }
${MAIN}`);
  swap(NIGHT, `        // [garden] begin: the kind is in the plot's own value (strip .25, hedged .5, fenced .75, wild 1)
        if (ms.b > 0.02 && ground > 0.5) {
          float gk = ms.b, wildG = step(0.875, gk), fenceG = step(0.625, gk) * (1.0 - wildG), hedgeG = step(0.375, gk) * (1.0 - fenceG);
          vec4 gh = texture2D(tTreeH, t); float grow = gh.g, bord = gh.b, gpath = texture2D(tLight, t).b, gsh = mix(1.0, 0.6, shadow);
          // paths: gravel by the house, trodden earth between the rows
          if (gpath > 0.01) { float gf = min(14.0, uPpm * 0.45); vec3 grav = mix(vec3(0.33, 0.31, 0.28), vec3(0.55, 0.53, 0.48), h21(floor(w * gf))) * (0.88 + 0.24 * vnoise(w * 1.3));
            float hard = smoothstep(0.62, 0.9, gpath), worn = smoothstep(0.08, 0.4, gpath + (vnoise(w * 3.3) - 0.5) * 0.25 * (1.0 - hard));
            grav = mix(vec3(0.25, 0.22, 0.17) * (0.8 + 0.4 * vnoise(w * 2.3)), grav, hard); col = mix(col, grav * gsh * mix(1.0, 0.7, pressHere), worn * mix(0.7, 1.0, hard)); }
          // beds: dug soil, a dark lip at the lawn
          float gn = grow + (vnoise(w * 2.6) - 0.5) * 0.3 * step(0.3, grow), bed = smoothstep(0.62, 0.85, gn) * (1.0 - wildG);   // ragged edges: dug by hand
          if (bed > 0.0) { vec3 soil = vec3(0.14, 0.105, 0.08) * (0.8 + 0.35 * vnoise(w * 3.1)) + vec3(0.035) * h21(floor(w * min(12.0, uPpm * 0.4))); col = mix(col, soil * gsh, bed * 0.85); }
          col = mix(col, vec3(0.05, 0.045, 0.035), (1.0 - smoothstep(0.0, 0.12, abs(gn - 0.6))) * 0.4 * (1.0 - wildG));
          // the plants: clumps on a close lattice (the four nearest cells), many in the bed's colour, a few odd ones out
          { float gc = mix(0.95, 1.9, wildG); vec2 gb = floor(w / gc - 0.5);
            for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) { vec2 cid = gb + vec2(float(i), float(j)), rr = h22(cid + 5.3), ctr = (cid + 0.3 + 0.4 * rr) * gc;
              float gr = texture2D(tTreeH, toTex(ctr)).g, pr = wildG > 0.5 ? 0.8 * step(0.3, gr) : gr > 0.75 ? 0.92 : gr > 0.3 ? 0.13 : 0.0;
              if (h21(cid + 8.2) >= pr) continue;
              ctr += WD * (gust(ctr) - 0.35) * 0.18;
              float R0 = wildG > 0.5 ? 0.75 + 0.5 * rr.x : gr > 0.75 ? 0.38 + 0.24 * rr.x : 0.5 + 0.3 * rr.x, fl = h21(cid + 2.3), hb = h21(floor(ctr / 3.2) + 1.7);
              float hue = h21(cid + 6.1) < 0.22 ? h21(cid + 4.4) : hb, bl = wildG > 0.5 ? step(fl, 0.35) : gr > 0.75 ? step(fl, 0.86) : step(fl, 0.4);
              col = clump(col, w, ctr, R0, rr, cid, bl, gHue(wildG > 0.5 ? hue * 0.5 : hue), clamp(R0 * 1.25, 0.6, 1.0), g0, pressHere); } }
          // borders throw a short shadow away from the sun
          { float sl = min(1.4, mix(0.9, 0.45, fenceG) / max(0.3, uSun.z)); float bs = texture2D(tTreeH, toTex(w + SUNV * sl)).b;
            col *= 1.0 - mix(0.45, 0.3, fenceG) * smoothstep(0.2, 0.7, bs) * (1.0 - smoothstep(0.2, 0.6, bord)) * mix(1.0, 0.5, uNight); }
          if (bord > 0.02 && hedgeG > 0.5) {
            // a hedge: a low ridge of combed strands, lit on its sun side, dark at the rim
            float e = 0.2, bx = texture2D(tTreeH, toTex(w + vec2(e, 0.0))).b - texture2D(tTreeH, toTex(w - vec2(e, 0.0))).b, by = texture2D(tTreeH, toTex(w + vec2(0.0, e))).b - texture2D(tTreeH, toTex(w - vec2(0.0, e))).b;
            float rag = wildG * (vnoise(w * 2.2) - 0.5) * 0.5, hh = smoothstep(0.15 + rag, 0.7 + rag, bord);
            vec3 hn = normalize(vec3(-bx, -by, 0.75)); float hl = clamp(dot(hn, normalize(vec3(SUNV, max(0.3, uSun.z)))), 0.0, 1.0);
            vec2 hd = normalize(normalize(vec2(-by, bx) + 1e-4) + (vec2(vnoise(w * 0.9), vnoise(w * 0.9 + 7.0)) - 0.5) * 1.4 + WD * (g0 - 0.3) * 0.4);
            float fq = clamp(uGrid * 0.5, 4.0, 24.0), stp = 0.03 * (20.0 / fq), acc = 0.0, tip = 0.0;
            for (int k = -5; k <= 5; k++) { float fk = float(k); vec2 q = mat2(0.866, 0.5, -0.5, 0.866) * (w + hd * fk * stp); float s = step(0.78, h21(floor(q * fq + vec2(h21(vec2(floor(q.y * fq), 5.0)), 0.0)))); acc += s; tip += s * (fk + 5.0) / 10.0; }
            float hair = smoothstep(0.1, 0.6, clamp(acc / 3.0, 0.0, 1.0)), hlt = clamp(tip / max(acc, 1e-3), 0.0, 1.0);
            vec3 hc = mix(vec3(0.05, 0.075, 0.05), vec3(0.38, 0.5, 0.32), hl * (0.55 + 0.45 * hlt)) * (0.85 + 0.25 * g0);
            hc = mix(hc, vec3(0.3, 0.33, 0.22) * (0.6 + 0.6 * hl), wildG * 0.35);
            col = mix(col, mix(hc * 0.6, hc, hair) * gsh, hh);
            col = mix(col, vec3(0.03, 0.04, 0.03), (1.0 - smoothstep(0.12, 0.3, bord + rag)) * smoothstep(0.03, 0.12, bord) * 0.75);
          } else if (bord > 0.02 && fenceG > 0.5) {
            // a picket fence: near, a row of pale letters in the solids' cells; far, a plain pale line
            vec2 cp = (gl_FragCoord.xy + uCellOff) / uCellPx, gq = fract(cp), dc = (floor(cp) + 0.5) * uCellPx - (gl_FragCoord.xy + uCellOff); float fc0 = texture2D(tTreeH, toTex(w + vec2(dc.x, -dc.y) / uPpm)).b;
            float near = smoothstep(9.0, 14.0, uPpm), rl = 0.62 + 0.36 * h21(floor(cp) + 2.9);
            float glev = floor(pow(rl, 0.6) * ${NG}.0), gm = mix(0.14 + 0.62 * glev / ${NG - 1}.0, texture2D(tGlyph, vec2((glev + gq.x) / ${NG}.0, gq.y)).a, smoothstep(2.4, 4.6, uCellPx));
            vec3 fcl = vec3(0.9, 0.87, 0.78) * gsh;
            col = mix(col, mix(fcl * 0.14, fcl, gm), step(mix(0.3, 0.5, smoothstep(14.0, 30.0, uPpm)), fc0) * near);
            col = mix(col, fcl * 0.62, smoothstep(0.1, 0.5, bord) * 0.75 * (1.0 - near));
          }
        }
        // [garden] end
${NIGHT}`);
}
