// [roam] The world map (M4), World of Warcraft style: a painted map of the real world, coloured from the world's own
// record (the charmap: grass, fields, woods, water, roads, yards, roofs), with each area's border and name in the colour of
// how hard it is for Kai now (grey: clean; green: at or under her level; yellow: one or two above; red: three or more).
// It opens on the area she's in; WORLD shows everything; tap an area to open it; drag to pan, pinch (or wheel) to zoom.
// Walkers are pairs of red eyes, Kai an amber @ with her heading. Her level is the areas cleaned + 1 until M7.
// The game pauses while it's open. Reads the sim and the town; writes nothing.
export function createMapUi({ sim, town, ui }) {
  const $ = id => document.getElementById(id), S = sim.state, W = town.W, CH = town.chars, panel = $('map'), cv = $('mapC'), X = cv.getContext('2d'), title = $('mapTitle'), zoomBtn = $('mapZoom');
  const kaiLevel = () => 1 + S.areas.filter(a => a.root === undefined && a.state === 'clean').length;
  const colourOf = a => { if (a.state === 'clean') return '#a8a294'; const d = a.level - kaiLevel(); return d <= 0 ? '#86d870' : d <= 2 ? '#ffd23a' : '#ff5a3a'; };
  const polysOf = new Map(); for (const d of W.districts || []) if (d.poly) polysOf.set(d.id, d.poly);
  const roots = () => S.areas.filter(a => a.root === undefined), members = a => S.areas.filter(b => b === a || b.root === a.i);
  // the painted base: one pixel per 2 m cell, coloured like the land it is (muted, a little warm: a map, not a photo)
  const PAL = { '"': [72, 94, 62], T: [44, 66, 44], f: [52, 72, 50], t: [118, 100, 74], w: [168, 148, 92], b: [156, 142, 96], r: [178, 168, 86], '%': [104, 84, 62], s: [142, 128, 92], ',': [86, 108, 70], m: [96, 116, 78],
    '~': [64, 98, 124], L: [78, 78, 80], ':': [112, 106, 96], '=': [52, 53, 58], '.': [118, 114, 106], '+': [82, 70, 62], '#': [150, 138, 120], '^': [116, 108, 92] };
  let base = null;
  function paintBase() { const c = document.createElement('canvas'); c.width = CH.w; c.height = CH.h; const g = c.getContext('2d'), img = g.createImageData(CH.w, CH.h), D = img.data;
    for (let k = 0; k < CH.w * CH.h; k++) { const ch = String.fromCharCode(CH.codes[k]), p = PAL[ch] || PAL['"'], n = ((k * 2654435761) >>> 24) / 255 * 10 - 5;
      D[k * 4] = p[0] + n; D[k * 4 + 1] = p[1] + n; D[k * 4 + 2] = p[2] + n; D[k * 4 + 3] = 255; }
    // a roof's edge darker, so houses read as shapes
    for (let j = 1; j < CH.h - 1; j++) for (let i = 1; i < CH.w - 1; i++) { const k = j * CH.w + i; if (CH.codes[k] !== 35) continue; if (CH.codes[k - 1] !== 35 || CH.codes[k + CH.w] !== 35) { D[k * 4] *= 0.62; D[k * 4 + 1] *= 0.62; D[k * 4 + 2] *= 0.62; } }
    g.putImageData(img, 0, 0); base = c; }
  // the view: the world point at the centre and pixels per metre; eased toward a target
  const view = { x: 0, y: 0, s: 1 }, aim = { x: 0, y: 0, s: 1 }; let focus = null, raf = 0;
  const bounds = list => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const a of list) for (const m of members(a)) for (const p of polysOf.get(m.id) || []) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); } return [x0, y0, x1, y1]; };
  function frame(list, pad = 1.15) { const [x0, y0, x1, y1] = list === 'world' ? [0, 0, town.size.w, town.size.h] : bounds(list), w = cv.clientWidth, h = cv.clientHeight;
    aim.x = (x0 + x1) / 2; aim.y = (y0 + y1) / 2; aim.s = Math.min(w / ((x1 - x0) * pad), h / ((y1 - y0) * pad)); }
  function openArea(a) { focus = a; frame(a ? [a] : 'world', a ? 1.25 : 1.02); title.textContent = a ? a.name.replace(/^the /, '').toUpperCase() : 'WORLD'; zoomBtn.textContent = a ? 'WORLD' : 'HERE'; kick(); }
  const toS = (x, y) => [cv.clientWidth / 2 + (x - view.x) * view.s, cv.clientHeight / 2 + (y - view.y) * view.s], toW = (sx, sy) => [view.x + (sx - cv.clientWidth / 2) / view.s, view.y + (sy - cv.clientHeight / 2) / view.s];
  function inside(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
  const areaUnder = (x, y) => { for (const a of roots()) for (const m of members(a)) { const P = polysOf.get(m.id); if (P && inside(x, y, P)) return a; } return null; };
  function draw() {
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    X.setTransform(dpr, 0, 0, dpr, 0, 0); X.fillStyle = '#0b0d10'; X.fillRect(0, 0, w, h);
    // the land
    X.imageSmoothingEnabled = view.s < 2.5; const [ox, oy] = toS(0, 0); X.drawImage(base, ox, oy, CH.w * CH.cell * view.s, CH.h * CH.cell * view.s);
    // outside the open area the land dims (WoW's zone map), and every area gets its border in its colour
    const path = a => { X.beginPath(); for (const m of members(a)) { const P = polysOf.get(m.id); if (!P) continue; P.forEach((p, i) => { const [x, y] = toS(p.x, p.y); i ? X.lineTo(x, y) : X.moveTo(x, y); }); X.closePath(); } };
    if (focus) { X.save(); X.fillStyle = 'rgba(6,7,9,.55)'; X.beginPath(); X.rect(0, 0, w, h); path(focus); X.fill('evenodd'); X.restore(); }
    for (const a of roots()) { const col = colourOf(a); path(a); X.globalAlpha = a === focus ? 0.06 : 0.12; X.fillStyle = col; X.fill(); X.globalAlpha = 0.9; X.strokeStyle = 'rgba(8,8,10,.8)'; X.lineWidth = 4; X.stroke(); X.strokeStyle = col; X.lineWidth = 1.6; X.setLineDash(a.state === 'clean' ? [] : [6, 4]); X.stroke(); X.setLineDash([]); }
    X.globalAlpha = 1;
    // walkers, Kai
    const eyes = (x, y, r) => { for (const o of [-r * 0.9, r * 0.9]) { X.globalAlpha = 0.4; X.fillStyle = '#ff3a2a'; X.beginPath(); X.arc(x + o, y, r * 2.2, 0, 6.283); X.fill(); X.globalAlpha = 1; X.beginPath(); X.arc(x + o, y, r, 0, 6.283); X.fill(); } };
    for (const d of S.dead) if (d.boss) { const [x, y] = toS(d.x, d.y); eyes(x, y, Math.max(2.4, Math.min(5, view.s * 1.2))); }
    { const [x, y] = toS(S.kai.x, S.kai.y), a = S.kai.face || 0; X.strokeStyle = 'rgba(8,8,10,.8)'; X.lineWidth = 5; X.beginPath(); X.arc(x, y, 10, 0, 6.283); X.stroke(); X.strokeStyle = '#f0b44c'; X.lineWidth = 2.2; X.beginPath(); X.arc(x, y, 10, 0, 6.283); X.stroke();
      X.beginPath(); X.moveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); X.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17); X.stroke(); X.fillStyle = '#ffd36a'; X.font = '700 12px "IBM Plex Mono", monospace'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('@', x, y + 0.5); }
    // names: each area big in its colour; when an area is open, its quarters small inside it; labels step aside of each other
    const placed = [], label = (x, y, text, col, px) => { X.font = `700 ${px}px "IBM Plex Mono", monospace`; const tw = X.measureText(text).width + 10, th = px + 8;
      for (let k = 0; k < 10 && placed.some(q => Math.abs(q.x - x) < (q.w + tw) / 2 && Math.abs(q.y - y) < (q.h + th) / 2); k++) y += th; placed.push({ x, y, w: tw, h: th });
      X.fillStyle = 'rgba(8,9,11,.82)'; X.fillRect(x - tw / 2, y - th / 2, tw, th); X.fillStyle = col; X.fillText(text, x, y + 0.5); };
    for (const a of roots()) { const [x, y] = toS(a.x, a.y); if (x < -200 || y < -50 || x > w + 200 || y > h + 50) continue; label(x, y, `${a.name.toUpperCase()} · LV ${a.level}${a.state === 'clean' ? ' · CLEAN' : ''}`, colourOf(a), a === focus ? 14 : 11); }
    if (focus) for (const m of members(focus)) if (m !== focus) { const [x, y] = toS(m.x, m.y); label(x, y, m.name, 'rgba(233,226,207,.75)', 10); }
  }
  function tick() { raf = 0; const k = 0.22; view.x += (aim.x - view.x) * k; view.y += (aim.y - view.y) * k; view.s *= Math.pow(aim.s / view.s, k); draw();
    if (Math.abs(aim.x - view.x) > 0.3 || Math.abs(aim.y - view.y) > 0.3 || Math.abs(aim.s / view.s - 1) > 0.002) kick(); }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  // gestures: one finger drags, two pinch, a tap opens the area under it; the wheel zooms
  const pts = new Map(); let moved = 0, pinch0 = 0, s0 = 1;
  cv.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); s0 = aim.s; } });
  cv.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 1) { aim.x -= dx / aim.s; aim.y -= dy / aim.s; view.x = aim.x; view.y = aim.y; } else if (pts.size === 2) { const [a, b] = [...pts.values()]; aim.s = Math.max(0.15, Math.min(12, s0 * Math.hypot(a.x - b.x, a.y - b.y) / (pinch0 || 1))); view.s = aim.s; } kick(); });
  const up = e => { const was = pts.size; pts.delete(e.pointerId); if (was === 1 && moved < 8) { const r = cv.getBoundingClientRect(), [x, y] = toW(e.clientX - r.left, e.clientY - r.top), a = areaUnder(x, y); if (a) openArea(a); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  cv.addEventListener('wheel', e => { e.preventDefault(); aim.s = Math.max(0.15, Math.min(12, aim.s * Math.exp(-e.deltaY * 0.0015))); kick(); }, { passive: false });
  // open, close (pointerdown, like every button in the game: a click can be eaten by the game's own touch handling)
  const tap = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  // closing must never fail: any kind of tap on any of the close controls does it (touch, pointer or click)
  const closer = el => { for (const t of ['pointerdown', 'pointerup', 'touchend', 'click']) el.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); close(); }, { passive: false }); };
  function open() { if (!base) paintBase(); panel.hidden = false; ui.paused = true; const here = S.inArea >= 0 ? S.areas[S.inArea] : null; openArea(here); Object.assign(view, aim); draw(); }
  function close() { panel.hidden = true; ui.paused = false; }
  tap($('mapBtn'), open); closer($('mapDone')); closer($('mapX')); closer(title); tap(zoomBtn, () => { if (focus) openArea(null); else openArea(S.inArea >= 0 ? S.areas[S.inArea] : null); });
  addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') { panel.hidden ? open() : close(); } else if (e.key === 'Escape' && !panel.hidden) close(); });
  return { open, close };
}
