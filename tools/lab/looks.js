// Looks Lab: one Hollowmere scene, four ways of drawing it, to choose an art direction by eye on a phone.
// The town is the real engine town (recipe hollowmere), painted once round the camp; a small scripted scene runs on
// top (Kai on patrol or walked by drag, the dead walking in on the camp round the houses, two turrets, the Rig), and
// each look is a full-screen shader over the town plus a 2D layer for the figures:
//   today  · the game as it ships (flat town, red tokens, blue-rimmed guns), the baseline;
//   ash    · fallen ash as a stroke field that drifts in the wind, parts round Kai and keeps the dead's tracks;
//   system · the System's schematic: edges, hatching, a grid; machines blue, the dead red noise, Kai's ping;
//   glyph  · the dead made of letters that never hold still, coming apart into ash when they fall.
// Lab code: no sim rules here, nothing of this reaches the game until a look is chosen.
/* global THREE */
import { RECIPES, recipeRegistry, buildArea } from '../../src/engine/recipes.js';
import { paintWorld } from '../../src/engine/draw2d.js';
import { pointInObb } from '../../src/engine/geom.js';

const $ = id => document.getElementById(id);
const fail = e => { const el = $('err'); el.hidden = false; el.textContent = 'The lab could not start: ' + (e && e.message || e); };
try { start(); } catch (e) { console.error(e); fail(e); }

function start() {
  if (typeof THREE === 'undefined') throw new Error('three.js did not load (no network?)');
  // ---------- the town: built by the engine, painted once round the camp ----------
  const res = buildArea('hollowmere', 7, recipeRegistry('hollowmere'), RECIPES.hollowmere.game), W = res.W;
  const rigAtom = W.placed.find(p => p.def.tags.includes('camp.rig'));
  const camp = { x: W.camp.x, y: W.camp.y };
  const SPAN = 200, PX = 8, RES = SPAN * PX, O = { x: camp.x - SPAN / 2, y: camp.y - SPAN / 2 };
  const Wpaint = { ...W, placed: W.placed.filter(p => p !== rigAtom) };
  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = RES; const x = c.getContext('2d'); x.setTransform(PX, 0, 0, PX, -O.x * PX, -O.y * PX); return [c, x]; };
  const [gC, gX] = canvas(), [oC, oX] = canvas(), [mC, mX] = canvas();
  const R = { x0: O.x, y0: O.y, x1: O.x + SPAN, y1: O.y + SPAN };
  for (const x of [gX, oX]) { x.save(); x.beginPath(); x.rect(R.x0, R.y0, SPAN, SPAN); x.clip(); }
  paintWorld(gX, oX, Wpaint, 'ch1', R);
  for (const x of [gX, oX]) x.restore();
  gX.setTransform(1, 0, 0, 1, 0, 0); gX.drawImage(oC, 0, 0);   // the town: ground and roofs in one picture
  const obb = (x, p, pad) => { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillRect(-p.w / 2 - pad, -p.h / 2 - pad, p.w + 2 * pad, p.h + 2 * pad); x.restore(); };
  const near = p => Math.abs(p.x - camp.x) < SPAN / 2 + 10 && Math.abs(p.y - camp.y) < SPAN / 2 + 10;
  const machines = W.placed.filter(p => near(p) && (p.def.tags.includes('car') || p.def.tags.includes('railcar')));
  mX.fillStyle = '#fff'; for (const p of machines) obb(mX, p, 0.25);
  // where the dead cannot walk: buildings, at 2 cells a metre
  const GR = 2, GN = SPAN * GR, solid = new Uint8Array(GN * GN);
  for (const p of W.placed) if (near(p) && p.def.kind === 'building' && p !== rigAtom) {
    const r = Math.hypot(p.w, p.h) / 2 + 0.5, gx0 = Math.max(0, Math.floor((p.x - r - O.x) * GR)), gx1 = Math.min(GN - 1, Math.ceil((p.x + r - O.x) * GR)), gy0 = Math.max(0, Math.floor((p.y - r - O.y) * GR)), gy1 = Math.min(GN - 1, Math.ceil((p.y + r - O.y) * GR));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) if (pointInObb(p, O.x + (gx + 0.5) / GR, O.y + (gy + 0.5) / GR, 0.15)) solid[gy * GN + gx] = 1;
  }
  const blocked = (x, y) => { const gx = Math.floor((x - O.x) * GR), gy = Math.floor((y - O.y) * GR); return gx < 0 || gy < 0 || gx >= GN || gy >= GN || solid[gy * GN + gx] === 1; };

  // ---------- the scene: Kai, two turrets, the Rig, the dead ----------
  let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const st = { look: 'ash', t: 0, night: 0, nightOn: false, kills: 0 };
  const kai = { x: camp.x + 4, y: camp.y + 6, vx: 0, vy: 0, face: 0, cd: 0, swing: 0, patrol: 0 };
  const rig = rigAtom ? { x: rigAtom.x, y: rigAtom.y, rot: rigAtom.rot, w: Math.max(rigAtom.w, rigAtom.h), h: Math.min(rigAtom.w, rigAtom.h) } : { x: camp.x, y: camp.y, rot: 0, w: 8, h: 3 };
  const free = (x, y) => !blocked(x, y) && Math.hypot(x - rig.x, y - rig.y) > 5;
  const turrets = [[-7, -5], [7, 4], [-3, 8]].map(([dx, dy]) => { let x = camp.x + dx, y = camp.y + dy; for (let k = 0; k < 20 && !free(x, y); k++) { x += dx * 0.1; y += dy * 0.1; } return { x, y, cd: rnd(), aim: rnd() * 6 }; });
  const dead = [], deaths = [], tracers = []; let nid = 1;
  function spawn(ang, dist) {
    for (let k = 0; k < 12; k++) { const a = ang + (rnd() - 0.5) * 0.3 * k, d = dist + rnd() * 10, x = camp.x + Math.cos(a) * d, y = camp.y + Math.sin(a) * d; if (!blocked(x, y)) { dead.push({ id: nid++, x, y, vx: 0, vy: 0, hp: 4, sp: 0.95 + rnd() * 0.55, side: rnd() < 0.5 ? -1 : 1, hit: -9, ph: rnd() * 6 }); return; } }
  }
  for (let k = 0; k < 34; k++) spawn(rnd() * Math.PI * 2, 16 + rnd() * 50);
  function wave() { const a = rnd() * Math.PI * 2; for (let k = 0; k < 22; k++) spawn(a + (rnd() - 0.5) * 0.35, 60 + rnd() * 14); }
  function kill(d) { const i = dead.indexOf(d); if (i < 0) return; dead.splice(i, 1); deaths.push({ x: d.x, y: d.y, t0: st.t, id: d.id, vx: d.vx, vy: d.vy, stamp: true }); st.kills++; }
  const input = { on: false, x: 0, y: 0 };
  let spawnT = 0;
  function step(dt) {
    st.t += dt;
    st.night += ((st.nightOn ? 1 : 0) - st.night) * Math.min(1, dt * 2.5);
    if ((spawnT -= dt) <= 0) { spawnT = st.nightOn ? 0.8 : 1.6; if (dead.length < (st.nightOn ? 48 : 34)) spawn(rnd() * Math.PI * 2, 82); }
    // Kai: walked by drag, else on patrol round the camp, stepping in to the dead near her
    let tx = 0, ty = 0;
    if (input.on) { tx = input.x; ty = input.y; }
    else {
      let foe = null, fd = 7; for (const d of dead) { const r = Math.hypot(d.x - kai.x, d.y - kai.y); if (r < fd && Math.hypot(d.x - camp.x, d.y - camp.y) < 22) { fd = r; foe = d; } }
      let gx, gy; if (foe) { gx = foe.x; gy = foe.y; } else { kai.patrol += dt * 0.12; gx = camp.x + Math.cos(kai.patrol) * 11; gy = camp.y + Math.sin(kai.patrol) * 9; }
      const dx = gx - kai.x, dy = gy - kai.y, r = Math.hypot(dx, dy); if (r > 1.1) { tx = dx / r * 0.75; ty = dy / r * 0.75; }
    }
    const sp = 4.2; kai.vx += (tx * sp - kai.vx) * Math.min(1, dt * 10); kai.vy += (ty * sp - kai.vy) * Math.min(1, dt * 10);
    const nx = kai.x + kai.vx * dt, ny = kai.y + kai.vy * dt; if (!blocked(nx, kai.y)) kai.x = nx; if (!blocked(kai.x, ny)) kai.y = ny;
    if (Math.hypot(kai.vx, kai.vy) > 0.3) kai.face = Math.atan2(kai.vy, kai.vx);
    kai.cd -= dt; kai.swing = Math.max(0, kai.swing - dt);
    if (kai.cd <= 0) { const d = dead.find(q => Math.hypot(q.x - kai.x, q.y - kai.y) < 1.7); if (d) { kai.cd = 0.45; kai.swing = 0.2; kai.face = Math.atan2(d.y - kai.y, d.x - kai.x); d.hp -= 1.5; d.hit = st.t; if (d.hp <= 0) kill(d); } }
    // the dead: to the camp, round the houses, apart from each other; at the camp they claw at the Rig
    for (const d of dead) {
      let dx = camp.x - d.x, dy = camp.y - d.y; const r = Math.hypot(dx, dy) || 1; dx /= r; dy /= r;
      if (Math.hypot(kai.x - d.x, kai.y - d.y) < 6) { dx = (kai.x - d.x); dy = (kai.y - d.y); const q = Math.hypot(dx, dy) || 1; dx /= q; dy /= q; }
      let vx = dx, vy = dy;
      if (r < 5.5) { vx = 0; vy = 0; }
      else for (const k of [0, 0.5, 1, 1.5, 2.1]) { const a = Math.atan2(dy, dx) + k * d.side, ax = Math.cos(a), ay = Math.sin(a); if (!blocked(d.x + ax * 1.1, d.y + ay * 1.1)) { vx = ax; vy = ay; break; } }
      for (const o of dead) { if (o === d) continue; const ex = d.x - o.x, ey = d.y - o.y, e = ex * ex + ey * ey; if (e < 0.8 && e > 1e-6) { vx += ex / e * 0.25; vy += ey / e * 0.25; } }
      const s = d.sp * (st.nightOn ? 1.25 : 1); d.vx += (vx * s - d.vx) * Math.min(1, dt * 4); d.vy += (vy * s - d.vy) * Math.min(1, dt * 4);
      const mx = d.x + d.vx * dt, my = d.y + d.vy * dt; if (!blocked(mx, d.y)) d.x = mx; if (!blocked(d.x, my)) d.y = my; d.ph += dt * d.sp * 5;
    }
    // the turrets: the nearest dead in 15 m, a shot every 0.6 s
    for (const T of turrets) {
      T.cd -= dt; let best = null, bd = 15; for (const d of dead) { const r = Math.hypot(d.x - T.x, d.y - T.y); if (r < bd) { bd = r; best = d; } }
      if (best) { const want = Math.atan2(best.y - T.y, best.x - T.x); let a = want - T.aim; a = Math.atan2(Math.sin(a), Math.cos(a)); T.aim += a * Math.min(1, dt * 12); } else T.aim += dt * 0.3;
      if (best && T.cd <= 0) { T.cd = 1.1; tracers.push({ x0: T.x + Math.cos(T.aim) * 0.9, y0: T.y + Math.sin(T.aim) * 0.9, x1: best.x, y1: best.y, t0: st.t }); best.hp -= 1; best.hit = st.t; if (best.hp <= 0) kill(best); }
    }
    for (let k = tracers.length - 1; k >= 0; k--) if (st.t - tracers[k].t0 > 0.12) tracers.splice(k, 1);
    for (let k = deaths.length - 1; k >= 0; k--) if (st.t - deaths[k].t0 > 2.2) deaths.splice(k, 1);
  }

  // ---------- GL: the town under each look's shader, and the ash's disturbance field ----------
  const glc = $('gl'), fxc = $('fx'), fx = fxc.getContext('2d');
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false });
  const tex = c => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.LinearEncoding; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
  const tTown = tex(gC), tOver = tex(oC), tMach = tex(mC);
  const DR = 512, rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false };
  const rts = [new THREE.WebGLRenderTarget(DR, DR, rtOpt), new THREE.WebGLRenderTarget(DR, DR, rtOpt)];
  renderer.setClearColor(new THREE.Color(0.5, 0.5, 0), 1); for (const r of rts) { renderer.setRenderTarget(r); renderer.clear(); } renderer.setRenderTarget(null);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadGeo = new THREE.PlaneGeometry(2, 2);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const NS = 48, stampA = Array.from({ length: NS }, () => new THREE.Vector4()), stampB = Array.from({ length: NS }, () => new THREE.Vector4());
  const U = {
    tTown: { value: tTown }, tOver: { value: tOver }, tMach: { value: tMach }, tDist: { value: rts[0].texture }, tPrev: { value: rts[0].texture },
    uCam: { value: new THREE.Vector2() }, uView: { value: new THREE.Vector2(40, 80) }, uOrigin: { value: new THREE.Vector2(O.x, O.y) }, uS: { value: SPAN },
    uTime: { value: 0 }, uPpm: { value: 20 }, uNight: { value: 0 }, uKai: { value: new THREE.Vector2() },
    uA: { value: stampA }, uB: { value: stampB }, uN: { value: 0 }, uDecayPush: { value: 0 }, uDecayPress: { value: 0 },
  };
  const HEAD = `precision highp float; varying vec2 vUv;
    uniform sampler2D tTown, tOver, tMach, tDist; uniform vec2 uCam, uView, uOrigin, uKai; uniform float uS, uTime, uPpm, uNight;
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec2 h22(vec2 p){ float a = h21(p); return vec2(a, h21(p + a * 17.7 + 3.1)); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    vec2 world(){ return uCam + vec2(vUv.x - 0.5, 0.5 - vUv.y) * uView; }
    vec2 toTex(vec2 w){ return vec2((w.x - uOrigin.x) / uS, 1.0 - (w.y - uOrigin.y) / uS); }
    float inside(vec2 t){ vec2 e = smoothstep(0.0, 0.03, t) * smoothstep(0.0, 0.03, 1.0 - t); return e.x * e.y; }
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }`;
  const mat = frag => new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: HEAD + frag, depthTest: false, depthWrite: false });
  const LOOKS = {
    // today: the game's flat town, desaturated a third as in the game; night is a blue-dark multiply
    today: mat(`void main(){ vec2 w = world(), t = toTex(w); vec3 c = texture2D(tTown, t).rgb; float L = luma(c); c = mix(vec3(L), c, 0.66);
      c *= mix(vec3(1.0), vec3(0.34, 0.40, 0.58), uNight); gl_FragColor = vec4(mix(vec3(0.05), c, inside(t)), 1.0); }`),
    // ash: a dim ash-grey town under a stroke field; the strokes drift with a slow wind, bend away from what pushes them
    // and lie flat (gone) where feet pressed them, so a track shows as dark ground
    ash: mat(`void main(){ vec2 w = world(), t = toTex(w); vec3 town = texture2D(tTown, t).rgb; float over = texture2D(tOver, t).a; float L = luma(town);
      vec3 col = mix(vec3(0.06, 0.063, 0.072), vec3(0.47, 0.47, 0.47), pow(L, 1.05)); col = mix(col, col * 1.12 + 0.03, over * 0.8);
      float c = 0.42; vec2 cell = floor(w / c); float best = 0.0; vec3 sc = vec3(0.0); float aa = 1.0 / uPpm, wid = max(0.026, 0.42 / uPpm);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 id = cell + vec2(float(i), float(j)), r = h22(id), ctr = (id + 0.15 + 0.7 * r) * c;
        vec4 d = texture2D(tDist, toTex(ctr)); vec2 push = (d.rg - 0.5) * 2.0; float press = d.b;
        float th = 0.75 + 2.4 * (vnoise(ctr * 0.028 + vec2(uTime * 0.012, 0.0)) - 0.5) + 1.0 * (vnoise(ctr * 0.16) - 0.5) + 0.12 * sin(uTime * 0.9 + ctr.x * 0.35 + ctr.y * 0.22);
        vec2 dir = vec2(cos(th), sin(th)); float pl = length(push); if (pl > 0.02) dir = normalize(mix(dir, push / pl, clamp(pl * 1.6, 0.0, 1.0)));
        float hl = c * (0.7 + 0.55 * r.x) * mix(1.0, 0.5, press); vec2 a = ctr - dir * hl, b = ctr + dir * hl * 0.55;
        vec2 pa = w - a, ba = b - a; float q = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); float dd = length(pa - ba * q);
        float m = (1.0 - smoothstep(wid, wid + aa, dd)) * mix(step(0.22, r.x * 0.6 + r.y * 0.4), step(0.78, r.y), over) * (1.0 - 0.92 * press);
        if (m > best) { best = m; sc = mix(vec3(0.60, 0.59, 0.56), vec3(0.88, 0.86, 0.81), r.y) * mix(0.8, 1.0, q); }
      }
      float pHere = texture2D(tDist, t).b; col = mix(col, col * 0.45, pHere * 0.7);
      vec3 strokes = sc * mix(1.0, 0.42, uNight); col = mix(col * mix(1.0, 0.45, uNight), strokes, best * 0.6);
      float lamp = exp(-dot(w - uKai, w - uKai) / 18.0) * uNight; col += vec3(0.55, 0.36, 0.14) * lamp * (0.5 + 0.5 * best);
      gl_FragColor = vec4(mix(vec3(0.03), col, inside(t)), 1.0); }`),
    // system: the town as a schematic: luminance and roof edges as cyan lines, hatching by darkness, a 5 m / 25 m grid;
    // machines (scrap) filled blue and breathing
    system: mat(`float edge(sampler2D s, vec2 t, float k, bool alpha){ vec2 o = vec2(k / ${RES}.0);
        float tl, tc, tr, ml, mr, bl, bc, br;
        if (alpha) { tl = texture2D(s, t + vec2(-o.x, o.y)).a; tc = texture2D(s, t + vec2(0.0, o.y)).a; tr = texture2D(s, t + o).a; ml = texture2D(s, t - vec2(o.x, 0.0)).a; mr = texture2D(s, t + vec2(o.x, 0.0)).a; bl = texture2D(s, t - o).a; bc = texture2D(s, t - vec2(0.0, o.y)).a; br = texture2D(s, t + vec2(o.x, -o.y)).a; }
        else { tl = luma(texture2D(s, t + vec2(-o.x, o.y)).rgb); tc = luma(texture2D(s, t + vec2(0.0, o.y)).rgb); tr = luma(texture2D(s, t + o).rgb); ml = luma(texture2D(s, t - vec2(o.x, 0.0)).rgb); mr = luma(texture2D(s, t + vec2(o.x, 0.0)).rgb); bl = luma(texture2D(s, t - o).rgb); bc = luma(texture2D(s, t - vec2(0.0, o.y)).rgb); br = luma(texture2D(s, t + vec2(o.x, -o.y)).rgb); }
        float gx = tr + 2.0 * mr + br - tl - 2.0 * ml - bl, gy = tl + 2.0 * tc + tr - bl - 2.0 * bc - br; return length(vec2(gx, gy)); }
      float lines(float v, float sp, float wd){ float f = abs(fract(v / sp) - 0.5) * sp; return 1.0 - smoothstep(wd, wd + 1.0 / uPpm, f); }
      void main(){ vec2 w = world(), t = toTex(w); vec3 town = texture2D(tTown, t).rgb; float L = luma(town), over = texture2D(tOver, t).a, m = texture2D(tMach, t).a;
        float k = max(1.0, ${PX}.0 / uPpm * 1.2);
        float e = smoothstep(0.10, 0.32, edge(tTown, t, k, false)) * 0.55 + smoothstep(0.25, 0.7, edge(tOver, t, k, true)) * 0.9; float em = smoothstep(0.2, 0.6, edge(tMach, t, k, true));
        vec3 col = mix(vec3(0.016, 0.045, 0.075), vec3(0.03, 0.085, 0.125), over);
        float wd = max(0.02, 0.5 / uPpm);
        col += vec3(0.10, 0.32, 0.42) * 0.55 * lines(w.x + w.y, 0.55, wd) * smoothstep(0.62, 0.3, L);
        col += vec3(0.10, 0.32, 0.42) * 0.45 * lines(w.x - w.y, 0.55, wd) * smoothstep(0.38, 0.15, L);
        col += vec3(0.12, 0.35, 0.45) * 0.22 * (lines(w.x, 5.0, wd) + lines(w.y, 5.0, wd)) + vec3(0.2, 0.55, 0.7) * 0.25 * (lines(w.x, 25.0, wd * 1.4) + lines(w.y, 25.0, wd * 1.4));
        col += vec3(0.43, 0.89, 1.0) * 0.75 * min(1.0, e);
        float breathe = 0.65 + 0.35 * sin(uTime * 2.6);
        col = mix(col, vec3(0.05, 0.22, 0.55) + vec3(0.1, 0.35, 0.8) * lines(w.x + w.y, 0.3, wd) * 0.6, m * 0.85); col += vec3(0.35, 0.75, 1.0) * em * breathe;
        col *= 0.94 + 0.06 * sin(gl_FragCoord.y * 1.7 + uTime * 6.0);
        gl_FragColor = vec4(mix(vec3(0.0, 0.02, 0.04), col, inside(t)), 1.0); }`),
    // glyph: the town held back (dark, half grey) so the letters carry the scene
    glyph: mat(`void main(){ vec2 w = world(), t = toTex(w); vec3 c = texture2D(tTown, t).rgb; float L = luma(c); c = mix(vec3(L), c, 0.4) * mix(0.62, 0.3, uNight);
      c *= mix(vec3(1.0), vec3(0.75, 0.82, 1.0), uNight); gl_FragColor = vec4(mix(vec3(0.03), c, inside(t)), 1.0); }`),
  };
  const DIST = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, depthTest: false, depthWrite: false, fragmentShader: `precision highp float; varying vec2 vUv;
    uniform sampler2D tPrev; uniform vec4 uA[${NS}]; uniform vec4 uB[${NS}]; uniform int uN; uniform float uDecayPush, uDecayPress, uS; uniform vec2 uOrigin;
    void main(){ vec4 d = texture2D(tPrev, vUv); vec2 push = (d.rg - 0.5) * 2.0; float press = d.b;
      float pl = length(push); if (pl > 0.0) push *= max(0.0, pl - uDecayPush) / pl; press = max(0.0, press - uDecayPress);
      vec2 w = uOrigin + vec2(vUv.x, 1.0 - vUv.y) * uS;
      for (int k = 0; k < ${NS}; k++) { if (k >= uN) break; vec4 A = uA[k], B = uB[k]; vec2 dv = w - A.xy; float r = length(dv);
        if (r < B.x) { float f = 1.0 - r / B.x; vec2 o = r > 0.001 ? dv / r : vec2(0.0); float vl = length(A.zw); vec2 v = vl > 0.05 ? A.zw / vl : vec2(0.0);
          vec2 p = o * 0.85 + v * 0.55; float q = length(p); if (q > 0.001) push = mix(push, p / q * min(1.0, q), clamp(f * 0.7, 0.0, 1.0));
          press = max(press, B.y * smoothstep(0.0, 0.55, f)); } }
      gl_FragColor = vec4(push * 0.5 + 0.5, press, 1.0); }` });
  const scene = new THREE.Scene(), quad = new THREE.Mesh(quadGeo, LOOKS.ash); quad.frustumCulled = false; scene.add(quad);
  const dScene = new THREE.Scene(), dQuad = new THREE.Mesh(quadGeo, DIST); dQuad.frustumCulled = false; dScene.add(dQuad);
  let ping = 0, decayAcc = 0;
  function stepDist(dt) {
    let n = 0; const put = (x, y, vx, vy, r, p) => { if (n >= NS) return; stampA[n].set(x, y, vx, vy); stampB[n].set(r, p, 0, 0); n++; };
    put(kai.x, kai.y, kai.vx, kai.vy, 1.6, 0.3);
    for (const d of deaths) if (d.stamp) { put(d.x, d.y, 0, 0, 1.4, 1); d.stamp = false; }
    const byNear = dead.slice().sort((a, b) => Math.hypot(a.x - kai.x, a.y - kai.y) - Math.hypot(b.x - kai.x, b.y - kai.y));
    for (const d of byNear) put(d.x, d.y, d.vx, d.vy, 0.8, Math.hypot(d.vx, d.vy) > 0.2 ? 1 : 0.6);
    U.uN.value = n;
    decayAcc += dt; if (decayAcc >= 0.2) { U.uDecayPush.value = decayAcc * 0.35; U.uDecayPress.value = decayAcc / 22; decayAcc = 0; } else { U.uDecayPush.value = 0; U.uDecayPress.value = 0; }   // 8-bit field: decay in steps big enough to register
    U.tPrev.value = rts[ping].texture; renderer.setRenderTarget(rts[1 - ping]); renderer.render(dScene, quadCam); renderer.setRenderTarget(null);
    ping = 1 - ping; U.tDist.value = rts[ping].texture;
  }

  // ---------- the camera, sizes, input ----------
  const cam = { x: kai.x, y: kai.y, ppm: 12 };
  let cssW = 0, cssH = 0, dpr = 1;
  function resize() {
    cssW = innerWidth; cssH = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false);
    const fdpr = Math.min(devicePixelRatio || 1, 2); fxc.width = Math.round(cssW * fdpr); fxc.height = Math.round(cssH * fdpr); fx.setTransform(fdpr, 0, 0, fdpr, 0, 0);
    if (!resize.done) { cam.ppm = Math.max(9, Math.min(17, Math.min(cssW, cssH) / 34)); resize.done = true; }
  }
  addEventListener('resize', resize); resize();
  const toS = (x, y) => [(x - cam.x) * cam.ppm + cssW / 2, (y - cam.y) * cam.ppm + cssH / 2];
  const zoom = k => { cam.ppm = Math.max(5, Math.min(40, cam.ppm * k)); };
  const pts = new Map(); let pinch0 = 0, drag0 = null;
  glc.addEventListener('pointerdown', e => { glc.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { drag0 = { x: e.clientX, y: e.clientY }; } else { input.on = false; drag0 = null; const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  glc.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) zoom(d / pinch0); pinch0 = d; return; }
    if (drag0) { const dx = e.clientX - drag0.x, dy = e.clientY - drag0.y, r = Math.hypot(dx, dy); if (r > 8) { const k = Math.min(1, r / 60); input.on = true; input.x = dx / r * k; input.y = dy / r * k; } } });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; if (!pts.size) { input.on = false; drag0 = null; } };
  glc.addEventListener('pointerup', up); glc.addEventListener('pointercancel', up);
  glc.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  const keys = {}; addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; }); addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  const keyInput = () => { const x = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), y = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0); if (x || y) { const r = Math.hypot(x, y); input.on = true; input.x = x / r; input.y = y / r; input.key = true; } else if (input.key) { input.on = false; input.key = false; } };

  // ---------- the UI: tabs, notes, buttons ----------
  const NOTES = {
    today: ['Today', 'The game as it ships: the flat town, red tokens under the dead, guns on blue rims.', 'The baseline to compare with.'],
    ash: ['Ash field', 'The town lies under fallen ash. Thousands of strokes drift in the wind and part round Kai, and every step the dead take presses a dark track that fades in about twenty seconds.', 'Tells you where a march came from and where the dead walk. Send a march and watch the trail.'],
    system: ['System vision', 'The town as the System sees it: a cold schematic. What you can salvage glows blue, the dead are red noise, and Kai pings the street every few seconds.', 'Tells you scrap, threats and turret reach at a glance: a night view, or a Mechanic skill.'],
    glyph: ['Glyph dead', 'The Ash-Born are made of letters that never hold still. Kill one and it comes apart into falling ash.', 'Tells you the dead can never be mistaken for anything else, at any zoom.'],
  };
  function setLook(id) {
    st.look = id; quad.material = LOOKS[id];
    for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-pressed', String(b.dataset.look === id));
    const [h, p, w] = NOTES[id]; $('capT').textContent = h; $('capP').textContent = p; $('capW').textContent = w;
    document.body.style.background = id === 'system' ? '#00050a' : '#0b0c0f';
  }
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => setLook(b.dataset.look));
  $('wave').addEventListener('click', wave);
  $('night').addEventListener('click', () => { st.nightOn = !st.nightOn; $('night').textContent = st.nightOn ? 'Day' : 'Night'; });
  $('capBtn').addEventListener('click', () => $('cap').classList.toggle('min'));
  $('zin').addEventListener('click', () => zoom(1.25)); $('zout').addEventListener('click', () => zoom(0.8));
  setLook(new URLSearchParams(location.search).get('look') || 'ash');

  // ---------- the figures, per look ----------
  const FIG = 1.8;   // figures read bigger than the town, as in the game
  const lerp = (a, b, k) => a + (b - a) * k, ease = k => 1 - (1 - k) * (1 - k);
  const disc = (x, y, r, fill, stroke, lw) => { fx.beginPath(); fx.arc(x, y, r, 0, Math.PI * 2); if (fill) { fx.fillStyle = fill; fx.fill(); } if (stroke) { fx.strokeStyle = stroke; fx.lineWidth = lw || 1; fx.stroke(); } };
  const glow = (x, y, r, rgb, a) => { const g = fx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); fx.fillStyle = g; fx.fillRect(x - r, y - r, 2 * r, 2 * r); };
  const hashN = (a, b = 0, c = 0) => { let n = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function rigShape(fill, cab, line) {
    const [x, y] = toS(rig.x, rig.y), s = cam.ppm; fx.save(); fx.translate(x, y); fx.rotate(rig.rot);
    fx.fillStyle = fill; fx.fillRect(-rig.w / 2 * s, -rig.h / 2 * s, rig.w * s, rig.h * s); fx.fillStyle = cab; fx.fillRect(rig.w / 2 * s - 2.0 * s, -rig.h / 2 * s, 2.0 * s, rig.h * s);
    if (line) { fx.strokeStyle = line; fx.lineWidth = 1.5; fx.strokeRect(-rig.w / 2 * s, -rig.h / 2 * s, rig.w * s, rig.h * s); }
    fx.restore();
  }
  function turretToken(T, rim, head) { const [x, y] = toS(T.x, T.y), s = cam.ppm; disc(x + 0.12 * s, y + 0.16 * s, 1.15 * s, 'rgba(0,0,0,.28)'); disc(x, y, 0.95 * s, '#3B4148', rim, 0.2 * s);
    fx.save(); fx.translate(x, y); fx.rotate(T.aim); fx.fillStyle = '#16181c'; fx.fillRect(0.1 * s, -0.27 * s, 0.85 * s, 0.17 * s); fx.fillRect(0.1 * s, 0.1 * s, 0.85 * s, 0.17 * s); fx.fillStyle = head; fx.fillRect(-0.45 * s, -0.38 * s, 0.85 * s, 0.76 * s); fx.restore(); }
  function kaiFigure(body, coat, ring) {
    const [x, y] = toS(kai.x, kai.y), s = cam.ppm * FIG; if (ring) disc(x, y, 0.85 * s, null, ring, 0.2 * s);
    fx.save(); fx.translate(x, y); fx.rotate(kai.face); disc(0, 0, 0.36 * s, coat, '#1a1020', 0.08 * s); disc(0.05 * s, 0, 0.2 * s, body);
    const sw = kai.swing > 0 ? (kai.swing / 0.2) : 0; fx.rotate(-0.9 + sw * 1.8); fx.fillStyle = '#c9ced2'; fx.fillRect(0.2 * s, -0.05 * s, 0.6 * s, 0.1 * s); fx.restore();
  }
  function tracerLines(col, w) { fx.strokeStyle = col; fx.lineWidth = w; fx.lineCap = 'round'; for (const T of tracers) { const [a, b] = toS(T.x0, T.y0), [c, d] = toS(T.x1, T.y1); fx.globalAlpha = 1 - (st.t - T.t0) / 0.12; fx.beginPath(); fx.moveTo(a, b); fx.lineTo(c, d); fx.stroke(); } fx.globalAlpha = 1; }
  const onScreen = (x, y, m = 60) => x > -m && y > -m && x < cssW + m && y < cssH + m;

  const DRAW = {
    today() {
      rigShape('#3a3f44', '#e8b021'); for (const T of turrets) turretToken(T, '#1F5BFF', '#FFC531');
      const s = cam.ppm * FIG;
      for (const d of dead) { const [x, y] = toS(d.x, d.y); if (!onScreen(x, y)) continue; disc(x, y, 0.62 * s, '#FF1744', '#0B0605', 0.1 * s); disc(x, y, 0.34 * s, st.t - d.hit < 0.08 ? '#fff' : '#661a20'); }
      for (const D of deaths) { const k = (st.t - D.t0) / 0.5; if (k > 1) continue; const [x, y] = toS(D.x, D.y); fx.globalAlpha = 1 - k; disc(x, y, (0.6 + k * 0.6) * s, null, '#FF1744', 0.12 * s); fx.globalAlpha = 1; }
      tracerLines('#FFE08A', 2); kaiFigure('#f2c8a0', '#E040FB', '#E040FB');
    },
    ash() {
      const s = cam.ppm * FIG, n = st.night;
      // the Rig and the guns: dark steel with warm lights
      rigShape('#24272b', '#c98a1c'); if (n > 0.05) { const [x, y] = toS(rig.x, rig.y); fx.globalCompositeOperation = 'lighter'; glow(x, y, 9 * s, '255,170,90', 0.22 * n); fx.globalCompositeOperation = 'source-over'; }
      for (const T of turrets) turretToken(T, '#5a6670', '#e0a43a');
      // tracks are in the field; the dead are charcoal silhouettes with ember eyes, the hit ones flash ash-white
      for (const d of dead) {
        const [x, y] = toS(d.x, d.y); if (!onScreen(x, y)) continue; const a = Math.atan2(d.vy, d.vx) || 0, hit = st.t - d.hit < 0.08;
        fx.save(); fx.translate(x + 0.14 * s, y + 0.18 * s); fx.rotate(a); fx.fillStyle = 'rgba(0,0,0,.35)'; fx.beginPath(); fx.ellipse(0, 0, 0.42 * s, 0.32 * s, 0, 0, 7); fx.fill(); fx.restore();
        fx.save(); fx.translate(x, y); fx.rotate(a); const sw = Math.sin(d.ph) * 0.12 * s;
        fx.fillStyle = hit ? '#e8e4da' : '#141214'; fx.beginPath(); fx.ellipse(0, 0, 0.26 * s, 0.38 * s, 0, 0, 7); fx.fill();
        fx.fillRect(0.05 * s, -0.36 * s + sw, 0.42 * s, 0.1 * s); fx.fillRect(0.05 * s, 0.26 * s - sw, 0.42 * s, 0.1 * s);   // arms reaching
        disc(0.1 * s, 0, 0.19 * s, hit ? '#fff' : '#1e1a1c');
        fx.fillStyle = '#ff3b2f'; fx.fillRect(0.2 * s, -0.09 * s, 0.07 * s, 0.06 * s); fx.fillRect(0.2 * s, 0.04 * s, 0.07 * s, 0.06 * s);
        fx.restore();
        if (n > 0.05) { fx.globalCompositeOperation = 'lighter'; glow(x, y, 0.5 * s, '255,60,40', 0.35 * n); fx.globalCompositeOperation = 'source-over'; }
      }
      // a death: a puff of dark ash and a few embers
      for (const D of deaths) { const k = (st.t - D.t0) / 1.4; if (k > 1) continue; const [x, y] = toS(D.x, D.y);
        for (let i = 0; i < 14; i++) { const a = hashN(D.id, i) * 6.283, r = ease(k) * (0.6 + hashN(D.id, i, 1) * 1.4) * s; fx.globalAlpha = (1 - k) * 0.8; disc(x + Math.cos(a) * r, y + Math.sin(a) * r - k * 0.6 * s, (0.08 + 0.1 * hashN(D.id, i, 2)) * s, i % 5 === 0 ? '#ff7a3a' : '#2a2627'); }
        fx.globalAlpha = 1; }
      tracerLines('rgba(255,236,200,.95)', 1.6);
      // Kai: the warm one in a grey world
      { const [x, y] = toS(kai.x, kai.y); fx.globalCompositeOperation = 'lighter'; glow(x, y, (1.8 + 1.5 * n) * s, '255,190,110', 0.18 + 0.2 * n); fx.globalCompositeOperation = 'source-over'; }
      kaiFigure('#f6e6c8', '#e9a23b', null);
      // the ash still falling: flakes in screen space, drifting with the wind
      fx.fillStyle = 'rgba(230,226,215,.75)';
      for (let i = 0; i < 120; i++) { const sp = 0.4 + hashN(i, 7) * 0.9, px = (hashN(i, 1) * cssW + st.t * 14 * sp + Math.sin(st.t * 0.7 + i) * 8) % (cssW + 20) - 10, py = (hashN(i, 2) * cssH + st.t * 22 * sp) % (cssH + 20) - 10, r = 0.6 + hashN(i, 3) * 1.4 * sp; fx.globalAlpha = 0.35 + 0.5 * hashN(i, 4); fx.fillRect(px, py, r, r); }
      fx.globalAlpha = 1;
    },
    system() {
      const s = cam.ppm, C = '111,227,255';
      // the Rig and the guns as wireframes, with their reach
      rigShape('rgba(10,40,60,.6)', 'rgba(111,227,255,.35)', `rgba(${C},.95)`);
      { const [x, y] = toS(rig.x, rig.y); label('HAVEN RIG · HILDE', x, y - (rig.h / 2 + 1.2) * s, `rgb(${C})`); }
      fx.setLineDash([4, 5]); for (const T of turrets) { const [x, y] = toS(T.x, T.y); disc(x, y, 15 * s, null, `rgba(${C},.28)`, 1); } fx.setLineDash([]);
      for (const T of turrets) { const [x, y] = toS(T.x, T.y); fx.strokeStyle = `rgb(${C})`; fx.lineWidth = 1.5; fx.strokeRect(x - 0.7 * s, y - 0.7 * s, 1.4 * s, 1.4 * s); fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x + Math.cos(T.aim) * 1.3 * s, y + Math.sin(T.aim) * 1.3 * s); fx.stroke(); }
      // scrap near Kai: brackets and a tag
      for (const p of machines) { const r = Math.hypot(p.x - kai.x, p.y - kai.y); if (r > 24) continue; const [x, y] = toS(p.x, p.y), hw = (Math.max(p.w, p.h) / 2 + 0.6) * s; brackets(x, y, hw, hw * 0.7, `rgba(${C},${1 - r / 28})`); label('[SCRAP]', x, y - hw * 0.7 - 6, `rgba(${C},${1 - r / 28})`); }
      // the ping: a ring off Kai every three seconds; the dead it touches are marked for a moment
      const pk = (st.t % 3) / 3, pr = ease(pk) * 22; { const [x, y] = toS(kai.x, kai.y); disc(x, y, pr * s, null, `rgba(${C},${0.6 * (1 - pk)})`, 2); }
      // the dead: red noise that never settles; brackets on the near ones
      const sd = s * FIG;
      const near = dead.map(d => [d, Math.hypot(d.x - kai.x, d.y - kai.y)]).sort((a, b) => a[1] - b[1]);
      const q = Math.floor(st.t * 11);
      for (const [d, r] of near) { const [x, y] = toS(d.x, d.y); if (!onScreen(x, y)) continue; const hit = st.t - d.hit < 0.1;
        for (let i = 0; i < 9; i++) { const h1 = hashN(d.id, i, q), h2 = hashN(d.id, i + 20, q), h3 = hashN(d.id, i + 40, q); const z = (0.1 + 0.22 * h3) * sd; fx.fillStyle = hit || h3 > 0.86 ? '#ffe9ec' : h3 > 0.4 ? '#ff2a3d' : '#9c0f1e'; fx.fillRect(x + (h1 - 0.5) * 0.9 * sd - z / 2, y + (h2 - 0.5) * 0.9 * sd - z / 2, z, z); }
        if (Math.abs(r - pr) < 1.2) brackets(x, y, 0.8 * sd, 0.8 * sd, '#ff5a6a'); }
      for (const [d, r] of near.slice(0, 3)) { if (r > 18) break; const [x, y] = toS(d.x, d.y); brackets(x, y, 0.85 * sd, 0.85 * sd, 'rgba(255,90,106,.9)'); label(`ASH-BORN ${r.toFixed(0)}m`, x, y - 1.2 * sd, '#ff8a96'); }
      for (const D of deaths) { const k = (st.t - D.t0) / 1.2; if (k > 1) continue; const [x, y] = toS(D.x, D.y);
        for (let i = 0; i < 10; i++) { const a = hashN(D.id, i) * 6.283, r = ease(k) * (0.5 + hashN(D.id, i, 1) * 1.6) * s, z = 0.18 * s * (1 - k); fx.fillStyle = `rgba(255,42,61,${1 - k})`; fx.fillRect(x + Math.cos(a) * r - z / 2, y + Math.sin(a) * r - z / 2, z, z); }
        label('+3 XP', x, y - (1 + k * 1.6) * s, `rgba(${C},${1 - k})`); }
      tracerLines(`rgba(${C},.9)`, 1.2);
      // Kai: a clean white mark with her name on it
      { const [x, y] = toS(kai.x, kai.y); disc(x, y, 0.75 * s, 'rgba(255,255,255,.12)', '#ffffff', 2); disc(x, y, 0.22 * s, '#ffffff'); fx.strokeStyle = '#fff'; fx.lineWidth = 2; fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x + Math.cos(kai.face) * 1.1 * s, y + Math.sin(kai.face) * 1.1 * s); fx.stroke(); label('KAI · MECHANIC LV 1', x, y + 1.5 * s, '#ffffff'); }
    },
    glyph() {
      const s = cam.ppm, n = st.night;
      rigShape('#2b2f33', '#c98a1c'); for (const T of turrets) turretToken(T, '#1F5BFF', '#FFC531');
      tracerLines('#FFE08A', 2);
      // a figure of letters, upright: head, shoulders, body, legs that swap as it walks
      const gc = Math.max(0.36 * s * FIG, 6.5), font = `700 ${Math.round(gc * 1.18)}px "IBM Plex Mono", ui-monospace, monospace`;
      fx.font = font; fx.textAlign = 'center'; fx.textBaseline = 'middle';
      const CORE = '#@%&8$WMB0', EDGE = '*+=x%#', q = Math.floor(st.t * 9);
      const ROWS = [' @@ ', ' ## ', '####', '####', ' ## ', '#  #'], ROWS2 = [' @@ ', ' ## ', '####', '####', ' ## ', ' ## '];
      for (const d of dead) {
        const [x, y] = toS(d.x, d.y); if (!onScreen(x, y)) continue; const rows = Math.sin(d.ph) > 0 ? ROWS : ROWS2, hit = st.t - d.hit < 0.08, bob = Math.abs(Math.sin(d.ph)) * gc * 0.12;
        if (n > 0.05) { fx.globalCompositeOperation = 'lighter'; glow(x, y, 2.4 * gc, '255,40,40', 0.28 * n); fx.globalCompositeOperation = 'source-over'; }
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const m = rows[r][c]; if (m === ' ') continue;
          const h = hashN(d.id, r * 4 + c, q + (r * 7 + c) % 3), core = (c === 1 || c === 2) && r > 0 && r < 5, ch = r === 0 ? (h > 0.5 ? '@' : 'Q') : (core ? CORE : EDGE)[Math.floor(h * (core ? CORE.length : EDGE.length))];
          const gx = x + (c - 1.5) * gc * 0.78, gy = y + (r - 2.8) * gc * 0.92 - bob;
          fx.fillStyle = hit ? '#ffffff' : r === 0 ? '#ffd2c8' : core ? (h > 0.75 ? '#ff6a5a' : '#e8293a') : '#9d1626';
          fx.fillText(ch, gx, gy); }
      }
      // a death: the letters fly apart, fall, and go to ash
      for (const D of deaths) { const k = (st.t - D.t0) / 1.8; if (k > 1) continue; const [x, y] = toS(D.x, D.y);
        for (let i = 0; i < 18; i++) { const a = hashN(D.id, i) * 6.283, v = (1.2 + hashN(D.id, i, 1) * 2.2) * s, tt = k * 1.8, dx = Math.cos(a) * v * (1 - Math.exp(-tt * 3)) / 3, dy = Math.sin(a) * v * (1 - Math.exp(-tt * 3)) / 3 + tt * tt * 2.2 * s;
          const ch = k < 0.35 ? CORE[Math.floor(hashN(D.id, i, 3) * CORE.length)] : k < 0.65 ? '*:'[i % 2] : '.,`'[i % 3]; fx.globalAlpha = 1 - k; fx.fillStyle = k < 0.3 ? '#ff6a5a' : '#b9b3a8'; fx.fillText(ch, x + dx, y + dy - gc); }
        fx.globalAlpha = 1; }
      kaiFigure('#f2c8a0', '#f0b44c', '#f0b44c');
    },
  };
  function brackets(x, y, hw, hh, col) { const L = Math.min(hw, hh) * 0.45; fx.strokeStyle = col; fx.lineWidth = 1.5; fx.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { fx.moveTo(x + sx * hw, y + sy * hh - sy * L); fx.lineTo(x + sx * hw, y + sy * hh); fx.lineTo(x + sx * hw - sx * L, y + sy * hh); } fx.stroke(); }
  function label(text, x, y, col) { fx.font = '600 10px "IBM Plex Mono", ui-monospace, monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; const w = fx.measureText(text).width + 8; fx.fillStyle = 'rgba(0,10,18,.65)'; fx.fillRect(x - w / 2, y - 7, w, 14); fx.fillStyle = col; fx.fillText(text, x, y + 0.5); }

  // ---------- the loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;   // (the first frame's stamp can be older than the setup's clock)
    keyInput(); step(dt);
    cam.x = lerp(cam.x, kai.x, Math.min(1, dt * 4)); cam.y = lerp(cam.y, kai.y, Math.min(1, dt * 4));
    U.uCam.value.set(cam.x, cam.y); U.uView.value.set(cssW / cam.ppm, cssH / cam.ppm); U.uPpm.value = cam.ppm * dpr; U.uTime.value = st.t; U.uNight.value = st.night; U.uKai.value.set(kai.x, kai.y);
    stepDist(dt);
    renderer.render(scene, quadCam);
    fx.clearRect(0, 0, cssW, cssH); try { DRAW[st.look](); } catch (e) { if (!frame.warned) { frame.warned = true; console.error(e.stack || e); } }   // a drawing slip never stops the loop
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // for screenshots: run the scene ahead (the sim and the ash field, no drawing)
  const run = sec => { for (let k = 0; k < sec * 30; k++) { step(1 / 30); stepDist(1 / 30); } cam.x = kai.x; cam.y = kai.y; };
  window.__lab = { st, setLook, wave, kai, dead, cam, run, night: on => { st.nightOn = on; } };
}
