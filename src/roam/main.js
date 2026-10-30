// [roam] Hollowmere Roam, wired: the town, the rules, the look and the HUD; a fixed-step loop, a camera that follows Kai
// (and pulls back a little at speed on the bike). window.__roam exposes the sim for tests and screenshots.
/* global THREE */
import { buildTown } from './town.js';
import { createRoam, ROAM } from './sim.js';
import { createLook } from './look.js';
import { createUi } from './ui.js';
import { emit as plumeEmit, drawPlumes, plumeCount } from './atoms/plume.js';
import { createFeel } from './feel.js';
import { createScars } from './scars.js';

const $ = id => document.getElementById(id);
try { start(); } catch (e) { console.error(e); const el = $('err'); el.hidden = false; el.textContent = 'The game could not start: ' + (e && e.message || e); }

// the sky from the clock: the sun rises in the east, stands high in the north at noon, sets in the west, warm when low;
// the dark comes on over the sunset and lifts with the sunrise. The moon carries on round the south by night.
function skyAt(clock) {
  const D = ROAM.day, N = ROAM.night, c = clock % (D + N), ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  let az, el, warm;
  if (c < D) { const u = c / D; az = -u * Math.PI; el = 0.14 + 1.04 * Math.sin(u * Math.PI); warm = 1 - ss(0, 0.2, Math.min(u, 1 - u)); }
  else { const u = (c - D) / N; az = -Math.PI - u * Math.PI; el = 0.14 + 0.5 * Math.sin(u * Math.PI); warm = Math.max(0, 1 - (c - D) / 10); }
  const night = c < D / 2 ? 1 - ss(0, 14, c) : ss(D - 16, D + 6, c);
  return { night, sun: { x: Math.cos(az), y: Math.sin(az), climb: Math.tan(el), warm } };
}

function start() {
  if (typeof THREE === 'undefined') throw new Error('three.js did not load (no network?)');
  const qs = new URLSearchParams(location.search), seed = +(qs.get('seed') || 1);
  const town = buildTown(7), sim = createRoam(town, seed), S = sim.state;
  const glc = $('gl'), fxc = $('fx'), fx = fxc.getContext('2d'), look = createLook(glc, town);
  const input = { x: 0, y: 0, ride: false, dash: false, fire: false };
  const cam = { x: S.kai.x, y: S.kai.y, ppm: 22, base: 22 };
  const ui = createUi({ canvas: glc, fx, sim, cam, input });
  const feel = createFeel({ S, input, town }), scars = createScars({ tiles: town.tiles });   // [m2] burnt and soaked ground   // [m1]
  // the render scale drops when frames run slow (and creeps back when there is room): the phone keeps its frame rate
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, ema = 16, slowT = 0, fastT = 0, fastNeed = 5, fpsT = 0, fpsN = 0;
  const fpsEl = $('fps'), fixedRes = !!qs.get('fixedres');
  function resize() { cssW = innerWidth; cssH = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5) * scale; look.resize(cssW, cssH, dpr); const f = Math.min(devicePixelRatio || 1, 2); fxc.width = Math.round(cssW * f); fxc.height = Math.round(cssH * f); fx.setTransform(f, 0, 0, f, 0, 0); }
  addEventListener('resize', resize); resize();
  // the camera glides freely (the glyph grid is pinned to the world in the renderer, so still things keep their letters)
  const view = cam;
  const toS = (x, y) => [(x - view.x) * view.ppm + cssW / 2, (y - view.y) * view.ppm + cssH / 2];
  // the rules step 30 times a second, the screen 60–120: what is drawn sits between the last two steps, so Kai, the bike
  // and the dead move smoothly every frame. Render copies only: the state is never written.
  const prev = { kx: S.kai.x, ky: S.kai.y, kf: S.kai.face, bx: S.bike.x, by: S.bike.y, ba: S.bike.ang, dead: new Map() }, faMap = new Map();
  const snap = () => { const k = S.kai, b = S.bike; prev.kx = k.x; prev.ky = k.y; prev.kf = k.face; prev.bx = b.x; prev.by = b.y; prev.ba = b.ang; prev.dead.clear(); for (const d of S.dead) prev.dead.set(d.id, [d.x, d.y]); };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function between(al) {
    const L = (a, b) => Math.abs(b - a) > 6 ? b : a + (b - a) * al, LA = (a, b) => a + wrap(b - a) * al;   // a jump (respawn) is not slid
    const kai = { ...S.kai, x: L(prev.kx, S.kai.x), y: L(prev.ky, S.kai.y), face: LA(prev.kf, S.kai.face) }, bike = { ...S.bike, x: L(prev.bx, S.bike.x), y: L(prev.by, S.bike.y), ang: LA(prev.ba, S.bike.ang) };
    const dead = S.dead.map(d => { const p = prev.dead.get(d.id), o = { ...d, fa: faMap.has(d.id) ? faMap.get(d.id) : d.fa }; if (p) { o.x = L(p[0], d.x); o.y = L(p[1], d.y); } return o; });
    return { ...S, kai, bike, dead };
  }
  let running = false; $('go').addEventListener('click', () => { $('start').hidden = true; running = true; });
  if (qs.get('auto')) { $('start').hidden = true; running = true; }
  // the trees on a 16 m grid (a crown never spans more than one cell's neighbours: each tree is filed in every cell its crown touches)
  const treeGrid = new Map(); for (const p of town.trees) { const r = (p.r || p.def.size[0] / 2); for (let j = Math.floor((p.y - r) / 16); j <= Math.floor((p.y + r) / 16); j++) for (let i = Math.floor((p.x - r) / 16); i <= Math.floor((p.x + r) / 16); i++) { const kk = i * 4096 + j; if (!treeGrid.has(kk)) treeGrid.set(kk, []); treeGrid.get(kk).push(p); } }
  // chaff: what the bike (or Kai at a run) throws up from tall plants, by what it is riding through (the char map): straw
  // and ears from wheat and barley, grass seed from a meadow. Render-side only; a fixed pool
  const CHAFF = { w: ['#e2c27a', '#c9a35a', 0.9], b: ['#d8d6a4', '#b8b582', 0.85], m: ['#b9c79a', '#8fa07a', 0.4], r: ['#5d7d45', '#3f5a30', 1.1, 'leaf'], f: ['#a8642c', '#7d5a2c', 1.4, 'leaf'] };   // f: the woods floor's autumn leaves kicked up   // rape: leaves torn off the rosettes
  const chaff = Array.from({ length: 90 }, () => ({ life: 0 })); let chaffI = 0, chaffAcc = 0;
  const HG = 16, hgrid = new Map(); for (const h of (town.W._landPlan && town.W._landPlan.hedgeSegs) || []) { const xs = [h.a.x, h.b.x], ys = [h.a.y, h.b.y];
    for (let j = Math.floor((Math.min(...ys) - 2) / HG); j <= Math.floor((Math.max(...ys) + 2) / HG); j++) for (let i = Math.floor((Math.min(...xs) - 2) / HG); i <= Math.floor((Math.max(...xs) + 2) / HG); i++) { const kk = i * 4096 + j; if (!hgrid.has(kk)) hgrid.set(kk, []); hgrid.get(kk).push(h); } }
  const inHedge = (x, y) => { for (const h of hgrid.get(Math.floor(x / HG) * 4096 + Math.floor(y / HG)) || []) { const dx = h.b.x - h.a.x, dy = h.b.y - h.a.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - h.a.x) * dx + (y - h.a.y) * dy) / L2)); if (Math.hypot(x - h.a.x - dx * u, y - h.a.y - dy * u) < 1.4) return true; } return false; };
  let wasHedge = false;
  function hedgeBurst(k) { const sp = Math.hypot(k.vx, k.vy), now = sp > 1.5 && inHedge(k.x, k.y); if (now && !wasHedge) { const n = k.riding ? 26 : 10;   // a burst on the way in: leaves, twigs
      for (let q = 0; q < n; q++) { const p = chaff[chaffI++ % chaff.length], a = Math.random() * 6.283, v = 1 + Math.random() * (k.riding ? 5 : 2.5);
        Object.assign(p, { x: k.x, y: k.y, z: 0.8 + Math.random() * 0.8, vx: Math.cos(a) * v + k.vx * 0.3, vy: Math.sin(a) * v + k.vy * 0.3, vz: 2 + Math.random() * 3, life: 1.4 + Math.random(), rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 16, col: q % 5 === 0 ? '#5a3c22' : q % 2 ? '#4f6a38' : '#8a5a2c', leaf: q % 5 !== 0 }); } }
    wasHedge = now; }
  function throwChaff(k, dt) { hedgeBurst(k); const sp = Math.hypot(k.vx, k.vy), c = town.chars && CHAFF[groundAt(k.x, k.y)]; if (!c || sp < 2) return;
    chaffAcc += dt * sp * c[2] * (k.riding ? 3.2 : 1.2);
    while (chaffAcc >= 1) { chaffAcc -= 1; const p = chaff[chaffI++ % chaff.length], a = Math.atan2(k.vy, k.vx) + Math.PI + (Math.random() - 0.5) * 1.6, v = 1.5 + Math.random() * 2.5;
      Object.assign(p, { x: k.x - k.vx * 0.08, y: k.y - k.vy * 0.08, z: 0.6 + Math.random() * 0.6, vx: Math.cos(a) * v + k.vx * 0.25, vy: Math.sin(a) * v + k.vy * 0.25, vz: 1.8 + Math.random() * 2.2, life: 1.2 + Math.random() * 0.9, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 14, col: Math.random() < 0.5 ? c[0] : c[1], leaf: c[3] === 'leaf' }); if (p.leaf) { p.vz += 1.5; p.life += 0.8; } } }
  function drawChaff(dt) { fx.lineCap = 'round'; for (const p of chaff) { if (p.life <= 0) continue; p.life -= dt; p.vz -= 6 * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vx *= 0.5; p.vy *= 0.5; p.vz = 0; }
      const drag = Math.exp(-dt * 1.8); p.vx = p.vx * drag + 0.731 * 1.2 * dt; p.vy = p.vy * drag + 0.682 * 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      const [X, Y] = toS(p.x, p.y - p.z * 0.5), L = Math.max(1.5, 0.22 * view.ppm); const lt = lightAt(p.x, p.y); fx.globalAlpha = Math.min(1, p.life * 2); fx.strokeStyle = shade(p.col, lt); fx.lineWidth = Math.max(1, view.ppm * 0.035);
      if (p.leaf) { const fl = Math.abs(Math.cos(p.rot * 1.7)); fx.fillStyle = shade(p.col, lt); fx.beginPath(); fx.ellipse(X, Y, L * 0.7, Math.max(0.6, L * 0.32 * fl), p.rot, 0, 6.29); fx.fill(); continue; }   // a leaf tumbles: it thins to its edge as it turns
      fx.beginPath(); fx.moveTo(X - Math.cos(p.rot) * L / 2, Y - Math.sin(p.rot) * L / 2); fx.lineTo(X + Math.cos(p.rot) * L / 2, Y + Math.sin(p.rot) * L / 2); fx.stroke(); } fx.globalAlpha = 1; }
  // the bike's dust on dirt (ploughed fields, stubble, gravel, yards, farm tracks): the plume atom's 'dust' preset
  // what the ground is under (x, y), by the char map: under a tree in a wood it is still the woods floor ('f')
  const groundAt = (x, y) => { const c = town.chars ? town.chars.at(x, y) : ' '; if (c !== 'T') return c; for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) if (town.chars.at(x + dx, y + dy) === 'f') return 'f'; return c; };
  const DUSTY = new Set(['%', 's', ':', 't', 'f']); let dustAcc = 0;
  function dustOf(k, dt) { if (!k.riding || !town.chars) return; const sp = Math.hypot(k.vx, k.vy), g = groundAt(k.x, k.y); if (sp < 3 || !DUSTY.has(g)) return;
    if (g === 'f') { dustAcc += dt * sp * 0.6; while (dustAcc >= 1) { dustAcc -= 1; plumeEmit('dust', k.x - k.vx * 0.12, k.y - k.vy * 0.12, 0.2, -k.vx * 0.12, -k.vy * 0.12, 0.5 + sp / 30); } return; }   // the woods floor: damp, a thin haze
    dustAcc += dt * sp * 1.4; while (dustAcc >= 1) { dustAcc -= 1; plumeEmit('dust', k.x - k.vx * 0.12, k.y - k.vy * 0.12, 0.2, -k.vx * 0.15, -k.vy * 0.15, 0.7 + sp / 20); } }
  // the light on a particle at (x, y): the sky (bright by day, dim and blue by night), the bike's headlight cone, a lit
  // window's spill (the light map, sampled on the CPU from the painted tiles). Particles drawn on the overlay multiply by it
  function lightAt(x, y) { let l = 1 - 0.78 * curNight; const b = S.bike;
    if (S.kai.riding) { const hx = b.x + Math.cos(b.ang) * 1.68, hy = b.y + Math.sin(b.ang) * 1.68, dx = x - hx, dy = y - hy, r = Math.hypot(dx, dy), cs = (dx * Math.cos(b.ang) + dy * Math.sin(b.ang)) / (r || 1);
      const head = Math.max(0, Math.min(1, (cs - 0.84) / 0.11)) * Math.max(0, 1 - Math.max(0, r - 6) / 18) * (0.25 + 0.75 * curNight); l += head * 1.1;
      l += Math.max(0, 1 - Math.hypot(x - b.x, y - b.y) / 2.5) * 0.3 * curNight; }   // the lamp's own glow round the bike
    return Math.min(1.2, l); }
  const shade = (hex, l) => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(Math.min(255, v * l)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  let curNight = 0;
  const falls = []; let acc = 0, last = performance.now(), t = 0;
  function frame(now) {
    const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, raw); last = now; t += dt;
    if (raw < 2) { ema += (raw * 1000 - ema) * 0.08; fpsT += raw; fpsN++; }
    { const rt = Math.min(raw, 2); if (ema > 24) { slowT += rt; fastT = 0; } else if (ema < 15) { fastT += rt; slowT = 0; } else slowT = fastT = 0; }   // real seconds, not game time
    if (fixedRes) slowT = fastT = 0;   // ?fixedres=1: for measuring
    if (slowT > 1.2 && scale > 0.7) { scale = Math.max(0.7, scale - 0.15); fastNeed = Math.min(60, fastNeed * 2); slowT = 0; ema = 18; resize(); }
    else if (fastT > fastNeed && scale < 1) { scale = Math.min(1, scale + 0.15); fastT = 0; resize(); }
    if (fpsT > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps · ${Math.round(scale * 100)}%`; fpsT = 0; fpsN = 0; }
    input.view = Math.hypot(cssW, cssH) / 2 / cam.ppm;   // what the player can see, for the dead to appear out of it
    if (running && !ui.paused && !feel.frozen(dt)) { acc += dt; while (acc >= ROAM.step) { snap(); sim.step(input); acc -= ROAM.step; } }   // [m1] a hitstop holds the rules for a few frames
    const R = between(running ? acc / ROAM.step : 1);
    const evs = sim.drain();
    for (const e of evs) if (e.type === 'smash') falls.push({ x: e.x, y: e.y, fa: e.ang, id: 100000 + e.id, t0: t, prop: true, stamp: true });   // a smashed prop bursts into letters like a fall
    for (const e of evs) if (e.type === 'die') falls.push({ x: e.x, y: e.y, fa: e.fa, id: e.id, t0: t, metal: e.kind !== 'cinder' && e.kind !== 'flicker', brute: e.kind === 'brute', stamp: true });
    feel.events(evs, t);   // [m1] hitstop, shake, sparks, bursts
    scars.events(evs, t);
    while (falls.length && t - falls[0].t0 > 2.2) falls.shift();
    const { night, sun } = skyAt(S.clock); curNight = night;
    // the camera: follows Kai, leads her a little; on the bike it pulls back with the speed so you see what's coming
    const k = R.kai, lead = k.riding ? 0.55 : 0.3;
    cam.x += (k.x + k.vx * lead - cam.x) * Math.min(1, dt * 5); cam.y += (k.y + k.vy * lead - cam.y) * Math.min(1, dt * 5);
    // the zoom eases to the pinch's and then holds still exactly (a zoom that never quite settles re-samples every glyph);
    // no pull-back with the bike's speed for the same reason
    { const want = cam.base; cam.ppm += (want - cam.ppm) * Math.min(1, dt * 6); if (Math.abs(want - cam.ppm) < want * 0.004) cam.ppm = want; }
    const shook = feel.shake(cam, dt);   // [m1] the camera shakes for this frame only
    look.render({ cam: view, cssW, cssH, dpr, S: R, falls, t, night, dt, sun });
    fx.clearRect(0, 0, cssW, cssH);
    const kaiUnder = (treeGrid.get(Math.floor(k.x / 16) * 4096 + Math.floor(k.y / 16)) || []).some(p => Math.hypot(p.x - k.x, p.y - k.y) < (p.r || p.def.size[0] / 2) * 0.8);   // under a crown: her cloth hides with her
    // the little lives (birds, blowing paper) near the camera take a step: render-side, they never touch the rules
    for (const i of town.dress.live) { if (Math.abs(i.x - cam.x) > 90 || Math.abs(i.y - cam.y) > 120) continue; if (!i.st) i.atom.live.init(i); i.atom.live.step(i, dt, { kai: R.kai, t, night, WIND: { x: 0.731, y: 0.682 }, town }); }
    try { look.draw(fx, { lightAt, broken: S.broken, sun, strands: town.dress.strands, live: town.dress.live, kaiUnder, toS, cam: view, cssW, cssH, kai: R.kai, dead: R.dead, flakes: [], deaths: falls, tracers: [], nests: S.nests, bike: R.bike, t, night, WIND: { x: 0.731, y: 0.682 } }); } catch (e) { if (!frame.warned) { frame.warned = true; console.error(e); } }
    for (const o of R.dead) if (o.fa !== undefined) faMap.set(o.id, o.fa); if (faMap.size > 4 * S.dead.length + 50) faMap.clear();   // the dead keep facing where they last walked
    dustOf(R.kai, dt); drawPlumes(fx, toS, view.ppm, dt, { x: 0.731, y: 0.682 }, night, cssW, cssH, lightAt);
    throwChaff(R.kai, dt); drawChaff(dt);
    feel.draw(fx, toS, view.ppm, dt, R, lightAt, cssW, cssH);   // [m1] pellets, muzzle flash, sparks, bursts
    shook();
    ui.arrows(toS, cssW, cssH); ui.update(evs);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__roam = { sim, S, input, cam, skyAt, look, town, plumeCount, plumeEmit, drawPlumes, run: sec => { for (let i = 0; i < sec / ROAM.step; i++) sim.step(input); cam.x = S.kai.x; cam.y = S.kai.y; } };
}
