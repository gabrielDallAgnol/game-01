// [roam] Story beats (Gabriel, Nov 2: "better transitions for missions starting and finishing, more interaction between
// characters"). A mission's words are no longer toasts:
// - near the one who speaks (Kai at her garage, Tomas at his door), a scene: thin bars slide in, the camera eases onto
//   both of you, a speech bubble rises over their head and types out; the speaker waves; the robot answers in its eye's
//   light (a bubble of glyph marks over it). Tap to go on. The rules wait meanwhile.
// - far from them, Kai's voice on the radio: a small card at the top that types out and goes by itself.
// - between missions, a banner: "✓ <title>, done", then "NEW · <title>" with its objective.
// UI only: it reads the events and the state, holds the camera (lab.cam) and pauses (ui.paused); never writes the state.
import { CHAPTER1, readyOf } from '../play/missions.js';
import { FREED, MENDED } from './introui.js';
const ROBOT = ['▪ ▫ ▪', '▪▪', '▫ ▪', '▪ ▪ ▪', '▪'];
export function createStoryUi({ sim, ui, lab, cam, town }) {
  const S = sim.state, W = town.W.world || {};
  const css = document.createElement('style'); css.textContent = `#sbars i{position:fixed;left:0;right:0;height:0;background:#000;z-index:55;transition:height .45s ease}#sbars i.t{top:0}#sbars i.b{bottom:0}#sbars.on i{height:6vh}
body.scene #hud,body.scene #loot,body.scene #area,body.scene #obj,body.scene #pad,body.scene #toasts,body.scene #boss,body.scene #linkBtn,body.scene #mendBtn,body.scene #garageBtn,body.scene #fix{visibility:hidden}
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
  let readyKey = '', lastI = -1;
  const queue = []; let cur = null, radioT = 0, banT = 0, banQ = [], scene = null;
  const kaiAt = () => { const q = S.sites.find(o => o.bay); if (!q || q.exitAng === undefined) return null; const oa = q.exitAng; return { x: q.bay.x - Math.sin(oa) * 4.2 - Math.cos(oa) * 2, y: q.bay.y + Math.cos(oa) * 4.2 - Math.sin(oa) * 2 }; };
  const whereIs = who => who === 'KAI' ? kaiAt() : sim.giverAt(who);
  // "NAME: text" lines (a line without a name is the mission's giver's)
  const lines = (text, giver) => text ? text.split(/\s(?=[A-Z]{3,}:)/).map(t => { const m = /^([A-Z]{3,}):\s*(.*)$/.exec(t.trim()); return m ? [m[1], m[2]] : [giver, t.trim()]; }) : [];
  // [story] the colour coming back, shown: the camera pulls far out over where it starts and holds while the sweep runs
  // across the land, then comes back (a beat in the queue, before the words about it)
  function events(evs) { let freed = null, mended = null; for (const e of evs || []) {
    if (e.type === 'clean' && e.x !== undefined) queue.push({ sweep: { x: e.x, y: e.y } });
    else if (e.type === 'freed') freed = e; else if (e.type === 'mended') mended = e;
    if (e.type === 'missionDone') { const st = CHAPTER1[e.i]; for (const [who, say] of lines(e.say, st.giver)) queue.push({ who, say }); queue.push({ banner: ['✓ ' + st.title.toUpperCase(), 'done', ''] }); }
    else if (e.type === 'missionStart') { const st = CHAPTER1[e.i]; if (e.main) for (const [who, say] of lines(e.say, e.giver)) queue.push({ who, say }); queue.push({ banner: ['NEW', st.title.toUpperCase(), st.line.replace(/\{n\}.*$/, '').replace(/[:.]\s*$/, '')] }); } }
    if (freed) { const done = queue.findIndex(q => q.sweep); queue.splice(done + 1, 0, ...FREED.map(([who, say]) => ({ who, say, radio: true }))); }
    if (mended) for (const [who, say] of MENDED) queue.push({ who, say, radio: true }); }
  function next() { cur = queue.shift() || null; if (!cur) { endScene(); if (after) { const f = after; after = null; f(); } return; }
    if (cur.banner) { endScene(); banQ.push(cur.banner); cur = null; next(); return; }
    if (cur.sweep) { startScene(null); cur.mode = 'sweep'; cur.t = 0; cur.from = { x: lab.cam ? lab.cam.x : cam.x, y: lab.cam ? lab.cam.y : cam.y, z: cam.ppm }; return; }
    const at = whereIs(cur.who), k = S.kai, near = !cur.radio && at && Math.hypot(at.x - k.x, at.y - k.y) < 45;
    if (near) { startScene(at); cur.mode = 'scene'; cur.t0 = performance.now(); cur.reply = Math.random() < 0.5; }
    else { endScene(); cur.mode = 'radio'; cur.t0 = performance.now(); radio.innerHTML = `<b>${cur.who === 'ROBOT' ? 'THE ROBOT' : cur.who + ' · RADIO'}</b><span></span>`; radio.classList.add('on'); radioT = 2.2 + cur.say.length * 0.045; } }
  function startScene(at) { if (!scene) { scene = { z0: cam.ppm, b0: cam.base }; bars.classList.add('on'); tap.classList.add('on'); document.body.classList.add('scene'); ui.paused = true; }
    if (!at) return; const b = S.bike; lab.cam = { x: (at.x + b.x) / 2, y: (at.y + b.y) / 2 }; const d = Math.hypot(at.x - b.x, at.y - b.y); cam.base = cam.ppm = Math.max(10, Math.min(22, innerWidth / (d + 16))); }
  function endScene() { if (!scene) return; bars.classList.remove('on'); tap.classList.remove('on'); document.body.classList.remove('scene'); lab.cam = null; cam.ppm = scene.z0; cam.base = scene.b0; ui.paused = false; scene = null; }
  tap.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (!cur || cur.mode !== 'scene') return; const shown = (performance.now() - cur.t0) / 28;
    if (shown < cur.say.length) { cur.t0 = -1e9; return; } if (cur.reply && !cur.replied) { cur.replied = true; cur.t1 = performance.now(); return; } next(); });
  radio.addEventListener('pointerdown', () => { if (cur && cur.mode === 'radio') { radio.classList.remove('on'); next(); } });
  // the sweep shot: 1.6 s out (eased), hold while the colour runs out from the spot, 1.2 s back to the robot
  const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, OUT = 1.6, HOLD = 5.2, BACK = 1.2, WIDE = 2.4;
  function stepSweep(dt) { const c = cur; c.t += dt; const b = S.bike, f = c.from, sx = c.sweep.x, sy = c.sweep.y;
    if (c.t < OUT) { const u = ease(c.t / OUT); lab.cam = { x: f.x + (sx - f.x) * u, y: f.y + (sy - f.y) * u }; cam.base = cam.ppm = f.z + (WIDE - f.z) * u; }
    else if (c.t < OUT + HOLD) { lab.cam = { x: sx, y: sy }; cam.base = cam.ppm = WIDE * (1 - 0.06 * (c.t - OUT) / HOLD); }
    else if (c.t < OUT + HOLD + BACK) { const u = ease((c.t - OUT - HOLD) / BACK), z0 = WIDE * 0.94; lab.cam = { x: sx + (b.x - sx) * u, y: sy + (b.y - sy) * u }; cam.base = cam.ppm = z0 + (scene.z0 - z0) * u; }
    else next(); }
  function update(dt) {
    const st0 = document.getElementById('start'); if ((st0 && !st0.hidden) || document.getElementById('intro')) return;   // not over the start card or the opening
    // the gathering's done: say so, loudly, once per step
    if ((S.mission ? S.mission.i : -1) !== lastI) { lastI = S.mission ? S.mission.i : -1; banQ = banQ.filter(q => q[1] !== 'GO BACK'); }   // a step done at once: no stale 'go back'
    if (S.mission) { const r = readyOf(S, CHAPTER1[S.mission.i]), key = r ? S.mission.i + r.what : ''; if (key && key !== readyKey) banQ.push(['✓ GOT ' + r.what, 'GO BACK', r.then]); readyKey = key; }
    if (!cur && queue.length && !banT) next();
    if (cur && cur.mode === 'sweep') { stepSweep(dt); return; }
    if (cur && cur.mode === 'radio') { const n = Math.min(cur.say.length, Math.floor((performance.now() - cur.t0) / 28)); radio.querySelector('span').textContent = cur.say.slice(0, n); if ((radioT -= dt) <= 0) { radio.classList.remove('on'); next(); } }
    if (banT > 0) { if ((banT -= dt) <= 0) { ban.classList.remove('on'); banT = 0; } }
    else if (banQ.length && !(cur && cur.mode === 'scene')) { const [a, b, c] = banQ.shift(); ban.innerHTML = `${a}<big>${b}</big>${c ? `<small>${c}</small>` : ''}`; ban.classList.add('on'); banT = a === 'NEW' ? 3.2 : b === 'GO BACK' ? 2.8 : 1.8; } }
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
  let after = null; function say(list, then) { for (const [who, line] of list) queue.push({ who, say: line }); after = then || null; }
  const kaiNear = r => { const a = kaiAt(); return !!a && Math.hypot(a.x - S.bike.x, a.y - S.bike.y) < r; };
  function banner(a, b, c) { banQ.push([a, b, c || '']); }
  return { banner, say, kaiNear, get busy() { return !!cur || queue.length > 0; }, events, update, draw, get talk() { return cur && cur.mode === 'scene' ? cur.who : null; } };
}
