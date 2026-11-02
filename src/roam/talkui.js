// [roam] Talking to Kai: TALK appears when the robot is by her at the garage (and nothing else is being said); it opens a
// short list of what it can ask (src/play/talk.js, only the topics that make sense now); her answer plays as a scene
// (storyui.js: the bubble over her, the robot's light in reply). UI only.
import { KAI_TALK } from '../play/talk.js';
export function createTalkUi({ sim, story, ui }) {
  const S = sim.state, btn = document.createElement('button'), menu = document.createElement('div'); btn.id = 'talkBtn'; btn.className = 'rb'; btn.textContent = 'TALK'; btn.hidden = true; menu.id = 'talkMenu'; menu.hidden = true;
  btn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom,0px));padding:10px 18px;border-radius:22px;font:700 14px ui-monospace,monospace;letter-spacing:.1em;color:#1b1406;background:#f0b44c;border:2px solid #ffd98a;z-index:21';
  menu.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(120px + env(safe-area-inset-bottom,0px));width:min(380px,calc(100vw - 24px));background:rgba(8,9,11,.94);border:1px solid #f0b44c66;border-radius:14px;padding:8px;z-index:59;display:grid;gap:6px';
  document.body.append(btn, menu);
  const close = () => { menu.hidden = true; ui.paused = false; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const topics = KAI_TALK.filter(q => q.when(S));
    menu.innerHTML = '<div style="font:700 10px ui-monospace,monospace;letter-spacing:.14em;color:#f0b44c;padding:2px 4px">ASK KAI</div>' + topics.map(q => `<button data-q="${q.id}" style="text-align:left;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:#e9e2cf;font:500 13px ui-monospace,monospace">${q.ask}</button>`).join('') + '<button data-q="" style="padding:8px;border-radius:10px;border:0;background:none;color:#8a877e;font:700 12px ui-monospace,monospace">LEAVE</button>';
    menu.hidden = false; ui.paused = true; });
  menu.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); close(); const q = KAI_TALK.find(o => o.id === b.dataset.q); if (q) story.say(q.say(S).map(l => ['KAI', l])); });
  function update() { const show = menu.hidden && !story.busy && story.kaiNear(22) && !document.body.classList.contains('garage-open') && !S.garageRun; if (btn.hidden === show) btn.hidden = !show; }
  return { update };
}
