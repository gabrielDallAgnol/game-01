// The HUD: the System strip and Camp toasts (two voices), dawn and dusk banners, the night's losses line, the top
// bar (scrap, food, people, noise, forecast, sun dial), the ability button, the contract trip, edge arrows to the dead,
// and the auto quality watch.
import { $, DIR8, NUMW, ONE, PLURAL, campCopy, esc, mmss, store } from './shared.js';
import { HEAT } from '../sim/game.js';
import { MOBS } from '../content/mobs.js';
import { icon } from './icons.js';

export function createHud(ui) {
  const { callouts, ctoast, holdCards, strip, systemHere } = ui;

  // ---------- the System speaks; the Camp gets small toasts ----------
  const SUPPRESS = [/^Dusk\. Night \d+/, /^Something crawls out of the dark/, /destroyed\. It will be rebuilt at dawn/, /^A house fell\. Its family/, /^\[Tip:/, /^Tonight: /];
  const BEAT = /^\[(Title acquired|Skill acquired|Class acquired|Level up|Contract|Quest complete|Daily quest|Penalty quest|System online|Unique Monster|Naming|Trial)/;
  function toast(msg, kind) {
    msg = campCopy(msg);
    if (SUPPRESS.some(r => r.test(msg))) return;
    if (/^\[Title acquired: First Light\]/.test(msg) && ui.game && ui.game.state.night <= 2) return;   // the arrival window already stamped it
    const dawn = /^Dawn\. ([+-]?\d+) scrap.*?, \+(\d+) food\. Citizens ate (\d+)\./.exec(msg);
    if (dawn) { const line = `Dawn · **${+dawn[1] >= 0 ? '+' : '−'}${Math.abs(+dawn[1])}** scrap · **+${dawn[2]}** food · ate ${dawn[3]}`; ui.dawnLine = line; setTimeout(() => { if (!ui.ledgerUp) ctoast.show(line, 'good', 'sun'); }, 700); return; }
    const sys = /^\[[^\]]+\]/.exec(msg);
    if (sys && systemHere()) { strip.say(msg, kind === 'win' ? 'sys' : kind, BEAT.test(msg) || kind === 'win'); return; }
    ctoast.show(sys ? msg.replace(/^\[([^\]]+)\]\s*/, '$1. ') : msg, kind, kind === 'bad' ? 'skull' : null);
  }
  // the night's losses, grouped: one line at dawn ("3 towers and a farm fell on the east side")
  let losses = [];   // (ui.pendingLedger, ui.dawnLine, ui.ledgerUp: the dawn's ledger hand-off, see app.js)
  function noteLoss(id) { const b = ui.game.state.byId.get(id); if (!b || b.type === 'wall' && losses.filter(l => l.type === 'wall').length > 12) return; const a = Math.atan2(b.y - ui.game.map.town.y, b.x - ui.game.map.town.x); losses.push({ type: b.type, dir: DIR8[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8] }); }
  function lossLine() {
    if (!losses.length) return null;
    const by = {}; for (const l of losses) by[l.type] = (by[l.type] || 0) + 1;
    const parts = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([t, n]) => (n === 1 ? ONE[t] || `a ${t}` : `${NUMW[n] || n} ${PLURAL[t] || t + 's'}`));
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
    const sides = [...new Set(losses.map(l => l.dir))];
    const where = sides.length >= 3 ? 'all around the Camp' : sides.length === 2 ? `on the ${sides[0]} and ${sides[1]} sides` : `on the ${sides[0]} side`;
    const total = losses.length; losses = [];
    return `${list[0].toUpperCase()}${list.slice(1)} ${total === 1 ? 'fell' : 'fell'} ${where}.`;
  }

  // the episode eyecatch at dawn; the night's title at dusk
  function banner(html, cls = '', ms = 2600) {
    const el = $('#episode'); el.className = cls; el.innerHTML = html; el.hidden = false; el.style.setProperty('--dur', `${ms}ms`); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    clearTimeout(banner.t); banner.t = setTimeout(() => { el.hidden = true; }, ms);
  }
  function showEpisode(e) { banner(`<span class="ep">Season ${e.season} · Episode ${e.n}</span><b>${esc(e.title)}</b>`); holdCards(2.4); }
  let nightLine = '';
  function showDusk(e) {
    nightLine = e.line; callouts.hide();   // tips are for the day
    const blood = e.night % 5 === 0;
    banner(`<span class="ep">${blood ? 'Blood moon' : 'Dusk'}</span><b>Night ${e.night}</b><span class="ln">${esc(e.line.replace(/^Blood moon\. /, ''))}</span>`, `night${blood ? ' blood' : ''}`, 3400);
    if (systemHere()) strip.say(`[Night ${e.night}] ${e.line}`, blood ? 'bad' : 'sys');
  }
  // auto quality: if no choice was made, step down one level when frames are slow for a few seconds
  const perf = { t: 0, n: 0, slow: 0, wait: 3 };
  function watchFrames(raw) {
    if (!ui.view || ui.paused || document.hidden || store.get('quality', null) || new URLSearchParams(location.search).get('q')) return;
    if (ui.view.quality() === 'low' || raw > 250) return;
    if (perf.wait > 0) { perf.wait -= raw / 1000; return; }
    perf.t += raw; perf.n++;
    if (perf.t < 3000) return;
    const avg = perf.t / perf.n; perf.t = 0; perf.n = 0;
    perf.slow = avg > 34 ? perf.slow + 1 : 0;
    if (perf.slow >= 2) { const q = ui.view.quality() === 'high' ? 'medium' : 'low'; ui.view.setQuality(q); store.set('autoq', q); perf.slow = 0; perf.wait = 4; }
  }

  // ---------- ability ----------
  function useAbility() {
    if (!ui.game || ui.paused || $('#ability').hidden) return;
    const ok = ui.game.useAbility();
    if (ok && ui.game.heroDef.ability.id === 'hire') toast('Sellswords join you.', 'good');
  }
  $('#ability').onclick = useAbility;
  function renderAbility() {
    const A = ui.game.heroDef.ability, S = ui.game.state, el = $('#ability');
    if (!A || !systemHere()) { el.hidden = true; return; }
    el.hidden = false;
    const cd = S.ability.cd, cost = ui.game.abilityCost();
    el.querySelector('.an').textContent = A.name;
    el.querySelector('.ac').innerHTML = cd > 0 ? `${Math.ceil(cd)}s` : cost ? `${icon('scrap')}${cost}` : 'ready';
    el.classList.toggle('cool', cd > 0 || S.hero.dead || (cost && S.gold < cost));
    el.style.setProperty('--cd', cd > 0 ? (cd / A.cooldown) : 0);
  }

  // ---------- HUD ----------
  function dockH() { const db = $('#dock').getBoundingClientRect(); document.body.style.setProperty('--dockH', `${Math.max(64, innerHeight - db.top)}px`); }
  let lastKeep = 0, keepHitT = 0;
  function noiseNow() { const S = ui.game.state; return typeof ui.game.noise === 'function' && S.noise !== undefined ? +ui.game.noise() || S.noise : (S.noise ?? S.heat ?? 0); }
  function forecastText() {
    const S = ui.game.state;
    if (S.phase === 'night') {
      return `<span class="ic-w">${icon('moon')}</span><span>${esc(nightLine || `Night ${S.night}`)}</span>`;
    }
    let f = null;
    if (typeof ui.game.forecastStrip === 'function') { try { f = ui.game.forecastStrip(); } catch { f = null; } }
    const word = { safe: 'safe', risk: 'at risk', fall: 'may fall' };
    if (f && f.hall) {
      const bits = [`<span class="st ${f.hall}">Camp: ${word[f.hall] || f.hall}</span>`];
      if (f.atRisk) bits.push(`<span>~${f.atRisk} ${f.atRisk === 1 ? 'building' : 'buildings'} at risk</span>`);
      if (f.brutes) bits.push(`<span>${f.brutes} ${f.brutes === 1 ? 'brute' : 'brutes'}</span>`);
      if (f.crew && f.crew.silent) bits.push(`<span class="st fall">${f.crew.silent} ${f.crew.silent === 1 ? 'tower' : 'towers'} unmanned</span>`);
      else if (f.crew && f.crew.short) bits.push(`<span class="st risk">crew thin</span>`);
      return bits.join('<span class="sep">·</span>');
    }
    // without the honest forecast from the game: the threat rating and tonight's count
    const r = ui.game.ratingOf(ui.game.threatRatio()), hall = r === 'Impossible' ? 'fall' : r === 'Hard' ? 'risk' : 'safe';
    const dead = ui.view ? ui.view.routes().reduce((a, x) => a + x.count, 0) : 0, boss = ui.view ? ui.view.routes().some(x => x.boss) : false;
    return [`<span class="st ${hall}">Camp: ${word[hall]}</span>`, dead ? `<span>~${dead} dead tonight</span>` : '', boss ? '<span>a boss</span>' : ''].filter(Boolean).join('<span class="sep">·</span>');
  }
  function updateHud() {
    dockH();
    if (!ui.game) return;
    const S = ui.game.state, night = S.phase === 'night', bm = ui.game.isBloodMoon(S.night);
    // the System strip
    strip.update({ show: systemHere() && !S.over, hp: S.hero.hp, maxHp: S.hero.maxHp, lv: S.lvl, quest: ui.game.story().questLine() });
    // the Camp bar
    $('#nightNum').textContent = S.night;
    $('#dayIc').setAttribute('href', night ? '#i-moon' : '#i-sun');
    $('#dayPill').classList.toggle('night', night); $('#dayPill').classList.toggle('blood', bm);
    const kp = Math.max(0, S.keep.hp) / S.keep.maxHp;
    $('#keepFill').style.width = `${kp * 100}%`; $('#campHp').classList.toggle('hurt', kp < 0.7); $('#campHp').classList.toggle('low', kp < 0.35);
    if (S.keep.hp < lastKeep - 0.5) keepHitT = 2; lastKeep = S.keep.hp; keepHitT = Math.max(0, keepHitT - 0.2);
    $('#gold').textContent = S.gold; $('#food').textContent = S.food; $('#pop').textContent = ui.game.pop();
    $('#food').classList.toggle('warn', ui.game.foodPerDawn() + S.food < ui.game.foodNeed());
    { const cw = ui.game.crewing(); $('#pop').classList.toggle('warn', cw.need > cw.people); }
    const noiseShown = S.noise !== undefined || !!S.feat.heat, nz = noiseNow();
    $('#rNoise').hidden = !noiseShown; if (noiseShown) { $('#noiseFill').style.width = `${Math.min(100, nz)}%`; $('#rNoise').classList.toggle('hot', nz >= HEAT.erupt || !!S.eruption); }
    // tonight, honestly
    const fc = $('#forecast'); const fh = S.over ? '' : forecastText(); if (fc.dataset.h !== fh) { fc.dataset.h = fh; fc.innerHTML = fh; } fc.classList.toggle('night', night); fc.hidden = !fh || (!systemHere() && S.night === 1 && !night);
    // the Camp, when you are far from it
    { const d = Math.hypot(S.hero.x - ui.game.map.town.x, S.hero.y - ui.game.map.town.y), ca = $('#campAway'); ca.hidden = d <= 25 || S.over; if (!ca.hidden) { $('#campPct').textContent = `${Math.round(kp * 100)}%`; ca.classList.toggle('hit', keepHitT > 0); ca.classList.toggle('low', kp < 0.35); } }
    $('#blackout').hidden = !S.blackout; if (S.blackout && ui.game.powerIn) $('#boTxt').textContent = `${ui.game.powerOut()} needed · ${ui.game.powerIn()} made`;
    $('#buildBtn').style.visibility = S.over ? 'hidden' : '';
    // the thumb row's middle: the sun (or the moon), and how long you have
    if (S.over) $('#info').innerHTML = 'The window has closed';
    else {
      const loose = S.mobs.filter(m => !m.roam && !MOBS[m.kind].animal).length, hunting = S.mobs.filter(m => m.hunt && !MOBS[m.kind].animal).length;
      let mid;
      if (S.hero.dead) mid = `${icon('heart')}<span class="soon">Back in ${Math.ceil(S.hero.respawn)}s</span>`;
      else if (night) mid = `${sunDial(ui.game.nightFrac(), false, true)}${loose ? `<span><em>${loose}</em> coming</span>` : '<span>Hold</span>'}${hunting ? `<span><em class="hunt">${hunting}</em> on you</span>` : ''}`;
      else { const dusk = ui.game.duskIn(); mid = `${sunDial(ui.game.dayFrac(), dusk <= 15)}<span class="${dusk <= 15 ? 'soon' : ''}">Dusk ${mmss(dusk)}</span>${hunting ? `<span><em class="hunt">${hunting}</em> on you</span>` : ''}`; }
      if (S.eruption) mid = `<span class="erupt">Hive bursts ${Math.ceil(S.eruption.t)}s</span>${mid}`;
      $('#info').innerHTML = mid;
    }
    ui.renderTray(); renderAbility();
    const tb = $('.topbar').getBoundingClientRect(), db = $('#dock').getBoundingClientRect();
    edge.top = tb.bottom + 10; edge.bot = innerHeight - db.top + 92;   // clear of the map and the ability button
    callouts.place();
  }
  function sunDial(t, soon, moon = false) {
    const a = Math.PI * (1 - t), x = 22 + Math.cos(a) * 17, y = 19 - Math.sin(a) * 15;
    return `<span class="sundial${soon ? ' soon' : ''}${moon ? ' moon' : ''}"><svg viewBox="0 0 44 22" width="36" height="18" aria-hidden="true"><path d="M5 19 A17 15 0 0 1 39 19" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 2"/><line x1="2" y1="19.5" x2="42" y2="19.5" stroke="currentColor" stroke-opacity=".5"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" class="sun"/></svg></span>`;
  }
  // ---------- the contract's place: tap its arrow (or the strip while it has a place) to plan a trip there ----------
  let kTripEl = null;
  function contractTrip() {
    const K = ui.game && ui.game.story().contracts.stripLine(); if (!K || !K.place || !ui.game.road || !ui.game.road.tripInfo) return false;
    const x = K.place.x, y = K.place.y + 2.4, info = ui.game.road.tripInfo(x, y); if (!info) return false;
    if (!kTripEl) { kTripEl = document.createElement('div'); kTripEl.className = 'kTrip'; document.body.appendChild(kTripEl); }
    const cls = info.late ? 'late' : info.risky ? 'risky' : 'ok';
    kTripEl.innerHTML = `<div class="t"><b>${icon('flame')}Contract: burn ${esc(K.name)}</b><span><em class="${cls}">${esc(info.label)}</em>${info.late ? ' · <em class="late">back after dark</em>' : ''}</span></div><button class="btn sm" data-go>Go</button><button class="x" data-x aria-label="Close">${icon('close')}</button>`;
    kTripEl.hidden = false; ui.game.road.preview = { path: info.path };
    const close = () => { kTripEl.hidden = true; if (ui.game.road) ui.game.road.preview = null; clearTimeout(kTripEl._t); };
    kTripEl.querySelector('[data-go]').onclick = () => { if (ui.game.road.go(x, y)) { close(); toast(`[Trip] On the way to ${K.name}. Touch the stick to take over.`, 'sys'); } };
    kTripEl.querySelector('[data-x]').onclick = close; clearTimeout(kTripEl._t); kTripEl._t = setTimeout(close, 12000);
    return true;
  }
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('.ar.kontract'); if (a && ui.game && !ui.card) contractTrip(); });
  // ---------- edge arrows ----------
  const edge = { top: 60, bot: 100, pool: [], tags: [] };
  function edgeMarks() {
    const S = ui.game.state, Wd = innerWidth, Hh = innerHeight, m = 22, t = edge.top, bt = Hh - edge.bot, cx = Wd / 2, cy = (t + bt) / 2, buckets = new Map();
    for (const z of S.mobs) {
      if (z.roam || z.lure || MOBS[z.kind].animal) continue;
      if (Math.hypot(z.x - S.hero.x, z.y - S.hero.y) > 40 && Math.hypot(z.x - ui.game.map.town.x, z.y - ui.game.map.town.y) > 30) continue;
      const p = ui.view.project(z.x, z.y); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue;
      const ang = Math.atan2(p.y - cy, p.x - cx), key = Math.round(ang / (Math.PI / 16));
      const b = buckets.get(key) || { ang, n: 0, big: false }; b.n++; if (MOBS[z.kind].size >= 1.6) b.big = true; buckets.set(key, b);
    }
    let tagN = 0;
    if (S.phase === 'day') for (const r of ui.view.routes()) {
      const p = ui.view.project(r.x, r.y, 2.2);
      if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) {
        let el = edge.tags[tagN]; if (!el) { el = document.createElement('div'); el.className = 'nestTag'; $('#edge').appendChild(el); edge.tags[tagN] = el; }
        el.textContent = `${r.siege ? 'Siege · ' : ''}~${r.count}${r.boss ? ' + boss' : ''}`; el.classList.toggle('siege', r.siege);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`; el.hidden = false; tagN++;
      } else {
        const ang = Math.atan2(p.y - cy, p.x - cx), key = 1000 + Math.round(ang / (Math.PI / 16));
        const b = buckets.get(key) || { ang, n: 0, big: false, day: true }; b.n += r.count; if (r.siege || r.boss) b.big = true; buckets.set(key, b);
      }
    }
    for (const d of S.drops) { const p = ui.view.project(d.x, d.y, 1.5); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue; buckets.set(3000 + d.id, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: false, drop: true }); }
    // quests: only what the gate shows (one at a time early on), never the whole list
    for (const q of ui.game.story().shownQuests()) { const p = ui.view.project(q.x, q.y, 1.5); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue; buckets.set(q.key === 'trial' ? 6999 : q.spot ? 7000 + q.spot : 5000 + q.site, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: q.kind === 'trial', quest: true, label: q.label }); }
    { const K = ui.game.story().contracts.stripLine(); if (K && K.place) { const p = ui.view.project(K.place.x, K.place.y, 2); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8100, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, quest: true, contract: true, label: 'Contract' }); } }
    { const c = ui.game.map.city, h = S.hero; if (c && Math.hypot(c.x - h.x, c.y - h.y) > c.r + 6) { const p = ui.view.project(c.x, c.y, 1); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8000, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, place: true, label: 'City' }); } }
    { const tw = ui.game.map.town, h = S.hero; if (Math.hypot(tw.x - h.x, tw.y - h.y) > 24) { const p = ui.view.project(tw.x, tw.y, 1); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8001, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, place: true, label: 'Camp' }); } }
    for (let k = tagN; k < edge.tags.length; k++) edge.tags[k].hidden = true;
    let i = 0;
    for (const b of buckets.values()) {
      let el = edge.pool[i]; if (!el) { el = document.createElement('div'); el.className = 'ar'; el.innerHTML = '<i></i><span></span>'; $('#edge').appendChild(el); edge.pool[i] = el; }
      const c = Math.cos(b.ang), s = Math.sin(b.ang), hx = Wd / 2 - m, hy = Math.max(10, (bt - t) / 2 - m * 0.5), k = Math.min(Math.abs(hx / (c || 1e-6)), Math.abs(hy / (s || 1e-6)));
      el.style.transform = `translate(${cx + c * k}px, ${cy + s * k}px) rotate(${b.ang}rad)`;
      const sp = el.lastChild; sp.textContent = b.label ? b.label : b.quest ? 'Quest' : b.drop ? 'Drop' : b.day ? `~${b.n}` : b.n > 1 ? b.n : ''; sp.style.transform = `rotate(${-b.ang}rad)`;
      el.classList.toggle('big', b.big); el.classList.toggle('drop', !!b.drop); el.classList.toggle('quest', !!b.quest); el.classList.toggle('ploc', !!b.place); el.classList.toggle('kontract', !!b.contract); el.hidden = false; i++;
    }
    for (; i < edge.pool.length; i++) edge.pool[i].hidden = true;
    if (S.over) for (const el of [...edge.pool, ...edge.tags]) el.hidden = true;
  }
  return { toast, noteLoss, lossLine, showEpisode, showDusk, watchFrames, useAbility, dockH, updateHud, edgeMarks };
}
