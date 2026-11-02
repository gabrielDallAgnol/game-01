// [roam] Story beats (Gabriel, Nov 2: "better transitions for missions starting and finishing, more interaction between
// characters"). A mission's words are no longer toasts:
// - near the one who speaks (Kai at her garage, Tomas at his door), a scene: thin bars slide in, the camera eases onto
//   both of you, a speech bubble rises over their head and types out; the speaker waves; the robot answers in its eye's
//   light (a bubble of glyph marks over it). Tap to go on. The rules wait meanwhile.
// - far from them, Kai's voice on the radio: a small card at the top that types out and goes by itself.
// - between missions, a banner: "✓ <title>, done", then "NEW · <title>" with its objective.
// UI only: it reads the events and the state, holds the camera (lab.cam) and pauses (ui.paused); never writes the state.
import { CHAPTER1 } from '../play/missions.js';
const ROBOT = ['▪ ▫ ▪', '▪▪', '▫ ▪', '▪ ▪ ▪', '▪'];
export function createStoryUi({ sim, ui, lab, cam, town }) {
  const S = sim.state, W = town.W.world || {};
  const css = document.createElement('style'); css.textContent = `#sbars i{position:fixed;left:0;right:0;height:0;background:#000;z-index:55;transition:height .45s ease}#sbars i.t{top:0}#sbars i.b{bottom:0}#sbars.on i{height:9vh}
#stap{position:fixed;inset:0;z-index:56;display:none}#stap.on{display:block}
#sradio{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));transform:translate(-50%,-140%);width:min(420px,calc(100vw - 24px));background:rgba(8,9,11,.9);border:1px solid #f0b44c55;border-radius:12px;padding:8px 12px;font:500 13px/1.4 ui-monospace,monospace;color:#e9e2cf;z-index:57;transition:transform .35s ease}
#sradio.on{transform:translate(-50%,0)}#sradio b{color:#f0b44c;font-size:10px;letter-spacing:.14em;display:block}
#sban{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.9);opacity:0;z-index:58;text-align:center;pointer-events:none;transition:opacity .35s,transform .35s;font:700 13px ui-monospace,monospace;letter-spacing:.12em;color:#ffd36a;text-shadow:0 2px 0 #000}
#sban.on{opacity:1;transform:translate(-50%,-50%) scale(1)}#sban big{display:block;font-size:22px;letter-spacing:.06em;color:#fff;margin:4px 0}#sban small{display:block;font:500 12px ui-monospace,monospace;letter-spacing:0;color:#e9e2cf;max-width:300px;margin:6px auto 0}`;
  document.head.appendChild(css);
  const bars = document.createElement('div'); bars.id = 'sbars'; bars.innerHTML = '<i class="t"></i><i class="b"></i>'; document.body.appendChild(bars);
  const tap = document.createElement('div'); tap.id = 'stap'; document.body.appendChild(tap);
  const radio = document.createElement('div'); radio.id = 'sradio'; document.body.appendChild(radio);
  const ban = document.createElement('div'); ban.id = 'sban'; document.body.appendChild(ban);
  const queue = []; let cur = null, radioT = 0, banT = 0, banQ = [], scene = null;
  const kaiAt = () => { const q = S.sites.find(o => o.bay); if (!q || q.exitAng === undefined) return null; const oa = q.exitAng; return { x: q.bay.x - Math.sin(oa) * 4.2 - Math.cos(oa) * 2, y: q.bay.y + Math.cos(oa) * 4.2 - Math.sin(oa) * 2 }; };
  const whereIs = who => who === 'KAI' ? kaiAt() : who === 'TOMAS' ? W.tomas : null;
  // "NAME: text" lines (a line without a name is the mission's giver's)
  const lines = (text, giver) => text ? text.split(/\s(?=[A-Z]{3,}:)/).map(t => { const m = /^([A-Z]{3,}):\s*(.*)$/.exec(t.trim()); return m ? [m[1], m[2]] : [giver, t.trim()]; }) : [];
  function events(evs) { for (const e of evs || []) {
    if (e.type === 'missionDone') { const st = CHAPTER1[e.i]; for (const [who, say] of lines(e.say, st.giver)) queue.push({ who, say }); queue.push({ banner: ['✓ ' + st.title.toUpperCase(), 'done', ''] }); }
    else if (e.type === 'missionStart') { const st = CHAPTER1[e.i]; for (const [who, say] of lines(e.say, e.giver)) queue.push({ who, say }); queue.push({ banner: ['NEW', st.title.toUpperCase(), st.line.replace(/\{n\}.*$/, '').replace(/[:.]\s*$/, '')] }); } } }
  function next() { cur = queue.shift() || null; if (!cur) { endScene(); return; }
    if (cur.banner) { endScene(); banQ.push(cur.banner); cur = null; next(); return; }
    const at = whereIs(cur.who), k = S.kai, near = at && Math.hypot(at.x - k.x, at.y - k.y) < 45;
    if (near) { startScene(at); cur.mode = 'scene'; cur.t0 = performance.now(); cur.reply = Math.random() < 0.5; }
    else { endScene(); cur.mode = 'radio'; cur.t0 = performance.now(); radio.innerHTML = `<b>${cur.who} · RADIO</b><span></span>`; radio.classList.add('on'); radioT = 2.2 + cur.say.length * 0.045; } }
  function startScene(at) { if (!scene) { scene = { z0: cam.ppm, b0: cam.base }; bars.classList.add('on'); tap.classList.add('on'); ui.paused = true; }
    const b = S.bike; lab.cam = { x: (at.x + b.x) / 2, y: (at.y + b.y) / 2 }; const d = Math.hypot(at.x - b.x, at.y - b.y); cam.base = cam.ppm = Math.max(10, Math.min(22, innerWidth / (d + 16))); }
  function endScene() { if (!scene) return; bars.classList.remove('on'); tap.classList.remove('on'); lab.cam = null; cam.ppm = scene.z0; cam.base = scene.b0; ui.paused = false; scene = null; }
  tap.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (!cur || cur.mode !== 'scene') return; const shown = (performance.now() - cur.t0) / 28;
    if (shown < cur.say.length) { cur.t0 = -1e9; return; } if (cur.reply && !cur.replied) { cur.replied = true; cur.t1 = performance.now(); return; } next(); });
  radio.addEventListener('pointerdown', () => { if (cur && cur.mode === 'radio') { radio.classList.remove('on'); next(); } });
  function update(dt) {
    const st0 = document.getElementById('start'); if ((st0 && !st0.hidden) || document.getElementById('intro')) return;   // not over the start card or the opening
    if (!cur && queue.length && !banT) next();
    if (cur && cur.mode === 'radio') { const n = Math.min(cur.say.length, Math.floor((performance.now() - cur.t0) / 28)); radio.querySelector('span').textContent = cur.say.slice(0, n); if ((radioT -= dt) <= 0) { radio.classList.remove('on'); next(); } }
    if (banT > 0) { if ((banT -= dt) <= 0) { ban.classList.remove('on'); banT = 0; } }
    else if (banQ.length && !(cur && cur.mode === 'scene')) { const [a, b, c] = banQ.shift(); ban.innerHTML = `${a}<big>${b}</big>${c ? `<small>${c}</small>` : ''}`; ban.classList.add('on'); banT = a === 'NEW' ? 3.2 : 1.8; } }
  // bubbles over the speaker and the robot, in the world (on the overlay)
  function bubble(fx, x, y, text, col, robot) { fx.font = robot ? '700 18px ui-monospace,monospace' : '500 13px ui-monospace,Menlo,monospace'; const words = text.split(' '), rows = []; let row = '';
    for (const w of words) { const t2 = row ? row + ' ' + w : w; if (fx.measureText(t2).width > 220 && row) { rows.push(row); row = w; } else row = t2; } if (row) rows.push(row);
    const lh = robot ? 22 : 17, w = Math.max(...rows.map(r => fx.measureText(r).width)) + 20, h = rows.length * lh + 14, bx = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)), by = y - h - 16;
    fx.fillStyle = 'rgba(10,11,13,.92)'; fx.strokeStyle = col; fx.lineWidth = 1.5; fx.beginPath(); fx.roundRect ? fx.roundRect(bx, by, w, h, 10) : fx.rect(bx, by, w, h); fx.fill(); fx.stroke();
    fx.beginPath(); fx.moveTo(x - 7, by + h - 0.5); fx.lineTo(x, by + h + 10); fx.lineTo(x + 7, by + h - 0.5); fx.closePath(); fx.fill();
    fx.fillStyle = robot ? '#ffc35a' : '#e9e2cf'; fx.textAlign = 'left'; fx.textBaseline = 'top'; rows.forEach((r, i) => fx.fillText(r, bx + 10, by + 7 + i * lh)); }
  function draw(fx, toS) { if (!cur || cur.mode !== 'scene') return; const at = whereIs(cur.who); if (!at) return; const [x, y] = toS(at.x, at.y), n = Math.min(cur.say.length, Math.floor((performance.now() - cur.t0) / 28));
    fx.save(); fx.font = '700 10px ui-monospace,monospace'; bubble(fx, x, y - 44, cur.say.slice(0, n) || ' ', '#f0b44c88', false);
    fx.fillStyle = '#f0b44c'; fx.textAlign = 'center'; fx.font = '700 10px ui-monospace,monospace'; fx.fillText(cur.who, x, y - 30);
    if (cur.replied) { const [rx, ry] = toS(S.bike.x, S.bike.y); bubble(fx, rx, ry - 30, ROBOT[(cur.say.length) % ROBOT.length], '#ffc35a88', true); }
    fx.restore(); }
  // a conversation: lines said now (talking to Kai), played like a mission's words
  function say(list) { for (const [who, line] of list) queue.push({ who, say: line }); }
  const kaiNear = r => { const a = kaiAt(); return !!a && Math.hypot(a.x - S.bike.x, a.y - S.bike.y) < r; };
  return { say, kaiNear, get busy() { return !!cur || queue.length > 0; }, events, update, draw, get talk() { return cur && cur.mode === 'scene' ? cur.who : null; } };
}
