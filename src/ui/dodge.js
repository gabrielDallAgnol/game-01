// [combat2] The dash on screen (?v2combat=1): Space or Shift on a keyboard (Space leaves the class ability to Q
// while the flag is on), and on touch a small round button at the bottom right whose rim fills back as the
// cooldown runs out. Without the flag it adds nothing to the page. It drives the game only through api.dash().
import { COMBAT2 } from './combat2-flag.js';

const CSS = `
.c2dash{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(var(--dockH,72px) + 26px);z-index:5;width:56px;height:56px;border-radius:50%;padding:0;
  border:1px solid rgba(255,214,150,.7);background:radial-gradient(circle at 50% 35%,rgba(70,46,24,.95),rgba(18,10,6,.95));color:#ffe2b0;font:700 10px/1 var(--mono,monospace);letter-spacing:.08em;
  box-shadow:0 0 14px rgba(255,170,90,.25);touch-action:none;-webkit-tap-highlight-color:transparent;display:none;place-items:center;overflow:hidden}
.c2dash.on{display:grid}.c2dash svg{width:24px;height:24px;margin-top:-6px}.c2dash span{position:absolute;bottom:9px;left:0;right:0;text-align:center}
.c2dash.cool{color:rgba(255,226,176,.45)}.c2dash.cool::after{content:'';position:absolute;inset:0;background:conic-gradient(rgba(8,4,2,.72) calc(var(--cd,0) * 360deg),transparent 0)}
.c2dash.go{animation:c2go .25s ease-out}@keyframes c2go{0%{transform:scale(.86)}100%{transform:scale(1)}}`;

export function createDodge(ui) {
  if (!COMBAT2.on) return { dodgeTick: () => {} };
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.className = 'c2dash'; btn.id = 'dashBtn'; btn.setAttribute('aria-label', 'Dash');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h9M6 8h8M6 16h8M15 6l5 6-5 6"/></svg><span>DASH</span>';
  document.body.appendChild(btn);
  const go = () => { const g = ui.game; if (!g || ui.paused || !g.dash || !g.dash()) return; btn.classList.remove('go'); void btn.offsetWidth; btn.classList.add('go'); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); ui.touchUI = e.pointerType !== 'mouse' || ui.touchUI; go(); });
  window.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Shift') return;
    if (!ui.game || (e.target.closest && e.target.closest('button,input,textarea'))) return;
    if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault(); e.stopPropagation(); go();   // capture, so input.js never turns this Space into the class ability
  }, { capture: true });
  function dodgeTick() {
    const g = ui.game, show = !!(g && g.dashInfo && ui.touchUI && !g.state.over && !ui.card);
    btn.classList.toggle('on', show); if (!show) return;
    const d = g.dashInfo(); btn.classList.toggle('cool', !d.ready); btn.style.setProperty('--cd', d.ready ? 0 : (d.cd / d.cdMax).toFixed(3));
  }
  return { dodgeTick };
}
