// Screens, HUD, panels and input. Talks to the game only through its public API.
import { createGame, STEP } from '../sim/game.js';
import { mapChoices, generateMap, N, T, idx, BIOMES } from '../sim/mapgen.js';
import { createView } from '../render/view.js';
import { BUILDINGS, BUILD_ORDER, KEEP, MAX_LEVEL } from '../content/buildings.js';
import { HEROES, HERO_ORDER } from '../content/heroes.js';
import { PERKS, FAMILIES } from '../content/perks.js';
import { MOBS, WAVES } from '../content/mobs.js';
import { regionNames } from '../content/names.js';

const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('hollowmere.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hollowmere.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const RINGS = ['Town', 'Near lands', 'Far lands'];

export function startApp() {
  let game = null, view = null, names = [], selected = null, hoverSlot = null, paused = true, acc = 0, last = performance.now(), hudT = 0;
  const keys = {};
  let setup = { hero: store.get('hero', 'warrior'), runSeed: Math.floor(Math.random() * 1e6), pick: 0 };

  // ---------- start screen ----------
  function drawMinimap(canvas, m) {
    const ctx = canvas.getContext('2d'), s = 4; canvas.width = canvas.height = N * s;
    const col = { [T.GRASS]: '#6c8a4b', [T.FOREST]: '#3f6b3a', [T.ROCK]: '#7d7f74', [T.WATER]: '#3d6f8a', [T.CLIFF]: '#8a8072', [T.FORD]: '#6a8f9a', [T.DIRT]: '#8a7350', [T.VOID]: '#1f2b1f' };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y), r = m.region[i];
      ctx.fillStyle = col[m.terrain[i]]; ctx.fillRect(x * s, y * s, s, s);
      if (r > 0) { ctx.fillStyle = 'rgba(18,26,27,.35)'; ctx.fillRect(x * s, y * s, s, s); }
    }
    ctx.fillStyle = '#a8d65c';
    for (const r of m.regions) if (r.nest) { ctx.beginPath(); ctx.arc(r.nest.x * s, r.nest.y * s, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#eaa441'; ctx.beginPath(); ctx.arc(m.town.x * s, m.town.y * s, 7, 0, 7); ctx.fill();
  }
  function showStart() {
    paused = true; $('#hud').hidden = true;
    const opts = mapChoices(setup.runSeed);
    const best = store.get('best', 0);
    showCard(`<div class="eyebrow">Endless nights${best ? ` · your best: night ${best}` : ''}</div>
      <h1>Hold Hollowmere</h1>
      <p>Build by day. Hold the keep by night. Burn the nests around you to claim more land, and see how many nights you last.</p>
      <h2>Your hero</h2>
      <div class="choices">${HERO_ORDER.map(h => `<button class="choice" data-hero="${h}" aria-pressed="${setup.hero === h}"><b>${HEROES[h].name}</b><span>${HEROES[h].blurb}</span></button>`).join('')}</div>
      <h2>Your land</h2>
      <div class="choices">${opts.map((o, k) => `<button class="choice" data-map="${k}" aria-pressed="${setup.pick === k}"><canvas id="mm${k}" aria-hidden="true"></canvas><b>${o.name}</b><span>${BIOMES[o.biome].blurb}</span><span class="tiny">Seed ${o.seed}</span></button>`).join('')}</div>
      <div class="seedrow"><button class="btn ghost" id="reroll">Show other lands</button></div>
      <div class="cardrow" style="margin-top:16px"><button class="btn big" id="begin">Raise the town</button><span class="tiny">WASD or tap to walk · scroll or pinch to zoom</span></div>`, true);
    opts.forEach((o, k) => drawMinimap($(`#mm${k}`), generateMap(o.seed, o.biome)));
    document.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => { setup.hero = b.dataset.hero; store.set('hero', setup.hero); document.querySelectorAll('[data-hero]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    document.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { setup.pick = +b.dataset.map; document.querySelectorAll('[data-map]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#reroll').onclick = () => { setup.runSeed = Math.floor(Math.random() * 1e6); setup.pick = 0; showStart(); };
    $('#begin').onclick = () => { const o = opts[setup.pick]; begin(o.seed, o.biome); };
  }

  function begin(mapSeed, biome) {
    game = createGame({ seed: setup.runSeed, mapSeed, biome, hero: setup.hero });
    names = regionNames(mapSeed, game.map.regions.length);
    if (!view) view = createView($('#view'), game); else { location.hash = ''; }
    window.__game = game;
    $('#hud').hidden = false; hideCard(); paused = false; selected = null; closePanel();
    toast(`Day 1 in ${game.map.name}. You have 12 gold. A tower and a house is a good start.`);
    offerPerks();
  }

  // ---------- cards ----------
  function showCard(html, wide) { const c = $('#card'); c.innerHTML = html; c.classList.toggle('wide', !!wide); $('#overlay').hidden = false; }
  function hideCard() { $('#overlay').hidden = true; }
  function offerPerks() {
    const S = game.state;
    if (S.pendingPicks <= 0 || !S.offer.length) { if (!S.over) { hideCard(); paused = false; } return; }
    paused = true;
    const pips = f => [0, 1, 2].map(i => `<i class="${i < S.P.fam[f] ? 'on' : ''}"></i>`).join('');
    const build = Object.keys(FAMILIES).filter(f => S.P.fam[f]).map(f => `${FAMILIES[f].name} ${Math.min(S.P.fam[f], 3)}/3${S.P.fam[f] >= 3 ? ' ★' : ''}`).join(' · ');
    showCard(`<div class="eyebrow">Choose a blessing${S.pendingPicks > 1 ? ` · ${S.pendingPicks} to pick` : ''}</div><h1 class="sm">The town remembers</h1>
      <div class="perks">${S.offer.map(id => { const p = PERKS.find(q => q.id === id), F = FAMILIES[p.fam];
        return `<button class="perk" data-perk="${id}" style="--fam:${F.color}"><span class="pf">${F.name}<span class="pips">${pips(p.fam)}</span></span><b>${p.name}${p.max > 1 ? ` <span class="lv">${(S.P.taken[id] || 0) + 1}/${p.max}</span>` : ''}</b><span class="pd">${p.desc}</span></button>`; }).join('')}</div>
      <p class="tiny">${build ? 'Your build: ' + build : 'Take three blessings of one kind to unlock its mastery.'}</p>`);
    document.querySelectorAll('[data-perk]').forEach(b => b.onclick = () => { game.choosePerk(b.dataset.perk); offerPerks(); });
  }
  const logRows = () => game.logRows();
  function logTable() {
    const rows = logRows(); if (!rows.length) return '<p class="tiny">No nights played yet.</p>';
    const pk = id => (PERKS.find(p => p.id === id) || { name: id }).name;
    return `<div class="logwrap"><table class="log"><thead><tr><th>Night</th><th>Keep left</th><th>Threat</th><th>Wave HP</th><th>Tower DPS</th><th>Kills hero·tower·keep</th><th>Lost</th><th>Gold in / spent</th><th>Siege</th><th>Blessings</th></tr></thead><tbody>${rows.map(l => {
      const kp = l.keepEnd !== undefined ? Math.round(l.keepEnd / l.keepMax * 100) : null;
      return `<tr><td>${l.night}${l.bloodMoon ? ' ☾' : ''}</td><td class="${kp !== null && kp < 50 ? 'bad' : ''}">${kp !== null ? kp + '%' : 'now'}</td><td>${l.ratio ?? '–'}</td><td>${l.waveHp}</td><td>${l.defDps}</td>
      <td>${l.kills.hero || 0} · ${l.kills.tower || 0} · ${l.kills.keep || 0}</td><td class="${l.lost.length > 3 ? 'bad' : ''}">${l.lost.length}${l.risen ? ` (${l.risen} rose)` : ''}</td><td>+${l.goldIn ?? 0} / ${l.spent}</td>
      <td>${l.purge !== null && l.purge !== undefined ? names[l.purge] : '–'}</td><td>${l.perks.map(pk).join(', ') || '–'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function copyLog(btn) {
    const S = game.state;
    const data = JSON.stringify({ game: 'Hold Hollowmere', build: 'world-1', hero: S.heroClass, map: { biome: S.biome, seed: game.map.seed }, runSeed: S.seed, blessings: S.P.taken, claimed: [...S.claimed], log: logRows() });
    const ta = $('#logJson');
    const fallback = () => { ta.hidden = false; ta.value = data; ta.focus(); ta.select(); btn.textContent = 'Copy the text below'; };
    try { navigator.clipboard.writeText(data).then(() => { btn.textContent = 'Copied'; }, fallback); } catch { fallback(); }
  }
  const logButtons = close => `<div class="cardrow"><button class="btn" id="logCopy">Copy log</button>${close}</div><textarea id="logJson" hidden readonly aria-label="Run log data"></textarea>`;
  function showLog() {
    if (!game || paused) return;
    paused = true; closePanel();
    showCard(`<div class="eyebrow">Run log · night ${game.state.night}</div><h1 class="sm">The town ledger</h1>${logTable()}${logButtons('<button class="btn ghost" id="logClose">Back to town</button>')}`, true);
    $('#logCopy').onclick = e => copyLog(e.currentTarget);
    $('#logClose').onclick = () => { hideCard(); paused = false; };
  }
  function gameOver() {
    const S = game.state, reached = S.night, best = Math.max(store.get('best', 0), reached);
    store.set('best', best);
    paused = true;
    showCard(`<div class="eyebrow">The keep fell on night ${reached}</div><h1>Hollowmere is lost</h1>
      <p>You held ${reached - 1} ${reached - 1 === 1 ? 'night' : 'nights'}, claimed ${S.claimed.size - 1} ${S.claimed.size - 1 === 1 ? 'region' : 'regions'} and put ${S.kills} dead back in the ground.${reached >= best ? ' That is your best run.' : ` Your best is night ${best}.`}</p>
      ${logTable()}${logButtons('<button class="btn ghost" id="again">New run</button>')}`, true);
    $('#logCopy').onclick = e => copyLog(e.currentTarget);
    $('#again').onclick = () => { location.reload(); };
  }

  // ---------- toasts ----------
  function toast(msg, kind) {
    const el = document.createElement('div'); el.className = 'toast' + (kind ? ' ' + kind : ''); el.textContent = msg;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 3800);
  }

  // ---------- panels ----------
  let lastSig = '';
  function panelSig() {
    const S = game.state, b = selected && selected.type === 'slot' ? S.byId.get(S.slotB[selected.id]) : selected && selected.type === 'keep' ? S.keep : null;
    return [S.gold, S.phase, S.purge, selected && selected.type, selected && selected.id, b ? `${b.level}:${Math.ceil(b.hp)}:${b.maxHp}` : ''].join('|');
  }
  function openSel(sel) { selected = sel; renderPanel(); lastSig = panelSig(); $('#panel').hidden = false; }
  function closePanel() { selected = null; $('#panel').hidden = true; }
  function renderPanel() {
    if (!selected || !game) return;
    const S = game.state, body = $('#pBody');
    const opt = (id, data, name, cost, ds, disabled) => `<button class="opt" id="${id}" ${data} ${disabled ? 'disabled' : ''}><span class="nm">${name}${cost !== null ? `<span class="cost"><span class="dot gold"></span>${cost}</span>` : ''}</span><span class="ds">${ds}</span></button>`;
    if (selected.type === 'keep') {
      const k = S.keep, l = k.level;
      $('#pEyebrow').textContent = 'Town centre'; $('#pTitle').textContent = `Keep · level ${l}`;
      body.innerHTML = `<div class="stat"><span>Health <b>${Math.ceil(k.hp)} / ${k.maxHp}</b></span><span>${KEEP.desc[l - 1]}</span></div>` +
        (l < 3 ? `<div class="opts one">${opt('opt-keep', 'data-keep="1"', 'Raise the keep', KEEP.cost[l], KEEP.desc[l], S.gold < KEEP.cost[l] || S.phase !== 'day')}</div>` : '<div class="tiny">The keep is at its full height.</div>');
      selected.range = KEEP.range[l - 1] + S.P.towerRange;
      return;
    }
    if (selected.type === 'region') {
      const info = game.regionInfo(selected.id), reg = game.map.regions[selected.id];
      $('#pEyebrow').textContent = `${RINGS[Math.min(2, reg.ring)]} · ${info.nest ? (info.active ? 'nest awake' : 'nest asleep') : 'no nest'}`;
      $('#pTitle').textContent = names[selected.id];
      const land = [`${info.slots} build slots`, info.forest > 40 ? 'deep forest' : info.forest > 15 ? 'woods' : 'open fields', info.water ? 'water' : null].filter(Boolean).join(' · ');
      let html = `<div class="stat"><span>${land}</span>${info.wakes ? `<span>Wakes <b>${info.wakes}</b> more ${info.wakes === 1 ? 'nest' : 'nests'} beyond it</span>` : ''}</div>`;
      if (S.purge === selected.id) html += `<div class="opts one">${opt('opt-cancel', 'data-cancel="1"', 'Call off the march', null, 'Tonight will be a normal night.', S.phase !== 'day')}</div>`;
      else if (info.canPurge) {
        html += `<div class="stat"><span>Siege tonight would be <span class="rating ${info.rating}">${info.rating}</span></span><span>Your defences against this nest's last stand</span></div>`;
        html += `<div class="opts one">${opt('opt-purge', 'data-purge="1"', 'March on this nest tonight', null, 'Its dead come in force at the end of the night. Survive and the land is yours.', false)}</div>`;
      } else html += `<div class="tiny">${info.nest ? 'Claim the land between you and this nest first.' : 'Nothing to burn here.'}</div>`;
      body.innerHTML = html;
      return;
    }
    const s = game.map.slots[selected.id], b = S.byId.get(S.slotB[selected.id]);
    $('#pEyebrow').textContent = names[s.region] + (s.nearWater ? ' · by the water' : '');
    if (!b) {
      $('#pTitle').textContent = 'Build';
      body.innerHTML = `<div class="opts">${BUILD_ORDER.map(t => opt(`opt-${t}`, `data-build="${t}"`, BUILDINGS[t].name, game.costOf(t), BUILDINGS[t].desc[0] + (t === 'farm' && s.nearWater ? ' (+1 by water)' : ''), S.gold < game.costOf(t) || S.phase !== 'day')).join('')}</div>`;
      selected.range = null;
    } else {
      const B = BUILDINGS[b.type];
      $('#pTitle').textContent = `${B.name} · level ${b.level}`;
      let html = `<div class="stat"><span>Health <b>${Math.ceil(b.hp)} / ${b.maxHp}</b></span><span>${B.desc[b.level - 1]}</span></div>`;
      if (b.level < MAX_LEVEL) { const c = game.costOf(b.type, b.level + 1); html += `<div class="opts one">${opt('opt-up', 'data-up="1"', `Upgrade to level ${b.level + 1}`, c, `${B.desc[b.level]} · ${game.maxHpOf(b.type, b.level + 1)} hp`, S.gold < c || S.phase !== 'day')}</div>`; }
      else html += '<div class="tiny">Fully upgraded.</div>';
      body.innerHTML = html;
      selected.range = b.type === 'tower' ? B.range[b.level - 1] + S.P.towerRange : null;
    }
  }
  $('#pBody').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn || btn.disabled || !selected) return;
    if (btn.dataset.keep && game.upgradeKeep()) toast('The keep rises higher.');
    if (btn.dataset.build && game.build(selected.id, btn.dataset.build)) toast(`${BUILDINGS[btn.dataset.build].name} built.`);
    if (btn.dataset.up && game.upgrade(selected.id)) toast('Upgraded.');
    if (btn.dataset.purge && game.planPurge(selected.id)) toast(`At nightfall you march on ${names[selected.id]}.`, 'good');
    if (btn.dataset.cancel) game.planPurge(null);
    renderPanel(); updateHud();
  });
  $('#pClose').onclick = closePanel;
  $('#bell').onclick = () => { if (game && !paused && game.startNight()) closePanel(); };
  $('#logBtn').onclick = showLog;
  $('#zIn').onclick = () => view && view.setZoom(view.getZoom() * 0.8);
  $('#zOut').onclick = () => view && view.setZoom(view.getZoom() * 1.25);

  // ---------- HUD ----------
  function updateHud() {
    if (!game) return;
    const S = game.state, night = S.phase === 'night', bm = game.isBloodMoon(S.night);
    $('#phaseLbl').textContent = night ? 'Night' : 'Day';
    $('#nightNum').textContent = S.night;
    $('#moon').hidden = !bm;
    $('#keepFill').style.width = (Math.max(0, S.keep.hp) / S.keep.maxHp * 100) + '%';
    $('#keepTxt').textContent = Math.max(0, Math.ceil(S.keep.hp));
    $('#resPill').hidden = night;
    $('#gold').textContent = S.gold; $('#goldNote').textContent = `+${game.goldPerDawn()}`;
    $('#food').textContent = S.food; $('#foodNote').textContent = `+${game.foodPerDawn()} −${Math.ceil(game.pop() / 2)}`;
    $('#pop').textContent = game.pop();
    const bell = $('#bell');
    if (night) {
      bell.hidden = true;
      const left = S.queue.length + S.mobs.length;
      $('#info').innerHTML = `<em>${left}</em> dead left${S.hero.dead ? ` · you return in ${Math.ceil(S.hero.respawn)}s` : ''}`;
    } else {
      bell.hidden = false; bell.textContent = bm ? 'Face the blood moon' : 'Ring the bell';
      const nests = game.activeNests().length, ratio = game.threatRatio();
      $('#info').innerHTML = `Night ${S.night}: <em>${nests}</em> ${nests === 1 ? 'nest' : 'nests'} awake · <span class="rating ${game.ratingOf(ratio)}">${game.ratingOf(ratio)}</span>${S.purge !== null ? ` · <span class="siege">siege at ${names[S.purge]}</span>` : ''}`;
    }
    const tb = $('.top').getBoundingClientRect(), db = $('#dock').getBoundingClientRect();
    edge.top = tb.bottom + 10; edge.bot = innerHeight - db.top + 10;
  }

  // ---------- edge arrows ----------
  const edge = { top: 60, bot: 100, pool: [] };
  function edgeMarks() {
    const S = game.state, Wd = innerWidth, Hh = innerHeight, m = 22, t = edge.top, bt = Hh - edge.bot, cx = Wd / 2, cy = (t + bt) / 2, buckets = new Map();
    if (S.phase === 'night') for (const z of S.mobs) {
      const p = view.project(z.x, z.y); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue;
      const ang = Math.atan2(p.y - cy, p.x - cx), key = Math.round(ang / (Math.PI / 16));
      const b = buckets.get(key) || { ang, n: 0, big: false }; b.n++; if (MOBS[z.kind].size >= 1.6) b.big = true; buckets.set(key, b);
    }
    let i = 0;
    for (const b of buckets.values()) {
      let el = edge.pool[i]; if (!el) { el = document.createElement('div'); el.className = 'ar'; el.innerHTML = '<i></i><span></span>'; $('#edge').appendChild(el); edge.pool[i] = el; }
      const c = Math.cos(b.ang), s = Math.sin(b.ang), hx = Wd / 2 - m, hy = Math.max(10, (bt - t) / 2 - m * 0.5), k = Math.min(Math.abs(hx / (c || 1e-6)), Math.abs(hy / (s || 1e-6)));
      el.style.transform = `translate(${cx + c * k}px, ${cy + s * k}px) rotate(${b.ang}rad)`;
      const sp = el.lastChild; sp.textContent = b.n > 1 ? b.n : ''; sp.style.transform = `rotate(${-b.ang}rad)`;
      el.classList.toggle('big', b.big); el.hidden = false; i++;
    }
    for (; i < edge.pool.length; i++) edge.pool[i].hidden = true;
  }

  // ---------- input ----------
  const canvas = $('#view'); let down = null; const touches = new Map(); let pinch0 = 0, zoom0 = 1;
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (view) view.setZoom(view.getZoom() * (1 + e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && view) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.getZoom(); down = null; return; }
    down = { x: e.clientX, y: e.clientY }; canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointercancel', e => touches.delete(e.pointerId));
  canvas.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2 && pinch0 && view) { const [a, b] = [...touches.values()]; view.setZoom(zoom0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))); } }
    if (e.pointerType === 'mouse' && view && game && game.state.phase === 'day') { const p = view.pick(e.clientX, e.clientY); hoverSlot = p && p.type === 'slot' ? p.id : null; canvas.style.cursor = p && p.type !== 'ground' ? 'pointer' : ''; }
  });
  canvas.addEventListener('pointerup', e => {
    const wasPinch = touches.size >= 2; touches.delete(e.pointerId); if (touches.size < 2) pinch0 = 0;
    if (!down || wasPinch || paused || !game) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 10) return;
    const p = view.pick(e.clientX, e.clientY); if (!p) return;
    const S = game.state;
    if (S.phase === 'day' && (p.type === 'slot' || p.type === 'keep')) { openSel(p.type === 'slot' ? { type: 'slot', id: p.id } : { type: 'keep' }); return; }
    if (S.phase === 'day' && p.type === 'region' && game.map.regions[p.id].nest && game.regionInfo(p.id).nest) {
      const n = game.map.regions[p.id].nest;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 4 || !(selected && selected.type === 'region')) { openSel({ type: 'region', id: p.id }); return; }
    }
    game.heroTo(p.x, p.y); view.showMove(p.x, p.y); if (selected) closePanel();
  });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') closePanel();
    if (e.target.closest && e.target.closest('button') && (k === ' ' || k === 'enter')) return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = true; e.preventDefault(); }
    if (k === 'n' && game && !paused && game.startNight()) closePanel();
    if (k === 'l') showLog();
    if ((k === '=' || k === '+') && view) view.setZoom(view.getZoom() * 0.8);
    if ((k === '-' || k === '_') && view) view.setZoom(view.getZoom() * 1.25);
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ---------- loop ----------
  const toastFor = new Set(['toast', 'fail']);
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!game || !view) return;
    const S = game.state;
    game.setHeroInput((keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0));
    if (!paused) { acc += dt; while (acc >= STEP && !paused) { game.step(STEP); acc -= STEP; if (S.pendingPicks > 0 && S.phase === 'day') { offerPerks(); } if (S.over) { gameOver(); } } }
    else acc = 0;
    const events = game.drainEvents();
    for (const e of events) { if (toastFor.has(e.t)) toast(e.msg, e.t === 'fail' ? 'bad' : e.kind); if (e.t === 'claim' && selected && selected.type === 'region') closePanel(); }
    view.frame(dt, { events, selected, hoverSlot });
    edgeMarks();
    hudT -= dt; if (hudT <= 0) { updateHud(); hudT = 0.2; if (selected && !paused) { const sig = panelSig(); if (sig !== lastSig) { lastSig = sig; renderPanel(); } } }
  }
  requestAnimationFrame(frame);
  showStart();
}
