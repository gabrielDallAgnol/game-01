// [roam] Quests from people (WoW-style, Gabriel Nov 2): a gold "!" over anyone with a quest for you, a "?" over anyone
// waiting for you to hand one in (and a small "?" badge at the screen's edge while they're off it). Ride up to someone
// with a "!" and their offer comes up: what they ask, ACCEPT or LATER. UI only: acts through sim.accept(id).
import { QUEST } from '../play/missions.js';
export function createQuestUi({ sim, fx, story }) {
  const S = sim.state, card = document.createElement('div'); card.id = 'qOffer'; card.hidden = true;
  card.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom,0px));width:min(380px,calc(100vw - 24px));background:rgba(8,9,11,.95);border:1px solid #f0b44c88;border-radius:14px;padding:10px 12px;z-index:57;font:500 13px/1.45 ui-monospace,monospace;color:#e9e2cf';
  document.body.appendChild(card); let showing = null; const later = new Set();
  const nm = g => g[0] + g.slice(1).toLowerCase();
  card.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation();
    if (b.dataset.a === 'yes') sim.accept(showing); else later.add(showing); card.hidden = true; showing = null; });
  function update() { const k = S.kai, offers = (S.quests && S.quests.offers) || []; let pick = null;
    for (const id of offers) { const g = QUEST[id].giver, at = sim.giverAt(g); if (!at) continue; const d = Math.hypot(at.x - S.bike.x, at.y - S.bike.y); if (d > 16) later.delete(id); if (d < 10 && !later.has(id)) pick = id; }
    if (story.busy || document.body.classList.contains('hub')) pick = null;
    if (pick !== showing) { showing = pick; if (!pick) { card.hidden = true; return; } const st = QUEST[pick];
      card.innerHTML = `<div style="font:700 10px ui-monospace,monospace;letter-spacing:.14em;color:#f0b44c">${st.giver} · ${st.title.toUpperCase()}</div><div style="margin:4px 0 8px">${st.start.replace(/^[A-Z]{3,}:\s*/, '')}</div><div style="display:flex;gap:8px"><button data-a="yes" style="flex:1;padding:10px;border-radius:10px;border:0;background:#f0b44c;color:#1b1406;font:700 13px ui-monospace,monospace">ACCEPT</button><button data-a="no" style="padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:none;color:#b9b3a4;font:700 12px ui-monospace,monospace">LATER</button></div>`;
      card.hidden = false; } }
  // the "!" and "?" over people, and "?" at the edge while they're off screen
  function draw(toS, cssW, cssH, t, edge) { const marks = new Map();
    for (const id of (S.quests && S.quests.offers) || []) marks.set(QUEST[id].giver, marks.get(QUEST[id].giver) === '?' ? '?' : '!');
    for (const q of (S.quests && S.quests.active) || []) if (q.met && QUEST[q.id].turnIn) marks.set(QUEST[q.id].giver, '?');
    for (const [g, m] of marks) { const at = sim.giverAt(g); if (!at) continue; const [x, y] = toS(at.x, at.y);
      if (x < 20 || y < 60 || x > cssW - 20 || y > cssH - 220) { if (m === '?' && edge) edge(at.x, at.y, '#ffd36a', `? ${nm(g)}`); continue; }
      const yy = y - 58 + Math.sin(t * 3) * 3; fx.save(); fx.font = '900 26px ui-monospace,monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.lineWidth = 5; fx.strokeStyle = 'rgba(8,8,10,.9)'; fx.fillStyle = m === '?' ? '#ffe066' : '#ffc35a';
      fx.strokeText(m, x, yy); fx.fillText(m, x, yy); fx.font = '700 10px ui-monospace,monospace'; fx.lineWidth = 3; fx.strokeText(g, x, yy + 20); fx.fillStyle = '#e9e2cf'; fx.fillText(g, x, yy + 20); fx.restore(); } }
  return { update, draw };
}
