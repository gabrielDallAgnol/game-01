// [roam] Areas and their walkers (M4, docs/design/implementation-plan.md): the town's districts are its areas (the old
// town, the sugar works, the station quarter, the park, the estate, the strip, the farms...). Each has a level (further
// from where Kai starts is harder: its machines are tougher) and a state: dark until its walker dies, then clean for good.
// A walker is the area's giant: it walks between points on the area's streets, drops crawlers as it goes and plants a
// nest now and then the longer it lives; close to Kai it turns on her and stomps (a slow wind-up, a big hit). Shots
// break its four plates first, then its core. Its defences, as in Horizon Zero Dawn: two weapon pods on its shoulders
// fire volleys of bolts (shoot them off and they stop), a fuel tank on its back blows up on the walker itself (half its
// plates' worth of hurt and fire all round it), and in a fight it drops machines much faster. When it dies the area is clean: no machine is born there again, its nests
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
    const lv = 1 + A.hpPerLevel * (a.level - 1); d.hp = d.maxHp = R.dead.walker.hp * lv; d.plateMax = d.plate = R.dead.walker.plateHp * lv; a.walker = d.id;
    // its parts, in its own frame (metres: forward, left), each with its health: the pods and the tank
    d.parts = { podL: { lx: 2.3, ly: -3.4, r: 1.6, hp: A.podHp * lv, max: A.podHp * lv }, podR: { lx: 2.3, ly: 3.4, r: 1.6, hp: A.podHp * lv, max: A.podHp * lv }, tank: { lx: -4.4, ly: 0, r: 1.5, hp: A.tankHp * lv, max: A.tankHp * lv } };
    d.volleyT = A.volleyEvery; d.podAim = 0; }
  // a shot on a walker: its plates take it first, then the core (worth more once bare)
  // where a hit lands on it: a part, if the hit is on one (the pods and the tank stand clear of its armour)
  const partAt = (d, hx, hy) => { if (hx === undefined) return null; const c = Math.cos(d.fa || 0), s2 = Math.sin(d.fa || 0); let best = null, bd = 1e9;
    for (const [id, p] of Object.entries(d.parts || {})) { if (p.hp <= 0) continue; const px = d.x + p.lx * c - p.ly * s2, py = d.y + p.lx * s2 + p.ly * c, q = Math.hypot(hx - px, hy - py); if (q < p.r + A.partSlop && q < bd) { bd = q; best = id; } } return best; };
  function hurtBoss(d, n, src, hx, hy) { d.hit = S.t; if (d.state === 'patrol') d.state = 'hunt';
    const pid = partAt(d, hx, hy); if (pid) { const p = d.parts[pid]; p.hp -= n; if (p.hp <= 0) breakPart(d, pid); return; }
    if (d.plates > 0) { d.plate -= n; if (d.plate <= 0) { d.plates--; d.plate = d.plateMax; ev('plate', { id: d.id, x: d.x, y: d.y, left: d.plates }); } return; }
    d.hp -= n * A.coreMult; if (d.hp <= 0) G.killFoe(d, src); }
  function breakPart(d, pid) { const p = d.parts[pid], c = Math.cos(d.fa || 0), s2 = Math.sin(d.fa || 0), x = d.x + p.lx * c - p.ly * s2, y = d.y + p.lx * s2 + p.ly * c;
    ev('part', { id: d.id, part: pid, x, y });
    if (pid === 'tank') {   // the tank blows on the walker: a plate off and a bite of its core, and fire all round it
      ev('blast', { x, y, r: 6 }); G.deliver('fire', x, y, 5, 3); if (d.plates > 0) d.plates--; d.hp -= d.maxHp * A.tankBite;
      const k = S.kai, q = Math.hypot(k.x - x, k.y - y); if (q < 6 && !k.dead) G.hurtKai(12 * (1 - q / 6));
      if (d.hp <= 0) G.killFoe(d, 'gun'); } }
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
    const fight = d.state === 'hunt';
    if ((a.spawnT -= dt) <= 0) { a.spawnT = fight ? A.spawnFight : S.night ? A.spawnNight : A.spawnEvery; const mine = S.dead.filter(q => q.mother === d.id).length;
      if (mine < (fight ? A.broodFight : A.brood)) for (let t = 0; t < 6; t++) { const ang = rng.range(0, 6.283), x = d.x + Math.cos(ang) * 6.5, y = d.y + Math.sin(ang) * 6.5;
        if (!blocked(x, y)) { const roll = rng.range(0, 1), kind = !fight ? 'crawler' : roll < 0.5 ? 'crawler' : roll < 0.75 ? 'skitter' : roll < 0.9 ? 'spitter' : 'hound';
          G.spawn(kind, x, y, { mother: d.id, state: fight ? 'chase' : 'wander' }); ev('brood', { id: d.id, x, y, kind }); break; } } }
    // the pods: in a fight they take aim (their lights flare) and fire a volley of bolts at her, one from each pod left
    if (fight && !k.dead && r < A.volleyR) { if (d.podAim > 0) { d.podAim -= dt; if (d.podAim <= 0) { d.volleyT = A.volleyEvery; const c = Math.cos(d.fa || 0), s2 = Math.sin(d.fa || 0);
          for (const pid of ['podL', 'podR']) { const p = d.parts[pid]; if (!p || p.hp <= 0) continue; const px = d.x + p.lx * c - p.ly * s2, py = d.y + p.lx * s2 + p.ly * c;
            for (let v = -1; v <= 1; v++) { const lead = Math.min(0.8, Math.hypot(k.x - px, k.y - py) / A.boltSpeed) * 0.5, ang = Math.atan2(k.y + k.vy * lead - py, k.x + k.vx * lead - px) + v * 0.16;
              S.bolts.push({ id: 900000 + Math.floor(rng.range(0, 1e5)), x: px, y: py, vx: Math.cos(ang) * A.boltSpeed, vy: Math.sin(ang) * A.boltSpeed, life: 3.2, dmg: A.boltDmg, r: 0.9, from: d.id }); }
            ev('volley', { id: d.id, part: pid, x: px, y: py }); } } }
      else if ((d.volleyT -= dt) <= 0 && (d.parts.podL.hp > 0 || d.parts.podR.hp > 0)) { d.podAim = A.podWindup; ev('podAim', { id: d.id }); } }
    if ((a.nestT -= dt) <= 0) { a.nestT = A.nestEvery; if (a.planted < A.nestsMax && !blocked(d.x, d.y)) { a.planted++; const n = { id: 1000 + S.nests.length, x: d.x, y: d.y, hp: A.nestHp, maxHp: A.nestHp, alive: true, spawnT: 3, hit: -9, planted: true };
      S.nests.push(n); S.nestsLeft++; ev('planted', { id: n.id, x: n.x, y: n.y, area: a.i }); } }
  }
  function stepAreas(dt) { const k = S.kai;
    for (const d of S.dead) { if (!d.boss) continue; if (Math.hypot(d.x - k.x, d.y - k.y) > A.simR) continue; const a = S.areas[d.area]; if (a) stepWalker(d, a, dt); }
    const a = areaAt(k.x, k.y), id = a ? a.i : -1; if (id !== S.inArea) { S.inArea = id; if (a) ev('enter', { area: a.i, name: a.name, level: a.level, state: a.state }); } }
  Object.assign(G, { areaAt, levelAt, isClean, hurtBoss, stepAreas });
}
