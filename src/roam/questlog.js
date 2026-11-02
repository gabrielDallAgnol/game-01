// [roam] The quest log (Gabriel, Nov 2: "a button to expand and see open quests, select one, and the map shows it so I
// can follow"). A QUESTS tab under the objective (or tap the objective): a panel of what you've taken, each with its
// giver, where it stands and what it's worth; tap one to FOLLOW it (its marker, its arrow and the map's pin lead), and
// who still has a "!" for you. The game waits while it's open. UI only: acts through sim.track(id).
import { QUEST, readyOf } from '../play/missions.js';
export function createQuestLog({ sim, ui, story }) {
  const S = sim.state, css = document.createElement('style');
  css.textContent = `#qLogBtn{position:fixed;left:max(12px,env(safe-area-inset-left,0px));z-index:9;padding:5px 10px;border-radius:8px;border:1px solid #f0b44c66;background:rgba(10,11,13,.82);color:#ffd36a;font:700 10px ui-monospace,monospace;letter-spacing:.12em}
#qLog{position:fixed;inset:0;z-index:60;background:rgba(4,5,7,.72);display:none;align-items:flex-start;justify-content:center;padding:calc(60px + env(safe-area-inset-top,0px)) 12px 12px}#qLog.on{display:flex}
#qLog .box{width:min(420px,100%);max-height:calc(100vh - 120px);overflow:auto;background:rgba(10,11,13,.97);border:1px solid #f0b44c66;border-radius:14px;padding:12px;font:500 12px/1.45 ui-monospace,monospace;color:#e9e2cf}
#qLog h3{margin:0 0 8px;font:700 12px ui-monospace,monospace;letter-spacing:.16em;color:#f0b44c;display:flex;justify-content:space-between}#qLog h4{margin:12px 0 6px;font:700 10px ui-monospace,monospace;letter-spacing:.14em;color:#8a8577}
#qLog .q{display:block;width:100%;text-align:left;margin:0 0 8px;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:inherit;font:inherit}
#qLog .q.on{border-color:#f0b44c;background:rgba(240,180,76,.1)}#qLog .q b{display:block;color:#fff;font-size:13px}#qLog .q i{font-style:normal;font-size:10px;letter-spacing:.12em;color:#f0b44c}#qLog .q .ok{color:#8fd16a}
#qLog .x{border:0;background:none;color:#b9b3a4;font:700 14px ui-monospace,monospace;padding:0 4px}body.scene #qLogBtn,body.hub #qLogBtn{visibility:hidden}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'qLogBtn'; document.body.appendChild(btn);
  const pane = document.createElement('div'); pane.id = 'qLog'; pane.innerHTML = '<div class="box"></div>'; document.body.appendChild(pane); const box = pane.firstChild;
  const where = q => { const st = QUEST[q.id], r = readyOf(S, st); if (r) return `<span class="ok">✓ ${r.then}</span>`; return st.line.replace('{n}', q.prog).replace('{need}', q.need); };
  const far = at => { if (!at) return ''; const d = Math.hypot(at.x - S.kai.x, at.y - S.kai.y); return d < 15 ? ' · here' : ` · ${Math.round(d / 10) * 10} m`; };
  function fill() { const A = S.quests.active, track = S.mission && S.mission.id;
    let h = `<h3><span>QUESTS · ${A.length}</span><button class="x" data-x="1">✕</button></h3>`;
    h += A.length ? A.map(q => { const st = QUEST[q.id], on = q.id === track;
      return `<button class="q${on ? ' on' : ''}" data-id="${q.id}"><i>${st.main ? 'THE STORY' : st.giver}${on ? ' · ◉ FOLLOWING' : ' · tap to follow'}${far(q.at)}</i><b>${st.title}</b>${where(q)}</button>`; }).join('') : '<div style="color:#8a8577">Nothing taken. Look for a "!".</div>';
    const offers = S.quests.offers || []; if (offers.length) h += '<h4>SOMEONE HAS A "!" FOR YOU</h4>' + offers.map(id => { const st = QUEST[id]; return `<div class="q" style="opacity:.75"><i>${st.giver}${far(sim.giverAt(st.giver))}</i><b>${st.title}</b>Ride up and talk to ${st.giver[0] + st.giver.slice(1).toLowerCase()}.</div>`; }).join('');
    box.innerHTML = h; }
  const open = () => { if (document.body.classList.contains('scene')) return; fill(); pane.classList.add('on'); ui.paused = true; }, close = () => { pane.classList.remove('on'); ui.paused = false; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); open(); });
  pane.addEventListener('pointerdown', e => { e.stopPropagation(); const b = e.target.closest('button');
    if (!b) { if (e.target === pane) close(); return; } e.preventDefault(); if (b.dataset.x) { close(); return; }
    if (b.dataset.id) { sim.track(b.dataset.id); close(); story.banner('FOLLOWING', QUEST[b.dataset.id].title.toUpperCase(), 'Its marker and arrow lead now.'); } });
  // the tab sits under the objective box, wherever that ends
  let last = ''; function update() { const A = (S.quests && S.quests.active) || [], O = (S.quests && S.quests.offers) || [], obj = document.getElementById('obj');
    const show = !!S.quests && (A.length + O.length) > 0 && !document.getElementById('intro'); btn.style.display = show ? '' : 'none'; if (!show) return;
    const top = obj && !obj.hidden ? obj.getBoundingClientRect().bottom + 6 : 120; btn.style.top = top + 'px';
    const t = `☰ QUESTS ${A.length}${O.length ? ` · ! ${O.length}` : ''}`; if (t !== last) { last = t; btn.textContent = t; } }
  return { update, open, get isOpen() { return pane.classList.contains('on'); } };
}
