// Cards: the one modal at a time (showCard / hideCard, arming against stray taps), and the story's windows:
// encounters and their choice chips, the arrival, System windows, skills, jobs (class evolution), contracts, victory.
// The engine decides effects; the Chronicler (story-ai.js) may only swap words in (AI_WAIT).
import { $, $$, AI_WAIT, ARM_MS, audio, chronLine, chronicler, esc, rich, store } from './shared.js';
import { CONTRACT_COPY } from '../content/contracts.js';
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
  const aiBusy = new Set();
  const aiSkips = new Set(['gift', 'evolve', 'season', 'chapter', 'district', 'arrival', 'skill', 'window', 'difficulty', 'victory']);
  function aiFetch(enc) {
    if (!enc || enc.ai != null || !chronicler.available()) return;
    if (enc.kind === 'contract') {
      enc.ai = 'pending'; enc.aiAt = performance.now(); aiBusy.add(enc.id);
      chronicler.contract(ui.game.story().fullContext(), enc).then(p => { aiBusy.delete(enc.id); enc.ai = p || 'none'; enc.aiReady = performance.now(); refreshIfOpen(enc); });
      return;
    }
    if (enc.kind === 'victory') {
      enc.ai = 'pending'; enc.aiAt = performance.now(); aiBusy.add(enc.id);
      const k = ui.game.state.story.contract || { n: enc.season, name: enc.contract, finale: {} };
      chronicler.seasonRecap(ui.game.story().fullContext(), k).then(p => { aiBusy.delete(enc.id); enc.ai = p || 'none'; enc.aiReady = performance.now(); refreshIfOpen(enc); });
      return;
    }
    if (aiSkips.has(enc.kind)) return;
    enc.ai = 'pending'; enc.aiAt = performance.now(); const id = enc.id; aiBusy.add(id);
    chronicler.rewrite(enc, ui.game.story().context()).then(patch => { aiBusy.delete(id); enc.ai = patch || 'none'; enc.aiReady = performance.now(); refreshIfOpen(enc); });
  }
  /** Claude's words arrive: swap them in only if the card has been open less than AI_WAIT and nothing was tapped */
  function refreshIfOpen(enc) {
    const top = ui.game && ui.game.state.story.encounters[0], st = encState.get(enc.id);
    if (ui.card !== 'enc' || top !== enc || !st || st.touched || performance.now() - st.shownAt > AI_WAIT) return;
    st.useAi = true; showEncounter(true);
  }
  const usePatch = enc => { const st = encState.get(enc.id); if (!enc.ai || typeof enc.ai !== 'object') return null; if (st && st.useAi === false) return null; return enc.ai; };

  // cause → consequence: every choice shows what it does as chips (green gains, red costs)
  function chipsOf(c) {
    const S = ui.game.state, out = [], add = (cls, ic, t) => out.push(`<span class="chip ${cls}">${ic ? icon(ic) : ''}${t}</span>`), sg = n => (n > 0 ? `+${n}` : `−${-n}`);
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
    const S = ui.game.state, enc = S.story.encounters[0]; if (!enc) { afterEncounter(); return; }
    ui.paused = true; if (ui.placing) ui.stopPlacing(); ui.closePanel();
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
    const opts = last ? `<div class="opts one encopts">${enc.choices.map(c => { const ok = !c.cost || ui.game.story().can(c); const rar = c.rarity ? RARITY[c.rarity] : null;
        return `<button class="opt${rar ? ' rar' : ''}" data-choice="${c.id}" ${ok ? '' : 'disabled'} ${rar ? `style="--rar:${rar.color}"` : ''}><span class="nm"><span>${esc(P && P.labels && P.labels[c.id] || c.label)}</span>${rar ? `<span class="rarity">${rar.name}</span>` : ''}</span>${chipsOf(c)}${c.hint ? `<span class="ds">${richHint(c.hint)}</span>` : ''}</button>`; }).join('')}</div>`
      : `<div class="cardrow foot spread"><button class="btn ghost sm" id="encSkip">Skip</button><button class="btn big" id="encNext">Continue ${icon('next')}</button></div>`;
    showCard('enc', `<div class="enc ${enc.kind}"><div class="eyebrow"><span id="encEb"></span>${badge(enc, P)}</div>
      <h1 class="sm">${esc(title)}</h1>
      ${enc.speaker && pg === 0 ? `<div class="speaker"><b>${esc(enc.speaker.name)}</b><span>${rich(line || '')}</span></div>` : ''}
      <p class="scene page" id="encScene">${rich(pages[pg])}</p>${dots}${opts}</div>`, { sys: true, arm: !swap && pg === 0, anim: isNew });
    const eb = $('#encEb'); if (swap || st.ebDone) eb.innerHTML = sysRich(enc.eyebrow || '[System]'); else { st.ebDone = true; typeOn(eb, enc.eyebrow || '[System]', 60); }
    const next = () => { st.touched = true; st.page = pg + 1; showEncounter(); };
    if (!last) { $('#encNext').onclick = onArmed(next); $('#encScene').onclick = onArmed(next); $('#encSkip').onclick = onArmed(() => { st.touched = true; st.page = pages.length - 1; showEncounter(); }); }
    $$('[data-choice]').forEach(b => b.onclick = onArmed(() => { st.touched = true; if (P && P.chronicle) enc.aiChron = P.chronicle; if (ui.game.choose(b.dataset.choice)) { encState.delete(enc.id); audio.play('claim'); afterEncounter(); } }));
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
    const ab = $('#ability'); if (ui.game.heroDef.ability) { ab.hidden = false; ab.classList.remove('reveal'); void ab.offsetWidth; ab.classList.add('reveal'); }
    strip.say('[System online] Every choice is written down.', 'sys', true);
  }
  // a blessing is a skill: one line, one icon, one a dawn
  function showSkill(enc) {
    showCard('enc', `<div class="eyebrow"><span id="skEb"></span></div><div class="skillw" style="margin:14px 0 18px"><span class="glyph">${icon(enc.icon === 'star' ? 'star' : 'skill')}</span><span class="nm">${esc(enc.title)}</span><span class="ds">${esc(enc.scene)}</span></div>
      <div class="cardrow foot end"><button class="btn big" id="skOk">Take it</button></div>`, { sys: true, narrow: true, anim: true });
    typeOn($('#skEb'), enc.eyebrow, 60);
    $('#skOk').onclick = onArmed(() => { if (ui.game.choose('take')) { audio.play('claim'); afterEncounter(); } });
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
    $('#jWait').onclick = onArmed(() => { if (ui.game.choose('wait')) { encState.delete(enc.id); afterEncounter(); } });
    $('#jGo').onclick = onArmed(() => { if (!st.sel) return; if (ui.game.choose(`trial-${st.sel}`)) { audio.play('claim'); encState.delete(enc.id); afterEncounter(); } });
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
    $('#kSign').onclick = onArmed(() => { if (!st.sel) return; if (ui.game.choose(st.sel)) { audio.play('claim'); encState.delete(enc.id); afterEncounter(); } });
  }
  function seasonLines(n) {
    const S = ui.game.state, from = n > 1 ? (S.story.seasons || []).find(s => s.n === n) : null, d0 = from ? from.day : 1;
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
    $('#vOk').onclick = onArmed(() => { st.touched = true; if (ui.game.choose('take')) { const L = store.get('legacy', { fame: 0, owned: {} }); L.fame += enc.reward.fame; store.set('legacy', L); audio.play('claim'); afterEncounter(); } });
  }
  return { showCard, onArmed, hideCard, aiFetch, showEncounter, showInfo, classBeat };
}
