// The Window as a character: the slim System strip at the top (HP · Lv · today's quest) that speaks in [brackets],
// the type-on used by every System window, inline callouts anchored to the HUD, and the Camp's own small toasts.
import { icon } from './icons.js';

export const reduced = () => (typeof window !== 'undefined' && !!window.__fastType) || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);   // __fastType: screenshots and tests
const esc = t => String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
/** **bold** → <b>; [System] brackets get their own colour */
export const sysRich = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]{1,60})\]/g, '<span class="br">[$1]</span>');

/** split "text with **bold**" into runs so it can be typed on without breaking tags */
function runs(text) { const out = []; String(text).split(/(\*\*[^*]+\*\*)/).forEach(p => { if (!p) return; const b = /^\*\*.+\*\*$/.test(p); out.push({ t: b ? p.slice(2, -2) : p, b }); }); return out; }
function prefix(rs, n) { let s = '', k = n; for (const r of rs) { if (k <= 0) break; const piece = r.t.slice(0, k); k -= piece.length; const h = sysRich(piece).replace(/\*\*/g, ''); s += r.b ? `<b>${h}</b>` : h; } return s; }
/** type text into el at cps characters a second; resolves when done (or at once with reduced motion) */
export function typeOn(el, text, cps = 60) {
  const rs = runs(text), total = rs.reduce((a, r) => a + r.t.length, 0);
  if (reduced() || !total) { el.innerHTML = prefix(rs, total); return Promise.resolve(); }
  el.classList.add('typing'); let t0 = 0, done = null; const p = new Promise(r => { done = r; });
  const step = now => {
    if (!el.isConnected) { done(); return; }
    if (!t0) t0 = now; const n = Math.min(total, Math.floor((now - t0) / 1000 * cps) + 1);
    el.innerHTML = prefix(rs, n) + (n < total ? '<i class="caret"></i>' : '');
    if (n < total && !el.dataset.skip) requestAnimationFrame(step); else { el.innerHTML = prefix(rs, total); el.classList.remove('typing'); done(); }
  };
  requestAnimationFrame(step);
  return p;
}
/** two-beat open: a line draws (120 ms), then the panel unfolds (160 ms, a little overshoot). Close: 100 ms. */
export function openBeat(card) {
  if (reduced()) { card.classList.remove('beat-line', 'beat-open'); return; }
  card.classList.remove('beat-open'); card.classList.add('beat-line'); void card.offsetWidth;
  setTimeout(() => { card.classList.remove('beat-line'); card.classList.add('beat-open'); }, 120);
}

// ---------- the strip ----------
export function createStrip(el, { onTap } = {}) {
  el.innerHTML = `<div class="sb-in"><span class="sb-st"><span class="sb-hp">${icon('heart')}<b id="sbHp">24</b><i id="sbHpMax">/24</i></span><span class="sb-lv">Lv <b id="sbLv">1</b></span></span><span class="sb-main"><span class="sb-q" id="sbQ"></span><span class="sb-say" id="sbSay" hidden></span></span></div>`;
  const q = [], $ = id => el.querySelector(id); let cur = null, timer = 0, lastQ = '';
  const say = $('#sbSay'), quest = $('#sbQ');
  function next() {
    clearTimeout(timer); cur = q.shift();
    if (!cur) { say.hidden = true; quest.hidden = false; el.classList.remove('speaking', 'beat', 'bad', 'good'); return; }
    quest.hidden = true; say.hidden = false; el.classList.add('speaking'); el.classList.toggle('beat', !!cur.beat); el.classList.toggle('bad', cur.kind === 'bad'); el.classList.toggle('good', cur.kind === 'good');
    say.dataset.skip = '';
    typeOn(say, cur.text, 60).then(() => { const words = cur ? cur.text.split(/\s+/).length : 0; timer = setTimeout(next, Math.min(7000, (cur && cur.beat ? 2600 : 1800) + words * 230)); });
  }
  el.addEventListener('click', () => { if (cur) { say.dataset.skip = '1'; clearTimeout(timer); timer = setTimeout(next, 120); } else if (onTap) onTap(); });
  return {
    /** the System speaks: text in [brackets]; beat = a skill, a title, a class (a short flourish) */
    say(text, kind, beat = false) { if (q.length > 4) q.splice(0, q.length - 4); if (q.some(x => x.text === text) || (cur && cur.text === text)) return; q.push({ text, kind, beat }); if (!cur) next(); },
    clear() { q.length = 0; if (cur) { say.dataset.skip = '1'; next(); } },
    update({ hp, maxHp, lv, quest: qt, show }) {
      el.hidden = !show; if (!show) return;
      $('#sbHp').textContent = Math.max(0, Math.ceil(hp)); $('#sbHpMax').textContent = `/${maxHp}`; $('#sbLv').textContent = lv;
      el.classList.toggle('low', hp < maxHp * 0.35);
      const count = qt && (qt.done ? '<b class="ok">Done</b> ' : qt.n ? `<b>${qt.have}/${qt.n}</b> ` : '');
      const html = qt ? `<span class="sb-t"><span class="br">${esc(qt.tag)}</span> ${count}${esc(qt.text)}</span>${qt.extra ? `<span class="sb-k">${esc(qt.extra)}</span>` : ''}` : '<span class="sb-t"><span class="br">[System]</span> Standing by.</span>';
      if (html !== lastQ) { lastQ = html; quest.innerHTML = html; el.classList.toggle('two', !!(qt && qt.extra)); }
    },
    busy: () => !!cur,
  };
}

// ---------- inline callouts (tips): anchored to the HUD element they explain, dismissed on tap ----------
export function createCallouts(layer, anchors) {
  const q = []; let cur = null, timer = 0;
  function place() {
    if (!cur) return;
    const a = document.querySelector(anchors[cur.at] || anchors.strip); const el = cur.el;
    if (!a || a.hidden || !a.getBoundingClientRect().width) { el.style.opacity = '0'; return; }
    const r = a.getBoundingClientRect(), W = innerWidth, H = innerHeight, w = Math.min(280, W - 32);
    el.style.width = `${w}px`;
    const below = r.top < H / 2, x = Math.max(16, Math.min(W - 16 - w, r.left + r.width / 2 - w / 2));
    el.style.left = `${x}px`; el.style.top = below ? `${r.bottom + 10}px` : ''; el.style.bottom = below ? '' : `${H - r.top + 10}px`;
    el.classList.toggle('up', below); el.style.setProperty('--ax', `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x))}px`); el.style.opacity = '';
  }
  function next() {
    clearTimeout(timer); if (cur) { cur.el.remove(); cur = null; }
    const t = q.shift(); if (!t) return;
    const el = document.createElement('button'); el.className = 'callout'; el.setAttribute('aria-label', `${t.text} Tap to dismiss.`);
    el.innerHTML = `<span class="co-t">${sysRich(t.text)}</span><span class="co-x">${icon('close')}</span>`;
    el.onclick = () => next(); layer.appendChild(el); cur = { ...t, el }; place();
    timer = setTimeout(next, 14000);
  }
  return { show(t) { if (q.some(x => x.id === t.id)) return; q.push(t); if (!cur) next(); }, place, hide() { q.length = 0; if (cur) next(); }, active: () => !!cur };
}

// ---------- the Camp's own small toasts (one at a time, above the thumb row) ----------
export function createCampToast(el) {
  const q = []; let cur = null, timer = 0;
  function next() {
    clearTimeout(timer); if (cur) { cur.remove(); cur = null; }
    const t = q.shift(); if (!t) return;
    const d = document.createElement('div'); d.className = `ctoast ${t.kind || ''}`; d.innerHTML = `${t.icon ? icon(t.icon) : ''}<span>${sysRich(t.text)}</span>`;
    d.onclick = next; el.appendChild(d); cur = d;
    timer = setTimeout(() => { d.classList.add('out'); setTimeout(next, 220); }, Math.min(5200, 1800 + t.text.split(/\s+/).length * 200));
  }
  return { show(text, kind, ic) { if (q.length > 3) q.shift(); if (q.some(x => x.text === text)) return; q.push({ text, kind, icon: ic }); if (!cur) next(); }, clear() { q.length = 0; if (cur) next(); } };
}
