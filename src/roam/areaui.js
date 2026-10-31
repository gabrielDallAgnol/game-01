// [roam] The area on the HUD (M4): where Kai is (the area's name, its level, dark or clean) under the counters, a toast
// when she rides into an area, the walker's plates as they break, and the big moment when an area goes clean.
// Reads S.areas and the events; writes nothing.
export function createAreaUi({ sim, toast }) {
  const S = sim.state, el = document.getElementById('area'); let last = '';
  function update(evs) {
    for (const e of evs || []) {
      if (e.type === 'enter') toast(`${e.name} · level ${e.level} · ${e.state === 'clean' ? 'clean' : 'dark: a walker roams here'}`);
      else if (e.type === 'plate') toast(e.left ? `A plate breaks off. ${e.left} left.` : 'The plates are off: hit the core!', !e.left);
      else if (e.type === 'rear') { if (!S._rearTold) { S._rearTold = true; toast('It rears up: get clear!', true); } }
      else if (e.type === 'planted') toast('The walker planted a new nest.');
      else if (e.type === 'clean') toast(`${e.name[0].toUpperCase() + e.name.slice(1)} is clean. Nothing is born here now.`, true); }
    const a = S.inArea >= 0 ? S.areas[S.inArea] : null, sig = a ? `${a.i}|${a.state}` : '-';
    if (sig !== last) { last = sig; if (!a) { el.hidden = true; return; } el.hidden = false; el.className = a.state; el.textContent = `${a.name.toUpperCase()} · LV ${a.level} · ${a.state === 'clean' ? 'CLEAN' : 'DARK'}`; } }
  return { update };
}
