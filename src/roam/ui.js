// [roam] The HUD and the controls: health, nests left, the clock; the Ride and Dash buttons; a floating stick (drag
// anywhere), pinch and wheel to zoom, WASD/arrows, E to ride, Space to dash; toasts from the sim's events; and the
// arrows at the screen's edge to the nearest nest and to the parked bike. Writes only `input` and the camera's base zoom.
export function createUi({ canvas, fx, sim, cam, input }) {
  const $ = id => document.getElementById(id), S = sim.state;
  const hpEl = $('hp'), hpBar = hpEl.querySelector('i'), nestsEl = $('nests').querySelector('b'), clockEl = $('clock'), rideBtn = $('ride'), dashBtn = $('dash'), stick = $('stick'), toasts = $('toasts');
  const toast = (text, big) => { const el = document.createElement('div'); el.className = 'toast' + (big ? ' big' : ''); el.textContent = text; toasts.appendChild(el); setTimeout(() => el.remove(), 3300); while (toasts.children.length > 3) toasts.firstChild.remove(); };
  // ---------- buttons ----------
  const press = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  press(rideBtn, () => { input.ride = true; }); press(dashBtn, () => { input.dash = true; });
  // [m1] FIRE is held: down starts, up / cancel / leaving the button stops
  const fireBtn = $('fire'), setFire = on => { input.fire = on; fireBtn.classList.toggle('on', on); };
  fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fireBtn.setPointerCapture(e.pointerId); setFire(true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) fireBtn.addEventListener(ev, () => setFire(false));
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
  const WORDS = { dusk: ['Dusk. The machines wake hungry.', true], dawn: ['Dawn. The machines slow and power down.', true], down: ['Wrecked. Back at the square in a moment.'], back: ['Back on the bike.'], crash: ['Crash!'], won: ['Every nest is ash. Hollowmere breathes.', true] };
  function onEvents(evs) { for (const e of evs) { if (e.type === 'nestDown') toast(S.nestsLeft ? `A nest burns out. ${S.nestsLeft} left.` : 'The last nest burns out.', true); else if (WORDS[e.type]) toast(...WORDS[e.type]); } }
  // ---------- each frame ----------
  let last = '';
  function update(evs) {
    keyInput(); onEvents(evs);
    const k = S.kai, f = k.hp / k.maxHp, near = !k.riding && Math.hypot(S.bike.x - k.x, S.bike.y - k.y) < 2.6;
    const ph = sim.dayPhase(), mm = Math.floor(ph.left / 60), ss = Math.floor(ph.left % 60);
    const sig = `${Math.round(f * 100)}|${S.nestsLeft}|${ph.night}|${mm}:${ss}|${near}|${k.riding}|${k.dashCd > 0}`;
    if (sig !== last) { last = sig;
      hpBar.style.width = `${Math.max(0, f * 100)}%`; hpEl.classList.toggle('low', f < 0.35);
      nestsEl.textContent = `${S.nestsLeft}`; clockEl.textContent = `${ph.night ? '☾ dawn' : '☀ dusk'} ${mm}:${String(ss).padStart(2, '0')}`;
      rideBtn.hidden = !near;   // [m1] on foot is for later: the button only shows if she is off the bike and beside it rideBtn.textContent = k.riding ? 'OFF' : 'RIDE'; rideBtn.setAttribute('aria-label', k.riding ? 'Get off the motorcycle' : 'Get on the motorcycle');
      dashBtn.hidden = k.riding; dashBtn.disabled = k.dashCd > 0; }
  }
  /** arrows at the screen's edge: the nearest live nest (ember) and the bike when Kai is off it and it is out of view */
  function arrows(toS, cssW, cssH) {
    const k = S.kai; let nest = null, nd = 1e9; for (const n of S.nests) if (n.alive) { const d = Math.hypot(n.x - k.x, n.y - k.y); if (d < nd) { nd = d; nest = n; } }
    const one = (x, y, col, label) => { const [sx, sy] = toS(x, y), m = 30; if (sx > m && sy > 70 && sx < cssW - m && sy < cssH - 260) return;   // [m1] clear of the combat pad
      const cx = cssW / 2, cy = cssH / 2, a = Math.atan2(sy - cy, sx - cx), t = Math.min(Math.abs((cssW / 2 - m) / (Math.cos(a) || 1e-6)), Math.abs((cssH / 2 - (Math.sin(a) > 0 ? 250 : 90)) / (Math.sin(a) || 1e-6))), ex = cx + Math.cos(a) * t, ey = cy + Math.sin(a) * t;
      fx.save(); fx.translate(ex, ey); fx.rotate(a); fx.fillStyle = col; fx.strokeStyle = 'rgba(8,8,10,.8)'; fx.lineWidth = 3; fx.beginPath(); fx.moveTo(12, 0); fx.lineTo(-6, -9); fx.lineTo(-2, 0); fx.lineTo(-6, 9); fx.closePath(); fx.stroke(); fx.fill(); fx.restore();
      fx.font = '700 11px "IBM Plex Mono", ui-monospace, monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.lineWidth = 3; fx.strokeText(label, ex - Math.cos(a) * 24, ey - Math.sin(a) * 18); fx.fillText(label, ex - Math.cos(a) * 24, ey - Math.sin(a) * 18); };
    if (nest) one(nest.x, nest.y, '#ff5a3a', `${Math.round(nd)}m`);
    if (!k.riding && !k.dead) one(S.bike.x, S.bike.y, '#f0b44c', 'BIKE');
  }
  return { update, arrows, toast };
}
