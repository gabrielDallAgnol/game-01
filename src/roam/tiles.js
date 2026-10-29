// [roam] The ground's data maps, streamed: the world is cut into TILE-metre tiles and only those round the camera are
// painted, into a ring of RING × RING slots on each layer's canvas (a tile at (i, j) lives in slot (i mod RING, j mod
// RING)). The shader samples the maps with repeat wrapping, so world metres map straight to texture coordinates (w / WIN)
// and no tile ever moves once painted. Memory stays fixed however big the world is: one canvas and one texture a layer.
// What paints a tile is a list of items: { layer, order, x, y, r (a bounding circle), draw(ctx) } in world metres; each
// item draws with its own composite op inside save/restore, in `order`. A tile is painted from the items touching it,
// then uploaded alone (texSubImage2D), a few a frame within a time budget, nearest the camera first.
/* global THREE */
export const TILE = 64, RING = 8, TPX = 4, WIN = TILE * RING, CPX = WIN * TPX;   // 512 m round the camera, 4 px a metre

export function createTiles({ layers, world }) {
  const L = layers.map(l => { const c = document.createElement('canvas'); c.width = c.height = CPX; const x = c.getContext('2d', { willReadFrequently: true });
    const t = new THREE.Texture(c); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return { ...l, canvas: c, ctx: x, tex: t }; });
  const byName = Object.fromEntries(L.map(l => [l.name, l]));
  const index = new Map(), key = (i, j) => i * 65536 + j;   // tile → its items
  let sorted = false;
  function add(it) { const i0 = Math.floor((it.x - it.r) / TILE), i1 = Math.floor((it.x + it.r) / TILE), j0 = Math.floor((it.y - it.r) / TILE), j1 = Math.floor((it.y + it.r) / TILE);
    it.li = L.indexOf(byName[it.layer]); if (it.li < 0) throw new Error('tiles: no layer ' + it.layer);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = key(i, j); if (!index.has(k)) index.set(k, []); index.get(k).push(it); } sorted = false; }
  const slot = new Map();   // slot (si, sj) → the tile painted there
  const done = new Set(), pending = [];
  function paint(i, j) {
    if (!sorted) { for (const list of index.values()) list.sort((a, b) => a.order - b.order); sorted = true; }
    const si = ((i % RING) + RING) % RING, sj = ((j % RING) + RING) % RING, px = si * TILE * TPX, py = sj * TILE * TPX, S = TILE * TPX, items = index.get(key(i, j)) || [];
    const prev = slot.get(si * RING + sj); if (prev !== undefined) done.delete(prev); slot.set(si * RING + sj, key(i, j)); done.add(key(i, j));
    for (const l of L) { const X = l.ctx; X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.beginPath(); X.rect(px, py, S, S); X.clip();
      X.globalCompositeOperation = 'copy'; X.fillStyle = l.bg; X.fillRect(px, py, S, S); X.globalCompositeOperation = 'source-over';
      X.setTransform(TPX, 0, 0, TPX, px - i * TILE * TPX, py - j * TILE * TPX);
      for (const it of items) if (it.li === l.index) { X.save(); it.draw(X); X.restore(); }
      X.restore(); l.dirty.push([px, py, S]); } }
  L.forEach((l, k) => { l.index = k; l.dirty = []; l.ctx.fillStyle = l.bg; l.ctx.fillRect(0, 0, CPX, CPX); });
  let uploadedOnce = false;
  // upload what changed: the first time the whole canvas, after that tile by tile
  function upload(renderer) {
    const gl = renderer.getContext();
    for (const l of L) { if (!l.dirty.length) continue;
      const p = renderer.properties.get(l.tex);
      if (!uploadedOnce || !p.__webglTexture) { l.tex.needsUpdate = true; l.dirty.length = 0; continue; }
      renderer.state.activeTexture(gl.TEXTURE0); renderer.state.bindTexture(gl.TEXTURE_2D, p.__webglTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      for (const [x, y, S] of l.dirty) gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, l.ctx.getImageData(x, y, S, S));
      l.dirty.length = 0; }
    uploadedOnce = true; }
  /** the tiles within `reach` metres of (x, y), nearest first, that are not painted yet */
  function want(x, y, reach) { const i0 = Math.floor((x - reach) / TILE), i1 = Math.floor((x + reach) / TILE), j0 = Math.floor((y - reach) / TILE), j1 = Math.floor((y + reach) / TILE), out = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (i < -1 || j < -1 || i * TILE > world.w + TILE || j * TILE > world.h + TILE) continue; if (!done.has(key(i, j))) out.push([i, j, Math.hypot((i + 0.5) * TILE - x, (j + 0.5) * TILE - y)]); }
    return out.sort((a, b) => a[2] - b[2]); }
  const REACH = WIN / 2 - TILE * 0.75;   // the ring holds 8 tiles a side: keep a little under half of it round the camera
  /** paint what the camera will need, within a budget of ms (all of it when budget is Infinity); returns tiles painted */
  function update(x, y, budget, onTile) { const t0 = performance.now(); let n = 0;
    for (const [i, j] of want(x, y, REACH)) { if (n && performance.now() - t0 > budget) break; paint(i, j); n++; if (onTile) onTile(i, j); }
    return n; }
  return { add, update, upload, layers: L, byName, TILE, WIN };
}
