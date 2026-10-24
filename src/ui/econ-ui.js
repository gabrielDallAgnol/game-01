// [econ3] The Solar Flare economy on screen: the construction queue chip above the build bar ("Building · Home 45% ·
// +2 queued", tap to open the list: move a job up, to the top, or call it off for a refund), the carts row in the build
// menu (carts out / yard size, order one), and the dawn's Settlement report, as a camp toast (relic finds and cart
// alerts come as the System's own toasts). Acts only through the API (queue, queueMove, queueCancel, haul, buyCart).
import { icon } from './icons.js';
import { esc } from './shared.js';

const CSS = `
.eq-chip{pointer-events:auto;flex-direction:column;align-items:stretch!important}
.eq-chip .eq-top{display:flex;align-items:center;gap:8px;min-height:36px;cursor:pointer}
.eq-chip .lb{flex:1 1 auto;min-width:0;display:grid;gap:1px}
.eq-chip .lb b{font:700 14px/1.15 var(--display);letter-spacing:.03em;color:var(--bone);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eq-chip .lb span{font:500 12.5px/1.25 var(--body);color:var(--muted);display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.eq-bar{flex:none;width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}.eq-bar i{display:block;height:100%;background:#ffc24a}
.eq-chip .tg{flex:none;font:700 12px/1 var(--display);letter-spacing:.06em;color:var(--muted);padding:0 6px}
.eq-list{display:grid;gap:4px;margin-top:6px;max-height:40vh;overflow:auto}
.eq-row{display:flex;align-items:center;gap:6px;padding:4px 0 4px 2px;border-top:1px solid rgba(255,255,255,.07);font:500 13px/1.2 var(--body);color:var(--bone)}
.eq-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-row .nm small{color:var(--muted);margin-left:6px;font-variant-numeric:tabular-nums}
.eq-row .nm small.fled{color:#ff8a6a}
.eq-row button{min-width:34px;min-height:34px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--bone);font:700 14px/1 var(--body);display:grid;place-items:center;padding:0}
.eq-row button:disabled{opacity:.3}
.eq-row button.x{color:#ffb39a}
.econrow{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:0 2px 2px;font:500 13px/1.2 var(--body);color:var(--muted)}
.econrow b{font:700 13px/1 var(--display);letter-spacing:.06em;text-transform:uppercase;color:var(--bone)}
.econrow button{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,194,74,.6);background:rgba(255,194,74,.14);color:#ffe2a8;font:600 13px var(--body);display:flex;align-items:center;gap:4px}
.econrow button[aria-disabled="true"]{opacity:.45}
.econrow small{flex:1;min-width:0;font:500 12px/1.25 var(--body);color:var(--dim,#8c8578)}
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
  /** the build menu's row: carts out / the yard's size, and ordering one */
  function econRow() {
    const g = ui.game; if (!g || typeof g.haul !== 'function') return '';
    const H = g.haul(), n = H.carts.length, full = n + H.ordered >= H.max, broke = g.state.gold < H.cost;
    return `<div class="econrow" role="group" aria-label="Harvester carts"><b>Carts</b><span>${n}${H.ordered ? `+${H.ordered}` : ''} / ${H.max}</span><button data-cart ${full || broke ? 'aria-disabled="true"' : ''}>+ Cart ${icon('scrap')}${H.cost}</button><small>${full ? 'Raise the Camp for a bigger yard.' : `${H.left} scrap and timber left out there.`}</small></div>`;
  }
  const econSig = () => { const g = ui.game; if (!g || typeof g.haul !== 'function') return ''; const H = g.haul(); return `${H.carts.length}|${H.ordered}|${H.max}|${g.state.gold >= H.cost}`; };
  function cartTap() { const g = ui.game; if (!g) return; if (g.buyCart()) ui.toast('A cart is in the work queue.'); }
  function econTick(dt, events) {
    if (!ui.game) return;
    for (const e of events || []) {
      if (e.t === 'settle' && e.xp > 0) { const L = e.lines.map(l => `${l.name}${l.n && l.id === 'built' ? ` ×${l.n}` : ''} +${l.xp}`).join(' · '); setTimeout(() => ui.ctoast.show(`Settlement report · **+${e.xp} XP**${e.hauled ? ` · carts hauled ${e.hauled}` : ''} — ${L}`, 'good', 'camp'), 2600); }
    }
    if ((t -= dt) > 0) return; t = 0.25; render();
  }
  return { econRow, econSig, cartTap, econTick };
}
