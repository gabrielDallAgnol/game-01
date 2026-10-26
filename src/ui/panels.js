// The selection panel: a building, the Camp, a site, rubble, a ruin or a region (hive), and its buttons.
import { $, $$, FLAGS, RINGS, SHORT, audio, campCopy, rich } from './shared.js';
import { SPECS, SPEC_ORDER, SPEC_COST } from '../content/towers.js';
import { BUILDINGS, KEEP, MAX_LEVEL, UNLOCKS } from '../content/buildings.js';
import { CREW_NEED } from '../sim/game.js';
import { LANDMARKS, idx } from '../sim/mapgen.js';
import { TRADES } from '../content/heroes.js';
import { hiveName } from '../content/names.js';
import { icon } from './icons.js';

export function createPanels(ui) {
  const {  } = ui;

  // ---------- panels ----------
  let lastSig = '';
  function selB() { const S = ui.game.state; return ui.selected && ui.selected.type === 'building' ? S.byId.get(ui.selected.id) : ui.selected && ui.selected.type === 'keep' ? S.keep : null; }
  function panelSig() {
    const S = ui.game.state, b = selB();
    return [S.gold, S.food, S.phase, ui.selected && ui.selected.type, ui.selected && ui.selected.id, ui.selected && ui.selected.type === 'landmark' ? `${ui.game.landmarkReach(ui.selected.id)}` : '', b ? `${b.spec || ''}${b.level}:${Math.ceil(b.hp)}:${b.maxHp}:${Math.floor((b.built ?? 1) * 20)}:${b.ruined ? 1 : 0}` : ''].join('|');
  }
  /** re-render the open panel only when what it shows changed */
  function refreshPanel() { const sig = panelSig(); if (sig !== lastSig) { lastSig = sig; renderPanel(); } }
  function openSel(sel) { if ($('#tray').classList.contains('open')) ui.setDrawer(false); ui.selected = sel; renderPanel(); lastSig = panelSig(); $('#panel').hidden = false; ui.dockH(); }
  function closePanel() { ui.selected = null; $('#panel').hidden = true; ui.dockH(); }
  const opt = (id, data, name, cost, ds, disabled) => `<button class="opt" id="${id}" ${data} ${disabled ? 'disabled' : ''}><span class="nm">${name}${cost !== null ? `<span class="cost">${icon('scrap')}${cost}</span>` : ''}</span><span class="ds">${ds}</span></button>`;
  function flushToasts() { for (const e of ui.game.drainEvents()) if (e.t === 'toast' || e.t === 'fail') ui.toast(e.msg, e.t === 'fail' ? 'bad' : e.kind); }
  function renderPanel() {
    if (!ui.selected || !ui.game) return;
    const S = ui.game.state, body = $('#pBody'), day = !S.over;
    if (ui.selected.type === 'keep') {
      const k = S.keep, l = k.level;
      $('#pEyebrow').textContent = 'Your home'; $('#pTitle').textContent = `The Haven · level ${l}`;
      let html = `<div class="stat"><span>Health <b>${Math.ceil(k.hp)} / ${k.maxHp}</b></span><span>${campCopy(KEEP.desc[l - 1])}</span>${ui.strongLine ? ui.strongLine() : ''}</div><div class="opts two">`;   // [gemini3] small and strong
      const miss = l < 3 ? ui.game.keepNeeds() : [];
      html += l < 3 ? opt('opt-keep', 'data-keep="1"', 'Raise the Haven', KEEP.cost[l], miss.length ? `Still needed: ${miss.join(' · ')}` : `${campCopy(KEEP.desc[l])} · buildings up to level ${l + 1}`, miss.length > 0 || S.gold < KEEP.cost[l] || !day) : '';
      if (FLAGS.trader && S.trade && !S.trade.done && day) html += opt('opt-trader', 'data-trader="1"', 'Visit the trader', null, 'One deal before nightfall.', false);
      body.innerHTML = html + '</div>' + (l >= 3 ? '<p class="note">The Haven stands at its full height.</p>' : '');
      ui.selected.range = KEEP.range[l - 1] + S.P.towerRange;
      return;
    }
    if (ui.selected.type === 'region') {
      const info = ui.game.regionInfo(ui.selected.id), reg = ui.game.map.regions[ui.selected.id];
      $('#pEyebrow').textContent = `${ui.names[ui.selected.id]} · ${RINGS[Math.min(3, reg.ring)]}`;
      $('#pTitle').textContent = info.nest ? `Inferno Nest: ${hiveName(ui.game.map.seed, ui.selected.id)} · ${info.active ? 'awake' : 'asleep'}` : ui.names[ui.selected.id];
      let html = '';
      html += info.nest ? '<p class="note">An Inferno Nest sleeps here.</p>' : '<p class="note">No Inferno Nest here.</p>';
      body.innerHTML = html;
      return;
    }
    if (ui.selected.type === 'landmark') {
      const l = S.landmarks[ui.selected.id], L = LANDMARKS[l.kind], near = ui.game.landmarkReach(ui.selected.id);
      $('#pEyebrow').textContent = l.owned ? 'Yours · a forward base' : 'A place out there';
      $('#pTitle').textContent = L.name;
      let html = `<div class="stat"><span>${L.desc}</span><span>${l.owned ? 'You can build around it.' : 'Claim it and you can build around it too.'}</span></div>`;
      if (!l.owned) html += `<div class="opts one">${opt('opt-claim', 'data-claim="1"', near ? `Claim the ${L.name}` : 'Walk up to it first', near ? L.cost : null, near ? 'Yours for good: its bonus and a build zone around it.' : 'Your hero is on the way. Tap again when you are next to it.', !near || S.gold < L.cost || !day)}</div>`;
      body.innerHTML = html; return;
    }
    if (ui.selected.type === 'rubble') {
      const r = ui.game.rubbleAt(ui.selected.x, ui.selected.y);
      const woods = ui.game.map.wild && ui.game.map.wild[idx(Math.floor(ui.selected.x), Math.floor(ui.selected.y))];
      $('#pEyebrow').textContent = 'Your land'; $('#pTitle').textContent = r.blocks ? 'A ruined block' : woods ? 'Trees' : 'Rubble';
      if (r.trees && ui.treesHtml) { body.innerHTML = ui.treesHtml(r, opt, day); return; }   // [gemini3] trees are a job: by hand or the Logger's Hut
      body.innerHTML = `<div class="stat"><span>${r.blocks ? 'Walls block building and the Ash-Born alike.' : 'Blocks building. Slows the Ash-Born.'}</span><span>Knock it down to make room.</span></div>`
        + (r.cells.length ? `<div class="opts one">${opt('opt-clear', 'data-clear="1"', r.blocks ? `Knock down ${r.blocks} ${r.blocks === 1 ? 'bay' : 'bays'} of the block` : woods ? `Fell ${r.cells.length} ${r.cells.length === 1 ? 'cell' : 'cells'} of trees` : `Clear ${r.cells.length} ${r.cells.length === 1 ? 'cell' : 'cells'} of rubble`, r.cost, r.blocks ? 'A 3×3 patch becomes open ground. The noise carries.' : 'A 3×3 patch around this spot becomes open ground.', S.gold < r.cost || !day)}</div>` : '<p class="note">Nothing left to clear here.</p>');
      return;
    }
    const b = selB(); if (!b) { closePanel(); return; }
    const B = BUILDINGS[b.type];
    $('#pEyebrow').textContent = ui.names[ui.game.map.region[idx(Math.floor(b.x), Math.floor(b.y))]] || '';
    $('#pTitle').textContent = `${b.spec ? SPECS[b.spec].name : B.name} · level ${b.level}${b.ruined ? ' · ruined' : ''}`;   // [towers] a specialised tower goes by its role
    if (b.ruined) {   // a ruin stays until you rebuild it by hand: no income, no defence
      const rc = ui.game.rebuildCost(b.id);
      body.innerHTML = `<div class="stat"><span><b class="bad">Ruined</b> · no ${b.type === 'tower' ? 'fire' : b.type === 'farm' ? 'food' : b.type === 'house' ? 'scrap, nobody lives here' : 'use'} until rebuilt</span><span>Rebuilding costs half the price, and it stands at full health.</span></div><div class="opts two">`
        + opt('opt-up', 'data-rebuild="1"', day ? `Rebuild the ${B.name.toLowerCase()}` : 'Rebuild at dawn', rc, day ? `Back as it was: level ${b.level}.` : 'Nobody lays bricks with the Ash-Born at the gate.', S.gold < rc || !day)
        + opt('opt-demo', 'data-demo="1"', 'Clear the ruin', null, '<b class="bad">No scrap back</b> · the lot is free again.', !day) + '</div>';
      ui.selected.range = null; return;
    }
    let html = `<div class="stat"><span>Health <b>${Math.ceil(b.hp)} / ${b.maxHp}</b></span><span>${b.spec ? rich(SPECS[b.spec].line) : B.desc[b.level - 1]}</span></div><div class="opts two">`;
    if (b.type === 'wall') {
      const run = ui.game.wallRun(b.id), total = run.reduce((a, w) => a + ui.game.upCostOf(w), 0);
      if (b.level < MAX_LEVEL) { const capped = b.level >= ui.game.keepLevel(); html += opt('opt-upw', 'data-upw="1"', capped ? 'Raise the Haven first' : `Upgrade this barricade · ${run.length} ${run.length === 1 ? 'post' : 'posts'}`, capped ? null : total, capped ? `Nothing grows past the Haven (level ${ui.game.keepLevel()}).` : `${B.desc[b.level]} each.`, capped || S.gold < ui.game.upCostOf(b) || !day); }
      { const back = Math.floor(ui.game.costOf(b.type) / 2); html += opt('opt-demo', 'data-demo="1"', 'Pull down this post', null, `<b class="good">${back ? `+${back} scrap back` : 'No scrap back'}</b> · <b class="bad">a gap in the line</b>.`, !day); }
      body.innerHTML = html + '</div>'; ui.selected.range = null; return;
    }
    const capped = b.level >= ui.game.keepLevel(), maxL = B.maxLevel || MAX_LEVEL, needTech = b.level + 1 === 3 && UNLOCKS[b.type] && !ui.game.hasTech(UNLOCKS[b.type]);
    if (b.cq && ui.econPanel) { body.innerHTML = ui.econPanel(b, opt); ui.selected.range = null; return; }   // [econ3] a blueprint in the construction queue
    if (B.tech) { body.innerHTML = `<div class="stat"><span>${b.built < 1 ? `Under construction <b>${Math.floor(b.built * 100)}%</b>` : 'Working'}</span><span>${B.desc[0]}</span></div><div class="opts two">${opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(ui.game.costOf(b.type) / 2)} scrap back</b> · <b class="bad">its bonus is gone</b>.`, !day)}</div>`; ui.selected.range = null; return; }
    if (b.type === 'tower') { const on = ui.game.manned(b), need = CREW_NEED[b.level - 1], cw = ui.game.crewing(); html = html.replace('</div><div class="opts two">', `<span>${on ? `Crew <b>${need}</b> on watch` : `<b class="bad">Silent: no crew</b>. It needs ${need} people; ${cw.free} free. Build or upgrade homes.`}</span></div><div class="opts two">`); }
    // [towers] begin: a level 3 tower takes one role for good
    if (b.type === 'tower' && b.level >= 3 && !b.spec) {
      html += SPEC_ORDER.map(r => opt(`opt-spec-${r}`, `data-spec="${r}"`, `${SPECS[r].name} <small>${SPECS[r].short}</small>`, SPEC_COST, rich(SPECS[r].line), S.gold < SPEC_COST || !day)).join('');
      html += opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(ui.game.costOf(b.type) / 2)} scrap back</b> · <b class="bad">level ${b.level} lost</b>.`, !day);
      body.innerHTML = html + '</div><p class="note">Level 3: pick a role for good. Same crew, same upkeep.</p>'; ui.selected.range = ui.game.towerStats(b).range; return;
    }
    // [towers] end
    if (b.level < maxL) { const c = ui.game.upCostOf(b); html += opt('opt-up', 'data-up="1"', capped ? 'Raise the Haven first' : needTech ? `Needs a ${SHORT[UNLOCKS[b.type]]}` : `Upgrade to level ${b.level + 1}`, capped || needTech ? null : c, capped ? `Nothing grows past the Haven (level ${ui.game.keepLevel()}).` : needTech ? `Build a ${SHORT[UNLOCKS[b.type]]} to unlock level 3.` : `${B.desc[b.level]} · ${ui.game.maxHpOf(b.type, b.level + 1)} hp${b.type === 'tower' ? ` · needs ${CREW_NEED[b.level]} crew${ui.game.manned(b) && ui.game.crewing().free < CREW_NEED[b.level] - CREW_NEED[b.level - 1] ? ' · <b class="bad">nobody free: it falls silent</b>' : ''}` : ''}`, capped || needTech || S.gold < c || !day); }
    html += opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(ui.game.costOf(b.type) / 2)} scrap back</b> · <b class="bad">level ${b.level} lost</b>.`, !day);
    body.innerHTML = html + '</div>' + (b.level >= MAX_LEVEL ? '<p class="note">Fully upgraded.</p>' : '');
    ui.selected.range = b.type === 'tower' ? (b.spec ? ui.game.specRange(b) : ui.game.towerStats(b).range) : null;
  }
  $('#pBody').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn || btn.disabled || !ui.selected) return;
    if (btn.dataset.claim && ui.game.claimLandmark(ui.selected.id)) { closePanel(); ui.updateHud(); return; }
    if (btn.dataset.clear && ui.treesClick && ui.game.rubbleAt(ui.selected.x, ui.selected.y).trees) { if (ui.treesClick(ui.selected.x, ui.selected.y)) { closePanel(); ui.updateHud(); } return; }   // [gemini3]
    if (btn.dataset.clear) { const n = ui.game.clearRubble(ui.selected.x, ui.selected.y); if (n) { ui.toast(`${n} ${n === 1 ? 'cell' : 'cells'} cleared.`); closePanel(); ui.updateHud(); return; } }
    if (btn.dataset.rebuild) { if (ui.game.rebuild(ui.selected.id)) { audio.play('build'); ui.toast(`${BUILDINGS[ui.game.state.byId.get(ui.selected.id).type].name} rebuilt.`, 'good'); renderPanel(); ui.updateHud(); } return; }
    if (btn.dataset.keep && ui.game.upgradeKeep()) ui.toast('The Haven rises higher.');
    if (btn.dataset.trader && FLAGS.trader) { closePanel(); ui.paused = true; showTrader(); return; }
    if (btn.dataset.up && ui.game.upgrade(ui.selected.id)) ui.toast('Upgraded.');
    if (btn.dataset.spec && ui.game.specialise(ui.selected.id, btn.dataset.spec)) { audio.play('build'); ui.toast(`[Tower specialised: ${SPECS[btn.dataset.spec].name}] ${SPECS[btn.dataset.spec].line}`, 'good'); }   // [towers]
    if (btn.dataset.upw) { const n = ui.game.upgradeWall(ui.selected.id); if (n) ui.toast(`${n} ${n === 1 ? 'post' : 'posts'} upgraded.`); }
    if (btn.dataset.demo) {
      if (btn.dataset.sure) { if (ui.game.demolish(ui.selected.id)) { ui.toast('Pulled down.'); closePanel(); ui.updateHud(); return; } }
      else { btn.dataset.sure = '1'; btn.classList.add('sure'); btn.querySelector('.nm').textContent = 'Tap again to confirm'; return; }
    }
    renderPanel(); ui.updateHud();
  });
  // the trader (cut: FLAGS.trader)
  function showTrader() {
    const S = ui.game.state; if (!S.trade) { ui.paused = false; return; }
    ui.showCard('trade', `<div class="eyebrow">A caravan at the gate</div><h1 class="sm">The trader</h1>
      <div class="opts one">${S.trade.deals.map(id => { const t = TRADES.find(x => x.id === id); const can = t.gold ? S.gold >= t.gold : S.food >= t.food;
        return `<button class="opt" data-trade="${id}" ${can ? '' : 'disabled'}><span class="nm">${t.name}<span class="cost">${t.gold ? `${icon('scrap')}${t.gold}` : `${icon('food')}${t.food}`}</span></span><span class="ds">${t.desc}</span></button>`; }).join('')}</div>
      <div class="cardrow foot"><button class="btn ghost" id="tSkip">Not today</button></div>`);
    $$('[data-trade]').forEach(b => b.onclick = ui.onArmed(() => { ui.game.trade(b.dataset.trade); ui.hideCard(); ui.paused = false; }));
    $('#tSkip').onclick = ui.onArmed(() => { ui.hideCard(); ui.paused = false; });
  }
  $('#pClose').onclick = closePanel;
  return { refreshPanel, openSel, closePanel };
}
