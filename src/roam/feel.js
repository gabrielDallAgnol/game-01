// [roam] The feel (render-side only, it never touches the rules): a hitstop that holds the sim for a few frames on a kill,
// a camera shake on kills, hits taken and crashes, and the overlay's quick things: pellets with streaks, the muzzle flash,
// sparks off hits and walls, a machine's burst of bolts and a flash ring when it dies. Sakurai: freeze big moments.
import { ELEMENTS } from '../play/elements.js';
import { REACTIONS, CLASH } from '../play/reactions.js';
export function createFeel({ S, input, town }) {
  const CH = town && town.chars, cw = CH ? CH.w : 1, cell = CH ? CH.cell : 2;
  let stop = 0, shakeAmt = 0, flash = null; const kick = { x: 0, y: 0 }, KICK = { scatter: 0.1, launcher: 0.3, thrower: 0.02 }, pops = [], seen = new Map();
  const parts = Array.from({ length: 220 }, () => ({ life: 0 })); let pi = 0;
  const rings = [], words = [];   // [m2] a reaction's name floats up where it happened (Sakurai: praise the player)
  const spark = (x, y, a, n, sp, col, life, size = 1) => { for (let i = 0; i < n; i++) { const p = parts[pi++ % parts.length], aa = a + (Math.random() - 0.5) * 1.8, v = sp * (0.4 + Math.random());
    Object.assign(p, { x, y, z: 0.5 + Math.random() * 0.4, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, vz: 1 + Math.random() * 3, life: life * (0.6 + Math.random() * 0.6), life0: life, col, size }); } };
  function events(evs, t) {
    for (const e of evs) {
      if (e.type === 'shot') { const K = KICK[e.base] ?? 0.2; kick.x -= Math.cos(e.ang) * K; kick.y -= Math.sin(e.ang) * K; shakeAmt = Math.min(1, shakeAmt + K * 0.35);
        if (e.base === 'scatter' || !e.base) spark(S.kai.x, S.kai.y, e.ang + Math.PI / 2 + (Math.random() - 0.5) * 0.6, 1, 2.4, '#c9a24a', 2.2, 1.6);   // a spent shell flies out and lies a while
        continue; flash = { x: S.kai.x + Math.cos(e.ang) * 0.9, y: S.kai.y + Math.sin(e.ang) * 0.9, ang: e.ang, t: e.base === 'launcher' ? 0.1 : 0.06 }; }
      else if (e.type === 'hit') { pops.push({ x: e.x, y: e.y, ang: e.ang, t: 0, col: e.el === 'water' ? '#9fd4ff' : e.el === 'fire' ? '#ffa04a' : '#ffe08a', big: 1 }); spark(e.x, e.y, e.ang, 5, 8, '#ffd27a', 0.22); }
      else if (e.type === 'spark') { pops.push({ x: e.x, y: e.y, ang: Math.random() * 6.28, t: 0, col: '#d8d0bc', big: 0.7 }); spark(e.x, e.y, Math.random() * 6.28, 3, 3, '#b8b2a0', 0.3, 0.9); }
      else if (e.type === 'die' && (e.src === 'gun' || e.src === 'bike')) { stop = Math.max(stop, 0.055); shakeAmt = Math.min(0.9, shakeAmt + 0.28);
        spark(e.x, e.y, Math.random() * 6.28, 14, 6, '#c9c4b6', 0.6, 1.2); spark(e.x, e.y, Math.random() * 6.28, 6, 4, '#ff5a3a', 0.45, 1); rings.push({ x: e.x, y: e.y, t: 0 }); }
      else if (e.type === 'spit') spark(e.x + Math.cos(e.ang) * 0.6, e.y + Math.sin(e.ang) * 0.6, e.ang, 5, 4, '#ff8a3a', 0.25);
      else if (e.type === 'boltPop') spark(e.x, e.y, Math.random() * 6.28, 6, 3, '#ff6a2a', 0.3);
      else if (e.type === 'boltHit') { spark(e.x, e.y, Math.random() * 6.28, 10, 5, '#ff6a2a', 0.4); stop = Math.max(stop, 0.04); }
      else if (e.type === 'reaction') { const Rx = REACTIONS[e.id] || CLASH; words.push({ x: e.x, y: e.y, text: Rx.id === 'clash' ? 'clash' : Rx.id.toUpperCase(), col: Rx.color, t: 0, dy: words.filter(w => Math.hypot(w.x - e.x, w.y - e.y) < 3 && w.t < 0.8).length * 16 });
        rings.push({ x: e.x, y: e.y, t: 0, big: e.id === 'blaze', col: Rx.color }); spark(e.x, e.y, Math.random() * 6.28, e.id === 'blaze' ? 18 : 8, e.id === 'blaze' ? 7 : 4, Rx.color, 0.5, 1.1);
        if (e.id === 'blaze') { stop = Math.max(stop, 0.07); shakeAmt = Math.min(1, shakeAmt + 0.5); } }
      else if (e.type === 'blast') { stop = Math.max(stop, 0.06); shakeAmt = Math.min(1, shakeAmt + (e.r > 4 ? 0.9 : 0.45)); }   // the flash and the smoke are the atoms' (atomlook.js)
      else if (e.type === 'hurt') shakeAmt = Math.min(1, shakeAmt + 0.45);
      else if (e.type === 'crash') shakeAmt = Math.min(1, shakeAmt + 0.4);
      else if (e.type === 'nestHit') shakeAmt = Math.min(0.6, shakeAmt + 0.05);
      else if (e.type === 'nestDown') { stop = 0.12; shakeAmt = 1; rings.push({ x: e.x, y: e.y, t: 0, big: true }); }
    }
  }
  const frozen = dt => { if (stop > 0) { stop -= dt; return true; } return false; };
  function shake(cam, dt) { const kk = Math.exp(-dt * 14); kick.x *= kk; kick.y *= kk; const ox = (Math.random() - 0.5) * shakeAmt * 0.5 + kick.x, oy = (Math.random() - 0.5) * shakeAmt * 0.5 + kick.y; cam.x += ox; cam.y += oy; shakeAmt *= Math.exp(-dt * 9); return () => { cam.x -= ox; cam.y -= oy; }; }
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
    // [m3c] bullets, Enter the Gungeon style: big enough to read, a pill with a dark outline (it reads on grass, tarmac and
    // fire alike), a bright body in the shot's colour and a white-hot core; on its first frame it's a fat circle (the muzzle
    // flash, Vlambeer's trick); a short soft trail. A thrower's spray and a rocket are the atoms' (atomlook.js, medium.js)
    const now = performance.now() / 1000;
    for (const p of S.shots) { if (p.del === 'stream' || p.del === 'splash') continue; const [x, y] = toS(p.x, p.y); if (!on(x, y)) continue;
      if (!seen.has(p.id)) seen.set(p.id, now); const age = now - seen.get(p.id), sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
      const body = p.el === 'water' ? '#7cc4ff' : p.el === 'fire' ? '#ff8a2a' : '#ffd23a', glow = p.el === 'water' ? '120,190,255' : p.el === 'fire' ? '255,120,40' : '255,200,70';
      const R = Math.max(3.2, ppm * 0.16);
      if (age < 0.04) { fx.fillStyle = 'rgba(12,10,8,.85)'; fx.beginPath(); fx.arc(x, y, R * 2.1 + 1.5, 0, 6.283); fx.fill(); fx.fillStyle = '#fff6dc'; fx.beginPath(); fx.arc(x, y, R * 2.1, 0, 6.283); fx.fill(); continue; }
      for (let k = 3; k >= 1; k--) { const [tx, ty] = toS(p.x - p.vx * 0.022 * k, p.y - p.vy * 0.022 * k); fx.globalAlpha = 0.22 * (1 - k / 4); fx.fillStyle = `rgb(${glow})`; fx.beginPath(); fx.arc(tx, ty, R * (1 - k * 0.15), 0, 6.283); fx.fill(); }
      fx.globalAlpha = 1; const L = R * 1.5, hx = ux * L, hy = uy * L;
      fx.lineCap = 'round'; fx.strokeStyle = 'rgba(12,10,8,.9)'; fx.lineWidth = R * 2 + 3; fx.beginPath(); fx.moveTo(x - hx, y - hy); fx.lineTo(x + hx * 0.6, y + hy * 0.6); fx.stroke();
      fx.strokeStyle = body; fx.lineWidth = R * 2; fx.beginPath(); fx.moveTo(x - hx, y - hy); fx.lineTo(x + hx * 0.6, y + hy * 0.6); fx.stroke();
      fx.strokeStyle = '#fffbe8'; fx.lineWidth = R * 0.8; fx.beginPath(); fx.moveTo(x - hx * 0.3, y - hy * 0.3); fx.lineTo(x + hx * 0.55, y + hy * 0.55); fx.stroke(); }
    if (seen.size > 400) for (const k of seen.keys()) { if (!S.shots.some(p => p.id === k)) seen.delete(k); }
    // impact pops: a ring that snaps open and a burst of short strokes, in the bullet's colour (Gungeon's bullet pop)
    for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.t += dt; const k = q.t / 0.16; if (k >= 1) { pops.splice(i, 1); continue; } const [x, y] = toS(q.x, q.y), R = ppm * 0.45 * q.big;
      fx.globalAlpha = 1 - k; fx.strokeStyle = 'rgba(12,10,8,.8)'; fx.lineWidth = 4; fx.beginPath(); fx.arc(x, y, R * (0.4 + k), 0, 6.283); fx.stroke(); fx.strokeStyle = q.col; fx.lineWidth = 2.2; fx.beginPath(); fx.arc(x, y, R * (0.4 + k), 0, 6.283); fx.stroke();
      if (k < 0.5) { fx.fillStyle = '#fff6dc'; fx.beginPath(); fx.arc(x, y, R * 0.45 * (1 - k * 2), 0, 6.283); fx.fill(); }
      for (let j = 0; j < 5; j++) { const a = q.ang + Math.PI + (j - 2) * 0.55, r0 = R * (0.5 + k * 1.2), r1 = r0 + R * 0.5 * (1 - k); fx.beginPath(); fx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); fx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); fx.stroke(); } }
    fx.globalAlpha = 1;
    if (flash && (flash.t -= dt) > 0) { const [x, y] = toS(flash.x, flash.y), r = ppm * 0.5; fx.save(); fx.translate(x, y); fx.rotate(flash.ang); fx.fillStyle = 'rgba(255,214,120,.85)';
      fx.beginPath(); fx.moveTo(0, -r * 0.35); fx.lineTo(r * 1.3, 0); fx.lineTo(0, r * 0.35); fx.closePath(); fx.fill(); fx.restore(); }
    for (const p of parts) { if (p.life <= 0) continue; p.life -= dt; p.vz -= 9 * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vx *= 0.4; p.vy *= 0.4; p.vz *= -0.3; }
      p.x += p.vx * dt; p.y += p.vy * dt; const [x, y] = toS(p.x, p.y - p.z * 0.5); if (!on(x, y)) continue;
      fx.globalAlpha = Math.min(1, p.life / p.life0 * 2); fx.fillStyle = p.col; const s = Math.max(1, ppm * 0.07 * p.size); fx.fillRect(x - s / 2, y - s / 2, s, s); }
    fx.globalAlpha = 1;
    // [atoms] fire, smoke, water, oil, steam and fog are not drawn here: the atoms show them in the ground shader (atomlook.js)
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
