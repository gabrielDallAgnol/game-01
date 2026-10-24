// [rig3] The Haven Rig on screen: the Rig's section in the Camp panel (its four systems, what raises each, the cargo it
// would carry), the "Pack up & roll" pill once the road is open, the confirmation, and the act change itself: the sim
// waits while the view folds the Rig up and drives it off, then sim/migrate.js builds the next act and the start
// module swaps the game and the view (ui.beginRun). A dawn-style save follows at once.
import { $, esc, rich, saves, audio } from './shared.js';
import { icon } from './icons.js';
import { migrateRun } from '../sim/migrate.js';
import { RIG } from '../content/rig.js';

const CSS = `
.rigbtn{justify-self:end;margin-top:6px;display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:20px;border:1px solid rgba(232,176,33,.85);
  background:linear-gradient(180deg,rgba(70,52,10,.96),rgba(36,26,6,.96));color:#ffe6a0;font:700 15px/1 var(--display);letter-spacing:.05em;text-transform:uppercase;pointer-events:auto;
  box-shadow:0 0 16px rgba(232,176,33,.35);animation:rigpulse 2.2s ease-in-out infinite}
.rigbtn .ic{color:#e8b021;font-size:16px}
@keyframes rigpulse{50%{box-shadow:0 0 26px rgba(232,176,33,.6)}}
.rigsys{display:grid;grid-template-columns:1fr;gap:6px;margin:10px 0 4px}
.rigsys .rs{display:grid;grid-template-columns:76px 46px 1fr;align-items:center;gap:8px;font:500 13px/1.25 var(--body,inherit)}
.rigsys .rs b{font:700 14px/1 var(--display);text-transform:uppercase;letter-spacing:.03em;color:#ffd77a}
.rigsys .pips{display:flex;gap:3px}.rigsys .pips i{width:11px;height:11px;border-radius:2px;border:1px solid rgba(232,176,33,.7)}.rigsys .pips i.on{background:#e8b021}
.rigsys .src{color:var(--dim,#b9b0a0)}
.rigsys .src em{font-style:normal;color:#ffe6a0}
.rigcargo{margin:8px 0 2px;font:500 13px/1.35 var(--body,inherit);color:var(--dim,#b9b0a0)}
.rigcargo b{color:#ffe6a0}
.rigroll{margin-top:10px;font:600 14px/1.3 var(--mono,monospace);color:#ffe6a0}
`;

export function createRigUi(ui) {
  if (!document.getElementById('rig-css')) { const st = document.createElement('style'); st.id = 'rig-css'; st.textContent = CSS; document.head.appendChild(st); }
  const ok = () => RIG.on && ui.game && typeof ui.game.rigInfo === 'function';
  // the "Pack up & roll" pill (under the Camp pill, like Return to Camp)
  const ca = $('#campAway'), btn = document.createElement('button');
  btn.className = 'rigbtn'; btn.hidden = true; btn.setAttribute('aria-label', 'Pack up and roll to the next act');
  btn.innerHTML = `${icon('camp')}<span>Pack up &amp; roll</span>`;
  if (ca && ca.parentNode) ca.parentNode.insertBefore(btn, ca.nextSibling);
  btn.onclick = () => { if (ok() && !ui.paused && !ui.card) ask(); };
  let roll = null;   // the act change in progress: { t, next, made }
  // a tap while the Rig drives (out or in) skips the drive
  window.addEventListener('pointerdown', () => { if (ui.view && ui.view.rig && (roll || /^(in|fold|drive)$/.test(ui.view.rig.phase()))) ui.view.rig.skip(); }, { capture: true });

  // ---------- the Camp panel's Rig section ----------
  function panelHtml() {
    if (!ok()) return '';
    const I = ui.game.rigInfo(), c = I.cargo;
    const rows = I.ups.map(u => `<div class="rs"><b>${esc(u.name)}</b><span class="pips">${Array.from({ length: u.max }, (_, k) => `<i class="${k < u.lvl ? 'on' : ''}"></i>`).join('')}</span><span class="src">${u.next !== null ? `<em>${u.score}/${u.next}</em> · ` : '<em>max</em> · '}${esc(u.src)}</span></div>`).join('');
    const can = !I.block;
    return `<div class="rigsys" aria-label="The Rig's systems">${rows}</div>
      <p class="rigcargo">Act ${I.leg}: <b>${esc(I.name)}</b> · Rig health ×${I.hp.toFixed(2)} · guns ×${I.dmg.toFixed(2)}${I.shots ? ' +1 gun' : ''}<br>If it rolled now: <b>${c.buildings}</b> buildings salvaged at <b>${c.pct}%</b> → <b>${c.scrap}</b> scrap, <b>${c.food}</b> food in the hold.</p>
      <div class="opts one">${`<button class="opt" id="opt-roll" data-roll="1" ${can ? '' : 'disabled'}><span class="nm">Pack up &amp; roll</span><span class="ds">${can ? `On to Act ${I.nextLeg}: ${esc(I.next)}.` : esc(I.block)}</span></button>`}</div>`;
  }
  const panelSig = () => { if (!ok()) return ''; const S = ui.game.state; return `${S.rig.mode}|${Object.values(S.rig.ups).join('')}|${ui.game.rigBlock()}|${S.buildings.length}`; };

  // ---------- the confirmation ----------
  function ask() {
    const I = ui.game.rigInfo(); if (I.block) { ui.toast(I.block, 'bad'); return; }
    const c = I.cargo; ui.paused = true; if (ui.closePanel) ui.closePanel(); if (ui.stopPlacing) ui.stopPlacing();
    ui.showCard('rig', `<div class="eyebrow">[Haven Rig · Act ${I.leg} → Act ${I.nextLeg}]</div><h1 class="sm">Pack up &amp; roll?</h1>
      <ul class="lines">
        <li>Everything on the ground comes down: <b>${c.buildings}</b> buildings salvaged at <b>${c.pct}%</b>.</li>
        <li>The hold carries <b>${c.scrap}</b> scrap and <b>${c.food}</b> food${c.people ? `, and <b>${c.people}</b> people from the homes` : ''}.</li>
        <li>Next: <b>${esc(I.next)}</b>. The Rig anchors there and the cargo is your starting stock.</li>
        <li>You keep your level, your stats, your companions and the Rig's systems.</li>
      </ul>
      <div class="cardrow foot"><button class="btn ghost" id="rigNo">Not yet</button><button class="btn big" id="rigGo">Pack up &amp; roll</button></div>`, { sys: true });
    $('#rigNo').onclick = ui.onArmed(() => { ui.hideCard(); ui.paused = false; });
    $('#rigGo').onclick = ui.onArmed(() => { ui.hideCard(); go(); });
  }
  function go() {
    const cargo = ui.game.rigPack(); if (!cargo) { ui.paused = false; return; }
    for (const e of ui.game.state.events) if (e.t === 'toast' && e.kind === 'sys') ui.toast(e.msg, 'sys');
    ui.paused = true; btn.hidden = true;
    if (audio && audio.play) try { audio.play('build'); } catch (err) { /* sound is optional */ }
    roll = { t: 0, next: ui.game.rigInfo().next, made: false };
  }
  /** once a frame: the drive plays out (sim paused), then the next act is made and swapped in */
  function rigTick(dt, events) {
    if (events && ok()) for (const e of events) if (e.t === 'rigRoad') btn.hidden = false;
    if (roll) {
      roll.t += dt;
      const done = (ui.view && ui.view.rig && ui.view.rig.done()) || roll.t > RIG.anim.pack + RIG.anim.drive + 12;
      ui.paused = true;
      if (done && !roll.made) {
        roll.made = true;
        ui.showCard('rigroad', `<div class="eyebrow">[Haven Rig]</div><h1 class="sm">On the road</h1><p class="rigroll">${rich(`Rolling for **${esc(roll.next)}**…`)}</p>`, { sys: true, arm: false });
        setTimeout(() => {   // let the card paint before the slow part (a new map and a new view)
          let g2 = null;
          try { g2 = migrateRun(ui.game); } catch (err) { console.error(err); }
          roll = null;
          if (!g2) { ui.hideCard(); ui.paused = false; ui.toast('The road was blocked. The Rig stays.', 'bad'); return; }
          ui.beginRun(null, null, null, g2);
          const snap = g2.snapshot(); if (snap) saves.save(snap).then(w => { ui.lastSave = { day: snap.night, where: w }; });
        }, 60);
      }
    }
    if (!roll && ok()) { const S = ui.game.state; btn.hidden = !(S.rig.mode === 'anchored' && !ui.game.rigBlock() && !S.over); }
  }
  return { rigPanelHtml: panelHtml, rigPanelSig: panelSig, rigAsk: ask, rigTick };
}
