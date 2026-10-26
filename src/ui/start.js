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
// [story3] the title and the opening
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
        ${AREA.id === 'hollowmere' ? '' : '<button class="btn ghost sm" id="replayIntro" style="margin-top:14px">Replay the opening</button>'}   <!-- [story3] chapter 1 tells its story in the world -->
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
    if ($('#replayIntro')) $('#replayIntro').onclick = () => playIntro({ store, onDone: () => {} });
    $('#begin').onclick = () => { const o = opts[setup.pick], go = () => begin(o.seed, o.biome); if (AREA.id !== 'hollowmere' && introWanted(store, location.search)) playIntro({ store, onDone: go }); else go(); };   // [ch1] chapter 1 opens in the square, no cards (its story is told in the world)
    saves.load().then(snap => {
      if (!snap || snap.v !== SAVE_V || ui.card !== 'start' || !$('#contRow')) return;
      const row = $('#contRow'); row.hidden = false;
      row.innerHTML = `<button class="cont" id="cont"><span>[Continue] Day ${snap.night} · ${esc(snap.city || 'the woods')}</span><small>${saves.cloud() ? 'Saved to your account' : 'Saved on this device'} · ${new Date(snap.savedAt).toLocaleString()}</small></button>`;
      $('#begin').classList.add('ghost'); $('#begin').textContent = 'New run';
      $('#cont').onclick = () => begin(snap.mapSeed, snap.biome, snap);
    });
  }
  // the key art: Hollowmere at dusk under falling ash (the round old town, the church spire, the water tower), Hilde the
  // yellow tow truck in the square with her boom up, Kai beside her with the big wrench, and the System's blue line
  // (the `win` group keeps its coordinates: CSS hovers it)
  function startArt() {
    const r = n => { let x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
    let town = ''; for (let k = 0, x = -4; x < 394; k++) { const w = 18 + r(k + 50) * 22, h = 22 + r(k + 60) * 30, y = 250 - h; town += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/><path d="M${x.toFixed(0)} ${y.toFixed(0)}l${(w / 2).toFixed(0)} -${(9 + r(k) * 8).toFixed(0)}l${(w / 2).toFixed(0)} ${(9 + r(k) * 8).toFixed(0)}z"/>`; x += w + 1; }
    const ash = Array.from({ length: 46 }, (_, k) => `<circle cx="${(r(k + 7) * 390).toFixed(0)}" cy="${(r(k + 91) * 300).toFixed(0)}" r="${(0.9 + r(k + 33) * 1.8).toFixed(1)}"/>`).join('');
    const win = (x, y) => `<rect x="${x}" y="${y}" width="3" height="4"/>`;
    let lit = ''; for (let k = 0; k < 16; k++) lit += win((10 + r(k + 200) * 370).toFixed(0), (214 + r(k + 300) * 26).toFixed(0));
    return `<svg class="art" viewBox="0 0 390 440" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2350"/><stop offset=".5" stop-color="#7a4a78"/><stop offset=".8" stop-color="#e0805a"/><stop offset="1" stop-color="#ffc27a"/></linearGradient>
      <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".8"/><stop offset="1" stop-color="#ff9a5a" stop-opacity="0"/></radialGradient></defs>
      <rect width="390" height="440" fill="url(#sky)"/><g transform="translate(0 -56)"><circle cx="300" cy="226" r="120" fill="url(#glow)"/><circle cx="300" cy="214" r="20" fill="#ffe7b0" opacity=".9"/>
      <g fill="#3a2a40"><rect x="40" y="150" width="9" height="100"/><rect x="28" y="128" width="33" height="26" rx="4"/><path d="M26 130l18 -14l18 14z"/></g>
      <g fill="#332438">${town}<rect x="178" y="160" width="34" height="90"/><path d="M176 162l19 -78l19 78z"/><rect x="193" y="70" width="4" height="16"/><rect x="189" y="74" width="12" height="3"/></g>
      <g fill="#ffcf7a" opacity=".85">${lit}</g>
      <rect x="0" y="250" width="390" height="250" fill="#241a2a"/><path d="M0 262h390" stroke="#3a2c40" stroke-width="2"/>
      <g fill="#cfc6d8" opacity=".55">${ash}</g>
      <g transform="translate(150 330)">
        <path d="M70 -46l58 -46" stroke="#e8b020" stroke-width="7" stroke-linecap="round"/><path d="M128 -92v34" stroke="#2a2226" stroke-width="2"/><path d="M124 -58h8l-4 8z" fill="#2a2226"/>
        <rect x="-4" y="-34" width="132" height="20" rx="3" fill="#f2c230"/><rect x="-40" y="-60" width="44" height="46" rx="6" fill="#f2c230"/><rect x="-33" y="-53" width="24" height="16" rx="2" fill="#ffe9a0"/>
        <rect x="-26" y="-68" width="14" height="6" rx="2" fill="#ff8a2a"/><rect x="60" y="-52" width="22" height="18" fill="#3a3034"/><text x="10" y="-20" fill="#3a2a18" font-family="Arial Black, Impact, sans-serif" font-size="9">BRENNER</text>
        <rect x="-46" y="-16" width="180" height="14" rx="7" fill="#1a1214"/><g fill="#6a5a50"><circle cx="-22" cy="-7" r="9"/><circle cx="62" cy="-7" r="9"/><circle cx="96" cy="-7" r="9"/></g><g fill="#2a2226"><circle cx="-22" cy="-7" r="4"/><circle cx="62" cy="-7" r="4"/><circle cx="96" cy="-7" r="4"/></g>
        <path d="M-46 -48l-60 -16v28z" fill="#fff3c0" opacity=".25"/></g>
      <g transform="translate(96 336)"><rect x="-6" y="-40" width="12" height="24" rx="4" fill="#f2c230"/><circle cy="-47" r="7" fill="#f4c9a0"/><path d="M-7 -50h14v-4h-14z" fill="#d83a3a"/><rect x="-6" y="-16" width="5" height="16" fill="#e0a820"/><rect x="1" y="-16" width="5" height="16" fill="#e0a820"/><path d="M6 -34l16 -18" stroke="#b8c0c8" stroke-width="4" stroke-linecap="round"/><circle cx="23" cy="-53" r="4" fill="none" stroke="#b8c0c8" stroke-width="3"/></g>
      </g><g transform="translate(186 56)" class="win"><rect width="164" height="58" fill="rgba(10,24,40,.6)" stroke="#7fe3ff" stroke-opacity=".7"/><path d="M0 10V0h10M154 0h10v10M164 48v10h-10M10 58H0V48" stroke="#7fe3ff" stroke-width="2" fill="none"/>
        <text x="10" y="22" fill="#7fe3ff" font-family="IBM Plex Mono, monospace" font-size="9.5" letter-spacing=".3">[Class granted: Mechanic]</text><text x="10" y="41" fill="#d9f4ff" font-family="IBM Plex Mono, monospace" font-size="11">Kai Brenner · Lv 1</text></g>
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
