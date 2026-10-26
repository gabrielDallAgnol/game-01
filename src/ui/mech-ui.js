// [mech] The Mechanic's UI: parts in the top bar, the Rig panel (tap the Rig: its modules, costs and what each does, in
// the bottom panel, never a popup), the turret panel (tier, range, the next tier and what it needs) and the turret
// card's slots in the build tray. Reads the game only through the API.
import { $ } from './shared.js';
import { icon } from './icons.js';
import { KEEP } from '../content/buildings.js';

const CSS = `
.cb.res.parts .ic{color:#9fd0ff}
.rigmods .opt .nm .cost + .cost{margin-left:6px}
.rigmods .opt .lv{font:600 12px/1 var(--mono);color:var(--muted);margin-left:6px;text-transform:none}
.rigmods .opt.have{border-color:rgba(31,91,255,.55)}
.rigmods .opt .bar{height:4px;border-radius:2px;background:rgba(239,231,214,.12);overflow:hidden}.rigmods .opt .bar i{display:block;height:100%;background:#4f86ff}
.cost.pt{color:#9fd0ff}
`;

export function createMechUi(ui) {
  { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  // parts beside scrap and food in the top bar
  const food = $('#rFood'), chip = document.createElement('span');
  chip.className = 'cb res parts'; chip.id = 'rParts'; chip.title = 'Parts';
  chip.innerHTML = `${icon('part')}<span class="rv"><b id="parts">0</b></span>`;
  if (food && food.parentNode) food.parentNode.insertBefore(chip, food.nextSibling);
  let shown = -1;
  function mechTick() { if (!ui.game || !ui.game.parts) return; const n = ui.game.parts(); if (n !== shown) { shown = n; const b = $('#parts'); if (b) b.textContent = n; } }

  const costHtml = c => `${c.scrap ? `<span class="cost">${icon('scrap')}${c.scrap}</span>` : ''}${c.parts ? `<span class="cost pt">${icon('part')}${c.parts}</span>` : ''}`;
  const btn = (id, data, name, cost, ds, disabled, cls = '') => `<button class="opt${cls}" id="${id}" ${data} ${disabled ? 'disabled' : ''}><span class="nm">${name}<span>${cost || ''}</span></span><span class="ds">${ds}</span></button>`;
  const fxLine = (id, fx) => !fx ? '' : id === 'bunks' ? `${fx.beds} beds` : id === 'roofTurret' ? `range ${fx.range} · ${fx.dmg} dmg every ${fx.rate} s` : id === 'workshop' ? `turret tier ${fx.turretTier}${fx.buildFaster ? ` · builds ${Math.round(fx.buildFaster * 100)}% faster` : ''}` : id === 'floodlights' ? `lit ${fx.cone} m · the dead slow to ${Math.round(fx.slow * 100)}% · turrets +${Math.round((fx.turretDmg - 1) * 100)}%` : id === 'radio' ? 'names the march at dusk' : id === 'plating' ? `+${Math.round(fx.hp * 100)}% Rig health` : '';

  /** the Rig panel's body (panels.js shows it when the Rig is tapped) */
  function rigPanel(opt) {
    const g = ui.game, S = g.state, k = S.keep, day = !S.over;
    $('#pEyebrow').textContent = 'Your home · Hilde'; $('#pTitle').textContent = 'The Haven Rig';
    const mods = g.rigModules(), beds = g.rigBeds(), gun = g.rigGun();
    let html = `<div class="stat"><span>Health <b>${Math.ceil(k.hp)} / ${k.maxHp}</b></span><span>${beds ? `Beds <b>${beds}</b> · ` : ''}${gun ? `Roof Turret <b>range ${gun.range}</b>` : 'No gun on the roof yet'}</span></div><div class="opts one rigmods">`;
    for (const m of mods) {
      const full = m.lv >= m.max, fitting = m.fitting !== null;
      const name = `${m.name}${m.max > 1 ? `<small class="lv">Lv ${m.lv}/${m.max}</small>` : m.lv ? '<small class="lv">fitted</small>' : ''}`;
      const ds = fitting ? `Fitting… <span class="bar"><i style="width:${Math.round(m.fitting * 100)}%"></i></span>` : full ? `<b class="good">${fxLine(m.id, m.fx)}</b>` : `${m.lv ? `Now: ${fxLine(m.id, m.fx)} · next: <b>${fxLine(m.id, m.next)}</b>` : m.line}${m.block && !/^Needs \d/.test(m.block) ? ` · <b class="bad">${m.block}</b>` : ''}`;
      html += btn(`opt-rig-${m.id}`, `data-rig="${m.id}"`, name, full || fitting ? '' : costHtml(m.cost), ds, full || fitting || !!m.block || !day, m.lv ? ' have' : '');
    }
    // the old camp level stays (homes and farms grow no higher than it)
    const l = k.level;
    if (l < 3) { const miss = g.keepNeeds(); html += opt('opt-keep', 'data-keep="1"', 'Raise the camp', KEEP.cost[l], miss.length ? `Still needed: ${miss.join(' · ')}` : `Homes and farms up to level ${l + 1}`, miss.length > 0 || S.gold < KEEP.cost[l] || !day); }
    ui.selected.range = gun ? gun.range + S.P.towerRange : null;
    return html + '</div>';
  }
  /** a turret's panel body (panels.js): its tier, what the next one needs */
  function turretPanel(b, opt) {
    const g = ui.game, S = g.state, day = !S.over, T = g.turretInfo(b.level), N = g.turretInfo(b.level + 1), st = g.towerStats(b);
    $('#pTitle').textContent = `${T.name} · tier ${b.level}`;
    let html = `<div class="stat"><span>Health <b>${Math.ceil(b.hp)} / ${b.maxHp}</b></span><span>${b.built < 1 ? `Going up <b>${Math.floor(b.built * 100)}%</b>` : `Range <b>${st.range.toFixed(1)}</b> · <b>${st.dmg.toFixed(1)}</b> dmg every ${st.rate.toFixed(2)} s${T.pierce ? ` · pierces ${T.pierce}` : ''}`}</span></div><div class="opts two">`;
    if (N) { const why = g.raiseBlock(b.id), c = { scrap: g.upCostOf(b), parts: N.cost.parts }; html += btn('opt-up', 'data-up="1"', `Upgrade: ${N.name}`, costHtml(c), `${N.line} · ${N.hp} hp${why ? ` · <b class="bad">${why}</b>` : ''}`, !!why || S.gold < c.scrap || !day); }
    html += opt('opt-demo', 'data-demo="1"', 'Pull down', null, `<b class="good">+${Math.floor(g.costOf(b.type) / 2)} scrap back</b> · frees a slot.`, !day);
    ui.selected.range = st.range;
    return html + '</div>' + (N ? '' : '<p class="note">The best turret Kai can make.</p>');
  }
  /** the turret card's extra line in the build tray: slots in use */
  function turretTray() { const s = ui.game.turretSlots(); return `<span class="tcrew${s.used >= s.max ? ' bad' : ''}">${s.used}/${s.max} slots</span>`; }
  const turretFull = () => { const s = ui.game.turretSlots(); return s.used >= s.max; };
  const rigSig = () => { const g = ui.game; return g && g.rigModules ? `${g.parts()}|${g.rigModules().map(m => `${m.lv}${m.fitting === null ? '' : Math.floor(m.fitting * 20)}${m.block ? 1 : 0}`).join('')}` : ''; };
  return { mechTick, rigPanel, turretPanel, turretTray, turretFull, rigSig };
}
