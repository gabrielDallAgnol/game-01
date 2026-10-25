// [nest3] The siege bar: close to a burning nest (within 16 cells of its walls) a panel shows its three phases (slag
// barricade, feeder vents, the core) as segments that empty and stay empty, the phase you are on, and what the next
// break does. Far away, a slim chip names the nearest nest and which way to walk. Reads game.infernoInfo/Nearest only.
import { esc } from './shared.js';

const CSS = `
.inf{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 118px);width:min(358px,calc(100vw - 24px));z-index:6;pointer-events:none;padding:8px 10px 9px;border-radius:12px;background:rgba(24,14,10,.86);border:1px solid rgba(255,138,42,.55);box-shadow:0 6px 18px rgba(0,0,0,.45),0 0 22px rgba(255,110,20,.18)}
.inf[hidden]{display:none}
.inf .hd{display:flex;align-items:baseline;gap:8px;justify-content:space-between}
.inf .hd b{font:700 15px/1.1 var(--display,sans-serif);letter-spacing:.05em;text-transform:uppercase;color:#ffb35a}
.inf .hd span{font:600 12px/1 var(--body,sans-serif);color:#f3e6c8}
.inf .seg{display:grid;grid-template-columns:28fr 32fr 40fr;gap:4px;margin:7px 0 5px}
.inf .seg i{display:block;position:relative;height:9px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;border:1px solid rgba(255,255,255,.12)}
.inf .seg i u{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#ff5a1c,#ffb040);box-shadow:0 0 8px rgba(255,120,30,.7)}
.inf .seg i.cur{border-color:#ffd27a}
.inf .seg i.out{background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.06)}
.inf .nm{display:grid;grid-template-columns:28fr 32fr 40fr;gap:4px;font:600 10.5px/1.1 var(--body,sans-serif);color:#9c8d78;text-align:center}
.inf .nm .cur{color:#ffe2a8}.inf .nm .out{text-decoration:line-through;opacity:.55}
.inf .nx{margin-top:5px;font:500 12px/1.3 var(--body,sans-serif);color:#e8dcc4}
.inf .nx b{color:#ffb35a}
`;

export function createInfernoUi(ui) {
  if (!document.getElementById('inf-css')) { const st = document.createElement('style'); st.id = 'inf-css'; st.textContent = CSS; document.head.appendChild(st); }
  let el = null, t = 0, sig = '';
  function mount() { if (el && el.isConnected) return el; el = document.createElement('div'); el.className = 'inf'; el.hidden = true; document.body.appendChild(el); return el; }
  /** the panel's html for one nest's info */
  function html(i) {
    const cur = i.segments.findIndex(s => !s.broken), now = cur < 0 ? null : i.segments[cur];
    const seg = i.segments.map((s, k) => `<i class="${s.broken ? 'out' : k === cur ? 'cur' : ''}"><u style="width:${Math.round(s.frac * 100)}%"></u></i>`).join('');
    const nm = i.segments.map((s, k) => `<span class="${s.broken ? 'out' : k === cur ? 'cur' : ''}">${esc(s.name)}</span>`).join('');
    return `<div class="hd"><b>${esc(i.name)}</b><span>${now ? `Phase ${cur + 1} of 3 · ${esc(now.name)}` : 'Snuffed'}</span></div><div class="seg">${seg}</div><div class="nm">${nm}</div>${now ? `<div class="nx"><b>Next break:</b> ${esc(now.next)} Broken parts never heal.</div>` : ''}`;
  }
  function infernoTick(dt) {
    t -= dt; if (t > 0) return; t = 0.15;
    const g = ui.game, h = g && g.state && g.state.hero, e = mount();
    if (!g || !h || ui.paused || g.state.over || !g.infernoNearest) { e.hidden = true; return; }
    const i = g.infernoNearest(h.x, h.y, 16);
    if (!i) { e.hidden = true; return; }
    const s = html(i) + i.segments.map(q => q.frac.toFixed(2)).join();
    if (s !== sig) { sig = s; e.innerHTML = html(i); }
    e.hidden = false;
  }
  return { infernoTick };
}
