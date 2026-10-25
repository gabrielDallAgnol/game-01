// The HUD: the System strip and Camp toasts (two voices), dawn and dusk banners, the night's losses line, the top
// bar (scrap, food, people, forecast, sun dial), edge arrows (the dead;
// MAIN objectives big and gold with their distance, OPTIONAL ones small and only when close),
// and the auto quality watch.
import { $, DIR8, NUMW, ONE, PLURAL, campCopy, esc, mmss, store } from './shared.js';
import { MOBS } from '../content/mobs.js';
import { icon } from './icons.js';
import { DUSK_TAGS, pickLine } from '../content/solar.js';

export function createHud(ui) {
  const { callouts, ctoast, holdCards, strip, systemHere } = ui;

  // ---------- the System speaks; the Camp gets small toasts ----------
  const SUPPRESS = [/^Dusk\. Night \d+/, /^Something crawls out of the dark/, /destroyed\. It will be rebuilt at dawn/, /^A house fell\. Its family/, /^\[Tip:/, /^Tonight: /];
  const BEAT = /^\[(The road is open|Title acquired|Skill acquired|Class acquired|Level up|Contract|Quest complete|Daily quest|Penalty quest|System online|Unique Monster|Naming|Trial)/;
  function toast(msg, kind) {
    msg = campCopy(msg);
    if (SUPPRESS.some(r => r.test(msg))) return;
    if (/^\[Title acquired: First Light\]/.test(msg) && ui.game && ui.game.state.night <= 2) return;   // the arrival window already stamped it
    const dawn = /^Dawn\. ([+-]?\d+) scrap.*?, \+(\d+) food\. Citizens ate (\d+)\./.exec(msg);
    if (dawn) { const line = `Since yesterday · **${+dawn[1] >= 0 ? '+' : '−'}${Math.abs(+dawn[1])}** scrap · **+${dawn[2]}** food · ate ${dawn[3]}`; ui.dawnLine = line; setTimeout(() => { if (!ui.ledgerUp) ctoast.show(line, 'good', 'sun'); }, 700); return; }
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
    const where = sides.length >= 3 ? 'all around the Haven' : sides.length === 2 ? `on the ${sides[0]} and ${sides[1]} sides` : `on the ${sides[0]} side`;
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
    banner(`<span class="ep">${blood ? 'Flare Night' : pickLine(DUSK_TAGS, e.night)}</span><b>Night ${e.night}</b><span class="ln">${esc(e.line.replace(/^Flare Night\. /, ''))}</span>`, `night${blood ? ' blood' : ''}`, 3400);
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

  // ---------- HUD ----------
  function dockH() { const db = $('#dock').getBoundingClientRect(); document.body.style.setProperty('--dockH', `${Math.max(64, innerHeight - db.top)}px`); }
  let lastKeep = 0, keepHitT = 0;
  // [towers] towers without their full crew do not shoot: say how many, and how many more people would man them all
  function silentLine() {
    const S = ui.game.state, cw = ui.game.crewing(), up = S.buildings.filter(b => b.type === 'tower' && !b.ruined).length, silent = up - cw.manned.size;
    if (silent <= 0) return '';
    const more = Math.max(1, cw.need - cw.people);
    return `<span class="st fall">${icon('people')} ${silent} ${silent === 1 ? 'tower' : 'towers'} silent: need ${more} more ${more === 1 ? 'person' : 'people'}</span>`;
  }
  function forecastText() {
    const S = ui.game.state;
    if (S.phase === 'night') {
      const sl = silentLine();   // [towers] silent towers stay on the strip all night
      return `<span class="ic-w">${icon('moon')}</span><span>${esc(nightLine || `Night ${S.night}`)}</span>${sl ? `<span class="sep">·</span>${sl}` : ''}`;
    }
    // by day: the horde that marches tonight (sim/hordes.js), its side and its size; the silent towers
    const f = ui.game.forecast(), t = ui.game.map.town, sl = silentLine(), bits = [];
    if (f.length) {
      const h = f[0], dir = DIR8[((Math.round(Math.atan2(h.y - t.y, h.x - t.x) / (Math.PI / 4)) % 8) + 8) % 8], n = f.reduce((a, x) => a + x.count, 0);
      bits.push(`<span class="st risk">A horde marches tonight</span>`, `<span class="from">From the ${dir}</span>`, `<span>~${n} Ash-Born</span>`);
    }
    if (sl) bits.push(sl);
    return bits.join('<span class="sep">·</span>');
  }
  function updateHud() {
    dockH();
    if (!ui.game) return;
    const S = ui.game.state, night = S.phase === 'night';
    // the System strip
    strip.update({ show: systemHere() && !S.over, hp: S.hero.hp, maxHp: S.hero.maxHp, lv: S.lvl, quest: ui.game.story().questLine() });
    // the Camp bar
    $('#nightNum').textContent = S.night;
    $('#dayIc').setAttribute('href', night ? '#i-moon' : '#i-sun');
    $('#dayPill').classList.toggle('night', night);
    const kp = Math.max(0, S.keep.hp) / S.keep.maxHp;
    $('#keepFill').style.width = `${kp * 100}%`; $('#campHp').classList.toggle('hurt', kp < 0.7); $('#campHp').classList.toggle('low', kp < 0.35);
    if (S.keep.hp < lastKeep - 0.5) keepHitT = 2; lastKeep = S.keep.hp; keepHitT = Math.max(0, keepHitT - 0.2);
    $('#gold').textContent = S.gold; $('#food').textContent = S.food; $('#pop').textContent = ui.game.pop();
    // [income] what comes in a second, right now (slower at night)
    if (ui.game.incomeRate) { const r = ui.game.incomeRate(), f = v => { const a = Math.abs(v); return Math.abs(v) < 0.005 ? '' : `${v > 0 ? '+' : '−'}${a < 0.1 ? a.toFixed(2) : a.toFixed(1)}/s`; };
      for (const [id, v] of [['#goldRt', r.gold], ['#foodRt', r.food]]) { const el = $(id), t = S.over ? '' : f(v); if (el.textContent !== t) el.textContent = t; el.classList.toggle('neg', v < 0); } }
    $('#food').classList.toggle('warn', ui.game.foodPerDawn() + S.food < ui.game.foodNeed());
    { const cw = ui.game.crewing(); $('#pop').classList.toggle('warn', cw.need > cw.people); }
    // tonight, honestly
    const fc = $('#forecast'); const fh = S.over ? '' : forecastText(); if (fc.dataset.h !== fh) { fc.dataset.h = fh; fc.innerHTML = fh; } fc.classList.toggle('night', night); fc.hidden = !fh || (!systemHere() && S.night === 1 && !night);
    // the Camp, when you are far from it
    { const d = Math.hypot(S.hero.x - ui.game.map.town.x, S.hero.y - ui.game.map.town.y), ca = $('#campAway'); ca.hidden = d <= 25 || S.over; if (!ca.hidden) { $('#campPct').textContent = `${Math.round(kp * 100)}%`; ca.classList.toggle('hit', keepHitT > 0); ca.classList.toggle('low', kp < 0.35); } }
    $('#buildBtn').style.visibility = S.over ? 'hidden' : '';
    // the thumb row's middle: the sun (or the moon), and how long you have
    if (S.over) $('#info').innerHTML = 'The window has closed';
    else {
      const loose = S.mobs.filter(m => !m.roam && !MOBS[m.kind].animal).length, hunting = S.mobs.filter(m => m.hunt && !MOBS[m.kind].animal).length;
      let mid;
      if (S.hero.dead) mid = `${icon('heart')}<span class="soon">Back in ${Math.ceil(S.hero.respawn)}s</span>`;
      else if (night) mid = `${sunDial(ui.game.nightFrac(), false, true)}${loose ? `<span><em>${loose}</em> coming</span>` : '<span>Hold</span>'}${hunting ? `<span><em class="hunt">${hunting}</em> on you</span>` : ''}`;
      else { const dusk = ui.game.duskIn(); mid = `${sunDial(ui.game.dayFrac(), dusk <= 15)}<span class="${dusk <= 15 ? 'soon' : ''}">Dusk ${mmss(dusk)}</span>${hunting ? `<span><em class="hunt">${hunting}</em> on you</span>` : ''}`; }
      $('#info').innerHTML = mid;
    }
    ui.renderTray();
    const tb = $('.topbar').getBoundingClientRect(), db = $('#dock').getBoundingClientRect();
    edge.top = tb.bottom + 10; edge.bot = innerHeight - db.top + 92;   // clear of the map and the dash button
    callouts.place();
  }
  function sunDial(t, soon, moon = false) {
    const a = Math.PI * (1 - t), x = 22 + Math.cos(a) * 17, y = 19 - Math.sin(a) * 15;
    return `<span class="sundial${soon ? ' soon' : ''}${moon ? ' moon' : ''}"><svg viewBox="0 0 44 22" width="36" height="18" aria-hidden="true"><path d="M5 19 A17 15 0 0 1 39 19" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 2"/><line x1="2" y1="19.5" x2="42" y2="19.5" stroke="currentColor" stroke-opacity=".5"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" class="sun"/></svg></span>`;
  }
  // ---------- edge arrows ----------
  const edge = { top: 60, bot: 100, pool: [], tags: [] }, EDGE_NEAR = 28;   // optional places get an arrow within this many metres
  function edgeMarks() {
    const S = ui.game.state, Wd = innerWidth, Hh = innerHeight, m = 22, t = edge.top, bt = Hh - edge.bot, cx = Wd / 2, cy = (t + bt) / 2, buckets = new Map();
    const mp = ui.game.map, MN = Math.sqrt(mp.terrain.length);
    for (const z of S.mobs) {
      if (z.roam || z.lure || MOBS[z.kind].animal) continue;
      if (Math.hypot(z.x - S.hero.x, z.y - S.hero.y) > 40 && Math.hypot(z.x - mp.town.x, z.y - mp.town.y) > 30) continue;
      { const zx = Math.floor(z.x), zy = Math.floor(z.y); if (zx < 0 || zy < 0 || zx >= MN || zy >= MN || (!mp.reach[zy * MN + zx] && !ui.game.inZone(z.x, z.y))) continue; }   // only the dead on ground you can reach: never an arrow into the void
      // a dead behind the camera (far down the screen, e.g. at the camp while you stand at the woods' edge) projects
      // mirrored: flip it, or its arrow points up into the dark
      const p = ui.view.project(z.x, z.y); if (!p.behind && p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue;
      let ang = Math.atan2(p.y - cy, p.x - cx); if (p.behind) ang += ang > 0 ? -Math.PI : Math.PI; const key = Math.round(ang / (Math.PI / 16));
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
    // objectives: MAIN (the System requires it) always gets a big gold arrow with its distance; OPTIONAL (beacons,
    // sites, drops) only a small quiet one, and only when it is close or selected
    { const sel = ui.selected, on = (p) => !p.behind && p.x > m && p.x < Wd - m && p.y > t && p.y < bt;
      for (const o of ui.game.story().objectives()) {
        if (o.x === undefined) continue;
        const main = o.priority === 'main';
        if (!main && o.dist > EDGE_NEAR && !(sel && sel.type === 'landmark' && o.site === sel.id)) continue;
        const p = ui.view.project(o.x, o.y, main ? 2 : 1.5); if (on(p)) continue;
        buckets.set(`o:${o.key}`, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, main, opt: !main, contract: o.kind === 'contract', label: o.label, dist: o.dist });
      } }
    { const tw = ui.game.map.town, h = S.hero; if (Math.hypot(tw.x - h.x, tw.y - h.y) > 24) { const p = ui.view.project(tw.x, tw.y, 1); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8001, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, place: true, label: 'Haven' }); } }
    for (let k = tagN; k < edge.tags.length; k++) edge.tags[k].hidden = true;
    let i = 0;
    const hx = Wd / 2 - m, hy = Math.max(10, (bt - t) / 2 - m * 0.5);
    for (const b of buckets.values()) { const c = Math.cos(b.ang), s = Math.sin(b.ang), k = Math.min(Math.abs(hx / (c || 1e-6)), Math.abs(hy / (s || 1e-6))); b.px = cx + c * k; b.py = cy + s * k; }
    // MAIN chips never stack on each other: slide a crowded one along the screen edge
    { const mains = [...buckets.values()].filter(b => b.main), side = b => (Math.abs(b.px - cx) > hx - 1 ? 'v' : 'h');
      for (let a = 1; a < mains.length; a++) for (let tries = 0; tries < 6; tries++) {
        const b = mains[a], hit = mains.slice(0, a).find(o => Math.hypot(o.px - b.px, o.py - b.py) < 56); if (!hit) break;
        if (side(b) === 'v') b.py = Math.min(bt - m, Math.max(t + m, b.py + (b.py >= hit.py ? 56 : -56) - (b.py - hit.py)));
        else b.px = Math.min(Wd - m, Math.max(m, b.px + (b.px >= hit.px ? 96 : -96) - (b.px - hit.px)));
      }
      // a small arrow next to a MAIN chip keeps its arrow but drops its words
      for (const b of buckets.values()) if (!b.main && mains.some(o => Math.hypot(o.px - b.px, o.py - b.py) < 64)) { b.label = ''; b.n = 0; b.day = false; } }
    for (const b of buckets.values()) {
      let el = edge.pool[i]; if (!el) { el = document.createElement('div'); el.className = 'ar'; el.innerHTML = '<i></i><span></span>'; $('#edge').appendChild(el); edge.pool[i] = el; }
      el.style.transform = `translate(${b.px}px, ${b.py}px) rotate(${b.ang}rad)`;
      const sp = el.lastChild, txt = b.main ? `<b>Main</b><em>${esc(b.label)} ${b.dist}m</em>` : esc(b.label ? b.label : b.day ? `~${b.n}` : b.n > 1 ? b.n : '');
      if (sp.dataset.h !== txt) { sp.dataset.h = txt; sp.innerHTML = txt; } sp.style.transform = `rotate(${-b.ang}rad)`;
      el.classList.toggle('big', b.big); el.classList.toggle('main', !!b.main); el.classList.toggle('opt', !!b.opt); el.classList.toggle('ploc', !!b.place); el.classList.toggle('kontract', !!b.contract);
      el.setAttribute('aria-label', b.main ? `Main objective: ${b.label}, ${b.dist} metres` : ''); el.hidden = false; i++;
    }
    for (; i < edge.pool.length; i++) edge.pool[i].hidden = true;
    if (S.over) for (const el of [...edge.pool, ...edge.tags]) el.hidden = true;
  }
  return { toast, noteLoss, lossLine, showEpisode, showDusk, watchFrames, dockH, updateHud, edgeMarks };
}
