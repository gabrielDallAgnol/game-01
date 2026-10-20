// The road's HUD: the mission choice at dusk (a System window that never pauses the night; off while CUT.missions),
// the mission's tool (the horn, the lantern), the station chip, a card per convoy (Go to Camp / Wait here), trip planning ("round trip 2:10 · dusk in 1:40 · Go"),
// edge arrows to stragglers and burning outposts, and the road on the map. Reads the sim; acts only through game.road.
// Created by the `// [road]` hook blocks in app.js.
import { MISSIONS, ROAD, MISSION } from '../content/road.js';
const MISSION_PICK = MISSION.pick;
import { icon } from './icons.js';

const CSS = `
.rd-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--dockH,72px) + 10px);display:grid;gap:6px;justify-items:center;pointer-events:none;width:min(440px,calc(100vw - 32px));z-index:5}
@media (max-width:640px){.rd-dock{left:max(94px,calc(env(safe-area-inset-left,0px) + 94px));right:max(94px,calc(env(safe-area-inset-right,0px) + 94px));width:auto;transform:none;justify-items:stretch}}
.rd-dock.lift{bottom:calc(var(--dockH,72px) + 80px)}
.rd-dock.wide{left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));width:auto;transform:none;bottom:calc(var(--dockH,72px) + 10px);z-index:6}
.rd-chip{pointer-events:auto;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;background:var(--camp-solid);border:1px solid var(--line);border-radius:14px;padding:7px 7px 7px 12px;font:500 13px/1.25 var(--body);max-width:100%;box-shadow:0 6px 18px rgba(0,0,0,.4);animation:tin .2s var(--ease-o)}
.rd-chip .t{flex:1 1 140px;min-width:0}.rd-chip .acts{display:flex;gap:6px;flex:none;margin-left:auto}
.rd-chip .t b{font:700 15px/1.15 var(--display);letter-spacing:.03em;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--bone)}
.rd-chip .t b .ic{color:var(--amber);flex:none}
.rd-chip .t span{color:var(--muted);font-size:12.5px;font-variant-numeric:tabular-nums}.rd-chip .t span em{font-style:normal;color:var(--bone);font-weight:600}
.rd-chip .t span em.late{color:var(--blood)}.rd-chip .t span em.ok{color:var(--good)}.rd-chip .t span em.risky{color:var(--amber)}
.rd-chip .btn{flex:none}.rd-chip .x{background:none;border:0;color:var(--muted);padding:0 4px;line-height:1;display:grid;place-items:center;min-width:32px;min-height:36px}
.rd-chip.fire{border-color:rgba(240,166,73,.5)}
.rd-chip.cv{border-color:rgba(240,166,73,.4)}
.rd-chip.sys{background:linear-gradient(180deg,rgba(8,20,34,.96),rgba(5,12,22,.97));border:1px solid var(--cyan-d);border-radius:2px;position:relative}
.rd-chip.sys .t b{font:600 13px/1.2 var(--mono);letter-spacing:.04em;color:#f2fbff}.rd-chip.sys .t b .ic{color:var(--cyan)}
.rd-chip.sys .t span{color:#a9c6d8}.rd-chip.sys .btn{background:var(--cyan);color:#04121d;border-radius:2px;font:600 13px/1 var(--mono);letter-spacing:.08em}
.rd-chip.sys .btn.ghost{background:transparent;color:var(--cyan);border:1px solid var(--cyan-d)}
.rd-chip.sys::before,.rd-chip.sys::after,.rd-win::before,.rd-win::after{content:"";position:absolute;width:8px;height:8px;border:2px solid var(--cyan);pointer-events:none}
.rd-chip.sys::before,.rd-win::before{left:-1px;top:-1px;border-right:0;border-bottom:0}.rd-chip.sys::after,.rd-win::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.rd-chip.ledger{border-color:rgba(255,106,85,.45)}.rd-chip .t span.dl.pp{color:#bfe6f5}.rd-chip .t span.dl.pp .ic{color:var(--cyan);font-size:13px;margin-right:4px;vertical-align:-2px}.rd-chip .t span.dl.pp em{color:#f2fbff}.rd-chip.ledger .t{flex-basis:100%}.rd-chip .t span.dl{display:block;margin-top:2px}.rd-chip .t span.dl em{color:var(--amber)}.rd-chip.ledger .t b .ic{color:var(--blood)}
.rd-chip.mini{flex-wrap:nowrap;gap:6px;height:46px;padding:5px 5px 5px 8px;border-radius:2px;background:linear-gradient(180deg,rgba(8,20,34,.95),rgba(5,12,22,.96));border:1px solid var(--cyan-d);position:relative;overflow:visible}
.rd-chip.mini::before{content:"";position:absolute;left:-1px;top:-1px;width:7px;height:7px;border:2px solid var(--cyan);border-right:0;border-bottom:0;pointer-events:none}
.rd-chip.mini.warm{border-color:rgba(240,166,73,.55)}.rd-chip.mini.warm::before{border-color:var(--amber)}
.rd-chip.mini .i0{flex:none;display:grid;place-items:center;width:16px;font-size:16px;color:var(--cyan)}.rd-chip.mini.warm .i0{color:var(--amber)}
.rd-chip.mini .lb{flex:1 1 auto;min-width:0;display:grid;gap:3px}
.rd-chip.mini .lb b{font:600 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:#cfeefa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-chip.mini .lb span{font:500 11.5px/1 var(--mono);color:#a9c6d8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums}
.rd-chip.mini .lb span em{font-style:normal;color:#f2fbff;font-weight:600}.rd-chip.mini .lb span em.late{color:var(--blood)}.rd-chip.mini .lb span em.risky{color:var(--amber)}.rd-chip.mini .lb span em.ok{color:var(--good)}
.rd-chip.mini .rd-hp,.rd-chip.mini .rd-prog{width:28px;margin:0;flex:none}.rd-chip.mini .lb span .ic{font-size:12px;flex:none}
.rd-chip.mini .ab{flex:none;display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 8px;border:0;border-radius:2px;background:var(--cyan);color:#04121d;font:600 12px/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;position:relative}
.rd-chip.mini .ab::after{content:"";position:absolute;inset:-5px}
.rd-chip.mini .ab .ic{font-size:15px}.rd-chip.mini .ab.ghost{background:transparent;color:var(--cyan);border:1px solid var(--cyan-d)}.rd-chip.mini .ab:disabled{opacity:.45}
.rd-chip.mini.warm .ab:not(.ghost){background:var(--amber);color:#1f1407}
.rd-hp{display:inline-block;width:56px;height:5px;border-radius:3px;background:rgba(236,223,198,.14);overflow:hidden;vertical-align:middle;margin-left:2px}.rd-hp i{display:block;height:100%;background:var(--amber);transition:width .2s}
.rd-hp.fire i{background:linear-gradient(90deg,var(--ember),#ffcf80)}
.rd-prog{display:inline-block;width:46px;height:5px;border-radius:3px;background:rgba(255,207,128,.18);overflow:hidden;vertical-align:middle;margin-left:4px}.rd-prog i{display:block;height:100%;background:#ffcf80}
.rd-win{position:fixed;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));margin:0 auto;bottom:calc(var(--dockH,72px) + 12px);max-width:420px;pointer-events:auto;z-index:7;
  background:linear-gradient(180deg,rgba(8,20,34,.96),rgba(5,12,22,.97));border:1px solid var(--cyan-d);border-radius:2px;color:#dcebf5;padding:10px 12px 12px;box-shadow:0 0 0 1px rgba(127,227,255,.08) inset,0 0 24px rgba(127,227,255,.16),0 12px 30px rgba(0,0,0,.5);animation:tin .25s var(--ease-o)}
.rd-win .sh{font:500 11.5px/1.3 var(--mono);color:var(--cyan);letter-spacing:.1em;display:flex;justify-content:space-between;gap:8px;text-transform:uppercase}
.rd-win h3{font:600 17px/22px var(--mono);margin:6px 0 4px;color:#f2fbff}
.rd-win .fc{font:400 13px/18px var(--body);color:#a9c6d8;margin:0 0 9px}.rd-win .fc b{font:600 11px/1 var(--mono);letter-spacing:.06em;padding:2px 6px;border-radius:2px;color:#04121d}
.rd-win .fc b.likely{background:var(--good)}.rd-win .fc b.risky{background:var(--amber)}.rd-win .fc b.no{background:var(--blood);color:#fff}
.rd-ms{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.rd-ms button{background:var(--cyan-f);border:1px solid rgba(127,227,255,.3);border-radius:2px;color:#e6f4ff;padding:9px 5px 10px;display:grid;gap:4px;justify-items:center;align-content:start;text-align:center;min-height:96px}
.rd-ms button .ic{font-size:24px;color:var(--cyan)}.rd-ms button b{font:600 13px/1.1 var(--mono);letter-spacing:.02em}.rd-ms button span{font:400 11.5px/1.3 var(--body);color:#a9c6d8}
.rd-ms button.def{border-color:var(--cyan);background:rgba(127,227,255,.2);box-shadow:0 0 12px rgba(127,227,255,.2) inset}
.rd-tick{height:2px;background:rgba(127,227,255,.18);margin-top:9px;overflow:hidden}.rd-tick i{display:block;height:100%;background:var(--cyan);transition:width .2s linear}
.rd-tool{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(var(--dockH,72px) + 92px);width:60px;height:60px;border-radius:50%;pointer-events:auto;z-index:4;
  background:conic-gradient(rgba(4,18,29,.75) calc(var(--cd,0) * 360deg), transparent 0),var(--cyan);color:#04121d;border:2px solid rgba(220,245,255,.6);display:grid;place-content:center;justify-items:center;gap:1px;text-align:center;box-shadow:0 0 16px rgba(127,227,255,.3),0 4px 14px rgba(0,0,0,.4)}
.rd-tool .ic{font-size:22px}.rd-tool b{font:600 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.06em}.rd-tool span{font:600 10px/1 var(--mono)}
.rd-tool.cool{background:conic-gradient(rgba(127,227,255,.35) calc(var(--cd,0) * 360deg), transparent 0),rgba(5,12,22,.94);color:#cfeaf7;border-color:var(--cyan-d);box-shadow:none}
.rd-tool.off{background:rgba(5,12,22,.94);color:#9fb6c8;border-color:var(--cyan-d);box-shadow:none}
.rd-kit{position:fixed;right:calc(max(16px,env(safe-area-inset-right,0px)) + 76px);bottom:calc(var(--dockH,72px) + 16px);display:flex;gap:8px;z-index:4;pointer-events:none}
.rd-kit button{pointer-events:auto;width:56px;height:56px;border-radius:50%;display:grid;place-content:center;justify-items:center;gap:2px;background:conic-gradient(rgba(20,16,12,.75) calc(var(--cd,0) * 360deg), transparent 0),var(--amber);color:#1f1407;border:2px solid rgba(255,236,200,.55);box-shadow:0 4px 14px rgba(0,0,0,.4);animation:tin .2s var(--ease-o)}
.rd-kit button .ic{font-size:20px}.rd-kit button b{font:700 11px/1 var(--display);letter-spacing:.06em;text-transform:uppercase}.rd-kit button span{font:600 10px/1 var(--display);display:inline-flex;align-items:center;gap:2px}.rd-kit button span .ic{font-size:10px}
.rd-kit button.cool{background:conic-gradient(rgba(240,166,73,.35) calc(var(--cd,0) * 360deg), transparent 0),var(--camp-solid);color:var(--bone);border-color:var(--line)}
.rd-kit button.poor{opacity:.55}
.rd-tag{position:fixed;right:max(16px,env(safe-area-inset-right,0px));max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis;bottom:calc(var(--dockH,72px) + 160px);font:500 10.5px/1 var(--mono);letter-spacing:.08em;color:var(--cyan);background:rgba(5,12,22,.88);border:1px solid var(--cyan-d);border-radius:2px;padding:4px 7px;pointer-events:none;text-transform:uppercase;z-index:4;white-space:nowrap}
#edge .ar.rd-cv i{border-left-color:#ffd27a}#edge .ar.rd-cv span{color:#ffd27a;width:52px;left:-50px}
#edge .ar.rd-fire i{border-left-color:#ff8a4a}#edge .ar.rd-fire span{color:#ffb07a;width:60px;left:-56px}
#edge .ar.rd-trap i{border-left-color:#7fe3ff;border-left-width:20px;border-top-width:9px;border-bottom-width:9px;top:-9px}#edge .ar.rd-trap span{color:#bff0ff;font:600 11px/1 var(--mono);letter-spacing:.04em;width:84px;left:-80px}
#edge .ar.rd-amb i{border-left-color:#ff5a3a;border-left-width:20px;border-top-width:9px;border-bottom-width:9px;top:-9px}#edge .ar.rd-amb span{color:#ff7a62}
.rd-cvs{display:grid;gap:6px;pointer-events:none}
.rd-cv{pointer-events:auto;position:relative;display:grid;gap:6px;padding:8px 8px 8px 10px;border-radius:2px;background:linear-gradient(180deg,rgba(8,20,34,.95),rgba(5,12,22,.96));border:1px solid rgba(240,166,73,.55);box-shadow:0 6px 18px rgba(0,0,0,.4);animation:tin .2s var(--ease-o)}
.rd-cv::before{content:"";position:absolute;left:-1px;top:-1px;width:7px;height:7px;border:2px solid var(--amber);border-right:0;border-bottom:0;pointer-events:none}
.rd-cv.wait{border-color:var(--cyan-d)}.rd-cv.wait::before{border-color:var(--cyan)}.rd-cv.hunted{border-color:rgba(255,106,85,.7)}
.rd-cv .hd{display:flex;align-items:center;gap:7px;min-width:0}
.rd-cv .hd .ic{flex:none;font-size:17px;color:var(--amber)}.rd-cv.wait .hd .ic{color:var(--cyan)}
.rd-cv .hd b{flex:1 1 auto;min-width:0;font:700 14px/1.1 var(--body);letter-spacing:0;color:#f2fbff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-cv .hd .rd-hp{width:34px;flex:none}
.rd-cv .st{font:500 12.5px/1.2 var(--mono);color:#cfe3ee;display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-variant-numeric:tabular-nums}
.rd-cv .st em{font-style:normal;font-weight:700;color:var(--amber)}.rd-cv.wait .st em{color:var(--cyan)}.rd-cv .st em.late{color:var(--blood)}.rd-cv .st .ic{font-size:13px}
.rd-cv .bt{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.rd-cv .bt button{min-height:46px;padding:4px 4px;border-radius:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:700 12.5px/1.05 var(--body);letter-spacing:.01em;text-align:center;background:transparent;color:#e6f4ff;border:1px solid rgba(127,227,255,.45);position:relative}
.rd-cv .bt button .ic{font-size:17px}
.rd-cv .bt button::after{content:"";position:absolute;inset:-3px}
.rd-cv .bt button[data-o="go"].on{background:var(--amber);border-color:var(--amber);color:#1f1407}
.rd-cv .bt button[data-o="wait"].on{background:var(--cyan);border-color:var(--cyan);color:#04121d}
.rd-plan{margin:8px 0 0;display:flex;align-items:center;gap:8px;background:rgba(127,227,255,.06);border:1px solid var(--cyan-d);border-radius:2px;padding:8px 8px 8px 12px}
.rd-plan .t{flex:1;min-width:0;font-size:13px}.rd-plan .t b{font:600 14px/1.2 var(--mono);display:block;color:#f2fbff}
.rd-plan .t span{color:#a9c6d8}.rd-plan .t em{font-style:normal;font-weight:600;color:#f2fbff}.rd-plan .t em.late{color:var(--blood)}.rd-plan .t em.ok{color:var(--good)}.rd-plan .t em.risky{color:var(--amber)}
.rd-plan .btn{background:var(--cyan);color:#04121d;border-radius:2px;font:600 13px/1 var(--mono);letter-spacing:.08em;min-height:40px}
`;

const TRAP_NAME = { outpost: 'fire ring', embers: 'embers', ford: 'ford', pyre: 'pitch fire' };

export function createRoadUI({ game, view, toast, hideCard, isBusy, systemHere = () => true }) {
  const road = game.road; if (!road) return null;
  const S = game.state, R = S.road, c = game.map.town.x, $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  if (!document.getElementById('rd-css')) { const st = document.createElement('style'); st.id = 'rd-css'; st.textContent = CSS; document.head.appendChild(st); }
  const els = [];
  const mk = (tag, cls, parent = document.body) => { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); els.push(e); return e; };
  const dock = mk('div', 'rd-dock');
  const tripEl = mk('div', 'rd-chip sys', dock); tripEl.hidden = true;
  const ledEl = mk('div', 'rd-chip ledger', dock); ledEl.hidden = true;
  const stEl = mk('div', 'rd-chip mini warm', dock); stEl.hidden = true;
  const cvBox = mk('div', 'rd-cvs', dock); const cvCards = new Map();
  const win = mk('div', 'rd-win'); win.hidden = true;
  const tool = mk('button', 'rd-tool'); tool.hidden = true;
  const tag = mk('div', 'rd-tag'); tag.hidden = true;
  // the field tools (Flare, Smoke) are cut (CUT.tools): game.tools() is null and the kit stays empty and hidden
  const kitOn = !!(game.tools && game.tools());
  const kit = mk('div', 'rd-kit'); if (kitOn) kit.innerHTML = `<button data-k="flare" aria-label="Throw a flare">${icon('flame')}<b>Flare</b><span></span></button><button data-k="smoke" aria-label="Light smoke">${icon('smoke')}<b>Smoke</b><span></span></button>`; kit.hidden = true;
  let hordeT = 0, ledT = 0, sigKit = '';
  const arrows = [];
  let trip = null, tripT = 0, sigSt = '', sigWin = '', sigTool = '', hudT = 0;

  // ---------- trip planning ----------
  function placeAt(p) {
    if (!p) return null;
    const st = road.stations.find(s => !S.sealed[s.region] && Math.hypot(s.x - p.x, s.y - p.y) < 4);
    if (st) return { name: st.name, x: st.x + st.normal.x * -1.4, y: st.y + st.normal.y * -1.4, kind: 'station' };
    if (p.type === 'landmark') { const l = S.landmarks[p.id]; return { name: l.kind === 'unknown' ? 'Sealed building' : (game.map.name && l.kind) ? labelOf(l) : 'A site', x: l.x, y: l.y + l.size / 2 + 1, kind: 'site' }; }
    if (p.type === 'region') { const reg = game.map.regions[p.id]; if (reg.nest && S.nestAlive[p.id]) return { name: reg.ring === 1 ? 'Forest hollow' : 'City hive', x: reg.nest.x, y: reg.nest.y + 2.4, kind: 'hive' }; if (reg.ring >= 2 && S.act !== 1) return { name: 'The city', x: p.x, y: p.y, kind: 'city' }; }
    return null;
  }
  const labelOf = l => (road.places().find(q => q.kind === 'site' && q.id === l.id) || { name: 'A site' }).name;
  function planTo(place) {
    const info = road.tripInfo(place.x, place.y); if (!info) return null;
    return { place, info };
  }
  function tripHtml(t, short) {
    const i = t.info, cls = i.late ? 'late' : i.risky ? 'risky' : 'ok';
    const fc = i.day && !short ? ` · camp holds without you: <em class="${i.campHolds.word === 'likely' ? 'ok' : i.campHolds.word === 'risky' ? 'risky' : 'late'}">${i.campHolds.word}</em>` : '';
    return `<b>${icon('route')}${esc(t.place.name)}</b><span><em class="${cls}">${i.label.replace(/ · /, '</em> · ')}${i.late ? ' · <em class="late">back after dark</em>' : ''}${fc}</span>`;
  }
  function showTrip(t) {
    trip = t; tripT = 9;
    road.preview = { path: t.info.path };
    tripEl.innerHTML = `<div class="t">${tripHtml(t)}</div><button class="btn sm" data-go>Go</button><button class="x" data-x aria-label="Close">${icon('close')}</button>`;
    tripEl.hidden = false;
    tripEl.querySelector('[data-go]').onclick = () => { if (road.go(t.place.x, t.place.y)) { closeTrip(); } };
    tripEl.querySelector('[data-x]').onclick = closeTrip;
  }
  function closeTrip() { trip = null; tripEl.hidden = true; road.preview = null; }
  // taps on the field: a far place gets a trip chip (the app still selects it as before)
  const canvas = $('#view'); let downAt = null;
  const onDown = e => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = e => {
    if (!downAt || isBusy()) return; const d = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y); const quick = performance.now() - downAt.t < 600; downAt = null;
    if (d > 14 || !quick) return;
    const place = placeAt(view.pick(e.clientX, e.clientY));
    if (!place) { if (trip) closeTrip(); return; }
    if (Math.hypot(place.x - S.hero.x, place.y - S.hero.y) < 18) { if (trip) closeTrip(); return; }
    const t = planTo(place); if (t) showTrip(t);
  };
  if (canvas) { canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); }

  // ---------- the mission window at dusk ----------
  function renderWin() {
    const M = road.mission, on = S.phase === 'night' && M.choosing && !S.over && !isBusy();
    if (!on) { if (!win.hidden) { win.hidden = true; dock.hidden = false; } sigWin = ''; return; }
    const sig = `${S.night}|${M.forecast && M.forecast.word}|${M.where}`;
    if (sig !== sigWin) {
      sigWin = sig;
      const fc = M.forecast || { word: 'likely' }, word = { likely: 'likely', risky: 'risky', no: 'no' }[fc.word] || fc.word;
      const say = { hold: 'Stand with your towers.', hunt: 'Burn a hive while its dead are out.', piper: 'Sound the horn. Lead the dead into a trap.' };
      win.innerHTML = `<div class="sh"><span>[Night ${S.night}] Choose your mission</span><span data-t></span></div>
        <h3>How do you spend the night?</h3>
        <p class="fc">Camp holds without you: <b class="${fc.word}">${esc(word.toUpperCase())}</b> · you are at ${esc(M.where || 'the camp')}${M.captain ? ` · ${esc(M.captain)} captains the camp` : ''}</p>
        <div class="rd-ms">${Object.entries(MISSIONS).map(([id, D]) => `<button data-m="${id}" class="${id === 'hold' ? 'def' : ''}">${icon(D.icon)}<b>${esc(D.name.replace(/^The /, ''))}</b><span>${esc(say[id] || D.line)}</span></button>`).join('')}</div>
        <div class="rd-tick"><i data-tick></i></div>`;
      win.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { road.setMission(b.dataset.m); renderWin(); renderTool(); }; });
    }
    win.hidden = false; dock.hidden = true;
    const t = win.querySelector('[data-t]'), tk = win.querySelector('[data-tick]');
    if (t) t.textContent = `Hold in ${Math.max(0, Math.ceil(M.t))}s`; if (tk) tk.style.width = `${Math.max(0, M.t / MISSION_PICK) * 100}%`;
  }
  // ---------- the mission's tool ----------
  function renderTool() {
    const M = road.mission, night = S.phase === 'night' && !S.over && !M.choosing;
    const kind = night && M.id === 'piper' ? 'horn' : night && M.id === 'hunt' ? 'lantern' : null;
    tool.hidden = !kind; tag.hidden = !(night && M.id !== 'hold');
    if (!kind) return;
    if (kind === 'horn') {
      const cd = M.hornCd, ear = road.missions.earshot();
      const sig = `h${Math.ceil(cd)}|${ear}`;
      if (sig !== sigTool) { sigTool = sig; tool.innerHTML = `${icon('horn')}<b>Horn</b><span>${cd > 0 ? `${Math.ceil(cd)}s` : ear ? `${ear} hear` : '–'}</span>`; }
      tool.classList.toggle('cool', cd > 0 || !ear); tool.classList.remove('off'); tool.style.setProperty('--cd', cd > 0 ? cd / MISSION.horn.cd : 0);
      tool.onclick = () => { road.horn(); };
      const hi = road.missions.hornInfo(), pay = Math.round(M.pay);
      tag.textContent = `Piper · Horn ${hi.lv} · led ${M.led} · fell ${M.ledKilled}${pay ? ` · +${pay}` : ''}`;
    } else {
      const sig = `l${M.lantern}`;
      if (sig !== sigTool) { sigTool = sig; tool.innerHTML = `${icon('lantern')}<b>Lantern</b><span>${M.lantern ? 'on' : 'off'}</span>`; }
      tool.classList.toggle('off', !M.lantern); tool.classList.remove('cool'); tool.style.setProperty('--cd', 0);
      tool.onclick = () => { road.setLantern(!M.lantern); renderTool(); };
      tag.textContent = M.lantern ? 'The Hunt · lantern on: seen' : 'The Hunt · dark: unseen, slow';
    }
  }
  // ---------- field tools: Flare and Smoke, any time, no pause (shown when the dead are on you or a hive just burned) ----------
  function flareSpot() {
    const h = S.hero, near = S.mobs.filter(m => (m.hunt || m.piped) && !m.roam && Math.hypot(m.x - h.x, m.y - h.y) < 14);
    if (!near.length) return [undefined, undefined];
    const cx = near.reduce((a, m) => a + m.x, 0) / near.length, cy = near.reduce((a, m) => a + m.y, 0) / near.length, d = Math.hypot(cx - h.x, cy - h.y) || 1;
    return [cx + (cx - h.x) / d * 6, cy + (cy - h.y) / d * 6];   // beyond the pack: they turn away from you to chase the light
  }
  if (kitOn) kit.querySelector('[data-k="flare"]').onclick = () => { const [x, y] = flareSpot(); if (game.useFlare(x, y)) { sigKit = ''; renderKit(); } };
  if (kitOn) kit.querySelector('[data-k="smoke"]').onclick = () => { if (game.useSmoke()) { sigKit = ''; renderKit(); } };
  function renderKit() {
    if (!kitOn) return;
    const h = S.hero, T = game.tools ? game.tools() : null;
    const hunted = S.mobs.some(m => (m.hunt || m.piped) && !m.roam && Math.hypot(m.x - h.x, m.y - h.y) < 16);
    const cooling = T && (!T.flare.ready || !T.smoke.ready);
    const on = !!T && !S.over && !h.dead && systemHere() && !(S.phase === 'night' && road.mission.choosing) && (hunted || hordeT > 0 || cooling);
    kit.hidden = !on; dock.classList.toggle('lift', on); if (!on) { sigKit = ''; return; }
    for (const k of ['flare', 'smoke']) {
      const t = T[k], b = kit.querySelector(`[data-k="${k}"]`);
      b.classList.toggle('cool', !t.ready); b.classList.toggle('poor', t.ready && !t.afford);
      b.style.setProperty('--cd', t.ready ? 0 : t.cd / t.cdMax);
      const sig = `${k}${Math.ceil(t.cd)}${t.afford}`; if (b.dataset.sig !== sig) { b.dataset.sig = sig; b.lastChild.innerHTML = t.ready ? `${icon(t.pay === 'scrap' ? 'scrap' : 'food')}${t.cost}` : `${Math.ceil(t.cd)}s`; }
    }
  }
  // ---------- the dawn ledger: what the night took, and one tap to rebuild it ----------
  function showLedger(L, line, dawn) {
    if (!L || S.over || (!L.fell.length && !L.ruins && !L.piper)) return;
    const ruins = game.ruins ? game.ruins() : [], all = L.rebuildAll || ruins.reduce((a, r) => a + r.cost, 0), cheap = ruins.length && S.gold >= all;
    const lost = line || (L.fell.length ? `${L.fell.length} ${L.fell.length === 1 ? 'building' : 'buildings'} fell.` : 'Nothing fell.');
    const pp = L.piper ? `<span class="dl pp">${icon('horn')}Pied Piper: led <em>${L.piper.led}</em> · <em>${L.piper.killed}</em> fell outside the walls${L.piper.pay ? ` · <em>+${L.piper.pay} scrap</em>` : ''}</span>` : '';
    ledEl.innerHTML = `<div class="t"><b>${icon('skull')}Night ${L.night}: the Camp held at ${L.held}%</b><span>${esc(lost)}${ruins.length ? ` · <em>${ruins.length} ${ruins.length === 1 ? 'ruin' : 'ruins'}</em>${cheap ? '' : ' · tap a ruin to rebuild it'}` : ''}</span>${pp}${dawn ? `<span class="dl">${esc(dawn).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>')}</span>` : ''}</div>
      <div class="acts">${cheap ? `<button class="btn sm" data-rb>Rebuild all · ${all}</button>` : ''}<button class="x" data-x aria-label="Close">${icon('close')}</button></div>`;
    const rb = ledEl.querySelector('[data-rb]'); if (rb) rb.onclick = () => { const n = game.rebuildAll(); if (n) toast(`${n} ${n === 1 ? 'ruin' : 'ruins'} rebuilt.`, 'good'); closeLedger(); };
    ledEl.querySelector('[data-x]').onclick = closeLedger;
    ledEl.hidden = false; ledT = 16; dock.classList.add('wide');
  }
  function closeLedger() { ledEl.hidden = true; ledT = 0; dock.classList.remove('wide'); }

  // ---------- station and convoy chips ----------
  function renderStation() {
    const h = S.hero, st = road.stations.find(s => Math.hypot(s.x - h.x, s.y - h.y) < 7);
    if (!st || h.dead || trip) { stEl.hidden = true; sigSt = ''; return; }
    const towers = st.towers.filter(id => S.byId.get(id)).length, cost = game.buyCost('tower'), resting = h.hp < h.maxHp && Math.hypot(st.x - h.x, st.y - h.y) < road.ringOf(st);
    const sig = `${st.id}|${st.lit}|${Math.round(st.prog * 10)}|${Math.round(st.hp)}|${towers}|${S.gold >= cost}|${resting}`;
    if (sig === sigSt) return; sigSt = sig;
    const nm = esc(st.short || st.name.replace(/^The /, ''));
    if (!st.lit) {
      stEl.innerHTML = `<span class="i0">${icon('flame')}</span><span class="lb"><b>${nm}${st.fell ? ' · out' : ''}</b><span>${st.prog > 0 ? `lighting <span class="rd-prog"><i style="width:${Math.min(100, st.prog / ROAD.lightTime * 100)}%"></i></span>` : `stand still to light · <em>${road.lightCost()}</em>${icon('scrap')}`}</span></span>`;
    } else {
      const btn = towers < ROAD.towers ? `<button class="ab" data-tw ${S.gold < cost && !(S.stock.tower > 0) ? 'disabled' : ''} aria-label="Build a forward tower">${icon('tower')}${S.stock.tower > 0 ? 'free' : cost}</button>` : '';
      stEl.innerHTML = `<span class="i0">${icon('flame')}</span><span class="lb"><b>${nm}</b><span><span class="rd-hp fire"><i style="width:${Math.max(0, st.hp / st.maxHp * 100)}%"></i></span>${icon('tower')}<em>${towers}/${ROAD.towers}</em>${resting ? '· <em class="ok">rest</em>' : ''}</span></span>${btn}`;
      const tw = stEl.querySelector('[data-tw]'); if (tw) tw.onclick = () => { road.buildTower(st.id); sigSt = ''; };
    }
    stEl.hidden = false;
  }
  /** one card per convoy: who they are, what they are doing, and the two orders (Go to Camp, Wait here) */
  function renderConvoy() {
    const list = S.over ? [] : R.convoys.filter(cv => cv.members.length).slice(0, 2), seen = new Set();
    for (const cv of list) {
      seen.add(cv.id);
      let el = cvCards.get(cv.id);
      if (!el) {
        el = document.createElement('div'); el.className = 'rd-cv'; cvBox.appendChild(el); cvCards.set(cv.id, el);
        el.innerHTML = `<div class="hd">${icon('people')}<b></b><span class="rd-hp"><i></i></span></div><div class="st"></div>
          <div class="bt"><button data-o="go" aria-label="Go to Camp">${icon('camp')}Go to Camp</button><button data-o="wait" aria-label="Wait here">${icon('pin')}Wait here</button></div>`;
        el.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => { road.order(cv.id, b.dataset.o); el.dataset.sig = ''; renderConvoy(); }; });
      }
      const mem = cv.members, people = mem.filter(m => !m.cart).length, cart = mem.some(m => m.cart), go = cv.order === 'go';
      const hp = mem.reduce((a, m) => a + Math.max(0, m.hp), 0) / mem.reduce((a, m) => a + m.maxHp, 0);
      const hurt = mem.filter(m => !m.cart && m.hp < m.maxHp - 0.5).length, ids = new Set(mem.map(m => m.id)), hunted = S.mobs.filter(z => z.cv && ids.has(z.cv)).length;
      const left = go ? Math.round(cv.left || 0) : Math.round(Math.hypot(mem[0].x - c, mem[0].y - c));
      const sig = `${people}|${cart}|${Math.round(hp * 20)}|${hurt}|${hunted}|${cv.order}|${Math.round(left / 5)}`;
      if (el.dataset.sig === sig) continue; el.dataset.sig = sig;
      el.className = `rd-cv${go ? '' : ' wait'}${hunted ? ' hunted' : ''}`;
      el.querySelector('.hd b').textContent = `${people} ${people === 1 ? 'person' : 'people'}${cart ? ' + cart' : ''}`;
      el.querySelector('.rd-hp i').style.width = `${hp * 100}%`;
      const bits = [go ? `Walking home · <em>${left} m</em>` : `Waiting${hurt ? ` · <em>${hurt} hurt</em>` : ` · <em>${left} m</em> out`}`];
      if (go && hurt) bits.push(`<em>${hurt} hurt</em>`);
      if (hunted) bits.push(`${icon('skull')}<em class="late">${hunted} on them</em>`);
      el.querySelector('.st').innerHTML = bits.join(' · ');
      el.querySelectorAll('[data-o]').forEach(b => { const on = b.dataset.o === cv.order; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    }
    for (const [id, el] of cvCards) if (!seen.has(id)) { el.remove(); cvCards.delete(id); }
  }
  // ---------- edge arrows: stragglers, outposts under attack, an ambush ahead ----------
  function edgeArrows() {
    const box = $('#edge'); if (!box) return;
    const Wd = innerWidth, Hh = innerHeight, m = 22, top = 70, bt = Hh - 150, cx = Wd / 2, cy = (top + bt) / 2, out = [];
    const off = p => !(p.x > m && p.x < Wd - m && p.y > top && p.y < bt) || p.behind;
    for (const q of road.stragglers()) { const p = view.project(q.x, q.y, 1), cv = R.convoys.find(v => v.id === q.cv); if (off(p)) out.push({ p, cls: 'rd-cv', label: cv && cv.order === 'wait' ? 'waiting' : 'convoy' }); }
    if (S.phase === 'night') for (const st of road.stations) if (st.lit && st.hp < st.maxHp) { const p = view.project(st.x, st.y, 1); if (off(p)) out.push({ p, cls: 'rd-fire', label: `${st.name.replace(/^The /, '')} ${Math.round(st.hp / st.maxHp * 100)}%` }); }
    for (const a of R.ambushes) { const p = view.project(a.x, a.y, 1); if (off(p)) out.push({ p, cls: 'rd-amb', label: '!' }); }
    const M = road.mission;
    if (S.phase === 'night' && M.id === 'piper' && !M.choosing && !S.hero.dead) { const t = road.missions.nearestTrap(S.hero.x, S.hero.y); if (t) { const p = view.project(t.x, t.y, 1); if (off(p)) out.unshift({ p, cls: 'rd-trap', label: `${TRAP_NAME[t.kind] || 'trap'} ${Math.round(Math.hypot(t.x - S.hero.x, t.y - S.hero.y))}` }); } }
    let i = 0;
    for (const o of out.slice(0, 6)) {
      let el = arrows[i]; if (!el) { el = document.createElement('div'); el.className = 'ar'; el.innerHTML = '<i></i><span></span>'; box.appendChild(el); arrows[i] = el; els.push(el); }
      const ang = Math.atan2(o.p.y - cy, o.p.x - cx) + (o.p.behind ? Math.PI : 0), cs = Math.cos(ang), sn = Math.sin(ang), hx = Wd / 2 - m, hy = Math.max(10, (bt - top) / 2 - m * 0.5), k = Math.min(Math.abs(hx / (cs || 1e-6)), Math.abs(hy / (sn || 1e-6)));
      el.style.transform = `translate(${cx + cs * k}px, ${cy + sn * k}px) rotate(${ang}rad)`;
      el.className = `ar ${o.cls}`; const sp = el.lastChild; sp.textContent = o.label; sp.style.transform = `rotate(${-ang}rad)`; el.hidden = false; i++;
    }
    for (; i < arrows.length; i++) arrows[i].hidden = true;
  }

  // ---------- per frame ----------
  function tick(dt) {
    renderWin();
    if ((hudT -= dt) > 0) { return; } hudT = 0.12;
    renderTool(); renderStation(); renderConvoy(); renderKit();
    if (hordeT > 0) hordeT -= 0.12;
    if (ledT > 0) { if (!isBusy()) ledT -= 0.12; if (ledT <= 0 || S.phase === 'night') closeLedger(); }
    if (trip) { tripT -= 0.12; if (tripT <= 0 || S.hero.dead || (S.hero.input.x || S.hero.input.y)) closeTrip(); }
    edgeArrows();
    if (S.over) { win.hidden = true; tool.hidden = true; tag.hidden = true; kit.hidden = true; closeLedger(); }
  }

  // ---------- the map: stations, the convoy, an ambush; tap a place to plan a trip there ----------
  function marks(ctx, ox, oy, s, big) {
    const dot = (x, y, r, col, ring, lw = 2) => { ctx.beginPath(); ctx.arc((x - ox) * s, (y - oy) * s, r, 0, 7); if (ring) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); } };
    const shown = road.stations.filter(st => !S.sealed[st.region]);   // [acts] a station behind the fence is not on the map
    for (const st of shown) {
      if (st.lit) { const g = ctx.createRadialGradient((st.x - ox) * s, (st.y - oy) * s, 0, (st.x - ox) * s, (st.y - oy) * s, (big ? 16 : 9)); g.addColorStop(0, 'rgba(255,190,100,.75)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc((st.x - ox) * s, (st.y - oy) * s, big ? 16 : 9, 0, 7); ctx.fill(); dot(st.x, st.y, big ? 5 : 3, '#ffcf80'); }
      else dot(st.x, st.y, big ? 5 : 3, st.fell ? '#8a7a6a' : '#ffcf80', true, big ? 2 : 1.5);
    }
    const M = road.mission;
    if (S.phase === 'night' && M.id === 'piper' && !M.choosing) for (const t of road.missions.traps()) { dot(t.x, t.y, Math.max(big ? 6 : 4, t.r * s), 'rgba(127,227,255,.9)', true, big ? 2 : 1.5); dot(t.x, t.y, big ? 2.5 : 1.6, '#7fe3ff'); }
    for (const q of road.members()) dot(q.x, q.y, big ? 3.5 : 2.2, '#ffd27a');
    // each convoy: a ring round its head, amber while it walks home, cyan while it waits (named on the big map)
    for (const cv of R.convoys) { const L = cv.members[0]; if (!L) continue; const col = cv.order === 'wait' ? '#7fe3ff' : '#ffd27a'; dot(L.x, L.y, big ? 9 : 5, col, true, big ? 2.5 : 1.5);
 }
    for (const a of R.ambushes) dot(a.x, a.y, big ? 5 : 3, '#ff5a3a');
    if (big) {
      ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      for (const st of shown) { const t = st.name.replace(/^The /, ''), x = (st.x - ox) * s + 9, y = (st.y - oy) * s + 5; ctx.strokeText(t, x, y); ctx.fillStyle = st.lit ? '#ffcf80' : '#e9dcc6'; ctx.fillText(t, x, y); }
      // the convoy's order, under its ring (drawn last so a station's name never hides it)
      ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'right';
      for (const cv of R.convoys) { const L = cv.members[0]; if (!L) continue; const t = cv.order === 'wait' ? 'Waiting' : `Walking home · ${Math.round(cv.left || 0)} m`, x = (L.x - ox) * s - 12, y = (L.y - oy) * s + 5; ctx.strokeText(t, x, y); ctx.fillStyle = cv.order === 'wait' ? '#7fe3ff' : '#ffd27a'; ctx.fillText(t, x, y); }
      ctx.textAlign = 'left';
    }
  }
  function onMap(cv, ox, oy, s) {
    const card = cv.closest('.card') || cv.parentElement.parentElement, base = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    let box = card.querySelector('.rd-plan'); if (!box) { box = document.createElement('div'); box.className = 'rd-plan'; box.innerHTML = '<div class="t"><b>Tap a place to plan a trip</b><span>The old road is quick; the woods are slow.</span></div>'; cv.parentElement.after(box); }
    const draw = path => {
      const ctx = cv.getContext('2d'); ctx.putImageData(base, 0, 0);
      if (!path || !path.length) return;
      ctx.strokeStyle = '#ffe0a8'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo((S.hero.x - ox) * s, (S.hero.y - oy) * s);
      for (const p of path) ctx.lineTo((p.x - ox) * s, (p.y - oy) * s); ctx.stroke(); ctx.setLineDash([]);
    };
    cv.style.cursor = 'pointer';
    cv.onclick = e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (cv.width / r.width) / s + ox, y = (e.clientY - r.top) * (cv.height / r.height) / s + oy;
      let best = null, bd = 9;
      for (const q of road.places()) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } }
      if (!best) { box.innerHTML = '<div class="t"><b>Nothing known there</b><span>Tap a station, a site, a hive, the city or the camp.</span></div>'; draw(null); return; }
      const info = road.tripInfo(best.x, best.y); if (!info) return;
      const t = { place: best, info };
      box.innerHTML = `<div class="t">${tripHtml(t)}</div><button class="btn sm" data-go>Go</button>`;
      box.querySelector('[data-go]').onclick = () => { if (road.go(best.x, best.y)) { hideCard(); toast(`[Trip] On the way to ${best.name}. Touch the stick to take over.`, 'sys'); } };
      draw(info.path);
    };
  }
  function dispose() { if (canvas) { canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); } for (const e of els) e.remove(); }
  /** app.js forwards the sim's events: a burned hive shows the field tools for a while */
  function onEvents(evs) { for (const e of evs) { if (e.t === 'horde') hordeT = 45; if (e.t === 'rebuild' && !ledEl.hidden && !(game.ruins && game.ruins().length)) closeLedger(); } }
  return { tick, marks, onMap, dispose, closeTrip, showLedger, onEvents };
}
