// The look-at shots: the first time a kind of hive shows itself (the hollow your first dead crawl out of, the first
// city hive to wake, the first hive about to burst), the camera eases out to it, holds on a beam and a tag while the
// System names the place, and eases back. Once per kind per run; the sim runs slow meanwhile; a tap skips it.
import { DIR8 } from './shared.js';

const SLOW = 0.15;   // sim speed while a shot plays: the world keeps breathing, the hero is never left in a fight
const KINDS = {
  hollow: { color: '#9dff4a', tag: 'HIVE', line: d => `[Inferno Nest located] Your Ash-Born crawl out of here: ${d} of the Haven.`, kind: 'bad' },
  unique: { color: '#ff6a4a', tag: 'IT COMES', line: d => `[Unique Monster] It rises ${d} of the Haven.`, kind: 'bad' },
  city: { color: '#9dff4a', tag: 'CITY HIVE', line: d => `[Inferno Nest awake] A city Inferno Nest wakes, ${d}. Its Ash-Born march tonight.`, kind: 'bad' },
  erupt: { color: '#ff5a3a', tag: 'ABOUT TO BURST', line: d => `[Warning] An Inferno Nest swells, ${d} of the Haven. It is about to burst.`, kind: 'bad' },
};

export function createCinema(ui) {
  const seen = new Set(); let game = null, woke = null, pollT = 0;
  const dirOf = (x, y) => { const t = ui.game.map.town; return DIR8[((Math.round(Math.atan2(y - t.y, x - t.x) / (Math.PI / 4)) % 8) + 8) % 8]; };
  let pending = [];
  function shot(kind, x, y) { if (!seen.has(kind)) { seen.add(kind); pending.push({ kind, x, y }); } }
  function play({ kind, x, y }) {
    if (!ui.view || !ui.view.lookAt || ui.game.state.over) return;
    const K = KINDS[kind], d = dirOf(x, y);
    ui.view.lookAt(x, y, { color: K.color, tag: `${K.tag} · ${d.replace(/(^|-)(\w)\w*/g, '$2').toUpperCase()}` });
    ui.toast(K.line(d), K.kind);
  }
  // a tap while a shot plays skips it (and does not move the hero)
  let swallow = -1;
  window.addEventListener('pointerdown', e => { if (ui.view && ui.view.looking && ui.view.looking()) { ui.view.skipLook(); swallow = e.pointerId; e.stopPropagation(); e.preventDefault(); } }, { capture: true });
  window.addEventListener('keydown', e => { if ((e.key === 'Escape' || e.key === ' ') && ui.view && ui.view.looking && ui.view.looking()) { ui.view.skipLook(); e.stopPropagation(); } }, { capture: true });
  window.addEventListener('pointerup', e => { if (e.pointerId === swallow) { swallow = -1; e.stopPropagation(); } }, { capture: true });

  /** once a frame, with the drained events (before the view draws them); returns the sim's speed factor */
  function cinemaFrame(events, dt) {
    if (ui.game !== game) { game = ui.game; seen.clear(); woke = null; pollT = 0; pending = []; }
    if (!game) return 1;
    const S = game.state, map = game.map;
    for (const e of events) {
      if (e.t === 'firstDead') { const m = S.mobs.find(x => x.id === e.id); if (m) shot(m.unique ? 'unique' : 'hollow', m.x, m.y); }
      if (e.t === 'eruptWarn') shot('erupt', e.x, e.y);
    }
    // the first city hive (beyond the woods) to wake, after the start of the run
    if ((pollT -= dt) <= 0 && game.activeNests) {
      pollT = 0.5; const now = game.activeNests(S.night);
      if (woke) for (const r of now) if (!woke.has(r) && map.regions[r].ring >= 2) { const n = map.regions[r].nest; shot('city', n.x, n.y); break; }
      woke = new Set([...(woke || []), ...now]);
    }
    // a shot waits for the open card to close (never behind a window)
    if (pending.length && !ui.card && !ui.paused && !(ui.view && ui.view.looking && ui.view.looking())) play(pending.shift());
    return ui.view && ui.view.looking && ui.view.looking() ? SLOW : 1;
  }
  return { cinemaFrame };
}
