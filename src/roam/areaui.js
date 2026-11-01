// [roam] The area on the HUD (M4): where Kai is (the area's name, its level, dark or clean) under the counters, a toast
// when she rides into an area, the walker's plates as they break, and the big moment when an area goes clean.
// Reads S.areas and the events; writes nothing.
export function createAreaUi({ sim, toast }) {
  const S = sim.state, el = document.getElementById('area'), bossEl = document.getElementById('boss'); let last = '', bossSig = '';
  // [m4b] the boss bar (Horizon): when a walker is fighting her, or near, its name, its four plates and its core
  function boss() { const k = S.kai; let w = null, wd = 40; for (const d of S.dead) if (d.boss) { const q = Math.hypot(d.x - k.x, d.y - k.y); if (q < wd && (d.state === 'hunt' || q < 30)) { wd = q; w = d; } }
    const sig = w ? `${w.id}|${w.plates}|${Math.round(w.plate)}|${Math.round(w.hp)}` : '-'; if (sig === bossSig) return; bossSig = sig; if (!w) { bossEl.hidden = true; return; }
    const a = S.areas[w.area], pl = [0, 1, 2, 3].map(i => `<i class="${i < w.plates ? (i === w.plates - 1 ? 'cur' : 'on') : ''}" style="--f:${i === w.plates - 1 ? w.plate / w.plateMax : i < w.plates ? 1 : 0}"></i>`).join('');
    bossEl.hidden = false; bossEl.innerHTML = `<b>WALKER · ${a.name.toUpperCase()} · LV ${a.level}</b><div class="pl">${pl}</div><div class="core"><i style="width:${Math.max(0, w.hp / w.maxHp * 100)}%"></i></div>`; }
  function update(evs) {
    for (const e of evs || []) {
      if (e.type === 'enter') toast(`${e.name} · level ${e.level} · ${e.state === 'clean' ? 'clean' : 'dark: a walker roams here'}`);
      else if (e.type === 'plate') toast(e.left ? `A plate breaks off. ${e.left} left.` : 'The plates are off: hit the core!', !e.left);
      else if (e.type === 'rear') { if (!S._rearTold) { S._rearTold = true; toast('It rears up: get clear!', true); } }
      else if (e.type === 'part') toast(e.part === 'tank' ? 'The fuel tank blows: it burns!' : 'A pod is down: one less volley.', e.part === 'tank');
      else if (e.type === 'podAim') { if (!S._podTold) { S._podTold = true; toast('Its pods are taking aim: move!', true); } }
      else if (e.type === 'planted') toast('The walker planted a new nest.');
      else if (e.type === 'clean') toast(`${e.name[0].toUpperCase() + e.name.slice(1)} is clean. Nothing is born here now.`, true); }
    boss();
    const a = S.inArea >= 0 ? S.areas[S.inArea] : null, sig = a ? `${a.i}|${a.state}` : '-';
    if (sig !== last) { last = sig; if (!a) { el.hidden = true; return; } el.hidden = false; el.className = a.state; el.textContent = `${a.name.toUpperCase()} · LV ${a.level} · ${a.state === 'clean' ? 'CLEAN' : 'DARK'}`; } }
  return { update };
}
