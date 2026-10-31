// [roam] The glow-up (render-side, M4): a clean area comes back to life. Its cells go into a small map over the whole
// town (8 m a texel, from the sim's area grid); the ground shader ([glowup] in medium.js) lets a clean area's windows and
// street lamps come on at night and its grass green up by day, and a ring of light sweeps out from where the walker
// fell, spreading the change as it passes. The rules never read this; it reads the 'clean' events and S.areas.
/* global THREE */
export function createGlowUp({ U, town }) {
  let tex = null, data = null, G0 = null; const sweeps = [];
  Object.assign(U, { tClean: { value: null }, uSweep: { value: new THREE.Vector4(-1e5, -1e5, 0, 0) } });
  function build(S) { G0 = S.areaGrid; data = new Uint8Array(G0.gw * G0.gh * 4); tex = new THREE.DataTexture(data, G0.gw, G0.gh, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; U.tClean.value = tex; paint(S, 0); }
  // a clean area's cells light up; during a sweep only as far as the ring has gone
  function paint(S, t) { const { gw, gh, cell, ids } = G0;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = ids[j * gw + i]; let v = 0;
      if (k >= 0 && S.areas[k].state === 'clean') { v = 255; const sw = sweeps.find(q => q.area === k); if (sw) { const d = Math.hypot((i + 0.5) * cell - sw.x, (j + 0.5) * cell - sw.y), r = (t - sw.t0) * sw.speed; v = Math.round(255 * Math.max(0, Math.min(1, (r - d) / 30))); } }
      data[(j * gw + i) * 4] = v; }
    tex.needsUpdate = true; }
  function events(evs, S, t) { for (const e of evs) if (e.type === 'clean') sweeps.push({ area: e.area, x: e.x, y: e.y, t0: t, speed: 70 }); }
  function update(S, t) { if (!S.areaGrid) return; if (!tex) build(S);
    for (let i = sweeps.length - 1; i >= 0; i--) if ((t - sweeps[i].t0) * sweeps[i].speed > 900) sweeps.splice(i, 1);
    if (sweeps.length) { const sw = sweeps[sweeps.length - 1]; U.uSweep.value.set(sw.x, sw.y, (t - sw.t0) * sw.speed, Math.max(0, 1 - (t - sw.t0) / 10)); paint(S, t); }
    else if (U.uSweep.value.w !== 0) { U.uSweep.value.w = 0; paint(S, t); } }
  return { events, update };
}
