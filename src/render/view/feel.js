// Feel and fx hooks: ground rings, construction dust, confetti and floating labels (pooled in fx.js), hit-stop,
// trauma (camera shake) and the flares' light.
export function createFeel(V) {
  const { S, look, fx2, W } = V;
  // building something is a small celebration: confetti and a label that floats up (pooled: fx.js)
  function celebrate(x, y, label) { const p = W(x, y, 0.6); fx2.emit('confetti', p.x, p.y, p.z, 28); if (label) { const q = W(x, y, 2.3); fx2.label(q.x, q.y, q.z, label, '#ffd166', { size: 0.42, life: 1.7 }); } }
  function floatLabel(x, y, text, col) { const p = W(x, y, 1.3); fx2.label(p.x, p.y, p.z, text, col); }
  // construction dust rolling out from the footprint, and ground rings (pooled: fx.js)
  function dust(x, y, n) { const p = W(x, y, 0.12); fx2.emit('dust', p.x, p.y, p.z, 8 + n * 4, { spread: n * 0.42, size: 0.8 + n * 0.15 }); burst(x, y, 0.6 + n * 0.5, '#e08a3c'); }
  function burst(x, y, r, color) { const p = W(x, y, 0.08); fx2.ring(p.x, p.y, p.z, Math.max(0.5, 0.35 + r * 0.8), color, 0.45 + Math.min(0.35, r * 0.04)); }

  // ---- feel: hit-stop (render side, at most once per 250 ms) and trauma camera shake ----
  let hitStop = 0, lastStop = -1, trauma = 0;
  function hitStopFor(s) { if (V.time - lastStop < 0.25) return; hitStop = s; lastStop = V.time; }
  function shake(t) { trauma = Math.min(1, trauma + t); }
  let mobMap = new Map(), mobMapT = -1;
  function mobOf(id) { if (mobMapT !== V.time) { mobMapT = V.time; mobMap.clear(); for (const m of S.mobs) mobMap.set(m.id, m); } return mobMap.get(id); }
  V.flares = [];   // flares light the night for e.dur seconds (painted by lights.js)

  /** start of a frame: a hit-stop holds the animation clock; trauma and the hit vignette decay. Returns frozen. */
  function tick(dt) {
    const frozen = hitStop > 0; if (frozen) hitStop -= dt; else V.animT += dt;
    trauma = Math.max(0, trauma - 1.6 * dt); look.fx.hit = Math.max(0, look.fx.hit - dt * 2.6);
    return frozen;
  }
  return { celebrate, floatLabel, dust, burst, hitStopFor, shake, mobOf, tick, trauma: () => trauma };
}
