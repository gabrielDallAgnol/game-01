// [roam] The chemistry in the world. Machines: elemental hits add pips (play/hit.js); fire pips burn, water pips slow;
// reactions leave statuses (soaked, blind), steam/fog clouds blind what's inside. The ground (the char map's 2 m cells):
// grass, crops, the woods floor and trees catch fire and the fire spreads, more with the wind, and burns out to ash that
// never burns again; water soaks the ground for a while (wet cells don't burn and put fire out). Oil: the town's old
// stains and the slicks machines leak burst into flame. A machine standing in fire picks up fire pips; soaked ground
// slows it and puts its fire pips out (but gives no pips: wet ground setting off soaks that wet more ground would loop).
// Kai is never hurt by her own fire. Its own Rng stream.
// Offers G.hitElement(d, el), G.shotLanded(x0, y0, x1, y1, el, end), G.stepChem(dt).
import { Rng, hashSeed } from '../../sim/rng.js';
import { addPip, addStatus } from '../../play/hit.js';
import { PIPS, STATUSES } from '../../play/statuses.js';
export function createChem(G) {
  const { R, S, ev, town } = G, C = R.chem, rng = new Rng(hashSeed(G.seed, 'chem')), CH = town.chars;
  S.clouds = []; S.grounds = []; S.fire = new Map(); S.wet = new Map(); S.burnt = new Set(); let oid = 1;
  S.oil = (town.dress ? town.dress.list : []).filter(i => i.atom.id === 'oil').map(i => ({ id: oid++, x: i.x, y: i.y, r: C.stainR }));
  const cw = CH ? CH.w : 0, cell = CH ? CH.cell : 2, cellOf = (x, y) => CH ? Math.floor(y / cell) * cw + Math.floor(x / cell) : -1, centre = c => [(c % cw + 0.5) * cell, (Math.floor(c / cw) + 0.5) * cell];
  const BURN = C.burn;   // char → seconds a cell burns (anything not listed doesn't burn)
  const fuel = c => { if (!CH || c < 0 || c >= CH.codes.length || S.burnt.has(c) || S.wet.has(c)) return 0; return BURN[String.fromCharCode(CH.codes[c])] || 0; };
  const alive = d => S.dead.includes(d);
  function igniteCell(c) { const f = fuel(c); if (!f || S.fire.has(c) || S.fire.size >= C.maxFire) return false; S.fire.set(c, f * rng.range(0.8, 1.2)); return true; }
  function cellsIn(x, y, r, fn) { if (!CH) return; const i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), j0 = Math.floor((y - r) / cell), j1 = Math.floor((y + r) / cell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (i >= 0 && j >= 0 && i < cw && Math.hypot((i + 0.5) * cell - x, (j + 0.5) * cell - y) <= r + cell * 0.5) fn(j * cw + i); }
  function soakCells(x, y, r, t) { ev('soakGround', { x, y, r, dur: t }); cellsIn(x, y, r, c => { S.wet.set(c, Math.max(S.wet.get(c) || 0, t)); if (S.fire.delete(c)) ev('doused', { x: centre(c)[0], y: centre(c)[1] }); }); }
  // fire on the ground: burnable cells catch; on hard ground (a road) a patch burns on its own a while
  function fireAt(x, y, r, t) { let lit = 0; cellsIn(x, y, r, c => { if (igniteCell(c)) lit++; }); if (!lit) S.grounds.push({ kind: 'fire', x, y, r, left: t, dur: t }); igniteOil(x, y, x, y, r); }
  const W = {
    damage: (t, n) => { if (alive(t)) G.hurtFoe(t, n, 'chem'); },
    apply: (t, s) => { if (alive(t)) addStatus(t, s); },
    pip: (t, el) => { if (alive(t)) addPip(t, el, S.t + 0.001, W); },
    near: (x, y, r) => S.dead.filter(d => Math.hypot(d.x - x, d.y - y) < r),
    push: (o, x, y, f) => { const a = Math.atan2(o.y - y, o.x - x); o.vx += Math.cos(a) * f; o.vy += Math.sin(a) * f; },
    mark: (kind, x, y, r) => ev('burst', { kind, x, y, r }),
    cloud: (kind, x, y, r, t, dps) => { S.clouds.push({ kind, x, y, r, left: t, dur: t, dps }); },
    ground: (kind, x, y, r, t) => { if (kind === 'fire') fireAt(x, y, r, t); else if (kind === 'wet') soakCells(x, y, r, t); },
    react: (Rx, t) => ev('reaction', { id: Rx.id, x: t.x, y: t.y }),
  };
  const hitEl = (d, el) => alive(d) ? addPip(d, el, S.t, W) : null;
  // oil under a fire's path (a pellet from (x0, y0) to (x1, y1), or a fire's reach) bursts into flame
  function igniteOil(x0, y0, x1, y1, pad = 0.3) { for (let i = S.oil.length - 1; i >= 0; i--) { const o = S.oil[i], ex = x1 - x0, ey = y1 - y0, L2 = ex * ex + ey * ey || 1e-9, u = Math.max(0, Math.min(1, ((o.x - x0) * ex + (o.y - y0) * ey) / L2));
    if (Math.hypot(o.x - x0 - ex * u, o.y - y0 - ey * u) < o.r + pad) { S.oil.splice(i, 1); S.grounds.push({ kind: 'fire', x: o.x, y: o.y, r: o.r + C.fireGrow, left: C.fireTime, dur: C.fireTime, oil: true }); cellsIn(o.x, o.y, o.r + C.fireGrow, igniteCell); ev('ignite', { x: o.x, y: o.y }); } } }
  // a shot's path: fire lights the oil it crosses; where it comes down (`end`: it ran out or hit a wall) fire may catch
  // the grass, and water soaks a little patch
  function shotLanded(x0, y0, x1, y1, el, end) { if (el === 'fire') { igniteOil(x0, y0, x1, y1); if (end && rng.chance(C.catchOnLand)) cellsIn(x1, y1, 0.5, igniteCell); } else if (el === 'water' && end) soakCells(x1, y1, 1, C.wetShot); }
  (G.onDie ||= []).push(d => { if (rng.chance(C.slick)) S.oil.push({ id: oid++, x: d.x, y: d.y, r: rng.range(C.slickR[0], C.slickR[1]), left: C.slickLife }); });
  const wind = { x: 0.731, y: 0.682 };   // the world's wind (render uses the same): fire runs downwind
  let spreadT = 0;
  function stepChem(dt) {
    // machines: pips fade one by one, fire pips burn (soaked ground puts them out); statuses tick; standing in fire adds a pip now and then
    for (const d of [...S.dead]) {
      if (d.pips && d.pips.length && S.wet.has(cellOf(d.x, d.y))) d.pips = d.pips.filter(p => p.el !== 'fire');
      if (d.pips && d.pips.length) { let fire = 0; for (let i = d.pips.length - 1; i >= 0; i--) { const p = d.pips[i]; p.left -= dt; if (p.left <= 0) d.pips.splice(i, 1); else if (p.el === 'fire') fire++; } if (fire) G.hurtFoe(d, PIPS.fire.dps * fire * dt, 'burn'); }
      if (d.st) for (const id of Object.keys(d.st)) if ((d.st[id].left -= dt) <= 0) delete d.st[id];
      if (!alive(d) || (d.groundAt ?? -9) > S.t - C.groundGap) continue; const c = cellOf(d.x, d.y);
      const inFire = S.fire.has(c) || S.grounds.some(g => g.kind === 'fire' && Math.hypot(d.x - g.x, d.y - g.y) < g.r);
      if (inFire) { d.groundAt = S.t; hitEl(d, 'fire'); } }
    for (let i = S.clouds.length - 1; i >= 0; i--) { const c = S.clouds[i]; c.left -= dt; if (c.left <= 0) { S.clouds.splice(i, 1); continue; }
      for (const d of [...S.dead]) if (Math.hypot(d.x - c.x, d.y - c.y) < c.r) { addStatus(d, 'blind'); if (c.dps) G.hurtFoe(d, c.dps * dt, 'chem'); } }
    for (let i = S.grounds.length - 1; i >= 0; i--) { const g = S.grounds[i]; if ((g.left -= dt) <= 0) S.grounds.splice(i, 1); }
    for (let i = S.oil.length - 1; i >= 0; i--) { const o = S.oil[i]; if (o.left !== undefined && (o.left -= dt) <= 0) S.oil.splice(i, 1); }
    for (const [c, t] of S.wet) { if (t - dt <= 0) S.wet.delete(c); else S.wet.set(c, t - dt); }
    // the fire: cells burn down to ash; every tick a burning cell may light its neighbours (downwind more, upwind less)
    for (const [c, t] of S.fire) { if (t - dt > 0) { S.fire.set(c, t - dt); continue; } S.fire.delete(c); S.burnt.add(c); const [x, y] = centre(c); ev('burnt', { x, y, c }); igniteOil(x, y, x, y, cell * 0.6); }
    if ((spreadT -= dt) <= 0) { spreadT = C.spreadEvery; const lit = [...S.fire.keys()];
      for (const c of lit) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = c + dj * cw + di, along = di * wind.x + dj * wind.y;
        if (rng.chance(C.spread * (along > 0.3 ? C.downwind : along < -0.3 ? C.upwind : 1))) igniteCell(n); } }
  }
  const onWet = d => S.wet.has(cellOf(d.x, d.y));   // soaked ground slows what walks on it
  Object.assign(G, { hitElement: hitEl, shotLanded, stepChem, onWet });
}
