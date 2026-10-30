// [roam] The world's scars (render-side: it reads the sim's events, never the rules): ground that burnt goes black for
// good (a char mark in the decal layer), a soaked patch holds the sky like a puddle until it dries. Written into the
// streamed tiles, so the ground shader draws them like any of the city's marks.
export function createScars({ tiles }) {
  const wet = [];
  const hash = (x, y, k) => { let q = (Math.floor(x * 7.3) * 374761393 + Math.floor(y * 3.1) * 668265263 + k * 1274126177) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  function events(evs, t) {
    for (const e of evs) {
      if (e.type === 'burnt') { const it = { layer: 'decal', order: 95000, x: e.x, y: e.y, r: 2, draw: X => { X.globalCompositeOperation = 'lighter';   // char: a ragged dark blot over the 2 m cell, ashier at the edge
          for (let k = 0; k < 5; k++) { const ox = (hash(e.x, e.y, k) - 0.5) * 1.6, oy = (hash(e.y, e.x, k + 9) - 0.5) * 1.6, r = 0.7 + hash(e.x, e.y, k + 3) * 0.7;
            const g = X.createRadialGradient(e.x + ox, e.y + oy, 0, e.x + ox, e.y + oy, r); g.addColorStop(0, 'rgba(0,150,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = g; X.beginPath(); X.arc(e.x + ox, e.y + oy, r, 0, 6.283); X.fill(); } } };
        tiles.add(it); tiles.touch(e.x, e.y, 2); }
      else if (e.type === 'soakGround') { const it = { layer: 'decal', order: 96000, x: e.x, y: e.y, r: e.r + 1, draw: X => { X.globalCompositeOperation = 'lighter';
          const g = X.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r + 0.6); g.addColorStop(0, 'rgba(0,30,190,1)'); g.addColorStop(0.75, 'rgba(0,20,140,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = g; X.beginPath(); X.arc(e.x, e.y, e.r + 0.6, 0, 6.283); X.fill(); } };
        tiles.add(it); tiles.touch(e.x, e.y, e.r + 1); wet.push({ it, until: t + e.dur }); }
    }
    for (let i = wet.length - 1; i >= 0; i--) if (t > wet[i].until) { const it = wet[i].it; tiles.remove(it); tiles.touch(it.x, it.y, it.r); wet.splice(i, 1); }
  }
  return { events };
}
