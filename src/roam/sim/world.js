// [roam] The atom world (docs/design/atomic-engineering.md): every burnable or soakable thing is an atom with a material
// (src/play/materials.js, mapped in src/play/atoms-map.js). The ground's 2 m cells (grass, crops, the woods floor) and the
// placed atoms (trees, hedges, houses, cars, benches, bales, oil) live by the same three rules: elements change atoms;
// water cools heat; atoms never touch each other, a burning atom only gives off heat and each neighbour reacts to the heat
// it gets by its own material (wet ones boil their water off first). Fuel runs out into char, a stump, a gap, a gutted
// house or a wreck; a fuel tank blows instead of burning. Fire hurts what stands in it, Kai too. Only fires near Kai
// simulate (far ones wait), within a cap. Its own Rng stream.
// Offers G.deliver(el, x, y, r, power), G.addOil(x, y, r, life), G.inFire(x, y), G.hot(x, y), G.onWet(d), G.stepWorld(dt).
import { Rng, hashSeed } from '../../sim/rng.js';
import { MATERIALS } from '../../play/materials.js';
import { GROUND, PROPS, PLACED } from '../../play/atoms-map.js';
export function createWorld(G) {
  const { R, S, ev, town } = G, A = R.atoms, rng = new Rng(hashSeed(G.seed, 'world')), CH = town.chars, MAT = MATERIALS;
  const cw = CH ? CH.w : 1, ch = CH ? CH.h : 1, cell = CH ? CH.cell : 2;
  // ---------- the ground: sparse state for cells that are hot, wet or burning ----------
  S.cells = new Map(); S.burnt = new Set();
  const cellMat = c => { if (!CH || c < 0 || c >= cw * ch || S.burnt.has(c)) return null; const m = GROUND[String.fromCharCode(CH.codes[c])]; return m ? MAT[m] : null; };
  const cellAt = (x, y) => (x < 0 || y < 0 || x >= cw * cell || y >= ch * cell) ? -1 : Math.floor(y / cell) * cw + Math.floor(x / cell);
  const centre = c => [(c % cw + 0.5) * cell, (Math.floor(c / cw) + 0.5) * cell];
  const cs = c => { let s = S.cells.get(c); if (!s) { s = { heat: 0, wet: 0, burn: 0 }; S.cells.set(c, s); } return s; };
  // ---------- the placed atoms, filed on an 8 m grid ----------
  S.atoms = []; let aid = 1; const GR = 8, grid = new Map();
  const file = a => { const i0 = Math.floor((a.x - a.r) / GR), i1 = Math.floor((a.x + a.r) / GR), j0 = Math.floor((a.y - a.r) / GR), j1 = Math.floor((a.y + a.r) / GR);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = i * 65536 + j; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(a); } };
  const atom = (kind, mat, x, y, r, extra = {}) => { const a = { id: aid++, kind, mat, x, y, r, heat: 0, wet: 0, fuel: MAT[mat].fuel || 0, state: 'ok', ...extra }; S.atoms.push(a); file(a); return a; };
  for (const p of town.trees || []) atom('tree', PLACED.tree, p.x, p.y, (p.r || p.def.size[0] / 2) * 0.8, { ref: p.uid ?? p.id });
  for (const b of town.buildings || []) atom('building', PLACED.building, b.x, b.y, Math.hypot(b.w, b.h) / 2, { ref: b.uid ?? b.id, obb: { x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot } });
  for (const h of (town.W && town.W._landPlan && town.W._landPlan.hedgeSegs) || []) { const L = Math.hypot(h.b.x - h.a.x, h.b.y - h.a.y), n = Math.max(1, Math.round(L / 3));
    for (let k = 0; k < n; k++) { const u = (k + 0.5) / n; atom('hedge', PLACED.hedge, h.a.x + (h.b.x - h.a.x) * u, h.a.y + (h.b.y - h.a.y) * u, 1.6); } }
  for (const i of (town.dress && town.dress.list) || []) { const m = PROPS[i.atom.id]; if (m) atom('prop', m, i.x, i.y, i.atom.collide ? Math.max(i.atom.collide.w, i.atom.collide.h) / 2 : 0.8, { ref: i.id, prop: i.atom.id });
    else if (i.atom.id === 'oil') atom('oil', PLACED.oil, i.x, i.y, A.stainR); }
  function addOil(x, y, r, life) { live.add(atom('oil', 'oil', x, y, r, { life, slick: true })); }
  const near = (x, y, r, fn) => { const seen = new Set(); for (let j = Math.floor((y - r) / GR); j <= Math.floor((y + r) / GR); j++) for (let i = Math.floor((x - r) / GR); i <= Math.floor((x + r) / GR); i++)
    for (const a of grid.get(i * 65536 + j) || []) { if (seen.has(a)) continue; seen.add(a); const d = a.obb ? boxDist(a.obb, x, y) : Math.hypot(a.x - x, a.y - y) - a.r; if (d < r) fn(a, Math.max(0, d)); } };
  // a house is its footprint, not a circle: the distance from a point to its rotated box (0 inside)
  function boxDist(o, x, y) { const c = Math.cos(-(o.rot || 0)), s = Math.sin(-(o.rot || 0)), dx = x - o.x, dy = y - o.y, u = Math.abs(dx * c - dy * s) - o.w / 2, v = Math.abs(dx * s + dy * c) - o.h / 2; return Math.hypot(Math.max(0, u), Math.max(0, v)); }
  // ---------- heat and water ----------
  // an atom (cell state or placed atom) takes heat: water boils off first; then it heats; past its ignite it catches
  let burning = 0;
  const live = new Set();
  function take(s, M, h) { if (h <= 0 || !M || M.ignite === undefined) return; if (s.kind) live.add(s); if (s.wet > 0) { s.wet = Math.max(0, s.wet - h * A.boil); return; } s.heat += h; }
  function catches(s, M) { return burning < A.maxBurn && s.heat >= M.ignite && !s.burn && s.state !== 'burning' && s.state !== 'done'; }
  const windAt = (dx, dy, d) => { if (d < 0.01) return 1; const along = (dx * A.wind.x + dy * A.wind.y) / d; return Math.max(A.upwind, 1 + A.downwind * along); };
  // heat out of (x, y): `amount` reaching `reach` metres, falling off with distance, pushed by the wind
  function emit(x, y, amount, reach, self) {
    const i0 = Math.floor((x - reach) / cell), i1 = Math.floor((x + reach) / cell), j0 = Math.floor((y - reach) / cell), j1 = Math.floor((y + reach) / cell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (i < 0 || j < 0 || i >= cw || j >= ch) continue; const c = j * cw + i; if (c === self) continue; const M = cellMat(c); if (!M) continue;
      const dx = (i + 0.5) * cell - x, dy = (j + 0.5) * cell - y, d = Math.hypot(dx, dy); if (d > reach) continue; take(cs(c), M, amount * (1 - d / reach) * windAt(dx, dy, d)); }
    near(x, y, reach, (a, d) => { if (a === self || a.state === 'done') return; const M = MAT[a.mat]; if (M.ignite === undefined && !M.explodeAt) return; const dx = a.x - x, dy = a.y - y;
      const h = amount * (1 - d / reach) * windAt(dx, dy, Math.hypot(dx, dy)); if (M.explodeAt) { live.add(a); if (a.wet > 0) a.wet = Math.max(0, a.wet - h * A.boil); else a.heat += h; } else take(a, M, h); });
  }
  // a fuel tank blows: blast damage and push, heat out to the blast's edge, then the wreck burns (wreckBurn seconds)
  function explode(a) { const M0 = MAT[a.mat], B = M0.blast; a.heat = 0; if (M0.wreckBurn) { a.state = 'burning'; a.wreck = true; a.fuel = M0.wreckBurn; burning++; } else a.state = 'done'; ev('blast', { x: a.x, y: a.y, r: B.r });
    ev('atomBurnt', { id: a.id, kind: a.kind, prop: a.prop, ref: a.ref, x: a.x, y: a.y, to: 'wreck' });
    for (const d of [...S.dead]) { const q = Math.hypot(d.x - a.x, d.y - a.y); if (q < B.r) { const f = 1 - q / B.r, ang = Math.atan2(d.y - a.y, d.x - a.x); G.hurtFoe(d, B.dmg * f, 'blast'); d.vx += Math.cos(ang) * B.push * f; d.vy += Math.sin(ang) * B.push * f; G.hitElement(d, 'fire'); } }
    const k = S.kai, q = Math.hypot(k.x - a.x, k.y - a.y); if (q < B.r && !k.dead) G.hurtKai(B.dmg * (1 - q / B.r) * A.kaiBlast);
    emit(a.x, a.y, B.heat, B.r, a); }
  // an element delivered to the world (a splash, a stream, a reaction): fire is heat, water soaks and puts fire out;
  // a plain explosion (no element) is a little heat
  // water wets every cell it reaches (hard ground holds a film of water too, hardWet); fire only heats what burns
  // a stream lands many small soaks: only one wet mark per spot every so often (the ground is still soaked by each)
  const marks = [];
  function deliver(el, x, y, r, power = 1) {
    if (el === 'water') { if (!marks.some(m => m.until > S.t && Math.hypot(m.x - x, m.y - y) < m.r * 0.7)) { marks.push({ x, y, r: Math.max(r, 1.6), until: S.t + 1.5 }); if (marks.length > 40) marks.shift(); ev('soakGround', { x, y, r: Math.max(r, 1.6), dur: A.wetShow * Math.max(0.5, power) }); }
      for (let j = Math.floor((y - r) / cell); j <= Math.floor((y + r) / cell); j++) for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) { if (i < 0 || j < 0 || i >= cw || j >= ch) continue;
        const c = j * cw + i, M = cellMat(c); if (Math.hypot((i + 0.5) * cell - x, (j + 0.5) * cell - y) > r + cell * 0.5) continue; const s = cs(c); s.wet = Math.max(s.wet, (M ? M.soak : A.hardWet) * power); s.heat = 0; if (s.burn) { s.burn = 0; burning--; ev('doused', { x: (i + 0.5) * cell, y: (j + 0.5) * cell }); } }
      near(x, y, r, a => { const M = MAT[a.mat]; if (!M.soak) return; live.add(a); a.wet = Math.max(a.wet, M.soak * power); a.heat = 0; if (a.state === 'burning') { a.state = 'ok'; burning--; ev('doused', { x: a.x, y: a.y }); } });
      return; }
    const h = (el === 'fire' ? A.fireHeat : A.blastHeat) * power;
    for (let j = Math.floor((y - r) / cell); j <= Math.floor((y + r) / cell); j++) for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) { if (i < 0 || j < 0 || i >= cw || j >= ch) continue;
      const c = j * cw + i, M = cellMat(c), d = Math.hypot((i + 0.5) * cell - x, (j + 0.5) * cell - y); if (M && d <= r + cell * 0.5) take(cs(c), M, h * (1 - 0.5 * Math.min(1, d / (r + 0.01)))); }
    near(x, y, r, (a, d) => { const M = MAT[a.mat], hh = h * (1 - 0.5 * Math.min(1, d / (r + 0.01))); if (M.explodeAt) { live.add(a); a.heat += hh; } else take(a, M, hh); });
    settle(); }
  // after heat moves: what passed its ignite catches, fuel tanks past their limit blow
  function settle() {
    for (const [c, s] of S.cells) { const M = cellMat(c); if (M && catches(s, M)) { s.burn = M.fuel * rng.range(0.85, 1.15); burning++; } }
    for (const a of [...live]) { const M = MAT[a.mat]; if (a.state !== 'ok') continue; if (M.explodeAt && a.heat >= M.explodeAt) explode(a); else if (M.ignite !== Infinity && catches(a, M)) { a.state = 'burning'; a.fuel = M.fuel * rng.range(0.85, 1.15); burning++; ev('catch', { id: a.id, kind: a.kind, x: a.x, y: a.y }); } } }
  // ---------- the questions others ask ----------
  function inFire(x, y) { const s = S.cells.get(cellAt(x, y)); if (s && s.burn) return cellMat(cellAt(x, y)); let M = null; near(x, y, 0.6, a => { if (a.state === 'burning') M = MAT[a.mat]; }); return M; }
  const hotAt = (x, y) => !!inFire(x, y);
  const onWet = d => { const s = S.cells.get(cellAt(d.x, d.y)); return !!(s && s.wet > 0); };
  // ---------- the tick ----------
  let tickT = 0;
  function stepWorld(dt) {
    if ((tickT -= dt) > 0) return; const T = A.tick; tickT = T;
    const k = S.kai, R2 = A.simR * A.simR, inRange = (x, y) => (x - k.x) * (x - k.x) + (y - k.y) * (y - k.y) < R2;
    // burning things give off heat and spend fuel (far from Kai they wait)
    for (const [c, s] of S.cells) { if (!s.burn) continue; const [x, y] = centre(c); if (!inRange(x, y)) continue; const M = cellMat(c); emit(x, y, M.burnHeat * T, M.burnReach, c);
      if ((s.burn -= T) <= 0) { s.burn = 0; burning--; S.burnt.add(c); S.cells.delete(c); ev('burnt', { x, y, c }); } }
    for (const a of [...live]) { if (a.state !== 'burning' || !inRange(a.x, a.y)) continue; const M = MAT[a.mat]; emit(a.x, a.y, M.burnHeat * T, M.burnReach + a.r * 0.5, a);
      if ((a.fuel -= T) <= 0) { a.state = 'done'; burning--; if (a.wreck) continue; ev('atomBurnt', { id: a.id, kind: a.kind, prop: a.prop, ref: a.ref, x: a.x, y: a.y, r: a.kind === 'tree' ? a.r / 0.8 : a.r, to: M.onBurnt, obb: a.obb }); if (M.onBurnt === 'gone' && a.ref !== undefined) S.broken.add(a.ref); } }
    settle();
    // cooling and drying; slicks fade
    for (const [c, s] of S.cells) { s.heat *= Math.exp(-A.cool * T); if (s.wet > 0) s.wet = Math.max(0, s.wet - T); if (!s.burn && s.heat < 0.02 && s.wet <= 0) S.cells.delete(c); }
    for (const a of live) { if (a.state !== 'burning') a.heat *= Math.exp(-A.cool * T); if (a.wet > 0) a.wet = Math.max(0, a.wet - T);
      if (a.slick && a.state === 'ok' && (a.life -= T) <= 0) a.state = 'done';
      if (a.state === 'done' || (a.state === 'ok' && a.heat < 0.02 && a.wet <= 0 && !a.slick)) { if (a.state === 'ok') a.heat = 0; live.delete(a); } }
    // fire hurts what stands in it: Kai (on the bike or not) and the machines (as fire pips, via chem)
    if (!k.dead) { const M = inFire(k.x, k.y); if (M && M.hurts) { G.hurtKai(M.hurts * T * A.kaiBurn); ev('scorch', {}); } }
  }
  Object.assign(G, { deliver, addOil, inFire, hot: hotAt, onWet, stepWorld });
}
