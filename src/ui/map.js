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
  // [acts] act 1: what lies behind the fence (the road past the woods, the city) is not on the map yet
  const hidden = () => { const g = ui.game; if (!g || !g.act || g.act() >= 2) return null; const S = g.state, gate = new Set(S.actGate || []); const w = g.map.wild; return gate.size ? i => gate.has(g.map.region[i]) || (w && !w[i]) : null; };   // the far road and every street of the city
  function mapBox(m, hide) { let x0 = N, y0 = N, x1 = 0, y1 = 0; for (let i = 0; i < N * N; i++) if (m.terrain[i] !== T.VOID && !(hide && hide(i))) { const x = i % N, y = (i / N) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0: Math.max(0, x0 - 3), y0: Math.max(0, y0 - 3), x1: Math.min(N - 1, x1 + 3), y1: Math.min(N - 1, y1 + 3) }; }
  function paintWorld(cv, m, seen, hide) {
    cv.width = cv.height = N; const ctx = cv.getContext('2d'), im = ctx.createImageData(N, N), d = im.data;
    for (let i = 0; i < N * N; i++) {
      const t = m.terrain[i], wild = m.wild && m.wild[i];
      let c = t === T.VOID || (hide && hide(i)) ? MAPCOL.voidc : m.lm[i] >= 0 ? MAPCOL.site : m.road[i] && wild ? MAPCOL.road : t === T.WATER ? MAPCOL.water : t === T.FORD ? MAPCOL.ford : t === T.CLIFF ? MAPCOL.cliff : t === T.DIRT ? MAPCOL.dirt
        : wild ? (t === T.FOREST ? MAPCOL.wood : MAPCOL.meadow) : t === T.ROCK ? MAPCOL.block : t === T.FOREST ? MAPCOL.park : MAPCOL.street;
      let k = 1;
      if (seen && !seen[i] && t !== T.VOID && !(hide && hide(i))) k = m.road[i] && wild ? 0.55 : wild ? 0.28 : 0.42;
      d[i * 4] = c[0] * k; d[i * 4 + 1] = c[1] * k; d[i * 4 + 2] = c[2] * k; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0); return cv;
  }
  // [pacify] begin: pacified ground is washed warm, with a thin amber edge where the quiet land ends
  function tintPacified(cv, pz, hide) {
    const ctx = cv.getContext('2d'), im = ctx.getImageData(0, 0, N, N), d = im.data, W = [255, 196, 120];
    for (let i = 0; i < N * N; i++) {
      if (!pz[i] || (hide && hide(i))) continue;
      const x = i % N, y = (i / N) | 0, edge = x === 0 || y === 0 || x === N - 1 || y === N - 1 || !pz[i - 1] || !pz[i + 1] || !pz[i - N] || !pz[i + N];
      const k = edge ? 0.62 : 0.16;
      for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = d[i * 4 + ch] * (1 - k) + W[ch] * k * (edge ? 1 : 0.85);
    }
    ctx.putImageData(im, 0, 0);
  }
  // [pacify] end
  function drawMinimap(canvas, m) {
    const b = mapBox(m), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, src = paintWorld(document.createElement('canvas'), m, null), s = 2;
    canvas.width = w * s; canvas.height = h * s; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, b.x0, b.y0, w, h, 0, 0, w * s, h * s);
    ctx.fillStyle = '#f0a649'; ctx.beginPath(); ctx.arc((m.town.x - b.x0) * s, (m.town.y - b.y0) * s, 6, 0, 7); ctx.fill();
  }
  let worldCv = null, worldV = -1, worldB = null, miniT = 0;
  function worldNow() {
    const S = ui.game.state;
    const pz = ui.game.pacifyMap ? ui.game.pacifyMap() : null;   // [pacify]
    const hide = hidden(), key = `${S.seenVersion}|${hide ? 1 : 2}|${S.pacifyVersion || 0}`;
    if (!worldCv) { worldCv = document.createElement('canvas'); worldV = -1; }
    if (worldV !== key) { worldV = key; worldB = mapBox(ui.game.map, hide); paintWorld(worldCv, ui.game.map, S.seen, hide); if (pz) tintPacified(worldCv, pz, hide); }
    return worldCv;
  }
  function marks(ctx, ox, oy, s, big) {
    const S = ui.game.state, m = ui.game.map, dot = (x, y, r, col, ring) => { ctx.beginPath(); ctx.arc((x - ox) * s, (y - oy) * s, r, 0, 7); if (ring) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); } };
    const seenAt = (x, y) => S.seen[idx(Math.floor(x), Math.floor(y))] === 1;
    for (const r of m.regions) if (r.nest && (seenAt(r.nest.x, r.nest.y) || (S.nestAlive[r.id] && !S.sealed[r.id]))) dot(r.nest.x, r.nest.y, big ? 6 : 4, S.nestAlive[r.id] ? '#ff7a1c' : '#6b6b6b');   // [nest3] an Inferno Nest is a fire you can see: always on the map
    if (ui.game.smothered) for (const r of m.regions) if (r.nest && ui.game.smothered(r.id)) dot(r.nest.x, r.nest.y, big ? 8 : 5, '#ffc478', true);   // [pacify] asleep on your ground: it will not wake
    // places to claim: small and quiet (optional); owned ones a plain amber dot
    if (big) for (const l of S.landmarks) if (seenAt(l.x, l.y)) dot(l.x, l.y, l.owned ? 4 : 3.5, l.owned ? '#d9a35a' : 'rgba(214,222,226,.7)', !l.owned);
    // objectives: OPTIONAL ones small and neutral; MAIN ones a gold double ring and a "MAIN · what" tag, even unexplored
    const objs = ui.game.story().objectives().filter(o => o.x !== undefined);
    for (const o of objs) if (o.priority !== 'main') dot(o.x, o.y, big ? 4 : 2.5, o.kind === 'drop' ? '#e0886a' : '#a9c6d6');
    for (const o of objs) if (o.priority === 'main') {
      const X = (o.x - ox) * s, Y = (o.y - oy) * s;
      ctx.beginPath(); ctx.arc(X, Y, big ? 13 : 12, 0, 7); ctx.fillStyle = 'rgba(255,211,106,.25)'; ctx.fill();
      dot(o.x, o.y, big ? 12 : 11, '#ffd36a', true); dot(o.x, o.y, big ? 5 : 5, '#ffd36a');
    }
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
    const c = !hidden() && ui.game.map.city; if (c) { const a = Math.atan2(c.y - h.y, c.x - h.x), dd = Math.hypot(c.x - h.x, c.y - h.y); if (dd > R + c.r * 0.3) { const r0 = cv.width / 2 - 9, x = cv.width / 2 + Math.cos(a) * r0, y = cv.width / 2 + Math.sin(a) * r0; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.fill(); ctx.restore(); } }
  }
  /** the big map's "MAIN · what" tags, drawn last so nothing covers them; each takes the first free slot around its ring */
  function mainTags(ctx, ox, oy, s, campAt) {
    const W = ctx.canvas.width, placed = [];
    ctx.font = 'bold 18px system-ui, sans-serif';
    { const w = ctx.measureText('CAMP').width + 30; placed.push({ x: (campAt[0] - ox) * s - w / 2, y: (campAt[1] - oy) * s - 22, w, h: 30 }); }
    for (const o of ui.game.story().objectives()) {
      if (o.priority !== 'main' || o.x === undefined) continue;
      const t = `MAIN · ${o.label.toUpperCase()}`, w = ctx.measureText(t).width + 14, h = 24, X = (o.x - ox) * s, Y = (o.y - oy) * s;
      let r = null;
      for (const dy of [-30, 30, -56, 56, -82, 82]) {
        const c = { x: Math.max(2, Math.min(W - w - 2, X - w / 2)), y: Y + dy - h / 2, w, h };
        if (!placed.some(p => c.x < p.x + p.w && p.x < c.x + c.w && c.y < p.y + p.h && p.y < c.y + c.h)) { r = c; break; }
      }
      r = r || { x: Math.max(2, Math.min(W - w - 2, X - w / 2)), y: Y - 30 - h / 2, w, h }; placed.push(r);
      ctx.strokeStyle = 'rgba(255,211,106,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(Math.max(r.x, Math.min(r.x + w, X)), r.y + (r.y > Y ? 0 : h)); ctx.stroke();
      ctx.fillStyle = 'rgba(10,16,26,.94)'; ctx.fillRect(r.x, r.y, w, h); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, w, h);
      ctx.fillStyle = '#ffd36a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, r.x + w / 2, r.y + h / 2 + 1); ctx.textBaseline = 'alphabetic';
    }
  }
  /** the legend, grouped: what the System requires first (gold), then what is optional (quiet), then the land */
  function legend() {
    const objs = ui.game.story().objectives(), main = objs.filter(o => o.priority === 'main' && o.x !== undefined);
    const mainRow = main.length ? `<div class="lg-main"><b>Main</b>${main.map(o => `<span><i class="o" style="border-color:#ffd36a;box-shadow:0 0 6px rgba(255,211,106,.6)"></i>${esc(o.label)}: ${esc(o.title)}</span>`).join('')}</div>` : '';
    return `${mainRow}<div class="legend"><span class="lg-h">Optional</span><span><i class="o" style="border-color:rgba(214,222,226,.7)"></i>Place to claim</span><span><i style="background:#a9c6d6"></i>Beacon</span><span><i style="background:#e0886a"></i>Supply drop</span></div>
      <div class="legend"><span><i style="background:#ffffff"></i>You</span><span><i style="background:#f0a649"></i>The Haven</span><span><i style="background:#c2a46e"></i>The old road</span><span><i style="background:#ff7a1c"></i>Inferno nest</span><span><i class="o" style="border-color:#f0a649;border-style:dashed"></i>How far the Inferno Nests hear you</span><span><i style="background:rgba(255,196,120,.45);box-shadow:inset 0 0 0 1px #ffc478"></i>Pacified: no Inferno Nest wakes</span></div>`;
  }
  function showMap() {
    const S = ui.game.state, src = worldNow(), b = worldB, w = b.x1 - b.x0 + 1, hh = b.y1 - b.y0 + 1, s = 2, act1 = !!hidden();
    ui.paused = true; if (ui.placing) ui.stopPlacing(); ui.closePanel();
    ui.showCard('map', `<button class="closex" id="mapX" aria-label="Close">${icon('close')}</button><div class="eyebrow">[Map] ${esc(ui.game.map.name)} · day ${S.night}</div><h1 class="sm">${act1 ? 'The woods' : 'The woods and the city'}</h1>
      <div class="mapwrap"><canvas id="bigMap" aria-label="${act1 ? 'Map of the woods' : 'Map of the woods and the city'}"></canvas></div>
      ${legend()}
      <p class="note">${act1 ? 'Burn the hollows: the fence opens and the road with it.' : 'Dark ground is unexplored. Tap a place to plan a trip.'}</p>
      <div class="cardrow foot"><button class="btn big" id="mapOk">Back</button></div>`, { sys: true, arm: false });
    const cv = $('#bigMap'); cv.width = w * s; cv.height = hh * s; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, b.x0, b.y0, w, hh, 0, 0, w * s, hh * s);
    marks(ctx, b.x0, b.y0, s, true);
    const lbl = (x, y, t) => { ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t, (x - b.x0) * s, (y - b.y0) * s); ctx.fillStyle = '#fff1d6'; ctx.fillText(t, (x - b.x0) * s, (y - b.y0) * s); };
    lbl(ui.game.map.town.x, ui.game.map.town.y - 8, 'CAMP'); const c = !act1 && ui.game.map.city; if (c) lbl(c.x, c.y + 4, 'THE CITY');
    // [road] begin
    if (ui.roadUI) ui.roadUI.onMap(cv, b.x0, b.y0, s);
    // [road] end
    mainTags(ctx, b.x0, b.y0, s, [ui.game.map.town.x, ui.game.map.town.y - 8]);
    $('#mapOk').onclick = $('#mapX').onclick = () => { ui.hideCard(); ui.paused = false; };
  }
  $('#mini').onclick = () => { if (ui.game && !ui.card) showMap(); };
  return { drawMinimap, tickMini, showMap };
}
