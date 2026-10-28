// [medium] The One-medium look, each frame: the clock and the night for the strands, the glyph cell (3 css px), the
// pixel size of a metre (so strands coarsen when zoomed out instead of aliasing), what pushes the strands aside
// (Kai and the nearest dead) and the Trample atom: where feet pressed the grass, fading back over half a minute.
// Render only: reads the state, never writes it. Off with ?look=classic.
/* global THREE */
import { MEDIUM, MU, setCell } from '../medium.js';

export function createMedium(V) {
  if (!MEDIUM) return null;
  const { S, map, canvas, Wv } = V, N = map.N || Math.round(Math.sqrt(map.terrain.length));
  // the trample field: one texel a metre over the whole map
  const pc = document.createElement('canvas'); pc.width = pc.height = N; const px = pc.getContext('2d'); px.fillStyle = '#000'; px.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(pc); tex.flipY = false; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  MU.mPress.value = tex; MU.mPressN.value = N; MU.mPressO.value = N / 2;
  let acc = 0; const last = new Map();   // where each of the dead stood at the last stamp (only walkers press the grass)
  function trample(dt) {
    if ((acc += dt) < 0.15) return; const k = acc; acc = 0;
    px.globalCompositeOperation = 'source-over'; px.fillStyle = `rgba(0,0,0,${Math.min(1, k / 25)})`; px.fillRect(0, 0, N, N);
    const dot = (x, y, r, a) => { px.fillStyle = `rgba(255,255,255,${a})`; px.beginPath(); px.arc(x, y, r, 0, 7); px.fill(); };
    const seen = new Set();
    for (const m of S.mobs) { seen.add(m.id); const p = last.get(m.id); if (p && Math.hypot(m.x - p.x, m.y - p.y) > 0.02) dot(m.x, m.y, 0.6, 0.5); if (p) { p.x = m.x; p.y = m.y; } else last.set(m.id, { x: m.x, y: m.y }); }
    for (const id of last.keys()) if (!seen.has(id)) last.delete(id);
    if (!S.hero.dead) dot(S.hero.x, S.hero.y, 0.45, 0.25);
    tex.needsUpdate = true;
  }
  const v = new THREE.Vector3();
  function update(dt) {
    MU.mTime.value = V.time; MU.mNight.value = V.dark;
    const pr = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
    setCell(Math.max(3, Math.round(3 * pr)));
    const half = V.cam && V.cam.half; if (half && half.w > 0) MU.mPxM.value = canvas.width / (2 * half.w);
    // what parts the strands: Kai, then the nearest risen dead
    const P = MU.mPush.value, h = S.hero; let n = 0;
    if (!h.dead) { v.copy(Wv(h.x, h.y)); P[n++].set(v.x, v.z, 1.3, 0); }
    const near = S.mobs.filter(m => (m.rise ?? 1) >= 1).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    for (const m of near) { if (n >= P.length) break; v.copy(Wv(m.x, m.y)); P[n++].set(v.x, v.z, 0.9, 0); }
    for (; n < P.length; n++) P[n].set(1e5, 1e5, 0, 0);
    trample(dt);
  }
  return { update };
}
