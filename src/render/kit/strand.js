// [medium] The Strand atom: one GLSL feature for everything combed. A field of short strokes seeded on a turned,
// jittered lattice and drawn as a line integral along a flow direction, so neighbouring strokes curve together like
// combed hair. The same function makes grass (flow = the wind), tree crowns (flow = round the crown), hair and tails
// (flow = behind the head), tentacles (flow = out of a nest, longer and thicker) or water (flow = the current).
// Its knobs: the flow, the seed density (strokes a metre: coarsened with the pixel size so they never alias into
// lines when zoomed out), the stroke length, and the press (trodden strands lie short and dark).
//   strand(w, dir, fq, len) → vec2(coverage 0..1, how far along the stroke 0 root … 1 tip)
//   strandWind(w, t) → the wind's flow at w (gusts roll across), strandGust(w, t) → the gust's strength there
export const STRAND = `
  float sHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float sNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sHash(i), sHash(i + vec2(1, 0)), f.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), f.x), f.y); }
  const vec2 S_WIND = vec2(0.731, -0.682);   // world xz: east and a little north, the town's prevailing wind
  float strandGust(vec2 w, float t){ return smoothstep(0.3, 0.85, sNoise(w * 0.045 - S_WIND * t * 0.55) * 0.7 + sNoise(w * 0.12 - S_WIND * t * 0.95) * 0.3); }
  vec2 strandWind(vec2 w, float t){ float th = atan(S_WIND.y, S_WIND.x) + 2.4 * (sNoise(w * 0.05 + vec2(t * 0.01, 0.0)) - 0.5) + 1.1 * (sNoise(w * 0.21) - 0.5) + (strandGust(w, t) - 0.4) * 0.6; return vec2(cos(th), sin(th)); }
  vec2 strand(vec2 w, vec2 dir, float fq, float len){
    float stepL = len / 16.0, acc = 0.0, tip = 0.0;
    for (int k = -8; k <= 8; k++) { float fk = float(k); vec2 q = mat2(0.866, 0.5, -0.5, 0.866) * (w + dir * fk * stepL);
      float sd = step(0.8, sHash(floor(q * fq + vec2(sHash(vec2(floor(q.y * fq), 3.0)), 0.0)))); acc += sd; tip += sd * (fk + 8.0) / 16.0; }
    return vec2(clamp(acc / 3.4, 0.0, 1.0), clamp(tip / max(acc, 1e-3), 0.0, 1.0)); }
`;
