// Maps: the world painted one pixel per cell (fog of war from S.seen), the minimap that follows the hero, and the
// big map card (tap a place to plan a trip: road-ui.js).
import { $, esc } from './shared.js';
import { N, T, idx } from '../sim/mapgen.js';
import { icon } from './icons.js';

export function createMap(ui) {
  const {  } = ui;

  // ---------- maps: one pixel per cell, cropped to the land ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const MAPCOL = { meadow: hex('#5f7a45'), wood: hex('#2f4a2a'), street: hex('#77736b'), block: hex('#45423e'), park: hex('#3f5634'), water: hex('#2f5a6e'), ford: hex('#8d887d'), dirt: hex('#8a6a48'), road: hex('#c2a46e'), cliff: hex('#8a8378'), site: hex('#e0b050'), voidc: [11, 13, 14] };
  function mapBox(m) { let x0 = N, y0 = N, x1 = 0, y1 = 0; for (let i = 0; i < N * N; i++) if (m.terrain[i] !== T.VOID) { const x = i % N, y = (i / N) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0: Math.max(0, x0 - 3), y0: Math.max(0, y0 - 3), x1: Math.min(N - 1, x1 + 3), y1: Math.min(N - 1, y1 + 3) }; }
  function paintWorld(cv, m, seen) {
    cv.width = cv.height = N; const ctx = cv.getContext('2d'), im = ctx.createImageData(N, N), d = im.data;
    for (let i = 0; i < N * N; i++) {
      const t = m.terrain[i], wild = m.wild && m.wild[i];
      let c = t === T.VOID ? MAPCOL.voidc : m.lm[i] >= 0 ? MAPCOL.site : m.road[i] && wild ? MAPCOL.road : t === T.WATER ? MAPCOL.water : t === T.FORD ? MAPCOL.ford : t === T.CLIFF ? MAPCOL.cliff : t === T.DIRT ? MAPCOL.dirt
        : wild ? (t === T.FOREST ? MAPCOL.wood : MAPCOL.meadow) : t === T.ROCK ? MAPCOL.block : t === T.FOREST ? MAPCOL.park : MAPCOL.street;
      let k = 1;
      if (seen && !seen[i] && t !== T.VOID) k = m.road[i] && wild ? 0.55 : wild ? 0.28 : 0.42;
      d[i * 4] = c[0] * k; d[i * 4 + 1] = c[1] * k; d[i * 4 + 2] = c[2] * k; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0); return cv;
  }
  function drawMinimap(canvas, m) {
    const b = mapBox(m), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, src = paintWorld(document.createElement('canvas'), m, null), s = 2;
    canvas.width = w * s; canvas.height = h * s; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, b.x0, b.y0, w, h, 0, 0, w * s, h * s);
    ctx.fillStyle = '#f0a649'; ctx.beginPath(); ctx.arc((m.town.x - b.x0) * s, (m.town.y - b.y0) * s, 6, 0, 7); ctx.fill();
  }
  let worldCv = null, worldV = -1, worldB = null, miniT = 0;
  function worldNow() {
    const S = ui.game.state;
    if (!worldCv) { worldCv = document.createElement('canvas'); worldB = mapBox(ui.game.map); worldV = -1; }
    if (worldV !== S.seenVersion) { worldV = S.seenVersion; paintWorld(worldCv, ui.game.map, S.seen); }
    return worldCv;
  }
  function marks(ctx, ox, oy, s, big) {
    const S = ui.game.state, m = ui.game.map, dot = (x, y, r, col, ring) => { ctx.beginPath(); ctx.arc((x - ox) * s, (y - oy) * s, r, 0, 7); if (ring) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); } };
    const seenAt = (x, y) => S.seen[idx(Math.floor(x), Math.floor(y))] === 1;
    for (const r of m.regions) if (r.nest && seenAt(r.nest.x, r.nest.y)) dot(r.nest.x, r.nest.y, big ? 5 : 3, S.nestAlive[r.id] ? (r.ring === 1 ? '#b4ff4e' : '#ff5a4a') : '#6b6b6b');
    if (big) for (const l of S.landmarks) if (seenAt(l.x, l.y)) dot(l.x, l.y, 6, l.owned ? '#ffb347' : '#ffe08a', !l.owned);
    for (const sp of S.story.spots) if (big) dot(sp.x, sp.y, 4, '#7fe3ff');
    const tr = S.story.trial; if (tr && !tr.done) dot(tr.x, tr.y, big ? 6 : 4, '#ff4a4a', true);
    // the contract's place: a cyan double ring and its name (the big map), on every map; it shows even unexplored
    const k = S.story.contract; if (k && !k.won && !k.lost && k.finale.kind === 'hive') { const n = m.regions[k.finale.region].nest; if (n) {
      dot(n.x, n.y, big ? 11 : 6, '#7fe3ff', true); dot(n.x, n.y, big ? 6 : 3, '#7fe3ff', true);
      if (big) { const t = 'CONTRACT'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(t, (n.x - ox) * s, (n.y - oy) * s - 18); ctx.fillStyle = '#7fe3ff'; ctx.fillText(t, (n.x - ox) * s, (n.y - oy) * s - 18); }
    } }
    if (big && ui.game.hearRadius) { const r = ui.game.hearRadius() * s; ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(240,166,73,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((m.town.x - ox) * s, (m.town.y - oy) * s, r, 0, 7); ctx.stroke(); ctx.restore();
    }
    dot(m.town.x, m.town.y, big ? 7 : 4, '#f0a649');
    // [road] begin
    if (ui.roadUI) ui.roadUI.marks(ctx, ox, oy, s, big);
    // [road] end
    const h = S.hero; dot(h.x, h.y, big ? 6 : 4, '#ffffff'); dot(h.x, h.y, big ? 9 : 6, 'rgba(255,255,255,.5)', true);
  }
  function tickMini(dt) { if ((miniT -= dt) <= 0) { miniT = 0.4; drawMini(); } }
  function drawMini() {
    const cv = $('#mini'); if (!cv || !ui.game) return;
    const S = ui.game.state, src = worldNow(), R = 36, ctx = cv.getContext('2d'), h = S.hero;
    if (cv.width !== R * 2 * 4) { cv.width = cv.height = R * 2 * 4; }
    const s = cv.width / (R * 2); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#0b0d0e'; ctx.fillRect(0, 0, cv.width, cv.width);
    ctx.drawImage(src, h.x - R, h.y - R, R * 2, R * 2, 0, 0, cv.width, cv.width);
    marks(ctx, h.x - R, h.y - R, s, false);
    const c = ui.game.map.city; if (c) { const a = Math.atan2(c.y - h.y, c.x - h.x), dd = Math.hypot(c.x - h.x, c.y - h.y); if (dd > R + c.r * 0.3) { const r0 = cv.width / 2 - 9, x = cv.width / 2 + Math.cos(a) * r0, y = cv.width / 2 + Math.sin(a) * r0; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.fill(); ctx.restore(); } }
  }
  function showMap() {
    const S = ui.game.state, src = worldNow(), b = worldB, w = b.x1 - b.x0 + 1, hh = b.y1 - b.y0 + 1, s = 2;
    ui.paused = true; if (ui.placing) ui.stopPlacing(); ui.closePanel();
    ui.showCard('map', `<button class="closex" id="mapX" aria-label="Close">${icon('close')}</button><div class="eyebrow">[Map] ${esc(ui.game.map.name)} · day ${S.night}</div><h1 class="sm">The woods and the city</h1>
      <div class="mapwrap"><canvas id="bigMap" aria-label="Map of the woods and the city"></canvas></div>
      <div class="legend"><span><i style="background:#ffffff"></i>You</span>${S.story.contract && !S.story.contract.won && S.story.contract.finale.kind === 'hive' ? `<span><i style="background:none;border:2px solid #7fe3ff"></i>Contract: ${esc(S.story.contract.finale.name)}</span>` : ''}<span><i style="background:#f0a649"></i>The Camp</span><span><i style="background:#c2a46e"></i>The old road</span><span><i style="background:#b4ff4e"></i>Forest hollow</span><span><i style="background:#ff5a4a"></i>City hive</span><span><i class="o" style="border-color:#ffe08a"></i>Place to claim</span><span><i style="background:#7fe3ff"></i>Beacon</span><span><i class="o" style="border-color:#f0a649;border-style:dashed"></i>How far the hives hear you</span></div>
      <p class="note">Dark ground is unexplored. Tap a place to plan a trip.</p>
      <div class="cardrow foot"><button class="btn big" id="mapOk">Back</button></div>`, { sys: true, arm: false });
    const cv = $('#bigMap'); cv.width = w * s; cv.height = hh * s; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, b.x0, b.y0, w, hh, 0, 0, w * s, hh * s);
    marks(ctx, b.x0, b.y0, s, true);
    const lbl = (x, y, t) => { ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t, (x - b.x0) * s, (y - b.y0) * s); ctx.fillStyle = '#fff1d6'; ctx.fillText(t, (x - b.x0) * s, (y - b.y0) * s); };
    lbl(ui.game.map.town.x, ui.game.map.town.y - 8, 'CAMP'); const c = ui.game.map.city; if (c) lbl(c.x, c.y + 4, 'THE CITY');
    // [road] begin
    if (ui.roadUI) ui.roadUI.onMap(cv, b.x0, b.y0, s);
    // [road] end
    $('#mapOk').onclick = $('#mapX').onclick = () => { ui.hideCard(); ui.paused = false; };
  }
  $('#mini').onclick = () => { if (ui.game && !ui.card) showMap(); };
  return { drawMinimap, tickMini, showMap };
}
