// [roam] The guns: while the fire input is held, the main weapon aims itself at the nearest machine in range (or a nest's
// heart) and fires the shot the fire pipeline builds; pellets fly, hit machines, hearts and walls. Its own Rng stream (the
// pellets' spread), so firing never shifts the world's draws. Offers G.stepGuns(dt, inp).
import { Rng, hashSeed } from '../../sim/rng.js';
import { WEAPONS } from '../../play/parts/weapons.js';
import { buildShot } from '../../play/fire.js';
export function createGuns(G) {
  const { R, S, ev, dist, town } = G, { blocked } = town, rng = new Rng(hashSeed(G.seed, 'guns'));
  S.guns = { main: { base: 'scatter', mods: [], cd: 0, aim: 0, target: -1 } };
  S.shots = [];
  let sid = 1;
  function targetOf(k, range) { let tgt = null, td = range;
    for (const d of S.dead) { const r = dist(d, k); if (r < td) { td = r; tgt = d; } }
    if (!tgt) for (const n of S.nests) if (n.alive) { const r = dist(n, k); if (r < td) { td = r; tgt = n; } }
    return tgt; }
  // aimed by hand (inp.aim, an angle: dragging off the FIRE button) or by itself at the nearest machine or heart
  function fire(g, k, inp) {
    const shot = buildShot(WEAPONS[g.base], g.mods), manual = typeof inp.aim === 'number', tgt = manual ? null : targetOf(k, shot.range);
    const ang = manual ? inp.aim : tgt ? Math.atan2(tgt.y - k.y, tgt.x - k.x) : k.face;
    g.aim = ang; g.manual = manual; g.target = tgt ? (tgt.kind ? tgt.id : -1) : -1; g.cd = 1 / shot.rate;
    G.noise(k.x, k.y, R.gun.noise); G.heatUp(R.hunt.perShot);
    for (let i = 0; i < shot.count; i++) { const a = ang + (shot.count > 1 ? (i / (shot.count - 1) - 0.5) * shot.spread * 2 : 0) + rng.range(-0.04, 0.04), sp = shot.speed * rng.range(0.92, 1.05);
      S.shots.push({ id: sid++, x: k.x + Math.cos(ang) * 0.9, y: k.y + Math.sin(ang) * 0.9, vx: Math.cos(a) * sp + k.vx * 0.5, vy: Math.sin(a) * sp + k.vy * 0.5, life: shot.range / shot.speed, dmg: shot.dmg, close: shot.closeBonus || 0, ox: k.x, oy: k.y, pierce: shot.pierce }); }
    ev('shot', { x: k.x, y: k.y, ang, n: shot.count });
  }
  function stepShots(dt) {
    for (let i = S.shots.length - 1; i >= 0; i--) { const p = S.shots[i]; p.life -= dt;
      const x0 = p.x, y0 = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
      let gone = p.life <= 0;
      if (!gone && blocked(p.x, p.y)) { gone = true; ev('spark', { x: x0, y: y0 }); }
      if (!gone) for (const d of S.dead) {   // a pellet hits what its path passes within reach of (no tunnelling at speed)
        const ex = p.x - x0, ey = p.y - y0, L2 = ex * ex + ey * ey || 1e-9, u = Math.max(0, Math.min(1, ((d.x - x0) * ex + (d.y - y0) * ey) / L2)), hx = x0 + ex * u, hy = y0 + ey * u;
        if (Math.hypot(d.x - hx, d.y - hy) < R.gun.hitR) { const near = Math.hypot(hx - p.ox, hy - p.oy) < 5 ? 1 + p.close : 1, a = Math.atan2(p.vy, p.vx);
          d.vx += Math.cos(a) * R.gun.push; d.vy += Math.sin(a) * R.gun.push; ev('hit', { x: hx, y: hy, id: d.id, ang: a });
          G.hurtFoe(d, p.dmg * near, 'gun'); if (p.pierce-- <= 0) { gone = true; break; } } }
      if (!gone) for (const n of S.nests) if (n.alive && dist(n, p) < R.gun.heartR) { G.hitNest(n, p.dmg); ev('hit', { x: p.x, y: p.y, id: -1, ang: Math.atan2(p.vy, p.vx) }); gone = true; break; }
      if (gone) S.shots.splice(i, 1); }
  }
  function stepGuns(dt, inp) {
    const k = S.kai, g = S.guns.main; g.cd = Math.max(0, g.cd - dt);
    if (inp.fire && !k.dead && g.cd <= 0) fire(g, k, inp);
    stepShots(dt);
  }
  Object.assign(G, { stepGuns });
}
