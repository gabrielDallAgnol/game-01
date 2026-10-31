// [roam] How the atoms look (render-side; docs/design/atomic-engineering.md): each frame the atom world's state around
// the camera goes into two small maps, one texel a metre, and the ground shader (medium.js, [atoms-look]) lets every
// surface answer them by its own nature: a burning crown, roof or patch of grass glows cell by cell and lights what is
// near; smoke drifts downwind; water films over asphalt but soaks into grass; oil is a glossy film on tarmac and a stain
// on grass. No effect is drawn on top: the atoms themselves change.
//   tAtom:  r fire on the ground (grass, crops, oil) · g fire in a solid (a crown, a roof, a wreck) · b wet · a fresh oil
//   tAtom2: r steam · g fog · b light (a blast's flash, a muzzle, a hit) · a open flame (a thrower's jet, a rocket's exhaust)
//   tAtom3: r smoke put out directly (a rocket's trail, a blast, dust off a wall) · g heat not yet burning (scorching)
//           · b a projectile's light trail · a its hue (amber .1, ember .35, blue .65, red .95)
// The guns paint here too: a thrower's spray is fire (or water and mist) on the atoms it passes; a rocket's exhaust glows.
/* global THREE */
export const AN = 256;   // texels a side (one a metre)
export function createAtomLook({ U, town }) {
  const d1 = new Uint8Array(AN * AN * 4), d2 = new Uint8Array(AN * AN * 4), d3 = new Uint8Array(AN * AN * 4);
  const mk = d => { const t = new THREE.DataTexture(d, AN, AN, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  const t1 = mk(d1), t2 = mk(d2), t3 = mk(d3);
  Object.assign(U, { tAtom: { value: t1 }, tAtom2: { value: t2 }, tAtom3: { value: t3 }, uAtomO: { value: new THREE.Vector2(-1e5, -1e5) }, uAtomS: { value: AN } });
  const CH = town.chars, cw = CH ? CH.w : 1, cell = CH ? CH.cell : 2;
  const puffs = [];   // short-lived: a blast's flash, the steam off a fire put out
  function events(evs) { for (const e of evs) {
    if (e.type === 'blast') puffs.push({ x: e.x, y: e.y, r: e.r * 1.6, d: d2, ch: 2, life: 0.35, t: 0 }, { x: e.x, y: e.y, r: e.r * 1.1, d: d3, ch: 0, life: 4, t: 0, grow: 1.2 });
    else if (e.type === 'doused') puffs.push({ x: e.x, y: e.y, r: 2.2, d: d2, ch: 0, life: 2.6, t: 0, grow: 0.5 });
    // the guns: a muzzle lights the ground for a blink (a rocket's longer), a hit lights the machine
    else if (e.type === 'shot' && e.base !== 'thrower') { const mx = e.x + Math.cos(e.ang) * 1.3, my = e.y + Math.sin(e.ang) * 1.3, big = e.base === 'launcher';
      puffs.push({ x: mx, y: my, r: big ? 3 : 2.2, d: d2, ch: 2, life: big ? 0.14 : 0.07, t: 0 }); if (big) puffs.push({ x: e.x, y: e.y, r: 1.6, d: d3, ch: 0, life: 2, t: 0, grow: 0.8 }); }
    else if (e.type === 'hit') puffs.push({ x: e.x, y: e.y, r: 1, d: d2, ch: 2, life: 0.05, t: 0 });
    else if (e.type === 'spark') puffs.push({ x: e.x, y: e.y, r: 0.8, d: d3, ch: 0, life: 0.7, t: 0, v: 0.5 }); } }
  let ox = 0, oy = 0, trailN = 0;
  // put v (0..1) into a channel over a disc (soft edge) or a rotated box, keeping the strongest
  const put = (d, ch, i, j, v) => { if (i < 0 || j < 0 || i >= AN || j >= AN) return; const k = (j * AN + i) * 4 + ch, b = Math.round(Math.min(1, v) * 255); if (b > d[k]) d[k] = b; };
  function disc(d, ch, x, y, r, v, soft = 0.35) { const i0 = Math.floor(x - r - ox), i1 = Math.ceil(x + r - ox), j0 = Math.floor(y - r - oy), j1 = Math.ceil(y + r - oy);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const q = Math.hypot(i + ox + 0.5 - x, j + oy + 0.5 - y) / Math.max(r, 0.5); if (q < 1) put(d, ch, i, j, v * Math.min(1, (1 - q) / soft)); } }
  function box(d, ch, o, v) { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), R = Math.hypot(o.w, o.h) / 2, i0 = Math.floor(o.x - R - ox), i1 = Math.ceil(o.x + R - ox), j0 = Math.floor(o.y - R - oy), j1 = Math.ceil(o.y + R - oy);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dx = i + ox + 0.5 - o.x, dy = j + oy + 0.5 - o.y; if (Math.abs(dx * c + dy * s) <= o.w / 2 && Math.abs(-dx * s + dy * c) <= o.h / 2) put(d, ch, i, j, v); } }
  function update(S, cam, dt) {
    ox = Math.floor((cam.x - AN / 2) / cell) * cell; oy = Math.floor((cam.y - AN / 2) / cell) * cell; U.uAtomO.value.set(ox, oy);
    d1.fill(0); d2.fill(0); d3.fill(0);
    // the ground's cells (2 m): burning (dimmer as the fuel runs out), wet, hot
    if (S.cells) for (const [c, s] of S.cells) { const x0 = (c % cw) * cell, y0 = Math.floor(c / cw) * cell; if (x0 < ox - cell || y0 < oy - cell || x0 > ox + AN || y0 > oy + AN) continue;
      const fire = s.burn ? Math.min(1, 0.3 + s.burn / 1.4) : 0, wet = Math.min(1, s.wet / 5), heat = s.burn ? 0 : Math.min(1, s.heat);
      for (let b = 0; b < cell; b++) for (let a = 0; a < cell; a++) { const i = x0 + a - ox, j = y0 + b - oy; if (fire) put(d1, 0, i, j, fire); if (wet) put(d1, 2, i, j, wet); if (heat > 0.05) put(d3, 1, i, j, heat); } }
    // the placed atoms: crowns, roofs, wrecks, bales burning; wet ones; fresh oil
    if (S.atoms) for (const a of S.atoms) { if (a.state === 'ok' && !(a.wet > 0) && !(a.heat > 0.05) && !a.slick) continue; if (a.state === 'done' && !a.wreck) continue;
      if (a.x < ox - 15 || a.y < oy - 15 || a.x > ox + AN + 15 || a.y > oy + AN + 15) continue;
      const r = a.kind === 'tree' ? a.r / 0.8 : a.r;
      if (a.state === 'burning') { const v = Math.min(1, 0.3 + a.fuel / 3); if (a.obb) box(d1, 1, a.obb, v); else disc(d1, 1, a.x, a.y, r, v); }
      if (a.wet > 0) { const v = Math.min(1, a.wet / 5); if (a.obb) box(d1, 2, a.obb, v); else disc(d1, 2, a.x, a.y, r, v); }
      if (a.slick && a.state === 'ok') disc(d1, 3, a.x, a.y, a.r, Math.min(1, a.life / 6), 0.25);
      if (a.state === 'ok' && a.heat > 0.05 && !a.obb) disc(d3, 1, a.x, a.y, r, Math.min(1, a.heat / 4)); }
    // projectiles leave light in the cells they cross: a short trail behind each, brightest at the head
    const trail = (x, y, vx, vy, len, hue) => { const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, n = Math.ceil(len / 0.4);
      for (let k = 0; k <= n; k++) { const q = k / n, px = x - ux * len * q, py = y - uy * len * q; disc(d3, 2, px, py, 1.1, (1 - q) * 0.35, 1); disc(d3, 3, px, py, 1.8, hue, 0.01); } };
    for (const p of S.shots || []) if (p.del === 'pellet' || !p.del) trail(p.x, p.y, p.vx, p.vy, 2.4, p.el === 'fire' ? 0.35 : p.el === 'water' ? 0.65 : 0.1);
    for (const b of S.bolts || []) trail(b.x, b.y, b.vx, b.vy, 1.8, 0.95);
    // the guns' shots: a thrower's drops are flame (or water and its mist) on what they pass; a rocket's exhaust glows
    // and leaves a smoke trail
    for (const p of S.shots || []) {
      // a jet widens and cools as it travels (a tight white-yellow core at the nozzle, an orange tongue at its end, smoke round it)
      if (p.del === 'stream') { const q = Math.hypot(p.x - p.ox, p.y - p.oy), rr = 1 + 0.16 * q;   // (at least a texel of the 1 m map)
        if (p.el === 'water') { disc(d1, 2, p.x, p.y, rr, 1); disc(d2, 1, p.x, p.y, rr * 1.2, 0.85, 0.8); }
        else { disc(d2, 3, p.x, p.y, rr, Math.max(0.35, 1 - q / 9), 0.75); if (q > 3) disc(d3, 0, p.x, p.y, rr * 1.5, 0.2, 0.9); } }
      else if (p.del === 'splash') { const sp = Math.hypot(p.vx, p.vy) || 1, bx = p.x - p.vx / sp * 0.5, by = p.y - p.vy / sp * 0.5; disc(d2, 3, bx, by, 1, 0.6, 0.8);
        if ((trailN = (trailN + 1) % 2) === 0) puffs.push({ x: bx, y: by, r: 0.7, d: d3, ch: 0, life: 1.6, t: 0, grow: 1, v: 0.8 }); } }
    // clouds from reactions: scalding steam and fog, thinning as they fade
    for (const c of S.clouds || []) disc(d2, c.kind === 'fog' ? 1 : 0, c.x, c.y, c.r, Math.min(1, c.left / 1.2) * Math.min(1, (c.dur - c.left) / 0.3 + 0.3), 0.6);
    for (let k = puffs.length - 1; k >= 0; k--) { const p = puffs[k]; p.t += dt; if (p.t >= p.life) { puffs.splice(k, 1); continue; } const f = 1 - p.t / p.life;
      disc(p.d, p.ch, p.x, p.y, p.r * (1 + (p.grow || 0) * (1 - f)), f * (p.v || 1), 0.6); }
    if (puffs.length > 200) puffs.splice(0, puffs.length - 200);
    t1.needsUpdate = true; t2.needsUpdate = true; t3.needsUpdate = true; }
  return { update, events };
}
