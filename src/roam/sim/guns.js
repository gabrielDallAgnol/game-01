// [roam] The guns: while the fire input is held, the main weapon aims itself at the nearest machine in range (or a nest's
// heart) and fires the shot the fire pipeline builds; pellets fly, hit machines, hearts and walls. Its own Rng stream (the
// pellets' spread), so firing never shifts the world's draws. Offers G.stepGuns(dt, inp).
import { Rng, hashSeed } from '../../sim/rng.js';
import { WEAPONS } from '../../play/parts/weapons.js';
import { buildShot } from '../../play/fire.js';
export function createGuns(G) {
  const { R, S, ev, dist, town } = G, { blocked } = town, rng = new Rng(hashSeed(G.seed, 'guns'));
  // [m2] the gun carries an element; the off-hand is not a weapon but an enchant: every `every`th shot carries its element
  // instead (fire gun + water enchant: fire, water, fire... a mix in three pips). Set from the loadout (G.setLoadout).
  S.guns = { main: { base: 'scatter', mods: [], test: [], el: null, cd: 0, aim: 0, target: -1, n: 0 }, off: { enchant: 'water', every: 2 } };
  S.shots = [];
  let sid = 1;
  function targetOf(k, range) { let tgt = null, td = range;
    for (const d of S.dead) { const r = dist(d, k); if (r < td) { td = r; tgt = d; } }
    if (!tgt) for (const n of S.nests) if (n.alive) { const r = dist(n, k); if (r < td) { td = r; tgt = n; } }
    return tgt; }
  // aimed by hand (inp.aim, an angle: dragging off the FIRE button) or by itself at the nearest machine or heart
  // how long a shot flies to cover its range (a rocket starts slow and speeds up to vmax)
  const lifeOf = s => { if (!s.accel) return s.range / s.speed; const ta = (s.vmax - s.speed) / s.accel, da = (s.speed + s.vmax) / 2 * ta; return da >= s.range ? ta * s.range / da : ta + (s.range - da) / s.vmax; };
  function fire(g, k, inp) {
    const shot = buildShot(WEAPONS[g.base], [...g.mods, ...g.test]), aimIn = inp.aim, off = S.guns.off;
    g.n++; const el = off.enchant && off.every && g.n % off.every === 0 ? off.enchant : (g.el || shot.element);
    const manual = typeof aimIn === 'number', tgt = manual ? null : targetOf(k, shot.range);
    const ang = manual ? aimIn : tgt ? Math.atan2(tgt.y - k.y, tgt.x - k.x) : k.face;
    g.aim = ang; g.manual = manual; g.target = tgt ? (tgt.kind ? tgt.id : -1) : -1; g.cd = 1 / shot.rate;
    G.noise(k.x, k.y, R.gun.noise); G.heatUp(R.hunt.perShot);
    for (let i = 0; i < shot.count; i++) { const a = ang + (shot.count > 1 ? (i / (shot.count - 1) - 0.5) * shot.spread * 2 : 0) + rng.range(-0.04, 0.04), sp = shot.speed * rng.range(0.92, 1.05);
      S.shots.push({ id: sid++, x: k.x + Math.cos(ang) * 0.9, y: k.y + Math.sin(ang) * 0.9, vx: Math.cos(a) * sp + k.vx * 0.5, vy: Math.sin(a) * sp + k.vy * 0.5, life: lifeOf(shot), acc: shot.accel || 0, vmax: shot.vmax || 0, dmg: shot.dmg, close: shot.closeBonus || 0, ox: k.x, oy: k.y, pierce: shot.pierce, el, push: shot.push || R.gun.push, del: shot.delivery || 'pellet', splash: shot.splash, stream: shot.stream, big: shot.size > 1.2, bounce: shot.bounce || 0, last: -1 }); }
    ev('shot', { x: k.x, y: k.y, ang, n: shot.count, el, base: g.base });
    if (shot.delivery === 'splash') G.noise(k.x, k.y, R.gun.noise * 1.6);
  }
  function land(p, x, y) {
    if (p.del === 'splash') { const B = p.splash; ev('blast', { x, y, r: B.r, el: p.el });
      for (const d of [...S.dead]) { const q = Math.hypot(d.x - x, d.y - y); if (q < B.r) { G.hurtFoe(d, B.dmg * (1 - 0.5 * q / B.r), 'gun'); if (p.el) G.hitElement(d, p.el); } }
      for (const n of S.nests) if (n.alive && Math.hypot(n.x - x, n.y - y) < B.r + 1) G.hitNest(n, B.dmg);
      const k = S.kai, q = Math.hypot(k.x - x, k.y - y); if (q < B.r * 0.8 && !k.dead) G.hurtKai(B.dmg * 0.6 * (1 - q / B.r));
      G.deliver(p.el, x, y, B.r, B.power); }
    else if (p.del === 'stream' && p.el) G.deliver(p.el, x, y, p.stream.r, p.stream.power); }
  function stepShots(dt) {
    for (let i = S.shots.length - 1; i >= 0; i--) { const p = S.shots[i]; p.life -= dt;
      if (p.acc) { const sp = Math.hypot(p.vx, p.vy), ns = Math.min(p.vmax, sp + p.acc * dt); p.vx *= ns / sp; p.vy *= ns / sp; }   // [m3b] a rocket speeds up
      const x0 = p.x, y0 = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
      // [atoms] a pellet never touches the world (it is spent before it lands); a rocket bursts where it stops, a stream
      // leaves its element wherever its drops end
      let gone = p.life <= 0, lx = p.x, ly = p.y;
      if (!gone && blocked(p.x, p.y)) { ev('spark', { x: x0, y: y0 });
        // [m3] ricochet: glance off the wall (flip the part of the velocity that ran into it)
        if (p.bounce > 0 && p.del === 'pellet') { p.bounce--; if (blocked(p.x, y0)) p.vx = -p.vx; if (blocked(x0, p.y)) p.vy = -p.vy; if (!blocked(p.x, y0) && !blocked(x0, p.y)) { p.vx = -p.vx; p.vy = -p.vy; } p.x = x0; p.y = y0; }
        else { gone = true; lx = x0; ly = y0; } }
      if (!gone) for (const d of S.dead) { if (d.id === p.last) continue;   // a pellet hits what its path passes within reach of (no tunnelling at speed)
        const ex = p.x - x0, ey = p.y - y0, L2 = ex * ex + ey * ey || 1e-9, u = Math.max(0, Math.min(1, ((d.x - x0) * ex + (d.y - y0) * ey) / L2)), hx = x0 + ex * u, hy = y0 + ey * u;
        if (Math.hypot(d.x - hx, d.y - hy) < R.gun.hitR) { const near = Math.hypot(hx - p.ox, hy - p.oy) < 5 ? 1 + p.close : 1, a = Math.atan2(p.vy, p.vx);
          d.vx += Math.cos(a) * p.push; d.vy += Math.sin(a) * p.push; ev('hit', { x: hx, y: hy, id: d.id, ang: a, el: p.el });
          G.hurtFoe(d, p.dmg * near, 'gun'); if (p.el) G.hitElement(d, p.el); if (p.pierce-- <= 0) {
            // [m3] ricochet: jump to the nearest other machine in reach
            let nx = null, nr = R.gun.jump; if (p.bounce > 0 && p.del === 'pellet') for (const o of S.dead) { if (o === d) continue; const q = Math.hypot(o.x - hx, o.y - hy); if (q < nr) { nr = q; nx = o; } }
            if (nx) { p.bounce--; p.last = d.id; const sp = Math.hypot(p.vx, p.vy), a2 = Math.atan2(nx.y - hy, nx.x - hx); p.vx = Math.cos(a2) * sp; p.vy = Math.sin(a2) * sp; p.x = hx; p.y = hy; p.life = Math.max(p.life, nr / sp + 0.1); p.pierce = 0; ev('ricochet', { x: hx, y: hy }); }
            else { gone = true; lx = hx; ly = hy; } break; } } }
      if (!gone) for (const n of S.nests) if (n.alive && dist(n, p) < R.gun.heartR) { G.hitNest(n, p.dmg); ev('hit', { x: p.x, y: p.y, id: -1, ang: Math.atan2(p.vy, p.vx) }); gone = true; break; }
      if (gone) { land(p, lx, ly); S.shots.splice(i, 1); } }
  }
  function stepGuns(dt, inp) {
    const k = S.kai, g = S.guns.main; g.cd = Math.max(0, g.cd - dt); if (inp.fire && !k.dead && g.cd <= 0) fire(g, k, inp);
    stepShots(dt);
  }
  // the loadout (a test control for now; later the garage): the gun's element and mods, the off-hand's enchant
  function setLoadout(o) { const g = S.guns.main, off = S.guns.off; if (o.base && WEAPONS[o.base]) { g.base = o.base; g.cd = 0; } if ('el' in o) g.el = o.el; if (o.mods) g.test = o.mods.slice(); if ('enchant' in o) off.enchant = o.enchant; if (o.every) off.every = o.every; }
  Object.assign(G, { stepGuns, setLoadout });
}
