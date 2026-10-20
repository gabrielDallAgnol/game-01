// The folk's own projects, on screen: the day's project chip above the build bar ("The folk are building a farm ·
// 60%", tap × to stop it and take the scrap back), the "Let them build" row in the build menu, a tap on the scaffold,
// and the dawn line for the ledger. Acts only through the API (folk, setFolkBuild, folkVeto).
import { icon } from './icons.js';
import { esc } from './shared.js';

const CSS = `
.fk-chip{pointer-events:auto}
.fk-chip .lb{flex:1 1 auto;min-width:0;display:grid;gap:1px}
.fk-chip .lb b{font:700 14px/1.15 var(--display);letter-spacing:.03em;color:var(--bone);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fk-chip .lb span{font:500 12.5px/1.25 var(--body);color:var(--muted);display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.fk-chip .lb em{font-style:normal;color:var(--bone);font-weight:600}
.fk-chip .fk-bar{flex:none;width:30px;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}.fk-chip .fk-bar i{display:block;height:100%;background:#e8b04a}
.fk-chip .x{background:none;border:0;color:var(--muted);min-width:36px;min-height:36px;display:grid;place-items:center;padding:0}
.fk-chip.ask{border-color:rgba(255,209,102,.55)}
.fk-chip .btn.sm{min-height:34px;padding:0 12px}
.fk-chip.flash{animation:fkflash .6s var(--ease-o,ease-out) 2}
@keyframes fkflash{50%{box-shadow:0 0 0 2px rgba(255,209,102,.7),0 6px 18px rgba(0,0,0,.4)}}
.folkrow{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:0 2px 2px;font:500 13px/1.2 var(--body);color:var(--muted)}
.folkrow b{font:700 13px/1 var(--display);letter-spacing:.06em;text-transform:uppercase;color:var(--bone)}
.folkrow button{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--bone);font:600 13px var(--body)}
.folkrow button[aria-pressed="true"]{border-color:rgba(232,176,74,.7);background:rgba(232,176,74,.16);color:#ffe2a8}
.folkrow small{flex:1;min-width:0;font:500 12px/1.25 var(--body);color:var(--dim,#8c8578)}
`;

/** the dawn ledger's line for what the folk did since yesterday ('' when there is nothing to say) */
export function folkLine(f) {
  if (!f || !f.on || (!f.took && !(f.built || []).length)) return '';
  const b = f.built || [], what = b.length ? ` · raised ${b.join(', ')}` : '';
  return `The folk kept ${f.took} scrap for their fund${what}.`;
}

export function createFolkUi(ui) {
  if (!document.getElementById('fk-css')) { const st = document.createElement('style'); st.id = 'fk-css'; st.textContent = CSS; document.head.appendChild(st); }
  let chip = null, sig = '', ask = false, askT = 0, t = 0;
  function mount() {
    if (chip && chip.isConnected) return chip;
    const host = document.querySelector('.rd-dock');
    chip = document.createElement('div'); chip.className = 'rd-chip mini warm fk-chip'; chip.hidden = true;
    if (host) host.appendChild(chip); else { chip.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(var(--dockH,72px) + 10px);z-index:5'; document.body.appendChild(chip); }
    chip.addEventListener('click', e => {
      if (!ui.game) return;
      if (e.target.closest('[data-ask]')) { ask = true; askT = 6; sig = ''; render(); return; }
      if (e.target.closest('[data-keep]')) { ask = false; sig = ''; render(); return; }
      if (e.target.closest('[data-veto]')) { ui.game.folkVeto(); ask = false; sig = ''; render(); }
    });
    return chip;
  }
  function render() {
    const g = ui.game; if (!g || typeof g.folk !== 'function') return;
    const S = g.state, f = g.folk(), j = f.job, el = mount();
    const show = !!(f.on && j && S.phase === 'day' && !S.over && !ui.card && !ui.placing);
    if (!show) { el.hidden = true; sig = ''; ask = false; return; }
    const s = `${j.name}|${j.pct}|${j.waiting}|${ask}|${j.paid}`; if (s === sig) return; sig = s;
    el.classList.toggle('ask', ask);
    if (ask) {
      el.innerHTML = `<span class="i0">${icon('build')}</span><span class="lb"><b>Stop ${esc(j.name)}?</b><span>${j.paid ? `<em>+${j.paid}</em>${icon('scrap')} back to you` : 'Nothing paid yet'}</span></span><div class="acts"><button class="btn sm" data-veto>Stop</button><button class="btn sm ghost" data-keep>Keep</button></div>`;
    } else {
      const why = j.waiting && j.pct < 100 ? 'saving up' : 'at work';
      el.innerHTML = `<span class="i0">${icon('build')}</span><span class="lb"><b>${esc(j.short)} · ${j.pct}%</b><span><span class="fk-bar"><i style="width:${j.pct}%"></i></span>Folk ${why}</span></span><button class="x" data-ask aria-label="Stop the folk's project: ${esc(j.name)}">${icon('close')}</button>`;
      el.title = `The folk are building ${j.name} · ${j.pct}%`;
    }
    el.hidden = false;
  }
  /** the build menu's row: "Let them build" on/off, with what their work is worth so far */
  function folkRow() {
    const g = ui.game; if (!g || typeof g.folk !== 'function') return '';
    const f = g.folk(); if (g.state.night < 2 && !f.total) return '';
    return `<div class="folkrow" role="group" aria-label="The folk build by themselves"><b>Let them build</b><button data-folk aria-pressed="${f.on}">${f.on ? 'On' : 'Off'}</button><small>${f.on ? `They keep ${Math.round(f.share * 100)}% of the scrap · beauty ${f.beauty}${f.regen ? ` · Camp heals +${f.regen}%` : ''}` : 'You build everything yourself.'}</small></div>`;
  }
  const folkSig = () => { const g = ui.game; if (!g || typeof g.folk !== 'function') return ''; const f = g.folk(); return `${f.on}|${f.beauty}|${g.state.night >= 2 || f.total ? 1 : 0}`; };
  function folkToggle() { const g = ui.game; if (!g) return; g.setFolkBuild(!g.folk().on); sig = ''; }
  /** a tap on the ground: on the scaffold of today's project, the chip asks whether to stop it */
  function folkTap(p) {
    const g = ui.game; if (!g || typeof g.folk !== 'function' || !p) return false;
    const j = g.folk().job; if (!j || j.kind === 'rebuild' || Math.hypot(p.x - j.x, p.y - j.y) > (j.kind === 'build' ? 1.6 : 1.1)) return false;
    ask = true; askT = 6; sig = ''; render(); if (chip) { chip.classList.remove('flash'); void chip.offsetWidth; chip.classList.add('flash'); }
    return true;
  }
  function folkTick(dt, events) {
    if (!ui.game) return;
    for (const e of events || []) if (e.t === 'ledger' && e.folk && !(e.fell.length || e.ruins || e.piper)) { const l = folkLine(e.folk); if (l) setTimeout(() => ui.ctoast.show(l, 'good', 'build'), 1500); }
    if (ask && (askT -= dt) <= 0) { ask = false; sig = ''; }
    if ((t -= dt) > 0) return; t = 0.2; render();
  }
  return { folkRow, folkSig, folkToggle, folkTap, folkTick };
}
