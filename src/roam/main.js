// [roam] Hollowmere Roam, wired: the town, the rules, the look and the HUD; a fixed-step loop, a camera that follows Kai
// (and pulls back a little at speed on the bike). window.__roam exposes the sim for tests and screenshots.
/* global THREE */
import { buildTown } from './town.js';
import { createRoam, ROAM } from './sim.js';
import { createLook } from './look.js';
import { createUi } from './ui.js';

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
  const input = { x: 0, y: 0, ride: false, dash: false };
  const cam = { x: S.kai.x, y: S.kai.y, ppm: 22, base: 22 };
  const ui = createUi({ canvas: glc, fx, sim, cam, input });
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
  const falls = []; let acc = 0, last = performance.now(), t = 0;
  function frame(now) {
    const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, raw); last = now; t += dt;
    if (raw < 2) { ema += (raw * 1000 - ema) * 0.08; fpsT += raw; fpsN++; }
    { const rt = Math.min(raw, 2); if (ema > 24) { slowT += rt; fastT = 0; } else if (ema < 15) { fastT += rt; slowT = 0; } else slowT = fastT = 0; }   // real seconds, not game time
    if (fixedRes) slowT = fastT = 0;   // ?fixedres=1: for measuring
    if (slowT > 1.2 && scale > 0.7) { scale = Math.max(0.7, scale - 0.15); fastNeed = Math.min(60, fastNeed * 2); slowT = 0; ema = 18; resize(); }
    else if (fastT > fastNeed && scale < 1) { scale = Math.min(1, scale + 0.15); fastT = 0; resize(); }
    if (fpsT > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps · ${Math.round(scale * 100)}%`; fpsT = 0; fpsN = 0; }
    if (running) { acc += dt; while (acc >= ROAM.step) { snap(); sim.step(input); acc -= ROAM.step; } }
    const R = between(running ? acc / ROAM.step : 1);
    const evs = sim.drain();
    for (const e of evs) if (e.type === 'smash') falls.push({ x: e.x, y: e.y, fa: e.ang, id: 100000 + e.id, t0: t, prop: true, stamp: true });   // a smashed prop bursts into letters like a fall
    for (const e of evs) if (e.type === 'die') falls.push({ x: e.x, y: e.y, fa: e.fa, id: e.id, t0: t, brute: e.kind === 'brute', stamp: true });
    while (falls.length && t - falls[0].t0 > 2.2) falls.shift();
    const { night, sun } = skyAt(S.clock);
    // the camera: follows Kai, leads her a little; on the bike it pulls back with the speed so you see what's coming
    const k = R.kai, lead = k.riding ? 0.55 : 0.3;
    cam.x += (k.x + k.vx * lead - cam.x) * Math.min(1, dt * 5); cam.y += (k.y + k.vy * lead - cam.y) * Math.min(1, dt * 5);
    // the zoom eases to the pinch's and then holds still exactly (a zoom that never quite settles re-samples every glyph);
    // no pull-back with the bike's speed for the same reason
    { const want = cam.base; cam.ppm += (want - cam.ppm) * Math.min(1, dt * 6); if (Math.abs(want - cam.ppm) < want * 0.004) cam.ppm = want; }
    look.render({ cam: view, cssW, cssH, dpr, S: R, falls, t, night, dt, sun });
    fx.clearRect(0, 0, cssW, cssH);
    const kaiUnder = town.trees.some(p => Math.hypot(p.x - k.x, p.y - k.y) < (p.r || p.def.size[0] / 2) * 0.8);   // under a crown: her cloth hides with her
    // the little lives (birds, blowing paper) near the camera take a step: render-side, they never touch the rules
    for (const i of town.dress.live) { if (Math.abs(i.x - cam.x) > 90 || Math.abs(i.y - cam.y) > 120) continue; if (!i.st) i.atom.live.init(i); i.atom.live.step(i, dt, { kai: R.kai, t, night, WIND: { x: 0.731, y: 0.682 }, town }); }
    try { look.draw(fx, { sun, strands: town.dress.strands, live: town.dress.live, kaiUnder, toS, cam: view, cssW, cssH, kai: R.kai, dead: R.dead, flakes: [], deaths: falls, tracers: [], nests: S.nests, bike: R.bike, t, night, WIND: { x: 0.731, y: 0.682 } }); } catch (e) { if (!frame.warned) { frame.warned = true; console.error(e); } }
    for (const o of R.dead) if (o.fa !== undefined) faMap.set(o.id, o.fa); if (faMap.size > 4 * S.dead.length + 50) faMap.clear();   // the dead keep facing where they last walked
    ui.arrows(toS, cssW, cssH); ui.update(evs);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__roam = { sim, S, input, cam, skyAt, look, town, run: sec => { for (let i = 0; i < sec / ROAM.step; i++) sim.step(input); cam.x = S.kai.x; cam.y = S.kai.y; } };
}
