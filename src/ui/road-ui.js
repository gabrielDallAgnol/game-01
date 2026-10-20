// The road's HUD: the mission choice at dusk (a System window that never pauses the night), the mission's tool
// (the horn, the lantern), the station and convoy chips, trip planning ("round trip 2:10 · dusk in 1:40 · Go"),
// edge arrows to stragglers and burning outposts, and the road on the map. Reads the sim; acts only through game.road.
// Created by the `// [road]` hook blocks in app.js.
import { MISSIONS, ROAD } from '../content/road.js';
import { fmtTime } from '../sim/road.js';

const CSS = `
.rd-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--dockH,140px) + 8px);display:grid;gap:6px;justify-items:center;pointer-events:none;width:min(440px,calc(100vw - 32px));z-index:4}
.rd-chip{pointer-events:auto;display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:6px 6px 6px 12px;backdrop-filter:blur(6px);font-size:13px;line-height:1.25;max-width:100%;box-shadow:0 4px 14px rgba(0,0,0,.35);animation:tin .18s ease-out}
.rd-chip{flex-wrap:wrap}.rd-chip .t{flex:1 1 150px;min-width:0}.rd-chip .acts{display:flex;gap:6px;flex:none;margin-left:auto}.rd-chip .t b{font-family:var(--display);font-weight:800;font-size:15px;letter-spacing:.02em;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-chip .t span{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}.rd-chip .t span em{font-style:normal;color:var(--bone);font-weight:700}
.rd-chip .t span em.late{color:#ff8a6a}.rd-chip .t span em.ok{color:#b4e08a}.rd-chip .t span em.risky{color:#e8b05a}
.rd-chip .btn{flex:none}.rd-chip .x{background:none;border:0;color:var(--muted);font-size:20px;padding:0 6px;line-height:1}
.rd-chip.fire{border-color:rgba(255,190,110,.55);background:linear-gradient(180deg,rgba(40,26,12,.9),rgba(22,16,10,.9))}
.rd-chip.cv{border-color:rgba(255,210,122,.5)}
.rd-hp{display:inline-block;width:64px;height:5px;border-radius:3px;background:rgba(236,223,198,.14);overflow:hidden;vertical-align:middle;margin-left:4px}.rd-hp i{display:block;height:100%;background:#ffd27a;transition:width .2s}
.rd-hp.fire i{background:linear-gradient(90deg,#ff7a3a,#ffcf80)}
.rd-prog{display:inline-block;width:46px;height:5px;border-radius:3px;background:rgba(255,207,128,.18);overflow:hidden;vertical-align:middle;margin-left:4px}.rd-prog i{display:block;height:100%;background:#ffcf80}
.rd-win{position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top,0px));width:min(420px,calc(100vw - 32px));pointer-events:auto;z-index:6;
  background:linear-gradient(180deg,rgba(20,32,44,.95),rgba(12,20,30,.95));border:1px solid rgba(120,200,255,.55);border-radius:4px;color:#d8f0ff;padding:10px 12px 12px;box-shadow:0 0 0 1px rgba(120,200,255,.12) inset,0 0 24px rgba(80,170,255,.28),0 12px 30px rgba(0,0,0,.45);animation:tin .25s ease-out}
.rd-win::before{content:"";position:absolute;left:-1px;top:-1px;width:12px;height:12px;border-left:2px solid #7fd4ff;border-top:2px solid #7fd4ff}
.rd-win::after{content:"";position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-right:2px solid #7fd4ff;border-bottom:2px solid #7fd4ff}
.rd-win .sh{font-family:var(--mono);font-size:12px;color:#7fd4ff;letter-spacing:.06em;display:flex;justify-content:space-between;gap:8px}
.rd-win h3{font-family:var(--display);font-weight:800;font-size:22px;line-height:1.05;margin:4px 0 2px;color:#e6f4ff}
.rd-win .fc{font-family:var(--mono);font-size:12px;color:#bfe0f5;margin:0 0 8px}.rd-win .fc b{padding:0 6px 1px;border-radius:3px;color:#0d1620}
.rd-win .fc b.likely{background:var(--easy)}.rd-win .fc b.risky{background:var(--medium)}.rd-win .fc b.no{background:var(--impossible);color:#fff}
.rd-ms{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.rd-ms button{background:rgba(127,212,255,.08);border:1px solid rgba(127,212,255,.35);border-radius:6px;color:#e6f4ff;padding:8px 6px 9px;display:grid;gap:3px;justify-items:center;text-align:center;min-height:88px}
.rd-ms button .i{font-size:22px;line-height:1}.rd-ms button b{font-family:var(--display);font-weight:800;font-size:15px;line-height:1.05}.rd-ms button span{font-size:11px;line-height:1.25;color:#a9cde4}
.rd-ms button.def{border-color:#7fd4ff;background:rgba(127,212,255,.16)}
.rd-tick{height:3px;border-radius:2px;background:rgba(127,212,255,.18);margin-top:8px;overflow:hidden}.rd-tick i{display:block;height:100%;background:#7fd4ff;transition:width .2s linear}
.rd-tool{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(162px + env(safe-area-inset-bottom,0px));width:66px;height:66px;border-radius:50%;pointer-events:auto;z-index:4;
  background:conic-gradient(rgba(10,14,15,.7) calc(var(--cd,0) * 360deg), transparent 0),#7fd4ff;color:#0d1620;border:2px solid rgba(220,240,255,.6);display:grid;place-content:center;gap:0;text-align:center;box-shadow:0 0 18px rgba(80,170,255,.35),0 4px 16px rgba(0,0,0,.4)}
.rd-tool .i{font-size:22px;line-height:1}.rd-tool b{font-family:var(--display);font-weight:800;font-size:11px;line-height:1;text-transform:uppercase;letter-spacing:.04em}.rd-tool span{font-size:10px;font-weight:700}
.rd-tool.cool{background:conic-gradient(rgba(127,212,255,.35) calc(var(--cd,0) * 360deg), transparent 0),var(--panel-solid);color:var(--bone);border-color:var(--line);box-shadow:none}
.rd-tool.off{background:#1a2430;color:#9fb6c8;border-color:rgba(127,212,255,.35);box-shadow:none}
.rd-tag{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(232px + env(safe-area-inset-bottom,0px));font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;color:#7fd4ff;background:rgba(12,20,30,.85);border:1px solid rgba(127,212,255,.5);border-radius:3px;padding:2px 7px;pointer-events:none;text-transform:uppercase;z-index:4;white-space:nowrap}
#edge .ar.rd-cv i{border-left-color:#ffd27a}#edge .ar.rd-cv span{color:#ffd27a;width:52px;left:-50px}
#edge .ar.rd-fire i{border-left-color:#ff8a4a}#edge .ar.rd-fire span{color:#ffb07a;width:60px;left:-56px}
#edge .ar.rd-amb i{border-left-color:#ff5a3a;border-left-width:20px;border-top-width:9px;border-bottom-width:9px;top:-9px}#edge .ar.rd-amb span{color:#ff7a62}
.rd-plan{margin:8px 0 0;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;padding:8px 8px 8px 12px}
.rd-plan .t{flex:1;min-width:0;font-size:13px}.rd-plan .t b{font-family:var(--display);font-weight:800;font-size:16px;display:block}
.rd-plan .t span{color:var(--muted)}.rd-plan .t em{font-style:normal;font-weight:700;color:var(--bone)}.rd-plan .t em.late{color:#ff8a6a}
`;

export function createRoadUI({ game, view, toast, hideCard, isBusy }) {
  const road = game.road; if (!road) return null;
  const S = game.state, R = S.road, c = game.map.town.x, $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  if (!document.getElementById('rd-css')) { const st = document.createElement('style'); st.id = 'rd-css'; st.textContent = CSS; document.head.appendChild(st); }
  const els = [];
  const mk = (tag, cls, parent = document.body) => { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); els.push(e); return e; };
  const dock = mk('div', 'rd-dock');
  const tripEl = mk('div', 'rd-chip', dock); tripEl.hidden = true;
  const stEl = mk('div', 'rd-chip fire', dock); stEl.hidden = true;
  const cvEl = mk('div', 'rd-chip cv', dock); cvEl.hidden = true;
  const win = mk('div', 'rd-win'); win.hidden = true;
  const tool = mk('button', 'rd-tool'); tool.hidden = true;
  const tag = mk('div', 'rd-tag'); tag.hidden = true;
  const arrows = [];
  let trip = null, tripT = 0, sigSt = '', sigCv = '', sigWin = '', sigTool = '', hudT = 0;

  // ---------- trip planning ----------
  function placeAt(p) {
    if (!p) return null;
    const st = road.stations.find(s => Math.hypot(s.x - p.x, s.y - p.y) < 4);
    if (st) return { name: st.name, x: st.x + st.normal.x * -1.4, y: st.y + st.normal.y * -1.4, kind: 'station' };
    if (p.type === 'landmark') { const l = S.landmarks[p.id]; return { name: l.kind === 'unknown' ? 'Sealed building' : (game.map.name && l.kind) ? labelOf(l) : 'A site', x: l.x, y: l.y + l.size / 2 + 1, kind: 'site' }; }
    if (p.type === 'region') { const reg = game.map.regions[p.id]; if (reg.nest && S.nestAlive[p.id]) return { name: reg.ring === 1 ? 'Forest hollow' : 'City hive', x: reg.nest.x, y: reg.nest.y + 2.4, kind: 'hive' }; if (reg.ring >= 2) return { name: 'The city', x: p.x, y: p.y, kind: 'city' }; }
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
    return `<b>${esc(t.place.name)}</b><span><em class="${cls}">${i.label.replace(/ · /, '</em> · ')}${i.late ? ' · <em class="late">back after dark</em>' : ''}${fc}</span>`;
  }
  function showTrip(t) {
    trip = t; tripT = 9;
    road.preview = { path: t.info.path };
    tripEl.innerHTML = `<div class="t">${tripHtml(t)}</div><button class="btn" data-go>Go</button><button class="x" data-x aria-label="Close">&times;</button>`;
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
    const M = road.mission, on = S.phase === 'night' && M.choosing && !S.over;
    if (!on) { if (!win.hidden) win.hidden = true; sigWin = ''; return; }
    const sig = `${S.night}|${M.forecast && M.forecast.word}|${M.where}`;
    if (sig !== sigWin) {
      sigWin = sig;
      const fc = M.forecast || { word: 'likely' };
      win.innerHTML = `<div class="sh"><span>[System] Night ${S.night}: choose your mission</span><span data-t></span></div>
        <h3>How do you spend the night?</h3>
        <p class="fc">Camp holds without you: <b class="${fc.word}">${fc.word.toUpperCase()}</b> · your night: ${esc(M.where || 'the camp')}${M.captain ? ` · ${esc(M.captain)} captains the camp (towers +15%)` : ''}</p>
        <div class="rd-ms">${Object.entries(MISSIONS).map(([id, D]) => `<button data-m="${id}" class="${id === 'hold' ? 'def' : ''}"><span class="i">${D.icon}</span><b>${esc(D.name)}</b><span>${esc(id === 'hold' ? 'Stand with your towers.' : id === 'hunt' ? 'Burn a hive while its dead are out.' : 'Horn: pull the dead into a trap.')}</span></button>`).join('')}</div>
        <div class="rd-tick"><i data-tick></i></div>`;
      win.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { road.setMission(b.dataset.m); renderWin(); renderTool(); }; });
    }
    win.hidden = false;
    const t = win.querySelector('[data-t]'), tk = win.querySelector('[data-tick]');
    if (t) t.textContent = `Hold in ${Math.ceil(M.t)}s`; if (tk) tk.style.width = `${Math.max(0, M.t / 6) * 100}%`;
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
      if (sig !== sigTool) { sigTool = sig; tool.innerHTML = `<span class="i">📯</span><b>Horn</b><span>${cd > 0 ? `${Math.ceil(cd)}s` : ear ? `${ear} hear` : '—'}</span>`; }
      tool.classList.toggle('cool', cd > 0 || !ear); tool.classList.remove('off'); tool.style.setProperty('--cd', cd > 0 ? cd / 28 : 0);
      tool.onclick = () => { road.horn(); };
      tag.textContent = `📯 Pied Piper · led ${M.led} · down ${M.ledKilled}`;
    } else {
      const sig = `l${M.lantern}`;
      if (sig !== sigTool) { sigTool = sig; tool.innerHTML = `<span class="i">${M.lantern ? '🏮' : '🌑'}</span><b>Lantern</b><span>${M.lantern ? 'on' : 'off'}</span>`; }
      tool.classList.toggle('off', !M.lantern); tool.classList.remove('cool'); tool.style.setProperty('--cd', 0);
      tool.onclick = () => { road.setLantern(!M.lantern); renderTool(); };
      tag.textContent = M.lantern ? '🔥 The Hunt · lantern on: seen' : '🔥 The Hunt · dark: unseen, slow';
    }
  }
  // ---------- station and convoy chips ----------
  function renderStation() {
    const h = S.hero, st = road.stations.find(s => Math.hypot(s.x - h.x, s.y - h.y) < 7);
    if (!st || h.dead || trip) { stEl.hidden = true; sigSt = ''; return; }
    const towers = st.towers.filter(id => S.byId.get(id)).length, cost = game.buyCost('tower'), cvNear = road.members().some(m => Math.hypot(m.x - st.x, m.y - st.y) < road.ringOf(st) + 1);
    const sig = `${st.id}|${st.lit}|${Math.round(st.prog * 10)}|${Math.round(st.hp)}|${towers}|${S.gold >= cost}|${cvNear}|${R.convoys.some(cv => cv.hold)}`;
    if (sig === sigSt) return; sigSt = sig;
    if (!st.lit) {
      stEl.innerHTML = `<div class="t"><b>🔥 ${esc(st.name)}</b><span>${st.prog > 0 ? `Lighting the fire <span class="rd-prog"><i style="width:${Math.min(100, st.prog / ROAD.lightTime * 100)}%"></i></span>` : `Stand still by the fire to light it · <em>${road.lightCost()} scrap</em>`}${st.fell ? ' · it went out' : ''}</span></div>`;
    } else {
      const holding = R.convoys.some(cv => cv.hold);
      stEl.innerHTML = `<div class="t"><b>🔥 ${esc(st.name)} · outpost</b><span>fire <span class="rd-hp fire"><i style="width:${Math.max(0, st.hp / st.maxHp * 100)}%"></i></span> · towers ${towers}/${ROAD.towers}${h.hp < h.maxHp && Math.hypot(st.x - h.x, st.y - h.y) < road.ringOf(st) ? ' · <em>resting</em>' : ''}</span></div>
        <div class="acts">${towers < ROAD.towers ? `<button class="btn sm" data-tw ${S.gold < cost && !(S.stock.tower > 0) ? 'disabled' : ''}>Tower · ${S.stock.tower > 0 ? 'free' : cost}</button>` : ''}
        ${cvNear ? `<button class="btn ghost sm" data-hold>${holding ? 'Follow' : 'Shelter'}</button>` : ''}</div>`;
      const tw = stEl.querySelector('[data-tw]'); if (tw) tw.onclick = () => { road.buildTower(st.id); sigSt = ''; };
      const hb = stEl.querySelector('[data-hold]'); if (hb) hb.onclick = () => { road.hold(!holding); sigSt = ''; };
    }
    stEl.hidden = false;
  }
  function renderConvoy() {
    const mem = road.members();
    if (!mem.length || S.over) { cvEl.hidden = true; sigCv = ''; return; }
    const people = mem.filter(m => !m.cart).length, cart = mem.some(m => m.cart), hp = mem.reduce((a, m) => a + Math.max(0, m.hp), 0) / mem.reduce((a, m) => a + m.maxHp, 0);
    const hunted = S.mobs.filter(m => m.cv).length, strag = road.stragglers().length, waiting = mem.some(m => m.state === 'wait'), d = Math.round(Math.hypot(mem[0].x - c, mem[0].y - c));
    const sig = `${people}|${cart}|${Math.round(hp * 20)}|${hunted}|${strag}|${waiting}|${Math.round(d / 5)}`;
    if (sig === sigCv) return; sigCv = sig;
    const eta = mem.length ? Math.round(d / 1.5) : 0;
    cvEl.innerHTML = `<div class="t"><b>👥 Convoy · ${people} ${people === 1 ? 'person' : 'people'}${cart ? ' + cart' : ''}</b><span><span class="rd-hp"><i style="width:${hp * 100}%"></i></span> · ${hunted ? `<em class="late">${hunted} dead on them</em>` : waiting ? 'waiting' : `home in ~${fmtTime(eta)}`}${strag ? ` · <em class="risky">${strag} straggling</em>` : ''}</span></div>
      <button class="btn sm" data-home>Lead home</button>`;
    cvEl.querySelector('[data-home]').onclick = () => { if (R.convoys.some(cv => cv.hold)) road.hold(false); road.go(c, c + 3.5); };
    cvEl.hidden = false;
  }
  // ---------- edge arrows: stragglers, outposts under attack, an ambush ahead ----------
  function edgeArrows() {
    const box = $('#edge'); if (!box) return;
    const Wd = innerWidth, Hh = innerHeight, m = 22, top = 70, bt = Hh - 150, cx = Wd / 2, cy = (top + bt) / 2, out = [];
    const off = p => !(p.x > m && p.x < Wd - m && p.y > top && p.y < bt) || p.behind;
    for (const q of road.stragglers()) { const p = view.project(q.x, q.y, 1); if (off(p)) out.push({ p, cls: 'rd-cv', label: q.cart ? 'cart' : q.name }); }
    if (S.phase === 'night') for (const st of road.stations) if (st.lit && st.hp < st.maxHp) { const p = view.project(st.x, st.y, 1); if (off(p)) out.push({ p, cls: 'rd-fire', label: `${st.name.replace(/^The /, '')} ${Math.round(st.hp / st.maxHp * 100)}%` }); }
    for (const a of R.ambushes) { const p = view.project(a.x, a.y, 1); if (off(p)) out.push({ p, cls: 'rd-amb', label: '!' }); }
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
    renderTool(); renderStation(); renderConvoy();
    if (trip) { tripT -= 0.12; if (tripT <= 0 || S.hero.dead || (S.hero.input.x || S.hero.input.y)) closeTrip(); }
    edgeArrows();
    if (S.over) { win.hidden = true; tool.hidden = true; tag.hidden = true; }
  }

  // ---------- the map: stations, the convoy, an ambush; tap a place to plan a trip there ----------
  function marks(ctx, ox, oy, s, big) {
    const dot = (x, y, r, col, ring, lw = 2) => { ctx.beginPath(); ctx.arc((x - ox) * s, (y - oy) * s, r, 0, 7); if (ring) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); } };
    for (const st of road.stations) {
      if (st.lit) { const g = ctx.createRadialGradient((st.x - ox) * s, (st.y - oy) * s, 0, (st.x - ox) * s, (st.y - oy) * s, (big ? 16 : 9)); g.addColorStop(0, 'rgba(255,190,100,.75)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc((st.x - ox) * s, (st.y - oy) * s, big ? 16 : 9, 0, 7); ctx.fill(); dot(st.x, st.y, big ? 5 : 3, '#ffcf80'); }
      else dot(st.x, st.y, big ? 5 : 3, st.fell ? '#8a7a6a' : '#ffcf80', true, big ? 2 : 1.5);
    }
    for (const q of road.members()) dot(q.x, q.y, big ? 3.5 : 2.2, '#ffd27a');
    for (const a of R.ambushes) dot(a.x, a.y, big ? 5 : 3, '#ff5a3a');
    if (big) {
      ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      for (const st of road.stations) { const t = st.name.replace(/^The /, ''), x = (st.x - ox) * s + 9, y = (st.y - oy) * s + 5; ctx.strokeText(t, x, y); ctx.fillStyle = st.lit ? '#ffcf80' : '#e9dcc6'; ctx.fillText(t, x, y); }
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
      box.innerHTML = `<div class="t">${tripHtml(t)}</div><button class="btn" data-go>Go</button>`;
      box.querySelector('[data-go]').onclick = () => { if (road.go(best.x, best.y)) { hideCard(); toast(`[Trip] On the way to ${best.name}. Touch the stick to take over.`, 'sys'); } };
      draw(info.path);
    };
  }
  function dispose() { if (canvas) { canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); } for (const e of els) e.remove(); }
  return { tick, marks, onMap, dispose, closeTrip };
}
