// Screens, HUD, panels and input. Talks to the game only through its public API.
import { createGame, STEP, CREW_NEED, DIFFICULTY, HEAT } from '../sim/game.js';
import { mapChoices, generateMap, N, T, idx, BIOMES, LANDMARKS } from '../sim/mapgen.js';
import { createView } from '../render/view.js';
import { BUILDINGS, BUILD_ORDER, TECH_ORDER, UNLOCKS, KEEP, MAX_LEVEL } from '../content/buildings.js';
import { HEROES, HERO_ORDER, TRADES } from '../content/heroes.js';
import { PERKS, FAMILIES, SYNERGIES, MASTERIES } from '../content/perks.js';
import { PACKS } from '../content/packs.js';
import { MOBS, ESCAPE } from '../content/mobs.js';
import { regionNames, hiveName } from '../content/names.js';
import { TRAITS, TREAT, RUN } from '../content/scavenge.js';
import { createAudio } from './audio.js';
import { createChronicler } from './story-ai.js';
import { createSaves } from './saves.js';
import { TITLES, ROLES, BARKS, QUEST_TEMPLATES } from '../content/story.js';
import { RARITY, KITS } from '../content/districts.js';
import { LEGACY, fameOf } from '../content/legacy.js';
import { RULES } from '../content/season.js';
// [road] begin
import { createRoadUI } from './road-ui.js';
// [road] end

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('hollowmere.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hollowmere.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const audio = createAudio(store);
const chronicler = createChronicler(store);
const saves = createSaves();
let lastSave = null;
for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, () => audio.unlock(), { capture: true });
const RINGS = ['Camp', 'The wilds', 'The city', 'The old core'];
const ARM_MS = 700;          // cards ignore taps this long after they appear
const DAWN_DELAY = 1.2;      // seconds between the last kill and the first card
const JOY_PX = 14;           // a touch that moves further than this is a joystick drag, not a tap
const SHORT = { house: 'Home', farm: 'Farm', tower: 'Tower', wall: 'Barricade', workshop: 'Workshop', market: 'Market', generator: 'Generator' };
const PLURAL = { house: 'Homes', farm: 'Farms', tower: 'Towers', wall: 'barricade posts', workshop: 'Workshops', market: 'Markets', generator: 'Generators' };

export function startApp() {
  let game = null, view = null, names = [], selected = null, placing = null, paused = true, acc = 0, last = performance.now(), hudT = 0;
  // [road] begin
  let roadUI = null;
  // [road] end
  let card = null;             // which card is open: 'start' | 'perk' | 'pack' | 'trade' | 'log' | 'end'
  let dawnT = 0, traderSeen = false, endT = -1;
  const keys = {};
  let setup = { hero: store.get('hero', 'warrior'), mode: 'classic', difficulty: store.get('difficulty', 'survivor'), runSeed: Math.floor(Math.random() * 1e6), pick: 0 };
  if (setup.hero === 'steward') setup.hero = 'merchant';
  { const sq = new URLSearchParams(location.search).get('seed'); if (sq) setup.runSeed = +sq; }   // testing: a fixed world

  // ---------- start screen ----------
  // ---------- maps: one pixel per cell, cropped to the land (the dark between is skipped) ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const MAPCOL = { meadow: hex('#5f7a45'), wood: hex('#2f4a2a'), street: hex('#77736b'), block: hex('#45423e'), park: hex('#3f5634'), water: hex('#2f5a6e'), ford: hex('#8d887d'), dirt: hex('#8a6a48'), road: hex('#c2a46e'), cliff: hex('#8a8378'), site: hex('#e0b050'), voidc: [11, 13, 14] };
  function mapBox(m) { let x0 = N, y0 = N, x1 = 0, y1 = 0; for (let i = 0; i < N * N; i++) if (m.terrain[i] !== T.VOID) { const x = i % N, y = (i / N) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0: Math.max(0, x0 - 3), y0: Math.max(0, y0 - 3), x1: Math.min(N - 1, x1 + 3), y1: Math.min(N - 1, y1 + 3) }; }
  /** paint the world into a canvas (N×N); with `seen`, what you have not explored is dark (the road and the city's outline show faintly) */
  function paintWorld(cv, m, seen) {
    cv.width = cv.height = N; const ctx = cv.getContext('2d'), im = ctx.createImageData(N, N), d = im.data;
    for (let i = 0; i < N * N; i++) {
      const t = m.terrain[i], wild = m.wild && m.wild[i];
      let c = t === T.VOID ? MAPCOL.voidc : m.lm[i] >= 0 ? MAPCOL.site : m.road[i] && wild ? MAPCOL.road : t === T.WATER ? MAPCOL.water : t === T.FORD ? MAPCOL.ford : t === T.CLIFF ? MAPCOL.cliff : t === T.DIRT ? MAPCOL.dirt
        : wild ? (t === T.FOREST ? MAPCOL.wood : MAPCOL.meadow) : t === T.ROCK ? MAPCOL.block : t === T.FOREST ? MAPCOL.park : MAPCOL.street;
      let k = 1;
      if (seen && !seen[i] && t !== T.VOID) k = m.road[i] && wild ? 0.55 : wild ? 0.28 : 0.42;
      d[i * 4] = c[0] * k; d[i * 4 + 1] = c[1] * k; d[i * 4 + 2] = c[2] * k; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0); return cv;
  }
  function drawMinimap(canvas, m) {
    const b = mapBox(m), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, src = paintWorld(document.createElement('canvas'), m, null), s = 2;
    canvas.width = w * s; canvas.height = h * s; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, b.x0, b.y0, w, h, 0, 0, w * s, h * s);
    ctx.fillStyle = '#d9843a'; ctx.beginPath(); ctx.arc((m.town.x - b.x0) * s, (m.town.y - b.y0) * s, 6, 0, 7); ctx.fill();
  }
  // in game: a live picture of what you have explored
  let worldCv = null, worldV = -1, worldB = null, miniT = 0;
  function worldNow() {
    const S = game.state;
    if (!worldCv) { worldCv = document.createElement('canvas'); worldB = mapBox(game.map); worldV = -1; }
    if (worldV !== S.seenVersion) { worldV = S.seenVersion; paintWorld(worldCv, game.map, S.seen); }
    return worldCv;
  }
  function marks(ctx, ox, oy, s, big) {
    const S = game.state, m = game.map, dot = (x, y, r, col, ring) => { ctx.beginPath(); ctx.arc((x - ox) * s, (y - oy) * s, r, 0, 7); if (ring) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); } };
    const seenAt = (x, y) => S.seen[idx(Math.floor(x), Math.floor(y))] === 1;
    for (const r of m.regions) if (r.nest && seenAt(r.nest.x, r.nest.y)) dot(r.nest.x, r.nest.y, big ? 5 : 3, S.nestAlive[r.id] ? (r.ring === 1 ? '#b4ff4e' : '#ff5a4a') : '#6b6b6b');
    if (big) for (const l of S.landmarks) if (seenAt(l.x, l.y)) dot(l.x, l.y, 6, l.owned ? '#ffb347' : '#ffe08a', !l.owned);
    for (const sp of S.story.spots) if (big) dot(sp.x, sp.y, 4, '#6fc3ff');
    const tr = S.story.trial; if (tr && !tr.done) dot(tr.x, tr.y, big ? 6 : 4, '#ff4a4a', true);
    dot(m.town.x, m.town.y, big ? 7 : 4, '#d9843a');
    // [road] begin
    if (roadUI) roadUI.marks(ctx, ox, oy, s, big);
    // [road] end
    const h = S.hero; dot(h.x, h.y, big ? 6 : 4, '#ffffff'); dot(h.x, h.y, big ? 9 : 6, 'rgba(255,255,255,.5)', true);
  }
  function drawMini() {
    const cv = $('#mini'); if (!cv || !game) return;
    const S = game.state, src = worldNow(), R = 36, px = 2, ctx = cv.getContext('2d'), h = S.hero;
    if (cv.width !== R * 2 * px * 2) { cv.width = cv.height = R * 2 * px * 2; }
    const s = cv.width / (R * 2); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#0b0d0e'; ctx.fillRect(0, 0, cv.width, cv.width);
    ctx.drawImage(src, h.x - R, h.y - R, R * 2, R * 2, 0, 0, cv.width, cv.width);
    marks(ctx, h.x - R, h.y - R, s, false);
    // where the city lies, when it is off the little map
    const c = game.map.city; if (c) { const a = Math.atan2(c.y - h.y, c.x - h.x), dd = Math.hypot(c.x - h.x, c.y - h.y); if (dd > R + c.r * 0.3) { const r0 = cv.width / 2 - 9, x = cv.width / 2 + Math.cos(a) * r0, y = cv.width / 2 + Math.sin(a) * r0; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.fill(); ctx.restore(); } }
  }
  function showMap() {
    const S = game.state, src = worldNow(), b = worldB, w = b.x1 - b.x0 + 1, hh = b.y1 - b.y0 + 1, s = 2;
    paused = true; if (placing) stopPlacing(); closePanel();
    showCard('map', `<div class="eyebrow">${esc(game.map.name)} · day ${S.night}</div><h1 class="sm">Map</h1>
      <div class="mapwrap"><canvas id="bigMap" aria-label="Map of the woods and the city"></canvas></div>
      <div class="legend"><span><i style="background:#ffffff"></i>You</span><span><i style="background:#d9843a"></i>Camp</span><span><i style="background:#c2a46e"></i>The old road</span><span><i style="background:#b4ff4e"></i>Forest hollow</span><span><i style="background:#ff5a4a"></i>City hive</span><span><i class="o" style="border-color:#ffe08a"></i>Place to claim</span><span><i style="background:#6fc3ff"></i>Encounter</span></div>
      <p class="tiny" style="white-space:normal">Dark ground is unexplored. The old road starts deep in the woods and leads to the city: <b>about a minute on foot</b>.</p>
      <div class="cardrow"><button class="btn big" id="mapOk">Back</button></div>`, true, false);
    const cv = $('#bigMap'); cv.width = w * s; cv.height = hh * s; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, b.x0, b.y0, w, hh, 0, 0, w * s, hh * s);
    marks(ctx, b.x0, b.y0, s, true);
    const lbl = (x, y, t) => { ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t, (x - b.x0) * s, (y - b.y0) * s); ctx.fillStyle = '#fff1d6'; ctx.fillText(t, (x - b.x0) * s, (y - b.y0) * s); };
    lbl(game.map.town.x, game.map.town.y - 8, 'CAMP'); const c = game.map.city; if (c) lbl(c.x, c.y + 4, 'THE CITY');
    // [road] begin
    if (roadUI) roadUI.onMap(cv, b.x0, b.y0, s);
    // [road] end
    $('#mapOk').onclick = () => { hideCard(); paused = false; };
  }
  function showStart() {
    paused = true; $('#hud').hidden = true;
    const opts = mapChoices(setup.runSeed);
    const best = store.get('best', 0);
    showCard('start', `<div class="eyebrow">An open-ended reclaiming${best ? ` · your best: night ${best}` : ''}</div>
      <h1>Hold Hollowmere</h1>
      <p>You woke up in the woods with a status window and a bus full of strangers. The city that fell is a minute's walk down the old road, and it is crawling with the dead. Build your camp, hunt, raid the city for what it hides, and burn the hives.</p>
      <p class="tiny" style="white-space:normal">There is no bell and no safe hour: you can build, explore and fight at any time. The dead come all day and harder at night. They go for the loudest thing they sense: your camp, or you.</p>
      <details class="news" open><summary>What's new (Oct 19, evening)</summary><ul>
        <li><b>The frontier:</b> a camp in a forest clearing. The city is far down an old road that starts deep in the woods.</li>
        <li><b>The woods:</b> farmsteads, lumber camps, a quarry, a hunting lodge. Deer to hunt, wolves that hunt you.</li>
        <li><b>No day/night split:</b> build, upgrade and explore at any hour. The sun just keeps moving.</li>
        <li><b>Smarter dead:</b> they hunt you in the open. Runners remember where they saw you. Brutes wait on your road home.</li>
        <li><b>Burn hives any time.</b> Then flee: a <b>flare</b> or <b>smoke</b> buys time, or just run.</li>
        <li><b>A map:</b> tap the little map on the left (or press M).</li>
      </ul></details>
      <details class="news"><summary>Earlier today</summary><ul>
        <li>Anime pacing: one new system per episode, each with a System window you read at your own pace.</li>
        <li>A bigger home ward to explore from day 1; far districts are big expeditions that cost supplies.</li>
        <li>Your choices decide your class: Heart, Brawn, Aim or Wits. At level 5, a trial in the city earns it.</li>
        <li>The dead out there hunt you home. Ruined blocks can be knocked down to grow the town your way.</li>
        <li>The sun crosses the sky instead of a timer. Seasons with a rule and a finale every 10 nights.</li>
        <li>Story cards are short pages; the Chronicler (Claude) gets a moment to write instead of swapping text.</li>
      </ul></details>
      <h2>Your hero</h2>
      <p class="tiny" style="white-space:normal">You start as a <b>Survivor</b>. What you do decides what you become: rescues lean to <b>Heart</b>, fighting up close to <b>Brawn</b>, scouting to <b>Aim</b>, deals to <b>Wits</b>. At level 5 a trial earns your Calling (Medic, Brawler, Ranger or Scavver); at 12 your second family makes one of six final classes.</p>
      <h2>Difficulty</h2>
      <div class="choices">${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="choice" data-diff="${k}" aria-pressed="${setup.difficulty === k}"><b>${d.name}</b><span>${d.blurb}</span></button>`).join('')}</div>
      <h2>Your world</h2>
      <div class="choices">${opts.map((o, k) => `<button class="choice" data-map="${k}" aria-pressed="${setup.pick === k}"><canvas id="mm${k}" aria-hidden="true"></canvas><b>${o.name}</b><span>${BIOMES[o.biome].blurb}</span><span class="tiny">Seed ${o.seed}</span></button>`).join('')}</div>
      <div class="seedrow"><button class="btn ghost" id="reroll">Another seed</button></div>
      ${legacyHtml()}
      <label class="tiny aitog" style="display:block;margin-top:12px"><input type="checkbox" id="aiStart" ${chronicler.enabled() ? 'checked' : ''}> ✦ Let the Chronicler (Claude) write your story and play your companions. Uses your Claude account; it asks first. Off = the scripted story.</label>
      <div id="contRow" hidden class="cont"></div>
      <div class="cardrow" style="margin-top:16px"><button class="btn big" id="begin">Raise the town</button><span class="tiny">WASD or drag to walk · scroll or pinch to zoom</span></div>`, true, false);
    opts.forEach((o, k) => drawMinimap($(`#mm${k}`), generateMap(o.seed, o.biome)));
    const press = (sel, b) => $$(sel).forEach(x => x.setAttribute('aria-pressed', x === b));
    $$('[data-hero]').forEach(b => b.onclick = () => { setup.hero = b.dataset.hero; store.set('hero', setup.hero); press('[data-hero]', b); });
    $$('[data-diff]').forEach(b => b.onclick = () => { setup.difficulty = b.dataset.diff; store.set('difficulty', setup.difficulty); press('[data-diff]', b); });
    $$('[data-map]').forEach(b => b.onclick = () => { setup.pick = +b.dataset.map; press('[data-map]', b); });
    $('#aiStart').onchange = e => chronicler.setEnabled(e.target.checked);
    $$('[data-legacy]').forEach(b => b.onclick = () => { const L = store.get('legacy', { fame: 0, owned: {} }), up = LEGACY.find(x => x.id === b.dataset.legacy), n = L.owned[up.id] || 0; if (n >= up.max || L.fame < up.cost) return; L.fame -= up.cost; L.owned[up.id] = n + 1; store.set('legacy', L); audio.play('claim'); showStart(); });
    $('#reroll').onclick = () => { setup.runSeed = Math.floor(Math.random() * 1e6); setup.pick = 0; showStart(); };
    $('#begin').onclick = () => { const o = opts[setup.pick]; begin(o.seed, o.biome); };
    saves.load().then(snap => {
      if (!snap || snap.v !== 3 || card !== 'start' || !$('#contRow')) return;
      const row = $('#contRow'); row.hidden = false;
      row.innerHTML = `<button class="btn big" id="cont">Continue · day ${snap.night} in ${esc(snap.city || 'the city')}</button><span class="tiny">${saves.cloud() ? 'Saved to your account: works on any device' : 'Saved on this device'} · ${new Date(snap.savedAt).toLocaleString()}</span>`;
      $('#cont').onclick = () => begin(snap.mapSeed, snap.biome, snap);
    });
  }

  function legacyHtml() {
    const L = store.get('legacy', { fame: 0, owned: {} }); if (!L.fame && !Object.keys(L.owned).length) return '';
    return `<h2>Legacy · ${L.fame} fame</h2><div class="opts two">${LEGACY.map(u => { const n = L.owned[u.id] || 0; return `<button class="opt" data-legacy="${u.id}" ${n >= u.max || L.fame < u.cost ? 'disabled' : ''}><span class="nm">${u.name} ${n ? `${n}/${u.max}` : ''}<span class="cost">${n >= u.max ? 'max' : `${u.cost} fame`}</span></span><span class="ds">${u.desc}</span></button>`; }).join('')}</div>`;
  }
  function begin(mapSeed, biome, snap = null) {
    game = snap ? createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, mode: 'classic', difficulty: snap.difficulty, restore: snap, legacy: snap.legacy || {} })
      : createGame({ seed: setup.runSeed, mapSeed, biome, hero: 'survivor', mode: 'classic', difficulty: setup.difficulty, legacy: store.get('legacy', { owned: {} }).owned });
    names = regionNames(mapSeed, game.map.regions.length);
    const qp = new URLSearchParams(location.search).get('q');
    if (!view) { view = createView($('#view'), game, { onFlash: () => audio.play('thunder'), quality: qp || store.get('quality', null) || store.get('autoq', null) || undefined }); showQuality(); }
    window.__game = game; window.__view = view; window.__openSel = sel => openSel(sel);
    // [road] begin
    if (roadUI) roadUI.dispose();
    roadUI = createRoadUI({ game, view, toast: (m, k) => toast(m, k), hideCard: () => { hideCard(); paused = false; }, isBusy: () => paused || !!card || !!placing });
    window.__roadUI = roadUI;
    // [road] end
    $('#hud').hidden = false; hideCard(); paused = false; selected = null; placing = null; closePanel();
    $('#ability').hidden = !game.heroDef.ability;
    if (snap) { previouslyOn(); $('#autoBtn').setAttribute('aria-pressed', !!game.state.autopilot); $('#autoTag').hidden = !game.state.autopilot; }
    else toast(`[Day 1 · the woods] You made camp in a **clearing**, far from the city. Your survivors carry plans for a **home**, a **farm** and a **tower**. The woods hide **farms, deer and wolves**; the old road to the city starts **deep in the trees**. Tap the **map** (left) to see where you have been.`, 'sys');
    traderSeen = true; dawnT = 0.3;
  }

  // coming back to a run: "previously on Hollowmere" (Claude tells it when on; else the chronicle's big moments)
  function previouslyOn() {
    const ST = game.state.story, offline = ST.chronicle.filter(c => c.imp >= 3).slice(-3).map(c => `Day ${c.day}: ${c.text}`);
    const show = lines => queueWin({ eyebrow: '[Previously on Hollowmere]', title: `${game.map.name} · day ${game.state.night}`, lines: lines.length ? lines : ['You held the town. The dead did not wait for you.'] });
    if (!chronicler.available()) { show(offline); return; }
    paused = true; chronicler.recap(game.story().fullContext()).then(b => { show(b || offline); paused = false; });
  }
  // the Chronicler invents today's side quest from everything that happened (one a day, from day 2)
  function inventToday() {
    const S = game.state; if (!chronicler.available() || S.night < 2 || S.story.inventDay === S.night || inventToday.busy) return;
    inventToday.busy = true;
    chronicler.invent(game.story().fullContext(), QUEST_TEMPLATES).then(q => { inventToday.busy = false; if (q && game && !game.state.over) game.story().invent(q); });
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
    if (S.over) return;
    paused = true; if (placing) stopPlacing(); closePanel();
    if (S.pendingPicks > 0 && S.offer.length) return showPerks();
    if (S.story.encounters.length) return showEncounter();
    if (S.packs.length) return showPacks();
    if (S.trade && !S.trade.done && !traderSeen) { traderSeen = true; return showTrader(); }
    hideCard(); paused = false;
    if (S.mode === 'packs' && stockTotal() > 0) toast('Pick a building in the tray to place it.');
  }
  const needsDawn = () => { const S = game.state; return !S.over && ((S.pendingPicks > 0 && S.offer.length) || S.story.encounters.length || S.packs.length || (S.trade && !S.trade.done && !traderSeen)); };

  const sourceLabel = { dawn: 'Dawn blessing', chest: 'From a chest', nest: 'The hive burns · a blessing', 'manual:hero': 'Field manual · Brawn', 'manual:ranger': 'Field manual · Aim', 'manual:scavver': 'Field manual · Wits', 'manual:heart': 'Field manual · Heart', 'manual:bow': 'Field manual · Bow', 'manual:stone': 'Field manual · Stone', 'manual:harvest': 'Field manual · Harvest' };
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
      <h1 class="sm">${isMastery ? 'Choose a mastery' : 'A blessing'}</h1>${isMastery ? '' : '<p class="tiny" style="white-space:normal">Blessings come only at special moments: a hive burned, a key level (5, 10, 15…), a unique monster, a rare find.</p>'}
      <div class="perks${src === 'nest' ? ' epic' : ''}">${cards}</div>
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
      <div class="cardrow spread"><span class="tiny">${stockTotal() ? `Still unplaced: ${Object.entries(S.stock).filter(([, n]) => n).map(([t, n]) => `${n} ${n > 1 ? PLURAL[t].toLowerCase() : SHORT[t].toLowerCase()}`).join(', ')}` : 'You place them for free. More cost double scrap.'}</span>
      <button class="btn ghost" id="packReroll" ${S.gold < 5 ? 'disabled' : ''}>Other packs · <span class="dot gold"></span> 5</button></div>`);
    $$('[data-pack]').forEach(b => b.onclick = onArmed(() => { game.choosePack(b.dataset.pack); dawnFlow(); }));
    $('#packReroll').onclick = onArmed(() => { if (game.rerollPacks()) showPacks(); });
  }
  // ---------- story: encounters, the status window, companions ----------
  const esc = t => String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // encounters read like a visual novel: the scene in short pages (tap to go on), the choices on the last page.
  // With the Chronicler on, the card waits for Claude's version (a few seconds at most) instead of swapping text later.
  const encPage = new Map(), aiBusy = new Set(), AI_WAIT = 9000; let aiTimer = 0;
  function pagesOf(text) {
    const sents = String(text || '').replace(/\n+/g, ' ').split(/(?<=[.!?…"”\]])\s+(?=[A-Z"“[*(])/).filter(Boolean), out = []; let cur = '', n = 0;
    for (const x of sents) { if (cur && (cur.length + x.length > 150 || n >= 2)) { out.push(cur); cur = x; n = 1; } else { cur = cur ? `${cur} ${x}` : x; n++; } }
    if (cur) out.push(cur); return out.length ? out : [''];
  }
  const aiSkips = new Set(['gift', 'evolve', 'season', 'chapter', 'district']);
  function aiFetch(enc) {
    if (!enc || enc.ai != null || !chronicler.available() || aiSkips.has(enc.kind)) return;
    enc.ai = 'pending'; enc.aiAt = performance.now(); const id = enc.id; aiBusy.add(id);
    chronicler.rewrite(enc, game.story().context()).then(patch => {
      aiBusy.delete(id); enc.ai = patch || 'none';
      const top = game.state.story.encounters[0]; if (card === 'enc' && top && top.id === id && !encPage.has(id)) showEncounter();
    });
  }
  // cause → consequence: every choice shows what it does as coloured chips (green gains, red costs)
  function chipsOf(c) {
    const S = game.state, out = [], add = (cls, t) => out.push(`<span class="chip ${cls}">${t}</span>`), sg = n => (n > 0 ? `+${n}` : `−${-n}`);
    if (c.cost && c.cost.gold) add('neg', `<i class="dot gold"></i>−${c.cost.gold}`);
    if (c.cost && c.cost.food) add('neg', `<i class="dot food"></i>−${c.cost.food}`);
    const PERK = { heroDmg: '⚔ hero', heroDmgMult: '⚔ hero', keepHp: '🏰 hall', heroHp: '❤ hero', towerDmg: '🗼 towers', heroSpeed: '👟 speed' };
    for (const f of c.fx || []) {
      if (f.op === 'gold') add(f.n > 0 ? 'pos' : 'neg', `<i class="dot gold"></i>${sg(f.n)}`);
      else if (f.op === 'food') add(f.n > 0 ? 'pos' : 'neg', `<i class="dot food"></i>${sg(f.n)}`);
      else if (f.op === 'survivors') add(f.n > 0 ? 'pos' : 'neg', `👥 ${sg(f.n)}`);
      else if (f.op === 'heat' && S.feat.heat) add(f.n > 0 ? 'neg' : 'pos', `🔥 ${sg(f.n)}`);
      else if (f.op === 'power') add('pos', `⚡ +${f.n}`);
      else if (f.op === 'hands') add('pos', `✋ +${f.n} for good`);
      else if (f.op === 'handsToday') add(f.n > 0 ? 'pos' : 'neg', `✋ ${sg(f.n)} today`);
      else if (f.op === 'perk' && PERK[f.key]) add(f.mul && f.mul < 1 ? 'neg' : 'pos', `${PERK[f.key]} ↑`);
      else if (f.op === 'flag' && f.key === 'beacon') add('pos', '👥 +1 later');
      else if (f.op === 'flag' && f.key === 'garden') add('pos', '<i class="dot food"></i>+1 / dawn');
      else if (f.op === 'flag' && f.key === 'scout') add('info', '🗺 better route');
      else if (f.op === 'flag' && f.key === 'quiet') add('pos', '🔇 quieter');
      else if (f.op === 'title') add('info', '🏅 title');
      else if (f.op === 'blessing') add('pos', '✦ blessing');
      else if (f.op === 'openFor' || f.op === 'open') add('info', '🗺 opens a district');
      else if (f.op === 'recruit' || f.op === 'recruitNew') add('pos', `★ ${c.npcName || 'joins you'}`);
      else if (f.op === 'lose') add('neg', '💔 leaves');
      else if (f.op === 'bond') add(f.n > 0 ? 'pos' : 'neg', `♥ ${sg(f.n)}`);
      else if (f.op === 'gamble') add('risk', `🎲 ${Math.round(f.p * 100)}%`);
      else if (f.op === 'risen') add('neg', '☠ the dead rise');
      else if (f.op === 'hurt') add('neg', '🩸 you get hurt');
      else if (f.op === 'unique') add('risk', '👁 boss fight');
      else if (f.op === 'fail') add('risk', f.after ? '⌛ they may not wait' : '✖ the story ends');
      else if (f.op === 'trial') add('info', '⚔ trial');
      else if (f.op === 'claimSite') add('pos', '🏳 yours for good');
      else if (f.op === 'stripSite') add('pos', `<i class="dot gold"></i>+${f.n}`);
    }
    return out.length ? `<span class="chips">${out.join('')}</span>` : '';
  }
  function showEncounter() {
    const S = game.state, enc = S.story.encounters[0]; if (!enc) return dawnFlow();
    paused = true; if (placing) stopPlacing(); closePanel();
    if (enc.ai === 'pending' && !aiBusy.has(enc.id)) enc.ai = null;   // a request lost to a reload
    aiFetch(enc);
    const sys = enc.kind === 'gift' || enc.kind === 'evolve' || enc.kind === 'season' || (enc.kind === 'thread' && /^\[/.test(enc.eyebrow));
    const badge = st => (chronicler.available() && !aiSkips.has(enc.kind) ? `<span class="chr${st ? ' busy' : ''}" title="The Chronicler (Claude) writes this run's story">✦ ${st || 'Chronicler'}</span>` : '');
    if (enc.ai === 'pending' && performance.now() - enc.aiAt < AI_WAIT) {
      showCard('enc', `<div class="enc ${enc.kind}${sys ? ' sysw' : ''}"><div class="eyebrow sysline">${esc(enc.eyebrow || '')}${badge('writing…')}</div>
        <h1 class="sm">${esc(enc.title)}</h1><div class="writing" aria-label="The System is writing"><i></i><i></i><i></i></div>
        <p class="tiny" style="white-space:normal">The Chronicler is writing this moment from your story…</p>
        <div class="cardrow"><button class="btn ghost" id="encPlain">Read the plain version</button></div></div>`, true, false);
      $('#encPlain').onclick = () => { enc.ai = 'none'; showEncounter(); };
      clearTimeout(aiTimer); aiTimer = setTimeout(() => { const top = game.state.story.encounters[0]; if (card === 'enc' && top === enc && enc.ai === 'pending') { enc.ai = 'none'; showEncounter(); } }, AI_WAIT - (performance.now() - enc.aiAt) + 30);
      return;
    }
    const P = enc.ai && typeof enc.ai === 'object' ? enc.ai : null;
    const title = P ? P.title : enc.title, line = P && P.line ? P.line : enc.speaker && enc.speaker.line;
    const pages = P && P.beats && P.beats.length ? P.beats : pagesOf(P ? P.scene : enc.scene);
    const first = !encPage.has(enc.id), pg = Math.min(encPage.get(enc.id) || 0, pages.length - 1), last = pg >= pages.length - 1;
    const costTxt = c => !c.cost ? '' : [c.cost.gold ? `<span class="dot gold"></span>${c.cost.gold}` : '', c.cost.food ? `<span class="dot food"></span>${c.cost.food}` : ''].filter(Boolean).join(' ');
    const dots = pages.length > 1 ? `<div class="pgdots">${pages.map((_, k) => `<i class="${k === pg ? 'on' : k < pg ? 'past' : ''}"></i>`).join('')}</div>` : '';
    const opts = last ? `<div class="opts one encopts">${enc.choices.map(c => { const ok = !c.cost || game.story().can(c); const rar = c.rarity ? RARITY[c.rarity] : null;
        return `<button class="opt${rar ? ' rar' : ''}" data-choice="${c.id}" ${ok ? '' : 'disabled'} ${rar ? `style="--rar:${rar.color}"` : ''}><span class="nm"><span>${esc(P && P.labels[c.id] || c.label)}</span>${rar ? `<span class="rarity">${rar.name}</span>` : ''}</span>${chipsOf(c)}<span class="ds">${richHint(c.hint || '')}</span></button>`; }).join('')}</div>`
      : `<div class="cardrow spread"><button class="btn ghost sm" id="encSkip">Skip to the choice</button><button class="btn big" id="encNext">Continue ▸</button></div>`;
    showCard('enc', `<div class="enc ${enc.kind}${sys ? ' sysw' : ''}"><div class="eyebrow sysline">${esc(enc.eyebrow || '')}${badge(P ? '' : '')}</div>
      <h1 class="sm">${esc(title)}</h1>
      ${enc.speaker && pg === 0 ? `<div class="speaker"><b>${esc(enc.speaker.name)}</b><span>${rich(line || '')}</span></div>` : ''}
      <p class="scene page" id="encScene">${rich(pages[pg])}</p>${dots}${opts}</div>`, true, first || last);
    const next = () => { encPage.set(enc.id, pg + 1); showEncounter(); };
    if (!last) { $('#encNext').onclick = onArmed(next); $('#encScene').onclick = onArmed(next); $('#encSkip').onclick = onArmed(() => { encPage.set(enc.id, pages.length - 1); showEncounter(); }); }
    $$('[data-choice]').forEach(b => b.onclick = onArmed(() => { if (P && P.chronicle) enc.aiChron = P.chronicle; if (game.choose(b.dataset.choice)) { encPage.delete(enc.id); audio.play('claim'); afterEncounter(); } }));
  }
  function afterEncounter() { if (game.state.story.encounters.length) showEncounter(); else { dawnFlow(); if (!needsDawn()) { hideCard(); paused = false; } } }

  function showStatus() {
    const S = game.state, ST = S.story, comp = ST.npcs.filter(n => n.joined && n.alive);
    paused = true; if (placing) stopPlacing(); closePanel();
    const hero = game.heroDef;
    showCard('status', `<button class="closex" id="stX" aria-label="Close">&times;</button><div class="enc sysw"><div class="eyebrow sysline">[Status]</div>
      <h1 class="sm">${esc(hero.name)} · day ${S.night}</h1>
      <div class="tiny" style="white-space:normal;margin:-4px 0 8px">Season ${S.season.n}: ${esc(S.season.name)}${ST.episode ? ` · Episode ${ST.episode.n}: ${esc(ST.episode.title)}` : ''}${S.season.rule ? ` · ${esc(RULES[S.season.rule].name)}` : ''}</div>
      <div class="statgrid"><span>Level <b>${S.lvl} · ${S.xp}/${game.xpNext()} xp</b></span><span>Health <b>${Math.ceil(S.hero.hp)}/${S.hero.maxHp}</b></span><span>Kills <b>${S.kills}</b></span><span>People <b>${game.pop()}</b></span><span>Districts <b>${game.map.regions.filter(r => !S.sealed[r.id]).length}/${game.map.regions.length}</b></span><span>Heat <b>${Math.round(S.heat)}</b></span><span>Power <b>${game.powerIn()}/${game.powerOut()}</b></span></div>
      <h2>Your path</h2>${pathHtml()}
      <h2>Titles</h2><div class="titles">${ST.titles.length ? ST.titles.map(t => `<span class="title" title="${esc(TITLES[t].desc)}">${esc(TITLES[t].name)}</span>`).join('') : '<span class="tiny">None yet. The System is watching.</span>'}</div>
      <h2>Companions</h2><div class="comps">${comp.length ? comp.map(n => `<div class="comp"><b>${esc(n.name)}</b><span>${n.withHero ? 'Travels with you · post empty' : `${esc(ROLES[n.role].post)} · ${esc(ROLES[n.role].bonus)}`}</span><span class="bond">${'♥'.repeat(Math.max(0, n.bond))}${'♡'.repeat(Math.max(0, 5 - n.bond))}</span><span class="acts"><button class="btn sm" data-chat="${n.id}">Talk</button><button class="btn sm ghost" data-follow="${n.id}" data-on="${n.withHero ? 0 : 1}">${n.withHero ? 'Back to post' : 'With me'}</button></span></div>`).join('') : '<span class="tiny">Nobody yet. Answer the calls: people are out there.</span>'}</div>
      <h2>Chronicle</h2><ol class="chron">${ST.chronicle.slice().reverse().slice(0, 14).map(c => `<li><span>Day ${c.day}</span>${esc(c.text)}</li>`).join('')}</ol>
      <div class="tiny" style="margin:6px 0;white-space:normal">${lastSave ? `Saved at dawn of day ${lastSave.day} (${lastSave.where === 'cloud' ? 'your account: any device' : 'this device'})` : 'The run saves itself every dawn.'}</div>
      <div class="cardrow spread"><label class="tiny aitog"><input type="checkbox" id="aiTog" ${chronicler.enabled() ? 'checked' : ''}> Chronicler (Claude writes the story) · ${({ on: 'on', off: 'off', denied: 'not allowed', absent: 'not available here' })[chronicler.status()]}</label><button class="btn" id="stClose">Back</button></div></div>`, true, false);
    $('#stClose').onclick = $('#stX').onclick = () => { hideCard(); paused = false; };
    $('#aiTog').onchange = e => { chronicler.setEnabled(e.target.checked); };
    $$('[data-chat]').forEach(b => b.onclick = () => showChat(b.dataset.chat));
    $$('[data-follow]').forEach(b => b.onclick = () => { game.companionFollow(b.dataset.follow, b.dataset.on === '1'); showStatus(); });
  }
  // the path: what your choices say you are becoming
  function pathHtml() {
    const S = game.state, P = S.path, tot = Object.values(P).reduce((a, b) => a + b, 0) || 1, cls = S.heroClass;
    const next = cls === 'survivor' ? `At level 5 the System offers the class your path points to (level ${S.lvl} now).` : !HEROES[cls].base ? 'At level 12 your second family decides your final class.' : 'Your class is complete.';
    const tr = S.story.trial && !S.story.trial.done ? `<div class="tiny" style="white-space:normal;color:#ff9a80">${esc(S.story.trial.name)} waits at the red marker.</div>` : '';
    return `<div class="path">${['hero', 'ranger', 'scavver', 'heart'].map(f => `<div class="pr" style="--fam:${FAMILIES[f].color}"><span>${FAMILIES[f].name}<i>${FAMILIES[f].path}</i></span><span class="pb"><i style="width:${Math.round(P[f] / tot * 100)}%"></i></span><b>${Math.round(P[f] / tot * 100)}%</b></div>`).join('')}</div>
      <div class="tiny" style="white-space:normal;margin-top:4px">Rescues and mercy lean to Heart, fighting up close to Brawn, scouting and quiet to Aim, deals and salvage to Wits. ${next}</div>${tr}`;
  }
  const chats = {};
  function showChat(id) {
    const S = game.state, n = game.story().npc(id); if (!n) return;
    const hist = chats[id] || (chats[id] = []);
    const ai = chronicler.available(), left = Math.max(0, 6 - n.chatToday);
    const bark = k => { const L = BARKS[k]; const t = L[(n.chatToday + hist.length + n.id.length) % L.length]; const open = S.landmarks.filter(l => !S.sealed[l.region] && l.kind !== 'unknown'); return t.replace('{want}', n.persona.want).replace('{fear}', n.persona.fear).replace('{heat}', Math.round(S.heat)).replace('{pop}', game.pop()).replace('{district}', open.length ? 'The street by the ' + open[open.length - 1].kind : 'The fence'); };
    showCard('chat', `<button class="closex" id="chX" aria-label="Back">&times;</button><div class="enc chat"><div class="eyebrow">${esc(ROLES[n.role].post)} · bond ${n.bond}/5${n.named ? ' · named' : ''}</div><h1 class="sm">${esc(n.name)}</h1>
      <p class="tiny">${esc(n.persona.traits.join(', '))} · ${esc(n.persona.quirk)}</p>
      <div class="msgs" id="msgs">${hist.map(m => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('') || `<div class="msg assistant">${esc(bark('you'))}</div>`}</div>
      ${ai ? `<form class="say" id="sayForm"><input id="sayIn" maxlength="160" autocomplete="off" placeholder="${left ? 'Say something…' : `${n.name.split(' ')[0]} has work to do. Tomorrow.`}" ${left ? '' : 'disabled'}><button class="btn" ${left ? '' : 'disabled'}>Say</button></form><div class="tiny">${left} more ${left === 1 ? 'talk' : 'talks'} today</div>`
        : `<div class="topics"><button class="btn ghost" data-topic="self">About you</button><button class="btn ghost" data-topic="city">The city</button><button class="btn ghost" data-topic="you">About me</button></div>`}
      <div class="cardrow" style="margin-top:10px"><button class="btn ghost" id="chatBack">Back</button></div></div>`, true, false);
    const box = $('#msgs'); box.scrollTop = box.scrollHeight;
    $('#chatBack').onclick = $('#chX').onclick = () => showStatus();
    $$('[data-topic]').forEach(b => b.onclick = () => { hist.push({ role: 'user', content: b.textContent }, { role: 'assistant', content: bark(b.dataset.topic) }); showChat(id); });
    const form = $('#sayForm');
    if (form) form.onsubmit = async e => {
      e.preventDefault(); const t = $('#sayIn').value.trim(); if (!t || n.chatToday >= 6) return;
      n.chatToday++; hist.push({ role: 'user', content: t }); showChat(id); const b = $('#msgs'); b.insertAdjacentHTML('beforeend', '<div class="msg assistant typing">…</div>'); b.scrollTop = b.scrollHeight;
      const r = await chronicler.chat({ ...n, roleName: ROLES[n.role].post }, hist.slice(-8), game.story().context());
      hist.push({ role: 'assistant', content: r ? r.say : `(${n.name.split(' ')[0]} looks at you for a long moment and says nothing.)` });
      if (r && r.remember) { n.memory.push(r.remember); if (n.memory.length > 8) n.memory.shift(); }
      if (r && r.mood === 'warm' && n.bondedToday !== S.night) { n.bondedToday = S.night; if (n.bond < 3) n.bond++; }
      if (card === 'chat') showChat(id);
    };
    if (form) setTimeout(() => $('#sayIn') && $('#sayIn').focus(), 50);
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
    return `<div class="logwrap"><table class="log"><thead><tr><th>Night</th><th>Keep left</th><th>Threat</th><th>Wave HP</th><th>Tower DPS</th><th>Kills hero·tower·keep</th><th>Lost</th><th>Scrap in / spent</th><th>Siege</th><th>Blessings</th></tr></thead><tbody>${rows.map(l => {
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
    paused = true; closePanel(); if (placing) stopPlacing();
    showCard('log', `<button class="closex" id="logX" aria-label="Close">&times;</button><div class="eyebrow">Run log · night ${game.state.night}</div><h1 class="sm">The town ledger</h1>${logTable()}
      <div class="cardrow"><button class="btn" id="logCopy">Copy log</button><button class="btn ghost" id="logClose">Back to town</button></div><textarea id="logJson" hidden readonly aria-label="Run log data"></textarea>`, true, false);
    $('#logCopy').onclick = e => copyLog(e.currentTarget);
    $('#logClose').onclick = $('#logX').onclick = () => { hideCard(); paused = false; };
  }
  function showEnd() {
    const S = game.state, st = S.stats, held = S.night - 1, prev = store.get('best', 0), best = Math.max(prev, S.night);
    store.set('best', best);
    const kills = Object.values(st.killsByKind).reduce((a, b) => a + b, 0);
    const topKinds = Object.entries(st.killsByKind).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${n} ${(MOBS[k] && MOBS[k].name || k).toLowerCase()}${n > 1 ? 's' : ''}`).join(' · ');
    const by = st.killsBy, heroShare = kills ? Math.round((by.hero || 0) / kills * 100) : 0;
    const stats = [
      ['Nights held', held], ['Dead put down', kills], ['Scrap earned', st.goldEarned], ['Buildings raised', st.built],
      ['Districts opened', st.districts || 0], ['Sites claimed', st.sites || 0], ['Companions', S.story.npcs.filter(n => n.joined).length], ['Titles', S.story.titles.length],
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
      <p class="tiny" style="white-space:normal">+${S.fameEarned || 0} fame. Spend it under Legacy on the start screen: small edges for the next run.</p>
      <h2>The chronicle of ${esc(game.map.name)}</h2><ol class="chron">${S.story.chronicle.filter(c => c.imp >= 3).slice(-12).map(c => `<li><span>Day ${c.day}</span>${esc(c.text)}</li>`).join('')}</ol>
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
  // a message that starts with [Something] is the System talking: it gets its own window
  // kind 'win': the System opens a window that waits for you (read it at your own pace)
  function toast(msg, kind) {
    const sys = /^\[[^\]]+\]/.exec(msg);
    if (kind === 'win') { const body = sys ? msg.slice(sys[0].length).trim() : msg; queueWin({ eyebrow: sys ? sys[0] : '[System]', lines: body.split(/(?<=[.!?])\s+(?=[A-Z*"])/).filter(Boolean) }); return; }
    const el = document.createElement('div');
    el.className = 'toast' + (sys || kind === 'sys' ? ' sys' : '') + (kind && kind !== 'sys' ? ' ' + kind : '');
    if (sys) { const h = document.createElement('span'); h.className = 'sh'; h.textContent = sys[0]; const b = document.createElement('span'); b.innerHTML = rich(msg.slice(sys[0].length).trim()); el.append(h, b); }
    else el.innerHTML = rich(msg);
    el.dataset.ms = Math.max(sys ? 7000 : 4500, msg.split(/\s+/).length * 330);
    toastQ.push(el); if (toastQ.length > 6) toastQ.splice(0, toastQ.length - 6); pumpToasts();
  }
  // phones show one toast at a time (desktop three); the rest wait their turn instead of being dropped
  const toastQ = [];
  function pumpToasts() {
    const box = $('#toasts'), cap = document.body.classList.contains('compact') ? 1 : 3;
    while (toastQ.length && box.children.length < cap) {
      const el = toastQ.shift(), done = () => { if (!el.parentNode) return; el.style.opacity = '0'; setTimeout(() => { el.remove(); pumpToasts(); }, 400); };
      el.onclick = () => { el.remove(); pumpToasts(); }; box.appendChild(el); setTimeout(done, +el.dataset.ms);
    }
  }
  // **bold** in System text, and the numbers of a choice in bold
  const rich = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const richHint = t => rich(t).replace(/(^|[\s(])([+\-−]\s?\d+%?\s(?:more\s)?(?:scrap|food|people|person|heat|power|pairs? of hands|bond|health|damage|hero damage|keep health))/gi, '$1<b>$2</b>');
  const wins = [];
  function queueWin(w) { if (!wins.some(x => x.eyebrow === w.eyebrow && x.title === w.title)) wins.push(w); }
  function showWin() {
    const w = wins.shift(); if (!w) return; paused = true; if (placing) stopPlacing(); closePanel();
    showCard('win', `<div class="enc sysw win"><div class="eyebrow sysline">${esc(w.eyebrow || '[System]')}</div>${w.title ? `<h1 class="sm">${esc(w.title)}</h1>` : ''}
      <ul class="winl">${(w.lines || []).map(l => `<li>${rich(l)}</li>`).join('')}</ul>
      <div class="cardrow"><button class="btn big" id="winOk">${wins.length ? `Next · ${wins.length} more` : 'Got it'}</button></div></div>`, true);
    $('#winOk').onclick = onArmed(() => { if (wins.length) showWin(); else { hideCard(); paused = false; } });
  }

  // a hive burns: its dead pour out after you. A flare or smoke buys time.
  function showEscape() {
    const S = game.state, E = S.escape; if (!E) return;
    paused = true; if (placing) stopPlacing(); closePanel();
    const n = E.horde.length, F = ESCAPE.flare, Sm = ESCAPE.smoke, Rn = ESCAPE.run;
    const b = (id, name, cost, unit, desc, off) => `<button class="opt esc" data-esc="${id}" ${off ? 'disabled' : ''}><span class="nm">${name}${cost ? `<span class="cost"><span class="dot ${unit === 'scrap' ? 'gold' : 'food'}"></span>${cost}</span>` : ''}</span><span class="ds">${rich(desc)}${off ? ` <b class="bad">Not enough ${unit}.</b>` : ''}</span></button>`;
    showCard('escape', `<div class="enc sysw"><div class="eyebrow sysline">[System] The hive is ash</div><h1 class="sm"><b>${n} dead</b> pour out after you</h1>
      <p class="tiny" style="white-space:normal">They will hunt you until you lose them or reach your walls. What do you do?</p>
      <div class="opts one">${b('flare', `🔥 ${F.name}`, F.cost, 'scrap', F.desc, S.gold < F.cost)}${b('smoke', `💨 ${Sm.name}`, Sm.cost, 'food', Sm.desc, S.food < Sm.cost)}${b('run', `🏃 ${Rn.name}`, 0, '', Rn.desc, false)}</div></div>`, true);
    $$('[data-esc]').forEach(x => x.onclick = onArmed(() => { if (game.escape(x.dataset.esc)) { flushToasts(); hideCard(); paused = false; } }));
  }

  // every dawn is an episode: a title card, like an anime eyecatch
  function showEpisode(e) {
    const el = $('#episode'); if (!el) return;
    el.innerHTML = `<span class="ep">Season ${e.season} · Episode ${e.n}</span><b>${esc(e.title)}</b>`; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    dawnT = Math.max(dawnT, 2.4); clearTimeout(showEpisode.t); showEpisode.t = setTimeout(() => { el.hidden = true; }, 2600);
  }
  // ---------- build tray and placement ----------
  const stockTotal = () => Object.values(game.state.stock).reduce((a, b) => a + b, 0);
  const priceOf = t => (game.state.stock[t] || 0) > 0 ? 0 : game.buyCost(t);
  let trayKey = '';
  function renderTray() {
    const S = game.state, tray = $('#tray');
    tray.hidden = !!card;
    if (tray.hidden) { trayKey = ''; return; }
    const hands = game.handsFree();
    const sig = [S.gold, JSON.stringify(S.stock), placing && placing.type, S.builders, S.foreman, S.autopilot, S.feat.power, game.keepLevel(), S.buildings.length, hands].join('|'); if (sig === trayKey) return; trayKey = sig;
    const FOCUS = { defence: 'Defence', balanced: 'Balanced', growth: 'Growth', off: 'Off' };
    const bRow = S.foreman || S.autopilot ? `<div class="builders" role="group" aria-label="What your builders focus on"><span>Foreman</span>${Object.entries(FOCUS).map(([k, v]) => `<button data-focus="${k}" aria-pressed="${(S.builders || 'off') === k}">${v}</button>`).join('')}</div>` : '';
    const hRow = `<div class="hands${hands ? '' : ' none'}">✋ ${hands ? `${hands} free ${hands === 1 ? 'pair' : 'pairs'} of hands today` : 'No free hands left today: they rest at dawn. More homes, more hands.'}</div>`;
    tray.innerHTML = bRow + hRow + BUILD_ORDER.filter(t => t !== 'generator' || S.feat.power).map(t => {
      const n = S.stock[t] || 0, cost = n ? 0 : game.buyCost(t), on = placing && placing.type === t;
      return `<button class="tb ${t}${on ? ' on' : ''}${n ? ' have' : ''}" data-tray="${t}" ${(!n && S.gold < cost) || !hands ? 'aria-disabled="true"' : ''}><i></i><span class="tn">${SHORT[t]}</span>${n ? `<span class="tc">×${n}</span>` : `<span class="cost"><span class="dot gold"></span>${cost}</span>`}</button>`;
    }).join('') + TECH_ORDER.map(t => {
      const have = S.buildings.some(b => b.type === t), locked = game.keepLevel() < BUILDINGS[t].keep, cost = game.buyCost(t), on = placing && placing.type === t;
      if (have || game.keepLevel() < 2) return '';
      return `<button class="tb tech ${t}${on ? ' on' : ''}" data-tray="${t}" ${locked || S.gold < cost || !hands ? 'aria-disabled="true"' : ''} title="${BUILDINGS[t].desc[0]}"><i></i><span class="tn">${SHORT[t]}</span>${locked ? '<span class="tc">Keep 2</span>' : `<span class="cost"><span class="dot gold"></span>${cost}</span>`}</button>`;
    }).join('');
  }
  // compact layout (phones): a Build button opens the building drawer; a ⋯ button holds the rarely used controls
  const setCompact = () => document.body.classList.toggle('compact', innerWidth < 700 || (matchMedia('(pointer: coarse)').matches && innerWidth < 1000));
  setCompact(); addEventListener('resize', setCompact);
  function setDrawer(open) { $('#tray').classList.toggle('open', open); $('#buildBtn').setAttribute('aria-expanded', open); if (open) { closePanel(); renderTray(); } dockH(); }
  $('#buildBtn').onclick = () => setDrawer(!$('#tray').classList.contains('open'));
  $('#menuBtn').onclick = () => { const side = $('.side'), open = !side.classList.contains('open'); side.classList.toggle('open', open); $('#menuBtn').setAttribute('aria-expanded', open); };
  $('#tray').addEventListener('click', e => {
    const f = e.target.closest('[data-focus]'); if (f && game) { game.setBuilders(f.dataset.focus); trayKey = ''; renderTray(); toast(f.dataset.focus === 'off' ? 'The Foreman stands down. You build by hand.' : `The Foreman builds by himself now: ${f.dataset.focus}.`); return; }
    const b = e.target.closest('[data-tray]'); if (!b || !game || paused) return;
    const t = b.dataset.tray;
    if (placing && placing.type === t) { stopPlacing(); return; }
    if (BUILDINGS[t].tech && game.keepLevel() < BUILDINGS[t].keep) { toast(`Raise the keep to level ${BUILDINGS[t].keep} to build a ${SHORT[t]}.`, 'bad'); return; }
    if (!(game.state.stock[t] > 0) && game.state.gold < game.buyCost(t)) { toast(`A ${SHORT[t].toLowerCase()} costs ${game.buyCost(t)} scrap.`, 'bad'); return; }
    if (game.handsFree() < 1) { toast('No free hands left today. They rest at dawn; more homes give more hands.', 'bad'); return; }
    startPlacing(t);
  });
  // Placement works like a classic RTS: the land you can build on lights up, the building in hand
  // snaps to the nearest spot that fits (preferring spots that line up with a street), and
  // palisades are laid as lines: pick where the line starts, then where it ends.
  const SIZE = { house: 2, farm: 2, tower: 1, wall: 1, workshop: 3, market: 3, generator: 2 };
  const cellOf = (x, y) => [Math.floor(x), Math.floor(y)];
  function computeZone(type) {
    const S = game.state, n = SIZE[type], off = n % 2 ? 0.5 : 0, mask = new Uint8Array(N * N), spots = [];
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (!game.zone()[idx(x, y)]) continue;
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
    setDrawer(false);
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
    placing.ghost = { type: t, x: p.x, y: p.y, rot: 0, ok: p.ok, cells: p.cells, lot: (p.lot || []).filter(i => !p.cells.includes(i)) };
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
    $('#placeInfo').innerHTML = n ? `${n} ${n === 1 ? 'post' : 'posts'}${inHand ? ` · ${inHand} from your packs` : ''}${paid ? ` · <span class="dot gold"></span> ${paid * game.buyCost('wall')}` : ''}` : `<span class="warn">${budget ? 'Nothing fits along this line.' : `Out of posts. One costs ${game.buyCost('wall')} scrap.`}</span>`;
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
    return [S.gold, S.food, S.phase, S.purge, S.halfUpgrade, S.trade && S.trade.done, selected && selected.type, selected && selected.id, scavSig(), selected && selected.type === 'landmark' ? game.landmarkReach(selected.id) : '', b ? `${b.level}:${Math.ceil(b.hp)}:${b.maxHp}:${Math.floor((b.built ?? 1) * 20)}` : ''].join('|');
  }
  function openSel(sel) { if ($('#tray').classList.contains('open')) { $('#tray').classList.remove('open'); $('#buildBtn').setAttribute('aria-expanded', false); } selected = sel; renderPanel(); lastSig = panelSig(); $('#panel').hidden = false; dockH(); }
  function closePanel() { selected = null; $('#panel').hidden = true; dockH(); }
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
    let html = `<div class="stat"><span>Searches left <b>${Math.max(0, info.left)}</b></span><span>Each survivor brings about <b>${R.gold[0]}–${R.gold[1]}</b> scrap and <b>${R.food[0]}–${R.food[1]}</b> food. Maybe free buildings, a new survivor${R.relic ? ', a rare blessing' : ''}.</span></div>`;
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
      const acts = c.bitten ? `<button class="btn sm" data-treat="${c.id}" data-how="food" ${S.food < TREAT.food ? 'disabled' : ''}>Treat · ${TREAT.food} food</button><button class="btn sm" data-treat="${c.id}" data-how="gold" ${S.gold < TREAT.gold ? 'disabled' : ''}>Treat · ${TREAT.gold} scrap</button><button class="btn sm ghost" data-exile="${c.id}">Turn out</button>` : '';
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
    const S = game.state, body = $('#pBody'), day = !S.over;   // no day/night split: everything works at any hour
    if (selected.type === 'keep') {
      const k = S.keep, l = k.level;
      $('#pEyebrow').textContent = 'Town centre'; $('#pTitle').textContent = `Keep · level ${l}`;
      let html = `<div class="stat"><span>Health <b>${Math.ceil(k.hp)} / ${k.maxHp}</b></span><span>${KEEP.desc[l - 1]}</span></div><div class="opts two">`;
      const miss = l < 3 ? game.keepNeeds() : [];
      html += l < 3 ? opt('opt-keep', 'data-keep="1"', 'Raise the town hall', KEEP.cost[l], miss.length ? `Still needed: ${miss.join(' · ')}` : `${KEEP.desc[l]} · buildings up to level ${l + 1} · march on ${l + 1 >= 3 ? 'far' : 'near'} hives`, miss.length > 0 || S.gold < KEEP.cost[l] || !day) : '';
      if (S.trade && !S.trade.done && day) html += opt('opt-trader', 'data-trader="1"', 'Visit the trader', null, 'One deal before nightfall.', false);
      body.innerHTML = html + '</div>' + (l >= 3 ? '<div class="tiny">The keep is at its full height.</div>' : '');
      selected.range = KEEP.range[l - 1] + S.P.towerRange;
      return;
    }
    if (selected.type === 'region' && S.sealed[selected.id]) {
      const known = S.kits[selected.id]; $('#pEyebrow').textContent = 'Sealed district'; $('#pTitle').textContent = names[selected.id];
      body.innerHTML = `<div class="stat"><span>Behind the quarantine fence${known ? ` · scouts say: <b>${known === 'signature' ? 'a landmark' : (KITS[known] || {}).name || known}</b>` : ''}</span></div><div class="tiny" style="white-space:normal">Districts open through the story: your scouts offer a route every other dawn, and some calls cut a way straight to where you are needed. You cannot walk in until then. The dead can.</div>`;
      return;
    }
    if (selected.type === 'region') {
      const info = game.regionInfo(selected.id), reg = game.map.regions[selected.id];
      $('#pEyebrow').textContent = `${names[selected.id]} · ${S.sealed[selected.id] ? 'sealed' : RINGS[Math.min(3, reg.ring)]}`;
      $('#pTitle').textContent = info.nest ? `Hive: ${hiveName(game.map.seed, selected.id)} · ${info.active ? 'awake' : 'asleep'}` : names[selected.id];
      const land = [info.forest > 40 ? 'deep forest' : info.forest > 15 ? 'woods' : 'open fields', info.water ? 'water' : null].filter(Boolean).join(' · ');
      let html = `<div class="stat"><span>${land}</span>${info.wakes ? `<span>Wakes <b>${info.wakes}</b> more ${info.wakes === 1 ? 'hive' : 'hives'} beyond it</span>` : ''}</div>`;
      if (info.nest) html += game.keepLevel() < info.needKeep ? `<div class="tiny">Too strong for now: <b>raise the town hall to level ${info.needKeep}</b> to break a ${reg.ring >= 3 ? 'core' : 'city'} hive.</div>`
        : `<div class="stat"><span>Hive health <b>${Math.round(game.hiveHealth(selected.id) * 100)}%</b></span><span>Walk up and strike it, <b>day or night</b>. While you hit it, it pours out its dead.</span></div><div class="tiny" style="white-space:normal">When it burns: <b>a legendary blessing</b> and scrap. Its last dead come after you: <b>a flare</b> (scrap) or <b>smoke</b> (food) buys you time.</div>`;
      else html += '<div class="tiny">No hive here.</div>';
      body.innerHTML = html;
      return;
    }
    if (selected.type === 'landmark') {
      const l = S.landmarks[selected.id], L = LANDMARKS[l.kind], near = game.landmarkReach(selected.id);
      $('#pEyebrow').textContent = l.owned ? 'Yours · forward base' : L.signature ? 'Landmark of the city' : 'Landmark';
      $('#pTitle').textContent = L.name;
      let html = `<div class="stat"><span>${L.desc}</span><span>${l.owned ? 'You can build around it.' : 'Claim it and you can build around it too.'}</span></div>`;
      if (!l.owned) html += `<div class="opts one">${opt('opt-claim', 'data-claim="1"', near ? `Claim the ${L.name}` : 'Walk up to it first', near ? L.cost : null, near ? 'Yours for good: its bonus and a build zone around it.' : 'Your hero is on the way. Tap again when you are next to it.', !near || S.gold < L.cost || !day)}</div>`;
      body.innerHTML = html; return;
    }
    if (selected.type === 'site') { renderSite(body, day); return; }
    if (selected.type === 'rubble') {
      const r = game.rubbleAt(selected.x, selected.y);
      const woods = game.map.wild && game.map.wild[idx(Math.floor(selected.x), Math.floor(selected.y))];
      $('#pEyebrow').textContent = 'Your land'; $('#pTitle').textContent = r.blocks ? 'A ruined block' : woods ? 'Trees' : 'Rubble';
      body.innerHTML = `<div class="stat"><span>${r.blocks ? 'Walls block building and the dead alike.' : 'Blocks building. Slows the dead.'}</span><span>Knock it down to make room. The dead cross open ground faster.</span></div>`
        + (r.cells.length ? `<div class="opts one">${opt('opt-clear', 'data-clear="1"', r.blocks ? `Knock down ${r.blocks} ${r.blocks === 1 ? 'bay' : 'bays'} of the block` : woods ? `Fell ${r.cells.length} ${r.cells.length === 1 ? 'cell' : 'cells'} of trees` : `Clear ${r.cells.length} ${r.cells.length === 1 ? 'cell' : 'cells'} of rubble`, r.cost, r.blocks ? `A 3×3 patch becomes open ground. Takes a pair of hands${S.feat.heat ? '; the noise carries (+heat)' : ''}.` : 'A 3×3 patch around this spot becomes paved ground.', S.gold < r.cost || !day || (r.blocks && game.handsFree() < 1))}</div>` : '<div class="tiny">Nothing left to clear here.</div>');
      return;
    }
    const b = selB(); if (!b) { closePanel(); return; }
    const B = BUILDINGS[b.type];
    $('#pEyebrow').textContent = names[game.map.region[idx(Math.floor(b.x), Math.floor(b.y))]] || '';
    $('#pTitle').textContent = `${B.name} · level ${b.level}${b.ruined ? ' · ruined' : ''}`;
    let html = `<div class="stat"><span>Health <b>${Math.ceil(b.hp)} / ${b.maxHp}</b></span><span>${B.desc[b.level - 1]}</span></div><div class="opts two">`;
    if (b.type === 'wall') {
      const run = game.wallRun(b.id), total = run.reduce((a, w) => a + game.upCostOf(w), 0);
      if (b.level < MAX_LEVEL) { const capped = b.level >= game.keepLevel(); html += opt('opt-upw', 'data-upw="1"', capped ? 'Raise the keep first' : `Upgrade this barricade · ${run.length} ${run.length === 1 ? 'post' : 'posts'}`, capped ? null : total, capped ? `Nothing grows past the keep (level ${game.keepLevel()}).` : `${B.desc[b.level]} each. Short of scrap? The nearest posts go first.`, capped || S.gold < game.upCostOf(b) || !day); }
      { const back = Math.floor(game.costOf(b.type) / 2); html += opt('opt-demo', 'data-demo="1"', 'Pull down this post', null, `<b class="good">${back ? `+${back} scrap back` : 'No scrap back'}</b> · <b class="bad">a gap in the line</b>: the dead walk through until you fill it (a gate tower fits).`, !day); }
      body.innerHTML = html + '</div>'; selected.range = null; return;
    }
    const capped = b.level >= game.keepLevel(), maxL = B.maxLevel || MAX_LEVEL, needTech = b.level + 1 === 3 && UNLOCKS[b.type] && !game.hasTech(UNLOCKS[b.type]);
    if (B.tech) { body.innerHTML = `<div class="stat"><span>${b.built < 1 ? `Under construction <b>${Math.floor(b.built * 100)}%</b>` : 'Working'}</span><span>${B.desc[0]}</span></div><div class="opts two">${opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(game.costOf(b.type) / 2)} scrap back</b> · <b class="bad">its bonus is gone</b>.`, !day)}</div>`; selected.range = null; return; }
    if (b.type === 'tower') { const on = game.manned(b), need = CREW_NEED[b.level - 1]; html = html.replace('</div><div class="opts two">', `<span>${on ? `Crew <b>${need}</b> on watch` : `<b class="bad">No crew</b>: needs ${need} people. Build or upgrade homes.`}</span></div><div class="opts two">`); }
    if (b.level < maxL) { const c = game.upCostOf(b); html += opt('opt-up', 'data-up="1"', capped ? `Raise the keep first` : needTech ? `Needs a ${SHORT[UNLOCKS[b.type]]}` : `Upgrade to level ${b.level + 1}`, capped || needTech ? null : c, capped ? `Nothing grows past the keep (level ${game.keepLevel()}).` : needTech ? `Build a ${SHORT[UNLOCKS[b.type]]} to unlock level 3.` : `${B.desc[b.level]} · ${game.maxHpOf(b.type, b.level + 1)} hp${b.type === 'tower' ? ` · needs ${CREW_NEED[b.level]} crew` : ''}${S.halfUpgrade ? ' · half price' : ''}`, capped || needTech || S.gold < c || !day); }
    html += opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(game.costOf(b.type) / 2)} scrap back</b> · <b class="bad">level ${b.level} lost</b> · the 3×3 lot is free again.`, !day);
    body.innerHTML = html + '</div>' + (b.level >= MAX_LEVEL ? '<div class="tiny">Fully upgraded.</div>' : '');
    selected.range = b.type === 'tower' ? game.towerStats(b).range : null;
  }
  $('#pBody').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn || btn.disabled || !selected) return;
    if (btn.dataset.who) { const id = +btn.dataset.who, pk = selected.pick || (selected.pick = new Set()); if (pk.has(id)) pk.delete(id); else pk.add(id); renderPanel(); return; }
    if (btn.dataset.send) { if (game.scavenge.send(selected.id, [...(selected.pick || [])])) { const n = selected.pick.size; selected.pick = new Set(); toast(`${n === 1 ? 'One survivor heads' : `${n} survivors head`} out. Back at dawn.`, 'good'); } }
    if (btn.dataset.claim && game.claimLandmark(selected.id)) { closePanel(); updateHud(); return; }
    if (btn.dataset.clear) { const n = game.clearRubble(selected.x, selected.y); if (n) { toast(`${n} ${n === 1 ? 'cell' : 'cells'} cleared.`); closePanel(); updateHud(); return; } }
    if (btn.dataset.recall && game.scavenge.recall(selected.id)) toast('The crew stays home. Supplies returned.');
    if (btn.dataset.keep && game.upgradeKeep()) toast('The keep rises higher.');
    if (btn.dataset.trader) { traderSeen = true; closePanel(); paused = true; showTrader(); return; }
    if (btn.dataset.up && game.upgrade(selected.id)) toast('Upgraded.');
    if (btn.dataset.upw) { const n = game.upgradeWall(selected.id); if (n) toast(`${n} ${n === 1 ? 'post' : 'posts'} upgraded.`); }
    if (btn.dataset.demo) {
      if (btn.dataset.sure) { if (game.demolish(selected.id)) { toast('Pulled down.'); closePanel(); updateHud(); return; } }
      else { btn.dataset.sure = '1'; btn.classList.add('sure'); btn.querySelector('.nm').textContent = 'Tap again to confirm'; return; }
    }
    if (btn.dataset.purge && game.planPurge(selected.id)) toast(`At nightfall you march on ${names[selected.id]}.`, 'good');
    if (btn.dataset.cancel) game.planPurge(null);
    renderPanel(); updateHud();
  });
  $('#pClose').onclick = closePanel;
  $('#bell').hidden = true;   // no bell: dusk comes with the sun
  $('#logBtn').onclick = showLog;
  $('#mini').onclick = () => { if (game && !card) showMap(); };
  $('#crewBtn').onclick = () => { if (game) showStatus(); };
  $('#dayPill').onclick = () => { if (game && !card && !game.state.over) showStatus(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && !game.state.over) { const snap = game.snapshot(); if (snap) saves.save(snap); } });
  $('#autoBtn').onclick = () => { if (!game) return; const on = !game.state.autopilot; game.setAutopilot(on); $('#autoBtn').setAttribute('aria-pressed', on); $('#autoTag').hidden = !on; toast(on ? '[Autopilot on] Your hero defends the town and your people build. You still choose blessings and story moments.' : '[Autopilot off] Your hands again.', 'sys'); };
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
    el.hidden = false;
    if (el.hidden) return;
    const cd = S.ability.cd, cost = game.abilityCost();
    el.querySelector('.an').textContent = A.name;
    el.querySelector('.ac').innerHTML = cd > 0 ? `${Math.ceil(cd)}s` : cost ? `<span class="dot gold"></span>${cost}` : 'ready';
    el.classList.toggle('cool', cd > 0 || S.hero.dead || (cost && S.gold < cost));
    el.style.setProperty('--cd', cd > 0 ? (cd / A.cooldown) : 0);
  }

  // ---------- HUD ----------
  function dockH() { const db = $('#dock').getBoundingClientRect(); document.body.style.setProperty('--dockH', `${Math.max(60, innerHeight - db.top)}px`); }
  function updateHud() {
    dockH();
    if (game) { const cb = $('#crewBtn'); cb.hidden = false; const q = game.state.story.quests.length; cb.textContent = q ? `Status · ${q}` : 'Status'; cb.classList.toggle('alert', false); }
    if (!game) return;
    const S = game.state, night = S.phase === 'night', bm = game.isBloodMoon(S.night);
    $('#phaseLbl').textContent = S.over ? 'Fell on' : night ? 'Night' : 'Day';
    $('#nightNum').textContent = S.night;
    $('#lvTag').textContent = `Lv ${S.lvl}`;
    $('#moon').hidden = !bm;
    $('#keepFill').style.width = (Math.max(0, S.keep.hp) / S.keep.maxHp * 100) + '%';
    $('#keepTxt').textContent = Math.max(0, Math.ceil(S.keep.hp));
    $('#resPill').hidden = night;
    $('#gold').textContent = S.gold; $('#goldNote').textContent = `+${game.goldPerDawn()}`;
    $('#food').textContent = S.food; $('#foodNote').textContent = `+${game.foodPerDawn()} −${game.foodNeed()}`;
    $('#foodNote').classList.toggle('warn', game.foodPerDawn() + S.food < game.foodNeed());
    const hf = game.handsFree(); $('#hands').textContent = `${hf}/${game.handsMax()}`; $('#hands').classList.toggle('none', hf < 1);
    const pin = game.powerIn(), pout = game.powerOut(); $('#pwrTxt').textContent = `${pin - pout >= 0 ? '+' : '−'}${Math.abs(pin - pout)}`; $('#pwr').title = `Power: ${pin} made, ${pout} used. Short of power, everything powered switches off.`; $('#pwr').classList.toggle('thin', pin - pout < 2); $('#pwr').classList.toggle('off', S.blackout); $('#pwr').hidden = !S.feat.power; $('.heat').hidden = !S.feat.heat; $('#threatPill').hidden = !S.feat.power && !S.feat.heat;
    $('#blackout').hidden = !S.blackout; document.body.classList.toggle('bo', !!S.blackout); if (S.blackout) $('#boTxt').textContent = `${pout} needed · ${pin} made`;
    const ht = Math.round(S.heat); $('#heatFill').style.width = Math.min(100, S.heat) + '%'; $('#heatTxt').textContent = ht;
    const hel = $('.heat'); hel.classList.toggle('hot', S.heat >= HEAT.erupt || !!S.eruption); hel.classList.toggle('stir', S.heat >= HEAT.stir && S.heat < HEAT.erupt);
    const cw = game.crewing(); $('#pop').textContent = game.pop(); $('#popNote').textContent = cw.need ? `${cw.free} free` : ''; $('#popNote').classList.toggle('warn', cw.need > cw.people);
    $('#buildBtn').style.visibility = S.over ? 'hidden' : '';
    $('#bell').hidden = true;
    if (S.over) $('#info').innerHTML = 'The keep has fallen';
    else {
      // one clock: the sun (or the moon) crosses the sky; the dead never stop coming
      const loose = S.mobs.filter(m => !m.roam && !MOBS[m.kind].animal).length, hunting = S.mobs.filter(m => m.hunt && !MOBS[m.kind].animal).length;
      let tail = '';
      if (!night) { const fc = view.routes(), dead = fc.reduce((a, r) => a + r.count, 0), ratio = game.threatRatio(); tail = ` · <span class="long">Tonight </span><em>☠ ${dead}</em> · <span class="rating ${game.ratingOf(ratio)}">${game.ratingOf(ratio)}</span>`; }
      $('#info').innerHTML = `${S.eruption ? `<span class="erupt">Hive bursts ${Math.ceil(S.eruption.t)}s</span> · ` : ''}${sunDial(night ? game.nightFrac() : game.dayFrac(), !night && game.duskIn() <= 15, night)}${loose ? ` · <em class="loose">${loose}</em> coming` : ''}${hunting ? ` · <em class="hunt">${hunting}</em> on your trail` : ''}${S.hero.dead ? ` · back in ${Math.ceil(S.hero.respawn)}s` : ''}${tail}${S.weather !== 'clear' ? ` · <span class="wx ${S.weather}">${game.weather().name}</span>` : ''}`;
    }
    renderTray(); renderAbility();
    const tb = $('.top').getBoundingClientRect(), db = $('#dock').getBoundingClientRect();
    edge.top = tb.bottom + 10; edge.bot = innerHeight - db.top + 10;
  }

  // the sun's arc across the day: where it stands is how much daylight is left
  function sunDial(t, soon, moon = false) {
    const a = Math.PI * (1 - t), x = 22 + Math.cos(a) * 17, y = 19 - Math.sin(a) * 15;
    return `<span class="sundial${soon ? ' soon' : ''}${moon ? ' moon' : ''}" title="${moon ? 'The moon crosses the sky: at dawn the night is over' : 'The sun sets at dusk: then the night comes'}"><svg viewBox="0 0 44 22" width="40" height="20" aria-hidden="true"><path d="M5 19 A17 15 0 0 1 39 19" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 2"/><line x1="2" y1="19.5" x2="42" y2="19.5" stroke="currentColor" stroke-opacity=".5"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" class="sun"/></svg></span>`;
  }
  // ---------- edge arrows ----------
  const edge = { top: 60, bot: 100, pool: [], tags: [] };
  function edgeMarks() {
    const S = game.state, Wd = innerWidth, Hh = innerHeight, m = 22, t = edge.top, bt = Hh - edge.bot, cx = Wd / 2, cy = (t + bt) / 2, buckets = new Map();
    for (const z of S.mobs) {
      if (z.roam || z.lure || MOBS[z.kind].animal) continue;
      if (Math.hypot(z.x - S.hero.x, z.y - S.hero.y) > 40 && Math.hypot(z.x - game.map.town.x, z.y - game.map.town.y) > 30) continue;   // far away: not your worry yet
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
    for (const d of S.drops) {
      const p = view.project(d.x, d.y, 1.5); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue;
      buckets.set(3000 + d.id, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: false, drop: true });
    }
    for (const sp of S.story.spots) {
      const p = view.project(sp.x, sp.y, 1.5); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue;
      buckets.set(7000 + sp.id, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: false, quest: true, label: '!' });
    }
    { const tr = S.story.trial; if (tr && !tr.done) { const p = view.project(tr.x, tr.y, 1.5); if (!(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(6999, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: true, quest: true, label: 'Trial' }); } }
    for (const q of S.story.quests) {
      const p = view.project(q.x, q.y, 1.5); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue;
      buckets.set(5000 + q.site, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: false, quest: true });
    }
    // places: the city down the road, and the way home
    { const c = game.map.city, h = S.hero; if (c && Math.hypot(c.x - h.x, c.y - h.y) > c.r + 6) { const p = view.project(c.x, c.y, 1); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8000, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, place: true, label: 'City' }); } }
    { const tw = game.map.town, h = S.hero; if (Math.hypot(tw.x - h.x, tw.y - h.y) > 24) { const p = view.project(tw.x, tw.y, 1); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8001, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, place: true, label: 'Camp' }); } }
    for (let k = tagN; k < edge.tags.length; k++) edge.tags[k].hidden = true;
    let i = 0;
    for (const b of buckets.values()) {
      let el = edge.pool[i]; if (!el) { el = document.createElement('div'); el.className = 'ar'; el.innerHTML = '<i></i><span></span>'; $('#edge').appendChild(el); edge.pool[i] = el; }
      const c = Math.cos(b.ang), s = Math.sin(b.ang), hx = Wd / 2 - m, hy = Math.max(10, (bt - t) / 2 - m * 0.5), k = Math.min(Math.abs(hx / (c || 1e-6)), Math.abs(hy / (s || 1e-6)));
      el.style.transform = `translate(${cx + c * k}px, ${cy + s * k}px) rotate(${b.ang}rad)`;
      const sp = el.lastChild; sp.textContent = b.label ? b.label : b.quest ? 'Quest' : b.drop ? 'Drop' : b.day ? `~${b.n}` : b.n > 1 ? b.n : ''; sp.style.transform = `rotate(${-b.ang}rad)`;
      el.classList.toggle('big', b.big); el.classList.toggle('drop', !!b.drop); el.classList.toggle('quest', !!b.quest); el.classList.toggle('ploc', !!b.place); el.hidden = false; i++;
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
    if (e.pointerType === 'mouse') { const p = view.pick(e.clientX, e.clientY); canvas.style.cursor = p && p.type !== 'ground' ? 'pointer' : ''; }
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
    if (p.type === 'landmark') { const l = S.landmarks[p.id]; if (!l.owned) { game.heroTo(l.x, l.y + l.size / 2 + 1); view.showMove(l.x, l.y + l.size / 2 + 1); } openSel({ type: 'landmark', id: p.id }); return; }
    if (p.type === 'rubble') { game.heroTo(p.x, p.y); view.showMove(p.x, p.y); openSel({ type: 'rubble', x: p.x, y: p.y }); return; }
    if (p.type === 'site') { openSel({ type: 'site', id: p.id, pick: new Set() }); return; }
    if (p.type === 'building' || p.type === 'keep') { openSel(p.type === 'building' ? { type: 'building', id: p.id } : { type: 'keep' }); return; }
    if (p.type === 'region' && S.sealed[p.id]) { openSel({ type: 'region', id: p.id }); return; }
    if (p.type === 'region' && game.map.regions[p.id].nest && game.regionInfo(p.id).nest) {
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
    if (k === 'l') showLog();
    if (k === 'm' && !card) showMap();
    if (k === 'q' || k === ' ') { e.preventDefault(); useAbility(); }
    if (k === 'enter' && placing) placeNow();
    if (['1', '2', '3', '4', '5', '6'].includes(k) && !paused) { const t = [...BUILD_ORDER, ...TECH_ORDER][+k - 1]; if (placing && placing.type === t) stopPlacing(); else startPlacing(t); }
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
    try { audio.onEvents(events, game); audio.tick(game, dt); } catch (err) { /* sound must never stop the game */ }
    for (const e of events) {
      if (toastFor.has(e.t)) toast(e.msg, e.t === 'fail' ? 'bad' : e.kind);
      if (e.t === 'window') queueWin(e);
      if (e.t === 'encounter') aiFetch(S.story.encounters.find(x => x.id === e.id));
      if (e.t === 'episode') showEpisode(e);
      if (e.t === 'claim' && selected && selected.type === 'region') closePanel();
      if (e.t === 'dawn') { inventToday(); dawnT = DAWN_DELAY; traderSeen = false; endJoy(); const snap = game.snapshot(); if (snap) saves.save(snap).then(w => { lastSave = { day: snap.night, where: w }; }); }
      if (e.t === 'over') { saves.clear(); { const L = store.get('legacy', { fame: 0, owned: {} }); S.fameEarned = fameOf(S); L.fame += S.fameEarned; store.set('legacy', L); } endT = now + 2600; paused = false; closePanel(); stopPlacing(); view.startOrbit(); }
      if ((e.t === 'remove' || e.t === 'ruin') && selected && selected.type === 'building' && !S.byId.get(selected.id)) closePanel();
    }
    // the dawn cards wait a moment so a last tap at night can't land on them
    if (dawnT > 0) dawnT -= dt;
    if (!card && wins.length && dawnT <= 0 && !S.over) showWin();
    if (!card && dawnT <= 0 && needsDawn()) dawnFlow();
    if (!card && !paused && S.story.encounters.length) showEncounter();
    if (!card && S.escape) showEscape();
    if (endT > 0 && now >= endT) { endT = -1; paused = true; showEnd(); }
    if (placing && placing.zone.ver !== S.occVersion) { refreshZone(); updateGhost(); }
    view.frame(dt, { events, selected, ghost: placing && placing.ghost, zone: placing && placing.zoneMask });
    edgeMarks(); watchFrames(raw);
    // [road] begin
    if (roadUI) roadUI.tick(dt);
    // [road] end
    if ((miniT -= dt) <= 0) { miniT = 0.4; drawMini(); }
    hudT -= dt; if (hudT <= 0) { updateHud(); hudT = 0.2; if (selected && !paused) { const sig = panelSig(); if (sig !== lastSig) { lastSig = sig; renderPanel(); } } }
  }
  requestAnimationFrame(frame);
  showStart();
}
