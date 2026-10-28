// [roam] The rules of Hollowmere Roam, and nothing else: Kai walks or rides the town, the dead sleep, wander and chase,
// nests breed them and have a heart to break, the day turns to night (more dead, faster, hungrier). No base, no
// building. Deterministic: one Rng stream, a fixed step; the renderer and the UI only read `state` and send `input`.
import { Rng, hashSeed } from '../sim/rng.js';

export const ROAM = {
  step: 1 / 30, day: 240, night: 120,
  kai: { hp: 100, speed: 4.4, reach: 1.8, dmg: 1.6, swing: 0.42, regen: 3, regenAfter: 4, respawn: 3 },
  dash: { dist: 4.2, time: 0.22, cd: 1.2 },
  bike: { top: 14, accel: 9, brake: 14, turn: 2.6, ram: 6, ramDmg: 4, enter: 2.6 },
  dead: { cinder: { hp: 4, speed: 1.15, dmg: 7 }, flicker: { hp: 2.5, speed: 2.1, dmg: 5 }, brute: { hp: 12, speed: 0.85, dmg: 14 },
    bite: 1.1, windup: 0.35, reach: 1.05, sense: [12, 20], nightSpeed: 1.3, cap: [30, 70], near: 70, far: 110 },
  nest: { hp: 40, guards: 7, every: 7, nightEvery: 3.5 },
};

export function createRoam(town, seed = 1) {
  const R = ROAM, rng = new Rng(hashSeed(seed, 'roam')), { blocked, streetCells } = town;
  const S = {
    t: 0, clock: 40, night: false, kills: 0, nestsLeft: town.nests.length, won: false, events: [],
    kai: { x: town.start.x + 3, y: town.start.y + 5, vx: 0, vy: 0, face: 0, hp: R.kai.hp, maxHp: R.kai.hp, cd: 0, swing: 0, hurtT: -9, dead: 0, dash: 0, dashCd: 0, riding: false },
    bike: { x: town.start.x + 0.8, y: town.start.y + 6.2, ang: 0, speed: 0 },
    dead: [], nests: town.nests.map((n, id) => ({ id, x: n.x, y: n.y, b: n.b, hp: R.nest.hp, maxHp: R.nest.hp, alive: true, spawnT: rng.range(0, 4), hit: -9 })),
  };
  let nid = 1;
  const ev = (type, o) => S.events.push({ type, ...o });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // ---------- the dead ----------
  function spawn(kind, x, y, o = {}) { const K = R.dead[kind]; const d = { id: nid++, kind, x, y, vx: 0, vy: 0, hp: K.hp, maxHp: K.hp, fa: rng.range(0, 6.28), ph: rng.range(0, 6), side: rng.chance(0.5) ? -1 : 1, state: 'wander', wx: x, wy: y, bite: 0, wind: 0, hit: -9, ...o }; S.dead.push(d); return d; }
  const kindRoll = () => { const r = rng.float(); return r < (S.night ? 0.12 : 0.06) ? 'brute' : r < (S.night ? 0.32 : 0.2) ? 'flicker' : 'cinder'; };
  function streetNear(cx, cy, r0, r1) { for (let k = 0; k < 30; k++) { const i = rng.int(streetCells.length / 2) * 2, x = streetCells[i], y = streetCells[i + 1], d = Math.hypot(x - cx, y - cy); if (d > r0 && d < r1) return { x, y }; } return null; }
  function populate() {
    const k = S.kai, cap = R.dead.cap[S.night ? 1 : 0];
    let near = 0; for (const d of S.dead) if (dist(d, k) < R.dead.near) near++;
    for (let tries = 0; near < cap && tries < 6; tries++) { const p = streetNear(k.x, k.y, 24, R.dead.near); if (!p) break;
      const group = !S.night && rng.chance(0.4) ? 2 + rng.int(4) : 1;   // by day some sleep in little groups
      for (let g = 0; g < group; g++) { const x = p.x + rng.range(-1.5, 1.5), y = p.y + rng.range(-1.5, 1.5); if (!blocked(x, y)) { spawn(kindRoll(), x, y, { state: group > 1 ? 'sleep' : 'wander' }); near++; } } }
    for (let i = S.dead.length - 1; i >= 0; i--) { const d = S.dead[i]; if (d.nest === undefined && dist(d, k) > R.dead.far) S.dead.splice(i, 1); }
  }
  function kill(d, src) { const i = S.dead.indexOf(d); if (i < 0) return; S.dead.splice(i, 1); S.kills++; ev('die', { id: d.id, x: d.x, y: d.y, fa: d.fa, kind: d.kind, src }); }
  function hurtDead(d, n, src) { d.hp -= n; d.hit = S.t; if (d.state === 'sleep') d.state = 'chase'; if (d.hp <= 0) kill(d, src); }
  // ---------- Kai ----------
  function hurtKai(n) { const k = S.kai; if (k.dead || k.dash > 0) return; k.hp -= n; k.hurtT = S.t; ev('hurt', { n }); if (k.hp <= 0) { k.hp = 0; k.dead = R.kai.respawn; k.riding = false; ev('down', {}); } }
  function stepKai(dt, inp) {
    const k = S.kai, b = S.bike;
    if (k.dead > 0) { k.dead -= dt; if (k.dead <= 0) { k.dead = 0; k.hp = k.maxHp; k.x = town.start.x + 3; k.y = town.start.y + 5; ev('back', {}); } return; }
    if (inp.ride) { inp.ride = false; if (k.riding) { k.riding = false; const s = Math.sin(b.ang), c = Math.cos(b.ang); for (const off of [1.6, -1.6]) { const x = b.x - s * off, y = b.y + c * off; if (!blocked(x, y)) { k.x = x; k.y = y; break; } } b.speed = 0; ev('dismount', {}); }
      else if (dist(k, b) < R.bike.enter) { k.riding = true; ev('mount', {}); } }
    if (k.riding) {   // the bike: throttle along the stick, steer toward it; it rams the dead it meets at speed
      const want = Math.hypot(inp.x, inp.y) > 0.15 ? Math.atan2(inp.y, inp.x) : null;
      if (want !== null) { let d = want - b.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); b.ang += Math.max(-1, Math.min(1, d * 2.5)) * R.bike.turn * dt * Math.min(1, 0.3 + b.speed / 6);
        const throttle = Math.min(1, Math.hypot(inp.x, inp.y)) * (Math.abs(d) > 2.2 ? 0.2 : 1); b.speed = Math.min(R.bike.top * throttle, b.speed + R.bike.accel * dt); }
      else b.speed = Math.max(0, b.speed - R.bike.brake * 0.5 * dt);
      const nx = b.x + Math.cos(b.ang) * b.speed * dt, ny = b.y + Math.sin(b.ang) * b.speed * dt;
      if (blocked(nx, ny)) { if (b.speed > 6) ev('crash', { x: b.x, y: b.y }); b.speed *= -0.25; } else { b.x = nx; b.y = ny; }
      if (b.speed > R.bike.ram) for (const d of [...S.dead]) if (dist(d, b) < 1.3) { hurtDead(d, R.bike.ramDmg * b.speed / R.bike.top, 'bike'); b.speed *= 0.8; const a = Math.atan2(d.y - b.y, d.x - b.x); d.vx += Math.cos(a) * 6; d.vy += Math.sin(a) * 6; ev('ram', { x: d.x, y: d.y }); }
      k.x = b.x; k.y = b.y; k.vx = Math.cos(b.ang) * b.speed; k.vy = Math.sin(b.ang) * b.speed; k.face = b.ang;
    } else {
      if (inp.dash && k.dashCd <= 0) { k.dash = R.dash.time; k.dashCd = R.dash.cd; ev('dash', { x: k.x, y: k.y }); } inp.dash = false;
      const sp = k.dash > 0 ? R.dash.dist / R.dash.time : R.kai.speed, m = Math.hypot(inp.x, inp.y);
      let tx = 0, ty = 0; if (m > 0.05) { tx = inp.x / Math.max(1, m); ty = inp.y / Math.max(1, m); } else if (k.dash > 0) { tx = Math.cos(k.face); ty = Math.sin(k.face); }
      k.vx += (tx * sp - k.vx) * Math.min(1, dt * (k.dash > 0 ? 30 : 10)); k.vy += (ty * sp - k.vy) * Math.min(1, dt * (k.dash > 0 ? 30 : 10));
      const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt; if (!blocked(nx, k.y)) k.x = nx; if (!blocked(k.x, ny)) k.y = ny;
      if (Math.hypot(k.vx, k.vy) > 0.3) k.face = Math.atan2(k.vy, k.vx);
      k.dash = Math.max(0, k.dash - dt);
      // the wrench: hits the nearest dead (or a nest's heart) in reach, on its own
      k.cd -= dt; k.swing = Math.max(0, k.swing - dt);
      if (k.cd <= 0) {
        let tgt = null, td = R.kai.reach; for (const d of S.dead) { const r = dist(d, k); if (r < td) { td = r; tgt = d; } }
        let nest = null; if (!tgt) for (const n of S.nests) if (n.alive && dist(n, k) < R.kai.reach + 0.8) nest = n;
        if (tgt || nest) { const o = tgt || nest; k.cd = R.kai.swing; k.swing = 0.25; if (m < 0.1) k.face = Math.atan2(o.y - k.y, o.x - k.x); ev('swing', {});
          if (tgt) hurtDead(tgt, R.kai.dmg, 'kai'); else { nest.hp -= R.kai.dmg; nest.hit = S.t; ev('nestHit', { id: nest.id }); if (nest.hp <= 0) { nest.alive = false; S.nestsLeft--; ev('nestDown', { id: nest.id, x: nest.x, y: nest.y }); if (!S.nestsLeft) { S.won = true; ev('won', {}); } } } }
      }
    }
    k.dashCd = Math.max(0, k.dashCd - dt);
    if (S.t - k.hurtT > R.kai.regenAfter) k.hp = Math.min(k.maxHp, k.hp + R.kai.regen * dt);
  }
  // ---------- the dead think: sleep until something comes close, wander, chase Kai when they sense her ----------
  function stepDead(dt) {
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
        if (d.wind > 0) { d.wind -= dt; if (d.wind <= 0) { d.bite = R.dead.bite; if (dist(d, k) < R.dead.reach + 0.4) hurtKai(K.dmg); } } }
      else for (const a of [0, 0.5, 1, 1.5, 2.1]) { const t = Math.atan2(dy, dx) + a * d.side, ax = Math.cos(t), ay = Math.sin(t); if (!blocked(d.x + ax * 1.1, d.y + ay * 1.1)) { vx = ax; vy = ay; break; } }
      d.bite = Math.max(0, d.bite - dt);
      for (const o of S.dead) { if (o === d) continue; const ex = d.x - o.x, ey = d.y - o.y, e = ex * ex + ey * ey; if (e < 0.8 && e > 1e-6) { vx += ex / e * 0.25; vy += ey / e * 0.25; } }
      d.vx += (vx * sp - d.vx) * Math.min(1, dt * 4); d.vy += (vy * sp - d.vy) * Math.min(1, dt * 4);
      const mx = d.x + d.vx * dt, my = d.y + d.vy * dt; if (!blocked(mx, d.y)) d.x = mx; if (!blocked(d.x, my)) d.y = my;
      d.ph += dt * sp * 5; if (Math.hypot(d.vx, d.vy) > 0.15) d.fa = Math.atan2(d.vy, d.vx); else if (d.state === 'chase') d.fa = Math.atan2(k.y - d.y, k.x - d.x);
    }
  }
  // ---------- nests breed guards; faster at night ----------
  function stepNests(dt) {
    for (const n of S.nests) { if (!n.alive) continue; if ((n.spawnT -= dt) > 0) continue; n.spawnT = S.night ? R.nest.nightEvery : R.nest.every;
      const guards = S.dead.filter(d => d.nest === n.id).length; if (guards >= R.nest.guards || dist(n, S.kai) > 140) continue;
      for (let k = 0; k < 8; k++) { const a = rng.range(0, 6.28), x = n.x + Math.cos(a) * rng.range(1.5, 4), y = n.y + Math.sin(a) * rng.range(1.5, 4); if (!blocked(x, y)) { spawn(kindRoll(), x, y, { nest: n.id, state: 'wander', wx: x, wy: y }); ev('breed', { id: n.id }); break; } } }
  }
  // ---------- the loop ----------
  let popT = 0;
  function step(inp) {
    const dt = R.step; S.t += dt; S.clock += dt;
    const night = S.clock % (R.day + R.night) >= R.day; if (night !== S.night) { S.night = night; ev(night ? 'dusk' : 'dawn', {}); }
    stepKai(dt, inp); stepDead(dt); stepNests(dt);
    if ((popT -= dt) <= 0) { popT = 1; populate(); }
  }
  for (let k = 0; k < 6; k++) populate();
  return { state: S, step, drain: () => S.events.splice(0), dayPhase: () => { const c = S.clock % (R.day + R.night); return S.night ? { night: true, left: R.day + R.night - c } : { night: false, left: R.day - c }; } };
}
