// [roam] The feel (render-side only, it never touches the rules): a hitstop that holds the sim for a few frames on a kill,
// a camera shake on kills, hits taken and crashes, and the overlay's quick things: pellets with streaks, the muzzle flash,
// sparks off hits and walls, a machine's burst of bolts and a flash ring when it dies. Sakurai: freeze big moments.
export function createFeel({ S, input }) {
  let stop = 0, shakeAmt = 0, flash = null;
  const parts = Array.from({ length: 220 }, () => ({ life: 0 })); let pi = 0;
  const rings = [];
  const spark = (x, y, a, n, sp, col, life, size = 1) => { for (let i = 0; i < n; i++) { const p = parts[pi++ % parts.length], aa = a + (Math.random() - 0.5) * 1.8, v = sp * (0.4 + Math.random());
    Object.assign(p, { x, y, z: 0.5 + Math.random() * 0.4, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, vz: 1 + Math.random() * 3, life: life * (0.6 + Math.random() * 0.6), life0: life, col, size }); } };
  function events(evs, t) {
    for (const e of evs) {
      if (e.type === 'shot') flash = { x: S.kai.x + Math.cos(e.ang) * 0.9, y: S.kai.y + Math.sin(e.ang) * 0.9, ang: e.ang, t: 0.06 };
      else if (e.type === 'hit') spark(e.x, e.y, e.ang, 4, 7, '#ffd27a', 0.25);
      else if (e.type === 'spark') spark(e.x, e.y, Math.random() * 6.28, 2, 3, '#b8b2a0', 0.2, 0.7);
      else if (e.type === 'die' && (e.src === 'gun' || e.src === 'bike')) { stop = Math.max(stop, 0.055); shakeAmt = Math.min(0.9, shakeAmt + 0.28);
        spark(e.x, e.y, Math.random() * 6.28, 14, 6, '#c9c4b6', 0.6, 1.2); spark(e.x, e.y, Math.random() * 6.28, 6, 4, '#ff5a3a', 0.45, 1); rings.push({ x: e.x, y: e.y, t: 0 }); }
      else if (e.type === 'spit') spark(e.x + Math.cos(e.ang) * 0.6, e.y + Math.sin(e.ang) * 0.6, e.ang, 5, 4, '#ff8a3a', 0.25);
      else if (e.type === 'boltPop') spark(e.x, e.y, Math.random() * 6.28, 6, 3, '#ff6a2a', 0.3);
      else if (e.type === 'boltHit') { spark(e.x, e.y, Math.random() * 6.28, 10, 5, '#ff6a2a', 0.4); stop = Math.max(stop, 0.04); }
      else if (e.type === 'hurt') shakeAmt = Math.min(1, shakeAmt + 0.45);
      else if (e.type === 'crash') shakeAmt = Math.min(1, shakeAmt + 0.4);
      else if (e.type === 'nestHit') shakeAmt = Math.min(0.6, shakeAmt + 0.05);
      else if (e.type === 'nestDown') { stop = 0.12; shakeAmt = 1; rings.push({ x: e.x, y: e.y, t: 0, big: true }); }
    }
  }
  const frozen = dt => { if (stop > 0) { stop -= dt; return true; } return false; };
  function shake(cam, dt) { const ox = (Math.random() - 0.5) * shakeAmt * 0.5, oy = (Math.random() - 0.5) * shakeAmt * 0.5; cam.x += ox; cam.y += oy; shakeAmt *= Math.exp(-dt * 9); return () => { cam.x -= ox; cam.y -= oy; }; }
  function draw(fx, toS, ppm, dt, R, lightAt, W, H) {
    const on = (x, y) => x > -30 && y > -30 && x < W + 30 && y < H + 30;
    // a spitter taking aim: a thin red line to Kai that firms up until it fires (the warning to move)
    for (const d of S.dead) if (d.aim > 0) { const [x, y] = toS(d.x, d.y), [kx, ky] = toS(S.kai.x, S.kai.y); if (!on(x, y)) continue; const k = 1 - d.aim / 0.5;
      fx.strokeStyle = `rgba(255,70,50,${0.15 + 0.5 * k})`; fx.lineWidth = 1 + k * 1.5; fx.setLineDash([6, 6]); fx.beginPath(); fx.moveTo(x, y); fx.lineTo(kx, ky); fx.stroke(); fx.setLineDash([]); }
    // the machines' bolts: a hot orb with a short smoky tail
    for (const b of S.bolts || []) { const [x, y] = toS(b.x, b.y), [x0, y0] = toS(b.x - b.vx * 0.06, b.y - b.vy * 0.06); if (!on(x, y)) continue;
      fx.strokeStyle = 'rgba(255,90,40,.5)'; fx.lineWidth = Math.max(2, ppm * 0.22); fx.beginPath(); fx.moveTo(x0, y0); fx.lineTo(x, y); fx.stroke();
      fx.fillStyle = '#ffb35a'; fx.beginPath(); fx.arc(x, y, Math.max(3, ppm * 0.2), 0, 6.283); fx.fill(); fx.fillStyle = '#fff1c8'; fx.beginPath(); fx.arc(x, y, Math.max(1.5, ppm * 0.09), 0, 6.283); fx.fill(); }
    // aiming by hand (dragging off FIRE): a dashed line along the aim, as long as the gun reaches
    if (input && input.fire && typeof input.aim === 'number') { const [x, y] = toS(S.kai.x, S.kai.y), [x1, y1] = toS(S.kai.x + Math.cos(input.aim) * 13, S.kai.y + Math.sin(input.aim) * 13);
      fx.strokeStyle = 'rgba(255,214,120,.55)'; fx.lineWidth = 2; fx.setLineDash([4, 7]); fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x1, y1); fx.stroke(); fx.setLineDash([]); }
    // pellets: a bright head and a streak behind it
    fx.lineCap = 'round';
    for (const p of S.shots) { const [x, y] = toS(p.x, p.y), [x0, y0] = toS(p.x - p.vx * 0.035, p.y - p.vy * 0.035); if (!on(x, y)) continue;
      fx.strokeStyle = 'rgba(255,200,110,.55)'; fx.lineWidth = Math.max(1.5, ppm * 0.09); fx.beginPath(); fx.moveTo(x0, y0); fx.lineTo(x, y); fx.stroke();
      fx.fillStyle = '#fff3cf'; fx.beginPath(); fx.arc(x, y, Math.max(1.4, ppm * 0.06), 0, 6.283); fx.fill(); }
    if (flash && (flash.t -= dt) > 0) { const [x, y] = toS(flash.x, flash.y), r = ppm * 0.5; fx.save(); fx.translate(x, y); fx.rotate(flash.ang); fx.fillStyle = 'rgba(255,214,120,.85)';
      fx.beginPath(); fx.moveTo(0, -r * 0.35); fx.lineTo(r * 1.3, 0); fx.lineTo(0, r * 0.35); fx.closePath(); fx.fill(); fx.restore(); }
    for (const p of parts) { if (p.life <= 0) continue; p.life -= dt; p.vz -= 9 * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vx *= 0.4; p.vy *= 0.4; p.vz *= -0.3; }
      p.x += p.vx * dt; p.y += p.vy * dt; const [x, y] = toS(p.x, p.y - p.z * 0.5); if (!on(x, y)) continue;
      fx.globalAlpha = Math.min(1, p.life / p.life0 * 2); fx.fillStyle = p.col; const s = Math.max(1, ppm * 0.07 * p.size); fx.fillRect(x - s / 2, y - s / 2, s, s); }
    fx.globalAlpha = 1;
    for (let i = rings.length - 1; i >= 0; i--) { const g = rings[i]; g.t += dt; const k = g.t / (g.big ? 0.6 : 0.3); if (k >= 1) { rings.splice(i, 1); continue; }
      const [x, y] = toS(g.x, g.y); fx.strokeStyle = `rgba(255,${g.big ? 120 : 220},${g.big ? 70 : 150},${1 - k})`; fx.lineWidth = Math.max(1.5, ppm * 0.08 * (1 - k)); fx.beginPath(); fx.arc(x, y, ppm * (g.big ? 4 : 1.4) * (0.3 + k), 0, 6.283); fx.stroke(); }
  }
  return { events, frozen, shake, draw };
}
