// [roam] A tidy HUD (Gabriel, Nov 2: "make things appear just when we need them"). Each frame it shows only what matters
// now: the area chip for a few seconds after you enter an area; chips once you have any; what's banked only near a bank;
// BOOK once there's a recipe to read; the walker's arrow only when the step is the boss (or there's no chapter); the
// clean count only without a chapter; the test controls (speed, LOOK, fps, the ability placeholders) only with ?dev=1.
// Then the mission's own aids: an amber arrow at the screen's edge with the distance to where the step wants you, a
// pulsing ring and label on the spot once it's on screen, and a red ▼ over each machine the step needs killed.
// UI only: reads the state, toggles elements, draws on the overlay.
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
    for (const d of S.dead) { if (!d.mission || (m && d.mission !== m.id)) continue; const [x, y] = toS(d.x, d.y); if (x < -20 || y < -20 || x > cssW + 20 || y > cssH + 20) continue; const b = Math.sin(t * 6) * 2.5, yy = y - 26 + b;
      fx.fillStyle = '#ff3a2a'; fx.strokeStyle = 'rgba(8,8,10,.85)'; fx.lineWidth = 3; fx.beginPath(); fx.moveTo(x - 7, yy - 6); fx.lineTo(x + 7, yy - 6); fx.lineTo(x, yy + 4); fx.closePath(); fx.stroke(); fx.fill(); }
    if (!m || !m.at) return; const [sx, sy] = toS(m.at.x, m.at.y), k = S.kai, dist = Math.round(Math.hypot(m.at.x - k.x, m.at.y - k.y));
    if (sx > 30 && sy > 70 && sx < cssW - 30 && sy < cssH - 260) { const r = 16 + 6 * Math.sin(t * 3);
      fx.strokeStyle = 'rgba(255,195,90,.9)'; fx.lineWidth = 3; fx.beginPath(); fx.arc(sx, sy, r, 0, 6.283); fx.stroke();
      fx.font = '700 11px "IBM Plex Mono", ui-monospace, monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.lineWidth = 3; fx.strokeStyle = 'rgba(8,8,10,.85)'; fx.fillStyle = '#ffd36a';
      const lab = dist > 12 ? `${m.at.label} ${dist}m` : m.at.label; fx.strokeText(lab, sx, sy - r - 12); fx.fillText(lab, sx, sy - r - 12); }
    else edgeArrow(m.at.x, m.at.y, '#ffc35a', `${m.at.label} ${dist}m`);
  }
  return { update, draw, walkerOk };
}
