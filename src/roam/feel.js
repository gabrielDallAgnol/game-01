// [roam] The feel (render-side only, it never touches the rules): a hitstop that holds the sim for a few frames on a kill,
// a camera shake on kills, hits taken and crashes, and the overlay's quick things: pellets with streaks, the muzzle flash,
// sparks off hits and walls, a machine's burst of bolts and a flash ring when it dies. Sakurai: freeze big moments.
import { ELEMENTS } from '../play/elements.js';
import { REACTIONS, CLASH } from '../play/reactions.js';
export function createFeel({ S, input, town }) {
  const CH = town && town.chars, cw = CH ? CH.w : 1, cell = CH ? CH.cell : 2;
  let stop = 0, shakeAmt = 0, flash = null;
  const parts = Array.from({ length: 220 }, () => ({ life: 0 })); let pi = 0;
  const rings = [], words = [];   // [m2] a reaction's name floats up where it happened (Sakurai: praise the player)
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
      else if (e.type === 'reaction') { const Rx = REACTIONS[e.id] || CLASH; words.push({ x: e.x, y: e.y, text: Rx.id === 'clash' ? 'clash' : Rx.id.toUpperCase(), col: Rx.color, t: 0, dy: words.filter(w => Math.hypot(w.x - e.x, w.y - e.y) < 3 && w.t < 0.8).length * 16 });
        rings.push({ x: e.x, y: e.y, t: 0, big: e.id === 'blaze', col: Rx.color }); spark(e.x, e.y, Math.random() * 6.28, e.id === 'blaze' ? 18 : 8, e.id === 'blaze' ? 7 : 4, Rx.color, 0.5, 1.1);
        if (e.id === 'blaze') { stop = Math.max(stop, 0.07); shakeAmt = Math.min(1, shakeAmt + 0.5); } }
      else if (e.type === 'blast') { stop = Math.max(stop, e.el === undefined ? 0.08 : 0.04); shakeAmt = Math.min(1, shakeAmt + (e.r > 4 ? 0.9 : 0.45)); rings.push({ x: e.x, y: e.y, t: 0, big: true, col: '#ffb35a' });
        spark(e.x, e.y, Math.random() * 6.28, e.r > 4 ? 30 : 16, e.r * 2.6, '#ffcf7a', 0.55, 1.4); spark(e.x, e.y, Math.random() * 6.28, 10, e.r * 1.4, '#3a3530', 0.9, 2.2); }
      else if (e.type === 'catch') { rings.push({ x: e.x, y: e.y, t: 0, col: '#ff8a3a' }); spark(e.x, e.y, Math.random() * 6.28, 8, 3, '#ffb35a', 0.5); }
      else if (e.type === 'doused') spark(e.x, e.y, -1.57, 6, 1.6, '#e6e2dc', 0.8, 1.6);
      else if (e.type === 'ignite') { rings.push({ x: e.x, y: e.y, t: 0, col: '#ff8a3a' }); spark(e.x, e.y, Math.random() * 6.28, 10, 4, '#ffb35a', 0.5); }
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
      const wet = p.el === 'water'; fx.strokeStyle = wet ? 'rgba(140,200,240,.5)' : p.el === 'fire' ? 'rgba(255,150,70,.6)' : 'rgba(255,200,110,.55)'; fx.lineWidth = Math.max(2.5, ppm * 0.16); fx.beginPath(); fx.moveTo(x0, y0); fx.lineTo(x, y); fx.stroke();   // [m2] thicker: readable on a phone
      fx.fillStyle = wet ? '#d6efff' : p.el === 'fire' ? '#ffd28a' : '#fff3cf'; fx.beginPath(); fx.arc(x, y, Math.max(2.2, ppm * 0.11), 0, 6.283); fx.fill(); }
    if (flash && (flash.t -= dt) > 0) { const [x, y] = toS(flash.x, flash.y), r = ppm * 0.5; fx.save(); fx.translate(x, y); fx.rotate(flash.ang); fx.fillStyle = 'rgba(255,214,120,.85)';
      fx.beginPath(); fx.moveTo(0, -r * 0.35); fx.lineTo(r * 1.3, 0); fx.lineTo(0, r * 0.35); fx.closePath(); fx.fill(); fx.restore(); }
    for (const p of parts) { if (p.life <= 0) continue; p.life -= dt; p.vz -= 9 * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vx *= 0.4; p.vy *= 0.4; p.vz *= -0.3; }
      p.x += p.vx * dt; p.y += p.vy * dt; const [x, y] = toS(p.x, p.y - p.z * 0.5); if (!on(x, y)) continue;
      fx.globalAlpha = Math.min(1, p.life / p.life0 * 2); fx.fillStyle = p.col; const s = Math.max(1, ppm * 0.07 * p.size); fx.fillRect(x - s / 2, y - s / 2, s, s); }
    fx.globalAlpha = 1;
    // [atoms] fresh oil slicks (dark and glossy; the town's old stains are painted on the street already)
    for (const o of S.atoms || []) if (o.slick && o.state === 'ok') { const [x, y] = toS(o.x, o.y); if (!on(x, y)) continue; fx.globalAlpha = Math.min(1, o.life / 4) * 0.8; fx.fillStyle = '#0d0c0b'; fx.beginPath(); fx.ellipse(x, y, o.r * ppm, o.r * ppm * 0.75, 0.6, 0, 6.283); fx.fill();
      fx.globalAlpha *= 0.5; fx.strokeStyle = '#5a6a78'; fx.lineWidth = 1; fx.beginPath(); fx.ellipse(x - o.r * ppm * 0.2, y - o.r * ppm * 0.2, o.r * ppm * 0.5, o.r * ppm * 0.25, 0.6, 3.6, 5.4); fx.stroke(); }
    fx.globalAlpha = 1;
    // [atoms] fire in the world: a glow and flickering tongues (yellow core, orange edge), embers lifting off; burning
    // ground cells one flame each; a burning tree a crown of flame; a house several along its roof, with smoke
    const flame = (x, y, r, k, seed) => { const gr = fx.createRadialGradient(x, y, 0, x, y, r * 1.5); gr.addColorStop(0, `rgba(255,190,80,${0.5 * k})`); gr.addColorStop(1, 'rgba(255,90,30,0)'); fx.fillStyle = gr; fx.beginPath(); fx.arc(x, y, r * 1.5, 0, 6.283); fx.fill();
      for (let q = 0; q < 3; q++) { const ph = performance.now() / 120 + seed * 1.7 + q * 2.1, h = r * (0.9 + 0.5 * Math.sin(ph)), ox = (q - 1) * r * 0.45 + Math.sin(ph * 1.3) * r * 0.1, w = r * 0.32;
        fx.fillStyle = q === 1 ? `rgba(255,214,120,${0.95 * k})` : `rgba(255,120,40,${0.85 * k})`; fx.beginPath(); fx.moveTo(x + ox - w, y + r * 0.2); fx.quadraticCurveTo(x + ox - w * 0.4, y - h * 0.5, x + ox + Math.sin(ph) * w * 0.5, y - h); fx.quadraticCurveTo(x + ox + w * 0.4, y - h * 0.5, x + ox + w, y + r * 0.2); fx.closePath(); fx.fill(); } };
    const ember = (wx, wy, spread, p) => { if (Math.random() < p) spark(wx + (Math.random() - 0.5) * spread, wy + (Math.random() - 0.5) * spread, -1.57, 1, 1.4, Math.random() < 0.5 ? '#ffb35a' : '#ff6a2a', 0.7, 0.9); };
    if (S.cells) for (const [c, st] of S.cells) { if (!st.burn) continue; const wx = (c % cw + 0.5) * cell, wy = (Math.floor(c / cw) + 0.5) * cell, [x, y] = toS(wx, wy); if (!on(x, y)) continue;
      flame(x, y, Math.max(4, ppm * 0.85), Math.min(1, st.burn / 1.2), c); ember(wx, wy, cell, 0.08); }
    // [atoms] a gutted house: the roof gone to black rafters over a dark shell, a few embers still glowing in it
    for (const a of S.atoms || []) { if (a.kind !== 'building' || a.state !== 'done') continue; const [x, y] = toS(a.x, a.y); if (x < -200 || y < -200 || x > W + 200 || y > H + 200) continue; const o = a.obb;
      fx.save(); fx.translate(x, y); fx.rotate(o.rot || 0); const w = o.w * ppm, h = o.h * ppm; fx.fillStyle = 'rgba(14,12,11,.86)'; fx.fillRect(-w / 2, -h / 2, w, h);
      fx.strokeStyle = 'rgba(70,58,50,.8)'; fx.lineWidth = Math.max(1, ppm * 0.12); fx.beginPath(); for (let q = 1; q < 6; q++) { const u = -w / 2 + w * q / 6; fx.moveTo(u, -h / 2 + 2); fx.lineTo(u + ((q * 37) % 5 - 2), h / 2 - 2); } fx.moveTo(-w / 2, 0); fx.lineTo(w / 2, 0); fx.stroke();
      fx.strokeStyle = 'rgba(40,34,30,.95)'; fx.lineWidth = Math.max(1.5, ppm * 0.2); fx.strokeRect(-w / 2, -h / 2, w, h);
      for (let q = 0; q < 4; q++) { const fl = 0.5 + 0.5 * Math.sin(performance.now() / 400 + a.id * 3 + q * 2); fx.fillStyle = `rgba(255,${90 + 60 * fl},40,${0.35 + 0.4 * fl})`; fx.fillRect(((q * 0.618 + a.id * 0.13) % 1 - 0.5) * w * 0.8, ((q * 0.382 + 0.2) % 1 - 0.5) * h * 0.8, 2, 2); }
      fx.restore(); }
    for (const a of S.atoms || []) { if (a.state !== 'burning') continue; const [x, y] = toS(a.x, a.y); if (x < -200 || y < -200 || x > W + 200 || y > H + 200) continue; const k = Math.min(1, a.fuel / 2);
      if (a.obb) { const o = a.obb, c = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0), n = Math.max(2, Math.min(7, Math.round(o.w * o.h / 30)));
        for (let q = 0; q < n; q++) { const u = ((q * 0.618) % 1 - 0.5) * o.w * 0.8, v = ((q * 0.382 + 0.3) % 1 - 0.5) * o.h * 0.8, wx = o.x + u * c - v * sn, wy = o.y + u * sn + v * c, [fxx, fyy] = toS(wx, wy);
          flame(fxx, fyy, Math.max(6, ppm * 1.6), k, a.id + q); ember(wx, wy, 2, 0.1); }
        if (Math.random() < 0.3) spark(a.x + (Math.random() - 0.5) * o.w * 0.6, a.y + (Math.random() - 0.5) * o.h * 0.6, -1.57, 1, 0.8, Math.random() < 0.5 ? '#2a2624' : '#3a3530', 1.6, 3); }
      else { flame(x, y, Math.max(5, ppm * Math.max(0.7, a.r * 0.9)), k, a.id); ember(a.x, a.y, a.r * 2, 0.12); } }
    // [m2] steam (warm, scalding) and fog (white, wide): soft billows that thin out as the cloud fades
    for (const c of S.clouds || []) { const [x, y] = toS(c.x, c.y); if (!on(x, y)) continue; const k = Math.min(1, c.left / 1.2) * Math.min(1, (c.dur - c.left) / 0.3 + 0.3);
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + c.dur, rr = c.r * ppm * (0.35 + 0.18 * (i % 3)), bx = x + Math.cos(a + c.left * 0.2) * c.r * ppm * 0.45, by = y + Math.sin(a + c.left * 0.2) * c.r * ppm * 0.4;
        const gr = fx.createRadialGradient(bx, by, 0, bx, by, rr); const cc = c.kind === 'steam' ? '242,226,210' : '232,238,242'; gr.addColorStop(0, `rgba(${cc},${(c.kind === 'fog' ? 0.5 : 0.42) * k})`); gr.addColorStop(1, `rgba(${cc},0)`); fx.fillStyle = gr; fx.beginPath(); fx.arc(bx, by, rr, 0, 6.283); fx.fill(); } }
    // [m2] pips on a machine: three slots above it, each filled in its element's colour as hits land (the mix of three is
    // the recipe that goes off); burning pips give off embers; soaked drips
    for (const d of S.dead) { if (!(d.pips && d.pips.length) && !d.st) continue; const [x, y] = toS(d.x, d.y); if (!on(x, y)) continue;
      if (d.pips && d.pips.length) for (let i = 0; i < 3; i++) { const p = d.pips[i], el = p && ELEMENTS[p.el]; fx.globalAlpha = el ? 1 : 0.35; fx.fillStyle = el ? el.color : '#1a1a1c'; fx.strokeStyle = 'rgba(8,8,10,.85)'; fx.lineWidth = 1.5; fx.beginPath(); fx.arc(x - 6 + i * 6, y - ppm * 1.1, 2.4, 0, 6.283); fx.fill(); fx.stroke();
        if (el && p.el === 'fire' && Math.random() < 0.12) spark(d.x + (Math.random() - 0.5) * 0.6, d.y + (Math.random() - 0.5) * 0.6, -1.57, 1, 1.2, '#ff8a3a', 0.4, 0.8); }
      if (d.st && d.st.soaked && Math.random() < 0.25) spark(d.x + (Math.random() - 0.5) * 0.7, d.y, 1.57, 1, 0.6, '#8fc8f0', 0.35, 0.8); }
    fx.globalAlpha = 1;
    // [m2] the names of reactions float up and fade
    fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.lineJoin = 'round';
    for (let i = words.length - 1; i >= 0; i--) { const w = words[i]; w.t += dt; if (w.t > 1.1) { words.splice(i, 1); continue; } const [x, y] = toS(w.x, w.y);
      fx.globalAlpha = Math.min(1, (1.1 - w.t) * 2); fx.font = `800 ${w.text === 'clash' ? 11 : 14}px "IBM Plex Mono", ui-monospace, monospace`; fx.strokeStyle = 'rgba(8,8,10,.9)'; fx.lineWidth = 4; fx.strokeText(w.text, x, y - ppm * 1.4 - w.t * 26 - w.dy); fx.fillStyle = w.col; fx.fillText(w.text, x, y - ppm * 1.4 - w.t * 26 - w.dy); }
    fx.globalAlpha = 1;
    for (let i = rings.length - 1; i >= 0; i--) { const g = rings[i]; g.t += dt; const k = g.t / (g.big ? 0.6 : 0.3); if (k >= 1) { rings.splice(i, 1); continue; }
      const [x, y] = toS(g.x, g.y); fx.strokeStyle = g.col || `rgba(255,${g.big ? 120 : 220},${g.big ? 70 : 150},1)`; fx.globalAlpha = 1 - k; fx.lineWidth = Math.max(1.5, ppm * 0.08 * (1 - k)); fx.beginPath(); fx.arc(x, y, ppm * (g.big ? 4 : 1.4) * (0.3 + k), 0, 6.283); fx.stroke(); fx.globalAlpha = 1; }
  }
  return { events, frozen, shake, draw };
}
