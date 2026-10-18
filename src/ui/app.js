// Screens, HUD, panels and input. Talks to the game only through its public API.
import { createGame, STEP, CREW_NEED } from '../sim/game.js';
import { mapChoices, generateMap, N, T, idx, BIOMES } from '../sim/mapgen.js';
import { createView } from '../render/view.js';
import { BUILDINGS, BUILD_ORDER, KEEP, MAX_LEVEL } from '../content/buildings.js';
import { HEROES, HERO_ORDER, TRADES } from '../content/heroes.js';
import { PERKS, FAMILIES, SYNERGIES, MASTERIES } from '../content/perks.js';
import { PACKS } from '../content/packs.js';
import { MOBS } from '../content/mobs.js';
import { regionNames } from '../content/names.js';
import { TRAITS, TREAT, RUN } from '../content/scavenge.js';
import { createAudio } from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('hollowmere.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hollowmere.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const audio = createAudio(store);
for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, () => audio.unlock(), { capture: true });
const RINGS = ['Town', 'Near lands', 'Far lands'];
const ARM_MS = 700;          // cards ignore taps this long after they appear
const DAWN_DELAY = 1.2;      // seconds between the last kill and the first card
const JOY_PX = 14;           // a touch that moves further than this is a joystick drag, not a tap
const SHORT = { house: 'Home', farm: 'Farm', tower: 'Tower', wall: 'Barricade' };
const PLURAL = { house: 'Homes', farm: 'Farms', tower: 'Towers', wall: 'barricade posts' };

export function startApp() {
  let game = null, view = null, names = [], selected = null, placing = null, paused = true, acc = 0, last = performance.now(), hudT = 0;
  let card = null;             // which card is open: 'start' | 'perk' | 'pack' | 'trade' | 'log' | 'end'
  let dawnT = 0, traderSeen = false, endT = -1;
  const keys = {};
  let setup = { hero: store.get('hero', 'warrior'), mode: store.get('mode', 'packs'), runSeed: Math.floor(Math.random() * 1e6), pick: 0 };
  if (setup.hero === 'steward') setup.hero = 'merchant';

  // ---------- start screen ----------
  function drawMinimap(canvas, m) {
    const ctx = canvas.getContext('2d'), s = 4; canvas.width = canvas.height = N * s;
    const col = { [T.GRASS]: '#3d3c39', [T.FOREST]: '#55524b', [T.ROCK]: '#a39d90', [T.WATER]: '#2c4a52', [T.CLIFF]: '#77726a', [T.FORD]: '#8d887d', [T.DIRT]: '#6b675f', [T.VOID]: '#161615' };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y), r = m.region[i];
      ctx.fillStyle = col[m.terrain[i]]; ctx.fillRect(x * s, y * s, s, s);
      if (r > 0) { ctx.fillStyle = 'rgba(18,26,27,.35)'; ctx.fillRect(x * s, y * s, s, s); }
    }
    ctx.fillStyle = '#b4ff4e';
    for (const r of m.regions) if (r.nest) { ctx.beginPath(); ctx.arc(r.nest.x * s, r.nest.y * s, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#d9843a'; ctx.beginPath(); ctx.arc(m.town.x * s, m.town.y * s, 7, 0, 7); ctx.fill();
  }
  function showStart() {
    paused = true; $('#hud').hidden = true;
    const opts = mapChoices(setup.runSeed);
    const best = store.get('best', 0);
    showCard('start', `<div class="eyebrow">Endless nights${best ? ` · your best: night ${best}` : ''}</div>
      <h1>Hold Hollowmere</h1>
      <p>Build by day. Hold the keep by night. Clear the hives around you to claim more of the city, and see how many nights you last.</p>
      <p class="tiny">By day: tap a glowing cache to send survivors scavenging · tap rubble on your land to clear room · watch the forecast for fog and storms.</p>
      <h2>Your hero</h2>
      <div class="choices">${HERO_ORDER.map(h => `<button class="choice" data-hero="${h}" aria-pressed="${setup.hero === h}"><b>${HEROES[h].name}</b><span>${HEROES[h].blurb}</span><span class="tiny">Ability: ${HEROES[h].ability.name}</span></button>`).join('')}</div>
      <h2>How you build</h2>
      <div class="choices">
        <button class="choice" data-mode="packs" aria-pressed="${setup.mode === 'packs'}"><b>Packs</b><span>Each dawn, choose one of two packs of buildings and place them for free. Extra buildings cost double gold.</span></button>
        <button class="choice" data-mode="classic" aria-pressed="${setup.mode === 'classic'}"><b>Classic</b><span>Buy any building with gold, whenever you like.</span></button>
      </div>
      <h2>Your land</h2>
      <div class="choices">${opts.map((o, k) => `<button class="choice" data-map="${k}" aria-pressed="${setup.pick === k}"><canvas id="mm${k}" aria-hidden="true"></canvas><b>${o.name}</b><span>${BIOMES[o.biome].blurb}</span><span class="tiny">Seed ${o.seed}</span></button>`).join('')}</div>
      <div class="seedrow"><button class="btn ghost" id="reroll">Show other lands</button></div>
      <div class="cardrow" style="margin-top:16px"><button class="btn big" id="begin">Raise the town</button><span class="tiny">WASD or drag to walk · scroll or pinch to zoom</span></div>`, true, false);
    opts.forEach((o, k) => drawMinimap($(`#mm${k}`), generateMap(o.seed, o.biome)));
    const press = (sel, b) => $$(sel).forEach(x => x.setAttribute('aria-pressed', x === b));
    $$('[data-hero]').forEach(b => b.onclick = () => { setup.hero = b.dataset.hero; store.set('hero', setup.hero); press('[data-hero]', b); });
    $$('[data-mode]').forEach(b => b.onclick = () => { setup.mode = b.dataset.mode; store.set('mode', setup.mode); press('[data-mode]', b); });
    $$('[data-map]').forEach(b => b.onclick = () => { setup.pick = +b.dataset.map; press('[data-map]', b); });
    $('#reroll').onclick = () => { setup.runSeed = Math.floor(Math.random() * 1e6); setup.pick = 0; showStart(); };
    $('#begin').onclick = () => { const o = opts[setup.pick]; begin(o.seed, o.biome); };
  }

  function begin(mapSeed, biome) {
    game = createGame({ seed: setup.runSeed, mapSeed, biome, hero: setup.hero, mode: setup.mode });
    names = regionNames(mapSeed, game.map.regions.length);
    const qp = new URLSearchParams(location.search).get('q');
    if (!view) { view = createView($('#view'), game, { onFlash: () => audio.play('thunder'), quality: qp || store.get('quality', null) || store.get('autoq', null) || undefined }); showQuality(); }
    window.__game = game; window.__openSel = sel => openSel(sel);
    $('#hud').hidden = false; hideCard(); paused = false; selected = null; placing = null; closePanel();
    $('#ability').hidden = !game.heroDef.ability;
    toast(setup.mode === 'packs' ? `Day 1 in ${game.map.name}. Pick a pack, then place your buildings.` : `Day 1 in ${game.map.name}. You have ${game.state.gold} gold. A tower and a house is a good start.`);
    traderSeen = true; dawnT = 0.3;
  }

  // ---------- cards ----------
  function showCard(kind, html, wide, arm = true) {
    card = kind; const c = $('#card'); c.innerHTML = html; c.classList.toggle('wide', !!wide); $('#overlay').hidden = false;
    // a short pause before anything on the card can be pressed, so a tap meant for the field never picks
    if (arm) { c.classList.add('arming'); c.dataset.armed = '0'; setTimeout(() => { if (c.dataset.armed === '0') { c.dataset.armed = '1'; c.classList.remove('arming'); } }, ARM_MS); }
    else { c.dataset.armed = '1'; c.classList.remove('arming'); }
    c.scrollTop = 0;
  }
  const armed = () => $('#card').dataset.armed === '1';
  const onArmed = fn => e => { if (armed()) { audio.play('card'); fn(e); } };
  function hideCard() { card = null; $('#overlay').hidden = true; }

  // the dawn sequence: blessings, then a pack, then (merchant) the trader. Each step opens only when needed.
  function dawnFlow() {
    if (!game) return;
    const S = game.state;
    if (S.over || S.phase !== 'day') return;
    paused = true; placing = null; closePanel();
    if (S.pendingPicks > 0 && S.offer.length) return showPerks();
    if (S.packs.length) return showPacks();
    if (S.trade && !S.trade.done && !traderSeen) { traderSeen = true; return showTrader(); }
    hideCard(); paused = false;
    if (S.mode === 'packs' && stockTotal() > 0) toast('Pick a building in the tray to place it.');
  }
  const needsDawn = () => { const S = game.state; return S.phase === 'day' && !S.over && ((S.pendingPicks > 0 && S.offer.length) || S.packs.length || (S.trade && !S.trade.done && !traderSeen)); };

  const sourceLabel = { dawn: 'Dawn blessing', chest: 'From a chest', nest: 'Spoils of the nest' };
  function showPerks() {
    const S = game.state, src = S.offerSource || 'dawn', isMastery = src.startsWith('mastery:');
    const pips = f => [0, 1, 2].map(i => `<i class="${i < S.P.fam[f] ? 'on' : ''}"></i>`).join('');
    let cards;
    if (isMastery) {
      const fam = src.split(':')[1], F = FAMILIES[fam];
      cards = MASTERIES[fam].map(m => `<button class="perk legendary" data-perk="m:${m.id}" style="--fam:${F.color}"><span class="pf">${F.name} mastery<span class="rar">Mastery</span></span><b>${m.name}</b><span class="pd">${m.desc}</span></button>`).join('');
    } else cards = S.offer.map(id => {
      const p = PERKS.find(q => q.id === id), F = FAMILIES[p.fam];
      const combo = SYNERGIES.find(sy => (sy.a === id && game.has(sy.b)) || (sy.b === id && game.has(sy.a)));
      return `<button class="perk ${p.rarity}${p.pact ? ' pact' : ''}" data-perk="${id}" style="--fam:${F.color}">
        <span class="pf">${F.name}<span class="pips">${pips(p.fam)}</span><span class="rar">${p.pact ? 'Pact' : p.rarity}</span></span>
        <b>${p.name}${p.max > 1 ? ` <span class="lv">${(S.P.taken[id] || 0) + 1}/${p.max}</span>` : ''}${combo ? ' <span class="combo">Combo!</span>' : ''}</b>
        <span class="pd">${p.desc}</span>${p.pact ? `<span class="pcost">Price: ${p.cost}</span>` : ''}${combo ? `<span class="pcombo">${combo.text}</span>` : ''}</button>`;
    }).join('');
    const build = Object.keys(FAMILIES).filter(f => S.P.fam[f]).map(f => `${FAMILIES[f].name} ${Math.min(S.P.fam[f], 3)}/3${S.P.mastery[f] ? ' ★' : ''}`).join(' · ');
    const rc = game.rerollCost();
    showCard('perk', `<div class="eyebrow">${isMastery ? 'Three of a kind' : sourceLabel[src] || 'Blessing'}${S.pendingPicks > 1 ? ` · ${S.pendingPicks} to pick` : ''}</div>
      <h1 class="sm">${isMastery ? 'Choose a mastery' : 'The town remembers'}</h1>
      <div class="perks">${cards}</div>
      <div class="cardrow spread"><span class="tiny">${build ? 'Your build: ' + build : 'Take three of one kind to unlock a mastery.'}</span>
      ${isMastery ? '' : `<button class="btn ghost" id="pReroll" ${rc > S.gold ? 'disabled' : ''}>Reroll${rc ? ` · <span class="dot gold"></span> ${rc}` : ' · free'}</button>`}</div>`);
    $$('[data-perk]').forEach(b => b.onclick = onArmed(() => { game.choosePerk(b.dataset.perk); dawnFlow(); }));
    const rr = $('#pReroll'); if (rr) rr.onclick = onArmed(() => { if (game.reroll()) showPerks(); });
  }
  const itemsText = items => Object.entries(items).map(([t, n]) => `<span class="it ${t}"><i></i>${n} ${n > 1 ? PLURAL[t] : t === 'wall' ? 'barricade post' : SHORT[t]}</span>`).join('');
  function showPacks() {
    const S = game.state;
    const kindName = { eco: 'Town', def: 'Defence', mix: 'Mixed' };
    showCard('pack', `<div class="eyebrow">Night ${S.night} · new buildings</div><h1 class="sm">Choose a pack</h1>
      <div class="packs">${S.packs.map(id => { const p = PACKS.find(q => q.id === id); return `<button class="pack ${p.kind}" data-pack="${id}"><span class="pf">${kindName[p.kind]}</span><b>${p.name}</b><span class="items">${itemsText(p.items)}</span></button>`; }).join('')}</div>
      <div class="cardrow spread"><span class="tiny">${stockTotal() ? `Still unplaced: ${Object.entries(S.stock).filter(([, n]) => n).map(([t, n]) => `${n} ${n > 1 ? PLURAL[t].toLowerCase() : SHORT[t].toLowerCase()}`).join(', ')}` : 'You place them for free. More cost double gold.'}</span>
      <button class="btn ghost" id="packReroll" ${S.gold < 5 ? 'disabled' : ''}>Other packs · <span class="dot gold"></span> 5</button></div>`);
    $$('[data-pack]').forEach(b => b.onclick = onArmed(() => { game.choosePack(b.dataset.pack); dawnFlow(); }));
    $('#packReroll').onclick = onArmed(() => { if (game.rerollPacks()) showPacks(); });
  }
  function showTrader() {
    const S = game.state;
    showCard('trade', `<div class="eyebrow">A caravan at the gate</div><h1 class="sm">The trader</h1><p>One deal per dawn. You can also come back to it from the keep.</p>
      <div class="opts one">${S.trade.deals.map(id => { const t = TRADES.find(x => x.id === id); const can = t.gold ? S.gold >= t.gold : S.food >= t.food;
        return `<button class="opt" data-trade="${id}" ${can ? '' : 'disabled'}><span class="nm">${t.name}<span class="cost">${t.gold ? `<span class="dot gold"></span>${t.gold}` : `<span class="dot food"></span>${t.food}`}</span></span><span class="ds">${t.desc}</span></button>`; }).join('')}</div>
      <div class="cardrow" style="margin-top:10px"><button class="btn ghost" id="tSkip">Not today</button></div>`);
    $$('[data-trade]').forEach(b => b.onclick = onArmed(() => { game.trade(b.dataset.trade); dawnFlow(); }));
    $('#tSkip').onclick = onArmed(() => dawnFlow());
  }

  // ---------- log and ending ----------
  function logTable() {
    const rows = game.logRows(); if (!rows.length) return '<p class="tiny">No nights played yet.</p>';
    const pk = id => id.startsWith('m:') ? '★ ' + id.slice(2) : (PERKS.find(p => p.id === id) || { name: id }).name;
    return `<div class="logwrap"><table class="log"><thead><tr><th>Night</th><th>Keep left</th><th>Threat</th><th>Wave HP</th><th>Tower DPS</th><th>Kills hero·tower·keep</th><th>Lost</th><th>Gold in / spent</th><th>Siege</th><th>Blessings</th></tr></thead><tbody>${rows.map(l => {
      const kp = l.keepEnd !== undefined ? Math.round(l.keepEnd / l.keepMax * 100) : null;
      return `<tr><td>${l.night}${l.bloodMoon ? ' ☾' : ''}</td><td class="${kp !== null && kp < 50 ? 'bad' : ''}">${kp !== null ? kp + '%' : 'now'}</td><td>${l.ratio ?? '–'}</td><td>${l.waveHp}</td><td>${l.defDps}</td>
      <td>${l.kills.hero || 0} · ${l.kills.tower || 0} · ${l.kills.keep || 0}</td><td class="${l.lost.length > 3 ? 'bad' : ''}">${l.lost.length}${l.risen ? ` (${l.risen} rose)` : ''}</td><td>+${l.goldIn ?? 0} / ${l.spent}</td>
      <td>${l.purge !== null && l.purge !== undefined ? names[l.purge] : '–'}</td><td>${l.perks.map(pk).join(', ') || '–'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function copyLog(btn) {
    const S = game.state;
    const data = JSON.stringify({ game: 'Hold Hollowmere', build: 'world-2', hero: S.heroClass, mode: S.mode, map: { biome: S.biome, seed: game.map.seed }, runSeed: S.seed, blessings: S.P.taken, mastery: S.P.mastery, stats: S.stats, claimed: [...S.claimed], log: game.logRows() });
    const ta = $('#logJson');
    const fallback = () => { ta.hidden = false; ta.value = data; ta.focus(); ta.select(); btn.textContent = 'Copy the text below'; };
    try { navigator.clipboard.writeText(data).then(() => { btn.textContent = 'Copied'; }, fallback); } catch { fallback(); }
  }
  function showLog() {
    if (!game || paused) return;
    paused = true; closePanel(); placing = null;
    showCard('log', `<div class="eyebrow">Run log · night ${game.state.night}</div><h1 class="sm">The town ledger</h1>${logTable()}
      <div class="cardrow"><button class="btn" id="logCopy">Copy log</button><button class="btn ghost" id="logClose">Back to town</button></div><textarea id="logJson" hidden readonly aria-label="Run log data"></textarea>`, true, false);
    $('#logCopy').onclick = e => copyLog(e.currentTarget);
    $('#logClose').onclick = () => { hideCard(); paused = false; };
  }
  function showEnd() {
    const S = game.state, st = S.stats, held = S.night - 1, prev = store.get('best', 0), best = Math.max(prev, S.night);
    store.set('best', best);
    const kills = Object.values(st.killsByKind).reduce((a, b) => a + b, 0);
    const topKinds = Object.entries(st.killsByKind).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${n} ${(MOBS[k] && MOBS[k].name || k).toLowerCase()}${n > 1 ? 's' : ''}`).join(' · ');
    const by = st.killsBy, heroShare = kills ? Math.round((by.hero || 0) / kills * 100) : 0;
    const stats = [
      ['Nights held', held], ['Dead put down', kills], ['Gold earned', st.goldEarned], ['Buildings raised', st.built],
      ['Most citizens', st.peakPop], ['Land claimed', st.regionsClaimed], ['Blessings', st.blessings], ['Bosses slain', st.bosses],
    ];
    if (S.heroClass === 'merchant') stats.push(['Sellswords hired', st.mercsHired], ['Gold from purses', st.pursesGold]);
    else stats.push(['Your kills', `${by.hero || 0}`], ['Times you fell', st.heroDeaths]);
    stats.push(['Buildings lost', st.buildingsLost], ['Dead that rose from homes', Math.round(st.risen)]);
    if (S.scav.trips) stats.push(['Scavenging runs', S.scav.trips], ['Survivors found · lost', `${S.scav.found} · ${S.scav.lost}`]);
    if (S.cleared) stats.push(['Rubble cleared', S.cleared]);
    const masteries = Object.entries(S.P.mastery).map(([f, id]) => MASTERIES[f].find(m => m.id === id).name);
    showCard('end', `<div class="eyebrow">The keep fell on night ${S.night}${S.night > prev ? ' · a new best' : ` · your best is night ${best}`}</div>
      <h1>Hollowmere is lost</h1>
      <p>${HEROES[S.heroClass].name} of ${game.map.name}. ${topKinds ? `Among the fallen: ${topKinds}.` : ''} ${heroShare ? `${heroShare}% of the kills were yours.` : ''}${masteries.length ? ` Mastered: ${masteries.join(', ')}.` : ''}</p>
      <div class="endstats">${stats.map(([k, v]) => `<div><b data-to="${typeof v === 'number' ? v : ''}">${typeof v === 'number' ? 0 : v}</b><span>${k}</span></div>`).join('')}</div>
      <details class="ledger"><summary>The night-by-night ledger</summary>${logTable()}</details>
      <div class="cardrow"><button class="btn big" id="again">New run</button><button class="btn ghost" id="logCopy">Copy log</button></div><textarea id="logJson" hidden readonly aria-label="Run log data"></textarea>`, true);
    // numbers count up
    const els = [...$$('.endstats b[data-to]')].filter(e => e.dataset.to !== ''); const t0 = performance.now();
    const tick = now => { const k = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - k, 3); for (const el of els) el.textContent = Math.round(+el.dataset.to * e); if (k < 1 && card === 'end') requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    $('#logCopy').onclick = e => copyLog(e.currentTarget);
    $('#again').onclick = onArmed(() => { location.reload(); });
  }

  // ---------- toasts ----------
  function toast(msg, kind) {
    const el = document.createElement('div'); el.className = 'toast' + (kind ? ' ' + kind : ''); el.textContent = msg;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 3800);
  }

  // ---------- build tray and placement ----------
  const stockTotal = () => Object.values(game.state.stock).reduce((a, b) => a + b, 0);
  const priceOf = t => (game.state.stock[t] || 0) > 0 ? 0 : game.buyCost(t);
  let trayKey = '';
  function renderTray() {
    const S = game.state, tray = $('#tray');
    tray.hidden = S.phase !== 'day' || !!card;
    if (tray.hidden) { trayKey = ''; return; }
    const sig = [S.gold, JSON.stringify(S.stock), placing && placing.type, S.builders].join('|'); if (sig === trayKey) return; trayKey = sig;
    const FOCUS = { defence: 'Defence', balanced: 'Balanced', growth: 'Growth', off: 'Off' };
    const bRow = S.builders ? `<div class="builders" role="group" aria-label="What your builders focus on"><span>Builders</span>${Object.entries(FOCUS).map(([k, v]) => `<button data-focus="${k}" aria-pressed="${S.builders === k}">${v}</button>`).join('')}</div>` : '';
    tray.innerHTML = bRow + BUILD_ORDER.map(t => {
      const n = S.stock[t] || 0, cost = n ? 0 : game.buyCost(t), on = placing && placing.type === t;
      return `<button class="tb ${t}${on ? ' on' : ''}${n ? ' have' : ''}" data-tray="${t}" ${!n && S.gold < cost ? 'aria-disabled="true"' : ''}><i></i><span class="tn">${SHORT[t]}</span>${n ? `<span class="tc">×${n}</span>` : `<span class="cost"><span class="dot gold"></span>${cost}</span>`}</button>`;
    }).join('');
  }
  $('#tray').addEventListener('click', e => {
    const f = e.target.closest('[data-focus]'); if (f && game) { game.setBuilders(f.dataset.focus); trayKey = ''; renderTray(); toast(f.dataset.focus === 'off' ? 'Builders stand down. You build by hand.' : `Builders focus on ${f.dataset.focus}.`); return; }
    const b = e.target.closest('[data-tray]'); if (!b || !game || paused) return;
    const t = b.dataset.tray;
    if (placing && placing.type === t) { stopPlacing(); return; }
    if (!(game.state.stock[t] > 0) && game.state.gold < game.buyCost(t)) { toast(`A ${SHORT[t].toLowerCase()} costs ${game.buyCost(t)} gold.`, 'bad'); return; }
    startPlacing(t);
  });
  // Placement works like a classic RTS: the land you can build on lights up, the building in hand
  // snaps to the nearest spot that fits (preferring spots that line up with a street), and
  // palisades are laid as lines: pick where the line starts, then where it ends.
  const SIZE = { house: 2, farm: 2, tower: 1, wall: 1 };
  const cellOf = (x, y) => [Math.floor(x), Math.floor(y)];
  function computeZone(type) {
    const S = game.state, n = SIZE[type], off = n % 2 ? 0.5 : 0, mask = new Uint8Array(N * N), spots = [];
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const r = game.map.region[idx(x, y)]; if (r < 0 || !S.claimed.has(r)) continue;
      const p = game.canPlace(type, x + off, y + off, 0); if (!p.ok) continue;
      spots.push({ x: p.x, y: p.y, cells: p.cells }); for (const c of p.cells) mask[c] = 1;
    }
    return { mask, spots, ver: S.occVersion };
  }
  // a spot that leaves exactly one street to its neighbours reads as a tidy block
  function tidy(sp) {
    const S = game.state; let x0 = N, y0 = N, x1 = 0, y1 = 0;
    for (const c of sp.cells) { const x = c % N, y = (c / N) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    let n = 0;
    for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
      if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) continue;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const o = S.occ[idx(x, y)]; if (o >= 0 && game.state.byId.get(o) && game.state.byId.get(o).type !== 'wall') n++;
    }
    return Math.min(6, n);
  }
  function snap(x, y) {
    const z = placing.zone; let best = null, bs = Infinity;
    for (const sp of z.spots) { const d = Math.hypot(sp.x - x, sp.y - y); if (d > 2.6) continue; const sc = d - 0.18 * tidy(sp); if (sc < bs) { bs = sc; best = sp; } }
    return best;
  }
  function refreshZone() { if (placing) { placing.zone = computeZone(placing.type); placing.zoneMask = placing.zone.mask; } }
  function startPlacing(type) {
    closePanel();
    const h = game.state.hero;
    placing = { type, x: h.x, y: h.y - 3, start: null };
    refreshZone();
    // begin at the spot nearest to just above the hero
    let best = null, bd = Infinity; for (const sp of placing.zone.spots) { const d = Math.hypot(sp.x - h.x, sp.y - (h.y - 3)); if (d < bd) { bd = d; best = sp; } }
    if (best) { placing.x = best.x; placing.y = best.y; }
    if (!placing.zone.spots.length) toast(type === 'wall' ? 'No open ground left for barricades.' : `No room left for a ${SHORT[type].toLowerCase()}. Claim more land or pull something down.`, 'bad');
    updateGhost(); $('#place').hidden = false; renderTray();
  }
  function stopPlacing() { placing = null; $('#place').hidden = true; renderTray(); }
  const wallAt = (x, y) => { const o = game.state.byId.get(game.state.occ[idx(x, y)]); return o && o.type === 'wall'; };
  function updateGhost() {
    if (!placing) return;
    const S = game.state, t = placing.type;
    $('#pRot').hidden = true;
    if (t === 'wall') return updateWallGhost();
    const sp = snap(placing.x, placing.y);
    const p = sp ? game.canPlace(t, sp.x, sp.y, 0, { deep: true }) : game.canPlace(t, placing.x, placing.y, 0, { deep: true });
    placing.ghost = { type: t, x: p.x, y: p.y, rot: 0, ok: p.ok, cells: p.cells };
    placing.reason = p.reason;
    const n = S.stock[t] || 0;
    $('#placeInfo').innerHTML = p.ok ? `${BUILDINGS[t].name}${n ? ` · ${n} in hand` : ` · <span class="dot gold"></span> ${game.buyCost(t)}`}` : `<span class="warn">${p.reason || 'No room here.'}</span>`;
    $('#pOk').textContent = 'Place'; $('#pOk').disabled = !p.ok;
  }
  function updateWallGhost() {
    const S = game.state, budget = game.wallBudget();
    let [ex, ey] = cellOf(placing.x, placing.y);
    if (!placing.start) {
      // snap the first post to open ground nearby, preferring the end of a palisade you already have
      let best = null, bs = Infinity;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = ex + dx, y = ey + dy; if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1 || !placing.zoneMask[idx(x, y)]) continue;
        const d = Math.hypot(x + 0.5 - placing.x, y + 0.5 - placing.y); if (d > 1.8) continue;
        const joins = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const o = S.byId.get(S.occ[idx(x + a, y + b)]); return o && (o.type === 'wall' || o.type === 'tower'); });
        const sc = d - (joins ? 0.9 : 0); if (sc < bs) { bs = sc; best = [x, y]; }
      }
      const c = best || [ex, ey], ok = !!best;
      placing.cell = c;
      placing.ghost = { type: 'wall', x: c[0] + 0.5, y: c[1] + 0.5, ok, cells: [idx(c[0], c[1])] };
      $('#placeInfo').innerHTML = ok ? `Barricade · ${touchUI ? 'tap' : 'click'} where the line starts${budget ? ` · ${S.stock.wall || 0} posts in hand` : ''}` : `<span class="warn">${game.canPlace('wall', ex + 0.5, ey + 0.5).reason || 'No room here.'}</span>`;
      $('#pOk').textContent = 'Start here'; $('#pOk').disabled = !ok;
      return;
    }
    const [sx, sy] = placing.start, line = game.lineCells(sx, sy, ex, ey);
    let n = 0; const okCells = [], cells = [];
    for (const [x, y] of line) {
      cells.push(idx(x, y));
      if (wallAt(x, y)) { okCells.push('skip'); continue; }
      const ok = game.canPlace('wall', x + 0.5, y + 0.5).ok && n < budget; okCells.push(ok); if (ok) n++;
    }
    placing.lineN = n; placing.end = [ex, ey];
    placing.ghost = { type: 'wall', x: ex + 0.5, y: ey + 0.5, ok: n > 0, cells, okCells };
    const inHand = Math.min(n, S.stock.wall || 0), paid = n - inHand;
    $('#placeInfo').innerHTML = n ? `${n} ${n === 1 ? 'post' : 'posts'}${inHand ? ` · ${inHand} from your packs` : ''}${paid ? ` · <span class="dot gold"></span> ${paid * game.buyCost('wall')}` : ''}` : `<span class="warn">${budget ? 'Nothing fits along this line.' : `Out of posts. One costs ${game.buyCost('wall')} gold.`}</span>`;
    $('#pOk').textContent = n ? `Lay ${n}` : 'Lay'; $('#pOk').disabled = !n;
  }
  function placeNow() {
    if (!placing) return;
    const t = placing.type, g = placing.ghost, S = game.state;
    if (t === 'wall') {
      if (!placing.start) { if (g && g.ok) { placing.start = placing.cell; updateGhost(); } return; }
      const [sx, sy] = placing.start, [ex, ey] = placing.end || placing.start;
      const n = game.buildLine(sx + 0.5, sy + 0.5, ex + 0.5, ey + 0.5);
      if (n) { toast(`${n} ${n === 1 ? 'post' : 'posts'} laid.`); placing.start = null; refreshZone(); if (!game.wallBudget()) stopPlacing(); else updateGhost(); }
      renderTray(); return;
    }
    if (!g || !g.ok) { toast(placing.reason || 'Cannot build there.', 'bad'); return; }
    if (game.build(t, g.x, g.y, 0)) {
      if ((S.stock[t] || 0) > 0 || (S.mode === 'classic' && S.gold >= game.buyCost(t))) { refreshZone(); updateGhost(); renderTray(); }
      else stopPlacing();
    }
  }
  $('#pOk').onclick = placeNow;
  $('#pCancel').onclick = () => { if (placing && placing.start) { placing.start = null; updateGhost(); } else stopPlacing(); };

  // ---------- panels ----------
  let lastSig = '';
  function selB() { const S = game.state; return selected && selected.type === 'building' ? S.byId.get(selected.id) : selected && selected.type === 'keep' ? S.keep : null; }
  function panelSig() {
    const S = game.state, b = selB();
    return [S.gold, S.food, S.phase, S.purge, S.halfUpgrade, S.trade && S.trade.done, selected && selected.type, selected && selected.id, scavSig(), b ? `${b.level}:${Math.ceil(b.hp)}:${b.maxHp}` : ''].join('|');
  }
  function openSel(sel) { selected = sel; renderPanel(); lastSig = panelSig(); $('#panel').hidden = false; }
  function closePanel() { selected = null; $('#panel').hidden = true; }
  const opt = (id, data, name, cost, ds, disabled) => `<button class="opt" id="${id}" ${data} ${disabled ? 'disabled' : ''}><span class="nm">${name}${cost !== null ? `<span class="cost"><span class="dot gold"></span>${cost}</span>` : ''}</span><span class="ds">${ds}</span></button>`;
  // ---------- scavenging ----------
  const SITE_KINDS = ['Pharmacy', 'Hardware store', 'Supermarket', 'Bus depot', 'Police post', 'Clinic', 'Pawn shop', 'Diner', 'School', 'Garage', 'Post office', 'Bakery'];
  const siteName = id => SITE_KINDS[(id * 7 + 3) % SITE_KINDS.length];
  const pct = p => `${Math.round(p * 100)}%`;
  function scavSig() { const sc = game.state.scav; return sc.crew.map(c => `${c.id}${c.out ?? '-'}${c.bitten ? 'b' : ''}`).join(',') + '/' + sc.runs.length + '/' + (selected && selected.pick ? [...selected.pick].join('.') : ''); }
  function renderSite(body, day) {
    const S = game.state, info = game.scavenge.siteInfo(selected.id), sc = S.scav, pk = selected.pick || (selected.pick = new Set());
    for (const id of [...pk]) { const c = sc.crew.find(q => q.id === id); if (!c || c.out || c.bitten) pk.delete(id); }
    const R = info.R;
    $('#pEyebrow').textContent = `${info.label} · ${names[info.site.region]}`;
    $('#pTitle').textContent = siteName(selected.id);
    let html = `<div class="stat"><span>Searches left <b>${Math.max(0, info.left)}</b></span><span>Each survivor brings about <b>${R.gold[0]}–${R.gold[1]}</b> gold and <b>${R.food[0]}–${R.food[1]}</b> food. Maybe free buildings, a new survivor${R.relic ? ', a rare blessing' : ''}.</span></div>`;
    html += `<div class="stat"><span>Risk each <b class="${info.die > 0.15 ? 'bad' : ''}">${pct(info.die)}</b> death · <b>${pct(info.bite)}</b> bite${info.awake ? ' · <b class="bad">hive awake</b>' : ''}</span><span>Gone tonight, back at dawn.</span></div>`;
    if (info.run) {
      const who = info.run.ids.map(id => (sc.crew.find(c => c.id === id) || {}).name).filter(Boolean).join(', ');
      html += `<div class="opts one">${opt('opt-recall', 'data-recall="1"', 'Call the crew back', null, `${who} will stay home. Supplies refunded.`, !day)}</div>`;
      body.innerHTML = html; return;
    }
    const homeCrew = sc.crew.filter(c => !c.out);
    if (!homeCrew.length) { body.innerHTML = html + '<div class="tiny">Everyone is out. Find more survivors on runs.</div>'; return; }
    html += `<div class="crew">${homeCrew.map(c => `<button class="who${pk.has(c.id) ? ' on' : ''}" data-who="${c.id}" ${c.bitten ? 'disabled' : ''} aria-pressed="${pk.has(c.id)}"><b>${c.name}</b><span>${c.bitten ? 'Bitten' : TRAITS[c.trait].name}</span></button>`).join('')}</div>`;
    const kit = R.kit * pk.size;
    html += `<div class="opts one">${opt('opt-send', 'data-send="1"', pk.size ? `Send ${pk.size} · supplies` : 'Pick who goes', pk.size ? kit : null, pk.size ? 'They leave now and come back at dawn, if they come back.' : 'Tap survivors above. Traits matter: a Scout keeps the run safer.', !pk.size || S.gold < kit || !day || info.left <= 0)}</div>`;
    body.innerHTML = html;
  }
  function showCrew() {
    if (!game || paused) return;
    paused = true; closePanel(); stopPlacing();
    const S = game.state, sc = S.scav;
    const row = c => {
      const site = c.out !== null ? siteName(c.out) : null;
      const status = c.bitten ? '<span class="bad">Bitten · turns at nightfall</span>' : site ? `Out at the ${site.toLowerCase()}` : 'Home';
      const acts = c.bitten ? `<button class="btn sm" data-treat="${c.id}" data-how="food" ${S.food < TREAT.food ? 'disabled' : ''}>Treat · ${TREAT.food} food</button><button class="btn sm" data-treat="${c.id}" data-how="gold" ${S.gold < TREAT.gold ? 'disabled' : ''}>Treat · ${TREAT.gold} gold</button><button class="btn sm ghost" data-exile="${c.id}">Turn out</button>` : '';
      return `<div class="crewrow"><div><b>${c.name}</b> <span class="tag">${TRAITS[c.trait].name}</span><div class="tiny">${TRAITS[c.trait].desc}</div></div><div class="st">${status}</div><div class="acts">${acts}</div></div>`;
    };
    showCard('crew', `<div class="eyebrow">Survivors · ${sc.crew.length} · ${sc.trips} runs · ${sc.lost} lost</div><h1 class="sm">The crew</h1>
      <p>Tap a glowing cache in the ruins by day to send survivors scavenging. Pale caches are on your land, amber ones next door, red ones deep in the city: the further out, the better the haul and the worse the odds.</p>
      <div class="crewlist">${sc.crew.map(row).join('') || '<div class="tiny">No one left. Runs sometimes find survivors, but you need someone to send.</div>'}</div>
      <div class="cardrow"><button class="btn ghost" id="crewClose">Back to town</button></div>`, true, false);
    $$('[data-treat]').forEach(b => b.onclick = () => { game.scavenge.treat(+b.dataset.treat, b.dataset.how); flushToasts(); hideCard(); paused = false; showCrew(); });
    $$('[data-exile]').forEach(b => b.onclick = () => { game.scavenge.exile(+b.dataset.exile); flushToasts(); hideCard(); paused = false; showCrew(); });
    $('#crewClose').onclick = () => { hideCard(); paused = false; };
  }
  function flushToasts() { for (const e of game.drainEvents()) if (e.t === 'toast' || e.t === 'fail') toast(e.msg, e.t === 'fail' ? 'bad' : e.kind); }
  function renderPanel() {
    if (!selected || !game) return;
    const S = game.state, body = $('#pBody'), day = S.phase === 'day';
    if (selected.type === 'keep') {
      const k = S.keep, l = k.level;
      $('#pEyebrow').textContent = 'Town centre'; $('#pTitle').textContent = `Keep · level ${l}`;
      let html = `<div class="stat"><span>Health <b>${Math.ceil(k.hp)} / ${k.maxHp}</b></span><span>${KEEP.desc[l - 1]}</span></div><div class="opts two">`;
      html += l < 3 ? opt('opt-keep', 'data-keep="1"', 'Raise the keep', KEEP.cost[l], `${KEEP.desc[l]} · buildings up to level ${l + 1} · march on ${l + 1 >= 3 ? 'far' : 'near'} hives`, S.gold < KEEP.cost[l] || !day) : '';
      if (S.trade && !S.trade.done && day) html += opt('opt-trader', 'data-trader="1"', 'Visit the trader', null, 'One deal before nightfall.', false);
      body.innerHTML = html + '</div>' + (l >= 3 ? '<div class="tiny">The keep is at its full height.</div>' : '');
      selected.range = KEEP.range[l - 1] + S.P.towerRange;
      return;
    }
    if (selected.type === 'region') {
      const info = game.regionInfo(selected.id), reg = game.map.regions[selected.id];
      $('#pEyebrow').textContent = `${RINGS[Math.min(2, reg.ring)]} · ${info.nest ? (info.active ? 'hive awake' : 'hive asleep') : 'no hive'}`;
      $('#pTitle').textContent = names[selected.id];
      const land = [info.forest > 40 ? 'deep forest' : info.forest > 15 ? 'woods' : 'open fields', info.water ? 'water' : null].filter(Boolean).join(' · ');
      let html = `<div class="stat"><span>${land}</span>${info.wakes ? `<span>Wakes <b>${info.wakes}</b> more ${info.wakes === 1 ? 'hive' : 'hives'} beyond it</span>` : ''}</div>`;
      if (S.purge === selected.id) html += `<div class="opts one">${opt('opt-cancel', 'data-cancel="1"', 'Call off the march', null, 'Tonight will be a normal night.', !day)}</div>`;
      else if (info.canPurge) {
        html += `<div class="stat"><span>Siege tonight would be <span class="rating ${info.rating}">${info.rating}</span></span><span>Your defences against this hive's last stand</span></div>`;
        html += `<div class="opts one">${opt('opt-purge', 'data-purge="1"', 'Clear this hive tonight', null, 'Its dead come in force at the end of the night. Survive and the land is yours, with a legendary blessing.', false)}</div>`;
      } else html += `<div class="tiny">${!info.nest ? 'No hive here.' : game.keepLevel() < info.needKeep ? `Raise the keep to level ${info.needKeep} to march on ${reg.ring >= 2 ? 'a far' : 'a near'} hive.` : 'Claim the land between you and this hive first.'}</div>`;
      body.innerHTML = html;
      return;
    }
    if (selected.type === 'site') { renderSite(body, day); return; }
    if (selected.type === 'rubble') {
      const r = game.rubbleAt(selected.x, selected.y);
      $('#pEyebrow').textContent = 'Your land'; $('#pTitle').textContent = 'Rubble';
      body.innerHTML = `<div class="stat"><span>Blocks building. Slows the dead.</span><span>Clear it to make room. The dead cross open ground faster.</span></div>`
        + (r.cells.length ? `<div class="opts one">${opt('opt-clear', 'data-clear="1"', `Clear ${r.cells.length} ${r.cells.length === 1 ? 'cell' : 'cells'} of rubble`, r.cost, 'A 3×3 patch around this spot becomes paved ground.', S.gold < r.cost || !day)}</div>` : '<div class="tiny">Nothing left to clear here.</div>');
      return;
    }
    const b = selB(); if (!b) { closePanel(); return; }
    const B = BUILDINGS[b.type];
    $('#pEyebrow').textContent = names[game.map.region[idx(Math.floor(b.x), Math.floor(b.y))]] || '';
    $('#pTitle').textContent = `${B.name} · level ${b.level}${b.ruined ? ' · ruined' : ''}`;
    let html = `<div class="stat"><span>Health <b>${Math.ceil(b.hp)} / ${b.maxHp}</b></span><span>${B.desc[b.level - 1]}</span></div><div class="opts two">`;
    if (b.type === 'wall') {
      const run = game.wallRun(b.id), total = run.reduce((a, w) => a + game.upCostOf(w), 0);
      if (b.level < MAX_LEVEL) { const capped = b.level >= game.keepLevel(); html += opt('opt-upw', 'data-upw="1"', capped ? 'Raise the keep first' : `Upgrade this barricade · ${run.length} ${run.length === 1 ? 'post' : 'posts'}`, capped ? null : total, capped ? `Nothing grows past the keep (level ${game.keepLevel()}).` : `${B.desc[b.level]} each. Short of gold? The nearest posts go first.`, capped || S.gold < game.upCostOf(b) || !day); }
      html += opt('opt-demo', 'data-demo="1"', 'Pull down this post', null, 'Opens a gap you can build a gate tower in.', !day);
      body.innerHTML = html + '</div>'; selected.range = null; return;
    }
    const capped = b.level >= game.keepLevel();
    if (b.type === 'tower') { const on = game.manned(b), need = CREW_NEED[b.level - 1]; html = html.replace('</div><div class="opts two">', `<span>${on ? `Crew <b>${need}</b> on watch` : `<b class="bad">No crew</b>: needs ${need} people. Build or upgrade homes.`}</span></div><div class="opts two">`); }
    if (b.level < MAX_LEVEL) { const c = game.upCostOf(b); html += opt('opt-up', 'data-up="1"', capped ? `Raise the keep first` : `Upgrade to level ${b.level + 1}`, capped ? null : c, capped ? `Nothing grows past the keep (level ${game.keepLevel()}).` : `${B.desc[b.level]} · ${game.maxHpOf(b.type, b.level + 1)} hp${b.type === 'tower' ? ` · needs ${CREW_NEED[b.level]} crew` : ''}${S.halfUpgrade ? ' · half price' : ''}`, capped || S.gold < c || !day); }
    html += opt('opt-demo', 'data-demo="1"', 'Pull down', null, `Get ${Math.floor(game.costOf(b.type) / 2)} gold back and free the space.`, !day);
    body.innerHTML = html + '</div>' + (b.level >= MAX_LEVEL ? '<div class="tiny">Fully upgraded.</div>' : '');
    selected.range = b.type === 'tower' ? game.towerStats(b).range : null;
  }
  $('#pBody').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn || btn.disabled || !selected) return;
    if (btn.dataset.who) { const id = +btn.dataset.who, pk = selected.pick || (selected.pick = new Set()); if (pk.has(id)) pk.delete(id); else pk.add(id); renderPanel(); return; }
    if (btn.dataset.send) { if (game.scavenge.send(selected.id, [...(selected.pick || [])])) { const n = selected.pick.size; selected.pick = new Set(); toast(`${n === 1 ? 'One survivor heads' : `${n} survivors head`} out. Back at dawn.`, 'good'); } }
    if (btn.dataset.clear) { const n = game.clearRubble(selected.x, selected.y); if (n) { toast(`${n} ${n === 1 ? 'cell' : 'cells'} cleared.`); closePanel(); updateHud(); return; } }
    if (btn.dataset.recall && game.scavenge.recall(selected.id)) toast('The crew stays home. Supplies returned.');
    if (btn.dataset.keep && game.upgradeKeep()) toast('The keep rises higher.');
    if (btn.dataset.trader) { traderSeen = true; closePanel(); paused = true; showTrader(); return; }
    if (btn.dataset.up && game.upgrade(selected.id)) toast('Upgraded.');
    if (btn.dataset.upw) { const n = game.upgradeWall(selected.id); if (n) toast(`${n} ${n === 1 ? 'post' : 'posts'} upgraded.`); }
    if (btn.dataset.demo) {
      if (btn.dataset.sure) { if (game.demolish(selected.id)) { toast('Pulled down.'); closePanel(); updateHud(); return; } }
      else { btn.dataset.sure = '1'; btn.querySelector('.nm').textContent = 'Tap again to pull down'; return; }
    }
    if (btn.dataset.purge && game.planPurge(selected.id)) toast(`At nightfall you march on ${names[selected.id]}.`, 'good');
    if (btn.dataset.cancel) game.planPurge(null);
    renderPanel(); updateHud();
  });
  $('#pClose').onclick = closePanel;
  const ringBell = () => { if (game && !paused && game.startNight()) { closePanel(); stopPlacing(); } };
  $('#bell').onclick = ringBell;
  $('#logBtn').onclick = showLog;
  $('#crewBtn').onclick = showCrew;
  let speed = 1; const SPEEDS = [1, 2, 3];
  $('#spdBtn').onclick = () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; $('#spdBtn').textContent = `${speed}×`; $('#spdBtn').classList.toggle('fast', speed > 1); };
  const showSound = () => { const b = $('#sndBtn'); b.classList.toggle('off', audio.muted()); b.setAttribute('aria-label', audio.muted() ? 'Sound off' : 'Sound on'); };
  $('#sndBtn').onclick = () => { audio.setMuted(!audio.muted()); showSound(); }; showSound();
  // graphics quality: High (shadows, ambient occlusion, glow), Medium (glow), Low (fastest)
  const QNAME = { high: 'HQ', medium: 'MQ', low: 'LQ' }, QNEXT = { high: 'medium', medium: 'low', low: 'high' };
  function showQuality() { if (view) { $('#qBtn').textContent = QNAME[view.quality()]; $('#qBtn').setAttribute('aria-label', `Graphics quality: ${view.quality()}`); } }
  $('#qBtn').onclick = () => { if (!view) return; const q = QNEXT[view.quality()]; view.setQuality(q); store.set('quality', q); showQuality(); toast(`Graphics: ${q}.`); };
  // auto quality: if no choice was made, step down one level when frames are slow for a few seconds
  const perf = { t: 0, n: 0, slow: 0, wait: 3 };
  function watchFrames(raw) {
    if (!view || paused || document.hidden || store.get('quality', null) || new URLSearchParams(location.search).get('q')) return;
    if (view.quality() === 'low' || raw > 250) return;
    if (perf.wait > 0) { perf.wait -= raw / 1000; return; }
    perf.t += raw; perf.n++;
    if (perf.t < 3000) return;
    const avg = perf.t / perf.n; perf.t = 0; perf.n = 0;
    perf.slow = avg > 34 ? perf.slow + 1 : 0;           // under ~30 fps
    if (perf.slow >= 2) {
      const q = view.quality() === 'high' ? 'medium' : 'low';
      view.setQuality(q); store.set('autoq', q); showQuality(); perf.slow = 0; perf.wait = 4;
      toast(`Graphics lowered to ${QNAME[q]} for a smoother game. Tap ${QNAME[q]} to change.`);
    }
  }
  $('#zIn').onclick = () => view && view.setZoom(view.getZoom() * 0.8);
  $('#zOut').onclick = () => view && view.setZoom(view.getZoom() * 1.25);

  // ---------- ability ----------
  function useAbility() {
    if (!game || paused) return;
    const ok = game.useAbility();
    if (ok && game.heroDef.ability.id === 'hire') toast('Sellswords join you.', 'good');
  }
  $('#ability').onclick = useAbility;
  function renderAbility() {
    const A = game.heroDef.ability, S = game.state, el = $('#ability');
    if (!A) { el.hidden = true; return; }
    el.hidden = A.nightOnly && S.phase !== 'night';
    if (el.hidden) return;
    const cd = S.ability.cd, cost = game.abilityCost();
    el.querySelector('.an').textContent = A.name;
    el.querySelector('.ac').innerHTML = cd > 0 ? `${Math.ceil(cd)}s` : cost ? `<span class="dot gold"></span>${cost}` : 'ready';
    el.classList.toggle('cool', cd > 0 || S.hero.dead || (cost && S.gold < cost));
    el.style.setProperty('--cd', cd > 0 ? (cd / A.cooldown) : 0);
  }

  // ---------- HUD ----------
  function updateHud() {
    if (game) { const sc = game.state.scav, bit = sc.crew.some(c => c.bitten), out = sc.crew.filter(c => c.out !== null).length; const cb = $('#crewBtn'); cb.classList.toggle('alert', bit); cb.textContent = out ? `Crew ${sc.crew.length - out}/${sc.crew.length}` : `Crew ${sc.crew.length}`; }
    if (!game) return;
    const S = game.state, night = S.phase === 'night', bm = game.isBloodMoon(S.night);
    $('#phaseLbl').textContent = S.over ? 'Fell on' : night ? 'Night' : 'Day';
    $('#nightNum').textContent = S.night;
    $('#moon').hidden = !bm;
    $('#keepFill').style.width = (Math.max(0, S.keep.hp) / S.keep.maxHp * 100) + '%';
    $('#keepTxt').textContent = Math.max(0, Math.ceil(S.keep.hp));
    $('#resPill').hidden = night;
    $('#gold').textContent = S.gold; $('#goldNote').textContent = `+${game.goldPerDawn()}`;
    $('#food').textContent = S.food; $('#foodNote').textContent = `+${game.foodPerDawn()} −${game.foodNeed()}`;
    $('#foodNote').classList.toggle('warn', game.foodPerDawn() + S.food < game.foodNeed());
    const cw = game.crewing(); $('#pop').textContent = game.pop(); $('#popNote').textContent = cw.need ? `${cw.free} free` : ''; $('#popNote').classList.toggle('warn', cw.need > cw.people);
    const bell = $('#bell');
    if (night || S.over) {
      bell.hidden = true;
      const left = S.queue.length + S.mobs.filter(m => !m.roam).length;
      $('#info').innerHTML = S.over ? 'The keep has fallen' : `<em>${left}</em> dead left${S.hero.dead ? ` · you return in ${Math.ceil(S.hero.respawn)}s` : ''}${S.weather !== 'clear' ? ` · <span class="wx ${S.weather}">${game.weather().name}</span>` : ''}`;
    } else {
      bell.hidden = false; const bonus = game.bellBonus(), dusk = Math.ceil(game.duskIn());
      bell.textContent = (bm ? 'Face the blood moon' : 'Ring the bell') + (bonus > 0 ? ` · +${bonus}` : '');
      const fc = view.routes(), dead = fc.reduce((a, r) => a + r.count, 0), ratio = game.threatRatio();
      const loose = S.mobs.filter(m => !m.roam).length;
      $('#info').innerHTML = `<span class="clock${dusk <= 15 ? ' soon' : ''}">Dusk ${Math.floor(dusk / 60)}:${String(dusk % 60).padStart(2, '0')}</span>${loose ? ` · <em class="loose">${loose}</em> coming` : ''} · Tonight <em>~${dead}</em> from ${fc.length} ${fc.length === 1 ? 'hive' : 'hives'} · <span class="rating ${game.ratingOf(ratio)}">${game.ratingOf(ratio)}</span>${S.purge !== null ? ` · <span class="siege">siege at ${names[S.purge]}</span>` : ''}${S.weather !== 'clear' ? ` · <span class="wx ${S.weather}">${game.weather().name}</span>` : ''}${game.townDraw() > 1.005 ? ` · <span class="draw">town +${Math.round((game.townDraw() - 1) * 100)}%</span>` : ''}`;
    }
    renderTray(); renderAbility();
    const tb = $('.top').getBoundingClientRect(), db = $('#dock').getBoundingClientRect();
    edge.top = tb.bottom + 10; edge.bot = innerHeight - db.top + 10;
  }

  // ---------- edge arrows ----------
  const edge = { top: 60, bot: 100, pool: [], tags: [] };
  function edgeMarks() {
    const S = game.state, Wd = innerWidth, Hh = innerHeight, m = 22, t = edge.top, bt = Hh - edge.bot, cx = Wd / 2, cy = (t + bt) / 2, buckets = new Map();
    if (S.phase === 'night') for (const z of S.mobs) {
      if (z.roam) continue;
      const p = view.project(z.x, z.y); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue;
      const ang = Math.atan2(p.y - cy, p.x - cx), key = Math.round(ang / (Math.PI / 16));
      const b = buckets.get(key) || { ang, n: 0, big: false }; b.n++; if (MOBS[z.kind].size >= 1.6) b.big = true; buckets.set(key, b);
    }
    let tagN = 0;
    if (S.phase === 'day') for (const r of view.routes()) {
      const p = view.project(r.x, r.y, 2.2);
      if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) {
        let el = edge.tags[tagN]; if (!el) { el = document.createElement('div'); el.className = 'nestTag'; $('#edge').appendChild(el); edge.tags[tagN] = el; }
        el.textContent = `${r.siege ? 'Siege · ' : ''}~${r.count}${r.boss ? ' + boss' : ''}`; el.classList.toggle('siege', r.siege);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`; el.hidden = false; tagN++;
      } else {
        const ang = Math.atan2(p.y - cy, p.x - cx), key = 1000 + Math.round(ang / (Math.PI / 16));
        const b = buckets.get(key) || { ang, n: 0, big: false, day: true }; b.n += r.count; if (r.siege || r.boss) b.big = true; buckets.set(key, b);
      }
    }
    for (let k = tagN; k < edge.tags.length; k++) edge.tags[k].hidden = true;
    let i = 0;
    for (const b of buckets.values()) {
      let el = edge.pool[i]; if (!el) { el = document.createElement('div'); el.className = 'ar'; el.innerHTML = '<i></i><span></span>'; $('#edge').appendChild(el); edge.pool[i] = el; }
      const c = Math.cos(b.ang), s = Math.sin(b.ang), hx = Wd / 2 - m, hy = Math.max(10, (bt - t) / 2 - m * 0.5), k = Math.min(Math.abs(hx / (c || 1e-6)), Math.abs(hy / (s || 1e-6)));
      el.style.transform = `translate(${cx + c * k}px, ${cy + s * k}px) rotate(${b.ang}rad)`;
      const sp = el.lastChild; sp.textContent = b.day ? `~${b.n}` : b.n > 1 ? b.n : ''; sp.style.transform = `rotate(${-b.ang}rad)`;
      el.classList.toggle('big', b.big); el.hidden = false; i++;
    }
    for (; i < edge.pool.length; i++) edge.pool[i].hidden = true;
    if (S.over) for (const el of [...edge.pool, ...edge.tags]) el.hidden = true;
  }

  // ---------- input ----------
  // touch: drag anywhere = joystick (screen right/up), short tap = select or walk there.
  // mouse: click = select or walk; while placing, the ghost follows the pointer and a click places.
  const canvas = $('#view'), joy = $('#joy'); let down = null; const touches = new Map(); let pinch0 = 0, zoom0 = 1;
  const joyIn = { x: 0, y: 0 }; let touchUI = matchMedia('(pointer: coarse)').matches;
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (view) view.setZoom(view.getZoom() * (1 + e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && view) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.getZoom(); endJoy(); down = null; return; }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', joy: false, drag: false }; canvas.focus({ preventScroll: true });
    touchUI = down.touch;
    // mouse: press where a palisade starts, drag, release where it ends (or click twice)
    if (placing && placing.type === 'wall' && !down.touch && !placing.start && view && !paused) {
      const g = view.groundAt(e.clientX, e.clientY); if (g) { placing.x = g.x; placing.y = g.y; updateGhost(); if (placing.ghost.ok) { placing.start = placing.cell; down.wallStart = true; updateGhost(); } }
    }
  });
  function endJoy() { joyIn.x = joyIn.y = 0; joy.hidden = true; }
  canvas.addEventListener('pointercancel', e => { touches.delete(e.pointerId); if (down && down.id === e.pointerId) { down = null; endJoy(); } });
  canvas.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2 && pinch0 && view) { const [a, b] = [...touches.values()]; view.setZoom(zoom0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))); return; } }
    if (!game || !view || paused) return;
    // placing: the ghost follows the mouse, or a finger dragging it
    if (placing && (e.pointerType === 'mouse' || (down && down.id === e.pointerId))) {
      const g = view.groundAt(e.clientX, e.clientY); if (g) { const ox = placing.x, oy = placing.y; placing.x = g.x; placing.y = g.y; if (Math.floor(ox) !== Math.floor(g.x) || Math.floor(oy) !== Math.floor(g.y)) updateGhost(); }
      if (down) down.drag = true;
      return;
    }
    if (down && down.id === e.pointerId && down.touch) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y, d = Math.hypot(dx, dy);
      if (!down.joy && d > JOY_PX) { down.joy = true; joy.hidden = false; joy.style.transform = `translate(${down.x}px, ${down.y}px)`; game.state.hero.target = null; }
      if (down.joy) {
        const k = Math.min(1, d / 60), nx = dx / (d || 1), ny = dy / (d || 1);
        joyIn.x = nx * k; joyIn.y = ny * k;
        joy.firstChild.style.transform = `translate(${nx * Math.min(d, 40)}px, ${ny * Math.min(d, 40)}px)`;
      }
    }
    if (e.pointerType === 'mouse' && game.state.phase === 'day') { const p = view.pick(e.clientX, e.clientY); canvas.style.cursor = p && p.type !== 'ground' ? 'pointer' : ''; }
  });
  canvas.addEventListener('pointerup', e => {
    const wasPinch = touches.size >= 2; touches.delete(e.pointerId); if (touches.size < 2) pinch0 = 0;
    const d = down; if (d && d.id === e.pointerId) down = null;
    if (d && d.joy) { endJoy(); return; }
    if (!d || wasPinch || paused || !game) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? JOY_PX : 8) && !placing) return;
    if (placing) {
      // mouse: a click places (palisades: release after a drag, or a second click).
      // touch: a tap moves the ghost; the first tap of a palisade marks where it starts; Place confirms.
      const g = view.groundAt(e.clientX, e.clientY); if (g) { placing.x = g.x; placing.y = g.y; updateGhost(); }
      if (placing.type === 'wall') {
        if (d.touch) { if (!placing.start) placeNow(); return; }
        if (d.wallStart) { const [ex, ey] = cellOf(placing.x, placing.y); if (ex !== placing.start[0] || ey !== placing.start[1]) placeNow(); return; }
        placeNow(); return;
      }
      if (!d.touch) placeNow();
      return;
    }
    const p = view.pick(e.clientX, e.clientY); if (!p) return;
    const S = game.state;
    if (S.phase === 'day' && p.type === 'rubble') { game.heroTo(p.x, p.y); view.showMove(p.x, p.y); openSel({ type: 'rubble', x: p.x, y: p.y }); return; }
    if (S.phase === 'day' && p.type === 'site') { openSel({ type: 'site', id: p.id, pick: new Set() }); return; }
    if (S.phase === 'day' && (p.type === 'building' || p.type === 'keep')) { openSel(p.type === 'building' ? { type: 'building', id: p.id } : { type: 'keep' }); return; }
    if (S.phase === 'day' && p.type === 'region' && game.map.regions[p.id].nest && game.regionInfo(p.id).nest) {
      const n = game.map.regions[p.id].nest;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 4 || !(selected && selected.type === 'region')) { openSel({ type: 'region', id: p.id }); return; }
    }
    game.heroTo(p.x, p.y); view.showMove(p.x, p.y); if (selected) closePanel();
  });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (placing && placing.start) { placing.start = null; updateGhost(); } else if (placing) stopPlacing(); else closePanel(); }
    if (e.target.closest && e.target.closest('button') && (k === ' ' || k === 'enter')) return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = true; e.preventDefault(); }
    if (!game) return;
    if (k === 'n') ringBell();
    if (k === 'l') showLog();
    if (k === 'q' || k === ' ') { e.preventDefault(); useAbility(); }
    if (k === 'enter' && placing) placeNow();
    if (['1', '2', '3', '4'].includes(k) && !paused && game.state.phase === 'day') { const t = BUILD_ORDER[+k - 1]; if (placing && placing.type === t) stopPlacing(); else startPlacing(t); }
    if ((k === '=' || k === '+') && view) view.setZoom(view.getZoom() * 0.8);
    if ((k === '-' || k === '_') && view) view.setZoom(view.getZoom() * 1.25);
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; endJoy(); });

  // ---------- loop ----------
  const toastFor = new Set(['toast', 'fail']);
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = now - last, dt = Math.min(0.1, raw / 1000); last = now;
    if (!game || !view) return;
    const S = game.state;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    game.setHeroInput(kx || joyIn.x, ky || joyIn.y);
    if (!paused) { acc += dt * speed; let n = 0; while (acc >= STEP && !paused && n++ < 240) { game.step(STEP); acc -= STEP; if (S.over) break; } if (n >= 240) acc = 0; }
    else acc = 0;
    const events = game.drainEvents();
    audio.onEvents(events, game); audio.tick(game, dt);
    for (const e of events) {
      if (toastFor.has(e.t)) toast(e.msg, e.t === 'fail' ? 'bad' : e.kind);
      if (e.t === 'claim' && selected && selected.type === 'region') closePanel();
      if (e.t === 'dawn') { dawnT = DAWN_DELAY; traderSeen = false; endJoy(); if (S.night === 2 && !S.scav.trips) setTimeout(() => toast('See the glowing caches in the ruins? Tap one to send survivors scavenging.'), 2500); }
      if (e.t === 'over') { endT = now + 2600; paused = false; closePanel(); stopPlacing(); view.startOrbit(); }
      if ((e.t === 'remove' || e.t === 'ruin') && selected && selected.type === 'building' && !S.byId.get(selected.id)) closePanel();
    }
    // the dawn cards wait a moment so a last tap at night can't land on them
    if (dawnT > 0) dawnT -= dt;
    if (!card && dawnT <= 0 && needsDawn()) dawnFlow();
    if (endT > 0 && now >= endT) { endT = -1; paused = true; showEnd(); }
    if (placing && placing.zone.ver !== S.occVersion && S.phase === 'day') { refreshZone(); updateGhost(); }
    if (placing && S.phase !== 'day') stopPlacing();
    view.frame(dt, { events, selected, ghost: placing && placing.ghost, zone: placing && placing.zoneMask });
    edgeMarks(); watchFrames(raw);
    hudT -= dt; if (hudT <= 0) { updateHud(); hudT = 0.2; if (selected && !paused) { const sig = panelSig(); if (sig !== lastSig) { lastSig = sig; renderPanel(); } } }
  }
  requestAnimationFrame(frame);
  showStart();
}
