// The build tray and placing a building: the ghost, the zone overlay, palisade lines, snapping, confirm.
import { $, FLAGS, SHORT, campCopy, esc } from './shared.js';
import { BUILDINGS, BUILD_ORDER, TECH_ORDER } from '../content/buildings.js';
import { N, idx } from '../sim/mapgen.js';
import { icon } from './icons.js';

export function createPlacing(ui) {
  const { firstRun } = ui;

  // ---------- build tray and placement ----------
  const stockTotal = () => Object.values(ui.game.state.stock).reduce((a, b) => a + b, 0);
  const handsLeft = () => (typeof ui.game.handsFree === 'function' ? ui.game.handsFree() : Infinity);
  let trayKey = '';
  function renderTray() {
    const S = ui.game.state, tray = $('#tray');
    tray.hidden = !!ui.card;
    if (tray.hidden) { trayKey = ''; return; }
    const hands = handsLeft(), showForeman = (S.foreman || S.autopilot) && (FLAGS.foremanFirstRun || !firstRun());
    const sig = [S.gold, JSON.stringify(S.stock), ui.placing && ui.placing.type, S.builders, showForeman, S.feat.power, ui.game.keepLevel(), S.buildings.length, hands > 0, ui.folkSig ? ui.folkSig() : ''].join('|');   // [folk] the row's state if (sig === trayKey) return; trayKey = sig;
    const FOCUS = { defence: 'Defence', balanced: 'Balanced', growth: 'Growth', off: 'Off' };
    const bRow = showForeman ? `<div class="builders" role="group" aria-label="What your builders focus on"><span>Foreman</span>${Object.entries(FOCUS).map(([k, v]) => `<button data-focus="${k}" aria-pressed="${(S.builders || 'off') === k}">${v}</button>`).join('')}</div>` : '';
    tray.innerHTML = bRow + (ui.folkRow ? ui.folkRow() : '') /* [folk] Let them build */ + BUILD_ORDER.filter(t => t !== 'generator' || S.feat.power).map(t => {
      const n = S.stock[t] || 0, cost = n ? 0 : ui.game.buyCost(t), on = ui.placing && ui.placing.type === t;
      return `<button class="tb ${t}${on ? ' on' : ''}${n ? ' have' : ''}" data-tray="${t}" ${(!n && S.gold < cost) || hands < 1 ? 'aria-disabled="true"' : ''}><i></i><span class="tn">${SHORT[t]}</span>${n ? `<span class="tc">×${n}</span>` : `<span class="cost">${icon('scrap')}${cost}</span>`}</button>`;
    }).join('') + TECH_ORDER.map(t => {
      const have = S.buildings.some(b => b.type === t), locked = ui.game.keepLevel() < BUILDINGS[t].keep, cost = ui.game.buyCost(t), on = ui.placing && ui.placing.type === t;
      if (have || ui.game.keepLevel() < 2) return '';
      return `<button class="tb tech ${t}${on ? ' on' : ''}" data-tray="${t}" ${locked || S.gold < cost || hands < 1 ? 'aria-disabled="true"' : ''} title="${BUILDINGS[t].desc[0]}"><i></i><span class="tn">${SHORT[t]}</span>${locked ? '<span class="tc">Camp 2</span>' : `<span class="cost">${icon('scrap')}${cost}</span>`}</button>`;
    }).join('');
  }
  function setDrawer(open) { $('#tray').classList.toggle('open', open); $('#tray').hidden = !open || !!ui.card; $('#buildBtn').setAttribute('aria-expanded', open); if (open) { ui.closePanel(); trayKey = ''; renderTray(); } ui.dockH(); }
  $('#buildBtn').onclick = () => setDrawer(!$('#tray').classList.contains('open'));
  $('#tray').addEventListener('click', e => {
    const f = e.target.closest('[data-focus]'); if (f && ui.game) { ui.game.setBuilders(f.dataset.focus); trayKey = ''; renderTray(); ui.toast(f.dataset.focus === 'off' ? 'The Foreman stands down. You build by hand.' : `The Foreman builds by himself now: ${f.dataset.focus}.`); return; }
    if (e.target.closest('[data-folk]') && ui.game) { ui.folkToggle(); trayKey = ''; renderTray(); return; }   // [folk]
    const b = e.target.closest('[data-tray]'); if (!b || !ui.game || ui.paused) return;
    const t = b.dataset.tray;
    if (ui.placing && ui.placing.type === t) { stopPlacing(); return; }
    if (BUILDINGS[t].tech && ui.game.keepLevel() < BUILDINGS[t].keep) { ui.toast(`Raise the Camp to level ${BUILDINGS[t].keep} to build a ${SHORT[t]}.`, 'bad'); return; }
    if (!(ui.game.state.stock[t] > 0) && ui.game.state.gold < ui.game.buyCost(t)) { ui.toast(`A ${SHORT[t].toLowerCase()} costs ${ui.game.buyCost(t)} scrap.`, 'bad'); return; }
    if (handsLeft() < 1) { ui.toast('Everyone is busy today. More people, more hands.', 'bad'); return; }
    startPlacing(t);
  });
  const SIZE = { house: 2, farm: 2, tower: 1, wall: 1, workshop: 3, market: 3, generator: 2 };
  const cellOf = (x, y) => [Math.floor(x), Math.floor(y)];
  function computeZone(type) {
    const S = ui.game.state, n = SIZE[type], off = n % 2 ? 0.5 : 0, mask = new Uint8Array(N * N), spots = [];
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (!ui.game.zone()[idx(x, y)]) continue;
      const p = ui.game.canPlace(type, x + off, y + off, 0); if (!p.ok) continue;
      spots.push({ x: p.x, y: p.y, cells: p.cells }); for (const c of p.cells) mask[c] = 1;
    }
    return { mask, spots, ver: S.occVersion };
  }
  function tidy(sp) {
    const S = ui.game.state; let x0 = N, y0 = N, x1 = 0, y1 = 0;
    for (const c of sp.cells) { const x = c % N, y = (c / N) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    let n = 0;
    for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
      if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) continue;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const o = S.occ[idx(x, y)]; if (o >= 0 && S.byId.get(o) && S.byId.get(o).type !== 'wall') n++;
    }
    return Math.min(6, n);
  }
  function snap(x, y) {
    const z = ui.placing.zone; let best = null, bs = Infinity;
    for (const sp of z.spots) { const d = Math.hypot(sp.x - x, sp.y - y); if (d > 2.6) continue; const sc = d - 0.18 * tidy(sp); if (sc < bs) { bs = sc; best = sp; } }
    return best;
  }
  function refreshZone() { if (ui.placing) { ui.placing.zone = computeZone(ui.placing.type); ui.placing.zoneMask = ui.placing.zone.mask; } }
  function startPlacing(type) {
    setDrawer(false); ui.closePanel();
    const h = ui.game.state.hero;
    ui.placing = { type, x: h.x, y: h.y - 3, start: null };
    refreshZone();
    let best = null, bd = Infinity; for (const sp of ui.placing.zone.spots) { const d = Math.hypot(sp.x - h.x, sp.y - (h.y - 3)); if (d < bd) { bd = d; best = sp; } }
    if (best) { ui.placing.x = best.x; ui.placing.y = best.y; }
    if (!ui.placing.zone.spots.length) ui.toast(type === 'wall' ? 'No open ground left for barricades.' : `No room left for a ${SHORT[type].toLowerCase()}. Claim more land or pull something down.`, 'bad');
    updateGhost(); $('#place').hidden = false; renderTray(); ui.dockH();
  }
  function stopPlacing() { ui.placing = null; $('#place').hidden = true; renderTray(); ui.dockH(); }
  const wallAt = (x, y) => { const o = ui.game.state.byId.get(ui.game.state.occ[idx(x, y)]); return o && o.type === 'wall'; };
  function updateGhost() {
    if (!ui.placing) return;
    const S = ui.game.state, t = ui.placing.type;
    if (t === 'wall') return updateWallGhost();
    const sp = snap(ui.placing.x, ui.placing.y);
    const p = sp ? ui.game.canPlace(t, sp.x, sp.y, 0, { deep: true }) : ui.game.canPlace(t, ui.placing.x, ui.placing.y, 0, { deep: true });
    ui.placing.ghost = { type: t, x: p.x, y: p.y, rot: 0, ok: p.ok, cells: p.cells, lot: (p.lot || []).filter(i => !p.cells.includes(i)) };
    ui.placing.reason = p.reason;
    const n = S.stock[t] || 0;
    $('#placeInfo').innerHTML = p.ok ? `${BUILDINGS[t].name}${n ? ` · ${n} in hand` : ` · ${icon('scrap')} ${ui.game.buyCost(t)}`}` : `<span class="warn">${esc(campCopy(p.reason || 'No room here.'))}</span>`;
    $('#pOk').textContent = 'Place'; $('#pOk').disabled = !p.ok;
  }
  function updateWallGhost() {
    const S = ui.game.state, budget = ui.game.wallBudget();
    let [ex, ey] = cellOf(ui.placing.x, ui.placing.y);
    if (!ui.placing.start) {
      let best = null, bs = Infinity;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = ex + dx, y = ey + dy; if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1 || !ui.placing.zoneMask[idx(x, y)]) continue;
        const d = Math.hypot(x + 0.5 - ui.placing.x, y + 0.5 - ui.placing.y); if (d > 1.8) continue;
        const joins = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const o = S.byId.get(S.occ[idx(x + a, y + b)]); return o && (o.type === 'wall' || o.type === 'tower'); });
        const sc = d - (joins ? 0.9 : 0); if (sc < bs) { bs = sc; best = [x, y]; }
      }
      const c = best || [ex, ey], ok = !!best;
      ui.placing.cell = c;
      ui.placing.ghost = { type: 'wall', x: c[0] + 0.5, y: c[1] + 0.5, ok, cells: [idx(c[0], c[1])] };
      $('#placeInfo').innerHTML = ok ? `Barricade · ${ui.touchUI ? 'tap' : 'click'} where the line starts` : `<span class="warn">${esc(ui.game.canPlace('wall', ex + 0.5, ey + 0.5).reason || 'No room here.')}</span>`;
      $('#pOk').textContent = 'Start here'; $('#pOk').disabled = !ok;
      return;
    }
    const [sx, sy] = ui.placing.start, line = ui.game.lineCells(sx, sy, ex, ey);
    let n = 0; const okCells = [], cells = [];
    for (const [x, y] of line) {
      cells.push(idx(x, y));
      if (wallAt(x, y)) { okCells.push('skip'); continue; }
      const ok = ui.game.canPlace('wall', x + 0.5, y + 0.5).ok && n < budget; okCells.push(ok); if (ok) n++;
    }
    ui.placing.lineN = n; ui.placing.end = [ex, ey];
    ui.placing.ghost = { type: 'wall', x: ex + 0.5, y: ey + 0.5, ok: n > 0, cells, okCells };
    const inHand = Math.min(n, S.stock.wall || 0), paid = n - inHand;
    $('#placeInfo').innerHTML = n ? `${n} ${n === 1 ? 'post' : 'posts'}${inHand ? ` · ${inHand} in hand` : ''}${paid ? ` · ${icon('scrap')} ${paid * ui.game.buyCost('wall')}` : ''}` : `<span class="warn">${budget ? 'Nothing fits along this line.' : `Out of posts. One costs ${ui.game.buyCost('wall')} scrap.`}</span>`;
    $('#pOk').textContent = n ? `Lay ${n}` : 'Lay'; $('#pOk').disabled = !n;
  }
  function placeNow() {
    if (!ui.placing) return;
    const t = ui.placing.type, g = ui.placing.ghost, S = ui.game.state;
    if (t === 'wall') {
      if (!ui.placing.start) { if (g && g.ok) { ui.placing.start = ui.placing.cell; updateGhost(); } return; }
      const [sx, sy] = ui.placing.start, [ex, ey] = ui.placing.end || ui.placing.start;
      const n = ui.game.buildLine(sx + 0.5, sy + 0.5, ex + 0.5, ey + 0.5);
      if (n) { ui.toast(`${n} ${n === 1 ? 'post' : 'posts'} laid.`); ui.placing.start = null; refreshZone(); if (!ui.game.wallBudget()) stopPlacing(); else updateGhost(); }
      renderTray(); return;
    }
    if (!g || !g.ok) { ui.toast(ui.placing.reason || 'Cannot build there.', 'bad'); return; }
    if (ui.game.build(t, g.x, g.y, 0)) {
      if ((S.stock[t] || 0) > 0 || (S.mode === 'classic' && S.gold >= ui.game.buyCost(t))) { refreshZone(); updateGhost(); renderTray(); }
      else stopPlacing();
    }
  }
  $('#pOk').onclick = placeNow;
  $('#pCancel').onclick = () => { if (ui.placing && ui.placing.start) { ui.placing.start = null; updateGhost(); } else stopPlacing(); };
  return { renderTray, setDrawer, cellOf, refreshZone, startPlacing, stopPlacing, updateGhost, placeNow };
}
