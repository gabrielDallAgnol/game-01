// [roam] The world's scars (render-side: it reads the sim's events, never the rules): ground that burnt goes black for
// good (a char mark in the decal layer); a burnt house's footprint is charred (the shader shows black rafters); a burnt
// tree loses its crown; a blown car turns to its burnt variant. Written into the streamed tiles, so the ground shader draws
// them like any of the city's marks. (Water, oil and live fire are the atoms' own state: atomlook.js.)
export function createScars({ tiles, town }) {
  const dressById = new Map(((town && town.dress && town.dress.list) || []).map(i => [i.id, i]));
  const hash = (x, y, k) => { let q = (Math.floor(x * 7.3) * 374761393 + Math.floor(y * 3.1) * 668265263 + k * 1274126177) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  function events(evs, t) {
    for (const e of evs) {
      if (e.type === 'burnt') { const it = { layer: 'decal', order: 95000, x: e.x, y: e.y, r: 2, draw: X => { X.globalCompositeOperation = 'lighter';   // char: a ragged dark blot over the 2 m cell, ashier at the edge
          for (let k = 0; k < 5; k++) { const ox = (hash(e.x, e.y, k) - 0.5) * 1.6, oy = (hash(e.y, e.x, k + 9) - 0.5) * 1.6, r = 0.7 + hash(e.x, e.y, k + 3) * 0.7;
            const g = X.createRadialGradient(e.x + ox, e.y + oy, 0, e.x + ox, e.y + oy, r); g.addColorStop(0, 'rgba(0,150,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = g; X.beginPath(); X.arc(e.x + ox, e.y + oy, r, 0, 6.283); X.fill(); } } };
        tiles.add(it); tiles.touch(e.x, e.y, 2); }
      // [atoms] what fire leaves of a placed atom: a tree loses its crown (its height in the trees layer goes to zero) over a
      // black ring; a house's yard and footprint are charred; a car or a pump turns to its burnt variant
      else if (e.type === 'atomBurnt') { const R0 = e.kind === 'building' ? 7 : e.kind === 'tree' ? 3 : 2;
        const char = { layer: 'decal', order: 95500, x: e.x, y: e.y, r: R0 + 1, draw: X => { X.globalCompositeOperation = 'lighter'; const g = X.createRadialGradient(e.x, e.y, 0, e.x, e.y, R0); g.addColorStop(0, 'rgba(0,170,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = g; X.beginPath(); X.arc(e.x, e.y, R0, 0, 6.283); X.fill(); } };
        tiles.add(char);
        if (e.obb) { const o = e.obb; tiles.add({ layer: 'decal', order: 95600, x: o.x, y: o.y, r: Math.hypot(o.w, o.h) / 2 + 1, draw: X => { X.globalCompositeOperation = 'lighter'; X.translate(o.x, o.y); X.rotate(o.rot || 0); X.fillStyle = 'rgba(0,200,0,1)'; X.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); } }); }
        // the crown is the misc layer's red (the mask) and the trees layer's red (its height): both go to zero
        if (e.kind === 'tree') for (const layer of ['misc', 'trees']) tiles.add({ layer, order: 99000, x: e.x, y: e.y, r: (e.r || 3) + 1, draw: X => { X.globalCompositeOperation = 'multiply'; X.fillStyle = 'rgb(0,255,255)'; X.beginPath(); X.arc(e.x, e.y, (e.r || 3) + 0.6, 0, 6.283); X.fill(); } });
        if (e.to === 'wreck') { const it = dressById.get(e.ref); if (it) it.variant = 'burnt'; }
        tiles.touch(e.x, e.y, e.kind === 'building' ? 12 : 5); }
    }
  }
  return { events };
}
