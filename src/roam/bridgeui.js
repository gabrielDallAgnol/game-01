// [roam] Mending a bridge, the controls and words (the Point): MEND at a broken bridge's end once nothing is wedged in it
// (it costs the scrap Kai carries); toasts teach why not yet, the work going on, waiting while she's away, and the moment
// the road opens. Acts only through the API (sim.mend()).
export function createBridgeUi({ sim, toast }) {
  const S = sim.state, btn = document.createElement('button'); btn.id = 'mendBtn'; btn.className = 'rb'; btn.hidden = true; btn.textContent = 'MEND';
  btn.style.cssText = 'position:fixed;right:max(126px,calc(env(safe-area-inset-right,0px) + 126px));bottom:calc(140px + env(safe-area-inset-bottom,0px));width:88px;height:88px;border-radius:50%;font:700 14px ui-monospace,monospace;letter-spacing:.06em;color:#1b1406;background:#f0b44c;border:2px solid #ffd98a;box-shadow:0 0 22px rgba(240,180,76,.55);z-index:20;line-height:1.1';
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); sim.mend(); });
  document.body.appendChild(btn);
  const told = {}; const once = (k, m, big) => { if (!told[k]) { told[k] = true; toast(m, big); } };
  function update(evs) { const need = 60;
    for (const e of evs || []) {
      if (e.type === 'mendNo') toast(e.why === 'scrap' ? `Mending it takes ${e.need} scrap. You carry ${e.have}.` : 'Nobody can mend it while the big machine is wedged in it.');
      else if (e.type === 'mendStart') toast('The people of Wendbridge come out to work. Guard them.', true);
      else if (e.type === 'mendStep') toast(`${e.name}: ${Math.round(e.prog * 100)}% done.`);
      else if (e.type === 'mendWait') toast('The work waits for you: they won\'t work unguarded.');
      else if (e.type === 'mended') toast(`${e.name} stands again. The road north is open.`, true); }
    // near a broken end while something is still wedged in it: say why, once
    const b = (S.bridges || []).find(q => q.state === 'broken' && Math.hypot(S.kai.x - q.x, S.kai.y - q.y) < 30);
    if (b && !sim.canMend() && S.dead.some(d => d.boss && Math.hypot(d.x - b.x, d.y - b.y) < 10)) once('wedged', 'A big machine is wedged in the broken bridge. It can\'t get out, and while it\'s there nobody can mend it.', true);
    const show = sim.canMend(); if (btn.hidden === show) btn.hidden = !show; const label = `MEND\n${need}⚙`; if (btn.textContent !== label) btn.textContent = label; btn.style.whiteSpace = 'pre'; }
  return { update };
}
