// [roam] The machines: where they appear (out of sight, on the streets round Kai), how they think (sleep, wander, chase)
// and fight, by their `ai` (src/play/machines.js): melee (close in, wind up, bite), hound (follows from far, never lets
// go, lunges), ranged (keeps its distance, flares its eye, spits a bolt). Reads G.S, G.view; offers G.spawn, G.kindRoll,
// G.hurtFoe, G.populate, G.stepFoes. (The state keeps the prototype's id `S.dead` for the machines.)
import { PIPS, STATUSES } from '../../play/statuses.js';
export function createFoes(G) {
  const { R, S, rng, ev, dist, town } = G, { blocked, streetCells } = town;
  let nid = 1;
  // [m4] a machine is tougher in a higher-level area
  const lvlHp = (x, y) => G.levelAt ? 1 + R.areas.hpPerLevel * (G.levelAt(x, y) - 1) : 1;
  function spawn(kind, x, y, o = {}) { const K = R.dead[kind], hp0 = K.hp * lvlHp(x, y); const d = { id: nid++, kind, x, y, x0: x, y0: y, vx: 0, vy: 0, hp: hp0, maxHp: hp0, fa: rng.range(0, 6.28), ph: rng.range(0, 6), side: rng.chance(0.5) ? -1 : 1, state: 'wander', wx: x, wy: y, bite: 0, wind: 0, hit: -9, cd: rng.range(0.5, 2), aim: 0, lunge: 0, lungeCd: 0, ...o }; S.dead.push(d); return d; }
  // which machine: by each kind's weight, day or night
  const KINDS = Object.keys(R.dead).filter(k => R.dead[k] && R.dead[k].weight);
  // at most `most` of a kind on Kai's trail at once (a sky full of bolts is noise, not danger)
  const kindRoll = () => { const w = KINDS.map(k => { const K = R.dead[k]; if (K.most && S.dead.filter(d => d.kind === k && d.state === 'chase').length >= K.most) return 0; return K.weight[S.night ? 1 : 0]; }), sum = w.reduce((a, b) => a + b, 0); let r = rng.float() * sum; for (let i = 0; i < KINDS.length; i++) { r -= w[i]; if (r <= 0) return KINDS[i]; } return KINDS[0]; };
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
    for (let tries = 0; near < cap && tries < 6; tries++) { const p = streetNear(k.x, k.y, r0, r1); if (!p) break; if (G.isClean && G.isClean(p.x, p.y)) continue;   // [m4] clean stays clean
      const kind = kindRoll(), K = R.dead[kind], pack = K.pack ? K.pack[0] + rng.int(K.pack[1] - K.pack[0] + 1) : 0;   // skitters come in packs
      const group = pack || (!S.night && rng.chance(0.25) ? 2 + rng.int(4) : 1);   // by day some sleep in little groups
      for (let g = 0; g < group; g++) { const x = p.x + rng.range(-1.5, 1.5), y = p.y + rng.range(-1.5, 1.5); if (!blocked(x, y) && !(G.isClean && G.isClean(x, y))) { spawn(g === 0 || pack ? kind : kindRoll(), x, y, { state: group > 1 && !pack ? 'sleep' : 'wander' }); near++; } } }
    for (let i = S.dead.length - 1; i >= 0; i--) { const d = S.dead[i]; if (d.nest === undefined && !d.boss && d.state !== 'chase' && dist(d, k) > far) S.dead.splice(i, 1); }
  }
  function kill(d, src) { const i = S.dead.indexOf(d); if (i < 0) return; S.dead.splice(i, 1); S.kills++; for (const f of G.onDie || []) f(d, src); ev('die', { id: d.id, x: d.x, y: d.y, fa: d.fa, kind: d.kind, src }); }
  // being shot wakes a machine and sets it on you (nothing sits still while you snipe it)
  // and the noise sets the others near it on you too: shooting into a group brings the group
  function hurtFoe(d, n, src) { if (d.boss) { G.hurtBoss(d, n, src); return; } d.hp -= n; d.hit = S.t; if (d.state !== 'chase') { d.state = 'chase'; for (const o of S.dead) if (o.state !== 'chase' && dist(o, d) < R.dead.alarm) o.state = 'chase'; } if (d.hp <= 0) kill(d, src); }
  // steer round walls: try the straight line, then fan out to its side
  // [atoms] they walk round walls and round fire (unless already standing in it: then any way out will do)
  const fireAhead = (d, x, y) => G.hot && !G.hot(d.x, d.y) && G.hot(x, y);
  function steer(d, dx, dy) { for (const a of [0, 0.5, 1, 1.5, 2.1, -0.5, -1, -1.5, -2.1]) { const t = Math.atan2(dy, dx) + a * d.side, ax = Math.cos(t), ay = Math.sin(t); if (!blocked(d.x + ax * 1.1, d.y + ay * 1.1) && !fireAhead(d, d.x + ax * 1.8, d.y + ay * 1.8)) return [ax, ay]; } return [dx, dy]; }
  function stepFoes(dt) {
    const k = S.kai, sense0 = R.dead.sense[S.night ? 1 : 0] * (k.riding ? 1.3 : 1);   // the engine is loud
    for (const d of S.dead) { if (d.boss) continue;   // [m4] walkers: areas.js
      const K = R.dead[d.kind], ai = K.ai || 'melee', r = dist(d, k), sense = sense0 * (K.sense || 1), forget = K.forget || sense * 1.6, st = d.st || {}, blind = !!st.blind, seesKai = !k.dead && !blind && r < sense;
      if (blind && d.state === 'chase') { d.state = 'wander'; d.wx = d.x; d.wy = d.y; d.aim = 0; d.wind = 0; }   // [m2] lost in the steam
      if (d.state === 'sleep') { if (!k.dead && r < (k.riding ? 9 : 5)) d.state = 'chase'; else { d.vx *= 0.8; d.vy *= 0.8; continue; } }
      if (seesKai) d.state = 'chase'; else if (d.state === 'chase' && (r > forget || k.dead)) { d.state = 'wander'; d.wx = d.x; d.wy = d.y; }
      let gx, gy, sp = K.speed * (S.night ? R.dead.nightSpeed : 1) * (1 - Math.max((d.pips || []).filter(p => p.el === 'water').length * PIPS.water.slow, st.soaked ? STATUSES.soaked.slow : 0, G.onWet && G.onWet(d) ? PIPS.water.slow * 2 : 0));   // [m2] water pips and soaked slow it
      if (d.state === 'chase' && !k.dead) { gx = k.x; gy = k.y; }
      else { if (Math.hypot(d.wx - d.x, d.wy - d.y) < 1 || rng.chance(dt * 0.1)) {   // they drift: toward where they last heard Kai, more at night
          const toKai = !k.dead && r < 55 && rng.chance(S.night ? 0.75 : 0.45), a = toKai ? Math.atan2(k.y - d.y, k.x - d.x) + rng.range(-0.6, 0.6) : rng.range(0, 6.28), rr = rng.range(4, 12); d.wx = d.x + Math.cos(a) * rr; d.wy = d.y + Math.sin(a) * rr; }
        gx = d.wx; gy = d.wy; sp *= S.night ? 0.6 : 0.4; }
      let dx = gx - d.x, dy = gy - d.y; const gd = Math.hypot(dx, dy) || 1; dx /= gd; dy /= gd;
      let vx = dx, vy = dy;
      const chasing = d.state === 'chase' && !k.dead;
      if (ai === 'ranged' && chasing) {   // keep the distance band, circle inside it; stop, flare the eye, spit
        d.cd -= dt;
        if (d.aim > 0) { vx = 0; vy = 0; d.aim -= dt; d.fa = Math.atan2(k.y - d.y, k.x - d.x);
          if (d.aim <= 0) { d.cd = K.every; G.foeShoot(d); } }
        else { const [a, b] = K.keep; if (r > b) [vx, vy] = steer(d, dx, dy); else if (r < a) [vx, vy] = steer(d, -dx, -dy); else [vx, vy] = steer(d, -dy * d.side, dx * d.side);
          if (r > b + 2) sp *= 1.3;
          if (d.cd <= 0 && r < K.range) { d.aim = K.windup; ev('aim', { id: d.id }); } }
      } else {
        const reach = (k.riding ? R.dead.rideReach : R.dead.reach) * (K.reach || 1), mine = Math.hypot(d.vx, d.vy), fast = k.riding && S.bike.speed > Math.max(R.bike.ram, mine * R.dead.catchUp);   // on the bike: they latch on unless you're clearly faster than they are (a lunging hound catches you at almost any speed)
        if (ai === 'hound' && chasing) {   // the lunge: a burst straight at her, then a pause
          d.lungeCd -= dt;
          if (d.lunge > 0) { d.lunge -= dt; sp = K.lunge.speed; }
          else if (d.lungeCd <= 0 && r < K.lunge.range && r > reach) { d.lunge = K.lunge.time; d.lungeCd = K.lunge.cd; ev('lunge', { id: d.id }); } }
        if (chasing && r < reach && !fast) { vx = 0; vy = 0;   // in reach: wind up, then bite (a dash gets out of it)
          if (d.wind <= 0 && d.bite <= 0) d.wind = K.windup || R.dead.windup;
          if (d.wind > 0) { d.wind -= dt; if (d.wind <= 0) { d.bite = R.dead.bite; if (dist(d, k) < reach + 0.4) G.hurtKai(K.dmg); } } }
        else [vx, vy] = steer(d, dx, dy);
      }
      d.bite = Math.max(0, d.bite - dt);
      for (const o of S.dead) { if (o === d) continue; const ex = d.x - o.x, ey = d.y - o.y, e = ex * ex + ey * ey; if (e < 0.8 && e > 1e-6) { vx += ex / e * 0.25; vy += ey / e * 0.25; } }
      const grip = d.lunge > 0 ? 10 : 4; d.vx += (vx * sp - d.vx) * Math.min(1, dt * grip); d.vy += (vy * sp - d.vy) * Math.min(1, dt * grip);
      const mx = d.x + d.vx * dt, my = d.y + d.vy * dt; if (!blocked(mx, d.y)) d.x = mx; if (!blocked(d.x, my)) d.y = my;
      d.ph += dt * sp * 5; if (d.aim > 0) {} else if (Math.hypot(d.vx, d.vy) > 0.15) d.fa = Math.atan2(d.vy, d.vx); else if (d.state === 'chase') d.fa = Math.atan2(k.y - d.y, k.x - d.x);
    }
  }
  // noise: gunfire carries; machines in earshot come for you (sleepers only wake if it's close). Holding the trigger
  // draws a crowd: firing is the risk you take for the kills
  function noise(x, y, r) { for (const d of S.dead) { if (d.state === 'chase') continue; const q = Math.hypot(d.x - x, d.y - y); if (q < (d.state === 'sleep' ? r * 0.45 : r)) d.state = 'chase'; } }
  Object.assign(G, { spawn, kindRoll, hurtFoe, populate, stepFoes, noise, killFoe: kill });
}
