// [roam] The foes: where they appear (out of sight, on the streets round Kai), how they think (sleep, wander, chase,
// wind up and bite), how they are hurt and die. Reads G.S, G.view; offers G.spawn, G.kindRoll, G.hurtFoe, G.populate, G.stepFoes.
export function createFoes(G) {
  const { R, S, rng, ev, dist, town } = G, { blocked, streetCells } = town;
  let nid = 1;
  function spawn(kind, x, y, o = {}) { const K = R.dead[kind]; const d = { id: nid++, kind, x, y, vx: 0, vy: 0, hp: K.hp, maxHp: K.hp, fa: rng.range(0, 6.28), ph: rng.range(0, 6), side: rng.chance(0.5) ? -1 : 1, state: 'wander', wx: x, wy: y, bite: 0, wind: 0, hit: -9, ...o }; S.dead.push(d); return d; }
  const kindRoll = () => { const r = rng.float(); return r < (S.night ? 0.12 : 0.06) ? 'brute' : r < (S.night ? 0.32 : 0.2) ? 'flicker' : 'cinder'; };
  // the street cells on a 32 m grid: a spawn draws from the buckets round Kai, not the whole world (a big world would starve)
  const SB = 32, sbuck = new Map(); for (let i = 0; i < streetCells.length; i += 2) { const k = Math.floor(streetCells[i] / SB) * 4096 + Math.floor(streetCells[i + 1] / SB); if (!sbuck.has(k)) sbuck.set(k, []); sbuck.get(k).push(i); }
  function streetNear(cx, cy, r0, r1) { const near = []; const n = Math.ceil(r1 / SB);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const b = sbuck.get((Math.floor(cx / SB) + i) * 4096 + Math.floor(cy / SB) + j); if (b) near.push(b); }
    if (!near.length) return null;
    for (let k = 0; k < 30; k++) { const b = near[rng.int(near.length)], i = b[rng.int(b.length)], x = streetCells[i], y = streetCells[i + 1], d = Math.hypot(x - cx, y - cy); if (d > r0 && d < r1) return { x, y }; } return null; }
  // they appear out of sight: past the edge of what the player sees (G.view, the screen's half-diagonal in metres, set by
  // the UI from the zoom), never closer than 24 m; the ring and the forgetting distance grow with the view
  function populate() {
    const k = S.kai, cap = R.dead.cap[S.night ? 1 : 0], r0 = Math.max(24, G.view + 8), r1 = Math.max(R.dead.near, r0 + 40), far = Math.max(R.dead.far, r1 + 40);
    let near = 0; for (const d of S.dead) if (dist(d, k) < r1) near++;
    for (let tries = 0; near < cap && tries < 6; tries++) { const p = streetNear(k.x, k.y, r0, r1); if (!p) break;
      const group = !S.night && rng.chance(0.4) ? 2 + rng.int(4) : 1;   // by day some sleep in little groups
      for (let g = 0; g < group; g++) { const x = p.x + rng.range(-1.5, 1.5), y = p.y + rng.range(-1.5, 1.5); if (!blocked(x, y)) { spawn(kindRoll(), x, y, { state: group > 1 ? 'sleep' : 'wander' }); near++; } } }
    for (let i = S.dead.length - 1; i >= 0; i--) { const d = S.dead[i]; if (d.nest === undefined && dist(d, k) > far) S.dead.splice(i, 1); }
  }
  function kill(d, src) { const i = S.dead.indexOf(d); if (i < 0) return; S.dead.splice(i, 1); S.kills++; ev('die', { id: d.id, x: d.x, y: d.y, fa: d.fa, kind: d.kind, src }); }
  function hurtFoe(d, n, src) { d.hp -= n; d.hit = S.t; if (d.state === 'sleep') d.state = 'chase'; if (d.hp <= 0) kill(d, src); }
  // they think: sleep until something comes close, wander, chase Kai when they sense her
  function stepFoes(dt) {
    const k = S.kai, sense = R.dead.sense[S.night ? 1 : 0] * (k.riding ? 1.3 : 1);   // the engine is loud
    for (const d of S.dead) {
      const K = R.dead[d.kind], r = dist(d, k), seesKai = !k.dead && r < sense;
      if (d.state === 'sleep') { if (!k.dead && r < (k.riding ? 9 : 5)) d.state = 'chase'; else { d.vx *= 0.8; d.vy *= 0.8; continue; } }
      if (seesKai) d.state = 'chase'; else if (d.state === 'chase' && r > sense * 1.6) { d.state = 'wander'; d.wx = d.x; d.wy = d.y; }
      let gx, gy, sp = K.speed * (S.night ? R.dead.nightSpeed : 1);
      if (d.state === 'chase' && !k.dead) { gx = k.x; gy = k.y; }
      else { if (Math.hypot(d.wx - d.x, d.wy - d.y) < 1 || rng.chance(dt * 0.1)) {   // they drift: toward where they last heard Kai, more at night
          const toKai = !k.dead && r < 55 && rng.chance(S.night ? 0.75 : 0.45), a = toKai ? Math.atan2(k.y - d.y, k.x - d.x) + rng.range(-0.6, 0.6) : rng.range(0, 6.28), rr = rng.range(4, 12); d.wx = d.x + Math.cos(a) * rr; d.wy = d.y + Math.sin(a) * rr; }
        gx = d.wx; gy = d.wy; sp *= S.night ? 0.6 : 0.4; }
      let dx = gx - d.x, dy = gy - d.y; const gd = Math.hypot(dx, dy) || 1; dx /= gd; dy /= gd;
      let vx = dx, vy = dy;
      if (d.state === 'chase' && r < R.dead.reach && !k.riding) { vx = 0; vy = 0;   // in reach: wind up, then bite (a dash gets out of it)
        if (d.wind <= 0 && d.bite <= 0) d.wind = R.dead.windup;
        if (d.wind > 0) { d.wind -= dt; if (d.wind <= 0) { d.bite = R.dead.bite; if (dist(d, k) < R.dead.reach + 0.4) G.hurtKai(K.dmg); } } }
      else for (const a of [0, 0.5, 1, 1.5, 2.1]) { const t = Math.atan2(dy, dx) + a * d.side, ax = Math.cos(t), ay = Math.sin(t); if (!blocked(d.x + ax * 1.1, d.y + ay * 1.1)) { vx = ax; vy = ay; break; } }
      d.bite = Math.max(0, d.bite - dt);
      for (const o of S.dead) { if (o === d) continue; const ex = d.x - o.x, ey = d.y - o.y, e = ex * ex + ey * ey; if (e < 0.8 && e > 1e-6) { vx += ex / e * 0.25; vy += ey / e * 0.25; } }
      d.vx += (vx * sp - d.vx) * Math.min(1, dt * 4); d.vy += (vy * sp - d.vy) * Math.min(1, dt * 4);
      const mx = d.x + d.vx * dt, my = d.y + d.vy * dt; if (!blocked(mx, d.y)) d.x = mx; if (!blocked(d.x, my)) d.y = my;
      d.ph += dt * sp * 5; if (Math.hypot(d.vx, d.vy) > 0.15) d.fa = Math.atan2(d.vy, d.vx); else if (d.state === 'chase') d.fa = Math.atan2(k.y - d.y, k.x - d.x);
    }
  }
  Object.assign(G, { spawn, kindRoll, hurtFoe, populate, stepFoes });
}
