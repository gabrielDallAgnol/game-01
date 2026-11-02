// [roam] Talking to Kai: from the garage's open space (garagehub.js), a short list of what the robot can ask
// (src/play/talk.js, only the topics that make sense now); her answer plays as a scene (storyui.js: the bubble over her,
// the robot's light in reply). UI only.
import { KAI_TALK } from '../play/talk.js';
export function createTalkUi({ sim, story }) {
  const S = sim.state, menu = document.createElement('div'); menu.id = 'talkMenu'; menu.hidden = true;
  menu.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom,0px));width:min(380px,calc(100vw - 24px));background:rgba(8,9,11,.95);border:1px solid #f0b44c66;border-radius:14px;padding:8px;z-index:59;display:grid;gap:6px';
  document.body.append(menu); let done = null;
  function open(onDone) { done = onDone; const topics = KAI_TALK.filter(q => q.when(S));
    menu.innerHTML = '<div style="font:700 10px ui-monospace,monospace;letter-spacing:.14em;color:#f0b44c;padding:2px 4px">ASK KAI</div>' + topics.map(q => `<button data-q="${q.id}" style="text-align:left;padding:11px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:#e9e2cf;font:500 13px ui-monospace,monospace">${q.ask}</button>`).join('') + '<button data-q="" style="padding:9px;border-radius:10px;border:0;background:none;color:#8a877e;font:700 12px ui-monospace,monospace">BACK</button>';
    menu.hidden = false; }
  menu.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); menu.hidden = true; const q = KAI_TALK.find(o => o.id === b.dataset.q);
    if (q) story.say(q.say(S).map(l => ['KAI', l]), done); else if (done) done(); });
  return { open, get isOpen() { return !menu.hidden; } };
}
