// The start screen (key art, worlds, legacy), beginning or continuing a run (creates the game and the view),
// the "previously on" recap and the Chronicler's daily quest.
import { $, $$, AI_WAIT, FLAGS, LEGACY_KEEP, WHATS_NEW, audio, chronicler, esc, rich, saves, store } from './shared.js';
import { BIOMES, generateMap, mapChoices } from '../sim/mapgen.js';
import { DIFFICULTY, SAVE_V, createGame } from '../sim/game.js';
import { LEGACY } from '../content/legacy.js';
import { QUEST_TEMPLATES, SYSTEM } from '../content/story.js';
import { createRoadUI } from './road-ui.js';
import { createView } from '../render/view.js';
import { regionNames } from '../content/names.js';

export function createStart(ui) {
  const { callouts, ctoast, holdCards, setup, strip, systemHere } = ui;

  // ---------- the start: one screen ----------
  function showStart() {
    ui.paused = true; $('#hud').hidden = true;
    const opts = mapChoices(setup.runSeed), best = store.get('best', 0);
    $('#overlay').classList.add('start');
    ui.showCard('start', `${startArt()}<div class="kick">[A window only you can see]</div>
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
    opts.forEach((o, k) => ui.drawMinimap($(`#mm${k}`), generateMap(o.seed, o.biome)));
    $$('[data-diff]').forEach(b => b.onclick = () => { setup.difficulty = b.dataset.diff; store.set('difficulty', setup.difficulty); $$('[data-diff]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#aiStart').onchange = e => chronicler.setEnabled(e.target.checked);
    $$('[data-legacy]').forEach(b => b.onclick = () => { const L = store.get('legacy', { fame: 0, owned: {} }), up = LEGACY.find(x => x.id === b.dataset.legacy), n = L.owned[up.id] || 0; if (n >= up.max || L.fame < up.cost) return; L.fame -= up.cost; L.owned[up.id] = n + 1; store.set('legacy', L); audio.play('claim'); showStart(); $('#startMore').open = true; });
    $('#reroll').onclick = () => { setup.runSeed = Math.floor(Math.random() * 1e6); setup.pick = 0; showStart(); $('#startMore').open = true; };
    $('#begin').onclick = () => { const o = opts[setup.pick]; begin(o.seed, o.biome); };
    saves.load().then(snap => {
      if (!snap || snap.v !== SAVE_V || ui.card !== 'start' || !$('#contRow')) return;
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
    return `<h2 style="font:600 12px var(--mono);letter-spacing:.12em;text-transform:uppercase;margin:18px 0 0">Legacy · ${L.fame} fame</h2><div class="legacy">${list.map(u => { const n = L.owned[u.id] || 0; return `<button class="opt" data-legacy="${u.id}" ${n >= u.max || L.fame < u.cost ? 'disabled' : ''}><span class="nm">${u.name} ${n ? `${n}/${u.max}` : ''}<span class="cost">${n >= u.max ? 'max' : `${u.cost} fame`}</span></span><span class="ds">${u.desc.replace(/town hall/i, 'Haven')}</span></button>`; }).join('')}</div>`;
  }
  function begin(mapSeed, biome, snap = null) {
    $('#overlay').classList.remove('start');
    ui.game = snap ? createGame({ seed: snap.seed, mapSeed: snap.mapSeed, biome: snap.biome, hero: snap.hero, mode: 'classic', difficulty: snap.difficulty, restore: snap, legacy: snap.legacy || {} })
      : createGame({ seed: setup.runSeed, mapSeed, biome, hero: 'survivor', mode: 'classic', difficulty: setup.difficulty, legacy: store.get('legacy', { owned: {} }).owned });
    ui.names = regionNames(mapSeed, ui.game.map.regions.length);
    const qp = new URLSearchParams(location.search).get('q');
    if (!ui.view) { ui.view = createView($('#view'), ui.game, { onFlash: () => audio.play('thunder'), quality: qp || store.get('quality', null) || store.get('autoq', null) || undefined }); }
    window.__game = ui.game; window.__view = ui.view; window.__openSel = sel => ui.openSel(sel);
    window.__ui = { strip, callouts, ctoast, showStatus: ui.showStatus, showMore: ui.showMore, showMap: ui.showMap, cards: () => ui.card, toast: ui.toast };
    // [road] begin
    if (ui.roadUI) ui.roadUI.dispose();
    ui.roadUI = createRoadUI({ game: ui.game, view: ui.view, toast: (m, k) => ui.toast(m, k), hideCard: () => { ui.hideCard(); ui.paused = false; }, isBusy: () => ui.paused || !!ui.card || !!ui.placing, systemHere: () => systemHere() });
    window.__roadUI = ui.roadUI;
    // [road] end
    $('#hud').hidden = false; ui.hideCard(); ui.paused = false; ui.selected = null; ui.placing = null; ui.closePanel();
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
    const ST = ui.game.state.story, offline = ST.chronicle.filter(c => c.imp >= 3).slice(-3).map(c => `Day ${c.day}: ${c.text}`);
    const show = lines => ui.showInfo({ eyebrow: '[Previously on Hollowmere]', title: `${ui.game.map.name} · day ${ui.game.state.night}`, lines: lines.length ? lines : ['You held the Haven. The Ash-Born did not wait for you.'] });
    if (!chronicler.available()) { show(offline); return; }
    ui.paused = true; let done = false;
    const t = setTimeout(() => { if (!done) { done = true; show(offline); } }, AI_WAIT);
    chronicler.recap(ui.game.story().fullContext()).then(b => { if (done) return; done = true; clearTimeout(t); show(b || offline); });
  }
  // the Chronicler invents today's side quest from everything that happened (one a day, from day 2)
  function inventToday() {
    const S = ui.game.state; if (!chronicler.available() || S.night < 2 || S.story.inventDay === S.night || inventToday.busy) return;
    inventToday.busy = true;
    chronicler.invent(ui.game.story().fullContext(), QUEST_TEMPLATES).then(q => { inventToday.busy = false; if (q && ui.game && !ui.game.state.over) ui.game.story().invent(q); });
  }
  return { showStart, inventToday };
}
