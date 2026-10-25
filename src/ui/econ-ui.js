// [econ3] The Solar Flare economy on screen: the construction queue chip above the build bar ("Building · Home 45% ·
// +2 queued", tap to open the list: move a job up, to the top, or call it off for a refund), and the dawn's Settlement
// report, as a camp toast. Acts only through the API (queue, queueMove, queueCancel).
import { icon } from './icons.js';
import { esc } from './shared.js';

const CSS = `
.eq-chip{pointer-events:auto;flex-direction:column;align-items:stretch!important;height:auto!important;min-height:46px;box-sizing:border-box;max-width:100%}
.eq-chip .eq-top{width:100%}
.eq-chip .eq-top{display:flex;align-items:center;gap:8px;min-height:36px;cursor:pointer}
.eq-chip .lb{flex:1 1 auto;min-width:0;display:grid;gap:1px}
.eq-chip .lb b{font:700 14px/1.15 var(--display);letter-spacing:.03em;color:var(--bone);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eq-chip .lb span{font:500 12.5px/1.25 var(--body);color:var(--muted);display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.eq-bar{flex:none;width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}.eq-bar i{display:block;height:100%;background:#ffc24a}
.eq-chip .tg{flex:none;font:700 12px/1 var(--display);letter-spacing:.06em;color:var(--muted);padding:0 6px}
.eq-list{display:grid;gap:4px;margin-top:6px;max-height:40vh;overflow:auto}
.eq-row{display:flex;align-items:center;gap:4px;padding:4px 0 4px 2px;border-top:1px solid rgba(255,255,255,.07);font:500 13px/1.2 var(--body);color:var(--bone)}
.eq-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-row .nm small{color:var(--muted);margin-left:6px;font-variant-numeric:tabular-nums}
.eq-row .nm small.fled{color:#ff8a6a}
.eq-row button{min-width:30px;min-height:32px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--bone);font:700 14px/1 var(--body);display:grid;place-items:center;padding:0}
.eq-row button:disabled{opacity:.3}
.eq-row button.x{color:#ffb39a}
`;

export function createEconUi(ui) {
  if (!document.getElementById('eq-css')) { const st = document.createElement('style'); st.id = 'eq-css'; st.textContent = CSS; document.head.appendChild(st); }
  let chip = null, sig = '', openList = false, t = 0;
  const has = () => ui.game && typeof ui.game.queue === 'function';
  function mount() {
    if (chip && chip.isConnected) return chip;
    const host = document.querySelector('.rd-dock');
    chip = document.createElement('div'); chip.className = 'rd-chip mini warm eq-chip'; chip.hidden = true;
    if (host) host.appendChild(chip); else { chip.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(var(--dockH,72px) + 10px);z-index:5'; document.body.appendChild(chip); }
    chip.addEventListener('click', e => {
      if (!has()) return;
      const g = ui.game, mv = e.target.closest('[data-mv]'), cx = e.target.closest('[data-cx]');
      if (mv) { g.queueMove(+mv.dataset.id, mv.dataset.mv === 'top' ? 'top' : +mv.dataset.mv); sig = ''; render(); return; }
      if (cx) { g.queueCancel(+cx.dataset.cx); sig = ''; render(); return; }
      if (e.target.closest('.eq-top')) { openList = !openList; sig = ''; render(); }
    });
    return chip;
  }
  function render() {
    if (!has()) return;
    const g = ui.game, S = g.state, q = g.queue(), el = mount();
    const show = q.length > 0 && !S.over && !ui.card && !ui.placing;
    if (!show) { el.hidden = true; sig = ''; if (!q.length) openList = false; return; }
    const s = JSON.stringify(q.map(j => [j.id, j.pct, j.active, j.fled])) + openList; if (s === sig) return; sig = s;
    const top = q.find(j => j.active) || q[0], more = q.length - 1, fled = q.some(j => j.fled);
    let html = `<div class="eq-top" role="button" aria-expanded="${openList}" aria-label="Construction queue"><span class="i0">${icon('build')}</span><span class="lb"><b>${esc(top.name)} · ${top.pct}%</b><span><span class="eq-bar"><i style="width:${top.pct}%"></i></span>${top.fled ? 'Crew fled the dead' : `${top.left}s left`}${more ? ` · +${more} queued` : ''}${fled && !top.fled ? ' · a crew fled' : ''}</span></span><span class="tg">${openList ? 'Close' : 'Queue'}</span></div>`;
    if (openList) html += `<div class="eq-list">${q.map((j, k) => `<div class="eq-row"><span class="nm">${k + 1}. ${esc(j.name)}<small class="${j.fled ? 'fled' : ''}">${j.fled ? 'crew fled' : j.active ? `${j.pct}% · working` : j.pct ? `${j.pct}% · waiting` : 'waiting'}</small></span><button data-mv="top" data-id="${j.id}" aria-label="Build first" ${k ? '' : 'disabled'}>⇈</button><button data-mv="-1" data-id="${j.id}" aria-label="Move up" ${k ? '' : 'disabled'}>↑</button><button data-mv="1" data-id="${j.id}" aria-label="Move down" ${k < q.length - 1 ? '' : 'disabled'}>↓</button><button class="x" data-cx="${j.id}" aria-label="Call off: ${j.stock ? 'back in hand' : `${j.paid} scrap back`}">${icon('close')}</button></div>`).join('')}</div>`;
    el.innerHTML = html; el.hidden = false;
  }
  function econTick(dt, events) {
    if (!ui.game) return;
    for (const e of events || []) {
      if (e.t === 'settle' && e.xp > 0) { const L = e.lines.map(l => `${l.name}${l.n && l.id === 'built' ? ` ×${l.n}` : ''} +${l.xp}`).join(' · '); setTimeout(() => ui.ctoast.show(`Settlement report · **+${e.xp} XP**${e.hauled ? ` · carts hauled ${e.hauled}` : ''} — ${L}`, 'good', 'camp'), 2600); }
    }
    if ((t -= dt) > 0) return; t = 0.25; render();
  }
  /** the selection panel for a blueprint still in the queue: how far along, and calling it off */
  function econPanel(b, opt) {
    const q = ui.game.queue(), k = q.findIndex(j => j.kind === 'build' && j.bid === b.id), j = q[k]; if (!j) return '';
    return `<div class="stat"><span>Under construction <b>${j.pct}%</b> · ${j.fled ? '<b class="bad">its crew fled the dead</b>' : j.active ? `${j.left}s of work left` : `waiting · ${k + 1} in the queue`}</span><span>It does nothing until the roof is on.</span></div><div class="opts two">${opt('opt-demo', 'data-demo="1"', 'Call it off', null, `<b class="good">${j.stock ? 'Back in hand' : `+${j.paid} scrap back`}</b>.`, false)}</div>`;
  }
  return { econTick, econPanel };
}
