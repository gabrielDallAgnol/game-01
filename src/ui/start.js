// The start screen (key art, worlds, legacy), beginning or continuing a run (creates the game and the view),
// the "previously on" recap.
import { $, $$, FLAGS, LEGACY_KEEP, WHATS_NEW, audio, esc, rich, saves, store } from './shared.js';
import { BIOMES, generateMap, mapChoices } from '../sim/mapgen.js';
// [area] next line
import { AREA, AREA_PICK, areaOpts } from './area-flag.js';
// [v2] next line
import { AREAS } from '../sim/areamap.js';
import { RECIPES } from '../engine/recipes.js';
import { DIFFICULTY, SAVE_V, createGame } from '../sim/game.js';
import { LEGACY } from '../content/legacy.js';
import { SYSTEM } from '../content/story.js';
import { createView } from '../render/view.js';
import { regionNames } from '../content/names.js';
// [story3] the Solar Flare title and the opening
import { GAME_TITLE } from '../content/solar.js';
import { introWanted, playIntro } from './intro.js';

export function createStart(ui) {
  const { callouts, ctoast, holdCards, setup, strip, systemHere } = ui;

  // ---------- the start: one screen ----------
  function showStart() {
    ui.paused = true; $('#hud').hidden = true;
    const opts = mapChoices(setup.runSeed, areaOpts()), best = store.get('best', 0);
    $('#overlay').classList.add('start');
    ui.showCard('start', `${startArt()}<div class="kick">${GAME_TITLE.kick}</div>
      <h1>${GAME_TITLE.name}<span>${GAME_TITLE.name2}</span></h1><div class="sub">${GAME_TITLE.sub}</div>
      <p class="pitch">${esc(GAME_TITLE.pitch)}</p>
      <div class="cta"><div id="contRow" hidden></div><button class="btn big" id="begin">Begin</button></div>
      <details id="startMore"><summary>More</summary>
        <div class="worlds">${opts.map((o, k) => `<canvas id="mm${k}" aria-hidden="true"></canvas><div><b>${esc(o.name)}</b><div class="note">${esc(BIOMES[o.biome].blurb)} · seed ${o.seed}</div><button class="btn ghost sm" id="reroll" style="margin-top:8px">Another world</button></div>`).join('')}</div>
        ${FLAGS.startDifficulty ? `<div class="opts one" style="margin-top:12px">${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="opt" data-diff="${k}" aria-pressed="${setup.difficulty === k}"><span class="nm">${d.name}</span><span class="ds">${d.blurb}</span></button>`).join('')}</div>` : '<p class="note" style="margin-top:12px">The System asks how hard it should be after your first night.</p>'}
        ${AREA_PICK ? '' : '<!--'}<div class="opts one" style="margin-top:12px">${AREAS.map(k => `<button class="opt" data-area="${k}" aria-pressed="${AREA.id === k}"><span class="nm">${RECIPES[k].name}</span><span class="ds">${esc(RECIPES[k].blurb)}</span></button>`).join('')}</div>${AREA_PICK ? '' : '-->'}   <!-- [area] the town: only when testing (?area=) -->
        <button class="btn ghost sm" id="replayIntro" style="margin-top:14px">Replay the opening</button>   <!-- [story3] -->
        ${legacyHtml()}
        <div class="news"><b>What's new tonight</b><ul>${WHATS_NEW.map(t => `<li>${rich(t)}</li>`).join('')}</ul></div>
      </details>
      <div class="foot">${best ? `Your best: night ${best} · ` : ''}Drag to walk · tap to go somewhere</div>`, { cls: 'titlecard', arm: false });
    opts.forEach((o, k) => ui.drawMinimap($(`#mm${k}`), generateMap(o.seed, o.biome, areaOpts())));
    $$('[data-diff]').forEach(b => b.onclick = () => { setup.difficulty = b.dataset.diff; store.set('difficulty', setup.difficulty); $$('[data-diff]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $$('[data-area]').forEach(b => b.onclick = () => { AREA.id = b.dataset.area; showStart(); $('#startMore').open = true; });   // [area]
    $$('[data-legacy]').forEach(b => b.onclick = () => { const L = store.get('legacy', { fame: 0, owned: {} }), up = LEGACY.find(x => x.id === b.dataset.legacy), n = L.owned[up.id] || 0; if (n >= up.max || L.fame < up.cost) return; L.fame -= up.cost; L.owned[up.id] = n + 1; store.set('legacy', L); audio.play('claim'); showStart(); $('#startMore').open = true; });
    $('#reroll').onclick = () => { setup.runSeed = Math.floor(Math.random() * 1e6); setup.pick = 0; showStart(); $('#startMore').open = true; };
    // [story3] the opening plays once (skippable); headless drivers skip it unless ?intro=1
    $('#replayIntro').onclick = () => playIntro({ store, onDone: () => {} });
    $('#begin').onclick = () => { const o = opts[setup.pick], go = () => begin(o.seed, o.biome); if (AREA.id !== 'hollowmere' && introWanted(store, location.search)) playIntro({ store, onDone: go }); else go(); };   // [ch1] chapter 1 opens in the square, no cards (its story is told in the world)
    saves.load().then(snap => {
      if (!snap || snap.v !== SAVE_V || ui.card !== 'start' || !$('#contRow')) return;
      const row = $('#contRow'); row.hidden = false;
      row.innerHTML = `<button class="cont" id="cont"><span>[Continue] Day ${snap.night} · ${esc(snap.city || 'the woods')}</span><small>${saves.cloud() ? 'Saved to your account' : 'Saved on this device'} · ${new Date(snap.savedAt).toLocaleString()}</small></button>`;
      $('#begin').classList.add('ghost'); $('#begin').textContent = 'New run';
      $('#cont').onclick = () => begin(snap.mapSeed, snap.biome, snap);
    });
  }
  // the key art: a white-hot afternoon sky, the depot skyline, the yellow Haven Rig with its halogens on, and the System window (the `win` group keeps its coordinates: CSS hovers it)
  function startArt() {
    const r = n => { let x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
    let city = ''; for (let k = 0, x = 20; x < 380; k++) { const w = 14 + r(k + 50) * 26, h = 16 + r(k + 60) * 56; city += `<rect x="${x.toFixed(0)}" y="${(246 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`; x += w + 2 + r(k + 70) * 6; }
    const rays = Array.from({ length: 14 }, (_, k) => { const a = k / 14 * 6.283 + 0.2; return `<path d="M${(110 + Math.cos(a) * 34).toFixed(0)} ${(120 + Math.sin(a) * 34).toFixed(0)}L${(110 + Math.cos(a) * (90 + r(k) * 80)).toFixed(0)} ${(120 + Math.sin(a) * (90 + r(k) * 80)).toFixed(0)}"/>`; }).join('');
    return `<svg class="art" viewBox="0 0 390 440" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c0" stop-opacity=".95"/><stop offset=".4" stop-color="#ffb35a" stop-opacity=".5"/><stop offset="1" stop-color="#ff7a45" stop-opacity="0"/></radialGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2150"/><stop offset=".45" stop-color="#d4603a"/><stop offset=".8" stop-color="#ffb04a"/><stop offset="1" stop-color="#ffd884"/></linearGradient></defs>
      <rect width="390" height="440" fill="url(#sky)"/><circle cx="110" cy="120" r="150" fill="url(#glow)"/><g stroke="#fff6d0" stroke-opacity=".55" stroke-width="2">${rays}</g><circle cx="110" cy="120" r="26" fill="#fffbe8"/>
      <g fill="#3a1d2c" opacity=".92">${city}</g><rect x="0" y="246" width="390" height="194" fill="#2a1520"/>
      <g transform="translate(128 312)"><rect x="0" y="-26" width="116" height="14" rx="2" fill="#f2c230"/><rect x="-26" y="-46" width="34" height="36" rx="4" fill="#f2c230"/><rect x="-20" y="-40" width="18" height="14" fill="#ffe9a0"/><rect x="2" y="-64" width="5" height="20" fill="#3a3430"/><rect x="-6" y="-12" width="130" height="14" rx="7" fill="#1a1214"/><g fill="#6a5a50"><circle cx="8" cy="-5" r="3.5"/><circle cx="40" cy="-5" r="3.5"/><circle cx="72" cy="-5" r="3.5"/><circle cx="104" cy="-5" r="3.5"/></g><path d="M20 -26l14 -20h54l10 20z" fill="#ff8a2a"/><rect x="84" y="-60" width="22" height="14" fill="#2d6fb0"/><rect x="88" y="-46" width="3" height="20" fill="#2a2522"/>
        <path d="M-30 -40l-70 -22v22z" fill="#fff3c0" opacity=".3"/></g>
      <g transform="translate(186 56)" class="win"><rect width="164" height="58" fill="rgba(10,24,40,.6)" stroke="#7fe3ff" stroke-opacity=".7"/><path d="M0 10V0h10M154 0h10v10M164 48v10h-10M10 58H0V48" stroke="#7fe3ff" stroke-width="2" fill="none"/>
        <text x="10" y="22" fill="#7fe3ff" font-family="IBM Plex Mono, monospace" font-size="9.5" letter-spacing=".3">[THERMAL PIONEER SYSTEM]</text><text x="10" y="41" fill="#d9f4ff" font-family="IBM Plex Mono, monospace" font-size="11">Pioneer · Lv 1</text></g>
    </svg>`;
  }
  function legacyHtml() {
    const L = store.get('legacy', { fame: 0, owned: {} }); if (!L.fame && !Object.keys(L.owned).length) return '';
    const list = LEGACY.filter(u => FLAGS.legacyAll || LEGACY_KEEP.includes(u.id));
    return `<h2 style="font:600 12px var(--mono);letter-spacing:.12em;text-transform:uppercase;margin:18px 0 0">Legacy · ${L.fame} fame</h2><div class="legacy">${list.map(u => { const n = L.owned[u.id] || 0; return `<button class="opt" data-legacy="${u.id}" ${n >= u.max || L.fame < u.cost ? 'disabled' : ''}><span class="nm">${u.name} ${n ? `${n}/${u.max}` : ''}<span class="cost">${n >= u.max ? 'max' : `${u.cost} fame`}</span></span><span class="ds">${u.desc.replace(/town hall/i, 'Haven')}</span></button>`; }).join('')}</div>`;
  }
  function begin(mapSeed, biome, snap = null) {
    $('#overlay').classList.remove('start');
    ui.game = snap ? createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, mode: 'classic', difficulty: snap.difficulty, restore: snap, legacy: snap.legacy || {}, area: snap.area || undefined })
      : createGame({ seed: setup.runSeed, mapSeed, biome, hero: 'mechanic', mode: 'classic', difficulty: setup.difficulty, legacy: store.get('legacy', { owned: {} }).owned, area: AREA.id });
    ui.names = regionNames(mapSeed, ui.game.map.regions.length);
    const qp = new URLSearchParams(location.search).get('q');
    if (!ui.view) { ui.view = createView($('#view'), ui.game, { onFlash: () => audio.play('thunder'), quality: qp || store.get('quality', null) || store.get('autoq', null) || undefined }); }
    window.__game = ui.game; window.__view = ui.view; window.__openSel = sel => ui.openSel(sel);
    window.__ui = { strip, callouts, ctoast, showStatus: ui.showStatus, showMore: ui.showMore, showMap: ui.showMap, cards: () => ui.card, toast: ui.toast };
    $('#hud').hidden = false; ui.hideCard(); ui.paused = false; ui.selected = null; ui.placing = null; ui.closePanel();
    if (snap) { previouslyOn(); }
    else if (!(ui.game.chapter && ui.game.chapter())) setTimeout(() => subtitle(SYSTEM.dayOne), 2700);   // [ch1] chapter 1 opens with the System over Kai instead
    holdCards(0.3);
  }
  function subtitle(text, ms = 6000) {
    const el = $('#subtitle'); el.innerHTML = rich(text); el.hidden = false; el.style.animationDuration = `${ms}ms`; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    clearTimeout(subtitle.t); subtitle.t = setTimeout(() => { el.hidden = true; }, ms);
  }

  // coming back to a run: "previously on Hollowmere" (the chronicle's big moments)
  function previouslyOn() {
    const ST = ui.game.state.story, lines = ST.chronicle.filter(c => c.imp >= 3).slice(-3).map(c => `Day ${c.day}: ${c.text}`);
    ui.showInfo({ eyebrow: '[Previously on Hollowmere]', title: `${ui.game.map.name} · day ${ui.game.state.night}`, lines: lines.length ? lines : ['You held the Haven. The Ash-Born did not wait for you.'] });
  }
  return { showStart };
}
