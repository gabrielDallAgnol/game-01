// [roam] The HUD and the controls: health, areas cleaned, the clock; the Ride and Dash buttons; a floating stick (drag
// anywhere), pinch and wheel to zoom, WASD/arrows, E to ride, Space to dash; toasts from the sim's events; and the
// arrows at the screen's edge to the walker and to the parked bike. Writes only `input` and the camera's base zoom.
import { MACHINES } from '../play/machines.js';
export function createUi({ canvas, fx, sim, cam, input }) {
  const $ = id => document.getElementById(id), S = sim.state;
  const hpEl = $('hp'), hpBar = hpEl.querySelector('.bar i'), heatBar = $('heat').firstElementChild, nestsEl = $('nests').querySelector('b'), clockEl = $('clock'), rideBtn = $('ride'), dashBtn = $('dash'), stick = $('stick'), toasts = $('toasts');
  const toast = (text, big) => { const el = document.createElement('div'); el.className = 'toast' + (big ? ' big' : ''); el.textContent = text; toasts.appendChild(el); setTimeout(() => el.remove(), 3300); while (toasts.children.length > 3) toasts.firstChild.remove(); };
  // ---------- buttons ----------
  const press = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  press(rideBtn, () => { input.ride = true; }); press(dashBtn, () => { input.dash = true; });
  // [m1] FIRE is held: down starts, up / cancel / leaving the button stops
  const fireBtn = $('fire'), setFire = on => { input.fire = on; fireBtn.classList.toggle('on', on); };
  // hold FIRE: the gun aims itself; drag off the button while holding: it fires where you drag (the screen is the map,
  // north up, so a screen direction is a world direction)
  function holdAim(btn, set, aimKey) { let x0 = 0, y0 = 0;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); btn.setPointerCapture(e.pointerId); x0 = e.clientX; y0 = e.clientY; input[aimKey] = null; set(true); });
    btn.addEventListener('pointermove', e => { const dx = e.clientX - x0, dy = e.clientY - y0; if (btn.classList.contains('on')) input[aimKey] = Math.hypot(dx, dy) > 18 ? Math.atan2(dy, dx) : null; });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => { set(false); input[aimKey] = null; }); }
  holdAim(fireBtn, setFire, 'aim');
  // [m2] the loadout (a test control until the garage): the gun's element, the off-hand's enchant and how often, mods.
  // The game pauses while it is open; changes go through the sim's API (setLoadout)
  const kitEl = $('loadout'), LO = { base: null, el: '', enchant: 'water', every: 2, mods: [] };
  const paintKit = () => { for (const g of kitEl.querySelectorAll('.opts')) { const k = g.dataset.k; for (const b of g.children) b.classList.toggle('on', k === 'mods' ? LO.mods.includes(b.dataset.v) : String(LO[k] ?? '') === b.dataset.v); }
    fireBtn.className = 'pb fire el-' + (LO.el || '') + (input.fire ? ' on' : ''); };
  for (const g of kitEl.querySelectorAll('.opts')) for (const b of g.children) b.addEventListener('click', () => { const k = g.dataset.k, v = b.dataset.v;
    if (k === 'mods') LO.mods = LO.mods.includes(v) ? LO.mods.filter(m => m !== v) : [...LO.mods, v]; else LO[k] = k === 'every' ? +v : (v || null);
    sim.setLoadout(LO); paintKit(); });
  press($('kit'), () => { kitEl.hidden = false; ui.paused = true; paintKit(); }); for (const id of ['kitDone', 'kitX']) for (const t of ['pointerdown', 'pointerup', 'touchend', 'click']) $(id).addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); kitEl.hidden = true; ui.paused = false; }, { passive: false });
  const ui = { paused: false }; sim.setLoadout(LO); paintKit();
  // the clock speed (a test control): 1x, 10x, 30x; only the day passes faster
  const speedEl = $('speed'), RATES = [1, 10, 30];
  press(speedEl, () => { const r = RATES[(RATES.indexOf(S.clockRate) + 1) % RATES.length]; sim.setClockRate(r); speedEl.textContent = r + '×'; speedEl.classList.toggle('fast', r > 1); speedEl.setAttribute('aria-label', `Clock speed: ${r}x. Tap to change`); });
  // ---------- the stick, pinch, wheel ----------
  const pts = new Map(); let mover = null, pinch0 = 0;
  const zoom = k => { cam.base = Math.max(4, Math.min(40, cam.base * k)); };   // the base zoom: the bike's speed pulls back from it, it never fights a pinch
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
    if (pts.size === 2) { mover = null; input.x = input.y = 0; stick.hidden = true; const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); return; }
    mover = e.pointerId; stick.hidden = false; stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.firstElementChild.style.transform = ''; });
  canvas.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) zoom(d / pinch0); pinch0 = d; return; }
    if (e.pointerId === mover) { const ox = p.x - p.x0, oy = p.y - p.y0, r = Math.hypot(ox, oy); if (r > 6) { const k = Math.min(1, r / 50); input.x = ox / r * k; input.y = oy / r * k; } else input.x = input.y = 0; stick.firstElementChild.style.transform = `translate(${ox / Math.max(r, 1) * Math.min(r, 36)}px, ${oy / Math.max(r, 1) * Math.min(r, 36)}px)`; } });
  const up = e => { pts.delete(e.pointerId); if (e.pointerId === mover) { mover = null; input.x = input.y = 0; stick.hidden = true; } if (pts.size < 2) pinch0 = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  const keys = {};
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); keys[k] = true; if (k === 'e') input.ride = true; if (k === ' ' || k === 'j') { if (S.kai.riding) setFire(true); else input.dash = true; e.preventDefault(); } if (k === '+' || k === '=') zoom(1.2); if (k === '-') zoom(0.83); if (k === 't') speedEl.dispatchEvent(new PointerEvent('pointerdown')); });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys[k] = false; if (k === ' ' || k === 'j') setFire(false); });
  function keyInput() { if (mover !== null) return; const x = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), y = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0); if (x || y) { const r = Math.hypot(x, y); input.x = x / r; input.y = y / r; input.key = true; } else if (input.key) { input.x = input.y = 0; input.key = false; } }
  // ---------- events → words ----------
  const WORDS = { dusk: ['Dusk. The machines wake hungry.', true], dawn: ['Dawn. The machines slow and power down.', true], down: ['Wrecked. Back at the square in a moment.'], back: ['Back on the bike.'], crash: ['Crash!'], won: ['Every area is clean. Hollowmere breathes.', true] };
  // the first time each machine comes for you, a line on what it does (the game teaches by meeting, not a manual)
  const met = new Set(['crawler']);
  function meet() { const k = S.kai; for (const d of S.dead) if (!met.has(d.kind) && d.state === 'chase' && Math.hypot(d.x - k.x, d.y - k.y) < 20 && MACHINES[d.kind]) { met.add(d.kind); toast(`${MACHINES[d.kind].name}: ${MACHINES[d.kind].desc}`); } }
  let huntN = 0;
  let burnTold = false, blastTold = false;
  function onEvents(evs) { for (const e of evs) { if (e.type === 'scorch' && !burnTold) { burnTold = true; toast('Fire burns you too. Get out of it.', true); } else if (e.type === 'blast' && e.r > 4 && !blastTold) { blastTold = true; toast('Cars blow when they burn.'); } if (e.type === 'hunt') { huntN++; if (huntN === 1) toast('The shots carry. A pack is coming.', true); else if (huntN % 4 === 0) toast('Another pack heard you.'); } else if (e.type === 'nestDown') toast(S.nestsLeft ? `A nest burns out. ${S.nestsLeft} left.` : 'The last nest burns out.', true); else if (WORDS[e.type]) toast(...WORDS[e.type]); } }
  // ---------- each frame ----------
  let last = '';
  function update(evs) {
    keyInput(); onEvents(evs); meet();
    heatBar.style.width = `${Math.min(100, (S.heat || 0) * 10)}%`;
    const k = S.kai, f = k.hp / k.maxHp, near = !k.riding && Math.hypot(S.bike.x - k.x, S.bike.y - k.y) < 2.6;
    const ph = sim.dayPhase(), mm = Math.floor(ph.left / 60), ss = Math.floor(ph.left % 60);
    const roots = (S.areas || []).filter(a => a.root === undefined), cleanN = roots.filter(a => a.state === 'clean').length;
    const sig = `${Math.round(f * 100)}|${cleanN}/${roots.length}|${ph.night}|${mm}:${ss}|${near}|${k.riding}|${k.dashCd > 0}`;
    if (sig !== last) { last = sig;
      hpBar.style.width = `${Math.max(0, f * 100)}%`; hpEl.classList.toggle('low', f < 0.35);
      nestsEl.textContent = `${cleanN}/${roots.length}`; clockEl.textContent = `${ph.night ? '☾ dawn' : '☀ dusk'} ${mm}:${String(ss).padStart(2, '0')}`;
      rideBtn.hidden = !near;   // [m1] on foot is for later: the button only shows if she is off the bike and beside it rideBtn.textContent = k.riding ? 'OFF' : 'RIDE'; rideBtn.setAttribute('aria-label', k.riding ? 'Get off the motorcycle' : 'Get on the motorcycle');
      dashBtn.hidden = k.riding; dashBtn.disabled = k.dashCd > 0; }
  }
  /** arrows at the screen's edge: the walker (red) and the bike when Kai is off it and it is out of view */
  function arrows(toS, cssW, cssH) {
    const k = S.kai;
    const one = (x, y, col, label) => { const [sx, sy] = toS(x, y), m = 30; if (sx > m && sy > 70 && sx < cssW - m && sy < cssH - 260) return;   // [m1] clear of the combat pad
      const cx = cssW / 2, cy = cssH / 2, a = Math.atan2(sy - cy, sx - cx), t = Math.min(Math.abs((cssW / 2 - m) / (Math.cos(a) || 1e-6)), Math.abs((cssH / 2 - (Math.sin(a) > 0 ? 250 : 90)) / (Math.sin(a) || 1e-6))), ex = cx + Math.cos(a) * t, ey = cy + Math.sin(a) * t;
      fx.save(); fx.translate(ex, ey); fx.rotate(a); fx.fillStyle = col; fx.strokeStyle = 'rgba(8,8,10,.8)'; fx.lineWidth = 3; fx.beginPath(); fx.moveTo(12, 0); fx.lineTo(-6, -9); fx.lineTo(-2, 0); fx.lineTo(-6, 9); fx.closePath(); fx.stroke(); fx.fill(); fx.restore();
      fx.font = '700 11px "IBM Plex Mono", ui-monospace, monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.lineWidth = 3; fx.strokeText(label, ex - Math.cos(a) * 24, ey - Math.sin(a) * 18); fx.fillText(label, ex - Math.cos(a) * 24, ey - Math.sin(a) * 18); };
    // [m4] the walker: the one of the area she's in (if it's still dark), else the nearest dark area's
    { const here = S.inArea >= 0 ? S.areas[S.inArea] : null; let w = here && here.walker >= 0 ? S.dead.find(d => d.id === here.walker) : null;
      if (!w) { let wd = 1e9; for (const d of S.dead) if (d.boss) { const q = Math.hypot(d.x - k.x, d.y - k.y); if (q < wd) { wd = q; w = d; } } }
      if (w) one(w.x, w.y, '#ff2a1a', `WALKER ${Math.round(Math.hypot(w.x - k.x, w.y - k.y))}m`); }
    if (!k.riding && !k.dead) one(S.bike.x, S.bike.y, '#f0b44c', 'BIKE');
  }
  return { update, arrows, toast, get paused() { return ui.paused; }, set paused(v) { ui.paused = v; } };
}
