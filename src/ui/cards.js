// Cards: the one modal at a time (showCard / hideCard, arming against stray taps), and the story's windows:
// encounters and their choice chips, the arrival, System windows.
// The engine decides effects and words (the written story in content/story.js).
import { $, $$, ARM_MS, audio, chronLine, esc, rich, store } from './shared.js';
import { RARITY } from '../content/districts.js';
import { SYSTEM } from '../content/story.js';
import { icon } from './icons.js';
import { openBeat, reduced, sysRich, typeOn } from './system.js';

export function createCards(ui) {
  const { callouts, ctoast, strip } = ui;

  // ---------- cards ----------
  function showCard(kind, html, o = {}) {
    const fresh = ui.card !== kind || o.anim; ui.card = kind; const c = $('#card');
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
    if (ui.card && c.classList.contains('sysw') && !reduced()) { c.classList.add('closing'); const k = ui.card; setTimeout(() => { if (ui.card === null || ui.card === k) { $('#overlay').hidden = true; c.classList.remove('closing'); } }, 100); }
    else $('#overlay').hidden = true;
    ui.card = null;
  }

  // ---------- story: encounters, the status window, companions ----------
  const encState = new Map();   // per encounter: { page, touched, shownAt }
  // cause → consequence: every choice shows what it does as chips (green gains, red costs)
  function chipsOf(c) {
    const S = ui.game.state, out = [], add = (cls, ic, t) => out.push(`<span class="chip ${cls}">${ic ? icon(ic) : ''}${t}</span>`), sg = n => (n > 0 ? `+${n}` : `−${-n}`);
    if (c.cost && c.cost.gold) add('neg', 'scrap', `−${c.cost.gold}`);
    if (c.cost && c.cost.food) add('neg', 'food', `−${c.cost.food}`);
    const PERK = { heroDmg: ['sword', 'hero'], heroDmgMult: ['sword', 'hero'], keepHp: ['camp', 'Haven'], heroHp: ['heart', 'hero'], towerDmg: ['tower', 'towers'], heroSpeed: ['boots', 'speed'] };
    for (const f of c.fx || []) {
      if (f.op === 'gold') add(f.n > 0 ? 'pos' : 'neg', 'scrap', sg(f.n));
      else if (f.op === 'food') add(f.n > 0 ? 'pos' : 'neg', 'food', sg(f.n));
      else if (f.op === 'survivors') add(f.n > 0 ? 'pos' : 'neg', 'people', sg(f.n));
      else if (f.op === 'perk' && PERK[f.key]) add(f.mul && f.mul < 1 ? 'neg' : 'pos', PERK[f.key][0], `${PERK[f.key][1]} up`);
      else if (f.op === 'flag' && f.key === 'beacon') add('pos', 'people', '+1 later');
      else if (f.op === 'flag' && f.key === 'garden') add('pos', 'food', '+1 a day');
      else if (f.op === 'flag' && f.key === 'scout') add('info', 'route', 'better route');
      else if (f.op === 'flag' && f.key === 'quiet') add('pos', 'quiet', 'quieter');
      else if (f.op === 'title') add('info', 'title', 'title');
      else if (f.op === 'openFor' || f.op === 'open') add('info', 'pin', 'a marker');
      else if (f.op === 'recruit' || f.op === 'recruitNew') add('pos', 'star', esc(c.npcName || 'joins you'));
      else if (f.op === 'lose') add('neg', 'heartBreak', 'leaves');
      else if (f.op === 'bond') add(f.n > 0 ? 'pos' : 'neg', 'heartFill', sg(f.n));
      else if (f.op === 'gamble') add('risk', 'dice', `${Math.round(f.p * 100)}%`);
      else if (f.op === 'risen') add('neg', 'skull', 'the Ash-Born rise');
      else if (f.op === 'hurt') add('neg', 'drop', 'you get hurt');
      else if (f.op === 'unique') add('risk', 'eye', 'boss fight');
      else if (f.op === 'fail' && !f.quiet) add('risk', f.after ? 'hourglass' : 'end', f.after ? 'they may not wait' : 'the story ends');
      else if (f.op === 'trial') add('info', 'sword', 'trial');
      else if (f.op === 'dailyAccept') { for (const r of f.reward || []) { if (r.op === 'xp') add('pos', 'level', `+${r.n} xp`); else if (r.op === 'gold') add('pos', 'scrap', `+${r.n}`); else if (r.op === 'food') add('pos', 'food', `+${r.n}`); } add('risk', 'hourglass', `fail: −${f.fail} scrap`); }
      else if (f.op === 'claimSite') add('pos', 'flag', 'yours for good');
      else if (f.op === 'stripSite') add('pos', 'scrap', `+${f.n}`);
    }
    return out.length ? `<span class="chips">${out.join('')}</span>` : '';
  }
  // [arrive] how the people a choice adds get here, said the same way on every card (the engine's line, never the AI's)
  const arriveLine = (enc, c) => { const A = ui.game.story().arrivalOf && ui.game.story().arrivalOf(enc, c); return A ? `<span class="arrive ${A.mode}">${icon(A.icon)}<b>${esc(A.tag)}</b><span>${esc(A.text)}</span></span>` : ''; };
  const richHint = t => rich(t).replace(/(^|[\s(])([+\-−]\s?\d+%?\s(?:more\s)?(?:scrap|food|people|person|noise|heat|bond|health|damage|hero damage|xp))/gi, '$1<b>$2</b>');

  function showEncounter(swap = false) {
    const S = ui.game.state, enc = S.story.encounters[0]; if (!enc) { afterEncounter(); return; }
    ui.paused = true; if (ui.placing) ui.stopPlacing(); ui.closePanel();
    let st = encState.get(enc.id); if (!st) { st = { page: 0, touched: false, shownAt: performance.now() }; encState.set(enc.id, st); }
    const isNew = !st.opened; st.opened = true;
    if (enc.kind === 'arrival') return showArrival(enc);
    if (enc.kind === 'window' || enc.kind === 'chapter') return showWindow(enc);
    const title = enc.title, line = enc.speaker && enc.speaker.line;
    const pages = [enc.scene];   // the written story opens on the choice page (one paragraph)
    const pg = Math.min(st.page, pages.length - 1), last = pg >= pages.length - 1;
    const dots = pages.length > 1 ? `<div class="pgdots">${pages.map((_, k) => `<i class="${k === pg ? 'on' : k < pg ? 'past' : ''}"></i>`).join('')}</div>` : '';
    const opts = last ? `<div class="opts one encopts">${enc.choices.map(c => { const ok = !c.cost || ui.game.story().can(c); const rar = c.rarity ? RARITY[c.rarity] : null;
        return `<button class="opt${rar ? ' rar' : ''}" data-choice="${c.id}" ${ok ? '' : 'disabled'} ${rar ? `style="--rar:${rar.color}"` : ''}><span class="nm"><span>${esc(c.label)}</span>${rar ? `<span class="rarity">${rar.name}</span>` : ''}</span>${chipsOf(c)}${c.hint ? `<span class="ds">${richHint(c.hint)}</span>` : ''}${arriveLine(enc, c)}</button>`; }).join('')}</div>`
      : `<div class="cardrow foot spread"><button class="btn ghost sm" id="encSkip">Skip</button><button class="btn big" id="encNext">Continue ${icon('next')}</button></div>`;
    showCard('enc', `<div class="enc ${enc.kind}"><div class="eyebrow"><span id="encEb"></span></div>
      <h1 class="sm">${esc(title)}</h1>
      ${enc.speaker && pg === 0 ? `<div class="speaker"><b>${esc(enc.speaker.name)}</b><span>${rich(line || '')}</span></div>` : ''}
      <p class="scene page" id="encScene">${rich(pages[pg])}</p>${dots}${opts}</div>`, { sys: true, arm: !swap && pg === 0, anim: isNew });
    const eb = $('#encEb'); if (swap || st.ebDone) eb.innerHTML = sysRich(enc.eyebrow || '[System]'); else { st.ebDone = true; typeOn(eb, enc.eyebrow || '[System]', 60); }
    const next = () => { st.touched = true; st.page = pg + 1; showEncounter(); };
    if (!last) { $('#encNext').onclick = onArmed(next); $('#encScene').onclick = onArmed(next); $('#encSkip').onclick = onArmed(() => { st.touched = true; st.page = pages.length - 1; showEncounter(); }); }
    $$('[data-choice]').forEach(b => b.onclick = onArmed(() => { st.touched = true; if (ui.game.choose(b.dataset.choice)) { encState.delete(enc.id); audio.play('claim'); afterEncounter(); } }));
  }
  function afterEncounter() {
    if (ui.game.state.story.encounters.length) { showEncounter(); return; }
    hideCard(); ui.paused = false;
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
      if (!ui.game.choose(b.dataset.gift)) return; audio.play('claim');
      $$('[data-gift]').forEach(x => { x.disabled = true; x.style.opacity = x === b ? '1' : '.25'; });
      typeOn($('#arS'), SYSTEM.firstLight, 60).then(() => setTimeout(() => { revealSystem(); afterEncounter(); }, 1300));
    });
  }
  function revealSystem() {
    strip.say('[System online] Every choice is written down.', 'sys', true);
  }
  // a window that explains something (a new system, a chapter retold): read at your own pace
  function showWindow(enc) {
    const lines = enc.lines && enc.lines.length ? enc.lines : [enc.scene];
    showCard('enc', `<div class="eyebrow"><span id="wEb"></span></div>${enc.title ? `<h1 class="sm">${esc(enc.title)}</h1>` : ''}<ul class="lines">${lines.map((_, k) => `<li id="wL${k}"></li>`).join('')}</ul>
      <div class="cardrow foot end"><button class="btn big" id="wOk">${esc(enc.choices[0].label)}</button></div>`, { sys: true, anim: true });
    (async () => { await typeOn($('#wEb'), enc.eyebrow, 80); for (let k = 0; k < lines.length; k++) await typeOn($(`#wL${k}`), lines[k], reduced() ? 1e9 : 90); })();
    $('#wOk').onclick = onArmed(() => { if (ui.game.choose(enc.choices[0].id)) afterEncounter(); });
  }
  /** a one-off window outside the story queue (previously on) */
  function showInfo(w) {
    ui.paused = true;
    showCard('info', `<div class="eyebrow"><span id="iEb"></span></div>${w.title ? `<h1 class="sm">${esc(w.title)}</h1>` : ''}<ul class="lines">${w.lines.map(l => `<li>${rich(l)}</li>`).join('')}</ul><div class="cardrow foot end"><button class="btn big" id="iOk">Go on</button></div>`, { sys: true });
    typeOn($('#iEb'), w.eyebrow, 60);
    $('#iOk').onclick = onArmed(() => { hideCard(); ui.paused = false; });
  }
  return { showCard, onArmed, hideCard, showEncounter, showInfo };
}
