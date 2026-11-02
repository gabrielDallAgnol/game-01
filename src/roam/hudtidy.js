// [roam] A tidy HUD (Gabriel, Nov 2: "make things appear just when we need them"). Each frame it shows only what matters
// now: the area chip for a few seconds after you enter an area; chips once you have any; what's banked only near a bank;
// BOOK once there's a recipe to read; the walker's arrow only when the step is the boss (or there's no chapter); the
// clean count only without a chapter; the test controls (speed, LOOK, fps, the ability placeholders) only with ?dev=1.
// Then the mission's own aids: an amber arrow at the screen's edge with the distance to where the step wants you, a
// pulsing ring and label on the spot once it's on screen, and a red ▼ over each machine the step needs killed.
// UI only: reads the state, toggles elements, draws on the overlay.
const ICON = { KAI: '⌂', HOME: '⌂', GARAGE: '⌂', TOMAS: '☺', MILA: '☺', REYES: '☺', INES: '☺', HOLD: '◎', SCRUBBER: '✱', COIL: '◉', VAN: '✚', TOY: '▣', BARN: '⌂', WRECK: '⚙', 'BIG ONE': '☗', BRIDGE: '≡' };
export function createHudTidy({ sim, fx }) {
  const S = sim.state, $ = id => document.getElementById(id), dev = /[?&]dev=1/.test(location.search), chapter = !!S.mission;
  let lastArea = -2, areaT = 0;
  const vis = (el, on) => { if (el && el.hidden === !!on) el.hidden = !on; };
  const span = id => $(id) && $(id).parentElement;
  for (const id of ['speed', 'fps']) vis($(id), dev); for (const id of ['ab1', 'ab2', 'form']) vis($(id), dev);
  function update(dt) {
    if (S.inArea !== lastArea) { lastArea = S.inArea; areaT = 4; } areaT -= dt; const area = $('area'); if (area && S.inArea >= 0) area.style.opacity = areaT > 0 ? '1' : '0';
    if (area) area.style.transition = 'opacity .6s';
    vis($('nests'), !chapter || dev); vis($('lookChip'), dev);
    vis(span('chips'), S.chips + S.bank.chips > 0);
    const nearBank = (S.sites || []).some(q => Math.hypot(q.x - S.kai.x, q.y - S.kai.y) < 30); vis(span('bank'), nearBank && (S.bank.scrap + S.bank.chips > 0));
    vis($('bagBtn'), (S.known || []).length > 5 || (S.carry || []).length > 0);
  }
  const walkerOk = () => !chapter || (S.mission && S.mission.id === 'free');
  // the mission's aids on the overlay (after the world, before the HUD's own arrows)
  function draw(toS, cssW, cssH, t, edgeArrow) {
    const m = S.mission;
    const act = new Set(((S.quests && S.quests.active) || []).map(q => q.id));
    for (const d of S.dead) { if (!d.mission || !act.has(d.mission)) continue; const [x, y] = toS(d.x, d.y); if (x < -20 || y < -20 || x > cssW + 20 || y > cssH + 20) continue; const b = Math.sin(t * 6) * 2.5, yy = y - 26 + b;
      fx.fillStyle = '#ff3a2a'; fx.strokeStyle = 'rgba(8,8,10,.85)'; fx.lineWidth = 3; fx.beginPath(); fx.moveTo(x - 7, yy - 6); fx.lineTo(x + 7, yy - 6); fx.lineTo(x, yy + 4); fx.closePath(); fx.stroke(); fx.fill(); }
    if (!m || !m.at) return; const [sx, sy] = toS(m.at.x, m.at.y), k = S.kai, [kx, ky] = toS(k.x, k.y), dist = Math.round(Math.hypot(m.at.x - k.x, m.at.y - k.y)), icon = ICON[m.at.label] || '●';
    const AMB = '#ffc35a', top = 172, bottom = cssH - 210, left = 26, right = cssW - 26, onScreen = sx > left && sx < right && sy > top && sy < bottom;
    fx.save(); fx.textAlign = 'center'; fx.textBaseline = 'middle';
    // by the robot: a small chevron on a ring round it, pointing the way (only while the place is far or off screen)
    if (!onScreen || dist > 30) { const a = Math.atan2(sy - ky, sx - kx), R = 38, cx = kx + Math.cos(a) * R, cy = ky + Math.sin(a) * R;
      fx.save(); fx.translate(cx, cy); fx.rotate(a); fx.fillStyle = AMB; fx.strokeStyle = 'rgba(8,8,10,.8)'; fx.lineWidth = 2.5; fx.beginPath(); fx.moveTo(9, 0); fx.lineTo(-5, -7); fx.lineTo(-2, 0); fx.lineTo(-5, 7); fx.closePath(); fx.stroke(); fx.fill(); fx.restore(); }
    if (onScreen) {   // the place itself: a column of light standing on it, a ring at its foot, its name and distance above
      const g = fx.createLinearGradient(sx, sy - 90, sx, sy); g.addColorStop(0, 'rgba(255,195,90,0)'); g.addColorStop(1, 'rgba(255,195,90,.55)'); fx.fillStyle = g; fx.fillRect(sx - 5, sy - 90, 10, 90);
      const r = 14 + 4 * Math.sin(t * 3); fx.strokeStyle = 'rgba(255,195,90,.95)'; fx.lineWidth = 3; fx.beginPath(); fx.ellipse(sx, sy, r * 1.3, r * 0.75, 0, 0, 6.283); fx.stroke();
      badge(sx, sy - 112, icon, dist > 12 ? `${m.at.label} · ${dist}m` : m.at.label, null); }
    else {   // off screen: a round badge at the edge, its pointer toward the place, the name and distance under it
      const cx = cssW / 2, cy = (top + bottom) / 2, a = Math.atan2(sy - cy, sx - cx), hw = (right - left) / 2 - 22, hh = (bottom - top) / 2 - 22, q = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
      badge(cx + Math.cos(a) * q, cy + Math.sin(a) * q, icon, `${m.at.label} · ${dist}m`, a); }
    fx.restore();
    function badge(x, y, ic, label, a) { const s2 = 1 + 0.06 * Math.sin(t * 4); fx.save(); fx.translate(x, y); fx.scale(s2, s2);
      if (a !== null) { fx.rotate(a); fx.fillStyle = AMB; fx.beginPath(); fx.moveTo(30, 0); fx.lineTo(16, -9); fx.lineTo(16, 9); fx.closePath(); fx.fill(); fx.rotate(-a); }
      fx.fillStyle = 'rgba(14,12,8,.92)'; fx.strokeStyle = AMB; fx.lineWidth = 3; fx.beginPath(); fx.arc(0, 0, 18, 0, 6.283); fx.fill(); fx.stroke();
      fx.fillStyle = AMB; fx.font = '700 17px ui-monospace,monospace'; fx.fillText(ic, 0, 1); fx.restore();
      fx.font = '700 11px ui-monospace,monospace'; const w = fx.measureText(label).width + 12; fx.fillStyle = 'rgba(8,9,11,.88)'; fx.fillRect(x - w / 2, y + 23, w, 17); fx.fillStyle = '#ffe2a6'; fx.fillText(label, x, y + 32); }
  }
  return { update, draw, walkerOk };
}
