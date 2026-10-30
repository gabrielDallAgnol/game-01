// [roam] How the atoms look (render-side; docs/design/atomic-engineering.md): each frame the atom world's state around
// the camera goes into two small maps, one texel a metre, and the ground shader (medium.js, [atoms-look]) lets every
// surface answer them by its own nature: a burning crown, roof or patch of grass glows cell by cell and lights what is
// near; smoke drifts downwind; water films over asphalt but soaks into grass; oil is a glossy film on tarmac and a stain
// on grass. No effect is drawn on top: the atoms themselves change.
//   tAtom:  r fire on the ground (grass, crops, oil) · g fire in a solid (a crown, a roof, a wreck) · b wet · a fresh oil
//   tAtom2: r steam · g fog · b a blast's flash · a heat not yet burning (scorching)
/* global THREE */
export const AN = 256;   // texels a side (one a metre)
export function createAtomLook({ U, town }) {
  const d1 = new Uint8Array(AN * AN * 4), d2 = new Uint8Array(AN * AN * 4);
  const mk = d => { const t = new THREE.DataTexture(d, AN, AN, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  const t1 = mk(d1), t2 = mk(d2);
  Object.assign(U, { tAtom: { value: t1 }, tAtom2: { value: t2 }, uAtomO: { value: new THREE.Vector2(-1e5, -1e5) }, uAtomS: { value: AN } });
  const CH = town.chars, cw = CH ? CH.w : 1, cell = CH ? CH.cell : 2;
  const puffs = [];   // short-lived: a blast's flash, the steam off a fire put out
  function events(evs) { for (const e of evs) {
    if (e.type === 'blast') puffs.push({ x: e.x, y: e.y, r: e.r * 1.4, ch: 2, life: 0.35, t: 0 }, { x: e.x, y: e.y, r: e.r * 0.8, ch: 0, life: 1.6, t: 0, smoke: true });
    else if (e.type === 'doused') puffs.push({ x: e.x, y: e.y, r: 2.2, ch: 0, life: 2.6, t: 0 }); } }
  let ox = 0, oy = 0;
  // put v (0..1) into a channel over a disc (soft edge) or a rotated box, keeping the strongest
  const put = (d, ch, i, j, v) => { if (i < 0 || j < 0 || i >= AN || j >= AN) return; const k = (j * AN + i) * 4 + ch, b = Math.round(Math.min(1, v) * 255); if (b > d[k]) d[k] = b; };
  function disc(d, ch, x, y, r, v, soft = 0.35) { const i0 = Math.floor(x - r - ox), i1 = Math.ceil(x + r - ox), j0 = Math.floor(y - r - oy), j1 = Math.ceil(y + r - oy);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const q = Math.hypot(i + ox + 0.5 - x, j + oy + 0.5 - y) / Math.max(r, 0.5); if (q < 1) put(d, ch, i, j, v * Math.min(1, (1 - q) / soft)); } }
  function box(d, ch, o, v) { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), R = Math.hypot(o.w, o.h) / 2, i0 = Math.floor(o.x - R - ox), i1 = Math.ceil(o.x + R - ox), j0 = Math.floor(o.y - R - oy), j1 = Math.ceil(o.y + R - oy);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dx = i + ox + 0.5 - o.x, dy = j + oy + 0.5 - o.y; if (Math.abs(dx * c + dy * s) <= o.w / 2 && Math.abs(-dx * s + dy * c) <= o.h / 2) put(d, ch, i, j, v); } }
  function update(S, cam, dt) {
    ox = Math.floor((cam.x - AN / 2) / cell) * cell; oy = Math.floor((cam.y - AN / 2) / cell) * cell; U.uAtomO.value.set(ox, oy);
    d1.fill(0); d2.fill(0);
    // the ground's cells (2 m): burning (dimmer as the fuel runs out), wet, hot
    if (S.cells) for (const [c, s] of S.cells) { const x0 = (c % cw) * cell, y0 = Math.floor(c / cw) * cell; if (x0 < ox - cell || y0 < oy - cell || x0 > ox + AN || y0 > oy + AN) continue;
      const fire = s.burn ? Math.min(1, 0.3 + s.burn / 1.4) : 0, wet = Math.min(1, s.wet / 5), heat = s.burn ? 0 : Math.min(1, s.heat);
      for (let b = 0; b < cell; b++) for (let a = 0; a < cell; a++) { const i = x0 + a - ox, j = y0 + b - oy; if (fire) put(d1, 0, i, j, fire); if (wet) put(d1, 2, i, j, wet); if (heat > 0.05) put(d2, 3, i, j, heat); } }
    // the placed atoms: crowns, roofs, wrecks, bales burning; wet ones; fresh oil
    if (S.atoms) for (const a of S.atoms) { if (a.state === 'ok' && !(a.wet > 0) && !(a.heat > 0.05) && !a.slick) continue; if (a.state === 'done' && !a.wreck) continue;
      if (a.x < ox - 15 || a.y < oy - 15 || a.x > ox + AN + 15 || a.y > oy + AN + 15) continue;
      const r = a.kind === 'tree' ? a.r / 0.8 : a.r;
      if (a.state === 'burning') { const v = Math.min(1, 0.3 + a.fuel / 3); if (a.obb) box(d1, 1, a.obb, v); else disc(d1, 1, a.x, a.y, r, v); }
      if (a.wet > 0) { const v = Math.min(1, a.wet / 5); if (a.obb) box(d1, 2, a.obb, v); else disc(d1, 2, a.x, a.y, r, v); }
      if (a.slick && a.state === 'ok') disc(d1, 3, a.x, a.y, a.r, Math.min(1, a.life / 6), 0.25);
      if (a.state === 'ok' && a.heat > 0.05 && !a.obb) disc(d2, 3, a.x, a.y, r, Math.min(1, a.heat / 4)); }
    // clouds from reactions: scalding steam and fog, thinning as they fade
    for (const c of S.clouds || []) disc(d2, c.kind === 'fog' ? 1 : 0, c.x, c.y, c.r, Math.min(1, c.left / 1.2) * Math.min(1, (c.dur - c.left) / 0.3 + 0.3), 0.6);
    for (let k = puffs.length - 1; k >= 0; k--) { const p = puffs[k]; p.t += dt; if (p.t >= p.life) { puffs.splice(k, 1); continue; } const f = 1 - p.t / p.life;
      if (p.smoke) disc(d1, 1, p.x, p.y, p.r, f * 0.9, 0.6); else disc(d2, p.ch, p.x, p.y, p.r * (p.ch === 0 ? 0.7 + 0.5 * (1 - f) : 1), f, 0.6); }
    t1.needsUpdate = true; t2.needsUpdate = true; }
  return { update, events };
}
