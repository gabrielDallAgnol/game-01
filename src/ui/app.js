// Screens, HUD, panels and input. Talks to the game only through its public API.
// Two looks: the Camp (amber, Barlow Condensed: what is yours) and the System (cyan, monospace: the window only you
// can see). The Window is a character: a strip at the top speaks in [brackets] instead of a pile of toasts, one story
// card and one System window a dawn, tips anchored to what they explain, nothing pauses at night unless it is the night.
//
// This file is the composition root: it holds the `ui` context every UI module shares, creates the modules
// (createX(ui) factories, see CLAUDE.md for the map), and runs the frame loop. Context slots that change while the
// page runs (ui.game, ui.view, ui.card, ui.paused, ui.selected, ui.placing, ui.roadUI, …) are always read as ui.x;
// everything else (functions, the strip, callouts, keys) is fixed once created and modules destructure it.
import { DIFFICULTY, STEP } from '../sim/game.js';
import { MOBS } from '../content/mobs.js';
import { fameOf } from '../content/legacy.js';
import { $, store, audio, saves, DAWN_DELAY, FLAGS } from './shared.js';
import { createStrip, createCallouts, createCampToast } from './system.js';
import { iconSprite } from './icons.js';
import { createMap } from './map.js';
import { createStart } from './start.js';
import { createCards } from './cards.js';
import { createStatus } from './status.js';
import { createHud } from './hud.js';
import { createPlacing } from './placing.js';
import { createPanels } from './panels.js';
import { createInput } from './input.js';
import { createCinema } from './cinema.js';
// [story3] the Solar Flare's voice on events
import { solarVoice } from './solar-voice.js';
// [pacify] begin
import { createHomeward } from './homeward.js';
// [pacify] end
// [folk] the folk's own projects: the chip, the build-menu row, the dawn line
import { createFolkUi } from './folk-ui.js';
// [nest3] the siege bar of an Inferno Nest
import { createInfernoUi } from './inferno-ui.js';
// [rig3] the Haven Rig: its panel section, Pack up & roll, the act change
import { createRigUi } from './rig-ui.js';

export { FLAGS };
// the UI modules, in creation order (each registers its own DOM handlers when created)
const MODULES = [createMap, createStart, createCards, createStatus, createHud, createPlacing, createPanels, createInput, createCinema, createHomeward, createFolkUi, createInfernoUi, createRigUi];   // [nest3] [rig3] appended   // [pacify] [folk] appended
// [gemini3] the build tag on the start screen
import { createVersion } from './version.js';
import { createLoggingUi } from './logging-ui.js';

MODULES.push(createVersion, createLoggingUi);   // [gemini3] appended
// [econ3] the construction queue chip, the carts row, the Settlement report
import { createEconUi } from './econ-ui.js';
MODULES.push(createEconUi);   // [econ3] appended
// [hero3] the stats window, the title chip, the ability bar
import { createHero3Ui } from './hero3.js';
import { createDodge } from './dodge.js';
MODULES.push(createHero3Ui);   // [hero3] appended
MODULES.push(createDodge);   // [combat2] appended: the dash keys and button (nothing without ?v2combat=1)
// [v2] the V2 core hides the switched-off systems' UI
import { createV2CoreUi } from './v2core.js';
MODULES.push(createV2CoreUi);   // [v2] appended (nothing without ?v2=1)

export function startApp() {
  // ---------- the shared context: what is on screen right now ----------
  const ui = {
    game: null, view: null, names: [],   // the run, its 3D view, the region names
    selected: null, placing: null,       // the open panel's subject; the building being placed
    paused: true, card: null,            // paused: the sim waits (a card is open, the start screen); card: which card is open
    roadUI: null,                        // [road] the road's UI (road-ui.js)
    speed: 1, touchUI: matchMedia('(pointer: coarse)').matches,
    lastSave: null,                      // { day, where } of the last dawn save
    pendingLedger: null, dawnLine: '', ledgerUp: false,   // the dawn's ledger hand-off between the loop and the toasts
  };
  let acc = 0, last = performance.now(), hudT = 0, cineK = 1;
  let dawnAt = 0, endT = -1;   // cards wait until performance.now() passes dawnAt
  let calmT = 0, waitT = 0;   // seconds of calm (no dead near the hero or the Camp), seconds a card has waited
  const holdCards = sec => { dawnAt = Math.max(dawnAt, performance.now() + sec * 1000); };
  const keys = {};
  const setup = { hero: 'survivor', mode: 'classic', difficulty: store.get('difficulty', 'survivor'), runSeed: Math.floor(Math.random() * 1e6), pick: 0 };
  { const sq = new URLSearchParams(location.search).get('seed'); if (sq) setup.runSeed = +sq; }   // testing: a fixed world
  $('#sprite').innerHTML = iconSprite();
  const strip = createStrip($('#strip'), { onTap: () => { if (ui.game && !ui.card && !ui.game.state.over) ui.showStatus(); } });
  const ANCHORS = { strip: '#strip', noise: '#rNoise', forecast: '#forecast', map: '#mini', camp: '#campHp', build: '#buildBtn' };
  const callouts = createCallouts($('#callouts'), ANCHORS);
  const ctoast = createCampToast($('#ctoasts'));
  const systemHere = () => !!(ui.game && (ui.game.state.night >= 2 || (ui.game.state.story.n1.arrived && !ui.game.state.story.encounters.some(e => e.kind === 'arrival'))));
  const firstRun = () => !store.get('runs', 0);
  Object.assign(ui, { holdCards, keys, setup, strip, callouts, ctoast, systemHere, firstRun });
  for (const make of MODULES) Object.assign(ui, make(ui));
  const {
    classBeat, closePanel, dockH, edgeMarks, endJoy, hideCard, joyIn, lossLine, noteLoss, refreshPanel,
    refreshZone, showDusk, showEncounter, showEnd, showEpisode, showStart, stopPlacing, tickMini, toast, updateGhost,
    updateHud, watchFrames, cinemaFrame
  } = ui;

  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.game && !ui.game.state.over) { const snap = ui.game.snapshot(); if (snap) saves.save(snap); } });

  // ---------- loop ----------
  const toastFor = new Set(['toast', 'fail']);
  let drawnAt = 0;   // [gemini3]
  function frame(now) {
    requestAnimationFrame(frame);
    if (ui.paused && ui.card && now - drawnAt < 95) return; drawnAt = now;   // [gemini3] behind a card the world idles at ~10 fps (battery, heat on phones)
    const raw = now - last, dt = Math.min(0.1, raw / 1000); last = now;
    if (!ui.game || !ui.view) return;
    const S = ui.game.state;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    ui.game.setHeroInput(kx || joyIn.x, ky || joyIn.y);
    if (!ui.paused) { acc += dt * ui.speed * cineK; let n = 0; while (acc >= STEP && !ui.paused && n++ < 240) { ui.game.step(STEP); acc -= STEP; if (S.over) break; } if (n >= 240) acc = 0; }
    else acc = 0;
    const events = ui.game.drainEvents();
    cineK = cinemaFrame(events, dt);   // [cinema] a look-at shot slows the sim while it plays
    try { audio.onEvents(events, ui.game); audio.tick(ui.game, dt); } catch (err) { /* sound must never stop the game */ }
    let windowAtDawn = false;
    for (const e of events) {
      if (toastFor.has(e.t)) toast(e.msg, e.t === 'fail' ? 'bad' : e.kind);
      if (e.t === 'window') { ui.game.story().offerWin(e); if (S.phase === 'day' && S.dayT < 3) windowAtDawn = true; }
      if (e.t === 'episode') showEpisode(e);
      if (e.t === 'scene') showDusk(e);
      if (e.t === 'tip') callouts.show(e);
      if (e.t === 'ruin') noteLoss(e.id);
      if (e.t === 'difficulty' && typeof ui.game.setDifficulty !== 'function') { const D = ui.game.difficulty && ui.game.difficulty(); if (D && DIFFICULTY[e.key]) Object.assign(D, DIFFICULTY[e.key]); }   // one game per page: the shared table is safe to retune
      if (e.t === 'claim' && ui.selected && ui.selected.type === 'region') closePanel();
      if (e.t === 'dawn') { holdCards(DAWN_DELAY); endJoy(); const ll = lossLine(), L = ui.pendingLedger; ui.pendingLedger = null; if (ui.roadUI && L && (L.fell.length || L.ruins || L.piper)) { ui.ledgerUp = true; setTimeout(() => { if (ui.roadUI) ui.roadUI.showLedger(L, ll, ui.dawnLine); ui.ledgerUp = false; }, 600); } else if (ll) setTimeout(() => ctoast.show(ll, 'bad', 'skull'), 400); const snap = ui.game.snapshot(); if (snap) saves.save(snap).then(w => { ui.lastSave = { day: snap.night, where: w }; }); }
      if (e.t === 'over') { saves.clear(); { const L = store.get('legacy', { fame: 0, owned: {} }); S.fameEarned = fameOf(S); L.fame += S.fameEarned; store.set('legacy', L); } endT = now + 2600; ui.paused = false; closePanel(); stopPlacing(); hideCard(); if (ui.view.startOrbit) ui.view.startOrbit(); }
      if ((e.t === 'remove' || e.t === 'ruin') && ui.selected && ui.selected.type === 'building' && !S.byId.get(ui.selected.id)) closePanel();
      // [road] road-ui reads the same events here
      if (e.t === 'ledger') ui.pendingLedger = e;
      if (e.t === 'classUp') classBeat(e);
    }
    if (ui.roadUI && events.length) ui.roadUI.onEvents(events);
    if (events.length) solarVoice(ui, events);   // [story3]
    if (windowAtDawn) ui.game.story().release();
    // decisions wait for a calm moment: never while the hero fights or the dead are close (the night-1 arrival may
    // type itself out); a card that waited long enough opens once the hero itself is out of reach
    { const near = (x, y, r) => S.mobs.some(m => !m.dying && !(MOBS[m.kind] && MOBS[m.kind].animal) && (m.rise === undefined || m.rise >= 1) && Math.hypot(m.x - x, m.y - y) < r);
      const h = S.hero, fight = !h.dead && near(h.x, h.y, 12), camp = near(ui.game.map.town.x, ui.game.map.town.y, 12);
      calmT = fight || camp ? 0 : calmT + dt; waitT = S.story.encounters.length ? waitT + dt : 0; }
    const calmOk = calmT > 2.5 || (waitT > 25 && !(S.hero && !S.hero.dead && S.mobs.some(m => Math.hypot(m.x - S.hero.x, m.y - S.hero.y) < 6))) || (S.story.encounters[0] && S.story.encounters[0].kind === 'arrival');
    if (!ui.card && now >= dawnAt && S.story.encounters.length && !S.over && calmOk) showEncounter();
    if (endT > 0 && now >= endT) { endT = -1; ui.paused = true; showEnd(); }
    if (ui.placing && ui.placing.zone.ver !== S.occVersion) { refreshZone(); updateGhost(); }
    ui.view.frame(dt, { events, selected: ui.selected, ghost: ui.placing && ui.placing.ghost, zone: ui.placing && ui.placing.zoneMask });
    edgeMarks(); watchFrames(raw);
    // [road] begin
    if (ui.roadUI) ui.roadUI.tick(dt);
    // [road] end
    tickMini(dt);
    ui.folkTick(dt, events);   // [folk]
    ui.infernoTick(dt);   // [nest3]
    ui.rigTick(dt, events);   // [rig3] the Rig rolls, the next act is swapped in
    ui.econTick(dt, events);   // [econ3]
    ui.dodgeTick(dt);   // [combat2]
    ui.v2coreTick(dt);   // [v2]
    hudT -= dt; if (hudT <= 0) { updateHud(); ui.tickHome();   /* [pacify] the way home */ hudT = 0.2; if (ui.selected && !ui.paused) refreshPanel(); }
  }
  requestAnimationFrame(frame);
  addEventListener('resize', () => { dockH(); callouts.place(); });
  showStart();
}
