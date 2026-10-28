// Looks Lab: one Hollowmere scene, four ways of drawing it, to choose an art direction by eye on a phone.
// The town is the real engine town (recipe hollowmere), painted once round the camp; a small scripted scene runs on
// top (Kai on patrol or walked by drag, the dead walking in on the camp round the houses, two turrets, the Rig), and
// each look is a full-screen shader over the town plus a 2D layer for the figures:
//   today  · the game as it ships (flat town, red tokens, blue-rimmed guns), the baseline;
//   ash    · fallen ash as a stroke field that drifts in the wind, parts round Kai and keeps the dead's tracks;
//   ash2   · the same field as the one material of everything: strokes follow streets, roofs (an engraving by slope),
//            trees, and hatch the shadows; the Rig, the guns, Kai and the dead are drawn in strokes too;
//   system · the System's schematic: edges, hatching, a grid; machines blue, the dead red noise, Kai's ping;
//   glyph  · the dead made of letters that never hold still, coming apart into ash when they fall.
// Lab code: no sim rules here, nothing of this reaches the game until a look is chosen.
/* global THREE */
import { RECIPES, recipeRegistry, buildArea } from '../../src/engine/recipes.js';
import { paintWorld, SUN } from '../../src/engine/draw2d.js';
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
  // [ash2] the town as stroke directions, 4 px a metre: roofs (rgb = downslope angle, lit side, gable; a = roof), streets
  // (r = the street's angle; a = street) and a mix (r tree canopy, g water, b cast shadow; added, so they overlap freely)
  const MPX = 4, MRES = SPAN * MPX;
  const mcanvas = bg => { const c = document.createElement('canvas'); c.width = c.height = MRES; const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, MRES, MRES); } x.setTransform(MPX, 0, 0, MPX, -O.x * MPX, -O.y * MPX); return [c, x]; };
  const [rC, rX] = mcanvas(), [sC, sX] = mcanvas(), [xC, xX] = mcanvas('#000');
  const ang = a => { a %= Math.PI; if (a < 0) a += Math.PI; return Math.round(a / Math.PI * 255); };
  const buildings = W.placed.filter(p => near(p) && p.def.kind === 'building' && p !== rigAtom);
  xX.globalCompositeOperation = 'lighter';
  for (const p of buildings) { const h = (p.def.height || 6) * 0.38, dx = -SUN.x * h, dy = -SUN.y * h * 0.8; xX.fillStyle = 'rgb(0,0,255)'; for (let k = 1; k <= 8; k++) obb(xX, { ...p, x: p.x + dx * k / 8, y: p.y + dy * k / 8 }, 0); }
  for (const p of W.placed) if (near(p) && p.def.look === 'tree') { const r = (p.r || p.def.size[0] / 2) * 0.86; xX.fillStyle = 'rgb(0,0,140)'; xX.beginPath(); xX.arc(p.x + 1.1, p.y + 1.5, r, 0, 7); xX.fill(); xX.fillStyle = 'rgb(255,0,0)'; xX.beginPath(); xX.arc(p.x, p.y, r, 0, 7); xX.fill(); }
  for (const wt of W.water || []) { xX.strokeStyle = 'rgb(0,255,0)'; xX.lineWidth = wt.w || 6; xX.beginPath(); wt.pts.forEach((q, i) => i ? xX.lineTo(q.x, q.y) : xX.moveTo(q.x, q.y)); xX.stroke(); }
  for (const p of buildings) {
    rX.save(); rX.translate(p.x, p.y); rX.rotate(p.rot);
    if (p.def.look === 'gable' || p.def.look === 'church') for (const side of [-1, 1]) { const nx = -Math.sin(p.rot) * side, ny = Math.cos(p.rot) * side, lit = nx * SUN.x + ny * SUN.y > 0; rX.fillStyle = `rgb(${ang(p.rot + Math.PI / 2)},${lit ? 255 : 0},255)`; rX.fillRect(-p.w / 2, side < 0 ? -p.h / 2 : 0, p.w, p.h / 2); }
    else { rX.fillStyle = `rgb(${ang(p.rot)},150,0)`; rX.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
    rX.restore();
  }
  sX.lineCap = 'round';
  for (const st2 of W.streets) for (let i = 0; i < st2.pts.length - 1; i++) { const a = st2.pts[i], b = st2.pts[i + 1]; sX.strokeStyle = `rgb(${ang(Math.atan2(b.y - a.y, b.x - a.x))},${st2.kind === 'path' ? 90 : 255},0)`; sX.lineWidth = st2.w; sX.beginPath(); sX.moveTo(a.x, a.y); sX.lineTo(b.x, b.y); sX.stroke(); }
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
  const dead = [], deaths = [], tracers = [], shots = [], flakes = []; let nid = 1;
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
      if (best && T.cd <= 0) { T.cd = 1.1; T.shotT = st.t; shots.push({ x: T.x, y: T.y }); tracers.push({ x0: T.x + Math.cos(T.aim) * 0.9, y0: T.y + Math.sin(T.aim) * 0.9, x1: best.x, y1: best.y, t0: st.t }); best.hp -= 1; best.hit = st.t; if (best.hp <= 0) kill(best); }
    }
    // [ash2] the dead shed ash as they walk: a flake every third of a second, drifting off and settling
    for (const d of dead) { d.shed = (d.shed ?? rnd() * 0.4) - dt; if (d.shed <= 0) { d.shed = 0.3 + rnd() * 0.3; if (flakes.length < 700 && Math.hypot(d.vx, d.vy) > 0.2) flakes.push({ x: d.x - d.vx * 0.3 + (rnd() - 0.5) * 0.4, y: d.y - d.vy * 0.3 + (rnd() - 0.5) * 0.4, t0: st.t, a: rnd() * 6.28 }); } }
    while (flakes.length && st.t - flakes[0].t0 > 2.6) flakes.shift();
    for (let k = tracers.length - 1; k >= 0; k--) if (st.t - tracers[k].t0 > 0.12) tracers.splice(k, 1);
    for (let k = deaths.length - 1; k >= 0; k--) if (st.t - deaths[k].t0 > 2.2) deaths.splice(k, 1);
  }

  // ---------- GL: the town under each look's shader, and the ash's disturbance field ----------
  const glc = $('gl'), fxc = $('fx'), fx = fxc.getContext('2d');
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false });
  const tex = c => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.LinearEncoding; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
  const tTown = tex(gC), tOver = tex(oC), tMach = tex(mC);
  const mtex = c => { const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };   // [ash2] no mips: an angle must not blur into its neighbour
  const tRoof = mtex(rC), tStreet = mtex(sC), tMisc = mtex(xC);
  const DR = 512, rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false };
  const rts = [new THREE.WebGLRenderTarget(DR, DR, rtOpt), new THREE.WebGLRenderTarget(DR, DR, rtOpt)];
  renderer.setClearColor(new THREE.Color(0.5, 0.5, 0), 1); for (const r of rts) { renderer.setRenderTarget(r); renderer.clear(); } renderer.setRenderTarget(null);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadGeo = new THREE.PlaneGeometry(2, 2);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const NS = 48, stampA = Array.from({ length: NS }, () => new THREE.Vector4()), stampB = Array.from({ length: NS }, () => new THREE.Vector4());
  const U = {
    tTown: { value: tTown }, tOver: { value: tOver }, tMach: { value: tMach }, tRoof: { value: tRoof }, tStreet: { value: tStreet }, tMisc: { value: tMisc }, uFire: { value: new THREE.Vector2(camp.x, camp.y) }, tDist: { value: rts[0].texture }, tPrev: { value: rts[0].texture },
    uCam: { value: new THREE.Vector2() }, uView: { value: new THREE.Vector2(40, 80) }, uOrigin: { value: new THREE.Vector2(O.x, O.y) }, uS: { value: SPAN },
    uTime: { value: 0 }, uPpm: { value: 20 }, uNight: { value: 0 }, uKai: { value: new THREE.Vector2() },
    uA: { value: stampA }, uB: { value: stampB }, uN: { value: 0 }, uDecayPush: { value: 0 }, uDecayPress: { value: 0 },
  };
  const HEAD = `precision highp float; varying vec2 vUv;
    uniform sampler2D tTown, tOver, tMach, tDist, tRoof, tStreet, tMisc; uniform vec2 uCam, uView, uOrigin, uKai, uFire; uniform float uS, uTime, uPpm, uNight;
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
    // ash2: one material. Each pixel's class (roof, tree, street, shadow, ground) sets the strokes near it: roofs an
    // ordered engraving down each slope (lit slope pale, the other dark), streets long strokes swept along the street,
    // trees curly tufts, open ground the drifting wind; shadows are cross-hatched. The living bring the only warm light.
    ash2: mat(`float lines(float v, float sp, float wd){ float f = abs(fract(v / sp) - 0.5) * sp; return 1.0 - smoothstep(wd, wd + 1.0 / uPpm, f); }
      void main(){ vec2 w = world(), t = toTex(w);
        vec4 rf = texture2D(tRoof, t), sx = texture2D(tStreet, t); vec3 ms = texture2D(tMisc, t).rgb; float L = luma(texture2D(tTown, t).rgb);
        float roof = smoothstep(0.35, 0.65, rf.a), tree = smoothstep(0.3, 0.7, ms.r) * (1.0 - roof), street = smoothstep(0.35, 0.65, sx.a) * (1.0 - roof) * (1.0 - tree), shadow = min(1.0, ms.b * 1.6) * (1.0 - roof);
        float lit = rf.g, flatRoof = step(rf.b, 0.5);
        vec3 base = vec3(0.29, 0.288, 0.282) + (L - 0.5) * 0.05;
        base = mix(base, vec3(0.15, 0.152, 0.16), street * sx.g);
        base = mix(base, vec3(0.10, 0.108, 0.105), tree);
        base = mix(base, mix(mix(vec3(0.16, 0.16, 0.17), vec3(0.42, 0.415, 0.40), lit), vec3(0.30, 0.30, 0.31), flatRoof), roof);
        float c = max(0.42, 5.0 / uPpm), wid = max(0.024, 0.55 / uPpm), aa = 1.0 / uPpm;
        float roofAng = rf.r * 3.14159, stAng = sx.r * 3.14159;
        vec2 cell = floor(w / c); float best = 0.0; vec3 sc = vec3(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 id = cell + vec2(float(i), float(j)), r = h22(id); float jit = mix(0.72, 0.14, roof);
          vec2 ctr = (id + 0.5 - jit * 0.5 + jit * r) * c;
          vec4 d = texture2D(tDist, toTex(ctr)); vec2 push = (d.rg - 0.5) * 2.0; float press = d.b * (1.0 - roof);
          float th = 0.75 + 2.4 * (vnoise(ctr * 0.028 + vec2(uTime * 0.012, 0.0)) - 0.5) + 1.0 * (vnoise(ctr * 0.16) - 0.5) + 0.12 * sin(uTime * 0.9 + ctr.x * 0.35 + ctr.y * 0.22);
          if (street > 0.5) th = stAng + 0.28 * (vnoise(ctr * 0.35 + uTime * 0.02) - 0.5);
          if (tree > 0.5) th = 6.2832 * vnoise(ctr * 0.9 + vec2(uTime * 0.04, 0.0));
          if (roof > 0.5) th = roofAng;
          vec2 dir = vec2(cos(th), sin(th)); float pl = length(push); if (pl > 0.02 && roof < 0.5) dir = normalize(mix(dir, push / pl, clamp(pl * 1.6, 0.0, 1.0)));
          float len = roof > 0.5 ? 0.98 : tree > 0.5 ? 0.6 : street > 0.5 ? 1.2 : 0.7 + 0.5 * r.x;
          float hl = c * len * 0.6 * mix(1.0, 0.5, press);
          vec2 a = ctr - dir * hl, b = ctr + dir * hl, pa = w - a, ba = b - a; float q = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); float dd = length(pa - ba * q);
          float drift = smoothstep(0.25, 0.75, vnoise(ctr * 0.07 + 3.7)); float dens = roof > 0.5 ? 1.0 : tree > 0.5 ? 0.85 : street > 0.5 ? 0.78 : mix(0.35, 0.9, drift);   // the ash lies in drifts: thin patches show the ground
          float m = (1.0 - smoothstep(wid * mix(1.0, 1.25, roof), wid * mix(1.0, 1.25, roof) + aa, dd)) * step(h21(id + 7.31), dens) * (1.0 - 0.92 * press);
          vec3 col = mix(vec3(0.50, 0.495, 0.475), vec3(0.74, 0.725, 0.69), r.y) * mix(0.85, 1.0, q);
          if (street > 0.5) col = mix(vec3(0.50, 0.50, 0.49), vec3(0.70, 0.69, 0.66), r.y);
          if (tree > 0.5) col = mix(vec3(0.27, 0.30, 0.27), vec3(0.44, 0.47, 0.42), r.y);
          if (roof > 0.5) col = flatRoof > 0.5 ? mix(vec3(0.52), vec3(0.62), r.y) : mix(mix(vec3(0.30, 0.30, 0.31), vec3(0.40, 0.40, 0.41), r.y), mix(vec3(0.72, 0.71, 0.68), vec3(0.88, 0.86, 0.81), r.y), lit);
          if (m > best) { best = m; sc = col; }
        }
        float hs = max(0.3, 3.6 / uPpm), xh = max(lines(w.x - w.y, hs, wid * 0.7), lines(w.x + w.y, hs, wid * 0.7) * step(0.55, shadow));
        base = mix(base, base * 0.5, shadow * 0.55); base = mix(base, base * 0.35, xh * shadow);
        base = mix(base, base * 0.6, lines(w.x - w.y, max(0.22, 2.6 / uPpm), wid * 0.6) * roof * (1.0 - lit) * (1.0 - flatRoof) * 0.6);
        vec3 col = mix(base, sc, best * mix(mix(0.55, 0.68, street), 0.8, roof) * (1.0 - shadow * 0.35));
        float pHere = texture2D(tDist, t).b * (1.0 - roof); col = mix(col, col * 0.4, pHere * 0.72);
        col *= mix(vec3(1.0), vec3(0.33, 0.35, 0.40), uNight);
        float lamp = exp(-dot(w - uKai, w - uKai) / mix(5.0, 20.0, uNight)) * mix(0.10, 0.6, uNight);
        float fire = exp(-dot(w - uFire, w - uFire) / 30.0) * mix(0.08, 0.7, uNight) * (0.88 + 0.12 * sin(uTime * 13.0) * sin(uTime * 7.3));
        col += vec3(0.62, 0.40, 0.16) * (lamp + fire) * (0.4 + 0.6 * best);
        gl_FragColor = vec4(mix(vec3(0.03), col, inside(t)), 1.0); }`),
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
    for (const S2 of shots) put(S2.x, S2.y, 0, 0, 2.6, 0); shots.length = 0;   // [ash2] a shot blows a ring in the ash
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
    ash2: ['Ash field, round 2', 'Everything is drawn in the same strokes. Strokes run along the streets and down each roof slope, curl in the trees and cross-hatch the shadows. The Rig, the guns, Kai and the dead are strokes too.', 'Two colours carry the meaning: amber is alive and yours, ember red is the dead. Zoom out and the strokes get longer, not noisier.'],
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
  setLook(new URLSearchParams(location.search).get('look') || 'ash2');

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
    // ash2: the machines, the dead and Kai in the field's own strokes. Grey ash and steel; amber is alive and yours; ember red is the dead.
    ash2() {
      const s = cam.ppm, sf = Math.max(cam.ppm * FIG, 15), n = st.night, q = Math.floor(st.t * 7), WA = 0.75, wx = Math.cos(WA), wy = Math.sin(WA);
      const shX = -SUN.x * 0.55, shY = -SUN.y * 0.55;   // where shadows fall, in metres per metre of height
      const L = (x0, y0, x1, y1) => { fx.moveTo(x0, y0); fx.lineTo(x1, y1); };
      fx.lineCap = 'round';
      // the Rig: a hatched shadow, steel strokes along its bed, the cab hatched amber across, a double edge
      { const [x, y] = toS(rig.x, rig.y), hw = rig.w / 2 * s, hh = rig.h / 2 * s, c = Math.cos(-rig.rot), si = Math.sin(-rig.rot), ox = (shX * c - shY * si) * 2.2 * s, oy = (shX * si + shY * c) * 2.2 * s;
        fx.save(); fx.translate(x, y); fx.rotate(rig.rot);
        fx.strokeStyle = 'rgba(12,12,14,.55)'; fx.lineWidth = 1; fx.beginPath(); for (let k = -hw - hh; k < hw + hh; k += 0.22 * s) L(Math.max(-hw, k) + ox, -hh + oy + Math.max(0, -hw - k), Math.min(hw, k + 2 * hh) + ox, -hh + oy + Math.min(2 * hh, k + 2 * hh + hw) - Math.max(0, k + 2 * hh - hw)); fx.stroke();
        fx.fillStyle = '#26292d'; fx.fillRect(-hw, -hh, 2 * hw, 2 * hh);
        fx.strokeStyle = '#737b83'; fx.lineWidth = 1.1; fx.beginPath(); for (let yy = -hh + 0.22 * s; yy < hh - 0.1 * s; yy += 0.3 * s) L(-hw + 0.25 * s, yy, hw - 2.3 * s, yy); fx.stroke();
        fx.strokeStyle = '#e0a43a'; fx.lineWidth = 1.4; fx.beginPath(); for (let xx = hw - 2.0 * s; xx < hw - 0.12 * s; xx += 0.26 * s) L(xx, -hh + 0.22 * s, xx, hh - 0.22 * s); fx.stroke();
        fx.strokeStyle = '#b3bac0'; fx.lineWidth = 1.2; fx.strokeRect(-hw, -hh, 2 * hw, 2 * hh); fx.strokeStyle = 'rgba(179,186,192,.5)'; fx.strokeRect(-hw + 0.3 * s, -hh + 0.3 * s, 2 * hw - 0.6 * s, 2 * hh - 0.6 * s);
        if (n > 0.05) { fx.globalCompositeOperation = 'lighter'; for (const sy of [-0.6, 0.6]) glow(hw + 2.5 * s, sy * hh, 3 * s, '255,214,150', 0.28 * n); fx.globalCompositeOperation = 'source-over'; }
        fx.restore(); }
      // the guns: radial steel strokes, an amber hatched head, two barrels, a burst at the muzzle
      for (const T of turrets) { const [x, y] = toS(T.x, T.y);
        fx.strokeStyle = 'rgba(12,12,14,.5)'; fx.lineWidth = 1; fx.beginPath(); for (let k = -1; k <= 1; k += 0.25) L(x + shX * 1.6 * s - 0.9 * s, y + shY * 1.6 * s + k * 0.9 * s, x + shX * 1.6 * s + 0.9 * s, y + shY * 1.6 * s + k * 0.9 * s - 0.9 * s); fx.stroke();
        fx.fillStyle = '#26292d'; fx.beginPath(); fx.arc(x, y, 0.95 * s, 0, 7); fx.fill();
        fx.strokeStyle = '#6b737a'; fx.lineWidth = 1.1; fx.beginPath(); for (let k = 0; k < 22; k++) { const a = k / 22 * 6.283; L(x + Math.cos(a) * 0.42 * s, y + Math.sin(a) * 0.42 * s, x + Math.cos(a) * 0.9 * s, y + Math.sin(a) * 0.9 * s); } fx.stroke();
        fx.strokeStyle = '#b3bac0'; fx.lineWidth = 1.2; fx.beginPath(); fx.arc(x, y, 0.95 * s, 0, 7); fx.stroke();
        fx.save(); fx.translate(x, y); fx.rotate(T.aim);
        fx.strokeStyle = '#121416'; fx.lineWidth = Math.max(2, 0.15 * s); fx.beginPath(); L(0.2 * s, -0.16 * s, 1.1 * s, -0.16 * s); L(0.2 * s, 0.16 * s, 1.1 * s, 0.16 * s); fx.stroke();
        fx.fillStyle = '#3a2a12'; fx.fillRect(-0.42 * s, -0.34 * s, 0.8 * s, 0.68 * s);
        fx.strokeStyle = '#f0b44c'; fx.lineWidth = 1.4; fx.beginPath(); for (let xx = -0.36 * s; xx < 0.36 * s; xx += 0.13 * s) L(xx, -0.3 * s, xx, 0.3 * s); fx.stroke();
        if (T.shotT !== undefined && st.t - T.shotT < 0.08) { fx.strokeStyle = '#ffe6a8'; fx.lineWidth = 1.6; fx.beginPath(); for (let k = -2; k <= 2; k++) L(1.15 * s, 0, 1.15 * s + Math.cos(k * 0.35) * 0.6 * s, Math.sin(k * 0.35) * 0.6 * s); fx.stroke(); }
        fx.restore(); }
      // the ash the dead shed: dark flakes drifting off with the wind
      fx.strokeStyle = '#211d1c'; fx.lineWidth = 1.1;
      for (const f of flakes) { const k = (st.t - f.t0) / 2.6; if (k > 1) continue; const px = f.x + wx * k * 2.4 + Math.sin(f.a + st.t * 3) * 0.12, py = f.y + wy * k * 2.4, [X, Y] = toS(px, py); if (!onScreen(X, Y, 10)) continue; const l = 0.16 * sf * (1 - k * 0.5); fx.globalAlpha = (1 - k) * 0.9; fx.beginPath(); L(X, Y, X + Math.cos(f.a) * l, Y + Math.sin(f.a) * l); fx.stroke(); }
      fx.globalAlpha = 1;
      // the dead: a clump of dark strokes that never holds still, arms reaching ahead, two ember eyes
      for (const d of dead) {
        const [x, y] = toS(d.x, d.y); if (!onScreen(x, y)) continue; const sp = Math.hypot(d.vx, d.vy), a = sp > 0.1 ? Math.atan2(d.vy, d.vx) : (d.fa ?? 0); d.fa = a; const hit = st.t - d.hit < 0.08, c = Math.cos(a), si = Math.sin(a);
        const P = (lx, ly) => [x + lx * c - ly * si, y + lx * si + ly * c];
        if (n > 0.05) { fx.globalCompositeOperation = 'lighter'; glow(x, y, 0.9 * sf, '255,50,30', 0.3 * n); fx.globalCompositeOperation = 'source-over'; }
        fx.strokeStyle = 'rgba(10,9,10,.35)'; fx.lineWidth = 1; fx.beginPath(); for (let k = 0; k < 6; k++) { const [X, Y] = [x + shX * 0.9 * sf, y + shY * 0.9 * sf]; L(X - 0.3 * sf + k * 0.1 * sf, Y - 0.25 * sf, X - 0.1 * sf + k * 0.1 * sf, Y + 0.25 * sf); } fx.stroke();
        fx.strokeStyle = hit ? '#f1ece0' : '#141113'; fx.lineWidth = Math.max(1.7, 0.09 * sf); fx.beginPath();
        for (let k = 0; k < 18; k++) { const h1 = hashN(d.id, k, q), h2 = hashN(d.id, k + 30, q), h3 = hashN(d.id, k + 60), rr = Math.sqrt(h1) * 0.4 * sf, aa = h2 * 6.283, [X, Y] = P(Math.cos(aa) * rr * 0.8 - 0.04 * sf, Math.sin(aa) * rr), l = (0.16 + 0.2 * h3) * sf, an = a + (h3 - 0.5) * 1.1; L(X - Math.cos(an) * l / 2, Y - Math.sin(an) * l / 2, X + Math.cos(an) * l / 2, Y + Math.sin(an) * l / 2); }
        const sw = Math.sin(d.ph) * 0.07 * sf; for (const side of [-1, 1]) { const [X0, Y0] = P(0.05 * sf, side * 0.2 * sf), [X1, Y1] = P(0.52 * sf, side * 0.17 * sf + side * sw); L(X0, Y0, X1, Y1); }
        fx.stroke();
        fx.fillStyle = '#ff3b2f'; for (const side of [-1, 1]) { const [X, Y] = P(0.2 * sf, side * 0.065 * sf); fx.fillRect(X - 0.035 * sf, Y - 0.035 * sf, 0.07 * sf, 0.07 * sf); }
      }
      // a fall: dark strokes burst out and settle, a few embers (the field keeps the scorch)
      for (const D of deaths) { const k = (st.t - D.t0) / 1.4; if (k > 1) continue; const [x, y] = toS(D.x, D.y); fx.lineWidth = 1.4;
        for (let i = 0; i < 16; i++) { const a = hashN(D.id, i) * 6.283, r = ease(k) * (0.4 + hashN(D.id, i, 1) * 1.2) * sf, l = 0.18 * sf * (1 - k), X = x + Math.cos(a) * r, Y = y + Math.sin(a) * r; fx.globalAlpha = 1 - k; fx.strokeStyle = i % 5 === 0 ? '#ff7a3a' : '#1b1819'; fx.beginPath(); L(X, Y, X + Math.cos(a) * l, Y + Math.sin(a) * l); fx.stroke(); }
        fx.globalAlpha = 1; }
      tracerLines('rgba(255,224,160,.95)', 1.4);
      // Kai: the warm one. Ink strokes for an edge, then cream and amber strokes, a bright core, the wrench
      { const [x, y] = toS(kai.x, kai.y), a = kai.face, c = Math.cos(a), si = Math.sin(a), P = (lx, ly) => [x + lx * c - ly * si, y + lx * si + ly * c], qk = Math.floor(st.t * 5);
        fx.globalCompositeOperation = 'lighter'; glow(x, y, (2.0 + 1.6 * n) * sf, '255,190,110', 0.12 + 0.2 * n); fx.globalCompositeOperation = 'source-over';
        for (const [col, w, sc] of [['#1a1210', Math.max(3, 0.15 * sf), 1.12], ['#e9a23b', Math.max(1.6, 0.08 * sf), 1], ['#f8ecd4', Math.max(1.2, 0.06 * sf), 0.7]]) {
          fx.strokeStyle = col; fx.lineWidth = w; fx.beginPath();
          for (let k = 0; k < 14; k++) { const h1 = hashN(7, k, qk), h2 = hashN(7, k + 30, qk), h3 = hashN(7, k + 60), rr = Math.sqrt(h1) * 0.32 * sf * sc, aa = h2 * 6.283, [X, Y] = P(Math.cos(aa) * rr * 0.85, Math.sin(aa) * rr), l = (0.14 + 0.14 * h3) * sf * sc, an = a + (h3 - 0.5) * 0.9; L(X - Math.cos(an) * l / 2, Y - Math.sin(an) * l / 2, X + Math.cos(an) * l / 2, Y + Math.sin(an) * l / 2); }
          fx.stroke(); }
        fx.fillStyle = '#fff6e2'; fx.beginPath(); fx.arc(...P(0.08 * sf, 0), Math.max(1.6, 0.08 * sf), 0, 7); fx.fill();
        const sw = kai.swing > 0 ? kai.swing / 0.2 : 0, wa = a - 0.9 + sw * 1.8, [X0, Y0] = P(0.1 * sf, 0.18 * sf);
        fx.strokeStyle = '#c9ced2'; fx.lineWidth = Math.max(1.6, 0.08 * sf); fx.beginPath(); L(X0, Y0, X0 + Math.cos(wa) * 0.5 * sf, Y0 + Math.sin(wa) * 0.5 * sf); fx.stroke(); }
      // the ash still falling: short strokes along the wind
      fx.strokeStyle = 'rgba(232,228,218,.8)'; fx.lineWidth = 1;
      for (let i = 0; i < 110; i++) { const sp = 0.4 + hashN(i, 7) * 0.9, px = (hashN(i, 1) * cssW + st.t * 16 * sp * wx + Math.sin(st.t * 0.7 + i) * 6) % (cssW + 20) - 10, py = (hashN(i, 2) * cssH + st.t * 16 * sp * wy + st.t * 8) % (cssH + 20) - 10, l = 2 + hashN(i, 3) * 4 * sp; fx.globalAlpha = (0.3 + 0.5 * hashN(i, 4)) * (1 - 0.4 * n); fx.beginPath(); L(px, py, px + wx * l, py + wy * l); fx.stroke(); }
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
