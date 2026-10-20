// Screens, HUD, panels and input. Talks to the game only through its public API.
// Two looks: the Camp (amber, Barlow Condensed: what is yours) and the System (cyan, monospace: the window only you
// can see). The Window is a character: a strip at the top speaks in [brackets] instead of a pile of toasts, one story
// card and one System window a dawn, tips anchored to what they explain, nothing pauses at night unless it is the night.
import { createGame, STEP, CREW_NEED, DIFFICULTY, HEAT, SAVE_V } from '../sim/game.js';
import { mapChoices, generateMap, N, T, idx, BIOMES, LANDMARKS } from '../sim/mapgen.js';
import { createView } from '../render/view.js';
import { BUILDINGS, BUILD_ORDER, TECH_ORDER, UNLOCKS, KEEP, MAX_LEVEL } from '../content/buildings.js';
import { HEROES, TRADES, CLASS_TIERS } from '../content/heroes.js';
import { PERKS, FAMILIES, MASTERIES } from '../content/perks.js';
import { MOBS, ESCAPE } from '../content/mobs.js';
import { regionNames, hiveName } from '../content/names.js';
import { createAudio } from './audio.js';
import { createChronicler } from './story-ai.js';
import { createSaves } from './saves.js';
import { TITLES, ROLES, BARKS, QUEST_TEMPLATES, SYSTEM } from '../content/story.js';
import { RARITY, KITS } from '../content/districts.js';
import { LEGACY, fameOf } from '../content/legacy.js';
import { RULES } from '../content/season.js';
import { CONTRACT_COPY } from '../content/contracts.js';
import { iconSprite, icon } from './icons.js';
import { createStrip, createCallouts, createCampToast, typeOn, openBeat, sysRich, reduced } from './system.js';
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
// Cut or parked (decisions, Oct 20): everything stays behind a flag so it can come back.
// the start screen's "What's new" (under More): short, for players
const WHATS_NEW = [
  '**Night missions.** At dusk choose how to spend the night: **Hold the Camp**, **The Hunt** (lantern off, burn a hive while its dead are out) or **The Pied Piper** (sound the horn, lead the dead into a trap).',
  '**The old road.** Four stations with fires. Light one and it becomes an outpost; walk the people you find home in a **convoy**, and spend a night out there if you dare.',
  '**Seasons are contracts.** The System offers a rule and a finale. Win it and the city eases off; lose it and the run ends with its name.',
  '**One Noise meter.** The louder the Camp, the more dead come and the farther the hives hear you (the ring on the map).',
  '**Ruins stay ruins** until you rebuild them: tap one, or **Rebuild all** at dawn.',
  '**Flare and Smoke** buttons when the dead are on you or a hive has just burned.',
  'A **lantern-lit** world: warm fires, cold nights, a frontier camp that grows from a stalled bus.',
  'Fewer, sharper systems: power, hands, barricades, weather and the trader are gone for now.',
];
export const FLAGS = { trader: false, crew: false, legacyAll: false, foremanFirstRun: false, runLog: false, perkShop: false, changelog: false, startDifficulty: false };
const LEGACY_KEEP = ['scrap', 'dmg', 'keep'];
const RINGS = ['Camp', 'The woods', 'The city', 'The old core'];
const ARM_MS = 600;          // cards ignore taps this long after they appear
const DAWN_DELAY = 1.2;      // seconds between the last kill and the first card
const JOY_PX = 14;           // a touch that moves further than this is a joystick drag, not a tap
const AI_WAIT = 2500;        // the Chronicler gets this long to swap its words in (scripted text shows first)
const SHORT = { house: 'Home', farm: 'Farm', tower: 'Tower', wall: 'Barricade', workshop: 'Workshop', market: 'Market', generator: 'Generator' };
const PLURAL = { house: 'homes', farm: 'farms', tower: 'towers', wall: 'barricade posts', workshop: 'workshops', market: 'markets', generator: 'generators' };
const ONE = { house: 'a home', farm: 'a farm', tower: 'a tower', wall: 'a barricade post', workshop: 'the workshop', market: 'the market', generator: 'a generator' };
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const DIR8 = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const esc = t => String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const rich = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** one name for the hall: the game's own strings still say keep / town hall in places */
/** a chronicle line as a sentence: 'Drawings on the glass: "Go and get them"' → 'Drawings on the glass. You chose: Go and get them.' */
const chronLine = t => { const m = /^(.+?): "(.+)"$/.exec(t); return m ? `${m[1].replace(/\.$/, '')}. You chose: ${m[2].replace(/^\[|\]$/g, '')}.` : t; };
const campCopy = t => String(t).replace(/\b([Tt])he (keep|town hall|hall)\b/g, (_, T0) => `${T0}he Camp`).replace(/\btown hall\b/gi, 'Camp').replace(/\bthe town\b/g, 'the Camp');

export function startApp() {
  let game = null, view = null, names = [], selected = null, placing = null, paused = true, acc = 0, last = performance.now(), hudT = 0;
  // [road] begin
  let roadUI = null;
  // [road] end
  let card = null;             // which card is open
  let dawnAt = 0, endT = -1;   // cards wait until performance.now() passes dawnAt
  let calmT = 0, waitT = 0;   // seconds of calm (no dead near the hero or the Camp), seconds a card has waited
  const holdCards = sec => { dawnAt = Math.max(dawnAt, performance.now() + sec * 1000); };
  const keys = {};
  let setup = { hero: 'survivor', mode: 'classic', difficulty: store.get('difficulty', 'survivor'), runSeed: Math.floor(Math.random() * 1e6), pick: 0 };
  { const sq = new URLSearchParams(location.search).get('seed'); if (sq) setup.runSeed = +sq; }   // testing: a fixed world
  $('#sprite').innerHTML = iconSprite();
  const strip = createStrip($('#strip'), { onTap: () => { if (game && !card && !game.state.over) showStatus(); } });
  const ANCHORS = { strip: '#strip', noise: '#rNoise', forecast: '#forecast', map: '#mini', camp: '#campHp', build: '#buildBtn' };
  const callouts = createCallouts($('#callouts'), ANCHORS);
  const ctoast = createCampToast($('#ctoasts'));
  const systemHere = () => !!(game && (game.state.night >= 2 || (game.state.story.n1.arrived && !game.state.story.encounters.some(e => e.kind === 'arrival'))));
  const firstRun = () => !store.get('runs', 0);

  // ---------- maps: one pixel per cell, cropped to the land ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const MAPCOL = { meadow: hex('#5f7a45'), wood: hex('#2f4a2a'), street: hex('#77736b'), block: hex('#45423e'), park: hex('#3f5634'), water: hex('#2f5a6e'), ford: hex('#8d887d'), dirt: hex('#8a6a48'), road: hex('#c2a46e'), cliff: hex('#8a8378'), site: hex('#e0b050'), voidc: [11, 13, 14] };
  function mapBox(m) { let x0 = N, y0 = N, x1 = 0, y1 = 0; for (let i = 0; i < N * N; i++) if (m.terrain[i] !== T.VOID) { const x = i % N, y = (i / N) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0: Math.max(0, x0 - 3), y0: Math.max(0, y0 - 3), x1: Math.min(N - 1, x1 + 3), y1: Math.min(N - 1, y1 + 3) }; }
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
    ctx.fillStyle = '#f0a649'; ctx.beginPath(); ctx.arc((m.town.x - b.x0) * s, (m.town.y - b.y0) * s, 6, 0, 7); ctx.fill();
  }
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
    for (const sp of S.story.spots) if (big) dot(sp.x, sp.y, 4, '#7fe3ff');
    const tr = S.story.trial; if (tr && !tr.done) dot(tr.x, tr.y, big ? 6 : 4, '#ff4a4a', true);
    // the contract's place: a cyan double ring and its name (the big map), on every map; it shows even unexplored
    const k = S.story.contract; if (k && !k.won && !k.lost && k.finale.kind === 'hive') { const n = m.regions[k.finale.region].nest; if (n) {
      dot(n.x, n.y, big ? 11 : 6, '#7fe3ff', true); dot(n.x, n.y, big ? 6 : 3, '#7fe3ff', true);
      if (big) { const t = 'CONTRACT'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(t, (n.x - ox) * s, (n.y - oy) * s - 18); ctx.fillStyle = '#7fe3ff'; ctx.fillText(t, (n.x - ox) * s, (n.y - oy) * s - 18); }
    } }
    if (big && game.hearRadius) { const r = game.hearRadius() * s; ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(240,166,73,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((m.town.x - ox) * s, (m.town.y - oy) * s, r, 0, 7); ctx.stroke(); ctx.restore();
    }
    dot(m.town.x, m.town.y, big ? 7 : 4, '#f0a649');
    // [road] begin
    if (roadUI) roadUI.marks(ctx, ox, oy, s, big);
    // [road] end
    const h = S.hero; dot(h.x, h.y, big ? 6 : 4, '#ffffff'); dot(h.x, h.y, big ? 9 : 6, 'rgba(255,255,255,.5)', true);
  }
  function drawMini() {
    const cv = $('#mini'); if (!cv || !game) return;
    const S = game.state, src = worldNow(), R = 36, ctx = cv.getContext('2d'), h = S.hero;
    if (cv.width !== R * 2 * 4) { cv.width = cv.height = R * 2 * 4; }
    const s = cv.width / (R * 2); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#0b0d0e'; ctx.fillRect(0, 0, cv.width, cv.width);
    ctx.drawImage(src, h.x - R, h.y - R, R * 2, R * 2, 0, 0, cv.width, cv.width);
    marks(ctx, h.x - R, h.y - R, s, false);
    const c = game.map.city; if (c) { const a = Math.atan2(c.y - h.y, c.x - h.x), dd = Math.hypot(c.x - h.x, c.y - h.y); if (dd > R + c.r * 0.3) { const r0 = cv.width / 2 - 9, x = cv.width / 2 + Math.cos(a) * r0, y = cv.width / 2 + Math.sin(a) * r0; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.fill(); ctx.restore(); } }
  }
  function showMap() {
    const S = game.state, src = worldNow(), b = worldB, w = b.x1 - b.x0 + 1, hh = b.y1 - b.y0 + 1, s = 2;
    paused = true; if (placing) stopPlacing(); closePanel();
    showCard('map', `<button class="closex" id="mapX" aria-label="Close">${icon('close')}</button><div class="eyebrow">[Map] ${esc(game.map.name)} · day ${S.night}</div><h1 class="sm">The woods and the city</h1>
      <div class="mapwrap"><canvas id="bigMap" aria-label="Map of the woods and the city"></canvas></div>
      <div class="legend"><span><i style="background:#ffffff"></i>You</span>${S.story.contract && !S.story.contract.won && S.story.contract.finale.kind === 'hive' ? `<span><i style="background:none;border:2px solid #7fe3ff"></i>Contract: ${esc(S.story.contract.finale.name)}</span>` : ''}<span><i style="background:#f0a649"></i>The Camp</span><span><i style="background:#c2a46e"></i>The old road</span><span><i style="background:#b4ff4e"></i>Forest hollow</span><span><i style="background:#ff5a4a"></i>City hive</span><span><i class="o" style="border-color:#ffe08a"></i>Place to claim</span><span><i style="background:#7fe3ff"></i>Beacon</span><span><i class="o" style="border-color:#f0a649;border-style:dashed"></i>How far the hives hear you</span></div>
      <p class="note">Dark ground is unexplored. Tap a place to plan a trip.</p>
      <div class="cardrow foot"><button class="btn big" id="mapOk">Back</button></div>`, { sys: true, arm: false });
    const cv = $('#bigMap'); cv.width = w * s; cv.height = hh * s; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, b.x0, b.y0, w, hh, 0, 0, w * s, hh * s);
    marks(ctx, b.x0, b.y0, s, true);
    const lbl = (x, y, t) => { ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t, (x - b.x0) * s, (y - b.y0) * s); ctx.fillStyle = '#fff1d6'; ctx.fillText(t, (x - b.x0) * s, (y - b.y0) * s); };
    lbl(game.map.town.x, game.map.town.y - 8, 'CAMP'); const c = game.map.city; if (c) lbl(c.x, c.y + 4, 'THE CITY');
    // [road] begin
    if (roadUI) roadUI.onMap(cv, b.x0, b.y0, s);
    // [road] end
    $('#mapOk').onclick = $('#mapX').onclick = () => { hideCard(); paused = false; };
  }

  // ---------- the start: one screen ----------
  function showStart() {
    paused = true; $('#hud').hidden = true;
    const opts = mapChoices(setup.runSeed), best = store.get('best', 0);
    $('#overlay').classList.add('start');
    showCard('start', `${startArt()}<div class="kick">[A window only you can see]</div>
      <h1>Hold<span>Hollowmere</span></h1>
      <p class="pitch">You woke in the woods with a window only you can see. The city is a minute down the road.</p>
      <div class="cta"><div id="contRow" hidden></div><button class="btn big" id="begin">Begin</button></div>
      <details id="startMore"><summary>More</summary>
        <div class="worlds">${opts.map((o, k) => `<canvas id="mm${k}" aria-hidden="true"></canvas><div><b>${esc(o.name)}</b><div class="note">${esc(BIOMES[o.biome].blurb)} · seed ${o.seed}</div><button class="btn ghost sm" id="reroll" style="margin-top:8px">Another world</button></div>`).join('')}</div>
        <label class="aitog" style="margin-top:14px"><input type="checkbox" id="aiStart" ${chronicler.enabled() ? 'checked' : ''}><span>Let the Chronicler (Claude) write your story and play your companions. It uses your Claude account and asks first. Off: the written story.</span></label>
        ${FLAGS.startDifficulty ? `<div class="opts one" style="margin-top:12px">${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="opt" data-diff="${k}" aria-pressed="${setup.difficulty === k}"><span class="nm">${d.name}</span><span class="ds">${d.blurb}</span></button>`).join('')}</div>` : '<p class="note" style="margin-top:12px">The System asks how hard it should be after your first night.</p>'}
        ${legacyHtml()}
        <div class="news"><b>What's new tonight</b><ul>${WHATS_NEW.map(t => `<li>${rich(t)}</li>`).join('')}</ul></div>
      </details>
      <div class="foot">${best ? `Your best: night ${best} · ` : ''}Drag to walk · tap to go somewhere</div>`, { cls: 'titlecard', arm: false });
    opts.forEach((o, k) => drawMinimap($(`#mm${k}`), generateMap(o.seed, o.biome)));
    $$('[data-diff]').forEach(b => b.onclick = () => { setup.difficulty = b.dataset.diff; store.set('difficulty', setup.difficulty); $$('[data-diff]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#aiStart').onchange = e => chronicler.setEnabled(e.target.checked);
    $$('[data-legacy]').forEach(b => b.onclick = () => { const L = store.get('legacy', { fame: 0, owned: {} }), up = LEGACY.find(x => x.id === b.dataset.legacy), n = L.owned[up.id] || 0; if (n >= up.max || L.fame < up.cost) return; L.fame -= up.cost; L.owned[up.id] = n + 1; store.set('legacy', L); audio.play('claim'); showStart(); $('#startMore').open = true; });
    $('#reroll').onclick = () => { setup.runSeed = Math.floor(Math.random() * 1e6); setup.pick = 0; showStart(); $('#startMore').open = true; };
    $('#begin').onclick = () => { const o = opts[setup.pick]; begin(o.seed, o.biome); };
    saves.load().then(snap => {
      if (!snap || snap.v !== SAVE_V || card !== 'start' || !$('#contRow')) return;
      const row = $('#contRow'); row.hidden = false;
      row.innerHTML = `<button class="cont" id="cont"><span>[Continue] Day ${snap.night} · ${esc(snap.city || 'the woods')}</span><small>${saves.cloud() ? 'Saved to your account' : 'Saved on this device'} · ${new Date(snap.savedAt).toLocaleString()}</small></button>`;
      $('#begin').classList.add('ghost'); $('#begin').textContent = 'New run';
      $('#cont').onclick = () => begin(snap.mapSeed, snap.biome, snap);
    });
  }
  // the key art: the woods at dusk, the dead city on the horizon, a fire, and a window only you can see
  function startArt() {
    const r = n => { let x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
    const stars = Array.from({ length: 40 }, (_, k) => `<circle cx="${(r(k) * 390).toFixed(0)}" cy="${(r(k + 99) * 230).toFixed(0)}" r="${(0.4 + r(k + 7) * 0.9).toFixed(1)}" opacity="${(0.25 + r(k + 3) * 0.6).toFixed(2)}"/>`).join('');
    let city = ''; for (let k = 0, x = 120; x < 300; k++) { const w = 8 + r(k + 50) * 14, h = 18 + r(k + 60) * 52; city += `<rect x="${x.toFixed(0)}" y="${(300 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`; if (r(k + 70) > 0.5) city += `<rect x="${(x + 3).toFixed(0)}" y="${(300 - h + 8).toFixed(0)}" width="2" height="2" fill="#7fe3ff" opacity=".5"/>`; x += w + 1; }
    const pine = (x, y, s, c) => `<path d="M${x} ${y - 40 * s}L${x + 11 * s} ${y - 16 * s}H${x + 6 * s}L${x + 16 * s} ${y}H${x - 16 * s}L${x - 6 * s} ${y - 16 * s}H${x - 11 * s}Z" fill="${c}"/>`;
    let far = '', near = ''; for (let k = 0; k < 16; k++) far += pine(k * 27 + r(k) * 10, 330 + r(k + 5) * 10, 0.9 + r(k + 9) * 0.5, '#0d1418');
    for (let k = 0; k < 9; k++) near += pine(k * 50 + r(k + 30) * 20 - 10, 420 + r(k + 40) * 16, 1.7 + r(k + 20) * 0.9, '#07090b');
    return `<svg class="art" viewBox="0 0 390 440" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb35a" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a45" stop-opacity="0"/></radialGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset=".75" stop-color="#2a1d1a"/><stop offset="1" stop-color="#4a2a1c"/></linearGradient></defs>
      <rect width="390" height="440" fill="url(#sky)"/><g fill="#e8eefc">${stars}</g>
      <circle cx="300" cy="96" r="16" fill="#f4e6c8" opacity=".9"/><circle cx="306" cy="91" r="14" fill="#0f1726"/>
      <g fill="#120f12">${city}</g><path d="M120 300H300" stroke="#ff6a3a" stroke-opacity=".25"/>
      <path d="M200 440C200 380 150 360 190 330S220 305 214 300" fill="none" stroke="#c2a46e" stroke-opacity=".35" stroke-width="3" stroke-dasharray="2 5"/>
      ${far}<ellipse cx="86" cy="392" rx="70" ry="40" fill="url(#glow)"/><path d="M86 384l-5 10h10z" fill="#ffcf7a"/>${near}
      <g class="win" transform="translate(212 150)"><rect width="140" height="54" fill="rgba(10,24,40,.55)" stroke="#7fe3ff" stroke-opacity=".7"/><path d="M0 10V0h10M130 0h10v10M140 44v10h-10M10 54H0V44" stroke="#7fe3ff" stroke-width="2" fill="none"/>
        <text x="10" y="22" fill="#7fe3ff" font-family="IBM Plex Mono, monospace" font-size="10" letter-spacing="1">[STATUS WINDOW]</text><text x="10" y="40" fill="#d9f4ff" font-family="IBM Plex Mono, monospace" font-size="11">Survivor · Lv 1</text></g>
    </svg>`;
  }
  function legacyHtml() {
    const L = store.get('legacy', { fame: 0, owned: {} }); if (!L.fame && !Object.keys(L.owned).length) return '';
    const list = LEGACY.filter(u => FLAGS.legacyAll || LEGACY_KEEP.includes(u.id));
    return `<h2 style="font:600 12px var(--mono);letter-spacing:.12em;text-transform:uppercase;margin:18px 0 0">Legacy · ${L.fame} fame</h2><div class="legacy">${list.map(u => { const n = L.owned[u.id] || 0; return `<button class="opt" data-legacy="${u.id}" ${n >= u.max || L.fame < u.cost ? 'disabled' : ''}><span class="nm">${u.name} ${n ? `${n}/${u.max}` : ''}<span class="cost">${n >= u.max ? 'max' : `${u.cost} fame`}</span></span><span class="ds">${u.desc.replace(/town hall/i, 'Camp')}</span></button>`; }).join('')}</div>`;
  }
  function begin(mapSeed, biome, snap = null) {
    $('#overlay').classList.remove('start');
    game = snap ? createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, mode: 'classic', difficulty: snap.difficulty, restore: snap, legacy: snap.legacy || {} })
      : createGame({ seed: setup.runSeed, mapSeed, biome, hero: 'survivor', mode: 'classic', difficulty: setup.difficulty, legacy: store.get('legacy', { owned: {} }).owned });
    names = regionNames(mapSeed, game.map.regions.length);
    const qp = new URLSearchParams(location.search).get('q');
    if (!view) { view = createView($('#view'), game, { onFlash: () => audio.play('thunder'), quality: qp || store.get('quality', null) || store.get('autoq', null) || undefined }); }
    window.__game = game; window.__view = view; window.__openSel = sel => openSel(sel);
    window.__ui = { strip, callouts, ctoast, showStatus, showMore, showMap, cards: () => card, toast };
    // [road] begin
    if (roadUI) roadUI.dispose();
    roadUI = createRoadUI({ game, view, toast: (m, k) => toast(m, k), hideCard: () => { hideCard(); paused = false; }, isBusy: () => paused || !!card || !!placing, systemHere: () => systemHere() });
    window.__roadUI = roadUI;
    // [road] end
    $('#hud').hidden = false; hideCard(); paused = false; selected = null; placing = null; closePanel();
    $('#ability').hidden = true;
    if (snap) { previouslyOn(); }
    else setTimeout(() => subtitle(SYSTEM.dayOne), 2700);
    holdCards(0.3);
  }
  function subtitle(text, ms = 6000) {
    const el = $('#subtitle'); el.innerHTML = rich(text); el.hidden = false; el.style.animationDuration = `${ms}ms`; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    clearTimeout(subtitle.t); subtitle.t = setTimeout(() => { el.hidden = true; }, ms);
  }

  // coming back to a run: "previously on Hollowmere" (Claude tells it when on; else the chronicle's big moments)
  function previouslyOn() {
    const ST = game.state.story, offline = ST.chronicle.filter(c => c.imp >= 3).slice(-3).map(c => `Day ${c.day}: ${c.text}`);
    const show = lines => showInfo({ eyebrow: '[Previously on Hollowmere]', title: `${game.map.name} · day ${game.state.night}`, lines: lines.length ? lines : ['You held the Camp. The dead did not wait for you.'] });
    if (!chronicler.available()) { show(offline); return; }
    paused = true; let done = false;
    const t = setTimeout(() => { if (!done) { done = true; show(offline); } }, AI_WAIT);
    chronicler.recap(game.story().fullContext()).then(b => { if (done) return; done = true; clearTimeout(t); show(b || offline); });
  }
  // the Chronicler invents today's side quest from everything that happened (one a day, from day 2)
  function inventToday() {
    const S = game.state; if (!chronicler.available() || S.night < 2 || S.story.inventDay === S.night || inventToday.busy) return;
    inventToday.busy = true;
    chronicler.invent(game.story().fullContext(), QUEST_TEMPLATES).then(q => { inventToday.busy = false; if (q && game && !game.state.over) game.story().invent(q); });
  }

  // ---------- cards ----------
  function showCard(kind, html, o = {}) {
    const fresh = card !== kind || o.anim; card = kind; const c = $('#card');
    c.className = `card${o.sys ? ' sysw' : ''}${o.cls ? ` ${o.cls}` : ''}${o.narrow ? '' : ' wide'}`;
    c.innerHTML = html; $('#overlay').hidden = false; $('#overlay').classList.toggle('jobov', /jobw/.test(o.cls || '')); if (kind !== 'start') $('#episode').hidden = true;   // a window never opens under the dusk/episode banner
    ctoast.clear(); callouts.hide();
    if (o.arm !== false) { c.classList.add('arming'); c.dataset.armed = '0'; setTimeout(() => { if (c.dataset.armed === '0') { c.dataset.armed = '1'; c.classList.remove('arming'); } }, ARM_MS); }
    else c.dataset.armed = '1';
    if (o.sys && fresh) openBeat(c);
    c.scrollTop = 0;
  }
  const armed = () => $('#card').dataset.armed === '1';
  const onArmed = fn => e => { if (armed()) { audio.play('card'); fn(e); } };
  function hideCard() {
    const c = $('#card');
    if (card && c.classList.contains('sysw') && !reduced()) { c.classList.add('closing'); const k = card; setTimeout(() => { if (card === null || card === k) { $('#overlay').hidden = true; c.classList.remove('closing'); } }, 100); }
    else $('#overlay').hidden = true;
    card = null;
  }

  // ---------- story: encounters, the status window, companions ----------
  const encState = new Map();   // per encounter: { page, touched, shownAt }
  const aiBusy = new Set();
  const aiSkips = new Set(['gift', 'evolve', 'season', 'chapter', 'district', 'arrival', 'skill', 'window', 'difficulty', 'victory']);
  function aiFetch(enc) {
    if (!enc || enc.ai != null || !chronicler.available()) return;
    if (enc.kind === 'contract') {
      enc.ai = 'pending'; enc.aiAt = performance.now(); aiBusy.add(enc.id);
      chronicler.contract(game.story().fullContext(), enc).then(p => { aiBusy.delete(enc.id); enc.ai = p || 'none'; enc.aiReady = performance.now(); refreshIfOpen(enc); });
      return;
    }
    if (enc.kind === 'victory') {
      enc.ai = 'pending'; enc.aiAt = performance.now(); aiBusy.add(enc.id);
      const k = game.state.story.contract || { n: enc.season, name: enc.contract, finale: {} };
      chronicler.seasonRecap(game.story().fullContext(), k).then(p => { aiBusy.delete(enc.id); enc.ai = p || 'none'; enc.aiReady = performance.now(); refreshIfOpen(enc); });
      return;
    }
    if (aiSkips.has(enc.kind)) return;
    enc.ai = 'pending'; enc.aiAt = performance.now(); const id = enc.id; aiBusy.add(id);
    chronicler.rewrite(enc, game.story().context()).then(patch => { aiBusy.delete(id); enc.ai = patch || 'none'; enc.aiReady = performance.now(); refreshIfOpen(enc); });
  }
  /** Claude's words arrive: swap them in only if the card has been open less than AI_WAIT and nothing was tapped */
  function refreshIfOpen(enc) {
    const top = game && game.state.story.encounters[0], st = encState.get(enc.id);
    if (card !== 'enc' || top !== enc || !st || st.touched || performance.now() - st.shownAt > AI_WAIT) return;
    st.useAi = true; showEncounter(true);
  }
  const usePatch = enc => { const st = encState.get(enc.id); if (!enc.ai || typeof enc.ai !== 'object') return null; if (st && st.useAi === false) return null; return enc.ai; };

  // cause → consequence: every choice shows what it does as chips (green gains, red costs)
  function chipsOf(c) {
    const S = game.state, out = [], add = (cls, ic, t) => out.push(`<span class="chip ${cls}">${ic ? icon(ic) : ''}${t}</span>`), sg = n => (n > 0 ? `+${n}` : `−${-n}`);
    const noiseOn = S.noise !== undefined || S.feat.heat;
    if (c.cost && c.cost.gold) add('neg', 'scrap', `−${c.cost.gold}`);
    if (c.cost && c.cost.food) add('neg', 'food', `−${c.cost.food}`);
    const PERK = { heroDmg: ['sword', 'hero'], heroDmgMult: ['sword', 'hero'], keepHp: ['camp', 'Camp'], heroHp: ['heart', 'hero'], towerDmg: ['tower', 'towers'], heroSpeed: ['boots', 'speed'] };
    for (const f of c.fx || []) {
      if (f.op === 'gold') add(f.n > 0 ? 'pos' : 'neg', 'scrap', sg(f.n));
      else if (f.op === 'food') add(f.n > 0 ? 'pos' : 'neg', 'food', sg(f.n));
      else if (f.op === 'survivors') add(f.n > 0 ? 'pos' : 'neg', 'people', sg(f.n));
      else if (f.op === 'heat' && noiseOn) add(f.n > 0 ? 'neg' : 'pos', 'noise', sg(f.n));
      else if (f.op === 'perk' && PERK[f.key]) add(f.mul && f.mul < 1 ? 'neg' : 'pos', PERK[f.key][0], `${PERK[f.key][1]} up`);
      else if (f.op === 'flag' && f.key === 'beacon') add('pos', 'people', '+1 later');
      else if (f.op === 'flag' && f.key === 'garden') add('pos', 'food', '+1 a dawn');
      else if (f.op === 'flag' && f.key === 'scout') add('info', 'route', 'better route');
      else if (f.op === 'flag' && f.key === 'quiet') add('pos', 'quiet', 'quieter');
      else if (f.op === 'title') add('info', 'title', 'title');
      else if (f.op === 'blessing') add('pos', 'skill', 'skill');
      else if (f.op === 'openFor' || f.op === 'open') add('info', 'pin', 'a marker');
      else if (f.op === 'recruit' || f.op === 'recruitNew') add('pos', 'star', esc(c.npcName || 'joins you'));
      else if (f.op === 'lose') add('neg', 'heartBreak', 'leaves');
      else if (f.op === 'bond') add(f.n > 0 ? 'pos' : 'neg', 'heartFill', sg(f.n));
      else if (f.op === 'gamble') add('risk', 'dice', `${Math.round(f.p * 100)}%`);
      else if (f.op === 'risen') add('neg', 'skull', 'the dead rise');
      else if (f.op === 'hurt') add('neg', 'drop', 'you get hurt');
      else if (f.op === 'unique') add('risk', 'eye', 'boss fight');
      else if (f.op === 'fail' && !f.quiet) add('risk', f.after ? 'hourglass' : 'end', f.after ? 'they may not wait' : 'the story ends');
      else if (f.op === 'trial') add('info', 'sword', 'trial');
      else if (f.op === 'claimSite') add('pos', 'flag', 'yours for good');
      else if (f.op === 'stripSite') add('pos', 'scrap', `+${f.n}`);
    }
    return out.length ? `<span class="chips">${out.join('')}</span>` : '';
  }
  const richHint = t => rich(t).replace(/(^|[\s(])([+\-−]\s?\d+%?\s(?:more\s)?(?:scrap|food|people|person|noise|heat|bond|health|damage|hero damage|xp))/gi, '$1<b>$2</b>');
  const badge = (enc, P) => (chronicler.available() && !aiSkips.has(enc.kind) ? `<span class="chr${enc.ai === 'pending' ? ' busy' : ''}" title="The Chronicler (Claude) writes this run's story">${icon('quill')}${P ? 'Chronicler' : enc.ai === 'pending' ? 'writing' : ''}</span>` : '');

  function showEncounter(swap = false) {
    const S = game.state, enc = S.story.encounters[0]; if (!enc) { afterEncounter(); return; }
    paused = true; if (placing) stopPlacing(); closePanel();
    if (enc.ai === 'pending' && !aiBusy.has(enc.id)) enc.ai = null;   // a request lost to a reload
    aiFetch(enc);
    let st = encState.get(enc.id); if (!st) { st = { page: 0, touched: false, shownAt: performance.now(), useAi: null }; encState.set(enc.id, st); }
    if (st.useAi === null) st.useAi = enc.ai && typeof enc.ai === 'object' ? true : null;
    const isNew = !st.opened; st.opened = true;
    if (enc.kind === 'arrival') return showArrival(enc);
    if (enc.kind === 'contract') return showContract(enc, st, swap || !isNew);
    if (enc.kind === 'evolve' && enc.jobs) return showJob(enc, st, !isNew);
    if (enc.kind === 'victory') return showVictory(enc, st);
    if (enc.kind === 'skill') return showSkill(enc);
    if (enc.kind === 'window' || enc.kind === 'chapter') return showWindow(enc);
    const P = usePatch(enc);
    const title = P ? P.title : enc.title, line = P && P.line ? P.line : enc.speaker && enc.speaker.line;
    // the written story opens on the choice page (one paragraph); the Chronicler's beats are short pages
    const pages = P && P.beats && P.beats.length > 1 ? P.beats : [P ? P.scene : enc.scene];
    const pg = Math.min(st.page, pages.length - 1), last = pg >= pages.length - 1;
    const dots = pages.length > 1 ? `<div class="pgdots">${pages.map((_, k) => `<i class="${k === pg ? 'on' : k < pg ? 'past' : ''}"></i>`).join('')}</div>` : '';
    const opts = last ? `<div class="opts one encopts">${enc.choices.map(c => { const ok = !c.cost || game.story().can(c); const rar = c.rarity ? RARITY[c.rarity] : null;
        return `<button class="opt${rar ? ' rar' : ''}" data-choice="${c.id}" ${ok ? '' : 'disabled'} ${rar ? `style="--rar:${rar.color}"` : ''}><span class="nm"><span>${esc(P && P.labels && P.labels[c.id] || c.label)}</span>${rar ? `<span class="rarity">${rar.name}</span>` : ''}</span>${chipsOf(c)}${c.hint ? `<span class="ds">${richHint(c.hint)}</span>` : ''}</button>`; }).join('')}</div>`
      : `<div class="cardrow foot spread"><button class="btn ghost sm" id="encSkip">Skip</button><button class="btn big" id="encNext">Continue ${icon('next')}</button></div>`;
    showCard('enc', `<div class="enc ${enc.kind}"><div class="eyebrow"><span id="encEb"></span>${badge(enc, P)}</div>
      <h1 class="sm">${esc(title)}</h1>
      ${enc.speaker && pg === 0 ? `<div class="speaker"><b>${esc(enc.speaker.name)}</b><span>${rich(line || '')}</span></div>` : ''}
      <p class="scene page" id="encScene">${rich(pages[pg])}</p>${dots}${opts}</div>`, { sys: true, arm: !swap && pg === 0, anim: isNew });
    const eb = $('#encEb'); if (swap || st.ebDone) eb.innerHTML = sysRich(enc.eyebrow || '[System]'); else { st.ebDone = true; typeOn(eb, enc.eyebrow || '[System]', 60); }
    const next = () => { st.touched = true; st.page = pg + 1; showEncounter(); };
    if (!last) { $('#encNext').onclick = onArmed(next); $('#encScene').onclick = onArmed(next); $('#encSkip').onclick = onArmed(() => { st.touched = true; st.page = pages.length - 1; showEncounter(); }); }
    $$('[data-choice]').forEach(b => b.onclick = onArmed(() => { st.touched = true; if (P && P.chronicle) enc.aiChron = P.chronicle; if (game.choose(b.dataset.choice)) { encState.delete(enc.id); audio.play('claim'); afterEncounter(); } }));
  }
  function afterEncounter() {
    if (game.state.story.encounters.length) { showEncounter(); return; }
    hideCard(); paused = false;
  }
  // night 1: the window types itself into the air as the first of the dead reaches you; the gift is offered inside it
  function showArrival(enc) {
    const lines = (enc.lines || []).slice(1);
    showCard('enc', `<div class="arrival" id="arr"><div class="eyebrow"><span id="arEb"></span></div><h1 class="sm" id="arT"></h1>
      <ul class="lines">${lines.map((_, k) => `<li id="arL${k}"></li>`).join('')}</ul><div class="rule"></div>
      <div class="eyebrow" id="arG0"></div>
      <div class="gifts opts one">${enc.choices.map(c => `<button class="opt" data-gift="${c.id}"><span class="nm">${esc(c.label)}</span>${chipsOf({ fx: c.fx.filter(f => f.op !== 'title') })}<span class="ds">${esc(c.hint)}</span></button>`).join('')}</div>
      <div class="stamp" id="arS"></div></div>`, { sys: true, arm: false, anim: true });
    audio.play('card');
    let skip = false; const card0 = $('#card');
    const speed = () => (skip ? 4000 : 60);
    card0.onclick = e => { if (!e.target.closest('[data-gift]')) { skip = true; card0.querySelectorAll('.typing').forEach(el => { el.dataset.skip = '1'; }); } };
    (async () => {
      await typeOn($('#arEb'), enc.eyebrow, speed());
      await typeOn($('#arT'), enc.title, speed());
      for (let k = 0; k < lines.length; k++) { await typeOn($(`#arL${k}`), lines[k], speed()); if (!skip && !reduced()) await new Promise(r => setTimeout(r, 160)); }
      if (enc.choices.length > 1) await typeOn($('#arG0'), '[Choose your starting gift]', speed());
      if ($('#arr')) $('#arr').classList.add('ready');
    })();
    $$('[data-gift]').forEach(b => b.onclick = e => {
      e.stopPropagation(); if (!$('#arr').classList.contains('ready')) return;
      if (!game.choose(b.dataset.gift)) return; audio.play('claim');
      $$('[data-gift]').forEach(x => { x.disabled = true; x.style.opacity = x === b ? '1' : '.25'; });
      typeOn($('#arS'), SYSTEM.firstLight, 60).then(() => setTimeout(() => { revealSystem(); afterEncounter(); }, 1300));
    });
  }
  function revealSystem() {
    const ab = $('#ability'); if (game.heroDef.ability) { ab.hidden = false; ab.classList.remove('reveal'); void ab.offsetWidth; ab.classList.add('reveal'); }
    strip.say('[System online] Every choice is written down.', 'sys', true);
  }
  // a blessing is a skill: one line, one icon, one a dawn
  function showSkill(enc) {
    showCard('enc', `<div class="eyebrow"><span id="skEb"></span></div><div class="skillw" style="margin:14px 0 18px"><span class="glyph">${icon(enc.icon === 'star' ? 'star' : 'skill')}</span><span class="nm">${esc(enc.title)}</span><span class="ds">${esc(enc.scene)}</span></div>
      <div class="cardrow foot end"><button class="btn big" id="skOk">Take it</button></div>`, { sys: true, narrow: true, anim: true });
    typeOn($('#skEb'), enc.eyebrow, 60);
    $('#skOk').onclick = onArmed(() => { if (game.choose('take')) { audio.play('claim'); afterEncounter(); } });
  }
  // a window that explains something (a new system, a chapter retold): read at your own pace
  function showWindow(enc) {
    const lines = enc.lines && enc.lines.length ? enc.lines : [enc.scene];
    showCard('enc', `<div class="eyebrow"><span id="wEb"></span></div>${enc.title ? `<h1 class="sm">${esc(enc.title)}</h1>` : ''}<ul class="lines">${lines.map((_, k) => `<li id="wL${k}"></li>`).join('')}</ul>
      <div class="cardrow foot end"><button class="btn big" id="wOk">${esc(enc.choices[0].label)}</button></div>`, { sys: true, anim: true });
    (async () => { await typeOn($('#wEb'), enc.eyebrow, 80); for (let k = 0; k < lines.length; k++) await typeOn($(`#wL${k}`), lines[k], reduced() ? 1e9 : 90); })();
    $('#wOk').onclick = onArmed(() => { if (game.choose(enc.choices[0].id)) afterEncounter(); });
  }
  /** a one-off window outside the story queue (previously on) */
  function showInfo(w) {
    paused = true;
    showCard('info', `<div class="eyebrow"><span id="iEb"></span></div>${w.title ? `<h1 class="sm">${esc(w.title)}</h1>` : ''}<ul class="lines">${w.lines.map(l => `<li>${rich(l)}</li>`).join('')}</ul><div class="cardrow foot end"><button class="btn big" id="iOk">Go on</button></div>`, { sys: true });
    typeOn($('#iEb'), w.eyebrow, 60);
    $('#iOk').onclick = onArmed(() => { hideCard(); paused = false; });
  }
  // ---------- the job change: a System event, bigger with each tier ----------
  // tier 1 (Lv 15) the window opens over a dimmed world; tier 2 (Lv 30) it cracks; tier 3 (Lv 45) the whole screen
  function showJob(enc, st, again) {
    const t = enc.tier || 1, sel = st.sel || null, J = enc.jobs, pick = sel && J.find(j => j.cls === sel);
    const crack = t >= 2 ? `<svg class="jcrack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0 L46 18 L54 27 L44 41 L52 52 L41 66 L49 78 L43 100" /><path d="M46 18 L30 22 L18 15" /><path d="M44 41 L62 44 L74 36" /><path d="M41 66 L26 70 L12 64" />${t >= 3 ? '<path d="M54 27 L70 20 L88 26" /><path d="M52 52 L66 58 L84 54" /><path d="M49 78 L62 84 L80 80" />' : ''}</svg>` : '';
    const jcard = j => `<button class="jcard${j.yours ? ' yours' : ''}" data-job="${j.cls}" aria-pressed="${sel === j.cls}">
        <span class="jhead"><span class="jglyph">${icon(j.icon || 'star')}</span><span class="jname">${esc(j.name)}</span></span>
        ${j.famName ? `<span class="jfam${j.yours ? ' on' : ''}">${j.yours ? 'Your path · ' : ''}${esc(j.famName)} ${j.pct}%</span>` : ''}
        <span class="jwho">${esc(j.who)}</span>
        <ul class="jperks">${j.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul></button>`;
    showCard('enc', `<div class="job t${t}${again ? ' shown' : ''}">${crack}
      <div class="eyebrow"><span id="jEb"></span></div>
      <h1 class="jt">${esc(enc.title)}</h1>
      <p class="jpath">Your path: <b>${esc(enc.path)}</b></p>
      <p class="jscene">${rich(enc.scene)}</p>
      <div class="jobs n${J.length}">${J.map(jcard).join('')}</div>
      <p class="jboss">${icon('skull')}<span>Trial: beat <b>${esc(enc.boss)}</b> at the red marker, by day.</span></p>
      <div class="cardrow foot spread"><button class="btn ghost sm" id="jWait">Not yet</button><button class="btn big" id="jGo" ${pick ? '' : 'disabled'}>${pick ? `Take the trial: ${esc(pick.name)}` : J.length > 1 ? 'Pick a class' : `Take the trial: ${esc(J[0].name)}`}</button></div></div>`, { sys: true, cls: `jobw jt${t}`, arm: !again, anim: !again });
    if (J.length === 1 && !sel) { st.sel = J[0].cls; $('#jGo').disabled = false; }
    const eb = $('#jEb'); if (again || st.ebDone) eb.innerHTML = sysRich(enc.eyebrow); else { st.ebDone = true; audio.play('jobOpen', t); typeOn(eb, enc.eyebrow, t >= 3 ? 26 : 40); }
    $$('[data-job]').forEach(b => b.onclick = onArmed(() => { st.touched = true; st.sel = b.dataset.job; const y = $('#card').scrollTop; showJob(enc, st, true); $('#card').scrollTop = y; }));
    $('#jWait').onclick = onArmed(() => { if (game.choose('wait')) { encState.delete(enc.id); afterEncounter(); } });
    $('#jGo').onclick = onArmed(() => { if (!st.sel) return; if (game.choose(`trial-${st.sel}`)) { audio.play('claim'); encState.delete(enc.id); afterEncounter(); } });
  }
  /** the class is yours: the screen flashes in the tier's colour, the System stamps the name, the hero changes */
  function classBeat(e) {
    const t = e.tier || 1; let el = $('#jobBeat'); if (!el) { el = document.createElement('div'); el.id = 'jobBeat'; document.body.appendChild(el); }
    el.className = `jb t${t}`; el.innerHTML = `<div class="jbin"><div class="jbe">${t >= 3 ? '[LEGENDARY CLASS ACQUIRED]' : '[Class acquired]'}</div><div class="jbn">${esc(e.name || '')}</div>${t >= 2 ? `<div class="jbs">${t >= 3 ? 'The city will learn this name.' : 'You are more than you were.'}</div>` : ''}</div>`;
    el.hidden = false; void el.offsetWidth; el.classList.add('go'); audio.play('classUp', t);
    clearTimeout(el._t); el._t = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 600); }, [2200, 3000, 4200][t - 1]);
  }
  // ---------- seasons as contracts ----------
  function showContract(enc, st, swap) {
    const P = usePatch(enc), sel = st.sel || null;
    const pick = id => enc.offers.find(o => o.id === id);
    const pips = n => `<span class="pips" aria-hidden="true">${[1, 2, 3].map(k => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span>`;
    const card1 = o => { const nm = (P && P.names && P.names[o.id]) || o.name, tw = (P && P.twists && P.twists[o.id]) || o.twist, T = o.terms, tier = T.tier || { tag: 'Risky', pips: 2 };
      return `<button class="contract t${tier.pips}" data-k="${o.id}" aria-pressed="${sel === o.id}">
        <span class="ktop"><span class="ktag">${pips(tier.pips)}${esc(tier.tag)}</span><span class="kname">${esc(nm)}</span></span>
        <span class="kgoal">${icon(o.finale.kind === 'unique' ? 'skull' : 'flame')}<span>${esc(T.goal)}</span></span>
        <span class="kwhere">${esc(T.where)}</span>
        <span class="kline catch"><b>Catch</b>${esc(T.catch)}</span>
        <span class="kline gain"><b>Reward</b>${esc(T.gain)} <em>${esc(T.legacy)}</em></span>
        ${tw ? `<span class="tw">${esc(tw)}</span>` : ''}</button>`; };
    const selGoal = sel ? pick(sel).terms.goal.replace(/^\w/, c => c.toLowerCase()) : '';
    showCard('enc', `<div class="eyebrow"><span id="kEb"></span>${chronicler.available() ? `<span class="chr${enc.ai === 'pending' ? ' busy' : ''}">${icon('quill')}${P ? 'Chronicler' : enc.ai === 'pending' ? 'writing' : ''}</span>` : ''}</div>
      <h1 class="sm">${esc(enc.title)}</h1><p class="scene kscene">${rich(enc.scene)}</p>
      <div class="contracts">${enc.offers.map(card1).join('')}</div>
      <p class="note">${rich(CONTRACT_COPY.legacyNote)}</p>
      <div class="cardrow foot end"><button class="btn big" id="kSign" ${sel ? '' : 'disabled'}>${sel ? esc(CONTRACT_COPY.sign.replace('{goal}', selGoal)) : CONTRACT_COPY.pick}</button></div>`, { sys: true, arm: !swap, anim: !swap });
    const eb = $('#kEb'); if (swap || st.ebDone) eb.innerHTML = sysRich(enc.eyebrow); else { st.ebDone = true; typeOn(eb, enc.eyebrow, 60); }
    $$('[data-k]').forEach(b => b.onclick = onArmed(() => { st.touched = true; st.sel = b.dataset.k; const y = $('#card').scrollTop; showContract(enc, st, true); $('#card').scrollTop = y; }));
    $('#kSign').onclick = onArmed(() => { if (!st.sel) return; if (game.choose(st.sel)) { audio.play('claim'); encState.delete(enc.id); afterEncounter(); } });
  }
  function seasonLines(n) {
    const S = game.state, from = n > 1 ? (S.story.seasons || []).find(s => s.n === n) : null, d0 = from ? from.day : 1;
    const L = S.story.chronicle.filter(c => c.day >= d0 && c.imp >= 4 && !/contract|status window/i.test(c.text));
    return [...L.filter(c => !/: "/.test(c.text)), ...L.filter(c => /: "/.test(c.text))].slice(0, 3).sort((a, b) => a.day - b.day).map(c => chronLine(c.text));
  }
  function showVictory(enc, st) {
    const P = usePatch(enc), beats = P && P.beats ? P.beats : (seasonLines(enc.season).length ? seasonLines(enc.season) : ['You held the Camp through a whole season.']), next = (P && P.next) || enc.next;
    showCard('enc', `<div class="eyebrow"><span id="vEb"></span>${chronicler.available() ? `<span class="chr">${icon('quill')}${P ? 'Chronicler' : ''}</span>` : ''}</div>
      <h1 class="big">${esc(enc.title)}</h1><p class="scene">${rich(enc.scene)}</p>
      <ul class="obit">${beats.map(b => `<li>${rich(b)}</li>`).join('')}</ul><div class="nexton">${esc(next)}</div>
      <div class="chips" style="margin:12px 0 4px"><span class="chip info">${icon('level')}easier nights</span><span class="chip pos">${icon('scrap')}+${enc.reward.scrap}</span><span class="chip pos">${icon('skill')}a rare blessing</span><span class="chip pos">${icon('star')}+${enc.reward.fame} Legacy</span></div>
      <div class="cardrow foot end"><button class="btn big" id="vOk">${esc(enc.choices[0].label)}</button></div>`, { sys: true, anim: !st.ebDone });
    const eb = $('#vEb'); if (st.ebDone) eb.innerHTML = sysRich(enc.eyebrow); else { st.ebDone = true; typeOn(eb, enc.eyebrow, 60); }
    $('#vOk').onclick = onArmed(() => { st.touched = true; if (game.choose('take')) { const L = store.get('legacy', { fame: 0, owned: {} }); L.fame += enc.reward.fame; store.set('legacy', L); audio.play('claim'); afterEncounter(); } });
  }

  function showStatus() {
    const S = game.state, ST = S.story, comp = ST.npcs.filter(n => n.joined && n.alive), K = ST.contract;
    paused = true; if (placing) stopPlacing(); closePanel();
    const hero = game.heroDef, q = game.story().dailyProgress();
    showCard('status', `<button class="closex" id="stX" aria-label="Close">${icon('close')}</button><div class="eyebrow">[Status]</div>
      <h1 class="sm">${esc(hero.name)} · Lv ${S.lvl}</h1>
      <div class="statgrid"><span>Health<b>${Math.ceil(S.hero.hp)}/${S.hero.maxHp}</b></span><span>Xp<b>${S.xp}/${game.xpNext()}</b></span><span>Day<b>${S.night}</b></span><span>Dead put down<b>${S.kills}</b></span><span>People<b>${game.pop()}</b></span><span>Season<b>${S.season.n}</b></span></div>
      ${q ? `<h2>Daily quest</h2><div class="kontrakt"><b>${q.penalty ? '[Penalty] ' : ''}${esc(q.title)}</b><span>${esc(q.goal)} · ${q.done ? 'done' : `${q.have}/${q.n}`}</span></div>` : ''}
      ${K ? `<h2>Contract</h2><div class="kontrakt"><b>${esc(K.name)}${K.won ? ' · won' : ''}</b><span>${K.finale.kind === 'unique' ? `${esc(K.finale.name)} walks on night ${K.finale.night}.` : `Burn ${esc(K.finale.name)} by night ${K.finale.night}.`}${S.season.rules && S.season.rules.length ? ` Rules: ${S.season.rules.map(r => esc(RULES[r] ? RULES[r].name : r)).join(', ')}.` : ''}</span>${K.twist ? `<span style="color:#c6b8ff;font-style:italic">${esc(K.twist)}</span>` : ''}</div>` : ''}
      <h2>Your path</h2>${pathHtml()}
      <h2>Titles</h2><div class="titles">${ST.titles.length ? ST.titles.map(t => `<span class="title" title="${esc(TITLES[t].desc)}">${icon('title')}${esc(TITLES[t].name)}</span>`).join('') : '<span class="note">None yet. The System is watching.</span>'}</div>
      <h2>Companions</h2><div class="comps">${comp.length ? comp.map(n => `<div class="comp"><b>${esc(n.name)}</b><span>${n.withHero ? 'Travels with you · their post stands empty' : `${esc(ROLES[n.role].post)} · ${esc(ROLES[n.role].bonus)}`}</span><span class="bond">${Array.from({ length: 5 }, (_, k) => icon(k < n.bond ? 'heartFill' : 'heart')).join('')}</span><span class="acts"><button class="btn sm sys" data-chat="${n.id}">Talk</button><button class="btn sm sys ghost" data-follow="${n.id}" data-on="${n.withHero ? 0 : 1}">${n.withHero ? 'Back to post' : 'With me'}</button></span></div>`).join('') : '<span class="note">Nobody yet. Answer the calls: people are out there.</span>'}</div>
      <h2>Chronicle</h2><ol class="chron">${ST.chronicle.slice().reverse().slice(0, 14).map(c => `<li><span>Day ${c.day}</span>${esc(c.text)}</li>`).join('')}</ol>
      <p class="note" style="margin-top:10px">${lastSave ? `Saved at dawn of day ${lastSave.day} (${lastSave.where === 'cloud' ? 'your account' : 'this device'}).` : 'The run saves itself every dawn.'}</p>
      <label class="aitog"><input type="checkbox" id="aiTog" ${chronicler.enabled() ? 'checked' : ''}><span>Chronicler (Claude writes the story) · ${({ on: 'on', off: 'off', denied: 'not allowed', absent: 'not available here' })[chronicler.status()]}</span></label>
      <div class="cardrow foot end"><button class="btn big" id="stClose">Back</button></div>`, { sys: true, arm: false });
    $('#stClose').onclick = $('#stX').onclick = () => { hideCard(); paused = false; };
    $('#aiTog').onchange = e => { chronicler.setEnabled(e.target.checked); };
    $$('[data-chat]').forEach(b => b.onclick = () => showChat(b.dataset.chat));
    $$('[data-follow]').forEach(b => b.onclick = () => { game.companionFollow(b.dataset.follow, b.dataset.on === '1'); showStatus(); });
  }
  function pathHtml() {
    const S = game.state, P = S.path, tot = Object.values(P).reduce((a, b) => a + b, 0) || 1, cls = S.heroClass;
    const next = cls === 'survivor' ? `Your class unlocks at level ${CLASS_TIERS[0].lvl} (you are ${S.lvl}).` : !HEROES[cls].base ? `It grows at level ${CLASS_TIERS[1].lvl} (you are ${S.lvl}).` : !HEROES[cls].legend ? `Its legendary form: level ${CLASS_TIERS[2].lvl} (you are ${S.lvl}).` : 'Legendary. Your class is complete.';
    const tr = S.story.trial && !S.story.trial.done ? `<p class="note" style="color:#ff9a80">${esc(S.story.trial.name)} waits at the red marker.</p>` : '';
    return `<div class="path">${['hero', 'ranger', 'scavver', 'heart'].map(f => `<div class="pr" style="--fam:${FAMILIES[f].color}"><span>${FAMILIES[f].name}</span><span class="pb"><i style="width:${Math.round(P[f] / tot * 100)}%"></i></span><b>${Math.round(P[f] / tot * 100)}%</b></div>`).join('')}</div>
      <p class="note" style="margin-top:6px">Rescues and mercy lean to Heart, fighting up close to Brawn, scouting and quiet to Aim, deals and salvage to Wits. ${next}</p>${tr}`;
  }
  const chats = {};
  function showChat(id) {
    const S = game.state, n = game.story().npc(id); if (!n) return;
    const hist = chats[id] || (chats[id] = []);
    const ai = chronicler.available(), left = Math.max(0, 6 - n.chatToday);
    const bark = k => { const L = BARKS[k]; const t = L[(n.chatToday + hist.length + n.id.length) % L.length]; const open = S.landmarks.filter(l => !S.sealed[l.region] && l.kind !== 'unknown'); return t.replace('{want}', n.persona.want).replace('{fear}', n.persona.fear).replace('{heat}', Math.round(S.noise ?? S.heat ?? 0)).replace('{pop}', game.pop()).replace('{district}', open.length ? 'The road by the ' + open[open.length - 1].kind : 'The fence'); };
    showCard('chat', `<button class="closex" id="chX" aria-label="Back">${icon('close')}</button><div class="eyebrow">[${esc(ROLES[n.role].post)}] bond ${n.bond}/5${n.named ? ' · named' : ''}</div><h1 class="sm">${esc(n.name)}</h1>
      <p class="note">${esc(n.persona.traits.join(', '))} · ${esc(n.persona.quirk)}</p>
      <div class="msgs" id="msgs">${hist.map(m => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('') || `<div class="msg assistant">${esc(bark('you'))}</div>`}</div>
      ${ai ? `<form class="say" id="sayForm"><input id="sayIn" maxlength="160" autocomplete="off" placeholder="${left ? 'Say something…' : `${n.name.split(' ')[0]} has work to do. Tomorrow.`}" ${left ? '' : 'disabled'}><button class="btn sys" ${left ? '' : 'disabled'}>Say</button></form><p class="note">${left} more ${left === 1 ? 'talk' : 'talks'} today</p>`
        : `<div class="topics"><button class="btn sys ghost" data-topic="self">About you</button><button class="btn sys ghost" data-topic="city">The road</button><button class="btn sys ghost" data-topic="you">About me</button></div>`}
      <div class="cardrow foot"><button class="btn ghost" id="chatBack">Back</button></div>`, { sys: true, arm: false });
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
  // ---------- the More sheet: everything rarely touched ----------
  let speed = 1; const SPEEDS = [1, 2, 3];
  const QNAME = { high: 'High', medium: 'Medium', low: 'Low' }, QNEXT = { high: 'medium', medium: 'low', low: 'high' };
  function showMore() {
    if (!game || card) return;
    paused = true; closePanel(); if (placing) stopPlacing();
    const S = game.state, m = audio.muted();
    showCard('more', `<button class="closex" id="moX" aria-label="Close">${icon('close')}</button><div class="eyebrow">The Camp</div><h1 class="sm">More</h1>
      <div class="moregrid">
        <button id="moStatus">${icon('level')}<span>Status<small>titles, companions</small></span></button>
        <button id="moMap">${icon('map')}<span>Map<small>where you have been</small></span></button>
        <button id="moSnd" aria-pressed="${!m}">${icon(m ? 'mute' : 'sound')}<span>Sound<small>${m ? 'off' : 'on'}</small></span></button>
        <button id="moQ">${icon('sun')}<span>Graphics<small>${view ? QNAME[view.quality()] : ''}</small></span></button>
        <button id="moSpd" aria-pressed="${speed > 1}">${icon('clock')}<span>Speed<small>${speed}×</small></span></button>
        <button id="moAuto" aria-pressed="${!!S.autopilot}">${icon('run')}<span>Autopilot<small>${S.autopilot ? 'on' : 'off'}</small></span></button>
        ${matchMedia('(pointer: coarse)').matches ? '' : `<button id="moZi">${icon('zoomIn')}<span>Zoom in</span></button><button id="moZo">${icon('zoomOut')}<span>Zoom out</span></button>`}
        ${FLAGS.runLog ? `<button id="moLog">${icon('map')}<span>Run log</span></button>` : ''}
      </div>
      <div class="cardrow foot end"><button class="btn big" id="moOk">Back</button></div>`, { arm: false, narrow: true });
    const back = () => { hideCard(); paused = false; };
    $('#moOk').onclick = $('#moX').onclick = back;
    $('#moStatus').onclick = () => { hideCard(); showStatus(); };
    $('#moMap').onclick = () => { hideCard(); showMap(); };
    $('#moSnd').onclick = () => { audio.setMuted(!audio.muted()); hideCard(); showMore(); };
    $('#moQ').onclick = () => { if (!view) return; const q = QNEXT[view.quality()]; view.setQuality(q); store.set('quality', q); hideCard(); showMore(); };
    $('#moSpd').onclick = () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; hideCard(); showMore(); };
    $('#moAuto').onclick = () => { const on = !game.state.autopilot; game.setAutopilot(on); $('#autoTag').hidden = !on; hideCard(); showMore(); };
    if ($('#moZi')) { $('#moZi').onclick = () => view && view.setZoom(view.getZoom() * 0.8); $('#moZo').onclick = () => view && view.setZoom(view.getZoom() * 1.25); }
    if ($('#moLog')) $('#moLog').onclick = () => { hideCard(); paused = false; showLog(); };
  }

  // ---------- log and ending ----------
  function logTable() {
    const rows = game.logRows(); if (!rows.length) return '<p class="note">No nights played yet.</p>';
    const pk = id => id.startsWith('m:') ? id.slice(2) : (PERKS.find(p => p.id === id) || { name: id }).name;
    return `<div class="logwrap"><table class="log"><thead><tr><th>Night</th><th>Camp left</th><th>Threat</th><th>Wave HP</th><th>Tower DPS</th><th>Kills hero·tower·Camp</th><th>Lost</th><th>Scrap in / spent</th><th>Skills</th></tr></thead><tbody>${rows.map(l => {
      const kp = l.keepEnd !== undefined ? Math.round(l.keepEnd / l.keepMax * 100) : null;
      return `<tr><td>${l.night}${l.bloodMoon ? ' (blood moon)' : ''}</td><td>${kp !== null ? kp + '%' : 'now'}</td><td>${l.ratio ?? '–'}</td><td>${l.waveHp}</td><td>${l.defDps}</td>
      <td>${l.kills.hero || 0} · ${l.kills.tower || 0} · ${l.kills.keep || 0}</td><td>${l.lost.length}${l.risen ? ` (${l.risen} rose)` : ''}</td><td>+${l.goldIn ?? 0} / ${l.spent}</td><td>${l.perks.map(pk).join(', ') || '–'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function showLog() {
    if (!game || paused) return;
    paused = true; closePanel(); if (placing) stopPlacing();
    showCard('log', `<button class="closex" id="logX" aria-label="Close">${icon('close')}</button><div class="eyebrow">Run log · night ${game.state.night}</div><h1 class="sm">The ledger</h1>${logTable()}<div class="cardrow foot"><button class="btn ghost" id="logClose">Back</button></div>`, { arm: false });
    $('#logClose').onclick = $('#logX').onclick = () => { hideCard(); paused = false; };
  }
  /** the obituary the script writes when the Chronicler is off or slow */
  function obituaryScript() {
    const S = game.state, ST = S.story, comps = ST.npcs.filter(n => n.joined && n.alive).map(n => n.name.split(' ')[0]);
    const big = ST.chronicle.filter(c => c.imp >= 4 && !/^Woke up|contract|title/i.test(c.text)).slice(-1)[0];
    const L = ST.lostContract;
    return [
      `You woke in the woods with a window only you could see, and a bus full of strangers who chose to follow you.`,
      big ? `Day ${big.day}. ${chronLine(big.text)}` : `You held the Camp for ${S.night - 1} ${S.night - 1 === 1 ? 'night' : 'nights'}${comps.length ? `, with ${comps.slice(0, 2).join(' and ')} beside you` : ''}.`,
      L ? `The contract "${L.name}" ran out on night ${L.night}. ${L.finale} was still out there.` : `On night ${S.night} the Camp fell, and the window closed.`,
    ];
  }
  function showEnd() {
    const S = game.state, st = S.stats, prev = store.get('best', 0), best = Math.max(prev, S.night), ST = S.story;
    store.set('best', best); store.set('runs', store.get('runs', 0) + 1);
    const kills = Object.values(st.killsByKind || {}).reduce((a, b) => a + b, 0), by = st.killsBy || {};
    const stats = [['Dead put down', kills], ['Your kills', by.hero || 0], ['Scrap earned', st.goldEarned], ['Buildings raised', st.built], ['Sites claimed', st.sites || 0], ['Companions', ST.npcs.filter(n => n.joined).length], ['Titles', ST.titles.length], ['Most people', st.peakPop], ['Hives burned', st.regionsClaimed], ['Buildings lost', st.buildingsLost], ['Times you fell', st.heroDeaths], ['Contracts won', ST.wins || 0]];
    const lastPages = ST.chronicle.filter(c => c.imp >= 3).slice(-3);
    const L = ST.lostContract, survived = Math.max(0, S.night - 1);
    let beats = obituaryScript(), shownAt = performance.now();
    const render = () => {
      showCard('end', `<div class="eyebrow"><span>${L ? `[Contract failed: ${esc(L.name)}]` : '[The window closes]'}</span>${chronicler.available() ? `<span class="chr">${icon('quill')}Chronicler</span>` : ''}</div>
        <h1 class="big">${L ? 'The season ends without you' : 'The Camp has fallen'}</h1>
        <div class="bignum"><b>${survived}</b><span>${survived === 1 ? 'night' : 'nights'} survived${S.night > prev ? ' · a new best' : ` · best ${best}`}</span></div>
        <ul class="obit">${beats.map(b => `<li>${rich(b)}</li>`).join('')}</ul>
        <h2>The last pages</h2><ol class="lastpages">${lastPages.map(c => `<li><span>Day ${c.day}</span>${esc(chronLine(c.text))}</li>`).join('')}</ol>
        <details class="fold"><summary>The numbers</summary><div class="endstats">${stats.map(([k, v]) => `<div><b>${v ?? 0}</b><span>${k}</span></div>`).join('')}</div><p class="note">+${S.fameEarned || 0} fame for the next run.</p></details>
        <div class="cardrow foot end"><button class="btn big" id="again">New run</button></div>`, { sys: true });
      $('#again').onclick = onArmed(() => { location.reload(); });
    };
    render();
    if (chronicler.available()) chronicler.obituary(game.story().fullContext(), L ? `the contract "${L.name}" was lost` : `the Camp fell on night ${S.night}`).then(b => { if (b && card === 'end' && performance.now() - shownAt < AI_WAIT * 2) { beats = b; render(); } });
  }

  // ---------- the System speaks; the Camp gets small toasts ----------
  const SUPPRESS = [/^Dusk\. Night \d+/, /^Something crawls out of the dark/, /destroyed\. It will be rebuilt at dawn/, /^A house fell\. Its family/, /^\[Tip:/, /^Tonight: /];
  const BEAT = /^\[(Title acquired|Skill acquired|Class acquired|Level up|Contract|Quest complete|Daily quest|Penalty quest|System online|Unique Monster|Naming|Trial)/;
  function toast(msg, kind) {
    msg = campCopy(msg);
    if (SUPPRESS.some(r => r.test(msg))) return;
    if (/^\[Title acquired: First Light\]/.test(msg) && game && game.state.night <= 2) return;   // the arrival window already stamped it
    const dawn = /^Dawn\. ([+-]?\d+) scrap.*?, \+(\d+) food\. Citizens ate (\d+)\./.exec(msg);
    if (dawn) { const line = `Dawn · **${+dawn[1] >= 0 ? '+' : '−'}${Math.abs(+dawn[1])}** scrap · **+${dawn[2]}** food · ate ${dawn[3]}`; dawnLine = line; setTimeout(() => { if (!ledgerUp) ctoast.show(line, 'good', 'sun'); }, 700); return; }
    const sys = /^\[[^\]]+\]/.exec(msg);
    if (sys && systemHere()) { strip.say(msg, kind === 'win' ? 'sys' : kind, BEAT.test(msg) || kind === 'win'); return; }
    ctoast.show(sys ? msg.replace(/^\[([^\]]+)\]\s*/, '$1. ') : msg, kind, kind === 'bad' ? 'skull' : null);
  }
  // the night's losses, grouped: one line at dawn ("3 towers and a farm fell on the east side")
  let losses = [], pendingLedger = null, dawnLine = '', ledgerUp = false;
  function noteLoss(id) { const b = game.state.byId.get(id); if (!b || b.type === 'wall' && losses.filter(l => l.type === 'wall').length > 12) return; const a = Math.atan2(b.y - game.map.town.y, b.x - game.map.town.x); losses.push({ type: b.type, dir: DIR8[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8] }); }
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

  // ---------- build tray and placement ----------
  const stockTotal = () => Object.values(game.state.stock).reduce((a, b) => a + b, 0);
  const handsLeft = () => (typeof game.handsFree === 'function' ? game.handsFree() : Infinity);
  let trayKey = '';
  function renderTray() {
    const S = game.state, tray = $('#tray');
    tray.hidden = !!card;
    if (tray.hidden) { trayKey = ''; return; }
    const hands = handsLeft(), showForeman = (S.foreman || S.autopilot) && (FLAGS.foremanFirstRun || !firstRun());
    const sig = [S.gold, JSON.stringify(S.stock), placing && placing.type, S.builders, showForeman, S.feat.power, game.keepLevel(), S.buildings.length, hands > 0].join('|'); if (sig === trayKey) return; trayKey = sig;
    const FOCUS = { defence: 'Defence', balanced: 'Balanced', growth: 'Growth', off: 'Off' };
    const bRow = showForeman ? `<div class="builders" role="group" aria-label="What your builders focus on"><span>Foreman</span>${Object.entries(FOCUS).map(([k, v]) => `<button data-focus="${k}" aria-pressed="${(S.builders || 'off') === k}">${v}</button>`).join('')}</div>` : '';
    tray.innerHTML = bRow + BUILD_ORDER.filter(t => t !== 'generator' || S.feat.power).map(t => {
      const n = S.stock[t] || 0, cost = n ? 0 : game.buyCost(t), on = placing && placing.type === t;
      return `<button class="tb ${t}${on ? ' on' : ''}${n ? ' have' : ''}" data-tray="${t}" ${(!n && S.gold < cost) || hands < 1 ? 'aria-disabled="true"' : ''}><i></i><span class="tn">${SHORT[t]}</span>${n ? `<span class="tc">×${n}</span>` : `<span class="cost">${icon('scrap')}${cost}</span>`}</button>`;
    }).join('') + TECH_ORDER.map(t => {
      const have = S.buildings.some(b => b.type === t), locked = game.keepLevel() < BUILDINGS[t].keep, cost = game.buyCost(t), on = placing && placing.type === t;
      if (have || game.keepLevel() < 2) return '';
      return `<button class="tb tech ${t}${on ? ' on' : ''}" data-tray="${t}" ${locked || S.gold < cost || hands < 1 ? 'aria-disabled="true"' : ''} title="${BUILDINGS[t].desc[0]}"><i></i><span class="tn">${SHORT[t]}</span>${locked ? '<span class="tc">Camp 2</span>' : `<span class="cost">${icon('scrap')}${cost}</span>`}</button>`;
    }).join('');
  }
  function setDrawer(open) { $('#tray').classList.toggle('open', open); $('#tray').hidden = !open || !!card; $('#buildBtn').setAttribute('aria-expanded', open); if (open) { closePanel(); trayKey = ''; renderTray(); } dockH(); }
  $('#buildBtn').onclick = () => setDrawer(!$('#tray').classList.contains('open'));
  $('#moreBtn').onclick = () => showMore();
  $('#tray').addEventListener('click', e => {
    const f = e.target.closest('[data-focus]'); if (f && game) { game.setBuilders(f.dataset.focus); trayKey = ''; renderTray(); toast(f.dataset.focus === 'off' ? 'The Foreman stands down. You build by hand.' : `The Foreman builds by himself now: ${f.dataset.focus}.`); return; }
    const b = e.target.closest('[data-tray]'); if (!b || !game || paused) return;
    const t = b.dataset.tray;
    if (placing && placing.type === t) { stopPlacing(); return; }
    if (BUILDINGS[t].tech && game.keepLevel() < BUILDINGS[t].keep) { toast(`Raise the Camp to level ${BUILDINGS[t].keep} to build a ${SHORT[t]}.`, 'bad'); return; }
    if (!(game.state.stock[t] > 0) && game.state.gold < game.buyCost(t)) { toast(`A ${SHORT[t].toLowerCase()} costs ${game.buyCost(t)} scrap.`, 'bad'); return; }
    if (handsLeft() < 1) { toast('Everyone is busy today. More people, more hands.', 'bad'); return; }
    startPlacing(t);
  });
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
  function tidy(sp) {
    const S = game.state; let x0 = N, y0 = N, x1 = 0, y1 = 0;
    for (const c of sp.cells) { const x = c % N, y = (c / N) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    let n = 0;
    for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
      if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) continue;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const o = S.occ[idx(x, y)]; if (o >= 0 && S.byId.get(o) && S.byId.get(o).type !== 'wall') n++;
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
    setDrawer(false); closePanel();
    const h = game.state.hero;
    placing = { type, x: h.x, y: h.y - 3, start: null };
    refreshZone();
    let best = null, bd = Infinity; for (const sp of placing.zone.spots) { const d = Math.hypot(sp.x - h.x, sp.y - (h.y - 3)); if (d < bd) { bd = d; best = sp; } }
    if (best) { placing.x = best.x; placing.y = best.y; }
    if (!placing.zone.spots.length) toast(type === 'wall' ? 'No open ground left for barricades.' : `No room left for a ${SHORT[type].toLowerCase()}. Claim more land or pull something down.`, 'bad');
    updateGhost(); $('#place').hidden = false; renderTray(); dockH();
  }
  function stopPlacing() { placing = null; $('#place').hidden = true; renderTray(); dockH(); }
  const wallAt = (x, y) => { const o = game.state.byId.get(game.state.occ[idx(x, y)]); return o && o.type === 'wall'; };
  function updateGhost() {
    if (!placing) return;
    const S = game.state, t = placing.type;
    if (t === 'wall') return updateWallGhost();
    const sp = snap(placing.x, placing.y);
    const p = sp ? game.canPlace(t, sp.x, sp.y, 0, { deep: true }) : game.canPlace(t, placing.x, placing.y, 0, { deep: true });
    placing.ghost = { type: t, x: p.x, y: p.y, rot: 0, ok: p.ok, cells: p.cells, lot: (p.lot || []).filter(i => !p.cells.includes(i)) };
    placing.reason = p.reason;
    const n = S.stock[t] || 0;
    $('#placeInfo').innerHTML = p.ok ? `${BUILDINGS[t].name}${n ? ` · ${n} in hand` : ` · ${icon('scrap')} ${game.buyCost(t)}`}` : `<span class="warn">${esc(campCopy(p.reason || 'No room here.'))}</span>`;
    $('#pOk').textContent = 'Place'; $('#pOk').disabled = !p.ok;
  }
  function updateWallGhost() {
    const S = game.state, budget = game.wallBudget();
    let [ex, ey] = cellOf(placing.x, placing.y);
    if (!placing.start) {
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
      $('#placeInfo').innerHTML = ok ? `Barricade · ${touchUI ? 'tap' : 'click'} where the line starts` : `<span class="warn">${esc(game.canPlace('wall', ex + 0.5, ey + 0.5).reason || 'No room here.')}</span>`;
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
    $('#placeInfo').innerHTML = n ? `${n} ${n === 1 ? 'post' : 'posts'}${inHand ? ` · ${inHand} in hand` : ''}${paid ? ` · ${icon('scrap')} ${paid * game.buyCost('wall')}` : ''}` : `<span class="warn">${budget ? 'Nothing fits along this line.' : `Out of posts. One costs ${game.buyCost('wall')} scrap.`}</span>`;
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
    return [S.gold, S.food, S.phase, selected && selected.type, selected && selected.id, selected && selected.type === 'landmark' ? game.landmarkReach(selected.id) : '', b ? `${b.level}:${Math.ceil(b.hp)}:${b.maxHp}:${Math.floor((b.built ?? 1) * 20)}:${b.ruined ? 1 : 0}` : ''].join('|');
  }
  function openSel(sel) { if ($('#tray').classList.contains('open')) setDrawer(false); selected = sel; renderPanel(); lastSig = panelSig(); $('#panel').hidden = false; dockH(); }
  function closePanel() { selected = null; $('#panel').hidden = true; dockH(); }
  const opt = (id, data, name, cost, ds, disabled) => `<button class="opt" id="${id}" ${data} ${disabled ? 'disabled' : ''}><span class="nm">${name}${cost !== null ? `<span class="cost">${icon('scrap')}${cost}</span>` : ''}</span><span class="ds">${ds}</span></button>`;
  function flushToasts() { for (const e of game.drainEvents()) if (e.t === 'toast' || e.t === 'fail') toast(e.msg, e.t === 'fail' ? 'bad' : e.kind); }
  function renderPanel() {
    if (!selected || !game) return;
    const S = game.state, body = $('#pBody'), day = !S.over;
    if (selected.type === 'keep') {
      const k = S.keep, l = k.level;
      $('#pEyebrow').textContent = 'Your home'; $('#pTitle').textContent = `The Camp · level ${l}`;
      let html = `<div class="stat"><span>Health <b>${Math.ceil(k.hp)} / ${k.maxHp}</b></span><span>${campCopy(KEEP.desc[l - 1])}</span></div><div class="opts two">`;
      const miss = l < 3 ? game.keepNeeds() : [];
      html += l < 3 ? opt('opt-keep', 'data-keep="1"', 'Raise the Camp', KEEP.cost[l], miss.length ? `Still needed: ${miss.join(' · ')}` : `${campCopy(KEEP.desc[l])} · buildings up to level ${l + 1}`, miss.length > 0 || S.gold < KEEP.cost[l] || !day) : '';
      if (FLAGS.trader && S.trade && !S.trade.done && day) html += opt('opt-trader', 'data-trader="1"', 'Visit the trader', null, 'One deal before nightfall.', false);
      body.innerHTML = html + '</div>' + (l >= 3 ? '<p class="note">The Camp stands at its full height.</p>' : '');
      selected.range = KEEP.range[l - 1] + S.P.towerRange;
      return;
    }
    if (selected.type === 'region' && S.sealed[selected.id]) {
      const known = S.kits[selected.id]; $('#pEyebrow').textContent = 'The old core · sealed'; $('#pTitle').textContent = names[selected.id];
      body.innerHTML = `<div class="stat"><span>Behind the old quarantine fence${known ? ` · scouts say: <b>${known === 'signature' ? 'a landmark' : (KITS[known] || {}).name || known}</b>` : ''}</span></div><p class="note">The old core opens through the story. You cannot walk in until then. The dead can.</p>`;
      return;
    }
    if (selected.type === 'region') {
      const info = game.regionInfo(selected.id), reg = game.map.regions[selected.id];
      $('#pEyebrow').textContent = `${names[selected.id]} · ${RINGS[Math.min(3, reg.ring)]}`;
      $('#pTitle').textContent = info.nest ? `Hive: ${hiveName(game.map.seed, selected.id)} · ${info.active ? 'awake' : 'asleep'}` : names[selected.id];
      let html = '';
      if (info.nest) html += game.keepLevel() < info.needKeep ? `<p class="note">Too strong for now: <b>raise the Camp to level ${info.needKeep}</b> to break a ${reg.ring >= 3 ? 'core' : 'city'} hive.</p>`
        : `<div class="stat"><span>Hive health <b>${Math.round(game.hiveHealth(selected.id) * 100)}%</b></span><span>Walk up and strike it, day or night. While you hit it, it pours out its dead.</span></div><p class="note">When it burns: a legendary blessing and scrap. Its last dead come after you.</p>`;
      else html += '<p class="note">No hive here.</p>';
      body.innerHTML = html;
      return;
    }
    if (selected.type === 'landmark') {
      const l = S.landmarks[selected.id], L = LANDMARKS[l.kind], near = game.landmarkReach(selected.id);
      $('#pEyebrow').textContent = l.owned ? 'Yours · a forward base' : L.signature ? 'Landmark of the city' : 'A place out there';
      $('#pTitle').textContent = L.name;
      let html = `<div class="stat"><span>${L.desc}</span><span>${l.owned ? 'You can build around it.' : 'Claim it and you can build around it too.'}</span></div>`;
      if (!l.owned) html += `<div class="opts one">${opt('opt-claim', 'data-claim="1"', near ? `Claim the ${L.name}` : 'Walk up to it first', near ? L.cost : null, near ? 'Yours for good: its bonus and a build zone around it.' : 'Your hero is on the way. Tap again when you are next to it.', !near || S.gold < L.cost || !day)}</div>`;
      body.innerHTML = html; return;
    }
    if (selected.type === 'rubble') {
      const r = game.rubbleAt(selected.x, selected.y);
      const woods = game.map.wild && game.map.wild[idx(Math.floor(selected.x), Math.floor(selected.y))];
      $('#pEyebrow').textContent = 'Your land'; $('#pTitle').textContent = r.blocks ? 'A ruined block' : woods ? 'Trees' : 'Rubble';
      body.innerHTML = `<div class="stat"><span>${r.blocks ? 'Walls block building and the dead alike.' : 'Blocks building. Slows the dead.'}</span><span>Knock it down to make room.</span></div>`
        + (r.cells.length ? `<div class="opts one">${opt('opt-clear', 'data-clear="1"', r.blocks ? `Knock down ${r.blocks} ${r.blocks === 1 ? 'bay' : 'bays'} of the block` : woods ? `Fell ${r.cells.length} ${r.cells.length === 1 ? 'cell' : 'cells'} of trees` : `Clear ${r.cells.length} ${r.cells.length === 1 ? 'cell' : 'cells'} of rubble`, r.cost, r.blocks ? 'A 3×3 patch becomes open ground. The noise carries.' : 'A 3×3 patch around this spot becomes open ground.', S.gold < r.cost || !day)}</div>` : '<p class="note">Nothing left to clear here.</p>');
      return;
    }
    const b = selB(); if (!b) { closePanel(); return; }
    const B = BUILDINGS[b.type];
    $('#pEyebrow').textContent = names[game.map.region[idx(Math.floor(b.x), Math.floor(b.y))]] || '';
    $('#pTitle').textContent = `${B.name} · level ${b.level}${b.ruined ? ' · ruined' : ''}`;
    if (b.ruined) {   // a ruin stays until you rebuild it by hand: no income, no defence
      const rc = game.rebuildCost(b.id);
      body.innerHTML = `<div class="stat"><span><b class="bad">Ruined</b> · no ${b.type === 'tower' ? 'fire' : b.type === 'farm' ? 'food' : b.type === 'house' ? 'scrap, nobody lives here' : 'use'} until rebuilt</span><span>Rebuilding costs half the price, and it stands at full health.</span></div><div class="opts two">`
        + opt('opt-up', 'data-rebuild="1"', day ? `Rebuild the ${B.name.toLowerCase()}` : 'Rebuild at dawn', rc, day ? `Back as it was: level ${b.level}.` : 'Nobody lays bricks with the dead at the gate.', S.gold < rc || !day)
        + opt('opt-demo', 'data-demo="1"', 'Clear the ruin', null, '<b class="bad">No scrap back</b> · the lot is free again.', !day) + '</div>';
      selected.range = null; return;
    }
    let html = `<div class="stat"><span>Health <b>${Math.ceil(b.hp)} / ${b.maxHp}</b></span><span>${B.desc[b.level - 1]}</span></div><div class="opts two">`;
    if (b.type === 'wall') {
      const run = game.wallRun(b.id), total = run.reduce((a, w) => a + game.upCostOf(w), 0);
      if (b.level < MAX_LEVEL) { const capped = b.level >= game.keepLevel(); html += opt('opt-upw', 'data-upw="1"', capped ? 'Raise the Camp first' : `Upgrade this barricade · ${run.length} ${run.length === 1 ? 'post' : 'posts'}`, capped ? null : total, capped ? `Nothing grows past the Camp (level ${game.keepLevel()}).` : `${B.desc[b.level]} each.`, capped || S.gold < game.upCostOf(b) || !day); }
      { const back = Math.floor(game.costOf(b.type) / 2); html += opt('opt-demo', 'data-demo="1"', 'Pull down this post', null, `<b class="good">${back ? `+${back} scrap back` : 'No scrap back'}</b> · <b class="bad">a gap in the line</b>.`, !day); }
      body.innerHTML = html + '</div>'; selected.range = null; return;
    }
    const capped = b.level >= game.keepLevel(), maxL = B.maxLevel || MAX_LEVEL, needTech = b.level + 1 === 3 && UNLOCKS[b.type] && !game.hasTech(UNLOCKS[b.type]);
    if (B.tech) { body.innerHTML = `<div class="stat"><span>${b.built < 1 ? `Under construction <b>${Math.floor(b.built * 100)}%</b>` : 'Working'}</span><span>${B.desc[0]}</span></div><div class="opts two">${opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(game.costOf(b.type) / 2)} scrap back</b> · <b class="bad">its bonus is gone</b>.`, !day)}</div>`; selected.range = null; return; }
    if (b.type === 'tower') { const on = game.manned(b), need = CREW_NEED[b.level - 1]; html = html.replace('</div><div class="opts two">', `<span>${on ? `Crew <b>${need}</b> on watch` : `<b class="bad">No crew</b>: needs ${need} people. Build or upgrade homes.`}</span></div><div class="opts two">`); }
    if (b.level < maxL) { const c = game.upCostOf(b); html += opt('opt-up', 'data-up="1"', capped ? 'Raise the Camp first' : needTech ? `Needs a ${SHORT[UNLOCKS[b.type]]}` : `Upgrade to level ${b.level + 1}`, capped || needTech ? null : c, capped ? `Nothing grows past the Camp (level ${game.keepLevel()}).` : needTech ? `Build a ${SHORT[UNLOCKS[b.type]]} to unlock level 3.` : `${B.desc[b.level]} · ${game.maxHpOf(b.type, b.level + 1)} hp${b.type === 'tower' ? ` · needs ${CREW_NEED[b.level]} crew` : ''}`, capped || needTech || S.gold < c || !day); }
    html += opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(game.costOf(b.type) / 2)} scrap back</b> · <b class="bad">level ${b.level} lost</b>.`, !day);
    body.innerHTML = html + '</div>' + (b.level >= MAX_LEVEL ? '<p class="note">Fully upgraded.</p>' : '');
    selected.range = b.type === 'tower' ? game.towerStats(b).range : null;
  }
  $('#pBody').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn || btn.disabled || !selected) return;
    if (btn.dataset.claim && game.claimLandmark(selected.id)) { closePanel(); updateHud(); return; }
    if (btn.dataset.clear) { const n = game.clearRubble(selected.x, selected.y); if (n) { toast(`${n} ${n === 1 ? 'cell' : 'cells'} cleared.`); closePanel(); updateHud(); return; } }
    if (btn.dataset.rebuild) { if (game.rebuild(selected.id)) { audio.play('build'); toast(`${BUILDINGS[game.state.byId.get(selected.id).type].name} rebuilt.`, 'good'); renderPanel(); updateHud(); } return; }
    if (btn.dataset.keep && game.upgradeKeep()) toast('The Camp rises higher.');
    if (btn.dataset.trader && FLAGS.trader) { closePanel(); paused = true; showTrader(); return; }
    if (btn.dataset.up && game.upgrade(selected.id)) toast('Upgraded.');
    if (btn.dataset.upw) { const n = game.upgradeWall(selected.id); if (n) toast(`${n} ${n === 1 ? 'post' : 'posts'} upgraded.`); }
    if (btn.dataset.demo) {
      if (btn.dataset.sure) { if (game.demolish(selected.id)) { toast('Pulled down.'); closePanel(); updateHud(); return; } }
      else { btn.dataset.sure = '1'; btn.classList.add('sure'); btn.querySelector('.nm').textContent = 'Tap again to confirm'; return; }
    }
    renderPanel(); updateHud();
  });
  // the trader (cut: FLAGS.trader)
  function showTrader() {
    const S = game.state; if (!S.trade) { paused = false; return; }
    showCard('trade', `<div class="eyebrow">A caravan at the gate</div><h1 class="sm">The trader</h1>
      <div class="opts one">${S.trade.deals.map(id => { const t = TRADES.find(x => x.id === id); const can = t.gold ? S.gold >= t.gold : S.food >= t.food;
        return `<button class="opt" data-trade="${id}" ${can ? '' : 'disabled'}><span class="nm">${t.name}<span class="cost">${t.gold ? `${icon('scrap')}${t.gold}` : `${icon('food')}${t.food}`}</span></span><span class="ds">${t.desc}</span></button>`; }).join('')}</div>
      <div class="cardrow foot"><button class="btn ghost" id="tSkip">Not today</button></div>`);
    $$('[data-trade]').forEach(b => b.onclick = onArmed(() => { game.trade(b.dataset.trade); hideCard(); paused = false; }));
    $('#tSkip').onclick = onArmed(() => { hideCard(); paused = false; });
  }
  $('#pClose').onclick = closePanel;
  $('#mini').onclick = () => { if (game && !card) showMap(); };
  $('#dayPill').onclick = () => { if (game && !card && !game.state.over) showStatus(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && !game.state.over) { const snap = game.snapshot(); if (snap) saves.save(snap); } });
  // auto quality: if no choice was made, step down one level when frames are slow for a few seconds
  const perf = { t: 0, n: 0, slow: 0, wait: 3 };
  function watchFrames(raw) {
    if (!view || paused || document.hidden || store.get('quality', null) || new URLSearchParams(location.search).get('q')) return;
    if (view.quality() === 'low' || raw > 250) return;
    if (perf.wait > 0) { perf.wait -= raw / 1000; return; }
    perf.t += raw; perf.n++;
    if (perf.t < 3000) return;
    const avg = perf.t / perf.n; perf.t = 0; perf.n = 0;
    perf.slow = avg > 34 ? perf.slow + 1 : 0;
    if (perf.slow >= 2) { const q = view.quality() === 'high' ? 'medium' : 'low'; view.setQuality(q); store.set('autoq', q); perf.slow = 0; perf.wait = 4; }
  }

  // ---------- ability ----------
  function useAbility() {
    if (!game || paused || $('#ability').hidden) return;
    const ok = game.useAbility();
    if (ok && game.heroDef.ability.id === 'hire') toast('Sellswords join you.', 'good');
  }
  $('#ability').onclick = useAbility;
  function renderAbility() {
    const A = game.heroDef.ability, S = game.state, el = $('#ability');
    if (!A || !systemHere()) { el.hidden = true; return; }
    el.hidden = false;
    const cd = S.ability.cd, cost = game.abilityCost();
    el.querySelector('.an').textContent = A.name;
    el.querySelector('.ac').innerHTML = cd > 0 ? `${Math.ceil(cd)}s` : cost ? `${icon('scrap')}${cost}` : 'ready';
    el.classList.toggle('cool', cd > 0 || S.hero.dead || (cost && S.gold < cost));
    el.style.setProperty('--cd', cd > 0 ? (cd / A.cooldown) : 0);
  }

  // ---------- HUD ----------
  function dockH() { const db = $('#dock').getBoundingClientRect(); document.body.style.setProperty('--dockH', `${Math.max(64, innerHeight - db.top)}px`); }
  let lastKeep = 0, keepHitT = 0;
  function noiseNow() { const S = game.state; return typeof game.noise === 'function' && S.noise !== undefined ? +game.noise() || S.noise : (S.noise ?? S.heat ?? 0); }
  function forecastText() {
    const S = game.state;
    if (S.phase === 'night') {
      return `<span class="ic-w">${icon('moon')}</span><span>${esc(nightLine || `Night ${S.night}`)}</span>`;
    }
    let f = null;
    if (typeof game.forecastStrip === 'function') { try { f = game.forecastStrip(); } catch { f = null; } }
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
    const r = game.ratingOf(game.threatRatio()), hall = r === 'Impossible' ? 'fall' : r === 'Hard' ? 'risk' : 'safe';
    const dead = view ? view.routes().reduce((a, x) => a + x.count, 0) : 0, boss = view ? view.routes().some(x => x.boss) : false;
    return [`<span class="st ${hall}">Camp: ${word[hall]}</span>`, dead ? `<span>~${dead} dead tonight</span>` : '', boss ? '<span>a boss</span>' : ''].filter(Boolean).join('<span class="sep">·</span>');
  }
  function updateHud() {
    dockH();
    if (!game) return;
    const S = game.state, night = S.phase === 'night', bm = game.isBloodMoon(S.night);
    // the System strip
    strip.update({ show: systemHere() && !S.over, hp: S.hero.hp, maxHp: S.hero.maxHp, lv: S.lvl, quest: game.story().questLine() });
    // the Camp bar
    $('#nightNum').textContent = S.night;
    $('#dayIc').setAttribute('href', night ? '#i-moon' : '#i-sun');
    $('#dayPill').classList.toggle('night', night); $('#dayPill').classList.toggle('blood', bm);
    const kp = Math.max(0, S.keep.hp) / S.keep.maxHp;
    $('#keepFill').style.width = `${kp * 100}%`; $('#campHp').classList.toggle('hurt', kp < 0.7); $('#campHp').classList.toggle('low', kp < 0.35);
    if (S.keep.hp < lastKeep - 0.5) keepHitT = 2; lastKeep = S.keep.hp; keepHitT = Math.max(0, keepHitT - 0.2);
    $('#gold').textContent = S.gold; $('#food').textContent = S.food; $('#pop').textContent = game.pop();
    $('#food').classList.toggle('warn', game.foodPerDawn() + S.food < game.foodNeed());
    { const cw = game.crewing(); $('#pop').classList.toggle('warn', cw.need > cw.people); }
    const noiseShown = S.noise !== undefined || !!S.feat.heat, nz = noiseNow();
    $('#rNoise').hidden = !noiseShown; if (noiseShown) { $('#noiseFill').style.width = `${Math.min(100, nz)}%`; $('#rNoise').classList.toggle('hot', nz >= HEAT.erupt || !!S.eruption); }
    // tonight, honestly
    const fc = $('#forecast'); const fh = S.over ? '' : forecastText(); if (fc.dataset.h !== fh) { fc.dataset.h = fh; fc.innerHTML = fh; } fc.classList.toggle('night', night); fc.hidden = !fh || (!systemHere() && S.night === 1 && !night);
    // the Camp, when you are far from it
    { const d = Math.hypot(S.hero.x - game.map.town.x, S.hero.y - game.map.town.y), ca = $('#campAway'); ca.hidden = d <= 25 || S.over; if (!ca.hidden) { $('#campPct').textContent = `${Math.round(kp * 100)}%`; ca.classList.toggle('hit', keepHitT > 0); ca.classList.toggle('low', kp < 0.35); } }
    $('#blackout').hidden = !S.blackout; if (S.blackout && game.powerIn) $('#boTxt').textContent = `${game.powerOut()} needed · ${game.powerIn()} made`;
    $('#buildBtn').style.visibility = S.over ? 'hidden' : '';
    // the thumb row's middle: the sun (or the moon), and how long you have
    if (S.over) $('#info').innerHTML = 'The window has closed';
    else {
      const loose = S.mobs.filter(m => !m.roam && !MOBS[m.kind].animal).length, hunting = S.mobs.filter(m => m.hunt && !MOBS[m.kind].animal).length;
      let mid;
      if (S.hero.dead) mid = `${icon('heart')}<span class="soon">Back in ${Math.ceil(S.hero.respawn)}s</span>`;
      else if (night) mid = `${sunDial(game.nightFrac(), false, true)}${loose ? `<span><em>${loose}</em> coming</span>` : '<span>Hold</span>'}${hunting ? `<span><em class="hunt">${hunting}</em> on you</span>` : ''}`;
      else { const dusk = game.duskIn(); mid = `${sunDial(game.dayFrac(), dusk <= 15)}<span class="${dusk <= 15 ? 'soon' : ''}">Dusk ${mmss(dusk)}</span>${hunting ? `<span><em class="hunt">${hunting}</em> on you</span>` : ''}`; }
      if (S.eruption) mid = `<span class="erupt">Hive bursts ${Math.ceil(S.eruption.t)}s</span>${mid}`;
      $('#info').innerHTML = mid;
    }
    renderTray(); renderAbility();
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
    const K = game && game.story().contracts.stripLine(); if (!K || !K.place || !game.road || !game.road.tripInfo) return false;
    const x = K.place.x, y = K.place.y + 2.4, info = game.road.tripInfo(x, y); if (!info) return false;
    if (!kTripEl) { kTripEl = document.createElement('div'); kTripEl.className = 'kTrip'; document.body.appendChild(kTripEl); }
    const cls = info.late ? 'late' : info.risky ? 'risky' : 'ok';
    kTripEl.innerHTML = `<div class="t"><b>${icon('flame')}Contract: burn ${esc(K.name)}</b><span><em class="${cls}">${esc(info.label)}</em>${info.late ? ' · <em class="late">back after dark</em>' : ''}</span></div><button class="btn sm" data-go>Go</button><button class="x" data-x aria-label="Close">${icon('close')}</button>`;
    kTripEl.hidden = false; game.road.preview = { path: info.path };
    const close = () => { kTripEl.hidden = true; if (game.road) game.road.preview = null; clearTimeout(kTripEl._t); };
    kTripEl.querySelector('[data-go]').onclick = () => { if (game.road.go(x, y)) { close(); toast(`[Trip] On the way to ${K.name}. Touch the stick to take over.`, 'sys'); } };
    kTripEl.querySelector('[data-x]').onclick = close; clearTimeout(kTripEl._t); kTripEl._t = setTimeout(close, 12000);
    return true;
  }
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('.ar.kontract'); if (a && game && !card) contractTrip(); });
  // ---------- edge arrows ----------
  const edge = { top: 60, bot: 100, pool: [], tags: [] };
  function edgeMarks() {
    const S = game.state, Wd = innerWidth, Hh = innerHeight, m = 22, t = edge.top, bt = Hh - edge.bot, cx = Wd / 2, cy = (t + bt) / 2, buckets = new Map();
    for (const z of S.mobs) {
      if (z.roam || z.lure || MOBS[z.kind].animal) continue;
      if (Math.hypot(z.x - S.hero.x, z.y - S.hero.y) > 40 && Math.hypot(z.x - game.map.town.x, z.y - game.map.town.y) > 30) continue;
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
    for (const d of S.drops) { const p = view.project(d.x, d.y, 1.5); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue; buckets.set(3000 + d.id, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: false, drop: true }); }
    // quests: only what the gate shows (one at a time early on), never the whole list
    for (const q of game.story().shownQuests()) { const p = view.project(q.x, q.y, 1.5); if (p.x > m && p.x < Wd - m && p.y > t && p.y < bt) continue; buckets.set(q.key === 'trial' ? 6999 : q.spot ? 7000 + q.spot : 5000 + q.site, { ang: Math.atan2(p.y - cy, p.x - cx), n: 0, big: q.kind === 'trial', quest: true, label: q.label }); }
    { const K = game.story().contracts.stripLine(); if (K && K.place) { const p = view.project(K.place.x, K.place.y, 2); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8100, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, quest: true, contract: true, label: 'Contract' }); } }
    { const c = game.map.city, h = S.hero; if (c && Math.hypot(c.x - h.x, c.y - h.y) > c.r + 6) { const p = view.project(c.x, c.y, 1); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8000, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, place: true, label: 'City' }); } }
    { const tw = game.map.town, h = S.hero; if (Math.hypot(tw.x - h.x, tw.y - h.y) > 24) { const p = view.project(tw.x, tw.y, 1); if (p.behind || !(p.x > m && p.x < Wd - m && p.y > t && p.y < bt)) buckets.set(8001, { ang: Math.atan2(p.y - cy, p.x - cx) + (p.behind ? Math.PI : 0), n: 0, big: false, place: true, label: 'Camp' }); } }
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

  // ---------- input ----------
  const canvas = $('#view'), joy = $('#joy'); let down = null; const touches = new Map(); let pinch0 = 0, zoom0 = 1;
  const joyIn = { x: 0, y: 0 }; let touchUI = matchMedia('(pointer: coarse)').matches;
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (view) view.setZoom(view.getZoom() * (1 + e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && view) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.getZoom(); endJoy(); down = null; return; }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', joy: false, drag: false }; canvas.focus({ preventScroll: true });
    touchUI = down.touch;
    if (placing && placing.type === 'wall' && !down.touch && !placing.start && view && !paused) {
      const g = view.groundAt(e.clientX, e.clientY); if (g) { placing.x = g.x; placing.y = g.y; updateGhost(); if (placing.ghost.ok) { placing.start = placing.cell; down.wallStart = true; updateGhost(); } }
    }
  });
  function endJoy() { joyIn.x = joyIn.y = 0; joy.hidden = true; }
  canvas.addEventListener('pointercancel', e => { touches.delete(e.pointerId); if (down && down.id === e.pointerId) { down = null; endJoy(); } });
  canvas.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2 && pinch0 && view) { const [a, b] = [...touches.values()]; view.setZoom(zoom0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))); return; } }
    if (!game || !view || paused) return;
    if (placing && (e.pointerType === 'mouse' || (down && down.id === e.pointerId))) {
      const g = view.groundAt(e.clientX, e.clientY); if (g) { const ox = placing.x, oy = placing.y; placing.x = g.x; placing.y = g.y; if (Math.floor(ox) !== Math.floor(g.x) || Math.floor(oy) !== Math.floor(g.y)) updateGhost(); }
      if (down) down.drag = true;
      return;
    }
    if (down && down.id === e.pointerId && down.touch) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y, d = Math.hypot(dx, dy);
      if (!down.joy && d > JOY_PX) { down.joy = true; joy.hidden = false; joy.style.transform = `translate(${down.x}px, ${down.y}px)`; game.state.hero.target = null; if (roadUI) roadUI.closeTrip(); }
      if (down.joy) { const k = Math.min(1, d / 60), nx = dx / (d || 1), ny = dy / (d || 1); joyIn.x = nx * k; joyIn.y = ny * k; joy.firstChild.style.transform = `translate(${nx * Math.min(d, 40)}px, ${ny * Math.min(d, 40)}px)`; }
    }
    if (e.pointerType === 'mouse') { const p = view.pick(e.clientX, e.clientY); canvas.style.cursor = p && p.type !== 'ground' ? 'pointer' : ''; }
  });
  const goTo = (x, y) => { game.heroTo(x, y); view.showMove(x, y); };
  canvas.addEventListener('pointerup', e => {
    const wasPinch = touches.size >= 2; touches.delete(e.pointerId); if (touches.size < 2) pinch0 = 0;
    const d = down; if (d && d.id === e.pointerId) down = null;
    if (d && d.joy) { endJoy(); return; }
    if (!d || wasPinch || paused || !game) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? JOY_PX : 8) && !placing) return;
    if (placing) {
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
    // [road] taps on road stations are handled by road-ui before falling through to here
    if (p.type === 'landmark') { const l = S.landmarks[p.id]; if (!l.owned) goTo(l.x, l.y + l.size / 2 + 1); openSel({ type: 'landmark', id: p.id }); return; }
    if (p.type === 'rubble') { goTo(p.x, p.y); openSel({ type: 'rubble', x: p.x, y: p.y }); return; }
    if (p.type === 'building' || p.type === 'keep') { openSel(p.type === 'building' ? { type: 'building', id: p.id } : { type: 'keep' }); return; }
    if (p.type === 'region' && S.sealed[p.id]) { openSel({ type: 'region', id: p.id }); return; }
    if (p.type === 'region' && game.map.regions[p.id].nest && game.regionInfo(p.id).nest) {
      const n = game.map.regions[p.id].nest;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 4 || !(selected && selected.type === 'region')) { openSel({ type: 'region', id: p.id }); return; }
    }
    goTo(p.x, p.y); if (selected) closePanel();
  });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (placing && placing.start) { placing.start = null; updateGhost(); } else if (placing) stopPlacing(); else closePanel(); }
    if (e.target.closest && e.target.closest('button,input') && (k === ' ' || k === 'enter')) return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = true; e.preventDefault(); if (roadUI) roadUI.closeTrip(); }
    if (!game) return;
    if (k === 'l' && FLAGS.runLog) showLog();
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
    let windowAtDawn = false;
    for (const e of events) {
      if (toastFor.has(e.t)) toast(e.msg, e.t === 'fail' ? 'bad' : e.kind);
      if (e.t === 'window') { game.story().offerWin(e); if (S.phase === 'day' && S.dayT < 3) windowAtDawn = true; }
      if (e.t === 'encounter') aiFetch(S.story.encounters.find(x => x.id === e.id));
      if (e.t === 'episode') showEpisode(e);
      if (e.t === 'scene') showDusk(e);
      if (e.t === 'tip') callouts.show(e);
      if (e.t === 'ruin') noteLoss(e.id);
      if (e.t === 'difficulty' && typeof game.setDifficulty !== 'function') { const D = game.difficulty && game.difficulty(); if (D && DIFFICULTY[e.key]) Object.assign(D, DIFFICULTY[e.key]); }   // one game per page: the shared table is safe to retune
      if (e.t === 'claim' && selected && selected.type === 'region') closePanel();
      if (e.t === 'dawn') { inventToday(); holdCards(DAWN_DELAY); endJoy(); const ll = lossLine(), L = pendingLedger; pendingLedger = null; if (roadUI && L && (L.fell.length || L.ruins || L.piper)) { ledgerUp = true; setTimeout(() => { if (roadUI) roadUI.showLedger(L, ll, dawnLine); ledgerUp = false; }, 600); } else if (ll) setTimeout(() => ctoast.show(ll, 'bad', 'skull'), 400); const snap = game.snapshot(); if (snap) saves.save(snap).then(w => { lastSave = { day: snap.night, where: w }; }); }
      if (e.t === 'over') { saves.clear(); { const L = store.get('legacy', { fame: 0, owned: {} }); S.fameEarned = fameOf(S); L.fame += S.fameEarned; store.set('legacy', L); } endT = now + 2600; paused = false; closePanel(); stopPlacing(); hideCard(); if (view.startOrbit) view.startOrbit(); }
      if ((e.t === 'remove' || e.t === 'ruin') && selected && selected.type === 'building' && !S.byId.get(selected.id)) closePanel();
      // [road] road-ui reads the same events here
      if (e.t === 'ledger') pendingLedger = e;
      if (e.t === 'classUp') classBeat(e);
    }
    if (roadUI && events.length) roadUI.onEvents(events);
    if (windowAtDawn) game.story().release();
    // decisions wait for a calm moment: never while the hero fights or the dead are close (the night-1 arrival may
    // type itself out); a card that waited long enough opens once the hero itself is out of reach
    { const near = (x, y, r) => S.mobs.some(m => !m.dying && !(MOBS[m.kind] && MOBS[m.kind].animal) && (m.rise === undefined || m.rise >= 1) && Math.hypot(m.x - x, m.y - y) < r);
      const h = S.hero, fight = !h.dead && near(h.x, h.y, 12), camp = near(game.map.town.x, game.map.town.y, 12);
      calmT = fight || camp ? 0 : calmT + dt; waitT = S.story.encounters.length ? waitT + dt : 0; }
    const calmOk = calmT > 2.5 || (waitT > 25 && !(S.hero && !S.hero.dead && S.mobs.some(m => Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 6))) || (S.story.encounters[0] && S.story.encounters[0].kind === 'arrival');
    if (!card && now >= dawnAt && S.story.encounters.length && !S.over && calmOk) showEncounter();
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
  addEventListener('resize', () => { dockH(); callouts.place(); });
  showStart();
}
