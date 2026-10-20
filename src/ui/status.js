// The Status window (path, titles, companions, chronicle), companion chat, the More sheet (sound, graphics,
// speed, autopilot), the run log and the end screen.
import { $, $$, AI_WAIT, FLAGS, audio, chronLine, chronicler, esc, rich, store } from './shared.js';
import { BARKS, ROLES, TITLES } from '../content/story.js';
import { CLASS_TIERS, HEROES } from '../content/heroes.js';
import { FAMILIES, PERKS } from '../content/perks.js';
import { RULES } from '../content/season.js';
import { icon } from './icons.js';

export function createStatus(ui) {
  const {  } = ui;

  function showStatus() {
    const S = ui.game.state, ST = S.story, comp = ST.npcs.filter(n => n.joined && n.alive), K = ST.contract;
    ui.paused = true; if (ui.placing) ui.stopPlacing(); ui.closePanel();
    const hero = ui.game.heroDef, q = ui.game.story().dailyProgress();
    ui.showCard('status', `<button class="closex" id="stX" aria-label="Close">${icon('close')}</button><div class="eyebrow">[Status]</div>
      <h1 class="sm">${esc(hero.name)} · Lv ${S.lvl}</h1>
      <div class="statgrid"><span>Health<b>${Math.ceil(S.hero.hp)}/${S.hero.maxHp}</b></span><span>Xp<b>${S.xp}/${ui.game.xpNext()}</b></span><span>Day<b>${S.night}</b></span><span>Dead put down<b>${S.kills}</b></span><span>People<b>${ui.game.pop()}</b></span><span>Season<b>${S.season.n}</b></span></div>
      ${q ? `<h2>Daily quest</h2><div class="kontrakt"><b>${q.penalty ? '[Penalty] ' : ''}${esc(q.title)}</b><span>${esc(q.goal)} · ${q.done ? 'done' : `${q.have}/${q.n}`}</span></div>` : ''}
      ${K ? `<h2>Contract</h2><div class="kontrakt"><b>${esc(K.name)}${K.won ? ' · won' : ''}</b><span>${K.finale.kind === 'unique' ? `${esc(K.finale.name)} walks on night ${K.finale.night}.` : `Burn ${esc(K.finale.name)} by night ${K.finale.night}.`}${S.season.rules && S.season.rules.length ? ` Rules: ${S.season.rules.map(r => esc(RULES[r] ? RULES[r].name : r)).join(', ')}.` : ''}</span>${K.twist ? `<span style="color:#c6b8ff;font-style:italic">${esc(K.twist)}</span>` : ''}</div>` : ''}
      <h2>Your path</h2>${pathHtml()}
      <h2>Titles</h2><div class="titles">${ST.titles.length ? ST.titles.map(t => `<span class="title" title="${esc(TITLES[t].desc)}">${icon('title')}${esc(TITLES[t].name)}</span>`).join('') : '<span class="note">None yet. The System is watching.</span>'}</div>
      <h2>Companions</h2><div class="comps">${comp.length ? comp.map(n => `<div class="comp"><b>${esc(n.name)}</b><span>${n.withHero ? 'Travels with you · their post stands empty' : `${esc(ROLES[n.role].post)} · ${esc(ROLES[n.role].bonus)}`}</span><span class="bond">${Array.from({ length: 5 }, (_, k) => icon(k < n.bond ? 'heartFill' : 'heart')).join('')}</span><span class="acts"><button class="btn sm sys" data-chat="${n.id}">Talk</button><button class="btn sm sys ghost" data-follow="${n.id}" data-on="${n.withHero ? 0 : 1}">${n.withHero ? 'Back to post' : 'With me'}</button></span></div>`).join('') : '<span class="note">Nobody yet. Answer the calls: people are out there.</span>'}</div>
      <h2>Chronicle</h2><ol class="chron">${ST.chronicle.slice().reverse().slice(0, 14).map(c => `<li><span>Day ${c.day}</span>${esc(c.text)}</li>`).join('')}</ol>
      <p class="note" style="margin-top:10px">${ui.lastSave ? `Saved at dawn of day ${ui.lastSave.day} (${ui.lastSave.where === 'cloud' ? 'your account' : 'this device'}).` : 'The run saves itself every dawn.'}</p>
      <label class="aitog"><input type="checkbox" id="aiTog" ${chronicler.enabled() ? 'checked' : ''}><span>Chronicler (Claude writes the story) · ${({ on: 'on', off: 'off', denied: 'not allowed', absent: 'not available here' })[chronicler.status()]}</span></label>
      <div class="cardrow foot end"><button class="btn big" id="stClose">Back</button></div>`, { sys: true, arm: false });
    $('#stClose').onclick = $('#stX').onclick = () => { ui.hideCard(); ui.paused = false; };
    $('#aiTog').onchange = e => { chronicler.setEnabled(e.target.checked); };
    $$('[data-chat]').forEach(b => b.onclick = () => showChat(b.dataset.chat));
    $$('[data-follow]').forEach(b => b.onclick = () => { ui.game.companionFollow(b.dataset.follow, b.dataset.on === '1'); showStatus(); });
  }
  function pathHtml() {
    const S = ui.game.state, P = S.path, tot = Object.values(P).reduce((a, b) => a + b, 0) || 1, cls = S.heroClass;
    const next = cls === 'survivor' ? `Your class unlocks at level ${CLASS_TIERS[0].lvl} (you are ${S.lvl}).` : !HEROES[cls].base ? `It grows at level ${CLASS_TIERS[1].lvl} (you are ${S.lvl}).` : !HEROES[cls].legend ? `Its legendary form: level ${CLASS_TIERS[2].lvl} (you are ${S.lvl}).` : 'Legendary. Your class is complete.';
    const tr = S.story.trial && !S.story.trial.done ? `<p class="note" style="color:#ff9a80">${esc(S.story.trial.name)} waits at the red marker.</p>` : '';
    return `<div class="path">${['hero', 'ranger', 'scavver', 'heart'].map(f => `<div class="pr" style="--fam:${FAMILIES[f].color}"><span>${FAMILIES[f].name}</span><span class="pb"><i style="width:${Math.round(P[f] / tot * 100)}%"></i></span><b>${Math.round(P[f] / tot * 100)}%</b></div>`).join('')}</div>
      <p class="note" style="margin-top:6px">Rescues and mercy lean to Heart, fighting up close to Brawn, scouting and quiet to Aim, deals and salvage to Wits. ${next}</p>${tr}`;
  }
  const chats = {};
  function showChat(id) {
    const S = ui.game.state, n = ui.game.story().npc(id); if (!n) return;
    const hist = chats[id] || (chats[id] = []);
    const ai = chronicler.available(), left = Math.max(0, 6 - n.chatToday);
    const bark = k => { const L = BARKS[k]; const t = L[(n.chatToday + hist.length + n.id.length) % L.length]; const open = S.landmarks.filter(l => !S.sealed[l.region] && l.kind !== 'unknown'); return t.replace('{want}', n.persona.want).replace('{fear}', n.persona.fear).replace('{heat}', Math.round(S.noise ?? S.heat ?? 0)).replace('{pop}', ui.game.pop()).replace('{district}', open.length ? 'The road by the ' + open[open.length - 1].kind : 'The fence'); };
    ui.showCard('chat', `<button class="closex" id="chX" aria-label="Back">${icon('close')}</button><div class="eyebrow">[${esc(ROLES[n.role].post)}] bond ${n.bond}/5${n.named ? ' · named' : ''}</div><h1 class="sm">${esc(n.name)}</h1>
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
      const r = await chronicler.chat({ ...n, roleName: ROLES[n.role].post }, hist.slice(-8), ui.game.story().context());
      hist.push({ role: 'assistant', content: r ? r.say : `(${n.name.split(' ')[0]} looks at you for a long moment and says nothing.)` });
      if (r && r.remember) { n.memory.push(r.remember); if (n.memory.length > 8) n.memory.shift(); }
      if (r && r.mood === 'warm' && n.bondedToday !== S.night) { n.bondedToday = S.night; if (n.bond < 3) n.bond++; }
      if (ui.card === 'chat') showChat(id);
    };
    if (form) setTimeout(() => $('#sayIn') && $('#sayIn').focus(), 50);
  }
  // ---------- the More sheet: everything rarely touched ----------
  const SPEEDS = [1, 2, 3];   // (ui.speed: the current one)
  const QNAME = { high: 'High', medium: 'Medium', low: 'Low' }, QNEXT = { high: 'medium', medium: 'low', low: 'high' };
  function showMore() {
    if (!ui.game || ui.card) return;
    ui.paused = true; ui.closePanel(); if (ui.placing) ui.stopPlacing();
    const S = ui.game.state, m = audio.muted();
    ui.showCard('more', `<button class="closex" id="moX" aria-label="Close">${icon('close')}</button><div class="eyebrow">The Camp</div><h1 class="sm">More</h1>
      <div class="moregrid">
        <button id="moStatus">${icon('level')}<span>Status<small>titles, companions</small></span></button>
        <button id="moMap">${icon('map')}<span>Map<small>where you have been</small></span></button>
        <button id="moSnd" aria-pressed="${!m}">${icon(m ? 'mute' : 'sound')}<span>Sound<small>${m ? 'off' : 'on'}</small></span></button>
        <button id="moQ">${icon('sun')}<span>Graphics<small>${ui.view ? QNAME[ui.view.quality()] : ''}</small></span></button>
        <button id="moSpd" aria-pressed="${ui.speed > 1}">${icon('clock')}<span>Speed<small>${ui.speed}×</small></span></button>
        <button id="moAuto" aria-pressed="${!!S.autopilot}">${icon('run')}<span>Autopilot<small>${S.autopilot ? 'on' : 'off'}</small></span></button>
        ${matchMedia('(pointer: coarse)').matches ? '' : `<button id="moZi">${icon('zoomIn')}<span>Zoom in</span></button><button id="moZo">${icon('zoomOut')}<span>Zoom out</span></button>`}
        ${FLAGS.runLog ? `<button id="moLog">${icon('map')}<span>Run log</span></button>` : ''}
      </div>
      <div class="cardrow foot end"><button class="btn big" id="moOk">Back</button></div>`, { arm: false, narrow: true });
    const back = () => { ui.hideCard(); ui.paused = false; };
    $('#moOk').onclick = $('#moX').onclick = back;
    $('#moStatus').onclick = () => { ui.hideCard(); showStatus(); };
    $('#moMap').onclick = () => { ui.hideCard(); ui.showMap(); };
    $('#moSnd').onclick = () => { audio.setMuted(!audio.muted()); ui.hideCard(); showMore(); };
    $('#moQ').onclick = () => { if (!ui.view) return; const q = QNEXT[ui.view.quality()]; ui.view.setQuality(q); store.set('quality', q); ui.hideCard(); showMore(); };
    $('#moSpd').onclick = () => { ui.speed = SPEEDS[(SPEEDS.indexOf(ui.speed) + 1) % SPEEDS.length]; ui.hideCard(); showMore(); };
    $('#moAuto').onclick = () => { const on = !ui.game.state.autopilot; ui.game.setAutopilot(on); $('#autoTag').hidden = !on; ui.hideCard(); showMore(); };
    if ($('#moZi')) { $('#moZi').onclick = () => ui.view && ui.view.setZoom(ui.view.getZoom() * 0.8); $('#moZo').onclick = () => ui.view && ui.view.setZoom(ui.view.getZoom() * 1.25); }
    if ($('#moLog')) $('#moLog').onclick = () => { ui.hideCard(); ui.paused = false; showLog(); };
  }

  // ---------- log and ending ----------
  function logTable() {
    const rows = ui.game.logRows(); if (!rows.length) return '<p class="note">No nights played yet.</p>';
    const pk = id => id.startsWith('m:') ? id.slice(2) : (PERKS.find(p => p.id === id) || { name: id }).name;
    return `<div class="logwrap"><table class="log"><thead><tr><th>Night</th><th>Camp left</th><th>Threat</th><th>Wave HP</th><th>Tower DPS</th><th>Kills hero·tower·Camp</th><th>Lost</th><th>Scrap in / spent</th><th>Skills</th></tr></thead><tbody>${rows.map(l => {
      const kp = l.keepEnd !== undefined ? Math.round(l.keepEnd / l.keepMax * 100) : null;
      return `<tr><td>${l.night}${l.bloodMoon ? ' (blood moon)' : ''}</td><td>${kp !== null ? kp + '%' : 'now'}</td><td>${l.ratio ?? '–'}</td><td>${l.waveHp}</td><td>${l.defDps}</td>
      <td>${l.kills.hero || 0} · ${l.kills.tower || 0} · ${l.kills.keep || 0}</td><td>${l.lost.length}${l.risen ? ` (${l.risen} rose)` : ''}</td><td>+${l.goldIn ?? 0} / ${l.spent}</td><td>${l.perks.map(pk).join(', ') || '–'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function showLog() {
    if (!ui.game || ui.paused) return;
    ui.paused = true; ui.closePanel(); if (ui.placing) ui.stopPlacing();
    ui.showCard('log', `<button class="closex" id="logX" aria-label="Close">${icon('close')}</button><div class="eyebrow">Run log · night ${ui.game.state.night}</div><h1 class="sm">The ledger</h1>${logTable()}<div class="cardrow foot"><button class="btn ghost" id="logClose">Back</button></div>`, { arm: false });
    $('#logClose').onclick = $('#logX').onclick = () => { ui.hideCard(); ui.paused = false; };
  }
  /** the obituary the script writes when the Chronicler is off or slow */
  function obituaryScript() {
    const S = ui.game.state, ST = S.story, comps = ST.npcs.filter(n => n.joined && n.alive).map(n => n.name.split(' ')[0]);
    const big = ST.chronicle.filter(c => c.imp >= 4 && !/^Woke up|contract|title/i.test(c.text)).slice(-1)[0];
    const L = ST.lostContract;
    return [
      `You woke in the woods with a window only you could see, and a bus full of strangers who chose to follow you.`,
      big ? `Day ${big.day}. ${chronLine(big.text)}` : `You held the Camp for ${S.night - 1} ${S.night - 1 === 1 ? 'night' : 'nights'}${comps.length ? `, with ${comps.slice(0, 2).join(' and ')} beside you` : ''}.`,
      L ? `The contract "${L.name}" ran out on night ${L.night}. ${L.finale} was still out there.` : `On night ${S.night} the Camp fell, and the window closed.`,
    ];
  }
  function showEnd() {
    const S = ui.game.state, st = S.stats, prev = store.get('best', 0), best = Math.max(prev, S.night), ST = S.story;
    store.set('best', best); store.set('runs', store.get('runs', 0) + 1);
    const kills = Object.values(st.killsByKind || {}).reduce((a, b) => a + b, 0), by = st.killsBy || {};
    const stats = [['Dead put down', kills], ['Your kills', by.hero || 0], ['Scrap earned', st.goldEarned], ['Buildings raised', st.built], ['Sites claimed', st.sites || 0], ['Companions', ST.npcs.filter(n => n.joined).length], ['Titles', ST.titles.length], ['Most people', st.peakPop], ['Hives burned', st.regionsClaimed], ['Buildings lost', st.buildingsLost], ['Times you fell', st.heroDeaths], ['Contracts won', ST.wins || 0]];
    const lastPages = ST.chronicle.filter(c => c.imp >= 3).slice(-3);
    const L = ST.lostContract, survived = Math.max(0, S.night - 1);
    let beats = obituaryScript(), shownAt = performance.now();
    const render = () => {
      ui.showCard('end', `<div class="eyebrow"><span>${L ? `[Contract failed: ${esc(L.name)}]` : '[The window closes]'}</span>${chronicler.available() ? `<span class="chr">${icon('quill')}Chronicler</span>` : ''}</div>
        <h1 class="big">${L ? 'The season ends without you' : 'The Camp has fallen'}</h1>
        <div class="bignum"><b>${survived}</b><span>${survived === 1 ? 'night' : 'nights'} survived${S.night > prev ? ' · a new best' : ` · best ${best}`}</span></div>
        <ul class="obit">${beats.map(b => `<li>${rich(b)}</li>`).join('')}</ul>
        <h2>The last pages</h2><ol class="lastpages">${lastPages.map(c => `<li><span>Day ${c.day}</span>${esc(chronLine(c.text))}</li>`).join('')}</ol>
        <details class="fold"><summary>The numbers</summary><div class="endstats">${stats.map(([k, v]) => `<div><b>${v ?? 0}</b><span>${k}</span></div>`).join('')}</div><p class="note">+${S.fameEarned || 0} fame for the next run.</p></details>
        <div class="cardrow foot end"><button class="btn big" id="again">New run</button></div>`, { sys: true });
      $('#again').onclick = ui.onArmed(() => { location.reload(); });
    };
    render();
    if (chronicler.available()) chronicler.obituary(ui.game.story().fullContext(), L ? `the contract "${L.name}" was lost` : `the Camp fell on night ${S.night}`).then(b => { if (b && ui.card === 'end' && performance.now() - shownAt < AI_WAIT * 2) { beats = b; render(); } });
  }
  $('#moreBtn').onclick = () => showMore();
  $('#dayPill').onclick = () => { if (ui.game && !ui.card && !ui.game.state.over) showStatus(); };
  return { showStatus, showMore, showLog, showEnd };
}
