// [roam] The world map (M4): every area drawn from the town's own district shapes, the streets as fine lines, each area's
// name in the colour of how hard it is for Kai now (grey: clean; green: at or under her level; yellow: one or two above;
// red: three or more), its walker as a pair of red eyes where it walks, live nests, and Kai's amber @. Her level is the
// number of areas she has cleaned plus one until levels arrive (M7). The game pauses while it's open. Writes nothing.
export function createMapUi({ sim, town, ui }) {
  const $ = id => document.getElementById(id), S = sim.state, W = town.W, panel = $('map'), cv = $('mapC'), X = cv.getContext('2d'); let whole = false;
  const kaiLevel = () => 1 + S.areas.filter(a => a.root === undefined && a.state === 'clean').length;
  const colourOf = a => { if (a.state === 'clean') return '#8a857c'; const d = a.level - kaiLevel(); return d <= 0 ? '#7fd06a' : d <= 2 ? '#ffd23a' : '#ff5a3a'; };
  const polysOf = new Map(); for (const d of W.districts || []) if (d.poly) polysOf.set(d.id, d.poly);
  function draw() {
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; X.setTransform(dpr, 0, 0, dpr, 0, 0); X.clearRect(0, 0, w, h);
    // what to show: the town (around the old town's areas) or the whole world
    const roots = S.areas.filter(a => a.root === undefined), members = a => S.areas.filter(b => b === a || b.root === a.i);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    if (whole) { grow(0, 0); grow(town.size.w, town.size.h); } else for (const a of S.areas) { if (Math.hypot(a.x - S.kai.x, a.y - S.kai.y) > 520) continue; for (const p of polysOf.get(a.id) || []) grow(p.x, p.y); }
    grow(S.kai.x - 40, S.kai.y - 40); grow(S.kai.x + 40, S.kai.y + 40);
    const sc = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.94, ox = (w - (x1 - x0) * sc) / 2 - x0 * sc, oy = (h - (y1 - y0) * sc) / 2 - y0 * sc, P = (x, y) => [ox + x * sc, oy + y * sc];
    // areas: a tinted fill by difficulty, an outline
    for (const a of roots) { const col = colourOf(a); for (const m of members(a)) { const poly = polysOf.get(m.id); if (!poly) continue; X.beginPath(); poly.forEach((p, i) => { const [x, y] = P(p.x, p.y); i ? X.lineTo(x, y) : X.moveTo(x, y); }); X.closePath();
      X.globalAlpha = a.state === 'clean' ? 0.08 : 0.14; X.fillStyle = col; X.fill(); X.globalAlpha = 0.5; X.strokeStyle = col; X.lineWidth = 1; X.stroke(); } }
    X.globalAlpha = 1;
    // streets
    X.strokeStyle = 'rgba(233,226,207,.22)'; X.lineWidth = 1; X.beginPath(); for (const st of W.streets || []) { (st.pts || []).forEach((p, i) => { const [x, y] = P(p.x, p.y); i ? X.lineTo(x, y) : X.moveTo(x, y); }); } X.stroke();
    // nests, walkers, Kai
    for (const n of S.nests) if (n.alive) { const [x, y] = P(n.x, n.y); X.fillStyle = '#ff5a3a'; X.font = '700 11px "IBM Plex Mono", monospace'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('♥', x, y); }
    for (const d of S.dead) if (d.boss) { const [x, y] = P(d.x, d.y); for (const o of [-3, 3]) { X.globalAlpha = 0.35; X.fillStyle = '#ff3a2a'; X.beginPath(); X.arc(x + o, y, 6, 0, 6.283); X.fill(); X.globalAlpha = 1; X.beginPath(); X.arc(x + o, y, 2.2, 0, 6.283); X.fill(); } }
    { const [x, y] = P(S.kai.x, S.kai.y); X.strokeStyle = '#f0b44c'; X.lineWidth = 2; X.beginPath(); X.arc(x, y, 9, 0, 6.283); X.stroke(); X.fillStyle = '#ffd36a'; X.font = '700 12px "IBM Plex Mono", monospace'; X.fillText('@', x, y + 0.5); }
    // names last, on dark plates, in the difficulty colour, with level and state
    X.font = '700 11px "IBM Plex Mono", monospace';
    // (a label that would overlap one already placed steps down until it's clear)
    const placed = [];
    for (const a of roots) { let [x, y] = P(a.x, a.y); const label = `${a.name.toUpperCase()} · LV ${a.level}${a.state === 'clean' ? ' · CLEAN' : ''}`, tw = X.measureText(label).width + 10;
      for (let k = 0; k < 12 && placed.some(q => Math.abs(q.x - x) < (q.w + tw) / 2 && Math.abs(q.y - y) < 19); k++) y += 20; placed.push({ x, y, w: tw });
      X.fillStyle = 'rgba(8,9,11,.85)'; X.fillRect(x - tw / 2, y - 9, tw, 18); X.fillStyle = colourOf(a); X.fillText(label, x, y + 0.5); }
  }
  $('mapBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); panel.hidden = false; ui.paused = true; requestAnimationFrame(draw); });
  $('mapDone').addEventListener('click', () => { panel.hidden = true; ui.paused = false; });
  $('mapZoom').addEventListener('click', () => { whole = !whole; $('mapZoom').textContent = whole ? 'ALL' : 'TOWN'; draw(); });
  return { draw };
}
