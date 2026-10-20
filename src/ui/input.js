// Input: touch (tap to go, drag for the joystick, pinch to zoom), mouse (wheel zoom, click), keys (WASD, 1–6,
// M, Q, Esc). Picking goes through view.pick.
import { $, FLAGS, JOY_PX } from './shared.js';
import { BUILD_ORDER, TECH_ORDER } from '../content/buildings.js';

export function createInput(ui) {
  const { keys } = ui;

  // ---------- input ----------
  const canvas = $('#view'), joy = $('#joy'); let down = null; const touches = new Map(); let pinch0 = 0, zoom0 = 1;
  const joyIn = { x: 0, y: 0 };   // (ui.touchUI: the last pointer was a finger)
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (ui.view) ui.view.setZoom(ui.view.getZoom() * (1 + e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && ui.view) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = ui.view.getZoom(); endJoy(); down = null; return; }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', joy: false, drag: false }; canvas.focus({ preventScroll: true });
    ui.touchUI = down.touch;
    if (ui.placing && ui.placing.type === 'wall' && !down.touch && !ui.placing.start && ui.view && !ui.paused) {
      const g = ui.view.groundAt(e.clientX, e.clientY); if (g) { ui.placing.x = g.x; ui.placing.y = g.y; ui.updateGhost(); if (ui.placing.ghost.ok) { ui.placing.start = ui.placing.cell; down.wallStart = true; ui.updateGhost(); } }
    }
  });
  function endJoy() { joyIn.x = joyIn.y = 0; joy.hidden = true; }
  canvas.addEventListener('pointercancel', e => { touches.delete(e.pointerId); if (down && down.id === e.pointerId) { down = null; endJoy(); } });
  canvas.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2 && pinch0 && ui.view) { const [a, b] = [...touches.values()]; ui.view.setZoom(zoom0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))); return; } }
    if (!ui.game || !ui.view || ui.paused) return;
    if (ui.placing && (e.pointerType === 'mouse' || (down && down.id === e.pointerId))) {
      const g = ui.view.groundAt(e.clientX, e.clientY); if (g) { const ox = ui.placing.x, oy = ui.placing.y; ui.placing.x = g.x; ui.placing.y = g.y; if (Math.floor(ox) !== Math.floor(g.x) || Math.floor(oy) !== Math.floor(g.y)) ui.updateGhost(); }
      if (down) down.drag = true;
      return;
    }
    if (down && down.id === e.pointerId && down.touch) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y, d = Math.hypot(dx, dy);
      if (!down.joy && d > JOY_PX) { down.joy = true; joy.hidden = false; joy.style.transform = `translate(${down.x}px, ${down.y}px)`; ui.game.state.hero.target = null; if (ui.roadUI) ui.roadUI.closeTrip(); }
      if (down.joy) { const k = Math.min(1, d / 60), nx = dx / (d || 1), ny = dy / (d || 1); joyIn.x = nx * k; joyIn.y = ny * k; joy.firstChild.style.transform = `translate(${nx * Math.min(d, 40)}px, ${ny * Math.min(d, 40)}px)`; }
    }
    if (e.pointerType === 'mouse') { const p = ui.view.pick(e.clientX, e.clientY); canvas.style.cursor = p && p.type !== 'ground' ? 'pointer' : ''; }
  });
  const goTo = (x, y) => { ui.game.heroTo(x, y); ui.view.showMove(x, y); };
  canvas.addEventListener('pointerup', e => {
    const wasPinch = touches.size >= 2; touches.delete(e.pointerId); if (touches.size < 2) pinch0 = 0;
    const d = down; if (d && d.id === e.pointerId) down = null;
    if (d && d.joy) { endJoy(); return; }
    if (!d || wasPinch || ui.paused || !ui.game) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? JOY_PX : 8) && !ui.placing) return;
    if (ui.placing) {
      const g = ui.view.groundAt(e.clientX, e.clientY); if (g) { ui.placing.x = g.x; ui.placing.y = g.y; ui.updateGhost(); }
      if (ui.placing.type === 'wall') {
        if (d.touch) { if (!ui.placing.start) ui.placeNow(); return; }
        if (d.wallStart) { const [ex, ey] = ui.cellOf(ui.placing.x, ui.placing.y); if (ex !== ui.placing.start[0] || ey !== ui.placing.start[1]) ui.placeNow(); return; }
        ui.placeNow(); return;
      }
      if (!d.touch) ui.placeNow();
      return;
    }
    const p = ui.view.pick(e.clientX, e.clientY); if (!p) return;
    const S = ui.game.state;
    // [road] taps on road stations are handled by road-ui before falling through to here
    if (p.type === 'landmark') { const l = S.landmarks[p.id]; if (!l.owned) goTo(l.x, l.y + l.size / 2 + 1); ui.openSel({ type: 'landmark', id: p.id }); return; }
    if (p.type === 'rubble') { goTo(p.x, p.y); ui.openSel({ type: 'rubble', x: p.x, y: p.y }); return; }
    if (p.type === 'building' || p.type === 'keep') { ui.openSel(p.type === 'building' ? { type: 'building', id: p.id } : { type: 'keep' }); return; }
    if (p.type === 'region' && S.sealed[p.id]) { ui.openSel({ type: 'region', id: p.id }); return; }
    if (p.type === 'region' && ui.game.map.regions[p.id].nest && ui.game.regionInfo(p.id).nest) {
      const n = ui.game.map.regions[p.id].nest;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 4 || !(ui.selected && ui.selected.type === 'region')) { ui.openSel({ type: 'region', id: p.id }); return; }
    }
    if (p.type === 'ground' && ui.folkTap && ui.folkTap(p)) return;   // [folk] a tap on the folk's scaffold
    goTo(p.x, p.y); if (ui.selected) ui.closePanel();
  });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (ui.placing && ui.placing.start) { ui.placing.start = null; ui.updateGhost(); } else if (ui.placing) ui.stopPlacing(); else ui.closePanel(); }
    if (e.target.closest && e.target.closest('button,input') && (k === ' ' || k === 'enter')) return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = true; e.preventDefault(); if (ui.roadUI) ui.roadUI.closeTrip(); }
    if (!ui.game) return;
    if (k === 'l' && FLAGS.runLog) ui.showLog();
    if (k === 'm' && !ui.card) ui.showMap();
    if (k === 'q' || k === ' ') { e.preventDefault(); ui.useAbility(); }
    if (k === 'enter' && ui.placing) ui.placeNow();
    if (['1', '2', '3', '4', '5', '6'].includes(k) && !ui.paused) { const t = [...BUILD_ORDER, ...TECH_ORDER][+k - 1]; if (ui.placing && ui.placing.type === t) ui.stopPlacing(); else ui.startPlacing(t); }
    if ((k === '=' || k === '+') && ui.view) ui.view.setZoom(ui.view.getZoom() * 0.8);
    if ((k === '-' || k === '_') && ui.view) ui.view.setZoom(ui.view.getZoom() * 1.25);
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; endJoy(); });
  return { joyIn, endJoy };
}
