// [ch1] Chapter 1 on the HUD, kept small: under the top bar, the district Kai stands in (quiet), the current objective
// as one System line with its distance and direction, and a notes button that slides in the notes Kai has found
// (re-read any time; the game runs on, it is not a popup). At the chapter's end, the end card: the run in numbers and
// the last broadcast. Everything else the chapter says is in the world (view/worldtext.js). Does nothing outside chapter 1.
import { $, esc } from './shared.js';
import { NOTES, RADIO } from '../content/notes.js';
import { DISTRICTS, HOOK } from '../content/story1.js';

const CSS = `
#chTop{pointer-events:none;display:flex;align-items:center;gap:6px;min-width:0;margin-top:-2px}
#chTop .dist{font:600 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:rgba(242,234,216,.72);text-shadow:0 1px 2px #000;white-space:nowrap;padding:4px 2px}
#chTop .obj{flex:1;min-width:0;font:500 12px/1.25 var(--mono);color:var(--sys-text);background:rgba(8,19,31,.62);border:1px solid var(--cyan-d);border-radius:8px;padding:5px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#chTop .obj:empty{display:none}
#chTop .obj b{color:var(--cyan);font-weight:600}
#chNotesBtn{pointer-events:auto;flex:none;min-width:44px;min-height:32px;border-radius:8px;border:1px solid var(--line);background:var(--camp-glass);color:#f2ead8;font:600 12px var(--mono);display:flex;align-items:center;gap:5px;padding:0 9px}
#chNotesBtn i{font-style:normal;color:var(--main)}
#chNotesBtn.new{border-color:var(--main);box-shadow:0 0 0 2px rgba(255,211,106,.25)}
#chNotes{position:fixed;top:0;right:0;bottom:0;width:min(360px,88vw);z-index:40;background:rgba(18,15,12,.94);border-left:1px solid var(--line);transform:translateX(102%);transition:transform .22s ease;display:flex;flex-direction:column;padding:calc(10px + env(safe-area-inset-top,0px)) 0 env(safe-area-inset-bottom,0px)}
#chNotes.open{transform:none}
#chNotes .hd{display:flex;align-items:center;justify-content:space-between;padding:4px 14px 10px;font:600 12px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--cyan)}
#chNotes .hd button{min-width:44px;min-height:44px;background:none;border:0;color:#f2ead8;font:600 20px var(--mono)}
#chNotes ol{list-style:none;margin:0;padding:0 14px 20px;overflow:auto;display:grid;gap:10px}
#chNotes li{background:#efe6cf;color:#2a2219;border-radius:4px;padding:10px 12px;font:400 14px/1.4 var(--body);box-shadow:0 2px 0 rgba(0,0,0,.4);transform:rotate(var(--r,0deg))}
#chNotes li b{display:block;font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:#7a5a30;margin-bottom:4px}
#chNotes li.radio{background:#1c2a36;color:#d9f4ff}#chNotes li.radio b{color:var(--cyan)}
#chNotes .empty{padding:0 14px;color:var(--dim);font:400 14px var(--body)}
.chend .hook{margin:14px 0 0;padding:12px;border:1px solid var(--cyan-d);border-radius:8px;background:rgba(8,19,31,.6);color:var(--sys-text);font:400 14px/1.45 var(--mono)}
`;
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'], ARROW = { E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖', N: '↑', NE: '↗' };

export function createChapterUi(ui) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const top = document.createElement('div'); top.id = 'chTop'; top.hidden = true;
  top.innerHTML = '<span class="dist" id="chDist"></span><span class="obj" id="chObj"></span><button id="chNotesBtn" aria-label="Notes you found"><span aria-hidden="true">✉</span><i id="chNotesN">0</i></button>';
  const bar = $('#campBar'); if (bar && bar.parentNode) bar.parentNode.insertBefore(top, bar.nextSibling);
  const drawer = document.createElement('aside'); drawer.id = 'chNotes'; drawer.setAttribute('aria-label', 'Notes');
  drawer.innerHTML = '<div class="hd"><span>Notes · radio</span><button id="chNotesX" aria-label="Close notes">×</button></div><ol id="chNotesList"></ol>';
  document.body.appendChild(drawer);
  let seenN = 0, lastKey = '';
  const on = () => !!(ui.game && ui.game.chapter && ui.game.chapter());
  function fill() {
    const g = ui.game, notes = g.notes().map(id => NOTES.find(n => n.id === id)).filter(Boolean), heard = g.heard().map(id => RADIO.find(r => r.id === id)).filter(Boolean);
    const items = [...notes.map(n => `<li style="--r:${((n.id.length * 7) % 5 - 2) * 0.4}deg"><b>${esc(n.from)} · ${esc(DISTRICTS[n.district] ? DISTRICTS[n.district].name : '')}</b>${esc(n.text)}</li>`), ...heard.map(r => `<li class="radio"><b>(( ${esc(r.from)} ))</b>${esc(r.text)}</li>`)].reverse();
    $('#chNotesList').innerHTML = items.length ? items.join('') : '<p class="empty">Nothing yet. Search the houses.</p>';
  }
  $('#chNotesBtn').onclick = () => { const o = !drawer.classList.contains('open'); drawer.classList.toggle('open', o); if (o) { fill(); seenN = ui.game.notes().length; $('#chNotesBtn').classList.remove('new'); } };
  $('#chNotesX').onclick = () => drawer.classList.remove('open');
  function tick() {
    if (!on()) { top.hidden = true; return; }
    top.hidden = false;
    const g = ui.game, S = g.state, C = g.chapter(), h = S.hero;
    $('#chDist').textContent = g.districtName(h.x, h.y);
    const o = C.objective; let line = '';
    if (o) { line = `<b>[Objective]</b> ${esc(o.text)}${o.n > 1 ? ` ${o.have}/${o.n}` : ''}`; if (o.x !== null) { const d = Math.hypot(o.x - h.x, o.y - h.y); if (d > 6) { const a = Math.atan2(o.y - h.y, o.x - h.x), k = DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; line += ` · ${Math.round(d)} m ${ARROW[k]}`; } } }
    else if (S.phase === 'night') line = '<b>[Objective]</b> Survive the night.';
    if (line !== lastKey) { $('#chObj').innerHTML = line; lastKey = line; }
    const n = g.notes().length + g.heard().length; $('#chNotesN').textContent = n; if (n > seenN && !drawer.classList.contains('open')) $('#chNotesBtn').classList.add('new');
    if (drawer.classList.contains('open') && n !== +drawer.dataset.n) { drawer.dataset.n = n; fill(); }
  }
  // the end of the chapter: its own card (a fallen Rig keeps the usual one)
  const baseEnd = ui.showEnd;
  function showEnd() {
    const g = ui.game, S = g.state; if (!(on() && S.won && S.endReason === 'ch1')) return baseEnd();
    drawer.classList.remove('open');
    const C = g.chapter(), s = C.stats || {}, r12 = RADIO.find(r => r.id === 'r.12'), mins = Math.round((s.time || S.time) / 60);
    const rows = [['Nights held', s.nights - 1], ['Minutes', mins], ['Ash-Born put down', s.kills], ['Houses searched', s.searched], ['Notes found', s.notes], ['Survivors home', `${s.survivors}/3`], ['Mechanic level', s.lvl]];
    ui.showCard('end', `<div class="eyebrow"><span>[Region complete: Hollowmere]</span></div>
      <h1 class="big">Hilde rolls north</h1>
      <div class="endstats chend">${rows.map(([k, v]) => `<div><b>${v ?? 0}</b><span>${k}</span></div>`).join('')}</div>
      <div class="chend"><p class="hook">${esc(r12 ? r12.text : '')}</p><p class="note">Chapter 2: ${esc(HOOK.road)}.</p></div>
      <div class="cardrow foot end"><button class="btn big" id="again">New run</button></div>`, { sys: true });
    $('#again').onclick = ui.onArmed(() => { location.reload(); });
  }
  return { chapterTick: tick, showEnd };
}
