// [roam] Areas and their walkers (M4, docs/design/implementation-plan.md): the town's districts are its areas (the old
// town, the sugar works, the station quarter, the park, the estate, the strip, the farms...). Each has a level (further
// from where Kai starts is harder: its machines are tougher) and a state: dark until its walker dies, then clean for good.
// A walker is the area's giant: it walks between points on the area's streets, drops crawlers as it goes and plants a
// nest now and then the longer it lives; close to Kai it turns on her and stomps (a slow wind-up, a big hit). Shots
// break its four plates first, then its core. When it dies the area is clean: no machine is born there again, its nests
// go dark, and the town shows it (the glow-up, render-side). Its own Rng stream.
// Offers G.areaAt(x, y), G.levelAt(x, y), G.isClean(x, y), G.hurtBoss(d, n, src), G.stepAreas(dt).
import { Rng, hashSeed } from '../../sim/rng.js';
export function createAreas(G) {
  const { R, S, ev, town } = G, A = R.areas, W = town.W, rng = new Rng(hashSeed(G.seed, 'areas')), { blocked } = town;
  // which districts are areas: the town's and the named places outside it (not the open country, fields or bypass)
  const skip = new Set(['country', 'fields', 'bypass', 'lake', 'woods']);
  const list = (W.districts || []).filter(d => !skip.has(d.kind) && d.poly);
  const k0 = town.start;
  S.areas = list.map((d, i) => { const at = d.at || centroid(d.poly); return { i, id: d.id, name: d.name, x: at.x, y: at.y, level: 1 + Math.floor(Math.hypot(at.x - k0.x, at.y - k0.y) / A.levelEvery), state: 'dark', walker: -1, spawnT: 0, nestT: A.nestEvery, planted: 0 }; });
  function centroid(P) { let x = 0, y = 0; for (const p of P) { x += p.x; y += p.y; } return { x: x / P.length, y: y / P.length }; }
  // the area under every 8 m of the map, looked up once
  const AG = A.grid, gw = Math.ceil(town.size.w / AG), gh = Math.ceil(town.size.h / AG), grid = new Int16Array(gw * gh).fill(-1), byId = new Map(S.areas.map(a => [a.id, a]));
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const d = W.districtAt((i + 0.5) * AG, (j + 0.5) * AG), a = d && byId.get(d.id); if (a) grid[j * gw + i] = a.i; }
  S.areaGrid = { gw, gh, cell: AG, ids: grid };
  const areaAt = (x, y) => { const i = Math.floor(x / AG), j = Math.floor(y / AG); if (i < 0 || j < 0 || i >= gw || j >= gh) return null; const k = grid[j * gw + i]; return k >= 0 ? S.areas[k] : null; };
  const levelAt = (x, y) => { const a = areaAt(x, y); return a ? a.level : 1 + Math.floor(Math.hypot(x - k0.x, y - k0.y) / A.levelEvery); };
  const isClean = (x, y) => { const a = areaAt(x, y); return !!(a && a.state === 'clean'); };
  // the points a walker walks between: street points in its area
  let pts = S.areas.map(() => []);
  for (const st of W.streets || []) for (const p of st.pts || []) { const a = areaAt(p.x, p.y); if (a && !blocked(p.x, p.y)) pts[a.i].push(p); }
  // a district too small to carry its own walker (the park, the transmitter field...) joins its nearest big neighbour:
  // one walker, one state, one name for both
  const big = S.areas.filter(a => pts[a.i].length >= A.minPts);
  for (const a of S.areas) if (pts[a.i].length < A.minPts && big.length) { let b = big[0], bd = 1e9; for (const c of big) { const q = Math.hypot(c.x - a.x, c.y - a.y); if (q < bd) { bd = q; b = c; } } a.root = b.i; pts[b.i].push(...pts[a.i]); }
  for (let k = 0; k < grid.length; k++) if (grid[k] >= 0 && S.areas[grid[k]].root !== undefined) grid[k] = S.areas[grid[k]].root;
  S.areas.forEach(a => { if (a.root !== undefined) a.joined = S.areas[a.root].id; });
  // the walkers, one per area that has streets to walk; it starts at a point far from Kai's start
  for (const a of S.areas) { const P = pts[a.i]; if (a.root !== undefined || P.length < 2) continue; let p = P[0], pd = -1; for (let k = 0; k < 6; k++) { const q = P[rng.int(P.length)], d = Math.hypot(q.x - k0.x, q.y - k0.y); if (d > pd) { pd = d; p = q; } }
    const d = G.spawn('walker', p.x, p.y, { boss: true, area: a.i, state: 'patrol', plates: R.dead.walker.plates, plate: R.dead.walker.plateHp, wx: p.x, wy: p.y, stompT: 0, windT: 0 });
    d.hp = d.maxHp = R.dead.walker.hp * (1 + A.hpPerLevel * (a.level - 1)); d.plateMax = d.plate = R.dead.walker.plateHp * (1 + A.hpPerLevel * (a.level - 1)); a.walker = d.id; }
  // a shot on a walker: its plates take it first, then the core (worth more once bare)
  function hurtBoss(d, n, src) { d.hit = S.t; if (d.state === 'patrol') d.state = 'hunt';
    if (d.plates > 0) { d.plate -= n; if (d.plate <= 0) { d.plates--; d.plate = d.plateMax; ev('plate', { id: d.id, x: d.x, y: d.y, left: d.plates }); } return; }
    d.hp -= n * A.coreMult; if (d.hp <= 0) G.killFoe(d, src); }
  (G.onDie ||= []).push(d => { if (!d.boss) return; const a = S.areas[d.area]; if (!a || a.state === 'clean') return; a.state = 'clean'; a.walker = -1;
    for (const n of S.nests) if (n.alive && areaAt(n.x, n.y) === a) G.hitNest(n, 1e9);   // its nests go dark with it
    ev('clean', { area: a.i, name: a.name, x: d.x, y: d.y, level: a.level }); });
  function stepWalker(d, a, dt) {
    const K = R.dead.walker, k = S.kai, r = Math.hypot(k.x - d.x, k.y - d.y), P = pts[a.i];
    if (!k.dead && r < A.notice) d.state = 'hunt'; else if (d.state === 'hunt' && (r > A.notice * 1.8 || k.dead)) d.state = 'patrol';
    let gx = d.wx, gy = d.wy, sp = K.speed;
    if (d.state === 'hunt' && !k.dead) { gx = k.x; gy = k.y; sp *= 1.3;
      // the stomp: it stops, rears (wind-up), comes down; Kai inside the reach is hit and thrown
      if (d.windT > 0) { d.windT -= dt; d.vx *= 0.8; d.vy *= 0.8; if (d.windT <= 0) { d.stompT = A.stompEvery; ev('stomp', { id: d.id, x: d.x, y: d.y, r: K.reach }); if (r < K.reach + 0.6) { G.hurtKai(K.dmg); const ang = Math.atan2(k.y - d.y, k.x - d.x); if (k.riding) { S.bike.speed = 0; } k.vx += Math.cos(ang) * 8; k.vy += Math.sin(ang) * 8; } } return; }
      d.stompT -= dt; if (r < K.reach && d.stompT <= 0) { d.windT = K.windup; ev('rear', { id: d.id }); return; } }
    else if (Math.hypot(d.wx - d.x, d.wy - d.y) < 2 && P.length) { const q = P[rng.int(P.length)]; d.wx = q.x; d.wy = q.y; }
    const dx = gx - d.x, dy = gy - d.y, L = Math.hypot(dx, dy) || 1, nx = d.x + dx / L * sp * dt, ny = d.y + dy / L * sp * dt;
    if (!blocked(nx, ny)) { d.x = nx; d.y = ny; } else if (d.state === 'patrol' && P.length) { const q = P[rng.int(P.length)]; d.wx = q.x; d.wy = q.y; }
    d.vx = dx / L * sp; d.vy = dy / L * sp; d.fa = Math.atan2(dy, dx);
    // it drops crawlers as it walks (more often at night, a cap per walker) and plants nests the longer it lives
    if ((a.spawnT -= dt) <= 0) { a.spawnT = S.night ? A.spawnNight : A.spawnEvery; const mine = S.dead.filter(q => q.mother === d.id).length;
      if (mine < A.brood) for (let t = 0; t < 6; t++) { const ang = rng.range(0, 6.283), x = d.x + Math.cos(ang) * 2.5, y = d.y + Math.sin(ang) * 2.5; if (!blocked(x, y)) { G.spawn('crawler', x, y, { mother: d.id, state: d.state === 'hunt' ? 'chase' : 'wander' }); ev('drop', { kind: 'brood', x, y }); break; } } }
    if ((a.nestT -= dt) <= 0) { a.nestT = A.nestEvery; if (a.planted < A.nestsMax && !blocked(d.x, d.y)) { a.planted++; const n = { id: 1000 + S.nests.length, x: d.x, y: d.y, hp: A.nestHp, maxHp: A.nestHp, alive: true, spawnT: 3, hit: -9, planted: true };
      S.nests.push(n); S.nestsLeft++; ev('planted', { id: n.id, x: n.x, y: n.y, area: a.i }); } }
  }
  function stepAreas(dt) { const k = S.kai;
    for (const d of S.dead) { if (!d.boss) continue; if (Math.hypot(d.x - k.x, d.y - k.y) > A.simR) continue; const a = S.areas[d.area]; if (a) stepWalker(d, a, dt); }
    const a = areaAt(k.x, k.y), id = a ? a.i : -1; if (id !== S.inArea) { S.inArea = id; if (a) ev('enter', { area: a.i, name: a.name, level: a.level, state: a.state }); } }
  Object.assign(G, { areaAt, levelAt, isClean, hurtBoss, stepAreas });
}
