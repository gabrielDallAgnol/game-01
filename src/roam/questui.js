// [roam] Quests from people (WoW-style, Gabriel Nov 2): a gold "!" over anyone with a quest for you, a "?" over anyone
// waiting for you to hand one in (and a small "?" badge at the screen's edge while they're off it).
// Taking one is a conversation (Gabriel, Nov 2: "take the mission when I talk to the person"): ride up to a "!" and a
// TALK button rises (or just stop beside them a moment); they say what they want and how (a scene, the robot answering
// in light), then the ask: what it is, what it's worth, TAKE IT or NOT NOW. UI only: acts through sim.accept(id).
import { QUEST } from '../play/missions.js';
const nm = g => g[0] + g.slice(1).toLowerCase();
const worth = r => [r.scrap && `+${r.scrap} ⚙`, r.chips && `+${r.chips} ◆`, r.repair && 'a repair spot at her door', r.turretDmg && 'your turrets bite harder', r.clean && 'colour back'].filter(Boolean).join(' · ');
export function createQuestUi({ sim, fx, story }) {
  const S = sim.state, css = document.createElement('style');
  css.textContent = `#qTalk{position:fixed;left:50%;transform:translate(-50%,20px);opacity:0;bottom:calc(160px + env(safe-area-inset-bottom,0px));z-index:57;padding:11px 18px;border-radius:24px;border:1px solid #f0b44c;background:rgba(10,9,6,.92);color:#ffd36a;font:700 13px ui-monospace,monospace;letter-spacing:.1em;transition:opacity .25s,transform .25s;pointer-events:none}
#qTalk.on{opacity:1;transform:translate(-50%,0);pointer-events:auto;animation:qT 1.6s ease-in-out infinite}@keyframes qT{50%{box-shadow:0 0 18px #f0b44c66}}
#qOffer{position:fixed;left:50%;transform:translate(-50%,24px);opacity:0;bottom:calc(150px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 24px));background:rgba(8,9,11,.95);border:1px solid #f0b44c88;border-radius:14px;padding:10px 12px;z-index:57;font:500 13px/1.45 ui-monospace,monospace;color:#e9e2cf;transition:opacity .25s,transform .25s;pointer-events:none}
#qOffer.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}#qOffer button{font:700 13px ui-monospace,monospace;border-radius:10px;padding:10px}
body.scene #qTalk,body.hub #qTalk{display:none}`;
  document.head.appendChild(css);
  const talk = document.createElement('button'); talk.id = 'qTalk'; document.body.appendChild(talk);
  const card = document.createElement('div'); card.id = 'qOffer'; document.body.appendChild(card);
  let near = null, asking = null, still = 0; const later = new Set(), heard = new Set();
  const hideCard = () => { card.classList.remove('on'); asking = null; };
  // the ask, after the words: what, what it's worth, take it or not now
  function ask(id) { const st = QUEST[id]; asking = id; const what = st.line.replace(/\s*\{n\}.*$/, '').replace(/[:.]\s*$/, ''), w = worth(st.reward || {});
    card.innerHTML = `<div style="font:700 10px ui-monospace,monospace;letter-spacing:.14em;color:#f0b44c">${st.giver} ASKS · ${st.title.toUpperCase()}</div><div style="margin:4px 0 2px">${what}.</div>${w ? `<div style="color:#8fd16a;font-size:12px;margin-bottom:8px">${w}</div>` : '<div style="height:6px"></div>'}<div style="display:flex;gap:8px"><button data-a="yes" style="flex:1;border:0;background:#f0b44c;color:#1b1406">TAKE IT</button><button data-a="no" style="padding:10px 14px;border:1px solid rgba(255,255,255,.15);background:none;color:#b9b3a4">NOT NOW</button></div>`;
    card.classList.add('on'); }
  card.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b || !asking) return; e.preventDefault(); e.stopPropagation();
    if (b.dataset.a === 'yes') sim.accept(asking); else later.add(asking); hideCard(); });
  // the conversation: their want (the quest's start), then how (its ask); heard once, after that straight to the ask
  function converse(id) { const st = QUEST[id], g = st.giver; talk.classList.remove('on'); still = 0;
    if (heard.has(id)) { ask(id); return; } heard.add(id);
    const said = [[g, st.start.replace(/^[A-Z]{3,}:\s*/, '')]]; if (st.ask) said.push([g, st.ask]);
    story.say(said, () => { if ((S.quests.offers || []).includes(id)) ask(id); }); }
  talk.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (near) converse(near); });
  function update(dt = 1 / 60) { const offers = (S.quests && S.quests.offers) || []; let pick = null, pd = 1e9;
    for (const id of offers) { const at = sim.giverAt(QUEST[id].giver); if (!at) continue; const d = Math.hypot(at.x - S.bike.x, at.y - S.bike.y);
      if (d > 16) later.delete(id); if (d < 11 && !later.has(id) && d < pd) { pick = id; pd = d; } }
    if (story.busy || document.body.classList.contains('hub')) pick = null;
    if (asking && (!offers.includes(asking) || (pick !== asking && !story.busy))) hideCard();
    if (pick !== near) { near = pick; still = 0; if (pick) talk.textContent = `💬 TALK · ${QUEST[pick].giver}`; }
    talk.classList.toggle('on', !!near && !asking);
    // stopping beside them is talking too
    if (near && !asking) { still = Math.abs(S.bike.speed) < 1.2 && pd < 7 ? still + dt : 0; if (still > 0.7 && !heard.has(near)) converse(near); } }
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
