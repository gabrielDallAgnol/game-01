// Atom Lab: builds a chapter from atoms with the engine pipeline, draws it with roles,
// lets you walk it on a phone, shows the validators and overlays, and inspects any atom.
import { RECIPES, recipeRegistry, buildArea } from '../../src/engine/recipes.js';
import { paintWorld, paintOverlays, SUN } from '../../src/engine/draw2d.js';
import { PALETTES, resolve } from '../../src/engine/palettes.js';
import { SPEED, HUMAN } from '../../src/engine/units.js';
import { pointInObb } from '../../src/engine/geom.js';

const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const regs = {}, regFor = id => regs[id] || (regs[id] = recipeRegistry(id));
const st = { map: false, seed: 7, area: 'suburb', chapter: 'ch1', ov: { sockets: false, nav: false, collision: false, lots: false }, viewM: 50, res: null, win: null, zoomAt: 0, hero: { x: 0, y: 0, vx: 0, vy: 0, face: { x: 0, y: 1 }, walk: 0 }, cam: { x: 0, y: 0 }, keys: {}, joy: { on: false, x: 0, y: 0 }, pick: null, t: 0 };

function build() {
  const t0 = performance.now();
  st.res = buildArea(st.area, st.seed, regFor(st.area));
  st.buildMs = performance.now() - t0;
  repaint();
  const W = st.res.W; st.hero.x = W.camp.x + 3; st.hero.y = W.camp.y - 4; st.cam.x = st.hero.x; st.cam.y = st.hero.y; st.pick = null;
  renderReport(); renderInspector();
}
function repaint() { st.win = null; document.body.style.background = resolve(st.chapter, 'ground.base'); }
// a window cache: the world around the camera painted at device resolution, repainted when the
// camera leaves it or the zoom settles, so lines stay sharp at every zoom without one huge canvas.
function windowFor(s, dpr, vw, vh) {
  const w = st.win, v = { x0: st.cam.x - vw / 2, y0: st.cam.y - vh / 2, x1: st.cam.x + vw / 2, y1: st.cam.y + vh / 2 }, k = w ? s / w.s : 0;
  const inside = w && v.x0 > w.x0 && v.y0 > w.y0 && v.x1 < w.x1 && v.y1 < w.y1, settled = performance.now() - st.zoomAt > 180;
  if (w && inside && (k === 1 || (!settled && k > 0.8 && k < 1.25))) return w;
  const mx = vw * 0.4, my = vh * 0.4, R = { x0: v.x0 - mx, y0: v.y0 - my, x1: v.x1 + mx, y1: v.y1 + my, s };
  const mk = old => { const cv = old || document.createElement('canvas'); cv.width = Math.ceil((R.x1 - R.x0) * s * dpr); cv.height = Math.ceil((R.y1 - R.y0) * s * dpr); const c = cv.getContext('2d'); c.setTransform(s * dpr, 0, 0, s * dpr, -R.x0 * s * dpr, -R.y0 * s * dpr); return [cv, c]; };
  const [g, gc] = mk(w && w.g), [o, oc] = mk(w && w.o); paintWorld(gc, oc, st.res.W, st.chapter, R);
  let ov = null; if (Object.values(st.ov).some(Boolean)) { const [cv, c] = mk(w && w.ov); paintOverlays(c, st.res.W, st.ov, R); ov = cv; }
  return (st.win = { ...R, g, o, ov });
}

function renderReport() {
  const r = st.res, W = r.W, d = regFor(st.area).describe();
  const rows = r.results.map(v => `<li class="${v.ok ? 'ok' : v.fatal ? 'bad' : 'warn'}"><b>${v.ok ? '✓' : v.fatal ? '✕' : '!'}</b> ${v.name}<small>${v.msg}</small></li>`).join('');
  const counts = { buildings: W.placed.filter(p => p.def.kind === 'building').length, trees: W.byTag('tree').length, 'walls & fences': W.fences.length, lamps: W.byTag('lamp').length, cars: W.byTag('car').length, streets: W.streets.length, junctions: W.nodes.length, rails: W.rails.length, runs: W.runs.length };
  $('report').innerHTML = `<div class="kv"><span>seed</span><b>${st.seed}</b><span>hash</span><b>${r.hash}</b><span>tries</span><b>${r.attempts}</b><span>build</span><b>${st.buildMs.toFixed(0)} ms</b><span>size</span><b>${W.w} × ${W.h} m</b><span>atoms</span><b>${d.atoms} kinds · ${W.placed.length} placed</b></div>
    <h4>validators</h4><ul class="val">${rows}</ul>
    <h4>stages</h4><div class="stages">${r.times.map(t => `<span>${t.stage}<i>${t.ms} ms</i></span>`).join('')}</div>
    <h4>counts</h4><div class="stages">${Object.entries(counts).map(([k, v]) => `<span>${k}<i>${v}</i></span>`).join('')}</div>`;
}
function renderInspector() {
  const p = st.pick, el = $('insp');
  if (!p) { el.hidden = true; return; }
  el.hidden = false;
  const def = p.def, data = { id: p.id, uid: p.uid, kind: def.kind, size_m: def.size, height_m: def.height, layer: def.layer, collide: def.collide, roles: def.roles, sockets: def.sockets.map(s => `${s.type}@${s.at}`), needs: def.needs, offers: def.offers, tags: def.tags, at: [+p.x.toFixed(1), +p.y.toFixed(1)], rot: +p.rot.toFixed(2), lot: p.lot || null, seed: p.seedPath || null };
  el.innerHTML = `<div class="ih"><b>${p.id}</b><button id="ix" type="button" aria-label="Close">×</button></div><pre>${JSON.stringify(data, null, 1)}</pre>`;
  $('ix').onclick = () => { st.pick = null; renderInspector(); };
}

// ---- movement on the nav grid ----
const blocked = (x, y) => { const N = st.res.W.nav, i = Math.floor(x), j = Math.floor(y); if (i < 0 || j < 0 || i >= N.w || j >= N.h) return true; return !!N.blocked[j * N.w + i]; };
const free = (x, y) => { const r = HUMAN.radius; return !blocked(x - r, y - r) && !blocked(x + r, y - r) && !blocked(x - r, y + r) && !blocked(x + r, y + r); };
const inWater = (x, y) => st.res.W.water.some(w => Math.abs(x - w.fx(y)) < w.w / 2) && !st.res.W.bridges.some(b => pointInObb(b, x, y));
function step(dt) {
  const h = st.hero, k = st.keys; let vx = 0, vy = 0, run = k.shift;
  if (k.a || k.arrowleft) vx -= 1; if (k.d || k.arrowright) vx += 1; if (k.w || k.arrowup) vy -= 1; if (k.s || k.arrowdown) vy += 1;
  let mag = Math.hypot(vx, vy); if (mag) { vx /= mag; vy /= mag; mag = 1; }
  if (st.joy.on) { const m = Math.hypot(st.joy.x, st.joy.y); if (m > 0.14) { vx = st.joy.x / m; vy = st.joy.y / m; mag = Math.min(1, (m - 0.14) / 0.7 + 0.35); run = m > 0.92; } }
  const sp = (run ? SPEED.run : SPEED.walk) * mag * (inWater(h.x, h.y) ? 0.42 : 1), acc = 1 - Math.pow(0.0008, dt);
  h.vx += (vx * sp - h.vx) * acc; h.vy += (vy * sp - h.vy) * acc;
  const nx = h.x + h.vx * dt, ny = h.y + h.vy * dt;
  if (free(nx, h.y)) h.x = nx; else h.vx = 0;
  if (free(h.x, ny)) h.y = ny; else h.vy = 0;
  const s = Math.hypot(h.vx, h.vy); if (s > 0.3) h.face = { x: h.vx / s, y: h.vy / s }; h.walk += s * dt * 1.6;
  if (st.map) { st.cam.x = st.res.W.w / 2; st.cam.y = st.res.W.h / 2; } else { st.cam.x += (h.x + h.vx * 0.35 - st.cam.x) * Math.min(1, dt * 4); st.cam.y += (h.y + h.vy * 0.35 - st.cam.y) * Math.min(1, dt * 4); }
  const dd = st.res.W.districtAt && st.res.W.districtAt(h.x, h.y); $('pos').textContent = `${h.x.toFixed(0)}, ${h.y.toFixed(0)} m · ${s.toFixed(1)} m/s${dd ? ` · ${dd.name}` : ''}`;
}
const underOverhead = (x, y) => st.res.W.placed.some(p => (p.def.layer === 'roof' && pointInObb(p, x, y)) || (p.def.kind === 'tree' && Math.hypot(p.x - x, p.y - y) < (p.r || p.def.size[0] / 2) * 0.9));

// ---- render ----
const oC = document.createElement('canvas'), oX = oC.getContext('2d');
function render() {
  const dpr = Math.min(2, devicePixelRatio || 1), R = cv.getBoundingClientRect(), Wd = Math.round(R.width * dpr), Hd = Math.round(R.height * dpr);
  if (cv.width !== Wd || cv.height !== Hd) { cv.width = Wd; cv.height = Hd; }
  const s = Math.max(R.width, R.height) / st.viewM, W = st.res.W, L = windowFor(s, dpr, R.width / s, R.height / s), lx = ox0 => ox0 + L.x0 * s, LW = (L.x1 - L.x0) * s, LH = (L.y1 - L.y0) * s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = resolve(st.chapter, 'ground.base'); ctx.fillRect(0, 0, R.width, R.height);
  const ox = R.width / 2 - st.cam.x * s, oy = R.height / 2 - st.cam.y * s;
  ctx.imageSmoothingEnabled = true; ctx.drawImage(L.g, lx(ox), oy + L.y0 * s, LW, LH);
  // the hero: shoulders, pack, scarf, head, System ring
  const h = st.hero, hx = ox + h.x * s, hy = oy + h.y * s, ang = Math.atan2(h.face.y, h.face.x), m = s, bob = Math.sin(h.walk) * 0.05 * m;
  ctx.fillStyle = resolve(st.chapter, 'shadow'); ctx.beginPath(); ctx.ellipse(hx - SUN.x * 0.5 * m, hy - SUN.y * 0.4 * m, 0.45 * m, 0.3 * m, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = resolve(st.chapter, 'accent.system'); ctx.lineWidth = Math.max(1, 0.08 * m); ctx.beginPath(); ctx.ellipse(hx, hy + 0.1 * m, 0.75 * m, 0.32 * m, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = resolve(st.chapter, 'accent.scarf'); ctx.lineWidth = 0.16 * m; ctx.lineCap = 'round'; const sw = Math.sin(st.t * 8) * 0.12 * m; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx - h.face.x * 0.6 * m - h.face.y * sw, hy - h.face.y * 0.6 * m + h.face.x * sw, hx - h.face.x * 1.05 * m, hy - h.face.y * 1.05 * m); ctx.stroke();
  ctx.save(); ctx.translate(hx, hy + bob); ctx.rotate(ang + Math.PI / 2);
  ctx.fillStyle = '#E8833A'; ctx.beginPath(); ctx.roundRect(-0.22 * m, 0.12 * m, 0.44 * m, 0.28 * m, 0.06 * m); ctx.fill();
  ctx.fillStyle = resolve(st.chapter, 'accent.hero'); ctx.beginPath(); ctx.ellipse(0, 0, 0.4 * m, 0.24 * m, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1F2024'; ctx.beginPath(); ctx.arc(0, -0.02 * m, 0.2 * m, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // roofs and canopies, cut away softly where the hero stands under them
  if (oC.width !== Wd) { oC.width = Wd; oC.height = Hd; }
  oX.setTransform(1, 0, 0, 1, 0, 0); oX.clearRect(0, 0, Wd, Hd); oX.setTransform(dpr, 0, 0, dpr, 0, 0); oX.drawImage(L.o, lx(ox), oy + L.y0 * s, LW, LH);
  if (underOverhead(h.x, h.y)) { const r = 3.2 * s, g = oX.createRadialGradient(hx, hy, r * 0.35, hx, hy, r); g.addColorStop(0, 'rgba(0,0,0,0.88)'); g.addColorStop(1, 'rgba(0,0,0,0)'); oX.globalCompositeOperation = 'destination-out'; oX.fillStyle = g; oX.fillRect(hx - r, hy - r, 2 * r, 2 * r); oX.globalCompositeOperation = 'source-over'; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(oC, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (L.ov) ctx.drawImage(L.ov, lx(ox), oy + L.y0 * s, LW, LH);
  if (st.pick) { const p = st.pick; ctx.save(); ctx.translate(ox + p.x * s, oy + p.y * s); ctx.rotate(p.rot); ctx.strokeStyle = resolve(st.chapter, 'accent.system'); ctx.lineWidth = 2; ctx.setLineDash([6, 4]); const pw = p.def.kind === 'tree' ? (p.r || p.def.size[0] / 2) * 2 : p.w, ph = p.def.kind === 'tree' ? pw : p.h; ctx.strokeRect(-pw / 2 * s, -ph / 2 * s, pw * s, ph * s); ctx.restore(); }
  // vignette
  const vg = ctx.createRadialGradient(R.width / 2, R.height / 2, Math.min(R.width, R.height) * 0.4, R.width / 2, R.height / 2, Math.max(R.width, R.height) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,10,20,0.16)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, R.width, R.height);
  // map mode: district names and the finale, in screen space
  if (st.map && W.districts) { ctx.font = "500 10px 'IBM Plex Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t, col) => { const w = ctx.measureText(t).width + 10; ctx.fillStyle = 'rgba(20,21,26,0.72)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 8, w, 16, 8); ctx.fill(); ctx.fillStyle = col || '#F2EEE2'; ctx.fillText(t, x, y); };
    W.districts.forEach(d => tag(ox + d.at.x * s, oy + d.at.y * s, d.name));
    if (W.finale) tag(ox + W.finale.x * s, oy + W.finale.y * s - 18, 'finale', resolve(st.chapter, 'accent.ember')); }
}

// ---- input ----
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; st.keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => { st.keys[e.key.toLowerCase()] = false; });
cv.addEventListener('wheel', e => { e.preventDefault(); setView(st.viewM * (1 + e.deltaY * 0.0012)); }, { passive: false });
function setView(m) { const W = st.res && st.res.W; st.viewM = Math.max(30, Math.min(st.map && W ? fitM() * 1.1 : 90, m)); st.zoomAt = performance.now(); $('zoom').value = st.viewM; }
const pts = new Map(); let pinch0 = 0, view0 = 50, down = null;
cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, e); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); view0 = st.viewM; st.joy.on = false; $('jb').hidden = true; return; }
  down = { x: e.clientX, y: e.clientY, t: performance.now() }; const R = cv.getBoundingClientRect();
  if (e.clientX - R.left < R.width * 0.5) { st.joy = { on: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0, id: e.pointerId }; const jb = $('jb'); jb.style.left = (e.clientX - R.left) + 'px'; jb.style.top = (e.clientY - R.top) + 'px'; jb.hidden = false; $('jk').style.transform = 'translate(-50%,-50%)'; } });
cv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
  if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch0) setView(view0 * pinch0 / d); return; }
  if (st.joy.on && e.pointerId === st.joy.id) { let dx = e.clientX - st.joy.ox, dy = e.clientY - st.joy.oy; const d = Math.hypot(dx, dy), RJ = 56; if (d > RJ) { dx = dx / d * RJ; dy = dy / d * RJ; } st.joy.x = dx / RJ; st.joy.y = dy / RJ; $('jk').style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; } });
const end = e => { pts.delete(e.pointerId); if (st.joy.on && e.pointerId === st.joy.id) { st.joy.on = false; $('jb').hidden = true; }
  if (down && pts.size === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 350) inspectAt(e.clientX, e.clientY); down = null; if (pts.size < 2) pinch0 = 0; };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
function inspectAt(cx, cy) {
  const R = cv.getBoundingClientRect(), s = Math.max(R.width, R.height) / st.viewM, x = st.cam.x + (cx - R.left - R.width / 2) / s, y = st.cam.y + (cy - R.top - R.height / 2) / s, W = st.res.W;
  const order = ['canopy', 'roof', 'low', 'drive', 'road'];
  let hit = null; for (const layer of order) { hit = W.placed.slice().reverse().find(p => p.def.layer === layer && (p.def.kind === 'tree' ? Math.hypot(p.x - x, p.y - y) < (p.r || p.def.size[0] / 2) : pointInObb(p, x, y, p.w < 2 ? 0.8 : 0))); if (hit) break; }
  st.pick = hit || null; renderInspector();
}

// ---- panel ----
$('seed').addEventListener('change', e => { st.seed = Math.max(0, parseInt(e.target.value, 10) || 0); build(); });
$('prev').onclick = () => { st.seed = Math.max(0, st.seed - 1); $('seed').value = st.seed; build(); };
$('next').onclick = () => { st.seed += 1; $('seed').value = st.seed; build(); };
$('area').innerHTML = Object.entries(RECIPES).map(([k, r]) => `<option value="${k}">${r.name}</option>`).join('');
$('area').addEventListener('change', e => { st.area = e.target.value; build(); });
$('pal').innerHTML = Object.entries(PALETTES).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
$('pal').addEventListener('change', e => { st.chapter = e.target.value; repaint(); });
document.querySelectorAll('[data-ov]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.ov; st.ov[k] = !st.ov[k]; b.setAttribute('aria-pressed', String(st.ov[k])); repaint(); }));
$('zoom').addEventListener('input', e => setView(+e.target.value));
$('fold').onclick = () => { const p = $('panel'); p.classList.toggle('folded'); $('fold').textContent = p.classList.contains('folded') ? 'show' : 'hide'; };
$('map').onclick = () => setMap(!st.map);
// the view (metres across the longer screen side) that fits the whole world on screen
function fitM() { const R = cv.getBoundingClientRect(), W = st.res.W, L = Math.max(R.width, R.height); return Math.max(W.w * L / R.width, W.h * L / R.height) * 1.02; }
function setMap(v) { st.map = v; $('map').setAttribute('aria-pressed', String(v)); setView(v ? fitM() : 50); }
$('camp').onclick = () => { const W = st.res.W; st.hero.x = W.camp.x + 3; st.hero.y = W.camp.y - 4; };

let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; st.t += dt; step(dt); render(); requestAnimationFrame(loop); }
const start = () => { $('seed').value = st.seed; if (innerWidth < 700) $('panel').classList.add('folded'), $('fold').textContent = 'show'; build(); requestAnimationFrame(loop); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
window.__lab = { st, build, regFor, setArea: a => { st.area = a; $('area').value = a; build(); }, setSeed: n => { st.seed = n; $('seed').value = n; build(); }, setChapter: k => { st.chapter = k; $('pal').value = k; repaint(); }, setOverlay: (k, v) => { st.ov[k] = v; repaint(); }, setView, setMap, teleport: (x, y) => { st.hero.x = x; st.hero.y = y; st.cam.x = x; st.cam.y = y; }, info: () => ({ seed: st.seed, hash: st.res.hash, tries: st.res.attempts, results: st.res.results }) };
